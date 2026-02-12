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

  const safeCreateIndex = async (
    collectionName: string,
    keys: Record<string, any>,
    options?: Record<string, any>
  ) => {
    try {
      await db.collection(collectionName).createIndex(keys, options);
    } catch {
      // Ignore index creation errors (e.g., permissions, duplicates, missing collection)
    }
  };

  await safeCreateIndex("subscriptions", { tenantId: 1, _id: 1 });
  await safeCreateIndex("subscriptions", { tenantId: 1, ownerEmail: 1 });
  await safeCreateIndex("subscriptions", { tenantId: 1, owner: 1 });
  await safeCreateIndex("subscriptions", { tenantId: 1, departments: 1 });
  await safeCreateIndex("subscriptions", { tenantId: 1, department: 1 });
  // For analytics dashboard - count active subscriptions faster
  await safeCreateIndex("subscriptions", { tenantId: 1, status: 1 });
  await safeCreateIndex("subscriptions", { tenantId: 1, status: 1, nextRenewal: 1 });

  // Deterministic key used to detect duplicates despite encryption of serviceName.
  await safeCreateIndex("subscriptions", { tenantId: 1, serviceNameKey: 1 });

  // Prevent duplicate *create* requests when client retries (slow network/render deploy).
  // Only applies to non-draft documents that include a string createIdempotencyKey.
  await safeCreateIndex(
    "subscriptions",
    { tenantId: 1, createIdempotencyKey: 1 },
    {
      unique: true,
      partialFilterExpression: {
        isDraft: { $ne: true },
        createIdempotencyKey: { $type: "string" },
      },
    }
  );

  // Prevent duplicate draft creation on repeated clicks / race conditions.
  // Only applies to draft documents that include a string draftSessionId.
  await safeCreateIndex(
    "subscriptions",
    { tenantId: 1, draftSessionId: 1 },
    {
      unique: true,
      partialFilterExpression: { isDraft: true, draftSessionId: { $type: "string" } },
    }
  );

  // Exchange rates batch query optimization
  await safeCreateIndex("exchange_rates", { tenantId: 1, code: 1, date: -1, createdAt: -1 });
}
