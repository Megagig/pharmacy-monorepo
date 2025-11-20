// Optimized Report Helper Functions
import MedicationTherapyReview from '../models/MedicationTherapyReview';
import MTRIntervention from '../models/MTRIntervention';
import DrugTherapyProblem from '../models/DrugTherapyProblem';
import ReportAggregationService from '../services/ReportAggregationService';

interface ReportFilters {
    dateRange?: {
        startDate: Date;
        endDate: Date;
    };
    patientId?: string;
    pharmacistId?: string;
    therapyType?: string;
    priority?: string;
    location?: string;
    status?: string;
}

const aggregationService = ReportAggregationService.getInstance();

export async function getTherapyEffectivenessDataOptimized(workplaceId: string, filters: ReportFilters) {
    const pipeline = [
        aggregationService.buildOptimizedMatchStage(workplaceId, { ...filters, status: 'completed' }),
        aggregationService.buildOptimizedGroupStage('reviewType', ['count', 'avgAdherenceScore']),
        {
            $addFields: {
                adherenceImproved: { $sum: { $cond: ['$clinicalOutcomes.adherenceImproved', 1, 0] } },
            },
        },
    ];

    const result = await aggregationService.executeAggregation(
        MedicationTherapyReview,
        pipeline,
        { allowDiskUse: true }
    );

    return { adherenceMetrics: result.data };
}

export async function getQualityImprovementDataOptimized(workplaceId: string, filters: ReportFilters) {
    const pipeline = [
        aggregationService.buildOptimizedMatchStage(workplaceId, { ...filters, status: 'completed' }),
        {
            $group: {
                _id: '$priority',
                avgCompletionTime: {
                    $avg: { $divide: [{ $subtract: ['$completedAt', '$startedAt'] }, 1000 * 60 * 60 * 24] }
                },
                count: { $sum: 1 },
            },
        },
    ];

    const result = await aggregationService.executeAggregation(
        MedicationTherapyReview,
        pipeline,
        { allowDiskUse: true }
    );

    return { completionTimeAnalysis: result.data };
}

export async function getRegulatoryComplianceDataOptimized(workplaceId: string, filters: ReportFilters) {
    const pipeline = [
        aggregationService.buildOptimizedMatchStage(workplaceId, filters),
        {
            $group: {
                _id: null,
                totalReviews: { $sum: 1 },
                compliantReviews: { $sum: { $cond: ['$isCompliant', 1, 0] } },
                avgComplianceScore: { $avg: '$complianceScore' },
            },
        },
    ];

    const result = await aggregationService.executeAggregation(
        MedicationTherapyReview,
        pipeline,
        { allowDiskUse: true }
    );

    return { complianceMetrics: result.data[0] || {} };
}

export async function getCostEffectivenessDataOptimized(workplaceId: string, filters: ReportFilters) {
    const pipeline = [
        aggregationService.buildOptimizedMatchStage(workplaceId, filters),
        {
            $group: {
                _id: '$type',
                totalCostSavings: { $sum: '$costSavings' },
                totalImplementationCost: { $sum: '$implementationCost' },
                count: { $sum: 1 },
                avgROI: {
                    $avg: {
                        $cond: [
                            { $gt: ['$implementationCost', 0] },
                            { $divide: ['$costSavings', '$implementationCost'] },
                            0,
                        ],
                    },
                },
            },
        },
    ];

    const result = await aggregationService.executeAggregation(
        MTRIntervention,
        pipeline,
        { allowDiskUse: true }
    );

    return { costSavings: result.data };
}

export async function getTrendForecastingDataOptimized(workplaceId: string, filters: ReportFilters) {
    const pipeline = aggregationService.buildTimeSeriesAggregation(workplaceId, filters, 'month');

    const result = await aggregationService.executeAggregation(
        MedicationTherapyReview,
        pipeline,
        { allowDiskUse: true }
    );

    return { trends: result.data };
}

