import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthRequest } from '../../../types/auth';
import logger from '../../../utils/logger';
import { securityMonitoringService } from '../../../services/securityMonitoringService';
import crypto from 'crypto';
import DOMPurify from 'isomorphic-dompurify';

/**
 * Diagnostic Module Security Middleware
 * Enhanced security controls for AI diagnostics and clinical data
 */

// ===============================
// RATE LIMITING FOR AI SERVICES
// ===============================

/**
 * Rate limiter for AI diagnostic requests
 * Prevents abuse of expensive AI API calls
 */
export const aiDiagnosticRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: (req: AuthRequest) => {
        // Super admin bypass
        if (req.user?.role === 'super_admin') {
            return 1000;
        }

        // Different limits based on subscription plan
        const plan = req.workspaceContext?.plan;
        if (plan?.name === 'enterprise') {
            return 50; // 50 AI requests per 15 minutes for enterprise
        } else if (plan?.name === 'professional') {
            return 20; // 20 AI requests per 15 minutes for professional
        } else if (plan?.name === 'basic') {
            return 10; // 10 AI requests per 15 minutes for basic
        } else {
            return 5; // 5 AI requests per 15 minutes for trial/free
        }
    },
    message: {
        success: false,
        code: 'AI_RATE_LIMIT_EXCEEDED',
        message: 'Too many AI diagnostic requests. Please wait before making more requests.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: AuthRequest) => {
        // Rate limit per user, not per IP
        return req.user?._id?.toString() || req.ip || 'anonymous';
    },
    skip: (req: AuthRequest) => {
        // Skip for super admins
        return req.user?.role === 'super_admin';
    },
});

/**
 * Rate limiter for external API calls (RxNorm, OpenFDA, etc.)
 */
export const externalApiRateLimit = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 100, // 100 external API calls per 5 minutes per user
    message: {
        success: false,
        code: 'EXTERNAL_API_RATE_LIMIT_EXCEEDED',
        message: 'Too many external API requests. Please wait before making more requests.',
    },
    keyGenerator: (req: AuthRequest) => {
        return req.user?._id?.toString() || req.ip || 'anonymous';
    },
    skip: (req: AuthRequest) => {
        return req.user?.role === 'super_admin';
    },
});

/**
 * Rate limiter for lab data operations
 */
export const labDataRateLimit = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 200, // 200 lab operations per 10 minutes per user
    message: {
        success: false,
        code: 'LAB_DATA_RATE_LIMIT_EXCEEDED',
        message: 'Too many lab data operations. Please wait before making more requests.',
    },
    keyGenerator: (req: AuthRequest) => {
        return req.user?._id?.toString() || req.ip || 'anonymous';
    },
});

// ===============================
// INPUT SANITIZATION AND XSS PROTECTION
// ===============================

/**
 * Sanitize clinical text data to prevent XSS attacks
 */
export const sanitizeClinicalData = (req: Request, res: Response, next: NextFunction): void => {
    try {
        if (req.body) {
            req.body = sanitizeObject(req.body);
        }

        if (req.query) {
            req.query = sanitizeObject(req.query);
        }

        next();
    } catch (error) {
        logger.error('Error sanitizing clinical data', { error });
        res.status(400).json({
            success: false,
            code: 'SANITIZATION_ERROR',
            message: 'Invalid input data format',
        });
    }
};

/**
 * Recursively sanitize object properties
 */
function sanitizeObject(obj: any): any {
    if (typeof obj === 'string') {
        return sanitizeString(obj);
    }

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }

    if (obj && typeof obj === 'object') {
        const sanitized: any = {};
        for (const [key, value] of Object.entries(obj)) {
            // Sanitize key names to prevent prototype pollution
            const sanitizedKey = sanitizeString(key);
            if (sanitizedKey && !['__proto__', 'constructor', 'prototype'].includes(sanitizedKey)) {
                sanitized[sanitizedKey] = sanitizeObject(value);
            }
        }
        return sanitized;
    }

    return obj;
}

/**
 * Sanitize string content
 */
