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

function calculateQuickAdAnalytics({ users, purchases, generations }, env = process.env, now = Date.now()) {
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
  const totalCreditsUsed = used.reduce((sum, g) => sum + (whole(g.creditsUsed) || whole(g.creditCost) || 1), 0);
  const isCommercial = g => g.provider === 'ai-commercials' || ['cinematic', 'showcase', 'lifestyle', 'promo'].includes(g.style);
  // A flat Quick Ad cost cannot estimate multi-scene commercial costs.
  const unitCost = generations.some(isCommercial) ? null : costSettings(env);
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
  const since = now - 30 * 24 * 60 * 60 * 1000;
  const recent = value => timestamp(value) >= since && timestamp(value) <= now;
  const accounts = users.filter(u => canUseQuickAds(u.role) && (!env.ADMIN_EMAIL || u.email !== env.ADMIN_EMAIL));
  const accountIds = new Set(accounts.map(u => u.id));
  const buyers = new Map();
  for (const row of paid) {
    const buyer = buyers.get(row.userId) || { userId: row.userId, name: userMap.get(row.userId)?.name || 'Deleted or unavailable account', purchases: 0, revenue: 0 };
    buyer.purchases += 1;
    buyer.revenue = round(buyer.revenue + row.amount);
    buyers.set(row.userId, buyer);
  }
  const paidAccounts = [...buyers.keys()].filter(id => accountIds.has(id)).length;
  const rate = (n, d) => d ? round(n / d * 100) : null;
  const generationRows = [...new Map(generations.map(g => [g.id, g])).values()];
  const productStats = ['Quick Ad', 'Fashion Studio', 'Auto Studio', 'Product Studio', 'AI Commercial'].map(product => {
    const rows = generationRows.filter(g => (g.studioType === 'auto' ? 'Auto Studio' : g.studioType === 'product' ? 'Product Studio' : g.studioType === 'fashion' ? 'Fashion Studio' : isCommercial(g) ? 'AI Commercial' : g.style === 'fashion_studio' ? 'Fashion Studio' : 'Quick Ad') === product);
    const successful = rows.filter(g => g.status === 'completed');
    const failed = rows.filter(g => g.status === 'failed').length;
    return { product, completed: successful.length, failed, pending: rows.filter(g => g.status === 'pending').length,
      successRate: rate(successful.length, successful.length + failed),
      creditsUsed: successful.filter(g => g.creditUsed === true && g.freePreview === false).reduce((sum, g) => sum + (whole(g.creditsUsed) || whole(g.creditCost) || 1), 0) };
  });
  const growth = {
    accounts: accounts.length,
    newAccounts30d: accounts.filter(u => recent(u.createdAt)).length,
    payingCustomers: buyers.size,
    repeatCustomers: [...buyers.values()].filter(b => b.purchases > 1).length,
    paidConversion: rate(paidAccounts, accounts.length),
    activeGenerators30d: new Set(completed.filter(g => recent(g.completedAt)).map(g => g.userId)).size,
    revenue30d: round(paid.filter(p => recent(p.verifiedAt)).reduce((sum, p) => sum + p.amount, 0)),
    averageOrderValue: paid.length ? round(totalRevenue / paid.length) : null,
    freePreviews: completed.filter(g => g.freePreview === true).length,
    pendingPayments: payments.filter(p => p.status === 'pending').length,
    failedPayments: payments.filter(p => p.status === 'failed').length,
    failedGenerations: generationRows.filter(g => g.status === 'failed').length,
    pendingGenerations: generationRows.filter(g => g.status === 'pending').length,
    expiredGenerations: generationRows.filter(g => g.status === 'pending' && timestamp(g.expiresAt) > 0 && timestamp(g.expiresAt) < now).length,
    brandingFailures: completed.filter(g => g.brandingStatus === 'failed').length,
    availableCredits: accounts.reduce((sum, u) => sum + whole(u.quickAdCredits), 0)
  };
  const estimates = generationRows.filter(g => Number.isFinite(g.estimatedTotalCost));
  const reported = generationRows.filter(g => Number.isFinite(g.providerReportedTotalCost));
  const providerExpenses = {
    currency: 'USD', estimatedTotal: round(estimates.reduce((sum,g)=>sum+g.estimatedTotalCost,0)),
    estimatedFailed: round(estimates.filter(g=>g.status==='failed').reduce((sum,g)=>sum+g.estimatedTotalCost,0)),
    reportedTotal: reported.length ? round(reported.reduce((sum,g)=>sum+g.providerReportedTotalCost,0)) : null,
    estimatedRecords: estimates.length, totalRecords: generationRows.length,
    byCategory: Object.fromEntries(['imageGeneration','videoGeneration','voiceGeneration','other'].map(key=>[key,round(estimates.reduce((sum,g)=>sum+(Number(g.providerCosts?.[key])||0),0))]))
  };
  return { success: true, providerExpenses, growth, productStats, topCustomers: [...buyers.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10), asOf: new Date(now).toISOString(), analytics: { totalRevenue, totalCreditsSold, totalCreditsUsed,
    creditsRemaining: totalCreditsSold - totalCreditsUsed, totalQuickAdsGenerated: completed.length,
    estimatedGenerationCost, estimatedGrossProfit, estimatedGrossMargin }, estimatesAvailable: unitCost !== null,
    transactions, usage, transactionLimit: 50 };
}

async function getQuickAdAnalytics(DB, env = process.env) {
  // Read the three ledgers in one transaction; never mix a purchase before settlement with balances after it.
  const records = await DB.withTransaction(async tx => ({
    users: await tx.User.find({}, { id: 1, name: 1, email: 1, role: 1, quickAdCredits: 1, createdAt: 1 }),
    purchases: await tx.PaystackTransaction.find({ purpose: PURPOSE }, { id: 1, userId: 1, buyerRole: 1, email: 1, reference: 1, purpose: 1, planId: 1, amount: 1, credits: 1, creditsApplied: 1, status: 1, verifiedAt: 1, createdAt: 1 }),
    generations: await tx.QuickAdGeneration.find({}, { id: 1, userId: 1, status: 1, style: 1, provider: 1, creditUsed: 1, creditsUsed: 1, creditCost: 1, freePreview: 1, completedAt: 1, expiresAt: 1, brandingStatus: 1, studioType: 1, estimatedTotalCost: 1, providerReportedTotalCost: 1, providerCosts: 1 })
  }));
  return calculateQuickAdAnalytics(records, env);
}
module.exports = { getQuickAdAnalytics, calculateQuickAdAnalytics };
