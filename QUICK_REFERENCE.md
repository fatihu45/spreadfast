# SpreadFast - Quick Reference Card

## 🚀 Start the App (30 seconds)

### Terminal 1 - Backend
```powershell
cd c:\Users\DELL E7440\Desktop\spreadfast\server
npm install
npm start
```
✅ Running on: http://localhost:5000

### Terminal 2 - Frontend
```powershell
cd c:\Users\DELL E7440\Desktop\spreadfast\client
npm install
npm start
```
✅ Running on: http://localhost:3000

---

## 🗺️ App Routes

| Route | Purpose | Component |
|-------|---------|-----------|
| `/` | Landing page with hero | `Landing.jsx` |
| `/company` | Create campaign form | `CompanyDashboard.jsx` |
| `/signup` | Promoter registration | `PromoteSignup.jsx` |
| `/campaigns` | Browse all campaigns | `Campaigns.jsx` |
| `/submit` | Submit proof of posting | `SubmitProof.jsx` |
| `/admin` | Approve/reject submissions | `AdminDashboard.jsx` |

---

## 📊 Data Models

### Campaign
```javascript
{
  id: "uuid",
  name: "string",
  description: "string",
  image: "url",
  caption: "string",
  platform: "Instagram|TikTok|X|WhatsApp",
  budget: number,
  duration: "string",
  createdAt: "ISO date"
}
```

### User (Promoter)
```javascript
{
  id: "uuid",
  name: "string",
  email: "string",
  phone: "string",
  instagram: "string",
  tiktok: "string",
  twitter: "string",
  createdAt: "ISO date"
}
```

### Submission
```javascript
{
  id: "uuid",
  campaignId: "uuid",
  userName: "string",
  platform: "Instagram|TikTok|X|WhatsApp",
  screenshot: "url",
  postLink: "url",
  status: "Pending|Approved|Rejected",
  createdAt: "ISO date"
}
```

---

## 🔌 API Endpoints

### Campaigns
```
GET  /api/campaigns              → Get all
POST /api/campaigns              → Create new
```

### Users
```
GET  /api/users                  → Get all
POST /api/users                  → Register
```

### Submissions
```
GET    /api/submissions          → Get all
POST   /api/submissions          → Create
PATCH  /api/submissions/:id      → Update status
```

---

## 🛠️ Common Tasks

### Add a New Page
1. Create `NewPage.jsx` in `client/src/pages/`
2. Add route in `client/src/App.jsx`:
   ```javascript
   <Route path="/newpage" element={<NewPage />} />
   ```
3. Link in navbar (optional)

### Add a Button to Navbar
Edit `client/src/components/Navbar.jsx`:
```javascript
<Link to="/newpage" className="hover:text-green-200 transition">New Page</Link>
```

### Create New API Endpoint
Edit `server/server.js`:
```javascript
app.post('/api/newroute', (req, res) => {
  // Handle request
  res.json({ data });
});
```

### Call API from Frontend
In component:
```javascript
import { getCampaigns } from '../utils/api';

const data = await getCampaigns();
```

---

## 🎨 TailwindCSS Classes

### Common Classes Used
```css
/* Buttons */
.btn-primary    /* Green button */
.btn-secondary  /* Gray button */

/* Cards */
.card           /* White card with shadow */

/* Layout */
.max-w-6xl      /* Max width container */
.mx-auto        /* Center container */
.px-4           /* Horizontal padding */
.py-12          /* Vertical padding */
.grid.grid-cols-1.md:grid-cols-3  /* 3-column grid */

/* Text */
.text-4xl.font-bold    /* Large heading */
.text-gray-600         /* Gray text */
.hover:text-green-200  /* Hover color */

/* Colors */
.bg-primary     /* Green background */
.text-primary   /* Green text */
.text-white     /* White text */
```

---

## 📁 Important Files

| File | Purpose |
|------|---------|
| `client/src/App.jsx` | Main app, routes defined here |
| `client/src/utils/api.js` | All API functions |
| `client/src/index.css` | Global styles |
| `server/server.js` | Everything backend (routes, handlers, data) |
| `server/data/campaigns.json` | Campaign storage |
| `server/data/users.json` | User storage |
| `server/data/submissions.json` | Submission storage |

---

## 🔑 Key Features

✅ Create campaigns with images and captions
✅ Register promoters with social media handles
✅ Browse all campaigns in marketplace
✅ Submit proof of posting (screenshot + link)
✅ Admin dashboard to approve/reject submissions
✅ Real-time data updates
✅ Responsive mobile design
✅ Green theme (primary: #1B5E20)

---

## ⚡ Performance Tips

- Data stored in JSON files (fast for MVP)
- CORS enabled for frontend requests
- No database queries (file reads/writes)
- Lightweight components
- Lazy loading not needed (few routes)

---

## 🐛 Debug Mode

### Check Backend Data
```powershell
# View campaigns
cat server\data\campaigns.json

# View users
cat server\data\users.json

# View submissions
cat server\data\submissions.json
```

### Check Browser Console
- Press `F12` to open DevTools
- Go to Console tab
- Watch API calls in Network tab

### Check Server Logs
- Terminal running `npm start` in server folder
- Should show request logs and any errors

---

## 📦 Dependencies

### Backend
- express: Web framework
- cors: Cross-origin requests
- body-parser: Parse JSON
- uuid: Generate unique IDs

### Frontend
- react: UI framework
- react-router-dom: Navigation
- tailwindcss: Styling
- axios: HTTP client

All already installed and configured! ✅

---

## 🚀 Ready to Build?

1. Backend running on :5000? ✓
2. Frontend running on :3000? ✓
3. See landing page? ✓
4. Try creating a campaign? ✓
5. View in admin? ✓

If all yes → You're ready to start building! 🎉
