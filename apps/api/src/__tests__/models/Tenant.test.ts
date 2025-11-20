import mongoose from 'mongoose';
import { Tenant, ITenant } from '../../models/Tenant';

describe('Tenant Model', () => {
  beforeAll(async () => {
    const mongoUri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/test_PharmacyCopilot';
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Tenant.deleteMany({});
  });

  describe('Model Validation', () => {
    it('should create a valid Tenant', async () => {
      const adminId = new mongoose.Types.ObjectId();
      const subscriptionPlanId = new mongoose.Types.ObjectId();
      const primaryContactId = new mongoose.Types.ObjectId();
      
      const tenantData = {
        name: 'Test Pharmacy',
        slug: 'test-pharmacy',
        type: 'pharmacy' as const,
        subscriptionPlan: subscriptionPlanId,
        contactInfo: {
          email: 'contact@testpharmacy.com',
          phone: '+1234567890',
          address: {
            street: '123 Main St',
            city: 'Test City',
            state: 'Test State',
            country: 'Test Country',
            postalCode: '12345',
          },
          website: 'https://testpharmacy.com',
        },
        primaryContact: {
          userId: primaryContactId,
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@testpharmacy.com',
          phone: '+1234567890',
        },
        settings: {
          timezone: 'America/New_York',
          currency: 'USD',
          language: 'en',
          dateFormat: 'MM/DD/YYYY',
          timeFormat: '12h' as const,
        },
      };

      const tenant = await Tenant.createTenant(tenantData, adminId);
      
      expect(tenant._id).toBeDefined();
      expect(tenant.name).toBe('Test Pharmacy');
      expect(tenant.slug).toBe('test-pharmacy');
      expect(tenant.status).toBe('pending');
      expect(tenant.subscriptionStatus).toBe('trialing');
      expect(tenant.branding.primaryColor).toBe('#3B82F6');
      expect(tenant.limits.maxUsers).toBe(10);
      expect(tenant.usageMetrics.currentUsers).toBe(0);
    });

    it('should require mandatory fields', async () => {
      const incompleteTenant = new Tenant({
        name: 'Test Pharmacy',
        // Missing required fields
      });

      await expect(incompleteTenant.save()).rejects.toThrow();
    });

    it('should validate email format', async () => {
      const adminId = new mongoose.Types.ObjectId();
      const subscriptionPlanId = new mongoose.Types.ObjectId();
      const primaryContactId = new mongoose.Types.ObjectId();
      
      const invalidTenant = new Tenant({
        name: 'Test Pharmacy',
        slug: 'test-pharmacy',
        type: 'pharmacy',
        subscriptionPlan: subscriptionPlanId,
        contactInfo: {
          email: 'invalid-email', // Invalid email format
          address: {
            street: '123 Main St',
            city: 'Test City',
            state: 'Test State',
            country: 'Test Country',
            postalCode: '12345',
          },
        },
        primaryContact: {
          userId: primaryContactId,
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@testpharmacy.com',
        },
        settings: {
          timezone: 'UTC',
          currency: 'USD',
          language: 'en',
          dateFormat: 'MM/DD/YYYY',
          timeFormat: '12h',
        },
        branding: {
          primaryColor: '#3B82F6',
          secondaryColor: '#6B7280',
        },
        limits: {
          maxUsers: 10,
          maxPatients: 1000,
          storageLimit: 5000,
          apiCallsPerMonth: 10000,
          maxWorkspaces: 1,
          maxIntegrations: 5,
        },
        usageMetrics: {
          currentUsers: 0,
          currentPatients: 0,
          storageUsed: 0,
          apiCallsThisMonth: 0,
          lastCalculatedAt: new Date(),
        },
        createdBy: adminId,
        lastModifiedBy: adminId,
      });

      await expect(invalidTenant.save()).rejects.toThrow();
    });

    it('should validate slug format', async () => {
      const adminId = new mongoose.Types.ObjectId();
      
      const invalidTenant = {
        name: 'Test Pharmacy',
        slug: 'Invalid Slug!', // Invalid slug format
        type: 'pharmacy' as const,
        subscriptionPlan: new mongoose.Types.ObjectId(),
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
          userId: new mongoose.Types.ObjectId(),
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@testpharmacy.com',
        },
        settings: {
          timezone: 'UTC',
          currency: 'USD',
          language: 'en',
          dateFormat: 'MM/DD/YYYY',
          timeFormat: '12h' as const,
        },
      };

      await expect(Tenant.createTenant(invalidTenant, adminId)).rejects.toThrow();
    });

    it('should validate color format in branding', async () => {
      const adminId = new mongoose.Types.ObjectId();
      const subscriptionPlanId = new mongoose.Types.ObjectId();
      const primaryContactId = new mongoose.Types.ObjectId();
      
      const invalidTenant = new Tenant({
        name: 'Test Pharmacy',
        slug: 'test-pharmacy',
        type: 'pharmacy',
        subscriptionPlan: subscriptionPlanId,
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
          userId: primaryContactId,
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@testpharmacy.com',
        },
        settings: {
          timezone: 'UTC',
          currency: 'USD',
          language: 'en',
          dateFormat: 'MM/DD/YYYY',
          timeFormat: '12h',
        },
        branding: {
          primaryColor: 'invalid-color', // Invalid color format
          secondaryColor: '#6B7280',
        },
        limits: {
          maxUsers: 10,
          maxPatients: 1000,
          storageLimit: 5000,
          apiCallsPerMonth: 10000,
          maxWorkspaces: 1,
          maxIntegrations: 5,
        },
        usageMetrics: {
          currentUsers: 0,
          currentPatients: 0,
          storageUsed: 0,
          apiCallsThisMonth: 0,
          lastCalculatedAt: new Date(),
        },
        createdBy: adminId,
        lastModifiedBy: adminId,
      });

      await expect(invalidTenant.save()).rejects.toThrow();
    });

    it('should enforce unique slug', async () => {
      const adminId = new mongoose.Types.ObjectId();
      
      const tenant1Data = {
        name: 'Test Pharmacy 1',
        slug: 'test-pharmacy',
        type: 'pharmacy' as const,
        subscriptionPlan: new mongoose.Types.ObjectId(),
        contactInfo: {
          email: 'contact1@testpharmacy.com',
          address: {
            street: '123 Main St',
            city: 'Test City',
            state: 'Test State',
            country: 'Test Country',
            postalCode: '12345',
          },
        },
        primaryContact: {
          userId: new mongoose.Types.ObjectId(),
          firstName: 'John',
          lastName: 'Doe',
          email: 'john1@testpharmacy.com',
        },
        settings: {
          timezone: 'UTC',
          currency: 'USD',
          language: 'en',
          dateFormat: 'MM/DD/YYYY',
          timeFormat: '12h' as const,
        },
      };

      await Tenant.createTenant(tenant1Data, adminId);

      const tenant2Data = {
        ...tenant1Data,
        name: 'Test Pharmacy 2',
        contactInfo: {
          ...tenant1Data.contactInfo,
          email: 'contact2@testpharmacy.com',
        },
        primaryContact: {
          ...tenant1Data.primaryContact,
          userId: new mongoose.Types.ObjectId(),
          email: 'john2@testpharmacy.com',
        },
      };

      await expect(Tenant.createTenant(tenant2Data, adminId)).rejects.toThrow();
    });
  });

  describe('Methods', () => {
    let tenant: ITenant;
    const adminId = new mongoose.Types.ObjectId();

    beforeEach(async () => {
      const tenantData = {
        name: 'Test Pharmacy',
        slug: 'test-pharmacy',
        type: 'pharmacy' as const,
        subscriptionPlan: new mongoose.Types.ObjectId(),
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
          userId: new mongoose.Types.ObjectId(),
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@testpharmacy.com',
        },
        settings: {
          timezone: 'UTC',
          currency: 'USD',
          language: 'en',
          dateFormat: 'MM/DD/YYYY',
          timeFormat: '12h' as const,
        },
      };

      tenant = await Tenant.createTenant(tenantData, adminId);
    });

    it('should check if tenant is active', () => {
      expect(tenant.isActive()).toBe(false); // Default is pending status
      
      tenant.status = 'active';
      tenant.subscriptionStatus = 'active';
      expect(tenant.isActive()).toBe(true);
      
      tenant.subscriptionStatus = 'trialing';
      expect(tenant.isActive()).toBe(true);
      
      tenant.status = 'suspended';
      expect(tenant.isActive()).toBe(false);
    });

    it('should check if trial is expired', () => {
      tenant.subscriptionStatus = 'trialing';
      
      // No trial end date
      expect(tenant.isTrialExpired()).toBe(false);
      
      // Future trial end date
      tenant.trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
      expect(tenant.isTrialExpired()).toBe(false);
      
      // Past trial end date
      tenant.trialEndsAt = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day ago
      expect(tenant.isTrialExpired()).toBe(true);
      
      // Not in trial
      tenant.subscriptionStatus = 'active';
      expect(tenant.isTrialExpired()).toBe(false);
    });

    it('should check if tenant has feature', () => {
      tenant.features = ['feature1', 'feature2'];
      
      expect(tenant.hasFeature('feature1')).toBe(true);
      expect(tenant.hasFeature('feature3')).toBe(false);
    });

    it('should check if tenant is within limits', () => {
      // Within limits
      let result = tenant.isWithinLimits();
      expect(result.withinLimits).toBe(true);
      expect(result.violations).toHaveLength(0);
      
      // Exceed user limit
      tenant.usageMetrics.currentUsers = 15; // Limit is 10
      result = tenant.isWithinLimits();
      expect(result.withinLimits).toBe(false);
      expect(result.violations).toContain('User limit exceeded: 15/10');
      
      // Exceed multiple limits
      tenant.usageMetrics.storageUsed = 6000; // Limit is 5000
      result = tenant.isWithinLimits();
      expect(result.withinLimits).toBe(false);
      expect(result.violations).toHaveLength(2);
    });

    it('should update usage metrics', () => {
      const newMetrics = {
        currentUsers: 5,
        storageUsed: 1000,
      };
      
      tenant.updateUsageMetrics(newMetrics);
      
      expect(tenant.usageMetrics.currentUsers).toBe(5);
      expect(tenant.usageMetrics.storageUsed).toBe(1000);
      expect(tenant.usageMetrics.lastCalculatedAt).toBeDefined();
    });

    it('should add integration', () => {
      const integration = {
        name: 'Test EHR',
        type: 'ehr' as const,
        provider: 'Test Provider',
        configuration: { apiKey: 'test-key' },
      };
      
      tenant.addIntegration(integration);
      
      expect(tenant.integrations).toHaveLength(1);
      expect(tenant.integrations[0].name).toBe('Test EHR');
      expect(tenant.integrations[0].isActive).toBe(false);
      expect(tenant.integrations[0].syncStatus).toBe('disabled');
    });

    it('should throw error when adding integration exceeds limit', () => {
      // Fill up to limit
      for (let i = 0; i < tenant.limits.maxIntegrations; i++) {
        tenant.addIntegration({
          name: `Integration ${i}`,
          type: 'other',
          provider: 'Test Provider',
          configuration: {},
        });
      }
      
      // Try to add one more
      expect(() => {
        tenant.addIntegration({
          name: 'Extra Integration',
          type: 'other',
          provider: 'Test Provider',
          configuration: {},
        });
      }).toThrow('Integration limit exceeded');
    });

    it('should update integration status', () => {
      tenant.addIntegration({
        name: 'Test Integration',
        type: 'ehr',
        provider: 'Test Provider',
        configuration: {},
      });
      
      tenant.updateIntegrationStatus('Test Integration', 'success');
      
      const integration = tenant.integrations.find(i => i.name === 'Test Integration');
      expect(integration?.syncStatus).toBe('success');
      expect(integration?.lastSyncAt).toBeDefined();
    });

    it('should suspend and reactivate tenant', () => {
      tenant.suspend('Payment overdue');
      
      expect(tenant.status).toBe('suspended');
      expect(tenant.metadata.suspensionReason).toBe('Payment overdue');
      expect(tenant.metadata.suspendedAt).toBeDefined();
      
      tenant.reactivate();
      
      expect(tenant.status).toBe('active');
      expect(tenant.metadata.suspensionReason).toBeUndefined();
      expect(tenant.metadata.suspendedAt).toBeUndefined();
    });

    it('should exclude sensitive data in JSON output', () => {
      tenant.billingInfo.paymentMethodId = 'sensitive-payment-method-id';
      
      const jsonOutput = tenant.toJSON();
      
      expect(jsonOutput).not.toHaveProperty('__v');
      expect(jsonOutput.billingInfo).not.toHaveProperty('paymentMethodId');
    });
  });

  describe('Static Methods', () => {
    const adminId = new mongoose.Types.ObjectId();

    beforeEach(async () => {
      // Create test tenants
      const tenants = [
        {
          name: 'Active Pharmacy',
          slug: 'active-pharmacy',
          status: 'active',
          subscriptionStatus: 'active',
        },
        {
          name: 'Trial Pharmacy',
          slug: 'trial-pharmacy',
          status: 'active',
          subscriptionStatus: 'trialing',
          trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        },
        {
          name: 'Expired Trial Pharmacy',
          slug: 'expired-trial-pharmacy',
          status: 'active',
          subscriptionStatus: 'trialing',
          trialEndsAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        },
        {
          name: 'Suspended Pharmacy',
          slug: 'suspended-pharmacy',
          status: 'suspended',
          subscriptionStatus: 'active',
        },
      ];

      for (const tenantData of tenants) {
        await Tenant.createTenant({
          ...tenantData,
          type: 'pharmacy' as const,
          subscriptionPlan: new mongoose.Types.ObjectId(),
          contactInfo: {
            email: `contact@${tenantData.slug}.com`,
            address: {
              street: '123 Main St',
              city: 'Test City',
              state: 'Test State',
              country: 'Test Country',
              postalCode: '12345',
            },
          },
          primaryContact: {
            userId: new mongoose.Types.ObjectId(),
            firstName: 'John',
            lastName: 'Doe',
            email: `john@${tenantData.slug}.com`,
          },
          settings: {
            timezone: 'UTC',
            currency: 'USD',
            language: 'en',
            dateFormat: 'MM/DD/YYYY',
            timeFormat: '12h' as const,
          },
        }, adminId);
      }
    });

    it('should find tenant by slug', async () => {
      const tenant = await Tenant.findBySlug('active-pharmacy');
      
      expect(tenant).toBeDefined();
      expect(tenant?.name).toBe('Active Pharmacy');
    });

    it('should find active tenants', async () => {
      const activeTenants = await Tenant.findActiveTenants();
      
      expect(activeTenants).toHaveLength(2); // Active and Trial (not expired)
      expect(activeTenants.every(t => t.status === 'active')).toBe(true);
      expect(activeTenants.every(t => ['active', 'trialing'].includes(t.subscriptionStatus))).toBe(true);
    });

    it('should find expired trials', async () => {
      const expiredTrials = await Tenant.findExpiredTrials();
      
      expect(expiredTrials).toHaveLength(1);
      expect(expiredTrials[0].name).toBe('Expired Trial Pharmacy');
    });

    it('should get tenant stats', async () => {
      const stats = await Tenant.getTenantStats();
      
      expect(stats).toHaveLength(1);
      expect(stats[0].totalTenants).toBe(4);
      expect(stats[0].activeTenants).toBe(3); // Active, Trial, Expired Trial
      expect(stats[0].trialTenants).toBe(2); // Trial and Expired Trial
      expect(stats[0].suspendedTenants).toBe(1);
    });

    it('should find tenants exceeding limits', async () => {
      // Update one tenant to exceed limits
      await Tenant.updateOne(
        { slug: 'active-pharmacy' },
        { 
          'usageMetrics.currentUsers': 15, // Exceeds default limit of 10
          'usageMetrics.storageUsed': 6000, // Exceeds default limit of 5000
        }
      );
      
      const exceedingTenants = await Tenant.findTenantsExceedingLimits();
      
      expect(exceedingTenants).toHaveLength(1);
      expect(exceedingTenants[0].name).toBe('Active Pharmacy');
    });
  });

  describe('Indexes', () => {
    it('should have proper indexes', async () => {
      const indexes = await Tenant.collection.getIndexes();
      
      expect(indexes).toHaveProperty('slug_1');
      expect(indexes).toHaveProperty('status_1_type_1');
      expect(indexes).toHaveProperty('subscriptionStatus_1');
    });
  });
});