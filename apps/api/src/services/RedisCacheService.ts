// Redis Caching Service for Reports & Analytics
import Redis from 'ioredis';
import { performance } from 'perf_hooks';
import logger from '../utils/logger';
import { getRedisClient, isRedisAvailable } from '../config/redis';

interface CacheOptions {
    ttl?: number; // Time to live in seconds
    compress?: boolean; // Enable compression for large data
    tags?: string[]; // Cache tags for invalidation
}

interface CacheStats {
    hits: number;
    misses: number;
    hitRate: number;
    totalOperations: number;
    avgResponseTime: number;
}

/**
 * Redis caching service with compression, tagging, and performance monitoring
 */
export class RedisCacheService {
    private static instance: RedisCacheService;
    private stats: CacheStats = {
        hits: 0,
        misses: 0,
        hitRate: 0,
        totalOperations: 0,
        avgResponseTime: 0,
    };
    private responseTimes: number[] = [];

    constructor() {
        // Use shared Redis connection from config/redis
    }

    static getInstance(): RedisCacheService {
        if (!RedisCacheService.instance) {
            RedisCacheService.instance = new RedisCacheService();
        }
        return RedisCacheService.instance;
    }

    /**
     * Set cache value with options
     */
    async set<T>(
        key: string,
        value: T,
        options: CacheOptions = {}
    ): Promise<boolean> {
        if (!isRedisAvailable()) {
            return false;
        }

        const redis = await getRedisClient();
        if (!redis) {
            return false;
        }

        const startTime = performance.now();

        try {
            const {
                ttl = 300, // 5 minutes default
                compress = true,
                tags = [],
            } = options;

            let serializedValue = JSON.stringify(value);

            // Compress large data
            if (compress && serializedValue.length > 1024) {
                const zlib = await import('zlib');
                serializedValue = zlib.gzipSync(serializedValue).toString('base64');
                key = `compressed:${key}`;
            }

            // Set the main cache entry
            const result = await redis.setex(key, ttl, serializedValue);

            // Handle cache tags for invalidation
            if (tags.length > 0) {
                await this.addCacheTags(key, tags, ttl);
            }

            // Store metadata
            await redis.setex(
                `meta:${key}`,
                ttl,
                JSON.stringify({
                    createdAt: new Date().toISOString(),
                    ttl,
                    tags,
                    compressed: compress && serializedValue.length > 1024,
                })
            );

            this.updateStats(performance.now() - startTime);
            return result === 'OK';
        } catch (error) {
            logger.error('RedisCacheService: Set error:', error);
            return false;
        }
    }

    /**
     * Get cache value
     */
    async get<T>(key: string): Promise<T | null> {
        if (!isRedisAvailable()) {
            return null;
        }

        const redis = await getRedisClient();
        if (!redis) {
            this.stats.misses++;
            return null;
        }

        const startTime = performance.now();

        try {
            let value = await redis.get(key);

            if (value === null) {
                // Try compressed version
                const compressedValue = await redis.get(`compressed:${key}`);
                if (compressedValue) {
                    const zlib = await import('zlib');
                    value = zlib.gunzipSync(Buffer.from(compressedValue, 'base64')).toString();
                } else {
                    this.stats.misses++;
                    this.updateStats(performance.now() - startTime);
                    return null;
                }
            }

            this.stats.hits++;
            this.updateStats(performance.now() - startTime);

            return JSON.parse(value) as T;
        } catch (error) {
            logger.error('RedisCacheService: Get error:', error);
            this.stats.misses++;
            this.updateStats(performance.now() - startTime);
            return null;
        }
    }

    /**
     * Get multiple cache values
     */
    async mget<T>(keys: string[]): Promise<(T | null)[]> {
        if (!isRedisAvailable()) {
            return keys.map(() => null);
        }

        const redis = await getRedisClient();
        if (!redis) {
            this.stats.misses += keys.length;
            return keys.map(() => null);
        }

        const startTime = performance.now();

        try {
            const values = await redis.mget(...keys);
            const results: (T | null)[] = [];

            for (let i = 0; i < values.length; i++) {
                const value = values[i];
                if (value === null) {
                    // Try compressed version
                    const compressedValue = await redis.get(`compressed:${keys[i]}`);
                    if (compressedValue) {
                        const zlib = await import('zlib');
                        const decompressed = zlib.gunzipSync(Buffer.from(compressedValue, 'base64')).toString();
                        results.push(JSON.parse(decompressed) as T);
                        this.stats.hits++;
                    } else {
                        results.push(null);
                        this.stats.misses++;
                    }
                } else {
                    results.push(JSON.parse(value) as T);
                    this.stats.hits++;
                }
            }

            this.updateStats(performance.now() - startTime);
            return results;
        } catch (error) {
            logger.error('Redis mget error:', error);
            this.stats.misses += keys.length;
            this.updateStats(performance.now() - startTime);
            return keys.map(() => null);
        }
    }

