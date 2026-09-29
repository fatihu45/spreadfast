# Audit fixes ? 29 September 2026

## Changes

- Removed the unauthenticated /api/test-email endpoint.
- Added explicit public campaign response fields. Owners/admins retain management details; authenticated creators see their own membership, and everyone sees only an aggregate participant count for other creators. Updated dashboard requests to supply authentication and marketplace slot calculations to use that count.
- Replaced raw backend HTTP error logging with a credential-free code/status summary.
- Redirected the unfinished /dashboard to existing role dashboards.
- Corrected campaign email links; retained /campaigns as a compatibility redirect.
- Preserved protected-page and campaign-payment return destinations across login. Login now uses React Router navigation and existing in-memory authentication instead of polling unguarded browser storage and reloading the page. External return destinations are rejected.
- Added an unknown-page recovery view and deployment fallback for all frontend routes.
- Replaced placeholder footer links with an existing relevant section.
- Corrected REACT_APP_API_URL in .env.example. No secret values or existing environment files were modified.
- Removed unused API exports containing undefined references and invalid legacy endpoints. The two retained compatibility helpers use the current shared API layer.

## Files

Frontend source: client/src/App.jsx; pages/Dashboard.jsx, Login.jsx, PaymentCallback.jsx, Landing.jsx, CompanyDashboard.jsx, AvailableCampaigns.jsx, PromotionDashboard.jsx; utils/api.js; client/vercel.json.

Backend source: server/server.js; new services/campaignView.js and services/safeError.js.

Configuration: .env.example.

Regression coverage: client/src/QuickAdsNavigation.test.jsx; pages/Login.test.jsx, Landing.test.jsx, CompanyDashboard.test.jsx, AvailableCampaigns.test.jsx, PromotionDashboard.test.jsx; server/tests/campaignPricing.test.js; new server/tests/auditFixes.test.js.

## Verification scope

Production frontend build passed. Backend test suite and additional privacy/route/logging regressions passed. All 181 frontend tests across 22 suites passed. Targeted strict lint passed for the changed routing, login, callback, landing, and shared API code.

No live payments, email sends, AI generations, or production database writes were performed. Deployment refreshes and real-device/end-to-end provider checks still need staging verification. Existing broad test-library lint/style warnings and unrelated effect-dependency warnings were not treated as runtime failures or suppressed. The earlier provider/model configurability gap and public media-preview policy require separate scoped work; this patch does not change generation providers or convert public campaign media into private assets.
