import { Types } from 'mongoose';
import logger from '../../../utils/logger';
import DiagnosticResult, { IDiagnosticResult, IPharmacistReview } from '../models/DiagnosticResult';
import DiagnosticRequest, { IDiagnosticRequest } from '../models/DiagnosticRequest';
import ClinicalIntervention from '../../../models/ClinicalIntervention';
import User from '../../../models/User';
import { AuditService } from '../../../services/auditService';

export interface ReviewDecisionData {
    status: 'approved' | 'modified' | 'rejected';
    modifications?: string;
    rejectionReason?: string;
    reviewNotes?: string;
    clinicalJustification?: string;
    reviewedBy: string;
    workplaceId: string;
}

export interface InterventionCreationData {
    type: 'medication_review' | 'counseling' | 'referral' | 'monitoring' | 'lifestyle';
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    category: string;
    recommendations: string[];
    followUpRequired: boolean;
    followUpDate?: Date;
    targetOutcome?: string;
    monitoringParameters?: string[];
}

export interface ReviewWorkflowStatus {
    totalPending: number;
    totalReviewed: number;
    totalApproved: number;
    totalModified: number;
    totalRejected: number;
    averageReviewTime: number;
    oldestPendingDays: number;
}

export interface ReviewAnalytics {
    reviewerStats: {
        reviewerId: string;
        reviewerName: string;
        totalReviews: number;
        approvalRate: number;
        averageReviewTime: number;
    }[];
    qualityMetrics: {
        averageConfidenceScore: number;
        averageQualityScore: number;
        commonRejectionReasons: string[];
        interventionCreationRate: number;
    };
    timeMetrics: {
        averageTimeToReview: number;
        averageProcessingTime: number;
        peakReviewHours: number[];
    };
}

export class PharmacistReviewService {
    /**
     * Submit review decision for diagnostic result
     */
    async submitReviewDecision(
        resultId: string,
        reviewData: ReviewDecisionData
    ): Promise<IDiagnosticResult> {
        try {
            // Validate reviewer exists and belongs to workplace
            const reviewer = await User.findOne({
                _id: reviewData.reviewedBy,
                workplaceId: reviewData.workplaceId,
            });

            if (!reviewer) {
                throw new Error('Reviewer not found or does not belong to this workplace');
            }

            // Get diagnostic result
            const result = await DiagnosticResult.findOne({
                _id: resultId,
                workplaceId: new Types.ObjectId(reviewData.workplaceId),
                isDeleted: false,
            });

            if (!result) {
                throw new Error('Diagnostic result not found');
            }

            // Check if already reviewed
            if (result.pharmacistReview) {
                throw new Error('Diagnostic result has already been reviewed');
            }

            // Validate review data based on status
            this.validateReviewData(reviewData);

            // Create review record
            const review: IPharmacistReview = {
                status: reviewData.status,
                modifications: reviewData.modifications,
                rejectionReason: reviewData.rejectionReason,
                reviewedBy: new Types.ObjectId(reviewData.reviewedBy),
                reviewedAt: new Date(),
                reviewNotes: reviewData.reviewNotes,
                clinicalJustification: reviewData.clinicalJustification,
            };

            // Update result with review
            result.pharmacistReview = review;
            result.updatedBy = new Types.ObjectId(reviewData.reviewedBy);

            // Set follow-up requirements based on review
            if (reviewData.status === 'approved' || reviewData.status === 'modified') {
                result.followUpRequired = this.determineFollowUpRequired(result, reviewData);
                if (result.followUpRequired) {
                    result.followUpDate = this.calculateFollowUpDate(result);
                    result.followUpInstructions = this.generateFollowUpInstructions(result, reviewData);
                }
            }

            const updatedResult = await result.save();

            // Log audit event
            await AuditService.logActivity({
                userId: reviewData.reviewedBy,
                workplaceId: reviewData.workplaceId,
                userRole: reviewer.role, // Assuming reviewer.role is available
            }, {
                action: 'diagnostic_result_reviewed',
                resourceType: 'DiagnosticResult',
                resourceId: resultId,
                complianceCategory: 'clinical_review',
                details: {
                    reviewStatus: reviewData.status,
                    hasModifications: !!reviewData.modifications,
                    hasRejectionReason: !!reviewData.rejectionReason,
                    followUpRequired: result.followUpRequired,
                    confidenceScore: result.aiMetadata.confidenceScore,
                },
            });

            logger.info('Diagnostic result reviewed successfully', {
                resultId,
                reviewStatus: reviewData.status,
                reviewedBy: reviewData.reviewedBy,
                followUpRequired: result.followUpRequired,
            });

            return updatedResult;
        } catch (error) {
            logger.error('Failed to submit review decision:', error);
            throw new Error(`Failed to submit review decision: ${error}`);
        }
    }

