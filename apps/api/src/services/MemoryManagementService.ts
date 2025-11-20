import logger from '../utils/logger';

/**
 * Memory Management Service for monitoring and managing application memory usage
 */
export class MemoryManagementService {
    private static instance: MemoryManagementService;
    private isMonitoring = false;
    private monitoringInterval: NodeJS.Timeout | null = null;
    private readonly MONITORING_INTERVAL_MS = 30000; // 30 seconds

    private constructor() { }

    public static getInstance(): MemoryManagementService {
        if (!MemoryManagementService.instance) {
            MemoryManagementService.instance = new MemoryManagementService();
        }
        return MemoryManagementService.instance;
    }

    /**
     * Start memory monitoring
     */
    public startMonitoring(): void {
        if (this.isMonitoring) {
            logger.warn('Memory monitoring is already active');
            return;
        }

        const memoryThreshold = parseInt(process.env.MEMORY_THRESHOLD || '90');
        const cleanupEnabled = process.env.MEMORY_CLEANUP_ENABLED === 'true';

        if (!cleanupEnabled) {
            logger.info('Memory cleanup is disabled, skipping monitoring setup');
            return;
        }

        this.isMonitoring = true;
        this.monitoringInterval = setInterval(() => {
            this.checkMemoryUsage(memoryThreshold);
        }, this.MONITORING_INTERVAL_MS);

        logger.info(`Memory monitoring started with threshold: ${memoryThreshold}%`);
    }

    /**
     * Stop memory monitoring
     */
    public stopMonitoring(): void {
        if (!this.isMonitoring) {
            return;
        }

        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }

        this.isMonitoring = false;
        logger.info('Memory monitoring stopped');
    }

    /**
     * Get current memory usage statistics
     */
    public getMemoryStats(): {
        used: number;
        total: number;
        percentage: number;
        rss: number;
        heapTotal: number;
        heapUsed: number;
        external: number;
    } {
        const memUsage = process.memoryUsage();
        const totalMem = require('os').totalmem();
        const usedMem = memUsage.rss; // Resident Set Size
        const percentage = Math.round((usedMem / totalMem) * 100);

        return {
            used: usedMem,
            total: totalMem,
            percentage,
            rss: memUsage.rss,
            heapTotal: memUsage.heapTotal,
            heapUsed: memUsage.heapUsed,
            external: memUsage.external
        };
    }

    /**
     * Check memory usage and perform cleanup if needed
     */
    private checkMemoryUsage(threshold: number): void {
        const stats = this.getMemoryStats();

        logger.debug('Memory usage check', {
            percentage: stats.percentage,
            used: Math.round(stats.used / 1024 / 1024) + 'MB',
            threshold: threshold + '%'
        });

        if (stats.percentage >= threshold) {
            logger.warn(`Memory usage threshold exceeded: ${stats.percentage}% (threshold: ${threshold}%)`);
            this.performMemoryCleanup();
        }
    }

    /**
     * Perform memory cleanup operations
     */
    private performMemoryCleanup(): void {
        logger.info('Starting memory cleanup operations');

        try {
            // Force garbage collection if available
            if (global.gc) {
                logger.debug('Forcing garbage collection');
                global.gc();
            }

            // Clear any caches that might be holding memory
            this.clearApplicationCaches();

            // Log memory usage after cleanup
            setTimeout(() => {
                const stats = this.getMemoryStats();
                logger.info('Memory cleanup completed', {
                    percentage: stats.percentage,
                    used: Math.round(stats.used / 1024 / 1024) + 'MB'
                });
            }, 1000);

        } catch (error) {
            logger.error('Error during memory cleanup:', error);
        }
    }

    /**
     * Clear application caches
     */
    private clearApplicationCaches(): void {
        try {
            // Clear module cache (carefully - only non-essential modules)
            const clearedModules = this.clearModuleCache();

            // Clear any other application-specific caches
            this.clearCustomCaches();

            logger.debug(`Cleared ${clearedModules} modules from cache`);

        } catch (error) {
            logger.error('Error clearing application caches:', error);
        }
    }

    /**
     * Clear module cache (non-essential modules only)
     */
    private clearModuleCache(): number {
        let clearedCount = 0;

        try {
            // Get all loaded modules
            const modules = Object.keys(require.cache);

            // Clear only specific modules that are safe to reload
            const safeToClear = modules.filter(modulePath => {
                // Avoid clearing core modules, application entry points, and database connections
                return !modulePath.includes('node_modules') &&
                    !modulePath.includes('app.ts') &&
                    !modulePath.includes('server.ts') &&
                    !modulePath.includes('database') &&
                    !modulePath.includes('redis') &&
                    !modulePath.includes('mongoose');
            });

            safeToClear.forEach(modulePath => {
                delete require.cache[modulePath];
                clearedCount++;
            });

        } catch (error) {
            logger.error('Error clearing module cache:', error);
        }

        return clearedCount;
    }

    /**
     * Clear custom application caches
     */
    private clearCustomCaches(): void {
        try {
            // This can be extended to clear specific application caches
            // For now, we'll just trigger any available cleanup hooks

            // Clear any global caches that might exist
            if (global.gc) {
                // Additional cleanup can be added here
            }

        } catch (error) {
            logger.error('Error clearing custom caches:', error);
        }
    }

    /**
     * Get memory usage report
     */
    public getMemoryReport(): {
        current: ReturnType<typeof this.getMemoryStats>;
        monitoring: {
            active: boolean;
            interval: number;
            threshold: number;
        };
        recommendations: string[];
    } {
        const stats = this.getMemoryStats();
        const threshold = parseInt(process.env.MEMORY_THRESHOLD || '90');

        const recommendations: string[] = [];

        if (stats.percentage > 80) {
            recommendations.push('High memory usage detected. Consider optimizing memory usage.');
        }

        if (stats.heapUsed / stats.heapTotal > 0.9) {
            recommendations.push('Heap memory is nearly full. Consider optimizing object allocations.');
        }

        return {
            current: stats,
            monitoring: {
                active: this.isMonitoring,
                interval: this.MONITORING_INTERVAL_MS,
                threshold
            },
            recommendations
        };
    }

    /**
     * Check if memory monitoring is active
     */
    public isMonitoringActive(): boolean {
        return this.isMonitoring;
    }
}

export default MemoryManagementService.getInstance();
