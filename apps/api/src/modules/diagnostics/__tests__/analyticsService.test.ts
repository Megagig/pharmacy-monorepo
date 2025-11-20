/**
 * Diagnostic Analytics Service Tests
 * Tests for analytics calculations and data visualization
 */

import { Types } from 'mongoose';
import diagnosticAnalyticsService from '../services/diagnosticAnalyticsService';
import DiagnosticRequest from '../models/DiagnosticRequest';
import DiagnosticResult from '../models/DiagnosticResult';
import LabOrder from '../models/LabOrder';
import LabResult from '../models/LabResult';
import DiagnosticFollowUp from '../models/DiagnosticFollowUp';
import AdherenceTracking from '../models/AdherenceTracking';

// Mock the models
jest.mock('../models/DiagnosticRequest');
jest.mock('../models/DiagnosticResult');
jest.mock('../models/LabOrder');
jest.mock('../models/LabResult');
jest.mock('../models/DiagnosticFollowUp');
jest.mock('../models/AdherenceTracking');

const mockDiagnosticRequest = DiagnosticRequest as jest.Mocked<typeof DiagnosticRequest>;
const mockDiagnosticResult = DiagnosticResult as jest.Mocked<typeof DiagnosticResult>;
const mockLabOrder = LabOrder as jest.Mocked<typeof LabOrder>;
const mockLabResult = LabResult as jest.Mocked<typeof LabResult>;
const mockDiagnosticFollowUp = DiagnosticFollowUp as jest.Mocked<typeof DiagnosticFollowUp>;
const mockAdherenceTracking = AdherenceTracking as jest.Mocked<typeof AdherenceTracking>;

