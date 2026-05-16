# User Journey & Visual Flow Guide

## Complete User Journey Maps

---

## 1. NEW COMPANY USER JOURNEY

```
Landing Page (/)
    │
    └─→ Click "Create Campaign"
            │
            ├─ If NOT logged in:
            │   └─→ Redirect to /register?role=company
            │       │
            │       ├─ Form shows "Create an account as a Company"
            │       ├─ Role is pre-selected as "Company"
            │       └─ Fill in: Name, Email, Password
            │           │
            │           └─→ Click "Register"
            │               │
            │               └─→ Server validates & creates account
            │                   │
            │                   └─→ Auto-login with JWT token
            │                       │
            │                       └─→ Redirect to /company ✅
            │
            └─ If already logged in as Company:
                └─→ Direct to /company ✅

Company Dashboard (/company)
    │
    ├─ Navigation Bar
    │   ├─ Logo: SpreadFast
    │   ├─ Links: Create Campaign, Wallet
    │   ├─ User name: John's Company
    │   └─ Logout button
    │
    └─ Campaign Creation Form
        │
        ├─ Form Fields:
        │   ├─ Campaign Title (required)
        │   ├─ Campaign Description
        │   └─ Budget in NGN (minimum ₦100)
        │
        ├─ Sidebar Info:
        │   ├─ How It Works (5 steps)
        │   └─ Payment Info (Paystack details)
        │
        └─ Fill Form & Click "Pay & Create Campaign"
            │
            ├─ Client-side validation
            │   ├─ Title required? ✓
            │   ├─ Budget ≥ ₦100? ✓
            │   └─ No validation errors? ✓
            │
            └─→ Call API: POST /api/payments/initiate
                │
                ├─ Send: {
                │   amount: 5000,
                │   campaignName: "Summer Sale",
                │   campaignDescription: "..."
                │ }
                │
                └─→ Server responds with Paystack URL
                    │
                    └─→ Redirect to Paystack Checkout
                        │
                        ├─ User enters card details
                        ├─ Completes payment
                        │
                        └─→ Paystack redirects to /payment-callback
                            │
                            └─→ Server processes & confirms payment
                                │
                                ├─ Create campaign record
                                ├─ Deduct from user wallet
                                └─ Redirect back to /company ✅
                                    │
                                    └─→ Campaign appears in "Your Campaigns"
                                        section with:
                                        ├─ Title
                                        ├─ Budget: ₦5000
                                        ├─ Status: Active
                                        └─ Submissions: 0
```

---

## 2. NEW PROMOTER USER JOURNEY

```
Landing Page (/)
    │
    └─→ Click "Join as Promoter"
            │
            ├─ If NOT logged in:
            │   └─→ Redirect to /register?role=promoter
            │       │
            │       ├─ Form shows "Join as a Promoter"
            │       ├─ Role is pre-selected as "Promoter"
            │       └─ Fill in: Name, Email, Password
            │           │
            │           └─→ Click "Register"
            │               │
            │               └─→ Server validates & creates account
            │                   │
            │                   └─→ Auto-login with JWT token
            │                       │
            │                       └─→ Redirect to /dashboard ✅
            │
            └─ If already logged in as Promoter:
                └─→ Direct to /dashboard ✅

Promoter Dashboard (/dashboard)
    │
    ├─ Browse available campaigns
    ├─ View campaign details
    ├─ Submit proof of promotion
    ├─ Track earnings
    └─ Manage profile
```

---

## 3. EXISTING USER LOGIN JOURNEY

