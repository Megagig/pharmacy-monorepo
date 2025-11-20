import { SecurityMonitoringService } from '../../services/SecurityMonitoringService';
import { SecuritySettings } from '../../models/SecuritySettings';
import { UserSession } from '../../models/UserSession';
import { SecurityAuditLog } from '../../models/SecurityAuditLog';
import { User } from '../../models/User';
import { RedisCacheService } from '../../services/RedisCacheService';
import { NotificationService } from '../../services/SaaSNotificationService';
import mongoose from 'mongoose';

// Mock dependencies
jest.mock('../../models/SecuritySettings');
jest.mock('../../models/UserSession');
jest.mock('../../models/SecurityAuditLog');
jest.mock('../../models/User');
jest.mock('../../services/RedisCacheService');
jest.mock('../../services/SaaSNotificationService');
jest.mock('../../utils/logger');

describe('SecurityMonitoringService', () => {
  let service: SecurityMonitoringService;
  let mockCacheService: jest.Mocked<RedisCacheService>;
  let mockNotificationService: jest.Mocked<NotificationService>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      delPattern: jest.fn(),
    } as any;

    mockNotificationService = {
      sendNotification: jest.fn(),
    } as any;

    (RedisCacheService.getInstance as jest.Mock).mockReturnValue(mockCacheService);
    (NotificationService.getInstance as jest.Mock).mockReturnValue(mockNotificationService);

    service = SecurityMonitoringService.getInstance();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = SecurityMonitoringService.getInstance();
      const instance2 = SecurityMonitoringService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getSecuritySettings', () => {
    it('should return cached settings if available', async () => {
      const cachedSettings = {
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true,
          maxAge: 90,
          preventReuse: 5
        },
        sessionSettings: {
          maxDuration: 8 * 60 * 60 * 1000,
          idleTimeout: 30 * 60 * 1000,
          maxConcurrentSessions: 3
        },
        accountLockout: {
          maxFailedAttempts: 5,
          lockoutDuration: 15 * 60 * 1000,
          autoUnlock: true
        },
        twoFactorAuth: {
          enforced: false,
          methods: ['email'],
          gracePeriod: 7 * 24 * 60 * 60 * 1000
        }
      };

      mockCacheService.get.mockResolvedValue(cachedSettings);

      const result = await service.getSecuritySettings();

      expect(mockCacheService.get).toHaveBeenCalledWith('security:settings');
      expect(result).toEqual(cachedSettings);
    });

    it('should fetch and cache settings if not in cache', async () => {
      mockCacheService.get.mockResolvedValue(null);

      const mockSettings = {
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true,
          maxAge: 90,
          preventReuse: 5
        },
        sessionSettings: {
          maxDuration: 8 * 60 * 60 * 1000,
          idleTimeout: 30 * 60 * 1000,
          maxConcurrentSessions: 3
        },
        accountLockout: {
          maxFailedAttempts: 5,
          lockoutDuration: 15 * 60 * 1000,
          autoUnlock: true
        },
        twoFactorAuth: {
          enforced: false,
          methods: ['email'],
          gracePeriod: 7 * 24 * 60 * 60 * 1000
        }
      };

      (SecuritySettings.findOne as jest.Mock).mockResolvedValue(mockSettings);

      const result = await service.getSecuritySettings();

      expect(SecuritySettings.findOne).toHaveBeenCalled();
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'security:settings',
        mockSettings,
        60 * 60 * 1000
      );
      expect(result).toEqual(mockSettings);
    });

    it('should return default settings if none exist', async () => {
      mockCacheService.get.mockResolvedValue(null);
      (SecuritySettings.findOne as jest.Mock).mockResolvedValue(null);

      const mockDefaultSettings = {
        save: jest.fn().mockResolvedValue(true),
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true,
          maxAge: 90,
          preventReuse: 5
        }
      };

      (SecuritySettings as any).mockImplementation(() => mockDefaultSettings);

      const result = await service.getSecuritySettings();

      expect(mockDefaultSettings.save).toHaveBeenCalled();
      expect(result).toEqual(mockDefaultSettings);
    });

    it('should handle errors gracefully', async () => {
      mockCacheService.get.mockRejectedValue(new Error('Cache error'));

      await expect(service.getSecuritySettings()).rejects.toThrow('Failed to retrieve security settings');
    });
  });

  describe('updatePasswordPolicy', () => {
    it('should update password policy successfully', async () => {
      const policy = {
        minLength: 10,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        maxAge: 60,
        preventReuse: 3
      };

      const mockSettings = {
        passwordPolicy: {},
        save: jest.fn().mockResolvedValue(true)
      };

      (SecuritySettings.findOne as jest.Mock).mockResolvedValue(mockSettings);

      await service.updatePasswordPolicy(policy);

      expect(mockSettings.passwordPolicy).toEqual(policy);
      expect(mockSettings.save).toHaveBeenCalled();
      expect(mockCacheService.del).toHaveBeenCalledWith('security:settings');
    });

    it('should handle errors gracefully', async () => {
      const policy = {
        minLength: 10,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        maxAge: 60,
        preventReuse: 3
      };

      (SecuritySettings.findOne as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(service.updatePasswordPolicy(policy)).rejects.toThrow('Failed to update password policy');
    });
  });

  describe('getActiveSessions', () => {
    it('should return active sessions with pagination', async () => {
      const mockSessions = [
        {
          sessionId: 'session1',
          userId: 'user1',
          userEmail: 'user1@example.com',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          location: 'Lagos, Nigeria',
          loginTime: new Date(),
          lastActivity: new Date(),
          isActive: true
        }
      ];

      (UserSession.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              skip: jest.fn().mockResolvedValue(mockSessions)
            })
          })
        })
      });

      (UserSession.countDocuments as jest.Mock).mockResolvedValue(1);

      const result = await service.getActiveSessions({ page: 1, limit: 10 });

      expect(result.sessions).toEqual(mockSessions);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
    });

    it('should handle errors gracefully', async () => {
      (UserSession.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              skip: jest.fn().mockRejectedValue(new Error('Database error'))
            })
          })
        })
      });

      await expect(service.getActiveSessions({ page: 1, limit: 10 })).rejects.toThrow('Failed to retrieve active sessions');
    });
  });

  describe('terminateSession', () => {
    it('should terminate session successfully', async () => {
      const sessionId = 'session123';
      const mockSession = {
        sessionId,
        isActive: true,
        save: jest.fn().mockResolvedValue(true)
      };

      (UserSession.findOne as jest.Mock).mockResolvedValue(mockSession);

      await service.terminateSession(sessionId);

      expect(mockSession.isActive).toBe(false);
      expect(mockSession.save).toHaveBeenCalled();
    });

    it('should throw error if session not found', async () => {
      const sessionId = 'nonexistent';
      (UserSession.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.terminateSession(sessionId)).rejects.toThrow('Session not found');
    });

    it('should handle errors gracefully', async () => {
      const sessionId = 'session123';
      (UserSession.findOne as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(service.terminateSession(sessionId)).rejects.toThrow('Failed to terminate session');
    });
  });

  describe('getLoginHistory', () => {
    it('should return login history with filters', async () => {
      const filters = {
        userId: 'user123',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        success: true
      };

      const mockHistory = [
        {
          userId: 'user123',
          action: 'login',
          success: true,
          ipAddress: '192.168.1.1',
          timestamp: new Date()
        }
      ];

      (SecurityAuditLog.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              skip: jest.fn().mockResolvedValue(mockHistory)
            })
          })
        })
      });

      (SecurityAuditLog.countDocuments as jest.Mock).mockResolvedValue(1);

      const result = await service.getLoginHistory(filters, { page: 1, limit: 10 });

      expect(result.history).toEqual(mockHistory);
      expect(result.pagination.total).toBe(1);
    });

    it('should handle errors gracefully', async () => {
      const filters = {};
      (SecurityAuditLog.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              skip: jest.fn().mockRejectedValue(new Error('Database error'))
            })
          })
        })
      });

      await expect(service.getLoginHistory(filters, { page: 1, limit: 10 })).rejects.toThrow('Failed to retrieve login history');
    });
  });

  describe('lockAccount', () => {
    it('should lock account successfully', async () => {
      const userId = 'user123';
      const reason = 'Suspicious activity';
      const mockUser = {
        _id: userId,
        isLocked: false,
        lockReason: '',
        lockedAt: null,
        save: jest.fn().mockResolvedValue(true)
      };

      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      await service.lockAccount(userId, reason);

      expect(mockUser.isLocked).toBe(true);
      expect(mockUser.lockReason).toBe(reason);
      expect(mockUser.lockedAt).toBeInstanceOf(Date);
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should throw error if user not found', async () => {
      const userId = 'nonexistent';
      (User.findById as jest.Mock).mockResolvedValue(null);

      await expect(service.lockAccount(userId, 'reason')).rejects.toThrow('User not found');
    });

    it('should handle errors gracefully', async () => {
      const userId = 'user123';
      (User.findById as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(service.lockAccount(userId, 'reason')).rejects.toThrow('Failed to lock account');
    });
  });

  describe('unlockAccount', () => {
    it('should unlock account successfully', async () => {
      const userId = 'user123';
      const mockUser = {
        _id: userId,
        isLocked: true,
        lockReason: 'Previous reason',
        lockedAt: new Date(),
        save: jest.fn().mockResolvedValue(true)
      };

      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      await service.unlockAccount(userId);

      expect(mockUser.isLocked).toBe(false);
      expect(mockUser.lockReason).toBe('');
      expect(mockUser.lockedAt).toBeNull();
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should throw error if user not found', async () => {
      const userId = 'nonexistent';
      (User.findById as jest.Mock).mockResolvedValue(null);

      await expect(service.unlockAccount(userId)).rejects.toThrow('User not found');
    });

    it('should handle errors gracefully', async () => {
      const userId = 'user123';
      (User.findById as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(service.unlockAccount(userId)).rejects.toThrow('Failed to unlock account');
    });
  });

  describe('enable2FA', () => {
    it('should enable 2FA for user successfully', async () => {
      const userId = 'user123';
      const mockUser = {
        _id: userId,
        twoFactorEnabled: false,
        twoFactorMethod: '',
        save: jest.fn().mockResolvedValue(true)
      };

      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      await service.enable2FA(userId);

      expect(mockUser.twoFactorEnabled).toBe(true);
      expect(mockUser.twoFactorMethod).toBe('email');
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should throw error if user not found', async () => {
      const userId = 'nonexistent';
      (User.findById as jest.Mock).mockResolvedValue(null);

      await expect(service.enable2FA(userId)).rejects.toThrow('User not found');
    });

    it('should handle errors gracefully', async () => {
      const userId = 'user123';
      (User.findById as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(service.enable2FA(userId)).rejects.toThrow('Failed to enable 2FA');
    });
  });

  describe('getSecurityAuditLogs', () => {
    it('should return security audit logs with pagination', async () => {
      const mockLogs = [
        {
          userId: 'user123',
          action: 'login',
          resource: 'authentication',
          ipAddress: '192.168.1.1',
          timestamp: new Date(),
          success: true,
          details: {}
        }
      ];

      (SecurityAuditLog.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              skip: jest.fn().mockResolvedValue(mockLogs)
            })
          })
        })
      });

      (SecurityAuditLog.countDocuments as jest.Mock).mockResolvedValue(1);

      const result = await service.getSecurityAuditLogs({ page: 1, limit: 10 });

      expect(result.logs).toEqual(mockLogs);
      expect(result.pagination.total).toBe(1);
    });

    it('should handle errors gracefully', async () => {
      (SecurityAuditLog.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              skip: jest.fn().mockRejectedValue(new Error('Database error'))
            })
          })
        })
      });

      await expect(service.getSecurityAuditLogs({ page: 1, limit: 10 })).rejects.toThrow('Failed to retrieve security audit logs');
    });
  });

  describe('logSecurityEvent', () => {
    it('should log security event successfully', async () => {
      const event = {
        userId: 'user123',
        action: 'login',
        resource: 'authentication',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        success: true,
        details: { method: 'password' }
      };

      const mockLog = {
        save: jest.fn().mockResolvedValue(true)
      };

      (SecurityAuditLog as any).mockImplementation(() => mockLog);

      await service.logSecurityEvent(event);

      expect(mockLog.save).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const event = {
        userId: 'user123',
        action: 'login',
        resource: 'authentication',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        success: true,
        details: {}
      };

      const mockLog = {
        save: jest.fn().mockRejectedValue(new Error('Database error'))
      };

      (SecurityAuditLog as any).mockImplementation(() => mockLog);

      await expect(service.logSecurityEvent(event)).rejects.toThrow('Failed to log security event');
    });
  });

  describe('detectSuspiciousActivity', () => {
    it('should detect suspicious login patterns', async () => {
      const userId = 'user123';
      const mockLogs = [
        { ipAddress: '192.168.1.1', timestamp: new Date() },
        { ipAddress: '10.0.0.1', timestamp: new Date() },
        { ipAddress: '172.16.0.1', timestamp: new Date() }
      ];

      (SecurityAuditLog.find as jest.Mock).mockResolvedValue(mockLogs);

      const result = await service.detectSuspiciousActivity(userId);

      expect(result.suspicious).toBe(true);
      expect(result.reasons).toContain('Multiple IP addresses');
    });

    it('should return false for normal activity', async () => {
      const userId = 'user123';
      const mockLogs = [
        { ipAddress: '192.168.1.1', timestamp: new Date() }
      ];

      (SecurityAuditLog.find as jest.Mock).mockResolvedValue(mockLogs);

      const result = await service.detectSuspiciousActivity(userId);

      expect(result.suspicious).toBe(false);
      expect(result.reasons).toHaveLength(0);
    });

    it('should handle errors gracefully', async () => {
      const userId = 'user123';
      (SecurityAuditLog.find as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(service.detectSuspiciousActivity(userId)).rejects.toThrow('Failed to detect suspicious activity');
    });
  });
});