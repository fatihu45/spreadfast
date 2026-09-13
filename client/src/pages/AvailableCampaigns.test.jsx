import React from 'react';
import { createRoot } from 'react-dom/client';
import { act as legacyAct, Simulate } from 'react-dom/test-utils';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { apiCall, apiCallAuth } from '../utils/api';
import AvailableCampaigns from './AvailableCampaigns';
jest.mock('../utils/api', () => ({ apiCall: jest.fn(), apiCallAuth: jest.fn() }));
const act = React.act || legacyAct;
let host, root, campaigns;
const assets = [{ id: 'asset-1', file_type: 'image', file_name: 'campaign.png', url: '/campaign-preview.png' }];
function Location() { const location = useLocation(); return <output>{location.pathname + location.search}</output>; }
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  campaigns = [
    { id: 'a', title: 'Alpha fashion', description: 'Authentic style content', status: 'active', budget: '15000', socialMediaPlatforms: ['instagram'], subscribedPromoters: [{ promoterId: 'other-1' }, { promoterId: 'other-2' }] },
    { id: 'b', title: 'Beta food', description: 'Share your recipes', status: 'active', budget: '5000', socialMediaPlatforms: ['tiktok'], subscribedPromoters: [{ promoterId: 'creator-1' }] },
    { id: 'c', title: 'Gamma travel', description: 'Your next trip', amountPaid: 10000, socialMediaPlatforms: ['facebook'], subscribedPromoters: [] },
    { id: 'closed', title: 'Closed campaign', status: 'completed', budget: '50000', socialMediaPlatforms: [] },
  ];
  apiCall.mockReset().mockImplementation(async endpoint => endpoint === '/api/campaigns' ? { success: true, campaigns } : { success: true, assets });
  apiCallAuth.mockReset().mockResolvedValue({ success: false, message: 'Existing backend response' });
});
afterEach(() => { act(() => root.unmount()); host.remove(); jest.restoreAllMocks(); });
async function render(role = 'promoter') {
  await act(async () => root.render(<MemoryRouter initialEntries={['/available-campaigns']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <AuthContext.Provider value={{ user: { id: 'creator-1', role }, token: 'test-token' }}><AvailableCampaigns /><Location /></AuthContext.Provider>
  </MemoryRouter>));
}
const card = id => host.querySelector('#marketplace-title-' + id)?.closest('article');
const click = async button => act(async () => button.click());
const filter = label => [...host.querySelectorAll('.marketplace-filters button')].find(button => button.textContent === label);

test('fetches active campaign previews and preserves the existing slot and budget calculations', async () => {
  await render();
  expect(host.querySelectorAll('article').length).toBe(3); expect(card('closed')).toBeUndefined();
  expect(apiCall).toHaveBeenCalledWith('/api/campaigns');
  expect(apiCall).toHaveBeenCalledWith('/api/campaigns/a/assets/preview');
  expect(apiCall).not.toHaveBeenCalledWith('/api/campaigns/closed/assets/preview');
  expect(card('a').querySelector('.marketplace-budget strong').textContent).toBe(String.fromCharCode(0x20a6) + '15,000');
  expect(card('a').querySelector('.marketplace-slots').textContent).toBe('1 creator slot left');
  expect(card('b').querySelector('.marketplace-slots').textContent).toBe('0 creator slots left');
  expect(card('c').querySelector('.marketplace-slots').textContent).toBe('2 creator slots left');
  expect(card('a').querySelector('.marketplace-thumbnail img').getAttribute('src')).toBe('/campaign-preview.png');
});

test('search and multi-platform filters retain their existing combined OR semantics', async () => {
  await render();
  await click(filter('Instagram')); expect(host.querySelectorAll('article').length).toBe(1);
  await click(filter('TikTok')); expect(host.querySelectorAll('article').length).toBe(2);
  await act(async () => Simulate.change(host.querySelector('input[type="search"]'), { target: { value: 'RECIPES' } }));
  expect(host.querySelectorAll('article').length).toBe(1); expect(card('b')).toBeTruthy();
  await click(host.querySelector('[aria-label="Clear search"]')); expect(host.querySelectorAll('article').length).toBe(2);
  await click(filter('All')); expect(host.querySelectorAll('article').length).toBe(3);
});

test('View Campaign only reveals details; existing subscribe call stays separate', async () => {
  await render();
  expect(card('a').querySelector('[role="region"]').hidden).toBe(true);
  await click(card('a').querySelector('.marketplace-view'));
  expect(card('a').querySelector('[role="region"]').hidden).toBe(false);
  expect(host.querySelector('output').textContent).toBe('/available-campaigns');
  expect(apiCallAuth).not.toHaveBeenCalled();
  await click([...card('a').querySelectorAll('[role="tab"]')].find(tab => tab.textContent === 'Assets'));
  expect(card('a').querySelector('.marketplace-locked').textContent).toBe('Locked');
  await click([...card('a').querySelectorAll('button')].find(button => button.textContent === 'Join Campaign'));
  expect(apiCallAuth).toHaveBeenCalledWith('/api/campaigns/a/subscribe', 'test-token', { method: 'POST' });
  expect(host.querySelector('[role="alert"]').textContent).toBe('Existing backend response');
});

test('full campaigns remain viewable and keep the existing disabled subscribe and proof action', async () => {
  await render(); await click(card('b').querySelector('.marketplace-view'));
  const fullButton = [...card('b').querySelectorAll('button')].find(button => button.textContent === 'All Slots Filled');
  expect(fullButton.disabled).toBe(true);
  await click([...card('b').querySelectorAll('button')].find(button => button.textContent === 'Submit Proof'));
  expect(host.querySelector('output').textContent).toBe('/submit-proof?campaignId=b');
});

test('subscribed creators download through the same authenticated asset endpoint', async () => {
  await render(); await click(card('b').querySelector('.marketplace-view'));
  await click([...card('b').querySelectorAll('[role="tab"]')].find(tab => tab.textContent === 'Assets'));
  apiCallAuth.mockResolvedValue({ success: true, download_url: 'https://example.com/signed-file', file_name: 'original.png' });
  const download = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
    expect(this.href).toBe('https://example.com/signed-file'); expect(this.download).toBe('original.png');
  });
  await click([...card('b').querySelectorAll('button')].find(button => button.textContent === 'Download'));
  expect(apiCallAuth).toHaveBeenCalledWith('/api/campaigns/b/assets/asset-1/download', 'test-token');
  expect(download).toHaveBeenCalledTimes(1);
});

