const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { Resend } = require('resend');
const multer = require('multer');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;

// ==================== IMPORT MODELS ====================
const User = require('./models/user');
const QuickAdGeneration = require('./models/QuickAdGeneration');
const { quoteCampaign, hasCurrentPricing, creatorSlots, feeStats, verifyCharge } = require('./services/campaignPricing');
const { reviewSubmission } = require('./services/reviewSubmission');
const { requestWithdrawal, reviewWithdrawal } = require('./services/wallet');
const { mongoTransaction } = require('./services/databaseTransaction');
const { PURPOSE: QUICK_AD_PAYMENT_PURPOSE, assertCampaignPayment, verifyQuickAdPayment } = require('./services/quickAdPayments');

const app = express();

// ==================== MIDDLEWARE ====================
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://tryspreadfast.com',
  'https://www.tryspreadfast.com',
  process.env.CLIENT_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'Range'],
  exposedHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges']
}));
app.use(express.json({ verify: (req, res, buffer) => { if (req.originalUrl.split('?')[0] === '/api/payments/webhook') req.rawBody = buffer; } }));

// Reject requests during production outages; never acknowledge financial writes locally.
app.use('/api', (req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !isMongoConnected()) return res.status(503).json({success: false, message: 'Database temporarily unavailable. Please retry.'});
  next();
});

// ==================== ROUTES AFTER CORS ====================
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

// ==================== RESEND EMAIL ====================
let resend = null;
try {
  if (process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
    console.log('✅ Resend email service initialized');
  } else {
    console.warn('⚠️  RESEND_API_KEY not found in environment variables');
  }
} catch (error) {
  console.error('❌ Error initializing Resend:', error.message);
}

// ==================== CLOUDINARY SETUP ====================
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  console.log('✅ Cloudinary initialized');
} else {
  console.warn('⚠️  Cloudinary credentials not found in environment variables');
}

// ==================== PAYSTACK CONFIGURATION ====================
const getPaystackConfig = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    secretKey: isProduction 
      ? process.env.PAYSTACK_LIVE_SECRET_KEY 
      : process.env.PAYSTACK_TEST_SECRET_KEY,
    publicKey: isProduction 
      ? process.env.PAYSTACK_LIVE_PUBLIC_KEY 
      : process.env.PAYSTACK_TEST_PUBLIC_KEY,
    mode: isProduction ? 'Live' : 'Test'
  };
};

const paystackConfig = getPaystackConfig();
console.log(`✅ Paystack initialized in ${paystackConfig.mode} mode`);

// ==================== FILE UPLOAD CONFIGURATION ====================
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedFormats = ['image/jpeg', 'image/png', 'video/mp4', 'application/pdf'];
  if (allowedFormats.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file format. Only JPG, PNG, MP4, and PDF are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }
});

// ==================== JSON FALLBACK HELPERS ====================
// Development-only fallback. Production rejects requests while MongoDB is unreachable.

const isMongoConnected = () => mongoose.connection.readyState === 1;

const DATA_DIR = path.join(__dirname, 'data');

const readJSON = (filename) => {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    throw Object.assign(new Error('Local data is invalid: ' + filename), {statusCode: 503});
  }
};

const writeJSON = (filename, data) => {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2));
};

// Fallback model wrappers — mirror Mongoose methods used in routes
const localDB = {
  withTransaction: async () => { throw Object.assign(new Error('Wallet operations require a connected MongoDB database.'), {statusCode: 503}); },
  User: {
    find: (query = {}, projection = null) => {
      let data = readJSON('users.json');
      return Promise.resolve(matchQuery(data, query).map(u => projection ? omitFields(u, projection) : u));
    },
    findOne: (query) => {
      const data = readJSON('users.json');
      return Promise.resolve(matchQuery(data, query)[0] || null);
    },
    create: (doc) => {
      const data = readJSON('users.json');
      data.push(doc);
      writeJSON('users.json', data);
      return Promise.resolve(doc);
    },
    updateOne: (query, update) => {
      let data = readJSON('users.json');
      data = data.map(item => {
        if (!matchQuery([item], query).length) return item;
        const next = { ...item };
        for (const [key, value] of Object.entries(update)) {
          if (key === '$inc') for (const [field, increment] of Object.entries(value)) next[field] = (next[field] || 0) + increment;
          else if (key === '$push') for (const [field, entry] of Object.entries(value)) next[field] = [...(next[field] || []), entry];
          else next[key] = value;
        }
        return next;
      });
      writeJSON('users.json', data);
      return Promise.resolve({ nModified: 1 });
    }
  },
  Campaign: {
    find: (query = {}) => {
      const data = readJSON('campaigns.json');
      return Promise.resolve(matchQuery(data, query));
    },
    findOne: (query) => {
      const data = readJSON('campaigns.json');
      const result = matchQuery(data, query)[0] || null;
      // Add toObject() so enrichedSubmissions mapping works
      if (result) result.toObject = () => result;
      return Promise.resolve(result);
    },
    create: (doc) => {
      const data = readJSON('campaigns.json');
      if (data.some(c => c.id === doc.id)) return Promise.resolve(data.find(c => c.id === doc.id));
      data.push(doc);
      writeJSON('campaigns.json', data);
      return Promise.resolve(doc);
    },
    updateOne: (query, update) => {
      let data = readJSON('campaigns.json');
      data = data.map(item => matchQuery([item], query).length ? { ...item, ...update } : item);
      writeJSON('campaigns.json', data);
      return Promise.resolve({ nModified: 1 });
    },
    deleteOne: (query) => {
      let data = readJSON('campaigns.json');
      const before = data.length;
      data = data.filter(item => !matchQuery([item], query).length);
      writeJSON('campaigns.json', data);
      return Promise.resolve({ deletedCount: before - data.length });
    }
  },
  Submission: {
    find: (query = {}) => {
      const data = readJSON('submissions.json');
      return Promise.resolve(matchQuery(data, query).map(s => ({ ...s, toObject: () => s })));
    },
    findOne: (query) => {
      const data = readJSON('submissions.json');
      return Promise.resolve(matchQuery(data, query)[0] || null);
    },
    create: (doc) => {
      const data = readJSON('submissions.json');
      data.push(doc);
      writeJSON('submissions.json', data);
      return Promise.resolve(doc);
    },
    updateOne: (query, update) => {
      let data = readJSON('submissions.json');
      data = data.map(item => matchQuery([item], query).length ? { ...item, ...update } : item);
      writeJSON('submissions.json', data);
      return Promise.resolve({ nModified: 1 });
    }
  },
  Withdrawal: {
    find: (query = {}) => {
      const data = readJSON('withdrawals.json');
      return Promise.resolve(matchQuery(data, query));
    },
    findOne: (query) => {
      const data = readJSON('withdrawals.json');
      return Promise.resolve(matchQuery(data, query)[0] || null);
    },
    create: (doc) => {
      const data = readJSON('withdrawals.json');
      data.push(doc);
      writeJSON('withdrawals.json', data);
      return Promise.resolve(doc);
    },
    updateOne: (query, update) => {
      let data = readJSON('withdrawals.json');
      data = data.map(item => matchQuery([item], query).length ? { ...item, ...update } : item);
      writeJSON('withdrawals.json', data);
      return Promise.resolve({ nModified: 1 });
    }
  },
  PaystackTransaction: {
    find: (query = {}) => {
      const data = readJSON('transactions.json');
      return Promise.resolve(matchQuery(data, query));
    },
    findOne: (query) => {
      const data = readJSON('transactions.json');
      return Promise.resolve(matchQuery(data, query)[0] || null);
    },
    create: (doc) => {
      const data = readJSON('transactions.json');
      data.push(doc);
      writeJSON('transactions.json', data);
      return Promise.resolve(doc);
    },
    updateOne: (query, update) => {
      let data = readJSON('transactions.json');
      data = data.map(item => matchQuery([item], query).length ? { ...item, ...update } : item);
      writeJSON('transactions.json', data);
      return Promise.resolve({ nModified: 1 });
    }
  },
  CampaignAsset: {
    find: (query = {}) => {
      const data = readJSON('campaign_assets.json');
      return Promise.resolve(matchQuery(data, query));
    },
    findOne: (query) => {
      const data = readJSON('campaign_assets.json');
      return Promise.resolve(matchQuery(data, query)[0] || null);
    },
    create: (doc) => {
      const data = readJSON('campaign_assets.json');
      data.push(doc);
      writeJSON('campaign_assets.json', data);
      return Promise.resolve(doc);
    },
    updateOne: (query, update) => {
      let data = readJSON('campaign_assets.json');
      data = data.map(item => matchQuery([item], query).length ? { ...item, ...update } : item);
      writeJSON('campaign_assets.json', data);
      return Promise.resolve({ nModified: 1 });
    }
  },
  CampaignSubscription: {
    find: (query = {}) => {
      const data = readJSON('campaign_subscriptions.json');
      return Promise.resolve(matchQuery(data, query));
    },
    findOne: (query) => {
      const data = readJSON('campaign_subscriptions.json');
      return Promise.resolve(matchQuery(data, query)[0] || null);
    },
    create: (doc) => {
      const data = readJSON('campaign_subscriptions.json');
      data.push(doc);
      writeJSON('campaign_subscriptions.json', data);
      return Promise.resolve(doc);
    },
    updateOne: (query, update) => {
      let data = readJSON('campaign_subscriptions.json');
      data = data.map(item => matchQuery([item], query).length ? { ...item, ...update } : item);
      writeJSON('campaign_subscriptions.json', data);
      return Promise.resolve({ nModified: 1 });
    }
  }
};

