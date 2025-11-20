#!/usr/bin/env node

/**
 * Script to check feature flag status in detail
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://megagigdev:9svFmZ3VCP5ONzfU@cluster0.vf50xoc.mongodb.net/PharmaCare?retryWrites=true&w=majority&appName=Cluster0';

async function checkFeatureFlagStatus() {
  try {
    console.log('🔍 Checking feature flag status...');
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // Find the user
    const user = await db.collection('users').findOne({ 
      email: 'megagigsolution@gmail.com' 
    });
    
    console.log(`👤 User: ${user.email} (${user.role})`);

    // Find the subscription
    const subscription = await db.collection('subscriptions').findOne({
      workplaceId: user.workplaceId,
      status: { $in: ['active', 'trial'] }
    });

    console.log(`💳 Subscription tier: ${subscription.tier}`);

    // Check feature flag
    const featureFlag = await db.collection('featureflags').findOne({
      key: 'diagnostic_analytics'
    });

    console.log('\\n🚩 Feature Flag Status:');
    if (featureFlag) {
      console.log(`   - name: ${featureFlag.name}`);
      console.log(`   - key: ${featureFlag.key}`);
      console.log(`   - isActive: ${featureFlag.isActive}`);
      console.log(`   - allowedTiers: ${JSON.stringify(featureFlag.allowedTiers)}`);
      console.log(`   - allowedRoles: ${JSON.stringify(featureFlag.allowedRoles)}`);
    } else {
      console.log('   - ❌ Feature flag NOT FOUND!');
    }

    // Check what the middleware is looking for
    console.log('\\n🔧 Middleware Requirements:');
    console.log('   - Looking for: key="diagnostic_analytics" AND isActive=true');
    console.log(`   - User tier: ${subscription.tier}`);
    console.log(`   - User role: ${user.role}`);

    // Check if user meets requirements
    if (featureFlag) {
      const tierAllowed = featureFlag.allowedTiers?.includes(subscription.tier);
      const roleAllowed = featureFlag.allowedRoles?.length === 0 || featureFlag.allowedRoles?.includes(user.role);
      
      console.log('\\n✅ Access Check:');
      console.log(`   - Feature flag exists: ✅`);
      console.log(`   - Feature flag active: ${featureFlag.isActive ? '✅' : '❌'}`);
      console.log(`   - Tier allowed: ${tierAllowed ? '✅' : '❌'} (${subscription.tier} in ${JSON.stringify(featureFlag.allowedTiers)})`);
      console.log(`   - Role allowed: ${roleAllowed ? '✅' : '❌'} (${user.role} in ${JSON.stringify(featureFlag.allowedRoles)})`);
      
      const shouldWork = featureFlag.isActive && tierAllowed && roleAllowed;
      console.log(`\\n🎯 Should work: ${shouldWork ? '✅ YES' : '❌ NO'}`);
    }

    // Check the exact feature access logic from auth.ts
    console.log('\\n🔍 Feature Access Logic Check:');
    const hasFeatureAccess =
      subscription.features?.includes('diagnostic_analytics') ||
      subscription.customFeatures?.includes('diagnostic_analytics') ||
      user.features?.includes('diagnostic_analytics') ||
      user.role === 'super_admin';

    console.log(`   - subscription.features includes diagnostic_analytics: ${subscription.features?.includes('diagnostic_analytics') ? '✅' : '❌'}`);
    console.log(`   - subscription.customFeatures includes diagnostic_analytics: ${subscription.customFeatures?.includes('diagnostic_analytics') ? '✅' : '❌'}`);
    console.log(`   - user.features includes diagnostic_analytics: ${user.features?.includes('diagnostic_analytics') ? '✅' : '❌'}`);
    console.log(`   - user is super_admin: ${user.role === 'super_admin' ? '✅' : '❌'}`);
    console.log(`\\n🎯 Has feature access: ${hasFeatureAccess ? '✅ YES' : '❌ NO'}`);

  } catch (error) {
    console.error('❌ Failed to check feature flag:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\\nDisconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  checkFeatureFlagStatus()
    .then(() => {
      console.log('Feature flag check completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Feature flag check failed:', error);
      process.exit(1);
    });
}

module.exports = { checkFeatureFlagStatus };