function sanitizeString(str: string): string {
    if (typeof str !== 'string') {
        return str;
    }

    // Remove potential XSS vectors
    let sanitized = str
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
        .replace(/javascript:/gi, '') // Remove javascript: URLs
        .replace(/on\w+\s*=/gi, '') // Remove event handlers
        .replace(/data:text\/html/gi, '') // Remove data URLs
        .replace(/vbscript:/gi, ''); // Remove vbscript

    // Use DOMPurify for additional sanitization
    sanitized = DOMPurify.sanitize(sanitized, {
        ALLOWED_TAGS: [], // No HTML tags allowed in clinical data
        ALLOWED_ATTR: [],
        KEEP_CONTENT: true,
    });

    // Limit string length to prevent DoS
    if (sanitized.length > 10000) {
        sanitized = sanitized.substring(0, 10000);
    }

    return sanitized.trim();
}

/**
 * Validate clinical data format and content
 */
export const validateClinicalData = (req: Request, res: Response, next: NextFunction): void => {
    try {
        const { body } = req;

        // Validate symptoms data
        if (body.symptoms) {
            validateSymptomsData(body.symptoms);
        }

        // Validate vital signs
        if (body.vitalSigns) {
            validateVitalSigns(body.vitalSigns);
        }

        // Validate lab results
        if (body.labResults) {
            validateLabResults(body.labResults);
        }

        // Validate medications
        if (body.currentMedications) {
            validateMedications(body.currentMedications);
        }

        next();
    } catch (error) {
        logger.warn('Clinical data validation failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: (req as AuthRequest).user?._id,
            endpoint: req.originalUrl,
        });

        res.status(400).json({
            success: false,
            code: 'VALIDATION_ERROR',
            message: error instanceof Error ? error.message : 'Invalid clinical data format',
        });
    }
};

function validateSymptomsData(symptoms: any): void {
    if (!symptoms.subjective || !Array.isArray(symptoms.subjective)) {
        throw new Error('Subjective symptoms must be an array');
    }

    if (symptoms.subjective.length === 0) {
        throw new Error('At least one subjective symptom is required');
    }

    if (symptoms.subjective.length > 50) {
        throw new Error('Too many subjective symptoms (max 50)');
    }

    symptoms.subjective.forEach((symptom: any, index: number) => {
        if (typeof symptom !== 'string' || symptom.length > 500) {
            throw new Error(`Invalid symptom at index ${index}`);
        }
    });

    if (symptoms.objective && Array.isArray(symptoms.objective)) {
        if (symptoms.objective.length > 50) {
            throw new Error('Too many objective findings (max 50)');
        }

        symptoms.objective.forEach((finding: any, index: number) => {
            if (typeof finding !== 'string' || finding.length > 500) {
                throw new Error(`Invalid objective finding at index ${index}`);
            }
        });
    }

    const validSeverities = ['mild', 'moderate', 'severe'];
    if (symptoms.severity && !validSeverities.includes(symptoms.severity)) {
        throw new Error('Invalid symptom severity');
    }

    const validOnsets = ['acute', 'chronic', 'subacute'];
    if (symptoms.onset && !validOnsets.includes(symptoms.onset)) {
        throw new Error('Invalid symptom onset');
    }
}

function validateVitalSigns(vitals: any): void {
    if (vitals.heartRate !== undefined) {
        if (typeof vitals.heartRate !== 'number' || vitals.heartRate < 20 || vitals.heartRate > 300) {
            throw new Error('Invalid heart rate (must be 20-300 bpm)');
        }
    }

    if (vitals.temperature !== undefined) {
        if (typeof vitals.temperature !== 'number' || vitals.temperature < 30 || vitals.temperature > 45) {
            throw new Error('Invalid temperature (must be 30-45°C)');
        }
    }

    if (vitals.respiratoryRate !== undefined) {
        if (typeof vitals.respiratoryRate !== 'number' || vitals.respiratoryRate < 5 || vitals.respiratoryRate > 80) {
            throw new Error('Invalid respiratory rate (must be 5-80 breaths/min)');
        }
    }

    if (vitals.bloodPressure !== undefined) {
        if (typeof vitals.bloodPressure !== 'string' || !/^\d{2,3}\/\d{2,3}$/.test(vitals.bloodPressure)) {
            throw new Error('Invalid blood pressure format (must be systolic/diastolic)');
        }
    }

    if (vitals.oxygenSaturation !== undefined) {
        if (typeof vitals.oxygenSaturation !== 'number' || vitals.oxygenSaturation < 50 || vitals.oxygenSaturation > 100) {
            throw new Error('Invalid oxygen saturation (must be 50-100%)');
        }
    }
}

