// Data Formatting Utilities
import { DataPoint } from '../types/charts';

/**
 * Format currency values with proper symbol and locale
 */
export const formatCurrency = (
    value: number,
    currency: string = 'NGN',
    locale: string = 'en-NG'
): string => {
    try {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        }).format(value);
    } catch (error) {
        // Fallback for unsupported currencies
        const symbol = currency === 'NGN' ? '₦' : '$';
        return `${symbol}${value.toLocaleString()}`;
    }
};

/**
 * Format percentage values
 */
export const formatPercentage = (
    value: number,
    decimals: number = 1,
    includeSymbol: boolean = true
): string => {
    const formatted = value.toFixed(decimals);
    return includeSymbol ? `${formatted}%` : formatted;
};

/**
 * Format large numbers with appropriate suffixes
 */
export const formatLargeNumber = (value: number): string => {
    const absValue = Math.abs(value);
    const sign = value < 0 ? '-' : '';

    if (absValue >= 1e9) {
        return `${sign}${(absValue / 1e9).toFixed(1)}B`;
    } else if (absValue >= 1e6) {
        return `${sign}${(absValue / 1e6).toFixed(1)}M`;
    } else if (absValue >= 1e3) {
        return `${sign}${(absValue / 1e3).toFixed(1)}K`;
    } else {
        return value.toString();
    }
};

/**
 * Format dates for different contexts
 */
export const formatDate = (
    date: Date | string,
    format: 'short' | 'medium' | 'long' | 'time' | 'datetime' = 'medium'
): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(dateObj.getTime())) {
        return 'Invalid Date';
    }

    const options: Intl.DateTimeFormatOptions = {
        short: { month: 'short', day: 'numeric' },
        medium: { year: 'numeric', month: 'short', day: 'numeric' },
        long: { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' },
        time: { hour: '2-digit', minute: '2-digit' },
        datetime: {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        },
    }[format];

    return dateObj.toLocaleDateString('en-US', options);
};

/**
 * Format duration in human-readable format
 */
export const formatDuration = (
    value: number,
    unit: 'seconds' | 'minutes' | 'hours' | 'days' = 'minutes'
): string => {
    let totalMinutes: number;

    switch (unit) {
        case 'seconds':
            totalMinutes = value / 60;
            break;
        case 'hours':
            totalMinutes = value * 60;
            break;
        case 'days':
            totalMinutes = value * 24 * 60;
            break;
        default:
            totalMinutes = value;
    }

    if (totalMinutes < 60) {
        return `${Math.round(totalMinutes)}m`;
    } else if (totalMinutes < 24 * 60) {
        const hours = Math.floor(totalMinutes / 60);
        const minutes = Math.round(totalMinutes % 60);
        return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    } else {
        const days = Math.floor(totalMinutes / (24 * 60));
        const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
        return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
    }
};

/**
 * Format medical values with appropriate units
 */
export const formatMedicalValue = (
    value: number,
    parameter: string
): string => {
    const parameterUnits: Record<string, string> = {
        'blood_pressure_systolic': 'mmHg',
        'blood_pressure_diastolic': 'mmHg',
        'heart_rate': 'bpm',
        'temperature': '°C',
        'weight': 'kg',
        'height': 'cm',
        'bmi': 'kg/m²',
        'glucose': 'mg/dL',
        'cholesterol': 'mg/dL',
        'hemoglobin': 'g/dL',
        'creatinine': 'mg/dL',
    };

    const unit = parameterUnits[parameter] || '';
    return `${value}${unit ? ' ' + unit : ''}`;
};

/**
 * Format adherence scores
 */
export const formatAdherenceScore = (score: number): {
    formatted: string;
    level: 'excellent' | 'good' | 'fair' | 'poor';
    color: string;
} => {
    const formatted = formatPercentage(score);

    let level: 'excellent' | 'good' | 'fair' | 'poor';
    let color: string;

    if (score >= 90) {
        level = 'excellent';
        color = '#10b981'; // Green
    } else if (score >= 80) {
        level = 'good';
        color = '#84cc16'; // Lime
    } else if (score >= 70) {
        level = 'fair';
        color = '#f59e0b'; // Yellow
    } else {
        level = 'poor';
        color = '#ef4444'; // Red
    }

    return { formatted, level, color };
};

/**
 * Format trend indicators
 */
