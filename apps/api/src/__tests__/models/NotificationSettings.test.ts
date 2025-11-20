import mongoose from 'mongoose';
import { NotificationSettings, INotificationSettings } from '../../models/NotificationSettings';

describe('NotificationSettings Model', () => {
  beforeAll(async () => {
    const mongoUri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/test_PharmacyCopilot';
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await NotificationSettings.deleteMany({});
  });

  describe('Model Validation', () => {
    it('should create valid NotificationSettings with default values', async () => {
      const adminId = new mongoose.Types.ObjectId();
      const workspaceId = new mongoose.Types.ObjectId();
      
      const settings = await NotificationSettings.createDefaultSettings(workspaceId, adminId);
      
      expect(settings._id).toBeDefined();
      expect(settings.workspaceId?.toString()).toBe(workspaceId.toString());
      expect(settings.channels.email.enabled).toBe(true);
      expect(settings.channels.inApp.enabled).toBe(true);
      expect(settings.globalSettings.enableNotifications).toBe(true);
      expect(settings.isActive).toBe(true);
    });

    it('should create global settings without workspaceId', async () => {
      const adminId = new mongoose.Types.ObjectId();
      
      const settings = await NotificationSettings.createDefaultSettings(undefined, adminId);
      
      expect(settings.workspaceId).toBeUndefined();
      expect(settings.isActive).toBe(true);
    });

    it('should validate time format for quiet hours', async () => {
      const adminId = new mongoose.Types.ObjectId();
      
      const invalidSettings = new NotificationSettings({
        channels: {
          email: { enabled: true, rateLimits: { perMinute: 60, perHour: 1000, perDay: 10000 }, retryPolicy: { maxRetries: 3, retryDelay: 30, backoffMultiplier: 2 } },
          sms: { enabled: false, rateLimits: { perMinute: 60, perHour: 1000, perDay: 10000 }, retryPolicy: { maxRetries: 3, retryDelay: 30, backoffMultiplier: 2 } },
          push: { enabled: false, rateLimits: { perMinute: 60, perHour: 1000, perDay: 10000 }, retryPolicy: { maxRetries: 3, retryDelay: 30, backoffMultiplier: 2 } },
          whatsapp: { enabled: false, rateLimits: { perMinute: 60, perHour: 1000, perDay: 10000 }, retryPolicy: { maxRetries: 3, retryDelay: 30, backoffMultiplier: 2 } },
          inApp: { enabled: true, rateLimits: { perMinute: 60, perHour: 1000, perDay: 10000 }, retryPolicy: { maxRetries: 3, retryDelay: 30, backoffMultiplier: 2 } },
        },
        globalSettings: {
          enableNotifications: true,
          quietHours: {
            enabled: true,
            startTime: '25:00', // Invalid time format
            endTime: '08:00',
            timezone: 'UTC',
          },
          batchingEnabled: false,
          batchingInterval: 15,
          maxBatchSize: 50,
        },
        deliveryPreferences: {
          priorityChannels: ['email'],
          fallbackEnabled: true,
          fallbackDelay: 5,
        },
        complianceSettings: {
          gdprCompliant: true,
          dataRetentionDays: 365,
          consentRequired: true,
          unsubscribeEnabled: true,
        },
        lastModifiedBy: adminId,
      });

      await expect(invalidSettings.save()).rejects.toThrow();
    });

    it('should validate rate limits constraints', async () => {
      const adminId = new mongoose.Types.ObjectId();
      
      const invalidSettings = new NotificationSettings({
        channels: {
          email: { 
            enabled: true, 
            rateLimits: { perMinute: 0, perHour: 1000, perDay: 10000 }, // Invalid perMinute < 1
            retryPolicy: { maxRetries: 3, retryDelay: 30, backoffMultiplier: 2 } 
          },
          sms: { enabled: false, rateLimits: { perMinute: 60, perHour: 1000, perDay: 10000 }, retryPolicy: { maxRetries: 3, retryDelay: 30, backoffMultiplier: 2 } },
          push: { enabled: false, rateLimits: { perMinute: 60, perHour: 1000, perDay: 10000 }, retryPolicy: { maxRetries: 3, retryDelay: 30, backoffMultiplier: 2 } },
          whatsapp: { enabled: false, rateLimits: { perMinute: 60, perHour: 1000, perDay: 10000 }, retryPolicy: { maxRetries: 3, retryDelay: 30, backoffMultiplier: 2 } },
          inApp: { enabled: true, rateLimits: { perMinute: 60, perHour: 1000, perDay: 10000 }, retryPolicy: { maxRetries: 3, retryDelay: 30, backoffMultiplier: 2 } },
        },
        globalSettings: {
          enableNotifications: true,
          quietHours: {
            enabled: false,
            startTime: '22:00',
            endTime: '08:00',
            timezone: 'UTC',
          },
          batchingEnabled: false,
          batchingInterval: 15,
          maxBatchSize: 50,
        },
        deliveryPreferences: {
          priorityChannels: ['email'],
          fallbackEnabled: true,
          fallbackDelay: 5,
        },
        complianceSettings: {
          gdprCompliant: true,
          dataRetentionDays: 365,
          consentRequired: true,
          unsubscribeEnabled: true,
        },
        lastModifiedBy: adminId,
      });

      await expect(invalidSettings.save()).rejects.toThrow();
    });
  });

  describe('Methods', () => {
    let settings: INotificationSettings;
    const adminId = new mongoose.Types.ObjectId();

    beforeEach(async () => {
      settings = await NotificationSettings.createDefaultSettings(undefined, adminId);
    });

    it('should check if channel is enabled', () => {
      expect(settings.isChannelEnabled('email')).toBe(true);
      expect(settings.isChannelEnabled('sms')).toBe(false);
      
      // Test with inactive settings
      settings.isActive = false;
      expect(settings.isChannelEnabled('email')).toBe(false);
    });

    it('should detect quiet hours correctly', () => {
      // Enable quiet hours from 22:00 to 08:00 UTC
      settings.globalSettings.quietHours.enabled = true;
      settings.globalSettings.quietHours.startTime = '22:00';
      settings.globalSettings.quietHours.endTime = '08:00';
      
      // Mock current time to be in quiet hours (23:00 UTC)
      const originalToLocaleTimeString = Date.prototype.toLocaleTimeString;
      Date.prototype.toLocaleTimeString = jest.fn().mockReturnValue('23:00');
      
      expect(settings.isInQuietHours()).toBe(true);
      
      // Mock current time to be outside quiet hours (10:00 UTC)
      Date.prototype.toLocaleTimeString = jest.fn().mockReturnValue('10:00');
      
      expect(settings.isInQuietHours()).toBe(false);
      
      // Restore original method
      Date.prototype.toLocaleTimeString = originalToLocaleTimeString;
    });

    it('should handle same-day quiet hours', () => {
      settings.globalSettings.quietHours.enabled = true;
      settings.globalSettings.quietHours.startTime = '12:00';
      settings.globalSettings.quietHours.endTime = '14:00';
      
      const originalToLocaleTimeString = Date.prototype.toLocaleTimeString;
      
      // Test time within quiet hours
      Date.prototype.toLocaleTimeString = jest.fn().mockReturnValue('13:00');
      expect(settings.isInQuietHours()).toBe(true);
      
      // Test time outside quiet hours
      Date.prototype.toLocaleTimeString = jest.fn().mockReturnValue('15:00');
      expect(settings.isInQuietHours()).toBe(false);
      
      Date.prototype.toLocaleTimeString = originalToLocaleTimeString;
    });

    it('should determine if notification can be sent', () => {
      expect(settings.canSendNotification('email')).toBe(true);
      expect(settings.canSendNotification('sms')).toBe(false);
      
      // Test with quiet hours
      settings.globalSettings.quietHours.enabled = true;
      const originalToLocaleTimeString = Date.prototype.toLocaleTimeString;
      Date.prototype.toLocaleTimeString = jest.fn().mockReturnValue('23:00');
      
      expect(settings.canSendNotification('email')).toBe(false);
      
      Date.prototype.toLocaleTimeString = originalToLocaleTimeString;
    });

    it('should get next available channel', () => {
      expect(settings.getNextAvailableChannel()).toBe('email');
      
      // Disable email
      settings.channels.email.enabled = false;
      expect(settings.getNextAvailableChannel()).toBe('inApp');
      
      // Test with preferred channels
      settings.channels.email.enabled = true;
      expect(settings.getNextAvailableChannel(['sms', 'email'])).toBe('email');
    });

    it('should exclude sensitive data in JSON output', () => {
      settings.channels.email.apiKey = 'secret-key';
      settings.channels.email.apiSecret = 'secret-secret';
      
      const jsonOutput = settings.toJSON();
      
      expect(jsonOutput).not.toHaveProperty('__v');
      expect(jsonOutput.channels.email.apiKey).toBe('***');
      expect(jsonOutput.channels.email.apiSecret).toBe('***');
    });
  });

  describe('Static Methods', () => {
    const adminId = new mongoose.Types.ObjectId();
    const workspaceId = new mongoose.Types.ObjectId();

    beforeEach(async () => {
      // Create global and workspace settings
      await NotificationSettings.createDefaultSettings(undefined, adminId);
      await NotificationSettings.createDefaultSettings(workspaceId, adminId);
    });

    it('should get global settings', async () => {
      const globalSettings = await NotificationSettings.getGlobalSettings();
      
      expect(globalSettings).toBeDefined();
      expect(globalSettings?.workspaceId).toBeUndefined();
    });

    it('should get workspace settings', async () => {
      const workspaceSettings = await NotificationSettings.getWorkspaceSettings(workspaceId);
      
      expect(workspaceSettings).toBeDefined();
      expect(workspaceSettings?.workspaceId?.toString()).toBe(workspaceId.toString());
    });
  });

  describe('Indexes', () => {
    it('should have proper indexes', async () => {
      const indexes = await NotificationSettings.collection.getIndexes();
      
      expect(indexes).toHaveProperty('workspaceId_1');
      expect(indexes).toHaveProperty('isActive_1');
      expect(indexes).toHaveProperty('lastModifiedBy_1');
    });
  });

  describe('Enum Validation', () => {
    it('should validate priority channels enum', async () => {
      const adminId = new mongoose.Types.ObjectId();
      
      const invalidSettings = new NotificationSettings({
        channels: {
          email: { enabled: true, rateLimits: { perMinute: 60, perHour: 1000, perDay: 10000 }, retryPolicy: { maxRetries: 3, retryDelay: 30, backoffMultiplier: 2 } },
          sms: { enabled: false, rateLimits: { perMinute: 60, perHour: 1000, perDay: 10000 }, retryPolicy: { maxRetries: 3, retryDelay: 30, backoffMultiplier: 2 } },
          push: { enabled: false, rateLimits: { perMinute: 60, perHour: 1000, perDay: 10000 }, retryPolicy: { maxRetries: 3, retryDelay: 30, backoffMultiplier: 2 } },
          whatsapp: { enabled: false, rateLimits: { perMinute: 60, perHour: 1000, perDay: 10000 }, retryPolicy: { maxRetries: 3, retryDelay: 30, backoffMultiplier: 2 } },
          inApp: { enabled: true, rateLimits: { perMinute: 60, perHour: 1000, perDay: 10000 }, retryPolicy: { maxRetries: 3, retryDelay: 30, backoffMultiplier: 2 } },
        },
        globalSettings: {
          enableNotifications: true,
          quietHours: {
            enabled: false,
            startTime: '22:00',
            endTime: '08:00',
            timezone: 'UTC',
          },
          batchingEnabled: false,
          batchingInterval: 15,
          maxBatchSize: 50,
        },
        deliveryPreferences: {
          priorityChannels: ['invalid_channel' as any], // Invalid enum value
          fallbackEnabled: true,
          fallbackDelay: 5,
        },
        complianceSettings: {
          gdprCompliant: true,
          dataRetentionDays: 365,
          consentRequired: true,
          unsubscribeEnabled: true,
        },
        lastModifiedBy: adminId,
      });

      await expect(invalidSettings.save()).rejects.toThrow();
    });
  });
});