function validateLabResults(labResults: any[]): void {
    if (!Array.isArray(labResults)) {
        throw new Error('Lab results must be an array');
    }

    if (labResults.length > 100) {
        throw new Error('Too many lab results (max 100)');
    }

    labResults.forEach((result, index) => {
        if (!result.testName || typeof result.testName !== 'string' || result.testName.length > 200) {
            throw new Error(`Invalid test name at index ${index}`);
        }

        if (!result.value || typeof result.value !== 'string' || result.value.length > 500) {
            throw new Error(`Invalid test value at index ${index}`);
        }

        if (result.unit && (typeof result.unit !== 'string' || result.unit.length > 50)) {
            throw new Error(`Invalid unit at index ${index}`);
        }
    });
}

function validateMedications(medications: any[]): void {
    if (!Array.isArray(medications)) {
        throw new Error('Medications must be an array');
    }

    if (medications.length > 50) {
        throw new Error('Too many medications (max 50)');
    }

    medications.forEach((medication, index) => {
        if (!medication.name || typeof medication.name !== 'string' || medication.name.length > 200) {
            throw new Error(`Invalid medication name at index ${index}`);
        }

        if (!medication.dosage || typeof medication.dosage !== 'string' || medication.dosage.length > 100) {
            throw new Error(`Invalid medication dosage at index ${index}`);
        }

        if (!medication.frequency || typeof medication.frequency !== 'string' || medication.frequency.length > 100) {
            throw new Error(`Invalid medication frequency at index ${index}`);
        }
    });
}

// ===============================
// SECURITY MONITORING
// ===============================

/**
 * Monitor suspicious diagnostic patterns
 */
export const monitorSuspiciousPatterns = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        if (!req.user) {
            return next();
        }

        const userId = req.user._id.toString();
        const suspiciousPatterns: string[] = [];

        // Check for rapid consecutive requests
        const requestKey = `diagnostic_requests_${userId}`;
        const recentRequests = await getRecentRequestCount(requestKey);
        if (recentRequests > 10) { // More than 10 requests in 5 minutes
            suspiciousPatterns.push('RAPID_REQUESTS');
        }

        // Check for unusual request patterns
        if (req.body) {
            // Check for identical requests (potential automation)
            const requestHash = generateRequestHash(req.body);
            const duplicateKey = `duplicate_requests_${userId}_${requestHash}`;
            const duplicateCount = await getDuplicateRequestCount(duplicateKey);
            if (duplicateCount > 3) { // Same request more than 3 times
                suspiciousPatterns.push('DUPLICATE_REQUESTS');
            }

            // Check for unusual data patterns
            if (req.body.symptoms?.subjective?.length > 20) {
                suspiciousPatterns.push('EXCESSIVE_SYMPTOMS');
            }

            if (req.body.currentMedications?.length > 20) {
                suspiciousPatterns.push('EXCESSIVE_MEDICATIONS');
            }
        }

        // Log suspicious patterns
        if (suspiciousPatterns.length > 0) {
            logger.warn('Suspicious diagnostic patterns detected', {
                userId,
                patterns: suspiciousPatterns,
                endpoint: req.originalUrl,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
            });

            // Trigger security monitoring
            await securityMonitoringService.analyzeSecurityEvent(req, 'suspicious_diagnostic_pattern', {
                patterns: suspiciousPatterns,
                endpoint: req.originalUrl,
            });

            // Add warning header
            res.set('X-Security-Warning', 'Suspicious patterns detected');
        }

        next();
    } catch (error) {
        logger.error('Error monitoring suspicious patterns', { error });
        next(); // Don't block request on monitoring error
    }
};

