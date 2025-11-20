import crypto from 'crypto';
import logger from '../../../utils/logger';

/**
 * API Key Management Service
 * Secure management and rotation of external API keys for diagnostic services
 */

export interface ApiKeyConfig {
    id: string;
    name: string;
    service: 'openrouter' | 'rxnorm' | 'openfda' | 'fhir' | 'loinc';
    keyValue: string;
    encryptedValue: string;
    createdAt: Date;
    lastUsed?: Date;
    expiresAt?: Date;
    rotationInterval: number; // in milliseconds
    isActive: boolean;
    usageCount: number;
    maxUsage?: number;
    environment: 'development' | 'staging' | 'production';
}

export interface KeyRotationResult {
    success: boolean;
    oldKeyId: string;
    newKeyId: string;
    rotatedAt: Date;
    error?: string;
}

export interface KeyUsageMetrics {
    keyId: string;
    service: string;
    totalUsage: number;
    dailyUsage: number;
    weeklyUsage: number;
    monthlyUsage: number;
    lastUsed?: Date;
    averageResponseTime: number;
    errorRate: number;
}

class ApiKeyManagementService {
    private readonly encryptionKey: string;
    private readonly algorithm = 'aes-256-gcm';
    private apiKeys: Map<string, ApiKeyConfig> = new Map();

    constructor() {
        // In production, this should come from a secure environment variable
        this.encryptionKey = process.env.API_KEY_ENCRYPTION_KEY || this.generateEncryptionKey();
        this.initializeDefaultKeys();
    }

