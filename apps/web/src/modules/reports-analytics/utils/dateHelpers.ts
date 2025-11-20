// Date Helper Functions
import { DatePreset } from '../types/filters';

/**
 * Get date range labels for presets
 */
export const getDateRangeLabel = (preset: DatePreset): string => {
    const labels = {
        '7d': 'Last 7 days',
        '30d': 'Last 30 days',
        '90d': 'Last 90 days',
        '6months': 'Last 6 months',
        '1year': 'Last year',
        'custom': 'Custom range',
    };

    return labels[preset] || 'Custom range';
};

/**
 * Get relative date description
 */
export const getRelativeDateDescription = (date: Date): string => {
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) {
        return 'Today';
    } else if (diffInDays === 1) {
        return 'Yesterday';
    } else if (diffInDays < 7) {
        return `${diffInDays} days ago`;
    } else if (diffInDays < 30) {
        const weeks = Math.floor(diffInDays / 7);
        return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
    } else if (diffInDays < 365) {
        const months = Math.floor(diffInDays / 30);
        return months === 1 ? '1 month ago' : `${months} months ago`;
    } else {
        const years = Math.floor(diffInDays / 365);
        return years === 1 ? '1 year ago' : `${years} years ago`;
    }
};

/**
 * Format date range for display
 */
export const formatDateRange = (
    startDate: Date,
    endDate: Date,
    format: 'short' | 'medium' | 'long' = 'medium'
): string => {
    const formatOptions: Record<string, Intl.DateTimeFormatOptions> = {
        short: { month: 'short', day: 'numeric' },
        medium: { month: 'short', day: 'numeric', year: 'numeric' },
        long: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' },
    };

    const options = formatOptions[format];
    const start = startDate.toLocaleDateString('en-US', options);
    const end = endDate.toLocaleDateString('en-US', options);

    // If same year, don't repeat it
    if (format === 'medium' && startDate.getFullYear() === endDate.getFullYear()) {
        const startWithoutYear = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `${startWithoutYear} - ${end}`;
    }

    return `${start} - ${end}`;
};

/**
 * Get business days between dates
 */
export const getBusinessDaysBetween = (startDate: Date, endDate: Date): number => {
    let count = 0;
    const current = new Date(startDate);

    while (current <= endDate) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
            count++;
        }
        current.setDate(current.getDate() + 1);
    }

    return count;
};

/**
 * Get quarter from date
 */
export const getQuarter = (date: Date): { quarter: number; year: number; label: string } => {
    const month = date.getMonth();
    const year = date.getFullYear();
    const quarter = Math.floor(month / 3) + 1;

    return {
        quarter,
        year,
        label: `Q${quarter} ${year}`,
    };
};

/**
 * Get week number of year
 */
export const getWeekNumber = (date: Date): { week: number; year: number } => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

    return { week, year: d.getUTCFullYear() };
};

/**
 * Generate date series for charts
 */
export const generateDateSeries = (
    startDate: Date,
    endDate: Date,
    interval: 'day' | 'week' | 'month' | 'quarter' | 'year'
): Date[] => {
    const dates: Date[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
        dates.push(new Date(current));

        switch (interval) {
            case 'day':
                current.setDate(current.getDate() + 1);
                break;
            case 'week':
                current.setDate(current.getDate() + 7);
                break;
            case 'month':
                current.setMonth(current.getMonth() + 1);
                break;
            case 'quarter':
                current.setMonth(current.getMonth() + 3);
                break;
            case 'year':
                current.setFullYear(current.getFullYear() + 1);
                break;
        }
    }

    return dates;
};

/**
 * Get optimal date grouping for data range
 */
export const getOptimalDateGrouping = (
    startDate: Date,
    endDate: Date
): 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year' => {
    const diffInMs = endDate.getTime() - startDate.getTime();
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

    if (diffInDays <= 1) {
        return 'hour';
    } else if (diffInDays <= 31) {
        return 'day';
    } else if (diffInDays <= 90) {
        return 'week';
    } else if (diffInDays <= 730) { // ~2 years
        return 'month';
    } else if (diffInDays <= 1460) { // ~4 years
        return 'quarter';
    } else {
        return 'year';
    }
};

