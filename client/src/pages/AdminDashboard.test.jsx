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
const stats = { totalUsers: 17, totalPromoters: 12, totalCompanies: 5, totalCampaigns: 2, activeCampaigns: 1, totalSubmissions: 2, pendingSubmissions: 1, totalWithdrawalAmount: 9000, pendingWithdrawalAmount: 4000, pendingWithdrawals: 1, totalCampaignFees: 5000, totalWithdrawalFees: 0, totalCreatorAllocation: 15000, legacyCampaignFeeEstimate: 1000 };
const campaigns = [{ id: 'c1', title: 'Active campaign', budget: 20000, status: 'active', socialMediaPlatforms: ['tiktok'], subscribedPromoters: ['u1'], createdAt: '2026-09-01' }, { id: 'c2', title: 'Paused campaign', status: 'paused' }];
const submissions = [{ id: 's1', userName: 'Creator One', campaignName: 'Active campaign', status: 'pending', proofUrl: 'https://example.com/post', proofDescription: 'Review this post', platforms: ['instagram'] }, { id: 's2', userName: 'Creator Two', status: 'approved', approvalAmount: 5000 }];
const withdrawals = [{ id: 'w1', promoterName: 'Creator One', amount: 4000, status: 'pending', email: 'creator@example.com', bankDetails: { bankName: 'Test bank', accountName: 'Creator One', accountNumber: '1234567890' } }, { id: 'w2', amount: 5000, status: 'completed' }];
function Location() { return <output>{useLocation().pathname}</output>; }
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); logout = jest.fn();
  apiCallAuth.mockReset();
  apiCallAuth.mockImplementation(async (url, token, options) => options ? { success: true } : ({ '/api/admin/all-stats': { success: true, stats }, '/api/admin/campaigns': { success: true, campaigns }, '/api/admin/submissions': { success: true, submissions }, '/api/admin/withdrawals': { success: true, withdrawals } }[url]));
});
afterEach(() => { act(() => root.unmount()); host.remove(); jest.restoreAllMocks(); });
async function render() { await act(async () => root.render(<MemoryRouter initialEntries={['/admin-portal']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AuthContext.Provider value={{ user: { name: 'Admin' }, token: 'admin-token', logout }}><AdminDashboard /><Location /></AuthContext.Provider></MemoryRouter>)); }
const button = (text, scope = host) => [...scope.querySelectorAll('button')].find(b => b.textContent === text);
async function click(text, scope) { await act(async () => button(text, scope).click()); }
async function tab(text) { await click(text, host.querySelector('.sf-sidebar')); }
function mutation(url, method, body) { expect(apiCallAuth).toHaveBeenCalledWith(url, 'admin-token', body ? { method, body: JSON.stringify(body) } : { method }); }
test('loads all existing endpoints and renders API statistics and fee totals', async () => {
  await render();
  for (const endpoint of ['all-stats', 'campaigns', 'submissions', 'withdrawals']) expect(apiCallAuth).toHaveBeenCalledWith('/api/admin/' + endpoint, 'admin-token');
  expect([...host.querySelectorAll('.sf-stat-card__value')].map(n => n.textContent)).toEqual(['17', '2', '2', '\u20a69,000']);
  expect(host.querySelector('.sf-admin-revenue').textContent).toContain('25%');
  expect(host.querySelector('.sf-admin-revenue h2').textContent).toContain('5,000');
  expect(host.querySelector('.sf-admin-revenue').textContent).toContain('15,000');
  expect(host.textContent).toContain('Promoters: 12'); expect(host.textContent).toContain('Businesses: 5');
  expect(host.querySelectorAll('.sf-admin-attention .sf-badge').length).toBe(3);
});
test('desktop and mobile selection stay on the admin route and highlight the current section', async () => {
  await render(); await click('Submissions', host.querySelector('.sf-mobile-navigation'));
  for (const nav of host.querySelectorAll('.sf-sidebar nav, .sf-mobile-navigation')) { expect(nav.querySelector('[aria-current="page"]').textContent).toBe('Submissions'); }
  expect(host.querySelector('output').textContent).toBe('/admin-portal');
  expect(host.querySelector('h1').textContent).toBe('Submissions');
});
test('pause and resume preserve campaign IDs, statuses and refresh', async () => {
  await render(); await tab('Campaigns'); await click('Pause'); mutation('/api/admin/campaigns/c1', 'PATCH', { status: 'paused' });
  await click('Resume'); mutation('/api/admin/campaigns/c2', 'PATCH', { status: 'active' });
  expect(apiCallAuth.mock.calls.filter(([url]) => url === '/api/admin/all-stats').length).toBe(3);
});
test('delete preserves confirmation and deletion endpoint', async () => {
  await render(); await tab('Campaigns'); const confirm=jest.spyOn(window, 'confirm').mockReturnValue(false);
  await click('Delete'); expect(apiCallAuth.mock.calls.some(([, , options]) => options?.method === 'DELETE')).toBe(false);
  confirm.mockReturnValue(true); await click('Delete'); mutation('/api/admin/campaigns/c1', 'DELETE');
});
test('approval keeps the editable default amount and sends the entered numeric amount', async () => {
  await render(); await tab('Submissions');
  expect(host.querySelector('a[href="https://example.com/post"]').getAttribute('rel')).toBe('noopener noreferrer');
  await click('Approve'); const input=host.querySelector('input[type="number"]'); expect(input.value).toBe('5000');
  act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '7250.5'); input.dispatchEvent(new Event('input', { bubbles: true })); });
  await click('Confirm Approval'); mutation('/api/admin/submissions/s1', 'PATCH', { status: 'approved', approvalAmount: 7250.5 });
  expect(host.textContent).toContain('Submission approved and funds added to promoter wallet'); expect(host.querySelector('input')).toBeNull();
});
test('cancel does not approve, rejection uses the existing pending submission ID', async () => {
  await render(); await tab('Submissions'); await click('Approve'); await click('Cancel'); expect(host.querySelector('input')).toBeNull();
  expect(apiCallAuth.mock.calls.some(([, , options]) => options)).toBe(false);
  await click('Reject'); mutation('/api/admin/submissions/s1', 'PATCH', { status: 'rejected' });
});
test('withdrawals retain bank details and completion is available only for pending requests', async () => {
  await render(); await tab('Withdrawals'); expect(host.textContent).toContain('1234567890'); expect(host.textContent).toContain('Test bank');
  expect([...host.querySelectorAll('button')].filter(b => b.textContent === 'Mark as completed').length).toBe(1);
  await click('Mark as completed'); mutation('/api/admin/withdrawals/w1', 'PATCH', { status: 'completed' });
});
test('failed mutations retain backend messages', async () => {
  await render(); await tab('Campaigns'); apiCallAuth.mockResolvedValueOnce({ success: false, message: 'Campaign is locked' }); await click('Pause'); expect(host.querySelector('[role="alert"]').textContent).toBe('Campaign is locked');
});
test('loading and empty states remain in the shared shell', async () => {
  let resolve; apiCallAuth.mockImplementation(() => new Promise(r => { resolve = r; }));
  await render(); expect(host.textContent).toContain('Loading admin dashboard...'); expect(host.querySelector('.sf-sidebar')).not.toBeNull();
  apiCallAuth.mockResolvedValue({ success: true });
  // Remount to cover successful empty API responses without fake records.
  act(() => root.unmount()); root=createRoot(host); await render(); await tab('Campaigns'); expect(host.textContent).toContain('No campaigns found.');
  await tab('Submissions'); expect(host.textContent).toContain('No submissions found.'); await tab('Withdrawals'); expect(host.textContent).toContain('No withdrawal requests found.');
});
test.each(['.sf-sidebar__footer', '.sf-dashboard-more'])('Exit Admin in %s logs out and returns to login', async selector => { await render(); await click('Exit Admin', host.querySelector(selector)); expect(logout).toHaveBeenCalledTimes(1); expect(host.querySelector('output').textContent).toBe('/login'); });

 test('new campaigns approve the fixed net earning and show the platform share to admin', async () => {
  apiCallAuth.mockImplementation(async endpoint => endpoint.endsWith('/campaigns') ? {success:true, campaigns:[{...campaigns[0], pricing:{version:'creator-20000-included-25-v1', platformAmount:5000, creatorPool:15000, earningPerCreator:15000}}]}
    : endpoint.endsWith('/submissions') ? {success:true, submissions:[{...submissions[0], campaignId:'c1'}]}
    : endpoint.endsWith('/all-stats') ? {success:true, stats} : {success:true, withdrawals:[]});
  await render(); await tab('Campaigns');
  expect(host.textContent).toContain('Platform share (25%)'); expect(host.textContent).toContain('15,000');
  await tab('Submissions'); await click('Approve');
  const input=host.querySelector('input[type="number"]'); expect(input.value).toBe('15000'); expect(input.readOnly).toBe(true);
  await click('Confirm Approval'); mutation('/api/admin/submissions/s1', 'PATCH', {status:'approved', approvalAmount:15000});
 });
