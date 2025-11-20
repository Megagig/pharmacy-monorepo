import { EmailDelivery, IEmailDelivery } from '../models/EmailDelivery';
import { emailService } from '../utils/emailService';
import mongoose from 'mongoose';

interface EmailDeliveryOptions {
    to: string;
    subject: string;
    templateName?: string;
    workspaceId?: mongoose.Types.ObjectId;
    userId?: mongoose.Types.ObjectId;
    relatedEntity?: {
        type: 'invitation' | 'subscription' | 'user' | 'workspace';
        id: mongoose.Types.ObjectId;
    };
    metadata?: Record<string, any>;
    maxRetries?: number;
}

export interface EmailDeliveryResult {
    success: boolean;
    messageId?: string;
    provider?: string;
    error?: string;
    deliveryRecord?: IEmailDelivery;
}

export class EmailDeliveryService {
    private emailService = emailService;

    /**
     * Send email with delivery tracking
     */
    async sendTrackedEmail(
        options: EmailDeliveryOptions,
        emailContent: { html: string; text?: string }
    ): Promise<EmailDeliveryResult> {
        // Create delivery record
        const deliveryRecord = new EmailDelivery({
            messageId: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            provider: 'pending',
            to: options.to,
            subject: options.subject,
            templateName: options.templateName,
            workspaceId: options.workspaceId,
            userId: options.userId,
            relatedEntity: options.relatedEntity,
            metadata: options.metadata,
            maxRetries: options.maxRetries || 3,
        });

        try {
            await deliveryRecord.save();

            // Attempt to send email
            const result = await this.emailService.sendEmail({
                to: options.to,
                subject: options.subject,
                html: emailContent.html,
                text: emailContent.text || '',
            });

            if (result.success) {
                // Update delivery record with success
                await deliveryRecord.markAsSent(result.messageId);
                deliveryRecord.provider = (result as any).provider || 'nodemailer';
                await deliveryRecord.save();

                return {
                    success: true,
                    messageId: result.messageId,
                    provider: (result as any).provider || 'nodemailer',
                    deliveryRecord,
                };
            } else {
                // Mark as failed and schedule retry if applicable
                await deliveryRecord.markAsFailed(result.error || 'Unknown error');

                return {
                    success: false,
                    error: result.error,
                    deliveryRecord,
                };
            }
        } catch (error) {
            // Mark as failed
            await deliveryRecord.markAsFailed((error as Error).message);

            return {
                success: false,
                error: (error as Error).message,
                deliveryRecord,
            };
        }
    }

    /**
     * Retry failed email deliveries
     */
    async retryFailedDeliveries(): Promise<void> {
        try {
            const pendingRetries = await EmailDelivery.findPendingRetries();
            console.log(`Found ${pendingRetries.length} emails pending retry`);

            for (const delivery of pendingRetries) {
                try {
                    // Reconstruct email content from metadata if available
                    if (!delivery.metadata?.emailContent) {
                        console.warn(`No email content found for delivery ${delivery._id}, skipping retry`);
                        continue;
                    }

                    const result = await this.emailService.sendEmail({
                        to: delivery.to,
                        subject: delivery.subject,
                        html: delivery.metadata.emailContent.html,
                        text: delivery.metadata.emailContent.text,
                    });

                    if (result.success) {
                        await delivery.markAsSent(result.messageId);
                        delivery.provider = (result as any).provider || 'nodemailer';
                        await delivery.save();
                        console.log(`Successfully retried email delivery ${delivery._id}`);
                    } else {
                        await delivery.markAsFailed(result.error || 'Retry failed');
                        console.error(`Failed to retry email delivery ${delivery._id}:`, result.error);
                    }
                } catch (error) {
                    await delivery.markAsFailed((error as Error).message);
                    console.error(`Error retrying email delivery ${delivery._id}:`, error);
                }
            }
        } catch (error) {
            console.error('Error in retryFailedDeliveries:', error);
        }
    }

