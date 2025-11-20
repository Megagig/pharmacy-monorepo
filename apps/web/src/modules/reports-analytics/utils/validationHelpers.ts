// Validation Helper Functions
import { ChartConfig, ChartData } from '../types/charts';
import { ReportFilters, FilterDefinition } from '../types/filters';
import { ExportConfig } from '../types/exports';

/**
 * Validation result interface
 */
interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Validate chart configuration
 */
export const validateChartConfig = (config: ChartConfig): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate title
    if (!config.title?.text?.trim()) {
        errors.push('Chart title is required');
    }

    // Validate series
    if (!config.series || config.series.length === 0) {
        errors.push('At least one data series is required');
    } else {
        config.series.forEach((series, index) => {
            if (!series.name?.trim()) {
                errors.push(`Series ${index + 1}: Name is required`);
            }
            if (!series.dataKey?.trim()) {
                errors.push(`Series ${index + 1}: Data key is required`);
            }
            if (!series.style?.color) {
                warnings.push(`Series ${index + 1}: No color specified, will use default`);
            }
        });
    }

    // Validate axes
    if (config.axes) {
        if (!config.axes.x?.label?.trim()) {
            warnings.push('X-axis label is recommended');
        }
        if (!config.axes.y?.label?.trim()) {
            warnings.push('Y-axis label is recommended');
        }
    }

    // Validate theme
    if (!config.theme) {
        warnings.push('No theme specified, will use default');
    } else {
        if (!config.theme.colorPalette || config.theme.colorPalette.length === 0) {
            errors.push('Theme must have at least one color in palette');
        }
    }

    return { isValid: errors.length === 0, errors, warnings };
};

/**
 * Validate chart data
 */
export const validateChartData = (data: ChartData): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if data exists
    if (!data.data || data.data.length === 0) {
        errors.push('Chart data cannot be empty');
        return { isValid: false, errors, warnings };
    }

    // Validate data structure
    const firstItem = data.data[0];
    const keys = Object.keys(firstItem);

    if (keys.length === 0) {
        errors.push('Data items must have at least one property');
    }

    // Check data consistency
    data.data.forEach((item, index) => {
        const itemKeys = Object.keys(item);
        if (itemKeys.length !== keys.length) {
            warnings.push(`Data item ${index + 1}: Inconsistent number of properties`);
        }

        keys.forEach(key => {
            if (!(key in item)) {
                errors.push(`Data item ${index + 1}: Missing property '${key}'`);
            }
        });
    });

    // Validate data types for numeric fields
    if (data.config?.series) {
        data.config.series.forEach(series => {
            const hasNumericData = data.data.some(item =>
                typeof item[series.dataKey] === 'number'
            );

            if (!hasNumericData && ['line', 'bar', 'area'].includes(data.type)) {
                warnings.push(`Series '${series.name}': No numeric data found for key '${series.dataKey}'`);
            }
        });
    }

    return { isValid: errors.length === 0, errors, warnings };
};

/**
 * Validate report filters
 */
