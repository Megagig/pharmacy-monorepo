import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useClinicalInterventionStore } from '../clinicalInterventionStore';

// Mock the service
vi.mock('../../services/clinicalInterventionService', () => ({
    default: {
        getInterventions: vi.fn(),
        getInterventionById: vi.fn(),
        createIntervention: vi.fn(),
        updateIntervention: vi.fn(),
        deleteIntervention: vi.fn(),
        getDashboardMetrics: vi.fn(),
        getPatientInterventions: vi.fn()
    }
}));

describe('ClinicalInterventionStore', () => {
    beforeEach(() => {
        // Reset store state before each test
        const { result } = renderHook(() => useClinicalInterventionStore());
        act(() => {
            result.current.reset();
        });
        vi.clearAllMocks();
    });

    describe('Initial State', () => {
        it('should have correct initial state', () => {
            const { result } = renderHook(() => useClinicalInterventionStore());

            expect(result.current.interventions).toEqual([]);
            expect(result.current.currentIntervention).toBeNull();
            expect(result.current.metrics).toBeNull();
            expect(result.current.filters).toEqual({
                page: 1,
                limit: 20,
                sortBy: 'identifiedDate',
                sortOrder: 'desc'
            });
            expect(result.current.pagination).toBeNull();
            expect(result.current.loading).toBe(false);
            expect(result.current.error).toBeNull();
        });
    });

    describe('Loading State Management', () => {
        it('should set loading state correctly', () => {
            const { result } = renderHook(() => useClinicalInterventionStore());

            act(() => {
                result.current.setLoading(true);
            });

            expect(result.current.loading).toBe(true);

            act(() => {
                result.current.setLoading(false);
            });

            expect(result.current.loading).toBe(false);
        });
    });

    describe('Error State Management', () => {
        it('should set error state correctly', () => {
            const { result } = renderHook(() => useClinicalInterventionStore());
            const testError = 'Test error message';

            act(() => {
                result.current.setError(testError);
            });

            expect(result.current.error).toBe(testError);
        });

        it('should clear error state', () => {
            const { result } = renderHook(() => useClinicalInterventionStore());

            act(() => {
                result.current.setError('Test error');
            });

            expect(result.current.error).toBe('Test error');

            act(() => {
                result.current.clearError();
            });

            expect(result.current.error).toBeNull();
        });
    });

    describe('Interventions Management', () => {
        const mockInterventions = [
            {
                _id: 'intervention-1',
                interventionNumber: 'CI-202412-0001',
                category: 'drug_therapy_problem',
                priority: 'high',
                status: 'in_progress',
                issueDescription: 'Patient experiencing side effects',
                patientId: 'patient-1',
                identifiedBy: 'user-1',
                identifiedDate: '2024-12-01T10:00:00Z'
            },
            {
                _id: 'intervention-2',
                interventionNumber: 'CI-202412-0002',
                category: 'adverse_drug_reaction',
                priority: 'critical',
                status: 'completed',
                issueDescription: 'Severe allergic reaction',
                patientId: 'patient-2',
                identifiedBy: 'user-1',
                identifiedDate: '2024-12-02T14:30:00Z'
            }
        ];

        it('should set interventions correctly', () => {
            const { result } = renderHook(() => useClinicalInterventionStore());

            act(() => {
                result.current.setInterventions(mockInterventions);
            });

            expect(result.current.interventions).toEqual(mockInterventions);
        });

        it('should add new intervention', () => {
            const { result } = renderHook(() => useClinicalInterventionStore());
            const newIntervention = {
                _id: 'intervention-3',
                interventionNumber: 'CI-202412-0003',
                category: 'medication_nonadherence',
                priority: 'medium',
                status: 'identified',
                issueDescription: 'Patient not taking medication as prescribed',
                patientId: 'patient-3',
                identifiedBy: 'user-1',
                identifiedDate: '2024-12-03T09:00:00Z'
            };

            act(() => {
                result.current.setInterventions(mockInterventions);
            });

            act(() => {
                result.current.addIntervention(newIntervention);
            });

            expect(result.current.interventions).toHaveLength(3);
            expect(result.current.interventions[0]).toEqual(newIntervention); // Should be added at the beginning
        });

        it('should update existing intervention', () => {
            const { result } = renderHook(() => useClinicalInterventionStore());

            act(() => {
                result.current.setInterventions(mockInterventions);
            });

            const updatedIntervention = {
                ...mockInterventions[0],
                priority: 'critical',
                status: 'implemented'
            };

            act(() => {
                result.current.updateIntervention(updatedIntervention);
            });

            expect(result.current.interventions[0].priority).toBe('critical');
            expect(result.current.interventions[0].status).toBe('implemented');
        });

        it('should remove intervention', () => {
            const { result } = renderHook(() => useClinicalInterventionStore());

            act(() => {
                result.current.setInterventions(mockInterventions);
            });

            act(() => {
                result.current.removeIntervention('intervention-1');
            });

            expect(result.current.interventions).toHaveLength(1);
            expect(result.current.interventions[0]._id).toBe('intervention-2');
        });

        it('should not remove non-existent intervention', () => {
            const { result } = renderHook(() => useClinicalInterventionStore());

            act(() => {
                result.current.setInterventions(mockInterventions);
            });

            act(() => {
                result.current.removeIntervention('non-existent');
            });

            expect(result.current.interventions).toHaveLength(2);
        });
    });

    describe('Current Intervention Management', () => {
        const mockIntervention = {
            _id: 'intervention-1',
            interventionNumber: 'CI-202412-0001',
            category: 'drug_therapy_problem',
            priority: 'high',
            status: 'in_progress',
            issueDescription: 'Patient experiencing side effects',
            strategies: [],
            assignments: [],
            outcomes: null,
            followUp: { required: false }
        };

        it('should set current intervention', () => {
            const { result } = renderHook(() => useClinicalInterventionStore());

            act(() => {
                result.current.setCurrentIntervention(mockIntervention);
            });

            expect(result.current.currentIntervention).toEqual(mockIntervention);
        });

        it('should clear current intervention', () => {
            const { result } = renderHook(() => useClinicalInterventionStore());

            act(() => {
                result.current.setCurrentIntervention(mockIntervention);
            });

            expect(result.current.currentIntervention).toEqual(mockIntervention);

            act(() => {
                result.current.clearCurrentIntervention();
            });

            expect(result.current.currentIntervention).toBeNull();
        });
    });

    describe('Filters Management', () => {
        it('should update filters correctly', () => {
            const { result } = renderHook(() => useClinicalInterventionStore());

            const newFilters = {
                category: 'drug_therapy_problem',
                priority: 'high',
                status: 'in_progress',
                search: 'side effects',
                page: 2,
                limit: 50
            };

            act(() => {
                result.current.updateFilters(newFilters);
            });

            expect(result.current.filters).toEqual({
                ...result.current.filters,
                ...newFilters
            });
        });

        it('should reset filters to default', () => {
            const { result } = renderHook(() => useClinicalInterventionStore());

            // First set some filters
            act(() => {
                result.current.updateFilters({
                    category: 'drug_therapy_problem',
                    priority: 'high',
                    page: 3
                });
            });

            // Then reset
            act(() => {
                result.current.resetFilters();
            });

            expect(result.current.filters).toEqual({
                page: 1,
                limit: 20,
                sortBy: 'identifiedDate',
                sortOrder: 'desc'
            });
        });

        it('should update single filter property', () => {
            const { result } = renderHook(() => useClinicalInterventionStore());

            act(() => {
                result.current.updateFilters({ category: 'drug_therapy_problem' });
            });

            expect(result.current.filters.category).toBe('drug_therapy_problem');
            expect(result.current.filters.page).toBe(1); // Should remain unchanged
        });
    });

    describe('Pagination Management', () => {
        const mockPagination = {
            page: 2,
            limit: 20,
            total: 100,
            pages: 5,
            hasNext: true,
            hasPrev: true
        };

        it('should set pagination correctly', () => {
            const { result } = renderHook(() => useClinicalInterventionStore());

            act(() => {
                result.current.setPagination(mockPagination);
            });

            expect(result.current.pagination).toEqual(mockPagination);
        });

        it('should handle next page', () => {
            const { result } = renderHook(() => useClinicalInterventionStore());

            act(() => {
                result.current.setPagination(mockPagination);
            });

            act(() => {
                result.current.nextPage();
            });

            expect(result.current.filters.page).toBe(3);
        });

        it('should not go beyond last page', () => {
            const { result } = renderHook(() => useClinicalInterventionStore());

            const lastPagePagination = {
                ...mockPagination,
                page: 5,
                hasNext: false
            };

            act(() => {
                result.current.setPagination(lastPagePagination);
                result.current.updateFilters({ page: 5 });
            });

            act(() => {
                result.current.nextPage();
            });

            expect(result.current.filters.page).toBe(5); // Should remain on last page
        });

        it('should handle previous page', () => {
            const { result } = renderHook(() => useClinicalInterventionStore());

            act(() => {
                result.current.setPagination(mockPagination);
                result.current.updateFilters({ page: 2 });
            });

            act(() => {
                result.current.previousPage();
            });

            expect(result.current.filters.page).toBe(1);
        });

        it('should not go before first page', () => {
            const { result } = renderHook(() => useClinicalInterventionStore());

            const firstPagePagination = {
                ...mockPagination,
                page: 1,
                hasPrev: false
            };

            act(() => {
                result.current.setPagination(firstPagePagination);
                result.current.updateFilters({ page: 1 });
            });

            act(() => {
                result.current.previousPage();
            });

            expect(result.current.filters.page).toBe(1); // Should remain on first page
        });

        it('should go to specific page', () => {
            const { result } = renderHook(() => useClinicalInterventionStore());

            act(() => {
                result.current.setPagination(mockPagination);
            });

            act(() => {
                result.current.goToPage(4);
            });

            expect(result.current.filters.page).toBe(4);
        });

        it('should not go to invalid page numbers', () => {
            const { result } = renderHook(() => useClinicalInterventionStore());

            act(() => {
                result.current.setPagination(mockPagination);
                result.current.updateFilters({ page: 2 });
            });

            // Try to go to page 0
            act(() => {
                result.current.goToPage(0);
            });

            expect(result.current.filters.page).toBe(2); // Should remain unchanged

            // Try to go beyond total pages
            act(() => {
                result.current.goToPage(10);
            });

            expect(result.current.filters.page).toBe(2); // Should remain unchanged
        });
    });

    describe('Metrics Management', () => {
        const mockMetrics = {
            totalInterventions: 25,
            activeInterventions: 8,
            completedInterventions: 15,
            overdueInterventions: 2,
            successRate: 85.5,
            averageResolutionTime: 3.2,
            totalCostSavings: 12500,
            categoryDistribution: [
                { name: 'Drug Therapy Problems', value: 12, color: '#8884d8' }
            ],
            priorityDistribution: [
                { name: 'High', value: 8, color: '#ff8800' }
            ],
            monthlyTrends: [
                { month: 'Dec', total: 25, completed: 20, successRate: 80 }
            ]
        };

        it('should set metrics correctly', () => {
            const { result } = renderHook(() => useClinicalInterventionStore());

            act(() => {
                result.current.setMetrics(mockMetrics);
            });

            expect(result.current.metrics).toEqual(mockMetrics);
        });

        it('should clear metrics', () => {
            const { result } = renderHook(() => useClinicalInterventionStore());

            act(() => {
                result.current.setMetrics(mockMetrics);
            });

            expect(result.current.metrics).toEqual(mockMetrics);

            act(() => {
                result.current.clearMetrics();
            });

            expect(result.current.metrics).toBeNull();
        });
    });

    describe('Sorting', () => {
        it('should update sort field and order', () => {
            const { result } = renderHook(() => useClinicalInterventionStore());

            act(() => {
                result.current.updateSort('priority', 'asc');
            });

            expect(result.current.filters.sortBy).toBe('priority');
            expect(result.current.filters.sortOrder).toBe('asc');
        });

        it('should toggle sort order for same field', () => {
            const { result } = renderHook(() => useClinicalInterventionStore());

            // First click - set to asc
            act(() => {
                result.current.toggleSort('priority');
            });

            expect(result.current.filters.sortBy).toBe('priority');
            expect(result.current.filters.sortOrder).toBe('asc');

            // Second click - toggle to desc
            act(() => {
                result.current.toggleSort('priority');
            });

            expect(result.current.filters.sortBy).toBe('priority');
            expect(result.current.filters.sortOrder).toBe('desc');
        });

        it('should set new field to asc when switching fields', () => {
            const { result } = renderHook(() => useClinicalInterventionStore());

            // Set initial sort
            act(() => {
                result.current.updateSort('priority', 'desc');
            });

            // Switch to different field
            act(() => {
                result.current.toggleSort('category');
            });

            expect(result.current.filters.sortBy).toBe('category');
            expect(result.current.filters.sortOrder).toBe('asc');
        });
    });

    describe('Search', () => {
        it('should update search term', () => {
            const { result } = renderHook(() => useClinicalInterventionStore());

            act(() => {
                result.current.updateSearch('side effects');
            });

            expect(result.current.filters.search).toBe('side effects');
            expect(result.current.filters.page).toBe(1); // Should reset to first page
        });

        it('should clear search term', () => {
            const { result } = renderHook(() => useClinicalInterventionStore());

            act(() => {
                result.current.updateSearch('side effects');
            });

            expect(result.current.filters.search).toBe('side effects');

            act(() => {
                result.current.clearSearch();
            });

            expect(result.current.filters.search).toBeUndefined();
        });
    });

    describe('Store Reset', () => {
        it('should reset entire store to initial state', () => {
            const { result } = renderHook(() => useClinicalInterventionStore());

            // Set some state
            act(() => {
                result.current.setInterventions([
                    {
                        _id: 'intervention-1',
                        interventionNumber: 'CI-202412-0001',
                        category: 'drug_therapy_problem',
                        priority: 'high',
                        status: 'in_progress',
                        issueDescription: 'Test',
                        patientId: 'patient-1',
                        identifiedBy: 'user-1',
                        identifiedDate: '2024-12-01T10:00:00Z'
                    }
                ]);
                result.current.setError('Test error');
                result.current.setLoading(true);
                result.current.updateFilters({ category: 'drug_therapy_problem', page: 3 });
            });

            // Reset store
            act(() => {
                result.current.reset();
            });

            // Check that everything is back to initial state
            expect(result.current.interventions).toEqual([]);
            expect(result.current.currentIntervention).toBeNull();
            expect(result.current.metrics).toBeNull();
            expect(result.current.error).toBeNull();
            expect(result.current.loading).toBe(false);
            expect(result.current.filters).toEqual({
                page: 1,
                limit: 20,
                sortBy: 'identifiedDate',
                sortOrder: 'desc'
            });
            expect(result.current.pagination).toBeNull();
        });
    });

    describe('Computed Properties', () => {
        it('should calculate hasInterventions correctly', () => {
            const { result } = renderHook(() => useClinicalInterventionStore());

            // Initially should be false
            expect(result.current.hasInterventions).toBe(false);

            // After adding interventions should be true
            act(() => {
                result.current.setInterventions([
                    {
                        _id: 'intervention-1',
                        interventionNumber: 'CI-202412-0001',
                        category: 'drug_therapy_problem',
                        priority: 'high',
                        status: 'in_progress',
                        issueDescription: 'Test',
                        patientId: 'patient-1',
                        identifiedBy: 'user-1',
                        identifiedDate: '2024-12-01T10:00:00Z'
                    }
                ]);
            });

            expect(result.current.hasInterventions).toBe(true);
        });

        it('should calculate isFirstPage correctly', () => {
            const { result } = renderHook(() => useClinicalInterventionStore());

            // Initially should be true (page 1)
            expect(result.current.isFirstPage).toBe(true);

            // After going to page 2 should be false
            act(() => {
                result.current.updateFilters({ page: 2 });
            });

            expect(result.current.isFirstPage).toBe(false);
        });

        it('should calculate isLastPage correctly', () => {
            const { result } = renderHook(() => useClinicalInterventionStore());

            // Set pagination
            act(() => {
                result.current.setPagination({
                    page: 2,
                    limit: 20,
                    total: 40,
                    pages: 2,
                    hasNext: false,
                    hasPrev: true
                });
                result.current.updateFilters({ page: 2 });
            });

            expect(result.current.isLastPage).toBe(true);

            // Go to first page
            act(() => {
                result.current.updateFilters({ page: 1 });
            });

            expect(result.current.isLastPage).toBe(false);
        });
    });

    describe('State Persistence', () => {
        it('should maintain state consistency across multiple operations', () => {
            const { result } = renderHook(() => useClinicalInterventionStore());

            const mockInterventions = [
                {
                    _id: 'intervention-1',
                    interventionNumber: 'CI-202412-0001',
                    category: 'drug_therapy_problem',
                    priority: 'high',
                    status: 'in_progress',
                    issueDescription: 'Test 1',
                    patientId: 'patient-1',
                    identifiedBy: 'user-1',
                    identifiedDate: '2024-12-01T10:00:00Z'
                },
                {
                    _id: 'intervention-2',
                    interventionNumber: 'CI-202412-0002',
                    category: 'adverse_drug_reaction',
                    priority: 'critical',
                    status: 'completed',
                    issueDescription: 'Test 2',
                    patientId: 'patient-2',
                    identifiedBy: 'user-1',
                    identifiedDate: '2024-12-02T14:30:00Z'
                }
            ];

            // Perform multiple operations
            act(() => {
                result.current.setInterventions(mockInterventions);
                result.current.updateFilters({ category: 'drug_therapy_problem', page: 2 });
                result.current.setCurrentIntervention(mockInterventions[0]);
                result.current.setPagination({
                    page: 2,
                    limit: 20,
                    total: 50,
                    pages: 3,
                    hasNext: true,
                    hasPrev: true
                });
            });

            // Verify all state is maintained correctly
            expect(result.current.interventions).toHaveLength(2);
            expect(result.current.filters.category).toBe('drug_therapy_problem');
            expect(result.current.filters.page).toBe(2);
            expect(result.current.currentIntervention?._id).toBe('intervention-1');
            expect(result.current.pagination?.total).toBe(50);
        });
    });
});