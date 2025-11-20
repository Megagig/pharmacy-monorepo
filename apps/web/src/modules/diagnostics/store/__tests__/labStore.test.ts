import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useLabStore } from '../labStore';
import { labApi } from '../../api/labApi';
import type { LabOrder, LabResult, LabOrderForm, LabResultForm } from '../../types';

// Mock the API
vi.mock('../../api/labApi', () => ({
    labApi: {
        createOrder: vi.fn(),
        getOrders: vi.fn(),
        updateOrderStatus: vi.fn(),
        cancelOrder: vi.fn(),
        addResult: vi.fn(),
        getResults: vi.fn(),
        updateResult: vi.fn(),
        deleteResult: vi.fn(),
        getTrends: vi.fn(),
        getCriticalResults: vi.fn(),
        getAbnormalResults: vi.fn(),
        getTestCatalog: vi.fn(),
        importFHIR: vi.fn(),
        exportOrder: vi.fn(),
    },
}));

const mockLabOrder: LabOrder = {
    _id: 'order-1',
    patientId: 'patient-1',
    orderedBy: 'pharmacist-1',
    workplaceId: 'workplace-1',
    tests: [
        {
            code: 'CBC',
            name: 'Complete Blood Count',
            indication: 'Routine screening',
            priority: 'routine',
        },
    ],
    status: 'ordered',
    orderDate: '2024-01-01T10:00:00Z',
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-01T10:00:00Z',
};

const mockLabResult: LabResult = {
    _id: 'result-1',
    orderId: 'order-1',
    patientId: 'patient-1',
    workplaceId: 'workplace-1',
    testCode: 'WBC',
    testName: 'White Blood Cell Count',
    value: '7.5',
    unit: 'K/uL',
    referenceRange: {
        low: 4.0,
        high: 11.0,
    },
    interpretation: 'normal',
    flags: [],
    source: 'manual',
    performedAt: '2024-01-01T12:00:00Z',
    recordedAt: '2024-01-01T12:30:00Z',
    recordedBy: 'tech-1',
    createdAt: '2024-01-01T12:30:00Z',
    updatedAt: '2024-01-01T12:30:00Z',
};

const mockOrderForm: LabOrderForm = {
    patientId: 'patient-1',
    tests: [
        {
            code: 'CBC',
            name: 'Complete Blood Count',
            indication: 'Routine screening',
            priority: 'routine',
        },
    ],
};

const mockResultForm: LabResultForm = {
    patientId: 'patient-1',
    orderId: 'order-1',
    testCode: 'WBC',
    testName: 'White Blood Cell Count',
    value: '7.5',
    unit: 'K/uL',
    referenceRange: {
        low: 4.0,
        high: 11.0,
    },
    performedAt: '2024-01-01T12:00:00Z',
};

