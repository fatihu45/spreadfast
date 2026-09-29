const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  kind: { type: String, required: true }, userId: String,
  to: { type: String, required: true }, subject: String, html: String, text: String,
  status: { type: String, enum: ['pending', 'sending', 'retry', 'sent', 'suppressed', 'needs_review'], default: 'pending' },
  attempts: { type: Number, default: 0 }, firstAttemptAt: Date, nextAttemptAt: Date,
  leaseUntil: Date, leaseToken: String, sentAt: Date, providerId: String, errorCode: String,
  createdAt: { type: Date, default: Date.now }
});
schema.index({ status: 1, nextAttemptAt: 1, leaseUntil: 1 });
module.exports = mongoose.models.EmailNotification || mongoose.model('EmailNotification', schema);
