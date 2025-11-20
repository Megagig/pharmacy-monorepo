import { Response } from 'express';
import mongoose from 'mongoose';
import MedicationTherapyReview from '../models/MedicationTherapyReview';
import DrugTherapyProblem from '../models/DrugTherapyProblem';
import MTRIntervention from '../models/MTRIntervention';
import MTRFollowUp from '../models/MTRFollowUp';
import { sendSuccess, sendError } from '../utils/responseHelpers';
import { AuthRequest } from '../middlewares/auth';

/**
 * MTR Reports Controller
 * Handles analytics and reporting endpoints for MTR module
 */

interface DateRange {
    start: Date;
    end: Date;
}

interface ReportFilters {
    dateRange?: DateRange;
    pharmacistId?: string;
    patientId?: string;
    reviewType?: string;
    priority?: string;
}

/**
 * Get MTR summary statistics
 */
export const getMTRSummaryReport = async (req: AuthRequest, res: Response) => {
    try {
        const { startDate, endDate, pharmacistId, reviewType, priority } = req.query;
        const workplaceId = req.user?.workplaceId;

        // Build date filter
        const dateFilter: any = {};
        if (startDate || endDate) {
            dateFilter.createdAt = {};
            if (startDate) dateFilter.createdAt.$gte = new Date(startDate as string);
            if (endDate) dateFilter.createdAt.$lte = new Date(endDate as string);
        }

        // Build additional filters
        const additionalFilters: any = {};
        if (pharmacistId) additionalFilters.pharmacistId = new mongoose.Types.ObjectId(pharmacistId as string);
        if (reviewType) additionalFilters.reviewType = reviewType;
        if (priority) additionalFilters.priority = priority;

        const matchStage = {
            workplaceId: new mongoose.Types.ObjectId(workplaceId),
            isDeleted: false,
            ...dateFilter,
            ...additionalFilters
        };

        // Aggregate MTR statistics
        const mtrStats = await MedicationTherapyReview.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: null,
                    totalReviews: { $sum: 1 },
                    completedReviews: {
                        $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                    },
                    inProgressReviews: {
                        $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] }
                    },
                    cancelledReviews: {
                        $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
                    },
                    onHoldReviews: {
                        $sum: { $cond: [{ $eq: ['$status', 'on_hold'] }, 1, 0] }
                    },
                    avgCompletionTime: {
                        $avg: {
                            $cond: [
                                { $ne: ['$completedAt', null] },
                                {
                                    $divide: [
                                        { $subtract: ['$completedAt', '$startedAt'] },
                                        1000 * 60 * 60 * 24 // Convert to days
                                    ]
                                },
                                null
                            ]
                        }
                    },
                    totalProblemsResolved: { $sum: '$clinicalOutcomes.problemsResolved' },
                    totalMedicationsOptimized: { $sum: '$clinicalOutcomes.medicationsOptimized' },
                    adherenceImprovedCount: {
                        $sum: { $cond: ['$clinicalOutcomes.adherenceImproved', 1, 0] }
                    },
                    adverseEventsReducedCount: {
                        $sum: { $cond: ['$clinicalOutcomes.adverseEventsReduced', 1, 0] }
                    },
                    totalCostSavings: { $sum: '$clinicalOutcomes.costSavings' }
                }
            }
        ]);

        // Get review type distribution
        const reviewTypeDistribution = await MedicationTherapyReview.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$reviewType',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        // Get priority distribution
        const priorityDistribution = await MedicationTherapyReview.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$priority',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        // Get monthly trends (last 12 months)
        const monthlyTrends = await MedicationTherapyReview.aggregate([
            {
                $match: {
                    ...matchStage,
                    createdAt: {
                        $gte: new Date(new Date().setMonth(new Date().getMonth() - 12))
                    }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    totalReviews: { $sum: 1 },
                    completedReviews: {
                        $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                    },
                    avgCompletionTime: {
                        $avg: {
                            $cond: [
                                { $ne: ['$completedAt', null] },
                                {
                                    $divide: [
                                        { $subtract: ['$completedAt', '$startedAt'] },
                                        1000 * 60 * 60 * 24
                                    ]
                                },
                                null
                            ]
                        }
                    }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        const summary = mtrStats[0] || {
            totalReviews: 0,
            completedReviews: 0,
            inProgressReviews: 0,
            cancelledReviews: 0,
            onHoldReviews: 0,
            avgCompletionTime: 0,
            totalProblemsResolved: 0,
            totalMedicationsOptimized: 0,
            adherenceImprovedCount: 0,
            adverseEventsReducedCount: 0,
            totalCostSavings: 0
        };

        // Calculate completion rate
        const completionRate = summary.totalReviews > 0
            ? (summary.completedReviews / summary.totalReviews) * 100
            : 0;

        sendSuccess(res, {
            summary: {
                ...summary,
                completionRate: Math.round(completionRate * 100) / 100,
                avgCompletionTime: Math.round((summary.avgCompletionTime || 0) * 100) / 100
            },
            distributions: {
                reviewType: reviewTypeDistribution,
                priority: priorityDistribution
            },
            trends: {
                monthly: monthlyTrends
            }
        }, 'MTR summary report generated successfully');

    } catch (error) {
        console.error('Error generating MTR summary report:', error);
        sendError(res, 'SERVER_ERROR', 'Failed to generate MTR summary report', 500);
    }
};

/**
 * Get intervention effectiveness report
 */
export const getInterventionEffectivenessReport = async (req: AuthRequest, res: Response) => {
    try {
        const { startDate, endDate, pharmacistId, interventionType } = req.query;
        const workplaceId = req.user?.workplaceId;

        // Build date filter
        const dateFilter: any = {};
        if (startDate || endDate) {
            dateFilter.createdAt = {};
            if (startDate) dateFilter.createdAt.$gte = new Date(startDate as string);
            if (endDate) dateFilter.createdAt.$lte = new Date(endDate as string);
        }

        // Build additional filters
        const additionalFilters: any = {};
        if (pharmacistId) additionalFilters.pharmacistId = new mongoose.Types.ObjectId(pharmacistId as string);
        if (interventionType) additionalFilters.type = interventionType;

        const matchStage = {
            workplaceId: new mongoose.Types.ObjectId(workplaceId),
            isDeleted: false,
            ...dateFilter,
            ...additionalFilters
        };

        // Get intervention statistics
        const interventionStats = await MTRIntervention.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: null,
                    totalInterventions: { $sum: 1 },
                    acceptedInterventions: {
                        $sum: { $cond: [{ $eq: ['$outcome', 'accepted'] }, 1, 0] }
                    },
                    rejectedInterventions: {
                        $sum: { $cond: [{ $eq: ['$outcome', 'rejected'] }, 1, 0] }
                    },
                    modifiedInterventions: {
                        $sum: { $cond: [{ $eq: ['$outcome', 'modified'] }, 1, 0] }
                    },
                    pendingInterventions: {
                        $sum: { $cond: [{ $eq: ['$outcome', 'pending'] }, 1, 0] }
                    },
                    avgAcceptanceRate: { $avg: '$acceptanceRate' }
                }
            }
        ]);

        // Get intervention type effectiveness
        const typeEffectiveness = await MTRIntervention.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$type',
                    totalInterventions: { $sum: 1 },
                    acceptedInterventions: {
                        $sum: { $cond: [{ $eq: ['$outcome', 'accepted'] }, 1, 0] }
                    },
                    avgAcceptanceRate: { $avg: '$acceptanceRate' }
                }
            },
            {
                $addFields: {
                    acceptanceRate: {
                        $multiply: [
                            { $divide: ['$acceptedInterventions', '$totalInterventions'] },
                            100
                        ]
                    }
                }
            },
            { $sort: { acceptanceRate: -1 } }
        ]);

        // Get intervention category effectiveness
        const categoryEffectiveness = await MTRIntervention.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$category',
                    totalInterventions: { $sum: 1 },
                    acceptedInterventions: {
                        $sum: { $cond: [{ $eq: ['$outcome', 'accepted'] }, 1, 0] }
                    }
                }
            },
            {
                $addFields: {
                    acceptanceRate: {
                        $multiply: [
                            { $divide: ['$acceptedInterventions', '$totalInterventions'] },
                            100
                        ]
                    }
                }
            },
            { $sort: { acceptanceRate: -1 } }
        ]);

        // Get pharmacist performance
        const pharmacistPerformance = await MTRIntervention.aggregate([
            { $match: matchStage },
            {
                $lookup: {
                    from: 'users',
                    localField: 'pharmacistId',
                    foreignField: '_id',
                    as: 'pharmacist'
                }
            },
            { $unwind: '$pharmacist' },
            {
                $group: {
                    _id: '$pharmacistId',
                    pharmacistName: { $first: '$pharmacist.name' },
                    totalInterventions: { $sum: 1 },
                    acceptedInterventions: {
                        $sum: { $cond: [{ $eq: ['$outcome', 'accepted'] }, 1, 0] }
                    },
                    avgAcceptanceRate: { $avg: '$acceptanceRate' }
                }
            },
            {
                $addFields: {
                    acceptanceRate: {
                        $multiply: [
                            { $divide: ['$acceptedInterventions', '$totalInterventions'] },
                            100
                        ]
                    }
                }
            },
            { $sort: { acceptanceRate: -1 } }
        ]);

        const summary = interventionStats[0] || {
            totalInterventions: 0,
            acceptedInterventions: 0,
            rejectedInterventions: 0,
            modifiedInterventions: 0,
            pendingInterventions: 0,
            avgAcceptanceRate: 0
        };

        // Calculate overall acceptance rate
        const overallAcceptanceRate = summary.totalInterventions > 0
            ? (summary.acceptedInterventions / summary.totalInterventions) * 100
            : 0;

        sendSuccess(res, {
            summary: {
                ...summary,
                overallAcceptanceRate: Math.round(overallAcceptanceRate * 100) / 100
            },
            effectiveness: {
                byType: typeEffectiveness,
                byCategory: categoryEffectiveness
            },
            pharmacistPerformance
        }, 'Intervention effectiveness report generated successfully');

    } catch (error) {
        console.error('Error generating intervention effectiveness report:', error);
        sendError(res, 'SERVER_ERROR', 'Failed to generate intervention effectiveness report', 500);
    }
};

