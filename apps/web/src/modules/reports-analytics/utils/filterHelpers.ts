// Filter Helper Functions
import { ReportFilters, FilterDefinition, DateRange, DatePreset } from '../types/filters';

/**
 * Create date range from preset
 */
export const createDateRangeFromPreset = (preset: DatePreset): DateRange => {
    const endDate = new Date();
    const startDate = new Date();

    switch (preset) {
        case '7d':
            startDate.setDate(endDate.getDate() - 7);
            break;
        case '30d':
            startDate.setDate(endDate.getDate() - 30);
            break;
        case '90d':
            startDate.setDate(endDate.getDate() - 90);
            break;
        case '6months':
            startDate.setMonth(endDate.getMonth() - 6);
            break;
        case '1year':
            startDate.setFullYear(endDate.getFullYear() - 1);
            break;
        default:
            // For custom, return current date range
            break;
    }

    return { startDate, endDate, preset };
};

/**
 * Validate filter values
 */
export const validateFilters = (
    filters: ReportFilters,
    definitions: FilterDefinition[]
): { isValid: boolean; errors: Record<string, string> } => {
    const errors: Record<string, string> = {};

    definitions.forEach(def => {
        const value = (filters as any)[def.key];

        // Check required fields
        if (def.required && (value === undefined || value === null || value === '')) {
            errors[def.key] = `${def.label} is required`;
            return;
        }

        // Skip validation if value is empty and not required
        if (!value && !def.required) return;

        // Apply validation rules
        def.validation?.forEach(rule => {
            switch (rule.type) {
                case 'min':
                    if (typeof value === 'number' && value < rule.value) {
                        errors[def.key] = rule.message;
                    }
                    break;
                case 'max':
                    if (typeof value === 'number' && value > rule.value) {
                        errors[def.key] = rule.message;
                    }
                    break;
                case 'pattern':
                    if (typeof value === 'string' && !new RegExp(rule.value).test(value)) {
                        errors[def.key] = rule.message;
                    }
                    break;
                case 'custom':
                    if (rule.validator && !rule.validator(value)) {
                        errors[def.key] = rule.message;
                    }
                    break;
            }
        });
    });

    // Validate date range
    if (filters.dateRange) {
        const { startDate, endDate } = filters.dateRange;
        if (startDate && endDate && startDate > endDate) {
            errors.dateRange = 'Start date must be before end date';
        }
    }

    return { isValid: Object.keys(errors).length === 0, errors };
};

/**
 * Apply filters to data
 */
export const applyFiltersToData = <T extends Record<string, any>>(
    data: T[],
    filters: ReportFilters
): T[] => {
    let filteredData = [...data];

    // Apply date range filter
    if (filters.dateRange) {
        const { startDate, endDate } = filters.dateRange;
        filteredData = filteredData.filter(item => {
            const itemDate = new Date(item.createdAt || item.date || item.timestamp);
            return itemDate >= startDate && itemDate <= endDate;
        });
    }

    // Apply array filters
    const arrayFilters = [
        'therapyType',
        'pharmacistId',
        'location',
        'priority',
        'status'
    ] as const;

    arrayFilters.forEach(filterKey => {
        const filterValue = filters[filterKey];
        if (filterValue && filterValue.length > 0) {
            filteredData = filteredData.filter(item => {
                const itemValue = item[filterKey.replace('Id', '')]; // Remove 'Id' suffix for matching
                return filterValue.includes(itemValue);
            });
        }
    });

    // Apply patient criteria filters
    if (filters.patientCriteria) {
        const { ageRange, gender, conditions, medications, riskLevel } = filters.patientCriteria;

        if (ageRange) {
            filteredData = filteredData.filter(item => {
                const age = item.patientAge || item.age;
                return age >= ageRange.min && age <= ageRange.max;
            });
        }

        if (gender && gender !== 'all') {
            filteredData = filteredData.filter(item => item.patientGender === gender);
        }

        if (conditions && conditions.length > 0) {
            filteredData = filteredData.filter(item => {
                const itemConditions = item.conditions || [];
                return conditions.some(condition => itemConditions.includes(condition));
            });
        }

        if (medications && medications.length > 0) {
            filteredData = filteredData.filter(item => {
                const itemMedications = item.medications || [];
                return medications.some(medication => itemMedications.includes(medication));
            });
        }

        if (riskLevel) {
            filteredData = filteredData.filter(item => item.riskLevel === riskLevel);
        }
    }

    // Apply custom filters
    if (filters.customFilters) {
        Object.entries(filters.customFilters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                filteredData = filteredData.filter(item => {
                    if (Array.isArray(value)) {
                        return value.includes(item[key]);
                    } else {
                        return item[key] === value;
                    }
                });
            }
        });
    }

    return filteredData;
};

