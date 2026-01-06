import { Router } from "express";
// @ts-ignore
import { connectToDatabase } from "./mongo.js";
import { decrypt } from "./encryption.service.js";
import { ObjectId } from "mongodb";

const router = Router();

// Get dashboard metrics
router.get("/api/analytics/dashboard", async (req, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });
  try {
    // Cache for 30 seconds
    res.setHeader('Cache-Control', 'public, max-age=30');
    
    const db = await connectToDatabase();
    const collection = db.collection("subscriptions");
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    // Count active subscriptions for tenant
    const activeSubscriptions = await collection.countDocuments({ status: "Active", tenantId });
    
    // Count upcoming renewals (next 30 days) for tenant
    const upcomingRenewals = await collection.countDocuments({
      status: "Active",
      tenantId,
      nextRenewal: { $gte: now.toISOString(), $lte: thirtyDaysFromNow.toISOString() }
    });
    
    // OPTIMIZED: Only fetch amount and billingCycle, not full documents
    const subscriptions = await collection.find(
      { status: "Active", tenantId },
      { projection: { amount: 1, billingCycle: 1 } }
    ).toArray();
    
    let monthlySpend = 0;
    let yearlySpend = 0;
    
    subscriptions.forEach(sub => {
      // Decrypt the amount
      const decryptedAmount = decrypt(sub.amount);
      const amount = parseFloat(decryptedAmount) || 0;
      
      // Calculate monthly equivalent
      const billingCycle = (sub.billingCycle || 'monthly').toLowerCase();
      let monthlyAmount = amount;
      let yearlyAmount = amount * 12;
      
      if (billingCycle === 'yearly') {
        monthlyAmount = amount / 12;
        yearlyAmount = amount;
      } else if (billingCycle === 'quarterly') {
        monthlyAmount = amount / 3;
        yearlyAmount = amount * 4;
      } else if (billingCycle === 'weekly') {
        monthlyAmount = amount * 4;
        yearlyAmount = amount * 52;
      }
      
      monthlySpend += monthlyAmount;
      yearlySpend += yearlyAmount;
    });
    
    res.status(200).json({ 
      activeSubscriptions, 
      upcomingRenewals, 
      monthlySpend: Number(monthlySpend.toFixed(2)), 
      yearlySpend: Number(yearlySpend.toFixed(2))
    });
  } catch (error) {
    console.error("[Analytics] Dashboard error:", error);
    const errMsg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: "Failed to fetch dashboard metrics", error: errMsg });
  }
});

// Get spending trends
router.get("/api/analytics/trends", async (req, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });
  try {
    // Cache for 1 minute
    res.setHeader('Cache-Control', 'public, max-age=60');
    
    const db = await connectToDatabase();
    const collection = db.collection("subscriptions");
    
    // Get last 6 months of data
    const now = new Date();
    const monthsArray = Array.from({ length: 6 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      return {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        monthStart: new Date(date.getFullYear(), date.getMonth(), 1),
        monthEnd: new Date(date.getFullYear(), date.getMonth() + 1, 0),
        monthStr: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      };
    }).reverse();
    
    // OPTIMIZED: Only fetch needed fields
    const subscriptions = await collection.find(
      { status: "Active", tenantId },
      { projection: { amount: 1, status: 1, startDate: 1, nextRenewal: 1 } }
    ).toArray();
    
    // Calculate monthly spend for each month
    const trendsData = monthsArray.map(monthData => {
      let monthlyTotal = 0;
      
      subscriptions.forEach(sub => {
        if (sub.status !== "Active") return;
        
        // Decrypt amount
        const decryptedAmount = decrypt(sub.amount);
        const amount = parseFloat(decryptedAmount) || 0;
        
        const startDate = new Date(sub.startDate);
        const renewalDate = new Date(sub.nextRenewal);
        
        if (startDate > monthData.monthEnd) return;
        if (renewalDate < monthData.monthStart) return;
        
        monthlyTotal += amount;
      });
      
      return { month: monthData.monthStr, amount: Number(monthlyTotal.toFixed(2)) };
    });
    
    res.status(200).json(trendsData);
  } catch (error) {
    console.error("[Analytics] Trends error:", error);
    const errMsg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: "Failed to fetch spending trends", error: errMsg });
  }
});

// Get category breakdown
router.get("/api/analytics/categories", async (req, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });
  try {
    // Cache for 1 minute
    res.setHeader('Cache-Control', 'public, max-age=60');
    
    const db = await connectToDatabase();
    const collection = db.collection("subscriptions");
    
    // OPTIMIZED: Only fetch category and amount
    const subscriptions = await collection.find(
      { status: "Active", tenantId },
      { projection: { category: 1, amount: 1 } }
    ).toArray();
    
    // Group by category and sum amounts (after decryption)
    const categoryMap = new Map<string, number>();
    
    subscriptions.forEach(sub => {
      const category = sub.category || "Other";
      // Decrypt amount
      const decryptedAmount = decrypt(sub.amount);
      const amount = parseFloat(decryptedAmount) || 0;
      
      categoryMap.set(category, (categoryMap.get(category) || 0) + amount);
    });
    
    // Convert to array format
    const categories = Array.from(categoryMap.entries()).map(([category, amount]) => ({
      category,
      amount: Number(amount.toFixed(2))
    }));
    
    const colors = [
      "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316", "#6366F1", "#84CC16"
    ];
    const categoriesWithColors = categories.map((cat, index) => ({ ...cat, color: colors[index % colors.length] }));
    
    res.status(200).json(categoriesWithColors);
  } catch (error) {
    console.error("[Analytics] Categories error:", error);
    const errMsg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: "Failed to fetch category breakdown", error: errMsg });
  }
});

// Get recent activity
router.get("/api/analytics/activity", async (req, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });
  try {
    const db = await connectToDatabase();
    const collection = db.collection("history");
    const activity = await collection
      .find({ tenantId })
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();
    res.status(200).json(activity);
  } catch (error) {
    console.error("[Analytics] Activity error:", error);
  const errMsg = error instanceof Error ? error.message : String(error);
  res.status(500).json({ message: "Failed to fetch recent activity", error: errMsg });
  }
});

export default router;
