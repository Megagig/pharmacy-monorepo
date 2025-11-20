import Redis from 'ioredis';
import logger from '../utils/logger';
import { getRedisClient, isRedisAvailable } from '../config/redis';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  compress?: boolean; // Whether to compress large payloads
  tags?: string[]; // Cache tags for invalidation
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRate: number;
  memoryUsage: number;
  keyCount: number;
}

/**
 * Performance-focused caching service for API responses and expensive operations
 * Extends the existing CacheManager with general-purpose caching capabilities
 */
export default class PerformanceCacheService {
  private static instance: PerformanceCacheService;
  private readonly DEFAULT_TTL = 300; // 5 minutes
  private readonly COMPRESSION_THRESHOLD = 1024; // 1KB

  // Cache prefixes for different data types
  private readonly PREFIXES = {
    API_RESPONSE: 'api:',
    DASHBOARD: 'dashboard:',
    USER_PROFILE: 'user_profile:',
    PATIENT_LIST: 'patient_list:',
    CLINICAL_NOTES: 'clinical_notes:',
    MEDICATIONS: 'medications:',
    REPORTS: 'reports:',
    SEARCH_RESULTS: 'search:',
    AGGREGATIONS: 'agg:',
  };

  // Performance metrics
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    hitRate: 0,
    memoryUsage: 0,
    keyCount: 0,
  };

  private constructor() {
    // Use shared Redis connection from config/redis
  }

  public static getInstance(): PerformanceCacheService {
    if (!PerformanceCacheService.instance) {
      PerformanceCacheService.instance = new PerformanceCacheService();
    }
    return PerformanceCacheService.instance;
  }

  /**
   * Cache API response with automatic compression for large payloads
   */
  public async cacheApiResponse(
    key: string,
    data: any,
    options: CacheOptions = {}
  ): Promise<boolean> {
    try {
      if (!isRedisAvailable()) {
        logger.debug('Performance cache: Redis not available');
        return false;
      }

      const redis = await getRedisClient();
      if (!redis) {
        return false;
      }

      const ttl = options.ttl || this.DEFAULT_TTL;
      const serialized = JSON.stringify(data);

      // Store in Redis
      await redis.setex(key, ttl, serialized);
      this.stats.sets++;

      return true;
    } catch (error) {
      logger.error('Performance cache: Error caching API response:', error);
      return false;
    }
  }

  /**
   * Get cached API response with automatic decompression
   */
  public async getCachedApiResponse<T = any>(key: string): Promise<T | null> {
    try {
      if (!isRedisAvailable()) {
        this.stats.misses++;
        return null;
      }

      const redis = await getRedisClient();
      if (!redis) {
        this.stats.misses++;
        return null;
      }

      const cached = await redis.get(key);

      if (!cached) {
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      return JSON.parse(cached);
    } catch (error) {
      logger.error('Performance cache: Error getting cached API response:', error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Cache dashboard overview data
   */
  public async cacheDashboardOverview(
    userId: string,
    workspaceId: string,
    data: any,
    ttl: number = 300
  ): Promise<boolean> {
    const key = `${this.PREFIXES.DASHBOARD}${workspaceId}:${userId}`;
    return this.cacheApiResponse(key, data, {
      ttl,
      tags: ['dashboard', 'user-specific']
    });
  }

  /**
   * Get cached dashboard overview
   */
  public async getCachedDashboardOverview(
    userId: string,
    workspaceId: string
  ): Promise<any | null> {
    const key = `${this.PREFIXES.DASHBOARD}${workspaceId}:${userId}`;
    return this.getCachedApiResponse(key);
  }

  /**
   * Cache user profile data
   */
  public async cacheUserProfile(
    userId: string,
    data: any,
    ttl: number = 600
  ): Promise<boolean> {
    const key = `${this.PREFIXES.USER_PROFILE}${userId}`;
    return this.cacheApiResponse(key, data, {
      ttl,
      tags: ['user-profile']
    });
  }

  /**
   * Get cached user profile
   */
  public async getCachedUserProfile(userId: string): Promise<any | null> {
    const key = `${this.PREFIXES.USER_PROFILE}${userId}`;
    return this.getCachedApiResponse(key);
  }

  /**
   * Cache patient list with filters
   */
  public async cachePatientList(
    workspaceId: string,
    filters: Record<string, any>,
    data: any,
    ttl: number = 180
  ): Promise<boolean> {
    const filterHash = this.hashFilters(filters);
    const key = `${this.PREFIXES.PATIENT_LIST}${workspaceId}:${filterHash}`;
    return this.cacheApiResponse(key, data, {
      ttl,
      tags: ['patients', 'list']
    });
  }

  /**
   * Get cached patient list
   */
  public async getCachedPatientList(
    workspaceId: string,
    filters: Record<string, any>
  ): Promise<any | null> {
    const filterHash = this.hashFilters(filters);
    const key = `${this.PREFIXES.PATIENT_LIST}${workspaceId}:${filterHash}`;
    return this.getCachedApiResponse(key);
  }

  /**
   * Cache clinical notes for a patient
   */
  public async cacheClinicalNotes(
    patientId: string,
    data: any,
    ttl: number = 300
  ): Promise<boolean> {
    const key = `${this.PREFIXES.CLINICAL_NOTES}${patientId}`;
    return this.cacheApiResponse(key, data, {
      ttl,
      tags: ['clinical-notes', 'patient-specific']
    });
  }

  /**
   * Get cached clinical notes
   */
  public async getCachedClinicalNotes(patientId: string): Promise<any | null> {
    const key = `${this.PREFIXES.CLINICAL_NOTES}${patientId}`;
    return this.getCachedApiResponse(key);
  }

  /**
   * Cache search results
   */
  public async cacheSearchResults(
    query: string,
    type: string,
    workspaceId: string,
    data: any,
    ttl: number = 600
  ): Promise<boolean> {
    const queryHash = this.hashQuery(query);
    const key = `${this.PREFIXES.SEARCH_RESULTS}${type}:${workspaceId}:${queryHash}`;
    return this.cacheApiResponse(key, data, {
      ttl,
      tags: ['search', type]
    });
  }

  /**
   * Get cached search results
   */
  public async getCachedSearchResults(
    query: string,
    type: string,
    workspaceId: string
  ): Promise<any | null> {
    const queryHash = this.hashQuery(query);
    const key = `${this.PREFIXES.SEARCH_RESULTS}${type}:${workspaceId}:${queryHash}`;
    return this.getCachedApiResponse(key);
  }

  /**
   * Cache aggregation results
   */
  public async cacheAggregation(
    name: string,
    params: Record<string, any>,
    data: any,
    ttl: number = 900
  ): Promise<boolean> {
    const paramsHash = this.hashFilters(params);
    const key = `${this.PREFIXES.AGGREGATIONS}${name}:${paramsHash}`;
    return this.cacheApiResponse(key, data, {
      ttl,
      tags: ['aggregation', name]
    });
  }

  /**
   * Get cached aggregation results
   */
  public async getCachedAggregation(
    name: string,
    params: Record<string, any>
  ): Promise<any | null> {
    const paramsHash = this.hashFilters(params);
    const key = `${this.PREFIXES.AGGREGATIONS}${name}:${paramsHash}`;
    return this.getCachedApiResponse(key);
  }

  /**
   * Invalidate cache by tags
   */
  public async invalidateByTags(tags: string[]): Promise<number> {
    try {
      if (!isRedisAvailable()) {
        return 0;
      }

      // Simplified implementation without metadata
      let deletedCount = 0;
      for (const tag of tags) {
        const pattern = `*:tag:${tag}:*`;
        const deleted = await this.invalidateByPattern(pattern);
        deletedCount += deleted;
      }

      return deletedCount;
    } catch (error) {
      logger.error('Performance cache: Error invalidating by tags:', error);
      return 0;
    }
  }

  /**
   * Invalidate cache by pattern
   */
  public async invalidateByPattern(pattern: string): Promise<number> {
    try {
      if (!isRedisAvailable()) {
        return 0;
      }

      const redis = await getRedisClient();
      if (!redis) {
        return 0;
      }

      const keys = await redis.keys(pattern);
      if (keys.length === 0) return 0;

      const deleted = await redis.del(...keys);
      this.stats.deletes += deleted;

      logger.debug(`Performance cache: Invalidated ${deleted} cache entries by pattern: ${pattern}`);
      return deleted;
    } catch (error) {
      logger.error('Performance cache: Error invalidating cache by pattern:', error);
      return 0;
    }
  }

  /**
   * Invalidate user-specific cache
   */
  public async invalidateUserCache(userId: string): Promise<void> {
    await Promise.all([
      this.invalidateByPattern(`${this.PREFIXES.USER_PROFILE}${userId}*`),
      this.invalidateByPattern(`${this.PREFIXES.DASHBOARD}*:${userId}`),
      this.invalidateByTags(['user-specific']),
    ]);
  }

  /**
   * Invalidate patient-specific cache
   */
  public async invalidatePatientCache(patientId: string): Promise<void> {
    await Promise.all([
      this.invalidateByPattern(`${this.PREFIXES.CLINICAL_NOTES}${patientId}*`),
      this.invalidateByPattern(`${this.PREFIXES.MEDICATIONS}${patientId}*`),
      this.invalidateByTags(['patient-specific']),
    ]);
  }

  /**
   * Get cache statistics
   */
  public async getStats(): Promise<CacheStats> {
    if (!isRedisAvailable()) {
      return this.stats;
    }

    try {
      const redis = await getRedisClient();
      if (!redis) {
        return this.stats;
      }

      // Update memory usage and key count
      const info = await redis.info('memory');
      const memoryMatch = info.match(/used_memory:(\d+)/);
      this.stats.memoryUsage = memoryMatch?.[1] ? parseInt(memoryMatch[1]) : 0;

      this.stats.keyCount = await redis.dbsize();

      // Calculate hit rate
      const totalOperations = this.stats.hits + this.stats.misses;
      this.stats.hitRate = totalOperations > 0
        ? (this.stats.hits / totalOperations) * 100
        : 0;

      return { ...this.stats };

    } catch (error) {
      logger.error('Error getting cache stats:', error);
      return this.stats;
    }
  }

  /**
   * Clear all performance cache
   */
  public async clearAll(): Promise<void> {
    try {
      if (!isRedisAvailable()) {
        return;
      }

      const redis = await getRedisClient();
      if (!redis) {
        return;
      }

      await redis.flushdb();
      this.resetStats();
      logger.info('Performance cache cleared');
    } catch (error) {
      logger.error('Performance cache: Error clearing cache:', error);
    }
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      hitRate: 0,
      memoryUsage: 0,
      keyCount: 0,
    };
  }

  /**
   * Hash filters for consistent cache keys
   */
  private hashFilters(filters: Record<string, any>): string {
    const crypto = require('crypto');
    const normalized = JSON.stringify(filters, Object.keys(filters).sort());
    return crypto.createHash('md5').update(normalized).digest('hex');
  }

  /**
   * Hash query string for consistent cache keys
   */
  private hashQuery(query: string): string {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(query.toLowerCase().trim()).digest('hex');
  }

  /**
   * Close Redis connection gracefully
   * Note: This is now managed by the centralized RedisConnectionManager
   */
  public async close(): Promise<void> {
    // No-op: Connection is managed centrally
    logger.info('Performance cache: Connection managed by RedisConnectionManager');
  }

  /**
   * Generic get method for backward compatibility
   */
  public async get<T = any>(key: string): Promise<T | null> {
    return this.getCachedApiResponse(key);
  }

  /**
   * Generic set method for backward compatibility
   */
  public async set<T = any>(key: string, value: T, ttl: number): Promise<boolean> {
    return this.cacheApiResponse(key, value, { ttl });
  }

  /**
   * Generic invalidate method for backward compatibility
   */
  public async invalidate(pattern: string): Promise<number> {
    return this.invalidateByPattern(pattern);
  }
}
