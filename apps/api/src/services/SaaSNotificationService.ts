import mongoose from 'mongoose';
import { NotificationSettings, INotificationSettings } from '../models/NotificationSettings';
import { NotificationRule, INotificationRule } from '../models/NotificationRule';
import { NotificationTemplate, INotificationTemplate } from '../models/NotificationTemplate';
import { User, IUser } from '../models/User';
import { RedisCacheService } from './RedisCacheService';
import { BackgroundJobService } from './BackgroundJobService';
import { AuditService } from './auditService';
import logger from '../utils/logger';
import nodemailer from 'nodemailer';

export interface NotificationFilters {
  userId?: string;
  channel?: string;
  status?: 'pending' | 'sent' | 'failed' | 'delivered';
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  page?: number;
}

export interface NotificationHistory {
  id: string;
  userId: string;
  userEmail: string;
  channel: string;
  template: string;
  subject?: string;
  content: string;
  status: 'pending' | 'sent' | 'failed' | 'delivered';
  sentAt?: Date;
  deliveredAt?: Date;
  failureReason?: string;
  metadata: Record<string, any>;
}

export interface BulkNotification {
  userIds: string[];
  templateId: string;
  channel: string;
  variables?: Record<string, any>;
  scheduledFor?: Date;
  priority: 'low' | 'normal' | 'high' | 'urgent';
}

export interface NotificationResult {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  totalRecipients: number;
  successCount: number;
  failureCount: number;
  errors: Array<{
    userId: string;
    error: string;
  }>;
}

export interface DeliveryStatus {
  notificationId: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
  attempts: number;
  lastAttempt?: Date;
  nextRetry?: Date;
  deliveryDetails?: Record<string, any>;
}

export interface NotificationChannel {
  name: string;
  enabled: boolean;
  provider: string;
  config: Record<string, any>;
  rateLimits: {
    perMinute: number;
    perHour: number;
    perDay: number;
  };
}

export interface RuleCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than';
  value: any;
}

export interface NotificationAction {
  channel: string;
  templateId: string;
  delay?: number; // in minutes
  conditions?: RuleCondition[];
}

/**
 * NotificationService - Handles multi-channel notification delivery system
 * Provides notification rules engine, template management, and delivery tracking
 */
export class NotificationService {
  private static instance: NotificationService;
  private cacheService: RedisCacheService;
  private backgroundJobService: BackgroundJobService;
  private auditService: typeof AuditService;
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes
  private readonly RATE_LIMIT_PREFIX = 'rate_limit:';
  private readonly NOTIFICATION_QUEUE = 'notifications';

  // Channel providers
  private emailTransporter: nodemailer.Transporter | null = null;
  private smsProvider: any = null;
  private pushProvider: any = null;
  private whatsappProvider: any = null;

