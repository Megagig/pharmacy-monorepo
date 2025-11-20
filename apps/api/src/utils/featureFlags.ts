/**
 * Feature Flags System for Clinical Interventions Module
 * Enables gradual rollout and A/B testing of new features
 */

import mongoose from 'mongoose';
import logger from './logger';
import { config } from '../config/environments';

export interface FeatureFlag {
    name: string;
    description: string;
    enabled: boolean;
    rolloutPercentage: number; // 0-100
    conditions?: {
        workplaceIds?: string[];
        userRoles?: string[];
        subscriptionPlans?: string[];
        environment?: string[];
    };
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
}

export interface FeatureFlagEvaluation {
    flagName: string;
    enabled: boolean;
    reason: string;
    metadata?: Record<string, any>;
}

/**
 * Feature Flag Schema
 */
const featureFlagSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    description: {
        type: String,
        required: true,
    },
    enabled: {
        type: Boolean,
        default: false,
        index: true,
    },
    rolloutPercentage: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
    },
    conditions: {
        workplaceIds: [String],
        userRoles: [String],
        subscriptionPlans: [String],
        environment: [String],
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
    createdBy: {
        type: String,
        required: true,
    },
});

featureFlagSchema.pre('save', function () {
    this.updatedAt = new Date();
});

const FeatureFlagModel = mongoose.model('FeatureFlag', featureFlagSchema);

/**
 * Feature Flag Manager
 */
export class FeatureFlagManager {
    private static cache: Map<string, FeatureFlag> = new Map();
    private static cacheExpiry: number = 0;
    private static cacheTTL: number = 5 * 60 * 1000; // 5 minutes

    /**
     * Initialize default feature flags for Clinical Interventions
     */
    static async initializeDefaultFlags(): Promise<void> {
        const defaultFlags: Omit<FeatureFlag, 'createdAt' | 'updatedAt'>[] = [
            {
                name: 'clinical_interventions_enabled',
                description: 'Enable Clinical Interventions module',
                enabled: config.featureFlags.enableClinicalInterventions,
                rolloutPercentage: 100,
                createdBy: 'system',
                metadata: {
                    module: 'clinical_interventions',
                    category: 'core',
                },
            },
            {
                name: 'advanced_reporting_enabled',
                description: 'Enable advanced reporting features',
                enabled: config.featureFlags.enableAdvancedReporting,
                rolloutPercentage: 100,
                createdBy: 'system',
                metadata: {
                    module: 'clinical_interventions',
                    category: 'reporting',
                },
            },
            {
                name: 'bulk_operations_enabled',
                description: 'Enable bulk operations for interventions',
                enabled: config.featureFlags.enableBulkOperations,
                rolloutPercentage: 0, // Start disabled
                createdBy: 'system',
                metadata: {
                    module: 'clinical_interventions',
                    category: 'operations',
                },
            },
            {
                name: 'mtr_integration_enabled',
                description: 'Enable MTR integration features',
                enabled: config.featureFlags.enableMTRIntegration,
                rolloutPercentage: 100,
                createdBy: 'system',
                metadata: {
                    module: 'clinical_interventions',
                    category: 'integration',
                },
            },
            {
                name: 'performance_monitoring_enabled',
                description: 'Enable performance monitoring and metrics',
                enabled: config.featureFlags.enablePerformanceMonitoring,
                rolloutPercentage: 100,
                createdBy: 'system',
                metadata: {
                    module: 'clinical_interventions',
                    category: 'monitoring',
                },
            },
            {
                name: 'export_features_enabled',
                description: 'Enable data export features',
                enabled: config.featureFlags.enableExportFeatures,
                rolloutPercentage: 100,
                createdBy: 'system',
                metadata: {
                    module: 'clinical_interventions',
                    category: 'export',
                },
            },
            {
                name: 'notifications_enabled',
                description: 'Enable notification features',
                enabled: config.featureFlags.enableNotifications,
                rolloutPercentage: 100,
                createdBy: 'system',
                metadata: {
                    module: 'clinical_interventions',
                    category: 'notifications',
                },
            },
            {
                name: 'audit_logging_enabled',
                description: 'Enable comprehensive audit logging',
                enabled: config.featureFlags.enableAuditLogging,
                rolloutPercentage: 100,
                createdBy: 'system',
                metadata: {
                    module: 'clinical_interventions',
                    category: 'security',
                },
            },
            {
                name: 'intervention_templates_enabled',
                description: 'Enable intervention templates feature',
                enabled: false,
                rolloutPercentage: 0,
                createdBy: 'system',
                metadata: {
                    module: 'clinical_interventions',
                    category: 'templates',
                    experimental: true,
                },
            },
            {
                name: 'ai_recommendations_enabled',
                description: 'Enable AI-powered intervention recommendations',
                enabled: false,
                rolloutPercentage: 0,
                conditions: {
                    environment: ['staging', 'development'],
                },
                createdBy: 'system',
                metadata: {
                    module: 'clinical_interventions',
                    category: 'ai',
                    experimental: true,
                },
            },
        ];

        for (const flagData of defaultFlags) {
            try {
                await FeatureFlagModel.findOneAndUpdate(
                    { name: flagData.name },
                    {
                        ...flagData,
                        updatedAt: new Date(),
                    },
                    {
                        upsert: true,
                        new: true,
                        setDefaultsOnInsert: true,
                    }
                );
            } catch (error) {
                logger.error(`Failed to initialize feature flag ${flagData.name}:`, error);
            }
        }

        logger.info('Default feature flags initialized');
    }

