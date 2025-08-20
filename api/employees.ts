import { storage } from '../server/storage';

export default async function handler(req: any, res: any) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', 'https://subscription-management-uhzp.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const db = await storage["getDb"]();
    
    if (req.method === 'GET') {
      const employees = await db.collection("employees").find({}).toArray();
      res.status(200).json(employees);
    } else if (req.method === 'POST') {
      const employeeData = req.body;
      const result = await db.collection("employees").insertOne(employeeData);
      res.status(201).json({ insertedId: result.insertedId });
    } else {
      res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (err) {
    console.error('Employees endpoint error:', err);
    res.status(500).json({ message: "Failed to handle employees request" });
  }
}
