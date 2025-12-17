import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { connectToDatabase } from '../mongo';

const JWT_SECRET = process.env.JWT_SECRET || "subs_secret_key";

export interface AuthUser {
  userId: string;
  email: string;
  tenantId: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
    
    // For department_editor and department_viewer, find their department by matching email with department head
    if (decoded.role === 'department_editor' || decoded.role === 'department_viewer') {
      try {
        const db = await connectToDatabase();
        const departmentsCollection = db.collection('departments');
        const department = await departmentsCollection.findOne({
          tenantId: decoded.tenantId,
          email: decoded.email
        });
        
        if (department) {
          req.user.department = department.name;
          console.log(`Set department for ${decoded.email}: ${department.name}`);
        }
      } catch (dbErr) {
        console.error('Error fetching department for user:', dbErr);
      }
    }
    
    console.log('Decoded JWT:', req.user); // Debug log
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};

// Optional authentication - sets user if token exists but doesn't fail if missing
export const optionalAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
      
      // For department_editor and department_viewer, find their department by matching email with department head
      if (decoded.role === 'department_editor' || decoded.role === 'department_viewer') {
        try {
          const db = await connectToDatabase();
          const departmentsCollection = db.collection('departments');
          const department = await departmentsCollection.findOne({
            tenantId: decoded.tenantId,
            email: decoded.email
          });
          
          if (department) {
            req.user.department = department.name;
            console.log(`Set department for ${decoded.email}: ${department.name}`);
          }
        } catch (dbErr) {
          console.error('Error fetching department for user:', dbErr);
        }
      }
      
      console.log('Decoded user in middleware:', req.user); // Debug log
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
