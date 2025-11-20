#!/usr/bin/env ts-node

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { FeatureFlag } from '../src/models/FeatureFlag';

// Load environment variables
dotenv.config();

async function getFeatureFlagIds() {
  try {
    console.log('🔍 Getting feature flag IDs for testing...');

    // Connect to MongoDB
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is required');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get all feature flags with their IDs
    const flags = await FeatureFlag.find({}).select('_id key name isActive').limit(10);
    
    console.log(`📋 Found ${flags.length} feature flags:`);
    flags.forEach((flag, index) => {
      console.log(`${index + 1}. ${flag.name} (${flag.key})`);
      console.log(`   ID: ${flag._id}`);
      console.log(`   Active: ${flag.isActive}`);
      console.log('');
    });

    // Test the metrics endpoint URL format
    if (flags.length > 0) {
      const testFlag = flags[0];
      console.log(`🧪 Test URL for ${testFlag.name}:`);
      console.log(`   GET /api/feature-flags/${testFlag._id}/metrics`);
      console.log(`   Full URL: http://localhost:5000/api/feature-flags/${testFlag._id}/metrics`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

// Run if this script is executed directly
if (require.main === module) {
  getFeatureFlagIds();
}

export default getFeatureFlagIds;