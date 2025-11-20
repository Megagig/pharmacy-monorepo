import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import diagnosticFollowUpService from '../services/diagnosticFollowUpService';
import adherenceService from '../services/adherenceService';
import diagnosticNotificationService from '../services/diagnosticNotificationService';
import DiagnosticFollowUp from '../models/DiagnosticFollowUp';
import AdherenceTracking from '../models/AdherenceTracking';
import DiagnosticRequest from '../models/DiagnosticRequest';
import DiagnosticResult from '../models/DiagnosticResult';
import Patient from '../../../models/Patient';
import User from '../../../models/User';
import Workplace from '../../../models/Workplace';

describe('Follow-up and Adherence Integration', () => {
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
            contactInfo: {
                phone: '+1234567890',
                email: 'john.doe@test.com'
            },
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
            phone: '+1987654321',
            role: 'pharmacist',
            status: 'active',
            notificationPreferences: {
                followUpReminders: true,
                adherenceAlerts: true,
                email: true,
                sms: true
            },
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
                    subjective: ['chest pain', 'shortness of breath'],
                    objective: ['elevated blood pressure'],
                    duration: '2 weeks',
                    severity: 'moderate',
                    onset: 'chronic'
                },
                vitals: {
                    bloodPressure: '150/95',
                    heartRate: 85,
                    temperature: 98.6
                },
                currentMedications: [
                    {
                        name: 'Aspirin',
                        dosage: '81mg',
                        frequency: 'once daily'
                    }
                ],
                allergies: ['Penicillin']
            },
            consentObtained: true,
            promptVersion: 'v1.0',
            status: 'completed',
            createdBy: pharmacistId
        });
        await diagnosticRequest.save();

        // Create diagnostic result with medication suggestions
        const diagnosticResult = new DiagnosticResult({
            _id: diagnosticResultId,
            workplaceId,
            requestId: diagnosticRequestId,
            diagnoses: [
                {
                    condition: 'Hypertension',
                    probability: 0.9,
                    reasoning: 'Elevated blood pressure with symptoms',
                    severity: 'high',
                    confidence: 'high',
                    evidenceLevel: 'probable'
                },
                {
                    condition: 'Coronary Artery Disease',
                    probability: 0.6,
                    reasoning: 'Chest pain with risk factors',
                    severity: 'high',
                    confidence: 'medium',
                    evidenceLevel: 'possible'
                }
            ],
            medicationSuggestions: [
                {
                    drugName: 'Lisinopril',
                    dosage: '10mg',
                    frequency: 'once daily',
                    duration: '30 days',
                    reasoning: 'ACE inhibitor for hypertension control',
                    safetyNotes: ['Monitor kidney function', 'Watch for dry cough'],
                    rxcui: '29046'
                },
                {
                    drugName: 'Atorvastatin',
                    dosage: '20mg',
                    frequency: 'once daily',
                    duration: '30 days',
                    reasoning: 'Statin for cardiovascular risk reduction',
                    safetyNotes: ['Monitor liver function', 'Watch for muscle pain'],
                    rxcui: '83367'
                }
            ],
            redFlags: [
                {
                    flag: 'Chest pain with elevated BP',
                    severity: 'high',
                    action: 'Monitor closely, consider cardiology referral',
                    clinicalRationale: 'Risk of cardiovascular events'
                }
            ],
            referralRecommendation: {
                recommended: true,
                urgency: 'within_week',
                specialty: 'Cardiology',
                reason: 'Chest pain with hypertension requires cardiac evaluation'
            },
            differentialDiagnosis: ['Hypertension', 'Coronary Artery Disease', 'Anxiety'],
            clinicalImpression: 'Hypertension with possible coronary artery disease',
            riskAssessment: {
                overallRisk: 'high',
                riskFactors: ['elevated blood pressure', 'chest pain', 'cardiovascular risk factors']
            },
            aiMetadata: {
                modelId: 'deepseek-v3.1',
                modelVersion: '1.0',
                confidenceScore: 0.85,
                processingTime: 2500,
                tokenUsage: {
                    promptTokens: 150,
                    completionTokens: 300,
                    totalTokens: 450
                },
                requestId: 'test-request-001'
            },
            rawResponse: 'Test AI response',
            disclaimer: 'AI-generated analysis for clinical decision support',
            followUpRequired: true,
            followUpDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
            followUpInstructions: [
                'Monitor blood pressure daily',
                'Watch for worsening chest pain',
                'Follow up in 3 days'
            ],
            createdBy: pharmacistId
        });
        await diagnosticResult.save();
    });

    describe('Complete Workflow Integration', () => {
        it('should create follow-ups and adherence tracking from diagnostic result', async () => {
            const diagnosticResult = await DiagnosticResult.findById(diagnosticResultId);

            // Step 1: Auto-schedule follow-ups based on diagnostic result
            const followUps = await diagnosticFollowUpService.autoScheduleFollowUps(
                diagnosticResult!,
                pharmacistId
            );

            expect(followUps.length).toBeGreaterThan(0);
            expect(followUps.some(f => f.priority === 'high')).toBe(true);
            expect(followUps.some(f => f.type === 'symptom_check')).toBe(true);

            // Step 2: Create adherence tracking from medication suggestions
            const adherenceTracking = await adherenceService.createFromDiagnosticResult(
                diagnosticResult!,
                pharmacistId
            );

            expect(adherenceTracking).toBeDefined();
            expect(adherenceTracking!.medications).toHaveLength(2);
            expect(adherenceTracking!.medications[0].medicationName).toBe('Lisinopril');
            expect(adherenceTracking!.medications[1].medicationName).toBe('Atorvastatin');
            expect(adherenceTracking!.monitoringFrequency).toBe('weekly'); // High risk = weekly monitoring

            // Step 3: Verify follow-up reminders are scheduled
            const createdFollowUp = followUps[0];
            expect(createdFollowUp.reminders).toHaveLength(2); // Default reminders
            expect(createdFollowUp.relatedDiagnoses).toContain('Hypertension');
            expect(createdFollowUp.relatedMedications).toContain('Lisinopril');
        });

        it('should handle medication refills and update adherence', async () => {
            // Create adherence tracking
            const trackingData = {
                patientId,
                diagnosticResultId,
                medications: [
                    {
                        medicationName: 'Lisinopril',
                        dosage: '10mg',
                        frequency: 'once daily',
                        prescribedDate: new Date()
                    }
                ]
            };

            const adherenceTracking = await adherenceService.createAdherenceTracking(
                workplaceId,
                trackingData,
                pharmacistId
            );

            // Add initial refill
            const refillData = {
                medicationName: 'Lisinopril',
                date: new Date(),
                daysSupply: 30,
                source: 'pharmacy' as const,
                notes: 'Initial prescription fill'
            };

            const updatedTracking = await adherenceService.addRefill(
                patientId,
                workplaceId,
                refillData
            );

            expect(updatedTracking.medications[0].refillHistory).toHaveLength(1);
            expect(updatedTracking.medications[0].expectedRefillDate).toBeDefined();

            // Add second refill on time
            const secondRefillDate = new Date(refillData.date.getTime() + 30 * 24 * 60 * 60 * 1000);
            const secondRefill = {
                medicationName: 'Lisinopril',
                date: secondRefillDate,
                daysSupply: 30,
                source: 'pharmacy' as const,
                notes: 'On-time refill'
            };

            const tracking2 = await adherenceService.addRefill(
                patientId,
                workplaceId,
                secondRefill
            );

            expect(tracking2.medications[0].refillHistory).toHaveLength(2);

            // Calculate adherence - should be good since refills are on time
            const medication = tracking2.medications[0];
            expect(medication.adherenceScore).toBeGreaterThan(80);
            expect(medication.adherenceStatus).toBe('excellent');
        });

        it('should detect adherence issues and create alerts', async () => {
            // Create adherence tracking with overdue refill
            const trackingData = {
                patientId,
                medications: [{
                    medicationName: 'Lisinopril',
                    dosage: '10mg',
                    frequency: 'once daily',
                    prescribedDate: new Date()
                }]
            };

            const adherenceTracking = await adherenceService.createAdherenceTracking(
                workplaceId,
                trackingData,
                pharmacistId
            );

            // Manually set overdue refill date
            adherenceTracking.medications[0].expectedRefillDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
            adherenceTracking.medications[0].adherenceScore = 45; // Poor adherence
            await adherenceTracking.save();

            // Check for adherence alerts
            await adherenceService.checkAdherenceAlerts(adherenceTracking);

            const updatedTracking = await AdherenceTracking.findById(adherenceTracking._id);
            expect(updatedTracking!.alerts.length).toBeGreaterThan(0);

            const missedRefillAlert = updatedTracking!.alerts.find(alert => alert.type === 'missed_refill');
            const lowAdherenceAlert = updatedTracking!.alerts.find(alert => alert.type === 'low_adherence');

            expect(missedRefillAlert).toBeDefined();
            expect(missedRefillAlert!.severity).toBe('high'); // 7 days overdue
            expect(lowAdherenceAlert).toBeDefined();
            expect(lowAdherenceAlert!.severity).toBe('critical'); // Score < 50
        });

        it('should complete follow-up and schedule next based on outcome', async () => {
            // Create a follow-up
            const followUpData = {
                diagnosticRequestId,
                diagnosticResultId,
                patientId,
                type: 'symptom_check' as const,
                description: 'Blood pressure and symptom check',
                objectives: ['Monitor blood pressure', 'Assess chest pain'],
                scheduledDate: new Date(),
                assignedTo: pharmacistId
            };

            const followUp = await diagnosticFollowUpService.createFollowUp(
                workplaceId,
                followUpData,
                pharmacistId
            );

            // Complete the follow-up with outcome requiring next follow-up
            const outcome = {
                status: 'partially_successful' as const,
                notes: 'Blood pressure improved but still elevated. Chest pain persists.',
                nextActions: [
                    'Continue current medications',
                    'Schedule cardiology referral',
                    'Follow up in 1 week'
                ],
                nextFollowUpDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week
                adherenceImproved: true,
                vitalSigns: {
                    bloodPressure: '140/85',
                    heartRate: 78
                },
                medicationChanges: [
                    {
                        action: 'modified',
                        medication: 'Lisinopril',
                        reason: 'Increased dose for better BP control'
                    }
                ],
                referralMade: {
                    specialty: 'Cardiology',
                    urgency: 'within_week',
                    reason: 'Persistent chest pain with hypertension'
                }
            };

            const completedFollowUp = await diagnosticFollowUpService.completeFollowUp(
                followUp._id,
                outcome,
                pharmacistId
            );

            expect(completedFollowUp.status).toBe('completed');
            expect(completedFollowUp.outcome?.status).toBe('partially_successful');
            expect(completedFollowUp.outcome?.nextFollowUpDate).toBeDefined();

            // Verify next follow-up was scheduled
            const nextFollowUps = await DiagnosticFollowUp.find({
                patientId,
                scheduledDate: { $gt: new Date() }
            });

            expect(nextFollowUps.length).toBeGreaterThan(0);
        });

        it('should generate comprehensive adherence report', async () => {
            // Create adherence tracking with full data
            const trackingData = {
                patientId,
                diagnosticResultId,
                medications: [
                    {
                        medicationName: 'Lisinopril',
                        dosage: '10mg',
                        frequency: 'once daily',
                        prescribedDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                    }
                ]
            };

            const adherenceTracking = await adherenceService.createAdherenceTracking(
                workplaceId,
                trackingData,
                pharmacistId
            );

            // Add refill history
            const refillDates = [
                new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
                new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago (15-day gap)
                new Date() // Today (15-day gap)
            ];

            for (const [index, date] of refillDates.entries()) {
                await adherenceService.addRefill(
                    patientId,
                    workplaceId,
                    {
                        medicationName: 'Lisinopril',
                        date,
                        daysSupply: 30,
                        source: 'pharmacy',
                        notes: `Refill ${index + 1}`
                    }
                );
            }

            // Add intervention
            await adherenceService.addIntervention(
                patientId,
                workplaceId,
                {
                    type: 'counseling',
                    description: 'Medication adherence counseling provided',
                    expectedOutcome: 'Improved adherence to >80%'
                },
                pharmacistId
            );

            // Generate report
            const reportPeriod = {
                start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                end: new Date()
            };

            const report = await adherenceService.generateAdherenceReport(
                patientId,
                workplaceId,
                reportPeriod
            );

            expect(report.patientId).toEqual(patientId);
            expect(report.medicationDetails).toHaveLength(1);
            expect(report.medicationDetails[0].name).toBe('Lisinopril');
            expect(report.interventions.total).toBe(1);
            expect(report.interventions.byType['counseling']).toBe(1);
        });

        it('should handle notification scheduling for follow-ups and adherence', async () => {
            // Create follow-up
            const followUpData = {
                diagnosticRequestId,
                diagnosticResultId,
                patientId,
                type: 'medication_review' as const,
                priority: 'high' as const,
                description: 'High-priority medication review',
                scheduledDate: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
                assignedTo: pharmacistId
            };

            const followUp = await diagnosticFollowUpService.createFollowUp(
                workplaceId,
                followUpData,
                pharmacistId
            );

            // Schedule follow-up reminder
            await diagnosticNotificationService.scheduleFollowUpReminder(
                followUp._id,
                'email',
                new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now
            );

            // Verify reminder was added
            const updatedFollowUp = await DiagnosticFollowUp.findById(followUp._id);
            expect(updatedFollowUp!.reminders.length).toBeGreaterThan(2); // Default + scheduled

            // Create adherence tracking and trigger alert
            const trackingData = {
                patientId,
                medications: [{
                    medicationName: 'Lisinopril',
                    dosage: '10mg',
                    frequency: 'once daily',
                    prescribedDate: new Date()
                }]
            };

            const adherenceTracking = await adherenceService.createAdherenceTracking(
                workplaceId,
                trackingData,
                pharmacistId
            );

            // Create critical adherence alert
            adherenceTracking.createAlert({
                type: 'low_adherence',
                severity: 'critical',
                message: 'Critical adherence issue detected'
            });
            await adherenceTracking.save();

            // Schedule adherence alert notification
            const alert = adherenceTracking.alerts[0];
            await diagnosticNotificationService.scheduleAdherenceAlert(
                adherenceTracking._id,
                alert
            );

            // Verify alert was processed
            expect(alert.triggeredAt).toBeDefined();
            expect(alert.severity).toBe('critical');
        });

        it('should assess overall patient risk and coordinate care', async () => {
            // Create comprehensive patient scenario
            const diagnosticResult = await DiagnosticResult.findById(diagnosticResultId);

            // Auto-schedule follow-ups
            const followUps = await diagnosticFollowUpService.autoScheduleFollowUps(
                diagnosticResult!,
                pharmacistId
            );

            // Create adherence tracking
            const adherenceTracking = await adherenceService.createFromDiagnosticResult(
                diagnosticResult!,
                pharmacistId
            );

            // Assess patient adherence
            const assessment = await adherenceService.assessPatientAdherence(
                patientId,
                workplaceId
            );

            // Get follow-up analytics
            const analytics = await diagnosticFollowUpService.getFollowUpAnalytics(workplaceId);

            // Verify comprehensive care coordination
            expect(followUps.length).toBeGreaterThan(0);
            expect(adherenceTracking).toBeDefined();
            expect(assessment.riskLevel).toBe('medium'); // Based on high-risk diagnosis but no adherence data yet
            expect(analytics.totalFollowUps).toBe(followUps.length);

            // Verify high-risk patient gets appropriate follow-up frequency
            const highPriorityFollowUps = followUps.filter(f => f.priority === 'high');
            expect(highPriorityFollowUps.length).toBeGreaterThan(0);

            // Verify adherence monitoring frequency matches risk level
            expect(adherenceTracking!.monitoringFrequency).toBe('weekly'); // High risk = weekly
        });
    });

    describe('Error Handling and Edge Cases', () => {
        it('should handle missing diagnostic result gracefully', async () => {
            const nonExistentId = new mongoose.Types.ObjectId();

            await expect(
                diagnosticFollowUpService.autoScheduleFollowUps(
                    { _id: nonExistentId } as any,
                    pharmacistId
                )
            ).rejects.toThrow('Diagnostic request not found');
        });

        it('should handle duplicate adherence tracking creation', async () => {
            const trackingData = {
                patientId,
                medications: [{
                    medicationName: 'Lisinopril',
                    dosage: '10mg',
                    frequency: 'once daily',
                    prescribedDate: new Date()
                }]
            };

            // Create first tracking
            await adherenceService.createAdherenceTracking(
                workplaceId,
                trackingData,
                pharmacistId
            );

            // Try to create duplicate
            await expect(
                adherenceService.createAdherenceTracking(
                    workplaceId,
                    trackingData,
                    pharmacistId
                )
            ).rejects.toThrow('Adherence tracking already exists for this patient');
        });

        it('should handle follow-up completion without outcome', async () => {
            const followUpData = {
                diagnosticRequestId,
                diagnosticResultId,
                patientId,
                type: 'symptom_check' as const,
                description: 'Test follow-up',
                scheduledDate: new Date(),
                assignedTo: pharmacistId
            };

            const followUp = await diagnosticFollowUpService.createFollowUp(
                workplaceId,
                followUpData,
                pharmacistId
            );

            // Try to complete without proper outcome
            await expect(
                diagnosticFollowUpService.completeFollowUp(
                    followUp._id,
                    {} as any,
                    pharmacistId
                )
            ).rejects.toThrow();
        });

        it('should handle medication not found in adherence tracking', async () => {
            const trackingData = {
                patientId,
                medications: [{
                    medicationName: 'Lisinopril',
                    dosage: '10mg',
                    frequency: 'once daily',
                    prescribedDate: new Date()
                }]
            };

            await adherenceService.createAdherenceTracking(
                workplaceId,
                trackingData,
                pharmacistId
            );

            // Try to add refill for non-existent medication
            await expect(
                adherenceService.addRefill(
                    patientId,
                    workplaceId,
                    {
                        medicationName: 'NonExistentMed',
                        date: new Date(),
                        daysSupply: 30,
                        source: 'pharmacy'
                    }
                )
            ).rejects.toThrow('Medication NonExistentMed not found');
        });
    });
});