import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { diagnosticApi } from '../api/diagnosticApi';
import type {
  DiagnosticRequest,
  DiagnosticResult,
  DiagnosticRequestForm,
  DiagnosticStore,
} from '../types';

export const useDiagnosticStore = create<DiagnosticStore>()(
  persist(
    (set, get) => ({
      // Initial state
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

      // CRUD Actions
      createRequest: async (data: DiagnosticRequestForm) => {
        const { setLoading, setError, addRequestToState } = get();
        setLoading('createRequest', true);
        setError('createRequest', null);

        try {
          const response = await diagnosticApi.createRequest(data);

          if (response.success && response.data) {
            addRequestToState(response.data);
            set({ selectedRequest: response.data });
            return response.data;
          } else {
            setError(
              'createRequest',
              response.message || 'Failed to create request'
            );
            return null;
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred';
          setError('createRequest', errorMessage);
          return null;
        } finally {
          setLoading('createRequest', false);
        }
      },

      fetchRequests: async (filters) => {
        const { setLoading, setError } = get();
        setLoading('fetchRequests', true);
        setError('fetchRequests', null);

        try {
          const currentFilters = filters || get().filters;
          const response = await diagnosticApi.getHistory(currentFilters);

          if (response.success && response.data) {
            set({
              requests: response.data.results || [],
              pagination: {
                page: response.meta?.page || currentFilters.page || 1,
                limit: response.meta?.limit || currentFilters.limit || 20,
                total: response.meta?.total || 0,
                pages: response.meta?.totalPages || 0,
                hasNext: response.meta?.hasNext || false,
                hasPrev: response.meta?.hasPrev || false,
              },
            });
          } else {
            setError(
              'fetchRequests',
              response.message || 'Failed to fetch requests'
            );
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred';
          setError('fetchRequests', errorMessage);
        } finally {
          setLoading('fetchRequests', false);
        }
      },

      fetchResult: async (requestId: string) => {
        const { setLoading, setError, addResultToState } = get();
        setLoading('fetchResult', true);
        setError('fetchResult', null);

        try {
          const response = await diagnosticApi.getResult(requestId);

          if (response.success && response.data) {
            const existingResult = get().results.find(
              (r) => r._id === response.data!._id
            );
            if (existingResult) {
              get().updateResultInState(response.data._id, response.data);
            } else {
              addResultToState(response.data);
            }
            set({ selectedResult: response.data });
            return response.data;
          } else {
            setError(
              'fetchResult',
              response.message || 'Failed to fetch result'
            );
            return null;
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred';
          setError('fetchResult', errorMessage);
          return null;
        } finally {
          setLoading('fetchResult', false);
        }
      },

      approveResult: async (resultId: string) => {
        const { setLoading, setError, updateResultInState } = get();
        setLoading('approveResult', true);
        setError('approveResult', null);

        try {
          const response = await diagnosticApi.approveResult(resultId);

          if (response.success && response.data) {
            updateResultInState(resultId, response.data);
            set({ selectedResult: response.data });
            return true;
          } else {
            setError(
              'approveResult',
              response.message || 'Failed to approve result'
            );
            return false;
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred';
          setError('approveResult', errorMessage);
          return false;
        } finally {
          setLoading('approveResult', false);
        }
      },

      modifyResult: async (resultId: string, modifications: string) => {
        const { setLoading, setError, updateResultInState } = get();
        setLoading('approveResult', true);
        setError('approveResult', null);

        try {
          const response = await diagnosticApi.modifyResult(
            resultId,
            modifications
          );

          if (response.success && response.data) {
            updateResultInState(resultId, response.data);
            set({ selectedResult: response.data });
            return true;
          } else {
            setError(
              'approveResult',
              response.message || 'Failed to modify result'
            );
            return false;
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred';
          setError('approveResult', errorMessage);
          return false;
        } finally {
          setLoading('approveResult', false);
        }
      },

      rejectResult: async (resultId: string, reason: string) => {
        const { setLoading, setError, updateResultInState } = get();
        setLoading('approveResult', true);
        setError('approveResult', null);

        try {
          const response = await diagnosticApi.rejectResult(resultId, reason);

          if (response.success && response.data) {
            updateResultInState(resultId, response.data);
            set({ selectedResult: response.data });
            return true;
          } else {
            setError(
              'approveResult',
              response.message || 'Failed to reject result'
            );
            return false;
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred';
          setError('approveResult', errorMessage);
          return false;
        } finally {
          setLoading('approveResult', false);
        }
      },

      cancelRequest: async (requestId: string) => {
        const { setLoading, setError, updateRequestInState } = get();
        setLoading('createRequest', true);
        setError('createRequest', null);

        try {
          const response = await diagnosticApi.cancelRequest(requestId);

          if (response.success && response.data) {
            updateRequestInState(requestId, response.data);
            return true;
          } else {
            setError(
              'createRequest',
              response.message || 'Failed to cancel request'
            );
            return false;
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred';
          setError('createRequest', errorMessage);
          return false;
        } finally {
          setLoading('createRequest', false);
        }
      },

      // Polling Actions
      startPolling: (requestId: string, interval = 5000) => {
        const { stopPolling, pollResult } = get();

        // Stop any existing polling
        stopPolling();

        // Start new polling
        const intervalId = setInterval(() => {
          pollResult(requestId);
        }, interval);

        set((state) => ({
          uiState: {
            ...state.uiState,
            pollingActive: true,
            pollingInterval: intervalId,
          },
        }));
      },

      stopPolling: () => {
        const { uiState } = get();
        if (uiState.pollingInterval) {
          clearInterval(uiState.pollingInterval);
        }

        set((state) => ({
          uiState: {
            ...state.uiState,
            pollingActive: false,
            pollingInterval: null,
          },
        }));
      },

      pollResult: async (requestId: string) => {
        const { setLoading, setError } = get();
        setLoading('polling', true);
        setError('polling', null);

        try {
          const response = await diagnosticApi.getStatus(requestId);

          if (response.success && response.data) {
            // If completed, fetch the full result and stop polling
            if (response.data.status === 'completed') {
              await get().fetchResult(requestId);
              get().stopPolling();
            } else if (
              response.data.status === 'failed' ||
              response.data.status === 'cancelled'
            ) {
              get().stopPolling();
            }
          } else {
            setError('polling', response.message || 'Failed to check status');
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred';
          setError('polling', errorMessage);
        } finally {
          setLoading('polling', false);
        }
      },

      // Filter and Search Actions
      setFilters: (newFilters) => {
        set((state) => {
          // Check if any values have actually changed
          const hasChanges = Object.keys(newFilters).some((key) => {
            const stateValue = state.filters[key as keyof typeof state.filters];
            const newValue = newFilters[key as keyof typeof newFilters];

            // Handle undefined comparison properly
            if (stateValue === undefined && newValue === undefined)
              return false;
            if (stateValue === undefined || newValue === undefined) return true;

            // Compare string representations to handle object/array comparisons
            return JSON.stringify(stateValue) !== JSON.stringify(newValue);
          });

          // Only update if there are actual changes
          if (hasChanges) {
            return {
              filters: { ...state.filters, ...newFilters },
            };
          }

          // Return the same state if no changes
          return state;
        });
      },

      clearFilters: () => {
        set({
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
        });
      },

      searchRequests: (searchTerm: string) => {
        const { setFilters, fetchRequests } = get();
        setFilters({ search: searchTerm, page: 1 });
        fetchRequests();
      },

      filterByPatient: (patientId: string) => {
        const { setFilters, fetchRequests } = get();
        setFilters({ patientId, page: 1 });
        fetchRequests();
      },

      filterByStatus: (status) => {
        const { setFilters, fetchRequests } = get();
        setFilters({ status, page: 1 });
        fetchRequests();
      },

      // Pagination Actions
      setPage: (page: number) => {
        const { setFilters, fetchRequests } = get();
        setFilters({ page });
        fetchRequests();
      },

      setLimit: (limit: number) => {
        const { setFilters, fetchRequests } = get();
        setFilters({ limit, page: 1 });
        fetchRequests();
      },

      // Selection Actions
      selectRequest: (request: DiagnosticRequest | null) => {
        set({ selectedRequest: request });
      },

      selectResult: (result: DiagnosticResult | null) => {
        set({ selectedResult: result });
      },

      // UI Actions
      setShowCreateModal: (show: boolean) => {
        set((state) => ({
          uiState: { ...state.uiState, showCreateModal: show },
        }));
      },

      setShowResultModal: (show: boolean) => {
        set((state) => ({
          uiState: { ...state.uiState, showResultModal: show },
        }));
      },

      setActiveStep: (step: number) => {
        set((state) => ({
          uiState: { ...state.uiState, activeStep: step },
        }));
      },

      // Analytics Actions
      fetchAnalytics: async (params) => {
        const { setLoading, setError } = get();
        setLoading('fetchAnalytics', true);
        setError('fetchAnalytics', null);

        try {
          const response = await diagnosticApi.getAnalytics(params);

          if (response.success && response.data) {
            set({ analytics: response.data });
          } else {
            setError(
              'fetchAnalytics',
              response.message || 'Failed to fetch analytics'
            );
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred';
          setError('fetchAnalytics', errorMessage);
        } finally {
          setLoading('fetchAnalytics', false);
        }
      },

      // Optimistic Updates
      addRequestToState: (request: DiagnosticRequest) => {
        set((state) => ({
          requests: [request, ...state.requests],
          pagination: {
            ...state.pagination,
            total: state.pagination.total + 1,
          },
        }));
      },

      updateRequestInState: (
        id: string,
        updates: Partial<DiagnosticRequest>
      ) => {
        set((state) => ({
          requests: state.requests.map((r) =>
            r._id === id ? { ...r, ...updates } : r
          ),
        }));
      },

      removeRequestFromState: (id: string) => {
        set((state) => ({
          requests: state.requests.filter((r) => r._id !== id),
          pagination: {
            ...state.pagination,
            total: Math.max(0, state.pagination.total - 1),
          },
        }));
      },

      addResultToState: (result: DiagnosticResult) => {
        set((state) => ({
          results: [result, ...state.results],
        }));
      },

      updateResultInState: (id: string, updates: Partial<DiagnosticResult>) => {
        set((state) => ({
          results: state.results.map((r) =>
            r._id === id ? { ...r, ...updates } : r
          ),
        }));
      },

      // Utility Actions
      clearErrors: () => {
        set({
          errors: {
            createRequest: null,
            fetchRequests: null,
            fetchResult: null,
            approveResult: null,
            fetchAnalytics: null,
            polling: null,
          },
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
      getRequestsByPatient: (patientId: string) => {
        return get().requests.filter((r) => r.patientId === patientId);
      },

      getResultsByRequest: (requestId: string) => {
        return get().results.filter((r) => r.requestId === requestId);
      },

      getPendingRequests: () => {
        return get().requests.filter(
          (r) => r.status === 'pending' || r.status === 'processing'
        );
      },

      getCompletedRequests: () => {
        return get().requests.filter((r) => r.status === 'completed');
      },

      getFilteredRequests: () => {
        const { requests, filters } = get();
        let filtered = [...requests];

        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          filtered = filtered.filter(
            (r) =>
              r.inputSnapshot.symptoms.subjective.some((s) =>
                s.toLowerCase().includes(searchLower)
              ) ||
              r.inputSnapshot.symptoms.objective.some((s) =>
                s.toLowerCase().includes(searchLower)
              )
          );
        }

        if (filters.patientId) {
          filtered = filtered.filter((r) => r.patientId === filters.patientId);
        }

        if (filters.status) {
          filtered = filtered.filter((r) => r.status === filters.status);
        }

        if (filters.dateFrom) {
          filtered = filtered.filter(
            (r) => new Date(r.createdAt) >= new Date(filters.dateFrom!)
          );
        }

        if (filters.dateTo) {
          filtered = filtered.filter(
            (r) => new Date(r.createdAt) <= new Date(filters.dateTo!)
          );
        }

        // Sort
        if (filters.sortBy) {
          filtered.sort((a, b) => {
            const aVal = a[filters.sortBy as keyof DiagnosticRequest];
            const bVal = b[filters.sortBy as keyof DiagnosticRequest];

            // Handle undefined values
            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return 1;
            if (bVal == null) return -1;

            if (filters.sortOrder === 'desc') {
              return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
            } else {
              return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            }
          });
        }

        return filtered;
      },
    }),
    {
      name: 'diagnostic-store',
      partialize: (state) => ({
        selectedRequest: state.selectedRequest,
        selectedResult: state.selectedResult,
      }),
    }
  )
);

// Utility hooks for easier access to specific diagnostic states
export const useDiagnosticRequests = () =>
  useDiagnosticStore((state) => ({
    requests: state.requests,
    filteredRequests: state.getFilteredRequests(),
    selectedRequest: state.selectedRequest,
    loading: state.loading.fetchRequests,
    error: state.errors.fetchRequests,
    pagination: state.pagination,
    fetchRequests: state.fetchRequests,
    selectRequest: state.selectRequest,
  }));

export const useDiagnosticResults = () =>
  useDiagnosticStore((state) => ({
    results: state.results,
    selectedResult: state.selectedResult,
    loading: state.loading.fetchResult,
    error: state.errors.fetchResult,
    fetchResult: state.fetchResult,
    selectResult: state.selectResult,
  }));

export const useDiagnosticActions = () =>
  useDiagnosticStore((state) => ({
    createRequest: state.createRequest,
    approveResult: state.approveResult,
    modifyResult: state.modifyResult,
    rejectResult: state.rejectResult,
    cancelRequest: state.cancelRequest,
    loading: {
      create: state.loading.createRequest,
      approve: state.loading.approveResult,
    },
    errors: {
      create: state.errors.createRequest,
      approve: state.errors.approveResult,
    },
    clearErrors: state.clearErrors,
  }));

export const useDiagnosticPolling = () =>
  useDiagnosticStore((state) => ({
    pollingActive: state.uiState.pollingActive,
    pollingError: state.errors.polling,
    startPolling: state.startPolling,
    stopPolling: state.stopPolling,
    pollResult: state.pollResult,
  }));

export const useDiagnosticFilters = () =>
  useDiagnosticStore((state) => ({
    filters: state.filters,
    setFilters: state.setFilters,
    clearFilters: state.clearFilters,
    searchRequests: state.searchRequests,
    filterByPatient: state.filterByPatient,
    filterByStatus: state.filterByStatus,
  }));

export const useDiagnosticUI = () =>
  useDiagnosticStore((state) => ({
    uiState: state.uiState,
    setShowCreateModal: state.setShowCreateModal,
    setShowResultModal: state.setShowResultModal,
    setActiveStep: state.setActiveStep,
  }));

export const useDiagnosticAnalytics = () =>
  useDiagnosticStore((state) => ({
    analytics: state.analytics,
    loading: state.loading.fetchAnalytics,
    error: state.errors.fetchAnalytics,
    fetchAnalytics: state.fetchAnalytics,
  }));

export const useDiagnosticSelectors = () =>
  useDiagnosticStore((state) => ({
    getRequestsByPatient: state.getRequestsByPatient,
    getResultsByRequest: state.getResultsByRequest,
    getPendingRequests: state.getPendingRequests,
    getCompletedRequests: state.getCompletedRequests,
    getFilteredRequests: state.getFilteredRequests,
  }));
