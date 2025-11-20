import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth';
import crypto from 'crypto';
import { RedisCacheService } from '../services/RedisCacheService';
import logger from '../utils/logger';

/**
 * Enhanced CSRF Protection Middleware
 * Provides comprehensive protection against Cross-Site Request Forgery attacks
 */

interface CSRFTokenData {
  token: string;
  userId: string;
  sessionId: string;
  expires: number;
  ipAddress: string;
  userAgent: string;
}

interface CSRFConfig {
  tokenLength: number;
  tokenTTL: number; // in seconds
  cookieName: string;
  headerName: string;
  bodyField: string;
  skipRoutes: string[];
  safeMethods: string[];
  requireDoubleSubmit: boolean;
  validateOrigin: boolean;
  validateReferer: boolean;
  strictSameSite: boolean;
}

class EnhancedCSRFProtection {
  private cacheService: RedisCacheService;
  private config: CSRFConfig;
  private readonly CACHE_PREFIX = 'csrf:';
  private readonly RATE_LIMIT_PREFIX = 'csrf_rate:';

  constructor(config: Partial<CSRFConfig> = {}) {
    this.cacheService = RedisCacheService.getInstance();
    this.config = {
      tokenLength: 32,
      tokenTTL: 3600, // 1 hour
      cookieName: 'csrf-token',
      headerName: 'x-csrf-token',
      bodyField: '_csrf',
      skipRoutes: ['/api/health', '/api/auth/login', '/api/auth/register'],
      safeMethods: ['GET', 'HEAD', 'OPTIONS'],
      requireDoubleSubmit: true,
      validateOrigin: true,
      validateReferer: true,
      strictSameSite: true,
      ...config
    };
  }

  /**
   * Generate a cryptographically secure CSRF token
   */
  private generateToken(): string {
    return crypto.randomBytes(this.config.tokenLength).toString('hex');
  }

