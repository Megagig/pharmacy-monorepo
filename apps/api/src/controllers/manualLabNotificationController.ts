import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { manualLabNotificationService, CriticalLabAlert } from '../services/manualLabNotificationService';
import logger from '../utils/logger';
import User from '../models/User';
import Patient from '../models/Patient';

// Extend Request interface to include user
interface AuthenticatedRequest extends Request {
    user?: {
        _id: string;
        workplaceId: string;
        role: string;
        email: string;
        phone?: string;
    };
}

// In-memory storage for alerts (in production, use Redis or MongoDB)
const activeAlerts = new Map<string, any>();
const acknowledgedAlerts = new Set<string>();
const dismissedAlerts = new Set<string>();

/**
 * Get critical alerts for the current workplace
 */
export const getCriticalAlerts = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { workplaceId } = req.user!;

        // Filter alerts for the current workplace
        const workplaceAlerts = Array.from(activeAlerts.values())
            .filter(alert => alert.workplaceId === workplaceId)
            .filter(alert => !dismissedAlerts.has(alert.id))
            .map(alert => ({
                ...alert,
                acknowledged: acknowledgedAlerts.has(alert.id),
            }))
            .sort((a, b) => {
                // Sort by severity and timestamp
                const severityOrder = { critical: 3, major: 2, moderate: 1 };
                const severityDiff = (severityOrder[b.severity as keyof typeof severityOrder] || 0) - (severityOrder[a.severity as keyof typeof severityOrder] || 0);
                if (severityDiff !== 0) return severityDiff;
                return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
            });

        return res.json({
            success: true,
            data: workplaceAlerts,
        });
    } catch (error) {
        logger.error('Error fetching critical alerts:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'FETCH_ALERTS_ERROR',
                message: 'Failed to fetch critical alerts',
            },
        });
    }
};

/**
 * Acknowledge a critical alert
 */
export const acknowledgeAlert = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { alertId } = req.params;
        const { _id: userId } = req.user!;

        if (!alertId) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Alert ID is required',
                },
            });
        }

        if (!activeAlerts.has(alertId)) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'ALERT_NOT_FOUND',
                    message: 'Alert not found',
                },
            });
        }

        // Mark alert as acknowledged
        acknowledgedAlerts.add(alertId);

        // Update alert with acknowledgment info
        const alert = activeAlerts.get(alertId);
        if (alert) {
            alert.acknowledged = true;
            alert.acknowledgedBy = userId;
            alert.acknowledgedAt = new Date().toISOString();
            activeAlerts.set(alertId, alert);
        }

        logger.info(`Alert ${alertId} acknowledged by user ${userId}`);

        return res.json({
            success: true,
            message: 'Alert acknowledged successfully',
        });
    } catch (error) {
        logger.error('Error acknowledging alert:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'ACKNOWLEDGE_ERROR',
                message: 'Failed to acknowledge alert',
            },
        });
    }
};

/**
 * Dismiss a critical alert
 */
export const dismissAlert = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { alertId } = req.params;
        const { _id: userId } = req.user!;

        if (!alertId) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Alert ID is required',
                },
            });
        }

        if (!activeAlerts.has(alertId)) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'ALERT_NOT_FOUND',
                    message: 'Alert not found',
                },
            });
        }

        // Mark alert as dismissed
        dismissedAlerts.add(alertId);

        logger.info(`Alert ${alertId} dismissed by user ${userId}`);

        return res.json({
            success: true,
            message: 'Alert dismissed successfully',
        });
    } catch (error) {
        logger.error('Error dismissing alert:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'DISMISS_ERROR',
                message: 'Failed to dismiss alert',
            },
        });
    }
};

/**
 * Trigger a critical alert
 */
export const triggerCriticalAlert = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { workplaceId } = req.user!;
        const {
            type,
            severity,
            orderId,
            patientId,
            message,
            details,
            requiresImmediate,
            aiInterpretation,
        } = req.body;

        // Validate required fields
        if (!type || !severity || !orderId || !patientId || !message) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Missing required fields',
                },
            });
        }

        // Get patient information
        const patient = await Patient.findById(patientId);
        if (!patient) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'PATIENT_NOT_FOUND',
                    message: 'Patient not found',
                },
            });
        }

        // Create alert object
        const alertId = new mongoose.Types.ObjectId().toString();
        const alert = {
            id: alertId,
            type,
            severity,
            orderId,
            patientId,
            patientName: `${patient.firstName} ${patient.lastName}`,
            patientMRN: patient.mrn,
            message,
            details,
            requiresImmediate,
            timestamp: new Date().toISOString(),
            workplaceId,
            aiInterpretation,
        };

        // Store alert
        activeAlerts.set(alertId, alert);

        // Send notifications via service
        const criticalAlert: CriticalLabAlert = {
            type: type as any,
            severity: severity as any,
            orderId,
            patientId: new mongoose.Types.ObjectId(patientId),
            message,
            details,
            requiresImmediate,
            aiInterpretation,
        };

        await manualLabNotificationService.sendCriticalLabAlert(criticalAlert);

        return res.json({
            success: true,
            data: { alertId },
            message: 'Critical alert triggered successfully',
        });
    } catch (error) {
        logger.error('Error triggering critical alert:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'TRIGGER_ALERT_ERROR',
                message: 'Failed to trigger critical alert',
            },
        });
    }
};

/**
 * Trigger AI interpretation complete notification
 */
