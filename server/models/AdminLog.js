const mongoose = require('mongoose');

const adminLogSchema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true },
  target: { type: String },
  details: { type: Object }
}, { timestamps: true });

module.exports = mongoose.model('AdminLog', adminLogSchema);