    /**
     * Get all feature flags
     */
    static async getAllFlags(): Promise<FeatureFlag[]> {
        try {
            return await FeatureFlagModel.find({}).sort({ name: 1 }).lean();
        } catch (error) {
            logger.error('Failed to get feature flags:', error);
            return [];
        }
    }

    /**
     * Get feature flag by name
     */
    static async getFlag(name: string): Promise<FeatureFlag | null> {
        try {
            // Check cache first
            if (this.isCacheValid() && this.cache.has(name)) {
                return this.cache.get(name) || null;
            }

            const flag = await FeatureFlagModel.findOne({ name }).lean();

            if (flag) {
                this.cache.set(name, flag);
            }

            return flag;
        } catch (error) {
            logger.error(`Failed to get feature flag ${name}:`, error);
            return null;
        }
    }

    /**
     * Update feature flag
     */
    static async updateFlag(
        name: string,
        updates: Partial<FeatureFlag>,
        updatedBy: string
    ): Promise<FeatureFlag | null> {
        try {
            const flag = await FeatureFlagModel.findOneAndUpdate(
                { name },
                {
                    ...updates,
                    updatedAt: new Date(),
                },
                { new: true }
            ).lean();

            if (flag) {
                // Update cache
                this.cache.set(name, flag);

                logger.info(`Feature flag ${name} updated by ${updatedBy}`, {
                    flagName: name,
                    updates,
                    updatedBy,
                });
            }

            return flag;
        } catch (error) {
            logger.error(`Failed to update feature flag ${name}:`, error);
            return null;
        }
    }

