/**
 * Pricing Plan Sync Service
 * 
 * Automatically syncs FeatureFlag changes with PricingPlan documents
 * Ensures feature toggles in the UI reflect in actual permission checks
 */

import PricingPlan from '../models/PricingPlan';
import { FeatureFlag } from '../models/FeatureFlag';
import Subscription from '../models/Subscription';
import logger from '../utils/logger';

interface SyncResult {
    success: boolean;
    updated: number;
    failed: number;
    errors: string[];
}

class PricingPlanSyncService {
    /**
     * Sync all pricing plans with current feature flags
     * This ensures PricingPlan.features arrays match FeatureFlag.allowedTiers
     */
    async syncAllPlansWithFeatureFlags(): Promise<SyncResult> {
        const result: SyncResult = {
            success: true,
            updated: 0,
            failed: 0,
            errors: [],
        };

        try {
            logger.info('🔄 Starting pricing plan sync with feature flags...');

            // Get all active feature flags
            const featureFlags = await FeatureFlag.find({ isActive: true });
            logger.info(`📋 Found ${featureFlags.length} active feature flags`);

            // Get all pricing plans
            const pricingPlans = await PricingPlan.find({ isActive: true });
            logger.info(`📋 Found ${pricingPlans.length} active pricing plans`);

            // Build a map of tier -> features
            const tierFeatureMap: Record<string, string[]> = {};

            // Initialize all tiers with empty arrays
            const allTiers = ['free_trial', 'basic', 'pro', 'pharmily', 'network', 'enterprise'];
            allTiers.forEach((tier) => {
                tierFeatureMap[tier] = [];
            });

            // Populate the map from feature flags
            featureFlags.forEach((flag) => {
                if (flag.allowedTiers && flag.allowedTiers.length > 0) {
                    flag.allowedTiers.forEach((tier) => {
                        if (!tierFeatureMap[tier]) {
                            tierFeatureMap[tier] = [];
                        }
                        if (!tierFeatureMap[tier].includes(flag.key)) {
                            tierFeatureMap[tier].push(flag.key);
                        }
                    });
                }
            });

            // Update each pricing plan
            for (const plan of pricingPlans) {
                try {
                    const tierFeatures = tierFeatureMap[plan.tier] || [];

                    // Only update if features have changed
                    const currentFeatures = plan.features || [];
                    const featuresChanged =
                        tierFeatures.length !== currentFeatures.length ||
                        tierFeatures.some((f) => !currentFeatures.includes(f)) ||
                        currentFeatures.some((f) => !tierFeatures.includes(f));

                    if (featuresChanged) {
                        plan.features = tierFeatures;
                        await plan.save();
                        result.updated++;
                        logger.info(`✅ Updated plan: ${plan.name} (${plan.tier}) with ${tierFeatures.length} features`);
                    } else {
                        logger.info(`⏭️  Skipped plan: ${plan.name} (${plan.tier}) - no changes needed`);
                    }
                } catch (error) {
                    result.failed++;
                    const errorMessage = `Failed to update plan ${plan.name}: ${error instanceof Error ? error.message : String(error)}`;
                    result.errors.push(errorMessage);
                    logger.error(errorMessage);
                }
            }

            logger.info(`✅ Pricing plan sync completed: ${result.updated} updated, ${result.failed} failed`);
            result.success = result.failed === 0;
        } catch (error) {
            result.success = false;
            const errorMessage = `Pricing plan sync failed: ${error instanceof Error ? error.message : String(error)}`;
            result.errors.push(errorMessage);
            logger.error(errorMessage);
        }

        return result;
    }

