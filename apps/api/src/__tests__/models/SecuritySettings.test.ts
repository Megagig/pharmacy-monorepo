import mongoose from 'mongoose';
import { SecuritySettings, ISecuritySettings } from '../../models/SecuritySettings';

describe('SecuritySettings Model', () => {
  beforeAll(async () => {
    const mongoUri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/test_PharmacyCopilot';
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await SecuritySettings.deleteMany({});
  });

  describe('Model Validation', () => {
    it('should create a valid SecuritySettings document with defaults', async () => {
      const adminId = new mongoose.Types.ObjectId();
      
      const validSettings = {
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true,
          maxAge: 90,
          preventReuse: 5,
        },
        sessionSettings: {
          maxDuration: 480,
          idleTimeout: 30,
          maxConcurrentSessions: 3,
          requireReauthentication: false,
        },
        accountLockout: {
          maxFailedAttempts: 5,
          lockoutDuration: 30,
          autoUnlock: true,
          notifyOnLockout: true,
        },
        twoFactorAuth: {
          enforced: false,
          methods: ['email'],
          gracePeriod: 7,
          backupCodes: true,
        },
        ipWhitelist: ['192.168.1.1', '127.0.0.1'],
        allowedDomains: ['example.com', 'test.org'],
        securityNotifications: {
          newDeviceLogin: true,
          suspiciousActivity: true,
          passwordChanges: true,
          roleChanges: true,
        },
        auditRetention: {
          loginLogs: 365,
          actionLogs: 730,
          securityLogs: 1095,
        },
        lastModifiedBy: adminId,
      };

      const settings = new SecuritySettings(validSettings);
      const savedSettings = await settings.save();

      expect(savedSettings._id).toBeDefined();
      expect(savedSettings.passwordPolicy.minLength).toBe(8);
      expect(savedSettings.sessionSettings.maxDuration).toBe(480);
      expect(savedSettings.isActive).toBe(true);
      expect(savedSettings.createdAt).toBeDefined();
    });

    it('should require mandatory fields', async () => {
      const incompleteSettings = new SecuritySettings({
        passwordPolicy: {
          minLength: 8,
        },
        // Missing required fields
      });

      await expect(incompleteSettings.save()).rejects.toThrow();
    });

    it('should validate password policy constraints', async () => {
      const adminId = new mongoose.Types.ObjectId();
      
      const invalidSettings = new SecuritySettings({
        passwordPolicy: {
          minLength: 3, // Too short (min is 6)
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true,
          maxAge: 90,
          preventReuse: 5,
        },
        sessionSettings: {
          maxDuration: 480,
          idleTimeout: 30,
          maxConcurrentSessions: 3,
          requireReauthentication: false,
        },
        accountLockout: {
          maxFailedAttempts: 5,
          lockoutDuration: 30,
          autoUnlock: true,
          notifyOnLockout: true,
        },
        twoFactorAuth: {
          enforced: false,
          methods: ['email'],
          gracePeriod: 7,
          backupCodes: true,
        },
        lastModifiedBy: adminId,
      });

      await expect(invalidSettings.save()).rejects.toThrow();
    });

    it('should validate IP address format', async () => {
      const adminId = new mongoose.Types.ObjectId();
      
      const invalidSettings = new SecuritySettings({
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true,
          maxAge: 90,
          preventReuse: 5,
        },
        sessionSettings: {
          maxDuration: 480,
          idleTimeout: 30,
          maxConcurrentSessions: 3,
          requireReauthentication: false,
        },
        accountLockout: {
          maxFailedAttempts: 5,
          lockoutDuration: 30,
          autoUnlock: true,
          notifyOnLockout: true,
        },
        twoFactorAuth: {
          enforced: false,
          methods: ['email'],
          gracePeriod: 7,
          backupCodes: true,
        },
        ipWhitelist: ['invalid-ip-address'], // Invalid IP format
        lastModifiedBy: adminId,
      });

      await expect(invalidSettings.save()).rejects.toThrow();
    });

    it('should validate domain format', async () => {
      const adminId = new mongoose.Types.ObjectId();
      
      const invalidSettings = new SecuritySettings({
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true,
          maxAge: 90,
          preventReuse: 5,
        },
        sessionSettings: {
          maxDuration: 480,
          idleTimeout: 30,
          maxConcurrentSessions: 3,
          requireReauthentication: false,
        },
        accountLockout: {
          maxFailedAttempts: 5,
          lockoutDuration: 30,
          autoUnlock: true,
          notifyOnLockout: true,
        },
        twoFactorAuth: {
          enforced: false,
          methods: ['email'],
          gracePeriod: 7,
          backupCodes: true,
        },
        allowedDomains: ['invalid..domain'], // Invalid domain format
        lastModifiedBy: adminId,
      });

      await expect(invalidSettings.save()).rejects.toThrow();
    });
  });

  describe('Methods', () => {
    let settings: ISecuritySettings;

    beforeEach(async () => {
      const adminId = new mongoose.Types.ObjectId();
      
      settings = new SecuritySettings({
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true,
          maxAge: 90,
          preventReuse: 5,
        },
        sessionSettings: {
          maxDuration: 480, // 8 hours
          idleTimeout: 30, // 30 minutes
          maxConcurrentSessions: 3,
          requireReauthentication: false,
        },
        accountLockout: {
          maxFailedAttempts: 5,
          lockoutDuration: 30,
          autoUnlock: true,
          notifyOnLockout: true,
        },
        twoFactorAuth: {
          enforced: false,
          methods: ['email'],
          gracePeriod: 7,
          backupCodes: true,
        },
        lastModifiedBy: adminId,
      });
      await settings.save();
    });

    it('should validate strong password correctly', () => {
      const strongPassword = 'StrongP@ssw0rd123';
      const result = settings.validatePassword(strongPassword);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject weak password', () => {
      const weakPassword = 'weak';
      const result = settings.validatePassword(weakPassword);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should validate password requirements individually', () => {
      const noUppercase = 'lowercase123!';
      const result1 = settings.validatePassword(noUppercase);
      expect(result1.errors).toContain('Password must contain at least one uppercase letter');

      const noNumbers = 'NoNumbers!';
      const result2 = settings.validatePassword(noNumbers);
      expect(result2.errors).toContain('Password must contain at least one number');

      const noSpecialChars = 'NoSpecialChars123';
      const result3 = settings.validatePassword(noSpecialChars);
      expect(result3.errors).toContain('Password must contain at least one special character');
    });

    it('should detect expired sessions correctly', () => {
      const now = new Date();
      
      // Session that exceeds max duration
      const oldSessionStart = new Date(now.getTime() - (9 * 60 * 60 * 1000)); // 9 hours ago
      const recentActivity = new Date(now.getTime() - (5 * 60 * 1000)); // 5 minutes ago
      expect(settings.isSessionExpired(oldSessionStart, recentActivity)).toBe(true);

      // Session that exceeds idle timeout
      const recentSessionStart = new Date(now.getTime() - (1 * 60 * 60 * 1000)); // 1 hour ago
      const oldActivity = new Date(now.getTime() - (45 * 60 * 1000)); // 45 minutes ago
      expect(settings.isSessionExpired(recentSessionStart, oldActivity)).toBe(true);

      // Valid session
      const validSessionStart = new Date(now.getTime() - (2 * 60 * 60 * 1000)); // 2 hours ago
      const validActivity = new Date(now.getTime() - (10 * 60 * 1000)); // 10 minutes ago
      expect(settings.isSessionExpired(validSessionStart, validActivity)).toBe(false);
    });

    it('should exclude __v field in JSON output', () => {
      const jsonOutput = settings.toJSON();
      expect(jsonOutput).not.toHaveProperty('__v');
      expect(jsonOutput).toHaveProperty('_id');
      expect(jsonOutput).toHaveProperty('passwordPolicy');
    });
  });

  describe('Indexes', () => {
    it('should have proper indexes', async () => {
      const indexes = await SecuritySettings.collection.getIndexes();
      
      expect(indexes).toHaveProperty('isActive_1');
      expect(indexes).toHaveProperty('lastModifiedBy_1');
      expect(indexes).toHaveProperty('updatedAt_-1');
    });
  });

  describe('Enum Validation', () => {
    it('should validate 2FA methods enum', async () => {
      const adminId = new mongoose.Types.ObjectId();
      
      const invalidSettings = new SecuritySettings({
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true,
          maxAge: 90,
          preventReuse: 5,
        },
        sessionSettings: {
          maxDuration: 480,
          idleTimeout: 30,
          maxConcurrentSessions: 3,
          requireReauthentication: false,
        },
        accountLockout: {
          maxFailedAttempts: 5,
          lockoutDuration: 30,
          autoUnlock: true,
          notifyOnLockout: true,
        },
        twoFactorAuth: {
          enforced: false,
          methods: ['invalid_method' as any], // Invalid enum value
          gracePeriod: 7,
          backupCodes: true,
        },
        lastModifiedBy: adminId,
      });

      await expect(invalidSettings.save()).rejects.toThrow();
    });
  });
});