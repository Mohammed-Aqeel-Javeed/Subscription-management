// --- History API ---
// List all history records
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
import { ObjectId } from "mongodb";
// --- Payment Methods API ---
var PaymentObjectId = ObjectId;
// List all payment methods
// --- Employees API ---
var EmployeeObjectId = ObjectId;
// --- Ledger API ---
var LedgerObjectId = ObjectId;
import { Router } from "express";
import { connectToDatabase } from "./mongo";
import jwt from "jsonwebtoken";
var JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";
var router = Router();
// JWT middleware to set req.user and req.user.tenantId
router.use(function (req, res, next) {
    var token;
    // Support both Authorization header and cookie
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
        token = req.headers.authorization.replace("Bearer ", "");
    }
    else if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }
    if (token) {
        try {
            var decoded = jwt.verify(token, JWT_SECRET);
            if (typeof decoded === "object" && "tenantId" in decoded) {
                req.user = decoded;
            }
            else {
                req.user = undefined;
            }
        }
        catch (err) {
            req.user = undefined;
        }
    }
    next();
});
// Add a new history record
router.post("/api/history", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var db, historyCollection, _a, subscriptionId, action, data, updatedFields, subscriptionObjId, tenantId, timestamp, historyDoc, result, error_1;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 3, , 4]);
                return [4 /*yield*/, connectToDatabase()];
            case 1:
                db = _c.sent();
                historyCollection = db.collection("history");
                _a = req.body, subscriptionId = _a.subscriptionId, action = _a.action, data = _a.data, updatedFields = _a.updatedFields;
                if (!subscriptionId) {
                    return [2 /*return*/, res.status(400).json({ message: "subscriptionId is required" })];
                }
                console.log("Creating history record for subscriptionId: ".concat(subscriptionId));
                subscriptionObjId = void 0;
                try {
                    subscriptionObjId = new ObjectId(subscriptionId);
                    console.log("Converted to ObjectId successfully: ".concat(subscriptionObjId));
                }
                catch (err) {
                    // If not a valid ObjectId, do not create history record
                    return [2 /*return*/, res.status(400).json({ message: "Invalid subscriptionId format" })];
                }
                tenantId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.tenantId;
                if (!tenantId) {
                    return [2 /*return*/, res.status(401).json({ message: "Missing tenantId in user context" })];
                }
                timestamp = new Date();
                historyDoc = {
                    subscriptionId: subscriptionObjId,
                    tenantId: tenantId,
                    action: action,
                    timestamp: timestamp,
                    data: data ? __assign({}, data) : undefined,
                    updatedFields: updatedFields ? __assign({}, updatedFields) : undefined
                };
                return [4 /*yield*/, historyCollection.insertOne(historyDoc)];
            case 2:
                result = _c.sent();
                res.status(201).json({
                    message: "History record created",
                    _id: result.insertedId
                });
                return [3 /*break*/, 4];
            case 3:
                error_1 = _c.sent();
                res.status(500).json({ message: "Failed to create history record", error: error_1 });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// Get all history records
router.get("/api/history/list", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var db, collection, tenantId, items, processed, error_2, errorMessage;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 3, , 4]);
                return [4 /*yield*/, connectToDatabase()];
            case 1:
                db = _b.sent();
                collection = db.collection("history");
                tenantId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId;
                if (!tenantId) {
                    return [2 /*return*/, res.status(401).json({ message: "Missing tenantId in user context" })];
                }
                return [4 /*yield*/, collection
                        .find({ tenantId: tenantId })
                        .sort({ timestamp: -1, _id: -1 })
                        .toArray()];
            case 2:
                items = _b.sent();
                processed = items.map(function (item) {
                    var _a, _b, _c, _d;
                    return (__assign(__assign({}, item), { _id: (_a = item._id) === null || _a === void 0 ? void 0 : _a.toString(), subscriptionId: (_b = item.subscriptionId) === null || _b === void 0 ? void 0 : _b.toString(), data: item.data ? __assign(__assign({}, item.data), { _id: (_c = item.data._id) === null || _c === void 0 ? void 0 : _c.toString() }) : undefined, updatedFields: item.updatedFields ? __assign(__assign({}, item.updatedFields), { _id: (_d = item.updatedFields._id) === null || _d === void 0 ? void 0 : _d.toString() }) : undefined }));
                });
                res.status(200).json(processed);
                return [3 /*break*/, 4];
            case 3:
                error_2 = _b.sent();
                console.error("History list error:", error_2);
                errorMessage = error_2 instanceof Error ? error_2.message : 'Unknown error occurred';
                res.status(500).json({ message: "Failed to fetch history records", error: errorMessage });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); }); // <-- Add this closing brace to properly end the route handler
