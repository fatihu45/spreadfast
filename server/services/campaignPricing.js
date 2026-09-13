// Financial terms are captured at payment initiation; unversioned campaigns keep legacy terms.
const CREATOR_PRICE = 20000;
const PLATFORM_PERCENT = 25;
const PRICING_VERSION = 'creator-20000-included-25-v1';
function quoteCampaign(amount) {
  const grossAmount = typeof amount === 'number' || typeof amount === 'string' ? Number(amount) : NaN;
  if (!Number.isSafeInteger(grossAmount * 100) || grossAmount < CREATOR_PRICE || grossAmount % CREATOR_PRICE !== 0) {
    throw Object.assign(new Error('Budget must be a multiple of NGN 20,000 (one promoter).'), {statusCode: 400});
  }
  return { version: PRICING_VERSION, grossAmount, creatorCount: grossAmount / CREATOR_PRICE,
    pricePerCreator: CREATOR_PRICE, platformPercent: PLATFORM_PERCENT,
    platformAmount: grossAmount * PLATFORM_PERCENT / 100,
    creatorPool: grossAmount * (100 - PLATFORM_PERCENT) / 100,
    earningPerCreator: CREATOR_PRICE * (100 - PLATFORM_PERCENT) / 100 };
}
const hasCurrentPricing = campaign => campaign?.pricing?.version === PRICING_VERSION;
const creatorSlots = campaign => hasCurrentPricing(campaign) ? campaign.pricing.creatorCount
  : Math.floor((Number(campaign.budget || campaign.amountPaid) || 0) / 5000);
function feeStats(campaigns, transactions = []) {
  // Keep revenue after a campaign is deleted. Pending/failed charges are not revenue.
  const current = transactions.filter(t => hasCurrentPricing(t) && (t.status === 'completed' || t.campaignCreated));
  return {
    totalCampaignFees: current.reduce((sum, c) => sum + c.pricing.platformAmount, 0),
    totalCreatorAllocation: current.reduce((sum, c) => sum + c.pricing.creatorPool, 0),
    totalWithdrawalFees: 0,
    legacyCampaignFeeEstimate: campaigns.filter(c => !hasCurrentPricing(c))
      .reduce((sum, c) => sum + (Number(c.budget) || 0) * 0.05, 0)
  };
}
function verifyCharge(transaction, charge) {
  if (!transaction || !charge || charge.status !== 'success' || charge.currency !== 'NGN'
      || charge.reference !== transaction.reference || charge.amount !== Number(transaction.amount) * 100) {
    throw Object.assign(new Error('Payment does not match the campaign transaction.'), {statusCode: 400});
  }
}
module.exports = { CREATOR_PRICE, PLATFORM_PERCENT, PRICING_VERSION, quoteCampaign, hasCurrentPricing, creatorSlots, feeStats, verifyCharge };
