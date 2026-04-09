import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
dotenv.config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const client = new MongoClient(uri);

async function run() {
  await client.connect();
  const db = client.db('Subtrackerr');
  const dbs = await db.collection("pending_purchases").find({}).toArray();
  console.log("Pending Purchases:", dbs);
  
  const signups = await db.collection("signup").find({ email: "nevin@perfecta.com" }).toArray();
  console.log("Signups for Nevin:", signups);
  await client.close();
}
run();
