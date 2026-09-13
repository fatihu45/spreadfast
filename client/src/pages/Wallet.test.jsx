import React from 'react';
import { createRoot } from 'react-dom/client';
import { act as legacyAct, Simulate } from 'react-dom/test-utils';
import { AuthContext } from '../context/AuthContext';
import { apiCallAuth } from '../utils/api';
import Wallet from './Wallet';
jest.mock('../utils/api', () => ({ apiCallAuth: jest.fn() }));
const act = React.act || legacyAct;
let host, root, wallet, updateUser;
const bank = { bankName: 'Actual Bank', accountName: 'Creator Name', accountNumber: '0123456789' };
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true; jest.useFakeTimers();
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); updateUser = jest.fn(); wallet = { balance: 24000, bankDetails: bank };
  apiCallAuth.mockReset().mockImplementation(async endpoint => {
    if (endpoint === '/api/wallet') return { success: true, wallet };
    if (endpoint.includes('withdrawals/pending')) return { success: true, withdrawals: [{ id: 'w1', amount: 2000, status: 'pending', createdAt: '2026-09-09' }] };
    if (endpoint.includes('my-submissions')) return { success: true, submissions: [
      { id: 'earned', status: 'approved', approvalAmount: 7200, reviewedAt: '2026-09-10', createdAt: '2026-09-08', campaignTitle: 'Real campaign' },
      { id: 'not-earned', status: 'pending', approvalAmount: 9000, createdAt: '2026-09-10' },
      { id: 'zero', status: 'approved', approvalAmount: 0, createdAt: '2026-09-10' }
    ] };
    return { success: false, message: 'Server rejected request' };
  });
});
afterEach(() => { act(() => root.unmount()); host.remove(); jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks(); });
async function render(role = 'promoter') { await act(async () => root.render(<AuthContext.Provider value={{ token: 'auth-token', user: { id: 'creator', name: 'Creator Name', role }, updateUser }}><Wallet /></AuthContext.Provider>)); }
const button = label => [...host.querySelectorAll('button')].find(item => item.textContent === label);
const click = async item => act(async () => item.click());
const change = async (input, value) => act(async () => Simulate.change(input, { target: { name: input.name, value } }));
const submit = async form => act(async () => Simulate.submit(form));
const mutations = () => apiCallAuth.mock.calls.filter(call => call[2]?.method);

test('shows server balance, masked bank account, and only real approved earnings and withdrawals', async () => {
  await render(); expect(host.querySelector('.sf-wallet-balance-card__value').textContent).toContain('24,000.00');
  expect(host.textContent).toContain('Actual Bank'); expect(host.textContent).toContain('6789'); expect(host.textContent).not.toContain('0123456789');
  const rows = host.querySelectorAll('.creator-wallet-transactions li'); expect(rows).toHaveLength(2);
  expect(rows[0].textContent).toContain('Campaign earnings'); expect(rows[0].textContent).toContain('7,200.00'); expect(rows[0].textContent).toContain('Approved');
  expect(rows[1].textContent).toContain('Withdrawal'); expect(rows[1].textContent).toContain('Pending');
  expect(host.textContent).toContain('Completed withdrawals are not available'); expect(mutations()).toHaveLength(0);
});
test('withdraw keeps validation and sends the original authenticated request then uses newBalance', async () => {
  await render(); await click(button('Withdraw')); const input = host.querySelector('input[type="number"]'); const form = input.closest('form');
  await change(input, '500'); await submit(form); expect(host.textContent).toContain('Minimum withdrawal'); expect(mutations()).toHaveLength(0);
  await change(input, '25000'); await submit(form); expect(host.textContent).toContain('Insufficient balance'); expect(mutations()).toHaveLength(0);
  const original = apiCallAuth.getMockImplementation(); apiCallAuth.mockImplementation(async (endpoint, ...args) => endpoint === '/api/wallet/withdraw' ? { success: true, newBalance: 21000, withdrawal: { id: 'w2', amount: 3000, status: 'pending', createdAt: '2026-09-11' } } : original(endpoint, ...args));
  await change(input, '3000'); await submit(form);
  expect(apiCallAuth).toHaveBeenCalledWith('/api/wallet/withdraw', 'auth-token', { method: 'POST', body: JSON.stringify({ amount: 3000 }) });
  expect(host.querySelector('.sf-wallet-balance-card__value').textContent).toContain('21,000.00'); expect(host.querySelectorAll('.creator-wallet-transactions li')).toHaveLength(3);
  expect(host.textContent).toContain('7.5% withdrawal fee');
});
test('change account preserves bank endpoint, full account number, and auth context update', async () => {
  await render(); await click(button('Change account')); const input = host.querySelector('input[name="accountNumber"]'); expect(input.value).toBe('0123456789');
  await change(input, '0012345678'); const changed = { ...bank, accountNumber: '0012345678' };
  apiCallAuth.mockResolvedValue({ success: true, user: { bankDetails: changed } }); await submit(input.closest('form'));
  expect(apiCallAuth).toHaveBeenCalledWith('/api/users/update-bank', 'auth-token', { method: 'PUT', body: JSON.stringify({ bankDetails: changed }) });
  expect(updateUser).toHaveBeenCalledWith(expect.objectContaining({ bankDetails: changed })); expect(host.querySelector('input[name="accountNumber"]')).toBeNull();
});
test('missing bank account keeps withdrawal blocked and shows bank fields', async () => {
  wallet.bankDetails = null; await render(); await click(button('Withdraw')); expect(host.textContent).toContain('Add your bank account above');
  expect(host.querySelector('input[name="bankName"]')).not.toBeNull(); expect(button('Request Withdrawal')).toBeUndefined(); expect(mutations()).toHaveLength(0);
});
test('failed responses show unavailable data instead of fake zero balance or empty history', async () => {
  apiCallAuth.mockResolvedValue({ success: false }); await render(); expect(host.querySelector('.sf-wallet-balance-card__value').textContent).toBe('Unavailable');
  expect(button('Withdraw').disabled).toBe(true); expect(host.textContent).toContain('Campaign earnings could not be loaded'); expect(host.textContent).toContain('Pending withdrawals could not be loaded'); expect(host.textContent).not.toContain('No transactions yet');
});
test('business wallet retains its existing view and does not fetch creator earnings', async () => {
  await render('company'); expect(host.querySelector('.wallet-container')).not.toBeNull(); expect(host.querySelector('.creator-wallet')).toBeNull();
  expect(apiCallAuth).not.toHaveBeenCalledWith('/api/submissions/my-submissions', 'auth-token');
});