/**
 * Get pharmacist performance analytics
 */
export const getPharmacistPerformanceReport = async (req: AuthRequest, res: Response) => {
    try {
        const { startDate, endDate, pharmacistId } = req.query;
        const workplaceId = req.user?.workplaceId;

        // Build date filter
        const dateFilter: any = {};
        if (startDate || endDate) {
            dateFilter.createdAt = {};
            if (startDate) dateFilter.createdAt.$gte = new Date(startDate as string);
            if (endDate) dateFilter.createdAt.$lte = new Date(endDate as string);
        }

        // Build pharmacist filter
        const pharmacistFilter: any = {};
        if (pharmacistId) {
            pharmacistFilter.pharmacistId = new mongoose.Types.ObjectId(pharmacistId as string);
        }

        const matchStage = {
            workplaceId: new mongoose.Types.ObjectId(workplaceId),
            isDeleted: false,
            ...dateFilter,
            ...pharmacistFilter
        };

        // Get pharmacist MTR performance
        const pharmacistMTRStats = await MedicationTherapyReview.aggregate([
            { $match: matchStage },
            {
                $lookup: {
                    from: 'users',
                    localField: 'pharmacistId',
                    foreignField: '_id',
                    as: 'pharmacist'
                }
            },
            { $unwind: '$pharmacist' },
            {
                $group: {
                    _id: '$pharmacistId',
                    pharmacistName: { $first: '$pharmacist.name' },
                    totalReviews: { $sum: 1 },
                    completedReviews: {
                        $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                    },
                    avgCompletionTime: {
                        $avg: {
                            $cond: [
                                { $ne: ['$completedAt', null] },
                                {
                                    $divide: [
                                        { $subtract: ['$completedAt', '$startedAt'] },
                                        1000 * 60 * 60 * 24
                                    ]
                                },
                                null
                            ]
                        }
                    },
                    totalProblemsIdentified: { $sum: { $size: '$problems' } },
                    totalProblemsResolved: { $sum: '$clinicalOutcomes.problemsResolved' },
                    totalMedicationsOptimized: { $sum: '$clinicalOutcomes.medicationsOptimized' },
                    totalCostSavings: { $sum: '$clinicalOutcomes.costSavings' }
                }
            },
            {
                $addFields: {
                    completionRate: {
                        $multiply: [
                            { $divide: ['$completedReviews', '$totalReviews'] },
                            100
                        ]
                    },
                    problemResolutionRate: {
                        $multiply: [
                            {
                                $divide: [
                                    '$totalProblemsResolved',
                                    { $cond: [{ $eq: ['$totalProblemsIdentified', 0] }, 1, '$totalProblemsIdentified'] }
                                ]
                            },
                            100
                        ]
                    }
                }
            },
            { $sort: { completionRate: -1 } }
        ]);

        // Get pharmacist intervention performance
        const pharmacistInterventionStats = await MTRIntervention.aggregate([
            { $match: matchStage },
            {
                $lookup: {
                    from: 'users',
                    localField: 'pharmacistId',
                    foreignField: '_id',
                    as: 'pharmacist'
                }
            },
            { $unwind: '$pharmacist' },
            {
                $group: {
                    _id: '$pharmacistId',
                    pharmacistName: { $first: '$pharmacist.name' },
                    totalInterventions: { $sum: 1 },
                    acceptedInterventions: {
                        $sum: { $cond: [{ $eq: ['$outcome', 'accepted'] }, 1, 0] }
                    },
                    avgAcceptanceRate: { $avg: '$acceptanceRate' }
                }
            },
            {
                $addFields: {
                    interventionAcceptanceRate: {
                        $multiply: [
                            { $divide: ['$acceptedInterventions', '$totalInterventions'] },
                            100
                        ]
                    }
                }
            }
        ]);

        // Merge MTR and intervention stats
        const combinedStats = pharmacistMTRStats.map(mtrStat => {
            const interventionStat = pharmacistInterventionStats.find(
                intStat => intStat._id.toString() === mtrStat._id.toString()
            );

            return {
                ...mtrStat,
                totalInterventions: interventionStat?.totalInterventions || 0,
                acceptedInterventions: interventionStat?.acceptedInterventions || 0,
                interventionAcceptanceRate: interventionStat?.interventionAcceptanceRate || 0
            };
        });

        // Calculate quality scores
        const qualityScores = combinedStats.map(stat => {
            const completionWeight = 0.3;
            const problemResolutionWeight = 0.3;
            const interventionAcceptanceWeight = 0.2;
            const efficiencyWeight = 0.2;

            // Efficiency score based on completion time (lower is better, max 14 days)
            const efficiencyScore = Math.max(0, 100 - ((stat.avgCompletionTime || 14) / 14) * 100);

            const qualityScore =
                (stat.completionRate * completionWeight) +
                (stat.problemResolutionRate * problemResolutionWeight) +
                (stat.interventionAcceptanceRate * interventionAcceptanceWeight) +
                (efficiencyScore * efficiencyWeight);

            return {
                ...stat,
                efficiencyScore: Math.round(efficiencyScore * 100) / 100,
                qualityScore: Math.round(qualityScore * 100) / 100
            };
        }).sort((a, b) => b.qualityScore - a.qualityScore);

        sendSuccess(res, {
            pharmacistPerformance: qualityScores,
            summary: {
                totalPharmacists: qualityScores.length,
                avgQualityScore: qualityScores.length > 0
                    ? qualityScores.reduce((sum, p) => sum + p.qualityScore, 0) / qualityScores.length
                    : 0,
                topPerformer: qualityScores[0] || null
            }
        }, 'Pharmacist performance report generated successfully');

    } catch (error) {
        console.error('Error generating pharmacist performance report:', error);
        sendError(res, 'SERVER_ERROR', 'Failed to generate pharmacist performance report', 500);
    }
};

