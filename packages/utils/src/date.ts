/**
 * Date Utility Functions
 * Cross-platform date formatting and manipulation using date-fns
 */

import {
    format,
    parseISO,
    isValid,
    differenceInYears,
    differenceInDays,
    addDays,
    subDays,
    startOfDay,
    endOfDay,
} from 'date-fns';

/**
 * Format a date string or Date object for display
 */
export function formatDate(date: string | Date, formatStr: string = 'MMM dd, yyyy'): string {
    try {
        const dateObj = typeof date === 'string' ? parseISO(date) : date;
        return isValid(dateObj) ? format(dateObj, formatStr) : '';
    } catch {
        return '';
    }
}

/**
 * Format a date for datetime display
 */
export function formatDateTime(date: string | Date): string {
    return formatDate(date, 'MMM dd, yyyy HH:mm');
}

/**
 * Format a date for time only
 */
export function formatTime(date: string | Date): string {
    return formatDate(date, 'HH:mm');
}

/**
 * Calculate age from date of birth
 */
export function calculateAge(dob: string | Date): number {
    try {
        const dobDate = typeof dob === 'string' ? parseISO(dob) : dob;
        return isValid(dobDate) ? differenceInYears(new Date(), dobDate) : 0;
    } catch {
        return 0;
    }
}

/**
 * Calculate days between two dates
 */
export function daysBetween(startDate: string | Date, endDate: string | Date): number {
    try {
        const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
        const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;
        return differenceInDays(end, start);
    } catch {
        return 0;
    }
}

/**
 * Add days to a date
 */
export function addDaysToDate(date: string | Date, days: number): Date {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return addDays(dateObj, days);
}

/**
 * Subtract days from a date
 */
export function subtractDaysFromDate(date: string | Date, days: number): Date {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return subDays(dateObj, days);
}

/**
 * Get start of day
 */
export function getStartOfDay(date: string | Date): Date {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return startOfDay(dateObj);
}

/**
 * Get end of day
 */
export function getEndOfDay(date: string | Date): Date {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return endOfDay(dateObj);
}

/**
 * Check if date is valid
 */
export function isValidDate(date: string | Date): boolean {
    try {
        const dateObj = typeof date === 'string' ? parseISO(date) : date;
        return isValid(dateObj);
    } catch {
        return false;
    }
}

/**
 * Get relative time string (e.g., "2 days ago", "in 3 hours")
 */
export function getRelativeTime(date: string | Date): string {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    const now = new Date();
    const diffInDays = differenceInDays(now, dateObj);

    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays === -1) return 'Tomorrow';
    if (diffInDays > 0) return `${diffInDays} days ago`;
    return `in ${Math.abs(diffInDays)} days`;
}
