import { NotificationService } from '../../services/SaaSNotificationService';
import { NotificationSettings } from '../../models/NotificationSettings';
import { NotificationRule } from '../../models/NotificationRule';
import { NotificationTemplate } from '../../models/NotificationTemplate';
import { User } from '../../models/User';
import { RedisCacheService } from '../../services/RedisCacheService';
import { BackgroundJobService } from '../../services/BackgroundJobService';
import { AuditService } from '../../services/auditService';
import nodemailer from 'nodemailer';

// Mock dependencies
jest.mock('../../models/NotificationSettings');
jest.mock('../../models/NotificationRule');
jest.mock('../../models/NotificationTemplate');
jest.mock('../../models/User');
jest.mock('../../services/RedisCacheService');
jest.mock('../../services/BackgroundJobService');
jest.mock('../../services/auditService');
jest.mock('../../utils/logger');
jest.mock('nodemailer');

describe('NotificationService', () => {
  let service: NotificationService;
  let mockCacheService: jest.Mocked<RedisCacheService>;
  let mockBackgroundJobService: jest.Mocked<BackgroundJobService>;
  let mockAuditService: jest.Mocked<typeof AuditService>;
  let mockEmailTransporter: jest.Mocked<nodemailer.Transporter>;

  const mockNotificationSettings = {
    _id: 'settings123',
    workspaceId: null,
    channels: {
      email: {
        enabled: true,
        rateLimits: { perMinute: 60, perHour: 1000, perDay: 10000 },
        retryPolicy: { maxRetries: 3, retryDelay: 30, backoffMultiplier: 2 }
      },
      sms: {
        enabled: false,
        rateLimits: { perMinute: 10, perHour: 100, perDay: 1000 },
        retryPolicy: { maxRetries: 3, retryDelay: 60, backoffMultiplier: 2 }
      },
      push: {
        enabled: false,
        rateLimits: { perMinute: 100, perHour: 5000, perDay: 50000 },
        retryPolicy: { maxRetries: 2, retryDelay: 15, backoffMultiplier: 1.5 }
      },
      whatsapp: {
        enabled: false,
        rateLimits: { perMinute: 20, perHour: 500, perDay: 5000 },
        retryPolicy: { maxRetries: 3, retryDelay: 120, backoffMultiplier: 2 }
      },
      inApp: {
        enabled: true,
        rateLimits: { perMinute: 200, perHour: 10000, perDay: 100000 },
        retryPolicy: { maxRetries: 1, retryDelay: 5, backoffMultiplier: 1 }
      }
    },
    globalSettings: {
      enableNotifications: true,
      quietHours: {
        enabled: false,
        startTime: '22:00',
        endTime: '08:00',
        timezone: 'UTC'
      },
      batchingEnabled: false,
      batchingInterval: 15,
      maxBatchSize: 50
    },
    isActive: true,
    isChannelEnabled: jest.fn().mockReturnValue(true),
    isInQuietHours: jest.fn().mockReturnValue(false)
  };

  const mockUser = {
    _id: 'user123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '+1234567890',
    isActive: true
  };

  const mockTemplate = {
    _id: 'template123',
    name: 'Welcome Email',
    channel: 'email',
    subject: 'Welcome {{firstName}}!',
    body: 'Hello {{firstName}} {{lastName}}, welcome to our platform!',
    variables: [
      { name: 'firstName', type: 'string', required: true },
      { name: 'lastName', type: 'string', required: true }
    ],
    isActive: true,
    save: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock RedisCacheService
    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      delPattern: jest.fn(),
    } as any;

    // Mock BackgroundJobService
    mockBackgroundJobService = {
      queueExportJob: jest.fn(),
      queueScheduledReport: jest.fn(),
      getJobStatus: jest.fn(),
      cancelJob: jest.fn(),
      getQueueStats: jest.fn(),
      shutdown: jest.fn(),
    } as any;

    // Mock AuditService
    mockAuditService = {
      createAuditLog: jest.fn(),
    } as any;

    // Mock email transporter
    mockEmailTransporter = {
      sendMail: jest.fn(),
    } as any;

    // Mock static getInstance methods
    (RedisCacheService.getInstance as jest.Mock).mockReturnValue(mockCacheService);
    (BackgroundJobService.getInstance as jest.Mock).mockReturnValue(mockBackgroundJobService);
    (AuditService as any) = mockAuditService;
    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockEmailTransporter);

    service = NotificationService.getInstance();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = NotificationService.getInstance();
      const instance2 = NotificationService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getNotificationSettings', () => {
    it('should return cached settings if available', async () => {
      mockCacheService.get.mockResolvedValue(mockNotificationSettings);

      const result = await service.getNotificationSettings('workspace123');

      expect(mockCacheService.get).toHaveBeenCalledWith('notification:settings:workspace123');
      expect(result).toEqual(mockNotificationSettings);
    });

    it('should fetch and cache settings if not in cache', async () => {
      mockCacheService.get.mockResolvedValue(null);
      (NotificationSettings.findOne as jest.Mock).mockResolvedValue(mockNotificationSettings);

      const result = await service.getNotificationSettings('workspace123');

      expect(NotificationSettings.findOne).toHaveBeenCalledWith({
        workspaceId: expect.any(Object),
        isActive: true
      });
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'notification:settings:workspace123',
        mockNotificationSettings,
        10 * 60 * 1000
      );
      expect(result).toEqual(mockNotificationSettings);
    });

    it('should create default settings if none exist', async () => {
      mockCacheService.get.mockResolvedValue(null);
      (NotificationSettings.findOne as jest.Mock).mockResolvedValue(null);

      const mockDefaultSettings = { ...mockNotificationSettings, save: jest.fn().mockResolvedValue(true) };
      (NotificationSettings as any).mockImplementation(() => mockDefaultSettings);

      const result = await service.getNotificationSettings('workspace123');

      expect(mockDefaultSettings.save).toHaveBeenCalled();
      expect(result).toEqual(mockDefaultSettings);
    });

    it('should handle global settings (no workspaceId)', async () => {
      mockCacheService.get.mockResolvedValue(null);
      (NotificationSettings.findOne as jest.Mock).mockResolvedValue(mockNotificationSettings);

      await service.getNotificationSettings();

      expect(NotificationSettings.findOne).toHaveBeenCalledWith({
        workspaceId: null,
        isActive: true
      });
      expect(mockCacheService.get).toHaveBeenCalledWith('notification:settings:global');
    });

    it('should handle errors gracefully', async () => {
      mockCacheService.get.mockRejectedValue(new Error('Cache error'));

      await expect(service.getNotificationSettings()).rejects.toThrow('Failed to retrieve notification settings');
    });
  });

  describe('updateNotificationRules', () => {
    it('should successfully update notification rules', async () => {
      const newRules = [
        {
          name: 'User Registration',
          trigger: 'user.registered',
          conditions: [],
          actions: [{ channel: 'email', templateId: 'template123' }],
          isActive: true
        }
      ];

      jest.spyOn(service, 'getNotificationSettings').mockResolvedValue(mockNotificationSettings as any);
      (NotificationRule.find as jest.Mock).mockResolvedValue([]);
      (NotificationRule.deleteMany as jest.Mock).mockResolvedValue({ deletedCount: 0 });
      (NotificationRule.insertMany as jest.Mock).mockResolvedValue(newRules);

      await service.updateNotificationRules(newRules as any, 'workspace123', 'admin123');

      expect(NotificationRule.deleteMany).toHaveBeenCalledWith({
        workspaceId: expect.any(Object)
      });
      expect(NotificationRule.insertMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'User Registration',
            workspaceId: expect.any(Object),
            createdBy: expect.any(Object)
          })
        ])
      );

      expect(mockCacheService.del).toHaveBeenCalledWith('notification:settings:workspace123');
      expect(mockCacheService.delPattern).toHaveBeenCalledWith('notification:rules:*');
      expect(mockAuditService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'NOTIFICATION_RULES_UPDATED',
          userId: 'admin123'
        })
      );
    });

    it('should handle errors gracefully', async () => {
      jest.spyOn(service, 'getNotificationSettings').mockRejectedValue(new Error('Settings error'));

      await expect(service.updateNotificationRules([], 'workspace123', 'admin123')).rejects.toThrow('Settings error');
    });
  });

  describe('sendBulkNotification', () => {
    it('should successfully queue bulk notification', async () => {
      const bulkNotification = {
        userIds: ['user1', 'user2', 'user3'],
        templateId: 'template123',
        channel: 'email',
        variables: { companyName: 'Test Corp' },
        priority: 'normal' as const
      };

      const mockUsers = [
        { _id: 'user1', firstName: 'John', lastName: 'Doe', email: 'john@example.com', isActive: true },
        { _id: 'user2', firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com', isActive: true },
        { _id: 'user3', firstName: 'Bob', lastName: 'Johnson', email: 'bob@example.com', isActive: true }
      ];

      (NotificationTemplate.findById as jest.Mock).mockResolvedValue(mockTemplate);
      (User.find as jest.Mock).mockResolvedValue(mockUsers);
      jest.spyOn(service as any, 'checkRateLimits').mockResolvedValue(undefined);

      const result = await service.sendBulkNotification(bulkNotification, 'admin123');

      expect(NotificationTemplate.findById).toHaveBeenCalledWith('template123');
      expect(User.find).toHaveBeenCalledWith({
        _id: { $in: expect.any(Array) },
        isActive: true
      });

      expect(mockBackgroundJobService.queueExportJob).toHaveBeenCalledTimes(3);
      expect(mockCacheService.set).toHaveBeenCalledWith(
        `notification:result:${result.id}`,
        expect.objectContaining({
          status: 'queued',
          totalRecipients: 3,
          successCount: 0,
          failureCount: 0
        }),
        24 * 60 * 60 * 1000
      );

      expect(mockAuditService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'BULK_NOTIFICATION_SENT',
          userId: 'admin123'
        })
      );

      expect(result).toEqual(
        expect.objectContaining({
          status: 'queued',
          totalRecipients: 3,
          successCount: 0,
          failureCount: 0,
          errors: []
        })
      );
    });

    it('should throw error if template not found', async () => {
      const bulkNotification = {
        userIds: ['user1'],
        templateId: 'nonexistent',
        channel: 'email',
        priority: 'normal' as const
      };

      (NotificationTemplate.findById as jest.Mock).mockResolvedValue(null);

      await expect(service.sendBulkNotification(bulkNotification)).rejects.toThrow('Notification template not found');
    });

    it('should throw error if no valid recipients found', async () => {
      const bulkNotification = {
        userIds: ['user1'],
        templateId: 'template123',
        channel: 'email',
        priority: 'normal' as const
      };

      (NotificationTemplate.findById as jest.Mock).mockResolvedValue(mockTemplate);
      (User.find as jest.Mock).mockResolvedValue([]);

      await expect(service.sendBulkNotification(bulkNotification)).rejects.toThrow('No valid recipients found');
    });

    it('should handle rate limit errors', async () => {
      const bulkNotification = {
        userIds: ['user1'],
        templateId: 'template123',
        channel: 'email',
        priority: 'normal' as const
      };

      (NotificationTemplate.findById as jest.Mock).mockResolvedValue(mockTemplate);
      (User.find as jest.Mock).mockResolvedValue([mockUser]);
      jest.spyOn(service as any, 'checkRateLimits').mockRejectedValue(new Error('Rate limit exceeded'));

      await expect(service.sendBulkNotification(bulkNotification)).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('getNotificationHistory', () => {
    it('should return notification history with pagination', async () => {
      const result = await service.getNotificationHistory({ page: 1, limit: 50 });

      expect(result).toEqual({
        history: [],
        total: 0,
        page: 1,
        pages: 0
      });
    });

    it('should handle errors gracefully', async () => {
      // Mock an error in the method
      jest.spyOn(service, 'getNotificationHistory').mockRejectedValueOnce(new Error('Database error'));

      await expect(service.getNotificationHistory()).rejects.toThrow('Database error');
    });
  });

  describe('getNotificationTemplates', () => {
    it('should return cached templates if available', async () => {
      const mockTemplates = [mockTemplate];
      mockCacheService.get.mockResolvedValue(mockTemplates);

      const result = await service.getNotificationTemplates('workspace123');

      expect(mockCacheService.get).toHaveBeenCalledWith('notification:templates:workspace123');
      expect(result).toEqual(mockTemplates);
    });

    it('should fetch and cache templates if not in cache', async () => {
      const mockTemplates = [mockTemplate];
      mockCacheService.get.mockResolvedValue(null);

      (NotificationTemplate.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockTemplates)
      });

      const result = await service.getNotificationTemplates('workspace123');

      expect(NotificationTemplate.find).toHaveBeenCalledWith({
        workspaceId: expect.any(Object),
        isActive: true
      });
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'notification:templates:workspace123',
        mockTemplates,
        10 * 60 * 1000
      );
      expect(result).toEqual(mockTemplates);
    });

    it('should handle global templates (no workspaceId)', async () => {
      mockCacheService.get.mockResolvedValue(null);

      (NotificationTemplate.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockResolvedValue([])
      });

      await service.getNotificationTemplates();

      expect(NotificationTemplate.find).toHaveBeenCalledWith({
        workspaceId: null,
        isActive: true
      });
      expect(mockCacheService.get).toHaveBeenCalledWith('notification:templates:global');
    });

    it('should handle errors gracefully', async () => {
      mockCacheService.get.mockRejectedValue(new Error('Cache error'));

      await expect(service.getNotificationTemplates()).rejects.toThrow('Failed to retrieve notification templates');
    });
  });

  describe('createNotificationTemplate', () => {
    it('should successfully create notification template', async () => {
      const templateData = {
        name: 'New Template',
        channel: 'email' as const,
        subject: 'Test Subject',
        body: 'Test Body',
        variables: []
      };

      const mockNewTemplate = { ...mockTemplate, ...templateData, save: jest.fn().mockResolvedValue(true) };
      (NotificationTemplate as any).mockImplementation(() => mockNewTemplate);

      const result = await service.createNotificationTemplate(templateData, 'workspace123', 'admin123');

      expect(mockNewTemplate.save).toHaveBeenCalled();
      expect(mockCacheService.del).toHaveBeenCalledWith('notification:templates:workspace123');
      expect(mockAuditService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'NOTIFICATION_TEMPLATE_CREATED',
          userId: 'admin123'
        })
      );
      expect(result).toEqual(mockNewTemplate);
    });

    it('should handle errors gracefully', async () => {
      const templateData = { name: 'Test Template' };
      (NotificationTemplate as any).mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(service.createNotificationTemplate(templateData)).rejects.toThrow('Database error');
    });
  });

  describe('getDeliveryStatus', () => {
    it('should return cached delivery status if available', async () => {
      const mockStatus = {
        notificationId: 'notification123',
        status: 'delivered',
        attempts: 1,
        lastAttempt: new Date(),
        deliveryDetails: {}
      };

      mockCacheService.get.mockResolvedValue(mockStatus);

      const result = await service.getDeliveryStatus('notification123');

      expect(mockCacheService.get).toHaveBeenCalledWith('notification:status:notification123');
      expect(result).toEqual(mockStatus);
    });

    it('should return mock status if not in cache', async () => {
      mockCacheService.get.mockResolvedValue(null);

      const result = await service.getDeliveryStatus('notification123');

      expect(result).toEqual({
        notificationId: 'notification123',
        status: 'delivered',
        attempts: 1,
        lastAttempt: expect.any(Date),
        deliveryDetails: {}
      });

      expect(mockCacheService.set).toHaveBeenCalledWith(
        'notification:status:notification123',
        result,
        5 * 60 * 1000
      );
    });

    it('should handle errors gracefully', async () => {
      mockCacheService.get.mockRejectedValue(new Error('Cache error'));

      await expect(service.getDeliveryStatus('notification123')).rejects.toThrow('Failed to retrieve delivery status');
    });
  });

  describe('sendNotification', () => {
    it('should successfully send single notification', async () => {
      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      (NotificationTemplate.findById as jest.Mock).mockResolvedValue(mockTemplate);
      jest.spyOn(service, 'getNotificationSettings').mockResolvedValue(mockNotificationSettings as any);
      jest.spyOn(service as any, 'checkRateLimits').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'sendByChannel').mockResolvedValue({ success: true });

      const result = await service.sendNotification(
        'user123',
        'template123',
        'email',
        { companyName: 'Test Corp' }
      );

      expect(User.findById).toHaveBeenCalledWith('user123');
      expect(NotificationTemplate.findById).toHaveBeenCalledWith('template123');
      expect(mockNotificationSettings.isChannelEnabled).toHaveBeenCalledWith('email');
      expect(mockNotificationSettings.isInQuietHours).toHaveBeenCalled();
      expect(result).toMatch(/^[0-9a-f]{24}$/); // ObjectId format
    });

    it('should throw error if user not found', async () => {
      (User.findById as jest.Mock).mockResolvedValue(null);

      await expect(service.sendNotification('nonexistent', 'template123', 'email')).rejects.toThrow('User not found or inactive');
    });

    it('should throw error if user is inactive', async () => {
      (User.findById as jest.Mock).mockResolvedValue({ ...mockUser, isActive: false });

      await expect(service.sendNotification('user123', 'template123', 'email')).rejects.toThrow('User not found or inactive');
    });

    it('should throw error if template not found', async () => {
      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      (NotificationTemplate.findById as jest.Mock).mockResolvedValue(null);

      await expect(service.sendNotification('user123', 'nonexistent', 'email')).rejects.toThrow('Template not found or inactive');
    });

    it('should throw error if channel is not enabled', async () => {
      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      (NotificationTemplate.findById as jest.Mock).mockResolvedValue(mockTemplate);

      const disabledChannelSettings = {
        ...mockNotificationSettings,
        isChannelEnabled: jest.fn().mockReturnValue(false)
      };
      jest.spyOn(service, 'getNotificationSettings').mockResolvedValue(disabledChannelSettings as any);

      await expect(service.sendNotification('user123', 'template123', 'email')).rejects.toThrow('Channel email is not enabled');
    });

    it('should throw error during quiet hours', async () => {
      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      (NotificationTemplate.findById as jest.Mock).mockResolvedValue(mockTemplate);

      const quietHoursSettings = {
        ...mockNotificationSettings,
        isInQuietHours: jest.fn().mockReturnValue(true)
      };
      jest.spyOn(service, 'getNotificationSettings').mockResolvedValue(quietHoursSettings as any);

      await expect(service.sendNotification('user123', 'template123', 'email')).rejects.toThrow('Cannot send notification during quiet hours');
    });
  });

  describe('clearCache', () => {
    it('should clear workspace-specific cache', async () => {
      await service.clearCache('workspace123');

      expect(mockCacheService.del).toHaveBeenCalledWith('notification:settings:workspace123');
      expect(mockCacheService.del).toHaveBeenCalledWith('notification:templates:workspace123');
      expect(mockCacheService.delPattern).toHaveBeenCalledWith('notification:rules:workspace123:*');
    });

    it('should clear all notification cache', async () => {
      await service.clearCache();

      expect(mockCacheService.delPattern).toHaveBeenCalledWith('notification:settings:*');
      expect(mockCacheService.delPattern).toHaveBeenCalledWith('notification:templates:*');
      expect(mockCacheService.delPattern).toHaveBeenCalledWith('notification:rules:*');
      expect(mockCacheService.delPattern).toHaveBeenCalledWith('notification:status:*');
      expect(mockCacheService.delPattern).toHaveBeenCalledWith('notification:result:*');
      expect(mockCacheService.delPattern).toHaveBeenCalledWith('rate_limit:*');
    });

    it('should handle errors gracefully', async () => {
      mockCacheService.delPattern.mockRejectedValue(new Error('Cache error'));

      await expect(service.clearCache()).rejects.toThrow('Failed to clear notification cache');
    });
  });
});