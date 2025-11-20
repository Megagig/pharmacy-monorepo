// Chart Helper Functions
import { ChartType, ChartConfig, DataPoint, SeriesConfig, ChartTheme } from '../types/charts';

/**
 * Generate default chart configuration based on chart type
 */
export const generateDefaultChartConfig = (
    type: ChartType,
    theme: ChartTheme
): Partial<ChartConfig> => {
    const baseConfig = {
        theme,
        animations: {
            duration: 300,
            easing: 'ease-in-out' as const,
            stagger: true,
            entrance: 'fade' as const,
        },
        responsive: {
            breakpoints: {
                xs: 480,
                sm: 768,
                md: 1024,
                lg: 1280,
                xl: 1920,
            },
            rules: [],
        },
        interactions: {
            hover: true,
            click: true,
            zoom: false,
            pan: false,
            brush: false,
            crossfilter: false,
        },
    };

    switch (type) {
        case 'line':
        case 'area':
            return {
                ...baseConfig,
                interactions: {
                    ...baseConfig.interactions,
                    zoom: true,
                    pan: true,
                    brush: true,
                },
            };

        case 'bar':
        case 'column':
            return {
                ...baseConfig,
                interactions: {
                    ...baseConfig.interactions,
                    crossfilter: true,
                },
            };

        case 'pie':
        case 'donut':
            return {
                ...baseConfig,
                legend: {
                    enabled: true,
                    position: 'right' as const,
                    alignment: 'center' as const,
                    style: {
                        fontSize: 12,
                        fontWeight: 'normal',
                        color: theme.mode === 'dark' ? '#f1f5f9' : '#1f2937',
                    },
                },
            };

        case 'scatter':
        case 'bubble':
            return {
                ...baseConfig,
                interactions: {
                    ...baseConfig.interactions,
                    zoom: true,
                    pan: true,
                },
            };

        default:
            return baseConfig;
    }
};

/**
 * Transform data for different chart types
 */
export const transformDataForChart = (
    data: DataPoint[],
    type: ChartType,
    series: SeriesConfig[]
): DataPoint[] => {
    if (!data || data.length === 0) return [];

    switch (type) {
        case 'pie':
        case 'donut':
            // For pie charts, ensure we have name and value fields
            return data.map((item, index) => ({
                ...item,
                name: item.name || item.label || `Item ${index + 1}`,
                value: typeof item.value === 'number' ? item.value : 0,
            }));

        case 'treemap':
            // For treemap, ensure hierarchical structure
            return data.map(item => ({
                ...item,
                name: item.name || item.label,
                value: typeof item.value === 'number' ? item.value : 0,
                children: item.children || [],
            }));

        case 'heatmap':
            // For heatmap, ensure x, y, value structure
            return data.map(item => ({
                ...item,
                x: item.x || item.xAxis,
                y: item.y || item.yAxis,
                value: typeof item.value === 'number' ? item.value : 0,
            }));

        default:
            return data;
    }
};

/**
 * Calculate optimal chart dimensions based on container and type
 */
export const calculateChartDimensions = (
    containerWidth: number,
    containerHeight: number,
    type: ChartType,
    hasLegend: boolean = false
): { width: number; height: number } => {
    let width = containerWidth;
    let height = containerHeight;

    // Adjust for legend space
    if (hasLegend) {
        switch (type) {
            case 'pie':
            case 'donut':
                width = Math.max(containerWidth - 200, containerWidth * 0.7);
                break;
            default:
                height = Math.max(containerHeight - 60, containerHeight * 0.85);
        }
    }

    // Ensure minimum dimensions
    width = Math.max(width, 300);
    height = Math.max(height, 200);

    // Maintain aspect ratio for certain chart types
    switch (type) {
        case 'pie':
        case 'donut':
        case 'gauge':
            const size = Math.min(width, height);
            return { width: size, height: size };

        case 'radar':
            const radarSize = Math.min(width, height * 1.2);
            return { width: radarSize, height: radarSize };

        default:
            return { width, height };
    }
};

/**
 * Generate responsive chart configuration
 */
