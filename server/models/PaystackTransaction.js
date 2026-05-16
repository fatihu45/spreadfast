const mongoose = require('mongoose');

const paystackTransactionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  reference: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  email: { type: String, required: true },
  amount: { type: Number, required: true },
  campaignName: { type: String, required: true },
  description: { type: String, default: '' },
  socialMediaPlatforms: { type: [String], default: [] },
  status: { type: String, default: 'pending' },
  campaignCreated: { type: Boolean, default: false },
  campaignId: { type: String, default: null },
  createdAt: { type: String, default: () => new Date().toISOString() }
});

module.exports = mongoose.model('PaystackTransaction', paystackTransactionSchema);
