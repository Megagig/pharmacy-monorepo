#!/usr/bin/env node

/**
 * Script to add the missing diagnostic_analytics feature flag
 * This fixes the 403 error when accessing diagnostic analytics
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://megagigdev:9svFmZ3VCP5ONzfU@cluster0.vf50xoc.mongodb.net/PharmaCare?retryWrites=true&w=majority&appName=Cluster0';

async function addDiagnosticAnalyticsFeature() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // Check if diagnostic_analytics feature flag already exists
    const existingFlag = await db.collection('featureflags').findOne({ key: 'diagnostic_analytics' });
    
    if (existingFlag) {
      console.log('✓ diagnostic_analytics feature flag already exists');
      
      // Update it to ensure it's properly configured
      await db.collection('featureflags').updateOne(
        { key: 'diagnostic_analytics' },
        {
          $set: {
            name: 'Diagnostic Analytics',
            description: 'Access to diagnostic analytics and reporting features',
            isActive: true,
            allowedTiers: ['pro', 'enterprise', 'free_trial'],
            allowedRoles: ['pharmacist', 'senior_pharmacist', 'pharmacy_manager', 'owner', 'pharmacy_outlet', 'pharmacy_team'],
            metadata: {
              category: 'diagnostics',
              priority: 'high',
              tags: ['analytics', 'reporting', 'diagnostics']
            },
            updatedAt: new Date()
          }
        }
      );
      console.log('✓ Updated diagnostic_analytics feature flag configuration');
    } else {
      // Create the feature flag
      const featureFlag = {
        name: 'Diagnostic Analytics',
        key: 'diagnostic_analytics',
        description: 'Access to diagnostic analytics and reporting features',
        isActive: true,
        allowedTiers: ['pro', 'enterprise', 'free_trial'],
        allowedRoles: ['pharmacist', 'senior_pharmacist', 'pharmacy_manager', 'owner', 'pharmacy_outlet', 'pharmacy_team'],
        customRules: {},
        metadata: {
          category: 'diagnostics',
          priority: 'high',
          tags: ['analytics', 'reporting', 'diagnostics']
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.collection('featureflags').insertOne(featureFlag);
      console.log('✓ Created diagnostic_analytics feature flag');
    }

    console.log('\n✅ Diagnostic analytics feature flag setup completed!');
    console.log('Users with pro, enterprise, or free_trial subscriptions can now access diagnostic analytics.');

  } catch (error) {
    console.error('❌ Failed to setup diagnostic analytics feature:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  addDiagnosticAnalyticsFeature()
    .then(() => {
      console.log('Feature flag setup completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Feature flag setup failed:', error);
      process.exit(1);
    });
}

module.exports = { addDiagnosticAnalyticsFeature };