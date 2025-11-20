import SubscriptionPlan from '../models/SubscriptionPlan';
import PlanSeeder from './planSeeder';
import logger from './logger';

/**
 * Utility to ensure subscription plans are seeded from configuration
 * This can be called during application startup
 */
export async function ensurePlansSeeded(): Promise<void> {
    try {
        // Check if any plans exist in the database
        const planCount = await SubscriptionPlan.countDocuments();

        if (planCount === 0) {
            logger.info('No subscription plans found in database, seeding from configuration...');

            const seeder = new PlanSeeder();
            await seeder.seedPlans();

            logger.info('Initial plan seeding completed');
        } else {
            logger.info(`Found ${planCount} subscription plans in database`);

            // Optionally validate that all configured plans exist
            const seeder = new PlanSeeder();
            const stats = await seeder.getSeedingStats();

            if (stats.totalPlansInConfig > stats.activePlansInDatabase) {
                logger.warn(`Configuration has ${stats.totalPlansInConfig} plans but database has only ${stats.activePlansInDatabase} active plans`);
                logger.info('Consider running plan seeding to sync configuration with database');
            }
        }
    } catch (error) {
        logger.error('Failed to ensure plans are seeded:', error);
        // Don't throw error to prevent application startup failure
        // Just log the error and continue
    }
}

/**
 * Force reseed all plans from configuration
 * This will update existing plans and create new ones
 */
export async function forceReseedPlans(): Promise<void> {
    try {
        logger.info('Force reseeding subscription plans from configuration...');

        const seeder = new PlanSeeder();
        await seeder.seedPlans();

        logger.info('Force reseed completed');
    } catch (error) {
        logger.error('Failed to force reseed plans:', error);
        throw error;
    }
}

/**
 * Get plan seeding status and statistics
 */
export async function getPlanSeedingStatus(): Promise<{
    isSeeded: boolean;
    stats: {
        totalPlansInConfig: number;
        totalPlansInDatabase: number;
        activePlansInDatabase: number;
        lastSeededAt?: Date;
    };
    needsSeeding: boolean;
}> {
    try {
        const seeder = new PlanSeeder();
        const stats = await seeder.getSeedingStats();

        const isSeeded = stats.totalPlansInDatabase > 0;
        const needsSeeding = stats.totalPlansInConfig > stats.activePlansInDatabase;

        return {
            isSeeded,
            stats,
            needsSeeding
        };
    } catch (error) {
        logger.error('Failed to get plan seeding status:', error);
        throw error;
    }
}