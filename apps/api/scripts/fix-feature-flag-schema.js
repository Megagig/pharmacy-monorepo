#!/usr/bin/env node

/**
 * Script to fix the diagnostic analytics feature flag schema
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://megagigdev:9svFmZ3VCP5ONzfU@cluster0.vf50xoc.mongodb.net/PharmaCare?retryWrites=true&w=majority&appName=Cluster0';

async function fixFeatureFlagSchema() {
  try {
    console.log('🔧 Fixing diagnostic analytics feature flag schema...');
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // Find and delete any existing diagnostic_analytics feature flags
    const existingFlags = await db.collection('featureflags').find({
      $or: [
        { name: 'diagnostic_analytics' },
        { key: 'diagnostic_analytics' }
      ]
    }).toArray();

    console.log(`Found ${existingFlags.length} existing feature flags`);

    if (existingFlags.length > 0) {
      await db.collection('featureflags').deleteMany({
        $or: [
          { name: 'diagnostic_analytics' },
          { key: 'diagnostic_analytics' }
        ]
      });
      console.log('✅ Deleted existing feature flags');
    }

    // Create the feature flag with correct schema
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
    console.log('✅ Created diagnostic_analytics feature flag with correct schema');

    // Verify the feature flag
    const verifyFlag = await db.collection('featureflags').findOne({
      key: 'diagnostic_analytics'
    });

    if (verifyFlag) {
      console.log('✅ Feature flag verification successful:');
      console.log(`   - name: ${verifyFlag.name}`);
      console.log(`   - key: ${verifyFlag.key}`);
      console.log(`   - isActive: ${verifyFlag.isActive}`);
      console.log(`   - allowedTiers: ${verifyFlag.allowedTiers?.join(', ')}`);
      console.log(`   - allowedRoles: ${verifyFlag.allowedRoles?.join(', ') || 'all roles'}`);
    }

    console.log('\n✅ Feature flag schema fix completed!');
    console.log('Analytics should now be accessible.');

  } catch (error) {
    console.error('❌ Failed to fix feature flag schema:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  fixFeatureFlagSchema()
    .then(() => {
      console.log('Feature flag schema fix completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Feature flag schema fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixFeatureFlagSchema };