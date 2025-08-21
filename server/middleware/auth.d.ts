import type { Request, Response, NextFunction } from 'express';
export interface AuthUser {
    userId: string;
    email: string;
    tenantId: string;
}
export interface AuthRequest extends Request {
    user?: AuthUser;
    headers: Record<string, any>;
    cookies: Record<string, any>;
}
export declare const authenticateToken: (req: AuthRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const optionalAuth: (req: AuthRequest, res: Response, next: NextFunction) => void;
