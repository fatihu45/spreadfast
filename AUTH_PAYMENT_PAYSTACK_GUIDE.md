# 🇳🇬 SpreadFast Authentication & Paystack Payment Integration Guide

## Overview

This guide will help you add:
1. **User Authentication** - Login/signup with email & password
2. **Payment Integration** - Paystack for Nigerian campaigns (NGN)
3. **Admin Security** - Only you can access admin dashboard
4. **Wallet System** - Promoters can withdraw earnings

---

# PART 1: USER AUTHENTICATION

## Step 1: Install Authentication Dependencies

### Backend Dependencies

```bash
cd server
npm install bcryptjs jsonwebtoken dotenv cors axios
```

**What each does:**
- `bcryptjs` - Hash passwords securely
- `jsonwebtoken` - Create login tokens
- `dotenv` - Read environment variables
- `cors` - Enable CORS for frontend
- `axios` - Call Paystack API

---

## Step 2: Create Environment File

Create `server/.env`:

```
PORT=5000
NODE_ENV=development
JWT_SECRET=your-super-secret-key-change-this-in-production
CORS_ORIGIN=http://localhost:3000
PAYSTACK_SECRET_KEY=sk_test_3744821421c009ec59a82921030e9bcb436465d5
PAYSTACK_PUBLIC_KEY=pk_test_0a12d7486e3b3539965e7e776e565b1fdce047f8
ADMIN_EMAIL=tryspreadfast@gmail.com
```

**Get Paystack Keys:**
1. Go to [paystack.com](https://paystack.com)
2. Sign up and verify your business
3. Go to Settings → API Keys
4. Copy Secret Key and Public Key
5. Add to this `.env` file

test secret  key: sk_test_3744821421c009ec59a82921030e9bcb436465d5
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
        message: 'Invalid token' 
      });
    }

    req.user = user;
    next();
  });
}

module.exports = { authenticateToken };
```

---

## Step 4: Update `server/server.js`

Replace your entire `server.js` with this:

```javascript
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN }));
app.use(express.json());

// Import auth middleware
const { authenticateToken } = require('./middleware/auth');

// File paths
const usersFile = path.join(__dirname, '../data/users.json');
const campaignsFile = path.join(__dirname, '../data/campaigns.json');
const withdrawalsFile = path.join(__dirname, '../data/withdrawals.json');
const paystackTransactionsFile = path.join(__dirname, '../data/paystack_transactions.json');

// Helper functions for file operations
function ensureDataFile(filePath, defaultValue = []) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveData(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ==================== AUTHENTICATION ROUTES ====================

// Register endpoint
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, email, and password required' 
      });
    }

    let users = ensureDataFile(usersFile);

    // Check if user already exists
    if (users.find(u => u.email === email)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already registered' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
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

    users.push(newUser);
    saveData(usersFile, users);

    // Create JWT token
    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Registration successful',
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        walletBalance: newUser.walletBalance
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and password required' 
      });
    }

    let users = ensureDataFile(usersFile);
    const user = users.find(u => u.email === email);

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }

    // Check password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }

    // Create JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        walletBalance: user.walletBalance
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

// Get current user
app.get('/api/auth/me', authenticateToken, (req, res) => {
  try {
    const users = ensureDataFile(usersFile);
    const user = users.find(u => u.id === req.user.id);

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        walletBalance: user.walletBalance
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, message: 'Failed to get user' });
  }
});

// ==================== PAYSTACK PAYMENT ROUTES ====================

