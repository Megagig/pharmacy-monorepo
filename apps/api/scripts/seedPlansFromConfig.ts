#!/usr/bin/env ts-node

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import PlanSeeder from '../src/utils/planSeeder';
import logger from '../src/utils/logger';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

/**
 * Standalone script to seed subscription plans from configuration
 */
async function seedPlansFromConfig(): Promise<void> {
    let connection: typeof mongoose | null = null;

    try {
        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!mongoUri) {
            throw new Error('MONGODB_URI or MONGO_URI environment variable is required');
        }

        logger.info('Connecting to MongoDB...');
        connection = await mongoose.connect(mongoUri);
        logger.info('Connected to MongoDB successfully');

        // Create seeder instance
        const seeder = new PlanSeeder();

        // Validate configuration first
        logger.info('Validating plan configuration...');
        const isValid = await seeder.validateConfiguration();

        if (!isValid) {
            throw new Error('Plan configuration validation failed');
        }

        // Get stats before seeding
        const statsBefore = await seeder.getSeedingStats();
        logger.info('Stats before seeding:', statsBefore);

        // Perform seeding
        await seeder.seedPlans();

        // Get stats after seeding
        const statsAfter = await seeder.getSeedingStats();
        logger.info('Stats after seeding:', statsAfter);

        logger.info('Plan seeding completed successfully!');

    } catch (error) {
        logger.error('Plan seeding failed:', error);
        process.exit(1);
    } finally {
        // Close database connection
        if (connection) {
            await mongoose.disconnect();
            logger.info('Disconnected from MongoDB');
        }
    }
}

/**
 * Handle script execution
 */
if (require.main === module) {
    seedPlansFromConfig()
        .then(() => {
            logger.info('Script completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            logger.error('Script failed:', error);
            process.exit(1);
        });
}

export default seedPlansFromConfig;