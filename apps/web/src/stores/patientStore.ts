import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Patient,
  PatientFormData,
  PatientFilters,
  LoadingState,
  ErrorState,
} from './types';
import { patientService } from '../services/patientService';
import {
  apiToStorePatients,
  apiResponseToStorePatient,
  storeFormToApiCreateData,
} from '../utils/patientAdapter';

interface PatientStore {
  // State
  patients: Patient[];
  selectedPatient: Patient | null;
  filters: PatientFilters;
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
  fetchPatients: (filters?: PatientFilters) => Promise<void>;
  createPatient: (patientData: PatientFormData) => Promise<Patient | null>;
  updatePatient: (
    id: string,
    patientData: Partial<PatientFormData>
  ) => Promise<Patient | null>;
  deletePatient: (id: string) => Promise<boolean>;
  getPatientById: (id: string) => Promise<Patient | null>;

  // Selection actions
  selectPatient: (patient: Patient | null) => void;

  // Filter and search actions
  setFilters: (filters: Partial<PatientFilters>) => void;
  clearFilters: () => void;
  searchPatients: (searchTerm: string) => void;
  sortPatients: (
    sortBy: 'firstName' | 'lastName' | 'createdAt' | 'updatedAt',
    sortOrder: 'asc' | 'desc'
  ) => void;

  // Pagination actions
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;

  // Utility actions
  clearErrors: () => void;
  setLoading: (key: string, loading: boolean) => void;
  setError: (key: string, error: string | null) => void;

  // Bulk operations
  deleteMultiplePatients: (ids: string[]) => Promise<boolean>;

  // Local state management
  addPatientToState: (patient: Patient) => void;
  updatePatientInState: (id: string, updates: Partial<Patient>) => void;
  removePatientFromState: (id: string) => void;
}

