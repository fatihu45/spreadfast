const { createHash } = require('crypto');
const { renderLayout, SITE } = require('./emailLayout');
const { emailEnabled } = require('./emailService');
const TEST_RECIPIENT = 'tryspreadfast@gmail.com';
const STARTER = { subject: 'Your next product ad starts with one photo', title: 'One photo. A new way to show your product.', body: 'A clear product photo is a great starting point for your next video ad.\n\nUpload it to Quick Ad, choose a style, and add a short description of the result you want. Keep product details specific so the ad stays true to what you sell.', cta: 'Create your ad', url: SITE, imageUrl: '', audience: 'all' };
function validateCampaign(input) {
  const out = {};
  for (const [key, max] of Object.entries({ subject: 150, title: 150, body: 5000, cta: 60 })) {
    if (typeof input[key] !== 'string' || !input[key].trim() || input[key].length > max || /\{\{\{|[\r\n]/.test(key === 'body' ? input[key].replace(/[\r\n]/g, '') : input[key])) throw Object.assign(new Error(`Invalid ${key}`), { status: 400 });
    out[key] = input[key].trim();
  }
  for (const key of ['url', 'imageUrl']) {
    if (key === 'imageUrl' && !input[key]) { out[key] = ''; continue; }
    let url;
    try { url = new URL(input[key]); } catch { throw Object.assign(new Error(`Invalid ${key}`), { status: 400 }); }
    if (url.protocol !== 'https:' || url.username || url.password || /[{}]/.test(input[key]) || input[key].length > 2000 || (key === 'url' && !['tryspreadfast.com', 'www.tryspreadfast.com'].includes(url.hostname))) throw Object.assign(new Error(`Invalid ${key}`), { status: 400 });
    out[key] = url.href;
  }
  if (!['all', 'company', 'promoter', 'registered'].includes(input.audience)) throw Object.assign(new Error('Invalid audience'), { status: 400 });
  out.audience = input.audience;
  return out;
}
function renderCampaign(campaign, test = false) {
  return renderLayout({ ...campaign, paragraphs: campaign.body.split(/\n\s*\n/), marketing: true, test });
}
function slotFor(now, settings) {
  const date = new Date(new Date(now).getTime() + 3600000); // Lagos is UTC+1 year-round.
  const days = settings.frequency === 4 ? [0, 1, 3, 5] : [1, 3, 5];
  if (!settings.enabled || !days.includes(date.getUTCDay()) || date.getUTCHours() !== settings.hour) return null;
  return date.toISOString().slice(0,10); // At most one slot per Lagos date, even after an hour change.
}
function eligible(user, audience = 'all') {
  const allowed = audience === 'registered'
    ? user.marketingSubscribed === true || (!user.marketingConsentAt && !user.marketingConsentSource)
    : user.marketingSubscribed === true;
  return allowed && (!user.status || user.status === 'active') && ['company','promoter'].includes(user.role) && (['all','registered'].includes(audience) || user.role === audience);
}
function checked(result) {
  if (result?.error || !result?.data) throw new Error('RESEND_REQUEST_FAILED');
  return result.data;
}
// Never resubscribe an existing contact during a sync. Resend's unsubscribe state wins.
async function syncContact(resend, user, segmentId, pace = async () => {}) {
  const email = user.email.trim().toLowerCase();
  const found = await resend.contacts.get({ email }); await pace();
  let contact;
  if (found.error) {
    if (found.error.statusCode !== 404 && found.error.name !== 'not_found') throw new Error('CONTACT_LOOKUP_FAILED');
    contact = checked(await resend.contacts.create({ email, firstName: user.name || '', unsubscribed: false })); await pace();
  } else contact = checked(found);
  if (contact.unsubscribed) return false;
  checked(await resend.contacts.segments.add({ contactId: contact.id, segmentId })); await pace();
  return true;
}
async function runWeekly({ models, User, resend, env = process.env, now = new Date(), pace = () => new Promise(r => setTimeout(r, 600)) }) {
  if (env.NODE_ENV !== 'production' || !emailEnabled(env) || !resend) return;
  const { EmailMarketingSettings: Settings, EmailCampaign: Campaign, EmailMarketingSlot: Slot } = models;
  const settings = await Settings.findById('weekly');
  const slot = settings && slotFor(now, settings);
  if (!slot) return;
  // A durable unique slot prevents duplicate broadcasts across restarts and instances.
  try { await Slot.create({ _id: slot }); } catch (e) { if (e.code === 11000) return; throw e; }
  const campaign = await Campaign.findOneAndUpdate({ status: 'ready' }, { $set: { status: 'sending', slot } }, { sort: { createdAt: 1 }, new: true });
  if (!campaign) return; // Empty slots are skipped; old emails are never recycled.
  await deliverCampaign({ models, User, resend, campaign, pace, scheduled: true });
}
async function runImmediate({ models, User, resend, env = process.env, pace = () => new Promise(r => setTimeout(r, 600)) }) {
  if (env.NODE_ENV !== 'production' || !emailEnabled(env) || !resend) return;
  const campaign = await models.EmailCampaign.findOneAndUpdate({ status: 'queued' }, { $set: { status: 'sending' } }, { sort: { createdAt: 1 }, new: true });
  if (campaign) await deliverCampaign({ models, User, resend, campaign, pace });
}
async function deliverCampaign({ models, User, resend, campaign, pace, scheduled = false }) {
  const { EmailCampaign: Campaign, EmailMarketingSettings: Settings } = models;
  const slot = campaign.slot || `manual-${campaign.id}`;
  try {
    const segment = checked(await resend.segments.create({ name: `SpreadFast ${slot} ${campaign.id}` })); await pace();
    await Campaign.updateOne({ _id: campaign._id }, { $set: { segmentId: segment.id } });
    const users = await User.find(campaign.audience === 'registered' ? { role: { $in: ['company', 'promoter'] } } : { marketingSubscribed: true }).select('id name email role status marketingSubscribed marketingConsentAt marketingConsentSource').lean();
    const seen = new Set(); let count = 0;
    for (const user of users) {
      const fresh = await User.findOne({ id: user.id });
      if (!fresh || !eligible(fresh, campaign.audience)) continue;
      const email = fresh.email.trim().toLowerCase();
      if (seen.has(email)) continue; seen.add(email);
      if (await syncContact(resend, fresh, segment.id, pace)) count++;
    }
    if (!count) { await Campaign.updateOne({ _id: campaign._id }, { $set: { status: 'skipped', recipients: 0 } }); return; }
    // Pause remains effective until the send request begins.
    if (scheduled && !(await Settings.findById('weekly'))?.enabled) throw new Error('PAUSED_BEFORE_SEND');
    const content = renderCampaign(campaign);
    const broadcast = checked(await resend.broadcasts.create({ segmentId: segment.id, from: 'SpreadFast <noreply@tryspreadfast.com>', replyTo: TEST_RECIPIENT, name: `SpreadFast ${slot}`, subject: campaign.subject, ...content })); await pace();
    await Campaign.updateOne({ _id: campaign._id }, { $set: { broadcastId: broadcast.id, recipients: count } });
    checked(await resend.broadcasts.send(broadcast.id));
    await Campaign.updateOne({ _id: campaign._id }, { $set: { status: 'sent', sentAt: new Date() } });
  } catch {
    // Ambiguous provider responses never automatically send again. Reconcile in Resend.
    await Campaign.updateOne({ _id: campaign._id }, { $set: { status: 'needs_review', error: 'Sending stopped. Check the broadcast in Resend before taking further action.' } });
  }
}
async function queueTest(Notification, campaign, nonce) {
  const id = 'email-design-test-' + createHash('sha256').update(nonce).digest('hex');
  const existing = await Notification.findOne({ id });
  if (existing) return existing;
  const content = renderCampaign(campaign, true);
  try { await Notification.create({ id, kind: 'email_design_test', to: TEST_RECIPIENT, subject: '[Test] ' + campaign.subject, ...content, status: 'pending' }); }
  catch (e) { if (e.code !== 11000) throw e; }
  return Notification.findOne({ id });
}
function startMarketingWorker({ models, User, Notification, resend, isConnected, env = process.env }) {
  let busy = false;
  let lastTestStatus;
  console.log('[Email design test] Runtime controls', { requested: Boolean(env.EMAIL_DESIGN_TEST_NONCE), enabled: emailEnabled(env), production: env.NODE_ENV === 'production' });
  const tick = async () => {
    if (busy || !isConnected()) return;
    busy = true;
    try {
      // Explicit deployment nonce requests one test, deduplicated by the existing outbox.
      if (env.EMAIL_DESIGN_TEST_NONCE && env.NODE_ENV === 'production' && emailEnabled(env)) {
        const test = await queueTest(Notification, STARTER, env.EMAIL_DESIGN_TEST_NONCE);
        if (test.status !== lastTestStatus) {
          console.log('[Email design test] Status', { status: test.status, providerId: test.providerId || null });
          lastTestStatus = test.status;
        }
      }
      await models.EmailCampaign.updateMany({ status: 'sending', updatedAt: { $lt: new Date(Date.now() - 3600000) } }, { $set: { status: 'needs_review', error: 'Interrupted send. Reconcile in Resend; do not resend blindly.' } });
      await runImmediate({ models, User, resend, env });
      await runWeekly({ models, User, resend, env });
    } catch { console.error('[Email marketing] Worker could not complete'); }
    finally { busy = false; }
  };
  const timer = setInterval(tick, 60000); timer.unref();
  void tick();
  return () => clearInterval(timer);
}
module.exports = { STARTER, TEST_RECIPIENT, validateCampaign, renderCampaign, slotFor, eligible, syncContact, runWeekly, runImmediate, queueTest, startMarketingWorker, checked };
