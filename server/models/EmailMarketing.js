const mongoose = require('mongoose');
const settingsSchema = new mongoose.Schema({ _id: { type: String, default: 'weekly' }, enabled: { type: Boolean, default: false }, frequency: { type: Number, enum: [3, 4], default: 3 }, hour: { type: Number, min: 0, max: 23, default: 8 } }, { timestamps: true });
const campaignSchema = new mongoose.Schema({
  subject: String, title: String, body: String, cta: String, url: String, imageUrl: String,
  audience: { type: String, enum: ['all', 'company', 'promoter', 'registered'], default: 'all' },
  status: { type: String, enum: ['draft', 'ready', 'queued', 'sending', 'sent', 'needs_review', 'skipped'], default: 'draft' },
  slot: String, broadcastId: String, segmentId: String, recipients: Number, sentAt: Date, error: String,
  createdBy: String
}, { timestamps: true });
const slotSchema = new mongoose.Schema({ _id: String, claimedAt: { type: Date, default: Date.now } });
module.exports = {
  EmailMarketingSettings: mongoose.models.EmailMarketingSettings || mongoose.model('EmailMarketingSettings', settingsSchema),
  EmailCampaign: mongoose.models.EmailCampaign || mongoose.model('EmailCampaign', campaignSchema),
  EmailMarketingSlot: mongoose.models.EmailMarketingSlot || mongoose.model('EmailMarketingSlot', slotSchema)
};