/**
 * Get quality assurance report
 */
export const getQualityAssuranceReport = async (req: AuthRequest, res: Response) => {
    try {
        const { startDate, endDate } = req.query;
        const workplaceId = req.user?.workplaceId;

        // Build date filter
        const dateFilter: any = {};
        if (startDate || endDate) {
            dateFilter.createdAt = {};
            if (startDate) dateFilter.createdAt.$gte = new Date(startDate as string);
            if (endDate) dateFilter.createdAt.$lte = new Date(endDate as string);
        }

        const matchStage = {
            workplaceId: new mongoose.Types.ObjectId(workplaceId),
            isDeleted: false,
            ...dateFilter
        };

        // Get completion time analysis
        const completionTimeAnalysis = await MedicationTherapyReview.aggregate([
            {
                $match: {
                    ...matchStage,
                    status: 'completed',
                    completedAt: { $ne: null }
                }
            },
            {
                $addFields: {
                    completionDays: {
                        $divide: [
                            { $subtract: ['$completedAt', '$startedAt'] },
                            1000 * 60 * 60 * 24
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: '$priority',
                    avgCompletionTime: { $avg: '$completionDays' },
                    minCompletionTime: { $min: '$completionDays' },
                    maxCompletionTime: { $max: '$completionDays' },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Get problem identification patterns
        const problemPatterns = await DrugTherapyProblem.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: {
                        category: '$category',
                        severity: '$severity'
                    },
                    count: { $sum: 1 },
                    resolvedCount: {
                        $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
                    }
                }
            },
            {
                $addFields: {
                    resolutionRate: {
                        $multiply: [
                            { $divide: ['$resolvedCount', '$count'] },
                            100
                        ]
                    }
                }
            },
            { $sort: { count: -1 } }
        ]);

        // Get follow-up compliance
        const followUpCompliance = await MTRFollowUp.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: null,
                    totalFollowUps: { $sum: 1 },
                    completedFollowUps: {
                        $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                    },
                    missedFollowUps: {
                        $sum: { $cond: [{ $eq: ['$status', 'missed'] }, 1, 0] }
                    },
                    rescheduledFollowUps: {
                        $sum: { $cond: [{ $eq: ['$status', 'rescheduled'] }, 1, 0] }
                    }
                }
            },
            {
                $addFields: {
                    complianceRate: {
                        $multiply: [
                            { $divide: ['$completedFollowUps', '$totalFollowUps'] },
                            100
                        ]
                    }
                }
            }
        ]);

        // Get documentation quality metrics
        const documentationQuality = await MedicationTherapyReview.aggregate([
            { $match: matchStage },
            {
                $addFields: {
                    hasCompletePlan: {
                        $and: [
                            { $ne: ['$plan', null] },
                            { $gt: [{ $size: { $ifNull: ['$plan.recommendations', []] } }, 0] },
                            { $ne: ['$plan.pharmacistNotes', ''] }
                        ]
                    },
                    hasMedications: { $gt: [{ $size: { $ifNull: ['$medications', []] } }, 0] },
                    hasProblems: { $gt: [{ $size: { $ifNull: ['$problems', []] } }, 0] }
                }
            },
            {
                $group: {
                    _id: null,
                    totalReviews: { $sum: 1 },
                    reviewsWithCompletePlans: {
                        $sum: { $cond: ['$hasCompletePlan', 1, 0] }
                    },
                    reviewsWithMedications: {
                        $sum: { $cond: ['$hasMedications', 1, 0] }
                    },
                    reviewsWithProblems: {
                        $sum: { $cond: ['$hasProblems', 1, 0] }
                    }
                }
            },
            {
                $addFields: {
                    planCompletionRate: {
                        $multiply: [
                            { $divide: ['$reviewsWithCompletePlans', '$totalReviews'] },
                            100
                        ]
                    },
                    medicationDocumentationRate: {
                        $multiply: [
                            { $divide: ['$reviewsWithMedications', '$totalReviews'] },
                            100
                        ]
                    },
                    problemIdentificationRate: {
                        $multiply: [
                            { $divide: ['$reviewsWithProblems', '$totalReviews'] },
                            100
                        ]
                    }
                }
            }
        ]);

        const compliance = followUpCompliance[0] || {
            totalFollowUps: 0,
            completedFollowUps: 0,
            missedFollowUps: 0,
            rescheduledFollowUps: 0,
            complianceRate: 0
        };

        const docQuality = documentationQuality[0] || {
            totalReviews: 0,
            reviewsWithCompletePlans: 0,
            reviewsWithMedications: 0,
            reviewsWithProblems: 0,
            planCompletionRate: 0,
            medicationDocumentationRate: 0,
            problemIdentificationRate: 0
        };

        sendSuccess(res, {
            completionTimeAnalysis,
            problemPatterns,
            followUpCompliance: compliance,
            documentationQuality: docQuality,
            qualityMetrics: {
                avgPlanCompletionRate: docQuality.planCompletionRate,
                avgFollowUpCompliance: compliance.complianceRate,
                avgProblemResolutionRate: problemPatterns.length > 0
                    ? problemPatterns.reduce((sum, p) => sum + p.resolutionRate, 0) / problemPatterns.length
                    : 0
            }
        }, 'Quality assurance report generated successfully');

    } catch (error) {
        console.error('Error generating quality assurance report:', error);
        sendError(res, 'SERVER_ERROR', 'Failed to generate quality assurance report', 500);
    }
};

