# SpreadFast - Complete Setup & Testing Guide

## 🎯 Overview

SpreadFast is a full-stack MVP web application built with:
- **Frontend**: React 18 + TailwindCSS
- **Backend**: Node.js + Express
- **Storage**: JSON file-based (no database required)

All features are fully functional and ready to use!

## 📁 Project Structure Created

```
c:\Users\DELL E7440\Desktop\spreadfast\
├── client/                          # React Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx          # Navigation component
│   │   │   └── Footer.jsx          # Footer component
│   │   ├── pages/
│   │   │   ├── Landing.jsx         # Landing/Home page
│   │   │   ├── CompanyDashboard.jsx # Create campaigns
│   │   │   ├── PromoteSignup.jsx   # Promoter registration
│   │   │   ├── Campaigns.jsx       # Browse campaigns
│   │   │   ├── SubmitProof.jsx     # Submit proof of posting
│   │   │   └── AdminDashboard.jsx  # Admin panel
│   │   ├── utils/
│   │   │   └── api.js              # API calls to backend
│   │   ├── App.jsx                 # Main app component
│   │   ├── index.js                # React entry point
│   │   └── index.css               # Global styles
│   ├── public/
│   │   └── index.html              # HTML template
│   ├── package.json                # Dependencies
│   ├── tailwind.config.js          # TailwindCSS config
│   └── postcss.config.js           # PostCSS config
│
├── server/                         # Node.js Backend
│   ├── server.js                   # Express server & all routes
│   ├── data/
│   │   ├── campaigns.json          # Campaigns storage
│   │   ├── users.json              # Users storage
│   │   └── submissions.json        # Submissions storage
│   ├── package.json                # Dependencies
│   └── models/routes/controllers/  # Folder structure (optional)
│
├── package.json                    # Root package.json
├── README.md                       # Project overview
├── DEVELOPMENT.md                  # Dev guide
├── SETUP.md                        # This file
├── .gitignore                      # Git ignore rules
└── .env.example                    # Environment variables template

```

## 🚀 Quick Start (5 Minutes)

### Step 1: Install Backend Dependencies
```powershell
cd c:\Users\DELL E7440\Desktop\spreadfast\server
npm install
```

### Step 2: Start Backend Server
```powershell
cd c:\Users\DELL E7440\Desktop\spreadfast\server
npm start
```
✅ Server should be running on **http://localhost:5000**
You should see: `✅ Server running at http://localhost:5000`

### Step 3: Install Frontend Dependencies (New Terminal)
```powershell
cd c:\Users\DELL E7440\Desktop\spreadfast\client
npm install
```

### Step 4: Start Frontend Development Server
```powershell
cd c:\Users\DELL E7440\Desktop\spreadfast\client
npm start
```
✅ Frontend should open at **http://localhost:3000**

---

## 🧪 Complete Testing Workflow

### Test 1: Landing Page
1. **URL**: http://localhost:3000/
2. **Expected**: 
   - Logo "SpreadFast" in top left
   - Headline: "Get real customers through real people"
   - "How It Works" section with 3 steps
   - "Why Choose SpreadFast?" section
   - Buttons to create campaign and join as promoter
   - Green color theme throughout

### Test 2: Create Campaign (Company Dashboard)
1. **URL**: http://localhost:3000/company
2. **Fill Form**:
   - Campaign Name: "Summer Sale 2024"
   - Description: "Promote our summer collection"
   - Image URL: "https://via.placeholder.com/300x200?text=Summer+Sale"
   - Caption: "Check out our amazing summer collection! Use code SUMMER20 for 20% off 🌞"
   - Platform: "Instagram"
   - Budget: "500"
   - Duration: "7 days"
3. **Expected**:
   - Green success message: "✅ Campaign created successfully!"
   - Form clears
   - Data saved to `server/data/campaigns.json`

