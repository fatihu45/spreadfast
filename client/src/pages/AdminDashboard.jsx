import SubmissionEvidence from '../components/SubmissionEvidence';
import AdminQuickAdsAnalytics from '../components/AdminQuickAdsAnalytics';
import { creatorEarning, hasCurrentPricing } from '../utils/campaignPricing';
import Alert from '../components/ui/Alert';
import React, { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { apiCallAuth } from '../utils/api';
import { Link } from 'react-router-dom';
import { AppShell, Badge, Button, Card, EmptyState, FormField, Input, PageHeader, PlatformBadge, UserAvatar } from '../components/ui';
import NavigationItems from '../components/ui/NavigationItems';
import UiIcon from '../components/ui/UiIcon';
import '../components/DashboardShell.css';
import './AdminDashboard.css';

const money = value => '\u20a6' + Number(value || 0).toLocaleString('en-NG');
const date = value => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleDateString() : 'Not available';
function Status({ value }) {
  const tone = ['active', 'approved', 'completed'].includes(value) ? 'success'
    : ['pending', 'paused'].includes(value) ? 'warning' : value === 'rejected' ? 'danger' : 'neutral';
  return <Badge tone={tone}>{value || 'Unknown'}</Badge>;
}
function Platforms({ values = [] }) {
  return <div className="sf-platform-list">{values.length ? values.map(platform => <PlatformBadge key={platform} platform={platform} />) : <span className="sf-muted">Not specified</span>}</div>;
}
function Detail({ label, children }) {
  return <div><dt>{label}</dt><dd>{children}</dd></div>;
}

export default function AdminDashboard() {
  const { user, token, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleExitAdmin = () => {
    logout();
    navigate('/login');
  };

  const [activeTab, setActiveTab] = useState('overview');
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

  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const [campaignsData, submissionsData, withdrawalsData] = await Promise.all([
        apiCallAuth('/api/admin/campaigns', token),
        apiCallAuth('/api/admin/submissions', token),
        apiCallAuth('/api/admin/withdrawals', token)
      ]);

      if (campaignsData.success) setCampaigns(campaignsData.campaigns || []);
      if (submissionsData.success) setSubmissions(submissionsData.submissions || []);
      if (withdrawalsData.success) setWithdrawals(withdrawalsData.withdrawals || []);

    } catch (err) {
      setError('Failed to load admin data');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (activeTab !== 'overview' && activeTab !== 'quick-ads') fetchAllData();
  }, [activeTab, fetchAllData]);

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

  const navigation = [
    ['overview', 'Overview', 'home'], ['campaigns', 'Campaigns', 'campaign'],
    ['submissions', 'Submissions', 'globe'], ['withdrawals', 'Withdrawals', 'wallet'],
    ['quick-ads', 'Payments & Usage', 'video'],
  ].map(([id, label, icon]) => ({ id, label, icon: <UiIcon name={icon} />, active: activeTab === id, onClick: () => setActiveTab(id) }));
  const footerItems = [
    { id: 'settings', label: 'Settings', disabled: true, title: 'Settings are not available yet', icon: <UiIcon name="settings" /> },
    { id: 'exit', label: 'Exit Admin', onClick: handleExitAdmin, icon: <UiIcon name="logout" /> },
  ];
  const titles = {
    overview: ["Business overview", "Customers, credit sales and AI generation health."],
    campaigns: ['Campaigns', 'Legacy creator campaigns. Kept for historical records and outstanding work.'],
    submissions: ['Submissions', 'Review creator content and approve campaign earnings.'],
    withdrawals: ['Withdrawals', 'Review requests and keep payment statuses up to date.'],
    'quick-ads': ['Payments & Usage', 'Shared credits across Quick Ad, Fashion Studio and AI Commercial.'],
  };
  return <AppShell className="sf-dashboard-shell sf-admin" navigation={navigation}
    brand={<Link to="/" className="sf-dashboard-logo" aria-label="SpreadFast home"><img src="/spreadfast-logo.png" width="2172" height="724" alt="SpreadFast" /></Link>}
    sidebarFooter={<NavigationItems items={footerItems} />}
    header={<>
      <div className="sf-dashboard-account"><span className="sf-dashboard-account__copy"><strong>{user?.name || 'Admin'}</strong><span>Administrator</span></span><UserAvatar name={user?.name || 'Admin'} /></div>
      <details className="sf-dashboard-more"><summary aria-label="Admin actions"><UiIcon name="more" /></summary><div className="sf-dashboard-more__menu"><NavigationItems items={footerItems} /></div></details>
    </>}>
    <PageHeader title={<>{titles[activeTab][0]}{activeTab === 'overview' && <UiIcon name="sun" />}</>} description={titles[activeTab][1]} />
    {error && <Alert tone="error">{error}</Alert>}
    {success && <Alert tone="success">{success}</Alert>}
    {['overview', 'quick-ads'].includes(activeTab) ? <AdminQuickAdsAnalytics details={activeTab === 'quick-ads'} /> : loading ? <Card className="sf-admin-loading" role="status" aria-busy="true"><UiIcon name="campaign" /><p>Loading admin dashboard...</p></Card> : <>
      {activeTab === 'campaigns' && <section aria-label="Campaign management" className="sf-stack">
        <p className="sf-small sf-muted">{campaigns.length} campaigns</p>
        {campaigns.length === 0 && <Card><EmptyState title="No campaigns found." description="Campaigns will appear here when businesses create them." /></Card>}
        {campaigns.map(campaign => <Card as="article" key={campaign._id || campaign.id}>
          <div className="sf-admin-record-heading"><h2 className="sf-heading">{campaign.title || campaign.name || 'Untitled Campaign'}</h2><Status value={campaign.status} /></div>
          <p className="sf-admin-description sf-small sf-muted">{campaign.description || 'No description provided.'}</p>
          <dl className="sf-admin-details"><Detail label="Budget">{money(campaign.budget)}</Detail>{hasCurrentPricing(campaign) && <><Detail label="Platform share (25%)">{money(campaign.pricing.platformAmount)}</Detail><Detail label="Creator pool">{money(campaign.pricing.creatorPool)}</Detail></>}<Detail label="Platforms"><Platforms values={campaign.socialMediaPlatforms || []} /></Detail><Detail label="Promoters subscribed">{(campaign.subscribedPromoters || []).length}</Detail><Detail label="Created">{date(campaign.createdAt)}</Detail></dl>
          <div className="sf-admin-actions">
            {campaign.status === 'active' && <Button variant="secondary" className="sf-admin-pause" onClick={() => handleCampaignStatusChange(campaign.id, 'paused')}>Pause</Button>}
            {campaign.status === 'paused' && <Button onClick={() => handleCampaignStatusChange(campaign.id, 'active')}>Resume</Button>}
            <Button variant="ghost" className="sf-admin-destructive" onClick={() => handleDeleteCampaign(campaign.id)} aria-label={'Delete ' + (campaign.title || campaign.name || 'campaign')}>Delete</Button>
          </div>
        </Card>)}
      </section>}
      {activeTab === 'submissions' && <section aria-label="Submission review" className="sf-stack">
        <p className="sf-small sf-muted">{submissions.length} submissions</p>
        {submissions.length === 0 && <Card><EmptyState title="No submissions found." description="Creator submissions will appear here for review." /></Card>}
        {submissions.map(submission => <Card as="article" key={submission._id || submission.id}>
          <div className="sf-admin-record-heading"><div><h2 className="sf-heading">{submission.userName || 'Unknown Promoter'}</h2><p className="sf-small sf-muted">{submission.campaignName || submission.campaignId}</p></div><Status value={submission.status} /></div>
          <p className="sf-admin-description sf-small">{submission.proofDescription || 'No proof description provided.'}</p>
          <dl className="sf-admin-details"><Detail label="Platforms"><Platforms values={submission.platforms || []} /></Detail><Detail label="Submitted">{date(submission.createdAt)}</Detail>
            <Detail label="Proof URL"><SubmissionEvidence submission={submission} /></Detail>
            {submission.approvalAmount > 0 && <Detail label="Approved amount">{money(submission.approvalAmount)}</Detail>}
          </dl>
          {submission.status === 'pending' && <div className="sf-admin-actions"><Button onClick={() => setApprovalForm({ submissionId: submission.id, approvalAmount: creatorEarning(campaigns.find(c => c.id === submission.campaignId) || submission) ?? 5000, visible: true })}>Approve</Button><Button variant="ghost" className="sf-admin-destructive" onClick={() => handleSubmissionReject(submission.id)}>Reject</Button></div>}
          {approvalForm.visible && approvalForm.submissionId === submission.id && <div className="sf-admin-approval">
            <FormField label="Approval Amount (&#8358;)" id={'approval-' + submission.id}><Input type="number" readOnly={hasCurrentPricing(campaigns.find(c => c.id === submission.campaignId) || submission)} value={approvalForm.approvalAmount} onChange={e => setApprovalForm({ ...approvalForm, approvalAmount: e.target.value })} /></FormField>
            <div className="sf-admin-actions"><Button onClick={() => handleSubmissionApproval(submission.id, approvalForm.approvalAmount)}>Confirm Approval</Button><Button variant="secondary" onClick={() => setApprovalForm({ submissionId: null, approvalAmount: 0, visible: false })}>Cancel</Button></div>
          </div>}
        </Card>)}
      </section>}
      {activeTab === 'withdrawals' && <section aria-label="Withdrawal requests" className="sf-stack">
        <p className="sf-small sf-muted">{withdrawals.length} withdrawal requests</p>
        {withdrawals.length === 0 && <Card><EmptyState title="No withdrawal requests found." description="Withdrawal requests will appear here when submitted." /></Card>}
        {withdrawals.map(withdrawal => <Card as="article" key={withdrawal._id || withdrawal.id}>
          <div className="sf-admin-record-heading"><div><h2 className="sf-heading">{withdrawal.promoterName || withdrawal.userName || 'Unknown'}</h2><p className="sf-small sf-muted">{withdrawal.email}</p></div><Status value={withdrawal.status} /></div>
          <dl className="sf-admin-details"><Detail label="Amount"><strong>{money(withdrawal.amount)}</strong></Detail><Detail label="Bank">{withdrawal.bankDetails?.bankName || 'Not provided'}</Detail><Detail label="Account name">{withdrawal.bankDetails?.accountName || 'Not provided'}</Detail><Detail label="Account number">{withdrawal.bankDetails?.accountNumber || 'Not provided'}</Detail><Detail label="Requested">{date(withdrawal.createdAt)}</Detail></dl>
          {withdrawal.status === 'pending' && <div className="sf-admin-actions"><Button onClick={() => handleWithdrawalMarkPaid(withdrawal.id)}>Mark as completed</Button></div>}
        </Card>)}
      </section>}
    </>}
  </AppShell>;
}
