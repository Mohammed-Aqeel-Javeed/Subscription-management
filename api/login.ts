import { storage } from '../server/storage';
import jwt from 'jsonwebtoken';

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
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const db = await storage["getDb"]();
    const user = await db.collection("login").findOne({ email, password });
    
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Include tenantId in JWT payload for multi-tenancy
    const tokenPayload: any = { userId: user._id, email: user.email };
    if (user.tenantId) {
      tokenPayload.tenantId = user.tenantId;
    }
    
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || "subs_secret_key", { expiresIn: "7d" });
    
    // Set cookie
    res.setHeader('Set-Cookie', `token=${token}; HttpOnly=false; Secure=true; SameSite=None; Path=/; Max-Age=${7 * 24 * 60 * 60}`);
    
    res.status(200).json({ message: "Login successful" });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: "Login failed" });
  }
}
