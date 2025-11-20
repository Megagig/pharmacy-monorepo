import { Request, Response } from 'express';
import mongoose from 'mongoose';
import logger from '../../../utils/logger';
import adherenceService, { CreateAdherenceTrackingRequest, RefillData } from '../services/adherenceService';
import AdherenceTracking, { IAdherenceIntervention } from '../models/AdherenceTracking';
import { AuthRequest } from '../../../types/auth';

/**
 * Create adherence tracking for a patient
 */
export const createAdherenceTracking = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { workplaceId, _id: userId } = req.user!;
        const trackingData: CreateAdherenceTrackingRequest = req.body;

        // Validate required fields
        if (!trackingData.patientId || !trackingData.medications || trackingData.medications.length === 0) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Missing required fields',
                    details: 'patientId and medications array are required'
                }
            });
            return;
        }

        // Validate ObjectIds
        if (!mongoose.Types.ObjectId.isValid(trackingData.patientId)) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid patient ID'
                }
            });
            return;
        }

        if (trackingData.diagnosticRequestId && !mongoose.Types.ObjectId.isValid(trackingData.diagnosticRequestId)) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid diagnostic request ID'
                }
            });
            return;
        }

        if (trackingData.diagnosticResultId && !mongoose.Types.ObjectId.isValid(trackingData.diagnosticResultId)) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid diagnostic result ID'
                }
            });
            return;
        }

        // Validate medications
        for (const medication of trackingData.medications) {
            if (!medication.medicationName || !medication.dosage || !medication.frequency || !medication.prescribedDate) {
                res.status(400).json({
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid medication data',
                        details: 'Each medication must have medicationName, dosage, frequency, and prescribedDate'
                    }
                });
                return;
            }
        }

        const adherenceTracking = await adherenceService.createAdherenceTracking(
            new mongoose.Types.ObjectId(workplaceId),
            trackingData,
            new mongoose.Types.ObjectId(userId)
        );

        res.status(201).json({
            success: true,
            data: {
                adherenceTracking
            },
            message: 'Adherence tracking created successfully'
        });

    } catch (error) {
        logger.error('Error creating adherence tracking:', error);

        if ((error as Error).message.includes('already exists')) {
            res.status(409).json({
                success: false,
                error: {
                    code: 'CONFLICT',
                    message: (error as Error).message
                }
            });
            return;
        }

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
                message: 'Failed to create adherence tracking',
                details: (error as Error).message
            }
        });
    }
};

/**
 * Get adherence tracking for a patient
 */
export const getPatientAdherenceTracking = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { workplaceId } = req.user!;
        const { patientId } = req.params;

        if (!patientId || !mongoose.Types.ObjectId.isValid(patientId)) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid or missing patient ID'
                }
            });
            return;
        }

        const adherenceTracking = await AdherenceTracking.findByPatient(
            new mongoose.Types.ObjectId(patientId),
            new mongoose.Types.ObjectId(workplaceId)
        );

        if (!adherenceTracking) {
            res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Adherence tracking not found for patient'
                }
            });
            return;
        }

        res.json({
            success: true,
            data: {
                adherenceTracking
            }
        });

    } catch (error) {
        logger.error('Error getting patient adherence tracking:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get adherence tracking',
                details: (error as Error).message
            }
        });
    }
};

/**
 * Add medication refill
 */
export const addRefill = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { workplaceId } = req.user!;
        const { patientId } = req.params;
        const refillData: RefillData = req.body;

        if (!patientId || !mongoose.Types.ObjectId.isValid(patientId)) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid or missing patient ID'
                }
            });
            return;
        }

        // Validate refill data
        if (!refillData.medicationName || !refillData.date || !refillData.daysSupply || !refillData.source) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Missing required refill fields',
                    details: 'medicationName, date, daysSupply, and source are required'
                }
            });
            return;
        }

        if (refillData.daysSupply < 1 || refillData.daysSupply > 365) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid days supply',
                    details: 'Days supply must be between 1 and 365'
                }
            });
            return;
        }

        const validSources = ['pharmacy', 'patient_report', 'system_estimate'];
        if (!validSources.includes(refillData.source)) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid source',
                    details: `Source must be one of: ${validSources.join(', ')}`
                }
            });
            return;
        }

        const adherenceTracking = await adherenceService.addRefill(
            new mongoose.Types.ObjectId(patientId),
            new mongoose.Types.ObjectId(workplaceId),
            refillData
        );

        res.json({
            success: true,
            data: {
                adherenceTracking
            },
            message: 'Refill added successfully'
        });

    } catch (error) {
        logger.error('Error adding refill:', error);

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
                message: 'Failed to add refill',
                details: (error as Error).message
            }
        });
    }
};

