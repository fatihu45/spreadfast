const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  idempotencyKey: { type: String, required: true },
  style: { type: String, enum: ['food', 'reveal', 'studio', 'social', 'fashion_studio'], required: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  stage: { type: String, enum: ['queued', 'preparing_image', 'creating_scene', 'creating_video', 'finalizing', 'completed', 'failed'], default: 'queued' },
  freePreview: { type: Boolean, required: true },
  creditUsed: { type: Boolean, default: false },
  downloadable: { type: Boolean, default: false },
  provider: { type: String, default: 'fal' },
  model: { type: String, required: true },
  requestId: String,
  videoRequestId: String,
  sourceImageUrl: String,
  sourceBackImageUrl: String,
  fashionImages: {
    front: { url: String, publicId: String, model: String, requestId: String },
    back: { url: String, publicId: String, model: String, requestId: String }
  },
  imageUrl: String,
  commercialImage: {
    url: String,
    publicId: String,
    model: String,
    requestId: String
  },
  media: { publicId: String, outputUrl: String, previewUrl: String },
  expiresAt: { type: Date, required: true },
  completedAt: Date,
  deletedAt: Date,
  failureCode: String
}, { timestamps: true });
schema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
module.exports = mongoose.models.QuickAdGeneration || mongoose.model('QuickAdGeneration', schema);
