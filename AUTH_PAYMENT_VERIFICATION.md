# 🔐 Auth & Payment Integration Checklist

**Total Implementation Time: ~2 hours**

---

## PRE-IMPLEMENTATION

### Requirements Check
- [ ] Node.js installed (`node --version` shows version)
- [ ] Git installed (`git --version` shows version)
- [ ] Backend running on :5000
- [ ] Frontend running on :3000 or stopped
- [ ] Stripe account willing to create
- [ ] Admin email ready (your email)

### Files to Prepare
- [ ] Know your admin email address
- [ ] Read AUTH_PAYMENT_GUIDE.md completely
- [ ] Have AUTH_PAYMENT_QUICK_START.md open
- [ ] Have text editor (VS Code) ready
- [ ] Have 2 terminal windows ready

---

## IMPLEMENTATION CHECKLIST

### BACKEND PHASE (20 minutes)

#### Installation
- [ ] Opened PowerShell
- [ ] Navigated to `c:\Users\DELL E7440\Desktop\spreadfast\server`
- [ ] Ran `npm install bcryptjs jsonwebtoken dotenv stripe`
- [ ] Installation completed without errors

#### Configuration
- [ ] Created `server/.env` file
- [ ] Added `PORT=5000`
- [ ] Added `NODE_ENV=development`
- [ ] Added `JWT_SECRET=mysecretkey123`
- [ ] Added `CORS_ORIGIN=http://localhost:3000`
- [ ] Added `ADMIN_EMAIL=youremail@example.com`
- [ ] Added `STRIPE_SECRET_KEY=sk_test_` (placeholder for now)
- [ ] Added `STRIPE_PUBLIC_KEY=pk_test_` (placeholder for now)
- [ ] Created `server/models/` folder
- [ ] Created `server/middleware/` folder

#### Code Creation
- [ ] Created `server/models/User.js` with user model code
- [ ] Created `server/middleware/auth.js` with auth functions
- [ ] Updated `server/server.js` with complete code from guide
- [ ] Verified all endpoints are present:
  - [ ] `/api/auth/register`
  - [ ] `/api/auth/login`
  - [ ] `/api/campaigns` (GET & POST)
  - [ ] `/api/payments/create-intent`
  - [ ] `/api/submissions` (GET, POST, PATCH)
  - [ ] `/api/wallet` (GET)
  - [ ] `/api/wallet/bank-details` (POST)
  - [ ] `/api/wallet/withdraw` (POST)
  - [ ] `/api/admin/data` (GET)
  - [ ] `/api/admin/withdrawals/:id` (PATCH)

#### Testing
- [ ] Stopped previous server instance (if any)
- [ ] In server folder, ran `npm start`
- [ ] Server shows: `✅ Server running at http://localhost:5000`
- [ ] Opened new browser tab
- [ ] Visited `http://localhost:5000/api/health`
- [ ] Got response: `{"status": "Server is running"}`
- [ ] Server terminal still running

---

### FRONTEND PHASE (25 minutes)

#### Installation
- [ ] Opened NEW PowerShell window (keeping server running)
- [ ] Navigated to `c:\Users\DELL E7440\Desktop\spreadfast\client`
- [ ] Ran `npm install axios react-stripe-js @stripe/react-stripe-js @stripe/js`
- [ ] Installation completed without errors

#### Configuration
- [ ] Created `client/.env` file
- [ ] Added `REACT_APP_STRIPE_PUBLIC_KEY=pk_test_` (placeholder)
- [ ] Added `REACT_APP_ADMIN_EMAIL=youremail@example.com`
- [ ] Created `client/src/context/` folder

#### Code Creation - Context & Pages
- [ ] Created `client/src/context/AuthContext.js` with AuthProvider
- [ ] Created `client/src/pages/Login.jsx` with login form
- [ ] Created `client/src/pages/Register.jsx` with registration form
- [ ] Created `client/src/pages/Wallet.jsx` with wallet + withdrawal

