import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import TokenService, { TokenPayload } from '../services/tokenService';

// Mock logger to avoid console output during tests
jest.mock('../../../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
}));

describe('TokenService - Comprehensive Tests', () => {
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

            // Allow for small time differences in test execution
            const timeDiff = Math.abs(result.expiresAt.getTime() - expectedExpiry.getTime());
            expect(timeDiff).toBeLessThan(1000); // Less than 1 second difference
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

        it('should generate tokens with proper JWT structure', () => {
            const result = TokenService.generateSecureToken(mockOrderId, mockWorkplaceId);
            const decoded = jwt.decode(result.token, { complete: true });

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

        it('should handle edge cases for expiry days', () => {
            // Test with 0 days (should create token that expires today)
            const result0 = TokenService.generateSecureToken(mockOrderId, mockWorkplaceId, 0);
            const today = new Date();
            today.setHours(23, 59, 59, 999);
            expect(result0.expiresAt.getDate()).toBe(today.getDate());

            // Test with 1 day
            const result1 = TokenService.generateSecureToken(mockOrderId, mockWorkplaceId, 1);
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            expect(result1.expiresAt.getDate()).toBe(tomorrow.getDate());

            // Test with large number of days
            const result365 = TokenService.generateSecureToken(mockOrderId, mockWorkplaceId, 365);
            const nextYear = new Date();
            nextYear.setDate(nextYear.getDate() + 365);
            expect(result365.expiresAt.getFullYear()).toBe(nextYear.getFullYear());
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
            expect(/^[a-f0-9]+$/i.test(token)).toBe(true);
        });

        it('should generate different tokens on multiple calls', () => {
            const tokens = Array.from({ length: 100 }, () => TokenService.generateRandomToken());
            const uniqueTokens = new Set(tokens);

            expect(uniqueTokens.size).toBe(tokens.length);
        });

        it('should handle edge cases for token length', () => {
            // Test with minimum length
            const token1 = TokenService.generateRandomToken(1);
            expect(token1.length).toBe(2);

            // Test with zero length (should default to 32)
            const token0 = TokenService.generateRandomToken(0);
            expect(token0.length).toBe(64);

            // Test with large length
            const token256 = TokenService.generateRandomToken(256);
            expect(token256.length).toBe(512);
        });

        it('should generate cryptographically secure tokens', () => {
            const tokens = Array.from({ length: 1000 }, () => TokenService.generateRandomToken());

            // Check for proper distribution (basic entropy test)
            const charCounts = new Map<string, number>();
            const allChars = tokens.join('');

            for (const char of allChars) {
                charCounts.set(char, (charCounts.get(char) || 0) + 1);
            }

            // Should have reasonable distribution of hex characters
            const hexChars = '0123456789abcdef';
            for (const hexChar of hexChars) {
                const count = charCounts.get(hexChar) || 0;
                expect(count).toBeGreaterThan(0); // Each hex char should appear
            }
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

        it('should reject an invalid token format', () => {
            const invalidTokens = [
                'invalid.token.here',
                'not-a-jwt-token',
                '',
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', // Incomplete JWT
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature'
            ];

            invalidTokens.forEach(invalidToken => {
                const result = TokenService.validateToken(invalidToken);
                expect(result.valid).toBe(false);
                expect(result.payload).toBeUndefined();
                expect(result.error).toBeDefined();
                expect(result.error).toContain('Invalid token format');
            });
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
                    noTimestamp: true
                }
            );

            const result = TokenService.validateToken(expiredToken);
            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error).toContain('Invalid token format');
        });

        it('should reject a token with invalid payload structure', () => {
            const invalidPayloads = [
                { orderId: mockOrderId }, // Missing workplaceId and type
                { workplaceId: mockWorkplaceId }, // Missing orderId and type
                { type: 'lab_order_access' }, // Missing orderId and workplaceId
                { orderId: mockOrderId, workplaceId: mockWorkplaceId }, // Missing type
                { orderId: '', workplaceId: mockWorkplaceId, type: 'lab_order_access' }, // Empty orderId
                { orderId: mockOrderId, workplaceId: '', type: 'lab_order_access' }, // Empty workplaceId
                { orderId: mockOrderId, workplaceId: mockWorkplaceId, type: '' }, // Empty type
            ];

            invalidPayloads.forEach(invalidPayload => {
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

        it('should reject a token with invalid workplace ID format', () => {
            const invalidWorkplaceIds = [
                'invalid-workplace-id',
                '123',
                'not-an-objectid',
                '507f1f77bcf86cd799439011x' // Invalid ObjectId
            ];

            invalidWorkplaceIds.forEach(invalidWorkplaceId => {
                const invalidPayload: TokenPayload = {
                    orderId: mockOrderId,
                    workplaceId: invalidWorkplaceId,
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

        it('should reject a token with wrong secret', () => {
            const payload: TokenPayload = {
                orderId: mockOrderId,
                workplaceId: mockWorkplaceId,
                type: 'lab_order_access'
            };

            const tokenWithWrongSecret = jwt.sign(
                payload,
                'wrong-secret',
                {
                    issuer: 'PharmacyCopilot-lab-module',
                    audience: 'lab-order-access'
                }
            );

            const result = TokenService.validateToken(tokenWithWrongSecret);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Invalid token format');
        });

        it('should reject a token with wrong issuer or audience', () => {
            const payload: TokenPayload = {
                orderId: mockOrderId,
                workplaceId: mockWorkplaceId,
                type: 'lab_order_access'
            };

            // Wrong issuer
            const tokenWrongIssuer = jwt.sign(
                payload,
                process.env.LAB_TOKEN_SECRET!,
                {
                    issuer: 'wrong-issuer',
                    audience: 'lab-order-access'
                }
            );

            const resultWrongIssuer = TokenService.validateToken(tokenWrongIssuer);
            expect(resultWrongIssuer.valid).toBe(false);

            // Wrong audience
            const tokenWrongAudience = jwt.sign(
                payload,
                process.env.LAB_TOKEN_SECRET!,
                {
                    issuer: 'PharmacyCopilot-lab-module',
                    audience: 'wrong-audience'
                }
            );

            const resultWrongAudience = TokenService.validateToken(tokenWrongAudience);
            expect(resultWrongAudience.valid).toBe(false);
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
            expect(/^[a-f0-9]+$/i.test(hash1)).toBe(true);
        });

        it('should generate different hashes for different tokens', () => {
            const tokens = [
                'test-token-123',
                'test-token-456',
                'different-token',
                '',
                'a',
                'very-long-token-with-many-characters-to-test-hashing'
            ];

            const hashes = tokens.map(token => TokenService.hashToken(token));
            const uniqueHashes = new Set(hashes);

            expect(uniqueHashes.size).toBe(tokens.length);
        });

        it('should handle special characters and unicode', () => {
            const specialTokens = [
                'token-with-special-chars-!@#$%^&*()',
                'token-with-unicode-🔒🔑',
                'token\nwith\nnewlines',
                'token\twith\ttabs',
                'token with spaces'
            ];

            specialTokens.forEach(token => {
                const hash = TokenService.hashToken(token);
                expect(hash).toBeDefined();
                expect(hash.length).toBe(64);
                expect(/^[a-f0-9]+$/i.test(hash)).toBe(true);
            });
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

        it('should handle edge cases', () => {
            // Empty token and hash
            expect(TokenService.verifyTokenHash('', TokenService.hashToken(''))).toBe(true);
            expect(TokenService.verifyTokenHash('', 'non-empty-hash')).toBe(false);
            expect(TokenService.verifyTokenHash('non-empty-token', '')).toBe(false);

            // Invalid hash format
            expect(TokenService.verifyTokenHash('token', 'invalid-hash')).toBe(false);
            expect(TokenService.verifyTokenHash('token', 'too-short')).toBe(false);
            expect(TokenService.verifyTokenHash('token', 'g'.repeat(64))).toBe(false); // Invalid hex
        });
    });

    describe('generateQRCodeData', () => {
        it('should generate QR code data with default base URL', () => {
            const token = 'test-token-123';
            const qrData = TokenService.generateQRCodeData(token);

            expect(qrData).toContain(process.env.FRONTEND_URL);
            expect(qrData).toContain('/lab/scan?token=');
            expect(qrData).toContain(encodeURIComponent(token));
            expect(qrData).toBe(`${process.env.FRONTEND_URL}/lab/scan?token=${encodeURIComponent(token)}`);
        });

        it('should generate QR code data with custom base URL', () => {
            const token = 'test-token-123';
            const customUrl = 'https://custom.example.com';
            const qrData = TokenService.generateQRCodeData(token, customUrl);

            expect(qrData).toContain(customUrl);
            expect(qrData).toContain('/lab/scan?token=');
            expect(qrData).toContain(encodeURIComponent(token));
            expect(qrData).toBe(`${customUrl}/lab/scan?token=${encodeURIComponent(token)}`);
        });

        it('should handle special characters in tokens', () => {
            const specialTokens = [
                'token with spaces',
                'token+with+plus',
                'token&with&ampersand',
                'token=with=equals',
                'token?with?question'
            ];

            specialTokens.forEach(token => {
                const qrData = TokenService.generateQRCodeData(token);
                expect(qrData).toContain(encodeURIComponent(token));
                expect(qrData).toMatch(/^https?:\/\/.+\/lab\/scan\?token=.+$/);
            });
        });

        it('should handle empty or undefined base URL', () => {
            const token = 'test-token-123';

            // Should use environment variable when custom URL is empty
            const qrDataEmpty = TokenService.generateQRCodeData(token, '');
            expect(qrDataEmpty).toContain(process.env.FRONTEND_URL);

            // Should use environment variable when custom URL is undefined
            const qrDataUndefined = TokenService.generateQRCodeData(token, undefined);
            expect(qrDataUndefined).toContain(process.env.FRONTEND_URL);
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

        it('should generate consistent barcode data for same inputs', () => {
            const token = 'test-token-123';
            const barcodeData1 = TokenService.generateBarcodeData(mockOrderId, token);
            const barcodeData2 = TokenService.generateBarcodeData(mockOrderId, token);

            expect(barcodeData1).toBe(barcodeData2);
        });

        it('should generate different barcode data for different inputs', () => {
            const token1 = 'test-token-123';
            const token2 = 'test-token-456';
            const orderId2 = 'LAB-2024-0002';

            const barcodeData1 = TokenService.generateBarcodeData(mockOrderId, token1);
            const barcodeData2 = TokenService.generateBarcodeData(mockOrderId, token2);
            const barcodeData3 = TokenService.generateBarcodeData(orderId2, token1);

            expect(barcodeData1).not.toBe(barcodeData2);
            expect(barcodeData1).not.toBe(barcodeData3);
            expect(barcodeData2).not.toBe(barcodeData3);
        });

        it('should handle edge cases', () => {
            // Empty token
            const barcodeDataEmpty = TokenService.generateBarcodeData(mockOrderId, '');
            expect(barcodeDataEmpty).toContain(mockOrderId);
            expect(barcodeDataEmpty.split(':')[1]).toHaveLength(16);

            // Very long token
            const longToken = 'a'.repeat(1000);
            const barcodeDataLong = TokenService.generateBarcodeData(mockOrderId, longToken);
            expect(barcodeDataLong).toContain(mockOrderId);
            expect(barcodeDataLong.split(':')[1]).toHaveLength(16);
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
            expect(/^[a-f0-9]+$/i.test(parsed?.tokenHash!)).toBe(true);
        });

        it('should return null for invalid barcode format', () => {
            const invalidBarcodes = [
                'invalid-format',
                'LAB-2024-0001', // Missing token hash
                'LAB-2024-0001:invalid:extra', // Too many parts
                'INVALID-ID:abcd1234abcd1234', // Invalid order ID format
                'LAB-2024-0001:xyz', // Invalid token hash format (too short)
                'LAB-2024-0001:xyz123', // Invalid token hash format (too short)
                'LAB-2024-0001:' + 'g'.repeat(16), // Invalid hex characters
                '', // Empty string
                ':', // Just separator
                'LAB-2024-0001:', // Missing token hash
                ':abcd1234abcd1234' // Missing order ID
            ];

            invalidBarcodes.forEach(barcode => {
                const parsed = TokenService.parseBarcodeData(barcode);
                expect(parsed).toBeNull();
            });
        });

        it('should validate order ID format strictly', () => {
            const invalidOrderIds = [
                'LAB-24-0001', // Wrong year format
                'LAB-2024-001', // Wrong sequence format
                'LAB-2024-00001', // Too long sequence
                'lab-2024-0001', // Lowercase
                'ORDER-2024-0001', // Wrong prefix
                'LAB2024-0001', // Missing separator
                'LAB-2024_0001' // Wrong separator
            ];

            invalidOrderIds.forEach(orderId => {
                const barcodeData = `${orderId}:abcd1234abcd1234`;
                const parsed = TokenService.parseBarcodeData(barcodeData);
                expect(parsed).toBeNull();
            });
        });

        it('should validate token hash format strictly', () => {
            const invalidTokenHashes = [
                'abcd1234abcd123', // Too short
                'abcd1234abcd12345', // Too long
                'ABCD1234ABCD1234', // Uppercase (should be lowercase)
                'abcd1234abcd123g', // Invalid hex character
                'abcd1234abcd123!', // Special character
                'abcd 1234abcd1234' // Space character
            ];

            invalidTokenHashes.forEach(tokenHash => {
                const barcodeData = `${mockOrderId}:${tokenHash}`;
                const parsed = TokenService.parseBarcodeData(barcodeData);
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

        it('should handle edge cases around current time', () => {
            const now = new Date();
            const almostNow = new Date(now.getTime() + 100); // 100ms in future
            const justPast = new Date(now.getTime() - 100); // 100ms in past

            expect(TokenService.isTokenExpired(almostNow)).toBe(false);
            expect(TokenService.isTokenExpired(justPast)).toBe(true);
        });

        it('should handle invalid dates', () => {
            const invalidDate = new Date('invalid');
            expect(TokenService.isTokenExpired(invalidDate)).toBe(true);
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

            // Allow for small time differences
            const timeDiff = Math.abs(result.expiresAt.getTime() - futureDate.getTime());
            expect(timeDiff).toBeLessThan(1000);
        });

        it('should throw error for past expiration date', () => {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 1);

            expect(() => {
                TokenService.generateTokenWithExpiry(mockOrderId, mockWorkplaceId, pastDate);
            }).toThrow('Expiration date must be in the future');
        });

        it('should throw error for invalid expiration date', () => {
            const invalidDate = new Date('invalid');

            expect(() => {
                TokenService.generateTokenWithExpiry(mockOrderId, mockWorkplaceId, invalidDate);
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

        it('should handle invalid tokens with expiry check', () => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 1);

            const result = TokenService.validateTokenWithExpiry('invalid-token', futureDate);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('Invalid token format');
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

            // Allow for small time differences
            const timeDiff = Math.abs(result.primary.expiresAt.getTime() - expectedExpiry.getTime());
            expect(timeDiff).toBeLessThan(1000);
        });

        it('should generate consistent QR and barcode data', () => {
            const result = TokenService.generateLabOrderTokens(mockOrderId, mockWorkplaceId);

            // QR code should contain the primary token
            expect(result.qrCodeData).toContain(encodeURIComponent(result.primary.token));

            // Barcode should be parseable and contain order ID
            const parsed = TokenService.parseBarcodeData(result.barcodeData);
            expect(parsed).not.toBeNull();
            expect(parsed?.orderId).toBe(mockOrderId);
        });

        it('should generate different tokens for different orders', () => {
            const result1 = TokenService.generateLabOrderTokens('LAB-2024-0001', mockWorkplaceId);
            const result2 = TokenService.generateLabOrderTokens('LAB-2024-0002', mockWorkplaceId);

            expect(result1.primary.token).not.toBe(result2.primary.token);
            expect(result1.qrCodeData).not.toBe(result2.qrCodeData);
            expect(result1.barcodeData).not.toBe(result2.barcodeData);
        });
    });

    describe('Security and Performance Tests', () => {
        it('should generate cryptographically secure tokens', () => {
            const tokens = Array.from({ length: 100 }, () =>
                TokenService.generateSecureToken(mockOrderId, mockWorkplaceId)
            );

            // Check uniqueness
            const uniqueTokens = new Set(tokens.map(t => t.token));
            expect(uniqueTokens.size).toBe(tokens.length);

            const uniqueHashes = new Set(tokens.map(t => t.hashedToken));
            expect(uniqueHashes.size).toBe(tokens.length);
        });

        it('should handle high-volume token generation efficiently', () => {
            const startTime = Date.now();
            const tokenCount = 1000;

            const tokens = Array.from({ length: tokenCount }, () =>
                TokenService.generateSecureToken(mockOrderId, mockWorkplaceId)
            );

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Should generate 1000 tokens in reasonable time (less than 5 seconds)
            expect(duration).toBeLessThan(5000);
            expect(tokens).toHaveLength(tokenCount);

            // All tokens should be unique
            const uniqueTokens = new Set(tokens.map(t => t.token));
            expect(uniqueTokens.size).toBe(tokenCount);
        });

        it('should handle concurrent token generation safely', async () => {
            const concurrentCount = 50;
            const promises = Array.from({ length: concurrentCount }, (_, i) =>
                Promise.resolve(TokenService.generateSecureToken(`LAB-2024-${i.toString().padStart(4, '0')}`, mockWorkplaceId))
            );

            const tokens = await Promise.all(promises);

            // All tokens should be unique
            const uniqueTokens = new Set(tokens.map(t => t.token));
            expect(uniqueTokens.size).toBe(concurrentCount);

            const uniqueHashes = new Set(tokens.map(t => t.hashedToken));
            expect(uniqueHashes.size).toBe(concurrentCount);
        });

        it('should produce consistent hashes for token verification', () => {
            const testCases = [
                'simple-token',
                'token-with-special-chars-!@#$%^&*()',
                'very-long-token-' + 'a'.repeat(1000),
                '',
                '🔒🔑', // Unicode characters
                '\n\t\r' // Control characters
            ];

            testCases.forEach(token => {
                const hash1 = TokenService.hashToken(token);
                const hash2 = TokenService.hashToken(token);

                expect(hash1).toBe(hash2);
                expect(TokenService.verifyTokenHash(token, hash1)).toBe(true);
                expect(TokenService.verifyTokenHash(token + 'modified', hash1)).toBe(false);
            });
        });
    });
});