/**
 * Get outcome metrics report
 */
export const getOutcomeMetricsReport = async (req: AuthRequest, res: Response) => {
    try {
        const { startDate, endDate, reviewType } = req.query;
        const workplaceId = req.user?.workplaceId;

        // Build date filter
        const dateFilter: any = {};
        if (startDate || endDate) {
            dateFilter.completedAt = {};
            if (startDate) dateFilter.completedAt.$gte = new Date(startDate as string);
            if (endDate) dateFilter.completedAt.$lte = new Date(endDate as string);
        }

        // Build additional filters
        const additionalFilters: any = {};
        if (reviewType) additionalFilters.reviewType = reviewType;

        const matchStage = {
            workplaceId: new mongoose.Types.ObjectId(workplaceId),
            isDeleted: false,
            status: 'completed',
            ...dateFilter,
            ...additionalFilters
        };

        // Get clinical outcomes
        const clinicalOutcomes = await MedicationTherapyReview.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: null,
                    totalReviews: { $sum: 1 },
                    totalProblemsResolved: { $sum: '$clinicalOutcomes.problemsResolved' },
                    totalMedicationsOptimized: { $sum: '$clinicalOutcomes.medicationsOptimized' },
                    adherenceImprovedCount: {
                        $sum: { $cond: ['$clinicalOutcomes.adherenceImproved', 1, 0] }
                    },
                    adverseEventsReducedCount: {
                        $sum: { $cond: ['$clinicalOutcomes.adverseEventsReduced', 1, 0] }
                    },
                    qualityOfLifeImprovedCount: {
                        $sum: { $cond: ['$clinicalOutcomes.qualityOfLifeImproved', 1, 0] }
                    },
                    clinicalParametersImprovedCount: {
                        $sum: { $cond: ['$clinicalOutcomes.clinicalParametersImproved', 1, 0] }
                    },
                    totalCostSavings: { $sum: '$clinicalOutcomes.costSavings' }
                }
            }
        ]);

        const outcomes = clinicalOutcomes[0] || {
            totalReviews: 0,
            totalProblemsResolved: 0,
            totalMedicationsOptimized: 0,
            adherenceImprovedCount: 0,
            adverseEventsReducedCount: 0,
            qualityOfLifeImprovedCount: 0,
            clinicalParametersImprovedCount: 0,
            totalCostSavings: 0
        };

        sendSuccess(res, {
            clinicalOutcomes: outcomes,
            summary: {
                totalReviews: outcomes.totalReviews,
                totalCostSavings: outcomes.totalCostSavings,
                avgProblemsResolvedPerReview: outcomes.totalReviews > 0
                    ? Math.round((outcomes.totalProblemsResolved / outcomes.totalReviews) * 100) / 100
                    : 0,
                avgMedicationsOptimizedPerReview: outcomes.totalReviews > 0
                    ? Math.round((outcomes.totalMedicationsOptimized / outcomes.totalReviews) * 100) / 100
                    : 0
            }
        }, 'Outcome metrics report generated successfully');

    } catch (error) {
        console.error('Error generating outcome metrics report:', error);
        sendError(res, 'SERVER_ERROR', 'Failed to generate outcome metrics report', 500);
    }
};

