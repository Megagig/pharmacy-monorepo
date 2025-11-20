/**
 * Fix Script: New Account Subscription
 * 
 * This script fixes a specific user's subscription to add AI diagnostics features.
 * 
 * Run with: npx ts-node src/scripts/fixNewAccountSubscription.ts <user-email>
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Import models
import User from '../models/User';
import { Subscription } from '../models/Subscription';
import SubscriptionPlan from '../models/SubscriptionPlan';
import Workplace from '../models/Workplace';

async function fixNewAccountSubscription(userEmail: string) {
  try {
    console.log('🔧 Fixing subscription for new account...\n');

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmadb';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Find user
    console.log(`📧 Looking for user: ${userEmail}`);
    const user = await User.findOne({ email: userEmail });
    
    if (!user) {
      console.log(`❌ User not found: ${userEmail}`);
      process.exit(1);
    }

    console.log(`✅ User found: ${user.firstName} ${user.lastName}`);
    console.log(`   ID: ${user._id}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Workplace ID: ${user.workplaceId || 'NONE'}\n`);

    // Find subscription
    let subscription = null;
    
    if (user.workplaceId) {
      subscription = await Subscription.findOne({
        workspaceId: user.workplaceId,
        status: { $in: ['active', 'trial', 'past_due'] }
      });
      console.log(`🔍 Looking for subscription by workplaceId: ${user.workplaceId}`);
    }
    
    // Fallback: try finding by old userId field
    if (!subscription) {
      subscription = await (Subscription as any).findOne({
        userId: user._id,
        status: { $in: ['active', 'trial', 'past_due'] }
      });
      console.log(`🔍 Looking for subscription by userId (old field): ${user._id}`);
    }

    if (!subscription) {
      console.log(`❌ No subscription found for this user\n`);
      process.exit(1);
    }

    console.log(`✅ Subscription found:`);
    console.log(`   ID: ${subscription._id}`);
    console.log(`   Tier: ${subscription.tier}`);
    console.log(`   Status: ${subscription.status}`);
    console.log(`   Workspace ID: ${subscription.workspaceId || 'NONE'}`);
    console.log(`   Current features: ${subscription.features?.length || 0} features`);
    if (subscription.features?.length > 0) {
      console.log(`   Features: ${subscription.features.join(', ')}`);
    }
    console.log('');

    // Get plan
    const plan = await SubscriptionPlan.findById(subscription.planId);
    if (!plan) {
      console.log(`❌ Plan not found: ${subscription.planId}`);
      process.exit(1);
    }

    console.log(`✅ Plan found: ${plan.name} (${plan.tier})\n`);

    // Get all features for this subscription
    const { getSubscriptionFeatures } = await import('../utils/subscriptionFeatures');
    const features = await getSubscriptionFeatures(plan, subscription.tier);

    console.log(`📋 Features that should be enabled: ${features.length}`);
    console.log(`   ${features.join(', ')}\n`);

    // Check if AI diagnostics is in the list
    const hasAIDiagnostics = features.includes('ai_diagnostics');
    console.log(`   AI Diagnostics: ${hasAIDiagnostics ? '✅ YES' : '❌ NO'}\n`);

    // Update subscription
    console.log(`🔧 Updating subscription...`);
    
    const updateData: any = {
      features: features,
    };

    // If workspaceId is missing, add it
    if (!subscription.workspaceId && user.workplaceId) {
      updateData.workspaceId = user.workplaceId;
      console.log(`   Adding workspaceId: ${user.workplaceId}`);
    }

    // If trialEndDate is missing, add it
    if (!subscription.trialEndDate && subscription.endDate) {
      updateData.trialEndDate = subscription.endDate;
      console.log(`   Adding trialEndDate: ${subscription.endDate}`);
    }

    await Subscription.updateOne(
      { _id: subscription._id },
      { $set: updateData }
    );

    console.log(`✅ Subscription updated!\n`);

    // Verify the fix
    const updatedSubscription = await Subscription.findById(subscription._id);
    console.log(`📊 Verification:`);
    console.log(`   Features: ${updatedSubscription?.features?.length || 0}`);
    console.log(`   Has AI Diagnostics: ${updatedSubscription?.features?.includes('ai_diagnostics') ? '✅ YES' : '❌ NO'}`);
    console.log(`   Workspace ID: ${updatedSubscription?.workspaceId || 'NONE'}\n`);

    console.log('✅ Fix completed! User should now have access to AI diagnostics.\n');

    // Close connection
    await mongoose.connection.close();

  } catch (error) {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  }
}

// Get user email from command line
const userEmail = process.argv[2];

if (!userEmail) {
  console.error('❌ Please provide a user email');
  console.error('Usage: npx ts-node src/scripts/fixNewAccountSubscription.ts <user-email>');
  process.exit(1);
}

// Run the fix
fixNewAccountSubscription(userEmail);
