import { MongoClient } from 'mongodb';
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);
async function run() {
  await client.connect();
  const db = client.db('Subtrackerr');
  const dbs = await db.collection("pending_purchases").find({}).toArray();
  console.log(dbs);
  await client.close();
}
run();