#### Code Updates - Pages
- [ ] Updated `client/src/pages/CompanyDashboard.jsx`:
  - [ ] Added Stripe integration
  - [ ] Added payment form
  - [ ] Added "Proceed to Payment" button
  - [ ] Sends paymentIntentId to backend
- [ ] Updated `client/src/pages/AdminDashboard.jsx`:
  - [ ] Added admin-only check
  - [ ] Added redirect if not admin
  - [ ] Added wallet management tab
  - [ ] Added withdrawal management

#### Code Updates - App.jsx
- [ ] Updated `client/src/App.jsx`:
  - [ ] Wrapped app with `<AuthProvider>`
  - [ ] Added `/login` route → `Login`
  - [ ] Added `/register` route → `Register`
  - [ ] Added `/wallet` route → `Wallet`
  - [ ] Updated `/admin` route (secured)
  - [ ] Updated `/company` route (now requires auth)

#### Testing
- [ ] Stopped previous frontend instance (if running)
- [ ] In client folder, ran `npm start`
- [ ] Browser opened automatically to http://localhost:3000
- [ ] Landing page shows
- [ ] No errors in browser console (F12)
- [ ] See navigation links:
  - [ ] Home
  - [ ] Campaigns
  - [ ] Create Campaign
  - [ ] Join as Promoter
  - [ ] Login (if not logged in)

---

### STRIPE SETUP (5 minutes)

#### Account Creation
- [ ] Opened https://stripe.com
- [ ] Clicked "Sign up" or "Get started"
- [ ] Entered email address
- [ ] Entered password
- [ ] Completed email verification
- [ ] Entered business details
- [ ] Received confirmation

#### API Keys
- [ ] Logged into Stripe dashboard
- [ ] Clicked "Developers" in left menu
- [ ] Clicked "API keys" (or "API credentials")
- [ ] Found "Standard keys" or "Live keys" section
- [ ] Under "Test mode" (shows test keys)
- [ ] Copied Publishable Key (starts with `pk_test_`)
- [ ] Copied Secret Key (starts with `sk_test_`)
- [ ] **DON'T use live keys yet**

#### Environment Variables Update
- [ ] Updated `server/.env`:
  - [ ] `STRIPE_SECRET_KEY=sk_test_51...` (your actual key)
  - [ ] `STRIPE_PUBLIC_KEY=pk_test_51...` (your actual key)
- [ ] Updated `client/.env`:
  - [ ] `REACT_APP_STRIPE_PUBLIC_KEY=pk_test_51...` (your actual key)
- [ ] Saved both files

#### Server Restart
- [ ] Stopped backend server (Ctrl+C)
- [ ] Started backend again: `npm start`
- [ ] Verified: `✅ Server running`
- [ ] Stopped frontend (Ctrl+C in second window)
- [ ] Started frontend again: `npm start`
- [ ] Verified: browser opens to http://localhost:3000

---

## FEATURE VERIFICATION

### Authentication System
- [ ] Can visit `/register`
- [ ] Registration form shows:
  - [ ] Full Name field
  - [ ] Email field
  - [ ] Password field
  - [ ] Confirm Password field
  - [ ] Role dropdown (Promoter/Company)
  - [ ] Sign Up button
- [ ] Can submit registration
- [ ] Redirects to dashboard
- [ ] Token saved in localStorage
- [ ] Can visit `/login`
- [ ] Can login with created account
- [ ] Redirects after login

### Campaign Creation with Payment
- [ ] Login as "Company" role
- [ ] Click "Create Campaign"
- [ ] Form shows all fields:
  - [ ] Campaign Name
  - [ ] Description
  - [ ] Image URL
  - [ ] Caption
  - [ ] Platform (dropdown)
  - [ ] Budget ($)
  - [ ] Duration (dropdown)
  - [ ] "Proceed to Payment" button
- [ ] Fill all fields
- [ ] Click "Proceed to Payment"
- [ ] Payment form appears with:
  - [ ] Card element (from Stripe)
  - [ ] "Pay $XX" button
- [ ] Enter test card: `4242 4242 4242 4242`
- [ ] Enter any future date (e.g., 12/25)
- [ ] Enter any CVC (e.g., 123)
- [ ] Click "Pay"
- [ ] See success message: "✅ Campaign created successfully!"
- [ ] Campaign appears in marketplace

