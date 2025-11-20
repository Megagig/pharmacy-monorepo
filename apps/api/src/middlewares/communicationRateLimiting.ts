import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth';
import logger from '../utils/logger';

/**
 * Enhanced rate limiting middleware specifically for Communication Hub
 */

// Store for tracking user-specific communication limits
const communicationRateLimitStore = new Map<
  string,
  {
    count: number;
    resetTime: number;
    messageCount: number;
    conversationCount: number;
    fileUploadCount: number;
  }
>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of communicationRateLimitStore.entries()) {
    if (now > value.resetTime) {
      communicationRateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Create communication-specific rate limiter with role-based limits
 */
export const createCommunicationRateLimiter = (options: {
  windowMs: number;
  limits: {
    pharmacist: number;
    doctor: number;
    patient: number;
    pharmacy_team: number;
    intern_pharmacist: number;
    default: number;
  };
  message?: string;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: (req: AuthRequest) => {
      // Super admin bypasses rate limits
      if (req.user?.role === 'super_admin') {
        return 10000; // Very high limit for super admin
      }

      const userRole = req.user?.role || 'default';
      return (
        options.limits[userRole as keyof typeof options.limits] ||
        options.limits.default
      );
    },
    message: {
      success: false,
      code: 'COMMUNICATION_RATE_LIMIT_EXCEEDED',
      message:
        options.message ||
        'Too many communication requests. Please try again later.',
      retryAfter: Math.ceil(options.windowMs / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    keyGenerator:
      options.keyGenerator ||
      ((req: AuthRequest) => {
        return req.user?._id?.toString() || req.ip || 'anonymous';
      }),
    skip: (req: AuthRequest) => {
      // Skip for super admins
      return req.user?.role === 'super_admin';
    },
    handler: (req: AuthRequest, res: Response) => {
      logger.warn('Communication rate limit exceeded', {
        userId: req.user?._id,
        userRole: req.user?.role,
        ip: req.ip,
        url: req.originalUrl,
        userAgent: req.get('User-Agent'),
        service: 'communication-rate-limiting',
      });

      return res.status(429).json({
        success: false,
        code: 'COMMUNICATION_RATE_LIMIT_EXCEEDED',
        message:
          options.message ||
          'Too many communication requests. Please try again later.',
        retryAfter: Math.ceil(options.windowMs / 1000),
      });
    },
  });
};

/**
 * Message sending rate limiter with burst protection
 */
export const messageRateLimit = createCommunicationRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  limits: {
    pharmacist: 100, // 100 messages per minute
    doctor: 100, // 100 messages per minute
    patient: 30, // 30 messages per minute (prevent spam)
    pharmacy_team: 60, // 60 messages per minute
    intern_pharmacist: 60, // 60 messages per minute
    default: 20, // 20 messages per minute for unknown roles
  },
  message:
    'Too many messages sent. Please slow down to maintain conversation quality.',
  skipSuccessfulRequests: false,
});

/**
 * Conversation creation rate limiter
 */
export const conversationRateLimit = createCommunicationRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limits: {
    pharmacist: 20, // 20 conversations per 15 minutes
    doctor: 20, // 20 conversations per 15 minutes
    patient: 5, // 5 conversations per 15 minutes
    pharmacy_team: 10, // 10 conversations per 15 minutes
    intern_pharmacist: 10, // 10 conversations per 15 minutes
    default: 3, // 3 conversations per 15 minutes
  },
  message: 'Too many conversations created. Please wait before creating more.',
});

/**
 * File upload rate limiter
 */
export const fileUploadRateLimit = createCommunicationRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  limits: {
    pharmacist: 50, // 50 files per 10 minutes
    doctor: 50, // 50 files per 10 minutes
    patient: 20, // 20 files per 10 minutes
    pharmacy_team: 30, // 30 files per 10 minutes
    intern_pharmacist: 30, // 30 files per 10 minutes
    default: 10, // 10 files per 10 minutes
  },
  message: 'Too many files uploaded. Please wait before uploading more files.',
});

