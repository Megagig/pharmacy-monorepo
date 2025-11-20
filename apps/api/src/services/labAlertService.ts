import mongoose from 'mongoose';
import logger from '../utils/logger';
import emailService from '../utils/emailService';
import LabResult from '../models/LabResult';
import User from '../models/User';
import Patient from '../models/Patient';

/**
 * Lab Alert Service
 * Handles critical value alerts and notifications for lab results
 */

interface AlertRecipient {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
}

interface AlertOptions {
    labResultId: string;
    workplaceId: string;
    patientId: string;
    alertType: 'critical' | 'abnormal' | 'new_result';
    priority: 'high' | 'medium' | 'low';
    sendEmail?: boolean;
    sendInApp?: boolean;
}

/**
 * Send critical value alert
 */
export const sendCriticalValueAlert = async (
    labResultId: string,
    workplaceId: string
): Promise<void> => {
    try {
        // Get lab result with patient details
        const labResult = await LabResult.findById(labResultId)
            .populate('patientId', 'firstName lastName email phoneNumber')
            .lean();

        if (!labResult) {
            throw new Error('Lab result not found');
        }

        // Get recipients (pharmacists, owners, and lab technicians in the workplace)
        const recipients = await getAlertRecipients(workplaceId, ['Owner', 'Pharmacist', 'lab_technician']);

        if (recipients.length === 0) {
            logger.warn('No recipients found for critical value alert', {
                labResultId,
                workplaceId
            });
            return;
        }

        // Send email alerts
        await Promise.all(
            recipients.map(recipient =>
                sendCriticalValueEmail(recipient, labResult, labResult.patientId as any)
            )
        );

        // Create in-app notifications
        await createInAppNotifications(recipients, labResult, 'critical');

        // Update lab result with alert sent flag
        await LabResult.findByIdAndUpdate(labResultId, {
            'alerts.criticalValueAlertSent': true,
            'alerts.criticalValueAlertSentAt': new Date(),
            'alerts.criticalValueAlertRecipients': recipients.map(r => new mongoose.Types.ObjectId(r.userId))
        });

        logger.info('Critical value alert sent successfully', {
            labResultId,
            recipientsCount: recipients.length
        });

    } catch (error) {
        logger.error('Error sending critical value alert', {
            error: error instanceof Error ? error.message : 'Unknown error',
            labResultId
        });
        throw error;
    }
};

/**
 * Send abnormal result notification
 */
export const sendAbnormalResultNotification = async (
    labResultId: string,
    workplaceId: string
): Promise<void> => {
    try {
        const labResult = await LabResult.findById(labResultId)
            .populate('patientId', 'firstName lastName email')
            .lean();

        if (!labResult) {
            throw new Error('Lab result not found');
        }

        // Get recipients (pharmacists and owners)
        const recipients = await getAlertRecipients(workplaceId, ['Owner', 'Pharmacist']);

        if (recipients.length === 0) {
            logger.warn('No recipients found for abnormal result notification', {
                labResultId,
                workplaceId
            });
            return;
        }

        // Send email notifications (lower priority than critical)
        await Promise.all(
            recipients.map(recipient =>
                sendAbnormalResultEmail(recipient, labResult, labResult.patientId as any)
            )
        );

        // Create in-app notifications
        await createInAppNotifications(recipients, labResult, 'abnormal');

        // Update lab result
        await LabResult.findByIdAndUpdate(labResultId, {
            'alerts.abnormalResultNotificationSent': true,
            'alerts.abnormalResultNotificationSentAt': new Date()
        });

        logger.info('Abnormal result notification sent successfully', {
            labResultId,
            recipientsCount: recipients.length
        });

    } catch (error) {
        logger.error('Error sending abnormal result notification', {
            error: error instanceof Error ? error.message : 'Unknown error',
            labResultId
        });
    }
};

/**
 * Send new result notification
 */
export const sendNewResultNotification = async (
    labResultId: string,
    workplaceId: string
): Promise<void> => {
    try {
        const labResult = await LabResult.findById(labResultId)
            .populate('patientId', 'firstName lastName email')
            .lean();

        if (!labResult) {
            throw new Error('Lab result not found');
        }

        // Get recipients (all pharmacy team members)
        const recipients = await getAlertRecipients(workplaceId, [
            'Owner',
            'Pharmacist',
            'pharmacy_team',
            'pharmacy_outlet'
        ]);

        if (recipients.length === 0) {
            return;
        }

        // Create in-app notifications only (no email for new results)
        await createInAppNotifications(recipients, labResult, 'new_result');

        logger.info('New result notification sent successfully', {
            labResultId,
            recipientsCount: recipients.length
        });

    } catch (error) {
        logger.error('Error sending new result notification', {
            error: error instanceof Error ? error.message : 'Unknown error',
            labResultId
        });
    }
};

/**
 * Get alert recipients based on roles
 */
const getAlertRecipients = async (
    workplaceId: string,
    roles: string[]
): Promise<AlertRecipient[]> => {
    try {
        const users = await User.find({
            workplaceId: new mongoose.Types.ObjectId(workplaceId),
            role: { $in: roles },
            isActive: true,
            isDeleted: false
        })
            .select('_id email firstName lastName role')
            .lean();

        return users.map(user => ({
            userId: user._id.toString(),
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role
        }));

    } catch (error) {
        logger.error('Error getting alert recipients', {
            error: error instanceof Error ? error.message : 'Unknown error',
            workplaceId
        });
        return [];
    }
};

/**
 * Send critical value email
 */
