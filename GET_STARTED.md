# 🚀 GET STARTED IN 5 MINUTES

## Quick Start Guide

### Prerequisites
- Node.js installed ([Download here](https://nodejs.org))
- A terminal/command prompt
- A web browser

### Step 1: Start Backend (Terminal Window 1)

```powershell
cd c:\Users\DELL E7440\Desktop\spreadfast\server
npm install
npm start
```

Expected output:
```
✅ Server running at http://localhost:5000
```

**Keep this terminal open!**

---

### Step 2: Start Frontend (Terminal Window 2)

Open a **new** terminal window and run:

```powershell
cd c:\Users\DELL E7440\Desktop\spreadfast\client
npm install
npm start
```

This will automatically open your browser to:
```
http://localhost:3000
```

**That's it! 🎉**

---

## 🧪 Quick Test

### Test 1: Create a Campaign (30 seconds)
1. Click **"Create Campaign"** in navbar
2. Fill in:
   - Name: `Test Campaign`
   - Description: `This is a test`
   - Image URL: Leave blank (will use placeholder)
   - Caption: `Check this out!`
   - Platform: `Instagram`
   - Budget: `100`
   - Duration: `7 days`
3. Click **"Create Campaign"**
4. ✅ You should see: `✅ Campaign created successfully!`

### Test 2: View Campaign (20 seconds)
1. Click **"Campaigns"** in navbar
2. ✅ You should see your campaign card with all details

### Test 3: Join as Promoter (30 seconds)
1. Click **"Join as Promoter"** in navbar
2. Fill in:
   - Name: `Your Name`
   - Email: `your@email.com`
   - Phone: `+1234567890`
   - Instagram: `@yourhandle` (optional)
3. Click **"Join as Promoter"**
4. ✅ You should see: `✅ You have been registered successfully!`

### Test 4: Submit Proof (40 seconds)
1. Go to **"Campaigns"** page
2. Click **"Participate"** on your campaign
3. Fill in:
   - Your Name: `Your Name`
   - Platform: `Instagram`
   - Screenshot URL: Leave blank (optional)
   - Post Link: `https://instagram.com/p/test123`
4. Click **"Submit Proof"**
5. ✅ You should see: `✅ Submission successful!`

### Test 5: Admin Approval (30 seconds)
1. Click **"Admin"** in navbar
2. Click on **"Submissions"** tab
3. ✅ You should see your submission with status `Pending`
4. Click **"✅ Approve"** button
5. ✅ Status should change to `Approved` (green)

---

## 📱 What's Working

✅ Landing page
✅ Create campaigns
✅ Browse campaigns
✅ Join as promoter
✅ Submit proof
✅ Admin dashboard
✅ Approve/reject submissions
✅ Data persistence (saved to JSON files)
✅ Navigation between pages
✅ Mobile responsive design

---

## 🐛 Troubleshooting

### Backend won't start on port 5000
```powershell
# Port already in use? Use a different port:
# Edit server.js and change "const PORT = 5000" to "const PORT = 5001"
```

### Frontend won't start
```powershell
# Try clearing npm cache and reinstalling
cd client
npm cache clean --force
rm -r node_modules package-lock.json
npm install
npm start
```

### CORS error in browser console
```
Make sure:
1. Backend is running on http://localhost:5000
2. Frontend is running on http://localhost:3000
3. Both servers are running simultaneously
```

### "Cannot find module" error
```powershell
# Run npm install again
cd [server or client]
npm install
```

---

## 📁 Important Files

| File | Purpose |
|------|---------|
| `client/src/App.jsx` | Frontend routes |
| `server/server.js` | Backend API |
| `client/src/utils/api.js` | API calls |
| `server/data/*.json` | Data storage |

---

## 🔗 All Routes

| URL | What It Does |
|-----|-------------|
| `/` | Landing page |
| `/company` | Create campaigns |
| `/signup` | Join as promoter |
| `/campaigns` | Browse campaigns |
| `/submit` | Submit proof of posting |
| `/admin` | Admin approval panel |

---

## 💾 Your Data Locations

All your data is stored here:
- Campaigns: `server/data/campaigns.json`
- Users: `server/data/users.json`
- Submissions: `server/data/submissions.json`

You can open these files to see your data!

---

## 🎨 Customize Colors

Don't like the green? Edit:
```
File: client/tailwind.config.js

Change:
colors: {
  primary: "#1B5E20",  // ← Change this to your color
}

Example colors:
#3B82F6 = Blue
#EC4899 = Pink
#F59E0B = Orange
#8B5CF6 = Purple
```

Then restart frontend (`npm start`)

---

## ✨ Features Explained

### 1️⃣ Landing Page (/)
The home page with:
- Company description
- "How It Works" guide
- Feature highlights
- Buttons to get started

### 2️⃣ Create Campaign (/company)
Businesses create ad campaigns here with:
- Campaign name
- Description
- Image
- Caption text
- Target platform (Instagram, TikTok, X, WhatsApp)
- Budget
- Duration

### 3️⃣ Join as Promoter (/signup)
Users (promoters) register here with:
- Name
- Email
- Phone
- Social media handles (Instagram, TikTok, X)

### 4️⃣ Browse Campaigns (/campaigns)
See all available campaigns:
- Campaign cards
- Campaign details
- "Participate" button

### 5️⃣ Submit Proof (/submit)
Promoters submit proof of posting:
- Campaign ID (auto-filled)
- Your name
- Platform used
- Screenshot of post
- Link to actual post

### 6️⃣ Admin Panel (/admin)
Approve or reject submissions:
- View all submissions
- View all campaigns
- Approve submissions
- Reject submissions
- Track status

---

## 🚨 Before You Close

### Keep These Running
✅ Terminal 1: Backend server (`npm start` in server folder)
✅ Terminal 2: Frontend app (`npm start` in client folder)

### Do NOT Close
- Don't close either terminal while developing
- Stopping either server will break the app

### To Properly Stop
1. Press `CTRL + C` in each terminal
2. Close the terminals

### To Restart
1. Open two terminals
2. Follow "Step 1" and "Step 2" again

---

## 📚 More Documentation

Want to learn more?
- **Setup Guide**: See `SETUP.md` (50+ pages!)
- **Quick Reference**: See `QUICK_REFERENCE.md`
- **Architecture**: See `ARCHITECTURE.md`
- **Development**: See `DEVELOPMENT.md`

---

## ✅ You're All Set!

Everything is ready to use. The app is fully functional and fully documented.

Start the servers, open the app, and enjoy! 🎉

---

**Questions?** Check the documentation files - they have detailed answers to common questions.

**Something broken?** See Troubleshooting section above.

**Ready to build?** Follow the "Custom" section in DEVELOPMENT.md!

Happy coding! 🚀💚
