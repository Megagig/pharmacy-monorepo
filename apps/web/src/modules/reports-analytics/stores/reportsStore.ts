// Reports Store - Main state management for reports
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { ReportType, ReportData } from '../types/reports';
import { ReportFilters } from '../types/filters';
import { reportsService } from '../../../services/reportsService';

interface ReportsState {
  // Current report state
  activeReport: ReportType | null;
  reportData: Record<string, ReportData>;
  loading: Record<string, boolean>;
  errors: Record<string, string | null>;

  // Report history and caching
  reportHistory: Array<{
    reportType: ReportType;
    filters: ReportFilters;
    timestamp: Date;
    id: string;
  }>;

  // UI state
  sidebarCollapsed: boolean;
  fullscreenChart: string | null;

  // Actions
  setActiveReport: (reportType: ReportType) => void;
  clearActiveReport: () => void;
  setReportData: (reportType: string, data: ReportData) => void;
  setLoading: (reportType: string, loading: boolean) => void;
  setError: (reportType: string, error: string | null) => void;
  clearReportData: (reportType: string) => void;
  addToHistory: (reportType: ReportType, filters: ReportFilters) => void;
  clearHistory: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setFullscreenChart: (chartId: string | null) => void;
  generateReport: (reportType: ReportType, filters?: ReportFilters) => Promise<void>;
  clearAllLoadingStates: () => void;
  resetStore: () => void;

  // Computed getters
  getCurrentReportData: () => ReportData | null;
  isCurrentReportLoading: () => boolean;
  getCurrentReportError: () => string | null;
  getRecentReports: (limit?: number) => Array<{
    reportType: ReportType;
    filters: ReportFilters;
    timestamp: Date;
    id: string;
  }>;
}

