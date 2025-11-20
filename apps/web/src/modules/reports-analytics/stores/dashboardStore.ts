// Dashboard Store - Main state management for dashboard UI and navigation
import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { ReportType } from '../types/reports';

interface BreadcrumbItem {
    label: string;
    path?: string;
    icon?: React.ReactNode;
}

interface QuickAccessItem {
    id: string;
    reportType: ReportType;
    label: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    lastAccessed: Date;
    accessCount: number;
}

interface DashboardLayout {
    gridColumns: number;
    cardSize: 'small' | 'medium' | 'large';
    showDescriptions: boolean;
    showCategories: boolean;
    sortBy: 'name' | 'category' | 'recent' | 'popular';
    sortOrder: 'asc' | 'desc';
}

interface DashboardState {
    // Navigation state
    currentPath: string;
    breadcrumbs: BreadcrumbItem[];
    navigationHistory: string[];

    // UI state
    searchQuery: string;
    selectedCategory: string;
    layout: DashboardLayout;
    sidebarCollapsed: boolean;
    fullscreenMode: boolean;

    // Quick access and favorites
    quickAccessItems: QuickAccessItem[];
    favoriteReports: ReportType[];
    recentlyViewed: Array<{
        reportType: ReportType;
        timestamp: Date;
        filters?: any;
    }>;

    // Performance and caching
    lastRefresh: Date | null;
    autoRefreshEnabled: boolean;
    autoRefreshInterval: number; // in seconds

    // Error handling and recovery
    errorState: {
        hasError: boolean;
        errorMessage: string | null;
        errorCode: string | null;
        retryCount: number;
    };

    // Cross-tab synchronization
    tabId: string;
    lastActivity: Date;

    // Actions
    setCurrentPath: (path: string) => void;
    setBreadcrumbs: (breadcrumbs: BreadcrumbItem[]) => void;
    addToNavigationHistory: (path: string) => void;
    clearNavigationHistory: () => void;

    setSearchQuery: (query: string) => void;
    setSelectedCategory: (category: string) => void;
    updateLayout: (layout: Partial<DashboardLayout>) => void;
    setSidebarCollapsed: (collapsed: boolean) => void;
    setFullscreenMode: (fullscreen: boolean) => void;

    addQuickAccessItem: (item: Omit<QuickAccessItem, 'id' | 'lastAccessed' | 'accessCount'>) => void;
    removeQuickAccessItem: (id: string) => void;
    updateQuickAccessItem: (id: string, updates: Partial<QuickAccessItem>) => void;
    incrementAccessCount: (reportType: ReportType) => void;

    addToFavorites: (reportType: ReportType) => void;
    removeFromFavorites: (reportType: ReportType) => void;
    toggleFavorite: (reportType: ReportType) => void;

    addToRecentlyViewed: (reportType: ReportType, filters?: any) => void;
    clearRecentlyViewed: () => void;

    setLastRefresh: (date: Date) => void;
    setAutoRefresh: (enabled: boolean, interval?: number) => void;

    setError: (error: { message: string; code?: string }) => void;
    clearError: () => void;
    incrementRetryCount: () => void;
    resetRetryCount: () => void;

    updateActivity: () => void;
    syncWithOtherTabs: () => void;

    // Computed getters
    getQuickAccessByPopularity: () => QuickAccessItem[];
    getRecentReports: (limit?: number) => Array<{
        reportType: ReportType;
        timestamp: Date;
        filters?: any;
    }>;
    isFavorite: (reportType: ReportType) => boolean;
    canRetry: () => boolean;

    // State recovery
    saveStateSnapshot: () => void;
    restoreFromSnapshot: () => void;
    resetToDefaults: () => void;
}

const DEFAULT_LAYOUT: DashboardLayout = {
    gridColumns: 3,
    cardSize: 'medium',
    showDescriptions: true,
    showCategories: true,
    sortBy: 'category',
    sortOrder: 'asc',
};

