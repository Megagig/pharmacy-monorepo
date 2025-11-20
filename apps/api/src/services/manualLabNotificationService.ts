import mongoose from 'mongoose';
import { sendEmail } from '../utils/email';
import { sendSMS } from '../utils/sms';
import logger from '../utils/logger';
import User from '../models/User';
import Patient from '../models/Patient';

export interface ManualLabNotificationPreferences {
    email: boolean;
    sms: boolean;
    push: boolean;
    criticalAlerts: boolean;
    resultNotifications: boolean;
    orderReminders: boolean;
}

export interface ManualLabNotification {
    id?: string;
    type: 'critical_alert' | 'result_ready' | 'order_reminder' | 'ai_interpretation_complete';
    recipientId: mongoose.Types.ObjectId;
    recipientType: 'pharmacist' | 'patient' | 'admin';
    orderId: string;
    patientId: mongoose.Types.ObjectId;
    priority: 'high' | 'medium' | 'low';
    channels: ('email' | 'sms' | 'push')[];
    data: any;
    sent: boolean;
    sentAt?: Date;
    attempts: number;
    maxAttempts: number;
    error?: string;
    scheduledFor?: Date;
}

export interface CriticalLabAlert {
    type: 'critical_result' | 'red_flag_detected' | 'urgent_referral_needed' | 'drug_interaction';
    severity: 'critical' | 'major' | 'moderate';
    orderId: string;
    patientId: mongoose.Types.ObjectId;
    message: string;
    details: any;
    requiresImmediate: boolean;
    aiInterpretation?: any;
}

class ManualLabNotificationService {
    private notifications: Map<string, ManualLabNotification> = new Map();

