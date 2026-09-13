import Alert from './ui/Alert';
import React, { useEffect, useRef, useState } from 'react';
import { apiCallAuth } from '../utils/api';
import { Badge, Button, Card, EmptyState, FormField, Input, PageHeader, WalletBalanceCard } from './ui';
import UiIcon from './ui/UiIcon';
import './CreatorWallet.css';

const money = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
  ? new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(Number(value)) : 'Unavailable';
const dateText = value => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date unavailable';

export default function CreatorWallet({ token, wallet, bankDetails, loading, error, success, pendingWithdrawals, withdrawalsAvailable,
  bankFormData, showBankForm, withdrawalAmount, onBankChange, onSaveBank, onWithdraw, onAmountChange, onEditBank, onCancelBank }) {
  const [earnings, setEarnings] = useState([]);
  const [earningsLoading, setEarningsLoading] = useState(true);
  const [earningsError, setEarningsError] = useState('');
  const [retry, setRetry] = useState(0);
  const [showWithdrawal, setShowWithdrawal] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const amountRef = useRef(null);
  const withdrawRef = useRef(null);
  useEffect(() => {
    let cancelled = false;
    setEarningsLoading(true); setEarningsError('');
    apiCallAuth('/api/submissions/my-submissions', token).then(data => {
      if (cancelled) return;
      if (!data.success || !Array.isArray(data.submissions)) throw new Error('Unavailable');
      setEarnings(data.submissions.filter(item => item.status === 'approved' && Number(item.approvalAmount) > 0));
    }).catch(() => { if (!cancelled) setEarningsError('Campaign earnings could not be loaded.'); })
      .finally(() => { if (!cancelled) setEarningsLoading(false); });
    return () => { cancelled = true; };
  }, [token, retry]);
  useEffect(() => { if (showWithdrawal) amountRef.current?.focus(); }, [showWithdrawal]);
  const transactions = [
    ...pendingWithdrawals.map(item => ({ id: 'withdrawal-' + item.id, type: 'Withdrawal', amount: item.amount, status: item.status || 'pending', date: item.createdAt, dateLabel: 'Requested', icon: 'wallet' })),
    ...earnings.map(item => ({ id: 'earning-' + item.id, type: 'Campaign earnings', amount: item.approvalAmount, status: 'approved', date: item.reviewedAt || item.createdAt, dateLabel: item.reviewedAt ? 'Approved' : 'Submitted', icon: 'campaign', description: item.campaignTitle || '' }))
  ].sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
  const pendingTotal = pendingWithdrawals.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const canWithdraw = !loading && wallet && money(wallet.balance) !== 'Unavailable';
  const closeWithdrawal = () => { setShowWithdrawal(false); withdrawRef.current?.focus(); };
  return <section className="creator-wallet" aria-label="Creator wallet">
    <PageHeader title="Wallet" />
    {error && <Alert tone="error">{error}</Alert>}
    {success && <Alert tone="success">{success}</Alert>}
    {!loading && !wallet && <Alert tone="error">Your wallet could not be loaded. Refresh the page to try again.</Alert>}
    <div className="creator-wallet-layout">
      <div className="creator-wallet-main">
        <WalletBalanceCard balance={loading ? 'Loading...' : money(wallet?.balance)}
          action={<Button ref={withdrawRef} className="creator-wallet-withdraw" disabled={!canWithdraw} aria-expanded={showWithdrawal} aria-controls="creator-withdrawal-form" onClick={() => setShowWithdrawal(true)}>Withdraw</Button>} />
        {withdrawalsAvailable && pendingTotal > 0 && <p className="creator-wallet-pending">Pending withdrawals <strong>{money(pendingTotal)}</strong></p>}
        <Card className="creator-wallet-bank"><h2>Bank account</h2>
          {loading ? <p role="status">Loading bank account...</p> : bankDetails ? <div className="creator-wallet-bank-summary">
            <span className="creator-wallet-bank-icon"><UiIcon name="wallet" /></span>
            <div><strong>{bankDetails.bankName}</strong><p>{bankDetails.accountName}</p><p aria-label={'Account ending in ' + String(bankDetails.accountNumber || '').slice(-4)}>&bull;&bull;&bull;&bull; {String(bankDetails.accountNumber || '').slice(-4)}</p></div>
            <Button size="sm" variant="ghost" onClick={onEditBank}>Change account</Button>
          </div> : <p>Add your bank account to receive withdrawals.</p>}
          {!loading && wallet && (!bankDetails || showBankForm) && <form onSubmit={async event => { event.preventDefault(); if (savingBank) return; setSavingBank(true); try { await onSaveBank(event); } finally { setSavingBank(false); } }} className="creator-wallet-form">
            <FormField label="Bank name" required><Input name="bankName" value={bankFormData.bankName} onChange={onBankChange} /></FormField>
            <FormField label="Account name" required><Input name="accountName" value={bankFormData.accountName} onChange={onBankChange} autoComplete="name" /></FormField>
            <FormField label="Account number" required><Input name="accountNumber" type="text" inputMode="numeric" value={bankFormData.accountNumber} onChange={onBankChange} placeholder="Your 10-digit account number" /></FormField>
            <div className="creator-wallet-form-actions"><Button type="submit" disabled={savingBank}>{savingBank ? 'Saving...' : 'Save account'}</Button>{bankDetails && <Button variant="secondary" onClick={onCancelBank}>Cancel</Button>}</div>
          </form>}
        </Card>
        <div id="creator-withdrawal-form" hidden={!showWithdrawal}>
          {showWithdrawal && <Card className="creator-wallet-request"><h2>Request withdrawal</h2>
            <p className="creator-wallet-withdrawal-terms">A 7.5% withdrawal fee applies. Minimum withdrawal: &#8358;1,000.</p>
            {!bankDetails ? <><p>Add your bank account above before requesting a withdrawal.</p><Button variant="secondary" onClick={closeWithdrawal}>Close</Button></> : <form className="creator-wallet-form" onSubmit={async event => { event.preventDefault(); if (withdrawing) return; setWithdrawing(true); try { await onWithdraw(event); } finally { setWithdrawing(false); } }}>
              <FormField label="Withdrawal amount (NGN)" required><Input ref={amountRef} type="number" step="1000" min="1000" max={wallet?.balance || 0} value={withdrawalAmount} onChange={onAmountChange} placeholder="Enter amount" /></FormField>
              <div className="creator-wallet-form-actions"><Button type="submit" disabled={withdrawing || !canWithdraw}>{withdrawing ? 'Submitting...' : 'Request Withdrawal'}</Button><Button variant="secondary" disabled={withdrawing} onClick={closeWithdrawal}>Cancel</Button></div>
            </form>}
          </Card>}
        </div>
      </div>
      <Card className="creator-wallet-history"><h2>Transaction history</h2><p className="creator-wallet-history-note">Approved campaign earnings and pending withdrawal requests. Completed withdrawals are not available in this view.</p>
        {earningsError && <div role="alert" className="creator-wallet-history-error"><p>{earningsError}</p><Button size="sm" variant="ghost" onClick={() => setRetry(value => value + 1)}>Retry earnings</Button></div>}
        {!loading && !withdrawalsAvailable && <p role="alert" className="creator-wallet-history-error">Pending withdrawals could not be loaded.</p>}
        {(loading || earningsLoading) && <p role="status" className="creator-wallet-history-loading">Loading transactions...</p>}
        {transactions.length > 0 ? <ul className="creator-wallet-transactions">{transactions.map(item => <li key={item.id}>
          <span className={'creator-wallet-transaction-icon ' + (item.type === 'Withdrawal' ? 'is-withdrawal' : '')}><UiIcon name={item.icon} /></span>
          <div className="creator-wallet-transaction-copy"><h3>{item.type}</h3>{item.description && <p>{item.description}</p>}<Badge tone={item.status === 'approved' ? 'success' : 'warning'}>{item.status.charAt(0).toUpperCase() + item.status.slice(1)}</Badge><p className="creator-wallet-transaction-date">{item.dateLabel}: <time dateTime={item.date}>{dateText(item.date)}</time></p></div>
          <strong className="creator-wallet-transaction-amount" aria-label={'Amount ' + money(item.amount)}>{money(item.amount)}</strong>
        </li>)}</ul> : !loading && !earningsLoading && !earningsError && withdrawalsAvailable && <EmptyState title="No transactions yet" description="Your approved campaign earnings and withdrawal requests will appear here." />}
      </Card>
    </div>
  </section>;
}
