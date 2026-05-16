# 🔐 SpreadFast Authentication & Payment Integration Guide

## Overview

This guide will help you add:
1. **User Authentication** - Login/signup with email & password
2. **Payment Integration** - Stripe for campaign payments
3. **Admin Security** - Only you can access admin dashboard
4. **Wallet System** - Promoters can withdraw earnings

---

# PART 1: USER AUTHENTICATION

## Step 1: Install Authentication Dependencies

### Backend Dependencies

```bash
cd server
npm install bcryptjs jsonwebtoken dotenv cors
```

**What each does:**
- `bcryptjs` - Hash passwords securely
- `jsonwebtoken` - Create login tokens
- `dotenv` - Read environment variables
- `cors` - Enable CORS for frontend

---

## Step 2: Create Environment File

Create `server/.env`:

```
PORT=5000
NODE_ENV=development
JWT_SECRET=your-super-secret-key-change-this-in-production
CORS_ORIGIN=http://localhost:3000
STRIPE_SECRET_KEY=sk_test_your_stripe_key
STRIPE_PUBLIC_KEY=pk_test_your_stripe_key
ADMIN_EMAIL=your-email@example.com
```

---

## Step 3: Update Backend Structure

Create new folders:

```bash
mkdir server/models
mkdir server/routes
mkdir server/middleware
```

### New File: `server/models/User.js`

```javascript
const { v4: uuidv4 } = require('uuid');

class User {
  static create(name, email, password, role = 'promoter') {
    return {
      id: uuidv4(),
      name,
      email,
      password, // Will be hashed
      role, // 'company' or 'promoter' or 'admin'
      walletBalance: 0,
      bankDetails: null,
      createdAt: new Date().toISOString()
    };
  }
}

module.exports = User;
```

### New File: `server/middleware/auth.js`

```javascript
const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access token required' 
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ 
        success: false, 
        message: 'Invalid or expired token' 
      });
    }
    
    req.user = user;
    next();
  });
}

function adminOnly(req, res, next) {
  if (req.user.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ 
      success: false, 
      message: 'Admin access only' 
    });
  }
  next();
}

module.exports = { authenticateToken, adminOnly };
```

---

## Step 4: Update Server.js with Auth Routes

Replace your `server/server.js` with this updated version:

