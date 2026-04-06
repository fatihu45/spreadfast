# 🚀 SpreadFast - GitHub & Deployment Guide

## Overview
This guide will walk you through:
1. Pushing your code to GitHub
2. Removing old files
3. Deploying to production servers
4. Setting up environment variables
5. Making it work like localhost but on the internet

---

# PART 1: GitHub Setup & Push

## Step 1: Initialize Git (Skip if already done)

```powershell
cd c:\Users\DELL E7440\Desktop\spreadfast
git init
```

**What it does:** Initializes a git repository in your folder

---

## Step 2: Check Git Status

```powershell
git status
```

**You should see:**
- Red files = new/untracked files
- These are the files that need to be added

---

## Step 3: Add All Files to Git

```powershell
git add .
```

**OR** (more specific):
```powershell
git add client/
git add server/
git add package.json
git add .gitignore
git add *.md
```

**Verify with:**
```powershell
git status
```

**Now files should be green** (staged for commit)

---

## Step 4: Commit Your Code

```powershell
git commit -m "Initial commit: Full-stack SpreadFast MVP with React frontend and Express backend"
```

**Better commit messages:**
```powershell
git commit -m "Add: Complete SpreadFast MVP application

- React frontend with 6 pages
- Express backend with API endpoints
- TailwindCSS styling
- JSON file storage
- Admin dashboard for submissions
- Ready for deployment"
```

**Verify:**
```powershell
git log
```

You should see your commit listed.

---

## Step 5: Create GitHub Repository

**If not already created:**

1. Go to https://github.com/fatihu45
2. Click **"New"** (green button)
3. Repository name: **`spreadfast`**
4. Description: **"Crowd-powered marketing platform MVP"**
5. Public (so others can see)
6. **Don't** initialize with README (we have one)
7. Click **"Create repository"**

---

## Step 6: Add GitHub Remote

```powershell
git remote add origin https://github.com/fatihu45/spreadfast.git
```

**Verify:**
```powershell
git remote -v
```

You should see:
```
origin  https://github.com/fatihu45/spreadfast.git (fetch)
origin  https://github.com/fatihu45/spreadfast.git (push)
```

---

## Step 7: Push to GitHub

```powershell
git branch -M main
git push -u origin main
```

**What happens:**
- Renames branch to `main`
- Pushes all commits to GitHub
- Takes 1-2 minutes depending on internet

**You may be prompted for:**
- GitHub username: `fatihu45`
- GitHub password: Use **Personal Access Token** instead of password

### Creating GitHub Personal Access Token (If Needed)

