import { Request, Response, NextFunction } from 'express';
import PerformanceCacheService from '../services/PerformanceCacheService';
import logger from '../utils/logger';
import { AuthRequest } from '../types/auth';

export interface CacheMiddlewareOptions {
  ttl?: number; // Time to live in seconds
  keyGenerator?: (req: AuthRequest) => string; // Custom key generator
  condition?: (req: AuthRequest) => boolean; // Condition to cache
  tags?: string[] | ((req: AuthRequest) => string[]); // Cache tags
  varyBy?: string[]; // Headers/params to vary cache by
  skipCache?: (req: AuthRequest) => boolean; // Skip cache condition
}

/**
 * Cache middleware for API endpoints
 * Provides automatic caching of API responses with configurable options
 */
export const cacheMiddleware = (options: CacheMiddlewareOptions = {}) => {
  const cacheService = PerformanceCacheService.getInstance();

  const {
    ttl = 300, // 5 minutes default
    keyGenerator,
    condition,
    tags = [],
    varyBy = [],
    skipCache,
  } = options;

  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    // Skip caching for non-GET requests by default
    if (req.method !== 'GET') {
      return next();
    }

    // Skip cache if condition is not met
    if (condition && !condition(req)) {
      return next();
    }

    // Skip cache if skipCache condition is met
    if (skipCache && skipCache(req)) {
      return next();
    }

    try {
      // Generate cache key
      const cacheKey = keyGenerator
        ? keyGenerator(req)
        : generateDefaultCacheKey(req, varyBy);

      // Try to get cached response
      const cachedResponse = await cacheService.getCachedApiResponse(cacheKey);

      if (cachedResponse) {
        logger.debug(`Cache hit for key: ${cacheKey}`);

        // Set cache headers
        res.set({
          'X-Cache': 'HIT',
          'X-Cache-Key': cacheKey,
          'Cache-Control': `public, max-age=${ttl}`,
        });

        return res.json(cachedResponse);
      }

      logger.debug(`Cache miss for key: ${cacheKey}`);

      // Store original res.json method
      const originalJson = res.json.bind(res);

      // Override res.json to cache the response
      res.json = function (data: any) {
        // Cache the response asynchronously
        setImmediate(async () => {
          try {
            const cacheTags = Array.isArray(tags) ? tags : tags(req);
            await cacheService.cacheApiResponse(cacheKey, data, {
              ttl,
              tags: cacheTags,
            });
            logger.debug(`Cached response for key: ${cacheKey}`);
          } catch (error) {
            logger.error('Error caching response:', error);
          }
        });

        // Set cache headers
        res.set({
          'X-Cache': 'MISS',
          'X-Cache-Key': cacheKey,
          'Cache-Control': `public, max-age=${ttl}`,
        });

        // Call original json method
        return originalJson(data);
      };

      next();

    } catch (error) {
      logger.error('Cache middleware error:', error);
      next(); // Continue without caching on error
    }
  };
};

/**
 * Generate default cache key from request
 */
function generateDefaultCacheKey(req: AuthRequest, varyBy: string[]): string {
  const parts = [
    req.method,
    req.path,
  ];

  // Add query parameters
  if (Object.keys(req.query).length > 0) {
    const sortedQuery = Object.keys(req.query)
      .sort()
      .map(key => `${key}=${req.query[key]}`)
      .join('&');
    parts.push(sortedQuery);
  }

  // Add vary-by headers/params
  for (const vary of varyBy) {
    if (req.headers[vary]) {
      parts.push(`${vary}:${req.headers[vary]}`);
    }
    if (req.params[vary]) {
      parts.push(`${vary}:${req.params[vary]}`);
    }
  }

  // Add user context if available
  if (req.user?.id) {
    parts.push(`user:${req.user.id}`);
  }

  if (req.user?.workplaceId) {
    parts.push(`workspace:${req.user.workplaceId}`);
  }

  return parts.join('|');
}

/**
 * Cache middleware specifically for dashboard endpoints
 */
export const dashboardCacheMiddleware = cacheMiddleware({
  ttl: 300, // 5 minutes
  tags: ['dashboard'],
  varyBy: ['user', 'workspace'],
  condition: (req) => {
    // Only cache for authenticated users
    return !!req.user;
  },
});

/**
 * Cache middleware for patient list endpoints
 */
