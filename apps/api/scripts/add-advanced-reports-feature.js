#!/usr/bin/env node

/**
 * Script to add advancedReports feature to user's subscription
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://megagigdev:9svFmZ3VCP5ONzfU@cluster0.vf50xoc.mongodb.net/PharmaCare?retryWrites=true&w=majority&appName=Cluster0';

async function addAdvancedReportsFeature() {
  try {
    console.log('🔧 Adding advancedReports feature to subscription...');
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

    const currentFeatures = subscription.features || [];
    console.log(`🔧 Current features (${currentFeatures.length}):`, currentFeatures.join(', '));

    // Check if user has the required features for diagnostic:analytics
    const requiredFeatures = ['ai_diagnostics', 'advancedReports'];
    const missingFeatures = requiredFeatures.filter(feature => !currentFeatures.includes(feature));

    console.log(`🔍 Required features for diagnostic:analytics: ${requiredFeatures.join(', ')}`);
    console.log(`❌ Missing features: ${missingFeatures.join(', ') || 'none'}`);

    if (missingFeatures.length === 0) {
      console.log('✅ User already has all required features for diagnostic:analytics');
    } else {
      // Add missing features
      const updatedFeatures = [...currentFeatures, ...missingFeatures];
      
      await db.collection('subscriptions').updateOne(
        { _id: subscription._id },
        { 
          $set: { 
            features: updatedFeatures,
            updatedAt: new Date()
          } 
        }
      );
      
      console.log(`✅ Added missing features: ${missingFeatures.join(', ')}`);
    }

    // Also ensure the plan has these features
    const plan = await db.collection('pricingplans').findOne({
      _id: subscription.planId
    });

    if (plan) {
      console.log(`📋 Plan: ${plan.name} (${plan.tier})`);
      const planFeatures = plan.features || [];
      const planMissingFeatures = requiredFeatures.filter(feature => !planFeatures.includes(feature));

      if (planMissingFeatures.length > 0) {
        console.log(`⚠️ Adding missing features to plan: ${planMissingFeatures.join(', ')}`);
        
        const updatedPlanFeatures = [...planFeatures, ...planMissingFeatures];
        await db.collection('pricingplans').updateOne(
          { _id: plan._id },
          { 
            $set: { 
              features: updatedPlanFeatures,
              updatedAt: new Date()
            } 
          }
        );
        
        console.log('✅ Added missing features to plan');
      } else {
        console.log('✅ Plan already has all required features');
      }
    }

    // Verify the final state
    const updatedSubscription = await db.collection('subscriptions').findOne({
      _id: subscription._id
    });

    const finalFeatures = updatedSubscription.features || [];
    const hasAllRequired = requiredFeatures.every(feature => finalFeatures.includes(feature));

    console.log('\n📊 Final verification:');
    console.log(`   - ai_diagnostics: ${finalFeatures.includes('ai_diagnostics') ? '✅' : '❌'}`);
    console.log(`   - advancedReports: ${finalFeatures.includes('advancedReports') ? '✅' : '❌'}`);
    console.log(`   - diagnostic_analytics: ${finalFeatures.includes('diagnostic_analytics') ? '✅' : '❌'}`);
    console.log(`   - All required features: ${hasAllRequired ? '✅' : '❌'}`);

    if (hasAllRequired) {
      console.log('\n✅ All required features for diagnostic:analytics are now available!');
      console.log('Analytics should now work without 402 errors.');
    } else {
      console.log('\n❌ Some required features are still missing.');
    }

  } catch (error) {
    console.error('❌ Failed to add advanced reports feature:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  addAdvancedReportsFeature()
    .then(() => {
      console.log('Advanced reports feature update completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Advanced reports feature update failed:', error);
      process.exit(1);
    });
}

module.exports = { addAdvancedReportsFeature };