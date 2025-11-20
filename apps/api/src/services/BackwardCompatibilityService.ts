import { IUser } from '../models/User';
import { WorkspaceContext, PermissionResult } from '../types/auth';
import PermissionService from './PermissionService';
import DynamicPermissionService, { DynamicPermissionResult } from './DynamicPermissionService';
import FeatureFlag from '../models/FeatureFlag';
import logger from '../utils/logger';

/**
 * Backward Compatibility Service for RBAC Migration
 * Provides seamless transition between static and dynamic RBAC systems
 */

interface CompatibilityConfig {
    enableDynamicRBAC: boolean;
    enableLegacyFallback: boolean;
    enableDeprecationWarnings: boolean;
    migrationPhase: 'preparation' | 'migration' | 'validation' | 'cleanup';
    rolloutPercentage: number;
}

interface PermissionCheckMetrics {
    dynamicChecks: number;
    legacyChecks: number;
    fallbackUsage: number;
    errors: number;
    averageResponseTime: number;
}

export class BackwardCompatibilityService {
    private static instance: BackwardCompatibilityService;
    private config: CompatibilityConfig;
    private metrics: PermissionCheckMetrics;
    private legacyPermissionService: PermissionService;
    private dynamicPermissionService: DynamicPermissionService;

    private constructor() {
        this.config = {
            enableDynamicRBAC: false,
            enableLegacyFallback: true,
            enableDeprecationWarnings: true,
            migrationPhase: 'preparation',
            rolloutPercentage: 0
        };

        this.metrics = {
            dynamicChecks: 0,
            legacyChecks: 0,
            fallbackUsage: 0,
            errors: 0,
            averageResponseTime: 0
        };

        this.legacyPermissionService = PermissionService.getInstance();
        this.dynamicPermissionService = DynamicPermissionService.getInstance();
    }

    public static getInstance(): BackwardCompatibilityService {
        if (!BackwardCompatibilityService.instance) {
            BackwardCompatibilityService.instance = new BackwardCompatibilityService();
        }
        return BackwardCompatibilityService.instance;
    }

    /**
     * Initialize compatibility service with feature flags
     */
    async initialize(): Promise<void> {
        try {
            await this.loadConfiguration();
            logger.info('Backward compatibility service initialized', {
                config: this.config
            });
        } catch (error) {
            logger.error('Failed to initialize backward compatibility service:', error);
            // Fall back to safe defaults
            this.config.enableDynamicRBAC = false;
            this.config.enableLegacyFallback = true;
        }
    }

    /**
     * Main permission check with compatibility layer
     */
    async checkPermission(
        context: WorkspaceContext,
        user: IUser,
        action: string,
        options: {
            forceMethod?: 'dynamic' | 'legacy';
            enableMetrics?: boolean;
        } = {}
    ): Promise<PermissionResult & { source: string; responseTime?: number }> {
        const startTime = Date.now();
        const { forceMethod, enableMetrics = true } = options;

        try {
            // Determine which method to use
            const useMethod = await this.determinePermissionMethod(user, forceMethod);

            let result: PermissionResult & { source: string };

            if (useMethod === 'dynamic') {
                result = await this.checkDynamicPermission(context, user, action);
            } else {
                result = await this.checkLegacyPermission(context, user, action);
            }

            // Add response time if metrics enabled
            if (enableMetrics) {
                const responseTime = Date.now() - startTime;
                (result as any).responseTime = responseTime;
                this.updateMetrics(useMethod, responseTime);
            }

            // Log deprecation warnings if enabled
            if (this.config.enableDeprecationWarnings && result.source === 'legacy') {
                this.logDeprecationWarning(action, user);
            }

            return result;

        } catch (error) {
            this.metrics.errors++;
            logger.error('Permission check failed in compatibility layer:', error);

            // Return safe fallback
            return {
                allowed: false,
                reason: 'Permission check failed',
                source: 'error_fallback',
                responseTime: enableMetrics ? Date.now() - startTime : undefined
            };
        }
    }

