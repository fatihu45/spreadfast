# Financial operations and local data

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
