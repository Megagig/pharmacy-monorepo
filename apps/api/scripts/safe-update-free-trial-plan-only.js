#!/usr/bin/env node

/**
 * ULTRA SAFE: Only updates the free trial plan to include diagnostic features
 * Does NOT touch any existing users, subscriptions, or other plans
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://megagigdev:9svFmZ3VCP5ONzfU@cluster0.vf50xoc.mongodb.net/PharmaCare?retryWrites=true&w=majority&appName=Cluster0';

async function safeUpdateFreeTrialPlanOnly() {
  try {
    console.log('🔧 ULTRA SAFE: Only updating free trial plan...');
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // Find ONLY the free trial plan
    const freeTrialPlan = await db.collection('pricingplans').findOne({
      tier: 'free_trial',
      isActive: true
    });

    if (!freeTrialPlan) {
      console.log('❌ Free trial plan not found');
      return;
    }

    console.log(`📦 Found Free Trial Plan: ${freeTrialPlan.name}`);
    console.log(`   Current features: ${freeTrialPlan.features?.join(', ') || 'none'}`);

    const requiredFeatures = ['ai_diagnostics', 'advancedReports'];
    const currentFeatures = freeTrialPlan.features || [];
    const missingFeatures = requiredFeatures.filter(f => !currentFeatures.includes(f));

    if (missingFeatures.length > 0) {
      console.log(`🔧 Adding missing features: ${missingFeatures.join(', ')}`);
      
      await db.collection('pricingplans').updateOne(
        { _id: freeTrialPlan._id },
        { 
          $set: { 
            features: [...currentFeatures, ...missingFeatures],
            updatedAt: new Date()
          } 
        }
      );
      
      console.log('✅ Updated free trial plan with diagnostic features');
    } else {
      console.log('✅ Free trial plan already has all required features');
    }

    // Also ensure permissions
    const requiredPermissions = ['diagnostic:analytics', 'diagnostic:read', 'diagnostic:create'];
    const currentPermissions = freeTrialPlan.permissions || [];
    const missingPermissions = requiredPermissions.filter(p => !currentPermissions.includes(p));

    if (missingPermissions.length > 0) {
      console.log(`🔧 Adding missing permissions: ${missingPermissions.join(', ')}`);
      
      await db.collection('pricingplans').updateOne(
        { _id: freeTrialPlan._id },
        { 
          $set: { 
            permissions: [...currentPermissions, ...missingPermissions],
            updatedAt: new Date()
          } 
        }
      );
      
      console.log('✅ Updated free trial plan with diagnostic permissions');
    } else {
      console.log('✅ Free trial plan already has all required permissions');
    }

    // Verify the update
    const updatedPlan = await db.collection('pricingplans').findOne({
      _id: freeTrialPlan._id
    });

    console.log('\\n📊 Updated Free Trial Plan:');
    console.log(`   Features: ${updatedPlan.features?.join(', ')}`);
    console.log(`   Permissions: ${updatedPlan.permissions?.join(', ')}`);

    console.log('\\n✅ ULTRA SAFE UPDATE COMPLETED!');
    console.log('   - Only updated the free trial plan');
    console.log('   - Did NOT touch any users or existing subscriptions');
    console.log('   - New free trial users will now get diagnostic access');
    console.log('\\n🔄 Existing free trial users may need to refresh or re-login');

  } catch (error) {
    console.error('❌ Safe update failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\\nDisconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  safeUpdateFreeTrialPlanOnly()
    .then(() => {
      console.log('Safe free trial plan update completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Safe free trial plan update failed:', error);
      process.exit(1);
    });
}

module.exports = { safeUpdateFreeTrialPlanOnly };