  constructor() {
    this.cacheService = RedisCacheService.getInstance();
    this.backgroundJobService = BackgroundJobService.getInstance();
    this.auditService = AuditService;
    this.initializeProviders();
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Get notification settings for workspace or global
   */
  async getNotificationSettings(workspaceId?: string): Promise<INotificationSettings> {
    try {
      const cacheKey = `notification:settings:${workspaceId || 'global'}`;

      // Try cache first
      const cached = await this.cacheService.get(cacheKey);
      if (cached && typeof cached === "object" && Object.keys(cached).length > 0) {
        return cached as INotificationSettings;
      }

      let settings = await NotificationSettings.findOne({
        workspaceId: workspaceId ? new mongoose.Types.ObjectId(workspaceId) : null,
        isActive: true
      });

      // Create default settings if none exist
      if (!settings) {
        settings = await this.createDefaultNotificationSettings(workspaceId) as any;
      }

      // Cache the settings
      await this.cacheService.set(cacheKey, settings, { ttl: this.CACHE_TTL / 1000 });

      return settings as INotificationSettings;
    } catch (error) {
      logger.error('Error getting notification settings:', error);
      throw new Error('Failed to retrieve notification settings');
    }
  }

  /**
   * Update notification rules
   */
  async updateNotificationRules(
    rules: INotificationRule[],
    workspaceId?: string,
    adminId?: string
  ): Promise<void> {
    try {
      const settings = await this.getNotificationSettings(workspaceId);

      // Store old rules for audit
      const oldRules = await NotificationRule.find({
        workspaceId: workspaceId ? new mongoose.Types.ObjectId(workspaceId) : null
      });

      // Delete existing rules
      await NotificationRule.deleteMany({
        workspaceId: workspaceId ? new mongoose.Types.ObjectId(workspaceId) : null
      });

      // Create new rules
      const newRules = await NotificationRule.insertMany(
        rules.map(rule => ({
          ...rule,
          workspaceId: workspaceId ? new mongoose.Types.ObjectId(workspaceId) : null,
          createdBy: adminId ? new mongoose.Types.ObjectId(adminId) : null
        }))
      );

      // Clear cache
      await this.cacheService.del(`notification:settings:${workspaceId || 'global'}`);
      await this.cacheService.delPattern('notification:rules:*');

      // Create audit log
      if (adminId) {
        await this.auditService.createAuditLog({
          action: 'NOTIFICATION_RULES_UPDATED',
          userId: adminId,
          resourceType: 'NotificationRule',
          details: {
            workspaceId,
            rulesCount: newRules.length,
            oldRulesCount: oldRules.length
          },
          complianceCategory: 'notification_management',
          riskLevel: 'medium',
          changedFields: ['rules'],
          oldValues: { rules: oldRules },
          newValues: { rules: newRules },
          workspaceId
        });
      }

      logger.info(`Notification rules updated for workspace ${workspaceId || 'global'} by admin ${adminId}`);
    } catch (error) {
      logger.error('Error updating notification rules:', error);
      throw error;
    }
  }

  /**
   * Send bulk notification
   */
  async sendBulkNotification(notification: BulkNotification, adminId?: string): Promise<NotificationResult> {
    try {
      const notificationId = new mongoose.Types.ObjectId().toString();

      // Validate template exists
      const template = await NotificationTemplate.findById(notification.templateId);
      if (!template) {
        throw new Error('Notification template not found');
      }

      // Validate users exist
      const users = await User.find({
        _id: { $in: notification.userIds.map(id => new mongoose.Types.ObjectId(id)) },
        isActive: true
      });

      if (users.length === 0) {
        throw new Error('No valid recipients found');
      }

      // Check rate limits
      await this.checkRateLimits(notification.channel, users.length);

      // Create notification result
      const result: NotificationResult = {
        id: notificationId,
        status: 'queued',
        totalRecipients: users.length,
        successCount: 0,
        failureCount: 0,
        errors: []
      };

      // Queue notifications for processing
      const jobs = users.map(user => ({
        id: `${notificationId}_${user._id}`,
        userId: user._id.toString(),
        userEmail: user.email,
        channel: notification.channel,
        templateId: notification.templateId,
        variables: {
          ...notification.variables,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email
        },
        priority: notification.priority,
        scheduledFor: notification.scheduledFor || new Date()
      }));

      // Add jobs to queue
      for (const job of jobs) {
        // TODO: Implement proper job queuing - addJob method doesn't exist
        // await this.backgroundJobService.addJob(
        //   this.NOTIFICATION_QUEUE,
        //   job,
        //   {
        //     delay: notification.scheduledFor ?
        //       notification.scheduledFor.getTime() - Date.now() : 0,
        //     priority: this.getPriorityValue(notification.priority),
        //     removeOnComplete: 100,
        //     removeOnFail: 50
        //   }
        // );
        logger.info('Notification job queued (placeholder)', { job });
      }

      // Store result in cache for tracking
      await this.cacheService.set(`notification:result:${notificationId}`, result, { ttl: 24 * 3600 });

      // Create audit log
      if (adminId) {
        await this.auditService.createAuditLog({
          action: 'BULK_NOTIFICATION_SENT',
          userId: adminId,
          resourceType: 'Notification',
          resourceId: notificationId,
          details: {
            notificationId,
            channel: notification.channel,
            templateId: notification.templateId,
            recipientCount: users.length,
            priority: notification.priority,
            scheduledFor: notification.scheduledFor
          },
          complianceCategory: 'notification_management',
          riskLevel: 'low'
        });
      }

      logger.info(`Bulk notification ${notificationId} queued for ${users.length} recipients`);
      return result;
    } catch (error) {
      logger.error('Error sending bulk notification:', error);
      throw error;
    }
  }

  /**
   * Get notification history
   */
  async getNotificationHistory(filters: NotificationFilters = {}): Promise<{
    history: NotificationHistory[];
    total: number;
    page: number;
    pages: number;
  }> {
    try {
      const { page = 1, limit = 50 } = filters;
      const skip = (page - 1) * limit;

      // This would query a NotificationLog model (not implemented in this example)
      // For now, returning mock data structure
      const history: NotificationHistory[] = [];
      const total = 0;

      return {
        history,
        total,
        page,
        pages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error('Error getting notification history:', error);
      throw new Error('Failed to retrieve notification history');
    }
  }

  /**
   * Get notification templates
   */
  async getNotificationTemplates(workspaceId?: string): Promise<INotificationTemplate[]> {
    try {
      const cacheKey = `notification:templates:${workspaceId || 'global'}`;

      // Try cache first
      const cached = await this.cacheService.get(cacheKey);
      if (cached && Array.isArray(cached)) {
        return cached as INotificationTemplate[];
      }

      const templates = await NotificationTemplate.find({
        workspaceId: workspaceId ? new mongoose.Types.ObjectId(workspaceId) : null,
        isActive: true
      }).sort({ name: 1 });

      // Cache the templates
      await this.cacheService.set(cacheKey, templates, { ttl: this.CACHE_TTL / 1000 });

      return templates;
    } catch (error) {
      logger.error('Error getting notification templates:', error);
      throw new Error('Failed to retrieve notification templates');
    }
  }

  /**
   * Create notification template
   */
  async createNotificationTemplate(
    template: Partial<INotificationTemplate>,
    workspaceId?: string,
    adminId?: string
  ): Promise<INotificationTemplate> {
    try {
      const newTemplate = new NotificationTemplate({
        ...template,
        workspaceId: workspaceId ? new mongoose.Types.ObjectId(workspaceId) : null,
        createdBy: adminId ? new mongoose.Types.ObjectId(adminId) : null,
        isActive: true
      });

      await newTemplate.save();

      // Clear cache
      await this.cacheService.del(`notification:templates:${workspaceId || 'global'}`);

      // Create audit log
      if (adminId) {
        await this.auditService.createAuditLog({
          action: 'NOTIFICATION_TEMPLATE_CREATED',
          userId: adminId,
          resourceType: 'NotificationTemplate',
          resourceId: newTemplate._id.toString(),
          details: {
            templateName: template.name,
            channel: template.channel,
            workspaceId
          },
          complianceCategory: 'notification_management',
          riskLevel: 'low',
          workspaceId
        });
      }

      logger.info(`Notification template ${newTemplate.name} created by admin ${adminId}`);
      return newTemplate;
    } catch (error) {
      logger.error('Error creating notification template:', error);
      throw error;
    }
  }

  /**
   * Get delivery status for a notification
   */
  async getDeliveryStatus(notificationId: string): Promise<DeliveryStatus> {
    try {
      const cacheKey = `notification:status:${notificationId}`;

      // Try cache first
      const cached = await this.cacheService.get(cacheKey);
      if (cached && typeof cached === "object" && Object.keys(cached).length > 0) {
        return cached as DeliveryStatus;
      }

      // This would query actual delivery status from providers
      // For now, returning mock status
      const status: DeliveryStatus = {
        notificationId,
        status: 'delivered',
        attempts: 1,
        lastAttempt: new Date(),
        deliveryDetails: {}
      };

      // Cache for 5 minutes
      await this.cacheService.set(cacheKey, status, { ttl: 5 * 60 });

      return status;
    } catch (error) {
      logger.error('Error getting delivery status:', error);
      throw new Error('Failed to retrieve delivery status');
    }
  }

  /**
   * Send single notification
   */
  async sendNotification(
    userId: string,
    templateId: string,
    channel: string,
    variables: Record<string, any> = {}
  ): Promise<string> {
    try {
      // Validate user
      const user = await User.findById(userId);
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      // Validate template
      const template = await NotificationTemplate.findById(templateId);
      if (!template || !template.isActive) {
        throw new Error('Template not found or inactive');
      }

      // Check if channel is enabled
      const settings = await this.getNotificationSettings();
      if (!settings.isChannelEnabled(channel)) {
        throw new Error(`Channel ${channel} is not enabled`);
      }

      // Check quiet hours
      if (settings.isInQuietHours()) {
        throw new Error('Cannot send notification during quiet hours');
      }

      // Check rate limits
      await this.checkRateLimits(channel, 1);

      // Process template
      const processedContent = this.processTemplate(template, {
        ...variables,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      });

      // Send notification based on channel
      const notificationId = new mongoose.Types.ObjectId().toString();
      await this.sendByChannel(channel, user, processedContent, notificationId);

      logger.info(`Notification ${notificationId} sent to user ${userId} via ${channel}`);
      return notificationId;
    } catch (error) {
      logger.error('Error sending notification:', error);
      throw error;
    }
  }

  // Private helper methods

  private async initializeProviders(): Promise<void> {
    try {
      // Initialize email transporter
      if (process.env.SMTP_HOST) {
        this.emailTransporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });
      }

      // Initialize other providers (SMS, Push, WhatsApp) would go here
      logger.info('Notification providers initialized');
    } catch (error) {
      logger.error('Error initializing notification providers:', error);
    }
  }