export const usePatientStore = create<PatientStore>()(
  persist(
    (set, get) => ({
      // Initial state
      patients: [],
      selectedPatient: null,
      filters: {
        search: '',
        sortBy: 'createdAt',
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
      fetchPatients: async (filters) => {
        const { setLoading, setError } = get();
        setLoading('fetchPatients', true);
        setError('fetchPatients', null);

        try {
          const currentFilters = filters || get().filters;
          const response = await patientService.getPatients(currentFilters);

          if (response.success && response.data) {
            // Convert API patients to store patient format
            const apiPatients = response.data.results || [];
            const storePatients = apiToStorePatients(apiPatients);

            set({
              patients: storePatients,
              pagination: {
                page: response.meta?.page || currentFilters.page || 1,
                limit: response.meta?.limit || currentFilters.limit || 10,
                total: response.meta?.total || apiPatients.length,
                pages:
                  response.meta?.totalPages ||
                  Math.ceil(apiPatients.length / (currentFilters.limit || 10)),
              },
            });
          } else {
            setError(
              'fetchPatients',
              response.message || 'Failed to fetch patients'
            );
          }
        } catch (error) {
          setError(
            'fetchPatients',
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred'
          );
        } finally {
          setLoading('fetchPatients', false);
        }
      },

      createPatient: async (patientData) => {
        const { setLoading, setError, addPatientToState } = get();
        setLoading('createPatient', true);
        setError('createPatient', null);

        try {
          // Convert store form data to API format
          const apiPatientData = storeFormToApiCreateData(patientData);
          const response = await patientService.createPatient(apiPatientData);

          if (response.success && response.data) {
            // Convert API response to store format
            const storePatient = apiResponseToStorePatient(response.data);
            addPatientToState(storePatient);
            return storePatient;
          } else {
            setError(
              'createPatient',
              response.message || 'Failed to create patient'
            );
            return null;
          }
        } catch (error) {
          setError(
            'createPatient',
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred'
          );
          return null;
        } finally {
          setLoading('createPatient', false);
        }
      },

      updatePatient: async (id, patientData) => {
        const { setLoading, setError, updatePatientInState } = get();
        setLoading('updatePatient', true);
        setError('updatePatient', null);

        try {
          // Convert store form data to API format
          const apiUpdateData = storeFormToApiCreateData(
            patientData as PatientFormData
          );
          const response = await patientService.updatePatient(
            id,
            apiUpdateData
          );

          if (response.success && response.data) {
            // Convert API response to store format
            const storePatient = apiResponseToStorePatient(response.data);
            updatePatientInState(id, storePatient);

            // Update selected patient if it's the one being updated
            const { selectedPatient } = get();
            if (selectedPatient && selectedPatient._id === id) {
              set({ selectedPatient: storePatient });
            }

            return storePatient;
          } else {
            setError(
              'updatePatient',
              response.message || 'Failed to update patient'
            );
            return null;
          }
        } catch (error) {
          setError(
            'updatePatient',
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred'
          );
          return null;
        } finally {
          setLoading('updatePatient', false);
        }
      },

      deletePatient: async (id) => {
        const { setLoading, setError, removePatientFromState } = get();
        setLoading('deletePatient', true);
        setError('deletePatient', null);

        try {
          const response = await patientService.deletePatient(id);

          if (response.success) {
            removePatientFromState(id);

            // Clear selected patient if it's the one being deleted
            const { selectedPatient } = get();
            if (selectedPatient && selectedPatient._id === id) {
              set({ selectedPatient: null });
            }

            return true;
          } else {
            setError(
              'deletePatient',
              response.message || 'Failed to delete patient'
            );
            return false;
          }
        } catch (error) {
          setError(
            'deletePatient',
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred'
          );
          return false;
        } finally {
          setLoading('deletePatient', false);
        }
      },

      getPatientById: async (id) => {
        const { setLoading, setError } = get();
        setLoading('getPatientById', true);
        setError('getPatientById', null);

        try {
          // Fix: Use getPatient instead of getPatientById
          const response = await patientService.getPatient(id);

          if (response.success && response.data) {
            // Convert API response to store format
            return apiResponseToStorePatient(response.data);
          } else {
            setError(
              'getPatientById',
              response.message || 'Failed to fetch patient'
            );
            return null;
          }
        } catch (error) {
          setError(
            'getPatientById',
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred'
          );
          return null;
        } finally {
          setLoading('getPatientById', false);
        }
      },

      // Selection actions
      selectPatient: (patient) => set({ selectedPatient: patient }),

      // Filter and search actions
      setFilters: (newFilters) =>
        set((state) => ({
          filters: { ...state.filters, ...newFilters },
        })),

      clearFilters: () =>
        set({
          filters: {
            search: '',
            sortBy: 'createdAt',
            sortOrder: 'desc',
            page: 1,
            limit: 10,
          },
        }),

      searchPatients: (searchTerm) => {
        const { setFilters, fetchPatients } = get();
        setFilters({ search: searchTerm, page: 1 });
        fetchPatients();
      },

      sortPatients: (sortBy, sortOrder) => {
        const { setFilters, fetchPatients } = get();
        setFilters({ sortBy, sortOrder, page: 1 });
        fetchPatients();
      },

      // Pagination actions
      setPage: (page) => {
        const { setFilters, fetchPatients } = get();
        setFilters({ page });
        fetchPatients();
      },

      setLimit: (limit) => {
        const { setFilters, fetchPatients } = get();
        setFilters({ limit, page: 1 });
        fetchPatients();
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
      deleteMultiplePatients: async (ids) => {
        const { setLoading, setError } = get();
        setLoading('deleteMultiple', true);
        setError('deleteMultiple', null);

        try {
          const promises = ids.map((id) => patientService.deletePatient(id));
          const results = await Promise.all(promises);

          const successful = results.filter((r) => r.success);

          if (successful.length === ids.length) {
            // Remove all successfully deleted patients from state
            set((state) => ({
              patients: state.patients.filter((p) => !ids.includes(p._id)),
              selectedPatient:
                state.selectedPatient && ids.includes(state.selectedPatient._id)
                  ? null
                  : state.selectedPatient,
            }));
            return true;
          } else {
            setError(
              'deleteMultiple',
              `Only ${successful.length} of ${ids.length} patients were deleted`
            );
            return false;
          }
        } catch (error) {
          setError(
            'deleteMultiple',
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred'
          );
          return false;
        } finally {
          setLoading('deleteMultiple', false);
        }
      },

      // Local state management
      addPatientToState: (patient) =>
        set((state) => ({
          patients: [patient, ...state.patients],
          pagination: {
            ...state.pagination,
            total: state.pagination.total + 1,
          },
        })),

      updatePatientInState: (id, updates) =>
        set((state) => ({
          patients: state.patients.map((p) =>
            p._id === id ? { ...p, ...updates } : p
          ),
        })),

      removePatientFromState: (id) =>
        set((state) => ({
          patients: state.patients.filter((p) => p._id !== id),
          pagination: {
            ...state.pagination,
            total: Math.max(0, state.pagination.total - 1),
          },
        })),
    }),
    {
      name: 'patient-store',
      partialize: (state) => ({
        filters: state.filters,
        selectedPatient: state.selectedPatient,
      }),
    }
  )
);

// Utility hooks for easier access to specific patient states
export const usePatients = () =>
  usePatientStore((state) => ({
    patients: state.patients,
    loading: state.loading.fetchPatients || false,
    error: state.errors.fetchPatients || null,
    pagination: state.pagination,
    fetchPatients: state.fetchPatients,
  }));

export const useSelectedPatient = () =>
  usePatientStore((state) => ({
    selectedPatient: state.selectedPatient,
    selectPatient: state.selectPatient,
    loading: state.loading.getPatientById || false,
    error: state.errors.getPatientById || null,
    getPatientById: state.getPatientById,
  }));

export const usePatientFilters = () =>
  usePatientStore((state) => ({
    filters: state.filters,
    setFilters: state.setFilters,
    clearFilters: state.clearFilters,
    searchPatients: state.searchPatients,
    sortPatients: state.sortPatients,
  }));

export const usePatientActions = () =>
  usePatientStore((state) => ({
    createPatient: state.createPatient,
    updatePatient: state.updatePatient,
    deletePatient: state.deletePatient,
    deleteMultiplePatients: state.deleteMultiplePatients,
    loading: {
      create: state.loading.createPatient || false,
      update: state.loading.updatePatient || false,
      delete: state.loading.deletePatient || false,
      deleteMultiple: state.loading.deleteMultiple || false,
    },
    errors: {
      create: state.errors.createPatient || null,
      update: state.errors.updatePatient || null,
      delete: state.errors.deletePatient || null,
      deleteMultiple: state.errors.deleteMultiple || null,
    },
    clearErrors: state.clearErrors,
  }));
