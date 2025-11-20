import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LoadingState {
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

export const useLoadingStore = create<LoadingState>()(
  persist(
    (set) => ({
      loading: false,
      setLoading: (loading: boolean) => set({ loading }),
    }),
    {
      name: 'loading-storage',
    }
  )
);

export const useAppLoading = () => {
  const loading = useLoadingStore((state) => state.loading);
  const setLoading = useLoadingStore((state) => state.setLoading);

  return {
    loading,
    setLoading,
    isLoading: loading,
  };
};
