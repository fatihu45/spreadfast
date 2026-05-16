const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['company', 'promoter'], default: 'promoter' },
  walletBalance: { type: Number, default: 0 },
  bankDetails: { type: Object, default: null },
  createdAt: { type: String, default: () => new Date().toISOString() }
});

module.exports = mongoose.model('User', userSchema);
  });
}

module.exports = { authenticateToken };