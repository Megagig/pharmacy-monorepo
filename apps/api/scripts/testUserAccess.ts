#!/usr/bin/env ts-node

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/User';
import Subscription from '../src/models/Subscription';
import Workplace from '../src/models/Workplace';
import { FeatureFlag } from '../src/models/FeatureFlag';

// Load environment variables
dotenv.config();

async function testUserAccess(email: string, featureKey: string) {
  try {
    console.log(`🔍 Testing access for user: ${email} to feature: ${featureKey}`);

    // Connect to MongoDB
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is required');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log(`👤 User: ${user.email} (${user.role})`);

    if (!user.workplaceId) {
      console.log('❌ User has no workplace');
      return;
    }

    // Find workplace
    const workplace = await Workplace.findById(user.workplaceId);
    console.log(`🏢 Workplace: ${workplace?.name || 'None'}`);

    if (!workplace) {
      console.log('❌ Workplace not found');
      return;
    }

    // Find subscription
    const subscription = await Subscription.findOne({
      workspaceId: user.workplaceId,
      status: { $in: ['active', 'trial', 'past_due'] },
    });

    if (!subscription) {
      console.log('❌ No active subscription found');
      return;
    }

    console.log(`💳 Subscription: ${subscription.tier} (${subscription.status})`);
    console.log(`📋 Features: ${JSON.stringify(subscription.features)}`);

    // Find feature flag
    const featureFlag = await FeatureFlag.findOne({
      key: featureKey,
      isActive: true,
    });

    if (!featureFlag) {
      console.log('❌ Feature flag not found or inactive');
      return;
    }

    console.log(`🚩 Feature Flag: ${featureFlag.name}`);
    console.log(`   Allowed Tiers: ${JSON.stringify(featureFlag.allowedTiers)}`);
    console.log(`   Allowed Roles: ${JSON.stringify(featureFlag.allowedRoles)}`);

    // Simulate the middleware checks
    console.log('\n🔐 Access Checks:');

    // 1. Check if user role is allowed
    const roleAllowed = featureFlag.allowedRoles.includes(user.role as string);
    console.log(`   1. Role Check (${user.role}): ${roleAllowed ? '✅ PASS' : '❌ FAIL'}`);

    // 2. Check if subscription tier is allowed
    const tierAllowed = featureFlag.allowedTiers.includes(subscription.tier);
    console.log(`   2. Tier Check (${subscription.tier}): ${tierAllowed ? '✅ PASS' : '❌ FAIL'}`);

    // 3. Check if trial is expired (if applicable)
    let trialValid = true;
    if (subscription.status === 'trial' && subscription.trialEndDate) {
      const now = new Date();
      trialValid = now <= subscription.trialEndDate;
      console.log(`   3. Trial Check: ${trialValid ? '✅ PASS' : '❌ FAIL'} (expires: ${subscription.trialEndDate})`);
    } else {
      console.log(`   3. Trial Check: ✅ PASS (not a trial)`);
    }

    // 4. Check if feature is in subscription features array
    const hasFeatureAccess = subscription.features.includes(featureKey) ||
                             subscription.customFeatures.includes(featureKey) ||
                             user.features.includes(featureKey) ||
                             (user.role as string) === 'super_admin';
    console.log(`   4. Feature Access Check: ${hasFeatureAccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`      - In subscription.features: ${subscription.features.includes(featureKey)}`);
    console.log(`      - In subscription.customFeatures: ${subscription.customFeatures.includes(featureKey)}`);
    console.log(`      - In user.features: ${user.features.includes(featureKey)}`);
    console.log(`      - Is super_admin: ${(user.role as string) === 'super_admin'}`);

    // Final result
    const finalAccess = roleAllowed && tierAllowed && trialValid && hasFeatureAccess;
    console.log(`\n🎯 FINAL RESULT: ${finalAccess ? '✅ ACCESS GRANTED' : '❌ ACCESS DENIED'}`);

    if (!finalAccess) {
      console.log('\n🔧 Issues to fix:');
      if (!roleAllowed) console.log('   - User role not allowed for this feature');
      if (!tierAllowed) console.log('   - Subscription tier not allowed for this feature');
      if (!trialValid) console.log('   - Trial has expired');
      if (!hasFeatureAccess) console.log('   - Feature not in subscription features array');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

// Run test if this script is executed directly
if (require.main === module) {
  const email = process.argv[2];
  const featureKey = process.argv[3] || 'ai_diagnostics';

  if (!email) {
    console.error('Usage: npx ts-node scripts/testUserAccess.ts <email> [featureKey]');
    process.exit(1);
  }

  testUserAccess(email, featureKey);
}

export default testUserAccess;