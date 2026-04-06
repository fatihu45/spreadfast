# SpreadFast Architecture & Flow Diagrams

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SPREADFAST MVP                           │
└─────────────────────────────────────────────────────────────────┘

┌────────────────────────────┐         ┌──────────────────────────┐
│   FRONTEND (React)         │         │   BACKEND (Node.js)      │
│   Port: 3000              │         │   Port: 5000             │
├────────────────────────────┤         ├──────────────────────────┤
│ - 6 Pages                 │   HTTP  │ - Express Server         │
│ - Navigation              │  ◄───►  │ - API Routes             │
│ - Forms                   │         │ - JSON Data Storage      │
│ - Admin Panel             │         │ - CORS Enabled          │
└────────────────────────────┘         └──────────────────────────┘
        │                                        │
        │                                        │
        └────────────────────┬───────────────────┘
                             │
                      ┌──────▼──────┐
                      │ JSON Files   │
                      ├──────────────┤
                      │ campaigns.json    │
                      │ users.json        │
                      │ submissions.json  │
                      └──────────────────┘
```

---

## 📱 User Journey

### Journey 1: Business Owner Creating Campaign

```
User lands on site
       │
       ▼
[Landing Page]
       │
       ▼
  Click "Create Campaign"
       │
       ▼
[Company Dashboard] (/company)
       │
       ├─ Fill Campaign Form
       │  - Name
       │  - Description
       │  - Image URL
       │  - Caption
       │  - Platform
       │  - Budget
       │  - Duration
       │
       ▼
    Submit Form
       │
       ▼
   API: POST /api/campaigns
       │
       ▼
   Backend saves to campaigns.json
       │
       ▼
✅ Success Message
       │
       ▼
Campaign visible in marketplace
```

### Journey 2: Promoter Joining & Participating

```
User lands on site
       │
       ▼
[Landing Page]
       │
       ▼
 Click "Join as Promoter"
       │
       ▼
[Promoter Signup] (/signup)
       │
       ├─ Fill Registration Form
       │  - Name
       │  - Email
       │  - Phone
       │  - Social Handles
       │
       ▼
    Submit Form
       │
       ▼
API: POST /api/users
       │
       ▼
Backend saves to users.json
       │
       ▼
✅ Registration Success
       │
       ▼
Click "Browse Campaigns"
       │
       ▼
[Campaign Marketplace] (/campaigns)
       │
       ├─ View all campaigns
       │  - Cards with images
       │  - Campaign details
       │
       ▼
Click "Participate" on campaign
       │
       ▼
[Submit Proof] (/submit)
       │
       ├─ Fill Submission Form
       │  - Your Name
       │  - Platform (Instagram, etc)
       │  - Screenshot URL
       │  - Post Link
       │
       ▼
    Submit Form
       │
       ▼
API: POST /api/submissions
       │
       ▼
Backend saves to submissions.json (Status: Pending)
       │
       ▼
✅ Submission Success
```

### Journey 3: Admin Reviewing Submissions

```
Go to Admin Panel
       │
       ▼
[Admin Dashboard] (/admin)
       │
       ├─ Submissions Tab
       │  - View all submissions
       │  - Status: Pending/Approved/Rejected
       │  - Promoter name
       │  - Platform
       │  - Post link
       │
       ▼
Click "View Submission"
       │
       ├─ See screenshot link
       ├─ See post link
       └─ See details
       │
       ▼
Click "Approve" OR "Reject"
       │
       ▼
API: PATCH /api/submissions/:id
       │
       ├─ Status updated in submissions.json
       │  to "Approved" or "Rejected"
       │
       ▼
✅ Update Success
       │
       ▼
Status changes in real-time
```

---

## 🔄 Data Flow Diagram

### Campaign Creation Flow

```
Frontend                Backend              Storage
─────────────────────────────────────────────────────

User fills form
       │
       ├─► Validates form
       │
       ├─► POST /api/campaigns
       │
       ├─────────────────► Receives data
       │                  │
       │                  ├─► Validates required fields
       │                  │
       │                  ├─► Generates UUID
       │                  │
       │                  ├─► Creates object
       │                  │
       │                  ├─► Adds timestamp
       │                  │
       │                  ├─────────────────► Reads campaigns.json
       │                  │
       │                  ├─────────────────► Appends new campaign
       │                  │
       │                  ├─────────────────► Writes back to file
       │                  │
       │                  ├─ Returns response
       │
       │◄─────────────────┤
       │                  │
       └─► Shows success
           message
