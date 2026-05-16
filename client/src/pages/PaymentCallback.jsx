import React, { useEffect, useContext, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { apiCallAuth } from '../utils/api';

export default function PaymentCallback() {
  const { token } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const reference = searchParams.get('reference');
  const [status, setStatus] = useState('verifying');
  const [error, setError] = useState('');

  useEffect(() => {
    if (reference) {
      verifyPaymentAndCreateCampaign();
    }
  }, [reference]);

  const verifyPaymentAndCreateCampaign = async () => {
    try {
      // Step 1: Verify payment with backend
      const verifyData = await apiCallAuth(
        '/api/payments/verify',
        token,
        {
          method: 'POST',
          body: JSON.stringify({ reference })
        }
      );

      if (!verifyData.success) {
        setStatus('failed');
        setError(verifyData.message || 'Payment verification failed');
        return;
      }

      // Step 2: Retrieve pending campaign data from session storage
      const pendingCampaignStr = sessionStorage.getItem('pendingCampaignData');
      if (!pendingCampaignStr) {
        setStatus('failed');
        setError('Campaign data not found. Please create campaign again.');
        return;
      }

      const pendingCampaign = JSON.parse(pendingCampaignStr);

      // Step 3: Create campaign with payment reference
      const campaignData = await apiCallAuth(
        '/api/campaigns',
        token,
        {
          method: 'POST',
          body: JSON.stringify({
            title: pendingCampaign.title,
            description: pendingCampaign.description,
            budget: pendingCampaign.budget,
            socialMediaPlatforms: pendingCampaign.socialMediaPlatforms,
            reference: reference
          })
        }
      );

      if (!campaignData.success) {
        setStatus('failed');
        setError(campaignData.message || 'Failed to create campaign');
        return;
      }

      // Step 4: Clear session storage and redirect with refresh flag
      sessionStorage.removeItem('pendingCampaignData');
      setStatus('success');
      
      // Redirect after 2 seconds with refresh parameter to trigger UI update
      // Use .then() to ensure data is committed, then force hard refresh as fallback
      setTimeout(() => {
        // First attempt: redirect to trigger fetchCampaigns in CompanyDashboard
        window.location.href = '/company?refresh=true';
      }, 2000);
      
      // Fallback: Hard refresh after 4 seconds to force data reload from campaigns.json
      setTimeout(() => {
        window.location.reload();
      }, 4000);
    } catch (error) {
      console.error('Payment callback error:', error);
      setStatus('failed');
      setError('Verification failed. Please contact support.');
    }
  };

  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      {status === 'verifying' && <p>Verifying payment and creating campaign...</p>}
      {status === 'success' && (
        <>
          <h2 style={{ color: 'green' }}>Payment Successful! ✓</h2>
          <p>Your campaign has been created successfully.</p>
          <p>Redirecting to dashboard...</p>
        </>
      )}
      {status === 'failed' && (
        <>
          <h2 style={{ color: 'red' }}>Process Failed ✗</h2>
          <p>{error}</p>
          <a href="/company">← Back to Dashboard</a>
        </>
      )}
    </div>
  );
}