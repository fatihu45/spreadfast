# Studio staging handover — 24 November 2026

## Verified state

PR #52 is merged into `feat/spreadfast-studios`, at `b7e371292afe6758a7eb6b7132bdb6fa176f5e39`. Its tree matches the tested implementation. Main remains at `a85dac6`.

The connected Render workspace contains one service, `spreadfast`, tracking main with preview services disabled. Its latest live backend deploy is `a506a26` (15 November). A read-only check returned HTTP 200 and `mongoConnected: true` at `/api/health`, but HTTP 404 at `/api/studios/catalog`. The studio API is therefore not deployed on this service.

The fix-branch Vercel build is ready at:
https://spreadfast-git-fix-studio-readiness-20261123-fatihu45s-projects.vercel.app

Access currently redirects to Vercel sign-in. This is deployment access protection, before SpreadFast login. Recent Render logs also contain CORS denials; those historical entries do not record the origin. A separate read-only OPTIONS check using this exact preview origin returned HTTP 500, while the origin-free health check passed, confirming the preview-access problem.

## Prepared code

`CLIENT_URL` continues to support one client. `CLIENT_ORIGINS` adds a comma-separated list of exact frontend origins. Wildcards, credentials, paths, queries and fragments are rejected. Existing production and local-development defaults remain. Denied origins receive HTTP 403 and no CORS permission headers; allowed preflights retain authentication, idempotency and range support.

This is code on the studio branch. It does not change the current Render service configuration or make the production backend accept a preview.

## Separate staging backend

Create a new staging service from `feat/spreadfast-studios`; keep the existing production service on main. Use root `server`, build `npm ci`, and start `node server.js`. Use `/api/health` for health checks. An always-running instance is required while testing durable studio workers; confirm hosting costs before creating paid infrastructure.

Configure these values on the staging service only:

| Setting | Value or requirement |
| --- | --- |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | Isolated staging database with staging-only credentials and transaction support |
| `JWT_SECRET` | New staging secret; do not reuse production |
| `CLIENT_URL` | Exact chosen preview frontend origin |
| `CLIENT_ORIGINS` | Optional additional exact preview origins, comma-separated; no wildcard |
| `STUDIO_WORKER_ENABLED` | `false` until provider and cost settings are verified |
| `STUDIO_ENABLED_MODES` | Empty until each mode is approved for staging generation |
| Payment configuration | Paystack test keys and test callback/webhook URLs only |
| AI/media configuration | Staging-scoped provider keys and isolated media storage where available |
| Email configuration | Test delivery only; never connect staging to production mailing lists |

See `server/config/studios.js` and `docs/spreadfast-studios.md` for mode, voice licensing, pricing and margin requirements. Do not guess FX, contribution margins, voice IDs or secret values.

On Vercel, set `REACT_APP_API_URL` for the selected preview branch to that staging backend URL. Keep the production frontend/backend values intact. Redeploy the preview after changing this build-time variable. Use an authenticated Vercel preview session or the owner's supported sharing controls; do not disable production protections.

## Read-only preflight

From `server`:

```sh
node scripts/check-studio-preview.js https://YOUR-STAGING-BACKEND https://YOUR-FRONTEND-PREVIEW
```

This checks API/database health, studio catalog availability and authenticated-request CORS preflight. It sends only GET and OPTIONS requests, exits nonzero when readiness fails, and does not log users in, upload media, buy credits or generate ads. A passing result does not certify provider configuration or output quality.

Then use a staging account to check login, test-mode payment returns, try-on approval after reload, interrupted-job recovery and download behaviour. Paid AI fidelity/audio tests require a separate agreed budget. Finish with physical Safari/iPhone playback checks.
