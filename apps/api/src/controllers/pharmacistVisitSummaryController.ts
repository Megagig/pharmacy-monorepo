import { Response } from 'express';
import { AuthRequest } from '../types/auth';
import Visit from '../models/Visit';
import Patient from '../models/Patient';
import { AppError } from '../utils/AppError';
import logger from '../utils/logger';
import mongoose from 'mongoose';
import healthRecordsNotificationService from '../services/healthRecordsNotificationService';

/**
 * Add or update patient summary for a visit
 * POST /api/pharmacist/visit-summaries/:visitId
 */
export const addOrUpdateSummary = async (req: AuthRequest, res: Response) => {
    try {
        const { visitId } = req.params;
        const { summary, keyPoints, nextSteps } = req.body;
        const userId = req.user?._id;

        if (!userId) {
            throw new AppError('User not authenticated', 401);
        }

        // Validate visitId
        if (!mongoose.Types.ObjectId.isValid(visitId)) {
            throw new AppError('Invalid visit ID', 400);
        }

        // Find the visit
        const visit = await Visit.findById(visitId).populate('patientId');
        if (!visit) {
            throw new AppError('Visit not found', 404);
        }

        // Check workspace access
        if (visit.workplaceId?.toString() !== req.user?.workplaceId?.toString()) {
            throw new AppError('Unauthorized access to this visit', 403);
        }

        const summaryData = {
            summary,
            keyPoints: keyPoints || [],
            nextSteps: nextSteps || [],
        };

        // Add or update summary
        if (visit.hasPatientSummary()) {
            await visit.updatePatientSummary(summaryData);
            logger.info(`Visit summary updated for visit ${visitId} by user ${userId}`);
        } else {
            await visit.addPatientSummary(summaryData, userId);
            logger.info(`Visit summary created for visit ${visitId} by user ${userId}`);
        }

        // Populate and return
        await visit.populate([
            { path: 'patientId', select: 'firstName lastName patientId' },
            { path: 'patientSummary.summarizedBy', select: 'firstName lastName' },
        ]);

        res.status(200).json({
            success: true,
            message: visit.hasPatientSummary()
                ? 'Visit summary updated successfully'
                : 'Visit summary created successfully',
            data: {
                visitId: visit._id,
                patientSummary: visit.patientSummary,
            },
        });
    } catch (error: any) {
        logger.error('Error adding/updating visit summary:', error);
        if (error instanceof AppError) {
            res.status(error.statusCode).json({
                success: false,
                message: error.message,
            });
        } else {
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to add/update visit summary',
            });
        }
    }
};

/**
 * Toggle visibility of patient summary
 * PATCH /api/pharmacist/visit-summaries/:visitId/visibility
 */
export const toggleVisibility = async (req: AuthRequest, res: Response) => {
    try {
        const { visitId } = req.params;
        const { visible } = req.body;

        if (!mongoose.Types.ObjectId.isValid(visitId)) {
            throw new AppError('Invalid visit ID', 400);
        }

        const visit = await Visit.findById(visitId);
        if (!visit) {
            throw new AppError('Visit not found', 404);
        }

        // Check workspace access
        if (visit.workplaceId?.toString() !== req.user?.workplaceId?.toString()) {
            throw new AppError('Unauthorized access to this visit', 403);
        }

        if (!visit.hasPatientSummary()) {
            throw new AppError('No patient summary exists for this visit', 400);
        }

        // Toggle visibility
        if (visible) {
            await visit.makeVisibleToPatient();

            // Send notification to patient when making visible
            const patient = await Patient.findById(visit.patientId);
            const patientUserId = (patient as any)?.userId;
            if (patientUserId) {
                const visitDate = (visit as any).appointmentDate || (visit as any).visitDate || new Date();
                await healthRecordsNotificationService.notifyVisitSummaryAvailable(
                    new mongoose.Types.ObjectId(patientUserId.toString()),
                    visit.workplaceId,
                    new mongoose.Types.ObjectId(visit._id.toString()),
                    visitDate
                );
                logger.info('Visit summary notification sent', {
                    patientUserId,
                    visitId: visit._id,
                });
            }
        } else {
            await visit.hideFromPatient();
        } logger.info(
            `Visit summary visibility ${visible ? 'enabled' : 'disabled'} for visit ${visitId}`
        );

        res.status(200).json({
            success: true,
            message: `Visit summary ${visible ? 'made visible' : 'hidden'} to patient`,
            data: {
                visitId: visit._id,
                visibleToPatient: visit.isVisibleToPatient(),
            },
        });
    } catch (error: any) {
        logger.error('Error toggling visit summary visibility:', error);
        if (error instanceof AppError) {
            res.status(error.statusCode).json({
                success: false,
                message: error.message,
            });
        } else {
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to toggle visibility',
            });
        }
    }
};

/**
 * Get visits with pending summaries (no summary or not visible)
 * GET /api/pharmacist/visit-summaries/pending
 */
