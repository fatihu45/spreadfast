import React from 'react';
import { createRoot } from 'react-dom/client';
import { act as legacyAct } from 'react-dom/test-utils';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { apiCallAuth } from '../utils/api';
import AdminDashboard from './AdminDashboard';
jest.mock('../utils/api', () => ({ apiCallAuth: jest.fn() }));
const act = React.act || legacyAct;
jest.setTimeout(30000);
let host, root, logout;
function Location() { return <output>{useLocation().pathname}</output>; }
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); logout = jest.fn();
  apiCallAuth.mockReset();
  apiCallAuth.mockResolvedValue(quickAnalytics);
});
afterEach(() => { act(() => root.unmount()); host.remove(); jest.restoreAllMocks(); });
async function render() { await act(async () => root.render(<MemoryRouter initialEntries={['/admin-portal']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AuthContext.Provider value={{ user: { name: 'Admin' }, token: 'admin-token', logout }}><AdminDashboard /><Location /></AuthContext.Provider></MemoryRouter>)); }
const button = (text, scope = host) => [...scope.querySelectorAll('button')].find(b => b.textContent === text);
async function click(text, scope) { await act(async () => button(text, scope).click()); }
async function tab(text) { await click(text, host.querySelector('.sf-sidebar')); }
test('overview loads AI metrics without legacy data requests', async () => {
  await render();
  expect(apiCallAuth).toHaveBeenCalledWith('/api/admin/quick-ads/analytics', 'admin-token');
  expect(apiCallAuth.mock.calls).toHaveLength(1);
  expect(host.textContent).toContain('Paying customers');
  expect(host.textContent).toContain('Generation health');
  expect(host.textContent).not.toContain('Platform share (25%)');
  for (const label of ['Campaigns', 'Submissions', 'Withdrawals', 'Settings']) {
    expect([...host.querySelectorAll('button')].some(b => b.textContent === label)).toBe(false);
  }
});
test('desktop and mobile selection stay on the admin route and highlight the current section', async () => {
  await render(); await click('Payments & Usage', host.querySelector('.sf-mobile-navigation'));
  for (const nav of host.querySelectorAll('.sf-sidebar nav, .sf-mobile-navigation')) { expect(nav.querySelector('[aria-current="page"]').textContent).toBe('Payments & Usage'); }
  expect(host.querySelector('output').textContent).toBe('/admin-portal');
  expect(host.querySelector('h1').textContent).toBe('Payments & Usage');
});
test.each(['.sf-sidebar__footer', '.sf-dashboard-more'])('Exit Admin in %s logs out and returns to login', async selector => { await render(); await click('Exit Admin', host.querySelector(selector)); expect(logout).toHaveBeenCalledTimes(1); expect(host.querySelector('output').textContent).toBe('/login'); });

const quickAnalytics = {
  success: true, estimatesAvailable: true, transactionLimit: 50,
  asOf: '2026-11-02T10:00:00Z',
  growth: { accounts: 17, newAccounts30d: 2, payingCustomers: 1, repeatCustomers: 1, paidConversion: 5.88, activeGenerators30d: 1, revenue30d: 6700, averageOrderValue: 3350, freePreviews: 2, availableCredits: 1000, pendingPayments: 0, failedPayments: 0, failedGenerations: 0, expiredGenerations: 0, brandingFailures: 0 },
  productStats: [{ product: 'AI Commercial', completed: 1, failed: 0, pending: 0, successRate: 100, creditsUsed: 7 }],
  topCustomers: [{ userId: 'business', name: 'Food Business', purchases: 2, revenue: 6700 }],
  analytics: { totalRevenue: 6700, totalCreditsSold: 4, totalCreditsUsed: 1, creditsRemaining: 3, totalQuickAdsGenerated: 3,
    estimatedGenerationCost: 450, estimatedGrossProfit: 6250, estimatedGrossMargin: 93.3 },
  transactions: [{ reference: 'qa_purchase', businessName: 'Food Business', email: 'food@example.test', planName: 'Starter', amountPaid: 5000, creditsPurchased: 3, status: 'completed', paymentDate: '2026-09-28T12:00:00Z' }],
  usage: [{ userId: 'business', businessName: 'Food Business', availableCredits: 1000, totalQuickAdsGenerated: 3, estimatedGenerationsPurchased: 4, lastGenerationAt: '2026-09-28T13:00:00Z', createdAt: '2026-01-01' }]
};
function analyticsResponse(response) {
  const normal = apiCallAuth.getMockImplementation();
  apiCallAuth.mockImplementation((url, ...args) => url === '/api/admin/quick-ads/analytics' ? (typeof response === 'function' ? response() : Promise.resolve(response)) : normal(url, ...args));
}
test('Quick Ads analytics loads on demand and displays backend totals, transactions and usage in the existing shell', async () => {
  analyticsResponse(quickAnalytics); await render();
  expect(apiCallAuth.mock.calls.some(([url]) => url.includes('/quick-ads/'))).toBe(true);
  await tab('Payments & Usage');
  expect(apiCallAuth).toHaveBeenCalledWith('/api/admin/quick-ads/analytics', 'admin-token');
  expect(host.querySelector('h1').textContent).toBe('Payments & Usage');
  expect([...host.querySelectorAll('.sf-stat-card__value')].map(n => n.textContent)).toEqual(['₦6,700', '4', '1', '3', '3']);
  expect(host.querySelectorAll('table')).toHaveLength(2);
  expect(host.textContent).toContain('qa_purchase'); expect(host.textContent).toContain('food@example.test');
  expect(host.textContent).toContain('1,000');
  expect(host.querySelectorAll('.sf-admin-quick-table[tabindex="0"]')).toHaveLength(2);
  for (const nav of host.querySelectorAll('.sf-sidebar nav, .sf-mobile-navigation')) expect(nav.querySelector('[aria-current="page"]').textContent).toBe('Payments & Usage');
  await click('Refresh analytics');
  expect(apiCallAuth.mock.calls.filter(([url]) => url.includes('/quick-ads/analytics'))).toHaveLength(2);
});
test('Quick Ads reports promoter buyer and usage account types', async () => {
  analyticsResponse({ ...quickAnalytics,
    transactions: quickAnalytics.transactions.map(row => ({ ...row, buyerRole: 'promoter' })),
    usage: quickAnalytics.usage.map(row => ({ ...row, accountType: 'promoter' })) });
  await render(); await tab('Payments & Usage');
  expect([...host.querySelectorAll('td')].filter(cell => cell.textContent === 'Promoter')).toHaveLength(2);
});

test('Quick Ads loading and empty states do not replace existing admin navigation', async () => {
  let finish; analyticsResponse(() => new Promise(resolve => { finish = resolve; }));
  await render(); await tab('Payments & Usage');
  expect(host.textContent).toContain('Loading AI advertising analytics...');
  expect(host.querySelectorAll('.sf-stat-card[aria-busy="true"]')).toHaveLength(5);
  await act(async () => finish({ ...quickAnalytics, transactions: [], usage: [] }));
  expect(host.textContent).toContain('No Quick Ads purchases yet');
  expect(host.textContent).toContain('No Quick Ads usage yet');
  await tab('Overview'); expect(host.textContent).toContain('Generation health');
});
test('Quick Ads request failures stay local, can retry, and preserve overview navigation', async () => {
  let fail = true; analyticsResponse(() => fail ? Promise.reject(new Error('private backend details')) : Promise.resolve(quickAnalytics));
  await render(); await tab('Payments & Usage');
  expect(host.textContent).toContain('Retry to retrieve current figures.');
  expect(host.textContent).not.toContain('private backend details');
  fail = false; await click('Retry analytics'); expect(host.textContent).toContain('₦6,700');
  await tab('Overview'); expect(host.textContent).toContain('Generation health');
});
test('missing estimates stay explicitly unavailable and negative remaining credits are surfaced', async () => {
  analyticsResponse({ ...quickAnalytics, estimatesAvailable: false,
    analytics: { ...quickAnalytics.analytics, creditsRemaining: -1, estimatedGenerationCost: null, estimatedGrossProfit: null, estimatedGrossMargin: null } });
  await render(); await tab('Payments & Usage');
  expect(host.textContent).not.toContain('Estimated Gross Profit');
  expect(host.textContent).toContain('Paid usage exceeds recorded purchases');
});

test('incomplete analytics responses show an error instead of misleading financial numbers', async () => {
  analyticsResponse({ success: true, analytics: {}, transactions: [], usage: [] });
  await render(); await tab('Payments & Usage');
  expect(host.textContent).toContain('Analytics could not be loaded');
  expect(host.querySelectorAll('.sf-stat-card')).toHaveLength(0);
  expect(host.textContent).not.toContain('NaN');
});
