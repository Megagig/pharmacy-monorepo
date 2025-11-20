import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { User } from '../models/User';
import { Workplace } from '../models/Workplace';
import Patient from '../models/Patient';
import ClinicalNote from '../models/ClinicalNote';
import MedicationRecord from '../models/MedicationRecord';
import { IMedicationTherapyReview } from '../models/MedicationTherapyReview';
import Subscription from '../models/Subscription';
import ClinicalIntervention from '../models/ClinicalIntervention';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import mongoose from 'mongoose';

// Interface for workspace-specific stats
interface WorkspaceStats {
    totalPatients: number;
    totalClinicalNotes: number;
    totalMedications: number;
    totalMTRs: number;
    totalUsers: number;
}

// Interface for system-wide stats
interface SystemStats {
    totalPatients: number;
    totalClinicalNotes: number;
    totalMedications: number;
    totalMTRs: number;
    totalWorkspaces: number;
    totalUsers: number;
    activeSubscriptions: number;
}

// Get MTR model
const MedicationTherapyReview = mongoose.model<IMedicationTherapyReview>('MedicationTherapyReview');

export class SuperAdminDashboardController {
    /**
     * Get comprehensive system-wide dashboard overview for super admins
     * Includes all workspaces, users, and system metrics
     */
    async getSystemOverview(req: AuthRequest, res: Response): Promise<void> {
        try {
            // Verify super admin role
            if (req.user?.role !== 'super_admin') {
                res.status(403).json({
                    success: false,
                    message: 'Access denied. Super admin role required.',
                });
                return;
            }

            console.log('🌐 Fetching system-wide overview for super admin');

            // Execute all queries in parallel for better performance
            const [
                systemStats,
                workspaceBreakdown,
                userActivityStats,
                subscriptionMetrics,
                monthlyActivityTrends
            ] = await Promise.allSettled([
                this.getSystemWideStats(),
                this.getWorkspaceBreakdown(),
                this.getUserActivityStats(),
                this.getSubscriptionMetrics(),
                this.getMonthlyActivityTrends()
            ]);

            const systemOverview = {
                systemStats: systemStats.status === 'fulfilled' ? systemStats.value : this.getDefaultSystemStats(),
                workspaces: workspaceBreakdown.status === 'fulfilled' ? workspaceBreakdown.value : [],
                userActivity: userActivityStats.status === 'fulfilled' ? userActivityStats.value : this.getDefaultUserActivity(),
                subscriptions: subscriptionMetrics.status === 'fulfilled' ? subscriptionMetrics.value : this.getDefaultSubscriptionMetrics(),
                trends: monthlyActivityTrends.status === 'fulfilled' ? monthlyActivityTrends.value : this.getDefaultTrends()
            };

            // Log any failures for debugging
            if (systemStats.status === 'rejected') console.error('System stats query failed:', systemStats.reason);
            if (workspaceBreakdown.status === 'rejected') console.error('Workspace breakdown query failed:', workspaceBreakdown.reason);
            if (userActivityStats.status === 'rejected') console.error('User activity query failed:', userActivityStats.reason);
            if (subscriptionMetrics.status === 'rejected') console.error('Subscription metrics query failed:', subscriptionMetrics.reason);
            if (monthlyActivityTrends.status === 'rejected') console.error('Monthly trends query failed:', monthlyActivityTrends.reason);

            console.log('✅ System overview loaded successfully for super admin');
            console.log('📊 Super admin data being returned:', {
                hasSystemStats: !!systemOverview.systemStats,
                workspacesCount: systemOverview.workspaces?.length || 0,
                hasUserActivity: !!systemOverview.userActivity,
                hasSubscriptions: !!systemOverview.subscriptions,
                hasTrends: !!systemOverview.trends
            });

            res.json({
                success: true,
                message: 'System overview retrieved successfully',
                data: systemOverview,
                timestamp: new Date().toISOString()
            });

        } catch (error: any) {
            console.error('❌ Error fetching system overview:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to load system overview',
                error: error.message
            });
        }
    }

    /**
     * Get system-wide aggregated statistics
     */
    private async getSystemWideStats(): Promise<SystemStats> {
        console.log('📊 Getting system-wide statistics');

        const [
            totalPatients,
            totalClinicalNotes,
            totalMedications,
            totalMTRs,
            totalWorkspaces,
            totalUsers,
            activeSubscriptions
        ] = await Promise.allSettled([
            Patient.countDocuments({ isDeleted: { $ne: true } }),
            ClinicalNote.countDocuments({}),
            MedicationRecord.countDocuments({}),
            // Add timeout for MTR queries
            Promise.race([
                MedicationTherapyReview.countDocuments({}),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('MTR count query timeout')), 5000)
                )
            ]),
            Workplace.countDocuments({}),
            User.countDocuments({ status: { $ne: 'suspended' } }),
            Subscription.countDocuments({ status: 'active' })
        ]);

        const stats: SystemStats = {
            totalPatients: totalPatients.status === 'fulfilled' ? totalPatients.value : 0,
            totalClinicalNotes: totalClinicalNotes.status === 'fulfilled' ? totalClinicalNotes.value : 0,
            totalMedications: totalMedications.status === 'fulfilled' ? totalMedications.value : 0,
            totalMTRs: totalMTRs.status === 'fulfilled' ? Number(totalMTRs.value) || 0 : 0,
            totalWorkspaces: totalWorkspaces.status === 'fulfilled' ? totalWorkspaces.value : 0,
            totalUsers: totalUsers.status === 'fulfilled' ? totalUsers.value : 0,
            activeSubscriptions: activeSubscriptions.status === 'fulfilled' ? activeSubscriptions.value : 0
        };

        return stats;
    }

    /**
     * Get breakdown of all workspaces with their metrics
     */
    private async getWorkspaceBreakdown() {
        console.log('🏢 Getting workspace breakdown');

        const workspaces = await Workplace.find({})
            .populate('ownerId', 'firstName lastName email')
            .select('name ownerId subscriptionStatus createdAt stats')
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        // Get additional metrics for each workspace
        const workspaceMetrics = await Promise.all(
            workspaces.map(async (workspace) => {
                const [patientCount, userCount, mtrCount] = await Promise.allSettled([
                    Patient.countDocuments({
                        workplaceId: workspace._id,
                        isDeleted: { $ne: true }
                    }),
                    User.countDocuments({
                        workplaceId: workspace._id,
                        status: { $ne: 'suspended' }
                    }),
                    Promise.race([
                        MedicationTherapyReview.countDocuments({
                            workplaceId: workspace._id
                        }),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('MTR count timeout')), 3000)
                        )
                    ])
                ]);

                return {
                    ...workspace,
                    metrics: {
                        patients: patientCount.status === 'fulfilled' ? patientCount.value : 0,
                        users: userCount.status === 'fulfilled' ? userCount.value : 0,
                        mtrs: mtrCount.status === 'fulfilled' ? mtrCount.value : 0
                    }
                };
            })
        );

        return workspaceMetrics;
    }

    /**
     * Get user activity statistics across all workspaces
     */
    private async getUserActivityStats() {
        console.log('👥 Getting user activity statistics');

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const [
            usersByRole,
            activeUsers,
            newUsers,
            usersByWorkplaceRole
        ] = await Promise.allSettled([
            User.aggregate([
                { $group: { _id: '$role', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),
            User.countDocuments({
                lastLoginAt: { $gte: thirtyDaysAgo },
                status: 'active'
            }),
            User.countDocuments({
                createdAt: { $gte: thirtyDaysAgo }
            }),
            User.aggregate([
                { $match: { workplaceRole: { $exists: true } } },
                { $group: { _id: '$workplaceRole', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ])
        ]);

        return {
            usersByRole: usersByRole.status === 'fulfilled' ? usersByRole.value : [],
            activeUsers: activeUsers.status === 'fulfilled' ? activeUsers.value : 0,
            newUsers: newUsers.status === 'fulfilled' ? newUsers.value : 0,
            usersByWorkplaceRole: usersByWorkplaceRole.status === 'fulfilled' ? usersByWorkplaceRole.value : []
        };
    }

    /**
     * Get subscription and revenue metrics
     */
    private async getSubscriptionMetrics() {
        console.log('💰 Getting subscription metrics');

        const [
            subscriptionsByStatus,
            subscriptionsByTier,
            monthlyRevenue,
            totalRevenue
        ] = await Promise.allSettled([
            Subscription.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),
            User.aggregate([
                { $group: { _id: '$subscriptionTier', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),
            this.getMonthlyRevenue(),
            this.getTotalRevenue()
        ]);

        return {
            subscriptionsByStatus: subscriptionsByStatus.status === 'fulfilled' ? subscriptionsByStatus.value : [],
            subscriptionsByTier: subscriptionsByTier.status === 'fulfilled' ? subscriptionsByTier.value : [],
            monthlyRevenue: monthlyRevenue.status === 'fulfilled' ? monthlyRevenue.value : 0,
            totalRevenue: totalRevenue.status === 'fulfilled' ? totalRevenue.value : 0
        };
    }

    /**
     * Get monthly activity trends across the system
     */
    private async getMonthlyActivityTrends() {
        console.log('📈 Getting monthly activity trends');

        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const [
            patientsTrend,
            usersTrend,
            notesTrend,
            mtrsTrend
        ] = await Promise.allSettled([
            Patient.aggregate([
                {
                    $match: {
                        createdAt: { $gte: sixMonthsAgo },
                        isDeleted: { $ne: true }
                    }
                },
                {
                    $group: {
                        _id: {
                            year: { $year: '$createdAt' },
                            month: { $month: '$createdAt' }
                        },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { '_id.year': 1, '_id.month': 1 } }
            ]),
            User.aggregate([
                {
                    $match: {
                        createdAt: { $gte: sixMonthsAgo }
                    }
                },
                {
                    $group: {
                        _id: {
                            year: { $year: '$createdAt' },
                            month: { $month: '$createdAt' }
                        },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { '_id.year': 1, '_id.month': 1 } }
            ]),
            ClinicalNote.aggregate([
                {
                    $match: {
                        createdAt: { $gte: sixMonthsAgo }
                    }
                },
                {
                    $group: {
                        _id: '$type',
                        count: { $sum: 1 }
                    }
                },
                { $sort: { count: -1 } }
            ]),
            Promise.race([
                MedicationTherapyReview.aggregate([
                    {
                        $match: {
                            createdAt: { $gte: sixMonthsAgo }
                        }
                    },
                    {
                        $group: {
                            _id: '$status',
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { count: -1 } }
                ]),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('MTR trends query timeout')), 5000)
                )
            ])
        ]);

        return {
            patientsTrend: patientsTrend.status === 'fulfilled' ? patientsTrend.value : [],
            usersTrend: usersTrend.status === 'fulfilled' ? usersTrend.value : [],
            clinicalNotesByType: notesTrend.status === 'fulfilled' ? notesTrend.value : [],
            mtrsByStatus: mtrsTrend.status === 'fulfilled' ? mtrsTrend.value : []
        };
    }

    /**
     * Get monthly revenue (placeholder - implement based on your billing system)
     */
    private async getMonthlyRevenue(): Promise<number> {
        // TODO: Implement based on your billing/subscription system
        // This is a placeholder that should be replaced with actual revenue calculation
        return 0;
    }

    /**
     * Get total revenue (placeholder - implement based on your billing system)
     */
    private async getTotalRevenue(): Promise<number> {
        // TODO: Implement based on your billing/subscription system
        // This is a placeholder that should be replaced with actual revenue calculation
        return 0;
    }

    /**
     * Get all workspaces for super admin workspace switching
     */
    async getAllWorkspaces(req: AuthRequest, res: Response): Promise<void> {
        try {
            const workspaces = await Workplace.find({})
                .populate('ownerId', 'firstName lastName email')
                .select('name description ownerId createdAt subscriptionStatus subscriptionTier')
                .sort({ createdAt: -1 })
                .lean();

            const workspacesWithCounts = await Promise.allSettled(
                workspaces.map(async (workspace) => {
                    const [patientsCount, usersCount, mtrsCount] = await Promise.allSettled([
                        Patient.countDocuments({ workplaceId: workspace._id }),
                        User.countDocuments({ workplaceId: workspace._id }),
                        MedicationTherapyReview.countDocuments({ workplaceId: workspace._id }),
                    ]);

                    return {
                        ...workspace,
                        metrics: {
                            patients: patientsCount.status === 'fulfilled' ? patientsCount.value : 0,
                            users: usersCount.status === 'fulfilled' ? usersCount.value : 0,
                            mtrs: mtrsCount.status === 'fulfilled' ? mtrsCount.value : 0,
                        },
                    };
                })
            );

            const validWorkspaces = workspacesWithCounts
                .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
                .map(result => result.value);

            res.json({
                success: true,
                workspaces: validWorkspaces,
                total: validWorkspaces.length,
            });
        } catch (error: any) {
            console.error('Error in getAllWorkspaces:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch workspaces',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
            });
        }
    }

    /**
     * Get specific workspace data for super admin drill-down
     */
    async getWorkspaceDetails(req: AuthRequest, res: Response): Promise<void> {
        try {
            // Verify super admin role
            if (req.user?.role !== 'super_admin') {
                res.status(403).json({
                    success: false,
                    message: 'Access denied. Super admin role required.',
                });
                return;
            }

            const { workspaceId } = req.params;

            if (!workspaceId) {
                res.status(400).json({
                    success: false,
                    message: 'Workspace ID is required',
                });
                return;
            }

            console.log(`🔍 Getting detailed workspace data for: ${workspaceId}`);

            const [workspaceInfo, workspaceStats, workspaceUsers, workspaceActivities] = await Promise.allSettled([
                Workplace.findById(workspaceId)
                    .populate('ownerId', 'firstName lastName email')
                    .lean(),
                this.getWorkspaceSpecificStats(workspaceId),
                User.find({ workplaceId: workspaceId })
                    .select('firstName lastName email role workplaceRole lastLoginAt status')
                    .sort({ createdAt: -1 })
                    .lean(),
                this.getWorkspaceRecentActivities(workspaceId)
            ]);

            const workspaceDetails = {
                workspace: workspaceInfo.status === 'fulfilled' ? workspaceInfo.value : null,
                stats: workspaceStats.status === 'fulfilled' ? workspaceStats.value : this.getDefaultSystemStats(),
                users: workspaceUsers.status === 'fulfilled' ? workspaceUsers.value : [],
                activities: workspaceActivities.status === 'fulfilled' ? workspaceActivities.value : []
            };

            res.json({
                success: true,
                message: 'Workspace details retrieved successfully',
                data: workspaceDetails,
                timestamp: new Date().toISOString()
            });

        } catch (error: any) {
            console.error('❌ Error fetching workspace details:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to load workspace details',
                error: error.message
            });
        }
    }

    /**
     * Get statistics for a specific workspace
     */
    private async getWorkspaceSpecificStats(workspaceId: string): Promise<WorkspaceStats> {
        const [patientCount, notesCount, medicationsCount, mtrCount, usersCount] = await Promise.allSettled([
            Patient.countDocuments({
                workplaceId: workspaceId,
                isDeleted: { $ne: true }
            }),
            ClinicalNote.countDocuments({ workplaceId: workspaceId }),
            MedicationRecord.countDocuments({ workplaceId: workspaceId }),
            Promise.race([
                MedicationTherapyReview.countDocuments({ workplaceId: workspaceId }),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('MTR count timeout')), 5000)
                )
            ]),
            User.countDocuments({ workplaceId: workspaceId, status: { $ne: 'suspended' } })
        ]);

        const stats: WorkspaceStats = {
            totalPatients: patientCount.status === 'fulfilled' ? patientCount.value : 0,
            totalClinicalNotes: notesCount.status === 'fulfilled' ? notesCount.value : 0,
            totalMedications: medicationsCount.status === 'fulfilled' ? medicationsCount.value : 0,
            totalMTRs: mtrCount.status === 'fulfilled' ? Number(mtrCount.value) || 0 : 0,
            totalUsers: usersCount.status === 'fulfilled' ? usersCount.value : 0
        };

        return stats;
    }

    /**
     * Get recent activities for a specific workspace
     */
    private async getWorkspaceRecentActivities(workspaceId: string) {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const [recentPatients, recentNotes] = await Promise.allSettled([
            Patient.find({
                workplaceId: workspaceId,
                createdAt: { $gte: oneWeekAgo },
                isDeleted: { $ne: true }
            })
                .select('firstName lastName createdAt')
                .sort({ createdAt: -1 })
                .limit(10)
                .lean(),
            ClinicalNote.find({
                workplaceId: workspaceId,
                createdAt: { $gte: oneWeekAgo }
            })
                .populate('patient', 'firstName lastName')
                .select('type createdAt patient')
                .sort({ createdAt: -1 })
                .limit(10)
                .lean()
        ]);

        const activities = [];

        if (recentPatients.status === 'fulfilled') {
            recentPatients.value.forEach(patient => {
                activities.push({
                    type: 'patient_added',
                    description: `New patient: ${patient.firstName} ${patient.lastName}`,
                    timestamp: patient.createdAt
                });
            });
        }

        if (recentNotes.status === 'fulfilled') {
            recentNotes.value.forEach((note: any) => {
                activities.push({
                    type: 'note_created',
                    description: `${note.type} note for ${(note.patient as any)?.firstName} ${(note.patient as any)?.lastName}`,
                    timestamp: note.createdAt
                });
            });
        }

        return activities
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 20);
    }

    /**
     * Default system stats when queries fail
     */
    private getDefaultSystemStats(): SystemStats {
        return {
            totalPatients: 0,
            totalClinicalNotes: 0,
            totalMedications: 0,
            totalMTRs: 0,
            totalWorkspaces: 0,
            totalUsers: 0,
            activeSubscriptions: 0
        };
    }

    /**
     * Default user activity when queries fail
     */
    private getDefaultUserActivity() {
        return {
            usersByRole: [],
            activeUsers: 0,
            newUsers: 0,
            usersByWorkplaceRole: []
        };
    }

    /**
     * Default subscription metrics when queries fail
     */
    private getDefaultSubscriptionMetrics() {
        return {
            subscriptionsByStatus: [],
            subscriptionsByTier: [],
            monthlyRevenue: 0,
            totalRevenue: 0
        };
    }

    /**
     * Default trends when queries fail
     */
    private getDefaultTrends() {
        return {
            patientsTrend: [],
            usersTrend: [],
            clinicalNotesByType: [],
            mtrsByStatus: []
        };
    }

    /**
     * Get system-wide clinical interventions metrics
     * Aggregated across all workspaces
     */
    async getClinicalInterventionsSystemWide(req: AuthRequest, res: Response): Promise<void> {
        try {
            // Verify super admin role
            if (req.user?.role !== 'super_admin') {
                res.status(403).json({
                    success: false,
                    message: 'Access denied. Super admin role required.',
                });
                return;
            }

            console.log('💊 Fetching system-wide clinical interventions data');

            const [
                totalInterventions,
                activeInterventions,
                completedInterventions,
                interventionsByWorkspace
            ] = await Promise.allSettled([
                ClinicalIntervention.countDocuments({}),
                ClinicalIntervention.countDocuments({ status: 'active' }),
                ClinicalIntervention.countDocuments({ status: 'completed' }),
                ClinicalIntervention.aggregate([
                    {
                        $group: {
                            _id: '$workplaceId',
                            total: { $sum: 1 },
                            active: {
                                $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
                            },
                            completed: {
                                $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                            }
                        }
                    },
                    {
                        $lookup: {
                            from: 'workplaces',
                            localField: '_id',
                            foreignField: '_id',
                            as: 'workspace'
                        }
                    },
                    {
                        $unwind: { path: '$workspace', preserveNullAndEmptyArrays: true }
                    },
                    {
                        $project: {
                            workspaceId: '$_id',
                            workspaceName: '$workspace.name',
                            total: 1,
                            active: 1,
                            completed: 1
                        }
                    },
                    { $sort: { total: -1 } },
                    { $limit: 20 }
                ])
            ]);

            // Calculate success rate
            const total = totalInterventions.status === 'fulfilled' ? totalInterventions.value : 0;
            const completed = completedInterventions.status === 'fulfilled' ? completedInterventions.value : 0;
            const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;

            // Calculate estimated cost savings (placeholder - adjust based on your business logic)
            const costSavingsPerIntervention = 5000; // ₦5,000 per intervention
            const costSavings = completed * costSavingsPerIntervention;

            const clinicalInterventionsData = {
                totalInterventions: total,
                activeInterventions: activeInterventions.status === 'fulfilled' ? activeInterventions.value : 0,
                completedInterventions: completed,
                successRate: successRate,
                costSavings: costSavings,
                byWorkspace: interventionsByWorkspace.status === 'fulfilled' ? interventionsByWorkspace.value : []
            };

            console.log('✅ Clinical interventions data loaded successfully');

            res.json({
                success: true,
                message: 'Clinical interventions data retrieved successfully',
                data: clinicalInterventionsData,
                timestamp: new Date().toISOString()
            });

        } catch (error: any) {
            console.error('❌ Error fetching clinical interventions data:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to load clinical interventions data',
                error: error.message
            });
        }
    }

    /**
     * Get system-wide recent activities
     * Activities from all workspaces
     */
    async getActivitiesSystemWide(req: AuthRequest, res: Response): Promise<void> {
        try {
            // Verify super admin role
            if (req.user?.role !== 'super_admin') {
                res.status(403).json({
                    success: false,
                    message: 'Access denied. Super admin role required.',
                });
                return;
            }

            console.log('📋 Fetching system-wide activities');

            const limit = parseInt(req.query.limit as string) || 20;
            const oneDayAgo = new Date();
            oneDayAgo.setDate(oneDayAgo.getDate() - 1);

            const [
                recentPatients,
                recentNotes,
                recentMTRs,
                recentUsers,
                recentInterventions
            ] = await Promise.allSettled([
                // Recent patients added
                Patient.find({
                    createdAt: { $gte: oneDayAgo },
                    isDeleted: { $ne: true }
                })
                    .populate('workplaceId', 'name')
                    .select('firstName lastName createdAt workplaceId')
                    .sort({ createdAt: -1 })
                    .limit(limit)
                    .lean(),
                // Recent clinical notes
                ClinicalNote.find({
                    createdAt: { $gte: oneDayAgo }
                })
                    .populate('workplaceId', 'name')
                    .populate('patient', 'firstName lastName')
                    .select('type createdAt workplaceId patient')
                    .sort({ createdAt: -1 })
                    .limit(limit)
                    .lean(),
                // Recent MTR sessions
                MedicationTherapyReview.find({
                    createdAt: { $gte: oneDayAgo }
                })
                    .populate('workplaceId', 'name')
                    .select('status createdAt workplaceId')
                    .sort({ createdAt: -1 })
                    .limit(limit)
                    .lean(),
                // Recent user registrations
                User.find({
                    createdAt: { $gte: oneDayAgo }
                })
                    .populate('workplaceId', 'name')
                    .select('firstName lastName email role createdAt workplaceId')
                    .sort({ createdAt: -1 })
                    .limit(limit)
                    .lean(),
                // Recent clinical interventions
                ClinicalIntervention.find({
                    createdAt: { $gte: oneDayAgo }
                })
                    .populate('workplaceId', 'name')
                    .select('category status createdAt workplaceId')
                    .sort({ createdAt: -1 })
                    .limit(limit)
                    .lean()
            ]);

            // Combine and format activities
            const systemActivities: any[] = [];
            const userActivities: any[] = [];

            // Process patients
            if (recentPatients.status === 'fulfilled') {
                recentPatients.value.forEach((patient: any) => {
                    systemActivities.push({
                        type: 'patient_added',
                        description: `New patient: ${patient.firstName} ${patient.lastName}`,
                        timestamp: patient.createdAt,
                        workspaceId: patient.workplaceId?._id,
                        workspaceName: patient.workplaceId?.name
                    });
                });
            }

            // Process clinical notes
            if (recentNotes.status === 'fulfilled') {
                recentNotes.value.forEach((note: any) => {
                    systemActivities.push({
                        type: 'note_created',
                        description: `${note.type} note created${note.patient ? ` for ${note.patient.firstName} ${note.patient.lastName}` : ''}`,
                        timestamp: note.createdAt,
                        workspaceId: note.workplaceId?._id,
                        workspaceName: note.workplaceId?.name
                    });
                });
            }

            // Process MTRs
            if (recentMTRs.status === 'fulfilled') {
                recentMTRs.value.forEach((mtr: any) => {
                    systemActivities.push({
                        type: 'mtr_created',
                        description: `MTR session ${mtr.status}`,
                        timestamp: mtr.createdAt,
                        workspaceId: mtr.workplaceId?._id,
                        workspaceName: mtr.workplaceId?.name
                    });
                });
            }

            // Process interventions
            if (recentInterventions.status === 'fulfilled') {
                recentInterventions.value.forEach((intervention: any) => {
                    systemActivities.push({
                        type: 'intervention_created',
                        description: `Clinical intervention: ${intervention.category}`,
                        timestamp: intervention.createdAt,
                        workspaceId: intervention.workplaceId?._id,
                        workspaceName: intervention.workplaceId?.name
                    });
                });
            }

            // Process users
            if (recentUsers.status === 'fulfilled') {
                recentUsers.value.forEach((user: any) => {
                    userActivities.push({
                        userId: user._id,
                        userName: `${user.firstName} ${user.lastName}`,
                        email: user.email,
                        action: 'User registered',
                        role: user.role,
                        timestamp: user.createdAt,
                        workspaceId: user.workplaceId?._id,
                        workspaceName: user.workplaceId?.name
                    });
                });
            }

            // Sort by timestamp
            systemActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            userActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            const activitiesData = {
                systemActivities: systemActivities.slice(0, limit),
                userActivities: userActivities.slice(0, limit)
            };

            console.log('✅ Activities data loaded successfully');

            res.json({
                success: true,
                message: 'Activities data retrieved successfully',
                data: activitiesData,
                timestamp: new Date().toISOString()
            });

        } catch (error: any) {
            console.error('❌ Error fetching activities data:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to load activities data',
                error: error.message
            });
        }
    }

    /**
     * Get system-wide communication metrics
     * Aggregated across all workspaces
     */
    async getCommunicationsSystemWide(req: AuthRequest, res: Response): Promise<void> {
        try {
            // Verify super admin role
            if (req.user?.role !== 'super_admin') {
                res.status(403).json({
                    success: false,
                    message: 'Access denied. Super admin role required.',
                });
                return;
            }

            console.log('💬 Fetching system-wide communications data');

            const oneDayAgo = new Date();
            oneDayAgo.setDate(oneDayAgo.getDate() - 1);

            const [
                totalConversations,
                activeConversations,
                totalMessages,
                recentMessages,
                messagesByWorkspace
            ] = await Promise.allSettled([
                Conversation.countDocuments({}),
                Conversation.countDocuments({
                    lastMessageAt: { $gte: oneDayAgo }
                }),
                Message.countDocuments({}),
                Message.countDocuments({
                    createdAt: { $gte: oneDayAgo }
                }),
                Conversation.aggregate([
                    {
                        $group: {
                            _id: '$workplaceId',
                            conversations: { $sum: 1 },
                            activeConversations: {
                                $sum: {
                                    $cond: [
                                        { $gte: ['$lastMessageAt', oneDayAgo] },
                                        1,
                                        0
                                    ]
                                }
                            }
                        }
                    },
                    {
                        $lookup: {
                            from: 'workplaces',
                            localField: '_id',
                            foreignField: '_id',
                            as: 'workspace'
                        }
                    },
                    {
                        $unwind: { path: '$workspace', preserveNullAndEmptyArrays: true }
                    },
                    {
                        $project: {
                            workspaceId: '$_id',
                            workspaceName: '$workspace.name',
                            conversations: 1,
                            activeConversations: 1
                        }
                    },
                    { $sort: { conversations: -1 } },
                    { $limit: 20 }
                ])
            ]);

            // Calculate average response time (placeholder - implement based on your message timestamps)
            const avgResponseTime = 15; // 15 minutes placeholder

            // Calculate unread messages (placeholder - implement based on your read receipts)
            const unreadMessages = Math.floor((totalMessages.status === 'fulfilled' ? totalMessages.value : 0) * 0.1); // 10% unread estimate

            const communicationsData = {
                totalConversations: totalConversations.status === 'fulfilled' ? totalConversations.value : 0,
                activeConversations: activeConversations.status === 'fulfilled' ? activeConversations.value : 0,
                totalMessages: totalMessages.status === 'fulfilled' ? totalMessages.value : 0,
                recentMessages: recentMessages.status === 'fulfilled' ? recentMessages.value : 0,
                unreadMessages: unreadMessages,
                avgResponseTime: avgResponseTime,
                byWorkspace: messagesByWorkspace.status === 'fulfilled' ? messagesByWorkspace.value : []
            };

            console.log('✅ Communications data loaded successfully');

            res.json({
                success: true,
                message: 'Communications data retrieved successfully',
                data: communicationsData,
                timestamp: new Date().toISOString()
            });

        } catch (error: any) {
            console.error('❌ Error fetching communications data:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to load communications data',
                error: error.message
            });
        }
    }
}

export const superAdminDashboardController = new SuperAdminDashboardController();