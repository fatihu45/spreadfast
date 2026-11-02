import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import AICommercials, { stageLabel, validateImageFile } from './AICommercials';

let host, root;
let jobs;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  jobs = [{ generationId: 'ad', productName: 'Blue shirt', status: 'completed', stage: 'completed', durationSeconds: 21, createdAt: '2026-11-02T10:00:00Z', videoUrl: 'https://media.example/ad.mp4', downloadable: true }];
  global.fetch = jest.fn(async url => ({ ok: true, json: async () => url.endsWith('/credits') ? { success: true, quickAdCredits: 8 } : { success: true, jobs }, blob: async () => new Blob(['video']) }));
  URL.createObjectURL = jest.fn(() => 'blob:download'); URL.revokeObjectURL = jest.fn();
});
afterEach(() => { act(() => root.unmount()); host.remove(); jest.restoreAllMocks(); });
async function render() {
  await act(async () => root.render(<MemoryRouter><AuthContext.Provider value={{ token: 'test-token', user: { role: 'company' } }}><AICommercials initialTab="history" /></AuthContext.Provider></MemoryRouter>));
}
test('shows backend scene progress and matches logo limits', () => {
  expect(stageLabel('creating_video', 2)).toBe('Creating scene 2 of 3');
  expect(stageLabel('finishing')).toBe('Adding finishing touches');
  expect(validateImageFile({ type: 'image/png', size: 3 * 1024 * 1024 }, 'Logo')).toContain('2 MB');
  expect(validateImageFile({ type: 'image/png', size: 3 * 1024 * 1024 }, 'Product photo')).toBe('');
});
test('history displays duration/date and disables locked preview downloads', async () => {
  jobs[0].downloadable = false;
  await render();
  expect(host.textContent).toContain('21.0 seconds');
  expect(host.textContent).toContain('2026');
  expect(host.querySelector('button[aria-label="Download unavailable"]').disabled).toBe(true);
});
test('download uses authenticated media route instead of a cross-origin anchor', async () => {
  jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  await render();
  await act(async () => host.querySelector('button[title="Download"]').click());
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/quick-ads/generations/ad/download'), expect.objectContaining({ headers: { Authorization: 'Bearer test-token' } }));
});
test('delete updates history only after server success', async () => {
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  await render();
  await act(async () => host.querySelector('button[title="Delete"]').click());
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/jobs/ad'), expect.objectContaining({ method: 'DELETE' }));
  expect(host.querySelector('video')).toBeNull();
});
