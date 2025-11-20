import { Request, Response, NextFunction } from 'express';
import { AuthRequest, auth } from './auth';
import { IUser } from '../models/User';

/**
 * WorkspaceAuthRequest extends AuthRequest for workspace-specific operations
 */
export interface WorkspaceAuthRequest extends Request {
    user?: IUser & {
        _id: string;
        workplaceId: string;
        role: string;
        currentUsage?: number;
        usageLimit?: number;
    };
    subscription?: any;
}

/**
 * Middleware for workspace admin authentication
 * Uses the existing auth middleware and ensures user has workspace access
 */
export const workspaceAuth = async (
    req: WorkspaceAuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    // Use the existing auth middleware
    await auth(req as AuthRequest, res, () => {
        // After authentication, ensure user has workplace context
        if (!req.user) {
            res.status(401).json({
                success: false,
                error: {
                    code: 'AUTHENTICATION_REQUIRED',
                    message: 'Authentication required',
                },
            });
            return;
        }

        if (!req.user.workplaceId) {
            res.status(403).json({
                success: false,
                error: {
                    code: 'NO_WORKSPACE_ACCESS',
                    message: 'No workspace association found',
                },
            });
            return;
        }

        next();
    });
};

export default workspaceAuth;
