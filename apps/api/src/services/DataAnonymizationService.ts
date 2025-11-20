import crypto from 'crypto';
import logger from '../utils/logger';

/**
 * Data Anonymization Service
 * Provides methods to anonymize sensitive data in reports while maintaining analytical value
 */

export interface AnonymizationOptions {
    method: 'hash' | 'mask' | 'generalize' | 'suppress' | 'pseudonymize';
    preserveFormat?: boolean;
    salt?: string;
    maskChar?: string;
    generalizationLevel?: number;
}

export interface AnonymizationResult {
    originalValue: any;
    anonymizedValue: any;
    method: string;
    reversible: boolean;
    metadata?: Record<string, any>;
}

class DataAnonymizationService {
    private static instance: DataAnonymizationService;
    private readonly defaultSalt: string;
    private readonly pseudonymMap: Map<string, string> = new Map();

    private constructor() {
        this.defaultSalt = process.env.ANONYMIZATION_SALT || 'default-salt-change-in-production';
    }

    public static getInstance(): DataAnonymizationService {
        if (!DataAnonymizationService.instance) {
            DataAnonymizationService.instance = new DataAnonymizationService();
        }
        return DataAnonymizationService.instance;
    }

    /**
     * Anonymize patient identifiers
     */
    public anonymizePatientId(patientId: string, options: AnonymizationOptions = { method: 'hash' }): AnonymizationResult {
        try {
            let anonymizedValue: string;
            let reversible = false;

            switch (options.method) {
                case 'hash':
                    anonymizedValue = this.hashValue(patientId, options.salt);
                    break;
                case 'pseudonymize':
                    anonymizedValue = this.pseudonymizeValue(patientId, 'patient');
                    reversible = true;
                    break;
                case 'mask':
                    anonymizedValue = this.maskValue(patientId, options.maskChar || '*');
                    break;
                case 'suppress':
                    anonymizedValue = '[SUPPRESSED]';
                    break;
                default:
                    anonymizedValue = this.hashValue(patientId, options.salt);
            }

            return {
                originalValue: patientId,
                anonymizedValue,
                method: options.method,
                reversible,
                metadata: {
                    dataType: 'patientId',
                    timestamp: new Date().toISOString()
                }
            };
        } catch (error) {
            logger.error('Error anonymizing patient ID:', error);
            return {
                originalValue: patientId,
                anonymizedValue: '[ANONYMIZATION_ERROR]',
                method: 'error',
                reversible: false
            };
        }
    }

    /**
     * Anonymize personal names
     */
    public anonymizeName(name: string, options: AnonymizationOptions = { method: 'mask' }): AnonymizationResult {
        try {
            let anonymizedValue: string;
            let reversible = false;

            switch (options.method) {
                case 'hash':
                    anonymizedValue = this.hashValue(name, options.salt);
                    break;
                case 'mask':
                    anonymizedValue = this.maskName(name, options.maskChar || '*');
                    break;
                case 'generalize':
                    anonymizedValue = this.generalizeName(name);
                    break;
                case 'pseudonymize':
                    anonymizedValue = this.pseudonymizeValue(name, 'name');
                    reversible = true;
                    break;
                case 'suppress':
                    anonymizedValue = '[NAME_SUPPRESSED]';
                    break;
                default:
                    anonymizedValue = this.maskName(name, options.maskChar || '*');
            }

            return {
                originalValue: name,
                anonymizedValue,
                method: options.method,
                reversible,
                metadata: {
                    dataType: 'name',
                    timestamp: new Date().toISOString()
                }
            };
        } catch (error) {
            logger.error('Error anonymizing name:', error);
            return {
                originalValue: name,
                anonymizedValue: '[ANONYMIZATION_ERROR]',
                method: 'error',
                reversible: false
            };
        }
    }

    /**
     * Anonymize age data with generalization
     */
    public anonymizeAge(age: number, options: AnonymizationOptions = { method: 'generalize', generalizationLevel: 5 }): AnonymizationResult {
        try {
            let anonymizedValue: string | number;

            switch (options.method) {
                case 'generalize':
                    const level = options.generalizationLevel || 5;
                    const ageGroup = Math.floor(age / level) * level;
                    anonymizedValue = `${ageGroup}-${ageGroup + level - 1}`;
                    break;
                case 'suppress':
                    anonymizedValue = '[AGE_SUPPRESSED]';
                    break;
                case 'hash':
                    anonymizedValue = this.hashValue(age.toString(), options.salt);
                    break;
                default:
                    const defaultLevel = 10;
                    const defaultAgeGroup = Math.floor(age / defaultLevel) * defaultLevel;
                    anonymizedValue = `${defaultAgeGroup}-${defaultAgeGroup + defaultLevel - 1}`;
            }

            return {
                originalValue: age,
                anonymizedValue,
                method: options.method,
                reversible: false,
                metadata: {
                    dataType: 'age',
                    generalizationLevel: options.generalizationLevel,
                    timestamp: new Date().toISOString()
                }
            };
        } catch (error) {
            logger.error('Error anonymizing age:', error);
            return {
                originalValue: age,
                anonymizedValue: '[ANONYMIZATION_ERROR]',
                method: 'error',
                reversible: false
            };
        }
    }

