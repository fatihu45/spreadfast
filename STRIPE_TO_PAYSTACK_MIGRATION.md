# 🔄 Stripe to Paystack Migration - What Changed

## Summary

All guides have been **updated from Stripe to Paystack** for Nigerian operations.

---

## Files Created/Updated

### Original Stripe Files (Keep for Reference)
- ✅ `AUTH_PAYMENT_GUIDE.md` - Original Stripe version
- ✅ `AUTH_PAYMENT_QUICK_START.md` - Original Stripe version
- ✅ `AUTH_PAYMENT_VERIFICATION.md` - Original Stripe version

### NEW Paystack Files (Use These Now!)
- 🆕 `AUTH_PAYMENT_PAYSTACK_GUIDE.md` - **Complete technical guide (USE THIS)**
- 🆕 `AUTH_PAYMENT_PAYSTACK_QUICK_START.md` - **Fast implementation (USE THIS)**
- 🆕 `AUTH_PAYMENT_VERIFICATION_PAYSTACK.md` - **Verification checklist (USE THIS)**

---

## What Changed: Stripe → Paystack

### 1. Payment Gateway
| Aspect | Stripe | Paystack |
|--------|--------|----------|
| **Region** | Global (USD/EUR) | Nigeria (NGN) |
| **API Type** | Payment Intent | Transaction Initialize |
| **Frontend** | Stripe Elements | Paystack Link |
| **Fees** | ~2.9% + $0.30 | ~1.5% (Nigeria) |
| **Currency** | Multiple | NGN (Naira) |
| **Best For** | Global | Nigeria ✅ |

### 2. Amount Handling
```javascript
// STRIPE - Amount in cents (USD)
amount: 5000  // = $50.00

// PAYSTACK - Amount in kobo (NGN)
amount: 500000  // = ₦5000 (amount * 100)
// Gets converted back: / 100 to display
```

### 3. Payment Flow

**Stripe:**
```
React Component → Stripe.js Elements → Pay Button → 
→ Create Payment Intent (backend) → Complete Payment
```

**Paystack:**
```
React Component → Initiate Payment (backend) → 
→ Redirect to Paystack Page → Complete Payment → 
→ Verify & Return
```

### 4. Backend Changes

**Stripe:**
```javascript
const stripe = require('stripe')(secretKey);
const paymentIntent = await stripe.paymentIntents.create({
  amount: 500000,  // in cents
  currency: 'usd',
  metadata: {...}
});
```

**Paystack:**
```javascript
const response = await axios.post('https://api.paystack.co/transaction/initialize', {
  email: user.email,
  amount: Math.round(amount * 100),  // convert Naira to kobo
  metadata: {...}
});
// Returns: authorizationUrl for redirect
```

### 5. Environment Variables

**Stripe:**
```
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_PUBLIC_KEY=pk_test_xxxxx
```

**Paystack:**
```
PAYSTACK_SECRET_KEY=sk_test_xxxxx
PAYSTACK_PUBLIC_KEY=pk_test_xxxxx
```

### 6. Frontend Libraries

**Stripe:**
```bash
npm install @stripe/react-stripe-js @stripe/js
```

**Paystack:**
```bash
npm install @paystack/inline-js axios
```

### 7. Frontend Component

**Stripe:**
```javascript
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(STRIPE_KEY);

<Elements stripe={stripePromise}>
  <PaymentForm />
</Elements>
```

**Paystack:**
```javascript
// Paystack uses redirect (no special wrapper needed)
// Initialize payment → Redirect to Paystack page
// User completes payment → Returns to your app
```

### 8. Payment Verification

**Stripe:**
```javascript
// Using webhook or manual verification
const paymentIntent = await stripe.paymentIntents.retrieve(id);
const isSuccessful = paymentIntent.status === 'succeeded';
```

