import { Request, Response } from 'express';
import mongoose from 'mongoose';
import DiagnosticIntegrationService, { DiagnosticIntegrationData } from '../services/integrationService';
import logger from '../../../utils/logger';
import { AuthRequest } from '../../../types/auth';

export interface AuthenticatedRequest extends Request {
    user?: {
        _id: string;
        workplaceId: string;
        locationId?: string;
        role: string;
    };
}

/**
 * Create clinical note from diagnostic results
 */
export const createClinicalNoteFromDiagnostic = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { diagnosticRequestId, diagnosticResultId, patientId } = req.body;
        const { noteData } = req.body;

        // Validate required fields
        if (!diagnosticRequestId || !patientId) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'MISSING_REQUIRED_FIELDS',
                    message: 'diagnosticRequestId and patientId are required',
                },
            });
            return;
        }

        // Validate ObjectIds
        if (!mongoose.Types.ObjectId.isValid(diagnosticRequestId) || !mongoose.Types.ObjectId.isValid(patientId)) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_OBJECT_ID',
                    message: 'Invalid ObjectId format',
                },
            });
            return;
        }

        if (diagnosticResultId && !mongoose.Types.ObjectId.isValid(diagnosticResultId)) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_OBJECT_ID',
                    message: 'Invalid diagnosticResultId format',
                },
            });
            return;
        }

        const integrationData: DiagnosticIntegrationData = {
            diagnosticRequestId: new mongoose.Types.ObjectId(diagnosticRequestId),
            diagnosticResultId: diagnosticResultId ? new mongoose.Types.ObjectId(diagnosticResultId) : undefined,
            patientId: new mongoose.Types.ObjectId(patientId),
            pharmacistId: new mongoose.Types.ObjectId(req.user!._id),
            workplaceId: new mongoose.Types.ObjectId(req.user!.workplaceId),
            locationId: req.user!.locationId,
        };

        const clinicalNote = await DiagnosticIntegrationService.createClinicalNoteFromDiagnostic(
            integrationData,
            noteData
        );

        res.status(201).json({
            success: true,
            data: {
                clinicalNote,
                message: 'Clinical note created successfully from diagnostic results',
            },
        });

    } catch (error) {
        logger.error('Error creating clinical note from diagnostic', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: req.user?._id,
            body: req.body,
        });

        res.status(500).json({
            success: false,
            error: {
                code: 'CLINICAL_NOTE_CREATION_FAILED',
                message: error instanceof Error ? error.message : 'Failed to create clinical note',
            },
        });
    }
};

/**
 * Add diagnostic data to existing MTR
 */
export const addDiagnosticDataToMTR = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { mtrId } = req.params;
        const { diagnosticRequestId, diagnosticResultId, patientId } = req.body;

        // Validate required fields
        if (!mtrId || !diagnosticRequestId || !patientId) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'MISSING_REQUIRED_FIELDS',
                    message: 'mtrId, diagnosticRequestId, and patientId are required',
                },
            });
            return;
        }

        // Validate ObjectIds
        if (!mongoose.Types.ObjectId.isValid(mtrId) || !mongoose.Types.ObjectId.isValid(diagnosticRequestId) || !mongoose.Types.ObjectId.isValid(patientId)) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_OBJECT_ID',
                    message: 'Invalid ObjectId format',
                },
            });
            return;
        }

        if (diagnosticResultId && !mongoose.Types.ObjectId.isValid(diagnosticResultId)) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_OBJECT_ID',
                    message: 'Invalid diagnosticResultId format',
                },
            });
            return;
        }

        const integrationData: DiagnosticIntegrationData = {
            diagnosticRequestId: new mongoose.Types.ObjectId(diagnosticRequestId),
            diagnosticResultId: diagnosticResultId ? new mongoose.Types.ObjectId(diagnosticResultId) : undefined,
            patientId: new mongoose.Types.ObjectId(patientId),
            pharmacistId: new mongoose.Types.ObjectId(req.user!._id),
            workplaceId: new mongoose.Types.ObjectId(req.user!.workplaceId),
            locationId: req.user!.locationId,
        };

        const mtr = await DiagnosticIntegrationService.addDiagnosticDataToMTR(
            new mongoose.Types.ObjectId(mtrId),
            integrationData
        );

        res.status(200).json({
            success: true,
            data: {
                mtr,
                message: 'MTR enriched successfully with diagnostic data',
            },
        });

    } catch (error) {
        logger.error('Error adding diagnostic data to MTR', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: req.user?._id,
            mtrId: req.params.mtrId,
            body: req.body,
        });

        res.status(500).json({
            success: false,
            error: {
                code: 'MTR_ENRICHMENT_FAILED',
                message: error instanceof Error ? error.message : 'Failed to add diagnostic data to MTR',
            },
        });
    }
};