// Get history for a specific subscription
router.get("/api/history/:subscriptionId", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var db, collection, subscriptionId, subObjId, tenantId, filter, items, objIdItems, strItems, allItems, processedItems, error_3, errorMessage;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 8, , 9]);
                return [4 /*yield*/, connectToDatabase()];
            case 1:
                db = _b.sent();
                collection = db.collection("history");
                subscriptionId = req.params.subscriptionId;
                console.log("GET /api/history/".concat(subscriptionId, " - Fetching history for subscription"));
                subObjId = void 0;
                try {
                    subObjId = new ObjectId(subscriptionId);
                    console.log("Successfully converted to ObjectId: ".concat(subObjId));
                }
                catch (err) {
                    console.log("Not a valid ObjectId, will use string comparison fallback");
                    // Continue with string comparison
                }
                tenantId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId;
                if (!tenantId) {
                    return [2 /*return*/, res.status(401).json({ message: "Missing tenantId in user context" })];
                }
                filter = subObjId ?
                    { subscriptionId: subObjId, tenantId: tenantId } :
                    { subscriptionId: subscriptionId, tenantId: tenantId };
                console.log("History API Debug: Requested subscriptionId: ".concat(subscriptionId));
                console.log("History API Debug: Filter used:", filter);
                return [4 /*yield*/, collection
                        .find(filter)
                        .sort({ timestamp: -1 })
                        .toArray()];
            case 2:
                items = _b.sent();
                console.log("History API Debug: Returned ".concat(items.length, " records."));
                items.forEach(function (item, idx) {
                    console.log("Record #".concat(idx, ": _id=").concat(item._id, ", subscriptionId=").concat(item.subscriptionId));
                });
                if (!(items.length === 0)) return [3 /*break*/, 7];
                console.log("No records found with combined filter, trying individual lookups for debugging:");
                if (!subObjId) return [3 /*break*/, 4];
                return [4 /*yield*/, collection.find({ subscriptionId: subObjId }).toArray()];
            case 3:
                objIdItems = _b.sent();
                console.log("- Direct subscriptionId as ObjectId: ".concat(objIdItems.length, " records"));
                _b.label = 4;
            case 4: return [4 /*yield*/, collection.find({ subscriptionId: subscriptionId }).toArray()];
            case 5:
                strItems = _b.sent();
                console.log("- Direct subscriptionId as string: ".concat(strItems.length, " records"));
                return [4 /*yield*/, collection.find({}).toArray()];
            case 6:
                allItems = _b.sent();
                console.log("- Total records in collection: ".concat(allItems.length));
                if (allItems.length > 0) {
                    console.log("- Sample record structure: ".concat(JSON.stringify(allItems[0])));
                }
                _b.label = 7;
            case 7:
                processedItems = items.map(function (item) {
                    var _a, _b, _c;
                    return (__assign(__assign({}, item), { _id: item._id.toString(), subscriptionId: ((_a = item.subscriptionId) === null || _a === void 0 ? void 0 : _a.toString) ? item.subscriptionId.toString() : item.subscriptionId, data: item.data ? __assign(__assign({}, item.data), { _id: ((_b = item.data._id) === null || _b === void 0 ? void 0 : _b.toString) ? item.data._id.toString() : item.data._id }) : undefined, updatedFields: item.updatedFields ? __assign(__assign({}, item.updatedFields), { _id: ((_c = item.updatedFields._id) === null || _c === void 0 ? void 0 : _c.toString) ? item.updatedFields._id.toString() : item.updatedFields._id }) : undefined }));
                });
                res.status(200).json(processedItems);
                return [3 /*break*/, 9];
            case 8:
                error_3 = _b.sent();
                console.error("History fetch error:", error_3);
                errorMessage = error_3 instanceof Error ? error_3.message : 'Unknown error occurred';
                res.status(500).json({ message: "Failed to fetch history records", error: errorMessage });
                return [3 /*break*/, 9];
            case 9: return [2 /*return*/];
        }
    });
}); });
router.get("/api/history/list", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var db, collection, tenantId, items, processed, error_4;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 3, , 4]);
                return [4 /*yield*/, connectToDatabase()];
            case 1:
                db = _b.sent();
                collection = db.collection("history");
                tenantId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId;
                if (!tenantId) {
                    return [2 /*return*/, res.status(401).json({ message: "Missing tenantId in user context" })];
                }
                return [4 /*yield*/, collection
                        .find({ tenantId: tenantId })
                        .sort({ timestamp: -1, _id: -1 })
                        .toArray()];
            case 2:
                items = _b.sent();
                processed = items.map(function (item, idx) {
                    var _a, _b, _c;
                    return (__assign(__assign({}, item), { _id: (_a = item._id) === null || _a === void 0 ? void 0 : _a.toString(), subscriptionId: (_b = item.subscriptionId) === null || _b === void 0 ? void 0 : _b.toString(), data: item.data ? __assign(__assign({}, item.data), { _id: (_c = item.data._id) === null || _c === void 0 ? void 0 : _c.toString() }) : undefined, updatedFields: item.updatedFields ? __assign({}, item.updatedFields) : undefined }));
                });
                res.status(200).json(processed);
                return [3 /*break*/, 4];
            case 3:
                error_4 = _b.sent();
                res.status(500).json({ message: "Failed to fetch history records", error: error_4 });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// Update a payment method
