import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
dotenv.config();

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

async function run() {
  await client.connect();
  const db = client.db('Subtrackerr');
  
  const cols = await db.listCollections().toArray();
  console.log("Collections:", cols.map(c => c.name));
  
  await client.close();
}
run();
