import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth';
import { RedisCacheService } from '../services/RedisCacheService';
import logger from '../utils/logger';

/**
 * Enhanced Rate Limiting and DDoS Protection Middleware
 * Provides comprehensive protection against abuse and denial of service attacks
 */

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  skipFunction?: (req: Request) => boolean;
  onLimitReached?: (req: Request, res: Response) => void;
}

interface DDoSConfig {
  enabled: boolean;
  suspiciousThreshold: number;
  blockThreshold: number;
  blockDuration: number; // in seconds
  whitelistedIPs: string[];
  monitoringWindow: number; // in seconds
}

interface RateLimitInfo {
  count: number;
  resetTime: number;
  blocked: boolean;
  blockExpires?: number;
  firstRequest: number;
  lastRequest: number;
  suspiciousScore: number;
}

interface DDoSMetrics {
  requestCount: number;
  uniqueEndpoints: Set<string>;
  errorRate: number;
  avgResponseTime: number;
  suspiciousPatterns: string[];
}

class EnhancedRateLimit {
  private cacheService: RedisCacheService;
  private readonly RATE_LIMIT_PREFIX = 'rate_limit:';
  private readonly DDOS_PREFIX = 'ddos:';
  private readonly BLOCK_PREFIX = 'blocked:';
  private readonly SUSPICIOUS_PREFIX = 'suspicious:';

  constructor() {
    this.cacheService = RedisCacheService.getInstance();
  }

  /**
   * Create rate limiter with enhanced features
   */
  createRateLimiter(config: RateLimitConfig) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        // Skip if skip function returns true
        if (config.skipFunction && config.skipFunction(req)) {
          return next();
        }

        // Generate key for rate limiting
        const key = config.keyGenerator ? config.keyGenerator(req) : this.getDefaultKey(req);
        const rateLimitKey = `${this.RATE_LIMIT_PREFIX}${key}`;

        // Get current rate limit info
        let rateLimitInfo = await this.cacheService.get(rateLimitKey) as RateLimitInfo;
        const now = Date.now();

        // Initialize or reset if window expired
        if (!rateLimitInfo || now > rateLimitInfo.resetTime) {
          rateLimitInfo = {
            count: 0,
            resetTime: now + config.windowMs,
            blocked: false,
            firstRequest: now,
            lastRequest: now,
            suspiciousScore: 0
          };
        }

        // Check if currently blocked
        if (rateLimitInfo.blocked && rateLimitInfo.blockExpires && now < rateLimitInfo.blockExpires) {
          this.sendRateLimitResponse(res, config, rateLimitInfo, 'BLOCKED');
          return;
        }

        // Update request info
        rateLimitInfo.count++;
        rateLimitInfo.lastRequest = now;

        // Calculate suspicious score
        rateLimitInfo.suspiciousScore = this.calculateSuspiciousScore(rateLimitInfo, req);

        // Check if limit exceeded
        if (rateLimitInfo.count > config.maxRequests) {
          // Block the key
          rateLimitInfo.blocked = true;
          rateLimitInfo.blockExpires = now + (config.windowMs * 2); // Block for 2x window time

          await this.cacheService.set(rateLimitKey, rateLimitInfo, {
            ttl: Math.ceil((rateLimitInfo.blockExpires - now) / 1000)
          });

          // Log rate limit exceeded
          logger.warn('Rate limit exceeded', {
            key,
            count: rateLimitInfo.count,
            limit: config.maxRequests,
            windowMs: config.windowMs,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            url: req.originalUrl,
            suspiciousScore: rateLimitInfo.suspiciousScore,
            service: 'rate-limit'
          });

          // Trigger callback if provided
          if (config.onLimitReached) {
            config.onLimitReached(req, res);
          }

          this.sendRateLimitResponse(res, config, rateLimitInfo, 'EXCEEDED');
          return;
        }

        // Save updated rate limit info
        await this.cacheService.set(rateLimitKey, rateLimitInfo, {
          ttl: Math.ceil((rateLimitInfo.resetTime - now) / 1000)
        });

        // Set rate limit headers
        this.setRateLimitHeaders(res, config, rateLimitInfo);

        // Check for suspicious activity
        if (rateLimitInfo.suspiciousScore > 7) {
          logger.warn('Suspicious activity detected', {
            key,
            suspiciousScore: rateLimitInfo.suspiciousScore,
            count: rateLimitInfo.count,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            service: 'rate-limit'
          });
        }