/**
 * Get filter summary text
 */
export const getFilterSummary = (
    filters: ReportFilters,
    definitions: FilterDefinition[]
): string => {
    const summaryParts: string[] = [];

    // Date range summary
    if (filters.dateRange) {
        const { startDate, endDate, preset } = filters.dateRange;
        if (preset && preset !== 'custom') {
            const presetLabels = {
                '7d': 'Last 7 days',
                '30d': 'Last 30 days',
                '90d': 'Last 90 days',
                '6months': 'Last 6 months',
                '1year': 'Last year',
            };
            summaryParts.push(presetLabels[preset]);
        } else {
            const start = startDate.toLocaleDateString();
            const end = endDate.toLocaleDateString();
            summaryParts.push(`${start} - ${end}`);
        }
    }

    // Other filters
    definitions.forEach(def => {
        const value = (filters as any)[def.key];
        if (value && def.key !== 'dateRange') {
            if (Array.isArray(value) && value.length > 0) {
                if (value.length === 1) {
                    summaryParts.push(`${def.label}: ${value[0]}`);
                } else {
                    summaryParts.push(`${def.label}: ${value.length} selected`);
                }
            } else if (!Array.isArray(value)) {
                summaryParts.push(`${def.label}: ${value}`);
            }
        }
    });

    return summaryParts.length > 0 ? summaryParts.join(', ') : 'No filters applied';
};

/**
 * Compare two filter sets
 */
export const compareFilters = (
    filters1: ReportFilters,
    filters2: ReportFilters
): boolean => {
    return JSON.stringify(filters1) === JSON.stringify(filters2);
};

/**
 * Merge filter sets
 */
export const mergeFilters = (
    baseFilters: ReportFilters,
    newFilters: Partial<ReportFilters>
): ReportFilters => {
    return {
        ...baseFilters,
        ...newFilters,
        patientCriteria: {
            ...baseFilters.patientCriteria,
            ...newFilters.patientCriteria,
        },
        customFilters: {
            ...baseFilters.customFilters,
            ...newFilters.customFilters,
        },
    };
};

/**
 * Reset filters to default values
 */
export const resetFilters = (definitions: FilterDefinition[]): ReportFilters => {
    const defaultFilters: ReportFilters = {
        dateRange: createDateRangeFromPreset('30d'),
    };

    definitions.forEach(def => {
        if (def.defaultValue !== undefined) {
            (defaultFilters as any)[def.key] = def.defaultValue;
        }
    });

    return defaultFilters;
};

/**
 * Get available filter options based on data
 */
export const getFilterOptionsFromData = <T extends Record<string, any>>(
    data: T[],
    field: string
): Array<{ value: string; label: string; count: number }> => {
    const counts = new Map<string, number>();

    data.forEach(item => {
        const value = item[field];
        if (value !== undefined && value !== null) {
            const stringValue = String(value);
            counts.set(stringValue, (counts.get(stringValue) || 0) + 1);
        }
    });

    return Array.from(counts.entries())
        .map(([value, count]) => ({
            value,
            label: value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            count,
        }))
        .sort((a, b) => b.count - a.count);
};