    /**
     * Generate a secure encryption key
     */
    private generateEncryptionKey(): string {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Initialize default API keys from environment variables
     */
    private initializeDefaultKeys(): void {
        const defaultKeys = [
            {
                name: 'OpenRouter API Key',
                service: 'openrouter' as const,
                envVar: 'OPENROUTER_API_KEY',
                rotationInterval: 30 * 24 * 60 * 60 * 1000, // 30 days
            },
            {
                name: 'RxNorm API Key',
                service: 'rxnorm' as const,
                envVar: 'RXNORM_API_KEY',
                rotationInterval: 90 * 24 * 60 * 60 * 1000, // 90 days
            },
            {
                name: 'OpenFDA API Key',
                service: 'openfda' as const,
                envVar: 'OPENFDA_API_KEY',
                rotationInterval: 90 * 24 * 60 * 60 * 1000, // 90 days
            },
            {
                name: 'FHIR API Key',
                service: 'fhir' as const,
                envVar: 'FHIR_API_KEY',
                rotationInterval: 60 * 24 * 60 * 60 * 1000, // 60 days
            },
        ];

        for (const keyConfig of defaultKeys) {
            const keyValue = process.env[keyConfig.envVar];
            if (keyValue) {
                try {
                    this.addApiKey({
                        name: keyConfig.name,
                        service: keyConfig.service,
                        keyValue,
                        rotationInterval: keyConfig.rotationInterval,
                        environment: (process.env.NODE_ENV as any) || 'development',
                    });
                } catch (error) {
                    logger.error(`Failed to initialize ${keyConfig.name}`, {
                        service: keyConfig.service,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }
        }
    }

    /**
     * Add a new API key
     */
    addApiKey(config: {
        name: string;
        service: ApiKeyConfig['service'];
        keyValue: string;
        rotationInterval?: number;
        maxUsage?: number;
        expiresAt?: Date;
        environment?: ApiKeyConfig['environment'];
    }): string {
        const keyId = crypto.randomUUID();
        const encryptedValue = this.encryptKey(config.keyValue);

        const apiKey: ApiKeyConfig = {
            id: keyId,
            name: config.name,
            service: config.service,
            keyValue: config.keyValue,
            encryptedValue,
            createdAt: new Date(),
            rotationInterval: config.rotationInterval || 30 * 24 * 60 * 60 * 1000, // 30 days default
            isActive: true,
            usageCount: 0,
            maxUsage: config.maxUsage,
            expiresAt: config.expiresAt,
            environment: config.environment || 'development',
        };

        this.apiKeys.set(keyId, apiKey);

        logger.info('API key added', {
            keyId,
            service: config.service,
            name: config.name,
            environment: apiKey.environment,
        });

        return keyId;
    }

    /**
     * Get API key for a service
     */
    getApiKey(service: ApiKeyConfig['service']): string | null {
        const activeKeys = Array.from(this.apiKeys.values())
            .filter(key => key.service === service && key.isActive && !this.isKeyExpired(key));

        if (activeKeys.length === 0) {
            logger.warn('No active API key found for service', { service });
            return null;
        }

        // Return the most recently created active key
        const latestKey = activeKeys.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]!;

        // Update usage tracking
        this.trackKeyUsage(latestKey.id);

        return latestKey.keyValue;
    }

    /**
     * Encrypt API key
     */
    private encryptKey(keyValue: string): string {
        try {
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipher(this.algorithm, this.encryptionKey);

            let encrypted = cipher.update(keyValue, 'utf8', 'hex');
            encrypted += cipher.final('hex');

            const authTag = cipher.getAuthTag();

            return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
        } catch (error) {
            logger.error('Failed to encrypt API key', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw new Error('Failed to encrypt API key');
        }
    }

    /**
     * Decrypt API key
     */
    private decryptKey(encryptedValue: string): string {
        try {
            const [ivHex, authTagHex, encrypted] = encryptedValue.split(':');

            if (!ivHex || !authTagHex || !encrypted) {
                throw new Error('Invalid encrypted key format');
            }

            const iv = Buffer.from(ivHex, 'hex');
            const authTag = Buffer.from(authTagHex, 'hex');

            const decipher = crypto.createDecipher(this.algorithm, this.encryptionKey);
            decipher.setAuthTag(authTag);

            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            return decrypted;
        } catch (error) {
            logger.error('Failed to decrypt API key', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw new Error('Failed to decrypt API key');
        }
    }

    /**
     * Check if API key is expired
     */
    private isKeyExpired(key: ApiKeyConfig): boolean {
        if (key.expiresAt && key.expiresAt < new Date()) {
            return true;
        }

        if (key.maxUsage && key.usageCount >= key.maxUsage) {
            return true;
        }

        return false;
    }

    /**
     * Check if API key needs rotation
     */
    needsRotation(keyId: string): boolean {
        const key = this.apiKeys.get(keyId);
        if (!key) {
            return false;
        }

        const rotationDue = new Date(key.createdAt.getTime() + key.rotationInterval);
        return new Date() >= rotationDue;
    }

    /**
     * Rotate API key
     */
    async rotateApiKey(keyId: string, newKeyValue: string): Promise<KeyRotationResult> {
        try {
            const oldKey = this.apiKeys.get(keyId);
            if (!oldKey) {
                return {
                    success: false,
                    oldKeyId: keyId,
                    newKeyId: '',
                    rotatedAt: new Date(),
                    error: 'API key not found',
                };
            }

            // Deactivate old key
            oldKey.isActive = false;
            this.apiKeys.set(keyId, oldKey);

            // Create new key
            const newKeyId = this.addApiKey({
                name: oldKey.name,
                service: oldKey.service,
                keyValue: newKeyValue,
                rotationInterval: oldKey.rotationInterval,
                maxUsage: oldKey.maxUsage,
                environment: oldKey.environment,
            });

            logger.info('API key rotated successfully', {
                oldKeyId: keyId,
                newKeyId,
                service: oldKey.service,
            });

            return {
                success: true,
                oldKeyId: keyId,
                newKeyId,
                rotatedAt: new Date(),
            };
        } catch (error) {
            logger.error('Failed to rotate API key', {
                keyId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            return {
                success: false,
                oldKeyId: keyId,
                newKeyId: '',
                rotatedAt: new Date(),
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Track API key usage
     */
    private trackKeyUsage(keyId: string): void {
        const key = this.apiKeys.get(keyId);
        if (key) {
            key.usageCount++;
            key.lastUsed = new Date();
            this.apiKeys.set(keyId, key);
        }
    }

    /**
     * Get API key usage metrics
     */
    getKeyUsageMetrics(keyId: string): KeyUsageMetrics | null {
        const key = this.apiKeys.get(keyId);
        if (!key) {
            return null;
        }

        // In a real implementation, these would be calculated from usage logs
        return {
            keyId,
            service: key.service,
            totalUsage: key.usageCount,
            dailyUsage: Math.floor(key.usageCount / 30), // Mock calculation
            weeklyUsage: Math.floor(key.usageCount / 4), // Mock calculation
            monthlyUsage: key.usageCount, // Mock calculation
            lastUsed: key.lastUsed,
            averageResponseTime: 150, // Mock value
            errorRate: 0.02, // Mock value (2% error rate)
        };
    }

    /**
     * Get all API keys (without sensitive data)
     */
    getAllApiKeys(): Array<Omit<ApiKeyConfig, 'keyValue' | 'encryptedValue'>> {
        return Array.from(this.apiKeys.values()).map(key => ({
            id: key.id,
            name: key.name,
            service: key.service,
            createdAt: key.createdAt,
            lastUsed: key.lastUsed,
            expiresAt: key.expiresAt,
            rotationInterval: key.rotationInterval,
            isActive: key.isActive,
            usageCount: key.usageCount,
            maxUsage: key.maxUsage,
            environment: key.environment,
        }));
    }

    /**
     * Get keys that need rotation
     */
    getKeysNeedingRotation(): Array<Omit<ApiKeyConfig, 'keyValue' | 'encryptedValue'>> {
        return this.getAllApiKeys().filter(key => this.needsRotation(key.id));
    }

    /**
     * Deactivate API key
     */
    deactivateApiKey(keyId: string): boolean {
        const key = this.apiKeys.get(keyId);
        if (key) {
            key.isActive = false;
            this.apiKeys.set(keyId, key);

            logger.info('API key deactivated', {
                keyId,
                service: key.service,
                name: key.name,
            });

            return true;
        }

        return false;
    }

    /**
     * Delete API key
     */
    deleteApiKey(keyId: string): boolean {
        const key = this.apiKeys.get(keyId);
        if (key) {
            this.apiKeys.delete(keyId);

            logger.info('API key deleted', {
                keyId,
                service: key.service,
                name: key.name,
            });

            return true;
        }

        return false;
    }

    /**
     * Validate API key format
     */
    validateApiKeyFormat(service: ApiKeyConfig['service'], keyValue: string): {
        isValid: boolean;
        errors: string[];
    } {
        const errors: string[] = [];

        if (!keyValue || keyValue.trim().length === 0) {
            errors.push('API key cannot be empty');
        }

        // Service-specific validation
        switch (service) {
            case 'openrouter':
                if (!keyValue.startsWith('sk-or-')) {
                    errors.push('OpenRouter API key must start with "sk-or-"');
                }
                if (keyValue.length < 20) {
                    errors.push('OpenRouter API key is too short');
                }
                break;

            case 'rxnorm':
                // RxNorm typically doesn't require API keys, but if they do:
                if (keyValue.length < 10) {
                    errors.push('RxNorm API key is too short');
                }
                break;

            case 'openfda':
                // OpenFDA API keys are typically UUIDs
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
                if (!uuidRegex.test(keyValue)) {
                    errors.push('OpenFDA API key must be a valid UUID');
                }
                break;

            case 'fhir':
                // FHIR tokens can vary, basic length check
                if (keyValue.length < 16) {
                    errors.push('FHIR API key is too short');
                }
                break;

            default:
                errors.push('Unknown service type');
        }

        return {
            isValid: errors.length === 0,
            errors,
        };
    }

    /**
     * Test API key connectivity
     */
    async testApiKey(keyId: string): Promise<{
        success: boolean;
        responseTime: number;
        error?: string;
    }> {
        const key = this.apiKeys.get(keyId);
        if (!key) {
            return {
                success: false,
                responseTime: 0,
                error: 'API key not found',
            };
        }

        const startTime = Date.now();

        try {
            // Mock API test - in production, make actual API calls
            await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

            const responseTime = Date.now() - startTime;

            // Simulate occasional failures
            if (Math.random() < 0.1) {
                throw new Error('API test failed');
            }

            return {
                success: true,
                responseTime,
            };
        } catch (error) {
            const responseTime = Date.now() - startTime;

            return {
                success: false,
                responseTime,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Get service health status
     */
    getServiceHealthStatus(): Record<ApiKeyConfig['service'], {
        hasActiveKey: boolean;
        keyCount: number;
        needsRotation: boolean;
        lastTested?: Date;
        isHealthy: boolean;
    }> {
        const services: ApiKeyConfig['service'][] = ['openrouter', 'rxnorm', 'openfda', 'fhir', 'loinc'];
        const status: Record<ApiKeyConfig['service'], any> = {} as any;

        for (const service of services) {
            const serviceKeys = Array.from(this.apiKeys.values()).filter(key => key.service === service);
            const activeKeys = serviceKeys.filter(key => key.isActive && !this.isKeyExpired(key));
            const needsRotation = serviceKeys.some(key => this.needsRotation(key.id));

            status[service] = {
                hasActiveKey: activeKeys.length > 0,
                keyCount: serviceKeys.length,
                needsRotation,
                isHealthy: activeKeys.length > 0 && !needsRotation,
            };
        }

        return status;
    }

    /**
     * Cleanup expired keys
     */
    cleanupExpiredKeys(): number {
        let cleanedCount = 0;
        const now = new Date();

        for (const [keyId, key] of this.apiKeys.entries()) {
            if (this.isKeyExpired(key) && !key.isActive) {
                // Only delete keys that have been inactive for more than 30 days
                const inactiveFor = now.getTime() - (key.lastUsed?.getTime() || key.createdAt.getTime());
                if (inactiveFor > 30 * 24 * 60 * 60 * 1000) {
                    this.apiKeys.delete(keyId);
                    cleanedCount++;
                }
            }
        }

        if (cleanedCount > 0) {
            logger.info('Cleaned up expired API keys', { cleanedCount });
        }

        return cleanedCount;
    }
}

export default new ApiKeyManagementService();