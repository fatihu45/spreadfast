const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const build = path.resolve(__dirname, '../build');
const read = file => fs.readFileSync(path.join(build, file), 'utf8');
const homeHtml = read('index.html');
const home = new JSDOM(homeHtml, { url: 'https://tryspreadfast.com/' });
const doc = home.window.document;
assert.equal(doc.querySelectorAll('h1').length, 1);
assert(doc.querySelector('#root[data-prerendered="true"] #landing-title'));
assert.equal(doc.querySelectorAll('link[rel="canonical"]').length, 1);
assert.equal(doc.querySelector('link[rel="canonical"]').href, 'https://tryspreadfast.com/');
assert(!doc.querySelector('meta[name="robots"]').content.includes('noindex'));
for (const node of doc.querySelectorAll('script[type="application/ld+json"]')) JSON.parse(node.textContent);
for (const node of doc.querySelectorAll('img[src], link[rel="icon"], meta[property="og:image"], meta[name="twitter:image"]')) {
  const url = new URL(node.getAttribute('src') || node.getAttribute('href') || node.getAttribute('content'), home.window.location.href);
  assert(fs.existsSync(path.join(build, url.pathname)), `Missing asset ${url.pathname}`);
}
const sitemap = new JSDOM(read('sitemap.xml'), { contentType: 'application/xml' }).window.document;
const urls = [...sitemap.querySelectorAll('loc')].map(node => node.textContent);
assert.equal(urls.length, 7);
assert.equal(new Set(urls).size, urls.length);
for (const url of urls) {
  const pathname = new URL(url).pathname;
  const html = pathname === '/' ? homeHtml : read(pathname);
  const page = new JSDOM(html).window.document;
  assert.equal(page.querySelector('link[rel="canonical"]').href, url);
  assert(!page.querySelector('meta[name="robots"]').content.includes('noindex'));
}
assert(read('robots.txt').includes('Sitemap: https://tryspreadfast.com/sitemap.xml'));
for (const name of ['app-shell.html', '404.html']) {
  const page = new JSDOM(read(name)).window.document;
  assert(page.querySelector('meta[name="robots"]').content.includes('noindex'));
  assert.equal(page.querySelector('link[rel="canonical"]'), null);
}
// Execute the actual built bundle in a DOM, without network, payments, or real accounts.
const errors = [];
const vc = new VirtualConsole();
vc.on('error', message => errors.push(String(message)));
vc.on('jsdomError', error => errors.push(error.message));
const dom = new JSDOM(homeHtml, { url: 'https://tryspreadfast.com/', runScripts: 'outside-only', virtualConsole: vc, pretendToBeVisual: true });
const headingBefore = dom.window.document.querySelector('#landing-title');
for (const script of doc.querySelectorAll('script[src^="/static/js/"]')) dom.window.eval(read(new URL(script.src).pathname));
setTimeout(() => {
  try {
    assert.equal(dom.window.document.querySelector('#landing-title'), headingBefore, 'Hydration replaced the existing heading');
    dom.window.document.querySelector('#faq-question-0').click();
    setTimeout(() => {
      try {
        assert.equal(dom.window.document.querySelector('#faq-answer-0').hidden, false);
        dom.window.document.querySelector('.landing-login').click();
        setTimeout(() => {
          try {
            assert.equal(dom.window.location.pathname, '/login');
            assert(dom.window.document.querySelector('meta[name="robots"]').content.includes('noindex'));
            assert.equal(dom.window.document.querySelector('link[rel="canonical"]'), null);
            assert.deepEqual(errors, [], 'Production runtime errors');
            console.log('SEO build checks passed: raw HTML, 7 sitemap URLs, metadata/assets, private shells, production hydration, FAQ and login navigation.');
          } catch (error) { console.error(error); process.exitCode = 1; }
          finally { dom.window.close(); }
        }, 50);
      } catch (error) { console.error(error); process.exitCode = 1; dom.window.close(); }
    }, 50);
  } catch (error) { console.error(error); process.exitCode = 1; dom.window.close(); }
}, 100);
