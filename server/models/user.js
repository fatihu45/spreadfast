const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  id: { type: String },
  name: { type: String },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['promoter', 'company', 'admin'], default: 'promoter' },
  status: { type: String, enum: ['active', 'suspended', 'banned'], default: 'active' },
  walletBalance: { type: Number, default: 0 },
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