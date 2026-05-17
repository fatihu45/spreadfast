const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
require('dotenv').config();

// ==================== MONGODB CONNECTION ====================
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};
connectDB();

// ==================== MONGODB MODELS ====================

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['company', 'promoter', 'admin'], default: 'promoter' },
  walletBalance: { type: Number, default: 0 },
  bankDetails: { type: Object, default: null },
  createdAt: { type: String, default: () => new Date().toISOString() }
});
const User = mongoose.model('User', userSchema);

const campaignSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  budget: { type: String, required: true },
  amountPaid: { type: Number, default: 0 },
  companyId: { type: String, required: true },
  socialMediaPlatforms: { type: [String], default: [] },
  status: { type: String, default: 'active' },
  paystackReference: { type: String, default: null },
  subscribedPromoters: { type: Array, default: [] },
  submissions: { type: Array, default: [] },
  statusUpdatedAt: { type: String, default: null },
  createdAt: { type: String, default: () => new Date().toISOString() }
});
const Campaign = mongoose.model('Campaign', campaignSchema);

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
  campaignName: { type: String, required: true },
  description: { type: String, default: '' },
  socialMediaPlatforms: { type: [String], default: [] },
  status: { type: String, default: 'pending' },
  campaignCreated: { type: Boolean, default: false },
  campaignId: { type: String, default: null },
  verifiedAt: { type: String, default: null },
  createdAt: { type: String, default: () => new Date().toISOString() }
});
const PaystackTransaction = mongoose.model('PaystackTransaction', paystackTransactionSchema);

// ==================== NODEMAILER ====================
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 30000
});

const app = express();

// ==================== PAYSTACK WEBHOOK (must be before express.json()) ====================
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const hash = crypto
    .createHmac('sha512', secret)
    .update(req.body)
    .digest('hex');

  if (hash !== req.headers['x-paystack-signature']) {
    console.log('Webhook signature mismatch - ignoring');
    return res.status(401).send('Invalid signature');
  }

  let event;
  try {
    event = JSON.parse(req.body);
  } catch (e) {
    return res.status(400).send('Invalid JSON');
  }

  console.log('Webhook received:', event.event);

  if (event.event === 'charge.success') {
    const reference = event.data.reference;
    console.log('Payment confirmed via webhook for reference:', reference);

    try {
      const transaction = await PaystackTransaction.findOne({ reference });

      if (transaction && !transaction.campaignCreated) {
        const campaignId = uuidv4();
        const campaign = {
          id: campaignId,
          title: transaction.campaignName,
          description: transaction.description || '',
          budget: transaction.amount.toString(),
          amountPaid: transaction.amount,
          companyId: transaction.userId,
          socialMediaPlatforms: transaction.socialMediaPlatforms || [],
          status: 'active',
          paystackReference: reference,
          createdAt: new Date().toISOString()
        };

        await Campaign.create(campaign);

        await PaystackTransaction.updateOne(
          { reference },
          { campaignCreated: true, campaignId, status: 'completed' }
        );

        console.log('Campaign created via webhook:', campaignId);

        const companyUser = await User.findOne({ id: transaction.userId });
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
      console.error('Webhook campaign creation error:', err);
    }
  }

  res.sendStatus(200);
});