/**
 * Create filter URL parameters
 */
export const filtersToURLParams = (filters: ReportFilters): URLSearchParams => {
    const params = new URLSearchParams();

    // Date range
    if (filters.dateRange) {
        if (filters.dateRange.preset && filters.dateRange.preset !== 'custom') {
            params.set('datePreset', filters.dateRange.preset);
        } else {
            params.set('startDate', filters.dateRange.startDate.toISOString());
            params.set('endDate', filters.dateRange.endDate.toISOString());
        }
    }

    // Array filters
    const arrayFilters = ['therapyType', 'pharmacistId', 'location', 'priority', 'status'];
    arrayFilters.forEach(key => {
        const value = (filters as any)[key];
        if (value && Array.isArray(value) && value.length > 0) {
            params.set(key, value.join(','));
        }
    });

    // Patient criteria
    if (filters.patientCriteria) {
        const { ageRange, gender, conditions, medications, riskLevel } = filters.patientCriteria;

        if (ageRange) {
            params.set('ageMin', ageRange.min.toString());
            params.set('ageMax', ageRange.max.toString());
        }

        if (gender && gender !== 'all') {
            params.set('gender', gender);
        }

        if (conditions && conditions.length > 0) {
            params.set('conditions', conditions.join(','));
        }

        if (medications && medications.length > 0) {
            params.set('medications', medications.join(','));
        }

        if (riskLevel) {
            params.set('riskLevel', riskLevel);
        }
    }

    // Custom filters
    if (filters.customFilters) {
        Object.entries(filters.customFilters).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                params.set(`custom_${key}`, Array.isArray(value) ? value.join(',') : String(value));
            }
        });
    }

    return params;
};

/**
 * Parse filters from URL parameters
 */
export const filtersFromURLParams = (params: URLSearchParams): Partial<ReportFilters> => {
    const filters: Partial<ReportFilters> = {};

    // Date range
    const datePreset = params.get('datePreset') as DatePreset;
    const startDate = params.get('startDate');
    const endDate = params.get('endDate');

    if (datePreset) {
        filters.dateRange = createDateRangeFromPreset(datePreset);
    } else if (startDate && endDate) {
        filters.dateRange = {
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            preset: 'custom',
        };
    }

    // Array filters
    const arrayFilters = ['therapyType', 'pharmacistId', 'location', 'priority', 'status'];
    arrayFilters.forEach(key => {
        const value = params.get(key);
        if (value) {
            (filters as any)[key] = value.split(',');
        }
    });

    // Patient criteria
    const ageMin = params.get('ageMin');
    const ageMax = params.get('ageMax');
    const gender = params.get('gender');
    const conditions = params.get('conditions');
    const medications = params.get('medications');
    const riskLevel = params.get('riskLevel');

    if (ageMin || ageMax || gender || conditions || medications || riskLevel) {
        filters.patientCriteria = {};

        if (ageMin && ageMax) {
            filters.patientCriteria.ageRange = {
                min: parseInt(ageMin),
                max: parseInt(ageMax),
            };
        }

        if (gender) {
            filters.patientCriteria.gender = gender as any;
        }

        if (conditions) {
            filters.patientCriteria.conditions = conditions.split(',');
        }

        if (medications) {
            filters.patientCriteria.medications = medications.split(',');
        }

        if (riskLevel) {
            filters.patientCriteria.riskLevel = riskLevel as any;
        }
    }

    // Custom filters
    const customFilters: Record<string, any> = {};
    params.forEach((value, key) => {
        if (key.startsWith('custom_')) {
            const customKey = key.replace('custom_', '');
            customFilters[customKey] = value.includes(',') ? value.split(',') : value;
        }
    });

    if (Object.keys(customFilters).length > 0) {
        filters.customFilters = customFilters;
    }

    return filters;
};