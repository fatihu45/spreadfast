import { Alert, AuthLayout, Button } from '../components/ui';
import React, { useEffect, useContext, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { apiCallAuth } from '../utils/api';
import { pollCampaign } from '../utils/pollCampaign';

export default function PaymentCallback() {
  const { token, loading } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const reference = searchParams.get('reference');
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true, cancelPoll, redirect;
    setError(''); setStatus('verifying');
    if (!reference) { setError('Payment reference is missing. Contact support if you have already paid.'); setStatus('failed'); return; }
    if (loading) return;
    if (!token) { setError('Log in to confirm this payment, then return to this page.'); setStatus('failed'); return; }
    const fail = message => { if (active) { setError(message); setStatus('failed'); } };
    async function confirm() {
      try {
        const verified = await apiCallAuth('/api/payments/verify', token, {method: 'POST', body: JSON.stringify({reference})});
        if (!active) return;
        if (!verified.success) { fail(verified.message || 'Could not verify payment. Retry using the same reference.'); return; }
        cancelPoll = pollCampaign({immediate: true,
          check: () => apiCallAuth('/api/payments/campaign-status/' + encodeURIComponent(reference), token),
          onConfirmed: () => { if (active) { setStatus('success'); redirect = setTimeout(() => navigate('/company?refresh=true', {replace: true}), 2000); } },
          onExpired: () => fail('Payment confirmation is taking longer than expected. Retry confirmation or contact support with reference: ' + reference)
        });
      } catch (error) { fail(error.message || 'Could not confirm payment. Please retry.'); }
    }
    confirm();
    return () => { active = false; cancelPoll?.(); clearTimeout(redirect); };
  }, [reference, token, loading, retry, navigate]);
  return <AuthLayout className="sf-payment-status">
    <h1>Campaign payment</h1>
    {status === 'verifying' && <Alert>Verifying payment and creating campaign...</Alert>}
    {status === 'success' && <><Alert tone="success">Payment Successful!</Alert><p>Your campaign has been created successfully.</p><p>Redirecting to dashboard...</p></>}
    {status === 'failed' && <><Alert tone="error"><strong>Confirmation incomplete</strong><p>{error}</p></Alert>
      {reference && token && <Button onClick={() => setRetry(value => value + 1)}>Retry confirmation</Button>}
      {!token && <Link to="/login" className="sf-control sf-button sf-button--secondary">Log in</Link>}
      <Link to="/company" className="sf-control sf-button sf-button--secondary">Back to Dashboard</Link></>}
  </AuthLayout>;
}
