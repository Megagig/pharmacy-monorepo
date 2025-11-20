/**
 * Post-Launch Monitoring Tests
 * 
 * Comprehensive tests for the post-launch monitoring system including
 * system health metrics, user feedback, success tracking, and Phase 2 planning.
 */

import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app';
import User from '../models/User';
import Workplace from '../models/Workplace';
import { FeatureFlag } from '../models/FeatureFlag';
import PostLaunchMonitoringService from '../services/PostLaunchMonitoringService';
import PatientEngagementRolloutService from '../services/PatientEngagementRolloutService';
import { generateTestToken } from '../utils/testHelpers';

describe('Post-Launch Monitoring System', () => {
  let mongoServer: MongoMemoryServer;
  let testUser: any;
  let testWorkplace: any;
  let authToken: string;

  beforeAll(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Create test workplace
    testWorkplace = await Workplace.create({
      name: 'Test Pharmacy',
      address: '123 Test St',
      phone: '+1234567890',
      email: 'test@pharmacy.com',
      licenseNumber: 'TEST123',
      subscriptionTier: 'professional',
      subscriptionStatus: 'active'
    });

    // Create test user
    testUser = await User.create({
      firstName: 'Test',
      lastName: 'Manager',
      email: 'manager@test.com',
      password: 'password123',
      role: 'pharmacy_manager',
      workplaceId: testWorkplace._id,
      status: 'active',
      permissions: ['view_analytics', 'view_system_health', 'manage_rollout']
    });

    // Generate auth token
    authToken = generateTestToken(testUser);

    // Create test feature flags
    await FeatureFlag.create({
      name: 'PATIENT_ENGAGEMENT_ENABLED',
      key: 'patient_engagement_module',
      enabled: true,
      targetingRules: {
        percentage: 75,
        conditions: {}
      },
      createdBy: testUser._id
    });
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear any test data between tests
    jest.clearAllMocks();
  });

  describe('System Health Monitoring', () => {
    describe('GET /api/monitoring/system-health', () => {
      it('should return comprehensive system health metrics', async () => {
        const response = await request(app)
          .get('/api/monitoring/system-health')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('timestamp');
        expect(response.body.data).toHaveProperty('overallHealth');
        expect(response.body.data).toHaveProperty('healthScore');
        expect(response.body.data).toHaveProperty('performance');
        expect(response.body.data).toHaveProperty('adoption');
        expect(response.body.data).toHaveProperty('quality');
        expect(response.body.data).toHaveProperty('stability');

        // Validate performance metrics
        expect(response.body.data.performance).toHaveProperty('apiResponseTime');
        expect(response.body.data.performance).toHaveProperty('databaseResponseTime');
        expect(response.body.data.performance).toHaveProperty('memoryUsage');
        expect(response.body.data.performance).toHaveProperty('errorRate');

        // Validate adoption metrics
        expect(response.body.data.adoption).toHaveProperty('totalActiveWorkspaces');
        expect(response.body.data.adoption).toHaveProperty('dailyActiveUsers');
        expect(response.body.data.adoption).toHaveProperty('appointmentsCreatedToday');

        // Validate quality metrics
        expect(response.body.data.quality).toHaveProperty('appointmentCompletionRate');
        expect(response.body.data.quality).toHaveProperty('userSatisfactionScore');
      });

      it('should require authentication', async () => {
        await request(app)
          .get('/api/monitoring/system-health')
          .expect(401);
      });

      it('should return detailed health check with proper permissions', async () => {
        const response = await request(app)
          .get('/api/monitoring/system-health/detailed')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('healthScore');
        expect(response.body).toHaveProperty('overallHealth');
        expect(response.body).toHaveProperty('alerts');
        expect(response.body).toHaveProperty('performance');
      });
    });

    describe('GET /api/monitoring/success-metrics', () => {
      it('should return success metrics and KPIs', async () => {
        const response = await request(app)
          .get('/api/monitoring/success-metrics')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('patientEngagementIncrease');
        expect(response.body.data).toHaveProperty('appointmentSchedulingAdoption');
        expect(response.body.data).toHaveProperty('followUpCompletionImprovement');
        expect(response.body.data).toHaveProperty('medicationAdherenceImprovement');
        expect(response.body.data).toHaveProperty('pharmacistEfficiencyGain');
        expect(response.body.data).toHaveProperty('systemReliability');
        expect(response.body.data).toHaveProperty('timesSaved');
        expect(response.body.data).toHaveProperty('revenueIncrease');

        // Validate metric ranges
        expect(response.body.data.patientEngagementIncrease).toBeGreaterThanOrEqual(0);
        expect(response.body.data.systemReliability).toBeGreaterThanOrEqual(0);
        expect(response.body.data.systemReliability).toBeLessThanOrEqual(100);
      });
    });

    describe('GET /api/monitoring/alerts', () => {
      it('should return system alerts', async () => {
        const response = await request(app)
          .get('/api/monitoring/alerts')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('hasAlerts');
        expect(response.body.data).toHaveProperty('alerts');
        expect(Array.isArray(response.body.data.alerts)).toBe(true);

        // If alerts exist, validate structure
        if (response.body.data.alerts.length > 0) {
          const alert = response.body.data.alerts[0];
          expect(alert).toHaveProperty('severity');
          expect(alert).toHaveProperty('title');
          expect(alert).toHaveProperty('message');
          expect(alert).toHaveProperty('timestamp');
          expect(['info', 'warning', 'error', 'critical']).toContain(alert.severity);
        }
      });
    });
  });

  describe('User Feedback System', () => {
    describe('POST /api/monitoring/feedback', () => {
      it('should submit user feedback successfully', async () => {
        const feedbackData = {
          category: 'bug_report',
          severity: 'medium',
          title: 'Calendar view is slow on mobile',
          description: 'The appointment calendar takes too long to load on mobile devices, especially with many appointments.',
          featureArea: 'appointments',
          browserInfo: 'Chrome 118.0.0.0 on Android 13',
          deviceInfo: 'Samsung Galaxy S21',
          steps: [
            'Open appointment calendar on mobile',
            'Wait for calendar to load',
            'Notice slow loading time'
          ],
          expectedBehavior: 'Calendar should load within 2 seconds',
          actualBehavior: 'Calendar takes 8-10 seconds to load',
          satisfactionRating: 3,
          usabilityRating: 2,
          performanceRating: 2
        };

        const response = await request(app)
          .post('/api/monitoring/feedback')
          .set('Authorization', `Bearer ${authToken}`)
          .send(feedbackData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Feedback submitted successfully');
        expect(response.body.data).toHaveProperty('workspaceId');
        expect(response.body.data).toHaveProperty('userId');
        expect(response.body.data).toHaveProperty('category');
        expect(response.body.data.category).toBe('bug_report');
        expect(response.body.data.status).toBe('new');
      });

      it('should validate required fields', async () => {
        const invalidFeedback = {
          category: 'bug_report',
          // Missing required fields
        };

        const response = await request(app)
          .post('/api/monitoring/feedback')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidFeedback)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Validation failed');
        expect(response.body.errors).toBeDefined();
      });

      it('should validate field values', async () => {
        const invalidFeedback = {
          category: 'invalid_category',
          severity: 'invalid_severity',
          title: 'Test',
          description: 'Test description',
          featureArea: 'invalid_area'
        };

        const response = await request(app)
          .post('/api/monitoring/feedback')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidFeedback)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.errors).toBeDefined();
      });
    });

    describe('GET /api/monitoring/feedback/summary', () => {
      it('should return feedback summary with proper permissions', async () => {
        const response = await request(app)
          .get('/api/monitoring/feedback/summary')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('total');
        expect(response.body.data).toHaveProperty('byCategory');
        expect(response.body.data).toHaveProperty('bySeverity');
        expect(response.body.data).toHaveProperty('byStatus');
        expect(response.body.data).toHaveProperty('byFeatureArea');
        expect(response.body.data).toHaveProperty('averageRatings');
        expect(response.body.data).toHaveProperty('trends');

        // Validate structure
        expect(typeof response.body.data.total).toBe('number');
        expect(typeof response.body.data.byCategory).toBe('object');
        expect(typeof response.body.data.averageRatings).toBe('object');
      });

      it('should support date filtering', async () => {
        const startDate = '2025-10-01';
        const endDate = '2025-10-31';

        const response = await request(app)
          .get('/api/monitoring/feedback/summary')
          .query({ startDate, endDate })
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      it('should support category filtering', async () => {
        const response = await request(app)
          .get('/api/monitoring/feedback/summary')
          .query({ category: 'bug_report' })
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('Comprehensive Reporting', () => {
    describe('GET /api/monitoring/report', () => {
      it('should generate comprehensive monitoring report', async () => {
        const response = await request(app)
          .get('/api/monitoring/report')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('summary');
        expect(response.body.data).toHaveProperty('metrics');
        expect(response.body.data).toHaveProperty('success');
        expect(response.body.data).toHaveProperty('feedback');
        expect(response.body.data).toHaveProperty('rollout');

        // Validate summary structure
        expect(response.body.data.summary).toHaveProperty('reportDate');
        expect(response.body.data.summary).toHaveProperty('overallStatus');
        expect(response.body.data.summary).toHaveProperty('keyHighlights');
        expect(response.body.data.summary).toHaveProperty('criticalIssues');
        expect(response.body.data.summary).toHaveProperty('recommendations');

        // Validate arrays
        expect(Array.isArray(response.body.data.summary.keyHighlights)).toBe(true);
        expect(Array.isArray(response.body.data.summary.criticalIssues)).toBe(true);
        expect(Array.isArray(response.body.data.summary.recommendations)).toBe(true);
      });
    });

    describe('GET /api/monitoring/phase2-plan', () => {
      it('should return Phase 2 enhancement plan', async () => {
        const response = await request(app)
          .get('/api/monitoring/phase2-plan')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('prioritizedFeatures');
        expect(response.body.data).toHaveProperty('performanceImprovements');
        expect(response.body.data).toHaveProperty('userExperienceEnhancements');
        expect(response.body.data).toHaveProperty('integrationOpportunities');

        // Validate prioritized features structure
        expect(Array.isArray(response.body.data.prioritizedFeatures)).toBe(true);
        if (response.body.data.prioritizedFeatures.length > 0) {
          const feature = response.body.data.prioritizedFeatures[0];
          expect(feature).toHaveProperty('feature');
          expect(feature).toHaveProperty('priority');
          expect(feature).toHaveProperty('effort');
          expect(feature).toHaveProperty('impact');
          expect(feature).toHaveProperty('description');
          expect(feature).toHaveProperty('userRequests');
          expect(feature).toHaveProperty('businessValue');
        }
      });
    });
  });

  describe('Rollout Integration', () => {
    describe('GET /api/monitoring/rollout/status', () => {
      it('should return rollout status with proper permissions', async () => {
        const response = await request(app)
          .get('/api/monitoring/rollout/status')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('currentPercentage');
        expect(response.body.data).toHaveProperty('targetPercentage');
        expect(response.body.data).toHaveProperty('phase');
        expect(response.body.data).toHaveProperty('metrics');
        expect(response.body.data).toHaveProperty('issues');

        // Validate metrics structure
        expect(response.body.data.metrics).toHaveProperty('totalEligibleWorkspaces');
        expect(response.body.data.metrics).toHaveProperty('enabledWorkspaces');
        expect(response.body.data.metrics).toHaveProperty('adoptionRate');
        expect(response.body.data.metrics).toHaveProperty('errorRate');
      });
    });
  });

  describe('Health Check Endpoints', () => {
    describe('GET /api/monitoring/health', () => {
      it('should return basic health status without authentication', async () => {
        const response = await request(app)
          .get('/api/monitoring/health')
          .expect(200);

        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body).toHaveProperty('service');
        expect(response.body).toHaveProperty('version');
        expect(response.body.status).toBe('healthy');
        expect(response.body.service).toBe('patient-engagement-monitoring');
      });
    });
  });

  describe('Service Layer Tests', () => {
    describe('PostLaunchMonitoringService', () => {
      it('should calculate system health metrics', async () => {
        const metrics = await PostLaunchMonitoringService.getSystemHealthMetrics();

        expect(metrics).toHaveProperty('timestamp');
        expect(metrics).toHaveProperty('overallHealth');
        expect(metrics).toHaveProperty('healthScore');
        expect(metrics.healthScore).toBeGreaterThanOrEqual(0);
        expect(metrics.healthScore).toBeLessThanOrEqual(100);
        expect(['healthy', 'warning', 'critical', 'emergency']).toContain(metrics.overallHealth);
      });

      it('should get success metrics', async () => {
        const metrics = await PostLaunchMonitoringService.getSuccessMetrics();

        expect(metrics).toHaveProperty('patientEngagementIncrease');
        expect(metrics).toHaveProperty('appointmentSchedulingAdoption');
        expect(metrics).toHaveProperty('pharmacistEfficiencyGain');
        expect(metrics).toHaveProperty('systemReliability');
        expect(metrics).toHaveProperty('timesSaved');
        expect(metrics).toHaveProperty('revenueIncrease');

        // Validate reasonable ranges
        expect(metrics.patientEngagementIncrease).toBeGreaterThanOrEqual(0);
        expect(metrics.systemReliability).toBeGreaterThanOrEqual(0);
        expect(metrics.systemReliability).toBeLessThanOrEqual(100);
      });

      it('should submit user feedback', async () => {
        const feedbackData = {
          workspaceId: testWorkplace._id,
          userId: testUser._id,
          userRole: 'pharmacy_manager',
          category: 'feature_request' as const,
          severity: 'low' as const,
          title: 'Add bulk appointment operations',
          description: 'Would like to reschedule multiple appointments at once',
          featureArea: 'appointments' as const,
          satisfactionRating: 4
        };

        const feedback = await PostLaunchMonitoringService.submitUserFeedback(feedbackData);

        expect(feedback).toHaveProperty('workspaceId');
        expect(feedback).toHaveProperty('userId');
        expect(feedback).toHaveProperty('category');
        expect(feedback).toHaveProperty('status');
        expect(feedback.status).toBe('new');
        expect(feedback.category).toBe('feature_request');
      });

      it('should get user feedback summary', async () => {
        const summary = await PostLaunchMonitoringService.getUserFeedbackSummary();

        expect(summary).toHaveProperty('total');
        expect(summary).toHaveProperty('byCategory');
        expect(summary).toHaveProperty('bySeverity');
        expect(summary).toHaveProperty('byStatus');
        expect(summary).toHaveProperty('averageRatings');
        expect(summary).toHaveProperty('trends');

        expect(typeof summary.total).toBe('number');
        expect(typeof summary.byCategory).toBe('object');
        expect(typeof summary.averageRatings).toBe('object');
      });

      it('should check system alerts', async () => {
        const alertsResult = await PostLaunchMonitoringService.checkSystemAlerts();

        expect(alertsResult).toHaveProperty('hasAlerts');
        expect(alertsResult).toHaveProperty('alerts');
        expect(typeof alertsResult.hasAlerts).toBe('boolean');
        expect(Array.isArray(alertsResult.alerts)).toBe(true);

        // If alerts exist, validate structure
        if (alertsResult.alerts.length > 0) {
          const alert = alertsResult.alerts[0];
          expect(alert).toHaveProperty('severity');
          expect(alert).toHaveProperty('title');
          expect(alert).toHaveProperty('message');
          expect(alert).toHaveProperty('timestamp');
        }
      });

      it('should generate monitoring report', async () => {
        const report = await PostLaunchMonitoringService.generateMonitoringReport();

        expect(report).toHaveProperty('summary');
        expect(report).toHaveProperty('metrics');
        expect(report).toHaveProperty('success');
        expect(report).toHaveProperty('feedback');
        expect(report).toHaveProperty('rollout');

        expect(report.summary).toHaveProperty('reportDate');
        expect(report.summary).toHaveProperty('overallStatus');
        expect(report.summary).toHaveProperty('keyHighlights');
        expect(report.summary).toHaveProperty('criticalIssues');
        expect(report.summary).toHaveProperty('recommendations');
      });

      it('should plan Phase 2 enhancements', async () => {
        const plan = await PostLaunchMonitoringService.planPhase2Enhancements();

        expect(plan).toHaveProperty('prioritizedFeatures');
        expect(plan).toHaveProperty('performanceImprovements');
        expect(plan).toHaveProperty('userExperienceEnhancements');
        expect(plan).toHaveProperty('integrationOpportunities');

        expect(Array.isArray(plan.prioritizedFeatures)).toBe(true);
        expect(Array.isArray(plan.performanceImprovements)).toBe(true);
        expect(Array.isArray(plan.userExperienceEnhancements)).toBe(true);
        expect(Array.isArray(plan.integrationOpportunities)).toBe(true);

        // Validate feature structure
        if (plan.prioritizedFeatures.length > 0) {
          const feature = plan.prioritizedFeatures[0];
          expect(feature).toHaveProperty('feature');
          expect(feature).toHaveProperty('priority');
          expect(feature).toHaveProperty('effort');
          expect(feature).toHaveProperty('impact');
          expect(['high', 'medium', 'low']).toContain(feature.priority);
          expect(['small', 'medium', 'large']).toContain(feature.effort);
          expect(['high', 'medium', 'low']).toContain(feature.impact);
        }
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid feedback data gracefully', async () => {
      const invalidData = {
        category: 'invalid',
        severity: 'invalid',
        title: '',
        description: ''
      };

      const response = await request(app)
        .post('/api/monitoring/feedback')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should handle missing authentication', async () => {
      await request(app)
        .get('/api/monitoring/system-health')
        .expect(401);

      await request(app)
        .post('/api/monitoring/feedback')
        .send({ category: 'bug_report' })
        .expect(401);
    });

    it('should handle insufficient permissions', async () => {
      // Create user without required permissions
      const limitedUser = await User.create({
        firstName: 'Limited',
        lastName: 'User',
        email: 'limited@test.com',
        password: 'password123',
        role: 'pharmacist',
        workplaceId: testWorkplace._id,
        status: 'active',
        permissions: [] // No permissions
      });

      const limitedToken = generateTestToken(limitedUser);

      await request(app)
        .get('/api/monitoring/feedback/summary')
        .set('Authorization', `Bearer ${limitedToken}`)
        .expect(403);

      await request(app)
        .get('/api/monitoring/rollout/status')
        .set('Authorization', `Bearer ${limitedToken}`)
        .expect(403);
    });
  });

  describe('Performance and Load', () => {
    it('should handle multiple concurrent requests', async () => {
      const requests = Array(10).fill(null).map(() =>
        request(app)
          .get('/api/monitoring/system-health')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    it('should respond within reasonable time limits', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/monitoring/report')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      // Should respond within 5 seconds
      expect(responseTime).toBeLessThan(5000);
    });
  });
});