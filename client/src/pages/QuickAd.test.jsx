import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import QuickAd from './QuickAd';

jest.mock('axios', () => ({ post: jest.fn(), get: jest.fn(), delete: jest.fn() }));

let container;
let root;
const originalApiUrl = process.env.REACT_APP_API_URL;
const videoUrl = 'https://media.example/ad.mp4';
const paidResult = { success: true, status: 'completed', generationId: 'ad-1', freePreview: false, downloadable: true, videoUrl, quickAdCredits: 1, freePreviewAvailable: false };
const button = text => [...container.querySelectorAll('button')].find(node => node.textContent.includes(text));
const click = node => act(() => { node.click(); });
function photo(file = new File(['photo'], 'food.png', { type: 'image/png' })) {
  act(() => Simulate.change(container.querySelector('input[type="file"]'), { target: { files: [file], value: '' } }));
  return file;
}

beforeEach(async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(window, 'crypto', { configurable: true, value: { getRandomValues: bytes => require('crypto').randomFillSync(bytes) } });
  process.env.REACT_APP_API_URL = 'https://api.example/';
  URL.createObjectURL = jest.fn(() => 'blob:preview');
  URL.revokeObjectURL = jest.fn();
  axios.post.mockReset();
  sessionStorage.clear();
  axios.get.mockReset().mockResolvedValue({ data: { success: true, quickAdCredits: 2, freePreviewAvailable: false } });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<MemoryRouter><AuthContext.Provider value={{ token: 'session-token', user: { id: 'company-1', role: 'company' } }}><QuickAd /></AuthContext.Provider></MemoryRouter>));
});

afterEach(() => {
  if (root) act(() => root.unmount());
  container.remove();
  jest.restoreAllMocks();
  if (originalApiUrl === undefined) delete process.env.REACT_APP_API_URL;
  else process.env.REACT_APP_API_URL = originalApiUrl;
});

test('validates image presence, type and the backend 8 MB limit before submitting', () => {
  expect(button('Generate Quick Ad').disabled).toBe(true);
  photo(new File(['x'], 'food.gif', { type: 'image/gif' }));
  expect(container.textContent).toContain('Choose a JPG, PNG, or WEBP image.');
  const oversized = new File(['x'], 'food.png', { type: 'image/png' });
  Object.defineProperty(oversized, 'size', { value: 8 * 1024 * 1024 + 1 });
  photo(oversized);
  expect(container.textContent).toContain('up to 8 MB');
  expect(axios.post).not.toHaveBeenCalled();
});

test('sends authenticated multipart once and renders an inline playable result', async () => {
  let finish;
  axios.post.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const file = photo();
  act(() => Simulate.change(container.querySelector('input[value="social"]')));
  const generate = button('Generate Quick Ad');
  click(generate);
  click(generate);
  expect(generate.disabled).toBe(true);
  expect(generate.textContent).toContain('Creating your Quick Ad...');
  expect(axios.post).toHaveBeenCalledTimes(1);
  const [url, form, config] = axios.post.mock.calls[0];
  expect(url).toBe('https://api.example/api/quick-ads/generate');
  expect(form.get('image')).toBe(file);
  expect(form.get('style')).toBe('social');
  expect(config.headers).toEqual({ Authorization: 'Bearer session-token', 'Idempotency-Key': expect.stringMatching(/^[a-f0-9]{32}$/) });
  expect(config.timeout).toBeGreaterThan(600000);
  await act(async () => finish({ data: paidResult }));
  const video = container.querySelector('video');
  expect(video.getAttribute('src')).toBe(videoUrl);
  expect(video.controls).toBe(true);
  expect(video.loop).toBe(true);
  expect(video.playsInline).toBe(true);
  expect(button('Save video').disabled).toBe(false);
  expect(button('Promote with creators').disabled).toBe(false);
  expect(button('Start campaign').disabled).toBe(false);
  act(() => Simulate.change(container.querySelector('input[value="studio"]')));
  expect(container.querySelector('video')).toBeNull();
  expect(button('Save video').disabled).toBe(true);
});