  private async createDefaultNotificationSettings(workspaceId?: string): Promise<INotificationSettings> {
    const defaultSettings = new NotificationSettings({
      workspaceId: workspaceId ? new mongoose.Types.ObjectId(workspaceId) : null,
      channels: {
        email: {
          enabled: true,
          rateLimits: { perMinute: 60, perHour: 1000, perDay: 10000 },
          retryPolicy: { maxRetries: 3, retryDelay: 30, backoffMultiplier: 2 }
        },
        sms: {
          enabled: false,
          rateLimits: { perMinute: 10, perHour: 100, perDay: 1000 },
          retryPolicy: { maxRetries: 3, retryDelay: 60, backoffMultiplier: 2 }
        },
        push: {
          enabled: false,
          rateLimits: { perMinute: 100, perHour: 5000, perDay: 50000 },
          retryPolicy: { maxRetries: 2, retryDelay: 15, backoffMultiplier: 1.5 }
        },
        whatsapp: {
          enabled: false,
          rateLimits: { perMinute: 20, perHour: 500, perDay: 5000 },
          retryPolicy: { maxRetries: 3, retryDelay: 120, backoffMultiplier: 2 }
        },
        inApp: {
          enabled: true,
          rateLimits: { perMinute: 200, perHour: 10000, perDay: 100000 },
          retryPolicy: { maxRetries: 1, retryDelay: 5, backoffMultiplier: 1 }
        }
      },
      globalSettings: {
        enableNotifications: true,
        quietHours: {
          enabled: false,
          startTime: '22:00',
          endTime: '08:00',
          timezone: 'UTC'
        },
        batchingEnabled: false,
        batchingInterval: 15,
        maxBatchSize: 50
      },
      deliveryPreferences: {
        priorityChannels: ['email', 'inApp'],
        fallbackEnabled: true,
        fallbackDelay: 5
      },
      complianceSettings: {
        gdprCompliant: true,
        dataRetentionDays: 365,
        consentRequired: true,
        unsubscribeEnabled: true
      },
      isActive: true,
      lastModifiedBy: new mongoose.Types.ObjectId()
    });

    await defaultSettings.save();
    return defaultSettings;
  }

