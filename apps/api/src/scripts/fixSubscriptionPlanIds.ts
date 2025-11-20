/**
 * Fix Script: Subscription Plan IDs
 * 
 * This script fixes subscriptions that don't have a valid planId set.
 * It matches subscriptions to plans based on their tier.
 * 
 * Run with: npx ts-node src/scripts/fixSubscriptionPlanIds.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Import models
import { Subscription } from '../models/Subscription';
import SubscriptionPlan from '../models/SubscriptionPlan';

async function fixSubscriptionPlanIds() {
  try {
    console.log('🔧 Fixing subscription planIds...\n');

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmadb';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Get all plans
    const plans = await SubscriptionPlan.find({});
    console.log(`📋 Found ${plans.length} subscription plans:\n`);
    
    const plansByTier = new Map<string, any>();
    for (const plan of plans) {
      console.log(`   - ${plan.name} (${plan.tier}) - ID: ${plan._id}`);
      
      // Store the first plan for each tier (prefer monthly)
      if (!plansByTier.has(plan.tier) || plan.billingInterval === 'monthly') {
        plansByTier.set(plan.tier, plan);
      }
    }
    console.log('');

    // Get all subscriptions
    const subscriptions = await Subscription.find({});
    console.log(`📋 Found ${subscriptions.length} subscriptions\n`);

    let fixed = 0;
    let skipped = 0;

    for (const subscription of subscriptions) {
      // Skip cancelled subscriptions (they have invalid status enum)
      const subDoc = subscription.toObject() as any;
      if (subDoc.status === 'cancelled') {
        console.log(`⏭️  Skipping cancelled subscription ${subscription._id}\n`);
        skipped++;
        continue;
      }
      
      // Check if planId is missing or invalid
      if (!subscription.planId) {
        console.log(`❌ Subscription ${subscription._id} has no planId`);
        console.log(`   Tier: ${subscription.tier}`);
        console.log(`   Status: ${subscription.status}`);
        
        // Find matching plan by tier
        const matchingPlan = plansByTier.get(subscription.tier);
        
        if (matchingPlan) {
          subscription.planId = matchingPlan._id;
          await subscription.save();
          console.log(`   ✅ Fixed: Assigned plan "${matchingPlan.name}" (${matchingPlan._id})\n`);
          fixed++;
        } else {
          console.log(`   ⚠️  No matching plan found for tier: ${subscription.tier}\n`);
          skipped++;
        }
      } else {
        // Verify planId is valid
        const plan = await SubscriptionPlan.findById(subscription.planId);
        if (!plan) {
          console.log(`❌ Subscription ${subscription._id} has invalid planId: ${subscription.planId}`);
          console.log(`   Tier: ${subscription.tier}`);
          
          // Find matching plan by tier
          const matchingPlan = plansByTier.get(subscription.tier);
          
          if (matchingPlan) {
            subscription.planId = matchingPlan._id;
            await subscription.save();
            console.log(`   ✅ Fixed: Assigned plan "${matchingPlan.name}" (${matchingPlan._id})\n`);
            fixed++;
          } else {
            console.log(`   ⚠️  No matching plan found for tier: ${subscription.tier}\n`);
            skipped++;
          }
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 FIX SUMMARY');
    console.log('='.repeat(60));
    console.log(`   Subscriptions fixed: ${fixed}`);
    console.log(`   Subscriptions skipped: ${skipped}`);
    console.log(`   Total subscriptions: ${subscriptions.length}`);
    console.log('='.repeat(60) + '\n');

    // Verify the fix
    console.log('🔍 Verifying fix...\n');
    
    const subscriptionsWithoutPlan = await Subscription.countDocuments({
      planId: { $exists: false }
    });
    
    console.log(`   Subscriptions without planId: ${subscriptionsWithoutPlan}`);
    
    if (subscriptionsWithoutPlan === 0) {
      console.log('   ✅ All subscriptions have planId set!\n');
    } else {
      console.log('   ⚠️  Some subscriptions still missing planId\n');
    }

    console.log('✅ Fix completed! Please restart your backend server.\n');

    // Close connection
    await mongoose.connection.close();

  } catch (error) {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  }
}

// Run the fix
fixSubscriptionPlanIds();
