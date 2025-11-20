import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import diagnosticFollowUpService from '../services/diagnosticFollowUpService';
import DiagnosticFollowUp from '../models/DiagnosticFollowUp';
import DiagnosticRequest from '../models/DiagnosticRequest';
import DiagnosticResult from '../models/DiagnosticResult';
import Patient from '../../../models/Patient';
import User from '../../../models/User';
import Workplace from '../../../models/Workplace';

describe('DiagnosticFollowUpService', () => {
    let mongoServer: MongoMemoryServer;
    let workplaceId: mongoose.Types.ObjectId;
    let patientId: mongoose.Types.ObjectId;
    let pharmacistId: mongoose.Types.ObjectId;
    let diagnosticRequestId: mongoose.Types.ObjectId;
    let diagnosticResultId: mongoose.Types.ObjectId;

    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);
    });

    afterAll(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    beforeEach(async () => {
        // Clear all collections
        await mongoose.connection.db.dropDatabase();

        // Create test data
        workplaceId = new mongoose.Types.ObjectId();
        patientId = new mongoose.Types.ObjectId();
        pharmacistId = new mongoose.Types.ObjectId();
        diagnosticRequestId = new mongoose.Types.ObjectId();
        diagnosticResultId = new mongoose.Types.ObjectId();

        // Create workplace
        const workplace = new Workplace({
            _id: workplaceId,
            name: 'Test Pharmacy',
            address: 'Test Address',
            phone: '1234567890',
            email: 'test@pharmacy.com',
            licenseNumber: 'TEST123',
            createdBy: pharmacistId
        });
        await workplace.save();

        // Create patient
        const patient = new Patient({
            _id: patientId,
            workplaceId,
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: new Date('1990-01-01'),
            gender: 'male',
            mrn: 'TEST001',
            createdBy: pharmacistId
        });
        await patient.save();

        // Create pharmacist
        const pharmacist = new User({
            _id: pharmacistId,
            workplaceId,
            firstName: 'Dr.',
            lastName: 'Pharmacist',
            email: 'pharmacist@test.com',
            role: 'pharmacist',
            status: 'active',
            createdBy: pharmacistId
        });
        await pharmacist.save();

        // Create diagnostic request
        const diagnosticRequest = new DiagnosticRequest({
            _id: diagnosticRequestId,
            workplaceId,
            patientId,
            pharmacistId,
            inputSnapshot: {
                symptoms: {
                    subjective: ['headache', 'fatigue'],
                    objective: ['elevated blood pressure'],
                    duration: '3 days',
                    severity: 'moderate',
                    onset: 'acute'
                }
            },
            consentObtained: true,
            promptVersion: 'v1.0',
            createdBy: pharmacistId
        });
        await diagnosticRequest.save();

        // Create diagnostic result
        const diagnosticResult = new DiagnosticResult({
            _id: diagnosticResultId,
            workplaceId,
            requestId: diagnosticRequestId,
            diagnoses: [{
                condition: 'Hypertension',
                probability: 0.85,
                reasoning: 'Elevated blood pressure with symptoms',
                severity: 'medium',
                confidence: 'high',
                evidenceLevel: 'probable'
            }],
            differentialDiagnosis: ['Hypertension', 'Stress-related headache'],
            clinicalImpression: 'Likely hypertension requiring follow-up',
            riskAssessment: {
                overallRisk: 'medium',
                riskFactors: ['elevated blood pressure', 'symptoms']
            },
            aiMetadata: {
                modelId: 'test-model',
                modelVersion: '1.0',
                confidenceScore: 0.85,
                processingTime: 1000,
                tokenUsage: {
                    promptTokens: 100,
                    completionTokens: 200,
                    totalTokens: 300
                },
                requestId: 'test-request'
            },
            rawResponse: 'Test response',
            disclaimer: 'Test disclaimer',
            createdBy: pharmacistId
        });
        await diagnosticResult.save();
    });

    describe('createFollowUp', () => {
        it('should create a follow-up successfully', async () => {
            const followUpData = {
                diagnosticRequestId,
                diagnosticResultId,
                patientId,
                type: 'symptom_check' as const,
                priority: 'medium' as const,
                description: 'Follow-up for hypertension monitoring',
                objectives: ['Monitor blood pressure', 'Assess symptom improvement'],
                scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
                estimatedDuration: 30,
                assignedTo: pharmacistId
            };

            const followUp = await diagnosticFollowUpService.createFollowUp(
                workplaceId,
                followUpData,
                pharmacistId
            );

            expect(followUp).toBeDefined();
            expect(followUp.type).toBe('symptom_check');
            expect(followUp.description).toBe('Follow-up for hypertension monitoring');
            expect(followUp.objectives).toHaveLength(2);
            expect(followUp.status).toBe('scheduled');
            expect(followUp.reminders).toHaveLength(2); // Default reminders
        });

        it('should throw error for invalid diagnostic request', async () => {
            const followUpData = {
                diagnosticRequestId: new mongoose.Types.ObjectId(),
                diagnosticResultId,
                patientId,
                type: 'symptom_check' as const,
                description: 'Test follow-up',
                scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
                assignedTo: pharmacistId
            };

            await expect(
                diagnosticFollowUpService.createFollowUp(workplaceId, followUpData, pharmacistId)
            ).rejects.toThrow('Diagnostic request not found');
        });

        it('should throw error for invalid patient', async () => {
            const followUpData = {
                diagnosticRequestId,
                diagnosticResultId,
                patientId: new mongoose.Types.ObjectId(),
                type: 'symptom_check' as const,
                description: 'Test follow-up',
                scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
                assignedTo: pharmacistId
            };

            await expect(
                diagnosticFollowUpService.createFollowUp(workplaceId, followUpData, pharmacistId)
            ).rejects.toThrow('Patient not found');
        });
    });

    describe('autoScheduleFollowUps', () => {
        it('should auto-schedule follow-ups based on diagnostic result', async () => {
            const diagnosticResult = await DiagnosticResult.findById(diagnosticResultId);

            const followUps = await diagnosticFollowUpService.autoScheduleFollowUps(
                diagnosticResult!,
                pharmacistId
            );

            expect(followUps).toHaveLength(1); // Should create one follow-up for medium risk
            expect(followUps[0].autoScheduled).toBe(true);
            expect(followUps[0].type).toBe('outcome_assessment');
        });

        it('should schedule multiple follow-ups for high-risk cases', async () => {
            // Update diagnostic result to high risk
            await DiagnosticResult.findByIdAndUpdate(diagnosticResultId, {
                riskAssessment: {
                    overallRisk: 'high',
                    riskFactors: ['elevated blood pressure', 'symptoms', 'family history']
                },
                redFlags: [{
                    flag: 'Severe hypertension',
                    severity: 'high',
                    action: 'Immediate follow-up required',
                    clinicalRationale: 'Risk of complications'
                }]
            });

            const diagnosticResult = await DiagnosticResult.findById(diagnosticResultId);

            const followUps = await diagnosticFollowUpService.autoScheduleFollowUps(
                diagnosticResult!,
                pharmacistId
            );

            expect(followUps.length).toBeGreaterThan(1);
            expect(followUps.some(f => f.priority === 'high')).toBe(true);
        });
    });

    describe('completeFollowUp', () => {
        let followUpId: mongoose.Types.ObjectId;

        beforeEach(async () => {
            const followUp = new DiagnosticFollowUp({
                workplaceId,
                diagnosticRequestId,
                diagnosticResultId,
                patientId,
                type: 'symptom_check',
                description: 'Test follow-up',
                scheduledDate: new Date(),
                assignedTo: pharmacistId,
                createdBy: pharmacistId
            });
            await followUp.save();
            followUpId = followUp._id;
        });

        it('should complete follow-up with outcome', async () => {
            const outcome = {
                status: 'successful' as const,
                notes: 'Patient showed improvement',
                nextActions: ['Continue current medication', 'Schedule next follow-up'],
                adherenceImproved: true,
                symptomsResolved: ['headache'],
                vitalSigns: {
                    bloodPressure: '130/80',
                    heartRate: 72
                }
            };

            const completedFollowUp = await diagnosticFollowUpService.completeFollowUp(
                followUpId,
                outcome,
                pharmacistId
            );

            expect(completedFollowUp.status).toBe('completed');
            expect(completedFollowUp.completedAt).toBeDefined();
            expect(completedFollowUp.outcome?.status).toBe('successful');
            expect(completedFollowUp.outcome?.notes).toBe('Patient showed improvement');
        });

        it('should throw error for invalid follow-up ID', async () => {
            const outcome = {
                status: 'successful' as const,
                notes: 'Test notes',
                nextActions: []
            };

            await expect(
                diagnosticFollowUpService.completeFollowUp(
                    new mongoose.Types.ObjectId(),
                    outcome,
                    pharmacistId
                )
            ).rejects.toThrow('Follow-up not found');
        });
    });

    describe('rescheduleFollowUp', () => {
        let followUpId: mongoose.Types.ObjectId;

        beforeEach(async () => {
            const followUp = new DiagnosticFollowUp({
                workplaceId,
                diagnosticRequestId,
                diagnosticResultId,
                patientId,
                type: 'symptom_check',
                description: 'Test follow-up',
                scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
                assignedTo: pharmacistId,
                createdBy: pharmacistId
            });
            await followUp.save();
            followUpId = followUp._id;
        });

        it('should reschedule follow-up successfully', async () => {
            const newDate = new Date(Date.now() + 48 * 60 * 60 * 1000); // Day after tomorrow
            const reason = 'Patient requested different time';

            const rescheduledFollowUp = await diagnosticFollowUpService.rescheduleFollowUp(
                followUpId,
                newDate,
                reason,
                pharmacistId
            );

            expect(rescheduledFollowUp.scheduledDate).toEqual(newDate);
            expect(rescheduledFollowUp.rescheduledReason).toBe(reason);
            expect(rescheduledFollowUp.rescheduledFrom).toBeDefined();
            expect(rescheduledFollowUp.status).toBe('scheduled');
        });
    });

    describe('getPatientFollowUps', () => {
        beforeEach(async () => {
            // Create multiple follow-ups for the patient
            const followUps = [
                {
                    type: 'symptom_check',
                    status: 'completed',
                    scheduledDate: new Date(Date.now() - 24 * 60 * 60 * 1000)
                },
                {
                    type: 'medication_review',
                    status: 'scheduled',
                    scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
                },
                {
                    type: 'lab_review',
                    status: 'missed',
                    scheduledDate: new Date(Date.now() - 12 * 60 * 60 * 1000)
                }
            ];

            for (const followUpData of followUps) {
                const followUp = new DiagnosticFollowUp({
                    workplaceId,
                    diagnosticRequestId,
                    diagnosticResultId,
                    patientId,
                    description: 'Test follow-up',
                    assignedTo: pharmacistId,
                    createdBy: pharmacistId,
                    ...followUpData
                });
                await followUp.save();
            }
        });

        it('should get all follow-ups for patient', async () => {
            const followUps = await diagnosticFollowUpService.getPatientFollowUps(
                patientId,
                workplaceId
            );

            expect(followUps).toHaveLength(3);
        });

        it('should filter follow-ups by status', async () => {
            const followUps = await diagnosticFollowUpService.getPatientFollowUps(
                patientId,
                workplaceId,
                { status: 'scheduled' }
            );

            expect(followUps).toHaveLength(1);
            expect(followUps[0].status).toBe('scheduled');
        });

        it('should filter follow-ups by type', async () => {
            const followUps = await diagnosticFollowUpService.getPatientFollowUps(
                patientId,
                workplaceId,
                { type: 'medication_review' }
            );

            expect(followUps).toHaveLength(1);
            expect(followUps[0].type).toBe('medication_review');
        });

        it('should limit and skip results', async () => {
            const followUps = await diagnosticFollowUpService.getPatientFollowUps(
                patientId,
                workplaceId,
                { limit: 2, skip: 1 }
            );

            expect(followUps).toHaveLength(2);
        });
    });

    describe('getOverdueFollowUps', () => {
        beforeEach(async () => {
            // Create overdue follow-ups
            const overdueFollowUps = [
                {
                    scheduledDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
                    status: 'scheduled'
                },
                {
                    scheduledDate: new Date(Date.now() - 48 * 60 * 60 * 1000), // 2 days ago
                    status: 'in_progress'
                },
                {
                    scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Future
                    status: 'scheduled'
                }
            ];

            for (const followUpData of overdueFollowUps) {
                const followUp = new DiagnosticFollowUp({
                    workplaceId,
                    diagnosticRequestId,
                    diagnosticResultId,
                    patientId,
                    type: 'symptom_check',
                    description: 'Test follow-up',
                    assignedTo: pharmacistId,
                    createdBy: pharmacistId,
                    ...followUpData
                });
                await followUp.save();
            }
        });

        it('should get only overdue follow-ups', async () => {
            const overdueFollowUps = await diagnosticFollowUpService.getOverdueFollowUps(workplaceId);

            expect(overdueFollowUps).toHaveLength(2);
            overdueFollowUps.forEach(followUp => {
                expect(followUp.scheduledDate.getTime()).toBeLessThan(Date.now());
                expect(['scheduled', 'in_progress']).toContain(followUp.status);
            });
        });
    });

    describe('getFollowUpAnalytics', () => {
        beforeEach(async () => {
            // Create follow-ups with different statuses
            const followUpsData = [
                { status: 'completed', type: 'symptom_check', priority: 'high' },
                { status: 'completed', type: 'medication_review', priority: 'medium' },
                { status: 'missed', type: 'lab_review', priority: 'low' },
                { status: 'scheduled', type: 'symptom_check', priority: 'high' },
                { status: 'cancelled', type: 'adherence_check', priority: 'medium' }
            ];

            for (const followUpData of followUpsData) {
                const followUp = new DiagnosticFollowUp({
                    workplaceId,
                    diagnosticRequestId,
                    diagnosticResultId,
                    patientId,
                    description: 'Test follow-up',
                    scheduledDate: new Date(),
                    assignedTo: pharmacistId,
                    createdBy: pharmacistId,
                    ...followUpData
                });
                await followUp.save();
            }
        });

        it('should calculate follow-up analytics correctly', async () => {
            const analytics = await diagnosticFollowUpService.getFollowUpAnalytics(workplaceId);

            expect(analytics.totalFollowUps).toBe(5);
            expect(analytics.completedFollowUps).toBe(2);
            expect(analytics.missedFollowUps).toBe(1);
            expect(analytics.completionRate).toBe(40); // 2/5 * 100
            expect(analytics.followUpsByType['symptom_check']).toBe(2);
            expect(analytics.followUpsByPriority['high']).toBe(2);
        });

        it('should filter analytics by date range', async () => {
            const dateRange = {
                start: new Date(Date.now() - 24 * 60 * 60 * 1000),
                end: new Date(Date.now() + 24 * 60 * 60 * 1000)
            };

            const analytics = await diagnosticFollowUpService.getFollowUpAnalytics(
                workplaceId,
                dateRange
            );

            expect(analytics.totalFollowUps).toBe(5);
        });
    });

    describe('processMissedFollowUps', () => {
        beforeEach(async () => {
            // Create follow-ups that should be marked as missed
            const pastDate = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago

            const followUp = new DiagnosticFollowUp({
                workplaceId,
                diagnosticRequestId,
                diagnosticResultId,
                patientId,
                type: 'symptom_check',
                description: 'Test follow-up',
                scheduledDate: pastDate,
                status: 'scheduled',
                assignedTo: pharmacistId,
                createdBy: pharmacistId
            });
            await followUp.save();
        });

        it('should mark overdue follow-ups as missed', async () => {
            await diagnosticFollowUpService.processMissedFollowUps();

            const followUps = await DiagnosticFollowUp.find({ workplaceId });
            const missedFollowUps = followUps.filter(f => f.status === 'missed');

            expect(missedFollowUps).toHaveLength(1);
        });
    });
});