    /**
     * Delete cache entry
     */
    async del(key: string): Promise<boolean> {
        if (!isRedisAvailable()) {
            return false;
        }

        const redis = await getRedisClient();
        if (!redis) {
            return false;
        }

        try {
            const pipeline = redis.pipeline();
            pipeline.del(key);
            pipeline.del(`compressed:${key}`);
            pipeline.del(`meta:${key}`);

            const results = await pipeline.exec();
            return results?.some(([err, result]) => !err && result === 1) || false;
        } catch (error) {
            logger.error('Redis del error:', error);
            return false;
        }
    }

    /**
     * Delete all keys matching a pattern
     */
    async delPattern(pattern: string): Promise<number> {
        if (!isRedisAvailable()) {
            return 0;
        }

        const redis = await getRedisClient();
        if (!redis) {
            return 0;
        }

        try {
            const keys = await redis.keys(pattern);
            if (keys.length === 0) {
                return 0;
            }

            const pipeline = redis.pipeline();
            keys.forEach(key => {
                pipeline.del(key);
                pipeline.del(`compressed:${key}`);
                pipeline.del(`meta:${key}`);
            });

            const results = await pipeline.exec();
            return results?.filter(([err, result]) => !err && result).length || 0;
        } catch (error) {
            logger.error('Redis delPattern error:', error);
            return 0;
        }
    }

    /**
     * Ping Redis server
     */
    async ping(): Promise<boolean> {
        if (!isRedisAvailable()) {
            return false;
        }

        const redis = await getRedisClient();
        if (!redis) {
            return false;
        }

        try {
            const result = await redis.ping();
            return result === 'PONG';
        } catch (error) {
            logger.error('Redis ping error:', error);
            return false;
        }
    }

    /**
     * Check if key exists
     */
    async exists(key: string): Promise<boolean> {
        if (!isRedisAvailable()) {
            return false;
        }

        const redis = await getRedisClient();
        if (!redis) {
            return false;
        }

        try {
            const exists = await redis.exists(key);
            if (exists === 0) {
                // Check compressed version
                return (await redis.exists(`compressed:${key}`)) === 1;
            }
            return exists === 1;
        } catch (error) {
            logger.error('Redis exists error:', error);
            return false;
        }
    }

    /**
     * Set cache expiration
     */
    async expire(key: string, ttl: number): Promise<boolean> {
        if (!isRedisAvailable()) {
            return false;
        }

        const redis = await getRedisClient();
        if (!redis) {
            return false;
        }

        try {
            const pipeline = redis.pipeline();
            pipeline.expire(key, ttl);
            pipeline.expire(`compressed:${key}`, ttl);
            pipeline.expire(`meta:${key}`, ttl);

            const results = await pipeline.exec();
            return results?.some(([err, result]) => !err && result === 1) || false;
        } catch (error) {
            logger.error('Redis expire error:', error);
            return false;
        }
    }

    /**
     * Get cache TTL
     */
    async ttl(key: string): Promise<number> {
        if (!isRedisAvailable()) {
            return -1;
        }

        const redis = await getRedisClient();
        if (!redis) {
            return -1;
        }

        try {
            let ttl = await redis.ttl(key);
            if (ttl === -2) {
                // Check compressed version
                ttl = await redis.ttl(`compressed:${key}`);
            }
            return ttl;
        } catch (error) {
            logger.error('Redis ttl error:', error);
            return -1;
        }
    }

    /**
     * Invalidate cache by tags
     */
    async invalidateByTags(tags: string[]): Promise<number> {
        if (!isRedisAvailable()) {
            return 0;
        }

        const redis = await getRedisClient();
        if (!redis) {
            return 0;
        }

        try {
            let deletedCount = 0;

            for (const tag of tags) {
                const keys = await redis.smembers(`tag:${tag}`);
                if (keys.length > 0) {
                    const pipeline = redis.pipeline();

                    // Delete all keys with this tag
                    keys.forEach(key => {
                        pipeline.del(key);
                        pipeline.del(`compressed:${key}`);
                        pipeline.del(`meta:${key}`);
                    });

                    // Delete the tag set
                    pipeline.del(`tag:${tag}`);

                    const results = await pipeline.exec();
                    deletedCount += results?.filter(([err, result]) => !err && result === 1).length || 0;
                }
            }

            return deletedCount;
        } catch (error) {
            logger.error('Redis invalidateByTags error:', error);
            return 0;
        }
    }

    /**
     * Clear all cache
     */
    async clear(): Promise<boolean> {
        if (!isRedisAvailable()) {
            return false;
        }

        const redis = await getRedisClient();
        if (!redis) {
            return false;
        }

        try {
            await redis.flushdb();
            this.resetStats();
            return true;
        } catch (error) {
            logger.error('Redis clear error:', error);
            return false;
        }
    }