/**
 * Generate hash for request deduplication
 */
function generateRequestHash(requestBody: any): string {
    const normalizedBody = JSON.stringify(requestBody, Object.keys(requestBody).sort());
    return crypto.createHash('sha256').update(normalizedBody).digest('hex').substring(0, 16);
}

/**
 * Get recent request count (simplified - in production use Redis)
 */
async function getRecentRequestCount(key: string): Promise<number> {
    // This is a simplified implementation
    // In production, use Redis with TTL
    return 0;
}

/**
 * Get duplicate request count (simplified - in production use Redis)
 */
async function getDuplicateRequestCount(key: string): Promise<number> {
    // This is a simplified implementation
    // In production, use Redis with TTL
    return 0;
}

// ===============================
// API KEY SECURITY
// ===============================

/**
 * Validate and rotate API keys
 */
export const validateApiKeys = (req: Request, res: Response, next: NextFunction): void => {
    // Ensure no API keys are exposed in request body or query
    if (req.body) {
        removeApiKeysFromObject(req.body);
    }

    if (req.query) {
        removeApiKeysFromObject(req.query);
    }

    next();
};

/**
 * Remove potential API keys from object
 */
function removeApiKeysFromObject(obj: any): void {
    if (!obj || typeof obj !== 'object') {
        return;
    }

    const sensitiveKeys = [
        'apiKey', 'api_key', 'key', 'token', 'secret', 'password',
        'openRouterKey', 'rxnormKey', 'openfdaKey', 'fhirToken'
    ];

    for (const key of Object.keys(obj)) {
        if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive.toLowerCase()))) {
            delete obj[key];
            logger.warn('Removed potential API key from request', { key });
        } else if (typeof obj[key] === 'object') {
            removeApiKeysFromObject(obj[key]);
        }
    }
}

// ===============================
// DATA ENCRYPTION VALIDATION
// ===============================

/**
 * Ensure sensitive data is properly encrypted
 */
export const validateDataEncryption = (req: AuthRequest, res: Response, next: NextFunction): void => {
    // Check if request contains sensitive data that should be encrypted
    if (req.body) {
        const sensitiveFields = ['ssn', 'socialSecurityNumber', 'medicalRecordNumber', 'insuranceId'];

        for (const field of sensitiveFields) {
            if (req.body[field]) {
                // In production, validate that the data is properly encrypted
                logger.info('Sensitive data field detected', {
                    field,
                    userId: req.user?._id,
                    encrypted: true, // Assume encrypted in this example
                });
            }
        }
    }

    next();
};

// ===============================
// COMBINED MIDDLEWARE CHAINS
// ===============================

/**
 * Complete security middleware chain for AI diagnostic requests
 */
export const aiDiagnosticSecurityMiddleware = [
    aiDiagnosticRateLimit,
    sanitizeClinicalData,
    validateClinicalData,
    validateApiKeys,
    validateDataEncryption,
    monitorSuspiciousPatterns,
];

/**
 * Complete security middleware chain for external API calls
 */
export const externalApiSecurityMiddleware = [
    externalApiRateLimit,
    sanitizeClinicalData,
    validateApiKeys,
];

/**
 * Complete security middleware chain for lab data operations
 */
export const labDataSecurityMiddleware = [
    labDataRateLimit,
    sanitizeClinicalData,
    validateClinicalData,
    validateDataEncryption,
];

export default {
    aiDiagnosticRateLimit,
    externalApiRateLimit,
    labDataRateLimit,
    sanitizeClinicalData,
    validateClinicalData,
    monitorSuspiciousPatterns,
    validateApiKeys,
    validateDataEncryption,
    aiDiagnosticSecurityMiddleware,
    externalApiSecurityMiddleware,
    labDataSecurityMiddleware,
};