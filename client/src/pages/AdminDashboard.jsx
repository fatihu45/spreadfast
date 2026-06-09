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
      setError('');

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
        { method: 'PATCH', body: JSON.stringify({ status: newStatus }) }
      );
      if (data.success) {
        setSuccess(`Campaign ${newStatus} successfully`);
        fetchAllData();
      } else {
        setError(data.message || 'Failed to update campaign');
      }
    } catch (err) {
      setError('Error updating campaign');
    }
  };

  const handleDeleteCampaign = async (campaignId) => {
    if (!window.confirm('Are you sure you want to delete this campaign? This cannot be undone.')) return;
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
    }
  };

  const handleSubmissionApproval = async (submissionId, amount) => {
    try {
      setError('');
      setSuccess('');
      const data = await apiCallAuth(
        `/api/admin/submissions/${submissionId}`,
        token,
        { method: 'PATCH', body: JSON.stringify({ status: 'approved', approvalAmount: parseFloat(amount) }) }
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
    }
  };

  const handleSubmissionReject = async (submissionId) => {
    try {
      setError('');
      setSuccess('');
      const data = await apiCallAuth(
        `/api/admin/submissions/${submissionId}`,
        token,
        { method: 'PATCH', body: JSON.stringify({ status: 'rejected' }) }
      );
      if (data.success) {
        setSuccess('Submission rejected');
        fetchAllData();
      } else {
        setError(data.message || 'Failed to reject submission');
      }
    } catch (err) {
      setError('Error rejecting submission');
    }
  };

  const handleWithdrawalMarkPaid = async (withdrawalId) => {
    try {
      setError('');
      setSuccess('');
      const data = await apiCallAuth(
        `/api/admin/withdrawals/${withdrawalId}`,
        token,
        { method: 'PATCH', body: JSON.stringify({ status: 'completed' }) }
      );
      if (data.success) {
        setSuccess('Withdrawal marked as completed');
        fetchAllData();
      } else {
        setError(data.message || 'Failed to update withdrawal');
      }
    } catch (err) {
      setError('Error updating withdrawal');
    }
  };

  if (loading) {
    return (
      <div style={{ background: '#0f172a', minHeight: '100vh', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#94a3b8', fontSize: '16px' }}>Loading admin dashboard...</p>
      </div>
    );
  }

  return (
    <div style={{ background: '#0f172a', minHeight: '100vh', color: '#fff' }}>

      {/* Header */}
      <div style={{ padding: '24px 30px', borderBottom: '2px solid #3730a3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '24px', color: '#c7d2fe', margin: 0 }}>🔒 Admin Control Panel</h1>
        <button
          onClick={handleExitAdmin}
          style={{ padding: '10px 20px', background: '#3730a3', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}
        >
          Exit Admin
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div style={{ background: '#7f1d1d', color: '#fca5a5', padding: '12px 30px', fontSize: '14px' }}>
          ⚠️ {error}
        </div>
      )}
      {success && (
        <div style={{ background: '#15803d', color: '#86efac', padding: '12px 30px', fontSize: '14px' }}>
          ✅ {success}
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div style={{ padding: '24px 30px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div style={{ background: '#1e293b', padding: '20px', borderRadius: '8px', borderLeft: '4px solid #667eea' }}>
            <p style={{ margin: '0 0 8px 0', color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Users</p>
            <h2 style={{ margin: '0 0 6px 0', fontSize: '28px', color: '#60a5fa' }}>{stats.totalUsers}</h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: '12px' }}>Promoters: {stats.totalPromoters} · Companies: {stats.totalCompanies}</p>
          </div>
          <div style={{ background: '#1e293b', padding: '20px', borderRadius: '8px', borderLeft: '4px solid #f97316' }}>
            <p style={{ margin: '0 0 8px 0', color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>Campaigns</p>
            <h2 style={{ margin: '0 0 6px 0', fontSize: '28px', color: '#fb923c' }}>{stats.totalCampaigns}</h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: '12px' }}>Active: {stats.activeCampaigns}</p>
          </div>
          <div style={{ background: '#1e293b', padding: '20px', borderRadius: '8px', borderLeft: '4px solid #ec4899' }}>
            <p style={{ margin: '0 0 8px 0', color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>Submissions</p>
            <h2 style={{ margin: '0 0 6px 0', fontSize: '28px', color: '#f472b6' }}>{stats.totalSubmissions}</h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: '12px' }}>Pending: {stats.pendingSubmissions}</p>
          </div>
          <div style={{ background: '#1e293b', padding: '20px', borderRadius: '8px', borderLeft: '4px solid #10b981' }}>
            <p style={{ margin: '0 0 8px 0', color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>Withdrawals</p>
            <h2 style={{ margin: '0 0 6px 0', fontSize: '28px', color: '#6ee7b7' }}>₦{((stats.totalWithdrawalAmount || 0) / 1000).toFixed(1)}k</h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: '12px' }}>Pending: ₦{((stats.pendingWithdrawalAmount || 0) / 1000).toFixed(1)}k</p>
          </div>
          <div style={{ background: '#1e293b', padding: '20px', borderRadius: '8px', borderLeft: '4px solid #a855f7' }}>
            <p style={{ margin: '0 0 8px 0', color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>Platform Fees (5%)</p>
            <h2 style={{ margin: '0 0 6px 0', fontSize: '22px', color: '#c084fc' }}>
              ₦{(((stats.totalCampaignFees || 0) + (stats.totalWithdrawalFees || 0)) / 1000).toFixed(1)}k
            </h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: '12px' }}>
              Campaign: ₦{((stats.totalCampaignFees || 0) / 1000).toFixed(1)}k · Withdrawal: ₦{((stats.totalWithdrawalFees || 0) / 1000).toFixed(1)}k
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid #1e293b', padding: '0 30px', gap: '4px' }}>
        {['overview', 'campaigns', 'submissions', 'withdrawals'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 20px',
              background: activeTab === tab ? '#3730a3' : 'transparent',
              color: activeTab === tab ? '#c7d2fe' : '#64748b',
              border: 'none',
              cursor: 'pointer',
              textTransform: 'capitalize',
              fontSize: '14px',
              fontWeight: activeTab === tab ? '600' : '400',
              borderRadius: '6px 6px 0 0',
              transition: 'all 0.15s'
            }}
          >
            {tab}
            {tab === 'submissions' && stats?.pendingSubmissions > 0 && (
              <span style={{ marginLeft: '6px', background: '#ef4444', color: '#fff', fontSize: '11px', padding: '1px 6px', borderRadius: '10px' }}>
                {stats.pendingSubmissions}
              </span>
            )}
            {tab === 'withdrawals' && stats?.pendingWithdrawals > 0 && (
              <span style={{ marginLeft: '6px', background: '#f59e0b', color: '#fff', fontSize: '11px', padding: '1px 6px', borderRadius: '10px' }}>
                {stats.pendingWithdrawals}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ padding: '30px' }}>

        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <div>
            <h2 style={{ color: '#c7d2fe', marginBottom: '20px', fontSize: '18px' }}>Dashboard Overview</h2>
            <div style={{ background: '#1e293b', padding: '24px', borderRadius: '8px' }}>
              <p style={{ color: '#94a3b8', marginBottom: '16px', fontSize: '14px' }}>
                Welcome to the SpreadFast Admin Control Panel. Use the tabs above to manage the platform.
              </p>
              <ul style={{ color: '#94a3b8', paddingLeft: '20px', fontSize: '14px', lineHeight: '2' }}>
                <li><strong style={{ color: '#c7d2fe' }}>Campaigns</strong> — pause, resume, or delete campaigns</li>
                <li><strong style={{ color: '#c7d2fe' }}>Submissions</strong> — approve or reject promoter proof submissions</li>
                <li><strong style={{ color: '#c7d2fe' }}>Withdrawals</strong> — mark withdrawal requests as paid</li>
              </ul>
              {stats && (
                <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
                    <span style={{ color: '#64748b' }}>Total Users:</span> <strong style={{ color: '#e2e8f0' }}>{stats.totalUsers}</strong>
                  </p>
                  <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
                    <span style={{ color: '#64748b' }}>Active Campaigns:</span> <strong style={{ color: '#e2e8f0' }}>{stats.activeCampaigns}/{stats.totalCampaigns}</strong>
                  </p>
                  <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
                    <span style={{ color: '#64748b' }}>Pending Submissions:</span> <strong style={{ color: '#f472b6' }}>{stats.pendingSubmissions}</strong>
                  </p>
                  <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
                    <span style={{ color: '#64748b' }}>Pending Withdrawals:</span> <strong style={{ color: '#6ee7b7' }}>₦{((stats.pendingWithdrawalAmount || 0) / 1000).toFixed(1)}k</strong>
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CAMPAIGNS */}
        {activeTab === 'campaigns' && (
          <div>
            <h2 style={{ color: '#c7d2fe', marginBottom: '20px', fontSize: '18px' }}>
              Campaign Management <span style={{ color: '#64748b', fontSize: '14px', fontWeight: 400 }}>({campaigns.length} total)</span>
            </h2>
            {campaigns.length === 0 ? (
              <div style={{ background: '#1e293b', padding: '40px', borderRadius: '8px', textAlign: 'center' }}>
                <p style={{ color: '#64748b', margin: 0 }}>No campaigns found.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                {campaigns.map(campaign => (
                  <div key={campaign._id || campaign.id} style={{ background: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ margin: '0 0 10px 0', color: '#60a5fa', fontSize: '16px' }}>
                          {campaign.title || campaign.name || 'Untitled Campaign'}
                        </h3>
                        <p style={{ margin: '4px 0', color: '#94a3b8', fontSize: '13px' }}>
                          <span style={{ color: '#64748b' }}>Description:</span> {campaign.description || '—'}
                        </p>
                        <p style={{ margin: '4px 0', color: '#94a3b8', fontSize: '13px' }}>
                          <span style={{ color: '#64748b' }}>Budget:</span> ₦{parseFloat(campaign.budget || 0).toLocaleString()}
                        </p>
                        <p style={{ margin: '4px 0', color: '#94a3b8', fontSize: '13px' }}>
                          <span style={{ color: '#64748b' }}>Platforms:</span> {(campaign.socialMediaPlatforms || []).join(', ') || '—'}
                        </p>
                        <p style={{ margin: '4px 0', color: '#94a3b8', fontSize: '13px' }}>
                          <span style={{ color: '#64748b' }}>Promoters subscribed:</span> {(campaign.subscribedPromoters || []).length}
                        </p>
                        <p style={{ margin: '8px 0 0 0', fontSize: '13px' }}>
                          <span style={{ color: '#64748b' }}>Status:</span>{' '}
                          <span style={{
                            background: campaign.status === 'active' ? '#14532d' : campaign.status === 'paused' ? '#78350f' : '#1e293b',
                            color: campaign.status === 'active' ? '#86efac' : campaign.status === 'paused' ? '#fde68a' : '#94a3b8',
                            padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600'
                          }}>
                            {campaign.status}
                          </span>
                          <span style={{ color: '#64748b', fontSize: '12px', marginLeft: '12px' }}>
                            Created {new Date(campaign.createdAt).toLocaleDateString()}
                          </span>
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        {campaign.status === 'active' && (
                          <button
                            onClick={() => handleCampaignStatusChange(campaign.id, 'paused')}
                            style={{ padding: '8px 14px', background: '#92400e', color: '#fde68a', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                          >
                            Pause
                          </button>
                        )}
                        {campaign.status === 'paused' && (
                          <button
                            onClick={() => handleCampaignStatusChange(campaign.id, 'active')}
                            style={{ padding: '8px 14px', background: '#14532d', color: '#86efac', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                          >
                            Resume
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteCampaign(campaign.id)}
                          style={{ padding: '8px 14px', background: '#7f1d1d', color: '#fca5a5', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
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

        {/* SUBMISSIONS */}
        {activeTab === 'submissions' && (
          <div>
            <h2 style={{ color: '#c7d2fe', marginBottom: '20px', fontSize: '18px' }}>
              Submission Approvals <span style={{ color: '#64748b', fontSize: '14px', fontWeight: 400 }}>({submissions.length} total)</span>
            </h2>
            {submissions.length === 0 ? (
              <div style={{ background: '#1e293b', padding: '40px', borderRadius: '8px', textAlign: 'center' }}>
                <p style={{ color: '#64748b', margin: 0 }}>No submissions found.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                {submissions.map(submission => (
                  <div key={submission._id || submission.id} style={{ background: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ margin: '0 0 10px 0', color: '#60a5fa', fontSize: '16px' }}>
                          {submission.userName || 'Unknown Promoter'}
                        </h3>
                        <p style={{ margin: '4px 0', color: '#94a3b8', fontSize: '13px' }}>
                          <span style={{ color: '#64748b' }}>Campaign:</span> {submission.campaignName || submission.campaignId}
                        </p>
                        <p style={{ margin: '4px 0', color: '#94a3b8', fontSize: '13px' }}>
                          <span style={{ color: '#64748b' }}>Platforms:</span> {(submission.platforms || []).join(', ') || '—'}
                        </p>
                        <p style={{ margin: '4px 0', color: '#94a3b8', fontSize: '13px' }}>
                          <span style={{ color: '#64748b' }}>Description:</span> {submission.proofDescription || '—'}
                        </p>
                        <p style={{ margin: '4px 0', fontSize: '13px' }}>
                          <span style={{ color: '#64748b' }}>Proof URL:</span>{' '}
                          {submission.proofUrl ? (
                            <a href={submission.proofUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8' }}>
                              {submission.proofUrl.length > 60 ? submission.proofUrl.substring(0, 60) + '...' : submission.proofUrl}
                            </a>
                          ) : '—'}
                        </p>
                        {submission.approvalAmount > 0 && (
                          <p style={{ margin: '4px 0', color: '#94a3b8', fontSize: '13px' }}>
                            <span style={{ color: '#64748b' }}>Approved Amount:</span> <strong style={{ color: '#86efac' }}>₦{submission.approvalAmount?.toLocaleString()}</strong>
                          </p>
                        )}
                        <p style={{ margin: '8px 0 0 0', fontSize: '13px' }}>
                          <span style={{
                            background: submission.status === 'pending' ? '#78350f' : submission.status === 'approved' ? '#14532d' : '#7f1d1d',
                            color: submission.status === 'pending' ? '#fde68a' : submission.status === 'approved' ? '#86efac' : '#fca5a5',
                            padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600'
                          }}>
                            {submission.status}
                          </span>
                          <span style={{ color: '#64748b', fontSize: '12px', marginLeft: '12px' }}>
                            Submitted {new Date(submission.createdAt).toLocaleDateString()}
                          </span>
                        </p>
                      </div>

                      {submission.status === 'pending' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
                          <button
                            onClick={() => setApprovalForm({ submissionId: submission.id, approvalAmount: 5000, visible: true })}
                            style={{ padding: '8px 14px', background: '#14532d', color: '#86efac', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleSubmissionReject(submission.id)}
                            style={{ padding: '8px 14px', background: '#7f1d1d', color: '#fca5a5', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Approval Amount Form */}
                    {approvalForm.visible && approvalForm.submissionId === submission.id && (
                      <div style={{ marginTop: '16px', padding: '16px', background: '#0f172a', borderRadius: '6px', border: '1px solid #334155' }}>
                        <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8', fontSize: '13px' }}>
                          Approval Amount (₦):
                        </label>
                        <input
                          type="number"
                          value={approvalForm.approvalAmount}
                          onChange={(e) => setApprovalForm({ ...approvalForm, approvalAmount: e.target.value })}
                          style={{ width: '100%', padding: '10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#fff', marginBottom: '12px', fontSize: '14px', boxSizing: 'border-box' }}
                        />
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => handleSubmissionApproval(submission.id, approvalForm.approvalAmount)}
                            style={{ flex: 1, padding: '10px', background: '#14532d', color: '#86efac', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
                          >
                            Confirm Approval
                          </button>
                          <button
                            onClick={() => setApprovalForm({ submissionId: null, approvalAmount: 0, visible: false })}
                            style={{ flex: 1, padding: '10px', background: '#334155', color: '#94a3b8', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
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

        {/* WITHDRAWALS */}
        {activeTab === 'withdrawals' && (
          <div>
            <h2 style={{ color: '#c7d2fe', marginBottom: '20px', fontSize: '18px' }}>
              Withdrawal Requests <span style={{ color: '#64748b', fontSize: '14px', fontWeight: 400 }}>({withdrawals.length} total)</span>
            </h2>
            {withdrawals.length === 0 ? (
              <div style={{ background: '#1e293b', padding: '40px', borderRadius: '8px', textAlign: 'center' }}>
                <p style={{ color: '#64748b', margin: 0 }}>No withdrawal requests found.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                {withdrawals.map(withdrawal => (
                  <div key={withdrawal._id || withdrawal.id} style={{ background: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ margin: '0 0 10px 0', color: '#60a5fa', fontSize: '16px' }}>
                          {withdrawal.promoterName || withdrawal.userName || 'Unknown'}
                        </h3>
                        <p style={{ margin: '4px 0', color: '#94a3b8', fontSize: '13px' }}>
                          <span style={{ color: '#64748b' }}>Amount:</span> <strong style={{ color: '#e2e8f0' }}>₦{(withdrawal.amount || 0).toLocaleString()}</strong>
                        </p>
                        <p style={{ margin: '4px 0', color: '#94a3b8', fontSize: '13px' }}>
                          <span style={{ color: '#64748b' }}>Email:</span> {withdrawal.email}
                        </p>
                        <p style={{ margin: '4px 0', color: '#94a3b8', fontSize: '13px' }}>
                          <span style={{ color: '#64748b' }}>Bank:</span>{' '}
                          {withdrawal.bankDetails?.bankName} — {withdrawal.bankDetails?.accountName} ({withdrawal.bankDetails?.accountNumber})
                        </p>
                        <p style={{ margin: '8px 0 0 0', fontSize: '13px' }}>
                          <span style={{
                            background: withdrawal.status === 'pending' ? '#78350f' : withdrawal.status === 'completed' ? '#14532d' : '#7f1d1d',
                            color: withdrawal.status === 'pending' ? '#fde68a' : withdrawal.status === 'completed' ? '#86efac' : '#fca5a5',
                            padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600'
                          }}>
                            {withdrawal.status}
                          </span>
                          <span style={{ color: '#64748b', fontSize: '12px', marginLeft: '12px' }}>
                            Requested {new Date(withdrawal.createdAt).toLocaleDateString()}
                          </span>
                        </p>
                      </div>

                      {withdrawal.status === 'pending' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
                          <button
                            onClick={() => handleWithdrawalMarkPaid(withdrawal.id)}
                            style={{ padding: '8px 14px', background: '#14532d', color: '#86efac', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                          >
                            Mark Paid
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}