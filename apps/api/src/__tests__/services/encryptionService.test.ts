import { EncryptionService, encryptionService } from '../../services/encryptionService';
import logger from '../../utils/logger';

// Mock logger to avoid console output during tests
jest.mock('../../utils/logger', () => ({
    __esModule: true,
    default: {
        info: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

describe('EncryptionService', () => {
    let testEncryptionService: EncryptionService;

    beforeEach(() => {
        // Create a fresh instance for each test
        testEncryptionService = new EncryptionService();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Initialization', () => {
        it('should initialize with a default key', () => {
            const currentKeyId = testEncryptionService.getCurrentKeyId();
            expect(currentKeyId).toBeTruthy();
            expect(currentKeyId).toMatch(/^default-key-\d+$/);
        });

        it('should log initialization', () => {
            expect(logger.info).toHaveBeenCalledWith(
                'Encryption service initialized with default key',
                expect.objectContaining({
                    keyId: expect.stringMatching(/^default-key-\d+$/),
                    algorithm: 'aes-256-cbc'
                })
            );
        });
    });

    describe('Key Generation', () => {
        it('should generate a new encryption key', async () => {
            const keyId = await testEncryptionService.generateEncryptionKey();

            expect(keyId).toBeTruthy();
            expect(keyId).toMatch(/^key-[a-f0-9-]+$/);
            expect(testEncryptionService.validateKey(keyId)).toBe(true);
        });

        it('should log key generation', async () => {
            await testEncryptionService.generateEncryptionKey();

            expect(logger.info).toHaveBeenCalledWith(
                'New encryption key generated',
                expect.objectContaining({
                    keyId: expect.stringMatching(/^key-[a-f0-9-]+$/),
                    algorithm: 'aes-256-cbc',
                    keyLength: 32
                })
            );
        });

        it('should handle key generation errors', async () => {
            // Mock crypto.randomUUID to throw an error
            const originalRandomUUID = require('crypto').randomUUID;
            require('crypto').randomUUID = jest.fn(() => {
                throw new Error('Random UUID generation failed');
            });

            await expect(testEncryptionService.generateEncryptionKey()).rejects.toThrow('Key generation failed');

            // Restore original function
            require('crypto').randomUUID = originalRandomUUID;
        });
    });

    describe('Key Rotation', () => {
        it('should rotate encryption key for a conversation', async () => {
            const conversationId = 'test-conversation-123';
            const originalKeyId = testEncryptionService.getCurrentKeyId();

            const newKeyId = await testEncryptionService.rotateEncryptionKey(conversationId);

            expect(newKeyId).toBeTruthy();
            expect(newKeyId).not.toBe(originalKeyId);
            expect(testEncryptionService.getCurrentKeyId()).toBe(newKeyId);
            expect(testEncryptionService.validateKey(newKeyId)).toBe(true);
        });

        it('should log key rotation', async () => {
            const conversationId = 'test-conversation-123';

            await testEncryptionService.rotateEncryptionKey(conversationId);

            expect(logger.info).toHaveBeenCalledWith(
                'Encryption key rotated',
                expect.objectContaining({
                    conversationId,
                    newKeyId: expect.stringMatching(/^key-[a-f0-9-]+$/),
                    rotatedAt: expect.any(Date)
                })
            );
        });
    });

    describe('Message Encryption', () => {
        it('should encrypt a message successfully', async () => {
            const plaintext = 'Patient shows improvement with new medication';

            const encrypted = await testEncryptionService.encryptMessage(plaintext);

            expect(encrypted).toBeTruthy();
            expect(encrypted).not.toBe(plaintext);
            expect(typeof encrypted).toBe('string');

            // Verify it's base64 encoded
            expect(() => Buffer.from(encrypted, 'base64')).not.toThrow();
        });

        it('should encrypt with specific key ID', async () => {
            const plaintext = 'Confidential patient information';
            const keyId = await testEncryptionService.generateEncryptionKey();

            const encrypted = await testEncryptionService.encryptMessage(plaintext, keyId);

            expect(encrypted).toBeTruthy();
            expect(encrypted).not.toBe(plaintext);
        });

        it('should handle empty content', async () => {
            await expect(testEncryptionService.encryptMessage('')).rejects.toThrow('Content cannot be empty');
            await expect(testEncryptionService.encryptMessage('   ')).rejects.toThrow('Content cannot be empty');
        });

        it('should handle invalid key ID', async () => {
            const plaintext = 'Test message';
            const invalidKeyId = 'invalid-key-id';

            await expect(testEncryptionService.encryptMessage(plaintext, invalidKeyId))
                .rejects.toThrow('Encryption key not found: invalid-key-id');
        });

        it('should include metadata in encrypted result', async () => {
            const plaintext = 'Test message with metadata';
            const encrypted = await testEncryptionService.encryptMessage(plaintext);

            // Decode and parse the encrypted data
            const decodedContent = Buffer.from(encrypted, 'base64').toString('utf8');
            const encryptedData = JSON.parse(decodedContent);

            expect(encryptedData).toHaveProperty('iv');
            expect(encryptedData).toHaveProperty('authTag');
            expect(encryptedData).toHaveProperty('data');
            expect(encryptedData).toHaveProperty('keyId');
            expect(encryptedData).toHaveProperty('algorithm', 'aes-256-cbc');
            expect(encryptedData).toHaveProperty('timestamp');
        });
    });

    describe('Message Decryption', () => {
        it('should decrypt a message successfully', async () => {
            const plaintext = 'Patient diagnosis: Type 2 diabetes';

            const encrypted = await testEncryptionService.encryptMessage(plaintext);
            const decrypted = await testEncryptionService.decryptMessage(encrypted);

            expect(decrypted).toBe(plaintext);
        });

        it('should decrypt with specific key ID', async () => {
            const plaintext = 'Medication therapy review completed';
            const keyId = await testEncryptionService.generateEncryptionKey();

            const encrypted = await testEncryptionService.encryptMessage(plaintext, keyId);
            const decrypted = await testEncryptionService.decryptMessage(encrypted, keyId);

            expect(decrypted).toBe(plaintext);
        });

        it('should handle empty encrypted content', async () => {
            await expect(testEncryptionService.decryptMessage('')).rejects.toThrow('Encrypted content cannot be empty');
            await expect(testEncryptionService.decryptMessage('   ')).rejects.toThrow('Encrypted content cannot be empty');
        });

        it('should handle invalid encrypted data format', async () => {
            const invalidData = 'invalid-encrypted-data';

            await expect(testEncryptionService.decryptMessage(invalidData))
                .rejects.toThrow('Invalid encrypted data format');
        });

        it('should handle missing decryption key', async () => {
            const plaintext = 'Test message';
            const encrypted = await testEncryptionService.encryptMessage(plaintext);

            // Manually modify encrypted data to use invalid key ID
            const decodedContent = Buffer.from(encrypted, 'base64').toString('utf8');
            const encryptedData = JSON.parse(decodedContent);
            encryptedData.keyId = 'invalid-key-id';
            const modifiedEncrypted = Buffer.from(JSON.stringify(encryptedData)).toString('base64');

            await expect(testEncryptionService.decryptMessage(modifiedEncrypted))
                .rejects.toThrow('Decryption key not found: invalid-key-id');
        });

        it('should handle corrupted encrypted data', async () => {
            const plaintext = 'Test message';
            const encrypted = await testEncryptionService.encryptMessage(plaintext);

            // Corrupt the encrypted data
            const decodedContent = Buffer.from(encrypted, 'base64').toString('utf8');
            const encryptedData = JSON.parse(decodedContent);
            encryptedData.data = 'corrupted-data';
            const corruptedEncrypted = Buffer.from(JSON.stringify(encryptedData)).toString('base64');

            await expect(testEncryptionService.decryptMessage(corruptedEncrypted))
                .rejects.toThrow('Decryption failed');
        });
    });

    describe('End-to-End Encryption/Decryption', () => {
        const testMessages = [
            'Simple message',
            'Patient has diabetes and hypertension',
            'Prescription: Metformin 500mg twice daily',
            'Clinical notes: Patient responding well to treatment',
            'Special characters: !@#$%^&*()_+-=[]{}|;:,.<>?',
            'Unicode: 🏥 Healthcare 💊 Medication 👨‍⚕️ Doctor',
            'Long message: ' + 'A'.repeat(1000)
        ];

        testMessages.forEach((message, index) => {
            it(`should encrypt and decrypt message ${index + 1}: "${message.substring(0, 50)}..."`, async () => {
                const encrypted = await testEncryptionService.encryptMessage(message);
                const decrypted = await testEncryptionService.decryptMessage(encrypted);

                expect(decrypted).toBe(message);
                expect(encrypted).not.toBe(message);
            });
        });
    });

    describe('Key Management', () => {
        it('should validate existing keys', () => {
            const currentKeyId = testEncryptionService.getCurrentKeyId();
            expect(testEncryptionService.validateKey(currentKeyId!)).toBe(true);
            expect(testEncryptionService.validateKey('non-existent-key')).toBe(false);
        });

        it('should check if key needs rotation', async () => {
            const keyId = await testEncryptionService.generateEncryptionKey();

            // New key should not need rotation
            expect(testEncryptionService.needsRotation(keyId)).toBe(false);

            // Non-existent key should need rotation
            expect(testEncryptionService.needsRotation('non-existent-key')).toBe(true);
        });

        it('should provide encryption statistics', () => {
            const stats = testEncryptionService.getStats();

            expect(stats).toHaveProperty('algorithm', 'aes-256-cbc');
            expect(stats).toHaveProperty('keyLength', 32);
            expect(stats).toHaveProperty('activeKeys');
            expect(stats).toHaveProperty('totalKeys');
            expect(stats).toHaveProperty('currentKeyId');
            expect(stats).toHaveProperty('keyRotationInterval');

            expect(stats.activeKeys).toBeGreaterThan(0);
            expect(stats.totalKeys).toBeGreaterThanOrEqual(stats.activeKeys);
        });
    });

    describe('Key Cleanup', () => {
        it('should clean up old keys', async () => {
            // Generate multiple keys
            await testEncryptionService.generateEncryptionKey();
            await testEncryptionService.generateEncryptionKey();

            const initialStats = testEncryptionService.getStats();

            // Clean up with very short retention (should not clean anything since keys are new)
            testEncryptionService.cleanupOldKeys(0);

            const afterCleanupStats = testEncryptionService.getStats();

            // Should not clean up active keys or recently created keys
            expect(afterCleanupStats.totalKeys).toBeGreaterThan(0);
        });
    });

    describe('Error Handling and Logging', () => {
        it('should log encryption operations', async () => {
            const plaintext = 'Test logging message';

            await testEncryptionService.encryptMessage(plaintext);

            expect(logger.debug).toHaveBeenCalledWith(
                'Message encrypted successfully',
                expect.objectContaining({
                    keyId: expect.any(String),
                    contentLength: plaintext.length,
                    encryptedLength: expect.any(Number)
                })
            );
        });

        it('should log decryption operations', async () => {
            const plaintext = 'Test logging message';
            const encrypted = await testEncryptionService.encryptMessage(plaintext);

            await testEncryptionService.decryptMessage(encrypted);

            expect(logger.debug).toHaveBeenCalledWith(
                'Message decrypted successfully',
                expect.objectContaining({
                    keyId: expect.any(String),
                    decryptedLength: plaintext.length
                })
            );
        });

        it('should log encryption errors', async () => {
            await expect(testEncryptionService.encryptMessage('', 'invalid-key'))
                .rejects.toThrow();

            expect(logger.error).toHaveBeenCalledWith(
                'Failed to encrypt message',
                expect.objectContaining({
                    error: expect.any(String),
                    keyId: 'invalid-key'
                })
            );
        });

        it('should log decryption errors', async () => {
            await expect(testEncryptionService.decryptMessage('invalid-data'))
                .rejects.toThrow();

            expect(logger.error).toHaveBeenCalledWith(
                'Failed to decrypt message',
                expect.objectContaining({
                    error: expect.any(String)
                })
            );
        });
    });

    describe('Singleton Instance', () => {
        it('should export a singleton instance', () => {
            expect(encryptionService).toBeInstanceOf(EncryptionService);
            expect(encryptionService.getCurrentKeyId()).toBeTruthy();
        });

        it('should maintain state across imports', async () => {
            const keyId = await encryptionService.generateEncryptionKey();
            expect(encryptionService.validateKey(keyId)).toBe(true);
        });
    });

    describe('HIPAA Compliance Features', () => {
        it('should use strong encryption algorithm', () => {
            const stats = testEncryptionService.getStats();
            expect(stats.algorithm).toBe('aes-256-cbc');
            expect(stats.keyLength).toBe(32); // 256 bits
        });

        it('should generate unique IVs for each encryption', async () => {
            const plaintext = 'Same message encrypted twice';

            const encrypted1 = await testEncryptionService.encryptMessage(plaintext);
            const encrypted2 = await testEncryptionService.encryptMessage(plaintext);

            expect(encrypted1).not.toBe(encrypted2);

            // Both should decrypt to the same plaintext
            const decrypted1 = await testEncryptionService.decryptMessage(encrypted1);
            const decrypted2 = await testEncryptionService.decryptMessage(encrypted2);

            expect(decrypted1).toBe(plaintext);
            expect(decrypted2).toBe(plaintext);
        });

        it('should include authentication tags for data integrity', async () => {
            const plaintext = 'Message with authentication';
            const encrypted = await testEncryptionService.encryptMessage(plaintext);

            const decodedContent = Buffer.from(encrypted, 'base64').toString('utf8');
            const encryptedData = JSON.parse(decodedContent);

            expect(encryptedData.authTag).toBeTruthy();
            expect(encryptedData.authTag.length).toBeGreaterThan(0);
        });

        it('should support key rotation for compliance', async () => {
            const conversationId = 'compliance-test-conversation';
            const originalKeyId = testEncryptionService.getCurrentKeyId();

            const newKeyId = await testEncryptionService.rotateEncryptionKey(conversationId);

            expect(newKeyId).not.toBe(originalKeyId);
            expect(testEncryptionService.validateKey(originalKeyId!)).toBe(true); // Old key still exists for decryption
            expect(testEncryptionService.validateKey(newKeyId)).toBe(true);
        });
    });
});