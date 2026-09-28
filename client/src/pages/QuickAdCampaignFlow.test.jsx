import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { apiCall, apiCallAuth } from '../utils/api';
import QuickAd from './QuickAd';
import CompanyDashboard from './CompanyDashboard';

jest.mock('axios', () => ({ post: jest.fn(), get: jest.fn() }));
jest.mock('../utils/api', () => ({ apiCall: jest.fn(), apiCallAuth: jest.fn() }));
jest.mock('../components/CompanyOverview', () => () => <div>Company overview</div>);

// These tests render and review the full campaign form on slower development machines.
jest.setTimeout(30000);

const videoUrl = 'https://media.example/generated-ad.mp4';
const imageUrl = 'https://res.cloudinary.com/example/image/upload/product.png';
const previousApi = process.env.REACT_APP_API_URL;
let container;
let root;
let currentLocation;
function LocationProbe() { currentLocation = useLocation(); return null; }
const button = text => [...container.querySelectorAll('button')].find(node => node.textContent.includes(text));
const requirements = () => container.querySelector('textarea[placeholder="Describe the posts you want creators to make"]');
const change = (node, value) => act(() => Simulate.change(node, { target: { value } }));
async function render(entry = '/company/quick-ads') {
  await act(async () => root.render(<AuthContext.Provider value={{ user: { id: 'business-1', role: 'company' }, token: 'test-token' }}>
    <MemoryRouter initialEntries={[entry]}><LocationProbe /><Routes>
      <Route path="/company/quick-ads" element={<QuickAd />} />
      <Route path="/company" element={<CompanyDashboard />} />
    </Routes></MemoryRouter>
  </AuthContext.Provider>));
}
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(window, 'crypto', { configurable: true, value: { getRandomValues: bytes => require('crypto').randomFillSync(bytes) } });
  process.env.REACT_APP_API_URL = 'https://api.example';
  URL.createObjectURL = jest.fn(() => 'blob:local-product');
  URL.revokeObjectURL = jest.fn();
  apiCall.mockReset().mockResolvedValue({ success: true, campaigns: [] });
  apiCallAuth.mockReset().mockResolvedValue({ success: false, message: 'Test checkout stopped' });
  sessionStorage.clear();
  axios.get.mockReset().mockImplementation(url => Promise.resolve({ data: url.endsWith('/export') ? { success: true, videoUrl, imageUrl } : { success: true, quickAdCredits: 2, freePreviewAvailable: false } }));
  axios.post.mockReset().mockResolvedValue({ data: { success: true, status: 'completed', generationId: 'ad-1', freePreview: false, downloadable: true, quickAdCredits: 1, freePreviewAvailable: false, videoUrl, imageUrl } });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  if (previousApi === undefined) delete process.env.REACT_APP_API_URL;
  else process.env.REACT_APP_API_URL = previousApi;
});

test.each(['Promote with creators', 'Start campaign'])('%s hands hosted media to the existing editable campaign and checkout flow', async action => {
  await render();
  expect(button(action).disabled).toBe(true);
  act(() => Simulate.change(container.querySelector('input[type="file"]'), {
    target: { files: [new File(['photo'], 'product.png', { type: 'image/png' })], value: '' },
  }));
  await act(async () => button('Generate Quick Ad').click());
  await act(async () => button(action).click());
  expect(currentLocation.pathname + currentLocation.hash).toBe('/company#create-campaign');
  expect(currentLocation.state).toEqual({ quickAd: { videoUrl, imageUrl } });
  expect(container.querySelector('.company-create-section').hidden).toBe(false);
  expect(requirements().value).toContain(videoUrl);
  expect(requirements().value).toContain(imageUrl);
  expect(requirements().value).not.toContain('blob:');
  expect(apiCallAuth).not.toHaveBeenCalled();

  change(requirements(), requirements().value + '\nShow the product clearly.');
  change(container.querySelector('input[placeholder="Give your campaign a name"]'), 'Food campaign');
  change(container.querySelector('textarea[maxlength="500"]'), 'Fresh food, delivered fast.');
  change(container.querySelector('input[placeholder="Enter your campaign budget"]'), '20000');
  act(() => Simulate.change(container.querySelector('.business-create-platforms input[type="checkbox"]')));
  await act(async () => Simulate.submit(container.querySelector('#create-campaign')));
  expect(container.querySelector('.business-create-review').textContent).toContain(videoUrl);
  expect(container.querySelector('.business-create-review').textContent).toContain('Show the product clearly.');
  expect(apiCallAuth).not.toHaveBeenCalled();
  await act(async () => Simulate.submit(container.querySelector('#create-campaign')));
  expect(apiCallAuth).toHaveBeenCalledTimes(1);
  const [endpoint, token, options] = apiCallAuth.mock.calls[0];
  expect(endpoint).toBe('/api/payments/initiate');
  expect(token).toBe('test-token');
  const payload = JSON.parse(options.body);
  expect(payload.amount).toBe(20000);
  expect(payload.description).toContain(videoUrl);
  expect(payload.description).toContain(imageUrl);
  expect(payload.description).toContain('Show the product clearly.');
});

test.each([undefined, { videoUrl: 'javascript:alert(1)', imageUrl }, { videoUrl: 'blob:local-product', imageUrl }])('normal or invalid handoffs keep campaign requirements empty', async quickAd => {
  await render({ pathname: '/company', hash: '#create-campaign', state: { quickAd } });
  expect(requirements().value).toBe('');
  expect(apiCallAuth).not.toHaveBeenCalled();
});

test('valid video survives a missing original image without inserting a temporary URL', async () => {
  await render({ pathname: '/company', hash: '#create-campaign', state: { quickAd: { videoUrl, imageUrl: 'blob:local-product' } } });
  expect(requirements().value).toContain(videoUrl);
  expect(requirements().value).not.toContain('Original product photo:');
  expect(requirements().value).not.toContain('blob:');
});
