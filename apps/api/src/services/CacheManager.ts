import Redis from 'ioredis';
import mongoose from 'mongoose';
import logger from '../utils/logger';
import { getRedisClient, isRedisAvailable } from '../config/redis';

export interface CacheEntry<T = any> {
    data: T;
    timestamp: number;
    ttl: number;
    version: string;
}

export interface PermissionCacheEntry {
    permissions: string[];
    sources: Record<string, string>;
    deniedPermissions: string[];
    userId: string;
    workspaceId?: string;
    lastUpdated: number;
    expiresAt: number;
}

export interface RoleCacheEntry {
    roleId: string;
    permissions: string[];
    inheritedPermissions: string[];
    hierarchyLevel: number;
    parentRoleId?: string;
    lastUpdated: number;
    expiresAt: number;
}

export interface CacheMetrics {
    hits: number;
    misses: number;
    sets: number;
    deletes: number;
    hitRate: number;
    totalOperations: number;
    memoryUsage: number;
    keyCount: number;
}

/**
 * Redis-based cache manager for permission and role caching
 * Provides high-performance caching with automatic invalidation and consistency mechanisms
 * Uses shared Redis connection from config/redis
 */
class CacheManager {
    private static instance: CacheManager;
    private readonly DEFAULT_TTL = 5 * 60; // 5 minutes in seconds
    private readonly MAX_MEMORY_USAGE = 100 * 1024 * 1024; // 100MB
    private readonly CACHE_VERSION = '1.0.0';

    // Cache metrics
    private metrics: CacheMetrics = {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        hitRate: 0,
        totalOperations: 0,
        memoryUsage: 0,
        keyCount: 0
    };

    // Cache key prefixes
    private readonly PREFIXES = {
        USER_PERMISSIONS: 'user_perms:',
        ROLE_PERMISSIONS: 'role_perms:',
        ROLE_HIERARCHY: 'role_hier:',
        PERMISSION_CHECK: 'perm_check:',
        USER_ROLES: 'user_roles:',
        METRICS: 'cache_metrics:'
    };

    private constructor() {
        // Use shared Redis connection from config/redis
    }

    public static getInstance(): CacheManager {
        if (!CacheManager.instance) {
            CacheManager.instance = new CacheManager();
        }
        return CacheManager.instance;
    }

    /**
     * Helper to get Redis client with availability check
     */
    private async getRedis(): Promise<Redis | null> {
        if (!isRedisAvailable()) {
            return null;
        }
        return await getRedisClient();
    }

    /**
     * Cache user permissions with TTL
     */
    public async cacheUserPermissions(
        userId: mongoose.Types.ObjectId,
        permissions: string[],
        sources: Record<string, string>,
        deniedPermissions: string[] = [],
        workspaceId?: mongoose.Types.ObjectId,
        ttl: number = this.DEFAULT_TTL
    ): Promise<boolean> {
        const redis = await this.getRedis();
        if (!redis) {
            return false;
        }

        try {
            const key = this.getUserPermissionKey(userId, workspaceId);
            const cacheEntry: PermissionCacheEntry = {
                permissions,
                sources,
                deniedPermissions,
                userId: userId.toString(),
                workspaceId: workspaceId?.toString(),
                lastUpdated: Date.now(),
                expiresAt: Date.now() + (ttl * 1000)
            };

            await redis.setex(key, ttl, JSON.stringify(cacheEntry));
            this.metrics.sets++;

            logger.debug(`Cached permissions for user ${userId}`, {
                permissionCount: permissions.length,
                ttl,
                workspaceId: workspaceId?.toString()
            });

            return true;

        } catch (error) {
            logger.error('Error caching user permissions:', error);
            return false;
        }
    }

    /**
     * Get cached user permissions
     */
    public async getCachedUserPermissions(
        userId: mongoose.Types.ObjectId,
        workspaceId?: mongoose.Types.ObjectId
    ): Promise<PermissionCacheEntry | null> {
        const redis = await this.getRedis();
        if (!redis) {
            this.metrics.misses++;
            return null;
        }

        try {
            const key = this.getUserPermissionKey(userId, workspaceId);
            const cached = await redis.get(key);

            if (!cached) {
                this.metrics.misses++;
                return null;
            }

            const cacheEntry: PermissionCacheEntry = JSON.parse(cached);

            // Check if cache entry is expired
            if (Date.now() > cacheEntry.expiresAt) {
                await redis.del(key);
                this.metrics.misses++;
                return null;
            }

            this.metrics.hits++;
            return cacheEntry;

        } catch (error) {
            logger.error('Error getting cached user permissions:', error);
            this.metrics.misses++;
            return null;
        }
    }