```javascript
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(bodyParser.json());

// Helper functions
const DATA_DIR = path.join(__dirname, 'data');

function readFile(filepath) {
  if (!fs.existsSync(filepath)) {
    fs.writeFileSync(filepath, JSON.stringify([]));
  }
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

function writeFile(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

// Auth Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access token required' 
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ 
        success: false, 
        message: 'Invalid token' 
      });
    }
    req.user = user;
    next();
  });
}

function adminOnly(req, res, next) {
  if (req.user.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ 
      success: false, 
      message: 'Admin only access' 
    });
  }
  next();
}

// ==================== AUTH ROUTES ====================

// REGISTER
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields required' 
      });
    }

    const users = readFile(path.join(DATA_DIR, 'users.json'));
    
    // Check if email exists
    if (users.find(u => u.email === email)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already registered' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      id: uuidv4(),
      name,
      email,
      password: hashedPassword,
      role, // 'company' or 'promoter'
      walletBalance: 0,
      bankDetails: null,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    writeFile(path.join(DATA_DIR, 'users.json'), users);

    // Create token
    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Registration successful',
      token,
      user: { id: newUser.id, name, email, role }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// LOGIN
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and password required' 
      });
    }

    const users = readFile(path.join(DATA_DIR, 'users.json'));
    const user = users.find(u => u.email === email);

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }

    // Compare passwords
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }

    // Create token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== CAMPAIGN ROUTES ====================

// GET all campaigns
app.get('/api/campaigns', (req, res) => {
  try {
    const campaigns = readFile(path.join(DATA_DIR, 'campaigns.json'));
    res.json({ success: true, data: campaigns });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// CREATE campaign (requires auth + payment)
app.post('/api/campaigns', authenticateToken, async (req, res) => {
  try {
    const { name, description, image, caption, platform, budget, duration, paymentIntentId } = req.body;

    if (!name || !description || !caption || !platform || !budget || !duration || !paymentIntentId) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields required' 
      });
    }

    // Verify payment was successful
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ 
        success: false, 
        message: 'Payment not confirmed. Please try again.' 
      });
    }

    const campaigns = readFile(path.join(DATA_DIR, 'campaigns.json'));

    const newCampaign = {
      id: uuidv4(),
      name,
      description,
      image: image || 'https://via.placeholder.com/300x200?text=Campaign+Image',
      caption,
      platform,
      budget: parseFloat(budget),
      duration,
      createdBy: req.user.id,
      createdByEmail: req.user.email,
      status: 'active',
      paymentIntentId,
      createdAt: new Date().toISOString()
    };

    campaigns.push(newCampaign);
    writeFile(path.join(DATA_DIR, 'campaigns.json'), campaigns);

    res.json({
      success: true,
      message: 'Campaign created successfully',
      data: newCampaign
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== PAYMENT ROUTES ====================

// CREATE payment intent
app.post('/api/payments/create-intent', authenticateToken, async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid amount required' 
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        userId: req.user.id,
        email: req.user.email
      }
    });

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== SUBMISSION ROUTES ====================

// GET submissions (companies + admin)
app.get('/api/submissions', authenticateToken, (req, res) => {
  try {
    let submissions = readFile(path.join(DATA_DIR, 'submissions.json'));
    
    // Non-admin users only see their own submissions
    if (req.user.email !== process.env.ADMIN_EMAIL) {
      submissions = submissions.filter(s => s.userId === req.user.id || s.campaignCreatedBy === req.user.id);
    }

    res.json({ success: true, data: submissions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// CREATE submission
app.post('/api/submissions', authenticateToken, (req, res) => {
  try {
    const { campaignId, userName, platform, screenshot, postLink } = req.body;

    if (!campaignId || !userName || !platform || !postLink) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields required' 
      });
    }

    const submissions = readFile(path.join(DATA_DIR, 'submissions.json'));
    const campaigns = readFile(path.join(DATA_DIR, 'campaigns.json'));
    const campaign = campaigns.find(c => c.id === campaignId);

    if (!campaign) {
      return res.status(404).json({ 
        success: false, 
        message: 'Campaign not found' 
      });
    }

    const newSubmission = {
      id: uuidv4(),
      campaignId,
      campaignName: campaign.name,
      campaignCreatedBy: campaign.createdBy,
      userId: req.user.id,
      userName,
      platform,
      screenshot: screenshot || '',
      postLink,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    submissions.push(newSubmission);
    writeFile(path.join(DATA_DIR, 'submissions.json'), submissions);

    res.json({
      success: true,
      message: 'Submission created successfully',
      data: newSubmission
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// APPROVE/REJECT submission (admin only)
app.patch('/api/submissions/:id', authenticateToken, adminOnly, (req, res) => {
  try {
    const { status } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid status' 
      });
    }

    const submissions = readFile(path.join(DATA_DIR, 'submissions.json'));
    const submission = submissions.find(s => s.id === req.params.id);

    if (!submission) {
      return res.status(404).json({ 
        success: false, 
        message: 'Submission not found' 
      });
    }

    submission.status = status;
    submission.approvedAt = new Date().toISOString();

    // If approved, add to promoter wallet
    if (status === 'approved') {
      const campaigns = readFile(path.join(DATA_DIR, 'campaigns.json'));
      const campaign = campaigns.find(c => c.id === submission.campaignId);
      const users = readFile(path.join(DATA_DIR, 'users.json'));
      const user = users.find(u => u.id === submission.userId);

      if (campaign && user) {
        const paymentPerSubmission = campaign.budget / 100; // Award 1% of budget per approved submission
        user.walletBalance += paymentPerSubmission;
        writeFile(path.join(DATA_DIR, 'users.json'), users);
      }
    }

    writeFile(path.join(DATA_DIR, 'submissions.json'), submissions);

    res.json({
      success: true,
      message: `Submission ${status}`,
      data: submission
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== WALLET ROUTES ====================

// GET user wallet
app.get('/api/wallet', authenticateToken, (req, res) => {
  try {
    const users = readFile(path.join(DATA_DIR, 'users.json'));
    const user = users.find(u => u.id === req.user.id);

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    res.json({
      success: true,
      walletBalance: user.walletBalance,
      bankDetails: user.bankDetails
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// UPDATE bank details
app.post('/api/wallet/bank-details', authenticateToken, (req, res) => {
  try {
    const { accountNumber, routingNumber, accountHolderName } = req.body;

    if (!accountNumber || !routingNumber || !accountHolderName) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields required' 
      });
    }

    const users = readFile(path.join(DATA_DIR, 'users.json'));
    const user = users.find(u => u.id === req.user.id);

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    user.bankDetails = {
      accountNumber,
      routingNumber,
      accountHolderName,
      updatedAt: new Date().toISOString()
    };

    writeFile(path.join(DATA_DIR, 'users.json'), users);

    res.json({
      success: true,
      message: 'Bank details updated',
      bankDetails: user.bankDetails
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// REQUEST withdrawal
app.post('/api/wallet/withdraw', authenticateToken, (req, res) => {
  try {
    const { amount } = req.body;

    const users = readFile(path.join(DATA_DIR, 'users.json'));
    const user = users.find(u => u.id === req.user.id);

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    if (amount > user.walletBalance) {
      return res.status(400).json({ 
        success: false, 
        message: 'Insufficient balance' 
      });
    }

    if (!user.bankDetails) {
      return res.status(400).json({ 
        success: false, 
        message: 'Bank details not set' 
      });
    }

    // Create withdrawal request
    const withdrawals = readFile(path.join(DATA_DIR, 'withdrawals.json'));
    
    const newWithdrawal = {
      id: uuidv4(),
      userId: req.user.id,
      userName: user.name,
      amount,
      bankDetails: user.bankDetails,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    withdrawals.push(newWithdrawal);
    writeFile(path.join(DATA_DIR, 'withdrawals.json'), withdrawals);

    // Deduct from wallet
    user.walletBalance -= amount;
    writeFile(path.join(DATA_DIR, 'users.json'), users);

    res.json({
      success: true,
      message: 'Withdrawal request submitted',
      data: newWithdrawal
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== ADMIN ROUTES ====================

// GET all data (admin only)
app.get('/api/admin/data', authenticateToken, adminOnly, (req, res) => {
  try {
    const campaigns = readFile(path.join(DATA_DIR, 'campaigns.json'));
    const users = readFile(path.join(DATA_DIR, 'users.json'));
    const submissions = readFile(path.join(DATA_DIR, 'submissions.json'));
    const withdrawals = readFile(path.join(DATA_DIR, 'withdrawals.json'));

    res.json({
      success: true,
      data: { campaigns, users, submissions, withdrawals }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// APPROVE withdrawal (admin only)
app.patch('/api/admin/withdrawals/:id', authenticateToken, adminOnly, (req, res) => {
  try {
    const { status } = req.body;

    const withdrawals = readFile(path.join(DATA_DIR, 'withdrawals.json'));
    const withdrawal = withdrawals.find(w => w.id === req.params.id);

    if (!withdrawal) {
      return res.status(404).json({ 
        success: false, 
        message: 'Withdrawal not found' 
      });
    }

    withdrawal.status = status;
    withdrawal.processedAt = new Date().toISOString();

    writeFile(path.join(DATA_DIR, 'withdrawals.json'), withdrawals);

    res.json({
      success: true,
      message: `Withdrawal ${status}`,
      data: withdrawal
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// HEALTH CHECK
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

// Initialize data files
function initializeDataFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
  }

  const files = [
    'users.json',
    'campaigns.json',
    'submissions.json',
    'withdrawals.json'
  ];

  files.forEach(file => {
    const filepath = path.join(DATA_DIR, file);
    if (!fs.existsSync(filepath)) {
      fs.writeFileSync(filepath, JSON.stringify([]));
    }
  });
}

initializeDataFiles();

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
```

