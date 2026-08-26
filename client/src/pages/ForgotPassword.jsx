import React, { useState } from 'react';
import './Auth.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        credentials: 'include',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (data.success) {
        setMessage(data.message);
        setSubmitted(true);
      } else {
        setError(data.message || 'Something went wrong. Please try again.');
      }
    } catch (err) {
      console.error('Forgot password error:', err);
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
        <h2>Forgot Password</h2>

        {error && <div className="error">{error}</div>}

        {submitted ? (
          <p>{message}</p>
        ) : (
          <>
            <p>Enter your email and we'll send you a link to reset your password.</p>

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <button type="submit" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </>
        )}

        <p><a href="/login">Back to login</a></p>
      </form>
    </div>
  );
}
