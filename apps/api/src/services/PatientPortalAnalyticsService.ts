import mongoose from 'mongoose';
import PatientUser, { IPatientUser } from '../models/PatientUser';
import FollowUpTask from '../models/FollowUpTask';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import Appointment from '../models/Appointment';
import logger from '../utils/logger';

export interface IPatientPortalAnalyticsService {
  // User engagement metrics
  getUserEngagementMetrics(
    workplaceId: mongoose.Types.ObjectId,
    dateRange?: {
      startDate: Date;
      endDate: Date;
    }
  ): Promise<{
    totalUsers: number;
    activeUsers: number;
    newUsers: number;
    userGrowthRate: number;
    averageSessionsPerUser: number;
    userRetentionRate: number;
    usersByStatus: {
      active: number;
      pending: number;
      suspended: number;
      inactive: number;
    };
    userRegistrationTrend: Array<{
      date: string;
      count: number;
    }>;
  }>;

  // Feature usage statistics
  getFeatureUsageStats(
    workplaceId: mongoose.Types.ObjectId,
    dateRange?: {
      startDate: Date;
      endDate: Date;
    }
  ): Promise<{
    totalFeatureUsage: number;
    featureUsageBreakdown: Array<{
      feature: string;
      usageCount: number;
      uniqueUsers: number;
      averageUsagePerUser: number;
      popularityPercentage: number;
    }>;
    mostPopularFeatures: Array<{
      feature: string;
      usageCount: number;
    }>;
    leastUsedFeatures: Array<{
      feature: string;
      usageCount: number;
    }>;
    featureAdoptionRate: Array<{
      feature: string;
      adoptionRate: number;
    }>;
  }>;

  // Operational metrics
  getOperationalMetrics(
    workplaceId: mongoose.Types.ObjectId,
    dateRange?: {
      startDate: Date;
      endDate: Date;
    }
  ): Promise<{
    refillRequests: {
      total: number;
      pending: number;
      approved: number;
      denied: number;
      averageResponseTime: number; // in hours
      urgentRequests: number;
      routineRequests: number;
      approvalRate: number;
    };
    appointments: {
      total: number;
      scheduled: number;
      completed: number;
      cancelled: number;
      noShows: number;
      averageBookingLeadTime: number; // in days
      completionRate: number;
    };
    communications: {
      totalConversations: number;
      activeConversations: number;
      totalMessages: number;
      averageMessagesPerConversation: number;
      averageResponseTime: number; // in hours
      patientInitiatedConversations: number;
    };
  }>;

  // Communication metrics tracking
  getCommunicationMetrics(
    workplaceId: mongoose.Types.ObjectId,
    dateRange?: {
      startDate: Date;
      endDate: Date;
    }
  ): Promise<{
    totalConversations: number;
    activeConversations: number;
    resolvedConversations: number;
    totalMessages: number;
    messagesByType: {
      text: number;
      withAttachments: number;
    };
    averageMessagesPerConversation: number;
    averageResponseTime: number; // in minutes
    peakCommunicationHours: Array<{
      hour: number;
      messageCount: number;
    }>;
    communicationTrend: Array<{
      date: string;
      conversationCount: number;
      messageCount: number;
    }>;
    patientSatisfactionIndicators: {
      conversationsWithPositiveFeedback: number;
      conversationsWithNegativeFeedback: number;
      averageConversationDuration: number; // in days
    };
  }>;

  // Advanced analytics
  getAdvancedAnalytics(
    workplaceId: mongoose.Types.ObjectId,
    dateRange?: {
      startDate: Date;
      endDate: Date;
    }
  ): Promise<{
    userBehaviorPatterns: {
      mostActiveTimeOfDay: string;
      mostActiveDayOfWeek: string;
      averageSessionDuration: number; // in minutes
      bounceRate: number;
    };
    healthOutcomes: {
      medicationAdherenceImprovement: number;
      appointmentAttendanceRate: number;
      patientEngagementScore: number;
    };
    systemPerformance: {
      averagePageLoadTime: number; // in seconds
      systemUptime: number; // percentage
      errorRate: number; // percentage
    };
    predictiveInsights: {
      churnRisk: Array<{
        patientUserId: mongoose.Types.ObjectId;
        riskScore: number;
        factors: string[];
      }>;
      expectedGrowth: {
        nextMonth: number;
        nextQuarter: number;
      };
    };
  }>;

