import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Medication, MedicationFormData, MedicationFilters, LoadingState, ErrorState } from './types';

interface MedicationStore {
  // State
  medications: Medication[];
  selectedMedication: Medication | null;
  filters: MedicationFilters;
  loading: LoadingState;
  errors: ErrorState;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };

  // Actions
  // CRUD operations
  fetchMedications: (filters?: MedicationFilters) => Promise<void>;
  fetchMedicationsByPatient: (patientId: string) => Promise<void>;
  createMedication: (medicationData: MedicationFormData) => Promise<Medication | null>;
  updateMedication: (id: string, medicationData: Partial<MedicationFormData>) => Promise<Medication | null>;
  deleteMedication: (id: string) => Promise<boolean>;
  getMedicationById: (id: string) => Promise<Medication | null>;

  // Status management
  updateMedicationStatus: (id: string, status: 'active' | 'completed' | 'discontinued') => Promise<boolean>;
  discontinueMedication: (id: string, reason?: string) => Promise<boolean>;

  // Selection actions
  selectMedication: (medication: Medication | null) => void;

  // Filter and search actions
  setFilters: (filters: Partial<MedicationFilters>) => void;
  clearFilters: () => void;
  searchMedications: (searchTerm: string) => void;
  filterByStatus: (status: 'active' | 'completed' | 'discontinued' | 'all') => void;
  filterByPatient: (patientId: string) => void;
  sortMedications: (sortBy: 'name' | 'prescribedDate' | 'createdAt', sortOrder: 'asc' | 'desc') => void;

  // Pagination actions
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;

  // Utility actions
  clearErrors: () => void;
  setLoading: (key: string, loading: boolean) => void;
  setError: (key: string, error: string | null) => void;

  // Bulk operations
  updateMultipleMedicationStatus: (ids: string[], status: string) => Promise<boolean>;
  deleteMultipleMedications: (ids: string[]) => Promise<boolean>;

  // Local state management
  addMedicationToState: (medication: Medication) => void;
  updateMedicationInState: (id: string, updates: Partial<Medication>) => void;
  removeMedicationFromState: (id: string) => void;

  // Analytics and insights
  getActiveMedicationsCount: () => number;
  getMedicationsByStatus: (status: string) => Medication[];
  getPatientMedicationSummary: (patientId: string) => {
    active: number;
    completed: number;
    discontinued: number;
    total: number;
  };
}

// Mock medication service (you'll need to implement the actual service)
const medicationService = {
  async getMedications(filters: MedicationFilters) {
    // This should be implemented to call your actual API

    return { success: true, data: [], pagination: { page: 1, limit: 10, total: 0, pages: 0 } };
  },
  async getMedicationsByPatient(patientId: string) {

    return { success: true, data: [] };
  },
  async createMedication(data: MedicationFormData) {
    return { success: true, data: { ...data, _id: Date.now().toString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } };
  },
  async updateMedication(id: string, data: Partial<MedicationFormData>) {
    const fullMedication: Medication = {
      _id: id,
      patientId: data.patientId || 'unknown',
      name: data.name || 'Unknown Medication',
      dosage: data.dosage || 'Unknown Dosage',
      frequency: data.frequency || 'As needed',
      instructions: data.instructions,
      prescribedDate: data.prescribedDate || new Date().toISOString(),
      duration: data.duration,
      status: data.status || 'active',
      sideEffects: data.sideEffects || [],
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: new Date().toISOString()
    };
    return { success: true, data: fullMedication };
  },
  async deleteMedication(id: string) {

    return { success: true };
  },
  async getMedicationById(id: string) {

    return { success: true, data: null };
  },
  async updateMedicationStatus(id: string, status: string) {

    return { success: true, data: { status } };
  },
};