// Simple query matcher — handles flat key/value pairs like { id: '...', email: '...' }
function matchQuery(data, query) {
  if (!query || Object.keys(query).length === 0) return data;
  return data.filter(item =>
    Object.entries(query).every(([key, val]) => {
      if (val && typeof val === 'object' && '$ne' in val) {
        const [parent, child] = key.split('.');
        return child ? !(item[parent] || []).some(entry => entry[child] === val.$ne) : item[key] !== val.$ne;
      }
      return item[key] === val;
    })
  );
}

function omitFields(obj, projection) {
  if (!projection) return obj;
  const result = { ...obj };
  Object.keys(projection).forEach(key => {
    if (projection[key] === 0) delete result[key];
  });
  return result;
}

// ==================== DB PROXY ====================
// Routes always call DB.User, DB.Campaign etc.
// Production requires MongoDB; development may read/write non-wallet JSON data.

const DB = new Proxy({}, {
  get(_, model) {
    if (isMongoConnected()) {
      // Use real Mongoose models
      const models = { User, Campaign, Submission, Withdrawal, PaystackTransaction, CampaignAsset, CampaignSubscription, QuickAdGeneration };
      if (model === 'withTransaction') return mongoTransaction(mongoose, models);
      return models[model];
    }
    if (process.env.NODE_ENV === 'production') throw Object.assign(new Error('Database temporarily unavailable'), {statusCode: 503});
    // Use local JSON fallback only outside production.
    console.warn(`⚠️  [LOCAL FALLBACK] Using JSON file for ${model}`);
    return localDB[model];
  }
});

app.locals.db = DB;

async function persistPaidCampaign(campaign) {
  const existing = await DB.Campaign.findOne({id: campaign.id})
    || (campaign.paystackReference && await DB.Campaign.findOne({paystackReference: campaign.paystackReference}));
  if (existing) return existing;
  try { return await DB.Campaign.create(campaign); } catch (error) {
    if (error.code !== 11000) throw error;
    return DB.Campaign.findOne({id: campaign.id});
  }
}

// ==================== MONGODB CONNECTION ====================
const connectDB = async () => {
  try {
    console.log('🔄 Attempting to connect to MongoDB...');
    console.log('📍 Connection string host:', process.env.MONGODB_URI.split('@')[1]?.split('?')[0] || 'unknown');

    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 60000,
      connectTimeoutMS: 30000,
      retryWrites: true,
      w: 'majority',
      maxPoolSize: 10,
      minPoolSize: 2,
      family: 4
    });
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.log('⚠️  Running in LOCAL FALLBACK mode — data will be saved to /data/*.json files');
    console.log('⚠️  This fallback is for local development only. Deploy as normal for production.');
    // Do NOT retry forever — just stay in fallback mode locally
    if (process.env.NODE_ENV === 'production') {
      console.log('🔁 Retrying in 5 seconds (production mode)...');
      setTimeout(connectDB, 5000);
    }
  }
};
connectDB();

// ==================== MONGODB MODELS ====================
const campaignSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  budget: { type: String, required: true },
  amountPaid: { type: Number, default: 0 },
  pricing: { type: Object, default: undefined },
  companyId: { type: String, required: true },
  socialMediaPlatforms: { type: [String], default: [] },
  keyMessage: { type: String, default: '' },
  brandAssets: { type: Array, default: [] },
  status: { type: String, default: 'active' },
  paystackReference: { type: String, default: null },
  subscribedPromoters: { type: Array, default: [] },
  submissions: { type: Array, default: [] },
  statusUpdatedAt: { type: String, default: null },
  createdAt: { type: String, default: () => new Date().toISOString() }
});
const Campaign = mongoose.model('Campaign', campaignSchema);

const campaignAssetSchema = new mongoose.Schema({
  campaign_id: { type: String, required: true },
  company_id: { type: String, required: true },
  file_name: { type: String, required: true },
  file_type: { type: String, enum: ['image', 'video', 'pdf', 'audio'], required: true },
  file_size: { type: Number, required: true },
  cloudinary_public_id: { type: String, required: true, unique: true },
  cloudinary_url: { type: String, required: true },
  is_active: { type: Boolean, default: true },
  uploaded_at: { type: String, default: () => new Date().toISOString() }
});
const CampaignAsset = mongoose.model('CampaignAsset', campaignAssetSchema);

const campaignSubscriptionSchema = new mongoose.Schema({
  promoter_id: { type: String, required: true },
  campaign_id: { type: String, required: true },
  status: { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' },
  joined_at: { type: String, default: () => new Date().toISOString() }
});
const CampaignSubscription = mongoose.model('CampaignSubscription', campaignSubscriptionSchema);

const submissionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  campaignId: { type: String, required: true },
  userId: { type: String, required: true },
  userName: { type: String, default: 'Unknown' },
  platforms: { type: [String], default: [] },
  proof: { type: String, default: '' },
  proofUrl: { type: String, default: '' },
  proofDescription: { type: String, default: '' },
  screenshot: { type: String, default: '' },
  status: { type: String, default: 'pending' },
  approvalAmount: { type: Number, default: 0 },
  pricing: { type: Object, default: undefined },
  reviewedAt: { type: String, default: null },
  createdAt: { type: String, default: () => new Date().toISOString() }
});
const Submission = mongoose.model('Submission', submissionSchema);

const withdrawalSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, default: null },
  promoterId: { type: String, default: null },
  userName: { type: String, default: null },
  promoterName: { type: String, default: null },
  email: { type: String, required: true },
  amount: { type: Number, required: true },
  bankDetails: { type: Object, required: true },
  status: { type: String, default: 'pending' },
  reviewedAt: { type: String, default: null },
  timestamp: { type: String, default: null },
  createdAt: { type: String, default: () => new Date().toISOString() }
});
const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);

const paystackTransactionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  reference: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  email: { type: String, required: true },
  amount: { type: Number, required: true },
  campaignName: { type: String, required: function () { return this.purpose !== 'quick_ad_credits'; } },
  purpose: { type: String, enum: ['campaign', 'quick_ad_credits'], default: 'campaign' },
  buyerRole: { type: String, enum: ['company', 'promoter'] },
  planId: String,
  credits: { type: Number, min: 1, validate: Number.isSafeInteger },
  creditsApplied: { type: Boolean, default: false },
  pricing: { type: Object, default: undefined },
  description: { type: String, default: '' },
  keyMessage: { type: String, default: '' },
  socialMediaPlatforms: { type: [String], default: [] },
  status: { type: String, default: 'pending' },
  campaignCreated: { type: Boolean, default: false },
  campaignId: { type: String, default: null },
  verifiedAt: { type: String, default: null },
  createdAt: { type: String, default: () => new Date().toISOString() }
});
const PaystackTransaction = mongoose.model('PaystackTransaction', paystackTransactionSchema);

const ActivityLog = require('./models/ActivityLog');

// ==================== EMAIL HELPER ====================
const sendEmail = async (to, subject, html) => {
  try {
    if (!resend) {
      console.warn('⚠️  Email service not available (RESEND_API_KEY not configured)');
      return { id: 'mock-' + Date.now(), success: false };
    }
    const result = await resend.emails.send({
      from: 'SpreadFast <noreply@tryspreadfast.com>',
      to: to,
      subject: subject,
      html: html
    });
    console.log('Email sent successfully to:', to, '| ID:', result.id);
    return result;
  } catch (error) {
    console.error('Email send error:', error.message);
    throw error;
  }
};

