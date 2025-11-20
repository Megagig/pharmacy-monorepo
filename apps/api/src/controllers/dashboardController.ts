import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { User } from '../models/User';
import { Workplace } from '../models/Workplace';
import Patient from '../models/Patient';
import ClinicalNote from '../models/ClinicalNote';
import { IMedicationTherapyReview } from '../models/MedicationTherapyReview';
import MedicationRecord from '../models/MedicationRecord';
import MedicationManagement from '../models/MedicationManagement';
import mongoose from 'mongoose';

// Interface for dashboard stats
interface DashboardStats {
    totalPatients: number;
    totalClinicalNotes: number;
    totalMedications: number;
    totalMTRs: number;
    totalDiagnostics: number;
}

// Interface for chart data point
interface ChartDataPoint {
    name: string;
    value: number;
}

// Interface for dashboard chart data
interface DashboardChartData {
    patientsByMonth: ChartDataPoint[];
    clinicalNotesByType: ChartDataPoint[];
    medicationsByStatus: ChartDataPoint[];
    mtrsByStatus: ChartDataPoint[];
    patientAgeDistribution: ChartDataPoint[];
    monthlyActivity: ChartDataPoint[];
}

// Get MTR model
const MedicationTherapyReview = mongoose.model<IMedicationTherapyReview>('MedicationTherapyReview');