// Initiate payment
app.post('/api/payments/initiate', authenticateToken, async (req, res) => {
  try {
    const { amount, campaignName } = req.body;

    if (!amount || !campaignName) {
      return res.status(400).json({ 
        success: false, 
        message: 'Amount and campaign name required' 
      });
    }

    const users = ensureDataFile(usersFile);
    const user = users.find(u => u.id === req.user.id);

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Call Paystack API to initialize payment
    const response = await axios.post('https://api.paystack.co/transaction/initialize', {
      email: user.email,
      amount: Math.round(amount * 100), // Paystack uses kobo (1 Naira = 100 kobo)
      metadata: {
        campaignName,
        userId: user.id,
        userName: user.name
      }
    }, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
      }
    });

    if (response.data.status) {
      // Store transaction reference
      let transactions = ensureDataFile(paystackTransactionsFile);
      transactions.push({
        id: uuidv4(),
        reference: response.data.data.reference,
        userId: user.id,
        email: user.email,
        amount,
        campaignName,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      saveData(paystackTransactionsFile, transactions);

      return res.json({
        success: true,
        message: 'Payment initialized',
        authorizationUrl: response.data.data.authorization_url,
        reference: response.data.data.reference
      });
    }

    res.status(500).json({ 
      success: false, 
      message: 'Failed to initialize payment' 
    });
  } catch (error) {
    console.error('Payment error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Payment initialization failed' 
    });
  }
});

// Verify payment
app.post('/api/payments/verify', authenticateToken, async (req, res) => {
  try {
    const { reference } = req.body;

    if (!reference) {
      return res.status(400).json({ 
        success: false, 
        message: 'Reference required' 
      });
    }

    // Verify with Paystack
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
      }
    );

    if (response.data.status && response.data.data.status === 'success') {
      const transaction = response.data.data;

      // Update transaction status
      let transactions = ensureDataFile(paystackTransactionsFile);
      const txIndex = transactions.findIndex(t => t.reference === reference);
      if (txIndex !== -1) {
        transactions[txIndex].status = 'completed';
        transactions[txIndex].verifiedAt = new Date().toISOString();
        saveData(paystackTransactionsFile, transactions);
      }

      return res.json({
        success: true,
        message: 'Payment verified successfully',
        data: {
          reference: transaction.reference,
          amount: transaction.amount / 100, // Convert from kobo back to Naira
          status: transaction.status
        }
      });
    }

    res.status(400).json({ 
      success: false, 
      message: 'Payment verification failed' 
    });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Verification failed' 
    });
  }
});

// Get payment status
app.get('/api/payments/status/:reference', authenticateToken, async (req, res) => {
  try {
    const { reference } = req.params;

    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
      }
    );

    if (response.data.status) {
      return res.json({
        success: true,
        status: response.data.data.status,
        amount: response.data.data.amount / 100
      });
    }

    res.status(400).json({ 
      success: false, 
      message: 'Could not get payment status' 
    });
  } catch (error) {
    console.error('Status error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get status' 
    });
  }
});

// ==================== CAMPAIGN ROUTES (Updated for Paystack) ====================

// Create campaign (after payment verified)
app.post('/api/campaigns', authenticateToken, async (req, res) => {
  try {
    const { title, description, budget, reference } = req.body;

    if (!title || !budget || !reference) {
      return res.status(400).json({ 
        success: false, 
        message: 'Title, budget, and payment reference required' 
      });
    }

    // Verify payment was made
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
      }
    );

    if (!response.data.status || response.data.data.status !== 'success') {
      return res.status(400).json({ 
        success: false, 
        message: 'Payment not verified' 
      });
    }

    let campaigns = ensureDataFile(campaignsFile);
    const campaign = {
      id: uuidv4(),
      companyId: req.user.id,
      title,
      description,
      budget,
      status: 'active',
      paystackReference: reference,
      amountPaid: response.data.data.amount / 100,
      submissions: [],
      createdAt: new Date().toISOString()
    };

    campaigns.push(campaign);
    saveData(campaignsFile, campaigns);

    res.json({
      success: true,
      message: 'Campaign created successfully',
      campaign
    });
  } catch (error) {
    console.error('Campaign creation error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create campaign' 
    });
  }
});

// Get all campaigns
app.get('/api/campaigns', (req, res) => {
  try {
    const campaigns = ensureDataFile(campaignsFile);
    res.json({ success: true, campaigns });
  } catch (error) {
    console.error('Fetch campaigns error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch campaigns' 
    });
  }
});

