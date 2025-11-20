import mongoose from 'mongoose';
import WebhookService from '../../services/WebhookService';
import Webhook from '../../models/Webhook';
import WebhookDelivery from '../../models/WebhookDelivery';

// Mock axios
jest.mock('axios');
const mockedAxios = jest.mocked(require('axios'));

describe('WebhookService', () => {
  let userId: mongoose.Types.ObjectId;
  let webhookId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    userId = new mongoose.Types.ObjectId();
    webhookId = new mongoose.Types.ObjectId();
  });

  beforeEach(async () => {
    await Webhook.deleteMany({});
    await WebhookDelivery.deleteMany({});
    jest.clearAllMocks();
  });

  describe('Webhook Management', () => {
    it('should create webhook with generated secret', async () => {
      const webhookData = {
        userId,
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['user.created', 'user.updated']
      };

      const webhook = await WebhookService.createWebhook(webhookData);

      expect(webhook._id).toBeDefined();
      expect(webhook.userId).toEqual(userId);
      expect(webhook.name).toBe(webhookData.name);
      expect(webhook.url).toBe(webhookData.url);
      expect(webhook.events).toEqual(webhookData.events);
      expect(webhook.secret).toBeDefined();
      expect(webhook.secret).toHaveLength(64); // 32 bytes as hex
    });

    it('should get webhooks with filtering', async () => {
      const webhooks = [
        {
          userId,
          name: 'Active Webhook',
          url: 'https://example.com/webhook1',
          events: ['user.created'],
          isActive: true
        },
        {
          userId: new mongoose.Types.ObjectId(),
          name: 'Inactive Webhook',
          url: 'https://example.com/webhook2',
          events: ['user.updated'],
          isActive: false
        }
      ];

      await Webhook.insertMany(webhooks);

      const result = await WebhookService.getWebhooks({
        isActive: true
      });

      expect(result.webhooks).toHaveLength(1);
      expect(result.webhooks[0].name).toBe('Active Webhook');
      expect(result.total).toBe(1);
    });

    it('should update webhook', async () => {
      const webhook = await Webhook.create({
        userId,
        name: 'Original Webhook',
        url: 'https://example.com/webhook',
        events: ['user.created'],
        secret: 'test_secret'
      });

      const updateData = {
        name: 'Updated Webhook',
        events: ['user.created', 'user.updated']
      };

      const updatedWebhook = await WebhookService.updateWebhook(
        webhook._id.toString(),
        updateData
      );

      expect(updatedWebhook.name).toBe(updateData.name);
      expect(updatedWebhook.events).toEqual(updateData.events);
    });

    it('should delete webhook and cancel pending deliveries', async () => {
      const webhook = await Webhook.create({
        userId,
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['user.created'],
        secret: 'test_secret'
      });

      // Create a pending delivery
      await WebhookDelivery.create({
        webhookId: webhook._id,
        eventType: 'user.created',
        eventId: 'test_event_123',
        payload: { test: true },
        url: webhook.url,
        status: 'pending'
      });

      await WebhookService.deleteWebhook(webhook._id.toString());

      const deletedWebhook = await Webhook.findById(webhook._id);
      expect(deletedWebhook).toBeNull();

      const cancelledDelivery = await WebhookDelivery.findOne({
        webhookId: webhook._id
      });
      expect(cancelledDelivery!.status).toBe('cancelled');
    });
  });

  describe('Webhook Triggering', () => {
    beforeEach(async () => {
      const webhook = await Webhook.create({
        _id: webhookId,
        userId,
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['user.created', 'order.*'],
        secret: 'test_secret_123',
        isActive: true
      });
    });

    it('should trigger webhook for matching event', async () => {
      const eventType = 'user.created';
      const eventData = { id: '123', name: 'John Doe' };

      await WebhookService.triggerWebhook(eventType, eventData);

      const deliveries = await WebhookDelivery.find({
        webhookId,
        eventType
      });

      expect(deliveries).toHaveLength(1);
      expect(deliveries[0].payload.event.type).toBe(eventType);
      expect(deliveries[0].payload.event.data).toEqual(eventData);
    });

    it('should trigger webhook for wildcard event match', async () => {
      const eventType = 'order.completed';
      const eventData = { orderId: '456', status: 'completed' };

      await WebhookService.triggerWebhook(eventType, eventData);

      const deliveries = await WebhookDelivery.find({
        webhookId,
        eventType
      });

      expect(deliveries).toHaveLength(1);
      expect(deliveries[0].payload.event.type).toBe(eventType);
    });

    it('should not trigger webhook for non-matching event', async () => {
      const eventType = 'payment.succeeded';
      const eventData = { paymentId: '789' };

      await WebhookService.triggerWebhook(eventType, eventData);

      const deliveries = await WebhookDelivery.find({
        webhookId,
        eventType
      });

      expect(deliveries).toHaveLength(0);
    });

    it('should not trigger inactive webhook', async () => {
      await Webhook.findByIdAndUpdate(webhookId, { isActive: false });

      const eventType = 'user.created';
      const eventData = { id: '123' };

      await WebhookService.triggerWebhook(eventType, eventData);

      const deliveries = await WebhookDelivery.find({
        webhookId,
        eventType
      });

      expect(deliveries).toHaveLength(0);
    });
  });

  describe('Webhook Delivery', () => {
    let delivery: any;

    beforeEach(async () => {
      const webhook = await Webhook.create({
        _id: webhookId,
        userId,
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['user.created'],
        secret: 'test_secret_123',
        timeout: 30000,
        retryPolicy: {
          maxRetries: 3,
          retryDelay: 60,
          backoffMultiplier: 2
        }
      });

      delivery = await WebhookDelivery.create({
        webhookId: webhook._id,
        eventType: 'user.created',
        eventId: 'test_event_123',
        payload: {
          event: {
            id: 'test_event_123',
            type: 'user.created',
            data: { id: '123', name: 'John Doe' }
          }
        },
        url: webhook.url,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    });

    it('should deliver webhook successfully', async () => {
      mockedAxios.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { received: true }
      });

      await WebhookService.deliverWebhook(delivery._id.toString());

      const updatedDelivery = await WebhookDelivery.findById(delivery._id);
      expect(updatedDelivery!.status).toBe('delivered');
      expect(updatedDelivery!.attempts).toHaveLength(1);
      expect(updatedDelivery!.attempts[0].success).toBe(true);
      expect(updatedDelivery!.attempts[0].responseStatus).toBe(200);
    });

    it('should handle delivery failure and schedule retry', async () => {
      mockedAxios.mockResolvedValueOnce({
        status: 500,
        statusText: 'Internal Server Error',
        headers: {},
        data: { error: 'Server error' }
      });

      await WebhookService.deliverWebhook(delivery._id.toString());

      const updatedDelivery = await WebhookDelivery.findById(delivery._id);
      expect(updatedDelivery!.status).toBe('pending');
      expect(updatedDelivery!.attempts).toHaveLength(1);
      expect(updatedDelivery!.attempts[0].success).toBe(false);
      expect(updatedDelivery!.attempts[0].responseStatus).toBe(500);
      expect(updatedDelivery!.nextRetryAt).toBeDefined();
    });

    it('should mark as failed after max retries', async () => {
      // Simulate multiple failed attempts
      delivery.attempts = [
        { attemptNumber: 1, timestamp: new Date(), responseTime: 1000, success: false },
        { attemptNumber: 2, timestamp: new Date(), responseTime: 1000, success: false },
        { attemptNumber: 3, timestamp: new Date(), responseTime: 1000, success: false }
      ];
      await delivery.save();

      mockedAxios.mockRejectedValueOnce(new Error('Connection timeout'));

      await WebhookService.deliverWebhook(delivery._id.toString());

      const updatedDelivery = await WebhookDelivery.findById(delivery._id);
      expect(updatedDelivery!.status).toBe('failed');
      expect(updatedDelivery!.finalizedAt).toBeDefined();
      expect(updatedDelivery!.nextRetryAt).toBeUndefined();
    });

    it('should handle network errors', async () => {
      mockedAxios.mockRejectedValueOnce(new Error('Network error'));

      await WebhookService.deliverWebhook(delivery._id.toString());

      const updatedDelivery = await WebhookDelivery.findById(delivery._id);
      expect(updatedDelivery!.status).toBe('pending');
      expect(updatedDelivery!.attempts).toHaveLength(1);
      expect(updatedDelivery!.attempts[0].success).toBe(false);
      expect(updatedDelivery!.attempts[0].error).toBe('Network error');
    });
  });

  describe('Webhook Testing', () => {
    it('should test webhook successfully', async () => {
      const webhook = await Webhook.create({
        userId,
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['user.created'],
        secret: 'test_secret_123',
        timeout: 30000
      });

      mockedAxios.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { test: 'success' }
      });

      const result = await WebhookService.testWebhook(webhook._id.toString());

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.responseTime).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
    });

    it('should handle test webhook failure', async () => {
      const webhook = await Webhook.create({
        userId,
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['user.created'],
        secret: 'test_secret_123',
        timeout: 30000
      });

      mockedAxios.mockResolvedValueOnce({
        status: 404,
        statusText: 'Not Found',
        headers: {},
        data: { error: 'Endpoint not found' }
      });

      const result = await WebhookService.testWebhook(webhook._id.toString());

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(404);
      expect(result.error).toBe('HTTP 404: Not Found');
    });

    it('should handle test webhook network error', async () => {
      const webhook = await Webhook.create({
        userId,
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['user.created'],
        secret: 'test_secret_123',
        timeout: 30000
      });

      mockedAxios.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await WebhookService.testWebhook(webhook._id.toString());

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection refused');
    });
  });

  describe('Webhook Statistics', () => {
    beforeEach(async () => {
      const webhook = await Webhook.create({
        _id: webhookId,
        userId,
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['user.created'],
        secret: 'test_secret_123'
      });

      const deliveries = [
        {
          webhookId: webhook._id,
          eventType: 'user.created',
          eventId: 'event_1',
          payload: { test: true },
          url: webhook.url,
          status: 'delivered',
          attempts: [{ attemptNumber: 1, timestamp: new Date(), responseTime: 100, success: true }],
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
        },
        {
          webhookId: webhook._id,
          eventType: 'user.created',
          eventId: 'event_2',
          payload: { test: true },
          url: webhook.url,
          status: 'failed',
          attempts: [{ attemptNumber: 1, timestamp: new Date(), responseTime: 200, success: false }],
          createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
        },
        {
          webhookId: webhook._id,
          eventType: 'user.updated',
          eventId: 'event_3',
          payload: { test: true },
          url: webhook.url,
          status: 'delivered',
          attempts: [{ attemptNumber: 1, timestamp: new Date(), responseTime: 150, success: true }],
          createdAt: new Date() // today
        }
      ];

      await WebhookDelivery.insertMany(deliveries);
    });

    it('should get webhook statistics', async () => {
      const statistics = await WebhookService.getWebhookStatistics(webhookId.toString());

      expect(statistics.totalDeliveries).toBe(3);
      expect(statistics.successfulDeliveries).toBe(2);
      expect(statistics.failedDeliveries).toBe(1);
      expect(statistics.successRate).toBe(66.67);
      expect(statistics.averageResponseTime).toBe(150);
      expect(statistics.deliveriesByStatus).toHaveLength(2);
      expect(statistics.deliveriesByEvent).toHaveLength(2);
      expect(statistics.timeSeriesData).toHaveLength(3);
    });

    it('should get statistics with date filtering', async () => {
      const startDate = new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000); // 1.5 days ago
      const statistics = await WebhookService.getWebhookStatistics(
        webhookId.toString(),
        startDate
      );

      expect(statistics.totalDeliveries).toBe(2); // Only last 2 deliveries
      expect(statistics.successfulDeliveries).toBe(1);
      expect(statistics.failedDeliveries).toBe(1);
    });
  });

  describe('Utility Methods', () => {
    it('should get available webhook events', () => {
      const events = WebhookService.getAvailableEvents();

      expect(events).toContain('user.created');
      expect(events).toContain('user.updated');
      expect(events).toContain('order.created');
      expect(events).toContain('payment.succeeded');
      expect(events).toHaveLength(14);
    });

    it('should verify webhook signature correctly', () => {
      const payload = '{"test": "data"}';
      const secret = 'test_secret_123';
      
      // Generate signature using the same method as the service
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      const isValid = WebhookService.verifyWebhookSignature(
        payload,
        expectedSignature,
        secret
      );

      expect(isValid).toBe(true);
    });

    it('should reject invalid webhook signature', () => {
      const payload = '{"test": "data"}';
      const secret = 'test_secret_123';
      const invalidSignature = 'invalid_signature';

      const isValid = WebhookService.verifyWebhookSignature(
        payload,
        invalidSignature,
        secret
      );

      expect(isValid).toBe(false);
    });
  });
});