# Reliability fixes — 12 November 2026

These changes start from main and do not incorporate the separate SpreadFast Studios expansion.

## Changes

- Failed Quick Ad branding retains the saved video and releases the credit reservation. Recovery reuses existing provider output and charges only after successful completion. Claims and execution IDs prevent competing recovery attempts from charging twice.
- An expiry watchdog releases abandoned reservations and makes one automatic recovery attempt when saved video or complete commercial scenes are available. Earlier stages without saved output still need a new user request; this is not a durable queue for every generation stage.
- My Ads combines existing ad types with pagination, filtering, deletion and saved-video recovery. Commercial retries show progress for the selected ad, including older history pages. Progress no longer moves backwards between scenes.
- Email identity lookup supports historical case/whitespace differences and refuses ambiguous matches. New passwords have server-side length limits, reset tokens are consumed conditionally, and password changes revoke previous sessions.
- Authentication endpoints have shared MongoDB-backed rate limits. The Express proxy configuration assumes one trusted reverse proxy, matching the intended Render deployment; review it if the deployment topology changes.
- Profile settings support name and password changes. Admin access checks use a shared policy. Credit pages explain existing commercial costs and the admin dashboard identifies recoverable ads and old unconfirmed payments.
- Marketing opt-outs persist before calling the email provider, so provider failures cannot accidentally restore marketing eligibility.
- Compatible dependency updates remove backend production audit findings. GitHub Actions runs tests, backend production audit, frontend build and SEO checks. Making these required merge checks remains a repository setting.

## Validation

- Backend: 241 tests pass.
- Frontend: 220 tests pass across 26 suites.
- Production frontend build and SEO checks pass; existing compiler warnings remain.
- Backend production dependency audit: zero known vulnerabilities at verification time.
- Frontend production audit still reports two moderate React Router advisories. A major router/build-tool migration is deferred; development-tool dependency findings also remain.

Tests use mocked providers. Live Paystack transactions, fal generations, Cloudinary processing, Resend delivery and production database behavior were not exercised. No production secrets or data were changed. Fully durable generation across all stages and precise provider-cost accounting remain separate work.
