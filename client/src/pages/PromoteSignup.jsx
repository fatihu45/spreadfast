import React, { useState } from 'react';
import { registerUser } from '../utils/api';

export default function PromoteSignup() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    instagram: '',
    tiktok: '',
    twitter: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      await registerUser(formData);
      setMessage('✅ You have been registered successfully! Start joining campaigns.');
      setFormData({
        name: '',
        email: '',
        phone: '',
        instagram: '',
        tiktok: '',
        twitter: '',
      });
    } catch (err) {
      setError(err.response?.data?.error || '❌ Failed to register. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-4xl font-bold text-center mb-4">Join as Promoter</h1>
        <p className="text-center text-gray-600 mb-8">Start earning by promoting campaigns on your social media</p>

        {message && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
            {message}
          </div>
        )}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-8">
          <div className="mb-6">
            <label className="block text-gray-700 font-bold mb-2">Full Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-primary"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 font-bold mb-2">Email Address *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-primary"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 font-bold mb-2">Phone Number *</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-primary"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 font-bold mb-2">Instagram Username</label>
            <input
              type="text"
              name="instagram"
              value={formData.instagram}
              onChange={handleChange}
              placeholder="@yourusername"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-primary"
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 font-bold mb-2">TikTok Username</label>
            <input
              type="text"
              name="tiktok"
              value={formData.tiktok}
              onChange={handleChange}
              placeholder="@yourusername"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-primary"
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 font-bold mb-2">X (Twitter) Handle</label>
            <input
              type="text"
              name="twitter"
              value={formData.twitter}
              onChange={handleChange}
              placeholder="@yourusername"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-primary"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary disabled:opacity-50"
          >
            {loading ? 'Registering...' : 'Join as Promoter'}
          </button>
        </form>
      </div>
    </div>
  );
}
