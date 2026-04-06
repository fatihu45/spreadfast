import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createSubmission } from '../utils/api';

export default function SubmitProof() {
  const [searchParams] = useSearchParams();
  const campaignId = searchParams.get('campaignId') || '';

  const [formData, setFormData] = useState({
    campaignId,
    userName: '',
    platform: 'Instagram',
    screenshot: '',
    postLink: '',
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
      await createSubmission(formData);
      setMessage('✅ Submission successful! Our team will review and approve soon.');
      setFormData({
        campaignId,
        userName: '',
        platform: 'Instagram',
        screenshot: '',
        postLink: '',
      });
    } catch (err) {
      setError('❌ Failed to submit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-4xl font-bold text-center mb-4">Submit Your Proof</h1>
        <p className="text-center text-gray-600 mb-8">Share your social media post for approval</p>

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
            <label className="block text-gray-700 font-bold mb-2">Campaign ID</label>
            <input
              type="text"
              value={formData.campaignId}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 bg-gray-100"
              disabled
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 font-bold mb-2">Your Name *</label>
            <input
              type="text"
              name="userName"
              value={formData.userName}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-primary"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 font-bold mb-2">Platform</label>
            <select
              name="platform"
              value={formData.platform}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-primary"
              required
            >
              <option value="Instagram">Instagram</option>
              <option value="TikTok">TikTok</option>
              <option value="X">X (Twitter)</option>
              <option value="WhatsApp">WhatsApp</option>
            </select>
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 font-bold mb-2">Screenshot URL</label>
            <input
              type="url"
              name="screenshot"
              value={formData.screenshot}
              onChange={handleChange}
              placeholder="https://example.com/screenshot.jpg"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-primary"
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 font-bold mb-2">Post Link *</label>
            <input
              type="url"
              name="postLink"
              value={formData.postLink}
              onChange={handleChange}
              placeholder="https://instagram.com/p/XXXXX"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-primary"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary disabled:opacity-50"
          >
            {loading ? 'Submitting...' : 'Submit Proof'}
          </button>
        </form>
      </div>
    </div>
  );
}
