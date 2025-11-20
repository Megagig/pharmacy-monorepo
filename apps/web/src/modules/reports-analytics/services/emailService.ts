// Email Service - Handle email delivery for scheduled reports
import { ScheduleRecipient, ExportResult, ReportSchedule } from '../types/exports';

export interface EmailTemplate {
    subject: string;
    body: string;
    attachmentName?: string;
}

export interface EmailDeliveryResult {
    recipientAddress: string;
    status: 'delivered' | 'failed';
    deliveredAt?: Date;
    error?: string;
    messageId?: string;
}

export class EmailService {
    private static readonly DEFAULT_TEMPLATES = {
        reportDelivery: {
            subject: '{{reportTitle}} - {{date}}',
            body: `
Dear {{recipientName}},

Please find attached the {{reportTitle}} report generated on {{date}}.

Report Details:
- Report Type: {{reportType}}
- Generated At: {{generatedAt}}
- File Format: {{format}}
- File Size: {{fileSize}}

{{#if filters}}
Applied Filters:
{{#each filters}}
- {{@key}}: {{this}}
{{/each}}
{{/if}}

This report was automatically generated and delivered as part of your scheduled report subscription.

If you have any questions or need assistance, please contact our support team.

Best regards,
Pharmacy Care Platform
            `,
        },
        reportError: {
            subject: 'Report Generation Failed - {{reportTitle}}',
            body: `
Dear {{recipientName}},

We encountered an issue while generating your scheduled {{reportTitle}} report.

Error Details:
- Report Type: {{reportType}}
- Scheduled Time: {{scheduledTime}}
- Error: {{error}}
- Attempt: {{retryCount}} of {{maxRetries}}

{{#if willRetry}}
We will automatically retry generating this report. You will receive another notification if the issue persists.
{{else}}
Please contact our support team for assistance with this issue.
{{/if}}

We apologize for any inconvenience.

Best regards,
Pharmacy Care Platform
            `,
        },
    };

    /**
     * Send report via email to recipients
     */
    static async sendReport(
        schedule: ReportSchedule,
        exportResult: ExportResult,
        recipients: ScheduleRecipient[]
    ): Promise<EmailDeliveryResult[]> {
        const results: EmailDeliveryResult[] = [];

        for (const recipient of recipients) {
            if (recipient.type !== 'email') continue;

            try {
                const result = await this.sendSingleEmail(schedule, exportResult, recipient);
                results.push(result);
            } catch (error) {
                results.push({
                    recipientAddress: recipient.address,
                    status: 'failed',
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }

        return results;
    }

    /**
     * Send email to a single recipient
     */
    private static async sendSingleEmail(
        schedule: ReportSchedule,
        exportResult: ExportResult,
        recipient: ScheduleRecipient
    ): Promise<EmailDeliveryResult> {
        const template = this.prepareEmailTemplate(schedule, exportResult, recipient);

        // In a real implementation, this would use a proper email service
        // like SendGrid, AWS SES, or similar
        const emailData = {
            to: recipient.address,
            from: 'reports@pharmacycare.com', // TODO: Make configurable
            subject: template.subject,
            html: this.convertToHtml(template.body),
            text: template.body,
            attachments: exportResult.downloadUrl ? [{
                filename: template.attachmentName || exportResult.filename,
                content: await this.downloadFile(exportResult.downloadUrl),
                contentType: this.getMimeType(exportResult.format),
            }] : [],
        };

        // Simulate email sending (replace with actual email service)

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Simulate success/failure (90% success rate)
        const success = Math.random() > 0.1;

        if (success) {
            return {
                recipientAddress: recipient.address,
                status: 'delivered',
                deliveredAt: new Date(),
                messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            };
        } else {
            throw new Error('Email delivery failed');
        }
    }

    /**
     * Send error notification email
     */
    static async sendErrorNotification(
        schedule: ReportSchedule,
        error: string,
        retryCount: number,
        maxRetries: number
    ): Promise<EmailDeliveryResult[]> {
        const results: EmailDeliveryResult[] = [];
        const emailRecipients = schedule.recipients.filter(r => r.type === 'email');

        for (const recipient of emailRecipients) {
            try {
                const template = this.prepareErrorTemplate(schedule, error, retryCount, maxRetries, recipient);

                const emailData = {
                    to: recipient.address,
                    from: 'alerts@pharmacycare.com',
                    subject: template.subject,
                    html: this.convertToHtml(template.body),
                    text: template.body,
                };

                // Simulate email sending

                await new Promise(resolve => setTimeout(resolve, 500));

                results.push({
                    recipientAddress: recipient.address,
                    status: 'delivered',
                    deliveredAt: new Date(),
                    messageId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                });
            } catch (emailError) {
                results.push({
                    recipientAddress: recipient.address,
                    status: 'failed',
                    error: emailError instanceof Error ? emailError.message : 'Unknown error',
                });
            }
        }

        return results;
    }

    /**
     * Prepare email template with data substitution
     */
    private static prepareEmailTemplate(
        schedule: ReportSchedule,
        exportResult: ExportResult,
        recipient: ScheduleRecipient
    ): EmailTemplate {
        const baseTemplate = this.DEFAULT_TEMPLATES.reportDelivery;

        const templateData = {
            reportTitle: schedule.name,
            reportType: schedule.reportType.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            recipientName: recipient.name || recipient.address.split('@')[0],
            date: new Date().toLocaleDateString(),
            generatedAt: exportResult.createdAt.toLocaleString(),
            format: exportResult.format.toUpperCase(),
            fileSize: this.formatFileSize(exportResult.fileSize),
            filters: this.formatFilters(schedule.filters),
        };

        const subject = recipient.options?.subject ||
            this.substituteTemplate(baseTemplate.subject, templateData);

        const body = recipient.options?.body ||
            this.substituteTemplate(baseTemplate.body, templateData);

        const attachmentName = recipient.options?.attachmentName || exportResult.filename;

        return { subject, body, attachmentName };
    }

    /**
     * Prepare error notification template
     */
    private static prepareErrorTemplate(
        schedule: ReportSchedule,
        error: string,
        retryCount: number,
        maxRetries: number,
        recipient: ScheduleRecipient
    ): EmailTemplate {
        const template = this.DEFAULT_TEMPLATES.reportError;

        const templateData = {
            reportTitle: schedule.name,
            reportType: schedule.reportType.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            recipientName: recipient.name || recipient.address.split('@')[0],
            scheduledTime: schedule.nextRun?.toLocaleString() || 'Unknown',
            error,
            retryCount: retryCount.toString(),
            maxRetries: maxRetries.toString(),
            willRetry: retryCount < maxRetries,
        };

        const subject = this.substituteTemplate(template.subject, templateData);
        const body = this.substituteTemplate(template.body, templateData);

        return { subject, body };
    }

    /**
     * Simple template substitution (replace with proper templating engine in production)
     */
    private static substituteTemplate(template: string, data: Record<string, any>): string {
        let result = template;

        // Simple variable substitution
        Object.entries(data).forEach(([key, value]) => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            result = result.replace(regex, String(value || ''));
        });

        // Handle conditional blocks (simplified)
        result = result.replace(/{{#if (\w+)}}([\s\S]*?){{\/if}}/g, (match, condition, content) => {
            return data[condition] ? content : '';
        });

        // Handle each loops (simplified)
        result = result.replace(/{{#each (\w+)}}([\s\S]*?){{\/each}}/g, (match, arrayName, content) => {
            const array = data[arrayName];
            if (!Array.isArray(array) && typeof array !== 'object') return '';

            if (Array.isArray(array)) {
                return array.map(item => content.replace(/{{this}}/g, String(item))).join('');
            } else {
                return Object.entries(array).map(([key, value]) =>
                    content.replace(/{{@key}}/g, key).replace(/{{this}}/g, String(value))
                ).join('');
            }
        });

        return result;
    }

    /**
     * Convert plain text to HTML
     */
    private static convertToHtml(text: string): string {
        return text
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/^- (.+)$/gm, '<li>$1</li>')
            .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    }

    /**
     * Format file size for display
     */
    private static formatFileSize(bytes?: number): string {
        if (!bytes) return 'Unknown';

        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    /**
     * Format filters for display
     */
    private static formatFilters(filters: Record<string, any>): Record<string, string> {
        const formatted: Record<string, string> = {};

        Object.entries(filters).forEach(([key, value]) => {
            if (value && value !== 'all') {
                const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                formatted[formattedKey] = typeof value === 'object' ? JSON.stringify(value) : String(value);
            }
        });

        return formatted;
    }

    /**
     * Get MIME type for export format
     */
    private static getMimeType(format: string): string {
        const mimeTypes: Record<string, string> = {
            pdf: 'application/pdf',
            csv: 'text/csv',
            excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            json: 'application/json',
            png: 'image/png',
            svg: 'image/svg+xml',
        };

        return mimeTypes[format] || 'application/octet-stream';
    }

    /**
     * Download file from URL (for attachments)
     */
    private static async downloadFile(url: string): Promise<Buffer> {
        // In a real implementation, this would fetch the file
        // For now, return empty buffer
        return Buffer.from('');
    }

    /**
     * Validate email address
     */
    static validateEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Test email configuration
     */
    static async testEmailConfiguration(): Promise<{ success: boolean; error?: string }> {
        try {
            // In a real implementation, this would test the email service configuration

            await new Promise(resolve => setTimeout(resolve, 1000));

            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Get email delivery statistics
     */
    static getDeliveryStats(deliveryResults: EmailDeliveryResult[]): {
        total: number;
        delivered: number;
        failed: number;
        deliveryRate: number;
    } {
        const total = deliveryResults.length;
        const delivered = deliveryResults.filter(r => r.status === 'delivered').length;
        const failed = total - delivered;
        const deliveryRate = total > 0 ? (delivered / total) * 100 : 0;

        return { total, delivered, failed, deliveryRate };
    }
}