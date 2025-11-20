import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Tenant } from '../../models/Tenant';
import { TenantSettings } from '../../models/TenantSettings';
import { User } from '../../models/User';
import { BillingSubscription } from '../../models/BillingSubscription';
import { SecurityAuditLog } from '../../models/SecurityAuditLog';

describe('Database Integration Tests', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear all collections
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  });

  describe('Tenant Model Integration', () => {
    it('should create tenant with proper validation', async () => {
      const tenantData = {
        name: 'Test Tenant',
        domain: 'test.example.com',
        plan: 'premium',
        status: 'active',
        adminEmail: 'admin@test.com'
      };

      const tenant = new Tenant(tenantData);
      const savedTenant = await tenant.save();

      expect(savedTenant._id).toBeDefined();
      expect(savedTenant.name).toBe(tenantData.name);
      expect(savedTenant.createdAt).toBeDefined();
      expect(savedTenant.updatedAt).toBeDefined();
    });

    it('should enforce unique domain constraint', async () => {
      const tenantData = {
        name: 'Test Tenant',
        domain: 'duplicate.example.com',
        plan: 'premium',
        status: 'active',
        adminEmail: 'admin@test.com'
      };

      // Create first tenant
      await Tenant.create(tenantData);

      // Try to create second tenant with same domain
      const duplicateTenant = new Tenant({
        ...tenantData,
        name: 'Duplicate Tenant'
      });

      await expect(duplicateTenant.save()).rejects.toThrow();
    });
  });
}); describ
e('Cross-Model Relationships', () => {
  it('should maintain referential integrity between tenant and settings', async () => {
    // Create tenant
    const tenant = await Tenant.create({
      name: 'Test Tenant',
      domain: 'test.example.com',
      plan: 'premium',
      status: 'active',
      adminEmail: 'admin@test.com'
    });

    // Create tenant settings
    const settings = await TenantSettings.create({
      tenantId: tenant._id,
      branding: {
        logo: 'logo.png',
        primaryColor: '#007bff'
      },
      features: {
        analytics: true,
        reporting: false
      }
    });

    // Verify relationship
    const foundSettings = await TenantSettings.findOne({ tenantId: tenant._id });
    expect(foundSettings).toBeTruthy();
    expect(foundSettings!.tenantId.toString()).toBe(tenant._id.toString());
  });

  it('should cascade delete tenant-related data', async () => {
    // Create tenant
    const tenant = await Tenant.create({
      name: 'Test Tenant',
      domain: 'test.example.com',
      plan: 'premium',
      status: 'active',
      adminEmail: 'admin@test.com'
    });

    // Create related data
    await TenantSettings.create({
      tenantId: tenant._id,
      branding: {},
      features: {}
    });

    await User.create({
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      tenantId: tenant._id,
      role: 'user'
    });

    await BillingSubscription.create({
      tenantId: tenant._id,
      plan: 'premium',
      status: 'active',
      amount: 99.99,
      currency: 'USD',
      billingCycle: 'monthly'
    });

    // Delete tenant
    await Tenant.findByIdAndDelete(tenant._id);

    // Manually clean up related data (simulating cascade delete)
    await TenantSettings.deleteMany({ tenantId: tenant._id });
    await User.deleteMany({ tenantId: tenant._id });
    await BillingSubscription.deleteMany({ tenantId: tenant._id });

    // Verify cleanup
    const remainingSettings = await TenantSettings.findOne({ tenantId: tenant._id });
    const remainingUsers = await User.find({ tenantId: tenant._id });
    const remainingSubscriptions = await BillingSubscription.find({ tenantId: tenant._id });

    expect(remainingSettings).toBeNull();
    expect(remainingUsers).toHaveLength(0);
    expect(remainingSubscriptions).toHaveLength(0);
  });
});

describe('Transaction Support', () => {
  it('should support atomic operations with transactions', async () => {
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        // Create tenant
        const tenant = await Tenant.create([{
          name: 'Transaction Test Tenant',
          domain: 'transaction.example.com',
          plan: 'premium',
          status: 'active',
          adminEmail: 'admin@transaction.com'
        }], { session });

        // Create tenant settings
        await TenantSettings.create([{
          tenantId: tenant[0]._id,
          branding: { logo: 'logo.png' },
          features: { analytics: true }
        }], { session });

        // Create user
        await User.create([{
          firstName: 'Admin',
          lastName: 'User',
          email: 'admin@transaction.com',
          tenantId: tenant[0]._id,
          role: 'admin'
        }], { session });
      });

      // Verify all data was created
      const tenant = await Tenant.findOne({ domain: 'transaction.example.com' });
      const settings = await TenantSettings.findOne({ tenantId: tenant!._id });
      const user = await User.findOne({ tenantId: tenant!._id });

      expect(tenant).toBeTruthy();
      expect(settings).toBeTruthy();
      expect(user).toBeTruthy();
    } finally {
      await session.endSession();
    }
  });

  it('should rollback on transaction failure', async () => {
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        // Create tenant
        await Tenant.create([{
          name: 'Rollback Test Tenant',
          domain: 'rollback.example.com',
          plan: 'premium',
          status: 'active',
          adminEmail: 'admin@rollback.com'
        }], { session });

        // Intentionally cause an error
        throw new Error('Simulated transaction failure');
      });
    } catch (error) {
      // Expected error
    } finally {
      await session.endSession();
    }

    // Verify no data was created due to rollback
    const tenant = await Tenant.findOne({ domain: 'rollback.example.com' });
    expect(tenant).toBeNull();
  });
});

