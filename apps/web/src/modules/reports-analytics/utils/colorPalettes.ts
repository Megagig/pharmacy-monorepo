// Color Palettes and Theming System
import { ChartTheme, GradientConfig } from '../types/charts';

/**
 * Beautiful color palettes for charts
 */
export const COLOR_PALETTES = {
    // Professional palettes
    corporate: [
        '#2563eb', // Blue-600
        '#10b981', // Green-500
        '#f59e0b', // Yellow-500
        '#ef4444', // Red-500
        '#8b5cf6', // Purple-500
        '#06b6d4', // Cyan-500
        '#f97316', // Orange-500
        '#84cc16', // Lime-500
    ],

    // Vibrant palettes
    vibrant: [
        '#3b82f6', // Blue-500
        '#22c55e', // Green-500
        '#eab308', // Yellow-500
        '#f43f5e', // Rose-500
        '#a855f7', // Purple-500
        '#0ea5e9', // Sky-500
        '#fb923c', // Orange-400
        '#a3e635', // Lime-400
    ],

    // Pastel palettes
    pastel: [
        '#93c5fd', // Blue-300
        '#86efac', // Green-300
        '#fde047', // Yellow-300
        '#fca5a5', // Red-300
        '#c4b5fd', // Purple-300
        '#7dd3fc', // Sky-300
        '#fdba74', // Orange-300
        '#bef264', // Lime-300
    ],

    // Monochromatic palettes
    blues: [
        '#1e3a8a', // Blue-900
        '#1e40af', // Blue-800
        '#1d4ed8', // Blue-700
        '#2563eb', // Blue-600
        '#3b82f6', // Blue-500
        '#60a5fa', // Blue-400
        '#93c5fd', // Blue-300
        '#dbeafe', // Blue-200
    ],

    greens: [
        '#14532d', // Green-900
        '#166534', // Green-800
        '#15803d', // Green-700
        '#16a34a', // Green-600
        '#22c55e', // Green-500
        '#4ade80', // Green-400
        '#86efac', // Green-300
        '#bbf7d0', // Green-200
    ],

    // Healthcare-specific palette
    healthcare: [
        '#0ea5e9', // Medical blue
        '#22c55e', // Health green
        '#f59e0b', // Warning amber
        '#ef4444', // Alert red
        '#8b5cf6', // Therapy purple
        '#06b6d4', // Diagnostic cyan
        '#f97316', // Medication orange
        '#84cc16', // Wellness lime
    ],

    // Accessibility-friendly palette (colorblind safe)
    accessible: [
        '#1f77b4', // Blue
        '#ff7f0e', // Orange
        '#2ca02c', // Green
        '#d62728', // Red
        '#9467bd', // Purple
        '#8c564b', // Brown
        '#e377c2', // Pink
        '#7f7f7f', // Gray
    ],

    // Dark mode palette
    dark: [
        '#60a5fa', // Blue-400
        '#34d399', // Green-400
        '#fbbf24', // Yellow-400
        '#f87171', // Red-400
        '#a78bfa', // Purple-400
        '#38bdf8', // Sky-400
        '#fb923c', // Orange-400
        '#a3e635', // Lime-400
    ],
};

/**
 * Gradient configurations for enhanced visuals
 */
export const GRADIENT_CONFIGS: Record<string, GradientConfig> = {
    blueGradient: {
        type: 'linear',
        direction: 45,
        stops: [
            { offset: 0, color: '#3b82f6', opacity: 0.8 },
            { offset: 1, color: '#1e40af', opacity: 0.4 },
        ],
    },

    greenGradient: {
        type: 'linear',
        direction: 45,
        stops: [
            { offset: 0, color: '#22c55e', opacity: 0.8 },
            { offset: 1, color: '#15803d', opacity: 0.4 },
        ],
    },

    purpleGradient: {
        type: 'linear',
        direction: 45,
        stops: [
            { offset: 0, color: '#a855f7', opacity: 0.8 },
            { offset: 1, color: '#7c3aed', opacity: 0.4 },
        ],
    },

    sunsetGradient: {
        type: 'linear',
        direction: 90,
        stops: [
            { offset: 0, color: '#f59e0b', opacity: 0.9 },
            { offset: 0.5, color: '#f97316', opacity: 0.7 },
            { offset: 1, color: '#ef4444', opacity: 0.5 },
        ],
    },

    oceanGradient: {
        type: 'linear',
        direction: 180,
        stops: [
            { offset: 0, color: '#0ea5e9', opacity: 0.9 },
            { offset: 0.5, color: '#06b6d4', opacity: 0.7 },
            { offset: 1, color: '#10b981', opacity: 0.5 },
        ],
    },

    radialGlow: {
        type: 'radial',
        stops: [
            { offset: 0, color: '#ffffff', opacity: 0.9 },
            { offset: 0.7, color: '#3b82f6', opacity: 0.6 },
            { offset: 1, color: '#1e40af', opacity: 0.3 },
        ],
    },
};