const sendCriticalValueEmail = async (
    recipient: AlertRecipient,
    labResult: any,
    patient: any
): Promise<void> => {
    try {
        const subject = `🚨 CRITICAL LAB VALUE ALERT - ${patient.firstName} ${patient.lastName}`;

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background-color: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; font-size: 24px;">🚨 Critical Lab Value Alert</h1>
                </div>
                
                <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb;">
                    <h2 style="color: #dc2626; margin-top: 0;">Immediate Attention Required</h2>
                    
                    <div style="background-color: white; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                        <h3 style="margin-top: 0; color: #374151;">Patient Information</h3>
                        <p><strong>Name:</strong> ${patient.firstName} ${patient.lastName}</p>
                        <p><strong>Patient ID:</strong> ${patient._id}</p>
                    </div>
                    
                    <div style="background-color: white; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                        <h3 style="margin-top: 0; color: #374151;">Critical Lab Result</h3>
                        <p><strong>Test:</strong> ${labResult.testName}</p>
                        <p><strong>Value:</strong> <span style="color: #dc2626; font-size: 18px; font-weight: bold;">${labResult.testValue} ${labResult.unit || ''}</span></p>
                        <p><strong>Reference Range:</strong> ${labResult.referenceRange || 'N/A'}</p>
                        <p><strong>Interpretation:</strong> <span style="color: #dc2626; font-weight: bold;">${labResult.interpretation}</span></p>
                        <p><strong>Test Date:</strong> ${new Date(labResult.testDate).toLocaleDateString()}</p>
                    </div>
                    
                    <div style="background-color: #fef2f2; padding: 15px; border-left: 4px solid #dc2626; margin-bottom: 15px;">
                        <p style="margin: 0; color: #991b1b;">
                            <strong>Action Required:</strong> Please review this critical result immediately and take appropriate clinical action.
                        </p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 20px;">
                        <a href="${process.env.FRONTEND_URL}/laboratory/results/${labResult._id}" 
                           style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                            View Lab Result
                        </a>
                    </div>
                </div>
                
                <div style="background-color: #f3f4f6; padding: 15px; text-align: center; border-radius: 0 0 8px 8px;">
                    <p style="margin: 0; color: #6b7280; font-size: 12px;">
                        This is an automated alert from PharmaCare Laboratory System
                    </p>
                </div>
            </div>
        `;

        await emailService.sendEmail({
            to: recipient.email,
            subject,
            text: `Critical Lab Result Alert for ${patient.firstName} ${patient.lastName}`,
            html
        });

        logger.info('Critical value email sent', {
            recipientEmail: recipient.email,
            labResultId: labResult._id
        });

    } catch (error) {
        logger.error('Error sending critical value email', {
            error: error instanceof Error ? error.message : 'Unknown error',
            recipientEmail: recipient.email
        });
    }
};

/**
 * Send abnormal result email
 */
const sendAbnormalResultEmail = async (
    recipient: AlertRecipient,
    labResult: any,
    patient: any
): Promise<void> => {
    try {
        const subject = `⚠️ Abnormal Lab Result - ${patient.firstName} ${patient.lastName}`;

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background-color: #f59e0b; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; font-size: 24px;">⚠️ Abnormal Lab Result</h1>
                </div>
                
                <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb;">
                    <div style="background-color: white; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                        <h3 style="margin-top: 0; color: #374151;">Patient Information</h3>
                        <p><strong>Name:</strong> ${patient.firstName} ${patient.lastName}</p>
                    </div>
                    
                    <div style="background-color: white; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                        <h3 style="margin-top: 0; color: #374151;">Lab Result</h3>
                        <p><strong>Test:</strong> ${labResult.testName}</p>
                        <p><strong>Value:</strong> <span style="color: #f59e0b; font-weight: bold;">${labResult.testValue} ${labResult.unit || ''}</span></p>
                        <p><strong>Reference Range:</strong> ${labResult.referenceRange || 'N/A'}</p>
                        <p><strong>Interpretation:</strong> ${labResult.interpretation}</p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 20px;">
                        <a href="${process.env.FRONTEND_URL}/laboratory/results/${labResult._id}" 
                           style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                            View Lab Result
                        </a>
                    </div>
                </div>
            </div>
        `;

        await emailService.sendEmail({
            to: recipient.email,
            subject,
            text: `Abnormal Lab Result Notification for ${patient.firstName} ${patient.lastName}`,
            html
        });

    } catch (error) {
        logger.error('Error sending abnormal result email', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * Create in-app notifications
 */
const createInAppNotifications = async (
    recipients: AlertRecipient[],
    labResult: any,
    type: 'critical' | 'abnormal' | 'new_result'
): Promise<void> => {
    try {
        // This would integrate with your notification system
        // For now, we'll just log it
        logger.info('In-app notifications created', {
            type,
            recipientsCount: recipients.length,
            labResultId: labResult._id
        });

        // TODO: Integrate with actual notification system
        // Example:
        // await Notification.insertMany(
        //     recipients.map(recipient => ({
        //         userId: recipient.userId,
        //         type: 'lab_result_alert',
        //         title: getNotificationTitle(type, labResult),
        //         message: getNotificationMessage(type, labResult),
        //         data: { labResultId: labResult._id },
        //         priority: type === 'critical' ? 'high' : 'medium'
        //     }))
        // );

    } catch (error) {
        logger.error('Error creating in-app notifications', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export default {
    sendCriticalValueAlert,
    sendAbnormalResultNotification,
    sendNewResultNotification
};