describe('LabStore', () => {
    beforeEach(() => {
        // Reset store state
        useLabStore.setState({
            orders: [],
            results: [],
            selectedOrder: null,
            selectedResult: null,
            filters: {
                orders: {
                    search: '',
                    patientId: '',
                    status: undefined,
                    dateFrom: '',
                    dateTo: '',
                    page: 1,
                    limit: 20,
                    sortBy: 'orderDate',
                    sortOrder: 'desc',
                },
                results: {
                    search: '',
                    patientId: '',
                    testCode: '',
                    interpretation: undefined,
                    dateFrom: '',
                    dateTo: '',
                    page: 1,
                    limit: 20,
                    sortBy: 'performedAt',
                    sortOrder: 'desc',
                },
            },
            pagination: {
                orders: {
                    page: 1,
                    limit: 20,
                    total: 0,
                    pages: 0,
                    hasNext: false,
                    hasPrev: false,
                },
                results: {
                    page: 1,
                    limit: 20,
                    total: 0,
                    pages: 0,
                    hasNext: false,
                    hasPrev: false,
                },
            },
            trends: {},
            testCatalog: [],
            criticalResults: [],
            abnormalResults: [],
            loading: {
                createOrder: false,
                fetchOrders: false,
                addResult: false,
                fetchResults: false,
                updateOrder: false,
                updateResult: false,
                fetchTrends: false,
                fetchCatalog: false,
                fetchCritical: false,
                fetchAbnormal: false,
                fhirImport: false,
                fhirExport: false,
            },
            errors: {
                createOrder: null,
                fetchOrders: null,
                addResult: null,
                fetchResults: null,
                updateOrder: null,
                updateResult: null,
                fetchTrends: null,
                fetchCatalog: null,
                fetchCritical: null,
                fetchAbnormal: null,
                fhirImport: null,
                fhirExport: null,
            },
        });

        // Clear all mocks
        vi.clearAllMocks();
    });

    describe('createOrder', () => {
        it('should create a lab order successfully', async () => {
            const mockResponse = {
                success: true,
                data: mockLabOrder,
            };

            vi.mocked(labApi.createOrder).mockResolvedValue(mockResponse);

            const { createOrder } = useLabStore.getState();
            const result = await createOrder(mockOrderForm);

            expect(labApi.createOrder).toHaveBeenCalledWith(mockOrderForm);
            expect(result).toEqual(mockLabOrder);

            const state = useLabStore.getState();
            expect(state.orders).toContain(mockLabOrder);
            expect(state.selectedOrder).toEqual(mockLabOrder);
            expect(state.loading.createOrder).toBe(false);
            expect(state.errors.createOrder).toBeNull();
        });

        it('should handle create order error', async () => {
            const mockResponse = {
                success: false,
                message: 'Failed to create order',
            };

            vi.mocked(labApi.createOrder).mockResolvedValue(mockResponse);

            const { createOrder } = useLabStore.getState();
            const result = await createOrder(mockOrderForm);

            expect(result).toBeNull();

            const state = useLabStore.getState();
            expect(state.orders).toHaveLength(0);
            expect(state.errors.createOrder).toBe('Failed to create order');
        });
    });

    describe('fetchOrders', () => {
        it('should fetch lab orders successfully', async () => {
            const mockResponse = {
                success: true,
                data: {
                    results: [mockLabOrder],
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

            vi.mocked(labApi.getOrders).mockResolvedValue(mockResponse);

            const { fetchOrders } = useLabStore.getState();
            await fetchOrders();

            expect(labApi.getOrders).toHaveBeenCalled();

            const state = useLabStore.getState();
            expect(state.orders).toEqual([mockLabOrder]);
            expect(state.pagination.orders.total).toBe(1);
            expect(state.loading.fetchOrders).toBe(false);
            expect(state.errors.fetchOrders).toBeNull();
        });
    });

    describe('addResult', () => {
        it('should add lab result successfully', async () => {
            const mockResponse = {
                success: true,
                data: mockLabResult,
            };

            vi.mocked(labApi.addResult).mockResolvedValue(mockResponse);

            const { addResult } = useLabStore.getState();
            const result = await addResult(mockResultForm);

            expect(labApi.addResult).toHaveBeenCalledWith(mockResultForm);
            expect(result).toEqual(mockLabResult);

            const state = useLabStore.getState();
            expect(state.results).toContain(mockLabResult);
            expect(state.selectedResult).toEqual(mockLabResult);
        });
    });

    describe('updateOrderStatus', () => {
        it('should update order status successfully', async () => {
            const updatedOrder = {
                ...mockLabOrder,
                status: 'completed' as const,
            };

            const mockResponse = {
                success: true,
                data: updatedOrder,
            };

            vi.mocked(labApi.updateOrderStatus).mockResolvedValue(mockResponse);

            // Add order to state first
            useLabStore.setState({
                orders: [mockLabOrder],
            });

            const { updateOrderStatus } = useLabStore.getState();
            const success = await updateOrderStatus('order-1', 'completed');

            expect(labApi.updateOrderStatus).toHaveBeenCalledWith('order-1', 'completed');
            expect(success).toBe(true);

            const state = useLabStore.getState();
            const order = state.orders.find(o => o._id === 'order-1');
            expect(order?.status).toBe('completed');
        });
    });

    describe('fetchTrends', () => {
        it('should fetch lab trends successfully', async () => {
            const mockTrendData = {
                testCode: 'WBC',
                testName: 'White Blood Cell Count',
                unit: 'K/uL',
                referenceRange: {
                    low: 4.0,
                    high: 11.0,
                },
                results: [
                    {
                        value: '7.5',
                        numericValue: 7.5,
                        interpretation: 'normal',
                        performedAt: '2024-01-01T12:00:00Z',
                        flags: [],
                    },
                ],
                trend: 'stable' as const,
                summary: {
                    latestValue: '7.5',
                    latestInterpretation: 'normal',
                    abnormalCount: 0,
                    totalCount: 1,
                },
            };

            const mockResponse = {
                success: true,
                data: mockTrendData,
            };

            vi.mocked(labApi.getTrends).mockResolvedValue(mockResponse);

            const { fetchTrends } = useLabStore.getState();
            await fetchTrends('patient-1', 'WBC', 90);

            expect(labApi.getTrends).toHaveBeenCalledWith('patient-1', 'WBC', 90);

            const state = useLabStore.getState();
            expect(state.trends['patient-1-WBC']).toEqual(mockTrendData);
        });
    });

    describe('fetchCriticalResults', () => {
        it('should fetch critical results successfully', async () => {
            const criticalResult = {
                ...mockLabResult,
                interpretation: 'critical' as const,
                value: '25.0',
            };

            const mockResponse = {
                success: true,
                data: [criticalResult],
            };

            vi.mocked(labApi.getCriticalResults).mockResolvedValue(mockResponse);

            const { fetchCriticalResults } = useLabStore.getState();
            await fetchCriticalResults('workplace-1');

            expect(labApi.getCriticalResults).toHaveBeenCalledWith('workplace-1');

            const state = useLabStore.getState();
            expect(state.criticalResults).toEqual([criticalResult]);
        });
    });

    describe('fetchTestCatalog', () => {
        it('should fetch test catalog successfully', async () => {
            const mockCatalog = [
                {
                    code: 'CBC',
                    name: 'Complete Blood Count',
                    category: 'Hematology',
                    loincCode: '58410-2',
                },
                {
                    code: 'BMP',
                    name: 'Basic Metabolic Panel',
                    category: 'Chemistry',
                    loincCode: '51990-0',
                },
            ];

            const mockResponse = {
                success: true,
                data: mockCatalog,
            };

            vi.mocked(labApi.getTestCatalog).mockResolvedValue(mockResponse);

            const { fetchTestCatalog } = useLabStore.getState();
            await fetchTestCatalog();

            expect(labApi.getTestCatalog).toHaveBeenCalled();

            const state = useLabStore.getState();
            expect(state.testCatalog).toEqual(mockCatalog);
        });
    });

    describe('searchTestCatalog', () => {
        beforeEach(() => {
            const mockCatalog = [
                {
                    code: 'CBC',
                    name: 'Complete Blood Count',
                    category: 'Hematology',
                    loincCode: '58410-2',
                },
                {
                    code: 'BMP',
                    name: 'Basic Metabolic Panel',
                    category: 'Chemistry',
                    loincCode: '51990-0',
                },
            ];

            useLabStore.setState({ testCatalog: mockCatalog });
        });

        it('should search test catalog by name', () => {
            const { searchTestCatalog } = useLabStore.getState();
            const results = searchTestCatalog('blood');

            expect(results).toHaveLength(1);
            expect(results[0].name).toBe('Complete Blood Count');
        });

        it('should search test catalog by code', () => {
            const { searchTestCatalog } = useLabStore.getState();
            const results = searchTestCatalog('BMP');

            expect(results).toHaveLength(1);
            expect(results[0].code).toBe('BMP');
        });

        it('should return all tests when search is empty', () => {
            const { searchTestCatalog } = useLabStore.getState();
            const results = searchTestCatalog('');

            expect(results).toHaveLength(2);
        });
    });

    describe('filters', () => {
        it('should set and clear order filters', () => {
            const { setOrderFilters, clearOrderFilters } = useLabStore.getState();

            setOrderFilters({ search: 'test', patientId: 'patient-1' });

            let state = useLabStore.getState();
            expect(state.filters.orders.search).toBe('test');
            expect(state.filters.orders.patientId).toBe('patient-1');

            clearOrderFilters();

            state = useLabStore.getState();
            expect(state.filters.orders.search).toBe('');
            expect(state.filters.orders.patientId).toBe('');
        });

        it('should set and clear result filters', () => {
            const { setResultFilters, clearResultFilters } = useLabStore.getState();

            setResultFilters({ search: 'test', testCode: 'WBC' });

            let state = useLabStore.getState();
            expect(state.filters.results.search).toBe('test');
            expect(state.filters.results.testCode).toBe('WBC');

            clearResultFilters();

            state = useLabStore.getState();
            expect(state.filters.results.search).toBe('');
            expect(state.filters.results.testCode).toBe('');
        });
    });

    describe('selectors', () => {
        beforeEach(() => {
            // Set up test data
            useLabStore.setState({
                orders: [
                    mockLabOrder,
                    {
                        ...mockLabOrder,
                        _id: 'order-2',
                        status: 'completed',
                        patientId: 'patient-2',
                    },
                ],
                results: [
                    mockLabResult,
                    {
                        ...mockLabResult,
                        _id: 'result-2',
                        orderId: 'order-2',
                        patientId: 'patient-2',
                        interpretation: 'critical',
                    },
                ],
                criticalResults: [
                    {
                        ...mockLabResult,
                        _id: 'result-2',
                        interpretation: 'critical',
                        patientId: 'patient-1',
                    },
                ],
            });
        });

        it('should get orders by patient', () => {
            const { getOrdersByPatient } = useLabStore.getState();
            const patientOrders = getOrdersByPatient('patient-1');

            expect(patientOrders).toHaveLength(1);
            expect(patientOrders[0]._id).toBe('order-1');
        });

        it('should get results by patient', () => {
            const { getResultsByPatient } = useLabStore.getState();
            const patientResults = getResultsByPatient('patient-1');

            expect(patientResults).toHaveLength(1);
            expect(patientResults[0]._id).toBe('result-1');
        });

        it('should get results by order', () => {
            const { getResultsByOrder } = useLabStore.getState();
            const orderResults = getResultsByOrder('order-1');

            expect(orderResults).toHaveLength(1);
            expect(orderResults[0]._id).toBe('result-1');
        });

        it('should get pending orders', () => {
            const { getPendingOrders } = useLabStore.getState();
            const pendingOrders = getPendingOrders();

            expect(pendingOrders).toHaveLength(1);
            expect(pendingOrders[0].status).toBe('ordered');
        });

        it('should get completed orders', () => {
            const { getCompletedOrders } = useLabStore.getState();
            const completedOrders = getCompletedOrders();

            expect(completedOrders).toHaveLength(1);
            expect(completedOrders[0].status).toBe('completed');
        });

        it('should get critical results by patient', () => {
            const { getCriticalResultsByPatient } = useLabStore.getState();
            const criticalResults = getCriticalResultsByPatient('patient-1');

            expect(criticalResults).toHaveLength(1);
            expect(criticalResults[0].interpretation).toBe('critical');
        });

        it('should get result interpretation summary', () => {
            const { getResultInterpretationSummary } = useLabStore.getState();
            const summary = getResultInterpretationSummary('patient-1');

            expect(summary.normal).toBe(1);
            expect(summary.abnormal).toBe(0);
            expect(summary.critical).toBe(0);
            expect(summary.total).toBe(1);
        });
    });

    describe('optimistic updates', () => {
        it('should add order to state', () => {
            const { addOrderToState } = useLabStore.getState();

            addOrderToState(mockLabOrder);

            const state = useLabStore.getState();
            expect(state.orders).toContain(mockLabOrder);
            expect(state.pagination.orders.total).toBe(1);
        });

        it('should update order in state', () => {
            const { addOrderToState, updateOrderInState } = useLabStore.getState();

            addOrderToState(mockLabOrder);
            updateOrderInState('order-1', { status: 'completed' });

            const state = useLabStore.getState();
            const updatedOrder = state.orders.find(o => o._id === 'order-1');
            expect(updatedOrder?.status).toBe('completed');
        });

        it('should remove order from state', () => {
            const { addOrderToState, removeOrderFromState } = useLabStore.getState();

            addOrderToState(mockLabOrder);
            removeOrderFromState('order-1');

            const state = useLabStore.getState();
            expect(state.orders).toHaveLength(0);
            expect(state.pagination.orders.total).toBe(0);
        });
    });

    describe('FHIR integration', () => {
        it('should import FHIR data successfully', async () => {
            const mockResponse = {
                success: true,
                data: [mockLabResult],
            };

            vi.mocked(labApi.importFHIR).mockResolvedValue(mockResponse);

            const fhirData = {
                fhirBundle: { resourceType: 'Bundle' },
                patientMapping: {
                    fhirPatientId: 'fhir-patient-1',
                    internalPatientId: 'patient-1',
                },
            };

            const { importFHIR } = useLabStore.getState();
            const success = await importFHIR(fhirData);

            expect(labApi.importFHIR).toHaveBeenCalledWith(fhirData);
            expect(success).toBe(true);

            const state = useLabStore.getState();
            expect(state.results).toContain(mockLabResult);
        });

        it('should export order successfully', async () => {
            const mockResponse = {
                success: true,
                data: {
                    fhirResource: { resourceType: 'ServiceRequest' },
                    exportedAt: '2024-01-01T15:00:00Z',
                },
            };

            vi.mocked(labApi.exportOrder).mockResolvedValue(mockResponse);

            const { exportOrder } = useLabStore.getState();
            const success = await exportOrder('order-1');

            expect(labApi.exportOrder).toHaveBeenCalledWith('order-1');
            expect(success).toBe(true);
        });
    });

    describe('error handling', () => {
        it('should handle network errors', async () => {
            const networkError = new Error('Network error');
            vi.mocked(labApi.createOrder).mockRejectedValue(networkError);

            const { createOrder } = useLabStore.getState();
            const result = await createOrder(mockOrderForm);

            expect(result).toBeNull();

            const state = useLabStore.getState();
            expect(state.errors.createOrder).toBe('Network error');
        });

        it('should clear errors', () => {
            // Set some errors
            useLabStore.setState({
                errors: {
                    createOrder: 'Some error',
                    fetchOrders: 'Another error',
                    addResult: null,
                    fetchResults: null,
                    updateOrder: null,
                    updateResult: null,
                    fetchTrends: null,
                    fetchCatalog: null,
                    fetchCritical: null,
                    fetchAbnormal: null,
                    fhirImport: null,
                    fhirExport: null,
                },
            });

            const { clearErrors } = useLabStore.getState();
            clearErrors();

            const state = useLabStore.getState();
            expect(Object.values(state.errors)).toEqual(Array(12).fill(null));
        });
    });
});