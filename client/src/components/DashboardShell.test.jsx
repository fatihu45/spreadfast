import React from 'react';
import { createRoot } from 'react-dom/client';
import { act as legacyAct } from 'react-dom/test-utils';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import DashboardShell from './DashboardShell';
const act = React.act || legacyAct;
let host, root, logout;
function Location() { const location = useLocation(); return <output>{location.pathname + location.search + location.hash}</output>; }
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); logout = jest.fn();
  HTMLElement.prototype.scrollIntoView = jest.fn();
  window.scrollTo = jest.fn();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(() => { act(() => root.unmount()); host.remove(); });
function render(role, path) {
  act(() => root.render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <AuthContext.Provider value={{ user: { name: 'Test User', email: 'test@example.com', role }, logout }}>
      <DashboardShell><h1>Existing content</h1><div id="create-campaign" tabIndex={-1} /><div id="company-campaigns" tabIndex={-1} /><Location /></DashboardShell>
    </AuthContext.Provider>
  </MemoryRouter>));
}
test('creator navigation preserves existing routes and proof query parameters', () => {
  render('promoter', '/submit-proof?campaignId=42');
  expect(host.querySelector('output').textContent).toBe('/submit-proof?campaignId=42');
  for (const nav of host.querySelectorAll('.sf-sidebar nav, .sf-mobile-navigation')) {
    expect([...nav.querySelectorAll('a')].map(a => a.getAttribute('href'))).toEqual(['/promoter-dashboard', '/available-campaigns', '/wallet']);
    expect(nav.querySelector('[aria-current="page"]').textContent).toBe('Campaigns');
    expect(nav.querySelector('button').textContent).toBe('Profile');
  }
  expect(host.querySelector('h1').textContent).toBe('Existing content');
});
test('business sections navigate within company route with one active item', () => {
  render('company', '/company');
  expect(host.querySelector('a[href="/wallet"]')).toBeNull();
  const nav = host.querySelector('.sf-sidebar nav');
  expect([...nav.querySelectorAll('a')].map(a => a.textContent)).toEqual(['Overview', 'Campaigns', 'Create Campaign']);
  act(() => [...nav.querySelectorAll('a')].find(a => a.textContent === 'Create Campaign').click());
  expect(host.querySelector('output').textContent).toBe('/company#create-campaign');
  expect(nav.querySelectorAll('[aria-current="page"]').length).toBe(1);
  expect(nav.querySelector('[aria-current="page"]').textContent).toBe('Create Campaign');
  expect(document.activeElement.id).toBe('create-campaign');
});
test('profile shows existing account data without navigation and settings remain disabled', () => {
  render('promoter', '/wallet');
  act(() => host.querySelector('.sf-mobile-navigation button').click());
  expect(host.querySelector('dialog').open).toBe(true);
  expect(host.querySelector('dialog').textContent).toContain('test@example.com');
  expect(host.querySelector('output').textContent).toBe('/wallet');
  act(() => host.querySelector('[aria-label="Close profile"]').click());
  expect(host.querySelector('dialog').open).toBe(false);
  const settings = [...host.querySelectorAll('button')].filter(b => b.textContent === 'Settings');
  expect(settings.length).toBe(2); settings.forEach(b => expect(b.disabled).toBe(true));
});
test.each(['.sf-sidebar__footer', '.sf-dashboard-more'])('logout in %s invokes existing auth action and returns home', selector => {
  render('company', '/wallet');
  act(() => [...host.querySelector(selector).querySelectorAll('button')].find(b => b.textContent === 'Log out').click());
  expect(logout).toHaveBeenCalledTimes(1); expect(host.querySelector('output').textContent).toBe('/');
});
