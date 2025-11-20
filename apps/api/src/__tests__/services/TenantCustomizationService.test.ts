/// <reference types="jest" />
import mongoose from 'mongoose';
import { tenantManagementService, TenantBrandingUpdate, TenantLimitsUpdate, TenantCustomizationUpdate } from '../../services/TenantManagementService';
import { Tenant } from '../../models/Tenant';
import { SecurityAuditLog } from '../../models/SecurityAuditLog';

// Mock dependencies
jest.mock('../../models/Tenant');
jest.mock('../../models/SecurityAuditLog');
jest.mock('../../utils/logger');

const mockTenant = Tenant as jest.Mocked<typeof Tenant>;
const mockSecurityAuditLog = SecurityAuditLog as jest.Mocked<typeof SecurityAuditLog>;

describe('TenantManagementService - Customization', () => {
  const mockTenantId = new mongoose.Types.ObjectId().toString();
  const mockAdminId = new mongoose.Types.ObjectId().toString();

  let mockTenantData: any;

  beforeEach(() => {
    mockTenantData = {
      _id: mockTenantId,
      name: 'Test Pharmacy',
      slug: 'test-pharmacy',
      type: 'pharmacy',
      status: 'active',
      branding: {
        primaryColor: '#3B82F6',
        secondaryColor: '#6B7280',
        fontFamily: 'Inter, sans-serif',
      },
      limits: {
        maxUsers: 10,
        maxPatients: 1000,
        storageLimit: 5000,
        apiCallsPerMonth: 10000,
        maxWorkspaces: 1,
        maxIntegrations: 5,
      },
      features: ['patient-management', 'prescription-processing'],
      settings: {
        timezone: 'UTC',
        currency: 'USD',
        language: 'en',
        dateFormat: 'MM/DD/YYYY',
        timeFormat: '12h',
      },
      usageMetrics: {
        currentUsers: 5,
        currentPatients: 500,
        storageUsed: 2500,
        apiCallsThisMonth: 5000,
        lastCalculatedAt: new Date(),
      },
      lastModifiedBy: mockAdminId,
      lastActivity: new Date(),
      save: jest.fn().mockResolvedValue(true),
    };
    
    jest.clearAllMocks();
  });



  describe('updateTenantBranding', () => {
    it('should update tenant branding successfully', async () => {
      const brandingUpdate: TenantBrandingUpdate = {
        primaryColor: '#FF5722',
        secondaryColor: '#FFC107',
        fontFamily: 'Roboto, sans-serif',
      };

      mockTenant.findById.mockResolvedValue(mockTenantData as any);
      (mockSecurityAuditLog as any).createLog = jest.fn().mockResolvedValue(true);

      const result = await tenantManagementService.updateTenantBranding(
        mockTenantId,
        brandingUpdate,
        mockAdminId
      );

      expect(mockTenant.findById).toHaveBeenCalledWith(mockTenantId);
      expect(mockTenantData.save).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.branding.primaryColor).toBe('#FF5722');
    });

    it('should validate color formats', async () => {
      const invalidBrandingUpdate: TenantBrandingUpdate = {
        primaryColor: 'invalid-color',
      };

      mockTenant.findById.mockResolvedValue(mockTenantData as any);

      await expect(
        tenantManagementService.updateTenantBranding(
          mockTenantId,
          invalidBrandingUpdate,
          mockAdminId
        )
      ).rejects.toThrow('Invalid primaryColor format');
    });

    it('should throw error if tenant not found', async () => {
      mockTenant.findById.mockResolvedValue(null);

      await expect(
        tenantManagementService.updateTenantBranding(
          mockTenantId,
          { primaryColor: '#FF5722' },
          mockAdminId
        )
      ).rejects.toThrow('Tenant not found');
    });
  });

  describe('updateTenantLimits', () => {
    it('should update tenant limits successfully', async () => {
      const limitsUpdate: TenantLimitsUpdate = {
        maxUsers: 20,
        maxPatients: 2000,
        storageLimit: 10000,
      };

      mockTenant.findById.mockResolvedValue(mockTenantData as any);
      (mockSecurityAuditLog as any).createLog = jest.fn().mockResolvedValue(true);

      const result = await tenantManagementService.updateTenantLimits(
        mockTenantId,
        limitsUpdate,
        mockAdminId
      );

      expect(mockTenant.findById).toHaveBeenCalledWith(mockTenantId);
      expect(mockTenantData.save).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.limits.maxUsers).toBe(20);
    });

    it('should validate minimum limits', async () => {
      const invalidLimitsUpdate: TenantLimitsUpdate = {
        maxUsers: 0,
      };

      mockTenant.findById.mockResolvedValue(mockTenantData as any);

      await expect(
        tenantManagementService.updateTenantLimits(
          mockTenantId,
          invalidLimitsUpdate,
          mockAdminId
        )
      ).rejects.toThrow('maxUsers must be at least 1');
    });

    it('should prevent setting limits below current usage', async () => {
      const limitsUpdate: TenantLimitsUpdate = {
        maxUsers: 3, // Current usage is 5
      };

      mockTenant.findById.mockResolvedValue(mockTenantData as any);

      await expect(
        tenantManagementService.updateTenantLimits(
          mockTenantId,
          limitsUpdate,
          mockAdminId
        )
      ).rejects.toThrow('Current users (5) exceeds new limit (3)');
    });
  });

  describe('updateTenantFeatures', () => {
    it('should update tenant features successfully', async () => {
      const newFeatures = ['patient-management', 'prescription-processing', 'ai-diagnostics'];

      mockTenant.findById.mockResolvedValue(mockTenantData as any);
      (mockSecurityAuditLog as any).createLog = jest.fn().mockResolvedValue(true);

      const result = await tenantManagementService.updateTenantFeatures(
        mockTenantId,
        newFeatures,
        mockAdminId
      );

      expect(mockTenant.findById).toHaveBeenCalledWith(mockTenantId);
      expect(mockTenantData.save).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.features).toEqual(newFeatures);
    });

    it('should log feature changes in audit', async () => {
      const newFeatures = ['patient-management', 'ai-diagnostics'];

      mockTenant.findById.mockResolvedValue(mockTenantData as any);
      const mockCreateLog = jest.fn().mockResolvedValue(true);
      (mockSecurityAuditLog as any).createLog = mockCreateLog;

      await tenantManagementService.updateTenantFeatures(
        mockTenantId,
        newFeatures,
        mockAdminId
      );

      expect(mockCreateLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'tenant_features_updated',
          details: expect.objectContaining({
            tenantName: 'Test Pharmacy',
            previousFeatures: ['patient-management', 'prescription-processing'],
            newFeatures: ['patient-management', 'ai-diagnostics'],
          }),
        })
      );
    });
  });

  describe('updateTenantCustomization', () => {
    it('should update comprehensive customization successfully', async () => {
      const customization: TenantCustomizationUpdate = {
        branding: {
          primaryColor: '#FF5722',
          fontFamily: 'Roboto, sans-serif',
        },
        limits: {
          maxUsers: 15,
          storageLimit: 8000,
        },
        features: ['patient-management', 'ai-diagnostics'],
        settings: {
          timezone: 'America/New_York',
          currency: 'USD',
        },
      };

      // Mock session
      const mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn(),
      };
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession as any);

      mockTenant.findById.mockResolvedValue(mockTenantData as any);
      (mockSecurityAuditLog as any).createLog = jest.fn().mockResolvedValue(true);

      const result = await tenantManagementService.updateTenantCustomization(
        mockTenantId,
        customization,
        mockAdminId
      );

      expect(mockSession.startTransaction).toHaveBeenCalled();
      expect(mockSession.commitTransaction).toHaveBeenCalled();
      expect(mockTenantData.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should rollback transaction on error', async () => {
      const customization: TenantCustomizationUpdate = {
        branding: {
          primaryColor: 'invalid-color',
        },
      };

      // Mock session
      const mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn(),
      };
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession as any);

      mockTenant.findById.mockResolvedValue(mockTenantData as any);

      await expect(
        tenantManagementService.updateTenantCustomization(
          mockTenantId,
          customization,
          mockAdminId
        )
      ).rejects.toThrow();

      expect(mockSession.abortTransaction).toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();
    });
  });

  describe('getTenantCustomization', () => {
    it('should return tenant customization settings', async () => {
      mockTenant.findById.mockResolvedValue(mockTenantData as any);

      const result = await tenantManagementService.getTenantCustomization(mockTenantId);

      expect(mockTenant.findById).toHaveBeenCalledWith(mockTenantId);
      expect(result).toEqual({
        branding: mockTenantData.branding,
        limits: mockTenantData.limits,
        features: mockTenantData.features,
        settings: mockTenantData.settings,
        usageMetrics: mockTenantData.usageMetrics,
      });
    });

    it('should throw error if tenant not found', async () => {
      mockTenant.findById.mockResolvedValue(null);

      await expect(
        tenantManagementService.getTenantCustomization(mockTenantId)
      ).rejects.toThrow('Tenant not found');
    });
  });
});