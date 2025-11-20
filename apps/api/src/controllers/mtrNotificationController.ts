import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { mtrNotificationService, NotificationPreferences, CriticalAlert } from '../services/mtrNotificationService';
import { sendSuccess, sendError } from '../utils/responseHelpers';
import logger from '../utils/logger';
import MTRFollowUp from '../models/MTRFollowUp';
import DrugTherapyProblem from '../models/DrugTherapyProblem';

interface AuthenticatedRequest extends Request {
    user?: {
        _id: string;
        workplaceId: string;
        role: string;
        email: string;
    };
}

/**
 * Schedule a follow-up reminder
 */
export const scheduleFollowUpReminder = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { followUpId } = req.params;
        const { reminderType = 'email', scheduledFor } = req.body;

        if (!followUpId || !mongoose.Types.ObjectId.isValid(followUpId)) {
            return sendError(res, 'BAD_REQUEST', 'Invalid follow-up ID', 400);
        }

        const scheduledDate = scheduledFor ? new Date(scheduledFor) : undefined;

        await mtrNotificationService.scheduleFollowUpReminder(
            new mongoose.Types.ObjectId(followUpId),
            reminderType,
            scheduledDate
        );

        return sendSuccess(res, null, 'Follow-up reminder scheduled successfully');
    } catch (error) {
        logger.error('Error scheduling follow-up reminder:', error);
        return sendError(res, 'SERVER_ERROR', 'Failed to schedule follow-up reminder', 500);
    }
};

/**
 * Send critical alert
 */
export const sendCriticalAlert = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const {
            type,
            severity,
            patientId,
            reviewId,
            problemId,
            message,
            details,
            requiresImmediate = false
        } = req.body;

        if (!patientId || !mongoose.Types.ObjectId.isValid(patientId)) {
            return sendError(res, 'BAD_REQUEST', 'Invalid patient ID', 400);
        }

        const alert: CriticalAlert = {
            type,
            severity,
            patientId: new mongoose.Types.ObjectId(patientId),
            reviewId: reviewId ? new mongoose.Types.ObjectId(reviewId) : undefined,
            problemId: problemId ? new mongoose.Types.ObjectId(problemId) : undefined,
            message,
            details,
            requiresImmediate
        };

        await mtrNotificationService.sendCriticalAlert(alert);

        return sendSuccess(res, null, 'Critical alert sent successfully');
    } catch (error) {
        logger.error('Error sending critical alert:', error);
        return sendError(res, 'SERVER_ERROR', 'Failed to send critical alert', 500);
    }
};

/**
 * Check for overdue follow-ups and send alerts
 */
export const checkOverdueFollowUps = async (req: AuthenticatedRequest, res: Response) => {
    try {
        await mtrNotificationService.checkOverdueFollowUps();
        return sendSuccess(res, null, 'Overdue follow-ups checked successfully');
    } catch (error) {
        logger.error('Error checking overdue follow-ups:', error);
        return sendError(res, 'SERVER_ERROR', 'Failed to check overdue follow-ups', 500);
    }
};

/**
 * Update user notification preferences
 */
export const updateNotificationPreferences = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
        }

        const preferences: Partial<NotificationPreferences> = req.body;

        await mtrNotificationService.updateNotificationPreferences(
            new mongoose.Types.ObjectId(userId),
            preferences
        );

        return sendSuccess(res, null, 'Notification preferences updated successfully');
    } catch (error) {
        logger.error('Error updating notification preferences:', error);
        return sendError(res, 'SERVER_ERROR', 'Failed to update notification preferences', 500);
    }
};

/**
 * Get user notification preferences
 */
