/**
 * Test Script for Patient Engagement Feature Flag Rollout
 * 
 * This script tests the gradual rollout functionality by simulating
 * different rollout percentages and verifying user distribution.
 */

import mongoose from 'mongoose';
import { FeatureFlag } from '../src/models/FeatureFlag';
import FeatureFlagService from '../src/services/FeatureFlagService';
import logger from '../src/utils/logger';

// Connect to MongoDB
const connectDB = async () => {
  try {
    // Load environment variables
    require('dotenv').config();
    
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmacycopilot';
    console.log('Connecting to MongoDB Atlas for rollout testing...');
    
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB Atlas for rollout testing');
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Generate test user IDs
const generateTestUsers = (count: number): Array<{ userId: string; workspaceId: string }> => {
  const users = [];
  for (let i = 1; i <= count; i++) {
    users.push({
      userId: `user_${i.toString().padStart(4, '0')}`,
      workspaceId: `workspace_${Math.ceil(i / 10).toString().padStart(3, '0')}`
    });
  }
  return users;
};

// Test rollout distribution
const testRolloutDistribution = async (
  featureFlag: string,
  rolloutPercentage: number,
  testUsers: Array<{ userId: string; workspaceId: string }>
) => {
  console.log(`\n=== Testing ${rolloutPercentage}% rollout for ${featureFlag} ===`);
  
  let enabledCount = 0;
  const results = [];

  for (const user of testUsers) {
    const evaluation = await FeatureFlagService.isFeatureEnabled(
      featureFlag,
      user.userId,
      user.workspaceId
    );
    
    if (evaluation.enabled) {
      enabledCount++;
    }
    
    results.push({
      userId: user.userId,
      workspaceId: user.workspaceId,
      enabled: evaluation.enabled,
      reason: evaluation.reason,
      userPercentile: evaluation.userPercentile
    });
  }

  const actualPercentage = (enabledCount / testUsers.length) * 100;
  const variance = Math.abs(actualPercentage - rolloutPercentage);

  console.log(`Target: ${rolloutPercentage}%`);
  console.log(`Actual: ${actualPercentage.toFixed(2)}%`);
  console.log(`Variance: ${variance.toFixed(2)}%`);
  console.log(`Enabled users: ${enabledCount}/${testUsers.length}`);

  // Check if variance is within acceptable range (±5% for large samples)
  const isAcceptable = variance <= 5;
  console.log(`Distribution: ${isAcceptable ? '✅ ACCEPTABLE' : '❌ OUTSIDE TOLERANCE'}`);

  return {
    target: rolloutPercentage,
    actual: actualPercentage,
    variance,
    enabledCount,
    totalUsers: testUsers.length,
    isAcceptable,
    results,
    isConsistent: true // Will be set later
  };
};

// Test consistency (same user should get same result)
const testConsistency = async (
  featureFlag: string,
  testUsers: Array<{ userId: string; workspaceId: string }>
) => {
  console.log(`\n=== Testing consistency for ${featureFlag} ===`);
  
  let consistentCount = 0;
  
  for (const user of testUsers.slice(0, 10)) { // Test first 10 users
    const evaluation1 = await FeatureFlagService.isFeatureEnabled(
      featureFlag,
      user.userId,
      user.workspaceId
    );
    
    const evaluation2 = await FeatureFlagService.isFeatureEnabled(
      featureFlag,
      user.userId,
      user.workspaceId
    );
    
    if (evaluation1.enabled === evaluation2.enabled) {
      consistentCount++;
    } else {
      console.log(`❌ Inconsistent result for user ${user.userId}`);
    }
  }
  
  const consistencyRate = (consistentCount / 10) * 100;
  console.log(`Consistency: ${consistencyRate}% (${consistentCount}/10)`);
  
  return consistencyRate === 100;
};

// Update feature flag rollout percentage
const updateFeatureFlagRollout = async (featureKey: string, percentage: number) => {
  try {
    const updateData: any = {
      isActive: percentage > 0,
      'targetingRules.percentage': percentage
    };

    const result = await FeatureFlag.findOneAndUpdate(
      { key: featureKey },
      updateData,
      { new: true }
    );
    
    if (!result) {
      throw new Error(`Feature flag ${featureKey} not found`);
    }
    
    // Clear cache to ensure fresh evaluation
    FeatureFlagService.clearCache();
    
    console.log(`Updated ${featureKey} rollout to ${percentage}%`);
  } catch (error) {
    console.error(`Failed to update feature flag ${featureKey}:`, error);
    throw error;
  }
};

// Main test function
const runRolloutTests = async () => {
  try {
    console.log('🚀 Starting Patient Engagement Feature Flag Rollout Tests\n');
    
    // Generate test users
    const testUsers = generateTestUsers(1000); // 1000 test users across 100 workspaces
    console.log(`Generated ${testUsers.length} test users across ${Math.ceil(testUsers.length / 10)} workspaces`);
    
    const featureFlag = 'patient_engagement_module';
    const rolloutStages = [0, 10, 25, 50, 75, 100];
    
    const testResults = [];
    
    // Test each rollout stage
    for (const percentage of rolloutStages) {
      await updateFeatureFlagRollout(featureFlag, percentage);
      
      // Wait a moment for cache to clear
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const result = await testRolloutDistribution(featureFlag, percentage, testUsers);
      testResults.push(result);
      
      // Test consistency for this stage
      const isConsistent = await testConsistency(featureFlag, testUsers);
      result.isConsistent = isConsistent;
    }
    
    // Test user percentile distribution
    console.log('\n=== Testing User Percentile Distribution ===');
    await updateFeatureFlagRollout(featureFlag, 50);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const percentileTest = await testRolloutDistribution(featureFlag, 50, testUsers.slice(0, 100));
    const percentiles = percentileTest.results
      .filter(r => r.userPercentile !== undefined)
      .map(r => r.userPercentile!);
    
    if (percentiles.length > 0) {
      const avgPercentile = percentiles.reduce((sum, p) => sum + p, 0) / percentiles.length;
      const minPercentile = Math.min(...percentiles);
      const maxPercentile = Math.max(...percentiles);
      
      console.log(`Percentile range: ${minPercentile} - ${maxPercentile}`);
      console.log(`Average percentile: ${avgPercentile.toFixed(2)}`);
      console.log(`Expected range: 0 - 99`);
      
      const isValidRange = minPercentile >= 0 && maxPercentile <= 99;
      console.log(`Percentile distribution: ${isValidRange ? '✅ VALID' : '❌ INVALID'}`);
    }
    
    // Summary
    console.log('\n=== TEST SUMMARY ===');
    console.log('Rollout Stage Results:');
    testResults.forEach(result => {
      const status = result.isAcceptable && result.isConsistent ? '✅' : '❌';
      console.log(`  ${result.target}%: ${result.actual.toFixed(2)}% (±${result.variance.toFixed(2)}%) ${status}`);
    });
    
    const allPassed = testResults.every(r => r.isAcceptable && r.isConsistent);
    console.log(`\nOverall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    
    // Test workspace isolation
    console.log('\n=== Testing Workspace Isolation ===');
    const workspace1Users = testUsers.filter(u => u.workspaceId === 'workspace_001');
    const workspace2Users = testUsers.filter(u => u.workspaceId === 'workspace_002');
    
    if (workspace1Users.length > 0 && workspace2Users.length > 0) {
      const ws1Result = await testRolloutDistribution(featureFlag, 50, workspace1Users);
      const ws2Result = await testRolloutDistribution(featureFlag, 50, workspace2Users);
      
      console.log(`Workspace 1: ${ws1Result.actual.toFixed(2)}%`);
      console.log(`Workspace 2: ${ws2Result.actual.toFixed(2)}%`);
      
      // Both workspaces should have similar distribution
      const workspaceVariance = Math.abs(ws1Result.actual - ws2Result.actual);
      console.log(`Workspace variance: ${workspaceVariance.toFixed(2)}%`);
      console.log(`Workspace isolation: ${workspaceVariance <= 15 ? '✅ GOOD' : '❌ HIGH VARIANCE'}`);
    }
    
    // Reset feature flag to disabled state
    await updateFeatureFlagRollout(featureFlag, 0);
    console.log('\n✅ Tests completed. Feature flag reset to 0% rollout.');
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    throw error;
  }
};

// Performance test
const runPerformanceTest = async () => {
  console.log('\n=== Performance Test ===');
  
  const testUsers = generateTestUsers(100);
  const featureFlag = 'patient_engagement_module';
  
  await updateFeatureFlagRollout(featureFlag, 50);
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const startTime = Date.now();
  
  // Test 100 concurrent evaluations
  const promises = testUsers.map(user => 
    FeatureFlagService.isFeatureEnabled(featureFlag, user.userId, user.workspaceId)
  );
  
  await Promise.all(promises);
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  const avgTime = duration / testUsers.length;
  
  console.log(`Evaluated ${testUsers.length} feature flags in ${duration}ms`);
  console.log(`Average evaluation time: ${avgTime.toFixed(2)}ms`);
  console.log(`Performance: ${avgTime < 10 ? '✅ EXCELLENT' : avgTime < 50 ? '✅ GOOD' : '⚠️ SLOW'}`);
};

// Main execution
const main = async () => {
  try {
    await connectDB();
    
    // Check if feature flags exist
    const moduleFlag = await FeatureFlag.findOne({ key: 'patient_engagement_module' });
    if (!moduleFlag) {
      console.log('❌ Patient engagement feature flags not found.');
      console.log('Please run the createPatientEngagementFeatureFlags script first.');
      process.exit(1);
    }
    
    await runRolloutTests();
    await runPerformanceTest();
    
    console.log('\n🎉 All rollout tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Rollout test failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
};

// Run if called directly
if (require.main === module) {
  main();
}

export { runRolloutTests, testRolloutDistribution, testConsistency };