import Alert from '../components/ui/Alert';
import AuthLayout from '../components/ui/AuthLayout';
import React, { useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Button, FormField, Input } from '../components/ui';
import './Login.css';

export default function Login() {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const checkTokenAndRedirect = (target) => {
    let attempts = 0;
    const maxAttempts = 10;
    const checkInterval = 100; // 100ms

    const intervalId = setInterval(() => {
      attempts++;
      
      // Check if token exists in localStorage or sessionStorage
      const tokenInStorage = localStorage.getItem('token') || sessionStorage.getItem('token');
      
      if (tokenInStorage) {
        // Token found in storage - redirect immediately
        clearInterval(intervalId);
        window.location.href = target;
      } else if (attempts >= maxAttempts) {
        // Max attempts reached - redirect anyway (with token in context)
        clearInterval(intervalId);
        console.warn('Token not found in storage after 10 attempts, redirecting anyway');
        window.location.href = target;
      }
    }, checkInterval);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(email, password);
    if (result.success) {
      // Determine redirect target based on user role
      const user = result.user;
      const adminEmail = process.env.REACT_APP_ADMIN_EMAIL || 'admin@spreadfast.com';
      
      let target = '/';
      if (user.email === adminEmail) {
        target = '/admin-portal';
      } else if (user.role === 'promoter') {
        target = '/promoter-dashboard';
      } else if (user.role === 'company') {
        target = '/company';
      }
      
      // Check if token is saved to storage before redirecting
      // This ensures token persists even on iPhone Safari
      checkTokenAndRedirect(target);
    } else {
      setError(result.message);
    }
    setLoading(false);
  };

  return <AuthLayout className="sf-login">
      <h1>Welcome back</h1>
      <p className="sf-signup-intro">Log in to your SpreadFast account.</p>
      {error && <Alert tone="error">{error}</Alert>}
      <form onSubmit={handleSubmit} className="sf-signup-form">
        <fieldset disabled={loading}>
          <FormField label="Email" required><Input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></FormField>
          <div className="sf-signup-password"><FormField label="Password" id="login-password" required><Input type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter your password" /></FormField>
            <Button variant="ghost" size="sm" className="sf-signup-password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-controls="login-password" aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? 'Hide' : 'Show'}</Button>
          </div>
        </fieldset>
        <Link to="/forgot-password" className="sf-login-forgot">Forgot your password?</Link>
        <Button type="submit" fullWidth disabled={loading}>{loading ? 'Logging in...' : 'Log in'}</Button>
      </form>
      <p className="sf-signup-login">Don't have an account? <Link to="/register">Create an account</Link></p>
  </AuthLayout>;
}
