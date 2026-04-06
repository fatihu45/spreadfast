import React, { useState } from 'react';
import { createCampaign } from '../utils/api';

export default function CompanyDashboard() {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image: '',
    caption: '',
    platform: 'Instagram',
    budget: '',
    duration: '',
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
      await createCampaign(formData);
      setMessage('✅ Campaign created successfully!');
      setFormData({
        name: '',
        description: '',
        image: '',
        caption: '',
        platform: 'Instagram',
        budget: '',
        duration: '',
      });
    } catch (err) {
      setError('❌ Failed to create campaign. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-4xl font-bold text-center mb-8">Create Campaign</h1>

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
            <label className="block text-gray-700 font-bold mb-2">Campaign Name</label>
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
            <label className="block text-gray-700 font-bold mb-2">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="4"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-primary"
              required
            ></textarea>
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 font-bold mb-2">Image URL</label>
            <input
              type="url"
              name="image"
              value={formData.image}
              onChange={handleChange}
              placeholder="https://example.com/image.jpg"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-primary"
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 font-bold mb-2">Caption/Post Content</label>
            <textarea
              name="caption"
              value={formData.caption}
              onChange={handleChange}
              rows="3"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-primary"
              required
            ></textarea>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
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

            <div>
              <label className="block text-gray-700 font-bold mb-2">Budget (₦)</label>
              <input
                type="number"
                name="budget"
                value={formData.budget}
                onChange={handleChange}
                placeholder="10000"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-primary"
                required
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 font-bold mb-2">Duration</label>
            <input
              type="text"
              name="duration"
              value={formData.duration}
              onChange={handleChange}
              placeholder="e.g., 7 days or 168 hours"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-primary"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Campaign'}
          </button>
        </form>
      </div>
    </div>
  );
}
