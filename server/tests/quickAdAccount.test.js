const test = require('node:test');
const assert = require('node:assert/strict');
const User = require('../models/user');

const counters = ['quickAdCredits', 'quickAdsGenerated', 'quickAdTotalCreditsPurchased', 'quickAdTotalCreditsUsed'];
const account = role => ({ id: 'test-account', name: 'Test', email: 'test@example.invalid', password: 'test-only', role });

for (const role of ['company', 'promoter']) {
  test(`${role} accounts default to zero credits and an unused preview`, () => {
    const user = new User(account(role));
    for (const field of counters) assert.equal(user[field], 0);
    assert.equal(user.quickAdFreePreviewUsed, false);
    assert.equal(user.validateSync(), undefined);
  });
}

test('legacy MongoDB documents receive defaults without overwriting existing counters', () => {
  const legacy = User.hydrate(account('company'));
  for (const field of counters) assert.equal(legacy[field], 0);
  assert.equal(legacy.quickAdFreePreviewUsed, false);
  const existing = User.hydrate({ ...account('promoter'), quickAdCredits: 3, quickAdsGenerated: 2,
    quickAdFreePreviewUsed: true, quickAdTotalCreditsPurchased: 5, quickAdTotalCreditsUsed: 2 });
  assert.equal(existing.quickAdCredits, 3);
  assert.equal(existing.quickAdsGenerated, 2);
  assert.equal(existing.quickAdTotalCreditsPurchased, 5);
  assert.equal(existing.quickAdTotalCreditsUsed, 2);
  assert.equal(existing.quickAdFreePreviewUsed, true);
});

test('Quick Ads counters reject negative, fractional, missing, and unsafe values', () => {
  for (const field of counters) {
    for (const value of [-1, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1, null]) {
      const user = new User({ ...account('company'), [field]: value });
      assert.ok(user.validateSync()?.errors[field], `${field} accepted ${value}`);
    }
  }
});
