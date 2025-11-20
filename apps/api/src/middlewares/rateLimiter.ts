import { Request, Response, NextFunction, RequestHandler } from 'express';
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';

/**
 * Rate limiter options interface
 */
export interface RateLimiterOptions {
    windowMs?: number; // Time window in milliseconds
    max?: number; // Maximum number of requests per window
    message?: string; // Custom error message
    skipSuccessfulRequests?: boolean; // Don't count successful requests
    skipFailedRequests?: boolean; // Don't count failed requests
}

/**
 * Create a rate limiter middleware
 * @param options - Rate limiter configuration
 * @returns Express middleware
 */
export const rateLimiter = (options: RateLimiterOptions = {}): RateLimitRequestHandler => {
    const {
        windowMs = 15 * 60 * 1000, // Default: 15 minutes
        max = 100, // Default: 100 requests per window
        message = 'Too many requests from this IP, please try again later',
        skipSuccessfulRequests = false,
        skipFailedRequests = false,
    } = options;

    return rateLimit({
        windowMs,
        max,
        message: {
            success: false,
            error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message,
            },
        },
        standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
        legacyHeaders: false, // Disable `X-RateLimit-*` headers
        skipSuccessfulRequests,
        skipFailedRequests,
        handler: (req: Request, res: Response) => {
            res.status(429).json({
                success: false,
                error: {
                    code: 'RATE_LIMIT_EXCEEDED',
                    message,
                    retryAfter: Math.ceil(windowMs / 1000),
                },
            });
        },
    });
};

/**
 * Create a user-specific rate limiter (requires authentication)
 */
export const userRateLimiter = (options: RateLimiterOptions = {}): RequestHandler => {
    const userLimits = new Map<string, { count: number; resetTime: number }>();

    const {
        windowMs = 15 * 60 * 1000,
        max = 100,
        message = 'Too many requests, please try again later',
    } = options;

    return (req: Request, res: Response, next: NextFunction): void => {
        const userId = (req as any).user?._id || (req as any).patientUser?._id;

        if (!userId) {
            // If no user, skip user-based limiting
            next();
            return;
        }

        const now = Date.now();
        const userKey = userId.toString();
        const userLimit = userLimits.get(userKey);

        if (!userLimit || now > userLimit.resetTime) {
            // Initialize or reset counter
            userLimits.set(userKey, {
                count: 1,
                resetTime: now + windowMs,
            });
            next();
            return;
        }

        if (userLimit.count >= max) {
            res.status(429).json({
                success: false,
                error: {
                    code: 'RATE_LIMIT_EXCEEDED',
                    message,
                    retryAfter: Math.ceil((userLimit.resetTime - now) / 1000),
                },
            });
            return;
        }

        // Increment counter
        userLimit.count++;
        next();
    };
};

// Clean up old entries periodically
setInterval(() => {
    // This would need to be implemented if using the userRateLimiter
    // For now, keeping it simple
}, 60 * 60 * 1000); // Every hour

export default rateLimiter;
