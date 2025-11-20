import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import {
    useClinicalInterventions,
    useClinicalIntervention,
    useCreateIntervention,
} from '../useClinicalInterventions';
import type { CreateInterventionData } from '../../stores/clinicalInterventionStore';

// Mock the clinical intervention service
vi.mock('../../services/clinicalInterventionService', () => ({
    clinicalInterventionService: {
        getInterventions: vi.fn(),
        getInterventionById: vi.fn(),
        createIntervention: vi.fn(),
    },
}));

// Mock the UI store
vi.mock('../../stores', () => ({
    useUIStore: vi.fn(() => ({
        addNotification: vi.fn(),
    })),
}));

// Test wrapper with QueryClient
const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    });

    return ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client= { queryClient } > { children } </QueryClientProvider>
  );
};

describe('useClinicalInterventions Query Hooks', () => {
    let mockService: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockService = require('../../services/clinicalInterventionService').clinicalInterventionService;
    });

    describe('useClinicalInterventions', () => {
        it('should fetch interventions successfully', async () => {
            const mockData = {
                success: true,
                data: {
                    data: [{
                        _id: 'intervention1',
                        interventionNumber: 'CI-202412-0001',
                        category: 'drug_therapy_problem',
                        priority: 'high',
                        status: 'identified',
                    }],
                    pagination: {
                        page: 1,
                        limit: 20,
                        total: 1,
                        pages: 1,
                        hasNext: false,
                        hasPrev: false,
                    },
                },
            };

            mockService.getInterventions.mockResolvedValue(mockData);

            const { result } = renderHook(() => useClinicalInterventions(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(mockData);
            expect(mockService.getInterventions).toHaveBeenCalledWith({});
        });
    });

    describe('useClinicalIntervention', () => {
        it('should fetch single intervention successfully', async () => {
            const mockData = {
                success: true,
                data: {
                    _id: 'intervention1',
                    interventionNumber: 'CI-202412-0001',
                    category: 'drug_therapy_problem',
                    priority: 'high',
                    status: 'identified',
                },
            };

            mockService.getInterventionById.mockResolvedValue(mockData);

            const { result } = renderHook(() => useClinicalIntervention('intervention1'), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(mockData);
            expect(mockService.getInterventionById).toHaveBeenCalledWith('intervention1');
        });
    });

    describe('useCreateIntervention', () => {
        it('should create intervention successfully', async () => {
            const mockData = {
                success: true,
                data: {
                    _id: 'intervention1',
                    interventionNumber: 'CI-202412-0001',
                    category: 'drug_therapy_problem',
                    priority: 'high',
                    status: 'identified',
                },
            };

            const createData: CreateInterventionData = {
                patientId: 'patient1',
                category: 'drug_therapy_problem',
                priority: 'high',
                issueDescription: 'Test issue description',
            };

            mockService.createIntervention.mockResolvedValue(mockData);

            const { result } = renderHook(() => useCreateIntervention(), {
                wrapper: createWrapper(),
            });

            result.current.mutate(createData);

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(mockService.createIntervention).toHaveBeenCalledWith(createData);
        });
    });
});