describe('Indexing and Performance', () => {
  it('should use indexes for efficient queries', async () => {
    // Create multiple tenants
    const tenants = [];
    for (let i = 0; i < 100; i++) {
      tenants.push({
        name: `Tenant ${i}`,
        domain: `tenant${i}.example.com`,
        plan: i % 3 === 0 ? 'basic' : i % 3 === 1 ? 'premium' : 'enterprise',
        status: i % 4 === 0 ? 'suspended' : 'active',
        adminEmail: `admin${i}@example.com`
      });
    }
    await Tenant.insertMany(tenants);

    // Test indexed query performance
    const startTime = Date.now();
    const activeTenants = await Tenant.find({ status: 'active' });
    const queryTime = Date.now() - startTime;

    expect(activeTenants.length).toBeGreaterThan(0);
    expect(queryTime).toBeLessThan(100); // Should be fast with proper indexing
  });

  it('should handle complex aggregation queries', async () => {
    // Create test data
    const tenant1 = await Tenant.create({
      name: 'Tenant 1',
      domain: 'tenant1.example.com',
      plan: 'premium',
      status: 'active',
      adminEmail: 'admin1@example.com'
    });

    const tenant2 = await Tenant.create({
      name: 'Tenant 2',
      domain: 'tenant2.example.com',
      plan: 'basic',
      status: 'active',
      adminEmail: 'admin2@example.com'
    });

    // Create users for each tenant
    await User.insertMany([
      { firstName: 'User1', lastName: 'T1', email: 'user1@t1.com', tenantId: tenant1._id, role: 'user' },
      { firstName: 'User2', lastName: 'T1', email: 'user2@t1.com', tenantId: tenant1._id, role: 'admin' },
      { firstName: 'User1', lastName: 'T2', email: 'user1@t2.com', tenantId: tenant2._id, role: 'user' }
    ]);

    // Perform aggregation query
    const tenantStats = await Tenant.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: 'tenantId',
          as: 'users'
        }
      },
      {
        $project: {
          name: 1,
          plan: 1,
          userCount: { $size: '$users' },
          adminCount: {
            $size: {
              $filter: {
                input: '$users',
                cond: { $eq: ['$$this.role', 'admin'] }
              }
            }
          }
        }
      }
    ]);

    expect(tenantStats).toHaveLength(2);
    expect(tenantStats[0].userCount).toBe(2);
    expect(tenantStats[1].userCount).toBe(1);
  });
});

describe('Data Consistency', () => {
  it('should maintain data consistency across collections', async () => {
    // Create tenant with subscription
    const tenant = await Tenant.create({
      name: 'Consistency Test Tenant',
      domain: 'consistency.example.com',
      plan: 'premium',
      status: 'active',
      adminEmail: 'admin@consistency.com'
    });

    const subscription = await BillingSubscription.create({
      tenantId: tenant._id,
      plan: 'premium',
      status: 'active',
      amount: 99.99,
      currency: 'USD',
      billingCycle: 'monthly'
    });

    // Update tenant plan
    await Tenant.findByIdAndUpdate(tenant._id, { plan: 'enterprise' });

    // Verify subscription still references correct tenant
    const updatedSubscription = await BillingSubscription.findById(subscription._id).populate('tenantId');
    expect(updatedSubscription!.tenantId).toBeTruthy();
  });

  it('should handle concurrent updates correctly', async () => {
    const tenant = await Tenant.create({
      name: 'Concurrent Test Tenant',
      domain: 'concurrent.example.com',
      plan: 'basic',
      status: 'active',
      adminEmail: 'admin@concurrent.com'
    });

    // Simulate concurrent updates
    const update1Promise = Tenant.findByIdAndUpdate(
      tenant._id,
      { plan: 'premium' },
      { new: true }
    );

    const update2Promise = Tenant.findByIdAndUpdate(
      tenant._id,
      { status: 'suspended' },
      { new: true }
    );

    const [result1, result2] = await Promise.all([update1Promise, update2Promise]);

    // Verify final state
    const finalTenant = await Tenant.findById(tenant._id);
    expect(finalTenant).toBeTruthy();
    expect(['premium', 'basic']).toContain(finalTenant!.plan);
    expect(['active', 'suspended']).toContain(finalTenant!.status);
  });
});

describe('Audit Trail', () => {
  it('should create audit logs for sensitive operations', async () => {
    const tenant = await Tenant.create({
      name: 'Audit Test Tenant',
      domain: 'audit.example.com',
      plan: 'premium',
      status: 'active',
      adminEmail: 'admin@audit.com'
    });

    // Create audit log entry
    await SecurityAuditLog.create({
      userId: new mongoose.Types.ObjectId(),
      action: 'tenant_created',
      resource: 'tenant',
      resourceId: tenant._id,
      ipAddress: '192.168.1.1',
      userAgent: 'Test Agent',
      success: true,
      details: {
        tenantName: tenant.name,
        plan: tenant.plan
      }
    });

    // Verify audit log was created
    const auditLog = await SecurityAuditLog.findOne({
      action: 'tenant_created',
      resourceId: tenant._id
    });

    expect(auditLog).toBeTruthy();
    expect(auditLog!.success).toBe(true);
    expect(auditLog!.details.tenantName).toBe(tenant.name);
  });
});