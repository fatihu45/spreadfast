# Financial operations and local data

- AI Commercials requires the server-side `OPENROUTER_API_KEY`, `FAL_KEY`, and the existing Cloudinary credentials (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`). `OPENROUTER_MODEL` and `COMMERCIAL_IMAGE_MODEL` are optional; defaults are set in the provider service. Configure these only in the server deployment environment, never in the client.
- AI Commercials runs Claude creative planning, three Nano Banana scene-image jobs, three Veo video jobs, and protected Cloudinary assembly/branding. Veo audio is requested for the generated narration prompt; verify voice and script accuracy with the live provider. Commercials never have a free preview (Quick Ad keeps its existing trial); successful paid Standard/Premium generations debit 4/7 credits respectively.
- Before release, submit a real authenticated test generation in a non-production account with test provider credentials. Confirm all three scene assets, the assembled CTA and optional logo, playable preview/download permissions, job history, exact credit deduction, and lock/credit cleanup after intentionally failed provider requests.
- Production requires MongoDB. Set NODE_ENV=production on the deployed server. API requests return 503 while it is disconnected; they never fall back to JSON files.
- Withdrawals and withdrawal reviews require MongoDB transactions (a replica set or sharded cluster, including MongoDB Atlas). Standalone MongoDB and the development JSON fallback cannot process withdrawals. Do not substitute non-transactional writes for this requirement.
- Both withdrawal endpoints use the same transaction service. Wallet changes and withdrawal records commit or roll back together. Completed/rejected withdrawals are terminal; retries of the same decision do not refund again.
- New paid campaigns keep the existing NGN 20,000 gross / NGN 5,000 platform / NGN 15,000 creator terms. Legacy campaigns and historical balances are not repriced. Legacy approval receipts are written only for subsequent approvals/recovery; there is no bulk balance migration.
- Database failures during webhook processing return 503 so delivery can be retried. Verify the deployed webhook URL and monitor unsuccessful deliveries after release using the payment provider dashboard.
- Account status is checked on authenticated requests. Password resets increment the account token version and invalidate earlier sessions. Existing unrevoked tokens remain valid.

## Local records

`data/*.json` and `server/data/*.json` are ignored and removed from the Git index. Existing local files are retained. Do not add account records, password hashes, bank details, or payment records back to source control. The JSON reader fails explicitly on malformed data; never replace unreadable records with an empty array to resume writes.

Removing files from tracking does not erase earlier Git history. If committed credentials belonged to real accounts or the repository was shared, arrange credential resets and a coordinated history cleanup. No history rewrite or live account reset was performed by this change.

## Verification

From the repository root:

```
node --test server/tests/*.test.js
npm --prefix client test -- --watchAll=false --runInBand
npm --prefix client run build
```

Backend regression tests use isolated data and mocked transactions/services. They do not connect to production MongoDB, transfer funds, send emails, or delete Cloudinary assets. Before deployment, exercise concurrent withdrawal and rollback cases against a separate MongoDB replica set, and payment callback/webhook recovery using Paystack test mode. Never use live funds for these checks.

## OpenRouter commercial director

Set `OPENROUTER_API_KEY` on the Render backend; optionally set `OPENROUTER_MODEL=anthropic/claude-sonnet-4.5` (the default). No direct Anthropic account, `ANTHROPIC_API_KEY`, or `CLAUDE_MODEL` is used. Keep existing fal.ai and Cloudinary variables. No dependency or database migration is required.

The server sends the existing product photo and brief to OpenRouter Chat Completions, requests a strict JSON schema, and validates all scenes before submitting paid media jobs. New commercials use 6/8/8 seconds (22 seconds); previously stored scenes retain their recorded durations when finalization is retried. The workspace remains unchanged apart from its duration label.

Planning has a 45-second timeout per attempt and at most three attempts for network errors, timeouts, 429 and transient 5xx errors. Long Retry-After values stop automatic retries. Authentication, billing, forbidden/invalid requests, invalid plans and cancellation are not retried. Logs contain only job ID, stage, controlled error code and numeric HTTP status; never log provider bodies, prompts, image URLs or headers. An insufficient OpenRouter balance is an operator issue, not a customer credit charge.

Existing transactional account locks reserve eligibility without debiting credits. Failure releases the lock idempotently; completion debits once. A disconnected browser does not cancel an accepted job: it continues under the same idempotency key and appears in My Ads. The 15-minute job deadline aborts planning/media work; after a process crash, the expiring account lease allows a new request without a debit. There is no new cancellation endpoint or background worker. Provider work already accepted can still incur provider costs on interruption. Saved complete scenes can retry finalization without new fal jobs; partial scene failures still require a new generation.

After review and deployment, verify the model is available with a planning-only request first, then one paid end-to-end commercial. Do not mistake mocked tests for live provider validation. Confirm video quality, narration, 22-second assembly, history/download and the 4/7-credit debit. Database tests use mocks; production MongoDB transaction behavior still requires staging verification.