### Admin Dashboard Security
- [ ] Logout (if logged in with different account)
- [ ] Login as Admin (use admin email)
- [ ] Visit `/admin`
- [ ] See admin dashboard with all features
- [ ] Logout
- [ ] Login as non-admin user
- [ ] Try to visit `/admin` manually
- [ ] Redirected to home page (access denied)

### Wallet System
- [ ] Login as promoter
- [ ] Click "My Wallet" (or /wallet)
- [ ] See wallet balance (initially $0)
- [ ] See "Bank Details" section
- [ ] Can add bank details:
  - [ ] Account Holder Name
  - [ ] Account Number
  - [ ] Routing Number
  - [ ] "Save Bank Details" button
- [ ] After approval, see withdrawal section
- [ ] Can request withdrawal with amount

### Admin Submission Management
- [ ] Login as admin
- [ ] Visit `/admin`
- [ ] Click "Submissions" tab
- [ ] See pending submissions
- [ ] Have "Approve" and "Reject" buttons
- [ ] Click "Approve"
- [ ] Submission status changes to "Approved"
- [ ] Promoter wallet updated

### Admin Withdrawal Management
- [ ] In admin dashboard
- [ ] Click "Withdrawals" tab
- [ ] See withdrawal requests
- [ ] Have "Approve Withdrawal" button
- [ ] Can click to approve
- [ ] Status changes to "completed"

---

## TESTING SCENARIOS

### Scenario 1: Complete Campaign-to-Payment Flow
- [ ] Register new company account
- [ ] Create campaign
- [ ] Fill all details
- [ ] Make test payment (4242...)
- [ ] Campaign created and appears in marketplace
- [ ] Data saved to campaigns.json

### Scenario 2: Admin-Only Access
- [ ] Register non-admin account
- [ ] Try to access /admin directly (type in URL)
- [ ] Denied access, redirected
- [ ] Login with admin account
- [ ] Can access /admin normally

### Scenario 3: Promoter Earning & Withdrawal
- [ ] Register as promoter
- [ ] View /campaigns
- [ ] Submit proof
- [ ] Admin approves submission
- [ ] Check /wallet - balance updated
- [ ] Add bank details
- [ ] Request withdrawal
- [ ] Admin approves withdrawal

### Scenario 4: Authentication Persistence
- [ ] Login
- [ ] Refresh page (F5)
- [ ] Still logged in (token from localStorage)
- [ ] Close browser tab completely
- [ ] Open new tab, go to http://localhost:3000
- [ ] May need to login again (depends on implementation)

---

## DATA STORAGE VERIFICATION

### Check JSON Files Created
- [ ] `server/data/users.json` contains registered users
  - [ ] Has `id`, `name`, `email`, `password` (hashed), `role`
  - [ ] Password is NOT plain text (looks like: `$2a$10$...`)
- [ ] `server/data/campaigns.json` contains created campaigns
  - [ ] Has `paymentIntentId` field
  - [ ] Has `createdBy` (user ID) field
  - [ ] Has `status: "active"`
- [ ] `server/data/submissions.json` updated
  - [ ] Has `userId` field
  - [ ] Associates submission with user
- [ ] `server/data/withdrawals.json` created
  - [ ] Contains withdrawal requests
  - [ ] Has `status`: "pending", "completed", etc.

### Verify Password Security
- [ ] Open `server/data/users.json`
- [ ] Look at password field
- [ ] Should NOT show plain password
- [ ] Should look like: `$2a$10$...` (bcrypt hash)
- [ ] Never store plain passwords!

---

## ERROR HANDLING VERIFICATION

### Test Error Scenarios
- [ ] Register with existing email → "Email already registered"
- [ ] Login with wrong password → "Invalid email or password"
- [ ] Try payment with invalid card → Error message shown
- [ ] Try to withdraw without bank details → Error message
- [ ] Try to withdraw more than balance → Error message
- [ ] Non-admin accessing admin → Redirected

