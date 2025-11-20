/// <reference types="jest" />
import mongoose from 'mongoose';
import { tenantManagementService } from '../../services/TenantManagementService';
import { Tenant } from '../../models/Tenant';
import User from '../../models/User';

// Mock dependencies
jest.mock('../../models/Tenant');
jest.mock('../../models/User');
jest.mock('../../utils/logger');

const mockTenant = Tenant as jest.Mocked<typeof Tenant>;
const mockUser = User as jest.Mocked<typeof User>;

describe('TenantManagementService - Analytics', () => {
  const mockTenantId = new mongoose.Types.ObjectId().toString();

  const mockTenantData = {
    _id: mockTenantId,
    name: 'Test Pharmacy',
    slug: 'test-pharmacy',
    type: 'pharmacy',
    status: 'active',
    features: ['patient-management', 'prescription-processing', 'ai-diagnostics'],
    limits: {
      maxUsers: 10,
      maxPatients: 1000,
      storageLimit: 5000,
      apiCallsPerMonth: 10000,
      maxWorkspaces: 1,
      maxIntegrations: 5,
    },
    usageMetrics: {
      currentUsers: 5,
      currentPatients: 500,
      storageUsed: 2500,
      apiCallsThisMonth: 5000,
      lastCalculatedAt: new Date(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getTenantAnalytics', () => {
    it('should return comprehensive analytics for 30d timeframe', async () => {
      mockTenant.findById.mockResolvedValue(mockTenantData as any);
      mockUser.countDocuments.mockResolvedValue(5);

      const result = await tenantManagementService.getTenantAnalytics(mockTenantId, '30d');

      expect(mockTenant.findById).toHaveBeenCalledWith(mockTenantId);
      expect(mockUser.countDocuments).toHaveBeenCalledWith({
        workplaceId: mockTenantData._id,
        status: 'active',
      });

      expect(result).toHaveProperty('usage');
      expect(result).toHaveProperty('performance');
      expect(result).toHaveProperty('billing');
      expect(result).toHaveProperty('features');

      // Check usage metrics
      expect(result.usage.users.current).toBe(5);
      expect(result.usage.patients.current).toBe(500);
      expect(result.usage.storage.current).toBe(2500);
      expect(result.usage.apiCalls.current).toBe(5000);

      // Check that history arrays are populated
      expect(result.usage.users.history).toHaveLength(31); // 30 days + current
      expect(result.usage.patients.history).toHaveLength(31);
      expect(result.usage.storage.history).toHaveLength(31);
      expect(result.usage.apiCalls.history).toHaveLength(31);

      // Check performance metrics
      expect(result.performance.responseTime).toHaveProperty('average');
      expect(result.performance.responseTime).toHaveProperty('p95');
      expect(result.performance.responseTime).toHaveProperty('trend');
      expect(result.performance.uptime).toHaveProperty('percentage');
      expect(result.performance.errorRate).toHaveProperty('percentage');

      // Check billing metrics
      expect(result.billing.currentCost).toBeGreaterThan(0);
      expect(result.billing.projectedCost).toBeGreaterThan(result.billing.currentCost);
      expect(result.billing.costBreakdown).toHaveLength(3);

      // Check features
      expect(result.features.mostUsed).toBeDefined();
      expect(result.features.leastUsed).toBeDefined();
    });

    it('should return analytics for different time ranges', async () => {
      mockTenant.findById.mockResolvedValue(mockTenantData as any);
      mockUser.countDocuments.mockResolvedValue(5);

      const result7d = await tenantManagementService.getTenantAnalytics(mockTenantId, '7d');
      const result90d = await tenantManagementService.getTenantAnalytics(mockTenantId, '90d');
      const result1y = await tenantManagementService.getTenantAnalytics(mockTenantId, '1y');

      expect(result7d.usage.users.history).toHaveLength(8); // 7 days + current
      expect(result90d.usage.users.history).toHaveLength(91); // 90 days + current
      expect(result1y.usage.users.history).toHaveLength(366); // 365 days + current
    });

    it('should throw error if tenant not found', async () => {
      mockTenant.findById.mockResolvedValue(null);

      await expect(
        tenantManagementService.getTenantAnalytics(mockTenantId, '30d')
      ).rejects.toThrow('Tenant not found');
    });

    it('should calculate cost breakdown correctly', async () => {
      mockTenant.findById.mockResolvedValue(mockTenantData as any);
      mockUser.countDocuments.mockResolvedValue(5);

      const result = await tenantManagementService.getTenantAnalytics(mockTenantId, '30d');

      const breakdown = result.billing.costBreakdown;
      const totalPercentage = breakdown.reduce((sum, item) => sum + item.percentage, 0);
      
      expect(totalPercentage).toBeCloseTo(100, 1); // Should sum to ~100%
      expect(breakdown).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ category: 'Users' }),
          expect.objectContaining({ category: 'Storage' }),
          expect.objectContaining({ category: 'API Calls' }),
        ])
      );
    });
  });

  describe('getTenantPerformanceMetrics', () => {
    it('should return real-time performance metrics', async () => {
      mockTenant.findById.mockResolvedValue(mockTenantData as any);

      const result = await tenantManagementService.getTenantPerformanceMetrics(mockTenantId);

      expect(result).toHaveProperty('realTime');
      expect(result).toHaveProperty('alerts');
      expect(result).toHaveProperty('systemHealth');

      // Check real-time metrics
      expect(result.realTime.activeUsers).toBeLessThanOrEqual(mockTenantData.usageMetrics.currentUsers);
      expect(result.realTime.requestsPerSecond).toBeGreaterThan(0);
      expect(result.realTime.averageResponseTime).toBeGreaterThan(0);
      expect(result.realTime.errorRate).toBeGreaterThanOrEqual(0);

      // Check system health
      expect(result.systemHealth.cpu).toHaveProperty('usage');
      expect(result.systemHealth.cpu).toHaveProperty('status');
      expect(result.systemHealth.memory).toHaveProperty('usage');
      expect(result.systemHealth.memory).toHaveProperty('status');
      expect(result.systemHealth.disk).toHaveProperty('usage');
      expect(result.systemHealth.disk).toHaveProperty('status');
      expect(result.systemHealth.network).toHaveProperty('latency');
      expect(result.systemHealth.network).toHaveProperty('status');

      // Check alerts array
      expect(Array.isArray(result.alerts)).toBe(true);
    });

    it('should generate storage alert when usage is high', async () => {
      const highStorageTenant = {
        ...mockTenantData,
        usageMetrics: {
          ...mockTenantData.usageMetrics,
          storageUsed: 4800, // 96% of 5000 limit
        },
      };

      mockTenant.findById.mockResolvedValue(highStorageTenant as any);

      const result = await tenantManagementService.getTenantPerformanceMetrics(mockTenantId);

      const storageAlert = result.alerts.find(alert => 
        alert.message.includes('Storage usage is above 90%')
      );
      expect(storageAlert).toBeDefined();
      expect(storageAlert?.type).toBe('critical');
    });

    it('should throw error if tenant not found', async () => {
      mockTenant.findById.mockResolvedValue(null);

      await expect(
        tenantManagementService.getTenantPerformanceMetrics(mockTenantId)
      ).rejects.toThrow('Tenant not found');
    });
  });

  describe('getTenantBillingAnalytics', () => {
    it('should return comprehensive billing analytics', async () => {
      mockTenant.findById.mockResolvedValue(mockTenantData as any);

      const result = await tenantManagementService.getTenantBillingAnalytics(mockTenantId, '30d');

      expect(result).toHaveProperty('currentPeriod');
      expect(result).toHaveProperty('trends');
      expect(result).toHaveProperty('optimization');

      // Check current period
      expect(result.currentPeriod.totalCost).toBeGreaterThan(0);
      expect(result.currentPeriod.breakdown).toHaveLength(3);
      expect(result.currentPeriod.usage).toHaveLength(3);

      // Check trends
      expect(result.trends.costHistory).toHaveLength(31); // 30 days + current
      expect(result.trends.usageHistory).toHaveLength(31);
      expect(result.trends.projections).toHaveProperty('nextMonth');
      expect(result.trends.projections).toHaveProperty('nextQuarter');
      expect(result.trends.projections).toHaveProperty('nextYear');

      // Check optimization
      expect(Array.isArray(result.optimization.recommendations)).toBe(true);
      expect(Array.isArray(result.optimization.unusedFeatures)).toBe(true);
      expect(Array.isArray(result.optimization.overageAlerts)).toBe(true);
    });

    it('should detect overage alerts', async () => {
      const overageTenant = {
        ...mockTenantData,
        usageMetrics: {
          ...mockTenantData.usageMetrics,
          currentUsers: 15, // Exceeds limit of 10
          storageUsed: 6000, // Exceeds limit of 5000
        },
      };

      mockTenant.findById.mockResolvedValue(overageTenant as any);

      const result = await tenantManagementService.getTenantBillingAnalytics(mockTenantId, '30d');

      expect(result.optimization.overageAlerts).toHaveLength(2);
      
      const userOverage = result.optimization.overageAlerts.find(alert => alert.metric === 'Users');
      const storageOverage = result.optimization.overageAlerts.find(alert => alert.metric === 'Storage');
      
      expect(userOverage).toBeDefined();
      expect(userOverage?.overage).toBe(5); // 15 - 10
      
      expect(storageOverage).toBeDefined();
      expect(storageOverage?.overage).toBe(1000); // 6000 - 5000
    });

    it('should generate downgrade recommendation for underutilized tenants', async () => {
      const underutilizedTenant = {
        ...mockTenantData,
        usageMetrics: {
          ...mockTenantData.usageMetrics,
          currentUsers: 3, // Only 30% of 10 user limit
        },
      };

      mockTenant.findById.mockResolvedValue(underutilizedTenant as any);

      const result = await tenantManagementService.getTenantBillingAnalytics(mockTenantId, '30d');

      const downgradeRecommendation = result.optimization.recommendations.find(rec => 
        rec.type === 'Downgrade Plan'
      );
      expect(downgradeRecommendation).toBeDefined();
      expect(downgradeRecommendation?.potentialSavings).toBeGreaterThan(0);
    });

    it('should identify unused features', async () => {
      const limitedFeaturesTenant = {
        ...mockTenantData,
        features: ['patient-management'], // Only one feature enabled
      };

      mockTenant.findById.mockResolvedValue(limitedFeaturesTenant as any);

      const result = await tenantManagementService.getTenantBillingAnalytics(mockTenantId, '30d');

      expect(result.optimization.unusedFeatures.length).toBeGreaterThan(0);
      expect(result.optimization.unusedFeatures).toContain('prescription-processing');
      expect(result.optimization.unusedFeatures).toContain('inventory-management');
    });

    it('should handle different time ranges', async () => {
      mockTenant.findById.mockResolvedValue(mockTenantData as any);

      const result90d = await tenantManagementService.getTenantBillingAnalytics(mockTenantId, '90d');
      const result1y = await tenantManagementService.getTenantBillingAnalytics(mockTenantId, '1y');

      expect(result90d.trends.costHistory).toHaveLength(91); // 90 days + current
      expect(result1y.trends.costHistory).toHaveLength(366); // 365 days + current
    });

    it('should throw error if tenant not found', async () => {
      mockTenant.findById.mockResolvedValue(null);

      await expect(
        tenantManagementService.getTenantBillingAnalytics(mockTenantId, '30d')
      ).rejects.toThrow('Tenant not found');
    });
  });
});