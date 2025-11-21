/**
 * UI State Store
 * Zustand store for UI-specific state (not server state)
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
    // Theme
    theme: 'light' | 'dark' | 'system';
    setTheme: (theme: 'light' | 'dark' | 'system') => void;

    // Sidebar
    sidebarOpen: boolean;
    toggleSidebar: () => void;
    setSidebarOpen: (open: boolean) => void;

    // Mobile menu
    mobileMenuOpen: boolean;
    toggleMobileMenu: () => void;
    setMobileMenuOpen: (open: boolean) => void;

    // Notifications panel
    notificationsPanelOpen: boolean;
    toggleNotificationsPanel: () => void;
    setNotificationsPanelOpen: (open: boolean) => void;

    // Loading states
    globalLoading: boolean;
    setGlobalLoading: (loading: boolean) => void;

    // Modal state
    activeModal: string | null;
    openModal: (modalId: string) => void;
    closeModal: () => void;
}

export const useUIStore = create<UIState>()(
    persist(
        (set) => ({
            // Theme
            theme: 'system',
            setTheme: (theme) => set({ theme }),

            // Sidebar
            sidebarOpen: true,
            toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
            setSidebarOpen: (open) => set({ sidebarOpen: open }),

            // Mobile menu
            mobileMenuOpen: false,
            toggleMobileMenu: () => set((state) => ({ mobileMenuOpen: !state.mobileMenuOpen })),
            setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),

            // Notifications panel
            notificationsPanelOpen: false,
            toggleNotificationsPanel: () =>
                set((state) => ({ notificationsPanelOpen: !state.notificationsPanelOpen })),
            setNotificationsPanelOpen: (open) => set({ notificationsPanelOpen: open }),

            // Loading states
            globalLoading: false,
            setGlobalLoading: (loading) => set({ globalLoading: loading }),

            // Modal state
            activeModal: null,
            openModal: (modalId) => set({ activeModal: modalId }),
            closeModal: () => set({ activeModal: null }),
        }),
        {
            name: 'pharmacy-ui-state',
            partialize: (state) => ({
                theme: state.theme,
                sidebarOpen: state.sidebarOpen,
            }),
        }
    )
);
