# 🚀 SpreadFast - Copy-Paste Command Reference

**Just copy and paste these commands in order!**

---

## PHASE 1: PREPARE LOCAL FILES (5 minutes)

### Remove Old Files

```powershell
cd c:\Users\DELL E7440\Desktop\spreadfast
rm index.html
rm styles.css
```

---

## PHASE 2: GIT INITIALIZATION & PUSH (5 minutes)

### Initialize Git (if not already done)

```powershell
cd c:\Users\DELL E7440\Desktop\spreadfast
git init
```

---

### Check Status

```powershell
git status
```

---

### Add All Files

```powershell
git add .
```

---

### Commit Changes

```powershell
git commit -m "Initial: Full-stack SpreadFast MVP - React + Express + TailwindCSS"
```

---

### Add GitHub Remote

**Copy your actual repo URL and paste below:**

```powershell
git remote add origin https://github.com/fatihu45/spreadfast.git
```

---

### Rename Branch to Main & Push

```powershell
git branch -M main
git push -u origin main
```

**When prompted:**
- Username: `fatihu45`
- Password: Use **GitHub Personal Access Token**

---

### Verify on GitHub

Open in browser: https://github.com/fatihu45/spreadfast

Should see all your files there ✅

---

## PHASE 3: DEPLOY BACKEND TO RAILWAY (15 minutes)

### Step 1: Create Railway Account
- Go to: https://railway.app
- Sign up with GitHub
- Authorize Railway

### Step 2: Create Project
- Click "New Project"
- Click "Deploy from GitHub repo"
- Select `spreadfast` repo
- Click "Deploy"

### Step 3: Configure Backend

Once deployment page loads:

1. Click the deployed service
2. Click "Settings"
3. Set **Root Directory:** `server`
4. Click "Save"

### Step 4: Add Environment Variables

1. Click "Variables" tab
2. Add these variables:

```
PORT=5000
NODE_ENV=production
CORS_ORIGIN=https://spreadfast.vercel.app
```

3. Click "Save"

### Step 5: Get Your Backend URL

1. Go back to "Deployments"
2. Look for "Railway Provided Domain"
3. **Copy this URL**

Example: `https://spreadfast-production.up.railway.app`

### Step 6: Test Backend (in PowerShell)

```powershell
# Replace with your actual backend URL
curl https://your-backend-url/api/health
```

**Expected response:**
```json
{"status": "Server is running"}
```

---

## PHASE 4: DEPLOY FRONTEND TO VERCEL (15 minutes)

### Step 1: Create Vercel Account
- Go to: https://vercel.com
- Click "Sign up"
- Sign up with GitHub
- Authorize Vercel

### Step 2: Import GitHub Project
1. Click "Create" or "Add New"
2. Click "Import Project"
3. Paste: `https://github.com/fatihu45/spreadfast`
4. Click "Continue"

### Step 3: Configure Project
- Framework: React
- Root Directory: `client`
- Build Command: `npm run build`
- Output Directory: `build`
- Click "Deploy"

**Wait for deployment to finish (5 minutes)...**

### Step 4: Get Frontend URL

After deployment, Vercel shows your URL:
```
https://spreadfast.vercel.app
```

**Copy this URL**

### Step 5: Add Environment Variable

In Vercel dashboard:

1. Click your project
2. Click "Settings"
3. Click "Environment Variables"
4. Add:
   - **Name:** `REACT_APP_API_URL`
   - **Value:** `https://your-backend-url/api` (paste your Railway backend URL)
   - **Environments:** Check "Production"
5. Click "Save"

---

## PHASE 5: CONNECT FRONTEND TO BACKEND (5 minutes)

### Update Backend CORS

Go back to **Railway dashboard:**

1. Click your backend service
2. Click "Variables"
3. Update `CORS_ORIGIN` to your Vercel URL:

```
CORS_ORIGIN=https://spreadfast.vercel.app
```

4. Click "Save"

**Railway restarts with new config (wait 1 minute)**

---

## PHASE 6: TEST EVERYTHING (5 minutes)

### Test 1: Check Backend is Running

```powershell
curl https://your-backend-url/api/health
```

Should return: `{"status": "Server is running"}`

---

### Test 2: Visit Frontend in Browser

Open: https://spreadfast.vercel.app

