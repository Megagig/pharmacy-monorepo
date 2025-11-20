import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import {
    useCreateDiagnosticRequest,
    useDiagnosticResult,
    useDiagnosticHistory,
    useApproveDiagnostic,
} from '../useDiagnostics';
import { diagnosticApi } from '../../api/diagnosticApi';

// Mock the API
vi.mock('../../api/diagnosticApi');
vi.mock('../../../../stores', () => ({
    useUIStore: () => ({
        addNotification: vi.fn(),
    }),
}));

const mockedDiagnosticApi = vi.mocked(diagnosticApi);

// Test wrapper with QueryClient
const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
            mutations: {
                retry: false,
            },
        },
    });

    return ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client= { queryClient } > { children } </QueryClientProvider>
    );
};

describe('useDiagnostics hooks', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('useCreateDiagnosticRequest', () => {
        it('should create diagnostic request successfully', async () => {
            const mockRequest = {
                _id: 'test-id',
                patientId: 'patient-1',
                status: 'pending' as const,
                inputSnapshot: {
                    symptoms: {
                        subjective: ['headache'],
                        objective: ['fever'],
                        duration: '2 days',
                        severity: 'moderate' as const,
                        onset: 'acute' as const,
                    },
                },
                consentObtained: true,
                createdAt: '2023-01-01T00:00:00Z',
                updatedAt: '2023-01-01T00:00:00Z',
            };

            mockedDiagnosticApi.createRequest.mockResolvedValue({
                success: true,
                data: mockRequest,
            });

            const wrapper = createWrapper();
            const { result } = renderHook(() => useCreateDiagnosticRequest(), { wrapper });

            const requestData = {
                patientId: 'patient-1',
                symptoms: {
                    subjective: ['headache'],
                    objective: ['fever'],
                    duration: '2 days',
                    severity: 'moderate' as const,
                    onset: 'acute' as const,
                },
                consent: true,
            };

            result.current.mutate(requestData);

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(mockedDiagnosticApi.createRequest).toHaveBeenCalledWith(requestData);
        });

        it('should handle creation errors', async () => {
            mockedDiagnosticApi.createRequest.mockRejectedValue(
                new Error('Creation failed')
            );

            const wrapper = createWrapper();
            const { result } = renderHook(() => useCreateDiagnosticRequest(), { wrapper });

            const requestData = {
                patientId: 'patient-1',
                symptoms: {
                    subjective: ['headache'],
                    objective: [],
                    duration: '2 days',
                    severity: 'moderate' as const,
                    onset: 'acute' as const,
                },
                consent: true,
            };

            result.current.mutate(requestData);

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            expect(result.current.error).toEqual(new Error('Creation failed'));
        });
    });

    describe('useDiagnosticResult', () => {
        it('should fetch diagnostic result with polling', async () => {
            const mockResult = {
                _id: 'result-id',
                requestId: 'request-id',
                diagnoses: [
                    {
                        condition: 'Migraine',
                        probability: 0.85,
                        reasoning: 'Based on symptoms',
                        severity: 'medium' as const,
                    },
                ],
                suggestedTests: [],
                medicationSuggestions: [],
                redFlags: [],
                aiMetadata: {
                    modelId: 'deepseek-v3.1',
                    modelVersion: '1.0',
                    confidenceScore: 0.85,
                    processingTime: 5000,
                    tokenUsage: {
                        promptTokens: 100,
                        completionTokens: 200,
                        totalTokens: 300,
                    },
                    requestId: 'ai-request-id',
                },
                disclaimer: 'AI-generated result',
                createdAt: '2023-01-01T00:00:00Z',
            };

            mockedDiagnosticApi.getResult.mockResolvedValue({
                success: true,
                data: mockResult,
            });

            const wrapper = createWrapper();
            const { result } = renderHook(
                () => useDiagnosticResult('request-id', { enablePolling: false }),
                { wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data?.data).toEqual(mockResult);
            expect(mockedDiagnosticApi.getResult).toHaveBeenCalledWith('request-id');
        });

        it('should handle 404 errors gracefully', async () => {
            mockedDiagnosticApi.getResult.mockRejectedValue({
                response: { status: 404 },
            });

            const wrapper = createWrapper();
            const { result } = renderHook(
                () => useDiagnosticResult('request-id', { enablePolling: false }),
                { wrapper }
            );

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            // Should retry for 404 errors
            expect(mockedDiagnosticApi.getResult).toHaveBeenCalledTimes(1);
        });
    });

    describe('useDiagnosticHistory', () => {
        it('should fetch diagnostic history with filters', async () => {
            const mockHistory = {
                success: true,
                data: {
                    results: [
                        {
                            _id: 'request-1',
                            patientId: 'patient-1',
                            status: 'completed' as const,
                            createdAt: '2023-01-01T00:00:00Z',
                        },
                    ],
                },
                meta: {
                    total: 1,
                    page: 1,
                    limit: 10,
                    totalPages: 1,
                    hasNext: false,
                    hasPrev: false,
                },
            };

            mockedDiagnosticApi.getHistory.mockResolvedValue(mockHistory);

            const wrapper = createWrapper();
            const { result } = renderHook(
                () => useDiagnosticHistory({ patientId: 'patient-1', page: 1, limit: 10 }),
                { wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(mockHistory);
            expect(mockedDiagnosticApi.getHistory).toHaveBeenCalledWith({
                patientId: 'patient-1',
                page: 1,
                limit: 10,
            });
        });
    });

    describe('useApproveDiagnostic', () => {
        it('should approve diagnostic result successfully', async () => {
            const mockApprovedResult = {
                _id: 'result-id',
                requestId: 'request-id',
                pharmacistReview: {
                    status: 'approved' as const,
                    reviewedBy: 'pharmacist-id',
                    reviewedAt: '2023-01-01T00:00:00Z',
                },
            };

            mockedDiagnosticApi.approveResult.mockResolvedValue({
                success: true,
                data: mockApprovedResult,
            });

            const wrapper = createWrapper();
            const { result } = renderHook(() => useApproveDiagnostic(), { wrapper });

            result.current.mutate('result-id');

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(mockedDiagnosticApi.approveResult).toHaveBeenCalledWith('result-id');
        });
    });
});