/**
 * Round date to nearest interval
 */
export const roundDateToInterval = (
    date: Date,
    interval: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year'
): Date => {
    const rounded = new Date(date);

    switch (interval) {
        case 'hour':
            rounded.setMinutes(0, 0, 0);
            break;
        case 'day':
            rounded.setHours(0, 0, 0, 0);
            break;
        case 'week':
            rounded.setHours(0, 0, 0, 0);
            const dayOfWeek = rounded.getDay();
            rounded.setDate(rounded.getDate() - dayOfWeek);
            break;
        case 'month':
            rounded.setDate(1);
            rounded.setHours(0, 0, 0, 0);
            break;
        case 'quarter':
            const month = rounded.getMonth();
            const quarterStartMonth = Math.floor(month / 3) * 3;
            rounded.setMonth(quarterStartMonth, 1);
            rounded.setHours(0, 0, 0, 0);
            break;
        case 'year':
            rounded.setMonth(0, 1);
            rounded.setHours(0, 0, 0, 0);
            break;
    }

    return rounded;
};

/**
 * Check if date is within business hours
 */
export const isBusinessHours = (
    date: Date,
    startHour: number = 9,
    endHour: number = 17
): boolean => {
    const dayOfWeek = date.getDay();
    const hour = date.getHours();

    // Check if it's a weekday
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        return false;
    }

    // Check if it's within business hours
    return hour >= startHour && hour < endHour;
};

/**
 * Get timezone offset string
 */
export const getTimezoneOffset = (date: Date = new Date()): string => {
    const offset = -date.getTimezoneOffset();
    const hours = Math.floor(Math.abs(offset) / 60);
    const minutes = Math.abs(offset) % 60;
    const sign = offset >= 0 ? '+' : '-';

    return `${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

/**
 * Parse flexible date input
 */
export const parseFlexibleDate = (input: string): Date | null => {
    // Try common date formats
    const formats = [
        /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
        /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
        /^\d{2}-\d{2}-\d{4}$/, // MM-DD-YYYY
        /^\d{1,2}\/\d{1,2}\/\d{4}$/, // M/D/YYYY
    ];

    // Try parsing with Date constructor first
    const parsed = new Date(input);
    if (!isNaN(parsed.getTime())) {
        return parsed;
    }

    // Try relative dates
    const now = new Date();
    const lowerInput = input.toLowerCase().trim();

    if (lowerInput === 'today') {
        return now;
    } else if (lowerInput === 'yesterday') {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday;
    } else if (lowerInput === 'tomorrow') {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow;
    }

    // Try "X days ago" format
    const daysAgoMatch = lowerInput.match(/^(\d+)\s+days?\s+ago$/);
    if (daysAgoMatch) {
        const days = parseInt(daysAgoMatch[1]);
        const date = new Date(now);
        date.setDate(date.getDate() - days);
        return date;
    }

    return null;
};

/**
 * Get date range for common periods
 */
export const getCommonDateRanges = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return {
        today: {
            start: new Date(today),
            end: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1),
        },
        yesterday: {
            start: new Date(today.getTime() - 24 * 60 * 60 * 1000),
            end: new Date(today.getTime() - 1),
        },
        thisWeek: {
            start: new Date(today.getTime() - today.getDay() * 24 * 60 * 60 * 1000),
            end: new Date(today.getTime() + (6 - today.getDay()) * 24 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000 - 1),
        },
        lastWeek: {
            start: new Date(today.getTime() - (today.getDay() + 7) * 24 * 60 * 60 * 1000),
            end: new Date(today.getTime() - (today.getDay() + 1) * 24 * 60 * 60 * 1000 - 1),
        },
        thisMonth: {
            start: new Date(today.getFullYear(), today.getMonth(), 1),
            end: new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999),
        },
        lastMonth: {
            start: new Date(today.getFullYear(), today.getMonth() - 1, 1),
            end: new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999),
        },
        thisYear: {
            start: new Date(today.getFullYear(), 0, 1),
            end: new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999),
        },
        lastYear: {
            start: new Date(today.getFullYear() - 1, 0, 1),
            end: new Date(today.getFullYear() - 1, 11, 31, 23, 59, 59, 999),
        },
    };
};