import React, { useEffect, useState } from 'react';
import { getCampaigns, getSubmissions, updateSubmission } from '../utils/api';

export default function AdminDashboard() {
  const [campaigns, setCampaigns] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('submissions');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const campaignsData = await getCampaigns();
        const submissionsData = await getSubmissions();
        setCampaigns(campaignsData);
        setSubmissions(submissionsData);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleApprove = async (submissionId) => {
    try {
      await updateSubmission(submissionId, 'Approved');
      setSubmissions(submissions.map(s => s.id === submissionId ? { ...s, status: 'Approved' } : s));
    } catch (error) {
      alert('Failed to approve submission');
    }
  };

  const handleReject = async (submissionId) => {
    try {
      await updateSubmission(submissionId, 'Rejected');
      setSubmissions(submissions.map(s => s.id === submissionId ? { ...s, status: 'Rejected' } : s));
    } catch (error) {
      alert('Failed to reject submission');
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading admin dashboard...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-4xl font-bold text-center mb-12">Admin Dashboard</h1>

        {/* Tabs */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setActiveTab('submissions')}
            className={`px-6 py-2 rounded-lg font-bold ${
              activeTab === 'submissions'
                ? 'bg-primary text-white'
                : 'bg-white text-gray-700 border border-gray-300'
            }`}
          >
            Submissions ({submissions.length})
          </button>
          <button
            onClick={() => setActiveTab('campaigns')}
            className={`px-6 py-2 rounded-lg font-bold ${
              activeTab === 'campaigns'
                ? 'bg-primary text-white'
                : 'bg-white text-gray-700 border border-gray-300'
            }`}
          >
            Campaigns ({campaigns.length})
          </button>
        </div>

        {/* Submissions Tab */}
        {activeTab === 'submissions' && (
          <div className="space-y-4">
            {submissions.length === 0 ? (
              <div className="bg-white p-8 rounded-lg text-center">
                <p className="text-gray-600">No submissions yet</p>
              </div>
            ) : (
              submissions.map((submission) => (
                <div key={submission.id} className="bg-white rounded-lg shadow-md p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-gray-600 text-sm">Promoter Name</p>
                      <p className="font-bold text-lg">{submission.userName}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 text-sm">Platform</p>
                      <p className="font-bold text-lg">{submission.platform}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 text-sm">Status</p>
                      <p className={`font-bold text-lg ${
                        submission.status === 'Approved' ? 'text-green-600' :
                        submission.status === 'Rejected' ? 'text-red-600' :
                        'text-yellow-600'
                      }`}>
                        {submission.status}
                      </p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-gray-600 text-sm mb-2">Post Link</p>
                    <a
                      href={submission.postLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline break-all"
                    >
                      {submission.postLink}
                    </a>
                  </div>

                  {submission.screenshot && (
                    <div className="mb-4">
                      <p className="text-gray-600 text-sm mb-2">Screenshot</p>
                      <a
                        href={submission.screenshot}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        View Screenshot
                      </a>
                    </div>
                  )}

                  {submission.status === 'Pending' && (
                    <div className="flex gap-4">
                      <button
                        onClick={() => handleApprove(submission.id)}
                        className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700"
                      >
                        ✅ Approve
                      </button>
                      <button
                        onClick={() => handleReject(submission.id)}
                        className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-red-700"
                      >
                        ❌ Reject
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Campaigns Tab */}
        {activeTab === 'campaigns' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.length === 0 ? (
              <div className="bg-white p-8 rounded-lg text-center col-span-full">
                <p className="text-gray-600">No campaigns yet</p>
              </div>
            ) : (
              campaigns.map((campaign) => (
                <div key={campaign.id} className="card">
                  <img
                    src={campaign.image}
                    alt={campaign.name}
                    className="w-full h-48 object-cover rounded-lg mb-4"
                  />
                  <h3 className="text-xl font-bold mb-2">{campaign.name}</h3>
                  <p className="text-gray-600 mb-3 text-sm">{campaign.description}</p>
                  <div className="space-y-1 text-sm">
                    <p><strong>Platform:</strong> {campaign.platform}</p>
                    <p><strong>Budget:</strong> ${campaign.budget}</p>
                    <p><strong>Duration:</strong> {campaign.duration}</p>
                    <p><strong>Created:</strong> {new Date(campaign.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
