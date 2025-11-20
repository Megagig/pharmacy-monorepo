import { Types } from 'mongoose';
import logger from '../../../utils/logger';
import { sendEmail } from '../../../utils/email';
import { sendSMS } from '../../../utils/sms';
import LabIntegration, { ILabIntegration } from '../models/LabIntegration';
import LabResult from '../models/LabResult';
import Patient from '../../../models/Patient';
import User from '../../../models/User';
import Notification from '../../../models/Notification';

export interface CriticalLabAlert {
    type: 'critical_value' | 'critical_interpretation' | 'critical_safety_issue' | 'escalation_required';
    severity: 'critical' | 'urgent';
    labIntegrationId: Types.ObjectId;
    patientId: Types.ObjectId;
    workplaceId: Types.ObjectId;
    message: string;
    details: any;
    requiresImmediate: boolean;
    testCode?: string;
    testName?: string;
    value?: string;
    referenceRange?: string;
}

export interface EscalationRequest {
    labIntegrationId: string;
    reason: string;
    physicianId?: string;
    physicianEmail?: string;
    physicianPhone?: string;
    urgency: 'routine' | 'urgent' | 'critical';
    requestedBy: string;
}

class LabIntegrationAlertService {
    /**
     * Check for critical values and send alerts
     */
    async checkAndAlertCriticalValues(labIntegrationId: string): Promise<void> {
        try {
            const labIntegration = await LabIntegration.findById(labIntegrationId)
                .populate('labResultIds')
                .populate('patientId');

            if (!labIntegration) {
                throw new Error('Lab integration case not found');
            }

            const criticalResults = (labIntegration.labResultIds as any[]).filter(
                (result: any) => result.criticalValue === true
            );

            if (criticalResults.length > 0) {
                for (const result of criticalResults) {
                    await this.sendCriticalValueAlert({
                        type: 'critical_value',
                        severity: 'critical',
                        labIntegrationId: labIntegration._id,
                        patientId: labIntegration.patientId as Types.ObjectId,
                        workplaceId: labIntegration.workplaceId,
                        message: `Critical lab value detected: ${result.testName}`,
                        details: {
                            testCode: result.testCode,
                            testName: result.testName,
                            value: result.value,
                            unit: result.unit,
                            referenceRange: result.referenceRange,
                            interpretation: result.interpretation
                        },
                        requiresImmediate: true,
                        testCode: result.testCode,
                        testName: result.testName,
                        value: result.value,
                        referenceRange: `${result.referenceRange?.min || ''}-${result.referenceRange?.max || ''} ${result.unit || ''}`
                    });
                }

                // Mark lab integration as having critical safety issues
                labIntegration.criticalSafetyIssues = true;
                await labIntegration.save();
            }

            // Check AI interpretation for critical significance
            if (labIntegration.aiInterpretation?.clinicalSignificance === 'critical') {
                await this.sendCriticalValueAlert({
                    type: 'critical_interpretation',
                    severity: 'critical',
                    labIntegrationId: labIntegration._id,
                    patientId: labIntegration.patientId as Types.ObjectId,
                    workplaceId: labIntegration.workplaceId,
                    message: 'AI interpretation indicates critical clinical significance',
                    details: {
                        interpretation: labIntegration.aiInterpretation.interpretation,
                        confidence: labIntegration.aiInterpretation.confidence,
                        therapeuticImplications: labIntegration.aiInterpretation.therapeuticImplications
                    },
                    requiresImmediate: true
                });
            }

            // Check for critical safety issues
            const criticalSafetyChecks = labIntegration.safetyChecks?.filter(
                check => check.severity === 'critical'
            );

            if (criticalSafetyChecks && criticalSafetyChecks.length > 0) {
                await this.sendCriticalValueAlert({
                    type: 'critical_safety_issue',
                    severity: 'critical',
                    labIntegrationId: labIntegration._id,
                    patientId: labIntegration.patientId as Types.ObjectId,
                    workplaceId: labIntegration.workplaceId,
                    message: `${criticalSafetyChecks.length} critical safety issue(s) detected`,
                    details: {
                        safetyChecks: criticalSafetyChecks.map(check => ({
                            type: check.checkType,
                            description: check.description,
                            affectedMedications: check.affectedMedications
                        }))
                    },
                    requiresImmediate: true
                });
            }

        } catch (error) {
            logger.error('Failed to check and alert critical values', {
                error: error instanceof Error ? error.message : 'Unknown error',
                labIntegrationId
            });
            throw error;
        }
    }

