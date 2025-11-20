import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthRequest } from '../../../types/auth';
import logger from '../../../utils/logger';
import crypto from 'crypto';
import xss from 'xss'; // @ts-ignore: No type declarations for 'xss'

/**
 * Enhanced security middleware for manual lab operations
 */

// Store for tracking user-specific security metrics
const securityMetrics = new Map<string, {
    pdfAccessCount: number;
    orderCreationCount: number;
    failedAttempts: number;
    lastActivity: number;
    suspiciousActivity: boolean;
    resetTime: number;
}>();

// Clean up expired entries every 10 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of securityMetrics.entries()) {
        if (now > value.resetTime) {
            securityMetrics.delete(key);
        }
    }
}, 10 * 60 * 1000);

/**
 * Enhanced rate limiting for order creation
 */
export const enhancedOrderCreationRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: (req: AuthRequest) => {
        // Adjust limit based on user role and history
        if (req.user?.role === 'owner') return 20;
        if (req.user?.role === 'pharmacist') return 15;

        // Check user's security metrics
        const userId = req.user?._id?.toString();
        if (userId) {
            const metrics = securityMetrics.get(userId);
            if (metrics?.suspiciousActivity) {
                return 5; // Reduced limit for suspicious users
            }
        }

        return 10; // Default limit
    },
    message: (req: AuthRequest) => ({
        success: false,
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many order creation attempts. Please try again later.',
        retryAfter: Math.ceil(15 * 60), // 15 minutes in seconds
        userId: req.user?._id
    }),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: AuthRequest) => {
        // Use user ID for rate limiting instead of IP
        return req.user?._id?.toString() || req.ip || 'anonymous';
    },
    skip: (req: AuthRequest) => {
        // Never skip rate limiting for order creation
        return false;
    },
    handler: (req: AuthRequest, res: Response) => {
        const userId = req.user?._id?.toString();
        if (userId) {
            updateSecurityMetrics(userId, 'orderCreationLimit');
        }

        logger.warn('Order creation rate limit exceeded', {
            userId,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            service: 'manual-lab-security'
        });

        res.status(429).json({
            success: false,
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many order creation attempts. Please try again later.',
            retryAfter: Math.ceil(15 * 60), // 15 minutes in seconds
            userId: req.user?._id
        });
    }
});

/**
 * Enhanced rate limiting for PDF access with time-limited tokens
 */
export const enhancedPDFAccessRateLimit = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: (req: AuthRequest) => {
        const userId = req.user?._id?.toString();
        if (userId) {
            const metrics = securityMetrics.get(userId);
            if (metrics?.suspiciousActivity) {
                return 10; // Reduced limit for suspicious users
            }
        }
        return 30; // Default limit
    },
    message: {
        success: false,
        code: 'PDF_ACCESS_RATE_LIMIT_EXCEEDED',
        message: 'Too many PDF access attempts. Please try again later.',
        retryAfter: Math.ceil(5 * 60)
    },
    keyGenerator: (req: AuthRequest) => {
        return req.user?._id?.toString() || req.ip || 'anonymous';
    },
    handler: (req: AuthRequest, res: Response) => {
        const userId = req.user?._id?.toString();
        if (userId) {
            updateSecurityMetrics(userId, 'pdfAccessLimit');
        }

        logger.warn('PDF access rate limit exceeded', {
            userId,
            orderId: req.params.orderId,
            ip: req.ip,
            service: 'manual-lab-security'
        });

        res.status(429).json({
            success: false,
            code: 'PDF_ACCESS_RATE_LIMIT_EXCEEDED',
            message: 'Too many PDF access attempts. Please try again later.',
            retryAfter: Math.ceil(5 * 60)
        });
    }
});

/**
 * Input sanitization and XSS protection middleware
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
    try {
        // Sanitize request body
        if (req.body && typeof req.body === 'object') {
            req.body = sanitizeObject(req.body);
        }

        // Sanitize query parameters
        if (req.query && typeof req.query === 'object') {
            req.query = sanitizeObject(req.query);
        }

        // Sanitize URL parameters
        if (req.params && typeof req.params === 'object') {
            req.params = sanitizeObject(req.params);
        }

        next();
    } catch (error) {
        logger.error('Input sanitization failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            url: req.originalUrl,
            service: 'manual-lab-security'
        });

        res.status(400).json({
            success: false,
            code: 'INPUT_SANITIZATION_ERROR',
            message: 'Invalid input detected'
        });
    }
};

/**
 * Secure PDF URL generation with time-limited access tokens
 */
