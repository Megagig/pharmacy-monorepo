import crypto from 'crypto';
import logger from '../../../utils/logger';

/**
 * Diagnostic Cache Service
 * High-performance caching for AI results, drug interactions, and clinical data
 */

export interface CacheEntry<T = any> {
    key: string;
    value: T;
    createdAt: Date;
    expiresAt: Date;
    accessCount: number;
    lastAccessed: Date;
    tags: string[];
    size: number;
}

export interface CacheStats {
    totalEntries: number;
    totalSize: number;
    hitRate: number;
    missRate: number;
    evictionCount: number;
    averageAccessTime: number;
}

export interface CacheConfig {
    maxSize: number; // Maximum cache size in bytes
    maxEntries: number; // Maximum number of entries
    defaultTTL: number; // Default time-to-live in milliseconds
    cleanupInterval: number; // Cleanup interval in milliseconds
    enableCompression: boolean;
    enableMetrics: boolean;
}

class DiagnosticCacheService {
    private cache: Map<string, CacheEntry> = new Map();
    private stats = {
        hits: 0,
        misses: 0,
        evictions: 0,
        totalAccessTime: 0,
        accessCount: 0,
    };

    private readonly config: CacheConfig = {
        maxSize: 100 * 1024 * 1024, // 100MB
        maxEntries: 10000,
        defaultTTL: 60 * 60 * 1000, // 1 hour
        cleanupInterval: 5 * 60 * 1000, // 5 minutes
        enableCompression: true,
        enableMetrics: true,
    };

    private cleanupTimer?: NodeJS.Timeout;

    constructor(config?: Partial<CacheConfig>) {
        if (config) {
            this.config = { ...this.config, ...config };
        }

        this.startCleanupTimer();
    }

    /**
     * Cache AI diagnostic results
     */
    async cacheAIResult(
        inputHash: string,
        result: any,
        ttl: number = this.config.defaultTTL
    ): Promise<void> {
        const key = `ai_result:${inputHash}`;
        const tags = ['ai_result', 'diagnostic'];

        await this.set(key, result, ttl, tags);

        logger.debug('AI result cached', {
            key,
            ttl,
            size: this.calculateSize(result),
        });
    }

    /**
     * Get cached AI diagnostic result
     */
    async getCachedAIResult(inputHash: string): Promise<any | null> {
        const key = `ai_result:${inputHash}`;
        return this.get(key);
    }

    /**
     * Cache drug interaction results
     */
    async cacheDrugInteractions(
        medicationHash: string,
        interactions: any,
        ttl: number = 24 * 60 * 60 * 1000 // 24 hours
    ): Promise<void> {
        const key = `drug_interactions:${medicationHash}`;
        const tags = ['drug_interactions', 'clinical_api'];

        await this.set(key, interactions, ttl, tags);

        logger.debug('Drug interactions cached', {
            key,
            ttl,
            interactionCount: interactions.length,
        });
    }

    /**
     * Get cached drug interactions
     */
    async getCachedDrugInteractions(medicationHash: string): Promise<any | null> {
        const key = `drug_interactions:${medicationHash}`;
        return this.get(key);
    }

    /**
     * Cache lab reference ranges
     */
    async cacheLabReferenceRanges(
        testCode: string,
        referenceRanges: any,
        ttl: number = 7 * 24 * 60 * 60 * 1000 // 7 days
    ): Promise<void> {
        const key = `lab_ranges:${testCode}`;
        const tags = ['lab_ranges', 'reference_data'];

        await this.set(key, referenceRanges, ttl, tags);
    }

    /**
     * Get cached lab reference ranges
     */
    async getCachedLabReferenceRanges(testCode: string): Promise<any | null> {
        const key = `lab_ranges:${testCode}`;
        return this.get(key);
    }

    /**
     * Cache FHIR mapping data
     */
    async cacheFHIRMapping(
        mappingKey: string,
        mapping: any,
        ttl: number = 24 * 60 * 60 * 1000 // 24 hours
    ): Promise<void> {
        const key = `fhir_mapping:${mappingKey}`;
        const tags = ['fhir_mapping', 'integration'];

        await this.set(key, mapping, ttl, tags);
    }

    /**
     * Get cached FHIR mapping
     */
    async getCachedFHIRMapping(mappingKey: string): Promise<any | null> {
        const key = `fhir_mapping:${mappingKey}`;
        return this.get(key);
    }

    /**
     * Cache patient diagnostic history summary
     */
    async cachePatientSummary(
        patientId: string,
        workplaceId: string,
        summary: any,
        ttl: number = 30 * 60 * 1000 // 30 minutes
    ): Promise<void> {
        const key = `patient_summary:${workplaceId}:${patientId}`;
        const tags = ['patient_summary', 'diagnostic_history'];

        await this.set(key, summary, ttl, tags);
    }

    /**
     * Get cached patient summary
     */
    async getCachedPatientSummary(patientId: string, workplaceId: string): Promise<any | null> {
        const key = `patient_summary:${workplaceId}:${patientId}`;
        return this.get(key);
    }