/**
 * Get comprehensive patient outcome analytics
 */
export const getPatientOutcomeAnalytics = async (req: AuthRequest, res: Response) => {
    try {
        const { startDate, endDate, patientId, therapyType } = req.query;
        const workplaceId = req.user?.workplaceId;

        const dateFilter: any = {};
        if (startDate || endDate) {
            dateFilter.createdAt = {};
            if (startDate) dateFilter.createdAt.$gte = new Date(startDate as string);
            if (endDate) dateFilter.createdAt.$lte = new Date(endDate as string);
        }

        const additionalFilters: any = {};
        if (patientId) additionalFilters.patientId = new mongoose.Types.ObjectId(patientId as string);
        if (therapyType) additionalFilters.reviewType = therapyType;

        const matchStage = {
            workplaceId: new mongoose.Types.ObjectId(workplaceId),
            isDeleted: false,
            ...dateFilter,
            ...additionalFilters
        };

        // Therapy effectiveness metrics
        const therapyEffectiveness = await MedicationTherapyReview.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$reviewType',
                    totalReviews: { $sum: 1 },
                    completedReviews: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                    avgCompletionTime: {
                        $avg: {
                            $cond: [
                                { $ne: ['$completedAt', null] },
                                { $divide: [{ $subtract: ['$completedAt', '$startedAt'] }, 1000 * 60 * 60 * 24] },
                                null
                            ]
                        }
                    },
                    totalProblemsResolved: { $sum: '$clinicalOutcomes.problemsResolved' },
                    totalCostSavings: { $sum: '$clinicalOutcomes.costSavings' }
                }
            },
            {
                $addFields: {
                    completionRate: { $multiply: [{ $divide: ['$completedReviews', '$totalReviews'] }, 100] },
                    avgProblemsPerReview: { $divide: ['$totalProblemsResolved', '$totalReviews'] }
                }
            }
        ]);

        // Clinical parameter improvements
        const clinicalImprovements = await MedicationTherapyReview.aggregate([
            { $match: { ...matchStage, status: 'completed' } },
            {
                $group: {
                    _id: null,
                    bloodPressureImproved: { $sum: { $cond: ['$clinicalOutcomes.bloodPressureImproved', 1, 0] } },
                    bloodSugarImproved: { $sum: { $cond: ['$clinicalOutcomes.bloodSugarImproved', 1, 0] } },
                    cholesterolImproved: { $sum: { $cond: ['$clinicalOutcomes.cholesterolImproved', 1, 0] } },
                    painReduced: { $sum: { $cond: ['$clinicalOutcomes.painReduced', 1, 0] } },
                    totalReviews: { $sum: 1 }
                }
            }
        ]);

        // Adverse event reduction
        const adverseEventReduction = await MedicationTherapyReview.aggregate([
            { $match: { ...matchStage, status: 'completed' } },
            {
                $group: {
                    _id: '$reviewType',
                    totalReviews: { $sum: 1 },
                    adverseEventsReduced: { $sum: { $cond: ['$clinicalOutcomes.adverseEventsReduced', 1, 0] } },
                    avgAdverseEventReduction: { $avg: '$clinicalOutcomes.adverseEventReductionScore' }
                }
            },
            {
                $addFields: {
                    adverseEventReductionRate: { $multiply: [{ $divide: ['$adverseEventsReduced', '$totalReviews'] }, 100] }
                }
            }
        ]);

        sendSuccess(res, {
            therapyEffectiveness,
            clinicalImprovements: clinicalImprovements[0] || {},
            adverseEventReduction,
            summary: {
                totalTherapyTypes: therapyEffectiveness.length,
                avgCompletionRate: therapyEffectiveness.length > 0
                    ? therapyEffectiveness.reduce((sum, t) => sum + t.completionRate, 0) / therapyEffectiveness.length
                    : 0,
                totalCostSavings: therapyEffectiveness.reduce((sum, t) => sum + t.totalCostSavings, 0)
            }
        }, 'Patient outcome analytics generated successfully');

    } catch (error) {
        console.error('Error generating patient outcome analytics:', error);
        sendError(res, 'SERVER_ERROR', 'Failed to generate patient outcome analytics', 500);
    }
};

/**
 * Get cost-effectiveness analysis
 */
