import { Request, Response } from 'express';
import { emailDeliveryService } from '../services/emailDeliveryService';
import crypto from 'crypto';
import mongoose from 'mongoose';

export class EmailWebhookController {
    /**
     * Handle Resend webhook events
     */
    async handleResendWebhook(req: Request, res: Response): Promise<void> {
        try {
            // Verify webhook signature if configured
            if (process.env.RESEND_WEBHOOK_SECRET) {
                const signature = req.headers['resend-signature'] as string;
                if (!this.verifyResendSignature(req.body, signature)) {
                    res.status(401).json({ error: 'Invalid signature' });
                    return;
                }
            }

            const { type, data } = req.body;

            switch (type) {
                case 'email.sent':
                    await this.handleEmailSent(data);
                    break;
                case 'email.delivered':
                    await this.handleEmailDelivered(data);
                    break;
                case 'email.bounced':
                    await this.handleEmailBounced(data);
                    break;
                case 'email.complained':
                    await this.handleEmailComplained(data);
                    break;
                default:
                    console.log(`Unhandled Resend webhook event: ${type}`);
            }

            res.status(200).json({ received: true });
        } catch (error) {
            console.error('Error handling Resend webhook:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Handle generic email webhook (for other providers)
     */
    async handleGenericWebhook(req: Request, res: Response): Promise<void> {
        try {
            const { messageId, status, metadata } = req.body;

            if (!messageId || !status) {
                res.status(400).json({ error: 'Missing required fields' });
                return;
            }

            await emailDeliveryService.updateDeliveryStatus(messageId, status, metadata);
            res.status(200).json({ received: true });
        } catch (error) {
            console.error('Error handling generic email webhook:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get email delivery statistics
     */
    async getDeliveryStats(req: Request, res: Response): Promise<void> {
        try {
            const { workspaceId } = req.query;
            const objectId = workspaceId ? new mongoose.Types.ObjectId(workspaceId as string) : undefined;
            const stats = await emailDeliveryService.getDeliveryStats(objectId);

            res.json({
                success: true,
                data: stats,
            });
        } catch (error) {
            console.error('Error getting delivery stats:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get delivery statistics',
            });
        }
    }

    /**
     * Get email delivery history
     */
    async getDeliveryHistory(req: Request, res: Response): Promise<void> {
        try {
            const {
                workspaceId,
                userId,
                status,
                templateName,
                limit = '50',
                offset = '0',
            } = req.query;

            const workspaceObjectId = workspaceId ? new mongoose.Types.ObjectId(workspaceId as string) : undefined;
            const userObjectId = userId ? new mongoose.Types.ObjectId(userId as string) : undefined;

            const history = await emailDeliveryService.getDeliveryHistory({
                workspaceId: workspaceObjectId,
                userId: userObjectId,
                status: status as string,
                templateName: templateName as string,
                limit: parseInt(limit as string),
                offset: parseInt(offset as string),
            });

            res.json({
                success: true,
                data: history,
            });
        } catch (error) {
            console.error('Error getting delivery history:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get delivery history',
            });
        }
    }

    /**
     * Manually retry failed email
     */
    async retryFailedEmail(req: Request, res: Response): Promise<void> {
        try {
            const { deliveryId } = req.params;

            // This would need to be implemented in the email delivery service
            // For now, just trigger the general retry process
            await emailDeliveryService.retryFailedDeliveries();

            res.json({
                success: true,
                message: 'Retry process initiated',
            });
        } catch (error) {
            console.error('Error retrying failed email:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retry email',
            });
        }
    }

    /**
     * Handle email sent event
     */
    private async handleEmailSent(data: any): Promise<void> {
        const { email_id: messageId } = data;
        if (messageId) {
            await emailDeliveryService.updateDeliveryStatus(messageId, 'delivered');
        }
    }

    /**
     * Handle email delivered event
     */
    private async handleEmailDelivered(data: any): Promise<void> {
        const { email_id: messageId } = data;
        if (messageId) {
            await emailDeliveryService.updateDeliveryStatus(messageId, 'delivered', {
                deliveredAt: new Date(),
                providerData: data,
            });
        }
    }

    /**
     * Handle email bounced event
     */
    private async handleEmailBounced(data: any): Promise<void> {
        const { email_id: messageId, bounce } = data;
        if (messageId) {
            await emailDeliveryService.updateDeliveryStatus(messageId, 'bounced', {
                bounceReason: bounce?.reason,
                bounceType: bounce?.type,
                providerData: data,
            });
        }
    }

    /**
     * Handle email complained event (spam complaint)
     */
    private async handleEmailComplained(data: any): Promise<void> {
        const { email_id: messageId } = data;
        if (messageId) {
            await emailDeliveryService.updateDeliveryStatus(messageId, 'complained', {
                complaintDate: new Date(),
                providerData: data,
            });
        }
    }

    /**
     * Verify Resend webhook signature
     */
    private verifyResendSignature(payload: any, signature: string): boolean {
        try {
            const secret = process.env.RESEND_WEBHOOK_SECRET;
            if (!secret) return true; // Skip verification if no secret configured

            const expectedSignature = crypto
                .createHmac('sha256', secret)
                .update(JSON.stringify(payload))
                .digest('hex');

            return crypto.timingSafeEqual(
                Buffer.from(signature),
                Buffer.from(expectedSignature)
            );
        } catch (error) {
            console.error('Error verifying Resend signature:', error);
            return false;
        }
    }
}

export const emailWebhookController = new EmailWebhookController();