    /**
     * Cache role permissions and hierarchy
     */
    public async cacheRolePermissions(
        roleId: mongoose.Types.ObjectId,
        permissions: string[],
        inheritedPermissions: string[],
        hierarchyLevel: number,
        parentRoleId?: mongoose.Types.ObjectId,
        ttl: number = this.DEFAULT_TTL
    ): Promise<boolean> {
        const redis = await this.getRedis();
        if (!redis) {
            return false;
        }

        try {
            const key = this.getRolePermissionKey(roleId);
            const cacheEntry: RoleCacheEntry = {
                roleId: roleId.toString(),
                permissions,
                inheritedPermissions,
                hierarchyLevel,
                parentRoleId: parentRoleId?.toString(),
                lastUpdated: Date.now(),
                expiresAt: Date.now() + (ttl * 1000)
            };

            await redis.setex(key, ttl, JSON.stringify(cacheEntry));
            this.metrics.sets++;

            return true;

        } catch (error) {
            logger.error('Error caching role permissions:', error);
            return false;
        }
    }

    /**
     * Get cached role permissions
     */
    public async getCachedRolePermissions(
        roleId: mongoose.Types.ObjectId
    ): Promise<RoleCacheEntry | null> {
        const redis = await this.getRedis();
        if (!redis) {
            this.metrics.misses++;
            return null;
        }

        try {
            const key = this.getRolePermissionKey(roleId);
            const cached = await redis.get(key);

            if (!cached) {
                this.metrics.misses++;
                return null;
            }

            const cacheEntry: RoleCacheEntry = JSON.parse(cached);

            // Check if cache entry is expired
            if (Date.now() > cacheEntry.expiresAt) {
                await redis.del(key);
                this.metrics.misses++;
                return null;
            }

            this.metrics.hits++;
            return cacheEntry;

        } catch (error) {
            logger.error('Error getting cached role permissions:', error);
            this.metrics.misses++;
            return null;
        }
    }

    /**
     * Cache permission check result
     */
    public async cachePermissionCheck(
        userId: mongoose.Types.ObjectId,
        action: string,
        allowed: boolean,
        source: string,
        workspaceId?: mongoose.Types.ObjectId,
        ttl: number = this.DEFAULT_TTL
    ): Promise<boolean> {
        const redis = await this.getRedis();
        if (!redis) {
            return false;
        }

        try {
            const key = this.getPermissionCheckKey(userId, action, workspaceId);
            const cacheEntry = {
                allowed,
                source,
                timestamp: Date.now(),
                expiresAt: Date.now() + (ttl * 1000)
            };

            await redis.setex(key, ttl, JSON.stringify(cacheEntry));
            this.metrics.sets++;

            return true;

        } catch (error) {
            logger.error('Error caching permission check:', error);
            return false;
        }
    }

    /**
     * Get cached permission check result
     */
    public async getCachedPermissionCheck(
        userId: mongoose.Types.ObjectId,
        action: string,
        workspaceId?: mongoose.Types.ObjectId
    ): Promise<{ allowed: boolean; source: string; timestamp: number } | null> {
        const redis = await this.getRedis();
        if (!redis) {
            this.metrics.misses++;
            return null;
        }

        try {
            const key = this.getPermissionCheckKey(userId, action, workspaceId);
            const cached = await redis.get(key);

            if (!cached) {
                this.metrics.misses++;
                return null;
            }

            const cacheEntry = JSON.parse(cached);

            // Check if cache entry is expired
            if (Date.now() > cacheEntry.expiresAt) {
                await redis.del(key);
                this.metrics.misses++;
                return null;
            }

            this.metrics.hits++;
            return {
                allowed: cacheEntry.allowed,
                source: cacheEntry.source,
                timestamp: cacheEntry.timestamp
            };

        } catch (error) {
            logger.error('Error getting cached permission check:', error);
            this.metrics.misses++;
            return null;
        }
    }

    /**
     * Invalidate user permission cache
     */
    public async invalidateUserCache(
        userId: mongoose.Types.ObjectId,
        workspaceId?: mongoose.Types.ObjectId
    ): Promise<void> {
        const redis = await this.getRedis();
        if (!redis) {
            return;
        }

        try {
            const patterns = [
                this.getUserPermissionKey(userId, workspaceId),
                `${this.PREFIXES.PERMISSION_CHECK}${userId}:*`,
                `${this.PREFIXES.USER_ROLES}${userId}:*`
            ];

            for (const pattern of patterns) {
                if (pattern.includes('*')) {
                    const keys = await redis.keys(pattern);
                    if (keys.length > 0) {
                        await redis.del(...keys);
                        this.metrics.deletes += keys.length;
                    }
                } else {
                    await redis.del(pattern);
                    this.metrics.deletes++;
                }
            }

            logger.debug(`Invalidated cache for user ${userId}`);

        } catch (error) {
            logger.error('Error invalidating user cache:', error);
        }
    }

