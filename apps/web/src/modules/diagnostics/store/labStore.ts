import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { labApi } from '../api/labApi';
import type {
    LabOrder,
    LabResult,
    LabOrderForm,
    LabResultForm,
    LabStore,
    LabFilters,
    LabTrendData,
    LabTestCatalogItem,
    LabOrderStatus,
    LabResultInterpretation
} from '../types';

export const useLabStore = create<LabStore>()(
    persist(
        (set, get) => ({
            // Initial state
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

            // CRUD Actions
            createOrder: async (data: LabOrderForm) => {
                const { setLoading, setError, addOrderToState } = get();
                setLoading('createOrder', true);
                setError('createOrder', null);

                try {
                    const response = await labApi.createOrder(data);

                    if (response.success && response.data) {
                        addOrderToState(response.data);
                        set({ selectedOrder: response.data });
                        return response.data;
                    } else {
                        setError('createOrder', response.message || 'Failed to create order');
                        return null;
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
                    setError('createOrder', errorMessage);
                    return null;
                } finally {
                    setLoading('createOrder', false);
                }
            },

            fetchOrders: async (filters) => {
                const { setLoading, setError } = get();
                setLoading('fetchOrders', true);
                setError('fetchOrders', null);

                try {
                    const currentFilters = filters || get().filters.orders;
                    const response = await labApi.getOrders(currentFilters);

                    if (response.success && response.data) {
                        set({
                            orders: response.data.results || [],
                            pagination: {
                                ...get().pagination,
                                orders: response.meta || {
                                    page: currentFilters.page || 1,
                                    limit: currentFilters.limit || 20,
                                    total: 0,
                                    pages: 0,
                                    hasNext: false,
                                    hasPrev: false,
                                },
                            },
                        });
                    } else {
                        setError('fetchOrders', response.message || 'Failed to fetch orders');
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
                    setError('fetchOrders', errorMessage);
                } finally {
                    setLoading('fetchOrders', false);
                }
            },

            updateOrderStatus: async (orderId: string, status: LabOrderStatus) => {
                const { setLoading, setError, updateOrderInState } = get();
                setLoading('updateOrder', true);
                setError('updateOrder', null);

                try {
                    const response = await labApi.updateOrderStatus(orderId, status);

                    if (response.success && response.data) {
                        updateOrderInState(orderId, response.data);
                        return true;
                    } else {
                        setError('updateOrder', response.message || 'Failed to update order status');
                        return false;
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
                    setError('updateOrder', errorMessage);
                    return false;
                } finally {
                    setLoading('updateOrder', false);
                }
            },

            cancelOrder: async (orderId: string) => {
                const { setLoading, setError, updateOrderInState } = get();
                setLoading('updateOrder', true);
                setError('updateOrder', null);

                try {
                    const response = await labApi.cancelOrder(orderId);

                    if (response.success && response.data) {
                        updateOrderInState(orderId, response.data);
                        return true;
                    } else {
                        setError('updateOrder', response.message || 'Failed to cancel order');
                        return false;
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
                    setError('updateOrder', errorMessage);
                    return false;
                } finally {
                    setLoading('updateOrder', false);
                }
            },

            addResult: async (data: LabResultForm) => {
                const { setLoading, setError, addResultToState } = get();
                setLoading('addResult', true);
                setError('addResult', null);

                try {
                    const response = await labApi.addResult(data);

                    if (response.success && response.data) {
                        addResultToState(response.data);
                        set({ selectedResult: response.data });
                        return response.data;
                    } else {
                        setError('addResult', response.message || 'Failed to add result');
                        return null;
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
                    setError('addResult', errorMessage);
                    return null;
                } finally {
                    setLoading('addResult', false);
                }
            },

            fetchResults: async (filters) => {
                const { setLoading, setError } = get();
                setLoading('fetchResults', true);
                setError('fetchResults', null);

                try {
                    const currentFilters = filters || get().filters.results;
                    const response = await labApi.getResults(currentFilters);

                    if (response.success && response.data) {
                        set({
                            results: response.data.results || [],
                            pagination: {
                                ...get().pagination,
                                results: response.meta || {
                                    page: currentFilters.page || 1,
                                    limit: currentFilters.limit || 20,
                                    total: 0,
                                    pages: 0,
                                    hasNext: false,
                                    hasPrev: false,
                                },
                            },
                        });
                    } else {
                        setError('fetchResults', response.message || 'Failed to fetch results');
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
                    setError('fetchResults', errorMessage);
                } finally {
                    setLoading('fetchResults', false);
                }
            },

            updateResult: async (resultId: string, data: Partial<LabResultForm>) => {
                const { setLoading, setError, updateResultInState } = get();
                setLoading('updateResult', true);
                setError('updateResult', null);

                try {
                    const response = await labApi.updateResult(resultId, data);

                    if (response.success && response.data) {
                        updateResultInState(resultId, response.data);
                        return true;
                    } else {
                        setError('updateResult', response.message || 'Failed to update result');
                        return false;
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
                    setError('updateResult', errorMessage);
                    return false;
                } finally {
                    setLoading('updateResult', false);
                }
            },

            deleteResult: async (resultId: string) => {
                const { setLoading, setError, removeResultFromState } = get();
                setLoading('updateResult', true);
                setError('updateResult', null);

                try {
                    const response = await labApi.deleteResult(resultId);

                    if (response.success) {
                        removeResultFromState(resultId);
                        return true;
                    } else {
                        setError('updateResult', response.message || 'Failed to delete result');
                        return false;
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
                    setError('updateResult', errorMessage);
                    return false;
                } finally {
                    setLoading('updateResult', false);
                }
            },

            // Trend Analysis
            fetchTrends: async (patientId: string, testCode: string, days = 90) => {
                const { setLoading, setError } = get();
                setLoading('fetchTrends', true);
                setError('fetchTrends', null);

                try {
                    const response = await labApi.getTrends(patientId, testCode, days);

                    if (response.success && response.data) {
                        const trendKey = `${patientId}-${testCode}`;
                        set((state) => ({
                            trends: {
                                ...state.trends,
                                [trendKey]: response.data!,
                            },
                        }));
                    } else {
                        setError('fetchTrends', response.message || 'Failed to fetch trends');
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
                    setError('fetchTrends', errorMessage);
                } finally {
                    setLoading('fetchTrends', false);
                }
            },

            getTrendData: (patientId: string, testCode: string) => {
                const trendKey = `${patientId}-${testCode}`;
                return get().trends[trendKey] || null;
            },

            // Critical and Abnormal Results
            fetchCriticalResults: async (workplaceId) => {
                const { setLoading, setError } = get();
                setLoading('fetchCritical', true);
                setError('fetchCritical', null);

                try {
                    const response = await labApi.getCriticalResults(workplaceId);

                    if (response.success && response.data) {
                        set({ criticalResults: response.data });
                    } else {
                        setError('fetchCritical', response.message || 'Failed to fetch critical results');
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
                    setError('fetchCritical', errorMessage);
                } finally {
                    setLoading('fetchCritical', false);
                }
            },

            fetchAbnormalResults: async (patientId: string, days = 30) => {
                const { setLoading, setError } = get();
                setLoading('fetchAbnormal', true);
                setError('fetchAbnormal', null);

                try {
                    const response = await labApi.getAbnormalResults(patientId, days);

                    if (response.success && response.data) {
                        set({ abnormalResults: response.data });
                    } else {
                        setError('fetchAbnormal', response.message || 'Failed to fetch abnormal results');
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
                    setError('fetchAbnormal', errorMessage);
                } finally {
                    setLoading('fetchAbnormal', false);
                }
            },

            // Test Catalog
            fetchTestCatalog: async (search) => {
                const { setLoading, setError } = get();
                setLoading('fetchCatalog', true);
                setError('fetchCatalog', null);

                try {
                    const response = await labApi.getTestCatalog(search);

                    if (response.success && response.data) {
                        set({ testCatalog: response.data });
                    } else {
                        setError('fetchCatalog', response.message || 'Failed to fetch test catalog');
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
                    setError('fetchCatalog', errorMessage);
                } finally {
                    setLoading('fetchCatalog', false);
                }
            },

            searchTestCatalog: (search: string) => {
                const { testCatalog } = get();
                if (!search) return testCatalog;

                const searchLower = search.toLowerCase();
                return testCatalog.filter(
                    (test) =>
                        test.name.toLowerCase().includes(searchLower) ||
                        test.code.toLowerCase().includes(searchLower) ||
                        test.category.toLowerCase().includes(searchLower)
                );
            },

            // FHIR Integration
            importFHIR: async (data) => {
                const { setLoading, setError } = get();
                setLoading('fhirImport', true);
                setError('fhirImport', null);

                try {
                    const response = await labApi.importFHIR(data);

                    if (response.success && response.data) {
                        // Add imported results to state
                        response.data.forEach((result) => {
                            get().addResultToState(result);
                        });
                        return true;
                    } else {
                        setError('fhirImport', response.message || 'Failed to import FHIR data');
                        return false;
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
                    setError('fhirImport', errorMessage);
                    return false;
                } finally {
                    setLoading('fhirImport', false);
                }
            },

            exportOrder: async (orderId: string) => {
                const { setLoading, setError } = get();
                setLoading('fhirExport', true);
                setError('fhirExport', null);

                try {
                    const response = await labApi.exportOrder(orderId);

                    if (response.success) {
                        return true;
                    } else {
                        setError('fhirExport', response.message || 'Failed to export order');
                        return false;
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
                    setError('fhirExport', errorMessage);
                    return false;
                } finally {
                    setLoading('fhirExport', false);
                }
            },

            // Filter and Search Actions
            setOrderFilters: (newFilters) => {
                set((state) => ({
                    filters: {
                        ...state.filters,
                        orders: { ...state.filters.orders, ...newFilters },
                    },
                }));
            },

            setResultFilters: (newFilters) => {
                set((state) => ({
                    filters: {
                        ...state.filters,
                        results: { ...state.filters.results, ...newFilters },
                    },
                }));
            },

            clearOrderFilters: () => {
                set((state) => ({
                    filters: {
                        ...state.filters,
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
                    },
                }));
            },

            clearResultFilters: () => {
                set((state) => ({
                    filters: {
                        ...state.filters,
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
                }));
            },

            searchOrders: (searchTerm: string) => {
                const { setOrderFilters, fetchOrders } = get();
                setOrderFilters({ search: searchTerm, page: 1 });
                fetchOrders();
            },

            searchResults: (searchTerm: string) => {
                const { setResultFilters, fetchResults } = get();
                setResultFilters({ search: searchTerm, page: 1 });
                fetchResults();
            },

            filterOrdersByPatient: (patientId: string) => {
                const { setOrderFilters, fetchOrders } = get();
                setOrderFilters({ patientId, page: 1 });
                fetchOrders();
            },

            filterResultsByPatient: (patientId: string) => {
                const { setResultFilters, fetchResults } = get();
                setResultFilters({ patientId, page: 1 });
                fetchResults();
            },

            filterOrdersByStatus: (status: LabOrderStatus) => {
                const { setOrderFilters, fetchOrders } = get();
                setOrderFilters({ status, page: 1 });
                fetchOrders();
            },

            filterResultsByInterpretation: (interpretation: LabResultInterpretation) => {
                const { setResultFilters, fetchResults } = get();
                setResultFilters({ interpretation, page: 1 });
                fetchResults();
            },

            // Pagination Actions
            setOrderPage: (page: number) => {
                const { setOrderFilters, fetchOrders } = get();
                setOrderFilters({ page });
                fetchOrders();
            },

            setOrderLimit: (limit: number) => {
                const { setOrderFilters, fetchOrders } = get();
                setOrderFilters({ limit, page: 1 });
                fetchOrders();
            },

            setResultPage: (page: number) => {
                const { setResultFilters, fetchResults } = get();
                setResultFilters({ page });
                fetchResults();
            },

            setResultLimit: (limit: number) => {
                const { setResultFilters, fetchResults } = get();
                setResultFilters({ limit, page: 1 });
                fetchResults();
            },

            // Selection Actions
            selectOrder: (order: LabOrder | null) => {
                set({ selectedOrder: order });
            },

            selectResult: (result: LabResult | null) => {
                set({ selectedResult: result });
            },

            // Optimistic Updates
            addOrderToState: (order: LabOrder) => {
                set((state) => ({
                    orders: [order, ...state.orders],
                    pagination: {
                        ...state.pagination,
                        orders: {
                            ...state.pagination.orders,
                            total: state.pagination.orders.total + 1,
                        },
                    },
                }));
            },

            updateOrderInState: (id: string, updates: Partial<LabOrder>) => {
                set((state) => ({
                    orders: state.orders.map((o) =>
                        o._id === id ? { ...o, ...updates } : o
                    ),
                }));
            },

            removeOrderFromState: (id: string) => {
                set((state) => ({
                    orders: state.orders.filter((o) => o._id !== id),
                    pagination: {
                        ...state.pagination,
                        orders: {
                            ...state.pagination.orders,
                            total: Math.max(0, state.pagination.orders.total - 1),
                        },
                    },
                }));
            },

            addResultToState: (result: LabResult) => {
                set((state) => ({
                    results: [result, ...state.results],
                    pagination: {
                        ...state.pagination,
                        results: {
                            ...state.pagination.results,
                            total: state.pagination.results.total + 1,
                        },
                    },
                }));
            },

            updateResultInState: (id: string, updates: Partial<LabResult>) => {
                set((state) => ({
                    results: state.results.map((r) =>
                        r._id === id ? { ...r, ...updates } : r
                    ),
                }));
            },

            removeResultFromState: (id: string) => {
                set((state) => ({
                    results: state.results.filter((r) => r._id !== id),
                    pagination: {
                        ...state.pagination,
                        results: {
                            ...state.pagination.results,
                            total: Math.max(0, state.pagination.results.total - 1),
                        },
                    },
                }));
            },

            // Utility Actions
            clearErrors: () => {
                set({
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
                    }
                });
            },

            setLoading: (key: string, loading: boolean) => {
                set((state) => ({
                    loading: { ...state.loading, [key]: loading },
                }));
            },

            setError: (key: string, error: string | null) => {
                set((state) => ({
                    errors: { ...state.errors, [key]: error },
                }));
            },

            // Computed Values/Selectors
            getOrdersByPatient: (patientId: string) => {
                return get().orders.filter(o => o.patientId === patientId);
            },

            getResultsByPatient: (patientId: string) => {
                return get().results.filter(r => r.patientId === patientId);
            },

            getResultsByOrder: (orderId: string) => {
                return get().results.filter(r => r.orderId === orderId);
            },

            getPendingOrders: () => {
                return get().orders.filter(o => o.status === 'ordered' || o.status === 'collected');
            },

            getCompletedOrders: () => {
                return get().orders.filter(o => o.status === 'completed');
            },

            getCriticalResultsByPatient: (patientId: string) => {
                return get().criticalResults.filter(r => r.patientId === patientId);
            },

            getAbnormalResultsByPatient: (patientId: string) => {
                return get().abnormalResults.filter(r => r.patientId === patientId);
            },

            getFilteredOrders: () => {
                const { orders, filters } = get();
                let filtered = [...orders];

                if (filters.orders.search) {
                    const searchLower = filters.orders.search.toLowerCase();
                    filtered = filtered.filter(o =>
                        o.tests.some(t =>
                            t.name.toLowerCase().includes(searchLower) ||
                            t.code.toLowerCase().includes(searchLower)
                        )
                    );
                }

                if (filters.orders.patientId) {
                    filtered = filtered.filter(o => o.patientId === filters.orders.patientId);
                }

                if (filters.orders.status) {
                    filtered = filtered.filter(o => o.status === filters.orders.status);
                }

                if (filters.orders.dateFrom) {
                    filtered = filtered.filter(o => new Date(o.orderDate) >= new Date(filters.orders.dateFrom!));
                }

                if (filters.orders.dateTo) {
                    filtered = filtered.filter(o => new Date(o.orderDate) <= new Date(filters.orders.dateTo!));
                }

                return filtered;
            },

            getFilteredResults: () => {
                const { results, filters } = get();
                let filtered = [...results];

                if (filters.results.search) {
                    const searchLower = filters.results.search.toLowerCase();
                    filtered = filtered.filter(r =>
                        r.testName.toLowerCase().includes(searchLower) ||
                        r.testCode.toLowerCase().includes(searchLower) ||
                        r.value.toLowerCase().includes(searchLower)
                    );
                }

                if (filters.results.patientId) {
                    filtered = filtered.filter(r => r.patientId === filters.results.patientId);
                }

                if (filters.results.testCode) {
                    filtered = filtered.filter(r => r.testCode === filters.results.testCode);
                }

                if (filters.results.interpretation) {
                    filtered = filtered.filter(r => r.interpretation === filters.results.interpretation);
                }

                if (filters.results.dateFrom) {
                    filtered = filtered.filter(r => new Date(r.performedAt) >= new Date(filters.results.dateFrom!));
                }

                if (filters.results.dateTo) {
                    filtered = filtered.filter(r => new Date(r.performedAt) <= new Date(filters.results.dateTo!));
                }

                return filtered;
            },

            getResultInterpretationSummary: (patientId: string) => {
                const patientResults = get().getResultsByPatient(patientId);

                return {
                    normal: patientResults.filter(r => r.interpretation === 'normal').length,
                    abnormal: patientResults.filter(r => r.interpretation === 'abnormal' || r.interpretation === 'high' || r.interpretation === 'low').length,
                    critical: patientResults.filter(r => r.interpretation === 'critical').length,
                    total: patientResults.length,
                };
            },
        }),
        {
            name: 'lab-store',
            partialize: (state) => ({
                selectedOrder: state.selectedOrder,
                selectedResult: state.selectedResult,
                filters: state.filters,
            }),
        }
    )
);

// Utility hooks for easier access to specific lab states
export const useLabOrders = () =>
    useLabStore((state) => ({
        orders: state.orders,
        filteredOrders: state.getFilteredOrders(),
        selectedOrder: state.selectedOrder,
        loading: state.loading.fetchOrders,
        error: state.errors.fetchOrders,
        pagination: state.pagination.orders,
        fetchOrders: state.fetchOrders,
        selectOrder: state.selectOrder,
        updateOrderStatus: state.updateOrderStatus,
        cancelOrder: state.cancelOrder,
    }));

export const useLabResults = () =>
    useLabStore((state) => ({
        results: state.results,
        filteredResults: state.getFilteredResults(),
        selectedResult: state.selectedResult,
        loading: state.loading.fetchResults,
        error: state.errors.fetchResults,
        pagination: state.pagination.results,
        fetchResults: state.fetchResults,
        selectResult: state.selectResult,
        updateResult: state.updateResult,
        deleteResult: state.deleteResult,
    }));

export const useLabActions = () =>
    useLabStore((state) => ({
        createOrder: state.createOrder,
        addResult: state.addResult,
        loading: {
            createOrder: state.loading.createOrder,
            addResult: state.loading.addResult,
            updateOrder: state.loading.updateOrder,
            updateResult: state.loading.updateResult,
        },
        errors: {
            createOrder: state.errors.createOrder,
            addResult: state.errors.addResult,
            updateOrder: state.errors.updateOrder,
            updateResult: state.errors.updateResult,
        },
        clearErrors: state.clearErrors,
    }));

export const useLabTrends = () =>
    useLabStore((state) => ({
        trends: state.trends,
        loading: state.loading.fetchTrends,
        error: state.errors.fetchTrends,
        fetchTrends: state.fetchTrends,
        getTrendData: state.getTrendData,
    }));

export const useLabCriticalResults = () =>
    useLabStore((state) => ({
        criticalResults: state.criticalResults,
        abnormalResults: state.abnormalResults,
        loading: {
            critical: state.loading.fetchCritical,
            abnormal: state.loading.fetchAbnormal,
        },
        errors: {
            critical: state.errors.fetchCritical,
            abnormal: state.errors.fetchAbnormal,
        },
        fetchCriticalResults: state.fetchCriticalResults,
        fetchAbnormalResults: state.fetchAbnormalResults,
        getCriticalResultsByPatient: state.getCriticalResultsByPatient,
        getAbnormalResultsByPatient: state.getAbnormalResultsByPatient,
    }));

export const useLabTestCatalog = () =>
    useLabStore((state) => ({
        testCatalog: state.testCatalog,
        loading: state.loading.fetchCatalog,
        error: state.errors.fetchCatalog,
        fetchTestCatalog: state.fetchTestCatalog,
        searchTestCatalog: state.searchTestCatalog,
    }));

export const useLabFilters = () =>
    useLabStore((state) => ({
        orderFilters: state.filters.orders,
        resultFilters: state.filters.results,
        setOrderFilters: state.setOrderFilters,
        setResultFilters: state.setResultFilters,
        clearOrderFilters: state.clearOrderFilters,
        clearResultFilters: state.clearResultFilters,
        searchOrders: state.searchOrders,
        searchResults: state.searchResults,
        filterOrdersByPatient: state.filterOrdersByPatient,
        filterResultsByPatient: state.filterResultsByPatient,
        filterOrdersByStatus: state.filterOrdersByStatus,
        filterResultsByInterpretation: state.filterResultsByInterpretation,
    }));

export const useLabFHIR = () =>
    useLabStore((state) => ({
        loading: {
            import: state.loading.fhirImport,
            export: state.loading.fhirExport,
        },
        errors: {
            import: state.errors.fhirImport,
            export: state.errors.fhirExport,
        },
        importFHIR: state.importFHIR,
        exportOrder: state.exportOrder,
    }));

export const useLabSelectors = () =>
    useLabStore((state) => ({
        getOrdersByPatient: state.getOrdersByPatient,
        getResultsByPatient: state.getResultsByPatient,
        getResultsByOrder: state.getResultsByOrder,
        getPendingOrders: state.getPendingOrders,
        getCompletedOrders: state.getCompletedOrders,
        getFilteredOrders: state.getFilteredOrders,
        getFilteredResults: state.getFilteredResults,
        getResultInterpretationSummary: state.getResultInterpretationSummary,
    }));