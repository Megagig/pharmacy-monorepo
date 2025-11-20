/**
 * Startup Validation Service
 * 
 * Runs critical validations and fixes on server startup
 * Ensures data integrity before the application starts serving requests
 */

import PricingPlanSyncService from '../services/PricingPlanSyncService';
import logger from '../utils/logger';

class StartupValidationService {
    /**
     * Run all startup validations and fixes
     */
    async runStartupValidations(): Promise<void> {
        logger.info('🚀 Starting startup validations...');

        try {
            // 1. Sync pricing plans with feature flags
            await this.syncPricingPlans();

            // 2. Validate and fix subscription planId references
            await this.validateSubscriptions();

            logger.info('✅ All startup validations completed successfully');
        } catch (error) {
            logger.error('❌ Startup validation failed:', error);
            // Don't throw - let the server start even if validation fails
            // Admin can manually fix issues through the UI
        }
    }

    /**
     * Sync all pricing plans with current feature flags
     */
    private async syncPricingPlans(): Promise<void> {
        try {
            logger.info('📋 Syncing pricing plans with feature flags...');

            const result = await PricingPlanSyncService.syncAllPlansWithFeatureFlags();

            if (result.success) {
                logger.info(`✅ Pricing plans synced: ${result.updated} updated`);
            } else {
                logger.warn(`⚠️  Pricing plans sync completed with errors: ${result.failed} failed`);
                result.errors.forEach((error) => logger.error(`   - ${error}`));
            }
        } catch (error) {
            logger.error('❌ Failed to sync pricing plans:', error);
        }
    }

    /**
     * Validate and fix all subscription planId references
     */
    private async validateSubscriptions(): Promise<void> {
        try {
            logger.info('🔍 Validating subscription planId references...');

            const result = await PricingPlanSyncService.validateAndFixSubscriptions();

            if (result.success) {
                logger.info(`✅ Subscriptions validated: ${result.updated} fixed`);
            } else {
                logger.warn(`⚠️  Subscription validation completed with errors: ${result.failed} failed`);
                result.errors.forEach((error) => logger.error(`   - ${error}`));
            }
        } catch (error) {
            logger.error('❌ Failed to validate subscriptions:', error);
        }
    }
}

export default new StartupValidationService();