    /**
     * Anonymize location data
     */
    public anonymizeLocation(location: string, options: AnonymizationOptions = { method: 'generalize' }): AnonymizationResult {
        try {
            let anonymizedValue: string;

            switch (options.method) {
                case 'generalize':
                    anonymizedValue = this.generalizeLocation(location);
                    break;
                case 'hash':
                    anonymizedValue = this.hashValue(location, options.salt);
                    break;
                case 'suppress':
                    anonymizedValue = '[LOCATION_SUPPRESSED]';
                    break;
                case 'mask':
                    anonymizedValue = this.maskValue(location, options.maskChar || '*');
                    break;
                default:
                    anonymizedValue = this.generalizeLocation(location);
            }

            return {
                originalValue: location,
                anonymizedValue,
                method: options.method,
                reversible: false,
                metadata: {
                    dataType: 'location',
                    timestamp: new Date().toISOString()
                }
            };
        } catch (error) {
            logger.error('Error anonymizing location:', error);
            return {
                originalValue: location,
                anonymizedValue: '[ANONYMIZATION_ERROR]',
                method: 'error',
                reversible: false
            };
        }
    }

    /**
     * Anonymize financial data
     */
    public anonymizeFinancialData(amount: number, options: AnonymizationOptions = { method: 'generalize' }): AnonymizationResult {
        try {
            let anonymizedValue: string | number;

            switch (options.method) {
                case 'generalize':
                    // Round to nearest thousand for amounts over 10,000
                    if (amount > 10000) {
                        anonymizedValue = Math.round(amount / 1000) * 1000;
                    } else if (amount > 1000) {
                        anonymizedValue = Math.round(amount / 100) * 100;
                    } else {
                        anonymizedValue = Math.round(amount / 10) * 10;
                    }
                    break;
                case 'suppress':
                    anonymizedValue = '[AMOUNT_SUPPRESSED]';
                    break;
                case 'hash':
                    anonymizedValue = this.hashValue(amount.toString(), options.salt);
                    break;
                default:
                    anonymizedValue = Math.round(amount / 100) * 100;
            }

            return {
                originalValue: amount,
                anonymizedValue,
                method: options.method,
                reversible: false,
                metadata: {
                    dataType: 'financial',
                    timestamp: new Date().toISOString()
                }
            };
        } catch (error) {
            logger.error('Error anonymizing financial data:', error);
            return {
                originalValue: amount,
                anonymizedValue: '[ANONYMIZATION_ERROR]',
                method: 'error',
                reversible: false
            };
        }
    }

    /**
     * Anonymize a complete report dataset
     */
    public anonymizeReportData(data: any[], sensitiveFields: string[], options: Record<string, AnonymizationOptions> = {}): any[] {
        try {
            return data.map(record => {
                const anonymizedRecord = { ...record };

                sensitiveFields.forEach(field => {
                    if (record[field] !== undefined && record[field] !== null) {
                        const fieldOptions = options[field] || { method: 'hash' };
                        const result = this.anonymizeValue(record[field], field, fieldOptions);
                        anonymizedRecord[field] = result.anonymizedValue;

                        // Add anonymization metadata
                        if (!anonymizedRecord._anonymization) {
                            anonymizedRecord._anonymization = {};
                        }
                        anonymizedRecord._anonymization[field] = {
                            method: result.method,
                            reversible: result.reversible,
                            timestamp: result.metadata?.timestamp
                        };
                    }
                });

                return anonymizedRecord;
            });
        } catch (error) {
            logger.error('Error anonymizing report data:', error);
            return data; // Return original data if anonymization fails
        }
    }

    /**
     * Check if data should be anonymized based on user permissions and data sensitivity
     */
    public shouldAnonymizeData(userPermissions: string[], dataType: string, reportType: string): boolean {
        // Define sensitive data types that require anonymization
        const sensitiveDataTypes = [
            'patient-outcomes',
            'patient-demographics',
            'adverse-events',
            'therapy-effectiveness'
        ];

        // Define permissions that allow access to non-anonymized data
        const fullAccessPermissions = [
            'view_full_patient_data',
            'view_identifiable_data',
            'admin_access',
            'super_admin'
        ];

        // Check if report type contains sensitive data
        const containsSensitiveData = sensitiveDataTypes.includes(reportType);

        // Check if user has full access permissions
        const hasFullAccess = userPermissions.some(permission =>
            fullAccessPermissions.includes(permission)
        );

        // Anonymize if data is sensitive and user doesn't have full access
        return containsSensitiveData && !hasFullAccess;
    }

