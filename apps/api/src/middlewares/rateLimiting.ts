import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth';

// Store for tracking user-specific rate limits
const userRateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Clean up expired entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of userRateLimitStore.entries()) {
        if (now > value.resetTime) {
            userRateLimitStore.delete(key);
        }
    }
}, 5 * 60 * 1000);

/**
 * Enhanced rate limiting middleware with super admin bypass
 */
export const createRateLimiter = (options: {
    windowMs: number;
    max: number;
    message?: string;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
    keyGenerator?: (req: Request) => string;
    bypassSuperAdmin?: boolean;
}) => {
    const limiter = rateLimit({
        windowMs: options.windowMs,
        max: options.max,
        message: {
            success: false,
            code: 'RATE_LIMIT_EXCEEDED',
            message: options.message || 'Too many requests. Please try again later.',
            retryAfter: Math.ceil(options.windowMs / 1000),
        },
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests: options.skipSuccessfulRequests || false,
        skipFailedRequests: options.skipFailedRequests || false,
        keyGenerator: options.keyGenerator,
        skip: (req: AuthRequest) => {
            // Skip rate limiting for super admins if enabled
            if (options.bypassSuperAdmin && req.user?.role === 'super_admin') {
                return true;
            }
            return false;
        },
    });

    return limiter;
};

/**
 * User-based rate limiting (in addition to IP-based)
 */
export const createUserRateLimiter = (options: {
    windowMs: number;
    max: number;
    message?: string;
    bypassSuperAdmin?: boolean;
}) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        // Skip for super admins if enabled
        if (options.bypassSuperAdmin && req.user?.role === 'super_admin') {
            return next();
        }

        if (!req.user) {
            return res.status(401).json({
                success: false,
                code: 'UNAUTHORIZED',
                message: 'Authentication required for rate limiting',
            });
        }

        const userId = req.user._id.toString();
        const now = Date.now();
        const windowStart = now - options.windowMs;

        // Get or create user rate limit entry
        let userLimit = userRateLimitStore.get(userId);
        if (!userLimit || now > userLimit.resetTime) {
            userLimit = {
                count: 0,
                resetTime: now + options.windowMs,
            };
            userRateLimitStore.set(userId, userLimit);
        }

        // Check if user has exceeded limit
        if (userLimit.count >= options.max) {
            const retryAfter = Math.ceil((userLimit.resetTime - now) / 1000);
            res.set('Retry-After', retryAfter.toString());
            res.set('X-RateLimit-Limit', options.max.toString());
            res.set('X-RateLimit-Remaining', '0');
            res.set('X-RateLimit-Reset', new Date(userLimit.resetTime).toISOString());

            return res.status(429).json({
                success: false,
                code: 'USER_RATE_LIMIT_EXCEEDED',
                message: options.message || 'Too many requests from this user. Please try again later.',
                retryAfter,
            });
        }

        // Increment counter
        userLimit.count++;
        userRateLimitStore.set(userId, userLimit);

        // Set rate limit headers
        res.set('X-RateLimit-Limit', options.max.toString());
        res.set('X-RateLimit-Remaining', (options.max - userLimit.count).toString());
        res.set('X-RateLimit-Reset', new Date(userLimit.resetTime).toISOString());

        next();
    };
};

/**
 * Invitation-specific rate limiters
 */
export const invitationRateLimiters = {
    // IP-based rate limiting for invitation creation
    createInvitation: createRateLimiter({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 10, // 10 invitations per IP per 15 minutes
        message: 'Too many invitation creation requests from this IP. Please try again later.',
        bypassSuperAdmin: true,
        keyGenerator: (req: Request) => {
            // Use IP address for rate limiting
            return req.ip || req.connection.remoteAddress || 'unknown';
        },
    }),

    // User-based rate limiting for invitation creation (more restrictive)
    createInvitationUser: createUserRateLimiter({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 20, // 20 invitations per user per hour
        message: 'Too many invitations created. Please wait before creating more invitations.',
        bypassSuperAdmin: true,
    }),

    // Rate limiting for invitation validation
    validateInvitation: createRateLimiter({
        windowMs: 5 * 60 * 1000, // 5 minutes
        max: 50, // 50 validation attempts per IP per 5 minutes
        message: 'Too many invitation validation requests. Please try again later.',
        bypassSuperAdmin: false, // Don't bypass for validation
    }),

    // Rate limiting for invitation acceptance
    acceptInvitation: createRateLimiter({
        windowMs: 10 * 60 * 1000, // 10 minutes
        max: 5, // 5 acceptance attempts per IP per 10 minutes
        message: 'Too many invitation acceptance attempts. Please try again later.',
        bypassSuperAdmin: false, // Don't bypass for acceptance
    }),
};