---

# PART 2: FRONTEND AUTHENTICATION

## Step 5: Install Frontend Dependencies

```bash
cd client
npm install axios react-stripe-js @stripe/react-stripe-js @stripe/js
```

---

## Step 6: Create Auth Context

Create `client/src/context/AuthContext.js`:

```javascript
import React, { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) {
      // Verify token is still valid
      localStorage.setItem('token', token);
    }
  }, [token]);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (data.success) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('token', data.token);
        return { success: true, user: data.user };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      return { success: false, message: error.message };
    } finally {
      setLoading(false);
    }
  };

  const register = async (name, email, password, role) => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role })
      });

      const data = await response.json();

      if (data.success) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('token', data.token);
        return { success: true, user: data.user };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      return { success: false, message: error.message };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
```

---

## Step 7: Create Login/Register Pages

Create `client/src/pages/Login.jsx`:

```javascript
import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const { login, loading } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    const result = await login(email, password);

    if (result.success) {
      setMessageType('success');
      setMessage('✅ Login successful! Redirecting...');
      setTimeout(() => navigate('/dashboard'), 2000);
    } else {
      setMessageType('error');
      setMessage(`❌ ${result.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center text-green-700 mb-2">SpreadFast</h1>
        <p className="text-center text-gray-600 mb-8">Login to your account</p>

        {message && (
          <div className={`p-4 rounded-lg mb-4 ${
            messageType === 'success' 
              ? 'bg-green-100 text-green-700' 
              : 'bg-red-100 text-red-700'
          }`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white font-medium py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p className="text-center text-gray-600 mt-6">
          Don't have an account? <Link to="/register" className="text-green-600 hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
```

Create `client/src/pages/Register.jsx`:

```javascript
import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function Register() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'promoter'
  });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const { register, loading } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      setMessageType('error');
      setMessage('❌ Passwords do not match');
      return;
    }

    const result = await register(
      formData.name,
      formData.email,
      formData.password,
      formData.role
    );

    if (result.success) {
      setMessageType('success');
      setMessage('✅ Registration successful! Redirecting...');
      setTimeout(() => navigate('/dashboard'), 2000);
    } else {
      setMessageType('error');
      setMessage(`❌ ${result.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center text-green-700 mb-2">SpreadFast</h1>
        <p className="text-center text-gray-600 mb-8">Create your account</p>

        {message && (
          <div className={`p-4 rounded-lg mb-4 ${
            messageType === 'success' 
              ? 'bg-green-100 text-green-700' 
              : 'bg-red-100 text-red-700'
          }`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="promoter">Promoter (Earn money)</option>
              <option value="company">Company (Create campaigns)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white font-medium py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <p className="text-center text-gray-600 mt-6">
          Already have an account? <Link to="/login" className="text-green-600 hover:underline">Login</Link>
        </p>
      </div>
    </div>
  );
}
```

---

## Step 8: Update CompanyDashboard with Stripe Payment

Create `client/src/pages/CompanyDashboard.jsx` (updated):

```javascript
import React, { useState, useContext } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { AuthContext } from '../context/AuthContext';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY);

function PaymentForm({ amount, onPaymentSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const { token } = useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setProcessing(true);
    setError('');

    try {
      // Create payment intent on backend
      const intentResponse = await fetch('http://localhost:5000/api/payments/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ amount })
      });

      const { clientSecret, paymentIntentId } = await intentResponse.json();

      // Confirm payment
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement)
        }
      });

      if (result.error) {
        setError(result.error.message);
      } else if (result.paymentIntent.status === 'succeeded') {
        onPaymentSuccess(paymentIntentId);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <CardElement className="p-3 border border-gray-300 rounded-lg" />
      {error && <div className="text-red-600">{error}</div>}
      <button
        type="submit"
        disabled={processing || !stripe}
        className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
      >
        {processing ? 'Processing...' : `Pay $${amount}`}
      </button>
    </form>
  );
}

export default function CompanyDashboard() {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image: '',
    caption: '',
    platform: 'Instagram',
    budget: '',
    duration: '7 days'
  });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const { token, user } = useContext(AuthContext);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handlePaymentSuccess = async (paymentIntentId) => {
    try {
      const response = await fetch('http://localhost:5000/api/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          paymentIntentId
        })
      });

      const data = await response.json();

      if (data.success) {
        setMessageType('success');
        setMessage('✅ Campaign created successfully!');
        setFormData({
          name: '',
          description: '',
          image: '',
          caption: '',
          platform: 'Instagram',
          budget: '',
          duration: '7 days'
        });
        setShowPayment(false);
      } else {
        setMessageType('error');
        setMessage(`❌ ${data.message}`);
      }
    } catch (error) {
      setMessageType('error');
      setMessage(`❌ ${error.message}`);
    }
  };

  if (!user) {
    return <div className="p-8 text-center">Please log in first</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-green-700 mb-8">Create Campaign</h1>

        {message && (
          <div className={`p-4 rounded-lg mb-4 ${
            messageType === 'success' 
              ? 'bg-green-100 text-green-700' 
              : 'bg-red-100 text-red-700'
          }`}>
            {message}
          </div>
        )}

        {!showPayment ? (
          <form className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                rows="4"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
              <input
                type="url"
                name="image"
                value={formData.image}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Post Caption</label>
              <input
                type="text"
                name="caption"
                value={formData.caption}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
              <select
                name="platform"
                value={formData.platform}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              >
                <option>Instagram</option>
                <option>TikTok</option>
                <option>X (Twitter)</option>
                <option>Facebook</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Budget ($)</label>
              <input
                type="number"
                name="budget"
                value={formData.budget}
                onChange={handleChange}
                required
                min="1"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
              <select
                name="duration"
                value={formData.duration}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              >
                <option>1 day</option>
                <option>3 days</option>
                <option>7 days</option>
                <option>14 days</option>
                <option>30 days</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => setShowPayment(true)}
              className="w-full bg-green-600 text-white font-medium py-2 rounded-lg hover:bg-green-700"
            >
              Proceed to Payment
            </button>
          </form>
        ) : (
          <div>
            <h2 className="text-xl font-bold mb-4">Payment Details</h2>
            <p className="text-gray-600 mb-4">Complete your payment of ${formData.budget} to create this campaign.</p>
            <Elements stripe={stripePromise}>
              <PaymentForm
                amount={parseFloat(formData.budget)}
                onPaymentSuccess={handlePaymentSuccess}
              />
            </Elements>
            <button
              onClick={() => setShowPayment(false)}
              className="mt-4 text-gray-600 hover:text-gray-900"
            >
              ← Back to form
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

# PART 3: ADMIN SECURITY & DASHBOARD

## Step 9: Secure Admin Page

Update `client/src/pages/AdminDashboard.jsx`:

```javascript
import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function AdminDashboard() {
  const { user, token } = useContext(AuthContext);
  const navigate = useNavigate();
  const [admin, setAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState('submissions');
  const [data, setData] = useState({ submissions: [], campaigns: [], withdrawals: [] });

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    // Check if user is admin
    if (user.email !== process.env.REACT_APP_ADMIN_EMAIL) {
      navigate('/');
      return;
    }

    setAdmin(true);
    fetchData();
  }, [user, navigate]);

  const fetchData = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/admin/data', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleApproveSubmission = async (submissionId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/submissions/${submissionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'approved' })
      });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleRejectSubmission = async (submissionId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/submissions/${submissionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'rejected' })
      });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleApproveWithdrawal = async (withdrawalId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/admin/withdrawals/${withdrawalId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'completed' })
      });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  if (!admin) {
    return <div className="p-8 text-center">Access Denied - Admin only</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-green-700 mb-8">Admin Dashboard</h1>

        <div className="flex gap-4 mb-8 border-b">
          <button
            onClick={() => setActiveTab('submissions')}
            className={`px-6 py-2 font-medium ${
              activeTab === 'submissions'
                ? 'border-b-2 border-green-600 text-green-600'
                : 'text-gray-600'
            }`}
          >
            Submissions ({data.submissions.length})
          </button>
          <button
            onClick={() => setActiveTab('campaigns')}
            className={`px-6 py-2 font-medium ${
              activeTab === 'campaigns'
                ? 'border-b-2 border-green-600 text-green-600'
                : 'text-gray-600'
            }`}
          >
            Campaigns ({data.campaigns.length})
          </button>
          <button
            onClick={() => setActiveTab('withdrawals')}
            className={`px-6 py-2 font-medium ${
              activeTab === 'withdrawals'
                ? 'border-b-2 border-green-600 text-green-600'
                : 'text-gray-600'
            }`}
          >
            Withdrawals ({data.withdrawals.length})
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-2 font-medium ${
              activeTab === 'users'
                ? 'border-b-2 border-green-600 text-green-600'
                : 'text-gray-600'
            }`}
          >
            Users ({data.users.length})
          </button>
        </div>

        {activeTab === 'submissions' && (
          <div className="space-y-4">
            {data.submissions.map(submission => (
              <div key={submission.id} className="bg-white p-6 rounded-lg shadow">
                <h3 className="font-bold text-lg">{submission.campaignName}</h3>
                <p className="text-gray-600">Promoter: {submission.userName}</p>
                <p className="text-gray-600">Status: <span className={`font-bold ${
                  submission.status === 'approved' ? 'text-green-600' :
                  submission.status === 'rejected' ? 'text-red-600' :
                  'text-yellow-600'
                }`}>{submission.status.toUpperCase()}</span></p>
                <a href={submission.postLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  View Post
                </a>

                {submission.status === 'pending' && (
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => handleApproveSubmission(submission.id)}
                      className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                    >
                      ✅ Approve
                    </button>
                    <button
                      onClick={() => handleRejectSubmission(submission.id)}
                      className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                    >
                      ❌ Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'withdrawals' && (
          <div className="space-y-4">
            {data.withdrawals.map(withdrawal => (
              <div key={withdrawal.id} className="bg-white p-6 rounded-lg shadow">
                <h3 className="font-bold text-lg">{withdrawal.userName}</h3>
                <p className="text-gray-600">Amount: ${withdrawal.amount}</p>
                <p className="text-gray-600">Status: <span className={`font-bold ${
                  withdrawal.status === 'completed' ? 'text-green-600' :
                  withdrawal.status === 'pending' ? 'text-yellow-600' :
                  'text-red-600'
                }`}>{withdrawal.status.toUpperCase()}</span></p>
                <p className="text-gray-600">Account: {withdrawal.bankDetails.accountNumber}</p>

                {withdrawal.status === 'pending' && (
                  <button
                    onClick={() => handleApproveWithdrawal(withdrawal.id)}
                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 mt-4"
                  >
                    ✅ Approve Withdrawal
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'campaigns' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.campaigns.map(campaign => (
              <div key={campaign.id} className="bg-white p-6 rounded-lg shadow">
                {campaign.image && <img src={campaign.image} alt={campaign.name} className="w-full h-40 object-cover rounded mb-4" />}
                <h3 className="font-bold text-lg">{campaign.name}</h3>
                <p className="text-gray-600">Budget: ${campaign.budget}</p>
                <p className="text-gray-600">Platform: {campaign.platform}</p>
                <p className="text-gray-600">Status: {campaign.status}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-4">
            {data.users.map(userItem => (
              <div key={userItem.id} className="bg-white p-6 rounded-lg shadow">
                <h3 className="font-bold text-lg">{userItem.name}</h3>
                <p className="text-gray-600">Email: {userItem.email}</p>
                <p className="text-gray-600">Role: {userItem.role}</p>
                <p className="text-gray-600">Wallet: ${userItem.walletBalance}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## Step 10: Update App.jsx with Routes

```javascript
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import CompanyDashboard from './pages/CompanyDashboard';
import PromoteSignup from './pages/PromoteSignup';
import Campaigns from './pages/Campaigns';
import SubmitProof from './pages/SubmitProof';
import AdminDashboard from './pages/AdminDashboard';
import Wallet from './pages/Wallet';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Navbar />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/company" element={<CompanyDashboard />} />
          <Route path="/signup" element={<PromoteSignup />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/submit" element={<SubmitProof />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/wallet" element={<Wallet />} />
        </Routes>
        <Footer />
      </AuthProvider>
    </Router>
  );
}