// ==================== EMAIL FUNCTIONS ====================
const sendWelcomeEmail = async (name, email, role) => {
  const isCompany = role === 'company';
  const subject = 'Welcome to SpreadFast! 🎉';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #15803d; padding: 30px; border-radius: 10px; text-align: center;">
        <h1 style="color: white; margin: 0;">Welcome to SpreadFast!</h1>
      </div>
      <div style="padding: 30px; background: #f9f9f9; border-radius: 10px; margin-top: 20px;">
        <h2 style="color: #15803d;">Hi ${name}! 👋</h2>
        <p style="color: #444; font-size: 16px;">
          Your account has been created successfully as a
          <strong>${isCompany ? 'Company' : 'Promoter'}</strong>.
        </p>
        ${isCompany ? `
        <div style="background: #dcfce7; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #15803d;">As a Company you can:</h3>
          <ul style="color: #444;">
            <li>Create campaigns for promoters to spread</li>
            <li>Pay securely via Paystack</li>
            <li>Track promoter submissions</li>
            <li>Grow your brand fast</li>
          </ul>
        </div>
        ` : `
        <div style="background: #dcfce7; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #15803d;">As a Promoter you can:</h3>
          <ul style="color: #444;">
            <li>Browse available campaigns</li>
            <li>Submit proof of promotion</li>
            <li>Earn money directly to your wallet</li>
            <li>Withdraw to your bank account</li>
          </ul>
        </div>
        `}
        <div style="text-align: center; margin-top: 30px;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}"
             style="background-color: #15803d; color: white; padding: 15px 30px;
                    border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
            Go to SpreadFast →
          </a>
        </div>
      </div>
      <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
        © 2025 SpreadFast. All rights reserved.<br/>
        If you did not create this account, please ignore this email.
      </p>
    </div>
  `;
  await sendEmail(email, subject, html);
  console.log('Welcome email sent to:', email);
};

const sendCampaignConfirmationEmail = async (companyName, companyEmail, campaign) => {
  const subject = `✅ Your Campaign "${campaign.title}" is Now Live!`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #15803d; padding: 30px; border-radius: 10px; text-align: center;">
        <h1 style="color: white; margin: 0;">Campaign Live! 🚀</h1>
      </div>
      <div style="padding: 30px; background: #f9f9f9; border-radius: 10px; margin-top: 20px;">
        <h2 style="color: #15803d;">Hi ${companyName}!</h2>
        <p style="color: #444; font-size: 16px;">
          Your campaign has been created successfully and is now
          <strong style="color: #15803d;">LIVE</strong> to promoters!
        </p>
        <div style="background: #dcfce7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #15803d;">
          <h3 style="color: #15803d; margin-top: 0;">Campaign Details</h3>
          <table style="width: 100%; color: #444;">
            <tr><td style="padding: 8px 0;"><strong>Campaign Name:</strong></td><td>${campaign.title}</td></tr>
            <tr><td style="padding: 8px 0;"><strong>Budget:</strong></td><td>₦${parseFloat(campaign.budget).toLocaleString()}</td></tr>
            <tr><td style="padding: 8px 0;"><strong>Amount Paid:</strong></td><td>₦${parseFloat(campaign.amountPaid).toLocaleString()}</td></tr>
            <tr><td style="padding: 8px 0;"><strong>Platforms:</strong></td><td>${(campaign.socialMediaPlatforms || []).join(', ') || 'All platforms'}</td></tr>
            <tr><td style="padding: 8px 0;"><strong>Status:</strong></td><td style="color: #15803d;"><strong>Active ✅</strong></td></tr>
            <tr><td style="padding: 8px 0;"><strong>Payment Reference:</strong></td><td style="font-size: 12px;">${campaign.paystackReference || 'N/A'}</td></tr>
          </table>
        </div>
        <div style="text-align: center; margin-top: 30px;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/company"
             style="background-color: #15803d; color: white; padding: 15px 30px;
                    border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
            View Your Campaign →
          </a>
        </div>
      </div>
      <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">© 2025 SpreadFast. All rights reserved.</p>
    </div>
  `;
  await sendEmail(companyEmail, subject, html);
  console.log('Campaign confirmation email sent to:', companyEmail);
};

const sendPasswordResetEmail = async (name, email, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
  const subject = 'Reset your SpreadFast password';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #15803d; padding: 30px; border-radius: 10px; text-align: center;">
        <h1 style="color: white; margin: 0;">Password Reset Request</h1>
      </div>
      <div style="padding: 30px; background: #f9f9f9; border-radius: 10px; margin-top: 20px;">
        <h2 style="color: #15803d;">Hi ${name}!</h2>
        <p style="color: #444; font-size: 16px;">
          We received a request to reset your SpreadFast password. Click the button below to choose a new one.
          This link expires in 30 minutes.
        </p>
        <div style="text-align: center; margin-top: 30px;">
          <a href="${resetUrl}"
             style="background-color: #15803d; color: white; padding: 15px 30px;
                    border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
            Reset Password →
          </a>
        </div>
        <p style="color: #999; font-size: 13px; margin-top: 30px;">
          If you didn't request this, you can safely ignore this email — your password won't be changed.
        </p>
      </div>
      <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">© 2025 SpreadFast. All rights reserved.</p>
    </div>
  `;
  await sendEmail(email, subject, html);
  console.log('Password reset email sent to:', email);
};

const sendNewCampaignAlertToPromoters = async (campaign) => { if (process.env.NODE_ENV !== 'production') {
    console.log('📧 [DEV] Skipping promoter email alerts in development');
    return;
    }
    try {
    const promoters = await DB.User.find({ role: 'promoter' });
    if (promoters.length === 0) {
      console.log('No promoters to notify');
      return;
    }
    const promoterSlots = creatorSlots(campaign);
    const subject = `🔔 New Campaign Available: "${campaign.title}" — Earn Money Now!`;

    const emailPromises = promoters.map(async (promoter) => {
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #15803d; padding: 30px; border-radius: 10px; text-align: center;">
            <h1 style="color: white; margin: 0;">New Campaign Alert! 🔔</h1>
            <p style="color: #dcfce7; margin: 10px 0 0 0;">A new earning opportunity is available</p>
          </div>
          <div style="padding: 30px; background: #f9f9f9; border-radius: 10px; margin-top: 20px;">
            <h2 style="color: #15803d;">Hi ${promoter.name}! 👋</h2>
            <p style="color: #444; font-size: 16px;">A new campaign just went live on SpreadFast.
              <strong>Be one of the first to subscribe and start earning!</strong>
            </p>
            <div style="background: #dcfce7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #15803d;">
              <h3 style="color: #15803d; margin-top: 0;">📢 ${campaign.title}</h3>
              <table style="width: 100%; color: #444;">
                <tr><td style="padding: 8px 0;"><strong>Description:</strong></td><td>${campaign.description || 'Promote this brand on social media'}</td></tr>
                <tr><td style="padding: 8px 0;"><strong>Creator pool:</strong></td><td style="color: #15803d;"><strong>₦${parseFloat(campaign.budget).toLocaleString()}</strong></td></tr>
                <tr><td style="padding: 8px 0;"><strong>Available Slots:</strong></td><td><strong>${promoterSlots} promoters needed</strong></td></tr>
                <tr><td style="padding: 8px 0;"><strong>Platforms:</strong></td><td>${(campaign.socialMediaPlatforms || []).join(', ') || 'All platforms'}</td></tr>
                <tr><td style="padding: 8px 0;"><strong>Status:</strong></td><td style="color: #15803d;"><strong>Open for Subscription ✅</strong></td></tr>
              </table>
            </div>
            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
              <p style="color: #92400e; margin: 0; font-size: 14px;">
                ⚡ <strong>Act fast!</strong> Only ${promoterSlots} slots available. First come, first served!
              </p>
            </div>
            <div style="text-align: center; margin-top: 30px;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/campaigns"
                 style="background-color: #15803d; color: white; padding: 15px 30px;
                        border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
                Subscribe Now & Start Earning →
              </a>
            </div>
          </div>
          <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
            © 2025 SpreadFast. All rights reserved.<br/>
            You are receiving this because you are a registered promoter on SpreadFast.
          </p>
        </div>
      `;
      return sendEmail(promoter.email, subject, html);
    });

    await Promise.allSettled(emailPromises);
    console.log(`Campaign alert sent to ${promoters.length} promoters`);
  } catch (error) {
    console.error('Error sending promoter alerts:', error.message);
  }
};

