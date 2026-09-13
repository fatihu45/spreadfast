import React, { useState } from 'react';
import { Alert, AuthLayout, Button, FormField, Input } from '../components/ui';

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

  return <AuthLayout>
    <h1>Forgot Password</h1>
    {error && <Alert tone="error">{error}</Alert>}
    <form onSubmit={handleSubmit} className="sf-signup-form">
      {submitted ? <Alert tone="success">{message}</Alert> : <>
        <p className="sf-signup-intro">Enter your email and we'll send you a link to reset your password.</p>
        <fieldset><FormField label="Email" required><Input type="email" autoComplete="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} /></FormField></fieldset>
        <Button type="submit" fullWidth disabled={loading}>{loading ? 'Sending...' : 'Send Reset Link'}</Button>
      </>}
      <p className="sf-signup-login"><a href="/login">Back to login</a></p>
    </form>
  </AuthLayout>;
}
