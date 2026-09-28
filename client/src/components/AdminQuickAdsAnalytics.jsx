import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { apiCallAuth } from '../utils/api';
import { Alert, Badge, Button, Card, EmptyState, StatCard } from './ui';

const accountType = role => role === 'company' ? 'Company' : role === 'promoter' ? 'Promoter' : 'Unknown';
const currency = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });
const number = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 1 });
const date = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const money = value => value === null ? 'Not configured' : currency.format(value);
const metrics = [
  ['totalRevenue', 'Total Quick Ads Revenue', money],
  ['totalCreditsSold', 'Total Credits Sold', value => number.format(value)],
  ['totalCreditsUsed', 'Total Credits Used', value => number.format(value)],
  ['creditsRemaining', 'Credits Remaining', value => number.format(value)],
  ['totalQuickAdsGenerated', 'Total Quick Ads Generated', value => number.format(value)],
  ['estimatedGenerationCost', 'Estimated AI Generation Cost', money],
  ['estimatedGrossProfit', 'Estimated Gross Profit', money],
  ['estimatedGrossMargin', 'Estimated Gross Margin', value => value === null ? 'Not configured' : `${percent.format(value)}%`]
];
function Table({ label, headers, children }) {
  return <div className="sf-admin-quick-table" role="region" aria-label={label} tabIndex={0}>
    <table><caption className="sr-only">{label}</caption><thead><tr>{headers.map(header => <th scope="col" key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table>
  </div>;
}

export default function AdminQuickAdsAnalytics() {
  const { token } = useContext(AuthContext);
  const [data, setData] = useState(null);
  const [phase, setPhase] = useState('loading');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setPhase('loading');
    (async () => {
      try {
        const result = await apiCallAuth('/api/admin/quick-ads/analytics', token);
        if (!result?.success || !result.analytics || !Array.isArray(result.transactions) || !Array.isArray(result.usage)
          || !metrics.every(([key]) => Number.isFinite(result.analytics[key]) || (key.startsWith('estimated') && result.analytics[key] === null))) throw new Error('Unavailable analytics');
        if (active) { setData(result); setPhase('ready'); }
      } catch { if (active) setPhase('error'); }
    })();
    return () => { active = false; };
  }, [token, reload]);

  return <section className="sf-stack sf-admin-quick-analytics" aria-label="Quick Ads financial analytics">
    <div className="sf-admin-record-heading"><p className="sf-small sf-muted">All-time verified purchases and completed generations.</p><Button variant="secondary" size="sm" disabled={phase === 'loading'} onClick={() => setReload(value => value + 1)}>Refresh analytics</Button></div>
    {phase === 'loading' && <><p role="status">Loading Quick Ads analytics...</p><div className="sf-admin-stats">{metrics.map(([key, label]) => <StatCard key={key} label={label} loading />)}</div></>}
    {phase === 'error' && <Alert tone="error"><p>Quick Ads analytics could not be loaded. Other admin sections are still available.</p><Button variant="secondary" onClick={() => setReload(value => value + 1)}>Retry analytics</Button></Alert>}
    {phase === 'ready' && <>
      <div className="sf-admin-stats">{metrics.map(([key, label, format]) => <StatCard key={key} label={label} value={format(data.analytics[key])} />)}</div>
      {!data.estimatesAvailable && <Alert>AI cost and profit estimates are not configured. Set QUICK_AD_GENERATION_COST_USD and USD_NGN_RATE on the backend.</Alert>}
      {data.analytics.creditsRemaining < 0 && <Alert tone="warning">Recorded paid usage exceeds verified credit purchases. Review the records before relying on the remaining-credit total.</Alert>}
      <p className="sf-small sf-muted">AI cost includes successful free previews and paid ads. Profit and margin are estimates before payment fees, storage, failed provider attempts and other expenses. Margin is shown as 0% when revenue is zero.</p>
      <p className="sf-small sf-muted">Totals reflect stored purchases, including successful test payments.</p>
      <Card as="section" aria-labelledby="admin-quick-transactions">
        <h2 id="admin-quick-transactions" className="sf-heading">Quick Ads Transactions</h2>
        <p className="sf-small sf-muted sf-admin-quick-note">Latest {data.transactionLimit || 50} purchases. Only verified, credited payments contribute to revenue; unpaid amounts are shown as —.</p>
        {data.transactions.length ? <Table label="Quick Ads purchases" headers={['Account', 'Account type', 'User email', 'Plan purchased', 'Amount paid', 'Credits purchased', 'Paystack reference', 'Payment status', 'Payment date']}>
          {data.transactions.map(row => <tr key={row.reference}><td>{row.businessName}</td><td>{accountType(row.buyerRole)}</td><td>{row.email || '—'}</td><td>{row.planName}</td><td>{row.amountPaid === null ? '—' : money(row.amountPaid)}</td><td>{number.format(row.creditsPurchased)}</td><td>{row.reference}</td><td><Badge tone={row.status === 'completed' ? 'success' : row.status === 'pending' ? 'warning' : 'neutral'}>{row.status}</Badge></td><td>{date(row.paymentDate)}</td></tr>)}
        </Table> : <EmptyState title="No Quick Ads purchases yet" description="Credit purchases will appear here when companies or promoters begin checkout." />}
      </Card>
      <Card as="section" aria-labelledby="admin-quick-usage">
        <h2 id="admin-quick-usage" className="sf-heading">Quick Ads Usage</h2>
        <p className="sf-small sf-muted sf-admin-quick-note">Purchased generations equal verified paid credits. Available balances may include adjustments; they are not used to calculate revenue or paid credits remaining.</p>
        {data.usage.length ? <Table label="Quick Ads account usage" headers={['Account', 'Account type', 'Available Quick Ad credits', 'Total Quick Ads generated', 'Estimated generations purchased', 'Last Quick Ad generation', 'Account created']}>
          {data.usage.map(row => <tr key={row.userId}><td>{row.businessName}</td><td>{accountType(row.accountType)}</td><td>{row.availableCredits === null ? 'Unavailable' : number.format(row.availableCredits)}</td><td>{number.format(row.totalQuickAdsGenerated)}</td><td>{number.format(row.estimatedGenerationsPurchased)}</td><td>{date(row.lastGenerationAt)}</td><td>{date(row.createdAt)}</td></tr>)}
        </Table> : <EmptyState title="No Quick Ads usage yet" description="Company and promoter accounts and completed generations will appear here." />}
      </Card>
    </>}
  </section>;
}