// Get campaigns by company
app.get('/api/campaigns/company/:companyId', (req, res) => {
  try {
    const campaigns = ensureDataFile(campaignsFile);
    const companyCampaigns = campaigns.filter(c => c.companyId === req.params.companyId);
    res.json({ success: true, campaigns: companyCampaigns });
  } catch (error) {
    console.error('Fetch company campaigns error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch campaigns' 
    });
  }
});

// Submit proof for campaign
app.post('/api/campaigns/:campaignId/submit', authenticateToken, async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { proofUrl, proofDescription } = req.body;

    if (!proofUrl) {
      return res.status(400).json({ 
        success: false, 
        message: 'Proof URL required' 
      });
    }

    let campaigns = ensureDataFile(campaignsFile);
    const campaign = campaigns.find(c => c.id === campaignId);

    if (!campaign) {
      return res.status(404).json({ 
        success: false, 
        message: 'Campaign not found' 
      });
    }

    const submission = {
      id: uuidv4(),
      promoterId: req.user.id,
      promoName: req.user.name,
      proofUrl,
      proofDescription,
      status: 'pending',
      approvalAmount: 0,
      createdAt: new Date().toISOString()
    };

    campaign.submissions.push(submission);
    saveData(campaignsFile, campaigns);

    res.json({
      success: true,
      message: 'Submission received',
      submission
    });
  } catch (error) {
    console.error('Submission error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Submission failed' 
    });
  }
});

// ==================== WALLET ROUTES ====================

// Get wallet details
app.get('/api/wallet', authenticateToken, (req, res) => {
  try {
    const users = ensureDataFile(usersFile);
    const user = users.find(u => u.id === req.user.id);

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    res.json({
      success: true,
      wallet: {
        balance: user.walletBalance,
        bankDetails: user.bankDetails
      }
    });
  } catch (error) {
    console.error('Wallet error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get wallet' 
    });
  }
});

// Add bank details
app.post('/api/wallet/bank-details', authenticateToken, (req, res) => {
  try {
    const { accountNumber, bankCode, accountName } = req.body;

    if (!accountNumber || !bankCode || !accountName) {
      return res.status(400).json({ 
        success: false, 
        message: 'Account details required' 
      });
    }

    let users = ensureDataFile(usersFile);
    const userIndex = users.findIndex(u => u.id === req.user.id);

    if (userIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    users[userIndex].bankDetails = {
      accountNumber,
      bankCode,
      accountName,
      addedAt: new Date().toISOString()
    };

    saveData(usersFile, users);

    res.json({
      success: true,
      message: 'Bank details saved',
      bankDetails: users[userIndex].bankDetails
    });
  } catch (error) {
    console.error('Bank details error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to save bank details' 
    });
  }
});

// Request withdrawal
app.post('/api/wallet/withdraw', authenticateToken, (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid amount required' 
      });
    }

    let users = ensureDataFile(usersFile);
    const user = users.find(u => u.id === req.user.id);

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    if (user.walletBalance < amount) {
      return res.status(400).json({ 
        success: false, 
        message: 'Insufficient balance' 
      });
    }

    if (!user.bankDetails) {
      return res.status(400).json({ 
        success: false, 
        message: 'Bank details required before withdrawal' 
      });
    }

    // Create withdrawal request
    let withdrawals = ensureDataFile(withdrawalsFile);
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

    withdrawals.push(withdrawal);
    saveData(withdrawalsFile, withdrawals);

    res.json({
      success: true,
      message: 'Withdrawal request submitted',
      withdrawal
    });
  } catch (error) {
    console.error('Withdrawal error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Withdrawal failed' 
    });
  }
});

// ==================== ADMIN ROUTES ====================

// Check if user is admin
app.get('/api/admin/check', authenticateToken, (req, res) => {
  const isAdmin = req.user.email === process.env.ADMIN_EMAIL;
  res.json({ success: true, isAdmin });
});