  // Generate comprehensive analytics report
  generateAnalyticsReport(
    workplaceId: mongoose.Types.ObjectId,
    dateRange?: {
      startDate: Date;
      endDate: Date;
    }
  ): Promise<{
    summary: {
      reportPeriod: string;
      totalUsers: number;
      activeUsers: number;
      keyMetrics: Array<{
        metric: string;
        value: number | string;
        change: number; // percentage change from previous period
      }>;
    };
    userEngagement: any;
    featureUsage: any;
    operational: any;
    communication: any;
    recommendations: string[];
    generatedAt: Date;
  }>;
}

export class PatientPortalAnalyticsService implements IPatientPortalAnalyticsService {
  /**
   * Get user engagement metrics
   */
  async getUserEngagementMetrics(
    workplaceId: mongoose.Types.ObjectId,
    dateRange?: {
      startDate: Date;
      endDate: Date;
    }
  ): Promise<{
    totalUsers: number;
    activeUsers: number;
    newUsers: number;
    userGrowthRate: number;
    averageSessionsPerUser: number;
    userRetentionRate: number;
    usersByStatus: {
      active: number;
      pending: number;
      suspended: number;
      inactive: number;
    };
    userRegistrationTrend: Array<{
      date: string;
      count: number;
    }>;
  }> {
    try {
      const now = new Date();
      const startDate = dateRange?.startDate || new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = dateRange?.endDate || now;

      // Calculate previous period for comparison
      const periodDuration = endDate.getTime() - startDate.getTime();
      const previousStartDate = new Date(startDate.getTime() - periodDuration);

      // Get user counts
      const [
        totalUsers,
        activeUsers,
        pendingUsers,
        suspendedUsers,
        inactiveUsers,
        newUsers,
        previousPeriodUsers,
      ] = await Promise.all([
        PatientUser.countDocuments({ workplaceId, isDeleted: false }),
        PatientUser.countDocuments({ workplaceId, status: 'active', isDeleted: false }),
        PatientUser.countDocuments({ workplaceId, status: 'pending', isDeleted: false }),
        PatientUser.countDocuments({ workplaceId, status: 'suspended', isDeleted: false }),
        PatientUser.countDocuments({ workplaceId, status: 'inactive', isDeleted: false }),
        PatientUser.countDocuments({
          workplaceId,
          isDeleted: false,
          createdAt: { $gte: startDate, $lte: endDate },
        }),
        PatientUser.countDocuments({
          workplaceId,
          isDeleted: false,
          createdAt: { $gte: previousStartDate, $lt: startDate },
        }),
      ]);

      // Calculate growth rate
      const userGrowthRate = previousPeriodUsers > 0 
        ? ((newUsers - previousPeriodUsers) / previousPeriodUsers) * 100 
        : 0;

      // Get user registration trend (daily for last 30 days)
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const registrationTrend = await PatientUser.aggregate([
        {
          $match: {
            workplaceId,
            isDeleted: false,
            createdAt: { $gte: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            count: { $sum: 1 },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]);

      // Mock session data (would be implemented with actual session tracking)
      const averageSessionsPerUser = Math.floor(activeUsers * 0.3); // Estimated
      const userRetentionRate = activeUsers > 0 ? (activeUsers / totalUsers) * 100 : 0;

      const metrics = {
        totalUsers,
        activeUsers,
        newUsers,
        userGrowthRate: Math.round(userGrowthRate * 100) / 100,
        averageSessionsPerUser,
        userRetentionRate: Math.round(userRetentionRate * 100) / 100,
        usersByStatus: {
          active: activeUsers,
          pending: pendingUsers,
          suspended: suspendedUsers,
          inactive: inactiveUsers,
        },
        userRegistrationTrend: registrationTrend.map(item => ({
          date: item._id,
          count: item.count,
        })),
      };

      logger.info('Retrieved user engagement metrics', {
        workplaceId,
        dateRange,
        metrics: {
          totalUsers,
          activeUsers,
          newUsers,
          userGrowthRate: metrics.userGrowthRate,
        },
      });

      return metrics;
    } catch (error: any) {
      logger.error('Error getting user engagement metrics', {
        error: error.message,
        workplaceId,
        dateRange,
      });
      throw error;
    }
  }

  /**
   * Get feature usage statistics
   */
  async getFeatureUsageStats(
    workplaceId: mongoose.Types.ObjectId,
    dateRange?: {
      startDate: Date;
      endDate: Date;
    }
  ): Promise<{
    totalFeatureUsage: number;
    featureUsageBreakdown: Array<{
      feature: string;
      usageCount: number;
      uniqueUsers: number;
      averageUsagePerUser: number;
      popularityPercentage: number;
    }>;
    mostPopularFeatures: Array<{
      feature: string;
      usageCount: number;
    }>;
    leastUsedFeatures: Array<{
      feature: string;
      usageCount: number;
    }>;
    featureAdoptionRate: Array<{
      feature: string;
      adoptionRate: number;
    }>;
  }> {
    try {
      const activeUsers = await PatientUser.countDocuments({
        workplaceId,
        status: 'active',
        isDeleted: false,
      });

      // Mock feature usage data (would be implemented with actual tracking)
      const features = [
        'medications',
        'messaging',
        'appointments',
        'health_records',
        'vitals',
        'lab_results',
        'billing',
        'educational_resources',
      ];

      const featureUsageBreakdown = features.map(feature => {
        // Simulate usage based on feature popularity
        const baseUsage = activeUsers * 0.1; // Base 10% usage
        const popularityMultiplier = {
          medications: 0.9,
          messaging: 0.7,
          appointments: 0.6,
          health_records: 0.5,
          vitals: 0.4,
          lab_results: 0.3,
          billing: 0.2,
          educational_resources: 0.3,
        }[feature] || 0.1;

        const usageCount = Math.floor(baseUsage * popularityMultiplier * 10); // Multiply by sessions
        const uniqueUsers = Math.floor(activeUsers * popularityMultiplier);
        const averageUsagePerUser = uniqueUsers > 0 ? usageCount / uniqueUsers : 0;
        const popularityPercentage = activeUsers > 0 ? (uniqueUsers / activeUsers) * 100 : 0;

        return {
          feature,
          usageCount,
          uniqueUsers,
          averageUsagePerUser: Math.round(averageUsagePerUser * 100) / 100,
          popularityPercentage: Math.round(popularityPercentage * 100) / 100,
        };
      });

      const totalFeatureUsage = featureUsageBreakdown.reduce(
        (sum, feature) => sum + feature.usageCount,
        0
      );

      // Sort by usage for most/least popular
      const sortedByUsage = [...featureUsageBreakdown].sort(
        (a, b) => b.usageCount - a.usageCount
      );

      const mostPopularFeatures = sortedByUsage.slice(0, 3).map(f => ({
        feature: f.feature,
        usageCount: f.usageCount,
      }));

      const leastUsedFeatures = sortedByUsage.slice(-3).map(f => ({
        feature: f.feature,
        usageCount: f.usageCount,
      }));

      const featureAdoptionRate = featureUsageBreakdown.map(f => ({
        feature: f.feature,
        adoptionRate: f.popularityPercentage,
      }));

      const stats = {
        totalFeatureUsage,
        featureUsageBreakdown,
        mostPopularFeatures,
        leastUsedFeatures,
        featureAdoptionRate,
      };

      logger.info('Retrieved feature usage statistics', {
        workplaceId,
        dateRange,
        totalFeatureUsage,
        mostPopularFeature: mostPopularFeatures[0]?.feature,
      });

      return stats;
    } catch (error: any) {
      logger.error('Error getting feature usage statistics', {
        error: error.message,
        workplaceId,
        dateRange,
      });
      throw error;
    }
  }

  /**
   * Get operational metrics
   */
  async getOperationalMetrics(
    workplaceId: mongoose.Types.ObjectId,
    dateRange?: {
      startDate: Date;
      endDate: Date;
    }
  ): Promise<{
    refillRequests: {
      total: number;
      pending: number;
      approved: number;
      denied: number;
      averageResponseTime: number;
      urgentRequests: number;
      routineRequests: number;
      approvalRate: number;
    };
    appointments: {
      total: number;
      scheduled: number;
      completed: number;
      cancelled: number;
      noShows: number;
      averageBookingLeadTime: number;
      completionRate: number;
    };
    communications: {
      totalConversations: number;
      activeConversations: number;
      totalMessages: number;
      averageMessagesPerConversation: number;
      averageResponseTime: number;
      patientInitiatedConversations: number;
    };
  }> {
    try {
      const now = new Date();
      const startDate = dateRange?.startDate || new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = dateRange?.endDate || now;

      // Refill request metrics
      const refillQuery: any = {
        workplaceId,
        type: 'medication_refill_request',
        isDeleted: false,
        createdAt: { $gte: startDate, $lte: endDate },
      };

      const [
        totalRefillRequests,
        pendingRefillRequests,
        approvedRefillRequests,
        deniedRefillRequests,
        urgentRefillRequests,
        routineRefillRequests,
      ] = await Promise.all([
        FollowUpTask.countDocuments(refillQuery),
        FollowUpTask.countDocuments({ ...refillQuery, status: 'pending' }),
        FollowUpTask.countDocuments({
          ...refillQuery,
          status: 'completed',
          'outcome.status': 'successful',
        }),
        FollowUpTask.countDocuments({
          ...refillQuery,
          status: 'completed',
          'outcome.status': 'unsuccessful',
        }),
        FollowUpTask.countDocuments({
          ...refillQuery,
          'metadata.refillRequest.urgency': 'urgent',
        }),
        FollowUpTask.countDocuments({
          ...refillQuery,
          'metadata.refillRequest.urgency': 'routine',
        }),
      ]);

      // Calculate average response time for completed refill requests
      const completedRefillRequests = await FollowUpTask.find({
        ...refillQuery,
        status: 'completed',
        completedAt: { $exists: true },
      }).select('createdAt completedAt');

      let averageRefillResponseTime = 0;
      if (completedRefillRequests.length > 0) {
        const totalResponseTime = completedRefillRequests.reduce((sum, request) => {
          const responseTime = request.completedAt!.getTime() - request.createdAt.getTime();
          return sum + responseTime;
        }, 0);
        averageRefillResponseTime = Math.round(
          totalResponseTime / completedRefillRequests.length / (1000 * 60 * 60)
        ); // Convert to hours
      }

      const refillApprovalRate = totalRefillRequests > 0 
        ? (approvedRefillRequests / (approvedRefillRequests + deniedRefillRequests)) * 100 
        : 0;

      // Appointment metrics (mock data - would integrate with actual appointment system)
      const appointmentMetrics = {
        total: Math.floor(totalRefillRequests * 0.3), // Estimated
        scheduled: Math.floor(totalRefillRequests * 0.25),
        completed: Math.floor(totalRefillRequests * 0.2),
        cancelled: Math.floor(totalRefillRequests * 0.03),
        noShows: Math.floor(totalRefillRequests * 0.02),
        averageBookingLeadTime: 5, // days
        completionRate: 80, // percentage
      };

      // Communication metrics
      const conversationQuery: any = {
        workplaceId,
        type: 'patient_query',
        isDeleted: false,
        createdAt: { $gte: startDate, $lte: endDate },
      };

      const [
        totalConversations,
        activeConversations,
        totalMessages,
        patientInitiatedConversations,
      ] = await Promise.all([
        Conversation.countDocuments(conversationQuery),
        Conversation.countDocuments({ ...conversationQuery, status: 'active' }),
        Message.countDocuments({
          workplaceId,
          createdAt: { $gte: startDate, $lte: endDate },
          isDeleted: false,
        }),
        Conversation.countDocuments({
          ...conversationQuery,
          'metadata.tags': 'patient_portal',
        }),
      ]);

      const averageMessagesPerConversation = totalConversations > 0 
        ? Math.round((totalMessages / totalConversations) * 100) / 100 
        : 0;

      // Mock response time (would be calculated from actual message timestamps)
      const averageCommunicationResponseTime = 45; // minutes

      const metrics = {
        refillRequests: {
          total: totalRefillRequests,
          pending: pendingRefillRequests,
          approved: approvedRefillRequests,
          denied: deniedRefillRequests,
          averageResponseTime: averageRefillResponseTime,
          urgentRequests: urgentRefillRequests,
          routineRequests: routineRefillRequests,
          approvalRate: Math.round(refillApprovalRate * 100) / 100,
        },
        appointments: appointmentMetrics,
        communications: {
          totalConversations,
          activeConversations,
          totalMessages,
          averageMessagesPerConversation,
          averageResponseTime: averageCommunicationResponseTime,
          patientInitiatedConversations,
        },
      };

      logger.info('Retrieved operational metrics', {
        workplaceId,
        dateRange,
        refillRequests: totalRefillRequests,
        conversations: totalConversations,
      });

      return metrics;
    } catch (error: any) {
      logger.error('Error getting operational metrics', {
        error: error.message,
        workplaceId,
        dateRange,
      });
      throw error;
    }
  }

  /**
   * Get communication metrics tracking
   */
  async getCommunicationMetrics(
    workplaceId: mongoose.Types.ObjectId,
    dateRange?: {
      startDate: Date;
      endDate: Date;
    }
  ): Promise<{
    totalConversations: number;
    activeConversations: number;
    resolvedConversations: number;
    totalMessages: number;
    messagesByType: {
      text: number;
      withAttachments: number;
    };
    averageMessagesPerConversation: number;
    averageResponseTime: number;
    peakCommunicationHours: Array<{
      hour: number;
      messageCount: number;
    }>;
    communicationTrend: Array<{
      date: string;
      conversationCount: number;
      messageCount: number;
    }>;
    patientSatisfactionIndicators: {
      conversationsWithPositiveFeedback: number;
      conversationsWithNegativeFeedback: number;
      averageConversationDuration: number;
    };
  }> {
    try {
      const now = new Date();
      const startDate = dateRange?.startDate || new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = dateRange?.endDate || now;

      const conversationQuery: any = {
        workplaceId,
        type: 'patient_query',
        isDeleted: false,
        createdAt: { $gte: startDate, $lte: endDate },
      };

      const messageQuery: any = {
        workplaceId,
        isDeleted: false,
        createdAt: { $gte: startDate, $lte: endDate },
      };

      // Get basic conversation and message counts
      const [
        totalConversations,
        activeConversations,
        resolvedConversations,
        totalMessages,
        messagesWithAttachments,
      ] = await Promise.all([
        Conversation.countDocuments(conversationQuery),
        Conversation.countDocuments({ ...conversationQuery, status: 'active' }),
        Conversation.countDocuments({ ...conversationQuery, status: 'resolved' }),
        Message.countDocuments(messageQuery),
        Message.countDocuments({
          ...messageQuery,
          'content.attachments': { $exists: true, $ne: [] },
        }),
      ]);

      const textMessages = totalMessages - messagesWithAttachments;
      const averageMessagesPerConversation = totalConversations > 0 
        ? Math.round((totalMessages / totalConversations) * 100) / 100 
        : 0;

      // Get peak communication hours
      const peakHoursData = await Message.aggregate([
        {
          $match: messageQuery,
        },
        {
          $group: {
            _id: { $hour: '$createdAt' },
            messageCount: { $sum: 1 },
          },
        },
        {
          $sort: { messageCount: -1 },
        },
        {
          $limit: 5,
        },
      ]);

      const peakCommunicationHours = peakHoursData.map(item => ({
        hour: item._id,
        messageCount: item.messageCount,
      }));

      // Get communication trend (daily)
      const trendData = await Promise.all([
        Conversation.aggregate([
          {
            $match: conversationQuery,
          },
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
              },
              conversationCount: { $sum: 1 },
            },
          },
          {
            $sort: { _id: 1 },
          },
        ]),
        Message.aggregate([
          {
            $match: messageQuery,
          },
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
              },
              messageCount: { $sum: 1 },
            },
          },
          {
            $sort: { _id: 1 },
          },
        ]),
      ]);

      // Merge conversation and message trends
      const conversationTrendMap = new Map(
        trendData[0].map(item => [item._id, item.conversationCount])
      );
      const messageTrendMap = new Map(
        trendData[1].map(item => [item._id, item.messageCount])
      );

      const allDates = new Set([
        ...conversationTrendMap.keys(),
        ...messageTrendMap.keys(),
      ]);

      const communicationTrend = Array.from(allDates)
        .sort()
        .map(date => ({
          date,
          conversationCount: conversationTrendMap.get(date) || 0,
          messageCount: messageTrendMap.get(date) || 0,
        }));

      // Mock satisfaction indicators (would be implemented with actual feedback system)
      const patientSatisfactionIndicators = {
        conversationsWithPositiveFeedback: Math.floor(resolvedConversations * 0.8),
        conversationsWithNegativeFeedback: Math.floor(resolvedConversations * 0.1),
        averageConversationDuration: 2.5, // days
      };

      // Mock average response time (would be calculated from actual timestamps)
      const averageResponseTime = 35; // minutes

      const metrics = {
        totalConversations,
        activeConversations,
        resolvedConversations,
        totalMessages,
        messagesByType: {
          text: textMessages,
          withAttachments: messagesWithAttachments,
        },
        averageMessagesPerConversation,
        averageResponseTime,
        peakCommunicationHours,
        communicationTrend,
        patientSatisfactionIndicators,
      };

      logger.info('Retrieved communication metrics', {
        workplaceId,
        dateRange,
        totalConversations,
        totalMessages,
      });

      return metrics;
    } catch (error: any) {
      logger.error('Error getting communication metrics', {
        error: error.message,
        workplaceId,
        dateRange,
      });
      throw error;
    }
  }

  /**
   * Get advanced analytics
   */
  async getAdvancedAnalytics(
    workplaceId: mongoose.Types.ObjectId,
    dateRange?: {
      startDate: Date;
      endDate: Date;
    }
  ): Promise<{
    userBehaviorPatterns: {
      mostActiveTimeOfDay: string;
      mostActiveDayOfWeek: string;
      averageSessionDuration: number;
      bounceRate: number;
    };
    healthOutcomes: {
      medicationAdherenceImprovement: number;
      appointmentAttendanceRate: number;
      patientEngagementScore: number;
    };
    systemPerformance: {
      averagePageLoadTime: number;
      systemUptime: number;
      errorRate: number;
    };
    predictiveInsights: {
      churnRisk: Array<{
        patientUserId: mongoose.Types.ObjectId;
        riskScore: number;
        factors: string[];
      }>;
      expectedGrowth: {
        nextMonth: number;
        nextQuarter: number;
      };
    };
  }> {
    try {
      const activeUsers = await PatientUser.countDocuments({
        workplaceId,
        status: 'active',
        isDeleted: false,
      });

      // Mock user behavior patterns (would be implemented with actual tracking)
      const userBehaviorPatterns = {
        mostActiveTimeOfDay: '14:00', // 2 PM
        mostActiveDayOfWeek: 'Tuesday',
        averageSessionDuration: 12, // minutes
        bounceRate: 25, // percentage
      };

      // Mock health outcomes (would be calculated from actual health data)
      const healthOutcomes = {
        medicationAdherenceImprovement: 15, // percentage improvement
        appointmentAttendanceRate: 85, // percentage
        patientEngagementScore: 78, // out of 100
      };

      // Mock system performance (would be from actual monitoring)
      const systemPerformance = {
        averagePageLoadTime: 2.3, // seconds
        systemUptime: 99.8, // percentage
        errorRate: 0.2, // percentage
      };

      // Mock predictive insights
      const inactiveUsers = await PatientUser.find({
        workplaceId,
        status: 'active',
        lastLoginAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // 30 days ago
        isDeleted: false,
      }).limit(5);

      const churnRisk = inactiveUsers.map(user => ({
        patientUserId: user._id,
        riskScore: Math.floor(Math.random() * 40) + 60, // 60-100% risk
        factors: [
          'No login in 30+ days',
          'Low feature usage',
          'No recent communications',
        ],
      }));

      const currentMonthUsers = await PatientUser.countDocuments({
        workplaceId,
        isDeleted: false,
        createdAt: {
          $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      });

      const expectedGrowth = {
        nextMonth: Math.floor(currentMonthUsers * 1.1), // 10% growth
        nextQuarter: Math.floor(currentMonthUsers * 1.35), // 35% growth over quarter
      };

      const analytics = {
        userBehaviorPatterns,
        healthOutcomes,
        systemPerformance,
        predictiveInsights: {
          churnRisk,
          expectedGrowth,
        },
      };

      logger.info('Retrieved advanced analytics', {
        workplaceId,
        dateRange,
        churnRiskCount: churnRisk.length,
        expectedGrowth,
      });

      return analytics;
    } catch (error: any) {
      logger.error('Error getting advanced analytics', {
        error: error.message,
        workplaceId,
        dateRange,
      });
      throw error;
    }
  }

  /**
   * Generate comprehensive analytics report
   */
  async generateAnalyticsReport(
    workplaceId: mongoose.Types.ObjectId,
    dateRange?: {
      startDate: Date;
      endDate: Date;
    }
  ): Promise<{
    summary: {
      reportPeriod: string;
      totalUsers: number;
      activeUsers: number;
      keyMetrics: Array<{
        metric: string;
        value: number | string;
        change: number;
      }>;
    };
    userEngagement: any;
    featureUsage: any;
    operational: any;
    communication: any;
    recommendations: string[];
    generatedAt: Date;
  }> {
    try {
      const now = new Date();
      const startDate = dateRange?.startDate || new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = dateRange?.endDate || now;

      // Get all analytics data
      const [
        userEngagement,
        featureUsage,
        operational,
        communication,
      ] = await Promise.all([
        this.getUserEngagementMetrics(workplaceId, dateRange),
        this.getFeatureUsageStats(workplaceId, dateRange),
        this.getOperationalMetrics(workplaceId, dateRange),
        this.getCommunicationMetrics(workplaceId, dateRange),
      ]);

      // Generate key metrics with mock change percentages
      const keyMetrics = [
        {
          metric: 'Total Users',
          value: userEngagement.totalUsers,
          change: userEngagement.userGrowthRate,
        },
        {
          metric: 'Active Users',
          value: userEngagement.activeUsers,
          change: 5.2, // Mock change
        },
        {
          metric: 'Refill Requests',
          value: operational.refillRequests.total,
          change: 12.5, // Mock change
        },
        {
          metric: 'Approval Rate',
          value: `${operational.refillRequests.approvalRate}%`,
          change: 2.1, // Mock change
        },
        {
          metric: 'Response Time',
          value: `${operational.refillRequests.averageResponseTime}h`,
          change: -8.3, // Negative is good for response time
        },
      ];

      // Generate recommendations based on data
      const recommendations: string[] = [];

      if (userEngagement.userGrowthRate < 5) {
        recommendations.push('Consider implementing user referral programs to increase growth rate');
      }

      if (operational.refillRequests.approvalRate < 80) {
        recommendations.push('Review refill request denial reasons to improve approval rate');
      }

      if (operational.refillRequests.averageResponseTime > 24) {
        recommendations.push('Optimize refill request workflow to reduce response time');
      }

      if (featureUsage.featureUsageBreakdown.some(f => f.popularityPercentage < 20)) {
        recommendations.push('Provide user training for underutilized features');
      }

      if (communication.averageResponseTime > 60) {
        recommendations.push('Improve communication response times with automated responses');
      }

      if (userEngagement.usersByStatus.pending > userEngagement.activeUsers * 0.2) {
        recommendations.push('Streamline user approval process to reduce pending accounts');
      }

      const reportPeriod = `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`;

      const report = {
        summary: {
          reportPeriod,
          totalUsers: userEngagement.totalUsers,
          activeUsers: userEngagement.activeUsers,
          keyMetrics,
        },
        userEngagement,
        featureUsage,
        operational,
        communication,
        recommendations,
        generatedAt: now,
      };

      logger.info('Generated comprehensive analytics report', {
        workplaceId,
        dateRange,
        reportPeriod,
        recommendationsCount: recommendations.length,
      });

      return report;
    } catch (error: any) {
      logger.error('Error generating analytics report', {
        error: error.message,
        workplaceId,
        dateRange,
      });
      throw error;
    }
  }
}

export default new PatientPortalAnalyticsService();