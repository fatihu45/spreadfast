# Quick Ads admin analytics

Open the existing Admin Dashboard and select **Quick Ads Revenue** in its desktop or mobile navigation.
This is a read-only section; payment verification, credit purchases, free-preview locks and generation
billing are unchanged. No historical records are rewritten, and no second payment ledger is created.

## Backend and configuration

`GET /api/admin/quick-ads/analytics` uses the existing admin router's JWT authentication and configured
`ADMIN_EMAIL` guard. Other users receive 403; unauthenticated users receive 401. Responses are not cached.
The endpoint reads existing records in one MongoDB transaction and returns only selected reporting fields,
never provider URLs, API keys, passwords or raw configuration values.

Set these **backend-only variables in Render**, using your provider estimate and chosen exchange rate:

```dotenv
QUICK_AD_GENERATION_COST_USD=
USD_NGN_RATE=
```

No new Vercel/frontend environment variables are required. Do not add `REACT_APP_` prefixes to these values.
The existing frontend API URL and backend authentication/database configuration remain in use.
Missing/invalid cost settings produce `null` estimates and a “Not configured” state, rather than invented zero costs.
The USD cost may explicitly be zero; the exchange rate must be positive. Current settings apply to all historical
completed generations, so these are internal estimates, not provider invoices or changes to customer billing.

## Calculation rules

A purchase belongs to Quick Ads only when `purpose === "quick_ad_credits"`, which the existing checkout
already sets. A counted payment must also have `status === "completed"`, `creditsApplied === true` and a valid
`verifiedAt`. These markers are written atomically by the existing backend after Paystack verification.
References are deduplicated. Verified copies take precedence over pending duplicates; conflicting settled
duplicates or invalid settled amounts fail the report safely rather than inventing totals.

| Metric | Backend calculation |
| --- | --- |
| Total revenue | Sum of stored amounts on distinct verified Quick Ads purchases; summed in kobo, returned in naira. |
| Credits sold | Sum of stored credit quantities on those purchases. |
| Credits used | Count of distinct completed generation IDs with `creditUsed === true` and `freePreview === false`. |
| Credits remaining | Credits sold minus credits used; unrelated/free balance adjustments are excluded. |
| Ads generated | Count of distinct completed generation IDs, including successful free previews. Failed/pending records are excluded. |
| Estimated AI cost | Completed generation count × `QUICK_AD_GENERATION_COST_USD` × `USD_NGN_RATE`, rounded to two naira decimals. |
| Estimated gross profit | Revenue minus estimated AI cost. |
| Estimated gross margin | Profit / revenue × 100, rounded to one decimal; 0% if revenue is zero. |

Generation records are the reporting source instead of adding user counters to them, which would double-count
the same activity. Records for deleted businesses remain included. A negative remaining-credit result is shown
with a reconciliation warning, not silently clamped. Estimates exclude failed provider attempts, payment fees,
storage and other expenses.

The transactions table shows the latest 50 distinct purchases, including pending/failed purchases for visibility.
Unverified entries show no paid amount/date and award zero purchased credits in the report. Summary totals use
all verified purchases, not just those 50 rows. Plan names come from the existing catalog; financial amounts
and credit quantities always come from the saved transaction, preserving historical bundle prices.

The usage table includes current Company and Promoter accounts plus accounts with completed/purchased activity. Transactions show saved buyerRole (falling back to the current account role for legacy records); usage shows account type. It shows current
balances for operational reference, completed-generation counts, paid credits purchased (the number of
generations purchased), latest completion date and account creation date. Missing dates are shown as —.
Deleted accounts retain their usage but show an unavailable current balance. Tables scroll horizontally on mobile.

## Files changed

- Created `server/services/quickAdAnalytics.js`: reporting calculations and read-only data retrieval.
- Updated `server/routes/admin.js`: authenticated analytics endpoint with safe errors.
- Created `server/tests/quickAdAnalytics.test.js`: calculations, duplicates, estimate configuration and access tests.
- Updated `server/tests/campaignPricing.test.js`: allow the new real service in the isolated admin-route test harness.
- Created `client/src/components/AdminQuickAdsAnalytics.jsx`: cards, tables, independent loading/error/retry states.
- Updated `client/src/pages/AdminDashboard.jsx`: existing-shell navigation and analytics section.
- Updated `client/src/pages/AdminDashboard.css`: scoped responsive table styling.
- Updated `client/src/pages/AdminDashboard.test.jsx`: analytics rendering and existing-flow regression coverage.
- Updated `.env.example`: blank backend estimate settings.
- Created this guide.

## Manual testing checklist

1. Set the two backend estimate settings and restart/redeploy the backend; open Admin → Quick Ads Revenue.
2. Verify an ordinary company/creator token receives 403 and no token receives 401 at the endpoint.
3. Complete a Starter checkout in Paystack test mode: revenue must rise by ₦5,000 and sold credits by 3,
   not ₦5,100. Repeat verification/callback/webhook: totals must not rise again.
4. Start an unpaid/failed checkout and a campaign purchase: neither may increase Quick Ads revenue or sold credits.
5. Complete a free preview: generated count and estimated cost rise; paid usage and remaining paid credits do not change.
6. Complete a paid generation: used rises by 1, remaining falls by 1, generated count rises by 1. A failed generation changes none.
7. Check transactions, business names/emails, plan quantities and payment dates against backend records.
8. Remove either estimate setting: revenue/usage remain visible, but cost/profit/margin show “Not configured.”
9. Test an empty database: totals are zero, empty states render, and margin never becomes NaN/Infinity.
10. Simulate endpoint failure: retry works and campaign/submission/withdrawal tabs remain available.
11. On a narrow screen, verify navigation, stacked cards and independently scrollable tables without page overflow.

Paystack test mode does not make fal.ai generations or Cloudinary processing free. Existing test-mode payments
remain included: the historical transaction schema does not persist Paystack test/live domain, so this report
does not claim to separate test revenue from live revenue.
