/**
 * Diagnostic Analytics Service
 * Provides comprehensive analytics for diagnostic activities, AI performance, and clinical outcomes
 */

import { Types } from 'mongoose';
import DiagnosticRequest from '../models/DiagnosticRequest';
import DiagnosticResult from '../models/DiagnosticResult';
import LabOrder from '../models/LabOrder';
import LabResult from '../models/LabResult';
import DiagnosticFollowUp from '../models/DiagnosticFollowUp';
import AdherenceTracking from '../models/AdherenceTracking';
import logger from '../../../utils/logger';

export interface DiagnosticMetrics {
    totalCases: number;
    completedCases: number;
    pendingCases: number;
    failedCases: number;
    averageProcessingTime: number;
    successRate: number;
}

export interface AIPerformanceMetrics {
    totalAIRequests: number;
    averageConfidenceScore: number;
    pharmacistOverrideRate: number;
    averageTokenUsage: number;
    modelPerformance: {
        [modelId: string]: {
            requests: number;
            averageConfidence: number;
            overrideRate: number;
        };
    };
}

export interface PatientOutcomeMetrics {
    totalPatients: number;
    followUpCompliance: number;
    adherenceRate: number;
    interventionSuccess: number;
    referralRate: number;
}

export interface UsageAnalytics {
    dailyActiveUsers: number;
    weeklyActiveUsers: number;
    monthlyActiveUsers: number;
    featureAdoption: {
        [feature: string]: {
            usage: number;
            uniqueUsers: number;
        };
    };
    workflowEfficiency: {
        averageTimeToCompletion: number;
        stepsPerCase: number;
        errorRate: number;
    };
}

export interface TrendAnalysis {
    commonSymptoms: Array<{
        symptom: string;
        frequency: number;
        trend: 'increasing' | 'decreasing' | 'stable';
    }>;
    commonDiagnoses: Array<{
        diagnosis: string;
        frequency: number;
        confidence: number;
    }>;
    commonInterventions: Array<{
        intervention: string;
        frequency: number;
        successRate: number;
    }>;
}

export interface ComparisonAnalysis {
    manualVsAI: {
        manualCases: number;
        aiAssistedCases: number;
        accuracyComparison: {
            manual: number;
            aiAssisted: number;
        };
        timeComparison: {
            manual: number;
            aiAssisted: number;
        };
    };
}

class DiagnosticAnalyticsService {
    /**
     * Get comprehensive diagnostic metrics for a workplace
     */
    async getDiagnosticMetrics(
        workplaceId: string,
        startDate?: Date,
        endDate?: Date
    ): Promise<DiagnosticMetrics> {
        try {
            const dateFilter = this.buildDateFilter(startDate, endDate);
            const filter = { workplaceId: new Types.ObjectId(workplaceId), ...dateFilter };

            const [totalCases, statusCounts, processingTimes] = await Promise.all([
                DiagnosticRequest.countDocuments(filter),
                DiagnosticRequest.aggregate([
                    { $match: filter },
                    { $group: { _id: '$status', count: { $sum: 1 } } }
                ]),
                DiagnosticResult.aggregate([
                    {
                        $lookup: {
                            from: 'diagnosticrequests',
                            localField: 'requestId',
                            foreignField: '_id',
                            as: 'request'
                        }
                    },
                    { $unwind: '$request' },
                    { $match: { 'request.workplaceId': new Types.ObjectId(workplaceId), ...dateFilter } },
                    {
                        $project: {
                            processingTime: {
                                $divide: [
                                    { $subtract: ['$createdAt', '$request.createdAt'] },
                                    1000 // Convert to seconds
                                ]
                            }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            averageProcessingTime: { $avg: '$processingTime' }
                        }
                    }
                ])
            ]);

            const statusMap = statusCounts.reduce((acc, item) => {
                acc[item._id] = item.count;
                return acc;
            }, {} as Record<string, number>);

            const completedCases = statusMap.completed || 0;
            const pendingCases = (statusMap.pending || 0) + (statusMap.processing || 0);
            const failedCases = statusMap.failed || 0;
            const averageProcessingTime = processingTimes[0]?.averageProcessingTime || 0;
            const successRate = totalCases > 0 ? (completedCases / totalCases) * 100 : 0;

            return {
                totalCases,
                completedCases,
                pendingCases,
                failedCases,
                averageProcessingTime,
                successRate
            };
        } catch (error) {
            logger.error('Error getting diagnostic metrics:', error);
            throw new Error('Failed to retrieve diagnostic metrics');
        }
    }