/**
 * Create new MTR from diagnostic results
 */
export const createMTRFromDiagnostic = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { diagnosticRequestId, diagnosticResultId, patientId } = req.body;
        const { mtrData } = req.body;

        // Validate required fields
        if (!diagnosticRequestId || !patientId) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'MISSING_REQUIRED_FIELDS',
                    message: 'diagnosticRequestId and patientId are required',
                },
            });
            return;
        }

        // Validate ObjectIds
        if (!mongoose.Types.ObjectId.isValid(diagnosticRequestId) || !mongoose.Types.ObjectId.isValid(patientId)) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_OBJECT_ID',
                    message: 'Invalid ObjectId format',
                },
            });
            return;
        }

        if (diagnosticResultId && !mongoose.Types.ObjectId.isValid(diagnosticResultId)) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_OBJECT_ID',
                    message: 'Invalid diagnosticResultId format',
                },
            });
            return;
        }

        const integrationData: DiagnosticIntegrationData = {
            diagnosticRequestId: new mongoose.Types.ObjectId(diagnosticRequestId),
            diagnosticResultId: diagnosticResultId ? new mongoose.Types.ObjectId(diagnosticResultId) : undefined,
            patientId: new mongoose.Types.ObjectId(patientId),
            pharmacistId: new mongoose.Types.ObjectId(req.user!._id),
            workplaceId: new mongoose.Types.ObjectId(req.user!.workplaceId),
            locationId: req.user!.locationId,
        };

        const mtr = await DiagnosticIntegrationService.createMTRFromDiagnostic(
            integrationData,
            mtrData
        );

        res.status(201).json({
            success: true,
            data: {
                mtr,
                message: 'MTR created successfully from diagnostic results',
            },
        });

    } catch (error) {
        logger.error('Error creating MTR from diagnostic', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: req.user?._id,
            body: req.body,
        });

        res.status(500).json({
            success: false,
            error: {
                code: 'MTR_CREATION_FAILED',
                message: error instanceof Error ? error.message : 'Failed to create MTR from diagnostic',
            },
        });
    }
};

/**
 * Get unified patient timeline with diagnostic events
 */
export const getUnifiedPatientTimeline = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { patientId } = req.params;
        const { startDate, endDate, limit } = req.query;

        // Validate required fields
        if (!patientId) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'MISSING_REQUIRED_FIELDS',
                    message: 'patientId is required',
                },
            });
            return;
        }

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(patientId)) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_OBJECT_ID',
                    message: 'Invalid patientId format',
                },
            });
            return;
        }

        const options: {
            startDate?: Date;
            endDate?: Date;
            limit?: number;
        } = {};

        if (startDate) {
            options.startDate = new Date(startDate as string);
        }
        if (endDate) {
            options.endDate = new Date(endDate as string);
        }
        if (limit) {
            options.limit = parseInt(limit as string, 10);
        }

        const timeline = await DiagnosticIntegrationService.getUnifiedPatientTimeline(
            new mongoose.Types.ObjectId(patientId),
            new mongoose.Types.ObjectId(req.user!.workplaceId),
            options
        );

        res.status(200).json({
            success: true,
            data: {
                timeline,
                count: timeline.length,
            },
        });

    } catch (error) {
        logger.error('Error getting unified patient timeline', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: req.user?._id,
            patientId: req.params.patientId,
            query: req.query,
        });

        res.status(500).json({
            success: false,
            error: {
                code: 'TIMELINE_RETRIEVAL_FAILED',
                message: error instanceof Error ? error.message : 'Failed to retrieve patient timeline',
            },
        });
    }
};

