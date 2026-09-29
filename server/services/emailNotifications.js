const { createHash, randomUUID } = require('node:crypto');
const { renderEmail } = require('./emailService');

// Persist immutable messages with the business transaction; no network call occurs here.
async function enqueueEmail(tx, kind, sourceId, user, data, env = process.env) {
  const to = kind.startsWith('admin_') ? env.ADMIN_EMAIL : user.email;
  if (!to) { console.warn('[Email] Recipient not configured', { kind }); return; }
  const id = createHash('sha256').update(`${kind}:${sourceId}`).digest('hex');
  if (await tx.EmailNotification.findOne({ id })) return;
  await tx.EmailNotification.create({ id, kind, userId: user.id, to,
    ...renderEmail(kind, { name: user.name, email: user.email, role: user.role, ...data }, env),
    status: 'pending', attempts: 0, createdAt: new Date(), nextAttemptAt: new Date() });
}

// Claim in a DB transaction, then contact Resend only after commit. Independent workers
// share a lease and a stable provider idempotency key. Never retry an ambiguous send
// beyond 23 hours: Resend expires keys at 24 hours, requiring manual reconciliation.
async function deliverNotification(DB, id, sendEmail, now = Date.now()) {
  const token = randomUUID();
  const row = await DB.withTransaction(async tx => {
    const item = await tx.EmailNotification.findOne({ id });
    if (!item || ['sent', 'suppressed', 'needs_review'].includes(item.status)) return null;
    if (new Date(item.leaseUntil).getTime() > now || new Date(item.nextAttemptAt).getTime() > now) return null;
    if (item.firstAttemptAt && now - new Date(item.firstAttemptAt).getTime() >= 23 * 60 * 60 * 1000) {
      await tx.EmailNotification.updateOne({ id }, { $set: { status: 'needs_review', errorCode: 'RETRY_WINDOW_EXPIRED' } });
      console.error('[Email] Notification needs reconciliation', { id, kind: item.kind });
      return null;
    }
    await tx.EmailNotification.updateOne({ id }, { $set: { status: 'sending', leaseToken: token,
      leaseUntil: new Date(now + 5 * 60 * 1000), firstAttemptAt: item.firstAttemptAt || new Date(now) }, $inc: { attempts: 1 } });
    return item;
  });
  if (!row) return;
  let result;
  try { result = await sendEmail(row.to, row.subject, row.html, row.text, { idempotencyKey: `spreadfast/${id}` }); }
  catch { result = { success: false, code: 'EMAIL_REQUEST_FAILED' }; }
  const success = result?.success === true;
  await DB.EmailNotification.updateOne({ id, leaseToken: token }, { $set: {
    status: success ? 'sent' : result?.skipped ? 'suppressed' : 'retry', leaseUntil: null,
    ...(success ? { sentAt: new Date(), providerId: result.id, errorCode: null } : {
      errorCode: result?.skipped ? 'EMAILS_DISABLED' : 'EMAIL_DELIVERY_FAILED',
      nextAttemptAt: new Date(Date.now() + Math.min(30, 2 ** Math.min(row.attempts || 0, 5)) * 60000)
    })
  } });
  if (!success && !result?.skipped) console.error('[Email] Notification delivery failed', { id, kind: row.kind });
}

function startEmailWorker(DB, sendEmail, ready = () => true) {
  let busy = false;
  const tick = async () => {
    if (busy || !ready()) return;
    busy = true;
    try {
      const now = new Date();
      const rows = await DB.EmailNotification.find({ status: { $in: ['pending', 'retry', 'sending'] },
        $and: [{ $or: [{ nextAttemptAt: { $lte: now } }, { nextAttemptAt: null }] },
          { $or: [{ leaseUntil: { $lte: now } }, { leaseUntil: null }] }] }).sort({ createdAt: 1 }).limit(20);
      for (const row of rows) {
        await deliverNotification(DB, row.id, sendEmail);
        await new Promise(resolve => setTimeout(resolve, 600));
      }
    } catch { console.error('[Email] Notification worker could not complete its batch'); }
    finally { busy = false; }
  };
  const timer = setInterval(tick, 15000); timer.unref();
  return () => clearInterval(timer);
}

async function passwordChanged(DB, user) {
  try {
    await DB.withTransaction(tx => enqueueEmail(tx, 'password_changed', `${user.id}:${(user.tokenVersion || 0) + 1}`, user, { date: new Date().toISOString() }));
  } catch { console.error('[Email] Password-change notification could not be queued'); }
}
module.exports = { enqueueEmail, deliverNotification, startEmailWorker, passwordChanged };
