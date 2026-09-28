const mongoose = require('mongoose');

// Credits and generation counters are whole, non-negative units.
const quickAdCounter = () => ({
  type: Number,
  default: 0,
  required: true,
  min: 0,
  validate: {
    validator: Number.isSafeInteger,
    message: 'Quick Ads counters must be whole, non-negative safe integers.'
  }
});

const userSchema = new mongoose.Schema({
  id: { type: String },
  name: { type: String },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['promoter', 'company', 'admin'], default: 'promoter' },
  status: { type: String, enum: ['active', 'suspended', 'banned'], default: 'active' },
  tokenVersion: { type: Number, default: 0 },
  quickAdCredits: quickAdCounter(),
  quickAdsGenerated: quickAdCounter(),
  quickAdFreePreviewUsed: { type: Boolean, default: false, required: true },
  quickAdTotalCreditsPurchased: quickAdCounter(),
  quickAdTotalCreditsUsed: quickAdCounter(),
  quickAdGenerationLock: { type: String, default: null },
  quickAdGenerationLockExpiresAt: { type: Date, default: null },
  legacyCredits: { type: [{ submissionId: String, amount: Number, creditedAt: String }], default: [] },
  walletBalance: { type: Number, default: 0 },
  campaignCredits: { type: [{ campaignId: String, submissionId: String, amount: Number, creditedAt: String }], default: [] },
  bankDetails: { type: Object, default: null },
  lastLogin: { type: Date },
  socialMedia: {
    tiktok: { type: String, default: '' },
    instagram: { type: String, default: '' },
    twitter: { type: String, default: '' },
    facebook: { type: String, default: '' },
    youtube: { type: String, default: '' }
  },
  resetPasswordTokenHash: { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
