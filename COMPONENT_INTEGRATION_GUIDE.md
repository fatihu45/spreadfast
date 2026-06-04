# 🔗 Component Integration Guide

## Where to Use the New Components

### 1. **BrandAssetUpload** - Company Campaign Creation/Edit Page

#### Location
`client/src/pages/CompanyDashboard.jsx` or campaign creation form

#### Import
```jsx
import BrandAssetUpload from '../components/BrandAssetUpload';
```

#### Usage
```jsx
<BrandAssetUpload 
  campaignId={campaignId}
  token={token}
  onUploadSuccess={(assets) => {
    console.log('Assets uploaded:', assets);
    // Refresh campaign or update UI
  }}
/>
```

#### Props
- `campaignId` (string) - The campaign ID
- `token` (string) - JWT auth token
- `onUploadSuccess` (function) - Callback when upload completes

#### Example in Campaign Form
```jsx
export default function CreateCampaign() {
  const [campaignId, setCampaignId] = useState(null);
  const { token } = useContext(AuthContext);

  const handleCreateCampaign = async (data) => {
    // Create campaign first...
    const response = await apiCallAuth('/api/campaigns', token, 'POST', campaignData);
    setCampaignId(response.campaign.id);
  };

  return (
    <form>
      {/* Campaign form fields */}
      
      {campaignId && (
        <BrandAssetUpload 
          campaignId={campaignId}
          token={token}
          onUploadSuccess={(assets) => console.log('Done!', assets)}
        />
      )}
      
      <button type="submit">Create Campaign</button>
    </form>
  );
}
```

---

### 2. **BrandAssets** - Promoter Campaign Detail Page

#### Location
`client/src/pages/AvailableCampaigns.jsx` or campaign detail view

#### Import
```jsx
import BrandAssets from '../components/BrandAssets';
```

#### Usage
```jsx
<BrandAssets 
  campaignId={campaign.id}
  token={token}
  campaignStatus={campaign.status}
  isSubscribed={userIsSubscribedToCampaign}
/>
```

#### Props
- `campaignId` (string) - The campaign ID
- `token` (string) - JWT auth token
- `campaignStatus` (string) - Campaign status ('active', 'closed', 'paused')
- `isSubscribed` (boolean) - Whether promoter is subscribed

#### Example in Campaign Detail Page
```jsx
export default function CampaignDetail() {
  const { campaignId } = useParams();
  const { token, user } = useContext(AuthContext);
  const [campaign, setCampaign] = useState(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    // Fetch campaign
    // Check if user is subscribed
  }, [campaignId]);

  return (
    <div>
      <h1>{campaign?.title}</h1>
      <p>{campaign?.description}</p>

      {/* Brand Assets Section */}
      <BrandAssets 
        campaignId={campaignId}
        token={token}
        campaignStatus={campaign?.status}
        isSubscribed={isSubscribed}
      />

      {/* Other campaign info */}
    </div>
  );
}
```

---

## 🔄 Data Flow

### Upload Flow (Company)
```
1. User opens campaign creation form
2. CampaignForm created → campaignId generated
3. BrandAssetUpload rendered with campaignId
4. User drags files → handleDrop() called
5. handleFilesSelect() validates files
6. User clicks "Upload Files"
7. FormData sent to POST /api/campaigns/{id}/assets/upload
8. Backend uploads to Cloudinary → Saves metadata to DB
9. Assets returned → Display in grid
10. onUploadSuccess callback fires
```

### Download Flow (Promoter)
```
1. User opens campaign detail page
2. BrandAssets component loads
3. GET /api/campaigns/{id}/assets checks subscription
4. Asset grid displayed (locked if not subscribed)
5. User clicks download
6. GET /api/campaigns/{id}/assets/{assetId}/download
7. Server generates signed URL (24h expiry)
8. Frontend triggers browser download
9. File downloads with original name
```

---

## 📝 Complete Integration Example

### Campaign Detail Page (Full Example)
```jsx
import React, { useState, useEffect, useContext } from 'react';
import { useParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { apiCallAuth } from '../utils/api';
import BrandAssets from '../components/BrandAssets';

export default function CampaignDetail() {
  const { campaignId } = useParams();
  const { token, user } = useContext(AuthContext);
  const [campaign, setCampaign] = useState(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCampaignAndSubscription();
  }, [campaignId, token]);

  const fetchCampaignAndSubscription = async () => {
    try {
      setLoading(true);

      // Fetch campaign
      const campaignRes = await apiCallAuth(
        `/api/campaigns/${campaignId}`,
        token
      );
      setCampaign(campaignRes.campaign);

      // Check if subscribed (you'll need to add this endpoint or check locally)
      const subscribed = campaignRes.campaign?.subscribedPromoters?.includes(user?.id);
      setIsSubscribed(subscribed);
    } catch (error) {
      console.error('Failed to load campaign:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!campaign) return <div>Campaign not found</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Campaign Header */}
      <h1 className="text-3xl font-bold text-gray-800 mb-4">{campaign.title}</h1>
      <p className="text-gray-600 mb-8">{campaign.description}</p>

      {/* Campaign Status */}
      <div className="bg-gray-100 p-4 rounded-lg mb-8">
        <p>
          <strong>Status:</strong> {campaign.status}
        </p>
        <p>
          <strong>Budget:</strong> ₦{campaign.budget}
        </p>
      </div>

      {/* Subscribe Button */}
      {!isSubscribed && campaign.status === 'active' && (
        <button
          onClick={() => handleSubscribe()}
          className="bg-green-600 text-white px-6 py-3 rounded-lg mb-8"
        >
          Subscribe to Campaign
        </button>
      )}

      {/* Brand Assets Section */}
      <BrandAssets
        campaignId={campaignId}
        token={token}
        campaignStatus={campaign.status}
        isSubscribed={isSubscribed}
      />
    </div>
  );
}
```

---

## ✅ Checklist Before Going Live

- [ ] BrandAssetUpload component added to campaign creation page
- [ ] BrandAssets component added to campaign detail page
- [ ] Both components import their dependencies
- [ ] Token is passed to both components
- [ ] campaignId is correctly passed
- [ ] isSubscribed state is correctly calculated
- [ ] Tested upload with valid files (JPG, PNG, MP4, PDF, MP3)
- [ ] Tested download as subscribed promoter
- [ ] Tested locked assets view for non-subscribers
- [ ] Tested expired campaign (no download buttons)
- [ ] Tested with empty assets (shows "No assets provided")
- [ ] API endpoints are working on backend
- [ ] Cloudinary credentials are set on Render
- [ ] MongoDB collections created (campaign_assets, campaign_subscriptions)

---

## 🐛 Common Issues

### Assets not showing after upload
- Check MongoDB: `db.campaign_assets.find({campaign_id: "YOUR_ID"})`
- Verify Cloudinary upload: Check `cloud.cloudinary.com` media library
- Check browser console for API errors

### Download button not working
- Verify promoter is subscribed: Check `campaign_subscriptions` collection
- Verify campaign status is "active"
- Check Cloudinary API secret is correct
- Verify signed URL timeout settings

### Upload fails silently
- Check backend logs on Render
- Verify file size < 20MB
- Verify file format is accepted
- Check Cloudinary API limits

---

## 🔗 Related Files

- Backend: `server/server.js` (lines 1630+)
- Models: `server/models/CampaignAsset.js`, `server/models/CampaignSubscription.js`
- Components: `client/src/components/BrandAssetUpload.jsx`, `BrandAssets.jsx`
- API Helper: `client/src/utils/api.js` (updated for FormData)
- Deployment: `CLOUDINARY_DEPLOYMENT_GUIDE.md`
