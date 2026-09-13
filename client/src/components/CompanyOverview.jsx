import { creatorSlots } from '../utils/campaignPricing';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, CampaignStatusBadge, EmptyState, PageHeader, PlatformBadge, StatCard } from './ui';
import UiIcon from './ui/UiIcon';
import './CompanyOverview.css';

const money = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(value)) : 'Unavailable';
const date = value => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleDateString() : 'Date unavailable';
function CampaignImage({ src }) {
  const [failed, setFailed] = useState(null);
  return <div className="company-overview-image">{src && src !== failed ? <img src={src} alt="" loading="lazy" onError={() => setFailed(src)} /> : <UiIcon name="campaign" />}</div>;
}
export default function CompanyOverview({ user, campaigns, loadState, campaignSubmissions, submissionLoadStates, campaignAssets,
  expandedCampaignId, onToggleCampaign, onRetry }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const promoters = campaigns.flatMap(campaign => campaign.subscribedPromoters || []);
  const promoterCount = promoters.some(promoter => !promoter.promoterId) ? 'Unavailable' : new Set(promoters.map(promoter => promoter.promoterId)).size;
  const submissionsReady = campaigns.every(campaign => submissionLoadStates[campaign.id] === 'success');
  const submissionsFailed = campaigns.some(campaign => submissionLoadStates[campaign.id] === 'error');
  const submissionCount = submissionsReady ? campaigns.reduce((sum, campaign) => sum + (campaignSubmissions[campaign.id]?.length || 0), 0) : submissionsFailed ? 'Unavailable' : 'Loading...';
  const metric = value => loadState === 'success' ? value : loadState === 'error' ? 'Unavailable' : 'Loading...';
  return <>
    <PageHeader title={<>{greeting}{user?.name ? ', ' + user.name : ''} <span aria-hidden="true"><UiIcon name="sun" /></span></>} description="Here's what's happening with your campaigns." />
    <div className="company-overview-stats">
      <StatCard label="Active campaigns" value={metric(campaigns.filter(campaign => !campaign.status || campaign.status === 'active').length)} icon={<UiIcon name="campaign" />} />
      <StatCard label="Total promoters" value={metric(promoterCount)} icon={<UiIcon name="user" />} description="Unique creators across your campaigns" />
      <StatCard label="Total submissions" value={metric(submissionCount)} icon={<UiIcon name="campaign" />} />
    </div>
    <section id="company-campaigns" tabIndex={-1} className="company-overview-campaigns" aria-labelledby="company-campaigns-heading">
      <div className="company-overview-section-heading"><h2 id="company-campaigns-heading">Your campaigns</h2><span>{loadState === 'success' ? campaigns.length + ' total' : ''}</span></div>
      {loadState === 'loading' && <Card className="company-overview-loading" role="status">Loading campaigns...</Card>}
      {loadState === 'error' && <Card><EmptyState title="Campaigns could not be loaded" description="Try again to see your campaigns." action={<Button onClick={onRetry}>Retry</Button>} /></Card>}
      {loadState === 'success' && campaigns.length === 0 && <Card><EmptyState title="Your first campaign starts here" description="Connect with creators and introduce your business to more people." /></Card>}
      {loadState === 'success' && <div className="company-overview-list">{campaigns.map(campaign => {
        const expanded = expandedCampaignId === campaign.id;
        const assigned = campaign.subscribedPromoters?.length || 0;
        const slots = creatorSlots(campaign);
        const available = Math.max(0, slots - assigned);
        const assets = campaignAssets[campaign.id] || [];
        const image = assets.find(asset => asset.file_type === 'image' && asset.url)?.url || campaign.brandAssets?.find(asset => asset.fileType?.startsWith('image/'))?.fileUrl;
        const submissions = campaignSubmissions[campaign.id] || [];
        return <Card as="article" className="company-overview-campaign" key={campaign.id}>
          <div className="company-overview-campaign-summary">
            <CampaignImage src={image} />
            <div className="company-overview-campaign-copy"><h3>{campaign.title || 'Untitled Campaign'}</h3><p>{campaign.description}</p><div className="sf-platform-list">{campaign.socialMediaPlatforms?.map(platform => <PlatformBadge key={platform} platform={platform} />)}</div></div>
            <div className="company-overview-campaign-status"><CampaignStatusBadge status={campaign.status || 'active'} /><span>{assigned}/{slots} promoters assigned</span><span>{available} available</span></div>
            <div className="company-overview-campaign-budget"><span>Campaign budget</span><strong>{money(campaign.budget)}</strong></div>
            <Button size="sm" variant="ghost" aria-expanded={expanded} aria-controls={'company-details-' + campaign.id} aria-label={(expanded ? 'Close ' : 'View ') + (campaign.title || 'campaign')} onClick={() => onToggleCampaign(campaign.id)}>{expanded ? 'Close' : 'View details'}</Button>
          </div>
          {expanded && <div id={'company-details-' + campaign.id} className="company-overview-details">
            <div className="company-overview-brief"><h4>Campaign brief</h4><p>{campaign.description || 'No description provided.'}</p>{campaign.keyMessage && <><h4>Key message</h4><p>{campaign.keyMessage}</p></>}<p>Amount paid: <strong>{money(campaign.amountPaid)}</strong></p></div>
            {assets.length > 0 && <section><h4>Brand assets ({assets.length})</h4><div className="company-overview-assets">{assets.map((asset, index) => <div key={asset.id || index}>{asset.file_type === 'image' ? <img src={asset.url} alt={asset.file_name} loading="lazy" /> : asset.file_type === 'video' ? <video src={asset.url} controls preload="metadata" /> : <UiIcon name="campaign" />}<p>{asset.file_name}</p></div>)}</div></section>}
            <section><h4>Subscribed promoters ({assigned})</h4>{assigned === 0 ? <p>No promoters subscribed yet.</p> : <ul className="company-overview-roster">{campaign.subscribedPromoters.map((promoter, index) => <li key={promoter.promoterId || index}><strong>{promoter.promoterName || 'Promoter'}</strong><span>Subscribed: {date(promoter.subscribedAt)}</span></li>)}</ul>}</section>
            <section><h4>Proof submissions {submissionLoadStates[campaign.id] === 'success' ? '(' + submissions.length + ')' : ''}</h4>
              {submissionLoadStates[campaign.id] === 'error' ? <p role="alert">Submissions could not be loaded. <Button size="sm" variant="ghost" onClick={onRetry}>Retry</Button></p> : submissionLoadStates[campaign.id] !== 'success' ? <p role="status">Loading submissions...</p> : submissions.length === 0 ? <p>No submissions yet.</p> : <ul className="company-overview-submissions">{submissions.map(submission => <li key={submission.id}><div><strong>{submission.userName || submission.promoName || 'Promoter'}</strong><p>{submission.proofDescription}</p>{submission.status === 'approved' && submission.approvalAmount > 0 && <p>Approved: {money(submission.approvalAmount)}</p>}</div><CampaignStatusBadge status={submission.status || 'pending'} /></li>)}</ul>}
            </section>
          </div>}
        </Card>;
      })}</div>}
    </section>
    <Link to="/company#create-campaign" className="sf-control sf-button sf-button--primary company-overview-create">Create Campaign</Link>
    <Card className="company-overview-help"><span className="company-overview-help-icon"><UiIcon name="user" /></span><div><h2>Need help?</h2><p>Our team is here to support you.</p></div><a href="https://wa.me/+2349071023617" target="_blank" rel="noopener noreferrer" className="sf-control sf-button sf-button--secondary">Contact us</a></Card>
  </>;
}