```
Landing Page (/)
    │
    └─→ Navigate to /login (via navbar link)
        │
        └─→ Login Form
            │
            ├─ Email input
            ├─ Password input
            │
            └─→ Click "Login"
                │
                ├─ Client validation
                │   ├─ Email filled? ✓
                │   └─ Password filled? ✓
                │
                └─→ Call API: POST /api/auth/login
                    │
                    ├─ Send: { email, password }
                    │
                    └─→ Server validates credentials
                        │
                        ├─ Credentials valid? ✅
                        │   │
                        │   ├─ Generate JWT token
                        │   ├─ Return user data + token
                        │   │
                        │   └─→ Frontend stores token in localStorage
                        │       │
                        │       └─→ Redirect based on role:
                        │           ├─ Company → /company ✅
                        │           └─ Promoter → /dashboard ✅
                        │
                        └─ Credentials invalid? ❌
                            │
                            └─→ Show error message
                                "Invalid email or password"
                                (Redirect to /login again)
```

---

## 4. NAVIGATION FLOW

### For Non-Authenticated Users (Guests)

```
Any Page
    ↓
Check AuthContext: user === null
    ↓
Show Navigation:
├─ Logo: SpreadFast
├─ Links:
│   ├─ [Login] → /login
│   └─ [Register] → /register
```

### For Authenticated Company Users

```
Any Page
    ↓
Check AuthContext: user?.role === 'company'
    ↓
Show Navigation:
├─ Logo: SpreadFast
├─ Links:
│   ├─ Create Campaign → /company
│   └─ Wallet → /wallet
├─ User name: "Company Name"
└─ [Logout] → Clears token + Redirect to /
```

### For Authenticated Promoter Users

```
Any Page
    ↓
Check AuthContext: user?.role === 'promoter'
    ↓
Show Navigation:
├─ Logo: SpreadFast
├─ Links:
│   ├─ Dashboard → /dashboard
│   └─ Wallet → /wallet
├─ User name: "Promoter Name"
└─ [Logout] → Clears token + Redirect to /
```

---

## 5. BUTTON CLICK LOGIC FLOW

### "Create Campaign" Button on Landing Page

```
Click "Create Campaign"
    ↓
Check: Is user logged in?
    ├─ NO → Is user's role 'company'?
    │       └─ YES → Navigate to /company (Company Dashboard)
    │       └─ NO → Navigate to /register?role=company (Register page)
    │
    └─ YES (User exists) → Check their role
        ├─ Role is 'company' → Navigate to /company ✅
        ├─ Role is 'promoter' → Show alert: 
        │                       "Only companies can create campaigns"
        └─ Role is other → Show alert
```

### "Join as Promoter" Button on Landing Page

```
Click "Join as Promoter"
    ↓
Check: Is user logged in?
    ├─ NO → Is user's role 'promoter'?
    │       └─ YES → Navigate to /dashboard (Promoter Dashboard)
    │       └─ NO → Navigate to /register?role=promoter (Register page)
    │
    └─ YES (User exists) → Check their role
        ├─ Role is 'promoter' → Navigate to /dashboard ✅
        ├─ Role is 'company' → Show alert:
        │                       "Please login as a promoter to join campaigns"
        └─ Role is other → Show alert
```

---

## 6. PAYSTACK PAYMENT FLOW (DETAILED)

