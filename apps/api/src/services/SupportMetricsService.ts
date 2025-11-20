import mongoose from 'mongoose';
import { SupportTicket } from '../models/SupportTicket';
import { TicketComment } from '../models/TicketComment';
import { KnowledgeBaseArticle } from '../models/KnowledgeBaseArticle';
import { User } from '../models/User';
import { RedisCacheService } from './RedisCacheService';
import logger from '../utils/logger';

export interface SupportKPIs {
  // Ticket metrics
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  closedTickets: number;
  criticalTickets: number;

  // Performance metrics
  averageResponseTime: number; // in hours
  averageResolutionTime: number; // in hours
  firstResponseSLA: number; // percentage meeting SLA
  resolutionSLA: number; // percentage meeting SLA

  // Quality metrics
  customerSatisfactionScore: number; // 1-100 scale
  escalationRate: number; // percentage of tickets escalated
  reopenRate: number; // percentage of resolved tickets reopened

  // Agent metrics
  totalAgents: number;
  activeAgents: number;
  averageTicketsPerAgent: number;
  topPerformingAgents: AgentPerformance[];

  // Knowledge base metrics
  totalArticles: number;
  articleViews: number;
  articleHelpfulnessScore: number;

  // Chart data for frontend
  ticketsByStatus: { status: string; count: number }[];
  ticketsByPriority: { priority: string; count: number }[];
  ticketsByCategory: { category: string; count: number }[];

  // Trend data
  ticketTrends: TrendData[];
  resolutionTrends: TrendData[];
  satisfactionTrends: TrendData[];
}

export interface AgentPerformance {
  agentId: string;
  agentName: string;
  ticketsAssigned: number;
  ticketsResolved: number;
  averageResponseTime: number;
  averageResolutionTime: number;
  customerSatisfactionScore: number;
  resolutionRate: number;
}

export interface TrendData {
  date: Date;
  value: number;
  label?: string;
}

export interface SupportAnalytics {
  timeRange: {
    startDate: Date;
    endDate: Date;
  };
  kpis: SupportKPIs;
  ticketDistribution: {
    byStatus: { status: string; count: number; percentage: number }[];
    byPriority: { priority: string; count: number; percentage: number }[];
    byCategory: { category: string; count: number; percentage: number }[];
  };
  performanceMetrics: {
    responseTimeDistribution: { range: string; count: number }[];
    resolutionTimeDistribution: { range: string; count: number }[];
    slaCompliance: {
      responseTime: { met: number; missed: number; percentage: number };
      resolutionTime: { met: number; missed: number; percentage: number };
    };
  };
  agentAnalytics: {
    workload: { agentId: string; agentName: string; activeTickets: number }[];
    performance: AgentPerformance[];
  };
  customerInsights: {
    satisfactionDistribution: { rating: number; count: number }[];
    topIssues: { category: string; count: number; avgResolutionTime: number }[];
    repeatCustomers: { userId: string; userName: string; ticketCount: number }[];
  };
}

/**
 * SupportMetricsService - Handles support performance analytics and KPIs
 * Provides comprehensive metrics for support team performance tracking
 */
export class SupportMetricsService {
  private static instance: SupportMetricsService;
  private cacheService: RedisCacheService;
  private readonly CACHE_TTL = 15 * 60; // 15 minutes

  // SLA thresholds (in hours)
  private readonly SLA_THRESHOLDS = {
    responseTime: {
      critical: 1,
      high: 4,
      medium: 24,
      low: 72
    },
    resolutionTime: {
      critical: 4,
      high: 24,
      medium: 72,
      low: 168
    }
  };

  constructor() {
    this.cacheService = RedisCacheService.getInstance();
  }

  public static getInstance(): SupportMetricsService {
    if (!SupportMetricsService.instance) {
      SupportMetricsService.instance = new SupportMetricsService();
    }
    return SupportMetricsService.instance;
  }