**Paystack:**
```javascript
// Using reference verification
const response = await axios.get(
  `https://api.paystack.co/transaction/verify/${reference}`,
  { headers: { Authorization: `Bearer ${secretKey}` }}
);
const isSuccessful = response.data.data.status === 'success';
```

---

## Feature Comparison

| Feature | Stripe | Paystack |
|---------|--------|----------|
| NGN Currency | ❌ No | ✅ Yes |
| Easy Setup | ✅ Yes | ✅ Yes |
| Test Mode | ✅ Yes | ✅ Yes |
| Webhooks | ✅ Yes | ✅ Yes |
| Settlement | Bank | Bank |
| Support (Nigeria) | Limited | Excellent |
| Documentation | Excellent | Good |
| Fees | Higher | Lower |
| Ideal For | Global | Nigeria |

---

## Test Card Changes

### Stripe Test Card
```
Card: 4242 4242 4242 4242
Expiry: Any future date
CVC: Any 3 digits
```

### Paystack Test Card
```
Card: 4111 1111 1111 1111  (Must be EXACT)
Expiry: Any future date
CVC: Any 3 digits
OTP: 123456 (if prompted)
```

---

## Implementation Timeline

### Same as before, just use Paystack guides
| Phase | Time | What |
|-------|------|------|
| Phase 1 | 20 min | Backend setup (auth + Paystack routes) |
| Phase 2 | 25 min | Frontend (React pages + forms) |
| Phase 3 | 5 min | Get Paystack credentials |
| Phase 4 | 15 min | Test payment flow |
| **Total** | **~65 min** | **Complete** |

---

## Which Files to Use?

### ✅ USE THESE (Paystack for Nigeria)
1. **AUTH_PAYMENT_PAYSTACK_GUIDE.md** - Full technical guide
2. **AUTH_PAYMENT_PAYSTACK_QUICK_START.md** - Fast implementation
3. **AUTH_PAYMENT_VERIFICATION_PAYSTACK.md** - Verification checklist

### ❌ Don't use (Stripe - old version)
- AUTH_PAYMENT_GUIDE.md
- AUTH_PAYMENT_QUICK_START.md
- AUTH_PAYMENT_VERIFICATION.md

---

## Key Advantages of Paystack for Your Setup

✅ **NGN Currency** - Prices in Nigerian Naira (no conversion)
✅ **Lower Fees** - ~1.5% vs Stripe's 2.9%+$0.30
✅ **Better Local Support** - Paystack is Nigeria-based
✅ **Easy Bank Transfers** - Direct to Nigerian banks
✅ **Better UX** - Familiar for Nigerian users
✅ **Same Security** - Industry-standard encryption
✅ **Same Features** - Auth, payments, webhooks, etc.

---

## Database Changes

The data structure remains **mostly the same**:

```json
// Same user structure
{
  "id": "uuid",
  "email": "user@example.com",
  "password": "hashed",
  "walletBalance": 0
}

// Same campaign structure  
{
  "id": "uuid",
  "title": "Campaign",
  "budget": 5000,        // NOW in ₦ (Naira) instead of USD
  "paystackReference": "..." // Changed from stripeReference
}