    /**
     * Send critical value alert to on-duty pharmacists
     */
    private async sendCriticalValueAlert(alert: CriticalLabAlert): Promise<void> {
        try {
            const patient = await Patient.findById(alert.patientId);
            if (!patient) {
                throw new Error('Patient not found');
            }

            // Find on-duty pharmacists (active pharmacists in the workplace)
            const pharmacists = await User.find({
                workplaceId: alert.workplaceId,
                role: { $in: ['pharmacist', 'owner'] },
                status: 'active',
                'notificationPreferences.criticalAlerts': { $ne: false }
            });

            const patientName = `${patient.firstName} ${patient.lastName}`;
            const patientMRN = patient.mrn;

            // Send notifications to all on-duty pharmacists
            for (const pharmacist of pharmacists) {
                // Determine notification channels based on severity
                const channels: ('email' | 'sms')[] = [];

                // Always send in-app notification
                await this.sendInAppNotification(pharmacist._id, alert, patientName, patientMRN);

                // Send email for all critical alerts
                if (pharmacist.email) {
                    channels.push('email');
                    await this.sendEmailAlert(pharmacist, alert, patientName, patientMRN);
                }

                // Send SMS for immediate attention required
                if (alert.requiresImmediate && pharmacist.phone &&
                    pharmacist.notificationPreferences?.sms !== false) {
                    channels.push('sms');
                    await this.sendSMSAlert(pharmacist, alert, patientName, patientMRN);
                }

                logger.info('Critical lab alert sent', {
                    alertType: alert.type,
                    pharmacistId: pharmacist._id,
                    patientId: alert.patientId,
                    channels
                });
            }

        } catch (error) {
            logger.error('Failed to send critical value alert', {
                error: error instanceof Error ? error.message : 'Unknown error',
                alertType: alert.type
            });
            throw error;
        }
    }

    /**
     * Send in-app notification
     */
    private async sendInAppNotification(
        userId: Types.ObjectId,
        alert: CriticalLabAlert,
        patientName: string,
        patientMRN: string
    ): Promise<void> {
        const notification = new Notification({
            userId,
            workplaceId: alert.workplaceId,
            type: 'clinical_alert',
            title: `🚨 Critical Lab Alert: ${patientName}`,
            content: alert.message,
            data: {
                patientId: alert.patientId,
                patientName,
                mrn: patientMRN,
                labIntegrationId: alert.labIntegrationId,
                alertType: alert.type,
                severity: alert.severity,
                testName: alert.testName,
                value: alert.value,
                referenceRange: alert.referenceRange,
                actionUrl: `/pharmacy/lab-integration/${alert.labIntegrationId}`,
                metadata: alert.details
            },
            priority: 'critical',
            status: 'unread',
            deliveryChannels: {
                inApp: true,
                email: false,
                sms: false,
                push: false
            },
            deliveryStatus: [],
            createdBy: userId
        });

        await notification.save();

        // Send real-time notification via WebSocket
        // Real-time notification will be sent automatically by notification service via socket.io
    }

