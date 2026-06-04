# 📦 Brand Asset Upload - Deployment Guide

## ✅ What's Been Implemented

### Backend (Node.js + Cloudinary)
- ✅ Cloudinary integration with signed URL generation
- ✅ 4 API endpoints for asset management
- ✅ Database schemas for assets and subscriptions
- ✅ Access control validation (subscription verification)
- ✅ File type validation and compression
- ✅ Error handling and fallbacks

### Frontend (React)
- ✅ `BrandAssetUpload.jsx` - Company upload component with drag-drop
- ✅ `BrandAssets.jsx` - Promoter asset grid with preview/download
- ✅ Updated `api.js` to support FormData uploads
- ✅ Responsive design for mobile and desktop

---

## 🚀 Step-by-Step Deployment

### **STEP 1: Local Testing (Before Pushing)**

#### Test the Backend Locally
```bash
cd server
npm install  # Install cloudinary if not done
npm start
```

The server should start and show:
```
✅ Cloudinary initialized
🚀 Server running on http://localhost:5000
```

#### Test the Frontend Locally
```bash
cd client
npm start
```

---

### **STEP 2: Push to GitHub**

#### 1. Initialize Git (if not already done)
```bash
cd c:\Users\DELL\ E7440\Desktop\spreadfast
git init
git remote add origin https://github.com/YOUR_USERNAME/spreadfast.git
```

#### 2. Add All Changes
```bash
git add .
git commit -m "feat: Add Cloudinary brand asset upload system

- Implemented asset upload with drag-drop UI
- Added signed URL generation for secure downloads
- Created BrandAssetUpload and BrandAssets components
- Integrated Cloudinary for cloud storage
- Added subscription-based access control"
```

#### 3. Push to GitHub
```bash
git branch -M main
git push -u origin main
```

---

### **STEP 3: Deploy Backend to Render**

#### 1. Add Environment Variables to Render

Go to: **Render Dashboard → Your Service → Settings → Environment**

Add these variables:
```
check tg saved msgs
```

#### 2. Redeploy Service
```bash
# Push trigger (automatic on git push)
# OR manually trigger on Render:
# Settings → Redeploy from latest commit
```

**Expected Result:**
- Backend should be running with Cloudinary enabled
- Check logs: `✅ Cloudinary initialized`

---

### **STEP 4: Update Frontend for Production**

#### 1. Update `.env.production` (client folder)
```
REACT_APP_API_URL=https://YOUR_RENDER_BACKEND_URL.com
```

For example:
```
REACT_APP_API_URL=https://spreadfast-backend.onrender.com
```

#### 2. Build for Production
```bash
cd client
npm run build
```

This creates an optimized `build/` folder.

---

### **STEP 5: Deploy Frontend to Vercel**

