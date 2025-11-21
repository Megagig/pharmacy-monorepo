/**
 * Formatting Utility Functions
 * Currency, phone numbers, and text formatting
 */

/**
 * Format currency in Nigerian Naira
 */
export function formatCurrency(amount: number, includeSymbol: boolean = true): string {
    const formatted = new Intl.NumberFormat('en-NG', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);

    return includeSymbol ? `₦${formatted}` : formatted;
}

/**
 * Format phone number to Nigerian E.164 format
 */
export function formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');

    // Handle different input formats
    if (digits.startsWith('234')) {
        return `+${digits}`;
    } else if (digits.startsWith('0')) {
        return `+234${digits.substring(1)}`;
    } else if (digits.length === 10) {
        return `+234${digits}`;
    }

    return phone; // Return original if format is unclear
}

/**
 * Format Medical Record Number (MRN)
 */
export function formatMRN(state: string, number: number): string {
    return `PHM-${state.toUpperCase()}-${number.toString().padStart(6, '0')}`;
}

/**
 * Capitalize first letter of each word
 */
export function capitalizeWords(text: string): string {
    return text
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return `${text.substring(0, maxLength)}...`;
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, decimals: number = 1): string {
    return `${value.toFixed(decimals)}%`;
}

/**
 * Generate initials from name
 */
export function getInitials(firstName: string, lastName: string): string {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

/**
 * Format full name
 */
export function formatFullName(
    firstName: string,
    lastName: string,
    otherNames?: string
): string {
    const parts = [firstName, otherNames, lastName].filter(Boolean);
    return parts.join(' ');
}
