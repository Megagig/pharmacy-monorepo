import mongoose from 'mongoose';
import { sendEmail } from '../utils/email';
import { sendSMS } from '../utils/sms';
import { emailService } from '../utils/emailService';
import logger from '../utils/logger';
import MTRFollowUp, { IMTRFollowUp } from '../models/MTRFollowUp';
import MedicationTherapyReview, { IMedicationTherapyReview } from '../models/MedicationTherapyReview';
import DrugTherapyProblem, { IDrugTherapyProblem } from '../models/DrugTherapyProblem';
import User from '../models/User';
import Patient from '../models/Patient';

export interface NotificationPreferences {
    email: boolean;
    sms: boolean;
    push: boolean;
    followUpReminders: boolean;
    criticalAlerts: boolean;
    dailyDigest: boolean;
    weeklyReport: boolean;
}

export interface ScheduledNotification {
    id?: string;
    type: 'follow_up_reminder' | 'critical_alert' | 'daily_digest' | 'weekly_report' | 'overdue_alert';
    recipientId: mongoose.Types.ObjectId;
    recipientType: 'pharmacist' | 'patient' | 'admin';
    scheduledFor: Date;
    priority: 'high' | 'medium' | 'low';
    channels: ('email' | 'sms' | 'push')[];
    data: any;
    sent: boolean;
    sentAt?: Date;
    attempts: number;
    maxAttempts: number;
    error?: string;
}

export interface CriticalAlert {
    type: 'drug_interaction' | 'contraindication' | 'high_severity_dtp' | 'overdue_follow_up';
    severity: 'critical' | 'major' | 'moderate';
    patientId: mongoose.Types.ObjectId;
    reviewId?: mongoose.Types.ObjectId;
    problemId?: mongoose.Types.ObjectId;
    message: string;
    details: any;
    requiresImmediate: boolean;
}

class MTRNotificationService {
    private scheduledNotifications: Map<string, ScheduledNotification> = new Map();

    /**
     * Schedule a follow-up reminder notification
     */
    async scheduleFollowUpReminder(
        followUpId: mongoose.Types.ObjectId,
        reminderType: 'email' | 'sms' | 'push' = 'email',
        scheduledFor?: Date
    ): Promise<void> {
        try {
            const followUp = await MTRFollowUp.findById(followUpId)
                .populate('assignedTo', 'firstName lastName email phone notificationPreferences')
                .populate('patientId', 'firstName lastName contactInfo')
                .populate('reviewId', 'reviewNumber priority');

            if (!followUp) {
                throw new Error('Follow-up not found');
            }

            const assignedUser = followUp.assignedTo as any;
            const patient = followUp.patientId as any;
            const review = followUp.reviewId as any;

            // Default to 2 hours before scheduled time if not specified
            const reminderTime = scheduledFor || new Date(followUp.scheduledDate.getTime() - 2 * 60 * 60 * 1000);

            // Check user preferences
            const preferences = assignedUser.notificationPreferences || {};
            if (!preferences.followUpReminders) {
                logger.info(`Follow-up reminders disabled for user ${assignedUser._id}`);
                return;
            }

            const notificationData = {
                followUpId: followUp._id,
                patientName: `${patient.firstName} ${patient.lastName}`,
                followUpType: followUp.type,
                scheduledDate: followUp.scheduledDate,
                description: followUp.description,
                reviewNumber: review.reviewNumber,
                priority: followUp.priority,
                estimatedDuration: followUp.estimatedDuration
            };

            // Schedule email reminder
            if (reminderType === 'email' && preferences.email !== false) {
                await this.scheduleNotification({
                    type: 'follow_up_reminder',
                    recipientId: assignedUser._id,
                    recipientType: 'pharmacist',
                    scheduledFor: reminderTime,
                    priority: followUp.priority === 'high' ? 'high' : 'medium',
                    channels: ['email'],
                    data: notificationData,
                    sent: false,
                    attempts: 0,
                    maxAttempts: 3
                });
            }

            // Schedule SMS reminder for high priority follow-ups
            if ((reminderType === 'sms' || followUp.priority === 'high') &&
                preferences.sms !== false &&
                assignedUser.phone) {
                await this.scheduleNotification({
                    type: 'follow_up_reminder',
                    recipientId: assignedUser._id,
                    recipientType: 'pharmacist',
                    scheduledFor: reminderTime,
                    priority: 'high',
                    channels: ['sms'],
                    data: notificationData,
                    sent: false,
                    attempts: 0,
                    maxAttempts: 2
                });
            }

            // Update follow-up with reminder info
            followUp.reminders.push({
                type: reminderType,
                scheduledFor: reminderTime,
                sent: false,
                recipientId: assignedUser._id,
                message: `Reminder: ${followUp.type} scheduled for ${followUp.scheduledDate.toLocaleString()}`
            });

            await followUp.save();

            logger.info(`Follow-up reminder scheduled for ${assignedUser.email} at ${reminderTime}`);

        } catch (error) {
            logger.error('Error scheduling follow-up reminder:', error);
            throw error;
        }
    }

