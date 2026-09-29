const axios = require('axios');
const { verifyCharge } = require('./campaignPricing');
const { accountSummary, fail } = require('./quickAdCredits');

const { enqueueEmail } = require('./emailNotifications');

const PURPOSE = 'quick_ad_credits';
function assertCampaignPayment(transaction) {
  if (transaction?.purpose === PURPOSE) {
    fail('WRONG_PAYMENT_PURPOSE', 'This payment purchases Quick Ads credits and cannot fund a campaign.', 400);
  }
}
function assertCreditPurchase(transaction) {
  if (!transaction || transaction.purpose !== PURPOSE) fail('PAYMENT_NOT_FOUND', 'Quick Ads purchase not found.', 404);
  if (!Number.isSafeInteger(transaction.credits) || transaction.credits < 1
      || !Number.isSafeInteger(transaction.amount * 100) || transaction.amount <= 0
      || transaction.pricing?.version !== 'quick-ads-v1'
      || transaction.pricing.planId !== transaction.planId
      || transaction.pricing.credits !== transaction.credits
      || transaction.pricing.amount !== transaction.amount) {
    fail('INVALID_PURCHASE', 'This purchase needs support. Please contact us with your reference.', 503);
  }
}

// The balance increment and processed marker commit together in the existing Mongo transaction layer.
async function awardQuickAdCredits(DB, { reference, userId, charge }) {
  return DB.withTransaction(async tx => {
    const transaction = await tx.PaystackTransaction.findOne({ reference, ...(userId ? { userId } : {}) });
    assertCreditPurchase(transaction);
    const user = await tx.User.findOne({ id: transaction.userId });
    const account = accountSummary(user);
    if (transaction.creditsApplied) return { success: true, reference, creditsPurchased: transaction.credits, quickAdCredits: account.quickAdCredits, alreadyProcessed: true };
    try { verifyCharge(transaction, charge); } catch {
      fail('PAYMENT_MISMATCH', 'Payment does not match this Quick Ads purchase.', 400);
    }
    if (typeof charge.customer?.email !== 'string' || charge.customer.email.toLowerCase() !== transaction.email.toLowerCase()) {
      fail('PAYMENT_MISMATCH', 'Payment does not match this Quick Ads purchase.', 400);
    }
    const balance = account.quickAdCredits + transaction.credits;
    const purchased = account.quickAdTotalCreditsPurchased + transaction.credits;
    if (!Number.isSafeInteger(balance) || !Number.isSafeInteger(purchased)) fail('INVALID_CREDIT_ACCOUNT', 'Your credit account needs support.', 503);
    await tx.User.updateOne({ id: user.id }, { $inc: { quickAdCredits: transaction.credits, quickAdTotalCreditsPurchased: transaction.credits }, $set: { quickAdsLowCreditNotified: false, quickAdsZeroCreditNotified: false } });
    const verifiedAt = new Date().toISOString();
    await tx.PaystackTransaction.updateOne({ reference }, { $set: {
      creditsApplied: true, status: 'completed', verifiedAt
    } });
    const details = { amount: transaction.amount, credits: transaction.credits, balance, reference, date: verifiedAt, role: transaction.buyerRole || user.role };
    await enqueueEmail(tx, 'quick_purchase', reference, user, details);
    await enqueueEmail(tx, 'admin_quick_purchase', reference, user, details);
    return { success: true, reference, creditsPurchased: transaction.credits, quickAdCredits: balance, alreadyProcessed: false };
  });
}
async function verifyQuickAdPayment(DB, reference, userId, paystackConfig, http = axios) {
  if (typeof reference !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(reference)) fail('INVALID_REFERENCE', 'Invalid payment reference.', 400);
  const transaction = await DB.PaystackTransaction.findOne({ reference, ...(userId ? { userId } : {}) });
  assertCreditPurchase(transaction);
  if (transaction.creditsApplied) return awardQuickAdCredits(DB, { reference, userId });
  if (!paystackConfig?.secretKey) fail('PAYMENTS_UNAVAILABLE', 'Payments are temporarily unavailable.', 503);
  const response = await http.get(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${paystackConfig.secretKey}` }, timeout: 15000
  });
  if (!response.data?.status || response.data.data?.status !== 'success') {
    if (response.data?.status && response.data.data?.status === 'failed') {
      const charge = response.data.data;
      await DB.withTransaction(async tx => {
        const stored = await tx.PaystackTransaction.findOne({ reference, ...(userId ? { userId } : {}) });
        assertCreditPurchase(stored);
        if (stored.creditsApplied) return;
        try { verifyCharge(stored, { ...charge, status: 'success' }); } catch {
          fail('PAYMENT_MISMATCH', 'Payment does not match this Quick Ads purchase.', 400);
        }
        if (typeof charge.customer?.email !== 'string' || charge.customer.email.toLowerCase() !== stored.email.toLowerCase()) {
          fail('PAYMENT_MISMATCH', 'Payment does not match this Quick Ads purchase.', 400);
        }
        const owner = await tx.User.findOne({ id: stored.userId });
        if (!owner) fail('ACCOUNT_NOT_FOUND', 'Account not found.', 404);
        await tx.PaystackTransaction.updateOne({ reference }, { $set: { status: 'failed' } });
        await enqueueEmail(tx, 'quick_payment_failed', reference, owner, { amount: stored.amount, reference });
      });
    }
    fail('PAYMENT_UNCONFIRMED', 'We could not confirm this payment yet. Please retry confirmation using the same reference.', 409);
  }
  return awardQuickAdCredits(DB, { reference, userId, charge: response.data.data });
}
module.exports = { PURPOSE, assertCampaignPayment, awardQuickAdCredits, verifyQuickAdPayment };
