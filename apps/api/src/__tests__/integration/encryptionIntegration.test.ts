import request from 'supertest';
import express from 'express';
import { encryptMessageContent, decryptMessageContent } from '../../middlewares/encryptionMiddleware';
import { encryptionService } from '../../services/encryptionService';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

// Create a test app with encryption middleware
const createTestApp = () => {
    const app = express();
    app.use(express.json());

    // Test route with encryption middleware
    app.post('/test/encrypt', encryptMessageContent, (req, res) => {
        res.json({
            success: true,
            data: req.body,
            encryptionContext: (req as any).encryptionContext
        });
    });

    // Test route with decryption middleware
    app.get('/test/decrypt', decryptMessageContent, (req, res) => {
        const testData = {
            content: {
                text: 'encrypted-test-content',
                _encrypted: true,
                _encryptionKeyId: encryptionService.getCurrentKeyId()
            }
        };
        res.json(testData);
    });

    return app;
};

describe('Encryption Integration Tests', () => {
    let app: express.Application;

    beforeEach(() => {
        app = createTestApp();
    });

    describe('Message Encryption Integration', () => {
        it('should encrypt patient-related message content', async () => {
            const messageData = {
                content: {
                    text: 'Patient has diabetes and needs medication adjustment',
                    type: 'text'
                },
                patientId: '507f1f77bcf86cd799439011'
            };

            const response = await request(app)
                .post('/test/encrypt')
                .send(messageData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.content._encrypted).toBe(true);
            expect(response.body.data.content._encryptionKeyId).toBeTruthy();
            expect(response.body.data.content.text).not.toBe(messageData.content.text);
            expect(response.body.encryptionContext.requiresEncryption).toBe(true);
        });

        it('should encrypt messages with sensitive healthcare keywords', async () => {
            const messageData = {
                content: {
                    text: 'Prescription for medication therapy review',
                    type: 'text'
                }
            };

            const response = await request(app)
                .post('/test/encrypt')
                .send(messageData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.content._encrypted).toBe(true);
            expect(response.body.data.content.text).not.toBe(messageData.content.text);
        });

        it('should not encrypt non-sensitive content', async () => {
            const messageData = {
                content: {
                    text: 'Hello, how are you today?',
                    type: 'text'
                }
            };

            const response = await request(app)
                .post('/test/encrypt')
                .send(messageData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.content._encrypted).toBeUndefined();
            expect(response.body.data.content.text).toBe(messageData.content.text);
        });

        it('should handle encryption errors gracefully', async () => {
            // Mock encryption service to throw error
            const originalEncrypt = encryptionService.encryptMessage;
            encryptionService.encryptMessage = jest.fn().mockRejectedValue(new Error('Encryption failed'));

            const messageData = {
                content: {
                    text: 'Patient information',
                    type: 'text'
                },
                patientId: '507f1f77bcf86cd799439011'
            };

            const response = await request(app)
                .post('/test/encrypt')
                .send(messageData)
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Message encryption failed');
            expect(response.body.code).toBe('ENCRYPTION_ERROR');

            // Restore original method
            encryptionService.encryptMessage = originalEncrypt;
        });
    });

    describe('Message Decryption Integration', () => {
        it('should setup decryption middleware correctly', async () => {
            // This test verifies that the decryption middleware is properly set up
            // The actual decryption functionality is tested in the middleware unit tests
            const response = await request(app)
                .get('/test/decrypt')
                .expect(200);

            expect(response.status).toBe(200);
            // The middleware should be applied and the route should respond
            expect(response.body).toBeDefined();
        });
    });

    describe('HIPAA Compliance Features', () => {
        it('should use AES-256-CBC encryption', () => {
            const stats = encryptionService.getStats();
            expect(stats.algorithm).toBe('aes-256-cbc');
            expect(stats.keyLength).toBe(32); // 256 bits
        });

        it('should support key rotation', async () => {
            const originalKeyId = encryptionService.getCurrentKeyId();
            const newKeyId = await encryptionService.rotateEncryptionKey('test-conversation');

            expect(newKeyId).not.toBe(originalKeyId);
            expect(encryptionService.validateKey(originalKeyId!)).toBe(true); // Old key still valid for decryption
            expect(encryptionService.validateKey(newKeyId)).toBe(true);
        });

        it('should generate unique encrypted outputs for same input', async () => {
            const plaintext = 'Same patient information';

            const encrypted1 = await encryptionService.encryptMessage(plaintext);
            const encrypted2 = await encryptionService.encryptMessage(plaintext);

            expect(encrypted1).not.toBe(encrypted2); // Different due to unique IVs

            // Both should decrypt to same plaintext
            const decrypted1 = await encryptionService.decryptMessage(encrypted1);
            const decrypted2 = await encryptionService.decryptMessage(encrypted2);

            expect(decrypted1).toBe(plaintext);
            expect(decrypted2).toBe(plaintext);
        });

        it('should include authentication tags for data integrity', async () => {
            const plaintext = 'Critical patient data';
            const encrypted = await encryptionService.encryptMessage(plaintext);

            // Parse encrypted data to verify structure
            const decodedContent = Buffer.from(encrypted, 'base64').toString('utf8');
            const encryptedData = JSON.parse(decodedContent);

            expect(encryptedData).toHaveProperty('authTag');
            expect(encryptedData).toHaveProperty('iv');
            expect(encryptedData).toHaveProperty('data');
            expect(encryptedData).toHaveProperty('keyId');
            expect(encryptedData).toHaveProperty('algorithm', 'aes-256-cbc');
        });
    });
});