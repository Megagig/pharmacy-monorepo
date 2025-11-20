import { Request, Response, NextFunction } from 'express';
import ApiManagementService from '../services/ApiManagementService';
import { IApiKey } from '../models/ApiKey';

// Extend Request interface to include apiKey
declare global {
  namespace Express {
    interface Request {
      apiKey?: IApiKey;
    }
  }
}

/**
 * Middleware to authenticate API keys
 */
export const authenticateApiKey = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const apiKeyHeader = req.headers['x-api-key'] as string;
    
    if (!apiKeyHeader) {
      res.status(401).json({
        success: false,
        error: {
          code: 'API_KEY_MISSING',
          message: 'API key is required'
        }
      });
      return;
    }

    const apiKey = await ApiManagementService.validateApiKey(apiKeyHeader);
    
    if (!apiKey) {
      res.status(401).json({
        success: false,
        error: {
          code: 'API_KEY_INVALID',
          message: 'Invalid or expired API key'
        }
      });
      return;
    }

    // Check if API key is rate limited
    if (apiKey.isRateLimited()) {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'API key rate limit exceeded'
        }
      });
      return;
    }

    // Check IP restrictions
    if (apiKey.allowedIPs.length > 0) {
      const clientIP = req.ip || req.connection.remoteAddress || '';
      if (!apiKey.allowedIPs.includes(clientIP)) {
        res.status(403).json({
          success: false,
          error: {
            code: 'IP_NOT_ALLOWED',
            message: 'Request from unauthorized IP address'
          }
        });
        return;
      }
    }

    // Check domain restrictions
    if (apiKey.allowedDomains.length > 0) {
      const origin = req.headers.origin || req.headers.referer || '';
      const domain = new URL(origin).hostname;
      if (!apiKey.allowedDomains.includes(domain)) {
        res.status(403).json({
          success: false,
          error: {
            code: 'DOMAIN_NOT_ALLOWED',
            message: 'Request from unauthorized domain'
          }
        });
        return;
      }
    }

    req.apiKey = apiKey;
    next();
  } catch (error) {
    console.error('API key authentication error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Authentication failed'
      }
    });
  }
};

/**
 * Middleware to check API key scopes
 */
export const requireScope = (requiredScope: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.apiKey) {
      res.status(401).json({
        success: false,
        error: {
          code: 'API_KEY_MISSING',
          message: 'API key authentication required'
        }
      });
      return;
    }

    if (!req.apiKey.scopes.includes(requiredScope) && !req.apiKey.scopes.includes('*')) {
      res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_SCOPE',
          message: `Required scope: ${requiredScope}`
        }
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to log API usage
 */
export const logApiUsage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const startTime = Date.now();
  
  // Override res.json to capture response data
  const originalJson = res.json;
  let responseSize = 0;
  
  res.json = function(body: any) {
    responseSize = JSON.stringify(body).length;
    return originalJson.call(this, body);
  };

  // Continue with the request
  res.on('finish', async () => {
    try {
      const responseTime = Date.now() - startTime;
      const requestSize = req.headers['content-length'] ? 
        parseInt(req.headers['content-length'] as string) : 0;

      await ApiManagementService.recordUsage({
        endpoint: req.route?.path || req.path,
        method: req.method,
        version: 'v1', // Could be extracted from headers or path
        userId: req.user?.id,
        apiKeyId: req.apiKey?.keyId,
        timestamp: new Date(),
        responseTime,
        statusCode: res.statusCode,
        requestSize,
        responseSize,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip || req.connection.remoteAddress || '',
        errorMessage: res.statusCode >= 400 ? 'Request failed' : undefined,
        metadata: {
          query: req.query,
          params: req.params
        }
      });
    } catch (error) {
      console.error('Error logging API usage:', error);
      // Don't fail the request if logging fails
    }
  });

  next();
};

/**
 * Rate limiting middleware for API endpoints
 */
export const rateLimitByEndpoint = (
  requests: number = 100,
  windowSeconds: number = 3600
) => {
  const requestCounts = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = `${req.ip}:${req.route?.path || req.path}`;
    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    const current = requestCounts.get(key);
    
    if (!current || now > current.resetTime) {
      requestCounts.set(key, {
        count: 1,
        resetTime: now + windowMs
      });
      next();
      return;
    }

    if (current.count >= requests) {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests',
          retryAfter: Math.ceil((current.resetTime - now) / 1000)
        }
      });
      return;
    }

    current.count++;
    next();
  };
};