import { Request, Response, NextFunction } from 'express';
import {
    encryptMessageContent,
    decryptMessageContent,
    validateEncryptionCompliance,
    handleEncryptionError
} from '../../middlewares/encryptionMiddleware';
import { encryptionService } from '../../services/encryptionService';
import logger from '../../utils/logger';

// Mock dependencies
jest.mock('../../services/encryptionService');
jest.mock('../../utils/logger', () => ({
    __esModule: true,
    default: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

describe('Encryption Middleware', () => {
    let mockRequest: Partial<Request> & { path?: string };
    let mockResponse: Partial<Response>;
    let mockNext: NextFunction;
    let mockEncryptionService: jest.Mocked<typeof encryptionService>;

    beforeEach(() => {
        mockRequest = {
            body: {},
            params: {},
            path: '/api/messages',
            method: 'POST'
        };

        mockResponse = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };

        mockNext = jest.fn();

        mockEncryptionService = encryptionService as jest.Mocked<typeof encryptionService>;

        // Reset mocks
        jest.clearAllMocks();

        // Setup default mock implementations
        mockEncryptionService.getCurrentKeyId.mockReturnValue('test-key-123');
        mockEncryptionService.generateEncryptionKey.mockResolvedValue('new-key-456');
        mockEncryptionService.encryptMessage.mockResolvedValue('encrypted-content');
        mockEncryptionService.decryptMessage.mockResolvedValue('decrypted-content');
        mockEncryptionService.needsRotation.mockReturnValue(false);
    });

    describe('encryptMessageContent', () => {
        it('should encrypt message content with text', async () => {
            mockRequest.body = {
                content: {
                    text: 'Patient has diabetes',
                    type: 'text'
                },
                patientId: 'patient-123'
            };

            await encryptMessageContent(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockEncryptionService.encryptMessage).toHaveBeenCalledWith('Patient has diabetes', 'test-key-123');
            expect(mockRequest.body.content.text).toBe('encrypted-content');
            expect(mockRequest.body.content._encrypted).toBe(true);
            expect(mockRequest.body.content._encryptionKeyId).toBe('test-key-123');
            expect(mockNext).toHaveBeenCalled();
        });

        it('should encrypt direct text content', async () => {
            mockRequest.body = {
                text: 'Confidential patient information',
                patientId: 'patient-123'
            };

            await encryptMessageContent(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockEncryptionService.encryptMessage).toHaveBeenCalledWith('Confidential patient information', 'test-key-123');
            expect(mockRequest.body.text).toBe('encrypted-content');
            expect(mockRequest.body._encrypted).toBe(true);
            expect(mockRequest.body._encryptionKeyId).toBe('test-key-123');
            expect(mockNext).toHaveBeenCalled();
        });

        it('should encrypt clinical notes', async () => {
            mockRequest.body = {
                content: {
                    text: 'Regular message',
                    clinicalNotes: 'Patient shows improvement',
                    type: 'clinical_note'
                },
                patientId: 'patient-123'
            };

            await encryptMessageContent(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockEncryptionService.encryptMessage).toHaveBeenCalledWith('Regular message', 'test-key-123');
            expect(mockEncryptionService.encryptMessage).toHaveBeenCalledWith('Patient shows improvement', 'test-key-123');
            expect(mockNext).toHaveBeenCalled();
        });

        it('should skip encryption if already encrypted', async () => {
            mockRequest.body = {
                _encrypted: true,
                content: {
                    text: 'Already encrypted content',
                    _encrypted: true
                }
            };

            await encryptMessageContent(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockEncryptionService.encryptMessage).not.toHaveBeenCalled();
            expect(mockNext).toHaveBeenCalled();
        });

        it('should skip encryption if no body', async () => {
            mockRequest.body = undefined;

            await encryptMessageContent(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockEncryptionService.encryptMessage).not.toHaveBeenCalled();
            expect(mockNext).toHaveBeenCalled();
        });

        it('should generate new key if none exists', async () => {
            mockEncryptionService.getCurrentKeyId.mockReturnValue(null);
            mockRequest.body = {
                content: { text: 'Test message' },
                patientId: 'patient-123'
            };

            await encryptMessageContent(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockEncryptionService.generateEncryptionKey).toHaveBeenCalled();
            expect(mockEncryptionService.encryptMessage).toHaveBeenCalledWith('Test message', 'new-key-456');
            expect(mockNext).toHaveBeenCalled();
        });

        it('should detect sensitive content and encrypt', async () => {
            mockRequest.body = {
                content: { text: 'Patient diagnosis is critical' },
                conversationId: 'conv-123'
            };
            mockRequest.path = '/api/general-messages';

            await encryptMessageContent(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockEncryptionService.encryptMessage).toHaveBeenCalled();
            expect(mockNext).toHaveBeenCalled();
        });

        it('should handle encryption errors', async () => {
            mockEncryptionService.encryptMessage.mockRejectedValue(new Error('Encryption failed'));
            mockRequest.body = {
                content: { text: 'Test message' },
                patientId: 'patient-123'
            };

            await encryptMessageContent(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: false,
                error: 'Message encryption failed',
                code: 'ENCRYPTION_ERROR'
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should log encryption activity', async () => {
            mockRequest.body = {
                content: { text: 'Test message' },
                patientId: 'patient-123',
                conversationId: 'conv-123'
            };

            await encryptMessageContent(mockRequest as Request, mockResponse as Response, mockNext);

            expect(logger.debug).toHaveBeenCalledWith(
                'Message content encrypted',
                expect.objectContaining({
                    keyId: 'test-key-123',
                    patientId: 'patient-123',
                    conversationId: 'conv-123',
                    hasTextContent: true
                })
            );
        });
    });

    describe('decryptMessageContent', () => {
        it('should setup response decryption', async () => {
            const originalJson = jest.fn();
            mockResponse.json = originalJson;

            await decryptMessageContent(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockResponse.json).not.toBe(originalJson);
        });

        it('should decrypt response data when json is called', async () => {
            const originalJson = jest.fn();
            mockResponse.json = originalJson;

            await decryptMessageContent(mockRequest as Request, mockResponse as Response, mockNext);

            const responseData = {
                content: {
                    text: 'encrypted-content',
                    _encrypted: true,
                    _encryptionKeyId: 'test-key-123'
                }
            };

            // Call the overridden json method
            (mockResponse.json as any)(responseData);

            // Wait for async decryption
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(mockEncryptionService.decryptMessage).toHaveBeenCalledWith('encrypted-content', 'test-key-123');
        });

        it('should handle decryption errors in response', async () => {
            mockEncryptionService.decryptMessage.mockRejectedValue(new Error('Decryption failed'));

            const originalJson = jest.fn();
            mockResponse.json = originalJson;

            await decryptMessageContent(mockRequest as Request, mockResponse as Response, mockNext);

            const responseData = {
                content: {
                    text: 'encrypted-content',
                    _encrypted: true,
                    _encryptionKeyId: 'test-key-123'
                }
            };

            // Call the overridden json method
            (mockResponse.json as any)(responseData);

            // Wait for async decryption to complete
            await new Promise(resolve => setTimeout(resolve, 100));

            // Should log warning about failed decryption but continue with encrypted content
            expect(logger.warn).toHaveBeenCalledWith('Failed to decrypt message content', expect.any(Object));
            expect(originalJson).toHaveBeenCalledWith({
                content: {
                    text: 'encrypted-content',
                    _encrypted: true,
                    _encryptionKeyId: 'test-key-123'
                }
            });
        });

        it('should handle non-object response data', async () => {
            const originalJson = jest.fn();
            mockResponse.json = originalJson;

            await decryptMessageContent(mockRequest as Request, mockResponse as Response, mockNext);

            // Call with string data
            (mockResponse.json as any)('simple string response');

            expect(originalJson).toHaveBeenCalledWith('simple string response');
        });
    });

    describe('validateEncryptionCompliance', () => {
        it('should warn about unencrypted patient data', () => {
            mockRequest.body = {
                patientId: 'patient-123',
                content: { text: 'Unencrypted patient data' }
            };

            validateEncryptionCompliance(mockRequest as Request, mockResponse as Response, mockNext);

            expect(logger.warn).toHaveBeenCalledWith(
                'Patient data transmitted without encryption',
                expect.objectContaining({
                    path: '/api/messages',
                    patientId: 'patient-123',
                    hasContent: true
                })
            );
            expect(mockNext).toHaveBeenCalled();
        });

        it('should check for key rotation needs', () => {
            mockEncryptionService.needsRotation.mockReturnValue(true);
            mockRequest.body = {
                _encryptionKeyId: 'old-key-123'
            };

            validateEncryptionCompliance(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockEncryptionService.needsRotation).toHaveBeenCalledWith('old-key-123');
            expect(logger.info).toHaveBeenCalledWith(
                'Encryption key needs rotation',
                expect.objectContaining({
                    keyId: 'old-key-123',
                    path: '/api/messages'
                })
            );
            expect(mockNext).toHaveBeenCalled();
        });

        it('should handle validation errors gracefully', () => {
            mockEncryptionService.needsRotation.mockImplementation(() => {
                throw new Error('Validation error');
            });
            mockRequest.body = { _encryptionKeyId: 'test-key' };

            validateEncryptionCompliance(mockRequest as Request, mockResponse as Response, mockNext);

            expect(logger.error).toHaveBeenCalledWith(
                'Encryption compliance validation error',
                expect.objectContaining({
                    error: 'Validation error',
                    path: '/api/messages'
                })
            );
            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('handleEncryptionError', () => {
        it('should handle encryption-related errors', () => {
            const encryptionError = new Error('Encryption service unavailable');

            handleEncryptionError(encryptionError, mockRequest as Request, mockResponse as Response, mockNext);

            expect(logger.error).toHaveBeenCalledWith(
                'Encryption service error',
                expect.objectContaining({
                    error: 'Encryption service unavailable',
                    path: '/api/messages',
                    method: 'POST',
                    timestamp: expect.any(String)
                })
            );

            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: false,
                error: 'Secure communication service temporarily unavailable',
                code: 'ENCRYPTION_SERVICE_ERROR',
                timestamp: expect.any(String)
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should handle decryption-related errors', () => {
            const decryptionError = new Error('Decryption failed for message');

            handleEncryptionError(decryptionError, mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: 'ENCRYPTION_SERVICE_ERROR'
                })
            );
        });

        it('should pass through non-encryption errors', () => {
            const generalError = new Error('General application error');

            handleEncryptionError(generalError, mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalledWith(generalError);
            expect(mockResponse.status).not.toHaveBeenCalled();
            expect(mockResponse.json).not.toHaveBeenCalled();
        });
    });

    describe('Content Detection Logic', () => {
        it('should encrypt messages in communication endpoints', async () => {
            mockRequest.path = '/api/conversations/123/messages';
            mockRequest.body = {
                content: { text: 'Regular message' }
            };

            await encryptMessageContent(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockEncryptionService.encryptMessage).toHaveBeenCalled();
        });

        it('should encrypt patient-related content', async () => {
            mockRequest.path = '/api/general';
            mockRequest.params = { patientId: 'patient-123' };
            mockRequest.body = {
                content: { text: 'Message about patient' }
            };

            await encryptMessageContent(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockEncryptionService.encryptMessage).toHaveBeenCalled();
        });

        it('should encrypt content with sensitive keywords', async () => {
            mockRequest.path = '/api/general';
            mockRequest.body = {
                text: 'The patient needs medication adjustment'
            };

            await encryptMessageContent(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockEncryptionService.encryptMessage).toHaveBeenCalled();
        });

        it('should not encrypt non-sensitive content', async () => {
            mockRequest.path = '/api/general';
            mockRequest.body = {
                content: { text: 'Hello, how are you today?' }
            };

            await encryptMessageContent(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockEncryptionService.encryptMessage).not.toHaveBeenCalled();
            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('Response Decryption Logic', () => {
        let originalJson: jest.Mock;

        beforeEach(async () => {
            originalJson = jest.fn();
            mockResponse.json = originalJson;
            await decryptMessageContent(mockRequest as Request, mockResponse as Response, mockNext);
        });

        it('should decrypt array of messages', async () => {
            const responseData = [
                {
                    content: {
                        text: 'encrypted-message-1',
                        _encrypted: true,
                        _encryptionKeyId: 'key-1'
                    }
                },
                {
                    content: {
                        text: 'encrypted-message-2',
                        _encrypted: true,
                        _encryptionKeyId: 'key-2'
                    }
                }
            ];

            (mockResponse.json as any)(responseData);
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(mockEncryptionService.decryptMessage).toHaveBeenCalledWith('encrypted-message-1', 'key-1');
            expect(mockEncryptionService.decryptMessage).toHaveBeenCalledWith('encrypted-message-2', 'key-2');
        });

        it('should handle nested encrypted content', async () => {
            const responseData = {
                conversation: {
                    messages: [
                        {
                            content: {
                                text: 'encrypted-nested',
                                _encrypted: true,
                                _encryptionKeyId: 'nested-key'
                            }
                        }
                    ]
                }
            };

            (mockResponse.json as any)(responseData);
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(mockEncryptionService.decryptMessage).toHaveBeenCalledWith('encrypted-nested', 'nested-key');
        });

        it('should preserve non-encrypted content', async () => {
            const responseData = {
                content: {
                    text: 'plain-text-message',
                    type: 'text'
                },
                metadata: {
                    timestamp: '2023-01-01T00:00:00Z'
                }
            };

            (mockResponse.json as any)(responseData);
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(mockEncryptionService.decryptMessage).not.toHaveBeenCalled();
        });
    });
});