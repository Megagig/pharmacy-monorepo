#!/usr/bin/env node

/**
 * Script to create diagnostic analytics feature flag
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://megagigdev:9svFmZ3VCP5ONzfU@cluster0.vf50xoc.mongodb.net/PharmaCare?retryWrites=true&w=majority&appName=Cluster0';

async function createDiagnosticAnalyticsFeature() {
  try {
    console.log('🚀 Creating diagnostic analytics feature flag...');
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // Check if feature flag already exists
    const existingFlag = await db.collection('featureflags').findOne({
      name: 'diagnostic_analytics'
    });

    if (existingFlag) {
      console.log('✅ diagnostic_analytics feature flag already exists');
      
      // Update it to ensure it's properly configured
      await db.collection('featureflags').updateOne(
        { _id: existingFlag._id },
        { 
          $set: { 
            key: 'diagnostic_analytics', // Ensure key field exists
            isActive: true, // Use isActive instead of enabled
            allowedTiers: ['free', 'basic', 'pro', 'enterprise', 'free_trial'],
            allowedRoles: [], // Empty means all roles allowed
            description: 'Access to diagnostic analytics and reporting features',
            updatedAt: new Date()
          } 
        }
      );
      
      console.log('✅ Updated diagnostic_analytics feature flag configuration');
    } else {
      // Create the feature flag
      const featureFlag = {
        name: 'diagnostic_analytics',
        key: 'diagnostic_analytics', // This is what the middleware looks for
        description: 'Access to diagnostic analytics and reporting features',
        isActive: true, // This is what the middleware checks
        allowedTiers: ['free', 'basic', 'pro', 'enterprise', 'free_trial'],
        allowedRoles: [], // Empty means all roles allowed
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.collection('featureflags').insertOne(featureFlag);
      console.log('✅ Created diagnostic_analytics feature flag');
    }

    // Also ensure the user's plan has the diagnostic:analytics permission
    const user = await db.collection('users').findOne({ 
      email: 'megagigsolution@gmail.com' 
    });

    if (user) {
      const subscription = await db.collection('subscriptions').findOne({
        workplaceId: user.workplaceId,
        status: { $in: ['active', 'trial'] }
      });

      if (subscription) {
        const plan = await db.collection('pricingplans').findOne({
          _id: subscription.planId
        });

        if (plan) {
          const diagnosticPerms = plan.permissions?.filter(p => p.startsWith('diagnostic:')) || [];
          
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
          } else {
            console.log('✅ Plan already has diagnostic:analytics permission');
          }
        }
      }
    }

    console.log('\n✅ Diagnostic analytics feature flag setup completed!');
    console.log('Users with pro, enterprise, or free_trial subscriptions can now access diagnostic analytics.');

  } catch (error) {
    console.error('❌ Failed to create feature flag:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  createDiagnosticAnalyticsFeature()
    .then(() => {
      console.log('Feature flag setup completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Feature flag setup failed:', error);
      process.exit(1);
    });
}

module.exports = { createDiagnosticAnalyticsFeature };