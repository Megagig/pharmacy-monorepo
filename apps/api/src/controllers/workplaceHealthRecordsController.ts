import { Response } from 'express';
import { AuthRequest } from '../types/auth';
import Workplace from '../models/Workplace';
import { AppError } from '../utils/AppError';
import logger from '../utils/logger';

/**
 * Get health records feature flags for current workplace
 * GET /api/workplace/health-records-features
 */
export const getHealthRecordsFeatures = async (req: AuthRequest, res: Response) => {
    try {
        const workplaceId = req.user?.workplaceId;

        if (!workplaceId) {
            throw new AppError('Workplace ID not found', 400);
        }

        const workplace = await Workplace.findById(workplaceId).select(
            'healthRecordsFeatures patientPortalEnabled name'
        );

        if (!workplace) {
            throw new AppError('Workplace not found', 404);
        }

        // Return default values if not set
        const features = workplace.healthRecordsFeatures || {
            labResults: true,
            vitalsTracking: true,
            visitHistory: true,
            downloadRecords: true,
            vitalsVerification: true,
            visitSummaries: true,
        };

        res.status(200).json({
            success: true,
            data: {
                workplaceName: workplace.name,
                patientPortalEnabled: workplace.patientPortalEnabled,
                features,
            },
        });
    } catch (error: any) {
        logger.error('Error fetching health records features:', error);
        if (error instanceof AppError) {
            res.status(error.statusCode).json({
                success: false,
                message: error.message,
            });
        } else {
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to fetch health records features',
            });
        }
    }
};

/**
 * Update health records feature flags
 * PATCH /api/workplace/health-records-features
 */
export const updateHealthRecordsFeatures = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const workplaceId = req.user?.workplaceId;
        const updates = req.body;

        if (!workplaceId) {
            throw new AppError('Workplace ID not found', 400);
        }

        const workplace = await Workplace.findById(workplaceId);

        if (!workplace) {
            throw new AppError('Workplace not found', 404);
        }

        // Initialize healthRecordsFeatures if not exists
        if (!workplace.healthRecordsFeatures) {
            workplace.healthRecordsFeatures = {
                labResults: true,
                vitalsTracking: true,
                visitHistory: true,
                downloadRecords: true,
                vitalsVerification: true,
                visitSummaries: true,
            };
        }

        // Update only provided features
        const allowedFeatures = [
            'labResults',
            'vitalsTracking',
            'visitHistory',
            'downloadRecords',
            'vitalsVerification',
            'visitSummaries',
        ];

        let updatedCount = 0;
        for (const feature of allowedFeatures) {
            if (updates[feature] !== undefined) {
                workplace.healthRecordsFeatures[feature] = Boolean(updates[feature]);
                updatedCount++;
            }
        }

        if (updatedCount === 0) {
            throw new AppError('No valid features to update', 400);
        }

        await workplace.save();

        logger.info(
            `Health records features updated for workplace ${workplaceId}: ${updatedCount} features changed`
        );

        res.status(200).json({
            success: true,
            message: `Successfully updated ${updatedCount} feature(s)`,
            data: {
                features: workplace.healthRecordsFeatures,
            },
        });
    } catch (error: any) {
        logger.error('Error updating health records features:', error);
        if (error instanceof AppError) {
            res.status(error.statusCode).json({
                success: false,
                message: error.message,
            });
        } else {
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to update health records features',
            });
        }
    }
};

/**
 * Toggle a specific feature on/off
 * PATCH /api/workplace/health-records-features/:featureName/toggle
 */
