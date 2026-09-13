import React from 'react';
import { createRoot } from 'react-dom/client';
import { act as legacyAct, Simulate } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import Login from './Login';
const act = React.act || legacyAct;
jest.setTimeout(30000);
const originalLocation = Object.getOwnPropertyDescriptor(window, 'location');
let host, root, login;
beforeEach(() => { global.IS_REACT_ACT_ENVIRONMENT = true; jest.useFakeTimers(); host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); login = jest.fn().mockResolvedValue({ success: false, message: 'Incorrect credentials' }); Object.defineProperty(window, 'location', { configurable: true, value: { href: '/login' } }); localStorage.removeItem('token'); sessionStorage.removeItem('token'); });
afterEach(() => { act(() => root.unmount()); host.remove(); jest.clearAllTimers(); jest.useRealTimers(); Object.defineProperty(window, 'location', originalLocation); localStorage.removeItem('token'); sessionStorage.removeItem('token'); jest.restoreAllMocks(); });
async function render() { await act(async () => root.render(<MemoryRouter initialEntries={['/login']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AuthContext.Provider value={{ login }}><Login /></AuthContext.Provider></MemoryRouter>)); }
async function submit() { await act(async () => { Simulate.change(host.querySelector('input[type="email"]'), { target: { value: 'person@example.test' } }); Simulate.change(host.querySelector('#login-password'), { target: { value: 'test-password' } }); }); await act(async () => Simulate.submit(host.querySelector('form'))); }

test('login keeps its credentials and server error feedback', async () => { await render(); await submit(); expect(login).toHaveBeenCalledWith('person@example.test', 'test-password'); expect(host.querySelector('[role="alert"]').textContent).toBe('Incorrect credentials'); expect(host.querySelector('button[type="submit"]').disabled).toBe(false); });
test.each([
  [{ role: 'promoter', email: 'creator@example.test' }, '/promoter-dashboard'],
  [{ role: 'company', email: 'business@example.test' }, '/company'],
  [{ role: 'company', email: process.env.REACT_APP_ADMIN_EMAIL || 'admin@spreadfast.com' }, '/admin-portal'],
  [{ role: 'unknown', email: 'other@example.test' }, '/']
])('keeps the redirect for %j', async (user, target) => { login.mockResolvedValue({ success: true, user }); sessionStorage.setItem('token', 'test-token'); await render(); await submit(); expect(window.location.href).toBe('/login'); act(() => jest.advanceTimersByTime(100)); expect(window.location.href).toBe(target); });
test('keeps the token-storage wait and its existing timeout fallback', async () => { jest.spyOn(console, 'warn').mockImplementation(() => {}); login.mockResolvedValue({ success: true, user: { role: 'promoter', email: 'creator@example.test' } }); await render(); await submit(); act(() => jest.advanceTimersByTime(900)); expect(window.location.href).toBe('/login'); act(() => jest.advanceTimersByTime(100)); expect(window.location.href).toBe('/promoter-dashboard'); });
test('password visibility and existing account links remain available', async () => { await render(); await act(async () => host.querySelector('[aria-label="Show password"]').click()); expect(host.querySelector('#login-password').type).toBe('text'); expect(login).not.toHaveBeenCalled(); expect(host.querySelector('a[href="/forgot-password"]')).not.toBeNull(); expect(host.querySelector('a[href="/register"]')).not.toBeNull(); expect(host.querySelector('a[href="/"] img').getAttribute('src')).toBe('/spreadfast-logo.png'); });