export const formatTrend = (
    current: number,
    previous: number,
    format: 'percentage' | 'absolute' | 'currency' = 'percentage'
): {
    value: string;
    direction: 'up' | 'down' | 'stable';
    color: string;
    isPositive: boolean;
} => {
    const difference = current - previous;
    const percentChange = previous !== 0 ? (difference / previous) * 100 : 0;

    let direction: 'up' | 'down' | 'stable';
    if (Math.abs(percentChange) < 0.1) {
        direction = 'stable';
    } else {
        direction = difference > 0 ? 'up' : 'down';
    }

    let value: string;
    switch (format) {
        case 'absolute':
            value = formatLargeNumber(Math.abs(difference));
            break;
        case 'currency':
            value = formatCurrency(Math.abs(difference));
            break;
        default:
            value = formatPercentage(Math.abs(percentChange));
    }

    const isPositive = difference > 0;
    const color = direction === 'stable' ? '#6b7280' : (isPositive ? '#10b981' : '#ef4444');

    return { value, direction, color, isPositive };
};

/**
 * Format data for chart tooltips
 */
export const formatTooltipValue = (
    value: any,
    dataKey: string,
    payload?: any
): [string, string] => {
    let formattedValue: string;
    let name = dataKey;

    // Determine format based on data key patterns
    if (typeof value === 'number') {
        if (dataKey.toLowerCase().includes('cost') ||
            dataKey.toLowerCase().includes('revenue') ||
            dataKey.toLowerCase().includes('savings')) {
            formattedValue = formatCurrency(value);
        } else if (dataKey.toLowerCase().includes('rate') ||
            dataKey.toLowerCase().includes('percentage') ||
            dataKey.toLowerCase().includes('percent')) {
            formattedValue = formatPercentage(value);
        } else if (dataKey.toLowerCase().includes('time') ||
            dataKey.toLowerCase().includes('duration')) {
            formattedValue = formatDuration(value);
        } else if (value > 1000) {
            formattedValue = formatLargeNumber(value);
        } else {
            formattedValue = value.toLocaleString();
        }
    } else if (value instanceof Date) {
        formattedValue = formatDate(value);
    } else {
        formattedValue = String(value);
    }

    // Clean up the name for display
    name = dataKey
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim();

    return [formattedValue, name];
};

/**
 * Format table cell values based on column type
 */
export const formatTableValue = (
    value: any,
    type: 'text' | 'number' | 'currency' | 'percentage' | 'date' | 'status'
): string => {
    if (value === null || value === undefined) {
        return '-';
    }

    switch (type) {
        case 'currency':
            return typeof value === 'number' ? formatCurrency(value) : String(value);

        case 'percentage':
            return typeof value === 'number' ? formatPercentage(value) : String(value);

        case 'number':
            return typeof value === 'number' ? value.toLocaleString() : String(value);

        case 'date':
            return value instanceof Date ? formatDate(value) : formatDate(new Date(value));

        case 'status':
            return String(value).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

        default:
            return String(value);
    }
};

/**
 * Aggregate data for summary calculations
 */
export const aggregateData = (
    data: DataPoint[],
    groupBy: string,
    aggregateFields: Array<{
        field: string;
        operation: 'sum' | 'avg' | 'count' | 'min' | 'max';
    }>
): DataPoint[] => {
    const groups = new Map<string, DataPoint[]>();

    // Group data
    data.forEach(item => {
        const key = String(item[groupBy]);
        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key)!.push(item);
    });

    // Aggregate each group
    const result: DataPoint[] = [];
    groups.forEach((items, key) => {
        const aggregated: DataPoint = { [groupBy]: key };

        aggregateFields.forEach(({ field, operation }) => {
            const values = items
                .map(item => item[field])
                .filter(val => typeof val === 'number') as number[];

            if (values.length === 0) {
                aggregated[field] = 0;
                return;
            }

            switch (operation) {
                case 'sum':
                    aggregated[field] = values.reduce((sum, val) => sum + val, 0);
                    break;
                case 'avg':
                    aggregated[field] = values.reduce((sum, val) => sum + val, 0) / values.length;
                    break;
                case 'count':
                    aggregated[field] = values.length;
                    break;
                case 'min':
                    aggregated[field] = Math.min(...values);
                    break;
                case 'max':
                    aggregated[field] = Math.max(...values);
                    break;
            }
        });

        result.push(aggregated);
    });

    return result;
};

/**
 * Calculate moving average for trend smoothing
 */
export const calculateMovingAverage = (
    data: DataPoint[],
    field: string,
    window: number = 7
): DataPoint[] => {
    if (data.length < window) return data;

    return data.map((item, index) => {
        if (index < window - 1) return item;

        const windowData = data.slice(index - window + 1, index + 1);
        const values = windowData
            .map(d => d[field])
            .filter(val => typeof val === 'number') as number[];

        const average = values.length > 0
            ? values.reduce((sum, val) => sum + val, 0) / values.length
            : 0;

        return {
            ...item,
            [`${field}_ma`]: average,
        };
    });
};