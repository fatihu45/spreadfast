const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  idempotencyKey: { type: String, required: true },
  style: { type: String, enum: ['food', 'reveal', 'studio', 'social'], required: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  freePreview: { type: Boolean, required: true },
  creditUsed: { type: Boolean, default: false },
  downloadable: { type: Boolean, default: false },
  provider: { type: String, default: 'fal' },
  model: { type: String, required: true },
  requestId: String,
  imageUrl: String,
  media: { publicId: String, outputUrl: String, previewUrl: String },
  expiresAt: { type: Date, required: true },
  completedAt: Date,
  failureCode: String
}, { timestamps: true });
schema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
module.exports = mongoose.models.QuickAdGeneration || mongoose.model('QuickAdGeneration', schema);
