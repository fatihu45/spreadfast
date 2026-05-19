import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import './Auth.css';

export default function Login() {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="auth-container">
      <form onSubmit={handleSubmit} className="auth-form">
        <h2>Login to SpreadFast</h2>
        {error && <div className="error">{error}</div>}
        
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        
        <button type="submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
        
        <p>Don't have an account? <a href="/register">Register here</a></p>
      </form>
    </div>
  );
}