/**
 * Performance Optimization Middleware for Patient Engagement
 * Automatically applies caching, pagination, and query optimization
 * Requirements: 8.1, 8.2, 8.3, 8.4, 9.1
 */

import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';
import PatientEngagementPerformanceService from '../services/PatientEngagementPerformanceService';
import logger from '../utils/logger';

export interface PerformanceConfig {
  enableCaching?: boolean;
  cacheTTL?: number;
  enablePagination?: boolean;
  defaultLimit?: number;
  maxLimit?: number;
  enableQueryOptimization?: boolean;
  enableMetrics?: boolean;
}

export interface OptimizedRequest extends Request {
  performance?: {
    startTime: number;
    cacheEnabled: boolean;
    paginationApplied: boolean;
    queryOptimized: boolean;
  };
  pagination?: {
    page: number;
    limit: number;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    useCursor: boolean;
    cursor?: string;
  };
  cacheOptions?: {
    useCache: boolean;
    ttl: number;
    tags: string[];
    cacheKey?: string;
  };
}

/**
 * Performance optimization middleware factory
 */
export function createPerformanceMiddleware(config: PerformanceConfig = {}) {
  const {
    enableCaching = true,
    cacheTTL = 300,
    enablePagination = true,
    defaultLimit = 50,
    maxLimit = 1000,
    enableQueryOptimization = true,
    enableMetrics = true,
  } = config;

  return (req: OptimizedRequest, res: Response, next: NextFunction) => {
    const startTime = performance.now();

    // Initialize performance tracking
    req.performance = {
      startTime,
      cacheEnabled: enableCaching,
      paginationApplied: false,
      queryOptimized: false,
    };

    // Apply pagination optimization
    if (enablePagination) {
      req.pagination = extractPaginationParams(req, defaultLimit, maxLimit);
      req.performance.paginationApplied = true;
    }

    // Apply caching optimization
    if (enableCaching) {
      req.cacheOptions = extractCacheOptions(req, cacheTTL);
    }

    // Apply query optimization
    if (enableQueryOptimization) {
      optimizeQueryParams(req);
      req.performance.queryOptimized = true;
    }

    // Add performance metrics to response
    if (enableMetrics) {
      const originalSend = res.send;
      res.send = function (data: any) {
        const endTime = performance.now();
        const totalTime = endTime - startTime;

        // Add performance headers
        res.setHeader('X-Performance-Time', totalTime.toFixed(2));
        res.setHeader('X-Cache-Enabled', req.performance?.cacheEnabled ? 'true' : 'false');
        res.setHeader('X-Pagination-Applied', req.performance?.paginationApplied ? 'true' : 'false');
        res.setHeader('X-Query-Optimized', req.performance?.queryOptimized ? 'true' : 'false');

        // Log slow requests
        if (totalTime > 1000) {
          logger.warn('Slow request detected', {
            method: req.method,
            url: req.url,
            duration: totalTime,
            userAgent: req.get('User-Agent'),
          });
        }

        return originalSend.call(this, data);
      };
    }

    next();
  };
}

/**
 * Caching middleware for specific endpoints
 */
export function cacheMiddleware(options: {
  ttl?: number;
  tags?: string[];
  keyGenerator?: (req: Request) => string;
  condition?: (req: Request) => boolean;
} = {}) {
  const performanceService = require('../services/PatientEngagementPerformanceService').default;

  return async (req: OptimizedRequest, res: Response, next: NextFunction) => {
    try {
      // Check if caching should be applied
      if (options.condition && !options.condition(req)) {
        return next();
      }

      // Only cache GET requests
      if (req.method !== 'GET') {
        return next();
      }

      // Generate cache key
      const cacheKey = options.keyGenerator 
        ? options.keyGenerator(req)
        : generateDefaultCacheKey(req);

      // Try to get from cache
      const cached = await performanceService.cache.getCachedApiResponse(cacheKey);
      if (cached) {
        res.setHeader('X-Cache-Hit', 'true');
        res.setHeader('X-Cache-Key', cacheKey);
        return res.json(cached);
      }

      // Store original send method
      const originalSend = res.send;
      res.send = function (data: any) {
        // Cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
          
          performanceService.cache.cacheApiResponse(cacheKey, parsedData, {
            ttl: options.ttl || 300,
            tags: options.tags || ['api'],
          }).catch(error => {
            logger.error('Failed to cache response', {
              error: error.message,
              cacheKey,
            });
          });
        }

        res.setHeader('X-Cache-Hit', 'false');
        res.setHeader('X-Cache-Key', cacheKey);
        return originalSend.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        url: req.url,
      });
      next(); // Continue without caching on error
    }
  };
}

