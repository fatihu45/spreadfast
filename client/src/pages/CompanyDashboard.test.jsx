import React from 'react';
import { createRoot } from 'react-dom/client';
import { act as legacyAct, Simulate } from 'react-dom/test-utils';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { apiCall, apiCallAuth } from '../utils/api';
import CompanyDashboard from './CompanyDashboard';
jest.mock('../utils/api', () => ({ apiCall: jest.fn(), apiCallAuth: jest.fn() }));
const act = React.act || legacyAct;
jest.setTimeout(30000);
let host, root, campaigns;
function Location() { const l = useLocation(); return <output>{l.pathname + l.hash}</output>; }
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  campaigns = [
    { id: 'a', companyId: 'business', title: 'Alpha campaign', description: 'Real description', budget: '20000', amountPaid: 20000, status: 'active', socialMediaPlatforms: ['tiktok'], subscribedPromoters: [{ promoterId: 'p1', promoterName: 'Creator One' }, { promoterId: 'p2', promoterName: 'Creator Two' }], submissions: [{ id: 'stale' }] },
    { id: 'b', companyId: 'business', title: 'Beta campaign', budget: '10000', status: 'completed', subscribedPromoters: [{ promoterId: 'p1', promoterName: 'Creator One' }] },
    { id: 'other', companyId: 'other-company', title: 'Other business campaign', status: 'active', budget: '50000' }
  ];
  apiCall.mockReset().mockResolvedValue({ success: true, campaigns });
  apiCallAuth.mockReset().mockImplementation(async endpoint => endpoint.endsWith('/submissions') ? { success: true, submissions: endpoint.includes('/a/') ? [{ id: 's1', userName: 'Creator One', proofDescription: 'Actual submission', status: 'approved', approvalAmount: 1500 }, { id: 's2', userName: 'Creator Two', status: 'pending' }] : [] } : endpoint.endsWith('/assets') ? { success: true, assets: [{ id: 'asset', file_type: 'image', file_name: 'Actual asset.png', url: '/preview.png' }] } : { success: false, message: 'Mock payment response' });
});
afterEach(() => { act(() => root.unmount()); host.remove(); jest.restoreAllMocks(); });
async function render(path = '/company', role = 'company') { await act(async () => root.render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AuthContext.Provider value={{ user: { id: 'business', name: 'Actual Business', email: 'owner@example.test', role }, token: 'auth-token' }}><CompanyDashboard /><Location /></AuthContext.Provider></MemoryRouter>)); }
const click = async el => act(async () => el.click());
const change = async (el, value) => act(async () => Simulate.change(el, { target: { value } }));
const stats = () => [...host.querySelectorAll('.sf-stat-card__value')].map(el => el.textContent);

