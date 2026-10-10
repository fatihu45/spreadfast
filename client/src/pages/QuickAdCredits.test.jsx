import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import QuickAdCredits from './QuickAdCredits';

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
const plans = [
  { id: 'single', name: 'Try One', price: 1700, credits: 1, cta: 'Buy 1 Credit' },
  { id: 'starter', name: 'Starter', price: 5000, credits: 4, cta: 'Get Starter', recommended: true },
  { id: 'growth', name: 'Growth', price: 10000, credits: 8, cta: 'Get Growth' },
  { id: 'business', name: 'Business', price: 20000, credits: 16, cta: 'Get Business' }
];
let root, container;
const previousApi = process.env.REACT_APP_API_URL;
const button = text => [...container.querySelectorAll('button')].find(node => node.textContent.includes(text));
async function render(path = '/quickads/credits', role = 'company') {
  await act(async () => root.render(<MemoryRouter initialEntries={[path]}><AuthContext.Provider value={{ user: { id: 'owner', role }, token: 'session' }}><QuickAdCredits /></AuthContext.Provider></MemoryRouter>));
}
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  process.env.REACT_APP_API_URL = 'https://api.example'; sessionStorage.clear();
  axios.get.mockReset().mockImplementation(url => Promise.resolve({ data: url.endsWith('/plans') ? { success: true, plans } : url.endsWith('/transactions') ? { success: true, transactions: [] } : url.includes('/verify/') ? { success: true, creditsPurchased: 3, quickAdCredits: 9 } : { success: true, quickAdCredits: 6 } }));
  axios.post.mockReset(); container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); if (previousApi === undefined) delete process.env.REACT_APP_API_URL; else process.env.REACT_APP_API_URL = previousApi; });

test.each(['company', 'promoter'])('%s loads backend prices and sends only plan ID', async role => {
  await render('/quickads/credits', role);
  expect(container.querySelectorAll('.quick-ad-plan')).toHaveLength(4);
  expect(container.textContent).toContain('6 Quick Ads credits');
  axios.post.mockRejectedValue(new Error('provider detail'));
  await act(async () => button('Get Starter').click());
  expect(axios.post).toHaveBeenCalledWith('https://api.example/api/quick-ads/credits/initialize', { planId: 'starter' }, expect.objectContaining({ headers: { Authorization: 'Bearer session' } }));
  expect(container.textContent).toContain('Payment could not be started');
  expect(container.textContent).not.toContain('provider detail');
  expect(container.textContent).toContain('6 Quick Ads credits');
});
test.each(['company', 'promoter'])('%s callback uses backend balance and returns to own dashboard', async role => {
  await render('/quickads/credits?reference=qa_test', role);
  expect(axios.get).toHaveBeenCalledWith('https://api.example/api/quick-ads/credits/verify/qa_test', expect.objectContaining({ headers: { Authorization: 'Bearer session' } }));
  expect(container.textContent).toContain('Payment successful');
  expect(container.textContent).toContain('3 Quick Ads credits have been added');
  expect(container.textContent).toContain('Your balance: 9 credits');
  expect(container.textContent).toContain('no credit deducted');
  expect(container.querySelector('a[href="/' + role + '/quick-ads#quick-ad-history-title"]')).not.toBeNull();
  expect(container.querySelector('a[href="/' + role + '/quick-ads"]')).not.toBeNull();
});
test('failed verification never awards credits locally and can retry the same reference', async () => {
  const normal = axios.get.getMockImplementation(); let failed = true;
  axios.get.mockImplementation(url => url.includes('/verify/') && failed ? Promise.reject(new Error('secret')) : normal(url));
  await render('/quickads/credits?reference=qa_test');
  expect(container.textContent).toContain("We couldn't confirm your payment");
  expect(container.textContent).toContain('6 Quick Ads credits');
  expect(container.textContent).not.toContain('Payment successful');
  failed = false; await act(async () => button('Retry confirmation').click());
  expect(container.textContent).toContain('Your balance: 9 credits');
  expect(axios.get.mock.calls.filter(([url]) => url.endsWith('/verify/qa_test'))).toHaveLength(2);
});
test('unsupported accounts cannot initialize purchases', async () => {
  await render('/quickads/credits', 'admin');
  expect(button('Get Starter').disabled).toBe(true);
  expect(container.textContent).toContain('Company or promoter account required');
  expect(axios.get.mock.calls.some(([url]) => url.endsWith('/credits'))).toBe(false);
  expect(axios.post).not.toHaveBeenCalled();
});
