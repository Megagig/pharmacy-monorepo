import { createTheme, Theme } from '@mui/material/styles';

// Create a dynamic theme function that accepts mode
export const createAppTheme = (mode: 'light' | 'dark'): Theme => {
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: '#0891b2', // Healthcare Cyan-600
        light: '#06b6d4', // Cyan-500
        dark: '#0e7490', // Cyan-700
        contrastText: '#ffffff',
      },
      secondary: {
        main: '#0284c7', // Healthcare Blue-600
        light: '#0ea5e9', // Sky-500
        dark: '#075985', // Sky-700
        contrastText: '#ffffff',
      },
      success: {
        main: '#10b981',
        light: '#34d399',
        dark: '#047857',
      },
      warning: {
        main: '#f59e0b',
        light: '#fbbf24',
        dark: '#d97706',
      },
      error: {
        main: '#ef4444',
        light: '#f87171',
        dark: '#dc2626',
      },
      background: {
        default: isDark ? '#0f172a' : '#f8fafc', // Dark slate-900 or light gray-50
        paper: isDark ? '#1e293b' : '#ffffff', // Dark slate-800 or white
      },
      text: {
        primary: isDark ? '#f1f5f9' : '#1f2937', // Light slate-100 or dark gray-800
        secondary: isDark ? '#cbd5e1' : '#6b7280', // Light slate-300 or gray-500
      },
      grey: {
        50: '#f9fafb',
        100: '#f3f4f6',
        200: '#e5e7eb',
        300: '#d1d5db',
        400: '#9ca3af',
        500: '#6b7280',
        600: '#4b5563',
        700: '#374151',
        800: '#1f2937',
        900: '#111827',
      },
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h1: {
        fontSize: '2.5rem',
        fontWeight: 700,
        lineHeight: 1.2,
      },
      h2: {
        fontSize: '2rem',
        fontWeight: 600,
        lineHeight: 1.3,
      },
      h3: {
        fontSize: '1.75rem',
        fontWeight: 600,
        lineHeight: 1.3,
      },
      h4: {
        fontSize: '1.5rem',
        fontWeight: 600,
        lineHeight: 1.4,
      },
      h5: {
        fontSize: '1.25rem',
        fontWeight: 600,
        lineHeight: 1.4,
      },
      h6: {
        fontSize: '1.125rem',
        fontWeight: 600,
        lineHeight: 1.4,
      },
      body1: {
        fontSize: '1rem',
        lineHeight: 1.5,
      },
      body2: {
        fontSize: '0.875rem',
        lineHeight: 1.5,
      },
      button: {
        textTransform: 'none',
        fontWeight: 500,
      },
    },
    shape: {
      borderRadius: 12,
    },
    spacing: 8,
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            padding: '10px 24px',
            boxShadow: 'none',
            '&:hover': {
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.15)',
            },
          },
          contained: {
            '&:hover': {
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            boxShadow:
              '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
          },
          elevation1: {
            boxShadow:
              '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
          },
          elevation2: {
            boxShadow:
              '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            boxShadow: isDark
              ? '0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px 0 rgba(0, 0, 0, 0.2)'
              : '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
            border: isDark ? '1px solid #334155' : '1px solid #e5e7eb',
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 12,
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 20,
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            color: isDark ? '#f1f5f9' : '#1f2937',
            boxShadow: isDark
              ? '0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px 0 rgba(0, 0, 0, 0.2)'
              : '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
          },
        },
      },
    },
  });
};

// Export the default light theme for backward compatibility
export const theme = createAppTheme('light');