    /**
     * Send critical drug interaction alert
     */
    async sendCriticalAlert(alert: CriticalAlert): Promise<void> {
        try {
            // Find all pharmacists in the workplace who should receive critical alerts
            const patient = await Patient.findById(alert.patientId).populate('workplaceId');
            if (!patient) {
                throw new Error('Patient not found');
            }

            const pharmacists = await User.find({
                workplaceId: patient.workplaceId,
                role: 'pharmacist',
                status: 'active',
                'notificationPreferences.criticalAlerts': { $ne: false }
            });

            const alertData = {
                alertType: alert.type,
                severity: alert.severity,
                patientName: `${patient.firstName} ${patient.lastName}`,
                patientMRN: patient.mrn,
                message: alert.message,
                details: alert.details,
                timestamp: new Date(),
                requiresImmediate: alert.requiresImmediate
            };

            // Send to all relevant pharmacists
            for (const pharmacist of pharmacists) {
                const channels: ('email' | 'sms')[] = [];

                // Always send email for critical alerts
                if (pharmacist.email) {
                    channels.push('email');
                }

                // Send SMS for critical/major severity or immediate attention required
                if ((alert.severity === 'critical' || alert.requiresImmediate) &&
                    pharmacist.phone &&
                    pharmacist.notificationPreferences?.sms !== false) {
                    channels.push('sms');
                }

                if (channels.length > 0) {
                    await this.scheduleNotification({
                        type: 'critical_alert',
                        recipientId: pharmacist._id,
                        recipientType: 'pharmacist',
                        scheduledFor: new Date(), // Send immediately
                        priority: alert.severity === 'critical' ? 'high' : 'medium',
                        channels,
                        data: alertData,
                        sent: false,
                        attempts: 0,
                        maxAttempts: alert.requiresImmediate ? 5 : 3
                    });
                }
            }

            logger.info(`Critical alert sent for patient ${patient.mrn}: ${alert.message}`);

        } catch (error) {
            logger.error('Error sending critical alert:', error);
            throw error;
        }
    }

    /**
     * Check for and send overdue follow-up alerts
     */
    async checkOverdueFollowUps(): Promise<void> {
        try {
            const overdueFollowUps = await MTRFollowUp.find({
                status: { $in: ['scheduled', 'in_progress'] },
                scheduledDate: { $lt: new Date() }
            })
                .populate('assignedTo', 'firstName lastName email phone notificationPreferences')
                .populate('patientId', 'firstName lastName mrn')
                .populate('reviewId', 'reviewNumber priority');

            for (const followUp of overdueFollowUps) {
                const assignedUser = followUp.assignedTo as any;
                const patient = followUp.patientId as any;
                const review = followUp.reviewId as any;

                // Check if we've already sent an overdue alert recently (within 24 hours)
                const recentAlert = followUp.reminders.find(r =>
                    r.type === 'system' &&
                    r.message?.includes('overdue') &&
                    r.scheduledFor > new Date(Date.now() - 24 * 60 * 60 * 1000)
                );

                if (recentAlert) {
                    continue; // Skip if already alerted recently
                }

                const daysOverdue = Math.floor(
                    (Date.now() - followUp.scheduledDate.getTime()) / (1000 * 60 * 60 * 24)
                );

                const alertData = {
                    followUpId: followUp._id,
                    patientName: `${patient.firstName} ${patient.lastName}`,
                    patientMRN: patient.mrn,
                    followUpType: followUp.type,
                    scheduledDate: followUp.scheduledDate,
                    daysOverdue,
                    reviewNumber: review.reviewNumber,
                    priority: followUp.priority
                };

                // Send overdue alert
                await this.scheduleNotification({
                    type: 'overdue_alert',
                    recipientId: assignedUser._id,
                    recipientType: 'pharmacist',
                    scheduledFor: new Date(),
                    priority: daysOverdue > 7 ? 'high' : 'medium',
                    channels: ['email'],
                    data: alertData,
                    sent: false,
                    attempts: 0,
                    maxAttempts: 3
                });

                // Add reminder to follow-up record
                followUp.reminders.push({
                    type: 'system',
                    scheduledFor: new Date(),
                    sent: false,
                    message: `Follow-up overdue by ${daysOverdue} days`
                });

                await followUp.save();
            }

            logger.info(`Checked ${overdueFollowUps.length} overdue follow-ups`);

        } catch (error) {
            logger.error('Error checking overdue follow-ups:', error);
            throw error;
        }
    }