const generateTabId = () => `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const useDashboardStore = create<DashboardState>()(
    devtools(
        subscribeWithSelector(
            persist(
                (set, get) => ({
                    // Initial state
                    currentPath: '/reports-analytics',
                    breadcrumbs: [
                        { label: 'Dashboard', path: '/dashboard' },
                        { label: 'Reports & Analytics' },
                    ],
                    navigationHistory: [],

                    searchQuery: '',
                    selectedCategory: 'all',
                    layout: DEFAULT_LAYOUT,
                    sidebarCollapsed: false,
                    fullscreenMode: false,

                    quickAccessItems: [],
                    favoriteReports: [],
                    recentlyViewed: [],

                    lastRefresh: null,
                    autoRefreshEnabled: false,
                    autoRefreshInterval: 300, // 5 minutes

                    errorState: {
                        hasError: false,
                        errorMessage: null,
                        errorCode: null,
                        retryCount: 0,
                    },

                    tabId: generateTabId(),
                    lastActivity: new Date(),

                    // Actions
                    setCurrentPath: (path: string) => {
                        set({ currentPath: path }, false, 'setCurrentPath');
                        get().updateActivity();
                    },

                    setBreadcrumbs: (breadcrumbs: BreadcrumbItem[]) => {
                        set({ breadcrumbs }, false, 'setBreadcrumbs');
                    },

                    addToNavigationHistory: (path: string) => {
                        set(
                            (state) => {
                                const newHistory = [path, ...state.navigationHistory.filter(p => p !== path)].slice(0, 20);
                                return { navigationHistory: newHistory };
                            },
                            false,
                            'addToNavigationHistory'
                        );
                    },

                    clearNavigationHistory: () => {
                        set({ navigationHistory: [] }, false, 'clearNavigationHistory');
                    },

                    setSearchQuery: (query: string) => {
                        set({ searchQuery: query }, false, 'setSearchQuery');
                        get().updateActivity();
                    },

                    setSelectedCategory: (category: string) => {
                        set({ selectedCategory: category }, false, 'setSelectedCategory');
                        get().updateActivity();
                    },

                    updateLayout: (layoutUpdates: Partial<DashboardLayout>) => {
                        set(
                            (state) => ({
                                layout: { ...state.layout, ...layoutUpdates },
                            }),
                            false,
                            'updateLayout'
                        );
                    },

                    setSidebarCollapsed: (collapsed: boolean) => {
                        set({ sidebarCollapsed: collapsed }, false, 'setSidebarCollapsed');
                    },

                    setFullscreenMode: (fullscreen: boolean) => {
                        set({ fullscreenMode: fullscreen }, false, 'setFullscreenMode');
                    },

                    addQuickAccessItem: (item: Omit<QuickAccessItem, 'id' | 'lastAccessed' | 'accessCount'>) => {
                        const newItem: QuickAccessItem = {
                            ...item,
                            id: `quick-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            lastAccessed: new Date(),
                            accessCount: 1,
                        };

                        set(
                            (state) => ({
                                quickAccessItems: [...state.quickAccessItems, newItem].slice(0, 10), // Limit to 10 items
                            }),
                            false,
                            'addQuickAccessItem'
                        );
                    },

                    removeQuickAccessItem: (id: string) => {
                        set(
                            (state) => ({
                                quickAccessItems: state.quickAccessItems.filter(item => item.id !== id),
                            }),
                            false,
                            'removeQuickAccessItem'
                        );
                    },

                    updateQuickAccessItem: (id: string, updates: Partial<QuickAccessItem>) => {
                        set(
                            (state) => ({
                                quickAccessItems: state.quickAccessItems.map(item =>
                                    item.id === id ? { ...item, ...updates } : item
                                ),
                            }),
                            false,
                            'updateQuickAccessItem'
                        );
                    },

                    incrementAccessCount: (reportType: ReportType) => {
                        set(
                            (state) => ({
                                quickAccessItems: state.quickAccessItems.map(item =>
                                    item.reportType === reportType
                                        ? { ...item, accessCount: item.accessCount + 1, lastAccessed: new Date() }
                                        : item
                                ),
                            }),
                            false,
                            'incrementAccessCount'
                        );
                    },

                    addToFavorites: (reportType: ReportType) => {
                        set(
                            (state) => ({
                                favoriteReports: state.favoriteReports.includes(reportType)
                                    ? state.favoriteReports
                                    : [...state.favoriteReports, reportType],
                            }),
                            false,
                            'addToFavorites'
                        );
                    },

                    removeFromFavorites: (reportType: ReportType) => {
                        set(
                            (state) => ({
                                favoriteReports: state.favoriteReports.filter(fav => fav !== reportType),
                            }),
                            false,
                            'removeFromFavorites'
                        );
                    },

                    toggleFavorite: (reportType: ReportType) => {
                        const state = get();
                        if (state.favoriteReports.includes(reportType)) {
                            state.removeFromFavorites(reportType);
                        } else {
                            state.addToFavorites(reportType);
                        }
                    },

                    addToRecentlyViewed: (reportType: ReportType, filters?: any) => {
                        const newItem = {
                            reportType,
                            timestamp: new Date(),
                            filters,
                        };

                        set(
                            (state) => {
                                // Remove existing entry for this report type
                                const filtered = state.recentlyViewed.filter(item => item.reportType !== reportType);
                                return {
                                    recentlyViewed: [newItem, ...filtered].slice(0, 20), // Limit to 20 items
                                };
                            },
                            false,
                            'addToRecentlyViewed'
                        );
                    },

                    clearRecentlyViewed: () => {
                        set({ recentlyViewed: [] }, false, 'clearRecentlyViewed');
                    },

                    setLastRefresh: (date: Date) => {
                        set({ lastRefresh: date }, false, 'setLastRefresh');
                    },

                    setAutoRefresh: (enabled: boolean, interval?: number) => {
                        set(
                            (state) => ({
                                autoRefreshEnabled: enabled,
                                autoRefreshInterval: interval || state.autoRefreshInterval,
                            }),
                            false,
                            'setAutoRefresh'
                        );
                    },

                    setError: (error: { message: string; code?: string }) => {
                        set(
                            {
                                errorState: {
                                    hasError: true,
                                    errorMessage: error.message,
                                    errorCode: error.code || null,
                                    retryCount: 0,
                                },
                            },
                            false,
                            'setError'
                        );
                    },

                    clearError: () => {
                        set(
                            {
                                errorState: {
                                    hasError: false,
                                    errorMessage: null,
                                    errorCode: null,
                                    retryCount: 0,
                                },
                            },
                            false,
                            'clearError'
                        );
                    },

                    incrementRetryCount: () => {
                        set(
                            (state) => ({
                                errorState: {
                                    ...state.errorState,
                                    retryCount: state.errorState.retryCount + 1,
                                },
                            }),
                            false,
                            'incrementRetryCount'
                        );
                    },

                    resetRetryCount: () => {
                        set(
                            (state) => ({
                                errorState: {
                                    ...state.errorState,
                                    retryCount: 0,
                                },
                            }),
                            false,
                            'resetRetryCount'
                        );
                    },

                    updateActivity: () => {
                        set({ lastActivity: new Date() }, false, 'updateActivity');
                    },

                    syncWithOtherTabs: () => {
                        // This would be implemented with BroadcastChannel API
                        // For now, just update activity
                        get().updateActivity();
                    },

                    // Computed getters
                    getQuickAccessByPopularity: () => {
                        const state = get();
                        return [...state.quickAccessItems].sort((a, b) => b.accessCount - a.accessCount);
                    },

                    getRecentReports: (limit: number = 10) => {
                        const state = get();
                        return state.recentlyViewed.slice(0, limit);
                    },

                    isFavorite: (reportType: ReportType) => {
                        const state = get();
                        return state.favoriteReports.includes(reportType);
                    },

                    canRetry: () => {
                        const state = get();
                        return state.errorState.hasError && state.errorState.retryCount < 3;
                    },

                    // State recovery
                    saveStateSnapshot: () => {
                        const state = get();
                        const snapshot = {
                            searchQuery: state.searchQuery,
                            selectedCategory: state.selectedCategory,
                            layout: state.layout,
                            favoriteReports: state.favoriteReports,
                            recentlyViewed: state.recentlyViewed.slice(0, 5), // Save only recent 5
                        };
                        localStorage.setItem('dashboard-snapshot', JSON.stringify(snapshot));
                    },

                    restoreFromSnapshot: () => {
                        try {
                            const snapshot = localStorage.getItem('dashboard-snapshot');
                            if (snapshot) {
                                const parsed = JSON.parse(snapshot);
                                set(
                                    (state) => ({
                                        ...state,
                                        ...parsed,
                                        errorState: {
                                            hasError: false,
                                            errorMessage: null,
                                            errorCode: null,
                                            retryCount: 0,
                                        },
                                    }),
                                    false,
                                    'restoreFromSnapshot'
                                );
                            }
                        } catch (error) {
                            console.warn('Failed to restore dashboard state from snapshot:', error);
                        }
                    },

                    resetToDefaults: () => {
                        set(
                            {
                                searchQuery: '',
                                selectedCategory: 'all',
                                layout: DEFAULT_LAYOUT,
                                favoriteReports: [],
                                recentlyViewed: [],
                                errorState: {
                                    hasError: false,
                                    errorMessage: null,
                                    errorCode: null,
                                    retryCount: 0,
                                },
                            },
                            false,
                            'resetToDefaults'
                        );
                    },
                }),
                {
                    name: 'dashboard-store',
                    partialize: (state) => ({
                        // Persist important state across sessions
                        searchQuery: state.searchQuery,
                        selectedCategory: state.selectedCategory,
                        layout: state.layout,
                        sidebarCollapsed: state.sidebarCollapsed,
                        favoriteReports: state.favoriteReports,
                        recentlyViewed: state.recentlyViewed,
                        quickAccessItems: state.quickAccessItems,
                        autoRefreshEnabled: state.autoRefreshEnabled,
                        autoRefreshInterval: state.autoRefreshInterval,
                    }),
                    // Custom storage with error handling
                    storage: {
                        getItem: (name) => {
                            try {
                                const item = localStorage.getItem(name);
                                return item ? JSON.parse(item) : null;
                            } catch (error) {
                                console.warn(`Failed to parse stored state for ${name}:`, error);
                                return null;
                            }
                        },
                        setItem: (name, value) => {
                            try {
                                localStorage.setItem(name, JSON.stringify(value));
                            } catch (error) {
                                console.warn(`Failed to store state for ${name}:`, error);
                            }
                        },
                        removeItem: (name) => {
                            try {
                                localStorage.removeItem(name);
                            } catch (error) {
                                console.warn(`Failed to remove stored state for ${name}:`, error);
                            }
                        },
                    },
                }
            )
        ),
        { name: 'DashboardStore' }
    )
);

