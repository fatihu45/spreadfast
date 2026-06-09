const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const { authenticateToken } = require('../middleware/auth');

const adminOnly = (req, res, next) => {
  if (req.user.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

const auth = [authenticateToken, adminOnly];

// ==================== STATS ====================
router.get('/all-stats', auth, async (req, res) => {
  try {
    const User = mongoose.model('User');
    const Campaign = mongoose.model('Campaign');
    const Submission = mongoose.model('Submission');
    const Withdrawal = mongoose.model('Withdrawal');

    const users = await User.find({});
    const campaigns = await Campaign.find({});
    const submissions = await Submission.find({});
    const withdrawals = await Withdrawal.find({});

    const totalCampaignBudget = campaigns.reduce((sum, c) => sum + (parseFloat(c.budget) || 0), 0);
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
        totalCampaignFees: totalCampaignBudget * 0.05,
        totalWithdrawalFees: totalWithdrawalAmount * 0.05
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
    const Campaign = mongoose.model('Campaign');
    const campaigns = await Campaign.find({});
    res.json({ success: true, campaigns });
  } catch (err) {
    console.error('Admin campaigns error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/campaigns/:campaignId', auth, async (req, res) => {
  try {
    const Campaign = mongoose.model('Campaign');
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
    const Campaign = mongoose.model('Campaign');
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
    const Submission = mongoose.model('Submission');
    const Campaign = mongoose.model('Campaign');

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
    const Submission = mongoose.model('Submission');
    const User = mongoose.model('User');

    const { status, approvalAmount } = req.body;

    if (!status || !['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Valid status required' });
    }

    const submission = await Submission.findOne({ id: req.params.submissionId });
    if (!submission) return res.status(404).json({ success: false, message: 'Submission not found' });

    const update = { status, reviewedAt: new Date().toISOString() };

    if (status === 'approved' && approvalAmount) {
      update.approvalAmount = parseFloat(approvalAmount);
      const user = await User.findOne({ id: submission.userId });
      if (user) {
        await User.updateOne(
          { id: submission.userId },
          { walletBalance: (user.walletBalance || 0) + parseFloat(approvalAmount) }
        );
      }
    }

    await Submission.updateOne({ id: req.params.submissionId }, update);
    res.json({ success: true, message: `Submission ${status}` });
  } catch (err) {
    console.error('Admin submission patch error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== WITHDRAWALS ====================
router.get('/withdrawals', auth, async (req, res) => {
  try {
    const Withdrawal = mongoose.model('Withdrawal');
    const withdrawals = await Withdrawal.find({});
    res.json({ success: true, withdrawals });
  } catch (err) {
    console.error('Admin withdrawals error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/withdrawals/:withdrawalId', auth, async (req, res) => {
  try {
    const Withdrawal = mongoose.model('Withdrawal');
    const User = mongoose.model('User');

    const { status } = req.body;

    if (!status || !['completed', 'pending', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Valid status required' });
    }

    const withdrawal = await Withdrawal.findOne({ id: req.params.withdrawalId });
    if (!withdrawal) return res.status(404).json({ success: false, message: 'Withdrawal not found' });

    const oldStatus = withdrawal.status;
    await Withdrawal.updateOne(
      { id: req.params.withdrawalId },
      { status, reviewedAt: new Date().toISOString() }
    );

    // Refund wallet if rejected
    if (status === 'rejected' && oldStatus === 'pending') {
      const userId = withdrawal.userId || withdrawal.promoterId;
      const user = await User.findOne({ id: userId });
      if (user) {
        await User.updateOne(
          { id: userId },
          { walletBalance: (user.walletBalance || 0) + withdrawal.amount }
        );
      }
    }

    res.json({ success: true, message: `Withdrawal marked ${status}` });
  } catch (err) {
    console.error('Admin withdrawal patch error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== USERS ====================
router.get('/users', auth, async (req, res) => {
  try {
    const User = mongoose.model('User');
    const users = await User.find({}, { password: 0 });
    res.json({ success: true, users });
  } catch (err) {
    console.error('Admin users error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;