#!/usr/bin/env node

/**
 * Debug script to check the current free trial user's exact configuration
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://megagigdev:9svFmZ3VCP5ONzfU@cluster0.vf50xoc.mongodb.net/PharmaCare?retryWrites=true&w=majority&appName=Cluster0';

async function debugCurrentFreeTrialUser() {
  try {
    console.log('🔍 Debugging current free trial user configuration...');
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // Find all free trial subscriptions
    const freeTrialSubs = await db.collection('subscriptions').find({
      tier: 'free_trial',
      status: 'trial'
    }).sort({ createdAt: -1 }).toArray();

    console.log(`Found ${freeTrialSubs.length} free trial subscriptions`);

    if (freeTrialSubs.length === 0) {
      console.log('❌ No free trial subscriptions found');
      return;
    }

    // Try to find a user for any of the subscriptions
    let user = null;
    let recentFreeTrialSub = null;

    for (const sub of freeTrialSubs) {
      const foundUser = await db.collection('users').findOne({
        workplaceId: sub.workplaceId
      });
      
      if (foundUser) {
        user = foundUser;
        recentFreeTrialSub = sub;
        break;
      }
    }

    if (!user || !recentFreeTrialSub) {
      console.log('❌ No user found for any free trial subscription');
      
      // Show subscription details for debugging
      for (let i = 0; i < Math.min(3, freeTrialSubs.length); i++) {
        const sub = freeTrialSubs[i];
        console.log(`\\nSubscription ${i + 1}:`);
        console.log(`   - Workplace ID: ${sub.workplaceId}`);
        console.log(`   - Tier: ${sub.tier}`);
        console.log(`   - Status: ${sub.status}`);
        console.log(`   - Created: ${sub.createdAt}`);
      }
      return;
    }

    console.log(`\\n👤 Current Free Trial User: ${user.email}`);
    console.log(`   - Role: ${user.role}`);
    console.log(`   - Workplace ID: ${user.workplaceId}`);

    console.log(`\\n💳 Subscription Details:`);
    console.log(`   - Tier: ${recentFreeTrialSub.tier}`);
    console.log(`   - Status: ${recentFreeTrialSub.status}`);
    console.log(`   - Plan ID: ${recentFreeTrialSub.planId}`);

    const subFeatures = recentFreeTrialSub.features || [];
    console.log(`\\n🔧 Subscription Features (${subFeatures.length}):`);
    const requiredFeatures = ['ai_diagnostics', 'advancedReports'];
    requiredFeatures.forEach(feature => {
      const hasFeature = subFeatures.includes(feature);
      console.log(`   - ${feature}: ${hasFeature ? '✅' : '❌'}`);
    });

    console.log(`\\n👥 User Features:`);
    const userFeatures = user.features || [];
    console.log(`   - diagnostic_analytics: ${userFeatures.includes('diagnostic_analytics') ? '✅' : '❌'}`);

    // Check workplace membership
    const workplace = await db.collection('workplaces').findOne({
      _id: user.workplaceId
    });

    if (workplace) {
      const membership = workplace.members?.find(m => 
        m.userId?.toString() === user._id.toString()
      );
      console.log(`\\n🏢 Workplace Membership:`);
      console.log(`   - Is member: ${membership ? '✅' : '❌'}`);
      console.log(`   - Role: ${membership?.role || 'None'}`);
    }

    // Check the plan
    const plan = await db.collection('pricingplans').findOne({
      _id: recentFreeTrialSub.planId
    });

    if (plan) {
      console.log(`\\n📦 Plan Details: ${plan.name} (${plan.tier})`);
      const planFeatures = plan.features || [];
      requiredFeatures.forEach(feature => {
        const hasFeature = planFeatures.includes(feature);
        console.log(`   - ${feature}: ${hasFeature ? '✅' : '❌'}`);
      });

      const planPermissions = plan.permissions || [];
      console.log(`   - diagnostic:analytics permission: ${planPermissions.includes('diagnostic:analytics') ? '✅' : '❌'}`);
    }

    // Check feature flag
    const featureFlag = await db.collection('featureflags').findOne({
      key: 'diagnostic_analytics'
    });

    console.log(`\\n🚩 Feature Flag:`);
    if (featureFlag) {
      console.log(`   - Active: ${featureFlag.isActive ? '✅' : '❌'}`);
      console.log(`   - Allows free_trial: ${featureFlag.allowedTiers?.includes('free_trial') ? '✅' : '❌'}`);
    } else {
      console.log('   - ❌ Feature flag not found');
    }

    console.log(`\\n🎯 DIAGNOSIS:`);
    
    const hasSubFeatures = requiredFeatures.every(f => subFeatures.includes(f));
    const hasUserFeature = userFeatures.includes('diagnostic_analytics');
    const hasMembership = workplace?.members?.some(m => m.userId?.toString() === user._id.toString());
    const hasFeatureFlag = featureFlag?.isActive && featureFlag?.allowedTiers?.includes('free_trial');

    console.log(`   - Subscription has required features: ${hasSubFeatures ? '✅' : '❌'}`);
    console.log(`   - User has diagnostic_analytics: ${hasUserFeature ? '✅' : '❌'}`);
    console.log(`   - User is workplace member: ${hasMembership ? '✅' : '❌'}`);
    console.log(`   - Feature flag allows free_trial: ${hasFeatureFlag ? '✅' : '❌'}`);

    if (!hasSubFeatures) {
      console.log(`\\n🔧 MISSING SUBSCRIPTION FEATURES:`);
      const missing = requiredFeatures.filter(f => !subFeatures.includes(f));
      console.log(`   Need to add: ${missing.join(', ')}`);
    }

    if (!hasUserFeature) {
      console.log(`\\n🔧 MISSING USER FEATURE:`);
      console.log(`   Need to add: diagnostic_analytics`);
    }

    if (!hasMembership) {
      console.log(`\\n🔧 MISSING WORKPLACE MEMBERSHIP:`);
      console.log(`   Need to add user as Owner to workplace members`);
    }

  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\\nDisconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  debugCurrentFreeTrialUser()
    .then(() => {
      console.log('Debug completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Debug failed:', error);
      process.exit(1);
    });
}

module.exports = { debugCurrentFreeTrialUser };