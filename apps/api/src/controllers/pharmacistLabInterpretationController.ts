import { Response } from 'express';
import mongoose from 'mongoose';
import DiagnosticCase, { IDiagnosticCase } from '../models/DiagnosticCase';
import AppError from '../utils/AppError';
import logger from '../utils/logger';
import healthRecordsNotificationService from '../services/healthRecordsNotificationService';
import { AuthRequest } from '../types/auth';

/**
 * Pharmacist Lab Interpretation Controller
 * Handles pharmacist actions for adding patient-friendly interpretations to lab results
 */
export class PharmacistLabInterpretationController {
    /**
     * @route POST /api/pharmacist/lab-results/:id/interpretation
     * @desc Add or update patient interpretation for lab results
     * @access Private (Pharmacist)
     */
    static async addOrUpdateInterpretation(req: AuthRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const { summary, keyFindings, whatThisMeans, recommendations, whenToSeekCare, visibleToPatient } = req.body;
            const userId = req.user?._id;
            const workplaceId = req.user?.workplaceId;

            // Validate diagnostic case ID
            if (!mongoose.Types.ObjectId.isValid(id)) {
                res.status(400).json({
                    success: false,
                    message: 'Invalid diagnostic case ID format',
                });
                return;
            }

            // Find diagnostic case
            const diagnosticCase = await DiagnosticCase.findOne({
                _id: new mongoose.Types.ObjectId(id),
                workplaceId: new mongoose.Types.ObjectId(workplaceId),
            }).populate('patientId', 'firstName lastName mrn')
                .populate('pharmacistId', 'firstName lastName');

            if (!diagnosticCase) {
                res.status(404).json({
                    success: false,
                    message: 'Lab result not found or you do not have access to it',
                });
                return;
            }

            // Check if diagnostic case has lab results
            if (!diagnosticCase.labResults || diagnosticCase.labResults.length === 0) {
                res.status(400).json({
                    success: false,
                    message: 'This diagnostic case does not have lab results',
                });
                return;
            }

            // Prepare interpretation data
            const interpretationData = {
                summary,
                keyFindings: keyFindings || [],
                whatThisMeans,
                recommendations: recommendations || [],
                whenToSeekCare,
                visibleToPatient: visibleToPatient || false,
            };

            // Add or update interpretation
            if (diagnosticCase.hasPatientInterpretation()) {
                diagnosticCase.updatePatientInterpretation(interpretationData, userId);
                logger.info('Patient interpretation updated', {
                    diagnosticCaseId: id,
                    updatedBy: userId,
                    workplaceId,
                });
            } else {
                diagnosticCase.addPatientInterpretation(interpretationData, userId);
                logger.info('Patient interpretation added', {
                    diagnosticCaseId: id,
                    addedBy: userId,
                    workplaceId,
                });
            }

            await diagnosticCase.save();

            // Send notification to patient if interpretation is visible
            if (visibleToPatient) {
                const patient = diagnosticCase.patientId as any;
                const patientUserId = patient?.userId;

                if (patientUserId && workplaceId) {
                    const testName = diagnosticCase.labResults && diagnosticCase.labResults.length > 0
                        ? diagnosticCase.labResults.map((r: any) => r.testName).join(', ')
                        : 'Lab Test';

                    // Convert workplaceId to ObjectId if it's a string
                    const workplaceObjectId = typeof workplaceId === 'string'
                        ? new mongoose.Types.ObjectId(workplaceId)
                        : workplaceId;

                    await healthRecordsNotificationService.notifyLabInterpretationAdded(
                        patientUserId,
                        workplaceObjectId,
                        diagnosticCase._id,
                        testName
                    );
                    logger.info('Lab interpretation notification sent', {
                        patientUserId,
                        diagnosticCaseId: diagnosticCase._id,
                    });
                }
            }

            res.status(200).json({
                success: true,
                message: 'Patient interpretation saved successfully',
                data: {
                    diagnosticCaseId: diagnosticCase._id,
                    patientInterpretation: diagnosticCase.patientInterpretation,
                    visibleToPatient: diagnosticCase.isVisibleToPatient(),
                },
            });
        } catch (error) {
            logger.error('Error adding/updating patient interpretation:', {
                error: error.message,
                stack: error.stack,
                userId: req.user?._id,
                diagnosticCaseId: req.params.id,
            });

            if (error instanceof AppError) {
                res.status(error.statusCode).json({
                    success: false,
                    message: error.message,
                });
                return;
            }

            res.status(500).json({
                success: false,
                message: 'Failed to save patient interpretation. Please try again.',
            });
        }
    }

    /**
     * @route PUT /api/pharmacist/lab-results/:id/visibility
     * @desc Toggle patient visibility for lab result interpretation
     * @access Private (Pharmacist)
     */
    static async toggleVisibility(req: AuthRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const { visibleToPatient } = req.body;
            const userId = req.user?._id;
            const workplaceId = req.user?.workplaceId;

            // Validate diagnostic case ID
            if (!mongoose.Types.ObjectId.isValid(id)) {
                res.status(400).json({
                    success: false,
                    message: 'Invalid diagnostic case ID format',
                });
                return;
            }

            // Find diagnostic case
            const diagnosticCase = await DiagnosticCase.findOne({
                _id: new mongoose.Types.ObjectId(id),
                workplaceId: new mongoose.Types.ObjectId(workplaceId),
            });

            if (!diagnosticCase) {
                res.status(404).json({
                    success: false,
                    message: 'Lab result not found or you do not have access to it',
                });
                return;
            }

            // Check if interpretation exists
            if (!diagnosticCase.hasPatientInterpretation()) {
                res.status(400).json({
                    success: false,
                    message: 'No patient interpretation exists. Please add an interpretation first.',
                });
                return;
            }

            // Update visibility
            if (visibleToPatient) {
                diagnosticCase.makeVisibleToPatient(userId);
            } else {
                diagnosticCase.hideFromPatient(userId);
            }

            await diagnosticCase.save();

            logger.info('Patient interpretation visibility toggled', {
                diagnosticCaseId: id,
                visibleToPatient,
                modifiedBy: userId,
                workplaceId,
            });

            res.status(200).json({
                success: true,
                message: `Lab result ${visibleToPatient ? 'made visible to' : 'hidden from'} patient successfully`,
                data: {
                    diagnosticCaseId: diagnosticCase._id,
                    visibleToPatient: diagnosticCase.isVisibleToPatient(),
                },
            });
        } catch (error) {
            logger.error('Error toggling visibility:', {
                error: error.message,
                stack: error.stack,
                userId: req.user?._id,
                diagnosticCaseId: req.params.id,
            });

            res.status(500).json({
                success: false,
                message: 'Failed to update visibility. Please try again.',
            });
        }
    }

    /**
     * @route GET /api/pharmacist/lab-results/pending-interpretation
     * @desc Get lab results that need patient interpretation
     * @access Private (Pharmacist)
     */
    static async getPendingInterpretations(req: AuthRequest, res: Response): Promise<void> {
        try {
            const workplaceId = req.user?.workplaceId;
            const { page = 1, limit = 20 } = req.query;

            const skip = (Number(page) - 1) * Number(limit);

            // Query for lab results (both with and without interpretations)
            // This allows pharmacists to see all lab results and manage their interpretations
            const query = {
                workplaceId: new mongoose.Types.ObjectId(workplaceId),
                labResults: { $exists: true, $ne: [] },
                status: { $in: ['completed', 'follow_up'] },
            };

            const [diagnosticCases, total] = await Promise.all([
                DiagnosticCase.find(query)
                    .populate('patientId', 'firstName lastName mrn')
                    .populate('pharmacistId', 'firstName lastName')
                    .populate('patientInterpretation.interpretedBy', 'firstName lastName')
                    .sort({ createdAt: -1 })
                    .limit(Number(limit))
                    .skip(skip)
                    .lean(),
                DiagnosticCase.countDocuments(query),
            ]);

            // Transform the data to match frontend expectations
            const formattedResults = diagnosticCases.map((diagnosticCase: any) => {
                const firstLabResult = diagnosticCase.labResults?.[0];
                const hasInterpretation = !!(
                    diagnosticCase.patientInterpretation &&
                    diagnosticCase.patientInterpretation.summary
                );

                return {
                    _id: diagnosticCase._id,
                    caseId: diagnosticCase.caseId,
                    patientId: diagnosticCase.patientId,
                    testName: firstLabResult?.testName || 'Lab Test',
                    testDate: diagnosticCase.createdAt,
                    testType: diagnosticCase.diagnosticType || 'lab',
                    status: diagnosticCase.status,
                    hasInterpretation,
                    visibleToPatient: diagnosticCase.patientInterpretation?.visibleToPatient || false,
                    interpretedAt: diagnosticCase.patientInterpretation?.interpretedAt,
                    interpretedBy: diagnosticCase.patientInterpretation?.interpretedBy,
                    labResults: diagnosticCase.labResults,
                };
            });

            res.status(200).json({
                success: true,
                message: 'Pending interpretations fetched successfully',
                data: {
                    diagnosticCases: formattedResults,
                    pagination: {
                        total,
                        page: Number(page),
                        limit: Number(limit),
                        pages: Math.ceil(total / Number(limit)),
                        hasMore: skip + formattedResults.length < total,
                    },
                },
            });
        } catch (error) {
            logger.error('Error fetching pending interpretations:', {
                error: error.message,
                stack: error.stack,
                userId: req.user?._id,
                workplaceId: req.user?.workplaceId,
            });

            res.status(500).json({
                success: false,
                message: 'Failed to fetch pending interpretations. Please try again.',
            });
        }
    }

    /**
     * @route GET /api/pharmacist/lab-results/:id/interpretation
     * @desc Get patient interpretation for a specific lab result
     * @access Private (Pharmacist)
     */
    static async getInterpretation(req: AuthRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const workplaceId = req.user?.workplaceId;

            // Validate diagnostic case ID
            if (!mongoose.Types.ObjectId.isValid(id)) {
                res.status(400).json({
                    success: false,
                    message: 'Invalid diagnostic case ID format',
                });
                return;
            }

            // Find diagnostic case
            const diagnosticCase = await DiagnosticCase.findOne({
                _id: new mongoose.Types.ObjectId(id),
                workplaceId: new mongoose.Types.ObjectId(workplaceId),
            })
                .populate('patientId', 'firstName lastName mrn')
                .populate('pharmacistId', 'firstName lastName')
                .populate('patientInterpretation.interpretedBy', 'firstName lastName')
                .populate('patientInterpretation.lastModifiedBy', 'firstName lastName')
                .lean();

            if (!diagnosticCase) {
                res.status(404).json({
                    success: false,
                    message: 'Lab result not found or you do not have access to it',
                });
                return;
            }

            res.status(200).json({
                success: true,
                message: 'Patient interpretation fetched successfully',
                data: {
                    diagnosticCase,
                    hasInterpretation: !!(diagnosticCase.patientInterpretation && diagnosticCase.patientInterpretation.summary),
                    visibleToPatient: !!(diagnosticCase.patientInterpretation && diagnosticCase.patientInterpretation.visibleToPatient),
                },
            });
        } catch (error) {
            logger.error('Error fetching interpretation:', {
                error: error.message,
                stack: error.stack,
                userId: req.user?._id,
                diagnosticCaseId: req.params.id,
            });

            res.status(500).json({
                success: false,
                message: 'Failed to fetch interpretation. Please try again.',
            });
        }
    }

    /**
     * @route DELETE /api/pharmacist/lab-results/:id/interpretation
     * @desc Delete patient interpretation (rarely used, but available for compliance)
     * @access Private (Pharmacist with elevated permissions)
     */
    static async deleteInterpretation(req: AuthRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const userId = req.user?._id;
            const workplaceId = req.user?.workplaceId;

            // Validate diagnostic case ID
            if (!mongoose.Types.ObjectId.isValid(id)) {
                res.status(400).json({
                    success: false,
                    message: 'Invalid diagnostic case ID format',
                });
                return;
            }

            // Find diagnostic case
            const diagnosticCase = await DiagnosticCase.findOne({
                _id: new mongoose.Types.ObjectId(id),
                workplaceId: new mongoose.Types.ObjectId(workplaceId),
            });

            if (!diagnosticCase) {
                res.status(404).json({
                    success: false,
                    message: 'Lab result not found or you do not have access to it',
                });
                return;
            }

            // Remove interpretation
            diagnosticCase.patientInterpretation = undefined;
            await diagnosticCase.save();

            logger.warn('Patient interpretation deleted', {
                diagnosticCaseId: id,
                deletedBy: userId,
                workplaceId,
                reason: 'Manual deletion by pharmacist',
            });

            res.status(200).json({
                success: true,
                message: 'Patient interpretation deleted successfully',
                data: {
                    diagnosticCaseId: diagnosticCase._id,
                },
            });
        } catch (error) {
            logger.error('Error deleting interpretation:', {
                error: error.message,
                stack: error.stack,
                userId: req.user?._id,
                diagnosticCaseId: req.params.id,
            });

            res.status(500).json({
                success: false,
                message: 'Failed to delete interpretation. Please try again.',
            });
        }
    }
}
