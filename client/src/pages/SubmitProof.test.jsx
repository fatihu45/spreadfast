import React from 'react';
import { createRoot } from 'react-dom/client';
import { act as legacyAct, Simulate } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { apiCall, apiCallAuth } from '../utils/api';
import SubmitProof from './SubmitProof';
jest.mock('../utils/api', () => ({ apiCall: jest.fn(), apiCallAuth: jest.fn() }));
const act = React.act || legacyAct;
let host, root;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  apiCall.mockReset().mockResolvedValue({ success: true, campaign: { id: 'real-id', title: 'Actual campaign', status: 'active', keyMessage: 'Actual message', brandAssets: [] } });
  apiCallAuth.mockReset().mockImplementation(async endpoint => endpoint.includes('my-submissions') ? { success: true, submissions: [] } : { success: false, message: 'Submission rejected by server' });
});
afterEach(() => { act(() => root.unmount()); host.remove(); jest.restoreAllMocks(); });
async function render(path = '/submit-proof?campaignId=real-id') {
  await act(async () => root.render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AuthContext.Provider value={{ token: 'auth-token' }}><SubmitProof /></AuthContext.Provider></MemoryRouter>));
}
const change = async (input, value) => act(async () => Simulate.change(input, { target: { value } }));
const submit = async () => act(async () => Simulate.submit(host.querySelector('form')));
const select = async index => act(async () => Simulate.change(host.querySelectorAll('input[type="checkbox"]')[index]));
const postCalls = () => apiCallAuth.mock.calls.filter(call => call[2]?.method === 'POST');

test('uses actual campaign data and preserves multi-platform payload and server errors', async () => {
  await render(); expect(host.textContent).toContain('Actual campaign'); expect(host.textContent).toContain('Actual message');
  await change(host.querySelector('input[autocomplete="name"]'), 'Creator Name');
  await select(0); await select(1);
  const urls = host.querySelectorAll('input[type="url"]');
  await change(urls[0], 'https://www.tiktok.com/post/123'); await change(urls[1], 'https://www.instagram.com/p/456');
  await change(urls[2], 'https://example.com/proof.png'); await submit();
  expect(postCalls()[0][0]).toBe('/api/campaigns/real-id/submit'); expect(postCalls()[0][1]).toBe('auth-token');
  expect(JSON.parse(postCalls()[0][2].body)).toEqual({ proofUrl: JSON.stringify({ tiktok: 'https://www.tiktok.com/post/123', instagram: 'https://www.instagram.com/p/456' }), proofDescription: 'tiktok, instagram - Creator Name', platforms: ['tiktok', 'instagram'], screenshot: 'https://example.com/proof.png' });
  expect(host.querySelector('[role="alert"]').textContent).toBe('Submission rejected by server');
});
test('requires platform selection and links before contacting submission endpoint', async () => {
  await render(); await submit(); expect(host.textContent).toContain('Please select at least one platform');
  await select(2); await submit(); expect(host.textContent).toContain('Please provide links for all selected platforms'); expect(postCalls()).toHaveLength(0);
});
test('rejects unsupported and oversized screenshot files', async () => {
  await render(); const input = host.querySelector('input[type="file"]');
  await act(async () => Simulate.change(input, { target: { files: [new File(['x'], 'proof.pdf', { type: 'application/pdf' })], value: '' } }));
  expect(host.textContent).toContain('Choose a PNG or JPG image.');
  await act(async () => Simulate.change(input, { target: { files: [new File([new Uint8Array(61 * 1024)], 'proof.png', { type: 'image/png' })], value: '' } }));
  expect(host.textContent).toContain('Choose an image under 60 KB'); expect(postCalls()).toHaveLength(0);
});
test('sends a selected screenshot through the existing screenshot field and clears on success', async () => {
  await render();
  jest.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function () { Object.defineProperty(this, 'result', { value: 'data:image/png;base64,YQ==' }); this.onload(); });
  await act(async () => Simulate.change(host.querySelector('input[type="file"]'), { target: { files: [new File(['a'], 'proof.png', { type: 'image/png' })], value: '' } }));
  expect(host.querySelector('img[alt="Selected proof screenshot"]').src).toBe('data:image/png;base64,YQ==');
  await select(2); await change(host.querySelector('input[type="url"]'), 'https://youtube.com/watch?v=123');
  apiCallAuth.mockImplementation(async () => ({ success: true, submissions: [] })); await submit();
  expect(JSON.parse(postCalls()[0][2].body).screenshot).toBe('data:image/png;base64,YQ==');
  expect(host.textContent).toContain('Submission successful'); expect(host.querySelector('img[alt="Selected proof screenshot"]')).toBeNull();
});
test('missing campaign disables submission and history renders individual post links', async () => {
  apiCallAuth.mockResolvedValue({ success: true, submissions: [{ id: 's', campaignId: 'real-id', status: 'approved', approvalAmount: 4200, createdAt: '2026-09-10', proofUrl: JSON.stringify({ instagram: 'https://instagram.com/p/123', unsafe: 'javascript:alert(1)' }) }] });
  await render('/submit-proof'); expect(host.querySelector('button[type="submit"]').disabled).toBe(true);
  expect(host.querySelector('.submission-history-links a').href).toBe('https://instagram.com/p/123');
  expect(host.querySelectorAll('.submission-history-links a')).toHaveLength(1); expect(host.textContent).toContain('4200');
});

test('submission history failures are distinct from an empty history',async()=>{apiCallAuth.mockResolvedValueOnce({success:false,message:'History unavailable'});await render();expect(host.querySelector('.submission-history').textContent).toContain('History unavailable');expect(host.querySelector('.submission-history').textContent).not.toContain('No submissions yet');apiCallAuth.mockResolvedValueOnce({success:true,submissions:[]});await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Retry submissions').click());expect(host.querySelector('.submission-history').textContent).toContain('No submissions yet');});