  /**
   * Get comprehensive support analytics for a time range
   */
  async getSupportAnalytics(timeRange: { startDate: Date; endDate: Date }): Promise<SupportAnalytics> {
    try {
      const cacheKey = `support:analytics:${timeRange.startDate.getTime()}:${timeRange.endDate.getTime()}`;

      // Try cache first
      const cached = await this.cacheService.get(cacheKey);
      if (cached && typeof cached === "object" && Object.keys(cached).length > 0) {
        return cached as any;
      }

      // Calculate all analytics in parallel
      const [
        kpis,
        ticketDistribution,
        performanceMetrics,
        agentAnalytics,
        customerInsights
      ] = await Promise.all([
        this.calculateKPIs(timeRange),
        this.getTicketDistribution(timeRange),
        this.getPerformanceMetrics(timeRange),
        this.getAgentAnalytics(timeRange),
        this.getCustomerInsights(timeRange)
      ]);

      const analytics: SupportAnalytics = {
        timeRange,
        kpis,
        ticketDistribution,
        performanceMetrics,
        agentAnalytics,
        customerInsights
      };

      // Cache for 15 minutes
      await this.cacheService.set(cacheKey, analytics, { ttl: this.CACHE_TTL });

      return analytics;
    } catch (error) {
      logger.error('Error calculating support analytics:', error);
      throw new Error('Failed to calculate support analytics');
    }
  }

  /**
   * Get real-time support KPIs
   */
  async getSupportKPIs(timeRange?: { startDate: Date; endDate: Date }): Promise<SupportKPIs> {
    try {
      const cacheKey = timeRange ?
        `support:kpis:${timeRange.startDate.getTime()}:${timeRange.endDate.getTime()}` :
        'support:kpis:current';

      // Try cache first
      const cached = await this.cacheService.get(cacheKey);
      if (cached && typeof cached === "object" && Object.keys(cached).length > 0) {
        return cached as any;
      }

      const kpis = await this.calculateKPIs(timeRange);

      // Cache for 5 minutes for real-time data
      await this.cacheService.set(cacheKey, kpis, { ttl: 300 });

      return kpis;
    } catch (error) {
      logger.error('Error calculating support KPIs:', error);
      throw new Error('Failed to calculate support KPIs');
    }
  }

  /**
   * Get agent performance metrics
   */
  async getAgentPerformance(
    agentId?: string,
    timeRange?: { startDate: Date; endDate: Date }
  ): Promise<AgentPerformance[]> {
    try {
      const cacheKey = `support:agent:performance:${agentId || 'all'}:${timeRange ? `${timeRange.startDate.getTime()}:${timeRange.endDate.getTime()}` : 'all'}`;

      // Try cache first
      const cached = await this.cacheService.get(cacheKey);
      if (cached && typeof cached === "object" && Object.keys(cached).length > 0) {
        return cached as any;
      }

      const performance = await this.calculateAgentPerformance(agentId, timeRange);

      // Cache for 10 minutes
      await this.cacheService.set(cacheKey, performance, { ttl: 600 });

      return performance;
    } catch (error) {
      logger.error('Error calculating agent performance:', error);
      throw new Error('Failed to calculate agent performance');
    }
  }

  /**
   * Get support trends over time
   */
  async getSupportTrends(
    metric: 'tickets' | 'resolution_time' | 'satisfaction',
    timeRange: { startDate: Date; endDate: Date },
    granularity: 'day' | 'week' | 'month' = 'day'
  ): Promise<TrendData[]> {
    try {
      const cacheKey = `support:trends:${metric}:${granularity}:${timeRange.startDate.getTime()}:${timeRange.endDate.getTime()}`;

      // Try cache first
      const cached = await this.cacheService.get(cacheKey);
      if (cached && typeof cached === "object" && Object.keys(cached).length > 0) {
        return cached as any;
      }

      const trends = await this.calculateTrends(metric, timeRange, granularity);

      // Cache for 1 hour
      await this.cacheService.set(cacheKey, trends, { ttl: 3600 });

      return trends;
    } catch (error) {
      logger.error('Error calculating support trends:', error);
      throw new Error('Failed to calculate support trends');
    }
  }