// ==================== PAYSTACK WEBHOOK ====================
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const secret = paystackConfig.secretKey;
  if (!secret) return res.sendStatus(503);
  const rawBody = req.rawBody || (Buffer.isBuffer(req.body) ? req.body : null);
  const signature = req.headers['x-paystack-signature'];
  if (!rawBody || typeof signature !== 'string' || !/^[a-f0-9]{128}$/i.test(signature)) return res.sendStatus(401);
  const hash = crypto
    .createHmac('sha512', secret)
    .update(rawBody)
    .digest();

  if (!crypto.timingSafeEqual(hash, Buffer.from(signature, 'hex'))) {
    console.log('Webhook signature mismatch - ignoring');
    return res.status(401).send('Invalid signature');
  }

  let event;
  try {
    event = Buffer.isBuffer(req.body) ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(400).send('Invalid JSON');
  }

  console.log('Webhook received:', event.event);

  if (event.event === 'charge.success') {
    const reference = event.data.reference;
    console.log('Payment confirmed via webhook for reference:', reference);

    try {
      const transaction = await DB.PaystackTransaction.findOne({ reference });

      if (transaction?.purpose === QUICK_AD_PAYMENT_PURPOSE) {
        await verifyQuickAdPayment(DB, reference, undefined, paystackConfig);
        return res.sendStatus(200);
      }

      if (transaction && !transaction.campaignCreated) {
        verifyCharge(transaction, event.data);
        let campaignId = 'payment-' + (transaction.id || reference);
        const campaign = {
          id: campaignId,
          title: transaction.campaignName,
          description: transaction.description || '',
          keyMessage: transaction.keyMessage || '',
          budget: transaction.amount.toString(),
          amountPaid: transaction.amount,
          pricing: transaction.pricing,
          companyId: transaction.userId,
          socialMediaPlatforms: transaction.socialMediaPlatforms || [],
          keyMessage: transaction.keyMessage || '',
          status: 'active',
          paystackReference: reference,
          createdAt: new Date().toISOString()
        };

        const savedCampaign = await persistPaidCampaign(campaign);

        Object.assign(campaign, savedCampaign.toObject ? savedCampaign.toObject() : savedCampaign);

        campaignId = campaign.id;
        await DB.PaystackTransaction.updateOne(
          { reference },
          { campaignCreated: true, campaignId, status: 'completed' }
        );

        console.log('Campaign created via webhook:', campaignId);

        const companyUser = await DB.User.findOne({ id: transaction.userId });
        if (companyUser) {
          sendCampaignConfirmationEmail(companyUser.name, companyUser.email, campaign)
            .catch(err => console.error('Webhook campaign confirmation email failed:', err.message));
        }

        sendNewCampaignAlertToPromoters(campaign)
          .catch(err => console.error('Webhook promoter alert emails failed:', err.message));

      } else if (transaction && transaction.campaignCreated) {
        console.log('Campaign already created for this reference, skipping');
      } else {
        console.log('No transaction found for reference:', reference);
      }
    } catch (err) {
      console.error('Payment webhook processing failed', {
        status: Number.isInteger(err.response?.status) ? err.response.status : undefined,
        code: err.quickAdSafe ? err.code : 'UPSTREAM_OR_DATABASE_ERROR'
      });
      return res.sendStatus(503);
    }
  }

  res.sendStatus(200);
});



// ==================== STATIC FILES ====================
app.use('/uploads', express.static(uploadsDir));

// ==================== TEST EMAIL ====================
app.get('/api/test-email', async (req, res) => {
  try {
    await sendEmail(
      process.env.EMAIL_USER || process.env.ADMIN_EMAIL,
      'SpreadFast Email Test',
      '<h1>Email is working! ✅</h1><p>Resend integration is working correctly.</p>'
    );
    res.json({ success: true, message: 'Test email sent! Check your inbox.' });
  } catch (err) {
    console.error('Email test error:', err);
    res.json({ success: false, error: err.message });
  }
});

// ==================== HEALTH CHECK ====================
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Backend is running',
    mongoConnected: isMongoConnected(),
    mode: isMongoConnected() ? 'MongoDB' : 'Local JSON Fallback',
    timestamp: new Date().toISOString()
  });
});

// ==================== AUTH MIDDLEWARE ====================
const { authenticateToken } = require('./middleware/auth');
const quickAdsRoute = require('./routes/quickAds');
app.use('/api/quick-ads', quickAdsRoute);
const { createQuickAdPaymentsRouter } = require('./routes/quickAdPayments');
app.use('/api/quick-ads', createQuickAdPaymentsRouter({ paystackConfig }));

// ==================== AUTH ROUTES ====================
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role, socialMedia } = req.body;
    if (role && !['promoter', 'company'].includes(role)) return res.status(400).json({success: false, message: 'Choose a promoter or business account.'});
    if (typeof email !== 'string' || typeof password !== 'string' || typeof name !== 'string') return res.status(400).json({success: false, message: 'Valid name, email and password required'});
    console.log('Register attempt:', { name, email, role });

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password required' });
    }

    if (process.env.ADMIN_EMAIL && email.trim().toLowerCase() === process.env.ADMIN_EMAIL.trim().toLowerCase()) return res.status(400).json({success: false, message: 'This email is reserved. Please contact support.'});
    const existingUser = await DB.User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      id: uuidv4(),
      name,
      email,
      password: hashedPassword,
      role: role || 'promoter',
      socialMedia: Object.fromEntries(['tiktok','instagram','twitter','facebook','youtube'].map(key => [key, typeof socialMedia?.[key] === 'string' ? socialMedia[key].trim().slice(0, 500) : ''])),
      walletBalance: 0,
      quickAdCredits: 0,
      quickAdsGenerated: 0,
      quickAdFreePreviewUsed: false,
      quickAdTotalCreditsPurchased: 0,
      quickAdTotalCreditsUsed: 0,
      bankDetails: null,
      createdAt: new Date().toISOString()
    };

    await DB.User.create(newUser);
    console.log('User saved:', newUser.id);

    sendWelcomeEmail(newUser.name, newUser.email, newUser.role)
      .catch(err => console.error('Welcome email failed:', err.message));

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Registration successful',
      token,
      user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role, walletBalance: 0 }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Registration failed: ' + error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const user = await DB.User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    if (user.status && user.status !== 'active') return res.status(403).json({success: false, message: 'This account is not active.'});
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, tokenVersion: user.tokenVersion || 0 },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, walletBalance: user.walletBalance }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await DB.User.findOne({ id: req.user.id });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, walletBalance: user.walletBalance }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, message: 'Failed to get user' });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email required' });
    }

    const genericResponse = {
      success: true,
      message: 'If that email is registered, a reset link has been sent.'
    };

    const user = await DB.User.findOne({ email });
    if (!user) {
      // Same response whether or not the user exists — prevents email enumeration
      return res.json(genericResponse);
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await DB.User.updateOne(
      { id: user.id },
      { resetPasswordTokenHash: tokenHash, resetPasswordExpires: expires }
    );

    sendPasswordResetEmail(user.name, user.email, rawToken)
      .catch(err => console.error('Password reset email failed:', err.message));

    res.json(genericResponse);
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Failed to process request' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Token and new password required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await DB.User.findOne({ resetPasswordTokenHash: tokenHash });

    if (!user || !user.resetPasswordExpires || new Date(user.resetPasswordExpires) < new Date()) {
      return res.status(400).json({ success: false, message: 'Reset link is invalid or has expired' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await DB.User.updateOne(
      { id: user.id },
      { password: hashedPassword, resetPasswordTokenHash: null, resetPasswordExpires: null, $inc: {tokenVersion: 1} }
    );

    res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Failed to reset password' });
  }
});

// ==================== PAYSTACK PAYMENT ROUTES ====================
app.post('/api/payments/initiate', authenticateToken, async (req, res) => {
  if (req.user.role !== 'company') return res.status(403).json({success: false, message: 'Business account required'});
  try {
    const { amount, campaignName, description, keyMessage, socialMediaPlatforms } = req.body;

    if (!amount || !campaignName) {
      return res.status(400).json({ success: false, message: 'Amount and campaign name required' });
    }

    let pricing;
    try { pricing = quoteCampaign(amount); } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
    const user = await DB.User.findOne({ id: req.user.id });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const response = await axios.post('https://api.paystack.co/transaction/initialize', {
      email: user.email,
      amount: pricing.grossAmount * 100,
      currency: 'NGN',
      metadata: { campaignName, userId: user.id, userName: user.name }
    }, {
      headers: { Authorization: `Bearer ${paystackConfig.secretKey}` }
    });

    if (response.data.status) {
      await DB.PaystackTransaction.create({
        id: uuidv4(),
        reference: response.data.data.reference,
        userId: user.id,
        email: user.email,
        amount: pricing.grossAmount,
        pricing,
        campaignName,
        description: description || '',
        keyMessage: keyMessage || '',
        socialMediaPlatforms: socialMediaPlatforms || [],
        status: 'pending',
        campaignCreated: false,
        createdAt: new Date().toISOString()
      });

      return res.json({
        success: true,
        message: 'Payment initialized',
        publicKey: paystackConfig.publicKey,
        authorizationUrl: response.data.data.authorization_url,
        reference: response.data.data.reference
      });
    }

    res.status(500).json({ success: false, message: 'Failed to initialize payment' });
  } catch (error) {
    console.error('Payment error:', error);
    res.status(500).json({ success: false, message: 'Payment initialization failed' });
  }
});

app.post('/api/payments/verify', authenticateToken, async (req, res) => {
  try {
    const { reference } = req.body;
    if (!reference) {
      return res.status(400).json({ success: false, message: 'Reference required' });
    }

    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${paystackConfig.secretKey}` }, timeout: 10000 }
    );

    if (response.data.status && response.data.data.status === 'success') {
      const transaction = response.data.data;
      const stored = await DB.PaystackTransaction.findOne({ reference, userId: req.user.id });
      assertCampaignPayment(stored);
      verifyCharge(stored, transaction);
      await DB.PaystackTransaction.updateOne(
        { reference },
        { status: 'completed', verifiedAt: new Date().toISOString() }
      );
      return res.json({
        success: true,
        message: 'Payment verified successfully',
        data: { reference: transaction.reference, amount: transaction.amount / 100, status: transaction.status }
      });
    }

    res.status(400).json({ success: false, message: 'Payment verification failed' });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Verification failed' });
  }
});

app.get('/api/payments/status/:reference', authenticateToken, async (req, res) => {
  try {
    const { reference } = req.params;
    const ownedTransaction = await DB.PaystackTransaction.findOne({ reference, userId: req.user.id });
    if (!ownedTransaction) return res.status(404).json({ success: false, message: 'Transaction not found' });
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${paystackConfig.secretKey}` }, timeout: 10000 }
    );

    if (response.data.status) {
      return res.json({ success: true, status: response.data.data.status, amount: response.data.data.amount / 100 });
    }

    res.status(400).json({ success: false, message: 'Could not get payment status' });
  } catch (error) {
    console.error('Status error:', error);
    res.status(500).json({ success: false, message: 'Failed to get status' });
  }
});