```

### Submission Review Flow

```
Admin clicks "Approve"
       │
       ├─► Frontend sends
       │   PATCH /api/submissions/:id
       │   { status: "Approved" }
       │
       ├─────────────────► Backend receives
       │                  │
       │                  ├─► Validates status
       │                  │
       │                  ├─► Reads submissions.json
       │                  │
       │                  ├─► Finds submission by ID
       │                  │
       │                  ├─► Updates status field
       │                  │
       │                  ├─► Writes back to file
       │                  │
       │                  ├─ Returns updated submission
       │
       │◄─────────────────┤
       │                  │
       └─► Status changes
           from "Pending"
           to "Approved"
           on screen
```

---

## 📊 Component Hierarchy

```
App
│
├── Navbar
│   ├── Logo (Link to /)
│   ├── Links to all pages
│   │   ├── Home (/)
│   │   ├── Campaigns (/campaigns)
│   │   ├── Create Campaign (/company)
│   │   ├── Join as Promoter (/signup)
│   │   └── Admin (/admin)
│   │
│   └── Routes
│       ├── Route to Landing
│       ├── Route to Company Dashboard
│       ├── Route to Promoter Signup
│       ├── Route to Campaigns Marketplace
│       ├── Route to Submit Proof
│       └── Route to Admin Dashboard
│
├── [Current Page Component]
│   └── Page-specific content
│
└── Footer
    ├── Links
    └── Contact info
```

---

## 📈 Database Schema (JSON Structure)

### campaigns.json
```
[
  {
    "id": "uuid-1",
    "name": "Summer Sale 2024",
    "description": "...",
    "image": "...",
    "caption": "...",
    "platform": "Instagram",
    "budget": 500,
    "duration": "7 days",
    "createdAt": "2024-04-03T10:30:00Z"
  },
  {
    "id": "uuid-2",
    "name": "Black Friday Deal",
    ...
  }
]
```

### users.json
```
[
  {
    "id": "uuid-1",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "instagram": "@johndoe",
    "tiktok": "@johndoe",
    "twitter": "@johndoe",
    "createdAt": "2024-04-03T10:30:00Z"
  },
  ...
]
```

### submissions.json
```
[
  {
    "id": "uuid-1",
    "campaignId": "campaign-uuid-1",
    "userName": "John Doe",
    "platform": "Instagram",
    "screenshot": "https://...",
    "postLink": "https://instagram.com/p/ABC123",
    "status": "Pending",
    "createdAt": "2024-04-03T10:30:00Z"
  },
  {
    "id": "uuid-2",
    "campaignId": "campaign-uuid-1",
    "userName": "Jane Smith",
    "platform": "TikTok",
    "screenshot": "https://...",
    "postLink": "https://tiktok.com/@jane/video/123",
    "status": "Approved",
    "createdAt": "2024-04-03T11:00:00Z"
  },
  ...
]
```

---

## 🔗 API Request/Response Flow

### GET /api/campaigns
```
Request:
GET /api/campaigns

Response:
200 OK
{
  "data": [
    { id, name, description, ... },
    { id, name, description, ... },
    ...
  ]
}
```

### POST /api/campaigns
```
Request:
POST /api/campaigns
{
  "name": "Campaign Name",
  "description": "...",
  "image": "...",
  "caption": "...",
  "platform": "Instagram",
  "budget": 500,
  "duration": "7 days"
}

Response:
201 Created
{
  "message": "Campaign created successfully",
  "campaign": {
    "id": "new-uuid",
    "name": "Campaign Name",
    ...
    "createdAt": "2024-04-03T10:30:00Z"
  }
}
```

### PATCH /api/submissions/:id
```
Request:
PATCH /api/submissions/submission-uuid-123
{
  "status": "Approved"
}

Response:
200 OK
{
  "message": "Submission updated successfully",
  "submission": {
    "id": "submission-uuid-123",
    "campaignId": "...",
    "userName": "...",
    "platform": "Instagram",
    "screenshot": "...",
    "postLink": "...",
    "status": "Approved",
    "createdAt": "..."
  }
}
```

---

## 🎨 Component Dependency Tree

```
App (Main component)
│
├── Navbar
│   └── Uses: React Router Link
│
├── Routes (React Router)
│   │
│   ├── Landing Page
│   │   └── Uses: Navbar, Footer, Links
│   │
│   ├── Company Dashboard
│   │   ├── Uses: useState, api.createCampaign
│   │   └── Shows: Form, success/error messages
│   │
│   ├── Promoter Signup
│   │   ├── Uses: useState, api.registerUser
│   │   └── Shows: Form, success/error messages
│   │
│   ├── Campaigns Marketplace
│   │   ├── Uses: useEffect, api.getCampaigns
│   │   └── Shows: Campaign cards, Participate button
│   │
│   ├── Submit Proof
│   │   ├── Uses: useState, useSearchParams, api.createSubmission
│   │   └── Shows: Form, campaign ID auto-filled
│   │
│   └── Admin Dashboard
│       ├── Uses: useEffect, useState, api.getSubmissions, api.getCampaigns
│       ├── Uses: api.updateSubmission
│       └── Shows: Tabs for submissions/campaigns, approve/reject buttons
│
└── Footer
    └── Uses: External links
