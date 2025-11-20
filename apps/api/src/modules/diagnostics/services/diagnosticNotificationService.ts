import mongoose from 'mongoose';
import logger from '../../../utils/logger';
import { sendEmail } from '../../../utils/email';
import { sendSMS } from '../../../utils/sms';
import DiagnosticFollowUp, { IDiagnosticFollowUp } from '../models/DiagnosticFollowUp';
import AdherenceTracking, { IAdherenceTracking, IAdherenceAlert } from '../models/AdherenceTracking';
import User from '../../../models/User';
import Patient from '../../../models/Patient';

export interface NotificationSchedule {
    id: string;
    type: 'follow_up_reminder' | 'adherence_alert' | 'missed_refill' | 'overdue_follow_up' | 'critical_adherence';
    recipientId: mongoose.Types.ObjectId;
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

export interface DiagnosticAlert {
    type: 'follow_up_overdue' | 'adherence_critical' | 'medication_gap' | 'missed_appointment';
    severity: 'critical' | 'high' | 'medium' | 'low';
    patientId: mongoose.Types.ObjectId;
    followUpId?: mongoose.Types.ObjectId;
    adherenceTrackingId?: mongoose.Types.ObjectId;
    message: string;
    details: any;
    requiresImmediate: boolean;
}

class DiagnosticNotificationService {
    private scheduledNotifications: Map<string, NotificationSchedule> = new Map();

