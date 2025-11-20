import { Request, Response } from 'express';
import mongoose from 'mongoose';
import DiagnosticCase from '../models/DiagnosticCase';
import Visit from '../models/Visit';
import Patient from '../models/Patient';
import Workplace from '../models/Workplace';

/**
 * Super Admin Health Records Controller
 * Provides cross-workspace analytics and management for health records
 */

/**
 * @route   GET /api/super-admin/health-records/analytics
 * @desc    Get aggregate health records analytics across all workspaces
 * @access  Super Admin only
 */
export const getHealthRecordsAnalytics = async (req: Request, res: Response) => {
    try {
        const { startDate, endDate, workspaceId } = req.query;

        // Build date filter
        const dateFilter: any = {};
        if (startDate) {
            dateFilter.$gte = new Date(startDate as string);
        }
        if (endDate) {
            dateFilter.$lte = new Date(endDate as string);
        }

        // Build workspace filter
        const workspaceFilter: any = {};
        if (workspaceId) {
            workspaceFilter.workplace = new mongoose.Types.ObjectId(workspaceId as string);
        }

        // Aggregate lab results statistics
        const labResultsStats = await DiagnosticCase.aggregate([
            {
                $match: {
                    ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
                    ...workspaceFilter,
                },
            },
            {
                $group: {
                    _id: null,
                    totalLabResults: { $sum: 1 },
                    completedLabResults: {
                        $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
                    },
                    pendingLabResults: {
                        $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
                    },
                    withInterpretations: {
                        $sum: { $cond: [{ $ne: ['$patientInterpretation', null] }, 1, 0] },
                    },
                    visibleToPatient: {
                        $sum: { $cond: ['$patientInterpretation.isVisibleToPatient', 1, 0] },
                    },
                    abnormalResults: {
                        $sum: {
                            $cond: [
                                {
                                    $gt: [
                                        {
                                            $size: {
                                                $filter: {
                                                    input: '$labResults',
                                                    as: 'result',
                                                    cond: { $eq: ['$$result.abnormal', true] },
                                                },
                                            },
                                        },
                                        0,
                                    ],
                                },
                                1,
                                0,
                            ],
                        },
                    },
                },
            },
        ]);

        // Aggregate vitals statistics
        const vitalsStats = await Patient.aggregate([
            {
                $match: workspaceFilter,
            },
            {
                $project: {
                    vitals: {
                        $filter: {
                            input: '$patientLoggedVitals',
                            as: 'vital',
                            cond: {
                                $and: [
                                    Object.keys(dateFilter).length > 0
                                        ? {
                                            $gte: ['$$vital.recordedDate', dateFilter.$gte || new Date(0)],
                                        }
                                        : true,
                                    Object.keys(dateFilter).length > 0 && dateFilter.$lte
                                        ? {
                                            $lte: ['$$vital.recordedDate', dateFilter.$lte],
                                        }
                                        : true,
                                ],
                            },
                        },
                    },
                },
            },
            {
                $unwind: '$vitals',
            },
            {
                $group: {
                    _id: null,
                    totalVitalsRecords: { $sum: 1 },
                    verifiedVitals: {
                        $sum: { $cond: ['$vitals.isVerified', 1, 0] },
                    },
                    pendingVerification: {
                        $sum: { $cond: [{ $not: '$vitals.isVerified' }, 1, 0] },
                    },
                },
            },
        ]);

        // Aggregate visit statistics
        const visitStats = await Visit.aggregate([
            {
                $match: {
                    ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
                    ...workspaceFilter,
                },
            },
            {
                $group: {
                    _id: null,
                    totalVisits: { $sum: 1 },
                    withSummaries: {
                        $sum: { $cond: [{ $ne: ['$patientSummary', null] }, 1, 0] },
                    },
                    summariesVisible: {
                        $sum: { $cond: ['$patientSummary.visibleToPatient', 1, 0] },
                    },
                },
            },
        ]);

        // Get workspace-level breakdown
        const workspaceBreakdown = await DiagnosticCase.aggregate([
            {
                $match: Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {},
            },
            {
                $group: {
                    _id: '$workplace',
                    labResults: { $sum: 1 },
                },
            },
            {
                $lookup: {
                    from: 'workplaces',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'workplaceInfo',
                },
            },
            {
                $unwind: '$workplaceInfo',
            },
            {
                $project: {
                    workspaceId: '$_id',
                    workspaceName: '$workplaceInfo.businessName',
                    labResults: 1,
                },
            },
            {
                $sort: { labResults: -1 },
            },
            {
                $limit: 10,
            },
        ]);

        // Get trends (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const labResultsTrends = await DiagnosticCase.aggregate([
            {
                $match: {
                    createdAt: { $gte: thirtyDaysAgo },
                    ...workspaceFilter,
                },
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
                    },
                    count: { $sum: 1 },
                },
            },
            {
                $sort: { _id: 1 },
            },
        ]);

        const vitalsTrends = await Patient.aggregate([
            {
                $match: workspaceFilter,
            },
            {
                $unwind: '$patientLoggedVitals',
            },
            {
                $match: {
                    'patientLoggedVitals.recordedDate': { $gte: thirtyDaysAgo },
                },
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: '$patientLoggedVitals.recordedDate',
                        },
                    },
                    count: { $sum: 1 },
                },
            },
            {
                $sort: { _id: 1 },
            },
        ]);

        const visitsTrends = await Visit.aggregate([
            {
                $match: {
                    date: { $gte: thirtyDaysAgo },
                    ...workspaceFilter,
                },
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$date' },
                    },
                    count: { $sum: 1 },
                },
            },
            {
                $sort: { _id: 1 },
            },
        ]);

        res.status(200).json({
            success: true,
            data: {
                summary: {
                    labResults: labResultsStats[0] || {
                        totalLabResults: 0,
                        completedLabResults: 0,
                        pendingLabResults: 0,
                        withInterpretations: 0,
                        visibleToPatient: 0,
                        abnormalResults: 0,
                    },
                    vitals: vitalsStats[0] || {
                        totalVitalsRecords: 0,
                        verifiedVitals: 0,
                        pendingVerification: 0,
                    },
                    visits: visitStats[0] || {
                        totalVisits: 0,
                        withSummaries: 0,
                        summariesVisible: 0,
                    },
                },
                workspaceBreakdown,
                trends: {
                    labResults: labResultsTrends,
                    vitals: vitalsTrends,
                    visits: visitsTrends,
                },
                dateRange: {
                    startDate: startDate || null,
                    endDate: endDate || null,
                },
                workspaceFilter: workspaceId || null,
            },
        });
    } catch (error) {
        console.error('Error fetching health records analytics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch health records analytics',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

/**
 * @route   GET /api/super-admin/health-records/by-workspace
 * @desc    Get health records filtered by workspace
 * @access  Super Admin only
 */
export const getHealthRecordsByWorkspace = async (req: Request, res: Response) => {
    try {
        const { workspaceId, page = 1, limit = 50, type } = req.query;

        if (!workspaceId) {
            return res.status(400).json({
                success: false,
                message: 'Workspace ID is required',
            });
        }

        const workspaceObjectId = new mongoose.Types.ObjectId(workspaceId as string);
        const skip = (Number(page) - 1) * Number(limit);

        // Get workspace information
        const workspace = await Workplace.findById(workspaceObjectId).select(
            'name email phone locations'
        );

        if (!workspace) {
            return res.status(404).json({
                success: false,
                message: 'Workspace not found',
            });
        }

        const results: any = {
            workspace: {
                id: workspace._id,
                name: workspace.name,
                email: workspace.email,
                phone: workspace.phone,
                locations: workspace.locations,
            },
            records: {},
        };

        // Fetch lab results if requested
        if (!type || type === 'lab') {
            const labResults = await DiagnosticCase.find({ workplace: workspaceObjectId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .populate('patientId', 'firstName lastName email phone')
                .select('-__v');

            const totalLabResults = await DiagnosticCase.countDocuments({
                workplace: workspaceObjectId,
            });

            results.records.labResults = {
                data: labResults,
                pagination: {
                    total: totalLabResults,
                    page: Number(page),
                    limit: Number(limit),
                    totalPages: Math.ceil(totalLabResults / Number(limit)),
                },
            };
        }

        // Fetch vitals if requested
        if (!type || type === 'vitals') {
            const patients = await Patient.find({ workplace: workspaceObjectId })
                .select('firstName lastName email phone patientLoggedVitals')
                .sort({ 'patientLoggedVitals.recordedDate': -1 })
                .skip(skip)
                .limit(Number(limit));

            const vitalsData = patients.flatMap((patient) =>
                patient.patientLoggedVitals.map((vital) => ({
                    patientId: patient._id,
                    patientName: `${patient.firstName} ${patient.lastName}`,
                    patientEmail: patient.email,
                    ...vital,
                }))
            );

            const totalVitals = await Patient.aggregate([
                { $match: { workplace: workspaceObjectId } },
                { $project: { vitalsCount: { $size: '$patientLoggedVitals' } } },
                { $group: { _id: null, total: { $sum: '$vitalsCount' } } },
            ]);

            results.records.vitals = {
                data: vitalsData,
                pagination: {
                    total: totalVitals[0]?.total || 0,
                    page: Number(page),
                    limit: Number(limit),
                    totalPages: Math.ceil((totalVitals[0]?.total || 0) / Number(limit)),
                },
            };
        }

        // Fetch visits if requested
        if (!type || type === 'visits') {
            const visits = await Visit.find({ workplace: workspaceObjectId })
                .sort({ date: -1 })
                .skip(skip)
                .limit(Number(limit))
                .populate('patientId', 'firstName lastName email phone')
                .populate('pharmacistId', 'firstName lastName email')
                .select('-__v');

            const totalVisits = await Visit.countDocuments({
                workplace: workspaceObjectId,
            });

            results.records.visits = {
                data: visits,
                pagination: {
                    total: totalVisits,
                    page: Number(page),
                    limit: Number(limit),
                    totalPages: Math.ceil(totalVisits / Number(limit)),
                },
            };
        }

        res.status(200).json({
            success: true,
            data: results,
        });
    } catch (error) {
        console.error('Error fetching health records by workspace:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch health records by workspace',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

/**
 * @route   GET /api/super-admin/health-records/search
 * @desc    Global search across all health records
 * @access  Super Admin only
 */
export const searchHealthRecords = async (req: Request, res: Response) => {
    try {
        const {
            query,
            type,
            workspaceId,
            status,
            startDate,
            endDate,
            page = 1,
            limit = 50,
        } = req.query;

        if (!query || typeof query !== 'string' || query.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Search query must be at least 2 characters',
            });
        }

        const searchRegex = new RegExp(query.trim(), 'i');
        const skip = (Number(page) - 1) * Number(limit);

        // Build common filters
        const dateFilter: any = {};
        if (startDate) {
            dateFilter.$gte = new Date(startDate as string);
        }
        if (endDate) {
            dateFilter.$lte = new Date(endDate as string);
        }

        const workspaceFilter: any = {};
        if (workspaceId) {
            workspaceFilter.workplace = new mongoose.Types.ObjectId(workspaceId as string);
        }

        const results: any = {};

        // Search lab results
        if (!type || type === 'lab') {
            const labFilter: any = {
                ...workspaceFilter,
                ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
                ...(status && { status }),
                $or: [
                    { caseId: searchRegex },
                    { 'labResults.testName': searchRegex },
                    { 'patientInterpretation.summary': searchRegex },
                ],
            };

            const labResults = await DiagnosticCase.find(labFilter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .populate('patientId', 'firstName lastName email phone')
                .populate('workplace', 'businessName email')
                .select('-__v');

            const totalLabResults = await DiagnosticCase.countDocuments(labFilter);

            results.labResults = {
                data: labResults,
                pagination: {
                    total: totalLabResults,
                    page: Number(page),
                    limit: Number(limit),
                    totalPages: Math.ceil(totalLabResults / Number(limit)),
                },
            };
        }

        // Search visits
        if (!type || type === 'visits') {
            const visitFilter: any = {
                ...workspaceFilter,
                ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
                $or: [
                    { chiefComplaint: searchRegex },
                    { assessment: searchRegex },
                    { recommendations: searchRegex },
                    { 'patientSummary.summary': searchRegex },
                ],
            };

            const visits = await Visit.find(visitFilter)
                .sort({ date: -1 })
                .skip(skip)
                .limit(Number(limit))
                .populate('patientId', 'firstName lastName email phone')
                .populate('pharmacistId', 'firstName lastName email')
                .populate('workplace', 'businessName email')
                .select('-__v');

            const totalVisits = await Visit.countDocuments(visitFilter);

            results.visits = {
                data: visits,
                pagination: {
                    total: totalVisits,
                    page: Number(page),
                    limit: Number(limit),
                    totalPages: Math.ceil(totalVisits / Number(limit)),
                },
            };
        }

        // Search patients (for vitals context)
        if (!type || type === 'vitals') {
            const patientFilter: any = {
                ...workspaceFilter,
                $or: [
                    { firstName: searchRegex },
                    { lastName: searchRegex },
                    { email: searchRegex },
                    { phone: searchRegex },
                ],
            };

            const patients = await Patient.find(patientFilter)
                .select('firstName lastName email phone patientLoggedVitals workplace')
                .skip(skip)
                .limit(Number(limit))
                .populate('workplace', 'businessName email');

            const vitalsData = patients.flatMap((patient) => {
                const filteredVitals = patient.patientLoggedVitals.filter((vital) => {
                    const vitalDate = new Date(vital.recordedDate);
                    return (
                        (!dateFilter.$gte || vitalDate >= dateFilter.$gte) &&
                        (!dateFilter.$lte || vitalDate <= dateFilter.$lte)
                    );
                });

                return filteredVitals.map((vital) => ({
                    patientId: patient._id,
                    patientName: `${patient.firstName} ${patient.lastName}`,
                    patientEmail: patient.email,
                    workspaceId: patient.workplaceId,
                    ...vital,
                }));
            });

            const totalPatients = await Patient.countDocuments(patientFilter);

            results.vitals = {
                data: vitalsData,
                pagination: {
                    total: totalPatients,
                    page: Number(page),
                    limit: Number(limit),
                    totalPages: Math.ceil(totalPatients / Number(limit)),
                },
            };
        }

        res.status(200).json({
            success: true,
            data: {
                query: query.trim(),
                filters: {
                    type: type || 'all',
                    workspaceId: workspaceId || null,
                    status: status || null,
                    dateRange: {
                        startDate: startDate || null,
                        endDate: endDate || null,
                    },
                },
                results,
            },
        });
    } catch (error) {
        console.error('Error searching health records:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to search health records',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

/**
 * @route   GET /api/super-admin/health-records/workspaces
 * @desc    Get list of all workspaces with health records summary
 * @access  Super Admin only
 */
export const getWorkspacesWithHealthRecordsSummary = async (
    req: Request,
    res: Response
) => {
    try {
        const workspaces = await Workplace.find({})
            .select('name email phone locations createdAt')
            .sort({ name: 1 });

        const workspacesWithSummary = await Promise.all(
            workspaces.map(async (workspace) => {
                const [labResultsCount, visitsCount, patientsCount] = await Promise.all([
                    DiagnosticCase.countDocuments({ workplace: workspace._id }),
                    Visit.countDocuments({ workplace: workspace._id }),
                    Patient.countDocuments({ workplaceId: workspace._id }),
                ]);

                // Get vitals count
                const vitalsCount = await Patient.aggregate([
                    { $match: { workplaceId: workspace._id } },
                    { $project: { vitalsCount: { $size: '$patientLoggedVitals' } } },
                    { $group: { _id: null, total: { $sum: '$vitalsCount' } } },
                ]);

                return {
                    workspaceId: workspace._id,
                    name: workspace.name,
                    email: workspace.email,
                    phone: workspace.phone,
                    locations: workspace.locations,
                    createdAt: workspace.createdAt,
                    healthRecordsSummary: {
                        labResults: labResultsCount,
                        visits: visitsCount,
                        vitals: vitalsCount[0]?.total || 0,
                        patients: patientsCount,
                        totalRecords: labResultsCount + visitsCount + (vitalsCount[0]?.total || 0),
                    },
                };
            })
        );

        // Sort by total records (most active workspaces first)
        workspacesWithSummary.sort(
            (a, b) => b.healthRecordsSummary.totalRecords - a.healthRecordsSummary.totalRecords
        );

        res.status(200).json({
            success: true,
            data: {
                totalWorkspaces: workspacesWithSummary.length,
                workspaces: workspacesWithSummary,
            },
        });
    } catch (error) {
        console.error('Error fetching workspaces with health records summary:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch workspaces summary',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