    /**
     * Send critical alert for lab results
     */
    async sendCriticalLabAlert(alert: CriticalLabAlert): Promise<void> {
        try {
            // Find patient and their workplace
            const patient = await Patient.findById(alert.patientId).populate('workplaceId');
            if (!patient) {
                throw new Error('Patient not found');
            }

            // Find all pharmacists in the workplace who should receive critical alerts
            const pharmacists = await User.find({
                workplaceId: patient.workplaceId,
                role: { $in: ['pharmacist', 'owner'] },
                status: 'active',
                'notificationPreferences.email': { $ne: false }
            });

            const alertData = {
                alertType: alert.type,
                severity: alert.severity,
                orderId: alert.orderId,
                patientName: `${patient.firstName} ${patient.lastName}`,
                patientMRN: patient.mrn,
                message: alert.message,
                details: alert.details,
                timestamp: new Date(),
                requiresImmediate: alert.requiresImmediate,
                aiInterpretation: alert.aiInterpretation
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
                        orderId: alert.orderId,
                        patientId: alert.patientId,
                        priority: alert.severity === 'critical' ? 'high' : 'medium',
                        channels,
                        data: alertData,
                        sent: false,
                        attempts: 0,
                        maxAttempts: alert.requiresImmediate ? 5 : 3,
                        scheduledFor: new Date() // Send immediately
                    });
                }
            }

            logger.info(`Critical lab alert sent for order ${alert.orderId}: ${alert.message}`);

        } catch (error) {
            logger.error('Error sending critical lab alert:', error);
            throw error;
        }
    }

    /**
     * Send notification when AI interpretation is complete
     */
    async sendAIInterpretationComplete(
        orderId: string,
        patientId: mongoose.Types.ObjectId,
        pharmacistId: mongoose.Types.ObjectId,
        interpretation: any
    ): Promise<void> {
        try {
            const patient = await Patient.findById(patientId);
            const pharmacist = await User.findById(pharmacistId);

            if (!patient || !pharmacist) {
                throw new Error('Patient or pharmacist not found');
            }

            // Check if there are critical red flags
            const criticalFlags = interpretation.aiAnalysis?.redFlags?.filter(
                (flag: any) => flag.severity === 'critical'
            ) || [];

            const notificationData = {
                orderId,
                patientName: `${patient.firstName} ${patient.lastName}`,
                patientMRN: patient.mrn,
                confidenceScore: interpretation.aiAnalysis?.confidenceScore || 0,
                criticalFlags: criticalFlags.length,
                hasUrgentReferral: interpretation.aiAnalysis?.referralRecommendation?.urgency === 'immediate',
                timestamp: new Date()
            };

            // Determine channels based on criticality
            const channels: ('email' | 'sms')[] = ['email'];

            // Add SMS for critical results
            if ((criticalFlags.length > 0 || notificationData.hasUrgentReferral) &&
                pharmacist.phone &&
                pharmacist.notificationPreferences?.sms !== false) {
                channels.push('sms');
            }

            await this.scheduleNotification({
                type: 'ai_interpretation_complete',
                recipientId: pharmacistId,
                recipientType: 'pharmacist',
                orderId,
                patientId,
                priority: criticalFlags.length > 0 ? 'high' : 'medium',
                channels,
                data: notificationData,
                sent: false,
                attempts: 0,
                maxAttempts: 3,
                scheduledFor: new Date()
            });

            // If there are critical flags, also send a critical alert
            if (criticalFlags.length > 0) {
                await this.sendCriticalLabAlert({
                    type: 'red_flag_detected',
                    severity: 'critical',
                    orderId,
                    patientId,
                    message: `${criticalFlags.length} critical red flags detected in lab interpretation`,
                    details: { criticalFlags, interpretation },
                    requiresImmediate: true,
                    aiInterpretation: interpretation
                });
            }

            logger.info(`AI interpretation notification sent for order ${orderId}`);

        } catch (error) {
            logger.error('Error sending AI interpretation notification:', error);
            throw error;
        }
    }

    /**
     * Send notification to patient when results are ready
     */
    async sendPatientResultNotification(
        orderId: string,
        patientId: mongoose.Types.ObjectId,
        includeInterpretation: boolean = false
    ): Promise<void> {
        try {
            const patient = await Patient.findById(patientId);
            if (!patient) {
                throw new Error('Patient not found');
            }

            // Check patient's notification preferences
            const patientPreferences: ManualLabNotificationPreferences = {
                email: patient.notificationPreferences?.email ?? true,
                sms: patient.notificationPreferences?.sms ?? true,
                push: patient.notificationPreferences?.push ?? true,
                criticalAlerts: patient.notificationPreferences?.email ?? true,
                resultNotifications: patient.notificationPreferences?.resultNotifications ?? true,
                orderReminders: patient.notificationPreferences?.orderReminders ?? true,
            };
            if (!patientPreferences.resultNotifications) {
                logger.info(`Result notifications disabled for patient ${patientId}`);
                return;
            }

            const notificationData = {
                orderId,
                patientName: `${patient.firstName} ${patient.lastName}`,
                includeInterpretation,
                timestamp: new Date()
            };

            const channels: ('email' | 'sms')[] = [];

            // Add email if available and enabled
            if (patient.email && patientPreferences.email !== false) {
                channels.push('email');
            }

            // Add SMS if available and enabled
            if (patient.phone && patientPreferences.sms !== false) {
                channels.push('sms');
            }

            if (channels.length > 0) {
                await this.scheduleNotification({
                    type: 'result_ready',
                    recipientId: patientId,
                    recipientType: 'patient',
                    orderId,
                    patientId,
                    priority: 'medium',
                    channels,
                    data: notificationData,
                    sent: false,
                    attempts: 0,
                    maxAttempts: 3,
                    scheduledFor: new Date()
                });
            }

            logger.info(`Patient result notification sent for order ${orderId}`);

        } catch (error) {
            logger.error('Error sending patient result notification:', error);
            throw error;
        }
    }

    /**
     * Send reminder for pending lab orders
     */
    async sendOrderReminder(
        orderId: string,
        patientId: mongoose.Types.ObjectId,
        pharmacistId: mongoose.Types.ObjectId,
        daysOverdue: number
    ): Promise<void> {
        try {
            const patient = await Patient.findById(patientId);
            const pharmacist = await User.findById(pharmacistId);

            if (!patient || !pharmacist) {
                throw new Error('Patient or pharmacist not found');
            }

            const reminderData = {
                orderId,
                patientName: `${patient.firstName} ${patient.lastName}`,
                patientMRN: patient.mrn,
                daysOverdue,
                timestamp: new Date()
            };

            await this.scheduleNotification({
                type: 'order_reminder',
                recipientId: pharmacistId,
                recipientType: 'pharmacist',
                orderId,
                patientId,
                priority: daysOverdue > 7 ? 'high' : 'medium',
                channels: ['email'],
                data: reminderData,
                sent: false,
                attempts: 0,
                maxAttempts: 3,
                scheduledFor: new Date()
            });

            logger.info(`Order reminder sent for order ${orderId} (${daysOverdue} days overdue)`);

        } catch (error) {
            logger.error('Error sending order reminder:', error);
            throw error;
        }
    }

    /**
     * Schedule a notification
     */
    private async scheduleNotification(notification: Omit<ManualLabNotification, 'id'>): Promise<string> {
        const id = new mongoose.Types.ObjectId().toString();
        const scheduledNotification: ManualLabNotification = {
            ...notification,
            id
        };

        this.notifications.set(id, scheduledNotification);

        // If scheduled for now or past, send immediately
        if (!notification.scheduledFor || notification.scheduledFor <= new Date()) {
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
        const notification = this.notifications.get(notificationId);
        if (!notification || notification.sent) {
            return;
        }

        try {
            notification.attempts++;

            let recipient;
            if (notification.recipientType === 'patient') {
                recipient = await Patient.findById(notification.recipientId);
            } else {
                recipient = await User.findById(notification.recipientId);
            }

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
                        logger.info(`Push notification would be sent to ${recipient.email || recipient._id}`);
                        break;
                }
            }

            // Mark as sent
            notification.sent = true;
            notification.sentAt = new Date();
            this.notifications.set(notificationId, notification);

            logger.info(`Notification ${notificationId} sent successfully`);

        } catch (error) {
            notification.error = (error as Error).message;
            this.notifications.set(notificationId, notification);

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
    private async sendEmailNotification(notification: ManualLabNotification, recipient: any): Promise<void> {
        let subject: string;
        let html: string;
        let text: string;

        switch (notification.type) {
            case 'critical_alert':
                subject = `🚨 Critical Lab Alert - ${notification.data.patientName}`;
                html = this.generateCriticalAlertEmail(notification.data);
                text = `CRITICAL ALERT: ${notification.data.message} for patient ${notification.data.patientName} (Order: ${notification.orderId})`;
                break;

            case 'ai_interpretation_complete':
                subject = `Lab Interpretation Complete - ${notification.data.patientName}`;
                html = this.generateInterpretationCompleteEmail(notification.data);
                text = `AI interpretation complete for ${notification.data.patientName} (Order: ${notification.orderId}). Confidence: ${notification.data.confidenceScore}%`;
                break;

            case 'result_ready':
                subject = `Lab Results Ready - ${notification.data.patientName}`;
                html = this.generateResultReadyEmail(notification.data);
                text = `Your lab results are ready for order ${notification.orderId}. Please contact your pharmacist for details.`;
                break;

            case 'order_reminder':
                subject = `Lab Order Reminder - ${notification.data.patientName}`;
                html = this.generateOrderReminderEmail(notification.data);
                text = `Reminder: Lab order ${notification.orderId} for ${notification.data.patientName} is ${notification.data.daysOverdue} days overdue`;
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
    private async sendSMSNotification(notification: ManualLabNotification, recipient: any): Promise<void> {
        const phone = recipient.phone || recipient.phoneNumber;
        if (!phone) {
            throw new Error('Recipient phone number not available');
        }

        let message: string;

        switch (notification.type) {
            case 'critical_alert':
                message = `🚨 CRITICAL LAB ALERT: ${notification.data.message} - Patient: ${notification.data.patientName} (Order: ${notification.orderId})`;
                break;

            case 'ai_interpretation_complete':
                message = `Lab interpretation complete for ${notification.data.patientName} (Order: ${notification.orderId}). ${notification.data.criticalFlags > 0 ? '⚠️ Critical flags detected!' : 'Review available.'}`;
                break;

            case 'result_ready':
                message = `Your lab results are ready (Order: ${notification.orderId}). Please contact your pharmacist for details.`;
                break;

            case 'order_reminder':
                message = `⚠️ Lab order reminder: Order ${notification.orderId} for ${notification.data.patientName} is ${notification.data.daysOverdue} days overdue`;
                break;

            default:
                throw new Error(`Unknown notification type: ${notification.type}`);
        }

        await sendSMS(phone, message);
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
                    <h2 style="color: ${severityColor}; margin-top: 0;">🚨 Critical Lab Alert</h2>
                    <p style="font-size: 16px; font-weight: bold; margin: 0;">
                        ${data.severity.toUpperCase()} SEVERITY - ${data.requiresImmediate ? 'IMMEDIATE ATTENTION REQUIRED' : 'Attention recommended'}
                    </p>
                </div>

                <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #1e40af;">Patient & Order Information</h3>
                    <p><strong>Patient:</strong> ${data.patientName}</p>
                    <p><strong>MRN:</strong> ${data.patientMRN}</p>
                    <p><strong>Order ID:</strong> ${data.orderId}</p>
                    <p><strong>Alert Type:</strong> ${data.alertType.replace('_', ' ').toUpperCase()}</p>
                </div>

                <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #92400e;">Alert Details</h3>
                    <p><strong>Message:</strong> ${data.message}</p>
                    <p><strong>Timestamp:</strong> ${data.timestamp.toLocaleString()}</p>
                    ${data.details ? `<p><strong>Additional Details:</strong> ${JSON.stringify(data.details, null, 2)}</p>` : ''}
                </div>

                ${data.aiInterpretation ? `
                    <div style="background-color: #e0f2fe; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #0277bd;">AI Interpretation Summary</h3>
                        <p><strong>Confidence Score:</strong> ${data.aiInterpretation.aiAnalysis?.confidenceScore || 'N/A'}%</p>
                        ${data.aiInterpretation.aiAnalysis?.redFlags?.length > 0 ? `
                            <p><strong>Red Flags:</strong> ${data.aiInterpretation.aiAnalysis.redFlags.length} detected</p>
                        ` : ''}
                    </div>
                ` : ''}

                ${data.requiresImmediate ? `
                    <div style="background-color: #fef2f2; border: 2px solid #dc2626; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 0; font-weight: bold; color: #dc2626;">
                            ⚠️ IMMEDIATE ACTION REQUIRED - Please review this patient's lab results immediately and take appropriate action.
                        </p>
                    </div>
                ` : ''}

                <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
                <p style="font-size: 12px; color: #6b7280;">
                    This is an automated alert from the PharmacyCopilot Manual Lab system. 
                    Please log in to your account to review the full details and take appropriate action.
                </p>
            </div>
        `;
    }

    /**
     * Generate AI interpretation complete email HTML
     */
    private generateInterpretationCompleteEmail(data: any): string {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background-color: #e0f2fe; border-left: 4px solid #0277bd; padding: 20px; margin-bottom: 20px;">
                    <h2 style="color: #0277bd; margin-top: 0;">🤖 AI Lab Interpretation Complete</h2>
                    <p style="font-size: 16px; margin: 0;">
                        Diagnostic analysis completed for ${data.patientName}
                    </p>
                </div>

                <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #1e40af;">Order Information</h3>
                    <p><strong>Patient:</strong> ${data.patientName}</p>
                    <p><strong>MRN:</strong> ${data.patientMRN}</p>
                    <p><strong>Order ID:</strong> ${data.orderId}</p>
                    <p><strong>Processed:</strong> ${data.timestamp.toLocaleString()}</p>
                </div>

                <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #0369a1;">Analysis Summary</h3>
                    <p><strong>Confidence Score:</strong> ${data.confidenceScore}%</p>
                    ${data.criticalFlags > 0 ? `
                        <div style="background-color: #fef2f2; padding: 10px; border-radius: 4px; margin: 10px 0;">
                            <p style="margin: 0; color: #dc2626; font-weight: bold;">
                                ⚠️ ${data.criticalFlags} Critical Red Flag${data.criticalFlags > 1 ? 's' : ''} Detected
                            </p>
                        </div>
                    ` : ''}
                    ${data.hasUrgentReferral ? `
                        <div style="background-color: #fef3c7; padding: 10px; border-radius: 4px; margin: 10px 0;">
                            <p style="margin: 0; color: #92400e; font-weight: bold;">
                                🏥 Urgent Referral Recommended
                            </p>
                        </div>
                    ` : ''}
                </div>

                <div style="text-align: center; margin: 30px 0;">
                    <p style="margin-bottom: 15px;">Review the complete interpretation and take appropriate action:</p>
                    <a href="#" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                        View Full Interpretation
                    </a>
                </div>

                <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
                <p style="font-size: 12px; color: #6b7280;">
                    This is an automated notification from the PharmacyCopilot Manual Lab system. 
                    Please log in to your account to review the complete AI interpretation and patient recommendations.
                </p>
            </div>
        `;
    }

    /**
     * Generate result ready email HTML (for patients)
     */
    private generateResultReadyEmail(data: any): string {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background-color: #f0f9ff; border-left: 4px solid #0369a1; padding: 20px; margin-bottom: 20px;">
                    <h2 style="color: #0369a1; margin-top: 0;">📋 Your Lab Results Are Ready</h2>
                    <p style="font-size: 16px; margin: 0;">
                        Hello ${data.patientName}, your lab test results are now available.
                    </p>
                </div>

                <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #1e40af;">Order Details</h3>
                    <p><strong>Order ID:</strong> ${data.orderId}</p>
                    <p><strong>Results Available:</strong> ${data.timestamp.toLocaleString()}</p>
                </div>

                <div style="background-color: #e0f2fe; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #0277bd;">Next Steps</h3>
                    <p>Please contact your pharmacist to:</p>
                    <ul>
                        <li>Review your test results</li>
                        <li>Discuss any findings or recommendations</li>
                        <li>Plan any necessary follow-up care</li>
                        ${data.includeInterpretation ? '<li>Review AI-generated health insights</li>' : ''}
                    </ul>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                    <p style="margin-bottom: 15px;">Contact your pharmacy to schedule a consultation:</p>
                    <a href="tel:+1234567890" style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-right: 10px;">
                        Call Pharmacy
                    </a>
                </div>

                <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0; font-size: 14px; color: #92400e;">
                        <strong>Important:</strong> These results should be discussed with your pharmacist or healthcare provider. 
                        Do not make any changes to your medications without professional guidance.
                    </p>
                </div>

                <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
                <p style="font-size: 12px; color: #6b7280;">
                    This is an automated notification from your pharmacy's lab testing service. 
                    If you have questions about this notification, please contact your pharmacy directly.
                </p>
            </div>
        `;
    }

    /**
     * Generate order reminder email HTML
     */
    private generateOrderReminderEmail(data: any): string {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background-color: #fef3c7; border-left: 4px solid #d97706; padding: 20px; margin-bottom: 20px;">
                    <h2 style="color: #92400e; margin-top: 0;">⏰ Lab Order Reminder</h2>
                    <p style="font-size: 16px; font-weight: bold; margin: 0;">
                        Order is ${data.daysOverdue} days overdue
                    </p>
                </div>

                <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #1e40af;">Order Information</h3>
                    <p><strong>Patient:</strong> ${data.patientName}</p>
                    <p><strong>MRN:</strong> ${data.patientMRN}</p>
                    <p><strong>Order ID:</strong> ${data.orderId}</p>
                    <p><strong>Days Overdue:</strong> ${data.daysOverdue}</p>
                </div>

                <div style="background-color: #e0f2fe; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0; font-size: 14px; color: #0277bd;">
                        Please follow up on this lab order to ensure timely patient care. 
                        Check if results have been received or if the order needs to be reprocessed.
                    </p>
                </div>

                <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
                <p style="font-size: 12px; color: #6b7280;">
                    This is an automated reminder from the PharmacyCopilot Manual Lab system. 
                    Please log in to your account to update the order status.
                </p>
            </div>
        `;
    }

    /**
     * Get notification statistics
     */
    async getNotificationStatistics(workplaceId?: mongoose.Types.ObjectId): Promise<any> {
        try {
            const stats = {
                totalScheduled: this.notifications.size,
                sent: Array.from(this.notifications.values()).filter(n => n.sent).length,
                pending: Array.from(this.notifications.values()).filter(n => !n.sent).length,
                failed: Array.from(this.notifications.values()).filter(n => n.error).length,
                byType: {} as Record<string, number>,
                byChannel: {} as Record<string, number>,
                byPriority: {} as Record<string, number>
            };

            // Count by type, channel, and priority
            Array.from(this.notifications.values()).forEach(notification => {
                stats.byType[notification.type] = (stats.byType[notification.type] || 0) + 1;
                stats.byPriority[notification.priority] = (stats.byPriority[notification.priority] || 0) + 1;
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
     * Update user notification preferences
     */
    async updateNotificationPreferences(
        userId: mongoose.Types.ObjectId,
        preferences: Partial<ManualLabNotificationPreferences>
    ): Promise<void> {
        try {
            await User.findByIdAndUpdate(
                userId,
                { $set: { 'notificationPreferences.manualLab': preferences } },
                { new: true }
            );

            logger.info(`Updated manual lab notification preferences for user ${userId}`);
        } catch (error) {
            logger.error('Error updating notification preferences:', error);
            throw error;
        }
    }
}

export const manualLabNotificationService = new ManualLabNotificationService();
export default manualLabNotificationService;