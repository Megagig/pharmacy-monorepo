// Sidebar specific UI hooks
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Define the sidebar state interface
interface SidebarState {
  sidebarOpen: boolean;
  setSidebarOpen: (isOpen: boolean) => void;
  toggleSidebar: () => void;
}

// Create a dedicated store for sidebar controls
export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      sidebarOpen: false,
      setSidebarOpen: (isOpen: boolean) => set({ sidebarOpen: isOpen }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    }),
    {
      name: 'sidebar-storage',
    }
  )
);

// Create sidebar specific hooks for easier consumption
export const useSidebarControls = () => {
  const sidebarOpen = useSidebarStore((state) => state.sidebarOpen);
  const toggleSidebar = useSidebarStore((state) => state.toggleSidebar);
  const setSidebarOpen = useSidebarStore((state) => state.setSidebarOpen);

  return {
    sidebarOpen,
    toggleSidebar,
    setSidebarOpen,
  };
};
