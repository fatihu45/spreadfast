# Branded email and weekly marketing

All transactional templates now share `server/services/emailLayout.js`: the existing logo at `https://tryspreadfast.com/spreadfast-logo.png`, green #008050, navy #0F2435, white cards and pale green detail tables. Templates include text alternatives and escaped dynamic values. Welcome copy introduces Quick Ad and Fashion Studio. No historic transactional email is replayed.

## Admin use

Open Admin → Emails. Compose an email, preview, send a test to the fixed owner inbox `tryspreadfast@gmail.com`, and save a draft. Use **Send now** on a saved draft/ready email to queue immediate delivery (normally within a minute), even while the weekly schedule is paused, or add selected drafts to the weekly queue. Send now atomically claims the saved campaign; repeated clicks do not duplicate sends. Queued/sending status refreshes automatically. Choose all subscribed users, businesses, or promoter accounts per draft. The oldest ready email is sent once at the next eligible slot. Remove a queued email to return it to draft. Empty slots are skipped; completed emails are never recycled. To revise a draft, compose a replacement and leave the old one out of the queue.

The schedule defaults to **paused**, Monday/Wednesday/Friday at 08:00 Africa/Lagos. Four sends adds Sunday. The admin can change the hour. This is an ongoing weekly schedule consuming prepared content, not an AI content-writing service. Prepare fresh content in advance. Pause stops future slots, not a provider request already in flight. Current marketing delivery/click metrics remain in Resend; the app records submission status, audience count, provider broadcast ID and test-email status.

## Subscription behavior

New signup checkbox is optional and unchecked. Subscribed-only audiences exclude existing accounts without opt-in. The admin can explicitly select **All signed-up users (except unsubscribed)** for a product update: this includes active legacy/default accounts without a recorded preference, but excludes recorded account-preference opt-outs and Resend unsubscribes. This audience does not change anyone’s stored subscription preference. Existing users can subscribe from Profile → Email preferences (`/email-preferences`). Recipient selection does not record inferred consent. Signup and preferences record the consent time and source.

At send time the worker selects active business/promoter accounts according to the saved audience, deduplicates email addresses and synchronizes them to a dedicated Resend segment for that broadcast. Existing Resend contacts are never resubscribed by synchronization. Resend's global unsubscribe status wins; failed lookups abort instead of guessing. Broadcasts include the provider unsubscribe placeholder and an account-preferences link. An explicit opt-in in account preferences may resubscribe that user's contact. Opt-out also updates Resend to suppress any already-created segments. Transactional messages are unaffected.

## Runtime and safety

Uses the existing Node backend, MongoDB and Resend SDK. No new paid service or cron resource. A minute worker runs while the backend is awake; current Render Starter service is always on. A scheduled hour has a one-hour recovery window. A full outage through that hour skips the slot, rather than sending a backlog. MongoDB is required; no file fallback for marketing.

A unique durable slot plus atomic campaign claim prevents duplicate workers/restarts sending the same queued email. Resend errors/ambiguous responses move the campaign to `needs_review`, without automatic resending. A stale `sending` row is flagged for review after one hour. Reconcile its broadcast/segment in Resend before manual recovery. Do not delete slot records to retry. Dedicated per-send segments are retained for audit; periodically archive unused segments in Resend as the account grows.

Existing `RESEND_API_KEY`, verified sender `noreply@tryspreadfast.com`, `ADMIN_EMAIL`, and email safety switches are reused. Marketing needs a Resend API key with Contacts/Segments/Broadcasts permissions and an appropriate marketing plan. A sending-only key can pass the transactional test but cannot operate marketing. Verify those permissions before enabling the schedule. Production and `EMAILS_ENABLED` gates apply. Non-production never broadcasts.

## Owner-only live test

Admin test sends use the existing durable transactional outbox, are fixed to `tryspreadfast@gmail.com`, and require an idempotency request key. To request a single deployment test without an admin browser session, set `EMAIL_DESIGN_TEST_NONCE` to a unique non-secret value in Render. The worker queues one branded starter test per nonce; restarts reuse the record. Remove or clear the variable after the test. Logs report `[Email design test] Resend accepted` with provider ID after acceptance. This is not evidence of inbox placement. Non-production redirects obey `EMAIL_TEST_RECIPIENT`.

## Validation

Backend tests cover branded rendering, input validation, Lagos scheduling, opt-in filtering, provider unsubscribe preservation, worker races, ambiguous send responses, test deduplication, admin authorization and account-only preferences. Existing transactional tests remain in place. Frontend production build and existing registration/admin/metadata suites are checked. Provider sends and real inbox appearance require the controlled live test; no bulk campaign is sent as part of deployment.
