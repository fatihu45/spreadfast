const mongoose = require('mongoose');

const campaignAssetSchema = new mongoose.Schema(
  {
    campaign_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      required: true,
    },
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    file_name: {
      type: String,
      required: true,
    },
    file_type: {
      type: String,
      enum: ['image', 'video', 'pdf', 'audio'],
      required: true,
    },
    file_size: {
      type: Number,
      required: true,
    },
    cloudinary_public_id: {
      type: String,
      required: true,
      unique: true,
    },
    cloudinary_url: {
      type: String,
      required: true,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: { createdAt: 'uploaded_at', updatedAt: false },
  }
);

module.exports = mongoose.model('CampaignAsset', campaignAssetSchema);