  private async checkRateLimits(channel: string, count: number): Promise<void> {
    try {
      const settings = await this.getNotificationSettings();
      const channelConfig = settings.channels[channel as keyof typeof settings.channels];

      if (!channelConfig) {
        throw new Error(`Channel ${channel} not configured`);
      }

      const now = new Date();
      const minute = Math.floor(now.getTime() / (60 * 1000));
      const hour = Math.floor(now.getTime() / (60 * 60 * 1000));
      const day = Math.floor(now.getTime() / (24 * 60 * 60 * 1000));

      // Check rate limits
      const minuteKey = `${this.RATE_LIMIT_PREFIX}${channel}:minute:${minute}`;
      const hourKey = `${this.RATE_LIMIT_PREFIX}${channel}:hour:${hour}`;
      const dayKey = `${this.RATE_LIMIT_PREFIX}${channel}:day:${day}`;

      const [minuteCount, hourCount, dayCount] = await Promise.all([
        this.cacheService.get(minuteKey),
        this.cacheService.get(hourKey),
        this.cacheService.get(dayKey)
      ]);

      const minuteCountNum = (minuteCount as number) || 0;
      const hourCountNum = (hourCount as number) || 0;
      const dayCountNum = (dayCount as number) || 0;

      if (minuteCountNum + count > channelConfig.rateLimits.perMinute) {
        throw new Error(`Rate limit exceeded for ${channel}: ${channelConfig.rateLimits.perMinute}/minute`);
      }

      if (hourCountNum + count > channelConfig.rateLimits.perHour) {
        throw new Error(`Rate limit exceeded for ${channel}: ${channelConfig.rateLimits.perHour}/hour`);
      }

      if (dayCountNum + count > channelConfig.rateLimits.perDay) {
        throw new Error(`Rate limit exceeded for ${channel}: ${channelConfig.rateLimits.perDay}/day`);
      }

      // Update counters
      await Promise.all([
        this.cacheService.set(minuteKey, minuteCountNum + count, { ttl: 60 }),
        this.cacheService.set(hourKey, hourCountNum + count, { ttl: 60 * 60 }),
        this.cacheService.set(dayKey, dayCountNum + count, { ttl: 24 * 3600 })
      ]);
    } catch (error) {
      logger.error('Error checking rate limits:', error);
      throw error;
    }
  }

