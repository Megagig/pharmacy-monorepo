// Email helper utilities for background job notifications
import { sendEmail as sendBasicEmail } from './email';

interface EmailTemplateOptions {
    to: string;
    subject: string;
    template: string;
    data?: Record<string, any>;
    attachments?: Array<{
        filename: string;
        path: string;
    }>;
}

interface SendEmailOptions {
    to: string;
    subject: string;
    template?: string;
    data?: Record<string, any>;
    text?: string;
    html?: string;
    attachments?: Array<{
        filename: string;
        path: string;
    }>;
}

/**
 * Send email with template support for background job notifications
 */
export const sendTemplatedEmail = async (options: SendEmailOptions): Promise<any> => {
    try {
        let htmlContent: string | undefined;
        let textContent: string | undefined;

        // If template is provided, generate HTML content
        if (options.template) {
            htmlContent = generateEmailTemplate(options.template, options.data || {});
        } else if (options.html) {
            htmlContent = options.html;
        }

        if (options.text) {
            textContent = options.text;
        } else if (options.data) {
            // Generate text content from data if no text provided
            textContent = generateTextContent(options.data);
        }

        const emailOptions = {
            to: options.to,
            subject: options.subject,
            html: htmlContent,
            text: textContent
        };

        return await sendBasicEmail(emailOptions);
    } catch (error) {
        console.error('Failed to send email from emailHelpers:', error);
        throw error;
    }
};

/**
 * Generate HTML email template based on template name
 */
function generateEmailTemplate(template: string, data: Record<string, any>): string {
    const templates: Record<string, string> = {
        'export-ready': `
            <h2>Report Export Ready</h2>
            <p>Your report export is ready for download.</p>
            <div style="margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-radius: 5px;">
                <h3>${data.fileName || 'Report'}</h3>
                <p><strong>Format:</strong> ${data.format || 'PDF'}</p>
                <p><a href="${data.downloadLink || '#'}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Download Report</a></p>
            </div>
            <p>This report was generated automatically by PharmacyCopilot SaaS.</p>
        `,
        'export-failed': `
            <h2>Report Export Failed</h2>
            <p>We encountered an issue while generating your report export.</p>
            <div style="margin: 20px 0; padding: 15px; background-color: #f8d7da; border-radius: 5px;">
                <h3>${data.fileName || 'Report'}</h3>
                <p><strong>Error:</strong> ${data.error || 'Unknown error occurred'}</p>
            </div>
            <p>Please try again or contact support if the problem persists.</p>
        `,
        'scheduled-report': `
            <h2>Scheduled Report</h2>
            <p>Your scheduled report has been generated and is attached.</p>
            <div style="margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-radius: 5px;">
                <h3>${data.reportType || 'Report'}</h3>
                <p><strong>Generated:</strong> ${data.generatedAt || new Date().toLocaleString()}</p>
                <p><strong>Formats:</strong> ${data.formats || 'PDF'}</p>
            </div>
            <p>This report was generated automatically by PharmacyCopilot SaaS.</p>
        `,
        'scheduled-report-failed': `
            <h2>Scheduled Report Failed</h2>
            <p>We encountered an issue while generating your scheduled report.</p>
            <div style="margin: 20px 0; padding: 15px; background-color: #f8d7da; border-radius: 5px;">
                <h3>${data.reportType || 'Report'}</h3>
                <p><strong>Error:</strong> ${data.error || 'Unknown error occurred'}</p>
            </div>
            <p>Please check your report configuration or contact support if the problem persists.</p>
        `
    };

    return templates[template] || `
        <h2>Notification</h2>
        <p>${JSON.stringify(data, null, 2)}</p>
    `;
}

/**
 * Generate plain text content from data
 */
function generateTextContent(data: Record<string, any>): string {
    return Object.entries(data)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
}

/**
 * Send bulk emails to multiple recipients
 */
export const sendBulkEmails = async (recipients: string[], options: Omit<SendEmailOptions, 'to'>): Promise<any[]> => {
    const results: any[] = [];

    for (const recipient of recipients) {
        try {
            const result = await sendTemplatedEmail({
                ...options,
                to: recipient
            });
            results.push({ recipient, success: true, result });
        } catch (error) {
            results.push({
                recipient,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    return results;
};

/**
 * Validate email address format
 */
export const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Sanitize email content to prevent XSS
 */
export const sanitizeEmailContent = (content: string): string => {
    return content
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"')
        .replace(/'/g, '&#39;');
};

/**
 * Simple sendEmail function for backward compatibility
 */
export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
    await sendTemplatedEmail({
        to,
        subject,
        text: body,
    });
}
