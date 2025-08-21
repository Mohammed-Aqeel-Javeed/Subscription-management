import { Router, Request, Response } from "express";
import { connectToDatabase } from "./mongo";
import { ObjectId } from "mongodb";

const router = Router();

// Get dashboard metrics
router.get("/api/analytics/dashboard", async (req: Request, res: Response) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("subscriptions");
    
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const yearEnd = new Date(now.getFullYear(), 11, 31);

    // Count active subscriptions
    const activeSubscriptions = await collection.countDocuments({ status: "Active" });

    // Count upcoming renewals (next 30 days)
    const upcomingRenewals = await collection.countDocuments({
      status: "Active",
      nextRenewal: { 
        $gte: now.toISOString(), 
        $lte: thirtyDaysFromNow.toISOString() 
      }
    });

    // Calculate monthly spend (sum of all active subscriptions this month)
    const monthlySpendResult = await collection.aggregate([
      {
        $match: {
          status: "Active"
        }
      },
      {
        $project: {
          amount: { $toDouble: "$amount" },
          billingCycle: 1
        }
      },
      {
        $project: {
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
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$monthlyAmount" }
        }
      }
    ]).toArray();

    const monthlySpend = monthlySpendResult[0]?.total || 0;

    // Calculate yearly spend (sum of all active subscriptions per year)
    const yearlySpendResult = await collection.aggregate([
      {
        $match: {
          status: "Active"
        }
      },
      {
        $project: {
          amount: { $toDouble: "$amount" },
          billingCycle: 1
        }
      },
      {
        $project: {
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
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$yearlyAmount" }
        }
      }
    ]).toArray();

    const yearlySpend = yearlySpendResult[0]?.total || 0;

    res.status(200).json({
      activeSubscriptions,
      upcomingRenewals,
      monthlySpend,
      yearlySpend
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch dashboard metrics", error });
  }
});

// Get spending trends
router.get("/api/analytics/trends", async (req: Request, res: Response) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("subscriptions");
    
    // Get last 6 months of data
    const now = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(now.getMonth() - 6);

    // Generate an array of the last 6 months
  const monthsArray = Array.from({ length: 6 }, (_: any, i: number) => {
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

    // Get all active subscriptions
    const subscriptions = await collection.find({
      status: "Active"
    }).toArray();

    // Calculate monthly spend for each month
  const trendsData = monthsArray.map((monthData: any) => {
      let monthlyTotal = 0;

  subscriptions.forEach((sub: any) => {
        // Only include active subscriptions
        if (sub.status !== "Active") {
          return;
        }

        const amount = parseFloat(sub.amount);
        const startDate = new Date(sub.startDate);
        const renewalDate = new Date(sub.nextRenewal);

        // Skip if subscription starts after this month
        if (startDate > monthData.monthEnd) {
          return;
        }

        // Skip if subscription ends before this month
        if (renewalDate < monthData.monthStart) {
          return;
        }

        // All your subscriptions are monthly, so add the full amount
        monthlyTotal += amount;
      });

      return {
        month: monthData.monthStr,
        amount: Number(monthlyTotal.toFixed(2))
      };
    });

    res.status(200).json(trendsData);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch spending trends", error });
  }
});

// Get category breakdown
router.get("/api/analytics/categories", async (req: Request, res: Response) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("subscriptions");
    
      const categories = await collection.aggregate([
      {
        $match: {
          status: "Active"
        }
      },
      {
        $group: {
          _id: "$category",
          amount: { $sum: { $toDouble: "$amount" } }
        }
      },
      {
        $project: {
          _id: 0,
          category: "$_id",
          amount: 1
        }
      }
    ]).toArray();

    // Add colors for each category
    const colors = [
      "#3B82F6", // blue-500
      "#10B981", // emerald-500
      "#F59E0B", // amber-500
      "#EF4444", // red-500
      "#8B5CF6", // violet-500
      "#EC4899", // pink-500
      "#14B8A6", // teal-500
      "#F97316", // orange-500
      "#6366F1", // indigo-500
      "#84CC16"  // lime-500
    ];

  const categoriesWithColors = categories.map((cat: any, index: number) => ({
      ...cat,
      color: colors[index % colors.length]
    }));    res.status(200).json(categoriesWithColors);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch category breakdown", error });
  }
});

// Get recent activity
router.get("/api/analytics/activity", async (req: Request, res: Response) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("history");
    
    const activity = await collection
      .find({})
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();

    res.status(200).json(activity);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch recent activity", error });
  }
});

export default router;
