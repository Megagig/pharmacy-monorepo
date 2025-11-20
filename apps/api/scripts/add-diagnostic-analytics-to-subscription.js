#!/usr/bin/env node

/**
 * Script to add diagnostic_analytics feature to user's subscription
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://megagigdev:9svFmZ3VCP5ONzfU@cluster0.vf50xoc.mongodb.net/PharmaCare?retryWrites=true&w=majority&appName=Cluster0';

async function addDiagnosticAnalyticsToSubscription() {
  try {
    console.log('🔧 Adding diagnostic_analytics to subscription features...');
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
    console.log(`🔧 Current features: ${subscription.features?.join(', ') || 'none'}`);
    console.log(`🔧 Current customFeatures: ${subscription.customFeatures?.join(', ') || 'none'}`);

    // Check if diagnostic_analytics is already in features
    const currentFeatures = subscription.features || [];
    const currentCustomFeatures = subscription.customFeatures || [];
    
    if (currentFeatures.includes('diagnostic_analytics')) {
      console.log('✅ diagnostic_analytics already in subscription features');
    } else {
      // Add diagnostic_analytics to features
      const updatedFeatures = [...currentFeatures, 'diagnostic_analytics'];
      
      await db.collection('subscriptions').updateOne(
        { _id: subscription._id },
        { 
          $set: { 
            features: updatedFeatures,
            updatedAt: new Date()
          } 
        }
      );
      
      console.log('✅ Added diagnostic_analytics to subscription features');
    }

    if (currentCustomFeatures.includes('diagnostic_analytics')) {
      console.log('✅ diagnostic_analytics already in subscription customFeatures');
    } else {
      // Add diagnostic_analytics to customFeatures as well
      const updatedCustomFeatures = [...currentCustomFeatures, 'diagnostic_analytics'];
      
      await db.collection('subscriptions').updateOne(
        { _id: subscription._id },
        { 
          $set: { 
            customFeatures: updatedCustomFeatures,
            updatedAt: new Date()
          } 
        }
      );
      
      console.log('✅ Added diagnostic_analytics to subscription customFeatures');
    }

    // Also check user features
    const userFeatures = user.features || [];
    if (!userFeatures.includes('diagnostic_analytics')) {
      const updatedUserFeatures = [...userFeatures, 'diagnostic_analytics'];
      
      await db.collection('users').updateOne(
        { _id: user._id },
        { 
          $set: { 
            features: updatedUserFeatures,
            updatedAt: new Date()
          } 
        }
      );
      
      console.log('✅ Added diagnostic_analytics to user features');
    } else {
      console.log('✅ diagnostic_analytics already in user features');
    }

    // Verify the updates
    const updatedSubscription = await db.collection('subscriptions').findOne({
      _id: subscription._id
    });

    const updatedUser = await db.collection('users').findOne({
      _id: user._id
    });

    console.log('\n📊 Updated subscription features:');
    console.log(`   - features: ${updatedSubscription.features?.join(', ') || 'none'}`);
    console.log(`   - customFeatures: ${updatedSubscription.customFeatures?.join(', ') || 'none'}`);
    console.log(`   - user features: ${updatedUser.features?.join(', ') || 'none'}`);

    console.log('\n✅ Diagnostic analytics feature access granted!');
    console.log('Analytics should now be accessible for workspace users.');

  } catch (error) {
    console.error('❌ Failed to add diagnostic analytics to subscription:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  addDiagnosticAnalyticsToSubscription()
    .then(() => {
      console.log('Subscription feature update completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Subscription feature update failed:', error);
      process.exit(1);
    });
}

module.exports = { addDiagnosticAnalyticsToSubscription };