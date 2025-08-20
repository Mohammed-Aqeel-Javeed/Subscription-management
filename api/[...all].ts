import type { VercelRequest, VercelResponse } from '@vercel/node';
import { storage } from '../server/storage';
import jwt from 'jsonwebtoken';
import cors from 'cors';

// CORS configuration
const corsOptions = {
  origin: [
    'https://subscription-management-ztxt-f4vfndudd.vercel.app',
    'http://localhost:5173',
    'http://localhost:5000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
};

// Helper function to run middleware
function runMiddleware(req: VercelRequest, res: VercelResponse, fn: any) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Apply CORS
  await runMiddleware(req, res, cors(corsOptions));

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { method, url } = req;
  
  try {
    // Login endpoint
    if (url === '/api/login' && method === 'POST') {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const db = await storage.getDb();
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
      
      // Set cookie with proper settings for production
      const cookieOptions = [
        `token=${token}`,
        'HttpOnly=false',
        'Path=/',
        `Max-Age=${7 * 24 * 60 * 60}`, // 7 days
        process.env.NODE_ENV === 'production' ? 'Secure' : '',
        process.env.NODE_ENV === 'production' ? 'SameSite=None' : 'SameSite=Lax'
      ].filter(Boolean).join('; ');
      
      res.setHeader('Set-Cookie', cookieOptions);
      return res.status(200).json({ message: "Login successful" });
    }

    // Signup endpoint
    if (url === '/api/signup' && method === 'POST') {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const db = await storage.getDb();
      
      // Check if user already exists
      const existingUser = await db.collection("login").findOne({ email });
      if (existingUser) {
        return res.status(409).json({ message: "User already exists" });
      }

      // Create new user
      const newUser = { email, password, createdAt: new Date() };
      await db.collection("login").insertOne(newUser);
      
      return res.status(201).json({ message: "Signup successful" });
    }

    // Logout endpoint
    if (url === '/api/logout' && method === 'POST') {
      const cookieOptions = [
        'token=',
        'HttpOnly=false',
        'Path=/',
        'Max-Age=0',
        process.env.NODE_ENV === 'production' ? 'Secure' : '',
        process.env.NODE_ENV === 'production' ? 'SameSite=None' : 'SameSite=Lax'
      ].filter(Boolean).join('; ');
      
      res.setHeader('Set-Cookie', cookieOptions);
      return res.status(200).json({ message: "Logout successful" });
    }

    // Subscriptions endpoints
    if (url === '/api/subscriptions' && method === 'GET') {
      const db = await storage.getDb();
      const subscriptions = await db.collection("history").find({}).toArray();
      return res.status(200).json(subscriptions);
    }

    if (url === '/api/subscriptions' && method === 'POST') {
      const db = await storage.getDb();
      const subscription = req.body;
      const result = await db.collection("history").insertOne({
        ...subscription,
        createdAt: new Date()
      });
      return res.status(201).json({ message: "Subscription created", id: result.insertedId });
    }

    // Analytics endpoints
    if (url === '/api/analytics/dashboard' && method === 'GET') {
      const db = await storage.getDb();
      
      const totalSubscriptions = await db.collection("history").countDocuments();
      const activeSubscriptions = await db.collection("history").countDocuments({ status: 'active' });
      const totalSpent = await db.collection("history").aggregate([
        { $group: { _id: null, total: { $sum: "$cost" } } }
      ]).toArray();
      
      const dashboardData = {
        totalSubscriptions,
        activeSubscriptions,
        totalSpent: totalSpent[0]?.total || 0,
        upcomingRenewals: 0
      };
      
      return res.status(200).json(dashboardData);
    }

    if (url === '/api/analytics/trends' && method === 'GET') {
      const db = await storage.getDb();
      const trends = await db.collection("history").aggregate([
        {
          $group: {
            _id: { $month: "$createdAt" },
            count: { $sum: 1 },
            total: { $sum: "$cost" }
          }
        }
      ]).toArray();
      
      return res.status(200).json(trends);
    }

    if (url === '/api/analytics/categories' && method === 'GET') {
      const db = await storage.getDb();
      const categories = await db.collection("history").aggregate([
        {
          $group: {
            _id: "$category",
            count: { $sum: 1 },
            total: { $sum: "$cost" }
          }
        }
      ]).toArray();
      
      return res.status(200).json(categories);
    }

    // If no route matches, return 404
    return res.status(404).json({ message: 'API route not found' });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
