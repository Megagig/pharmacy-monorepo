import logger from '../utils/logger';

/**
 * PDF Parsing Service
 * Extracts lab test results from PDF documents
 * 
 * NOTE: Requires 'pdf-parse' package to be installed
 * Install with: npm install pdf-parse
 */

interface ParsedLabResult {
    testName: string;
    testValue: string;
    numericValue?: number;
    unit?: string;
    referenceRange?: string;
    referenceRangeLow?: number;
    referenceRangeHigh?: number;
    interpretation?: 'Normal' | 'Low' | 'High' | 'Critical' | 'Abnormal';
    isCritical?: boolean;
    isAbnormal?: boolean;
}

interface PDFParseResult {
    success: boolean;
    results: ParsedLabResult[];
    rawText?: string;
    error?: string;
    metadata?: {
        laboratoryName?: string;
        patientName?: string;
        accessionNumber?: string;
        testDate?: Date;
        reportDate?: Date;
    };
}

/**
 * Parse lab results from PDF buffer
 */
export const parseLabResultPDF = async (
    pdfBuffer: Buffer
): Promise<PDFParseResult> => {
    try {
        // Dynamic import to handle missing package gracefully
        let pdfParse: any;
        try {
            pdfParse = require('pdf-parse');
        } catch (error) {
            logger.error('pdf-parse package not installed', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return {
                success: false,
                results: [],
                error: 'PDF parsing library not installed. Please install pdf-parse package.'
            };
        }

        // Parse PDF
        const data = await pdfParse(pdfBuffer);
        const rawText = data.text;

        logger.info('PDF parsed successfully', {
            pages: data.numpages,
            textLength: rawText.length
        });

        // Extract lab results from text
        const results = extractLabResultsFromText(rawText);

        // Extract metadata
        const metadata = extractMetadataFromText(rawText);

        return {
            success: true,
            results,
            rawText,
            metadata
        };

    } catch (error) {
        logger.error('Error parsing PDF', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        return {
            success: false,
            results: [],
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
};

/**
 * Extract lab results from parsed text using pattern matching
 */
const extractLabResultsFromText = (text: string): ParsedLabResult[] => {
    const results: ParsedLabResult[] = [];

    // Common lab result patterns
    const patterns = [
        // Pattern 1: "Test Name: Value Unit (Reference Range)"
        // Example: "Glucose: 95 mg/dL (70-100 mg/dL)"
        /([A-Za-z0-9\s\-]+):\s*([0-9.]+)\s*([A-Za-z/%]+)?\s*\(([0-9.\-\s]+)\s*([A-Za-z/%]+)?\)/gi,

        // Pattern 2: "Test Name | Value | Unit | Reference Range"
        // Example: "HbA1c | 6.5 | % | 4.0-5.6"
        /([A-Za-z0-9\s\-]+)\s*\|\s*([0-9.]+)\s*\|\s*([A-Za-z/%]+)?\s*\|\s*([0-9.\-\s]+)/gi,

        // Pattern 3: "Test Name    Value    Unit    Reference"
        // Example: "Creatinine    1.2    mg/dL    0.7-1.3"
        /([A-Za-z0-9\s\-]+)\s{2,}([0-9.]+)\s{2,}([A-Za-z/%]+)?\s{2,}([0-9.\-\s]+)/gi
    ];

    // Try each pattern
    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            const testName = match[1].trim();
            const testValue = match[2].trim();
            const unit = match[3]?.trim();
            const referenceRange = match[4]?.trim();

            // Parse numeric value
            const numericValue = parseFloat(testValue);

            // Parse reference range
            let referenceRangeLow: number | undefined;
            let referenceRangeHigh: number | undefined;
            if (referenceRange) {
                const rangeParts = referenceRange.split('-');
                if (rangeParts.length === 2) {
                    referenceRangeLow = parseFloat(rangeParts[0].trim());
                    referenceRangeHigh = parseFloat(rangeParts[1].trim());
                }
            }

            // Determine interpretation
            let interpretation: 'Normal' | 'Low' | 'High' | 'Critical' | 'Abnormal' = 'Normal';
            let isCritical = false;
            let isAbnormal = false;

            if (!isNaN(numericValue) && referenceRangeLow !== undefined && referenceRangeHigh !== undefined) {
                if (numericValue < referenceRangeLow) {
                    interpretation = 'Low';
                    isAbnormal = true;
                    // Critical if significantly below range (e.g., < 50% of low range)
                    if (numericValue < referenceRangeLow * 0.5) {
                        interpretation = 'Critical';
                        isCritical = true;
                    }
                } else if (numericValue > referenceRangeHigh) {
                    interpretation = 'High';
                    isAbnormal = true;
                    // Critical if significantly above range (e.g., > 150% of high range)
                    if (numericValue > referenceRangeHigh * 1.5) {
                        interpretation = 'Critical';
                        isCritical = true;
                    }
                }
            }

            results.push({
                testName,
                testValue,
                numericValue: !isNaN(numericValue) ? numericValue : undefined,
                unit,
                referenceRange,
                referenceRangeLow,
                referenceRangeHigh,
                interpretation,
                isCritical,
                isAbnormal
            });
        }
    }

    logger.info('Extracted lab results from text', {
        resultsCount: results.length
    });

    return results;
};

/**
 * Extract metadata from parsed text
 */
const extractMetadataFromText = (text: string): PDFParseResult['metadata'] => {
    const metadata: PDFParseResult['metadata'] = {};

    // Extract laboratory name (usually at the top)
    const labNameMatch = text.match(/Laboratory:?\s*([A-Za-z0-9\s&,.-]+)/i);
    if (labNameMatch) {
        metadata.laboratoryName = labNameMatch[1].trim();
    }

    // Extract patient name
    const patientNameMatch = text.match(/Patient:?\s*([A-Za-z\s]+)/i);
    if (patientNameMatch) {
        metadata.patientName = patientNameMatch[1].trim();
    }

    // Extract accession number
    const accessionMatch = text.match(/Accession:?\s*([A-Z0-9-]+)/i);
    if (accessionMatch) {
        metadata.accessionNumber = accessionMatch[1].trim();
    }

    // Extract test date
    const testDateMatch = text.match(/(?:Test|Collection)\s*Date:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
    if (testDateMatch) {
        metadata.testDate = new Date(testDateMatch[1]);
    }

    // Extract report date
    const reportDateMatch = text.match(/(?:Report|Reported)\s*Date:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
    if (reportDateMatch) {
        metadata.reportDate = new Date(reportDateMatch[1]);
    }

    return metadata;
};

/**
 * Validate parsed results
 */
export const validateParsedResults = (results: ParsedLabResult[]): {
    valid: boolean;
    errors: string[];
} => {
    const errors: string[] = [];

    if (results.length === 0) {
        errors.push('No lab results found in PDF');
    }

    results.forEach((result, index) => {
        if (!result.testName || result.testName.trim() === '') {
            errors.push(`Result ${index + 1}: Missing test name`);
        }
        if (!result.testValue || result.testValue.trim() === '') {
            errors.push(`Result ${index + 1}: Missing test value`);
        }
    });

    return {
        valid: errors.length === 0,
        errors
    };
};

export default {
    parseLabResultPDF,
    validateParsedResults
};

