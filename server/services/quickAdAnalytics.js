const { PURPOSE } = require('./quickAdPayments');
const { canUseQuickAds } = require('./quickAdAccess');
const { findQuickAdPlan } = require('../config/quickAdPlans');

const timestamp = value => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;
const whole = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
const round = value => Math.round((value + Number.EPSILON) * 100) / 100;
const settled = row => row.status === 'completed' && row.creditsApplied === true && timestamp(row.verifiedAt) > 0;

function costSettings(env) {
  const cost = env.QUICK_AD_GENERATION_COST_USD;
  const rate = env.USD_NGN_RATE;
  if (typeof cost !== 'string' || !cost.trim() || typeof rate !== 'string' || !rate.trim()) return null;
  const usd = Number(cost), exchange = Number(rate);
  return Number.isFinite(usd) && usd >= 0 && Number.isFinite(exchange) && exchange > 0
    && Number.isFinite(usd * exchange) ? usd * exchange : null;
}

function calculateQuickAdAnalytics({ users, purchases, generations }, env = process.env) {
  const byReference = new Map();
  for (const row of purchases) {
    if (row.purpose !== PURPOSE) continue;
    if (settled(row) && (typeof row.reference !== 'string' || !row.reference.trim()
      || !Number.isSafeInteger(row.amount * 100) || row.amount <= 0
      || !Number.isSafeInteger(row.credits) || row.credits < 1 || !row.userId)) throw new Error('Invalid settled purchase');
    const key = row.reference || row.id;
    const existing = byReference.get(key);
    // Prefer a verified copy over a stale pending copy, but never guess between conflicting payments.
    if (existing && settled(existing) && settled(row)
      && (existing.amount !== row.amount || existing.credits !== row.credits || existing.userId !== row.userId)) {
      throw new Error('Conflicting payment reference');
    }
    if (!existing || (!settled(existing) && settled(row))
      || (settled(existing) === settled(row) && timestamp(row.createdAt) > timestamp(existing.createdAt))) byReference.set(key, row);
  }
  const payments = [...byReference.values()];
  const paid = payments.filter(settled);
  const completed = [...new Map(generations.filter(g => g.status === 'completed').map(g => [g.id, g])).values()];
  const used = completed.filter(g => g.creditUsed === true && g.freePreview === false);
  const revenueKobo = paid.reduce((sum, row) => sum + row.amount * 100, 0);
  const totalCreditsSold = paid.reduce((sum, row) => sum + row.credits, 0);
  if (!Number.isSafeInteger(revenueKobo) || !Number.isSafeInteger(totalCreditsSold)) throw new Error('Analytics totals exceed safe precision');
  const totalRevenue = revenueKobo / 100;
  const unitCost = costSettings(env);
  const estimatedGenerationCost = unitCost === null ? null : round(completed.length * unitCost);
  if (estimatedGenerationCost !== null && !Number.isSafeInteger(Math.round(estimatedGenerationCost * 100))) throw new Error('Invalid cost estimate');
  const estimatedGrossProfit = estimatedGenerationCost === null ? null : round(totalRevenue - estimatedGenerationCost);
  const estimatedGrossMargin = estimatedGrossProfit === null ? null : totalRevenue === 0 ? 0 : Math.round(estimatedGrossProfit / totalRevenue * 1000) / 10;
  const userMap = new Map(users.map(user => [user.id, user]));
  const activity = new Map();
  const entry = userId => {
    if (!activity.has(userId)) activity.set(userId, { purchased: 0, generated: 0, lastGenerationAt: null });
    return activity.get(userId);
  };
  for (const row of paid) entry(row.userId).purchased += row.credits;
  for (const row of completed) {
    const item = entry(row.userId); item.generated += 1;
    if (timestamp(row.completedAt) > timestamp(item.lastGenerationAt)) item.lastGenerationAt = row.completedAt;
  }
  const usageIds = new Set([...users.filter(user => canUseQuickAds(user.role)).map(user => user.id), ...activity.keys()]);
  const usage = [...usageIds].map(userId => {
    const user = userMap.get(userId), item = entry(userId);
    return { userId, businessName: user?.name || 'Deleted or unavailable account',
      accountType: user?.role || paid.find(row => row.userId === userId)?.buyerRole || null,
      availableCredits: user ? whole(user.quickAdCredits) : null, totalQuickAdsGenerated: item.generated,
      estimatedGenerationsPurchased: item.purchased, lastGenerationAt: item.lastGenerationAt, createdAt: user?.createdAt || null };
  }).sort((a, b) => timestamp(b.lastGenerationAt) - timestamp(a.lastGenerationAt) || a.businessName.localeCompare(b.businessName));
  const transactions = payments.sort((a, b) => timestamp(b.verifiedAt || b.createdAt) - timestamp(a.verifiedAt || a.createdAt)).slice(0, 50).map(row => ({
    reference: row.reference || row.id, businessName: userMap.get(row.userId)?.name || 'Deleted or unavailable account',
    buyerRole: row.buyerRole || userMap.get(row.userId)?.role || null,
    email: row.email || userMap.get(row.userId)?.email || '', planId: row.planId,
    planName: findQuickAdPlan(row.planId)?.name || row.planId || 'Unknown plan',
    amountPaid: settled(row) ? row.amount : null, creditsPurchased: settled(row) ? row.credits : 0,
    status: settled(row) ? 'completed' : row.status === 'completed' ? 'unverified' : row.status || 'unknown',
    paymentDate: settled(row) ? row.verifiedAt : null, createdAt: row.createdAt || null
  }));
  return { success: true, analytics: { totalRevenue, totalCreditsSold, totalCreditsUsed: used.length,
    creditsRemaining: totalCreditsSold - used.length, totalQuickAdsGenerated: completed.length,
    estimatedGenerationCost, estimatedGrossProfit, estimatedGrossMargin }, estimatesAvailable: unitCost !== null,
    transactions, usage, transactionLimit: 50 };
}

async function getQuickAdAnalytics(DB, env = process.env) {
  // Read the three ledgers in one transaction; never mix a purchase before settlement with balances after it.
  const records = await DB.withTransaction(async tx => ({
    users: await tx.User.find({}, { id: 1, name: 1, email: 1, role: 1, quickAdCredits: 1, createdAt: 1 }),
    purchases: await tx.PaystackTransaction.find({ purpose: PURPOSE }, { id: 1, userId: 1, buyerRole: 1, email: 1, reference: 1, purpose: 1, planId: 1, amount: 1, credits: 1, creditsApplied: 1, status: 1, verifiedAt: 1, createdAt: 1 }),
    generations: await tx.QuickAdGeneration.find({ status: 'completed' }, { id: 1, userId: 1, status: 1, creditUsed: 1, freePreview: 1, completedAt: 1 })
  }));
  return calculateQuickAdAnalytics(records, env);
}
module.exports = { getQuickAdAnalytics, calculateQuickAdAnalytics };
