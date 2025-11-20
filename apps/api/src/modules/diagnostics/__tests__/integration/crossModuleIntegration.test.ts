import mongoose from 'mongoose';
import request from 'supertest';
import { app } from '../../../app';
import DiagnosticRequest from '../../models/DiagnosticRequest';
import DiagnosticResult from '../../models/DiagnosticResult';
import ClinicalNote from '../../../models/ClinicalNote';
import MedicationTherapyReview from '../../../models/MedicationTherapyReview';
import Patient from '../../../models/Patient';
import User from '../../../models/User';
import Workplace from '../../../models/Workplace';
import DiagnosticIntegrationService from '../../services/integrationService';

describe('Cross-Module Integration Tests', () => {
    let testUser: any;
    let testWorkplace: any;
    let testPatient: any;
    let testDiagnosticRequest: any;
    let testDiagnosticResult: any;
    let authToken: string;

    beforeAll(async () => {
        // Create test workplace
        testWorkplace = await Workplace.create({
            name: 'Test Pharmacy',
            address: '123 Test St',
            phone: '555-0123',
            email: 'test@pharmacy.com',
            licenseNumber: 'TEST123',
            subscriptionPlan: 'professional',
            isActive: true,
        });

        // Create test user
        testUser = await User.create({
            email: 'pharmacist@test.com',
            password: 'password123',
            firstName: 'Test',
            lastName: 'Pharmacist',
            role: 'pharmacist',
            workplaceId: testWorkplace._id,
            isActive: true,
            isEmailVerified: true,
        });

        // Create test patient
        testPatient = await Patient.create({
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: new Date('1980-01-01'),
            gender: 'male',
            phone: '555-0123',
            email: 'john.doe@test.com',
            workplaceId: testWorkplace._id,
            createdBy: testUser._id,
        });

        // Get auth token
        const loginResponse = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'pharmacist@test.com',
                password: 'password123',
            });

        authToken = loginResponse.body.data.token;

        // Create test diagnostic request
        testDiagnosticRequest = await DiagnosticRequest.create({
            patientId: testPatient._id,
            pharmacistId: testUser._id,
            workplaceId: testWorkplace._id,
            inputSnapshot: {
                symptoms: {
                    subjective: ['headache', 'nausea'],
                    objective: ['elevated blood pressure'],
                    duration: '2 days',
                    severity: 'moderate',
                    onset: 'acute',
                },
                vitals: {
                    bloodPressure: '150/90',
                    heartRate: 85,
                    temperature: 98.6,
                },
                currentMedications: [
                    {
                        name: 'Lisinopril',
                        dosage: '10mg',
                        frequency: 'daily',
                    },
                ],
                allergies: ['penicillin'],
            },
            clinicalContext: {
                chiefComplaint: 'Headache and high blood pressure',
                presentingSymptoms: ['headache', 'nausea'],
                relevantHistory: 'History of hypertension',
            },
            consentObtained: true,
            consentTimestamp: new Date(),
            status: 'completed',
            priority: 'medium',
            createdBy: testUser._id,
            updatedBy: testUser._id,
        });

        // Create test diagnostic result
        testDiagnosticResult = await DiagnosticResult.create({
            requestId: testDiagnosticRequest._id,
            workplaceId: testWorkplace._id,
            diagnoses: [
                {
                    condition: 'Hypertensive Crisis',
                    probability: 0.85,
                    reasoning: 'Elevated blood pressure with symptoms',
                    severity: 'high',
                    icdCode: 'I16.9',
                },
                {
                    condition: 'Medication Non-adherence',
                    probability: 0.65,
                    reasoning: 'Possible inadequate blood pressure control',
                    severity: 'medium',
                },
            ],
            medicationSuggestions: [
                {
                    drugName: 'Amlodipine',
                    dosage: '5mg',
                    frequency: 'daily',
                    duration: 'ongoing',
                    reasoning: 'Additional antihypertensive needed',
                    safetyNotes: ['Monitor for ankle swelling'],
                    rxcui: '197361',
                },
            ],
            redFlags: [
                {
                    flag: 'Severe Hypertension',
                    severity: 'high',
                    action: 'Immediate medical attention required',
                },
            ],
            referralRecommendation: {
                recommended: true,
                urgency: 'within_24h',
                specialty: 'Cardiology',
                reason: 'Uncontrolled hypertension requiring specialist evaluation',
            },
            aiMetadata: {
                modelId: 'deepseek-v3.1',
                modelVersion: '1.0',
                confidenceScore: 0.85,
                processingTime: 15000,
                tokenUsage: {
                    promptTokens: 500,
                    completionTokens: 300,
                    totalTokens: 800,
                },
                requestId: 'test-request-id',
            },
            rawResponse: 'Test AI response',
            disclaimer: 'AI-generated recommendations require pharmacist review',
            createdBy: testUser._id,
            updatedBy: testUser._id,
        });
    });

    afterAll(async () => {
        // Clean up test data
        await DiagnosticResult.deleteMany({});
        await DiagnosticRequest.deleteMany({});
        await ClinicalNote.deleteMany({});
        await MedicationTherapyReview.deleteMany({});
        await Patient.deleteMany({});
        await User.deleteMany({});
        await Workplace.deleteMany({});
    });

    describe('Clinical Note Integration', () => {
        it('should create clinical note from diagnostic results', async () => {
            const response = await request(app)
                .post('/api/diagnostics/integration/clinical-note')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    diagnosticRequestId: testDiagnosticRequest._id.toString(),
                    diagnosticResultId: testDiagnosticResult._id.toString(),
                    patientId: testPatient._id.toString(),
                    noteData: {
                        title: 'Hypertension Assessment',
                        type: 'consultation',
                        priority: 'high',
                        followUpRequired: true,
                    },
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.clinicalNote).toBeDefined();

            const clinicalNote = response.body.data.clinicalNote;
            expect(clinicalNote.title).toBe('Hypertension Assessment');
            expect(clinicalNote.type).toBe('consultation');
            expect(clinicalNote.priority).toBe('high');
            expect(clinicalNote.followUpRequired).toBe(true);
            expect(clinicalNote.content.assessment).toContain('Hypertensive Crisis');
            expect(clinicalNote.recommendations).toContain('Consider Amlodipine 5mg daily');
        });

        it('should create clinical note with auto-generated content from diagnostic data', async () => {
            const response = await request(app)
                .post('/api/diagnostics/integration/clinical-note')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    diagnosticRequestId: testDiagnosticRequest._id.toString(),
                    diagnosticResultId: testDiagnosticResult._id.toString(),
                    patientId: testPatient._id.toString(),
                });

            expect(response.status).toBe(201);
            const clinicalNote = response.body.data.clinicalNote;

            // Check SOAP note structure
            expect(clinicalNote.content.subjective).toContain('headache');
            expect(clinicalNote.content.objective).toContain('BP: 150/90');
            expect(clinicalNote.content.assessment).toContain('Hypertensive Crisis');
            expect(clinicalNote.content.plan).toContain('Amlodipine');
            expect(clinicalNote.tags).toContain('diagnostic');
            expect(clinicalNote.tags).toContain('ai-assisted');
        });
    });

    describe('MTR Integration', () => {
        it('should create MTR from diagnostic results', async () => {
            const response = await request(app)
                .post('/api/diagnostics/integration/mtr')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    diagnosticRequestId: testDiagnosticRequest._id.toString(),
                    diagnosticResultId: testDiagnosticResult._id.toString(),
                    patientId: testPatient._id.toString(),
                    mtrData: {
                        priority: 'urgent',
                        reviewReason: 'Hypertension management optimization',
                    },
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.mtr).toBeDefined();

            const mtr = response.body.data.mtr;
            expect(mtr.priority).toBe('urgent');
            expect(mtr.reviewType).toBe('targeted');
            expect(mtr.reviewReason).toContain('Hypertension management optimization');
            expect(mtr.steps.patientSelection.completed).toBe(true);
            expect(mtr.steps.patientSelection.data.source).toBe('diagnostic_assessment');
        });

        it('should enrich existing MTR with diagnostic data', async () => {
            // First create an MTR
            const existingMTR = await MedicationTherapyReview.create({
                workplaceId: testWorkplace._id,
                patientId: testPatient._id,
                pharmacistId: testUser._id,
                reviewNumber: 'MTR-TEST-001',
                status: 'in_progress',
                priority: 'routine',
                reviewType: 'initial',
                reviewReason: 'Routine medication review',
                patientConsent: true,
                confidentialityAgreed: true,
                steps: {
                    patientSelection: { completed: true, completedAt: new Date() },
                    medicationHistory: { completed: false },
                    therapyAssessment: { completed: false },
                    planDevelopment: { completed: false },
                    interventions: { completed: false },
                    followUp: { completed: false },
                },
                createdBy: testUser._id,
                updatedBy: testUser._id,
            });

            const response = await request(app)
                .post(`/api/diagnostics/integration/mtr/${existingMTR._id}/enrich`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    diagnosticRequestId: testDiagnosticRequest._id.toString(),
                    diagnosticResultId: testDiagnosticResult._id.toString(),
                    patientId: testPatient._id.toString(),
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            const enrichedMTR = response.body.data.mtr;
            expect(enrichedMTR.reviewReason).toContain('Diagnostic findings: Hypertensive Crisis');
            expect(enrichedMTR.priority).toBe('high_risk'); // Should be upgraded due to critical flags
            expect(enrichedMTR.steps.therapyAssessment.data.diagnosticFindings).toBeDefined();
        });
    });

    describe('Patient Timeline Integration', () => {
        beforeEach(async () => {
            // Create some test clinical notes and MTRs for timeline
            await ClinicalNote.create({
                patient: testPatient._id,
                pharmacist: testUser._id,
                workplaceId: testWorkplace._id,
                type: 'consultation',
                title: 'Previous Consultation',
                content: {
                    subjective: 'Patient reports feeling better',
                    objective: 'BP: 140/85',
                    assessment: 'Improved blood pressure control',
                    plan: 'Continue current medications',
                },
                medications: [],
                laborResults: [],
                recommendations: ['Continue Lisinopril'],
                followUpRequired: false,
                attachments: [],
                priority: 'medium',
                isConfidential: false,
                tags: ['hypertension'],
                createdBy: testUser._id,
                lastModifiedBy: testUser._id,
            });
        });

        it('should get unified patient timeline with all event types', async () => {
            const response = await request(app)
                .get(`/api/diagnostics/integration/timeline/${testPatient._id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .query({ limit: 10 });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.timeline).toBeDefined();
            expect(Array.isArray(response.body.data.timeline)).toBe(true);

            const timeline = response.body.data.timeline;
            expect(timeline.length).toBeGreaterThan(0);

            // Should contain diagnostic events
            const diagnosticEvents = timeline.filter((event: any) => event.type === 'diagnostic');
            expect(diagnosticEvents.length).toBeGreaterThan(0);

            // Should contain clinical note events
            const clinicalNoteEvents = timeline.filter((event: any) => event.type === 'clinical_note');
            expect(clinicalNoteEvents.length).toBeGreaterThan(0);

            // Events should be sorted by date (most recent first)
            for (let i = 1; i < timeline.length; i++) {
                const prevDate = new Date(timeline[i - 1].date);
                const currDate = new Date(timeline[i].date);
                expect(prevDate.getTime()).toBeGreaterThanOrEqual(currDate.getTime());
            }
        });

        it('should filter timeline by date range', async () => {
            const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
            const endDate = new Date();

            const response = await request(app)
                .get(`/api/diagnostics/integration/timeline/${testPatient._id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .query({
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    limit: 20,
                });

            expect(response.status).toBe(200);
            const timeline = response.body.data.timeline;

            // All events should be within the date range
            timeline.forEach((event: any) => {
                const eventDate = new Date(event.date);
                expect(eventDate.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
                expect(eventDate.getTime()).toBeLessThanOrEqual(endDate.getTime());
            });
        });
    });

    describe('Cross-Reference Integration', () => {
        beforeEach(async () => {
            // Create related clinical notes with similar symptoms
            await ClinicalNote.create({
                patient: testPatient._id,
                pharmacist: testUser._id,
                workplaceId: testWorkplace._id,
                type: 'consultation',
                title: 'Headache Follow-up',
                content: {
                    subjective: 'Patient reports persistent headache',
                    objective: 'Alert and oriented',
                    assessment: 'Tension headache',
                    plan: 'OTC pain relief',
                },
                medications: [],
                laborResults: [],
                recommendations: ['Acetaminophen as needed'],
                followUpRequired: true,
                attachments: [],
                priority: 'low',
                isConfidential: false,
                tags: ['headache'],
                createdBy: testUser._id,
                lastModifiedBy: testUser._id,
            });

            // Create related MTR with overlapping medications
            await MedicationTherapyReview.create({
                workplaceId: testWorkplace._id,
                patientId: testPatient._id,
                pharmacistId: testUser._id,
                reviewNumber: 'MTR-TEST-002',
                status: 'completed',
                priority: 'routine',
                reviewType: 'annual',
                reviewReason: 'Annual medication review',
                medications: [
                    {
                        drugName: 'Lisinopril',
                        genericName: 'Lisinopril',
                        strength: { value: 10, unit: 'mg' },
                        dosageForm: 'tablet',
                        instructions: {
                            dose: '10mg',
                            frequency: 'daily',
                            route: 'oral',
                        },
                        category: 'prescribed',
                        startDate: new Date(),
                        indication: 'Hypertension',
                    },
                ],
                patientConsent: true,
                confidentialityAgreed: true,
                steps: {
                    patientSelection: { completed: true, completedAt: new Date() },
                    medicationHistory: { completed: true, completedAt: new Date() },
                    therapyAssessment: { completed: true, completedAt: new Date() },
                    planDevelopment: { completed: true, completedAt: new Date() },
                    interventions: { completed: true, completedAt: new Date() },
                    followUp: { completed: true, completedAt: new Date() },
                },
                createdBy: testUser._id,
                updatedBy: testUser._id,
            });
        });

        it('should cross-reference diagnostic data with existing records', async () => {
            const response = await request(app)
                .get(`/api/diagnostics/integration/cross-reference/${testDiagnosticRequest._id}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            const crossRef = response.body.data;
            expect(crossRef.relatedClinicalNotes).toBeDefined();
            expect(crossRef.relatedMTRs).toBeDefined();
            expect(crossRef.correlations).toBeDefined();

            // Should find symptom correlations
            const symptomCorrelations = crossRef.correlations.filter(
                (c: any) => c.type === 'symptom_match'
            );
            expect(symptomCorrelations.length).toBeGreaterThan(0);

            // Should find medication correlations
            const medicationCorrelations = crossRef.correlations.filter(
                (c: any) => c.type === 'medication_match'
            );
            expect(medicationCorrelations.length).toBeGreaterThan(0);

            // Correlations should have confidence scores
            crossRef.correlations.forEach((correlation: any) => {
                expect(correlation.confidence).toBeGreaterThan(0);
                expect(correlation.confidence).toBeLessThanOrEqual(1);
            });
        });

        it('should get integration options with recommendations', async () => {
            const response = await request(app)
                .get(`/api/diagnostics/integration/options/${testDiagnosticRequest._id}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            const options = response.body.data;
            expect(options.canCreateClinicalNote).toBe(true);
            expect(options.canCreateMTR).toBe(true);
            expect(options.existingMTRs).toBeDefined();
            expect(options.correlations).toBeDefined();
            expect(options.recommendations).toBeDefined();
            expect(Array.isArray(options.recommendations)).toBe(true);
        });
    });

    describe('Integration Service Unit Tests', () => {
        it('should build clinical note content from diagnostic data', async () => {
            const integrationData = {
                diagnosticRequestId: testDiagnosticRequest._id,
                diagnosticResultId: testDiagnosticResult._id,
                patientId: testPatient._id,
                pharmacistId: testUser._id,
                workplaceId: testWorkplace._id,
            };

            const clinicalNote = await DiagnosticIntegrationService.createClinicalNoteFromDiagnostic(
                integrationData
            );

            expect(clinicalNote).toBeDefined();
            expect(clinicalNote.patient.toString()).toBe(testPatient._id.toString());
            expect(clinicalNote.pharmacist.toString()).toBe(testUser._id.toString());
            expect(clinicalNote.workplaceId.toString()).toBe(testWorkplace._id.toString());
            expect(clinicalNote.content.subjective).toContain('headache');
            expect(clinicalNote.content.objective).toContain('BP: 150/90');
            expect(clinicalNote.content.assessment).toContain('Hypertensive Crisis');
            expect(clinicalNote.priority).toBe('high'); // Should be high due to critical red flags
            expect(clinicalNote.followUpRequired).toBe(true); // Should be true due to referral recommendation
        });

        it('should create MTR with diagnostic context', async () => {
            const integrationData = {
                diagnosticRequestId: testDiagnosticRequest._id,
                diagnosticResultId: testDiagnosticResult._id,
                patientId: testPatient._id,
                pharmacistId: testUser._id,
                workplaceId: testWorkplace._id,
            };

            const mtr = await DiagnosticIntegrationService.createMTRFromDiagnostic(integrationData);

            expect(mtr).toBeDefined();
            expect(mtr.patientId.toString()).toBe(testPatient._id.toString());
            expect(mtr.pharmacistId.toString()).toBe(testUser._id.toString());
            expect(mtr.workplaceId.toString()).toBe(testWorkplace._id.toString());
            expect(mtr.reviewType).toBe('targeted');
            expect(mtr.priority).toBe('high_risk'); // Should be high_risk due to critical red flags
            expect(mtr.reviewReason).toContain('Hypertensive Crisis');
            expect(mtr.steps.patientSelection.completed).toBe(true);
            expect(mtr.steps.patientSelection.data.source).toBe('diagnostic_assessment');
        });

        it('should find correlations between diagnostic and existing records', async () => {
            const crossRef = await DiagnosticIntegrationService.crossReferenceWithExistingRecords(
                testDiagnosticRequest._id
            );

            expect(crossRef).toBeDefined();
            expect(crossRef.relatedClinicalNotes).toBeDefined();
            expect(crossRef.relatedMTRs).toBeDefined();
            expect(crossRef.correlations).toBeDefined();
            expect(Array.isArray(crossRef.correlations)).toBe(true);
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid diagnostic request ID', async () => {
            const invalidId = new mongoose.Types.ObjectId();

            const response = await request(app)
                .post('/api/diagnostics/integration/clinical-note')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    diagnosticRequestId: invalidId.toString(),
                    patientId: testPatient._id.toString(),
                });

            expect(response.status).toBe(500);
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toContain('Diagnostic request not found');
        });

        it('should handle missing required fields', async () => {
            const response = await request(app)
                .post('/api/diagnostics/integration/clinical-note')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    diagnosticRequestId: testDiagnosticRequest._id.toString(),
                    // Missing patientId
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error.code).toBe('MISSING_REQUIRED_FIELDS');
        });

        it('should handle invalid ObjectId format', async () => {
            const response = await request(app)
                .post('/api/diagnostics/integration/clinical-note')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    diagnosticRequestId: 'invalid-id',
                    patientId: testPatient._id.toString(),
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error.code).toBe('INVALID_OBJECT_ID');
        });
    });
});