// Existing campaigns without a pricing snapshot retain their original terms.
export const CREATOR_PRICE = 20000;
export const PRICING_VERSION = 'creator-20000-included-25-v1';
export const hasCurrentPricing = campaign => campaign?.pricing?.version === PRICING_VERSION;
export const newCreatorCount = amount => Math.floor((Number(amount) || 0) / CREATOR_PRICE);
export const isValidCampaignBudget = amount => Number.isSafeInteger(Number(amount) * 100) && Number(amount) >= CREATOR_PRICE && Number(amount) % CREATOR_PRICE === 0;
export const creatorSlots = campaign => hasCurrentPricing(campaign) ? campaign.pricing.creatorCount : Math.floor((Number(campaign.budget || campaign.amountPaid) || 0) / 5000);
export const creatorPool = campaign => hasCurrentPricing(campaign) ? campaign.pricing.creatorPool : campaign.budget;
export const creatorEarning = campaign => hasCurrentPricing(campaign) ? campaign.pricing.earningPerCreator : null;
