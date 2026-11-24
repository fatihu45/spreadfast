# Studio readiness review — 23 November 2026

Work is isolated on `fix/studio-readiness-20261123`, based on `feat/spreadfast-studios`. This integrates main through `a85dac6` into the fix branch; it does not merge the expansion into main or enable production studio modes.

## Completed

- Integrated the newer account, payment, recovery, landing example and credit-dialog fixes while retaining the five-studio workspace.
- Restored fashion jobs now open their correct mode and expose outfit approval after a reload. Selecting the current mode preserves uploads; completed jobs offer an explicit new-ad action with a fresh idempotency key.
- Allowed the documented FASHN output CDN while rejecting lookalike hosts and unsafe URLs. Finalization retries reuse stored video rather than returning to paid image/video generation. Generic recovery excludes studio jobs so it cannot skip narration.
- Worker selection excludes paused approvals and incomplete uploads from its runnable window, processes two runnable jobs concurrently, and expires stale reservations. Cancelling an unapproved outfit uses a transaction and only releases its own credit lock.
- Unified My Ads includes legacy ads and commercials, server-side filtering/pagination, appropriate recovery endpoints, estimated animated progress, edit/delete controls, and deletion confirmation. Deleted rows cannot return from a stale refresh. History does not expose original video delivery URLs; playback fetches the authorized individual record.
- Insufficient credits open a focused purchase dialog without clearing the draft. Checkout opens separately and returning focus refreshes the balance. Branding is optional through a switch; less-used fields are collapsed.
- Product and Auto forms use compact controls. Vehicle photos can be labelled and reordered. Cinematic vehicle details are optional; voiceover includes supplied sales facts, displays a script preview, and rejects excessive text before paid generation.
- Fashion model input accurately describes the supported front-photo and fixed studio-background workflow. Model selection collapses to a small summary. The mannequin form no longer starts with an empty illustrative preview and duplicate history.
- Corrected the landing Fashion Studio link to its dedicated page.

## Verification

- Backend: 267 tests passed, including new CDN, finalization, narration and input-validation regressions.
- Frontend: 28 suites / 236 tests passed, including restored approval, low-credit purchase, fresh repeat-generation IDs, branding, and deletion.
- Final production build and SEO checks passed; existing React hook dependency warnings remain. The final landing-link adjustment passed its 9-test suite. Backend production dependency audit found zero vulnerabilities.
- Browser QA used mock account/catalog/credit responses, never production credentials. Inspected desktop studio selection, Product Studio, fashion/model selection, and the credit dialog. Inspected a 390 × 844 iframe viewport: all five studio rows fit, product controls remain compact, and the purchase dialog is centred with a visible primary action and focus restored on dismissal.
- Browser findings fixed: dialog placement, missing primary-link styling, duration-label wrapping, and redundant mannequin content. This is responsive layout verification, not a physical iPhone/Safari compatibility certification.
- Provider submissions were mocked in automated tests. No paid generations, production database mutations, deployment or production environment changes were performed.

## Before launch

1. Validate actual garment/product/vehicle fidelity and narration timing with controlled staging generations. Model/reference images and generated output cannot guarantee exact preservation.
2. Confirm worker availability, provider credentials, commercially licensed voice/reference assets, and current cost/margin settings before enabling each mode. Existing fail-closed pricing/configuration gates remain.
3. Test real checkout return, authentication and generation recovery against a staging backend. The old Vercel preview required Vercel sign-in; a local mock preview does not certify that deployment.
4. Review on physical mobile devices, especially Safari video playback and downloads. Browser media playback was not certified in this environment.

Back-photo model try-on and alternate model backgrounds are not implemented by the current provider flow and are not offered as functioning options. Physical media cleanup and provider-invoice reconciliation remain the existing documented operational work; this change does not claim they are complete.
