import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { TokenService, TokenPayload } from '../services/tokenService';

// Mock logger to avoid console output during tests
jest.mock('../../../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
}));

describe('TokenService', () => {
    const mockOrderId = 'LAB-2024-0001';
    const mockWorkplaceId = new mongoose.Types.ObjectId().toString();
    const originalEnv = process.env;

    beforeAll(() => {
        // Set up test environment variables
        process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-minimum-32-characters-long';
        process.env.LAB_TOKEN_SECRET = 'test-lab-token-secret-key-minimum-32-characters-long';
        process.env.FRONTEND_URL = 'https://test.PharmacyCopilot.com';
    });

    afterAll(() => {
        // Restore original environment
        process.env = originalEnv;
    });

    describe('generateSecureToken', () => {
        it('should generate a valid secure token with default expiry', () => {
            const result = TokenService.generateSecureToken(mockOrderId, mockWorkplaceId);

            expect(result).toHaveProperty('token');
            expect(result).toHaveProperty('hashedToken');
            expect(result).toHaveProperty('expiresAt');
            expect(typeof result.token).toBe('string');
            expect(typeof result.hashedToken).toBe('string');
            expect(result.expiresAt).toBeInstanceOf(Date);
            expect(result.token.length).toBeGreaterThan(0);
            expect(result.hashedToken.length).toBe(64); // SHA256 hex length
        });

        it('should generate a token with custom expiry days', () => {
            const customExpiryDays = 7;
            const result = TokenService.generateSecureToken(mockOrderId, mockWorkplaceId, customExpiryDays);

            const expectedExpiry = new Date();
            expectedExpiry.setDate(expectedExpiry.getDate() + customExpiryDays);

            expect(result.expiresAt.getDate()).toBe(expectedExpiry.getDate());
        });

        it('should generate different tokens for different orders', () => {
            const result1 = TokenService.generateSecureToken('LAB-2024-0001', mockWorkplaceId);
            const result2 = TokenService.generateSecureToken('LAB-2024-0002', mockWorkplaceId);

            expect(result1.token).not.toBe(result2.token);
            expect(result1.hashedToken).not.toBe(result2.hashedToken);
        });

        it('should generate different tokens for different workplaces', () => {
            const workplace1 = new mongoose.Types.ObjectId().toString();
            const workplace2 = new mongoose.Types.ObjectId().toString();

            const result1 = TokenService.generateSecureToken(mockOrderId, workplace1);
            const result2 = TokenService.generateSecureToken(mockOrderId, workplace2);

            expect(result1.token).not.toBe(result2.token);
            expect(result1.hashedToken).not.toBe(result2.hashedToken);
        });
    });

    describe('generateRandomToken', () => {
        it('should generate a random token with default length', () => {
            const token = TokenService.generateRandomToken();

            expect(typeof token).toBe('string');
            expect(token.length).toBe(64); // 32 bytes * 2 (hex)
            expect(/^[a-f0-9]+$/i.test(token)).toBe(true);
        });

        it('should generate a random token with custom length', () => {
            const customLength = 16;
            const token = TokenService.generateRandomToken(customLength);

            expect(token.length).toBe(customLength * 2); // bytes * 2 (hex)
        });

        it('should generate different tokens on multiple calls', () => {
            const token1 = TokenService.generateRandomToken();
            const token2 = TokenService.generateRandomToken();

            expect(token1).not.toBe(token2);
        });
    });

    describe('validateToken', () => {
        it('should validate a valid token successfully', () => {
            const { token } = TokenService.generateSecureToken(mockOrderId, mockWorkplaceId);
            const result = TokenService.validateToken(token);

            expect(result.valid).toBe(true);
            expect(result.payload).toBeDefined();
            expect(result.payload?.orderId).toBe(mockOrderId);
            expect(result.payload?.workplaceId).toBe(mockWorkplaceId);
            expect(result.payload?.type).toBe('lab_order_access');
            expect(result.error).toBeUndefined();
        });

        it('should reject an invalid token', () => {
            const invalidToken = 'invalid.token.here';
            const result = TokenService.validateToken(invalidToken);

            expect(result.valid).toBe(false);
            expect(result.payload).toBeUndefined();
            expect(result.error).toBeDefined();
            expect(result.error).toContain('Invalid token format');
        });

        it('should reject an expired token', () => {
            // Create a token with a past expiration time
            const pastTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
            const payload: TokenPayload = {
                orderId: mockOrderId,
                workplaceId: mockWorkplaceId,
                type: 'lab_order_access',
                exp: pastTime
            };

            const expiredToken = jwt.sign(
                payload,
                process.env.LAB_TOKEN_SECRET!,
                {
                    issuer: 'PharmacyCopilot-lab-module',
                    audience: 'lab-order-access',
                    noTimestamp: true // Don't add iat automatically
                }
            );

            const result = TokenService.validateToken(expiredToken);
            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
            // Note: For security reasons, expired tokens return generic "Invalid token format" error
            expect(result.error).toContain('Invalid token format');
        });

        it('should reject a token with invalid payload structure', () => {
            const invalidPayload = {
                orderId: mockOrderId,
                // Missing workplaceId and type
            };

            const invalidToken = jwt.sign(
                invalidPayload,
                process.env.LAB_TOKEN_SECRET!,
                {
                    issuer: 'PharmacyCopilot-lab-module',
                    audience: 'lab-order-access'
                }
            );

            const result = TokenService.validateToken(invalidToken);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('Invalid token format');
        });

        it('should reject a token with invalid workplace ID format', () => {
            const invalidPayload: TokenPayload = {
                orderId: mockOrderId,
                workplaceId: 'invalid-workplace-id',
                type: 'lab_order_access'
            };

            const invalidToken = jwt.sign(
                invalidPayload,
                process.env.LAB_TOKEN_SECRET!,
                {
                    issuer: 'PharmacyCopilot-lab-module',
                    audience: 'lab-order-access'
                }
            );

            const result = TokenService.validateToken(invalidToken);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('Invalid token format');
        });
    });

    describe('hashToken', () => {
        it('should generate a consistent hash for the same token', () => {
            const token = 'test-token-123';
            const hash1 = TokenService.hashToken(token);
            const hash2 = TokenService.hashToken(token);

            expect(hash1).toBe(hash2);
            expect(typeof hash1).toBe('string');
            expect(hash1.length).toBe(64); // SHA256 hex length
        });

        it('should generate different hashes for different tokens', () => {
            const token1 = 'test-token-123';
            const token2 = 'test-token-456';
            const hash1 = TokenService.hashToken(token1);
            const hash2 = TokenService.hashToken(token2);

            expect(hash1).not.toBe(hash2);
        });
    });

    describe('verifyTokenHash', () => {
        it('should verify a correct token hash', () => {
            const token = 'test-token-123';
            const hash = TokenService.hashToken(token);
            const isValid = TokenService.verifyTokenHash(token, hash);

            expect(isValid).toBe(true);
        });

        it('should reject an incorrect token hash', () => {
            const token = 'test-token-123';
            const wrongHash = TokenService.hashToken('different-token');
            const isValid = TokenService.verifyTokenHash(token, wrongHash);

            expect(isValid).toBe(false);
        });
    });

    describe('generateQRCodeData', () => {
        it('should generate QR code data with default base URL', () => {
            const token = 'test-token-123';
            const qrData = TokenService.generateQRCodeData(token);

            expect(qrData).toContain(process.env.FRONTEND_URL);
            expect(qrData).toContain('/lab/scan?token=');
            expect(qrData).toContain(encodeURIComponent(token));
        });

        it('should generate QR code data with custom base URL', () => {
            const token = 'test-token-123';
            const customUrl = 'https://custom.example.com';
            const qrData = TokenService.generateQRCodeData(token, customUrl);

            expect(qrData).toContain(customUrl);
            expect(qrData).toContain('/lab/scan?token=');
            expect(qrData).toContain(encodeURIComponent(token));
        });
    });

    describe('generateBarcodeData', () => {
        it('should generate barcode data in correct format', () => {
            const token = 'test-token-123';
            const barcodeData = TokenService.generateBarcodeData(mockOrderId, token);

            expect(barcodeData).toContain(mockOrderId);
            expect(barcodeData).toContain(':');
            expect(barcodeData.split(':').length).toBe(2);

            const [orderId, tokenHash] = barcodeData.split(':');
            expect(orderId).toBe(mockOrderId);
            expect(tokenHash).toBeDefined();
            expect(tokenHash!.length).toBe(16);
            expect(/^[a-f0-9]+$/i.test(tokenHash!)).toBe(true);
        });
    });

    describe('parseBarcodeData', () => {
        it('should parse valid barcode data correctly', () => {
            const token = 'test-token-123';
            const barcodeData = TokenService.generateBarcodeData(mockOrderId, token);
            const parsed = TokenService.parseBarcodeData(barcodeData);

            expect(parsed).not.toBeNull();
            expect(parsed?.orderId).toBe(mockOrderId);
            expect(parsed?.tokenHash).toBeDefined();
            expect(parsed?.tokenHash.length).toBe(16);
        });

        it('should return null for invalid barcode format', () => {
            const invalidBarcodes = [
                'invalid-format',
                'LAB-2024-0001', // Missing token hash
                'LAB-2024-0001:invalid:extra', // Too many parts
                'INVALID-ID:abcd1234abcd1234', // Invalid order ID format
                'LAB-2024-0001:xyz' // Invalid token hash format
            ];

            invalidBarcodes.forEach(barcode => {
                const parsed = TokenService.parseBarcodeData(barcode);
                expect(parsed).toBeNull();
            });
        });
    });

    describe('isTokenExpired', () => {
        it('should return false for future expiration date', () => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 1);

            const isExpired = TokenService.isTokenExpired(futureDate);
            expect(isExpired).toBe(false);
        });

        it('should return true for past expiration date', () => {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 1);

            const isExpired = TokenService.isTokenExpired(pastDate);
            expect(isExpired).toBe(true);
        });
    });

    describe('generateTokenWithExpiry', () => {
        it('should generate token with custom expiration date', () => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 5);

            const result = TokenService.generateTokenWithExpiry(mockOrderId, mockWorkplaceId, futureDate);

            expect(result).toHaveProperty('token');
            expect(result).toHaveProperty('hashedToken');
            expect(result).toHaveProperty('expiresAt');
            expect(result.expiresAt.getDate()).toBe(futureDate.getDate());
        });

        it('should throw error for past expiration date', () => {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 1);

            expect(() => {
                TokenService.generateTokenWithExpiry(mockOrderId, mockWorkplaceId, pastDate);
            }).toThrow('Expiration date must be in the future');
        });
    });

    describe('validateTokenWithExpiry', () => {
        it('should validate token that is not expired', () => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 1);

            const { token } = TokenService.generateSecureToken(mockOrderId, mockWorkplaceId);
            const result = TokenService.validateTokenWithExpiry(token, futureDate);

            expect(result.valid).toBe(true);
            expect(result.payload).toBeDefined();
        });

        it('should reject token that is expired by date', () => {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 1);

            const { token } = TokenService.generateSecureToken(mockOrderId, mockWorkplaceId);
            const result = TokenService.validateTokenWithExpiry(token, pastDate);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('expired');
        });
    });

    describe('generateLabOrderTokens', () => {
        it('should generate all token formats for a lab order', () => {
            const result = TokenService.generateLabOrderTokens(mockOrderId, mockWorkplaceId);

            expect(result).toHaveProperty('primary');
            expect(result).toHaveProperty('qrCodeData');
            expect(result).toHaveProperty('barcodeData');

            expect(result.primary).toHaveProperty('token');
            expect(result.primary).toHaveProperty('hashedToken');
            expect(result.primary).toHaveProperty('expiresAt');

            expect(typeof result.qrCodeData).toBe('string');
            expect(result.qrCodeData).toContain('/lab/scan?token=');

            expect(typeof result.barcodeData).toBe('string');
            expect(result.barcodeData).toContain(mockOrderId);
            expect(result.barcodeData).toContain(':');
        });

        it('should generate tokens with custom expiry', () => {
            const customExpiryDays = 14;
            const result = TokenService.generateLabOrderTokens(mockOrderId, mockWorkplaceId, customExpiryDays);

            const expectedExpiry = new Date();
            expectedExpiry.setDate(expectedExpiry.getDate() + customExpiryDays);

            expect(result.primary.expiresAt.getDate()).toBe(expectedExpiry.getDate());
        });
    });

    describe('Security Tests', () => {
        it('should generate cryptographically secure tokens', () => {
            const tokens = Array.from({ length: 100 }, () =>
                TokenService.generateRandomToken()
            );

            // Check uniqueness
            const uniqueTokens = new Set(tokens);
            expect(uniqueTokens.size).toBe(tokens.length);

            // Check entropy (basic test)
            tokens.forEach(token => {
                expect(token.length).toBe(64);
                expect(/^[a-f0-9]+$/i.test(token)).toBe(true);
            });
        });

        it('should generate secure JWT tokens with proper claims', () => {
            const { token } = TokenService.generateSecureToken(mockOrderId, mockWorkplaceId);
            const decoded = jwt.decode(token, { complete: true });

            expect(decoded).toBeDefined();
            expect(decoded?.header.alg).toBe('HS256');
            expect(decoded?.payload).toHaveProperty('orderId', mockOrderId);
            expect(decoded?.payload).toHaveProperty('workplaceId', mockWorkplaceId);
            expect(decoded?.payload).toHaveProperty('type', 'lab_order_access');
            expect(decoded?.payload).toHaveProperty('iss', 'PharmacyCopilot-lab-module');
            expect(decoded?.payload).toHaveProperty('aud', 'lab-order-access');
            expect(decoded?.payload).toHaveProperty('exp');
            expect(decoded?.payload).toHaveProperty('iat');
        });

        it('should produce consistent hashes for token verification', () => {
            const token = TokenService.generateRandomToken();
            const hash1 = TokenService.hashToken(token);
            const hash2 = TokenService.hashToken(token);

            expect(hash1).toBe(hash2);
            expect(TokenService.verifyTokenHash(token, hash1)).toBe(true);
        });
    });
});