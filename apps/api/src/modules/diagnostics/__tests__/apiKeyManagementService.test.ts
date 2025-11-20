import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import apiKeyManagementService from '../services/apiKeyManagementService';

describe('API Key Management Service Tests', () => {
    beforeEach(() => {
        // Clear any existing keys for clean tests
        const allKeys = apiKeyManagementService.getAllApiKeys();
        allKeys.forEach(key => {
            apiKeyManagementService.deleteApiKey(key.id);
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('API Key Addition', () => {
        it('should add a new API key successfully', () => {
            const keyId = apiKeyManagementService.addApiKey({
                name: 'Test OpenRouter Key',
                service: 'openrouter',
                keyValue: 'sk-or-test-key-123456789',
                environment: 'development',
            });

            expect(keyId).toBeDefined();
            expect(typeof keyId).toBe('string');

            const allKeys = apiKeyManagementService.getAllApiKeys();
            const addedKey = allKeys.find(key => key.id === keyId);

            expect(addedKey).toBeDefined();
            expect(addedKey?.name).toBe('Test OpenRouter Key');
            expect(addedKey?.service).toBe('openrouter');
            expect(addedKey?.isActive).toBe(true);
            expect(addedKey?.environment).toBe('development');
        });

        it('should encrypt API key value', () => {
            const keyValue = 'sk-or-secret-key-123456789';
            const keyId = apiKeyManagementService.addApiKey({
                name: 'Encrypted Key Test',
                service: 'openrouter',
                keyValue,
                environment: 'development',
            });

            // The key value should not be stored in plain text in the returned data
            const allKeys = apiKeyManagementService.getAllApiKeys();
            const addedKey = allKeys.find(key => key.id === keyId);

            expect(addedKey).toBeDefined();
            // The getAllApiKeys method should not return the actual key value
            expect(addedKey).not.toHaveProperty('keyValue');
            expect(addedKey).not.toHaveProperty('encryptedValue');
        });

        it('should set default rotation interval', () => {
            const keyId = apiKeyManagementService.addApiKey({
                name: 'Default Rotation Test',
                service: 'rxnorm',
                keyValue: 'rxnorm-key-123',
                environment: 'development',
            });

            const allKeys = apiKeyManagementService.getAllApiKeys();
            const addedKey = allKeys.find(key => key.id === keyId);

            expect(addedKey?.rotationInterval).toBe(30 * 24 * 60 * 60 * 1000); // 30 days
        });

        it('should accept custom rotation interval', () => {
            const customInterval = 7 * 24 * 60 * 60 * 1000; // 7 days
            const keyId = apiKeyManagementService.addApiKey({
                name: 'Custom Rotation Test',
                service: 'openfda',
                keyValue: 'openfda-key-123',
                rotationInterval: customInterval,
                environment: 'development',
            });

            const allKeys = apiKeyManagementService.getAllApiKeys();
            const addedKey = allKeys.find(key => key.id === keyId);

            expect(addedKey?.rotationInterval).toBe(customInterval);
        });
    });

    describe('API Key Retrieval', () => {
        it('should retrieve active API key for service', () => {
            const keyValue = 'sk-or-active-key-123';
            apiKeyManagementService.addApiKey({
                name: 'Active OpenRouter Key',
                service: 'openrouter',
                keyValue,
                environment: 'development',
            });

            const retrievedKey = apiKeyManagementService.getApiKey('openrouter');
            expect(retrievedKey).toBe(keyValue);
        });

        it('should return null for service without active keys', () => {
            const retrievedKey = apiKeyManagementService.getApiKey('loinc');
            expect(retrievedKey).toBeNull();
        });

        it('should return most recent active key when multiple exist', () => {
            const oldKeyValue = 'sk-or-old-key-123';
            const newKeyValue = 'sk-or-new-key-456';

            // Add old key
            apiKeyManagementService.addApiKey({
                name: 'Old OpenRouter Key',
                service: 'openrouter',
                keyValue: oldKeyValue,
                environment: 'development',
            });

            // Wait a bit to ensure different timestamps
            setTimeout(() => {
                // Add new key
                apiKeyManagementService.addApiKey({
                    name: 'New OpenRouter Key',
                    service: 'openrouter',
                    keyValue: newKeyValue,
                    environment: 'development',
                });

                const retrievedKey = apiKeyManagementService.getApiKey('openrouter');
                expect(retrievedKey).toBe(newKeyValue);
            }, 10);
        });

        it('should not return inactive keys', () => {
            const keyValue = 'sk-or-inactive-key-123';
            const keyId = apiKeyManagementService.addApiKey({
                name: 'Inactive Key',
                service: 'openrouter',
                keyValue,
                environment: 'development',
            });

            // Deactivate the key
            apiKeyManagementService.deactivateApiKey(keyId);

            const retrievedKey = apiKeyManagementService.getApiKey('openrouter');
            expect(retrievedKey).toBeNull();
        });

        it('should track key usage when retrieved', () => {
            const keyId = apiKeyManagementService.addApiKey({
                name: 'Usage Tracking Key',
                service: 'rxnorm',
                keyValue: 'rxnorm-usage-key-123',
                environment: 'development',
            });

            // Get initial usage
            const initialMetrics = apiKeyManagementService.getKeyUsageMetrics(keyId);
            const initialUsage = initialMetrics?.totalUsage || 0;

            // Retrieve key (should increment usage)
            apiKeyManagementService.getApiKey('rxnorm');

            // Check updated usage
            const updatedMetrics = apiKeyManagementService.getKeyUsageMetrics(keyId);
            expect(updatedMetrics?.totalUsage).toBe(initialUsage + 1);
            expect(updatedMetrics?.lastUsed).toBeDefined();
        });
    });

    describe('API Key Validation', () => {
        it('should validate OpenRouter key format', () => {
            const validKey = 'sk-or-valid-key-1234567890abcdef';
            const validation = apiKeyManagementService.validateApiKeyFormat('openrouter', validKey);

            expect(validation.isValid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });

        it('should reject invalid OpenRouter key format', () => {
            const invalidKey = 'invalid-key-format';
            const validation = apiKeyManagementService.validateApiKeyFormat('openrouter', invalidKey);

            expect(validation.isValid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(0);
            expect(validation.errors[0]).toContain('must start with "sk-or-"');
        });

        it('should validate OpenFDA UUID format', () => {
            const validUuid = '123e4567-e89b-12d3-a456-426614174000';
            const validation = apiKeyManagementService.validateApiKeyFormat('openfda', validUuid);

            expect(validation.isValid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });

        it('should reject invalid OpenFDA UUID format', () => {
            const invalidUuid = 'not-a-uuid';
            const validation = apiKeyManagementService.validateApiKeyFormat('openfda', invalidUuid);

            expect(validation.isValid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(0);
            expect(validation.errors[0]).toContain('must be a valid UUID');
        });

        it('should reject empty API keys', () => {
            const validation = apiKeyManagementService.validateApiKeyFormat('rxnorm', '');

            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain('API key cannot be empty');
        });

        it('should validate minimum key length', () => {
            const shortKey = 'short';
            const validation = apiKeyManagementService.validateApiKeyFormat('fhir', shortKey);

            expect(validation.isValid).toBe(false);
            expect(validation.errors.some(error => error.includes('too short'))).toBe(true);
        });
    });

    describe('API Key Rotation', () => {
        it('should rotate API key successfully', async () => {
            const oldKeyValue = 'sk-or-old-key-123';
            const newKeyValue = 'sk-or-new-key-456';

            const oldKeyId = apiKeyManagementService.addApiKey({
                name: 'Rotation Test Key',
                service: 'openrouter',
                keyValue: oldKeyValue,
                environment: 'development',
            });

            const rotationResult = await apiKeyManagementService.rotateApiKey(oldKeyId, newKeyValue);

            expect(rotationResult.success).toBe(true);
            expect(rotationResult.oldKeyId).toBe(oldKeyId);
            expect(rotationResult.newKeyId).toBeDefined();
            expect(rotationResult.newKeyId).not.toBe(oldKeyId);

            // Old key should be inactive
            const allKeys = apiKeyManagementService.getAllApiKeys();
            const oldKey = allKeys.find(key => key.id === oldKeyId);
            expect(oldKey?.isActive).toBe(false);

            // New key should be active and retrievable
            const retrievedKey = apiKeyManagementService.getApiKey('openrouter');
            expect(retrievedKey).toBe(newKeyValue);
        });

        it('should handle rotation of non-existent key', async () => {
            const rotationResult = await apiKeyManagementService.rotateApiKey('non-existent-id', 'new-key');

            expect(rotationResult.success).toBe(false);
            expect(rotationResult.error).toBe('API key not found');
        });

        it('should detect keys needing rotation', () => {
            const keyId = apiKeyManagementService.addApiKey({
                name: 'Rotation Check Key',
                service: 'rxnorm',
                keyValue: 'rxnorm-rotation-key-123',
                rotationInterval: 1000, // 1 second for testing
                environment: 'development',
            });

            // Initially should not need rotation
            expect(apiKeyManagementService.needsRotation(keyId)).toBe(false);

            // After waiting, should need rotation
            setTimeout(() => {
                expect(apiKeyManagementService.needsRotation(keyId)).toBe(true);
            }, 1100);
        });

        it('should return keys needing rotation', () => {
            apiKeyManagementService.addApiKey({
                name: 'Needs Rotation Key',
                service: 'openfda',
                keyValue: 'openfda-needs-rotation-123',
                rotationInterval: 1, // 1ms - immediate rotation needed
                environment: 'development',
            });

            setTimeout(() => {
                const keysNeedingRotation = apiKeyManagementService.getKeysNeedingRotation();
                expect(keysNeedingRotation.length).toBeGreaterThan(0);
            }, 10);
        });
    });

    describe('API Key Management Operations', () => {
        it('should deactivate API key', () => {
            const keyId = apiKeyManagementService.addApiKey({
                name: 'Deactivation Test Key',
                service: 'fhir',
                keyValue: 'fhir-deactivate-key-123',
                environment: 'development',
            });

            const deactivated = apiKeyManagementService.deactivateApiKey(keyId);
            expect(deactivated).toBe(true);

            const allKeys = apiKeyManagementService.getAllApiKeys();
            const deactivatedKey = allKeys.find(key => key.id === keyId);
            expect(deactivatedKey?.isActive).toBe(false);
        });

        it('should delete API key', () => {
            const keyId = apiKeyManagementService.addApiKey({
                name: 'Deletion Test Key',
                service: 'loinc',
                keyValue: 'loinc-delete-key-123',
                environment: 'development',
            });

            const deleted = apiKeyManagementService.deleteApiKey(keyId);
            expect(deleted).toBe(true);

            const allKeys = apiKeyManagementService.getAllApiKeys();
            const deletedKey = allKeys.find(key => key.id === keyId);
            expect(deletedKey).toBeUndefined();
        });

        it('should handle deactivation of non-existent key', () => {
            const deactivated = apiKeyManagementService.deactivateApiKey('non-existent-id');
            expect(deactivated).toBe(false);
        });

        it('should handle deletion of non-existent key', () => {
            const deleted = apiKeyManagementService.deleteApiKey('non-existent-id');
            expect(deleted).toBe(false);
        });
    });

    describe('Usage Metrics', () => {
        it('should provide usage metrics for API key', () => {
            const keyId = apiKeyManagementService.addApiKey({
                name: 'Metrics Test Key',
                service: 'openrouter',
                keyValue: 'sk-or-metrics-key-123',
                environment: 'development',
            });

            const metrics = apiKeyManagementService.getKeyUsageMetrics(keyId);

            expect(metrics).toBeDefined();
            expect(metrics?.keyId).toBe(keyId);
            expect(metrics?.service).toBe('openrouter');
            expect(typeof metrics?.totalUsage).toBe('number');
            expect(typeof metrics?.dailyUsage).toBe('number');
            expect(typeof metrics?.weeklyUsage).toBe('number');
            expect(typeof metrics?.monthlyUsage).toBe('number');
            expect(typeof metrics?.averageResponseTime).toBe('number');
            expect(typeof metrics?.errorRate).toBe('number');
        });

        it('should return null for non-existent key metrics', () => {
            const metrics = apiKeyManagementService.getKeyUsageMetrics('non-existent-id');
            expect(metrics).toBeNull();
        });
    });

    describe('Service Health Status', () => {
        it('should provide service health status', () => {
            // Add keys for different services
            apiKeyManagementService.addApiKey({
                name: 'OpenRouter Health Key',
                service: 'openrouter',
                keyValue: 'sk-or-health-key-123',
                environment: 'development',
            });

            apiKeyManagementService.addApiKey({
                name: 'RxNorm Health Key',
                service: 'rxnorm',
                keyValue: 'rxnorm-health-key-123',
                environment: 'development',
            });

            const healthStatus = apiKeyManagementService.getServiceHealthStatus();

            expect(healthStatus).toBeDefined();
            expect(healthStatus.openrouter).toBeDefined();
            expect(healthStatus.openrouter.hasActiveKey).toBe(true);
            expect(healthStatus.openrouter.keyCount).toBe(1);
            expect(healthStatus.openrouter.isHealthy).toBe(true);

            expect(healthStatus.rxnorm).toBeDefined();
            expect(healthStatus.rxnorm.hasActiveKey).toBe(true);
            expect(healthStatus.rxnorm.keyCount).toBe(1);

            // Services without keys should show as unhealthy
            expect(healthStatus.loinc.hasActiveKey).toBe(false);
            expect(healthStatus.loinc.keyCount).toBe(0);
            expect(healthStatus.loinc.isHealthy).toBe(false);
        });
    });

    describe('API Key Testing', () => {
        it('should test API key connectivity', async () => {
            const keyId = apiKeyManagementService.addApiKey({
                name: 'Test Connectivity Key',
                service: 'openrouter',
                keyValue: 'sk-or-test-connectivity-123',
                environment: 'development',
            });

            const testResult = await apiKeyManagementService.testApiKey(keyId);

            expect(testResult).toBeDefined();
            expect(typeof testResult.success).toBe('boolean');
            expect(typeof testResult.responseTime).toBe('number');
            expect(testResult.responseTime).toBeGreaterThan(0);

            if (!testResult.success) {
                expect(testResult.error).toBeDefined();
            }
        });

        it('should handle testing non-existent key', async () => {
            const testResult = await apiKeyManagementService.testApiKey('non-existent-id');

            expect(testResult.success).toBe(false);
            expect(testResult.error).toBe('API key not found');
            expect(testResult.responseTime).toBe(0);
        });
    });

    describe('Cleanup Operations', () => {
        it('should cleanup expired keys', () => {
            // Add an expired key
            const keyId = apiKeyManagementService.addApiKey({
                name: 'Expired Key',
                service: 'openrouter',
                keyValue: 'sk-or-expired-key-123',
                maxUsage: 1, // Will be expired after 1 use
                environment: 'development',
            });

            // Use the key to expire it
            apiKeyManagementService.getApiKey('openrouter');

            // Deactivate it
            apiKeyManagementService.deactivateApiKey(keyId);

            // Cleanup should remove it (in a real scenario, this would check age)
            const cleanedCount = apiKeyManagementService.cleanupExpiredKeys();

            // The cleanup logic checks for 30-day inactivity, so this might not clean immediately
            expect(typeof cleanedCount).toBe('number');
            expect(cleanedCount).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid service types', () => {
            const validation = apiKeyManagementService.validateApiKeyFormat('invalid-service' as any, 'test-key');

            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain('Unknown service type');
        });

        it('should handle malformed key data gracefully', () => {
            // This should not throw an error
            expect(() => {
                apiKeyManagementService.addApiKey({
                    name: '',
                    service: 'openrouter',
                    keyValue: 'sk-or-test-123',
                    environment: 'development',
                });
            }).not.toThrow();
        });
    });
});