// ==================== MIDDLEWARE ====================
app.use(cors({
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', cors());
app.use(express.json());

// ==================== TEST EMAIL ====================
app.get('/api/test-email', async (req, res) => {
  try {
    await transporter.sendMail({
      from: `"SpreadFast" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: 'SpreadFast Email Test',
      html: '<h1>Email is working!</h1>'
    });
    res.json({ success: true, message: 'Email sent! Check your Gmail inbox.' });
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
    timestamp: new Date().toISOString()
  });
});

// ==================== AUTH MIDDLEWARE ====================
const { authenticateToken } = require('./middleware/auth');

// ==================== EMAIL FUNCTIONS ====================
const sendWelcomeEmail = async (name, email, role) => {
  const isCompany = role === 'company';
  const mailOptions = {
    from: `"SpreadFast" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Welcome to SpreadFast! 🎉',
    html: `
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
    `
  };
  await transporter.sendMail(mailOptions);
  console.log('Welcome email sent to:', email);
};

const sendCampaignConfirmationEmail = async (companyName, companyEmail, campaign) => {
  const mailOptions = {
    from: `"SpreadFast" <${process.env.EMAIL_USER}>`,
    to: companyEmail,
    subject: `✅ Your Campaign "${campaign.title}" is Now Live!`,
    html: `
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
    `
  };
  await transporter.sendMail(mailOptions);
  console.log('Campaign confirmation email sent to:', companyEmail);
};

const sendNewCampaignAlertToPromoters = async (campaign) => {
  try {
    const promoters = await User.find({ role: 'promoter' });
    if (promoters.length === 0) {
      console.log('No promoters to notify');
      return;
    }
    const promoterSlots = Math.floor(parseFloat(campaign.budget) / 2000);
    const emailPromises = promoters.map(promoter => {
      const mailOptions = {
        from: `"SpreadFast" <${process.env.EMAIL_USER}>`,
        to: promoter.email,
        subject: `🔔 New Campaign Available: "${campaign.title}" — Earn Money Now!`,
        html: `
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
                  <tr><td style="padding: 8px 0;"><strong>Campaign Budget:</strong></td><td style="color: #15803d;"><strong>₦${parseFloat(campaign.budget).toLocaleString()}</strong></td></tr>
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
        `
      };
      return transporter.sendMail(mailOptions);
    });
    await Promise.allSettled(emailPromises);
    console.log(`Campaign alert sent to ${promoters.length} promoters`);
  } catch (error) {
    console.error('Error sending promoter alerts:', error.message);
  }
};

// ==================== AUTH ROUTES ====================

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    console.log('Register attempt:', { name, email, role });

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    console.log('Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('Password hashed successfully');

    const newUser = {
      id: uuidv4(),
      name,
      email,
      password: hashedPassword,
      role: role || 'promoter',
      walletBalance: 0,
      bankDetails: null,
      createdAt: new Date().toISOString()
    };

    await User.create(newUser);
    console.log('User saved to MongoDB:', newUser.id);

    sendWelcomeEmail(newUser.name, newUser.email, newUser.role)
      .catch(err => console.error('Welcome email failed:', err.message));

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('Registration successful:', newUser.email);
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

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
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
    const user = await User.findOne({ id: req.user.id });
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

// ==================== PAYSTACK PAYMENT ROUTES ====================

app.post('/api/payments/initiate', authenticateToken, async (req, res) => {
  try {
    const { amount, campaignName, description, socialMediaPlatforms } = req.body;

    if (!amount || !campaignName) {
      return res.status(400).json({ success: false, message: 'Amount and campaign name required' });
    }

    const user = await User.findOne({ id: req.user.id });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const response = await axios.post('https://api.paystack.co/transaction/initialize', {
      email: user.email,
      amount: Math.round(amount * 100),
      metadata: { campaignName, userId: user.id, userName: user.name }
    }, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
    });

    if (response.data.status) {
      await PaystackTransaction.create({
        id: uuidv4(),
        reference: response.data.data.reference,
        userId: user.id,
        email: user.email,
        amount,
        campaignName,
        description: description || '',
        socialMediaPlatforms: socialMediaPlatforms || [],
        status: 'pending',
        campaignCreated: false,
        createdAt: new Date().toISOString()
      });

      return res.json({
        success: true,
        message: 'Payment initialized',
        publicKey: process.env.PAYSTACK_PUBLIC_KEY,
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
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }, timeout: 10000 }
    );

    if (response.data.status && response.data.data.status === 'success') {
      const transaction = response.data.data;
      await PaystackTransaction.updateOne(
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
    res.status(500).json({ success: false, message: 'Verification failed' });
  }
});

app.get('/api/payments/status/:reference', authenticateToken, async (req, res) => {
  try {
    const { reference } = req.params;
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }, timeout: 10000 }
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
    const transaction = await PaystackTransaction.findOne({ reference });

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    if (transaction.campaignCreated && transaction.campaignId) {
      const campaign = await Campaign.findOne({ id: transaction.campaignId });
      return res.json({ success: true, campaignCreated: true, campaign });
    }

    try {
      const response = await axios.get(
        `https://api.paystack.co/transaction/verify/${reference}`,
        { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }, timeout: 10000 }
      );

      if (response.data.status && response.data.data.status === 'success') {
        if (!transaction.campaignCreated) {
          const campaignId = uuidv4();
          const campaign = {
            id: campaignId,
            title: transaction.campaignName,
            description: transaction.description || '',
            budget: transaction.amount.toString(),
            amountPaid: transaction.amount,
            companyId: transaction.userId,
            socialMediaPlatforms: transaction.socialMediaPlatforms || [],
            status: 'active',
            paystackReference: reference,
            createdAt: new Date().toISOString()
          };

          await Campaign.create(campaign);
          await PaystackTransaction.updateOne(
            { reference },
            { campaignCreated: true, campaignId, status: 'completed' }
          );

          console.log('Campaign created via polling:', campaignId);

          const companyUser = await User.findOne({ id: transaction.userId });
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
  try {
    const { title, description, budget, reference, socialMediaPlatforms } = req.body;

    console.log('POST /api/campaigns - User:', req.user.id, 'Role:', req.user.role);

    if (!title || !budget) {
      return res.status(400).json({ success: false, message: 'Title and budget required' });
    }

    if (reference) {
      const existingTransaction = await PaystackTransaction.findOne({ reference });
      if (existingTransaction && existingTransaction.campaignCreated) {
        const existingCampaign = await Campaign.findOne({ paystackReference: reference });
        if (existingCampaign) {
          console.log('Campaign already exists for reference:', reference);
          return res.status(201).json({ success: true, message: 'Campaign already created', campaign: existingCampaign });
        }
      }
    }

    let amountPaid = parseFloat(budget);

    if (reference) {
      try {
        const response = await axios.get(
          `https://api.paystack.co/transaction/verify/${reference}`,
          { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }, timeout: 10000 }
        );
        if (!response.data.status || response.data.data.status !== 'success') {
          return res.status(400).json({ success: false, message: 'Payment not verified' });
        }
        amountPaid = response.data.data.amount / 100;
      } catch (paymentError) {
        console.log('Payment verification skipped or failed:', paymentError.message);
      }
    }

    const campaignId = uuidv4();
    const campaign = {
      id: campaignId,
      title,
      description: description || '',
      budget: budget.toString(),
      amountPaid,
      companyId: req.user.id,
      socialMediaPlatforms: socialMediaPlatforms || [],
      status: 'active',
      paystackReference: reference || null,
      createdAt: new Date().toISOString()
    };

    await Campaign.create(campaign);

    if (reference) {
      await PaystackTransaction.updateOne(
        { reference },
        { campaignCreated: true, campaignId }
      );
    }

    console.log('Campaign created:', campaignId);

    const companyUser = await User.findOne({ id: req.user.id });
    if (companyUser) {
      sendCampaignConfirmationEmail(companyUser.name, companyUser.email, campaign)
        .catch(err => console.error('Campaign confirmation email failed:', err.message));
    }

    sendNewCampaignAlertToPromoters(campaign)
      .catch(err => console.error('Promoter alert emails failed:', err.message));

    res.status(201).json({ success: true, message: 'Campaign created successfully', campaign });
  } catch (error) {
    console.error('Campaign creation error:', error);
    res.status(500).json({ success: false, message: 'Failed to create campaign: ' + error.message });
  }
});

app.get('/api/campaigns', async (req, res) => {
  try {
    const campaigns = await Campaign.find({});
    res.json({ success: true, campaigns });
  } catch (error) {
    console.error('Fetch campaigns error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch campaigns' });
  }
});

app.get('/api/campaigns/company/:companyId', async (req, res) => {
  try {
    const campaigns = await Campaign.find({ companyId: req.params.companyId });
    res.json({ success: true, campaigns });
  } catch (error) {
    console.error('Fetch company campaigns error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch campaigns' });
  }
});

app.post('/api/campaigns/:campaignId/submit', authenticateToken, async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { proofUrl, proofDescription, platforms, screenshot } = req.body;

    if (!proofUrl) {
      return res.status(400).json({ success: false, message: 'Proof URL required' });
    }

    const campaign = await Campaign.findOne({ id: campaignId });
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const user = await User.findOne({ id: req.user.id });

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
      createdAt: new Date().toISOString()
    };

    await Submission.create(submission);
    console.log('Submission saved:', submission.id);

    res.json({ success: true, message: 'Submission received', submission });
  } catch (error) {
    console.error('Submission error:', error);
    res.status(500).json({ success: false, message: 'Submission failed' });
  }
});

app.post('/api/campaigns/:campaignId/subscribe', authenticateToken, async (req, res) => {
  try {
    const { campaignId } = req.params;
    const campaign = await Campaign.findOne({ id: campaignId });

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    if (!campaign.subscribedPromoters) {
      campaign.subscribedPromoters = [];
    }

    if (campaign.subscribedPromoters.find(p => p.promoterId === req.user.id)) {
      return res.status(400).json({ success: false, message: 'Already subscribed to this campaign' });
    }

    const promoter = await User.findOne({ id: req.user.id });

    campaign.subscribedPromoters.push({
      promoterId: req.user.id,
      promoterName: promoter?.name || 'Unknown',
      subscribedAt: new Date().toISOString()
    });

    await Campaign.updateOne({ id: campaignId }, { subscribedPromoters: campaign.subscribedPromoters });

    res.json({ success: true, message: 'Successfully subscribed to campaign' });
  } catch (error) {
    console.error('Subscription error:', error);
    res.status(500).json({ success: false, message: 'Failed to subscribe to campaign' });
  }
});

app.get('/api/campaigns/:campaignId/submissions', authenticateToken, async (req, res) => {
  try {
    const { campaignId } = req.params;
    const submissions = await Submission.find({ campaignId });
    res.json({ success: true, submissions });
  } catch (error) {
    console.error('Fetch submissions error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch submissions' });
  }
});

app.get('/api/campaigns/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const campaign = await Campaign.findOne({ id: campaignId });
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }
    res.json({ success: true, campaign });
  } catch (error) {
    console.error('Fetch campaign error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch campaign' });
  }
});

