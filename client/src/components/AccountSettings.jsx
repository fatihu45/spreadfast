import React, { useContext, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Button, Alert } from './ui';
import { readResponse } from '../utils/readResponse';
const API = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/$/, '');
export default function AccountSettings() {
  const { user, token, updateUser, logout } = useContext(AuthContext);
  const [name, setName] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function save(event, changePassword) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setMessage('');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${API}/api/account/${changePassword ? 'password' : 'profile'}`, {
        method: changePassword ? 'POST' : 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(changePassword ? { currentPassword, newPassword } : { name }),
        signal: controller.signal
      });
      const data = await readResponse(response);
      if (!response.ok || !data.success) throw new Error(data.message || 'Could not save your changes.');
      if (changePassword) { setCurrentPassword(''); setNewPassword(''); logout(); }
      else { updateUser({ name: data.name }); setMessage('Profile saved.'); }
    } catch (error) { setMessage(error.message || 'Could not save your changes.'); }
    finally { window.clearTimeout(timeout); setBusy(false); }
  }
  return <div className="sf-stack">
    {message && <Alert>{message}</Alert>}
    <form className="sf-stack" onSubmit={event => save(event, false)}>
      <label htmlFor="account-name">Name</label>
      <input id="account-name" className="sf-control" value={name} onChange={event => setName(event.target.value)} maxLength={100} required />
      <Button disabled={busy} type="submit">Save profile</Button>
    </form>
    <details><summary>Change password</summary>
      <form className="sf-stack" onSubmit={event => save(event, true)}>
        <label htmlFor="account-current-password">Current password</label>
        <input id="account-current-password" className="sf-control" type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required />
        <label htmlFor="account-new-password">New password</label>
        <input id="account-new-password" className="sf-control" type="password" autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} minLength={8} required />
        <p>You will need to log in again on your devices.</p>
        <Button disabled={busy} type="submit">Change password</Button>
      </form>
    </details>
  </div>;
}
