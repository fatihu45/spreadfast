import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { apiCall, apiCallAuth } from '../utils/api';
import './Pages.css';

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
    return <div className="min-h-screen flex items-center justify-center">Loading campaigns...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-8">
            <Link to="/" className="text-2xl font-bold text-green-700">
              SpreadFast
            </Link>
            <div className="hidden md:flex gap-6">
              <Link to="/promoter-dashboard" className="text-gray-700 hover:text-green-700 font-semibold">
                Dashboard
              </Link>
              <Link to="/available-campaigns" className="text-green-700 hover:text-green-800 font-semibold">
                Find Campaigns
              </Link>
              <Link to="/wallet" className="text-gray-700 hover:text-green-700 font-semibold">
                Wallet
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Page Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Available Campaigns</h1>
          <p className="text-gray-600">Browse and subscribe to campaigns that match your social media presence</p>
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
            {successMessage}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Filters Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-24">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Filters</h3>

              {/* Search */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Search</label>
                <input
                  type="text"
                  placeholder="Campaign name..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500"
                />
              </div>

              {/* Platform Filters */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Platforms</label>
                <div className="space-y-2">
                  {[
                    { key: 'tiktok', label: 'TikTok' },
                    { key: 'instagram', label: 'Instagram' },
                    { key: 'twitter', label: 'Twitter' },
                    { key: 'facebook', label: 'Facebook' },
                    { key: 'youtube', label: 'YouTube' }
                  ].map(platform => (
                    <label key={platform.key} className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedPlatforms.includes(platform.key)}
                        onChange={() => handlePlatformFilter(platform.key)}
                        className="w-4 h-4 text-green-700 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">{platform.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Results Count */}
              <div className="mt-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>Showing:</strong> {filteredCampaigns.length} campaign{filteredCampaigns.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Campaigns Grid */}
          <div className="lg:col-span-3">
            {filteredCampaigns.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <p className="text-xl text-gray-600 mb-4">No campaigns found</p>
                <p className="text-gray-500">Try adjusting your filters or check back later</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredCampaigns.map(campaign => {
                  const totalSlots = calculateSlots(campaign.budget || campaign.amountPaid || 0);
                  const subscribedCount = campaign.subscribedPromoters?.length || 0;
                  const remainingSlots = getRemainingSlots(campaign);
                  const progressPercent = (subscribedCount / totalSlots) * 100;

                  return (
                    <div key={campaign.id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition overflow-hidden">
                      {/* Card Header */}
                      <div className="bg-gradient-to-r from-green-500 to-green-600 p-4 text-white">
                        <h3 className="text-xl font-bold mb-1">{campaign.title || campaign.name}</h3>
                        <p className="text-green-100 text-sm line-clamp-1">{campaign.description || campaign.caption}</p>
                      </div>

                      {/* Card Body */}
                      <div className="p-6">
                        {/* Budget and Platforms */}
                        <div className="mb-4">
                          <p className="text-gray-700 font-semibold mb-2">
                            Budget: <span className="text-green-600">₦{campaign.budget ? parseFloat(campaign.budget).toLocaleString() : 'N/A'}</span>
                          </p>
                          {campaign.socialMediaPlatforms && campaign.socialMediaPlatforms.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3">
                              {campaign.socialMediaPlatforms.map(platform => (
                                <span key={platform} className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                                  {platform}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        {/* Description */}
                        {campaign.description && (
                          <p className="text-gray-600 text-sm mb-4 line-clamp-2">{campaign.description}</p>
                        )}

                        {/* Key Message */}
                        {campaign.keyMessage && (
                          <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded mb-4 text-sm">
                            <p className="font-semibold text-green-800 mb-1">📢 Key Message</p>
                            <p className="text-gray-700">{campaign.keyMessage}</p>
                          </div>
                        )}

                        {/* Brand Assets */}
                        {campaignAssets[campaign.id]?.length > 0 && (
                          <div className="mb-4">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-semibold text-gray-700">
                                Brand Assets ({campaignAssets[campaign.id].length})
                              </p>

                              {!campaign.subscribedPromoters?.some(p => p.promoterId === user?.id) && (
                                <span className="text-xs text-orange-600 font-medium">Subscribe to download</span>
                              )}
                            </div>

                            <div className="space-y-2">
                              {campaignAssets[campaign.id].map((asset, idx) => {
                                const isSubscribed = campaign.subscribedPromoters?.some(p => p.promoterId === user?.id);
                                const isDownloading = downloadingAsset === asset.id;
                                return (
                                  <div key={asset.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                                    {/* Thumbnail */}
                                    <div className="flex-shrink-0 w-10 h-10 rounded overflow-hidden bg-gray-200">
                                      {asset.file_type === 'image' ? (
                                        <img src={asset.url} alt={asset.file_name} className="w-full h-full object-cover" />
                                      ) : asset.file_type === 'video' ? (
                                        <div className="w-full h-full flex items-center justify-center bg-blue-100">
                                          🎬
                                        </div>
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-red-100">
                                          📄
                                        </div>
                                      )}
                                    </div>

                                    {/* File info */}
                                    <div className="flex-grow min-w-0">
                                      <p className="text-xs font-medium text-gray-700 truncate">{asset.file_name}</p>
                                      <p className="text-xs text-gray-500">{asset.file_type}</p>
                                    </div>

                                    {/* Download button */}
                                    {isSubscribed ? (
                                      <button
                                        onClick={() => handleDownloadAsset(campaign.id, asset.id, asset.file_name)}
                                        disabled={isDownloading}
                                        className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                                          isDownloading
                                            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                            : 'bg-green-600 text-white hover:bg-green-700'
                                        }`}
                                      >
                                        {isDownloading ? '⏳' : '⬇ Download'}
                                      </button>
                                    ) : (
                                      <span className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold text-gray-500 bg-gray-200 rounded-lg">
                                        🔒 Locked
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Promoter Slots Info */}
                        <div className="bg-gray-50 rounded-lg p-4 mb-4">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-semibold text-gray-700">Promoter Slots</span>
                            <span className="text-sm font-bold text-green-600">{subscribedCount}/{totalSlots}</span>
                          </div>

                          {/* Progress Bar */}
                          <div className="w-full bg-gray-300 rounded-full h-2 mb-3 overflow-hidden">
                            <div
                              className="bg-green-500 h-full transition-all duration-300"
                              style={{ width: `${progressPercent}%` }}
                            ></div>
                          </div>

                          {/* Remaining Slots */}
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <p className="text-gray-600">Promoters Joined</p>
                              <p className="font-bold text-gray-800">{subscribedCount}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Remaining Slots</p>
                              <p className={`font-bold ${remainingSlots > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {remainingSlots}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Subscribe Button */}
                        <button
                          onClick={() => handleSubscribeCampaign(campaign.id)}
                          disabled={remainingSlots === 0}
                          className={`w-full py-2 rounded-lg font-semibold transition mb-3 ${
                            remainingSlots === 0
                              ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                              : 'bg-green-600 text-white hover:bg-green-700'
                          }`}
                        >
                          {remainingSlots === 0 ? 'All Slots Filled' : 'Subscribe to Campaign'}
                        </button>

                        {/* Submit Proof Button */}
                        <button
                          onClick={() => navigate(`/submit-proof?campaignId=${campaign.id}`)}
                          className="w-full py-2 rounded-lg font-semibold transition bg-blue-600 text-white hover:bg-blue-700"
                        >
                          Submit Proof
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