### Test 3: Join as Promoter (Signup)
1. **URL**: http://localhost:3000/signup
2. **Fill Form**:
   - Full Name: "John Doe"
   - Email: "john@example.com"
   - Phone: "+1234567890"
   - Instagram: "@johndoe"
   - TikTok: "@johndoe"
   - X (Twitter): "@johndoe"
3. **Expected**:
   - Green success message: "✅ You have been registered successfully!"
   - Form clears
   - Data saved to `server/data/users.json`

### Test 4: View Campaigns (Marketplace)
1. **URL**: http://localhost:3000/campaigns
2. **Expected**:
   - Shows "Summer Sale 2024" campaign card
   - Displays image, name, description, caption
   - Shows platform, budget, duration
   - "Participate" button on each card
   - Cards are responsive

### Test 5: Submit Proof
1. **URL**: http://localhost:3000/campaigns
2. **Click "Participate"** on campaign
   - Auto-filled with campaign ID
3. **Fill Form**:
   - Your Name: "John Doe"
   - Platform: "Instagram"
   - Screenshot URL: "https://via.placeholder.com/400x600?text=Post+Screenshot"
   - Post Link: "https://instagram.com/p/ABC123XYZ"
4. **Expected**:
   - Green success message: "✅ Submission successful!"
   - Data saved to `server/data/submissions.json`

### Test 6: Admin Dashboard
1. **URL**: http://localhost:3000/admin
2. **Submissions Tab**:
   - Shows your submission
   - Status: "Pending" (yellow)
   - Shows promoter name, platform, post link
   - Shows screenshot link
   - Two buttons: ✅ Approve and ❌ Reject
3. **Click "Approve"**:
   - Status changes to "Approved" (green)
   - Buttons disappear
4. **Campaigns Tab**:
   - Shows "Summer Sale 2024" campaign
   - Displays all campaign details

---

## 🔗 API Endpoints Reference

### Test via Browser or Postman

#### Get All Campaigns
```
GET http://localhost:5000/api/campaigns
```
Response:
```json
[
  {
    "id": "uuid",
    "name": "Summer Sale 2024",
    "description": "...",
    "image": "...",
    "caption": "...",
    "platform": "Instagram",
    "budget": 500,
    "duration": "7 days",
    "createdAt": "2024-04-03T..."
  }
]
```

#### Create Campaign
```
POST http://localhost:5000/api/campaigns
Content-Type: application/json

{
  "name": "Summer Sale",
  "description": "Promote summer collection",
  "image": "https://...",
  "caption": "Check out our...",
  "platform": "Instagram",
  "budget": 500,
  "duration": "7 days"
}
```

#### Register User
```
POST http://localhost:5000/api/users
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "instagram": "@johndoe",
  "tiktok": "@johndoe",
  "twitter": "@johndoe"
}
```

#### Submit Proof
```
POST http://localhost:5000/api/submissions
Content-Type: application/json

{
  "campaignId": "uuid-from-campaign",
  "userName": "John Doe",
  "platform": "Instagram",
  "screenshot": "https://...",
  "postLink": "https://instagram.com/p/..."
}
```

#### Get All Submissions
```
GET http://localhost:5000/api/submissions
```

#### Approve/Reject Submission
```
PATCH http://localhost:5000/api/submissions/{id}
Content-Type: application/json

{
  "status": "Approved"  // or "Rejected" or "Pending"
}
```

---

## 🎨 Features Implemented

✅ **Landing Page**
- Hero section with headline
- 3-step "How It Works" guide
- Features section
- CTA with WhatsApp/Telegram links
- Responsive design

✅ **Company Dashboard**
- Create campaigns with all fields
- Image URL input
- Platform selection
- Budget and duration
- Form validation
- Success message

✅ **Promoter Signup**
- Register with name, email, phone
- Social media handles (optional)
- Email uniqueness check
- Form validation
- Success message

✅ **Campaign Marketplace**
- Browse all campaigns
- Campaign cards with images
- Participate button
- Responsive grid layout