#### 1. Connect Repository to Vercel
- Go to [vercel.com](https://vercel.com)
- Click "New Project"
- Import your GitHub repository
- Select "spreadfast" repo

#### 2. Configure Build Settings
```
Framework Preset: Create React App
Build Command: npm run build
Output Directory: build
```

#### 3. Add Environment Variables
```
REACT_APP_API_URL=https://YOUR_RENDER_BACKEND_URL.com
```

#### 4. Deploy
- Click "Deploy"
- Vercel will build and deploy automatically

**Your frontend is now live at:** `https://YOUR_PROJECT.vercel.app`

---

### **STEP 6: Test Production Deployment**

#### 1. Test Company Upload Flow
1. Go to your production URL
2. Login as company
3. Create a campaign → Upload brand assets
4. Verify files upload to Cloudinary folder: `spreadfast/campaign-assets/{campaignId}/`

#### 2. Test Promoter Download Flow
1. Login as promoter
2. Browse campaigns
3. Subscribe to a campaign
4. View campaign details → See "Brand Assets" section
5. Download an asset → Verify signed URL works
6. Wait 24 hours (signed URLs expire after 24h)

#### 3. Monitor Logs
```bash
# Render backend logs
https://dashboard.render.com → Your Service → Logs

# Vercel frontend logs
https://vercel.com → Dashboard → Your Project → Deployments → Logs
```

---

## 📋 API Reference

### Company Endpoints

#### Upload Assets
```
POST /api/campaigns/{id}/assets/upload
Authorization: Bearer {token}
Content-Type: multipart/form-data

Body: files (array of files, max 10, 20MB each)

Response:
{
  "success": true,
  "message": "3 file(s) uploaded successfully",
  "assets": [
    {
      "id": "asset_id",
      "file_name": "image.png",
      "file_type": "image",
      "file_size": 512,
      "uploaded_at": "2026-05-25T..."
    }
  ]
}
```

#### Get Asset List
```
GET /api/campaigns/{id}/assets
Authorization: Bearer {token}

Response:
{
  "success": true,
  "assets": [...]
}
```

#### Delete Asset
```
DELETE /api/campaigns/{id}/assets/{assetId}
Authorization: Bearer {token}

Response:
{
  "success": true,
  "message": "Asset deleted successfully"
}
```

### Promoter Endpoints

#### Get Assets (if subscribed)
```
GET /api/campaigns/{id}/assets
Authorization: Bearer {token}

Response:
{
  "success": true,
  "assets": [...]
}
```

#### Download Asset (generates signed URL)
```
GET /api/campaigns/{id}/assets/{assetId}/download
Authorization: Bearer {token}

Response:
{
  "success": true,
  "download_url": "https://res.cloudinary.com/...(signed)",
  "file_name": "image.png",
  "expires_in": 86400
}
```

---

## 🔐 Security Checklist

- ✅ Cloudinary API secret never exposed to frontend
- ✅ Signed URLs generated server-side only
- ✅ Subscription verified before asset access
- ✅ URLs expire in 24 hours automatically
- ✅ File type validation on both client & server
- ✅ File size limit enforced (20MB, 10 files max)
- ✅ Cloudinary folder isolation per campaign

---

## 🛠️ Troubleshooting

### Cloudinary Upload Fails
**Error:** `"Upload failed: Cloudinary credentials not found"`

**Fix:**
1. Verify `.env` has Cloudinary variables
2. Restart backend: `npm start`
3. Check Render environment variables are set
4. Redeploy: `git push origin main`

### Assets Not Showing for Promoter
**Error:** `"Subscribe to this campaign to access assets"`

**Check:**
1. Promoter is subscribed to campaign (check `campaign_subscriptions` collection)
2. Campaign status is "active"
3. Assets have `is_active: true` in database

### Signed URLs Expire Too Quickly
**Error:** Download link says "Invalid signature"

**Fix:**
1. Server time must be synced (check `server.js` date generation)
2. Cloudinary API secret must be correct
3. Regenerate signed URL by calling download endpoint again

### File Upload Hangs
**Error:** Upload appears to freeze

**Fix:**
1. Increase timeout in client `api.js` (already set to 30s)
2. Check file size doesn't exceed 20MB
3. Check Render backend is running
4. Check Cloudinary API limits (free tier: 100MB/month)

---

## 📊 Monitoring & Analytics

### Check Cloudinary Usage
```
https://cloudinary.com → Dashboard → Media Library
Look for: "spreadfast/campaign-assets/" folder
```

### Monitor API Performance
```
Render: https://dashboard.render.com
Vercel: https://vercel.com/dashboard
```

### Database Status
```
MongoDB Atlas: https://cloud.mongodb.com
Collection: campaign_assets, campaign_subscriptions
```

---

## 🎉 You're Done!

Your SpreadFast brand asset system is now live! 🚀

### Summary of What's Available:
- ✅ Companies can upload up to 10 assets per campaign
- ✅ Promoters can download assets (only if subscribed)
- ✅ All files are stored securely on Cloudinary
- ✅ Assets automatically expire access after campaign ends
- ✅ Responsive UI works on mobile and desktop

---

## 📞 Support

If you encounter issues:
1. Check backend logs on Render
2. Check frontend logs on Vercel/browser console
3. Verify Cloudinary API credentials
4. Ensure MongoDB is accessible
5. Check file formats are accepted (JPG, PNG, MP4, PDF, MP3)

Good luck! 🎬
