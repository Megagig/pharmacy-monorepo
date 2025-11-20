import logger from '../utils/logger';
import { Readable } from 'stream';

/**
 * CSV Parsing Service
 * Parses CSV files containing batch lab results
 * 
 * NOTE: Requires 'papaparse' package to be installed
 * Install with: npm install papaparse @types/papaparse
 */

interface CSVLabResult {
    patientId?: string;
    patientName?: string;
    testName: string;
    testCode?: string;
    testValue: string;
    numericValue?: number;
    unit?: string;
    referenceRange?: string;
    referenceRangeLow?: number;
    referenceRangeHigh?: number;
    testCategory?: string;
    specimenType?: string;
    testDate?: Date;
    laboratoryName?: string;
    accessionNumber?: string;
    orderingPhysician?: string;
    notes?: string;
}

interface CSVParseResult {
    success: boolean;
    results: CSVLabResult[];
    errors: string[];
    warnings: string[];
    totalRows: number;
    validRows: number;
    invalidRows: number;
}

/**
 * Parse lab results from CSV buffer
 */
export const parseLabResultCSV = async (
    csvBuffer: Buffer
): Promise<CSVParseResult> => {
    try {
        // Dynamic import to handle missing package gracefully
        let Papa: any;
        try {
            Papa = require('papaparse');
        } catch (error) {
            logger.error('papaparse package not installed', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return {
                success: false,
                results: [],
                errors: ['CSV parsing library not installed. Please install papaparse package.'],
                warnings: [],
                totalRows: 0,
                validRows: 0,
                invalidRows: 0
            };
        }

        const csvText = csvBuffer.toString('utf-8');

        // Parse CSV
        const parseResult = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header: string) => header.trim().toLowerCase().replace(/\s+/g, '_'),
            dynamicTyping: true,
            complete: (results: any) => results,
            error: (error: any) => {
                throw new Error(error.message);
            }
        });

        logger.info('CSV parsed successfully', {
            rows: parseResult.data.length,
            errors: parseResult.errors.length
        });

        // Process and validate results
        const processedResults = processCSVData(parseResult.data);

        return processedResults;

    } catch (error) {
        logger.error('Error parsing CSV', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        return {
            success: false,
            results: [],
            errors: [error instanceof Error ? error.message : 'Unknown error'],
            warnings: [],
            totalRows: 0,
            validRows: 0,
            invalidRows: 0
        };
    }
};

/**
 * Process and validate CSV data
 */
const processCSVData = (data: any[]): CSVParseResult => {
    const results: CSVLabResult[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    let validRows = 0;
    let invalidRows = 0;

    data.forEach((row, index) => {
        const rowNumber = index + 2; // +2 because index is 0-based and header is row 1

        try {
            // Validate required fields
            if (!row.test_name || row.test_name.trim() === '') {
                errors.push(`Row ${rowNumber}: Missing test name`);
                invalidRows++;
                return;
            }

            if (!row.test_value || row.test_value.toString().trim() === '') {
                errors.push(`Row ${rowNumber}: Missing test value`);
                invalidRows++;
                return;
            }

            // Parse numeric value
            let numericValue: number | undefined;
            const testValue = row.test_value.toString().trim();
            const parsedValue = parseFloat(testValue);
            if (!isNaN(parsedValue)) {
                numericValue = parsedValue;
            }

            // Parse reference range
            let referenceRangeLow: number | undefined;
            let referenceRangeHigh: number | undefined;
            if (row.reference_range) {
                const rangeParts = row.reference_range.toString().split('-');
                if (rangeParts.length === 2) {
                    const low = parseFloat(rangeParts[0].trim());
                    const high = parseFloat(rangeParts[1].trim());
                    if (!isNaN(low) && !isNaN(high)) {
                        referenceRangeLow = low;
                        referenceRangeHigh = high;
                    }
                }
            } else if (row.reference_range_low && row.reference_range_high) {
                const low = parseFloat(row.reference_range_low);
                const high = parseFloat(row.reference_range_high);
                if (!isNaN(low) && !isNaN(high)) {
                    referenceRangeLow = low;
                    referenceRangeHigh = high;
                }
            }

            // Parse test date
            let testDate: Date | undefined;
            if (row.test_date) {
                const parsedDate = new Date(row.test_date);
                if (!isNaN(parsedDate.getTime())) {
                    testDate = parsedDate;
                } else {
                    warnings.push(`Row ${rowNumber}: Invalid test date format`);
                }
            }

            // Build result object
            const result: CSVLabResult = {
                patientId: row.patient_id?.toString().trim(),
                patientName: row.patient_name?.toString().trim(),
                testName: row.test_name.toString().trim(),
                testCode: row.test_code?.toString().trim(),
                testValue,
                numericValue,
                unit: row.unit?.toString().trim(),
                referenceRange: row.reference_range?.toString().trim(),
                referenceRangeLow,
                referenceRangeHigh,
                testCategory: row.test_category?.toString().trim(),
                specimenType: row.specimen_type?.toString().trim(),
                testDate,
                laboratoryName: row.laboratory_name?.toString().trim(),
                accessionNumber: row.accession_number?.toString().trim(),
                orderingPhysician: row.ordering_physician?.toString().trim(),
                notes: row.notes?.toString().trim()
            };

            results.push(result);
            validRows++;

        } catch (error) {
            errors.push(`Row ${rowNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            invalidRows++;
        }
    });

    logger.info('CSV data processed', {
        totalRows: data.length,
        validRows,
        invalidRows,
        errorsCount: errors.length,
        warningsCount: warnings.length
    });

    return {
        success: errors.length === 0 || validRows > 0,
        results,
        errors,
        warnings,
        totalRows: data.length,
        validRows,
        invalidRows
    };
};

/**
 * Generate CSV template for batch upload
 */
export const generateCSVTemplate = (): string => {
    const headers = [
        'patient_id',
        'patient_name',
        'test_name',
        'test_code',
        'test_value',
        'unit',
        'reference_range',
        'reference_range_low',
        'reference_range_high',
        'test_category',
        'specimen_type',
        'test_date',
        'laboratory_name',
        'accession_number',
        'ordering_physician',
        'notes'
    ];

    const exampleRow = [
        'PAT001',
        'John Doe',
        'Glucose',
        'GLU',
        '95',
        'mg/dL',
        '70-100',
        '70',
        '100',
        'Chemistry',
        'Blood',
        '2024-01-15',
        'Central Lab',
        'ACC123456',
        'Dr. Smith',
        'Fasting sample'
    ];

    return `${headers.join(',')}\n${exampleRow.join(',')}`;
};

/**
 * Validate CSV structure before parsing
 */
export const validateCSVStructure = (csvBuffer: Buffer): {
    valid: boolean;
    errors: string[];
    requiredHeaders: string[];
    foundHeaders: string[];
} => {
    const errors: string[] = [];
    const requiredHeaders = ['test_name', 'test_value'];
    const foundHeaders: string[] = [];

    try {
        const csvText = csvBuffer.toString('utf-8');
        const firstLine = csvText.split('\n')[0];
        const headers = firstLine.split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));

        foundHeaders.push(...headers);

        // Check for required headers
        requiredHeaders.forEach(required => {
            if (!headers.includes(required)) {
                errors.push(`Missing required header: ${required}`);
            }
        });

        // Check for empty file
        if (csvText.trim() === '') {
            errors.push('CSV file is empty');
        }

    } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Unknown error');
    }

    return {
        valid: errors.length === 0,
        errors,
        requiredHeaders,
        foundHeaders
    };
};

export default {
    parseLabResultCSV,
    generateCSVTemplate,
    validateCSVStructure
};