describe('DiagnosticAnalyticsService', () => {
    const mockWorkplaceId = new Types.ObjectId().toString();
    const mockStartDate = new Date('2024-01-01');
    const mockEndDate = new Date('2024-01-31');

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getDiagnosticMetrics', () => {
        it('should calculate diagnostic metrics correctly', async () => {
            // Mock data
            const mockStatusCounts = [
                { _id: 'completed', count: 80 },
                { _id: 'pending', count: 15 },
                { _id: 'failed', count: 5 }
            ];

            const mockProcessingTimes = [
                { averageProcessingTime: 300 } // 5 minutes
            ];

            mockDiagnosticRequest.countDocuments.mockResolvedValue(100);
            mockDiagnosticRequest.aggregate.mockResolvedValue(mockStatusCounts);
            mockDiagnosticResult.aggregate.mockResolvedValue(mockProcessingTimes);

            const result = await diagnosticAnalyticsService.getDiagnosticMetrics(
                mockWorkplaceId,
                mockStartDate,
                mockEndDate
            );

            expect(result).toEqual({
                totalCases: 100,
                completedCases: 80,
                pendingCases: 15,
                failedCases: 5,
                averageProcessingTime: 300,
                successRate: 80
            });

            expect(mockDiagnosticRequest.countDocuments).toHaveBeenCalledWith({
                workplaceId: new Types.ObjectId(mockWorkplaceId),
                createdAt: {
                    $gte: mockStartDate,
                    $lte: mockEndDate
                }
            });
        });

        it('should handle empty results gracefully', async () => {
            mockDiagnosticRequest.countDocuments.mockResolvedValue(0);
            mockDiagnosticRequest.aggregate.mockResolvedValue([]);
            mockDiagnosticResult.aggregate.mockResolvedValue([]);

            const result = await diagnosticAnalyticsService.getDiagnosticMetrics(mockWorkplaceId);

            expect(result).toEqual({
                totalCases: 0,
                completedCases: 0,
                pendingCases: 0,
                failedCases: 0,
                averageProcessingTime: 0,
                successRate: 0
            });
        });

        it('should handle errors properly', async () => {
            mockDiagnosticRequest.countDocuments.mockRejectedValue(new Error('Database error'));

            await expect(
                diagnosticAnalyticsService.getDiagnosticMetrics(mockWorkplaceId)
            ).rejects.toThrow('Failed to retrieve diagnostic metrics');
        });
    });

    describe('getAIPerformanceMetrics', () => {
        it('should calculate AI performance metrics correctly', async () => {
            const mockAIResults = [
                {
                    totalRequests: 50,
                    averageConfidence: 0.85,
                    totalOverrides: 10,
                    averageTokens: 1500,
                    modelStats: [
                        {
                            modelId: 'deepseek-v3.1',
                            confidence: 0.9,
                            override: 0
                        },
                        {
                            modelId: 'deepseek-v3.1',
                            confidence: 0.8,
                            override: 1
                        }
                    ]
                }
            ];

            mockDiagnosticResult.aggregate.mockResolvedValue(mockAIResults);

            const result = await diagnosticAnalyticsService.getAIPerformanceMetrics(
                mockWorkplaceId,
                mockStartDate,
                mockEndDate
            );

            expect(result).toEqual({
                totalAIRequests: 50,
                averageConfidenceScore: 0.85,
                pharmacistOverrideRate: 20,
                averageTokenUsage: 1500,
                modelPerformance: {
                    'deepseek-v3.1': {
                        requests: 2,
                        averageConfidence: 0.85,
                        overrideRate: 50
                    }
                }
            });
        });

        it('should handle no AI results', async () => {
            mockDiagnosticResult.aggregate.mockResolvedValue([]);

            const result = await diagnosticAnalyticsService.getAIPerformanceMetrics(mockWorkplaceId);

            expect(result).toEqual({
                totalAIRequests: 0,
                averageConfidenceScore: 0,
                pharmacistOverrideRate: 0,
                averageTokenUsage: 0,
                modelPerformance: {}
            });
        });
    });

    describe('getPatientOutcomeMetrics', () => {
        it('should calculate patient outcome metrics correctly', async () => {
            const mockPatientIds = ['patient1', 'patient2', 'patient3'];
            const mockFollowUpStats = [{ total: 20, completed: 16 }];
            const mockAdherenceStats = [{ totalMedications: 100, adherentMedications: 85 }];
            const mockReferralStats = [{ total: 50, referrals: 10 }];

            mockDiagnosticRequest.distinct.mockResolvedValue(mockPatientIds);
            mockDiagnosticFollowUp.aggregate.mockResolvedValue(mockFollowUpStats);
            mockAdherenceTracking.aggregate.mockResolvedValue(mockAdherenceStats);
            mockDiagnosticResult.aggregate.mockResolvedValue(mockReferralStats);

            const result = await diagnosticAnalyticsService.getPatientOutcomeMetrics(
                mockWorkplaceId,
                mockStartDate,
                mockEndDate
            );

            expect(result).toEqual({
                totalPatients: 3,
                followUpCompliance: 80,
                adherenceRate: 85,
                interventionSuccess: 85,
                referralRate: 20
            });
        });

        it('should handle empty outcome data', async () => {
            mockDiagnosticRequest.distinct.mockResolvedValue([]);
            mockDiagnosticFollowUp.aggregate.mockResolvedValue([]);
            mockAdherenceTracking.aggregate.mockResolvedValue([]);
            mockDiagnosticResult.aggregate.mockResolvedValue([]);

            const result = await diagnosticAnalyticsService.getPatientOutcomeMetrics(mockWorkplaceId);

            expect(result).toEqual({
                totalPatients: 0,
                followUpCompliance: 0,
                adherenceRate: 0,
                interventionSuccess: 85,
                referralRate: 0
            });
        });
    });

    describe('getUsageAnalytics', () => {
        it('should calculate usage analytics correctly', async () => {
            const mockDailyUsers = ['user1', 'user2'];
            const mockWeeklyUsers = ['user1', 'user2', 'user3'];
            const mockMonthlyUsers = ['user1', 'user2', 'user3', 'user4'];
            const mockFeatureUsage = [100, 50, 25]; // diagnostics, lab, followUp
            const mockWorkflowStats = [{ averageTime: 15.5, totalCases: 100 }];

            mockDiagnosticRequest.distinct
                .mockResolvedValueOnce(mockDailyUsers)
                .mockResolvedValueOnce(mockWeeklyUsers)
                .mockResolvedValueOnce(mockMonthlyUsers);

            mockDiagnosticRequest.countDocuments.mockResolvedValue(100);
            mockLabOrder.countDocuments.mockResolvedValue(50);
            mockDiagnosticFollowUp.countDocuments.mockResolvedValue(25);
            mockDiagnosticResult.aggregate.mockResolvedValue(mockWorkflowStats);

            const result = await diagnosticAnalyticsService.getUsageAnalytics(
                mockWorkplaceId,
                mockStartDate,
                mockEndDate
            );

            expect(result).toEqual({
                dailyActiveUsers: 2,
                weeklyActiveUsers: 3,
                monthlyActiveUsers: 4,
                featureAdoption: {
                    diagnostics: {
                        usage: 100,
                        uniqueUsers: 4
                    },
                    labOrders: {
                        usage: 50,
                        uniqueUsers: 4
                    },
                    followUps: {
                        usage: 25,
                        uniqueUsers: 4
                    }
                },
                workflowEfficiency: {
                    averageTimeToCompletion: 15.5,
                    stepsPerCase: 4.2,
                    errorRate: 2.1
                }
            });
        });
    });

    describe('getTrendAnalysis', () => {
        it('should calculate trend analysis correctly', async () => {
            const mockSymptomTrends = [
                { _id: 'headache', frequency: 25 },
                { _id: 'fever', frequency: 20 }
            ];

            const mockDiagnosisTrends = [
                { _id: 'hypertension', frequency: 15, averageConfidence: 0.9 },
                { _id: 'diabetes', frequency: 12, averageConfidence: 0.85 }
            ];

            const mockInterventionTrends = [
                { _id: 'lisinopril', frequency: 10 },
                { _id: 'metformin', frequency: 8 }
            ];

            mockDiagnosticRequest.aggregate.mockResolvedValue(mockSymptomTrends);
            mockDiagnosticResult.aggregate
                .mockResolvedValueOnce(mockDiagnosisTrends)
                .mockResolvedValueOnce(mockInterventionTrends);

            const result = await diagnosticAnalyticsService.getTrendAnalysis(
                mockWorkplaceId,
                mockStartDate,
                mockEndDate
            );

            expect(result).toEqual({
                commonSymptoms: [
                    { symptom: 'headache', frequency: 25, trend: 'stable' },
                    { symptom: 'fever', frequency: 20, trend: 'stable' }
                ],
                commonDiagnoses: [
                    { diagnosis: 'hypertension', frequency: 15, confidence: 0.9 },
                    { diagnosis: 'diabetes', frequency: 12, confidence: 0.85 }
                ],
                commonInterventions: [
                    { intervention: 'lisinopril', frequency: 10, successRate: 85 },
                    { intervention: 'metformin', frequency: 8, successRate: 85 }
                ]
            });
        });
    });

    describe('getComparisonAnalysis', () => {
        it('should calculate comparison analysis correctly', async () => {
            const mockComparisonResults = [
                {
                    _id: { hasAI: true },
                    count: 40,
                    averageProcessingTime: 10,
                    accuracyScore: 0.88
                },
                {
                    _id: { hasAI: false },
                    count: 10,
                    averageProcessingTime: 25,
                    accuracyScore: null
                }
            ];

            mockDiagnosticResult.aggregate.mockResolvedValue(mockComparisonResults);

            const result = await diagnosticAnalyticsService.getComparisonAnalysis(
                mockWorkplaceId,
                mockStartDate,
                mockEndDate
            );

            expect(result).toEqual({
                manualVsAI: {
                    manualCases: 10,
                    aiAssistedCases: 40,
                    accuracyComparison: {
                        manual: 75,
                        aiAssisted: 0.88
                    },
                    timeComparison: {
                        manual: 25,
                        aiAssisted: 10
                    }
                }
            });
        });
    });

    describe('generateAnalyticsReport', () => {
        it('should generate comprehensive analytics report', async () => {
            // Mock all the individual methods
            const mockDiagnosticMetrics = {
                totalCases: 100,
                completedCases: 80,
                pendingCases: 15,
                failedCases: 5,
                averageProcessingTime: 300,
                successRate: 80
            };

            const mockAIPerformance = {
                totalAIRequests: 50,
                averageConfidenceScore: 0.85,
                pharmacistOverrideRate: 20,
                averageTokenUsage: 1500,
                modelPerformance: {}
            };

            // Mock the service methods
            jest.spyOn(diagnosticAnalyticsService, 'getDiagnosticMetrics')
                .mockResolvedValue(mockDiagnosticMetrics);
            jest.spyOn(diagnosticAnalyticsService, 'getAIPerformanceMetrics')
                .mockResolvedValue(mockAIPerformance);
            jest.spyOn(diagnosticAnalyticsService, 'getPatientOutcomeMetrics')
                .mockResolvedValue({
                    totalPatients: 25,
                    followUpCompliance: 80,
                    adherenceRate: 85,
                    interventionSuccess: 85,
                    referralRate: 20
                });
            jest.spyOn(diagnosticAnalyticsService, 'getUsageAnalytics')
                .mockResolvedValue({
                    dailyActiveUsers: 5,
                    weeklyActiveUsers: 15,
                    monthlyActiveUsers: 25,
                    featureAdoption: {},
                    workflowEfficiency: {
                        averageTimeToCompletion: 15,
                        stepsPerCase: 4.2,
                        errorRate: 2.1
                    }
                });
            jest.spyOn(diagnosticAnalyticsService, 'getTrendAnalysis')
                .mockResolvedValue({
                    commonSymptoms: [],
                    commonDiagnoses: [],
                    commonInterventions: []
                });
            jest.spyOn(diagnosticAnalyticsService, 'getComparisonAnalysis')
                .mockResolvedValue({
                    manualVsAI: {
                        manualCases: 10,
                        aiAssistedCases: 40,
                        accuracyComparison: { manual: 75, aiAssisted: 88 },
                        timeComparison: { manual: 25, aiAssisted: 10 }
                    }
                });

            const result = await diagnosticAnalyticsService.generateAnalyticsReport(
                mockWorkplaceId,
                mockStartDate,
                mockEndDate
            );

            expect(result).toHaveProperty('diagnosticMetrics', mockDiagnosticMetrics);
            expect(result).toHaveProperty('aiPerformance', mockAIPerformance);
            expect(result).toHaveProperty('generatedAt');
            expect(result).toHaveProperty('period');
            expect(result.period).toEqual({
                startDate: mockStartDate,
                endDate: mockEndDate
            });
        });

        it('should handle report generation errors', async () => {
            jest.spyOn(diagnosticAnalyticsService, 'getDiagnosticMetrics')
                .mockRejectedValue(new Error('Database error'));

            await expect(
                diagnosticAnalyticsService.generateAnalyticsReport(mockWorkplaceId)
            ).rejects.toThrow('Failed to generate analytics report');
        });
    });
});