// Get all users (admin only)
app.get('/api/admin/users', authenticateToken, (req, res) => {
  if (req.user.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ 
      success: false, 
      message: 'Admin access required' 
    });
  }

  try {
    let users = ensureDataFile(usersFile);
    // Remove passwords from response
    users = users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      walletBalance: u.walletBalance,
      createdAt: u.createdAt
    }));

    res.json({ success: true, users });
  } catch (error) {
    console.error('Fetch users error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch users' 
    });
  }
});

// Get all campaigns (admin only)
app.get('/api/admin/campaigns', authenticateToken, (req, res) => {
  if (req.user.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ 
      success: false, 
      message: 'Admin access required' 
    });
  }

  try {
    const campaigns = ensureDataFile(campaignsFile);
    res.json({ success: true, campaigns });
  } catch (error) {
    console.error('Fetch campaigns error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch campaigns' 
    });
  }
});

// Approve/reject a submission
app.post('/api/admin/submissions/:submissionId/review', authenticateToken, (req, res) => {
  if (req.user.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ 
      success: false, 
      message: 'Admin access required' 
    });
  }

  try {
    const { submissionId } = req.params;
    const { status, approvalAmount } = req.body; // status: 'approved' or 'rejected'

    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid status required' 
      });
    }

    let campaigns = ensureDataFile(campaignsFile);
    let users = ensureDataFile(usersFile);
    let found = false;

    campaigns.forEach(campaign => {
      const submission = campaign.submissions.find(s => s.id === submissionId);
      if (submission) {
        submission.status = status;
        if (status === 'approved') {
          submission.approvalAmount = approvalAmount || 0;
          // Add to promoter's wallet
          const promoter = users.find(u => u.id === submission.promoterId);
          if (promoter) {
            promoter.walletBalance += approvalAmount || 0;
          }
        }
        found = true;
      }
    });

    if (!found) {
      return res.status(404).json({ 
        success: false, 
        message: 'Submission not found' 
      });
    }

    saveData(campaignsFile, campaigns);
    saveData(usersFile, users);

    res.json({
      success: true,
      message: `Submission ${status}`
    });
  } catch (error) {
    console.error('Review error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to review submission' 
    });
  }
});

// Get withdrawal requests (admin only)
app.get('/api/admin/withdrawals', authenticateToken, (req, res) => {
  if (req.user.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ 
      success: false, 
      message: 'Admin access required' 
    });
  }

  try {
    const withdrawals = ensureDataFile(withdrawalsFile);
    res.json({ success: true, withdrawals });
  } catch (error) {
    console.error('Fetch withdrawals error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch withdrawals' 
    });
  }
});

// Approve/reject withdrawal
app.post('/api/admin/withdrawals/:withdrawalId/review', authenticateToken, (req, res) => {
  if (req.user.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ 
      success: false, 
      message: 'Admin access required' 
    });
  }

  try {
    const { withdrawalId } = req.params;
    const { status } = req.body; // 'approved' or 'rejected'

    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid status required' 
      });
    }

    let withdrawals = ensureDataFile(withdrawalsFile);
    let users = ensureDataFile(usersFile);

    const withdrawal = withdrawals.find(w => w.id === withdrawalId);
    if (!withdrawal) {
      return res.status(404).json({ 
        success: false, 
        message: 'Withdrawal not found' 
      });
    }

    withdrawal.status = status;
    withdrawal.reviewedAt = new Date().toISOString();

    if (status === 'rejected') {
      // Refund to wallet if rejected
      const user = users.find(u => u.id === withdrawal.userId);
      if (user) {
        user.walletBalance += withdrawal.amount;
      }
      saveData(usersFile, users);
    }

    saveData(withdrawalsFile, withdrawals);

    res.json({
      success: true,
      message: `Withdrawal ${status}`
    });
  } catch (error) {
    console.error('Withdrawal review error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to review withdrawal' 
    });
  }
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`💳 Paystack Sandbox Mode: Testing payments with test keys`);
});
```

---

# PART 2: FRONTEND - REACT SETUP

## Step 5: Install Frontend Dependencies

```bash
cd client
npm install @paystack/inline-js axios
```

---

## Step 6: Create Environment File

Create `client/.env`:

```
REACT_APP_PAYSTACK_PUBLIC_KEY=pk_test_your_paystack_public_key
REACT_APP_ADMIN_EMAIL=your-email@example.com
```

---

## Step 7: Create Auth Context

Create `client/src/context/AuthContext.js`:

```javascript
import React, { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setUser(data.user);
      } else {
        localStorage.removeItem('token');
        setToken(null);
      }
    } catch (error) {
      console.error('Fetch user error:', error);
      localStorage.removeItem('token');
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  const register = async (name, email, password, role) => {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role })
    });
    const data = await response.json();
    if (data.success) {
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
    }
    return data;
  };

  const login = async (email, password) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (data.success) {
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
    }
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
```

---

## Step 8: Create Login & Register Pages

Create `client/src/pages/Login.jsx`:

```javascript
import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import './Auth.css';