**You should see:**
- SpreadFast landing page
- All navigation links work
- No error messages

---

### Test 3: Create a Campaign

1. Click "Create Campaign"
2. Fill in:
   - Campaign Name: `Test Campaign`
   - Description: `Testing deployment`
   - Platform: `Instagram`
   - Budget: `100`
   - Duration: `7 days`
3. Click "Create Campaign"
4. Should see: ✅ Campaign created successfully!

---

### Test 4: View Campaign

1. Click "Campaigns"
2. Your campaign should appear
3. Click campaign card to see details

---

### Test 5: Register User

1. Click "Join as Promoter"
2. Fill in:
   - Name: `Test User`
   - Email: `test@example.com`
   - Phone: `1234567890`
3. Click "Join as Promoter"
4. Should see: ✅ You have been registered successfully!

---

### Test 6: Submit Proof

1. Go to "Campaigns"
2. Click "Participate" on your campaign
3. Fill in:
   - Your Name: `Test User`
   - Platform: `Instagram`
   - Post Link: `https://instagram.com/example`
4. Click "Submit Proof"
5. Should see: ✅ Submission successful!

---

### Test 7: Admin Approval

1. Go to "Admin Dashboard"
2. Click "Submissions" tab
3. See your submission
4. Click "✅ Approve"
5. Status should change to "Approved"

---

## ✅ IF ALL TESTS PASS: YOU'RE LIVE! 🎉

Your app is now accessible worldwide at: https://spreadfast.vercel.app

---

## TROUBLESHOOTING COMMANDS

### Check Backend is Running

```powershell
curl https://your-backend-url/api/health
```

### View Railway Logs (for backend errors)

Go to Railway dashboard → Click service → Click "Deployments"

---

### View Vercel Logs (for frontend errors)

Go to Vercel dashboard → Click project → Click "Deployments" → View build logs

---

### Rebuild Frontend (if changes don't show)

In Vercel dashboard:
1. Click "Deployments"
2. Right-click latest deployment
3. Click "Redeploy"

---

### Restart Backend Service

In Railway dashboard:
1. Click your service
2. Click the "..." menu
3. Click "Restart"

---

## OPTIONAL: SETUP MONGODB (For Data Persistence)

### Create MongoDB Account

1. Go to: https://www.mongodb.com
2. Click "Try Free"
3. Sign up with email
4. Create organization
5. Create project

### Create Free Cluster

1. Click "Build a Database"
2. Choose "M0 Free" tier
3. Create cluster
4. Wait 2-5 minutes

### Get Connection String

1. Click "Connect"
2. Choose "Drivers" → "Node.js"
3. Copy connection string

### Add to Railway

In Railway dashboard:

Add environment variable:

```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/databasename
```

---

## QUICK REFERENCE: YOUR URLs

**After deployment, you can access:**

```
GitHub Code:    https://github.com/fatihu45/spreadfast
Frontend App:   https://spreadfast.vercel.app
Backend API:    https://your-backend-url/api/health
```

---

## Summary of What You Did

```
Step 1: ✅ Removed old files
Step 2: ✅ Pushed to GitHub
Step 3: ✅ Deployed backend to Railway
Step 4: ✅ Deployed frontend to Vercel
Step 5: ✅ Connected them together
Step 6: ✅ Tested everything
Result: Your app is LIVE on the internet! 🚀
```

---

## Total Time Estimate

- File cleanup: 2 minutes
- Git & GitHub: 10 minutes
- Railway backend: 15 minutes
- Vercel frontend: 15 minutes
- Connection & testing: 10 minutes
- **TOTAL: 52 minutes**

---

**DO NOT RUN THESE COMMANDS IN ORDER YET** - Read the full guide first!

1. Read: [GITHUB_DEPLOYMENT_GUIDE.md](GITHUB_DEPLOYMENT_GUIDE.md)
2. Read: [QUICK_DEPLOYMENT_STEPS.md](QUICK_DEPLOYMENT_STEPS.md)
3. Then come back here and execute these commands

---

## Need Help?

**Stuck?** Check if:
1. Backend port is correct (5000)
2. Frontend port is correct (3000)
3. CORS_ORIGIN matches your Vercel URL
4. REACT_APP_API_URL matches your Railway URL
5. Both services are running

Review the troubleshooting section above! 👆
