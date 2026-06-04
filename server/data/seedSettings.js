const mongoose = require('mongoose');
const PlatformSettings = require('../models/PlatformSettings');
require('dotenv').config();

const defaults = [
  { key: 'minCampaignBudget',        value: 10000,   dataType: 'number' },
  { key: 'platformFeePercent',       value: 7.5,     dataType: 'number' },
  { key: 'minDurationDays',          value: 3,       dataType: 'number' },
  { key: 'maxFilesPerCampaign',      value: 10,      dataType: 'number' },
  { key: 'maxFileSizeMB',            value: 20,      dataType: 'number' },
  { key: 'minWithdrawalAmount',      value: 2000,    dataType: 'number' },
  { key: 'withdrawalProcessingDays', value: 3,       dataType: 'number' },
  { key: 'submissionReviewWindow',   value: 72,      dataType: 'number' },
  { key: 'allowNewBusinessSignups',  value: true,    dataType: 'boolean' },
  { key: 'allowNewPromoterSignups',  value: true,    dataType: 'boolean' },
  { key: 'allowCampaignCreation',    value: true,    dataType: 'boolean' },
  { key: 'allowWithdrawals',         value: true,    dataType: 'boolean' },
  { key: 'maintenanceMode',          value: false,   dataType: 'boolean' },
  { key: 'enabledPlatforms', value: ['tiktok','instagram','twitter','facebook','youtube'], dataType: 'array' },
];

mongoose.connect(process.env.MONGO_URI).then(async () => {
  for (const s of defaults) {
    await PlatformSettings.findOneAndUpdate({ key: s.key }, s, { upsert: true });
  }
  console.log('✅ Settings seeded');
  process.exit();
});