import { Router } from "express";
// @ts-ignore
import { connectToDatabase } from "./mongo.js";
import { ObjectId } from "mongodb";

const router = Router();

// Get dashboard metrics
router.get("/api/analytics/dashboard", async (req, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });
  try {
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
    // Calculate monthly spend for tenant
    const monthlySpendResult = await collection.aggregate([
      { $match: { status: "Active", tenantId } },
      { $project: { amount: { $toDouble: "$amount" }, billingCycle: 1 } },
      { $project: {
        monthlyAmount: {
          $switch: {
            branches: [
              { case: { $eq: ["$billingCycle", "monthly"] }, then: "$amount" },
              { case: { $eq: ["$billingCycle", "yearly"] }, then: { $divide: ["$amount", 12] } },
              { case: { $eq: ["$billingCycle", "quarterly"] }, then: { $divide: ["$amount", 3] } },
              { case: { $eq: ["$billingCycle", "weekly"] }, then: { $multiply: ["$amount", 4] } }
            ],
            default: "$amount"
          }
        }
      } },
      { $group: { _id: null, total: { $sum: "$monthlyAmount" } } }
    ]).toArray();
    const monthlySpend = monthlySpendResult[0]?.total || 0;
    // Calculate yearly spend for tenant
    const yearlySpendResult = await collection.aggregate([
      { $match: { status: "Active", tenantId } },
      { $project: { amount: { $toDouble: "$amount" }, billingCycle: 1 } },
      { $project: {
        yearlyAmount: {
          $switch: {
            branches: [
              { case: { $eq: ["$billingCycle", "monthly"] }, then: { $multiply: ["$amount", 12] } },
              { case: { $eq: ["$billingCycle", "yearly"] }, then: "$amount" },
              { case: { $eq: ["$billingCycle", "quarterly"] }, then: { $multiply: ["$amount", 4] } },
              { case: { $eq: ["$billingCycle", "weekly"] }, then: { $multiply: ["$amount", 52] } }
            ],
            default: "$amount"
          }
        }
      } },
      { $group: { _id: null, total: { $sum: "$yearlyAmount" } } }
    ]).toArray();
    const yearlySpend = yearlySpendResult[0]?.total || 0;
    res.status(200).json({ activeSubscriptions, upcomingRenewals, monthlySpend, yearlySpend });
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
    // Get all active subscriptions for tenant
    const subscriptions = await collection.find({ status: "Active", tenantId }).toArray();
    // Calculate monthly spend for each month
    const trendsData = monthsArray.map(monthData => {
      let monthlyTotal = 0;
      subscriptions.forEach(sub => {
        if (sub.status !== "Active") return;
        const amount = parseFloat(sub.amount);
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
    const db = await connectToDatabase();
    const collection = db.collection("subscriptions");
    const categories = await collection.aggregate([
      { $match: { status: "Active", tenantId } },
      { $group: { _id: "$category", amount: { $sum: { $toDouble: "$amount" } } } },
      { $project: { _id: 0, category: "$_id", amount: 1 } }
    ]).toArray();
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
