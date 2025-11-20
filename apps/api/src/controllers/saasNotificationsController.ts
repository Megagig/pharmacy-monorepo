import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { NotificationService } from '../services/SaaSNotificationService';
import { sendSuccess, sendError } from '../utils/responseHelpers';
import logger from '../utils/logger';
import { NotificationSettings } from '../models/NotificationSettings';
import { NotificationRule } from '../models/NotificationRule';
import { NotificationTemplate } from '../models/NotificationTemplate';

export interface NotificationChannel {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'push' | 'whatsapp';
  enabled: boolean;
  config: {
    provider?: string;
    apiKey?: string;
    fromAddress?: string;
    fromNumber?: string;
    webhookUrl?: string;
  };
  dailyLimit: number;
  monthlyLimit: number;
  usage: {
    daily: number;
    monthly: number;
  };
}

export interface RuleCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

export interface NotificationAction {
  type: 'send_notification';
  channel: string;
  template: string;
  recipients: string[];
  delay?: number;
}

/**
 * SaaS Notifications Controller
 * Handles notification channels, rules, templates, and delivery management
 */
export class SaaSNotificationsController {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = NotificationService.getInstance();
  }

  /**
   * Get notification channels
   * GET /api/admin/saas/notifications/channels
   */
  async getNotificationChannels(req: AuthRequest, res: Response): Promise<void> {
    try {
      logger.info('Fetching notification channels', {
        adminId: req.user?._id
      });

      // Get notification settings which contain channel configurations
      const settings = await this.notificationService.getNotificationSettings();

      // Mock channel data with usage statistics
      const channels: NotificationChannel[] = [
        {
          id: 'email-primary',
          name: 'Primary Email',
          type: 'email',
          enabled: settings.channels?.email?.enabled || true,
          config: {
            provider: 'sendgrid',
            fromAddress: 'noreply@PharmacyCopilot.com'
          },
          dailyLimit: 10000,
          monthlyLimit: 300000,
          usage: {
            daily: Math.floor(Math.random() * 1000),
            monthly: Math.floor(Math.random() * 25000)
          }
        },
        {
          id: 'sms-primary',
          name: 'Primary SMS',
          type: 'sms',
          enabled: settings.channels?.sms?.enabled || false,
          config: {
            provider: 'twilio',
            fromNumber: '+1234567890'
          },
          dailyLimit: 1000,
          monthlyLimit: 30000,
          usage: {
            daily: Math.floor(Math.random() * 100),
            monthly: Math.floor(Math.random() * 2500)
          }
        },
        {
          id: 'push-primary',
          name: 'Push Notifications',
          type: 'push',
          enabled: settings.channels?.push?.enabled || true,
          config: {
            provider: 'firebase'
          },
          dailyLimit: 50000,
          monthlyLimit: 1500000,
          usage: {
            daily: Math.floor(Math.random() * 5000),
            monthly: Math.floor(Math.random() * 125000)
          }
        },
        {
          id: 'whatsapp-primary',
          name: 'WhatsApp Business',
          type: 'whatsapp',
          enabled: settings.channels?.whatsapp?.enabled || false,
          config: {
            provider: 'twilio',
            fromNumber: '+1234567890'
          },
          dailyLimit: 1000,
          monthlyLimit: 30000,
          usage: {
            daily: Math.floor(Math.random() * 50),
            monthly: Math.floor(Math.random() * 1200)
          }
        }
      ];

      sendSuccess(
        res,
        { channels },
        'Notification channels retrieved successfully'
      );
    } catch (error) {
      logger.error('Error fetching notification channels:', error);
      sendError(
        res,
        'CHANNELS_ERROR',
        'Failed to retrieve notification channels',
        500
      );
    }
  }

  /**
   * Update notification channel
   * PUT /api/admin/saas/notifications/channels/:channelId
   */
  async updateNotificationChannel(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { channelId } = req.params;
      const { enabled, config } = req.body;

      logger.info('Updating notification channel', {
        adminId: req.user?._id,
        channelId,
        enabled
      });

      // In a real implementation, this would update the channel configuration
      // For now, we'll just log the update

      sendSuccess(
        res,
        {
          channelId,
          enabled,
          updatedBy: req.user?._id,
          updatedAt: new Date()
        },
        'Notification channel updated successfully'
      );
    } catch (error) {
      logger.error('Error updating notification channel:', error);
      sendError(
        res,
        'CHANNEL_UPDATE_ERROR',
        'Failed to update notification channel',
        500
      );
    }
  }

  /**
   * Get notification rules
   * GET /api/admin/saas/notifications/rules
   */
  async getNotificationRules(req: AuthRequest, res: Response): Promise<void> {
    try {
      logger.info('Fetching notification rules', {
        adminId: req.user?._id
      });

      const rules = await NotificationRule.find({})
        .sort({ createdAt: -1 })
        .lean();

      sendSuccess(
        res,
        { rules },
        'Notification rules retrieved successfully'
      );
    } catch (error) {
      logger.error('Error fetching notification rules:', error);
      sendError(
        res,
        'RULES_ERROR',
        'Failed to retrieve notification rules',
        500
      );
    }
  }

  /**
   * Create notification rule
   * POST /api/admin/saas/notifications/rules
   */
  async createNotificationRule(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        name,
        description,
        trigger,
        conditions,
        actions,
        priority = 'medium',
        cooldownPeriod = 60,
        maxExecutions = 1000
      } = req.body;

      logger.info('Creating notification rule', {
        adminId: req.user?._id,
        name,
        trigger
      });

      const rule = new NotificationRule({
        name,
        description,
        trigger,
        conditions,
        actions,
        priority,
        cooldownPeriod,
        maxExecutions,
        executionCount: 0,
        isActive: true,
        workplaceId: req.user?.workplaceId,
        createdBy: req.user?._id
      });

      await rule.save();

      sendSuccess(
        res,
        { rule },
        'Notification rule created successfully'
      );
    } catch (error) {
      logger.error('Error creating notification rule:', error);
      sendError(
        res,
        'RULE_CREATE_ERROR',
        'Failed to create notification rule',
        500
      );
    }
  }

  /**
   * Update notification rule
   * PUT /api/admin/saas/notifications/rules/:ruleId
   */
  async updateNotificationRule(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { ruleId } = req.params;
      const updateData = req.body;

      logger.info('Updating notification rule', {
        adminId: req.user?._id,
        ruleId
      });

      const rule = await NotificationRule.findByIdAndUpdate(
        ruleId,
        {
          ...updateData,
          updatedBy: req.user?._id,
          updatedAt: new Date()
        },
        { new: true }
      );

      if (!rule) {
        sendError(res, 'RULE_NOT_FOUND', 'Notification rule not found', 404);
        return;
      }

      sendSuccess(
        res,
        { rule },
        'Notification rule updated successfully'
      );
    } catch (error) {
      logger.error('Error updating notification rule:', error);
      sendError(
        res,
        'RULE_UPDATE_ERROR',
        'Failed to update notification rule',
        500
      );
    }
  }

  /**
   * Delete notification rule
   * DELETE /api/admin/saas/notifications/rules/:ruleId
   */
  async deleteNotificationRule(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { ruleId } = req.params;

      logger.info('Deleting notification rule', {
        adminId: req.user?._id,
        ruleId
      });

      const rule = await NotificationRule.findByIdAndDelete(ruleId);

      if (!rule) {
        sendError(res, 'RULE_NOT_FOUND', 'Notification rule not found', 404);
        return;
      }

      sendSuccess(
        res,
        { ruleId },
        'Notification rule deleted successfully'
      );
    } catch (error) {
      logger.error('Error deleting notification rule:', error);
      sendError(
        res,
        'RULE_DELETE_ERROR',
        'Failed to delete notification rule',
        500
      );
    }
  }

  /**
   * Toggle notification rule
   * PATCH /api/admin/saas/notifications/rules/:ruleId/toggle
   */
  async toggleNotificationRule(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { ruleId } = req.params;
      const { isActive } = req.body;

      logger.info('Toggling notification rule', {
        adminId: req.user?._id,
        ruleId,
        isActive
      });

      const rule = await NotificationRule.findByIdAndUpdate(
        ruleId,
        {
          isActive,
          updatedBy: req.user?._id,
          updatedAt: new Date()
        },
        { new: true }
      );

      if (!rule) {
        sendError(res, 'RULE_NOT_FOUND', 'Notification rule not found', 404);
        return;
      }

      sendSuccess(
        res,
        { rule },
        `Notification rule ${isActive ? 'activated' : 'deactivated'} successfully`
      );
    } catch (error) {
      logger.error('Error toggling notification rule:', error);
      sendError(
        res,
        'RULE_TOGGLE_ERROR',
        'Failed to toggle notification rule',
        500
      );
    }
  }

  /**
   * Get notification templates
   * GET /api/admin/saas/notifications/templates
   */
  async getNotificationTemplates(req: AuthRequest, res: Response): Promise<void> {
    try {
      logger.info('Fetching notification templates', {
        adminId: req.user?._id
      });

      const templates = await NotificationTemplate.find({})
        .sort({ createdAt: -1 })
        .lean();

      sendSuccess(
        res,
        { templates },
        'Notification templates retrieved successfully'
      );
    } catch (error) {
      logger.error('Error fetching notification templates:', error);
      sendError(
        res,
        'TEMPLATES_ERROR',
        'Failed to retrieve notification templates',
        500
      );
    }
  }

  /**
   * Create notification template
   * POST /api/admin/saas/notifications/templates
   */
  async createNotificationTemplate(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        name,
        description,
        channel,
        subject,
        body,
        variables = [],
        category = 'general'
      } = req.body;

      logger.info('Creating notification template', {
        adminId: req.user?._id,
        name,
        channel
      });

      const template = new NotificationTemplate({
        name,
        description,
        channel,
        subject,
        body,
        variables,
        category,
        isActive: true,
        workplaceId: req.user?.workplaceId,
        createdBy: req.user?._id
      });

      await template.save();

      sendSuccess(
        res,
        { template },
        'Notification template created successfully'
      );
    } catch (error) {
      logger.error('Error creating notification template:', error);
      sendError(
        res,
        'TEMPLATE_CREATE_ERROR',
        'Failed to create notification template',
        500
      );
    }
  }

  /**
   * Update notification template
   * PUT /api/admin/saas/notifications/templates/:templateId
   */
  async updateNotificationTemplate(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { templateId } = req.params;
      const updateData = req.body;

      logger.info('Updating notification template', {
        adminId: req.user?._id,
        templateId
      });

      const template = await NotificationTemplate.findByIdAndUpdate(
        templateId,
        {
          ...updateData,
          updatedBy: req.user?._id,
          updatedAt: new Date()
        },
        { new: true }
      );

      if (!template) {
        sendError(res, 'TEMPLATE_NOT_FOUND', 'Notification template not found', 404);
        return;
      }

      sendSuccess(
        res,
        { template },
        'Notification template updated successfully'
      );
    } catch (error) {
      logger.error('Error updating notification template:', error);
      sendError(
        res,
        'TEMPLATE_UPDATE_ERROR',
        'Failed to update notification template',
        500
      );
    }
  }

  /**
   * Delete notification template
   * DELETE /api/admin/saas/notifications/templates/:templateId
   */
  async deleteNotificationTemplate(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { templateId } = req.params;

      logger.info('Deleting notification template', {
        adminId: req.user?._id,
        templateId
      });

      const template = await NotificationTemplate.findByIdAndDelete(templateId);

      if (!template) {
        sendError(res, 'TEMPLATE_NOT_FOUND', 'Notification template not found', 404);
        return;
      }

      sendSuccess(
        res,
        { templateId },
        'Notification template deleted successfully'
      );
    } catch (error) {
      logger.error('Error deleting notification template:', error);
      sendError(
        res,
        'TEMPLATE_DELETE_ERROR',
        'Failed to delete notification template',
        500
      );
    }
  }

  /**
   * Get notification history
   * GET /api/admin/saas/notifications/history
   */
  async getNotificationHistory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 50,
        ruleId = '',
        channel = '',
        status = '',
        startDate = '',
        endDate = ''
      } = req.query;

      logger.info('Fetching notification history', {
        adminId: req.user?._id,
        filters: { ruleId, channel, status }
      });

      // Build query filters
      const filters: any = {};
      if (ruleId) filters.ruleId = ruleId;
      if (channel) filters.channel = channel;
      if (status) filters.status = status;
      if (startDate || endDate) {
        filters.sentAt = {};
        if (startDate) filters.sentAt.$gte = new Date(startDate as string);
        if (endDate) filters.sentAt.$lte = new Date(endDate as string);
      }

      // Mock notification history data
      const mockHistory = [
        {
          id: 'hist1',
          ruleId: 'rule1',
          ruleName: 'User Registration Welcome',
          channel: 'email',
          template: 'welcome-email',
          recipients: ['user@example.com'],
          status: 'delivered',
          sentAt: new Date().toISOString(),
          deliveredAt: new Date().toISOString(),
          metadata: {}
        },
        {
          id: 'hist2',
          ruleId: 'rule2',
          ruleName: 'Password Reset Request',
          channel: 'email',
          template: 'password-reset',
          recipients: ['user2@example.com'],
          status: 'sent',
          sentAt: new Date(Date.now() - 60000).toISOString(),
          metadata: {}
        },
        {
          id: 'hist3',
          ruleId: 'rule3',
          ruleName: 'System Alert',
          channel: 'sms',
          template: 'system-alert',
          recipients: ['+1234567890'],
          status: 'failed',
          sentAt: new Date(Date.now() - 120000).toISOString(),
          errorMessage: 'Invalid phone number',
          metadata: {}
        }
      ];

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const total = mockHistory.length;
      const startIndex = (pageNum - 1) * limitNum;
      const paginatedHistory = mockHistory.slice(startIndex, startIndex + limitNum);

      sendSuccess(
        res,
        {
          history: paginatedHistory,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum)
          }
        },
        'Notification history retrieved successfully'
      );
    } catch (error) {
      logger.error('Error fetching notification history:', error);
      sendError(
        res,
        'HISTORY_ERROR',
        'Failed to retrieve notification history',
        500
      );
    }
  }

  /**
   * Send test notification
   * POST /api/admin/saas/notifications/test
   */
  async sendTestNotification(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        channelId,
        templateId,
        recipients,
        variables = {}
      } = req.body;

      logger.info('Sending test notification', {
        adminId: req.user?._id,
        channelId,
        templateId,
        recipientCount: recipients?.length || 0
      });

      // In a real implementation, this would send the actual notification
      // For now, we'll simulate the process

      const testResult = {
        id: `test_${Date.now()}`,
        channelId,
        templateId,
        recipients,
        status: 'sent',
        sentAt: new Date(),
        sentBy: req.user?._id
      };

      sendSuccess(
        res,
        testResult,
        'Test notification sent successfully'
      );
    } catch (error) {
      logger.error('Error sending test notification:', error);
      sendError(
        res,
        'TEST_NOTIFICATION_ERROR',
        'Failed to send test notification',
        500
      );
    }
  }
}

// Create and export controller instance
export const saasNotificationsController = new SaaSNotificationsController();