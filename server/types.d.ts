import { Request } from "express";

// Extend Express Request type to include user with tenantId
export interface AuthenticatedUser {
  userId: string;
  email: string;
  tenantId: string;
  role?: string;
  department?: string;
  // ...other user properties
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export interface User {
  userId: string;
  tenantId: string;
  email?: string;
  name?: string;
  role?: string;
  department?: string;
  // Add any other properties needed for your app
}
