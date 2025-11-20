// Charts Store - State management for chart configurations and themes
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { ChartTheme, ChartConfig, ChartData } from '../types/charts';
import { DEFAULT_THEMES } from '../utils/colorPalettes';

interface ChartsState {
    // Theme management
    currentTheme: ChartTheme;
    availableThemes: Record<string, ChartTheme>;

    // Chart configurations
    chartConfigs: Record<string, ChartConfig>;

    // Chart data cache
    chartDataCache: Record<string, ChartData>;

    // UI state
    chartInteractions: Record<string, {
        hovered: boolean;
        selected: boolean;
        zoomed: boolean;
        lastInteraction: Date;
    }>;

    // Performance settings
    animationsEnabled: boolean;
    highPerformanceMode: boolean;

    // Actions
    setTheme: (theme: ChartTheme) => void;
    setThemeByName: (themeName: string) => void;
    addCustomTheme: (name: string, theme: ChartTheme) => void;
    setChartConfig: (chartId: string, config: ChartConfig) => void;
    updateChartConfig: (chartId: string, updates: Partial<ChartConfig>) => void;
    cacheChartData: (chartId: string, data: ChartData) => void;
    clearChartCache: (chartId?: string) => void;
    setChartInteraction: (chartId: string, interaction: Partial<ChartsState['chartInteractions'][string]>) => void;
    setAnimationsEnabled: (enabled: boolean) => void;
    setHighPerformanceMode: (enabled: boolean) => void;

    // Computed getters
    getChartConfig: (chartId: string) => ChartConfig | null;
    getCachedChartData: (chartId: string) => ChartData | null;
    getChartInteraction: (chartId: string) => ChartsState['chartInteractions'][string] | null;
}

export const useChartsStore = create<ChartsState>()(
    devtools(
        persist(
            (set, get) => ({
                // Initial state
                currentTheme: DEFAULT_THEMES.light,
                availableThemes: DEFAULT_THEMES,
                chartConfigs: {},
                chartDataCache: {},
                chartInteractions: {},
                animationsEnabled: true,
                highPerformanceMode: false,

                // Actions
                setTheme: (theme: ChartTheme) => {
                    set({ currentTheme: theme }, false, 'setTheme');
                },

                setThemeByName: (themeName: string) => {
                    const state = get();
                    const theme = state.availableThemes[themeName];
                    if (theme) {
                        set({ currentTheme: theme }, false, 'setThemeByName');
                    }
                },

                addCustomTheme: (name: string, theme: ChartTheme) => {
                    set(
                        (state) => ({
                            availableThemes: {
                                ...state.availableThemes,
                                [name]: theme,
                            },
                        }),
                        false,
                        'addCustomTheme'
                    );
                },

                setChartConfig: (chartId: string, config: ChartConfig) => {
                    set(
                        (state) => ({
                            chartConfigs: {
                                ...state.chartConfigs,
                                [chartId]: config,
                            },
                        }),
                        false,
                        'setChartConfig'
                    );
                },

                updateChartConfig: (chartId: string, updates: Partial<ChartConfig>) => {
                    set(
                        (state) => {
                            const existingConfig = state.chartConfigs[chartId];
                            if (!existingConfig) return state;

                            return {
                                chartConfigs: {
                                    ...state.chartConfigs,
                                    [chartId]: {
                                        ...existingConfig,
                                        ...updates,
                                    },
                                },
                            };
                        },
                        false,
                        'updateChartConfig'
                    );
                },

                cacheChartData: (chartId: string, data: ChartData) => {
                    set(
                        (state) => ({
                            chartDataCache: {
                                ...state.chartDataCache,
                                [chartId]: data,
                            },
                        }),
                        false,
                        'cacheChartData'
                    );
                },

                clearChartCache: (chartId?: string) => {
                    if (chartId) {
                        set(
                            (state) => {
                                const newCache = { ...state.chartDataCache };
                                delete newCache[chartId];
                                return { chartDataCache: newCache };
                            },
                            false,
                            'clearChartCache'
                        );
                    } else {
                        set({ chartDataCache: {} }, false, 'clearChartCache');
                    }
                },

                setChartInteraction: (chartId: string, interaction: Partial<ChartsState['chartInteractions'][string]>) => {
                    set(
                        (state) => ({
                            chartInteractions: {
                                ...state.chartInteractions,
                                [chartId]: {
                                    hovered: false,
                                    selected: false,
                                    zoomed: false,
                                    lastInteraction: new Date(),
                                    ...state.chartInteractions[chartId],
                                    ...interaction,
                                },
                            },
                        }),
                        false,
                        'setChartInteraction'
                    );
                },

                setAnimationsEnabled: (enabled: boolean) => {
                    set({ animationsEnabled: enabled }, false, 'setAnimationsEnabled');
                },

                setHighPerformanceMode: (enabled: boolean) => {
                    set({
                        highPerformanceMode: enabled,
                        // Disable animations in high performance mode
                        animationsEnabled: enabled ? false : get().animationsEnabled,
                    }, false, 'setHighPerformanceMode');
                },

                // Computed getters
                getChartConfig: (chartId: string) => {
                    const state = get();
                    return state.chartConfigs[chartId] || null;
                },

                getCachedChartData: (chartId: string) => {
                    const state = get();
                    return state.chartDataCache[chartId] || null;
                },

                getChartInteraction: (chartId: string) => {
                    const state = get();
                    return state.chartInteractions[chartId] || null;
                },
            }),
            {
                name: 'charts-store',
                partialize: (state) => ({
                    // Persist theme and performance settings
                    currentTheme: state.currentTheme,
                    availableThemes: state.availableThemes,
                    animationsEnabled: state.animationsEnabled,
                    highPerformanceMode: state.highPerformanceMode,
                }),
            }
        ),
        { name: 'ChartsStore' }
    )
);

// Selectors for better performance
export const useCurrentTheme = () => useChartsStore((state) => state.currentTheme);
export const useAvailableThemes = () => useChartsStore((state) => state.availableThemes);
export const useAnimationsEnabled = () => useChartsStore((state) => state.animationsEnabled);
export const useHighPerformanceMode = () => useChartsStore((state) => state.highPerformanceMode);

export const useChartConfig = (chartId: string) =>
    useChartsStore((state) => state.getChartConfig(chartId));

export const useCachedChartData = (chartId: string) =>
    useChartsStore((state) => state.getCachedChartData(chartId));

export const useChartInteraction = (chartId: string) =>
    useChartsStore((state) => state.getChartInteraction(chartId));