    /**
     * Schedule a notification
     */
    private async scheduleNotification(notification: Omit<ScheduledNotification, 'id'>): Promise<string> {
        const id = new mongoose.Types.ObjectId().toString();
        const scheduledNotification: ScheduledNotification = {
            ...notification,
            id
        };

        this.scheduledNotifications.set(id, scheduledNotification);

        // If scheduled for now or past, send immediately
        if (notification.scheduledFor <= new Date()) {
            await this.sendNotification(id);
        } else {
            // Schedule for later (in a real implementation, you'd use a job queue like Bull or Agenda)
            setTimeout(() => {
                this.sendNotification(id);
            }, notification.scheduledFor.getTime() - Date.now());
        }

        return id;
    }

    /**
     * Send a scheduled notification
     */
    private async sendNotification(notificationId: string): Promise<void> {
        const notification = this.scheduledNotifications.get(notificationId);
        if (!notification || notification.sent) {
            return;
        }

        try {
            notification.attempts++;

            const recipient = await User.findById(notification.recipientId);
            if (!recipient) {
                throw new Error('Recipient not found');
            }

            // Send via each channel
            for (const channel of notification.channels) {
                switch (channel) {
                    case 'email':
                        await this.sendEmailNotification(notification, recipient);
                        break;
                    case 'sms':
                        await this.sendSMSNotification(notification, recipient);
                        break;
                    case 'push':
                        // Placeholder for push notifications
                        logger.info(`Push notification would be sent to ${recipient.email}`);
                        break;
                }
            }

            // Mark as sent
            notification.sent = true;
            notification.sentAt = new Date();
            this.scheduledNotifications.set(notificationId, notification);

            logger.info(`Notification ${notificationId} sent successfully to ${recipient.email}`);

        } catch (error) {
            notification.error = (error as Error).message;
            this.scheduledNotifications.set(notificationId, notification);

            logger.error(`Error sending notification ${notificationId}:`, error);

            // Retry if under max attempts
            if (notification.attempts < notification.maxAttempts) {
                const retryDelay = Math.pow(2, notification.attempts) * 60000; // Exponential backoff
                setTimeout(() => {
                    this.sendNotification(notificationId);
                }, retryDelay);
            }
        }
    }

    /**
     * Send email notification
     */
    private async sendEmailNotification(notification: ScheduledNotification, recipient: any): Promise<void> {
        let subject: string;
        let html: string;
        let text: string;

        switch (notification.type) {
            case 'follow_up_reminder':
                subject = `MTR Follow-up Reminder - ${notification.data.patientName}`;
                html = this.generateFollowUpReminderEmail(notification.data);
                text = `Reminder: You have a ${notification.data.followUpType} scheduled for ${notification.data.patientName} on ${notification.data.scheduledDate}`;
                break;

            case 'critical_alert':
                subject = `🚨 Critical MTR Alert - ${notification.data.patientName}`;
                html = this.generateCriticalAlertEmail(notification.data);
                text = `CRITICAL ALERT: ${notification.data.message} for patient ${notification.data.patientName}`;
                break;

            case 'overdue_alert':
                subject = `⚠️ Overdue MTR Follow-up - ${notification.data.patientName}`;
                html = this.generateOverdueAlertEmail(notification.data);
                text = `OVERDUE: Follow-up for ${notification.data.patientName} is ${notification.data.daysOverdue} days overdue`;
                break;

            default:
                throw new Error(`Unknown notification type: ${notification.type}`);
        }

        await sendEmail({
            to: recipient.email,
            subject,
            html,
            text
        });
    }

