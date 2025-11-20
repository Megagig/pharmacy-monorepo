import mongoose from 'mongoose';
import * as cron from 'node-cron';
import Invitation, { IInvitation } from '../models/Invitation';
import Workplace from '../models/Workplace';
import User from '../models/User';
import { emailService } from '../utils/emailService';

interface InvitationAnalytics {
    totalInvitations: number;
    activeInvitations: number;
    expiredInvitations: number;
    usedInvitations: number;
    canceledInvitations: number;
    acceptanceRate: number;
    averageAcceptanceTime: number; // in hours
    invitationsByRole: Record<string, number>;
    invitationsByMonth: Array<{
        month: string;
        count: number;
        accepted: number;
    }>;
}

interface InvitationLimits {
    maxPendingInvites: number;
    currentPendingInvites: number;
    remainingInvites: number;
    canSendMore: boolean;
    upgradeRequired: boolean;
    nextUpgradeLevel?: string;
}

interface InvitationStats {
    workspace?: {
        id: string;
        name: string;
        totalInvitations: number;
        pendingInvitations: number;
        acceptedInvitations: number;
        expiredInvitations: number;
    };
    global?: {
        totalWorkspaces: number;
        totalInvitations: number;
        averageInvitationsPerWorkspace: number;
        globalAcceptanceRate: number;
    };
}

class InvitationCronService {
    private cronJobs: cron.ScheduledTask[] = [];

    /**
     * Start all cron jobs
     */
    start(): void {
        console.log('Starting invitation cron jobs...');

        // Mark expired invitations every hour
        const expiredInvitationsJob = cron.schedule('0 * * * *', async () => {
            console.log('Running expired invitations cleanup...');
            const result = await this.markExpiredInvitations();
            console.log(`Expired invitations cleanup completed:`, result);
        });

        // Send expiry reminders twice daily (9 AM and 6 PM)
        const reminderJob = cron.schedule('0 9,18 * * *', async () => {
            console.log('Sending invitation expiry reminders...');
            const result = await this.sendExpiryReminders();
            console.log(`Expiry reminders completed:`, result);
        });

        // Clean up old invitations daily at 2 AM
        const cleanupJob = cron.schedule('0 2 * * *', async () => {
            console.log('Running old invitations cleanup...');
            const result = await this.cleanupOldInvitations();
            console.log(`Old invitations cleanup completed:`, result);
        });

        // Jobs start automatically

        this.cronJobs = [expiredInvitationsJob, reminderJob, cleanupJob];
        console.log('Invitation cron jobs started successfully');
    }

    /**
     * Stop all cron jobs
     */
    stop(): void {
        console.log('Stopping invitation cron jobs...');
        this.cronJobs.forEach(job => job.stop());
        this.cronJobs = [];
        console.log('Invitation cron jobs stopped');
    }
    /**
     * Mark expired invitations as expired
     * This should be run periodically (e.g., every hour)
     */
    async markExpiredInvitations(): Promise<{
        success: boolean;
        expiredCount: number;
        notificationsSent: number;
        errors: string[];
    }> {
        const errors: string[] = [];
        let notificationsSent = 0;

        try {
            console.log('Starting expired invitations cleanup...');

            // Find all active invitations that have expired
            const expiredInvitations = await Invitation.find({
                status: 'active',
                expiresAt: { $lt: new Date() }
            }).populate('invitedBy', 'firstName lastName email');

            if (expiredInvitations.length === 0) {
                console.log('No expired invitations found');
                return {
                    success: true,
                    expiredCount: 0,
                    notificationsSent: 0,
                    errors: []
                };
            }

            // Update expired invitations
            const result = await Invitation.updateMany(
                {
                    status: 'active',
                    expiresAt: { $lt: new Date() }
                },
                {
                    $set: { status: 'expired' }
                }
            );

            console.log(`Marked ${result.modifiedCount} invitations as expired`);

            // Send notifications to inviters (don't block the process)
            for (const invitation of expiredInvitations) {
                try {
                    const inviterData = invitation.invitedBy as any;
                    if (inviterData?.email) {
                        await emailService.sendInvitationExpiredNotification(
                            inviterData.email,
                            {
                                inviterName: `${inviterData.firstName} ${inviterData.lastName}`,
                                invitedEmail: invitation.email,
                                workspaceName: invitation.metadata.workspaceName,
                                role: invitation.role,
                            }
                        );
                        notificationsSent++;
                    }
                } catch (error) {
                    errors.push(`Failed to send expiry notification for invitation ${invitation._id}: ${(error as Error).message}`);
                }
            }

            return {
                success: true,
                expiredCount: result.modifiedCount,
                notificationsSent,
                errors
            };
        } catch (error) {
            console.error('Error marking expired invitations:', error);
            return {
                success: false,
                expiredCount: 0,
                notificationsSent,
                errors: [`Failed to mark expired invitations: ${(error as Error).message}`]
            };
        }
    }

