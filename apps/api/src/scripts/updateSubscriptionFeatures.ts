import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Subscription from '../models/Subscription';
// Import SubscriptionPlan to register the model
import '../models/SubscriptionPlan';
import connectDB from '../config/db';
import logger from '../utils/logger';
import plansConfig from '../config/plans.json';

// Load environment variables
dotenv.config();

/**
 * Script to update existing subscriptions with new diagnostic features
 */

async function updateSubscriptionFeatures() {
    try {
        // Connect to database
        await connectDB();
        logger.info('Connected to database');

        // Get all active subscriptions
        const subscriptions = await Subscription.find({
            status: { $in: ['active', 'trial'] }
        }).populate('planId');

        logger.info(`Found ${subscriptions.length} active subscriptions to update`);

        let updatedCount = 0;

        for (const subscription of subscriptions) {
            try {
                const planId = subscription.planId as any;
                if (!planId) {
                    logger.warn(`Subscription ${subscription._id} has no plan, skipping`);
                    continue;
                }

                // Get the plan configuration from plans.json
                const planConfig = Object.values(plansConfig.plans).find(
                    (plan: any) => plan.tier === subscription.tier
                ) as any;

                if (!planConfig) {
                    logger.warn(`No plan configuration found for tier: ${subscription.tier}`);
                    continue;
                }

                // Update subscription features with the new diagnostic features
                const newFeatures = [...new Set([
                    ...subscription.features,
                    ...planConfig.features
                ])];

                // Check if features actually changed
                const featuresChanged = newFeatures.length !== subscription.features.length ||
                    !newFeatures.every(feature => subscription.features.includes(feature));

                if (featuresChanged) {
                    subscription.features = newFeatures;
                    await subscription.save();
                    updatedCount++;

                    logger.info(`✅ Updated subscription for workspace ${subscription.workspaceId}`, {
                        tier: subscription.tier,
                        addedFeatures: newFeatures.filter(f => !subscription.features.includes(f)),
                        totalFeatures: newFeatures.length
                    });
                } else {
                    logger.info(`⏭️  Subscription for workspace ${subscription.workspaceId} already up to date`);
                }

            } catch (error) {
                logger.error(`❌ Failed to update subscription ${subscription._id}:`, error);
            }
        }

        logger.info(`\n📊 Summary:`);
        logger.info(`- Total subscriptions checked: ${subscriptions.length}`);
        logger.info(`- Subscriptions updated: ${updatedCount}`);
        logger.info(`- Subscriptions already up to date: ${subscriptions.length - updatedCount}`);

        if (updatedCount > 0) {
            logger.info('\n🎉 Subscription features have been successfully updated!');
            logger.info('\nThe following diagnostic features are now available:');
            logger.info('- ai_diagnostics: AI-powered diagnostic analysis');
            logger.info('- clinical_decision_support: Clinical decision support workflows');
            logger.info('- drug_information: Drug interaction checking and information');
        } else {
            logger.info('\n✅ All subscriptions were already up to date!');
        }

    } catch (error) {
        logger.error('❌ Failed to update subscription features:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        logger.info('Database connection closed');
    }
}

// Run the script
if (require.main === module) {
    updateSubscriptionFeatures()
        .then(() => {
            logger.info('Script completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            logger.error('Script failed:', error);
            process.exit(1);
        });
}

export default updateSubscriptionFeatures;