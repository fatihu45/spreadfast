/* eslint-disable */

import React, { useState, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import './Auth.css';

export default function Register() {
  const { register } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(searchParams.get('role') || 'promoter');
  const [socialMedia, setSocialMedia] = useState({
    tiktok: '',
    instagram: '',
    twitter: '',
    facebook: '',
    youtube: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSocialMediaChange = (platform, value) => {
    setSocialMedia(prev => ({
      ...prev,
      [platform]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const registrationData = {
      name,
      email,
      password,
      role,
      ...(role === 'promoter' && { socialMedia })
    };

    const result = await register(
      registrationData.name,
      registrationData.email,
      registrationData.password,
      registrationData.role,
      registrationData.socialMedia
    );
    if (result.success) {
      window.location.href = role === 'company' ? '/company' : '/promoter-dashboard';
    } else {
      setError(result.message);
    }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <form onSubmit={handleSubmit} className="auth-form">
        <h2>Register for SpreadFast</h2>
        <p className="text-center text-gray-600 mb-6">
          {role === 'company' ? 'Create an account as a Company' : 'Join as a Promoter'}
        </p>
        {error && <div className="error">{error}</div>}
        
        <input
          type="text"
          placeholder="Full Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        
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
        
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="promoter">Register as Promoter</option>
          <option value="company">Register as Company</option>
        </select>

        {role === 'promoter' && (
          <div className="social-media-section">
            <h3 className="text-sm font-bold text-gray-700 mb-4">Social Media Handles (Optional)</h3>
            
            <input
              type="text"
              placeholder="TikTok Handle (e.g., @username)"
              value={socialMedia.tiktok}
              onChange={(e) => handleSocialMediaChange('tiktok', e.target.value)}
              className="mb-3"
            />
            
            <input
              type="text"
              placeholder="Instagram Handle (e.g., @username)"
              value={socialMedia.instagram}
              onChange={(e) => handleSocialMediaChange('instagram', e.target.value)}
              className="mb-3"
            />
            
            <input
              type="text"
              placeholder="Twitter Handle (e.g., @username)"
              value={socialMedia.twitter}
              onChange={(e) => handleSocialMediaChange('twitter', e.target.value)}
              className="mb-3"
            />
            
            <input
              type="text"
              placeholder="Facebook (URL)"
              value={socialMedia.facebook}
              onChange={(e) => handleSocialMediaChange('facebook', e.target.value)}
              className="mb-3"
            />
            
            <input
              type="text"
              placeholder="YouTube Channel (URL)"
              value={socialMedia.youtube}
              onChange={(e) => handleSocialMediaChange('youtube', e.target.value)}
            />
          </div>
        )}
        
        <button type="submit" disabled={loading}>
          {loading ? 'Registering...' : 'Register'}
        </button>
        
        <p>Already have an account? <a href="/login">Login here</a></p>
      </form>
    </div>
  );
}