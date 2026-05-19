import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import './Auth.css';

export default function Login() {
  const { login, user, token } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [redirectTarget, setRedirectTarget] = useState(null);

  // Watch for successful login - redirect after state is fully updated
  useEffect(() => {
    if (redirectTarget && user && token) {
      // Only redirect when BOTH user AND token are set in context
      // This ensures localStorage was updated and state is synchronized
      window.location.href = redirectTarget;
    }
  }, [redirectTarget, user, token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(email, password);
    if (result.success) {
      // Don't redirect yet - wait for state to update via useEffect above
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
      
      // Set redirect target - useEffect will handle the actual redirect
      // once context state is updated
      setRedirectTarget(target);
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