// ==================== CAMPAIGN STATUS POLLING ====================
app.get('/api/payments/campaign-status/:reference', authenticateToken, async (req, res) => {
  try {
    const { reference } = req.params;
    const transaction = await DB.PaystackTransaction.findOne({ reference, userId: req.user.id });

    assertCampaignPayment(transaction);

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    if (transaction.campaignCreated && transaction.campaignId) {
      const campaign = await DB.Campaign.findOne({ id: transaction.campaignId });
      return res.json({ success: true, campaignCreated: true, campaign });
    }

    try {
      const response = await axios.get(
        `https://api.paystack.co/transaction/verify/${reference}`,
        { headers: { Authorization: `Bearer ${paystackConfig.secretKey}` }, timeout: 10000 }
      );

      if (response.data.status && response.data.data.status === 'success') {
        verifyCharge(transaction, response.data.data);
        if (!transaction.campaignCreated) {
          let campaignId = 'payment-' + (transaction.id || reference);
          const campaign = {
            id: campaignId,
            title: transaction.campaignName,
            description: transaction.description || '',
            keyMessage: transaction.keyMessage || '',
            budget: transaction.amount.toString(),
            amountPaid: transaction.amount,
            pricing: transaction.pricing,
            companyId: transaction.userId,
            socialMediaPlatforms: transaction.socialMediaPlatforms || [],
            status: 'active',
            paystackReference: reference,
            createdAt: new Date().toISOString()
          };

          const savedCampaign = await persistPaidCampaign(campaign);

          Object.assign(campaign, savedCampaign.toObject ? savedCampaign.toObject() : savedCampaign);

          campaignId = campaign.id;
          await DB.PaystackTransaction.updateOne(
            { reference },
            { campaignCreated: true, campaignId, status: 'completed' }
          );

          const companyUser = await DB.User.findOne({ id: transaction.userId });
          if (companyUser) {
            sendCampaignConfirmationEmail(companyUser.name, companyUser.email, campaign)
              .catch(err => console.error('Polling campaign confirmation email failed:', err.message));
          }

          sendNewCampaignAlertToPromoters(campaign)
            .catch(err => console.error('Polling promoter alert emails failed:', err.message));

          return res.json({ success: true, campaignCreated: true, campaign });
        }
      }
    } catch (verifyError) {
      console.log('Paystack verify error during polling:', verifyError.message);
    }

    res.json({ success: true, campaignCreated: false, message: 'Payment pending confirmation' });
  } catch (error) {
    console.error('Campaign status error:', error);
    res.status(500).json({ success: false, message: 'Failed to check campaign status' });
  }
});

// ==================== CAMPAIGN ROUTES ====================
app.post('/api/campaigns', authenticateToken, async (req, res) => {
  if (req.user.role !== 'company') return res.status(403).json({success: false, message: 'Business account required'});
  try {
    const { title, description, budget, reference, socialMediaPlatforms, keyMessage } = req.body;

    if (!title || !budget) {
      return res.status(400).json({ success: false, message: 'Title and budget required' });
    }

    if (!reference) return res.status(400).json({success: false, message: 'A verified campaign payment is required.'});
    const transaction = await DB.PaystackTransaction.findOne({reference, userId: req.user.id});
    assertCampaignPayment(transaction);
    if (!transaction) return res.status(404).json({success: false, message: 'Transaction not found'});
    if (Number(budget) !== Number(transaction.amount)) return res.status(400).json({success: false, message: 'Budget must match the paid amount.'});
    if (transaction.campaignCreated) {
      const existingCampaign = await DB.Campaign.findOne({paystackReference: reference});
      if (existingCampaign) return res.status(201).json({success: true, message: 'Campaign already created', campaign: existingCampaign});
      return res.status(410).json({success: false, message: 'This payment has already funded a campaign that was removed.'});
    }
    const response = await axios.get(
      'https://api.paystack.co/transaction/verify/' + reference,
      {headers: {Authorization: 'Bearer ' + paystackConfig.secretKey}, timeout: 10000}
    );
    verifyCharge(transaction, response.data.data);
    const amountPaid = Number(transaction.amount);
    let campaignId = 'payment-' + (transaction.id || reference);
    const campaign = {
      id: campaignId,
      title,
      description: description || '',
      budget: budget.toString(),
      amountPaid,
      pricing: transaction.pricing,
      companyId: req.user.id,
      socialMediaPlatforms: socialMediaPlatforms || [],
      keyMessage: keyMessage || '',
      brandAssets: [],
      status: 'active',
      paystackReference: reference || null,
      createdAt: new Date().toISOString()
    };

    const savedCampaign = await persistPaidCampaign(campaign);

    Object.assign(campaign, savedCampaign.toObject ? savedCampaign.toObject() : savedCampaign);

    campaignId = campaign.id;

    await ActivityLog.create({
      type: 'campaign_created',
      icon: '📢',
      description: `New campaign "${campaign.title}" created`,
      metadata: { campaignId: String(campaign.id) }
    });

    if (reference) {
      await DB.PaystackTransaction.updateOne(
        { reference },
        { campaignCreated: true, campaignId }
      );
    }

    const companyUser = await DB.User.findOne({ id: req.user.id });
    if (companyUser) {
      sendCampaignConfirmationEmail(companyUser.name, companyUser.email, campaign)
        .catch(err => console.error('Campaign confirmation email failed:', err.message));
    }

    sendNewCampaignAlertToPromoters(campaign)
      .catch(err => console.error('Promoter alert emails failed:', err.message));

    res.status(201).json({ success: true, message: 'Campaign created successfully', campaign });
  } catch (error) {
    console.error('Campaign creation error:', error);
    res.status(error.statusCode || 500).json({ success: false, message: 'Failed to create campaign: ' + error.message });
  }
});

