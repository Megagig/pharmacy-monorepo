/**
 * Responsive Design Utilities
 * Helper functions and hooks for managing responsive layouts
 */

import { useTheme, useMediaQuery, Theme } from '@mui/material';
import { Breakpoint } from '@mui/system';

/**
 * Hook to check if screen is a specific breakpoint or larger
 */
export const useBreakpoint = (breakpoint: Breakpoint): boolean => {
    const theme = useTheme();
    return useMediaQuery(theme.breakpoints.up(breakpoint));
};

/**
 * Hook to check if screen is mobile (smaller than md breakpoint)
 */
export const useIsMobile = (): boolean => {
    const theme = useTheme();
    return useMediaQuery(theme.breakpoints.down('md'));
};

/**
 * Hook to check if screen is tablet (between sm and md)
 */
export const useIsTablet = (): boolean => {
    const theme = useTheme();
    return useMediaQuery(theme.breakpoints.between('sm', 'md'));
};

/**
 * Hook to check if screen is desktop (md and larger)
 */
export const useIsDesktop = (): boolean => {
    const theme = useTheme();
    return useMediaQuery(theme.breakpoints.up('md'));
};

/**
 * Hook to get current breakpoint name
 */
export const useCurrentBreakpoint = (): Breakpoint => {
    const theme = useTheme();
    const isXs = useMediaQuery(theme.breakpoints.only('xs'));
    const isSm = useMediaQuery(theme.breakpoints.only('sm'));
    const isMd = useMediaQuery(theme.breakpoints.only('md'));
    const isLg = useMediaQuery(theme.breakpoints.only('lg'));

    if (isXs) return 'xs';
    if (isSm) return 'sm';
    if (isMd) return 'md';
    if (isLg) return 'lg';
    return 'xl';
};

/**
 * Responsive spacing helper
 * Returns spacing values that scale with screen size
 */
export const getResponsiveSpacing = (theme: Theme) => ({
    xs: theme.spacing(1),
    sm: theme.spacing(2),
    md: theme.spacing(3),
    lg: theme.spacing(4),
    xl: theme.spacing(6),
});

/**
 * Responsive font sizes
 */
export const getResponsiveFontSize = (
    baseSize: number,
    breakpoint: Breakpoint
): string => {
    const multipliers: Record<Breakpoint, number> = {
        xs: 0.875,
        sm: 0.9375,
        md: 1,
        lg: 1.125,
        xl: 1.25,
    };

    return `${baseSize * multipliers[breakpoint]}rem`;
};

/**
 * Helper to create responsive grid columns
 */
export const getResponsiveGridColumns = (
    mobile: number = 1,
    tablet: number = 2,
    desktop: number = 3,
    largeDesktop: number = 4
) => ({
    xs: mobile,
    sm: tablet,
    md: desktop,
    lg: largeDesktop,
    xl: largeDesktop,
});

/**
 * Helper for responsive container widths
 */
export const getResponsiveContainerWidth = (theme: Theme) => ({
    xs: '100%',
    sm: theme.breakpoints.values.sm,
    md: theme.breakpoints.values.md,
    lg: theme.breakpoints.values.lg,
    xl: theme.breakpoints.values.xl,
});

/**
 * Helper for conditional responsive values
 */
export const responsiveValue = <T,>(
    values: Partial<Record<Breakpoint, T>>
): Record<Breakpoint, T | undefined> => {
    return {
        xs: values.xs,
        sm: values.sm ?? values.xs,
        md: values.md ?? values.sm ?? values.xs,
        lg: values.lg ?? values.md ?? values.sm ?? values.xs,
        xl: values.xl ?? values.lg ?? values.md ?? values.sm ?? values.xs,
    };
};

/**
 * Hook to detect touch device
 */
export const useIsTouchDevice = (): boolean => {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

/**
 * Hook to detect device orientation
 */
export const useDeviceOrientation = (): 'portrait' | 'landscape' => {
    const isPortrait = useMediaQuery('(orientation: portrait)');
    return isPortrait ? 'portrait' : 'landscape';
};

/**
 * Responsive padding helper for cards and containers
 */
export const getResponsivePadding = (theme: Theme) => ({
    xs: theme.spacing(2),
    sm: theme.spacing(3),
    md: theme.spacing(4),
    lg: theme.spacing(5),
});

/**
 * Helper to hide content on specific breakpoints
 */
export const getDisplayOnBreakpoint = (
    showOnBreakpoints: Breakpoint[]
): Record<Breakpoint, 'none' | 'block'> => {
    const display: Record<Breakpoint, 'none' | 'block'> = {
        xs: 'none',
        sm: 'none',
        md: 'none',
        lg: 'none',
        xl: 'none',
    };

    showOnBreakpoints.forEach((bp) => {
        display[bp] = 'block';
    });

    return display;
};

/**
 * Responsive table settings
 */
export const getResponsiveTableSettings = (isMobile: boolean) => ({
    density: isMobile ? 'compact' : 'standard',
    pageSize: isMobile ? 5 : 10,
    rowsPerPageOptions: isMobile ? [5, 10] : [10, 25, 50],
});

/**
 * Responsive chart dimensions
 */
export const getResponsiveChartDimensions = (
    isMobile: boolean,
    isTablet: boolean
) => {
    if (isMobile) {
        return { width: '100%', height: 250 };
    }
    if (isTablet) {
        return { width: '100%', height: 300 };
    }
    return { width: '100%', height: 400 };
};

/**
 * Helper for responsive modal width
 */
export const getResponsiveModalWidth = (
    _theme: Theme,
    size: 'sm' | 'md' | 'lg' = 'md'
) => {
    const sizes = {
        sm: { xs: '90%', sm: 400, md: 500 },
        md: { xs: '90%', sm: 500, md: 600, lg: 700 },
        lg: { xs: '95%', sm: 600, md: 800, lg: 900 },
    };

    return sizes[size];
};

/**
 * Helper for responsive z-index management
 */
export const zIndex = {
    mobileStepper: 1000,
    fab: 1050,
    speedDial: 1050,
    appBar: 1100,
    drawer: 1200,
    modal: 1300,
    snackbar: 1400,
    tooltip: 1500,
};

/**
 * Responsive image sizing
 */
export const getResponsiveImageSize = (
    isMobile: boolean,
    isTablet: boolean
) => {
    if (isMobile) {
        return { width: '100%', maxHeight: 200 };
    }
    if (isTablet) {
        return { width: '100%', maxHeight: 300 };
    }
    return { width: '100%', maxHeight: 400 };
};