export const getNotificationPreferences = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
        }

        const User = mongoose.model('User');
        const user = await User.findById(userId).select('notificationPreferences');

        if (!user) {
            return sendError(res, 'NOT_FOUND', 'User not found', 404);
        }

        const defaultPreferences: NotificationPreferences = {
            email: true,
            sms: false,
            push: true,
            followUpReminders: true,
            criticalAlerts: true,
            dailyDigest: false,
            weeklyReport: false
        };

        const preferences = { ...defaultPreferences, ...(user.notificationPreferences || {}) };

        return sendSuccess(res, preferences, 'Notification preferences retrieved successfully');
    } catch (error) {
        logger.error('Error getting notification preferences:', error);
        return sendError(res, 'SERVER_ERROR', 'Failed to get notification preferences', 500);
    }
};

/**
 * Get notification statistics
 */
export const getNotificationStatistics = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const workplaceId = req.user?.workplaceId;
        const stats = await mtrNotificationService.getNotificationStatistics(
            workplaceId ? new mongoose.Types.ObjectId(workplaceId) : undefined
        );

        return sendSuccess(res, stats, 'Notification statistics retrieved successfully');
    } catch (error) {
        logger.error('Error getting notification statistics:', error);
        return sendError(res, 'SERVER_ERROR', 'Failed to get notification statistics', 500);
    }
};

/**
 * Process pending reminders manually
 */
export const processPendingReminders = async (req: AuthenticatedRequest, res: Response) => {
    try {
        await mtrNotificationService.processPendingReminders();
        return sendSuccess(res, null, 'Pending reminders processed successfully');
    } catch (error) {
        logger.error('Error processing pending reminders:', error);
        return sendError(res, 'SERVER_ERROR', 'Failed to process pending reminders', 500);
    }
};

/**
 * Send test notification
 */
export const sendTestNotification = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        const { type = 'email' } = req.body;

        if (!userId) {
            return sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
        }

        // Create a test follow-up reminder
        const testData = {
            followUpId: new mongoose.Types.ObjectId(),
            patientName: 'Test Patient',
            followUpType: 'phone_call',
            scheduledDate: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
            description: 'This is a test notification to verify your notification settings.',
            reviewNumber: 'MTR-TEST-001',
            priority: 'medium',
            estimatedDuration: 30
        };

        // Send test notification immediately
        await mtrNotificationService.scheduleFollowUpReminder(
            testData.followUpId,
            type,
            new Date() // Send now
        );

        return sendSuccess(res, null, `Test ${type} notification sent successfully`);
    } catch (error) {
        logger.error('Error sending test notification:', error);
        return sendError(res, 'SERVER_ERROR', 'Failed to send test notification', 500);
    }
};

/**
 * Get follow-up reminders for a specific follow-up
 */
export const getFollowUpReminders = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { followUpId } = req.params;

        if (!followUpId || !mongoose.Types.ObjectId.isValid(followUpId)) {
            return sendError(res, 'BAD_REQUEST', 'Invalid follow-up ID', 400);
        }

        const followUp = await MTRFollowUp.findById(followUpId)
            .select('reminders')
            .populate('reminders.recipientId', 'firstName lastName email');

        if (!followUp) {
            return sendError(res, 'NOT_FOUND', 'Follow-up not found', 404);
        }

        return sendSuccess(res, followUp.reminders, 'Follow-up reminders retrieved successfully');
    } catch (error) {
        logger.error('Error getting follow-up reminders:', error);
        return sendError(res, 'SERVER_ERROR', 'Failed to get follow-up reminders', 500);
    }
};

/**
 * Cancel scheduled reminder
 */
