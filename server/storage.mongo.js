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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { connectToDatabase } from "./mongo";
// Helper to get tenantId from context (pass as argument from API)
function getTenantFilter(tenantId) {
    return { tenantId: tenantId };
}
var MongoStorage = /** @class */ (function () {
    function MongoStorage() {
        this.db = null;
    }
    MongoStorage.prototype.getDb = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!!this.db) return [3 /*break*/, 2];
                        _a = this;
                        return [4 /*yield*/, connectToDatabase()];
                    case 1:
                        _a.db = _b.sent();
                        _b.label = 2;
                    case 2: return [2 /*return*/, this.db];
                }
            });
        });
    };
    // Users
    MongoStorage.prototype.getUsers = function (tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            var db, users;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getDb()];
                    case 1:
                        db = _a.sent();
                        return [4 /*yield*/, db.collection("users").find(getTenantFilter(tenantId)).toArray()];
                    case 2:
                        users = _a.sent();
                        // Map MongoDB _id to id for frontend compatibility
                        return [2 /*return*/, users.map(function (u) { var _a; return (__assign(__assign({}, u), { id: (_a = u._id) === null || _a === void 0 ? void 0 : _a.toString() })); })];
                }
            });
        });
    };
    MongoStorage.prototype.getUser = function (id, tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            var db, ObjectId, filter, user;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.getDb()];
                    case 1:
                        db = _b.sent();
                        return [4 /*yield*/, import("mongodb")];
                    case 2:
                        ObjectId = (_b.sent()).ObjectId;
                        filter = __assign({}, getTenantFilter(tenantId));
                        try {
                            filter._id = new ObjectId(id);
                        }
                        catch (_c) {
                            filter.id = id;
                        }
                        return [4 /*yield*/, db.collection("users").findOne(filter)];
                    case 3:
                        user = _b.sent();
                        if (!user)
                            return [2 /*return*/, undefined];
                        return [2 /*return*/, __assign(__assign({}, user), { id: (_a = user._id) === null || _a === void 0 ? void 0 : _a.toString() })];
                }
            });
        });
    };
    MongoStorage.prototype.getUserByEmail = function (email) {
        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
            throw new Error('Not implemented');
        }); });
    };
    MongoStorage.prototype.createUser = function (user, tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            var db, ObjectId, doc;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getDb()];
                    case 1:
                        db = _a.sent();
                        return [4 /*yield*/, import("mongodb")];
                    case 2:
                        ObjectId = (_a.sent()).ObjectId;
                        doc = __assign(__assign({}, user), { tenantId: tenantId, _id: new ObjectId() });
                        return [4 /*yield*/, db.collection("users").insertOne(doc)];
                    case 3:
                        _a.sent();
                        // Return user with both id and _id for frontend compatibility
                        return [2 /*return*/, __assign(__assign({}, user), { id: doc._id.toString(), _id: doc._id, tenantId: tenantId })];
                }
            });
        });
    };
    MongoStorage.prototype.updateUser = function (id, user, tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            var db, ObjectId, filter, result;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.getDb()];
                    case 1:
                        db = _b.sent();
                        return [4 /*yield*/, import("mongodb")];
                    case 2:
                        ObjectId = (_b.sent()).ObjectId;
                        filter = __assign({}, getTenantFilter(tenantId));
                        try {
                            filter._id = new ObjectId(id);
                        }
                        catch (_c) {
                            filter.id = id;
                        }
                        return [4 /*yield*/, db.collection("users").findOneAndUpdate(filter, { $set: user }, { returnDocument: "after" })];
                    case 3:
                        result = _b.sent();
                        if (!result || !result.value)
                            return [2 /*return*/, undefined];
                        return [2 /*return*/, __assign(__assign({}, result.value), { id: (_a = result.value._id) === null || _a === void 0 ? void 0 : _a.toString(), _id: result.value._id })];
                }
            });
        });
    };
    MongoStorage.prototype.deleteUser = function (id, tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            var db, ObjectId, filter, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getDb()];
                    case 1:
                        db = _a.sent();
                        return [4 /*yield*/, import("mongodb")];
                    case 2:
                        ObjectId = (_a.sent()).ObjectId;
                        filter = __assign({}, getTenantFilter(tenantId));
                        try {
                            filter._id = new ObjectId(id);
                        }
                        catch (_b) {
                            filter.id = id;
                        }
                        return [4 /*yield*/, db.collection("users").deleteOne(filter)];
                    case 3:
                        result = _a.sent();
                        return [2 /*return*/, result.deletedCount === 1];
                }
            });
        });
    };
    // Subscriptions
    MongoStorage.prototype.getSubscriptions = function (tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            var db, subs;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getDb()];
                    case 1:
                        db = _a.sent();
                        return [4 /*yield*/, db.collection("subscriptions").find(getTenantFilter(tenantId)).toArray()];
                    case 2:
                        subs = _a.sent();
                        // Ensure no empty string for Select fields
                        return [2 /*return*/, subs.map(function (s) { return (__assign(__assign({}, s), { billingCycle: s.billingCycle && s.billingCycle !== "" ? s.billingCycle : "monthly", category: s.category && s.category !== "" ? s.category : "Software", status: s.status && s.status !== "" ? s.status : "Active", reminderPolicy: s.reminderPolicy && s.reminderPolicy !== "" ? s.reminderPolicy : "One time" })); })];
                }
            });
        });
    };
    MongoStorage.prototype.getSubscription = function (id, tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            var db, ObjectId, filter, subscription;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.getDb()];
                    case 1:
                        db = _b.sent();
                        return [4 /*yield*/, import("mongodb")];
                    case 2:
                        ObjectId = (_b.sent()).ObjectId;
                        filter = { $or: [{ _id: new ObjectId(id), tenantId: tenantId }, { id: id, tenantId: tenantId }] };
                        return [4 /*yield*/, db.collection("subscriptions").findOne(filter)];
                    case 3:
                        subscription = _b.sent();
                        if (!subscription)
                            return [2 /*return*/, undefined];
                        return [2 /*return*/, __assign(__assign({}, subscription), { id: (_a = subscription._id) === null || _a === void 0 ? void 0 : _a.toString(), billingCycle: subscription.billingCycle && subscription.billingCycle !== "" ? subscription.billingCycle : "monthly", category: subscription.category && subscription.category !== "" ? subscription.category : "Software", status: subscription.status && subscription.status !== "" ? subscription.status : "Active", reminderPolicy: subscription.reminderPolicy && subscription.reminderPolicy !== "" ? subscription.reminderPolicy : "One time" })];
                }
            });
        });
    };
    MongoStorage.prototype.createSubscription = function (subscription, tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            var db, ObjectId, updatedAt, rest, doc;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getDb()];
                    case 1:
                        db = _a.sent();
                        return [4 /*yield*/, import("mongodb")];
                    case 2:
                        ObjectId = (_a.sent()).ObjectId;
                        updatedAt = subscription.updatedAt, rest = __rest(subscription, ["updatedAt"]);
                        doc = __assign(__assign({}, rest), { tenantId: tenantId, _id: new ObjectId() });
                        return [4 /*yield*/, db.collection("subscriptions").insertOne(doc)];
                    case 3:
                        _a.sent();
                        // Generate reminders for this subscription
                        return [4 /*yield*/, this.generateAndInsertRemindersForSubscription(doc, tenantId)];
                    case 4:
                        // Generate reminders for this subscription
                        _a.sent();
                        return [2 /*return*/, __assign(__assign({}, rest), { id: doc._id.toString(), tenantId: tenantId })];
                }
            });
        });
    };
    MongoStorage.prototype.updateSubscription = function (id, subscription, tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            var db, ObjectId, filter, updatedAt, rest, result, subscriptionId;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.getDb()];
                    case 1:
                        db = _b.sent();
                        return [4 /*yield*/, import("mongodb")];
                    case 2:
                        ObjectId = (_b.sent()).ObjectId;
                        filter = { $or: [{ _id: new ObjectId(id), tenantId: tenantId }, { id: id, tenantId: tenantId }] };
                        updatedAt = subscription.updatedAt, rest = __rest(subscription, ["updatedAt"]);
                        return [4 /*yield*/, db.collection("subscriptions").findOneAndUpdate(filter, { $set: rest }, { returnDocument: "after" })];
                    case 3:
                        result = _b.sent();
                        if (!result || !result.value)
                            return [2 /*return*/, undefined];
                        subscriptionId = (_a = result.value._id) === null || _a === void 0 ? void 0 : _a.toString();
                        if (!subscriptionId) return [3 /*break*/, 5];
                        return [4 /*yield*/, db.collection("reminders").deleteMany({ subscriptionId: subscriptionId })];
                    case 4:
                        _b.sent();
                        _b.label = 5;
                    case 5: return [4 /*yield*/, this.generateAndInsertRemindersForSubscription(result.value, tenantId)];
                    case 6:
                        _b.sent();
                        return [2 /*return*/, result.value];
                }
            });
        });
    };
    /**
     * Generate and insert reminders for a subscription (on create or update)
     */
    MongoStorage.prototype.generateAndInsertRemindersForSubscription = function (subscription, tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            var db, subscriptionId, renewalDate, frequency, reminderDays, reminderPolicy, remindersToInsert, reminderDate, firstDate, secondDays, secondDate, startDate, current, end, _i, remindersToInsert_1, reminder;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.getDb()];
                    case 1:
                        db = _b.sent();
                        subscriptionId = (_a = subscription._id) === null || _a === void 0 ? void 0 : _a.toString();
                        if (!subscriptionId)
                            return [2 /*return*/];
                        // Remove all old reminders for this subscription
                        return [4 /*yield*/, db.collection("reminders").deleteMany({ subscriptionId: subscriptionId })];
                    case 2:
                        // Remove all old reminders for this subscription
                        _b.sent();
                        renewalDate = subscription.nextRenewal || subscription.endDate;
                        if (!renewalDate)
                            return [2 /*return*/];
                        frequency = subscription.frequency || "Monthly";
                        reminderDays = Number(subscription.reminderDays) || 7;
                        reminderPolicy = subscription.reminderPolicy || "One time";
                        remindersToInsert = [];
                        if (reminderPolicy === "One time") {
                            reminderDate = new Date(renewalDate);
                            reminderDate.setDate(reminderDate.getDate() - reminderDays);
                            remindersToInsert.push({
                                type: "Before ".concat(reminderDays, " days"),
                                date: reminderDate.toISOString().slice(0, 10),
                            });
                        }
                        else if (reminderPolicy === "Two times") {
                            firstDate = new Date(renewalDate);
                            firstDate.setDate(firstDate.getDate() - reminderDays);
                            secondDays = Math.floor(reminderDays / 2);
                            secondDate = new Date(renewalDate);
                            secondDate.setDate(secondDate.getDate() - secondDays);
                            remindersToInsert.push({
                                type: "Before ".concat(reminderDays, " days"),
                                date: firstDate.toISOString().slice(0, 10),
                            });
                            if (secondDays > 0 && secondDays !== reminderDays) {
                                remindersToInsert.push({
                                    type: "Before ".concat(secondDays, " days"),
                                    date: secondDate.toISOString().slice(0, 10),
                                });
                            }
                        }
                        else if (reminderPolicy === "Until Renewal") {
                            startDate = new Date(renewalDate);
                            startDate.setDate(startDate.getDate() - reminderDays);
                            current = new Date(startDate);
                            end = new Date(renewalDate);
                            while (current <= end) {
                                remindersToInsert.push({
                                    type: "Daily",
                                    date: current.toISOString().slice(0, 10),
                                });
                                current.setDate(current.getDate() + 1);
                            }
                        }
                        _i = 0, remindersToInsert_1 = remindersToInsert;
                        _b.label = 3;
                    case 3:
                        if (!(_i < remindersToInsert_1.length)) return [3 /*break*/, 6];
                        reminder = remindersToInsert_1[_i];
                        return [4 /*yield*/, db.collection("reminders").insertOne({
                                subscriptionId: subscriptionId,
                                reminderType: reminder.type,
                                reminderDate: reminder.date,
                                sent: false,
                                status: subscription.status || "Active",
                                createdAt: new Date(),
                                tenantId: tenantId,
                            })];
                    case 4:
                        _b.sent();
                        _b.label = 5;
                    case 5:
                        _i++;
                        return [3 /*break*/, 3];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    MongoStorage.prototype.deleteSubscription = function (id, tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            var db, ObjectId, filter, result, subscriptionId;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.getDb()];
                    case 1:
                        db = _b.sent();
                        return [4 /*yield*/, import("mongodb")];
                    case 2:
                        ObjectId = (_b.sent()).ObjectId;
                        filter = { $or: [{ _id: new ObjectId(id), tenantId: tenantId }, { id: id, tenantId: tenantId }] };
                        return [4 /*yield*/, db.collection("subscriptions").findOneAndDelete(filter)];
                    case 3:
                        result = _b.sent();
                        if (!(result && result.value)) return [3 /*break*/, 8];
                        subscriptionId = (_a = result.value._id) === null || _a === void 0 ? void 0 : _a.toString();
                        if (!subscriptionId) return [3 /*break*/, 5];
                        return [4 /*yield*/, db.collection("reminders").deleteMany({ $or: [{ subscriptionId: subscriptionId }, { subscriptionId: new ObjectId(subscriptionId) }] })];
                    case 4:
                        _b.sent();
                        _b.label = 5;
                    case 5:
                        if (!subscriptionId) return [3 /*break*/, 7];
                        return [4 /*yield*/, db.collection("notifications").deleteMany({ $or: [{ subscriptionId: subscriptionId }, { subscriptionId: new ObjectId(subscriptionId) }] })];
                    case 6:
                        _b.sent();
                        _b.label = 7;
                    case 7: return [2 /*return*/, { success: true, message: "Subscription deleted successfully" }];
                    case 8: return [2 /*return*/, { success: false, message: "Subscription not found" }];
                }
            });
        });
    };
    // Reminders
    MongoStorage.prototype.getReminders = function (tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            var db, reminders;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getDb()];
                    case 1:
                        db = _a.sent();
                        return [4 /*yield*/, db.collection("reminders").find(getTenantFilter(tenantId)).toArray()];
                    case 2:
                        reminders = _a.sent();
                        return [2 /*return*/, reminders.map(function (r) { var _a; return (__assign(__assign({}, r), { id: (_a = r._id) === null || _a === void 0 ? void 0 : _a.toString() })); })];
                }
            });
        });
    };
    MongoStorage.prototype.getReminderBySubscriptionId = function (subscriptionId) {
        return __awaiter(this, void 0, void 0, function () {
            var db, reminder;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.getDb()];
                    case 1:
                        db = _b.sent();
                        return [4 /*yield*/, db.collection("reminders").findOne({ subscriptionId: subscriptionId })];
                    case 2:
                        reminder = _b.sent();
                        if (!reminder)
                            return [2 /*return*/, undefined];
                        return [2 /*return*/, __assign(__assign({}, reminder), { id: (_a = reminder._id) === null || _a === void 0 ? void 0 : _a.toString() })];
                }
            });
        });
    };
    MongoStorage.prototype.createReminder = function (reminder, tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            var db, ObjectId, doc;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getDb()];
                    case 1:
                        db = _a.sent();
                        return [4 /*yield*/, import("mongodb")];
                    case 2:
                        ObjectId = (_a.sent()).ObjectId;
                        doc = __assign(__assign({}, reminder), { tenantId: tenantId, _id: new ObjectId() });
                        return [4 /*yield*/, db.collection("reminders").insertOne(doc)];
                    case 3:
                        _a.sent();
                        return [2 /*return*/, __assign(__assign({}, reminder), { id: doc._id.toString(), tenantId: tenantId })];
                }
            });
        });
    };
    MongoStorage.prototype.updateReminder = function (id, reminder, tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            var db, ObjectId, filter, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getDb()];
                    case 1:
                        db = _a.sent();
                        return [4 /*yield*/, import("mongodb")];
                    case 2:
                        ObjectId = (_a.sent()).ObjectId;
                        filter = { $or: [{ id: id, tenantId: tenantId }, { id: id.toString(), tenantId: tenantId }] };
                        try {
                            filter.$or.push({ _id: new ObjectId(id), tenantId: tenantId });
                        }
                        catch (_b) { }
                        try {
                            filter.$or.push({ _id: new ObjectId(id.toString()), tenantId: tenantId });
                        }
                        catch (_c) { }
                        return [4 /*yield*/, db.collection("reminders").findOneAndUpdate(filter, { $set: reminder }, { returnDocument: "after" })];
                    case 3:
                        result = _a.sent();
                        if (!result)
                            return [2 /*return*/, undefined];
                        return [2 /*return*/, result.value];
                }
            });
        });
    };
    MongoStorage.prototype.deleteReminder = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var db, ObjectId, filter, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getDb()];
                    case 1:
                        db = _a.sent();
                        return [4 /*yield*/, import("mongodb")];
                    case 2:
                        ObjectId = (_a.sent()).ObjectId;
                        filter = { $or: [{ id: id }, { id: id.toString() }] };
                        try {
                            filter.$or.push({ _id: new ObjectId(id) });
                        }
                        catch (_b) { }
                        try {
                            filter.$or.push({ _id: new ObjectId(id.toString()) });
                        }
                        catch (_c) { }
                        return [4 /*yield*/, db.collection("reminders").deleteOne(filter)];
                    case 3:
                        result = _a.sent();
                        return [2 /*return*/, result.deletedCount === 1];
                }
            });
        });
    };
    // Compliance
    MongoStorage.prototype.getComplianceItems = function (tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            var db;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getDb()];
                    case 1:
                        db = _a.sent();
                        return [4 /*yield*/, db.collection("compliance").find(getTenantFilter(tenantId)).toArray()];
                    case 2: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MongoStorage.prototype.createComplianceItem = function (item, tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            var db, ObjectId, doc;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getDb()];
                    case 1:
                        db = _a.sent();
                        return [4 /*yield*/, import("mongodb")];
                    case 2:
                        ObjectId = (_a.sent()).ObjectId;
                        doc = __assign(__assign({}, item), { tenantId: tenantId, _id: new ObjectId() });
                        return [4 /*yield*/, db.collection("compliance").insertOne(doc)];
                    case 3:
                        _a.sent();
                        return [2 /*return*/, __assign(__assign({}, item), { id: doc._id.toString(), tenantId: tenantId })];
                }
            });
        });
    };
    MongoStorage.prototype.updateComplianceItem = function (id, item) {
        return __awaiter(this, void 0, void 0, function () {
            var db, ObjectId, filter, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getDb()];
                    case 1:
                        db = _a.sent();
                        return [4 /*yield*/, import("mongodb")];
                    case 2:
                        ObjectId = (_a.sent()).ObjectId;
                        filter = { $or: [] };
                        // Try ObjectId
                        try {
                            filter.$or.push({ _id: new ObjectId(id) });
                        }
                        catch (_b) { }
                        // Try string id
                        filter.$or.push({ id: id });
                        return [4 /*yield*/, db.collection("compliance").findOneAndUpdate(filter, { $set: item }, { returnDocument: "after" })];
                    case 3:
                        result = _a.sent();
                        return [2 /*return*/, (result === null || result === void 0 ? void 0 : result.value) || null];
                }
            });
        });
    };
    MongoStorage.prototype.deleteComplianceItem = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var db, ObjectId, filter, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getDb()];
                    case 1:
                        db = _a.sent();
                        return [4 /*yield*/, import("mongodb")];
                    case 2:
                        ObjectId = (_a.sent()).ObjectId;
                        filter = { $or: [] };
                        // Try ObjectId
                        try {
                            filter.$or.push({ _id: new ObjectId(id) });
                        }
                        catch (_b) { }
                        // Try string id
                        filter.$or.push({ id: id });
                        return [4 /*yield*/, db.collection("compliance").deleteOne(filter)];
                    case 3:
                        result = _a.sent();
                        return [2 /*return*/, result.deletedCount === 1];
                }
            });
        });
    };
    // History
    MongoStorage.prototype.getHistoryItems = function (tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            var db;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getDb()];
                    case 1:
                        db = _a.sent();
                        return [4 /*yield*/, db.collection("history").find(getTenantFilter(tenantId)).toArray()];
                    case 2: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MongoStorage.prototype.createHistoryItem = function (item, tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            var db, ObjectId, doc;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getDb()];
                    case 1:
                        db = _a.sent();
                        return [4 /*yield*/, import("mongodb")];
                    case 2:
                        ObjectId = (_a.sent()).ObjectId;
                        doc = __assign(__assign({}, item), { tenantId: tenantId, _id: new ObjectId() });
                        return [4 /*yield*/, db.collection("history").insertOne(doc)];
                    case 3:
                        _a.sent();
                        return [2 /*return*/, __assign(__assign({}, item), { id: doc._id.toString(), tenantId: tenantId })];
                }
            });
        });
    };
    MongoStorage.prototype.updateHistoryItem = function (id, item) {
        return __awaiter(this, void 0, void 0, function () {
            var db, ObjectId, filter, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getDb()];
                    case 1:
                        db = _a.sent();
                        return [4 /*yield*/, import("mongodb")];
                    case 2:
                        ObjectId = (_a.sent()).ObjectId;
                        filter = { $or: [] };
                        // Try ObjectId
                        try {
                            filter.$or.push({ _id: new ObjectId(id) });
                        }
                        catch (_b) { }
                        // Try string id
                        filter.$or.push({ id: id });
                        return [4 /*yield*/, db.collection("history").findOneAndUpdate(filter, { $set: item }, { returnDocument: "after" })];
                    case 3:
                        result = _a.sent();
                        return [2 /*return*/, (result === null || result === void 0 ? void 0 : result.value) || null];
                }
            });
        });
    };
    MongoStorage.prototype.deleteHistoryItem = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var db, ObjectId, filter, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getDb()];
                    case 1:
                        db = _a.sent();
                        return [4 /*yield*/, import("mongodb")];
                    case 2:
                        ObjectId = (_a.sent()).ObjectId;
                        filter = { $or: [] };
                        // Try ObjectId
                        try {
                            filter.$or.push({ _id: new ObjectId(id) });
                        }
                        catch (_b) { }
                        // Try string id
                        filter.$or.push({ id: id });
                        return [4 /*yield*/, db.collection("history").deleteOne(filter)];
                    case 3:
                        result = _a.sent();
                        return [2 /*return*/, result.deletedCount === 1];
                }
            });
        });
    };
    // Payments
    MongoStorage.prototype.getPayments = function (tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            var db;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getDb()];
                    case 1:
                        db = _a.sent();
                        return [4 /*yield*/, db.collection("payment").find(getTenantFilter(tenantId)).toArray()];
                    case 2: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MongoStorage.prototype.createPayment = function (payment, tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            var db, ObjectId, doc;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getDb()];
                    case 1:
                        db = _a.sent();
                        return [4 /*yield*/, import("mongodb")];
                    case 2:
                        ObjectId = (_a.sent()).ObjectId;
                        doc = __assign(__assign({}, payment), { tenantId: tenantId, _id: new ObjectId() });
                        return [4 /*yield*/, db.collection("payment").insertOne(doc)];
                    case 3:
                        _a.sent();
                        return [2 /*return*/, __assign(__assign({}, payment), { id: doc._id.toString(), tenantId: tenantId })];
                }
            });
        });
    };
    MongoStorage.prototype.updatePayment = function (id, payment) {
        return __awaiter(this, void 0, void 0, function () {
            var db, ObjectId, filter, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getDb()];
                    case 1:
                        db = _a.sent();
                        return [4 /*yield*/, import("mongodb")];
                    case 2:
                        ObjectId = (_a.sent()).ObjectId;
                        filter = { $or: [] };
                        // Try ObjectId
                        try {
                            filter.$or.push({ _id: new ObjectId(id) });
                        }
                        catch (_b) { }
                        // Try string id
                        filter.$or.push({ id: id });
                        return [4 /*yield*/, db.collection("payment").findOneAndUpdate(filter, { $set: payment }, { returnDocument: "after" })];
                    case 3:
                        result = _a.sent();
                        return [2 /*return*/, (result === null || result === void 0 ? void 0 : result.value) || null];
                }
            });
        });
    };
    MongoStorage.prototype.deletePayment = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var db, ObjectId, filter, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getDb()];
                    case 1:
                        db = _a.sent();
                        return [4 /*yield*/, import("mongodb")];
                    case 2:
                        ObjectId = (_a.sent()).ObjectId;
                        filter = { $or: [] };
                        // Try ObjectId
                        try {
                            filter.$or.push({ _id: new ObjectId(id) });
                        }
                        catch (_b) { }
                        // Try string id
                        filter.$or.push({ id: id });
                        return [4 /*yield*/, db.collection("payment").deleteOne(filter)];
                    case 3:
                        result = _a.sent();
                        return [2 /*return*/, result.deletedCount === 1];
                }
            });
        });
    };
    // Ledger
    MongoStorage.prototype.getLedgerItems = function (tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            var db;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getDb()];
                    case 1:
                        db = _a.sent();
                        return [4 /*yield*/, db.collection("ledger").find(getTenantFilter(tenantId)).toArray()];
                    case 2: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MongoStorage.prototype.createLedgerItem = function (item, tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            var db, ObjectId, doc;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getDb()];
                    case 1:
                        db = _a.sent();
                        return [4 /*yield*/, import("mongodb")];
                    case 2:
                        ObjectId = (_a.sent()).ObjectId;
                        doc = __assign(__assign({}, item), { tenantId: tenantId, _id: new ObjectId() });
                        return [4 /*yield*/, db.collection("ledger").insertOne(doc)];
                    case 3:
                        _a.sent();
                        return [2 /*return*/, __assign(__assign({}, item), { id: doc._id.toString(), tenantId: tenantId })];
                }
            });
        });
    };
    MongoStorage.prototype.deleteLedgerItem = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var db, ObjectId, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getDb()];
                    case 1:
                        db = _a.sent();
                        return [4 /*yield*/, import("mongodb")];
                    case 2:
                        ObjectId = (_a.sent()).ObjectId;
                        return [4 /*yield*/, db.collection("ledger").deleteOne({ _id: new ObjectId(id) })];
                    case 3:
                        result = _a.sent();
                        return [2 /*return*/, result.deletedCount === 1];
                }
            });
        });
    };
    // Employees
    MongoStorage.prototype.getEmployees = function (tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            var db;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getDb()];
                    case 1:
                        db = _a.sent();
                        return [4 /*yield*/, db.collection("employees").find(getTenantFilter(tenantId)).toArray()];
                    case 2: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MongoStorage.prototype.createEmployee = function (employee, tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            var db, ObjectId, doc;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getDb()];
                    case 1:
                        db = _a.sent();
                        return [4 /*yield*/, import("mongodb")];
                    case 2:
                        ObjectId = (_a.sent()).ObjectId;
                        doc = __assign(__assign({}, employee), { tenantId: tenantId, _id: new ObjectId() });
                        return [4 /*yield*/, db.collection("employees").insertOne(doc)];
                    case 3:
                        _a.sent();
                        return [2 /*return*/, __assign(__assign({}, employee), { id: doc._id.toString(), tenantId: tenantId })];
                }
            });
        });
    };
    // Analytics
    MongoStorage.prototype.getDashboardMetrics = function (tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            var db, now, monthStart, monthEnd, monthlySpendAgg, monthlySpend, yearStart, yearEnd, yearlySpendAgg, yearlySpend, activeSubscriptions, upcomingRenewals;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, this.getDb()];
                    case 1:
                        db = _c.sent();
                        now = new Date();
                        monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                        monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                        return [4 /*yield*/, db.collection("subscriptions").aggregate([
                                { $match: { tenantId: tenantId, startDate: { $lte: monthEnd }, nextRenewal: { $gte: monthStart } } },
                                { $group: { _id: null, total: { $sum: "$amount" } } }
                            ]).toArray()];
                    case 2:
                        monthlySpendAgg = _c.sent();
                        monthlySpend = ((_a = monthlySpendAgg[0]) === null || _a === void 0 ? void 0 : _a.total) || 0;
                        yearStart = new Date(now.getFullYear(), 0, 1);
                        yearEnd = new Date(now.getFullYear(), 11, 31);
                        return [4 /*yield*/, db.collection("subscriptions").aggregate([
                                { $match: { tenantId: tenantId, startDate: { $lte: yearEnd }, nextRenewal: { $gte: yearStart } } },
                                { $group: { _id: null, total: { $sum: "$amount" } } }
                            ]).toArray()];
                    case 3:
                        yearlySpendAgg = _c.sent();
                        yearlySpend = ((_b = yearlySpendAgg[0]) === null || _b === void 0 ? void 0 : _b.total) || 0;
                        return [4 /*yield*/, db.collection("subscriptions").countDocuments({ tenantId: tenantId, status: "Active" })];
                    case 4:
                        activeSubscriptions = _c.sent();
                        return [4 /*yield*/, db.collection("subscriptions").countDocuments({ tenantId: tenantId, nextRenewal: { $gte: now, $lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) } })];
                    case 5:
                        upcomingRenewals = _c.sent();
                        return [2 /*return*/, { monthlySpend: monthlySpend, yearlySpend: yearlySpend, activeSubscriptions: activeSubscriptions, upcomingRenewals: upcomingRenewals }];
                }
            });
        });
    };
    MongoStorage.prototype.getSpendingTrends = function (tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            var db, trends;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getDb()];
                    case 1:
                        db = _a.sent();
                        return [4 /*yield*/, db.collection("subscriptions").aggregate([
                                { $match: { tenantId: tenantId } },
                                {
                                    $group: {
                                        _id: { $dateToString: { format: "%Y-%m", date: "$startDate" } },
                                        amount: { $sum: "$amount" }
                                    }
                                },
                                { $sort: { "_id": 1 } }
                            ]).toArray()];
                    case 2:
                        trends = _a.sent();
                        return [2 /*return*/, trends.map(function (t) { return ({ month: t._id, amount: t.amount }); })];
                }
            });
        });
    };
    MongoStorage.prototype.getCategoryBreakdown = function (tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            var db, categories, colorList;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getDb()];
                    case 1:
                        db = _a.sent();
                        return [4 /*yield*/, db.collection("subscriptions").aggregate([
                                { $match: { tenantId: tenantId } },
                                {
                                    $group: {
                                        _id: "$category",
                                        amount: { $sum: "$amount" }
                                    }
                                }
                            ]).toArray()];
                    case 2:
                        categories = _a.sent();
                        colorList = ["#6366f1", "#f59e42", "#10b981", "#ef4444", "#3b82f6", "#a78bfa", "#f43f5e", "#fbbf24"];
                        return [2 /*return*/, categories.map(function (c, i) { return ({ category: c._id, amount: c.amount, color: colorList[i % colorList.length] }); })];
                }
            });
        });
    };
    MongoStorage.prototype.getRecentActivity = function (tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            var db, subs, reminders, subActivitiesMap, _i, subs_1, s, event_1, desc, icon, action, existing, subActivities, reminderActivities, all;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, this.getDb()];
                    case 1:
                        db = _c.sent();
                        return [4 /*yield*/, db.collection("subscriptions").find({ tenantId: tenantId }).sort({ createdAt: -1, updatedAt: -1 }).limit(20).toArray()];
                    case 2:
                        subs = _c.sent();
                        return [4 /*yield*/, db.collection("reminders").find({ tenantId: tenantId }).sort({ createdAt: -1 }).limit(20).toArray()];
                    case 3:
                        reminders = _c.sent();
                        subActivitiesMap = new Map();
                        for (_i = 0, subs_1 = subs; _i < subs_1.length; _i++) {
                            s = subs_1[_i];
                            event_1 = null;
                            if (s.updatedAt && (!s.createdAt || s.updatedAt.getTime() !== s.createdAt.getTime())) {
                                desc = "".concat(s.serviceName, " subscription updated");
                                icon = "edit";
                                action = "updated";
                                if (s.billingCycle && s.prevBillingCycle && s.billingCycle !== s.prevBillingCycle) {
                                    desc = "".concat(s.serviceName, " billing cycle changed to ").concat(s.billingCycle);
                                    icon = "edit";
                                    action = "billing_cycle";
                                }
                                event_1 = {
                                    id: (_a = s._id) === null || _a === void 0 ? void 0 : _a.toString(),
                                    type: "updated",
                                    description: desc,
                                    amount: s.amount ? "$".concat(Number(s.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }), "/").concat(s.billingCycle) : undefined,
                                    timestamp: s.updatedAt.toISOString(),
                                    icon: icon,
                                    action: action
                                };
                            }
                            else if (s.createdAt) {
                                event_1 = {
                                    id: (_b = s._id) === null || _b === void 0 ? void 0 : _b.toString(),
                                    type: "added",
                                    description: "".concat(s.serviceName, " subscription added"),
                                    amount: s.amount ? "$".concat(Number(s.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }), "/").concat(s.billingCycle) : undefined,
                                    timestamp: s.createdAt.toISOString(),
                                    icon: "plus",
                                    action: "added"
                                };
                            }
                            if (event_1) {
                                existing = subActivitiesMap.get(event_1.id);
                                if (!existing || (existing.timestamp < event_1.timestamp)) {
                                    subActivitiesMap.set(event_1.id, event_1);
                                }
                            }
                        }
                        subActivities = Array.from(subActivitiesMap.values());
                        reminderActivities = reminders.map(function (r) {
                            var _a;
                            var desc = "Reminder for subscription ".concat(r.subscriptionId);
                            var icon = "bell";
                            var action = "reminder";
                            return {
                                id: (_a = r._id) === null || _a === void 0 ? void 0 : _a.toString(),
                                type: "reminder",
                                description: desc,
                                amount: r.amount ? "$".concat(Number(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }), "/").concat(r.billingCycle || "month") : undefined,
                                timestamp: r.createdAt ? r.createdAt.toISOString() : "",
                                icon: icon,
                                action: action
                            };
                        });
                        all = __spreadArray(__spreadArray([], subActivities, true), reminderActivities, true).sort(function (a, b) { return (b.timestamp || "") < (a.timestamp || "") ? -1 : 1; });
                        return [2 /*return*/, all.slice(0, 10)];
                }
            });
        });
    };
    MongoStorage.prototype.getNotifications = function (tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            var db, reminders, remindersBySub, _i, reminders_1, reminder, subId, ObjectId, notifications, today, remindersEntries, _loop_1, _a, remindersEntries_1, entry;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, this.getDb()];
                    case 1:
                        db = _c.sent();
                        return [4 /*yield*/, db.collection("reminders").find({ tenantId: tenantId, sent: false }).toArray()];
                    case 2:
                        reminders = _c.sent();
                        remindersBySub = new Map();
                        for (_i = 0, reminders_1 = reminders; _i < reminders_1.length; _i++) {
                            reminder = reminders_1[_i];
                            subId = reminder.subscriptionId || reminder.subscription_id;
                            if (!subId)
                                continue;
                            if (!remindersBySub.has(subId))
                                remindersBySub.set(subId, []);
                            remindersBySub.get(subId).push(reminder);
                        }
                        return [4 /*yield*/, import("mongodb")];
                    case 3:
                        ObjectId = (_c.sent()).ObjectId;
                        notifications = [];
                        today = new Date();
                        remindersEntries = Array.from(remindersBySub.entries());
                        _loop_1 = function (entry) {
                            var subId, subReminders, subscription, _d, reminderPolicy, reminderDays, renewalDate, reminderTriggeredDate, trigger, first, secondDays, second, start, end, found, current, reminderObj;
                            return __generator(this, function (_e) {
                                switch (_e.label) {
                                    case 0:
                                        subId = entry[0];
                                        subReminders = entry[1];
                                        subscription = null;
                                        _e.label = 1;
                                    case 1:
                                        _e.trys.push([1, 3, , 5]);
                                        return [4 /*yield*/, db.collection("subscriptions").findOne({ tenantId: tenantId, _id: new ObjectId(subId) })];
                                    case 2:
                                        subscription = _e.sent();
                                        return [3 /*break*/, 5];
                                    case 3:
                                        _d = _e.sent();
                                        return [4 /*yield*/, db.collection("subscriptions").findOne({ tenantId: tenantId, id: subId })];
                                    case 4:
                                        subscription = _e.sent();
                                        return [3 /*break*/, 5];
                                    case 5:
                                        if (!subscription)
                                            return [2 /*return*/, "continue"];
                                        reminderPolicy = subscription.reminderPolicy || "One time";
                                        reminderDays = Number(subscription.reminderDays) || 7;
                                        renewalDate = subscription.nextRenewal || subscription.endDate;
                                        reminderTriggeredDate = null;
                                        if (reminderPolicy === "One time") {
                                            if (renewalDate) {
                                                trigger = new Date(renewalDate);
                                                trigger.setDate(trigger.getDate() - reminderDays);
                                                reminderTriggeredDate = trigger;
                                            }
                                        }
                                        else if (reminderPolicy === "Two times") {
                                            if (renewalDate) {
                                                first = new Date(renewalDate);
                                                first.setDate(first.getDate() - reminderDays);
                                                secondDays = Math.floor(reminderDays / 2);
                                                second = new Date(renewalDate);
                                                second.setDate(second.getDate() - secondDays);
                                                if (first > today && second > today)
                                                    reminderTriggeredDate = first;
                                                else if (first <= today && second > today)
                                                    reminderTriggeredDate = second;
                                                else if (first > today && second <= today)
                                                    reminderTriggeredDate = first;
                                                else
                                                    reminderTriggeredDate = null;
                                            }
                                        }
                                        else if (reminderPolicy === "Until Renewal") {
                                            if (renewalDate) {
                                                start = new Date(renewalDate);
                                                start.setDate(start.getDate() - reminderDays);
                                                end = new Date(renewalDate);
                                                found = null;
                                                current = new Date(start);
                                                while (current <= end) {
                                                    if (current >= today) {
                                                        found = new Date(current);
                                                        break;
                                                    }
                                                    current.setDate(current.getDate() + 1);
                                                }
                                                reminderTriggeredDate = found;
                                            }
                                        }
                                        reminderObj = subReminders.find(function (r) { return r.reminderDate === (reminderTriggeredDate ? reminderTriggeredDate.toISOString().slice(0, 10) : null); });
                                        if (!reminderObj && subReminders.length > 0)
                                            reminderObj = subReminders[0];
                                        notifications.push({
                                            id: ((_b = reminderObj === null || reminderObj === void 0 ? void 0 : reminderObj._id) === null || _b === void 0 ? void 0 : _b.toString()) || (reminderObj === null || reminderObj === void 0 ? void 0 : reminderObj.id) || subId,
                                            subscriptionId: subId,
                                            subscriptionName: (subscription === null || subscription === void 0 ? void 0 : subscription.serviceName) || "",
                                            category: (subscription === null || subscription === void 0 ? void 0 : subscription.category) || "",
                                            reminderType: (reminderObj === null || reminderObj === void 0 ? void 0 : reminderObj.reminderType) || (reminderObj === null || reminderObj === void 0 ? void 0 : reminderObj.type) || "",
                                            reminderTriggerDate: reminderTriggeredDate ? reminderTriggeredDate.toISOString().slice(0, 10) : reminderObj === null || reminderObj === void 0 ? void 0 : reminderObj.reminderDate,
                                            subscriptionEndDate: (subscription === null || subscription === void 0 ? void 0 : subscription.nextRenewal) || (subscription === null || subscription === void 0 ? void 0 : subscription.endDate) || "",
                                            status: (reminderObj === null || reminderObj === void 0 ? void 0 : reminderObj.status) || (subscription === null || subscription === void 0 ? void 0 : subscription.status) || "Active",
                                        });
                                        return [2 /*return*/];
                                }
                            });
                        };
                        _a = 0, remindersEntries_1 = remindersEntries;
                        _c.label = 4;
                    case 4:
                        if (!(_a < remindersEntries_1.length)) return [3 /*break*/, 7];
                        entry = remindersEntries_1[_a];
                        return [5 /*yield**/, _loop_1(entry)];
                    case 5:
                        _c.sent();
                        _c.label = 6;
                    case 6:
                        _a++;
                        return [3 /*break*/, 4];
                    case 7: return [2 /*return*/, notifications];
                }
            });
        });
    };
    return MongoStorage;
}());
export { MongoStorage };
export var storage = new MongoStorage();