        next();
      } catch (error) {
        logger.error('Error in rate limiter:', error);
        next(); // Continue on error to avoid blocking legitimate requests
      }
    };
  }

  /**
   * DDoS protection middleware
   */
  createDDoSProtection(config: DDoSConfig) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!config.enabled) {
          return next();
        }

        const ip = req.ip || 'unknown';

        // Skip whitelisted IPs
        if (config.whitelistedIPs.includes(ip)) {
          return next();
        }

        // Check if IP is currently blocked
        const blockKey = `${this.BLOCK_PREFIX}${ip}`;
        const isBlocked = await this.cacheService.get(blockKey);

        if (isBlocked) {
          logger.warn('Blocked IP attempted access', {
            ip,
            url: req.originalUrl,
            userAgent: req.get('User-Agent'),
            service: 'ddos-protection'
          });

          res.status(429).json({
            success: false,
            code: 'IP_BLOCKED',
            message: 'Your IP address has been temporarily blocked due to suspicious activity',
            retryAfter: config.blockDuration
          });
          return;
        }

        // Analyze request patterns
        const metrics = await this.analyzeRequestPatterns(ip, req, config);

        // Check for DDoS patterns
        if (metrics.suspiciousPatterns.length > 0) {
          logger.warn('DDoS patterns detected', {
            ip,
            patterns: metrics.suspiciousPatterns,
            requestCount: metrics.requestCount,
            errorRate: metrics.errorRate,
            service: 'ddos-protection'
          });

          // Block if threshold exceeded
          if (metrics.requestCount > config.blockThreshold) {
            await this.blockIP(ip, config.blockDuration, 'DDoS attack detected');

            res.status(429).json({
              success: false,
              code: 'DDOS_DETECTED',
              message: 'DDoS attack detected. IP blocked.',
              retryAfter: config.blockDuration
            });
            return;
          }
        }

        // Mark as suspicious if threshold exceeded
        if (metrics.requestCount > config.suspiciousThreshold) {
          await this.markSuspicious(ip, metrics);
        }

        next();
      } catch (error) {
        logger.error('Error in DDoS protection:', error);
        next(); // Continue on error
      }
    };
  }

  /**
   * Adaptive rate limiting based on user behavior
   */
  createAdaptiveRateLimit(baseConfig: RateLimitConfig) {
    return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = req.user?._id?.toString();
        const ip = req.ip || 'unknown';

        // Calculate adaptive limits
        const adaptiveConfig = await this.calculateAdaptiveLimits(baseConfig, userId, ip);

        // Apply adaptive rate limiting
        const adaptiveRateLimiter = this.createRateLimiter(adaptiveConfig);
        await adaptiveRateLimiter(req, res, next);
      } catch (error) {
        logger.error('Error in adaptive rate limiter:', error);
        next();
      }
    };
  }

  /**
   * Burst protection for sudden traffic spikes
   */
  createBurstProtection(config: {
    burstLimit: number;
    burstWindow: number; // in seconds
    sustainedLimit: number;
    sustainedWindow: number; // in seconds
  }) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const key = this.getDefaultKey(req);
        const now = Date.now();

        // Check burst limit
        const burstKey = `burst:${key}`;
        const burstCount = await this.cacheService.get(burstKey) as number || 0;

        if (burstCount >= config.burstLimit) {
          res.status(429).json({
            success: false,
            code: 'BURST_LIMIT_EXCEEDED',
            message: 'Too many requests in a short time. Please slow down.',
            retryAfter: config.burstWindow
          });
          return;
        }

        // Check sustained limit
        const sustainedKey = `sustained:${key}`;
        const sustainedCount = await this.cacheService.get(sustainedKey) as number || 0;

        if (sustainedCount >= config.sustainedLimit) {
          res.status(429).json({
            success: false,
            code: 'SUSTAINED_LIMIT_EXCEEDED',
            message: 'Too many requests over time. Please wait before making more requests.',
            retryAfter: config.sustainedWindow
          });
          return;
        }

        // Update counters
        await Promise.all([
          this.cacheService.set(burstKey, burstCount + 1, { ttl: config.burstWindow }),
          this.cacheService.set(sustainedKey, sustainedCount + 1, { ttl: config.sustainedWindow })
        ]);

        next();
      } catch (error) {
        logger.error('Error in burst protection:', error);
        next();
      }
    };
  }

  /**
   * Endpoint-specific rate limiting
   */
  createEndpointRateLimit(endpointLimits: Record<string, RateLimitConfig>) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        // Find matching endpoint configuration
        let matchedConfig: RateLimitConfig | null = null;

        for (const [pattern, config] of Object.entries(endpointLimits)) {
          if (req.originalUrl.match(new RegExp(pattern))) {
            matchedConfig = config;
            break;
          }
        }

        if (!matchedConfig) {
          return next();
        }

        // Apply endpoint-specific rate limiting
        const endpointRateLimiter = this.createRateLimiter(matchedConfig);
        await endpointRateLimiter(req, res, next);
      } catch (error) {
        logger.error('Error in endpoint rate limiter:', error);
        next();
      }
    };
  }

  // Private helper methods

  private getDefaultKey(req: Request): string {
    const authReq = req as AuthRequest;
    if (authReq.user) {
      return `user:${authReq.user._id}`;
    }
    return `ip:${req.ip || 'unknown'}`;
  }

  private calculateSuspiciousScore(rateLimitInfo: RateLimitInfo, req: Request): number {
    let score = 0;

    // High request frequency
    const requestRate = rateLimitInfo.count / ((rateLimitInfo.lastRequest - rateLimitInfo.firstRequest) / 1000 || 1);
    if (requestRate > 10) score += 3;
    else if (requestRate > 5) score += 2;
    else if (requestRate > 2) score += 1;

    // Suspicious user agent patterns
    const userAgent = req.get('User-Agent') || '';
    if (userAgent.toLowerCase().includes('bot') ||
      userAgent.toLowerCase().includes('crawler') ||
      userAgent.toLowerCase().includes('spider')) {
      score += 2;
    }

    // Missing or suspicious headers
    if (!req.get('Accept')) score += 1;
    if (!req.get('Accept-Language')) score += 1;
    if (!req.get('Accept-Encoding')) score += 1;

    // Unusual request patterns
    if (req.originalUrl.includes('..') || req.originalUrl.includes('<script>')) {
      score += 5;
    }

    return Math.min(score, 10); // Cap at 10
  }

  private async analyzeRequestPatterns(ip: string, req: Request, config: DDoSConfig): Promise<DDoSMetrics> {
    const metricsKey = `${this.DDOS_PREFIX}${ip}`;
    const now = Date.now();
    const windowStart = now - (config.monitoringWindow * 1000);

    // Get existing metrics
    let metrics = await this.cacheService.get(metricsKey) as DDoSMetrics;

    if (!metrics) {
      metrics = {
        requestCount: 0,
        uniqueEndpoints: new Set(),
        errorRate: 0,
        avgResponseTime: 0,
        suspiciousPatterns: []
      };
    }

    // Update metrics
    metrics.requestCount++;
    metrics.uniqueEndpoints.add(req.originalUrl);

    // Detect suspicious patterns
    const suspiciousPatterns: string[] = [];

    // Pattern 1: Too many requests to different endpoints
    if (metrics.uniqueEndpoints.size > 50 && metrics.requestCount > 100) {
      suspiciousPatterns.push('endpoint_scanning');
    }

    // Pattern 2: Rapid requests to same endpoint
    if (req.originalUrl === req.originalUrl && metrics.requestCount > 50) {
      suspiciousPatterns.push('endpoint_flooding');
    }

    // Pattern 3: Suspicious user agent
    const userAgent = req.get('User-Agent') || '';
    if (!userAgent || userAgent.length < 10 || userAgent.includes('bot')) {
      suspiciousPatterns.push('suspicious_user_agent');
    }

    // Pattern 4: Missing common headers
    if (!req.get('Accept') || !req.get('Accept-Language')) {
      suspiciousPatterns.push('missing_headers');
    }

    // Pattern 5: Malicious payloads
    const payload = JSON.stringify(req.body) + req.originalUrl + JSON.stringify(req.query);
    if (payload.includes('<script>') || payload.includes('SELECT') || payload.includes('DROP')) {
      suspiciousPatterns.push('malicious_payload');
    }

    metrics.suspiciousPatterns = suspiciousPatterns;

    // Save updated metrics
    await this.cacheService.set(metricsKey, metrics, { ttl: config.monitoringWindow });

    return metrics;
  }

  private async blockIP(ip: string, duration: number, reason: string): Promise<void> {
    const blockKey = `${this.BLOCK_PREFIX}${ip}`;
    await this.cacheService.set(blockKey, { reason, blockedAt: Date.now() }, { ttl: duration });

    logger.warn('IP blocked', {
      ip,
      duration,
      reason,
      service: 'ddos-protection'
    });
  }

  private async markSuspicious(ip: string, metrics: DDoSMetrics): Promise<void> {
    const suspiciousKey = `${this.SUSPICIOUS_PREFIX}${ip}`;
    await this.cacheService.set(suspiciousKey, metrics, { ttl: 3600 }); // 1 hour

    logger.info('IP marked as suspicious', {
      ip,
      requestCount: metrics.requestCount,
      patterns: metrics.suspiciousPatterns,
      service: 'ddos-protection'
    });
  }

  private async calculateAdaptiveLimits(
    baseConfig: RateLimitConfig,
    userId?: string,
    ip?: string
  ): Promise<RateLimitConfig> {
    let multiplier = 1;

    // Check user reputation if authenticated
    if (userId) {
      const userReputationKey = `reputation:user:${userId}`;
      const reputation = await this.cacheService.get(userReputationKey) as number || 5; // Default neutral

      if (reputation > 8) multiplier = 2; // Good user, higher limits
      else if (reputation < 3) multiplier = 0.5; // Bad user, lower limits
    }

    // Check IP reputation
    if (ip) {
      const ipReputationKey = `reputation:ip:${ip}`;
      const ipReputation = await this.cacheService.get(ipReputationKey) as number || 5;

      if (ipReputation < 3) multiplier *= 0.5; // Bad IP, further reduce limits
    }

    return {
      ...baseConfig,
      maxRequests: Math.floor(baseConfig.maxRequests * multiplier)
    };
  }

  private sendRateLimitResponse(
    res: Response,
    config: RateLimitConfig,
    rateLimitInfo: RateLimitInfo,
    type: 'EXCEEDED' | 'BLOCKED'
  ): void {
    const retryAfter = Math.ceil((rateLimitInfo.resetTime - Date.now()) / 1000);

    res.set('Retry-After', retryAfter.toString());
    this.setRateLimitHeaders(res, config, rateLimitInfo);

    const statusCode = type === 'BLOCKED' ? 429 : 429;
    const code = type === 'BLOCKED' ? 'IP_BLOCKED' : 'RATE_LIMIT_EXCEEDED';

    res.status(statusCode).json({
      success: false,
      code,
      message: config.message || 'Too many requests. Please try again later.',
      retryAfter,
      limit: config.maxRequests,
      windowMs: config.windowMs
    });
  }

  private setRateLimitHeaders(res: Response, config: RateLimitConfig, rateLimitInfo: RateLimitInfo): void {
    res.set('X-RateLimit-Limit', config.maxRequests.toString());
    res.set('X-RateLimit-Remaining', Math.max(0, config.maxRequests - rateLimitInfo.count).toString());
    res.set('X-RateLimit-Reset', new Date(rateLimitInfo.resetTime).toISOString());
    res.set('X-RateLimit-Window', config.windowMs.toString());
  }
}