export const cancelScheduledReminder = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { followUpId, reminderId } = req.params;

        if (!followUpId || !mongoose.Types.ObjectId.isValid(followUpId)) {
            return sendError(res, 'BAD_REQUEST', 'Invalid follow-up ID', 400);
        }

        const followUp = await MTRFollowUp.findById(followUpId);
        if (!followUp) {
            return sendError(res, 'NOT_FOUND', 'Follow-up not found', 404);
        }

        // Find the reminder in the array
        const reminderIndex = followUp.reminders.findIndex((r: any) => r._id?.toString() === reminderId);
        if (reminderIndex === -1) {
            return sendError(res, 'NOT_FOUND', 'Reminder not found', 404);
        }

        const reminder = followUp.reminders[reminderIndex];
        if (reminder && reminder.sent) {
            return sendError(res, 'BAD_REQUEST', 'Cannot cancel reminder that has already been sent', 400);
        }

        // Remove the reminder
        followUp.reminders.splice(reminderIndex, 1);
        await followUp.save();

        return sendSuccess(res, null, 'Reminder cancelled successfully');
    } catch (error) {
        logger.error('Error cancelling reminder:', error);
        return sendError(res, 'SERVER_ERROR', 'Failed to cancel reminder', 500);
    }
};

/**
 * Trigger drug interaction check and send alerts if needed
 */
export const checkDrugInteractions = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { patientId, medications } = req.body;

        if (!patientId || !mongoose.Types.ObjectId.isValid(patientId)) {
            return sendError(res, 'BAD_REQUEST', 'Invalid patient ID', 400);
        }

        // This is a placeholder for actual drug interaction checking
        // In a real implementation, this would integrate with a drug database API
        const mockInteractions = [
            {
                severity: 'major',
                medications: ['Warfarin', 'Aspirin'],
                description: 'Increased risk of bleeding',
                clinicalSignificance: 'Monitor INR closely and watch for signs of bleeding'
            }
        ];

        // Send critical alerts for major/critical interactions
        for (const interaction of mockInteractions) {
            if (['critical', 'major'].includes(interaction.severity)) {
                const alert: CriticalAlert = {
                    type: 'drug_interaction',
                    severity: interaction.severity as 'critical' | 'major' | 'moderate',
                    patientId: new mongoose.Types.ObjectId(patientId),
                    message: `Drug interaction detected: ${interaction.medications.join(' + ')}`,
                    details: interaction,
                    requiresImmediate: interaction.severity === 'critical'
                };

                await mtrNotificationService.sendCriticalAlert(alert);
            }
        }

        return sendSuccess(res, mockInteractions, 'Drug interactions checked successfully');
    } catch (error) {
        logger.error('Error checking drug interactions:', error);
        return sendError(res, 'SERVER_ERROR', 'Failed to check drug interactions', 500);
    }
};

/**
 * Send notification for high severity drug therapy problem
 */
export const notifyHighSeverityDTP = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { problemId } = req.params;

        if (!problemId || !mongoose.Types.ObjectId.isValid(problemId)) {
            return sendError(res, 'BAD_REQUEST', 'Invalid problem ID', 400);
        }

        const problem = await DrugTherapyProblem.findById(problemId)
            .populate('patientId', 'firstName lastName mrn');

        if (!problem) {
            return sendError(res, 'NOT_FOUND', 'Drug therapy problem not found', 404);
        }

        // Only send alerts for high severity problems
        if (!['critical', 'major'].includes(problem.severity)) {
            return sendError(res, 'BAD_REQUEST', 'Notifications are only sent for critical or major severity problems', 400);
        }

        const patient = problem.patientId as any;
        const alert: CriticalAlert = {
            type: 'high_severity_dtp',
            severity: problem.severity as 'critical' | 'major',
            patientId: problem.patientId,
            reviewId: problem.reviewId,
            problemId: problem._id,
            message: `High severity drug therapy problem identified: ${problem.description}`,
            details: {
                type: problem.type,
                category: problem.category,
                affectedMedications: problem.affectedMedications,
                clinicalSignificance: problem.clinicalSignificance
            },
            requiresImmediate: problem.severity === 'critical'
        };

        await mtrNotificationService.sendCriticalAlert(alert);

        return sendSuccess(res, null, 'High severity DTP notification sent successfully');
    } catch (error) {
        logger.error('Error sending high severity DTP notification:', error);
        return sendError(res, 'SERVER_ERROR', 'Failed to send high severity DTP notification', 500);
    }
};