```
Company Dashboard - Form Filled
├─ Title: "Summer Sale Campaign"
├─ Description: "Promote our summer collection"
└─ Budget: 5000
    │
    ↓
Click "Pay & Create Campaign"
    │
    ↓
Client-side Validation
├─ Title exists? ✓
├─ Budget ≥ 100? ✓ (5000 ≥ 100)
└─ All required fields filled? ✓
    │
    ↓ (If validation passes)
Set paymentProcessing = true
Show: "Processing Payment..." + Loading spinner
    │
    ↓
Call API: POST /api/payments/initiate
Headers: {
  Authorization: Bearer <JWT_TOKEN>,
  Content-Type: application/json
}
Body: {
  amount: 5000,
  campaignName: "Summer Sale Campaign",
  campaignDescription: "Promote our summer collection"
}
    │
    ↓
Backend Process:
├─ Verify JWT token ✓
├─ Fetch user details ✓
├─ Call Paystack API:
│   └─ Initialize transaction with:
│       ├─ Amount: 500000 (in kobo, 5000 * 100)
│       ├─ Email: user@company.com
│       ├─ Plan: optional (for recurring)
│       └─ Metadata: { campaignName, userId, etc }
│
└─→ Paystack responds: {
    status: true,
    message: "Authorization URL created",
    data: {
      authorization_url: "https://checkout.paystack.com/...",
      access_code: "...",
      reference: "ref_..."
    }
}
    │
    ↓
Backend returns to Frontend:
{
  success: true,
  authorizationUrl: "https://checkout.paystack.com/..."
}
    │
    ↓
Frontend: Set paymentProcessing = false
Frontend: window.location.href = authorizationUrl
    │
    ↓
User Redirected to Paystack Checkout Page
├─ Amount: ₦5,000
├─ Email confirmation
├─ Card details entry
└─ Click "Pay" button
    │
    ↓
Paystack Processes Payment
├─ Validates card ✓
├─ Charges account ✓
├─ Generates transaction reference ✓
    │
    ↓
Payment Success/Failure
    ├─ Success:
    │   └─→ Paystack redirects to /payment-callback?reference=...
    │       │
    │       ↓
    │       Backend:
    │       ├─ Extract reference from query params
    │       ├─ Call Paystack API to verify: /transaction/verify/<ref>
    │       ├─ Confirm payment successful
    │       ├─ Create campaign record in DB
    │       ├─ Deduct from company wallet
    │       ├─ Send confirmation email
    │       └─→ Redirect to /company ✅
    │           │
    │           ↓
    │           Frontend:
    │           ├─ Load campaigns list
    │           ├─ New campaign appears ✓
    │           ├─ Status: "Active"
    │           └─ Ready for promoters to join
    │
    └─ Failure:
        └─→ Paystack redirects to /payment-callback
            │
            ↓
            Backend:
            ├─ Verify payment returned error
            ├─ Do NOT create campaign
            ├─ Return error response
            └─→ Frontend: Show error message
                "Payment failed. Please try again."
```

---

## 7. AUTHENTICATION STATE MANAGEMENT

### Initial Load
```
App Mounts
    │
    ↓
Check localStorage for 'token'
    ├─ Token exists?
    │   ├─ YES → Call GET /api/auth/me with token
    │   │       ├─ Server validates token
    │   │       ├─ Returns user data: { id, name, email, role }
    │   │       └─ Set AuthContext: user + token
    │   │
    │   └─ NO → AuthContext: user = null, token = null
    │
    ↓
Set loading = false
    │
    ↓
Render App with auth state
```

### After Login/Register
```
User fills form & submits
    │
    ↓
Call /api/auth/login or /api/auth/register
    │
    ↓
Backend validates & returns: {
  success: true,
  user: { id, name, email, role },
  token: "jwt.token.here"
}
    │
    ↓
Frontend:
├─ Save token to localStorage
├─ Set AuthContext.user = user
├─ Set AuthContext.token = token
└─ Redirect to appropriate dashboard
```

### Logout
```
Click Logout
    │
    ↓
Call logout() from AuthContext
    │
    ↓
Frontend:
├─ Remove token from localStorage
├─ Clear AuthContext.user = null
├─ Clear AuthContext.token = null
└─ Redirect to /
```

---

## 8. ERROR HANDLING FLOWS

### Registration Error
```
User fills form & clicks Register
    │
    ↓
API responds: { success: false, message: "Email already exists" }
    │
    ↓
Frontend:
├─ Set error state
├─ Display error message
├─ Keep form filled (user can correct)
└─ Cursor stays on form
```

### Payment Error
```
Payment initiation fails
    │
    ├─ Validation error:
    │   └─ "Campaign title and budget are required"
    │
    ├─ Budget error:
    │   └─ "Budget must be at least ₦100"
    │
    └─ API error:
        └─ "Payment initialization failed. Please try again."
            │
            ↓
            Frontend:
            ├─ Show error in red banner
            ├─ Disable submit button
            ├─ User can fix & resubmit
            └─ Payment processing = false
```

