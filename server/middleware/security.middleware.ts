import type { Request, Response, NextFunction } from 'express';

/**
 * Middleware to enforce HTTPS in production
 * Redirects HTTP requests to HTTPS
 */
export const enforceHttps = (req: Request, res: Response, next: NextFunction) => {
  // Only enforce HTTPS in production
  if (process.env.NODE_ENV === 'production') {
    // Check if request is not secure (not HTTPS)
    if (!req.secure && req.get('x-forwarded-proto') !== 'https') {
      // Redirect to HTTPS
      return res.redirect(301, `https://${req.get('host')}${req.url}`);
    }
  }
  next();
};

/**
 * Security headers middleware
 * Adds important security headers to all responses
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Strict Transport Security - Force HTTPS for 1 year
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // XSS Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://subscription-management-6uje.onrender.com"
  );
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions Policy
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  next();
};

/**
 * Rate limiting configuration (use with express-rate-limit)
 */
export const rateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
};

/**
 * Sensitive data protection - Remove sensitive headers from requests
 */
export const sanitizeHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Remove potentially sensitive headers
  delete req.headers['x-powered-by'];
  res.removeHeader('X-Powered-By');
  next();
};