export const validateReportFilters = (
    filters: ReportFilters,
    definitions: FilterDefinition[]
): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate date range
    if (filters.dateRange) {
        const { startDate, endDate } = filters.dateRange;

        if (startDate > endDate) {
            errors.push('Start date must be before end date');
        }

        const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysDiff > 365 * 2) {
            warnings.push('Date range spans more than 2 years, which may affect performance');
        }

        if (daysDiff < 1) {
            warnings.push('Date range is less than 1 day');
        }
    }

    // Validate against filter definitions
    definitions.forEach(def => {
        const value = (filters as any)[def.key];

        // Check required fields
        if (def.required && (value === undefined || value === null || value === '')) {
            errors.push(`${def.label} is required`);
            return;
        }

        // Skip further validation if value is empty and not required
        if (!value && !def.required) return;

        // Validate based on filter type
        switch (def.type) {
            case 'number':
                if (typeof value !== 'number' || isNaN(value)) {
                    errors.push(`${def.label} must be a valid number`);
                }
                break;

            case 'select':
            case 'radio':
                if (def.options && !def.options.some(opt => opt.value === value)) {
                    errors.push(`${def.label} has an invalid value`);
                }
                break;

            case 'multiselect':
            case 'tags':
                if (!Array.isArray(value)) {
                    errors.push(`${def.label} must be an array`);
                } else if (def.options) {
                    const invalidValues = value.filter(v =>
                        !def.options!.some(opt => opt.value === v)
                    );
                    if (invalidValues.length > 0) {
                        errors.push(`${def.label} contains invalid values: ${invalidValues.join(', ')}`);
                    }
                }
                break;

            case 'date':
                if (!(value instanceof Date) && isNaN(new Date(value).getTime())) {
                    errors.push(`${def.label} must be a valid date`);
                }
                break;

            case 'daterange':
                if (!value.startDate || !value.endDate) {
                    errors.push(`${def.label} must have both start and end dates`);
                } else if (new Date(value.startDate) > new Date(value.endDate)) {
                    errors.push(`${def.label}: Start date must be before end date`);
                }
                break;
        }

        // Apply custom validation rules
        def.validation?.forEach(rule => {
            switch (rule.type) {
                case 'min':
                    if (typeof value === 'number' && value < rule.value) {
                        errors.push(rule.message);
                    }
                    break;
                case 'max':
                    if (typeof value === 'number' && value > rule.value) {
                        errors.push(rule.message);
                    }
                    break;
                case 'pattern':
                    if (typeof value === 'string' && !new RegExp(rule.value).test(value)) {
                        errors.push(rule.message);
                    }
                    break;
                case 'custom':
                    if (rule.validator && !rule.validator(value)) {
                        errors.push(rule.message);
                    }
                    break;
            }
        });
    });

    // Check filter dependencies
    definitions.forEach(def => {
        if (def.dependencies && def.dependencies.length > 0) {
            const value = (filters as any)[def.key];
            if (value) {
                const missingDependencies = def.dependencies.filter(dep =>
                    !(filters as any)[dep]
                );
                if (missingDependencies.length > 0) {
                    errors.push(`${def.label} requires: ${missingDependencies.join(', ')}`);
                }
            }
        }
    });

    return { isValid: errors.length === 0, errors, warnings };
};

/**
 * Validate export configuration
 */
export const validateExportConfiguration = (config: ExportConfig): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate format
    const supportedFormats = ['pdf', 'csv', 'excel', 'json', 'png', 'svg'];
    if (!supportedFormats.includes(config.format)) {
        errors.push(`Unsupported export format: ${config.format}`);
    }

    // Validate metadata
    if (!config.metadata.title?.trim()) {
        errors.push('Export title is required');
    }

    if (!config.metadata.author?.trim()) {
        warnings.push('Export author is recommended');
    }

    // Format-specific validation
    switch (config.format) {
        case 'pdf':
            const pdfOptions = config.options;
            if (pdfOptions.margins) {
                const { top, right, bottom, left } = pdfOptions.margins;
                if ([top, right, bottom, left].some(m => m < 0 || m > 100)) {
                    errors.push('PDF margins must be between 0 and 100');
                }
            }
            break;

        case 'csv':
            if (config.options.delimiter && config.options.delimiter.length !== 1) {
                errors.push('CSV delimiter must be a single character');
            }
            break;

        case 'excel':
            if (config.options.sheets && config.options.sheets.length === 0) {
                warnings.push('Excel export should have at least one sheet');
            }
            break;

        case 'png':
        case 'svg':
            const { width, height, dpi } = config.options;
            if (width && (width < 100 || width > 5000)) {
                errors.push('Image width must be between 100 and 5000 pixels');
            }
            if (height && (height < 100 || height > 5000)) {
                errors.push('Image height must be between 100 and 5000 pixels');
            }
            if (dpi && (dpi < 72 || dpi > 300)) {
                warnings.push('Image DPI should be between 72 and 300 for optimal quality');
            }
            break;
    }

    return { isValid: errors.length === 0, errors, warnings };
};

/**
 * Validate data quality
 */
export const validateDataQuality = (data: any[]): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!Array.isArray(data)) {
        errors.push('Data must be an array');
        return { isValid: false, errors, warnings };
    }

    if (data.length === 0) {
        warnings.push('Dataset is empty');
        return { isValid: true, errors, warnings };
    }

    // Check for null/undefined values
    let nullCount = 0;
    let undefinedCount = 0;

    data.forEach((item, index) => {
        if (item === null) nullCount++;
        if (item === undefined) undefinedCount++;

        if (typeof item === 'object' && item !== null) {
            Object.entries(item).forEach(([key, value]) => {
                if (value === null) nullCount++;
                if (value === undefined) undefinedCount++;
            });
        }
    });

    if (nullCount > 0) {
        warnings.push(`Dataset contains ${nullCount} null values`);
    }

    if (undefinedCount > 0) {
        warnings.push(`Dataset contains ${undefinedCount} undefined values`);
    }

    // Check data consistency
    if (data.length > 1 && typeof data[0] === 'object') {
        const firstKeys = Object.keys(data[0] || {});
        const inconsistentItems = data.filter((item, index) => {
            if (typeof item !== 'object' || item === null) return true;
            const itemKeys = Object.keys(item);
            return itemKeys.length !== firstKeys.length ||
                !firstKeys.every(key => key in item);
        });

        if (inconsistentItems.length > 0) {
            warnings.push(`${inconsistentItems.length} items have inconsistent structure`);
        }
    }

    // Check for duplicate entries (basic check)
    const stringified = data.map(item => JSON.stringify(item));
    const uniqueCount = new Set(stringified).size;
    if (uniqueCount < data.length) {
        warnings.push(`Dataset contains ${data.length - uniqueCount} duplicate entries`);
    }

    return { isValid: errors.length === 0, errors, warnings };
};

