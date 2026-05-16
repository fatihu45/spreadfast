# ⚡ Paystack Payment Integration - Quick Start (for Nigeria)

**Time Required:** ~90 minutes

---

## PHASE 1: BACKEND SETUP (20 minutes)

### Step 1: Install Backend Packages
```bash
cd server
npm install bcryptjs jsonwebtoken dotenv cors axios
```
**Expected:** No errors, packages installed

### Step 2: Create server/.env
Copy this exactly to `server/.env`:
```
PORT=5000
NODE_ENV=development
JWT_SECRET=change-this-secret-in-production
CORS_ORIGIN=http://localhost:3000
PAYSTACK_SECRET_KEY=sk_test_your_secret_key_here
PAYSTACK_PUBLIC_KEY=pk_test_your_public_key_here
ADMIN_EMAIL=your-email@example.com
```

**⚠️ CRITICAL:** 
- Set `ADMIN_EMAIL` to YOUR email
- Get Paystack keys from [paystack.com](https://paystack.com)
- Keys must start with `sk_test_` and `pk_test_`

### Step 3: Create Folders
```bash
mkdir server/models
mkdir server/middleware
```

### Step 4: Create server/models/User.js
See AUTH_PAYMENT_PAYSTACK_GUIDE.md → PART 1, Step 3

### Step 5: Create server/middleware/auth.js
See AUTH_PAYMENT_PAYSTACK_GUIDE.md → PART 1, Step 3

### Step 6: Replace server/server.js
See AUTH_PAYMENT_PAYSTACK_GUIDE.md → PART 1, Step 4
(Copy the ENTIRE server.js file)

### Step 7: Test Backend
```bash
npm start
```

**Expected Output:**
```
🚀 Server running on http://localhost:5000
💳 Paystack Sandbox Mode: Testing payments with test keys
```

✅ **Phase 1 Complete**

---

## PHASE 2: FRONTEND SETUP (25 minutes)

### Step 8: Install Frontend Packages
```bash
cd client
npm install @paystack/inline-js axios
```

### Step 9: Create client/.env
```
REACT_APP_PAYSTACK_PUBLIC_KEY=pk_test_your_public_key_here
REACT_APP_ADMIN_EMAIL=your-email@example.com
```

**Same public key as server/.env!**

### Step 10: Create Auth Files

Create these folders:
```bash
mkdir -p client/src/context
mkdir -p client/src/pages
```

**Files to create:**
1. `client/src/context/AuthContext.js` (See guide → PART 2, Step 7)
2. `client/src/pages/Login.jsx` (See guide → PART 2, Step 8)
3. `client/src/pages/Register.jsx` (See guide → PART 2, Step 8)
4. `client/src/pages/Auth.css` (See guide → PART 2, Step 8)
5. `client/src/pages/Wallet.jsx` (Create new - see below)
6. `client/src/pages/AdminDashboard.jsx` (Create new - see below)

### Create client/src/pages/Wallet.jsx:
```javascript
import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import './Pages.css';

export default function Wallet() {
  const { user, token } = useContext(AuthContext);
  const [wallet, setWallet] = useState(null);
  const [bankDetails, setBankDetails] = useState(null);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchWallet();
  }, []);

  const fetchWallet = async () => {
    try {
      const response = await fetch('/api/wallet', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setWallet(data.wallet);
        setBankDetails(data.wallet.bankDetails);
      }
    } catch (error) {
      setError('Failed to load wallet');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawal = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!bankDetails) {
      setError('Add bank details first');
      return;
    }

    try {
      const response = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ amount: parseFloat(withdrawalAmount) })
      });

      const data = await response.json();
      if (data.success) {
        setSuccess('Withdrawal request submitted!');
        setWithdrawalAmount('');
        fetchWallet();
      } else {
        setError(data.message);
      }
    } catch (error) {
      setError('Withdrawal failed');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="wallet-container">
      <h1>My Wallet</h1>

      <div className="wallet-balance">
        <h2>Balance: ₦{wallet?.balance || 0}</h2>
      </div>

      <div className="wallet-section">
        <h3>Withdrawal</h3>
        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}

        <form onSubmit={handleWithdrawal}>
          <input
            type="number"
            placeholder="Withdrawal Amount (NGN)"
            value={withdrawalAmount}
            onChange={(e) => setWithdrawalAmount(e.target.value)}
            step="1000"
            required
          />
          <button type="submit">Request Withdrawal</button>
        </form>
      </div>
    </div>
  );
}
```

### Create client/src/pages/AdminDashboard.jsx:
```javascript
import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import './Pages.css';

export default function AdminDashboard() {
  const { user, token } = useContext(AuthContext);
  const [isAdmin, setIsAdmin] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    try {
      const response = await fetch('/api/admin/check', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setIsAdmin(data.isAdmin);

      if (data.isAdmin) {
        fetchData();
      }
    } catch (error) {
      console.error('Admin check failed:', error);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      const [campaignsRes, withdrawalsRes] = await Promise.all([
        fetch('/api/admin/campaigns', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch('/api/admin/withdrawals', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const campaignsData = await campaignsRes.json();
      const withdrawalsData = await withdrawalsRes.json();

      if (campaignsData.success) setCampaigns(campaignsData.campaigns);
      if (withdrawalsData.success) setWithdrawals(withdrawalsData.withdrawals);
    } catch (error) {
      console.error('Fetch data failed:', error);
    }
  };

  const approveSubmission = async (submissionId, amount) => {
    try {
      await fetch(`/api/admin/submissions/${submissionId}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'approved', approvalAmount: amount })
      });
      fetchData();
    } catch (error) {
      console.error('Approval failed:', error);
    }
  };

  const approveWithdrawal = async (withdrawalId) => {
    try {
      await fetch(`/api/admin/withdrawals/${withdrawalId}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'approved' })
      });
      fetchData();
    } catch (error) {
      console.error('Approval failed:', error);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!isAdmin) return <Navigate to="/" />;

  return (
    <div className="admin-dashboard">
      <h1>Admin Dashboard</h1>

      <div className="admin-section">
        <h2>Campaigns</h2>
        {campaigns.map(campaign => (
          <div key={campaign.id} className="admin-card">
            <h3>{campaign.title}</h3>
            <p>Company: {campaign.companyId}</p>
            <p>Budget: ₦{campaign.budget}</p>
            <p>Submissions: {campaign.submissions.length}</p>

            {campaign.submissions.map(sub => (
              <div key={sub.id} className="submission">
                <p>{sub.promoName} - {sub.status}</p>
                {sub.status === 'pending' && (
                  <button onClick={() => approveSubmission(sub.id, 5000)}>
                    Approve (₦5000)
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="admin-section">
        <h2>Withdrawals</h2>
        {withdrawals.map(withdrawal => (
          <div key={withdrawal.id} className="admin-card">
            <p>{withdrawal.userName} - ₦{withdrawal.amount}</p>
            <p>Status: {withdrawal.status}</p>
            {withdrawal.status === 'pending' && (
              <button onClick={() => approveWithdrawal(withdrawal.id)}>
                Approve Withdrawal
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Create client/src/pages/Pages.css:
```css
.wallet-container,
.admin-dashboard {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.wallet-balance {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 30px;
  border-radius: 10px;
  text-align: center;
  margin-bottom: 30px;
}

.wallet-section {
  background: white;
  padding: 20px;
  border-radius: 10px;
  border: 1px solid #ddd;
  margin-bottom: 20px;
}

.admin-card,
.admin-section {
  background: white;
  padding: 20px;
  border-radius: 10px;
  border: 1px solid #ddd;
  margin-bottom: 20px;
}

.submission {
  background: #f9f9f9;
  padding: 10px;
  margin: 10px 0;
  border-left: 4px solid #667eea;
}

button {
  background: #667eea;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 5px;
  cursor: pointer;
  margin-top: 10px;
}

button:hover {
  background: #5568d3;
}

.error {
  background: #fee;
  color: #c33;
  padding: 12px;
  border-radius: 5px;
  margin-bottom: 15px;
}

.success {
  background: #efe;
  color: #3c3;
  padding: 12px;
  border-radius: 5px;
  margin-bottom: 15px;
}
```

### Step 11: Update App.jsx
See AUTH_PAYMENT_PAYSTACK_GUIDE.md → PART 2, Step 11

### Step 12: Test Frontend
```bash
npm start
```

**Expected:** App opens at http://localhost:3000

✅ **Phase 2 Complete**

---

## PHASE 3: PAYSTACK CREDENTIALS (5 minutes)

### Step 13: Get Paystack Keys

1. **Go to [paystack.com](https://paystack.com)**
2. **Click "Create Account"**
3. **Fill in your details:**
   - Business Name: SpreadFast
   - Email: your-email@example.com
   - Password: Create one
4. **Verify your email**
5. **Log in to Dashboard**
6. **Go to: Settings → API Keys & Webhooks**
7. **You'll see:**
   - **Test Keys** (for development)
   - **Live Keys** (for real payments - after verification)

**Copy Test Keys:**
- Public Key: `pk_test_xxxxx`
- Secret Key: `sk_test_xxxxx`

### Step 14: Add Keys to Environment Files

**server/.env:**
```
PAYSTACK_PUBLIC_KEY=pk_test_xxxxx
PAYSTACK_SECRET_KEY=sk_test_xxxxx
```

**client/.env:**
```
REACT_APP_PAYSTACK_PUBLIC_KEY=pk_test_xxxxx
```

### Step 15: Restart Both Servers
```bash
# Terminal 1 - Backend
npm start

# Terminal 2 - Frontend
npm start
```

✅ **Phase 3 Complete**

---

## PHASE 4: TESTING (15 minutes)

### Test 1: User Registration
1. Go to http://localhost:3000/register
2. Fill in:
   - Name: Test Company
   - Email: testcompany@example.com
   - Password: Test123456
   - Role: Company
3. Click Register
4. Should redirect to home page

✅ **Registration works**

### Test 2: User Login
1. Go to http://localhost:3000/login
2. Use credentials from Test 1
3. Click Login
4. Should see dashboard

✅ **Login works**

### Test 3: Payment Initialization
1. Go to /company (or /dashboard)
2. Fill campaign form:
   - Title: "Test Campaign"
   - Budget: 5000
3. Click "Pay & Create Campaign"
4. Should redirect to Paystack payment page

✅ **Payment page appears**

### Test 4: Complete Test Payment
On Paystack test page:
1. Enter test card: `4111111111111111`
2. Expiry: Any future date (e.g., `05/25`)
3. CVC: Any 3 digits (e.g., `123`)
4. Email: auto-filled
5. Click "Pay"
6. Enter OTP when prompted: `123456`
7. Should redirect to success page

✅ **Payment successful**

### Test 5: Admin Dashboard
1. Make sure `ADMIN_EMAIL` in `.env` is YOUR email
2. Go to /admin
3. Should see admin panel
4. See campaigns & submissions

✅ **Admin access works**

### What You Should See After:
- ✅ User accounts created (stored in data/users.json)
- ✅ Campaign created (stored in data/campaigns.json)
- ✅ Payment recorded (stored in data/paystack_transactions.json)
- ✅ Admin dashboard accessible (only for ADMIN_EMAIL)
- ✅ Wallet shows balance
- ✅ Withdrawal requests tracked

---

## Quick Reference

| Feature | Status | Command |
|---------|--------|---------|
| Backend | ✅ Running | `cd server && npm start` |
| Frontend | ✅ Running | `cd client && npm start` |
| Paystack | ✅ Connected | API keys added |
| Payments | ✅ Working | Test card success |
| Admin | ✅ Secured | Only ADMIN_EMAIL |

---

## If Something Breaks

### "Payment not initializing"
```bash
# Check:
1. PAYSTACK_SECRET_KEY in server/.env starts with sk_test_
2. Restart backend: npm start
3. Check console for errors (F12)
```

### "Can't login"
```bash
# Check:
1. Backend running? (http://localhost:5000)
2. CORS_ORIGIN in server/.env is http://localhost:3000
3. Check data/users.json exists
```

### "Admin page redirects"
```bash
# Check:
1. ADMIN_EMAIL in client/.env matches server/.env
2. ADMIN_EMAIL matches your email exactly
3. Check browser console for errors
```

### "Card declined"
```bash
# Paystack test card: 4111111111111111
# Must be EXACT, including all 4111s
```

---

## Next Steps (After Testing)

1. ✅ Read full guide: AUTH_PAYMENT_PAYSTACK_GUIDE.md
2. ✅ Run verification checklist: AUTH_PAYMENT_VERIFICATION.md
3. ✅ Deploy to production:
   - Railway (backend)
   - Vercel (frontend)
4. ✅ Get live Paystack keys after verification
5. ✅ Deploy with live keys
6. ✅ Start accepting real payments in NGN!

---

## You're Ready! 🚀

You now have a fully functional payment system using Paystack for Nigerian operations.

**Questions?** Check AUTH_PAYMENT_PAYSTACK_GUIDE.md for detailed explanations and code.