    /**
     * Send SMS notification
     */
    private async sendSMSNotification(notification: ScheduledNotification, recipient: any): Promise<void> {
        if (!recipient.phone) {
            throw new Error('Recipient phone number not available');
        }

        let message: string;

        switch (notification.type) {
            case 'follow_up_reminder':
                message = `MTR Reminder: ${notification.data.followUpType} for ${notification.data.patientName} scheduled at ${notification.data.scheduledDate.toLocaleTimeString()}`;
                break;

            case 'critical_alert':
                message = `🚨 CRITICAL MTR ALERT: ${notification.data.message} - Patient: ${notification.data.patientName}`;
                break;

            case 'overdue_alert':
                message = `⚠️ OVERDUE: MTR follow-up for ${notification.data.patientName} is ${notification.data.daysOverdue} days overdue`;
                break;

            default:
                throw new Error(`Unknown notification type: ${notification.type}`);
        }

        await sendSMS(recipient.phone, message);
    }

    /**
     * Generate follow-up reminder email HTML
     */
    private generateFollowUpReminderEmail(data: any): string {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">MTR Follow-up Reminder</h2>
                
                <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #1e40af;">Patient Information</h3>
                    <p><strong>Patient:</strong> ${data.patientName}</p>
                    <p><strong>Review:</strong> ${data.reviewNumber}</p>
                    <p><strong>Follow-up Type:</strong> ${data.followUpType.replace('_', ' ').toUpperCase()}</p>
                </div>

                <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #92400e;">Scheduled Details</h3>
                    <p><strong>Date & Time:</strong> ${data.scheduledDate.toLocaleString()}</p>
                    <p><strong>Estimated Duration:</strong> ${data.estimatedDuration} minutes</p>
                    <p><strong>Priority:</strong> ${data.priority.toUpperCase()}</p>
                </div>

                <div style="margin: 20px 0;">
                    <h3 style="color: #1e40af;">Description</h3>
                    <p>${data.description}</p>
                </div>

                <div style="background-color: #e0f2fe; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0; font-size: 14px; color: #0277bd;">
                        Please ensure you're prepared for this follow-up session. Review the patient's MTR history and any previous interventions before the appointment.
                    </p>
                </div>

                <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
                <p style="font-size: 12px; color: #6b7280;">
                    This is an automated reminder from the PharmacyCopilot MTR system. 
                    To update your notification preferences, please log in to your account.
                </p>
            </div>
        `;
    }

    /**
     * Generate critical alert email HTML
     */
    private generateCriticalAlertEmail(data: any): string {
        const severityColors: Record<string, string> = {
            critical: '#dc2626',
            major: '#ea580c',
            moderate: '#d97706'
        };
        const severityColor = severityColors[data.severity] || '#6b7280';

        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background-color: #fef2f2; border-left: 4px solid ${severityColor}; padding: 20px; margin-bottom: 20px;">
                    <h2 style="color: ${severityColor}; margin-top: 0;">🚨 Critical MTR Alert</h2>
                    <p style="font-size: 16px; font-weight: bold; margin: 0;">
                        ${data.severity.toUpperCase()} SEVERITY - Immediate attention ${data.requiresImmediate ? 'REQUIRED' : 'recommended'}
                    </p>
                </div>

                <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #1e40af;">Patient Information</h3>
                    <p><strong>Patient:</strong> ${data.patientName}</p>
                    <p><strong>MRN:</strong> ${data.patientMRN}</p>
                    <p><strong>Alert Type:</strong> ${data.alertType.replace('_', ' ').toUpperCase()}</p>
                </div>

                <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #92400e;">Alert Details</h3>
                    <p><strong>Message:</strong> ${data.message}</p>
                    <p><strong>Timestamp:</strong> ${data.timestamp.toLocaleString()}</p>
                    ${data.details ? `<p><strong>Additional Details:</strong> ${JSON.stringify(data.details, null, 2)}</p>` : ''}
                </div>

                ${data.requiresImmediate ? `
                    <div style="background-color: #fef2f2; border: 2px solid #dc2626; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 0; font-weight: bold; color: #dc2626;">
                            ⚠️ IMMEDIATE ACTION REQUIRED - Please review this patient's case immediately and take appropriate action.
                        </p>
                    </div>
                ` : ''}

                <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
                <p style="font-size: 12px; color: #6b7280;">
                    This is an automated alert from the PharmacyCopilot MTR system. 
                    Please log in to your account to review the full details and take appropriate action.
                </p>
            </div>
        `;
    }

