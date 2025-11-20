import { Request, Response } from 'express';
import mongoose from 'mongoose';
import logger from '../../../utils/logger';
import diagnosticFollowUpService, { CreateFollowUpRequest } from '../services/diagnosticFollowUpService';
import DiagnosticFollowUp, { IDiagnosticFollowUp, IFollowUpOutcome } from '../models/DiagnosticFollowUp';
import { AuthRequest } from '../../../types/auth';

/**
 * Create a new diagnostic follow-up
 */
export const createFollowUp = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { workplaceId, _id: userId } = req.user!;
        const followUpData: CreateFollowUpRequest = req.body;

        // Validate required fields
        if (!followUpData.diagnosticRequestId || !followUpData.diagnosticResultId ||
            !followUpData.patientId || !followUpData.type || !followUpData.description ||
            !followUpData.scheduledDate || !followUpData.assignedTo) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Missing required fields',
                    details: 'diagnosticRequestId, diagnosticResultId, patientId, type, description, scheduledDate, and assignedTo are required'
                }
            });
            return;
        }

        // Validate ObjectIds
        const objectIdFields = ['diagnosticRequestId', 'diagnosticResultId', 'patientId', 'assignedTo'];
        for (const field of objectIdFields) {
            if (!mongoose.Types.ObjectId.isValid(followUpData[field as keyof CreateFollowUpRequest] as string)) {
                res.status(400).json({
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: `Invalid ${field}`,
                        details: `${field} must be a valid ObjectId`
                    }
                });
                return;
            }
        }

        // Validate scheduled date is not in the past (allow 1 hour grace period)
        const scheduledDate = new Date(followUpData.scheduledDate);
        const minDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
        if (scheduledDate < minDate) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid scheduled date',
                    details: 'Scheduled date cannot be more than 1 hour in the past'
                }
            });
            return;
        }

        const followUp = await diagnosticFollowUpService.createFollowUp(
            new mongoose.Types.ObjectId(workplaceId),
            followUpData,
            new mongoose.Types.ObjectId(userId)
        );

        res.status(201).json({
            success: true,
            data: {
                followUp
            },
            message: 'Follow-up created successfully'
        });

    } catch (error) {
        logger.error('Error creating follow-up:', error);

        if ((error as Error).message.includes('not found')) {
            res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: (error as Error).message
                }
            });
            return;
        }

        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to create follow-up',
                details: (error as Error).message
            }
        });
    }
};

/**
 * Get follow-ups for a patient
 */
export const getPatientFollowUps = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { workplaceId } = req.user!;
        const { patientId } = req.params;
        const { status, type, limit, skip } = req.query;

        if (!patientId || !mongoose.Types.ObjectId.isValid(patientId)) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid patient ID'
                }
            });
            return;
        }

        const options = {
            status: status as string,
            type: type as string,
            limit: limit ? parseInt(limit as string) : undefined,
            skip: skip ? parseInt(skip as string) : undefined
        };

        const followUps = await diagnosticFollowUpService.getPatientFollowUps(
            new mongoose.Types.ObjectId(patientId),
            new mongoose.Types.ObjectId(workplaceId),
            options
        );

        res.json({
            success: true,
            data: {
                followUps,
                count: followUps.length
            }
        });

    } catch (error) {
        logger.error('Error getting patient follow-ups:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get patient follow-ups',
                details: (error as Error).message
            }
        });
    }
};

/**
 * Get follow-up by ID
 */
export const getFollowUpById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { workplaceId } = req.user!;
        const { followUpId } = req.params;

        if (!followUpId || !mongoose.Types.ObjectId.isValid(followUpId)) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid follow-up ID'
                }
            });
            return;
        }

        const followUp = await DiagnosticFollowUp.findById(followUpId)
            .setOptions({ workplaceId: new mongoose.Types.ObjectId(workplaceId) })
            .populate('assignedTo', 'firstName lastName email')
            .populate('patientId', 'firstName lastName mrn')
            .populate('diagnosticRequestId', 'inputSnapshot status priority')
            .populate('diagnosticResultId', 'diagnoses riskAssessment medicationSuggestions')
            .exec();

        if (!followUp) {
            res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Follow-up not found'
                }
            });
            return;
        }

        res.json({
            success: true,
            data: {
                followUp
            }
        });

    } catch (error) {
        logger.error('Error getting follow-up by ID:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get follow-up',
                details: (error as Error).message
            }
        });
    }
};

/**
 * Complete a follow-up
 */
export const completeFollowUp = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { _id: userId } = req.user!;
        const { followUpId } = req.params;
        const outcome: IFollowUpOutcome = req.body;

        if (!followUpId || !mongoose.Types.ObjectId.isValid(followUpId)) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid follow-up ID'
                }
            });
            return;
        }

        // Validate outcome data
        if (!outcome.status || !outcome.notes) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Missing required outcome fields',
                    details: 'status and notes are required'
                }
            });
            return;
        }

        const followUp = await diagnosticFollowUpService.completeFollowUp(
            new mongoose.Types.ObjectId(followUpId),
            outcome,
            new mongoose.Types.ObjectId(userId)
        );

        res.json({
            success: true,
            data: {
                followUp
            },
            message: 'Follow-up completed successfully'
        });

    } catch (error) {
        logger.error('Error completing follow-up:', error);

        if ((error as Error).message.includes('not found')) {
            res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: (error as Error).message
                }
            });
            return;
        }

        if ((error as Error).message.includes('cannot be completed')) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_STATUS',
                    message: (error as Error).message
                }
            });
            return;
        }

        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to complete follow-up',
                details: (error as Error).message
            }
        });
    }
};

