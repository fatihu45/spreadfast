import React from 'react';
import { createRoot } from 'react-dom/client';
import { act as legacyAct, Simulate } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import Register from './Register';
jest.mock('../components/PolicyModal', () => ({ isOpen, policyType, onClose }) => isOpen ? <div role="dialog" aria-label={policyType}><button onClick={onClose}>Close policy</button></div> : null);
const act = React.act || legacyAct;
jest.setTimeout(30000);
const originalLocation = Object.getOwnPropertyDescriptor(window, 'location');
let host, root, register;
beforeEach(() => { global.IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); register = jest.fn().mockResolvedValue({ success: false, message: 'Email already registered' }); Object.defineProperty(window, 'location', { configurable: true, value: { href: '/register' } }); });
afterEach(() => { act(() => root.unmount()); host.remove(); Object.defineProperty(window, 'location', originalLocation); jest.restoreAllMocks(); });
async function render(path = '/register') { await act(async () => root.render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AuthContext.Provider value={{ register }}><Register /></AuthContext.Provider></MemoryRouter>)); }
const change = async (el, value) => act(async () => Simulate.change(el, { target: { value } }));
const submit = async () => act(async () => Simulate.submit(host.querySelector('form')));
const click = async el => act(async () => el.click());
const button = text => [...host.querySelectorAll('button')].find(el => el.textContent === text);
async function details() { await change(host.querySelector('input[autocomplete="name"]'), 'Actual Name'); await change(host.querySelector('input[type="email"]'), 'name@example.test'); await change(host.querySelector('#signup-password'), 'test-password'); await submit(); }
async function consent() { await act(async () => Simulate.change(host.querySelector('#signup-consent'), { target: { checked: true } })); }

test('details are validated first and Continue does not create an account', async () => {
  await render(); await submit(); expect(host.querySelector('h1').textContent).toBe('Create your account');
  await details(); expect(host.querySelector('h1').textContent).toBe('What best describes you?'); expect(register).not.toHaveBeenCalled();
  expect(host.querySelector('input[value="promoter"]').checked).toBe(true);
  await click(button('Back to account details')); expect(host.querySelector('input[autocomplete="name"]').value).toBe('Actual Name'); expect(host.querySelector('#signup-password').value).toBe('test-password');
});
test('creator signup keeps consent, social payload and server error behavior', async () => {
  await render(); await details(); await submit(); expect(register).not.toHaveBeenCalled(); expect(host.textContent).toContain('You must agree');
  await change(host.querySelector('.sf-signup-social input'), '@creator'); await consent(); await submit();
  expect(register).toHaveBeenCalledWith('Actual Name', 'name@example.test', 'test-password', 'promoter', { tiktok: '@creator', instagram: '', twitter: '', facebook: '', youtube: '' });
  expect(host.querySelector('[role="alert"]').textContent).toBe('Email already registered');
});
test('business role link stays preselected and successful signup keeps its redirect', async () => {
  await render('/register?role=company'); await details(); expect(host.querySelector('input[value="company"]').checked).toBe(true); expect(host.querySelector('.sf-signup-social')).toBeNull();
  await consent(); register.mockResolvedValue({ success: true }); await submit();
  expect(register).toHaveBeenCalledWith('Actual Name', 'name@example.test', 'test-password', 'company', undefined); expect(window.location.href).toBe('/company');
});
test('role can change and creator success retains the promoter dashboard redirect', async () => {
  await render('/register?role=company'); await details(); await act(async () => Simulate.change(host.querySelector('input[value="promoter"]'))); await consent(); register.mockResolvedValue({ success: true }); await submit(); expect(window.location.href).toBe('/promoter-dashboard');
});
test('password toggle and policy actions never submit registration', async () => {
  await render(); await click(button('Show')); expect(host.querySelector('#signup-password').type).toBe('text'); await details();
  await click(button('Terms & Conditions')); expect(host.querySelector('[role="dialog"]').getAttribute('aria-label')).toBe('terms'); expect(host.querySelector('[role="dialog"]').closest('form')).toBeNull();
  await click(button('Close policy')); await click(button('Privacy Policy')); expect(host.querySelector('[role="dialog"]').getAttribute('aria-label')).toBe('privacy'); expect(register).not.toHaveBeenCalled();
});