// ==================== WALLET ROUTES ====================

app.get('/api/wallet', authenticateToken, async (req, res) => {
  try {
    const user = await User.findOne({ id: req.user.id });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, wallet: { balance: user.walletBalance, bankDetails: user.bankDetails } });
  } catch (error) {
    console.error('Wallet error:', error);
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
    await User.updateOne({ id: req.user.id }, { bankDetails });

    res.json({ success: true, message: 'Bank details saved', bankDetails });
  } catch (error) {
    console.error('Bank details error:', error);
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

    await User.updateOne({ id: req.user.id }, { bankDetails: updatedBankDetails });
    const user = await User.findOne({ id: req.user.id });

    res.json({
      success: true,
      message: 'Bank details updated successfully',
      bankDetails: updatedBankDetails,
      user: { id: user.id, name: user.name, email: user.email, bankDetails: updatedBankDetails }
    });
  } catch (error) {
    console.error('Update bank details error:', error);
    res.status(500).json({ success: false, message: 'Failed to update bank details' });
  }
});

app.post('/api/wallet/withdraw', authenticateToken, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount required' });
    }

    const user = await User.findOne({ id: req.user.id });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.walletBalance < amount) return res.status(400).json({ success: false, message: 'Insufficient balance' });
    if (!user.bankDetails) return res.status(400).json({ success: false, message: 'Bank details required before withdrawal' });

    const withdrawal = {
      id: uuidv4(),
      userId: user.id,
      userName: user.name,
      email: user.email,
      amount,
      bankDetails: user.bankDetails,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    await Withdrawal.create(withdrawal);
    const newBalance = user.walletBalance - amount;
    await User.updateOne({ id: req.user.id }, { walletBalance: newBalance });

    res.json({ success: true, message: 'Withdrawal request submitted', withdrawal, newBalance });
  } catch (error) {
    console.error('Withdrawal error:', error);
    res.status(500).json({ success: false, message: 'Withdrawal failed' });
  }
});

