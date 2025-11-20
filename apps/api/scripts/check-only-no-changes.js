#!/usr/bin/env node

/**
 * SAFE CHECK ONLY - Does NOT make any changes
 * Just checks what's wrong with free trial users
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://megagigdev:9svFmZ3VCP5ONzfU@cluster0.vf50xoc.mongodb.net/PharmaCare?retryWrites=true&w=majority&appName=Cluster0';

async function checkOnlyNoChanges() {
  try {
    console.log('🔍 SAFE CHECK: Analyzing free trial user issues (NO CHANGES)...');
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // Check feature flag status
    const featureFlag = await db.collection('featureflags').findOne({
      key: 'diagnostic_analytics'
    });

    console.log('\\n🚩 Feature Flag Status:');
    if (featureFlag) {
      console.log(`   ✅ Exists: ${featureFlag.name}`);
      console.log(`   - Active: ${featureFlag.isActive}`);
      console.log(`   - Allowed Tiers: ${featureFlag.allowedTiers?.join(', ') || 'none'}`);
      console.log(`   - Includes free_trial: ${featureFlag.allowedTiers?.includes('free_trial') ? '✅' : '❌'}`);
    } else {
      console.log('   ❌ Feature flag does NOT exist');
    }

    // Check free trial subscriptions
    const freeTrialSubs = await db.collection('subscriptions').find({
      tier: 'free_trial',
      status: 'trial'
    }).toArray();

    console.log(`\\n💳 Free Trial Subscriptions: ${freeTrialSubs.length} found`);

    for (const sub of freeTrialSubs.slice(0, 2)) {
      const user = await db.collection('users').findOne({
        workplaceId: sub.workplaceId
      });

      if (user) {
        console.log(`\\n   📋 User: ${user.email}`);
        console.log(`   - Role: ${user.role}`);
        console.log(`   - Subscription tier: ${sub.tier}`);
        console.log(`   - Subscription status: ${sub.status}`);
        console.log(`   - Has diagnostic_analytics in subscription: ${sub.features?.includes('diagnostic_analytics') ? '✅' : '❌'}`);
        console.log(`   - Has ai_diagnostics in subscription: ${sub.features?.includes('ai_diagnostics') ? '✅' : '❌'}`);
        console.log(`   - Has advancedReports in subscription: ${sub.features?.includes('advancedReports') ? '✅' : '❌'}`);
        console.log(`   - User features: ${user.features?.join(', ') || 'none'}`);

        // Check workplace membership
        const workplace = await db.collection('workplaces').findOne({
          _id: user.workplaceId
        });

        if (workplace) {
          const membership = workplace.members?.find(m => 
            m.userId?.toString() === user._id.toString()
          );
          console.log(`   - Workplace role: ${membership?.role || '❌ Not in members array'}`);
        }

        // Check plan
        const plan = await db.collection('pricingplans').findOne({
          _id: sub.planId
        });

        if (plan) {
          console.log(`   - Plan: ${plan.name} (${plan.tier})`);
          console.log(`   - Plan has ai_diagnostics: ${plan.features?.includes('ai_diagnostics') ? '✅' : '❌'}`);
          console.log(`   - Plan has advancedReports: ${plan.features?.includes('advancedReports') ? '✅' : '❌'}`);
          console.log(`   - Plan has diagnostic:analytics permission: ${plan.permissions?.includes('diagnostic:analytics') ? '✅' : '❌'}`);
        }
      }
    }

    console.log('\\n🎯 DIAGNOSIS (what needs to be fixed):');
    
    if (!featureFlag || !featureFlag.isActive) {
      console.log('   ❌ Feature flag missing or inactive');
    }
    
    if (featureFlag && !featureFlag.allowedTiers?.includes('free_trial')) {
      console.log('   ❌ Feature flag does not allow free_trial tier');
    }

    console.log('\\n💡 RECOMMENDED FIXES (via UI):');
    console.log('   1. Go to Feature Management in your admin UI');
    console.log('   2. Find or create "diagnostic_analytics" feature');
    console.log('   3. Enable it for all tiers including "free_trial"');
    console.log('   4. This will automatically fix all users');

    console.log('\\n✅ CHECK COMPLETED - NO CHANGES MADE');
    console.log('   Your existing working configuration is UNTOUCHED');

  } catch (error) {
    console.error('❌ Check failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\\nDisconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  checkOnlyNoChanges()
    .then(() => {
      console.log('Safe check completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Safe check failed:', error);
      process.exit(1);
    });
}

module.exports = { checkOnlyNoChanges };