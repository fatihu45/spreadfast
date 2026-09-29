# SpreadFast transactional emails

## Events

| Event | Recipient | Backend trigger |
| --- | --- | --- |
| Quick Ads credits ready | Purchasing Company or Promoter | Verified payment and committed credit award |
| New Quick Ads credit purchase | ADMIN_EMAIL | Same committed purchase |
| Withdrawal request received | Request owner | Withdrawal and wallet reservation committed |
| New promoter withdrawal request | ADMIN_EMAIL | Same committed request |
| Withdrawal paid | Request owner | Actual pending-to-completed transition |
| Quick Ads payment not completed | Purchase owner | Paystack verification returns failed, matching reference, NGN amount and purchaser email |
| Low Quick Ads credits | Generation owner | Successful paid generation leaves exactly 1 credit |
| Quick Ads credits used | Generation owner | Successful paid generation leaves 0 credits |
| Password changed | Account owner | Successful existing password reset |

No failure email is queued for abandoned/pending checkout, invalid payment identity, ordinary validation errors or failed generation. Generation already deducts only after successful completion, so no credit restoration or misleading restoration email was added. Free previews generate no low/zero-credit messages.

## Files

Created:
- server/models/EmailNotification.js
- server/services/emailService.js
- server/services/emailNotifications.js
- server/tests/transactionalEmails.test.js
- docs/transactional-emails.md

Modified:
- server/server.js: reuse the existing Resend instance with the shared sender; register notification persistence/worker and password-change hook.
- server/models/user.js: low/zero-credit cycle flags.
- server/services/quickAdPayments.js: verified-purchase and confirmed-failure notifications; reset credit-alert flags on purchase.
- server/services/quickAdCredits.js: low/zero alerts after successful paid completion.
- server/services/wallet.js: request and actual paid-transition notifications.
- server/tests/helpers/quickAdsDb.js: transactional notification and withdrawal test stores.
- server/tests/campaignPricing.test.js: integrate notification persistence into the existing isolated route harness.
- .env.example: document development safety and delivery switch.

## Architecture and duplicate prevention

All mail uses the existing Resend client, RESEND_API_KEY and sender `SpreadFast <noreply@tryspreadfast.com>`. Existing campaign-confirmation, promoter-campaign-alert, welcome and password-reset-link templates and triggers are retained. Their transport now checks Resend's `{ data, error }` result correctly and uses safe logging and development recipient controls.

New templates share one green/white responsive wrapper, escaped dynamic HTML, plain text, Naira formatting and Lagos date/time. Financial values are snapshots of the committed event. Notifications omit bank account numbers, passwords, reset tokens, provider keys and video URLs. Customer Quick Ads links use the correct Company/Promoter route; admin links open the existing `/admin-portal` (its tabs have no dedicated URL).

The EmailNotification collection is a delivery outbox, not a second payment or email provider system. Financial services create an immutable message inside their existing Mongo transaction. A rollback produces no sendable notification. A background worker in the existing server polls every 15 seconds, claims a five-minute lease in a transaction, and calls Resend **after commit**. It processes up to 20 messages per batch with paced requests. Requires the same transaction-capable Mongo deployment as existing financial operations.

Each notification has a unique SHA-256 ID derived from its event kind and source payment/withdrawal/generation ID. Company and admin notifications have separate keys. Existing payment `creditsApplied` and generation idempotency checks are preserved. Callback/webhook races cannot re-credit or queue another purchase notification. Repeated completed/approved withdrawal updates return without another paid notification.

Two User booleans, `quickAdsLowCreditNotified` and `quickAdsZeroCreditNotified`, default false, are set with the successful generation and reset with a successful credit purchase. There is no historical backfill, balance reset or historical-email replay.

Delivery records hold recipient, immutable HTML/text, user/event identity, status, attempts, lease, retry times, provider ID and sentAt. `sent` means Resend accepted the message, not proof of inbox delivery. Email provider failures never undo committed credits or a paid withdrawal. A database failure while recording a financial event still fails the database transaction normally; the client can retry it safely.

Retries use the same message and Resend idempotency key, including after a process crash or a lost provider response. Resend retains keys for 24 hours: https://resend.com/changelog/idempotency-keys . Automatic retries stop after 23 hours from the first attempt and set `needs_review`; this avoids creating another send after the provider's deduplication window. Transient errors retry with bounded backoff; API requests have a 30-second timeout. Reconcile `needs_review` against Resend before any manual resend. Never delete notification records to force a retry.

Password-change confirmation is queued after the existing password update and uses account ID plus session version to deduplicate the event. A queue failure is logged and does not undo the password reset. There remains a narrow crash window between that existing auth update and notification enqueue; authentication was deliberately not rewritten. Successful future changes get a new event key.

## Environment and safe local testing

