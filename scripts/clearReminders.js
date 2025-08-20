// Run this with: node scripts/clearReminders.js
const { MongoClient } = require('mongodb');

const uri = 'mongodb://localhost:27017'; // Change if your MongoDB is remote or uses a different port
const dbName = 'SubscriptionTracker'; // Change if your DB name is different

async function clearReminders() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);
    const result = await db.collection('reminders').deleteMany({});
    console.log(`Deleted ${result.deletedCount} reminders.`);
  } catch (err) {
    console.error('Error clearing reminders:', err);
  } finally {
    await client.close();
  }
}

clearReminders();