    /**
     * Update delivery status from webhook (for Resend)
     */
    async updateDeliveryStatus(
        messageId: string,
        status: 'delivered' | 'bounced' | 'complained',
        metadata?: Record<string, any>
    ): Promise<void> {
        try {
            const delivery = await EmailDelivery.findOne({ messageId });
            if (!delivery) {
                console.warn(`No delivery record found for messageId: ${messageId}`);
                return;
            }

            switch (status) {
                case 'delivered':
                    await delivery.markAsDelivered();
                    break;
                case 'bounced':
                    await delivery.markAsBounced();
                    break;
                case 'complained':
                    await delivery.markAsComplained();
                    break;
            }

            if (metadata) {
                delivery.metadata = { ...delivery.metadata, ...metadata };
                await delivery.save();
            }

            console.log(`Updated delivery status for ${messageId} to ${status}`);
        } catch (error) {
            console.error(`Error updating delivery status for ${messageId}:`, error);
        }
    }

    /**
     * Get delivery statistics
     */
    async getDeliveryStats(workspaceId?: mongoose.Types.ObjectId): Promise<any> {
        try {
            const stats = await EmailDelivery.getDeliveryStats(workspaceId);
            return stats[0] || { total: 0, stats: [] };
        } catch (error) {
            console.error('Error getting delivery stats:', error);
            return { total: 0, stats: [] };
        }
    }

    /**
     * Get delivery history for a workspace or user
     */
    async getDeliveryHistory(
        filters: {
            workspaceId?: mongoose.Types.ObjectId;
            userId?: mongoose.Types.ObjectId;
            status?: string;
            templateName?: string;
            limit?: number;
            offset?: number;
        }
    ): Promise<IEmailDelivery[]> {
        try {
            const query: any = {};

            if (filters.workspaceId) query.workspaceId = filters.workspaceId;
            if (filters.userId) query.userId = filters.userId;
            if (filters.status) query.status = filters.status;
            if (filters.templateName) query.templateName = filters.templateName;

            return await EmailDelivery.find(query)
                .sort({ createdAt: -1 })
                .limit(filters.limit || 50)
                .skip(filters.offset || 0)
                .exec();
        } catch (error) {
            console.error('Error getting delivery history:', error);
            return [];
        }
    }

    /**
     * Clean up old delivery records (called by cron job)
     */
    async cleanupOldRecords(daysOld: number = 90): Promise<void> {
        try {
            const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
            const result = await EmailDelivery.deleteMany({
                createdAt: { $lt: cutoffDate },
                status: { $in: ['delivered', 'failed', 'bounced', 'complained'] },
            });

            console.log(`Cleaned up ${result.deletedCount} old email delivery records`);
        } catch (error) {
            console.error('Error cleaning up old delivery records:', error);
        }
    }

    /**
     * Check for bounced emails and update user preferences
     */
    async handleBouncedEmails(): Promise<void> {
        try {
            const bouncedEmails = await EmailDelivery.find({
                status: 'bounced',
                'metadata.bounceHandled': { $ne: true },
            });

            for (const delivery of bouncedEmails) {
                // Here you could implement logic to:
                // 1. Mark user email as invalid
                // 2. Disable email notifications for the user
                // 3. Send notification to workspace admin

                console.log(`Handling bounced email for: ${delivery.to}`);

                // Mark as handled
                delivery.metadata = { ...delivery.metadata, bounceHandled: true };
                await delivery.save();
            }
        } catch (error) {
            console.error('Error handling bounced emails:', error);
        }
    }

    /**
     * Send email with template and tracking
     */
    async sendTemplateEmail(
        templateName: string,
        templateVariables: Record<string, any>,
        options: EmailDeliveryOptions
    ): Promise<EmailDeliveryResult> {
        try {
            // Load template
            const template = await this.emailService.loadTemplate(templateName, templateVariables);

            // Store email content in metadata for potential retries
            const enhancedOptions = {
                ...options,
                templateName,
                metadata: {
                    ...options.metadata,
                    templateVariables,
                    emailContent: {
                        html: template.html,
                        text: template.text,
                    },
                },
            };

            return await this.sendTrackedEmail(enhancedOptions, {
                html: template.html,
                text: template.text,
            });
        } catch (error) {
            console.error(`Error sending template email ${templateName}:`, error);
            return {
                success: false,
                error: (error as Error).message,
            };
        }
    }
}

// Export singleton instance
export const emailDeliveryService = new EmailDeliveryService();