test('overview counts own active campaigns, unique promoters, and fetched submissions', async () => {
  await render(); expect(host.querySelector('h1').textContent).toContain('Actual Business'); expect(stats()).toEqual(['1', '2', '2']);
  expect(host.querySelectorAll('.company-overview-campaign')).toHaveLength(2); expect(host.textContent).not.toContain('Other business campaign');
  expect(apiCall).toHaveBeenCalledWith('/api/campaigns'); expect(apiCallAuth).toHaveBeenCalledWith('/api/campaigns/a/submissions', 'auth-token'); expect(apiCallAuth).toHaveBeenCalledWith('/api/campaigns/a/assets', 'auth-token');
  expect(host.querySelector('.company-overview-campaign-status').textContent).toContain('2/4 promoters assigned'); expect(host.querySelector('.company-overview-campaign-status').textContent).toContain('2 available');
  expect(host.querySelector('.company-overview-campaign-budget').textContent).toContain('20,000');
});
test('campaign expansion preserves assets, promoters, paid amount and actual submission details', async () => {
  await render(); await click(host.querySelector('[aria-label="View Alpha campaign"]'));
  const detail = host.querySelector('#company-details-a'); expect(detail.textContent).toContain('Actual asset.png'); expect(detail.textContent).toContain('Creator One'); expect(detail.textContent).toContain('Actual submission'); expect(detail.textContent).toContain('Proof submissions (2)');
  await click(host.querySelector('[aria-label="Close Alpha campaign"]')); expect(host.querySelector('#company-details-a')).toBeNull();
});
test('Create Campaign keeps existing hash link and form state when returning to overview', async () => {
  await render(); expect(host.querySelector('.company-create-section').hidden).toBe(true);
  await click(host.querySelector('.company-overview-create')); expect(host.querySelector('output').textContent).toBe('/company#create-campaign'); expect(host.querySelector('.company-create-section').hidden).toBe(false);
  await change(field('Campaign name'), 'Unsubmitted campaign');
  await click(host.querySelector('.company-create-back')); expect(host.querySelector('.company-create-section').hidden).toBe(true);
  await click(host.querySelector('.company-overview-create')); expect(field('Campaign name').value).toBe('Unsubmitted campaign');
});
test('creation retains its authenticated payment request and error behavior', async () => {
  await render('/company#create-campaign'); const form = host.querySelector('#create-campaign');
  await change(field('Campaign name'), 'Real business'); await change(form.querySelector('textarea'), 'Campaign description'); await change(form.querySelector('textarea[maxlength="500"]'), 'Campaign key message'); await change(form.querySelector('input[min="20000"]'), '20000');
  await act(async () => Simulate.change(form.querySelectorAll('input[type="checkbox"]')[0])); await act(async () => Simulate.submit(form));
  expect(apiCallAuth.mock.calls.filter(call => call[0] === '/api/payments/initiate')).toHaveLength(0);
  await act(async () => Simulate.submit(form));
  expect(apiCallAuth).toHaveBeenCalledWith('/api/payments/initiate', 'auth-token', { method: 'POST', body: JSON.stringify({ amount: 20000, campaignName: 'Real business', description: 'Campaign description', keyMessage: 'Campaign key message', socialMediaPlatforms: ['tiktok'] }) });
  expect(host.textContent).toContain('Mock payment response');
});
test('failed and empty responses are distinguished from real zero metrics', async () => {
  apiCall.mockResolvedValue({ success: false }); await render(); expect(stats()).toEqual(['Unavailable', 'Unavailable', 'Unavailable']); expect(host.textContent).toContain('Campaigns could not be loaded');
  apiCall.mockResolvedValue({ success: true, campaigns: [] }); await click([...host.querySelectorAll('button')].find(el => el.textContent === 'Retry')); expect(stats()).toEqual(['0', '0', '0']); expect(host.textContent).toContain('Your first campaign starts here');
});
test('submission failure stays unavailable and role guard remains intact', async () => {
  apiCallAuth.mockResolvedValue({ success: false }); await render(); expect(stats()[2]).toBe('Unavailable');
  await click(host.querySelector('[aria-label="View Alpha campaign"]')); expect(host.textContent).toContain('Submissions could not be loaded');
  apiCall.mockClear(); await render('/company', 'promoter'); expect(host.querySelector('output').textContent).toBe('/'); expect(apiCall).not.toHaveBeenCalled();
});

const field = label => {
  const element = [...host.querySelectorAll('label')].find(item => item.textContent.replace(' *', '').trim() === label);
  return document.getElementById(element.htmlFor);
};
test('extended brief survives review, editing, and the existing payment payload', async () => {
  await render('/company#create-campaign');
  await change(field('Campaign name'), 'New campaign'); await change(field('Key message'), 'Be authentic'); await change(field('Budget (NGN)'), '20000');
  await change(field('Campaign goal'), 'Build brand awareness'); await change(field('Description'), 'Our introduction'); await change(field('Content requirements'), 'One product demonstration'); await change(field('Target location'), 'Lagos'); await change(field('Creator requirements'), 'Food creators'); await change(field('Campaign duration (days)'), '14');
  await act(async () => Simulate.change(host.querySelector('input[type="checkbox"]')));
  await act(async () => Simulate.submit(host.querySelector('#create-campaign')));
  expect(host.querySelector('.business-create-review').textContent).toContain('Food creators'); expect(host.querySelector('.business-create-review').textContent).toContain('1 slot');
  expect(apiCallAuth.mock.calls.some(call => call[0] === '/api/payments/initiate')).toBe(false);
  await click([...host.querySelectorAll('button')].find(el => el.textContent === 'Edit campaign')); expect(field('Target location').value).toBe('Lagos');
  await act(async () => Simulate.submit(host.querySelector('#create-campaign'))); await act(async () => Simulate.submit(host.querySelector('#create-campaign')));
  const payload = JSON.parse(apiCallAuth.mock.calls.find(call => call[0] === '/api/payments/initiate')[2].body);
  expect(payload.description).toBe('Our introduction\n\nCampaign goal: Build brand awareness\n\nContent requirements: One product demonstration\n\nTarget location (brief): Lagos\n\nCreator requirements (brief): Food creators\n\nPlanned campaign duration: 14 days (not an automatic end date)');
  expect(payload.amount).toBe(20000); expect(host.querySelector('input[name="advertising"]:disabled')).not.toBeNull();
});
test('removing a rejected asset never removes a different valid file', async () => {
  await render('/company#create-campaign');
  await act(async () => Simulate.change(host.querySelector('input[type="file"]'), { target: { files: [new File(['bad'], 'bad.txt', { type: 'text/plain' }), new File(['good'], 'brief.pdf', { type: 'application/pdf' })] } }));
  expect(host.textContent).toContain('1/10 files selected');
  await click(host.querySelector('[aria-label="Remove bad.txt"]')); expect(host.textContent).toContain('1/10 files selected'); expect(host.textContent).toContain('brief.pdf');
  await click(host.querySelector('[aria-label="Remove brief.pdf"]')); expect(host.textContent).toContain('0/10 files selected');
});

 test('versioned campaigns use purchased capacity and keep the full business budget', async () => {
  campaigns[0] = {...campaigns[0], budget: 60000, pricing: {version: 'creator-20000-included-25-v1', creatorCount: 3, creatorPool: 45000, earningPerCreator: 15000}};
  await render();
  expect(host.querySelector('.company-overview-campaign-status').textContent).toContain('2/3 promoters assigned');
  expect(host.querySelector('.company-overview-campaign-budget').textContent).toContain('60,000');
  expect(host.textContent).not.toContain('7.5%');
 });