export const generateResponsiveConfig = (
    baseConfig: ChartConfig,
    breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
): Partial<ChartConfig> => {
    const responsiveOverrides: Record<string, Partial<ChartConfig>> = {
        xs: {
            title: {
                ...baseConfig.title,
                style: {
                    ...baseConfig.title.style,
                    fontSize: Math.max(baseConfig.title.style.fontSize - 4, 12),
                },
            },
            legend: {
                ...baseConfig.legend,
                position: 'bottom',
                style: {
                    ...baseConfig.legend.style,
                    fontSize: 10,
                },
            },
            tooltip: {
                ...baseConfig.tooltip,
                style: {
                    ...baseConfig.tooltip.style,
                    fontSize: 11,
                },
            },
        },
        sm: {
            title: {
                ...baseConfig.title,
                style: {
                    ...baseConfig.title.style,
                    fontSize: Math.max(baseConfig.title.style.fontSize - 2, 14),
                },
            },
            legend: {
                ...baseConfig.legend,
                style: {
                    ...baseConfig.legend.style,
                    fontSize: 11,
                },
            },
        },
        md: baseConfig,
        lg: baseConfig,
        xl: {
            title: {
                ...baseConfig.title,
                style: {
                    ...baseConfig.title.style,
                    fontSize: baseConfig.title.style.fontSize + 2,
                },
            },
        },
    };

    return responsiveOverrides[breakpoint] || baseConfig;
};

/**
 * Validate chart data and configuration
 */
export const validateChartData = (
    data: DataPoint[],
    type: ChartType,
    series: SeriesConfig[]
): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Check if data exists
    if (!data || data.length === 0) {
        errors.push('Chart data is empty');
        return { isValid: false, errors };
    }

    // Check series configuration
    if (!series || series.length === 0) {
        errors.push('No series configuration provided');
        return { isValid: false, errors };
    }

    // Validate data keys exist in data
    series.forEach((s, index) => {
        const hasDataKey = data.some(item => item.hasOwnProperty(s.dataKey));
        if (!hasDataKey) {
            errors.push(`Series ${index + 1}: Data key '${s.dataKey}' not found in data`);
        }
    });

    // Type-specific validations
    switch (type) {
        case 'pie':
        case 'donut':
            if (series.length > 1) {
                errors.push('Pie/Donut charts support only one data series');
            }
            break;

        case 'scatter':
        case 'bubble':
            if (series.length < 2) {
                errors.push('Scatter/Bubble charts require at least 2 data series (x and y)');
            }
            break;

        case 'heatmap':
            const hasXY = data.every(item =>
                item.hasOwnProperty('x') && item.hasOwnProperty('y') && item.hasOwnProperty('value')
            );
            if (!hasXY) {
                errors.push('Heatmap data must have x, y, and value properties');
            }
            break;
    }

    return { isValid: errors.length === 0, errors };
};

/**
 * Generate chart accessibility attributes
 */
export const generateAccessibilityAttributes = (
    title: string,
    type: ChartType,
    data: DataPoint[]
): Record<string, string> => {
    const dataCount = data.length;
    const chartTypeLabel = type.replace('-', ' ');

    return {
        'aria-label': `${title} - ${chartTypeLabel} chart with ${dataCount} data points`,
        'role': 'img',
        'aria-describedby': `chart-description-${title.replace(/\s+/g, '-').toLowerCase()}`,
    };
};

/**
 * Calculate chart statistics
 */
export const calculateChartStatistics = (
    data: DataPoint[],
    dataKey: string
): {
    min: number;
    max: number;
    mean: number;
    median: number;
    sum: number;
    count: number;
} => {
    const values = data
        .map(item => item[dataKey])
        .filter(value => typeof value === 'number' && !isNaN(value)) as number[];

    if (values.length === 0) {
        return { min: 0, max: 0, mean: 0, median: 0, sum: 0, count: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((acc, val) => acc + val, 0);
    const mean = sum / values.length;
    const median = sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)];

    return {
        min: Math.min(...values),
        max: Math.max(...values),
        mean,
        median,
        sum,
        count: values.length,
    };
};

/**
 * Generate chart export configuration
 */
export const generateExportConfig = (
    type: ChartType,
    format: 'png' | 'svg' | 'pdf'
): Record<string, any> => {
    const baseConfig = {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
    };

    switch (format) {
        case 'png':
            return {
                ...baseConfig,
                type: 'image/png',
                quality: 0.95,
            };

        case 'svg':
            return {
                ...baseConfig,
                type: 'image/svg+xml',
                scalable: true,
            };

        case 'pdf':
            return {
                ...baseConfig,
                type: 'application/pdf',
                orientation: type === 'pie' || type === 'donut' ? 'portrait' : 'landscape',
            };

        default:
            return baseConfig;
    }
};