/**
 * Validate user permissions for report access
 */
export const validateReportPermissions = (
    userPermissions: string[],
    reportType: string,
    action: 'view' | 'export' | 'schedule' = 'view'
): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Define required permissions for different report types and actions
    const permissionMap: Record<string, Record<string, string[]>> = {
        'patient-outcomes': {
            view: ['reports.patient-outcomes.view'],
            export: ['reports.patient-outcomes.view', 'reports.export'],
            schedule: ['reports.patient-outcomes.view', 'reports.schedule'],
        },
        'pharmacist-interventions': {
            view: ['reports.interventions.view'],
            export: ['reports.interventions.view', 'reports.export'],
            schedule: ['reports.interventions.view', 'reports.schedule'],
        },
        'cost-effectiveness': {
            view: ['reports.financial.view'],
            export: ['reports.financial.view', 'reports.export'],
            schedule: ['reports.financial.view', 'reports.schedule'],
        },
        // Add more report types as needed
    };

    const requiredPermissions = permissionMap[reportType]?.[action] || [`reports.${reportType}.${action}`];

    const missingPermissions = requiredPermissions.filter(
        permission => !userPermissions.includes(permission)
    );

    if (missingPermissions.length > 0) {
        errors.push(`Missing required permissions: ${missingPermissions.join(', ')}`);
    }

    // Check for admin override
    if (userPermissions.includes('admin') || userPermissions.includes('super_admin')) {
        // Admin users can access everything, clear any permission errors
        return { isValid: true, errors: [], warnings };
    }

    return { isValid: errors.length === 0, errors, warnings };
};

/**
 * Validate workspace context
 */
export const validateWorkspaceContext = (
    workspaceId: string,
    userWorkspaces: string[]
): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!workspaceId?.trim()) {
        errors.push('Workspace ID is required');
    } else if (!userWorkspaces.includes(workspaceId)) {
        errors.push('User does not have access to this workspace');
    }

    return { isValid: errors.length === 0, errors, warnings };
};

/**
 * Sanitize and validate input data
 */
export const sanitizeInput = (input: any, type: 'string' | 'number' | 'boolean' | 'array' | 'object'): any => {
    switch (type) {
        case 'string':
            if (typeof input !== 'string') return '';
            return input.trim().replace(/[<>]/g, ''); // Basic XSS prevention

        case 'number':
            const num = Number(input);
            return isNaN(num) ? 0 : num;

        case 'boolean':
            return Boolean(input);

        case 'array':
            return Array.isArray(input) ? input : [];

        case 'object':
            return typeof input === 'object' && input !== null ? input : {};

        default:
            return input;
    }
};

/**
 * Validate API response structure
 */
export const validateApiResponse = (response: any, expectedStructure: any): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!response) {
        errors.push('Response is null or undefined');
        return { isValid: false, errors, warnings };
    }

    // Check if response has expected properties
    const checkStructure = (obj: any, expected: any, path: string = '') => {
        Object.keys(expected).forEach(key => {
            const fullPath = path ? `${path}.${key}` : key;

            if (!(key in obj)) {
                errors.push(`Missing property: ${fullPath}`);
                return;
            }

            const expectedType = expected[key];
            const actualValue = obj[key];

            if (typeof expectedType === 'string') {
                // Type check
                if (typeof actualValue !== expectedType) {
                    errors.push(`Property ${fullPath} should be ${expectedType}, got ${typeof actualValue}`);
                }
            } else if (typeof expectedType === 'object' && expectedType !== null) {
                // Nested object check
                if (typeof actualValue === 'object' && actualValue !== null) {
                    checkStructure(actualValue, expectedType, fullPath);
                } else {
                    errors.push(`Property ${fullPath} should be an object`);
                }
            }
        });
    };

    checkStructure(response, expectedStructure);

    return { isValid: errors.length === 0, errors, warnings };
};