/**
 * Search rate limiter to prevent abuse
 */
export const searchRateLimit = createCommunicationRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  limits: {
    pharmacist: 100, // 100 searches per 5 minutes
    doctor: 100, // 100 searches per 5 minutes
    patient: 30, // 30 searches per 5 minutes
    pharmacy_team: 60, // 60 searches per 5 minutes
    intern_pharmacist: 60, // 60 searches per 5 minutes
    default: 20, // 20 searches per 5 minutes
  },
  message: 'Too many search requests. Please wait before searching again.',
});

/**
 * Advanced user-based rate limiting with activity tracking
 */
export const createAdvancedUserRateLimit = (options: {
  windowMs: number;
  maxMessages: number;
  maxConversations: number;
  maxFileUploads: number;
  activityType: 'message' | 'conversation' | 'file_upload';
}) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required for rate limiting',
      });
    }

    // Skip for super admins
    if (req.user?.role === 'super_admin') {
      return next();
    }

    const userId = req.user._id.toString();
    const now = Date.now();

    // Get or create user activity tracking
    let userActivity = communicationRateLimitStore.get(userId);
    if (!userActivity || now > userActivity.resetTime) {
      userActivity = {
        count: 0,
        resetTime: now + options.windowMs,
        messageCount: 0,
        conversationCount: 0,
        fileUploadCount: 0,
      };
      communicationRateLimitStore.set(userId, userActivity);
    }

    // Check specific activity limits
    let exceeded = false;
    let limitType = '';
    let currentCount = 0;
    let maxCount = 0;

    switch (options.activityType) {
      case 'message':
        currentCount = userActivity.messageCount;
        maxCount = options.maxMessages;
        limitType = 'message';
        if (currentCount >= maxCount) exceeded = true;
        else userActivity.messageCount++;
        break;

      case 'conversation':
        currentCount = userActivity.conversationCount;
        maxCount = options.maxConversations;
        limitType = 'conversation';
        if (currentCount >= maxCount) exceeded = true;
        else userActivity.conversationCount++;
        break;

      case 'file_upload':
        currentCount = userActivity.fileUploadCount;
        maxCount = options.maxFileUploads;
        limitType = 'file upload';
        if (currentCount >= maxCount) exceeded = true;
        else userActivity.fileUploadCount++;
        break;
    }

    if (exceeded) {
      const retryAfter = Math.ceil((userActivity.resetTime - now) / 1000);

      logger.warn(`User ${limitType} rate limit exceeded`, {
        userId,
        userRole: req.user.role,
        activityType: options.activityType,
        currentCount,
        maxCount,
        retryAfter,
        service: 'communication-rate-limiting',
      });

      res.set('Retry-After', retryAfter.toString());
      res.set('X-RateLimit-Limit', maxCount.toString());
      res.set('X-RateLimit-Remaining', '0');
      res.set(
        'X-RateLimit-Reset',
        new Date(userActivity.resetTime).toISOString()
      );

      return res.status(429).json({
        success: false,
        code: `USER_${limitType
          .toUpperCase()
          .replace(' ', '_')}_RATE_LIMIT_EXCEEDED`,
        message: `Too many ${limitType}s. Please wait ${retryAfter} seconds before trying again.`,
        retryAfter,
        currentCount,
        maxCount,
      });
    }

    // Update store
    communicationRateLimitStore.set(userId, userActivity);

    // Set rate limit headers
    res.set('X-RateLimit-Limit', maxCount.toString());
    res.set('X-RateLimit-Remaining', (maxCount - currentCount - 1).toString());
    res.set(
      'X-RateLimit-Reset',
      new Date(userActivity.resetTime).toISOString()
    );

    next();
  };
};

/**
 * Burst protection for rapid message sending
 */
