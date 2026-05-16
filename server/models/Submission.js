const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  campaignId: { type: String, required: true },
  userId: { type: String, required: true },
  userName: { type: String, default: 'Unknown' },
  platforms: { type: [String], default: [] },
  proof: { type: String, default: '' },
  proofUrl: { type: String, default: '' },
  proofDescription: { type: String, default: '' },
  screenshot: { type: String, default: '' },
  status: { type: String, default: 'pending' },
  approvalAmount: { type: Number, default: 0 },
  createdAt: { type: String, default: () => new Date().toISOString() }
});

module.exports = mongoose.model('Submission', submissionSchema);