test('fashion enables generation with both outfit photos and sends the pair without an ordinary product', async () => {
  act(() => Simulate.change(container.querySelector('input[value="fashion_studio"]')));
  const front = new File(['front'], 'front.png', { type: 'image/png' });
  const back = new File(['back'], 'back.png', { type: 'image/png' });
  const choose = (label, file) => act(() => Simulate.change(container.querySelector(`input[aria-label="${label}"]`), { target: { files: [file], value: '' } }));
  choose('Upload front outfit photo', front);
  expect(button('Generate Quick Ad').disabled).toBe(true);
  expect(container.querySelector('.quick-ad-stage-image').src).toBe('blob:preview');
  choose('Upload back outfit photo', back);
  expect(button('Generate Quick Ad').disabled).toBe(false);
  click(button('Remove'));
  expect(button('Generate Quick Ad').disabled).toBe(true);
  choose('Upload front outfit photo', front);
  axios.post.mockResolvedValue({ data: { ...paidResult, style: 'fashion_studio' } });
  await act(async () => button('Generate Quick Ad').click());
  const [, form] = axios.post.mock.calls[0];
  expect(form.get('frontImage')).toBe(front);
  expect(form.get('backImage')).toBe(back);
  expect(form.get('image')).toBeNull();
  expect(form.get('style')).toBe('fashion_studio');
  expect(container.querySelector('video').src).toBe(videoUrl);
});

test('a refreshed page resumes status checks for the saved job without submitting again', async () => {
  act(() => root.unmount()); root = createRoot(container);
  sessionStorage.setItem('spreadfast-quick-ad-generation:company-1', 'existing-fashion-job');
  axios.get.mockImplementation(url => {
    if (url.includes('/requests/')) return Promise.resolve({ data: { success: true, status: 'pending', stage: 'creating_scene', imageUrl: 'https://media.example/front.png' } });
    if (url.endsWith('/generations')) return Promise.resolve({ data: { success: true, generations: [] } });
    return Promise.resolve({ data: { success: true, quickAdCredits: 2, freePreviewAvailable: false } });
  });
  await act(async () => root.render(<MemoryRouter><AuthContext.Provider value={{ token: 'session-token', user: { id: 'company-1', role: 'company' } }}><QuickAd /></AuthContext.Provider></MemoryRouter>));
  await act(async () => button('Check generation').click());
  expect(container.textContent).toContain('Creating your Quick Ad...');
  expect(container.querySelector('.quick-ad-stage-image').src).toBe('https://media.example/front.png');
  expect(axios.post).not.toHaveBeenCalled();
  expect(sessionStorage.getItem('spreadfast-quick-ad-generation:company-1')).toBe('existing-fashion-job');
});

test.each([
  () => Promise.reject(new Error('private provider error')),
  () => Promise.resolve({ data: { success: false, message: 'private provider error' } }),
  () => Promise.resolve({ data: { success: true, videoUrl: 'javascript:alert(1)' } }),
])('shows friendly errors and requires checking an unknown outcome before another paid attempt', async implementation => {
  axios.post.mockImplementation(implementation);
  photo();
  await act(async () => button('Generate Quick Ad').click());
  expect(container.textContent).toContain("We couldn't generate your advert. Please try again.");
  expect(container.textContent).not.toContain('private provider error');
  expect(button('Generate Quick Ad').disabled).toBe(true);
  expect(button('Check generation')).toBeDefined();
  expect(button('Save video').disabled).toBe(true);
});

test('does not guess a host when the environment URL is absent', async () => {
  delete process.env.REACT_APP_API_URL;
  photo();
  await act(async () => button('Generate Quick Ad').click());
  expect(axios.post).not.toHaveBeenCalled();
  expect(container.textContent).toContain("We couldn't generate your advert. Please try again.");
});

test('aborts an outstanding request and releases the photo on unmount', () => {
  axios.post.mockImplementation(() => new Promise(() => {}));
  photo();
  click(button('Generate Quick Ad'));
  const { signal } = axios.post.mock.calls[0][2];
  act(() => root.unmount());
  root = null;
  expect(signal.aborted).toBe(true);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
});

test('saves a blob without sending credentials to the media host and offers a browser fallback', async () => {
  axios.post.mockResolvedValue({ data: paidResult });
  axios.get.mockResolvedValue({ data: new Blob(['video'], { type: 'video/mp4' }) });
  const downloadClick = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  photo();
  await act(async () => button('Generate Quick Ad').click());
  await act(async () => button('Save video').click());
  const downloadCall = axios.get.mock.calls.find(([url]) => url === 'https://api.example/api/quick-ads/generations/ad-1/download');
  expect(downloadCall[0]).toBe('https://api.example/api/quick-ads/generations/ad-1/download');
  expect(downloadCall[1].headers).toEqual({ Authorization: 'Bearer session-token' });
  expect(downloadCall[1].headers).toEqual({ Authorization: 'Bearer session-token' });
  expect(downloadClick).toHaveBeenCalled();
  expect(container.querySelector('.quick-ad-open-video').href).toBe(videoUrl);
  axios.get.mockRejectedValue(new Error('CORS denied'));
  await act(async () => button('Save video').click());
  expect(container.textContent).toContain('Open the video below');
  expect(button('Save video').disabled).toBe(false);
});