router.put("/api/payment/:id", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var db, collection, id, filter, update, result, error_5;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                return [4 /*yield*/, connectToDatabase()];
            case 1:
                db = _a.sent();
                collection = db.collection("payment");
                id = req.params.id;
                filter = void 0;
                try {
                    filter = { _id: new PaymentObjectId(id) };
                }
                catch (_b) {
                    return [2 /*return*/, res.status(400).json({ message: "Invalid payment id" })];
                }
                update = { $set: req.body };
                return [4 /*yield*/, collection.updateOne(filter, update)];
            case 2:
                result = _a.sent();
                if (result.matchedCount === 1) {
                    res.status(200).json({ message: "Payment method updated" });
                }
                else {
                    res.status(404).json({ message: "Payment method not found" });
                }
                return [3 /*break*/, 4];
            case 3:
                error_5 = _a.sent();
                res.status(500).json({ message: "Failed to update payment method", error: error_5 });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// Delete a payment method
router.delete("/api/payment/:id", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var db, collection, id, filter, result, error_6;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                return [4 /*yield*/, connectToDatabase()];
            case 1:
                db = _a.sent();
                collection = db.collection("payment");
                id = req.params.id;
                filter = void 0;
                try {
                    filter = { _id: new PaymentObjectId(id) };
                }
                catch (_b) {
                    return [2 /*return*/, res.status(400).json({ message: "Invalid payment id" })];
                }
                return [4 /*yield*/, collection.deleteOne(filter)];
            case 2:
                result = _a.sent();
                if (result.deletedCount === 1) {
                    res.status(200).json({ message: "Payment method deleted" });
                }
                else {
                    res.status(404).json({ message: "Payment method not found" });
                }
                return [3 /*break*/, 4];
            case 3:
                error_6 = _a.sent();
                res.status(500).json({ message: "Failed to delete payment method", error: error_6 });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// List all ledger records
router.get("/api/ledger/list", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var db, collection, tenantId, items, error_7;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 3, , 4]);
                return [4 /*yield*/, connectToDatabase()];
            case 1:
                db = _b.sent();
                collection = db.collection("ledger");
                tenantId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId;
                if (!tenantId) {
                    return [2 /*return*/, res.status(401).json({ message: "Missing tenantId in user context" })];
                }
                return [4 /*yield*/, collection.find({ tenantId: tenantId }).toArray()];
            case 2:
                items = _b.sent();
                res.status(200).json(items);
                return [3 /*break*/, 4];
            case 3:
                error_7 = _b.sent();
                res.status(500).json({ message: "Failed to fetch ledger data", error: error_7 });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// Insert a new ledger record
router.post("/api/ledger/insert", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var db, collection, tenantId, result, error_8;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 3, , 4]);
                return [4 /*yield*/, connectToDatabase()];
            case 1:
                db = _b.sent();
                console.log("Connected to DB:", db.databaseName); // Add this line
                collection = db.collection("ledger");
                tenantId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId;
                if (!tenantId) {
                    return [2 /*return*/, res.status(401).json({ message: "Missing tenantId in user context" })];
                }
                return [4 /*yield*/, collection.insertOne(__assign(__assign({}, req.body), { tenantId: tenantId }))];
            case 2:
                result = _b.sent();
                console.log("Insert result:", result); // Add this line
                res.status(201).json({ insertedId: result.insertedId });
                return [3 /*break*/, 4];
            case 3:
                error_8 = _b.sent();
                console.error("Ledger insert error:", error_8); // Add this line
                res.status(500).json({ message: "Failed to save ledger data", error: error_8 });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// Delete a ledger record
router.delete("/api/ledger/:id", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var db, collection, result, error_9;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                return [4 /*yield*/, connectToDatabase()];
            case 1:
                db = _a.sent();
                collection = db.collection("ledger");
                return [4 /*yield*/, collection.deleteOne({ _id: new LedgerObjectId(req.params.id) })];
            case 2:
                result = _a.sent();
                if (result.deletedCount === 1) {
                    res.status(200).json({ message: "Ledger record deleted" });
                }
                else {
                    res.status(404).json({ message: "Ledger record not found" });
                }
                return [3 /*break*/, 4];
            case 3:
                error_9 = _a.sent();
                res.status(500).json({ message: "Failed to delete ledger record", error: error_9 });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// List all compliance filings from the database
router.get("/api/compliance/list", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var db, collection, tenantId, items, error_10;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 3, , 4]);
                return [4 /*yield*/, connectToDatabase()];
            case 1:
                db = _b.sent();
                collection = db.collection("compliance");
                tenantId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId;
                if (!tenantId) {
                    return [2 /*return*/, res.status(401).json({ message: "Missing tenantId in user context" })];
                }
                return [4 /*yield*/, collection.find({ tenantId: tenantId }).toArray()];
            case 2:
                items = _b.sent();
                res.status(200).json(items);
                return [3 /*break*/, 4];
            case 3:
                error_10 = _b.sent();
                res.status(500).json({ message: "Failed to fetch compliance data", error: error_10 });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// Delete a compliance filing from the database
