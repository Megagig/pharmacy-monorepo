import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useDiagnosticStore } from '../diagnosticStore';
import { diagnosticApi } from '../../api/diagnosticApi';
import type { DiagnosticRequest, DiagnosticResult, DiagnosticRequestForm } from '../../types';

// Mock the API
vi.mock('../../api/diagnosticApi', () => ({
    diagnosticApi: {
        createRequest: vi.fn(),
        getResult: vi.fn(),
        getHistory: vi.fn(),
        approveResult: vi.fn(),
        modifyResult: vi.fn(),
        rejectResult: vi.fn(),
        cancelRequest: vi.fn(),
        getStatus: vi.fn(),
        getAnalytics: vi.fn(),
    },
}));

const mockDiagnosticRequest: DiagnosticRequest = {
    _id: 'req-1',
    patientId: 'patient-1',
    pharmacistId: 'pharmacist-1',
    workplaceId: 'workplace-1',
    inputSnapshot: {
        symptoms: {
            subjective: ['headache', 'nausea'],
            objective: ['fever'],
            duration: '2 days',
            severity: 'moderate',
            onset: 'acute',
        },
        vitals: {
            temperature: 38.5,
            heartRate: 90,
        },
    },
    consentObtained: true,
    consentTimestamp: '2024-01-01T10:00:00Z',
    promptVersion: '1.0',
    status: 'pending',
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-01T10:00:00Z',
};

const mockDiagnosticResult: DiagnosticResult = {
    _id: 'result-1',
    requestId: 'req-1',
    diagnoses: [
        {
            condition: 'Viral infection',
            probability: 0.8,
            reasoning: 'Symptoms consistent with viral illness',
            severity: 'medium',
        },
    ],
    suggestedTests: [],
    medicationSuggestions: [],
    redFlags: [],
    aiMetadata: {
        modelId: 'deepseek-v3.1',
        modelVersion: '3.1',
        confidenceScore: 0.8,
        processingTime: 5000,
        tokenUsage: {
            promptTokens: 100,
            completionTokens: 200,
            totalTokens: 300,
        },
        requestId: 'ai-req-1',
    },
    disclaimer: 'AI-generated recommendation',
    createdAt: '2024-01-01T10:05:00Z',
};

const mockRequestForm: DiagnosticRequestForm = {
    patientId: 'patient-1',
    symptoms: {
        subjective: ['headache', 'nausea'],
        objective: ['fever'],
        duration: '2 days',
        severity: 'moderate',
        onset: 'acute',
    },
    consent: true,
};

