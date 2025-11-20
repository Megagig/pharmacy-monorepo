import { Request, Response } from 'express';
import mongoose from 'mongoose';
import {
  notificationService,
  CreateNotificationData,
  NotificationFilters,
} from '../services/notificationService';
import { sendSuccess, sendError } from '../utils/responseHelpers';
import logger from '../utils/logger';
import Notification from '../models/Notification';

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    workplaceId: string;
    role: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

/**
 * Create a new notification
 */
export const createNotification = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const {
      userId,
      type,
      title,
      content,
      data,
      priority = 'normal',
      deliveryChannels,
      scheduledFor,
      expiresAt,
      groupKey,
    } = req.body;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return sendError(res, 'BAD_REQUEST', 'Invalid user ID', 400);
    }

    if (!type || !title || !content) {
      return sendError(
        res,
        'BAD_REQUEST',
        'Missing required fields: type, title, content',
        400
      );
    }

    const notificationData: CreateNotificationData = {
      userId: new mongoose.Types.ObjectId(userId),
      type,
      title,
      content,
      data: data || {},
      priority,
      deliveryChannels,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      groupKey,
      workplaceId: new mongoose.Types.ObjectId(req.user!.workplaceId),
      createdBy: new mongoose.Types.ObjectId(req.user!._id),
    };

    const notification = await notificationService.createNotification(
      notificationData
    );

    return sendSuccess(res, notification, 'Notification created successfully');
  } catch (error) {
    logger.error('Error creating notification:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to create notification', 500);
  }
};

/**
 * Get user notifications
 */
export const getUserNotifications = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.user!._id;
    const workplaceId = req.user!.workplaceId;

    const filters: NotificationFilters = {
      type: req.query.type as any,
      status: req.query.status as any,
      priority: req.query.priority as any,
      startDate: req.query.startDate
        ? new Date(req.query.startDate as string)
        : undefined,
      endDate: req.query.endDate
        ? new Date(req.query.endDate as string)
        : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    const result = await notificationService.getUserNotifications(
      userId,
      workplaceId,
      filters
    );

    return sendSuccess(res, result, 'Notifications retrieved successfully');
  } catch (error) {
    logger.error('Error getting user notifications:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to get notifications', 500);
  }
};

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user!._id;

    if (!notificationId || !mongoose.Types.ObjectId.isValid(notificationId)) {
      return sendError(res, 'BAD_REQUEST', 'Invalid notification ID', 400);
    }

    await notificationService.markAsRead(notificationId, userId);

    return sendSuccess(res, null, 'Notification marked as read');
  } catch (error) {
    logger.error('Error marking notification as read:', error);
    return sendError(
      res,
      'SERVER_ERROR',
      'Failed to mark notification as read',
      500
    );
  }
};

/**
 * Mark multiple notifications as read
 */
export const markMultipleAsRead = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { notificationIds } = req.body;
    const userId = req.user!._id;

    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      return sendError(
        res,
        'BAD_REQUEST',
        'Invalid notification IDs array',
        400
      );
    }

    const validIds = notificationIds.filter((id) =>
      mongoose.Types.ObjectId.isValid(id)
    );
    if (validIds.length === 0) {
      return sendError(
        res,
        'BAD_REQUEST',
        'No valid notification IDs provided',
        400
      );
    }

    // Mark all notifications as read
    await Notification.updateMany(
      {
        _id: { $in: validIds.map((id) => new mongoose.Types.ObjectId(id)) },
        userId: new mongoose.Types.ObjectId(userId),
        status: 'unread',
      },
      {
        $set: {
          status: 'read',
          readAt: new Date(),
        },
      }
    );

    return sendSuccess(
      res,
      { markedCount: validIds.length },
      'Notifications marked as read'
    );
  } catch (error) {
    logger.error('Error marking multiple notifications as read:', error);
    return sendError(
      res,
      'SERVER_ERROR',
      'Failed to mark notifications as read',
      500
    );
  }
};

/**
 * Dismiss notification
 */
export const dismissNotification = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user!._id;

    if (!notificationId || !mongoose.Types.ObjectId.isValid(notificationId)) {
      return sendError(res, 'BAD_REQUEST', 'Invalid notification ID', 400);
    }

    const notification = await Notification.findOne({
      _id: notificationId,
      userId: userId,
    });

    if (!notification) {
      return sendError(res, 'NOT_FOUND', 'Notification not found', 404);
    }

    notification.markAsDismissed();
    await notification.save();

    return sendSuccess(res, null, 'Notification dismissed');
  } catch (error) {
    logger.error('Error dismissing notification:', error);
    return sendError(
      res,
      'SERVER_ERROR',
      'Failed to dismiss notification',
      500
    );
  }
};