    /**
     * Invalidate role permission cache
     */
    public async invalidateRoleCache(roleId: mongoose.Types.ObjectId): Promise<void> {
        const redis = await this.getRedis();
        if (!redis) {
            return;
        }

        try {
            const patterns = [
                this.getRolePermissionKey(roleId),
                `${this.PREFIXES.ROLE_HIERARCHY}${roleId}:*`,
                `${this.PREFIXES.ROLE_HIERARCHY}*:${roleId}`
            ];

            for (const pattern of patterns) {
                if (pattern.includes('*')) {
                    const keys = await redis.keys(pattern);
                    if (keys.length > 0) {
                        await redis.del(...keys);
                        this.metrics.deletes += keys.length;
                    }
                } else {
                    await redis.del(pattern);
                    this.metrics.deletes++;
                }
            }

            logger.debug(`Invalidated cache for role ${roleId}`);

        } catch (error) {
            logger.error('Error invalidating role cache:', error);
        }
    }

    /**
     * Invalidate cache by pattern
     */
    public async invalidatePattern(pattern: string): Promise<number> {
        const redis = await this.getRedis();
        if (!redis) {
            return 0;
        }

        try {
            const keys = await redis.keys(pattern);
            if (keys.length > 0) {
                await redis.del(...keys);
                this.metrics.deletes += keys.length;
                return keys.length;
            }
            return 0;

        } catch (error) {
            logger.error('Error invalidating cache pattern:', error);
            return 0;
        }
    }

    /**
     * Warm cache for frequently accessed permissions
     */
    public async warmCache(
        warmingStrategies: Array<{
            type: 'user_permissions' | 'role_permissions' | 'permission_checks';
            targets: mongoose.Types.ObjectId[];
            priority: 'high' | 'medium' | 'low';
        }>
    ): Promise<void> {
        const redis = await this.getRedis();
        if (!redis) {
            return;
        }

        try {
            logger.info('Starting cache warming process');

            for (const strategy of warmingStrategies) {
                switch (strategy.type) {
                    case 'user_permissions':
                        await this.warmUserPermissions(strategy.targets);
                        break;
                    case 'role_permissions':
                        await this.warmRolePermissions(strategy.targets);
                        break;
                    case 'permission_checks':
                        await this.warmPermissionChecks(strategy.targets);
                        break;
                }
            }

            logger.info('Cache warming completed');

        } catch (error) {
            logger.error('Error warming cache:', error);
        }
    }

    /**
     * Warm user permissions cache
     */
    private async warmUserPermissions(userIds: mongoose.Types.ObjectId[]): Promise<void> {
        // This would be implemented to pre-load user permissions
        // For now, just log the intent
        logger.debug(`Warming user permissions cache for ${userIds.length} users`);
    }

    /**
     * Warm role permissions cache
     */
    private async warmRolePermissions(roleIds: mongoose.Types.ObjectId[]): Promise<void> {
        // This would be implemented to pre-load role permissions
        // For now, just log the intent
        logger.debug(`Warming role permissions cache for ${roleIds.length} roles`);
    }

    /**
     * Warm permission checks cache
     */
    private async warmPermissionChecks(userIds: mongoose.Types.ObjectId[]): Promise<void> {
        // This would be implemented to pre-load common permission checks
        // For now, just log the intent
        logger.debug(`Warming permission checks cache for ${userIds.length} users`);
    }

