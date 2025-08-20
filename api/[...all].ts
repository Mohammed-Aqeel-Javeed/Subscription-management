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

// Helper to get database directly for login/signup (since they're not in the storage interface)
async function getDbDirect() {
  const { connectToDatabase } = await import('../server/mongo');
  return await connectToDatabase();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Apply CORS
  await runMiddleware(req, res, cors(corsOptions));

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { method } = req;
  // Get the path from the URL, removing query parameters
  let path = req.url?.split('?')[0] || '';
  
  // In Vercel, the path might come without /api prefix, so add it if missing
  if (!path.startsWith('/api/')) {
    path = '/api' + (path.startsWith('/') ? path : '/' + path);
  }
  
  console.log(`API Request: ${method} ${path}`); // Debug logging
  
  try {
    // Login endpoint
    if (path === '/api/login' && method === 'POST') {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const db = await getDbDirect();
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
    if (path === '/api/signup' && method === 'POST') {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const db = await getDbDirect();
      
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
    if (path === '/api/logout' && method === 'POST') {
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
    if (path === '/api/subscriptions' && method === 'GET') {
      // TODO: Get tenantId from JWT token
      const tenantId = 'default'; // Fallback for now
      const subscriptions = await storage.getSubscriptions(tenantId);
      return res.status(200).json(subscriptions);
    }

    if (path === '/api/subscriptions' && method === 'POST') {
      // TODO: Get tenantId from JWT token
      const tenantId = 'default'; // Fallback for now
      const subscription = req.body;
      const result = await storage.createSubscription(subscription, tenantId);
      return res.status(201).json({ message: "Subscription created", data: result });
    }

    // Analytics endpoints
    if (path === '/api/analytics/dashboard' && method === 'GET') {
      // TODO: Get tenantId from JWT token
      const tenantId = 'default'; // Fallback for now
      const dashboardData = await storage.getDashboardMetrics(tenantId);
      return res.status(200).json(dashboardData);
    }

    if (path === '/api/analytics/trends' && method === 'GET') {
      // TODO: Get tenantId from JWT token
      const tenantId = 'default'; // Fallback for now
      const trends = await storage.getSpendingTrends(tenantId);
      return res.status(200).json(trends);
    }

    if (path === '/api/analytics/categories' && method === 'GET') {
      // TODO: Get tenantId from JWT token
      const tenantId = 'default'; // Fallback for now
      const categories = await storage.getCategoryBreakdown(tenantId);
      return res.status(200).json(categories);
    }

    // If no route matches, return 404
    return res.status(404).json({ message: 'API route not found' });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