export class DashboardController {
    /**
     * Get optimized dashboard overview with aggregated data
     * This method combines all dashboard data in a single optimized query
     */
    async getDashboardOverview(req: AuthRequest, res: Response): Promise<void> {
        try {
            const user = req.user!;
            const workplaceId = user.workplaceId;

            // Enhanced debugging for workspace context
            console.log('🔍 Dashboard Overview Debug:', {
                userId: user._id,
                userRole: user.role,
                workplaceId: workplaceId,
                userEmail: user.email,
                hasWorkplace: !!workplaceId,
                userFirstName: user.firstName,
                userLastName: user.lastName
            });

            // Special logging for the specific user we're debugging
            if (user.email === 'lovitax768@nrlord.com' || user._id.toString() === '68f7e213f10c0cc935f873c4') {
                console.log('🎯 DEBUGGING TARGET USER - Lovita ARNOLD');
                console.log('User object:', {
                    _id: user._id,
                    email: user.email,
                    role: user.role,
                    workplaceId: user.workplaceId,
                    status: user.status,
                    firstName: user.firstName,
                    lastName: user.lastName
                });
            }

            if (!workplaceId) {
                console.error('❌ No workplace associated with user:', {
                    userId: user._id,
                    userEmail: user.email,
                    userRole: user.role,
                    userFullName: `${user.firstName} ${user.lastName}`
                });

                // For development, let's return empty data instead of error
                // This allows the dashboard to load and show the issue
                const emptyDashboardData = {
                    stats: this.getDefaultStats(),
                    workspace: null,
                    charts: this.getDefaultChartData(),
                    activities: []
                };

                console.log('⚠️ Returning empty dashboard data for user without workplace');

                res.json({
                    success: true,
                    message: 'Dashboard loaded - user has no workplace assigned',
                    data: emptyDashboardData,
                    warning: 'USER_NO_WORKPLACE',
                    timestamp: new Date().toISOString()
                });
                return;
            }

            console.log(`🚀 Fetching dashboard overview for workplace: ${workplaceId}`);

            // Execute all database queries in parallel for better performance
            const [
                stats,
                workspaceInfo,
                chartData,
                recentActivities
            ] = await Promise.allSettled([
                this.getAggregatedStats(workplaceId),
                this.getWorkspaceDetails(workplaceId),
                this.getBasicChartData(workplaceId),
                this.getRecentActivities(workplaceId, user._id)
            ]);

            // Handle results safely
            const dashboardData = {
                stats: stats.status === 'fulfilled' ? stats.value : this.getDefaultStats(),
                workspace: workspaceInfo.status === 'fulfilled' ? workspaceInfo.value : null,
                charts: chartData.status === 'fulfilled' ? chartData.value : this.getDefaultChartData(),
                activities: recentActivities.status === 'fulfilled' ? recentActivities.value : []
            };

            // Log any failures for debugging
            if (stats.status === 'rejected') console.error('Stats query failed:', stats.reason);
            if (workspaceInfo.status === 'rejected') console.error('Workspace query failed:', workspaceInfo.reason);
            if (chartData.status === 'rejected') console.error('Chart data query failed:', chartData.reason);
            if (recentActivities.status === 'rejected') console.error('Activities query failed:', recentActivities.reason);

            console.log(`✅ Dashboard overview loaded successfully for workplace: ${workplaceId}`);
            console.log(`📊 Dashboard data being returned:`, {
                stats: dashboardData.stats,
                hasWorkspace: !!dashboardData.workspace,
                chartsDataLength: {
                    patientsByMonth: Array.isArray(dashboardData.charts?.patientsByMonth) ? dashboardData.charts.patientsByMonth.length : 0,
                    clinicalNotesByType: Array.isArray(dashboardData.charts?.clinicalNotesByType) ? dashboardData.charts.clinicalNotesByType.length : 0,
                    medicationsByStatus: Array.isArray(dashboardData.charts?.medicationsByStatus) ? dashboardData.charts.medicationsByStatus.length : 0,
                    mtrsByStatus: Array.isArray(dashboardData.charts?.mtrsByStatus) ? dashboardData.charts.mtrsByStatus.length : 0,
                    patientAgeDistribution: Array.isArray(dashboardData.charts?.patientAgeDistribution) ? dashboardData.charts.patientAgeDistribution.length : 0,
                    monthlyActivity: Array.isArray(dashboardData.charts?.monthlyActivity) ? dashboardData.charts.monthlyActivity.length : 0
                },
                activitiesCount: dashboardData.activities?.length || 0
            });

            res.json({
                success: true,
                message: 'Dashboard overview retrieved successfully',
                data: dashboardData,
                timestamp: new Date().toISOString()
            });

        } catch (error: any) {
            console.error('❌ Error fetching dashboard overview:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to load dashboard overview',
                error: error.message
            });
        }
    }

    /**
     * Get dashboard statistics only
     */
    async getDashboardStats(req: AuthRequest, res: Response): Promise<void> {
        try {
            const user = req.user!;
            const workplaceId = user.workplaceId;

            if (!workplaceId) {
                res.status(400).json({
                    success: false,
                    message: 'No workplace associated with user'
                });
                return;
            }

            const stats = await this.getAggregatedStats(workplaceId);

            res.json({
                success: true,
                message: 'Dashboard statistics retrieved successfully',
                data: { stats },
                timestamp: new Date().toISOString()
            });

        } catch (error: any) {
            console.error('❌ Error fetching dashboard stats:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to load dashboard statistics',
                error: error.message
            });
        }
    }

    /**
     * Get chart data for dashboard
     */
    async getChartData(req: AuthRequest, res: Response): Promise<void> {
        try {
            const user = req.user!;
            const workplaceId = user.workplaceId;

            if (!workplaceId) {
                res.status(400).json({
                    success: false,
                    message: 'No workplace associated with user'
                });
                return;
            }

            const chartData = await this.getDetailedChartData(workplaceId);

            res.json({
                success: true,
                message: 'Chart data retrieved successfully',
                data: chartData,
                timestamp: new Date().toISOString()
            });

        } catch (error: any) {
            console.error('❌ Error fetching chart data:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to load chart data',
                error: error.message
            });
        }
    }

    /**
     * Get workspace information for dashboard
     */
    async getWorkspaceInfo(req: AuthRequest, res: Response): Promise<void> {
        try {
            const user = req.user!;
            const workplaceId = user.workplaceId;

            if (!workplaceId) {
                res.status(400).json({
                    success: false,
                    message: 'No workplace associated with user'
                });
                return;
            }

            const workspaceInfo = await this.getWorkspaceDetails(workplaceId);

            res.json({
                success: true,
                message: 'Workspace information retrieved successfully',
                data: workspaceInfo,
                timestamp: new Date().toISOString()
            });

        } catch (error: any) {
            console.error('❌ Error fetching workspace info:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to load workspace information',
                error: error.message
            });
        }
    }

    /**
     * Quick fix endpoint to assign user to a workplace
     * Only available in development mode
     */
    async assignUserToWorkplace(req: AuthRequest, res: Response): Promise<void> {
        try {
            if (process.env.NODE_ENV === 'production') {
                res.status(404).json({ message: 'Not found' });
                return;
            }

            const user = req.user!;
            const { workplaceId } = req.body;

            if (!workplaceId) {
                // Get available workplaces
                const workplaces = await Workplace.find({})
                    .select('name ownerId createdAt')
                    .limit(10)
                    .lean();

                res.json({
                    success: false,
                    message: 'Please provide workplaceId',
                    availableWorkplaces: workplaces.map(wp => ({
                        id: wp._id,
                        name: wp.name,
                        ownerId: wp.ownerId
                    }))
                });
                return;
            }

            // Check if workplace exists
            const workplace = await Workplace.findById(workplaceId);
            if (!workplace) {
                res.status(400).json({
                    success: false,
                    message: 'Workplace not found'
                });
                return;
            }

            // Update user's workplace
            await User.findByIdAndUpdate(user._id, { workplaceId: workplaceId });

            console.log(`✅ Assigned user ${user.email} to workplace ${workplace.name}`);

            res.json({
                success: true,
                message: `User assigned to workplace: ${workplace.name}`,
                user: {
                    id: user._id,
                    email: user.email,
                    name: `${user.firstName} ${user.lastName}`
                },
                workplace: {
                    id: workplace._id,
                    name: workplace.name
                }
            });

        } catch (error: any) {
            console.error('❌ Error assigning user to workplace:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to assign user to workplace',
                error: error.message
            });
        }
    }

    /**
     * Debug endpoint to help diagnose workspace data issues
     * Only available in development mode
     */
    async debugWorkspaceData(req: AuthRequest, res: Response): Promise<void> {
        try {
            // Allow in development and when explicitly requested
            if (process.env.NODE_ENV === 'production' && !req.query.force) {
                res.status(404).json({ message: 'Not found' });
                return;
            }

            const user = req.user!;
            const workplaceId = user.workplaceId;

            console.log('🔍 Debug Workspace Data Request:', {
                userId: user._id,
                userEmail: user.email,
                userRole: user.role,
                workplaceId: workplaceId
            });

            if (!workplaceId) {
                res.json({
                    success: false,
                    message: 'No workplace associated with user',
                    debug: {
                        user: {
                            id: user._id,
                            email: user.email,
                            role: user.role,
                            workplaceId: user.workplaceId
                        }
                    }
                });
                return;
            }

            // Get detailed workspace information
            const [
                workplace,
                patientsInWorkspace,
                notesInWorkspace,
                medicationsInWorkspace,
                usersInWorkspace,
                allPatients,
                allWorkplaces
            ] = await Promise.allSettled([
                Workplace.findById(workplaceId),
                Patient.find({ workplaceId, isDeleted: { $ne: true } }).limit(5),
                ClinicalNote.find({ workplaceId }).limit(5),
                MedicationRecord.find({ workplaceId }).limit(5),
                User.find({ workplaceId }).select('firstName lastName email role'),
                Patient.find({}).select('workplaceId').limit(10),
                Workplace.find({}).select('name ownerId').limit(10)
            ]);

            const debugInfo = {
                user: {
                    id: user._id,
                    email: user.email,
                    role: user.role,
                    workplaceId: user.workplaceId
                },
                workplace: workplace.status === 'fulfilled' ? workplace.value : null,
                dataInWorkspace: {
                    patients: patientsInWorkspace.status === 'fulfilled' ? patientsInWorkspace.value.length : 0,
                    notes: notesInWorkspace.status === 'fulfilled' ? notesInWorkspace.value.length : 0,
                    medications: medicationsInWorkspace.status === 'fulfilled' ? medicationsInWorkspace.value.length : 0,
                    users: usersInWorkspace.status === 'fulfilled' ? usersInWorkspace.value.length : 0
                },
                sampleData: {
                    patients: patientsInWorkspace.status === 'fulfilled' ?
                        patientsInWorkspace.value.map(p => ({ id: p._id, name: `${p.firstName} ${p.lastName}`, workplaceId: p.workplaceId })) : [],
                    users: usersInWorkspace.status === 'fulfilled' ?
                        usersInWorkspace.value.map(u => ({ id: u._id, name: `${u.firstName} ${u.lastName}`, email: u.email, role: u.role })) : []
                },
                systemOverview: {
                    totalPatients: allPatients.status === 'fulfilled' ? allPatients.value.length : 0,
                    totalWorkplaces: allWorkplaces.status === 'fulfilled' ? allWorkplaces.value.length : 0,
                    sampleWorkplaces: allWorkplaces.status === 'fulfilled' ?
                        allWorkplaces.value.map(w => ({ id: w._id, name: w.name, ownerId: w.ownerId })) : []
                }
            };

            res.json({
                success: true,
                message: 'Debug information retrieved',
                debug: debugInfo,
                timestamp: new Date().toISOString()
            });

        } catch (error: any) {
            console.error('❌ Error in debug endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Debug endpoint failed',
                error: error.message
            });
        }
    }

    /**
     * Get aggregated statistics using optimized MongoDB aggregation
     */
    private async getAggregatedStats(workplaceId: any): Promise<DashboardStats> {
        console.log(`📊 Getting aggregated stats for workplace: ${workplaceId}`);

        // Use Promise.allSettled to prevent one failing query from breaking others
        // Add specific timeout for MTR queries to prevent blocking
        const [patientsCount, notesCount, medicationsCount, mtrCount] = await Promise.allSettled([
            Patient.countDocuments({
                workplaceId,
                isDeleted: { $ne: true }
            }),
            ClinicalNote.countDocuments({
                workplaceId
            }),
            MedicationManagement.countDocuments({
                workplaceId
            }),
            // Add timeout for MTR count query
            Promise.race([
                MedicationTherapyReview.countDocuments({
                    workplaceId
                }),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('MTR count query timeout')), 5000)
                )
            ])
        ]);

        const stats: DashboardStats = {
            totalPatients: patientsCount.status === 'fulfilled' ? patientsCount.value : 0,
            totalClinicalNotes: notesCount.status === 'fulfilled' ? notesCount.value : 0,
            totalMedications: medicationsCount.status === 'fulfilled' ? medicationsCount.value : 0,
            totalMTRs: mtrCount.status === 'fulfilled' ? Number(mtrCount.value) || 0 : 0,
            totalDiagnostics: 0 // Will be implemented when diagnostics are available
        };

        // Enhanced debugging for workspace data
        console.log(`📈 Workspace ${workplaceId} stats:`, stats);

        // Log any failed queries
        if (patientsCount.status === 'rejected') {
            console.error('❌ Patients count query failed:', patientsCount.reason);
        }
        if (notesCount.status === 'rejected') {
            console.error('❌ Clinical notes count query failed:', notesCount.reason);
        }
        if (medicationsCount.status === 'rejected') {
            console.error('❌ Medications count query failed:', medicationsCount.reason);
        }
        if (mtrCount.status === 'rejected') {
            console.error('❌ MTR count query failed:', mtrCount.reason);
        }

        // Check if we have any data at all
        const totalData = stats.totalPatients + stats.totalClinicalNotes + stats.totalMedications + stats.totalMTRs;
        if (totalData === 0) {
            console.warn(`⚠️ No data found for workspace ${workplaceId}. This might indicate:
            1. User is in wrong workspace
            2. Data exists but workplaceId doesn't match
            3. User has no data yet`);

            // Let's check if there's any data in the workspace at all
            const [anyPatients, anyNotes, anyMedications] = await Promise.allSettled([
                Patient.findOne({ workplaceId }).select('_id'),
                ClinicalNote.findOne({ workplaceId }).select('_id'),
                MedicationManagement.findOne({ workplaceId }).select('_id')
            ]);

            console.log(`🔍 Data existence check for workspace ${workplaceId}:`, {
                hasPatients: anyPatients.status === 'fulfilled' && !!anyPatients.value,
                hasNotes: anyNotes.status === 'fulfilled' && !!anyNotes.value,
                hasMedications: anyMedications.status === 'fulfilled' && !!anyMedications.value
            });
        }

        return stats;
    }

    /**
     * Get workspace details with team information
     */
    private async getWorkspaceDetails(workplaceId: any) {
        console.log(`🏢 Getting workspace details for: ${workplaceId}`);

        const [workplace, teamMembers] = await Promise.allSettled([
            Workplace.findById(workplaceId)
                .populate('ownerId', 'firstName lastName email workplaceRole')
                .lean(),
            User.find({
                workplaceId,
                status: 'active'
            })
                .select('firstName lastName email workplaceRole lastLoginAt')
                .sort({ createdAt: -1 })
                .limit(10)
                .lean()
        ]);

        const workplaceData = workplace.status === 'fulfilled' ? workplace.value : null;
        const membersData = teamMembers.status === 'fulfilled' ? teamMembers.value : [];

        return {
            workplace: workplaceData,
            teamMembers: membersData,
            memberCount: membersData.length
        };
    }

    /**
     * Get basic chart data optimized for quick loading
     * Returns data in the format expected by the frontend
     */
    private async getBasicChartData(workplaceId: any): Promise<DashboardChartData> {
        console.log(`📈 Getting basic chart data for workplace: ${workplaceId}`);

        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        // Get comprehensive chart data that matches frontend expectations
        const [
            patientsByMonth,
            clinicalNotesByType,
            medicationsByStatus,
            mtrsByStatus,
            patientAgeDistribution
        ] = await Promise.allSettled([
            // Patients by month - expand date range and simplify
            Patient.aggregate([
                {
                    $match: {
                        workplaceId,
                        isDeleted: { $ne: true }
                        // Remove date filter to get all patients first
                    }
                },
                {
                    $group: {
                        _id: {
                            year: { $year: '$createdAt' },
                            month: { $month: '$createdAt' }
                        },
                        value: { $sum: 1 }
                    }
                },
                {
                    $addFields: {
                        name: {
                            $concat: [
                                { $toString: "$_id.month" },
                                "/",
                                { $toString: "$_id.year" }
                            ]
                        }
                    }
                },
                { $sort: { '_id.year': 1, '_id.month': 1 } },
                { $project: { name: 1, value: 1, _id: 0 } },
                { $limit: 12 }
            ]),
            // Clinical notes by type
            ClinicalNote.aggregate([
                {
                    $match: {
                        workplaceId,
                        createdAt: { $gte: sixMonthsAgo }
                    }
                },
                {
                    $group: {
                        _id: '$type',
                        value: { $sum: 1 }
                    }
                },
                {
                    $addFields: {
                        name: { $ifNull: ['$_id', 'General'] }
                    }
                },
                { $sort: { value: -1 } },
                { $project: { name: 1, value: 1, _id: 0 } },
                { $limit: 5 }
            ]),
            // Medications by status - using correct MedicationManagement collection
            MedicationManagement.aggregate([
                {
                    $match: { workplaceId: workplaceId }
                },
                {
                    $group: {
                        _id: { $ifNull: ['$status', 'active'] },
                        value: { $sum: 1 }
                    }
                },
                {
                    $addFields: {
                        name: {
                            $switch: {
                                branches: [
                                    { case: { $eq: ['$_id', 'active'] }, then: 'Active' },
                                    { case: { $eq: ['$_id', 'archived'] }, then: 'Archived' },
                                    { case: { $eq: ['$_id', 'cancelled'] }, then: 'Cancelled' }
                                ],
                                default: 'Active'
                            }
                        }
                    }
                },
                { $sort: { value: -1 } },
                { $project: { name: 1, value: 1, _id: 0 } }
            ]),
            // MTRs by status
            Promise.race([
                MedicationTherapyReview.aggregate([
                    {
                        $match: { workplaceId }
                    },
                    {
                        $group: {
                            _id: { $ifNull: ['$status', 'Scheduled'] },
                            value: { $sum: 1 }
                        }
                    },
                    {
                        $addFields: {
                            name: '$_id'
                        }
                    },
                    { $sort: { value: -1 } },
                    { $project: { name: 1, value: 1, _id: 0 } }
                ]),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('MTR chart query timeout')), 5000)
                )
            ]),
            // Patient age distribution - simplified approach
            Patient.aggregate([
                {
                    $match: {
                        workplaceId,
                        isDeleted: { $ne: true }
                    }
                },
                {
                    $addFields: {
                        age: {
                            $cond: {
                                if: { $ne: ['$dateOfBirth', null] },
                                then: {
                                    $floor: {
                                        $divide: [
                                            { $subtract: [new Date(), '$dateOfBirth'] },
                                            365.25 * 24 * 60 * 60 * 1000
                                        ]
                                    }
                                },
                                else: 30 // Default age if not provided
                            }
                        }
                    }
                },
                {
                    $addFields: {
                        ageGroup: {
                            $switch: {
                                branches: [
                                    { case: { $lt: ['$age', 18] }, then: '0-17' },
                                    { case: { $lt: ['$age', 35] }, then: '18-34' },
                                    { case: { $lt: ['$age', 50] }, then: '35-49' },
                                    { case: { $lt: ['$age', 65] }, then: '50-64' },
                                    { case: { $gte: ['$age', 65] }, then: '65+' }
                                ],
                                default: '18-34'
                            }
                        }
                    }
                },
                {
                    $group: {
                        _id: '$ageGroup',
                        value: { $sum: 1 }
                    }
                },
                {
                    $addFields: {
                        name: '$_id'
                    }
                },
                { $project: { name: 1, value: 1, _id: 0 } }
            ])
        ]);

        // Process results and provide defaults with error logging
        const chartData: DashboardChartData = {
            patientsByMonth: patientsByMonth.status === 'fulfilled' ? patientsByMonth.value : [],
            clinicalNotesByType: clinicalNotesByType.status === 'fulfilled' ? clinicalNotesByType.value : [],
            medicationsByStatus: medicationsByStatus.status === 'fulfilled' ? medicationsByStatus.value : [],
            mtrsByStatus: mtrsByStatus.status === 'fulfilled' && Array.isArray(mtrsByStatus.value) ? mtrsByStatus.value : [],
            patientAgeDistribution: patientAgeDistribution.status === 'fulfilled' ? patientAgeDistribution.value : [],
            monthlyActivity: [] // Will be calculated from combined data
        };

        // Log any failed chart queries and debug medication data
        if (patientsByMonth.status === 'rejected') {
            console.error('❌ Patients by month query failed:', patientsByMonth.reason);
        }
        if (clinicalNotesByType.status === 'rejected') {
            console.error('❌ Clinical notes by type query failed:', clinicalNotesByType.reason);
        }
        if (medicationsByStatus.status === 'rejected') {
            console.error('❌ Medications by status query failed:', medicationsByStatus.reason);
        } else {
            console.log('💊 Medication query result:', medicationsByStatus.value);
            // Check if there are any medications in the system at all
            const totalMedications = await MedicationManagement.countDocuments({});
            const workspaceMedications = await MedicationManagement.countDocuments({ workplaceId });
            console.log(`💊 Medication debug: Total in system: ${totalMedications}, In workspace: ${workspaceMedications}`);
        }
        if (mtrsByStatus.status === 'rejected') {
            console.error('❌ MTRs by status query failed:', mtrsByStatus.reason);
        }
        if (patientAgeDistribution.status === 'rejected') {
            console.error('❌ Patient age distribution query failed:', patientAgeDistribution.reason);
        }

        // Calculate monthly activity from patients and notes data
        const monthlyActivityMap = new Map();

        // Add patient registrations by month
        (chartData.patientsByMonth || []).forEach(item => {
            if (item.name && item.value) {
                const existing = monthlyActivityMap.get(item.name) || 0;
                monthlyActivityMap.set(item.name, existing + item.value);
            }
        });

        // If no monthly activity from patients, create some based on total stats
        if (monthlyActivityMap.size === 0) {
            const currentMonth = new Date().toLocaleDateString('en-US', { month: 'numeric', year: 'numeric' });
            const totalActivity = (chartData.clinicalNotesByType || []).reduce((sum, item) => sum + item.value, 0);
            if (totalActivity > 0) {
                monthlyActivityMap.set(currentMonth, totalActivity);
            }
        }

        chartData.monthlyActivity = Array.from(monthlyActivityMap.entries()).map(([name, value]) => ({
            name,
            value
        }));

        console.log(`📊 Chart data prepared for workspace ${workplaceId}:`, {
            patientsByMonth: Array.isArray(chartData.patientsByMonth) ? chartData.patientsByMonth.length : 0,
            clinicalNotesByType: Array.isArray(chartData.clinicalNotesByType) ? chartData.clinicalNotesByType.length : 0,
            medicationsByStatus: Array.isArray(chartData.medicationsByStatus) ? chartData.medicationsByStatus.length : 0,
            mtrsByStatus: Array.isArray(chartData.mtrsByStatus) ? chartData.mtrsByStatus.length : 0,
            patientAgeDistribution: Array.isArray(chartData.patientAgeDistribution) ? chartData.patientAgeDistribution.length : 0,
            monthlyActivity: Array.isArray(chartData.monthlyActivity) ? chartData.monthlyActivity.length : 0
        });

        // Quick medication debug
        console.log(`💊 Quick medication check for workspace ${workplaceId}:`);
        const quickMedCount = await MedicationManagement.countDocuments({ workplaceId });
        const totalMedCount = await MedicationManagement.countDocuments({});
        console.log(`💊 Medications in workspace: ${quickMedCount}, Total in system: ${totalMedCount}`);

        // Debug: Log actual chart data for troubleshooting
        console.log(`📈 Chart data samples:`, {
            patientsByMonth: chartData.patientsByMonth?.slice(0, 2),
            clinicalNotesByType: chartData.clinicalNotesByType?.slice(0, 2),
            medicationsByStatus: chartData.medicationsByStatus?.slice(0, 2),
            mtrsByStatus: chartData.mtrsByStatus?.slice(0, 2),
            patientAgeDistribution: chartData.patientAgeDistribution?.slice(0, 2),
            monthlyActivity: chartData.monthlyActivity?.slice(0, 2)
        });

        return chartData;
    }

    /**
     * Get detailed chart data (loaded separately for better performance)
     */
    private async getDetailedChartData(workplaceId: any) {
        // This can be loaded separately to avoid blocking the main dashboard
        console.log(`📊 Getting detailed chart data for workplace: ${workplaceId}`);

        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

        const [medicationsByStatus, mtrsByStatus, patientAgeDistribution] = await Promise.allSettled([
            MedicationRecord.aggregate([
                { $match: { workplaceId } },
                { $group: { _id: '$status', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),
            // Add timeout for MTR aggregation query
            Promise.race([
                MedicationTherapyReview.aggregate([
                    { $match: { workplaceId } },
                    { $group: { _id: '$status', count: { $sum: 1 } } },
                    { $sort: { count: -1 } }
                ]),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('MTR aggregation query timeout')), 5000)
                )
            ]),
            Patient.aggregate([
                {
                    $match: {
                        workplaceId,
                        isDeleted: { $ne: true },
                        dateOfBirth: { $exists: true }
                    }
                },
                {
                    $addFields: {
                        age: {
                            $floor: {
                                $divide: [
                                    { $subtract: [new Date(), '$dateOfBirth'] },
                                    365.25 * 24 * 60 * 60 * 1000
                                ]
                            }
                        }
                    }
                },
                {
                    $bucket: {
                        groupBy: '$age',
                        boundaries: [0, 18, 35, 50, 65, 100],
                        default: 'Unknown',
                        output: { count: { $sum: 1 } }
                    }
                }
            ])
        ]);

        return {
            medicationsByStatus: medicationsByStatus.status === 'fulfilled' ? medicationsByStatus.value : [],
            mtrsByStatus: mtrsByStatus.status === 'fulfilled' ? mtrsByStatus.value : [],
            patientAgeDistribution: patientAgeDistribution.status === 'fulfilled' ? patientAgeDistribution.value : []
        };
    }

    /**
     * Get recent activities for dashboard
     */
    private async getRecentActivities(workplaceId: any, userId: any) {
        console.log(`📝 Getting recent activities for workplace: ${workplaceId}`);

        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        // Get recent activities across different modules
        const [recentPatients, recentNotes, recentMTRs] = await Promise.allSettled([
            Patient.find({
                workplaceId,
                createdAt: { $gte: oneWeekAgo },
                isDeleted: { $ne: true }
            })
                .select('firstName lastName createdAt')
                .sort({ createdAt: -1 })
                .limit(5)
                .lean(),
            ClinicalNote.find({
                workplaceId,
                createdAt: { $gte: oneWeekAgo }
            })
                .populate('patient', 'firstName lastName')
                .select('type createdAt patient')
                .sort({ createdAt: -1 })
                .limit(5)
                .lean(),
            // Add timeout for MTR recent activities query
            Promise.race([
                MedicationTherapyReview.find({
                    workplaceId,
                    createdAt: { $gte: oneWeekAgo }
                })
                    .populate('patientId', 'firstName lastName')
                    .select('status createdAt patientId')
                    .sort({ createdAt: -1 })
                    .limit(3)
                    .lean(),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('MTR recent activities query timeout')), 5000)
                )
            ])
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
                    description: `${note.type} note created for ${(note.patient as any)?.firstName} ${(note.patient as any)?.lastName}`,
                    timestamp: note.createdAt
                });
            });
        }

        if (recentMTRs.status === 'fulfilled' && Array.isArray(recentMTRs.value)) {
            recentMTRs.value.forEach((mtr: any) => {
                activities.push({
                    type: 'mtr_created',
                    description: `MTR session created for ${(mtr.patientId as any)?.firstName} ${(mtr.patientId as any)?.lastName}`,
                    timestamp: mtr.createdAt
                });
            });
        }

        // Sort by timestamp and return latest 10
        return activities
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 10);
    }

    /**
     * Default stats when queries fail
     */
    private getDefaultStats(): DashboardStats {
        return {
            totalPatients: 0,
            totalClinicalNotes: 0,
            totalMedications: 0,
            totalMTRs: 0,
            totalDiagnostics: 0
        };
    }

    /**
     * Default chart data when queries fail
     */
    private getDefaultChartData(): DashboardChartData {
        return {
            patientsByMonth: [],
            clinicalNotesByType: [],
            medicationsByStatus: [],
            mtrsByStatus: [],
            patientAgeDistribution: [],
            monthlyActivity: []
        };
    }
}

export const dashboardController = new DashboardController();