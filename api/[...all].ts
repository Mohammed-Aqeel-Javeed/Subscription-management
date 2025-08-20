import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { storage } from '../server/storage';
import jwt from 'jsonwebtoken';
import { ObjectId } from "mongodb";
import subtrackerrRouter from "../server/subtrackerr.routes";

// Create Express app instance
const app = express();

// Configure CORS
app.use(cors({
  origin: [
    'https://subscription-management-ztxt-f4vfndudd.vercel.app',
    'https://subscription-management-uhzp.vercel.app', 
    'http://localhost:5173'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Basic auth routes
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    const db = await storage["getDb"]();
    const user = await db.collection("login").findOne({ email, password });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    const tokenPayload: any = { userId: user._id, email: user.email };
    if (user.tenantId) {
      tokenPayload.tenantId = user.tenantId;
    }
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || "subs_secret_key", { expiresIn: "7d" });
    res.cookie("token", token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? "none" : "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    res.status(200).json({ message: "Login successful" });
  } catch (err) {
    res.status(500).json({ message: "Login failed" });
  }
});

app.post("/api/signup", async (req, res) => {
  try {
    const { email, password, tenantId } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    const db = await storage["getDb"]();
    const existingUser = await db.collection("login").findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }
    const userData: any = { email, password };
    if (tenantId) {
      userData.tenantId = tenantId;
    }
    await db.collection("login").insertOne(userData);
    res.status(201).json({ message: "Signup successful" });
  } catch (err) {
    res.status(500).json({ message: "Failed to save signup" });
  }
});

app.post("/api/logout", (req, res) => {
  res.cookie("token", "", {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? "none" : "lax",
    path: "/",
    expires: new Date(0)
  });
  res.status(200).json({ message: "Logout successful" });
});

// Use subtrackerr routes for all other endpoints
app.use(subtrackerrRouter);

// Vercel serverless function handler
export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req as any, res as any);
}