### Access Control Error
```
Non-authenticated user tries /company
    │
    ↓
ProtectedRoute checks: user === null
    │
    ├─ YES → Show "Loading..."
    ├─ Then check token
    │   ├─ Token invalid/expired? → Redirect to /login
    │   └─ Token valid? → Fetch user, set context, show page
    │
    └─ NO (user exists) → Show page
```

---

## 9. API REQUEST/RESPONSE CYCLES

### Login Cycle
```
Frontend Request:
POST /api/auth/login
{
  email: "company@example.com",
  password: "password123"
}
    ↓
Backend Response (Success):
{
  success: true,
  token: "eyJhbGciOiJIUzI1NiIs...",
  user: {
    id: "user_123",
    name: "My Company",
    email: "company@example.com",
    role: "company"
  }
}
    ↓
Backend Response (Failure):
{
  success: false,
  message: "Invalid email or password"
}
```

### Payment Initiation Cycle
```
Frontend Request:
POST /api/payments/initiate
Headers: { Authorization: Bearer <token> }
{
  amount: 5000,
  campaignName: "Campaign Name",
  campaignDescription: "Description..."
}
    ↓
Backend Response (Success):
{
  success: true,
  authorizationUrl: "https://checkout.paystack.com/...",
  reference: "ref_1234567890"
}
    ↓
Backend Response (Failure):
{
  success: false,
  message: "Insufficient funds" 
    or 
  message: "Payment service temporarily unavailable"
}
```

---

## 10. PROTECTED vs PUBLIC ROUTES

### PUBLIC Routes (No login required)
```
/                    → Landing Page
/login               → Login Form
/register            → Registration Form
/payment-callback    → Payment verification
```

### PROTECTED Routes (Login required)
```
/dashboard           → Promoter Dashboard
/company             → Company Dashboard
/wallet              → User Wallet
/admin               → Admin Dashboard (company only)
```

### AUTO-REDIRECT RULES
```
User: Logged in as Company
├─ Try to access /dashboard (Promoter) 
│   → Show alert + redirect to /company
│
└─ Try to access /admin (if not admin)
    → Redirect to /
```

---

## 11. TESTING SCENARIOS

### Scenario 1: Brand New Company
```
1. Land on homepage (/)
2. See "Create Campaign" button
3. Click button → Redirected to /register?role=company
4. Role is pre-selected as "Company"
5. Fill form: Name, Email, Password
6. Click "Register"
7. Auto-logged in → Redirected to /company
8. See "Create Campaign" form ready to use
```

### Scenario 2: Brand New Promoter
```
1. Land on homepage (/)
2. See "Join as Promoter" button
3. Click button → Redirected to /register?role=promoter
4. Role is pre-selected as "Promoter"
5. Fill form: Name, Email, Password
6. Click "Register"
7. Auto-logged in → Redirected to /dashboard
8. See available campaigns to join
```

### Scenario 3: Create Campaign & Pay
```
1. Login as company → At /company
2. Fill: Title, Description, Budget (₦5000)
3. Click "Pay & Create Campaign"
4. See loading spinner
5. Redirected to Paystack checkout
6. Enter card details & pay
7. Paystack confirms → Redirected to /company
8. New campaign visible in "Your Campaigns"
9. Status shows "Active"
```

### Scenario 4: Logout & Login as Different Role
```
1. Logged in as Company
2. Click Logout → Redirected to /
3. Click "Join as Promoter"
4. Register with different email
5. Auto-logged in as Promoter
6. Redirected to /dashboard
7. See promoter interface (not company dashboard)
```

---

## Summary

This visual flow guide covers:
- ✅ Complete user journeys for companies and promoters
- ✅ Navigation logic based on authentication state and role
- ✅ Button click logic with conditional routing
- ✅ Detailed Paystack payment flow
- ✅ Authentication state management
- ✅ Error handling across different scenarios
- ✅ API request/response cycles
- ✅ Protected vs public routes
- ✅ Practical testing scenarios

**Use this guide to understand how users interact with the system and for QA testing!**
