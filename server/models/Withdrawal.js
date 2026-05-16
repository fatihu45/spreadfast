const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String },
  promoterId: { type: String },
  userName: { type: String },
  promoterName: { type: String },
  email: { type: String, required: true },
  amount: { type: Number, required: true },
  bankDetails: { type: Object, required: true },
  status: { type: String, default: 'pending' },
  createdAt: { type: String, default: () => new Date().toISOString() }
});

module.exports = mongoose.model('Withdrawal', withdrawalSchema);
