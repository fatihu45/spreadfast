# Campaign pricing

New payments initiated with this release store pricing version `creator-20000-included-25-v1` on the Paystack transaction. Campaigns and submissions retain that snapshot.

- Business price: NGN 20,000 per creator; budgets must be positive whole multiples of NGN 20,000.
- Included platform share: 25%, or NGN 5,000 per creator.
- Creator allocation: NGN 15,000 per creator, credited after approval.
- No additional platform deduction is made when withdrawing those earnings.
- Sponsored advertising and other independent costs are unchanged.

The backend is authoritative. Payment verification checks the saved reference, owner (for authenticated requests), currency and gross amount. New campaigns use deterministic payment IDs so webhook, polling and callback retries converge. Purchased capacity is enforced when joining. Approval credits the saved net amount using an atomic wallet credit plus receipt, allowing retries without double crediting the same creator for the same campaign.

## Existing records

Unversioned campaigns and previously issued payment transactions retain their original terms. There is no data migration or recalculation of existing balances, approvals or completed withdrawals. Legacy slots retain their previous NGN 5,000 calculation and legacy approvals retain their chosen amounts. Never add the new pricing snapshot to historical records merely to update their display.

## Admin reporting

The 25% platform share and creator allocation are summed from confirmed versioned payment transactions, including payments for subsequently deleted campaigns. Pending and failed payments are excluded. The old 5% campaign estimate is displayed separately as a legacy estimate; it is not included in recorded new revenue. Withdrawals do not generate an estimated fee.

## Validation and release

From the repository root: `node --test server/tests/campaignPricing.test.js`.
From client: `npm test -- --watchAll=false --runInBand` and `npm run build`.

Backend tests execute the real handlers and JSON adapter with in-memory dependencies. They do not connect to MongoDB, contact Paystack, load production credentials or modify application data. Deploy the backend and client together; no seed script or historical-data migration is required. Live Paystack and MongoDB integration still require environment-level verification before a production rollout.
