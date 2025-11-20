// Exports Store - State management for report exports and scheduling
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { ExportJob, ExportResult, ReportSchedule, ExportFormat } from '../types/exports';

interface ExportsState {
    // Export jobs
    exportJobs: Record<string, ExportJob>;

    // Export results
    exportResults: Record<string, ExportResult>;

    // Scheduled reports
    schedules: Record<string, ReportSchedule>;

    // UI state
    exportDialogOpen: boolean;
    scheduleDialogOpen: boolean;
    selectedExportFormat: ExportFormat;

    // Actions
    addExportJob: (job: ExportJob) => void;
    updateExportJob: (jobId: string, updates: Partial<ExportJob>) => void;
    removeExportJob: (jobId: string) => void;
    addExportResult: (result: ExportResult) => void;
    removeExportResult: (resultId: string) => void;
    addSchedule: (schedule: ReportSchedule) => void;
    updateSchedule: (scheduleId: string, updates: Partial<ReportSchedule>) => void;
    removeSchedule: (scheduleId: string) => void;
    setExportDialogOpen: (open: boolean) => void;
    setScheduleDialogOpen: (open: boolean) => void;
    setSelectedExportFormat: (format: ExportFormat) => void;

    // Computed getters
    getActiveExportJobs: () => ExportJob[];
    getCompletedExportJobs: () => ExportJob[];
    getActiveSchedules: () => ReportSchedule[];
    getRecentExportResults: (limit?: number) => ExportResult[];
}

export const useExportsStore = create<ExportsState>()(
    devtools(
        (set, get) => ({
            // Initial state
            exportJobs: {},
            exportResults: {},
            schedules: {},
            exportDialogOpen: false,
            scheduleDialogOpen: false,
            selectedExportFormat: 'pdf',

            // Actions
            addExportJob: (job: ExportJob) => {
                set(
                    (state) => ({
                        exportJobs: {
                            ...state.exportJobs,
                            [job.id]: job,
                        },
                    }),
                    false,
                    'addExportJob'
                );
            },

            updateExportJob: (jobId: string, updates: Partial<ExportJob>) => {
                set(
                    (state) => {
                        const existingJob = state.exportJobs[jobId];
                        if (!existingJob) return state;

                        return {
                            exportJobs: {
                                ...state.exportJobs,
                                [jobId]: {
                                    ...existingJob,
                                    ...updates,
                                },
                            },
                        };
                    },
                    false,
                    'updateExportJob'
                );
            },

            removeExportJob: (jobId: string) => {
                set(
                    (state) => {
                        const newJobs = { ...state.exportJobs };
                        delete newJobs[jobId];
                        return { exportJobs: newJobs };
                    },
                    false,
                    'removeExportJob'
                );
            },

            addExportResult: (result: ExportResult) => {
                set(
                    (state) => ({
                        exportResults: {
                            ...state.exportResults,
                            [result.id]: result,
                        },
                    }),
                    false,
                    'addExportResult'
                );
            },

            removeExportResult: (resultId: string) => {
                set(
                    (state) => {
                        const newResults = { ...state.exportResults };
                        delete newResults[resultId];
                        return { exportResults: newResults };
                    },
                    false,
                    'removeExportResult'
                );
            },

            addSchedule: (schedule: ReportSchedule) => {
                set(
                    (state) => ({
                        schedules: {
                            ...state.schedules,
                            [schedule.id]: schedule,
                        },
                    }),
                    false,
                    'addSchedule'
                );
            },

            updateSchedule: (scheduleId: string, updates: Partial<ReportSchedule>) => {
                set(
                    (state) => {
                        const existingSchedule = state.schedules[scheduleId];
                        if (!existingSchedule) return state;

                        return {
                            schedules: {
                                ...state.schedules,
                                [scheduleId]: {
                                    ...existingSchedule,
                                    ...updates,
                                },
                            },
                        };
                    },
                    false,
                    'updateSchedule'
                );
            },

            removeSchedule: (scheduleId: string) => {
                set(
                    (state) => {
                        const newSchedules = { ...state.schedules };
                        delete newSchedules[scheduleId];
                        return { schedules: newSchedules };
                    },
                    false,
                    'removeSchedule'
                );
            },

            setExportDialogOpen: (open: boolean) => {
                set({ exportDialogOpen: open }, false, 'setExportDialogOpen');
            },

            setScheduleDialogOpen: (open: boolean) => {
                set({ scheduleDialogOpen: open }, false, 'setScheduleDialogOpen');
            },

            setSelectedExportFormat: (format: ExportFormat) => {
                set({ selectedExportFormat: format }, false, 'setSelectedExportFormat');
            },

            // Computed getters
            getActiveExportJobs: () => {
                const state = get();
                return Object.values(state.exportJobs).filter(
                    job => job.status === 'queued' || job.status === 'processing'
                );
            },

            getCompletedExportJobs: () => {
                const state = get();
                return Object.values(state.exportJobs).filter(
                    job => job.status === 'completed' || job.status === 'failed'
                );
            },

            getActiveSchedules: () => {
                const state = get();
                return Object.values(state.schedules).filter(schedule => schedule.isActive);
            },

            getRecentExportResults: (limit: number = 10) => {
                const state = get();
                return Object.values(state.exportResults)
                    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
                    .slice(0, limit);
            },
        }),
        { name: 'ExportsStore' }
    )
);

// Selectors for better performance
export const useExportJobs = () => useExportsStore((state) => state.exportJobs);
export const useActiveExportJobs = () => useExportsStore((state) => state.getActiveExportJobs());
export const useExportResults = () => useExportsStore((state) => state.exportResults);
export const useSchedules = () => useExportsStore((state) => state.schedules);
export const useActiveSchedules = () => useExportsStore((state) => state.getActiveSchedules());
export const useExportDialogOpen = () => useExportsStore((state) => state.exportDialogOpen);
export const useScheduleDialogOpen = () => useExportsStore((state) => state.scheduleDialogOpen);
export const useSelectedExportFormat = () => useExportsStore((state) => state.selectedExportFormat);