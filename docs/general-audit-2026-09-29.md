# SpreadFast frontend and backend audit

Date: 29 September 2026. Scope: repository review, automated checks, and isolated local HTTP/handler checks. No application code was changed. No real payments, AI requests, emails, or production database writes were performed.

## Overall result

FAIL ? the application compiles and its existing tests pass, but confirmed navigation, runtime, security, and configuration issues remain. Passing tests do not establish that every deployed page or third-party callback works.

## Checks and results

| Area | Result | Evidence / limits |
|---|---|---|
| Frontend production build and imports | PASS | npm run build compiled successfully. |
| Frontend automated tests | PASS | 172 tests in 22 suites. |
| Backend automated tests | PASS | 119 tests; no failures. |
| Backend JavaScript syntax | PASS | node --check passed for 45 files. |
| Frontend source parsing/assets | PASS | 64 non-test JS/JSX files parsed; no missing literal absolute image/video asset references found. Dynamic references were not exhaustively validated. |
| Strict lint / unused code | FAIL | With inline suppressions disabled: 32 errors, 22 warnings across 86 files. Nine errors are undefined API references; 23 concern test-library practices. Warnings include unused variables, effect dependencies, and placeholder links. |
| Page loading and navigation | FAIL | /dashboard never finishes loading campaigns; campaign emails link to an unregistered route. |
| Login and payment-return recovery | FAIL | Storage-denied login path throws; protected payment callback loses its return destination at login. |
| Backend error handling / logging | FAIL | Public test-email handler ignores a failed send result; legacy payment handlers log raw Axios errors. |
| Public API data exposure | FAIL | Public campaign responses return full records, including payment references and subscribed-promoter details. |
| Isolated backend startup | PASS | With database/providers deliberately disabled: health 200, public plans 200, protected credits 401. This is not a live database availability test. |
| CORS | PASS for tested origins | Quick Ads preflight allowed authorization/idempotency headers; bank-update PUT preflight returned 204 and includes PUT. Custom deployment origins still require configuration. |
| Environment configuration | FAIL in example file | Local required key names are present, but root example documents the wrong frontend API variable. No secret values were printed. |
| Quick Ads generation / credit / media safeguards | PASS in existing automated checks | Existing tests passed; 8 MB checks, current source endpoint, server-side credits, and inline video controls inspected. No live provider/schema verification was performed. |
| Mobile rendering and real Safari playback | NOT VERIFIED | No browser/device automation was available. Conditional browser-storage issue identified below. |
| Live Paystack, Cloudinary, fal.ai, Resend, MongoDB | NOT VERIFIED | Requires an authorized staging/end-to-end run. |

## Confirmed findings, in priority order

### 1. Public endpoint can trigger test emails

**High ? server/server.js:819**

GET /api/test-email has no authentication or endpoint rate limit. When email delivery is enabled, arbitrary callers can trigger messages to the configured admin/test recipient. It also reports success regardless of the sender returning success:false. An isolated handler reproduction used a mocked sender and confirmed both behavior and missing authentication; no email was sent.

Suggested correction: remove it from production or restrict it to authenticated administrators with rate limiting, and respect the sender result.

### 2. Public campaign APIs return internal fields

**High ? server/server.js:1384, 1394, 1505; schema fields at 436?437**

Campaign listing, company listing, and individual campaign reads have no authentication and return complete campaign documents. These include paystackReference and subscribedPromoters, whose entries contain promoter IDs/names. Public discovery may be intentional, but public DTOs should not include internal transaction/participant fields. A mocked handler confirmed these fields pass through unchanged; no production records were accessed.

Suggested correction: explicitly select public fields and keep owner/member details behind existing authorization. Review public asset-preview responses too: they return original media URLs, which may conflict with intended subscriber-only download access.

### 3. /dashboard never finishes loading campaigns

**Medium ? client/src/pages/Dashboard.jsx:10?18, 45; client/src/pages/Landing.jsx:32, 96**

Loading starts true, but the effect contains only a fetch placeholder and never updates loading or campaigns. This is reachable from the landing page, rather than simply an unused component. Its campaign area remains on ?Loading campaigns...?.

Suggested correction: route users to the existing working role dashboard or complete the existing fetch/error handling without duplicating dashboard functionality.

### 4. Campaign-alert emails navigate to an unregistered page

**Medium ? server/server.js:695; client/src/App.jsx**

Campaign emails link to /campaigns, but the router does not register it. A Campaigns component existing on disk does not make it routable. There is also no wildcard route to provide a useful not-found page, so unmatched paths can render blank content.

Suggested correction: link to the existing appropriate campaign route and provide deliberate unknown-route handling.

### 5. Payment return destination is lost when authentication is required

