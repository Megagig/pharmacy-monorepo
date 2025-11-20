import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../app';
import { BillingSubscription } from '../../models/BillingSubscription';
import { BillingInvoice } from '../../models/BillingInvoice';
import { Tenant } from '../../models/Tenant';
import { generateTestToken } from '../utils/testHelpers';

describe('Billing Subscriptions Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let adminToken: string;
  let testTenant: any;
  let testSubscription: any;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Create admin user and token
    adminToken = generateTestToken({
      userId: 'admin123',
      role: 'super_admin',
      permissions: ['billing:read', 'billing:write', 'billing:manage']
    });
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear collections
    await BillingSubscription.deleteMany({});
    await BillingInvoice.deleteMany({});
    await Tenant.deleteMany({});

    // Create test tenant
    testTenant = await Tenant.create({
      name: 'Test Tenant',
      domain: 'test.example.com',
      plan: 'premium',
      status: 'active',
      adminEmail: 'admin@test.com'
    });

    // Create test subscription
    testSubscription = await BillingSubscription.create({
      tenantId: testTenant._id,
      plan: 'premium',
      status: 'active',
      amount: 99.99,
      currency: 'USD',
      billingCycle: 'monthly',
      nextBillingDate: new Date('2024-02-01'),
      paymentMethod: {
        type: 'card',
        last4: '4242',
        brand: 'visa'
      }
    });
  });

  describe('GET /api/saas/billing/subscriptions', () => {
    beforeEach(async () => {
      // Create additional test subscriptions
      await BillingSubscription.create([
        {
          tenantId: new mongoose.Types.ObjectId(),
          plan: 'basic',
          status: 'active',
          amount: 29.99,
          currency: 'USD',
          billingCycle: 'monthly',
          nextBillingDate: new Date('2024-02-15')
        },
        {
          tenantId: new mongoose.Types.ObjectId(),
          plan: 'enterprise',
          status: 'cancelled',
          amount: 199.99,
          currency: 'USD',
          billingCycle: 'monthly',
          nextBillingDate: null,
          cancelledAt: new Date()
        }
      ]);
    });

    it('should return paginated list of subscriptions', async () => {
      const response = await request(app)
        .get('/api/saas/billing/subscriptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.subscriptions).toHaveLength(3);
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.total).toBe(3);
    });

    it('should filter subscriptions by status', async () => {
      const response = await request(app)
        .get('/api/saas/billing/subscriptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ status: 'active' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.subscriptions).toHaveLength(2);
      response.body.data.subscriptions.forEach((sub: any) => {
        expect(sub.status).toBe('active');
      });
    });

    it('should filter subscriptions by plan', async () => {
      const response = await request(app)
        .get('/api/saas/billing/subscriptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ plan: 'premium' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.subscriptions).toHaveLength(1);
      expect(response.body.data.subscriptions[0].plan).toBe('premium');
    });

    it('should search subscriptions by tenant', async () => {
      const response = await request(app)
        .get('/api/saas/billing/subscriptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ search: testTenant._id.toString() })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.subscriptions).toHaveLength(1);
      expect(response.body.data.subscriptions[0].tenantId).toBe(testTenant._id.toString());
    });
  });

  describe('GET /api/saas/billing/subscriptions/:id', () => {
    it('should return subscription by ID', async () => {
      const response = await request(app)
        .get(`/api/saas/billing/subscriptions/${testSubscription._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data._id).toBe(testSubscription._id.toString());
      expect(response.body.data.plan).toBe(testSubscription.plan);
      expect(response.body.data.amount).toBe(testSubscription.amount);
    });

    it('should return 404 for non-existent subscription', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .get(`/api/saas/billing/subscriptions/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });
  });

  describe('POST /api/saas/billing/subscriptions', () => {
    it('should create a new subscription successfully', async () => {
      const subscriptionData = {
        tenantId: testTenant._id,
        plan: 'basic',
        billingCycle: 'monthly',
        paymentMethod: {
          type: 'card',
          token: 'tok_visa'
        }
      };

      const response = await request(app)
        .post('/api/saas/billing/subscriptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(subscriptionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tenantId).toBe(testTenant._id.toString());
      expect(response.body.data.plan).toBe(subscriptionData.plan);
      expect(response.body.data.status).toBe('active');

      // Verify subscription was created in database
      const createdSubscription = await BillingSubscription.findById(response.body.data._id);
      expect(createdSubscription).toBeTruthy();
    });

    it('should return 400 for invalid subscription data', async () => {
      const invalidData = {
        tenantId: 'invalid-id',
        plan: 'invalid-plan'
      };

      const response = await request(app)
        .post('/api/saas/billing/subscriptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should return 409 for tenant with existing active subscription', async () => {
      const subscriptionData = {
        tenantId: testTenant._id, // Already has active subscription
        plan: 'enterprise',
        billingCycle: 'monthly',
        paymentMethod: {
          type: 'card',
          token: 'tok_visa'
        }
      };

      const response = await request(app)
        .post('/api/saas/billing/subscriptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(subscriptionData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('active subscription');
    });
  });

  describe('PUT /api/saas/billing/subscriptions/:id', () => {
    it('should update subscription plan successfully', async () => {
      const updateData = {
        plan: 'enterprise',
        billingCycle: 'yearly'
      };

      const response = await request(app)
        .put(`/api/saas/billing/subscriptions/${testSubscription._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.plan).toBe(updateData.plan);
      expect(response.body.data.billingCycle).toBe(updateData.billingCycle);

      // Verify update in database
      const updatedSubscription = await BillingSubscription.findById(testSubscription._id);
      expect(updatedSubscription!.plan).toBe(updateData.plan);
      expect(updatedSubscription!.billingCycle).toBe(updateData.billingCycle);
    });

    it('should handle plan upgrade with prorated billing', async () => {
      const updateData = {
        plan: 'enterprise' // Upgrade from premium to enterprise
      };

      const response = await request(app)
        .put(`/api/saas/billing/subscriptions/${testSubscription._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.plan).toBe('enterprise');
      expect(response.body.data.amount).toBeGreaterThan(testSubscription.amount);
    });

    it('should return 404 for non-existent subscription', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const updateData = { plan: 'basic' };

      const response = await request(app)
        .put(`/api/saas/billing/subscriptions/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/saas/billing/subscriptions/:id/cancel', () => {
    it('should cancel subscription successfully', async () => {
      const cancellationData = {
        reason: 'Customer request',
        cancelAtPeriodEnd: true
      };

      const response = await request(app)
        .post(`/api/saas/billing/subscriptions/${testSubscription._id}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(cancellationData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('cancelled');

      // Verify cancellation in database
      const cancelledSubscription = await BillingSubscription.findById(testSubscription._id);
      expect(cancelledSubscription!.status).toBe('cancelled');
      expect(cancelledSubscription!.cancellationReason).toBe(cancellationData.reason);
      expect(cancelledSubscription!.cancelledAt).toBeDefined();
    });

    it('should handle immediate cancellation', async () => {
      const cancellationData = {
        reason: 'Immediate cancellation',
        cancelAtPeriodEnd: false
      };

      const response = await request(app)
        .post(`/api/saas/billing/subscriptions/${testSubscription._id}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(cancellationData)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify immediate cancellation
      const cancelledSubscription = await BillingSubscription.findById(testSubscription._id);
      expect(cancelledSubscription!.status).toBe('cancelled');
      expect(cancelledSubscription!.nextBillingDate).toBeNull();
    });

    it('should return 400 if subscription is already cancelled', async () => {
      // Cancel subscription first
      await BillingSubscription.findByIdAndUpdate(testSubscription._id, {
        status: 'cancelled',
        cancelledAt: new Date()
      });

      const response = await request(app)
        .post(`/api/saas/billing/subscriptions/${testSubscription._id}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Test' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already cancelled');
    });
  });

  describe('POST /api/saas/billing/subscriptions/:id/reactivate', () => {
    beforeEach(async () => {
      // Cancel the subscription first
      await BillingSubscription.findByIdAndUpdate(testSubscription._id, {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: 'Test cancellation'
      });
    });

    it('should reactivate subscription successfully', async () => {
      const reactivationData = {
        plan: 'premium',
        paymentMethod: {
          type: 'card',
          token: 'tok_visa'
        }
      };

      const response = await request(app)
        .post(`/api/saas/billing/subscriptions/${testSubscription._id}/reactivate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(reactivationData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('reactivated');

      // Verify reactivation in database
      const reactivatedSubscription = await BillingSubscription.findById(testSubscription._id);
      expect(reactivatedSubscription!.status).toBe('active');
      expect(reactivatedSubscription!.cancelledAt).toBeNull();
      expect(reactivatedSubscription!.cancellationReason).toBe('');
    });

    it('should return 400 if subscription is not cancelled', async () => {
      // Reactivate subscription first
      await BillingSubscription.findByIdAndUpdate(testSubscription._id, {
        status: 'active',
        cancelledAt: null,
        cancellationReason: ''
      });

      const response = await request(app)
        .post(`/api/saas/billing/subscriptions/${testSubscription._id}/reactivate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ plan: 'premium' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not cancelled');
    });
  });

  describe('GET /api/saas/billing/subscriptions/:id/invoices', () => {
    beforeEach(async () => {
      // Create test invoices
      await BillingInvoice.create([
        {
          subscriptionId: testSubscription._id,
          tenantId: testTenant._id,
          amount: 99.99,
          currency: 'USD',
          status: 'paid',
          dueDate: new Date('2024-01-01'),
          paidAt: new Date('2024-01-01'),
          items: [
            {
              description: 'Premium Plan - January 2024',
              amount: 99.99,
              quantity: 1
            }
          ]
        },
        {
          subscriptionId: testSubscription._id,
          tenantId: testTenant._id,
          amount: 99.99,
          currency: 'USD',
          status: 'pending',
          dueDate: new Date('2024-02-01'),
          items: [
            {
              description: 'Premium Plan - February 2024',
              amount: 99.99,
              quantity: 1
            }
          ]
        }
      ]);
    });

    it('should return subscription invoices', async () => {
      const response = await request(app)
        .get(`/api/saas/billing/subscriptions/${testSubscription._id}/invoices`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.invoices).toHaveLength(2);
      expect(response.body.data.pagination).toBeDefined();

      // Verify invoice structure
      const invoice = response.body.data.invoices[0];
      expect(invoice).toHaveProperty('amount');
      expect(invoice).toHaveProperty('status');
      expect(invoice).toHaveProperty('dueDate');
      expect(invoice).toHaveProperty('items');
    });

    it('should filter invoices by status', async () => {
      const response = await request(app)
        .get(`/api/saas/billing/subscriptions/${testSubscription._id}/invoices`)
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ status: 'paid' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.invoices).toHaveLength(1);
      expect(response.body.data.invoices[0].status).toBe('paid');
    });
  });

  describe('GET /api/saas/billing/analytics', () => {
    beforeEach(async () => {
      // Create additional subscriptions for analytics
      await BillingSubscription.create([
        {
          tenantId: new mongoose.Types.ObjectId(),
          plan: 'basic',
          status: 'active',
          amount: 29.99,
          currency: 'USD',
          billingCycle: 'monthly',
          createdAt: new Date('2024-01-15')
        },
        {
          tenantId: new mongoose.Types.ObjectId(),
          plan: 'enterprise',
          status: 'cancelled',
          amount: 199.99,
          currency: 'USD',
          billingCycle: 'yearly',
          createdAt: new Date('2024-01-10'),
          cancelledAt: new Date('2024-01-25')
        }
      ]);

      // Create test invoices for revenue calculation
      await BillingInvoice.create([
        {
          subscriptionId: testSubscription._id,
          tenantId: testTenant._id,
          amount: 99.99,
          currency: 'USD',
          status: 'paid',
          paidAt: new Date('2024-01-15')
        },
        {
          subscriptionId: testSubscription._id,
          tenantId: testTenant._id,
          amount: 29.99,
          currency: 'USD',
          status: 'paid',
          paidAt: new Date('2024-01-20')
        }
      ]);
    });

    it('should return billing analytics', async () => {
      const response = await request(app)
        .get('/api/saas/billing/analytics')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalRevenue');
      expect(response.body.data).toHaveProperty('activeSubscriptions');
      expect(response.body.data).toHaveProperty('churnRate');
      expect(response.body.data).toHaveProperty('mrr');
      expect(response.body.data).toHaveProperty('planDistribution');
      expect(response.body.data).toHaveProperty('revenueHistory');
    });

    it('should calculate metrics correctly', async () => {
      const response = await request(app)
        .get('/api/saas/billing/analytics')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        })
        .expect(200);

      expect(response.body.data.totalRevenue).toBe(129.98); // 99.99 + 29.99
      expect(response.body.data.activeSubscriptions).toBe(2); // testSubscription + basic plan
    });

    it('should require date range parameters', async () => {
      const response = await request(app)
        .get('/api/saas/billing/analytics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('date range');
    });
  });

  describe('POST /api/saas/billing/process-payment', () => {
    it('should process manual payment successfully', async () => {
      const paymentData = {
        subscriptionId: testSubscription._id,
        amount: 99.99,
        description: 'Manual payment for premium plan',
        paymentMethod: {
          type: 'card',
          token: 'tok_visa'
        }
      };

      const response = await request(app)
        .post('/api/saas/billing/process-payment')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(paymentData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('transactionId');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data.amount).toBe(paymentData.amount);

      // Verify invoice was created
      const invoice = await BillingInvoice.findOne({
        subscriptionId: testSubscription._id,
        amount: paymentData.amount
      });
      expect(invoice).toBeTruthy();
      expect(invoice!.status).toBe('paid');
    });

    it('should return 400 for invalid payment data', async () => {
      const invalidData = {
        subscriptionId: 'invalid-id',
        amount: -10 // Invalid amount
      };

      const response = await request(app)
        .post('/api/saas/billing/process-payment')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('Authorization', () => {
    it('should return 401 for unauthorized access', async () => {
      await request(app)
        .get('/api/saas/billing/subscriptions')
        .expect(401);
    });

    it('should return 403 for insufficient permissions', async () => {
      const limitedToken = generateTestToken({
        userId: 'user123',
        role: 'user',
        permissions: ['billing:read'] // Missing billing:write
      });

      await request(app)
        .post('/api/saas/billing/subscriptions')
        .set('Authorization', `Bearer ${limitedToken}`)
        .send({
          tenantId: testTenant._id,
          plan: 'basic'
        })
        .expect(403);
    });
  });
});