    /**
     * Validate invitation limits for a workspace
     */
    async validateInvitationLimits(workspaceId: string): Promise<InvitationLimits> {
        try {
            const workspace = await Workplace.findById(workspaceId);
            if (!workspace) {
                throw new Error('Workspace not found');
            }

            const maxPendingInvites = workspace.settings?.maxPendingInvites || 20;
            const currentPendingInvites = await Invitation.countDocuments({
                workspaceId: new mongoose.Types.ObjectId(workspaceId),
                status: 'active'
            });

            const remainingInvites = Math.max(0, maxPendingInvites - currentPendingInvites);
            const canSendMore = remainingInvites > 0;
            const upgradeRequired = !canSendMore && maxPendingInvites <= 20; // Basic plan limit

            return {
                maxPendingInvites,
                currentPendingInvites,
                remainingInvites,
                canSendMore,
                upgradeRequired,
                nextUpgradeLevel: upgradeRequired ? 'Professional Plan (50 invitations)' : undefined,
            };
        } catch (error) {
            console.error('Error validating invitation limits:', error);
            throw error;
        }
    }

    /**
     * Get invitation analytics for a workspace
     */
    async getInvitationAnalytics(workspaceId: string): Promise<InvitationAnalytics> {
        try {
            const workspaceObjectId = new mongoose.Types.ObjectId(workspaceId);

            // Get basic counts
            const [totalInvitations, statusCounts, roleStats, monthlyStats] = await Promise.all([
                Invitation.countDocuments({ workspaceId: workspaceObjectId }),

                Invitation.aggregate([
                    { $match: { workspaceId: workspaceObjectId } },
                    { $group: { _id: '$status', count: { $sum: 1 } } }
                ]),

                Invitation.aggregate([
                    { $match: { workspaceId: workspaceObjectId } },
                    { $group: { _id: '$role', count: { $sum: 1 } } }
                ]),

                Invitation.aggregate([
                    { $match: { workspaceId: workspaceObjectId } },
                    {
                        $group: {
                            _id: {
                                year: { $year: '$createdAt' },
                                month: { $month: '$createdAt' }
                            },
                            count: { $sum: 1 },
                            accepted: {
                                $sum: { $cond: [{ $eq: ['$status', 'used'] }, 1, 0] }
                            }
                        }
                    },
                    { $sort: { '_id.year': -1, '_id.month': -1 } },
                    { $limit: 12 }
                ])
            ]);

            // Process status counts
            const statusMap = statusCounts.reduce((acc, item) => {
                acc[item._id] = item.count;
                return acc;
            }, {} as Record<string, number>);

            const activeInvitations = statusMap.active || 0;
            const expiredInvitations = statusMap.expired || 0;
            const usedInvitations = statusMap.used || 0;
            const canceledInvitations = statusMap.canceled || 0;

            // Calculate acceptance rate
            const totalSentInvitations = totalInvitations - canceledInvitations;
            const acceptanceRate = totalSentInvitations > 0 ? (usedInvitations / totalSentInvitations) * 100 : 0;

            // Calculate average acceptance time
            const acceptedInvitations = await Invitation.find({
                workspaceId: workspaceObjectId,
                status: 'used',
                usedAt: { $exists: true }
            }).select('createdAt usedAt');

            let averageAcceptanceTime = 0;
            if (acceptedInvitations.length > 0) {
                const totalTime = acceptedInvitations.reduce((sum, inv) => {
                    const timeDiff = inv.usedAt!.getTime() - inv.createdAt.getTime();
                    return sum + timeDiff;
                }, 0);
                averageAcceptanceTime = totalTime / acceptedInvitations.length / (1000 * 60 * 60); // Convert to hours
            }

            // Process role stats
            const invitationsByRole = roleStats.reduce((acc, item) => {
                acc[item._id] = item.count;
                return acc;
            }, {} as Record<string, number>);

            // Process monthly stats
            const invitationsByMonth = monthlyStats.map(item => ({
                month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
                count: item.count,
                accepted: item.accepted
            }));

            return {
                totalInvitations,
                activeInvitations,
                expiredInvitations,
                usedInvitations,
                canceledInvitations,
                acceptanceRate: Math.round(acceptanceRate * 100) / 100,
                averageAcceptanceTime: Math.round(averageAcceptanceTime * 100) / 100,
                invitationsByRole,
                invitationsByMonth
            };
        } catch (error) {
            console.error('Error getting invitation analytics:', error);
            throw error;
        }
    }

