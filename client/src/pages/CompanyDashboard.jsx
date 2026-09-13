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
  const [campaignLoadState, setCampaignLoadState] = useState('loading');
  const [submissionLoadStates, setSubmissionLoadStates] = useState({});


  // Polling ref — so we can stop it when done
  const pollingRef = useRef(null);
  const assetPreviewsRef = useRef([]);

  const calculatePromoterSlots = (budgetAmount) => {
    const amount = parseFloat(budgetAmount) || 0;
    return Math.floor(amount / 5000) * 1;
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
      clearInterval(pollingRef.current);
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

  // Poll every 5 seconds to check if bank transfer has been confirmed
  const startPollingForCampaign = (reference, authToken, apiUrl) => {
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max

    setStatusMessage('Waiting for payment confirmation from your bank...');

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
          setSuccessMessage("Payment confirmed! Your campaign is now live to promoters.");
          
          // Upload brand assets if any
          if (brandAssetFiles.length > 0 && data.campaign.id) {
            const cId = data.campaign.id || data.campaign._id;
            console.log('Uploading brand assets to campaign:', cId);
            await uploadBrandAssets(cId, brandAssetFiles, authToken);
          }

          setTitle('');
          setDescription('');
          setCampaignBrief(emptyCampaignBrief);
          setKeyMessage('');
          setBudget('');
          setBrandAssetFiles([]);
          setBrandAssetPreviews([]);
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
            `Waiting for bank confirmation... (${attempts * 5}s elapsed). ` +
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

      const res = await fetch(`${apiUrl}/api/campaigns`, {
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

      const data = await res.json();
      console.log('Campaign creation response:', data);

      if (!res.ok) {
        throw new Error(data.message || 'Campaign creation failed');
      }

      // Upload brand assets if any
      if (brandAssetFiles.length > 0) {
        console.log('Uploading brand assets...');
        await uploadBrandAssets(data.campaign.id, brandAssetFiles, authToken);
      }

      setPaymentProcessing(false);
      setStatusMessage('');
      setSuccessMessage("Campaign created successfully! It is now live to promoters.");
      setTitle('');
      setDescription('');
          setCampaignBrief(emptyCampaignBrief);
      setKeyMessage('');
      setBudget('');
      setBrandAssetFiles([]);
      setBrandAssetPreviews([]);
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

  const creationOpen = location.hash === '#create-campaign' || paymentProcessing;
  return <section className="company-overview-page">
    <div hidden={creationOpen}>
      <CompanyOverview user={user} campaigns={campaigns} loadState={campaignLoadState}
        campaignSubmissions={campaignSubmissions} submissionLoadStates={submissionLoadStates} campaignAssets={campaignAssets}
        expandedCampaignId={expandedCampaignId} onToggleCampaign={id => setExpandedCampaignId(expandedCampaignId === id ? null : id)}
        calculatePromoterSlots={calculatePromoterSlots} onRetry={fetchCampaigns} />
    </div>
    <section className="company-create-section" hidden={!creationOpen} aria-label="Create campaign">
      <Link to="/company" className="company-create-back">&larr; Back to overview</Link>
      <BusinessCreateCampaign values={{ title, description, keyMessage, budget, socialMediaPlatforms }}
        onChange={(field, value) => ({ title: setTitle, description: setDescription, keyMessage: setKeyMessage, budget: setBudget })[field](value)}
        brief={campaignBrief} onBriefChange={(field, value) => setCampaignBrief(prev => ({ ...prev, [field]: value }))}
        onPlatformChange={handleSocialMediaChange} onSelectAllPlatforms={handleSelectAllSocialMedia}
        assets={brandAssetPreviews} assetCount={brandAssetFiles.length} onAssetChange={handleBrandAssetFiles} onRemoveAsset={removeBrandAsset}
        creatorCount={calculatePromoterSlots(budget)} onPayment={handlePaymentAndCreateCampaign}
        paymentProcessing={paymentProcessing} error={error} success={successMessage} status={statusMessage} />
    </section>
  </section>;
}
