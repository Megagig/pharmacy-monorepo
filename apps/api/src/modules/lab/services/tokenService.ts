import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
// import logger from '../../../utils/logger';

export interface TokenPayload {
    orderId: string;
    workplaceId: string;
    type: 'lab_order_access';
    iat?: number;
    exp?: number;
}

export interface TokenValidationResult {
    valid: boolean;
    payload?: TokenPayload;
    error?: string;
}

export interface SecureTokenData {
    token: string;
    hashedToken: string;
    expiresAt: Date;
}

/**
 * Token Management Service for Manual Lab Orders
 * Handles secure token generation, validation, and resolution for QR/barcode access
 */
export class TokenService {
    private static readonly TOKEN_EXPIRY_DAYS = 30; // Default token expiry
    private static readonly TOKEN_SECRET = process.env.LAB_TOKEN_SECRET || process.env.JWT_SECRET || 'fallback-secret-for-testing';
    private static readonly HASH_ALGORITHM = 'sha256';

    /**
     * Generate a secure token for lab order access
     * Uses JWT with embedded order and workplace information
     */
    static generateSecureToken(
        orderId: string,
        workplaceId: string,
        expiryDays: number = TokenService.TOKEN_EXPIRY_DAYS
    ): SecureTokenData {
        try {
            // Create payload with order and workplace context
            const payload: TokenPayload = {
                orderId,
                workplaceId,
                type: 'lab_order_access'
            };

            // Generate JWT token with expiration
            const token = jwt.sign(
                payload,
                TokenService.TOKEN_SECRET,
                {
                    expiresIn: `${expiryDays}d`,
                    issuer: 'PharmacyCopilot-lab-module',
                    audience: 'lab-order-access'
                }
            );

            // Create hash for database storage
            const hashedToken = TokenService.hashToken(token);

            // Calculate expiration date
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + expiryDays);

            // logger.info('Secure token generated for lab order', {
            //     orderId,
            //     workplaceId,
            //     expiresAt: expiresAt.toISOString(),
            //     tokenLength: token.length
            // });

            return {
                token,
                hashedToken,
                expiresAt
            };
        } catch (error) {
            // logger.error('Failed to generate secure token', {
            //     orderId,
            //     workplaceId,
            //     error: error instanceof Error ? error.message : 'Unknown error'
            // });
            throw new Error('Token generation failed');
        }
    }

    /**
     * Generate a simple random token for fallback scenarios
     * Uses crypto.randomBytes for high entropy
     */
    static generateRandomToken(length: number = 32): string {
        try {
            return crypto.randomBytes(length).toString('hex');
        } catch (error) {
            // logger.error('Failed to generate random token', {
            //     length,
            //     error: error instanceof Error ? error.message : 'Unknown error'
            // });
            throw new Error('Random token generation failed');
        }
    }

    /**
     * Validate and decode a lab order access token
     */
    static validateToken(token: string): TokenValidationResult {
        try {
            // Verify JWT token
            const decoded = jwt.verify(
                token,
                TokenService.TOKEN_SECRET,
                {
                    issuer: 'PharmacyCopilot-lab-module',
                    audience: 'lab-order-access'
                }
            ) as TokenPayload;

            // Validate payload structure
            if (!decoded.orderId || !decoded.workplaceId || decoded.type !== 'lab_order_access') {
                return {
                    valid: false,
                    error: 'Invalid token payload structure'
                };
            }

            // Validate ObjectId format
            if (!mongoose.Types.ObjectId.isValid(decoded.workplaceId)) {
                return {
                    valid: false,
                    error: 'Invalid workplace ID format'
                };
            }

            // logger.info('Token validation successful', {
            //     orderId: decoded.orderId,
            //     workplaceId: decoded.workplaceId
            // });

            return {
                valid: true,
                payload: decoded
            };
        } catch (error) {
            let errorMessage = 'Token validation failed';

            if (error instanceof jwt.TokenExpiredError) {
                errorMessage = 'Token has expired';
            } else if (error instanceof jwt.JsonWebTokenError) {
                errorMessage = 'Invalid token format';
            } else if (error instanceof jwt.NotBeforeError) {
                errorMessage = 'Token not yet valid';
            }

            // logger.warn('Token validation failed', {
            //     error: errorMessage,
            //     tokenLength: token?.length || 0
            // });

            return {
                valid: false,
                error: errorMessage
            };
        }
    }

    /**
     * Hash a token for secure storage
     */
    static hashToken(token: string): string {
        try {
            return crypto
                .createHash(TokenService.HASH_ALGORITHM)
                .update(token)
                .digest('hex');
        } catch (error) {
            // logger.error('Failed to hash token', {
            //     error: error instanceof Error ? error.message : 'Unknown error'
            // });
            throw new Error('Token hashing failed');
        }
    }

    /**
     * Verify if a token matches its hash
     */
    static verifyTokenHash(token: string, hash: string): boolean {
        try {
            const computedHash = TokenService.hashToken(token);
            return computedHash === hash;
        } catch (error) {
            // logger.error('Failed to verify token hash', {
            //     error: error instanceof Error ? error.message : 'Unknown error'
            // });
            return false;
        }
    }

    /**
     * Generate QR code data with embedded token
     */
    static generateQRCodeData(token: string, baseUrl?: string): string {
        try {
            const scanUrl = baseUrl || process.env.FRONTEND_URL || 'https://app.PharmacyCopilot.com';
            return `${scanUrl}/lab/scan?token=${encodeURIComponent(token)}`;
        } catch (error) {
            // logger.error('Failed to generate QR code data', {
            //     error: error instanceof Error ? error.message : 'Unknown error'
            // });
            throw new Error('QR code data generation failed');
        }
    }

    /**
     * Generate barcode data (simplified format for barcode scanners)
     */
    static generateBarcodeData(orderId: string, token: string): string {
        try {
            // Create a compact barcode format: ORDER_ID:TOKEN_HASH
            const tokenHash = TokenService.hashToken(token).substring(0, 16); // First 16 chars
            return `${orderId}:${tokenHash}`;
        } catch (error) {
            // logger.error('Failed to generate barcode data', {
            //     orderId,
            //     error: error instanceof Error ? error.message : 'Unknown error'
            // });
            throw new Error('Barcode data generation failed');
        }
    }

    /**
     * Parse barcode data to extract order ID and token hash
     */
    static parseBarcodeData(barcodeData: string): { orderId: string; tokenHash: string } | null {
        try {
            const parts = barcodeData.split(':');
            if (parts.length !== 2) {
                return null;
            }

            const [orderId, tokenHash] = parts;

            // Ensure both parts exist
            if (!orderId || !tokenHash) {
                return null;
            }

            // Validate order ID format (LAB-YYYY-XXXX)
            if (!/^LAB-\d{4}-\d{4}$/.test(orderId)) {
                return null;
            }

            // Validate token hash format (16 hex characters)
            if (!/^[a-f0-9]{16}$/i.test(tokenHash)) {
                return null;
            }

            return { orderId, tokenHash };
        } catch (error) {
            // logger.error('Failed to parse barcode data', {
            //     barcodeData,
            //     error: error instanceof Error ? error.message : 'Unknown error'
            // });
            return null;
        }
    }

    /**
     * Check if a token is expired based on expiration date
     */
    static isTokenExpired(expiresAt: Date): boolean {
        return new Date() > expiresAt;
    }

    /**
     * Generate a secure token with custom expiration
     */
    static generateTokenWithExpiry(
        orderId: string,
        workplaceId: string,
        expiresAt: Date
    ): SecureTokenData {
        try {
            const now = new Date();
            const expiryDays = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

            if (expiryDays <= 0) {
                throw new Error('Expiration date must be in the future');
            }

            return TokenService.generateSecureToken(orderId, workplaceId, expiryDays);
        } catch (error) {
            // logger.error('Failed to generate token with custom expiry', {
            //     orderId,
            //     workplaceId,
            //     expiresAt: expiresAt.toISOString(),
            //     error: error instanceof Error ? error.message : 'Unknown error'
            // });
            if (error instanceof Error && error.message === 'Expiration date must be in the future') {
                throw error; // Re-throw the original error
            }
            throw new Error('Token generation with custom expiry failed');
        }
    }

    /**
     * Validate token and check expiration
     */
    static validateTokenWithExpiry(token: string, expiresAt: Date): TokenValidationResult {
        // First check if token is expired by date
        if (TokenService.isTokenExpired(expiresAt)) {
            return {
                valid: false,
                error: 'Token has expired'
            };
        }

        // Then validate the token itself
        return TokenService.validateToken(token);
    }

    /**
     * Generate multiple token formats for a lab order
     */
    static generateLabOrderTokens(
        orderId: string,
        workplaceId: string,
        expiryDays?: number
    ): {
        primary: SecureTokenData;
        qrCodeData: string;
        barcodeData: string;
    } {
        try {
            const primary = TokenService.generateSecureToken(orderId, workplaceId, expiryDays);
            const qrCodeData = TokenService.generateQRCodeData(primary.token);
            const barcodeData = TokenService.generateBarcodeData(orderId, primary.token);

            return {
                primary,
                qrCodeData,
                barcodeData
            };
        } catch (error) {
            // logger.error('Failed to generate lab order tokens', {
            //     orderId,
            //     workplaceId,
            //     error: error instanceof Error ? error.message : 'Unknown error'
            // });
            throw new Error('Lab order token generation failed');
        }
    }
}

export default TokenService;