    /**
     * Send email alert
     */
    private async sendEmailAlert(
        pharmacist: any,
        alert: CriticalLabAlert,
        patientName: string,
        patientMRN: string
    ): Promise<void> {
        const subject = `🚨 CRITICAL LAB ALERT: ${patientName} (${patientMRN})`;

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background-color: #d32f2f; color: white; padding: 20px; text-align: center;">
                    <h1 style="margin: 0;">🚨 CRITICAL LAB ALERT</h1>
                </div>
                
                <div style="padding: 20px; background-color: #f5f5f5;">
                    <h2 style="color: #d32f2f; margin-top: 0;">Immediate Attention Required</h2>
                    
                    <div style="background-color: white; padding: 15px; border-left: 4px solid #d32f2f; margin-bottom: 15px;">
                        <p><strong>Patient:</strong> ${patientName}</p>
                        <p><strong>MRN:</strong> ${patientMRN}</p>
                        <p><strong>Alert Type:</strong> ${alert.type.replace(/_/g, ' ').toUpperCase()}</p>
                        ${alert.testName ? `<p><strong>Test:</strong> ${alert.testName}</p>` : ''}
                        ${alert.value ? `<p><strong>Value:</strong> ${alert.value}</p>` : ''}
                        ${alert.referenceRange ? `<p><strong>Reference Range:</strong> ${alert.referenceRange}</p>` : ''}
                    </div>
                    
                    <div style="background-color: white; padding: 15px; margin-bottom: 15px;">
                        <h3 style="margin-top: 0;">Alert Details</h3>
                        <p>${alert.message}</p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 20px;">
                        <a href="${process.env.FRONTEND_URL}/pharmacy/lab-integration/${alert.labIntegrationId}" 
                           style="background-color: #d32f2f; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block;">
                            View Case Details
                        </a>
                    </div>
                </div>
                
                <div style="padding: 15px; text-align: center; color: #666; font-size: 12px;">
                    <p>This is an automated critical alert from PharmaCare Lab Integration System</p>
                    <p>Timestamp: ${new Date().toLocaleString()}</p>
                </div>
            </div>
        `;

        await sendEmail({
            to: pharmacist.email,
            subject,
            html,
            text: `CRITICAL LAB ALERT\n\nPatient: ${patientName} (${patientMRN})\nAlert: ${alert.message}\n\nView details: ${process.env.FRONTEND_URL}/pharmacy/lab-integration/${alert.labIntegrationId}`
        });
    }

    /**
     * Send SMS alert
     */
    private async sendSMSAlert(
        pharmacist: any,
        alert: CriticalLabAlert,
        patientName: string,
        patientMRN: string
    ): Promise<void> {
        const message = `🚨 CRITICAL LAB ALERT: ${patientName} (${patientMRN}) - ${alert.message}. View: ${process.env.FRONTEND_URL}/pharmacy/lab-integration/${alert.labIntegrationId}`;

        await sendSMS(pharmacist.phone, message);
    }

    /**
     * Escalate case to physician
     */
    async escalateToPhysician(escalation: EscalationRequest): Promise<void> {
        try {
            const labIntegration = await LabIntegration.findById(escalation.labIntegrationId)
                .populate('patientId');

            if (!labIntegration) {
                throw new Error('Lab integration case not found');
            }

            // Update lab integration with escalation
            await labIntegration.escalateToPhysician(
                escalation.reason,
                escalation.physicianId ? new Types.ObjectId(escalation.physicianId) : undefined
            );

            const patient = labIntegration.patientId as any;
            const patientName = `${patient.firstName} ${patient.lastName}`;

            // Send escalation notification to physician
            if (escalation.physicianEmail) {
                await this.sendPhysicianEscalationEmail(
                    escalation.physicianEmail,
                    labIntegration,
                    patientName,
                    patient.mrn,
                    escalation.reason,
                    escalation.urgency
                );
            }

            if (escalation.physicianPhone && escalation.urgency === 'critical') {
                await this.sendPhysicianEscalationSMS(
                    escalation.physicianPhone,
                    patientName,
                    patient.mrn,
                    escalation.reason
                );
            }

            // Mark as physician notified
            labIntegration.physicianNotified = true;
            labIntegration.physicianNotificationDate = new Date();
            await labIntegration.save();

            logger.info('Case escalated to physician', {
                labIntegrationId: escalation.labIntegrationId,
                physicianEmail: escalation.physicianEmail,
                urgency: escalation.urgency
            });

        } catch (error) {
            logger.error('Failed to escalate to physician', {
                error: error instanceof Error ? error.message : 'Unknown error',
                labIntegrationId: escalation.labIntegrationId
            });
            throw error;
        }
    }

    /**
     * Send physician escalation email
     */
    private async sendPhysicianEscalationEmail(
        physicianEmail: string,
        labIntegration: ILabIntegration,
        patientName: string,
        patientMRN: string,
        reason: string,
        urgency: string
    ): Promise<void> {
        const subject = `${urgency === 'critical' ? '🚨 URGENT' : '⚠️'} Physician Consultation Requested: ${patientName}`;

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background-color: ${urgency === 'critical' ? '#d32f2f' : '#ff9800'}; color: white; padding: 20px;">
                    <h1 style="margin: 0;">${urgency === 'critical' ? '🚨 URGENT' : '⚠️'} Physician Consultation Requested</h1>
                </div>
                
                <div style="padding: 20px;">
                    <p>Dear Doctor,</p>
                    <p>A pharmacist has requested your consultation regarding lab results for the following patient:</p>
                    
                    <div style="background-color: #f5f5f5; padding: 15px; margin: 15px 0;">
                        <p><strong>Patient:</strong> ${patientName}</p>
                        <p><strong>MRN:</strong> ${patientMRN}</p>
                        <p><strong>Urgency:</strong> ${urgency.toUpperCase()}</p>
                    </div>
                    
                    <h3>Reason for Escalation:</h3>
                    <p>${reason}</p>
                    
                    ${labIntegration.aiInterpretation ? `
                        <h3>AI Interpretation Summary:</h3>
                        <p>${labIntegration.aiInterpretation.interpretation}</p>
                    ` : ''}
                    
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="${process.env.FRONTEND_URL}/pharmacy/lab-integration/${labIntegration._id}" 
                           style="background-color: #1976d2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block;">
                            View Full Case Details
                        </a>
                    </div>
                </div>
                
                <div style="padding: 15px; background-color: #f5f5f5; text-align: center; color: #666; font-size: 12px;">
                    <p>PharmaCare Lab Integration System</p>
                    <p>Timestamp: ${new Date().toLocaleString()}</p>
                </div>
            </div>
        `;

        await sendEmail({
            to: physicianEmail,
            subject,
            html,
            text: `Physician Consultation Requested\n\nPatient: ${patientName} (${patientMRN})\nUrgency: ${urgency}\n\nReason: ${reason}\n\nView details: ${process.env.FRONTEND_URL}/pharmacy/lab-integration/${labIntegration._id}`
        });
    }

    /**
     * Send physician escalation SMS
     */
    private async sendPhysicianEscalationSMS(
        physicianPhone: string,
        patientName: string,
        patientMRN: string,
        reason: string
    ): Promise<void> {
        const message = `🚨 URGENT: Physician consultation requested for ${patientName} (${patientMRN}). Reason: ${reason}. Please check your email for details.`;

        await sendSMS(physicianPhone, message);
    }
}

export default new LabIntegrationAlertService();

