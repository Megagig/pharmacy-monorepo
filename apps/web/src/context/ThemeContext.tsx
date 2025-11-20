import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';

type ThemeMode = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  isDark: boolean;
  isLight: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Helper function to get system theme preference
const getSystemTheme = (): ResolvedTheme => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
};

// Helper function to apply theme to DOM
const applyThemeToDOM = (theme: ResolvedTheme) => {
  const root = document.documentElement;

  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  root.setAttribute('data-theme', theme);
};

// Helper function to resolve theme
const resolveTheme = (
  theme: ThemeMode,
  systemTheme: ResolvedTheme
): ResolvedTheme => {
  if (theme === 'system') {
    return systemTheme;
  }
  return theme as ResolvedTheme;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      const stored = localStorage.getItem('theme-preference');
      return (stored as ThemeMode) || 'system';
    } catch {
      return 'system';
    }
  });

  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);
  const resolvedTheme = resolveTheme(theme, systemTheme);

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem('theme-preference', newTheme);
    } catch (error) {
      console.warn('Failed to save theme preference:', error);
    }
  };

  const toggleTheme = () => {
    const newTheme =
      theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    setTheme(newTheme);
  };

  // Apply theme to DOM
  useEffect(() => {
    applyThemeToDOM(resolvedTheme);
  }, [resolvedTheme]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    // Use modern addEventListener if available, otherwise fallback to deprecated method
    try {
      mediaQuery.addEventListener('change', handleChange);
      return () => {
        try {
          mediaQuery.removeEventListener('change', handleChange);
        } catch {
          // Ignore cleanup errors
        }
      };
    } catch {
      // Fallback for older browsers that don't support addEventListener
      // @ts-ignore - Using deprecated API as fallback
      mediaQuery.addListener(handleChange);
      return () => {
        try {
          // @ts-expect-error - Using deprecated API as fallback
          mediaQuery.removeListener(handleChange);
        } catch {
          // Ignore cleanup errors
        }
      };
    }
  }, []);

  const value: ThemeContextType = {
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
    isDark: resolvedTheme === 'dark',
    isLight: resolvedTheme === 'light',
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useThemeContext = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
};
