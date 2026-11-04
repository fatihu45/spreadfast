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

Existing transactional account locks reserve eligibility without debiting credits. Failure releases the lock idempotently; completion debits once. A disconnected browser alone does not cancel an accepted job: it continues under the same idempotency key and appears in My Ads. The 15-minute job deadline aborts planning/media work; after a process crash, the expiring account lease allows a new request without a debit. Customers can cancel pending commercials from the creation screen or My Ads. The authenticated cancellation endpoint persists the request; active work observes it through database checks and a one-second cancellation monitor. The billing transaction rejects cancelled jobs. fal queue cancellation is attempted for known active requests; work already accepted can still incur provider costs, but cancelled commercials do not debit customer credits. There is no separately deployed background worker.

After review and deployment, verify the model is available with a planning-only request first, then one paid end-to-end commercial. Do not mistake mocked tests for live provider validation. Confirm video quality, narration, 22-second assembly, history/download and the 4/7-credit debit. Database tests use mocks; production MongoDB transaction behavior still requires staging verification.

## Multiple photos, cancellation and resumable commercials

- Upload one to four JPG/PNG/WEBP photos (8 MB each) of the same product, plus an optional logo. The existing `productImage` multipart field is repeated for multiple photos. All reference photos reach Claude and Nano Banana; the logo remains a post-production asset.
- New additive database fields preserve source photo URLs, the private creative plan, per-scene provider request IDs/models, generated URLs and stored Cloudinary assets. No existing jobs or balances are rewritten. The plan and provider request details are never returned in public history.
- `POST /api/ai-commercials/jobs/:id/retry` now resumes planning, scene generation or finishing on the same paid job. Completed scenes, images and generated videos are reused. Known pending fal jobs are polled by their stored ID instead of submitted twice. Definitively failed provider jobs can be regenerated on retry. Standard/Premium still debit 4/7 credits once, only on success.
- `POST /api/ai-commercials/jobs/:id/cancel` is authenticated, owner-scoped and idempotent for stopped jobs. Completed jobs cannot be cancelled/refunded through this endpoint. Cancellation retains the reservation until active work stops; after a crash its lease expires. Expired jobs can be resumed or cancelled from My Ads. Execution tokens fence old writes, credit completion and cleanup from a newer retry.
- The installed fal SDK retries queue submissions internally. A server fetch adapter suppresses ambiguous submission retries while retaining read-only status/result retries; tests exercise the real installed SDK with mocked network failures.
- A submission whose outcome is unknown and whose request ID was never received is blocked from automatic resubmission. History directs the user to support; reconcile with fal before retrying or clearing a submission marker. This intentionally prevents silent duplicate provider costs. Provider result retention and cancellation behavior must be checked in a live test.
- The saved plan keeps the original input details so edits to display metadata cannot silently change the direction halfway through a resumed commercial.

Release verification: exercise four-angle generation, cancel during planning and video polling, resume after a video failure and after a Cloudinary storage failure, and verify original scene IDs are reused and exactly one final credit debit occurs. Automated tests cover these paths with mocks and validate persistence fields against the actual Mongoose schema; production replica-set transactions and real provider/media behavior still need staging verification.
