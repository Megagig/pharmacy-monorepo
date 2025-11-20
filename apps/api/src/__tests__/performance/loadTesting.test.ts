import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../app';
import { Tenant } from '../../models/Tenant';
import { User } from '../../models/User';
import { BillingSubscription } from '../../models/BillingSubscription';
import { generateTestToken } from '../utils/testHelpers';

describe('Load Testing and Performance Tests', () => {
  let mongoServer: MongoMemoryServer;
  let adminToken: string;
  let testTenants: any[] = [];

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Create admin token
    adminToken = generateTestToken({
      userId: 'admin123',
      role: 'super_admin',
      permissions: ['tenant:read', 'tenant:write', 'billing:read', 'user:read']
    });

    // Create test data for load testing
    console.log('Setting up test data for load testing...');
    await setupTestData();
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  async function setupTestData() {
    // Create 100 test tenants
    const tenants = [];
    for (let i = 0; i < 100; i++) {
      tenants.push({
        name: `Load Test Tenant ${i}`,
        domain: `loadtest${i}.example.com`,
        plan: i % 3 === 0 ? 'basic' : i % 3 === 1 ? 'premium' : 'enterprise',
        status: i % 10 === 0 ? 'suspended' : 'active',
        adminEmail: `admin${i}@loadtest.com`
      });
    }
    testTenants = await Tenant.insertMany(tenants);

    // Create users for each tenant (5 users per tenant)
    const users = [];
    for (const tenant of testTenants) {
      for (let j = 0; j < 5; j++) {
        users.push({
          firstName: `User${j}`,
          lastName: `Tenant${tenant.name.split(' ')[3]}`,
          email: `user${j}@${tenant.domain}`,
          tenantId: tenant._id,
          role: j === 0 ? 'admin' : 'user',
          isActive: j % 4 !== 0 // 75% active users
        });
      }
    }
    await User.insertMany(users);

    // Create subscriptions for active tenants
    const subscriptions = [];
    for (const tenant of testTenants.filter(t => t.status === 'active')) {
      subscriptions.push({
        tenantId: tenant._id,
        plan: tenant.plan,
        status: 'active',
        amount: tenant.plan === 'basic' ? 29.99 : tenant.plan === 'premium' ? 99.99 : 199.99,
        currency: 'USD',
        billingCycle: 'monthly',
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });
    }
    await BillingSubscription.insertMany(subscriptions);

    console.log(`Created ${testTenants.length} tenants, ${users.length} users, and ${subscriptions.length} subscriptions`);
  }

  describe('Tenant Management Load Tests', () => {
    it('should handle concurrent tenant list requests', async () => {
      const concurrentRequests = 50;
      const startTime = Date.now();

      // Create array of promises for concurrent requests
      const requests = Array(concurrentRequests).fill(null).map(() =>
        request(app)
          .get('/api/saas/tenants')
          .set('Authorization', `Bearer ${adminToken}`)
          .query({ page: 1, limit: 20 })
      );

      // Execute all requests concurrently
      const responses = await Promise.all(requests);

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgResponseTime = totalTime / concurrentRequests;

      // Verify all requests succeeded
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.tenants).toBeDefined();
      });

      // Performance assertions
      expect(avgResponseTime).toBeLessThan(1000); // Average response time should be under 1 second
      expect(totalTime).toBeLessThan(5000); // Total time for all requests should be under 5 seconds

      console.log(`Concurrent tenant requests: ${concurrentRequests} requests in ${totalTime}ms (avg: ${avgResponseTime}ms)`);
    });

    it('should handle high-frequency tenant creation', async () => {
      const numberOfTenants = 20;
      const startTime = Date.now();

      const createRequests = Array(numberOfTenants).fill(null).map((_, index) =>
        request(app)
          .post('/api/saas/tenants')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: `Perf Test Tenant ${index}`,
            domain: `perftest${index}.example.com`,
            plan: 'basic',
            adminEmail: `admin${index}@perftest.com`
          })
      );

      const responses = await Promise.all(createRequests);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Verify all creations succeeded
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });

      // Performance assertion
      expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds

      console.log(`Created ${numberOfTenants} tenants in ${totalTime}ms`);
    });

    it('should handle complex tenant queries with filters', async () => {
      const queries = [
        { status: 'active', plan: 'premium' },
        { status: 'suspended' },
        { plan: 'enterprise' },
        { search: 'Load Test' },
        { page: 2, limit: 10 }
      ];

      const startTime = Date.now();

      const queryRequests = queries.map(query =>
        request(app)
          .get('/api/saas/tenants')
          .set('Authorization', `Bearer ${adminToken}`)
          .query(query)
      );

      const responses = await Promise.all(queryRequests);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Verify all queries succeeded
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Performance assertion
      expect(totalTime).toBeLessThan(3000); // All complex queries should complete within 3 seconds

      console.log(`Complex tenant queries completed in ${totalTime}ms`);
    });
  });

  describe('User Management Load Tests', () => {
    it('should handle large user list pagination efficiently', async () => {
      const pages = [1, 2, 3, 4, 5];
      const startTime = Date.now();

      const pageRequests = pages.map(page =>
        request(app)
          .get('/api/saas/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .query({ page, limit: 50 })
      );

      const responses = await Promise.all(pageRequests);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Verify all requests succeeded
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.users).toBeDefined();
      });

      // Performance assertion
      expect(totalTime).toBeLessThan(2000); // Should complete within 2 seconds

      console.log(`User pagination requests completed in ${totalTime}ms`);
    });

    it('should handle concurrent user searches', async () => {
      const searchTerms = ['User0', 'User1', 'User2', 'admin', 'Tenant1'];
      const concurrentSearches = 10;

      const startTime = Date.now();

      const searchRequests = [];
      for (let i = 0; i < concurrentSearches; i++) {
        const searchTerm = searchTerms[i % searchTerms.length];
        searchRequests.push(
          request(app)
            .get('/api/saas/users')
            .set('Authorization', `Bearer ${adminToken}`)
            .query({ search: searchTerm, limit: 20 })
        );
      }

      const responses = await Promise.all(searchRequests);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Verify all searches succeeded
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Performance assertion
      expect(totalTime).toBeLessThan(3000); // Should complete within 3 seconds

      console.log(`Concurrent user searches completed in ${totalTime}ms`);
    });
  });

  describe('Billing System Load Tests', () => {
    it('should handle concurrent subscription queries', async () => {
      const concurrentRequests = 30;
      const startTime = Date.now();

      const requests = Array(concurrentRequests).fill(null).map(() =>
        request(app)
          .get('/api/saas/billing/subscriptions')
          .set('Authorization', `Bearer ${adminToken}`)
          .query({ page: 1, limit: 25 })
      );

      const responses = await Promise.all(requests);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Verify all requests succeeded
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Performance assertion
      expect(totalTime).toBeLessThan(4000); // Should complete within 4 seconds

      console.log(`Concurrent subscription queries completed in ${totalTime}ms`);
    });

    it('should handle analytics calculations efficiently', async () => {
      const analyticsRequests = [
        { startDate: '2024-01-01', endDate: '2024-01-31' },
        { startDate: '2024-02-01', endDate: '2024-02-29' },
        { startDate: '2024-03-01', endDate: '2024-03-31' }
      ];

      const startTime = Date.now();

      const requests = analyticsRequests.map(params =>
        request(app)
          .get('/api/saas/billing/analytics')
          .set('Authorization', `Bearer ${adminToken}`)
          .query(params)
      );

      const responses = await Promise.all(requests);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Verify all analytics requests succeeded
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('totalRevenue');
        expect(response.body.data).toHaveProperty('activeSubscriptions');
      });

      // Performance assertion
      expect(totalTime).toBeLessThan(5000); // Analytics should complete within 5 seconds

      console.log(`Analytics calculations completed in ${totalTime}ms`);
    });
  });

  describe('Database Performance Tests', () => {
    it('should handle complex aggregation queries efficiently', async () => {
      const startTime = Date.now();

      // Simulate complex dashboard query
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
          $lookup: {
            from: 'billingsubscriptions',
            localField: '_id',
            foreignField: 'tenantId',
            as: 'subscriptions'
          }
        },
        {
          $project: {
            name: 1,
            plan: 1,
            status: 1,
            userCount: { $size: '$users' },
            activeUsers: {
              $size: {
                $filter: {
                  input: '$users',
                  cond: { $eq: ['$$this.isActive', true] }
                }
              }
            },
            subscriptionStatus: { $arrayElemAt: ['$subscriptions.status', 0] },
            monthlyRevenue: { $arrayElemAt: ['$subscriptions.amount', 0] }
          }
        },
        {
          $group: {
            _id: '$plan',
            totalTenants: { $sum: 1 },
            activeTenants: {
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
            },
            totalUsers: { $sum: '$userCount' },
            totalActiveUsers: { $sum: '$activeUsers' },
            totalRevenue: { $sum: '$monthlyRevenue' }
          }
        }
      ]);

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      // Verify aggregation results
      expect(tenantStats).toBeDefined();
      expect(tenantStats.length).toBeGreaterThan(0);

      // Performance assertion
      expect(queryTime).toBeLessThan(2000); // Complex aggregation should complete within 2 seconds

      console.log(`Complex aggregation query completed in ${queryTime}ms`);
      console.log(`Aggregation results:`, tenantStats);
    });

    it('should handle bulk operations efficiently', async () => {
      const bulkUpdateCount = 50;
      const startTime = Date.now();

      // Bulk update tenant statuses
      const bulkOps = testTenants.slice(0, bulkUpdateCount).map(tenant => ({
        updateOne: {
          filter: { _id: tenant._id },
          update: { $set: { lastUpdated: new Date() } }
        }
      }));

      const result = await Tenant.bulkWrite(bulkOps);
      const endTime = Date.now();
      const operationTime = endTime - startTime;

      // Verify bulk operation succeeded
      expect(result.modifiedCount).toBe(bulkUpdateCount);

      // Performance assertion
      expect(operationTime).toBeLessThan(1000); // Bulk operations should be fast

      console.log(`Bulk update of ${bulkUpdateCount} tenants completed in ${operationTime}ms`);
    });
  });

  describe('Memory and Resource Usage Tests', () => {
    it('should not have memory leaks during repeated operations', async () => {
      const initialMemory = process.memoryUsage();
      const iterations = 100;

      // Perform repeated operations
      for (let i = 0; i < iterations; i++) {
        await request(app)
          .get('/api/saas/tenants')
          .set('Authorization', `Bearer ${adminToken}`)
          .query({ page: 1, limit: 10 });

        // Force garbage collection every 10 iterations if available
        if (i % 10 === 0 && global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100;

      console.log(`Memory usage - Initial: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB, Final: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`);
      console.log(`Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB (${memoryIncreasePercent.toFixed(2)}%)`);

      // Memory increase should be reasonable (less than 50% increase)
      expect(memoryIncreasePercent).toBeLessThan(50);
    });

    it('should handle high concurrent load without errors', async () => {
      const concurrentUsers = 100;
      const requestsPerUser = 5;
      const totalRequests = concurrentUsers * requestsPerUser;

      console.log(`Starting high load test: ${concurrentUsers} concurrent users, ${requestsPerUser} requests each`);

      const startTime = Date.now();
      const allRequests = [];

      // Create requests for concurrent users
      for (let user = 0; user < concurrentUsers; user++) {
        for (let req = 0; req < requestsPerUser; req++) {
          const endpoint = req % 3 === 0 ? '/api/saas/tenants' : 
                          req % 3 === 1 ? '/api/saas/users' : 
                          '/api/saas/billing/subscriptions';
          
          allRequests.push(
            request(app)
              .get(endpoint)
              .set('Authorization', `Bearer ${adminToken}`)
              .query({ page: 1, limit: 10 })
          );
        }
      }

      // Execute all requests concurrently
      const responses = await Promise.allSettled(allRequests);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Analyze results
      const successful = responses.filter(r => r.status === 'fulfilled' && r.value.status === 200).length;
      const failed = responses.length - successful;
      const successRate = (successful / responses.length) * 100;

      console.log(`High load test results:`);
      console.log(`- Total requests: ${totalRequests}`);
      console.log(`- Successful: ${successful} (${successRate.toFixed(2)}%)`);
      console.log(`- Failed: ${failed}`);
      console.log(`- Total time: ${totalTime}ms`);
      console.log(`- Average response time: ${(totalTime / totalRequests).toFixed(2)}ms`);

      // Performance assertions
      expect(successRate).toBeGreaterThan(95); // At least 95% success rate
      expect(totalTime).toBeLessThan(30000); // Should complete within 30 seconds
    });
  });
});