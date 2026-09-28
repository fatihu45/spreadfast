// Amounts are naira. Only the backend selects purchase prices and credit counts.
const QUICK_AD_CREDIT_PRICE = 1700;
const QUICK_AD_PLANS = Object.freeze([
  Object.freeze({ id: 'single', name: 'Try One', price: 1700, credits: 1, cta: 'Buy 1 Credit' }),
  Object.freeze({ id: 'starter', name: 'Starter', price: 5000, credits: 3, cta: 'Get Starter', recommended: true }),
  Object.freeze({ id: 'growth', name: 'Growth', price: 10000, credits: 6, cta: 'Get Growth' }),
  Object.freeze({ id: 'business', name: 'Business', price: 20000, credits: 11, cta: 'Get Business' })
]);
const findQuickAdPlan = id => QUICK_AD_PLANS.find(plan => plan.id === id);
module.exports = { QUICK_AD_CREDIT_PRICE, QUICK_AD_PLANS, findQuickAdPlan };