    /**
     * Get cache statistics
     */
    getStats(): CacheStats {
        return { ...this.stats };
    }

    /**
     * Reset statistics
     */
    resetStats(): void {
        this.stats = {
            hits: 0,
            misses: 0,
            hitRate: 0,
            totalOperations: 0,
            avgResponseTime: 0,
        };
        this.responseTimes = [];
    }

    /**
     * Get cache info
     */
    async getInfo(): Promise<any> {
        if (!isRedisAvailable()) {
            return false;
        }

        const redis = await getRedisClient();
        if (!redis) {
            return null;
        }

        try {
            const info = await redis.info();
            const memory = await redis.info('memory');
            const stats = await redis.info('stats');

            return {
                info,
                memory,
                stats,
                cacheStats: this.getStats(),
            };
        } catch (error) {
            logger.error('Redis getInfo error:', error);
            return null;
        }
    }

    /**
     * Health check
     */
    async healthCheck(): Promise<boolean> {
        if (!isRedisAvailable()) {
            return false;
        }

        const redis = await getRedisClient();
        if (!redis) {
            return false;
        }

        try {
            const result = await redis.ping();
            return result === 'PONG';
        } catch (error) {
            logger.error('Redis health check failed:', error);
            return false;
        }
    }

    /**
     * Close connection
     */
    async close(): Promise<void> {
        // Connection managed by RedisConnectionManager in config/redis
        logger.info('RedisCacheService: Using shared Redis connection (no individual close needed)');
    }

    // Private helper methods

    private async addCacheTags(key: string, tags: string[], ttl: number): Promise<void> {
        if (!isRedisAvailable()) {
            return;
        }

        const redis = await getRedisClient();
        if (!redis) {
            return;
        }
        if (!redis) {
            return;
        }

        const pipeline = redis.pipeline();

        tags.forEach(tag => {
            pipeline.sadd(`tag:${tag}`, key);
            pipeline.expire(`tag:${tag}`, ttl);
        });

        await pipeline.exec();
    }

    private updateStats(responseTime: number): void {
        this.stats.totalOperations++;
        this.responseTimes.push(responseTime);

        // Keep only last 1000 response times
        if (this.responseTimes.length > 1000) {
            this.responseTimes.shift();
        }

        this.stats.hitRate = (this.stats.hits / this.stats.totalOperations) * 100;
        this.stats.avgResponseTime = this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
    }
}

/**
 * Cache key generators for different report types
 */
export class CacheKeyGenerator {
    private static readonly PREFIX = 'reports:';

    static reportData(reportType: string, workplaceId: string, filters: any): string {
        const filterHash = this.hashObject(filters);
        return `${this.PREFIX}data:${reportType}:${workplaceId}:${filterHash}`;
    }

    static reportSummary(workplaceId: string, period: string): string {
        return `${this.PREFIX}summary:${workplaceId}:${period}`;
    }

    static aggregationResult(modelName: string, pipelineHash: string): string {
        return `${this.PREFIX}agg:${modelName}:${pipelineHash}`;
    }

    static userReports(userId: string): string {
        return `${this.PREFIX}user:${userId}`;
    }

    static reportTemplate(templateId: string): string {
        return `${this.PREFIX}template:${templateId}`;
    }

    private static hashObject(obj: any): string {
        const crypto = require('crypto');
        return crypto.createHash('md5').update(JSON.stringify(obj)).digest('hex');
    }
}

/**
 * Cached report service wrapper
 */
export class CachedReportService {
    private cache: RedisCacheService;

    constructor() {
        this.cache = RedisCacheService.getInstance();
    }

    async getCachedReportData<T>(
        reportType: string,
        workplaceId: string,
        filters: any,
        fetchFn: () => Promise<T>,
        ttl: number = 300
    ): Promise<T> {
        const cacheKey = CacheKeyGenerator.reportData(reportType, workplaceId, filters);

        // Try to get from cache first
        const cached = await this.cache.get<T>(cacheKey);
        if (cached !== null) {
            return cached as any;
        }

        // Fetch fresh data
        const data = await fetchFn();

        // Cache the result
        await this.cache.set(cacheKey, data, {
            ttl,
            tags: [`report:${reportType}`, `workplace:${workplaceId}`],
        });

        return data;
    }

    async invalidateReportCache(reportType?: string, workplaceId?: string): Promise<void> {
        const tags: string[] = [];

        if (reportType) {
            tags.push(`report:${reportType}`);
        }

        if (workplaceId) {
            tags.push(`workplace:${workplaceId}`);
        }

        if (tags.length > 0) {
            await this.cache.invalidateByTags(tags);
        } else {
            // Clear all report cache
            await this.cache.invalidateByTags(['reports']);
        }
    }
}

export default RedisCacheService.getInstance();
