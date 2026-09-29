import React from 'react';
import { createRoot } from 'react-dom/client';
import { act as legacyAct } from 'react-dom/test-utils';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { apiCall, apiCallAuth } from '../utils/api';
import PromotionDashboard from './PromotionDashboard';
jest.mock('../utils/api', () => ({ apiCall: jest.fn(), apiCallAuth: jest.fn() }));
const act = React.act || legacyAct;
let host, root, walletResponse, campaignsResponse, submissionsResponse;
const campaigns = [
  { id: 'other', title: 'Another creator campaign', budget: '999999', createdAt: '2026-09-09', subscribedPromoters: [{ promoterId: 'other-user' }], submissions: Array(20).fill({ status: 'approved' }) },
  { id: 'one', title: 'Joined campaign', budget: '40000', status: 'active', subscribedPromoters: [{ promoterId: 'creator-1', subscribedAt: '2026-09-02' }], keyMessage: 'Existing brand instructions', socialMediaPlatforms: ['instagram'] },
  { id: 'two', title: 'Submission history campaign', budget: '60000', status: 'completed', subscribedPromoters: [] },
  { id: 'three', title: 'Earlier campaign', budget: '20000', status: 'active', subscribedPromoters: [{ promoterId: 'creator-1', subscribedAt: '2026-08-01' }] },
  { id: 'four', title: 'Most recent campaign', budget: '100000', status: 'active', subscribedPromoters: [{ promoterId: 'creator-1', subscribedAt: '2026-09-08' }] },
];
const submissions = [
  { id: 's1', campaignId: 'one', userId: 'creator-1', status: 'approved', createdAt: '2026-09-03' },
  { id: 's2', campaignId: 'one', userId: 'creator-1', status: 'pending', createdAt: '2026-09-04' },
  { id: 's3', campaignId: 'two', userId: 'creator-1', status: 'approved', createdAt: '2026-09-05' },
];
function Location() { const location = useLocation(); return <output>{location.pathname + location.search}</output>; }
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  walletResponse = { success: true, wallet: { balance: '17543.25' } };
  campaignsResponse = { success: true, campaigns };
  submissionsResponse = { success: true, submissions };
  apiCall.mockReset().mockImplementation(async () => campaignsResponse);
  apiCallAuth.mockReset().mockImplementation(async endpoint => endpoint === '/api/wallet' ? walletResponse : submissionsResponse);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });
async function render(role = 'promoter') {
  await act(async () => root.render(<MemoryRouter initialEntries={['/promoter-dashboard']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <AuthContext.Provider value={{ user: { id: 'creator-1', name: 'Test Creator', role }, token: 'test-token' }}><PromotionDashboard /><Location /></AuthContext.Provider>
  </MemoryRouter>));
}
const value = label => [...host.querySelectorAll('dl')].find(dl => dl.querySelector('dt')?.textContent === label)?.querySelector('dd').textContent;

test('uses wallet balance and personal memberships/submissions, never global campaign totals', async () => {
  await render();
  expect(apiCall).toHaveBeenCalledWith('/api/campaigns', { headers: { Authorization: 'Bearer test-token' } });
  expect(apiCallAuth).toHaveBeenCalledWith('/api/wallet', 'test-token');
  expect(apiCallAuth).toHaveBeenCalledWith('/api/submissions/my-submissions', 'test-token');
  expect(value('Available earnings')).toBe(String.fromCharCode(0x20a6) + '17,543.25');
  expect(value('Campaigns')).toBe('4'); expect(value('Submissions')).toBe('3'); expect(value('Approved')).toBe('2');
  expect(host.querySelector('h1').textContent).toContain('Test');
  expect(host.textContent).not.toContain('Another creator campaign');
  expect([...host.querySelectorAll('.sf-campaign-card h3')].map(node => node.textContent)).toEqual(['Most recent campaign', 'Submission history campaign', 'Joined campaign']);
  expect(host.textContent).toContain('Existing brand instructions');
  await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === 'View all').click());
  expect(host.querySelectorAll('.sf-campaign-card').length).toBe(4);
});

test('withdraw and submission links preserve existing routes and campaign identifiers', async () => {
  await render();
  const proof = [...host.querySelectorAll('a')].find(link => link.textContent.startsWith('Submit proof'));
  expect(proof.getAttribute('href')).toBe('/submit-proof?campaignId=four');
  expect(host.querySelector('.creator-withdraw').getAttribute('href')).toBe('/wallet');
  await act(async () => proof.click());
  expect(host.querySelector('output').textContent).toBe('/submit-proof?campaignId=four');
});

test('a real empty account shows zero and onboarding instead of other creators campaigns', async () => {
  walletResponse = { success: true, wallet: { balance: 0 } };
  campaignsResponse = { success: true, campaigns: [campaigns[0]] };
  submissionsResponse = { success: true, submissions: [] };
  await render();
  expect(value('Available earnings')).toContain('0');
  expect(value('Campaigns')).toBe('0'); expect(value('Submissions')).toBe('0'); expect(value('Approved')).toBe('0');
  expect(host.querySelectorAll('.sf-campaign-card').length).toBe(0);
  expect(host.textContent).toContain('Your next opportunity starts here');
});

test('failed wallet data is unavailable rather than zero and retry loads the actual balance', async () => {
  walletResponse = { success: false };
  await render();
  expect(value('Available earnings')).toBe('Unavailable'); expect(value('Submissions')).toBe('3');
  walletResponse = { success: true, wallet: { balance: 250 } };
  await act(async () => host.querySelector('[role="alert"] button').click());
  expect(value('Available earnings')).toContain('250'); expect(host.querySelector('[role="alert"]')).toBeNull();
});

test('rejected personal submission request cannot produce invented zero statistics', async () => {
  apiCallAuth.mockImplementation(endpoint => endpoint === '/api/wallet' ? Promise.resolve(walletResponse) : Promise.reject(new Error('offline')));
  await render();
  expect(value('Submissions')).toBe('Unavailable'); expect(value('Approved')).toBe('Unavailable'); expect(value('Campaigns')).toBe('Unavailable');
  expect(host.textContent).toContain("Your campaigns couldn't be loaded");
});

test('loading does not imply zero earnings', async () => {
  let resolveWallet;
  apiCallAuth.mockImplementation(endpoint => endpoint === '/api/wallet' ? new Promise(resolve => { resolveWallet = resolve; }) : Promise.resolve(submissionsResponse));
  await render();
  expect(host.querySelector('.creator-dashboard').getAttribute('aria-busy')).toBe('true');
  expect(value('Available earnings')).toContain('Loading');
  await act(async () => resolveWallet(walletResponse));
  expect(host.querySelector('.creator-dashboard').getAttribute('aria-busy')).toBe('false');
});

test('non-promoters keep the existing redirect and make no dashboard requests', async () => {
  await render('company');
  expect(host.querySelector('output').textContent).toBe('/');
  expect(apiCall).not.toHaveBeenCalled(); expect(apiCallAuth).not.toHaveBeenCalled();
});