export const burstProtection = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return next();
  }

  // Skip for super admins
  if (req.user?.role === 'super_admin') {
    return next();
  }

  const userId = req.user._id.toString();
  const now = Date.now();
  const burstKey = `burst_${userId}`;

  // Track message timestamps for burst detection
  const userBurstData = communicationRateLimitStore.get(burstKey) || {
    count: 0,
    resetTime: now + 10000, // 10 second window
    messageCount: 0,
    conversationCount: 0,
    fileUploadCount: 0,
  };

  // Reset if window expired
  if (now > userBurstData.resetTime) {
    userBurstData.count = 0;
    userBurstData.resetTime = now + 10000;
  }

  // Check for burst (more than 5 messages in 10 seconds)
  userBurstData.count++;
  // Fix role comparison error - use valid role from the system
  const burstLimit = req.user?.role === 'pharmacy_outlet' ? 3 : 5; // Lower limit for pharmacy outlets

  if (userBurstData.count > burstLimit) {
    logger.warn('Message burst detected', {
      userId,
      userRole: req.user.role,
      burstCount: userBurstData.count,
      burstLimit,
      service: 'communication-rate-limiting',
    });

    communicationRateLimitStore.set(burstKey, userBurstData);

    return res.status(429).json({
      success: false,
      code: 'MESSAGE_BURST_DETECTED',
      message: 'Please slow down. You are sending messages too quickly.',
      retryAfter: Math.ceil((userBurstData.resetTime - now) / 1000),
    });
  }

  communicationRateLimitStore.set(burstKey, userBurstData);
  next();
};

/**
 * Adaptive rate limiting based on user behavior
 */
export const adaptiveCommunicationRateLimit = (baseLimit: number) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next();
    }

    // Skip for super admins
    if (req.user.role === 'super_admin') {
      return next();
    }

    const userId = req.user._id.toString();

    // Get user's recent activity pattern
    const userActivity = communicationRateLimitStore.get(userId);

    if (userActivity) {
      const totalActivity =
        userActivity.messageCount +
        userActivity.conversationCount +
        userActivity.fileUploadCount;

      // Reduce limit for very active users to prevent spam
      if (totalActivity > baseLimit * 0.8) {
        const adjustedLimit = Math.max(1, Math.floor(baseLimit * 0.5));
        (req as any).adaptiveRateLimit = adjustedLimit;

        logger.info('Adaptive rate limit applied', {
          userId,
          userRole: req.user.role,
          totalActivity,
          baseLimit,
          adjustedLimit,
          service: 'communication-rate-limiting',
        });
      }
    }

    next();
  };
};

/**
 * Spam detection middleware
 */
export const spamDetection = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return next();
  }

  // Skip for super admins
  if (req.user.role === 'super_admin') {
    return next();
  }

  const content = req.body.content?.text || req.body.message || '';
  const userId = req.user._id.toString();

  // Simple spam detection patterns
  const spamPatterns = [
    /(.)\1{10,}/, // Repeated characters
    /^[A-Z\s!]{20,}$/, // All caps with exclamation
    /(https?:\/\/[^\s]+){3,}/, // Multiple URLs
    /(\b\w+\b.*?){1,}\1{5,}/, // Repeated words
  ];

  const isSpam = spamPatterns.some((pattern) => pattern.test(content));

  if (isSpam) {
    logger.warn('Potential spam message detected', {
      userId,
      userRole: req.user.role,
      contentLength: content.length,
      content: content.substring(0, 100), // Log first 100 chars
      service: 'communication-rate-limiting',
    });

    // Don't block immediately, but flag for review
    (req as any).potentialSpam = true;

    // Could implement additional actions:
    // - Require manual review
    // - Reduce user's rate limits
    // - Send alert to moderators
  }

  next();
};

export default {
  createCommunicationRateLimiter,
  messageRateLimit,
  conversationRateLimit,
  fileUploadRateLimit,
  searchRateLimit,
  createAdvancedUserRateLimit,
  burstProtection,
  adaptiveCommunicationRateLimit,
  spamDetection,
};