    /**
     * Generic cache set method
     */
    private async set(
        key: string,
        value: any,
        ttl: number = this.config.defaultTTL,
        tags: string[] = []
    ): Promise<void> {
        const startTime = Date.now();

        try {
            // Check if we need to evict entries
            await this.ensureCapacity();

            const now = new Date();
            const expiresAt = new Date(now.getTime() + ttl);
            const size = this.calculateSize(value);

            const entry: CacheEntry = {
                key,
                value: this.config.enableCompression ? this.compress(value) : value,
                createdAt: now,
                expiresAt,
                accessCount: 0,
                lastAccessed: now,
                tags,
                size,
            };

            this.cache.set(key, entry);

            if (this.config.enableMetrics) {
                this.updateAccessMetrics(Date.now() - startTime);
            }

            logger.debug('Cache entry set', {
                key,
                size,
                ttl,
                tags,
                totalEntries: this.cache.size,
            });
        } catch (error) {
            logger.error('Failed to set cache entry', {
                key,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Generic cache get method
     */
    private async get<T = any>(key: string): Promise<T | null> {
        const startTime = Date.now();

        try {
            const entry = this.cache.get(key);

            if (!entry) {
                this.stats.misses++;
                return null;
            }

            // Check if entry is expired
            if (entry.expiresAt < new Date()) {
                this.cache.delete(key);
                this.stats.misses++;
                return null;
            }

            // Update access statistics
            entry.accessCount++;
            entry.lastAccessed = new Date();
            this.cache.set(key, entry);

            this.stats.hits++;

            if (this.config.enableMetrics) {
                this.updateAccessMetrics(Date.now() - startTime);
            }

            const value = this.config.enableCompression ?
                this.decompress(entry.value) : entry.value;

            logger.debug('Cache hit', {
                key,
                accessCount: entry.accessCount,
                age: Date.now() - entry.createdAt.getTime(),
            });

            return value;
        } catch (error) {
            logger.error('Failed to get cache entry', {
                key,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            this.stats.misses++;
            return null;
        }
    }

    /**
     * Delete cache entry
     */
    async delete(key: string): Promise<boolean> {
        const deleted = this.cache.delete(key);

        if (deleted) {
            logger.debug('Cache entry deleted', { key });
        }

        return deleted;
    }

    /**
     * Clear cache entries by tag
     */
    async clearByTag(tag: string): Promise<number> {
        let deletedCount = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (entry.tags.includes(tag)) {
                this.cache.delete(key);
                deletedCount++;
            }
        }

        logger.info('Cache entries cleared by tag', {
            tag,
            deletedCount,
        });

        return deletedCount;
    }

    /**
     * Clear all cache entries
     */
    async clear(): Promise<void> {
        const entryCount = this.cache.size;
        this.cache.clear();

        logger.info('Cache cleared', { entryCount });
    }

    /**
     * Generate cache key hash for complex objects
     */
    generateCacheKey(prefix: string, data: any): string {
        const normalizedData = this.normalizeForHashing(data);
        const hash = crypto
            .createHash('sha256')
            .update(JSON.stringify(normalizedData))
            .digest('hex')
            .substring(0, 16);

        return `${prefix}:${hash}`;
    }

    /**
     * Normalize data for consistent hashing
     */
    private normalizeForHashing(data: any): any {
        if (Array.isArray(data)) {
            return data.map(item => this.normalizeForHashing(item)).sort();
        }

        if (data && typeof data === 'object') {
            const normalized: any = {};
            const sortedKeys = Object.keys(data).sort();

            for (const key of sortedKeys) {
                normalized[key] = this.normalizeForHashing(data[key]);
            }

            return normalized;
        }

        return data;
    }

    /**
     * Ensure cache capacity limits
     */
    private async ensureCapacity(): Promise<void> {
        // Check entry count limit
        if (this.cache.size >= this.config.maxEntries) {
            await this.evictLRU(Math.floor(this.config.maxEntries * 0.1)); // Evict 10%
        }

        // Check size limit
        const totalSize = this.getTotalSize();
        if (totalSize >= this.config.maxSize) {
            await this.evictLRU(Math.floor(this.cache.size * 0.1)); // Evict 10%
        }
    }

    /**
     * Evict least recently used entries
     */
    private async evictLRU(count: number): Promise<void> {
        const entries = Array.from(this.cache.entries())
            .map(([key, entry]) => ({ key, entry }))
            .sort((a, b) => a.entry.lastAccessed.getTime() - b.entry.lastAccessed.getTime());

        const toEvict = entries.slice(0, count);

        for (const { key } of toEvict) {
            this.cache.delete(key);
            this.stats.evictions++;
        }

        if (toEvict.length > 0) {
            logger.debug('LRU eviction completed', {
                evictedCount: toEvict.length,
                remainingEntries: this.cache.size,
            });
        }
    }

    /**
     * Clean up expired entries
     */
    private async cleanupExpired(): Promise<void> {
        const now = new Date();
        let expiredCount = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (entry.expiresAt < now) {
                this.cache.delete(key);
                expiredCount++;
            }
        }

        if (expiredCount > 0) {
            logger.debug('Expired entries cleaned up', {
                expiredCount,
                remainingEntries: this.cache.size,
            });
        }
    }

    /**
     * Calculate size of data in bytes
     */
    private calculateSize(data: any): number {
        try {
            return Buffer.byteLength(JSON.stringify(data), 'utf8');
        } catch (error) {
            return 0;
        }
    }

    /**
     * Get total cache size
     */
    private getTotalSize(): number {
        let totalSize = 0;

        for (const entry of this.cache.values()) {
            totalSize += entry.size;
        }

        return totalSize;
    }

    /**
     * Compress data (simplified - in production use proper compression)
     */
    private compress(data: any): any {
        // In production, use zlib or similar compression
        return data;
    }

    /**
     * Decompress data
     */
    private decompress(data: any): any {
        // In production, use zlib or similar decompression
        return data;
    }

    /**
     * Update access metrics
     */
    private updateAccessMetrics(accessTime: number): void {
        this.stats.accessCount++;
        this.stats.totalAccessTime += accessTime;
    }

    /**
     * Get cache statistics
     */
    getStats(): CacheStats {
        const totalRequests = this.stats.hits + this.stats.misses;

        return {
            totalEntries: this.cache.size,
            totalSize: this.getTotalSize(),
            hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
            missRate: totalRequests > 0 ? this.stats.misses / totalRequests : 0,
            evictionCount: this.stats.evictions,
            averageAccessTime: this.stats.accessCount > 0 ?
                this.stats.totalAccessTime / this.stats.accessCount : 0,
        };
    }

    /**
     * Get cache entries by tag
     */
    getEntriesByTag(tag: string): CacheEntry[] {
        const entries: CacheEntry[] = [];

        for (const entry of this.cache.values()) {
            if (entry.tags.includes(tag)) {
                entries.push(entry);
            }
        }

        return entries;
    }

    /**
     * Get cache health status
     */
    getHealthStatus(): {
        isHealthy: boolean;
        issues: string[];
        recommendations: string[];
    } {
        const stats = this.getStats();
        const issues: string[] = [];
        const recommendations: string[] = [];

        // Check hit rate
        if (stats.hitRate < 0.5) {
            issues.push('Low cache hit rate');
            recommendations.push('Consider increasing TTL or cache size');
        }

        // Check memory usage
        const memoryUsagePercent = stats.totalSize / this.config.maxSize;
        if (memoryUsagePercent > 0.9) {
            issues.push('High memory usage');
            recommendations.push('Consider increasing cache size or reducing TTL');
        }

        // Check eviction rate
        if (stats.evictionCount > stats.totalEntries * 0.1) {
            issues.push('High eviction rate');
            recommendations.push('Consider increasing cache capacity');
        }

        return {
            isHealthy: issues.length === 0,
            issues,
            recommendations,
        };
    }

    /**
     * Start cleanup timer
     */
    private startCleanupTimer(): void {
        this.cleanupTimer = setInterval(() => {
            this.cleanupExpired();
        }, this.config.cleanupInterval);
    }

    /**
     * Stop cleanup timer
     */
    stopCleanupTimer(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = undefined;
        }
    }

    /**
     * Warm up cache with frequently accessed data
     */
    async warmUp(warmupData: Array<{
        key: string;
        value: any;
        ttl?: number;
        tags?: string[];
    }>): Promise<void> {
        logger.info('Starting cache warmup', {
            itemCount: warmupData.length,
        });

        for (const item of warmupData) {
            await this.set(
                item.key,
                item.value,
                item.ttl || this.config.defaultTTL,
                item.tags || []
            );
        }

        logger.info('Cache warmup completed', {
            itemCount: warmupData.length,
            totalEntries: this.cache.size,
        });
    }

    /**
     * Export cache data for backup
     */
    exportCache(): Array<{
        key: string;
        value: any;
        expiresAt: Date;
        tags: string[];
    }> {
        const exportData: Array<{
            key: string;
            value: any;
            expiresAt: Date;
            tags: string[];
        }> = [];

        for (const [key, entry] of this.cache.entries()) {
            exportData.push({
                key,
                value: this.config.enableCompression ?
                    this.decompress(entry.value) : entry.value,
                expiresAt: entry.expiresAt,
                tags: entry.tags,
            });
        }

        return exportData;
    }

    /**
     * Import cache data from backup
     */
    async importCache(importData: Array<{
        key: string;
        value: any;
        expiresAt: Date;
        tags: string[];
    }>): Promise<void> {
        logger.info('Starting cache import', {
            itemCount: importData.length,
        });

        for (const item of importData) {
            const ttl = item.expiresAt.getTime() - Date.now();

            if (ttl > 0) {
                await this.set(item.key, item.value, ttl, item.tags);
            }
        }

        logger.info('Cache import completed', {
            itemCount: importData.length,
            totalEntries: this.cache.size,
        });
    }
}

export default new DiagnosticCacheService();