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
import { createServer } from "http";
import { storage } from "./storage.js";
import { ObjectId } from "mongodb";
import { insertUserSchema, insertSubscriptionSchema, insertReminderSchema } from "../../shared/schema";
import { z } from "zod";
import subtrackerrRouter from "./subtrackerr.routes";
import analyticsRouter from "./analytics.routes";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import cors from "cors";
import { connectToDatabase } from "./mongo";
export function registerRoutes(app) {
    return __awaiter(this, void 0, void 0, function () {
        var httpServer;
        var _this = this;
        return __generator(this, function (_a) {
            // Logout route - clears JWT cookie
            app.post("/api/logout", function (req, res) {
                res.cookie("token", "", {
                    httpOnly: false,
                    secure: false,
                    sameSite: "lax",
                    path: "/",
                    expires: new Date(0) // Expire immediately
                });
                res.status(200).json({ message: "Logout successful" });
            });
            app.use(cookieParser());
            // JWT middleware to set req.user and req.user.tenantId (same as subtrackerr.routes.ts)
            app.use(function (req, res, next) {
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
                        var decoded = jwt.verify(token, process.env.JWT_SECRET || "subs_secret_key");
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
            // Allow credentials in CORS for frontend cookie access
            app.use(cors({
                origin: "http://localhost:5173", // Fixed: Frontend URL
                credentials: true
            }));
            // Signup route - saves to signup collection
            app.post("/api/signup", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var _a, fullName, email, password, tenantId, db, existingUser, doc, loginResult, allUsers, err_1;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 6, , 7]);
                            _a = req.body, fullName = _a.fullName, email = _a.email, password = _a.password, tenantId = _a.tenantId;
                            console.log('Signup request received:', { fullName: fullName, email: email, tenantId: tenantId }); // Debug log
                            if (!fullName || !email || !password || !tenantId) {
                                return [2 /*return*/, res.status(400).json({ message: "Missing required fields (fullName, email, password, tenantId)" })];
                            }
                            return [4 /*yield*/, connectToDatabase()];
                        case 1:
                            db = _b.sent();
                            console.log('Connected to database:', db.databaseName); // Debug log
                            return [4 /*yield*/, db.collection("login").findOne({ email: email })];
                        case 2:
                            existingUser = _b.sent();
                            console.log('Existing user check:', existingUser ? 'User exists' : 'User does not exist'); // Debug log
                            if (existingUser) {
                                return [2 /*return*/, res.status(400).json({ message: "User already exists with this email" })];
                            }
                            doc = { fullName: fullName, email: email, password: password, tenantId: tenantId, createdAt: new Date() };
                            console.log('Creating user document:', { fullName: fullName, email: email, tenantId: tenantId }); // Debug log (no password)
                            return [4 /*yield*/, db.collection("signup").insertOne(doc)];
                        case 3:
                            _b.sent();
                            return [4 /*yield*/, db.collection("login").insertOne(doc)];
                        case 4:
                            loginResult = _b.sent();
                            console.log('User created with ID:', loginResult.insertedId); // Debug log
                            return [4 /*yield*/, db.collection("login").find({}).toArray()];
                        case 5:
                            allUsers = _b.sent();
                            console.log('All users in login collection after signup:', allUsers.map(function (u) { return ({ email: u.email, password: u.password, tenantId: u.tenantId }); }));
                            res.status(201).json({ message: "Signup successful" });
                            return [3 /*break*/, 7];
                        case 6:
                            err_1 = _b.sent();
                            console.error('Signup error:', err_1);
                            res.status(500).json({ message: "Failed to save signup" });
                            return [3 /*break*/, 7];
                        case 7: return [2 /*return*/];
                    }
                });
            }); });
            // Login route - authenticates user and sets JWT cookie
            app.post("/api/login", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var _a, email, password, db, allUsers, user, userByEmail, tokenPayload, token, err_2;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 6, , 7]);
                            _a = req.body, email = _a.email, password = _a.password;
                            console.log('Login attempt for email:', email); // Debug log
                            if (!email || !password) {
                                return [2 /*return*/, res.status(400).json({ message: "Missing required fields" })];
                            }
                            return [4 /*yield*/, connectToDatabase()];
                        case 1:
                            db = _b.sent();
                            console.log('Connected to database:', db.databaseName); // Debug log
                            return [4 /*yield*/, db.collection("login").find({}).toArray()];
                        case 2:
                            allUsers = _b.sent();
                            console.log('All users in login collection before login:', allUsers.map(function (u) { return ({ email: u.email, password: u.password, tenantId: u.tenantId }); }));
                            return [4 /*yield*/, db.collection("login").findOne({ email: email, password: password })];
                        case 3:
                            user = _b.sent();
                            console.log('User found with credentials:', user ? 'Yes' : 'No'); // Debug log
                            if (!!user) return [3 /*break*/, 5];
                            return [4 /*yield*/, db.collection("login").findOne({ email: email })];
                        case 4:
                            userByEmail = _b.sent();
                            console.log('User exists with this email:', userByEmail ? 'Yes' : 'No'); // Debug log
                            return [2 /*return*/, res.status(401).json({ message: "Invalid email or password" })];
                        case 5:
                            tokenPayload = { userId: user._id, email: user.email };
                            if (user.tenantId) {
                                tokenPayload.tenantId = user.tenantId;
                            }
                            token = jwt.sign(tokenPayload, process.env.JWT_SECRET || "subs_secret_key", { expiresIn: "7d" });
                            res.cookie("token", token, {
                                httpOnly: false,
                                secure: false,
                                sameSite: "lax",
                                path: "/",
                                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
                            });
                            console.log('Login successful for user:', user._id); // Debug log
                            res.status(200).json({ message: "Login successful" });
                            return [3 /*break*/, 7];
                        case 6:
                            err_2 = _b.sent();
                            console.error('Login error:', err_2);
                            res.status(500).json({ message: "Login failed" });
                            return [3 /*break*/, 7];
                        case 7: return [2 /*return*/];
                    }
                });
            }); });
            // Delete a notification/reminder by id
            app.delete("/api/notifications/:id", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var id, deleted, err_3;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            id = req.params.id;
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, storage.deleteReminder(id)];
                        case 2:
                            deleted = _a.sent();
                            if (deleted) {
                                res.status(200).json({ success: true });
                            }
                            else {
                                res.status(404).json({ success: false, message: "Notification not found" });
                            }
                            return [3 /*break*/, 4];
                        case 3:
                            err_3 = _a.sent();
                            res.status(500).json({ success: false, message: "Error deleting notification" });
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            // Register MongoDB Subtrackerr routes
            app.use(subtrackerrRouter);
            // Register analytics routes
            app.use(analyticsRouter);
            // Users routes
            app.get("/api/users", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var tenantId, users, error_1;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            tenantId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId;
                            if (!tenantId)
                                return [2 /*return*/, res.status(401).json({ message: "Missing tenantId" })];
                            _b.label = 1;
                        case 1:
                            _b.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, storage.getUsers(tenantId)];
                        case 2:
                            users = _b.sent();
                            res.json(users);
                            return [3 /*break*/, 4];
                        case 3:
                            error_1 = _b.sent();
                            res.status(500).json({ message: "Failed to fetch users" });
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            app.get("/api/users/:id", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var tenantId, id, user, error_2;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            tenantId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId;
                            if (!tenantId)
                                return [2 /*return*/, res.status(401).json({ message: "Missing tenantId" })];
                            _b.label = 1;
                        case 1:
                            _b.trys.push([1, 3, , 4]);
                            id = req.params.id;
                            return [4 /*yield*/, storage.getUser(id, tenantId)];
                        case 2:
                            user = _b.sent();
                            if (!user) {
                                return [2 /*return*/, res.status(404).json({ message: "User not found" })];
                            }
                            res.json(user);
                            return [3 /*break*/, 4];
                        case 3:
                            error_2 = _b.sent();
                            res.status(500).json({ message: "Failed to fetch user" });
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            app.post("/api/users", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var tenantId, userData, user, error_3;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            tenantId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId;
                            if (!tenantId)
                                return [2 /*return*/, res.status(401).json({ message: "Missing tenantId" })];
                            _b.label = 1;
                        case 1:
                            _b.trys.push([1, 3, , 4]);
                            userData = insertUserSchema.parse(req.body);
                            return [4 /*yield*/, storage.createUser(userData, tenantId)];
                        case 2:
                            user = _b.sent();
                            res.status(201).json(user);
                            return [3 /*break*/, 4];
                        case 3:
                            error_3 = _b.sent();
                            if (error_3 instanceof z.ZodError) {
                                return [2 /*return*/, res.status(400).json({ message: "Invalid user data", errors: error_3.issues })];
                            }
                            res.status(500).json({ message: "Failed to create user" });
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            app.put("/api/users/:id", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var tenantId, id, userData, user, error_4;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            tenantId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId;
                            if (!tenantId)
                                return [2 /*return*/, res.status(401).json({ message: "Missing tenantId" })];
                            _b.label = 1;
                        case 1:
                            _b.trys.push([1, 3, , 4]);
                            id = req.params.id;
                            userData = insertUserSchema.partial().parse(req.body);
                            return [4 /*yield*/, storage.updateUser(id, userData, tenantId)];
                        case 2:
                            user = _b.sent();
                            if (!user) {
                                return [2 /*return*/, res.status(404).json({ message: "User not found" })];
                            }
                            res.json(user);
                            return [3 /*break*/, 4];
                        case 3:
                            error_4 = _b.sent();
                            if (error_4 instanceof z.ZodError) {
                                return [2 /*return*/, res.status(400).json({ message: "Invalid user data", errors: error_4.issues })];
                            }
                            res.status(500).json({ message: "Failed to update user" });
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            app.delete("/api/users/:id", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var tenantId, id, deleted, error_5;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            tenantId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId;
                            if (!tenantId)
                                return [2 /*return*/, res.status(401).json({ message: "Missing tenantId" })];
                            _b.label = 1;
                        case 1:
                            _b.trys.push([1, 3, , 4]);
                            id = req.params.id;
                            return [4 /*yield*/, storage.deleteUser(id, tenantId)];
                        case 2:
                            deleted = _b.sent();
                            if (!deleted) {
                                return [2 /*return*/, res.status(404).json({ message: "User not found" })];
                            }
                            res.status(204).send();
                            return [3 /*break*/, 4];
                        case 3:
                            error_5 = _b.sent();
                            res.status(500).json({ message: "Failed to delete user" });
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            // Subscriptions routes
            app.get("/api/subscriptions", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var tenantId, subscriptions, error_6;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            tenantId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId;
                            if (!tenantId)
                                return [2 /*return*/, res.status(401).json({ message: "Missing tenantId" })];
                            _b.label = 1;
                        case 1:
                            _b.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, storage.getSubscriptions(tenantId)];
                        case 2:
                            subscriptions = _b.sent();
                            res.json(subscriptions);
                            return [3 /*break*/, 4];
                        case 3:
                            error_6 = _b.sent();
                            res.status(500).json({ message: "Failed to fetch subscriptions" });
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            app.get("/api/subscriptions/:id", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var tenantId, id, subscription, error_7;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            tenantId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId;
                            if (!tenantId)
                                return [2 /*return*/, res.status(401).json({ message: "Missing tenantId" })];
                            _b.label = 1;
                        case 1:
                            _b.trys.push([1, 3, , 4]);
                            id = req.params.id;
                            return [4 /*yield*/, storage.getSubscription(id, tenantId)];
                        case 2:
                            subscription = _b.sent();
                            if (!subscription) {
                                return [2 /*return*/, res.status(404).json({ message: "Subscription not found" })];
                            }
                            res.json(subscription);
                            return [3 /*break*/, 4];
                        case 3:
                            error_7 = _b.sent();
                            res.status(500).json({ message: "Failed to fetch subscription" });
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            app.post("/api/subscriptions", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var tenantId, subscriptionData, subscription, error_8;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            tenantId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId;
                            if (!tenantId)
                                return [2 /*return*/, res.status(401).json({ message: "Missing tenantId" })];
                            _b.label = 1;
                        case 1:
                            _b.trys.push([1, 3, , 4]);
                            subscriptionData = insertSubscriptionSchema.parse(req.body);
                            // Ensure amount is a number
                            if (typeof subscriptionData.amount !== "number") {
                                subscriptionData.amount = parseFloat(subscriptionData.amount);
                            }
                            return [4 /*yield*/, storage.createSubscription(subscriptionData, tenantId)];
                        case 2:
                            subscription = _b.sent();
                            res.status(201).json(subscription);
                            return [3 /*break*/, 4];
                        case 3:
                            error_8 = _b.sent();
                            if (error_8 instanceof z.ZodError) {
                                return [2 /*return*/, res.status(400).json({ message: "Invalid subscription data", errors: error_8.issues })];
                            }
                            res.status(500).json({ message: "Failed to create subscription" });
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            app.put("/api/subscriptions/:id", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var tenantId, id, subscriptionData, subscription, error_9;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            tenantId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId;
                            if (!tenantId)
                                return [2 /*return*/, res.status(401).json({ message: "Missing tenantId" })];
                            _b.label = 1;
                        case 1:
                            _b.trys.push([1, 3, , 4]);
                            id = req.params.id;
                            subscriptionData = insertSubscriptionSchema.partial().parse(req.body);
                            // Ensure amount is a number
                            if (typeof subscriptionData.amount !== "number") {
                                subscriptionData.amount = parseFloat(subscriptionData.amount);
                            }
                            return [4 /*yield*/, storage.updateSubscription(id, subscriptionData, tenantId)];
                        case 2:
                            subscription = _b.sent();
                            if (!subscription) {
                                return [2 /*return*/, res.status(404).json({ message: "Subscription not found" })];
                            }
                            res.json(subscription);
                            return [3 /*break*/, 4];
                        case 3:
                            error_9 = _b.sent();
                            if (error_9 instanceof z.ZodError) {
                                return [2 /*return*/, res.status(400).json({ message: "Invalid subscription data", errors: error_9.issues })];
                            }
                            res.status(500).json({ message: "Failed to update subscription" });
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            app.delete("/api/subscriptions/:id", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var tenantId, id, deleted, db, objectId, error_10;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            tenantId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId;
                            if (!tenantId)
                                return [2 /*return*/, res.status(401).json({ message: "Missing tenantId" })];
                            _b.label = 1;
                        case 1:
                            _b.trys.push([1, 6, , 7]);
                            id = req.params.id;
                            return [4 /*yield*/, storage.deleteSubscription(id, tenantId)];
                        case 2:
                            deleted = _b.sent();
                            if (!deleted) {
                                return [2 /*return*/, res.status(404).json({ message: "Subscription not found" })];
                            }
                            return [4 /*yield*/, storage["getDb"]()];
                        case 3:
                            db = _b.sent();
                            objectId = void 0;
                            try {
                                objectId = new ObjectId(id);
                            }
                            catch (_c) {
                                objectId = id;
                            }
                            return [4 /*yield*/, db.collection("reminders").deleteMany({ subscriptionId: objectId })];
                        case 4:
                            _b.sent();
                            return [4 /*yield*/, db.collection("notifications").deleteMany({ subscriptionId: objectId })];
                        case 5:
                            _b.sent();
                            res.json({ message: "Subscription and related reminders/notifications deleted successfully" });
                            return [3 /*break*/, 7];
                        case 6:
                            error_10 = _b.sent();
                            res.status(500).json({ message: "Failed to delete subscription" });
                            return [3 /*break*/, 7];
                        case 7: return [2 /*return*/];
                    }
                });
            }); });
            // Analytics routes
            app.get("/api/analytics/dashboard", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var tenantId, metrics, error_11;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            tenantId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId;
                            if (!tenantId)
                                return [2 /*return*/, res.status(401).json({ message: "Missing tenantId" })];
                            _b.label = 1;
                        case 1:
                            _b.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, storage.getDashboardMetrics(tenantId)];
                        case 2:
                            metrics = _b.sent();
                            res.json(metrics);
                            return [3 /*break*/, 4];
                        case 3:
                            error_11 = _b.sent();
                            res.status(500).json({ message: "Failed to fetch dashboard metrics" });
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            app.get("/api/analytics/trends", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var tenantId, trends, error_12;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            tenantId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId;
                            if (!tenantId)
                                return [2 /*return*/, res.status(401).json({ message: "Missing tenantId" })];
                            _b.label = 1;
                        case 1:
                            _b.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, storage.getSpendingTrends(tenantId)];
                        case 2:
                            trends = _b.sent();
                            res.json(trends);
                            return [3 /*break*/, 4];
                        case 3:
                            error_12 = _b.sent();
                            res.status(500).json({ message: "Failed to fetch spending trends" });
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            app.get("/api/analytics/categories", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var tenantId, categories, error_13;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            tenantId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId;
                            if (!tenantId)
                                return [2 /*return*/, res.status(401).json({ message: "Missing tenantId" })];
                            _b.label = 1;
                        case 1:
                            _b.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, storage.getCategoryBreakdown(tenantId)];
                        case 2:
                            categories = _b.sent();
                            res.json(categories);
                            return [3 /*break*/, 4];
                        case 3:
                            error_13 = _b.sent();
                            res.status(500).json({ message: "Failed to fetch category breakdown" });
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            app.get("/api/analytics/activity", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var tenantId, activity, error_14;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            tenantId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId;
                            if (!tenantId)
                                return [2 /*return*/, res.status(401).json({ message: "Missing tenantId" })];
                            _b.label = 1;
                        case 1:
                            _b.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, storage.getRecentActivity(tenantId)];
                        case 2:
                            activity = _b.sent();
                            res.json(activity);
                            return [3 /*break*/, 4];
                        case 3:
                            error_14 = _b.sent();
                            res.status(500).json({ message: "Failed to fetch recent activity" });
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            // Reminders routes
            app.get("/api/reminders", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var tenantId, reminders, error_15;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            tenantId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId;
                            if (!tenantId)
                                return [2 /*return*/, res.status(401).json({ message: "Missing tenantId" })];
                            _b.label = 1;
                        case 1:
                            _b.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, storage.getReminders(tenantId)];
                        case 2:
                            reminders = _b.sent();
                            res.json(reminders);
                            return [3 /*break*/, 4];
                        case 3:
                            error_15 = _b.sent();
                            res.status(500).json({ message: "Failed to fetch reminders" });
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            app.post("/api/reminders", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var tenantId, reminderData, reminder, error_16;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            tenantId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId;
                            if (!tenantId)
                                return [2 /*return*/, res.status(401).json({ message: "Missing tenantId" })];
                            _b.label = 1;
                        case 1:
                            _b.trys.push([1, 3, , 4]);
                            reminderData = insertReminderSchema.parse(req.body);
                            return [4 /*yield*/, storage.createReminder(reminderData, tenantId)];
                        case 2:
                            reminder = _b.sent();
                            res.status(201).json(reminder);
                            return [3 /*break*/, 4];
                        case 3:
                            error_16 = _b.sent();
                            if (error_16 instanceof z.ZodError) {
                                return [2 /*return*/, res.status(400).json({ message: "Invalid reminder data", errors: error_16.issues })];
                            }
                            res.status(500).json({ message: "Failed to create reminder" });
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            app.put("/api/reminders/:id", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var tenantId, id, reminderData, reminder, error_17;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            tenantId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId;
                            if (!tenantId)
                                return [2 /*return*/, res.status(401).json({ message: "Missing tenantId" })];
                            _b.label = 1;
                        case 1:
                            _b.trys.push([1, 3, , 4]);
                            id = parseInt(req.params.id);
                            reminderData = insertReminderSchema.partial().parse(req.body);
                            return [4 /*yield*/, storage.updateReminder(id, reminderData, tenantId)];
                        case 2:
                            reminder = _b.sent();
                            if (!reminder) {
                                return [2 /*return*/, res.status(404).json({ message: "Reminder not found" })];
                            }
                            res.json(reminder);
                            return [3 /*break*/, 4];
                        case 3:
                            error_17 = _b.sent();
                            if (error_17 instanceof z.ZodError) {
                                return [2 /*return*/, res.status(400).json({ message: "Invalid reminder data", errors: error_17.issues })];
                            }
                            res.status(500).json({ message: "Failed to update reminder" });
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            // Notifications routes
            app.get("/api/notifications", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var tenantId, notifications, error_18;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            tenantId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId;
                            if (!tenantId)
                                return [2 /*return*/, res.status(401).json({ message: "Missing tenantId" })];
                            _b.label = 1;
                        case 1:
                            _b.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, storage.getNotifications(tenantId)];
                        case 2:
                            notifications = _b.sent();
                            res.json(notifications);
                            return [3 /*break*/, 4];
                        case 3:
                            error_18 = _b.sent();
                            res.status(500).json({ message: "Failed to fetch notifications" });
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            httpServer = createServer(app);
            return [2 /*return*/, httpServer];
        });
    });
}