export const useReportsStore = create<ReportsState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        activeReport: null,
        reportData: {},
        loading: {},
        errors: {},
        reportHistory: [],
        sidebarCollapsed: false,
        fullscreenChart: null,

        // Actions
        setActiveReport: (reportType: ReportType) => {
          set({ activeReport: reportType }, false, 'setActiveReport');
        },

        clearActiveReport: () => {
          set({ activeReport: null }, false, 'clearActiveReport');
        },

        setReportData: (reportType: string, data: ReportData) => {
          set(
            (state) => ({
              reportData: {
                ...state.reportData,
                [reportType]: data,
              },
              loading: {
                ...state.loading,
                [reportType]: false,
              },
              errors: {
                ...state.errors,
                [reportType]: null,
              },
            }),
            false,
            'setReportData'
          );
        },

        setLoading: (reportType: string, loading: boolean) => {
          set(
            (state) => ({
              loading: {
                ...state.loading,
                [reportType]: loading,
              },
              // Clear error when starting to load
              errors: loading
                ? { ...state.errors, [reportType]: null }
                : state.errors,
            }),
            false,
            'setLoading'
          );
        },

        setError: (reportType: string, error: string | null) => {
          set(
            (state) => ({
              errors: {
                ...state.errors,
                [reportType]: error,
              },
              loading: {
                ...state.loading,
                [reportType]: false,
              },
            }),
            false,
            'setError'
          );
        },

        clearReportData: (reportType: string) => {
          set(
            (state) => {
              const newReportData = { ...state.reportData };
              const newLoading = { ...state.loading };
              const newErrors = { ...state.errors };

              delete newReportData[reportType];
              delete newLoading[reportType];
              delete newErrors[reportType];

              return {
                reportData: newReportData,
                loading: newLoading,
                errors: newErrors,
              };
            },
            false,
            'clearReportData'
          );
        },

        addToHistory: (reportType: ReportType, filters: ReportFilters) => {
          set(
            (state) => {
              const newHistoryItem = {
                reportType,
                filters,
                timestamp: new Date(),
                id: `${reportType}-${Date.now()}`,
              };

              // Remove duplicate entries and limit history to 50 items
              const filteredHistory = state.reportHistory.filter(
                (item) =>
                  !(
                    item.reportType === reportType &&
                    JSON.stringify(item.filters) === JSON.stringify(filters)
                  )
              );

              return {
                reportHistory: [newHistoryItem, ...filteredHistory].slice(
                  0,
                  50
                ),
              };
            },
            false,
            'addToHistory'
          );
        },

        clearHistory: () => {
          set({ reportHistory: [] }, false, 'clearHistory');
        },

        setSidebarCollapsed: (collapsed: boolean) => {
          set({ sidebarCollapsed: collapsed }, false, 'setSidebarCollapsed');
        },

        setFullscreenChart: (chartId: string | null) => {
          set({ fullscreenChart: chartId }, false, 'setFullscreenChart');
        },

        generateReport: async (reportType: ReportType, filters?: ReportFilters) => {
          const state = get();
          
          try {
            // Set loading state
            state.setLoading(reportType, true);
            state.setError(reportType, null);

            // Create compatible filters for the service
            const serviceFilters = filters ? {
              dateRange: filters.dateRange ? {
                startDate: filters.dateRange.startDate,
                endDate: filters.dateRange.endDate,
                preset: filters.dateRange.preset === 'custom' ? undefined : filters.dateRange.preset as '7d' | '30d' | '90d' | '1y' | undefined
              } : undefined,
              patientId: filters.patientId,
              pharmacistId: filters.pharmacistId,
              therapyType: filters.therapyType,
              priority: filters.priority,
              location: filters.location,
              status: filters.status,
            } : undefined;

            // Generate report using real API

            const reportData = await reportsService.generateReport(reportType, serviceFilters);

            // Store the report data as-is since ReportDisplay expects the original format
            const transformedData = reportData;

            // Store the generated report data
            state.setReportData(reportType, transformedData);


          } catch (error: any) {
            console.error('❌ Error generating report from API:', error);
            
            let errorMessage = 'Failed to generate report';
            if (error.response) {
              errorMessage = `API Error ${error.response.status}: ${error.response.data?.message || error.response.statusText}`;
            } else if (error.request) {
              errorMessage = 'Network error: Unable to reach the server. Please check if the backend is running.';
            } else {
              errorMessage = error.message || 'Unknown error occurred';
            }
            
            state.setError(reportType, errorMessage);
          } finally {
            state.setLoading(reportType, false);
          }
        },

        clearAllLoadingStates: () => {
          set({ loading: {}, errors: {} }, false, 'clearAllLoadingStates');
        },

        resetStore: () => {
          set({
            activeReport: null,
            reportData: {},
            loading: {},
            errors: {},
            sidebarCollapsed: false,
            fullscreenChart: null,
          }, false, 'resetStore');
        },

        // Computed getters
        getCurrentReportData: () => {
          const state = get();
          return state.activeReport
            ? state.reportData[state.activeReport] || null
            : null;
        },

        isCurrentReportLoading: () => {
          const state = get();
          return state.activeReport
            ? state.loading[state.activeReport] || false
            : false;
        },

        getCurrentReportError: () => {
          const state = get();
          return state.activeReport
            ? state.errors[state.activeReport] || null
            : null;
        },

        getRecentReports: (limit: number = 10) => {
          const state = get();
          return state.reportHistory.slice(0, limit);
        },
      }),
      {
        name: 'reports-store',
        partialize: (state) => ({
          // Only persist certain parts of the state - NOT loading states
          reportHistory: state.reportHistory,
          sidebarCollapsed: state.sidebarCollapsed,
          // Don't persist activeReport to avoid auto-loading on page refresh
        }),
      }
    ),
    { name: 'ReportsStore' }
  )
);

// Selectors for better performance
export const useActiveReport = () =>
  useReportsStore((state) => state.activeReport);
export const useCurrentReportData = () =>
  useReportsStore((state) => state.getCurrentReportData());
export const useCurrentReportLoading = () =>
  useReportsStore((state) => state.isCurrentReportLoading());
export const useCurrentReportError = () =>
  useReportsStore((state) => state.getCurrentReportError());
export const useReportHistory = () =>
  useReportsStore((state) => state.reportHistory);
export const useSidebarCollapsed = () =>
  useReportsStore((state) => state.sidebarCollapsed);
export const useFullscreenChart = () =>
  useReportsStore((state) => state.fullscreenChart);
