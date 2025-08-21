var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import { Router } from "express";
import { connectToDatabase } from "./mongo";
var router = Router();
// Get dashboard metrics
router.get("/api/analytics/dashboard", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var db, collection, now, thirtyDaysFromNow, monthStart, monthEnd, yearStart, yearEnd, activeSubscriptions, upcomingRenewals, monthlySpendResult, monthlySpend, yearlySpendResult, yearlySpend, error_1;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 6, , 7]);
                return [4 /*yield*/, connectToDatabase()];
            case 1:
                db = _c.sent();
                collection = db.collection("subscriptions");
                now = new Date();
                thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
                monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                yearStart = new Date(now.getFullYear(), 0, 1);
                yearEnd = new Date(now.getFullYear(), 11, 31);
                return [4 /*yield*/, collection.countDocuments({ status: "Active" })];
            case 2:
                activeSubscriptions = _c.sent();
                return [4 /*yield*/, collection.countDocuments({
                        status: "Active",
                        nextRenewal: {
                            $gte: now.toISOString(),
                            $lte: thirtyDaysFromNow.toISOString()
                        }
                    })];
            case 3:
                upcomingRenewals = _c.sent();
                return [4 /*yield*/, collection.aggregate([
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
                    ]).toArray()];
            case 4:
                monthlySpendResult = _c.sent();
                monthlySpend = ((_a = monthlySpendResult[0]) === null || _a === void 0 ? void 0 : _a.total) || 0;
                return [4 /*yield*/, collection.aggregate([
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
                    ]).toArray()];
            case 5:
                yearlySpendResult = _c.sent();
                yearlySpend = ((_b = yearlySpendResult[0]) === null || _b === void 0 ? void 0 : _b.total) || 0;
                res.status(200).json({
                    activeSubscriptions: activeSubscriptions,
                    upcomingRenewals: upcomingRenewals,
                    monthlySpend: monthlySpend,
                    yearlySpend: yearlySpend
                });
                return [3 /*break*/, 7];
            case 6:
                error_1 = _c.sent();
                res.status(500).json({ message: "Failed to fetch dashboard metrics", error: error_1 });
                return [3 /*break*/, 7];
            case 7: return [2 /*return*/];
        }
    });
}); });
// Get spending trends
router.get("/api/analytics/trends", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var db, collection, now, sixMonthsAgo, monthsArray, subscriptions_1, trendsData, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                return [4 /*yield*/, connectToDatabase()];
            case 1:
                db = _a.sent();
                collection = db.collection("subscriptions");
                now = new Date();
                sixMonthsAgo = new Date();
                sixMonthsAgo.setMonth(now.getMonth() - 6);
                monthsArray = Array.from({ length: 6 }, function (_, i) {
                    var date = new Date();
                    date.setMonth(date.getMonth() - i);
                    return {
                        year: date.getFullYear(),
                        month: date.getMonth() + 1,
                        monthStart: new Date(date.getFullYear(), date.getMonth(), 1),
                        monthEnd: new Date(date.getFullYear(), date.getMonth() + 1, 0),
                        monthStr: "".concat(date.getFullYear(), "-").concat(String(date.getMonth() + 1).padStart(2, '0'))
                    };
                }).reverse();
                return [4 /*yield*/, collection.find({
                        status: "Active"
                    }).toArray()];
            case 2:
                subscriptions_1 = _a.sent();
                trendsData = monthsArray.map(function (monthData) {
                    var monthlyTotal = 0;
                    subscriptions_1.forEach(function (sub) {
                        // Only include active subscriptions
                        if (sub.status !== "Active") {
                            return;
                        }
                        var amount = parseFloat(sub.amount);
                        var startDate = new Date(sub.startDate);
                        var renewalDate = new Date(sub.nextRenewal);
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
                return [3 /*break*/, 4];
            case 3:
                error_2 = _a.sent();
                res.status(500).json({ message: "Failed to fetch spending trends", error: error_2 });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// Get category breakdown
router.get("/api/analytics/categories", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var db, collection, categories, colors_1, categoriesWithColors, error_3;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                return [4 /*yield*/, connectToDatabase()];
            case 1:
                db = _a.sent();
                collection = db.collection("subscriptions");
                return [4 /*yield*/, collection.aggregate([
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
                    ]).toArray()];
            case 2:
                categories = _a.sent();
                colors_1 = [
                    "#3B82F6", // blue-500
                    "#10B981", // emerald-500
                    "#F59E0B", // amber-500
                    "#EF4444", // red-500
                    "#8B5CF6", // violet-500
                    "#EC4899", // pink-500
                    "#14B8A6", // teal-500
                    "#F97316", // orange-500
                    "#6366F1", // indigo-500
                    "#84CC16" // lime-500
                ];
                categoriesWithColors = categories.map(function (cat, index) { return (__assign(__assign({}, cat), { color: colors_1[index % colors_1.length] })); });
                res.status(200).json(categoriesWithColors);
                return [3 /*break*/, 4];
            case 3:
                error_3 = _a.sent();
                res.status(500).json({ message: "Failed to fetch category breakdown", error: error_3 });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// Get recent activity
router.get("/api/analytics/activity", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var db, collection, activity, error_4;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                return [4 /*yield*/, connectToDatabase()];
            case 1:
                db = _a.sent();
                collection = db.collection("history");
                return [4 /*yield*/, collection
                        .find({})
                        .sort({ timestamp: -1 })
                        .limit(10)
                        .toArray()];
            case 2:
                activity = _a.sent();
                res.status(200).json(activity);
                return [3 /*break*/, 4];
            case 3:
                error_4 = _a.sent();
                res.status(500).json({ message: "Failed to fetch recent activity", error: error_4 });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
export default router;
