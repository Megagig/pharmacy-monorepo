import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import logger from '../../../utils/logger';
import labIntegrationService, { CreateLabIntegrationRequest } from '../services/labIntegrationService';
import labIntegrationAlertService from '../services/labIntegrationAlertService';
import { AuthRequest } from '../../../types/auth';

/**
 * Create a new lab integration case
 */
export const createLabIntegration = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        logger.info('Creating lab integration case', {
            userId: req.user?._id,
            workplaceId: req.user?.workplaceId,
            hasWorkspaceContext: !!req.workspaceContext,
            workspaceContextWorkplaceId: req.workspaceContext?.workspace?._id,
            requestBody: req.body
        });

        const userId = req.user?._id;
        const workplaceId = req.user?.workplaceId;

        if (!userId || !workplaceId) {
            logger.error('Unauthorized: User or workplace not found', {
                userId,
                workplaceId,
                hasUser: !!req.user
            });
            res.status(401).json({
                success: false,
                message: 'Unauthorized: User or workplace not found'
            });
            return;
        }

        const requestData: CreateLabIntegrationRequest = {
            ...req.body,
            pharmacistId: userId.toString(),
            workplaceId: workplaceId.toString()
        };

        logger.info('Calling labIntegrationService.createLabIntegration', {
            requestData
        });

        const labIntegration = await labIntegrationService.createLabIntegration(requestData);

        logger.info('Lab integration created successfully', {
            labIntegrationId: labIntegration._id
        });

        // Automatically request AI interpretation if lab results are provided
        if (requestData.labResultIds && requestData.labResultIds.length > 0) {
            // Trigger AI interpretation asynchronously
            labIntegrationService.requestAIInterpretation(labIntegration._id.toString())
                .catch(error => {
                    logger.error('Failed to request AI interpretation', {
                        error: error instanceof Error ? error.message : 'Unknown error',
                        labIntegrationId: labIntegration._id
                    });
                });
        }

        res.status(201).json({
            success: true,
            message: 'Lab integration case created successfully',
            data: labIntegration
        });
    } catch (error) {
        logger.error('Failed to create lab integration case', {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            userId: req.user?._id
        });
        next(error);
    }
};

/**
 * Request AI interpretation for a lab integration case
 */
export const requestAIInterpretation = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        const labIntegration = await labIntegrationService.requestAIInterpretation(id);

        res.status(200).json({
            success: true,
            message: 'AI interpretation completed successfully',
            data: labIntegration
        });
    } catch (error) {
        logger.error('Failed to request AI interpretation', {
            error: error instanceof Error ? error.message : 'Unknown error',
            labIntegrationId: req.params.id
        });
        next(error);
    }
};

/**
 * Get lab integration by ID
 */
export const getLabIntegrationById = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        const labIntegration = await labIntegrationService.getLabIntegrationById(id);

        if (!labIntegration) {
            res.status(404).json({
                success: false,
                message: 'Lab integration case not found'
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: labIntegration
        });
    } catch (error) {
        logger.error('Failed to get lab integration', {
            error: error instanceof Error ? error.message : 'Unknown error',
            labIntegrationId: req.params.id
        });
        next(error);
    }
};

/**
 * Get lab integrations for a patient
 */
export const getLabIntegrationsByPatient = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { patientId } = req.params;
        const workplaceId = req.user?.workplaceId;

        if (!workplaceId) {
            res.status(401).json({
                success: false,
                message: 'Unauthorized: Workplace not found'
            });
            return;
        }

        const labIntegrations = await labIntegrationService.getLabIntegrationsByPatient(
            patientId,
            workplaceId.toString()
        );

        res.status(200).json({
            success: true,
            data: labIntegrations
        });
    } catch (error) {
        logger.error('Failed to get lab integrations for patient', {
            error: error instanceof Error ? error.message : 'Unknown error',
            patientId: req.params.patientId
        });
        next(error);
    }
};

/**
 * Get pending reviews for the workplace
 */
export const getPendingReviews = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const workplaceId = req.user?.workplaceId;

        if (!workplaceId) {
            res.status(401).json({
                success: false,
                message: 'Unauthorized: Workplace not found'
            });
            return;
        }

        const labIntegrations = await labIntegrationService.getPendingReviews(workplaceId.toString());

        res.status(200).json({
            success: true,
            data: labIntegrations
        });
    } catch (error) {
        logger.error('Failed to get pending reviews', {
            error: error instanceof Error ? error.message : 'Unknown error',
            workplaceId: req.user?.workplaceId
        });
        next(error);
    }
};

/**
 * Get critical cases for the workplace
 */
export const getCriticalCases = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const workplaceId = req.user?.workplaceId;

        if (!workplaceId) {
            res.status(401).json({
                success: false,
                message: 'Unauthorized: Workplace not found'
            });
            return;
        }

        const labIntegrations = await labIntegrationService.getCriticalCases(workplaceId.toString());

        res.status(200).json({
            success: true,
            data: labIntegrations
        });
    } catch (error) {
        logger.error('Failed to get critical cases', {
            error: error instanceof Error ? error.message : 'Unknown error',
            workplaceId: req.user?.workplaceId
        });
        next(error);
    }
};

/**
 * Get cases requiring physician escalation
 */
export const getCasesRequiringEscalation = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const workplaceId = req.user?.workplaceId;

        if (!workplaceId) {
            res.status(401).json({
                success: false,
                message: 'Unauthorized: Workplace not found'
            });
            return;
        }

        const labIntegrations = await labIntegrationService.getCasesRequiringEscalation(workplaceId.toString());

        res.status(200).json({
            success: true,
            data: labIntegrations
        });
    } catch (error) {
        logger.error('Failed to get cases requiring escalation', {
            error: error instanceof Error ? error.message : 'Unknown error',
            workplaceId: req.user?.workplaceId
        });
        next(error);
    }
};

