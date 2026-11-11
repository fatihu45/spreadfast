# SpreadFast Studios implementation and launch report

Status: feature branch; not deployed. New provider integrations are verified with mocks, not paid live generations. Deployment requires an explicit owner decision and the configuration below. This report distinguishes implemented code from launch prerequisites.

## Implemented

- `/create` workspace with five studios, existing green/white design tokens, existing logo and dashboard shell. Create, My Ads, Credits and Profile navigation; existing Quick Ad and Commercial URLs remain supported. Existing wallet route behavior is preserved.
- Dedicated Fashion workspace with the existing invisible-mannequin UI and new 5/10-second try-on modes. Six server-configured adult model slots: Hausa male/female (modest presentation), Yoruba male/female and Igbo male/female. No ethnicity or religion is inferred from customer photographs.
- Product workspace accepts up to five views and category/style selection. Accuracy prompts prohibit redesigns and invented unseen surfaces.
- Auto workspace accepts 2–5 photographs, vehicle/dealership facts, optional enhancement, 10-second showcase and 15-second narrated sales mode. Direct animation is the default. Claude selects supplied photo indices and constrained shot directions; the spoken script is deterministically built from supplied facts, preventing a generative rewrite from adding claims.
- Optional durable execution for existing Quick Ad/Fashion APIs and Commercials, plus durable new studio jobs. MongoDB stores inputs, stages, worker claims, request IDs and media checkpoints.
- Try-on approval before any fashion video charge. Rejecting cancels without charging customer credits. Only a selected model's studio background is currently supported; back photos are accepted but FASHN v1.6 uses the front garment reference.
- Cloudinary storage for source/generated images and authenticated video; existing branding/assembly services reused. Voice timing checks inspect both character timestamps and stored audio duration before mixing.
- Unified paginated history with studio filters, dates, durations, status, actual credits used, private preview/download, free title edits and owner-scoped deletion. Metadata edits do not alter video content.
- Studio analytics and estimated provider expenses, with explicit coverage and unknown provider-billed totals. Existing analytics already summed multi-credit deductions; this was preserved and tested.
- Landing copy, studio cards, policy disclosures and noindex Vercel routes. Existing genuine demo assets remain; studio card stills are explicitly illustrative.

## Models, duration and credits

These are server-side defaults, not a claim that every mode is enabled. New modes default disabled. Expensive Commercial modes also fail closed until enabled and the margin check passes. No purchase bundles or existing balances were changed.

| Mode | Image model | Video / voice model | Duration | Default credits |
|---|---|---|---:|---:|
| Quick Ad | `fal-ai/nano-banana-2/edit` | `fal-ai/kling-video/v2.5-turbo/pro/image-to-video` | 5s | 1 |
| Invisible mannequin | Same, two images | Same, front and tail frame | 5s | 1 |
| Fashion Motion | `fal-ai/fashn/tryon/v1.6` | `fal-ai/kling-video/v3/standard/image-to-video` | 5s | 2 |
| Fashion Walk | Same | Same | 10s | 3 |
| Product | Nano Banana 2 | Kling 2.5 Turbo Pro | 5s | 1 |
| Auto showcase | Optional Nano Banana 2 | Kling 3 Standard, two 5s clips, audio off | 10s | 4 |
| Auto sales | Optional Nano Banana 2 | Kling 3 Standard, three 5s clips; ElevenLabs `eleven_multilingual_v2` | 15s | 7 |
| Commercial Standard | Nano Banana 2, three scenes | `fal-ai/veo3.1/fast/image-to-video`, audio on | 24s (8+8+8) | 4, subject to margin gate |
| Commercial Premium | Same | `fal-ai/veo3.1/image-to-video`, audio on | 24s | 7, subject to margin gate |

Claude uses the repository's existing OpenRouter transport and `OPENROUTER_MODEL`. A direct Anthropic transport was not introduced. Legacy stored six-second scenes are retained on finalization recovery.