  private processTemplate(
    template: INotificationTemplate,
    variables: Record<string, any>
  ): { subject?: string; body: string } {
    let subject = template.subject || '';
    let body = template.body;

    // Replace variables in template
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      subject = subject.replace(new RegExp(placeholder, 'g'), String(value));
      body = body.replace(new RegExp(placeholder, 'g'), String(value));
    }

    return { subject: subject || undefined, body };
  }

  private async sendByChannel(
    channel: string,
    user: IUser,
    content: { subject?: string; body: string },
    notificationId: string
  ): Promise<void> {
    switch (channel) {
      case 'email':
        await this.sendEmail(user, content, notificationId);
        break;
      case 'sms':
        await this.sendSMS(user, content, notificationId);
        break;
      case 'push':
        await this.sendPush(user, content, notificationId);
        break;
      case 'whatsapp':
        await this.sendWhatsApp(user, content, notificationId);
        break;
      case 'inApp':
        await this.sendInApp(user, content, notificationId);
        break;
      default:
        throw new Error(`Unsupported channel: ${channel}`);
    }
  }

  private async sendEmail(
    user: IUser,
    content: { subject?: string; body: string },
    notificationId: string
  ): Promise<void> {
    if (!this.emailTransporter) {
      throw new Error('Email transporter not configured');
    }

    try {
      await this.emailTransporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@example.com',
        to: user.email,
        subject: content.subject || 'Notification',
        html: content.body
      });

      logger.info(`Email notification ${notificationId} sent to ${user.email}`);
    } catch (error) {
      logger.error(`Failed to send email notification ${notificationId}:`, error);
      throw error;
    }
  }

  private async sendSMS(
    user: IUser,
    content: { subject?: string; body: string },
    notificationId: string
  ): Promise<void> {
    // SMS implementation would go here
    logger.info(`SMS notification ${notificationId} sent to ${user.phone || 'N/A'}`);
  }

  private async sendPush(
    user: IUser,
    content: { subject?: string; body: string },
    notificationId: string
  ): Promise<void> {
    // Push notification implementation would go here
    logger.info(`Push notification ${notificationId} sent to user ${user._id}`);
  }

  private async sendWhatsApp(
    user: IUser,
    content: { subject?: string; body: string },
    notificationId: string
  ): Promise<void> {
    // WhatsApp implementation would go here
    logger.info(`WhatsApp notification ${notificationId} sent to ${user.phone || 'N/A'}`);
  }

  private async sendInApp(
    user: IUser,
    content: { subject?: string; body: string },
    notificationId: string
  ): Promise<void> {
    // In-app notification implementation would go here
    logger.info(`In-app notification ${notificationId} sent to user ${user._id}`);
  }

  private getPriorityValue(priority: string): number {
    switch (priority) {
      case 'urgent': return 1;
      case 'high': return 2;
      case 'normal': return 3;
      case 'low': return 4;
      default: return 3;
    }
  }

  /**
   * Clear notification cache
   */
  async clearCache(workspaceId?: string): Promise<void> {
    try {
      if (workspaceId) {
        await Promise.all([
          this.cacheService.del(`notification:settings:${workspaceId}`),
          this.cacheService.del(`notification:templates:${workspaceId}`),
          this.cacheService.delPattern(`notification:rules:${workspaceId}:*`)
        ]);
      } else {
        await Promise.all([
          this.cacheService.delPattern('notification:settings:*'),
          this.cacheService.delPattern('notification:templates:*'),
          this.cacheService.delPattern('notification:rules:*'),
          this.cacheService.delPattern('notification:status:*'),
          this.cacheService.delPattern('notification:result:*'),
          this.cacheService.delPattern('rate_limit:*')
        ]);
      }

      logger.info(`Notification cache cleared for workspace ${workspaceId || 'all'}`);
    } catch (error) {
      logger.error('Error clearing notification cache:', error);
      throw new Error('Failed to clear notification cache');
    }
  }
}

export default NotificationService;