import jwt from 'jsonwebtoken';
import logger from '../utils/logger';
import User from '../models/User';
import Workplace from '../models/Workplace';

export interface LegacyTokenPayload {
    userId?: string;
    id?: string; // Old format
    workspaceId?: string;
    pharmacyId?: string; // Legacy field
    iat?: number;
    exp?: number;
}

export interface ModernTokenPayload {
    userId: string;
    workspaceId?: string;
    workplaceRole?: string;
    iat: number;
    exp: number;
}

/**
 * Service to handle token compatibility between old and new authentication systems
 */
export class TokenCompatibilityService {

    /**
     * Verify and decode token with backward compatibility
     */
    static async verifyToken(token: string): Promise<{
        payload: LegacyTokenPayload | ModernTokenPayload;
        isLegacy: boolean;
        needsRefresh: boolean;
    }> {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET!) as LegacyTokenPayload;

            // Determine if this is a legacy token
            const isLegacy = !!(decoded.id && !decoded.userId) || !!decoded.pharmacyId;

            // Check if token needs refresh (missing workspace context)
            const needsRefresh = !decoded.workspaceId && !isLegacy;

            logger.debug('Token verification result', {
                isLegacy,
                needsRefresh,
                hasUserId: !!(decoded.userId || decoded.id),
                hasWorkspaceId: !!decoded.workspaceId,
                hasPharmacyId: !!decoded.pharmacyId,
            });

