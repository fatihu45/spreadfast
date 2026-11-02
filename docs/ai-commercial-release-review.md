# AI Commercial implementation and release review

Reviewed main: `395792dcb19199c5b7473aa9058e273a60f50623` (2 November 2026).
Branch: `feat/finalize-ai-commercial`. No production API calls or deployment performed.

## Findings and changes

- The old assembly did not trim scenes; its authenticated video overlay serialized to `l_authenticated:video:…`, rather than Cloudinary's required `l_video:authenticated:…`. Corrected the SDK layer definition and tested the actual serialized URL. Normalize all three clips to 720 × 1280, 24 fps; trim to 6/8/7 seconds; append in order using clean cuts. Optional name/CTA appears only during the closing scene. Store measured duration from the final Cloudinary upload and reject outputs outside 20–24 seconds (0.1-second encoding tolerance).
- Claude previously returned weakly checked JSON with unrelated scene prompts and narration. Now request a structured tool result with campaign concept, product identity, palette, lighting, composition, camera, accuracy rules, durations and transitions; reject malformed plans before image/video spending. Repeat shared direction and user specifications in every image and video request. Later image scenes also receive the first scene as a style reference, with the original product as primary reference. Only user-supplied brand/CTA text is burned in; generated claims/text are not used as overlays.
- Removed requested narration and disabled Veo audio. No model endpoint or credit price was changed: Standard still uses Veo 3.1 Fast at 4 credits; Premium uses Veo 3.1 at 7 credits. These are the actual main-branch models, not Veo Lite.
- Old failures discarded the recovery path after spending on successful scenes. Persist the plan, provider IDs, intermediate image/video URLs, protected clips, assembled derivative and final unbranded media. Recovery reuses all successful assets and known provider requests. Two recoveries maximum. Unknown submission outcomes require operator reconciliation rather than another billable POST. The fal SDK hard-codes submission retries; commercial POST submission now uses a single HTTP attempt, while existing SDK polling/results remain bounded by its read retry policy and the 15-minute job deadline.
- Retain account-wide transactional eligibility reservations and success-only charging. Add request payload fingerprints, durable deletion tombstones, worker ownership tokens and transactional recovery claims. Stale workers cannot charge or release a newer reservation. No credits are charged when assembly or branding fails; recovery completes and charges the original amount exactly once. Source input is immutable even if history metadata is edited.
- My Ads previously included Quick Ads, missing dates/duration and a direct cross-origin download anchor that offered downloads for locked previews. Scope history to commercial records, exclude deleted records, return dates/measured duration, and use the existing authenticated media download route and its eligibility checks. Metadata edits do not alter videos; conditional edit/delete writes prevent races with recovery. Deletion persists across refresh while retaining accounting/idempotency records.
- Business name and CTA are optional. Logo limits now match at 2 MB in the form and branding backend (product image remains 8 MB).
- Async acceptance avoids holding the browser generation request open for the full provider pipeline. History polls real backend stage and scene number; recovery is available from My Ads. Preserve the existing responsive design, move mobile upload ahead of the preview, and keep action touch targets at least 44 px high.

## Verification

All provider tests are mocked. Database transaction tests use the repository's serialized, rollback-capable in-memory fixture; they do not substitute for MongoDB integration testing.

- Commercial backend tests: 22 passing, covering both tiers, successful scenes, exact-once charging, duplicate/concurrent submissions, fingerprint conflicts, structured Claude validation, silent provider inputs, preserved assets, assembly/branding recovery, recovery bounds, stale workers, metadata edits, deletion and ownership.
- Existing authenticated media tests pass, including locked free previews, downloads, ownership and purchase unlocking. Extended the assembly test to check 6/8/7 trims, base normalization, closing overlay timing and actual SDK URL syntax.
- Commercial UI tests: 4 passing (logo limit/stage mapping, date/duration/locked download, authenticated download, deletion).
- Full backend before the final additional Claude test: 168 passed, 1 failed. Unchanged main: 155 passed, 1 failed. Same failure: `quickAds.test.js` “additional instructions are trimmed and capped at 500 characters”.
- Full frontend: 202 passed, 15 failed (24 suites). Unchanged main: 198 passed, same 15 failed (23 suites). Existing failures are in QuickAd, QuickAdCampaignFlow, QuickAdsNavigation and DashboardShell tests. Their expectations reflect older campaign/navigation/Quick Ad UI behavior. No new failures observed.
- Production build passes with `CI=false npm run build`, matching the repository's `vercel-build` configuration. Strict `CI=true` treats existing unrelated lint warnings as errors. Commercial-page hook warnings were fixed.
- Visual browser QA could not run: Playwright was available but browser binaries were missing; both browser-download attempts returned invalid/truncated archives. Mobile/desktop pixel layout and real iPhone downloads remain manual checks. DOM tests are not visual QA.