    /**
     * Sync a specific tier's features with feature flags
     */
    async syncTierFeatures(tier: string): Promise<SyncResult> {
        const result: SyncResult = {
            success: true,
            updated: 0,
            failed: 0,
            errors: [],
        };

        try {
            logger.info(`🔄 Syncing features for tier: ${tier}`);

            // Get all active feature flags for this tier
            const featureFlags = await FeatureFlag.find({
                isActive: true,
                allowedTiers: tier,
            });

            const featureKeys = featureFlags.map((f) => f.key);
            logger.info(`📋 Found ${featureKeys.length} features for tier: ${tier}`);

            // Update all plans for this tier
            const plans = await PricingPlan.find({ tier, isActive: true });

            for (const plan of plans) {
                try {
                    // Only update if features have changed
                    const currentFeatures = plan.features || [];
                    const featuresChanged =
                        featureKeys.length !== currentFeatures.length ||
                        featureKeys.some((f) => !currentFeatures.includes(f)) ||
                        currentFeatures.some((f) => !featureKeys.includes(f));

                    if (featuresChanged) {
                        plan.features = featureKeys;
                        await plan.save();
                        result.updated++;
                        logger.info(`✅ Updated plan: ${plan.name} with ${featureKeys.length} features`);
                    }
                } catch (error) {
                    result.failed++;
                    const errorMessage = `Failed to update plan ${plan.name}: ${error instanceof Error ? error.message : String(error)}`;
                    result.errors.push(errorMessage);
                    logger.error(errorMessage);
                }
            }

            result.success = result.failed === 0;
        } catch (error) {
            result.success = false;
            const errorMessage = `Tier sync failed: ${error instanceof Error ? error.message : String(error)}`;
            result.errors.push(errorMessage);
            logger.error(errorMessage);
        }

        return result;
    }

    /**
     * Validate and fix subscription planId references
     * Ensures all subscriptions reference valid PricingPlan documents
     */
    async validateAndFixSubscriptions(): Promise<SyncResult> {
        const result: SyncResult = {
            success: true,
            updated: 0,
            failed: 0,
            errors: [],
        };

        try {
            logger.info('🔍 Validating subscription planId references...');

            // Get all active subscriptions
            const subscriptions = await Subscription.find({
                status: { $in: ['trial', 'active', 'past_due'] },
            });

            logger.info(`📋 Found ${subscriptions.length} active subscriptions to validate`);

            for (const subscription of subscriptions) {
                try {
                    // Try to populate the planId
                    await subscription.populate('planId');

                    // Check if plan exists
                    if (!subscription.planId) {
                        logger.warn(`⚠️  Subscription ${subscription._id} has invalid planId, attempting to fix...`);

                        // Find a valid plan for this tier
                        const validPlan = await PricingPlan.findOne({
                            tier: subscription.tier,
                            isActive: true,
                        }).sort({ order: 1 });

                        if (validPlan) {
                            subscription.planId = validPlan._id;
                            await subscription.save();
                            result.updated++;
                            logger.info(`✅ Fixed subscription ${subscription._id} to use plan ${validPlan.name}`);
                        } else {
                            result.failed++;
                            result.errors.push(
                                `No valid plan found for subscription ${subscription._id} with tier ${subscription.tier}`
                            );
                        }
                    } else {
                        logger.info(`✅ Subscription ${subscription._id} has valid planId`);
                    }
                } catch (error) {
                    result.failed++;
                    const errorMessage = `Failed to validate subscription ${subscription._id}: ${error instanceof Error ? error.message : String(error)}`;
                    result.errors.push(errorMessage);
                    logger.error(errorMessage);
                }
            }

            logger.info(`✅ Subscription validation completed: ${result.updated} fixed, ${result.failed} failed`);
            result.success = result.failed === 0;
        } catch (error) {
            result.success = false;
            const errorMessage = `Subscription validation failed: ${error instanceof Error ? error.message : String(error)}`;
            result.errors.push(errorMessage);
            logger.error(errorMessage);
        }

        return result;
    }

    /**
     * Get all pricing plans with their current features
     */
    async getAllPlansWithFeatures() {
        try {
            const plans = await PricingPlan.find().sort({ order: 1 });

            return plans.map((plan) => ({
                _id: plan._id,
                name: plan.name,
                slug: plan.slug,
                tier: plan.tier,
                price: plan.price,
                billingPeriod: plan.billingPeriod,
                features: plan.features || [],
                featureCount: (plan.features || []).length,
                isActive: plan.isActive,
                isPopular: plan.isPopular,
                order: plan.order,
            }));
        } catch (error) {
            logger.error('Error fetching plans with features:', error);
            throw error;
        }
    }

    /**
     * Update a specific plan's features
     */
    async updatePlanFeatures(planId: string, features: string[]): Promise<boolean> {
        try {
            const plan = await PricingPlan.findById(planId);

            if (!plan) {
                throw new Error('Pricing plan not found');
            }

            plan.features = features;
            await plan.save();

            logger.info(`✅ Updated plan ${plan.name} features: ${features.length} features`);
            return true;
        } catch (error) {
            logger.error('Error updating plan features:', error);
            throw error;
        }
    }
}

export default new PricingPlanSyncService();
