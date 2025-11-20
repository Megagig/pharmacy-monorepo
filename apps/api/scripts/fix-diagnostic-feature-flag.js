#!/usr/bin/env node

/**
 * Script to fix diagnostic analytics feature flag for user
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://megagigdev:9svFmZ3VCP5ONzfU@cluster0.vf50xoc.mongodb.net/PharmaCare?retryWrites=true&w=majority&appName=Cluster0';

async function fixDiagnosticFeatureFlag() {
  try {
    console.log('🔧 Fixing diagnostic analytics feature flag...');
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // Find the user
    const user = await db.collection('users').findOne({ 
      email: 'megagigsolution@gmail.com' 
    });
    
    if (!user) {
      console.error('❌ User not found!');
      process.exit(1);
    }

    console.log(`👤 Found user: ${user.email} (${user.role})`);
    console.log(`🏢 Workplace: ${user.workplaceId}`);

    // Find the subscription
    const subscription = await db.collection('subscriptions').findOne({
      workplaceId: user.workplaceId,
      status: { $in: ['active', 'trial'] }
    });

    if (!subscription) {
      console.error('❌ No active subscription found!');
      process.exit(1);
    }

    console.log(`💳 Subscription: ${subscription.tier} (${subscription.status})`);
    console.log(`📦 Plan ID: ${subscription.planId}`);

    // Find the feature flag
    const featureFlag = await db.collection('featureflags').findOne({
      name: 'diagnostic_analytics'
    });

    if (!featureFlag) {
      console.error('❌ diagnostic_analytics feature flag not found!');
      process.exit(1);
    }

    console.log(`🚩 Feature flag: ${featureFlag.name} (enabled: ${featureFlag.enabled})`);
    console.log(`📋 Allowed tiers: ${featureFlag.allowedTiers?.join(', ')}`);

    // Check if user's tier is in allowed tiers
    const userTier = subscription.tier;
    const allowedTiers = featureFlag.allowedTiers || [];
    
    if (!allowedTiers.includes(userTier)) {
      console.log(`⚠️ User tier '${userTier}' not in allowed tiers. Adding it...`);
      
      const updatedTiers = [...allowedTiers, userTier];
      await db.collection('featureflags').updateOne(
        { _id: featureFlag._id },
        { 
          $set: { 
            allowedTiers: updatedTiers,
            updatedAt: new Date()
          } 
        }
      );
      
      console.log(`✅ Added '${userTier}' to allowed tiers`);
    } else {
      console.log(`✅ User tier '${userTier}' already in allowed tiers`);
    }

    // Ensure feature flag is enabled
    if (!featureFlag.enabled) {
      await db.collection('featureflags').updateOne(
        { _id: featureFlag._id },
        { 
          $set: { 
            enabled: true,
            updatedAt: new Date()
          } 
        }
      );
      console.log('✅ Enabled diagnostic_analytics feature flag');
    }

    // Check the plan permissions
    const plan = await db.collection('pricingplans').findOne({
      _id: subscription.planId
    });

    if (plan) {
      console.log(`📋 Plan: ${plan.name} (${plan.tier})`);
      console.log(`🔑 Permissions: ${plan.permissions?.length || 0} total`);
      
      const diagnosticPerms = plan.permissions?.filter(p => p.startsWith('diagnostic:')) || [];
      console.log(`🔬 Diagnostic permissions: ${diagnosticPerms.join(', ')}`);
      
      if (!diagnosticPerms.includes('diagnostic:analytics')) {
        console.log('⚠️ Adding diagnostic:analytics permission to plan...');
        
        const updatedPermissions = [...(plan.permissions || []), 'diagnostic:analytics'];
        await db.collection('pricingplans').updateOne(
          { _id: plan._id },
          { 
            $set: { 
              permissions: updatedPermissions,
              updatedAt: new Date()
            } 
          }
        );
        
        console.log('✅ Added diagnostic:analytics permission to plan');
      }
    }

    // Force refresh user session
    await db.collection('users').updateOne(
      { _id: user._id },
      { 
        $set: { 
          lastPermissionRefresh: new Date(),
          updatedAt: new Date()
        } 
      }
    );

    console.log('\n✅ Diagnostic analytics feature flag fixed!');
    console.log('🔄 Please refresh your browser or log out and log back in.');

  } catch (error) {
    console.error('❌ Failed to fix feature flag:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  fixDiagnosticFeatureFlag()
    .then(() => {
      console.log('Feature flag fix completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Feature flag fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixDiagnosticFeatureFlag };