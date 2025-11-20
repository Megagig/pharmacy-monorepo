import { INotificationData } from '../../models/Notification';

export interface NotificationTemplate {
    subject: string;
    content: string;
    htmlTemplate?: string;
    smsTemplate?: string;
    emailTemplate?: string;
}

export interface TemplateVariables {
    [key: string]: any;
}

/**
 * Communication Hub notification templates
 */
export class NotificationTemplateService {
    private templates: Map<string, NotificationTemplate> = new Map();

    constructor() {
        this.initializeTemplates();
    }

    /**
     * Get template for notification type
     */
    getTemplate(type: string, variables: TemplateVariables = {}): NotificationTemplate {
        const template = this.templates.get(type);
        if (!template) {
            return this.getDefaultTemplate(variables);
        }

        return this.processTemplate(template, variables);
    }

    /**
     * Process template with variables
     */
    private processTemplate(template: NotificationTemplate, variables: TemplateVariables): NotificationTemplate {
        const processString = (str: string): string => {
            return str.replace(/\{\{(\w+)\}\}/g, (match, key) => {
                return variables[key] || match;
            });
        };

        return {
            subject: processString(template.subject),
            content: processString(template.content),
            htmlTemplate: template.htmlTemplate ? processString(template.htmlTemplate) : undefined,
            smsTemplate: template.smsTemplate ? processString(template.smsTemplate) : undefined,
            emailTemplate: template.emailTemplate ? processString(template.emailTemplate) : undefined,
        };
    }