/**
 * Query optimization middleware
 */
export function queryOptimizationMiddleware() {
  return (req: OptimizedRequest, res: Response, next: NextFunction) => {
    try {
      // Optimize date queries
      optimizeDateQueries(req);

      // Optimize array queries
      optimizeArrayQueries(req);

      // Optimize boolean queries
      optimizeBooleanQueries(req);

      // Add query hints for database
      addQueryHints(req);

      next();
    } catch (error) {
      logger.error('Query optimization middleware error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        url: req.url,
      });
      next(); // Continue without optimization on error
    }
  };
}

/**
 * Pagination middleware
 */
export function paginationMiddleware(options: {
  defaultLimit?: number;
  maxLimit?: number;
  enableCursor?: boolean;
} = {}) {
  const {
    defaultLimit = 50,
    maxLimit = 1000,
    enableCursor = true,
  } = options;

  return (req: OptimizedRequest, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      let limit = parseInt(req.query.limit as string) || defaultLimit;
      
      // Enforce max limit
      limit = Math.min(limit, maxLimit);

      const sortBy = (req.query.sortBy as string) || 'createdAt';
      const sortOrder = (req.query.sortOrder as string) === 'desc' ? 'desc' : 'asc';
      const cursor = req.query.cursor as string;

      // Use cursor pagination for large datasets
      const useCursor = enableCursor && (limit > 100 || !!cursor);

      req.pagination = {
        page,
        limit,
        sortBy,
        sortOrder,
        useCursor,
        cursor,
      };

      // Add pagination info to response
      const originalSend = res.send;
      res.send = function (data: any) {
        res.setHeader('X-Pagination-Page', page.toString());
        res.setHeader('X-Pagination-Limit', limit.toString());
        res.setHeader('X-Pagination-Sort', `${sortBy}:${sortOrder}`);
        res.setHeader('X-Pagination-Type', useCursor ? 'cursor' : 'offset');

        return originalSend.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('Pagination middleware error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        url: req.url,
      });
      next(); // Continue without pagination on error
    }
  };
}

/**
 * Connection pooling middleware
 */
export function connectionPoolMiddleware() {
  return (req: OptimizedRequest, res: Response, next: NextFunction) => {
    // Determine preferred connection type based on request
    let preferredType: 'read' | 'write' | 'analytics' | undefined;

    if (req.method === 'GET') {
      // Check if it's an analytics request
      if (req.url.includes('/analytics') || req.url.includes('/reports')) {
        preferredType = 'analytics';
      } else {
        preferredType = 'read';
      }
    } else if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      preferredType = 'write';
    }

    // Add connection preference to request
    (req as any).connectionPreference = preferredType;

    next();
  };
}

/**
 * Rate limiting middleware for performance protection
 */
export function performanceRateLimitMiddleware(options: {
  windowMs?: number;
  maxRequests?: number;
  skipSuccessfulRequests?: boolean;
} = {}) {
  const {
    windowMs = 60000, // 1 minute
    maxRequests = 100,
    skipSuccessfulRequests = true,
  } = options;

  const requestCounts = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const clientId = req.ip || 'unknown';
    const now = Date.now();

    // Clean up expired entries
    for (const [key, value] of requestCounts.entries()) {
      if (now > value.resetTime) {
        requestCounts.delete(key);
      }
    }

    // Get or create client record
    let clientRecord = requestCounts.get(clientId);
    if (!clientRecord || now > clientRecord.resetTime) {
      clientRecord = {
        count: 0,
        resetTime: now + windowMs,
      };
      requestCounts.set(clientId, clientRecord);
    }

    // Check rate limit
    if (clientRecord.count >= maxRequests) {
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', clientRecord.resetTime.toString());
      
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil((clientRecord.resetTime - now) / 1000),
      });
    }

    // Increment counter
    clientRecord.count++;

    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', (maxRequests - clientRecord.count).toString());
    res.setHeader('X-RateLimit-Reset', clientRecord.resetTime.toString());

    // Skip counting successful requests if configured
    if (skipSuccessfulRequests) {
      const originalSend = res.send;
      res.send = function (data: any) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          clientRecord!.count--;
        }
        return originalSend.call(this, data);
      };
    }

    next();
  };
}

// Helper functions

function extractPaginationParams(
  req: Request,
  defaultLimit: number,
  maxLimit: number
): OptimizedRequest['pagination'] {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  let limit = parseInt(req.query.limit as string) || defaultLimit;
  limit = Math.min(Math.max(1, limit), maxLimit);

  const sortBy = (req.query.sortBy as string) || 'createdAt';
  const sortOrder = (req.query.sortOrder as string) === 'desc' ? 'desc' : 'asc';
  const cursor = req.query.cursor as string;
  const useCursor = Boolean(cursor) || limit > 100;

  return {
    page,
    limit,
    sortBy,
    sortOrder,
    useCursor,
    cursor,
  };
}

