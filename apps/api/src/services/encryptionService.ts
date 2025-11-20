import crypto from 'crypto';
import logger from '../utils/logger';

/**
 * EncryptionService provides HIPAA-compliant encryption/decryption for sensitive healthcare data
 * Uses AES-256-CBC for encryption with HMAC for authentication
 */
export class EncryptionService {
    private readonly algorithm = 'aes-256-cbc';
    private readonly keyLength = 32; // 256 bits
    private readonly ivLength = 16; // 128 bits
    private readonly hmacAlgorithm = 'sha256';
    private readonly keyRotationInterval = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

    // In-memory key storage (in production, use secure key management service)
    private keys: Map<string, { key: Buffer; hmacKey: Buffer; createdAt: Date; isActive: boolean }> = new Map();
    private currentKeyId: string | null = null;

    constructor() {
        // Initialize with a default key for development
        this.initializeDefaultKey();
    }

    /**
     * Initialize default encryption key for development
     */
    private initializeDefaultKey(): void {
        try {
            const defaultKeyId = 'default-key-' + Date.now();
            const defaultKey = crypto.randomBytes(this.keyLength);
            const defaultHmacKey = crypto.randomBytes(this.keyLength);

            this.keys.set(defaultKeyId, {
                key: defaultKey,
                hmacKey: defaultHmacKey,
                createdAt: new Date(),
                isActive: true
            });

            this.currentKeyId = defaultKeyId;

            logger.info('Encryption service initialized with default key', {
                keyId: defaultKeyId,
                algorithm: this.algorithm
            });
        } catch (error) {
            logger.error('Failed to initialize encryption service', { error });
            throw new Error('Encryption service initialization failed');
        }
    }

    /**
     * Generate a new encryption key
     * @returns Promise<string> - The new key ID
     */
    async generateEncryptionKey(): Promise<string> {
        try {
            const keyId = 'key-' + crypto.randomUUID();
            const key = crypto.randomBytes(this.keyLength);
            const hmacKey = crypto.randomBytes(this.keyLength);

            this.keys.set(keyId, {
                key,
                hmacKey,
                createdAt: new Date(),
                isActive: true
            });

            logger.info('New encryption key generated', {
                keyId,
                algorithm: this.algorithm,
                keyLength: this.keyLength
            });

            return keyId;
        } catch (error) {
            logger.error('Failed to generate encryption key', { error });
            throw new Error('Key generation failed');
        }
    }

    /**
     * Rotate encryption key for a conversation
     * @param conversationId - The conversation ID to rotate key for
     * @returns Promise<string> - The new key ID
     */
    async rotateEncryptionKey(conversationId: string): Promise<string> {
        try {
            // Generate new key
            const newKeyId = await this.generateEncryptionKey();

            // Mark old keys as inactive (keep for decryption of old messages)
            this.keys.forEach((keyData, keyId) => {
                if (keyData.isActive && keyId !== newKeyId) {
                    keyData.isActive = false;
                }
            });

            // Set new key as current
            this.currentKeyId = newKeyId;

            logger.info('Encryption key rotated', {
                conversationId,
                newKeyId,
                rotatedAt: new Date()
            });

            return newKeyId;
        } catch (error) {
            logger.error('Failed to rotate encryption key', {
                error,
                conversationId
            });
            throw new Error('Key rotation failed');
        }
    }