    /**
     * Create new feature flag
     */
    static async createFlag(
        flagData: Omit<FeatureFlag, 'createdAt' | 'updatedAt'>
    ): Promise<FeatureFlag | null> {
        try {
            const flag = await FeatureFlagModel.create({
                ...flagData,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const flagObj = flag.toObject();
            this.cache.set(flagObj.name, flagObj);

            logger.info(`Feature flag ${flagData.name} created by ${flagData.createdBy}`);
            return flagObj;
        } catch (error) {
            logger.error(`Failed to create feature flag ${flagData.name}:`, error);
            return null;
        }
    }

    /**
     * Delete feature flag
     */
    static async deleteFlag(name: string, deletedBy: string): Promise<boolean> {
        try {
            const result = await FeatureFlagModel.deleteOne({ name });

            if (result.deletedCount > 0) {
                this.cache.delete(name);
                logger.info(`Feature flag ${name} deleted by ${deletedBy}`);
                return true;
            }

            return false;
        } catch (error) {
            logger.error(`Failed to delete feature flag ${name}:`, error);
            return false;
        }
    }

    /**
     * Evaluate feature flag for a specific context
     */
    static async isEnabled(
        flagName: string,
        context: {
            workplaceId?: string;
            userId?: string;
            userRole?: string;
            subscriptionPlan?: string;
        } = {}
    ): Promise<FeatureFlagEvaluation> {
        try {
            const flag = await this.getFlag(flagName);

            if (!flag) {
                return {
                    flagName,
                    enabled: false,
                    reason: 'Flag not found',
                };
            }

            // Check if flag is globally disabled
            if (!flag.enabled) {
                return {
                    flagName,
                    enabled: false,
                    reason: 'Flag globally disabled',
                };
            }

            // Check environment conditions
            if (flag.conditions?.environment && flag.conditions.environment.length > 0) {
                if (!flag.conditions.environment.includes(config.environment)) {
                    return {
                        flagName,
                        enabled: false,
                        reason: `Environment ${config.environment} not in allowed list`,
                    };
                }
            }

            // Check workplace conditions
            if (flag.conditions?.workplaceIds && flag.conditions.workplaceIds.length > 0) {
                if (!context.workplaceId || !flag.conditions.workplaceIds.includes(context.workplaceId)) {
                    return {
                        flagName,
                        enabled: false,
                        reason: 'Workplace not in allowed list',
                    };
                }
            }

            // Check user role conditions
            if (flag.conditions?.userRoles && flag.conditions.userRoles.length > 0) {
                if (!context.userRole || !flag.conditions.userRoles.includes(context.userRole)) {
                    return {
                        flagName,
                        enabled: false,
                        reason: 'User role not in allowed list',
                    };
                }
            }

            // Check subscription plan conditions
            if (flag.conditions?.subscriptionPlans && flag.conditions.subscriptionPlans.length > 0) {
                if (!context.subscriptionPlan || !flag.conditions.subscriptionPlans.includes(context.subscriptionPlan)) {
                    return {
                        flagName,
                        enabled: false,
                        reason: 'Subscription plan not in allowed list',
                    };
                }
            }

            // Check rollout percentage
            if (flag.rolloutPercentage < 100) {
                const hash = this.hashString(flagName + (context.workplaceId || context.userId || ''));
                const percentage = hash % 100;

                if (percentage >= flag.rolloutPercentage) {
                    return {
                        flagName,
                        enabled: false,
                        reason: `Not in rollout percentage (${percentage}% >= ${flag.rolloutPercentage}%)`,
                    };
                }
            }

            return {
                flagName,
                enabled: true,
                reason: 'All conditions met',
                metadata: flag.metadata,
            };
        } catch (error: any) {
            logger.error(`Failed to evaluate feature flag ${flagName}:`, error);
            return {
                flagName,
                enabled: false,
                reason: `Evaluation error: ${error.message}`,
            };
        }
    }

    /**
     * Bulk evaluate multiple flags
     */
    static async evaluateFlags(
        flagNames: string[],
        context: {
            workplaceId?: string;
            userId?: string;
            userRole?: string;
            subscriptionPlan?: string;
        } = {}
    ): Promise<Record<string, FeatureFlagEvaluation>> {
        const results: Record<string, FeatureFlagEvaluation> = {};

        await Promise.all(
            flagNames.map(async (flagName) => {
                results[flagName] = await this.isEnabled(flagName, context);
            })
        );

        return results;
    }

    /**
     * Get flags for a specific module
     */
    static async getModuleFlags(module: string): Promise<FeatureFlag[]> {
        try {
            return await FeatureFlagModel.find({
                'metadata.module': module,
            }).sort({ name: 1 }).lean();
        } catch (error) {
            logger.error(`Failed to get module flags for ${module}:`, error);
            return [];
        }
    }

    /**
     * Clear cache
     */
    static clearCache(): void {
        this.cache.clear();
        this.cacheExpiry = 0;
        logger.debug('Feature flag cache cleared');
    }

    /**
     * Refresh cache
     */
    static async refreshCache(): Promise<void> {
        try {
            const flags = await this.getAllFlags();
            this.cache.clear();

            for (const flag of flags) {
                this.cache.set(flag.name, flag);
            }

            this.cacheExpiry = Date.now() + this.cacheTTL;
            logger.debug(`Feature flag cache refreshed with ${flags.length} flags`);
        } catch (error) {
            logger.error('Failed to refresh feature flag cache:', error);
        }
    }

    /**
     * Private helper methods
     */
    private static isCacheValid(): boolean {
        return Date.now() < this.cacheExpiry;
    }

    private static hashString(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }
}

/**
 * Middleware to inject feature flags into request context
 */
export const featureFlagMiddleware = async (req: any, res: any, next: any) => {
    try {
        const context = {
            workplaceId: req.user?.workplaceId?.toString(),
            userId: req.user?._id?.toString(),
            userRole: req.user?.role,
            subscriptionPlan: req.user?.subscriptionPlan,
        };

        // Evaluate common flags
        const commonFlags = [
            'clinical_interventions_enabled',
            'advanced_reporting_enabled',
            'bulk_operations_enabled',
            'mtr_integration_enabled',
            'export_features_enabled',
            'notifications_enabled',
        ];

        req.featureFlags = await FeatureFlagManager.evaluateFlags(commonFlags, context);
        req.evaluateFlag = (flagName: string) => FeatureFlagManager.isEnabled(flagName, context);

        next();
    } catch (error) {
        logger.error('Feature flag middleware error:', error);
        req.featureFlags = {};
        req.evaluateFlag = () => Promise.resolve({ flagName: '', enabled: false, reason: 'Middleware error' });
        next();
    }
};

/**
 * Initialize feature flags system
 */
export const initializeFeatureFlags = async (): Promise<void> => {
    try {
        await FeatureFlagManager.initializeDefaultFlags();
        await FeatureFlagManager.refreshCache();

        // Refresh cache periodically
        setInterval(() => {
            FeatureFlagManager.refreshCache();
        }, FeatureFlagManager['cacheTTL']);

        logger.info('Feature flags system initialized');
    } catch (error) {
        logger.error('Failed to initialize feature flags system:', error);
        throw error;
    }
};

export default FeatureFlagManager;