    /**
     * Schedule follow-up reminder
     */
    async scheduleFollowUpReminder(
        followUpId: mongoose.Types.ObjectId,
        reminderType: 'email' | 'sms' | 'push' = 'email',
        scheduledFor?: Date
    ): Promise<void> {
        try {
            const followUp = await DiagnosticFollowUp.findById(followUpId)
                .populate('assignedTo', 'firstName lastName email phone notificationPreferences')
                .populate('patientId', 'firstName lastName mrn')
                .populate('diagnosticResultId', 'diagnoses riskAssessment');

            if (!followUp) {
                throw new Error('Follow-up not found');
            }

            const assignedUser = followUp.assignedTo as any;
            const patient = followUp.patientId as any;
            const diagnosticResult = followUp.diagnosticResultId as any;

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
                patientMRN: patient.mrn,
                followUpType: followUp.type,
                scheduledDate: followUp.scheduledDate,
                description: followUp.description,
                objectives: followUp.objectives,
                priority: followUp.priority,
                estimatedDuration: followUp.estimatedDuration,
                riskLevel: diagnosticResult?.riskAssessment?.overallRisk,
                diagnoses: diagnosticResult?.diagnoses?.map((d: any) => d.condition) || []
            };

            // Determine channels based on priority and preferences
            const channels: ('email' | 'sms')[] = [];

            if (preferences.email !== false) {
                channels.push('email');
            }

            if ((followUp.priority === 'high' || diagnosticResult?.riskAssessment?.overallRisk === 'critical') &&
                preferences.sms !== false && assignedUser.phone) {
                channels.push('sms');
            }

            if (channels.length > 0) {
                await this.scheduleNotification({
                    type: 'follow_up_reminder',
                    recipientId: assignedUser._id,
                    scheduledFor: reminderTime,
                    priority: followUp.priority === 'high' ? 'high' : 'medium',
                    channels,
                    data: notificationData,
                    sent: false,
                    attempts: 0,
                    maxAttempts: 3
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
     * Schedule adherence alert
     */
    async scheduleAdherenceAlert(
        adherenceTrackingId: mongoose.Types.ObjectId,
        alert: IAdherenceAlert
    ): Promise<void> {
        try {
            const tracking = await AdherenceTracking.findById(adherenceTrackingId)
                .populate('patientId', 'firstName lastName mrn workplaceId');

            if (!tracking) {
                throw new Error('Adherence tracking not found');
            }

            const patient = tracking.patientId as any;

            // Find pharmacists in the workplace who should receive adherence alerts
            const pharmacists = await User.find({
                workplaceId: patient.workplaceId,
                role: 'pharmacist',
                status: 'active',
                'notificationPreferences.adherenceAlerts': { $ne: false }
            });

            const alertData = {
                alertType: alert.type,
                severity: alert.severity,
                patientName: `${patient.firstName} ${patient.lastName}`,
                patientMRN: patient.mrn,
                message: alert.message,
                timestamp: alert.triggeredAt,
                adherenceScore: tracking.overallAdherenceScore,
                medicationsAtRisk: tracking.medicationsAtRisk.length,
                activeAlerts: tracking.activeAlerts.length
            };

            // Send to all relevant pharmacists
            for (const pharmacist of pharmacists) {
                const channels: ('email' | 'sms')[] = [];

                // Always send email for adherence alerts
                if (pharmacist.email) {
                    channels.push('email');
                }

                // Send SMS for critical/high severity alerts
                if ((alert.severity === 'critical' || alert.severity === 'high') &&
                    pharmacist.phone &&
                    pharmacist.notificationPreferences?.sms !== false) {
                    channels.push('sms');
                }

                if (channels.length > 0) {
                    await this.scheduleNotification({
                        type: 'adherence_alert',
                        recipientId: pharmacist._id,
                        scheduledFor: new Date(), // Send immediately
                        priority: alert.severity === 'critical' ? 'high' : 'medium',
                        channels,
                        data: alertData,
                        sent: false,
                        attempts: 0,
                        maxAttempts: alert.severity === 'critical' ? 5 : 3
                    });
                }
            }

            logger.info(`Adherence alert sent for patient ${patient.mrn}: ${alert.message}`);

        } catch (error) {
            logger.error('Error scheduling adherence alert:', error);
            throw error;
        }
    }

    /**
     * Send missed refill reminder
     */
    async sendMissedRefillReminder(
        adherenceTrackingId: mongoose.Types.ObjectId,
        medicationName: string,
        daysOverdue: number
    ): Promise<void> {
        try {
            const tracking = await AdherenceTracking.findById(adherenceTrackingId)
                .populate('patientId', 'firstName lastName mrn contactInfo workplaceId');

            if (!tracking) {
                throw new Error('Adherence tracking not found');
            }

            const patient = tracking.patientId as any;

            // Find the medication
            const medication = tracking.medications.find(med => med.medicationName === medicationName);
            if (!medication) {
                throw new Error('Medication not found in tracking');
            }

            // Find pharmacists to notify
            const pharmacists = await User.find({
                workplaceId: patient.workplaceId,
                role: 'pharmacist',
                status: 'active',
                'notificationPreferences.refillReminders': { $ne: false }
            });

            const reminderData = {
                patientName: `${patient.firstName} ${patient.lastName}`,
                patientMRN: patient.mrn,
                medicationName,
                daysOverdue,
                expectedRefillDate: medication.expectedRefillDate,
                lastRefillDate: medication.lastRefillDate,
                adherenceScore: medication.adherenceScore,
                patientContact: patient.contactInfo
            };

            // Send to pharmacists
            for (const pharmacist of pharmacists) {
                await this.scheduleNotification({
                    type: 'missed_refill',
                    recipientId: pharmacist._id,
                    scheduledFor: new Date(),
                    priority: daysOverdue > 7 ? 'high' : 'medium',
                    channels: ['email'],
                    data: reminderData,
                    sent: false,
                    attempts: 0,
                    maxAttempts: 3
                });
            }

            logger.info(`Missed refill reminder sent for patient ${patient.mrn}: ${medicationName}`);

        } catch (error) {
            logger.error('Error sending missed refill reminder:', error);
            throw error;
        }
    }

    /**
     * Check for overdue follow-ups
     */
    async checkOverdueFollowUps(): Promise<void> {
        try {
            const overdueFollowUps = await DiagnosticFollowUp.find({
                status: { $in: ['scheduled', 'in_progress'] },
                scheduledDate: { $lt: new Date() }
            })
                .populate('assignedTo', 'firstName lastName email phone notificationPreferences')
                .populate('patientId', 'firstName lastName mrn')
                .populate('diagnosticResultId', 'riskAssessment');

            for (const followUp of overdueFollowUps) {
                const assignedUser = followUp.assignedTo as any;
                const patient = followUp.patientId as any;
                const diagnosticResult = followUp.diagnosticResultId as any;

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
                    priority: followUp.priority,
                    riskLevel: diagnosticResult?.riskAssessment?.overallRisk,
                    objectives: followUp.objectives
                };

                // Send overdue alert
                await this.scheduleNotification({
                    type: 'overdue_follow_up',
                    recipientId: assignedUser._id,
                    scheduledFor: new Date(),
                    priority: daysOverdue > 7 || diagnosticResult?.riskAssessment?.overallRisk === 'critical' ? 'high' : 'medium',
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
     * Check for adherence issues
     */
    async checkAdherenceIssues(): Promise<void> {
        try {
            const trackingRecords = await AdherenceTracking.find({
                monitoringActive: true,
                'alerts.acknowledged': false
            }).populate('patientId', 'firstName lastName mrn');

            for (const tracking of trackingRecords) {
                const unacknowledgedAlerts = tracking.alerts.filter(alert =>
                    !alert.acknowledged && !alert.resolved
                );

                for (const alert of unacknowledgedAlerts) {
                    // Check if alert is older than escalation threshold
                    const alertAge = Math.floor(
                        (Date.now() - alert.triggeredAt.getTime()) / (1000 * 60 * 60 * 24)
                    );

                    if (alertAge >= tracking.alertPreferences.escalationThreshold) {
                        await this.scheduleAdherenceAlert(tracking._id, alert);
                    }
                }

                // Check for missed refills
                for (const medication of tracking.medications) {
                    if (medication.expectedRefillDate && medication.expectedRefillDate < new Date()) {
                        const daysOverdue = Math.floor(
                            (Date.now() - medication.expectedRefillDate.getTime()) / (1000 * 60 * 60 * 24)
                        );

                        if (daysOverdue >= tracking.alertPreferences.reminderDaysBefore) {
                            await this.sendMissedRefillReminder(
                                tracking._id,
                                medication.medicationName,
                                daysOverdue
                            );
                        }
                    }
                }
            }

            logger.info(`Checked adherence issues for ${trackingRecords.length} patients`);

        } catch (error) {
            logger.error('Error checking adherence issues:', error);
            throw error;
        }
    }

    /**
     * Schedule a notification
     */
    private async scheduleNotification(notification: Omit<NotificationSchedule, 'id'>): Promise<string> {
        const id = new mongoose.Types.ObjectId().toString();
        const scheduledNotification: NotificationSchedule = {
            ...notification,
            id
        };

        this.scheduledNotifications.set(id, scheduledNotification);

        // If scheduled for now or past, send immediately
        if (notification.scheduledFor <= new Date()) {
            await this.sendNotification(id);
        } else {
            // Schedule for later
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
    private async sendEmailNotification(notification: NotificationSchedule, recipient: any): Promise<void> {
        let subject: string;
        let html: string;
        let text: string;

        switch (notification.type) {
            case 'follow_up_reminder':
                subject = `Diagnostic Follow-up Reminder - ${notification.data.patientName}`;
                html = this.generateFollowUpReminderEmail(notification.data);
                text = `Reminder: You have a ${notification.data.followUpType} scheduled for ${notification.data.patientName} on ${notification.data.scheduledDate}`;
                break;

            case 'adherence_alert':
                subject = `🚨 Medication Adherence Alert - ${notification.data.patientName}`;
                html = this.generateAdherenceAlertEmail(notification.data);
                text = `ADHERENCE ALERT: ${notification.data.message} for patient ${notification.data.patientName}`;
                break;

            case 'missed_refill':
                subject = `⚠️ Missed Refill Alert - ${notification.data.patientName}`;
                html = this.generateMissedRefillEmail(notification.data);
                text = `MISSED REFILL: ${notification.data.medicationName} for ${notification.data.patientName} is ${notification.data.daysOverdue} days overdue`;
                break;

            case 'overdue_follow_up':
                subject = `⚠️ Overdue Follow-up - ${notification.data.patientName}`;
                html = this.generateOverdueFollowUpEmail(notification.data);
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
    private async sendSMSNotification(notification: NotificationSchedule, recipient: any): Promise<void> {
        if (!recipient.phone) {
            throw new Error('Recipient phone number not available');
        }

        let message: string;

        switch (notification.type) {
            case 'follow_up_reminder':
                message = `Diagnostic Follow-up: ${notification.data.followUpType} for ${notification.data.patientName} scheduled at ${notification.data.scheduledDate.toLocaleTimeString()}`;
                break;

            case 'adherence_alert':
                message = `🚨 ADHERENCE ALERT: ${notification.data.message} - Patient: ${notification.data.patientName}`;
                break;

            case 'missed_refill':
                message = `⚠️ MISSED REFILL: ${notification.data.medicationName} for ${notification.data.patientName} is ${notification.data.daysOverdue} days overdue`;
                break;

            case 'overdue_follow_up':
                message = `⚠️ OVERDUE: Follow-up for ${notification.data.patientName} is ${notification.data.daysOverdue} days overdue`;
                break;

            default:
                throw new Error(`Unknown notification type: ${notification.type}`);
        }

        await sendSMS(recipient.phone, message);
    }

    /**
     * Email template generators
     */
    private generateFollowUpReminderEmail(data: any): string {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">Diagnostic Follow-up Reminder</h2>
                
                <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #1e40af;">Patient Information</h3>
                    <p><strong>Patient:</strong> ${data.patientName}</p>
                    <p><strong>MRN:</strong> ${data.patientMRN}</p>
                    <p><strong>Follow-up Type:</strong> ${data.followUpType.replace('_', ' ').toUpperCase()}</p>
                    ${data.riskLevel ? `<p><strong>Risk Level:</strong> <span style="color: ${this.getRiskColor(data.riskLevel)};">${data.riskLevel.toUpperCase()}</span></p>` : ''}
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
                    
                    ${data.objectives && data.objectives.length > 0 ? `
                        <h4>Objectives:</h4>
                        <ul>
                            ${data.objectives.map((obj: string) => `<li>${obj}</li>`).join('')}
                        </ul>
                    ` : ''}
                </div>

                ${data.diagnoses && data.diagnoses.length > 0 ? `
                    <div style="background-color: #e0f2fe; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <h4 style="margin-top: 0; color: #0277bd;">Related Diagnoses</h4>
                        <ul>
                            ${data.diagnoses.map((diagnosis: string) => `<li>${diagnosis}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}

                <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
                <p style="font-size: 12px; color: #6b7280;">
                    This is an automated reminder from the PharmacyCopilot Diagnostic System.
                </p>
            </div>
        `;
    }

    private generateAdherenceAlertEmail(data: any): string {
        const severityColor = this.getSeverityColor(data.severity);

        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background-color: #fef2f2; border-left: 4px solid ${severityColor}; padding: 20px; margin-bottom: 20px;">
                    <h2 style="color: ${severityColor}; margin-top: 0;">🚨 Medication Adherence Alert</h2>
                    <p style="font-size: 16px; font-weight: bold; margin: 0;">
                        ${data.severity.toUpperCase()} SEVERITY
                    </p>
                </div>

                <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #1e40af;">Patient Information</h3>
                    <p><strong>Patient:</strong> ${data.patientName}</p>
                    <p><strong>MRN:</strong> ${data.patientMRN}</p>
                    <p><strong>Overall Adherence Score:</strong> ${data.adherenceScore}%</p>
                </div>

                <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #92400e;">Alert Details</h3>
                    <p><strong>Alert Type:</strong> ${data.alertType.replace('_', ' ').toUpperCase()}</p>
                    <p><strong>Message:</strong> ${data.message}</p>
                    <p><strong>Timestamp:</strong> ${data.timestamp.toLocaleString()}</p>
                    <p><strong>Medications at Risk:</strong> ${data.medicationsAtRisk}</p>
                    <p><strong>Active Alerts:</strong> ${data.activeAlerts}</p>
                </div>

                <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
                <p style="font-size: 12px; color: #6b7280;">
                    This is an automated alert from the PharmacyCopilot Adherence Monitoring System.
                </p>
            </div>
        `;
    }

    private generateMissedRefillEmail(data: any): string {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background-color: #fef3c7; border-left: 4px solid #d97706; padding: 20px; margin-bottom: 20px;">
                    <h2 style="color: #92400e; margin-top: 0;">⚠️ Missed Refill Alert</h2>
                    <p style="font-size: 16px; font-weight: bold; margin: 0;">
                        Refill is ${data.daysOverdue} days overdue
                    </p>
                </div>

                <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #1e40af;">Patient Information</h3>
                    <p><strong>Patient:</strong> ${data.patientName}</p>
                    <p><strong>MRN:</strong> ${data.patientMRN}</p>
                    <p><strong>Medication:</strong> ${data.medicationName}</p>
                </div>

                <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #92400e;">Refill Details</h3>
                    <p><strong>Expected Refill Date:</strong> ${data.expectedRefillDate?.toLocaleDateString()}</p>
                    <p><strong>Last Refill Date:</strong> ${data.lastRefillDate?.toLocaleDateString()}</p>
                    <p><strong>Days Overdue:</strong> ${data.daysOverdue}</p>
                    <p><strong>Adherence Score:</strong> ${data.adherenceScore}%</p>
                </div>

                ${data.patientContact ? `
                    <div style="background-color: #e0f2fe; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <h4 style="margin-top: 0; color: #0277bd;">Patient Contact Information</h4>
                        <p><strong>Phone:</strong> ${data.patientContact.phone || 'Not available'}</p>
                        <p><strong>Email:</strong> ${data.patientContact.email || 'Not available'}</p>
                    </div>
                ` : ''}

                <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
                <p style="font-size: 12px; color: #6b7280;">
                    This is an automated alert from the PharmacyCopilot Adherence Monitoring System.
                </p>
            </div>
        `;
    }

    private generateOverdueFollowUpEmail(data: any): string {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background-color: #fef3c7; border-left: 4px solid #d97706; padding: 20px; margin-bottom: 20px;">
                    <h2 style="color: #92400e; margin-top: 0;">⚠️ Overdue Follow-up</h2>
                    <p style="font-size: 16px; font-weight: bold; margin: 0;">
                        Follow-up is ${data.daysOverdue} days overdue
                    </p>
                </div>

                <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #1e40af;">Patient Information</h3>
                    <p><strong>Patient:</strong> ${data.patientName}</p>
                    <p><strong>MRN:</strong> ${data.patientMRN}</p>
                    ${data.riskLevel ? `<p><strong>Risk Level:</strong> <span style="color: ${this.getRiskColor(data.riskLevel)};">${data.riskLevel.toUpperCase()}</span></p>` : ''}
                </div>

                <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #92400e;">Follow-up Details</h3>
                    <p><strong>Type:</strong> ${data.followUpType.replace('_', ' ').toUpperCase()}</p>
                    <p><strong>Originally Scheduled:</strong> ${data.scheduledDate.toLocaleString()}</p>
                    <p><strong>Priority:</strong> ${data.priority.toUpperCase()}</p>
                    <p><strong>Days Overdue:</strong> ${data.daysOverdue}</p>
                </div>

                ${data.objectives && data.objectives.length > 0 ? `
                    <div style="background-color: #e0f2fe; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <h4 style="margin-top: 0; color: #0277bd;">Follow-up Objectives</h4>
                        <ul>
                            ${data.objectives.map((obj: string) => `<li>${obj}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}

                <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
                <p style="font-size: 12px; color: #6b7280;">
                    This is an automated reminder from the PharmacyCopilot Diagnostic System.
                </p>
            </div>
        `;
    }

    private getRiskColor(riskLevel: string): string {
        const colors: Record<string, string> = {
            critical: '#dc2626',
            high: '#ea580c',
            medium: '#d97706',
            low: '#059669'
        };
        return colors[riskLevel] || '#6b7280';
    }

    private getSeverityColor(severity: string): string {
        const colors: Record<string, string> = {
            critical: '#dc2626',
            high: '#ea580c',
            medium: '#d97706',
            low: '#059669'
        };
        return colors[severity] || '#6b7280';
    }

    /**
     * Process pending notifications (should be called periodically)
     */
    async processPendingNotifications(): Promise<void> {
        try {
            // Check for overdue follow-ups
            await this.checkOverdueFollowUps();

            // Check for adherence issues
            await this.checkAdherenceIssues();

            // Process pending follow-up reminders
            const pendingFollowUps = await DiagnosticFollowUp.find({
                'reminders.sent': false,
                'reminders.scheduledFor': { $lte: new Date() },
                status: { $in: ['scheduled', 'in_progress'] }
            });

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

            logger.info(`Processed pending notifications`);

        } catch (error) {
            logger.error('Error processing pending notifications:', error);
            throw error;
        }
    }
}

export const diagnosticNotificationService = new DiagnosticNotificationService();
export default diagnosticNotificationService;