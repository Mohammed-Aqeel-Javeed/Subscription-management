import { Request } from "express";

// Extend Express Request type to include user with tenantId
export interface AuthenticatedUser {
  tenantId: string;
  // ...other user properties
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

declare global {
  namespace Express {
    interface User extends AuthenticatedUser {}
    interface Request extends AuthenticatedRequest {}
  }
}

export interface User {
  userId: string;
  tenantId: string;
  email?: string;
  name?: string;
  role?: string;
  // Add any other properties needed for your app
}
