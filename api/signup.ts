import { storage } from '../server/storage';

export default async function handler(req: any, res: any) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', 'https://subscription-management-uhzp.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { fullName, email, password, tenantId } = req.body;
    
    if (!fullName || !email || !password || !tenantId) {
      return res.status(400).json({ message: "Missing required fields (fullName, email, password, tenantId)" });
    }

    const db = await storage["getDb"]();
    const doc = { fullName, email, password, tenantId, createdAt: new Date() };
    
    await db.collection("signup").insertOne(doc);
    // Also store credentials in login collection for immediate login
    await db.collection("login").insertOne(doc);
    
    res.status(201).json({ message: "Signup successful" });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: "Failed to save signup" });
  }
}
