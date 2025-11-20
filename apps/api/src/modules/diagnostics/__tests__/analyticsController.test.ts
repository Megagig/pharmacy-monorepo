/**
 * Analytics Controller Tests
 * Tests for analytics API endpoints and error handling
 */

import { Request, Response } from 'express';
import analyticsController from '../controllers/analyticsController';
import diagnosticAnalyticsService from '../services/diagnosticAnalyticsService';
import { AuthRequest } from '../../../types/auth';

// Mock the analytics service
jest.mock('../services/diagnosticAnalyticsService');

const mockAnalyticsService = diagnosticAnalyticsService as jest.Mocked<typeof diagnosticAnalyticsService>;

describe('AnalyticsController', () => {
    let mockReq: Partial<AuthRequest>;
    let mockRes: Partial<Response>;
    let mockJson: jest.Mock;
    let mockStatus: jest.Mock;

    beforeEach(() => {
        mockJson = jest.fn();
        mockStatus = jest.fn().mockReturnValue({ json: mockJson });

        mockReq = {
            user: {
                _id: 'user123',
                workplaceId: 'workplace123',
                role: 'pharmacist'
            },
            query: {}
        };

        mockRes = {
            json: mockJson,
            status: mockStatus
        };

        jest.clearAllMocks();
    });

    describe('getDiagnosticMetrics', () => {
        it('should return diagnostic metrics successfully', async () => {
            const mockMetrics = {
                totalCases: 100,
                completedCases: 80,
                pendingCases: 15,
                failedCases: 5,
                averageProcessingTime: 300,
                successRate: 80
            };

            mockAnalyticsService.getDiagnosticMetrics.mockResolvedValue(mockMetrics);

            await analyticsController.getDiagnosticMetrics(
                mockReq as AuthRequest,
                mockRes as Response
            );

            expect(mockAnalyticsService.getDiagnosticMetrics).toHaveBeenCalledWith(
                'workplace123',
                undefined,
                undefined
            );
            expect(mockJson).toHaveBeenCalledWith({
                success: true,
                data: mockMetrics
            });
        });

        it('should handle date parameters correctly', async () => {
            mockReq.query = {
                startDate: '2024-01-01',
                endDate: '2024-01-31'
            };

            const mockMetrics = {
                totalCases: 50,
                completedCases: 40,
                pendingCases: 8,
                failedCases: 2,
                averageProcessingTime: 250,
                successRate: 80
            };

            mockAnalyticsService.getDiagnosticMetrics.mockResolvedValue(mockMetrics);

            await analyticsController.getDiagnosticMetrics(
                mockReq as AuthRequest,
                mockRes as Response
            );

            expect(mockAnalyticsService.getDiagnosticMetrics).toHaveBeenCalledWith(
                'workplace123',
                new Date('2024-01-01'),
                new Date('2024-01-31')
            );
        });

        it('should handle service errors', async () => {
            mockAnalyticsService.getDiagnosticMetrics.mockRejectedValue(
                new Error('Database connection failed')
            );

            await analyticsController.getDiagnosticMetrics(
                mockReq as AuthRequest,
                mockRes as Response
            );

            expect(mockStatus).toHaveBeenCalledWith(500);
            expect(mockJson).toHaveBeenCalledWith({
                success: false,
                error: {
                    code: 'ANALYTICS_ERROR',
                    message: 'Failed to retrieve diagnostic metrics',
                    details: 'Database connection failed'
                }
            });
        });
    });

    describe('getAIPerformanceMetrics', () => {
        it('should return AI performance metrics successfully', async () => {
            const mockMetrics = {
                totalAIRequests: 50,
                averageConfidenceScore: 0.85,
                pharmacistOverrideRate: 15,
                averageTokenUsage: 1500,
                modelPerformance: {
                    'deepseek-v3.1': {
                        requests: 50,
                        averageConfidence: 0.85,
                        overrideRate: 15
                    }
                }
            };

            mockAnalyticsService.getAIPerformanceMetrics.mockResolvedValue(mockMetrics);

            await analyticsController.getAIPerformanceMetrics(
                mockReq as AuthRequest,
                mockRes as Response
            );

            expect(mockAnalyticsService.getAIPerformanceMetrics).toHaveBeenCalledWith(
                'workplace123',
                undefined,
                undefined
            );
            expect(mockJson).toHaveBeenCalledWith({
                success: true,
                data: mockMetrics
            });
        });

        it('should handle AI performance service errors', async () => {
            mockAnalyticsService.getAIPerformanceMetrics.mockRejectedValue(
                new Error('AI service unavailable')
            );

            await analyticsController.getAIPerformanceMetrics(
                mockReq as AuthRequest,
                mockRes as Response
            );

            expect(mockStatus).toHaveBeenCalledWith(500);
            expect(mockJson).toHaveBeenCalledWith({
                success: false,
                error: {
                    code: 'AI_ANALYTICS_ERROR',
                    message: 'Failed to retrieve AI performance metrics',
                    details: 'AI service unavailable'
                }
            });
        });
    });

    describe('getPatientOutcomeMetrics', () => {
        it('should return patient outcome metrics successfully', async () => {
            const mockMetrics = {
                totalPatients: 25,
                followUpCompliance: 80,
                adherenceRate: 85,
                interventionSuccess: 90,
                referralRate: 15
            };

            mockAnalyticsService.getPatientOutcomeMetrics.mockResolvedValue(mockMetrics);

            await analyticsController.getPatientOutcomeMetrics(
                mockReq as AuthRequest,
                mockRes as Response
            );

            expect(mockAnalyticsService.getPatientOutcomeMetrics).toHaveBeenCalledWith(
                'workplace123',
                undefined,
                undefined
            );
            expect(mockJson).toHaveBeenCalledWith({
                success: true,
                data: mockMetrics
            });
        });
    });

    describe('getUsageAnalytics', () => {
        it('should return usage analytics successfully', async () => {
            const mockAnalytics = {
                dailyActiveUsers: 5,
                weeklyActiveUsers: 15,
                monthlyActiveUsers: 25,
                featureAdoption: {
                    diagnostics: { usage: 100, uniqueUsers: 25 },
                    labOrders: { usage: 50, uniqueUsers: 20 },
                    followUps: { usage: 30, uniqueUsers: 15 }
                },
                workflowEfficiency: {
                    averageTimeToCompletion: 15,
                    stepsPerCase: 4.2,
                    errorRate: 2.1
                }
            };

            mockAnalyticsService.getUsageAnalytics.mockResolvedValue(mockAnalytics);

            await analyticsController.getUsageAnalytics(
                mockReq as AuthRequest,
                mockRes as Response
            );

            expect(mockAnalyticsService.getUsageAnalytics).toHaveBeenCalledWith(
                'workplace123',
                undefined,
                undefined
            );
            expect(mockJson).toHaveBeenCalledWith({
                success: true,
                data: mockAnalytics
            });
        });
    });

    describe('getTrendAnalysis', () => {
        it('should return trend analysis successfully', async () => {
            const mockTrends = {
                commonSymptoms: [
                    { symptom: 'headache', frequency: 25, trend: 'increasing' as const },
                    { symptom: 'fever', frequency: 20, trend: 'stable' as const }
                ],
                commonDiagnoses: [
                    { diagnosis: 'hypertension', frequency: 15, confidence: 0.9 },
                    { diagnosis: 'diabetes', frequency: 12, confidence: 0.85 }
                ],
                commonInterventions: [
                    { intervention: 'lisinopril', frequency: 10, successRate: 90 },
                    { intervention: 'metformin', frequency: 8, successRate: 85 }
                ]
            };

            mockAnalyticsService.getTrendAnalysis.mockResolvedValue(mockTrends);

            await analyticsController.getTrendAnalysis(
                mockReq as AuthRequest,
                mockRes as Response
            );

            expect(mockAnalyticsService.getTrendAnalysis).toHaveBeenCalledWith(
                'workplace123',
                undefined,
                undefined
            );
            expect(mockJson).toHaveBeenCalledWith({
                success: true,
                data: mockTrends
            });
        });
    });

    describe('getComparisonAnalysis', () => {
        it('should return comparison analysis successfully', async () => {
            const mockComparison = {
                manualVsAI: {
                    manualCases: 20,
                    aiAssistedCases: 80,
                    accuracyComparison: {
                        manual: 75,
                        aiAssisted: 88
                    },
                    timeComparison: {
                        manual: 30,
                        aiAssisted: 15
                    }
                }
            };

            mockAnalyticsService.getComparisonAnalysis.mockResolvedValue(mockComparison);

            await analyticsController.getComparisonAnalysis(
                mockReq as AuthRequest,
                mockRes as Response
            );

            expect(mockAnalyticsService.getComparisonAnalysis).toHaveBeenCalledWith(
                'workplace123',
                undefined,
                undefined
            );
            expect(mockJson).toHaveBeenCalledWith({
                success: true,
                data: mockComparison
            });
        });
    });

    describe('generateAnalyticsReport', () => {
        it('should generate analytics report successfully', async () => {
            const mockReport = {
                diagnosticMetrics: {
                    totalCases: 100,
                    completedCases: 85,
                    pendingCases: 10,
                    failedCases: 5,
                    averageProcessingTime: 300,
                    successRate: 85
                },
                aiPerformance: {
                    totalAIRequests: 50,
                    averageConfidenceScore: 0.88,
                    pharmacistOverrideRate: 15,
                    averageTokenUsage: 1500,
                    modelPerformance: {}
                },
                patientOutcomes: {
                    totalPatients: 25,
                    followUpCompliance: 80,
                    adherenceRate: 85,
                    interventionSuccess: 90,
                    referralRate: 15
                },
                usageAnalytics: {
                    dailyActiveUsers: 5,
                    weeklyActiveUsers: 15,
                    monthlyActiveUsers: 25,
                    featureAdoption: {},
                    workflowEfficiency: {
                        averageTimeToCompletion: 15,
                        stepsPerCase: 4.2,
                        errorRate: 2.1
                    }
                },
                trendAnalysis: {
                    commonSymptoms: [],
                    commonDiagnoses: [],
                    commonInterventions: []
                },
                comparisonAnalysis: {
                    manualVsAI: {
                        manualCases: 20,
                        aiAssistedCases: 80,
                        accuracyComparison: { manual: 75, aiAssisted: 88 },
                        timeComparison: { manual: 30, aiAssisted: 15 }
                    }
                },
                generatedAt: new Date(),
                period: { startDate: new Date('2024-01-01'), endDate: new Date('2024-01-31') }
            };

            mockAnalyticsService.generateAnalyticsReport.mockResolvedValue(mockReport);

            await analyticsController.generateAnalyticsReport(
                mockReq as AuthRequest,
                mockRes as Response
            );

            expect(mockAnalyticsService.generateAnalyticsReport).toHaveBeenCalledWith(
                'workplace123',
                undefined,
                undefined
            );
            expect(mockJson).toHaveBeenCalledWith({
                success: true,
                data: mockReport
            });
        });

        it('should handle PDF format request (not implemented)', async () => {
            mockReq.query = { format: 'pdf' };

            await analyticsController.generateAnalyticsReport(
                mockReq as AuthRequest,
                mockRes as Response
            );

            expect(mockStatus).toHaveBeenCalledWith(501);
            expect(mockJson).toHaveBeenCalledWith({
                success: false,
                error: {
                    code: 'PDF_NOT_IMPLEMENTED',
                    message: 'PDF report generation not yet implemented'
                }
            });
        });
    });

    describe('getDashboardSummary', () => {
        it('should return dashboard summary successfully', async () => {
            const mockDiagnosticMetrics = {
                totalCases: 100,
                completedCases: 85,
                pendingCases: 10,
                failedCases: 5,
                averageProcessingTime: 300,
                successRate: 85
            };

            const mockAIPerformance = {
                totalAIRequests: 50,
                averageConfidenceScore: 0.88,
                pharmacistOverrideRate: 15,
                averageTokenUsage: 1500,
                modelPerformance: {}
            };

            const mockPatientOutcomes = {
                totalPatients: 25,
                followUpCompliance: 85,
                adherenceRate: 90,
                interventionSuccess: 88,
                referralRate: 12
            };

            const mockUsageAnalytics = {
                dailyActiveUsers: 5,
                weeklyActiveUsers: 15,
                monthlyActiveUsers: 25,
                featureAdoption: {},
                workflowEfficiency: {
                    averageTimeToCompletion: 15,
                    stepsPerCase: 4.2,
                    errorRate: 2.1
                }
            };

            mockAnalyticsService.getDiagnosticMetrics.mockResolvedValue(mockDiagnosticMetrics);
            mockAnalyticsService.getAIPerformanceMetrics.mockResolvedValue(mockAIPerformance);
            mockAnalyticsService.getPatientOutcomeMetrics.mockResolvedValue(mockPatientOutcomes);
            mockAnalyticsService.getUsageAnalytics.mockResolvedValue(mockUsageAnalytics);

            await analyticsController.getDashboardSummary(
                mockReq as AuthRequest,
                mockRes as Response
            );

            expect(mockJson).toHaveBeenCalledWith({
                success: true,
                data: expect.objectContaining({
                    period: '30d',
                    keyMetrics: {
                        totalCases: 100,
                        successRate: 85,
                        averageProcessingTime: 300,
                        aiConfidence: 0.88,
                        overrideRate: 15,
                        activeUsers: 25,
                        patientOutcomes: {
                            followUpCompliance: 85,
                            adherenceRate: 90,
                            referralRate: 12
                        }
                    },
                    alerts: []
                })
            });
        });

        it('should generate alerts for concerning metrics', async () => {
            const mockDiagnosticMetrics = {
                totalCases: 100,
                completedCases: 85,
                pendingCases: 10,
                failedCases: 5,
                averageProcessingTime: 300,
                successRate: 85 // Below 90%
            };

            const mockAIPerformance = {
                totalAIRequests: 50,
                averageConfidenceScore: 0.88,
                pharmacistOverrideRate: 25, // Above 20%
                averageTokenUsage: 1500,
                modelPerformance: {}
            };

            const mockPatientOutcomes = {
                totalPatients: 25,
                followUpCompliance: 75, // Below 80%
                adherenceRate: 90,
                interventionSuccess: 88,
                referralRate: 12
            };

            const mockUsageAnalytics = {
                dailyActiveUsers: 5,
                weeklyActiveUsers: 15,
                monthlyActiveUsers: 25,
                featureAdoption: {},
                workflowEfficiency: {
                    averageTimeToCompletion: 15,
                    stepsPerCase: 4.2,
                    errorRate: 2.1
                }
            };

            mockAnalyticsService.getDiagnosticMetrics.mockResolvedValue(mockDiagnosticMetrics);
            mockAnalyticsService.getAIPerformanceMetrics.mockResolvedValue(mockAIPerformance);
            mockAnalyticsService.getPatientOutcomeMetrics.mockResolvedValue(mockPatientOutcomes);
            mockAnalyticsService.getUsageAnalytics.mockResolvedValue(mockUsageAnalytics);

            await analyticsController.getDashboardSummary(
                mockReq as AuthRequest,
                mockRes as Response
            );

            const response = mockJson.mock.calls[0][0];
            expect(response.data.alerts).toHaveLength(3);
            expect(response.data.alerts).toContainEqual({
                type: 'warning',
                message: 'Diagnostic success rate is below 90%',
                metric: 'successRate',
                value: 85
            });
            expect(response.data.alerts).toContainEqual({
                type: 'warning',
                message: 'AI override rate is above 20%',
                metric: 'overrideRate',
                value: 25
            });
            expect(response.data.alerts).toContainEqual({
                type: 'error',
                message: 'Follow-up compliance is below 80%',
                metric: 'followUpCompliance',
                value: 75
            });
        });

        it('should handle different period parameters', async () => {
            mockReq.query = { period: '7d' };

            // Mock all required services
            mockAnalyticsService.getDiagnosticMetrics.mockResolvedValue({
                totalCases: 20,
                completedCases: 18,
                pendingCases: 2,
                failedCases: 0,
                averageProcessingTime: 250,
                successRate: 90
            });
            mockAnalyticsService.getAIPerformanceMetrics.mockResolvedValue({
                totalAIRequests: 15,
                averageConfidenceScore: 0.9,
                pharmacistOverrideRate: 10,
                averageTokenUsage: 1400,
                modelPerformance: {}
            });
            mockAnalyticsService.getPatientOutcomeMetrics.mockResolvedValue({
                totalPatients: 10,
                followUpCompliance: 90,
                adherenceRate: 95,
                interventionSuccess: 92,
                referralRate: 8
            });
            mockAnalyticsService.getUsageAnalytics.mockResolvedValue({
                dailyActiveUsers: 3,
                weeklyActiveUsers: 8,
                monthlyActiveUsers: 15,
                featureAdoption: {},
                workflowEfficiency: {
                    averageTimeToCompletion: 12,
                    stepsPerCase: 4.0,
                    errorRate: 1.5
                }
            });

            await analyticsController.getDashboardSummary(
                mockReq as AuthRequest,
                mockRes as Response
            );

            const response = mockJson.mock.calls[0][0];
            expect(response.data.period).toBe('7d');
        });
    });
});