export const getCostEffectivenessAnalysis = async (req: AuthRequest, res: Response) => {
    try {
        const { startDate, endDate, interventionType } = req.query;
        const workplaceId = req.user?.workplaceId;

        const dateFilter: any = {};
        if (startDate || endDate) {
            dateFilter.createdAt = {};
            if (startDate) dateFilter.createdAt.$gte = new Date(startDate as string);
            if (endDate) dateFilter.createdAt.$lte = new Date(endDate as string);
        }

        const additionalFilters: any = {};
        if (interventionType) additionalFilters.type = interventionType;

        const matchStage = {
            workplaceId: new mongoose.Types.ObjectId(workplaceId),
            isDeleted: false,
            ...dateFilter,
            ...additionalFilters
        };

        // Cost savings by intervention type
        const costSavingsByType = await MTRIntervention.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$type',
                    totalInterventions: { $sum: 1 },
                    totalCostSavings: { $sum: '$costSavings' },
                    avgCostSavings: { $avg: '$costSavings' },
                    totalImplementationCost: { $sum: '$implementationCost' }
                }
            },
            {
                $addFields: {
                    roi: {
                        $multiply: [
                            {
                                $divide: [
                                    { $subtract: ['$totalCostSavings', '$totalImplementationCost'] },
                                    { $cond: [{ $eq: ['$totalImplementationCost', 0] }, 1, '$totalImplementationCost'] }
                                ]
                            },
                            100
                        ]
                    }
                }
            },
            { $sort: { totalCostSavings: -1 } }
        ]);

        // Revenue impact analysis
        const revenueImpact = await MedicationTherapyReview.aggregate([
            { $match: { ...matchStage, status: 'completed' } },
            {
                $group: {
                    _id: {
                        year: { $year: '$completedAt' },
                        month: { $month: '$completedAt' }
                    },
                    totalCostSavings: { $sum: '$clinicalOutcomes.costSavings' },
                    totalReviews: { $sum: 1 },
                    avgCostSavingsPerReview: { $avg: '$clinicalOutcomes.costSavings' }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        // Budget planning insights
        const budgetInsights = await MedicationTherapyReview.aggregate([
            { $match: { ...matchStage, status: 'completed' } },
            {
                $group: {
                    _id: null,
                    totalCostSavings: { $sum: '$clinicalOutcomes.costSavings' },
                    totalReviews: { $sum: 1 },
                    avgCostSavingsPerReview: { $avg: '$clinicalOutcomes.costSavings' },
                    projectedAnnualSavings: {
                        $sum: {
                            $map: {
                                input: { $range: [0, 12] },
                                as: "month",
                                in: { $avg: '$clinicalOutcomes.costSavings' }
                            }
                        }
                    }
                }
            }
        ]);

        // Format currency values in Nigerian Naira
        const formatCurrency = (amount: number) => new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: 'NGN',
            minimumFractionDigits: 2
        }).format(amount);

        const formattedCostSavings = costSavingsByType.map(item => ({
            ...item,
            formattedTotalCostSavings: formatCurrency(item.totalCostSavings),
            formattedAvgCostSavings: formatCurrency(item.avgCostSavings),
            formattedImplementationCost: formatCurrency(item.totalImplementationCost)
        }));

        const budget = budgetInsights[0] || {};

        sendSuccess(res, {
            costSavingsByType: formattedCostSavings,
            revenueImpact,
            budgetInsights: {
                ...budget,
                formattedTotalCostSavings: formatCurrency(budget.totalCostSavings || 0),
                formattedAvgCostSavingsPerReview: formatCurrency(budget.avgCostSavingsPerReview || 0),
                formattedProjectedAnnualSavings: formatCurrency(budget.projectedAnnualSavings || 0)
            },
            currency: { code: 'NGN', symbol: '₦' }
        }, 'Cost-effectiveness analysis generated successfully');

    } catch (error) {
        console.error('Error generating cost-effectiveness analysis:', error);
        sendError(res, 'SERVER_ERROR', 'Failed to generate cost-effectiveness analysis', 500);
    }
};

/**
 * Get operational efficiency metrics
 */
export const getOperationalEfficiencyMetrics = async (req: AuthRequest, res: Response) => {
    try {
        const { startDate, endDate } = req.query;
        const workplaceId = req.user?.workplaceId;

        const dateFilter: any = {};
        if (startDate || endDate) {
            dateFilter.createdAt = {};
            if (startDate) dateFilter.createdAt.$gte = new Date(startDate as string);
            if (endDate) dateFilter.createdAt.$lte = new Date(endDate as string);
        }

        const matchStage = {
            workplaceId: new mongoose.Types.ObjectId(workplaceId),
            isDeleted: false,
            ...dateFilter
        };

        // Workflow metrics
        const workflowMetrics = await MedicationTherapyReview.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    avgProcessingTime: {
                        $avg: {
                            $cond: [
                                { $ne: ['$completedAt', null] },
                                { $divide: [{ $subtract: ['$completedAt', '$createdAt'] }, 1000 * 60 * 60] },
                                null
                            ]
                        }
                    }
                }
            }
        ]);

        // Resource utilization
        const resourceUtilization = await MedicationTherapyReview.aggregate([
            { $match: matchStage },
            {
                $lookup: {
                    from: 'users',
                    localField: 'pharmacistId',
                    foreignField: '_id',
                    as: 'pharmacist'
                }
            },
            { $unwind: '$pharmacist' },
            {
                $group: {
                    _id: '$pharmacistId',
                    pharmacistName: { $first: '$pharmacist.name' },
                    totalReviews: { $sum: 1 },
                    completedReviews: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                    avgCompletionTime: {
                        $avg: {
                            $cond: [
                                { $ne: ['$completedAt', null] },
                                { $divide: [{ $subtract: ['$completedAt', '$startedAt'] }, 1000 * 60 * 60 * 24] },
                                null
                            ]
                        }
                    }
                }
            },
            {
                $addFields: {
                    utilizationRate: { $multiply: [{ $divide: ['$completedReviews', '$totalReviews'] }, 100] },
                    efficiency: {
                        $cond: [
                            { $gt: ['$avgCompletionTime', 0] },
                            { $divide: [100, '$avgCompletionTime'] },
                            0
                        ]
                    }
                }
            }
        ]);

        // Performance benchmarks
        const performanceBenchmarks = await MedicationTherapyReview.aggregate([
            { $match: { ...matchStage, status: 'completed' } },
            {
                $group: {
                    _id: null,
                    avgCompletionTime: {
                        $avg: { $divide: [{ $subtract: ['$completedAt', '$startedAt'] }, 1000 * 60 * 60 * 24] }
                    },
                    medianCompletionTime: {
                        $avg: { $divide: [{ $subtract: ['$completedAt', '$startedAt'] }, 1000 * 60 * 60 * 24] }
                    },
                    totalReviews: { $sum: 1 },
                    totalProblemsIdentified: { $sum: { $size: '$problems' } },
                    totalInterventions: { $sum: { $size: '$interventions' } }
                }
            },
            {
                $addFields: {
                    avgProblemsPerReview: { $divide: ['$totalProblemsIdentified', '$totalReviews'] },
                    avgInterventionsPerReview: { $divide: ['$totalInterventions', '$totalReviews'] }
                }
            }
        ]);

        const benchmarks = performanceBenchmarks[0] || {};

        sendSuccess(res, {
            workflowMetrics,
            resourceUtilization,
            performanceBenchmarks: benchmarks,
            recommendations: [
                {
                    category: 'Workflow Optimization',
                    suggestion: 'Focus on reducing average completion time for in-progress reviews',
                    priority: 'high'
                },
                {
                    category: 'Resource Allocation',
                    suggestion: 'Balance workload distribution among pharmacists',
                    priority: 'medium'
                },
                {
                    category: 'Process Improvement',
                    suggestion: 'Implement standardized review templates to improve efficiency',
                    priority: 'medium'
                }
            ]
        }, 'Operational efficiency metrics generated successfully');

    } catch (error) {
        console.error('Error generating operational efficiency metrics:', error);
        sendError(res, 'SERVER_ERROR', 'Failed to generate operational efficiency metrics', 500);
    }
};

