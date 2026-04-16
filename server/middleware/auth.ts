import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || "subs_secret_key";

export interface AuthUser {
  userId: string;
  email: string;
  tenantId: string | null;
  actingTenantId?: string | null;
  role?: string;
  department?: string;
}

export type AuthRequest = Request;

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  let token;
  const tabScoped = Boolean(req.headers["x-tab-auth"]);
  
  // Support both Authorization header and cookie
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.replace("Bearer ", "");
  } else if (req.cookies && req.cookies.token && (!tabScoped || !req.headers.authorization)) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }

  token = String(token).trim().replace(/^Bearer\s+/i, "");

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;

    if ((req.user as any)?.role === 'global_admin' && !(req.user as any)?.tenantId && (req.user as any)?.actingTenantId) {
      (req.user as any).tenantId = (req.user as any).actingTenantId;
    }
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};

// Optional authentication - sets user if token exists but doesn't fail if missing
export const optionalAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  let token;
  const tabScoped = Boolean(req.headers["x-tab-auth"]);
  
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.replace("Bearer ", "");
  } else if (req.cookies && req.cookies.token && (!tabScoped || !req.headers.authorization)) {
    token = req.cookies.token;
  }

  if (token) {
    token = String(token).trim().replace(/^Bearer\s+/i, "");
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.user = decoded;

      if ((req.user as any)?.role === 'global_admin' && !(req.user as any)?.tenantId && (req.user as any)?.actingTenantId) {
        (req.user as any).tenantId = (req.user as any).actingTenantId;
      }
    } catch (err) {
      req.user = undefined;
    }
  }
  
  next();
};
