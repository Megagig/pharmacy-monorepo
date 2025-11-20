import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth';
import Patient from '../models/Patient';
import AppError from '../utils/AppError';
import logger from '../utils/logger';
import mongoose from 'mongoose';
import healthRecordsNotificationService from '../services/healthRecordsNotificationService';

/**
 * Get unverified vitals for all patients in the workplace
 * GET /api/pharmacist/vitals/pending-verification
 */
export const getPendingVitals = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { workplaceId } = req.user as any;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;

        // Find all patients with unverified vitals in this workplace
        const patients = await Patient.find({
            workplaceId: new mongoose.Types.ObjectId(workplaceId),
            'patientLoggedVitals.isVerified': false,
        })
            .select('firstName lastName mrn patientLoggedVitals')
            .limit(limit)
            .skip(skip);

        // Extract only unverified vitals for each patient
        const pendingVitals = patients.flatMap((patient) => {
            const unverifiedVitals = patient.patientLoggedVitals.filter(
                (vitals) => !vitals.isVerified
            );
            return unverifiedVitals.map((vitals) => ({
                vitalsId: vitals._id,
                patientId: patient._id,
                patientName: `${patient.firstName} ${patient.lastName}`,
                mrn: patient.mrn,
                recordedDate: vitals.recordedDate,
                bloodPressure: vitals.bloodPressure,
                heartRate: vitals.heartRate,
                temperature: vitals.temperature,
                weight: vitals.weight,
                glucose: vitals.glucose,
                oxygenSaturation: vitals.oxygenSaturation,
                notes: vitals.notes,
            }));
        });

        // Sort by most recent first
        pendingVitals.sort(
            (a, b) => new Date(b.recordedDate).getTime() - new Date(a.recordedDate).getTime()
        );

        const total = await Patient.countDocuments({
            workplaceId: new mongoose.Types.ObjectId(workplaceId),
            'patientLoggedVitals.isVerified': false,
        });

        res.status(200).json({
            success: true,
            data: {
                vitals: pendingVitals,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            },
        });
    } catch (error: any) {
        logger.error('Error fetching pending vitals:', error);
        next(new AppError('Failed to fetch pending vitals', 500));
    }
};

/**
 * Verify patient vitals
 * PUT /api/pharmacist/vitals/:patientId/:vitalsId/verify
 */
export const verifyVitals = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { patientId, vitalsId } = req.params;
        const { id: pharmacistId, workplaceId } = req.user as any;

        // Validate IDs
        if (!mongoose.Types.ObjectId.isValid(patientId)) {
            return next(new AppError('Invalid patient ID', 400));
        }
        if (!mongoose.Types.ObjectId.isValid(vitalsId)) {
            return next(new AppError('Invalid vitals ID', 400));
        }

        // Find patient
        const patient = await Patient.findOne({
            _id: patientId,
            workplaceId: new mongoose.Types.ObjectId(workplaceId),
        });

        if (!patient) {
            return next(new AppError('Patient not found', 404));
        }

        // Verify the vitals
        const verified = patient.verifyVitals(vitalsId, new mongoose.Types.ObjectId(pharmacistId));

        if (!verified) {
            return next(new AppError('Vitals record not found', 404));
        }

        await patient.save();

        // Send notification to patient
        const patientUserId = (patient as any).userId;
        if (patientUserId) {
            const vitalsRecord = patient.patientLoggedVitals.find((v: any) => v._id?.toString() === vitalsId);
            await healthRecordsNotificationService.notifyVitalsVerified(
                patientUserId.toString(),
                workplaceId.toString(),
                vitalsId,
                vitalsRecord?.recordedDate || new Date()
            );
            logger.info('Vitals verification notification sent', {
                patientUserId,
                vitalsId,
            });
        }

        logger.info(`Vitals ${vitalsId} verified by pharmacist ${pharmacistId}`);

        res.status(200).json({
            success: true,
            message: 'Vitals verified successfully',
            data: {
                patientId: patient._id,
                vitalsId,
                verifiedBy: pharmacistId,
                verifiedAt: new Date(),
            },
        });
    } catch (error: any) {
        logger.error('Error verifying vitals:', error);
        next(new AppError('Failed to verify vitals', 500));
    }
};

/**
 * Unverify patient vitals (for corrections)
 * PUT /api/pharmacist/vitals/:patientId/:vitalsId/unverify
 */
