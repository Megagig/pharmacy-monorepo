// Export Helper Functions
import { ExportFormat, ExportConfig, ExportOptions } from '../types/exports';

/**
 * Generate filename for exports
 */
export const generateExportFilename = (
    reportType: string,
    format: ExportFormat,
    timestamp?: Date
): string => {
    const date = timestamp || new Date();
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS

    const reportName = reportType
        .replace(/[^a-zA-Z0-9]/g, '-')
        .replace(/-+/g, '-')
        .toLowerCase();

    return `${reportName}-${dateStr}-${timeStr}.${format}`;
};

/**
 * Validate export configuration
 */
export const validateExportConfig = (config: ExportConfig): {
    isValid: boolean;
    errors: string[];
} => {
    const errors: string[] = [];

    // Validate format
    const supportedFormats: ExportFormat[] = ['pdf', 'csv', 'excel', 'json', 'png', 'svg'];
    if (!supportedFormats.includes(config.format)) {
        errors.push(`Unsupported export format: ${config.format}`);
    }

    // Validate PDF options
    if (config.format === 'pdf') {
        const { pageSize, orientation, margins } = config.options;

        if (pageSize && !['A4', 'A3', 'Letter', 'Legal'].includes(pageSize)) {
            errors.push(`Invalid PDF page size: ${pageSize}`);
        }

        if (orientation && !['portrait', 'landscape'].includes(orientation)) {
            errors.push(`Invalid PDF orientation: ${orientation}`);
        }

        if (margins) {
            const { top, right, bottom, left } = margins;
            if ([top, right, bottom, left].some(m => m < 0 || m > 100)) {
                errors.push('PDF margins must be between 0 and 100');
            }
        }
    }

    // Validate image options
    if (['png', 'svg'].includes(config.format)) {
        const { width, height, dpi } = config.options;

        if (width && (width < 100 || width > 5000)) {
            errors.push('Image width must be between 100 and 5000 pixels');
        }

        if (height && (height < 100 || height > 5000)) {
            errors.push('Image height must be between 100 and 5000 pixels');
        }

        if (dpi && (dpi < 72 || dpi > 300)) {
            errors.push('Image DPI must be between 72 and 300');
        }
    }

    // Validate CSV options
    if (config.format === 'csv') {
        const { delimiter, encoding } = config.options;

        if (delimiter && delimiter.length !== 1) {
            errors.push('CSV delimiter must be a single character');
        }

        if (encoding && !['utf-8', 'utf-16', 'ascii'].includes(encoding)) {
            errors.push(`Unsupported CSV encoding: ${encoding}`);
        }
    }

    return { isValid: errors.length === 0, errors };
};

/**
 * Get default export options for format
 */
export const getDefaultExportOptions = (format: ExportFormat): ExportOptions => {
    const baseOptions: ExportOptions = {
        includeMetadata: true,
        includeFilters: true,
        includeTimestamp: true,
    };

    switch (format) {
        case 'pdf':
            return {
                ...baseOptions,
                pageSize: 'A4',
                orientation: 'portrait',
                margins: { top: 20, right: 20, bottom: 20, left: 20 },
                includeCharts: true,
                chartResolution: 'high',
            };

        case 'csv':
            return {
                ...baseOptions,
                includeHeaders: true,
                delimiter: ',',
                encoding: 'utf-8',
                dateFormat: 'YYYY-MM-DD',
                numberFormat: '0.00',
            };

        case 'excel':
            return {
                ...baseOptions,
                includeHeaders: true,
                dateFormat: 'YYYY-MM-DD',
                numberFormat: '0.00',
                sheets: [
                    { name: 'Summary', data: 'summary' },
                    { name: 'Charts', data: 'charts' },
                    { name: 'Tables', data: 'tables' },
                ],
            };

        case 'png':
        case 'svg':
            return {
                ...baseOptions,
                width: 1200,
                height: 800,
                dpi: 150,
                backgroundColor: '#ffffff',
                transparent: false,
            };

        case 'json':
            return {
                ...baseOptions,
                encoding: 'utf-8',
            };

        default:
            return baseOptions;
    }
};

/**
 * Estimate export file size
 */
export const estimateExportSize = (
    format: ExportFormat,
    dataPoints: number,
    chartCount: number = 0
): { size: number; unit: string; formatted: string } => {
    let sizeInBytes: number;

    switch (format) {
        case 'csv':
            // Rough estimate: 50 bytes per data point
            sizeInBytes = dataPoints * 50;
            break;

        case 'excel':
            // Excel files are larger due to formatting
            sizeInBytes = dataPoints * 100 + chartCount * 50000; // 50KB per chart
            break;

        case 'json':
            // JSON is verbose but compressible
            sizeInBytes = dataPoints * 200;
            break;

        case 'pdf':
            // PDF size depends on charts and formatting
            sizeInBytes = dataPoints * 20 + chartCount * 100000; // 100KB per chart
            break;

        case 'png':
            // High-resolution images
            sizeInBytes = chartCount * 500000; // 500KB per chart
            break;

        case 'svg':
            // Vector graphics, smaller than PNG
            sizeInBytes = chartCount * 100000; // 100KB per chart
            break;

        default:
            sizeInBytes = dataPoints * 50;
    }

    // Convert to appropriate unit
    if (sizeInBytes < 1024) {
        return { size: sizeInBytes, unit: 'B', formatted: `${sizeInBytes} B` };
    } else if (sizeInBytes < 1024 * 1024) {
        const sizeInKB = sizeInBytes / 1024;
        return { size: sizeInKB, unit: 'KB', formatted: `${sizeInKB.toFixed(1)} KB` };
    } else {
        const sizeInMB = sizeInBytes / (1024 * 1024);
        return { size: sizeInMB, unit: 'MB', formatted: `${sizeInMB.toFixed(1)} MB` };
    }
};

