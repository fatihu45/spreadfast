const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  budget: { type: String, required: true },
  amountPaid: { type: Number, default: 0 },
  companyId: { type: String, required: true },
  socialMediaPlatforms: { type: [String], default: [] },
  status: { type: String, default: 'active' },
  paystackReference: { type: String, default: null },
  subscribedPromoters: { type: Array, default: [] },
  submissions: { type: Array, default: [] },
  createdAt: { type: String, default: () => new Date().toISOString() }
});

module.exports = mongoose.model('Campaign', campaignSchema);
