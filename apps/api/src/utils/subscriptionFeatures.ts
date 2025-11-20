/**
 * Subscription Features Utility
 * 
 * This utility helps build the complete features array for subscriptions
 * by combining plan features with active feature flags.
 */

import { ISubscriptionPlan } from '../models/SubscriptionPlan';
import FeatureFlag from '../models/FeatureFlag';
import logger from './logger';

/**
 * Get all features that should be enabled for a subscription
 * Combines plan features with feature flags that are allowed for the tier
 * 
 * @param plan - The subscription plan
 * @param tier - The subscription tier
 * @returns Array of feature keys
 */
export async function getSubscriptionFeatures(
  plan: ISubscriptionPlan,
  tier: string
): Promise<string[]> {
  const features: string[] = [];

  try {
    // 1. Add plan features (boolean fields from plan.features)
    if (plan.features) {
      Object.entries(plan.features).forEach(([key, value]) => {
        if (value === true) {
          features.push(key);
        }
      });
    }

    // 2. Add feature flags that are allowed for this tier
    const featureFlags = await FeatureFlag.find({
      isActive: true,
      allowedTiers: tier,
    });

    for (const flag of featureFlags) {
      // Only add if not already in the list
      if (!features.includes(flag.key)) {
        features.push(flag.key);
      }
    }

    logger.info(`Built features for tier ${tier}: ${features.join(', ')}`);
    
    return features;
  } catch (error) {
    logger.error('Error building subscription features:', error);
    
    // Fallback: return plan features only
    if (plan.features) {
      return Object.keys(plan.features).filter(
        (key: string) => (plan.features as any)[key] === true
      );
    }
    
    return [];
  }
}

/**
 * Update subscription features based on current feature flags
 * Useful for updating existing subscriptions when feature flags change
 * 
 * @param subscriptionId - The subscription ID
 * @param tier - The subscription tier
 */
export async function updateSubscriptionFeatures(
  subscriptionId: any,
  tier: string
): Promise<string[]> {
  try {
    const Subscription = (await import('../models/Subscription')).Subscription;
    const SubscriptionPlan = (await import('../models/SubscriptionPlan')).default;
    
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const plan = await SubscriptionPlan.findById(subscription.planId);
    if (!plan) {
      throw new Error('Plan not found');
    }

    const features = await getSubscriptionFeatures(plan, tier);
    
    // Update subscription
    subscription.features = features;
    await subscription.save();

    logger.info(`Updated features for subscription ${subscriptionId}: ${features.join(', ')}`);
    
    return features;
  } catch (error) {
    logger.error('Error updating subscription features:', error);
    throw error;
  }
}

/**
 * Sync all active subscriptions with current feature flags
 * This should be called when feature flags are updated via the admin panel
 */
export async function syncAllSubscriptionFeatures(): Promise<{
  updated: number;
  failed: number;
  total: number;
}> {
  try {
    const Subscription = (await import('../models/Subscription')).Subscription;
    const SubscriptionPlan = (await import('../models/SubscriptionPlan')).default;
    
    const subscriptions = await Subscription.find({
      status: { $in: ['active', 'trial', 'past_due'] }
    });

    let updated = 0;
    let failed = 0;

    for (const subscription of subscriptions) {
      try {
        const plan = await SubscriptionPlan.findById(subscription.planId);
        if (!plan) {
          logger.warn(`Plan not found for subscription ${subscription._id}`);
          failed++;
          continue;
        }

        const features = await getSubscriptionFeatures(plan, subscription.tier);
        
        // Update using updateOne to avoid validation issues
        await Subscription.updateOne(
          { _id: subscription._id },
          { $set: { features } }
        );

        updated++;
      } catch (error) {
        logger.error(`Error updating subscription ${subscription._id}:`, error);
        failed++;
      }
    }

    logger.info(`Synced subscription features: ${updated} updated, ${failed} failed, ${subscriptions.length} total`);

    return {
      updated,
      failed,
      total: subscriptions.length,
    };
  } catch (error) {
    logger.error('Error syncing subscription features:', error);
    throw error;
  }
}
