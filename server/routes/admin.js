const express = require('express');
const router = express.Router();
const { feeStats } = require('../services/campaignPricing');
const { reviewSubmission } = require('../services/reviewSubmission');
const { reviewWithdrawal } = require('../services/wallet');
const { getQuickAdAnalytics } = require('../services/quickAdAnalytics');
const database = req => req.app.locals.db;

const { authenticateToken } = require('../middleware/auth');

const adminOnly = (req, res, next) => {
  if (req.user.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

const auth = [authenticateToken, adminOnly];

router.get('/quick-ads/analytics', auth, async (req, res) => {
  try {
    res.set('Cache-Control', 'private, no-store').json(await getQuickAdAnalytics(database(req)));
  } catch {
    console.error('[Quick Ads analytics] Could not read financial analytics');
    res.status(503).json({ success: false, message: 'Quick Ads analytics could not be loaded. Please try again.' });
  }
});

// ==================== STATS ====================
router.get('/all-stats', auth, async (req, res) => {
  try {
    const User = database(req).User;
    const Campaign = database(req).Campaign;
    const Submission = database(req).Submission;
    const Withdrawal = database(req).Withdrawal;

    const users = await User.find({});
    const campaigns = await Campaign.find({});
    const submissions = await Submission.find({});
    const withdrawals = await Withdrawal.find({});

    const totalWithdrawalAmount = withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);

    res.json({
      success: true,
      stats: {
        totalUsers: users.length,
        totalPromoters: users.filter(u => u.role === 'promoter').length,
        totalCompanies: users.filter(u => u.role === 'company').length,
        totalCampaigns: campaigns.length,
        activeCampaigns: campaigns.filter(c => c.status === 'active').length,
        totalSubmissions: submissions.length,
        pendingSubmissions: submissions.filter(s => s.status === 'pending').length,
        approvedSubmissions: submissions.filter(s => s.status === 'approved').length,
        rejectedSubmissions: submissions.filter(s => s.status === 'rejected').length,
        totalWithdrawals: withdrawals.length,
        pendingWithdrawals: withdrawals.filter(w => w.status === 'pending').length,
        completedWithdrawals: withdrawals.filter(w => w.status === 'completed').length,
        totalWithdrawalAmount,
        pendingWithdrawalAmount: withdrawals
          .filter(w => w.status === 'pending')
          .reduce((sum, w) => sum + w.amount, 0),
        ...feeStats(campaigns, await database(req).PaystackTransaction.find({}))
      }
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== CAMPAIGNS ====================
router.get('/campaigns', auth, async (req, res) => {
  try {
    const Campaign = database(req).Campaign;
    const campaigns = await Campaign.find({});
    res.json({ success: true, campaigns });
  } catch (err) {
    console.error('Admin campaigns error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/campaigns/:campaignId', auth, async (req, res) => {
  try {
    const Campaign = database(req).Campaign;
    const { status } = req.body;

    if (!status || !['active', 'paused', 'closed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Valid status required' });
    }

    const campaign = await Campaign.findOne({ id: req.params.campaignId });
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });

    await Campaign.updateOne(
      { id: req.params.campaignId },
      { status, statusUpdatedAt: new Date().toISOString() }
    );

    res.json({ success: true, message: `Campaign ${status}` });
  } catch (err) {
    console.error('Admin campaign patch error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/campaigns/:campaignId', auth, async (req, res) => {
  try {
    const Campaign = database(req).Campaign;
    const campaign = await Campaign.findOne({ id: req.params.campaignId });
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });

    await Campaign.deleteOne({ id: req.params.campaignId });
    res.json({ success: true, message: 'Campaign deleted' });
  } catch (err) {
    console.error('Admin campaign delete error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== SUBMISSIONS ====================
router.get('/submissions', auth, async (req, res) => {
  try {
    const Submission = database(req).Submission;
    const Campaign = database(req).Campaign;

    const submissions = await Submission.find({});
    const campaigns = await Campaign.find({});

    const enriched = submissions.map(sub => {
      const s = sub.toObject ? sub.toObject() : sub;
      return {
        ...s,
        campaignName: campaigns.find(c => c.id === s.campaignId)?.title || 'Unknown'
      };
    });

    res.json({ success: true, submissions: enriched });
  } catch (err) {
    console.error('Admin submissions error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/submissions/:submissionId', auth, async (req, res) => {
  try {
    const Submission = database(req).Submission;
    const User = database(req).User;

    const { status, approvalAmount } = req.body;

    if (!status || !['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Valid status required' });
    }

    await reviewSubmission({Submission, User, Campaign: database(req).Campaign}, req.params.submissionId, status, approvalAmount);
    res.json({ success: true, message: `Submission ${status}` });
  } catch (err) {
    console.error('Admin submission patch error:', err);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

// ==================== WITHDRAWALS ====================
router.get('/withdrawals', auth, async (req, res) => {
  try {
    const Withdrawal = database(req).Withdrawal;
    const withdrawals = await Withdrawal.find({});
    res.json({ success: true, withdrawals });
  } catch (err) {
    console.error('Admin withdrawals error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/withdrawals/:withdrawalId', auth, async (req, res) => {
  try {
    const withdrawal = await reviewWithdrawal(database(req), req.params.withdrawalId, req.body.status);
    res.json({success: true, message: 'Withdrawal reviewed', withdrawal});
  } catch (error) { res.status(error.statusCode || 500).json({success: false, message: error.message}); }
});

// ==================== USERS ====================
router.get('/users', auth, async (req, res) => {
  try {
    const User = database(req).User;
    const users = await User.find({}, { password: 0 });
    res.json({ success: true, users });
  } catch (err) {
    console.error('Admin users error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
