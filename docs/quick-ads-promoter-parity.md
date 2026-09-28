# Quick Ads: Company and Promoter parity

The two dashboards already shared QuickAd.jsx, QuickAdCredits.jsx, API routes and the User model. Company-only guards were preventing Promoters from using generation, balances, checkout, and protected preview playback. The checkout success link also always returned to the Company dashboard.

Both roles now use the same components, prices, Paystack configuration, verification service, generation service and media permissions. Existing desktop/mobile navigation and routes are retained. Campaign creation remains Company-only.

## Files in this change

New:
- server/services/quickAdAccess.js
- docs/quick-ads-promoter-parity.md

Updated application files:
- server/server.js — optional buyerRole on the existing PaystackTransaction schema.
- server/routes/quickAds.js — shared Company/Promoter generation access.
- server/routes/quickAdMedia.js — shared account and protected-preview access.
- server/routes/quickAdPayments.js — shared checkout access; authenticated buyer role stored on purchases and Paystack metadata.
- server/services/quickAdCredits.js — both roles eligible for the existing transactional generation flow.
- server/services/quickAdAnalytics.js — include Promoter accounts and report buyer/account types.
- client/src/utils/quickAdsApi.js — shared eligibility and role-specific return route.
- client/src/pages/QuickAd.jsx — shared credits/generation UI; separate existing Company campaign permission.
- client/src/pages/QuickAdCredits.jsx — shared purchasing and role-correct success link.
- client/src/components/AdminQuickAdsAnalytics.jsx — account-type columns.
- docs/quick-ads-credits.md — shared-role endpoint documentation.
- docs/quick-ads-admin-analytics.md — account-type reporting documentation.

Updated tests:
- server/tests/quickAdCredits.test.js
- server/tests/quickAdPayments.test.js
- server/tests/quickAdMedia.test.js
- server/tests/quickAds.test.js
- server/tests/quickAdAnalytics.test.js
- client/src/pages/QuickAd.test.jsx
- client/src/pages/QuickAdCredits.test.jsx
- client/src/pages/AdminDashboard.test.jsx
- client/src/QuickAdsNavigation.test.jsx

## Storage and safeguards

Credits remain on the shared User record: quickAdCredits, quickAdsGenerated, quickAdFreePreviewUsed, quickAdTotalCreditsPurchased and quickAdTotalCreditsUsed. Existing zero defaults apply to both roles. No separate wallet, migration, balance reset or historical transaction rewrite is needed.

Existing authentication resolves the current account ID, role, active status and session version. Quick Ads permits company and promoter roles; ownership checks still query by the authenticated user ID. Preview tokens also check current account status and session version.

Purchases use the existing PaystackTransaction collection: userId, optional buyerRole, amount, planId, credits, reference, purpose=quick_ad_credits, status and creditsApplied. Only planId is accepted from checkout requests; price, credits and owner come from trusted backend data. Legacy records without buyerRole remain valid; analytics falls back to the current account role, or Unknown when unavailable.

Verification still calls Paystack directly and checks payment status, reference, currency, amount and purchaser email. The balance increment and creditsApplied marker commit in the same Mongo transaction. Repeated verification and callback/webhook races do not award twice. No frontend success flag can award credits.

Generation reserves the account's allowance without decrementing it. Successful paid completion atomically decrements one credit and records usage. The existing per-account reservation and idempotency key prevent concurrent spending and repeated completion charges. Failure, timeout or cancellation before completion releases the reservation without charging. A successfully completed generation is charged even if its response is subsequently lost; recovery retrieves that result without charging again.

The first successful free preview uses no paid credit. It remains locked after purchases. Playback exposes only the protected watermarked preview stream; the backend denies original download/export. Browser-visible previews are not DRM and can be recorded. Paid generations retain owned download/export access.

Prices, API keys, environment variables, campaign payments, withdrawals, auth middleware and admin permissions are unchanged. No commit, push or production migration was performed.

## Manual acceptance checklist

Validation completed locally:
- Full backend suite: 107 tests passed; after adding the explicit disconnect case, all 22 generation tests passed again.
- Full frontend suite: 169 tests across 22 suites passed; after the final assertions, all 58 tests in the four updated frontend suites passed.
- Production frontend build compiled successfully. Only the existing stale Browserslist-data warning remained.
- server/server.js syntax check and git diff --check passed (Git emitted existing line-ending notices).
- External Paystack/Cloudinary/fal calls were mocked in automated tests. No live purchase or generation was made.

Use staging, Paystack test keys and isolated Company/Promoter accounts. Real checkout, provider generation and device testing are separate from mocked automated tests.

Promoter:
1. Open Quick Ads from desktop navigation; verify the existing dashboard wrapper.
2. Compare the displayed balance with the backend credits response.
3. With preview already used and zero credits, verify Buy Credits replaces paid generation; direct generation returns NO_QUICK_AD_CREDITS.
4. Open Buy Credits and verify /quickads/credits retains Promoter navigation.
5. Confirm plans: 1/₦1,700, 3/₦5,000, 6/₦10,000, 11/₦20,000.
6. Select a plan; inspect that the request sends only planId.
7. Confirm Paystack test checkout opens. Cancel once and verify no credits are added or removed.
8. Complete a test payment and confirm backend verification succeeds.
9. Confirm exactly the purchased credits are added to that Promoter account.
10. Confirm the success page displays the backend balance; Create Quick Ad returns to /promoter/quick-ads without logout.
11. Upload a supported photo and generate a paid ad; verify loading and playable result.
12. Confirm exactly one credit is deducted after success and Save video works.
13. Simulate provider failure/timeout and cancellation before completion; confirm no credit deduction and safe retry/recovery.
14. Refresh Quick Ads and the credits page; confirm balances persist without logout.
15. Reload/reverify the same payment reference and replay its test webhook; confirm no additional credit award.
16. Using two accounts of different roles, attempt foreign generation, download, export, request recovery and payment verification; expect denial and no foreign history.
17. On a fresh Promoter, generate one free preview. Verify no credit debit, no original URL, denied download/export, and continued lock after purchasing credits. Generate a new paid ad to download.
18. On tablet/mobile and Safari, check navigation, pricing cards, upload, inline video playback, Preview Again and paid download/share behavior.

Company regression:
19. Open Company Quick Ads and confirm balance/free-preview eligibility.
20. Buy credits through Paystack test checkout, verify once, and confirm the Company success link.
21. Generate a paid ad and confirm native preview controls, style selection and upload validation.
22. Confirm one debit after success, none after failure, and zero-credit handling.
23. Check existing desktop/mobile UI, paid downloads and Company campaign handoff. Confirm campaign payments and Promoter withdrawals still behave normally.

Admin:
24. Confirm a verified Promoter purchase contributes its actual amount to Quick Ads revenue.
25. Confirm its purchased credits contribute once to total credits sold.
26. Confirm completed Promoter generations contribute to generation totals, with only paid generations contributing to credits used.
27. Confirm purchases show Promoter/Company buyer type; legacy records fall back safely, and Promoter usage rows show the current balance.

Automated checks cover shared ownership, payment replay/races, failure handling, transactional deduction, preview locks, pricing, role-specific navigation and existing Company regressions. Device rendering and actual external service availability require the manual checks above.
