import { storage } from '../../server/storage';

export default async function handler(req: any, res: any) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', 'https://subscription-management-uhzp.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const db = await storage["getDb"]();
    
    // Get dashboard analytics - you may need to adjust these based on your data structure
    const totalSubscriptions = await db.collection("history").countDocuments();
    const activeSubscriptions = await db.collection("history").countDocuments({ status: 'active' });
    const totalSpent = await db.collection("history").aggregate([
      { $group: { _id: null, total: { $sum: "$cost" } } }
    ]).toArray();
    
    const dashboardData = {
      totalSubscriptions,
      activeSubscriptions,
      totalSpent: totalSpent[0]?.total || 0,
      upcomingRenewals: 0 // You can calculate this based on your data
    };
    
    res.status(200).json(dashboardData);
  } catch (err) {
    console.error('Dashboard analytics error:', err);
    res.status(500).json({ message: "Failed to fetch dashboard analytics" });
  }
}
