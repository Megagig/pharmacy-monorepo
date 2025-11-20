import Webhook, { IWebhook } from '../models/Webhook';
import WebhookDelivery, { IWebhookDelivery } from '../models/WebhookDelivery';
import { Types } from 'mongoose';
import crypto from 'crypto';
import axios from 'axios';

export interface WebhookFilters {
  userId?: string;
  isActive?: boolean;
  events?: string[];
  search?: string;
}

export interface WebhookDeliveryFilters {
  webhookId?: string;
  eventType?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: any;
  timestamp: Date;
  source: string;
  version: string;
}

export interface WebhookPayload {
  event: WebhookEvent;
  webhook: {
    id: string;
    name: string;
  };
  delivery: {
    id: string;
    attempt: number;
  };
}

export class WebhookService {
  /**
   * Get webhooks with filtering and pagination
   */
  async getWebhooks(
    filters: WebhookFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<{
    webhooks: IWebhook[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const query: any = {};

    if (filters.userId) {
      query.userId = new Types.ObjectId(filters.userId);
    }

    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive;
    }

    if (filters.events && filters.events.length > 0) {
      query.events = { $in: filters.events };
    }

    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } },
        { url: { $regex: filters.search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    const total = await Webhook.countDocuments(query);
    const webhooks = await Webhook.find(query)
      .populate('userId', 'email firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return {
      webhooks,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Create webhook
   */
  async createWebhook(webhookData: Partial<IWebhook>): Promise<IWebhook> {
    const secret = this.generateWebhookSecret();

    const webhook = new Webhook({
      ...webhookData,
      secret
    });

    return await webhook.save();
  }

  /**
   * Update webhook
   */
  async updateWebhook(webhookId: string, updateData: Partial<IWebhook>): Promise<IWebhook> {
    const webhook = await Webhook.findById(webhookId);
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    Object.assign(webhook, updateData);
    return await webhook.save();
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(webhookId: string): Promise<void> {
    const webhook = await Webhook.findById(webhookId);
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    // Cancel any pending deliveries
    await WebhookDelivery.updateMany(
      { webhookId: new Types.ObjectId(webhookId), status: 'pending' },
      { status: 'cancelled', finalizedAt: new Date() }
    );

    await Webhook.findByIdAndDelete(webhookId);
  }

  /**
   * Trigger webhook for event
   */
  async triggerWebhook(eventType: string, eventData: any, eventId?: string): Promise<void> {
    const webhooks = await Webhook.find({
      isActive: true,
      events: { $in: [eventType, eventType.split('.')[0] + '.*'] }
    });

    const event: WebhookEvent = {
      id: eventId || new Types.ObjectId().toString(),
      type: eventType,
      data: eventData,
      timestamp: new Date(),
      source: 'PharmacyCopilot-api',
      version: '1.0'
    };

    const deliveryPromises = webhooks
      .filter(webhook => (webhook as any).shouldTrigger(eventType, eventData))
      .map(webhook => this.createWebhookDelivery(webhook, event));

    await Promise.all(deliveryPromises);
  }

  /**
   * Create webhook delivery
   */
  async createWebhookDelivery(webhook: IWebhook, event: WebhookEvent): Promise<IWebhookDelivery> {
    const payload: WebhookPayload = {
      event,
      webhook: {
        id: webhook._id.toString(),
        name: webhook.name
      },
      delivery: {
        id: new Types.ObjectId().toString(),
        attempt: 1
      }
    };

    const delivery = new WebhookDelivery({
      webhookId: webhook._id,
      eventType: event.type,
      eventId: event.id,
      payload,
      url: webhook.url,
      httpMethod: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'PharmacyCopilot-Webhooks/1.0',
        'X-Webhook-Signature': this.generateSignature(payload, webhook.secret),
        'X-Webhook-Event': event.type,
        'X-Webhook-ID': event.id,
        'X-Webhook-Timestamp': event.timestamp.toISOString(),
        ...webhook.headers
      }
    });

    await delivery.save();

    // Immediately attempt delivery
    this.deliverWebhook(delivery._id.toString()).catch(error => {
      console.error('Webhook delivery failed:', error);
    });

    return delivery;
  }

  /**
   * Deliver webhook
   */
  async deliverWebhook(deliveryId: string): Promise<void> {
    const delivery = await WebhookDelivery.findById(deliveryId).populate('webhookId');
    if (!delivery) {
      throw new Error('Webhook delivery not found');
    }

    const webhook = delivery.webhookId as unknown as IWebhook;
    if (!webhook) {
      throw new Error('Associated webhook not found');
    }

    const startTime = Date.now();

    try {
      const response = await axios({
        method: delivery.httpMethod.toLowerCase() as any,
        url: delivery.url,
        headers: delivery.headers,
        data: delivery.payload,
        timeout: webhook.timeout,
        validateStatus: () => true // Don't throw on HTTP error status
      });

      const responseTime = Date.now() - startTime;
      const success = response.status >= 200 && response.status < 300;

      (delivery as any).addAttempt({
        responseStatus: response.status,
        responseHeaders: response.headers,
        responseBody: JSON.stringify(response.data).substring(0, 10000), // Limit response body size
        responseTime,
        success
      });

      (webhook as any).updateStatistics(responseTime, success);

      if (!success && (delivery as any).isRetryable(webhook.retryPolicy.maxRetries)) {
        (delivery as any).scheduleRetry(webhook.retryPolicy.retryDelay, webhook.retryPolicy.backoffMultiplier);
      } else if (!success) {
        (delivery as any).markAsFailed();
        webhook.lastError = `HTTP ${response.status}: ${response.statusText}`;
      }

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      (delivery as any).addAttempt({
        responseTime,
        error: errorMessage,
        success: false
      });

      (webhook as any).updateStatistics(responseTime, false);

      if ((delivery as any).isRetryable(webhook.retryPolicy.maxRetries)) {
        (delivery as any).scheduleRetry(webhook.retryPolicy.retryDelay, webhook.retryPolicy.backoffMultiplier);
      } else {
        (delivery as any).markAsFailed();
        webhook.lastError = errorMessage;
      }
    }

    await Promise.all([delivery.save(), webhook.save()]);
  }

  /**
   * Process webhook retries
   */
  async processWebhookRetries(): Promise<void> {
    const pendingDeliveries = await WebhookDelivery.find({
      status: 'pending',
      nextRetryAt: { $lte: new Date() }
    }).limit(100);

    const retryPromises = pendingDeliveries.map(delivery =>
      this.deliverWebhook(delivery._id.toString()).catch(error => {
        console.error(`Retry failed for delivery ${delivery._id}:`, error);
      })
    );

    await Promise.all(retryPromises);
  }

  /**
   * Get webhook deliveries
   */
  async getWebhookDeliveries(
    filters: WebhookDeliveryFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<{
    deliveries: IWebhookDelivery[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const query: any = {};

    if (filters.webhookId) {
      query.webhookId = new Types.ObjectId(filters.webhookId);
    }

    if (filters.eventType) {
      query.eventType = filters.eventType;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) {
        query.createdAt.$gte = filters.startDate;
      }
      if (filters.endDate) {
        query.createdAt.$lte = filters.endDate;
      }
    }

    const skip = (page - 1) * limit;
    const total = await WebhookDelivery.countDocuments(query);
    const deliveries = await WebhookDelivery.find(query)
      .populate('webhookId', 'name url')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return {
      deliveries,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get webhook statistics
   */
  async getWebhookStatistics(
    webhookId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    averageResponseTime: number;
    successRate: number;
    deliveriesByStatus: Array<{ status: string; count: number }>;
    deliveriesByEvent: Array<{ eventType: string; count: number }>;
    timeSeriesData: Array<{ date: Date; deliveries: number; successes: number }>;
  }> {
    const matchStage: any = {};

    if (webhookId) {
      matchStage.webhookId = new Types.ObjectId(webhookId);
    }

    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) {
        matchStage.createdAt.$gte = startDate;
      }
      if (endDate) {
        matchStage.createdAt.$lte = endDate;
      }
    }

    // Basic statistics
    const basicStats = await WebhookDelivery.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalDeliveries: { $sum: 1 },
          successfulDeliveries: {
            $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
          },
          failedDeliveries: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          },
          averageResponseTime: {
            $avg: {
              $arrayElemAt: ['$attempts.responseTime', -1]
            }
          }
        }
      }
    ]);

