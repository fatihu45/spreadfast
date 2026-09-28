import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import App from './App';
import { AuthContext } from './context/AuthContext';
import deployment from '../vercel.json';

jest.mock('axios', () => ({ get: jest.fn(() => new Promise(() => {})), post: jest.fn() }));
jest.mock('./context/AuthContext', () => ({
  AuthContext: require('react').createContext(),
  AuthProvider: ({ children }) => children,
}));
jest.mock('./pages/CompanyDashboard', () => () => <div>Business overview</div>);
jest.mock('./pages/PromotionDashboard', () => () => <div>Creator overview</div>);

let root;
let container;
const navs = () => [...container.querySelectorAll('nav[aria-label="Main navigation"], nav[aria-label="Mobile navigation"]')];
const quickLink = nav => [...nav.querySelectorAll('a')].find(link => link.textContent === 'Quick Ads');
function render(path, role = 'company', loading = false) {
  window.history.replaceState({}, '', path);
  act(() => root.render(<AuthContext.Provider value={{
    user: role ? { role, name: 'Test account' } : null,
    token: 'test-token', loading, logout: jest.fn(),
  }}><App /></AuthContext.Provider>));
}
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  process.env.REACT_APP_API_URL = 'https://api.example';
  axios.get.mockImplementation(() => new Promise(() => {}));
  jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.restoreAllMocks();
});

test.each([
  ['company', '/company', '/company/quick-ads', 'Create Campaign'],
  ['promoter', '/promoter-dashboard', '/promoter/quick-ads', 'Wallet'],
])('%s navigation links reuse desktop and mobile styles and become active on click', (role, home, destination, previous) => {
  render(home, role);
  expect(navs()).toHaveLength(2);
  for (const nav of navs()) {
    const link = quickLink(nav);
    expect(link.getAttribute('href')).toBe(destination);
    expect(link.className).toBe('sf-navigation-link');
    expect(link.querySelector('.sf-icon')).not.toBeNull();
    expect(link.closest('li').previousElementSibling.textContent).toBe(previous);
    expect(link.closest('li').nextElementSibling.textContent).toBe('Profile');
  }
  act(() => quickLink(navs()[1]).click());
  expect(window.location.pathname).toBe(destination);
  expect(container.querySelector('#quick-ad-title').textContent).toBe('Turn one photo into an ad.');
  for (const nav of navs()) {
    expect(quickLink(nav).getAttribute('aria-current')).toBe('page');
    expect(quickLink(nav).classList.contains('sf-navigation-link--active')).toBe(true);
    expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  }
});

test.each([
  ['company', '/company/quick-ads'],
  ['promoter', '/promoter/quick-ads'],
])('direct loads and remounts work for %s Quick Ads', (role, path) => {
  render(path, role);
  expect(container.querySelector('#quick-ad-title')).not.toBeNull();
  act(() => root.unmount());
  root = createRoot(container);
  render(path, role);
  expect(container.querySelector('#quick-ad-title')).not.toBeNull();
  expect(deployment.rewrites).toContainEqual({ source: path, destination: '/index.html' });
});

test.each([
  ['company', '/quickads'], ['promoter', '/quickads'],
  ['company', '/quick-ad'], ['promoter', '/quick-ad'],
])('legacy %s %s link redirects to the matching dashboard', (role, path) => {
  render(`${path}?source=landing`, role);
  expect(window.location.pathname).toBe(`/${role}/quick-ads`);
  expect(window.location.search).toBe('?source=landing');
  expect(container.querySelector('#quick-ad-title')).not.toBeNull();
});

test.each(['/company/quick-ads', '/promoter/quick-ads', '/quickads', '/quick-ad'])('%s keeps the existing login guard', path => {
  render(path, null);
  expect(window.location.pathname).toBe('/login');
  expect(container.querySelector('#quick-ad-title')).toBeNull();
});

test('legacy redirect waits for existing authentication loading to finish', () => {
  render('/quickads', null, true);
  expect(window.location.pathname).toBe('/quickads');
  expect(container.textContent).toBe('Loading...');
});

test.each(['company', 'promoter'])('%s credits direct route retains dashboard navigation and refresh support', role => {
  render('/quickads/credits', role);
  expect(container.querySelector('h1').textContent).toBe('Quick Ads Credits');
  expect(quickLink(navs()[0]).getAttribute('aria-current')).toBe('page');
  expect(deployment.rewrites).toContainEqual({ source: '/quickads/credits', destination: '/index.html' });
});
