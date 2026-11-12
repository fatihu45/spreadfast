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
  ['totalRevenue', 'Verified credit sales', money],
  ['totalCreditsSold', 'Credits sold', value => number.format(value)],
  ['totalCreditsUsed', 'Paid credits consumed', value => number.format(value)],
  ['creditsRemaining', 'Purchased credits less usage', value => number.format(value)],
  ['totalQuickAdsGenerated', 'Completed ads · all products', value => number.format(value)],
];
const growthMetrics = [
  ['accounts', 'Customer accounts', 'Company and promoter accounts; excludes the configured admin.'],
  ['newAccounts30d', 'New accounts · 30 days', 'Accounts created in the last 30 days.'],
  ['payingCustomers', 'Paying customers', 'Distinct accounts with a verified credit purchase, including deleted accounts.'],
  ['repeatCustomers', 'Repeat buyers', 'Customers with at least two verified purchases.'],
  ['paidConversion', 'Account-to-paid conversion', 'Current customer accounts with a purchase / current customer accounts.'],
  ['activeGenerators30d', 'Active generators · 30 days', 'Unique accounts with a completed ad; not login activity.'],
  ['revenue30d', 'Credit sales · 30 days', 'Verified credit purchases in the last 30 days.'],
  ['averageOrderValue', 'Average purchase', 'Verified credit sales / verified purchases, all time.'],
  ['freePreviews', 'Completed free previews', 'Completed previews across all AI products.'],
  ['availableCredits', 'Current account balances', 'Stored customer balances, including any manual adjustments.'],
];

