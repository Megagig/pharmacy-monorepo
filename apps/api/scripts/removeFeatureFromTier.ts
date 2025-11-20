#!/usr/bin/env ts-node

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { FeatureFlag } from '../src/models/FeatureFlag';
import Subscription from '../src/models/Subscription';

// Load environment variables
dotenv.config();

async function removeFeatureFromTier(featureKey: string, tier: string) {
  try {
    console.log(`🔧 Removing feature "${featureKey}" from tier "${tier}"...`);

    // Connect to MongoDB
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is required');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // 1. Update the feature flag to remove the tier
    const featureFlag = await FeatureFlag.findOne({ key: featureKey });
    if (!featureFlag) {
      console.log(`❌ Feature flag "${featureKey}" not found`);
      return;
    }

    console.log(`📋 Current allowed tiers: ${JSON.stringify(featureFlag.allowedTiers)}`);

    // Remove the tier from allowedTiers
    const updatedTiers = featureFlag.allowedTiers.filter(t => t !== tier);
    
    await FeatureFlag.findByIdAndUpdate(featureFlag._id, {
      allowedTiers: updatedTiers,
    });

    console.log(`✅ Updated feature flag. New allowed tiers: ${JSON.stringify(updatedTiers)}`);

    // 2. Update all subscriptions of this tier to remove the feature
    const subscriptionsToUpdate = await Subscription.find({
      tier: tier,
      features: featureKey,
    });

    console.log(`📦 Found ${subscriptionsToUpdate.length} subscriptions to update`);

    for (const subscription of subscriptionsToUpdate) {
      const updatedFeatures = subscription.features.filter(f => f !== featureKey);
      
      await Subscription.findByIdAndUpdate(subscription._id, {
        features: updatedFeatures,
      });

      console.log(`  ✅ Updated subscription ${subscription._id} (removed ${featureKey})`);
    }

    console.log(`🎉 Successfully removed "${featureKey}" from "${tier}" tier!`);
    console.log(`   - Updated feature flag allowedTiers`);
    console.log(`   - Updated ${subscriptionsToUpdate.length} subscriptions`);

  } catch (error) {
    console.error('❌ Operation failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

// Run if this script is executed directly
if (require.main === module) {
  const featureKey = process.argv[2];
  const tier = process.argv[3];

  if (!featureKey || !tier) {
    console.error('Usage: npx ts-node scripts/removeFeatureFromTier.ts <featureKey> <tier>');
    console.error('Example: npx ts-node scripts/removeFeatureFromTier.ts ai_diagnostics basic');
    process.exit(1);
  }

  removeFeatureFromTier(featureKey, tier);
}

export default removeFeatureFromTier;