/**
 * Get approved cases
 */
export const getApprovedCases = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const workplaceId = req.user?.workplaceId;

        if (!workplaceId) {
            res.status(401).json({
                success: false,
                message: 'Unauthorized: Workplace not found'
            });
            return;
        }

        const labIntegrations = await labIntegrationService.getApprovedCases(workplaceId.toString());

        res.status(200).json({
            success: true,
            data: labIntegrations
        });
    } catch (error) {
        logger.error('Failed to get approved cases', {
            error: error instanceof Error ? error.message : 'Unknown error',
            workplaceId: req.user?.workplaceId
        });
        next(error);
    }
};

/**
 * Approve therapy recommendations
 */
export const approveRecommendations = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?._id;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Unauthorized: User not found'
            });
            return;
        }

        const labIntegration = await labIntegrationService.approveRecommendations(
            id,
            userId.toString(),
            req.body
        );

        res.status(200).json({
            success: true,
            message: 'Therapy recommendations reviewed successfully',
            data: labIntegration
        });
    } catch (error) {
        logger.error('Failed to approve recommendations', {
            error: error instanceof Error ? error.message : 'Unknown error',
            labIntegrationId: req.params.id,
            userId: req.user?._id?.toString()
        });
        next(error);
    }
};

/**
 * Implement medication adjustments
 */
export const implementAdjustments = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?._id;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Unauthorized: User not found'
            });
            return;
        }

        const labIntegration = await labIntegrationService.implementAdjustments(
            id,
            userId.toString(),
            req.body.adjustments
        );

        res.status(200).json({
            success: true,
            message: 'Medication adjustments implemented successfully',
            data: labIntegration
        });
    } catch (error) {
        logger.error('Failed to implement adjustments', {
            error: error instanceof Error ? error.message : 'Unknown error',
            labIntegrationId: req.params.id,
            userId: req.user?._id?.toString()
        });
        next(error);
    }
};

/**
 * Get lab value trends for a patient
 */
export const getLabTrends = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { patientId, testCode } = req.params;
        const { daysBack } = req.query;
        const workplaceId = req.user?.workplaceId;

        if (!workplaceId) {
            res.status(401).json({
                success: false,
                message: 'Unauthorized: Workplace not found'
            });
            return;
        }

        const trends = await labIntegrationService.getLabTrends(
            patientId,
            workplaceId.toString(),
            testCode,
            daysBack ? parseInt(daysBack as string) : 180
        );

        res.status(200).json({
            success: true,
            data: trends
        });
    } catch (error) {
        logger.error('Failed to get lab trends', {
            error: error instanceof Error ? error.message : 'Unknown error',
            patientId: req.params.patientId,
            testCode: req.params.testCode
        });
        next(error);
    }
};

/**
 * Escalate case to physician
 */
export const escalateToPhysician = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { reason, physicianId, physicianEmail, physicianPhone, urgency } = req.body;
        const userId = req.user?._id;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Unauthorized: User not found'
            });
            return;
        }

        if (!reason) {
            res.status(400).json({
                success: false,
                message: 'Escalation reason is required'
            });
            return;
        }

        await labIntegrationAlertService.escalateToPhysician({
            labIntegrationId: id,
            reason,
            physicianId,
            physicianEmail,
            physicianPhone,
            urgency: urgency || 'urgent',
            requestedBy: userId.toString()
        });

        res.status(200).json({
            success: true,
            message: 'Case escalated to physician successfully'
        });
    } catch (error) {
        logger.error('Failed to escalate to physician', {
            error: error instanceof Error ? error.message : 'Unknown error',
            labIntegrationId: req.params.id
        });
        next(error);
    }
};

/**
 * Update patient interpretation
 */
export const updatePatientInterpretation = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?._id;
        const { explanation, keyFindings, recommendations, visibleToPatient } = req.body;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Unauthorized: User not found'
            });
            return;
        }

        const updatedCase = await labIntegrationService.updatePatientInterpretation(
            id,
            userId.toString(),
            {
                explanation,
                keyFindings,
                recommendations,
                visibleToPatient
            }
        );

        res.status(200).json({
            success: true,
            message: 'Patient interpretation updated successfully',
            data: updatedCase
        });
    } catch (error) {
        logger.error('Failed to update patient interpretation', {
            error: error instanceof Error ? error.message : 'Unknown error',
            labIntegrationId: req.params.id
        });
        next(error);
    }
};

/**
 * Get patient interpretation for a case
 */
export const getPatientInterpretation = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        const labIntegration = await labIntegrationService.getLabIntegrationById(id);

        if (!labIntegration) {
            res.status(404).json({
                success: false,
                message: 'Lab integration case not found'
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: {
                patientInterpretation: labIntegration.patientInterpretation,
                hasInterpretation: !!labIntegration.patientInterpretation?.explanation,
                isVisibleToPatient: labIntegration.patientInterpretation?.visibleToPatient || false,
                lastModified: labIntegration.patientInterpretation?.lastModified,
                generatedBy: labIntegration.patientInterpretation?.generatedBy
            }
        });
    } catch (error) {
        logger.error('Failed to get patient interpretation', {
            error: error instanceof Error ? error.message : 'Unknown error',
            labIntegrationId: req.params.id
        });
        next(error);
    }
};

