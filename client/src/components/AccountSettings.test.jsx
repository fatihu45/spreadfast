import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { AuthContext } from '../context/AuthContext';
import AccountSettings from './AccountSettings';
let root, host, updateUser, logout;
const previousFetch = global.fetch;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  updateUser = jest.fn(); logout = jest.fn();
  global.fetch = jest.fn(async () => ({ ok: true, headers: { get: () => 'application/json' }, json: async () => ({ success: true, name: 'New Name' }) }));
  act(() => root.render(<AuthContext.Provider value={{ user: { name: 'Old Name' }, token: 'test', updateUser, logout }}><AccountSettings /></AuthContext.Provider>));
});
afterEach(() => { act(() => root.unmount()); host.remove(); global.fetch = previousFetch; });
test('saving a name sends only the permitted profile field and updates the account header', async () => {
  act(() => Simulate.change(host.querySelector('#account-name'), { target: { value: 'New Name' } }));
  await act(async () => Simulate.submit(host.querySelector('form')));
  expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ name: 'New Name' });
  expect(updateUser).toHaveBeenCalledWith({ name: 'New Name' });
});
test('password change uses the authenticated endpoint and logs out only on success', async () => {
  act(() => Simulate.change(host.querySelector('#account-current-password'), { target: { value: 'current-password' } }));
  act(() => Simulate.change(host.querySelector('#account-new-password'), { target: { value: 'new-password' } }));
  await act(async () => Simulate.submit(host.querySelectorAll('form')[1]));
  expect(global.fetch.mock.calls[0][0]).toContain('/api/account/password');
  expect(logout).toHaveBeenCalledTimes(1);
});
