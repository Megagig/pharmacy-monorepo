import WorkspaceStatsService from './WorkspaceStatsService';
import Workplace, { IWorkplace } from '../models/Workplace';
import User from '../models/User';
import Subscription from '../models/Subscription';
import SubscriptionPlan from '../models/SubscriptionPlan';
import { getWorkspaceUsageStats } from '../middlewares/usageLimits';
import emailService from '../utils/emailService';
import logger from '../utils/logger';

export interface UsageAlert {
    workspaceId: string;
    workspaceName: string;
    resource: string;
    currentUsage: number;
    limit: number;
    percentage: number;
    severity: 'warning' | 'critical';
    alertType: 'approaching_limit' | 'limit_exceeded';
}

export interface AlertNotificationData {
    workspace: IWorkplace;
    alerts: UsageAlert[];
    ownerEmail: string;
    ownerName: string;
    planName: string;
}

export class UsageAlertService {
    /**
     * Check all workspaces for usage alerts and send notifications
     */
    async checkAndSendUsageAlerts(): Promise<void> {
        try {
            logger.info('Starting usage alert check for all workspaces');

            const workspaces = await Workplace.find({
                subscriptionStatus: { $in: ['trial', 'active'] }
            }).populate('ownerId currentPlanId currentSubscriptionId');

            let totalAlerts = 0;
            let notificationsSent = 0;

            for (const workspace of workspaces) {
                try {
                    const alerts = await this.checkWorkspaceUsageAlerts(workspace);

                    if (alerts.length > 0) {
                        totalAlerts += alerts.length;

                        const notificationSent = await this.sendUsageAlertNotification(workspace, alerts);
                        if (notificationSent) {
                            notificationsSent++;
                        }
                    }
                } catch (error) {
                    logger.error(`Error checking alerts for workspace ${workspace._id}:`, error);
                }
            }

            logger.info(`Usage alert check completed: ${totalAlerts} alerts found, ${notificationsSent} notifications sent`);

        } catch (error) {
            logger.error('Error in usage alert check:', error);
            throw error;
        }
    }

    /**
     * Check usage alerts for a specific workspace
     */
    async checkWorkspaceUsageAlerts(workspace: IWorkplace): Promise<UsageAlert[]> {
        try {
            // Get subscription and plan details
            const subscription = await Subscription.findById(workspace.currentSubscriptionId);
            const plan = await SubscriptionPlan.findById(workspace.currentPlanId);

            if (!subscription || !plan) {
                logger.warn(`Missing subscription or plan for workspace ${workspace._id}`);
                return [];
            }

            // Convert plan features to limits format
            const planLimits = {
                patients: plan.features.patientLimit,
                users: plan.features.teamSize,
                storage: null, // Not defined in current model
                apiCalls: null // Not defined in current model
            };

            // Get usage statistics
            const usageStats = await getWorkspaceUsageStats(workspace, planLimits);

            const alerts: UsageAlert[] = [];

            // Check each resource for alerts
            Object.entries(usageStats).forEach(([resource, stats]: [string, any]) => {
                if (stats.isAtLimit) {
                    alerts.push({
                        workspaceId: workspace._id.toString(),
                        workspaceName: workspace.name,
                        resource,
                        currentUsage: stats.currentUsage,
                        limit: stats.limit,
                        percentage: Math.round((stats.currentUsage / stats.limit) * 100),
                        severity: 'critical',
                        alertType: 'limit_exceeded'
                    });
                } else if (stats.isAtWarning) {
                    alerts.push({
                        workspaceId: workspace._id.toString(),
                        workspaceName: workspace.name,
                        resource,
                        currentUsage: stats.currentUsage,
                        limit: stats.limit,
                        percentage: Math.round((stats.currentUsage / stats.limit) * 100),
                        severity: 'warning',
                        alertType: 'approaching_limit'
                    });
                }
            });

            return alerts;

        } catch (error) {
            logger.error(`Error checking usage alerts for workspace ${workspace._id}:`, error);
            return [];
        }
    }

    /**
     * Send usage alert notification to workspace owner
     */
    async sendUsageAlertNotification(workspace: IWorkplace, alerts: UsageAlert[]): Promise<boolean> {
        try {
            // Get workspace owner details
            const owner = await User.findById(workspace.ownerId);
            if (!owner) {
                logger.warn(`Owner not found for workspace ${workspace._id}`);
                return false;
            }

            // Get plan details
            const plan = await SubscriptionPlan.findById(workspace.currentPlanId);
            const planName = plan?.name || 'Unknown Plan';

            // Prepare notification data
            const notificationData: AlertNotificationData = {
                workspace,
                alerts,
                ownerEmail: owner.email,
                ownerName: `${owner.firstName} ${owner.lastName}`,
                planName
            };

            // Determine email template based on alert severity
            const hasCriticalAlerts = alerts.some(alert => alert.severity === 'critical');
            const templateType = hasCriticalAlerts ? 'usage_limit_exceeded' : 'usage_warning';

            // Send email notification
            await this.sendUsageAlertEmail(notificationData, templateType);

            logger.info(`Usage alert notification sent to ${owner.email} for workspace ${workspace.name}`);
            return true;

        } catch (error) {
            logger.error(`Error sending usage alert notification for workspace ${workspace._id}:`, error);
            return false;
        }
    }