// Selectors for better performance and easier usage
export const useDashboardNavigation = () => useDashboardStore((state) => ({
    currentPath: state.currentPath,
    breadcrumbs: state.breadcrumbs,
    navigationHistory: state.navigationHistory,
    setCurrentPath: state.setCurrentPath,
    setBreadcrumbs: state.setBreadcrumbs,
    addToNavigationHistory: state.addToNavigationHistory,
}));

export const useDashboardUI = () => useDashboardStore((state) => ({
    searchQuery: state.searchQuery,
    selectedCategory: state.selectedCategory,
    layout: state.layout,
    sidebarCollapsed: state.sidebarCollapsed,
    fullscreenMode: state.fullscreenMode,
    setSearchQuery: state.setSearchQuery,
    setSelectedCategory: state.setSelectedCategory,
    updateLayout: state.updateLayout,
    setSidebarCollapsed: state.setSidebarCollapsed,
    setFullscreenMode: state.setFullscreenMode,
}));

export const useDashboardFavorites = () => useDashboardStore((state) => ({
    favoriteReports: state.favoriteReports,
    addToFavorites: state.addToFavorites,
    removeFromFavorites: state.removeFromFavorites,
    toggleFavorite: state.toggleFavorite,
    isFavorite: state.isFavorite,
}));

