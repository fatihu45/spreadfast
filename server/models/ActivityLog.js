const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  type: { type: String, required: true },
  description: { type: String, required: true },
  icon: { type: String },
  metadata: {
    userId: String,
    campaignId: String,
    submissionId: String,
    amount: Number
  }
}, { timestamps: true });

module.exports = mongoose.model('ActivityLog', activityLogSchema);