// ==================== CAMPAIGN BRAND ASSETS UPLOAD ====================
app.post('/api/campaigns/:campaignId/brand-assets', authenticateToken, upload.array('files', 10), async (req, res) => {
  try {
    const { campaignId } = req.params;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    const campaign = await DB.Campaign.findOne({ id: campaignId });
    if (!campaign) {
      req.files.forEach(file => fs.unlinkSync(file.path));
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    if (campaign.companyId !== req.user.id) {
      req.files.forEach(file => fs.unlinkSync(file.path));
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const uploadedAssets = req.files.map(file => ({
      filename: file.originalname,
      fileUrl: `/uploads/${file.filename}`,
      fileType: file.mimetype,
      fileSize: file.size,
      uploadedAt: new Date().toISOString()
    }));

    const totalAssets = (campaign.brandAssets || []).length + uploadedAssets.length;
    if (totalAssets > 10) {
      req.files.forEach(file => fs.unlinkSync(file.path));
      return res.status(400).json({
        success: false,
        message: `Cannot upload more than 10 files. Current: ${campaign.brandAssets?.length || 0}, Attempting to add: ${uploadedAssets.length}`
      });
    }

    const updatedBrandAssets = [...(campaign.brandAssets || []), ...uploadedAssets];
    await DB.Campaign.updateOne({ id: campaignId }, { brandAssets: updatedBrandAssets });

    res.json({ success: true, message: 'Files uploaded successfully', assets: uploadedAssets });
  } catch (error) {
    console.error('Brand assets upload error:', error);
    if (req.files) {
      req.files.forEach(file => { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); });
    }
    res.status(500).json({ success: false, message: 'Failed to upload files: ' + error.message });
  }
});

// ==================== DELETE CAMPAIGN BRAND ASSET ====================
app.delete('/api/campaigns/:campaignId/brand-assets/:assetIndex', authenticateToken, async (req, res) => {
  try {
    const { campaignId, assetIndex } = req.params;
    const index = parseInt(assetIndex);

    const campaign = await DB.Campaign.findOne({ id: campaignId });
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
    if (campaign.companyId !== req.user.id) return res.status(403).json({ success: false, message: 'Unauthorized' });

    const assets = campaign.brandAssets || [];
    if (index < 0 || index >= assets.length) {
      return res.status(400).json({ success: false, message: 'Invalid asset index' });
    }

    const assetToDelete = assets[index];
    const filePath = path.join(uploadsDir, path.basename(assetToDelete.fileUrl));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    assets.splice(index, 1);
    await DB.Campaign.updateOne({ id: campaignId }, { brandAssets: assets });

    res.json({ success: true, message: 'Asset deleted successfully' });
  } catch (error) {
    console.error('Delete asset error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete asset: ' + error.message });
  }
});

app.get('/api/campaigns', async (req, res) => {
  try {
    const campaigns = await DB.Campaign.find({});
    res.json({ success: true, campaigns });
  } catch (error) {
    console.error('Fetch campaigns error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch campaigns' });
  }
});

app.get('/api/campaigns/company/:companyId', async (req, res) => {
  try {
    const campaigns = await DB.Campaign.find({ companyId: req.params.companyId });
    res.json({ success: true, campaigns });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch campaigns' });
  }
});

app.post('/api/campaigns/:campaignId/submit', authenticateToken, async (req, res) => {
  if (req.user.role !== 'promoter') return res.status(403).json({success: false, message: 'Promoter account required'});
  try {
    const { campaignId } = req.params;
    const { proofUrl, proofDescription, platforms, screenshot } = req.body;

    if (!proofUrl) return res.status(400).json({ success: false, message: 'Proof URL required' });

    const campaign = await DB.Campaign.findOne({ id: campaignId });
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });

    if (hasCurrentPricing(campaign) && !(campaign.subscribedPromoters || []).some(p => p.promoterId === req.user.id)) {
      return res.status(400).json({success: false, message: 'Join the campaign before submitting your post.'});
    }
    const user = await DB.User.findOne({ id: req.user.id });

    const submission = {
      id: uuidv4(),
      campaignId,
      userId: req.user.id,
      userName: user?.name || 'Unknown',
      platforms: platforms || [],
      proof: proofUrl,
      proofUrl,
      proofDescription: proofDescription || 'Social Media Proof',
      screenshot: screenshot || '',
      status: 'pending',
      approvalAmount: 0,
      pricing: campaign.pricing,
      createdAt: new Date().toISOString()
    };

    await DB.Submission.create(submission);
    res.json({ success: true, message: 'Submission received', submission });
  } catch (error) {
    console.error('Submission error:', error);
    res.status(500).json({ success: false, message: 'Submission failed' });
  }
});

app.post('/api/campaigns/:campaignId/subscribe', authenticateToken, async (req, res) => {
  if (req.user.role !== 'promoter') return res.status(403).json({success: false, message: 'Promoter account required'});
  try {
    const { campaignId } = req.params;
    const campaign = await DB.Campaign.findOne({ id: campaignId });

    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });

    if (!campaign.subscribedPromoters) campaign.subscribedPromoters = [];

    if (campaign.subscribedPromoters.find(p => p.promoterId === req.user.id)) {
      return res.status(400).json({ success: false, message: 'Already subscribed to this campaign' });
    }

    if (hasCurrentPricing(campaign) && (campaign.status !== 'active' || campaign.subscribedPromoters.length >= creatorSlots(campaign))) {
      return res.status(400).json({success: false, message: 'No creator slots available.'});
    }
    const promoter = await DB.User.findOne({ id: req.user.id });

    campaign.subscribedPromoters.push({
      promoterId: req.user.id,
      promoterName: promoter?.name || 'Unknown',
      subscribedAt: new Date().toISOString()
    });

    if (hasCurrentPricing(campaign) && isMongoConnected()) {
      const joined = await DB.Campaign.updateOne({id: campaignId, status: 'active',
        'subscribedPromoters.promoterId': {$ne: req.user.id},
        $expr: {$lt: [{$size: {$ifNull: ['$subscribedPromoters', []]}}, creatorSlots(campaign)]}
      }, {$push: {subscribedPromoters: campaign.subscribedPromoters[campaign.subscribedPromoters.length - 1]}});
      if (!joined.modifiedCount) return res.status(400).json({success: false, message: 'Already joined or no creator slots available.'});
    } else if (hasCurrentPricing(campaign)) {
      const campaigns = readJSON('campaigns.json');
      const current = campaigns.find(c => c.id === campaignId);
      if (!current || current.status !== 'active' || (current.subscribedPromoters || []).length >= creatorSlots(current)
          || (current.subscribedPromoters || []).some(p => p.promoterId === req.user.id)) {
        return res.status(400).json({success: false, message: 'Already joined or no creator slots available.'});
      }
      current.subscribedPromoters = [...(current.subscribedPromoters || []), campaign.subscribedPromoters[campaign.subscribedPromoters.length - 1]];
      writeJSON('campaigns.json', campaigns);
    } else {
      await DB.Campaign.updateOne({ id: campaignId }, { subscribedPromoters: campaign.subscribedPromoters });
    }
    res.json({ success: true, message: 'Successfully subscribed to campaign' });
  } catch (error) {
    console.error('Subscription error:', error);
    res.status(500).json({ success: false, message: 'Failed to subscribe to campaign' });
  }
});

app.get('/api/campaigns/:campaignId/submissions', authenticateToken, async (req, res) => {
  try {
    const campaign = await DB.Campaign.findOne({id: req.params.campaignId});
    if (!campaign) return res.status(404).json({success: false, message: 'Campaign not found'});
    if (campaign.companyId !== req.user.id && req.user.email !== process.env.ADMIN_EMAIL) return res.status(403).json({success: false, message: 'Campaign owner access required'});
    const submissions = await DB.Submission.find({ campaignId: req.params.campaignId });
    res.json({ success: true, submissions });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch submissions' });
  }
});

app.get('/api/campaigns/:campaignId', async (req, res) => {
  try {
    const campaign = await DB.Campaign.findOne({ id: req.params.campaignId });
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
    res.json({ success: true, campaign });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch campaign' });
  }
});

