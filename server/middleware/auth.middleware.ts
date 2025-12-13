import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || "subs_secret_key";

export interface AuthUser {
  userId: string;
  email: string;
  tenantId: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  let token;
  
  // Support both Authorization header and cookie
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.replace("Bearer ", "");
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
  req.user = decoded;
  console.log('Decoded JWT:', decoded); // Debug log
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};

// Optional authentication - sets user if token exists but doesn't fail if missing
export const optionalAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  let token;
  
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.replace("Bearer ", "");
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    console.log('Decoded user in middleware:', decoded); // Debug log
    } catch (err) {
      req.user = undefined;
    }
  }
  
  next();
};

// Role-based authorization middleware
export const requireRole = (...allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const user = req.user as any;
    
    if (!user || !user.role) {
      return res.status(403).json({ message: "Access denied: No role assigned" });
    }
    
    // Super admin has access to everything
    if (user.role === 'super_admin') {
      return next();
    }
    
    // Check if user's role is in the allowed roles
    if (allowedRoles.includes(user.role)) {
      return next();
    }
    
    return res.status(403).json({ 
      message: "Access denied: Insufficient permissions",
      requiredRoles: allowedRoles,
      userRole: user.role
    });
  };
};
