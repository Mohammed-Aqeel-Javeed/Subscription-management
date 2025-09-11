// MongoDB connection utility for Subtrackerr database

import { MongoClient, Db } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017";
const dbName = process.env.MONGODB_DB || "Subtrackerr";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectToDatabase() {
  if (db) return db;
  if (!client) {
    client = new MongoClient(uri, {
      tls: true,
      tlsAllowInvalidCertificates: false,
      tlsAllowInvalidHostnames: false,
    });
    await client.connect();
  }
  db = client.db(dbName);
  return db;
}

export async function closeDatabase() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

export async function ensureTTLIndexes() {
  const db = await connectToDatabase();
  // 60 days in seconds
  const expireAfterSeconds = 60 * 24 * 60 * 60;

  // Notification events TTL
  await db.collection("notification_events").createIndex(
    { createdAt: 1 },
    { expireAfterSeconds }
  );

  // Reminders TTL
  await db.collection("reminders").createIndex(
    { createdAt: 1 },
    { expireAfterSeconds }
  );

  // Compliance notifications TTL (if used)
  try {
    await db.collection("compliance_notifications").createIndex(
      { createdAt: 1 },
      { expireAfterSeconds }
    );
  } catch (err) {
    // Collection may not exist, ignore error
  }
}