router.delete("/api/compliance/:id", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var db, collection, result, error_11;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                return [4 /*yield*/, connectToDatabase()];
            case 1:
                db = _a.sent();
                collection = db.collection("compliance");
                return [4 /*yield*/, collection.deleteOne({ _id: new ObjectId(req.params.id) })];
            case 2:
                result = _a.sent();
                if (result.deletedCount === 1) {
                    res.status(200).json({ message: "Compliance filing deleted" });
                }
                else {
                    res.status(404).json({ message: "Compliance filing not found" });
                }
                return [3 /*break*/, 4];
            case 3:
                error_11 = _a.sent();
                res.status(500).json({ message: "Failed to delete compliance filing", error: error_11 });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// Save a compliance filing to the database
router.post("/api/compliance/insert", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var db, collection, tenantId, result, error_12;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 3, , 4]);
                return [4 /*yield*/, connectToDatabase()];
            case 1:
                db = _b.sent();
                collection = db.collection("compliance");
                tenantId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId;
                if (!tenantId) {
                    return [2 /*return*/, res.status(401).json({ message: "Missing tenantId in user context" })];
                }
                return [4 /*yield*/, collection.insertOne(__assign(__assign({}, req.body), { tenantId: tenantId }))];
            case 2:
                result = _b.sent();
                res.status(201).json({ insertedId: result.insertedId });
                return [3 /*break*/, 4];
            case 3:
                error_12 = _b.sent();
                res.status(500).json({ message: "Failed to save compliance data", error: error_12 });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// Edit (update) a compliance filing in the database
router.put("/api/compliance/:id", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var db, collection, result, error_13;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                return [4 /*yield*/, connectToDatabase()];
            case 1:
                db = _a.sent();
                collection = db.collection("compliance");
                return [4 /*yield*/, collection.updateOne({ _id: new ObjectId(req.params.id) }, { $set: req.body })];
            case 2:
                result = _a.sent();
                if (result.matchedCount === 1) {
                    res.status(200).json({ message: "Compliance filing updated" });
                }
                else {
                    res.status(404).json({ message: "Compliance filing not found" });
                }
                return [3 /*break*/, 4];
            case 3:
                error_13 = _a.sent();
                res.status(500).json({ message: "Failed to update compliance filing", error: error_13 });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// Example: Save a subscription to the Subtrackerr database
// Get all subscriptions
router.get("/api/history/list", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var db, collection, tenantId, items, processed, error_14;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 3, , 4]);
                return [4 /*yield*/, connectToDatabase()];
            case 1:
                db = _b.sent();
                collection = db.collection("history");
                tenantId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId;
                if (!tenantId) {
                    return [2 /*return*/, res.status(401).json({ message: "Missing tenantId in user context" })];
                }
                return [4 /*yield*/, collection
                        .find({ tenantId: tenantId })
                        .sort({ timestamp: -1, _id: -1 })
                        .toArray()];
            case 2:
                items = _b.sent();
                processed = items.map(function (item, idx) {
                    var _a, _b, _c, _d;
                    return (__assign(__assign({}, item), { _id: (_a = item._id) === null || _a === void 0 ? void 0 : _a.toString(), subscriptionId: (_b = item.subscriptionId) === null || _b === void 0 ? void 0 : _b.toString(), data: item.data ? __assign(__assign({}, item.data), { _id: (_c = item.data._id) === null || _c === void 0 ? void 0 : _c.toString() }) : undefined, updatedFields: item.updatedFields ? __assign(__assign({}, item.updatedFields), { _id: (_d = item.updatedFields._id) === null || _d === void 0 ? void 0 : _d.toString() }) : undefined }));
                });
                res.status(200).json(processed);
                return [3 /*break*/, 4];
            case 3:
                error_14 = _b.sent();
                res.status(500).json({ message: "Failed to fetch history records", error: error_14 });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// --- Category API ---