export const useDashboardRecents = () => useDashboardStore((state) => ({
    recentlyViewed: state.recentlyViewed,
    addToRecentlyViewed: state.addToRecentlyViewed,
    clearRecentlyViewed: state.clearRecentlyViewed,
    getRecentReports: state.getRecentReports,
}));

export const useDashboardError = () => useDashboardStore((state) => ({
    errorState: state.errorState,
    setError: state.setError,
    clearError: state.clearError,
    canRetry: state.canRetry,
    incrementRetryCount: state.incrementRetryCount,
}));

// Auto-save state snapshot every 30 seconds
if (typeof window !== 'undefined') {
    setInterval(() => {
        useDashboardStore.getState().saveStateSnapshot();
    }, 30000);
}

// Cross-tab synchronization using BroadcastChannel
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    const channel = new BroadcastChannel('dashboard-sync');

    // Listen for state changes from other tabs
    channel.addEventListener('message', (event) => {
        if (event.data.type === 'state-sync') {
            const currentState = useDashboardStore.getState();
            if (event.data.tabId !== currentState.tabId) {
                // Merge relevant state from other tabs
                useDashboardStore.setState({
                    favoriteReports: event.data.favoriteReports || currentState.favoriteReports,
                    recentlyViewed: event.data.recentlyViewed || currentState.recentlyViewed,
                });
            }
        }
    });

    // Subscribe to state changes and broadcast to other tabs
    useDashboardStore.subscribe(
        (state) => ({
            favoriteReports: state.favoriteReports,
            recentlyViewed: state.recentlyViewed,
            tabId: state.tabId,
        }),
        (current, previous) => {
            if (
                current.favoriteReports !== previous.favoriteReports ||
                current.recentlyViewed !== previous.recentlyViewed
            ) {
                channel.postMessage({
                    type: 'state-sync',
                    tabId: current.tabId,
                    favoriteReports: current.favoriteReports,
                    recentlyViewed: current.recentlyViewed,
                });
            }
        }
    );
}