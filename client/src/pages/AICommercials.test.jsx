import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import AICommercials from './AICommercials';

let root, container;
const previousFetch = global.fetch;
let credits, jobs;
const button = text => [...container.querySelectorAll('button')].find(node => node.textContent.includes(text));
async function render(initialTab = 'create') {
  await act(async () => root.render(<MemoryRouter><AuthContext.Provider value={{ token: 'session', user: { role: 'promoter' } }}><AICommercials initialTab={initialTab} /></AuthContext.Provider></MemoryRouter>));
}
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  credits = 0; jobs = [];
  global.fetch = jest.fn(async url => ({ ok: true, json: async () => url.endsWith('/credits')
    ? { success: true, quickAdCredits: credits, freePreviewAvailable: true }
    : { success: true, jobs } }));
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); global.fetch = previousFetch; jest.restoreAllMocks(); });

test('commercial UI requires credits even if an older server advertises a free preview', async () => {
  await render();
  expect(button('Generate commercial').disabled).toBe(true);
  expect(container.textContent).not.toMatch(/free preview/i);
  expect(container.textContent).toContain('4 credits');
  expect(container.textContent).toContain('7 credits');
  expect(container.querySelector('a[href="/promoter/quick-ads"]')).not.toBeNull();
});

test('four credits allow Standard but do not allow Premium', async () => {
  credits = 4;
  await render();
  expect(button('Generate commercial').disabled).toBe(false);
  await act(async () => button('Premium').click());
  expect(button('Generate commercial').disabled).toBe(true);
});

test('edit preserves flattened contact and specifications and delete removes the card', async () => {
  jobs = [{ generationId: 'job-1', status: 'completed', productName: 'Bag', brandName: 'Brand', contact: 'shop.example', specifications: 'Blue leather', downloadable: false }];
  await render('history');
  const prompt = jest.spyOn(window, 'prompt').mockImplementation((label, value) => value);
  await act(async () => container.querySelector('[title="Edit details"]').click());
  expect(prompt).toHaveBeenCalledWith('Contact / call to action', 'shop.example');
  expect(prompt).toHaveBeenCalledWith('Product specifications', 'Blue leather');
  const patch = global.fetch.mock.calls.find(([, options]) => options.method === 'PATCH');
  expect(JSON.parse(patch[1].body).contact).toBe('shop.example');
  expect(container.querySelector('[title="Download unavailable"]').disabled).toBe(true);
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  await act(async () => container.querySelector('[title="Delete"]').click());
  expect(container.querySelectorAll('.sf-commercials__history-item')).toHaveLength(0);
});

test('paid downloads use the authenticated media endpoint', async () => {
  jobs = [{ generationId: 'paid-1', productName: 'Bag', status: 'completed', downloadable: true, videoUrl: 'https://media.example/video.mp4' }];
  await render('history');
  URL.createObjectURL = jest.fn(() => 'blob:download');
  URL.revokeObjectURL = jest.fn();
  jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  const normal = global.fetch.getMockImplementation();
  global.fetch.mockImplementation((url, options) => url.endsWith('/download')
    ? Promise.resolve({ ok: true, blob: async () => new Blob(['video']) })
    : normal(url, options));
  await act(async () => container.querySelector('[title="Download"]').click());
  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/quick-ads/generations/paid-1/download'), expect.objectContaining({ headers: { Authorization: 'Bearer session' } }));
  expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
});

test('retry finishing calls only the saved-job endpoint', async () => {
  jobs = [{ generationId: 'saved-1', status: 'failed', productName: 'Bag', requiredCredits: 7, finalizationRetryAvailable: true }];
  await render('history');
  expect(container.textContent).toContain('7 credits are charged only when the video is finished');
  await act(async () => button('Retry finishing').click());
  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/ai-commercials/jobs/saved-1/retry'), expect.objectContaining({ method: 'POST', headers: { Authorization: 'Bearer session' } }));
  expect(global.fetch.mock.calls.some(([url]) => url.endsWith('/generate'))).toBe(false);
});