/**
 * Subscription-specific rate limiters
 */
export const subscriptionRateLimiters = {
    // Rate limiting for subscription changes
    subscriptionChange: createRateLimiter({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 5, // 5 subscription changes per IP per hour
        message: 'Too many subscription change requests. Please try again later.',
        bypassSuperAdmin: true,
    }),

    // User-based rate limiting for subscription changes
    subscriptionChangeUser: createUserRateLimiter({
        windowMs: 24 * 60 * 60 * 1000, // 24 hours
        max: 3, // 3 subscription changes per user per day
        message: 'Too many subscription changes today. Please contact support if you need assistance.',
        bypassSuperAdmin: true,
    }),

    // Rate limiting for payment attempts
    paymentAttempt: createRateLimiter({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 10, // 10 payment attempts per IP per 15 minutes
        message: 'Too many payment attempts. Please try again later.',
        bypassSuperAdmin: true,
    }),
};

/**
 * General API rate limiters
 */
export const generalRateLimiters = {
    // General API rate limiting
    api: createRateLimiter({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 1000, // 1000 requests per IP per 15 minutes
        message: 'Too many API requests. Please try again later.',
        bypassSuperAdmin: true,
        skipSuccessfulRequests: true, // Only count failed requests
    }),

    // Strict rate limiting for sensitive operations
    sensitive: createRateLimiter({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 10, // 10 sensitive operations per IP per hour
        message: 'Too many sensitive operation requests. Please try again later.',
        bypassSuperAdmin: true,
    }),

    // Authentication rate limiting
    auth: createRateLimiter({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 20, // 20 auth attempts per IP per 15 minutes
        message: 'Too many authentication attempts. Please try again later.',
        bypassSuperAdmin: false, // Don't bypass auth rate limiting
        skipSuccessfulRequests: true, // Only count failed auth attempts
    }),
};

/**
 * Abuse detection middleware
 */
export const abuseDetection = {
    // Detect rapid invitation creation patterns
    invitationSpam: (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return next();
        }

        const userId = req.user._id.toString();
        const now = Date.now();
        const key = `invitation_spam_${userId}`;

        // Check if user has created too many invitations in a short time
        let spamData = userRateLimitStore.get(key);
        if (!spamData || now > spamData.resetTime) {
            spamData = {
                count: 0,
                resetTime: now + (5 * 60 * 1000), // 5 minutes window
            };
        }

        spamData.count++;
        userRateLimitStore.set(key, spamData);

        // Flag as potential spam if more than 5 invitations in 5 minutes
        if (spamData.count > 5) {
            // Log the potential abuse
            console.warn(`Potential invitation spam detected for user ${userId}:`, {
                userId,
                count: spamData.count,
                timeWindow: '5 minutes',
                ip: req.ip,
                userAgent: req.get('User-Agent'),
            });

            // You could implement additional actions here:
            // - Send alert to admins
            // - Temporarily suspend user
            // - Require additional verification
        }

        next();
    },

    // Detect suspicious login patterns
    suspiciousLogin: (req: Request, res: Response, next: NextFunction) => {
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        const userAgent = req.get('User-Agent') || 'unknown';

        // Log suspicious patterns (implement your logic here)
        // This is a placeholder for more sophisticated abuse detection

        next();
    },
};

export default {
    createRateLimiter,
    createUserRateLimiter,
    invitationRateLimiters,
    subscriptionRateLimiters,
    generalRateLimiters,
    abuseDetection,
};