    /**
     * Send usage alert email
     */
    private async sendUsageAlertEmail(
        data: AlertNotificationData,
        templateType: 'usage_warning' | 'usage_limit_exceeded'
    ): Promise<void> {
        const { workspace, alerts, ownerEmail, ownerName, planName } = data;

        const criticalAlerts = alerts.filter(alert => alert.severity === 'critical');
        const warningAlerts = alerts.filter(alert => alert.severity === 'warning');

        const subject = templateType === 'usage_limit_exceeded'
            ? `🚨 Usage Limits Exceeded - ${workspace.name}`
            : `⚠️ Usage Warning - ${workspace.name}`;

        // Generate alert summary
        const alertSummary = alerts.map(alert => {
            const icon = alert.severity === 'critical' ? '🚨' : '⚠️';
            return `${icon} ${alert.resource}: ${alert.currentUsage}/${alert.limit} (${alert.percentage}%)`;
        }).join('\n');

        // Generate recommendations
        const recommendations = this.generateAlertRecommendations(alerts);

        const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${templateType === 'usage_limit_exceeded' ? '#dc3545' : '#ffc107'}; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">${templateType === 'usage_limit_exceeded' ? '🚨 Usage Limits Exceeded' : '⚠️ Usage Warning'}</h1>
        </div>
        
        <div style="padding: 20px; background: #f8f9fa;">
          <p>Hello ${ownerName},</p>
          
          <p>We're writing to inform you about usage alerts for your workspace <strong>${workspace.name}</strong>.</p>
          
          <div style="background: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3>Current Plan: ${planName}</h3>
            
            <h4>Usage Alerts:</h4>
            <div style="font-family: monospace; background: #f1f3f4; padding: 10px; border-radius: 3px;">
              ${alertSummary.replace(/\n/g, '<br>')}
            </div>
          </div>

          ${criticalAlerts.length > 0 ? `
            <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h4 style="color: #721c24; margin-top: 0;">⚠️ Immediate Action Required</h4>
              <p style="color: #721c24;">Some of your usage limits have been exceeded. This may affect your ability to create new resources.</p>
            </div>
          ` : ''}

          <div style="background: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h4>Recommendations:</h4>
            <ul>
              ${recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/subscriptions" 
               style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Upgrade Your Plan
            </a>
          </div>

          <p>If you have any questions, please don't hesitate to contact our support team.</p>
          
          <p>Best regards,<br>The PharmacyCopilot Team</p>
        </div>
        
        <div style="background: #6c757d; color: white; padding: 10px; text-align: center; font-size: 12px;">
          <p>This is an automated notification. Please do not reply to this email.</p>
        </div>
      </div>
    `;

        await emailService.sendEmail({
            to: ownerEmail,
            subject,
            text: `Usage Alert for ${workspace.name}`, // Plain text version
            html: emailContent
        });
    }

    /**
     * Generate recommendations based on alerts
     */
    private generateAlertRecommendations(alerts: UsageAlert[]): string[] {
        const recommendations: string[] = [];

        const criticalAlerts = alerts.filter(alert => alert.severity === 'critical');
        const warningAlerts = alerts.filter(alert => alert.severity === 'warning');

        if (criticalAlerts.length > 0) {
            recommendations.push('Upgrade your plan immediately to restore full functionality');
            recommendations.push('Consider archiving or removing unused data to free up space');
        }

        if (warningAlerts.length > 0) {
            recommendations.push('Plan an upgrade before reaching your limits');
            recommendations.push('Review your usage patterns to optimize resource consumption');
        }

        // Resource-specific recommendations
        const patientAlerts = alerts.filter(alert => alert.resource === 'patients');
        const userAlerts = alerts.filter(alert => alert.resource === 'users');
        const storageAlerts = alerts.filter(alert => alert.resource === 'storage');

        if (patientAlerts.length > 0) {
            recommendations.push('Consider archiving inactive patient records');
        }

        if (userAlerts.length > 0) {
            recommendations.push('Review team member access and remove inactive users');
        }

        if (storageAlerts.length > 0) {
            recommendations.push('Clean up old files and documents to free up storage space');
        }

        return recommendations;
    }

    /**
     * Get usage alert summary for a workspace
     */
    async getWorkspaceAlertSummary(workspaceId: string): Promise<{
        totalAlerts: number;
        criticalAlerts: number;
        warningAlerts: number;
        alerts: UsageAlert[];
    }> {
        try {
            const workspace = await Workplace.findById(workspaceId);
            if (!workspace) {
                throw new Error('Workspace not found');
            }

            const alerts = await this.checkWorkspaceUsageAlerts(workspace);

            return {
                totalAlerts: alerts.length,
                criticalAlerts: alerts.filter(alert => alert.severity === 'critical').length,
                warningAlerts: alerts.filter(alert => alert.severity === 'warning').length,
                alerts
            };

        } catch (error) {
            logger.error(`Error getting alert summary for workspace ${workspaceId}:`, error);
            throw error;
        }
    }

    /**
     * Check if workspace should receive alert notifications
     * (to avoid spam - only send once per day for warnings, immediately for critical)
     */
    private shouldSendAlert(workspace: IWorkplace, alerts: UsageAlert[]): boolean {
        const hasCriticalAlerts = alerts.some(alert => alert.severity === 'critical');

        // Always send critical alerts immediately
        if (hasCriticalAlerts) {
            return true;
        }

        // For warning alerts, check if we've sent one recently
        // This would require storing last alert timestamps in the database
        // For now, we'll send all warnings
        return true;
    }
}

export default new UsageAlertService();