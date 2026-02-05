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

  // OTP TTL (expire at the exact time stored in expiresAt)
  // Note: MongoDB's TTL monitor runs ~every 60s, so deletion is not instantaneous.
  try {
    await db.collection("otps").createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0 }
    );
  } catch (err) {
    // Ignore index creation errors (e.g., permissions)
  }

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

export async function ensureHistoryIndexes() {
  const db = await connectToDatabase();
  try {
    await db.collection("history").createIndex({ tenantId: 1, timestamp: -1, _id: -1 });
    await db.collection("history").createIndex({ tenantId: 1, subscriptionId: 1, timestamp: -1, _id: -1 });
  } catch (err) {
    // Ignore index creation errors (e.g., permissions or missing collection)
  }
}

export async function ensureSubscriptionIndexes() {
  const db = await connectToDatabase();
  try {
    await db.collection("subscriptions").createIndex({ tenantId: 1, _id: 1 });
    await db.collection("subscriptions").createIndex({ tenantId: 1, ownerEmail: 1 });
    await db.collection("subscriptions").createIndex({ tenantId: 1, owner: 1 });
    await db.collection("subscriptions").createIndex({ tenantId: 1, departments: 1 });
    await db.collection("subscriptions").createIndex({ tenantId: 1, department: 1 });
    // For analytics dashboard - count active subscriptions faster
    await db.collection("subscriptions").createIndex({ tenantId: 1, status: 1 });
    await db.collection("subscriptions").createIndex({ tenantId: 1, status: 1, nextRenewal: 1 });

    // Prevent duplicate draft creation on repeated clicks / race conditions.
    // Only applies to draft documents that include a string draftSessionId.
    await db.collection("subscriptions").createIndex(
      { tenantId: 1, draftSessionId: 1 },
      {
        unique: true,
        partialFilterExpression: { isDraft: true, draftSessionId: { $type: "string" } },
      }
    );
    
    // Exchange rates batch query optimization
    await db.collection("exchange_rates").createIndex({ tenantId: 1, code: 1, date: -1, createdAt: -1 });
  } catch (err) {
    // Ignore index creation errors (e.g., permissions or missing collection)
  }
}
