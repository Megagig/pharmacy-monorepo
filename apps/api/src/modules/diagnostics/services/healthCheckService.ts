import logger from '../../../utils/logger';
import deploymentConfig from '../config/deploymentConfig';
import diagnosticCacheService from './diagnosticCacheService';
import performanceOptimizationService from './performanceOptimizationService';
import apiKeyManagementService from './apiKeyManagementService';

/**
 * Health Check Service
 * Comprehensive health monitoring for all diagnostic services
 */

export interface HealthCheckResult {
    service: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    responseTime: number;
    details: any;
    timestamp: Date;
    error?: string;
}

export interface SystemHealthStatus {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    services: HealthCheckResult[];
    summary: {
        healthy: number;
        degraded: number;
        unhealthy: number;
        totalServices: number;
    };
    uptime: number;
    version: string;
    environment: string;
    timestamp: Date;
}

export interface HealthCheckConfig {
    timeout: number;
    retryAttempts: number;
    checkInterval: number;
    alertThresholds: {
        responseTime: number;
        errorRate: number;
        consecutiveFailures: number;
    };
}

class HealthCheckService {
    private healthHistory: Map<string, HealthCheckResult[]> = new Map();
    private alertCounts: Map<string, number> = new Map();
    private lastHealthCheck: Date | null = null;
    private healthCheckTimer?: NodeJS.Timeout;

    private readonly config: HealthCheckConfig = {
        timeout: 10000, // 10 seconds
        retryAttempts: 2,
        checkInterval: 30000, // 30 seconds
        alertThresholds: {
            responseTime: 5000, // 5 seconds
            errorRate: 0.1, // 10%
            consecutiveFailures: 3,
        },
    };

    constructor() {
        this.startPeriodicHealthChecks();
    }

    /**
     * Perform comprehensive system health check
     */
    async performHealthCheck(): Promise<SystemHealthStatus> {
        const startTime = Date.now();
        logger.info('Starting comprehensive health check');

        const services = [
            this.checkDatabaseHealth(),
            this.checkCacheHealth(),
            this.checkAIServiceHealth(),
            this.checkExternalAPIHealth(),
            this.checkBackgroundJobHealth(),
            this.checkMemoryHealth(),
            this.checkDiskHealth(),
            this.checkNetworkHealth(),
        ];

        const results = await Promise.allSettled(services);
        const healthResults: HealthCheckResult[] = [];

        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            if (result && result.status === 'fulfilled') {
                healthResults.push((result as PromiseFulfilledResult<HealthCheckResult>).value);
            } else {
                const rejectedResult = result as PromiseRejectedResult;
                healthResults.push({
                    service: `service_${i}`,
                    status: 'unhealthy',
                    responseTime: Date.now() - startTime,
                    details: { error: rejectedResult.reason },
                    timestamp: new Date(),
                    error: rejectedResult.reason instanceof Error ? rejectedResult.reason.message : 'Unknown error',
                });
            }
        }

        // Store health history
        for (const healthResult of healthResults) {
            this.storeHealthHistory(healthResult);
        }

        // Calculate overall health
        const summary = this.calculateHealthSummary(healthResults);
        const overall = this.determineOverallHealth(summary);

        const systemHealth: SystemHealthStatus = {
            overall,
            services: healthResults,
            summary,
            uptime: process.uptime(),
            version: process.env.npm_package_version || '1.0.0',
            environment: deploymentConfig.getEnvironment(),
            timestamp: new Date(),
        };

        this.lastHealthCheck = new Date();

        // Check for alerts
        await this.checkHealthAlerts(healthResults);

        logger.info('Health check completed', {
            overall,
            totalTime: Date.now() - startTime,
            healthyServices: summary.healthy,
            unhealthyServices: summary.unhealthy,
        });