test.each([{ response: { status: 504 } }, { code: 'ECONNABORTED' }, { code: 'ETIMEDOUT' }])('warns that timed-out jobs may still be processing without automatically resubmitting', async failure => {
  axios.post.mockRejectedValue(failure);
  photo();
  await act(async () => button('Generate Quick Ad').click());
  expect(container.textContent).toContain('may still be processing');
  expect(container.textContent).toContain('avoid creating a duplicate advert');
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(button('Save video').disabled).toBe(true);
});

test('unsupported accounts cannot submit Quick Ads', () => {
  act(() => root.render(<MemoryRouter><AuthContext.Provider value={{ token: 'creator-token', user: { role: 'admin' } }}><QuickAd /></AuthContext.Provider></MemoryRouter>));
  photo();
  expect(container.textContent).toContain('A company or promoter account is required');
  expect(button('Generate Quick Ad').disabled).toBe(true);
  click(button('Generate Quick Ad'));
  expect(axios.post).not.toHaveBeenCalled();
  expect(button('Promote with creators').disabled).toBe(true);
  expect(button('Start campaign').disabled).toBe(true);
});

test.each(['company', 'promoter'])('%s trial switches to the original after a verified purchase', async role => {
  act(() => root.unmount()); root = createRoot(container);
  axios.get.mockResolvedValue({ data: { success: true, quickAdCredits: 0, freePreviewAvailable: true } });
  await act(async () => root.render(<MemoryRouter><AuthContext.Provider value={{ token: 'session-token', user: { id: 'company-1', role } }}><QuickAd /></AuthContext.Provider></MemoryRouter>));
  expect(container.textContent).toContain('1 free preview available');
  const preview = { success: true, status: 'completed', generationId: 'free-1', freePreview: true, downloadable: false, quickAdCredits: 0, freePreviewAvailable: false, previewPath: '/api/quick-ads/generations/free-1/preview?token=scoped-token' };
  axios.post.mockResolvedValue({ data: preview });
  photo(); await act(async () => button('Create Free Preview').click());
  expect(container.querySelector('video').getAttribute('src')).toBe('https://api.example' + preview.previewPath);
  expect(container.querySelector('.quick-ad-open-video')).toBeNull();
  expect(button('Save video').disabled).toBe(true);
  expect(button('Start campaign').disabled).toBe(true);
  expect(button('Promote with creators').disabled).toBe(true);
  expect(container.textContent).toContain('Buy any credit plan to unlock this video');
  axios.get.mockResolvedValue({ data: { ...preview, downloadable: true, videoUrl, quickAdCredits: 3 } });
  await act(async () => button('Preview Again').click());
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(button('Save video').disabled).toBe(false);
  expect(container.querySelector('video').src).toBe(videoUrl);
  expect(button('Start campaign').disabled).toBe(role !== 'company');
  expect(container.textContent).not.toContain('Buy any credit plan to unlock this video');
  expect(container.textContent).toContain('3 credits available');
});

test('unknown generation can be recovered without submitting or charging another generation', async () => {
  axios.post.mockRejectedValue(new Error('connection lost'));
  photo(); await act(async () => button('Generate Quick Ad').click());
  expect(sessionStorage.getItem('spreadfast-quick-ad-generation:company-1')).toMatch(/^[a-f0-9]{32}$/);
  axios.get.mockResolvedValue({ data: paidResult });
  await act(async () => button('Check generation').click());
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(container.querySelector('video').src).toBe(videoUrl);
  expect(sessionStorage.getItem('spreadfast-quick-ad-generation:company-1')).toBeNull();
  expect(container.textContent).toContain('1 credits available');
});

test('promoters generate and save paid ads with current balance while campaign permissions stay unchanged', async () => {
  act(() => root.unmount()); root = createRoot(container);
  await act(async () => root.render(<MemoryRouter><AuthContext.Provider value={{ token: 'session-token', user: { id: 'creator-1', role: 'promoter' } }}><QuickAd /></AuthContext.Provider></MemoryRouter>));
  expect(container.textContent).toContain('2 credits available');
  axios.post.mockResolvedValue({ data: paidResult });
  photo(); await act(async () => button('Generate Quick Ad').click());
  expect(container.querySelector('video').src).toBe(videoUrl);
  expect(container.querySelector('video').playsInline).toBe(true);
  expect(container.textContent).toContain('1 credits available');
  expect(button('Save video').disabled).toBe(false);
  expect(button('Start campaign').disabled).toBe(true);
  expect(button('Promote with creators').disabled).toBe(true);
});