/**
 * Create chart themes with beautiful styling
 */
export const createChartTheme = (
    mode: 'light' | 'dark',
    palette: keyof typeof COLOR_PALETTES = 'corporate'
): ChartTheme => {
    const isDark = mode === 'dark';
    const colors = COLOR_PALETTES[palette];

    return {
        name: `${palette}-${mode}`,
        mode,
        colorPalette: colors,
        gradients: Object.values(GRADIENT_CONFIGS),
        typography: {
            fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
            fontSize: {
                small: 11,
                medium: 13,
                large: 16,
                xlarge: 20,
            },
            fontWeight: {
                light: 300,
                normal: 400,
                medium: 500,
                bold: 600,
            },
        },
        spacing: {
            xs: 4,
            sm: 8,
            md: 16,
            lg: 24,
            xl: 32,
        },
        borderRadius: 8,
        shadows: {
            small: isDark
                ? '0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px 0 rgba(0, 0, 0, 0.2)'
                : '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
            medium: isDark
                ? '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)'
                : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            large: isDark
                ? '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)'
                : '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        },
    };
};

/**
 * Get color by index with automatic cycling
 */
export const getColorByIndex = (
    index: number,
    palette: keyof typeof COLOR_PALETTES = 'corporate'
): string => {
    const colors = COLOR_PALETTES[palette];
    return colors[index % colors.length];
};

/**
 * Generate color variations (lighter/darker)
 */
export const generateColorVariations = (
    baseColor: string,
    steps: number = 5
): string[] => {
    // This is a simplified version - in a real implementation,
    // you might want to use a color manipulation library like chroma.js
    const variations: string[] = [];

    // Convert hex to RGB for manipulation
    const hex = baseColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    for (let i = 0; i < steps; i++) {
        const factor = 0.2 + (i * 0.6) / (steps - 1); // 0.2 to 0.8
        const newR = Math.round(r * factor + 255 * (1 - factor));
        const newG = Math.round(g * factor + 255 * (1 - factor));
        const newB = Math.round(b * factor + 255 * (1 - factor));

        const newHex = `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
        variations.push(newHex);
    }

    return variations;
};

/**
 * Get semantic colors for different data states
 */
export const getSemanticColors = (mode: 'light' | 'dark' = 'light') => {
    return {
        success: mode === 'dark' ? '#34d399' : '#10b981',
        warning: mode === 'dark' ? '#fbbf24' : '#f59e0b',
        error: mode === 'dark' ? '#f87171' : '#ef4444',
        info: mode === 'dark' ? '#60a5fa' : '#3b82f6',
        neutral: mode === 'dark' ? '#9ca3af' : '#6b7280',
        primary: mode === 'dark' ? '#60a5fa' : '#2563eb',
        secondary: mode === 'dark' ? '#34d399' : '#10b981',
    };
};

/**
 * Create gradient CSS string
 */
export const createGradientCSS = (gradient: GradientConfig): string => {
    const { type, stops, direction = 0 } = gradient;

    const stopStrings = stops.map(stop =>
        `${stop.color}${stop.opacity ? ` ${Math.round(stop.opacity * 100)}%` : ''} ${Math.round(stop.offset * 100)}%`
    ).join(', ');

    if (type === 'radial') {
        return `radial-gradient(circle, ${stopStrings})`;
    } else {
        return `linear-gradient(${direction}deg, ${stopStrings})`;
    }
};

/**
 * Get contrasting text color for background
 */
export const getContrastingTextColor = (backgroundColor: string): string => {
    // Convert hex to RGB
    const hex = backgroundColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // Return black or white based on luminance
    return luminance > 0.5 ? '#000000' : '#ffffff';
};

/**
 * Default chart themes
 */
export const DEFAULT_THEMES = {
    light: createChartTheme('light', 'corporate'),
    dark: createChartTheme('dark', 'dark'),
    healthcare: createChartTheme('light', 'healthcare'),
    accessible: createChartTheme('light', 'accessible'),
    vibrant: createChartTheme('light', 'vibrant'),
    pastel: createChartTheme('light', 'pastel'),
};