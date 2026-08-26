import React, { useState, useEffect } from 'react';
import './Auth.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function ResetPassword() {
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      setToken(urlToken);
    } else {
      setError('This reset link is missing a token. Please request a new one.');
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
        credentials: 'include',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
      } else {
        setError(data.message || 'Failed to reset password.');
      }
    } catch (err) {
      console.error('Reset password error:', err);
      if (err.name === 'AbortError') {
        setError('Server is waking up, please try again in 30 seconds.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <form onSubmit={handleSubmit} className="auth-form">
        <h2>Reset Password</h2>

        {error && <div className="error">{error}</div>}

        {success ? (
          <>
            <p>Your password has been reset successfully.</p>
            <p><a href="/login">Go to login</a></p>
          </>
        ) : (
          <>
            <input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />

            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />

            <button type="submit" disabled={loading || !token}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>

            <p><a href="/forgot-password">Request a new link</a></p>
          </>
        )}
      </form>
    </div>
  );
}
