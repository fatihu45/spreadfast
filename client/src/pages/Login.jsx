import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import './Auth.css';

export default function Login() {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(email, password);
    if (result.success) {
      // Redirect based on user role
      const user = result.user;
      const adminEmail = process.env.REACT_APP_ADMIN_EMAIL || 'admin@spreadfast.com';
      
      // Add delay to ensure token is saved before redirecting (important for iPhone)
      setTimeout(() => {
        if (user.email === adminEmail) {
          window.location.href = '/admin-portal';
        } else if (user.role === 'promoter') {
          window.location.href = '/promoter-dashboard';
        } else if (user.role === 'company') {
          window.location.href = '/company';
        } else {
          window.location.href = '/';
        }
      }, 300); // 300ms delay
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