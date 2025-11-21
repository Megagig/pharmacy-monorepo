/**
 * Validation Utility Functions
 * Email, phone, NIN, and other validation helpers
 */

/**
 * Validate email address
 */
export function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate Nigerian phone number
 */
export function isValidNigerianPhone(phone: string): boolean {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');

    // Check if it matches Nigerian phone number patterns
    // 234XXXXXXXXXX (with country code)
    // 0XXXXXXXXXX (without country code)
    // XXXXXXXXXX (10 digits)
    return (
        (digits.startsWith('234') && digits.length === 13) ||
        (digits.startsWith('0') && digits.length === 11) ||
        digits.length === 10
    );
}

/**
 * Validate Nigerian National Identification Number (NIN)
 */
export function isValidNIN(nin: string): boolean {
    // NIN is 11 digits
    const ninRegex = /^\d{11}$/;
    return ninRegex.test(nin);
}

/**
 * Validate password strength
 * Returns object with validation results
 */
export function validatePassword(password: string): {
    isValid: boolean;
    errors: string[];
} {
    const errors: string[] = [];

    if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }

    if (!/\d/.test(password)) {
        errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        errors.push('Password must contain at least one special character');
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
}

/**
 * Validate MRN format
 */
export function isValidMRN(mrn: string): boolean {
    // PHM-STATE-XXXXXX
    const mrnRegex = /^PHM-[A-Z]{2,}-\d{6}$/;
    return mrnRegex.test(mrn);
}

/**
 * Validate required field
 */
export function isRequired(value: string | number | null | undefined): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    return true;
}

/**
 * Validate number range
 */
export function isInRange(value: number, min: number, max: number): boolean {
    return value >= min && value <= max;
}

/**
 * Validate blood pressure
 */
export function isValidBloodPressure(systolic?: number, diastolic?: number): boolean {
    if (!systolic || !diastolic) return true; // Optional fields
    return (
        isInRange(systolic, 70, 250) &&
        isInRange(diastolic, 40, 150) &&
        systolic > diastolic
    );
}

/**
 * Validate temperature (Celsius)
 */
export function isValidTemperature(temp?: number): boolean {
    if (!temp) return true; // Optional field
    return isInRange(temp, 35, 42);
}

/**
 * Validate heart rate
 */
export function isValidHeartRate(rate?: number): boolean {
    if (!rate) return true; // Optional field
    return isInRange(rate, 40, 200);
}

/**
 * Sanitize input to prevent XSS
 */
export function sanitizeInput(input: string): string {
    return input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}
