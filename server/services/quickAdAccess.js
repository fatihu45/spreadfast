const canUseQuickAds = role => role === 'company' || role === 'promoter';
const quickAdAccountOnly = (req, res, next) => canUseQuickAds(req.user?.role) ? next()
  : res.status(403).json({ success: false, message: 'A company or promoter account is required for Quick Ads.' });
module.exports = { canUseQuickAds, quickAdAccountOnly };
