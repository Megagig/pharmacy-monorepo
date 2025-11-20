#!/usr/bin/env ts-node

/**
 * Test Patient Engagement Rollout Implementation
 * 
 * This script tests the rollout functionality to ensure it works correctly.
 * It performs various tests including setup, rollout phases, monitoring, and rollback.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { FeatureFlag } from '../models/FeatureFlag';
import { PATIENT_ENGAGEMENT_FLAGS } from '../middlewares/patientEngagementFeatureFlags';
import PatientEngagementRolloutService from '../services/PatientEngagementRolloutService';
import { setupPatientEngagementFeatureFlags } from './setupPatientEngagementRollout';
import { performMonitoringCheck } from './monitorPatientEngagementRollout';
import connectDB from '../config/db';
import logger from '../utils/logger';

// Load environment variables
dotenv.config();

interface TestResult {
  testName: string;
  passed: boolean;
  error?: string;
  duration: number;
}

/**
 * Test feature flag setup
 */
async function testFeatureFlagSetup(): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    logger.info('Testing feature flag setup...');
    
    // Setup feature flags
    await setupPatientEngagementFeatureFlags();
    
    // Verify all flags were created
    const featureKeys = Object.values(PATIENT_ENGAGEMENT_FLAGS);
    const flags = await FeatureFlag.find({ 
      key: { $in: featureKeys } 
    });
    
    if (flags.length !== featureKeys.length) {
      throw new Error(`Expected ${featureKeys.length} flags, found ${flags.length}`);
    }
    
    // Verify flags have correct initial state
    for (const flag of flags) {
      if (!flag.isActive) {
        throw new Error(`Flag ${flag.key} is not active`);
      }
      
      if (flag.targetingRules?.percentage !== 0) {
        throw new Error(`Flag ${flag.key} should start with 0% rollout`);
      }
    }
    
    return {
      testName: 'Feature Flag Setup',
      passed: true,
      duration: Date.now() - startTime
    };
  } catch (error) {
    return {
      testName: 'Feature Flag Setup',
      passed: false,
      error: error.message,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Test rollout percentage updates
 */
async function testRolloutUpdates(): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    logger.info('Testing rollout percentage updates...');
    
    // Test updating to 25%
    await PatientEngagementRolloutService.updateRolloutPercentage(25, 'test-user');
    
    // Verify update
    const currentPercentage = await PatientEngagementRolloutService.getCurrentRolloutPercentage();
    if (currentPercentage !== 25) {
      throw new Error(`Expected 25%, got ${currentPercentage}%`);
    }
    
    // Test updating to 50%
    await PatientEngagementRolloutService.updateRolloutPercentage(50, 'test-user');
    
    // Verify update
    const newPercentage = await PatientEngagementRolloutService.getCurrentRolloutPercentage();
    if (newPercentage !== 50) {
      throw new Error(`Expected 50%, got ${newPercentage}%`);
    }
    
    // Test invalid percentage (should fail)
    try {
      await PatientEngagementRolloutService.updateRolloutPercentage(150, 'test-user');
      throw new Error('Should have failed with invalid percentage');
    } catch (error) {
      if (!error.message.includes('between 0 and 100')) {
        throw error;
      }
    }
    
    return {
      testName: 'Rollout Updates',
      passed: true,
      duration: Date.now() - startTime
    };
  } catch (error) {
    return {
      testName: 'Rollout Updates',
      passed: false,
      error: error.message,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Test rollout status and metrics
 */
async function testRolloutStatus(): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    logger.info('Testing rollout status and metrics...');
    
    // Get rollout status
    const status = await PatientEngagementRolloutService.getRolloutStatus();
    
    // Verify status structure
    if (!status.currentPercentage && status.currentPercentage !== 0) {
      throw new Error('Status missing currentPercentage');
    }
    
    if (!status.metrics) {
      throw new Error('Status missing metrics');
    }
    
    if (!status.phase) {
      throw new Error('Status missing phase');
    }
    
    // Get metrics
    const metrics = await PatientEngagementRolloutService.calculateRolloutMetrics();
    
    // Verify metrics structure
    if (typeof metrics.totalEligibleWorkspaces !== 'number') {
      throw new Error('Metrics missing totalEligibleWorkspaces');
    }
    
    if (typeof metrics.rolloutPercentage !== 'number') {
      throw new Error('Metrics missing rolloutPercentage');
    }
    
    return {
      testName: 'Rollout Status',
      passed: true,
      duration: Date.now() - startTime
    };
  } catch (error) {
    return {
      testName: 'Rollout Status',
      passed: false,
      error: error.message,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Test monitoring functionality
 */
async function testMonitoring(): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    logger.info('Testing monitoring functionality...');
    
    // Perform monitoring check
    const monitoringReport = await performMonitoringCheck();
    
    // Verify monitoring report structure
    if (!monitoringReport.timestamp) {
      throw new Error('Monitoring report missing timestamp');
    }
    
    if (typeof monitoringReport.healthScore !== 'number') {
      throw new Error('Monitoring report missing healthScore');
    }
    
    if (!Array.isArray(monitoringReport.alerts)) {
      throw new Error('Monitoring report missing alerts array');
    }
    
    if (!Array.isArray(monitoringReport.recommendations)) {
      throw new Error('Monitoring report missing recommendations array');
    }
    
    if (typeof monitoringReport.shouldPause !== 'boolean') {
      throw new Error('Monitoring report missing shouldPause');
    }
    
    // Test pause conditions
    const pauseCheck = await PatientEngagementRolloutService.shouldPauseRollout();
    
    if (typeof pauseCheck.shouldPause !== 'boolean') {
      throw new Error('Pause check missing shouldPause');
    }
    
    if (typeof pauseCheck.errorRate !== 'number') {
      throw new Error('Pause check missing errorRate');
    }
    
    return {
      testName: 'Monitoring',
      passed: true,
      duration: Date.now() - startTime
    };
  } catch (error) {
    return {
      testName: 'Monitoring',
      passed: false,
      error: error.message,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Test enabled workspaces functionality
 */
async function testEnabledWorkspaces(): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    logger.info('Testing enabled workspaces functionality...');
    
    // Set rollout to 25%
    await PatientEngagementRolloutService.updateRolloutPercentage(25, 'test-user');
    
    // Get enabled workspaces
    const enabledWorkspaces = await PatientEngagementRolloutService.getEnabledWorkspaces();
    
    // Verify structure
    if (!Array.isArray(enabledWorkspaces)) {
      throw new Error('Enabled workspaces should be an array');
    }
    
    // Verify each workspace has required fields
    for (const workspace of enabledWorkspaces) {
      if (!workspace.workspaceId) {
        throw new Error('Workspace missing workspaceId');
      }
      
      if (!workspace.workspaceName) {
        throw new Error('Workspace missing workspaceName');
      }
      
      if (typeof workspace.userCount !== 'number') {
        throw new Error('Workspace missing userCount');
      }
      
      if (!workspace.subscriptionTier) {
        throw new Error('Workspace missing subscriptionTier');
      }
    }
    
    return {
      testName: 'Enabled Workspaces',
      passed: true,
      duration: Date.now() - startTime
    };
  } catch (error) {
    return {
      testName: 'Enabled Workspaces',
      passed: false,
      error: error.message,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Test rollout report generation
 */
async function testRolloutReport(): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    logger.info('Testing rollout report generation...');
    
    // Generate report
    const report = await PatientEngagementRolloutService.generateRolloutReport();
    
    // Verify report structure
    if (!report.summary) {
      throw new Error('Report missing summary');
    }
    
    if (!Array.isArray(report.enabledWorkspaces)) {
      throw new Error('Report missing enabledWorkspaces array');
    }
    
    if (!Array.isArray(report.recommendations)) {
      throw new Error('Report missing recommendations array');
    }
    
    return {
      testName: 'Rollout Report',
      passed: true,
      duration: Date.now() - startTime
    };
  } catch (error) {
    return {
      testName: 'Rollout Report',
      passed: false,
      error: error.message,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Test rollback functionality
 */
async function testRollback(): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    logger.info('Testing rollback functionality...');
    
    // Set rollout to 75%
    await PatientEngagementRolloutService.updateRolloutPercentage(75, 'test-user');
    
    // Verify it's set
    let currentPercentage = await PatientEngagementRolloutService.getCurrentRolloutPercentage();
    if (currentPercentage !== 75) {
      throw new Error(`Expected 75%, got ${currentPercentage}%`);
    }
    
    // Rollback to 0%
    await PatientEngagementRolloutService.updateRolloutPercentage(0, 'test-user');
    
    // Verify rollback
    currentPercentage = await PatientEngagementRolloutService.getCurrentRolloutPercentage();
    if (currentPercentage !== 0) {
      throw new Error(`Expected 0% after rollback, got ${currentPercentage}%`);
    }
    
    return {
      testName: 'Rollback',
      passed: true,
      duration: Date.now() - startTime
    };
  } catch (error) {
    return {
      testName: 'Rollback',
      passed: false,
      error: error.message,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Run all tests
 */
async function runAllTests(): Promise<TestResult[]> {
  const tests = [
    testFeatureFlagSetup,
    testRolloutUpdates,
    testRolloutStatus,
    testMonitoring,
    testEnabledWorkspaces,
    testRolloutReport,
    testRollback
  ];
  
  const results: TestResult[] = [];
  
  for (const test of tests) {
    try {
      const result = await test();
      results.push(result);
      
      if (result.passed) {
        console.log(`✅ ${result.testName} - ${result.duration}ms`);
      } else {
        console.log(`❌ ${result.testName} - ${result.error} (${result.duration}ms)`);
      }
    } catch (error) {
      results.push({
        testName: test.name,
        passed: false,
        error: error.message,
        duration: 0
      });
      console.log(`❌ ${test.name} - ${error.message}`);
    }
  }
  
  return results;
}

/**
 * Display test summary
 */
function displayTestSummary(results: TestResult[]): void {
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  
  console.log('\n📊 Test Summary');
  console.log('===============');
  console.log(`Total Tests: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total Duration: ${totalDuration}ms`);
  console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);
  
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.testName}: ${r.error}`);
    });
  }
  
  console.log('\n');
}

/**
 * Main test function
 */
async function main(): Promise<void> {
  try {
    // Connect to database
    await connectDB();
    logger.info('Connected to database for testing');
    
    console.log('\n🧪 Patient Engagement Rollout Test Suite');
    console.log('=========================================\n');
    
    // Run all tests
    const results = await runAllTests();
    
    // Display summary
    displayTestSummary(results);
    
    // Exit with appropriate code
    const failed = results.filter(r => !r.passed).length;
    process.exit(failed > 0 ? 1 : 0);
    
  } catch (error) {
    logger.error('Test suite failed:', error);
    console.error('\n❌ Test Suite Error:', error.message);
    process.exit(1);
  }
}

// Run the tests if called directly
if (require.main === module) {
  main();
}

export { 
  runAllTests,
  testFeatureFlagSetup,
  testRolloutUpdates,
  testRolloutStatus,
  testMonitoring,
  testEnabledWorkspaces,
  testRolloutReport,
  testRollback
};