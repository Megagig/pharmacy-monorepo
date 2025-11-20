import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ThemeMode, ResolvedTheme } from './types';

interface ThemePerformanceMetrics {
  duration: number;
  timestamp: number;
  method: 'toggle' | 'set' | 'initialize';
  success: boolean;
}

interface ThemeStore {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  systemTheme: ResolvedTheme;
  isInitialized: boolean;
  performanceMetrics: ThemePerformanceMetrics[];

  // Actions
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  initializeTheme: () => void;
  updateSystemTheme: (systemTheme: ResolvedTheme) => void;

  // Performance monitoring
  getAverageToggleTime: () => number;
  getLastToggleTime: () => number | null;
  clearPerformanceMetrics: () => void;

  // Sync with backend for authenticated users
  syncThemeWithBackend: () => Promise<void>;
  updateUserThemePreference: (theme: ThemeMode) => Promise<void>;
}

// Helper function to get system theme preference
const getSystemTheme = (): ResolvedTheme => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
};

// Helper function to apply theme to DOM with performance optimization
const applyThemeToDOM = (theme: ResolvedTheme, enableTransitions: boolean = true): number => {
  const startTime = performance.now();
  
  try {
    const root = document.documentElement;
    
    // Disable transitions temporarily for instant switching
    if (!enableTransitions) {
      root.classList.add('theme-transitioning');
    }
    
    // Synchronous DOM manipulation for sub-16ms performance
    if (theme === 'dark') {
      root.classList.remove('light');
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
    
    // Set data attribute for CSS usage
    root.setAttribute('data-theme', theme);
    
    // Set CSS custom property for immediate availability
    root.style.setProperty('--theme-mode', theme);
    
    // Re-enable transitions after a frame
    if (!enableTransitions) {
      requestAnimationFrame(() => {
        root.classList.remove('theme-transitioning');
        root.classList.add('theme-transition-enabled');
      });
    }
    
    const endTime = performance.now();
    return endTime - startTime;
    
  } catch (error) {
    console.error('Error applying theme to DOM:', error);
    const endTime = performance.now();
    return endTime - startTime;
  }
};

// Helper function to resolve theme based on current settings
const resolveTheme = (
  theme: ThemeMode,
  systemTheme: ResolvedTheme
): ResolvedTheme => {
  if (theme === 'system') {
    return systemTheme;
  }
  return theme as ResolvedTheme;
};

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: 'system',
      resolvedTheme: 'light',
      systemTheme: 'light',
      isInitialized: false,
      performanceMetrics: [],

      setTheme: (theme: ThemeMode) => {
        const startTime = performance.now();
        
        try {
          const { systemTheme } = get();
          const resolvedTheme = resolveTheme(theme, systemTheme);

          // Apply theme to DOM synchronously for performance
          const domDuration = applyThemeToDOM(resolvedTheme, false);
          
          // Update store state
          set({ theme, resolvedTheme });

          const endTime = performance.now();
          const totalDuration = endTime - startTime;
          
          // Record performance metrics
          const metric: ThemePerformanceMetrics = {
            duration: totalDuration,
            timestamp: Date.now(),
            method: 'set',
            success: true
          };
          
          set(state => ({
            performanceMetrics: [...state.performanceMetrics.slice(-9), metric] // Keep last 10 metrics
          }));
          
          // Log performance warning if over 16ms
          if (totalDuration > 16) {
            console.warn(`Theme change took ${totalDuration.toFixed(2)}ms (target: <16ms)`);
          }

          // Sync with backend asynchronously (non-blocking)
          setTimeout(() => get().updateUserThemePreference(theme), 0);
          
        } catch (error) {
          console.error('Error in setTheme:', error);
          const endTime = performance.now();
          const totalDuration = endTime - startTime;
          
          const metric: ThemePerformanceMetrics = {
            duration: totalDuration,
            timestamp: Date.now(),
            method: 'set',
            success: false
          };
          
          set(state => ({
            performanceMetrics: [...state.performanceMetrics.slice(-9), metric]
          }));
        }
      },

      toggleTheme: () => {
        const startTime = performance.now();
        
        try {
          const { theme, systemTheme } = get();
          let newTheme: ThemeMode;

          // Optimized theme cycling logic
          switch (theme) {
            case 'light':
              newTheme = 'dark';
              break;
            case 'dark':
              newTheme = 'system';
              break;
            default:
              newTheme = 'light';
              break;
          }

          const resolvedTheme = resolveTheme(newTheme, systemTheme);
          
          // Apply theme to DOM synchronously for performance
          const domDuration = applyThemeToDOM(resolvedTheme, false);
          
          // Update store state
          set({ theme: newTheme, resolvedTheme });

          const endTime = performance.now();
          const totalDuration = endTime - startTime;
          
          // Record performance metrics
          const metric: ThemePerformanceMetrics = {
            duration: totalDuration,
            timestamp: Date.now(),
            method: 'toggle',
            success: true
          };
          
          set(state => ({
            performanceMetrics: [...state.performanceMetrics.slice(-9), metric]
          }));
          
          // Log performance warning if over 16ms
          if (totalDuration > 16) {
            console.warn(`Theme toggle took ${totalDuration.toFixed(2)}ms (target: <16ms)`);
          } else if (import.meta.env.DEV) {
          }

          // Sync with backend asynchronously (non-blocking)
          setTimeout(() => get().updateUserThemePreference(newTheme), 0);
          
        } catch (error) {
          console.error('Error in toggleTheme:', error);
          const endTime = performance.now();
          const totalDuration = endTime - startTime;
          
          const metric: ThemePerformanceMetrics = {
            duration: totalDuration,
            timestamp: Date.now(),
            method: 'toggle',
            success: false
          };
          
          set(state => ({
            performanceMetrics: [...state.performanceMetrics.slice(-9), metric]
          }));
        }
      },

      initializeTheme: () => {
        const startTime = performance.now();
        
        try {
          // Check if theme was already applied by inline script
          const initialTheme = (window as any).__INITIAL_THEME__;
          
          let theme = get().theme;
          let systemTheme = getSystemTheme();
          let resolvedTheme = resolveTheme(theme, systemTheme);
          
          // Sync with inline script if available
          if (initialTheme) {
            if (initialTheme.stored) {
              theme = initialTheme.stored;
            }
            resolvedTheme = initialTheme.resolved;
            systemTheme = initialTheme.system;
          }

          set({
            theme,
            systemTheme,
            resolvedTheme,
            isInitialized: true,
          });

          // Only apply to DOM if not already applied by inline script
          if (!initialTheme) {
            applyThemeToDOM(resolvedTheme, true);
          }

          const endTime = performance.now();
          const totalDuration = endTime - startTime;
          
          // Record performance metrics
          const metric: ThemePerformanceMetrics = {
            duration: totalDuration,
            timestamp: Date.now(),
            method: 'initialize',
            success: true
          };
          
          set(state => ({
            performanceMetrics: [...state.performanceMetrics.slice(-9), metric]
          }));

          // Listen for system theme changes
          if (typeof window !== 'undefined') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

            const handleSystemThemeChange = (e: MediaQueryListEvent) => {
              const newSystemTheme = e.matches ? 'dark' : 'light';
              get().updateSystemTheme(newSystemTheme);
            };

            // Use addEventListener for modern browsers
            if (mediaQuery.addEventListener) {
              mediaQuery.addEventListener('change', handleSystemThemeChange);
            } else {
              // Fallback for older browsers
              mediaQuery.addListener(handleSystemThemeChange);
            }
          }
          
        } catch (error) {
          console.error('Error in initializeTheme:', error);
          const endTime = performance.now();
          const totalDuration = endTime - startTime;
          
          const metric: ThemePerformanceMetrics = {
            duration: totalDuration,
            timestamp: Date.now(),
            method: 'initialize',
            success: false
          };
          
          set(state => ({
            performanceMetrics: [...state.performanceMetrics.slice(-9), metric]
          }));
        }
      },

      updateSystemTheme: (systemTheme: ResolvedTheme) => {
        const { theme } = get();
        const resolvedTheme = resolveTheme(theme, systemTheme);

        set({ systemTheme, resolvedTheme });

        // Only apply to DOM if current theme is 'system'
        if (theme === 'system') {
          applyThemeToDOM(resolvedTheme, true);
        }
      },

      // Performance monitoring methods
      getAverageToggleTime: () => {
        const { performanceMetrics } = get();
        const toggleMetrics = performanceMetrics.filter(m => m.method === 'toggle' && m.success);
        
        if (toggleMetrics.length === 0) return 0;
        
        const totalTime = toggleMetrics.reduce((sum, metric) => sum + metric.duration, 0);
        return totalTime / toggleMetrics.length;
      },

      getLastToggleTime: () => {
        const { performanceMetrics } = get();
        const toggleMetrics = performanceMetrics.filter(m => m.method === 'toggle' && m.success);
        
        if (toggleMetrics.length === 0) return null;
        
        return toggleMetrics[toggleMetrics.length - 1].duration;
      },

      clearPerformanceMetrics: () => {
        set({ performanceMetrics: [] });
      },

      syncThemeWithBackend: async () => {
        // This will be implemented when we add the API endpoint
        // For now, just return a resolved promise
        return Promise.resolve();
      },

      updateUserThemePreference: async (theme: ThemeMode) => {
        try {
          // Get current user from auth context/localStorage
          const authData = localStorage.getItem('auth-storage');
          if (!authData) return;

          const { state } = JSON.parse(authData);
          if (!state?.user?.id || !state?.token) return;

          // Make API call to update user theme preference
          const response = await fetch('/api/auth/theme', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${state.token}`,
            },
            body: JSON.stringify({ themePreference: theme }),
          });

          if (!response.ok) {
            console.warn('Failed to sync theme preference with backend');
          }
        } catch (error) {
          console.warn('Error syncing theme preference:', error);
        }
      },
    }),
    {
      name: 'theme-storage',
      partialize: (state) => ({
        theme: state.theme,
      }),
    }
  )
);

// Custom hook for easier theme access with performance monitoring
export const useTheme = () => {
  const store = useThemeStore();

  return {
    theme: store.theme,
    resolvedTheme: store.resolvedTheme,
    systemTheme: store.systemTheme,
    isInitialized: store.isInitialized,
    performanceMetrics: store.performanceMetrics,
    
    // Actions
    setTheme: store.setTheme,
    toggleTheme: store.toggleTheme,
    initializeTheme: store.initializeTheme,
    
    // Performance monitoring
    getAverageToggleTime: store.getAverageToggleTime,
    getLastToggleTime: store.getLastToggleTime,
    clearPerformanceMetrics: store.clearPerformanceMetrics,
    
    // Computed properties
    isDark: store.resolvedTheme === 'dark',
    isLight: store.resolvedTheme === 'light',
    isSystem: store.theme === 'system',
    
    // Performance validation
    isPerformanceOptimal: () => {
      const avgTime = store.getAverageToggleTime();
      return avgTime > 0 && avgTime < 16;
    },
    
    // Get performance report
    getPerformanceReport: () => {
      const metrics = store.performanceMetrics;
      const toggleMetrics = metrics.filter(m => m.method === 'toggle' && m.success);
      
      if (toggleMetrics.length === 0) {
        return {
          averageTime: 0,
          lastTime: null,
          totalToggles: 0,
          optimalPerformance: false,
          slowToggles: 0
        };
      }
      
      const averageTime = toggleMetrics.reduce((sum, m) => sum + m.duration, 0) / toggleMetrics.length;
      const lastTime = toggleMetrics[toggleMetrics.length - 1].duration;
      const slowToggles = toggleMetrics.filter(m => m.duration > 16).length;
      
      return {
        averageTime,
        lastTime,
        totalToggles: toggleMetrics.length,
        optimalPerformance: averageTime < 16,
        slowToggles
      };
    }
  };
};