export const patientListCacheMiddleware = cacheMiddleware({
  ttl: 180, // 3 minutes
  tags: ['patients', 'list'],
  varyBy: ['workspace'],
  keyGenerator: (req) => {
    const { page, limit, search, filters } = req.query;
    const workspaceId = req.user?.workplaceId || 'unknown';

    const keyParts = [
      'patient-list',
      workspaceId,
      `page:${page || 1}`,
      `limit:${limit || 10}`,
    ];

    if (search) {
      keyParts.push(`search:${search}`);
    }

    if (filters) {
      const filterStr = typeof filters === 'string'
        ? filters
        : JSON.stringify(filters);
      keyParts.push(`filters:${filterStr}`);
    }

    return keyParts.join('|');
  },
});

/**
 * Cache middleware for user profile endpoints
 */
export const userProfileCacheMiddleware = cacheMiddleware({
  ttl: 600, // 10 minutes
  tags: ['user-profile'],
  keyGenerator: (req) => {
    const userId = req.user?.id || req.params.userId;
    return `user-profile:${userId}`;
  },
  condition: (req) => {
    // Only cache if user is accessing their own profile or has permission
    return !!req.user && (req.user.id === req.params.userId || req.user.role === 'super_admin' || req.user.role === 'owner');
  },
});

/**
 * Cache middleware for clinical notes
 */
export const clinicalNotesCacheMiddleware = cacheMiddleware({
  ttl: 300, // 5 minutes
  tags: ['clinical-notes'],
  keyGenerator: (req) => {
    const patientId = req.params.patientId;
    const { page, limit } = req.query;
    return `clinical-notes:${patientId}:page:${page || 1}:limit:${limit || 10}`;
  },
});

/**
 * Cache middleware for medication data
 */
export const medicationCacheMiddleware = cacheMiddleware({
  ttl: 600, // 10 minutes (medications change less frequently)
  tags: ['medications'],
  keyGenerator: (req) => {
    const patientId = req.params.patientId;
    const { active, type } = req.query;
    const keyParts = [`medications:${patientId}`];

    if (active !== undefined) {
      keyParts.push(`active:${active}`);
    }

    if (type) {
      keyParts.push(`type:${type}`);
    }

    return keyParts.join('|');
  },
});

/**
 * Cache middleware for search endpoints
 */
export const searchCacheMiddleware = cacheMiddleware({
  ttl: 600, // 10 minutes
  tags: (req) => ['search', req.params.type || 'general'],
  keyGenerator: (req) => {
    const { q, type, filters } = req.query;
    const workspaceId = req.user?.workplaceId || 'unknown';

    const keyParts = [
      'search',
      workspaceId,
      `query:${q}`,
      `type:${type || 'general'}`,
    ];

    if (filters) {
      keyParts.push(`filters:${JSON.stringify(filters)}`);
    }

    return keyParts.join('|');
  },
});

/**
 * Cache middleware for reports and analytics
 */
export const reportsCacheMiddleware = cacheMiddleware({
  ttl: 900, // 15 minutes (reports are expensive to generate)
  tags: ['reports', 'analytics'],
  keyGenerator: (req) => {
    const { reportType, dateRange, filters } = req.query;
    const workspaceId = req.user?.workplaceId || 'unknown';

    const keyParts = [
      'reports',
      workspaceId,
      `type:${reportType}`,
      `range:${dateRange}`,
    ];

    if (filters) {
      keyParts.push(`filters:${JSON.stringify(filters)}`);
    }

    return keyParts.join('|');
  },
});

/**
 * Invalidate cache by tags - utility function for controllers
 */
export const invalidateCache = async (tags: string[]): Promise<void> => {
  try {
    const cacheService = PerformanceCacheService.getInstance();
    const deletedCount = await cacheService.invalidateByTags(tags);
    logger.debug(`Invalidated ${deletedCount} cache entries for tags:`, tags);
  } catch (error) {
    logger.error('Error invalidating cache:', error);
  }
};

/**
 * Invalidate user-specific cache - utility function
 */
export const invalidateUserCache = async (userId: string): Promise<void> => {
  try {
    const cacheService = PerformanceCacheService.getInstance();
    await cacheService.invalidateUserCache(userId);
    logger.debug(`Invalidated cache for user: ${userId}`);
  } catch (error) {
    logger.error('Error invalidating user cache:', error);
  }
};

/**
 * Invalidate patient-specific cache - utility function
 */
export const invalidatePatientCache = async (patientId: string): Promise<void> => {
  try {
    const cacheService = PerformanceCacheService.getInstance();
    await cacheService.invalidatePatientCache(patientId);
    logger.debug(`Invalidated cache for patient: ${patientId}`);
  } catch (error) {
    logger.error('Error invalidating patient cache:', error);
  }
};