export const useMedicationStore = create<MedicationStore>()(
  persist(
    (set, get) => ({
      // Initial state
      medications: [],
      selectedMedication: null,
      filters: {
        search: '',
        sortBy: 'prescribedDate',
        sortOrder: 'desc',
        page: 1,
        limit: 10,
      },
      loading: {},
      errors: {},
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        pages: 0,
      },

      // CRUD operations
      fetchMedications: async (filters) => {
        // Prevent automatic API calls in development/testing
        const isProduction = import.meta.env.PROD;

        if (!isProduction) {
          console.warn('Skipping medication API call - no token found in development mode');
          return;
        }

        const { setLoading, setError } = get();
        setLoading('fetchMedications', true);
        setError('fetchMedications', null);

        try {
          const currentFilters = filters || get().filters;
          const response = await medicationService.getMedications(currentFilters);

          if (response.success && response.data) {
            set({
              medications: response.data,
              pagination: response.pagination || {
                page: currentFilters.page || 1,
                limit: currentFilters.limit || 10,
                total: response.data.length,
                pages: Math.ceil(response.data.length / (currentFilters.limit || 10)),
              },
            });
          } else {
            setError('fetchMedications', 'Failed to fetch medications');
          }
        } catch (error) {
          setError('fetchMedications', error instanceof Error ? error.message : 'An unexpected error occurred');
        } finally {
          setLoading('fetchMedications', false);
        }
      },

      fetchMedicationsByPatient: async (_patientId) => {
        const { setLoading, setError } = get();
        setLoading('fetchByPatient', true);
        setError('fetchByPatient', null);

        try {
          const response = await medicationService.getMedicationsByPatient(_patientId);

          if (response.success && response.data) {
            set({ medications: response.data });
          } else {
            setError('fetchByPatient', 'Failed to fetch patient medications');
          }
        } catch (error) {
          setError('fetchByPatient', error instanceof Error ? error.message : 'An unexpected error occurred');
        } finally {
          setLoading('fetchByPatient', false);
        }
      },

      createMedication: async (medicationData) => {
        const { setLoading, setError, addMedicationToState } = get();
        setLoading('createMedication', true);
        setError('createMedication', null);

        try {
          const response = await medicationService.createMedication(medicationData);

          if (response.success && response.data) {
            addMedicationToState(response.data);
            return response.data;
          } else {
            setError('createMedication', 'Failed to create medication');
            return null;
          }
        } catch (error) {
          setError('createMedication', error instanceof Error ? error.message : 'An unexpected error occurred');
          return null;
        } finally {
          setLoading('createMedication', false);
        }
      },

      updateMedication: async (id, medicationData) => {
        const { setLoading, setError, updateMedicationInState } = get();
        setLoading('updateMedication', true);
        setError('updateMedication', null);

        try {
          const response = await medicationService.updateMedication(id, medicationData);

          if (response.success && response.data) {
            updateMedicationInState(id, response.data);

            // Update selected medication if it's the one being updated
            const { selectedMedication } = get();
            if (selectedMedication && selectedMedication._id === id) {
              set({ selectedMedication: { ...selectedMedication, ...response.data } });
            }

            return response.data;
          } else {
            setError('updateMedication', 'Failed to update medication');
            return null;
          }
        } catch (error) {
          setError('updateMedication', error instanceof Error ? error.message : 'An unexpected error occurred');
          return null;
        } finally {
          setLoading('updateMedication', false);
        }
      },

      deleteMedication: async (id) => {
        const { setLoading, setError, removeMedicationFromState } = get();
        setLoading('deleteMedication', true);
        setError('deleteMedication', null);

        try {
          const response = await medicationService.deleteMedication(id);

          if (response.success) {
            removeMedicationFromState(id);

            // Clear selected medication if it's the one being deleted
            const { selectedMedication } = get();
            if (selectedMedication && selectedMedication._id === id) {
              set({ selectedMedication: null });
            }

            return true;
          } else {
            setError('deleteMedication', 'Failed to delete medication');
            return false;
          }
        } catch (error) {
          setError('deleteMedication', error instanceof Error ? error.message : 'An unexpected error occurred');
          return false;
        } finally {
          setLoading('deleteMedication', false);
        }
      },

      getMedicationById: async (id) => {
        const { setLoading, setError } = get();
        setLoading('getMedicationById', true);
        setError('getMedicationById', null);

        try {
          const response = await medicationService.getMedicationById(id);

          if (response.success && response.data) {
            return response.data;
          } else {
            setError('getMedicationById', 'Failed to fetch medication');
            return null;
          }
        } catch (error) {
          setError('getMedicationById', error instanceof Error ? error.message : 'An unexpected error occurred');
          return null;
        } finally {
          setLoading('getMedicationById', false);
        }
      },

      // Status management
      updateMedicationStatus: async (id, status) => {
        const { setLoading, setError, updateMedicationInState } = get();
        setLoading('updateStatus', true);
        setError('updateStatus', null);

        try {
          const response = await medicationService.updateMedicationStatus(id, status);

          if (response.success) {
            updateMedicationInState(id, { status: status as 'active' | 'completed' | 'discontinued' });
            return true;
          } else {
            setError('updateStatus', 'Failed to update medication status');
            return false;
          }
        } catch (error) {
          setError('updateStatus', error instanceof Error ? error.message : 'An unexpected error occurred');
          return false;
        } finally {
          setLoading('updateStatus', false);
        }
      },

      discontinueMedication: async (id, reason) => {

        const { updateMedicationStatus } = get();
        return await updateMedicationStatus(id, 'discontinued');
      },

      // Selection actions
      selectMedication: (medication) => set({ selectedMedication: medication }),

      // Filter and search actions
      setFilters: (newFilters) =>
        set((state) => ({
          filters: { ...state.filters, ...newFilters },
        })),

      clearFilters: () =>
        set({
          filters: {
            search: '',
            sortBy: 'prescribedDate',
            sortOrder: 'desc',
            page: 1,
            limit: 10,
          },
        }),

      searchMedications: (searchTerm) => {
        const { setFilters, fetchMedications } = get();
        setFilters({ search: searchTerm, page: 1 });
        fetchMedications();
      },

      filterByStatus: (status) => {
        const { setFilters, fetchMedications } = get();
        const statusFilter = status === 'all' ? undefined : status;
        setFilters({ status: statusFilter, page: 1 });
        fetchMedications();
      },

      filterByPatient: (patientId) => {
        const { setFilters, fetchMedicationsByPatient } = get();
        setFilters({ patientId, page: 1 });
        fetchMedicationsByPatient(patientId);
      },

      sortMedications: (sortBy, sortOrder) => {
        const { setFilters, fetchMedications } = get();
        setFilters({ sortBy, sortOrder, page: 1 });
        fetchMedications();
      },

      // Pagination actions
      setPage: (page) => {
        const { setFilters, fetchMedications } = get();
        setFilters({ page });
        fetchMedications();
      },

      setLimit: (limit) => {
        const { setFilters, fetchMedications } = get();
        setFilters({ limit, page: 1 });
        fetchMedications();
      },

      // Utility actions
      clearErrors: () => set({ errors: {} }),

      setLoading: (key, loading) =>
        set((state) => ({
          loading: { ...state.loading, [key]: loading },
        })),

      setError: (key, error) =>
        set((state) => ({
          errors: { ...state.errors, [key]: error },
        })),

      // Bulk operations
      updateMultipleMedicationStatus: async (ids, status) => {
        const { setLoading, setError } = get();
        setLoading('updateMultiple', true);
        setError('updateMultiple', null);

        try {
          const promises = ids.map(id => medicationService.updateMedicationStatus(id, status));
          const results = await Promise.all(promises);

          const successful = results.filter(r => r.success);

          if (successful.length === ids.length) {
            // Update all successfully updated medications in state
            set((state) => ({
              medications: state.medications.map(m =>
                ids.includes(m._id) ? { ...m, status: status as 'active' | 'inactive' | 'discontinued' } : m
              ),
            }));
            return true;
          } else {
            setError('updateMultiple', `Only ${successful.length} of ${ids.length} medications were updated`);
            return false;
          }
        } catch (error) {
          setError('updateMultiple', error instanceof Error ? error.message : 'An unexpected error occurred');
          return false;
        } finally {
          setLoading('updateMultiple', false);
        }
      },

      deleteMultipleMedications: async (ids) => {
        const { setLoading, setError } = get();
        setLoading('deleteMultiple', true);
        setError('deleteMultiple', null);

        try {
          const promises = ids.map(id => medicationService.deleteMedication(id));
          const results = await Promise.all(promises);

          const successful = results.filter(r => r.success);

          if (successful.length === ids.length) {
            // Remove all successfully deleted medications from state
            set((state) => ({
              medications: state.medications.filter(m => !ids.includes(m._id)),
              selectedMedication: state.selectedMedication && ids.includes(state.selectedMedication._id)
                ? null
                : state.selectedMedication,
            }));
            return true;
          } else {
            setError('deleteMultiple', `Only ${successful.length} of ${ids.length} medications were deleted`);
            return false;
          }
        } catch (error) {
          setError('deleteMultiple', error instanceof Error ? error.message : 'An unexpected error occurred');
          return false;
        } finally {
          setLoading('deleteMultiple', false);
        }
      },

      // Local state management
      addMedicationToState: (medication) =>
        set((state) => ({
          medications: [medication, ...state.medications],
          pagination: {
            ...state.pagination,
            total: state.pagination.total + 1,
          },
        })),

      updateMedicationInState: (id, updates) =>
        set((state) => ({
          medications: state.medications.map(m =>
            m._id === id ? { ...m, ...updates } : m
          ),
        })),

      removeMedicationFromState: (id) =>
        set((state) => ({
          medications: state.medications.filter(m => m._id !== id),
          pagination: {
            ...state.pagination,
            total: Math.max(0, state.pagination.total - 1),
          },
        })),

      // Analytics and insights
      getActiveMedicationsCount: () => {
        const { medications } = get();
        return medications.filter(m => m.status === 'active').length;
      },

      getMedicationsByStatus: (status) => {
        const { medications } = get();
        return medications.filter(m => m.status === status);
      },

      getPatientMedicationSummary: (patientId) => {
        const { medications } = get();
        const patientMeds = medications.filter(m => m.patientId === patientId);

        return {
          active: patientMeds.filter(m => m.status === 'active').length,
          completed: patientMeds.filter(m => m.status === 'completed').length,
          discontinued: patientMeds.filter(m => m.status === 'discontinued').length,
          total: patientMeds.length,
        };
      },
    }),
    {
      name: 'medication-store',
      partialize: (state) => ({
        filters: state.filters,
        selectedMedication: state.selectedMedication,
      }),
    }
  )
);

