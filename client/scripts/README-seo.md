# Public SEO build

Run `npm ci`, `npm run build`, then `node scripts/test-seo-build.cjs` from `client/`.
Run the application tests with `CI=true npm test -- --watchAll=false --runInBand`.

The build renders the existing anonymous Landing component with React DOM Server.
It uses the Babel packages already locked by react-scripts; it adds no dependency.
It does not fetch accounts, media history, payments or AI generation data.
The browser hydrates only this homepage; application routes mount as before.

Build output:
- `index.html`: existing landing page with indexable HTML and metadata.
- `app-shell.html`: noindex application shell without a homepage canonical.
- `404.html`: noindex not-found document, served by Vercel for unknown URLs.
- `sitemap.xml`: homepage and six existing public policy pages.
- `robots.txt`: crawl permission and sitemap location.

Vercel rewrites only the known app paths to app-shell.html. Static public files
are served directly. Do not restore the catch-all rewrite: it turns missing
sitemaps, assets and nonexistent pages into successful homepage responses.
When adding an application route, update both `src/seo/metadata.js` and
`vercel.json` rewrites/headers. The build checks the app-route configuration.
Future public marketing routes need their own HTML, canonical, metadata and
sitemap entries; never publish a dashboard or user data to gain indexability.

Keep the stable favicon URL. The 192px PNG is already valid; Google controls
whether and when it appears. Social previews use the existing 512px logo.

This review branch is disabled in Vercel `git.deploymentEnabled`. No deployment
is required for local build checks. After explicit approval and deployment,
verify HTTP status/content type, public canonical/indexability, private noindex,
404 handling, www redirect and PageSpeed results on the actual hosting platform.
Only then submit the sitemap and request homepage indexing in Search Console.
