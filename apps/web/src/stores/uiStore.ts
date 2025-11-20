import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UIState, Notification } from './types';

interface UIStore extends UIState {
  // Notification actions
  addNotification: (
    notification: Omit<Notification, 'id' | 'timestamp' | 'read'>
  ) => void;
  removeNotification: (id: string) => void;
  markNotificationAsRead: (id: string) => void;
  clearAllNotifications: () => void;

  // Modal actions
  openModal: (modalKey: string) => void;
  closeModal: (modalKey: string) => void;
  toggleModal: (modalKey: string) => void;
  closeAllModals: () => void;

  // Loading state actions
  setLoading: (loading: boolean) => void;

  // Sidebar actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

// Create the main UI store with persistence
export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      // Initial state
      loading: false,
      notifications: [],
      modals: {},
      sidebarOpen: true,

      // Notification actions
      addNotification: (notification) => {
        const id =
          Date.now().toString() + Math.random().toString(36).substr(2, 9);
        const newNotification: Notification = {
          ...notification,
          id,
          timestamp: Date.now(),
          read: false,
        };

        set((state) => ({
          notifications: [newNotification, ...state.notifications],
        }));

        // Auto-remove notification if duration is specified
        if (notification.duration) {
          setTimeout(() => {
            get().removeNotification(id);
          }, notification.duration);
        }
      },

      removeNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        })),

      markNotificationAsRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        })),

      clearAllNotifications: () => set({ notifications: [] }),

      // Modal actions
      openModal: (modalKey) =>
        set((state) => ({
          modals: { ...state.modals, [modalKey]: true },
        })),

      closeModal: (modalKey) =>
        set((state) => ({
          modals: { ...state.modals, [modalKey]: false },
        })),

      toggleModal: (modalKey) =>
        set((state) => ({
          modals: { ...state.modals, [modalKey]: !state.modals[modalKey] },
        })),

      closeAllModals: () => set({ modals: {} }),

      // Loading state actions
      setLoading: (loading) => set({ loading }),

      // Sidebar actions
      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      setSidebarOpen: (open) => set({ sidebarOpen: open }),
    }),
    {
      name: 'ui-store',
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
);

// Utility hooks for easier access to specific UI states
export const useNotifications = () =>
  useUIStore((state) => ({
    notifications: state.notifications,
    addNotification: state.addNotification,
    removeNotification: state.removeNotification,
    markNotificationAsRead: state.markNotificationAsRead,
    clearAllNotifications: state.clearAllNotifications,
  }));

export const useModals = () =>
  useUIStore((state) => ({
    modals: state.modals,
    openModal: state.openModal,
    closeModal: state.closeModal,
    toggleModal: state.toggleModal,
    closeAllModals: state.closeAllModals,
  }));

export const useLoading = () =>
  useUIStore((state) => ({
    loading: state.loading,
    setLoading: state.setLoading,
  }));

export const useSidebar = () =>
  useUIStore((state) => ({
    sidebarOpen: state.sidebarOpen,
    toggleSidebar: state.toggleSidebar,
    setSidebarOpen: state.setSidebarOpen,
  }));