test('no matches show the empty state and non-promoters retain their redirect', async () => {
  await render(); await act(async () => Simulate.change(host.querySelector('input[type="search"]'), { target: { value: 'no match' } }));
  expect(host.querySelectorAll('article').length).toBe(0); expect(host.textContent).toContain('No campaigns found');
  apiCall.mockClear(); await render('company');
  expect(host.querySelector('output').textContent).toBe('/'); expect(apiCall).not.toHaveBeenCalled();
});


test('detail tabs show campaign data and explain earnings without inventing a reward', async () => {
  campaigns[0].keyMessage = 'Show your own style';
  await render(); await click(card('a').querySelector('.marketplace-view'));
  expect(card('a').querySelector('.campaign-detail-panel').textContent).toContain('Show your own style');
  expect(card('a').querySelector('.campaign-detail-numbers').textContent).toContain('Set on approval');
  const tabs = card('a').querySelectorAll('[role="tab"]');
  expect(tabs.length).toBe(5);
  await act(async () => Simulate.keyDown(tabs[0], { key: 'End', preventDefault: jest.fn() }));
  expect(tabs[4].getAttribute('aria-selected')).toBe('true');
  expect(document.activeElement).toBe(tabs[4]);
  expect(card('a').querySelector('[role="tabpanel"]').textContent).toContain('not a guaranteed individual payout');
  await click(tabs[2]);
  expect(card('a').querySelector('[role="tabpanel"]').textContent).toContain('Instagram');
  await click(card('a').querySelector('.campaign-detail-back'));
  expect(card('a').querySelector('[role="region"]').hidden).toBe(true);
  expect(host.querySelector('output').textContent).toBe('/available-campaigns');
  expect(apiCallAuth).not.toHaveBeenCalled();
});
