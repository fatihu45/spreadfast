# ✅ Paystack Integration - Verification Checklist

This checklist helps you verify that everything is working correctly.

---

## PRE-IMPLEMENTATION CHECKLIST

### Environment Setup
- [ ] All files backed up
- [ ] Node.js installed (v14+)
- [ ] Both `server/` and `client/` folders exist
- [ ] Internet connection stable
- [ ] Paystack account created at paystack.com
- [ ] Paystack test keys obtained

### Knowledge Requirements
- [ ] Understand basic Node.js
- [ ] Understand basic React
- [ ] Know how to edit files
- [ ] Know how to run terminal commands
- [ ] Know your email address (for ADMIN_EMAIL)

---

## PHASE 1: BACKEND VERIFICATION

### Installation
- [ ] Ran `npm install bcryptjs jsonwebtoken dotenv cors axios` in `/server`
- [ ] No installation errors
- [ ] `node_modules` folder created

### Environment File
- [ ] Created `server/.env`
- [ ] Set `PORT=5000`
- [ ] Set `JWT_SECRET=...` (any random string)
- [ ] Set `CORS_ORIGIN=http://localhost:3000`
- [ ] Set `PAYSTACK_SECRET_KEY=sk_test_...`
- [ ] Set `PAYSTACK_PUBLIC_KEY=pk_test_...`
- [ ] Set `ADMIN_EMAIL=your@email.com` (YOUR actual email)
- [ ] No spaces around `=` signs

### Backend Folders
- [ ] Created `server/models` folder
- [ ] Created `server/middleware` folder
- [ ] Created `server/data` folder (will auto-create)

### Backend Files Created
- [ ] `server/models/User.js` exists
- [ ] `server/middleware/auth.js` exists
- [ ] `server/server.js` completely replaced with new code

