import { Response } from 'express';
import { AuthRequest } from '../types/auth';
import mongoose from 'mongoose';
import DiagnosticCase from '../models/DiagnosticCase';
import Visit from '../models/Visit';
import Patient from '../models/Patient';
import AppError from '../utils/AppError';
import logger from '../utils/logger';

/**
 * Appointment Health Records Controller
 * Provides unified access to all health records associated with an appointment
 */

/**
 * Get all health records for a specific appointment
 * GET /api/appointments/:appointmentId/health-records
 */
export const getAppointmentHealthRecords = async (req: AuthRequest, res: Response) => {
    try {
        const { appointmentId } = req.params;
        const { workplaceId } = req.user as any;

        // Validate appointmentId
        if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
            throw new AppError('Invalid appointment ID', 400);
        }

        const appointmentObjectId = new mongoose.Types.ObjectId(appointmentId);

        // Fetch all related health records in parallel
        const [diagnosticCases, visits, patients] = await Promise.all([
            // Lab Results / Diagnostic Cases
            DiagnosticCase.find({
                appointmentId: appointmentObjectId,
                workplaceId: new mongoose.Types.ObjectId(workplaceId),
            })
                .populate('patientId', 'firstName lastName mrn')
                .populate('pharmacistId', 'firstName lastName professionalTitle')
                .sort({ createdAt: -1 })
                .lean(),

            // Visit Records with Patient Summaries
            Visit.find({
                appointmentId: appointmentObjectId,
                workplaceId: new mongoose.Types.ObjectId(workplaceId),
                isDeleted: false,
            })
                .populate('patientId', 'firstName lastName mrn')
                .populate('createdBy', 'firstName lastName professionalTitle')
                .populate('patientSummary.summarizedBy', 'firstName lastName')
                .sort({ date: -1 })
                .lean(),

            // Patient Vitals (need to filter in memory since vitals are embedded)
            Patient.find({
                workplaceId: new mongoose.Types.ObjectId(workplaceId),
                'patientLoggedVitals.appointmentId': appointmentObjectId,
            })
                .select('firstName lastName mrn patientLoggedVitals')
                .lean(),
        ]);

        // Extract and filter vitals that match the appointmentId
        const appointmentVitals: any[] = [];
        patients.forEach((patient) => {
            const matchingVitals = patient.patientLoggedVitals.filter(
                (vital: any) => vital.appointmentId?.toString() === appointmentId
            );
            matchingVitals.forEach((vital: any) => {
                appointmentVitals.push({
                    ...vital,
                    patientId: patient._id,
                    patientName: `${patient.firstName} ${patient.lastName}`,
                    mrn: patient.mrn,
                });
            });
        });

        // Sort vitals by recorded date
        appointmentVitals.sort(
            (a, b) => new Date(b.recordedDate).getTime() - new Date(a.recordedDate).getTime()
        );

        // Build timeline of all health events
        const timeline: any[] = [];

        // Add diagnostic cases to timeline
        diagnosticCases.forEach((diagnosticCase: any) => {
            timeline.push({
                type: 'lab_result',
                timestamp: diagnosticCase.createdAt,
                id: diagnosticCase._id,
                data: {
                    caseId: diagnosticCase.caseId,
                    status: diagnosticCase.status,
                    labResults: diagnosticCase.labResults,
                    hasInterpretation: !!diagnosticCase.patientInterpretation,
                    isVisibleToPatient: diagnosticCase.patientInterpretation?.visibleToPatient || false,
                    patient: diagnosticCase.patientId,
                    pharmacist: diagnosticCase.pharmacistId,
                },
            });
        });

        // Add visits to timeline
        visits.forEach((visit: any) => {
            timeline.push({
                type: 'visit',
                timestamp: visit.date,
                id: visit._id,
                data: {
                    visitType: visit.visitType,
                    chiefComplaint: visit.chiefComplaint,
                    assessment: visit.assessment,
                    hasSummary: !!visit.patientSummary,
                    isSummaryVisible: visit.patientSummary?.visibleToPatient || false,
                    patient: visit.patientId,
                    createdBy: visit.createdBy,
                },
            });
        });

        // Add vitals to timeline
        appointmentVitals.forEach((vital: any) => {
            timeline.push({
                type: 'vitals',
                timestamp: vital.recordedDate,
                id: vital._id,
                data: {
                    bloodPressure: vital.bloodPressure,
                    heartRate: vital.heartRate,
                    temperature: vital.temperature,
                    weight: vital.weight,
                    glucose: vital.glucose,
                    oxygenSaturation: vital.oxygenSaturation,
                    notes: vital.notes,
                    isVerified: vital.isVerified,
                    patientName: vital.patientName,
                    mrn: vital.mrn,
                },
            });
        });

        // Sort timeline by timestamp (most recent first)
        timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        // Calculate summary statistics
        const summary = {
            totalRecords: diagnosticCases.length + visits.length + appointmentVitals.length,
            labResults: diagnosticCases.length,
            visits: visits.length,
            vitals: appointmentVitals.length,
            hasInterpretations: diagnosticCases.filter((dc: any) => dc.patientInterpretation).length,
            hasSummaries: visits.filter((v: any) => v.patientSummary).length,
            verifiedVitals: appointmentVitals.filter((v: any) => v.isVerified).length,
        };

        logger.info('Appointment health records retrieved', {
            appointmentId,
            workplaceId,
            summary,
        });

        res.status(200).json({
            success: true,
            data: {
                appointmentId,
                summary,
                timeline,
                labResults: diagnosticCases,
                visits,
                vitals: appointmentVitals,
            },
        });
    } catch (error: any) {
        logger.error('Error fetching appointment health records:', error);
        if (error instanceof AppError) {
            res.status(error.statusCode).json({
                success: false,
                message: error.message,
            });
        } else {
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to fetch appointment health records',
            });
        }
    }
};

/**
 * Get appointment health records summary (lightweight version)
 * GET /api/appointments/:appointmentId/health-records/summary
 */
export const getAppointmentHealthRecordsSummary = async (req: AuthRequest, res: Response) => {
    try {
        const { appointmentId } = req.params;
        const { workplaceId } = req.user as any;

        if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
            throw new AppError('Invalid appointment ID', 400);
        }

        const appointmentObjectId = new mongoose.Types.ObjectId(appointmentId);

        // Count documents in parallel
        const [labResultsCount, visitsCount, patientsWithVitals] = await Promise.all([
            DiagnosticCase.countDocuments({
                appointmentId: appointmentObjectId,
                workplaceId: new mongoose.Types.ObjectId(workplaceId),
            }),
            Visit.countDocuments({
                appointmentId: appointmentObjectId,
                workplaceId: new mongoose.Types.ObjectId(workplaceId),
                isDeleted: false,
            }),
            Patient.countDocuments({
                workplaceId: new mongoose.Types.ObjectId(workplaceId),
                'patientLoggedVitals.appointmentId': appointmentObjectId,
            }),
        ]);

        res.status(200).json({
            success: true,
            data: {
                appointmentId,
                hasRecords: labResultsCount > 0 || visitsCount > 0 || patientsWithVitals > 0,
                counts: {
                    labResults: labResultsCount,
                    visits: visitsCount,
                    vitalsRecords: patientsWithVitals,
                },
            },
        });
    } catch (error: any) {
        logger.error('Error fetching appointment health records summary:', error);
        if (error instanceof AppError) {
            res.status(error.statusCode).json({
                success: false,
                message: error.message,
            });
        } else {
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to fetch appointment health records summary',
            });
        }
    }
};
