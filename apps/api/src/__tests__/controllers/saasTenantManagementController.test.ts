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
const mockValidateObjectId = validateObjectId as jest.MockedFunction<typeof validateObjectId>;

// Extend Request interface to include user property
interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

describe('SaasTenantManagementController', () => {
  let controller: SaasTenantManagementController;
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    controller = new SaasTenantManagementController();
    
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    
    mockResponse = {
      json: mockJson,
      status: mockStatus,
    };

    mockRequest = {
      user: { id: 'admin123' },
      params: {},
      body: {},
      query: {},
    };

    jest.clearAllMocks();
  });

  describe('provisionTenant', () => {
    it('should successfully provision a tenant', async () => {
      const tenantData = {
        name: 'Test Pharmacy',
        type: 'pharmacy',
        contactInfo: {
          email: 'contact@testpharmacy.com',
          address: {
            street: '123 Main St',
            city: 'Test City',
            state: 'Test State',
            country: 'Test Country',
            postalCode: '12345',
          },
        },
        primaryContact: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@testpharmacy.com',
        },
        subscriptionPlanId: 'plan123',
      };

      const mockTenant = { _id: 'tenant123', ...tenantData };

      mockRequest.body = tenantData;
      mockValidateObjectId.mockReturnValue(true);
      mockTenantManagementService.provisionTenant.mockResolvedValue(mockTenant as any);

      await controller.provisionTenant(mockRequest as Request, mockResponse as Response);

      expect(mockTenantManagementService.provisionTenant).toHaveBeenCalledWith(
        tenantData,
        'admin123'
      );
      expect(mockStatus).toHaveBeenCalledWith(201);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: {
          tenant: mockTenant,
          message: 'Tenant provisioned successfully',
        },
      });
    });

    it('should return 401 if user is not authenticated', async () => {
      mockRequest.user = undefined;

      await controller.provisionTenant(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    });

    it('should return 400 if required fields are missing', async () => {
      mockRequest.body = { name: 'Test Pharmacy' }; // Missing required fields

      await controller.provisionTenant(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields: name, type, contactInfo, primaryContact, subscriptionPlanId',
        },
      });
    });

    it('should return 400 if subscription plan ID is invalid', async () => {
      mockRequest.body = {
        name: 'Test Pharmacy',
        type: 'pharmacy',
        contactInfo: { email: 'test@example.com' },
        primaryContact: { firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
        subscriptionPlanId: 'invalid-id',
      };

      mockValidateObjectId.mockReturnValue(false);

      await controller.provisionTenant(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid subscription plan ID',
        },
      });
    });

    it('should handle service errors', async () => {
      mockRequest.body = {
        name: 'Test Pharmacy',
        type: 'pharmacy',
        contactInfo: { email: 'test@example.com' },
        primaryContact: { firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
        subscriptionPlanId: 'plan123',
      };

      mockValidateObjectId.mockReturnValue(true);
      mockTenantManagementService.provisionTenant.mockRejectedValue(new Error('Service error'));

      await controller.provisionTenant(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'TENANT_PROVISIONING_FAILED',
          message: 'Service error',
        },
      });
    });
  });

  describe('deprovisionTenant', () => {
    it('should successfully deprovision a tenant', async () => {
      mockRequest.params = { tenantId: 'tenant123' };
      mockRequest.body = { deleteData: true, reason: 'Test reason' };
      mockValidateObjectId.mockReturnValue(true);
      mockTenantManagementService.deprovisionTenant.mockResolvedValue();

      await controller.deprovisionTenant(mockRequest as Request, mockResponse as Response);

      expect(mockTenantManagementService.deprovisionTenant).toHaveBeenCalledWith(
        'tenant123',
        'admin123',
        { deleteData: true, reason: 'Test reason', transferDataTo: undefined }
      );
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: {
          message: 'Tenant deprovisioned successfully',
        },
      });
    });

    it('should return 400 if tenant ID is invalid', async () => {
      mockRequest.params = { tenantId: 'invalid-id' };
      mockValidateObjectId.mockReturnValue(false);

      await controller.deprovisionTenant(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid tenant ID',
        },
      });
    });
  });

  describe('updateTenantStatus', () => {
    it('should successfully update tenant status', async () => {
      const mockTenant = { _id: 'tenant123', status: 'active' };
      
      mockRequest.params = { tenantId: 'tenant123' };
      mockRequest.body = { status: 'active', reason: 'Reactivation' };
      mockValidateObjectId.mockReturnValue(true);
      mockTenantManagementService.updateTenantStatus.mockResolvedValue(mockTenant as any);

      await controller.updateTenantStatus(mockRequest as Request, mockResponse as Response);

      expect(mockTenantManagementService.updateTenantStatus).toHaveBeenCalledWith(
        'tenant123',
        { status: 'active', reason: 'Reactivation', suspensionDetails: undefined },
        'admin123'
      );
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: {
          tenant: mockTenant,
          message: 'Tenant status updated successfully',
        },
      });
    });

    it('should return 400 if status is missing', async () => {
      mockRequest.params = { tenantId: 'tenant123' };
      mockRequest.body = {}; // Missing status
      mockValidateObjectId.mockReturnValue(true);

      await controller.updateTenantStatus(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Status is required',
        },
      });
    });

    it('should return 400 if status is invalid', async () => {
      mockRequest.params = { tenantId: 'tenant123' };
      mockRequest.body = { status: 'invalid-status' };
      mockValidateObjectId.mockReturnValue(true);

      await controller.updateTenantStatus(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid status. Must be one of: active, suspended, pending, trial, cancelled',
        },
      });
    });
  });

  describe('getTenantById', () => {
    it('should successfully get tenant by ID', async () => {
      const mockTenant = { _id: 'tenant123', name: 'Test Pharmacy' };
      
      mockRequest.params = { tenantId: 'tenant123' };
      mockRequest.query = { includeSettings: 'true', includeUsers: 'false' };
      mockValidateObjectId.mockReturnValue(true);
      mockTenantManagementService.getTenantById.mockResolvedValue(mockTenant as any);

      await controller.getTenantById(mockRequest as Request, mockResponse as Response);

      expect(mockTenantManagementService.getTenantById).toHaveBeenCalledWith(
        'tenant123',
        { includeSettings: true, includeUsers: false, includeUsage: false }
      );
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: {
          tenant: mockTenant,
        },
      });
    });

    it('should return 404 if tenant not found', async () => {
      mockRequest.params = { tenantId: 'tenant123' };
      mockValidateObjectId.mockReturnValue(true);
      mockTenantManagementService.getTenantById.mockResolvedValue(null);

      await controller.getTenantById(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'TENANT_NOT_FOUND',
          message: 'Tenant not found',
        },
      });
    });
  });

  describe('listTenants', () => {
    it('should successfully list tenants', async () => {
      const mockResult = {
        tenants: [{ _id: 'tenant1' }, { _id: 'tenant2' }],
        pagination: { page: 1, limit: 20, total: 2, pages: 1 },
      };

      mockRequest.query = {
        status: 'active',
        type: 'pharmacy',
        page: '1',
        limit: '20',
        sortBy: 'name',
        sortOrder: 'asc',
      };

      mockTenantManagementService.listTenants.mockResolvedValue(mockResult as any);

      await controller.listTenants(mockRequest as Request, mockResponse as Response);

      expect(mockTenantManagementService.listTenants).toHaveBeenCalledWith(
        {
          status: ['active'],
          type: ['pharmacy'],
        },
        {
          page: 1,
          limit: 20,
          sortBy: 'name',
          sortOrder: 'asc',
          includeUsage: false,
          includeSettings: false,
        }
      );
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockResult,
      });
    });

    it('should handle array filters', async () => {
      const mockResult = {
        tenants: [],
        pagination: { page: 1, limit: 20, total: 0, pages: 0 },
      };

      mockRequest.query = {
        status: ['active', 'pending'],
        type: ['pharmacy', 'clinic'],
      };

      mockTenantManagementService.listTenants.mockResolvedValue(mockResult as any);

      await controller.listTenants(mockRequest as Request, mockResponse as Response);

      expect(mockTenantManagementService.listTenants).toHaveBeenCalledWith(
        {
          status: ['active', 'pending'],
          type: ['pharmacy', 'clinic'],
        },
        expect.any(Object)
      );
    });
  });

  describe('updateTenantUsage', () => {
    it('should successfully update tenant usage', async () => {
      const mockTenant = { _id: 'tenant123', usageMetrics: { currentUsers: 5 } };
      
      mockRequest.params = { tenantId: 'tenant123' };
      mockRequest.body = { currentUsers: 5, storageUsed: 1000 };
      mockValidateObjectId.mockReturnValue(true);
      mockTenantManagementService.updateTenantUsage.mockResolvedValue(mockTenant as any);

      await controller.updateTenantUsage(mockRequest as Request, mockResponse as Response);

      expect(mockTenantManagementService.updateTenantUsage).toHaveBeenCalledWith(
        'tenant123',
        { currentUsers: 5, storageUsed: 1000, currentPatients: undefined, apiCallsThisMonth: undefined }
      );
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: {
          tenant: mockTenant,
          message: 'Tenant usage updated successfully',
        },
      });
    });
  });

  describe('validateDataIsolation', () => {
    it('should successfully validate data isolation', async () => {
      const mockResult = {
        isIsolated: true,
        violations: [],
        recommendations: [],
      };

      mockRequest.params = { tenantId: 'tenant123' };
      mockValidateObjectId.mockReturnValue(true);
      mockTenantManagementService.validateDataIsolation.mockResolvedValue(mockResult);

      await controller.validateDataIsolation(mockRequest as Request, mockResponse as Response);

      expect(mockTenantManagementService.validateDataIsolation).toHaveBeenCalledWith('tenant123');
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockResult,
      });
    });
  });

  describe('enforceDataIsolation', () => {
    it('should successfully enforce data isolation', async () => {
      const mockResult = {
        fixed: ['Fixed user assignment'],
        errors: [],
      };

      mockRequest.params = { tenantId: 'tenant123' };
      mockValidateObjectId.mockReturnValue(true);
      mockTenantManagementService.enforceDataIsolation.mockResolvedValue(mockResult);

      await controller.enforceDataIsolation(mockRequest as Request, mockResponse as Response);

      expect(mockTenantManagementService.enforceDataIsolation).toHaveBeenCalledWith('tenant123');
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: {
          ...mockResult,
          message: 'Data isolation enforcement completed',
        },
      });
    });
  });

  describe('getTenantStatistics', () => {
    it('should successfully get tenant statistics', async () => {
      const mockStatistics = {
        totalTenants: 10,
        activeTenants: 8,
        trialTenants: 2,
        suspendedTenants: 0,
        tenantsByType: { pharmacy: 6, clinic: 4 },
        tenantsByStatus: { active: 8, trial: 2 },
        averageUsersPerTenant: 5.5,
        tenantsExceedingLimits: 1,
      };

      mockTenantManagementService.getTenantStatistics.mockResolvedValue(mockStatistics);

      await controller.getTenantStatistics(mockRequest as Request, mockResponse as Response);

      expect(mockTenantManagementService.getTenantStatistics).toHaveBeenCalled();
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: {
          statistics: mockStatistics,
        },
      });
    });
  });
});