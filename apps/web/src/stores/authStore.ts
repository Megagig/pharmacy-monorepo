import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  workplaceId: string;
  workplaceRole?: string;
  permissions: string[];
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

interface AuthActions {
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, _get) => ({
      // State
      user: null,
      token: null,
      isAuthenticated: false,
      loading: false,
      error: null,

      // Actions
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setToken: (token) => set({ token }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),

      login: async (email: string, _password: string) => {
        set({ loading: true, error: null });
        try {
          // Mock login implementation - replace with actual API call
          const mockUser: User = {
            _id: '1',
            email,
            firstName: 'John',
            lastName: 'Doe',
            role: 'pharmacist',
            workplaceId: 'workplace-1',
            permissions: ['read', 'write']
          };

          set({
            user: mockUser,
            token: 'mock-token',
            isAuthenticated: true,
            loading: false
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Login failed',
            loading: false
          });
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null
        });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);