/**
 * Generate export progress messages
 */
export const getExportProgressMessage = (
    progress: number,
    format: ExportFormat
): string => {
    const formatLabels = {
        pdf: 'PDF document',
        csv: 'CSV file',
        excel: 'Excel workbook',
        json: 'JSON file',
        png: 'PNG image',
        svg: 'SVG image',
    };

    const formatLabel = formatLabels[format] || 'file';

    if (progress < 25) {
        return `Preparing ${formatLabel}...`;
    } else if (progress < 50) {
        return `Processing data...`;
    } else if (progress < 75) {
        return `Generating ${formatLabel}...`;
    } else if (progress < 100) {
        return `Finalizing export...`;
    } else {
        return `${formatLabel} ready for download`;
    }
};

/**
 * Check if format supports charts
 */
export const formatSupportsCharts = (format: ExportFormat): boolean => {
    return ['pdf', 'excel', 'png', 'svg'].includes(format);
};

/**
 * Check if format supports multiple sheets/pages
 */
export const formatSupportsMultipleSheets = (format: ExportFormat): boolean => {
    return ['excel', 'pdf'].includes(format);
};

/**
 * Generate MIME type for format
 */
export const getMimeType = (format: ExportFormat): string => {
    const mimeTypes = {
        pdf: 'application/pdf',
        csv: 'text/csv',
        excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        json: 'application/json',
        png: 'image/png',
        svg: 'image/svg+xml',
    };

    return mimeTypes[format] || 'application/octet-stream';
};

/**
 * Sanitize data for export
 */
export const sanitizeDataForExport = (data: any): any => {
    if (data === null || data === undefined) {
        return '';
    }

    if (typeof data === 'string') {
        // Remove or escape special characters that might break CSV/Excel
        return data
            .replace(/"/g, '""') // Escape quotes
            .replace(/\n/g, ' ') // Replace newlines with spaces
            .replace(/\r/g, '') // Remove carriage returns
            .trim();
    }

    if (typeof data === 'number') {
        // Handle special number values
        if (isNaN(data)) return '';
        if (!isFinite(data)) return '';
        return data;
    }

    if (data instanceof Date) {
        return data.toISOString();
    }

    if (typeof data === 'boolean') {
        return data ? 'Yes' : 'No';
    }

    if (Array.isArray(data)) {
        return data.map(sanitizeDataForExport).join(', ');
    }

    if (typeof data === 'object') {
        return JSON.stringify(data);
    }

    return String(data);
};

/**
 * Create export metadata
 */
export const createExportMetadata = (
    reportType: string,
    filters: Record<string, any>,
    author: string,
    organization: string = 'Pharmacy Care Platform'
) => {
    return {
        title: `${reportType.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Report`,
        description: `Generated report for ${reportType}`,
        author,
        organization,
        generatedAt: new Date(),
        reportType,
        filters,
        dataRange: {
            startDate: filters.dateRange?.startDate || new Date(),
            endDate: filters.dateRange?.endDate || new Date(),
        },
        version: '1.0',
        confidentiality: 'internal' as const,
    };
};

/**
 * Validate export permissions
 */
export const validateExportPermissions = (
    userPermissions: string[],
    requiredPermissions: string[]
): { canExport: boolean; missingPermissions: string[] } => {
    const missingPermissions = requiredPermissions.filter(
        permission => !userPermissions.includes(permission)
    );

    return {
        canExport: missingPermissions.length === 0,
        missingPermissions,
    };
};

/**
 * Calculate export timeout based on data size
 */
export const calculateExportTimeout = (
    dataPoints: number,
    format: ExportFormat
): number => {
    // Base timeout in milliseconds
    let baseTimeout = 30000; // 30 seconds

    // Adjust based on format complexity
    const formatMultipliers = {
        csv: 1,
        json: 1.2,
        excel: 2,
        pdf: 3,
        png: 2.5,
        svg: 2,
    };

    baseTimeout *= formatMultipliers[format] || 1;

    // Adjust based on data size
    if (dataPoints > 10000) {
        baseTimeout *= 2;
    } else if (dataPoints > 1000) {
        baseTimeout *= 1.5;
    }

    // Maximum timeout of 5 minutes
    return Math.min(baseTimeout, 300000);
};