export default function Login() {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(email, password);
    if (result.success) {
      window.location.href = '/';
    } else {
      setError(result.message);
    }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <form onSubmit={handleSubmit} className="auth-form">
        <h2>Login to SpreadFast</h2>
        {error && <div className="error">{error}</div>}
        
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        
        <button type="submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
        
        <p>Don't have an account? <a href="/register">Register here</a></p>
      </form>
    </div>
  );
}
```

Create `client/src/pages/Register.jsx`:

```javascript
import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import './Auth.css';

export default function Register() {
  const { register } = useContext(AuthContext);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('promoter');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await register(name, email, password, role);
    if (result.success) {
      window.location.href = '/';
    } else {
      setError(result.message);
    }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <form onSubmit={handleSubmit} className="auth-form">
        <h2>Register for SpreadFast</h2>
        {error && <div className="error">{error}</div>}
        
        <input
          type="text"
          placeholder="Full Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="promoter">Promoter</option>
          <option value="company">Company</option>
        </select>
        
        <button type="submit" disabled={loading}>
          {loading ? 'Registering...' : 'Register'}
        </button>
        
        <p>Already have an account? <a href="/login">Login here</a></p>
      </form>
    </div>
  );
}
```

Create `client/src/pages/Auth.css`:

```css
.auth-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.auth-form {
  background: white;
  padding: 40px;
  border-radius: 10px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 400px;
}

.auth-form h2 {
  margin-bottom: 30px;
  text-align: center;
  color: #333;
}

.auth-form input,
.auth-form select {
  width: 100%;
  padding: 12px;
  margin-bottom: 15px;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 16px;
  box-sizing: border-box;
}

.auth-form input:focus,
.auth-form select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.auth-form button {
  width: 100%;
  padding: 12px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 5px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.3s;
}

.auth-form button:hover:not(:disabled) {
  background: #5568d3;
}

.auth-form button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.auth-form .error {
  background: #fee;
  color: #c33;
  padding: 12px;
  border-radius: 5px;
  margin-bottom: 15px;
  border-left: 4px solid #c33;
}

.auth-form p {
  text-align: center;
  margin-top: 20px;
  color: #666;
}

.auth-form a {
  color: #667eea;
  text-decoration: none;
  font-weight: bold;
}
```

---

## Step 9: Update CompanyDashboard with Paystack Payment

Update `client/src/pages/CompanyDashboard.jsx`:

```javascript
import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import './CompanyDashboard.css';