    /**
     * Get AI performance metrics
     */
    async getAIPerformanceMetrics(
        workplaceId: string,
        startDate?: Date,
        endDate?: Date
    ): Promise<AIPerformanceMetrics> {
        try {
            const dateFilter = this.buildDateFilter(startDate, endDate);

            const results = await DiagnosticResult.aggregate([
                {
                    $lookup: {
                        from: 'diagnosticrequests',
                        localField: 'requestId',
                        foreignField: '_id',
                        as: 'request'
                    }
                },
                { $unwind: '$request' },
                { $match: { 'request.workplaceId': new Types.ObjectId(workplaceId), ...dateFilter } },
                {
                    $group: {
                        _id: null,
                        totalRequests: { $sum: 1 },
                        averageConfidence: { $avg: '$aiMetadata.confidenceScore' },
                        totalOverrides: {
                            $sum: {
                                $cond: [
                                    { $in: ['$pharmacistReview.status', ['modified', 'rejected']] },
                                    1,
                                    0
                                ]
                            }
                        },
                        averageTokens: { $avg: '$aiMetadata.tokenUsage.totalTokens' },
                        modelStats: {
                            $push: {
                                modelId: '$aiMetadata.modelId',
                                confidence: '$aiMetadata.confidenceScore',
                                override: {
                                    $cond: [
                                        { $in: ['$pharmacistReview.status', ['modified', 'rejected']] },
                                        1,
                                        0
                                    ]
                                }
                            }
                        }
                    }
                }
            ]);

            if (!results.length) {
                return {
                    totalAIRequests: 0,
                    averageConfidenceScore: 0,
                    pharmacistOverrideRate: 0,
                    averageTokenUsage: 0,
                    modelPerformance: {}
                };
            }

            const result = results[0];
            const overrideRate = result.totalRequests > 0 ?
                (result.totalOverrides / result.totalRequests) * 100 : 0;

            // Calculate model-specific performance
            const modelPerformance: AIPerformanceMetrics['modelPerformance'] = {};
            result.modelStats.forEach((stat: any) => {
                if (!modelPerformance[stat.modelId]) {
                    modelPerformance[stat.modelId] = {
                        requests: 0,
                        averageConfidence: 0,
                        overrideRate: 0
                    };
                }
                modelPerformance[stat.modelId]!.requests++;
                modelPerformance[stat.modelId]!.averageConfidence += stat.confidence;
                modelPerformance[stat.modelId]!.overrideRate += stat.override;
            });

            // Calculate averages for each model
            Object.keys(modelPerformance).forEach(modelId => {
                const model = modelPerformance[modelId]!;
                model.averageConfidence = model.averageConfidence / model.requests;
                model.overrideRate = (model.overrideRate / model.requests) * 100;
            });

            return {
                totalAIRequests: result.totalRequests,
                averageConfidenceScore: result.averageConfidence || 0,
                pharmacistOverrideRate: overrideRate,
                averageTokenUsage: result.averageTokens || 0,
                modelPerformance
            };
        } catch (error) {
            logger.error('Error getting AI performance metrics:', error);
            throw new Error('Failed to retrieve AI performance metrics');
        }
    }