export const generateSecurePDFToken = (orderId: string, userId: string, expiresIn: number = 3600): string => {
    const payload = {
        orderId,
        userId,
        exp: Math.floor(Date.now() / 1000) + expiresIn, // Expires in seconds
        iat: Math.floor(Date.now() / 1000),
        type: 'pdf_access'
    };

    const secret = process.env.JWT_SECRET || 'fallback-secret';
    const token = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signature = crypto.createHmac('sha256', secret).update(token).digest('hex');

    return `${token}.${signature}`;
};

/**
 * Validate secure PDF access token
 */
export const validatePDFToken = (token: string): { valid: boolean; payload?: any; error?: string } => {
    try {
        const [tokenPart, signature] = token.split('.');
        if (!tokenPart || !signature) {
            return { valid: false, error: 'Invalid token format' };
        }

        // Verify signature
        const secret = process.env.JWT_SECRET || 'fallback-secret';
        const expectedSignature = crypto.createHmac('sha256', secret).update(tokenPart).digest('hex');

        if (signature !== expectedSignature) {
            return { valid: false, error: 'Invalid token signature' };
        }

        // Decode payload
        const payload = JSON.parse(Buffer.from(tokenPart, 'base64').toString());

        // Check expiration
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && now > payload.exp) {
            return { valid: false, error: 'Token expired' };
        }

        // Check token type
        if (payload.type !== 'pdf_access') {
            return { valid: false, error: 'Invalid token type' };
        }

        return { valid: true, payload };
    } catch (error) {
        return { valid: false, error: 'Token validation failed' };
    }
};

/**
 * Middleware to validate PDF access tokens
 */
export const validatePDFAccess = (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = req.query.token as string || req.headers['x-pdf-token'] as string;

    if (!token) {
        return res.status(401).json({
            success: false,
            code: 'PDF_TOKEN_REQUIRED',
            message: 'PDF access token is required'
        });
    }

    const validation = validatePDFToken(token);
    if (!validation.valid) {
        logger.warn('Invalid PDF access token', {
            error: validation.error,
            userId: req.user?._id,
            orderId: req.params.orderId,
            ip: req.ip,
            service: 'manual-lab-security'
        });

        return res.status(401).json({
            success: false,
            code: 'INVALID_PDF_TOKEN',
            message: validation.error || 'Invalid PDF access token'
        });
    }

    // Verify token matches the requesting user and order
    if (validation.payload.userId !== req.user?._id?.toString()) {
        return res.status(403).json({
            success: false,
            code: 'PDF_TOKEN_USER_MISMATCH',
            message: 'PDF token does not match requesting user'
        });
    }

    if (validation.payload.orderId !== req.params.orderId?.toUpperCase()) {
        return res.status(403).json({
            success: false,
            code: 'PDF_TOKEN_ORDER_MISMATCH',
            message: 'PDF token does not match requested order'
        });
    }

    // Store token payload for use in controller
    (req as any).pdfToken = validation.payload;
    next();
    return;
};

/**
 * CSRF protection middleware
 */
export const csrfProtection = (req: AuthRequest, res: Response, next: NextFunction) => {
    // Skip CSRF for GET requests
    if (req.method === 'GET') {
        return next();
    }

    const csrfToken = req.headers['x-csrf-token'] as string || req.body._csrf;
    const sessionToken = (req as any).session?.csrfToken;

    if (!csrfToken || !sessionToken || csrfToken !== sessionToken) {
        logger.warn('CSRF token validation failed', {
            userId: req.user?._id,
            method: req.method,
            url: req.originalUrl,
            hasToken: !!csrfToken,
            hasSessionToken: !!sessionToken,
            service: 'manual-lab-security'
        });

        return res.status(403).json({
            success: false,
            code: 'CSRF_TOKEN_INVALID',
            message: 'CSRF token validation failed'
        });
    }

    next();
};