export const toggleFeature = async (req: AuthRequest, res: Response) => {
    try {
        const workplaceId = req.user?.workplaceId;
        const { featureName } = req.params;

        if (!workplaceId) {
            throw new AppError('Workplace ID not found', 400);
        }

        const allowedFeatures = [
            'labResults',
            'vitalsTracking',
            'visitHistory',
            'downloadRecords',
            'vitalsVerification',
            'visitSummaries',
        ];

        if (!allowedFeatures.includes(featureName)) {
            throw new AppError('Invalid feature name', 400);
        }

        const workplace = await Workplace.findById(workplaceId);

        if (!workplace) {
            throw new AppError('Workplace not found', 404);
        }

        // Initialize healthRecordsFeatures if not exists
        if (!workplace.healthRecordsFeatures) {
            workplace.healthRecordsFeatures = {
                labResults: true,
                vitalsTracking: true,
                visitHistory: true,
                downloadRecords: true,
                vitalsVerification: true,
                visitSummaries: true,
            };
        }

        // Toggle the feature
        const currentValue = workplace.healthRecordsFeatures[featureName];
        workplace.healthRecordsFeatures[featureName] = !currentValue;

        await workplace.save();

        logger.info(
            `Feature ${featureName} toggled to ${!currentValue} for workplace ${workplaceId}`
        );

        res.status(200).json({
            success: true,
            message: `Feature ${featureName} ${!currentValue ? 'enabled' : 'disabled'}`,
            data: {
                featureName,
                enabled: !currentValue,
                allFeatures: workplace.healthRecordsFeatures,
            },
        });
    } catch (error: any) {
        logger.error('Error toggling feature:', error);
        if (error instanceof AppError) {
            res.status(error.statusCode).json({
                success: false,
                message: error.message,
            });
        } else {
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to toggle feature',
            });
        }
    }
};

/**
 * Reset all features to default (all enabled)
 * POST /api/workplace/health-records-features/reset
 */
export const resetFeaturesToDefault = async (req: AuthRequest, res: Response) => {
    try {
        const workplaceId = req.user?.workplaceId;

        if (!workplaceId) {
            throw new AppError('Workplace ID not found', 400);
        }

        const workplace = await Workplace.findById(workplaceId);

        if (!workplace) {
            throw new AppError('Workplace not found', 404);
        }

        workplace.healthRecordsFeatures = {
            labResults: true,
            vitalsTracking: true,
            visitHistory: true,
            downloadRecords: true,
            vitalsVerification: true,
            visitSummaries: true,
        };

        await workplace.save();

        logger.info(`Health records features reset to default for workplace ${workplaceId}`);

        res.status(200).json({
            success: true,
            message: 'All features reset to default (enabled)',
            data: {
                features: workplace.healthRecordsFeatures,
            },
        });
    } catch (error: any) {
        logger.error('Error resetting features:', error);
        if (error instanceof AppError) {
            res.status(error.statusCode).json({
                success: false,
                message: error.message,
            });
        } else {
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to reset features',
            });
        }
    }
};

/**
 * Get feature statistics (how many workplaces have each feature enabled)
 * GET /api/workplace/health-records-features/stats
 * Super Admin only
 */
export const getFeatureStats = async (req: AuthRequest, res: Response) => {
    try {
        const workplaces = await Workplace.find({}).select('healthRecordsFeatures');

        const stats = {
            totalWorkplaces: workplaces.length,
            features: {
                labResults: { enabled: 0, disabled: 0 },
                vitalsTracking: { enabled: 0, disabled: 0 },
                visitHistory: { enabled: 0, disabled: 0 },
                downloadRecords: { enabled: 0, disabled: 0 },
                vitalsVerification: { enabled: 0, disabled: 0 },
                visitSummaries: { enabled: 0, disabled: 0 },
            },
        };

        workplaces.forEach((workplace) => {
            const features = workplace.healthRecordsFeatures || {
                labResults: true,
                vitalsTracking: true,
                visitHistory: true,
                downloadRecords: true,
                vitalsVerification: true,
                visitSummaries: true,
            };

            Object.keys(stats.features).forEach((feature) => {
                if (features[feature]) {
                    stats.features[feature].enabled++;
                } else {
                    stats.features[feature].disabled++;
                }
            });
        });

        res.status(200).json({
            success: true,
            data: stats,
        });
    } catch (error: any) {
        logger.error('Error fetching feature stats:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch feature statistics',
        });
    }
};