export const triggerAIInterpretationComplete = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { orderId, patientId, pharmacistId, interpretation } = req.body;

        // Validate required fields
        if (!orderId || !patientId || !pharmacistId || !interpretation) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Missing required fields',
                },
            });
        }

        await manualLabNotificationService.sendAIInterpretationComplete(
            orderId,
            new mongoose.Types.ObjectId(patientId),
            new mongoose.Types.ObjectId(pharmacistId),
            interpretation
        );

        return res.json({
            success: true,
            message: 'AI interpretation notification sent successfully',
        });
    } catch (error) {
        logger.error('Error triggering AI interpretation notification:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'AI_NOTIFICATION_ERROR',
                message: 'Failed to send AI interpretation notification',
            },
        });
    }
};

/**
 * Trigger patient result notification
 */
export const triggerPatientResultNotification = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { orderId, patientId, includeInterpretation = false } = req.body;

        // Validate required fields
        if (!orderId || !patientId) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Missing required fields',
                },
            });
        }

        await manualLabNotificationService.sendPatientResultNotification(
            orderId,
            new mongoose.Types.ObjectId(patientId),
            includeInterpretation
        );

        return res.json({
            success: true,
            message: 'Patient result notification sent successfully',
        });
    } catch (error) {
        logger.error('Error triggering patient result notification:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'PATIENT_NOTIFICATION_ERROR',
                message: 'Failed to send patient result notification',
            },
        });
    }
};

/**
 * Get user notification preferences
 */
export const getNotificationPreferences = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { _id: userId } = req.user!;

        const user = await User.findById(userId).select('notificationPreferences');
        if (!user) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'USER_NOT_FOUND',
                    message: 'User not found',
                },
            });
        }

        const preferences = user.notificationPreferences?.manualLab || {
            criticalAlerts: true,
            resultNotifications: true,
            orderReminders: true,
            email: true,
            sms: false,
            push: false,
        };

        return res.json({
            success: true,
            data: preferences,
        });
    } catch (error) {
        logger.error('Error fetching notification preferences:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'FETCH_PREFERENCES_ERROR',
                message: 'Failed to fetch notification preferences',
            },
        });
    }
};

/**
 * Update user notification preferences
 */
export const updateNotificationPreferences = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { _id: userId } = req.user!;
        const preferences = req.body;

        await manualLabNotificationService.updateNotificationPreferences(
            new mongoose.Types.ObjectId(userId),
            preferences
        );

        return res.json({
            success: true,
            message: 'Notification preferences updated successfully',
        });
    } catch (error) {
        logger.error('Error updating notification preferences:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'UPDATE_PREFERENCES_ERROR',
                message: 'Failed to update notification preferences',
            },
        });
    }
};

/**
 * Get notification statistics
 */
export const getNotificationStatistics = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { workplaceId } = req.user!;

        const stats = await manualLabNotificationService.getNotificationStatistics(
            new mongoose.Types.ObjectId(workplaceId)
        );

        return res.json({
            success: true,
            data: stats,
        });
    } catch (error) {
        logger.error('Error fetching notification statistics:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'FETCH_STATS_ERROR',
                message: 'Failed to fetch notification statistics',
            },
        });
    }
};

/**
 * Send test notification
 */
export const sendTestNotification = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { _id: userId, email, phone } = req.user!;
        const { type } = req.body;

        if (!['email', 'sms'].includes(type)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_TYPE',
                    message: 'Invalid notification type',
                },
            });
        }

        if (type === 'sms' && !phone) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'NO_PHONE',
                    message: 'Phone number not available for SMS test',
                },
            });
        }

        // Create a test alert
        const testAlert: CriticalLabAlert = {
            type: 'critical_result',
            severity: 'moderate',
            orderId: 'TEST-' + Date.now(),
            patientId: new mongoose.Types.ObjectId(),
            message: 'This is a test notification from the Manual Lab system',
            details: { test: true },
            requiresImmediate: false,
        };

        // Send test notification
        await manualLabNotificationService.sendCriticalLabAlert(testAlert);

        return res.json({
            success: true,
            message: `Test ${type} notification sent successfully`,
        });
    } catch (error) {
        logger.error('Error sending test notification:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'TEST_NOTIFICATION_ERROR',
                message: 'Failed to send test notification',
            },
        });
    }
};

/**
 * Get notification delivery status for an order
 */
export const getNotificationDeliveryStatus = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { orderId } = req.params;

        if (!orderId) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Order ID is required',
                },
            });
        }

        // In a real implementation, this would query the notification delivery tracking system
        const deliveryStatus = {
            orderId,
            notifications: [
                {
                    type: 'ai_interpretation_complete',
                    channel: 'email',
                    status: 'delivered',
                    sentAt: new Date().toISOString(),
                    deliveredAt: new Date().toISOString(),
                },
                {
                    type: 'critical_alert',
                    channel: 'sms',
                    status: 'pending',
                    sentAt: new Date().toISOString(),
                    attempts: 1,
                    nextRetry: new Date(Date.now() + 60000).toISOString(),
                },
            ],
        };

        return res.json({
            success: true,
            data: deliveryStatus,
        });
    } catch (error) {
        logger.error('Error fetching delivery status:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'DELIVERY_STATUS_ERROR',
                message: 'Failed to fetch delivery status',
            },
        });
    }
};

/**
 * Retry failed notifications
 */
export const retryFailedNotifications = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { orderId } = req.params;

        if (!orderId) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Order ID is required',
                },
            });
        }

        // In a real implementation, this would retry failed notifications for the order
        logger.info(`Retrying failed notifications for order ${orderId}`);

        return res.json({
            success: true,
            message: 'Failed notifications retry initiated',
        });
    } catch (error) {
        logger.error('Error retrying failed notifications:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'RETRY_ERROR',
                message: 'Failed to retry notifications',
            },
        });
    }
};