    // Deliveries by status
    const deliveriesByStatus = await WebhookDelivery.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          status: '$_id',
          count: 1,
          _id: 0
        }
      }
    ]);

    // Deliveries by event type
    const deliveriesByEvent = await WebhookDelivery.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$eventType',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $project: {
          eventType: '$_id',
          count: 1,
          _id: 0
        }
      }
    ]);

    // Time series data (daily)
    const timeSeriesData = await WebhookDelivery.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          deliveries: { $sum: 1 },
          successes: {
            $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
          }
        }
      },
      { $sort: { '_id': 1 } },
      {
        $project: {
          date: { $dateFromString: { dateString: '$_id' } },
          deliveries: 1,
          successes: 1,
          _id: 0
        }
      }
    ]);

    const stats = basicStats[0] || {
      totalDeliveries: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      averageResponseTime: 0
    };

    const successRate = stats.totalDeliveries > 0
      ? (stats.successfulDeliveries / stats.totalDeliveries) * 100
      : 0;

    return {
      totalDeliveries: stats.totalDeliveries,
      successfulDeliveries: stats.successfulDeliveries,
      failedDeliveries: stats.failedDeliveries,
      averageResponseTime: Math.round(stats.averageResponseTime || 0),
      successRate: Math.round(successRate * 100) / 100,
      deliveriesByStatus,
      deliveriesByEvent,
      timeSeriesData
    };
  }

  /**
   * Test webhook
   */
  async testWebhook(webhookId: string): Promise<{
    success: boolean;
    responseTime: number;
    statusCode?: number;
    error?: string;
  }> {
    const webhook = await Webhook.findById(webhookId);
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const testEvent: WebhookEvent = {
      id: new Types.ObjectId().toString(),
      type: 'webhook.test',
      data: {
        message: 'This is a test webhook delivery',
        timestamp: new Date().toISOString()
      },
      timestamp: new Date(),
      source: 'PharmacyCopilot-api',
      version: '1.0'
    };

    const payload: WebhookPayload = {
      event: testEvent,
      webhook: {
        id: webhook._id.toString(),
        name: webhook.name
      },
      delivery: {
        id: new Types.ObjectId().toString(),
        attempt: 1
      }
    };

    const startTime = Date.now();

    try {
      const response = await axios({
        method: 'POST',
        url: webhook.url,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'PharmacyCopilot-Webhooks/1.0',
          'X-Webhook-Signature': this.generateSignature(payload, webhook.secret),
          'X-Webhook-Event': testEvent.type,
          'X-Webhook-ID': testEvent.id,
          'X-Webhook-Timestamp': testEvent.timestamp.toISOString(),
          'X-Webhook-Test': 'true',
          ...webhook.headers
        },
        data: payload,
        timeout: webhook.timeout,
        validateStatus: () => true
      });

      const responseTime = Date.now() - startTime;
      const success = response.status >= 200 && response.status < 300;

      return {
        success,
        responseTime,
        statusCode: response.status,
        error: success ? undefined : `HTTP ${response.status}: ${response.statusText}`
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        success: false,
        responseTime,
        error: errorMessage
      };
    }
  }

  /**
   * Generate webhook secret
   */
  private generateWebhookSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate webhook signature
   */
  private generateSignature(payload: any, secret: string): string {
    const payloadString = JSON.stringify(payload);
    return crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  /**
   * Get available webhook events
   */
  getAvailableEvents(): string[] {
    return [
      'user.created',
      'user.updated',
      'user.deleted',
      'order.created',
      'order.updated',
      'order.completed',
      'order.cancelled',
      'payment.succeeded',
      'payment.failed',
      'subscription.created',
      'subscription.updated',
      'subscription.cancelled',
      'invoice.created',
      'invoice.paid',
      'api.rate_limit_exceeded',
      'system.maintenance_scheduled'
    ];
  }
}

export default new WebhookService();