  /**
   * Get SLA compliance report
   */
  async getSLACompliance(timeRange: { startDate: Date; endDate: Date }): Promise<{
    responseTime: { met: number; missed: number; percentage: number };
    resolutionTime: { met: number; missed: number; percentage: number };
    byPriority: { priority: string; responseTimeSLA: number; resolutionTimeSLA: number }[];
  }> {
    try {
      const dateFilter = {
        createdAt: {
          $gte: timeRange.startDate,
          $lte: timeRange.endDate
        }
      };

      // Calculate response time SLA compliance
      const responseTimeSLA = await this.calculateResponseTimeSLA(dateFilter);

      // Calculate resolution time SLA compliance
      const resolutionTimeSLA = await this.calculateResolutionTimeSLA(dateFilter);

      // Calculate SLA by priority
      const slaByPriority = await this.calculateSLAByPriority(dateFilter);

      return {
        responseTime: responseTimeSLA,
        resolutionTime: resolutionTimeSLA,
        byPriority: slaByPriority
      };
    } catch (error) {
      logger.error('Error calculating SLA compliance:', error);
      throw new Error('Failed to calculate SLA compliance');
    }
  }

  // Private calculation methods

  private async calculateKPIs(timeRange?: { startDate: Date; endDate: Date }): Promise<SupportKPIs> {
    const dateFilter = timeRange ? {
      createdAt: {
        $gte: timeRange.startDate,
        $lte: timeRange.endDate
      }
    } : {};

    // Parallel execution of all KPI calculations
    const [
      ticketCounts,
      responseTimeStats,
      resolutionTimeStats,
      satisfactionStats,
      escalationStats,
      agentStats,
      kbStats,
      trends
    ] = await Promise.all([
      this.getTicketCounts(dateFilter),
      this.getResponseTimeStats(dateFilter),
      this.getResolutionTimeStats(dateFilter),
      this.getSatisfactionStats(dateFilter),
      this.getEscalationStats(dateFilter),
      this.getAgentStats(dateFilter),
      this.getKnowledgeBaseStats(),
      this.getTrendData(dateFilter)
    ]);

    return {
      totalTickets: 0,
      openTickets: 0,
      resolvedTickets: 0,
      closedTickets: 0,
      criticalTickets: 0,
      averageResponseTime: 0,
      averageResolutionTime: 0,
      firstResponseSLA: 0,
      resolutionSLA: 0,
      customerSatisfactionScore: 0,
      totalEscalations: 0,
      activeAgents: 0,
      topPerformingAgents: [],
      kbArticleViews: 0,
      // Default chart data
      ticketsByStatus: [],
      ticketsByPriority: [],
      ticketsByCategory: [],
      responseTrends: [],
      resolutionTrends: [],
      satisfactionTrends: [],
      ...ticketCounts,
      ...responseTimeStats,
      ...resolutionTimeStats,
      ...satisfactionStats,
      ...escalationStats,
      ...agentStats,
      ...kbStats,
      ...trends
    } as SupportKPIs;
  }

