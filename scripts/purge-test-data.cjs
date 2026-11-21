const mongoose = require('mongoose');

async function purge() {
  await mongoose.connect('mongodb://127.0.0.1:27017/arjun_api_manager');
  const db = mongoose.connection.db;

  // 1. Purge all customers and keys
  const c = await db.collection('customers').deleteMany({});
  const k = await db.collection('api_keys').deleteMany({});
  console.log('Purged customers:', c.deletedCount, 'api keys:', k.deletedCount);

  // 2. Keep ONLY rootx-vehicle-osint
  await db.collection('api_catalog').deleteMany({
    slug: { $ne: 'rootx-vehicle-osint' }
  });

  // 3. Purge logs
  await db.collection('usage_daily').deleteMany({});
  await db.collection('usage_monthly').deleteMany({});
  await db.collection('usage_events').deleteMany({});
  await db.collection('request_logs').deleteMany({});
  await db.collection('admin_audit_logs').deleteMany({});

  console.log('Database is now 100% clean and pristine.');
  await mongoose.disconnect();
}

purge().catch(console.error);
