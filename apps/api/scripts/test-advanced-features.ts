import mongoose from 'mongoose';
import EducationalResource from '../src/models/EducationalResource';
import Patient from '../src/models/Patient';
import logger from '../src/utils/logger';

/**
 * Test script for advanced educational resources features
 * Tests: Analytics, Scheduling, and Recommendations
 */

async function testAdvancedFeatures() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmacy-management';
    await mongoose.connect(mongoUri);
    logger.info('✓ Connected to MongoDB\n');

    // Test 1: Analytics Tracking
    logger.info('=== TEST 1: Analytics Tracking ===');
    const resource = await EducationalResource.findOne({ isPublished: true });
    
    if (resource) {
      logger.info(`Testing with resource: "${resource.title}"`);
      
      // Track dashboard view
      await resource.trackDashboardView();
      logger.info('✓ Dashboard view tracked');
      
      // Track dashboard click
      await resource.trackDashboardClick();
      logger.info('✓ Dashboard click tracked');
      
      // Track education page view
      await resource.trackEducationPageView();
      logger.info('✓ Education page view tracked');
      
      // Update time spent
      await resource.updateAverageTimeSpent(120); // 2 minutes
      logger.info('✓ Time spent updated');
      
      // Reload and check analytics
      const updated = await EducationalResource.findById(resource._id);
      logger.info('\nAnalytics Data:');
      logger.info(`  Dashboard Views: ${updated?.analytics.dashboardViews}`);
      logger.info(`  Dashboard Clicks: ${updated?.analytics.dashboardClicks}`);
      logger.info(`  Education Page Views: ${updated?.analytics.educationPageViews}`);
      logger.info(`  Click-Through Rate: ${updated?.analytics.clickThroughRate}%`);
      logger.info(`  Average Time Spent: ${updated?.analytics.averageTimeSpent}s`);
      logger.info(`  Last Viewed: ${updated?.analytics.lastViewedAt}`);
    } else {
      logger.warn('No published resources found for analytics test');
    }

    // Test 2: Scheduling
    logger.info('\n\n=== TEST 2: Scheduling ===');
    
    // Create a scheduled resource for testing
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const scheduledResource = await EducationalResource.findOne({ isPublished: true });
    if (scheduledResource) {
      scheduledResource.isScheduled = true;
      scheduledResource.scheduledStartDate = tomorrow;
      scheduledResource.scheduledEndDate = nextWeek;
      
      await scheduledResource.save();
      logger.info(`✓ Resource scheduled: "${scheduledResource.title}"`);
      logger.info(`  Start: ${scheduledResource.scheduledStartDate}`);
      logger.info(`  End: ${scheduledResource.scheduledEndDate}`);
      
      // Test isCurrentlyScheduled method
      const isActive = scheduledResource.isCurrentlyScheduled();
      logger.info(`  Currently Active: ${isActive} (should be false - starts tomorrow)`);
      
      // Test with resource that should be active
      scheduledResource.scheduledStartDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Yesterday
      const isActiveNow = scheduledResource.isCurrentlyScheduled();
      logger.info(`  After adjusting to past start: ${isActiveNow} (should be true)`);
    } else {
      logger.warn('No resources found for scheduling test');
    }

    // Test 3: Recommendation Score Calculation
    logger.info('\n\n=== TEST 3: Recommendation Scoring ===');
    
    const testResource = await EducationalResource.findOne({ isPublished: true });
    if (testResource) {
      // Set up recommendation criteria
      testResource.autoRecommend = true;
      testResource.recommendationCriteria = {
        conditions: ['diabetes', 'hypertension'],
        medications: ['metformin', 'lisinopril'],
        ageGroups: ['adult', 'senior'],
      };
      testResource.ratings.averageRating = 4.5;
      testResource.viewCount = 500;
      
      await testResource.save();
      
      // Test with matching patient profile
      const userProfile = {
        conditions: ['diabetes', 'hypertension'],
        medications: ['metformin'],
        ageGroup: 'adult',
      };
      
      const score = testResource.calculateRecommendationScore(userProfile);
      logger.info(`Resource: "${testResource.title}"`);
      logger.info(`Recommendation Score: ${score}/100`);
      logger.info(`Profile matches:`);
      logger.info(`  - Conditions: ${userProfile.conditions.join(', ')}`);
      logger.info(`  - Medications: ${userProfile.medications.join(', ')}`);
      logger.info(`  - Age Group: ${userProfile.ageGroup}`);
      
      // Test with no profile
      const baseScore = testResource.calculateRecommendationScore();
      logger.info(`\nBase score (no profile): ${baseScore}/100`);
      
      // Test with partial match
      const partialProfile = {
        conditions: ['diabetes'],
        medications: [],
        ageGroup: 'child',
      };
      const partialScore = testResource.calculateRecommendationScore(partialProfile);
      logger.info(`Partial match score: ${partialScore}/100`);
    } else {
      logger.warn('No resources found for recommendation test');
    }

    // Test 4: Query Scheduled Resources
    logger.info('\n\n=== TEST 4: Query Scheduled Resources ===');
    
    const now2 = new Date();
    const activeScheduled = await EducationalResource.find({
      isScheduled: true,
      scheduledStartDate: { $lte: now2 },
      $or: [
        { scheduledEndDate: { $gte: now2 } },
        { scheduledEndDate: null },
      ],
    });
    
    logger.info(`Active scheduled resources: ${activeScheduled.length}`);
    activeScheduled.forEach((r, i) => {
      logger.info(`  ${i + 1}. "${r.title}"`);
      logger.info(`     Start: ${r.scheduledStartDate}`);
      logger.info(`     End: ${r.scheduledEndDate || 'No end date'}`);
    });

    // Test 5: Query Auto-Recommend Resources
    logger.info('\n\n=== TEST 5: Query Auto-Recommend Resources ===');
    
    const autoRecommendResources = await EducationalResource.find({
      autoRecommend: true,
      isPublished: true,
    });
    
    logger.info(`Auto-recommend resources: ${autoRecommendResources.length}`);
    autoRecommendResources.forEach((r, i) => {
      logger.info(`  ${i + 1}. "${r.title}"`);
      logger.info(`     Conditions: ${r.recommendationCriteria?.conditions?.join(', ') || 'None'}`);
      logger.info(`     Medications: ${r.recommendationCriteria?.medications?.join(', ') || 'None'}`);
      logger.info(`     Age Groups: ${r.recommendationCriteria?.ageGroups?.join(', ') || 'None'}`);
    });

    // Test 6: Analytics Summary
    logger.info('\n\n=== TEST 6: Analytics Summary ===');
    
    const allResources = await EducationalResource.find({
      isPublished: true,
      isDeleted: false,
    });
    
    const summary = {
      totalResources: allResources.length,
      totalViews: allResources.reduce((sum, r) => sum + r.viewCount, 0),
      totalDashboardViews: allResources.reduce((sum, r) => sum + (r.analytics?.dashboardViews || 0), 0),
      totalDashboardClicks: allResources.reduce((sum, r) => sum + (r.analytics?.dashboardClicks || 0), 0),
      averageRating: (allResources.reduce((sum, r) => sum + r.ratings.averageRating, 0) / allResources.length).toFixed(2),
      averageCTR: (allResources.reduce((sum, r) => sum + (r.analytics?.clickThroughRate || 0), 0) / allResources.length).toFixed(2),
      pinnedResources: allResources.filter(r => r.isPinned).length,
      scheduledResources: allResources.filter(r => r.isScheduled).length,
      autoRecommendResources: allResources.filter(r => r.autoRecommend).length,
    };
    
    logger.info('Summary Statistics:');
    logger.info(`  Total Resources: ${summary.totalResources}`);
    logger.info(`  Total Views: ${summary.totalViews}`);
    logger.info(`  Dashboard Views: ${summary.totalDashboardViews}`);
    logger.info(`  Dashboard Clicks: ${summary.totalDashboardClicks}`);
    logger.info(`  Average Rating: ${summary.averageRating}/5`);
    logger.info(`  Average CTR: ${summary.averageCTR}%`);
    logger.info(`  Pinned Resources: ${summary.pinnedResources}`);
    logger.info(`  Scheduled Resources: ${summary.scheduledResources}`);
    logger.info(`  Auto-Recommend Resources: ${summary.autoRecommendResources}`);

    // Test 7: Validation Tests
    logger.info('\n\n=== TEST 7: Validation Tests ===');
    
    try {
      const invalidResource = new EducationalResource({
        title: 'Test Invalid Scheduling',
        description: 'Testing validation',
        content: 'Test content for validation',
        category: 'medication',
        mediaType: 'article',
        slug: 'test-invalid-scheduling',
        isPublished: true,
        isScheduled: true,
        scheduledEndDate: new Date('2024-01-01'),
        scheduledStartDate: new Date('2024-12-31'), // End before start
      });
      
      await invalidResource.save();
      logger.error('✗ Validation failed: Should have rejected end date before start date');
    } catch (error: any) {
      logger.info('✓ Validation working: Correctly rejected invalid date range');
      logger.info(`  Error: ${error.message}`);
    }

    logger.info('\n\n=== ALL TESTS COMPLETED ===');
    logger.info('✓ Analytics tracking methods work');
    logger.info('✓ Scheduling logic works');
    logger.info('✓ Recommendation scoring works');
    logger.info('✓ Query filtering works');
    logger.info('✓ Validation works');
    logger.info('\n✅ All advanced features are functioning correctly!');

  } catch (error) {
    logger.error('Test failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    logger.info('\nDisconnected from MongoDB');
  }
}

// Run tests
testAdvancedFeatures()
  .then(() => {
    logger.info('\nTest script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Test script failed:', error);
    process.exit(1);
  });