function Table({ label, headers, children }) {
  return <div className="sf-admin-quick-table" role="region" aria-label={label} tabIndex={0}>
    <table><caption className="sr-only">{label}</caption><thead><tr>{headers.map(header => <th scope="col" key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table>
  </div>;
}

export default function AdminQuickAdsAnalytics({ details = false }) {
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
          || !result.growth || !growthMetrics.every(([key]) => Number.isFinite(result.growth[key]) || (['paidConversion', 'averageOrderValue'].includes(key) && result.growth[key] === null)) || !Array.isArray(result.productStats) || !Array.isArray(result.topCustomers)
          || !metrics.every(([key]) => Number.isFinite(result.analytics[key]) || (key.startsWith('estimated') && result.analytics[key] === null))) throw new Error('Unavailable analytics');
        if (active) { setData(result); setPhase('ready'); }
      } catch { if (active) setPhase('error'); }
    })();
    return () => { active = false; };
  }, [token, reload]);

  return <section className="sf-stack sf-admin-quick-analytics" aria-label="AI advertising analytics">
    <div className="sf-admin-record-heading"><p className="sf-small sf-muted">All-time totals unless marked 30 days.</p><Button variant="secondary" size="sm" disabled={phase === 'loading'} onClick={() => setReload(value => value + 1)}>Refresh analytics</Button></div>
    {phase === 'loading' && <><p role="status">Loading AI advertising analytics...</p><div className="sf-admin-stats">{metrics.map(([key, label]) => <StatCard key={key} label={label} loading />)}</div></>}
    {phase === 'error' && <Alert tone="error"><p>Analytics could not be loaded. Retry to retrieve current figures.</p><Button variant="secondary" onClick={() => setReload(value => value + 1)}>Retry analytics</Button></Alert>}
    {phase === 'ready' && <>
      {(data.growth.expiredGenerations > 0 || data.growth.recoverableAds > 0 || data.growth.oldPendingPayments > 0) && <Alert tone="warning"><strong>Needs attention</strong><p>{data.growth.expiredGenerations || 0} expired jobs · {data.growth.recoverableAds || 0} failed ads with saved assets · {data.growth.oldPendingPayments || 0} payments awaiting confirmation for over 30 minutes.</p><p>Unconfirmed payments may be abandoned checkouts; verify their references before adjusting credits.</p></Alert>}
      <div className="sf-admin-stats">{metrics.map(([key, label, format]) => <StatCard key={key} label={label} value={format(data.analytics[key])} />)}</div>
      <p className="sf-small sf-muted">Updated {date(data.asOf)}. Credit sales are shared across all products and are not subscription revenue or profit. Historical records do not identify test payments, so these totals may include them. Deleted ads remain counted when their generation record is retained.</p>
      {data.analytics.creditsRemaining < 0 && <Alert tone="warning">Paid usage exceeds recorded purchases. Review credit adjustments and payment records.</Alert>}
      {!details && <>
        <div className="sf-admin-stats">{growthMetrics.map(([key, label, description]) => <StatCard key={key} label={label} description={description}
          value={data.growth[key] === null ? '—' : ['revenue30d', 'averageOrderValue'].includes(key) ? money(data.growth[key]) : key === 'paidConversion' ? `${percent.format(data.growth[key])}%` : number.format(data.growth[key])} />)}</div>
        <Card><h2 className="sf-heading">Generation health</h2>
          <Table label="Generation results by product" headers={['Product', 'Completed', 'Failed', 'Pending', 'Success rate', 'Paid credits used']}>
            {data.productStats.map(row => <tr key={row.product}><th scope="row">{row.product}</th><td>{row.completed}</td><td>{row.failed}</td><td>{row.pending}</td><td>{row.successRate === null ? '—' : `${percent.format(row.successRate)}%`}</td><td>{row.creditsUsed}</td></tr>)}
          </Table><p className="sf-small sf-muted">Success rate = completed / (completed + failed). Pending attempts are excluded. Provider costs and profit are unavailable until actual provider spending is recorded.</p>
        </Card>
        <Card><h2 className="sf-heading">Needs attention</h2><dl className="sf-admin-details">
          {[['pendingPayments', 'Pending payments'], ['failedPayments', 'Failed payments'], ['failedGenerations', 'Failed generations'], ['expiredGenerations', 'Expired pending generations'], ['brandingFailures', 'Completed ads with failed branding']].map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{data.growth[key]}</dd></div>)}
        </dl><p className="sf-small sf-muted">Pending checkouts are not revenue. Expired generations have passed their processing deadline and may need investigation.</p></Card>
        <Card><h2 className="sf-heading">Top paying customers</h2>
          {data.topCustomers.length ? <Table label="Top paying customers" headers={['Customer', 'Verified purchases', 'Total paid']}>
            {data.topCustomers.map(row => <tr key={row.userId}><td>{row.name}</td><td>{row.purchases}</td><td>{money(row.revenue)}</td></tr>)}
          </Table> : <EmptyState title="No paying customers yet" description="Customers appear after a verified credit purchase." />}
        </Card>
      </>}
      {details && <>
      <Card as="section" aria-labelledby="admin-quick-transactions">
        <h2 id="admin-quick-transactions" className="sf-heading">Credit purchases</h2>
        <p className="sf-small sf-muted sf-admin-quick-note">Latest {data.transactionLimit || 50} purchases. Only verified, credited payments contribute to revenue; unpaid amounts are shown as —.</p>
        {data.transactions.length ? <Table label="Quick Ads purchases" headers={['Account', 'Account type', 'User email', 'Plan purchased', 'Amount paid', 'Credits purchased', 'Paystack reference', 'Payment status', 'Payment date']}>
          {data.transactions.map(row => <tr key={row.reference}><td>{row.businessName}</td><td>{accountType(row.buyerRole)}</td><td>{row.email || '—'}</td><td>{row.planName}</td><td>{row.amountPaid === null ? '—' : money(row.amountPaid)}</td><td>{number.format(row.creditsPurchased)}</td><td>{row.reference}</td><td><Badge tone={row.status === 'completed' ? 'success' : row.status === 'pending' ? 'warning' : 'neutral'}>{row.status}</Badge></td><td>{date(row.paymentDate)}</td></tr>)}
        </Table> : <EmptyState title="No Quick Ads purchases yet" description="Credit purchases will appear here when companies or promoters begin checkout." />}
      </Card>
      <Card as="section" aria-labelledby="admin-quick-usage">
        <h2 id="admin-quick-usage" className="sf-heading">Account usage</h2>
        <p className="sf-small sf-muted sf-admin-quick-note">Credits are shared across products. Commercials can consume multiple credits per video. Available balances may include adjustments.</p>
        {data.usage.length ? <Table label="Quick Ads account usage" headers={['Account', 'Account type', 'Available credits', 'Completed ads · all products', 'Credits purchased', 'Last completed ad', 'Account created']}>
          {data.usage.map(row => <tr key={row.userId}><td>{row.businessName}</td><td>{accountType(row.accountType)}</td><td>{row.availableCredits === null ? 'Unavailable' : number.format(row.availableCredits)}</td><td>{number.format(row.totalQuickAdsGenerated)}</td><td>{number.format(row.estimatedGenerationsPurchased)}</td><td>{date(row.lastGenerationAt)}</td><td>{date(row.createdAt)}</td></tr>)}
        </Table> : <EmptyState title="No Quick Ads usage yet" description="Company and promoter accounts and completed generations will appear here." />}
      </Card>
      </>}
    </>}
  </section>;
}
