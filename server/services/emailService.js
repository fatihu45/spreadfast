const { renderLayout } = require('./emailLayout');
const SENDER = 'SpreadFast <noreply@tryspreadfast.com>';
const naira = value => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(value);
const date = value => new Date(value).toLocaleString('en-NG', { timeZone: 'Africa/Lagos', dateStyle: 'medium', timeStyle: 'short' }) + ' WAT';
function siteUrl(path, env = process.env) {
  for (const base of [env.FRONTEND_URL, env.CLIENT_URL, 'https://tryspreadfast.com'].filter(Boolean)) {
    try {
      const url = new URL(path, base);
      if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) return url.href;
    } catch { /* A bad email URL must not prevent a financial transaction from committing. */ }
  }
}
function emailEnabled(env = process.env) {
  return env.EMAILS_ENABLED === 'true' || (env.EMAILS_ENABLED !== 'false' && env.NODE_ENV === 'production');
}

// All existing and new mail uses the same Resend client and sender.
function createEmailSender({ resend, env = process.env, logger = console, timeoutMs = 30000 }) {
  return async (to, subject, html, text, options = {}) => {
    if (!emailEnabled(env)) return { success: false, skipped: true };
    // Non-production sends must be redirected to an explicitly configured test inbox.
    if (env.NODE_ENV !== 'production' && !env.EMAIL_TEST_RECIPIENT) return { success: false, skipped: true };
    if (!resend) return { success: false, code: 'EMAIL_NOT_CONFIGURED' };
    let timer;
    try {
      const result = await Promise.race([resend.emails.send({ from: SENDER,
        to: env.NODE_ENV === 'production' ? to : env.EMAIL_TEST_RECIPIENT, subject, html, ...(text ? { text } : {}) }, options), new Promise((resolve, reject) => { timer = setTimeout(() => reject(new Error('Email timeout')), timeoutMs); })]);
      if (result.error || !result.data?.id) {
        logger.error('[Email] Provider rejected message');
        return { success: false, code: 'EMAIL_PROVIDER_REJECTED' };
      }
      return { success: true, id: result.data.id };
    } catch {
      logger.error('[Email] Delivery request failed');
      return { success: false, code: 'EMAIL_REQUEST_FAILED' };
    } finally { clearTimeout(timer); }
  };
}

function renderEmail(kind, data, env = process.env) {
  const d = data;
  let subject, message, details = [], cta = 'Open SpreadFast', path = '/';
  switch (kind) {
    case 'quick_purchase':
    case 'admin_quick_purchase':
      subject = kind === 'quick_purchase' ? 'Your SpreadFast Quick Ads credits are ready' : 'New Quick Ads credit purchase';
      message = kind === 'quick_purchase' ? 'Your Quick Ads credit purchase was successful. Your credits are ready to use.' : 'A verified Quick Ads purchase has been credited to this account.';
      details = [['Customer', d.name], ['Email', d.email], ['Account type', d.role], ['Payment', naira(d.amount)], ['Credits added', d.credits], ['Available credits', d.balance], ['Reference', d.reference], ['Purchase date', date(d.date)]];
      cta = kind === 'quick_purchase' ? 'Create a Quick Ad' : 'View Quick Ads payments';
      path = kind === 'quick_purchase' ? (d.role === 'promoter' ? '/promoter/quick-ads' : '/company/quick-ads') : '/admin-portal';
      break;
    case 'withdrawal_requested':
    case 'admin_withdrawal_requested':
      subject = kind === 'withdrawal_requested' ? 'Your withdrawal request has been received' : 'New promoter withdrawal request';
      message = 'The withdrawal request is pending admin processing. We will notify you when the payment has been processed.';
      details = [['Promoter', d.name], ['Email', d.email], ['Amount requested', naira(d.amount)], ['Withdrawal ID', d.reference], ['Status', 'Pending'], ['Submitted', date(d.date)]];
      if (kind === 'admin_withdrawal_requested' && Number.isFinite(d.balance)) details.push(['Available wallet balance', naira(d.balance)]);
      cta = 'View withdrawal'; path = kind === 'withdrawal_requested' ? '/wallet' : '/admin-portal';
      break;
    case 'withdrawal_paid':
      subject = 'Your SpreadFast withdrawal has been paid';
      message = 'Your withdrawal has been processed. Please check the bank account connected to your withdrawal request.';
      details = [['Amount', naira(d.amount)], ['Withdrawal ID', d.reference], ['Status', 'Paid'], ['Processed', date(d.date)]];
      cta = 'View wallet'; path = '/wallet'; break;
    case 'quick_payment_failed':
      subject = "Your Quick Ads payment wasn't completed";
      message = 'Paystack confirmed that this payment failed. No Quick Ads credits were added or deducted for this attempt. If your bank shows a debit, contact support with the reference.';
      details = [['Attempted payment', naira(d.amount)], ['Reference', d.reference]];
      cta = 'Try again'; path = '/quickads/credits'; break;
    case 'quick_low':
    case 'quick_zero':
      subject = kind === 'quick_low' ? "You're running low on Quick Ads credits" : "You've used your Quick Ads credits";
      message = 'Your latest Quick Ad was generated successfully. Purchase credits whenever you are ready to create more.';
      details = [['Available credits', d.balance]]; cta = 'Buy Credits'; path = '/quickads/credits'; break;
    case 'password_changed':
      subject = 'Your SpreadFast password was changed';
      message = 'Your password was changed successfully. If you did not make this change, contact SpreadFast support immediately.';
      details = [['Changed', date(d.date)]]; cta = 'Open SpreadFast'; path = '/'; break;
    default: throw new Error('Unknown transactional email');
  }
  const url = siteUrl(path, env);
  const greeting = kind.startsWith('admin_') ? 'Hello SpreadFast team,' : `Hi ${d.name || 'there'},`;
  const { html, text } = renderLayout({ title: subject, greeting, paragraphs: [message], details, cta, url });
  return { subject, html, text };
}
module.exports = { createEmailSender, renderEmail, emailEnabled };