  private async getTicketCounts(dateFilter: any): Promise<Partial<SupportKPIs>> {
    const [total, byStatus, byPriority, byCategory] = await Promise.all([
      SupportTicket.countDocuments(dateFilter),
      SupportTicket.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      SupportTicket.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$priority', count: { $sum: 1 } } }
      ]),
      SupportTicket.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ])
    ]);

    const statusCounts = byStatus.reduce((acc, item) => {
      acc[`${item._id}Tickets`] = item.count;
      return acc;
    }, {} as any);

    const criticalTickets = byPriority.find(p => p._id === 'critical')?.count || 0;

    // Format chart data for frontend
    const ticketsByStatus = byStatus.map(item => ({
      status: item._id,
      count: item.count
    }));

    const ticketsByPriority = byPriority.map(item => ({
      priority: item._id,
      count: item.count
    }));

    const ticketsByCategory = byCategory.map(item => ({
      category: item._id,
      count: item.count
    }));

    return {
      totalTickets: total,
      openTickets: statusCounts.openTickets || 0,
      resolvedTickets: statusCounts.resolvedTickets || 0,
      closedTickets: statusCounts.closedTickets || 0,
      criticalTickets,
      // Add chart data
      ticketsByStatus,
      ticketsByPriority,
      ticketsByCategory
    };
  }

  private async getResponseTimeStats(dateFilter: any): Promise<Partial<SupportKPIs>> {
    const result = await SupportTicket.aggregate([
      {
        $match: {
          ...dateFilter,
          firstResponseAt: { $exists: true }
        }
      },
      {
        $project: {
          responseTime: {
            $divide: [
              { $subtract: ['$firstResponseAt', '$createdAt'] },
              1000 * 60 * 60 // Convert to hours
            ]
          },
          priority: 1
        }
      },
      {
        $group: {
          _id: null,
          avgResponseTime: { $avg: '$responseTime' },
          tickets: { $push: { responseTime: '$responseTime', priority: '$priority' } }
        }
      }
    ]);

    if (result.length === 0) {
      return { averageResponseTime: 0, firstResponseSLA: 0 };
    }

    const avgResponseTime = Math.round(result[0].avgResponseTime);

    // Calculate SLA compliance
    const tickets = result[0].tickets;
    const slaCompliant = tickets.filter((ticket: any) => {
      const threshold = this.SLA_THRESHOLDS.responseTime[ticket.priority as keyof typeof this.SLA_THRESHOLDS.responseTime];
      return ticket.responseTime <= threshold;
    }).length;

    const firstResponseSLA = Math.round((slaCompliant / tickets.length) * 100);

    return {
      averageResponseTime: avgResponseTime,
      firstResponseSLA
    };
  }

  private async getResolutionTimeStats(dateFilter: any): Promise<Partial<SupportKPIs>> {
    const result = await SupportTicket.aggregate([
      {
        $match: {
          ...dateFilter,
          resolvedAt: { $exists: true }
        }
      },
      {
        $project: {
          resolutionTime: {
            $divide: [
              { $subtract: ['$resolvedAt', '$createdAt'] },
              1000 * 60 * 60 // Convert to hours
            ]
          },
          priority: 1
        }
      },
      {
        $group: {
          _id: null,
          avgResolutionTime: { $avg: '$resolutionTime' },
          tickets: { $push: { resolutionTime: '$resolutionTime', priority: '$priority' } }
        }
      }
    ]);

    if (result.length === 0) {
      return { averageResolutionTime: 0, resolutionSLA: 0 };
    }

    const avgResolutionTime = Math.round(result[0].avgResolutionTime);

    // Calculate SLA compliance
    const tickets = result[0].tickets;
    const slaCompliant = tickets.filter((ticket: any) => {
      const threshold = this.SLA_THRESHOLDS.resolutionTime[ticket.priority as keyof typeof this.SLA_THRESHOLDS.resolutionTime];
      return ticket.resolutionTime <= threshold;
    }).length;

    const resolutionSLA = Math.round((slaCompliant / tickets.length) * 100);

    return {
      averageResolutionTime: avgResolutionTime,
      resolutionSLA
    };
  }

  private async getSatisfactionStats(dateFilter: any): Promise<Partial<SupportKPIs>> {
    const result = await SupportTicket.aggregate([
      {
        $match: {
          ...dateFilter,
          customerSatisfactionRating: { $exists: true }
        }
      },
      {
        $group: {
          _id: null,
          avgSatisfaction: { $avg: '$customerSatisfactionRating' }
        }
      }
    ]);

    const customerSatisfactionScore = result.length > 0 ?
      Math.round(result[0].avgSatisfaction * 20) : 0; // Convert 1-5 scale to percentage

    return { customerSatisfactionScore };
  }

  private async getEscalationStats(dateFilter: any): Promise<Partial<SupportKPIs>> {
    const [total, escalated] = await Promise.all([
      SupportTicket.countDocuments(dateFilter),
      SupportTicket.countDocuments({ ...dateFilter, escalatedAt: { $exists: true } })
    ]);

    const escalationRate = total > 0 ? Math.round((escalated / total) * 100) : 0;

    // Calculate reopen rate
    const [resolved, reopened] = await Promise.all([
      SupportTicket.countDocuments({ ...dateFilter, status: 'resolved' }),
      SupportTicket.countDocuments({
        ...dateFilter,
        status: 'open',
        resolvedAt: { $exists: true }
      })
    ]);

    const reopenRate = resolved > 0 ? Math.round((reopened / resolved) * 100) : 0;

    return { escalationRate, reopenRate };
  }

  private async getAgentStats(dateFilter: any): Promise<Partial<SupportKPIs>> {
    const [totalAgents, activeAgents, ticketsAssigned] = await Promise.all([
      User.countDocuments({ role: { $in: ['support_agent', 'senior_support_agent', 'technical_support'] } }),
      User.countDocuments({
        role: { $in: ['support_agent', 'senior_support_agent', 'technical_support'] },
        lastLoginAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Active in last 7 days
      }),
      SupportTicket.countDocuments({ ...dateFilter, assignedTo: { $exists: true } })
    ]);

    const averageTicketsPerAgent = activeAgents > 0 ? Math.round(ticketsAssigned / activeAgents) : 0;

    // Get top performing agents
    const topPerformingAgents = await this.getTopPerformingAgents(dateFilter, 5);

    return {
      totalAgents,
      activeAgents,
      averageTicketsPerAgent,
      topPerformingAgents
    };
  }

  private async getKnowledgeBaseStats(): Promise<Partial<SupportKPIs>> {
    const [totalArticles, viewsResult, helpfulnessResult] = await Promise.all([
      KnowledgeBaseArticle.countDocuments({ status: 'published' }),
      KnowledgeBaseArticle.aggregate([
        { $group: { _id: null, totalViews: { $sum: '$viewCount' } } }
      ]),
      KnowledgeBaseArticle.aggregate([
        {
          $match: {
            $or: [
              { helpfulVotes: { $gt: 0 } },
              { notHelpfulVotes: { $gt: 0 } }
            ]
          }
        },
        {
          $project: {
            helpfulnessScore: {
              $multiply: [
                {
                  $divide: [
                    '$helpfulVotes',
                    { $add: ['$helpfulVotes', '$notHelpfulVotes'] }
                  ]
                },
                100
              ]
            }
          }
        },
        {
          $group: {
            _id: null,
            avgHelpfulness: { $avg: '$helpfulnessScore' }
          }
        }
      ])
    ]);

    return {
      totalArticles,
      articleViews: viewsResult.length > 0 ? viewsResult[0].totalViews : 0,
      articleHelpfulnessScore: helpfulnessResult.length > 0 ? Math.round(helpfulnessResult[0].avgHelpfulness) : 0
    };
  }

  private async getTrendData(dateFilter: any): Promise<Partial<SupportKPIs>> {
    // This would calculate trend data over time
    // For now, returning empty arrays
    return {
      ticketTrends: [],
      resolutionTrends: [],
      satisfactionTrends: []
    };
  }

  private async getTopPerformingAgents(dateFilter: any, limit: number): Promise<AgentPerformance[]> {
    const result = await SupportTicket.aggregate([
      { $match: { ...dateFilter, assignedTo: { $exists: true } } },
      {
        $group: {
          _id: '$assignedTo',
          ticketsAssigned: { $sum: 1 },
          ticketsResolved: {
            $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
          },
          avgResponseTime: {
            $avg: {
              $cond: [
                { $ne: ['$firstResponseAt', null] },
                {
                  $divide: [
                    { $subtract: ['$firstResponseAt', '$createdAt'] },
                    1000 * 60 * 60
                  ]
                },
                null
              ]
            }
          },
          avgResolutionTime: {
            $avg: {
              $cond: [
                { $ne: ['$resolvedAt', null] },
                {
                  $divide: [
                    { $subtract: ['$resolvedAt', '$createdAt'] },
                    1000 * 60 * 60
                  ]
                },
                null
              ]
            }
          },
          avgSatisfaction: { $avg: '$customerSatisfactionRating' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'agent'
        }
      },
      { $unwind: '$agent' },
      {
        $project: {
          agentId: '$_id',
          agentName: { $concat: ['$agent.firstName', ' ', '$agent.lastName'] },
          ticketsAssigned: 1,
          ticketsResolved: 1,
          averageResponseTime: { $round: ['$avgResponseTime', 1] },
          averageResolutionTime: { $round: ['$avgResolutionTime', 1] },
          customerSatisfactionScore: { $round: [{ $multiply: ['$avgSatisfaction', 20] }, 0] },
          resolutionRate: {
            $round: [
              { $multiply: [{ $divide: ['$ticketsResolved', '$ticketsAssigned'] }, 100] },
              1
            ]
          }
        }
      },
      { $sort: { resolutionRate: -1, customerSatisfactionScore: -1 } },
      { $limit: limit }
    ]);

    return result.map(agent => ({
      agentId: agent.agentId.toString(),
      agentName: agent.agentName,
      ticketsAssigned: agent.ticketsAssigned,
      ticketsResolved: agent.ticketsResolved,
      averageResponseTime: agent.averageResponseTime || 0,
      averageResolutionTime: agent.averageResolutionTime || 0,
      customerSatisfactionScore: agent.customerSatisfactionScore || 0,
      resolutionRate: agent.resolutionRate || 0
    }));
  }

  private async getTicketDistribution(timeRange: { startDate: Date; endDate: Date }): Promise<any> {
    const dateFilter = {
      createdAt: {
        $gte: timeRange.startDate,
        $lte: timeRange.endDate
      }
    };

    const [total, byStatus, byPriority, byCategory] = await Promise.all([
      SupportTicket.countDocuments(dateFilter),
      SupportTicket.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      SupportTicket.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$priority', count: { $sum: 1 } } }
      ]),
      SupportTicket.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ])
    ]);

    const addPercentages = (data: any[]) =>
      data.map(item => ({
        ...item,
        status: item._id,
        priority: item._id,
        category: item._id,
        percentage: total > 0 ? Math.round((item.count / total) * 100) : 0
      }));

    return {
      byStatus: addPercentages(byStatus),
      byPriority: addPercentages(byPriority),
      byCategory: addPercentages(byCategory)
    };
  }

  private async getPerformanceMetrics(timeRange: { startDate: Date; endDate: Date }): Promise<any> {
    // Implementation for performance metrics
    return {
      responseTimeDistribution: [],
      resolutionTimeDistribution: [],
      slaCompliance: {
        responseTime: { met: 0, missed: 0, percentage: 0 },
        resolutionTime: { met: 0, missed: 0, percentage: 0 }
      }
    };
  }

  private async getAgentAnalytics(timeRange: { startDate: Date; endDate: Date }): Promise<any> {
    // Implementation for agent analytics
    return {
      workload: [],
      performance: []
    };
  }

  private async getCustomerInsights(timeRange: { startDate: Date; endDate: Date }): Promise<any> {
    // Implementation for customer insights
    return {
      satisfactionDistribution: [],
      topIssues: [],
      repeatCustomers: []
    };
  }

  private async calculateAgentPerformance(
    agentId?: string,
    timeRange?: { startDate: Date; endDate: Date }
  ): Promise<AgentPerformance[]> {
    // Implementation for agent performance calculation
    return [];
  }

  private async calculateTrends(
    metric: string,
    timeRange: { startDate: Date; endDate: Date },
    granularity: string
  ): Promise<TrendData[]> {
    // Implementation for trend calculation
    return [];
  }

  private async calculateResponseTimeSLA(dateFilter: any): Promise<{ met: number; missed: number; percentage: number }> {
    // Implementation for response time SLA calculation
    return { met: 0, missed: 0, percentage: 0 };
  }

  private async calculateResolutionTimeSLA(dateFilter: any): Promise<{ met: number; missed: number; percentage: number }> {
    // Implementation for resolution time SLA calculation
    return { met: 0, missed: 0, percentage: 0 };
  }

  private async calculateSLAByPriority(dateFilter: any): Promise<{ priority: string; responseTimeSLA: number; resolutionTimeSLA: number }[]> {
    // Implementation for SLA by priority calculation
    return [];
  }
}

export default SupportMetricsService;