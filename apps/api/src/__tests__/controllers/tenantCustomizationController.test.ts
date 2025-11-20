/// <reference types="jest" />
import { Request, Response } from 'express';
import { SaasTenantManagementController } from '../../controllers/saasTenantManagementController';
import { tenantManagementService } from '../../services/TenantManagementService';
import { validateObjectId } from '../../utils/validation';

// Mock dependencies
jest.mock('../../services/TenantManagementService');
jest.mock('../../utils/validation');
jest.mock('../../utils/logger');

const mockTenantManagementService = tenantManagementService as jest.Mocked<typeof tenantManagementService>;

// Add missing mock methods
(mockTenantManagementService as any).getTenantById = jest.fn();
const mockValidateObjectId = validateObjectId as jest.MockedFunction<typeof validateObjectId>;

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

describe('SaasTenantManagementController - Customization', () => {
  let controller: SaasTenantManagementController;
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    controller = new SaasTenantManagementController();
    
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    
    mockRequest = {
      user: { id: 'admin123', role: 'super_admin' },
      params: { tenantId: 'tenant123' },
      body: {},
    };
    
    mockResponse = {
      json: mockJson,
      status: mockStatus,
    };

    jest.clearAllMocks();
  });

  describe('updateTenantBranding', () => {
    it('should update tenant branding successfully', async () => {
      const brandingData = {
        primaryColor: '#FF5722',
        secondaryColor: '#FFC107',
        fontFamily: 'Roboto, sans-serif',
      };

      const mockTenant = {
        _id: 'tenant123',
        name: 'Test Pharmacy',
        branding: brandingData,
      };

      mockRequest.body = brandingData;
      mockValidateObjectId.mockReturnValue(true);
      mockTenantManagementService.updateTenantBranding.mockResolvedValue(mockTenant as any);

      await controller.updateTenantBranding(mockRequest as Request, mockResponse as Response);

      expect(mockTenantManagementService.updateTenantBranding).toHaveBeenCalledWith(
        'tenant123',
        brandingData,
        'admin123'
      );
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: {
          tenant: mockTenant,
        },
      });
    });

    it('should return 401 if user not authenticated', async () => {
      mockRequest.user = undefined;

      await controller.updateTenantBranding(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    });

    it('should return 400 for invalid tenant ID', async () => {
      mockValidateObjectId.mockReturnValue(false);

      await controller.updateTenantBranding(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid tenant ID',
        },
      });
    });

    it('should handle service errors', async () => {
      mockValidateObjectId.mockReturnValue(true);
      mockTenantManagementService.updateTenantBranding.mockRejectedValue(new Error('Service error'));

      await controller.updateTenantBranding(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'BRANDING_UPDATE_FAILED',
          message: 'Service error',
        },
      });
    });
  });

  describe('updateTenantLimits', () => {
    it('should update tenant limits successfully', async () => {
      const limitsData = {
        maxUsers: 20,
        maxPatients: 2000,
        storageLimit: 10000,
      };

      const mockTenant = {
        _id: 'tenant123',
        name: 'Test Pharmacy',
        limits: limitsData,
      };

      mockRequest.body = limitsData;
      mockValidateObjectId.mockReturnValue(true);
      mockTenantManagementService.updateTenantLimits.mockResolvedValue(mockTenant as any);

      await controller.updateTenantLimits(mockRequest as Request, mockResponse as Response);

      expect(mockTenantManagementService.updateTenantLimits).toHaveBeenCalledWith(
        'tenant123',
        limitsData,
        'admin123'
      );
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: {
          tenant: mockTenant,
        },
      });
    });
  });

  describe('updateTenantFeatures', () => {
    it('should update tenant features successfully', async () => {
      const featuresData = {
        features: ['patient-management', 'ai-diagnostics', 'reports-analytics'],
      };

      const mockTenant = {
        _id: 'tenant123',
        name: 'Test Pharmacy',
        features: featuresData.features,
      };

      mockRequest.body = featuresData;
      mockValidateObjectId.mockReturnValue(true);
      mockTenantManagementService.updateTenantFeatures.mockResolvedValue(mockTenant as any);

      await controller.updateTenantFeatures(mockRequest as Request, mockResponse as Response);

      expect(mockTenantManagementService.updateTenantFeatures).toHaveBeenCalledWith(
        'tenant123',
        featuresData.features,
        'admin123'
      );
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: {
          tenant: mockTenant,
        },
      });
    });

    it('should return 400 if features is not an array', async () => {
      mockRequest.body = { features: 'not-an-array' };
      mockValidateObjectId.mockReturnValue(true);

      await controller.updateTenantFeatures(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Features must be an array',
        },
      });
    });
  });

  describe('updateTenantCustomization', () => {
    it('should update comprehensive customization successfully', async () => {
      const customizationData = {
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

      const mockTenant = {
        _id: 'tenant123',
        name: 'Test Pharmacy',
        ...customizationData,
      };

      mockRequest.body = customizationData;
      mockValidateObjectId.mockReturnValue(true);
      mockTenantManagementService.updateTenantCustomization.mockResolvedValue(mockTenant as any);

      await controller.updateTenantCustomization(mockRequest as Request, mockResponse as Response);

      expect(mockTenantManagementService.updateTenantCustomization).toHaveBeenCalledWith(
        'tenant123',
        customizationData,
        'admin123'
      );
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: {
          tenant: mockTenant,
        },
      });
    });
  });

  describe('getTenantCustomization', () => {
    it('should get tenant customization successfully', async () => {
      const mockCustomization = {
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
          lastCalculatedAt: '2024-01-01T00:00:00.000Z',
        },
      };

      mockValidateObjectId.mockReturnValue(true);
      mockTenantManagementService.getTenantById.mockResolvedValue({
        branding: mockCustomization.branding,
        settings: mockCustomization.settings,
      } as any);

      await controller.getTenantCustomization(mockRequest as Request, mockResponse as Response);

      expect(mockTenantManagementService.getTenantById).toHaveBeenCalledWith('tenant123');
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: {
          customization: {
            branding: mockCustomization.branding,
            settings: mockCustomization.settings,
          },
        },
      });
    });

    it('should handle service errors', async () => {
      mockValidateObjectId.mockReturnValue(true);
      mockTenantManagementService.getTenantById.mockRejectedValue(new Error('Tenant not found'));

      await controller.getTenantCustomization(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'CUSTOMIZATION_FETCH_FAILED',
          message: 'Tenant not found',
        },
      });
    });
  });
});