/**
 * Get trend identification and forecasting
 */
export const getTrendForecastingAnalytics = async (req: AuthRequest, res: Response) => {
    try {
        const { period = '12months' } = req.query;
        const workplaceId = req.user?.workplaceId;

        // Calculate date range based on period
        const now = new Date();
        let startDate: Date;

        switch (period) {
            case '6months':
                startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
                break;
            case '12months':
                startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
                break;
            case '24months':
                startDate = new Date(now.getFullYear() - 2, now.getMonth(), 1);
                break;
            default:
                startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        }

        const matchStage = {
            workplaceId: new mongoose.Types.ObjectId(workplaceId),
            isDeleted: false,
            createdAt: { $gte: startDate }
        };

        // Historical trends
        const historicalTrends = await MedicationTherapyReview.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    totalReviews: { $sum: 1 },
                    completedReviews: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                    avgCompletionTime: {
                        $avg: {
                            $cond: [
                                { $ne: ['$completedAt', null] },
                                { $divide: [{ $subtract: ['$completedAt', '$startedAt'] }, 1000 * 60 * 60 * 24] },
                                null
                            ]
                        }
                    },
                    totalCostSavings: { $sum: '$clinicalOutcomes.costSavings' }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        // Seasonal patterns
        const seasonalPatterns = await MedicationTherapyReview.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: { $month: '$createdAt' },
                    avgReviews: { $avg: 1 },
                    totalReviews: { $sum: 1 }
                }
            },
            { $sort: { '_id': 1 } }
        ]);

        // Growth trajectory analysis
        const growthAnalysis = historicalTrends.length > 1 ? {
            reviewGrowthRate: calculateGrowthRate(historicalTrends.map(t => t.totalReviews)),
            completionRateGrowth: calculateGrowthRate(historicalTrends.map(t =>
                t.totalReviews > 0 ? (t.completedReviews / t.totalReviews) * 100 : 0
            )),
            costSavingsGrowth: calculateGrowthRate(historicalTrends.map(t => t.totalCostSavings))
        } : { reviewGrowthRate: 0, completionRateGrowth: 0, costSavingsGrowth: 0 };

        // Anomaly detection (simple threshold-based)
        const anomalies = historicalTrends.filter((trend, index) => {
            if (index === 0) return false;
            const prevTrend = historicalTrends[index - 1];
            const reviewChange = Math.abs(trend.totalReviews - prevTrend.totalReviews) / prevTrend.totalReviews;
            return reviewChange > 0.5; // 50% change threshold
        });

        // Simple forecasting (linear projection)
        const forecast = generateForecast(historicalTrends, 3); // 3 months ahead

        sendSuccess(res, {
            historicalTrends,
            seasonalPatterns,
            growthAnalysis,
            anomalies,
            forecast,
            insights: [
                {
                    type: 'trend',
                    message: `Review volume has ${growthAnalysis.reviewGrowthRate > 0 ? 'increased' : 'decreased'} by ${Math.abs(growthAnalysis.reviewGrowthRate).toFixed(1)}% over the period`,
                    significance: Math.abs(growthAnalysis.reviewGrowthRate) > 10 ? 'high' : 'medium'
                },
                {
                    type: 'seasonal',
                    message: `Peak activity typically occurs in ${getMonthName(seasonalPatterns.reduce((max, curr) => curr.totalReviews > max.totalReviews ? curr : max)._id)}`,
                    significance: 'medium'
                }
            ]
        }, 'Trend forecasting analytics generated successfully');

    } catch (error) {
        console.error('Error generating trend forecasting analytics:', error);
        sendError(res, 'SERVER_ERROR', 'Failed to generate trend forecasting analytics', 500);
    }
};

// Helper functions
function calculateGrowthRate(values: number[]): number {
    if (values.length < 2) return 0;
    const first = values[0] || 1;
    const last = values[values.length - 1] || 0;
    return ((last - first) / first) * 100;
}