## Costs and sustainability

Public provider rates checked 2 November 2026:

- [Veo Fast](https://fal.ai/models/fal-ai/veo3.1/fast/image-to-video): $0.10 per generated second without audio at 720p/1080p.
- [Veo 3.1](https://fal.ai/models/fal-ai/veo3.1/image-to-video): $0.20 per generated second without audio at 720p/1080p. The live page now displays a 17 November 2026 deprecation notice; approve and test a replacement separately. Endpoint unchanged in this PR.
- [Nano Banana 2 edit](https://fal.ai/models/fal-ai/nano-banana-2/edit): $0.08 per 1K image.
- [Claude Sonnet 4.5](https://platform.claude.com/docs/en/about-claude/pricing): $3/M input tokens, $15/M output tokens. A planning allowance of $0.03–$0.07 is illustrative, dependent on image/input/output tokens; not measured billing.

| Tier | Generated video | 3 images | Generation subtotal | Including illustrative Claude allowance | Revenue at bundle credit value |
| --- | ---: | ---: | ---: | ---: | ---: |
| Standard, 4 credits | 24 × $0.10 = $2.40 | $0.24 | $2.64 | $2.67–$2.71 | ₦5,000 |
| Premium, 7 credits | 24 × $0.20 = $4.80 | $0.24 | $5.04 | $5.07–$5.11 | ₦8,750 |

The final video is 21 seconds, but providers bill for all 24 generated seconds. No extra clips are generated. Single-credit purchases imply ₦6,800/₦11,900 revenue; use the lower bundle value (₦1,250 per credit) for conservative economics.

At an **illustrative ₦1,500/$**, using $0.05 planning: Standard costs ₦4,035 and leaves ₦965 (19.3%); Premium costs ₦7,635 and leaves ₦1,115 (12.7%). These are contribution margins **before** Cloudinary transformations/storage/bandwidth, payment fees, FX/card spread, hosting, tax, free previews and failed jobs. This is not a current exchange-rate quote. Approximate FX break-even before those costs: ₦1,859/$ Standard and ₦1,719/$ Premium. Pricing is therefore thin, especially Premium, and cannot be declared sustainably profitable without actual billing and failure-rate data. Free previews are acquisition spend with zero immediate revenue. Historical audio-enabled provider subtotals were approximately $3.84 Standard and $9.84 Premium; silent generation materially reduces cost.

## Release checks requiring operator action

1. Review this PR; do not merge without owner approval. Deploy backend/frontend together after approval. Existing schema additions are optional; no destructive migration is required. Existing commercials without the new checkpoints cannot be fully resumed automatically.
2. Verify Render environment: `ANTHROPIC_API_KEY`, `FAL_KEY`, existing Cloudinary credentials and JWT configuration; a transaction-capable MongoDB replica set/Atlas is required. Do not put credentials in React or logs.
3. Approve a small paid staging run for each tier. Check exact product patterns/colors, coherent lighting, 6/8/7 scene order, measured duration, final cuts, logo/CTA placement, protected previews and real downloaded playback on iPhone and desktop. Confirm Cloudinary authenticated derivatives are supported by the account. No generative system can guarantee pixel-exact product preservation from prompts alone.
4. Interrupt a staging worker after provider submission, then exercise recovery after lease expiry. The process remains in the existing Express host, with durable Mongo checkpoints and user-triggered recovery after restart; no new queue service was introduced. Ambiguous submission IDs must be reconciled in provider logs by support. Never reset attempt markers blindly.
5. Confirm provider availability and resolve the announced Premium endpoint deprecation before 17 November. Model switching requires owner approval.
6. Compare real provider charges, token usage, Cloudinary fees, free-preview conversion and failure rate against these estimates before increasing traffic. Baseline test failures and dependency deprecation/security notices deserve a separate maintenance change.