describe('DiagnosticStore', () => {
    beforeEach(() => {
        // Reset store state
        useDiagnosticStore.setState({
            requests: [],
            results: [],
            selectedRequest: null,
            selectedResult: null,
            filters: {
                search: '',
                patientId: '',
                status: undefined,
                dateFrom: '',
                dateTo: '',
                page: 1,
                limit: 20,
                sortBy: 'createdAt',
                sortOrder: 'desc',
            },
            pagination: {
                page: 1,
                limit: 20,
                total: 0,
                pages: 0,
                hasNext: false,
                hasPrev: false,
            },
            uiState: {
                pollingActive: false,
                pollingInterval: null,
                showCreateModal: false,
                showResultModal: false,
                activeStep: 0,
            },
            analytics: null,
            loading: {
                createRequest: false,
                fetchRequests: false,
                fetchResult: false,
                approveResult: false,
                fetchAnalytics: false,
                polling: false,
            },
            errors: {
                createRequest: null,
                fetchRequests: null,
                fetchResult: null,
                approveResult: null,
                fetchAnalytics: null,
                polling: null,
            },
        });

        // Clear all mocks
        vi.clearAllMocks();
    });

    afterEach(() => {
        // Stop any active polling
        const { stopPolling } = useDiagnosticStore.getState();
        stopPolling();
    });

    describe('createRequest', () => {
        it('should create a diagnostic request successfully', async () => {
            const mockResponse = {
                success: true,
                data: mockDiagnosticRequest,
            };

            vi.mocked(diagnosticApi.createRequest).mockResolvedValue(mockResponse);

            const { createRequest } = useDiagnosticStore.getState();
            const result = await createRequest(mockRequestForm);

            expect(diagnosticApi.createRequest).toHaveBeenCalledWith(mockRequestForm);
            expect(result).toEqual(mockDiagnosticRequest);

            const state = useDiagnosticStore.getState();
            expect(state.requests).toContain(mockDiagnosticRequest);
            expect(state.selectedRequest).toEqual(mockDiagnosticRequest);
            expect(state.loading.createRequest).toBe(false);
            expect(state.errors.createRequest).toBeNull();
        });

        it('should handle create request error', async () => {
            const mockResponse = {
                success: false,
                message: 'Failed to create request',
            };

            vi.mocked(diagnosticApi.createRequest).mockResolvedValue(mockResponse);

            const { createRequest } = useDiagnosticStore.getState();
            const result = await createRequest(mockRequestForm);

            expect(result).toBeNull();

            const state = useDiagnosticStore.getState();
            expect(state.requests).toHaveLength(0);
            expect(state.errors.createRequest).toBe('Failed to create request');
        });
    });

    describe('fetchRequests', () => {
        it('should fetch diagnostic requests successfully', async () => {
            const mockResponse = {
                success: true,
                data: {
                    results: [mockDiagnosticRequest],
                },
                meta: {
                    page: 1,
                    limit: 20,
                    total: 1,
                    pages: 1,
                    hasNext: false,
                    hasPrev: false,
                },
            };

            vi.mocked(diagnosticApi.getHistory).mockResolvedValue(mockResponse);

            const { fetchRequests } = useDiagnosticStore.getState();
            await fetchRequests();

            expect(diagnosticApi.getHistory).toHaveBeenCalled();

            const state = useDiagnosticStore.getState();
            expect(state.requests).toEqual([mockDiagnosticRequest]);
            expect(state.pagination.total).toBe(1);
            expect(state.loading.fetchRequests).toBe(false);
            expect(state.errors.fetchRequests).toBeNull();
        });
    });

    describe('fetchResult', () => {
        it('should fetch diagnostic result successfully', async () => {
            const mockResponse = {
                success: true,
                data: mockDiagnosticResult,
            };

            vi.mocked(diagnosticApi.getResult).mockResolvedValue(mockResponse);

            const { fetchResult } = useDiagnosticStore.getState();
            const result = await fetchResult('req-1');

            expect(diagnosticApi.getResult).toHaveBeenCalledWith('req-1');
            expect(result).toEqual(mockDiagnosticResult);

            const state = useDiagnosticStore.getState();
            expect(state.results).toContain(mockDiagnosticResult);
            expect(state.selectedResult).toEqual(mockDiagnosticResult);
        });
    });

    describe('approveResult', () => {
        it('should approve result successfully', async () => {
            const approvedResult = {
                ...mockDiagnosticResult,
                pharmacistReview: {
                    status: 'approved' as const,
                    reviewedBy: 'pharmacist-1',
                    reviewedAt: '2024-01-01T11:00:00Z',
                },
            };

            const mockResponse = {
                success: true,
                data: approvedResult,
            };

            vi.mocked(diagnosticApi.approveResult).mockResolvedValue(mockResponse);

            // Add result to state first
            useDiagnosticStore.setState({
                results: [mockDiagnosticResult],
            });

            const { approveResult } = useDiagnosticStore.getState();
            const success = await approveResult('result-1');

            expect(diagnosticApi.approveResult).toHaveBeenCalledWith('result-1');
            expect(success).toBe(true);

            const state = useDiagnosticStore.getState();
            expect(state.selectedResult).toEqual(approvedResult);
        });
    });

    describe('polling', () => {
        it('should start and stop polling', () => {
            const { startPolling, stopPolling } = useDiagnosticStore.getState();

            startPolling('req-1', 1000);

            let state = useDiagnosticStore.getState();
            expect(state.uiState.pollingActive).toBe(true);
            expect(state.uiState.pollingInterval).not.toBeNull();

            stopPolling();

            state = useDiagnosticStore.getState();
            expect(state.uiState.pollingActive).toBe(false);
            expect(state.uiState.pollingInterval).toBeNull();
        });
    });

    describe('filters', () => {
        it('should set and clear filters', () => {
            const { setFilters, clearFilters } = useDiagnosticStore.getState();

            setFilters({ search: 'test', patientId: 'patient-1' });

            let state = useDiagnosticStore.getState();
            expect(state.filters.search).toBe('test');
            expect(state.filters.patientId).toBe('patient-1');

            clearFilters();

            state = useDiagnosticStore.getState();
            expect(state.filters.search).toBe('');
            expect(state.filters.patientId).toBe('');
        });
    });

    describe('selectors', () => {
        beforeEach(() => {
            // Set up test data
            useDiagnosticStore.setState({
                requests: [
                    mockDiagnosticRequest,
                    {
                        ...mockDiagnosticRequest,
                        _id: 'req-2',
                        status: 'completed',
                        patientId: 'patient-2',
                    },
                ],
                results: [
                    mockDiagnosticResult,
                    {
                        ...mockDiagnosticResult,
                        _id: 'result-2',
                        requestId: 'req-2',
                    },
                ],
            });
        });

        it('should get requests by patient', () => {
            const { getRequestsByPatient } = useDiagnosticStore.getState();
            const patientRequests = getRequestsByPatient('patient-1');

            expect(patientRequests).toHaveLength(1);
            expect(patientRequests[0]._id).toBe('req-1');
        });

        it('should get results by request', () => {
            const { getResultsByRequest } = useDiagnosticStore.getState();
            const requestResults = getResultsByRequest('req-1');

            expect(requestResults).toHaveLength(1);
            expect(requestResults[0]._id).toBe('result-1');
        });

        it('should get pending requests', () => {
            const { getPendingRequests } = useDiagnosticStore.getState();
            const pendingRequests = getPendingRequests();

            expect(pendingRequests).toHaveLength(1);
            expect(pendingRequests[0].status).toBe('pending');
        });

        it('should get completed requests', () => {
            const { getCompletedRequests } = useDiagnosticStore.getState();
            const completedRequests = getCompletedRequests();

            expect(completedRequests).toHaveLength(1);
            expect(completedRequests[0].status).toBe('completed');
        });
    });

    describe('optimistic updates', () => {
        it('should add request to state', () => {
            const { addRequestToState } = useDiagnosticStore.getState();

            addRequestToState(mockDiagnosticRequest);

            const state = useDiagnosticStore.getState();
            expect(state.requests).toContain(mockDiagnosticRequest);
            expect(state.pagination.total).toBe(1);
        });

        it('should update request in state', () => {
            const { addRequestToState, updateRequestInState } = useDiagnosticStore.getState();

            addRequestToState(mockDiagnosticRequest);
            updateRequestInState('req-1', { status: 'completed' });

            const state = useDiagnosticStore.getState();
            const updatedRequest = state.requests.find(r => r._id === 'req-1');
            expect(updatedRequest?.status).toBe('completed');
        });

        it('should remove request from state', () => {
            const { addRequestToState, removeRequestFromState } = useDiagnosticStore.getState();

            addRequestToState(mockDiagnosticRequest);
            removeRequestFromState('req-1');

            const state = useDiagnosticStore.getState();
            expect(state.requests).toHaveLength(0);
            expect(state.pagination.total).toBe(0);
        });
    });

    describe('UI state management', () => {
        it('should manage modal states', () => {
            const { setShowCreateModal, setShowResultModal } = useDiagnosticStore.getState();

            setShowCreateModal(true);
            let state = useDiagnosticStore.getState();
            expect(state.uiState.showCreateModal).toBe(true);

            setShowResultModal(true);
            state = useDiagnosticStore.getState();
            expect(state.uiState.showResultModal).toBe(true);
        });

        it('should manage active step', () => {
            const { setActiveStep } = useDiagnosticStore.getState();

            setActiveStep(2);

            const state = useDiagnosticStore.getState();
            expect(state.uiState.activeStep).toBe(2);
        });
    });

    describe('error handling', () => {
        it('should handle network errors', async () => {
            const networkError = new Error('Network error');
            vi.mocked(diagnosticApi.createRequest).mockRejectedValue(networkError);

            const { createRequest } = useDiagnosticStore.getState();
            const result = await createRequest(mockRequestForm);

            expect(result).toBeNull();

            const state = useDiagnosticStore.getState();
            expect(state.errors.createRequest).toBe('Network error');
        });

        it('should clear errors', () => {
            // Set some errors
            useDiagnosticStore.setState({
                errors: {
                    createRequest: 'Some error',
                    fetchRequests: 'Another error',
                    fetchResult: null,
                    approveResult: null,
                    fetchAnalytics: null,
                    polling: null,
                },
            });

            const { clearErrors } = useDiagnosticStore.getState();
            clearErrors();

            const state = useDiagnosticStore.getState();
            expect(Object.values(state.errors)).toEqual([null, null, null, null, null, null]);
        });
    });
});