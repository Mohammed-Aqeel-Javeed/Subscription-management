// Script to clean up history records: ensures subscriptionId is ObjectId and matches only correct subscriptions
// Usage: node cleanHistory.js

const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI = 'mongodb://localhost:27017'; // Change if needed
const DB_NAME = 'Subtrackerr'; // Change to your actual database name

async function main() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const history = db.collection('history');
    const subscriptions = db.collection('subscriptions');

    // Fetch all subscriptions
    const subs = await subscriptions.find({}).toArray();
    const validIds = subs.map(sub => sub._id.toString());

    // Fetch all history records
    const records = await history.find({}).toArray();
    let updated = 0, removed = 0;
    for (const rec of records) {
      // If subscriptionId is not a valid ObjectId or not in subscriptions, remove it
      const subId = rec.subscriptionId?.toString();
      if (!subId || !ObjectId.isValid(subId) || !validIds.includes(subId)) {
        await history.deleteOne({ _id: rec._id });
        removed++;
        continue;
      }
      // If subscriptionId is not ObjectId, update it
      if (typeof rec.subscriptionId === 'string') {
        await history.updateOne({ _id: rec._id }, { $set: { subscriptionId: new ObjectId(subId) } });
        updated++;
      }
    }
    console.log(`Cleaned history: ${updated} updated, ${removed} removed.`);
  } finally {
    await client.close();
  }
}

main().catch(err => {
  console.error('Error:', err);
});
