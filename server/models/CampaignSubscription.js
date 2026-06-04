const mongoose = require('mongoose');

const campaignSubscriptionSchema = new mongoose.Schema(
  {
    promoter_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    campaign_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'cancelled'],
      default: 'active',
    },
    joined_at: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Ensure each promoter can only subscribe to a campaign once
campaignSubscriptionSchema.index(
  { promoter_id: 1, campaign_id: 1 },
  { unique: true }
);

module.exports = mongoose.model('CampaignSubscription', campaignSubscriptionSchema);
