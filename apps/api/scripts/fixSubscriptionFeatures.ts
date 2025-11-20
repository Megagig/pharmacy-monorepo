#!/usr/bin/env ts-node

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Subscription from '../src/models/Subscription';
import { FeatureFlag } from '../src/models/FeatureFlag';

// Load environment variables
dotenv.config();

async function fixSubscriptionFeatures() {
  try {
    console.log('🔧 Fixing subscription features arrays...');

    // Connect to MongoDB
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is required');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all subscriptions with empty or missing features arrays
    const subscriptions = await Subscription.find({
      $or: [
        { features: { $exists: false } },
        { features: { $size: 0 } },
        { features: null }
      ]
    });

    console.log(`Found ${subscriptions.length} subscriptions with empty features arrays`);

    for (const subscription of subscriptions) {
      try {
        console.log(`🔧 Fixing subscription ${subscription._id} with tier: ${subscription.tier}`);

        // Get all features available for this subscription tier
        const availableFeatures = await FeatureFlag.find({
          isActive: true,
          allowedTiers: { $in: [subscription.tier] },
        }).select('key');

        const featureKeys = availableFeatures.map(f => f.key);
        console.log(`  Found ${featureKeys.length} features for tier ${subscription.tier}: ${JSON.stringify(featureKeys)}`);

        // Update subscription with features
        await Subscription.findByIdAndUpdate(subscription._id, {
          features: featureKeys,
        });

        console.log(`  ✅ Updated subscription ${subscription._id} with ${featureKeys.length} features`);

      } catch (error) {
        console.error(`  ❌ Failed to fix subscription ${subscription._id}:`, error);
      }
    }

    console.log('🎉 Subscription features fix completed!');

  } catch (error) {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

// Run fix if this script is executed directly
if (require.main === module) {
  fixSubscriptionFeatures();
}

export default fixSubscriptionFeatures;