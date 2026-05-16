import React, { useState, useContext, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { apiCall, apiCallAuth } from '../utils/api';
import './CompanyDashboard.css';

export default function CompanyDashboard() {
  const { user, token, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  // Campaign Creation State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [socialMediaPlatforms, setSocialMediaPlatforms] = useState({
    tiktok: false,
    instagram: false,
    twitter: false,
    facebook: false,
    youtube: false
  });

  // Display State
  const [campaigns, setCampaigns] = useState([]);
  const [expandedCampaignId, setExpandedCampaignId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [campaignSubmissions, setCampaignSubmissions] = useState({});
  const [statusMessage, setStatusMessage] = useState('');

  // Polling ref — so we can stop it when done
  const pollingRef = useRef(null);

  const calculatePromoterSlots = (budgetAmount) => {
    const amount = parseFloat(budgetAmount) || 0;
    return Math.floor(amount / 2000) * 1;
  };

  const handleSocialMediaChange = (platform) => {
    setSocialMediaPlatforms(prev => ({
      ...prev,
      [platform]: !prev[platform]
    }));
  };

  const handleSelectAllSocialMedia = () => {
    const allSelected = Object.values(socialMediaPlatforms).every(v => v === true);
    const newState = {
      tiktok: !allSelected,
      instagram: !allSelected,
      twitter: !allSelected,
      facebook: !allSelected,
      youtube: !allSelected
    };
    setSocialMediaPlatforms(newState);
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopPolling();
  }, []);

  useEffect(() => {
    if (user?.role !== 'company') {
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
        const companyCampaigns = data.campaigns.filter(c => c.companyId === user?.id);
        setCampaigns(companyCampaigns);
        companyCampaigns.forEach(campaign => {
          fetchCampaignSubmissions(campaign.id);
        });
      }
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCampaignSubmissions = async (campaignId) => {
    try {
      const data = await apiCallAuth(
        `/api/campaigns/${campaignId}/submissions`,
        token
      );
      if (data.success) {
        setCampaignSubmissions(prev => ({
          ...prev,
          [campaignId]: data.submissions || []
        }));
      }
    } catch (error) {
      console.error('Error fetching submissions:', error);
    }
  };

  // Poll every 5 seconds to check if bank transfer has been confirmed
  const startPollingForCampaign = (reference, authToken, apiUrl) => {
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max

    setStatusMessage('⏳ Waiting for payment confirmation from your bank...');

    pollingRef.current = setInterval(async () => {
      attempts++;
      console.log(`Polling attempt ${attempts} for reference:`, reference);

      try {
        const res = await fetch(
          `${apiUrl}/api/payments/campaign-status/${reference}`,
          {
            headers: { 'Authorization': `Bearer ${authToken}` }
          }
        );

        const data = await res.json();
        console.log('Poll response:', data);

        if (data.success && data.campaignCreated) {
          stopPolling();
          setPaymentProcessing(false);
          setStatusMessage('');
          setSuccessMessage('🎉 Payment confirmed! Your campaign is now live to promoters.');
          setTitle('');
          setDescription('');
          setBudget('');
          setSocialMediaPlatforms({
            tiktok: false, instagram: false,
            twitter: false, facebook: false, youtube: false
          });
          fetchCampaigns();

        } else if (attempts >= maxAttempts) {
          stopPolling();
          setPaymentProcessing(false);
          setStatusMessage('');
          setError(
            'Payment is taking longer than expected. If you completed the transfer, ' +
            'your campaign will appear shortly. Contact support with reference: ' + reference
          );
        } else {
          setStatusMessage(
            `⏳ Waiting for bank confirmation... (${attempts * 5}s elapsed). ` +
            `Please complete your transfer if you have not already.`
          );
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 5000);
  };

  const handlePaymentAndCreateCampaign = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setStatusMessage('');

    if (!title || !budget) {
      setError('Campaign title and budget are required');
      return;
    }

    if (isNaN(budget) || parseFloat(budget) < 10000) {
      setError('Budget must be at least ₦10,000');
      return;
    }

    const selectedPlatforms = Object.keys(socialMediaPlatforms).filter(p => socialMediaPlatforms[p]);
    if (selectedPlatforms.length === 0) {
      setError('Please select at least one social media platform');
      return;
    }

    setPaymentProcessing(true);

    // Capture all values before popup opens
    const campaignTitle = title;
    const campaignDescription = description;
    const campaignBudget = parseFloat(budget);
    const campaignPlatforms = selectedPlatforms;
    const authToken = token || localStorage.getItem('token');
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';

    try {
      // Step 1: Initialize payment and save campaign data on backend
      const paymentInitResponse = await apiCallAuth(
        '/api/payments/initiate',
        authToken,
        {
          method: 'POST',
          body: JSON.stringify({
            amount: campaignBudget,
            campaignName: campaignTitle,
            description: campaignDescription,
            socialMediaPlatforms: campaignPlatforms
          })
        }
      );

      if (!paymentInitResponse.success) {
        setError(paymentInitResponse.message || 'Failed to initialize payment');
        setPaymentProcessing(false);
        return;
      }

      const paymentReference = paymentInitResponse.reference;

      // Step 2: Start polling BEFORE opening popup
      // This way bank transfer confirmation is caught even if popup closes
      startPollingForCampaign(paymentReference, authToken, apiUrl);

      // Step 3: Open Paystack popup
      const handler = window.PaystackPop.setup({
        key: process.env.REACT_APP_PAYSTACK_PUBLIC_KEY,
        email: user?.email || '',
        amount: campaignBudget * 100,
        ref: paymentReference,
        currency: 'NGN',

        onClose: () => {
          // Don't stop processing — polling continues in background
          // The user may have made the transfer before closing
          if (!pollingRef.current) {
            setPaymentProcessing(false);
            setStatusMessage('');
          }
        },

        onSuccess: (response) => {
          // Card payment — stop polling and create campaign directly
          stopPolling();
          createCampaignAfterPayment(
            response.reference,
            campaignTitle,
            campaignDescription,
            campaignBudget,
            campaignPlatforms,
            authToken,
            apiUrl
          );
        }
      });

      handler.openIframe();

    } catch (error) {
      console.error('Payment initialization error:', error);
      stopPolling();
      setError('Payment initialization failed. Please try again.');
      setPaymentProcessing(false);
    }
  };

  // For card payments — direct campaign creation
  const createCampaignAfterPayment = async (
    reference,
    campaignTitle,
    campaignDescription,
    campaignBudget,
    campaignPlatforms,
    authToken,
    apiUrl
  ) => {
    try {
      setPaymentProcessing(true);
      console.log('Creating campaign with reference:', reference);

      const res = await fetch(`${apiUrl}/api/campaigns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          title: campaignTitle,
          description: campaignDescription,
          budget: campaignBudget,
          socialMediaPlatforms: campaignPlatforms,
          reference
        })
      });

      const data = await res.json();
      console.log('Campaign creation response:', data);

      if (!res.ok) {
        throw new Error(data.message || 'Campaign creation failed');
      }

      setPaymentProcessing(false);
      setStatusMessage('');
      setSuccessMessage('🎉 Campaign created successfully! It is now live to promoters.');
      setTitle('');
      setDescription('');
      setBudget('');
      setSocialMediaPlatforms({
        tiktok: false, instagram: false,
        twitter: false, facebook: false, youtube: false
      });
      fetchCampaigns();

    } catch (err) {
      console.error('Campaign creation error:', err);
      setPaymentProcessing(false);
      setStatusMessage('');
      setError(
        'Payment was successful but campaign creation failed. ' +
        'Contact support with reference: ' + reference
      );
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-8">
            <span className="text-2xl font-bold text-green-700 cursor-default">
              SpreadFast
            </span>
            <div className="hidden md:flex gap-6">
              <Link to="/company" className="text-green-700 hover:text-green-800 font-semibold">
                Campaigns
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-700 font-medium">{user?.name}</span>
            <button
              onClick={handleLogout}
              className="bg-red-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-600 transition"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Campaign Management</h1>
          <p className="text-gray-600">Create campaigns and manage promoter subscriptions</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Campaign Creation Form */}
          <div className="lg:col-span-1">
            <form onSubmit={handlePaymentAndCreateCampaign} className="bg-white rounded-lg shadow-lg p-6 sticky top-24">
              <h2 className="text-xl font-bold text-gray-800 mb-6">Create Campaign</h2>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
                  {error}
                </div>
              )}

              {successMessage && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6 text-sm">
                  {successMessage}
                </div>
              )}

              {statusMessage && (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg mb-6 text-sm">
                  {statusMessage}
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-2">Campaign Title *</label>
                <input
                  type="text"
                  placeholder="e.g., Summer Sale"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500 text-sm"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-2">Description</label>
                <textarea
                  placeholder="Campaign details"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500 text-sm"
                ></textarea>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-2">Budget (NGN) *</label>
                <div className="flex items-center">
                  <span className="text-gray-700 font-semibold mr-2">₦</span>
                  <input
                    type="number"
                    placeholder="e.g., 50000"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    step="10000"
                    min="10000"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Minimum ₦10,000. You'll be charged this amount via Paystack.</p>
                {budget && (
                  <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm text-green-800">
                      <strong>Promoter Slots Available:</strong> {calculatePromoterSlots(budget)} slots
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      ₦2,000 = 1 slot (₦10,000 = 5 slots, ₦20,000 = 10 slots)
                    </p>
                  </div>
                )}
              </div>

              <div className="mb-8">
                <label className="block text-sm font-bold text-gray-700 mb-3">Required Social Media Platforms *</label>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="mb-3">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Object.values(socialMediaPlatforms).every(v => v === true)}
                        onChange={handleSelectAllSocialMedia}
                        className="w-4 h-4 text-green-700 rounded focus:ring-green-500"
                      />
                      <span className="ml-2 text-sm font-semibold text-gray-700">Select All Platforms</span>
                    </label>
                  </div>
                  <div className="border-t border-gray-300 pt-3 space-y-2">
                    {Object.entries({
                      tiktok: 'TikTok',
                      instagram: 'Instagram',
                      twitter: 'Twitter',
                      facebook: 'Facebook',
                      youtube: 'YouTube'
                    }).map(([key, label]) => (
                      <label key={key} className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={socialMediaPlatforms[key]}
                          onChange={() => handleSocialMediaChange(key)}
                          className="w-4 h-4 text-green-700 rounded focus:ring-green-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>⚠️ Fee Notice:</strong> A 7.5% campaign creation fee is charged on all payments. This fee covers platform operations.
                </p>
              </div>

              <button
                type="submit"
                disabled={paymentProcessing}
                className={`w-full py-3 px-6 rounded-lg font-bold text-white transition ${
                  paymentProcessing
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-green-700 hover:bg-green-800'
                }`}
              >
                {paymentProcessing ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block animate-spin">⌛</span>
                    Processing Payment...
                  </span>
                ) : (
                  'Pay & Create Campaign'
                )}
              </button>
            </form>
          </div>

          {/* Sidebar Info */}
          <div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-bold text-green-800 mb-4">How It Works</h3>
              <ol className="space-y-3 text-sm text-gray-700">
                <li><strong>1.</strong> Create your campaign with a title and budget</li>
                <li><strong>2.</strong> Pay securely via Paystack (bank transfer or card)</li>
                <li><strong>3.</strong> Your campaign goes live automatically after payment</li>
                <li><strong>4.</strong> Promoters submit proofs of promotion</li>
                <li><strong>5.</strong> Review and approve submissions</li>
              </ol>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-bold text-blue-800 mb-4">Payment Info</h3>
              <p className="text-sm text-gray-700 mb-3">
                We use <strong>Paystack</strong> for secure payments. Bank transfer and card are both supported.
              </p>
              <p className="text-xs text-gray-600">
                For bank transfers, your campaign goes live once your bank confirms the payment (usually 1–2 minutes).
              </p>
            </div>
          </div>
        </div>

        {/* Your Campaigns Section */}
        {campaigns.length > 0 && (
          <div className="mt-16">
            <h2 className="text-3xl font-bold text-gray-800 mb-8">Your Campaigns</h2>
            <div className="space-y-6">
              {campaigns.map(campaign => (
                <div
                  key={campaign?.id}
                  className="bg-white rounded-lg shadow-md hover:shadow-lg transition p-6 border-l-4 border-green-500"
                >
                  <div
                    onClick={() => setExpandedCampaignId(expandedCampaignId === campaign?.id ? null : campaign?.id)}
                    className="cursor-pointer flex justify-between items-start"
                  >
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-800 mb-2">{campaign?.title || 'Untitled Campaign'}</h3>
                      <p className="text-gray-600 text-sm mb-4">{campaign?.description || 'No description'}</p>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="bg-gray-50 p-3 rounded">
                          <p className="text-xs text-gray-600">Budget</p>
                          <p className="font-bold text-green-600">₦{parseFloat(campaign?.budget || 0).toLocaleString()}</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded">
                          <p className="text-xs text-gray-600">Paid</p>
                          <p className="font-bold text-gray-800">₦{parseFloat(campaign?.amountPaid || 0).toLocaleString()}</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded">
                          <p className="text-xs text-gray-600">Status</p>
                          <p className={`font-bold text-sm ${campaign?.status === 'active' ? 'text-green-600' : 'text-gray-600'}`}>
                            {campaign?.status || 'Active'}
                          </p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded">
                          <p className="text-xs text-gray-600">Submissions</p>
                          <p className="font-bold text-gray-800">{campaign?.submissions?.length || 0}</p>
                        </div>
                      </div>
                    </div>

                    <div className="ml-4 text-2xl">
                      {expandedCampaignId === campaign?.id ? '▼' : '▶'}
                    </div>
                  </div>

                  {expandedCampaignId === campaign?.id && (
                    <div className="mt-6 border-t border-gray-200 pt-6">
                      <div className="mb-6">
                        <h4 className="text-lg font-bold text-gray-800 mb-4">
                          Subscribed Promoters ({campaign?.subscribedPromoters?.length || 0})
                        </h4>

                        {campaign?.subscribedPromoters && campaign?.subscribedPromoters?.length > 0 ? (
                          <div className="space-y-3">
                            {campaign?.subscribedPromoters?.map((promoter, idx) => (
                              <div key={idx} className="bg-green-50 border border-green-200 rounded p-4 flex justify-between items-center">
                                <div>
                                  <p className="font-semibold text-gray-800">{promoter?.promoterName}</p>
                                  <p className="text-xs text-gray-600">
                                    Subscribed: {new Date(promoter?.subscribedAt).toLocaleDateString()}
                                  </p>
                                </div>
                                <span className="px-3 py-1 bg-green-200 text-green-800 rounded-full text-sm font-semibold">
                                  Active
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-600 text-sm">No promoters subscribed yet</p>
                        )}
                      </div>

                      {campaign?.submissions && campaign?.submissions?.length > 0 && (
                        <div>
                          <h4 className="text-lg font-bold text-gray-800 mb-4">
                            Proof Submissions ({campaign?.submissions?.length})
                          </h4>
                          <div className="space-y-3">
                            {campaign?.submissions?.map((submission) => (
                              <div key={submission?.id} className="bg-blue-50 border border-blue-200 rounded p-4">
                                <div className="flex justify-between items-start mb-2">
                                  <div>
                                    <p className="font-semibold text-gray-800">{submission?.promoName}</p>
                                    <p className="text-xs text-gray-600">{submission?.proofDescription}</p>
                                  </div>
                                  <span className={`px-3 py-1 rounded-full text-sm font-semibold text-white ${
                                    submission?.status === 'approved' ? 'bg-green-500' :
                                    submission?.status === 'rejected' ? 'bg-red-500' :
                                    'bg-yellow-500'
                                  }`}>
                                    {submission?.status?.toUpperCase() || 'PENDING'}
                                  </span>
                                </div>
                                {submission?.status === 'approved' && submission?.approvalAmount > 0 && (
                                  <p className="text-sm text-green-600 font-semibold">Approved: ₦{submission?.approvalAmount}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
