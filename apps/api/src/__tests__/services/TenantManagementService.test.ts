import { TenantManagementService } from '../../services/TenantManagementService';
import { Tenant } from '../../models/Tenant';
import { TenantSettings } from '../../models/TenantSettings';
import { User } from '../../models/User';
import { RedisCacheService } from '../../services/RedisCacheService';
import mongoose from 'mongoose';

// Mock dependencies
jest.mock('../../models/Tenant');
jest.mock('../../models/TenantSettings');
jest.mock('../../models/User');
jest.mock('../../services/RedisCacheService');
jest.mock('../../utils/logger');

describe('TenantManagementService', () => {
  let service: TenantManagementService;
  let mockCacheService: jest.Mocked<RedisCacheService>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      delPattern: jest.fn(),
    } as any;

    (RedisCacheService.getInstance as jest.Mock).mockReturnValue(mockCacheService);
    service = TenantManagementService.getInstance();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = TenantManagementService.getInstance();
      const instance2 = TenantManagementService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('createTenant', () => {
    it('should create tenant successfully', async () => {
      const tenantData = {
        name: 'Test Tenant',
        domain: 'test.example.com',
        plan: 'premium',
        adminEmail: 'admin@test.com'
      };

      const mockTenant = {
        _id: new mongoose.Types.ObjectId(),
        ...tenantData,
        save: jest.fn().mockResolvedValue(true)
      };

      const mockSettings = {
        save: jest.fn().mockResolvedValue(true)
      };

      (Tenant as any).mockImplementation(() => mockTenant);
      (TenantSettings as any).mockImplementation(() => mockSettings);

      const result = await service.createTenant(tenantData);

      expect(mockTenant.save).toHaveBeenCalled();
      expect(mockSettings.save).toHaveBeenCalled();
      expect(result).toEqual(mockTenant);
    });

    it('should handle duplicate domain error', async () => {
      const tenantData = {
        name: 'Test Tenant',
        domain: 'existing.example.com',
        plan: 'premium',
        adminEmail: 'admin@test.com'
      };

      const mockTenant = {
        save: jest.fn().mockRejectedValue({ code: 11000 })
      };

      (Tenant as any).mockImplementation(() => mockTenant);

      await expect(service.createTenant(tenantData)).rejects.toThrow('Domain already exists');
    });

    it('should handle general errors gracefully', async () => {
      const tenantData = {
        name: 'Test Tenant',
        domain: 'test.example.com',
        plan: 'premium',
        adminEmail: 'admin@test.com'
      };

      const mockTenant = {
        save: jest.fn().mockRejectedValue(new Error('Database error'))
      };

      (Tenant as any).mockImplementation(() => mockTenant);

      await expect(service.createTenant(tenantData)).rejects.toThrow('Failed to create tenant');
    });
  });

  describe('getTenants', () => {
    it('should return tenants with pagination', async () => {
      const mockTenants = [
        {
          _id: 'tenant1',
          name: 'Tenant 1',
          domain: 'tenant1.example.com',
          plan: 'premium',
          status: 'active'
        }
      ];

      (Tenant.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              skip: jest.fn().mockResolvedValue(mockTenants)
            })
          })
        })
      });

      (Tenant.countDocuments as jest.Mock).mockResolvedValue(1);

      const result = await service.getTenants({ page: 1, limit: 10 });

      expect(result.tenants).toEqual(mockTenants);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
    });

    it('should apply filters correctly', async () => {
      const filters = {
        status: 'active',
        plan: 'premium',
        search: 'test'
      };

      (Tenant.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              skip: jest.fn().mockResolvedValue([])
            })
          })
        })
      });

      (Tenant.countDocuments as jest.Mock).mockResolvedValue(0);

      await service.getTenants({ page: 1, limit: 10 }, filters);

      expect(Tenant.find).toHaveBeenCalledWith({
        status: 'active',
        plan: 'premium',
        $or: [
          { name: { $regex: 'test', $options: 'i' } },
          { domain: { $regex: 'test', $options: 'i' } }
        ]
      });
    });

    it('should handle errors gracefully', async () => {
      (Tenant.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              skip: jest.fn().mockRejectedValue(new Error('Database error'))
            })
          })
        })
      });

      await expect(service.getTenants({ page: 1, limit: 10 })).rejects.toThrow('Failed to retrieve tenants');
    });
  });

  describe('getTenantById', () => {
    it('should return cached tenant if available', async () => {
      const tenantId = 'tenant123';
      const cachedTenant = {
        _id: tenantId,
        name: 'Test Tenant',
        domain: 'test.example.com'
      };

      mockCacheService.get.mockResolvedValue(cachedTenant);

      const result = await service.getTenantById(tenantId);

      expect(mockCacheService.get).toHaveBeenCalledWith(`tenant:${tenantId}`);
      expect(result).toEqual(cachedTenant);
    });

    it('should fetch and cache tenant if not in cache', async () => {
      const tenantId = 'tenant123';
      const mockTenant = {
        _id: tenantId,
        name: 'Test Tenant',
        domain: 'test.example.com'
      };

      mockCacheService.get.mockResolvedValue(null);
      (Tenant.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockTenant)
      });

      const result = await service.getTenantById(tenantId);

      expect(Tenant.findById).toHaveBeenCalledWith(tenantId);
      expect(mockCacheService.set).toHaveBeenCalledWith(
        `tenant:${tenantId}`,
        mockTenant,
        60 * 60 * 1000
      );
      expect(result).toEqual(mockTenant);
    });

    it('should throw error if tenant not found', async () => {
      const tenantId = 'nonexistent';
      mockCacheService.get.mockResolvedValue(null);
      (Tenant.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(null)
      });

      await expect(service.getTenantById(tenantId)).rejects.toThrow('Tenant not found');
    });

    it('should handle errors gracefully', async () => {
      const tenantId = 'tenant123';
      mockCacheService.get.mockRejectedValue(new Error('Cache error'));

      await expect(service.getTenantById(tenantId)).rejects.toThrow('Failed to retrieve tenant');
    });
  });

  describe('updateTenant', () => {
    it('should update tenant successfully', async () => {
      const tenantId = 'tenant123';
      const updates = {
        name: 'Updated Tenant',
        plan: 'enterprise'
      };

      const mockTenant = {
        _id: tenantId,
        name: 'Old Name',
        plan: 'premium',
        save: jest.fn().mockResolvedValue(true)
      };

      (Tenant.findById as jest.Mock).mockResolvedValue(mockTenant);

      const result = await service.updateTenant(tenantId, updates);

      expect(mockTenant.name).toBe(updates.name);
      expect(mockTenant.plan).toBe(updates.plan);
      expect(mockTenant.save).toHaveBeenCalled();
      expect(mockCacheService.del).toHaveBeenCalledWith(`tenant:${tenantId}`);
      expect(result).toEqual(mockTenant);
    });

    it('should throw error if tenant not found', async () => {
      const tenantId = 'nonexistent';
      const updates = { name: 'Updated' };

      (Tenant.findById as jest.Mock).mockResolvedValue(null);

      await expect(service.updateTenant(tenantId, updates)).rejects.toThrow('Tenant not found');
    });

    it('should handle errors gracefully', async () => {
      const tenantId = 'tenant123';
      const updates = { name: 'Updated' };

      (Tenant.findById as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(service.updateTenant(tenantId, updates)).rejects.toThrow('Failed to update tenant');
    });
  });

  describe('deleteTenant', () => {
    it('should delete tenant successfully', async () => {
      const tenantId = 'tenant123';
      const mockTenant = {
        _id: tenantId,
        status: 'active'
      };

      (Tenant.findById as jest.Mock).mockResolvedValue(mockTenant);
      (Tenant.findByIdAndDelete as jest.Mock).mockResolvedValue(mockTenant);
      (User.deleteMany as jest.Mock).mockResolvedValue({ deletedCount: 5 });
      (TenantSettings.deleteOne as jest.Mock).mockResolvedValue({ deletedCount: 1 });

      await service.deleteTenant(tenantId);

      expect(Tenant.findByIdAndDelete).toHaveBeenCalledWith(tenantId);
      expect(User.deleteMany).toHaveBeenCalledWith({ tenantId });
      expect(TenantSettings.deleteOne).toHaveBeenCalledWith({ tenantId });
      expect(mockCacheService.del).toHaveBeenCalledWith(`tenant:${tenantId}`);
    });

    it('should throw error if tenant not found', async () => {
      const tenantId = 'nonexistent';
      (Tenant.findById as jest.Mock).mockResolvedValue(null);

      await expect(service.deleteTenant(tenantId)).rejects.toThrow('Tenant not found');
    });

    it('should handle errors gracefully', async () => {
      const tenantId = 'tenant123';
      (Tenant.findById as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(service.deleteTenant(tenantId)).rejects.toThrow('Failed to delete tenant');
    });
  });

  describe('suspendTenant', () => {
    it('should suspend tenant successfully', async () => {
      const tenantId = 'tenant123';
      const reason = 'Payment overdue';
      const mockTenant = {
        _id: tenantId,
        status: 'active',
        suspensionReason: '',
        suspendedAt: null,
        save: jest.fn().mockResolvedValue(true)
      };

      (Tenant.findById as jest.Mock).mockResolvedValue(mockTenant);

      await service.suspendTenant(tenantId, reason);

      expect(mockTenant.status).toBe('suspended');
      expect(mockTenant.suspensionReason).toBe(reason);
      expect(mockTenant.suspendedAt).toBeInstanceOf(Date);
      expect(mockTenant.save).toHaveBeenCalled();
      expect(mockCacheService.del).toHaveBeenCalledWith(`tenant:${tenantId}`);
    });

    it('should throw error if tenant not found', async () => {
      const tenantId = 'nonexistent';
      (Tenant.findById as jest.Mock).mockResolvedValue(null);

      await expect(service.suspendTenant(tenantId, 'reason')).rejects.toThrow('Tenant not found');
    });

    it('should handle errors gracefully', async () => {
      const tenantId = 'tenant123';
      (Tenant.findById as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(service.suspendTenant(tenantId, 'reason')).rejects.toThrow('Failed to suspend tenant');
    });
  });

  describe('reactivateTenant', () => {
    it('should reactivate tenant successfully', async () => {
      const tenantId = 'tenant123';
      const mockTenant = {
        _id: tenantId,
        status: 'suspended',
        suspensionReason: 'Payment overdue',
        suspendedAt: new Date(),
        save: jest.fn().mockResolvedValue(true)
      };

      (Tenant.findById as jest.Mock).mockResolvedValue(mockTenant);

      await service.reactivateTenant(tenantId);

      expect(mockTenant.status).toBe('active');
      expect(mockTenant.suspensionReason).toBe('');
      expect(mockTenant.suspendedAt).toBeNull();
      expect(mockTenant.save).toHaveBeenCalled();
      expect(mockCacheService.del).toHaveBeenCalledWith(`tenant:${tenantId}`);
    });

    it('should throw error if tenant not found', async () => {
      const tenantId = 'nonexistent';
      (Tenant.findById as jest.Mock).mockResolvedValue(null);

      await expect(service.reactivateTenant(tenantId)).rejects.toThrow('Tenant not found');
    });

    it('should handle errors gracefully', async () => {
      const tenantId = 'tenant123';
      (Tenant.findById as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(service.reactivateTenant(tenantId)).rejects.toThrow('Failed to reactivate tenant');
    });
  });

  describe('getTenantSettings', () => {
    it('should return cached settings if available', async () => {
      const tenantId = 'tenant123';
      const cachedSettings = {
        tenantId,
        branding: { logo: 'logo.png', primaryColor: '#000' },
        features: { analytics: true, reporting: true }
      };

      mockCacheService.get.mockResolvedValue(cachedSettings);

      const result = await service.getTenantSettings(tenantId);

      expect(mockCacheService.get).toHaveBeenCalledWith(`tenant:settings:${tenantId}`);
      expect(result).toEqual(cachedSettings);
    });

    it('should fetch and cache settings if not in cache', async () => {
      const tenantId = 'tenant123';
      const mockSettings = {
        tenantId,
        branding: { logo: 'logo.png', primaryColor: '#000' },
        features: { analytics: true, reporting: true }
      };

      mockCacheService.get.mockResolvedValue(null);
      (TenantSettings.findOne as jest.Mock).mockResolvedValue(mockSettings);

      const result = await service.getTenantSettings(tenantId);

      expect(TenantSettings.findOne).toHaveBeenCalledWith({ tenantId });
      expect(mockCacheService.set).toHaveBeenCalledWith(
        `tenant:settings:${tenantId}`,
        mockSettings,
        30 * 60 * 1000
      );
      expect(result).toEqual(mockSettings);
    });

    it('should create default settings if none exist', async () => {
      const tenantId = 'tenant123';
      mockCacheService.get.mockResolvedValue(null);
      (TenantSettings.findOne as jest.Mock).mockResolvedValue(null);

      const mockDefaultSettings = {
        tenantId,
        branding: {},
        features: {},
        save: jest.fn().mockResolvedValue(true)
      };

      (TenantSettings as any).mockImplementation(() => mockDefaultSettings);

      const result = await service.getTenantSettings(tenantId);

      expect(mockDefaultSettings.save).toHaveBeenCalled();
      expect(result).toEqual(mockDefaultSettings);
    });

    it('should handle errors gracefully', async () => {
      const tenantId = 'tenant123';
      mockCacheService.get.mockRejectedValue(new Error('Cache error'));

      await expect(service.getTenantSettings(tenantId)).rejects.toThrow('Failed to retrieve tenant settings');
    });
  });

  describe('updateTenantSettings', () => {
    it('should update settings successfully', async () => {
      const tenantId = 'tenant123';
      const updates = {
        branding: { logo: 'new-logo.png', primaryColor: '#ff0000' },
        features: { analytics: false, reporting: true }
      };

      const mockSettings = {
        tenantId,
        branding: { logo: 'old-logo.png', primaryColor: '#000' },
        features: { analytics: true, reporting: false },
        save: jest.fn().mockResolvedValue(true)
      };

      (TenantSettings.findOne as jest.Mock).mockResolvedValue(mockSettings);

      const result = await service.updateTenantSettings(tenantId, updates);

      expect(mockSettings.branding).toEqual(updates.branding);
      expect(mockSettings.features).toEqual(updates.features);
      expect(mockSettings.save).toHaveBeenCalled();
      expect(mockCacheService.del).toHaveBeenCalledWith(`tenant:settings:${tenantId}`);
      expect(result).toEqual(mockSettings);
    });

    it('should create settings if none exist', async () => {
      const tenantId = 'tenant123';
      const updates = {
        branding: { logo: 'logo.png' }
      };

      (TenantSettings.findOne as jest.Mock).mockResolvedValue(null);

      const mockNewSettings = {
        tenantId,
        branding: updates.branding,
        save: jest.fn().mockResolvedValue(true)
      };

      (TenantSettings as any).mockImplementation(() => mockNewSettings);

      const result = await service.updateTenantSettings(tenantId, updates);

      expect(mockNewSettings.save).toHaveBeenCalled();
      expect(result).toEqual(mockNewSettings);
    });

    it('should handle errors gracefully', async () => {
      const tenantId = 'tenant123';
      const updates = { branding: {} };

      (TenantSettings.findOne as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(service.updateTenantSettings(tenantId, updates)).rejects.toThrow('Failed to update tenant settings');
    });
  });

  describe('getTenantUsers', () => {
    it('should return tenant users with pagination', async () => {
      const tenantId = 'tenant123';
      const mockUsers = [
        {
          _id: 'user1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          role: 'admin'
        }
      ];

      (User.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              skip: jest.fn().mockResolvedValue(mockUsers)
            })
          })
        })
      });

      (User.countDocuments as jest.Mock).mockResolvedValue(1);

      const result = await service.getTenantUsers(tenantId, { page: 1, limit: 10 });

      expect(User.find).toHaveBeenCalledWith({ tenantId });
      expect(result.users).toEqual(mockUsers);
      expect(result.pagination.total).toBe(1);
    });

    it('should handle errors gracefully', async () => {
      const tenantId = 'tenant123';
      (User.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              skip: jest.fn().mockRejectedValue(new Error('Database error'))
            })
          })
        })
      });

      await expect(service.getTenantUsers(tenantId, { page: 1, limit: 10 })).rejects.toThrow('Failed to retrieve tenant users');
    });
  });

  describe('getTenantAnalytics', () => {
    it('should return tenant analytics', async () => {
      const tenantId = 'tenant123';
      const timeRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      };

      (User.countDocuments as jest.Mock)
        .mockResolvedValueOnce(100) // totalUsers
        .mockResolvedValueOnce(80); // activeUsers

      const result = await service.getTenantAnalytics(tenantId, timeRange);

      expect(result).toHaveProperty('totalUsers', 100);
      expect(result).toHaveProperty('activeUsers', 80);
      expect(result).toHaveProperty('userGrowth');
      expect(result).toHaveProperty('activityMetrics');
    });

    it('should handle errors gracefully', async () => {
      const tenantId = 'tenant123';
      const timeRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      };

      (User.countDocuments as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(service.getTenantAnalytics(tenantId, timeRange)).rejects.toThrow('Failed to retrieve tenant analytics');
    });
  });
});