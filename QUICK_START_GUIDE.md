# Quick Reference Guide - Layout Restoration

## File Changes Summary

| File | Changes | Status |
|------|---------|--------|
| `src/App.jsx` | Landing page as public home, routing restructure | ✅ Updated |
| `src/App.css` | Green theme, global styles | ✅ Updated |
| `src/pages/Landing.jsx` | Smart CTA buttons, nav bar, full sections | ✅ Updated |
| `src/pages/Register.jsx` | Role pre-selection, query params | ✅ Updated |
| `src/pages/CompanyDashboard.jsx` | Complete redesign with Paystack integration | ✅ Updated |
| `src/pages/CompanyDashboard.css` | Tailwind-first approach | ✅ Updated |
| `src/pages/Auth.css` | Green theme, improved styling | ✅ Updated |

---

## URLs at a Glance

### User-Facing Routes
```
/                    Landing Page (Home)
/login               Login
/register            Register (with ?role=company or ?role=promoter)
/dashboard           Promoter Dashboard
/company             Company Dashboard
/wallet              Wallet
/payment-callback    Payment Callback Handler
/admin               Admin Dashboard
```

### To Test Pre-Selection
```
/register?role=company    → Register pre-selected as Company
/register?role=promoter   → Register pre-selected as Promoter
```

---

## Color Scheme Quick Ref

### Primary Green (#1B5E20)
```css
/* CSS */
color: #1B5E20;
background: #1B5E20;

/* Tailwind */
className="bg-green-700 text-green-700 border-green-700"
```

### Hover Green (#145A1E darker)
```css
/* CSS */
color: #145a1e;
background: #145a1e;

/* Tailwind */
className="hover:bg-green-800"
```

---

## Key Component Props & Methods

### AuthContext (from `/context/AuthContext.js`)
```jsx
const { 
  user,          // { id, name, email, role }
  token,         // JWT string
  loading,       // boolean
  register,      // (name, email, pwd, role) → Promise
  login,         // (email, pwd) → Promise
  logout         // () → void
} = useContext(AuthContext);
```

### API Utilities (from `/utils/api.js`)
```jsx
// Public API call
await apiCall('/api/campaigns');

// Authenticated API call
await apiCallAuth('/api/payments/initiate', token, {
  method: 'POST',
  body: JSON.stringify({ amount, campaignName })
});
```

---

## Common Tasks

### Redirect Based on Auth Status
```jsx
const navigate = useNavigate();
const { user, loading } = useContext(AuthContext);

if (!user && !loading) {
  navigate('/login');
}
```

### Check User Role
```jsx
const { user } = useContext(AuthContext);

if (user?.role === 'company') {
  // Show company features
}
```

### Show/Hide Based on Auth
```jsx
const { user } = useContext(AuthContext);

{user ? (
  <div>Welcome, {user.name}!</div>
) : (
  <div><a href="/login">Login</a></div>
)}
```

---

## API Endpoints Reference

### Authentication
```
POST /api/auth/register
  { name, email, password, role }
  → { success, user, token, message }

POST /api/auth/login
  { email, password }
  → { success, user, token, message }

GET /api/auth/me
  Headers: { Authorization: Bearer <token> }
  → { success, user }
```

### Payments
```
POST /api/payments/initiate
  Headers: { Authorization: Bearer <token> }
  { amount, campaignName, campaignDescription }
  → { success, authorizationUrl }
```

---

## Error Messages to Expect

### Registration
- "Email already exists"
- "Password too short"
- "Name required"

### Login
- "Invalid email or password"

### Campaign Creation
- "Campaign title and budget are required"
- "Budget must be at least ₦100"
- "Payment initialization failed"

### Access Control
- "Only companies can create campaigns"
- "Please login as a promoter to join campaigns"

---

## Debugging Tips

### Button not redirecting
```jsx
// ✅ Correct
const navigate = useNavigate();
<button onClick={() => navigate('/page')}>
```

### Paystack URL not working
```jsx
// ✅ Correct
window.location.href = paymentUrl;
```

### Form not submitting
```jsx
// ✅ Correct
const handleSubmit = (e) => {
  e.preventDefault();
  // ...
}
```

### Styles not applying
```jsx
// ✅ Correct Tailwind class
className="bg-green-700"
```

---

## Quick Checklist Before Deployment

### Functionality
- [ ] Landing page loads
- [ ] Registration with role pre-selection works
- [ ] Login works
- [ ] Company dashboard for companies
- [ ] Promoter dashboard for promoters
- [ ] Paystack payment initiates
- [ ] Campaign creation successful
- [ ] Logout works

### Styling
- [ ] Green color consistent (#1B5E20)
- [ ] Responsive on mobile
- [ ] Buttons have hover states
- [ ] Form focus rings visible

### Testing
- [ ] Sign up as company
- [ ] Create campaign
- [ ] Make test payment
- [ ] Sign up as promoter
- [ ] Test on mobile devices

---

## File Locations

| What | Where |
|------|-------|
| Homepage | `src/pages/Landing.jsx` |
| Company Dashboard | `src/pages/CompanyDashboard.jsx` |
| Registration | `src/pages/Register.jsx` |
| Auth Context | `src/context/AuthContext.js` |
| Routing | `src/App.jsx` |
| Global CSS | `src/App.css` |
| Auth Styling | `src/pages/Auth.css` |

---

## Status Summary

✅ **Landing Page** - Restored with smart CTAs  
✅ **Authentication** - Role-based registration  
✅ **Company Dashboard** - Redesigned with Paystack  
✅ **Styling** - Green theme throughout  
✅ **Paystack Integration** - Fully implemented  
✅ **User Experience** - Cohesive and intuitive  

**Ready for Testing and Deployment!**