            return {
                payload: decoded,
                isLegacy,
                needsRefresh,
            };

        } catch (error) {
            logger.error('Token verification failed', { error });
            throw error;
        }
    }

    /**
     * Generate a new token with workspace context
     */
    static async generateModernToken(userId: string): Promise<string> {
        try {
            const user = await User.findById(userId).populate('workplaceId');

            if (!user) {
                throw new Error('User not found');
            }

            const payload: ModernTokenPayload = {
                userId: user._id.toString(),
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
            };

            // Add workspace context if available
            if (user.workplaceId) {
                payload.workspaceId = user.workplaceId.toString();
                payload.workplaceRole = user.workplaceRole;
            }

            const token = jwt.sign(payload, process.env.JWT_SECRET!);

            logger.info('Generated modern token', {
                userId,
                hasWorkspace: !!payload.workspaceId,
                workplaceRole: payload.workplaceRole,
            });

            return token;

        } catch (error) {
            logger.error('Failed to generate modern token', { error, userId });
            throw error;
        }
    }

    /**
     * Refresh token with updated workspace context
     */
    static async refreshTokenWithWorkspaceContext(oldToken: string): Promise<{
        newToken: string;
        user: any;
        workspace: any;
    }> {
        try {
            const { payload } = await this.verifyToken(oldToken);
            const userId = payload.userId || (payload as LegacyTokenPayload).id;

            if (!userId) {
                throw new Error('Invalid token payload');
            }

            // Load user with workspace context
            const user = await User.findById(userId).populate('workplaceId');

            if (!user) {
                throw new Error('User not found');
            }

            // Load workspace if user has one
            let workspace = null;
            if (user.workplaceId) {
                workspace = await Workplace.findById(user.workplaceId);
            }

            // Generate new token with workspace context
            const newToken = await this.generateModernToken(userId);

            logger.info('Token refreshed with workspace context', {
                userId,
                oldTokenLegacy: !!(payload as LegacyTokenPayload).id,
                hasWorkspace: !!workspace,
            });

            return {
                newToken,
                user,
                workspace,
            };

        } catch (error) {
            logger.error('Failed to refresh token', { error });
            throw error;
        }
    }

    /**
     * Migrate legacy token to modern format
     */
    static async migrateLegacyToken(legacyToken: string): Promise<{
        modernToken: string;
        migrationInfo: {
            wasLegacy: boolean;
            addedWorkspaceContext: boolean;
            userId: string;
            workspaceId?: string;
        };
    }> {
        try {
            const { payload, isLegacy } = await this.verifyToken(legacyToken);

            if (!isLegacy) {
                // Token is already modern, just return it
                return {
                    modernToken: legacyToken,
                    migrationInfo: {
                        wasLegacy: false,
                        addedWorkspaceContext: false,
                        userId: payload.userId!,
                        workspaceId: payload.workspaceId,
                    },
                };
            }

            // Extract user ID from legacy token
            const userId = (payload as LegacyTokenPayload).id || (payload as LegacyTokenPayload).userId;

            if (!userId) {
                throw new Error('No user ID found in legacy token');
            }

            // Load user and workspace context
            const user = await User.findById(userId);

            if (!user) {
                throw new Error('User not found for legacy token');
            }

            // If user doesn't have workspace, they need migration
            if (!user.workplaceId) {
                logger.warn('User in legacy token has no workspace - needs migration', {
                    userId,
                });
            }

            // Generate modern token
            const modernToken = await this.generateModernToken(userId);

            const migrationInfo = {
                wasLegacy: true,
                addedWorkspaceContext: !!user.workplaceId,
                userId,
                workspaceId: user.workplaceId?.toString(),
            };

            logger.info('Legacy token migrated', migrationInfo);

            return {
                modernToken,
                migrationInfo,
            };

        } catch (error) {
            logger.error('Failed to migrate legacy token', { error });
            throw error;
        }
    }

    /**
     * Validate token and return user context with compatibility handling
     */
    static async validateTokenAndGetContext(token: string): Promise<{
        user: any;
        workspace: any;
        subscription: any;
        isLegacyToken: boolean;
        needsMigration: boolean;
    }> {
        try {
            const { payload, isLegacy, needsRefresh } = await this.verifyToken(token);
            const userId = payload.userId || (payload as LegacyTokenPayload).id;

            if (!userId) {
                throw new Error('No user ID in token');
            }

            // Load user with all necessary relationships
            const User = require('../models/User').default;
            const Workplace = require('../models/Workplace').default;
            const Subscription = require('../models/Subscription').default;

            const user = await User.findById(userId)
                .populate('currentPlanId')
                .populate('workplaceId')
                .select('-passwordHash');

            if (!user) {
                throw new Error('User not found');
            }

            // Load workspace context
            let workspace = null;
            let subscription = null;

            if (user.workplaceId) {
                workspace = await Workplace.findById(user.workplaceId);

                if (workspace?.currentSubscriptionId) {
                    subscription = await Subscription.findById(workspace.currentSubscriptionId)
                        .populate('planId');
                }
            } else {
                // Fallback to user-based subscription for legacy compatibility
                subscription = await Subscription.findOne({
                    userId: user._id,
                    status: { $in: ['active', 'trial', 'past_due'] },
                }).populate('planId');
            }

            const needsMigration = !user.workplaceId || isLegacy;

            logger.debug('Token validation context', {
                userId,
                hasWorkspace: !!workspace,
                hasSubscription: !!subscription,
                isLegacyToken: isLegacy,
                needsMigration,
            });

            return {
                user,
                workspace,
                subscription,
                isLegacyToken: isLegacy,
                needsMigration,
            };

        } catch (error) {
            logger.error('Token validation failed', { error });
            throw error;
        }
    }

    /**
     * Check if token needs to be refreshed
     */
    static shouldRefreshToken(payload: LegacyTokenPayload | ModernTokenPayload): boolean {
        const now = Math.floor(Date.now() / 1000);
        const exp = payload.exp || 0;
        const timeUntilExpiry = exp - now;

        // Refresh if token expires in less than 1 hour
        const shouldRefresh = timeUntilExpiry < 3600;

        // Also refresh if it's a legacy token or missing workspace context
        const isLegacy = !!(payload as LegacyTokenPayload).id;
        const missingWorkspace = !payload.workspaceId && !isLegacy;

        return shouldRefresh || isLegacy || missingWorkspace;
    }

    /**
     * Extract user ID from any token format
     */
    static extractUserId(payload: LegacyTokenPayload | ModernTokenPayload): string | null {
        return payload.userId || (payload as LegacyTokenPayload).id || null;
    }

    /**
     * Extract workspace ID from any token format
     */
    static extractWorkspaceId(payload: LegacyTokenPayload | ModernTokenPayload): string | null {
        return payload.workspaceId || (payload as LegacyTokenPayload).pharmacyId || null;
    }
}

export default TokenCompatibilityService;