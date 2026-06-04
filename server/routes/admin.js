const express = require('express');
const router = express.Router();

const { authenticateToken } = require('../middleware/auth');

const Campaign = require('../models/Campaign');
const Submission = require('../models/Submission');
const Withdrawal = require('../models/Withdrawal');
const User = require('../models/user');

const adminOnly = (req, res, next) => {
  if (req.user.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

const auth = [authenticateToken, adminOnly];

// Campaigns
router.get('/campaigns', auth, async (req, res) => {
  try {
    const campaigns = await Campaign.find({});
    res.json({ success: true, campaigns });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.patch('/campaigns/:campaignId', auth, async (req, res) => {
  try {
    const { status } = req.body;
    await Campaign.findOneAndUpdate({ id: req.params.campaignId }, { status });
    res.json({ success: true, message: `Campaign ${status}` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/campaigns/:campaignId', auth, async (req, res) => {
  try {
    await Campaign.findOneAndDelete({ id: req.params.campaignId });
    res.json({ success: true, message: 'Campaign deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Submissions
router.get('/submissions', auth, async (req, res) => {
  try {
    const submissions = await Submission.find({});
    const campaigns = await Campaign.find({});
    const enriched = submissions.map(sub => {
      const s = sub.toObject ? sub.toObject() : sub;
      return { ...s, campaignName: campaigns.find(c => c.id === s.campaignId)?.title || 'Unknown' };
    });
    res.json({ success: true, submissions: enriched });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.patch('/submissions/:submissionId', auth, async (req, res) => {
  try {
    const { status, approvalAmount } = req.body;
    const submission = await Submission.findOne({ id: req.params.submissionId });
    if (!submission) return res.status(404).json({ success: false, message: 'Submission not found' });

    const update = { status, reviewedAt: new Date().toISOString() };
    if (status === 'approved' && approvalAmount) {
      update.approvalAmount = approvalAmount;
      const user = await User.findOne({ id: submission.userId });
      if (user) {
        await User.findOneAndUpdate({ id: submission.userId }, { walletBalance: (user.walletBalance || 0) + parseFloat(approvalAmount) });
      }
    }
    await Submission.findOneAndUpdate({ id: req.params.submissionId }, update);
    res.json({ success: true, message: `Submission ${status}` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Withdrawals
router.get('/withdrawals', auth, async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({});
    res.json({ success: true, withdrawals });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.patch('/withdrawals/:withdrawalId', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const withdrawal = await Withdrawal.findOne({ id: req.params.withdrawalId });
    if (!withdrawal) return res.status(404).json({ success: false, message: 'Withdrawal not found' });

    await Withdrawal.findOneAndUpdate({ id: req.params.withdrawalId }, { status, reviewedAt: new Date().toISOString() });

    if (status === 'rejected' && withdrawal.status === 'pending') {
      const userId = withdrawal.userId || withdrawal.promoterId;
      const user = await User.findOne({ id: userId });
      if (user) {
        await User.findOneAndUpdate({ id: userId }, { walletBalance: (user.walletBalance || 0) + withdrawal.amount });
      }
    }
    res.json({ success: true, message: `Withdrawal marked ${status}` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;