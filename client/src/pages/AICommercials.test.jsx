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
  await act(async () => button('Retry finishing video').click());
  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/ai-commercials/jobs/saved-1/retry'), expect.objectContaining({ method: 'POST', headers: { Authorization: 'Bearer session' } }));
  expect(global.fetch.mock.calls.some(([url]) => url.endsWith('/generate'))).toBe(false);
});


test('simple creation sends a photo and brief without a style or required branding', async () => {
  credits = 4;
  URL.createObjectURL = jest.fn(() => 'blob:product');
  URL.revokeObjectURL = jest.fn();
  await render();
  expect(container.textContent).not.toMatch(/Choose your creative direction|Scene-by-scene creation|Idle/);
  expect(container.textContent).toContain('Available credits: 4');
  expect(container.querySelector('details').open).toBe(false);
  const upload = container.querySelector('.sf-commercials__upload input');
  Object.defineProperty(upload, 'files', { value: [new File(['image'], 'tea.png', { type: 'image/png' })] });
  await act(async () => upload.dispatchEvent(new Event('change', { bubbles: true })));
  const brief = container.querySelector('textarea');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(brief, 'Warm tea advert');
    brief.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => button('Generate commercial').click());
  const request = global.fetch.mock.calls.find(([url]) => url.endsWith('/generate'));
  expect(request).toBeDefined();
  expect(request[1].body.get('style')).toBeNull();
  expect(request[1].body.get('specifications')).toBe('Warm tea advert');
  expect(request[1].body.get('brandName')).toBe('');
  expect(request[1].body.get('tier')).toBe('standard');
});

test('multiple product photos are previewed and sent together', async () => {
  credits = 4;
  URL.createObjectURL = jest.fn(file => `blob:${file.name}`); URL.revokeObjectURL = jest.fn();
  await render();
  const upload = container.querySelector('.sf-commercials__upload input');
  expect(upload.multiple).toBe(true);
  Object.defineProperty(upload, 'files', { value: ['front', 'back', 'side'].map(name => new File(['image'], `${name}.png`, { type: 'image/png' })) });
  await act(async () => upload.dispatchEvent(new Event('change', { bubbles: true })));
  expect(container.querySelectorAll('.sf-commercials__photo-list img')).toHaveLength(3);
  await act(async () => button('Generate commercial').click());
  const request = global.fetch.mock.calls.find(([url]) => url.endsWith('/generate'));
  expect(request[1].body.getAll('productImage')).toHaveLength(3);
});

test('more than four photos are rejected before submission', async () => {
  credits = 4; await render();
  const upload = container.querySelector('.sf-commercials__upload input');
  Object.defineProperty(upload, 'files', { value: Array.from({ length: 5 }, (_, i) => new File(['image'], `${i}.png`, { type: 'image/png' })) });
  await act(async () => upload.dispatchEvent(new Event('change', { bubbles: true })));
  expect(container.textContent).toContain('Choose up to four photos');
  expect(global.fetch.mock.calls.some(([url]) => url.endsWith('/generate'))).toBe(false);
});

test('pending history jobs can be cancelled with authentication', async () => {
  jobs = [{ generationId: 'pending-1', status: 'pending', stage: 'creating_video', productName: 'Bag' }];
  await render('history');
  await act(async () => button('Cancel generation').click());
  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/jobs/pending-1/cancel'), expect.objectContaining({ method: 'POST', headers: { Authorization: 'Bearer session' } }));
});

test('partial jobs show Retry commercial and never start a new generation', async () => {
  jobs = [{ generationId: 'partial-1', status: 'failed', commercialRetryAvailable: true, requiredCredits: 4 }];
  await render('history');
  await act(async () => button('Retry commercial').click());
  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/jobs/partial-1/retry'), expect.objectContaining({ method: 'POST' }));
  expect(global.fetch.mock.calls.some(([url]) => url.endsWith('/generate'))).toBe(false);
});