function generateForecast(historicalData: any[], monthsAhead: number): any[] {
    if (historicalData.length < 2) return [];

    const forecast = [];
    const lastTrend = historicalData[historicalData.length - 1];
    const growthRate = calculateGrowthRate(historicalData.map(t => t.totalReviews)) / 100 / historicalData.length;

    for (let i = 1; i <= monthsAhead; i++) {
        const forecastDate = new Date(lastTrend._id.year, lastTrend._id.month - 1 + i, 1);
        forecast.push({
            _id: {
                year: forecastDate.getFullYear(),
                month: forecastDate.getMonth() + 1
            },
            projectedReviews: Math.round(lastTrend.totalReviews * (1 + growthRate * i)),
            confidence: Math.max(0.5, 1 - (i * 0.1)) // Decreasing confidence
        });
    }

    return forecast;
}

function getMonthName(monthNumber: number): string {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    return months[monthNumber - 1] || 'Unknown';
}
/**
 * Get enhanced outcome metrics report
 */
export const getEnhancedOutcomeMetricsReport = async (req: AuthRequest, res: Response) => {
    try {
        const { startDate, endDate, reviewType } = req.query;
        const workplaceId = req.user?.workplaceId;

        // Build date filter
        const dateFilter: any = {};
        if (startDate || endDate) {
            dateFilter.completedAt = {};
            if (startDate) dateFilter.completedAt.$gte = new Date(startDate as string);
            if (endDate) dateFilter.completedAt.$lte = new Date(endDate as string);
        }

        // Build additional filters
        const additionalFilters: any = {};
        if (reviewType) additionalFilters.reviewType = reviewType;

        const matchStage = {
            workplaceId: new mongoose.Types.ObjectId(workplaceId),
            isDeleted: false,
            status: 'completed',
            ...dateFilter,
            ...additionalFilters
        };

        // Get clinical outcomes
        const clinicalOutcomes = await MedicationTherapyReview.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: null,
                    totalReviews: { $sum: 1 },
                    totalProblemsResolved: { $sum: '$clinicalOutcomes.problemsResolved' },
                    totalMedicationsOptimized: { $sum: '$clinicalOutcomes.medicationsOptimized' },
                    adherenceImprovedCount: {
                        $sum: { $cond: ['$clinicalOutcomes.adherenceImproved', 1, 0] }
                    },
                    adverseEventsReducedCount: {
                        $sum: { $cond: ['$clinicalOutcomes.adverseEventsReduced', 1, 0] }
                    },
                    qualityOfLifeImprovedCount: {
                        $sum: { $cond: ['$clinicalOutcomes.qualityOfLifeImproved', 1, 0] }
                    },
                    clinicalParametersImprovedCount: {
                        $sum: { $cond: ['$clinicalOutcomes.clinicalParametersImproved', 1, 0] }
                    },
                    totalCostSavings: { $sum: '$clinicalOutcomes.costSavings' }
                }
            }
        ]);

        // Get outcomes by review type
        const outcomesByType = await MedicationTherapyReview.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$reviewType',
                    totalReviews: { $sum: 1 },
                    avgProblemsResolved: { $avg: '$clinicalOutcomes.problemsResolved' },
                    avgMedicationsOptimized: { $avg: '$clinicalOutcomes.medicationsOptimized' },
                    adherenceImprovedRate: {
                        $avg: { $cond: ['$clinicalOutcomes.adherenceImproved', 1, 0] }
                    },
                    avgCostSavings: { $avg: '$clinicalOutcomes.costSavings' }
                }
            },
            {
                $project: {
                    _id: 1,
                    totalReviews: 1,
                    avgProblemsResolved: 1,
                    avgMedicationsOptimized: 1,
                    adherenceImprovedRate: { $multiply: ['$adherenceImprovedRate', 100] },
                    avgCostSavings: 1
                }
            }
        ]);

        // Get monthly outcome trends
        const monthlyOutcomes = await MedicationTherapyReview.aggregate([
            {
                $match: {
                    ...matchStage,
                    completedAt: {
                        $gte: new Date(new Date().setMonth(new Date().getMonth() - 12))
                    }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$completedAt' },
                        month: { $month: '$completedAt' }
                    },
                    totalReviews: { $sum: 1 },
                    totalProblemsResolved: { $sum: '$clinicalOutcomes.problemsResolved' },
                    totalMedicationsOptimized: { $sum: '$clinicalOutcomes.medicationsOptimized' },
                    totalCostSavings: { $sum: '$clinicalOutcomes.costSavings' }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        const outcomes = clinicalOutcomes[0] || {
            totalReviews: 0,
            totalProblemsResolved: 0,
            totalMedicationsOptimized: 0,
            adherenceImprovedCount: 0,
            adverseEventsReducedCount: 0,
            qualityOfLifeImprovedCount: 0,
            clinicalParametersImprovedCount: 0,
            totalCostSavings: 0
        };

        // Calculate improvement rates
        const adherenceImprovementRate = outcomes.totalReviews > 0
            ? (outcomes.adherenceImprovedCount / outcomes.totalReviews) * 100
            : 0;

        const adverseEventReductionRate = outcomes.totalReviews > 0
            ? (outcomes.adverseEventsReducedCount / outcomes.totalReviews) * 100
            : 0;

        sendSuccess(res, {
            summary: {
                ...outcomes,
                avgProblemsPerReview: outcomes.totalReviews > 0 ? outcomes.totalProblemsResolved / outcomes.totalReviews : 0,
                avgMedicationsPerReview: outcomes.totalReviews > 0 ? outcomes.totalMedicationsOptimized / outcomes.totalReviews : 0,
                adherenceImprovementRate: Math.round(adherenceImprovementRate * 100) / 100,
                adverseEventReductionRate: Math.round(adverseEventReductionRate * 100) / 100
            },
            outcomesByType,
            trends: {
                monthly: monthlyOutcomes
            }
        }, 'Enhanced outcome metrics report generated successfully');

    } catch (error) {
        console.error('Error generating enhanced outcome metrics report:', error);
        sendError(res, 'SERVER_ERROR', 'Failed to generate enhanced outcome metrics report', 500);
    }
};