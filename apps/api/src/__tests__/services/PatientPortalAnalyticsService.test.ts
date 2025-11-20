import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import PatientUser from '../../models/PatientUser';
import FollowUpTask from '../../models/FollowUpTask';
import Conversation from '../../models/Conversation';
import Message from '../../models/Message';
import { PatientPortalAnalyticsService } from '../../services/PatientPortalAnalyticsService';

describe('PatientPortalAnalyticsService', () => {
  let mongoServer: MongoMemoryServer;
  let analyticsService: PatientPortalAnalyticsService;
  let workplaceId: mongoose.Types.ObjectId;
  let adminUserId: mongoose.Types.ObjectId;
  let pharmacistId: mongoose.Types.ObjectId;
  let patientUserId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear all collections
    await PatientUser.deleteMany({});
    await FollowUpTask.deleteMany({});
    await Conversation.deleteMany({});
    await Message.deleteMany({});

    // Initialize service
    analyticsService = new PatientPortalAnalyticsService();

    // Create test IDs
    workplaceId = new mongoose.Types.ObjectId();
    adminUserId = new mongoose.Types.ObjectId();
    pharmacistId = new mongoose.Types.ObjectId();
    patientUserId = new mongoose.Types.ObjectId();
  });

  describe('getUserEngagementMetrics', () => {
    beforeEach(async () => {
      // Create test patient users with different statuses and dates
      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);

      await PatientUser.create([
        {
          workplaceId,
          email: 'active1@test.com',
          firstName: 'Active1',
          lastName: 'Patient',
          passwordHash: 'hashedpassword',
          status: 'active',
          createdAt: thisMonth,
          createdBy: adminUserId,
        },
        {
          workplaceId,
          email: 'active2@test.com',
          firstName: 'Active2',
          lastName: 'Patient',
          passwordHash: 'hashedpassword',
          status: 'active',
          createdAt: thisMonth,
          createdBy: adminUserId,
        },
        {
          workplaceId,
          email: 'pending@test.com',
          firstName: 'Pending',
          lastName: 'Patient',
          passwordHash: 'hashedpassword',
          status: 'pending',
          createdAt: thisMonth,
          createdBy: adminUserId,
        },
        {
          workplaceId,
          email: 'suspended@test.com',
          firstName: 'Suspended',
          lastName: 'Patient',
          passwordHash: 'hashedpassword',
          status: 'suspended',
          createdAt: lastMonth,
          createdBy: adminUserId,
        },
        {
          workplaceId,
          email: 'inactive@test.com',
          firstName: 'Inactive',
          lastName: 'Patient',
          passwordHash: 'hashedpassword',
          status: 'inactive',
          createdAt: lastMonth,
          createdBy: adminUserId,
        },
      ]);
    });

    it('should get user engagement metrics with default date range', async () => {
      const result = await analyticsService.getUserEngagementMetrics(workplaceId);

      expect(result.totalUsers).toBe(5);
      expect(result.activeUsers).toBe(2);
      expect(result.usersByStatus.active).toBe(2);
      expect(result.usersByStatus.pending).toBe(1);
      expect(result.usersByStatus.suspended).toBe(1);
      expect(result.usersByStatus.inactive).toBe(1);
      expect(result.newUsers).toBeGreaterThanOrEqual(0);
      expect(result.userGrowthRate).toBeDefined();
      expect(result.userRetentionRate).toBeDefined();
      expect(result.userRegistrationTrend).toBeInstanceOf(Array);
    });

    it('should calculate user growth rate correctly', async () => {
      const result = await analyticsService.getUserEngagementMetrics(workplaceId);

      expect(typeof result.userGrowthRate).toBe('number');
      expect(result.userRetentionRate).toBe(40); // 2 active out of 5 total = 40%
    });

    it('should include user registration trend', async () => {
      const result = await analyticsService.getUserEngagementMetrics(workplaceId);

      expect(result.userRegistrationTrend).toBeInstanceOf(Array);
      result.userRegistrationTrend.forEach(trend => {
        expect(trend).toHaveProperty('date');
        expect(trend).toHaveProperty('count');
        expect(typeof trend.date).toBe('string');
        expect(typeof trend.count).toBe('number');
      });
    });

    it('should filter by date range when provided', async () => {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = now;

      const result = await analyticsService.getUserEngagementMetrics(
        workplaceId,
        { startDate, endDate }
      );

      expect(result.newUsers).toBe(3); // Only users created this month
    });
  });

  describe('getFeatureUsageStats', () => {
    it('should get feature usage statistics', async () => {
      // Create some active users
      await PatientUser.create([
        {
          workplaceId,
          email: 'user1@test.com',
          firstName: 'User1',
          lastName: 'Patient',
          passwordHash: 'hashedpassword',
          status: 'active',
          createdBy: adminUserId,
        },
        {
          workplaceId,
          email: 'user2@test.com',
          firstName: 'User2',
          lastName: 'Patient',
          passwordHash: 'hashedpassword',
          status: 'active',
          createdBy: adminUserId,
        },
      ]);

      const result = await analyticsService.getFeatureUsageStats(workplaceId);

      expect(result.totalFeatureUsage).toBeGreaterThan(0);
      expect(result.featureUsageBreakdown).toBeInstanceOf(Array);
      expect(result.featureUsageBreakdown.length).toBeGreaterThan(0);

      // Check feature breakdown structure
      result.featureUsageBreakdown.forEach(feature => {
        expect(feature).toHaveProperty('feature');
        expect(feature).toHaveProperty('usageCount');
        expect(feature).toHaveProperty('uniqueUsers');
        expect(feature).toHaveProperty('averageUsagePerUser');
        expect(feature).toHaveProperty('popularityPercentage');
        expect(typeof feature.feature).toBe('string');
        expect(typeof feature.usageCount).toBe('number');
        expect(typeof feature.uniqueUsers).toBe('number');
        expect(typeof feature.averageUsagePerUser).toBe('number');
        expect(typeof feature.popularityPercentage).toBe('number');
      });

      expect(result.mostPopularFeatures).toBeInstanceOf(Array);
      expect(result.mostPopularFeatures.length).toBeLessThanOrEqual(3);

      expect(result.leastUsedFeatures).toBeInstanceOf(Array);
      expect(result.leastUsedFeatures.length).toBeLessThanOrEqual(3);

      expect(result.featureAdoptionRate).toBeInstanceOf(Array);
    });

    it('should handle zero active users', async () => {
      const result = await analyticsService.getFeatureUsageStats(workplaceId);

      expect(result.totalFeatureUsage).toBe(0);
      expect(result.featureUsageBreakdown).toBeInstanceOf(Array);
      expect(result.mostPopularFeatures).toBeInstanceOf(Array);
      expect(result.leastUsedFeatures).toBeInstanceOf(Array);
    });
  });

  describe('getOperationalMetrics', () => {
    beforeEach(async () => {
      const medicationId = new mongoose.Types.ObjectId();
      const patientId = new mongoose.Types.ObjectId();

      // Create refill requests
      await FollowUpTask.create([
        {
          workplaceId,
          patientId,
          assignedTo: pharmacistId,
          type: 'medication_refill_request',
          title: 'Refill Request 1',
          description: 'Test refill',
          objectives: ['Process refill'],
          priority: 'medium',
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          status: 'pending',
          trigger: {
            type: 'manual',
            sourceId: medicationId,
            sourceType: 'Medication',
            triggerDate: new Date(),
          },
          metadata: {
            refillRequest: {
              medicationId,
              medicationName: 'Test Med',
              currentRefillsRemaining: 3,
              requestedQuantity: 30,
              urgency: 'routine',
              requestedBy: patientUserId,
              requestedAt: new Date(),
            },
          },
          createdBy: patientUserId,
        },
        {
          workplaceId,
          patientId,
          assignedTo: pharmacistId,
          type: 'medication_refill_request',
          title: 'Refill Request 2',
          description: 'Urgent refill',
          objectives: ['Process urgent refill'],
          priority: 'high',
          dueDate: new Date(Date.now() + 12 * 60 * 60 * 1000),
          status: 'completed',
          completedAt: new Date(),
          outcome: {
            status: 'successful',
            notes: 'Approved',
            nextActions: [],
            appointmentCreated: false,
          },
          trigger: {
            type: 'manual',
            sourceId: medicationId,
            sourceType: 'Medication',
            triggerDate: new Date(),
          },
          metadata: {
            refillRequest: {
              medicationId,
              medicationName: 'Test Med 2',
              currentRefillsRemaining: 1,
              requestedQuantity: 30,
              urgency: 'urgent',
              requestedBy: patientUserId,
              requestedAt: new Date(),
            },
          },
          createdBy: patientUserId,
        },
        {
          workplaceId,
          patientId,
          assignedTo: pharmacistId,
          type: 'medication_refill_request',
          title: 'Refill Request 3',
          description: 'Denied refill',
          objectives: ['Process refill'],
          priority: 'medium',
          dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
          status: 'completed',
          completedAt: new Date(),
          outcome: {
            status: 'unsuccessful',
            notes: 'Denied - no refills remaining',
            nextActions: [],
            appointmentCreated: false,
          },
          trigger: {
            type: 'manual',
            sourceId: medicationId,
            sourceType: 'Medication',
            triggerDate: new Date(),
          },
          metadata: {
            refillRequest: {
              medicationId,
              medicationName: 'Test Med 3',
              currentRefillsRemaining: 0,
              requestedQuantity: 30,
              urgency: 'routine',
              requestedBy: patientUserId,
              requestedAt: new Date(),
            },
          },
          createdBy: patientUserId,
        },
      ]);

      // Create conversations and messages
      const conversationId = new mongoose.Types.ObjectId();
      await Conversation.create({
        _id: conversationId,
        workplaceId,
        title: 'Patient Query',
        type: 'patient_query',
        participants: [
          {
            userId: patientUserId,
            role: 'patient',
            joinedAt: new Date(),
            permissions: ['read_messages', 'send_messages'],
          },
          {
            userId: pharmacistId,
            role: 'pharmacist',
            joinedAt: new Date(),
            permissions: ['read_messages', 'send_messages'],
          },
        ],
        status: 'active',
        priority: 'normal',
        metadata: {
          isEncrypted: true,
          priority: 'normal',
          tags: ['patient_portal'],
        },
        createdBy: patientUserId,
      });

      await Message.create([
        {
          conversationId,
          senderId: patientUserId,
          content: {
            text: 'Hello, I need help with my medication',
            type: 'text',
          },
          workplaceId,
        },
        {
          conversationId,
          senderId: pharmacistId,
          content: {
            text: 'Sure, I can help you with that',
            type: 'text',
          },
          workplaceId,
        },
      ]);
    });

    it('should get operational metrics', async () => {
      const result = await analyticsService.getOperationalMetrics(workplaceId);

      // Refill request metrics
      expect(result.refillRequests.total).toBe(3);
      expect(result.refillRequests.pending).toBe(1);
      expect(result.refillRequests.approved).toBe(1);
      expect(result.refillRequests.denied).toBe(1);
      expect(result.refillRequests.urgentRequests).toBe(1);
      expect(result.refillRequests.routineRequests).toBe(2);
      expect(result.refillRequests.approvalRate).toBe(50); // 1 approved out of 2 completed
      expect(typeof result.refillRequests.averageResponseTime).toBe('number');

      // Appointment metrics (mocked)
      expect(result.appointments).toHaveProperty('total');
      expect(result.appointments).toHaveProperty('scheduled');
      expect(result.appointments).toHaveProperty('completed');
      expect(result.appointments).toHaveProperty('cancelled');
      expect(result.appointments).toHaveProperty('noShows');
      expect(result.appointments).toHaveProperty('averageBookingLeadTime');
      expect(result.appointments).toHaveProperty('completionRate');

      // Communication metrics
      expect(result.communications.totalConversations).toBe(1);
      expect(result.communications.totalMessages).toBe(2);
      expect(result.communications.averageMessagesPerConversation).toBe(2);
      expect(typeof result.communications.averageResponseTime).toBe('number');
    });

    it('should handle empty data gracefully', async () => {
      // Clear all data
      await FollowUpTask.deleteMany({});
      await Conversation.deleteMany({});
      await Message.deleteMany({});

      const result = await analyticsService.getOperationalMetrics(workplaceId);

      expect(result.refillRequests.total).toBe(0);
      expect(result.refillRequests.approvalRate).toBe(0);
      expect(result.communications.totalConversations).toBe(0);
      expect(result.communications.totalMessages).toBe(0);
    });
  });

  describe('getCommunicationMetrics', () => {
    beforeEach(async () => {
      // Create conversations and messages
      const conversationId1 = new mongoose.Types.ObjectId();
      const conversationId2 = new mongoose.Types.ObjectId();

      await Conversation.create([
        {
          _id: conversationId1,
          workplaceId,
          title: 'Patient Query 1',
          type: 'patient_query',
          participants: [
            {
              userId: patientUserId,
              role: 'patient',
              joinedAt: new Date(),
              permissions: ['read_messages', 'send_messages'],
            },
            {
              userId: pharmacistId,
              role: 'pharmacist',
              joinedAt: new Date(),
              permissions: ['read_messages', 'send_messages'],
            },
          ],
          status: 'active',
          priority: 'normal',
          metadata: {
            isEncrypted: true,
            priority: 'normal',
            tags: ['patient_portal'],
          },
          createdBy: patientUserId,
        },
        {
          _id: conversationId2,
          workplaceId,
          title: 'Patient Query 2',
          type: 'patient_query',
          participants: [
            {
              userId: patientUserId,
              role: 'patient',
              joinedAt: new Date(),
              permissions: ['read_messages', 'send_messages'],
            },
            {
              userId: pharmacistId,
              role: 'pharmacist',
              joinedAt: new Date(),
              permissions: ['read_messages', 'send_messages'],
            },
          ],
          status: 'resolved',
          priority: 'normal',
          metadata: {
            isEncrypted: true,
            priority: 'normal',
            tags: ['patient_portal'],
          },
          createdBy: patientUserId,
        },
      ]);

      await Message.create([
        {
          conversationId: conversationId1,
          senderId: patientUserId,
          content: {
            text: 'Hello, I need help',
            type: 'text',
          },
          workplaceId,
          createdAt: new Date(2024, 0, 15, 10, 0), // 10 AM
        },
        {
          conversationId: conversationId1,
          senderId: pharmacistId,
          content: {
            text: 'Sure, I can help',
            type: 'text',
          },
          workplaceId,
          createdAt: new Date(2024, 0, 15, 14, 0), // 2 PM
        },
        {
          conversationId: conversationId2,
          senderId: patientUserId,
          content: {
            text: 'Question about medication',
            type: 'text',
            attachments: [
              {
                fileName: 'prescription.pdf',
                originalName: 'prescription.pdf',
                mimeType: 'application/pdf',
                size: 1024,
                url: 'https://example.com/prescription.pdf',
                uploadedAt: new Date(),
              },
            ],
          },
          workplaceId,
          createdAt: new Date(2024, 0, 15, 16, 0), // 4 PM
        },
      ]);
    });

    it('should get communication metrics', async () => {
      const result = await analyticsService.getCommunicationMetrics(workplaceId);

      expect(result.totalConversations).toBe(2);
      expect(result.activeConversations).toBe(1);
      expect(result.resolvedConversations).toBe(1);
      expect(result.totalMessages).toBe(3);
      expect(result.messagesByType.text).toBe(2);
      expect(result.messagesByType.withAttachments).toBe(1);
      expect(result.averageMessagesPerConversation).toBe(1.5);
      expect(typeof result.averageResponseTime).toBe('number');

      expect(result.peakCommunicationHours).toBeInstanceOf(Array);
      result.peakCommunicationHours.forEach(peak => {
        expect(peak).toHaveProperty('hour');
        expect(peak).toHaveProperty('messageCount');
        expect(typeof peak.hour).toBe('number');
        expect(typeof peak.messageCount).toBe('number');
      });

      expect(result.communicationTrend).toBeInstanceOf(Array);
      result.communicationTrend.forEach(trend => {
        expect(trend).toHaveProperty('date');
        expect(trend).toHaveProperty('conversationCount');
        expect(trend).toHaveProperty('messageCount');
      });

      expect(result.patientSatisfactionIndicators).toHaveProperty('conversationsWithPositiveFeedback');
      expect(result.patientSatisfactionIndicators).toHaveProperty('conversationsWithNegativeFeedback');
      expect(result.patientSatisfactionIndicators).toHaveProperty('averageConversationDuration');
    });
  });

  describe('getAdvancedAnalytics', () => {
    beforeEach(async () => {
      // Create some active users
      await PatientUser.create([
        {
          workplaceId,
          email: 'active1@test.com',
          firstName: 'Active1',
          lastName: 'Patient',
          passwordHash: 'hashedpassword',
          status: 'active',
          lastLoginAt: new Date(),
          createdBy: adminUserId,
        },
        {
          workplaceId,
          email: 'inactive@test.com',
          firstName: 'Inactive',
          lastName: 'Patient',
          passwordHash: 'hashedpassword',
          status: 'active',
          lastLoginAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
          createdBy: adminUserId,
        },
      ]);
    });

    it('should get advanced analytics', async () => {
      const result = await analyticsService.getAdvancedAnalytics(workplaceId);

      // User behavior patterns
      expect(result.userBehaviorPatterns).toHaveProperty('mostActiveTimeOfDay');
      expect(result.userBehaviorPatterns).toHaveProperty('mostActiveDayOfWeek');
      expect(result.userBehaviorPatterns).toHaveProperty('averageSessionDuration');
      expect(result.userBehaviorPatterns).toHaveProperty('bounceRate');

      // Health outcomes
      expect(result.healthOutcomes).toHaveProperty('medicationAdherenceImprovement');
      expect(result.healthOutcomes).toHaveProperty('appointmentAttendanceRate');
      expect(result.healthOutcomes).toHaveProperty('patientEngagementScore');

      // System performance
      expect(result.systemPerformance).toHaveProperty('averagePageLoadTime');
      expect(result.systemPerformance).toHaveProperty('systemUptime');
      expect(result.systemPerformance).toHaveProperty('errorRate');

      // Predictive insights
      expect(result.predictiveInsights).toHaveProperty('churnRisk');
      expect(result.predictiveInsights).toHaveProperty('expectedGrowth');
      expect(result.predictiveInsights.churnRisk).toBeInstanceOf(Array);
      expect(result.predictiveInsights.expectedGrowth).toHaveProperty('nextMonth');
      expect(result.predictiveInsights.expectedGrowth).toHaveProperty('nextQuarter');

      // Check churn risk structure
      result.predictiveInsights.churnRisk.forEach(risk => {
        expect(risk).toHaveProperty('patientUserId');
        expect(risk).toHaveProperty('riskScore');
        expect(risk).toHaveProperty('factors');
        expect(risk.factors).toBeInstanceOf(Array);
      });
    });
  });

  describe('generateAnalyticsReport', () => {
    beforeEach(async () => {
      // Create comprehensive test data
      await PatientUser.create([
        {
          workplaceId,
          email: 'active1@test.com',
          firstName: 'Active1',
          lastName: 'Patient',
          passwordHash: 'hashedpassword',
          status: 'active',
          createdBy: adminUserId,
        },
        {
          workplaceId,
          email: 'active2@test.com',
          firstName: 'Active2',
          lastName: 'Patient',
          passwordHash: 'hashedpassword',
          status: 'active',
          createdBy: adminUserId,
        },
      ]);

      // Create refill request
      const medicationId = new mongoose.Types.ObjectId();
      const patientId = new mongoose.Types.ObjectId();

      await FollowUpTask.create({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'medication_refill_request',
        title: 'Refill Request',
        description: 'Test refill',
        objectives: ['Process refill'],
        priority: 'medium',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'completed',
        completedAt: new Date(),
        outcome: {
          status: 'successful',
          notes: 'Approved',
          nextActions: [],
          appointmentCreated: false,
        },
        trigger: {
          type: 'manual',
          sourceId: medicationId,
          sourceType: 'Medication',
          triggerDate: new Date(),
        },
        metadata: {
          refillRequest: {
            medicationId,
            medicationName: 'Test Med',
            currentRefillsRemaining: 3,
            requestedQuantity: 30,
            urgency: 'routine',
            requestedBy: patientUserId,
            requestedAt: new Date(),
          },
        },
        createdBy: patientUserId,
      });
    });

    it('should generate comprehensive analytics report', async () => {
      const result = await analyticsService.generateAnalyticsReport(workplaceId);

      // Summary
      expect(result.summary).toHaveProperty('reportPeriod');
      expect(result.summary).toHaveProperty('totalUsers');
      expect(result.summary).toHaveProperty('activeUsers');
      expect(result.summary).toHaveProperty('keyMetrics');
      expect(result.summary.totalUsers).toBe(2);
      expect(result.summary.activeUsers).toBe(2);
      expect(result.summary.keyMetrics).toBeInstanceOf(Array);

      // Key metrics structure
      result.summary.keyMetrics.forEach(metric => {
        expect(metric).toHaveProperty('metric');
        expect(metric).toHaveProperty('value');
        expect(metric).toHaveProperty('change');
        expect(typeof metric.metric).toBe('string');
        expect(typeof metric.change).toBe('number');
      });

      // Analytics sections
      expect(result).toHaveProperty('userEngagement');
      expect(result).toHaveProperty('featureUsage');
      expect(result).toHaveProperty('operational');
      expect(result).toHaveProperty('communication');

      // Recommendations
      expect(result.recommendations).toBeInstanceOf(Array);
      result.recommendations.forEach(recommendation => {
        expect(typeof recommendation).toBe('string');
      });

      // Generated timestamp
      expect(result.generatedAt).toBeInstanceOf(Date);
    });

    it('should include relevant recommendations based on data', async () => {
      const result = await analyticsService.generateAnalyticsReport(workplaceId);

      expect(result.recommendations.length).toBeGreaterThan(0);
      
      // Should include recommendations for low usage features
      const hasFeatureRecommendation = result.recommendations.some(rec =>
        rec.includes('training') || rec.includes('features')
      );
      expect(hasFeatureRecommendation).toBe(true);
    });

    it('should handle custom date range', async () => {
      const startDate = new Date(2024, 0, 1);
      const endDate = new Date(2024, 0, 31);

      const result = await analyticsService.generateAnalyticsReport(
        workplaceId,
        { startDate, endDate }
      );

      expect(result.summary.reportPeriod).toContain('2024-01-01');
      expect(result.summary.reportPeriod).toContain('2024-01-31');
    });
  });
});