export async function getOperationalEfficiencyDataOptimized(workplaceId: string, filters: ReportFilters) {
    const pipeline = [
        aggregationService.buildOptimizedMatchStage(workplaceId, filters),
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                avgProcessingTime: {
                    $avg: {
                        $cond: [
                            { $ne: ['$completedAt', null] },
                            { $divide: [{ $subtract: ['$completedAt', '$createdAt'] }, 1000 * 60 * 60] },
                            null,
                        ],
                    },
                },
                avgQueueTime: {
                    $avg: {
                        $cond: [
                            { $ne: ['$startedAt', null] },
                            { $divide: [{ $subtract: ['$startedAt', '$createdAt'] }, 1000 * 60 * 60] },
                            null,
                        ],
                    },
                },
            },
        },
    ];

    const result = await aggregationService.executeAggregation(
        MedicationTherapyReview,
        pipeline,
        { allowDiskUse: true }
    );

    return { workflowMetrics: result.data };
}

export async function getMedicationInventoryDataOptimized(workplaceId: string, filters: ReportFilters) {
    // This would typically query inventory-specific models
    // For now, return optimized sample data structure
    const pipeline = [
        aggregationService.buildOptimizedMatchStage(workplaceId, filters),
        {
            $group: {
                _id: '$medication.name',
                totalUsage: { $sum: '$medication.quantity' },
                avgDailyUsage: { $avg: '$medication.dailyDose' },
                uniquePatients: { $addToSet: '$patientId' },
            },
        },
        {
            $addFields: {
                patientCount: { $size: '$uniquePatients' },
            },
        },
        { $sort: { totalUsage: -1 as const } },
        { $limit: 50 }, // Top 50 medications
    ];

    const result = await aggregationService.executeAggregation(
        MedicationTherapyReview,
        pipeline,
        { allowDiskUse: true }
    );

    return {
        usagePatterns: result.data,
        inventoryTurnover: [],
        expirationTracking: [],
    };
}

export async function getPatientDemographicsDataOptimized(workplaceId: string, filters: ReportFilters) {
    const facets = {
        ageDistribution: [
            {
                $group: {
                    _id: {
                        $switch: {
                            branches: [
                                { case: { $lt: ['$patient.age', 18] }, then: '0-17' },
                                { case: { $lt: ['$patient.age', 30] }, then: '18-29' },
                                { case: { $lt: ['$patient.age', 50] }, then: '30-49' },
                                { case: { $lt: ['$patient.age', 65] }, then: '50-64' },
                            ],
                            default: '65+',
                        },
                    },
                    count: { $sum: 1 },
                    uniquePatients: { $addToSet: '$patientId' },
                },
            },
            {
                $addFields: {
                    patientCount: { $size: '$uniquePatients' },
                },
            },
        ],
        conditionSegmentation: [
            { $unwind: '$conditions' },
            {
                $group: {
                    _id: '$conditions.name',
                    count: { $sum: 1 },
                    avgSeverity: { $avg: '$conditions.severity' },
                },
            },
            { $sort: { count: -1 as const } },
            { $limit: 20 },
        ],
    };

    const pipeline = aggregationService.buildFacetedAggregation(workplaceId, filters, facets);

    const result = await aggregationService.executeAggregation(
        MedicationTherapyReview,
        pipeline,
        { allowDiskUse: true }
    );

    return result.data[0] || {};
}

export async function getAdverseEventsDataOptimized(workplaceId: string, filters: ReportFilters) {
    const pipeline = [
        aggregationService.buildOptimizedMatchStage(workplaceId, { ...filters, category: 'adverse_event' }),
        {
            $group: {
                _id: '$severity',
                count: { $sum: 1 },
                resolvedCount: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
                avgResolutionTime: {
                    $avg: {
                        $cond: [
                            { $eq: ['$status', 'resolved'] },
                            { $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 1000 * 60 * 60 * 24] },
                            null,
                        ],
                    },
                },
            },
        },
        { $sort: { count: -1 as const } },
    ];

    const result = await aggregationService.executeAggregation(
        DrugTherapyProblem,
        pipeline,
        { allowDiskUse: true }
    );

    return { adverseEvents: result.data };
}