    /**
     * Create clinical intervention from approved diagnostic result
     */
    async createInterventionFromResult(
        resultId: string,
        interventionData: InterventionCreationData,
        createdBy: string,
        workplaceId: string
    ): Promise<any> {
        try {
            // Get diagnostic result
            const result = await DiagnosticResult.findOne({
                _id: resultId,
                workplaceId: new Types.ObjectId(workplaceId),
                isDeleted: false,
            }).populate('requestId');

            if (!result) {
                throw new Error('Diagnostic result not found');
            }

            // Check if result is approved or modified
            if (!result.pharmacistReview || !['approved', 'modified'].includes(result.pharmacistReview.status)) {
                throw new Error('Can only create interventions from approved or modified diagnostic results');
            }

            // Get the original request to access patient information
            const request = result.requestId as any;
            if (!request) {
                throw new Error('Original diagnostic request not found');
            }

            // Create clinical intervention
            const intervention = new ClinicalIntervention({
                patientId: request.patientId,
                pharmacistId: new Types.ObjectId(createdBy),
                workplaceId: new Types.ObjectId(workplaceId),
                type: interventionData.type,
                title: interventionData.title,
                description: interventionData.description,
                priority: interventionData.priority,
                category: interventionData.category,
                recommendations: interventionData.recommendations,
                status: 'active',

                // Link to diagnostic result
                relatedDocuments: [{
                    documentType: 'diagnostic_result',
                    documentId: result._id,
                    relationship: 'generated_from',
                }],

                // Follow-up settings
                followUpRequired: interventionData.followUpRequired,
                followUpDate: interventionData.followUpDate,
                targetOutcome: interventionData.targetOutcome,
                monitoringParameters: interventionData.monitoringParameters || [],

                // Audit fields
                createdBy: new Types.ObjectId(createdBy),
            });

            const savedIntervention = await intervention.save();

            // Update diagnostic result to reference the intervention
            result.updatedBy = new Types.ObjectId(createdBy);
            await result.save();

            // Log audit event
            await AuditService.logActivity({
                userId: createdBy,
                workplaceId: workplaceId,
                userRole: 'pharmacist', // Assuming the user creating intervention is a pharmacist
            }, {
                action: 'intervention_created_from_diagnostic',
                resourceType: 'ClinicalIntervention',
                resourceId: savedIntervention._id.toString(),
                complianceCategory: 'clinical_intervention',
                details: {
                    diagnosticResultId: resultId,
                    interventionType: interventionData.type,
                    priority: interventionData.priority,
                    followUpRequired: interventionData.followUpRequired,
                    recommendationsCount: interventionData.recommendations.length,
                },
            });

            logger.info('Clinical intervention created from diagnostic result', {
                interventionId: savedIntervention._id,
                resultId,
                type: interventionData.type,
                priority: interventionData.priority,
                createdBy,
            });

            return savedIntervention;
        } catch (error) {
            logger.error('Failed to create intervention from diagnostic result:', error);
            throw new Error(`Failed to create intervention: ${error}`);
        }
    }