function extractCacheOptions(req: Request, defaultTTL: number): OptimizedRequest['cacheOptions'] {
  const useCache = req.query.cache !== 'false' && req.method === 'GET';
  const ttl = parseInt(req.query.cacheTTL as string) || defaultTTL;
  
  // Generate tags based on URL
  const tags: string[] = ['api'];
  if (req.url.includes('/appointments')) tags.push('appointments');
  if (req.url.includes('/follow-ups')) tags.push('followups');
  if (req.url.includes('/calendar')) tags.push('calendar');
  if (req.url.includes('/analytics')) tags.push('analytics');

  return {
    useCache,
    ttl,
    tags,
  };
}

function optimizeQueryParams(req: Request): void {
  // Convert string arrays to actual arrays
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === 'string' && value.includes(',')) {
      req.query[key] = value.split(',').map(v => v.trim());
    }
  }

  // Optimize date queries
  optimizeDateQueries(req);
  
  // Optimize boolean queries
  optimizeBooleanQueries(req);
}

function optimizeDateQueries(req: Request): void {
  const dateFields = ['startDate', 'endDate', 'date', 'scheduledDate', 'dueDate'];
  
  for (const field of dateFields) {
    const value = req.query[field];
    if (value && typeof value === 'string') {
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          req.query[field] = date.toISOString();
        }
      } catch (error) {
        // Invalid date, remove from query
        delete req.query[field];
      }
    }
  }
}

function optimizeArrayQueries(req: Request): void {
  const arrayFields = ['status', 'type', 'priority', 'assignedTo'];
  
  for (const field of arrayFields) {
    const value = req.query[field];
    if (typeof value === 'string' && value.includes(',')) {
      req.query[field] = value.split(',').map(v => v.trim()).filter(v => v.length > 0);
    }
  }
}

function optimizeBooleanQueries(req: Request): void {
  const booleanFields = ['isRecurring', 'overdue', 'isActive'];
  
  for (const field of booleanFields) {
    const value = req.query[field];
    if (typeof value === 'string') {
      (req.query as any)[field] = value.toLowerCase() === 'true';
    }
  }
}

function addQueryHints(req: Request): void {
  // Add query hints for database optimization
  (req as any).queryHints = {
    useIndex: true,
    allowDiskUse: req.url.includes('/analytics'),
    maxTimeMS: req.url.includes('/analytics') ? 30000 : 5000,
  };
}

function generateDefaultCacheKey(req: Request): string {
  const crypto = require('crypto');
  const keyData = {
    url: req.url,
    query: req.query,
    method: req.method,
    workplaceId: (req as any).user?.workplaceId,
  };
  
  const keyString = JSON.stringify(keyData, Object.keys(keyData).sort());
  return crypto.createHash('md5').update(keyString).digest('hex');
}

// Export middleware combinations for common use cases

export const appointmentPerformanceMiddleware = [
  createPerformanceMiddleware({
    enableCaching: true,
    cacheTTL: 300,
    enablePagination: true,
    defaultLimit: 50,
    maxLimit: 500,
  }),
  queryOptimizationMiddleware(),
  connectionPoolMiddleware(),
];

export const followUpPerformanceMiddleware = [
  createPerformanceMiddleware({
    enableCaching: true,
    cacheTTL: 180,
    enablePagination: true,
    defaultLimit: 50,
    maxLimit: 500,
  }),
  queryOptimizationMiddleware(),
  connectionPoolMiddleware(),
];

export const calendarPerformanceMiddleware = [
  createPerformanceMiddleware({
    enableCaching: true,
    cacheTTL: 600,
    enablePagination: false,
  }),
  cacheMiddleware({
    ttl: 600,
    tags: ['calendar'],
    condition: (req) => req.method === 'GET',
  }),
  connectionPoolMiddleware(),
];

export const analyticsPerformanceMiddleware = [
  createPerformanceMiddleware({
    enableCaching: true,
    cacheTTL: 900,
    enablePagination: false,
  }),
  cacheMiddleware({
    ttl: 900,
    tags: ['analytics'],
    condition: (req) => req.method === 'GET',
  }),
  connectionPoolMiddleware(),
  performanceRateLimitMiddleware({
    windowMs: 60000,
    maxRequests: 20, // Lower limit for expensive analytics queries
  }),
];