test('promoters with an exhausted preview and zero credits cannot submit another ad', async () => {
  act(() => root.unmount()); root = createRoot(container);
  axios.get.mockResolvedValue({ data: { success: true, quickAdCredits: 0, freePreviewAvailable: false } });
  await act(async () => root.render(<MemoryRouter><AuthContext.Provider value={{ token: 'session-token', user: { id: 'creator-1', role: 'promoter' } }}><QuickAd /></AuthContext.Provider></MemoryRouter>));
  expect(container.textContent).toContain('0 credits available');
  expect(button('Generate Quick Ad')).toBeUndefined();
  expect(button('Buy Credits').disabled).toBe(false);
  photo();
  expect(axios.post).not.toHaveBeenCalled();
});

test('history distinguishes an empty result from a fetch failure and can be retried', async () => {
  act(() => root.unmount()); root = createRoot(container);
  axios.get.mockImplementation(url => url.endsWith('/generations')
    ? Promise.reject(new Error('history unavailable'))
    : Promise.resolve({ data: { success: true, quickAdCredits: 2, freePreviewAvailable: false } }));
  await act(async () => root.render(<MemoryRouter><AuthContext.Provider value={{ token: 'session-token', user: { id: 'company-1', role: 'company' } }}><QuickAd /></AuthContext.Provider></MemoryRouter>));
  expect(container.textContent).toContain('We could not load your Quick Ads.');
  expect(button('Retry')).toBeDefined();

  axios.get.mockImplementation(url => url.endsWith('/generations')
    ? Promise.resolve({ data: { success: true, generations: [] } })
    : Promise.resolve({ data: { success: true, quickAdCredits: 2, freePreviewAvailable: false } }));
  await act(async () => button('Retry').click());
  expect(container.textContent).toContain('Your Quick Ads will appear here after you create them.');
});

test('history shows real generation details and keeps free previews non-downloadable', async () => {
  act(() => root.unmount()); root = createRoot(container);
  const freeHistoryItem = {
    generationId: 'free-history-1',
    style: 'studio',
    status: 'completed',
    freePreview: true,
    downloadable: false,
    thumbnail: 'https://media.example/scene.jpg',
    createdAt: '2026-09-18T12:00:00.000Z',
  };
  axios.get.mockImplementation(url => {
    if (url.endsWith('/credits')) return Promise.resolve({ data: { success: true, quickAdCredits: 0, freePreviewAvailable: false } });
    if (url.endsWith('/generations')) return Promise.resolve({ data: { success: true, generations: [freeHistoryItem] } });
    return Promise.resolve({ data: { success: true, ...freeHistoryItem, previewPath: '/api/quick-ads/generations/free-history-1/preview?token=test' } });
  });
  await act(async () => root.render(<MemoryRouter><AuthContext.Provider value={{ token: 'session-token', user: { id: 'company-1', role: 'company' } }}><QuickAd /></AuthContext.Provider></MemoryRouter>));

  expect(container.textContent).toContain('Clean Studio');
  expect(container.textContent).toContain('Ready');
  const video = container.querySelector('.quick-ad-history-media video');
  expect(video.src).toContain('/free-history-1/preview?token=test');
  expect(video.controls).toBe(false);
  expect(video.autoplay).toBe(false);
  expect(container.querySelector('.quick-ad-history-media img')).toBeNull();
  expect(container.querySelector('button[aria-label="Play video"]').disabled).toBe(false);
  expect(container.querySelector('button[aria-label="Download video"]')).toBeNull();
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
  await act(async () => container.querySelector('button[aria-label="Delete video"]').click());
  expect(axios.delete).not.toHaveBeenCalled();
  confirm.mockReturnValue(true);
  axios.delete.mockRejectedValueOnce(new Error('offline'));
  await act(async () => container.querySelector('button[aria-label="Delete video"]').click());
  expect(container.textContent).toContain('Could not delete that Quick Ad');
  expect(container.querySelector('.quick-ad-history-card')).not.toBeNull();
  axios.delete.mockResolvedValueOnce({ data: { success: true } });
  await act(async () => container.querySelector('button[aria-label="Delete video"]').click());
  expect(axios.delete).toHaveBeenLastCalledWith(expect.stringContaining('/generations/free-history-1'), expect.objectContaining({ headers: { Authorization: 'Bearer session-token' } }));
  expect(container.querySelector('.quick-ad-history-card')).toBeNull();
});