    /**
     * Initialize all notification templates
     */
    private initializeTemplates(): void {
        // New Message Templates
        this.templates.set('new_message', {
            subject: 'New Message from {{senderName}}',
            content: '{{senderName}} sent you a message in {{conversationTitle}}',
            htmlTemplate: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h2 style="color: #2563eb; margin-top: 0;">💬 New Message</h2>
                        <p style="font-size: 16px; margin: 0;">
                            <strong>{{senderName}}</strong> sent you a message in <strong>{{conversationTitle}}</strong>
                        </p>
                    </div>
                    
                    {{#if messagePreview}}
                    <div style="background-color: #ffffff; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0;">
                        <p style="margin: 0; font-style: italic; color: #4b5563;">
                            "{{messagePreview}}"
                        </p>
                    </div>
                    {{/if}}
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{{actionUrl}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                            View Conversation
                        </a>
                    </div>
                    
                    {{#if patientInfo}}
                    <div style="background-color: #f0f9ff; padding: 15px; border-radius: 6px; margin: 20px 0;">
                        <h4 style="margin-top: 0; color: #0369a1;">Patient Information</h4>
                        <p style="margin: 5px 0;"><strong>Name:</strong> {{patientInfo.name}}</p>
                        <p style="margin: 5px 0;"><strong>MRN:</strong> {{patientInfo.mrn}}</p>
                    </div>
                    {{/if}}
                </div>
            `,
            smsTemplate: 'New message from {{senderName}}: {{messagePreview}}',
            emailTemplate: `
                <h3>New Message from {{senderName}}</h3>
                <p>You have received a new message in <strong>{{conversationTitle}}</strong></p>
                {{#if messagePreview}}<blockquote>{{messagePreview}}</blockquote>{{/if}}
                <p><a href="{{actionUrl}}">View Conversation</a></p>
            `,
        });

        // Mention Templates
        this.templates.set('mention', {
            subject: 'You were mentioned by {{senderName}}',
            content: '{{senderName}} mentioned you in {{conversationTitle}}',
            htmlTemplate: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin-bottom: 20px;">
                        <h2 style="color: #92400e; margin-top: 0;">🏷️ You were mentioned</h2>
                        <p style="font-size: 16px; margin: 0;">
                            <strong>{{senderName}}</strong> mentioned you in <strong>{{conversationTitle}}</strong>
                        </p>
                    </div>
                    
                    <div style="background-color: #ffffff; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
                        <p style="margin: 0; color: #4b5563;">
                            "{{messagePreview}}"
                        </p>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{{actionUrl}}" style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                            View Message
                        </a>
                    </div>
                </div>
            `,
            smsTemplate: '{{senderName}} mentioned you: {{messagePreview}}',
        });

        // Patient Query Templates
        this.templates.set('patient_query', {
            subject: 'New Patient Query from {{patientName}}',
            content: 'Patient {{patientName}} has sent a new query',
            htmlTemplate: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 20px; margin-bottom: 20px;">
                        <h2 style="color: #047857; margin-top: 0;">🏥 New Patient Query</h2>
                        <p style="font-size: 16px; margin: 0;">
                            Patient <strong>{{patientName}}</strong> has sent a new query
                        </p>
                    </div>
                    
                    <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #1e40af;">Patient Information</h3>
                        <p style="margin: 5px 0;"><strong>Name:</strong> {{patientName}}</p>
                        <p style="margin: 5px 0;"><strong>MRN:</strong> {{patientMRN}}</p>
                        <p style="margin: 5px 0;"><strong>Query Time:</strong> {{queryTime}}</p>
                    </div>
                    
                    <div style="background-color: #ffffff; border: 1px solid #e5e7eb; padding: 15px; border-radius: 6px; margin: 20px 0;">
                        <h4 style="margin-top: 0; color: #374151;">Patient's Query:</h4>
                        <p style="margin: 0; color: #4b5563; line-height: 1.6;">
                            {{queryPreview}}
                        </p>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{{actionUrl}}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                            Respond to Query
                        </a>
                    </div>
                    
                    <div style="background-color: #fef3c7; padding: 15px; border-radius: 6px; margin: 20px 0;">
                        <p style="margin: 0; font-size: 14px; color: #92400e;">
                            ⚠️ <strong>Response Time:</strong> Please respond to patient queries within 2 hours during business hours.
                        </p>
                    </div>
                </div>
            `,
            smsTemplate: 'New patient query from {{patientName}}: {{queryPreview}}',
        });

        // Conversation Invite Templates
        this.templates.set('conversation_invite', {
            subject: 'Invited to conversation by {{senderName}}',
            content: '{{senderName}} invited you to join {{conversationTitle}}',
            htmlTemplate: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 20px; margin-bottom: 20px;">
                        <h2 style="color: #0369a1; margin-top: 0;">👥 Conversation Invitation</h2>
                        <p style="font-size: 16px; margin: 0;">
                            <strong>{{senderName}}</strong> invited you to join <strong>{{conversationTitle}}</strong>
                        </p>
                    </div>
                    
                    {{#if conversationDescription}}
                    <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
                        <h4 style="margin-top: 0; color: #374151;">About this conversation:</h4>
                        <p style="margin: 0; color: #4b5563;">{{conversationDescription}}</p>
                    </div>
                    {{/if}}
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{{actionUrl}}" style="background-color: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                            Join Conversation
                        </a>
                    </div>
                </div>
            `,
            smsTemplate: '{{senderName}} invited you to join {{conversationTitle}}',
        });

        // Urgent Message Templates
        this.templates.set('urgent_message', {
            subject: '🚨 URGENT: Message from {{senderName}}',
            content: 'URGENT: {{senderName}} sent you an urgent message',
            htmlTemplate: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin-bottom: 20px;">
                        <h2 style="color: #dc2626; margin-top: 0;">🚨 URGENT MESSAGE</h2>
                        <p style="font-size: 16px; margin: 0; font-weight: bold;">
                            <strong>{{senderName}}</strong> sent you an urgent message in <strong>{{conversationTitle}}</strong>
                        </p>
                    </div>
                    
                    <div style="background-color: #ffffff; border: 2px solid #dc2626; padding: 15px; border-radius: 6px; margin: 20px 0;">
                        <p style="margin: 0; color: #4b5563; font-weight: 600;">
                            {{messagePreview}}
                        </p>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{{actionUrl}}" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                            View Urgent Message
                        </a>
                    </div>
                    
                    <div style="background-color: #fef2f2; padding: 15px; border-radius: 6px; margin: 20px 0;">
                        <p style="margin: 0; font-size: 14px; color: #dc2626; font-weight: 600;">
                            ⚠️ This message requires immediate attention. Please respond as soon as possible.
                        </p>
                    </div>
                </div>
            `,
            smsTemplate: '🚨 URGENT from {{senderName}}: {{messagePreview}}',
        });

        // Clinical Alert Templates
        this.templates.set('clinical_alert', {
            subject: '⚕️ Clinical Alert: {{alertType}}',
            content: 'Clinical alert for patient {{patientName}}: {{alertMessage}}',
            htmlTemplate: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin-bottom: 20px;">
                        <h2 style="color: #92400e; margin-top: 0;">⚕️ Clinical Alert</h2>
                        <p style="font-size: 16px; margin: 0; font-weight: bold;">
                            {{alertType}} - {{severity}} Priority
                        </p>
                    </div>
                    
                    <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #1e40af;">Patient Information</h3>
                        <p style="margin: 5px 0;"><strong>Name:</strong> {{patientName}}</p>
                        <p style="margin: 5px 0;"><strong>MRN:</strong> {{patientMRN}}</p>
                        <p style="margin: 5px 0;"><strong>Alert Time:</strong> {{alertTime}}</p>
                    </div>
                    
                    <div style="background-color: #ffffff; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0;">
                        <h4 style="margin-top: 0; color: #92400e;">Alert Details:</h4>
                        <p style="margin: 0; color: #4b5563; line-height: 1.6;">
                            {{alertMessage}}
                        </p>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{{actionUrl}}" style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                            Review Alert
                        </a>
                    </div>
                </div>
            `,
            smsTemplate: '⚕️ Clinical Alert for {{patientName}}: {{alertMessage}}',
        });

        // Therapy Update Templates
        this.templates.set('therapy_update', {
            subject: 'Therapy Update for {{patientName}}',
            content: 'Therapy plan updated for patient {{patientName}}',
            htmlTemplate: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 20px; margin-bottom: 20px;">
                        <h2 style="color: #15803d; margin-top: 0;">💊 Therapy Update</h2>
                        <p style="font-size: 16px; margin: 0;">
                            Therapy plan updated for <strong>{{patientName}}</strong>
                        </p>
                    </div>
                    
                    <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #1e40af;">Update Details</h3>
                        <p style="margin: 5px 0;"><strong>Patient:</strong> {{patientName}} ({{patientMRN}})</p>
                        <p style="margin: 5px 0;"><strong>Updated by:</strong> {{updatedBy}}</p>
                        <p style="margin: 5px 0;"><strong>Update Time:</strong> {{updateTime}}</p>
                    </div>
                    
                    <div style="background-color: #ffffff; border: 1px solid #e5e7eb; padding: 15px; border-radius: 6px; margin: 20px 0;">
                        <h4 style="margin-top: 0; color: #374151;">Changes Made:</h4>
                        <p style="margin: 0; color: #4b5563; line-height: 1.6;">
                            {{updateDescription}}
                        </p>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{{actionUrl}}" style="background-color: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                            View Therapy Plan
                        </a>
                    </div>
                </div>
            `,
            smsTemplate: 'Therapy updated for {{patientName}}: {{updateDescription}}',
        });

        // File Shared Templates
        this.templates.set('file_shared', {
            subject: 'File shared by {{senderName}}',
            content: '{{senderName}} shared a file with you: {{fileName}}',
            htmlTemplate: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #f8fafc; border-left: 4px solid #6366f1; padding: 20px; margin-bottom: 20px;">
                        <h2 style="color: #4338ca; margin-top: 0;">📎 File Shared</h2>
                        <p style="font-size: 16px; margin: 0;">
                            <strong>{{senderName}}</strong> shared a file with you
                        </p>
                    </div>
                    
                    <div style="background-color: #ffffff; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #374151;">File Details</h3>
                        <p style="margin: 5px 0;"><strong>File Name:</strong> {{fileName}}</p>
                        <p style="margin: 5px 0;"><strong>File Size:</strong> {{fileSize}}</p>
                        <p style="margin: 5px 0;"><strong>File Type:</strong> {{fileType}}</p>
                        <p style="margin: 5px 0;"><strong>Shared in:</strong> {{conversationTitle}}</p>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{{actionUrl}}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                            View File
                        </a>
                    </div>
                </div>
            `,
            smsTemplate: '{{senderName}} shared {{fileName}} with you',
        });

        // System Notification Templates
        this.templates.set('system_notification', {
            subject: 'PharmacyCopilot System Notification',
            content: '{{notificationMessage}}',
            htmlTemplate: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #f1f5f9; border-left: 4px solid #64748b; padding: 20px; margin-bottom: 20px;">
                        <h2 style="color: #475569; margin-top: 0;">🔔 System Notification</h2>
                        <p style="font-size: 16px; margin: 0;">
                            PharmacyCopilot System Update
                        </p>
                    </div>
                    
                    <div style="background-color: #ffffff; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 0; color: #4b5563; line-height: 1.6;">
                            {{notificationMessage}}
                        </p>
                    </div>
                    
                    {{#if actionUrl}}
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{{actionUrl}}" style="background-color: #64748b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                            Learn More
                        </a>
                    </div>
                    {{/if}}
                </div>
            `,
            smsTemplate: 'PharmacyCopilot: {{notificationMessage}}',
        });

        // Appointment Reminder Templates
        this.templates.set('appointment_reminder', {
            subject: 'Appointment Reminder: {{appointmentType}} {{reminderType}}',
            content: 'Hi {{patientName}}, you have a {{appointmentType}} appointment {{reminderType}} on {{scheduledDate}} at {{scheduledTime}} with {{pharmacistName}}.',
            htmlTemplate: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h2 style="color: #2563eb; margin-top: 0;">📅 Appointment Reminder</h2>
                        <p style="font-size: 16px; margin: 0;">
                            Hi <strong>{{patientName}}</strong>, you have an upcoming appointment {{reminderType}}.
                        </p>
                    </div>
                    
                    <div style="background-color: #ffffff; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #1f2937;">Appointment Details</h3>
                        <p style="margin: 8px 0;"><strong>Type:</strong> {{appointmentType}}</p>
                        <p style="margin: 8px 0;"><strong>Date:</strong> {{scheduledDate}}</p>
                        <p style="margin: 8px 0;"><strong>Time:</strong> {{scheduledTime}}</p>
                        <p style="margin: 8px 0;"><strong>Duration:</strong> {{duration}} minutes</p>
                        <p style="margin: 8px 0;"><strong>Pharmacist:</strong> {{pharmacistName}}</p>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{{confirmationUrl}}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-right: 10px;">
                            Confirm Appointment
                        </a>
                        <a href="{{rescheduleUrl}}" style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                            Reschedule
                        </a>
                    </div>
                    
                    <p style="color: #6b7280; font-size: 14px; margin-top: 30px; text-align: center;">
                        If you need to cancel or reschedule, please contact us as soon as possible.
                    </p>
                </div>
            `,
            smsTemplate: 'Reminder: {{appointmentType}} appointment {{reminderType}} on {{scheduledDate}} at {{scheduledTime}} with {{pharmacistName}}. Confirm: {{confirmationUrl}}',
        });

        // Appointment Confirmed Templates
        this.templates.set('appointment_confirmed', {
            subject: 'Appointment Confirmed: {{appointmentType}}',
            content: 'Your {{appointmentType}} appointment has been confirmed for {{scheduledDate}} at {{scheduledTime}}',
            htmlTemplate: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h2 style="color: #16a34a; margin-top: 0;">✅ Appointment Confirmed</h2>
                        <p style="font-size: 16px; margin: 0;">
                            Your appointment has been successfully confirmed.
                        </p>
                    </div>
                    
                    <div style="background-color: #ffffff; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #1f2937;">Confirmed Appointment Details</h3>
                        <p style="margin: 8px 0;"><strong>Type:</strong> {{appointmentType}}</p>
                        <p style="margin: 8px 0;"><strong>Date:</strong> {{scheduledDate}}</p>
                        <p style="margin: 8px 0;"><strong>Time:</strong> {{scheduledTime}}</p>
                        <p style="margin: 8px 0;"><strong>Duration:</strong> {{duration}} minutes</p>
                        <p style="margin: 8px 0;"><strong>Pharmacist:</strong> {{pharmacistName}}</p>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{{actionUrl}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                            View Appointment
                        </a>
                    </div>
                </div>
            `,
            smsTemplate: 'Confirmed: {{appointmentType}} appointment on {{scheduledDate}} at {{scheduledTime}} with {{pharmacistName}}.',
        });

        // Appointment Rescheduled Templates
        this.templates.set('appointment_rescheduled', {
            subject: 'Appointment Rescheduled: {{appointmentType}}',
            content: 'Your {{appointmentType}} appointment has been rescheduled from {{oldDate}} at {{oldTime}} to {{newDate}} at {{newTime}}',
            htmlTemplate: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h2 style="color: #d97706; margin-top: 0;">📅 Appointment Rescheduled</h2>
                        <p style="font-size: 16px; margin: 0;">
                            Your appointment has been rescheduled to a new date and time.
                        </p>
                    </div>
                    
                    <div style="background-color: #ffffff; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #1f2937;">Updated Appointment Details</h3>
                        <p style="margin: 8px 0;"><strong>Type:</strong> {{appointmentType}}</p>
                        <p style="margin: 8px 0;"><strong>New Date:</strong> {{newDate}}</p>
                        <p style="margin: 8px 0;"><strong>New Time:</strong> {{newTime}}</p>
                        <p style="margin: 8px 0;"><strong>Duration:</strong> {{duration}} minutes</p>
                        <p style="margin: 8px 0;"><strong>Pharmacist:</strong> {{pharmacistName}}</p>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{{actionUrl}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                            View Updated Appointment
                        </a>
                    </div>
                </div>
            `,
            smsTemplate: 'Rescheduled: {{appointmentType}} moved from {{oldDate}} {{oldTime}} to {{newDate}} {{newTime}} with {{pharmacistName}}.',
        });

        // Appointment Cancelled Templates
        this.templates.set('appointment_cancelled', {
            subject: 'Appointment Cancelled: {{appointmentType}}',
            content: 'Your {{appointmentType}} appointment scheduled for {{scheduledDate}} at {{scheduledTime}} has been cancelled',
            htmlTemplate: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h2 style="color: #dc2626; margin-top: 0;">❌ Appointment Cancelled</h2>
                        <p style="font-size: 16px; margin: 0;">
                            Your appointment has been cancelled.
                        </p>
                    </div>
                    
                    <div style="background-color: #ffffff; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #1f2937;">Cancelled Appointment Details</h3>
                        <p style="margin: 8px 0;"><strong>Type:</strong> {{appointmentType}}</p>
                        <p style="margin: 8px 0;"><strong>Date:</strong> {{scheduledDate}}</p>
                        <p style="margin: 8px 0;"><strong>Time:</strong> {{scheduledTime}}</p>
                        <p style="margin: 8px 0;"><strong>Pharmacist:</strong> {{pharmacistName}}</p>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{{actionUrl}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                            Book New Appointment
                        </a>
                    </div>
                </div>
            `,
            smsTemplate: 'Cancelled: {{appointmentType}} appointment on {{scheduledDate}} at {{scheduledTime}}.',
        });

        // Follow-up Task Assigned Templates
        this.templates.set('followup_task_assigned', {
            subject: 'New Follow-up Task Assigned: {{taskTitle}}',
            content: 'You have been assigned a {{priority}} priority follow-up task for patient {{patientName}}',
            htmlTemplate: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h2 style="color: #2563eb; margin-top: 0;">📋 New Follow-up Task</h2>
                        <p style="font-size: 16px; margin: 0;">
                            You have been assigned a new follow-up task.
                        </p>
                    </div>
                    
                    <div style="background-color: #ffffff; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #1f2937;">Task Details</h3>
                        <p style="margin: 8px 0;"><strong>Title:</strong> {{taskTitle}}</p>
                        <p style="margin: 8px 0;"><strong>Type:</strong> {{taskType}}</p>
                        <p style="margin: 8px 0;"><strong>Patient:</strong> {{patientName}}</p>
                        <p style="margin: 8px 0;"><strong>Priority:</strong> {{priority}}</p>
                        <p style="margin: 8px 0;"><strong>Due Date:</strong> {{dueDate}}</p>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{{actionUrl}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                            View Task Details
                        </a>
                    </div>
                </div>
            `,
            smsTemplate: 'New {{priority}} priority follow-up task assigned for patient {{patientName}}. Due: {{dueDate}}',
        });

        // Follow-up Task Overdue Templates
        this.templates.set('followup_task_overdue', {
            subject: 'Follow-up Task Overdue: {{taskTitle}}',
            content: 'Follow-up task for patient {{patientName}} is {{daysOverdue}} day(s) overdue',
            htmlTemplate: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h2 style="color: #dc2626; margin-top: 0;">⚠️ Task Overdue</h2>
                        <p style="font-size: 16px; margin: 0;">
                            A follow-up task is overdue and requires immediate attention.
                        </p>
                    </div>
                    
                    <div style="background-color: #ffffff; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #1f2937;">Overdue Task Details</h3>
                        <p style="margin: 8px 0;"><strong>Title:</strong> {{taskTitle}}</p>
                        <p style="margin: 8px 0;"><strong>Patient:</strong> {{patientName}}</p>
                        <p style="margin: 8px 0;"><strong>Days Overdue:</strong> {{daysOverdue}}</p>
                        <p style="margin: 8px 0;"><strong>Due Date:</strong> {{dueDate}}</p>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{{actionUrl}}" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                            Complete Task Now
                        </a>
                    </div>
                </div>
            `,
            smsTemplate: 'OVERDUE: Follow-up task for {{patientName}} is {{daysOverdue}} days overdue. Please complete immediately.',
        });

        // Medication Refill Due Templates
        this.templates.set('medication_refill_due', {
            subject: 'Medication Refill Due: {{medicationName}}',
            content: 'Your {{medicationName}} prescription will need a refill in {{daysUntilDue}} day(s)',
            htmlTemplate: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h2 style="color: #d97706; margin-top: 0;">💊 Medication Refill Due</h2>
                        <p style="font-size: 16px; margin: 0;">
                            Hi <strong>{{patientName}}</strong>, your medication refill is due soon.
                        </p>
                    </div>
                    
                    <div style="background-color: #ffffff; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #1f2937;">Refill Details</h3>
                        <p style="margin: 8px 0;"><strong>Medication:</strong> {{medicationName}}</p>
                        <p style="margin: 8px 0;"><strong>Days Until Due:</strong> {{daysUntilDue}}</p>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{{actionUrl}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                            Request Refill
                        </a>
                    </div>
                </div>
            `,
            smsTemplate: 'Refill reminder: {{medicationName}} needs refill in {{daysUntilDue}} days. Contact pharmacy to refill.',
        });

        // Adherence Check Reminder Templates
        this.templates.set('adherence_check_reminder', {
            subject: 'Medication Adherence Check: {{medicationName}}',
            content: 'Please confirm that you are taking your {{medicationName}} as prescribed',
            htmlTemplate: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h2 style="color: #2563eb; margin-top: 0;">💊 Medication Adherence Check</h2>
                        <p style="font-size: 16px; margin: 0;">
                            Hi <strong>{{patientName}}</strong>, we want to check on your medication adherence.
                        </p>
                    </div>
                    
                    <div style="background-color: #ffffff; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #1f2937;">Medication Check</h3>
                        <p style="margin: 8px 0;"><strong>Medication:</strong> {{medicationName}}</p>
                        <p style="margin: 8px 0;">Please confirm that you are taking this medication as prescribed by your healthcare provider.</p>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{{actionUrl}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                            Confirm Adherence
                        </a>
                    </div>
                </div>
            `,
            smsTemplate: 'Adherence check: Are you taking {{medicationName}} as prescribed? Reply YES/NO or contact pharmacy.',
        });
    }

    /**
     * Get default template for unknown types
     */
    private getDefaultTemplate(variables: TemplateVariables): NotificationTemplate {
        return {
            subject: variables.title || 'PharmacyCopilot Notification',
            content: variables.content || 'You have a new notification from PharmacyCopilot',
            htmlTemplate: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px;">
                        <h2 style="color: #2563eb; margin-top: 0;">PharmacyCopilot Notification</h2>
                        <p style="margin: 0; color: #4b5563;">
                            ${variables.content || 'You have a new notification from PharmacyCopilot'}
                        </p>
                    </div>
                </div>
            `,
            smsTemplate: variables.content || 'PharmacyCopilot notification',
        };
    }

    /**
     * Get template variables from notification data
     */
    static getTemplateVariables(type: string, data: INotificationData, additionalVars: TemplateVariables = {}): TemplateVariables {
        const baseVars = {
            actionUrl: data.actionUrl || '#',
            timestamp: new Date().toLocaleString(),
            ...additionalVars,
        };

        // Add type-specific variables
        switch (type) {
            case 'new_message':
            case 'mention':
            case 'urgent_message':
                return {
                    ...baseVars,
                    conversationId: data.conversationId?.toString(),
                    messageId: data.messageId?.toString(),
                    senderId: data.senderId?.toString(),
                    ...data.metadata,
                };

            case 'patient_query':
                return {
                    ...baseVars,
                    patientId: data.patientId?.toString(),
                    conversationId: data.conversationId?.toString(),
                    queryTime: new Date().toLocaleString(),
                    ...data.metadata,
                };

            case 'clinical_alert':
                return {
                    ...baseVars,
                    patientId: data.patientId?.toString(),
                    alertTime: new Date().toLocaleString(),
                    ...data.metadata,
                };

            case 'therapy_update':
                return {
                    ...baseVars,
                    patientId: data.patientId?.toString(),
                    updateTime: new Date().toLocaleString(),
                    ...data.metadata,
                };

            case 'file_shared':
                return {
                    ...baseVars,
                    conversationId: data.conversationId?.toString(),
                    senderId: data.senderId?.toString(),
                    ...data.metadata,
                };

            case 'appointment_reminder':
            case 'appointment_confirmed':
            case 'appointment_rescheduled':
            case 'appointment_cancelled':
                return {
                    ...baseVars,
                    appointmentId: data.appointmentId?.toString(),
                    patientId: data.patientId?.toString(),
                    pharmacistId: data.pharmacistId?.toString(),
                    scheduledTime: data.scheduledTime,
                    ...data.metadata,
                };

            case 'followup_task_assigned':
            case 'followup_task_overdue':
                return {
                    ...baseVars,
                    followUpTaskId: data.followUpTaskId?.toString(),
                    patientId: data.patientId?.toString(),
                    pharmacistId: data.pharmacistId?.toString(),
                    priority: data.priority,
                    ...data.metadata,
                };

            case 'medication_refill_due':
            case 'adherence_check_reminder':
                return {
                    ...baseVars,
                    patientId: data.patientId?.toString(),
                    medicationName: data.medicationName,
                    ...data.metadata,
                };

            default:
                return {
                    ...baseVars,
                    ...data.metadata,
                };
        }
    }
}

export const notificationTemplateService = new NotificationTemplateService();