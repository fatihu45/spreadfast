require('dotenv').config();
const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema({}, { strict: false });
const Asset = mongoose.model('CampaignAsset', assetSchema);

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const assets = await Asset.find({});
  console.log('Total assets:', assets.length);
  console.log(JSON.stringify(assets, null, 2));
  mongoose.disconnect();
}).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});