import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { connectToDatabase } from '../mongo';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET missing or too short (must be at least 32 characters) — refusing to start");
}

export interface AuthUser {
  userId: string;
  email: string;
  tenantId: string | null;
  actingTenantId?: string | null;
  role?: string;
  department?: string;
}

export type AuthenticatedRequest = Request;

export const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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

    // Normalize tenant context for global admins.
    // Their identity is platform-level (token tenantId can be null), but most routes expect a tenantId.
    if ((req.user as any)?.role === 'global_admin' && !(req.user as any)?.tenantId && (req.user as any)?.actingTenantId) {
      (req.user as any).tenantId = (req.user as any).actingTenantId;
    }
    
    // For department_editor and department_viewer, find their department by matching email with department head
    if (decoded.role === 'department_editor' || decoded.role === 'department_viewer') {
      try {
        const db = await connectToDatabase();
        const departmentsCollection = db.collection('departments');
        const department = await departmentsCollection.findOne({
          tenantId: decoded.tenantId,
          email: decoded.email
        });
        
        if (department && req.user) {
          req.user.department = department.name;
        }
      } catch (dbErr) {
        console.error('Error fetching department for user:', dbErr);
      }
    }
    
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};

// Optional authentication - sets user if token exists but doesn't fail if missing
export const optionalAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
      
      // For department_editor and department_viewer, find their department by matching email with department head
      if (decoded.role === 'department_editor' || decoded.role === 'department_viewer') {
        try {
          const db = await connectToDatabase();
          const departmentsCollection = db.collection('departments');
          const department = await departmentsCollection.findOne({
            tenantId: decoded.tenantId,
            email: decoded.email
          });
          
          if (department && req.user) {
            req.user.department = department.name;
          }
        } catch (dbErr) {
          console.error('Error fetching department for user:', dbErr);
        }
      }
      
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
    
    // Super/Global admin has access to everything
    if (user.role === 'super_admin' || user.role === 'global_admin') {
      return next();
    }
    
    // Normalise 'admin' access (if editor is allowed, admin is also allowed since admin > editor)
    const effectiveRoles = [...allowedRoles];
    if (effectiveRoles.includes('editor') && !effectiveRoles.includes('admin')) {
      effectiveRoles.push('admin');
    }
    
    // Check if user's role is in the allowed roles
    if (effectiveRoles.includes(user.role)) {
      return next();
    }
    
    return res.status(403).json({ 
      message: "Access denied: Insufficient permissions",
      requiredRoles: allowedRoles,
      userRole: user.role
    });
  };
};
