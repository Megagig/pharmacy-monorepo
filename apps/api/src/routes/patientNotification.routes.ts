import express from 'express';
import { param, query } from 'express-validator';
import * as patientNotificationController from '../controllers/patientNotificationController';
import { patientAuth } from '../middlewares/patientAuth';
import { validateRequest } from '../middlewares/validation';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiter: 100 requests per 15 minutes
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later',
});

// Apply rate limiter and patient authentication to all routes
router.use(limiter);
router.use(patientAuth);

/**
 * @route   GET /api/patient-portal/notifications
 * @desc    Get notifications for current patient
 * @access  Authenticated Patient
 */
router.get(
    '/',
    [
        query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Limit must be between 1 and 100'),
        query('status')
            .optional()
            .isIn(['unread', 'read', 'dismissed', 'archived'])
            .withMessage('Invalid status'),
        query('type')
            .optional()
            .isString()
            .withMessage('Type must be a string'),
        validateRequest,
    ],
    patientNotificationController.getNotifications
);

/**
 * @route   GET /api/patient-portal/notifications/unread-count
 * @desc    Get unread notifications count
 * @access  Authenticated Patient
 */
router.get(
    '/unread-count',
    patientNotificationController.getUnreadCount
);

/**
 * @route   PATCH /api/patient-portal/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Authenticated Patient
 */
router.patch(
    '/read-all',
    patientNotificationController.markAllAsRead
);

/**
 * @route   PATCH /api/patient-portal/notifications/:notificationId/read
 * @desc    Mark notification as read
 * @access  Authenticated Patient
 */
router.patch(
    '/:notificationId/read',
    [
        param('notificationId')
            .isMongoId()
            .withMessage('Notification ID must be a valid MongoDB ID'),
        validateRequest,
    ],
    patientNotificationController.markAsRead
);

/**
 * @route   DELETE /api/patient-portal/notifications/:notificationId
 * @desc    Delete notification
 * @access  Authenticated Patient
 */
router.delete(
    '/:notificationId',
    [
        param('notificationId')
            .isMongoId()
            .withMessage('Notification ID must be a valid MongoDB ID'),
        validateRequest,
    ],
    patientNotificationController.deleteNotification
);

export default router;
