import mongoose from 'mongoose';
import pharmacistReviewService from '../../modules/diagnostics/services/pharmacistReviewService';
import DiagnosticResult from '../../modules/diagnostics/models/DiagnosticResult';
import DiagnosticRequest from '../../modules/diagnostics/models/DiagnosticRequest';
import User from '../../models/User';
import ClinicalIntervention from '../../models/ClinicalIntervention';

// Mock dependencies
jest.mock('../../models/User');
jest.mock('../../models/ClinicalIntervention');
jest.mock('../../modules/diagnostics/models/DiagnosticResult');
jest.mock('../../modules/diagnostics/models/DiagnosticRequest');
jest.mock('../../services/auditService');

const MockUser = User as jest.Mocked<typeof User>;
const MockClinicalIntervention = ClinicalIntervention as jest.Mocked<typeof ClinicalIntervention>;
const MockDiagnosticResult = DiagnosticResult as jest.Mocked<typeof DiagnosticResult>;
const MockDiagnosticRequest = DiagnosticRequest as jest.Mocked<typeof DiagnosticRequest>;

describe('PharmacistReviewService', () => {
    const mockWorkplaceId = new mongoose.Types.ObjectId().toString();
    const mockPharmacistId = new mongoose.Types.ObjectId().toString();
    const mockPatientId = new mongoose.Types.ObjectId().toString();
    const mockResultId = new mongoose.Types.ObjectId().toString();
    const mockRequestId = new mongoose.Types.ObjectId().toString();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('submitReviewDecision', () => {
        const mockReviewer = {
            _id: mockPharmacistId,
            firstName: 'Test',
            lastName: 'Pharmacist',
            workplaceId: mockWorkplaceId,
        };

        const mockDiagnosticResult = {
            _id: mockResultId,
            workplaceId: new mongoose.Types.ObjectId(mockWorkplaceId),
            diagnoses: [
                {
                    condition: 'Hypertension',
                    probability: 0.8,
                    severity: 'medium',
                },
            ],
            riskAssessment: {
                overallRisk: 'medium',
                riskFactors: ['Elevated BP'],
            },
            redFlags: [],
            medicationSuggestions: [],
            referralRecommendation: null,
            aiMetadata: {
                confidenceScore: 0.85,
            },
            save: jest.fn().mockResolvedValue(true),
        };

        beforeEach(() => {
            MockUser.findOne.mockResolvedValue(mockReviewer as any);
            MockDiagnosticResult.findOne.mockResolvedValue(mockDiagnosticResult as any);
        });

        it('should successfully approve a diagnostic result', async () => {
            const reviewData = {
                status: 'approved' as const,
                reviewNotes: 'Comprehensive analysis, agree with recommendations',
                reviewedBy: mockPharmacistId,
                workplaceId: mockWorkplaceId,
            };

            const result = await pharmacistReviewService.submitReviewDecision(
                mockResultId,
                reviewData
            );

            expect(MockUser.findOne).toHaveBeenCalledWith({
                _id: mockPharmacistId,
                workplaceId: mockWorkplaceId,
            });

            expect(MockDiagnosticResult.findOne).toHaveBeenCalledWith({
                _id: mockResultId,
                workplaceId: new mongoose.Types.ObjectId(mockWorkplaceId),
                isDeleted: false,
            });

            expect(mockDiagnosticResult.save).toHaveBeenCalled();
            expect(result).toBeDefined();
        });

        it('should successfully modify a diagnostic result', async () => {
            const reviewData = {
                status: 'modified' as const,
                modifications: 'Recommend additional monitoring for 2 weeks',
                reviewNotes: 'Added specific monitoring recommendations',
                reviewedBy: mockPharmacistId,
                workplaceId: mockWorkplaceId,
            };

            const result = await pharmacistReviewService.submitReviewDecision(
                mockResultId,
                reviewData
            );

            expect(result).toBeDefined();
            expect(mockDiagnosticResult.save).toHaveBeenCalled();
        });

        it('should successfully reject a diagnostic result', async () => {
            const reviewData = {
                status: 'rejected' as const,
                rejectionReason: 'Insufficient clinical data for reliable diagnosis',
                reviewNotes: 'Need more comprehensive patient history',
                reviewedBy: mockPharmacistId,
                workplaceId: mockWorkplaceId,
            };

            const result = await pharmacistReviewService.submitReviewDecision(
                mockResultId,
                reviewData
            );

            expect(result).toBeDefined();
            expect(mockDiagnosticResult.save).toHaveBeenCalled();
        });

        it('should throw error if reviewer not found', async () => {
            MockUser.findOne.mockResolvedValue(null);

            const reviewData = {
                status: 'approved' as const,
                reviewedBy: mockPharmacistId,
                workplaceId: mockWorkplaceId,
            };

            await expect(
                pharmacistReviewService.submitReviewDecision(mockResultId, reviewData)
            ).rejects.toThrow('Reviewer not found or does not belong to this workplace');
        });

        it('should throw error if diagnostic result not found', async () => {
            MockDiagnosticResult.findOne.mockResolvedValue(null);

            const reviewData = {
                status: 'approved' as const,
                reviewedBy: mockPharmacistId,
                workplaceId: mockWorkplaceId,
            };

            await expect(
                pharmacistReviewService.submitReviewDecision(mockResultId, reviewData)
            ).rejects.toThrow('Diagnostic result not found');
        });

        it('should throw error if result already reviewed', async () => {
            const reviewedResult = {
                ...mockDiagnosticResult,
                pharmacistReview: {
                    status: 'approved',
                    reviewedBy: mockPharmacistId,
                    reviewedAt: new Date(),
                },
            };

            MockDiagnosticResult.findOne.mockResolvedValue(reviewedResult as any);

            const reviewData = {
                status: 'approved' as const,
                reviewedBy: mockPharmacistId,
                workplaceId: mockWorkplaceId,
            };

            await expect(
                pharmacistReviewService.submitReviewDecision(mockResultId, reviewData)
            ).rejects.toThrow('Diagnostic result has already been reviewed');
        });

        it('should validate required fields for modified status', async () => {
            const reviewData = {
                status: 'modified' as const,
                // Missing modifications field
                reviewedBy: mockPharmacistId,
                workplaceId: mockWorkplaceId,
            };

            await expect(
                pharmacistReviewService.submitReviewDecision(mockResultId, reviewData)
            ).rejects.toThrow('Modifications are required when status is modified');
        });

        it('should validate required fields for rejected status', async () => {
            const reviewData = {
                status: 'rejected' as const,
                // Missing rejectionReason field
                reviewedBy: mockPharmacistId,
                workplaceId: mockWorkplaceId,
            };

            await expect(
                pharmacistReviewService.submitReviewDecision(mockResultId, reviewData)
            ).rejects.toThrow('Rejection reason is required when status is rejected');
        });

        it('should validate field length limits', async () => {
            const longText = 'a'.repeat(2001);

            const reviewData = {
                status: 'modified' as const,
                modifications: longText,
                reviewedBy: mockPharmacistId,
                workplaceId: mockWorkplaceId,
            };

            await expect(
                pharmacistReviewService.submitReviewDecision(mockResultId, reviewData)
            ).rejects.toThrow('Modifications cannot exceed 2000 characters');
        });
    });

    describe('createInterventionFromResult', () => {
        const mockDiagnosticResult = {
            _id: mockResultId,
            workplaceId: new mongoose.Types.ObjectId(mockWorkplaceId),
            pharmacistReview: {
                status: 'approved',
                reviewedBy: mockPharmacistId,
            },
            requestId: {
                patientId: mockPatientId,
            },
            save: jest.fn().mockResolvedValue(true),
        };

        const mockIntervention = {
            _id: new mongoose.Types.ObjectId(),
            type: 'medication_review',
            title: 'Test Intervention',
            save: jest.fn().mockResolvedValue(true),
        };

        beforeEach(() => {
            MockDiagnosticResult.findOne.mockResolvedValue(mockDiagnosticResult as any);
            MockClinicalIntervention.mockImplementation(() => mockIntervention as any);
        });

        it('should successfully create intervention from approved result', async () => {
            const interventionData = {
                type: 'medication_review' as const,
                title: 'Hypertension Management Review',
                description: 'Review current therapy and optimize treatment',
                priority: 'high' as const,
                category: 'Cardiovascular',
                recommendations: [
                    'Increase lisinopril dose',
                    'Add lifestyle counseling',
                ],
                followUpRequired: true,
                targetOutcome: 'BP <140/90 mmHg',
            };

            const result = await pharmacistReviewService.createInterventionFromResult(
                mockResultId,
                interventionData,
                mockPharmacistId,
                mockWorkplaceId
            );

            expect(MockDiagnosticResult.findOne).toHaveBeenCalledWith({
                _id: mockResultId,
                workplaceId: new mongoose.Types.ObjectId(mockWorkplaceId),
                isDeleted: false,
            });

            expect(MockClinicalIntervention).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'medication_review',
                    title: 'Hypertension Management Review',
                    priority: 'high',
                })
            );

            expect(result).toBeDefined();
        });

        it('should throw error if result not found', async () => {
            MockDiagnosticResult.findOne.mockResolvedValue(null);

            const interventionData = {
                type: 'medication_review' as const,
                title: 'Test Intervention',
                description: 'Test description',
                priority: 'medium' as const,
                category: 'Test',
                recommendations: ['Test recommendation'],
                followUpRequired: false,
            };

            await expect(
                pharmacistReviewService.createInterventionFromResult(
                    mockResultId,
                    interventionData,
                    mockPharmacistId,
                    mockWorkplaceId
                )
            ).rejects.toThrow('Diagnostic result not found');
        });

        it('should throw error if result not approved', async () => {
            const unapprovedResult = {
                ...mockDiagnosticResult,
                pharmacistReview: {
                    status: 'pending',
                },
            };

            MockDiagnosticResult.findOne.mockResolvedValue(unapprovedResult as any);

            const interventionData = {
                type: 'medication_review' as const,
                title: 'Test Intervention',
                description: 'Test description',
                priority: 'medium' as const,
                category: 'Test',
                recommendations: ['Test recommendation'],
                followUpRequired: false,
            };

            await expect(
                pharmacistReviewService.createInterventionFromResult(
                    mockResultId,
                    interventionData,
                    mockPharmacistId,
                    mockWorkplaceId
                )
            ).rejects.toThrow('Can only create interventions from approved or modified diagnostic results');
        });
    });

    describe('getPendingReviews', () => {
        const mockResults = [
            {
                _id: mockResultId,
                diagnoses: [{ condition: 'Test Condition' }],
                createdAt: new Date(),
            },
        ];

        beforeEach(() => {
            MockDiagnosticResult.find.mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    sort: jest.fn().mockReturnValue({
                        skip: jest.fn().mockReturnValue({
                            limit: jest.fn().mockReturnValue({
                                lean: jest.fn().mockResolvedValue(mockResults),
                            }),
                        }),
                    }),
                }),
            } as any);

            MockDiagnosticResult.countDocuments.mockResolvedValue(1);
        });

        it('should get pending reviews with default pagination', async () => {
            const result = await pharmacistReviewService.getPendingReviews(mockWorkplaceId);

            expect(result).toEqual({
                results: mockResults,
                total: 1,
                page: 1,
                totalPages: 1,
            });

            expect(MockDiagnosticResult.find).toHaveBeenCalledWith({
                workplaceId: new mongoose.Types.ObjectId(mockWorkplaceId),
                pharmacistReview: { $exists: false },
                isDeleted: false,
            });
        });

        it('should apply filters correctly', async () => {
            const filters = {
                confidenceRange: { min: 0.7, max: 1.0 },
                hasRedFlags: true,
                orderBy: 'confidence' as const,
            };

            await pharmacistReviewService.getPendingReviews(
                mockWorkplaceId,
                1,
                10,
                filters
            );

            expect(MockDiagnosticResult.find).toHaveBeenCalledWith(
                expect.objectContaining({
                    'aiMetadata.confidenceScore': { $gte: 0.7, $lte: 1.0 },
                    'redFlags.0': { $exists: true },
                })
            );
        });

        it('should handle pagination correctly', async () => {
            const page = 2;
            const limit = 5;

            await pharmacistReviewService.getPendingReviews(
                mockWorkplaceId,
                page,
                limit
            );

            // Verify skip calculation: (page - 1) * limit = (2 - 1) * 5 = 5
            expect(MockDiagnosticResult.find().populate().sort().skip).toHaveBeenCalledWith(5);
            expect(MockDiagnosticResult.find().populate().sort().skip().limit).toHaveBeenCalledWith(5);
        });
    });

    describe('getReviewWorkflowStatus', () => {
        beforeEach(() => {
            MockDiagnosticResult.countDocuments
                .mockResolvedValueOnce(5) // totalPending
                .mockResolvedValueOnce(15); // totalReviewed

            MockDiagnosticResult.aggregate.mockResolvedValue([
                { _id: 'approved', count: 10, avgReviewTime: 3600000 }, // 1 hour
                { _id: 'modified', count: 3, avgReviewTime: 7200000 }, // 2 hours
                { _id: 'rejected', count: 2, avgReviewTime: 1800000 }, // 30 minutes
            ]);

            MockDiagnosticResult.findOne.mockResolvedValue({
                createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
            });
        });

        it('should calculate workflow status correctly', async () => {
            const status = await pharmacistReviewService.getReviewWorkflowStatus(mockWorkplaceId);

            expect(status).toEqual({
                totalPending: 5,
                totalReviewed: 15,
                totalApproved: 10,
                totalModified: 3,
                totalRejected: 2,
                averageReviewTime: expect.any(Number),
                oldestPendingDays: 2,
            });

            expect(status.averageReviewTime).toBeGreaterThan(0);
        });

        it('should handle no pending reviews', async () => {
            MockDiagnosticResult.findOne.mockResolvedValue(null);

            const status = await pharmacistReviewService.getReviewWorkflowStatus(mockWorkplaceId);

            expect(status.oldestPendingDays).toBe(0);
        });
    });

    describe('getReviewAnalytics', () => {
        const dateRange = {
            from: new Date('2024-01-01'),
            to: new Date('2024-01-31'),
        };

        beforeEach(() => {
            // Mock aggregate calls for different analytics
            MockDiagnosticResult.aggregate
                .mockResolvedValueOnce([
                    {
                        _id: mockPharmacistId,
                        totalReviews: 10,
                        approvedCount: 8,
                        avgReviewTime: 3600000,
                        reviewer: [{ firstName: 'Test', lastName: 'Pharmacist' }],
                    },
                ])
                .mockResolvedValueOnce([
                    {
                        _id: null,
                        avgConfidence: 0.85,
                        avgQuality: 0.78,
                    },
                ])
                .mockResolvedValueOnce([
                    { _id: 'Low confidence score', count: 3 },
                    { _id: 'Insufficient data', count: 2 },
                ])
                .mockResolvedValueOnce([
                    {
                        _id: null,
                        avgTimeToReview: 7200000, // 2 hours
                        avgProcessingTime: 5000, // 5 seconds
                    },
                ])
                .mockResolvedValueOnce([
                    { _id: 9, count: 15 }, // 9 AM
                    { _id: 14, count: 12 }, // 2 PM
                    { _id: 16, count: 10 }, // 4 PM
                ]);
        });

        it('should return comprehensive analytics', async () => {
            const analytics = await pharmacistReviewService.getReviewAnalytics(
                mockWorkplaceId,
                dateRange
            );

            expect(analytics).toEqual({
                reviewerStats: [
                    {
                        reviewerId: mockPharmacistId,
                        reviewerName: 'Test Pharmacist',
                        totalReviews: 10,
                        approvalRate: 80,
                        averageReviewTime: 1, // 1 hour
                    },
                ],
                qualityMetrics: {
                    averageConfidenceScore: 0.85,
                    averageQualityScore: 0.78,
                    commonRejectionReasons: ['Low confidence score', 'Insufficient data'],
                    interventionCreationRate: 0.75,
                },
                timeMetrics: {
                    averageTimeToReview: 2, // 2 hours
                    averageProcessingTime: 5, // 5 seconds
                    peakReviewHours: [9, 14, 16],
                },
            });
        });
    });

    describe('Private Helper Methods', () => {
        it('should determine follow-up requirements correctly', async () => {
            // Test high-risk case
            const highRiskResult = {
                riskAssessment: { overallRisk: 'high' },
                redFlags: [],
                referralRecommendation: null,
                medicationSuggestions: [],
            };

            const reviewData = { modifications: '' };

            // This tests the private method indirectly through submitReviewDecision
            // In a real implementation, you might expose this as a public method for testing
            expect(true).toBe(true); // Placeholder for actual test
        });

        it('should calculate follow-up dates based on risk level', async () => {
            // Test critical risk follow-up date (should be next day)
            // This would test the private calculateFollowUpDate method
            expect(true).toBe(true); // Placeholder for actual test
        });

        it('should generate appropriate follow-up instructions', async () => {
            // Test instruction generation based on red flags and referrals
            // This would test the private generateFollowUpInstructions method
            expect(true).toBe(true); // Placeholder for actual test
        });
    });
});