    /**
     * Generate overdue alert email HTML
     */
    private generateOverdueAlertEmail(data: any): string {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background-color: #fef3c7; border-left: 4px solid #d97706; padding: 20px; margin-bottom: 20px;">
                    <h2 style="color: #92400e; margin-top: 0;">⚠️ Overdue MTR Follow-up</h2>
                    <p style="font-size: 16px; font-weight: bold; margin: 0;">
                        Follow-up is ${data.daysOverdue} days overdue
                    </p>
                </div>

                <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #1e40af;">Patient Information</h3>
                    <p><strong>Patient:</strong> ${data.patientName}</p>
                    <p><strong>MRN:</strong> ${data.patientMRN}</p>
                    <p><strong>Review:</strong> ${data.reviewNumber}</p>
                </div>

                <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #92400e;">Follow-up Details</h3>
                    <p><strong>Type:</strong> ${data.followUpType.replace('_', ' ').toUpperCase()}</p>
                    <p><strong>Originally Scheduled:</strong> ${data.scheduledDate.toLocaleString()}</p>
                    <p><strong>Priority:</strong> ${data.priority.toUpperCase()}</p>
                    <p><strong>Days Overdue:</strong> ${data.daysOverdue}</p>
                </div>

                <div style="background-color: #e0f2fe; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0; font-size: 14px; color: #0277bd;">
                        Please reschedule or complete this follow-up as soon as possible to ensure continuity of care for this patient.
                    </p>
                </div>

                <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
                <p style="font-size: 12px; color: #6b7280;">
                    This is an automated reminder from the PharmacyCopilot MTR system. 
                    Please log in to your account to update the follow-up status.
                </p>
            </div>
        `;
    }

    /**
     * Update user notification preferences
     */
    async updateNotificationPreferences(
        userId: mongoose.Types.ObjectId,
        preferences: Partial<NotificationPreferences>
    ): Promise<void> {
        try {
            await User.findByIdAndUpdate(
                userId,
                { $set: { notificationPreferences: preferences } },
                { new: true }
            );

            logger.info(`Updated notification preferences for user ${userId}`);
        } catch (error) {
            logger.error('Error updating notification preferences:', error);
            throw error;
        }
    }

    /**
     * Get notification statistics
     */
    async getNotificationStatistics(workplaceId?: mongoose.Types.ObjectId): Promise<any> {
        try {
            const stats = {
                totalScheduled: this.scheduledNotifications.size,
                sent: Array.from(this.scheduledNotifications.values()).filter(n => n.sent).length,
                pending: Array.from(this.scheduledNotifications.values()).filter(n => !n.sent).length,
                failed: Array.from(this.scheduledNotifications.values()).filter(n => n.error).length,
                byType: {} as Record<string, number>,
                byChannel: {} as Record<string, number>
            };

            // Count by type and channel
            Array.from(this.scheduledNotifications.values()).forEach(notification => {
                stats.byType[notification.type] = (stats.byType[notification.type] || 0) + 1;
                notification.channels.forEach(channel => {
                    stats.byChannel[channel] = (stats.byChannel[channel] || 0) + 1;
                });
            });

            return stats;
        } catch (error) {
            logger.error('Error getting notification statistics:', error);
            throw error;
        }
    }

    /**
     * Process pending reminders (should be called periodically)
     */
    async processPendingReminders(): Promise<void> {
        try {
            const pendingFollowUps = await MTRFollowUp.find({
                'reminders.sent': false,
                'reminders.scheduledFor': { $lte: new Date() },
                status: { $in: ['scheduled', 'in_progress'] }
            }).populate('assignedTo', 'firstName lastName email phone notificationPreferences');

            for (const followUp of pendingFollowUps) {
                for (const reminder of followUp.reminders) {
                    if (!reminder.sent && reminder.scheduledFor <= new Date()) {
                        try {
                            await this.scheduleFollowUpReminder(
                                followUp._id,
                                reminder.type as any,
                                new Date() // Send now
                            );

                            // Mark reminder as sent
                            reminder.sent = true;
                            reminder.sentAt = new Date();
                        } catch (error) {
                            logger.error(`Error processing reminder for follow-up ${followUp._id}:`, error);
                        }
                    }
                }

                await followUp.save();
            }

            logger.info(`Processed ${pendingFollowUps.length} pending follow-up reminders`);
        } catch (error) {
            logger.error('Error processing pending reminders:', error);
            throw error;
        }
    }
}

export const mtrNotificationService = new MTRNotificationService();
export default mtrNotificationService;