1. Go to https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Name: `SpreadFast Deployment`
4. Select scopes: Check `repo` (gives full control)
5. **Copy the token** (you won't see it again!)
6. Use this token as your password when pushing

---

## Step 8: Verify on GitHub

Go to https://github.com/fatihu45/spreadfast

You should see:
- ✅ All your files uploaded
- ✅ Folder structure preserved
- ✅ README files visible
- ✅ Code visible in browser

---

# PART 2: Remove Old Files

## Step 9: Delete Old index.html and styles.css

**These are in your root directory:**
- `c:\Users\DELL E7440\Desktop\spreadfast\index.html`
- `c:\Users\DELL E7440\Desktop\spreadfast\styles.css`

### Remove Locally:

```powershell
# Make sure you're in root directory
cd c:\Users\DELL E7440\Desktop\spreadfast

# Delete old files
rm index.html
rm styles.css

# Verify they're gone
dir
```

**Or manually:**
1. Open file explorer
2. Go to `c:\Users\DELL E7440\Desktop\spreadfast`
3. Delete `index.html`
4. Delete `styles.css`

---

## Step 10: Commit Deletion to Git

```powershell
git add .
git commit -m "Remove: Old index.html and styles.css files (replaced by React frontend)"
git push origin main
```

**Verify on GitHub:**
- Those files should no longer appear in your repository

---

# PART 3: Environment Setup for Production

## Step 11: Create Environment Variables File

### Backend (.env file)

**Create file:** `server/.env`

```
PORT=5000
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com
```

**On localhost, create:** `server/.env.local`

```
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

### Frontend (.env file)

**Create file:** `client/.env`

```
REACT_APP_API_URL=https://your-backend-domain.com/api
```

**On localhost, create:** `client/.env.local`

```
REACT_APP_API_URL=http://localhost:5000/api
```

**Update API calls in frontend:**

File: `client/src/utils/api.js`

Change:
```javascript
const API_BASE_URL = "http://localhost:5000/api";
```

To:
```javascript
const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";
```

---

## Step 12: Update Backend for Production

**File:** `server/server.js`

Find this section:
```javascript
const PORT = process.env.PORT || 5000;
```

And add CORS configuration:
```javascript
const cors = require("cors");

app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true
}));
```

---

## Step 13: Commit Environment Changes

```powershell
git add server/.env
git add client/.env
git add server/server.js
git add client/src/utils/api.js
git commit -m "Add: Environment configuration for production"
git push origin main
```

---

# PART 4: Backend Deployment

## Overview of Deployment Options

| Platform | Cost | Setup Time | Best For |
|----------|------|-----------|----------|
| **Railway** | Free tier available | 5 mins | Easiest, Node.js |
| **Render** | Free tier available | 10 mins | Simple deployment |
| **Heroku** | $7/month minimum | 10 mins | Popular, reliable |
| **DigitalOcean** | $4/month | 20 mins | Control, scaling |
| **AWS** | Pay as you go | 30 mins | Enterprise |

**Recommended: Railway** (easiest, free tier)

---

## Step 14: Deploy Backend to Railway

### 14A: Create Railway Account

1. Go to https://railway.app
2. Click **"Start a New Project"**
3. Sign up with GitHub (recommended)
4. Authorize Railway to access your GitHub

### 14B: Create Backend Service

1. Click **"New Project"**
2. Click **"Deploy from GitHub repo"**
3. Search for **`spreadfast`** repo
4. Select it
5. Click **"Deploy"**

### 14C: Configure Backend Service

1. Click on the deployed service
2. Go to **"Settings"**
3. Set **Root Directory:** `server`
4. Set **Start Command:** `npm start`
5. Click **"Save"**

### 14D: Add Environment Variables

1. In Railway dashboard, go to **"Variables"**
2. Add these variables:

| Key | Value |
|-----|-------|
| PORT | 5000 |
| NODE_ENV | production |
| CORS_ORIGIN | https://your-frontend-domain.com |

3. Click **"Save"**

### 14E: Get Your Backend URL

1. Railway will assign a URL like: `https://spreadfast-backend-production.up.railway.app`
2. **Copy this URL** (you'll need it for frontend)
3. This is your **BACKEND_URL**

**Example:**
```
https://spreadfast-backend-production.up.railway.app
```

---

## Step 15: Test Backend Deployment

```powershell
# Replace with your actual URL
curl https://your-backend-url/api/health
```

**Expected response:**
```json
{"status": "Server is running"}
```

---

# PART 5: Frontend Deployment

## Step 16: Deploy Frontend to Vercel

### 16A: Create Vercel Account

1. Go to https://vercel.com
2. Click **"Sign Up"**
3. Sign up with GitHub (recommended)
4. Authorize Vercel to access GitHub

### 16B: Import Project

1. Click **"Create"** or **"Import"**
2. Select **`spreadfast`** repository
3. Click **"Continue"**

### 16C: Configure Frontend

1. **Root Directory:** `client`
2. **Build Command:** `npm run build`
3. **Output Directory:** `build`
4. Click **"Deploy"**

Vercel will automatically:
- Install dependencies
- Build React app
- Deploy to CDN
- Give you a URL

### 16D: Set Environment Variables

1. In Vercel dashboard, go to **"Settings"**
2. Click **"Environment Variables"**
3. Add:

| Name | Value | Environment |
|------|-------|-------------|
| REACT_APP_API_URL | https://your-backend-url/api | Production |
| REACT_APP_API_URL | http://localhost:5000/api | Development |

4. Click **"Save"**

### 16E: Get Your Frontend URL

Vercel will show: `https://spreadfast.vercel.app`

This is your **FRONTEND_URL**

---

## Step 17: Update Backend CORS

Now that you have your frontend URL, update backend:

**Railway Dashboard:**
1. Go to your backend service
2. Click **"Variables"**
3. Update `CORS_ORIGIN` to your Vercel URL:

```
CORS_ORIGIN=https://spreadfast.vercel.app
```

4. Click **"Save"**
5. Railway auto-restarts with new config

---

## Step 18: Test Frontend Deployment

1. Go to your Vercel URL: `https://spreadfast.vercel.app`
2. You should see the landing page
3. Try creating a campaign
4. You should see success message

---

# PART 6: Database Persistence in Production

## Issue: JSON Files Don't Persist

**Problem:** On localhost, JSON files save to your computer. On servers, data is lost.

**Why:** Server restarts = file system gone

## Solution: Migrate to MongoDB (Recommended)

### Step 19: Create MongoDB Account

1. Go to https://www.mongodb.com
2. Click **"Try Free"**
3. Sign up with email
4. Create organization
5. Create project

### 19A: Create Cluster

1. Click **"Create"** under Databases
2. Choose **"M0 Free"** (free tier)
3. Click **"Create Cluster"**
4. Choose server region (pick closest to you)
5. Wait for cluster creation (2-5 minutes)

### 19B: Get Connection String

1. Click **"Connect"**
2. Click **"Drivers"**
3. Choose **"Node.js"**
4. Copy the connection string

It looks like:
```
mongodb+srv://username:password@cluster.mongodb.net/databasename
```

---

## Step 20: Update Backend for MongoDB

### Install MongoDB Package

```powershell
cd server
npm install mongoose
```

### Update server.js

Replace JSON file logic with MongoDB:

**Old (JSON):**
```javascript
const campaigns = JSON.parse(fs.readFileSync('./data/campaigns.json'));
campaigns.push(newCampaign);
fs.writeFileSync('./data/campaigns.json', JSON.stringify(campaigns));
```

**New (MongoDB):**
```javascript
const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI);

// Create schema
const campaignSchema = new mongoose.Schema({
  id: String,
  name: String,
  description: String,
  // ... other fields
  createdAt: Date
});

const Campaign = mongoose.model('Campaign', campaignSchema);

// Save campaign
const newCampaign = new Campaign(campaignData);
await newCampaign.save();
```

**This is complex.** For quick fix, see **Alternative Solution** below.

---

## Alternative Solution: Use Cloud Storage (Easier)

Instead of changing code, use **Firebase Realtime Database** or **MongoDB Atlas**:

### Option A: Firebase (Easiest)

1. Go to https://firebase.google.com
2. Click **"Get Started"**
3. Create new project: `spreadfast-prod`
4. Enable **Realtime Database**
5. Set rules to public (for MVP)
6. Update backend to use Firebase SDK

### Option B: Keep JSON + Cloud Storage

1. Upload JSON files to **AWS S3** or **Google Cloud Storage**
2. Backend reads/writes to cloud storage instead of local files

---

## Quick Alternative: Use Hobby Database

Services that provide **free databases:**

1. **MongoDB Atlas** (free tier)
   - https://www.mongodb.com/cloud/atlas
   - 512MB free storage
   - Perfect for MVP

2. **Firebase** (free tier)
   - https://firebase.google.com
   - Real-time database
   - Easy integration

3. **PlanetScale** (MySQL)
   - https://planetscale.com
   - Free tier
   - If you prefer SQL

**Recommended:** MongoDB Atlas

---

# PART 7: Data Migration (If Using MongoDB)

## Step 21: Migrate Data from JSON to MongoDB

### Create Migration Script

**File:** `server/migrate.js`

```javascript
const mongoose = require('mongoose');
const fs = require('fs');

const MONGODB_URI = process.env.MONGODB_URI;

// Schemas
const campaignSchema = new mongoose.Schema({
  id: String,
  name: String,
  description: String,
  image: String,
  caption: String,
  platform: String,
  budget: Number,
  duration: String,
  createdAt: Date
});

const Campaign = mongoose.model('Campaign', campaignSchema);

async function migrate() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Read JSON file
    const campaigns = JSON.parse(fs.readFileSync('./data/campaigns.json', 'utf8'));

    // Insert into MongoDB
    await Campaign.insertMany(campaigns);
    console.log('✅ Migrated campaigns');

    // Repeat for users and submissions...

    await mongoose.connection.close();
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
```

### Run Migration

```powershell
cd server
node migrate.js
```

---

# PART 8: Complete Production Deployment Checklist

## Step 22: Final Verification

### Pre-Deployment Checks

- [ ] All code committed to GitHub
- [ ] Backend deployed to Railway
- [ ] Frontend deployed to Vercel
- [ ] Environment variables set
- [ ] Removed old index.html and styles.css
- [ ] CORS configured correctly
- [ ] Database configured (MongoDB optional but recommended)

### Production Testing

- [ ] Can access frontend URL in browser
- [ ] Landing page loads
- [ ] Navigation works
- [ ] Can create campaign
- [ ] Campaign appears in database
- [ ] Can register user
- [ ] Can submit proof
- [ ] Admin approval works
- [ ] Data persists after server restart
- [ ] Performance acceptable

---

## Step 23: SSL Certificate & Domain (Optional)

If you want a custom domain:

### Option 1: Vercel (Easiest)

1. In Vercel dashboard
2. Setting → Domains
3. Add custom domain
4. SSL auto-generates

### Option 2: Railway Backend

1. Same process
2. Railway provides URL without custom domain setup needed

---

# PART 9: Monitoring & Logs

## Step 24: Monitor Your Application

### Railway Backend Logs

1. Go to Railway dashboard
2. Click your backend service
3. Click **"Deployments"**
4. See live logs of requests

### Vercel Frontend Logs

1. Go to Vercel dashboard
2. Click your project
3. Click **"Functions"**
4. See logs and errors

---

## Step 25: Troubleshooting Production Issues

### Issue: Frontend can't reach backend

**Solution:**
```powershell
# Check CORS settings in Railway
# Make sure CORS_ORIGIN matches your frontend URL
# Redeploy backend after changing
```

### Issue: Data not saving

**Solution:**
- If using JSON: Need to migrate to database
- If using MongoDB: Check connection string
- Check Railway logs for errors

### Issue: Deployment fails

**Solution:**
1. Check logs in dashboard
2. Verify environment variables
3. Ensure package.json has correct start script
4. Check for errors in code

---

# PART 10: Update Local Development

## Step 26: Switch to Production Links

Once everything is deployed, update your localhost `.env` files:

**For testing production:**

`client/.env.production`
```
REACT_APP_API_URL=https://your-backend-url/api
```

Or keep localhost version for development:

`client/.env.development` (for local testing)
```
REACT_APP_API_URL=http://localhost:5000/api
```

---

# PART 11: Scaling & Next Steps

## Step 27: After MVP is Live

### Week 1: Monitor
- Watch for errors
- Get user feedback
- Track performance

### Week 2-3: Improvements
- Add authentication
- Improve performance
- Add more features

### Month 2: Scaling
- Upgrade database
- Upgrade server tier
- Add CDN for images
- Setup analytics

---

# QUICK REFERENCE: All Commands

## Git Commands
```powershell
git init                           # Initialize repo
git add .                          # Stage all files
git commit -m "message"            # Commit with message
git remote add origin [url]        # Add GitHub remote
git push -u origin main            # Push to GitHub
git log                            # View commit history
```

## Deployment Links
| Service | URL |
|---------|-----|
| GitHub | https://github.com/fatihu45/spreadfast |
| Railway Backend | https://railway.app (dashboard) |
| Vercel Frontend | https://vercel.com (dashboard) |
| MongoDB | https://cloud.mongodb.com |

---

# SUMMARY: What You Accomplished

✅ Pushed code to GitHub
✅ Removed old files from both local and GitHub
✅ Set up environment variables
✅ Deployed backend to Railway
✅ Deployed frontend to Vercel
✅ Configured CORS for production
✅ Created monitoring setup
✅ Application now live on internet!

---

## Your Production URLs

**Once deployed, you can access:**

- **Frontend:** https://spreadfast.vercel.app (or your custom domain)
- **Backend API:** https://your-backend-url/api/health
- **GitHub Code:** https://github.com/fatihu45/spreadfast

---

**Estimated Time:** 
- GitHub push: 10 minutes
- Railway backend: 15 minutes
- Vercel frontend: 15 minutes
- Testing: 20 minutes
- **Total: ~60 minutes**

**You're now going live!** 🎉
