import React, { useState, useContext, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { apiCallAuth } from '../utils/api';
import './Pages.css';

export default function SubmitProof() {
  const { token } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const campaignId = searchParams.get('campaignId') || '';

  const [formData, setFormData] = useState({
    campaignId,
    userName: '',
    selectedPlatforms: {
      tiktok: false,
      instagram: false,
      twitter: false,
      facebook: false,
      youtube: false
    },
    platformLinks: {
      tiktok: '',
      instagram: '',
      twitter: '',
      facebook: '',
      youtube: ''
    },
    screenshot: ''
  });
  const [loading, setLoading] = useState(false);
  const [submissionsLoading, setSubmissionsLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submissions, setSubmissions] = useState([]);

  // Fetch user's submissions on mount
  useEffect(() => {
    fetchSubmissions();
  }, [token]);

  const fetchSubmissions = async () => {
    if (!token) {
      setSubmissionsLoading(false);
      return;
    }

    try {
      const data = await apiCallAuth('/api/submissions/my-submissions', token);
      if (data.success) {
        setSubmissions(data.submissions || []);
      }
    } catch (error) {
      console.error('Failed to fetch submissions:', error);
    } finally {
      setSubmissionsLoading(false);
    }
  };

  const handlePlatformChange = (platform) => {
    setFormData(prev => ({
      ...prev,
      selectedPlatforms: {
        ...prev.selectedPlatforms,
        [platform]: !prev.selectedPlatforms[platform]
      }
    }));
  };

  const handlePlatformLinkChange = (platform, value) => {
    setFormData(prev => ({
      ...prev,
      platformLinks: {
        ...prev.platformLinks,
        [platform]: value
      }
    }));
  };

  const handleScreenshotChange = (e) => {
    setFormData(prev => ({ ...prev, screenshot: e.target.value }));
  };

  const handleUserNameChange = (e) => {
    setFormData(prev => ({ ...prev, userName: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    // Validate at least one platform is selected
    const selectedPlatforms = Object.keys(formData.selectedPlatforms).filter(
      p => formData.selectedPlatforms[p]
    );

    if (selectedPlatforms.length === 0) {
      setError('❌ Please select at least one platform');
      setLoading(false);
      return;
    }

    // Validate all selected platforms have links
    const missingLinks = selectedPlatforms.filter(p => !formData.platformLinks[p]?.trim());
    if (missingLinks.length > 0) {
      setError(`❌ Please provide links for all selected platforms`);
      setLoading(false);
      return;
    }

    try {
      // Build proof object with platform links
      const proofData = {};
      selectedPlatforms.forEach(platform => {
        proofData[platform] = formData.platformLinks[platform];
      });

      const data = await apiCallAuth(
        `/api/campaigns/${campaignId}/submit`,
        token,
        {
          method: 'POST',
          body: JSON.stringify({
            proofUrl: JSON.stringify(proofData),
            proofDescription: `${selectedPlatforms.join(', ')} - ${formData.userName}`,
            platforms: selectedPlatforms,
            screenshot: formData.screenshot
          })
        }
      );

      if (data.success) {
        setMessage('✅ Submission successful! Our team will review and approve soon.');
        setFormData({
          campaignId,
          userName: '',
          selectedPlatforms: {
            tiktok: false,
            instagram: false,
            twitter: false,
            facebook: false,
            youtube: false
          },
          platformLinks: {
            tiktok: '',
            instagram: '',
            twitter: '',
            facebook: '',
            youtube: ''
          },
          screenshot: ''
        });
        fetchSubmissions();
        setTimeout(() => setMessage(''), 3000);
      } else {
        setError(data.message || '❌ Failed to submit. Please try again.');
      }
    } catch (err) {
      console.error('Submission error:', err);
      setError('❌ Failed to submit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badgeClass = {
      'pending': 'badge-pending',
      'approved': 'badge-approved',
      'rejected': 'badge-rejected'
    }[status] || 'badge-pending';

    return <span className={`badge ${badgeClass}`}>{status.toUpperCase()}</span>;
  };

  const selectedPlatforms = Object.keys(formData.selectedPlatforms).filter(
    p => formData.selectedPlatforms[p]
  );

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-4xl font-bold text-center mb-4">Submit Your Proof</h1>
        <p className="text-center text-gray-600 mb-8">Share your social media posts for approval</p>

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

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-8 mb-12">
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
              value={formData.userName}
              onChange={handleUserNameChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-primary"
              required
            />
          </div>

          <div className="mb-8">
            <label className="block text-gray-700 font-bold mb-3">Select Platforms *</label>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="space-y-3">
                {[
                  { key: 'tiktok', label: 'TikTok' },
                  { key: 'instagram', label: 'Instagram' },
                  { key: 'twitter', label: 'X (Twitter)' },
                  { key: 'facebook', label: 'Facebook' },
                  { key: 'youtube', label: 'YouTube' }
                ].map(platform => (
                  <label key={platform.key} className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.selectedPlatforms[platform.key]}
                      onChange={() => handlePlatformChange(platform.key)}
                      className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">{platform.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {selectedPlatforms.length > 0 && (
            <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Platform Links</h3>
              <div className="space-y-4">
                {selectedPlatforms.map(platform => {
                  const platformLabels = {
                    tiktok: 'TikTok',
                    instagram: 'Instagram',
                    twitter: 'X (Twitter)',
                    facebook: 'Facebook',
                    youtube: 'YouTube'
                  };
                  
                  return (
                    <div key={platform}>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        {platformLabels[platform]} Post Link *
                      </label>
                      <input
                        type="url"
                        value={formData.platformLinks[platform]}
                        onChange={(e) => handlePlatformLinkChange(platform, e.target.value)}
                        placeholder={`https://${platform}.com/post/xxxxx`}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-green-500"
                        required
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mb-6">
            <label className="block text-gray-700 font-bold mb-2">Screenshot URL (Optional)</label>
            <input
              type="url"
              value={formData.screenshot}
              onChange={handleScreenshotChange}
              placeholder="https://example.com/screenshot.jpg"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-primary"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-6 rounded-lg font-bold text-white transition bg-green-600 hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? '⌛ Submitting...' : '✓ Submit Proofs'}
          </button>
        </form>

        {/* Submissions History */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-bold mb-6">Your Submissions</h2>

          {submissionsLoading ? (
            <p className="text-gray-600">Loading submissions...</p>
          ) : submissions.length === 0 ? (
            <p className="text-gray-600">No submissions yet. Submit your first proof above!</p>
          ) : (
            <div className="space-y-4">
              {submissions.map((submission) => (
                <div key={submission.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">{submission.campaignTitle || submission.campaignId}</h3>
                      <p className="text-sm text-gray-600">{submission.proofDescription}</p>
                    </div>
                    {getStatusBadge(submission.status)}
                  </div>

                  <div className="text-sm text-gray-600 space-y-1">
                    <p><strong>Submitted:</strong> {new Date(submission.createdAt).toLocaleDateString()}</p>
                    {submission.status === 'approved' && submission.approvalAmount > 0 && (
                      <p><strong className="text-green-600">Approved Amount:</strong> ₦{submission.approvalAmount}</p>
                    )}
                  </div>

                  {submission.proofUrl && (
                    <a
                      href={submission.proofUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-600 hover:text-green-800 text-sm mt-3 inline-block"
                    >
                      View Submission →
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
