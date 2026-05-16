import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { apiCallAuth } from '../utils/api';
import './Pages.css';

export default function AdminDashboard() {
  const { user, token, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleExitAdmin = () => {
    logout();
    navigate('/login');
  };
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Approval form state
  const [approvalForm, setApprovalForm] = useState({
    submissionId: null,
    approvalAmount: 0,
    visible: false
  });

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [statsData, campaignsData, submissionsData, withdrawalsData] = await Promise.all([
        apiCallAuth('/api/admin/all-stats', token),
        apiCallAuth('/api/admin/campaigns', token),
        apiCallAuth('/api/admin/submissions', token),
        apiCallAuth('/api/admin/withdrawals', token)
      ]);

      if (statsData.success) setStats(statsData.stats);
      if (campaignsData.success) setCampaigns(campaignsData.campaigns || []);
      if (submissionsData.success) setSubmissions(submissionsData.submissions || []);
      if (withdrawalsData.success) setWithdrawals(withdrawalsData.withdrawals || []);
    } catch (err) {
      setError('Failed to load admin data');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCampaignStatusChange = async (campaignId, newStatus) => {
    try {
      setError('');
      setSuccess('');
      const data = await apiCallAuth(
        `/api/admin/campaigns/${campaignId}`,
        token,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: newStatus })
        }
      );

      if (data.success) {
        setSuccess(`Campaign ${newStatus} successfully`);
        fetchAllData();
      } else {
        setError(data.message || 'Failed to update campaign');
      }
    } catch (err) {
      setError('Error updating campaign');
      console.error(err);
    }
  };

  const handleDeleteCampaign = async (campaignId) => {
    if (!window.confirm('Are you sure you want to delete this campaign? This action cannot be undone.')) {
      return;
    }

    try {
      setError('');
      setSuccess('');
      const data = await apiCallAuth(
        `/api/admin/campaigns/${campaignId}`,
        token,
        { method: 'DELETE' }
      );

      if (data.success) {
        setSuccess('Campaign deleted successfully');
        fetchAllData();
      } else {
        setError(data.message || 'Failed to delete campaign');
      }
    } catch (err) {
      setError('Error deleting campaign');
      console.error(err);
    }
  };

  const handleSubmissionApproval = async (submissionId, amount) => {
    try {
      setError('');
      setSuccess('');
      const data = await apiCallAuth(
        `/api/admin/submissions/${submissionId}`,
        token,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: 'approved', approvalAmount: parseFloat(amount) })
        }
      );

      if (data.success) {
        setSuccess('Submission approved and funds added to promoter wallet');
        setApprovalForm({ submissionId: null, approvalAmount: 0, visible: false });
        fetchAllData();
      } else {
        setError(data.message || 'Failed to approve submission');
      }
    } catch (err) {
      setError('Error approving submission');
      console.error(err);
    }
  };

  const handleSubmissionReject = async (submissionId) => {
    try {
      setError('');
      setSuccess('');
      const data = await apiCallAuth(
        `/api/admin/submissions/${submissionId}`,
        token,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: 'rejected' })
        }
      );

      if (data.success) {
        setSuccess('Submission rejected');
        fetchAllData();
      } else {
        setError(data.message || 'Failed to reject submission');
      }
    } catch (err) {
      setError('Error rejecting submission');
      console.error(err);
    }
  };

  const handleWithdrawalMarkPaid = async (withdrawalId) => {
    try {
      setError('');
      setSuccess('');
      const data = await apiCallAuth(
        `/api/admin/withdrawals/${withdrawalId}`,
        token,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: 'completed' })
        }
      );

      if (data.success) {
        setSuccess('Withdrawal marked as completed');
        fetchAllData();
      } else {
        setError(data.message || 'Failed to update withdrawal');
      }
    } catch (err) {
      setError('Error updating withdrawal');
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="admin-dashboard">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard" style={{ background: '#0f172a', minHeight: '100vh', color: '#fff' }}>
      <div className="admin-header" style={{ padding: '30px', borderBottom: '2px solid #3730a3' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '28px', color: '#c7d2fe', margin: 0 }}>🔒 Admin Control Panel</h1>
          <button
            onClick={handleExitAdmin}
            style={{
              padding: '10px 20px',
              background: '#3730a3',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Exit Admin
          </button>
        </div>
      </div>

      {error && <div style={{ background: '#7f1d1d', color: '#fca5a5', padding: '12px', margin: '20px' }}>{error}</div>}
      {success && <div style={{ background: '#15803d', color: '#86efac', padding: '12px', margin: '20px' }}>{success}</div>}

      {/* Stats Overview */}
      {stats && (
        <div style={{ padding: '30px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
          <div style={{ background: '#1e293b', padding: '20px', borderRadius: '8px', borderLeft: '4px solid #667eea' }}>
            <p style={{ margin: '0 0 10px 0', color: '#94a3b8', fontSize: '12px' }}>TOTAL USERS</p>
            <h2 style={{ margin: '0', fontSize: '28px', color: '#60a5fa' }}>{stats.totalUsers}</h2>
            <p style={{ margin: '10px 0 0 0', color: '#64748b', fontSize: '12px' }}>Promoters: {stats.totalPromoters} | Companies: {stats.totalCompanies}</p>
          </div>

          <div style={{ background: '#1e293b', padding: '20px', borderRadius: '8px', borderLeft: '4px solid #f97316' }}>
            <p style={{ margin: '0 0 10px 0', color: '#94a3b8', fontSize: '12px' }}>CAMPAIGNS</p>
            <h2 style={{ margin: '0', fontSize: '28px', color: '#fb923c' }}>{stats.totalCampaigns}</h2>
            <p style={{ margin: '10px 0 0 0', color: '#64748b', fontSize: '12px' }}>Active: {stats.activeCampaigns}</p>
          </div>

          <div style={{ background: '#1e293b', padding: '20px', borderRadius: '8px', borderLeft: '4px solid #ec4899' }}>
            <p style={{ margin: '0 0 10px 0', color: '#94a3b8', fontSize: '12px' }}>SUBMISSIONS</p>
            <h2 style={{ margin: '0', fontSize: '28px', color: '#f472b6' }}>{stats.totalSubmissions}</h2>
            <p style={{ margin: '10px 0 0 0', color: '#64748b', fontSize: '12px' }}>Pending: {stats.pendingSubmissions}</p>
          </div>

          <div style={{ background: '#1e293b', padding: '20px', borderRadius: '8px', borderLeft: '4px solid #10b981' }}>
            <p style={{ margin: '0 0 10px 0', color: '#94a3b8', fontSize: '12px' }}>WITHDRAWALS</p>
            <h2 style={{ margin: '0', fontSize: '28px', color: '#6ee7b7' }}>NGN {(stats.totalWithdrawalAmount / 1000).toFixed(1)}k</h2>
            <p style={{ margin: '10px 0 0 0', color: '#64748b', fontSize: '12px' }}>Pending: NGN {(stats.pendingWithdrawalAmount / 1000).toFixed(1)}k</p>
          </div>

          <div style={{ background: '#1e293b', padding: '20px', borderRadius: '8px', borderLeft: '4px solid #a855f7' }}>
            <p style={{ margin: '0 0 10px 0', color: '#94a3b8', fontSize: '12px' }}>PLATFORM FEES EARNED</p>
            <div style={{ margin: '10px 0 0 0', color: '#64748b', fontSize: '12px' }}>
              <p style={{ margin: '5px 0' }}>Company Fees (7.5%): NGN {(stats && stats.totalCampaignFees ? (stats.totalCampaignFees / 1000).toFixed(1) : '0')}k</p>
              <p style={{ margin: '5px 0' }}>Withdrawal Fees (7.5%): NGN {(stats && stats.totalWithdrawalFees ? (stats.totalWithdrawalFees / 1000).toFixed(1) : '0')}k</p>
              <p style={{ margin: '10px 0 0 0', fontWeight: 'bold', color: '#c7d2fe' }}>Total: NGN {(stats && (stats.totalCampaignFees || 0) + (stats.totalWithdrawalFees || 0) ? (((stats.totalCampaignFees || 0) + (stats.totalWithdrawalFees || 0)) / 1000).toFixed(1) : '0')}k</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '2px solid #3730a3', padding: '0 20px' }}>
        {['overview', 'campaigns', 'submissions', 'withdrawals'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '15px 20px',
              background: activeTab === tab ? '#3730a3' : 'transparent',
              color: activeTab === tab ? '#c7d2fe' : '#94a3b8',
              border: 'none',
              cursor: 'pointer',
              textTransform: 'capitalize',
              fontSize: '14px',
              fontWeight: activeTab === tab ? '600' : '400'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content Sections */}
      <div style={{ padding: '30px' }}>
        {/* Campaigns Section */}
        {activeTab === 'campaigns' && (
          <div>
            <h2 style={{ color: '#c7d2fe', marginBottom: '20px' }}>Campaign Management</h2>
            {campaigns.length === 0 ? (
              <p>No campaigns found</p>
            ) : (
              <div style={{ display: 'grid', gap: '15px' }}>
                {campaigns.map(campaign => (
                  <div key={campaign.id} style={{ background: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div>
                        <h3 style={{ margin: '0 0 10px 0', color: '#60a5fa' }}>{campaign.name}</h3>
                        <p style={{ margin: '5px 0', color: '#94a3b8' }}><strong>Description:</strong> {campaign.description}</p>
                        <p style={{ margin: '5px 0', color: '#94a3b8' }}><strong>Budget:</strong> NGN {campaign.budget}</p>
                        <p style={{ margin: '5px 0', color: '#94a3b8' }}>
                          <strong>Status:</strong> <span style={{ background: campaign.status === 'active' ? '#15803d' : '#7f1d1d', color: campaign.status === 'active' ? '#86efac' : '#fca5a5', padding: '2px 6px', borderRadius: '3px' }}>{campaign.status}</span>
                        </p>
                        <p style={{ margin: '5px 0', color: '#94a3b8' }}><strong>Created:</strong> {new Date(campaign.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        {campaign.status === 'active' && (
                          <button
                            onClick={() => handleCampaignStatusChange(campaign.id, 'paused')}
                            style={{ padding: '8px 12px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            Pause
                          </button>
                        )}
                        {campaign.status === 'paused' && (
                          <button
                            onClick={() => handleCampaignStatusChange(campaign.id, 'active')}
                            style={{ padding: '8px 12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            Resume
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteCampaign(campaign.id)}
                          style={{ padding: '8px 12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Submissions Section */}
        {activeTab === 'submissions' && (
          <div>
            <h2 style={{ color: '#c7d2fe', marginBottom: '20px' }}>Submission Approvals</h2>
            {submissions.length === 0 ? (
              <p>No submissions found</p>
            ) : (
              <div style={{ display: 'grid', gap: '15px' }}>
                {submissions.map(submission => (
                  <div key={submission.id} style={{ background: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div>
                        <h3 style={{ margin: '0 0 10px 0', color: '#60a5fa' }}>{submission.userName}</h3>
                        <p style={{ margin: '5px 0', color: '#94a3b8' }}><strong>Campaign:</strong> {submission.campaignName}</p>
                        <p style={{ margin: '5px 0', color: '#94a3b8' }}><strong>Proof URL:</strong> <a href={submission.proofUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8' }}>{submission.proofUrl?.substring(0, 50)}...</a></p>
                        <p style={{ margin: '5px 0', color: '#94a3b8' }}><strong>Description:</strong> {submission.proofDescription}</p>
                        <p style={{ margin: '5px 0', color: '#94a3b8' }}>
                          <strong>Status:</strong> <span style={{ background: submission.status === 'pending' ? '#7c2d12' : submission.status === 'approved' ? '#15803d' : '#7f1d1d', color: submission.status === 'pending' ? '#ffedd5' : submission.status === 'approved' ? '#86efac' : '#fca5a5', padding: '2px 6px', borderRadius: '3px' }}>{submission.status}</span>
                        </p>
                      </div>
                      {submission.status === 'pending' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <button
                            onClick={() => setApprovalForm({ submissionId: submission.id, approvalAmount: 5000, visible: true })}
                            style={{ padding: '8px 12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleSubmissionReject(submission.id)}
                            style={{ padding: '8px 12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Approval Form */}
                    {approvalForm.visible && approvalForm.submissionId === submission.id && (
                      <div style={{ marginTop: '15px', padding: '15px', background: '#0f172a', borderRadius: '6px' }}>
                        <label style={{ display: 'block', marginBottom: '10px', color: '#94a3b8' }}>
                          Approval Amount (NGN):
                        </label>
                        <input
                          type="number"
                          value={approvalForm.approvalAmount}
                          onChange={(e) => setApprovalForm({ ...approvalForm, approvalAmount: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '8px',
                            background: '#1e293b',
                            border: '1px solid #334155',
                            borderRadius: '4px',
                            color: '#fff',
                            marginBottom: '10px'
                          }}
                        />
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button
                            onClick={() => handleSubmissionApproval(submission.id, approvalForm.approvalAmount)}
                            style={{ flex: 1, padding: '8px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            Confirm Approval
                          </button>
                          <button
                            onClick={() => setApprovalForm({ submissionId: null, approvalAmount: 0, visible: false })}
                            style={{ flex: 1, padding: '8px', background: '#475569', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Withdrawals Section */}
        {activeTab === 'withdrawals' && (
          <div>
            <h2 style={{ color: '#c7d2fe', marginBottom: '20px' }}>Withdrawal Requests</h2>
            {withdrawals.length === 0 ? (
              <p>No withdrawals found</p>
            ) : (
              <div style={{ display: 'grid', gap: '15px' }}>
                {withdrawals.map(withdrawal => (
                  <div key={withdrawal.id} style={{ background: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div>
                        <h3 style={{ margin: '0 0 10px 0', color: '#60a5fa' }}>{withdrawal.promoterName || withdrawal.userName}</h3>
                        <p style={{ margin: '5px 0', color: '#94a3b8' }}><strong>Amount:</strong> NGN {withdrawal.amount?.toLocaleString()}</p>
                        <p style={{ margin: '5px 0', color: '#94a3b8' }}><strong>Email:</strong> {withdrawal.email}</p>
                        <p style={{ margin: '5px 0', color: '#94a3b8' }}>
                          <strong>Bank:</strong> {withdrawal.bankDetails?.bankName} - {withdrawal.bankDetails?.accountName} ({withdrawal.bankDetails?.accountNumber})
                        </p>
                        <p style={{ margin: '5px 0', color: '#94a3b8' }}><strong>Request Date:</strong> {new Date(withdrawal.createdAt).toLocaleDateString()}</p>
                        <p style={{ margin: '5px 0', color: '#94a3b8' }}>
                          <strong>Status:</strong> <span style={{ background: withdrawal.status === 'pending' ? '#7c2d12' : withdrawal.status === 'completed' ? '#15803d' : '#7f1d1d', color: withdrawal.status === 'pending' ? '#ffedd5' : withdrawal.status === 'completed' ? '#86efac' : '#fca5a5', padding: '2px 6px', borderRadius: '3px' }}>{withdrawal.status}</span>
                        </p>
                      </div>
                      {withdrawal.status === 'pending' && (
                        <button
                          onClick={() => handleWithdrawalMarkPaid(withdrawal.id)}
                          style={{ padding: '8px 12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Mark as Paid
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Overview Tab (Default) */}
        {activeTab === 'overview' && (
          <div>
            <h2 style={{ color: '#c7d2fe', marginBottom: '20px' }}>Dashboard Overview</h2>
            <div style={{ background: '#1e293b', padding: '20px', borderRadius: '8px' }}>
              <p style={{ color: '#94a3b8', marginBottom: '10px' }}>
                Welcome to the SpreadFast Admin Control Panel. From this dashboard, you can:
              </p>
              <ul style={{ color: '#94a3b8', paddingLeft: '20px' }}>
                <li>Manage campaigns (pause, resume, delete)</li>
                <li>Review and approve/reject promoter submissions</li>
                <li>Process withdrawal requests from promoters</li>
                <li>Monitor platform statistics and metrics</li>
              </ul>

              <h3 style={{ color: '#c7d2fe', marginTop: '20px', marginBottom: '10px' }}>Quick Stats</h3>
              {stats && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <p style={{ color: '#94a3b8' }}><strong>Total Users:</strong> {stats.totalUsers}</p>
                  <p style={{ color: '#94a3b8' }}><strong>Active Campaigns:</strong> {stats.activeCampaigns}/{stats.totalCampaigns}</p>
                  <p style={{ color: '#94a3b8' }}><strong>Pending Submissions:</strong> {stats.pendingSubmissions}</p>
                  <p style={{ color: '#94a3b8' }}><strong>Pending Withdrawals:</strong> NGN {(stats.pendingWithdrawalAmount / 1000).toFixed(1)}k</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}