// Same transaction tracking
{
  "reference": "...",     // Paystack reference
  "amount": 5000,         // ₦ (Naira)
  "status": "completed"
}
```

---

## API Routes - No Change to Structure

The route structure is identical:
```
/api/auth/register     - Same
/api/auth/login        - Same
/api/payments/initiate - Same endpoint, Paystack API inside
/api/payments/verify   - Same endpoint, Paystack API inside
/api/campaigns         - Same
/api/wallet            - Same
/api/admin/*           - Same
```

---

## Environment Variable Migration

### Before (Server .env)
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLIC_KEY=pk_test_...
```

### After (Server .env)
```
PAYSTACK_SECRET_KEY=sk_test_...
PAYSTACK_PUBLIC_KEY=pk_test_...
```

### Before (Client .env)
```
REACT_APP_STRIPE_PUBLIC_KEY=pk_test_...
```

### After (Client .env)
```
REACT_APP_PAYSTACK_PUBLIC_KEY=pk_test_...
```

---

## Code Snippet Differences

### Backend Payment Route

**Stripe:**
```javascript
const paymentIntent = await stripe.paymentIntents.create({
  amount: Math.round(budget * 100),  // Convert to cents
  currency: 'usd',
  metadata: { campaignName, userId }
});
res.json({ clientSecret: paymentIntent.client_secret });
```

**Paystack:**
```javascript
const response = await axios.post('https://api.paystack.co/transaction/initialize', {
  email: user.email,
  amount: Math.round(budget * 100),  // Convert to kobo (NGN units)
  metadata: { campaignName, userId }
});
res.json({ authorizationUrl: response.data.data.authorization_url });
```

### Frontend Payment Initiation

**Stripe:**
```javascript
const { clientSecret } = await fetch('/api/payments/initiate').json();
// Then use Stripe.js to handle payment
```

**Paystack:**
```javascript
const { authorizationUrl } = await fetch('/api/payments/initiate').json();
window.location.href = authorizationUrl;  // Redirect to Paystack
```

---

## Production Deployment Steps

### Same process, just switch keys:

1. **Get Live Paystack Keys**
   - Complete Paystack verification
   - Receive live keys: `pk_live_` and `sk_live_`

2. **Update Environment**
   ```
   PAYSTACK_SECRET_KEY=sk_live_...
   PAYSTACK_PUBLIC_KEY=pk_live_...
   ```

3. **Deploy**
   - Railway (backend)
   - Vercel (frontend)
   - Use live keys in production environment

4. **Test**
   - Use real test card first
   - Then process real payments

---

## Troubleshooting Guide

### Q: "Payment initialization failed"
**A:** Check `PAYSTACK_SECRET_KEY` is set correctly and starts with `sk_test_`

### Q: "Redirect not happening"
**A:** Check console for errors, verify `authorizationUrl` is returned from backend

### Q: "Card declined in test mode"
**A:** Use exact card: `4111111111111111`, any future expiry, any 3-digit CVC

### Q: "OTP not working"
**A:** Test OTP is always `123456` in Paystack sandbox

### Q: "Can't see admin dashboard"
**A:** Make sure `ADMIN_EMAIL` is set to your actual email address (same in both server and client .env)

---

## Going from Stripe to Paystack Checklist

- [ ] Read `AUTH_PAYMENT_PAYSTACK_GUIDE.md`
- [ ] Create Paystack account at paystack.com
- [ ] Get test API keys
- [ ] Follow `AUTH_PAYMENT_PAYSTACK_QUICK_START.md`
- [ ] Run through all tests in `AUTH_PAYMENT_VERIFICATION_PAYSTACK.md`
- [ ] Verify everything works
- [ ] Deploy to production
- [ ] Get live Paystack keys after verification
- [ ] Update production environment variables
- [ ] Enable live payments
- [ ] Monitor transactions

---

## Support Resources

### Paystack Official
- **Website:** https://paystack.com
- **Documentation:** https://paystack.com/docs
- **Dashboard:** https://dashboard.paystack.com

### Your Implementation
- **Technical Guide:** AUTH_PAYMENT_PAYSTACK_GUIDE.md
- **Quick Start:** AUTH_PAYMENT_PAYSTACK_QUICK_START.md
- **Verification:** AUTH_PAYMENT_VERIFICATION_PAYSTACK.md

---

## Currency Note

All prices are now in **Nigerian Naira (₦)**:

```
₦100    = 1 Naira (minimum)
₦1,000  = 1000 Naira
₦10,000 = 10 Thousand Naira (average campaign)
₦100,000= 100 Thousand Naira
```

No more conversion from USD/EUR!

---

## Summary

**Before:** Stripe for global, multi-currency, fees 2.9%+$0.30
**Now:** Paystack for Nigeria, NGN only, fees ~1.5%

Everything else works the same way. Just use the new Paystack guides!

**Start with:** `AUTH_PAYMENT_PAYSTACK_GUIDE.md`

---

**Ready to switch to Paystack?** 🚀

Use the Paystack guides and follow the same implementation steps. You'll have a fully functional Nigerian payment system in ~90 minutes!
