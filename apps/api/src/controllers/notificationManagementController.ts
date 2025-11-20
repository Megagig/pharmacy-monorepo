import { Request, Response } from 'express';
import { notificationChannelService } from '../services/NotificationChannelService';
import NotificationRule from '../models/NotificationRule';
import NotificationTemplate from '../models/NotificationTemplate';
import Notification from '../models/Notification';
import { sendSuccess, sendError } from '../utils/responseHelpers';
import logger from '../utils/logger';
import mongoose from 'mongoose';

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    workplaceId: string;
    role: string;
  };
}

// ============ CHANNELS ============

export const getNotificationChannels = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const workplaceId = req.user!.workplaceId;
    const channels = await notificationChannelService.getChannels(workplaceId);
    return sendSuccess(res, { channels }, 'Channels retrieved successfully');
  } catch (error) {
    logger.error('Error fetching notification channels:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to fetch channels', 500);
  }
};

export const createNotificationChannel = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, type, enabled, config, dailyLimit, monthlyLimit } = req.body;
    const workplaceId = req.user!.workplaceId;

    const channel = await notificationChannelService.createChannel({
      name,
      type,
      enabled,
      config,
      dailyLimit,
      monthlyLimit,
      workplaceId: new mongoose.Types.ObjectId(workplaceId),
    });

    return sendSuccess(res, { channel }, 'Channel created successfully', 201);
  } catch (error) {
    logger.error('Error creating notification channel:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to create channel', 500);
  }
};

export const updateNotificationChannel = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { channelId } = req.params;
    const channel = await notificationChannelService.updateChannel(channelId, req.body);
    return sendSuccess(res, { channel }, 'Channel updated successfully');
  } catch (error) {
    logger.error('Error updating notification channel:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to update channel', 500);
  }
};

export const deleteNotificationChannel = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { channelId } = req.params;
    await notificationChannelService.deleteChannel(channelId);
    return sendSuccess(res, null, 'Channel deleted successfully');
  } catch (error) {
    logger.error('Error deleting notification channel:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to delete channel', 500);
  }
};

// ============ RULES ============

export const getNotificationRules = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const workplaceId = req.user!.workplaceId;
    const rules = await NotificationRule.find({
      workplaceId: new mongoose.Types.ObjectId(workplaceId),
      isDeleted: false,
    }).sort({ createdAt: -1 });

    return sendSuccess(res, { rules }, 'Rules retrieved successfully');
  } catch (error) {
    logger.error('Error fetching notification rules:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to fetch rules', 500);
  }
};

export const createNotificationRule = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const workplaceId = req.user!.workplaceId;
    const userId = req.user!._id;

    const rule = new NotificationRule({
      ...req.body,
      workplaceId: new mongoose.Types.ObjectId(workplaceId),
      createdBy: new mongoose.Types.ObjectId(userId),
    });

    await rule.save();
    return sendSuccess(res, { rule }, 'Rule created successfully', 201);
  } catch (error) {
    logger.error('Error creating notification rule:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to create rule', 500);
  }
};

export const updateNotificationRule = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { ruleId } = req.params;
    const userId = req.user!._id;

    const rule = await NotificationRule.findByIdAndUpdate(
      ruleId,
      { ...req.body, updatedBy: new mongoose.Types.ObjectId(userId) },
      { new: true, runValidators: true }
    );

    if (!rule) {
      return sendError(res, 'NOT_FOUND', 'Rule not found', 404);
    }

    return sendSuccess(res, { rule }, 'Rule updated successfully');
  } catch (error) {
    logger.error('Error updating notification rule:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to update rule', 500);
  }
};

export const deleteNotificationRule = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { ruleId } = req.params;
    const rule = await NotificationRule.findByIdAndUpdate(
      ruleId,
      { isDeleted: true },
      { new: true }
    );

    if (!rule) {
      return sendError(res, 'NOT_FOUND', 'Rule not found', 404);
    }

    return sendSuccess(res, null, 'Rule deleted successfully');
  } catch (error) {
    logger.error('Error deleting notification rule:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to delete rule', 500);
  }
};

export const toggleNotificationRule = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { ruleId } = req.params;
    const { isActive } = req.body;

    const rule = await NotificationRule.findByIdAndUpdate(
      ruleId,
      { isActive },
      { new: true }
    );

    if (!rule) {
      return sendError(res, 'NOT_FOUND', 'Rule not found', 404);
    }

    return sendSuccess(res, { rule }, 'Rule toggled successfully');
  } catch (error) {
    logger.error('Error toggling notification rule:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to toggle rule', 500);
  }
};

// ============ TEMPLATES ============

export const getNotificationTemplates = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const workplaceId = req.user!.workplaceId;
    const templates = await NotificationTemplate.find({
      workplaceId: new mongoose.Types.ObjectId(workplaceId),
      isDeleted: false,
    }).sort({ createdAt: -1 });

    return sendSuccess(res, { templates }, 'Templates retrieved successfully');
  } catch (error) {
    logger.error('Error fetching notification templates:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to fetch templates', 500);
  }
};

export const createNotificationTemplate = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const workplaceId = req.user!.workplaceId;
    const userId = req.user!._id;

    const template = new NotificationTemplate({
      ...req.body,
      workplaceId: new mongoose.Types.ObjectId(workplaceId),
      createdBy: new mongoose.Types.ObjectId(userId),
    });

    await template.save();
    return sendSuccess(res, { template }, 'Template created successfully', 201);
  } catch (error) {
    logger.error('Error creating notification template:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to create template', 500);
  }
};

export const updateNotificationTemplate = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { templateId } = req.params;
    const userId = req.user!._id;

    const template = await NotificationTemplate.findByIdAndUpdate(
      templateId,
      { ...req.body, updatedBy: new mongoose.Types.ObjectId(userId) },
      { new: true, runValidators: true }
    );

    if (!template) {
      return sendError(res, 'NOT_FOUND', 'Template not found', 404);
    }

    return sendSuccess(res, { template }, 'Template updated successfully');
  } catch (error) {
    logger.error('Error updating notification template:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to update template', 500);
  }
};

export const deleteNotificationTemplate = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { templateId } = req.params;
    const template = await NotificationTemplate.findByIdAndUpdate(
      templateId,
      { isDeleted: true },
      { new: true }
    );

    if (!template) {
      return sendError(res, 'NOT_FOUND', 'Template not found', 404);
    }

    return sendSuccess(res, null, 'Template deleted successfully');
  } catch (error) {
    logger.error('Error deleting notification template:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to delete template', 500);
  }
};

// ============ HISTORY ============

export const getNotificationHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const workplaceId = req.user!.workplaceId;
    const { limit = 100, status, channel } = req.query;

    const query: any = {
      workplaceId: new mongoose.Types.ObjectId(workplaceId),
    };

    if (status) query['deliveryStatus.status'] = status;
    if (channel) query['deliveryChannels.' + channel] = true;

    const history = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .populate('userId', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName');

    return sendSuccess(res, { history }, 'History retrieved successfully');
  } catch (error) {
    logger.error('Error fetching notification history:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to fetch history', 500);
  }
};

// ============ TEST ============

export const sendTestNotificationManagement = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { channelId, templateId, recipients } = req.body;
    const userId = req.user!._id;
    const workplaceId = req.user!.workplaceId;

    // TODO: Implement actual test notification sending
    // This would use the channel and template to send a test notification

    return sendSuccess(res, null, 'Test notification sent successfully');
  } catch (error) {
    logger.error('Error sending test notification:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to send test notification', 500);
  }
};