Existing variables are reused: RESEND_API_KEY, ADMIN_EMAIL, FRONTEND_URL (or CLIENT_URL), and NODE_ENV. No new key or sender configuration is required. Configure the existing Resend sender domain as before.

New controls:
- EMAILS_ENABLED: production defaults to enabled; development/test defaults to disabled. Set `false` to suppress delivery, or explicitly `true` for testing.
- EMAIL_TEST_RECIPIENT: required alongside `EMAILS_ENABLED=true` outside production. Every recipient, including admin and existing direct emails, is redirected to this controlled inbox.

Disabled/unsafe-development deliveries are marked `suppressed`, not `sent`, and are not replayed on later enablement. Missing RESEND_API_KEY produces retryable delivery failures. Missing ADMIN_EMAIL logs a configuration warning and skips the internal notification; customer delivery still proceeds. Check these existing settings before deployment.

Do not use production customer data or production Paystack charges for tests. The automated suite uses in-memory transactions and mocked providers and does not send real emails. For a staging/local inbox test, use a transaction-capable test Mongo database, Paystack test configuration, explicit email enablement and your own EMAIL_TEST_RECIPIENT. Wait up to one worker interval after the operation. Inspect `emailnotifications` status/sentAt/providerId and the controlled inbox.

## Manual checklist

1. Purchase a Quick Ads plan as a Company and then as a Promoter. Confirm the correct amount, purchased credits, post-purchase balance, reference, date and role-specific CTA. Confirm customer and admin variants reach the test inbox.
2. Refresh the success page, reverify the same reference, and replay its valid test webhook. Confirm one credit award and one notification of each kind.
3. Confirm failed/mismatched verification awards no credits. A provider-confirmed failed transaction with matching purchase identity should send one failure email. Pending/abandoned checkout must not send one.
4. Request a withdrawal through each existing entry point. Confirm one customer receipt and one admin notice per stored request, pending status, correct amount and no sensitive bank data.
5. In the existing admin portal, mark it completed. Confirm paid status persists, one paid email arrives, and repeated API updates/refreshes do not resend it. Rejection must not send a paid email.
6. Simulate Resend rejection/network failure after a purchase or paid withdrawal. Confirm financial state stays committed, the notification retries and no raw provider error appears in API responses.
7. Generate paid ads from two credits down to one, then zero. Confirm one low and one zero alert. Retry/recover those generation IDs and confirm no additional mail. Purchase more credits and repeat the cycle.
8. Fail/cancel a generation or submit an invalid upload. Confirm no debit, no low/zero alert and no false credit-restored email. Free previews must not trigger these alerts.
9. Reset a password using the existing reset flow. Confirm one password-changed email, no password/token in it, and the original reset-link email still works.
10. Check notification ownership with separate accounts: customer content goes only to its stored owner; only ADMIN_EMAIL receives the internal variant. Ensure recipient overrides prevent real delivery in development.
11. Confirm existing Company campaign confirmations and production promoter campaign alerts still work. The pre-existing production-only campaign-broadcast guard remains in place.
12. Inspect each new message on a mobile email client and its plain-text alternative. Confirm links resolve to existing pages. Check retry and `needs_review` records in the database/logs; no admin UI was added.

## Intentional limits and existing issues

- No frontend changes, new payment routes, pricing changes, authentication rewrite or admin-permission changes.
- No optional admin notification-status UI; records and safe logs provide operational visibility.
- Existing campaign templates/triggers were not refactored into the new outbox; their historical delivery semantics are unchanged.
- Existing helper ignored Resend error responses and logged an incorrect response ID; the shared transport fixes that behavior.
- Existing development safety covered only promoter campaign broadcasts; the shared transport now covers all sends.
- Existing password reset lacks an atomic email intent with the auth update; queue failures are isolated and logged as described above.
- A running server worker and Mongo connectivity are required for queued delivery. No external scheduler or new infrastructure dependency was introduced.

## Existing endpoint coverage

No new API routes were added. Hooks are in shared services used by:
- GET /api/quick-ads/credits/verify/:reference and POST /api/payments/webhook
- POST /api/quick-ads/generate
- POST /api/wallet/withdraw and POST /api/withdrawals
- PATCH /api/admin/withdrawals/:withdrawalId and POST /api/admin/withdrawals/:withdrawalId/review
- POST /api/auth/reset-password

## Validation completed

- Full backend suite: 118 tests passed.
- After the final email URL configuration fallback: all 11 notification tests passed again.
- Changed server JavaScript syntax checks and git diff --check passed.
- Frontend files were unchanged; no frontend rebuild was needed for this backend-only change.
- No live emails, payments or generation requests were sent. Inbox/mobile-email rendering and real Resend delivery remain staging checks.
- Invalid FRONTEND_URL/CLIENT_URL values fall back to the existing public site for email CTAs so an email-link configuration error cannot interrupt financial processing.