// Utility hooks for easier access to specific medication states
export const useMedications = () => useMedicationStore((state) => ({
  medications: state.medications,
  loading: state.loading.fetchMedications || false,
  error: state.errors.fetchMedications || null,
  pagination: state.pagination,
  fetchMedications: state.fetchMedications,
  fetchMedicationsByPatient: state.fetchMedicationsByPatient,
}));

export const useSelectedMedication = () => useMedicationStore((state) => ({
  selectedMedication: state.selectedMedication,
  selectMedication: state.selectMedication,
  loading: state.loading.getMedicationById || false,
  error: state.errors.getMedicationById || null,
  getMedicationById: state.getMedicationById,
}));

export const useMedicationFilters = () => useMedicationStore((state) => ({
  filters: state.filters,
  setFilters: state.setFilters,
  clearFilters: state.clearFilters,
  searchMedications: state.searchMedications,
  filterByStatus: state.filterByStatus,
  filterByPatient: state.filterByPatient,
  sortMedications: state.sortMedications,
}));

export const useMedicationActions = () => useMedicationStore((state) => ({
  createMedication: state.createMedication,
  updateMedication: state.updateMedication,
  deleteMedication: state.deleteMedication,
  updateMedicationStatus: state.updateMedicationStatus,
  discontinueMedication: state.discontinueMedication,
  updateMultipleMedicationStatus: state.updateMultipleMedicationStatus,
  deleteMultipleMedications: state.deleteMultipleMedications,
  loading: {
    create: state.loading.createMedication || false,
    update: state.loading.updateMedication || false,
    delete: state.loading.deleteMedication || false,
    updateStatus: state.loading.updateStatus || false,
    updateMultiple: state.loading.updateMultiple || false,
    deleteMultiple: state.loading.deleteMultiple || false,
  },
  errors: {
    create: state.errors.createMedication || null,
    update: state.errors.updateMedication || null,
    delete: state.errors.deleteMedication || null,
    updateStatus: state.errors.updateStatus || null,
    updateMultiple: state.errors.updateMultiple || null,
    deleteMultiple: state.errors.deleteMultiple || null,
  },
  clearErrors: state.clearErrors,
}));

export const useMedicationAnalytics = () => useMedicationStore((state) => ({
  getActiveMedicationsCount: state.getActiveMedicationsCount,
  getMedicationsByStatus: state.getMedicationsByStatus,
  getPatientMedicationSummary: state.getPatientMedicationSummary,
}));