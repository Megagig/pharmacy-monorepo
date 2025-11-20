// Filters Store - State management for report filters
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { ReportFilters, FilterPreset, FilterDefinition } from '../types/filters';
import { ReportType } from '../types/reports';
import { createDateRangeFromPreset, validateFilters, resetFilters } from '../utils/filterHelpers';

interface FiltersState {
    // Current filters by report type
    filters: Record<string, ReportFilters>;

    // Filter presets
    presets: FilterPreset[];

    // Filter definitions by report type
    definitions: Record<string, FilterDefinition[]>;

    // UI state
    panelOpen: boolean;
    activePreset: string | null;

    // Validation state
    validationErrors: Record<string, Record<string, string>>;

    // Actions
    setFilters: (reportType: string, filters: ReportFilters) => void;
    updateFilter: (reportType: string, key: string, value: any) => void;
    resetFilters: (reportType: string) => void;
    applyPreset: (reportType: string, presetId: string) => void;
    savePreset: (preset: Omit<FilterPreset, 'id' | 'createdAt'>) => void;
    deletePreset: (presetId: string) => void;
    setFilterDefinitions: (reportType: string, definitions: FilterDefinition[]) => void;
    setPanelOpen: (open: boolean) => void;
    setActivePreset: (presetId: string | null) => void;
    validateCurrentFilters: (reportType: string) => boolean;

    // Computed getters
    getFilters: (reportType: string) => ReportFilters;
    getValidationErrors: (reportType: string) => Record<string, string>;
    getPresetsForReport: (reportType: string) => FilterPreset[];
    hasUnsavedChanges: (reportType: string) => boolean;
}

const DEFAULT_FILTERS: ReportFilters = {
    dateRange: createDateRangeFromPreset('30d'),
};

export const useFiltersStore = create<FiltersState>()(
    devtools(
        persist(
            (set, get) => ({
                // Initial state
                filters: {},
                presets: [],
                definitions: {},
                panelOpen: false,
                activePreset: null,
                validationErrors: {},

                // Actions
                setFilters: (reportType: string, filters: ReportFilters) => {
                    set(
                        (state) => ({
                            filters: {
                                ...state.filters,
                                [reportType]: filters,
                            },
                            activePreset: null, // Clear active preset when filters change
                        }),
                        false,
                        'setFilters'
                    );

                    // Validate filters after setting
                    get().validateCurrentFilters(reportType);
                },

                updateFilter: (reportType: string, key: string, value: any) => {
                    set(
                        (state) => {
                            const currentFilters = state.filters[reportType] || DEFAULT_FILTERS;
                            const updatedFilters = {
                                ...currentFilters,
                                [key]: value,
                            };

                            return {
                                filters: {
                                    ...state.filters,
                                    [reportType]: updatedFilters,
                                },
                                activePreset: null, // Clear active preset when filters change
                            };
                        },
                        false,
                        'updateFilter'
                    );

                    // Validate filters after update
                    get().validateCurrentFilters(reportType);
                },

                resetFilters: (reportType: string) => {
                    const state = get();
                    const definitions = state.definitions[reportType] || [];
                    const defaultFilters = resetFilters(definitions);

                    set(
                        (state) => ({
                            filters: {
                                ...state.filters,
                                [reportType]: defaultFilters,
                            },
                            activePreset: null,
                            validationErrors: {
                                ...state.validationErrors,
                                [reportType]: {},
                            },
                        }),
                        false,
                        'resetFilters'
                    );
                },

                applyPreset: (reportType: string, presetId: string) => {
                    const state = get();
                    const preset = state.presets.find(p => p.id === presetId);

                    if (preset) {
                        set(
                            (state) => ({
                                filters: {
                                    ...state.filters,
                                    [reportType]: preset.filters,
                                },
                                activePreset: presetId,
                            }),
                            false,
                            'applyPreset'
                        );

                        // Validate filters after applying preset
                        get().validateCurrentFilters(reportType);
                    }
                },

                savePreset: (preset: Omit<FilterPreset, 'id' | 'createdAt'>) => {
                    const newPreset: FilterPreset = {
                        ...preset,
                        id: `preset-${Date.now()}`,
                        createdAt: new Date(),
                    };

                    set(
                        (state) => ({
                            presets: [...state.presets, newPreset],
                        }),
                        false,
                        'savePreset'
                    );
                },

                deletePreset: (presetId: string) => {
                    set(
                        (state) => ({
                            presets: state.presets.filter(p => p.id !== presetId),
                            activePreset: state.activePreset === presetId ? null : state.activePreset,
                        }),
                        false,
                        'deletePreset'
                    );
                },

                setFilterDefinitions: (reportType: string, definitions: FilterDefinition[]) => {
                    set(
                        (state) => ({
                            definitions: {
                                ...state.definitions,
                                [reportType]: definitions,
                            },
                        }),
                        false,
                        'setFilterDefinitions'
                    );
                },

                setPanelOpen: (open: boolean) => {
                    set({ panelOpen: open }, false, 'setPanelOpen');
                },

                setActivePreset: (presetId: string | null) => {
                    set({ activePreset: presetId }, false, 'setActivePreset');
                },

                validateCurrentFilters: (reportType: string) => {
                    const state = get();
                    const filters = state.filters[reportType] || DEFAULT_FILTERS;
                    const definitions = state.definitions[reportType] || [];

                    const validation = validateFilters(filters, definitions);

                    set(
                        (state) => ({
                            validationErrors: {
                                ...state.validationErrors,
                                [reportType]: validation.errors,
                            },
                        }),
                        false,
                        'validateCurrentFilters'
                    );

                    return validation.isValid;
                },

                // Computed getters
                getFilters: (reportType: string) => {
                    const state = get();
                    return state.filters[reportType] || DEFAULT_FILTERS;
                },

                getValidationErrors: (reportType: string) => {
                    const state = get();
                    return state.validationErrors[reportType] || {};
                },

                getPresetsForReport: (reportType: string) => {
                    const state = get();
                    return state.presets.filter(preset =>
                        !preset.tags || preset.tags.includes(reportType)
                    );
                },

                hasUnsavedChanges: (reportType: string) => {
                    const state = get();
                    const currentFilters = state.filters[reportType];
                    const activePreset = state.activePreset;

                    if (!currentFilters || !activePreset) return false;

                    const preset = state.presets.find(p => p.id === activePreset);
                    if (!preset) return false;

                    return JSON.stringify(currentFilters) !== JSON.stringify(preset.filters);
                },
            }),
            {
                name: 'filters-store',
                partialize: (state) => ({
                    // Persist filters and presets
                    filters: state.filters,
                    presets: state.presets,
                    panelOpen: state.panelOpen,
                }),
            }
        ),
        { name: 'FiltersStore' }
    )
);

// Selectors for better performance
export const useCurrentFilters = (reportType: string) =>
    useFiltersStore((state) => state.getFilters(reportType));

export const useFilterValidationErrors = (reportType: string) =>
    useFiltersStore((state) => state.getValidationErrors(reportType));

export const useFilterPresets = (reportType: string) =>
    useFiltersStore((state) => state.getPresetsForReport(reportType));

export const useFilterPanelOpen = () =>
    useFiltersStore((state) => state.panelOpen);

export const useActiveFilterPreset = () =>
    useFiltersStore((state) => state.activePreset);

export const useHasUnsavedFilterChanges = (reportType: string) =>
    useFiltersStore((state) => state.hasUnsavedChanges(reportType));