export default App;
```

---

## Step 11: Create Wallet Page

Create `client/src/pages/Wallet.jsx`:

```javascript
import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Wallet() {
  const { user, token } = useContext(AuthContext);
  const navigate = useNavigate();
  const [wallet, setWallet] = useState(null);
  const [bankDetails, setBankDetails] = useState({
    accountNumber: '',
    routingNumber: '',
    accountHolderName: ''
  });
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  useEffect(() => {
    if (!user) navigate('/login');
    else fetchWallet();
  }, [user, navigate]);

  const fetchWallet = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/wallet', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        setWallet(data);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleSaveBankDetails = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch('http://localhost:5000/api/wallet/bank-details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(bankDetails)
      });

      const data = await response.json();

      if (data.success) {
        setMessageType('success');
        setMessage('✅ Bank details saved!');
        fetchWallet();
      } else {
        setMessageType('error');
        setMessage(`❌ ${data.message}`);
      }
    } catch (error) {
      setMessageType('error');
      setMessage(`❌ ${error.message}`);
    }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch('http://localhost:5000/api/wallet/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ amount: parseFloat(withdrawAmount) })
      });

      const data = await response.json();

      if (data.success) {
        setMessageType('success');
        setMessage('✅ Withdrawal request submitted!');
        setWithdrawAmount('');
        fetchWallet();
      } else {
        setMessageType('error');
        setMessage(`❌ ${data.message}`);
      }
    } catch (error) {
      setMessageType('error');
      setMessage(`❌ ${error.message}`);
    }
  };

  if (!wallet) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-green-700 mb-8">My Wallet</h1>

        {message && (
          <div className={`p-4 rounded-lg mb-4 ${
            messageType === 'success' 
              ? 'bg-green-100 text-green-700' 
              : 'bg-red-100 text-red-700'
          }`}>
            {message}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Balance</h2>
          <p className="text-5xl font-bold text-green-600">${wallet.walletBalance.toFixed(2)}</p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Bank Details</h2>

          {wallet.bankDetails ? (
            <div className="text-gray-600 space-y-2">
              <p>Account Holder: {wallet.bankDetails.accountHolderName}</p>
              <p>Account: ••••••{wallet.bankDetails.accountNumber.slice(-4)}</p>
              <p>Routing: {wallet.bankDetails.routingNumber}</p>
            </div>
          ) : (
            <form onSubmit={handleSaveBankDetails} className="space-y-4">
              <input
                type="text"
                placeholder="Account Holder Name"
                value={bankDetails.accountHolderName}
                onChange={(e) => setBankDetails({...bankDetails, accountHolderName: e.target.value})}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
              <input
                type="text"
                placeholder="Account Number"
                value={bankDetails.accountNumber}
                onChange={(e) => setBankDetails({...bankDetails, accountNumber: e.target.value})}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
              <input
                type="text"
                placeholder="Routing Number"
                value={bankDetails.routingNumber}
                onChange={(e) => setBankDetails({...bankDetails, routingNumber: e.target.value})}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
              <button
                type="submit"
                className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700"
              >
                Save Bank Details
              </button>
            </form>
          )}
        </div>

        {wallet.bankDetails && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Request Withdrawal</h2>

            <form onSubmit={handleWithdraw} className="space-y-4">
              <input
                type="number"
                placeholder="Withdrawal Amount"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                required
                min="0.01"
                max={wallet.walletBalance}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
              <button
                type="submit"
                className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700"
              >
                Request Withdrawal
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

# PART 4: ENVIRONMENT VARIABLES

## Step 12: Update .env Files

### Backend `server/.env`:
```
PORT=5000
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key-change-this
CORS_ORIGIN=http://localhost:3000
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLIC_KEY=pk_test_...
ADMIN_EMAIL=your-email@example.com
```

### Frontend `client/.env`:
```
REACT_APP_STRIPE_PUBLIC_KEY=pk_test_...
REACT_APP_ADMIN_EMAIL=your-email@example.com
```

---

# PART 5: GETTING STRIPE KEYS

## Step 13: Setup Stripe Account

1. Go to https://stripe.com
2. Sign up for free
3. Go to Dashboard
4. Click "Developers" → "API Keys"
5. Copy:
   - **Publishable Key** (starts with pk_test_) → `REACT_APP_STRIPE_PUBLIC_KEY`
   - **Secret Key** (starts with sk_test_) → `STRIPE_SECRET_KEY`

---

# PART 6: TESTING YOUR SETUP

## Step 14: Test Your Implementation

### Test Payment Flow:
1. Register as Company
2. Create campaign
3. Fill all details
4. Click "Proceed to Payment"
5. Use Stripe test card: `4242 4242 4242 4242` (any future date, any CVC)
6. Campaign should be created

### Test Admin:
1. Set your email as `ADMIN_EMAIL` in .env
2. Login with that account
3. Visit `/admin`
4. Should see admin panel
5. Other users visiting `/admin` should be denied

---

**This comprehensive guide covers everything you need!** Start implementing step by step.