        return systemHealth;
    }

    /**
     * Check database health
     */
    private async checkDatabaseHealth(): Promise<HealthCheckResult> {
        const startTime = Date.now();

        try {
            // Simulate database health check
            // In production, this would check actual MongoDB connection
            const connectionStats = {
                connected: true,
                connectionCount: 10,
                activeQueries: 2,
                averageResponseTime: 50,
            };

            const responseTime = Date.now() - startTime;

            return {
                service: 'database',
                status: connectionStats.connected ? 'healthy' : 'unhealthy',
                responseTime,
                details: connectionStats,
                timestamp: new Date(),
            };
        } catch (error) {
            return {
                service: 'database',
                status: 'unhealthy',
                responseTime: Date.now() - startTime,
                details: {},
                timestamp: new Date(),
                error: error instanceof Error ? error.message : 'Database connection failed',
            };
        }
    }

    /**
     * Check cache health
     */
    private async checkCacheHealth(): Promise<HealthCheckResult> {
        const startTime = Date.now();

        try {
            const cacheStats = diagnosticCacheService.getStats();
            const cacheHealth = diagnosticCacheService.getHealthStatus();

            const status = cacheHealth.isHealthy ? 'healthy' :
                cacheHealth.issues.length > 0 ? 'degraded' : 'unhealthy';

            return {
                service: 'cache',
                status,
                responseTime: Date.now() - startTime,
                details: {
                    stats: cacheStats,
                    health: cacheHealth,
                },
                timestamp: new Date(),
            };
        } catch (error) {
            return {
                service: 'cache',
                status: 'unhealthy',
                responseTime: Date.now() - startTime,
                details: {},
                timestamp: new Date(),
                error: error instanceof Error ? error.message : 'Cache health check failed',
            };
        }
    }

    /**
     * Check AI service health
     */
    private async checkAIServiceHealth(): Promise<HealthCheckResult> {
        const startTime = Date.now();

        try {
            // Test AI service connectivity
            const testResult = await this.testAIServiceConnectivity();

            const status = testResult.isConnected ? 'healthy' : 'unhealthy';

            return {
                service: 'ai_service',
                status,
                responseTime: testResult.responseTime,
                details: {
                    connected: testResult.isConnected,
                    model: deploymentConfig.getAIConfig().model,
                    rateLimits: deploymentConfig.getAIConfig().rateLimits,
                },
                timestamp: new Date(),
                error: testResult.error,
            };
        } catch (error) {
            return {
                service: 'ai_service',
                status: 'unhealthy',
                responseTime: Date.now() - startTime,
                details: {},
                timestamp: new Date(),
                error: error instanceof Error ? error.message : 'AI service health check failed',
            };
        }
    }

    /**
     * Check external API health
     */
    private async checkExternalAPIHealth(): Promise<HealthCheckResult> {
        const startTime = Date.now();

        try {
            const serviceHealth = apiKeyManagementService.getServiceHealthStatus();
            const healthyServices = Object.values(serviceHealth).filter(s => s.isHealthy).length;
            const totalServices = Object.keys(serviceHealth).length;

            const healthPercentage = healthyServices / totalServices;
            const status = healthPercentage >= 0.8 ? 'healthy' :
                healthPercentage >= 0.5 ? 'degraded' : 'unhealthy';

            return {
                service: 'external_apis',
                status,
                responseTime: Date.now() - startTime,
                details: {
                    serviceHealth,
                    healthyServices,
                    totalServices,
                    healthPercentage: Math.round(healthPercentage * 100),
                },
                timestamp: new Date(),
            };
        } catch (error) {
            return {
                service: 'external_apis',
                status: 'unhealthy',
                responseTime: Date.now() - startTime,
                details: {},
                timestamp: new Date(),
                error: error instanceof Error ? error.message : 'External API health check failed',
            };
        }
    }

    /**
     * Check background job health
     */
    private async checkBackgroundJobHealth(): Promise<HealthCheckResult> {
        const startTime = Date.now();

        try {
            const performanceMetrics = performanceOptimizationService.getPerformanceMetrics();
            const jobMetrics = performanceMetrics.backgroundJobs;

            const failureRate = jobMetrics.totalJobs > 0 ?
                jobMetrics.failedJobs / jobMetrics.totalJobs : 0;

            const status = failureRate < 0.05 ? 'healthy' :
                failureRate < 0.15 ? 'degraded' : 'unhealthy';

            return {
                service: 'background_jobs',
                status,
                responseTime: Date.now() - startTime,
                details: {
                    totalJobs: jobMetrics.totalJobs,
                    completedJobs: jobMetrics.completedJobs,
                    failedJobs: jobMetrics.failedJobs,
                    failureRate: Math.round(failureRate * 100),
                    averageProcessingTime: jobMetrics.averageProcessingTime,
                },
                timestamp: new Date(),
            };
        } catch (error) {
            return {
                service: 'background_jobs',
                status: 'unhealthy',
                responseTime: Date.now() - startTime,
                details: {},
                timestamp: new Date(),
                error: error instanceof Error ? error.message : 'Background job health check failed',
            };
        }
    }

    /**
     * Check memory health
     */
    private async checkMemoryHealth(): Promise<HealthCheckResult> {
        const startTime = Date.now();

        try {
            const memoryUsage = process.memoryUsage();
            const heapUsagePercent = memoryUsage.heapUsed / memoryUsage.heapTotal;

            const status = heapUsagePercent < 0.7 ? 'healthy' :
                heapUsagePercent < 0.9 ? 'degraded' : 'unhealthy';

            return {
                service: 'memory',
                status,
                responseTime: Date.now() - startTime,
                details: {
                    heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
                    heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
                    heapUsagePercent: Math.round(heapUsagePercent * 100),
                    external: Math.round(memoryUsage.external / 1024 / 1024), // MB
                    rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
                },
                timestamp: new Date(),
            };
        } catch (error) {
            return {
                service: 'memory',
                status: 'unhealthy',
                responseTime: Date.now() - startTime,
                details: {},
                timestamp: new Date(),
                error: error instanceof Error ? error.message : 'Memory health check failed',
            };
        }
    }

    /**
     * Check disk health
     */
    private async checkDiskHealth(): Promise<HealthCheckResult> {
        const startTime = Date.now();

        try {
            // Simulate disk health check
            // In production, use fs.stat or similar to check disk space
            const diskStats = {
                totalSpace: 100 * 1024 * 1024 * 1024, // 100GB
                freeSpace: 60 * 1024 * 1024 * 1024,   // 60GB
                usedSpace: 40 * 1024 * 1024 * 1024,   // 40GB
            };

            const usagePercent = diskStats.usedSpace / diskStats.totalSpace;
            const status = usagePercent < 0.8 ? 'healthy' :
                usagePercent < 0.95 ? 'degraded' : 'unhealthy';

            return {
                service: 'disk',
                status,
                responseTime: Date.now() - startTime,
                details: {
                    totalSpaceGB: Math.round(diskStats.totalSpace / 1024 / 1024 / 1024),
                    freeSpaceGB: Math.round(diskStats.freeSpace / 1024 / 1024 / 1024),
                    usedSpaceGB: Math.round(diskStats.usedSpace / 1024 / 1024 / 1024),
                    usagePercent: Math.round(usagePercent * 100),
                },
                timestamp: new Date(),
            };
        } catch (error) {
            return {
                service: 'disk',
                status: 'unhealthy',
                responseTime: Date.now() - startTime,
                details: {},
                timestamp: new Date(),
                error: error instanceof Error ? error.message : 'Disk health check failed',
            };
        }
    }

    /**
     * Check network health
     */
    private async checkNetworkHealth(): Promise<HealthCheckResult> {
        const startTime = Date.now();

        try {
            // Test network connectivity to external services
            const networkTests = await Promise.allSettled([
                this.testNetworkConnectivity('google.com', 80),
                this.testNetworkConnectivity('api.openai.com', 443),
                this.testNetworkConnectivity('rxnav.nlm.nih.gov', 443),
            ]);

            const successfulTests = networkTests.filter(test => test.status === 'fulfilled').length;
            const totalTests = networkTests.length;
            const successRate = successfulTests / totalTests;

            const status = successRate >= 0.8 ? 'healthy' :
                successRate >= 0.5 ? 'degraded' : 'unhealthy';

            return {
                service: 'network',
                status,
                responseTime: Date.now() - startTime,
                details: {
                    successfulTests,
                    totalTests,
                    successRate: Math.round(successRate * 100),
                    testResults: networkTests.map((test, index) => ({
                        test: index,
                        status: test.status,
                        result: test.status === 'fulfilled' ? test.value : test.reason,
                    })),
                },
                timestamp: new Date(),
            };
        } catch (error) {
            return {
                service: 'network',
                status: 'unhealthy',
                responseTime: Date.now() - startTime,
                details: {},
                timestamp: new Date(),
                error: error instanceof Error ? error.message : 'Network health check failed',
            };
        }
    }

    /**
     * Test AI service connectivity
     */
    private async testAIServiceConnectivity(): Promise<{
        isConnected: boolean;
        responseTime: number;
        error?: string;
    }> {
        const startTime = Date.now();

        try {
            // Simulate AI service test
            // In production, make actual API call to test endpoint
            await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

            const isConnected = Math.random() > 0.1; // 90% success rate simulation

            return {
                isConnected,
                responseTime: Date.now() - startTime,
                error: isConnected ? undefined : 'AI service unavailable',
            };
        } catch (error) {
            return {
                isConnected: false,
                responseTime: Date.now() - startTime,
                error: error instanceof Error ? error.message : 'AI service test failed',
            };
        }
    }

    /**
     * Test network connectivity
     */
    private async testNetworkConnectivity(host: string, port: number): Promise<boolean> {
        try {
            // Simulate network connectivity test
            // In production, use net.connect or similar
            await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
            return Math.random() > 0.05; // 95% success rate simulation
        } catch (error) {
            return false;
        }
    }

    /**
     * Store health history for trending
     */
    private storeHealthHistory(result: HealthCheckResult): void {
        const history = this.healthHistory.get(result.service) || [];
        history.push(result);

        // Keep only last 100 results per service
        if (history.length > 100) {
            history.shift();
        }

        this.healthHistory.set(result.service, history);
    }

    /**
     * Calculate health summary
     */
    private calculateHealthSummary(results: HealthCheckResult[]): {
        healthy: number;
        degraded: number;
        unhealthy: number;
        totalServices: number;
    } {
        const summary = {
            healthy: 0,
            degraded: 0,
            unhealthy: 0,
            totalServices: results.length,
        };

        for (const result of results) {
            switch (result.status) {
                case 'healthy':
                    summary.healthy++;
                    break;
                case 'degraded':
                    summary.degraded++;
                    break;
                case 'unhealthy':
                    summary.unhealthy++;
                    break;
            }
        }

        return summary;
    }

    /**
     * Determine overall system health
     */
    private determineOverallHealth(summary: {
        healthy: number;
        degraded: number;
        unhealthy: number;
        totalServices: number;
    }): 'healthy' | 'degraded' | 'unhealthy' {
        const healthyPercent = summary.healthy / summary.totalServices;
        const unhealthyPercent = summary.unhealthy / summary.totalServices;

        if (unhealthyPercent > 0.3) {
            return 'unhealthy';
        } else if (healthyPercent < 0.7 || summary.degraded > 0) {
            return 'degraded';
        } else {
            return 'healthy';
        }
    }

    /**
     * Check for health alerts
     */
    private async checkHealthAlerts(results: HealthCheckResult[]): Promise<void> {
        for (const result of results) {
            const alertCount = this.alertCounts.get(result.service) || 0;

            if (result.status === 'unhealthy') {
                this.alertCounts.set(result.service, alertCount + 1);

                if (alertCount + 1 >= this.config.alertThresholds.consecutiveFailures) {
                    await this.triggerAlert(result, 'consecutive_failures');
                }
            } else {
                // Reset alert count on successful check
                this.alertCounts.set(result.service, 0);
            }

            // Check response time threshold
            if (result.responseTime > this.config.alertThresholds.responseTime) {
                await this.triggerAlert(result, 'slow_response');
            }
        }
    }

    /**
     * Trigger health alert
     */
    private async triggerAlert(result: HealthCheckResult, alertType: string): Promise<void> {
        logger.warn('Health alert triggered', {
            service: result.service,
            alertType,
            status: result.status,
            responseTime: result.responseTime,
            error: result.error,
        });

        // In production, send alerts to monitoring systems, Slack, email, etc.
    }

    /**
     * Start periodic health checks
     */
    private startPeriodicHealthChecks(): void {
        const interval = deploymentConfig.getMonitoringConfig().healthCheckInterval;

        this.healthCheckTimer = setInterval(async () => {
            try {
                await this.performHealthCheck();
            } catch (error) {
                logger.error('Periodic health check failed', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }, interval);

        logger.info('Periodic health checks started', { interval });
    }

    /**
     * Stop periodic health checks
     */
    stopPeriodicHealthChecks(): void {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = undefined;
            logger.info('Periodic health checks stopped');
        }
    }

    /**
     * Get health history for a service
     */
    getHealthHistory(service: string): HealthCheckResult[] {
        return this.healthHistory.get(service) || [];
    }

    /**
     * Get health trends
     */
    getHealthTrends(): {
        service: string;
        trend: 'improving' | 'stable' | 'degrading';
        recentAvailability: number;
        averageResponseTime: number;
    }[] {
        const trends = [];

        for (const [service, history] of this.healthHistory.entries()) {
            if (history.length < 5) continue; // Need at least 5 data points

            const recent = history.slice(-10); // Last 10 checks
            const older = history.slice(-20, -10); // Previous 10 checks

            const recentHealthy = recent.filter(r => r.status === 'healthy').length;
            const olderHealthy = older.length > 0 ? older.filter(r => r.status === 'healthy').length : recentHealthy;

            const recentAvailability = recentHealthy / recent.length;
            const olderAvailability = older.length > 0 ? olderHealthy / older.length : recentAvailability;

            let trend: 'improving' | 'stable' | 'degrading' = 'stable';
            if (recentAvailability > olderAvailability + 0.1) {
                trend = 'improving';
            } else if (recentAvailability < olderAvailability - 0.1) {
                trend = 'degrading';
            }

            const averageResponseTime = recent.reduce((sum, r) => sum + r.responseTime, 0) / recent.length;

            trends.push({
                service,
                trend,
                recentAvailability: Math.round(recentAvailability * 100),
                averageResponseTime: Math.round(averageResponseTime),
            });
        }

        return trends;
    }

    /**
     * Get last health check time
     */
    getLastHealthCheckTime(): Date | null {
        return this.lastHealthCheck;
    }

    /**
     * Force immediate health check
     */
    async forceHealthCheck(): Promise<SystemHealthStatus> {
        logger.info('Forcing immediate health check');
        return this.performHealthCheck();
    }
}

export default new HealthCheckService();