✅ **Submit Proof**
- Select campaign
- Upload screenshot
- Paste post link
- Select platform
- Form validation

✅ **Admin Dashboard**
- Two tabs: Submissions & Campaigns
- View all submissions
- View submission details
- Approve/Reject buttons
- Status indicators
- View all campaigns
- Campaign details

✅ **Navigation**
- Navbar with logo and menu
- Footer with links
- Mobile responsive

---

## 💾 Data Storage

All data is stored in JSON files in `server/data/`:
- `campaigns.json` - All campaigns
- `users.json` - All registered promoters
- `submissions.json` - All submission proofs

Each time you create/update data, files are automatically updated.

---

## 🎨 Color Scheme

- **Primary Green**: `#1B5E20` (buttons, navbar, highlights)
- **Dark**: `#000000` (footer, text)
- **Light**: `#FFFFFF` (backgrounds)
- **Hover Effects**: Darker shades on interaction

---

## ⚙️ Tech Details

### Frontend Stack
- React 18.2.0
- React Router v6 (for navigation)
- TailwindCSS 3.2.4 (for styling)
- Axios (for API calls)

### Backend Stack
- Node.js
- Express 4.18.2 (web framework)
- CORS enabled (for frontend requests)
- UUID for unique IDs
- JSON file storage

### No External Dependencies
- No database (MongoDB, PostgreSQL)
- No authentication (no passwords stored)
- No payment system
- No email service

---

## 🔧 Troubleshooting

### Backend won't start
```
Error: EADDRINUSE :::5000
```
**Solution**: Port 5000 is already in use. Kill the process:
```powershell
netstat -ano | findstr :5000
taskkill /PID [PID] /F
```

### Frontend won't start
```
Error: Cannot find module 'tailwindcss'
```
**Solution**: Run npm install again:
```powershell
cd client
npm install
```

### API calls failing (CORS error)
**Solution**: Make sure:
1. Backend is running on http://localhost:5000
2. CORS is enabled in `server/server.js` ✅ Already configured

### Data not persisting
**Solution**: Check `server/data/` folder exists and is writable
```powershell
dir c:\Users\DELL E7440\Desktop\spreadfast\server\data\
```

---

## 📝 File Structure Summary

### Key Frontend Files
- `App.jsx` - Main app, all routes defined here
- `Navbar.jsx` - Top navigation
- `Footer.jsx` - Bottom footer
- `Landing.jsx` - Home page
- `CompanyDashboard.jsx` - Create campaigns
- `PromoteSignup.jsx` - Join as promoter
- `Campaigns.jsx` - View all campaigns
- `SubmitProof.jsx` - Submit proof
- `AdminDashboard.jsx` - Admin panel
- `api.js` - All API calls to backend

### Key Backend Files
- `server.js` - Everything! All routes, controllers, data handling in one file
- `data/campaigns.json` - Campaigns storage
- `data/users.json` - Users storage
- `data/submissions.json` - Submissions storage

---

## 🎯 Next Steps

### For Testing
1. Follow the "Complete Testing Workflow" section above
2. Create multiple campaigns
3. Register multiple promoters
4. Submit multiple proofs
5. Test approval/rejection in admin

### For Development
1. Add MongoDB for persistent database (replace JSON)
2. Add user authentication
3. Add payment integration
4. Add email notifications
5. Add analytics dashboard

### For Deployment
1. Deploy backend to Heroku/Railway
2. Deploy frontend to Vercel/Netlify
3. Update API_BASE_URL in frontend
4. Add MongoDB Atlas database

---

## 📞 Support

All code is self-contained and ready to run. If you have issues:

1. Check that both servers are running
2. Check terminal output for error messages
3. Verify port 5000 and 3000 are available
4. Clear browser cache and reload
5. Delete node_modules and reinstall if needed

---

## ✨ You're All Set!

Your SpreadFast MVP is ready to use. Start both servers and begin testing!

Happy coding! 🚀