    /**
     * Check permission using dynamic RBAC with fallback
     */
    private async checkDynamicPermission(
        context: WorkspaceContext,
        user: IUser,
        action: string
    ): Promise<PermissionResult & { source: string }> {
        try {
            const dynamicResult: DynamicPermissionResult = await this.dynamicPermissionService.checkPermission(
                user,
                action,
                context,
                {
                    workspaceId: context.workspace?._id,
                    currentTime: new Date()
                }
            );

            this.metrics.dynamicChecks++;

            // If dynamic check fails and fallback is enabled, try legacy
            if (!dynamicResult.allowed && this.config.enableLegacyFallback) {
                logger.debug(`Dynamic permission check failed for ${action}, trying legacy fallback`);

                const legacyResult = await this.legacyPermissionService.checkPermission(
                    context,
                    user,
                    action
                );

                if (legacyResult.allowed) {
                    this.metrics.fallbackUsage++;
                    logger.info(`Legacy fallback succeeded for ${action}`, {
                        userId: user._id,
                        action,
                        dynamicReason: dynamicResult.reason
                    });

                    return {
                        ...legacyResult,
                        source: 'legacy_fallback'
                    };
                }
            }

            return {
                allowed: dynamicResult.allowed,
                reason: dynamicResult.reason,
                requiredPermissions: dynamicResult.requiredPermissions,
                upgradeRequired: dynamicResult.upgradeRequired,
                source: dynamicResult.source || 'dynamic'
            };

        } catch (error) {
            logger.error('Dynamic permission check failed:', error);

            // Fallback to legacy if enabled
            if (this.config.enableLegacyFallback) {
                logger.debug('Falling back to legacy permission check due to error');
                this.metrics.fallbackUsage++;

                const legacyResult = await this.legacyPermissionService.checkPermission(
                    context,
                    user,
                    action
                );

                return {
                    ...legacyResult,
                    source: 'legacy_error_fallback'
                };
            }

            throw error;
        }
    }

    /**
     * Check permission using legacy RBAC
     */
    private async checkLegacyPermission(
        context: WorkspaceContext,
        user: IUser,
        action: string
    ): Promise<PermissionResult & { source: string }> {
        this.metrics.legacyChecks++;

        const result = await this.legacyPermissionService.checkPermission(
            context,
            user,
            action
        );

        return {
            ...result,
            source: 'legacy'
        };
    }

    /**
     * Determine which permission method to use
     */
    private async determinePermissionMethod(
        user: IUser,
        forceMethod?: 'dynamic' | 'legacy'
    ): Promise<'dynamic' | 'legacy'> {
        // Honor force method if specified
        if (forceMethod) {
            return forceMethod;
        }

        // Check if dynamic RBAC is enabled globally
        if (!this.config.enableDynamicRBAC) {
            return 'legacy';
        }

        // Check rollout percentage
        if (this.config.rolloutPercentage < 100) {
            const userHash = this.hashUserId(user._id.toString());
            const userPercentile = userHash % 100;

            if (userPercentile >= this.config.rolloutPercentage) {
                return 'legacy';
            }
        }

        // Check if user has dynamic role assignments
        if (user.assignedRoles && user.assignedRoles.length > 0) {
            return 'dynamic';
        }

        // Check migration phase
        switch (this.config.migrationPhase) {
            case 'preparation':
                return 'legacy';
            case 'migration':
                // Use dynamic for migrated users, legacy for others
                return user.roleLastModifiedAt ? 'dynamic' : 'legacy';
            case 'validation':
                // Use dynamic but validate against legacy
                return 'dynamic';
            case 'cleanup':
                return 'dynamic';
            default:
                return 'legacy';
        }
    }

    /**
     * Load configuration from feature flags
     */
    private async loadConfiguration(): Promise<void> {
        try {
            const flags = await FeatureFlag.find({
                key: { $regex: /^rbac_/ },
                isActive: true
            });

            for (const flag of flags) {
                switch (flag.key) {
                    case 'rbac_enable_dynamic':
                        this.config.enableDynamicRBAC = (flag as any).value === true;
                        break;
                    case 'rbac_enable_legacy_fallback':
                        this.config.enableLegacyFallback = (flag as any).value === true;
                        break;
                    case 'rbac_enable_deprecation_warnings':
                        this.config.enableDeprecationWarnings = (flag as any).value === true;
                        break;
                    case 'rbac_migration_phase':
                        if (['preparation', 'migration', 'validation', 'cleanup'].includes((flag as any).value)) {
                            this.config.migrationPhase = (flag as any).value;
                        }
                        break;
                    case 'rbac_rollout_percentage':
                        const percentage = parseInt((flag as any).value);
                        if (!isNaN(percentage) && percentage >= 0 && percentage <= 100) {
                            this.config.rolloutPercentage = percentage;
                        }
                        break;
                }
            }

            logger.debug('Loaded RBAC configuration from feature flags', this.config);

        } catch (error) {
            logger.error('Failed to load RBAC configuration from feature flags:', error);
            throw error;
        }
    }

    /**
     * Update configuration
     */
    async updateConfiguration(updates: Partial<CompatibilityConfig>): Promise<void> {
        const oldConfig = { ...this.config };
        this.config = { ...this.config, ...updates };

        // Update feature flags
        for (const [key, value] of Object.entries(updates)) {
            const flagKey = `rbac_${key.replace(/([A-Z])/g, '_$1').toLowerCase()}`;

            try {
                await FeatureFlag.findOneAndUpdate(
                    { key: flagKey },
                    {
                        key: flagKey,
                        value: value,
                        isActive: true,
                        lastModifiedAt: new Date()
                    },
                    { upsert: true }
                );
            } catch (error) {
                logger.error(`Failed to update feature flag ${flagKey}:`, error);
            }
        }

        logger.info('RBAC configuration updated', {
            oldConfig,
            newConfig: this.config
        });
    }