// ==================== WALLET ROUTES ====================
app.get('/api/wallet', authenticateToken, async (req, res) => {
  try {
    const user = await DB.User.findOne({ id: req.user.id });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, wallet: { balance: user.walletBalance, bankDetails: user.bankDetails } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get wallet' });
  }
});

app.post('/api/wallet/bank-details', authenticateToken, async (req, res) => {
  try {
    const { accountNumber, bankCode, accountName } = req.body;
    if (!accountNumber || !bankCode || !accountName) {
      return res.status(400).json({ success: false, message: 'Account details required' });
    }
    const bankDetails = { accountNumber, bankCode, accountName, addedAt: new Date().toISOString() };
    await DB.User.updateOne({ id: req.user.id }, { bankDetails });
    res.json({ success: true, message: 'Bank details saved', bankDetails });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to save bank details' });
  }
});

app.put('/api/users/update-bank', authenticateToken, async (req, res) => {
  try {
    const { bankDetails } = req.body;
    if (!bankDetails || !bankDetails.accountNumber || !bankDetails.bankName || !bankDetails.accountName) {
      return res.status(400).json({ success: false, message: 'All bank details are required' });
    }
    const updatedBankDetails = {
      bankName: bankDetails.bankName,
      accountName: bankDetails.accountName,
      accountNumber: bankDetails.accountNumber,
      updatedAt: new Date().toISOString()
    };
    await DB.User.updateOne({ id: req.user.id }, { bankDetails: updatedBankDetails });
    const user = await DB.User.findOne({ id: req.user.id });
    res.json({
      success: true,
      message: 'Bank details updated successfully',
      bankDetails: updatedBankDetails,
      user: { id: user.id, name: user.name, email: user.email, bankDetails: updatedBankDetails }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update bank details' });
  }
});

app.post('/api/wallet/withdraw', authenticateToken, async (req, res) => {
  try {
    const result = await requestWithdrawal(DB, req.user.id, req.body.amount, null, uuidv4());
    res.status(200).json({success: true, message: 'Withdrawal request submitted', ...result});
  } catch (error) { res.status(error.statusCode || 500).json({success: false, message: error.message || 'Withdrawal failed'}); }
});

app.get('/api/wallet/withdrawals/pending', authenticateToken, async (req, res) => {
  try {
    const records = await DB.Withdrawal.find({status: 'pending'});
    const userWithdrawals = records.filter(w => (w.userId || w.promoterId) === req.user.id);
    const pendingAmount = userWithdrawals.reduce((sum, w) => sum + w.amount, 0);
    res.json({ success: true, withdrawals: userWithdrawals, pendingAmount });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch pending withdrawals' });
  }
});

app.post('/api/withdrawals', authenticateToken, async (req, res) => {
  try {
    const result = await requestWithdrawal(DB, req.user.id, req.body.amount, req.body.bankDetails, uuidv4());
    res.status(201).json({success: true, message: 'Withdrawal request submitted', ...result});
  } catch (error) { res.status(error.statusCode || 500).json({success: false, message: error.message || 'Withdrawal failed'}); }
});

// ==================== ADMIN ROUTES ====================
app.get('/api/admin/check', authenticateToken, (req, res) => {
  const isAdmin = req.user.email === process.env.ADMIN_EMAIL;
  res.json({ success: true, isAdmin });
});

app.get('/api/admin/users', authenticateToken, async (req, res) => {
  if (req.user.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  try {
    const users = await DB.User.find({}, { password: 0 });
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
});

app.get('/api/admin/campaigns', authenticateToken, async (req, res) => {
  if (req.user.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  try {
    const campaigns = await DB.Campaign.find({});
    res.json({ success: true, campaigns });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch campaigns' });
  }
});

app.get('/api/admin/submissions', authenticateToken, async (req, res) => {
  if (req.user.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  try {
    const submissions = await DB.Submission.find({});
    const campaigns = await DB.Campaign.find({});
    const enrichedSubmissions = submissions.map(sub => {
      const s = typeof sub.toObject === 'function' ? sub.toObject() : sub;
      return { ...s, campaignName: campaigns.find(c => c.id === s.campaignId)?.title || 'Unknown' };
    });
    res.json({ success: true, submissions: enrichedSubmissions });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch submissions' });
  }
});

app.patch('/api/admin/submissions/:submissionId', authenticateToken, async (req, res) => {
  if (req.user.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  try {
    const { submissionId } = req.params;
    const { status, approvalAmount } = req.body;

    if (!status || !['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Valid status required' });
    }

    const updatedSubmission = await reviewSubmission(DB, submissionId, status, approvalAmount);
    
    if (status === 'approved') {
      await ActivityLog.create({
        type: 'submission_approved',
        icon: '✅',
        description: `Submission approved for campaign "${updatedSubmission.campaignName || ''}"`,
        metadata: { submissionId: String(updatedSubmission._id || updatedSubmission.id) }
      });
    }
    
    res.json({ success: true, message: `Submission ${status}`, submission: updatedSubmission });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Failed to update submission' });
  }
});

app.get('/api/admin/withdrawals', authenticateToken, async (req, res) => {
  if (req.user.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  try {
    const withdrawals = await DB.Withdrawal.find({});
    res.json({ success: true, withdrawals });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch withdrawals' });
  }
});

app.patch('/api/admin/withdrawals/:withdrawalId', authenticateToken, async (req, res) => {
  if (req.user.email !== process.env.ADMIN_EMAIL) return res.status(403).json({success: false, message: 'Admin access required'});
  try {
    const withdrawal = await reviewWithdrawal(DB, req.params.withdrawalId, req.body.status);
    res.json({success: true, message: 'Withdrawal reviewed', withdrawal});
  } catch (error) { res.status(error.statusCode || 500).json({success: false, message: error.message}); }
});

app.post('/api/admin/withdrawals/:withdrawalId/review', authenticateToken, async (req, res) => {
  if (req.user.email !== process.env.ADMIN_EMAIL) return res.status(403).json({success: false, message: 'Admin access required'});
  try {
    const withdrawal = await reviewWithdrawal(DB, req.params.withdrawalId, req.body.status);
    res.json({success: true, message: 'Withdrawal reviewed', withdrawal});
  } catch (error) { res.status(error.statusCode || 500).json({success: false, message: error.message}); }
});

app.delete('/api/admin/campaigns/:campaignId', authenticateToken, async (req, res) => {
  if (req.user.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  try {
    const campaign = await DB.Campaign.findOne({ id: req.params.campaignId });
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
    await DB.Campaign.deleteOne({ id: req.params.campaignId });
    res.json({ success: true, message: 'Campaign deleted successfully', campaign });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete campaign' });
  }
});

app.patch('/api/admin/campaigns/:campaignId', authenticateToken, async (req, res) => {
  if (req.user.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  try {
    const { campaignId } = req.params;
    const { status } = req.body;

    if (!status || !['active', 'paused', 'closed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Valid status required' });
    }

    const campaign = await DB.Campaign.findOne({ id: campaignId });
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });

    await DB.Campaign.updateOne({ id: campaignId }, { status, statusUpdatedAt: new Date().toISOString() });
    const updatedCampaign = await DB.Campaign.findOne({ id: campaignId });
    res.json({ success: true, message: `Campaign status updated to ${status}`, campaign: updatedCampaign });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update campaign' });
  }
});

app.get('/api/admin/all-stats', authenticateToken, async (req, res) => {
  if (req.user.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  try {
    const users = await DB.User.find({});
    const campaigns = await DB.Campaign.find({});
    const submissions = await DB.Submission.find({});
    const withdrawals = await DB.Withdrawal.find({});

    const totalWithdrawalAmount = withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);

    const stats = {
      totalUsers: users.length,
      totalPromoters: users.filter(u => u.role === 'promoter').length,
      totalCompanies: users.filter(u => u.role === 'company').length,
      totalCampaigns: campaigns.length,
      activeCampaigns: campaigns.filter(c => c.status === 'active').length,
      totalSubmissions: submissions.length,
      pendingSubmissions: submissions.filter(s => s.status === 'pending').length,
      approvedSubmissions: submissions.filter(s => s.status === 'approved').length,
      rejectedSubmissions: submissions.filter(s => s.status === 'rejected').length,
      totalWithdrawals: withdrawals.length,
      pendingWithdrawals: withdrawals.filter(w => w.status === 'pending').length,
      completedWithdrawals: withdrawals.filter(w => w.status === 'completed').length,
      totalWithdrawalAmount,
      pendingWithdrawalAmount: withdrawals.filter(w => w.status === 'pending').reduce((sum, w) => sum + w.amount, 0),
      ...feeStats(campaigns, await DB.PaystackTransaction.find({}))
    };

    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
});

app.get('/api/submissions/my-submissions', authenticateToken, async (req, res) => {
  try {
    const submissions = await DB.Submission.find({ userId: req.user.id });
    res.json({ success: true, submissions });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch submissions' });
  }
});

// ==================== CAMPAIGN ASSETS (CLOUDINARY) ====================

// POST /api/campaigns/:campaignId/assets/upload - Company uploads assets
app.post('/api/campaigns/:campaignId/assets/upload', authenticateToken, upload.array('files', 10), async (req, res) => {
  try {
    const { campaignId } = req.params;
    const campaign = await DB.Campaign.findOne({ id: campaignId });

    if (!campaign) {
      if (req.files) req.files.forEach(file => { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); });
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    if (campaign.companyId !== req.user.id) {
      if (req.files) req.files.forEach(file => { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); });
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files provided' });
    }

    // Check max files
    const existingAssets = await DB.CampaignAsset.find({ campaign_id: campaignId, is_active: true });
    if (existingAssets.length + req.files.length > 10) {
      req.files.forEach(file => { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); });
      return res.status(400).json({
        success: false,
        message: `Max 10 files per campaign. Current: ${existingAssets.length}, Attempting: ${req.files.length}`
      });
    }

    const uploadedAssets = [];
    const errors = [];

    for (const [fileIndex, file] of req.files.entries()) {
      try {
        // Determine file type
        let fileType = 'pdf';
        if (file.mimetype.startsWith('image/')) fileType = 'image';
        else if (file.mimetype.startsWith('video/')) fileType = 'video';
        else if (file.mimetype.startsWith('audio/')) fileType = 'audio';

        // Add timestamp to filename to avoid conflicts
        const uniqueName = `${Date.now()}-${file.originalname}`;
        const folderPath = `spreadfast/campaign-assets/${campaignId}`;

        // Upload to Cloudinary
        const uploadResult = await cloudinary.uploader.upload(file.path, {
          folder: folderPath,
          public_id: uniqueName.replace(/\.[^/.]+$/, ''),
          resource_type: fileType === 'video' ? 'video' : fileType === 'audio' ? 'video' : 'auto',
          quality: fileType === 'image' ? 'auto' : undefined,
          fetch_format: fileType === 'image' ? 'auto' : undefined,
          flags: fileType === 'video' ? 'progressive' : undefined
        });

        // Save metadata to DB
        const asset = await DB.CampaignAsset.create({
          campaign_id: campaignId,
          company_id: req.user.id,
          file_name: file.originalname,
          file_type: fileType,
          file_size: Math.round(file.size / 1024),
          cloudinary_public_id: uploadResult.public_id,
          cloudinary_url: uploadResult.secure_url,
          is_active: true
        });

        uploadedAssets.push({
          id: asset._id || asset.id,
          file_name: file.originalname,
          file_type: fileType,
          file_size: Math.round(file.size / 1024),
          uploaded_at: new Date().toISOString()
        });

        // Clean up local file
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      } catch (fileError) {
        errors.push({ file: file.originalname, fileIndex, error: fileError.message });
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      }
    }

    if (uploadedAssets.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'All files failed to upload',
        errors
      });
    }

    res.json({
      success: true,
      message: `${uploadedAssets.length} file(s) uploaded successfully`,
      assets: uploadedAssets,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Asset upload error:', error);
    if (req.files) {
      req.files.forEach(file => { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); });
    }
    res.status(500).json({ success: false, message: 'Upload failed: ' + error.message });
  }
});

// GET /api/campaigns/:campaignId/assets/preview — public, no auth, for campaign cards
app.get('/api/campaigns/:campaignId/assets/preview', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const campaign = await DB.Campaign.findOne({ id: campaignId });
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });

    const assets = await DB.CampaignAsset.find({ campaign_id: campaignId, is_active: true });
    const preview = assets.slice(0, 3).map(a => ({
      id: a._id || a.id,
      file_name: a.file_name,
      file_type: a.file_type,
      url: a.cloudinary_url
    }));

    res.json({ success: true, assets: preview, total: assets.length });
  } catch (error) {
    console.error('Asset preview error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch asset preview' });
  }
});

