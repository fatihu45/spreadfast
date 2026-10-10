# Quick Ads credits

## Configuration

Prices, credit amounts, labels and recommended plan live in `server/config/quickAdPlans.js`.
The frontend retrieves this catalog and submits only `planId`. Existing pending purchases retain
their saved price and credit amount when the catalog changes.

Current Quick Ads credit packages are ₦1,700 for 1 credit, ₦5,000 for 4 credits,
₦10,000 for 8 credits, and ₦20,000 for 16 credits. Each credit covers one successful
paid video generation. Bundle quantities are selected by the backend plan catalog.

Reuse the existing configuration:

- `REACT_APP_API_URL`: frontend backend origin.
- `CLIENT_URL`: frontend origin, used for the Paystack callback and existing CORS configuration.
- `JWT_SECRET`: authentication and separately derived, scoped preview-token signing.
- Existing `MONGODB_URI`: a replica set or Atlas with transaction support is required.
  Financial writes fail closed when transactional MongoDB is unavailable; no JSON credit fallback.
- Existing Paystack `PAYSTACK_TEST_SECRET_KEY` / `PAYSTACK_TEST_PUBLIC_KEY`, or
  `PAYSTACK_LIVE_SECRET_KEY` / `PAYSTACK_LIVE_PUBLIC_KEY` in production.
- Existing `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` and
  `FAL_KEY` remain server-side. No new provider keys.

Keep the existing Paystack webhook at `/api/payments/webhook`. It verifies the raw-body signature
and verifies Quick Ads purchases directly with Paystack before applying credits.

## Routes

UI: `/quickads/credits`, protected by existing authentication and dashboard shell.

Under `/api/quick-ads`:

- `GET /plans`: public backend plan catalog.
- `GET /credits`: own Company or Promoter balance and free-preview eligibility.
- `POST /generate`: existing multipart image/style generation, optional `Idempotency-Key` header.
- `GET /requests/:key`: recover an interrupted generation by its owner-scoped request key.
- `GET /generations/:id`: own result metadata and renewed preview token.
- `GET /generations/:id/preview?token=...`: scoped, five-minute watermarked preview stream.
- `GET /generations/:id/download`: authenticated owner-only paid or unlocked-trial download.
- `GET /generations/:id/export`: authenticated owner-only paid or unlocked-trial campaign handoff.
- `POST /credits/initialize`: authenticated Company or Promoter purchase, body `{ "planId": "starter" }`. The existing transaction stores the authenticated userId and buyerRole.
- `GET /credits/verify/:reference`: owner-scoped Paystack verification.
- `GET /transactions`: own most recent 50 Quick Ads purchases.

## Accounting and media

New and existing accounts without credit fields start at zero and have one unused preview.
The first successful preview sets `quickAdFreePreviewUsed`; it never spends a credit. Its original unlocks after the first verified Quick Ads credit purchase,
using the server-owned lifetime purchase counter even when the remaining balance reaches zero. Failed generation leaves eligibility intact.

An expiring per-account reservation prevents concurrent generations from spending the same credit.
It does not debit money. After provider success and protected media storage, a MongoDB transaction
completes the generation and updates counters atomically. Paid success uses exactly one credit.
Replaying a completed request key returns its recorded result without another provider request/debit.
The frontend stores an unresolved request key for recovery rather than silently submitting again.

Generated videos are copied to authenticated Cloudinary storage. Locked trial responses contain no original
provider or Cloudinary video URL. The backend streams only an eagerly generated watermarked derivative
using a scoped expiring token, supports Safari byte ranges, and rejects download/export requests until a verified purchase unlocks the trial.
Playable browser previews can still be screen-recorded or their derivative captured; this is protection
of the original and export permissions, not DRM or a promise that displayed pixels cannot be copied.

Paid results support downloads and the existing editable campaign creation flow. No campaign logic is
duplicated. Quick Ads payment references cannot be reused to fund campaigns.

## Payments

Purchases use the existing shared Paystack transaction model, keys and webhook. Each record stores a
trusted plan snapshot, owner, reference, amount, credits and processed flag. Verification checks Paystack's
successful status, NGN currency, reference, exact amount and customer email. The processed marker and
balance increment commit together, so retries and concurrent webhook/callback verification award once.
Browser callbacks alone never award credits. Failed or uncertain payments can be retried with the same reference.

## Release verification

Run backend tests with `node --test server/tests/*.test.js` and frontend tests/build from `client`.
Mock tests do not replace a real test-mode checkout and media delivery check. Before release, use
Paystack test keys with transactional MongoDB and the actual Cloudinary/fal configuration to verify:

1. One free preview plays on Safari, contains the watermark, and cannot export the original.
2. A failed generation preserves credits/preview eligibility.
3. Test-mode checkout, callback and webhook together add credits exactly once.
4. One paid generation reduces balance by one and supports download/campaign handoff.
5. Refreshing the credits callback or reopening an interrupted generation does not duplicate accounting.

AI generation and Cloudinary transformations can incur provider charges even when Paystack is in test mode.

## Files in this phase

Created application files:

- `server/config/quickAdPlans.js`
- `server/models/QuickAdGeneration.js`
- `server/services/quickAdCredits.js`
- `server/services/quickAdMedia.js`
- `server/services/quickAdPayments.js`
- `server/routes/quickAdMedia.js`
- `server/routes/quickAdPayments.js`
- `client/src/utils/quickAdsApi.js`
- `client/src/pages/QuickAdCredits.jsx`
- `client/src/pages/QuickAdCredits.css`
- `docs/quick-ads-credits.md`

Updated application files:

- `server/models/user.js`: counters, free-preview flag, expiring generation lock.
- `server/server.js`: shared payment fields, routing, CORS, webhook and campaign payment-purpose guards.
- `server/routes/quickAds.js`: reserve eligibility, protect results and finalize credit accounting.
- `client/src/pages/QuickAd.jsx`: balance, preview permissions, paid actions and interrupted-request recovery.
- `client/src/App.jsx`: credits route.
- `client/src/components/DashboardShell.jsx`: keep Quick Ads active on the credits page.
- `client/vercel.json`: direct-load rewrite for the credits route.

New tests: `server/tests/quickAdAccount.test.js`, `quickAdCredits.test.js`, `quickAdMedia.test.js`,
`quickAdPayments.test.js`, `helpers/quickAdsDb.js`, and `client/src/pages/QuickAdCredits.test.jsx`.
Updated tests: `server/tests/quickAds.test.js`, `campaignPricing.test.js`,
`client/src/pages/QuickAd.test.jsx`, `QuickAdCampaignFlow.test.jsx`,
`client/src/QuickAdsNavigation.test.jsx`, and `client/src/components/DashboardShell.test.jsx`.

Database additions:

- User: `quickAdCredits`, `quickAdsGenerated`, `quickAdFreePreviewUsed`,
  `quickAdTotalCreditsPurchased`, `quickAdTotalCreditsUsed`,
  `quickAdGenerationLock`, `quickAdGenerationLockExpiresAt`.
- Shared Paystack transaction: `purpose`, `planId`, `credits`, `creditsApplied`;
  existing `pricing`, `status`, `createdAt`, `verifiedAt` store trusted terms and settlement state.
- QuickAdGeneration: owner, unique request key, style, state, provider/model, provider request ID,
  source image and private media locations, preview/download permissions, expiry/completion/error metadata.
