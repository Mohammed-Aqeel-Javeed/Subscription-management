import { storage } from '../server/storage';

export default async function handler(req: any, res: any) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', 'https://subscription-management-uhzp.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const db = await storage["getDb"]();
    
    if (req.method === 'GET') {
      const subscriptions = await db.collection("history").find({}).toArray();
      res.status(200).json(subscriptions);
    } else if (req.method === 'POST') {
      const subscriptionData = req.body;
      const result = await db.collection("history").insertOne({
        ...subscriptionData,
        createdAt: new Date()
      });
      res.status(201).json({ insertedId: result.insertedId });
    } else {
      res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (err) {
    console.error('Subscriptions endpoint error:', err);
    res.status(500).json({ message: "Failed to handle subscriptions request" });
  }
}