    /**
     * Encrypt message content using AES-256-CBC with HMAC authentication
     * @param content - The plaintext content to encrypt
     * @param keyId - The key ID to use for encryption (optional, uses current key if not provided)
     * @returns Promise<string> - Base64 encoded encrypted data with metadata
     */
    async encryptMessage(content: string, keyId?: string): Promise<string> {
        try {
            if (!content || content.trim().length === 0) {
                throw new Error('Content cannot be empty');
            }

            const useKeyId = keyId || this.currentKeyId;
            if (!useKeyId) {
                throw new Error('No encryption key available');
            }

            const keyData = this.keys.get(useKeyId);
            if (!keyData) {
                throw new Error(`Encryption key not found: ${useKeyId}`);
            }

            // Generate random IV for each encryption
            const iv = crypto.randomBytes(this.ivLength);

            // Create cipher
            const cipher = crypto.createCipheriv(this.algorithm, keyData.key, iv);

            // Encrypt content
            let encrypted = cipher.update(content, 'utf8');
            encrypted = Buffer.concat([encrypted, cipher.final()]);

            // Create HMAC for authentication
            const hmac = crypto.createHmac(this.hmacAlgorithm, keyData.hmacKey);
            hmac.update(iv);
            hmac.update(encrypted);
            hmac.update(useKeyId);
            const authTag = hmac.digest();

            // Combine IV + encrypted data + auth tag + keyId
            const result = {
                iv: iv.toString('base64'),
                data: encrypted.toString('base64'),
                authTag: authTag.toString('base64'),
                keyId: useKeyId,
                algorithm: this.algorithm,
                timestamp: new Date().toISOString()
            };

            logger.debug('Message encrypted successfully', {
                keyId: useKeyId,
                contentLength: content.length,
                encryptedLength: encrypted.length
            });

            return Buffer.from(JSON.stringify(result)).toString('base64');
        } catch (error) {
            logger.error('Failed to encrypt message', {
                error: error instanceof Error ? error.message : error,
                keyId
            });
            throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Decrypt message content using AES-256-CBC with HMAC verification
     * @param encryptedContent - Base64 encoded encrypted data with metadata
     * @param keyId - The key ID to use for decryption (extracted from encrypted data if not provided)
     * @returns Promise<string> - The decrypted plaintext content
     */
    async decryptMessage(encryptedContent: string, keyId?: string): Promise<string> {
        try {
            if (!encryptedContent || encryptedContent.trim().length === 0) {
                throw new Error('Encrypted content cannot be empty');
            }

            // Parse encrypted data
            let encryptedData;
            try {
                const decodedContent = Buffer.from(encryptedContent, 'base64').toString('utf8');
                encryptedData = JSON.parse(decodedContent);
            } catch (parseError) {
                throw new Error('Invalid encrypted data format');
            }

            const useKeyId = keyId || encryptedData.keyId;
            if (!useKeyId) {
                throw new Error('No decryption key ID available');
            }

            const keyData = this.keys.get(useKeyId);
            if (!keyData) {
                throw new Error(`Decryption key not found: ${useKeyId}`);
            }

            // Extract components
            const iv = Buffer.from(encryptedData.iv, 'base64');
            const encrypted = Buffer.from(encryptedData.data, 'base64');
            const authTag = Buffer.from(encryptedData.authTag, 'base64');

            // Verify HMAC
            const hmac = crypto.createHmac(this.hmacAlgorithm, keyData.hmacKey);
            hmac.update(iv);
            hmac.update(encrypted);
            hmac.update(useKeyId);
            const expectedAuthTag = hmac.digest();

            if (!crypto.timingSafeEqual(authTag, expectedAuthTag)) {
                throw new Error('Authentication failed - data may have been tampered with');
            }

            // Create decipher
            const decipher = crypto.createDecipheriv(encryptedData.algorithm || this.algorithm, keyData.key, iv);

            // Decrypt content
            let decrypted = decipher.update(encrypted);
            decrypted = Buffer.concat([decrypted, decipher.final()]);

            const result = decrypted.toString('utf8');

            logger.debug('Message decrypted successfully', {
                keyId: useKeyId,
                decryptedLength: result.length
            });

            return result;
        } catch (error) {
            logger.error('Failed to decrypt message', {
                error: error instanceof Error ? error.message : error,
                keyId
            });
            throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Check if a key needs rotation based on age
     * @param keyId - The key ID to check
     * @returns boolean - True if key needs rotation
     */
    needsRotation(keyId: string): boolean {
        const keyData = this.keys.get(keyId);
        if (!keyData) {
            return true; // Key not found, needs new key
        }

        const keyAge = Date.now() - keyData.createdAt.getTime();
        return keyAge > this.keyRotationInterval;
    }

    /**
     * Get current active key ID
     * @returns string | null - The current key ID
     */
    getCurrentKeyId(): string | null {
        return this.currentKeyId;
    }

    /**
     * Validate encryption key exists and is accessible
     * @param keyId - The key ID to validate
     * @returns boolean - True if key is valid and accessible
     */
    validateKey(keyId: string): boolean {
        const keyData = this.keys.get(keyId);
        return keyData !== undefined;
    }

    /**
     * Clean up old inactive keys (keep for compliance period)
     * @param retentionDays - Number of days to retain old keys (default: 2555 days / 7 years for HIPAA)
     */
    cleanupOldKeys(retentionDays: number = 2555): void {
        const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));

        let cleanedCount = 0;
        this.keys.forEach((keyData, keyId) => {
            if (!keyData.isActive && keyData.createdAt < cutoffDate) {
                this.keys.delete(keyId);
                cleanedCount++;
            }
        });

        if (cleanedCount > 0) {
            logger.info('Cleaned up old encryption keys', {
                cleanedCount,
                retentionDays,
                cutoffDate
            });
        }
    }

    /**
     * Get encryption statistics for monitoring
     * @returns Object with encryption service statistics
     */
    getStats() {
        const activeKeys = Array.from(this.keys.values()).filter(k => k.isActive).length;
        const totalKeys = this.keys.size;

        return {
            algorithm: this.algorithm,
            keyLength: this.keyLength,
            activeKeys,
            totalKeys,
            currentKeyId: this.currentKeyId,
            keyRotationInterval: this.keyRotationInterval
        };
    }
}

// Export singleton instance
export const encryptionService = new EncryptionService();