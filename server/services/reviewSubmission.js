const { hasCurrentPricing } = require('./campaignPricing');
const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), {statusCode}); };
// Wallet credit and its receipt share one atomic user update. Retrying after a submission
// write failure repairs its status without crediting the wallet a second time.
async function reviewSubmission(DB, submissionId, status, requestedAmount) {
  if (!['approved', 'rejected', 'pending'].includes(status)) fail('Valid status required');
  const submission = await DB.Submission.findOne({id: submissionId});
  if (!submission) fail('Submission not found', 404);
  const campaign = await DB.Campaign.findOne({id: submission.campaignId});
  if (hasCurrentPricing(submission) && !campaign) fail('Campaign not found. Restore it before approving this payment.', 404);
  if (!hasCurrentPricing(campaign)) {
    if (submission.status === 'approved') {
      if (status !== 'approved') fail('A paid submission cannot be reopened.', 409);
      return submission;
    }
    const user = await DB.User.findOne({id: submission.userId});
    if (!user) fail('Promoter not found', 404);
    const receipt = (user.legacyCredits || []).find(c => c.submissionId === submissionId);
    if (status !== 'approved') {
      if (receipt) fail('A paid submission cannot be reopened.', 409);
      await DB.Submission.updateOne({id: submissionId, status: submission.status}, {status, reviewedAt: new Date().toISOString()});
      return;
    }
    const amount = receipt ? receipt.amount : Number(requestedAmount);
    if (!Number.isFinite(amount) || amount <= 0) fail('A positive approval amount is required.');
    await DB.User.updateOne({id: user.id, 'legacyCredits.submissionId': {$ne: submissionId}}, {
      $inc: {walletBalance: amount},
      $push: {legacyCredits: {submissionId, amount, creditedAt: new Date().toISOString()}}
    });
    const creditedUser = await DB.User.findOne({id: user.id});
    const credit = (creditedUser.legacyCredits || []).find(c => c.submissionId === submissionId);
    if (!credit) fail('Approval could not be credited. Please retry.', 409);
    const update = {status: 'approved', approvalAmount: credit.amount, reviewedAt: credit.creditedAt};
    await DB.Submission.updateOne({id: submissionId}, update);
    return {...submission, ...update};
  }
  const user = await DB.User.findOne({id: submission.userId});
  if (!user) fail('Promoter not found', 404);
  const receipt = (user.campaignCredits || []).find(c => c.campaignId === campaign.id);
  if (status !== 'approved') {
    if (receipt?.submissionId === submissionId || submission.status === 'approved') fail('A paid submission cannot be reopened.', 409);
    // Pending/rejected are review states; never overwrite a concurrently approved record.
    await DB.Submission.updateOne({id: submissionId, status: submission.status}, {status, reviewedAt: new Date().toISOString()});
    return;
  }
  const amount = campaign.pricing.earningPerCreator;
  if (requestedAmount != null && Number(requestedAmount) !== amount) fail('This campaign pays NGN ' + amount + ' per creator.');
  if (!(campaign.subscribedPromoters || []).some(p => p.promoterId === user.id)) fail('Promoter has not joined this campaign.');
  await DB.User.updateOne({id: user.id, 'campaignCredits.campaignId': {$ne: campaign.id}}, {
    $inc: {walletBalance: amount},
    $push: {campaignCredits: {campaignId: campaign.id, submissionId, amount, creditedAt: new Date().toISOString()}}
  });
  const creditedUser = await DB.User.findOne({id: user.id});
  const credit = (creditedUser.campaignCredits || []).find(c => c.campaignId === campaign.id);
  if (!credit || credit.submissionId !== submissionId) fail('This creator has already been paid for this campaign.', 409);
  const update = {status: 'approved', approvalAmount: credit.amount, reviewedAt: credit.creditedAt};
  await DB.Submission.updateOne({id: submissionId}, update);
  return {...submission, ...update};
}
module.exports = {reviewSubmission};