/**
 * Generate CSRF token for session
 */
export const generateCSRFToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!(req as any).session) {
        return next();
    }

    if (!(req as any).session.csrfToken) {
        (req as any).session.csrfToken = crypto.randomBytes(32).toString('hex');
    }

    // Add CSRF token to response headers
    res.setHeader('X-CSRF-Token', (req as any).session.csrfToken);
    next();
};

/**
 * Suspicious activity detection middleware
 */
export const detectSuspiciousActivity = (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?._id?.toString();
    if (!userId) {
        return next();
    }

    const now = Date.now();
    const metrics = getOrCreateSecurityMetrics(userId);

    // Check for rapid requests
    if (metrics.lastActivity && (now - metrics.lastActivity) < 500) { // Less than 500ms
        metrics.suspiciousActivity = true;
        logger.warn('Rapid requests detected', {
            userId,
            timeDiff: now - metrics.lastActivity,
            url: req.originalUrl,
            service: 'manual-lab-security'
        });
    }

    // Check for unusual patterns
    const userAgent = req.get('User-Agent') || '';
    if (userAgent.toLowerCase().includes('bot') ||
        userAgent.toLowerCase().includes('crawler') ||
        userAgent.toLowerCase().includes('script')) {
        metrics.suspiciousActivity = true;
        logger.warn('Bot-like user agent detected', {
            userId,
            userAgent,
            service: 'manual-lab-security'
        });
    }

    // Update metrics
    metrics.lastActivity = now;
    securityMetrics.set(userId, metrics);

    // Block if too suspicious
    if (metrics.suspiciousActivity && metrics.failedAttempts > 5) {
        return res.status(429).json({
            success: false,
            code: 'SUSPICIOUS_ACTIVITY_BLOCKED',
            message: 'Account temporarily blocked due to suspicious activity'
        });
    }

    next();
};

/**
 * Security headers middleware
 */
export const setSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Enable XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Prevent caching of sensitive data
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Content Security Policy for PDF responses
    if (req.originalUrl.includes('/pdf')) {
        res.setHeader('Content-Security-Policy', "default-src 'none'; object-src 'none'; frame-ancestors 'none';");
        res.setHeader('X-Download-Options', 'noopen');
    }

    next();
};

/**
 * Helper functions
 */
function sanitizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
        return typeof obj === 'string' ? xss(obj) : obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
        // Sanitize key
        const cleanKey = xss(key);

        // Recursively sanitize value
        sanitized[cleanKey] = sanitizeObject(value);
    }

    return sanitized;
}

function getOrCreateSecurityMetrics(userId: string) {
    let metrics = securityMetrics.get(userId);
    if (!metrics) {
        const now = Date.now();
        metrics = {
            pdfAccessCount: 0,
            orderCreationCount: 0,
            failedAttempts: 0,
            lastActivity: now,
            suspiciousActivity: false,
            resetTime: now + (60 * 60 * 1000) // Reset after 1 hour
        };
        securityMetrics.set(userId, metrics);
    }
    return metrics;
}

function updateSecurityMetrics(userId: string, event: string) {
    const metrics = getOrCreateSecurityMetrics(userId);

    switch (event) {
        case 'orderCreationLimit':
            metrics.orderCreationCount++;
            metrics.failedAttempts++;
            break;
        case 'pdfAccessLimit':
            metrics.pdfAccessCount++;
            metrics.failedAttempts++;
            break;
        case 'suspiciousActivity':
            metrics.suspiciousActivity = true;
            metrics.failedAttempts++;
            break;
    }

    // Mark as suspicious if too many failed attempts
    if (metrics.failedAttempts > 3) {
        metrics.suspiciousActivity = true;
    }

    securityMetrics.set(userId, metrics);
}

export default {
    enhancedOrderCreationRateLimit,
    enhancedPDFAccessRateLimit,
    sanitizeInput,
    generateSecurePDFToken,
    validatePDFToken,
    validatePDFAccess,
    csrfProtection,
    generateCSRFToken,
    detectSuspiciousActivity,
    setSecurityHeaders
};