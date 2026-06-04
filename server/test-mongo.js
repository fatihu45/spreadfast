const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');

console.log('Testing MongoDB connection...');
console.log('Connection URI:', process.env.MONGODB_URI.substring(0, 50) + '...');

mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 60000,
  connectTimeoutMS: 30000,
  family: 4
})
.then(() => {
  console.log('✅ MongoDB connected successfully!');
  process.exit(0);
})
.catch(error => {
  console.error('❌ Connection failed:', error.message);
  console.error('\nError details:');
  if (error.message.includes('whitelisted')) {
    console.error('→ SOLUTION: Add your IP or 0.0.0.0/0 to MongoDB Atlas Network Access');
  } else if (error.message.includes('authentication')) {
    console.error('→ SOLUTION: Check username and password in MONGODB_URI');
  } else if (error.message.includes('connect') || error.message.includes('server')) {
    console.error('→ SOLUTION: Verify MongoDB cluster is ACTIVE (not paused)');
    console.error('→ Try: Go to MongoDB Atlas → Clusters → Check cluster status');
  }
  process.exit(1);
});