/**
 * Update medication adherence
 */
export const updateMedicationAdherence = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { workplaceId } = req.user!;
        const { patientId, medicationName } = req.params;
        const adherenceData = req.body;

        if (!patientId || !mongoose.Types.ObjectId.isValid(patientId)) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid or missing patient ID'
                }
            });
            return;
        }

        if (!medicationName) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Medication name is required'
                }
            });
            return;
        }

        // Validate adherence score if provided
        if (adherenceData.adherenceScore !== undefined) {
            if (typeof adherenceData.adherenceScore !== 'number' ||
                adherenceData.adherenceScore < 0 ||
                adherenceData.adherenceScore > 100) {
                res.status(400).json({
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid adherence score',
                        details: 'Adherence score must be a number between 0 and 100'
                    }
                });
                return;
            }
        }

        const adherenceTracking = await adherenceService.updateMedicationAdherence(
            new mongoose.Types.ObjectId(patientId),
            new mongoose.Types.ObjectId(workplaceId),
            decodeURIComponent(medicationName),
            adherenceData
        );

        res.json({
            success: true,
            data: {
                adherenceTracking
            },
            message: 'Medication adherence updated successfully'
        });

    } catch (error) {
        logger.error('Error updating medication adherence:', error);

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
                message: 'Failed to update medication adherence',
                details: (error as Error).message
            }
        });
    }
};

/**
 * Assess patient adherence
 */
export const assessPatientAdherence = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { workplaceId } = req.user!;
        const { patientId } = req.params;

        if (!patientId || !mongoose.Types.ObjectId.isValid(patientId)) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid or missing patient ID'
                }
            });
            return;
        }

        const assessment = await adherenceService.assessPatientAdherence(
            new mongoose.Types.ObjectId(patientId),
            new mongoose.Types.ObjectId(workplaceId)
        );

        res.json({
            success: true,
            data: {
                assessment
            }
        });

    } catch (error) {
        logger.error('Error assessing patient adherence:', error);

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
                message: 'Failed to assess patient adherence',
                details: (error as Error).message
            }
        });
    }
};

/**
 * Add adherence intervention
 */
export const addIntervention = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { workplaceId, _id: userId } = req.user!;
        const { patientId } = req.params;
        const intervention: Omit<IAdherenceIntervention, 'implementedAt'> = req.body;

        if (!patientId || !mongoose.Types.ObjectId.isValid(patientId)) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid or missing patient ID'
                }
            });
            return;
        }

        // Validate intervention data
        if (!intervention.type || !intervention.description || !intervention.expectedOutcome) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Missing required intervention fields',
                    details: 'type, description, and expectedOutcome are required'
                }
            });
            return;
        }

        const validTypes = ['counseling', 'reminder_system', 'dose_adjustment', 'medication_change', 'follow_up_scheduled'];
        if (!validTypes.includes(intervention.type)) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid intervention type',
                    details: `Type must be one of: ${validTypes.join(', ')}`
                }
            });
            return;
        }

        const adherenceTracking = await adherenceService.addIntervention(
            new mongoose.Types.ObjectId(patientId),
            new mongoose.Types.ObjectId(workplaceId),
            {
                ...intervention,
                implementedBy: new mongoose.Types.ObjectId(userId)
            },
            new mongoose.Types.ObjectId(userId)
        );

        res.json({
            success: true,
            data: {
                adherenceTracking
            },
            message: 'Intervention added successfully'
        });

    } catch (error) {
        logger.error('Error adding intervention:', error);

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
                message: 'Failed to add intervention',
                details: (error as Error).message
            }
        });
    }
};

/**
 * Generate adherence report
 */