    /**
     * Get current metrics
     */
    getMetrics(): PermissionCheckMetrics & { config: CompatibilityConfig } {
        return {
            ...this.metrics,
            config: { ...this.config }
        };
    }

    /**
     * Reset metrics
     */
    resetMetrics(): void {
        this.metrics = {
            dynamicChecks: 0,
            legacyChecks: 0,
            fallbackUsage: 0,
            errors: 0,
            averageResponseTime: 0
        };
    }

    /**
     * Validate permission consistency between dynamic and legacy systems
     */
    async validatePermissionConsistency(
        context: WorkspaceContext,
        user: IUser,
        actions: string[]
    ): Promise<{
        consistent: boolean;
        inconsistencies: Array<{
            action: string;
            dynamicResult: boolean;
            legacyResult: boolean;
            dynamicReason?: string;
            legacyReason?: string;
        }>;
    }> {
        const inconsistencies: any[] = [];

        for (const action of actions) {
            try {
                // Get results from both systems
                const dynamicResult = await this.checkDynamicPermission(context, user, action);
                const legacyResult = await this.checkLegacyPermission(context, user, action);

                // Compare results
                if (dynamicResult.allowed !== legacyResult.allowed) {
                    inconsistencies.push({
                        action,
                        dynamicResult: dynamicResult.allowed,
                        legacyResult: legacyResult.allowed,
                        dynamicReason: dynamicResult.reason,
                        legacyReason: legacyResult.reason
                    });
                }
            } catch (error) {
                logger.error(`Error validating permission consistency for ${action}:`, error);
                inconsistencies.push({
                    action,
                    dynamicResult: false,
                    legacyResult: false,
                    dynamicReason: 'Validation error',
                    legacyReason: 'Validation error'
                });
            }
        }

        return {
            consistent: inconsistencies.length === 0,
            inconsistencies
        };
    }

    /**
     * Generate migration readiness report
     */
    async generateMigrationReadinessReport(): Promise<{
        readyForMigration: boolean;
        issues: string[];
        recommendations: string[];
        statistics: {
            totalUsers: number;
            migratedUsers: number;
            usersWithDynamicRoles: number;
            usersWithDirectPermissions: number;
        };
    }> {
        const issues: string[] = [];
        const recommendations: string[] = [];

        // Check system readiness
        if (!this.config.enableDynamicRBAC) {
            issues.push('Dynamic RBAC is not enabled');
            recommendations.push('Enable dynamic RBAC feature flag');
        }

        // Get user statistics
        const User = (await import('../models/User')).default;
        const UserRole = (await import('../models/UserRole')).default;

        const totalUsers = await User.countDocuments();
        const migratedUsers = await User.countDocuments({ roleLastModifiedAt: { $exists: true } });
        const usersWithDynamicRoles = await User.countDocuments({ assignedRoles: { $exists: true, $ne: [] } });
        const usersWithDirectPermissions = await User.countDocuments({ directPermissions: { $exists: true, $ne: [] } });

        const statistics = {
            totalUsers,
            migratedUsers,
            usersWithDynamicRoles,
            usersWithDirectPermissions
        };

        // Check migration completeness
        if (migratedUsers < totalUsers) {
            issues.push(`${totalUsers - migratedUsers} users have not been migrated`);
            recommendations.push('Complete user role migration before proceeding');
        }

        // Check for orphaned role assignments
        const orphanedAssignments = await UserRole.countDocuments({
            isActive: true,
            userId: { $nin: await User.distinct('_id') }
        });

        if (orphanedAssignments > 0) {
            issues.push(`${orphanedAssignments} orphaned role assignments found`);
            recommendations.push('Clean up orphaned role assignments');
        }

        const readyForMigration = issues.length === 0;

        return {
            readyForMigration,
            issues,
            recommendations,
            statistics
        };
    }

    // Helper methods
    private updateMetrics(method: 'dynamic' | 'legacy', responseTime: number): void {
        // Update response time average
        const totalChecks = this.metrics.dynamicChecks + this.metrics.legacyChecks;
        this.metrics.averageResponseTime =
            (this.metrics.averageResponseTime * (totalChecks - 1) + responseTime) / totalChecks;
    }

    private hashUserId(userId: string): number {
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            const char = userId.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    private logDeprecationWarning(action: string, user: IUser): void {
        logger.warn('Legacy RBAC usage detected', {
            action,
            userId: user._id,
            userEmail: user.email,
            message: 'This user is still using legacy RBAC. Consider migrating to dynamic RBAC.',
            migrationPhase: this.config.migrationPhase
        });
    }
}

export default BackwardCompatibilityService;