export default function CompanyDashboard() {
  const { user, token } = useContext(AuthContext);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [error, setError] = useState('');

  // Load campaigns
  React.useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const response = await fetch('/api/campaigns');
      const data = await response.json();
      if (data.success) {
        setCampaigns(data.campaigns);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    }
  };

  const handlePaymentAndCreateCampaign = async (e) => {
    e.preventDefault();
    setError('');

    if (!title || !budget) {
      setError('Title and budget required');
      return;
    }

    setPaymentProcessing(true);

    try {
      // Step 1: Initiate payment
      const paymentResponse = await fetch('/api/payments/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: parseFloat(budget),
          campaignName: title
        })
      });

      const paymentData = await paymentResponse.json();

      if (!paymentData.success) {
        setError(paymentData.message);
        setPaymentProcessing(false);
        return;
      }

      // Step 2: Redirect to Paystack payment URL
      window.location.href = paymentData.authorizationUrl;
    } catch (error) {
      setError('Payment initialization failed');
      setPaymentProcessing(false);
    }
  };

  return (
    <div className="company-dashboard">
      <h1>Create Campaign</h1>

      <form onSubmit={handlePaymentAndCreateCampaign} className="campaign-form">
        {error && <div className="error">{error}</div>}

        <input
          type="text"
          placeholder="Campaign Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <textarea
          placeholder="Campaign Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        ></textarea>

        <input
          type="number"
          placeholder="Campaign Budget (NGN)"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          step="100"
          required
        />

        <button type="submit" disabled={paymentProcessing}>
          {paymentProcessing ? 'Processing Payment...' : 'Pay & Create Campaign'}
        </button>
      </form>

      <h2>Your Campaigns</h2>
      <div className="campaigns-list">
        {campaigns
          .filter(c => c.companyId === user?.id)
          .map(campaign => (
            <div key={campaign.id} className="campaign-card">
              <h3>{campaign.title}</h3>
              <p>Budget: ₦{campaign.budget}</p>
              <p>Paid: ₦{campaign.amountPaid}</p>
              <p>Status: {campaign.status}</p>
              <p>Submissions: {campaign.submissions.length}</p>
            </div>
          ))}
      </div>
    </div>
  );
}
```

---

## Step 10: Handle Payment Callback

Create `client/src/pages/PaymentCallback.jsx`:

```javascript
import React, { useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useSearchParams } from 'react-router-dom';

export default function PaymentCallback() {
  const { token } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const reference = searchParams.get('reference');
  const [status, setStatus] = useState('verifying');
  const [error, setError] = useState('');

  useEffect(() => {
    if (reference) {
      verifyPayment();
    }
  }, [reference]);

  const verifyPayment = async () => {
    try {
      const response = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reference })
      });

      const data = await response.json();

      if (data.success) {
        setStatus('success');
        // Redirect after 2 seconds
        setTimeout(() => {
          window.location.href = '/campaigns';
        }, 2000);
      } else {
        setStatus('failed');
        setError(data.message);
      }
    } catch (error) {
      setStatus('failed');
      setError('Verification failed');
    }
  };

  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      {status === 'verifying' && <p>Verifying payment...</p>}
      {status === 'success' && (
        <>
          <h2 style={{ color: 'green' }}>Payment Successful! ✓</h2>
          <p>Your campaign will be created shortly.</p>
          <p>Redirecting...</p>
        </>
      )}
      {status === 'failed' && (
        <>
          <h2 style={{ color: 'red' }}>Payment Failed ✗</h2>
          <p>{error}</p>
          <a href="/company">← Back</a>
        </>
      )}
    </div>
  );
}
```

---

## Step 11: Update App.jsx with Routes

Update `client/src/App.jsx`:

```javascript
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import CompanyDashboard from './pages/CompanyDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Wallet from './pages/Wallet';
import PaymentCallback from './pages/PaymentCallback';
import './App.css';

function ProtectedRoute({ children }) {
  const { user, loading } = React.useContext(AuthContext);

  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return children;
}

