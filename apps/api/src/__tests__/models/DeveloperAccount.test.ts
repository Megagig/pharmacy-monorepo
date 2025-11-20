import mongoose from 'mongoose';
import DeveloperAccount, { IDeveloperAccount } from '../../models/DeveloperAccount';

describe('DeveloperAccount Model', () => {
  let userId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    userId = new mongoose.Types.ObjectId();
  });

  beforeEach(async () => {
    await DeveloperAccount.deleteMany({});
  });

  describe('Model Validation', () => {
    it('should create a valid developer account', async () => {
      const accountData = {
        userId,
        companyName: 'Test Company',
        website: 'https://test.com',
        description: 'Test description',
        contactEmail: 'test@example.com',
        contactPhone: '+1234567890',
        isVerified: false,
        subscriptionTier: 'free' as const,
        status: 'pending' as const
      };

      const account = new DeveloperAccount(accountData);
      const savedAccount = await account.save();

      expect(savedAccount._id).toBeDefined();
      expect(savedAccount.userId).toEqual(userId);
      expect(savedAccount.companyName).toBe(accountData.companyName);
      expect(savedAccount.contactEmail).toBe(accountData.contactEmail);
      expect(savedAccount.subscriptionTier).toBe(accountData.subscriptionTier);
      expect(savedAccount.status).toBe(accountData.status);
      expect(savedAccount.onboardingCompleted).toBe(false);
    });

    it('should require userId and contactEmail', async () => {
      const account = new DeveloperAccount({});

      let error;
      try {
        await account.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.userId).toBeDefined();
      expect(error.errors.contactEmail).toBeDefined();
    });

    it('should validate email format', async () => {
      const account = new DeveloperAccount({
        userId,
        contactEmail: 'invalid-email'
      });

      let error;
      try {
        await account.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.contactEmail).toBeDefined();
    });

    it('should validate website URL format', async () => {
      const account = new DeveloperAccount({
        userId,
        contactEmail: 'test@example.com',
        website: 'invalid-url'
      });

      let error;
      try {
        await account.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.website).toBeDefined();
    });

    it('should validate subscription tier enum', async () => {
      const account = new DeveloperAccount({
        userId,
        contactEmail: 'test@example.com',
        subscriptionTier: 'invalid_tier'
      });

      let error;
      try {
        await account.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.subscriptionTier).toBeDefined();
    });

    it('should validate status enum', async () => {
      const account = new DeveloperAccount({
        userId,
        contactEmail: 'test@example.com',
        status: 'invalid_status'
      });

      let error;
      try {
        await account.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.status).toBeDefined();
    });
  });

  describe('Default Values', () => {
    it('should set default values correctly', async () => {
      const account = new DeveloperAccount({
        userId,
        contactEmail: 'test@example.com'
      });

      const savedAccount = await account.save();

      expect(savedAccount.isVerified).toBe(false);
      expect(savedAccount.subscriptionTier).toBe('free');
      expect(savedAccount.status).toBe('pending');
      expect(savedAccount.onboardingCompleted).toBe(false);
      expect(savedAccount.apiQuota.monthly).toBe(10000);
      expect(savedAccount.apiQuota.daily).toBe(1000);
      expect(savedAccount.apiQuota.perMinute).toBe(60);
      expect(savedAccount.usage.currentMonth).toBe(0);
      expect(savedAccount.usage.currentDay).toBe(0);
      expect(savedAccount.preferences.emailNotifications).toBe(true);
      expect(savedAccount.preferences.webhookNotifications).toBe(true);
      expect(savedAccount.preferences.maintenanceAlerts).toBe(true);
      expect(savedAccount.preferences.usageAlerts).toBe(true);
    });
  });

  describe('Methods', () => {
    let account: IDeveloperAccount;

    beforeEach(async () => {
      account = new DeveloperAccount({
        userId,
        contactEmail: 'test@example.com'
      });
      await account.save();
    });

    it('should calculate onboarding progress correctly', () => {
      // Initially no steps completed
      expect(account.checkOnboardingProgress()).toBe(0);

      // Complete some steps
      account.onboardingSteps.profileSetup = true;
      account.onboardingSteps.emailVerification = true;
      expect(account.checkOnboardingProgress()).toBe(40); // 2 out of 5 steps

      // Complete all steps
      account.onboardingSteps.firstApiKey = true;
      account.onboardingSteps.firstApiCall = true;
      account.onboardingSteps.documentationRead = true;
      expect(account.checkOnboardingProgress()).toBe(100);
    });

    it('should check quota limits correctly', () => {
      // Within limits
      expect(account.isWithinQuota(1)).toBe(true);
      expect(account.isWithinQuota(100)).toBe(true);

      // Exceed daily limit
      account.usage.currentDay = 1000;
      expect(account.isWithinQuota(1)).toBe(false);

      // Reset daily usage
      account.usage.currentDay = 0;
      account.usage.currentMonth = 10000;
      expect(account.isWithinQuota(1)).toBe(false);
    });

    it('should increment usage correctly', () => {
      const initialMonth = account.usage.currentMonth;
      const initialDay = account.usage.currentDay;

      account.incrementUsage(5);

      expect(account.usage.currentMonth).toBe(initialMonth + 5);
      expect(account.usage.currentDay).toBe(initialDay + 5);
    });

    it('should reset daily usage on new day', () => {
      // Set usage for previous day
      account.usage.currentDay = 500;
      account.usage.lastReset = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago

      // Check quota (should reset daily usage)
      const withinQuota = account.isWithinQuota(1);

      expect(withinQuota).toBe(true);
      expect(account.usage.currentDay).toBe(0);
    });
  });

  describe('Indexes', () => {
    it('should enforce unique userId', async () => {
      const account1 = new DeveloperAccount({
        userId,
        contactEmail: 'test1@example.com'
      });

      const account2 = new DeveloperAccount({
        userId,
        contactEmail: 'test2@example.com'
      });

      await account1.save();

      let error;
      try {
        await account2.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.code).toBe(11000); // Duplicate key error
    });
  });

  describe('Queries', () => {
    beforeEach(async () => {
      const accounts = [
        {
          userId: new mongoose.Types.ObjectId(),
          contactEmail: 'user1@example.com',
          companyName: 'Company A',
          subscriptionTier: 'free',
          status: 'active',
          isVerified: true
        },
        {
          userId: new mongoose.Types.ObjectId(),
          contactEmail: 'user2@example.com',
          companyName: 'Company B',
          subscriptionTier: 'pro',
          status: 'pending',
          isVerified: false
        },
        {
          userId: new mongoose.Types.ObjectId(),
          contactEmail: 'user3@example.com',
          companyName: 'Company C',
          subscriptionTier: 'enterprise',
          status: 'suspended',
          isVerified: true
        }
      ];

      await DeveloperAccount.insertMany(accounts);
    });

    it('should find accounts by status', async () => {
      const activeAccounts = await DeveloperAccount.find({ status: 'active' });
      expect(activeAccounts).toHaveLength(1);
      expect(activeAccounts[0].companyName).toBe('Company A');
    });

    it('should find accounts by subscription tier', async () => {
      const proAccounts = await DeveloperAccount.find({ subscriptionTier: 'pro' });
      expect(proAccounts).toHaveLength(1);
      expect(proAccounts[0].companyName).toBe('Company B');
    });

    it('should find verified accounts', async () => {
      const verifiedAccounts = await DeveloperAccount.find({ isVerified: true });
      expect(verifiedAccounts).toHaveLength(2);
    });

    it('should search by company name', async () => {
      const accounts = await DeveloperAccount.find({
        companyName: { $regex: 'Company', $options: 'i' }
      });
      expect(accounts).toHaveLength(3);
    });
  });
});