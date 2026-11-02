# My Ads and AI Commercial audit — 2 November 2026

Reviewed main at `63df89ea995843fdf297c600f259c7bd4eff30de`.

## Fixed in this change

| Finding | Result |
| --- | --- |
| AI Commercial inherited the Quick Ad free-preview entitlement, even at zero credits. | Both tiers require credits on the server and client: Standard 4, Premium 7. Successful commercial generation leaves the Quick Ad preview entitlement untouched. |
| My Ads listed Quick Ads although commercial edit/delete endpoints rejected them. Soft-deleted Quick Ads also appeared. | My Ads lists non-deleted AI Commercials only; Quick Ads retain their existing history. |
| Commercial deletion permanently removed billing and idempotency records. | Soft deletion hides the video while retaining accounting and preventing deleted request keys from generating again. Edit/delete are ownership-scoped and reject concurrent status changes. |
| A stale history response could reinsert a just-deleted card. | History response sequencing ignores superseded reads. |
| Contact and specifications were read from the wrong response fields. | Edit prompts preserve the existing values. The success message explicitly describes metadata editing, not a rendered-video change. |
| History dates were omitted from the shared response. | Creation/completion timestamps are returned. |
| A cross-origin download link could open a video instead of saving it and enabled downloads on locked previews. | Downloads use the authenticated media endpoint and respect download entitlement. |
| Promoters' Quick Ads shortcut led to the company route. | Shortcut uses the account's correct role route. |
| Quick Ad allowed 500-character specifications but its multipart parser rejected fields over 256 bytes. | Bounded 4 KB field parsing permits the existing 500-character normalization, including multibyte input. |
| Commercial logo picker accepted 8 MB files, but the branding service only accepts 2 MB. | The picker now enforces the actual 2 MB logo limit. |
| Every Veo clip requested eight seconds, ignoring planned durations. | New commercials use a 6-second hook, 8-second showcase, and 6-second closing scene at 720p. |
| The complete narration was supplied only to scene one, and could be truncated after a long motion prompt. | Claude supplies short per-scene narration, validated against duration, and narration precedes the bounded motion direction. |
| The closing text overlay appeared throughout the whole commercial. | Text appears only during the closing scene, based on the stored clip durations. |
| Assembly/logo failures discarded the usable result path and encouraged another set of paid AI calls. | Once all three clips are stored, Retry finishing claims the same job and reuses them. The protected assembled original is saved before branding. Credits are deducted once, only after successful completion. Failed retries do not debit credits. |
| Old frontend tests still required retired campaign controls/navigation. | Tests now verify the current AI-first controls and redirects; legacy handoff sanitization coverage remains. |

Existing completed free-commercial previews are not retroactively billed or deleted. The paid-only policy applies to new commercial generation. Replaying an old completed request does not generate new media.

## Validation

- Backend: 166 tests passed, including trial isolation, paid tier deductions, repeated and concurrent finalization retries, failed branding, ownership, deletion, and no extra image/video provider calls during recovery.
- Frontend: 204 tests passed across 24 suites, including paid-only UI, saved detail editing, authenticated downloads, and the retry endpoint.
- Production build including SEO generation passed using the repository's `CI=false` build configuration. Existing lint warnings remain.
- Provider and Cloudinary calls were mocked in automated tests. No live paid generation or production database access was performed.

## Remaining limitations and follow-up

1. **Server restarts and partial-scene failures:** generation still runs inside an HTTP request. There is no durable worker to resume an interrupted image/video provider job. Recovery added here is deliberately limited to failed jobs with all three stored clips. A crash can leave an expired pending row; a future job can release the account lock, but that is not automatic job recovery. A durable queue plus persisted provider request IDs is needed for full recovery.
2. **Live quality/integration:** run one Standard and one Premium commercial with a logo in staging. Verify speech continuity, product fidelity, actual duration, authenticated Cloudinary assembly, downloads, and a controlled finalization failure/retry. Independent Veo clips can still differ in voice or audio ambience despite consistent prompting.
3. **Provider lifecycle:** the current fal API documentation displays a 17 November 2026 deprecation banner for the two configured Veo endpoints. Verify the replacement and its schema in the fal account before migration. `COMMERCIAL_STANDARD_VIDEO_MODEL` and `COMMERCIAL_PREMIUM_VIDEO_MODEL` now allow a compatible endpoint to be configured without editing source. Defaults are unchanged; arbitrary model families are not interchangeable.
4. **Deletion is from history:** media retained for billing/recovery and existing references is not physically purged from Cloudinary. Asset retention cleanup is separate work.
5. **Editing changes saved details only:** changing a contact or specification does not regenerate the existing video, speech, or end card.

## Provider references checked

- https://fal.ai/models/fal-ai/veo3.1/fast/image-to-video/api
- https://fal.ai/models/fal-ai/veo3.1/image-to-video/api
- https://cloudinary.com/documentation/video_layers