### File Contents
- [ ] `User.js` has `class User` definition
- [ ] `auth.js` has `authenticateToken` function
- [ ] `server.js` has all 4 route sections:
  - [ ] Authentication routes (/api/auth/*)
  - [ ] Paystack payment routes (/api/payments/*)
  - [ ] Campaign routes (/api/campaigns/*)
  - [ ] Admin routes (/api/admin/*)
  - [ ] Wallet routes (/api/wallet/*)

### Backend Startup Test
- [ ] Ran `npm start` in `/server`
- [ ] Server started without errors
- [ ] Shows: "🚀 Server running on http://localhost:5000"
- [ ] Shows: "💳 Paystack Sandbox Mode"
- [ ] Ctrl+C to stop (don't need it yet)

### Data Files Created
After backend startup, check:
- [ ] `data/users.json` exists
- [ ] `data/campaigns.json` exists
- [ ] `data/withdrawals.json` exists
- [ ] `data/paystack_transactions.json` exists

**Phase 1 Status: ✅ COMPLETE** / ❌ INCOMPLETE

---

## PHASE 2: FRONTEND VERIFICATION

### Installation
- [ ] Ran `npm install @paystack/inline-js axios` in `/client`
- [ ] No installation errors
- [ ] Packages added to package.json

### Environment File
- [ ] Created `client/.env`
- [ ] Set `REACT_APP_PAYSTACK_PUBLIC_KEY=pk_test_...`
- [ ] Set `REACT_APP_ADMIN_EMAIL=your@email.com` (SAME as server!)
- [ ] Restarted frontend for `.env` to load

### Frontend Folders
- [ ] Created `client/src/context` folder
- [ ] Created `client/src/pages` folder

### Frontend Files Created
- [ ] `client/src/context/AuthContext.js` exists
- [ ] `client/src/pages/Login.jsx` exists
- [ ] `client/src/pages/Register.jsx` exists
- [ ] `client/src/pages/Auth.css` exists
- [ ] `client/src/pages/Wallet.jsx` exists
- [ ] `client/src/pages/AdminDashboard.jsx` exists
- [ ] `client/src/pages/Pages.css` exists

### Frontend Files Updated
- [ ] `client/src/App.jsx` has:
  - [ ] AuthProvider wrapper
  - [ ] Protected route component
  - [ ] Admin route component
  - [ ] All 7 routes (login, register, payment-callback, home, company, wallet, admin)

### Frontend Startup Test
- [ ] Started backend first (`npm start` in `/server`)
- [ ] Started frontend in new terminal (`npm start` in `/client`)
- [ ] Browser opened to http://localhost:3000
- [ ] No red errors in console (F12 → Console)
- [ ] Can see login page

**Phase 2 Status: ✅ COMPLETE** / ❌ INCOMPLETE

---

## PHASE 3: PAYSTACK CREDENTIALS VERIFICATION

### Paystack Account
- [ ] Created paystack.com account
- [ ] Verified email
- [ ] Logged into dashboard
- [ ] Can see Settings → API Keys

### API Keys
- [ ] Copied Public Key (starts with `pk_test_`)
- [ ] Copied Secret Key (starts with `sk_test_`)
- [ ] Keys are different from each other
- [ ] Public key in client/.env
- [ ] Secret key in server/.env

### Keys Validation
- [ ] `PAYSTACK_SECRET_KEY` starts with `sk_test_`
- [ ] `PAYSTACK_PUBLIC_KEY` (server) starts with `pk_test_`
- [ ] `REACT_APP_PAYSTACK_PUBLIC_KEY` (client) starts with `pk_test_`
- [ ] All keys are not empty or placeholder

**Phase 3 Status: ✅ COMPLETE** / ❌ INCOMPLETE

---

## PHASE 4: INTEGRATION TESTING

### Test 1: Registration Flow
**Do this:**
1. Go to http://localhost:3000/register
2. Fill in form:
   - Name: `Test Company`
   - Email: `testcompany@example.com`
   - Password: `Test123456`
   - Role: `Company`
3. Click Register

**Verify:**
- [ ] Can access registration page (no 404)
- [ ] Form submits without error
- [ ] Redirected to home page
- [ ] Logged in (token stored in localStorage)
- [ ] User data in `data/users.json`

**Check Backend:**
```bash
# Open data/users.json and verify:
# - 1 user exists
# - Email: testcompany@example.com
# - Password is hashed (NOT plain text)
# - Role: company
```

- [ ] User file contains new user
- [ ] Password is hashed
- [ ] Has correct email & role

### Test 2: Login Flow
**Do this:**
1. Logout (clear localStorage or close browser)
2. Go to http://localhost:3000/login
3. Use registered credentials:
   - Email: `testcompany@example.com`
   - Password: `Test123456`
4. Click Login

**Verify:**
- [ ] Can access login page
- [ ] Form submits
- [ ] Success message or redirect
- [ ] Taken to home page
- [ ] Token in localStorage

### Test 3: Campaign Creation with Payment
**Do this:**
1. Logged in as Company
2. Go to /company
3. Fill campaign form:
   - Title: `Test Campaign`
   - Description: `Test Description`
   - Budget: `5000`
4. Click "Pay & Create Campaign"

**Verify:**
- [ ] Paystack payment page loads
- [ ] Shows correct amount (₦5000)
- [ ] Shows correct email
- [ ] Test card option available

### Test 4: Complete Payment
**Do this (on Paystack page):**
1. Select test card option
2. Enter:
   - Card Number: `4111111111111111`
   - Expiry: `05/25` (or any future date)
   - CVC: `123`
   - Email: auto-filled
3. Click "Pay"

**Verify:**
- [ ] No errors on payment form
- [ ] OTP prompt appears
- [ ] Can enter OTP (test: `123456`)

### Test 5: Payment Verification
**After OTP:**
1. You should see "Payment Successful ✓"
2. Or redirected back to app

**Verify:**
- [ ] Success message appears
- [ ] Or redirected to /campaigns
- [ ] In `data/paystack_transactions.json`:
  - [ ] New transaction recorded
  - [ ] Reference matches
  - [ ] Status: `completed`

### Test 6: Campaign Creation
**After payment:**
1. Campaign should be created
2. Check `data/campaigns.json`

**Verify:**
- [ ] Campaign exists
- [ ] Company ID matches user
- [ ] Budget: 5000
- [ ] Paystack reference stored
- [ ] Can see on dashboard

### Test 7: Promoter Registration
**Do this:**
1. Register new user:
   - Name: `Test Promoter`
   - Email: `promoter@example.com`
   - Role: `Promoter`
2. Can access home page
3. Can see available campaigns

**Verify:**
- [ ] Promoter user created
- [ ] Can view campaigns
- [ ] Can submit proof

### Test 8: Submission Flow
**As Promoter:**
1. Find created campaign
2. Submit proof:
   - URL: `https://example.com/proof.jpg`
   - Description: `Test submission`

**Verify:**
- [ ] Submission recorded
- [ ] Shows in campaign submissions
- [ ] Status: `pending`

### Test 9: Admin Dashboard Access
**Do this:**
1. Logout
2. Register admin account with correct ADMIN_EMAIL
   - Email: MUST be same as ADMIN_EMAIL in .env
3. Login
4. Try to access /admin

**Verify:**
- [ ] Can access /admin page
- [ ] Sees all campaigns
- [ ] Sees all submissions
- [ ] Can see "Approve" buttons

### Test 10: Admin Approval
**As Admin:**
1. Find promoter's submission
2. Click "Approve (₦5000)"

**Verify:**
- [ ] Submission status changes to `approved`
- [ ] Promoter's wallet balance increases
- [ ] Check `data/users.json` → promoter record
  - [ ] walletBalance: 5000 (or higher)

### Test 11: Wallet Functionality
**As Promoter:**
1. Login with promoter account
2. Go to /wallet
3. Should see balance

**Verify:**
- [ ] Wallet page loads
- [ ] Balance displays correctly
- [ ] Shows ₦5000 (or approved amount)

### Test 12: Bank Details
**On Wallet page:**
1. Fill bank details:
   - Account Number: `0123456789`
   - Bank Code: `044` (Access Bank example)
   - Account Name: `Test Account`
2. Click save

**Verify:**
- [ ] Bank details saved
- [ ] Can see in wallet
- [ ] Stored in `data/users.json`

### Test 13: Withdrawal Request
**On Wallet page:**
1. Enter amount: `1000`
2. Click "Request Withdrawal"

**Verify:**
- [ ] Withdrawal request created
- [ ] Stored in `data/withdrawals.json`
- [ ] Status: `pending`
- [ ] Amount: 1000

### Test 14: Admin Withdrawal Approval
**As Admin:**
1. Go to admin dashboard
2. Find withdrawal request
3. Click "Approve Withdrawal"

**Verify:**
- [ ] Withdrawal status changes to `approved`
- [ ] Promoter can request again (new withdrawal)

### Test 15: Error Handling
**Test error cases:**

**Missing password:**
- [ ] Register form requires password
- [ ] Shows error message

**Duplicate email:**
- [ ] Register with existing email
- [ ] Shows "Email already registered"

**Wrong password:**
- [ ] Try login with wrong password
- [ ] Shows "Invalid email or password"

**No bank details:**
- [ ] Try withdraw without bank details
- [ ] Shows "Bank details required"

**Insufficient balance:**
- [ ] Try withdraw more than balance
- [ ] Shows "Insufficient balance"

---

## DATA VERIFICATION

### users.json Structure
```json
[
  {
    "id": "uuid",
    "name": "string",
    "email": "string",
    "password": "hashed string",  // Should be hashed!
    "role": "company|promoter|admin",
    "walletBalance": number,
    "bankDetails": null|object,
    "createdAt": "ISO date"
  }
]
```

- [ ] All users have UUIDs
- [ ] All passwords are hashed (start with $2a$)
- [ ] Wallet balances are numbers
- [ ] Dates are ISO format

### campaigns.json Structure
```json
[
  {
    "id": "uuid",
    "companyId": "uuid",
    "title": "string",
    "description": "string",
    "budget": number,
    "status": "active",
    "paystackReference": "string",
    "amountPaid": number,
    "submissions": array,
    "createdAt": "ISO date"
  }
]
```

- [ ] Campaigns have Paystack references
- [ ] Amount paid matches selected budget
- [ ] Submissions array is valid
- [ ] All required fields present

### paystack_transactions.json Structure
```json
[
  {
    "id": "uuid",
    "reference": "string",
    "userId": "uuid",
    "email": "string",
    "amount": number,
    "campaignName": "string",
    "status": "pending|completed",
    "createdAt": "ISO date",
    "verifiedAt": "ISO date|undefined"
  }
]
```

- [ ] All transactions have Paystack references
- [ ] Status tracked correctly
- [ ] Verified at timestamp added after verification

### withdrawals.json Structure
```json
[
  {
    "id": "uuid",
    "userId": "uuid",
    "userName": "string",
    "email": "string",
    "amount": number,
    "bankDetails": object,
    "status": "pending|approved|rejected",
    "createdAt": "ISO date",
    "reviewedAt": "ISO date|undefined"
  }
]
```

- [ ] All withdrawals have IDs
- [ ] Bank details stored
- [ ] Status changes tracked
- [ ] Review timestamp added when processed

---

## SECURITY VERIFICATION

### Password Security
- [ ] All passwords in users.json are hashed
- [ ] Hashes start with `$2a$` (bcrypt format)
- [ ] Cannot reverse to plain text

### Token Security
- [ ] JWT tokens have expiry (7 days)
- [ ] Tokens stored in localStorage (browser)
- [ ] Sent in Authorization header
- [ ] Backend verifies tokens

### Admin Security
- [ ] Only ADMIN_EMAIL can access /admin
- [ ] Other users redirected
- [ ] No admin API calls work without admin email
- [ ] Checked on every admin endpoint

### Payment Security
- [ ] Payments verified with Paystack
- [ ] Campaign not created until payment confirmed
- [ ] Payment reference stored with campaign
- [ ] Stripe webhook integrity checked

### CORS Security
- [ ] Only http://localhost:3000 can call backend
- [ ] Other origins rejected
- [ ] Prevents cross-site attacks

---

## PERFORMANCE VERIFICATION

### Response Times
- [ ] Login: < 500ms
- [ ] Register: < 500ms
- [ ] Campaign list: < 200ms
- [ ] Payment init: < 2s (includes Paystack API)
- [ ] Payment verify: < 2s (includes Paystack API)

### Data Handling
- [ ] Can handle 100+ users
- [ ] Can handle 1000+ transactions
- [ ] File operations don't block server
- [ ] No memory leaks (check Task Manager)

### File Sizes
- [ ] users.json: < 10MB normal use
- [ ] campaigns.json: < 5MB normal use
- [ ] transactions.json: < 10MB normal use

---

## BROWSER CONSOLE CHECK

### No Red Errors
Open http://localhost:3000 and check console (F12):
- [ ] No red error messages
- [ ] No CORS errors
- [ ] No 404 errors
- [ ] No undefined function errors

### Expected Warnings (OK to ignore)
- ✓ React development mode warning
- ✓ Deprecation warnings
- ✓ React StrictMode warnings

### API Calls in Network Tab
- [ ] POST /api/auth/register - 200/201 status
- [ ] POST /api/auth/login - 200 status
- [ ] POST /api/payments/initiate - 200 status
- [ ] GET /api/wallet - 200 status
- [ ] All requests have Bearer token (Authorization header)

---

## BROWSER STORAGE CHECK

Open DevTools (F12) → Application → Local Storage → http://localhost:3000:
- [ ] `token` key exists
- [ ] Token value is NOT empty
- [ ] Token looks like: `eyJhbGc...` (JWT format)

---

## ENVIRONMENT VARIABLE VERIFICATION

### Server .env
Run in server terminal:
```bash
echo %PAYSTACK_SECRET_KEY%  # Windows
# or
echo $PAYSTACK_SECRET_KEY  # Mac/Linux
```

- [ ] Outputs your actual key (not placeholder)
- [ ] Starts with `sk_test_`

### Frontend .env
Check `client/.env` file has:
- [ ] REACT_APP_PAYSTACK_PUBLIC_KEY=pk_test_...
- [ ] REACT_APP_ADMIN_EMAIL=...

Verify loaded:
```javascript
// In browser console:
console.log(process.env.REACT_APP_PAYSTACK_PUBLIC_KEY)
```

- [ ] Outputs your actual key (not undefined)

---

## PRODUCTION READINESS CHECKLIST

### Before Deploying:
- [ ] All tests passing
- [ ] No console errors
- [ ] All data files working
- [ ] Admin security confirmed
- [ ] Payment flow complete
- [ ] Withdrawal process working
- [ ] User authentication solid

### Live Paystack Preparation:
- [ ] Completed Paystack business verification
- [ ] Have live API keys (start with pk_live_ / sk_live_)
- [ ] Read Paystack documentation
- [ ] Set up settlement account
- [ ] Configure webhooks

### Deployment:
- [ ] Deploy to Railway (backend)
- [ ] Deploy to Vercel (frontend)
- [ ] Update environment variables in hosting
- [ ] Switch to live Paystack keys
- [ ] Test live payments with small amount
- [ ] Monitor for errors
- [ ] Set up backups

---

## SUCCESS INDICATORS

✅ **Everything is working if:**

1. **Users can register and login**
   - New accounts created
   - Passwords hashed
   - Tokens generated

2. **Payments work**
   - Can initiate payment
   - Redirected to Paystack
   - Test cards accepted
   - Payment verified

3. **Campaigns are created**
   - After payment confirmed
   - Data saved correctly
   - Can view campaigns

4. **Wallet system works**
   - Balance tracked
   - Earnings added
   - Withdrawals processed

5. **Admin dashboard secure**
   - Only YOUR email access
   - Can approve/reject
   - Can manage withdrawals

6. **Data persistent**
   - All info saved to JSON
   - Survives server restart
   - No data lost

7. **No errors**
   - Console clean
   - Backend logs normal
   - No 500 errors

---

## If Tests Fail

### Step 1: Check Logs
```bash
# Backend logs (bottom of terminal window)
# Look for: Error messages with timestamps
```

### Step 2: Check Console
```
Browser: F12 → Console → Look for red errors
```

### Step 3: Check Files Exist
```bash
# server/server.js exists and has 600+ lines
# client/src/App.jsx updated
# client/src/context/AuthContext.js exists
```

### Step 4: Check Environment
```bash
# server/.env has 7 variables all filled
# client/.env has 2 variables all filled
```

### Step 5: Restart Everything
```bash
# Kill both: Ctrl+C in both terminals
# Wait 10 seconds
# Restart backend first, then frontend
```

---

## FINAL VERIFICATION

Run this final test:

**Test Case: End-to-End Flow**
1. ✅ Register as Company
2. ✅ Create campaign with Paystack payment
3. ✅ Register as Promoter
4. ✅ Submit proof
5. ✅ Login as Admin
6. ✅ Approve submission
7. ✅ Check promoter wallet updated
8. ✅ Promoter add bank details
9. ✅ Promoter request withdrawal
10. ✅ Admin approve withdrawal
11. ✅ Check all data in JSON files

**If all 11 steps work: ✅ PAYSTACK INTEGRATION COMPLETE**

---

## SIGN-OFF

I verified and confirmed:

- [ ] All authentication working
- [ ] All Paystack payment working
- [ ] All admin features secure
- [ ] All wallet features working
- [ ] All data persistent
- [ ] Ready for production

**Date:** ___________

**Status:** ✅ READY TO DEPLOY

---

**Congratulations!** Your SpreadFast platform is now secure, functional, and ready for Nigerian market with Paystack! 🎉

Next: Deploy to production and switch to live Paystack keys.
