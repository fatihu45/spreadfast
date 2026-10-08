# Policy update review — 8 October 2026

This branch updates the public terms, privacy, cookie/storage and disclaimer pages, adds refund/credits and acceptable-use pages, links them from the landing footer and credit purchase page, and corrects registration policy rendering. It does not change billing or generation behaviour.

## Behaviour checked against the repository

- `server/services/quickAdCredits.js`: one free preview, then one credit debited only on successful completion; Fashion Studio uses the same accounting.
- `server/services/quickAdMedia.js`: verified lifetime credit purchases unlock the completed trial without another debit, including when remaining credits are zero.
- `server/routes/quickAds.js`: fal.ai commercial-image and video processing; Cloudinary uploads; Fashion Studio requires front/back images.
- `server/routes/quickAdMedia.js`: history deletion is a soft delete; records and media remain, including campaign assets.
- `server/services/campaignPricing.js`: current campaign slot is NGN 20,000 including 25% platform allocation; legacy campaigns preserve recorded terms. Removed obsolete 7.5% wording.
- `client/src/context/AuthContext.js`, QuickAd and QuickAdCredits: local/session storage for login, request IDs and pending payments. No marketing pixel integration found in application code; deployment-level integrations still need review.
- `server/services/emailService.js`: Resend for service email.

## Owner actions before publishing

1. Confirm the legal operator's full name, business registration details where applicable, and service/contact address. Add these to Terms and Privacy; the repository does not establish them. Confirm that tryspreadfast@gmail.com is monitored for complaints and privacy requests (it is the existing privacy contact).
2. Have Nigerian counsel review the proposed legal wording and refund process. This is a product-aligned draft, not a compliance certification. Agree a practical support response process and refund handling; no new automated refund facility was implemented.
3. Confirm production service providers and locations, contractual data-processing terms, lawful international-transfer safeguards, and actual fal/model-provider training and retention settings. The policy deliberately does not promise zero retention or no training by every provider.
4. Establish a retention schedule and an operational erasure process covering MongoDB, Cloudinary originals/outputs, backups and third-party processors. History deletion is NOT full erasure. There is no verified fixed retention period to publish yet.
5. Record accepted terms version and timestamp server-side, notify existing users of material changes, and obtain renewed acceptance where needed. The existing signup checkbox is still client-side; this branch changes the wording, not consent-record infrastructure.
6. Review deployment-level analytics and third-party cookies; add optional tracking consent only if needed for the actual deployed integrations.
7. Obtain documented permission for customer examples shown publicly and clarify creator content reuse rights in campaign briefs. An operational upload licence alone is not permission for unrelated marketing reuse.

## Primary reference checks

- Nigeria Data Protection Commission: https://ndpc.gov.ng/faqs/ and https://www.ndpc.gov.ng/ndp-act-2023/
- FCCPC consumer rights: https://fccpc.gov.ng/consumers/consumer-rights-responsibilities/rights-responsibilities/
- FCCPC complaint handling: https://fccpc.gov.ng/consumers/complaint-handling/

Refund wording preserves statutory remedies rather than asserting a blanket no-refund rule. Privacy wording separates notice acknowledgement from consent, identifies AI/media processing, and does not promise immediate media erasure on history deletion.