    /**
     * Generate anonymization summary for audit purposes
     */
    public generateAnonymizationSummary(originalData: any[], anonymizedData: any[], sensitiveFields: string[]): any {
        return {
            totalRecords: originalData.length,
            anonymizedRecords: anonymizedData.length,
            sensitiveFields,
            anonymizationMethods: this.getUsedMethods(anonymizedData),
            dataIntegrityCheck: this.validateDataIntegrity(originalData, anonymizedData),
            timestamp: new Date().toISOString()
        };
    }

    // Private helper methods

    private hashValue(value: string, salt?: string): string {
        const actualSalt = salt || this.defaultSalt;
        return crypto.createHash('sha256').update(value + actualSalt).digest('hex').substring(0, 16);
    }

    private maskValue(value: string, maskChar: string = '*'): string {
        if (value.length <= 2) {
            return maskChar.repeat(value.length);
        }
        return value.charAt(0) + maskChar.repeat(value.length - 2) + value.charAt(value.length - 1);
    }

    private maskName(name: string, maskChar: string = '*'): string {
        const parts = name.split(' ');
        return parts.map(part => {
            if (part.length <= 1) return part;
            return part.charAt(0) + maskChar.repeat(Math.max(1, part.length - 1));
        }).join(' ');
    }

    private generalizeName(name: string): string {
        const parts = name.split(' ');
        if (parts.length === 1) {
            return `${parts[0].charAt(0)}. [SURNAME]`;
        }
        return `${parts[0].charAt(0)}. ${parts[parts.length - 1].charAt(0)}.`;
    }

    private generalizeLocation(location: string): string {
        // Simple location generalization - in production, use proper geographic hierarchies
        const parts = location.split(',').map(part => part.trim());

        if (parts.length >= 2) {
            // Return only the state/region and country
            return parts.slice(-2).join(', ');
        }

        return '[LOCATION_GENERALIZED]';
    }

    private pseudonymizeValue(value: string, type: string): string {
        const key = `${type}:${value}`;

        if (this.pseudonymMap.has(key)) {
            return this.pseudonymMap.get(key)!;
        }

        const pseudonym = this.generatePseudonym(type);
        this.pseudonymMap.set(key, pseudonym);
        return pseudonym;
    }

    private generatePseudonym(type: string): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `${type.toUpperCase()}_${timestamp}_${random}`;
    }

    private anonymizeValue(value: any, fieldType: string, options: AnonymizationOptions): AnonymizationResult {
        switch (fieldType) {
            case 'patientId':
            case 'patient_id':
                return this.anonymizePatientId(value.toString(), options);
            case 'name':
            case 'patientName':
            case 'patient_name':
                return this.anonymizeName(value.toString(), options);
            case 'age':
                return this.anonymizeAge(typeof value === 'number' ? value : parseInt(value), options);
            case 'location':
            case 'address':
                return this.anonymizeLocation(value.toString(), options);
            case 'cost':
            case 'amount':
            case 'price':
                return this.anonymizeFinancialData(typeof value === 'number' ? value : parseFloat(value), options);
            default:
                // Default to hashing for unknown field types
                return {
                    originalValue: value,
                    anonymizedValue: this.hashValue(value.toString(), options.salt),
                    method: 'hash',
                    reversible: false,
                    metadata: {
                        dataType: fieldType,
                        timestamp: new Date().toISOString()
                    }
                };
        }
    }

    private getUsedMethods(anonymizedData: any[]): string[] {
        const methods = new Set<string>();

        anonymizedData.forEach(record => {
            if (record._anonymization) {
                Object.values(record._anonymization).forEach((meta: any) => {
                    if (meta.method) {
                        methods.add(meta.method);
                    }
                });
            }
        });

        return Array.from(methods);
    }

    private validateDataIntegrity(originalData: any[], anonymizedData: any[]): boolean {
        // Basic integrity checks
        if (originalData.length !== anonymizedData.length) {
            return false;
        }

        // Check that anonymized data maintains the same structure
        if (originalData.length > 0 && anonymizedData.length > 0) {
            const originalKeys = Object.keys(originalData[0]).filter(key => !key.startsWith('_'));
            const anonymizedKeys = Object.keys(anonymizedData[0]).filter(key => !key.startsWith('_'));

            return originalKeys.length === anonymizedKeys.length &&
                originalKeys.every(key => anonymizedKeys.includes(key));
        }

        return true;
    }
}

export default DataAnonymizationService;