// GET /api/campaigns/:campaignId/assets - Get asset list
app.get('/api/campaigns/:campaignId/assets', authenticateToken, async (req, res) => {
  try {
    const { campaignId } = req.params;
    const campaign = await DB.Campaign.findOne({ id: campaignId });

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    // If requester is company, show all assets
    // If requester is promoter, check subscription
    let assets = [];

    if (campaign.companyId === req.user.id) {
      // Company - show all assets
      assets = await DB.CampaignAsset.find({ campaign_id: campaignId, is_active: true });
    } else {
      // Check subscribedPromoters array instead (matches how subscribe saves)
        const isSubscribed = campaign.subscribedPromoters?.some(
          p => p.promoterId === req.user.id
        );

        if (!isSubscribed) {
          return res.status(403).json({
            success: false,
            message: 'Subscribe to this campaign to access assets'
          });
        }

      assets = await DB.CampaignAsset.find({ campaign_id: campaignId, is_active: true });
    }

    res.json({
      success: true,
      assets: assets.map(a => ({
        id: a._id || a.id,
        file_name: a.file_name,
        file_type: a.file_type,
        file_size: a.file_size,
        url: a.cloudinary_url,
        download_url: a.cloudinary_url,
        uploaded_at: a.uploaded_at
      }))
    });
  } catch (error) {
    console.error('Get assets error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch assets' });
  }
});

// GET /api/campaigns/:campaignId/assets/:assetId/download - Get signed URL for download
app.get('/api/campaigns/:campaignId/assets/:assetId/download', authenticateToken, async (req, res) => {
  try {
    const { campaignId, assetId } = req.params;
    const campaign = await DB.Campaign.findOne({ id: campaignId });

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    // Find asset by MongoDB _id
    let asset = null;
    try {
      asset = await DB.CampaignAsset.findOne({ _id: assetId, campaign_id: campaignId });
    } catch (e) {
      return res.status(400).json({ success: false, message: 'Invalid asset ID' });
    }

    if (!asset || !asset.is_active) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    // Verify access — company owner or subscribed promoter
    const isOwner = campaign.companyId === req.user.id;
    const isSubscribed = campaign.subscribedPromoters?.some(p => p.promoterId === req.user.id);

    if (!isOwner && !isSubscribed) {
      return res.status(403).json({
        success: false,
        message: 'Subscribe to this campaign to download assets'
      });
    }

    // Generate signed Cloudinary URL valid for 1 hour
    const resourceType = asset.file_type === 'video' ? 'video' : asset.file_type === 'audio' ? 'video' : 'image';
    const signedUrl = cloudinary.url(asset.cloudinary_public_id, {
      sign_url: true,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      resource_type: resourceType,
      flags: 'attachment'
    });

    res.json({
      success: true,
      download_url: signedUrl,
      file_name: asset.file_name,
      file_type: asset.file_type,
      expires_in: 3600
    });
  } catch (error) {
    console.error('Download URL error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate download URL' });
  }
});

// DELETE /api/campaigns/:campaignId/assets/:assetId - Delete asset
app.delete('/api/campaigns/:campaignId/assets/:assetId', authenticateToken, async (req, res) => {
  try {
    const { campaignId, assetId } = req.params;
    const campaign = await DB.Campaign.findOne({ id: campaignId });

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    if (campaign.companyId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const asset = await DB.CampaignAsset.findOne({ _id: assetId, campaign_id: campaignId });
    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(asset.cloudinary_public_id, {
      resource_type: asset.file_type === 'video' ? 'video' : asset.file_type === 'audio' ? 'video' : 'image'
    });

    // Mark as inactive in DB
    await DB.CampaignAsset.updateOne(
      { _id: assetId, campaign_id: campaignId },
      { is_active: false }
    );

    res.json({ success: true, message: 'Asset deleted successfully' });
  } catch (error) {
    console.error('Delete asset error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete asset' });
  }
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📧 Email provider: Resend`);
  console.log(`🔔 Webhook endpoint: POST /api/payments/webhook`);
});