/**
 * Reschedule a follow-up
 */
export const rescheduleFollowUp = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { _id: userId } = req.user!;
        const { followUpId } = req.params;
        const { newDate, reason } = req.body;

        if (!followUpId || !mongoose.Types.ObjectId.isValid(followUpId)) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid follow-up ID'
                }
            });
            return;
        }

        if (!newDate || !reason) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Missing required fields',
                    details: 'newDate and reason are required'
                }
            });
            return;
        }

        // Validate new date is not in the past
        const scheduledDate = new Date(newDate);
        const minDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
        if (scheduledDate < minDate) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid new date',
                    details: 'New date cannot be more than 1 hour in the past'
                }
            });
            return;
        }

        const followUp = await diagnosticFollowUpService.rescheduleFollowUp(
            new mongoose.Types.ObjectId(followUpId),
            scheduledDate,
            reason,
            new mongoose.Types.ObjectId(userId)
        );

        res.json({
            success: true,
            data: {
                followUp
            },
            message: 'Follow-up rescheduled successfully'
        });

    } catch (error) {
        logger.error('Error rescheduling follow-up:', error);

        if ((error as Error).message.includes('not found')) {
            res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: (error as Error).message
                }
            });
            return;
        }

        if ((error as Error).message.includes('cannot be rescheduled')) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_STATUS',
                    message: (error as Error).message
                }
            });
            return;
        }

        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to reschedule follow-up',
                details: (error as Error).message
            }
        });
    }
};

/**
 * Get overdue follow-ups
 */
export const getOverdueFollowUps = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { workplaceId } = req.user!;

        const overdueFollowUps = await diagnosticFollowUpService.getOverdueFollowUps(
            new mongoose.Types.ObjectId(workplaceId)
        );

        res.json({
            success: true,
            data: {
                followUps: overdueFollowUps,
                count: overdueFollowUps.length
            }
        });

    } catch (error) {
        logger.error('Error getting overdue follow-ups:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get overdue follow-ups',
                details: (error as Error).message
            }
        });
    }
};

/**
 * Get follow-up analytics
 */
export const getFollowUpAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { workplaceId } = req.user!;
        const { startDate, endDate } = req.query;

        let dateRange: { start: Date; end: Date } | undefined;
        if (startDate && endDate) {
            dateRange = {
                start: new Date(startDate as string),
                end: new Date(endDate as string)
            };

            // Validate date range
            if (dateRange.start >= dateRange.end) {
                res.status(400).json({
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid date range',
                        details: 'Start date must be before end date'
                    }
                });
                return;
            }
        }

        const analytics = await diagnosticFollowUpService.getFollowUpAnalytics(
            new mongoose.Types.ObjectId(workplaceId),
            dateRange
        );

        res.json({
            success: true,
            data: {
                analytics
            }
        });

    } catch (error) {
        logger.error('Error getting follow-up analytics:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get follow-up analytics',
                details: (error as Error).message
            }
        });
    }
};

/**
 * Get follow-ups assigned to current user
 */
export const getMyFollowUps = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { workplaceId, _id: userId } = req.user!;
        const { status, limit, skip } = req.query;

        const options = {
            status: status as string,
            limit: limit ? parseInt(limit as string) : undefined,
            skip: skip ? parseInt(skip as string) : undefined
        };

        const query = DiagnosticFollowUp.findByAssignee(
            new mongoose.Types.ObjectId(userId),
            new mongoose.Types.ObjectId(workplaceId),
            options.status
        );

        if (options.limit) {
            query.limit(options.limit);
        }
        if (options.skip) {
            query.skip(options.skip);
        }

        const followUps = await query
            .populate('patientId', 'firstName lastName mrn')
            .populate('diagnosticResultId', 'diagnoses riskAssessment')
            .exec();

        res.json({
            success: true,
            data: {
                followUps,
                count: followUps.length
            }
        });

    } catch (error) {
        logger.error('Error getting my follow-ups:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get follow-ups',
                details: (error as Error).message
            }
        });
    }
};

/**
 * Update follow-up status
 */
export const updateFollowUpStatus = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { workplaceId, _id: userId } = req.user!;
        const { followUpId } = req.params;
        const { status } = req.body;

        if (!followUpId || !mongoose.Types.ObjectId.isValid(followUpId)) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid follow-up ID'
                }
            });
            return;
        }

        const validStatuses = ['scheduled', 'in_progress', 'completed', 'missed', 'rescheduled', 'cancelled'];
        if (!validStatuses.includes(status)) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid status',
                    details: `Status must be one of: ${validStatuses.join(', ')}`
                }
            });
            return;
        }

        const followUp = await DiagnosticFollowUp.findById(followUpId)
            .setOptions({ workplaceId: new mongoose.Types.ObjectId(workplaceId) });

        if (!followUp) {
            res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Follow-up not found'
                }
            });
            return;
        }

        followUp.status = status;
        followUp.updatedBy = new mongoose.Types.ObjectId(userId);

        if (status === 'completed' && !followUp.completedAt) {
            followUp.completedAt = new Date();
        }

        await followUp.save();

        res.json({
            success: true,
            data: {
                followUp
            },
            message: 'Follow-up status updated successfully'
        });

    } catch (error) {
        logger.error('Error updating follow-up status:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to update follow-up status',
                details: (error as Error).message
            }
        });
    }
};