export const unverifyVitals = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { patientId, vitalsId } = req.params;
        const { workplaceId } = req.user as any;

        // Validate IDs
        if (!mongoose.Types.ObjectId.isValid(patientId)) {
            return next(new AppError('Invalid patient ID', 400));
        }
        if (!mongoose.Types.ObjectId.isValid(vitalsId)) {
            return next(new AppError('Invalid vitals ID', 400));
        }

        // Find patient
        const patient = await Patient.findOne({
            _id: patientId,
            workplaceId: new mongoose.Types.ObjectId(workplaceId),
        });

        if (!patient) {
            return next(new AppError('Patient not found', 404));
        }

        // Unverify the vitals
        const unverified = patient.unverifyVitals(vitalsId);

        if (!unverified) {
            return next(new AppError('Vitals record not found', 404));
        }

        await patient.save();

        logger.info(`Vitals ${vitalsId} unverified for patient ${patientId}`);

        res.status(200).json({
            success: true,
            message: 'Vitals unverified successfully',
            data: {
                patientId: patient._id,
                vitalsId,
            },
        });
    } catch (error: any) {
        logger.error('Error unverifying vitals:', error);
        next(new AppError('Failed to unverify vitals', 500));
    }
};

/**
 * Get patient vitals history with verification status
 * GET /api/pharmacist/vitals/:patientId/history
 */
export const getPatientVitalsHistory = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { patientId } = req.params;
        const { workplaceId } = req.user as any;
        const limit = parseInt(req.query.limit as string) || 50;
        const verified = req.query.verified === 'true' ? true : req.query.verified === 'false' ? false : undefined;

        // Validate patient ID
        if (!mongoose.Types.ObjectId.isValid(patientId)) {
            return next(new AppError('Invalid patient ID', 400));
        }

        // Find patient
        const patient = await Patient.findOne({
            _id: patientId,
            workplaceId: new mongoose.Types.ObjectId(workplaceId),
        }).populate('patientLoggedVitals.verifiedBy', 'firstName lastName professionalTitle');

        if (!patient) {
            return next(new AppError('Patient not found', 404));
        }

        let vitalsHistory;

        if (verified === true) {
            vitalsHistory = patient.getVerifiedVitals(limit);
        } else if (verified === false) {
            vitalsHistory = patient.getUnverifiedVitals();
        } else {
            vitalsHistory = patient.getVitalsHistory(limit);
        }

        res.status(200).json({
            success: true,
            data: {
                patientId: patient._id,
                patientName: `${patient.firstName} ${patient.lastName}`,
                mrn: patient.mrn,
                vitalsHistory,
                unverifiedCount: patient.getUnverifiedVitals().length,
                totalCount: patient.patientLoggedVitals.length,
            },
        });
    } catch (error: any) {
        logger.error('Error fetching patient vitals history:', error);
        next(new AppError('Failed to fetch vitals history', 500));
    }
};

/**
 * Bulk verify multiple vitals entries
 * POST /api/pharmacist/vitals/bulk-verify
 */
export const bulkVerifyVitals = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { vitalsEntries } = req.body; // Array of { patientId, vitalsId }
        const { id: pharmacistId, workplaceId } = req.user as any;

        if (!Array.isArray(vitalsEntries) || vitalsEntries.length === 0) {
            return next(new AppError('vitalsEntries array is required', 400));
        }

        if (vitalsEntries.length > 50) {
            return next(new AppError('Cannot verify more than 50 entries at once', 400));
        }

        const results = {
            verified: [] as any[],
            failed: [] as any[],
        };

        for (const entry of vitalsEntries) {
            const { patientId, vitalsId } = entry;

            // Validate IDs
            if (!mongoose.Types.ObjectId.isValid(patientId) || !mongoose.Types.ObjectId.isValid(vitalsId)) {
                results.failed.push({ patientId, vitalsId, reason: 'Invalid ID' });
                continue;
            }

            try {
                const patient = await Patient.findOne({
                    _id: patientId,
                    workplaceId: new mongoose.Types.ObjectId(workplaceId),
                });

                if (!patient) {
                    results.failed.push({ patientId, vitalsId, reason: 'Patient not found' });
                    continue;
                }

                const verified = patient.verifyVitals(vitalsId, new mongoose.Types.ObjectId(pharmacistId));

                if (verified) {
                    await patient.save();
                    results.verified.push({ patientId, vitalsId });
                } else {
                    results.failed.push({ patientId, vitalsId, reason: 'Vitals not found' });
                }
            } catch (error) {
                results.failed.push({ patientId, vitalsId, reason: 'Processing error' });
            }
        }

        logger.info(
            `Bulk verification completed: ${results.verified.length} verified, ${results.failed.length} failed`
        );

        res.status(200).json({
            success: true,
            message: `Verified ${results.verified.length} out of ${vitalsEntries.length} entries`,
            data: results,
        });
    } catch (error: any) {
        logger.error('Error in bulk verify vitals:', error);
        next(new AppError('Failed to bulk verify vitals', 500));
    }
};
