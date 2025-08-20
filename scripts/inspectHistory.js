// Script to inspect history records for subscriptionId issues
// Usage: node inspectHistory.js

const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI = 'mongodb://localhost:27017'; // Change if needed
const DB_NAME = 'your_db_name'; // Change to your actual database name

async function main() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const history = db.collection('history');

    // Fetch all history records
    const records = await history.find({}).toArray();
    const grouped = {};
    records.forEach(rec => {
      const subId = rec.subscriptionId?.toString() || 'undefined';
      if (!grouped[subId]) grouped[subId] = [];
      grouped[subId].push(rec);
    });

    console.log('History records grouped by subscriptionId:');
    Object.entries(grouped).forEach(([subId, recs]) => {
      console.log(`\nsubscriptionId: ${subId} (${recs.length} records)`);
      recs.forEach(r => {
        console.log(`  - _id: ${r._id}, action: ${r.action}, timestamp: ${r.timestamp}`);
      });
    });

    // Highlight records with non-ObjectId subscriptionId
    console.log('\nRecords with non-ObjectId subscriptionId:');
    records.forEach(rec => {
      const subId = rec.subscriptionId;
      if (typeof subId === 'string' && !ObjectId.isValid(subId)) {
        console.log(`  - _id: ${rec._id}, subscriptionId: ${subId}`);
      }
    });
  } finally {
    await client.close();
  }
}

main().catch(err => {
  console.error('Error:', err);
});