**Medium ? client/src/App.jsx:27, 105; client/src/pages/Login.jsx:48?65; client/src/pages/QuickAdCredits.jsx:28**

The credits callback can carry its payment reference in /quickads/credits?reference=.... If the user is unauthenticated, ProtectedRoute redirects to /login without preserving the intended destination/query. Successful login redirects to the normal dashboard instead of resuming verification. Session storage and webhooks can still recover/settle purchases; this finding does not establish lost money or missing credits in every case.

Suggested correction: preserve a validated internal return destination and resume payment verification after login. Keep backend verification authoritative.

### 6. Login can fail when browser storage is denied

**Medium ? client/src/pages/Login.jsx:26**

The redirect interval reads localStorage without try/catch before trying sessionStorage. If localStorage access throws, the fallback is never reached. The isolated reproduction confirmed this even with a token in mocked sessionStorage. This can affect restricted browser contexts, including some mobile configurations; it is not a claim that all Safari logins fail. Full-page redirects also discard memory-only authentication state.

Suggested correction: reuse the authentication layer's safe storage handling and avoid depending on an unguarded storage polling loop.

### 7. Raw payment errors can expose authorization headers in server logs

**Medium ? server/server.js:1090, 1125 and other legacy payment catch handlers**

Several handlers log entire Axios error objects. These can contain request configuration, including Authorization headers. A constructed Axios error with a fake key confirmed that normal inspection prints the fake bearer value. This is a potential secret leak into server logs, not evidence that a real key was already leaked or returned to the browser.

Suggested correction: log allowlisted status/code/reference fields and redact credentials. Apply the safer pattern already used by Quick Ads.

### 8. Environment example uses the wrong frontend API variable

**Medium ? .env.example:2; client/src/utils/api.js:6**

The root example advertises REACT_APP_API_BASE_URL ending in /api. Active API code expects REACT_APP_API_URL with the backend origin and appends /api in callers. Following the example can fall back to localhost or produce an incorrect base. The existing local client environment does contain the expected variable; this is a setup/deployment trap, not a proven current production failure.

### 9. Undefined references remain in legacy API helpers

**Low ? client/src/utils/api.js:1, 9?17**

Nine exported helpers call API, which is never defined. The file-wide eslint-disable hides these from normal linting. Current AdminDashboard uses other helpers, so this is latent broken code rather than proof that the active admin dashboard crashes. Some older helpers also use endpoint paths inconsistent with the active /api routes.

Suggested correction: remove unused helpers or align them with the shared authenticated API layer, then narrow lint suppressions.

### 10. Placeholder navigation and lint warnings remain

**Low ? client/src/pages/Landing.jsx:262, 267**

?View Promoters? and ?How to Earn? use href="#", which does not lead to the promised destination. Strict lint also flags unused state/imports and effect dependencies across several components. These warnings need targeted review; they do not all represent proven runtime failures. Browserslist reports an outdated caniuse-lite dataset, but the production build succeeds.

## Deployment and end-to-end checks still needed

- Directly refresh /company, /promoter-dashboard, /login, /reset-password, /payment-callback, /admin-portal, and both Quick Ads routes on the deployed host. client/vercel.json explicitly rewrites only Quick Ads paths; framework-level fallback may cover others, so deployed 404s are not confirmed.
- Confirm custom frontend origins are in CORS through CLIENT_URL. FRONTEND_URL alone is not read into that allowlist; tryspreadfast.com and www.tryspreadfast.com are explicitly allowed.
- Verify MongoDB transaction support, production connection availability, and recovery behavior. The local smoke test intentionally disabled MongoDB and third-party credentials.
- Exercise Paystack success, rejection, abandoned checkout, expired-login return, repeated verification, and webhook recovery in test mode.
- Generate one staging Quick Ad through Cloudinary and fal.ai, then check protected preview, paid download, timeout recovery, and credit accounting on real Safari/Android/desktop browsers.
- Check Resend delivery and queued retries using a controlled test inbox.
- The current Quick Ads model is hardcoded in server/routes/quickAds.js:12. It uses Kling 2.5 Turbo Pro rather than deprecated Kling 2.1, but environment-controlled provider/model switching remains an architectural gap relative to the earlier requirement.
- This audit did not query a live dependency-vulnerability database or penetration-test production.

## Commands used

- Frontend: npm test -- --watchAll=false --runInBand
- Frontend: npm run build
- Additional lint: eslint src --ext .js,.jsx --no-inline-config --format json
- Backend: node --test server/tests/*.test.js
- Backend source: node --check on 45 JavaScript files
- Isolated startup/HTTP, CORS, mocked route-handler, browser-storage, and dummy Axios-error checks

Only this report is intended as a repository deliverable. Application source was left unchanged.
