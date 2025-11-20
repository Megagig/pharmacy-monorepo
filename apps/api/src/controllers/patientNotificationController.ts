import { Response } from 'express';
import { AuthRequest } from '../types/auth';
import healthRecordsNotificationService from '../services/healthRecordsNotificationService';
import { AppError } from '../utils/AppError';
import logger from '../utils/logger';
import mongoose from 'mongoose';

/**
 * Get notifications for current patient
 * GET /api/patient-portal/notifications
 */
export const getNotifications = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        const workplaceId = req.user?.workplaceId;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const status = req.query.status as string;
        const type = req.query.type as string;

        if (!userId || !workplaceId) {
            throw new AppError('User not authenticated', 401);
        }

        // Convert workplaceId to ObjectId if it's a string
        const workplaceObjectId = typeof workplaceId === 'string'
            ? new mongoose.Types.ObjectId(workplaceId)
            : workplaceId;

        const filter: any = {};
        if (status) filter.status = status;
        if (type) filter.type = type;

        const { notifications, total } =
            await healthRecordsNotificationService.getNotifications(
                userId,
                workplaceObjectId,
                page,
                limit,
                filter
            );

        res.status(200).json({
            success: true,
            data: {
                notifications,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(total / limit),
                    totalItems: total,
                    itemsPerPage: limit,
                },
            },
        });
    } catch (error: any) {
        logger.error('Error fetching notifications:', error);
        if (error instanceof AppError) {
            res.status(error.statusCode).json({
                success: false,
                message: error.message,
            });
        } else {
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to fetch notifications',
            });
        }
    }
};

/**
 * Get unread notifications count
 * GET /api/patient-portal/notifications/unread-count
 */
export const getUnreadCount = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        const workplaceId = req.user?.workplaceId;

        if (!userId || !workplaceId) {
            throw new AppError('User not authenticated', 401);
        }

        // Convert workplaceId to ObjectId if it's a string
        const workplaceObjectId = typeof workplaceId === 'string'
            ? new mongoose.Types.ObjectId(workplaceId)
            : workplaceId;

        const count = await healthRecordsNotificationService.getUnreadCount(
            userId,
            workplaceObjectId
        );

        res.status(200).json({
            success: true,
            data: {
                unreadCount: count,
            },
        });
    } catch (error: any) {
        logger.error('Error fetching unread count:', error);
        if (error instanceof AppError) {
            res.status(error.statusCode).json({
                success: false,
                message: error.message,
            });
        } else {
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to fetch unread count',
            });
        }
    }
};

/**
 * Mark notification as read
 * PATCH /api/patient-portal/notifications/:notificationId/read
 */
export const markAsRead = async (req: AuthRequest, res: Response) => {
    try {
        const { notificationId } = req.params;
        const userId = req.user?._id;

        if (!userId) {
            throw new AppError('User not authenticated', 401);
        }

        if (!mongoose.Types.ObjectId.isValid(notificationId)) {
            throw new AppError('Invalid notification ID', 400);
        }

        await healthRecordsNotificationService.markAsRead(
            new mongoose.Types.ObjectId(notificationId),
            userId
        );

        res.status(200).json({
            success: true,
            message: 'Notification marked as read',
        });
    } catch (error: any) {
        logger.error('Error marking notification as read:', error);
        if (error instanceof AppError) {
            res.status(error.statusCode).json({
                success: false,
                message: error.message,
            });
        } else {
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to mark notification as read',
            });
        }
    }
};

/**
 * Mark all notifications as read
 * PATCH /api/patient-portal/notifications/read-all
 */
export const markAllAsRead = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        const workplaceId = req.user?.workplaceId;

        if (!userId || !workplaceId) {
            throw new AppError('User not authenticated', 401);
        }

        // Convert workplaceId to ObjectId if it's a string
        const workplaceObjectId = typeof workplaceId === 'string'
            ? new mongoose.Types.ObjectId(workplaceId)
            : workplaceId;

        const count = await healthRecordsNotificationService.markAllAsRead(
            userId,
            workplaceObjectId
        );

        res.status(200).json({
            success: true,
            message: `Marked ${count} notification(s) as read`,
            data: {
                markedCount: count,
            },
        });
    } catch (error: any) {
        logger.error('Error marking all notifications as read:', error);
        if (error instanceof AppError) {
            res.status(error.statusCode).json({
                success: false,
                message: error.message,
            });
        } else {
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to mark all notifications as read',
            });
        }
    }
};

/**
 * Delete notification
 * DELETE /api/patient-portal/notifications/:notificationId
 */
export const deleteNotification = async (req: AuthRequest, res: Response) => {
    try {
        const { notificationId } = req.params;
        const userId = req.user?._id;

        if (!userId) {
            throw new AppError('User not authenticated', 401);
        }

        if (!mongoose.Types.ObjectId.isValid(notificationId)) {
            throw new AppError('Invalid notification ID', 400);
        }

        await healthRecordsNotificationService.deleteNotification(
            new mongoose.Types.ObjectId(notificationId),
            userId
        );

        res.status(200).json({
            success: true,
            message: 'Notification deleted successfully',
        });
    } catch (error: any) {
        logger.error('Error deleting notification:', error);
        if (error instanceof AppError) {
            res.status(error.statusCode).json({
                success: false,
                message: error.message,
            });
        } else {
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to delete notification',
            });
        }
    }
};