### Provider documentation checked on 2026-11-11

- [FASHN schema and price](https://fal.ai/models/fal-ai/fashn/tryon/v1.6/llms.txt): model_image, garment_image; $0.075 per generation. Does not establish perfect reproduction of multi-piece traditional outfits.
- [Kling 3 Standard](https://fal.ai/models/fal-ai/kling-video/v3/standard/image-to-video/llms.txt): start_image_url, string durations 3–15; $0.084/s audio off. Code explicitly disables native audio.
- [Kling 2.5](https://fal.ai/models/fal-ai/kling-video/v2.5-turbo/pro/image-to-video/llms.txt): image_url, optional tail_image_url, $0.35/5s.
- [Nano Banana 2](https://fal.ai/models/fal-ai/nano-banana-2/edit/llms.txt): $0.08 at configured 1K, one image.
- [Veo Fast](https://fal.ai/models/fal-ai/veo3.1/fast/image-to-video/llms.txt): $0.10/s silent, $0.15/s with audio at 720p.
- [Veo Premium](https://fal.ai/models/fal-ai/veo3.1/image-to-video/llms.txt): $0.20/s silent, $0.40/s audio at 720p.
- [ElevenLabs timestamp API](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps) and [pricing](https://elevenlabs.io/pricing/api). Voice cost estimate uses $0.08/1,000 characters; confirm actual account pricing and commercial rights before enabling.
- The [Veo Fast model page](https://fal.ai/models/fal-ai/veo3.1/fast/image-to-video) displayed a November 17, 2026 removal notice. Confirm model availability and a supported replacement before launch; do not silently switch endpoints.

Veo audio-off would save $1.20 per 24-second Standard ad or $4.80 per Premium ad before separate speech/mixing costs. The existing Commercial audio behavior is retained; a separate narrated Commercial pipeline is not enabled.

### Profitability

`server/config/studios.js` owns the mode catalog and quotes. It uses the lowest existing bundle yield (₦1,250/credit), a payment fee allowance (default 2%), configured USD/NGN rate, configured overhead and minimum contribution margin. Missing/invalid settings or inadequate margin disable the mode before provider calls. `STUDIO_CREDITS_<MODE>` can override non-Quick-Ad prices; Quick Ad and mannequin stay at one credit.

Illustrative arithmetic only: at ₦1,500/USD, 20% minimum margin, $0.10 overhead and 2% payment allowance, 24-second audio-enabled Standard requires at least 7 credits and Premium at least 16. These are not production price changes or a verified exchange rate. The 4/7 proposals fail that scenario. Provider estimates exclude uncertain retries, actual planner token charges, actual Cloudinary/delivery bills and FX/payment variances; overhead must cover these.

Existing bundles remain ₦1,700/1, ₦5,000/4, ₦10,000/8 and ₦20,000/16. Shared purchased credits are not tied to a studio, so verified purchase revenue is not falsely presented as exact revenue per studio. Studio usage is shown in credits; exact revenue attribution and complete contribution-margin accounting remain outstanding.

## Jobs, credits and recovery

Existing `QuickAdGeneration` is extended with optional fields; no destructive migration. The existing unique user/idempotency key and transactional account lock remain. Uploads are accepted first; a job is made runnable only after source URLs and configuration are persisted. New studio submission returns HTTP 202. The existing Quick Ad multipart API can return 202 when durable mode is enabled, and its UI polls the existing request endpoint.

Workers run in the existing Node service, polling MongoDB. No Redis dependency is introduced. Atomic transactional claims fence execution IDs. A worker attempt has a 15-minute timeout, an 18-minute claim, and a job/account eligibility lease of 24 hours. A terminated process leaves checkpointed request IDs for later retrieval. Three bounded automatic attempts retain provider IDs; ambiguous submissions stop for reconciliation instead of being paid for again. A submitted usage estimate is not an invoice and can include an unconfirmed attempt.

Approval pauses hold the account generation lock until approval/cancellation or 24-hour expiry. New studio requests are limited to five per account per rolling day, including failed requests. One active account lock prevents concurrent overspending. Customer credits are deducted in the existing transaction only after completed media and branding, once; failures release eligibility. Completed provider assets survive branding/assembly failure. Up to two owner-initiated finalization retries are allowed for eligible studio jobs with saved final media. Ambiguous narration submissions require support reconciliation; the system does not automatically purchase another speech request.

Use an always-on Render process with MongoDB transactions (replica set/Atlas). A sleeping/free instance will not continuously drain a queue; pending work resumes when the process wakes, subject to expiry. Automatic recovery of pre-existing in-flight legacy requests is not retroactively provided. Disable new submissions and drain work before rollback. All added fields are optional for old records.

## Deployment configuration (not applied)

Existing: `MONGODB_URI`, `JWT_SECRET`, `FAL_KEY`, Cloudinary settings, OpenRouter settings, Paystack settings, frontend `REACT_APP_API_URL`.

New:

- `STUDIO_WORKER_ENABLED=true` enables Mongo-backed workers in the existing backend.
- `STUDIO_ENABLED_MODES` is an explicit comma-separated list from the pricing catalog. Start with modes approved for launch. Until set, new modes remain Coming soon. Enabling durable Quick Ad/mannequin requires including `quick_ad`/`fashion_mannequin`; otherwise their legacy pipeline remains usable.
- `USD_NGN_RATE`, `STUDIO_MIN_MARGIN` (fraction), `STUDIO_OVERHEAD_USD`, optionally `STUDIO_PAYMENT_FEE_RATE`.
- Optional `STUDIO_CREDITS_FASHION_MODEL_5S`, `_FASHION_MODEL_10S`, `_PRODUCT_STUDIO`, `_AUTO_CINEMATIC`, `_AUTO_VOICEOVER`, `_COMMERCIAL_STANDARD`, `_COMMERCIAL_PREMIUM` (full `STUDIO_CREDITS_` prefix for every name).
- `STUDIO_MODEL_HAUSA_MALE`, `STUDIO_MODEL_HAUSA_FEMALE`, `STUDIO_MODEL_YORUBA_MALE`, `STUDIO_MODEL_YORUBA_FEMALE`, `STUDIO_MODEL_IGBO_MALE`, `STUDIO_MODEL_IGBO_FEMALE`: licensed adult model photographs on Cloudinary. Slots without assets are absent from the picker.
- `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_COMMERCIAL_LICENSE=true` for a verified commercially licensed account/voice. No voice cloning is implemented.

No secrets were added. Node 24 was used for local verification. No new runtime packages were required. Vercel deployment for `feat/spreadfast-studios` is explicitly disabled. Do not merge or deploy this branch without approval.

## Retention and deletion

Deletion removes the record from active history and denies subsequent normal preview/download/edit access. Billing/idempotency records remain for audit. Existing signed URLs or downloaded copies cannot be recalled by hiding a record. Media is retained because existing creator campaigns may reference it; this change does not physically purge shared Cloudinary assets. Operators must review references and applicable retention requirements before manual asset deletion. There is no automatic Cloudinary purge in this implementation. Failed/abandoned jobs expire after 24 hours; expensive assets remain for support recovery rather than being silently discarded.

## Launch prerequisites and remaining limitations

- Supply and verify rights for the six adult fashion model assets; inspect garment fit for kaftans, agbadas, abayas and multi-piece outfits. No promise of exact garment accuracy. Only the original selected model background is operational.
- Configure a commercially licensed voice and perform an explicitly authorized, cost-capped real test of narration, timing, Cloudinary audio mixing and branding. Nigerian-accent voice quality is not verified.
- Configure margins/rate/overhead, approve non-loss-making Commercial prices and resolve the Veo Fast retirement notice.
- Run authorized live end-to-end tests for each new provider pipeline. Mocks cannot establish real output fidelity, latency, account access or exact bills.
- Costs are estimates for instrumented submissions, not complete provider invoices. Legacy Quick Ad usage and creative-planner/storage/delivery costs are not fully instrumented. Exact studio revenue attribution, automated invoice reconciliation and complete contribution-margin reporting are not implemented.
- Automatic physical media cleanup and dedicated source-slot labels/reordering are not implemented. Auto uses ordered uploads with guidance for front/side/rear/interior/dashboard. Auto card uses a vehicle symbol until a suitable visual asset is approved.
- Current UI is responsive and uses existing tokens; it is not an exact reproduction of the attached concept image.


## Verification results

- Backend full suite after rebasing onto `564764b`: **246 passed, 0 failed**. Includes existing credit, payment, commercial, OpenRouter, media and authorization suites plus 14 new studio tests.
- Frontend: **26 suites, 222 tests passed**. Covers existing authentication, mobile navigation, legacy routes, credits, uploads and history, plus studio cards, file validation and unified filtering/deletion.
- Frontend production build: passed with the existing Vercel `CI=false` build behavior, including homepage prerender, private app shell, sitemap and rewrite validation. Existing repository lint warnings and an outdated Browserslist database remain; this is not a warning-free strict-CI build.
- New workspace/history/selection source and tests: targeted ESLint with zero warnings.
- Node syntax checks and `git diff --check`: passed.
- Paid provider tests: **none run**. Unit/integration provider responses are mocked.
- Browser rendering/screenshot test: **not completed**. Playwright browser download failed; installed Chromium could not create its required socket in this execution environment. Desktop/tablet/mobile layout inspection and real iPhone Safari checks remain outstanding. Responsive CSS and DOM tests do not replace that verification.
- No production database, Render environment, Paystack settings or running deployment was modified.

## Changed files

- `client/public/policies/acceptable-use-policy.html`
- `client/public/policies/cookie-policy.html`
- `client/public/policies/disclaimer.html`
- `client/public/policies/privacy-policy.html`
- `client/public/policies/refund-and-credits-policy.html`
- `client/public/policies/terms-and-conditions.html`
- `client/src/App.jsx`
- `client/src/QuickAdsNavigation.test.jsx`
- `client/src/components/AdminQuickAdsAnalytics.jsx`
- `client/src/components/DashboardShell.jsx`
- `client/src/components/DashboardShell.test.jsx`
- `client/src/pages/AICommercials.jsx`
- `client/src/pages/Landing.jsx`
- `client/src/pages/Landing.test.jsx`
- `client/src/pages/Login.test.jsx`
- `client/src/pages/MyAds.jsx`
- `client/src/pages/QuickAd.jsx`
- `client/src/pages/QuickAd.test.jsx`
- `client/src/pages/Register.test.jsx`
- `client/src/pages/StudioWorkspace.jsx`
- `client/src/pages/Studios.css`
- `client/src/pages/Studios.jsx`
- `client/src/pages/Studios.test.jsx`
- `client/src/seo/metadata.js`
- `client/src/utils/authDestination.js`
- `client/vercel.json`
- `docs/spreadfast-studios.md`
- `server/config/studios.js`
- `server/models/QuickAdGeneration.js`
- `server/routes/aiCommercials.js`
- `server/routes/quickAdMedia.js`
- `server/routes/quickAds.js`
- `server/routes/studios.js`
- `server/server.js`
- `server/services/aiCommercialProviders.js`
- `server/services/autoStudioPlan.js`
- `server/services/quickAdAnalytics.js`
- `server/services/quickAdMedia.js`
- `server/services/studioInputs.js`
- `server/services/studioWorker.js`
- `server/tests/aiCommercialProviders.test.js`
- `server/tests/aiCommercials.test.js`
- `server/tests/studios.test.js`