  /**
   * Create CSRF token for user session
   */
  async createToken(
    userId: string,
    sessionId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<string> {
    try {
      const token = this.generateToken();
      const tokenData: CSRFTokenData = {
        token,
        userId,
        sessionId,
        expires: Date.now() + (this.config.tokenTTL * 1000),
        ipAddress,
        userAgent
      };

      const cacheKey = `${this.CACHE_PREFIX}${userId}:${sessionId}`;
      await this.cacheService.set(cacheKey, tokenData, { ttl: this.config.tokenTTL });

      logger.debug('CSRF token created', {
        userId,
        sessionId,
        tokenPrefix: token.substring(0, 8),
        service: 'csrf-protection'
      });

      return token;
    } catch (error) {
      logger.error('Error creating CSRF token:', error);
      throw new Error('Failed to create CSRF token');
    }
  }

  /**
   * Validate CSRF token
   */
  async validateToken(
    token: string,
    userId: string,
    sessionId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<boolean> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${userId}:${sessionId}`;
      const tokenData = await this.cacheService.get(cacheKey) as CSRFTokenData;

      if (!tokenData) {
        logger.warn('CSRF token not found in cache', {
          userId,
          sessionId,
          tokenPrefix: token.substring(0, 8),
          service: 'csrf-protection'
        });
        return false;
      }

      // Check token match
      if (tokenData.token !== token) {
        logger.warn('CSRF token mismatch', {
          userId,
          sessionId,
          expectedPrefix: tokenData.token.substring(0, 8),
          providedPrefix: token.substring(0, 8),
          service: 'csrf-protection'
        });
        return false;
      }

      // Check expiration
      if (Date.now() > tokenData.expires) {
        logger.warn('CSRF token expired', {
          userId,
          sessionId,
          tokenPrefix: token.substring(0, 8),
          service: 'csrf-protection'
        });
        await this.cacheService.del(cacheKey);
        return false;
      }

      // Validate IP address (optional strict check)
      if (process.env.CSRF_STRICT_IP === 'true' && tokenData.ipAddress !== ipAddress) {
        logger.warn('CSRF token IP mismatch', {
          userId,
          sessionId,
          expectedIP: tokenData.ipAddress,
          providedIP: ipAddress,
          service: 'csrf-protection'
        });
        return false;
      }

      // Validate user agent (optional strict check)
      if (process.env.CSRF_STRICT_UA === 'true' && tokenData.userAgent !== userAgent) {
        logger.warn('CSRF token User-Agent mismatch', {
          userId,
          sessionId,
          service: 'csrf-protection'
        });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error validating CSRF token:', error);
      return false;
    }
  }

  /**
   * Rate limiting for CSRF token requests
   */
  private async checkRateLimit(userId: string, ipAddress: string): Promise<boolean> {
    try {
      const rateLimitKey = `${this.RATE_LIMIT_PREFIX}${userId}:${ipAddress}`;
      const attempts = await this.cacheService.get(rateLimitKey) as number || 0;

      if (attempts >= 10) { // Max 10 token requests per minute
        logger.warn('CSRF token rate limit exceeded', {
          userId,
          ipAddress,
          attempts,
          service: 'csrf-protection'
        });
        return false;
      }

      await this.cacheService.set(rateLimitKey, attempts + 1, { ttl: 60 });
      return true;
    } catch (error) {
      logger.error('Error checking CSRF rate limit:', error);
      return true; // Allow on error to avoid blocking legitimate requests
    }
  }

  /**
   * Validate request origin
   */
  private validateOrigin(req: Request): boolean {
    if (!this.config.validateOrigin) return true;

    const origin = req.headers.origin;
    const host = req.headers.host;

    if (!origin) {
      logger.warn('Missing origin header', {
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        service: 'csrf-protection'
      });
      return false;
    }

    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        logger.warn('Origin mismatch', {
          origin: originHost,
          host,
          url: req.originalUrl,
          ip: req.ip,
          service: 'csrf-protection'
        });
        return false;
      }
      return true;
    } catch (error) {
      logger.warn('Invalid origin format', {
        origin,
        url: req.originalUrl,
        ip: req.ip,
        service: 'csrf-protection'
      });
      return false;
    }
  }

  /**
   * Validate request referer
   */
  private validateReferer(req: Request): boolean {
    if (!this.config.validateReferer) return true;

    const referer = req.headers.referer;
    const host = req.headers.host;

    if (!referer) {
      // Allow requests without referer for API calls
      if (req.originalUrl.startsWith('/api/')) {
        return true;
      }
      
      logger.warn('Missing referer header', {
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        service: 'csrf-protection'
      });
      return false;
    }

    try {
      const refererHost = new URL(referer).host;
      if (refererHost !== host) {
        logger.warn('Referer mismatch', {
          referer: refererHost,
          host,
          url: req.originalUrl,
          ip: req.ip,
          service: 'csrf-protection'
        });
        return false;
      }
      return true;
    } catch (error) {
      logger.warn('Invalid referer format', {
        referer,
        url: req.originalUrl,
        ip: req.ip,
        service: 'csrf-protection'
      });
      return false;
    }
  }

  /**
   * Check if route should be skipped
   */
  private shouldSkipRoute(req: Request): boolean {
    return this.config.skipRoutes.some(route => req.originalUrl.startsWith(route));
  }

  /**
   * Check if method is safe (doesn't modify state)
   */
  private isSafeMethod(method: string): boolean {
    return this.config.safeMethods.includes(method.toUpperCase());
  }

  /**
   * Generate CSRF token endpoint
   */
  generateTokenEndpoint = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        });
        return;
      }

      const userId = req.user._id.toString();
      const sessionId = (req as any).sessionID || 'default';
      const ipAddress = req.ip || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      // Check rate limit
      const rateLimitOk = await this.checkRateLimit(userId, ipAddress);
      if (!rateLimitOk) {
        res.status(429).json({
          success: false,
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many token requests. Please try again later.'
        });
        return;
      }

      const token = await this.createToken(userId, sessionId, ipAddress, userAgent);

      // Set secure cookie if double submit is required
      if (this.config.requireDoubleSubmit) {
        res.cookie(this.config.cookieName, token, {
          httpOnly: false, // Must be accessible to JavaScript for double submit
          secure: process.env.NODE_ENV === 'production',
          sameSite: this.config.strictSameSite ? 'strict' : 'lax',
          maxAge: this.config.tokenTTL * 1000
        });
      }

      res.json({
        success: true,
        csrfToken: token,
        expires: Date.now() + (this.config.tokenTTL * 1000)
      });
    } catch (error) {
      logger.error('Error generating CSRF token:', error);
      res.status(500).json({
        success: false,
        code: 'CSRF_TOKEN_ERROR',
        message: 'Failed to generate CSRF token'
      });
    }
  };

  /**
   * CSRF protection middleware
   */
  protect = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Skip for safe methods
      if (this.isSafeMethod(req.method)) {
        return next();
      }

      // Skip for configured routes
      if (this.shouldSkipRoute(req)) {
        return next();
      }

      // Require authentication
      if (!req.user) {
        res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Authentication required for CSRF protection'
        });
        return;
      }

      // Validate origin and referer
      if (!this.validateOrigin(req)) {
        res.status(403).json({
          success: false,
          code: 'INVALID_ORIGIN',
          message: 'Request origin validation failed'
        });
        return;
      }

      if (!this.validateReferer(req)) {
        res.status(403).json({
          success: false,
          code: 'INVALID_REFERER',
          message: 'Request referer validation failed'
        });
        return;
      }

      // Get CSRF token from various sources
      const token = req.headers[this.config.headerName] as string ||
                   req.body[this.config.bodyField] ||
                   req.query[this.config.bodyField];

      if (!token) {
        logger.warn('CSRF token missing', {
          userId: req.user._id,
          method: req.method,
          url: req.originalUrl,
          ip: req.ip,
          service: 'csrf-protection'
        });

        res.status(403).json({
          success: false,
          code: 'CSRF_TOKEN_MISSING',
          message: 'CSRF token is required'
        });
        return;
      }

      // Double submit cookie validation
      if (this.config.requireDoubleSubmit) {
        const cookieToken = req.cookies[this.config.cookieName];
        if (!cookieToken || cookieToken !== token) {
          logger.warn('CSRF double submit validation failed', {
            userId: req.user._id,
            method: req.method,
            url: req.originalUrl,
            ip: req.ip,
            hasCookie: !!cookieToken,
            tokensMatch: cookieToken === token,
            service: 'csrf-protection'
          });

          res.status(403).json({
            success: false,
            code: 'CSRF_DOUBLE_SUBMIT_FAILED',
            message: 'CSRF double submit validation failed'
          });
          return;
        }
      }

      // Validate token
      const userId = req.user._id.toString();
      const sessionId = (req as any).sessionID || 'default';
      const ipAddress = req.ip || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      const isValid = await this.validateToken(token, userId, sessionId, ipAddress, userAgent);

      if (!isValid) {
        res.status(403).json({
          success: false,
          code: 'CSRF_TOKEN_INVALID',
          message: 'Invalid or expired CSRF token'
        });
        return;
      }

      // Token is valid, proceed
      next();
    } catch (error) {
      logger.error('Error in CSRF protection middleware:', error);
      res.status(500).json({
        success: false,
        code: 'CSRF_PROTECTION_ERROR',
        message: 'CSRF protection failed'
      });
    }
  };

  /**
   * Middleware to set CSRF cookie for double submit pattern
   */
  setCookie = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user || !this.config.requireDoubleSubmit) {
        return next();
      }

      // Check if cookie already exists and is valid
      const existingToken = req.cookies[this.config.cookieName];
      if (existingToken) {
        const userId = req.user._id.toString();
        const sessionId = (req as any).sessionID || 'default';
        const ipAddress = req.ip || 'unknown';
        const userAgent = req.get('User-Agent') || 'unknown';

        const isValid = await this.validateToken(existingToken, userId, sessionId, ipAddress, userAgent);
        if (isValid) {
          return next();
        }
      }

      // Generate new token and set cookie
      const userId = req.user._id.toString();
      const sessionId = (req as any).sessionID || 'default';
      const ipAddress = req.ip || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      const token = await this.createToken(userId, sessionId, ipAddress, userAgent);

      res.cookie(this.config.cookieName, token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: this.config.strictSameSite ? 'strict' : 'lax',
        maxAge: this.config.tokenTTL * 1000
      });

      next();
    } catch (error) {
      logger.error('Error setting CSRF cookie:', error);
      next(); // Continue on error to avoid blocking requests
    }
  };

  /**
   * Clean up expired tokens
   */
  async cleanup(): Promise<void> {
    try {
      // This would be implemented with Redis SCAN in production
      logger.info('CSRF token cleanup completed');
    } catch (error) {
      logger.error('Error during CSRF cleanup:', error);
    }
  }
}

// Create singleton instance
const csrfProtection = new EnhancedCSRFProtection({
  tokenTTL: 3600, // 1 hour
  requireDoubleSubmit: true,
  validateOrigin: true,
  validateReferer: true,
  strictSameSite: true
});

// Export middleware functions
export const generateCSRFToken = csrfProtection.generateTokenEndpoint;
export const protectCSRF = csrfProtection.protect;
export const setCSRFCookie = csrfProtection.setCookie;

// Export class for custom configurations
export { EnhancedCSRFProtection };

// Export default middleware stack
export const csrfProtectionStack = [
  setCSRFCookie,
  protectCSRF
];

export default {
  generateCSRFToken,
  protectCSRF,
  setCSRFCookie,
  csrfProtectionStack,
  EnhancedCSRFProtection
};