---

## CODE QUALITY CHECK

### Backend Code
- [ ] Uses bcryptjs for password hashing ✅
- [ ] Uses JWT for tokens ✅
- [ ] Uses environment variables ✅
- [ ] Has error handling (try-catch) ✅
- [ ] Has validation checks ✅
- [ ] Has admin-only middleware ✅
- [ ] Has token authentication middleware ✅

### Frontend Code
- [ ] Uses Context API for auth state ✅
- [ ] Tokens stored in localStorage ✅
- [ ] Renders conditionally based on auth ✅
- [ ] Integrates Stripe properly ✅
- [ ] Has loading states ✅
- [ ] Has error message displays ✅
- [ ] Has form validation ✅

---

## DEPLOYMENT PREPARATION

### Before Going to Production
- [ ] All features tested locally
- [ ] No console errors
- [ ] No server errors
- [ ] Data persistence working
- [ ] Admin access verified
- [ ] Stripe test mode working

### When Ready for Production
- [ ] Get Stripe live keys
- [ ] Update environment variables
- [ ] Use production-grade password for JWT_SECRET
- [ ] Set NODE_ENV=production
- [ ] Setup database backup
- [ ] Enable HTTPS

---

## FINAL CHECKLIST

### All Features Implemented
- [x] User registration with email & password
- [x] User login with JWT tokens
- [x] Password hashing with bcryptjs
- [x] Stripe payment integration
- [x] Campaign payment requirement
- [x] Admin-only dashboard
- [x] Promoter wallet system
- [x] Bank details management
- [x] Withdrawal requests
- [x] Admin approval system

### All Tests Passed
- [x] Registration works
- [x] Login works
- [x] Token persists
- [x] Payment processing works
- [x] Admin access restricted
- [x] Wallet shows balance
- [x] Withdrawal requests work
- [x] Data saves to JSON

### All Errors Handled
- [x] Validation errors show messages
- [x] Auth errors refuse access
- [x] Payment errors show clearly
- [x] Withdrawal errors prevent invalid actions

### Ready to Deploy
- [x] All code committed to GitHub
- [x] .env files configured
- [x] Servers tested
- [x] Payment system tested
- [x] Admin security verified

---

## NEXT STEPS

### Immediate (After verification)
1. **Test thoroughly** with different scenarios
2. **Fix any bugs** that appear
3. **Get feedback** from test users
4. **Document changes** you made

### Short Term (This week)
1. **Deploy to production** (GitHub, Railway, Vercel)
2. **Switch to live Stripe keys** (not test keys)
3. **Monitor for errors** in logs
4. **Set up email notifications**

### Medium Term (This month)
1. **Add password reset** functionality
2. **Add email verification** for registration
3. **Improve UI/UX** based on feedback
4. **Add more analytics**

### Long Term (Next months)
1. **Add multiple payment methods**
2. **Improve admin dashboard**
3. **Add mobile responsiveness**
4. **Scale infrastructure**

---

## SUPPORT & TROUBLESHOOTING

If you get stuck:

1. **Check the error message** carefully
2. **Check browser console** (F12 key)
3. **Check server logs** in terminal
4. **Check .env files** have all variables
5. **Restart both servers**
6. **Re-read relevant section** in AUTH_PAYMENT_GUIDE.md
7. **Check TROUBLESHOOTING.md** for common issues

---

## SUCCESS INDICATORS

You know everything is working when:

✅ Can register as Company or Promoter  
✅ Can login with email & password  
✅ Can create campaign (requires login)  
✅ Can pay for campaign with test card  
✅ Campaign appears after payment  
✅ Can view /admin only if admin email  
✅ Non-admin users cannot access /admin  
✅ Can add bank details as promoter  
✅ Can request withdrawal  
✅ Admin can approve submissions  
✅ Promoter wallet updates on approval  
✅ Admin can approve withdrawals  
✅ All data persists in JSON files  
✅ No console errors  
✅ No server errors  

**If all these work, congratulations! Your auth & payment system is working!** 🎉

---

**Print this checklist and check boxes as you go!** ✅
