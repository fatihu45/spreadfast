import Alert from '../components/ui/Alert';
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { apiCall, apiCallAuth } from '../utils/api';
import { Button, Card, EmptyState, PageHeader, PlatformBadge, SearchBar } from '../components/ui';
import UiIcon from '../components/ui/UiIcon';
import './AvailableCampaigns.css';
import CampaignDetails from '../components/CampaignDetails';

function CampaignThumbnail({ src, name }) {
  const [failedSrc, setFailedSrc] = useState(null);
  return <div className="marketplace-thumbnail">
    {src && failedSrc !== src ? <img src={src} alt={name || 'Campaign'} loading="lazy" onError={() => setFailedSrc(src)} /> : <UiIcon name="campaign" />}
  </div>;
}

export default function AvailableCampaigns() {
  const { user, token } = useContext(AuthContext);
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [filteredCampaigns, setFilteredCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [campaignAssets, setCampaignAssets] = useState({});
  const [subscribedCampaigns, setSubscribedCampaigns] = useState([]);
  const [downloadingAsset, setDownloadingAsset] = useState(null);
  const [expandedCampaignId, setExpandedCampaignId] = useState(null);

  const fetchAssetPreviews = async (campaignList) => {
    const assetMap = {};
    await Promise.all(
      campaignList.map(async (campaign) => {
        try {
          const data = await apiCall(`/api/campaigns/${campaign.id}/assets/preview`);
          if (data.success) {
            assetMap[campaign.id] = data.assets;
          }
        } catch (err) {
          console.error('Asset preview fetch failed for', campaign.id);
        }
      })
    );
    setCampaignAssets(assetMap);
  };

  // Calculate slots from budget
  const calculateSlots = (budget) => {
    const amount = parseFloat(budget) || 0;
    return Math.floor(amount / 5000) * 1;
  };

  // Get remaining slots
  const getRemainingSlots = (campaign) => {
    const totalSlots = calculateSlots(campaign.budget || campaign.amountPaid || 0);
    const subscribedCount = campaign.subscribedPromoters?.length || 0;
    return Math.max(0, totalSlots - subscribedCount);
  };

  useEffect(() => {
    if (user?.role !== 'promoter') {
      navigate('/');
      return;
    }
    fetchCampaigns();
  }, [user, navigate]);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const data = await apiCall('/api/campaigns');
      if (data.success) {
        // Filter to only active campaigns
        const activeCampaigns = data.campaigns.filter(c => c.status === 'active' || !c.status);
        setCampaigns(activeCampaigns);
        setFilteredCampaigns(activeCampaigns);
        await fetchAssetPreviews(activeCampaigns);
      }
    } catch (error) {
      console.error('Fetch error:', error);
      setError('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value) => {
    setSearchTerm(value);
    filterCampaigns(value, selectedPlatforms);
  };

  const handlePlatformFilter = (platform) => {
    const updatedPlatforms = selectedPlatforms.includes(platform)
      ? selectedPlatforms.filter(p => p !== platform)
      : [...selectedPlatforms, platform];
    setSelectedPlatforms(updatedPlatforms);
    filterCampaigns(searchTerm, updatedPlatforms);
  };

  const filterCampaigns = (search, platforms) => {
    let filtered = campaigns;

    // Search filter
    if (search.trim()) {
      filtered = filtered.filter(c =>
        (c.title || c.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.description || c.caption || '').toLowerCase().includes(search.toLowerCase())
      );
    }

    // Platform filter
    if (platforms.length > 0) {
      filtered = filtered.filter(c => {
        const campaignPlatforms = c.socialMediaPlatforms || [];
        return platforms.some(p => campaignPlatforms.includes(p));
      });
    }

    setFilteredCampaigns(filtered);
  };

  const handleDownloadAsset = async (campaignId, assetId, fileName) => {
    if (!token) {
      setError('You must be logged in to download assets');
      return;
    }

    try {
      setDownloadingAsset(assetId);
      const data = await apiCallAuth(
        `/api/campaigns/${campaignId}/assets/${assetId}/download`,
        token
      );

      if (data.success) {
        // Trigger browser download
        const link = document.createElement('a');
        link.href = data.download_url;
        link.download = data.file_name || fileName;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        setError(data.message || 'Failed to download asset');
        setTimeout(() => setError(''), 3000);
      }
    } catch (err) {
      console.error('Download error:', err);
      setError('Failed to download asset');
      setTimeout(() => setError(''), 3000);
    } finally {
      setDownloadingAsset(null);
    }
  };

  const handleSubscribeCampaign = async (campaignId) => {
    if (!token) {
      setError('You must be logged in to subscribe');
      return;
    }

    try {
      const data = await apiCallAuth(
        `/api/campaigns/${campaignId}/subscribe`,
        token,
        { method: 'POST' }
      );

      if (data.success) {
        setSuccessMessage('Successfully subscribed to campaign! You can now download brand assets.');
        setSubscribedCampaigns(prev => [...prev, campaignId]);
        fetchCampaigns();
        await fetchAssetPreviews([{ id: campaignId }]);
        setTimeout(() => setSuccessMessage(''), 4000);
      } else {
        setError(data.message || 'Failed to subscribe');
      }
    } catch (error) {
      console.error('Subscription error:', error);
      setError('Failed to subscribe to campaign');
    }
  };

  if (loading) {
    return <section className="campaign-marketplace" aria-busy="true"><PageHeader title="Available Campaigns" description="Find campaigns that match your style and audience." /><Card className="marketplace-loading" role="status">Loading campaigns...</Card></section>;
  }

  return <section className="campaign-marketplace" aria-label="Campaign marketplace">
    <PageHeader title="Available Campaigns" description="Find campaigns that match your style and audience." />
    {error && <Alert tone="error">{error}</Alert>}
    {successMessage && <Alert tone="success">{successMessage}</Alert>}

    <SearchBar value={searchTerm} onChange={event => handleSearch(event.target.value)} onClear={() => handleSearch('')} placeholder="Search campaigns..." />
    <div className="marketplace-filters" role="group" aria-label="Filter by platform">
      <Button size="sm" variant="ghost" aria-pressed={selectedPlatforms.length === 0}
        onClick={() => { setSelectedPlatforms([]); filterCampaigns(searchTerm, []); }}>All</Button>
      {[
        { key: 'tiktok', label: 'TikTok' }, { key: 'instagram', label: 'Instagram' },
        { key: 'youtube', label: 'YouTube' }, { key: 'twitter', label: 'X (Twitter)' },
        { key: 'facebook', label: 'Facebook' },
      ].map(platform => <Button key={platform.key} size="sm" variant="ghost" aria-pressed={selectedPlatforms.includes(platform.key)}
        onClick={() => handlePlatformFilter(platform.key)}>{platform.label}</Button>)}
    </div>
    <p className="marketplace-results" aria-live="polite">{filteredCampaigns.length} {filteredCampaigns.length === 1 ? 'campaign' : 'campaigns'} available</p>

    <div className="marketplace-list">
      {filteredCampaigns.length === 0 ? <Card><EmptyState title="No campaigns found" description="Try adjusting your filters or check back later." /></Card>
        : filteredCampaigns.map(campaign => {
          const totalSlots = calculateSlots(campaign.budget || campaign.amountPaid || 0);
          const subscribedCount = campaign.subscribedPromoters?.length || 0;
          const remainingSlots = getRemainingSlots(campaign);
          const assets = campaignAssets[campaign.id] || [];
          const thumbnail = assets.find(asset => asset.file_type === 'image' && asset.url)?.url
            || campaign.brandAssets?.find(asset => asset.fileType?.startsWith('image/'))?.fileUrl;
          const name = campaign.title || campaign.name;
          const isSubscribed = campaign.subscribedPromoters?.some(promoter => promoter.promoterId === user?.id);
          const expanded = expandedCampaignId === campaign.id;
          const panelId = 'marketplace-details-' + campaign.id;
          return <Card as="article" key={campaign.id} className={"marketplace-card" + (expanded ? " marketplace-card--expanded" : "")}>
            <div className="marketplace-card-summary">
              <CampaignThumbnail src={thumbnail} name={name} />
              <div className="marketplace-card-copy">
                {campaign.companyName && campaign.companyName !== name && <p className="marketplace-business-name">{campaign.companyName}</p>}
                <h2 id={'marketplace-title-' + campaign.id}>{name}</h2>
                <p className="marketplace-description">{campaign.description || campaign.caption}</p>
                <div className="marketplace-card-meta">
                  {campaign.socialMediaPlatforms?.length > 0 && <div className="sf-platform-list">{campaign.socialMediaPlatforms.map(platform => <PlatformBadge key={platform} platform={platform} />)}</div>}
                  <div className="marketplace-budget"><span>Campaign budget</span><strong>{campaign.budget ? '\u20a6' + parseFloat(campaign.budget).toLocaleString() : 'N/A'}</strong></div>
                  <p className={'marketplace-slots' + (remainingSlots === 0 ? ' marketplace-slots--full' : '')}>{remainingSlots} creator {remainingSlots === 1 ? 'slot' : 'slots'} left</p>
                </div>
              </div>
              <Button size="sm" className="marketplace-view" aria-expanded={expanded} aria-controls={panelId}
                aria-label={(expanded ? 'Close ' : 'View ') + name}
                onClick={() => setExpandedCampaignId(expanded ? null : campaign.id)}>{expanded ? 'Close Campaign' : 'View Campaign'}</Button>
            </div>

            <div id={panelId} hidden={!expanded} className="marketplace-details" role="region" aria-labelledby={'marketplace-title-' + campaign.id}>
              {expanded && <CampaignDetails campaign={campaign} thumbnail={thumbnail} assets={assets}
                totalSlots={totalSlots} subscribedCount={subscribedCount} remainingSlots={remainingSlots}
                isSubscribed={isSubscribed} downloadingAsset={downloadingAsset}
                onClose={() => { setExpandedCampaignId(null); requestAnimationFrame(() => document.querySelector('#marketplace-title-' + campaign.id)?.closest('article')?.querySelector('.marketplace-view')?.focus()); }}
                onJoin={() => handleSubscribeCampaign(campaign.id)}
                onSubmit={() => navigate('/submit-proof?campaignId=' + campaign.id)}
                onDownload={asset => handleDownloadAsset(campaign.id, asset.id, asset.file_name)} />}
            </div>
          </Card>;
        })}
    </div>
  </section>;
}