app.get('/api/wallet/withdrawals/pending', authenticateToken, async (req, res) => {
  try {
    const userWithdrawals = await Withdrawal.find({ userId: req.user.id, status: 'pending' });
    const pendingAmount = userWithdrawals.reduce((sum, w) => sum + w.amount, 0);
    res.json({ success: true, withdrawals: userWithdrawals, pendingAmount });
  } catch (error) {
    console.error('Fetch pending withdrawals error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch pending withdrawals' });
  }
});

app.post('/api/withdrawals', authenticateToken, async (req, res) => {
  try {
    const { amount, bankDetails } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount required' });
    }

    const user = await User.findOne({ id: req.user.id });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const detailsToUse = bankDetails || user.bankDetails;
    if (!detailsToUse) return res.status(400).json({ success: false, message: 'Bank details required for withdrawal' });
    if (user.walletBalance < amount) return res.status(400).json({ success: false, message: 'Insufficient balance' });

    const withdrawal = {
      id: uuidv4(),
      promoterId: user.id,
      promoterName: user.name,
      email: user.email,
      amount,
      bankDetails: detailsToUse,
      status: 'pending',
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    await Withdrawal.create(withdrawal);
    const newBalance = user.walletBalance - amount;
    await User.updateOne({ id: req.user.id }, { walletBalance: newBalance });

    res.status(201).json({ success: true, message: 'Withdrawal request created', withdrawal, newBalance });
  } catch (error) {
    console.error('Withdrawal error:', error);
    res.status(500).json({ success: false, message: 'Withdrawal failed' });
  }
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
    const users = await User.find({}, { password: 0 });
    res.json({ success: true, users });
  } catch (error) {
    console.error('Fetch users error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
});

app.get('/api/admin/campaigns', authenticateToken, async (req, res) => {
  if (req.user.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  try {
    const campaigns = await Campaign.find({});
    res.json({ success: true, campaigns });
  } catch (error) {
    console.error('Fetch campaigns error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch campaigns' });
  }
});

app.get('/api/admin/submissions', authenticateToken, async (req, res) => {
  if (req.user.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  try {
    const submissions = await Submission.find({});
    const campaigns = await Campaign.find({});
    const enrichedSubmissions = submissions.map(sub => ({
      ...sub.toObject(),
      campaignName: campaigns.find(c => c.id === sub.campaignId)?.title || 'Unknown'
    }));
    res.json({ success: true, submissions: enrichedSubmissions });
  } catch (error) {
    console.error('Fetch submissions error:', error);
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

    const submission = await Submission.findOne({ id: submissionId });
    if (!submission) return res.status(404).json({ success: false, message: 'Submission not found' });

    const updateData = { status, reviewedAt: new Date().toISOString() };

    if (status === 'approved' && approvalAmount) {
      updateData.approvalAmount = approvalAmount;
      const user = await User.findOne({ id: submission.userId });
      if (user) {
        await User.updateOne({ id: submission.userId }, { walletBalance: user.walletBalance + approvalAmount });
      }
    }

    await Submission.updateOne({ id: submissionId }, updateData);
    const updatedSubmission = await Submission.findOne({ id: submissionId });

    res.json({ success: true, message: `Submission ${status}`, submission: updatedSubmission });
  } catch (error) {
    console.error('Update submission error:', error);
    res.status(500).json({ success: false, message: 'Failed to update submission' });
  }
});

app.get('/api/admin/withdrawals', authenticateToken, async (req, res) => {
  if (req.user.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  try {
    const withdrawals = await Withdrawal.find({});
    res.json({ success: true, withdrawals });
  } catch (error) {
    console.error('Fetch withdrawals error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch withdrawals' });
  }
});

app.patch('/api/admin/withdrawals/:withdrawalId', authenticateToken, async (req, res) => {
  if (req.user.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  try {
    const { withdrawalId } = req.params;
    const { status } = req.body;

    if (!status || !['completed', 'pending', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Valid status required' });
    }

    const withdrawal = await Withdrawal.findOne({ id: withdrawalId });
    if (!withdrawal) return res.status(404).json({ success: false, message: 'Withdrawal not found' });

    const oldStatus = withdrawal.status;
    await Withdrawal.updateOne({ id: withdrawalId }, { status, reviewedAt: new Date().toISOString() });

    if (status === 'rejected' && oldStatus === 'pending') {
      const userId = withdrawal.userId || withdrawal.promoterId;
      const user = await User.findOne({ id: userId });
      if (user) {
        await User.updateOne({ id: userId }, { walletBalance: user.walletBalance + withdrawal.amount });
      }
    }

    const updatedWithdrawal = await Withdrawal.findOne({ id: withdrawalId });
    res.json({ success: true, message: `Withdrawal marked as ${status}`, withdrawal: updatedWithdrawal });
  } catch (error) {
    console.error('Withdrawal update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update withdrawal' });
  }
});

app.post('/api/admin/withdrawals/:withdrawalId/review', authenticateToken, async (req, res) => {
  if (req.user.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  try {
    const { withdrawalId } = req.params;
    const { status } = req.body;

    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Valid status required' });
    }

    const withdrawal = await Withdrawal.findOne({ id: withdrawalId });
    if (!withdrawal) return res.status(404).json({ success: false, message: 'Withdrawal not found' });

    await Withdrawal.updateOne({ id: withdrawalId }, { status, reviewedAt: new Date().toISOString() });

    if (status === 'rejected') {
      const user = await User.findOne({ id: withdrawal.userId });
      if (user) {
        await User.updateOne({ id: withdrawal.userId }, { walletBalance: user.walletBalance + withdrawal.amount });
      }
    }

    res.json({ success: true, message: `Withdrawal ${status}` });
  } catch (error) {
    console.error('Withdrawal review error:', error);
    res.status(500).json({ success: false, message: 'Failed to review withdrawal' });
  }
});

app.delete('/api/admin/campaigns/:campaignId', authenticateToken, async (req, res) => {
  if (req.user.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  try {
    const { campaignId } = req.params;
    const campaign = await Campaign.findOne({ id: campaignId });
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });

    await Campaign.deleteOne({ id: campaignId });
    res.json({ success: true, message: 'Campaign deleted successfully', campaign });
  } catch (error) {
    console.error('Campaign deletion error:', error);
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

    const campaign = await Campaign.findOne({ id: campaignId });
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });

    await Campaign.updateOne({ id: campaignId }, { status, statusUpdatedAt: new Date().toISOString() });
    const updatedCampaign = await Campaign.findOne({ id: campaignId });

    res.json({ success: true, message: `Campaign status updated to ${status}`, campaign: updatedCampaign });
  } catch (error) {
    console.error('Campaign update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update campaign' });
  }
});

app.get('/api/admin/all-stats', authenticateToken, async (req, res) => {
  if (req.user.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  try {
    const users = await User.find({});
    const campaigns = await Campaign.find({});
    const submissions = await Submission.find({});
    const withdrawals = await Withdrawal.find({});

    const totalCampaignBudget = campaigns.reduce((sum, c) => sum + (parseFloat(c.budget) || 0), 0);
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
      totalCampaignFees: totalCampaignBudget * 0.05,
      totalWithdrawalFees: totalWithdrawalAmount * 0.05
    };

    res.json({ success: true, stats });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
});

// ==================== SUBMISSIONS ====================
app.get('/api/submissions/my-submissions', authenticateToken, async (req, res) => {
  try {
    const submissions = await Submission.find({ userId: req.user.id });
    res.json({ success: true, submissions });
  } catch (error) {
    console.error('Fetch submissions error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch submissions' });
  }
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`💳 Paystack Sandbox Mode: Testing payments with test keys`);
  console.log(`🔔 Webhook endpoint: POST /api/payments/webhook`);
});
