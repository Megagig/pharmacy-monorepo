#!/usr/bin/env node

/**
 * Script to debug diagnostic:analytics permission check
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://megagigdev:9svFmZ3VCP5ONzfU@cluster0.vf50xoc.mongodb.net/PharmaCare?retryWrites=true&w=majority&appName=Cluster0';

async function debugDiagnosticAnalyticsPermission() {
  try {
    console.log('🔍 Debugging diagnostic:analytics permission...');
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

    console.log(`👤 User: ${user.email}`);
    console.log(`   - role: ${user.role}`);
    console.log(`   - workplaceId: ${user.workplaceId}`);

    // Find the workplace
    const workplace = await db.collection('workplaces').findOne({
      _id: user.workplaceId
    });

    if (workplace) {
      console.log(`🏢 Workplace: ${workplace.name}`);
      console.log(`   - _id: ${workplace._id}`);
      
      // Check user's role in workplace
      const userMembership = workplace.members?.find(member => 
        member.userId?.toString() === user._id.toString()
      );
      
      if (userMembership) {
        console.log(`   - workplaceRole: ${userMembership.role}`);
      } else {
        console.log('   - workplaceRole: NOT FOUND in members array');
      }
    }

    // Find the subscription
    const subscription = await db.collection('subscriptions').findOne({
      workplaceId: user.workplaceId,
      status: { $in: ['active', 'trial'] }
    });

    if (!subscription) {
      console.error('❌ No active subscription found!');
      process.exit(1);
    }

    console.log(`💳 Subscription:`);
    console.log(`   - tier: ${subscription.tier}`);
    console.log(`   - status: ${subscription.status}`);
    console.log(`   - planId: ${subscription.planId}`);

    const features = subscription.features || [];
    console.log(`🔧 Subscription features (${features.length}):`);
    features.forEach(feature => {
      console.log(`   - ${feature}`);
    });

    // Check specific required features
    const requiredFeatures = ['ai_diagnostics', 'advancedReports'];
    console.log(`\\n🔍 Required features for diagnostic:analytics:`);
    requiredFeatures.forEach(feature => {
      const hasFeature = features.includes(feature);
      console.log(`   - ${feature}: ${hasFeature ? '✅' : '❌'}`);
    });

    // Check permission matrix requirements
    console.log(`\\n📋 Permission matrix requirements for diagnostic:analytics:`);
    console.log(`   - workplaceRoles: ['Owner', 'Pharmacist']`);
    console.log(`   - features: ['ai_diagnostics', 'advancedReports']`);
    console.log(`   - planTiers: ['pro', 'pharmily', 'network', 'enterprise']`);
    console.log(`   - requiresActiveSubscription: true`);

    // Check if user meets all requirements
    const userWorkplaceRole = workplace?.members?.find(member => 
      member.userId?.toString() === user._id.toString()
    )?.role;

    const hasRequiredRole = ['Owner', 'Pharmacist'].includes(userWorkplaceRole);
    const hasRequiredFeatures = requiredFeatures.every(feature => features.includes(feature));
    const hasRequiredTier = ['pro', 'pharmily', 'network', 'enterprise'].includes(subscription.tier);
    const hasActiveSubscription = ['active', 'trial'].includes(subscription.status);

    console.log(`\\n✅ Permission check results:`);
    console.log(`   - Required workplace role: ${hasRequiredRole ? '✅' : '❌'} (has: ${userWorkplaceRole})`);
    console.log(`   - Required features: ${hasRequiredFeatures ? '✅' : '❌'}`);
    console.log(`   - Required tier: ${hasRequiredTier ? '✅' : '❌'} (has: ${subscription.tier})`);
    console.log(`   - Active subscription: ${hasActiveSubscription ? '✅' : '❌'} (has: ${subscription.status})`);

    const shouldHaveAccess = hasRequiredRole && hasRequiredFeatures && hasRequiredTier && hasActiveSubscription;
    console.log(`\\n🎯 Should have access: ${shouldHaveAccess ? '✅ YES' : '❌ NO'}`);

    if (!shouldHaveAccess) {
      console.log('\\n🔧 Issues to fix:');
      if (!hasRequiredRole) console.log('   - Fix workplace role');
      if (!hasRequiredFeatures) console.log('   - Add missing features');
      if (!hasRequiredTier) console.log('   - Upgrade subscription tier');
      if (!hasActiveSubscription) console.log('   - Activate subscription');
    }

  } catch (error) {
    console.error('❌ Failed to debug permission:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\\nDisconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  debugDiagnosticAnalyticsPermission()
    .then(() => {
      console.log('Debug completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Debug failed:', error);
      process.exit(1);
    });
}

module.exports = { debugDiagnosticAnalyticsPermission };