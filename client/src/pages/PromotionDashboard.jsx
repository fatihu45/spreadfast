import { creatorEarning, hasCurrentPricing } from '../utils/campaignPricing';
import Alert from '../components/ui/Alert';
import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { apiCallAuth, apiCall } from '../utils/api';
import { Button, Card, PageHeader, WalletBalanceCard, StatCard, CampaignCard, EmptyState } from '../components/ui';
import UiIcon from '../components/ui/UiIcon';
import './PromotionDashboard.css';

const RECENT_LIMIT = 3; // Display limit only; all totals come from API records.
const money = value => {
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '' || !Number.isFinite(Number(value))) return null;
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value));
};
const timestamp = value => Date.parse(value) || 0;
const isImage = asset => asset?.fileType?.startsWith('image/') || asset?.file_type === 'image';
const assetUrl = asset => asset?.fileUrl || asset?.cloudinary_url;

function MetricIcon({ approved = false }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {approved ? <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></> : <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 3h6v4H9zM9 12h6M9 16h4" /></>}
  </svg>;
}

function CampaignBrief({ campaign, assets }) {
  if (!campaign.description && !campaign.caption && !campaign.keyMessage && !assets.length) return null;
  return <details className="creator-campaign-brief">
    <summary>Campaign brief &amp; assets</summary>
    {(campaign.description || campaign.caption) && <p>{campaign.description || campaign.caption}</p>}
    {campaign.keyMessage && <p><strong>Key message</strong><br />{campaign.keyMessage}</p>}
    {assets.length > 0 && <div className="creator-campaign-assets">{assets.map((asset, index) => {
      const url = assetUrl(asset);
      return <div key={asset.id || url || index}>
        {isImage(asset) ? <a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={asset.fileName || asset.file_name || 'Campaign asset'} loading="lazy" /></a>
          : asset.fileType?.startsWith('video/') || asset.file_type === 'video' ? <video src={url} controls preload="none" />
          : <a href={url} target="_blank" rel="noopener noreferrer">{asset.fileName || asset.file_name || 'Open campaign asset'}</a>}
      </div>;
    })}</div>}
  </details>;
}

export default function PromotionDashboard() {
  const { user, token } = useContext(AuthContext);
  const navigate = useNavigate();
  const [data, setData] = useState({ wallet: null, campaigns: null, submissions: null });
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState([]);
  const [refresh, setRefresh] = useState(0);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (user?.role !== 'promoter') { navigate('/'); return; }
    let current = true;
    setLoading(true);
    setErrors([]);
    setData({ wallet: null, campaigns: null, submissions: null });
    async function load() {
      const results = await Promise.allSettled([
        apiCallAuth('/api/wallet', token),
        apiCall('/api/campaigns', { headers: { Authorization: `Bearer ${token}` } }),
        apiCallAuth('/api/submissions/my-submissions', token),
      ]);
      if (!current) return;
      const responses = results.map(result => result.status === 'fulfilled' && result.value?.success ? result.value : null);
      const wallet = money(responses[0]?.wallet?.balance) !== null ? responses[0].wallet : null;
      const campaigns = Array.isArray(responses[1]?.campaigns) ? responses[1].campaigns : null;
      const submissions = Array.isArray(responses[2]?.submissions) ? responses[2].submissions : null;
      setData({ wallet, campaigns, submissions });
      setErrors([!wallet && 'available earnings', !campaigns && 'campaigns', !submissions && 'submissions'].filter(Boolean));
      setLoading(false);
    }
    load();
    return () => { current = false; };
  }, [user?.id, user?.role, token, navigate, refresh]);

  const userId = user?.id == null ? null : String(user.id);
  const submissionsByCampaign = new Map();
  (data.submissions || []).forEach(submission => {
    const key = String(submission.campaignId);
    submissionsByCampaign.set(key, [...(submissionsByCampaign.get(key) || []), submission]);
  });
  // /api/campaigns is public: select this creator's memberships/history, never the entire catalog.
  const myCampaigns = data.campaigns && data.submissions && userId !== null ? data.campaigns.filter(campaign =>
    campaign.subscribedPromoters?.some(promoter => String(promoter.promoterId) === userId) || submissionsByCampaign.has(String(campaign.id))
  ).map(campaign => {
    const ownSubmissions = submissionsByCampaign.get(String(campaign.id)) || [];
    const subscription = campaign.subscribedPromoters?.find(promoter => String(promoter.promoterId) === userId);
    const activity = Math.max(timestamp(subscription?.subscribedAt), ...ownSubmissions.map(submission => timestamp(submission.createdAt)), timestamp(campaign.createdAt));
    return { campaign, ownSubmissions, activity };
  }).sort((a, b) => b.activity - a.activity) : null;
  const recentCampaigns = showAll ? myCampaigns : myCampaigns?.slice(0, RECENT_LIMIT);
  const approved = data.submissions?.filter(submission => submission.status === 'approved').length;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.trim().split(/\s+/)[0];
  const unavailable = 'Unavailable';

  return <section className="creator-dashboard" aria-label="Creator dashboard" aria-busy={loading}>
    <PageHeader title={<>{greeting}{firstName ? ', ' + firstName : ''} <span className="creator-greeting-wave" role="img" aria-label="Hello"><UiIcon name="sun" /></span></>}
      description="Here's what's happening with your campaigns." />

    {errors.length > 0 && <Alert tone="error">
      <p>We couldn't load your {errors.join(', ')}. Please try again.</p>
      <Button variant="secondary" size="sm" onClick={() => setRefresh(value => value + 1)}>Try again</Button>
    </Alert>}

    <WalletBalanceCard label="Available earnings" balance={money(data.wallet?.balance) ?? unavailable} loading={loading}
      action={<Link to="/wallet" className="sf-control sf-button sf-button--secondary creator-withdraw">Withdraw</Link>} />

    <div className="creator-dashboard-stats">
      <StatCard label="Campaigns" value={myCampaigns?.length ?? unavailable} loading={loading} icon={<UiIcon name="campaign" />} />
      <StatCard label="Submissions" value={data.submissions?.length ?? unavailable} loading={loading} icon={<MetricIcon />} />
      <StatCard label="Approved" value={approved ?? unavailable} loading={loading} icon={<MetricIcon approved />} />
    </div>

    <section className="creator-recent" aria-labelledby="creator-recent-title">
      <div className="creator-section-heading">
        <h2 id="creator-recent-title">{showAll ? 'Your campaigns' : 'Recent campaigns'}</h2>
        {myCampaigns?.length > RECENT_LIMIT
          ? <Button variant="ghost" size="sm" onClick={() => setShowAll(value => !value)} aria-expanded={showAll} aria-controls="creator-campaign-list">{showAll ? 'Show recent' : 'View all'}</Button>
          : <Link to="/available-campaigns" className="creator-text-link">Browse campaigns</Link>}
      </div>
      <div id="creator-campaign-list" className="creator-campaign-list">
        {loading ? <Card className="creator-list-message" role="status">Loading your campaigns...</Card>
          : !myCampaigns ? <Card><EmptyState title="Your campaigns couldn't be loaded" description="Try again to see your latest campaign activity." as="h3" action={<Button variant="secondary" onClick={() => setRefresh(value => value + 1)}>Try again</Button>} /></Card>
          : myCampaigns.length === 0 ? <Card><EmptyState title="Your next opportunity starts here" description="Join a campaign, create authentic content, and submit your post for review." as="h3" action={<Link to="/available-campaigns" className="sf-control sf-button sf-button--primary">Browse available campaigns</Link>} /></Card>
          : recentCampaigns.map(({ campaign, ownSubmissions }) => {
            const assets = (campaign.brandAssets || []).filter(asset => assetUrl(asset));
            const thumbnail = assets.find(isImage);
            const to = '/submit-proof?campaignId=' + encodeURIComponent(campaign.id);
            return <CampaignCard key={campaign.id} title={campaign.title || campaign.name || 'Untitled campaign'} status={campaign.status || 'unknown'}
              imageSrc={assetUrl(thumbnail)} platforms={Array.isArray(campaign.socialMediaPlatforms) ? [...new Set(campaign.socialMediaPlatforms)] : []}
              budget={money(hasCurrentPricing(campaign) ? creatorEarning(campaign) : campaign.budget) ?? unavailable} budgetLabel={hasCurrentPricing(campaign) ? "Your earning per campaign" : "Campaign budget"} to={to}
              metadata={<><p>{ownSubmissions.length} {ownSubmissions.length === 1 ? 'submission' : 'submissions'}</p><CampaignBrief campaign={campaign} assets={assets} /></>}
              actions={<Link to={to} className="creator-text-link">Submit proof <span aria-hidden="true"><UiIcon name="arrow" /></span></Link>} />;
          })}
      </div>
    </section>

    <details className="creator-earning-guide">
      <summary>How earning works</summary>
      <p>Join a campaign that fits your style. Use the campaign brief and brand assets to create your content, then submit your post for review.</p>
      <p>Check your submissions for approval updates. Your available earnings appear in your wallet, where you can manage your bank details and request a withdrawal.</p>
      <div><Link to="/submit-proof" className="creator-text-link">View your submissions</Link><Link to="/wallet" className="creator-text-link">Manage wallet &amp; withdrawals</Link></div>
    </details>
  </section>;
}