function AdminRoute({ children }) {
  const { user, loading } = React.useContext(AuthContext);

  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (user.email !== process.env.REACT_APP_ADMIN_EMAIL) {
    return <Navigate to="/" />;
  }
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/payment-callback" element={<PaymentCallback />} />
          
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/company"
            element={
              <ProtectedRoute>
                <CompanyDashboard />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/wallet"
            element={
              <ProtectedRoute>
                <Wallet />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
```

---

# PART 3: PAYSTACK CONFIGURATION

## Step 12: Get Paystack Credentials

1. **Register at Paystack:**
   - Go to [paystack.com](https://paystack.com)
   - Click "Sign up"
   - Fill in your business details
   - Verify your email

2. **Verify Your Account:**
   - Use test mode first (no verification needed)
   - For live payments, complete full verification

3. **Get API Keys:**
   - Log in to Paystack Dashboard
   - Go to Settings → API Keys & Webhooks
   - Copy:
     - **Public Key** (starts with `pk_test_` or `pk_live_`)
     - **Secret Key** (starts with `sk_test_` or `sk_live_`)

4. **Add to Environment Files:**

   `server/.env`:
   ```
   PAYSTACK_PUBLIC_KEY=pk_test_...
   PAYSTACK_SECRET_KEY=sk_test_...
   ```

   `client/.env`:
   ```
   REACT_APP_PAYSTACK_PUBLIC_KEY=pk_test_...
   ```

---

# PART 4: TESTING

## Step 13: Test Payment Flow

### 1. Start Backend
```bash
cd server
npm start
```

### 2. Start Frontend
```bash
cd client
npm start
```

### 3. Register Account
- Go to http://localhost:3000/register
- Register as "Company"
- Email: testcompany@example.com
- Password: Test123

### 4. Create Campaign with Payment
- Go to /company dashboard
- Fill in campaign details
- Click "Pay & Create Campaign"
- You'll be redirected to Paystack

### 5. Use Test Card
In Paystack test mode, use:
- **Card Number:** 4111111111111111
- **Expiry:** Any future date (e.g., 05/25)
- **CVC:** Any 3 digits (e.g., 123)
- **OTP:** 123456 (if prompted)

### 6. Verify Payment
- After payment, you'll be redirected to `/payment-callback`
- Payment will be verified
- You'll see success message
- Campaign will be created

---

## Expected Test Results

✅ Can register and login  
✅ Payment initiated   
✅ Redirected to Paystack page  
✅ Test card payment successful  
✅ Campaign created after payment  
✅ Promoter can view campaigns  
✅ Admin can view all campaigns & approve submissions  
✅ Wallet tracking working  
✅ Withdrawal requests created  

---

## Paystack Test Mode vs Live Mode

| Feature | Test Mode | Live Mode |
|---------|-----------|-----------|
| API Keys | Start with `pk_test_` | Start with `pk_live_` |
| Test Cards | Yes (4111...) | No |
| Real Money | No | Yes |
| Setup | Automatic | Needs verification |

---

## Switching to Live Mode

1. **Complete Paystack Verification**
   - Verify bank account
   - Upload business documents
   - Paystack will review (24-48 hours)

2. **Get Live Keys**
   - Once approved, go to Settings → API Keys
   - Switch from "Test" to "Live"
   - Copy live keys

3. **Update Environment**
   ```
   PAYSTACK_SECRET_KEY=sk_live_...
   PAYSTACK_PUBLIC_KEY=pk_live_...
   REACT_APP_PAYSTACK_PUBLIC_KEY=pk_live_...
   ```

4. **Restart App**
   - Stop backend & frontend
   - Restart both
   - Now accepting real payments

---

## Troubleshooting Paystack

### Payment not initializing?
✓ Check `PAYSTACK_SECRET_KEY` in `server/.env`
✓ Ensure it starts with `sk_test_` or `sk_live_`
✓ Restart backend after changing

### Redirect not working?
✓ Check browser console (F12)
✓ Verify authorization URL is returned from backend
✓ Check CORS settings in server

### Card declined?
✓ In test mode: Use `4111111111111111`
✓ Any future expiry date
✓ Any 3-digit CVC

---

# SUMMARY

You now have:
✅ Complete auth system (register/login/logout)
✅ Paystack payment integration  
✅ Admin-only dashboard (your email only)
✅ Promoter wallet system  
✅ Campaign creation after payment  
✅ Withdrawal management  
✅ Role-based access control  

**All optimized for Nigerian Naira (NGN)!**