// Create singleton instance
const enhancedRateLimit = new EnhancedRateLimit();

// Predefined rate limiters for common use cases
export const rateLimiters = {
  // General API rate limiting
  api: enhancedRateLimit.createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000,
    message: 'Too many API requests. Please try again later.',
    skipSuccessfulRequests: false
  }),

  // Authentication endpoints
  auth: enhancedRateLimit.createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10,
    message: 'Too many authentication attempts. Please try again later.',
    skipSuccessfulRequests: true
  }),

  // Admin operations
  admin: enhancedRateLimit.createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 100,
    message: 'Too many admin operations. Please try again later.',
    skipFunction: (req) => {
      const authReq = req as AuthRequest;
      return authReq.user?.role === 'super_admin';
    }
  }),

  // File uploads
  upload: enhancedRateLimit.createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 20,
    message: 'Too many file uploads. Please try again later.'
  }),

  // Password reset
  passwordReset: enhancedRateLimit.createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
    message: 'Too many password reset attempts. Please try again later.'
  })
};

// DDoS protection configuration
export const ddosProtection = enhancedRateLimit.createDDoSProtection({
  enabled: true,
  suspiciousThreshold: 100,
  blockThreshold: 500,
  blockDuration: 3600, // 1 hour
  whitelistedIPs: ['127.0.0.1', '::1'],
  monitoringWindow: 300 // 5 minutes
});

// Burst protection
export const burstProtection = enhancedRateLimit.createBurstProtection({
  burstLimit: 20,
  burstWindow: 60, // 1 minute
  sustainedLimit: 100,
  sustainedWindow: 3600 // 1 hour
});

// Adaptive rate limiting
export const adaptiveRateLimit = enhancedRateLimit.createAdaptiveRateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 100,
  message: 'Rate limit exceeded based on your usage pattern.'
});

// Endpoint-specific rate limits
export const endpointRateLimit = enhancedRateLimit.createEndpointRateLimit({
  '/api/auth/.*': {
    windowMs: 15 * 60 * 1000,
    maxRequests: 10,
    message: 'Too many authentication requests.'
  },
  '/api/admin/.*': {
    windowMs: 60 * 60 * 1000,
    maxRequests: 50,
    message: 'Too many admin requests.'
  },
  '/api/upload/.*': {
    windowMs: 60 * 60 * 1000,
    maxRequests: 10,
    message: 'Too many upload requests.'
  }
});

export { EnhancedRateLimit };

export default {
  rateLimiters,
  ddosProtection,
  burstProtection,
  adaptiveRateLimit,
  endpointRateLimit,
  EnhancedRateLimit
};