    /**
     * Check cache consistency and repair if needed
     */
    public async checkConsistency(): Promise<{
        consistent: boolean;
        issues: string[];
        repaired: number;
    }> {
        const redis = await this.getRedis();
        if (!redis) {
            return {
                consistent: false,
                issues: ['Redis not connected'],
                repaired: 0
            };
        }

        const issues: string[] = [];
        let repaired = 0;

        try {
            // Check for expired entries that weren't cleaned up
            const allKeys = await redis.keys('*');
            const now = Date.now();

            for (const key of allKeys) {
                try {
                    const value = await redis.get(key);
                    if (value) {
                        const parsed = JSON.parse(value);
                        if (parsed.expiresAt && now > parsed.expiresAt) {
                            await redis.del(key);
                            repaired++;
                        }
                    }
                } catch (error) {
                    // Invalid JSON or other parsing error
                    await redis.del(key);
                    issues.push(`Removed invalid cache entry: ${key}`);
                    repaired++;
                }
            }

            // Check for orphaned cache entries
            await this.checkOrphanedEntries(issues, repaired);

            // Check cache key patterns for consistency
            await this.validateCacheKeyPatterns(issues);

            // Check memory usage
            try {
                const memoryStats = await redis.memory('STATS') as string[];
                const memoryUsage = memoryStats.length > 0 && memoryStats[0] ? parseInt(memoryStats[0]) : 0;
                if (memoryUsage > this.MAX_MEMORY_USAGE) {
                    issues.push(`Memory usage (${memoryUsage}) exceeds limit (${this.MAX_MEMORY_USAGE})`);

                    // Trigger cache cleanup if memory usage is too high
                    await this.performMemoryCleanup();
                    repaired++;
                }
            } catch (error) {
                // Memory command might not be available in all Redis versions
                logger.debug('Memory stats not available:', error);
            }

            // Check for cache fragmentation
            await this.checkCacheFragmentation(issues);

            return {
                consistent: issues.length === 0,
                issues,
                repaired
            };

        } catch (error) {
            logger.error('Error checking cache consistency:', error);
            return {
                consistent: false,
                issues: ['Error checking consistency'],
                repaired
            };
        }
    }

    /**
     * Check for orphaned cache entries
     */
    private async checkOrphanedEntries(issues: string[], repaired: number): Promise<void> {
        const redis = await this.getRedis();
        if (!redis) {
            return;
        }

        try {
            // Check for user permission entries without corresponding users
            const userPermKeys = await redis.keys(`${this.PREFIXES.USER_PERMISSIONS}*`);

            for (const key of userPermKeys) {
                const userId = key.replace(this.PREFIXES.USER_PERMISSIONS, '').split(':')[0];

                if (userId && mongoose.Types.ObjectId.isValid(userId)) {
                    try {
                        const User = (await import('../models/User')).default;
                        const userExists = await User.exists({ _id: userId });

                        if (!userExists) {
                            await redis.del(key);
                            issues.push(`Removed orphaned user permission cache: ${userId}`);
                            repaired++;
                        }
                    } catch (error) {
                        logger.debug(`Error checking user existence for ${userId}:`, error);
                    }
                }
            }

            // Check for role permission entries without corresponding roles
            const rolePermKeys = await redis.keys(`${this.PREFIXES.ROLE_PERMISSIONS}*`);

            for (const key of rolePermKeys) {
                const roleId = key.replace(this.PREFIXES.ROLE_PERMISSIONS, '');

                if (roleId && mongoose.Types.ObjectId.isValid(roleId)) {
                    try {
                        const Role = (await import('../models/Role')).default;
                        const roleExists = await Role.exists({ _id: roleId, isActive: true });

                        if (!roleExists) {
                            await redis.del(key);
                            issues.push(`Removed orphaned role permission cache: ${roleId}`);
                            repaired++;
                        }
                    } catch (error) {
                        logger.debug(`Error checking role existence for ${roleId}:`, error);
                    }
                }
            }

        } catch (error) {
            logger.error('Error checking orphaned entries:', error);
        }
    }

    /**
     * Validate cache key patterns
     */
    private async validateCacheKeyPatterns(issues: string[]): Promise<void> {
        const redis = await this.getRedis();
        if (!redis) {
            return;
        }

        try {
            const allKeys = await redis.keys('*');
            const validPrefixes = Object.values(this.PREFIXES);

            for (const key of allKeys) {
                const hasValidPrefix = validPrefixes.some(prefix => key.startsWith(prefix));

                if (!hasValidPrefix) {
                    issues.push(`Invalid cache key pattern: ${key}`);
                }
            }

        } catch (error) {
            logger.error('Error validating cache key patterns:', error);
        }
    }