export const getPendingSummaries = async (req: AuthRequest, res: Response) => {
    try {
        const workplaceId = req.user?.workplaceId;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;

        // Find visits without summaries or with non-visible summaries
        const query = {
            workplaceId,
            $or: [
                { 'patientSummary.summary': { $exists: false } },
                { 'patientSummary.summary': '' },
                { 'patientSummary.visibleToPatient': false },
            ],
            status: 'Completed', // Only completed visits need summaries
        };

        const [visits, total] = await Promise.all([
            Visit.find(query)
                .populate('patientId', 'firstName lastName patientId')
                .populate('createdBy', 'firstName lastName')
                .sort({ date: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Visit.countDocuments(query),
        ]);

        const visitSummaries = visits.map((visit: any) => ({
            visitId: visit._id,
            visitDate: visit.date,
            patient: visit.patientId,
            createdBy: visit.createdBy,
            soap: visit.soap,
            hasSummary: !!(visit.patientSummary && visit.patientSummary.summary),
            isVisible: !!(visit.patientSummary && visit.patientSummary.visibleToPatient),
            summaryStatus:
                !visit.patientSummary || !visit.patientSummary.summary
                    ? 'missing'
                    : !visit.patientSummary.visibleToPatient
                        ? 'draft'
                        : 'visible',
        })); res.status(200).json({
            success: true,
            data: {
                visits: visitSummaries,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(total / limit),
                    totalItems: total,
                    itemsPerPage: limit,
                },
            },
        });
    } catch (error: any) {
        logger.error('Error fetching pending visit summaries:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch pending summaries',
        });
    }
};

/**
 * Get a specific visit summary
 * GET /api/pharmacist/visit-summaries/:visitId
 */
export const getSummary = async (req: AuthRequest, res: Response) => {
    try {
        const { visitId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(visitId)) {
            throw new AppError('Invalid visit ID', 400);
        }

        const visit = await Visit.findById(visitId)
            .populate('patientId', 'firstName lastName patientId')
            .populate('createdBy', 'firstName lastName')
            .populate('patientSummary.summarizedBy', 'firstName lastName');

        if (!visit) {
            throw new AppError('Visit not found', 404);
        }

        // Check workspace access
        if (visit.workplaceId?.toString() !== req.user?.workplaceId?.toString()) {
            throw new AppError('Unauthorized access to this visit', 403);
        }

        res.status(200).json({
            success: true,
            data: {
                visitId: visit._id,
                visitDate: visit.date,
                patient: visit.patientId,
                createdBy: visit.createdBy,
                soap: visit.soap,
                patientSummary: visit.patientSummary,
                hasSummary: visit.hasPatientSummary(),
                isVisible: visit.isVisibleToPatient(),
            },
        });
    } catch (error: any) {
        logger.error('Error fetching visit summary:', error);
        if (error instanceof AppError) {
            res.status(error.statusCode).json({
                success: false,
                message: error.message,
            });
        } else {
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to fetch visit summary',
            });
        }
    }
};

/**
 * Delete a visit summary
 * DELETE /api/pharmacist/visit-summaries/:visitId
 */
export const deleteSummary = async (req: AuthRequest, res: Response) => {
    try {
        const { visitId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(visitId)) {
            throw new AppError('Invalid visit ID', 400);
        }

        const visit = await Visit.findById(visitId);
        if (!visit) {
            throw new AppError('Visit not found', 404);
        }

        // Check workspace access
        if (visit.workplaceId?.toString() !== req.user?.workplaceId?.toString()) {
            throw new AppError('Unauthorized access to this visit', 403);
        }

        if (!visit.hasPatientSummary()) {
            throw new AppError('No patient summary exists for this visit', 400);
        }

        // Remove summary
        visit.patientSummary = undefined;
        await visit.save();

        logger.info(`Visit summary deleted for visit ${visitId}`);

        res.status(200).json({
            success: true,
            message: 'Visit summary deleted successfully',
        });
    } catch (error: any) {
        logger.error('Error deleting visit summary:', error);
        if (error instanceof AppError) {
            res.status(error.statusCode).json({
                success: false,
                message: error.message,
            });
        } else {
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to delete visit summary',
            });
        }
    }
};

/**
 * Bulk toggle visibility for multiple visit summaries
 * PATCH /api/pharmacist/visit-summaries/bulk/visibility
 */
export const bulkToggleVisibility = async (req: AuthRequest, res: Response) => {
    try {
        const { visitIds, visible } = req.body;

        if (!Array.isArray(visitIds) || visitIds.length === 0) {
            throw new AppError('Visit IDs array is required', 400);
        }

        if (visitIds.length > 50) {
            throw new AppError('Maximum 50 visits can be processed at once', 400);
        }

        // Validate all IDs
        const invalidIds = visitIds.filter((id) => !mongoose.Types.ObjectId.isValid(id));
        if (invalidIds.length > 0) {
            throw new AppError(`Invalid visit IDs: ${invalidIds.join(', ')}`, 400);
        }

        const workplaceId = req.user?.workplaceId;

        // Find all visits
        const visits = await Visit.find({
            _id: { $in: visitIds },
            workplaceId,
        });

        if (visits.length === 0) {
            throw new AppError('No visits found', 404);
        }

        // Process each visit
        const results = {
            successful: [] as string[],
            failed: [] as { visitId: string; reason: string }[],
        };

        for (const visit of visits) {
            try {
                if (!visit.hasPatientSummary()) {
                    results.failed.push({
                        visitId: visit._id.toString(),
                        reason: 'No patient summary exists',
                    });
                    continue;
                }

                if (visible) {
                    await visit.makeVisibleToPatient();
                } else {
                    await visit.hideFromPatient();
                }

                results.successful.push(visit._id.toString());
            } catch (err: any) {
                results.failed.push({
                    visitId: visit._id.toString(),
                    reason: err.message,
                });
            }
        }

        logger.info(
            `Bulk visibility toggle: ${results.successful.length} successful, ${results.failed.length} failed`
        );

        res.status(200).json({
            success: true,
            message: `Visibility toggled for ${results.successful.length} visit(s)`,
            data: results,
        });
    } catch (error: any) {
        logger.error('Error bulk toggling visibility:', error);
        if (error instanceof AppError) {
            res.status(error.statusCode).json({
                success: false,
                message: error.message,
            });
        } else {
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to bulk toggle visibility',
            });
        }
    }
};
