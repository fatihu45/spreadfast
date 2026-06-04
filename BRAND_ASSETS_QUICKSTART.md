# ⚡ Quick Start - Brand Asset Implementation

## 📋 Summary

You now have a complete brand asset upload system with Cloudinary! Here's what was added:

### Backend
- ✅ Cloudinary integration (dfrffeugj account)
- ✅ 4 API endpoints for asset management
- ✅ MongoDB schemas for assets & subscriptions
- ✅ Signed URL generation (24-hour expiry)
- ✅ Access control & validation

### Frontend
- ✅ `BrandAssetUpload.jsx` - Drag-drop upload component
- ✅ `BrandAssets.jsx` - Asset grid with preview/download
- ✅ Updated `api.js` - FormData support for uploads
- ✅ Responsive design (mobile + desktop)

---

## 🚀 Implementation Steps (5 minutes)

### Step 1: Verify Files Are Created
```bash
# Check these files exist:
server/models/CampaignAsset.js
server/models/CampaignSubscription.js
client/src/components/BrandAssetUpload.jsx
client/src/components/BrandAssets.jsx
```

### Step 2: Check Backend Is Updated
```bash
# Verify server.js has:
# - cloudinary import at top
# - Cloudinary config section
# - New API endpoints before START SERVER comment
# - CampaignAsset & CampaignSubscription models

grep -n "cloudinary" server/server.js
grep -n "/api/campaigns.*assets" server/server.js
```

### Step 3: Update Campaign Creation Page
Find your campaign creation form and add:

```jsx
// Add import at top
import BrandAssetUpload from '../components/BrandAssetUpload';

// Inside form, after campaign is created:
{campaignId && (
  <BrandAssetUpload 
    campaignId={campaignId}
    token={token}
    onUploadSuccess={() => console.log('Upload success!')}
  />
)}
```

### Step 4: Update Campaign Detail Page
Find where you show campaign details to promoters and add:

```jsx
// Add import at top
import BrandAssets from '../components/BrandAssets';

// Inside campaign detail view:
<BrandAssets 
  campaignId={campaign.id}
  token={token}
  campaignStatus={campaign.status}
  isSubscribed={isUserSubscribed}
/>
```

### Step 5: Test Locally
```bash
# Terminal 1: Backend
cd server
npm install  # Just to be safe
npm start

# Terminal 2: Frontend
cd client
npm start

# Visit http://localhost:3000
```

---

## 🧪 Testing Checklist

### Company Tests
- [ ] Login as company
- [ ] Create campaign → See "Brand Assets" section
- [ ] Drag a JPG/PNG/MP4/PDF file → Verify validation
- [ ] Upload file → See it in grid
- [ ] Remove file → Confirm deletion
- [ ] Try uploading >20MB file → See error

### Promoter Tests
- [ ] Login as promoter
- [ ] Browse campaigns
- [ ] Find campaign with assets
- [ ] Click subscribe (if not already)
- [ ] View campaign → See "Brand Assets" section
- [ ] Download asset → File downloads
- [ ] Try downloading as non-subscriber → See lock icon

### Edge Cases
- [ ] Campaign with no assets → "No assets provided" message
- [ ] Non-subscribed promoter → "🔒 Subscribe to access" message
- [ ] Closed campaign → "Campaign has ended" message
- [ ] Try uploading 11 files → See "Max 10" error

---

## 🔧 Configuration

### Cloudinary Credentials
Already set in `server/.env`:
```
CLOUDINARY_CLOUD_NAME=dfrffeugj
CLOUDINARY_API_KEY=321965639866157
CLOUDINARY_API_SECRET=b4p6EFnYbBLtF34jDZ7FrC1PPB8
```

### File Limits
- Max 10 files per campaign
- Max 20MB per file
- Formats: JPG, PNG, MP4, PDF, MP3

### Signed URL Expiry
- 24 hours (set in backend)
- After expiry, promoter must request new URL

---

## 📊 Database Collections

### campaign_assets
```javascript
{
  campaign_id: "campaign123",
  company_id: "user456",
  file_name: "product-image.png",
  file_type: "image",  // image | video | pdf | audio
  file_size: 512,  // in KB
  cloudinary_public_id: "spreadfast/campaign-assets/...",
  cloudinary_url: "https://res.cloudinary.com/...",
  is_active: true,
  uploaded_at: "2026-05-25T10:30:00Z"
}
```

### campaign_subscriptions
```javascript
{
  promoter_id: "promoter789",
  campaign_id: "campaign123",
  status: "active",  // active | completed | cancelled
  joined_at: "2026-05-25T10:00:00Z"
}
```

---

## 🌐 Deployment (When Ready)

### 1. Push to GitHub
```bash
git add .
git commit -m "feat: Add Cloudinary brand asset system"
git push origin main
```

### 2. Render Backend
- Environment vars already set above
- Redeploy: `git push` triggers automatic deploy

### 3. Vercel Frontend
- Update `REACT_APP_API_URL` to your Render URL
- Push to GitHub
- Vercel auto-deploys

---

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| `Cloudinary is undefined` | Restart backend: `npm start` |
| Upload hangs | Check file size < 20MB |
| Can't download | Verify subscription in DB |
| Assets don't show | Check MongoDB collections exist |
| CORS errors | Verify backend CORS headers |

---

## 📚 Full Documentation

- **API Reference**: See `/api/campaigns/{id}/assets/*` endpoints in server.js
- **Component Props**: See component files for JSDoc comments
- **Deployment**: See `CLOUDINARY_DEPLOYMENT_GUIDE.md`
- **Integration**: See `COMPONENT_INTEGRATION_GUIDE.md`

---

## ✅ You're Ready!

All components are in place. Now just:
1. Integrate components into your pages
2. Test locally
3. Deploy to production
4. Monitor Cloudinary usage

**Questions?** Check the deployment guide or component integration guide.

Good luck! 🎉