    /**
     * Get invitation statistics (workspace-specific or global)
     */
    async getInvitationStats(workspaceId?: string): Promise<InvitationStats> {
        try {
            if (workspaceId) {
                // Workspace-specific stats
                const workspace = await Workplace.findById(workspaceId);
                if (!workspace) {
                    throw new Error('Workspace not found');
                }

                const workspaceObjectId = new mongoose.Types.ObjectId(workspaceId);
                const [totalInvitations, statusCounts] = await Promise.all([
                    Invitation.countDocuments({ workspaceId: workspaceObjectId }),
                    Invitation.aggregate([
                        { $match: { workspaceId: workspaceObjectId } },
                        { $group: { _id: '$status', count: { $sum: 1 } } }
                    ])
                ]);

                const statusMap = statusCounts.reduce((acc, item) => {
                    acc[item._id] = item.count;
                    return acc;
                }, {} as Record<string, number>);

                return {
                    workspace: {
                        id: workspaceId,
                        name: workspace.name,
                        totalInvitations,
                        pendingInvitations: statusMap.active || 0,
                        acceptedInvitations: statusMap.used || 0,
                        expiredInvitations: statusMap.expired || 0,
                    }
                };
            } else {
                // Global stats
                const [totalWorkspaces, totalInvitations, workspaceStats] = await Promise.all([
                    Workplace.countDocuments(),
                    Invitation.countDocuments(),
                    Invitation.aggregate([
                        {
                            $group: {
                                _id: '$workspaceId',
                                invitationCount: { $sum: 1 },
                                acceptedCount: {
                                    $sum: { $cond: [{ $eq: ['$status', 'used'] }, 1, 0] }
                                }
                            }
                        }
                    ])
                ]);

                const averageInvitationsPerWorkspace = totalWorkspaces > 0 ? totalInvitations / totalWorkspaces : 0;

                const totalAccepted = workspaceStats.reduce((sum, ws) => sum + ws.acceptedCount, 0);
                const globalAcceptanceRate = totalInvitations > 0 ? (totalAccepted / totalInvitations) * 100 : 0;

                return {
                    global: {
                        totalWorkspaces,
                        totalInvitations,
                        averageInvitationsPerWorkspace: Math.round(averageInvitationsPerWorkspace * 100) / 100,
                        globalAcceptanceRate: Math.round(globalAcceptanceRate * 100) / 100,
                    }
                };
            }
        } catch (error) {
            console.error('Error getting invitation stats:', error);
            throw error;
        }
    }

    /**
     * Clean up old expired invitations (older than 30 days)
     * This should be run daily
     */
    async cleanupOldInvitations(): Promise<{
        success: boolean;
        deletedCount: number;
        error?: string;
    }> {
        try {
            console.log('Starting cleanup of old expired invitations...');

            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const result = await Invitation.deleteMany({
                status: { $in: ['expired', 'canceled'] },
                updatedAt: { $lt: thirtyDaysAgo }
            });

            console.log(`Cleaned up ${result.deletedCount} old invitations`);

            return {
                success: true,
                deletedCount: result.deletedCount
            };
        } catch (error) {
            console.error('Error cleaning up old invitations:', error);
            return {
                success: false,
                deletedCount: 0,
                error: (error as Error).message
            };
        }
    }

    /**
     * Send reminder emails for invitations expiring soon (within 24 hours)
     */
    async sendExpiryReminders(): Promise<{
        success: boolean;
        remindersSent: number;
        errors: string[];
    }> {
        const errors: string[] = [];
        let remindersSent = 0;

        try {
            console.log('Sending expiry reminders...');

            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);

            const expiringInvitations = await Invitation.find({
                status: 'active',
                expiresAt: { $lte: tomorrow, $gt: new Date() }
            });

            for (const invitation of expiringInvitations) {
                try {
                    await emailService.sendInvitationReminderEmail(invitation);
                    remindersSent++;
                } catch (error) {
                    errors.push(`Failed to send reminder for invitation ${invitation._id}: ${(error as Error).message}`);
                }
            }

            console.log(`Sent ${remindersSent} expiry reminders`);

            return {
                success: true,
                remindersSent,
                errors
            };
        } catch (error) {
            console.error('Error sending expiry reminders:', error);
            return {
                success: false,
                remindersSent,
                errors: [`Failed to send expiry reminders: ${(error as Error).message}`]
            };
        }
    }
}

export const invitationCronService = new InvitationCronService();
export default invitationCronService;