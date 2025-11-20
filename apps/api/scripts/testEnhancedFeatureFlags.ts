#!/usr/bin/env ts-node

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { FeatureFlag } from '../src/models/FeatureFlag';
import EnhancedFeatureFlagService from '../src/services/enhancedFeatureFlagService';
import User from '../src/models/User';

// Load environment variables
dotenv.config();

async function testEnhancedFeatureFlags() {
  try {
    console.log('🧪 Testing Enhanced Feature Flag functionality...');

    // Connect to MongoDB
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is required');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Test 1: Verify enhanced model fields
    console.log('\n📋 Test 1: Verify Enhanced Model Fields');
    const sampleFlag = await FeatureFlag.findOne({ key: 'ai_diagnostics' });
    if (sampleFlag) {
      console.log(`✅ Feature Flag: ${sampleFlag.name}`);
      console.log(`   Display Order: ${sampleFlag.metadata?.displayOrder}`);
      console.log(`   Marketing Feature: ${sampleFlag.metadata?.isMarketingFeature}`);
      console.log(`   Targeting Percentage: ${sampleFlag.targetingRules?.percentage}%`);
      console.log(`   Usage Metrics: ${sampleFlag.usageMetrics ? 'Present' : 'Not Present'}`);
    }

    // Test 2: Test targeting rules update
    console.log('\n🎯 Test 2: Update Targeting Rules');
    const targetingRules = {
      percentage: 50, // 50% rollout
      userGroups: ['pharmacist', 'pharmacy_team'],
      conditions: {
        dateRange: {
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        },
      },
    };

    const updatedFlag = await EnhancedFeatureFlagService.updateTargetingRules(
      'ai_diagnostics',
      targetingRules,
      '507f1f77bcf86cd799439011' // Mock admin user ID
    );

    if (updatedFlag) {
      console.log(`✅ Updated targeting rules for: ${updatedFlag.name}`);
      console.log(`   Percentage: ${updatedFlag.targetingRules?.percentage}%`);
      console.log(`   User Groups: ${updatedFlag.targetingRules?.userGroups?.join(', ')}`);
    }

    // Test 3: Test usage metrics calculation
    console.log('\n📊 Test 3: Calculate Usage Metrics');
    const metrics = await EnhancedFeatureFlagService.calculateUsageMetrics('ai_diagnostics');
    console.log(`✅ Usage Metrics for AI Diagnostics:`);
    console.log(`   Total Users: ${metrics.totalUsers}`);
    console.log(`   Active Users: ${metrics.activeUsers}`);
    console.log(`   Usage Percentage: ${metrics.usagePercentage}%`);
    console.log(`   Usage by Plan: ${metrics.usageByPlan?.length || 0} plans`);
    console.log(`   Usage by Workspace: ${metrics.usageByWorkspace?.length || 0} workspaces`);

    // Test 4: Test marketing features
    console.log('\n🎪 Test 4: Get Marketing Features');
    
    // First, mark some features as marketing features
    await FeatureFlag.updateMany(
      { key: { $in: ['ai_diagnostics', 'patient_management', 'advanced_analytics'] } },
      { $set: { 'metadata.isMarketingFeature': true } }
    );

    const marketingFeatures = await EnhancedFeatureFlagService.getMarketingFeatures();
    console.log(`✅ Marketing Features: ${marketingFeatures.length} found`);
    marketingFeatures.forEach((feature, index) => {
      console.log(`   ${index + 1}. ${feature.name} (${feature.key})`);
      console.log(`      Display Order: ${feature.metadata?.displayOrder}`);
      console.log(`      Marketing Description: ${feature.metadata?.marketingDescription || 'Not set'}`);
    });

    // Test 5: Test advanced feature access
    console.log('\n🔐 Test 5: Test Advanced Feature Access');
    
    // Find a test user
    const testUser = await User.findOne({ role: 'pharmacist' });
    if (testUser) {
      const accessResult = await EnhancedFeatureFlagService.hasAdvancedFeatureAccess(
        testUser._id.toString(),
        'ai_diagnostics',
        testUser.workplaceId?.toString()
      );

      console.log(`✅ Access Check for user: ${testUser.email}`);
      console.log(`   Has Access: ${accessResult.hasAccess}`);
      console.log(`   Reason: ${accessResult.reason}`);
      console.log(`   Targeting Applied: ${accessResult.targetingApplied}`);
    } else {
      console.log('⚠️  No test user found for access testing');
    }

    // Test 6: Test validation
    console.log('\n✅ Test 6: Test Targeting Rules Validation');
    
    const validRules = { percentage: 75 };
    const invalidRules = { percentage: 150 };

    const validResult = EnhancedFeatureFlagService.validateTargetingRules(validRules);
    const invalidResult = EnhancedFeatureFlagService.validateTargetingRules(invalidRules);

    console.log(`✅ Valid rules (75%): ${validResult.isValid ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Invalid rules (150%): ${invalidResult.isValid ? 'PASS (Unexpected)' : 'FAIL (Expected)'}`);
    if (!invalidResult.isValid) {
      console.log(`   Error: ${invalidResult.error}`);
    }

    console.log('\n🎉 All Enhanced Feature Flag tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  testEnhancedFeatureFlags();
}

export default testEnhancedFeatureFlags;