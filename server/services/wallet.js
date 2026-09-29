const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), {statusCode}); };

const { enqueueEmail } = require('./emailNotifications');

// All balance changes and withdrawal state changes commit together.
async function requestWithdrawal(DB, userId, amount, bankDetails, id) {
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount < 1000) {
    fail('Withdrawal amount must be a whole number of naira, at least NGN 1,000.');
  }
  return DB.withTransaction(async tx => {
    const user = await tx.User.findOne({id: userId});
    if (!user) fail('User not found', 404);
    const details = bankDetails || user.bankDetails;
    if (!details || typeof details !== 'object' || !details.accountNumber || (!details.bankName && !details.bankCode)) fail('Bank details required before withdrawal');
    if (!Number.isFinite(user.walletBalance) || user.walletBalance < amount) fail('Insufficient balance');
    const createdAt = new Date().toISOString();
    const withdrawal = {id, userId, promoterId: userId, userName: user.name, promoterName: user.name,
      email: user.email, amount, bankDetails: details, status: 'pending', createdAt, timestamp: createdAt};
    await tx.User.updateOne({id: userId}, {$inc: {walletBalance: -amount}});
    await tx.Withdrawal.create(withdrawal);
    const mail = { amount, reference: id, date: createdAt, balance: user.walletBalance - amount };
    await enqueueEmail(tx, 'withdrawal_requested', id, user, mail);
    await enqueueEmail(tx, 'admin_withdrawal_requested', id, user, mail);
    return {withdrawal, newBalance: user.walletBalance - amount};
  });
}

async function reviewWithdrawal(DB, id, requestedStatus) {
  const status = requestedStatus === 'approved' ? 'completed' : requestedStatus;
  if (!['pending', 'completed', 'rejected'].includes(status)) fail('Valid status required');
  return DB.withTransaction(async tx => {
    const withdrawal = await tx.Withdrawal.findOne({id});
    if (!withdrawal) fail('Withdrawal not found', 404);
    const previous = withdrawal.status === 'approved' ? 'completed' : withdrawal.status;
    if (previous === status) return withdrawal;
    if (previous !== 'pending') fail('A reviewed withdrawal cannot be reopened or changed.', 409);
    if (status === 'rejected') {
      const userId = withdrawal.userId || withdrawal.promoterId;
      const user = await tx.User.findOne({id: userId});
      if (!user) fail('Promoter not found', 404);
      if (!Number.isFinite(withdrawal.amount) || withdrawal.amount <= 0) fail('Invalid stored withdrawal amount', 409);
      await tx.User.updateOne({id: userId}, {$inc: {walletBalance: withdrawal.amount}});
    }
    const reviewedAt = new Date().toISOString();
    await tx.Withdrawal.updateOne({id}, {status, reviewedAt});
    if (status === 'completed') {
      const user = await tx.User.findOne({ id: withdrawal.userId || withdrawal.promoterId });
      if (user) await enqueueEmail(tx, 'withdrawal_paid', id, user, { amount: withdrawal.amount, reference: id, date: reviewedAt });
    }
    return {...withdrawal, status};
  });
}

module.exports = {requestWithdrawal, reviewWithdrawal};