    /**
     * Get pending reviews for a workplace
     */
    async getPendingReviews(
        workplaceId: string,
        page: number = 1,
        limit: number = 20,
        filters: {
            priority?: 'low' | 'medium' | 'high' | 'critical';
            confidenceRange?: { min: number; max: number };
            hasRedFlags?: boolean;
            orderBy?: 'oldest' | 'newest' | 'priority' | 'confidence';
        } = {}
    ): Promise<{
        results: IDiagnosticResult[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        try {
            const query: any = {
                workplaceId: new Types.ObjectId(workplaceId),
                pharmacistReview: { $exists: false },
                isDeleted: false,
            };

            // Apply filters
            if (filters.priority) {
                // Get requests with matching priority through population
                const requests = await DiagnosticRequest.find({
                    workplaceId: new Types.ObjectId(workplaceId),
                    priority: filters.priority,
                }).select('_id');

                query.requestId = { $in: requests.map(r => r._id) };
            }

            if (filters.confidenceRange) {
                query['aiMetadata.confidenceScore'] = {
                    $gte: filters.confidenceRange.min,
                    $lte: filters.confidenceRange.max,
                };
            }

            if (filters.hasRedFlags !== undefined) {
                if (filters.hasRedFlags) {
                    query['redFlags.0'] = { $exists: true };
                } else {
                    query.redFlags = { $size: 0 };
                }
            }

            // Determine sort order
            let sortOrder: any = { createdAt: 1 }; // Default: oldest first
            switch (filters.orderBy) {
                case 'newest':
                    sortOrder = { createdAt: -1 };
                    break;
                case 'priority':
                    // This would require population, simplified for now
                    sortOrder = { 'riskAssessment.overallRisk': -1, createdAt: 1 };
                    break;
                case 'confidence':
                    sortOrder = { 'aiMetadata.confidenceScore': 1, createdAt: 1 };
                    break;
            }

            const skip = (page - 1) * limit;

            const [results, total] = await Promise.all([
                DiagnosticResult.find(query)
                    .populate({
                        path: 'requestId',
                        populate: {
                            path: 'patientId',
                            select: 'firstName lastName dateOfBirth',
                        },
                    })
                    .sort(sortOrder)
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                DiagnosticResult.countDocuments(query),
            ]);

            const totalPages = Math.ceil(total / limit);

            logger.info('Pending reviews retrieved', {
                workplaceId,
                total,
                page,
                filters: Object.keys(filters).length,
            });

            return {
                results: results as IDiagnosticResult[],
                total,
                page,
                totalPages,
            };
        } catch (error) {
            logger.error('Failed to get pending reviews:', error);
            throw new Error(`Failed to get pending reviews: ${error}`);
        }
    }

    /**
     * Get review workflow status for a workplace
     */
    async getReviewWorkflowStatus(workplaceId: string): Promise<ReviewWorkflowStatus> {
        try {
            const [
                totalPending,
                totalReviewed,
                reviewStats,
                oldestPending,
            ] = await Promise.all([
                DiagnosticResult.countDocuments({
                    workplaceId: new Types.ObjectId(workplaceId),
                    pharmacistReview: { $exists: false },
                    isDeleted: false,
                }),
                DiagnosticResult.countDocuments({
                    workplaceId: new Types.ObjectId(workplaceId),
                    pharmacistReview: { $exists: true },
                    isDeleted: false,
                }),
                DiagnosticResult.aggregate([
                    {
                        $match: {
                            workplaceId: new Types.ObjectId(workplaceId),
                            pharmacistReview: { $exists: true },
                            isDeleted: false,
                        },
                    },
                    {
                        $group: {
                            _id: '$pharmacistReview.status',
                            count: { $sum: 1 },
                            avgReviewTime: {
                                $avg: {
                                    $subtract: ['$pharmacistReview.reviewedAt', '$createdAt'],
                                },
                            },
                        },
                    },
                ]),
                DiagnosticResult.findOne({
                    workplaceId: new Types.ObjectId(workplaceId),
                    pharmacistReview: { $exists: false },
                    isDeleted: false,
                }).sort({ createdAt: 1 }),
            ]);

            // Process review stats
            let totalApproved = 0;
            let totalModified = 0;
            let totalRejected = 0;
            let totalReviewTime = 0;
            let reviewCount = 0;

            reviewStats.forEach((stat: any) => {
                switch (stat._id) {
                    case 'approved':
                        totalApproved = stat.count;
                        break;
                    case 'modified':
                        totalModified = stat.count;
                        break;
                    case 'rejected':
                        totalRejected = stat.count;
                        break;
                }
                totalReviewTime += stat.avgReviewTime * stat.count;
                reviewCount += stat.count;
            });

            const averageReviewTime = reviewCount > 0 ? totalReviewTime / reviewCount : 0;

            // Calculate oldest pending days
            const oldestPendingDays = oldestPending
                ? Math.ceil((Date.now() - oldestPending.createdAt.getTime()) / (1000 * 60 * 60 * 24))
                : 0;

            return {
                totalPending,
                totalReviewed,
                totalApproved,
                totalModified,
                totalRejected,
                averageReviewTime: Math.round(averageReviewTime / (1000 * 60 * 60)), // Convert to hours
                oldestPendingDays,
            };
        } catch (error) {
            logger.error('Failed to get review workflow status:', error);
            throw new Error(`Failed to get review workflow status: ${error}`);
        }
    }

    /**
     * Get review analytics for a workplace
     */
    async getReviewAnalytics(
        workplaceId: string,
        dateRange: { from: Date; to: Date }
    ): Promise<ReviewAnalytics> {
        try {
            const matchStage = {
                workplaceId: new Types.ObjectId(workplaceId),
                pharmacistReview: { $exists: true },
                'pharmacistReview.reviewedAt': {
                    $gte: dateRange.from,
                    $lte: dateRange.to,
                },
                isDeleted: false,
            };

            const [
                reviewerStats,
                qualityMetrics,
                timeMetrics,
            ] = await Promise.all([
                this.getReviewerStats(matchStage),
                this.getQualityMetrics(matchStage),
                this.getTimeMetrics(matchStage),
            ]);

            return {
                reviewerStats,
                qualityMetrics,
                timeMetrics,
            };
        } catch (error) {
            logger.error('Failed to get review analytics:', error);
            throw new Error(`Failed to get review analytics: ${error}`);
        }
    }

    /**
     * Validate review data
     */
    private validateReviewData(reviewData: ReviewDecisionData): void {
        if (reviewData.status === 'modified' && !reviewData.modifications) {
            throw new Error('Modifications are required when status is modified');
        }

        if (reviewData.status === 'rejected' && !reviewData.rejectionReason) {
            throw new Error('Rejection reason is required when status is rejected');
        }

        if (reviewData.modifications && reviewData.modifications.length > 2000) {
            throw new Error('Modifications cannot exceed 2000 characters');
        }

        if (reviewData.rejectionReason && reviewData.rejectionReason.length > 1000) {
            throw new Error('Rejection reason cannot exceed 1000 characters');
        }

        if (reviewData.reviewNotes && reviewData.reviewNotes.length > 1000) {
            throw new Error('Review notes cannot exceed 1000 characters');
        }

        if (reviewData.clinicalJustification && reviewData.clinicalJustification.length > 1000) {
            throw new Error('Clinical justification cannot exceed 1000 characters');
        }
    }

    /**
     * Determine if follow-up is required based on review
     */
    private determineFollowUpRequired(result: IDiagnosticResult, reviewData: ReviewDecisionData): boolean {
        // Always require follow-up for high-risk cases
        if (result.riskAssessment.overallRisk === 'high' || result.riskAssessment.overallRisk === 'critical') {
            return true;
        }

        // Require follow-up if there are red flags
        if (result.redFlags && result.redFlags.length > 0) {
            return true;
        }

        // Require follow-up if referral is recommended
        if (result.referralRecommendation?.recommended) {
            return true;
        }

        // Require follow-up if medications are suggested
        if (result.medicationSuggestions && result.medicationSuggestions.length > 0) {
            return true;
        }

        // Require follow-up if reviewer explicitly requests it in modifications
        if (reviewData.modifications && reviewData.modifications.toLowerCase().includes('follow')) {
            return true;
        }

        return false;
    }

    /**
     * Calculate follow-up date based on result characteristics
     */
    private calculateFollowUpDate(result: IDiagnosticResult): Date {
        const now = new Date();
        let daysToAdd = 7; // Default: 1 week

        // Adjust based on risk level
        switch (result.riskAssessment.overallRisk) {
            case 'critical':
                daysToAdd = 1; // Next day
                break;
            case 'high':
                daysToAdd = 3; // 3 days
                break;
            case 'medium':
                daysToAdd = 7; // 1 week
                break;
            case 'low':
                daysToAdd = 14; // 2 weeks
                break;
        }

        // Adjust based on red flags
        if (result.redFlags && result.redFlags.some(flag => flag.severity === 'critical')) {
            daysToAdd = Math.min(daysToAdd, 1);
        } else if (result.redFlags && result.redFlags.some(flag => flag.severity === 'high')) {
            daysToAdd = Math.min(daysToAdd, 3);
        }

        // Adjust based on referral urgency
        if (result.referralRecommendation?.recommended) {
            switch (result.referralRecommendation.urgency) {
                case 'immediate':
                    daysToAdd = 1;
                    break;
                case 'within_24h':
                    daysToAdd = 2;
                    break;
                case 'within_week':
                    daysToAdd = 7;
                    break;
                case 'routine':
                    daysToAdd = 14;
                    break;
            }
        }

        return new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    }

    /**
     * Generate follow-up instructions
     */
    private generateFollowUpInstructions(result: IDiagnosticResult, reviewData: ReviewDecisionData): string[] {
        const instructions: string[] = [];

        // Add instructions based on red flags
        if (result.redFlags && result.redFlags.length > 0) {
            result.redFlags.forEach(flag => {
                if (flag.action) {
                    instructions.push(flag.action);
                }
            });
        }

        // Add instructions based on referral recommendations
        if (result.referralRecommendation?.recommended) {
            instructions.push(`Schedule ${result.referralRecommendation.urgency} referral to ${result.referralRecommendation.specialty}`);
            if (result.referralRecommendation.followUpInstructions) {
                instructions.push(result.referralRecommendation.followUpInstructions);
            }
        }

        // Add instructions based on medication suggestions
        if (result.medicationSuggestions && result.medicationSuggestions.length > 0) {
            instructions.push('Monitor medication adherence and effectiveness');
            instructions.push('Assess for adverse effects');
        }

        // Add instructions from reviewer modifications
        if (reviewData.modifications) {
            const modificationLines = reviewData.modifications.split('\n').filter(line =>
                line.trim().length > 0 &&
                (line.toLowerCase().includes('follow') || line.toLowerCase().includes('monitor'))
            );
            instructions.push(...modificationLines);
        }

        // Default instruction if none specified
        if (instructions.length === 0) {
            instructions.push('Follow up on patient progress and symptom resolution');
        }

        return instructions;
    }

    /**
     * Get reviewer statistics
     */
    private async getReviewerStats(matchStage: any): Promise<ReviewAnalytics['reviewerStats']> {
        const stats = await DiagnosticResult.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$pharmacistReview.reviewedBy',
                    totalReviews: { $sum: 1 },
                    approvedCount: {
                        $sum: { $cond: [{ $eq: ['$pharmacistReview.status', 'approved'] }, 1, 0] },
                    },
                    avgReviewTime: {
                        $avg: {
                            $subtract: ['$pharmacistReview.reviewedAt', '$createdAt'],
                        },
                    },
                },
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'reviewer',
                },
            },
        ]);

        return stats.map((stat: any) => ({
            reviewerId: stat._id.toString(),
            reviewerName: stat.reviewer[0] ? `${stat.reviewer[0].firstName} ${stat.reviewer[0].lastName}` : 'Unknown',
            totalReviews: stat.totalReviews,
            approvalRate: (stat.approvedCount / stat.totalReviews) * 100,
            averageReviewTime: Math.round(stat.avgReviewTime / (1000 * 60 * 60)), // Convert to hours
        }));
    }

    /**
     * Get quality metrics
     */
    private async getQualityMetrics(matchStage: any): Promise<ReviewAnalytics['qualityMetrics']> {
        const [metrics, rejectionReasons, interventionRate] = await Promise.all([
            DiagnosticResult.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: null,
                        avgConfidence: { $avg: '$aiMetadata.confidenceScore' },
                        avgQuality: { $avg: '$validationScore' },
                    },
                },
            ]),
            DiagnosticResult.aggregate([
                {
                    $match: {
                        ...matchStage,
                        'pharmacistReview.status': 'rejected',
                    },
                },
                {
                    $group: {
                        _id: '$pharmacistReview.rejectionReason',
                        count: { $sum: 1 },
                    },
                },
                { $sort: { count: -1 } },
                { $limit: 5 },
            ]),
            // This would need to be implemented based on actual intervention creation tracking
            Promise.resolve({ interventionCreationRate: 0.75 }), // Placeholder
        ]);

        return {
            averageConfidenceScore: metrics[0]?.avgConfidence || 0,
            averageQualityScore: metrics[0]?.avgQuality || 0,
            commonRejectionReasons: rejectionReasons.map((r: any) => r._id).filter(Boolean),
            interventionCreationRate: interventionRate.interventionCreationRate,
        };
    }

    /**
     * Get time metrics
     */
    private async getTimeMetrics(matchStage: any): Promise<ReviewAnalytics['timeMetrics']> {
        const [timeStats, hourlyStats] = await Promise.all([
            DiagnosticResult.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: null,
                        avgTimeToReview: {
                            $avg: {
                                $subtract: ['$pharmacistReview.reviewedAt', '$createdAt'],
                            },
                        },
                        avgProcessingTime: { $avg: '$aiMetadata.processingTime' },
                    },
                },
            ]),
            DiagnosticResult.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: { $hour: '$pharmacistReview.reviewedAt' },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { count: -1 } },
                { $limit: 3 },
            ]),
        ]);

        return {
            averageTimeToReview: Math.round((timeStats[0]?.avgTimeToReview || 0) / (1000 * 60 * 60)), // Hours
            averageProcessingTime: Math.round((timeStats[0]?.avgProcessingTime || 0) / 1000), // Seconds
            peakReviewHours: hourlyStats.map((h: any) => h._id),
        };
    }
}

export default new PharmacistReviewService();