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
import { MongoStorage } from "./storage.mongo";
var MemStorage = /** @class */ (function () {
    function MemStorage() {
        this.users = new Map();
        this.subscriptions = new Map();
        this.reminders = new Map();
        this.activities = [];
        this.currentUserId = 1;
        this.currentSubscriptionId = 1;
        this.currentReminderId = 1;
    }
    // Category-based default alert periods (in days)
    MemStorage.prototype.getCategoryDefaultAlertDays = function (category, billingCycle) {
        if (category === 'Regulatory') {
            return billingCycle === 'yearly' ? 60 : 14; // 60 days for annual, 14 for others
        }
        // Default periods for other categories
        var defaults = {
            'Entertainment': 7,
            'Software': 14,
            'Business Tools': 21,
            'Cloud Storage': 14,
            'Music': 7,
            'News': 7,
        };
        return defaults[category] || 7;
    };
    MemStorage.prototype.initializeData = function () {
        // No static data initialization
    };
    // Users
    MemStorage.prototype.getUsers = function (tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, Array.from(this.users.values())];
            });
        });
    };
    MemStorage.prototype.getUser = function (id, tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.users.get(Number(id))];
            });
        });
    };
    MemStorage.prototype.getUserByEmail = function (email, tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, Array.from(this.users.values()).find(function (user) { return user.email === email; })];
            });
        });
    };
    MemStorage.prototype.createUser = function (insertUser, tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            var id, user;
            return __generator(this, function (_a) {
                id = this.currentUserId++;
                user = {
                    id: id,
                    name: insertUser.name,
                    email: insertUser.email,
                    role: insertUser.role || "viewer",
                    status: insertUser.status || "active",
                    lastLogin: null,
                };
                this.users.set(id, user);
                return [2 /*return*/, user];
            });
        });
    };
    MemStorage.prototype.updateUser = function (id, updateUser, tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            var numId, user, updatedUser;
            return __generator(this, function (_a) {
                numId = Number(id);
                user = this.users.get(numId);
                if (!user)
                    return [2 /*return*/, undefined];
                updatedUser = __assign(__assign({}, user), updateUser);
                this.users.set(numId, updatedUser);
                return [2 /*return*/, updatedUser];
            });
        });
    };
    MemStorage.prototype.deleteUser = function (id, tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // For MemStorage, just convert id to number for compatibility
                return [2 /*return*/, this.users.delete(Number(id))];
            });
        });
    };
    // Subscriptions
    MemStorage.prototype.getSubscriptions = function (tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, Array.from(this.subscriptions.values()).filter(function (sub) { return sub.isActive; })];
            });
        });
    };
    MemStorage.prototype.getSubscription = function (id, tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.subscriptions.get(id)];
            });
        });
    };
    MemStorage.prototype.createSubscription = function (insertSubscription, tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            var id, subscription;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        id = this.currentSubscriptionId++;
                        subscription = {
                            id: id,
                            serviceName: insertSubscription.serviceName,
                            vendor: insertSubscription.vendor,
                            amount: insertSubscription.amount,
                            billingCycle: insertSubscription.billingCycle,
                            category: insertSubscription.category,
                            startDate: insertSubscription.startDate,
                            nextRenewal: insertSubscription.nextRenewal,
                            status: insertSubscription.status || "Active",
                            reminderDays: insertSubscription.reminderDays || 7,
                            reminderPolicy: insertSubscription.reminderPolicy || "One time",
                            notes: insertSubscription.notes || null,
                            isActive: (_a = insertSubscription.isActive) !== null && _a !== void 0 ? _a : true,
                            createdAt: new Date(),
                            updatedBy: insertSubscription.updatedBy || null,
                        };
                        this.subscriptions.set(String(id), subscription);
                        // Track activity
                        this.activities.push({
                            id: String(id),
                            type: "added",
                            serviceName: subscription.serviceName || '',
                            amount: subscription.amount ? "$".concat(subscription.amount, "/").concat(subscription.billingCycle) : undefined,
                            description: "".concat(subscription.serviceName || 'Subscription', " subscription added"),
                            timestamp: subscription.createdAt.toISOString(),
                        });
                        // Auto-create category-based reminder
                        return [4 /*yield*/, this.createCategoryBasedReminder(subscription, tenantId)];
                    case 1:
                        // Auto-create category-based reminder
                        _b.sent();
                        return [2 /*return*/, subscription];
                }
            });
        });
    };
    MemStorage.prototype.createCategoryBasedReminder = function (subscription, tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            var alertDays, reminderData;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        alertDays = this.getCategoryDefaultAlertDays(subscription.category, subscription.billingCycle);
                        reminderData = {
                            subscriptionId: subscription.id,
                            alertDays: alertDays,
                            emailEnabled: true,
                            whatsappEnabled: subscription.category === 'Regulatory',
                            reminderType: subscription.category === 'Regulatory' && subscription.billingCycle === 'monthly' ? 'monthly_recurring' : 'renewal',
                            monthlyDay: subscription.category === 'Regulatory' && subscription.billingCycle === 'monthly' ? 14 : null,
                        };
                        return [4 /*yield*/, this.createReminder(reminderData, tenantId)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    MemStorage.prototype.updateSubscription = function (id, updateSubscription, tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            var subscription, updatedSubscription;
            return __generator(this, function (_a) {
                subscription = this.subscriptions.get(id);
                if (!subscription)
                    return [2 /*return*/, undefined];
                updatedSubscription = __assign(__assign({}, subscription), updateSubscription);
                this.subscriptions.set(id, updatedSubscription);
                // Track activity
                this.activities.push({
                    id: String(id),
                    type: "updated",
                    serviceName: updatedSubscription.serviceName || '',
                    amount: updatedSubscription.amount ? "$".concat(updatedSubscription.amount, "/").concat(updatedSubscription.billingCycle) : undefined,
                    description: "".concat(updatedSubscription.serviceName || 'Subscription', " subscription updated"),
                    timestamp: new Date().toISOString(),
                });
                return [2 /*return*/, updatedSubscription];
            });
        });
    };
    MemStorage.prototype.deleteSubscription = function (id, tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            var subscription;
            var _this = this;
            return __generator(this, function (_a) {
                subscription = this.subscriptions.get(id);
                if (!subscription) {
                    return [2 /*return*/, { success: false, message: "Subscription not found" }];
                }
                subscription.isActive = false;
                this.subscriptions.set(id, subscription);
                // Delete all reminders for this subscription
                Array.from(this.reminders.entries()).forEach(function (_a) {
                    var reminderId = _a[0], reminder = _a[1];
                    if (String(reminder.subscriptionId) === String(id)) {
                        _this.reminders.delete(reminderId);
                    }
                });
                return [2 /*return*/, { success: true, message: "Subscription and related reminders deleted successfully" }];
            });
        });
    };
    // Reminders
    MemStorage.prototype.getReminders = function (tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, Array.from(this.reminders.values())];
            });
        });
    };
    MemStorage.prototype.getReminderBySubscriptionId = function (subscriptionId, tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, Array.from(this.reminders.values()).find(function (r) { return r.subscriptionId === subscriptionId; })];
            });
        });
    };
    MemStorage.prototype.createReminder = function (insertReminder, tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            var id, reminder, serviceName, amount, sub;
            var _a, _b, _c, _d, _e;
            return __generator(this, function (_f) {
                id = this.currentReminderId++;
                reminder = __assign(__assign({}, insertReminder), { id: id, alertDays: (_a = insertReminder.alertDays) !== null && _a !== void 0 ? _a : 7, emailEnabled: (_b = insertReminder.emailEnabled) !== null && _b !== void 0 ? _b : true, whatsappEnabled: (_c = insertReminder.whatsappEnabled) !== null && _c !== void 0 ? _c : false, reminderType: (_d = insertReminder.reminderType) !== null && _d !== void 0 ? _d : "renewal", monthlyDay: (_e = insertReminder.monthlyDay) !== null && _e !== void 0 ? _e : null });
                this.reminders.set(id, reminder);
                serviceName = "";
                amount = undefined;
                sub = this.subscriptions.get(String(reminder.subscriptionId));
                if (sub) {
                    serviceName = sub.serviceName;
                    amount = sub.amount ? "$".concat(sub.amount, "/").concat(sub.billingCycle) : undefined;
                }
                this.activities.push({
                    id: String(id),
                    type: "reminder",
                    serviceName: serviceName || '',
                    amount: amount,
                    description: serviceName ? "Reminder for ".concat(serviceName, " sent") : "Reminder sent",
                    timestamp: new Date().toISOString(),
                });
                return [2 /*return*/, reminder];
            });
        });
    };
    MemStorage.prototype.updateReminder = function (id, updateReminder, tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            var reminder, updatedReminder;
            return __generator(this, function (_a) {
                reminder = this.reminders.get(id);
                if (!reminder)
                    return [2 /*return*/, undefined];
                updatedReminder = __assign(__assign({}, reminder), updateReminder);
                this.reminders.set(id, updatedReminder);
                return [2 /*return*/, updatedReminder];
            });
        });
    };
    MemStorage.prototype.deleteReminder = function (id, tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            var numId;
            return __generator(this, function (_a) {
                numId = Number(id);
                if (!isNaN(numId)) {
                    return [2 /*return*/, this.reminders.delete(numId)];
                }
                // If not a number, try to delete by string id (for compatibility)
                return [2 /*return*/, this.reminders.delete(id)];
            });
        });
    };
    // Analytics
    MemStorage.prototype.getDashboardMetrics = function (tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            var activeSubscriptions, monthlySpend, yearlySpend, now, thirtyDaysFromNow, upcomingRenewals;
            return __generator(this, function (_a) {
                activeSubscriptions = Array.from(this.subscriptions.values()).filter(function (sub) { return sub.isActive && sub.status === "Active"; });
                monthlySpend = activeSubscriptions
                    .filter(function (sub) { return sub.billingCycle === 'monthly'; })
                    .reduce(function (sum, sub) { return sum + parseFloat(sub.amount); }, 0);
                yearlySpend = activeSubscriptions
                    .reduce(function (sum, sub) {
                    var amount = parseFloat(sub.amount);
                    switch (sub.billingCycle) {
                        case 'monthly': return sum + (amount * 12);
                        case 'yearly': return sum + amount;
                        case 'quarterly': return sum + (amount * 4);
                        case 'weekly': return sum + (amount * 52);
                        default: return sum;
                    }
                }, 0);
                now = new Date();
                thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
                upcomingRenewals = activeSubscriptions
                    .filter(function (sub) { return sub.nextRenewal <= thirtyDaysFromNow; }).length;
                return [2 /*return*/, {
                        monthlySpend: monthlySpend,
                        yearlySpend: yearlySpend,
                        activeSubscriptions: activeSubscriptions.length,
                        upcomingRenewals: upcomingRenewals,
                    }];
            });
        });
    };
    MemStorage.prototype.getSpendingTrends = function () {
        return __awaiter(this, void 0, void 0, function () {
            var months, baseAmount;
            return __generator(this, function (_a) {
                months = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];
                baseAmount = 2100;
                return [2 /*return*/, months.map(function (month, index) { return ({
                        month: month,
                        amount: baseAmount + (index * 150) + Math.floor(Math.random() * 200),
                    }); })];
            });
        });
    };
    MemStorage.prototype.getCategoryBreakdown = function () {
        return __awaiter(this, void 0, void 0, function () {
            var activeSubscriptions, categoryTotals, colors;
            return __generator(this, function (_a) {
                activeSubscriptions = Array.from(this.subscriptions.values()).filter(function (sub) { return sub.isActive; });
                categoryTotals = new Map();
                activeSubscriptions.forEach(function (sub) {
                    var amount = parseFloat(sub.amount);
                    var monthlyAmount = sub.billingCycle === 'monthly' ? amount :
                        sub.billingCycle === 'yearly' ? amount / 12 :
                            sub.billingCycle === 'quarterly' ? amount / 3 :
                                amount * 4.33; // weekly
                    categoryTotals.set(sub.category, (categoryTotals.get(sub.category) || 0) + monthlyAmount);
                });
                colors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'];
                return [2 /*return*/, Array.from(categoryTotals.entries()).map(function (_a, index) {
                        var category = _a[0], amount = _a[1];
                        return ({
                            category: category,
                            amount: amount,
                            color: colors[index % colors.length],
                        });
                    })];
            });
        });
    };
    MemStorage.prototype.getRecentActivity = function (tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // Return tracked activities sorted by timestamp desc
                return [2 /*return*/, this.activities.sort(function (a, b) { return (b.timestamp || "") < (a.timestamp || "") ? -1 : 1; })];
            });
        });
    };
    MemStorage.prototype.getNotifications = function (tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            var notifications;
            var _this = this;
            return __generator(this, function (_a) {
                notifications = [];
                Array.from(this.reminders.values()).forEach(function (rem) {
                    var sub = _this.subscriptions.get(String(rem.subscriptionId));
                    notifications.push({
                        id: String(rem.id),
                        subscriptionId: rem.subscriptionId,
                        subscriptionName: (sub === null || sub === void 0 ? void 0 : sub.serviceName) || "",
                        category: (sub === null || sub === void 0 ? void 0 : sub.category) || "",
                        reminderType: rem.reminderType || "",
                        reminderTriggerDate: new Date().toISOString(),
                        subscriptionEndDate: (sub === null || sub === void 0 ? void 0 : sub.nextRenewal) ? sub.nextRenewal.toISOString() : "",
                        status: (sub === null || sub === void 0 ? void 0 : sub.status) || "active",
                    });
                });
                // Sort by reminderTriggerDate asc
                return [2 /*return*/, notifications.sort(function (a, b) { return new Date(a.reminderTriggerDate).getTime() - new Date(b.reminderTriggerDate).getTime(); })];
            });
        });
    };
    return MemStorage;
}());
export { MemStorage };
export var storage = new MongoStorage();
