# 🔐 Auth & Payment - Quick Implementation Steps

## What You're Adding

✅ User Login/Signup  
✅ Password security (bcryptjs)  
✅ JWT tokens for sessions  
✅ Stripe payment on campaign creation  
✅ Admin-only dashboard  
✅ Promoter wallet system  
✅ Withdrawal management  

---

## QUICK START (Follow in Order)

### PHASE 1: Backend Setup (20 minutes)

#### Step 1: Install Backend Packages
```powershell
cd c:\Users\DELL E7440\Desktop\spreadfast\server
npm install bcryptjs jsonwebtoken dotenv stripe
```

#### Step 2: Create .env File
Create `server/.env`:
```
PORT=5000
NODE_ENV=development
JWT_SECRET=your-secret-key-here-change-in-production
CORS_ORIGIN=http://localhost:3000
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_PUBLIC_KEY=pk_test_your_key_here
ADMIN_EMAIL=youremail@example.com
```

#### Step 3: Create Folders
```powershell
mkdir server\models
mkdir server\middleware
```

#### Step 4: Create New Files
Create these 3 files in your server folder:
1. `server/models/User.js` - User model
2. `server/middleware/auth.js` - Auth middleware
3. Update `server/server.js` - Add all auth routes

**Copy the code from AUTH_PAYMENT_GUIDE.md sections for each file**

#### Step 5: Test Backend

Stop and restart server:
```powershell
# In server folder
npm start
```

Should show: `✅ Server running at http://localhost:5000`

---

### PHASE 2: Frontend Setup (25 minutes)

#### Step 1: Install Frontend Packages
```powershell
cd c:\Users\DELL E7440\Desktop\spreadfast\client
npm install axios react-stripe-js @stripe/react-stripe-js @stripe/js
```

#### Step 2: Create .env File
Create `client/.env`:
```
REACT_APP_STRIPE_PUBLIC_KEY=pk_test_your_key
REACT_APP_ADMIN_EMAIL=youremail@example.com
```

#### Step 3: Create Context Folder
```powershell
mkdir client\src\context
```

#### Step 4: Create Auth Context
Create `client/src/context/AuthContext.js`

**Copy code from AUTH_PAYMENT_GUIDE.md Part 2 Step 6**

#### Step 5: Create Login Page
Create `client/src/pages/Login.jsx`

**Copy code from AUTH_PAYMENT_GUIDE.md Part 2 Step 7**

#### Step 6: Create Register Page
Create `client/src/pages/Register.jsx`

**Copy code from AUTH_PAYMENT_GUIDE.md Part 2 Step 7**

#### Step 7: Update Company Dashboard
Update `client/src/pages/CompanyDashboard.jsx`

**Replace with code from AUTH_PAYMENT_GUIDE.md Part 2 Step 8**

#### Step 8: Update Admin Dashboard
Update `client/src/pages/AdminDashboard.jsx`

**Replace with code from AUTH_PAYMENT_GUIDE.md Part 3 Step 9**

#### Step 9: Create Wallet Page
Create `client/src/pages/Wallet.jsx`

**Copy code from AUTH_PAYMENT_GUIDE.md Part 3 Step 11**

#### Step 10: Update App.jsx
Update `client/src/App.jsx`

**Replace with code from AUTH_PAYMENT_GUIDE.md Part 3 Step 10**

#### Step 5: Test Frontend
```powershell
# In client folder
npm start
```

Should open browser automatically at http://localhost:3000

---

### PHASE 3: Stripe Setup (5 minutes)

#### Step 1: Create Stripe Account
1. Go to https://stripe.com
2. Click "Sign up"
3. Fill in details
4. Verify email

#### Step 2: Get API Keys
1. In Stripe dashboard
2. Click "Developers" → "API Keys"
3. Under "Standard keys"
4. Copy **Publishable Key** (starts with pk_test_)
5. Copy **Secret Key** (starts with sk_test_)

#### Step 3: Add to .env Files
- `server/.env`: `STRIPE_SECRET_KEY=sk_test_...`
- `server/.env`: `STRIPE_PUBLIC_KEY=pk_test_...`
- `client/.env`: `REACT_APP_STRIPE_PUBLIC_KEY=pk_test_...`

#### Step 4: Restart Servers
```powershell
# Stop backend (Ctrl+C) and restart
npm start

# Stop frontend (Ctrl+C) and restart
npm start
```

---

### PHASE 4: Testing (15 minutes)

#### Test 1: Registration
1. Go to http://localhost:3000
2. Click "Sign Up"
3. Create account as Company or Promoter
4. Should see success message
5. Redirects to dashboard

#### Test 2: Login
1. Go to /login
2. Use the email/password you just created
3. Should log in successfully

#### Test 3: Create Campaign with Payment
1. Login as Company
2. Go to "Create Campaign"
3. Fill form and click "Proceed to Payment"
4. Use test card: `4242 4242 4242 4242`
5. Any future date, any CVC (e.g., 123)
6. Should complete payment and create campaign

#### Test 4: Admin Access
1. Login as yourself (the admin email)
2. Go to /admin
3. Should see admin dashboard
4. Can approve/reject submissions

#### Test 5: Other User Access Admin
1. Logout
2. Login as different user
3. Try to go to /admin manually
4. Should be redirected to home

---

## FILE CHANGES SUMMARY

### New Files Created:
- `server/models/User.js`
- `server/middleware/auth.js`
- `client/src/context/AuthContext.js`
- `client/src/pages/Login.jsx`
- `client/src/pages/Register.jsx`
- `client/src/pages/Wallet.jsx`
- `server/.env`
- `client/.env`

