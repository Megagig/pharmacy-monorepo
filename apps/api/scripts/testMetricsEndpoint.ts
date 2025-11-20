#!/usr/bin/env ts-node

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { FeatureFlag } from '../src/models/FeatureFlag';
import EnhancedFeatureFlagService from '../src/services/enhancedFeatureFlagService';

// Load environment variables
dotenv.config();

async function testMetricsEndpoint() {
  try {
    console.log('🧪 Testing metrics endpoint functionality...');

    // Connect to MongoDB
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is required');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get a sample feature flag
    const sampleFlag = await FeatureFlag.findOne({ key: 'ai_diagnostics' });
    if (!sampleFlag) {
      console.log('❌ No ai_diagnostics feature flag found');
      return;
    }

    console.log(`📋 Testing metrics for: ${sampleFlag.name} (${sampleFlag.key})`);

    // Test the service method directly
    try {
      const metrics = await EnhancedFeatureFlagService.calculateUsageMetrics(sampleFlag.key);
      console.log('✅ Metrics calculation successful:');
      console.log(`   Total Users: ${metrics.totalUsers}`);
      console.log(`   Active Users: ${metrics.activeUsers}`);
      console.log(`   Usage Percentage: ${metrics.usagePercentage}%`);
      console.log(`   Usage by Plan: ${metrics.usageByPlan?.length || 0} plans`);
      console.log(`   Usage by Workspace: ${metrics.usageByWorkspace?.length || 0} workspaces`);
    } catch (error) {
      console.error('❌ Metrics calculation failed:', error);
    }

    // Test if the feature flag has the expected structure
    console.log('\n📊 Feature Flag Structure:');
    console.log(`   ID: ${sampleFlag._id}`);
    console.log(`   Key: ${sampleFlag.key}`);
    console.log(`   Name: ${sampleFlag.name}`);
    console.log(`   Active: ${sampleFlag.isActive}`);
    console.log(`   Allowed Tiers: ${JSON.stringify(sampleFlag.allowedTiers)}`);
    console.log(`   Targeting Rules: ${sampleFlag.targetingRules ? 'Present' : 'Not Present'}`);
    console.log(`   Usage Metrics: ${sampleFlag.usageMetrics ? 'Present' : 'Not Present'}`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

// Run test if this script is executed directly
if (require.main === module) {
  testMetricsEndpoint();
}

export default testMetricsEndpoint;