async function enterCheckout(){await change(field('Campaign name'),'Payment audit');await change(field('Key message'),'Actual brief');await change(field('Budget (NGN)'),'20000');await act(async()=>Simulate.change(host.querySelector('input[type="checkbox"]')));await act(async()=>Simulate.submit(host.querySelector('#create-campaign')));}
test('payment failures stay visible after navigating back to overview',async()=>{
 let finish;apiCallAuth.mockImplementation(endpoint=>endpoint==='/api/payments/initiate'?new Promise(resolve=>finish=resolve):Promise.resolve({success:true,assets:[],submissions:[]}));
 await render('/company#create-campaign');await enterCheckout();await act(async()=>Simulate.submit(host.querySelector('#create-campaign')));await click(host.querySelector('.company-create-back'));
 await act(async()=>finish({success:false,message:'Payment service unavailable'}));
 const alert=host.querySelector('[role="alert"]');expect(alert.textContent).toContain('Payment service unavailable');expect(alert.closest('[hidden]')).toBeNull();
});
test('V1 callback completes payment, failed assets stay retryable without another payment',async()=>{
 let popup;const originalFetch=global.fetch;window.PaystackPop={setup:jest.fn(options=>{popup=options;return{openIframe:jest.fn()};})};
 apiCallAuth.mockImplementation(async endpoint=>endpoint==='/api/payments/initiate'?{success:true,reference:'paid-ref',publicKey:'test-key'}:endpoint==='/api/campaigns'?{success:true,campaign:{id:'paid-campaign'}}:{success:true,assets:[],submissions:[]});
 global.fetch=jest.fn().mockResolvedValueOnce({ok:false,json:async()=>({success:false,message:'Upload unavailable'})}).mockResolvedValueOnce({ok:true,json:async()=>({success:true})});
 try{await render('/company#create-campaign');await act(async()=>Simulate.change(host.querySelector('input[type="file"]'),{target:{files:[new File(['brief'],'brief.pdf',{type:'application/pdf'})]}}));await enterCheckout();await act(async()=>Simulate.submit(host.querySelector('#create-campaign')));
 expect(typeof popup.callback).toBe('function');expect(popup.onSuccess).toBeUndefined();expect(popup.amount).toBe(2000000);
 await act(async()=>{popup.callback({reference:'paid-ref'});});
 expect(host.textContent).toContain('assets were not uploaded');expect(host.textContent).toContain('brief.pdf');expect(field('Budget (NGN)').value).toBe('');
 await click([...host.querySelectorAll('button')].find(b=>b.textContent==='Retry asset upload'));
 expect(host.textContent).toContain('Campaign assets uploaded successfully');expect(apiCallAuth.mock.calls.filter(c=>c[0]==='/api/payments/initiate')).toHaveLength(1);
 expect(global.fetch).toHaveBeenCalledTimes(2);expect(global.fetch.mock.calls.every(c=>c[0].endsWith('/api/campaigns/paid-campaign/assets/upload'))).toBe(true);
 }finally{global.fetch=originalFetch;delete window.PaystackPop;}
});