// List all categories
router.get("/api/company/categories", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var db, collection, items, categories, error_15;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                return [4 /*yield*/, connectToDatabase()];
            case 1:
                db = _a.sent();
                collection = db.collection("categories");
                return [4 /*yield*/, collection.find({}).toArray()];
            case 2:
                items = _a.sent();
                categories = items
                    .filter(function (item) { return typeof item.name === "string" && item.name.trim(); })
                    .map(function (item) { return ({
                    name: item.name,
                    visible: typeof item.visible === "boolean" ? item.visible : true
                }); });
                res.status(200).json(categories);
                return [3 /*break*/, 4];
            case 3:
                error_15 = _a.sent();
                res.status(500).json({ message: "Failed to fetch categories", error: error_15 });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// Add a new category
router.post("/api/company/categories", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var db, collection, name_1, exists, result, error_16;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 4, , 5]);
                return [4 /*yield*/, connectToDatabase()];
            case 1:
                db = _a.sent();
                collection = db.collection("categories");
                name_1 = req.body.name;
                if (!name_1 || typeof name_1 !== "string" || !name_1.trim()) {
                    return [2 /*return*/, res.status(400).json({ message: "Category name required" })];
                }
                name_1 = name_1.trim();
                return [4 /*yield*/, collection.findOne({ name: name_1 })];
            case 2:
                exists = _a.sent();
                if (exists) {
                    return [2 /*return*/, res.status(409).json({ message: "Category already exists" })];
                }
                return [4 /*yield*/, collection.insertOne({ name: name_1, visible: true })];
            case 3:
                result = _a.sent();
                res.status(201).json({ insertedId: result.insertedId });
                return [3 /*break*/, 5];
            case 4:
                error_16 = _a.sent();
                res.status(500).json({ message: "Failed to add category", error: error_16 });
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); });
// Delete a category by name
router.delete("/api/company/categories/:name", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var db, collection, name_2, result, error_17;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                return [4 /*yield*/, connectToDatabase()];
            case 1:
                db = _a.sent();
                collection = db.collection("categories");
                name_2 = req.params.name;
                if (!name_2 || typeof name_2 !== "string" || !name_2.trim()) {
                    return [2 /*return*/, res.status(400).json({ message: "Category name required" })];
                }
                return [4 /*yield*/, collection.deleteOne({ name: { $regex: "^".concat(name_2.trim(), "$"), $options: "i" } })];
            case 2:
                result = _a.sent();
                if (result.deletedCount === 1) {
                    res.status(200).json({ message: "Category deleted" });
                }
                else {
                    res.status(404).json({ message: "Category not found" });
                }
                return [3 /*break*/, 4];
            case 3:
                error_17 = _a.sent();
                res.status(500).json({ message: "Failed to delete category", error: error_17 });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// --- Departments API ---
// List all departments
router.get("/api/company/departments", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var db, collection, items, departments, error_18;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                return [4 /*yield*/, connectToDatabase()];
            case 1:
                db = _a.sent();
                collection = db.collection("departments");
                return [4 /*yield*/, collection.find({}).toArray()];
            case 2:
                items = _a.sent();
                departments = items
                    .filter(function (item) { return typeof item.name === "string" && item.name.trim(); })
                    .map(function (item) { return ({
                    name: item.name,
                    visible: typeof item.visible === "boolean" ? item.visible : true
                }); });
                res.status(200).json(departments);
                return [3 /*break*/, 4];
            case 3:
                error_18 = _a.sent();
                res.status(500).json({ message: "Failed to fetch departments", error: error_18 });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// Add a new department
router.post("/api/company/departments", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var db, collection, name_3, exists, result, error_19;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 4, , 5]);
                return [4 /*yield*/, connectToDatabase()];
            case 1:
                db = _a.sent();
                collection = db.collection("departments");
                name_3 = req.body.name;
                if (!name_3 || typeof name_3 !== "string" || !name_3.trim()) {
                    return [2 /*return*/, res.status(400).json({ message: "Department name required" })];
                }
                name_3 = name_3.trim();
                return [4 /*yield*/, collection.findOne({ name: name_3 })];
            case 2:
                exists = _a.sent();
                if (exists) {
                    return [2 /*return*/, res.status(409).json({ message: "Department already exists" })];
                }
                return [4 /*yield*/, collection.insertOne({ name: name_3, visible: true })];
            case 3:
                result = _a.sent();
                res.status(201).json({ insertedId: result.insertedId });
                return [3 /*break*/, 5];
            case 4:
                error_19 = _a.sent();
                res.status(500).json({ message: "Failed to add department", error: error_19 });
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); });
// Update department visibility
router.patch("/api/company/departments/:name", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var db, collection, name_4, visible, result, error_20;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                return [4 /*yield*/, connectToDatabase()];
            case 1:
                db = _a.sent();
                collection = db.collection("departments");
                name_4 = req.params.name;
                visible = req.body.visible;
                if (!name_4 || typeof name_4 !== "string" || !name_4.trim()) {
                    return [2 /*return*/, res.status(400).json({ message: "Department name required" })];
                }
                return [4 /*yield*/, collection.updateOne({ name: name_4 }, { $set: { visible: visible } })];
            case 2:
                result = _a.sent();
                if (result.matchedCount === 0) {
                    return [2 /*return*/, res.status(404).json({ message: "Department not found" })];
                }
                res.status(200).json({ name: name_4, visible: visible });
                return [3 /*break*/, 4];
            case 3:
                error_20 = _a.sent();
                res.status(500).json({ message: "Failed to update department", error: error_20 });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// Delete a department by name
router.delete("/api/company/departments/:name", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var db, collection, name_5, result, error_21;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                return [4 /*yield*/, connectToDatabase()];
            case 1:
                db = _a.sent();
                collection = db.collection("departments");
                name_5 = req.params.name;
                if (!name_5 || typeof name_5 !== "string" || !name_5.trim()) {
                    return [2 /*return*/, res.status(400).json({ message: "Department name required" })];
                }
                return [4 /*yield*/, collection.deleteOne({ name: { $regex: "^".concat(name_5.trim(), "$"), $options: "i" } })];
            case 2:
                result = _a.sent();
                if (result.deletedCount === 1) {
                    res.status(200).json({ message: "Department deleted" });
                }
                else {
                    res.status(404).json({ message: "Department not found" });
                }
                return [3 /*break*/, 4];
            case 3:
                error_21 = _a.sent();
                res.status(500).json({ message: "Failed to delete department", error: error_21 });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// --- Subscriptions API ---
// Create a new subscription (with history log)
router.post("/api/subscriptions", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var db, collection, historyCollection, tenantId, subscription, result, subscriptionId, createdSubscription, historyRecord, error_22, errorMessage;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 5, , 6]);
                return [4 /*yield*/, connectToDatabase()];
            case 1:
                db = _b.sent();
                collection = db.collection("subscriptions");
                historyCollection = db.collection("history");
                tenantId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId;
                if (!tenantId) {
                    return [2 /*return*/, res.status(401).json({ message: "Missing tenantId in user context" })];
                }
                subscription = __assign(__assign({}, req.body), { tenantId: tenantId, createdAt: new Date(), updatedAt: new Date() });
                return [4 /*yield*/, collection.insertOne(subscription)];
            case 2:
                result = _b.sent();
                subscriptionId = result.insertedId;
                return [4 /*yield*/, collection.findOne({ _id: subscriptionId })];
            case 3:
                createdSubscription = _b.sent();
                historyRecord = {
                    subscriptionId: subscriptionId, // Store as ObjectId
                    data: __assign(__assign({}, createdSubscription), { _id: subscriptionId }),
                    action: "create",
                    timestamp: new Date(),
                    serviceName: subscription.serviceName // Add serviceName for easier querying
                };
                return [4 /*yield*/, historyCollection.insertOne(historyRecord)];
            case 4:
                _b.sent();
                res.status(201).json({
                    message: "Subscription created",
                    subscription: createdSubscription
                });
                return [3 /*break*/, 6];
            case 5:
                error_22 = _b.sent();
                console.error("Creation error:", error_22);
                errorMessage = error_22 instanceof Error ? error_22.message : 'Unknown error occurred';
                res.status(500).json({ message: "Failed to create subscription", error: errorMessage });
                return [3 /*break*/, 6];
            case 6: return [2 /*return*/];
        }
    });
}); });
// Note: Duplicate route was removed here. The route is defined earlier in the file.
// Update an existing subscription
router.put("/api/subscriptions/:id", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var db, collection, historyCollection, id, tenantId, subscriptionId, oldDoc, update, result, updatedDoc, historyRecord, error_23, errorMessage;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 8, , 9]);
                return [4 /*yield*/, connectToDatabase()];
            case 1:
                db = _b.sent();
                collection = db.collection("subscriptions");
                historyCollection = db.collection("history");
                id = req.params.id;
                tenantId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId;
                if (!tenantId) {
                    return [2 /*return*/, res.status(401).json({ message: "Missing tenantId in user context" })];
                }
                subscriptionId = void 0;
                try {
                    subscriptionId = new ObjectId(id);
                }
                catch (_c) {
                    return [2 /*return*/, res.status(400).json({ message: "Invalid subscription ID format" })];
                }
                return [4 /*yield*/, collection.findOne({ _id: subscriptionId, tenantId: tenantId })];
            case 2:
                oldDoc = _b.sent();
                if (!oldDoc) {
                    return [2 /*return*/, res.status(404).json({ message: "Subscription not found or access denied" })];
                }
                update = {
                    $set: __assign(__assign({}, req.body), { tenantId: tenantId, status: req.body.status || oldDoc.status, updatedAt: new Date() // Add updatedAt timestamp
                     })
                };
                return [4 /*yield*/, collection.updateOne({ _id: subscriptionId, tenantId: tenantId }, update)];
            case 3:
                result = _b.sent();
                if (!(result.matchedCount === 1)) return [3 /*break*/, 6];
                return [4 /*yield*/, collection.findOne({ _id: subscriptionId, tenantId: tenantId })];
            case 4:
                updatedDoc = _b.sent();
                historyRecord = {
                    subscriptionId: subscriptionId, // Store as ObjectId
                    data: __assign(__assign({}, oldDoc), { _id: subscriptionId }),
                    updatedFields: __assign(__assign({}, updatedDoc), { _id: subscriptionId }),
                    action: "update",
                    timestamp: new Date(),
                    serviceName: updatedDoc === null || updatedDoc === void 0 ? void 0 : updatedDoc.serviceName // Add serviceName for easier querying
                };
                return [4 /*yield*/, historyCollection.insertOne(historyRecord)];
            case 5:
                _b.sent();
                res.status(200).json({
                    message: "Subscription updated",
                    subscription: updatedDoc
                });
                return [3 /*break*/, 7];
            case 6:
                res.status(404).json({ message: "Subscription not found or access denied" });
                _b.label = 7;
            case 7: return [3 /*break*/, 9];
            case 8:
                error_23 = _b.sent();
                console.error("Update error:", error_23);
                errorMessage = error_23 instanceof Error ? error_23.message : 'Unknown error occurred';
                res.status(500).json({ message: "Failed to update subscription", error: errorMessage });
                return [3 /*break*/, 9];
            case 9: return [2 /*return*/];
        }
    });
}); });
// List all employees
router.get("/api/employees", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var db, collection, tenantId, items, error_24;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 3, , 4]);
                return [4 /*yield*/, connectToDatabase()];
            case 1:
                db = _b.sent();
                collection = db.collection("employees");
                tenantId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId;
                if (!tenantId) {
                    return [2 /*return*/, res.status(401).json({ message: "Missing tenantId in user context" })];
                }
                return [4 /*yield*/, collection.find({ tenantId: tenantId }).toArray()];
            case 2:
                items = _b.sent();
                res.status(200).json(items);
                return [3 /*break*/, 4];
            case 3:
                error_24 = _b.sent();
                res.status(500).json({ message: "Failed to fetch employees", error: error_24 });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// Add a new employee
