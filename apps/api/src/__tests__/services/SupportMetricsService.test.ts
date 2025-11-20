import mongoose from 'mongoose';
import { SupportMetricsService } from '../../services/SupportMetricsService';
import { SupportTicket } from '../../models/SupportTicket';
import { TicketComment } from '../../models/TicketComment';
import { KnowledgeBaseArticle } from '../../models/KnowledgeBaseArticle';
import { User } from '../../models/User';
import { RedisCacheService } from '../../services/RedisCacheService';

// Mock dependencies
jest.mock('../../models/SupportTicket');
jest.mock('../../models/TicketComment');
jest.mock('../../models/KnowledgeBaseArticle');
jest.mock('../../models/User');
jest.mock('../../services/RedisCacheService');

describe('SupportMetricsService', () => {
  let supportMetricsService: SupportMetricsService;
  let mockCacheService: jest.Mocked<RedisCacheService>;

  const mockTimeRange = {
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-31')
  };

  const mockTicketCounts = {
    totalTickets: 100,
    openTickets: 30,
    resolvedTickets: 60,
    closedTickets: 10,
    criticalTickets: 5
  };

  const mockKPIs = {
    totalTickets: 100,
    openTickets: 30,
    resolvedTickets: 60,
    closedTickets: 10,
    criticalTickets: 5,
    averageResponseTime: 4.5,
    averageResolutionTime: 24,
    firstResponseSLA: 85,
    resolutionSLA: 90,
    customerSatisfactionScore: 4.2,
    escalationRate: 8,
    reopenRate: 3,
    totalAgents: 10,
    activeAgents: 8,
    averageTicketsPerAgent: 12,
    topPerformingAgents: [],
    totalArticles: 50,
    articleViews: 1500,
    articleHelpfulnessScore: 78,
    ticketTrends: [],
    resolutionTrends: [],
    satisfactionTrends: []
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock RedisCacheService
    mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(true),
      del: jest.fn().mockResolvedValue(true),
      delPattern: jest.fn().mockResolvedValue(true)
    } as any;
    (RedisCacheService.getInstance as jest.Mock).mockReturnValue(mockCacheService);

    supportMetricsService = SupportMetricsService.getInstance();
  });

  describe('getSupportKPIs', () => {
    beforeEach(() => {
      // Mock ticket count queries
      (SupportTicket.countDocuments as jest.Mock).mockResolvedValue(100);
      (SupportTicket.aggregate as jest.Mock).mockResolvedValue([
        { _id: 'open', count: 30 },
        { _id: 'resolved', count: 60 },
        { _id: 'closed', count: 10 }
      ]);
      
      // Mock other model queries
      (User.countDocuments as jest.Mock).mockResolvedValue(10);
      (KnowledgeBaseArticle.countDocuments as jest.Mock).mockResolvedValue(50);
      (KnowledgeBaseArticle.aggregate as jest.Mock).mockResolvedValue([
        { totalViews: 1500 }
      ]);
    });

    it('should return support KPIs successfully', async () => {
      const result = await supportMetricsService.getSupportKPIs(mockTimeRange);

      expect(result).toHaveProperty('totalTickets');
      expect(result).toHaveProperty('openTickets');
      expect(result).toHaveProperty('resolvedTickets');
      expect(result).toHaveProperty('averageResponseTime');
      expect(result).toHaveProperty('customerSatisfactionScore');
    });

    it('should use cache when available', async () => {
      mockCacheService.get.mockResolvedValue(mockKPIs);

      const result = await supportMetricsService.getSupportKPIs(mockTimeRange);

      expect(result).toEqual(mockKPIs);
      expect(SupportTicket.countDocuments).not.toHaveBeenCalled();
    });

    it('should cache the calculated KPIs', async () => {
      await supportMetricsService.getSupportKPIs(mockTimeRange);

      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        { ttl: 300 }
      );
    });

    it('should handle no time range (current KPIs)', async () => {
      await supportMetricsService.getSupportKPIs();

      expect(mockCacheService.get).toHaveBeenCalledWith('support:kpis:current');
    });

    it('should handle errors gracefully', async () => {
      (SupportTicket.countDocuments as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(supportMetricsService.getSupportKPIs(mockTimeRange))
        .rejects.toThrow('Failed to calculate support KPIs');
    });
  });

  describe('getSupportAnalytics', () => {
    const mockAnalytics = {
      timeRange: mockTimeRange,
      kpis: mockKPIs,
      ticketDistribution: {
        byStatus: [
          { status: 'open', count: 30, percentage: 30 },
          { status: 'resolved', count: 60, percentage: 60 },
          { status: 'closed', count: 10, percentage: 10 }
        ],
        byPriority: [
          { priority: 'low', count: 40, percentage: 40 },
          { priority: 'medium', count: 35, percentage: 35 },
          { priority: 'high', count: 20, percentage: 20 },
          { priority: 'critical', count: 5, percentage: 5 }
        ],
        byCategory: [
          { category: 'technical', count: 50, percentage: 50 },
          { category: 'billing', count: 30, percentage: 30 },
          { category: 'general', count: 20, percentage: 20 }
        ]
      },
      performanceMetrics: {
        responseTimeDistribution: [],
        resolutionTimeDistribution: [],
        slaCompliance: {
          responseTime: { met: 85, missed: 15, percentage: 85 },
          resolutionTime: { met: 90, missed: 10, percentage: 90 }
        }
      },
      agentAnalytics: {
        workload: [],
        performance: []
      },
      customerInsights: {
        satisfactionDistribution: [],
        topIssues: [],
        repeatCustomers: []
      }
    };

    beforeEach(() => {
      // Mock all the required methods
      (SupportTicket.countDocuments as jest.Mock).mockResolvedValue(100);
      (SupportTicket.aggregate as jest.Mock).mockResolvedValue([]);
      (User.countDocuments as jest.Mock).mockResolvedValue(10);
      (KnowledgeBaseArticle.countDocuments as jest.Mock).mockResolvedValue(50);
      (KnowledgeBaseArticle.aggregate as jest.Mock).mockResolvedValue([]);
    });

    it('should return comprehensive support analytics', async () => {
      const result = await supportMetricsService.getSupportAnalytics(mockTimeRange);

      expect(result).toHaveProperty('timeRange');
      expect(result).toHaveProperty('kpis');
      expect(result).toHaveProperty('ticketDistribution');
      expect(result).toHaveProperty('performanceMetrics');
      expect(result).toHaveProperty('agentAnalytics');
      expect(result).toHaveProperty('customerInsights');
      expect(result.timeRange).toEqual(mockTimeRange);
    });

    it('should use cache when available', async () => {
      mockCacheService.get.mockResolvedValue(mockAnalytics);

      const result = await supportMetricsService.getSupportAnalytics(mockTimeRange);

      expect(result).toEqual(mockAnalytics);
      expect(SupportTicket.countDocuments).not.toHaveBeenCalled();
    });

    it('should cache the calculated analytics', async () => {
      await supportMetricsService.getSupportAnalytics(mockTimeRange);

      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        { ttl: 900 }
      );
    });

    it('should handle errors gracefully', async () => {
      (SupportTicket.countDocuments as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(supportMetricsService.getSupportAnalytics(mockTimeRange))
        .rejects.toThrow('Failed to calculate support analytics');
    });
  });

  describe('getAgentPerformance', () => {
    const mockAgentPerformance = [
      {
        agentId: 'agent1',
        agentName: 'John Doe',
        ticketsAssigned: 25,
        ticketsResolved: 22,
        averageResponseTime: 3.5,
        averageResolutionTime: 18,
        customerSatisfactionScore: 4.5,
        resolutionRate: 88
      },
      {
        agentId: 'agent2',
        agentName: 'Jane Smith',
        ticketsAssigned: 30,
        ticketsResolved: 28,
        averageResponseTime: 2.8,
        averageResolutionTime: 16,
        customerSatisfactionScore: 4.7,
        resolutionRate: 93
      }
    ];

    beforeEach(() => {
      (SupportTicket.aggregate as jest.Mock).mockResolvedValue([
        {
          _id: new mongoose.Types.ObjectId(),
          ticketsAssigned: 25,
          ticketsResolved: 22,
          avgResponseTime: 3.5,
          avgResolutionTime: 18,
          avgSatisfaction: 4.5,
          agent: { firstName: 'John', lastName: 'Doe' }
        }
      ]);
    });

    it('should return agent performance metrics', async () => {
      const result = await supportMetricsService.getAgentPerformance();

      expect(Array.isArray(result)).toBe(true);
      expect(SupportTicket.aggregate).toHaveBeenCalled();
    });

    it('should filter by specific agent when provided', async () => {
      const agentId = 'agent123';
      
      await supportMetricsService.getAgentPerformance(agentId, mockTimeRange);

      expect(mockCacheService.get).toHaveBeenCalledWith(
        expect.stringContaining(agentId)
      );
    });

    it('should use cache when available', async () => {
      mockCacheService.get.mockResolvedValue(mockAgentPerformance);

      const result = await supportMetricsService.getAgentPerformance();

      expect(result).toEqual(mockAgentPerformance);
      expect(SupportTicket.aggregate).not.toHaveBeenCalled();
    });

    it('should cache the calculated performance', async () => {
      await supportMetricsService.getAgentPerformance();

      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        { ttl: 600 }
      );
    });

    it('should handle errors gracefully', async () => {
      (SupportTicket.aggregate as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(supportMetricsService.getAgentPerformance())
        .rejects.toThrow('Failed to calculate agent performance');
    });
  });

  describe('getSupportTrends', () => {
    const mockTrends = [
      { date: new Date('2024-01-01'), value: 10, label: 'Day 1' },
      { date: new Date('2024-01-02'), value: 15, label: 'Day 2' },
      { date: new Date('2024-01-03'), value: 12, label: 'Day 3' }
    ];

    it('should return support trends for tickets metric', async () => {
      const result = await supportMetricsService.getSupportTrends(
        'tickets',
        mockTimeRange,
        'day'
      );

      expect(Array.isArray(result)).toBe(true);
    });

    it('should return support trends for resolution_time metric', async () => {
      const result = await supportMetricsService.getSupportTrends(
        'resolution_time',
        mockTimeRange,
        'week'
      );

      expect(Array.isArray(result)).toBe(true);
    });

    it('should return support trends for satisfaction metric', async () => {
      const result = await supportMetricsService.getSupportTrends(
        'satisfaction',
        mockTimeRange,
        'month'
      );

      expect(Array.isArray(result)).toBe(true);
    });

    it('should use cache when available', async () => {
      mockCacheService.get.mockResolvedValue(mockTrends);

      const result = await supportMetricsService.getSupportTrends(
        'tickets',
        mockTimeRange,
        'day'
      );

      expect(result).toEqual(mockTrends);
    });

    it('should cache the calculated trends', async () => {
      await supportMetricsService.getSupportTrends('tickets', mockTimeRange, 'day');

      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        { ttl: 3600 }
      );
    });

    it('should handle errors gracefully', async () => {
      // Mock the private method to throw an error
      jest.spyOn(supportMetricsService as any, 'calculateTrends')
        .mockRejectedValue(new Error('Calculation error'));

      await expect(supportMetricsService.getSupportTrends('tickets', mockTimeRange))
        .rejects.toThrow('Failed to calculate support trends');
    });
  });

  describe('getSLACompliance', () => {
    const mockSLACompliance = {
      responseTime: { met: 85, missed: 15, percentage: 85 },
      resolutionTime: { met: 90, missed: 10, percentage: 90 },
      byPriority: [
        { priority: 'critical', responseTimeSLA: 95, resolutionTimeSLA: 90 },
        { priority: 'high', responseTimeSLA: 88, resolutionTimeSLA: 85 },
        { priority: 'medium', responseTimeSLA: 82, resolutionTimeSLA: 80 },
        { priority: 'low', responseTimeSLA: 75, resolutionTimeSLA: 70 }
      ]
    };

    beforeEach(() => {
      // Mock SLA calculation methods
      jest.spyOn(supportMetricsService as any, 'calculateResponseTimeSLA')
        .mockResolvedValue({ met: 85, missed: 15, percentage: 85 });
      jest.spyOn(supportMetricsService as any, 'calculateResolutionTimeSLA')
        .mockResolvedValue({ met: 90, missed: 10, percentage: 90 });
      jest.spyOn(supportMetricsService as any, 'calculateSLAByPriority')
        .mockResolvedValue(mockSLACompliance.byPriority);
    });

    it('should return SLA compliance report', async () => {
      const result = await supportMetricsService.getSLACompliance(mockTimeRange);

      expect(result).toHaveProperty('responseTime');
      expect(result).toHaveProperty('resolutionTime');
      expect(result).toHaveProperty('byPriority');
      expect(result.responseTime.percentage).toBe(85);
      expect(result.resolutionTime.percentage).toBe(90);
      expect(Array.isArray(result.byPriority)).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      jest.spyOn(supportMetricsService as any, 'calculateResponseTimeSLA')
        .mockRejectedValue(new Error('SLA calculation error'));

      await expect(supportMetricsService.getSLACompliance(mockTimeRange))
        .rejects.toThrow('Failed to calculate SLA compliance');
    });
  });

  describe('Private Helper Methods', () => {
    describe('getTicketCounts', () => {
      beforeEach(() => {
        (SupportTicket.countDocuments as jest.Mock).mockResolvedValue(100);
        (SupportTicket.aggregate as jest.Mock)
          .mockResolvedValueOnce([
            { _id: 'open', count: 30 },
            { _id: 'resolved', count: 60 },
            { _id: 'closed', count: 10 }
          ])
          .mockResolvedValueOnce([
            { _id: 'critical', count: 5 },
            { _id: 'high', count: 20 },
            { _id: 'medium', count: 35 },
            { _id: 'low', count: 40 }
          ]);
      });

      it('should calculate ticket counts correctly', async () => {
        const dateFilter = {
          createdAt: {
            $gte: mockTimeRange.startDate,
            $lte: mockTimeRange.endDate
          }
        };

        const result = await (supportMetricsService as any).getTicketCounts(dateFilter);

        expect(result.totalTickets).toBe(100);
        expect(result.openTickets).toBe(30);
        expect(result.resolvedTickets).toBe(60);
        expect(result.closedTickets).toBe(10);
        expect(result.criticalTickets).toBe(5);
      });
    });

    describe('getResponseTimeStats', () => {
      beforeEach(() => {
        (SupportTicket.aggregate as jest.Mock).mockResolvedValue([
          {
            avgResponseTime: 4.5,
            tickets: [
              { responseTime: 2, priority: 'high' },
              { responseTime: 6, priority: 'medium' },
              { responseTime: 1, priority: 'critical' }
            ]
          }
        ]);
      });

      it('should calculate response time statistics', async () => {
        const dateFilter = {};
        const result = await (supportMetricsService as any).getResponseTimeStats(dateFilter);

        expect(result.averageResponseTime).toBe(5); // Rounded from 4.5
        expect(result.firstResponseSLA).toBeGreaterThanOrEqual(0);
        expect(result.firstResponseSLA).toBeLessThanOrEqual(100);
      });

      it('should handle no response time data', async () => {
        (SupportTicket.aggregate as jest.Mock).mockResolvedValue([]);

        const result = await (supportMetricsService as any).getResponseTimeStats({});

        expect(result.averageResponseTime).toBe(0);
        expect(result.firstResponseSLA).toBe(0);
      });
    });

    describe('getResolutionTimeStats', () => {
      beforeEach(() => {
        (SupportTicket.aggregate as jest.Mock).mockResolvedValue([
          {
            avgResolutionTime: 24.5,
            tickets: [
              { resolutionTime: 12, priority: 'high' },
              { resolutionTime: 36, priority: 'medium' },
              { resolutionTime: 2, priority: 'critical' }
            ]
          }
        ]);
      });

      it('should calculate resolution time statistics', async () => {
        const dateFilter = {};
        const result = await (supportMetricsService as any).getResolutionTimeStats(dateFilter);

        expect(result.averageResolutionTime).toBe(25); // Rounded from 24.5
        expect(result.resolutionSLA).toBeGreaterThanOrEqual(0);
        expect(result.resolutionSLA).toBeLessThanOrEqual(100);
      });

      it('should handle no resolution time data', async () => {
        (SupportTicket.aggregate as jest.Mock).mockResolvedValue([]);

        const result = await (supportMetricsService as any).getResolutionTimeStats({});

        expect(result.averageResolutionTime).toBe(0);
        expect(result.resolutionSLA).toBe(0);
      });
    });

    describe('getSatisfactionStats', () => {
      beforeEach(() => {
        (SupportTicket.aggregate as jest.Mock).mockResolvedValue([
          { avgSatisfaction: 4.2 }
        ]);
      });

      it('should calculate satisfaction statistics', async () => {
        const dateFilter = {};
        const result = await (supportMetricsService as any).getSatisfactionStats(dateFilter);

        expect(result.customerSatisfactionScore).toBe(84); // 4.2 * 20 = 84
      });

      it('should handle no satisfaction data', async () => {
        (SupportTicket.aggregate as jest.Mock).mockResolvedValue([]);

        const result = await (supportMetricsService as any).getSatisfactionStats({});

        expect(result.customerSatisfactionScore).toBe(0);
      });
    });

    describe('getEscalationStats', () => {
      beforeEach(() => {
        (SupportTicket.countDocuments as jest.Mock)
          .mockResolvedValueOnce(100) // Total tickets
          .mockResolvedValueOnce(8)   // Escalated tickets
          .mockResolvedValueOnce(60)  // Resolved tickets
          .mockResolvedValueOnce(2);  // Reopened tickets
      });

      it('should calculate escalation and reopen rates', async () => {
        const dateFilter = {};
        const result = await (supportMetricsService as any).getEscalationStats(dateFilter);

        expect(result.escalationRate).toBe(8); // 8/100 * 100 = 8%
        expect(result.reopenRate).toBe(3);     // 2/60 * 100 = 3.33% rounded to 3%
      });

      it('should handle zero tickets', async () => {
        (SupportTicket.countDocuments as jest.Mock)
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(0);

        const result = await (supportMetricsService as any).getEscalationStats({});

        expect(result.escalationRate).toBe(0);
        expect(result.reopenRate).toBe(0);
      });
    });
  });

  describe('SLA Thresholds', () => {
    it('should have correct SLA thresholds defined', () => {
      const thresholds = (supportMetricsService as any).SLA_THRESHOLDS;

      expect(thresholds.responseTime.critical).toBe(1);
      expect(thresholds.responseTime.high).toBe(4);
      expect(thresholds.responseTime.medium).toBe(24);
      expect(thresholds.responseTime.low).toBe(72);

      expect(thresholds.resolutionTime.critical).toBe(4);
      expect(thresholds.resolutionTime.high).toBe(24);
      expect(thresholds.resolutionTime.medium).toBe(72);
      expect(thresholds.resolutionTime.low).toBe(168);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = SupportMetricsService.getInstance();
      const instance2 = SupportMetricsService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });
});