### Files Updated:
- `server/server.js` (Complete rewrite with auth routes)
- `client/src/pages/CompanyDashboard.jsx` (Add Stripe payment)
- `client/src/pages/AdminDashboard.jsx` (Add security)
- `client/src/App.jsx` (Add new routes + AuthProvider)

### Total New/Updated: 14 files

---

## Common Issues & Fixes

### Issue: "Cannot find module 'bcryptjs'"
```powershell
cd server
npm install bcryptjs jsonwebtoken
npm start
```

### Issue: "STRIPE_SECRET_KEY is undefined"
1. Check `server/.env` file exists
2. Check STRIPE_SECRET_KEY is added
3. Restart server (Ctrl+C, npm start)

### Issue: "Login button does nothing"
1. Check browser console (F12 → Console)
2. Check backend is running on :5000
3. Check CORS_ORIGIN in server/.env matches frontend

### Issue: "Cannot pay - Stripe error"
1. Check Stripe keys are correct (pk_ and sk_)
2. Make sure you used test keys (pk_test_, sk_test_)
3. Restart frontend (Ctrl+C, npm start)

### Issue: "Admin page says 'Access Denied'"
1. Check ADMIN_EMAIL in `.env` files
2. Login with that email address
3. Restart frontend
4. Go to /admin

---

##CODE STRUCTURE AFTER IMPLEMENTATION

```
server/
├── server.js           (Updated - has auth routes)
├── .env               (New)
├── models/
│   └── User.js        (New)
├── middleware/
│   └── auth.js        (New)
└── data/
    ├── users.json
    ├── campaigns.json
    ├── submissions.json
    └── withdrawals.json (New)

client/
├── src/
│   ├── App.jsx       (Updated - new routes)
│   ├── index.js
│   ├── index.css
│   ├── pages/
│   │   ├── Landing.jsx
│   │   ├── Login.jsx  (New)
│   │   ├── Register.jsx (New)
│   │   ├── CompanyDashboard.jsx (Updated - Stripe)
│   │   ├── PromoteSignup.jsx
│   │   ├── Campaigns.jsx
│   │   ├── SubmitProof.jsx
│   │   ├── AdminDashboard.jsx (Updated - secure)
│   │   └── Wallet.jsx (New)
│   ├── components/
│   │   ├── Navbar.jsx
│   │   └── Footer.jsx
│   ├── context/
│   │   └── AuthContext.js (New)
│   └── utils/
│       └── api.js
├── .env (New)
└── package.json
```

---

## VERIFICATION CHECKLIST

### After Backend Setup:
- [ ] `server/.env` file exists with all variables
- [ ] `server/models/User.js` created
- [ ] `server/middleware/auth.js` created
- [ ] `server/server.js` updated
- [ ] Backend starts without errors
- [ ] `curl http://localhost:5000/api/health` works

### After Frontend Setup:
- [ ] `client/.env` file exists
- [ ] `client/src/context/AuthContext.js` created
- [ ] `client/src/pages/Login.jsx` created
- [ ] `client/src/pages/Register.jsx` created
- [ ] `client/src/pages/Wallet.jsx` created
- [ ] `client/src/App.jsx` updated with routes
- [ ] Frontend starts without errors
- [ ] Can see login page at /login

### After Stripe Setup:
- [ ] Stripe account created
- [ ] API keys copied to .env files
- [ ] Both servers restarted
- [ ] Stripe keys are test keys (sk_test_, pk_test_)

### After Testing:
- [ ] Can register new user
- [ ] Can login with created account
- [ ] Can create campaign with payment
- [ ] Test payment goes through (use 4242...)
- [ ] Admin can only access /admin with admin email
- [ ] Promoter can see wallet page
- [ ] Promoter can add bank details
- [ ] Promoter can request withdrawal

---

## DATA FLOW AFTER IMPLEMENTATION

```
USER REGISTERS
    ↓
Creates account in users.json
Password hashed with bcryptjs
JWT token created
Stored in browser localStorage
    ↓
USER CREATES CAMPAIGN
    ↓
Payment form shows (Stripe)
User enters card details
Stripe creates PaymentIntent
Card charged $budget amount
    ↓
CAMPAIGN CREATED
    ↓
Stored in campaigns.json
Payment verified
Associated with user
    ↓
PROMOTER SUBMITS PROOF
    ↓
Stored in submissions.json
Status: "pending"
    ↓
ADMIN APPROVES SUBMISSION
    ↓
Status: "approved"
Promoter wallet credited
Money added to promoter account
    ↓
PROMOTER WITHDRAWS
    ↓
Bank details required
Withdrawal request created
Status: "pending"
Admin approves
Money marked as withdrawn
```

---

## NEXT STEPS AFTER IMPLEMENTATION

### Week 1:
- [ ] Test all features thoroughly
- [ ] Try different scenarios
- [ ] Get feedback

### Week 2:
- [ ] Deploy to production
- [ ] Use real Stripe keys
- [ ] Monitor for errors

### Week 3:
- [ ] Add email notifications
- [ ] Add password reset
- [ ] Improve UI

### Month 2:
- [ ] Add more payment options
- [ ] Improve admin dashboard
- [ ] Add analytics

---

## SUPPORT

All code is provided in `AUTH_PAYMENT_GUIDE.md`

For issues:
1. Check TROUBLESHOOTING.md
2. Check error messages in browser console (F12)
3. Check server logs
4. Re-read the relevant section of AUTH_PAYMENT_GUIDE.md

---

**Start with Phase 1 and follow each step exactly!** ✅
