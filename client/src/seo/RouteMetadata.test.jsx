import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import RouteMetadata from './RouteMetadata';
import { APP_PATHS, HOME_TITLE } from './metadata';
import deployment from '../../vercel.json';

let container, root;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  document.head.innerHTML = '';
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
function visit(path) {
  act(() => root.render(<MemoryRouter key={path} initialEntries={[path]}><RouteMetadata /></MemoryRouter>));
}
test('homepage metadata is restored after private navigation without leaking query values', () => {
  visit('/');
  expect(document.title).toBe(HOME_TITLE);
  expect(document.querySelector('link[rel="canonical"]').href).toBe('https://tryspreadfast.com/');
  visit('/reset-password?token=never-publish-this');
  expect(document.querySelector('meta[name="robots"]').content).toBe('noindex, nofollow');
  expect(document.querySelector('link[rel="canonical"]')).toBeNull();
  expect(document.querySelector('meta[property="og:url"]')).toBeNull();
  expect(document.head.innerHTML).not.toContain('never-publish-this');
  visit('/?utm_source=campaign');
  expect(document.querySelector('meta[name="robots"]').content).toContain('index, follow');
  expect(document.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
  expect(document.querySelector('link[rel="canonical"]').href).toBe('https://tryspreadfast.com/');
});
test.each(APP_PATHS)('%s has noindex in the browser and a server header on direct load', path => {
  visit(path);
  expect(document.querySelector('meta[name="robots"]').content).toBe('noindex, nofollow');
  expect(deployment.routes).toContainEqual({ src: `^${path}/?$`, dest: '/app-shell.html', headers: { 'X-Robots-Tag': 'noindex, nofollow' } });
});
test('unknown pages are noindex and deployment has no catch-all success rewrite', () => {
  visit('/unknown-page');
  expect(document.title).toBe('Page Not Found | SpreadFast');
  expect(document.querySelector('meta[name="robots"]').content).toBe('noindex, nofollow');
  expect(deployment.routes[deployment.routes.length - 2]).toEqual({ handle: 'filesystem' });
  expect(deployment.routes[deployment.routes.length - 1]).toEqual({ src: '/.*', dest: '/404.html', status: 404, headers: { 'X-Robots-Tag': 'noindex, nofollow' } });
  expect(deployment.git.deploymentEnabled['seo/technical-audit-2026-10-08']).toBe(false);
});
