import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import adherenceService from '../services/adherenceService';
import AdherenceTracking from '../models/AdherenceTracking';
import DiagnosticResult from '../models/DiagnosticResult';
import Patient from '../../../models/Patient';
import User from '../../../models/User';
import Workplace from '../../../models/Workplace';

describe('AdherenceService', () => {
    let mongoServer: MongoMemoryServer;
    let workplaceId: mongoose.Types.ObjectId;
    let patientId: mongoose.Types.ObjectId;
    let pharmacistId: mongoose.Types.ObjectId;
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
    });

    describe('createAdherenceTracking', () => {
        it('should create adherence tracking successfully', async () => {
            const trackingData = {
                patientId,
                medications: [
                    {
                        medicationName: 'Lisinopril',
                        dosage: '10mg',
                        frequency: 'once daily',
                        prescribedDate: new Date()
                    },
                    {
                        medicationName: 'Metformin',
                        dosage: '500mg',
                        frequency: 'twice daily',
                        prescribedDate: new Date()
                    }
                ],
                monitoringFrequency: 'weekly' as const
            };

            const adherenceTracking = await adherenceService.createAdherenceTracking(
                workplaceId,
                trackingData,
                pharmacistId
            );

            expect(adherenceTracking).toBeDefined();
            expect(adherenceTracking.patientId).toEqual(patientId);
            expect(adherenceTracking.medications).toHaveLength(2);
            expect(adherenceTracking.monitoringFrequency).toBe('weekly');
            expect(adherenceTracking.overallAdherenceScore).toBe(0);
            expect(adherenceTracking.adherenceCategory).toBe('poor');
        });

        it('should throw error if tracking already exists', async () => {
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

            // Try to create second tracking for same patient
            await expect(
                adherenceService.createAdherenceTracking(
                    workplaceId,
                    trackingData,
                    pharmacistId
                )
            ).rejects.toThrow('Adherence tracking already exists for this patient');
        });

        it('should throw error for invalid patient', async () => {
            const trackingData = {
                patientId: new mongoose.Types.ObjectId(),
                medications: [{
                    medicationName: 'Lisinopril',
                    dosage: '10mg',
                    frequency: 'once daily',
                    prescribedDate: new Date()
                }]
            };

            await expect(
                adherenceService.createAdherenceTracking(
                    workplaceId,
                    trackingData,
                    pharmacistId
                )
            ).rejects.toThrow('Patient not found');
        });
    });

    describe('createFromDiagnosticResult', () => {
        beforeEach(async () => {
            // Create diagnostic result with medication suggestions
            const diagnosticResult = new DiagnosticResult({
                _id: diagnosticResultId,
                workplaceId,
                requestId: new mongoose.Types.ObjectId(),
                diagnoses: [{
                    condition: 'Hypertension',
                    probability: 0.85,
                    reasoning: 'Elevated blood pressure',
                    severity: 'medium',
                    confidence: 'high',
                    evidenceLevel: 'probable'
                }],
                medicationSuggestions: [
                    {
                        drugName: 'Lisinopril',
                        dosage: '10mg',
                        frequency: 'once daily',
                        duration: '30 days',
                        reasoning: 'First-line ACE inhibitor for hypertension',
                        safetyNotes: ['Monitor kidney function', 'Watch for dry cough']
                    },
                    {
                        drugName: 'Hydrochlorothiazide',
                        dosage: '25mg',
                        frequency: 'once daily',
                        duration: '30 days',
                        reasoning: 'Thiazide diuretic for blood pressure control',
                        safetyNotes: ['Monitor electrolytes', 'Watch for dehydration']
                    }
                ],
                differentialDiagnosis: ['Hypertension'],
                clinicalImpression: 'Likely hypertension',
                riskAssessment: {
                    overallRisk: 'medium',
                    riskFactors: ['elevated blood pressure']
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

        it('should create adherence tracking from diagnostic result', async () => {
            const diagnosticResult = await DiagnosticResult.findById(diagnosticResultId);

            const adherenceTracking = await adherenceService.createFromDiagnosticResult(
                diagnosticResult!,
                pharmacistId
            );

            expect(adherenceTracking).toBeDefined();
            expect(adherenceTracking!.medications).toHaveLength(2);
            expect(adherenceTracking!.medications[0].medicationName).toBe('Lisinopril');
            expect(adherenceTracking!.medications[1].medicationName).toBe('Hydrochlorothiazide');
            expect(adherenceTracking!.monitoringFrequency).toBe('biweekly'); // Medium risk
        });

        it('should return null if no medication suggestions', async () => {
            // Update diagnostic result to have no medication suggestions
            await DiagnosticResult.findByIdAndUpdate(diagnosticResultId, {
                medicationSuggestions: []
            });

            const diagnosticResult = await DiagnosticResult.findById(diagnosticResultId);

            const adherenceTracking = await adherenceService.createFromDiagnosticResult(
                diagnosticResult!,
                pharmacistId
            );

            expect(adherenceTracking).toBeNull();
        });
    });

    describe('addRefill', () => {
        let adherenceTrackingId: mongoose.Types.ObjectId;

        beforeEach(async () => {
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
            adherenceTrackingId = adherenceTracking._id;
        });

        it('should add refill successfully', async () => {
            const refillData = {
                medicationName: 'Lisinopril',
                date: new Date(),
                daysSupply: 30,
                source: 'pharmacy' as const,
                notes: 'Regular refill'
            };

            const updatedTracking = await adherenceService.addRefill(
                patientId,
                workplaceId,
                refillData
            );

            expect(updatedTracking.medications[0].refillHistory).toHaveLength(1);
            expect(updatedTracking.medications[0].lastRefillDate).toEqual(refillData.date);
            expect(updatedTracking.medications[0].daysSupply).toBe(30);
            expect(updatedTracking.medications[0].expectedRefillDate).toBeDefined();
        });

        it('should throw error for non-existent medication', async () => {
            const refillData = {
                medicationName: 'NonExistentMed',
                date: new Date(),
                daysSupply: 30,
                source: 'pharmacy' as const
            };

            await expect(
                adherenceService.addRefill(patientId, workplaceId, refillData)
            ).rejects.toThrow('Medication NonExistentMed not found');
        });
    });

    describe('updateMedicationAdherence', () => {
        let adherenceTrackingId: mongoose.Types.ObjectId;

        beforeEach(async () => {
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
            adherenceTrackingId = adherenceTracking._id;
        });

        it('should update medication adherence successfully', async () => {
            const adherenceData = {
                adherenceScore: 85,
                missedDoses: 2,
                totalDoses: 30
            };

            const updatedTracking = await adherenceService.updateMedicationAdherence(
                patientId,
                workplaceId,
                'Lisinopril',
                adherenceData
            );

            expect(updatedTracking.medications[0].adherenceScore).toBe(85);
            expect(updatedTracking.medications[0].adherenceStatus).toBe('good');
            expect(updatedTracking.medications[0].missedDoses).toBe(2);
            expect(updatedTracking.medications[0].totalDoses).toBe(30);
        });

        it('should update adherence status based on score', async () => {
            const testCases = [
                { score: 95, expectedStatus: 'excellent' },
                { score: 85, expectedStatus: 'good' },
                { score: 65, expectedStatus: 'fair' },
                { score: 45, expectedStatus: 'poor' }
            ];

            for (const testCase of testCases) {
                const updatedTracking = await adherenceService.updateMedicationAdherence(
                    patientId,
                    workplaceId,
                    'Lisinopril',
                    { adherenceScore: testCase.score }
                );

                expect(updatedTracking.medications[0].adherenceStatus).toBe(testCase.expectedStatus);
            }
        });
    });

    describe('assessPatientAdherence', () => {
        beforeEach(async () => {
            const trackingData = {
                patientId,
                medications: [
                    {
                        medicationName: 'Lisinopril',
                        dosage: '10mg',
                        frequency: 'once daily',
                        prescribedDate: new Date()
                    },
                    {
                        medicationName: 'Metformin',
                        dosage: '500mg',
                        frequency: 'twice daily',
                        prescribedDate: new Date()
                    }
                ]
            };

            const adherenceTracking = await adherenceService.createAdherenceTracking(
                workplaceId,
                trackingData,
                pharmacistId
            );

            // Update medication adherence scores
            await adherenceService.updateMedicationAdherence(
                patientId,
                workplaceId,
                'Lisinopril',
                { adherenceScore: 90 }
            );

            await adherenceService.updateMedicationAdherence(
                patientId,
                workplaceId,
                'Metformin',
                { adherenceScore: 60 }
            );
        });

        it('should assess patient adherence correctly', async () => {
            const assessment = await adherenceService.assessPatientAdherence(
                patientId,
                workplaceId
            );

            expect(assessment.patientId).toEqual(patientId);
            expect(assessment.overallScore).toBe(75); // Average of 90 and 60
            expect(assessment.category).toBe('fair');
            expect(assessment.riskLevel).toBe('medium');
            expect(assessment.medicationsAtRisk).toHaveLength(1); // Metformin with 60% adherence
            expect(assessment.recommendations).toContain('Consider medication adherence counseling');
        });

        it('should provide appropriate recommendations', async () => {
            // Update to poor adherence
            await adherenceService.updateMedicationAdherence(
                patientId,
                workplaceId,
                'Lisinopril',
                { adherenceScore: 50 }
            );

            await adherenceService.updateMedicationAdherence(
                patientId,
                workplaceId,
                'Metformin',
                { adherenceScore: 40 }
            );

            const assessment = await adherenceService.assessPatientAdherence(
                patientId,
                workplaceId
            );

            expect(assessment.riskLevel).toBe('high');
            expect(assessment.recommendations).toContain('Consider medication adherence counseling');
            expect(assessment.recommendations).toContain('Focus on high-risk medications');
        });
    });

    describe('checkAdherenceAlerts', () => {
        let adherenceTracking: any;

        beforeEach(async () => {
            const trackingData = {
                patientId,
                medications: [{
                    medicationName: 'Lisinopril',
                    dosage: '10mg',
                    frequency: 'once daily',
                    prescribedDate: new Date(),
                    expectedRefillDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
                    adherenceScore: 50 // Poor adherence
                }]
            };

            adherenceTracking = await adherenceService.createAdherenceTracking(
                workplaceId,
                trackingData,
                pharmacistId
            );

            // Manually set medication properties for testing
            adherenceTracking.medications[0].expectedRefillDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
            adherenceTracking.medications[0].adherenceScore = 50;
            await adherenceTracking.save();
        });

        it('should create alerts for missed refills', async () => {
            await adherenceService.checkAdherenceAlerts(adherenceTracking);

            const updatedTracking = await AdherenceTracking.findById(adherenceTracking._id);
            const missedRefillAlerts = updatedTracking!.alerts.filter(alert => alert.type === 'missed_refill');

            expect(missedRefillAlerts).toHaveLength(1);
            expect(missedRefillAlerts[0].severity).toBe('medium'); // 5 days overdue
            expect(missedRefillAlerts[0].message).toContain('Lisinopril refill is 5 days overdue');
        });

        it('should create alerts for low adherence', async () => {
            await adherenceService.checkAdherenceAlerts(adherenceTracking);

            const updatedTracking = await AdherenceTracking.findById(adherenceTracking._id);
            const lowAdherenceAlerts = updatedTracking!.alerts.filter(alert => alert.type === 'low_adherence');

            expect(lowAdherenceAlerts).toHaveLength(1);
            expect(lowAdherenceAlerts[0].severity).toBe('critical'); // Score < 50
            expect(lowAdherenceAlerts[0].message).toContain('Low adherence detected for Lisinopril (50%)');
        });

        it('should create alerts for medication gaps', async () => {
            // Add refill history with gaps
            adherenceTracking.medications[0].refillHistory = [
                {
                    date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
                    daysSupply: 30,
                    source: 'pharmacy'
                },
                {
                    date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago (10-day gap)
                    daysSupply: 30,
                    source: 'pharmacy'
                }
            ];
            await adherenceTracking.save();

            await adherenceService.checkAdherenceAlerts(adherenceTracking);

            const updatedTracking = await AdherenceTracking.findById(adherenceTracking._id);
            const gapAlerts = updatedTracking!.alerts.filter(alert => alert.type === 'medication_gap');

            expect(gapAlerts).toHaveLength(1);
            expect(gapAlerts[0].message).toContain('10-day gap detected in Lisinopril therapy');
        });
    });

    describe('addIntervention', () => {
        let adherenceTrackingId: mongoose.Types.ObjectId;

        beforeEach(async () => {
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
            adherenceTrackingId = adherenceTracking._id;
        });

        it('should add intervention successfully', async () => {
            const intervention = {
                type: 'counseling' as const,
                description: 'Provided medication adherence counseling',
                expectedOutcome: 'Improved adherence to >80%',
                notes: 'Patient understood importance of daily medication'
            };

            const updatedTracking = await adherenceService.addIntervention(
                patientId,
                workplaceId,
                intervention,
                pharmacistId
            );

            expect(updatedTracking.interventions).toHaveLength(1);
            expect(updatedTracking.interventions[0].type).toBe('counseling');
            expect(updatedTracking.interventions[0].implementedBy).toEqual(pharmacistId);
            expect(updatedTracking.interventions[0].implementedAt).toBeDefined();
        });
    });

    describe('generateAdherenceReport', () => {
        beforeEach(async () => {
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

            // Add some test data
            await adherenceService.updateMedicationAdherence(
                patientId,
                workplaceId,
                'Lisinopril',
                { adherenceScore: 85 }
            );

            await adherenceService.addIntervention(
                patientId,
                workplaceId,
                {
                    type: 'counseling',
                    description: 'Adherence counseling',
                    expectedOutcome: 'Improved adherence'
                },
                pharmacistId
            );
        });

        it('should generate comprehensive adherence report', async () => {
            const reportPeriod = {
                start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
                end: new Date()
            };

            const report = await adherenceService.generateAdherenceReport(
                patientId,
                workplaceId,
                reportPeriod
            );

            expect(report.patientId).toEqual(patientId);
            expect(report.overallAdherence).toBe(85);
            expect(report.medicationDetails).toHaveLength(1);
            expect(report.medicationDetails[0].name).toBe('Lisinopril');
            expect(report.medicationDetails[0].adherenceScore).toBe(85);
            expect(report.interventions.total).toBe(1);
            expect(report.interventions.byType['counseling']).toBe(1);
        });
    });

    describe('getPatientsWithPoorAdherence', () => {
        beforeEach(async () => {
            // Create multiple patients with different adherence levels
            const patients = [
                { patientId: new mongoose.Types.ObjectId(), adherenceScore: 95 },
                { patientId: new mongoose.Types.ObjectId(), adherenceScore: 65 },
                { patientId: new mongoose.Types.ObjectId(), adherenceScore: 45 }
            ];

            for (const patientData of patients) {
                // Create patient
                const patient = new Patient({
                    _id: patientData.patientId,
                    workplaceId,
                    firstName: 'Test',
                    lastName: 'Patient',
                    dateOfBirth: new Date('1990-01-01'),
                    gender: 'male',
                    mrn: `TEST${patientData.patientId.toString().slice(-3)}`,
                    createdBy: pharmacistId
                });
                await patient.save();

                // Create adherence tracking
                const trackingData = {
                    patientId: patientData.patientId,
                    medications: [{
                        medicationName: 'TestMed',
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

                // Update adherence score
                adherenceTracking.overallAdherenceScore = patientData.adherenceScore;
                adherenceTracking.adherenceCategory = patientData.adherenceScore >= 80 ? 'good' : 'poor';
                await adherenceTracking.save();
            }
        });

        it('should get patients with poor adherence', async () => {
            const poorAdherencePatients = await adherenceService.getPatientsWithPoorAdherence(
                workplaceId,
                70 // Threshold
            );

            expect(poorAdherencePatients).toHaveLength(2); // 65% and 45% adherence
            poorAdherencePatients.forEach(tracking => {
                expect(tracking.overallAdherenceScore).toBeLessThan(70);
            });
        });

        it('should respect custom threshold', async () => {
            const poorAdherencePatients = await adherenceService.getPatientsWithPoorAdherence(
                workplaceId,
                50 // Lower threshold
            );

            expect(poorAdherencePatients).toHaveLength(1); // Only 45% adherence
        });
    });

    describe('processAdherenceAssessments', () => {
        beforeEach(async () => {
            const trackingData = {
                patientId,
                medications: [{
                    medicationName: 'Lisinopril',
                    dosage: '10mg',
                    frequency: 'once daily',
                    prescribedDate: new Date()
                }],
                monitoringFrequency: 'daily' as const
            };

            const adherenceTracking = await adherenceService.createAdherenceTracking(
                workplaceId,
                trackingData,
                pharmacistId
            );

            // Set next assessment date to past
            adherenceTracking.nextAssessmentDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
            await adherenceTracking.save();
        });

        it('should process due assessments', async () => {
            await adherenceService.processAdherenceAssessments();

            const updatedTracking = await AdherenceTracking.findOne({ patientId });

            expect(updatedTracking!.nextAssessmentDate.getTime()).toBeGreaterThan(Date.now());
            expect(updatedTracking!.lastAssessmentDate.getTime()).toBeGreaterThan(Date.now() - 60000); // Within last minute
        });
    });
});