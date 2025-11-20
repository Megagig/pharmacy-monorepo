import mongoose from 'mongoose';
import ApiKey, { IApiKey } from '../../models/ApiKey';

describe('ApiKey Model', () => {
  let userId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    userId = new mongoose.Types.ObjectId();
  });

  beforeEach(async () => {
    await ApiKey.deleteMany({});
  });

  describe('Model Validation', () => {
    it('should create a valid API key', async () => {
      const apiKeyData = {
        name: 'Test API Key',
        description: 'Test description',
        userId,
        scopes: ['read:users', 'write:users'],
        rateLimit: {
          requests: 1000,
          window: 3600
        },
        isActive: true,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        allowedIPs: ['192.168.1.1'],
        allowedDomains: ['example.com'],
        environment: 'development' as const
      };

      const apiKey = new ApiKey(apiKeyData);
      const key = apiKey.generateKey();
      const savedApiKey = await apiKey.save();

      expect(savedApiKey._id).toBeDefined();
      expect(savedApiKey.keyId).toBeDefined();
      expect(savedApiKey.hashedKey).toBeDefined();
      expect(savedApiKey.name).toBe(apiKeyData.name);
      expect(savedApiKey.userId).toEqual(userId);
      expect(savedApiKey.scopes).toEqual(apiKeyData.scopes);
      expect(savedApiKey.isActive).toBe(true);
      expect(savedApiKey.environment).toBe('development');
      expect(key).toMatch(/^pk_[a-f0-9]{32}\.[a-f0-9]{64}$/);
    });

    it('should require name, userId, and scopes', async () => {
      const apiKey = new ApiKey({});

      let error;
      try {
        await apiKey.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.name).toBeDefined();
      expect(error.errors.userId).toBeDefined();
    });

    it('should validate environment enum', async () => {
      const apiKey = new ApiKey({
        name: 'Test Key',
        userId,
        scopes: ['read:users'],
        environment: 'invalid_env'
      });

      let error;
      try {
        await apiKey.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.environment).toBeDefined();
    });

    it('should require at least one scope', async () => {
      const apiKey = new ApiKey({
        name: 'Test Key',
        userId,
        scopes: []
      });

      let error;
      try {
        await apiKey.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
    });
  });

  describe('Key Generation and Validation', () => {
    it('should generate a unique key ID and hash', async () => {
      const apiKey1 = new ApiKey({
        name: 'Key 1',
        userId,
        scopes: ['read:users']
      });

      const apiKey2 = new ApiKey({
        name: 'Key 2',
        userId,
        scopes: ['read:users']
      });

      const key1 = apiKey1.generateKey();
      const key2 = apiKey2.generateKey();

      expect(key1).not.toBe(key2);
      expect(apiKey1.keyId).not.toBe(apiKey2.keyId);
      expect(apiKey1.hashedKey).not.toBe(apiKey2.hashedKey);
    });

    it('should validate correct key', async () => {
      const apiKey = new ApiKey({
        name: 'Test Key',
        userId,
        scopes: ['read:users']
      });

      const key = apiKey.generateKey();
      const [, rawKey] = key.split('.');

      expect(apiKey.validateKey(rawKey)).toBe(true);
    });

    it('should reject incorrect key', async () => {
      const apiKey = new ApiKey({
        name: 'Test Key',
        userId,
        scopes: ['read:users']
      });

      apiKey.generateKey();
      const wrongKey = 'wrong_key';

      expect(apiKey.validateKey(wrongKey)).toBe(false);
    });
  });

  describe('Usage Tracking', () => {
    it('should increment usage correctly', async () => {
      const apiKey = new ApiKey({
        name: 'Test Key',
        userId,
        scopes: ['read:users']
      });

      apiKey.generateKey();
      await apiKey.save();

      expect(apiKey.usage.totalRequests).toBe(0);
      expect(apiKey.usage.dailyUsage).toHaveLength(0);

      await apiKey.incrementUsage();

      expect(apiKey.usage.totalRequests).toBe(1);
      expect(apiKey.usage.lastUsed).toBeDefined();
      expect(apiKey.usage.dailyUsage).toHaveLength(1);
      expect(apiKey.usage.dailyUsage[0].requests).toBe(1);
    });

    it('should update daily usage for same day', async () => {
      const apiKey = new ApiKey({
        name: 'Test Key',
        userId,
        scopes: ['read:users']
      });

      apiKey.generateKey();
      await apiKey.save();

      await apiKey.incrementUsage();
      await apiKey.incrementUsage();

      expect(apiKey.usage.totalRequests).toBe(2);
      expect(apiKey.usage.dailyUsage).toHaveLength(1);
      expect(apiKey.usage.dailyUsage[0].requests).toBe(2);
    });

    it('should limit daily usage history to 30 days', async () => {
      const apiKey = new ApiKey({
        name: 'Test Key',
        userId,
        scopes: ['read:users']
      });

      apiKey.generateKey();

      // Simulate 35 days of usage
      for (let i = 0; i < 35; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        apiKey.usage.dailyUsage.push({
          date,
          requests: 1
        });
      }

      await apiKey.save();
      await apiKey.incrementUsage();

      expect(apiKey.usage.dailyUsage.length).toBeLessThanOrEqual(30);
    });
  });

  describe('Expiration and Rate Limiting', () => {
    it('should detect expired keys', async () => {
      const apiKey = new ApiKey({
        name: 'Test Key',
        userId,
        scopes: ['read:users'],
        expiresAt: new Date(Date.now() - 1000) // Expired 1 second ago
      });

      expect(apiKey.isExpired()).toBe(true);
    });

    it('should detect non-expired keys', async () => {
      const apiKey = new ApiKey({
        name: 'Test Key',
        userId,
        scopes: ['read:users'],
        expiresAt: new Date(Date.now() + 1000) // Expires in 1 second
      });

      expect(apiKey.isExpired()).toBe(false);
    });

    it('should handle keys without expiration', async () => {
      const apiKey = new ApiKey({
        name: 'Test Key',
        userId,
        scopes: ['read:users']
      });

      expect(apiKey.isExpired()).toBe(false);
    });

    it('should detect rate limiting', async () => {
      const apiKey = new ApiKey({
        name: 'Test Key',
        userId,
        scopes: ['read:users'],
        rateLimit: {
          requests: 2,
          window: 3600
        }
      });

      // Add usage that exceeds rate limit
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      apiKey.usage.dailyUsage.push({
        date: today,
        requests: 3
      });

      expect(apiKey.isRateLimited()).toBe(true);
    });

    it('should not rate limit within limits', async () => {
      const apiKey = new ApiKey({
        name: 'Test Key',
        userId,
        scopes: ['read:users'],
        rateLimit: {
          requests: 10,
          window: 3600
        }
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      apiKey.usage.dailyUsage.push({
        date: today,
        requests: 5
      });

      expect(apiKey.isRateLimited()).toBe(false);
    });
  });

  describe('Default Values', () => {
    it('should set default values correctly', async () => {
      const apiKey = new ApiKey({
        name: 'Test Key',
        userId,
        scopes: ['read:users']
      });

      const savedApiKey = await apiKey.save();

      expect(savedApiKey.isActive).toBe(true);
      expect(savedApiKey.environment).toBe('development');
      expect(savedApiKey.rateLimit.requests).toBe(1000);
      expect(savedApiKey.rateLimit.window).toBe(3600);
      expect(savedApiKey.usage.totalRequests).toBe(0);
      expect(savedApiKey.usage.dailyUsage).toEqual([]);
      expect(savedApiKey.allowedIPs).toEqual([]);
      expect(savedApiKey.allowedDomains).toEqual([]);
    });
  });

  describe('Indexes', () => {
    it('should enforce unique keyId', async () => {
      const apiKey1 = new ApiKey({
        name: 'Key 1',
        userId,
        scopes: ['read:users'],
        keyId: 'test_key_id'
      });

      const apiKey2 = new ApiKey({
        name: 'Key 2',
        userId,
        scopes: ['read:users'],
        keyId: 'test_key_id'
      });

      await apiKey1.save();

      let error;
      try {
        await apiKey2.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.code).toBe(11000); // Duplicate key error
    });
  });
});