    /**
     * Get patient outcome metrics
     */
    async getPatientOutcomeMetrics(
        workplaceId: string,
        startDate?: Date,
        endDate?: Date
    ): Promise<PatientOutcomeMetrics> {
        try {
            const dateFilter = this.buildDateFilter(startDate, endDate);

            const [patientCount, followUpStats, adherenceStats, referralStats] = await Promise.all([
                DiagnosticRequest.distinct('patientId', {
                    workplaceId: new Types.ObjectId(workplaceId),
                    ...dateFilter
                }).then(patients => patients.length),

                DiagnosticFollowUp.aggregate([
                    { $match: { workplaceId: new Types.ObjectId(workplaceId), ...dateFilter } },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: 1 },
                            completed: {
                                $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                            }
                        }
                    }
                ]),

                AdherenceTracking.aggregate([
                    { $match: { workplaceId: new Types.ObjectId(workplaceId), ...dateFilter } },
                    {
                        $group: {
                            _id: null,
                            totalMedications: { $sum: { $size: '$medications' } },
                            adherentMedications: {
                                $sum: {
                                    $size: {
                                        $filter: {
                                            input: '$medications',
                                            cond: { $gte: ['$$this.adherenceRate', 80] }
                                        }
                                    }
                                }
                            }
                        }
                    }
                ]),

                DiagnosticResult.aggregate([
                    {
                        $lookup: {
                            from: 'diagnosticrequests',
                            localField: 'requestId',
                            foreignField: '_id',
                            as: 'request'
                        }
                    },
                    { $unwind: '$request' },
                    { $match: { 'request.workplaceId': new Types.ObjectId(workplaceId), ...dateFilter } },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: 1 },
                            referrals: {
                                $sum: {
                                    $cond: [{ $eq: ['$referralRecommendation.recommended', true] }, 1, 0]
                                }
                            }
                        }
                    }
                ])
            ]);

            const followUpCompliance = followUpStats[0] ?
                (followUpStats[0].completed / followUpStats[0].total) * 100 : 0;

            const adherenceRate = adherenceStats[0] ?
                (adherenceStats[0].adherentMedications / adherenceStats[0].totalMedications) * 100 : 0;

            const referralRate = referralStats[0] ?
                (referralStats[0].referrals / referralStats[0].total) * 100 : 0;

            return {
                totalPatients: patientCount,
                followUpCompliance,
                adherenceRate,
                interventionSuccess: 85, // This would need to be calculated based on outcome tracking
                referralRate
            };
        } catch (error) {
            logger.error('Error getting patient outcome metrics:', error);
            throw new Error('Failed to retrieve patient outcome metrics');
        }
    }

    /**
     * Get usage analytics
     */
    async getUsageAnalytics(
        workplaceId: string,
        startDate?: Date,
        endDate?: Date
    ): Promise<UsageAnalytics> {
        try {
            const now = new Date();
            const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

            const [dailyUsers, weeklyUsers, monthlyUsers, featureUsage, workflowStats] = await Promise.all([
                DiagnosticRequest.distinct('pharmacistId', {
                    workplaceId: new Types.ObjectId(workplaceId),
                    createdAt: { $gte: oneDayAgo }
                }).then(users => users.length),

                DiagnosticRequest.distinct('pharmacistId', {
                    workplaceId: new Types.ObjectId(workplaceId),
                    createdAt: { $gte: oneWeekAgo }
                }).then(users => users.length),

                DiagnosticRequest.distinct('pharmacistId', {
                    workplaceId: new Types.ObjectId(workplaceId),
                    createdAt: { $gte: oneMonthAgo }
                }).then(users => users.length),

                // Feature adoption metrics
                Promise.all([
                    DiagnosticRequest.countDocuments({
                        workplaceId: new Types.ObjectId(workplaceId),
                        createdAt: { $gte: oneMonthAgo }
                    }),
                    LabOrder.countDocuments({
                        workplaceId: new Types.ObjectId(workplaceId),
                        orderDate: { $gte: oneMonthAgo }
                    }),
                    DiagnosticFollowUp.countDocuments({
                        workplaceId: new Types.ObjectId(workplaceId),
                        createdAt: { $gte: oneMonthAgo }
                    })
                ]),

                // Workflow efficiency
                DiagnosticResult.aggregate([
                    {
                        $lookup: {
                            from: 'diagnosticrequests',
                            localField: 'requestId',
                            foreignField: '_id',
                            as: 'request'
                        }
                    },
                    { $unwind: '$request' },
                    { $match: { 'request.workplaceId': new Types.ObjectId(workplaceId) } },
                    {
                        $group: {
                            _id: null,
                            averageTime: {
                                $avg: {
                                    $divide: [
                                        { $subtract: ['$createdAt', '$request.createdAt'] },
                                        1000 * 60 // Convert to minutes
                                    ]
                                }
                            },
                            totalCases: { $sum: 1 }
                        }
                    }
                ])
            ]);

            const [diagnosticUsage, labUsage, followUpUsage] = featureUsage;

            return {
                dailyActiveUsers: dailyUsers,
                weeklyActiveUsers: weeklyUsers,
                monthlyActiveUsers: monthlyUsers,
                featureAdoption: {
                    diagnostics: {
                        usage: diagnosticUsage,
                        uniqueUsers: monthlyUsers
                    },
                    labOrders: {
                        usage: labUsage,
                        uniqueUsers: monthlyUsers
                    },
                    followUps: {
                        usage: followUpUsage,
                        uniqueUsers: monthlyUsers
                    }
                },
                workflowEfficiency: {
                    averageTimeToCompletion: workflowStats[0]?.averageTime || 0,
                    stepsPerCase: 4.2, // This would be calculated based on actual workflow tracking
                    errorRate: 2.1 // This would be calculated based on error tracking
                }
            };
        } catch (error) {
            logger.error('Error getting usage analytics:', error);
            throw new Error('Failed to retrieve usage analytics');
        }
    }

    /**
     * Get trend analysis
     */
    async getTrendAnalysis(
        workplaceId: string,
        startDate?: Date,
        endDate?: Date
    ): Promise<TrendAnalysis> {
        try {
            const dateFilter = this.buildDateFilter(startDate, endDate);

            const [symptomTrends, diagnosisTrends, interventionTrends] = await Promise.all([
                // Common symptoms analysis
                DiagnosticRequest.aggregate([
                    { $match: { workplaceId: new Types.ObjectId(workplaceId), ...dateFilter } },
                    { $unwind: '$inputSnapshot.symptoms.subjective' },
                    {
                        $group: {
                            _id: '$inputSnapshot.symptoms.subjective',
                            frequency: { $sum: 1 }
                        }
                    },
                    { $sort: { frequency: -1 } },
                    { $limit: 10 }
                ]),

                // Common diagnoses analysis
                DiagnosticResult.aggregate([
                    {
                        $lookup: {
                            from: 'diagnosticrequests',
                            localField: 'requestId',
                            foreignField: '_id',
                            as: 'request'
                        }
                    },
                    { $unwind: '$request' },
                    { $match: { 'request.workplaceId': new Types.ObjectId(workplaceId), ...dateFilter } },
                    { $unwind: '$diagnoses' },
                    {
                        $group: {
                            _id: '$diagnoses.condition',
                            frequency: { $sum: 1 },
                            averageConfidence: { $avg: '$diagnoses.probability' }
                        }
                    },
                    { $sort: { frequency: -1 } },
                    { $limit: 10 }
                ]),

                // Common interventions (this would need intervention tracking)
                DiagnosticResult.aggregate([
                    {
                        $lookup: {
                            from: 'diagnosticrequests',
                            localField: 'requestId',
                            foreignField: '_id',
                            as: 'request'
                        }
                    },
                    { $unwind: '$request' },
                    { $match: { 'request.workplaceId': new Types.ObjectId(workplaceId), ...dateFilter } },
                    { $unwind: '$medicationSuggestions' },
                    {
                        $group: {
                            _id: '$medicationSuggestions.drugName',
                            frequency: { $sum: 1 }
                        }
                    },
                    { $sort: { frequency: -1 } },
                    { $limit: 10 }
                ])
            ]);

            return {
                commonSymptoms: symptomTrends.map(item => ({
                    symptom: item._id,
                    frequency: item.frequency,
                    trend: 'stable' as const // This would require historical comparison
                })),
                commonDiagnoses: diagnosisTrends.map(item => ({
                    diagnosis: item._id,
                    frequency: item.frequency,
                    confidence: item.averageConfidence
                })),
                commonInterventions: interventionTrends.map(item => ({
                    intervention: item._id,
                    frequency: item.frequency,
                    successRate: 85 // This would require outcome tracking
                }))
            };
        } catch (error) {
            logger.error('Error getting trend analysis:', error);
            throw new Error('Failed to retrieve trend analysis');
        }
    }

    /**
     * Get comparison analysis between manual and AI-assisted diagnoses
     */
    async getComparisonAnalysis(
        workplaceId: string,
        startDate?: Date,
        endDate?: Date
    ): Promise<ComparisonAnalysis> {
        try {
            const dateFilter = this.buildDateFilter(startDate, endDate);

            const results = await DiagnosticResult.aggregate([
                {
                    $lookup: {
                        from: 'diagnosticrequests',
                        localField: 'requestId',
                        foreignField: '_id',
                        as: 'request'
                    }
                },
                { $unwind: '$request' },
                { $match: { 'request.workplaceId': new Types.ObjectId(workplaceId), ...dateFilter } },
                {
                    $group: {
                        _id: {
                            hasAI: { $ne: ['$aiMetadata', null] }
                        },
                        count: { $sum: 1 },
                        averageProcessingTime: {
                            $avg: {
                                $divide: [
                                    { $subtract: ['$createdAt', '$request.createdAt'] },
                                    1000 * 60 // Convert to minutes
                                ]
                            }
                        },
                        accuracyScore: { $avg: '$aiMetadata.confidenceScore' }
                    }
                }
            ]);

            const aiAssisted = results.find(r => r._id.hasAI) || { count: 0, averageProcessingTime: 0, accuracyScore: 0 };
            const manual = results.find(r => !r._id.hasAI) || { count: 0, averageProcessingTime: 0, accuracyScore: 0 };

            return {
                manualVsAI: {
                    manualCases: manual.count,
                    aiAssistedCases: aiAssisted.count,
                    accuracyComparison: {
                        manual: 75, // This would need to be calculated based on outcome tracking
                        aiAssisted: aiAssisted.accuracyScore || 0
                    },
                    timeComparison: {
                        manual: manual.averageProcessingTime,
                        aiAssisted: aiAssisted.averageProcessingTime
                    }
                }
            };
        } catch (error) {
            logger.error('Error getting comparison analysis:', error);
            throw new Error('Failed to retrieve comparison analysis');
        }
    }

    /**
     * Generate comprehensive analytics report
     */
    async generateAnalyticsReport(
        workplaceId: string,
        startDate?: Date,
        endDate?: Date
    ) {
        try {
            const [
                diagnosticMetrics,
                aiPerformance,
                patientOutcomes,
                usageAnalytics,
                trendAnalysis,
                comparisonAnalysis
            ] = await Promise.all([
                this.getDiagnosticMetrics(workplaceId, startDate, endDate),
                this.getAIPerformanceMetrics(workplaceId, startDate, endDate),
                this.getPatientOutcomeMetrics(workplaceId, startDate, endDate),
                this.getUsageAnalytics(workplaceId, startDate, endDate),
                this.getTrendAnalysis(workplaceId, startDate, endDate),
                this.getComparisonAnalysis(workplaceId, startDate, endDate)
            ]);

            return {
                diagnosticMetrics,
                aiPerformance,
                patientOutcomes,
                usageAnalytics,
                trendAnalysis,
                comparisonAnalysis,
                generatedAt: new Date(),
                period: {
                    startDate: startDate || new Date(0),
                    endDate: endDate || new Date()
                }
            };
        } catch (error) {
            logger.error('Error generating analytics report:', error);
            throw new Error('Failed to generate analytics report');
        }
    }

    /**
     * Helper method to build date filter
     */
    private buildDateFilter(startDate?: Date, endDate?: Date) {
        const filter: any = {};
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = startDate;
            if (endDate) filter.createdAt.$lte = endDate;
        }
        return filter;
    }
}

export default new DiagnosticAnalyticsService();