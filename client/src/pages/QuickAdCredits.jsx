import React, { useContext, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Alert, Button } from '../components/ui';
import { canUseQuickAds, quickAdsHome, quickAdsAuth, quickAdsUrl } from '../utils/quickAdsApi';
import './QuickAd.css';
import './QuickAdCredits.css';

const money = (value, decimals = 0) => new Intl.NumberFormat('en-NG', {
  style: 'currency', currency: 'NGN', maximumFractionDigits: decimals, minimumFractionDigits: decimals
}).format(value);
const PAYMENT_ERROR = "We couldn't confirm your payment. You have not been charged any Quick Ads credits.";

export default function QuickAdCredits() {
  const { user, token } = useContext(AuthContext);
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const eligibleAccount = canUseQuickAds(user?.role);
  const pendingStorage = `spreadfast-quick-ad-payment:${user?.id}`;
  const [plans, setPlans] = useState([]);
  const [balance, setBalance] = useState(null);
  const [history, setHistory] = useState([]);
  const [phase, setPhase] = useState('loading');
  const [error, setError] = useState('');
  const [paid, setPaid] = useState(null);
  const [retry, setRetry] = useState(0);
  const [reference, setReference] = useState(() => searchParams.get('reference') || searchParams.get('trxref') || '');
  const busy = useRef(false);
  const checkoutRequest = useRef(null);

  useEffect(() => () => checkoutRequest.current?.abort(), []);
  useEffect(() => {
    if (!reference && eligibleAccount) {
      try { setReference(sessionStorage.getItem(pendingStorage) || ''); } catch { /* Storage may be disabled. */ }
    }
  }, [reference, eligibleAccount, pendingStorage]);

  useEffect(() => {
    const controller = new AbortController();
    setError(''); setPhase('loading'); setPaid(null);
    async function load() {
      try {
        const { data: catalog } = await axios.get(quickAdsUrl('/plans'), { signal: controller.signal, timeout: 15000 });
        if (!catalog?.success || !Array.isArray(catalog.plans)) throw new Error('Unavailable plans');
        if (controller.signal.aborted) return;
        setPlans(catalog.plans);
        if (!eligibleAccount) { setPhase('ready'); return; }
        const options = { headers: quickAdsAuth(token), signal: controller.signal, timeout: 20000 };
        const { data: account } = await axios.get(quickAdsUrl('/credits'), options);
        if (!account?.success || !Number.isSafeInteger(account.quickAdCredits)) throw new Error('Unavailable balance');
        if (controller.signal.aborted) return;
        setBalance(account.quickAdCredits);
        if (reference) {
          setPhase('confirming');
          const { data } = await axios.get(quickAdsUrl(`/credits/verify/${encodeURIComponent(reference)}`), options);
          if (!data?.success || !Number.isSafeInteger(data.quickAdCredits) || !Number.isSafeInteger(data.creditsPurchased)) throw new Error('Unconfirmed payment');
          if (controller.signal.aborted) return;
          setBalance(data.quickAdCredits); setPaid(data); setPhase('success');
          try { sessionStorage.removeItem(pendingStorage); } catch { /* Optional persistence. */ }
        } else setPhase('ready');
        // History failures do not undo a verified payment or prevent purchasing.
        try {
          const { data } = await axios.get(quickAdsUrl('/transactions'), options);
          if (!controller.signal.aborted && data?.success) setHistory(data.transactions || []);
        } catch { /* Balance and confirmation remain authoritative. */ }
      } catch {
        if (!controller.signal.aborted) {
          setPhase('failed');
          setError(reference ? PAYMENT_ERROR : 'We could not load Quick Ads credits. Please try again.');
        }
      }
    }
    load();
    return () => controller.abort();
  }, [token, eligibleAccount, reference, retry, pendingStorage]);

  async function purchase(planId) {
    if (!eligibleAccount || !token || busy.current) return;
    busy.current = true;
    const controller = new AbortController(); checkoutRequest.current = controller;
    setError(''); setPaid(null); setPhase('checkout');
    try {
      const { data } = await axios.post(quickAdsUrl('/credits/initialize'), { planId }, {
        headers: quickAdsAuth(token), signal: controller.signal, timeout: 20000
      });
      if (controller.signal.aborted) return;
      if (!data?.success || typeof data.reference !== 'string') throw new Error('Checkout unavailable');
      const checkout = new URL(data.authorizationUrl);
      if (checkout.protocol !== 'https:' || !['checkout.paystack.com', 'checkout.paystack.co'].includes(checkout.hostname) || checkout.username || checkout.password) throw new Error('Invalid checkout');
      try { sessionStorage.setItem(pendingStorage, data.reference); } catch { /* Callback URL also carries the reference. */ }
      window.location.assign(checkout.href);
    } catch {
      if (!controller.signal.aborted) { setPhase('failed'); setError('Payment could not be started. Please try again.'); }
    } finally { busy.current = false; if (checkoutRequest.current === controller) checkoutRequest.current = null; }
  }
  const processing = ['loading', 'checkout', 'confirming'].includes(phase);
  return <section className="quick-ad quick-ad-credits">
    <header className="quick-ad-heading">
      <span className="quick-ad-badge">SpreadFast Quick Ads</span>
      <h1>Quick Ads Credits</h1>
      <p>Create professional ads whenever you need them.</p>
    </header>
    {!eligibleAccount && <Alert>A company or promoter account is required to purchase Quick Ads credits.</Alert>}
    {location.state?.outOfCredits && !paid && <Alert>You're out of Quick Ads credits.</Alert>}
    <div className="quick-ad-credit-summary" aria-live="polite">
      <strong>{!eligibleAccount ? 'Company or promoter account required' : balance === null ? 'Loading balance...' : `${balance} Quick Ads ${balance === 1 ? 'credit' : 'credits'}`}</strong>
      <span>1 credit = 1 Quick Ad generation</span>
    </div>
    {phase === 'checkout' && <Alert>Opening secure Paystack checkout...</Alert>}
    {phase === 'confirming' && <Alert>Confirming your payment...</Alert>}
    {paid && <div className="quick-ad-payment-success" role="status">
      <h2>Payment successful</h2>
      <p>{paid.creditsPurchased} Quick Ads {paid.creditsPurchased === 1 ? 'credit has' : 'credits have'} been added to your account.</p>
      <p>Credits added successfully. Your balance: {balance} credits</p>
      <div className="quick-ad-credit-links">
        <Link to={quickAdsHome(user?.role)} className="sf-control sf-button sf-button--primary">Create Quick Ad</Link>
        <Button variant="secondary" onClick={() => document.getElementById('quick-ad-plans')?.scrollIntoView({ block: 'start' })}>View Credits</Button>
      </div>
    </div>}
    {error && <Alert tone="error"><p>{error}</p>
      {reference && <p>If your bank shows a charge, retry confirmation before making another payment. Reference: {reference}</p>}
      <Button variant="secondary" onClick={() => setRetry(value => value + 1)}>{reference ? 'Retry confirmation' : 'Retry'}</Button>
    </Alert>}
    <div className="quick-ad-plan-grid" id="quick-ad-plans">
      {plans.map(plan => <article key={plan.id} className={'quick-ad-plan' + (plan.recommended ? ' is-recommended' : '')}>
        {plan.recommended && <span className="quick-ad-badge">A good place to start</span>}
        <h2>{plan.name}</h2><strong className="quick-ad-plan-price">{money(plan.price)}</strong>
        <p>{plan.credits} {plan.credits === 1 ? 'credit' : 'credits'} · {plan.credits} Quick {plan.credits === 1 ? 'Ad' : 'Ads'}</p>
        <p className="quick-ad-plan-value">{money(plan.price / plan.credits, 2)} per ad</p>
        <Button fullWidth disabled={!eligibleAccount || processing} onClick={() => purchase(plan.id)}>{plan.cta}</Button>
      </article>)}
    </div>
    <p className="quick-ad-credit-note">Free previews stay preview-only. Paid credits create new ads you can download and use in campaigns. Failed generations do not use credits.</p>
    {history.length > 0 && <section className="quick-ad-purchases" aria-label="Recent credit purchases">
      <h2>Recent purchases</h2>
      {history.map(item => <div className="quick-ad-purchase" key={item.reference}>
        <span>{item.credits} credits · {money(item.amount)}</span>
        <span>{item.creditsApplied ? 'Credits added' : 'Awaiting confirmation'}</span>
        {!item.creditsApplied && <Button size="sm" variant="secondary" disabled={processing} onClick={() => { setReference(item.reference); setRetry(value => value + 1); }}>Check payment</Button>}
      </div>)}
    </section>}
  </section>;
}
