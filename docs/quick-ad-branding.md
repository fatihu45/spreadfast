# Quick Ad branding

Quick Ad has a collapsed optional branding control below the product photos, shared by company and promoter accounts and all five styles. Choose either a business name (up to 40 characters) or a PNG/JPG/WEBP logo (up to 2 MB). No font, placement or size settings are required.

The AI image/video prompts receive only the product inputs. After the existing video pipeline completes, Cloudinary prepares an authenticated MP4 with branding in the top-left corner at a 5% inset. Logos fit within 18% of video width and 10% of height without changing proportions. Names use white text on a dark background and fit within 32% width and 10% height. Branding is static for the clip's duration. Automatic subject detection/background removal is not included; users should preview the result, and transparent PNGs work best.

The original authenticated video is retained in `media.originalOutputUrl`. The active derivative is stored in `media.outputUrl`, so previews, downloads and new campaign exports use the same branded file. Previously exported campaign URLs remain unchanged. Free previews get branding followed by the existing trial watermark; the existing verified-payment download gate still applies.

Users can edit/remove branding beneath the result or through the pencil icon in My Quick Ads. `PATCH /api/quick-ads/generations/:id/branding` accepts multipart fields `brandingMode`, `businessName`, and `brandingLogo`. Ownership, completed status and soft deletion are enforced. Edits compare `brandingRevision` before saving so overlapping writes cannot overwrite newer edits. No generation credits or AI calls are used by edits. Cloudinary storage/transformation usage still applies.

No new environment variables or dependencies are required. Deploy the backend before the frontend. Existing videos need no migration; their first edit uses the existing original media URL. Failed edits leave the prior playable media intact. An initial branding/render failure uses the existing generation failure path and does not charge a generation credit.

Validation: targeted server and React tests cover uploads, fashion generation, logo isolation from AI inputs, idempotency, editing/removal, trial protection, ownership and failure preservation. The production client build passes with existing repository lint warnings. Cloudinary calls are mocked in tests; a real name/logo render should be smoke-tested against the configured Cloudinary account before production rollout.