router.post("/api/employees", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var db, collection, tenantId, employee, result, error_25;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 3, , 4]);
                return [4 /*yield*/, connectToDatabase()];
            case 1:
                db = _b.sent();
                collection = db.collection("employees");
                tenantId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId;
                if (!tenantId) {
                    return [2 /*return*/, res.status(401).json({ message: "Missing tenantId in user context" })];
                }
                employee = __assign(__assign({}, req.body), { tenantId: tenantId });
                return [4 /*yield*/, collection.insertOne(employee)];
            case 2:
                result = _b.sent();
                res.status(201).json({ insertedId: result.insertedId });
                return [3 /*break*/, 4];
            case 3:
                error_25 = _b.sent();
                res.status(500).json({ message: "Failed to add employee", error: error_25 });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// Update an employee
router.put("/api/employees/:id", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var db, collection, id, filter, update, result, error_26;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                return [4 /*yield*/, connectToDatabase()];
            case 1:
                db = _a.sent();
                collection = db.collection("employees");
                id = req.params.id;
                filter = void 0;
                try {
                    filter = { _id: new EmployeeObjectId(id) };
                }
                catch (_b) {
                    return [2 /*return*/, res.status(400).json({ message: "Invalid employee id" })];
                }
                update = { $set: req.body };
                return [4 /*yield*/, collection.updateOne(filter, update)];
            case 2:
                result = _a.sent();
                if (result.matchedCount === 1) {
                    res.status(200).json({ message: "Employee updated" });
                }
                else {
                    res.status(404).json({ message: "Employee not found" });
                }
                return [3 /*break*/, 4];
            case 3:
                error_26 = _a.sent();
                res.status(500).json({ message: "Failed to update employee", error: error_26 });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// Delete an employee
router.delete("/api/employees/:id", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var db, collection, id, filter, result, error_27;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                return [4 /*yield*/, connectToDatabase()];
            case 1:
                db = _a.sent();
                collection = db.collection("employees");
                id = req.params.id;
                filter = void 0;
                try {
                    filter = { _id: new EmployeeObjectId(id) };
                }
                catch (_b) {
                    return [2 /*return*/, res.status(400).json({ message: "Invalid employee id" })];
                }
                return [4 /*yield*/, collection.deleteOne(filter)];
            case 2:
                result = _a.sent();
                if (result.deletedCount === 1) {
                    res.status(200).json({ message: "Employee deleted" });
                }
                else {
                    res.status(404).json({ message: "Employee not found" });
                }
                return [3 /*break*/, 4];
            case 3:
                error_27 = _a.sent();
                res.status(500).json({ message: "Failed to delete employee", error: error_27 });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// --- Users API ---
// Add a new user
router.post("/api/users", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var db, collection, tenantId, user, result, error_28;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 3, , 4]);
                return [4 /*yield*/, connectToDatabase()];
            case 1:
                db = _b.sent();
                collection = db.collection("users");
                tenantId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId;
                if (!tenantId) {
                    return [2 /*return*/, res.status(401).json({ message: "Missing tenantId in user context" })];
                }
                user = __assign(__assign({}, req.body), { tenantId: tenantId });
                return [4 /*yield*/, collection.insertOne(user)];
            case 2:
                result = _b.sent();
                res.status(201).json({ insertedId: result.insertedId });
                return [3 /*break*/, 4];
            case 3:
                error_28 = _b.sent();
                res.status(500).json({ message: "Failed to add user", error: error_28 });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// Update a user
router.put("/api/users/:_id", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var db, collection, _id, user, filter, update, result, error_29;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                return [4 /*yield*/, connectToDatabase()];
            case 1:
                db = _a.sent();
                collection = db.collection("users");
                _id = req.params._id;
                user = req.body;
                filter = void 0;
                try {
                    filter = { _id: new EmployeeObjectId(_id) };
                }
                catch (_b) {
                    return [2 /*return*/, res.status(400).json({ message: "Invalid user _id" })];
                }
                update = { $set: user };
                return [4 /*yield*/, collection.updateOne(filter, update)];
            case 2:
                result = _a.sent();
                if (result.matchedCount === 1) {
                    res.status(200).json({ message: "User updated" });
                }
                else {
                    res.status(404).json({ message: "User not found" });
                }
                return [3 /*break*/, 4];
            case 3:
                error_29 = _a.sent();
                res.status(500).json({ message: "Failed to update user", error: error_29 });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// --- Subscription Fields Configuration API ---
// Save enabled fields
router.post("/api/config/fields", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var db, collection, fields, error_30;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                return [4 /*yield*/, connectToDatabase()];
            case 1:
                db = _a.sent();
                collection = db.collection("config");
                fields = req.body.fields;
                if (!Array.isArray(fields)) {
                    return [2 /*return*/, res.status(400).json({ message: "Fields must be an array" })];
                }
                // Upsert a single config document for fields
                return [4 /*yield*/, collection.updateOne({ key: "subscriptionFields" }, { $set: { key: "subscriptionFields", fields: fields } }, { upsert: true })];
            case 2:
                // Upsert a single config document for fields
                _a.sent();
                res.status(200).json({ message: "Fields saved" });
                return [3 /*break*/, 4];
            case 3:
                error_30 = _a.sent();
                res.status(500).json({ message: "Failed to save fields", error: error_30 });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// Get enabled fields
router.get("/api/config/fields", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var db, collection, doc, error_31;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                return [4 /*yield*/, connectToDatabase()];
            case 1:
                db = _a.sent();
                collection = db.collection("config");
                return [4 /*yield*/, collection.findOne({ key: "subscriptionFields" })];
            case 2:
                doc = _a.sent();
                res.status(200).json((doc === null || doc === void 0 ? void 0 : doc.fields) || []);
                return [3 /*break*/, 4];
            case 3:
                error_31 = _a.sent();
                res.status(500).json({ message: "Failed to fetch fields", error: error_31 });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// --- Compliance Fields Configuration API ---
// Save compliance field
router.post("/api/config/compliance-fields", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var db, collection, name_6, existingField, newField, result, error_32;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 4, , 5]);
                return [4 /*yield*/, connectToDatabase()];
            case 1:
                db = _a.sent();
                collection = db.collection("Fields");
                name_6 = req.body.name;
                // Validate field name
                if (!name_6 || typeof name_6 !== "string" || !name_6.trim()) {
                    return [2 /*return*/, res.status(400).json({ message: "Field name is required" })];
                }
                return [4 /*yield*/, collection.findOne({
                        name: name_6.trim(),
                        fieldType: "compliance" // Changed type to fieldType
                    })];
            case 2:
                existingField = _a.sent();
                if (existingField) {
                    return [2 /*return*/, res.status(409).json({ message: "Field already exists" })];
                }
                newField = {
                    name: name_6.trim(),
                    enabled: true,
                    fieldType: "compliance", // Changed type to fieldType
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    displayOrder: 0, // Added display order for UI sorting
                    required: false, // Added required flag
                    description: "", // Added description field
                    validation: {} // Added validation rules object
                };
                return [4 /*yield*/, collection.insertOne(newField)];
            case 3:
                result = _a.sent();
                res.status(201).json(__assign({ insertedId: result.insertedId }, newField));
                return [3 /*break*/, 5];
            case 4:
                error_32 = _a.sent();
                res.status(500).json({ message: "Failed to save compliance field", error: error_32 });
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); });
// Get compliance fields
router.get("/api/config/compliance-fields", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var db, collection, fields, error_33;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                return [4 /*yield*/, connectToDatabase()];
            case 1:
                db = _a.sent();
                collection = db.collection("Fields");
                return [4 /*yield*/, collection.find({ fieldType: "compliance" }).sort({ displayOrder: 1 }).toArray()];
            case 2:
                fields = _a.sent();
                res.status(200).json(fields.map(function (field) { return ({
                    _id: field._id,
                    name: field.name,
                    enabled: field.enabled,
                    displayOrder: field.displayOrder,
                    required: field.required,
                    description: field.description,
                    validation: field.validation
                }); }));
                return [3 /*break*/, 4];
            case 3:
                error_33 = _a.sent();
                res.status(500).json({ message: "Failed to fetch compliance fields", error: error_33 });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// Update compliance field
router.patch("/api/config/compliance-fields/:id", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var db, collection, id, updates, result, error_34;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                return [4 /*yield*/, connectToDatabase()];
            case 1:
                db = _a.sent();
                collection = db.collection("Fields");
                id = req.params.id;
                updates = req.body;
                // Remove fields that shouldn't be updated
                delete updates._id;
                delete updates.fieldType;
                delete updates.createdAt;
                return [4 /*yield*/, collection.updateOne({ _id: new ObjectId(id), fieldType: "compliance" }, {
                        $set: __assign(__assign({}, updates), { updatedAt: new Date() })
                    })];
            case 2:
                result = _a.sent();
                if (result.matchedCount === 0) {
                    return [2 /*return*/, res.status(404).json({ message: "Field not found" })];
                }
                res.status(200).json({ message: "Field updated successfully" });
                return [3 /*break*/, 4];
            case 3:
                error_34 = _a.sent();
                res.status(500).json({ message: "Failed to update compliance field", error: error_34 });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// Delete compliance field
router.delete("/api/config/compliance-fields/:id", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var db, collection, id, result, error_35;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                return [4 /*yield*/, connectToDatabase()];
            case 1:
                db = _a.sent();
                collection = db.collection("Fields");
                id = req.params.id;
                return [4 /*yield*/, collection.deleteOne({
                        _id: new ObjectId(id),
                        fieldType: "compliance"
                    })];
            case 2:
                result = _a.sent();
                if (result.deletedCount === 0) {
                    return [2 /*return*/, res.status(404).json({ message: "Field not found" })];
                }
                res.status(200).json({ message: "Field deleted successfully" });
                return [3 /*break*/, 4];
            case 3:
                error_35 = _a.sent();
                res.status(500).json({ message: "Failed to delete compliance field", error: error_35 });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
export default router;