    /**
     * Perform memory cleanup when usage is high
     */
    private async performMemoryCleanup(): Promise<void> {
        const redis = await this.getRedis();
        if (!redis) {
            return;
        }

        try {
            // Remove expired entries first
            const allKeys = await redis.keys('*');
            const now = Date.now();
            let cleanedCount = 0;

            for (const key of allKeys) {
                try {
                    const value = await redis.get(key);
                    if (value) {
                        const parsed = JSON.parse(value);
                        if (parsed.expiresAt && now > parsed.expiresAt) {
                            await redis.del(key);
                            cleanedCount++;
                        }
                    }
                } catch (error) {
                    // Remove invalid entries
                    await redis.del(key);
                    cleanedCount++;
                }
            }

            // If still high memory usage, remove oldest entries
            const memoryStats = await redis.memory('STATS') as string[];
            const memoryUsage = memoryStats.length > 0 && memoryStats[0] ? parseInt(memoryStats[0]) : 0;

            if (memoryUsage > this.MAX_MEMORY_USAGE * 0.8) { // 80% threshold
                // Implement LRU-style cleanup
                const keysToRemove = Math.floor(allKeys.length * 0.1); // Remove 10% of keys
                const sortedKeys = allKeys.sort(); // Simple sorting, could be improved with access time

                for (let i = 0; i < keysToRemove && i < sortedKeys.length; i++) {
                    const key = sortedKeys[i];
                    if (key) {
                        await redis.del(key);
                        cleanedCount++;
                    }
                }
            }

            logger.info(`Memory cleanup completed, removed ${cleanedCount} cache entries`);

        } catch (error) {
            logger.error('Error performing memory cleanup:', error);
        }
    }

    /**
     * Check for cache fragmentation
     */
    private async checkCacheFragmentation(issues: string[]): Promise<void> {
        const redis = await this.getRedis();
        if (!redis) {
            return;
        }

        try {
            const info = await redis.info('memory');
            const fragmentationMatch = info.match(/mem_fragmentation_ratio:(\d+\.?\d*)/);

            if (fragmentationMatch && fragmentationMatch[1]) {
                const fragmentationRatio = parseFloat(fragmentationMatch[1]);

                if (fragmentationRatio > 1.5) { // 50% fragmentation threshold
                    issues.push(`High memory fragmentation ratio: ${fragmentationRatio}`);
                }
            }

        } catch (error) {
            logger.debug('Error checking cache fragmentation:', error);
        }
    }

    /**
     * Get cache performance metrics
     */
    public async getMetrics(): Promise<CacheMetrics> {
        const redis = await this.getRedis();
        if (!redis) {
            return this.metrics;
        }

        try {
            // Update memory usage and key count
            const info = await redis.info('memory');
            const memoryMatch = info.match(/used_memory:(\d+)/);
            this.metrics.memoryUsage = memoryMatch && memoryMatch[1] ? parseInt(memoryMatch[1]) : 0;

            this.metrics.keyCount = await redis.dbsize();

            // Calculate hit rate
            this.metrics.totalOperations = this.metrics.hits + this.metrics.misses;
            this.metrics.hitRate = this.metrics.totalOperations > 0
                ? (this.metrics.hits / this.metrics.totalOperations) * 100
                : 0;

            return { ...this.metrics };

        } catch (error) {
            logger.error('Error getting cache metrics:', error);
            return this.metrics;
        }
    }

    /**
     * Clear all cache
     */
    public async clearAll(): Promise<void> {
        const redis = await this.getRedis();
        if (!redis) {
            return;
        }

        try {
            await redis.flushdb();
            this.resetMetrics();
            logger.info('All cache cleared');

        } catch (error) {
            logger.error('Error clearing cache:', error);
        }
    }

    /**
     * Reset metrics
     */
    public resetMetrics(): void {
        this.metrics = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            hitRate: 0,
            totalOperations: 0,
            memoryUsage: 0,
            keyCount: 0
        };
    }

    /**
     * Generate cache key for user permissions
     */
    private getUserPermissionKey(
        userId: mongoose.Types.ObjectId,
        workspaceId?: mongoose.Types.ObjectId
    ): string {
        const base = `${this.PREFIXES.USER_PERMISSIONS}${userId}`;
        return workspaceId ? `${base}:${workspaceId}` : base;
    }

    /**
     * Generate cache key for role permissions
     */
    private getRolePermissionKey(roleId: mongoose.Types.ObjectId): string {
        return `${this.PREFIXES.ROLE_PERMISSIONS}${roleId}`;
    }

    /**
     * Generate cache key for permission checks
     */
    private getPermissionCheckKey(
        userId: mongoose.Types.ObjectId,
        action: string,
        workspaceId?: mongoose.Types.ObjectId
    ): string {
        const base = `${this.PREFIXES.PERMISSION_CHECK}${userId}:${action}`;
        return workspaceId ? `${base}:${workspaceId}` : base;
    }

    /**
     * Close Redis connection
     */
    public async close(): Promise<void> {
        // Connection managed by centralized RedisConnectionManager
        // Individual services should not close the shared connection
    }
}

export default CacheManager;
