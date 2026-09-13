import { creatorSlots, creatorPool, creatorEarning, newCreatorCount, isValidCampaignBudget } from './campaignPricing';
const quoteCampaign = amount => ({version: 'creator-20000-included-25-v1', creatorCount: amount / 20000, creatorPool: amount * 0.75, earningPerCreator: 15000});
test.each([1, 2, 3, 5])('business pays 20,000 for each of %i creators and creators receive 15,000', count => {
  const amount = count * 20000;
  const campaign = {budget: amount, pricing: quoteCampaign(amount)};
  expect(isValidCampaignBudget(amount)).toBe(true);
  expect(newCreatorCount(amount)).toBe(count);
  expect(creatorSlots(campaign)).toBe(count);
  expect(creatorPool(campaign)).toBe(count * 15000);
  expect(creatorEarning(campaign)).toBe(15000);
});
test.each([0, -20000, 10000, 25000, 20000.01, 'invalid', Infinity])('rejects invalid new budget %s', amount => {
  expect(isValidCampaignBudget(amount)).toBe(false);
});
test('legacy campaigns retain their previous slots and approval-based earnings', () => {
  expect(creatorSlots({budget: 20000})).toBe(4);
  expect(creatorPool({budget: 20000})).toBe(20000);
  expect(creatorEarning({budget: 20000})).toBeNull();
});
