import { Alert, Button } from '../components/ui';
import { pollCampaign } from '../utils/pollCampaign';
import { newCreatorCount, isValidCampaignBudget } from '../utils/campaignPricing';
import React, { useState, useContext, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { apiCall, apiCallAuth } from '../utils/api';
import './CompanyDashboard.css';
import CompanyOverview from '../components/CompanyOverview';
import BusinessCreateCampaign, { buildCampaignBrief, emptyCampaignBrief } from '../components/BusinessCreateCampaign';

export default function CompanyDashboard() {
  const { user, token } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  // Campaign Creation State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [campaignBrief, setCampaignBrief] = useState(emptyCampaignBrief);
  const [keyMessage, setKeyMessage] = useState('');
  const [budget, setBudget] = useState('');
  const [brandAssetFiles, setBrandAssetFiles] = useState([]); // Array of File objects
  const [brandAssetPreviews, setBrandAssetPreviews] = useState([]); // Array of {file, preview, error}
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
  const [campaignAssets, setCampaignAssets] = useState({});
  const [assetRetry, setAssetRetry] = useState(null);
  const [retryingAssets, setRetryingAssets] = useState(false);
  const [campaignLoadState, setCampaignLoadState] = useState('loading');
  const [submissionLoadStates, setSubmissionLoadStates] = useState({});


  // Polling ref — so we can stop it when done
  const pollingRef = useRef(null);
  const settlementStarted = useRef(false);
  const assetPreviewsRef = useRef([]);

  const calculatePromoterSlots = newCreatorCount;

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

  const handleBrandAssetFiles = (e) => {
    const files = Array.from(e.target.files || []);
    const allowedFormats = ['image/jpeg', 'image/png', 'video/mp4', 'application/pdf'];
    const maxFileSize = 20 * 1024 * 1024; // 20MB
    const maxFiles = 10;

    // Check total file count
    if (brandAssetFiles.length + files.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed. You currently have ${brandAssetFiles.length}.`);
      return;
    }

    const newPreviews = [];
    const validFiles = [];

    files.forEach(file => {
      let error = null;

      // Validate file format
      if (!allowedFormats.includes(file.type)) {
        error = 'Invalid format. Only JPG, PNG, MP4, PDF allowed.';
      }
      // Validate file size
      else if (file.size > maxFileSize) {
        error = 'File exceeds 20MB limit.';
      }

      let preview = null;
      if (!error) {
        // Create preview URL
        if (file.type.startsWith('image/')) {
          preview = URL.createObjectURL(file);
        } else if (file.type === 'video/mp4') {
          preview = URL.createObjectURL(file);
        }
        validFiles.push(file);
      }

      newPreviews.push({ file, preview, error });
    });

    setBrandAssetFiles(prev => [...prev, ...validFiles]);
    setBrandAssetPreviews(prev => [...prev, ...newPreviews]);
    setError(''); // Clear any previous errors
  };

  const removeBrandAsset = (index) => {
    // Clean up object URLs
    if (brandAssetPreviews[index]?.preview) {
      URL.revokeObjectURL(brandAssetPreviews[index].preview);
    }
    
    const validIndex = brandAssetPreviews.slice(0, index).filter(item => !item.error).length;
    if (!brandAssetPreviews[index]?.error) {
      setBrandAssetFiles(prev => prev.filter((_, i) => i !== validIndex));
    }
    setBrandAssetPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      pollingRef.current();
      pollingRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopPolling();
  }, []);

  useEffect(() => {
    const retained = new Set(brandAssetPreviews.map(item => item.preview));
    assetPreviewsRef.current.forEach(item => { if (item.preview && !retained.has(item.preview)) URL.revokeObjectURL(item.preview); });
    assetPreviewsRef.current = brandAssetPreviews;
  }, [brandAssetPreviews]);
  useEffect(() => () => {
    assetPreviewsRef.current.forEach(item => { if (item.preview) URL.revokeObjectURL(item.preview); });
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
      setCampaignLoadState('loading');
      const data = await apiCall('/api/campaigns');
      if (data.success) {
        const companyCampaigns = data.campaigns.filter(c => c.companyId === user?.id);
        setCampaigns(companyCampaigns);
        setCampaignLoadState('success');
        companyCampaigns.forEach(campaign => {
          fetchCampaignSubmissions(campaign.id);
          fetchCampaignAssets(campaign.id);
        });
      } else { setCampaignLoadState('error'); }
    } catch (error) {
      setCampaignLoadState('error');
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCampaignSubmissions = async (campaignId) => {
    setSubmissionLoadStates(prev => ({ ...prev, [campaignId]: 'loading' }));
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
        setSubmissionLoadStates(prev => ({ ...prev, [campaignId]: 'success' }));
      } else { setSubmissionLoadStates(prev => ({ ...prev, [campaignId]: 'error' })); }
    } catch (error) {
      setSubmissionLoadStates(prev => ({ ...prev, [campaignId]: 'error' }));
      console.error('Error fetching submissions:', error);
    }
  };

  const fetchCampaignAssets = async (campaignId) => {
  try {
    const data = await apiCallAuth(`/api/campaigns/${campaignId}/assets`, token);
    if (data.success) {
      setCampaignAssets(prev => ({ ...prev, [campaignId]: data.assets }));
    }
  } catch (err) {
    console.error('Failed to fetch assets:', err);
  }
  };

  const uploadBrandAssets = async (campaignId, files, authToken) => {
    if (!files || files.length === 0) {
      return { success: true }; // No assets to upload
    }

    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });

      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiUrl}/api/campaigns/${campaignId}/assets/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        console.error('Asset upload error:', data.message);
        return { success: false, message: data.message };
      }

      return data;
    } catch (error) {
      console.error('Brand assets upload error:', error);
      return { success: false, message: error.message };
    }
  };

  const finishCampaign = async (campaign, authToken) => {
    setStatusMessage('');
    if (brandAssetFiles.length) {
      const uploaded = await uploadBrandAssets(campaign.id, brandAssetFiles, authToken);
      if (!uploaded.success) {
        setAssetRetry({ campaignId: campaign.id, files: brandAssetFiles, authToken });
        setError('Your campaign is live, but its assets were not uploaded. ' + (uploaded.message || 'Please retry the upload below.'));
      } else {
        setBrandAssetFiles([]); setBrandAssetPreviews([]); setAssetRetry(null);
      }
    }
    setSuccessMessage('Payment confirmed. Your campaign is now live.');
    setTitle(''); setDescription(''); setCampaignBrief(emptyCampaignBrief); setKeyMessage(''); setBudget('');
    setSocialMediaPlatforms({tiktok: false, instagram: false, twitter: false, facebook: false, youtube: false});
    setPaymentProcessing(false); fetchCampaigns();
  };

  const retryAssetUpload = async () => {
    if (!assetRetry || retryingAssets) return;
    setRetryingAssets(true);
    try {
      const result = await uploadBrandAssets(assetRetry.campaignId, assetRetry.files, assetRetry.authToken);
      if (result.success) {
        setAssetRetry(null); setBrandAssetFiles([]); setBrandAssetPreviews([]); setError('');
        setSuccessMessage('Campaign assets uploaded successfully.'); fetchCampaigns();
      } else setError('Campaign assets could not be uploaded. ' + (result.message || 'Please retry.'));
    } finally { setRetryingAssets(false); }
  };

  const startPollingForCampaign = (reference, authToken) => {
    stopPolling();
    setStatusMessage('Waiting for payment confirmation from your bank...');
    pollingRef.current = pollCampaign({
      check: () => apiCallAuth('/api/payments/campaign-status/' + encodeURIComponent(reference), authToken),
      onConfirmed: async campaign => { pollingRef.current = null; if (settlementStarted.current) return; settlementStarted.current = true; await finishCampaign(campaign, authToken); },
      onExpired: () => {
        pollingRef.current = null; setPaymentProcessing(false); setStatusMessage('');
        setError('Payment confirmation is taking longer than expected. If you have paid, do not pay again. Contact support with reference: ' + reference);
      },
      onProgress: seconds => setStatusMessage('Waiting for bank confirmation... (' + seconds + 's elapsed).')
    });
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

    if (!isValidCampaignBudget(budget)) {
      setError('Budget must be a multiple of ₦20,000 (one promoter)');
      return;
    }

    if (!keyMessage || keyMessage.trim() === '') {
      setError('Key message is required');
      return;
    }

    const selectedPlatforms = Object.keys(socialMediaPlatforms).filter(p => socialMediaPlatforms[p]);
    if (selectedPlatforms.length === 0) {
      setError('Please select at least one social media platform');
      return;
    }

    setPaymentProcessing(true);

    settlementStarted.current = false;
    // Capture all values before popup opens
    const campaignTitle = title;
    const campaignDescription = buildCampaignBrief(description, campaignBrief);
      const campaignKeyMessage = keyMessage;
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
              keyMessage: campaignKeyMessage,
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
      const paystackPublicKey = paymentInitResponse.publicKey;

      // Step 2: Start polling BEFORE opening popup
      // This way bank transfer confirmation is caught even if popup closes
      startPollingForCampaign(paymentReference, authToken, apiUrl);

      // Step 3: Open Paystack popup
      const handler = window.PaystackPop.setup({
        key: paystackPublicKey,
        email: user?.email || '',
        amount: campaignBudget * 100,
        ref: paymentReference,
        currency: 'NGN',

        onClose: function () {
          // Don't stop processing — polling continues in background
          // The user may have made the transfer before closing
          if (!pollingRef.current) {
            setPaymentProcessing(false);
            setStatusMessage('');
          }
        },

        callback: function (response) {
          if (settlementStarted.current) return;
          settlementStarted.current = true;
          // Card payment — stop polling and create campaign directly
          stopPolling();
          createCampaignAfterPayment(
            response.reference,
            campaignTitle,
            campaignDescription,
            campaignKeyMessage,
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
    campaignKeyMessage,
    campaignBudget,
    campaignPlatforms,
    authToken,
    apiUrl
  ) => {
    try {
      setPaymentProcessing(true);
      console.log('Creating campaign with reference:', reference);

      const data = await apiCallAuth('/api/campaigns', authToken, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          title: campaignTitle,
          description: campaignDescription,
          keyMessage: campaignKeyMessage,
          budget: campaignBudget,
          socialMediaPlatforms: campaignPlatforms,
          reference
        })
      });

      if (!data.success) {
        throw new Error(data.message || 'Campaign creation failed');
      }

      if (!data.success || !data.campaign?.id) throw new Error('Campaign confirmation is incomplete');
      await finishCampaign(data.campaign, authToken);

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

  const creationOpen = location.hash === '#create-campaign' || paymentProcessing;
  return <section className="company-overview-page">
    {error && <Alert tone="error">{error}</Alert>}
    {successMessage && <Alert tone="success">{successMessage}</Alert>}
    {statusMessage && <Alert>{statusMessage}</Alert>}
    {assetRetry && <Button disabled={retryingAssets} onClick={retryAssetUpload}>{retryingAssets ? 'Uploading...' : 'Retry asset upload'}</Button>}
    <div hidden={creationOpen}>
      <CompanyOverview user={user} campaigns={campaigns} loadState={campaignLoadState}
        campaignSubmissions={campaignSubmissions} submissionLoadStates={submissionLoadStates} campaignAssets={campaignAssets}
        expandedCampaignId={expandedCampaignId} onToggleCampaign={id => setExpandedCampaignId(expandedCampaignId === id ? null : id)}
        onRetry={fetchCampaigns} />
    </div>
    <section className="company-create-section" hidden={!creationOpen} aria-label="Create campaign">
      <Link to="/company" className="company-create-back">&larr; Back to overview</Link>
      <BusinessCreateCampaign values={{ title, description, keyMessage, budget, socialMediaPlatforms }}
        onChange={(field, value) => ({ title: setTitle, description: setDescription, keyMessage: setKeyMessage, budget: setBudget })[field](value)}
        brief={campaignBrief} onBriefChange={(field, value) => setCampaignBrief(prev => ({ ...prev, [field]: value }))}
        onPlatformChange={handleSocialMediaChange} onSelectAllPlatforms={handleSelectAllSocialMedia}
        assets={brandAssetPreviews} assetCount={brandAssetFiles.length} onAssetChange={handleBrandAssetFiles} onRemoveAsset={removeBrandAsset}
        creatorCount={calculatePromoterSlots(budget)} onPayment={handlePaymentAndCreateCampaign}
        paymentProcessing={paymentProcessing} success={successMessage} />
    </section>
  </section>;
}