```

---

## 📋 Page Routing Map

```
URL Path          Component                  Features
────────────────────────────────────────────────────────────────
/                 Landing.jsx               • Hero section
                                             • How it works
                                             • Features
                                             • CTAs to signup/create

/company          CompanyDashboard.jsx      • Create campaign form
                                             • Form validation
                                             • Success messages
                                             • API: POST /campaigns

/signup           PromoteSignup.jsx         • User registration form
                                             • Email validation
                                             • Social handles
                                             • API: POST /users

/campaigns        Campaigns.jsx             • List all campaigns
                                             • Campaign cards
                                             • Participate buttons
                                             • API: GET /campaigns

/submit           SubmitProof.jsx           • Submit proof form
                                             • Campaign ID auto-fill
                                             • Screenshot & link
                                             • API: POST /submissions

/admin            AdminDashboard.jsx        • Two tabs view
                                             • Submissions tab
                                             • Campaigns tab
                                             • Approve/reject
                                             • API: GET + PATCH
```

---

## 🚀 Request Lifecycle

```
1. User Action (Click button, submit form)
   │
   └─► Event Handler triggered
       │
       └─► Validation (check required fields)
           │
           └─► API Call (axios.post/get/patch)
               │
               ├─► Network Request sent to backend
               │
               ├─► Backend receives request
               │   │
               │   ├─► Parse request body
               │   ├─► Validate data
               │   ├─► Read JSON file
               │   ├─► Modify data (add/update)
               │   ├─► Write JSON file
               │   └─► Return response
               │
               ├─► Frontend receives response
               │   │
               │   ├─► Check for errors
               │   ├─► Update state (setState)
               │   ├─► Re-render component
               │   └─► Show message to user
               │
               └─► User sees result
```

---

## 🎯 State Management Flow

```
Component State Updates:
────────────────────────

CompanyDashboard Component:
├── formData (form inputs)
├── loading (submission state)
├── message (success message)
├── error (error message)
│
├─ handleChange()
│  └─► Updates formData state
│
├─ handleSubmit()
│  ├─► Sets loading = true
│  ├─► Calls API
│  ├─► Updates message/error
│  └─► Sets loading = false
│
└─ Re-renders with new state
```

---

## 🔐 Data Validation Flow

```
Form Submission
       │
       ├─► Client-side validation
       │   ├─ required field check
       │   ├─ format check (email, url)
       │   └─ length check
       │
       ├─► If invalid: Show error, stop
       │
       ├─► If valid: Send to API
       │
       ├─────────► Backend receives
       │           │
       │           ├─► Server-side validation
       │           │   ├─ required field check
       │           │   ├─ data type check
       │           │   └─ business logic check
       │           │
       │           ├─► If invalid: Return 400
       │           │
       │           ├─► If valid: Process request
       │           │
       │           └─ Return 201/200
       │
       └─► Frontend shows result
```

---

## 💾 File I/O Flow

```
Backend Data Operations
────────────────────────

Read Operation:
  readFile(filepath)
  └─► fs.readFileSync()
      └─► JSON.parse()
          └─► Returns array

Write Operation:
  writeFile(filepath, data)
  └─► JSON.stringify(data)
      └─► fs.writeFileSync()
          └─► File updated

Example:
  GET /api/campaigns
  └─► readFile(campaignsFile)
      └─► Return data to frontend
```

---

## 🌐 CORS & Network Flow

```
Frontend (3000)          CORS Enabled          Backend (5000)
─────────────────────────────────────────────────────────────

axios.post()
    │
    └─► Browser sends
        GET /api/campaigns to :5000
        │
        ├─ Origin: http://localhost:3000
        │
        ├─► Backend receives
        │   │
        │   ├─► Checks CORS headers
        │   ├─► Allows cross-origin (enabled)
        │   │
        │   └─► Processes request
        │       └─► readFile
        │           └─► JSON.parse
        │
        ├─► Sends response back
        │   ├─ Status: 200
        │   ├─ CORS headers included
        │   └─ JSON data
        │
        └─► Frontend receives
            ├─ CORS validation passed
            ├─ setState(data)
            └─ Re-render component
```

---

That's the complete architecture! All systems are connected and working. 🚀