export const generateAdherenceReport = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { workplaceId } = req.user!;
        const { patientId } = req.params;
        const { startDate, endDate } = req.query;

        if (!patientId || !mongoose.Types.ObjectId.isValid(patientId)) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid or missing patient ID'
                }
            });
            return;
        }

        if (!startDate || !endDate) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Missing required query parameters',
                    details: 'startDate and endDate are required'
                }
            });
            return;
        }

        const reportPeriod = {
            start: new Date(startDate as string),
            end: new Date(endDate as string)
        };

        // Validate date range
        if (reportPeriod.start >= reportPeriod.end) {
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

        const report = await adherenceService.generateAdherenceReport(
            new mongoose.Types.ObjectId(patientId),
            new mongoose.Types.ObjectId(workplaceId),
            reportPeriod
        );

        res.json({
            success: true,
            data: {
                report
            }
        });

    } catch (error) {
        logger.error('Error generating adherence report:', error);

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
                message: 'Failed to generate adherence report',
                details: (error as Error).message
            }
        });
    }
};

/**
 * Get patients with poor adherence
 */
export const getPatientsWithPoorAdherence = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { workplaceId } = req.user!;
        const { threshold } = req.query;

        let adherenceThreshold = 70; // Default threshold
        if (threshold) {
            adherenceThreshold = parseInt(threshold as string);
            if (isNaN(adherenceThreshold) || adherenceThreshold < 0 || adherenceThreshold > 100) {
                res.status(400).json({
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid threshold',
                        details: 'Threshold must be a number between 0 and 100'
                    }
                });
                return;
            }
        }

        const patients = await adherenceService.getPatientsWithPoorAdherence(
            new mongoose.Types.ObjectId(workplaceId),
            adherenceThreshold
        );

        res.json({
            success: true,
            data: {
                patients,
                count: patients.length,
                threshold: adherenceThreshold
            }
        });

    } catch (error) {
        logger.error('Error getting patients with poor adherence:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get patients with poor adherence',
                details: (error as Error).message
            }
        });
    }
};

/**
 * Acknowledge adherence alert
 */
export const acknowledgeAlert = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { workplaceId, _id: userId } = req.user!;
        const { patientId, alertIndex } = req.params;
        const { actionTaken } = req.body;

        if (!patientId || !mongoose.Types.ObjectId.isValid(patientId)) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid or missing patient ID'
                }
            });
            return;
        }

        if (!alertIndex) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid or missing alert index'
                }
            });
            return;
        }
        const alertIdx = parseInt(alertIndex);
        if (isNaN(alertIdx) || alertIdx < 0) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid alert index'
                }
            });
            return;
        }

        const adherenceTracking = await AdherenceTracking.findByPatient(
            new mongoose.Types.ObjectId(patientId),
            new mongoose.Types.ObjectId(workplaceId)
        );

        if (!adherenceTracking) {
            res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Adherence tracking not found for patient'
                }
            });
            return;
        }

        if (alertIdx >= adherenceTracking.alerts.length) {
            res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Alert not found'
                }
            });
            return;
        }

        adherenceTracking.acknowledgeAlert(
            alertIdx,
            new mongoose.Types.ObjectId(userId),
            actionTaken
        );

        await adherenceTracking.save();

        res.json({
            success: true,
            data: {
                adherenceTracking
            },
            message: 'Alert acknowledged successfully'
        });

    } catch (error) {
        logger.error('Error acknowledging alert:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to acknowledge alert',
                details: (error as Error).message
            }
        });
    }
};

/**
 * Resolve adherence alert
 */
export const resolveAlert = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { workplaceId } = req.user!;
        const { patientId, alertIndex } = req.params;

        if (!patientId || !mongoose.Types.ObjectId.isValid(patientId)) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid or missing patient ID'
                }
            });
            return;
        }

        if (!alertIndex) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid or missing alert index'
                }
            });
            return;
        }
        const alertIdx = parseInt(alertIndex);
        if (isNaN(alertIdx) || alertIdx < 0) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid alert index'
                }
            });
            return;
        }

        const adherenceTracking = await AdherenceTracking.findByPatient(
            new mongoose.Types.ObjectId(patientId),
            new mongoose.Types.ObjectId(workplaceId)
        );

        if (!adherenceTracking) {
            res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Adherence tracking not found for patient'
                }
            });
            return;
        }

        if (alertIdx >= adherenceTracking.alerts.length) {
            res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Alert not found'
                }
            });
            return;
        }

        adherenceTracking.resolveAlert(alertIdx);
        await adherenceTracking.save();

        res.json({
            success: true,
            data: {
                adherenceTracking
            },
            message: 'Alert resolved successfully'
        });

    } catch (error) {
        logger.error('Error resolving alert:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to resolve alert',
                details: (error as Error).message
            }
        });
    }
};