/**
 * Get unread notification count
 */
export const getUnreadCount = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.user!._id;
    const workplaceId = req.user!.workplaceId;

    const unreadCount = await (Notification as any).getUnreadCountByUser(
      new mongoose.Types.ObjectId(userId),
      new mongoose.Types.ObjectId(workplaceId)
    );

    return sendSuccess(
      res,
      { unreadCount },
      'Unread count retrieved successfully'
    );
  } catch (error) {
    logger.error('Error getting unread count:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to get unread count', 500);
  }
};

/**
 * Get notification preferences
 */
export const getNotificationPreferences = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.user!._id;
    const preferences = await notificationService.getNotificationPreferences(
      userId
    );

    return sendSuccess(
      res,
      preferences,
      'Notification preferences retrieved successfully'
    );
  } catch (error) {
    logger.error('Error getting notification preferences:', error);
    return sendError(
      res,
      'SERVER_ERROR',
      'Failed to get notification preferences',
      500
    );
  }
};

/**
 * Update notification preferences
 */
export const updateNotificationPreferences = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.user!._id;
    const preferences = req.body;

    await notificationService.updateNotificationPreferences(
      userId,
      preferences
    );

    return sendSuccess(
      res,
      null,
      'Notification preferences updated successfully'
    );
  } catch (error) {
    logger.error('Error updating notification preferences:', error);
    return sendError(
      res,
      'SERVER_ERROR',
      'Failed to update notification preferences',
      500
    );
  }
};

/**
 * Create conversation notification
 */
export const createConversationNotification = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { type, conversationId, recipientIds, messageId, customContent } =
      req.body;

    if (!type || !conversationId || !Array.isArray(recipientIds)) {
      return sendError(
        res,
        'BAD_REQUEST',
        'Missing required fields: type, conversationId, recipientIds',
        400
      );
    }

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return sendError(res, 'BAD_REQUEST', 'Invalid conversation ID', 400);
    }

    const validRecipientIds = recipientIds.filter((id) =>
      mongoose.Types.ObjectId.isValid(id)
    );
    if (validRecipientIds.length === 0) {
      return sendError(
        res,
        'BAD_REQUEST',
        'No valid recipient IDs provided',
        400
      );
    }

    const senderId = req.user!._id;
    const notifications =
      await notificationService.createConversationNotification(
        type,
        conversationId,
        senderId,
        validRecipientIds,
        messageId,
        customContent
      );

    return sendSuccess(
      res,
      notifications,
      'Conversation notifications created successfully'
    );
  } catch (error) {
    logger.error('Error creating conversation notification:', error);
    return sendError(
      res,
      'SERVER_ERROR',
      'Failed to create conversation notification',
      500
    );
  }
};

/**
 * Create patient query notification
 */
export const createPatientQueryNotification = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { patientId, conversationId, messageContent, recipientIds } =
      req.body;

    if (
      !patientId ||
      !conversationId ||
      !messageContent ||
      !Array.isArray(recipientIds)
    ) {
      return sendError(
        res,
        'BAD_REQUEST',
        'Missing required fields: patientId, conversationId, messageContent, recipientIds',
        400
      );
    }

    if (
      !mongoose.Types.ObjectId.isValid(patientId) ||
      !mongoose.Types.ObjectId.isValid(conversationId)
    ) {
      return sendError(
        res,
        'BAD_REQUEST',
        'Invalid patient ID or conversation ID',
        400
      );
    }

    const validRecipientIds = recipientIds.filter((id) =>
      mongoose.Types.ObjectId.isValid(id)
    );
    if (validRecipientIds.length === 0) {
      return sendError(
        res,
        'BAD_REQUEST',
        'No valid recipient IDs provided',
        400
      );
    }

    const notifications =
      await notificationService.createPatientQueryNotification(
        patientId,
        conversationId,
        messageContent,
        validRecipientIds
      );

    return sendSuccess(
      res,
      notifications,
      'Patient query notifications created successfully'
    );
  } catch (error) {
    logger.error('Error creating patient query notification:', error);
    return sendError(
      res,
      'SERVER_ERROR',
      'Failed to create patient query notification',
      500
    );
  }
};

