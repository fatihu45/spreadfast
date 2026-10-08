/* Render the existing homepage at build time; never fetch user or backend data.
 * Babel and React DOM already ship with the locked react-scripts toolchain.
 */
process.env.NODE_ENV = 'production';
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');
const src = path.resolve(__dirname, '../src');
const build = path.resolve(__dirname, '../build');
const originalJs = require.extensions['.js'];
function compile(module, filename) {
  if (!filename.startsWith(src + path.sep)) return originalJs(module, filename);
  const { code } = babel.transformFileSync(filename, {
    babelrc: false, configFile: false,
    presets: [[require.resolve('@babel/preset-env'), { targets: { node: 'current' } }], require.resolve('@babel/preset-react')],
  });
  module._compile(code, filename);
}
require.extensions['.js'] = compile;
require.extensions['.jsx'] = compile;
require.extensions['.css'] = () => {};
const React = require('react');
const { renderToString } = require('react-dom/server');
const { StaticRouter } = require('react-router-dom/server');
const { AuthContext } = require('../src/context/AuthContext');
const Landing = require('../src/pages/Landing').default;
const { APP_PATHS, metadataForPath, SITE_URL, HOME_TITLE, HOME_DESCRIPTION } = require('../src/seo/metadata');
const template = fs.readFileSync(path.join(build, 'index.html'), 'utf8');
const home = renderToString(React.createElement(StaticRouter, { location: '/' },
  React.createElement(AuthContext.Provider, { value: { user: null } }, React.createElement(Landing))));
if (!home.includes('landing-title')) throw new Error('Homepage pre-render produced no main heading');
fs.writeFileSync(path.join(build, 'index.html'), template.replace('<div id="root"></div>', `<div id="root" data-prerendered="true">${home}</div>`));
const privateMeta = metadataForPath('/login');
if (!template.includes(HOME_TITLE) || !template.includes(HOME_DESCRIPTION)) throw new Error('Homepage metadata is out of sync');
const app = template
  .replaceAll(HOME_TITLE, privateMeta.title)
  .replaceAll(HOME_DESCRIPTION, privateMeta.description)
  .replaceAll('Create AI-powered video ads, launch creator campaigns, and reach more customers with SpreadFast.', privateMeta.description)
  .replace(/<title>[\s\S]*?<\/title>/, '<title>Your Account | SpreadFast</title>')
  .replace(/<meta name="robots"[^>]*>/, '<meta name="robots" content="noindex, nofollow"/>')
  .replace(/<link rel="canonical"[^>]*>/, '')
  .replace(/<meta property="og:url"[^>]*>/, '')
  .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
fs.writeFileSync(path.join(build, 'app-shell.html'), app);
const notFound = app.replace('<title>Your Account | SpreadFast</title>', '<title>Page Not Found | SpreadFast</title>')
  .replace('<div id="root"></div>', '<div id="root"><main class="sf-page"><h1>Page not found</h1><p>This page may have moved.</p><a href="/">Return to SpreadFast</a></main></div>');
fs.writeFileSync(path.join(build, '404.html'), notFound);
const policies = fs.readdirSync(path.join(build, 'policies')).filter(file => file.endsWith('.html'));
const urls = [metadataForPath('/').canonical, ...policies.map(file => `${SITE_URL}/policies/${file}`)];
fs.writeFileSync(path.join(build, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url => `  <url><loc>${url}</loc></url>`).join('\n')}\n</urlset>\n`);
const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../vercel.json')));
for (const appPath of APP_PATHS) {
  if (!config.routes.some(rule => rule.src === `^${appPath}/?$` && rule.dest === '/app-shell.html')) {
    throw new Error(`Missing application rewrite for ${appPath}`);
  }
}
console.log(`Pre-rendered homepage; generated noindex app shell, 404, and sitemap (${urls.length} public URLs).`);