/**
 * Cross-reference diagnostic data with existing clinical records
 */
export const crossReferenceWithExistingRecords = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { diagnosticRequestId } = req.params;

        // Validate required fields
        if (!diagnosticRequestId) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'MISSING_REQUIRED_FIELDS',
                    message: 'diagnosticRequestId is required',
                },
            });
            return;
        }

        // Validate ObjectId
        if (!diagnosticRequestId || !mongoose.Types.ObjectId.isValid(diagnosticRequestId)) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_OBJECT_ID',
                    message: 'Invalid diagnosticRequestId format',
                },
            });
            return;
        }

        const crossReference = await DiagnosticIntegrationService.crossReferenceWithExistingRecords(
            new mongoose.Types.ObjectId(diagnosticRequestId)
        );

        res.status(200).json({
            success: true,
            data: crossReference,
        });

    } catch (error) {
        logger.error('Error cross-referencing diagnostic data', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: req.user?._id,
            diagnosticRequestId: req.params.diagnosticRequestId,
        });

        res.status(500).json({
            success: false,
            error: {
                code: 'CROSS_REFERENCE_FAILED',
                message: error instanceof Error ? error.message : 'Failed to cross-reference diagnostic data',
            },
        });
    }
};

/**
 * Get integration options for a diagnostic result
 */
export const getIntegrationOptions = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { diagnosticRequestId } = req.params;

        // Validate ObjectId
        if (!diagnosticRequestId || !mongoose.Types.ObjectId.isValid(diagnosticRequestId)) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_OBJECT_ID',
                    message: 'Invalid diagnosticRequestId format',
                },
            });
            return;
        }

        // Get cross-reference data to suggest integration options
        const crossReference = await DiagnosticIntegrationService.crossReferenceWithExistingRecords(
            new mongoose.Types.ObjectId(diagnosticRequestId)
        );

        const integrationOptions = {
            canCreateClinicalNote: true,
            canCreateMTR: true,
            existingMTRs: crossReference.relatedMTRs.map(mtr => ({
                id: mtr._id,
                reviewNumber: mtr.reviewNumber,
                status: mtr.status,
                priority: mtr.priority,
                canEnrich: mtr.status === 'in_progress',
            })),
            correlations: crossReference.correlations,
            recommendations: [
                ...(crossReference.correlations.some(c => c.type === 'medication_match')
                    ? ['Consider enriching existing MTR with diagnostic findings']
                    : []),
                ...(crossReference.correlations.some(c => c.type === 'symptom_match')
                    ? ['Review previous clinical notes for symptom progression']
                    : []),
                'Create comprehensive clinical note documenting diagnostic assessment',
                ...(crossReference.relatedMTRs.length === 0
                    ? ['Consider initiating MTR based on diagnostic findings']
                    : []),
            ],
        };

        res.status(200).json({
            success: true,
            data: integrationOptions,
        });

    } catch (error) {
        logger.error('Error getting integration options', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: req.user?._id,
            diagnosticRequestId: req.params.diagnosticRequestId,
        });

        res.status(500).json({
            success: false,
            error: {
                code: 'INTEGRATION_OPTIONS_FAILED',
                message: error instanceof Error ? error.message : 'Failed to get integration options',
            },
        });
    }
};