/**
 * Get notification statistics
 */
export const getNotificationStatistics = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const workplaceId = req.user!.workplaceId;
    const { startDate, endDate } = req.query;

    const dateRange = {
      start: startDate
        ? new Date(startDate as string)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      end: endDate ? new Date(endDate as string) : new Date(),
    };

    const stats = await (Notification as any).getNotificationStats(
      new mongoose.Types.ObjectId(workplaceId),
      dateRange
    );

    return sendSuccess(
      res,
      stats,
      'Notification statistics retrieved successfully'
    );
  } catch (error) {
    logger.error('Error getting notification statistics:', error);
    return sendError(
      res,
      'SERVER_ERROR',
      'Failed to get notification statistics',
      500
    );
  }
};

/**
 * Process scheduled notifications (admin endpoint)
 */
export const processScheduledNotifications = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    // Check if user has admin role
    if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
      return sendError(res, 'FORBIDDEN', 'Insufficient permissions', 403);
    }

    await notificationService.processScheduledNotifications();

    return sendSuccess(
      res,
      null,
      'Scheduled notifications processed successfully'
    );
  } catch (error) {
    logger.error('Error processing scheduled notifications:', error);
    return sendError(
      res,
      'SERVER_ERROR',
      'Failed to process scheduled notifications',
      500
    );
  }
};

/**
 * Retry failed notifications (admin endpoint)
 */
export const retryFailedNotifications = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    // Check if user has admin role
    if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
      return sendError(res, 'FORBIDDEN', 'Insufficient permissions', 403);
    }

    await notificationService.retryFailedNotifications();

    return sendSuccess(
      res,
      null,
      'Failed notifications retry processed successfully'
    );
  } catch (error) {
    logger.error('Error retrying failed notifications:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to retry notifications', 500);
  }
};

/**
 * Send test notification
 */
export const sendTestNotification = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.user!._id;
    const { type = 'system_notification', channels = ['inApp'] } = req.body;

    const testNotificationData: CreateNotificationData = {
      userId: new mongoose.Types.ObjectId(userId),
      type,
      title: 'Test Notification',
      content:
        'This is a test notification to verify your notification settings are working correctly.',
      data: {
        metadata: {
          isTest: true,
          sentAt: new Date().toISOString(),
        },
      },
      priority: 'normal',
      deliveryChannels: {
        inApp: channels.includes('inApp'),
        email: channels.includes('email'),
        sms: channels.includes('sms'),
        push: channels.includes('push'),
      },
      workplaceId: new mongoose.Types.ObjectId(req.user!.workplaceId),
      createdBy: new mongoose.Types.ObjectId(userId),
    };

    const notification = await notificationService.createNotification(
      testNotificationData
    );

    return sendSuccess(
      res,
      notification,
      'Test notification sent successfully'
    );
  } catch (error) {
    logger.error('Error sending test notification:', error);
    return sendError(
      res,
      'SERVER_ERROR',
      'Failed to send test notification',
      500
    );
  }
};

/**
 * Archive old notifications
 */
export const archiveOldNotifications = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { daysOld = 30 } = req.body;
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

    const result = await Notification.updateMany(
      {
        createdAt: { $lt: cutoffDate },
        status: { $ne: 'archived' },
      },
      {
        $set: {
          status: 'archived',
          updatedAt: new Date(),
        },
      }
    );

    return sendSuccess(
      res,
      { archivedCount: result.modifiedCount },
      `Archived ${result.modifiedCount} old notifications`
    );
  } catch (error) {
    logger.error('Error archiving old notifications:', error);
    return sendError(
      res,
      'SERVER_ERROR',
      'Failed to archive old notifications',
      500
    );
  }
};

/**
 * Delete expired notifications
 */
export const deleteExpiredNotifications = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    // Check if user has admin role
    if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
      return sendError(res, 'FORBIDDEN', 'Insufficient permissions', 403);
    }

    const result = await Notification.deleteMany({
      expiresAt: { $lt: new Date() },
    });

    return sendSuccess(
      res,
      { deletedCount: result.deletedCount },
      `Deleted ${result.deletedCount} expired notifications`
    );
  } catch (error) {
    logger.error('Error deleting expired notifications:', error);
    return sendError(
      res,
      'SERVER_ERROR',
      'Failed to delete expired notifications',
      500
    );
  }
};
