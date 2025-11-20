import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import MedicationTherapyReview from '../../models/MedicationTherapyReview';
import DrugTherapyProblem from '../../models/DrugTherapyProblem';
import MTRIntervention from '../../models/MTRIntervention';
import MTRFollowUp from '../../models/MTRFollowUp';
import Patient from '../../models/Patient';
import User from '../../models/User';
import Workplace from '../../models/Workplace';
import SubscriptionPlan from '../../models/SubscriptionPlan';

// Create a test app with all middleware
const createTestApp = () => {
    const app = express();
    app.use(express.json());

    // Mock auth middleware
    app.use((req: any, res, next) => {
        req.user = {
            _id: testUtils.createObjectId(),
            workplaceId: testUtils.createObjectId(),
            role: 'pharmacist'
        };
        next();
    });

    return app;
};

describe('MTR Integration Tests', () => {
    let app: express.Application;
    let workplace: any;
    let user: any;
    let patient: any;

    beforeEach(async () => {
        app = createTestApp();

        // Create test subscription plan
        const subscriptionPlan = await SubscriptionPlan.create({
            name: 'Basic Plan',
            tier: 'basic',
            priceNGN: 15000,
            billingInterval: 'monthly',
            description: 'Basic plan for testing',
            features: {
                patientLimit: 100,
                reminderSmsMonthlyLimit: 50,
                reportsExport: true,
                careNoteExport: true,
                adrModule: false,
                multiUserSupport: true,
                teamSize: 5,
                apiAccess: false,
                auditLogs: false,
                dataBackup: true,
                clinicalNotesLimit: null,
                prioritySupport: false,
                emailReminders: true,
                smsReminders: true,
                advancedReports: false,
                drugTherapyManagement: true,
                teamManagement: true,
                dedicatedSupport: false,
                adrReporting: false,
                drugInteractionChecker: true,
                doseCalculator: true,
                multiLocationDashboard: false,
                sharedPatientRecords: false,
                groupAnalytics: false,
                cdss: false
            }
        });

        // Create test workplace
        workplace = await Workplace.create({
            name: 'Test Pharmacy',
            type: 'Community',
            licenseNumber: 'LIC123456',
            email: 'test@pharmacy.com',
            address: '123 Test St, Test City, Lagos 12345',
            state: 'Lagos',
            ownerId: testUtils.createObjectId(),
            verificationStatus: 'verified',
            documents: [],
            inviteCode: 'TEST123',
            teamMembers: []
        });

        // Create test user
        user = await User.create({
            workplaceId: workplace._id,
            firstName: 'Test',
            lastName: 'Pharmacist',
            email: 'pharmacist@test.com',
            passwordHash: 'hashedpassword',
            role: 'pharmacist',
            currentPlanId: subscriptionPlan._id,
            status: 'active'
        });

        // Create test patient
        patient = await Patient.create({
            workplaceId: workplace._id,
            firstName: 'John',
            lastName: 'Doe',
            mrn: 'MRN123456',
            dob: new Date('1980-01-01'),
            phone: '+2348012345678',
            createdBy: user._id
        });

        // Update mock middleware to use actual IDs
        app.use((req: any, res, next) => {
            req.user = {
                _id: user._id,
                workplaceId: workplace._id,
                role: 'pharmacist'
            };
            next();
        });
    });

    describe('Complete MTR Workflow', () => {
        it('should complete full MTR workflow from creation to completion', async () => {
            // Step 1: Create MTR session
            const createResponse = await request(app)
                .post('/api/mtr')
                .send({
                    patientId: patient._id.toString(),
                    priority: 'routine',
                    reviewType: 'initial',
                    patientConsent: true,
                    confidentialityAgreed: true
                });

            expect(createResponse.status).toBe(201);
            const mtrId = createResponse.body.data.session._id;

            // Step 2: Add medications
            const medications = [
                {
                    drugName: 'Warfarin',
                    strength: { value: 5, unit: 'mg' },
                    dosageForm: 'tablet',
                    instructions: {
                        dose: '5 mg',
                        frequency: 'once daily',
                        route: 'oral'
                    },
                    category: 'prescribed',
                    startDate: new Date(),
                    indication: 'Anticoagulation'
                },
                {
                    drugName: 'Aspirin',
                    strength: { value: 81, unit: 'mg' },
                    dosageForm: 'tablet',
                    instructions: {
                        dose: '81 mg',
                        frequency: 'once daily',
                        route: 'oral'
                    },
                    category: 'prescribed',
                    startDate: new Date(),
                    indication: 'Cardioprotection'
                }
            ];

            // Update MTR with medications
            const mtr = await MedicationTherapyReview.findById(mtrId);
            mtr!.medications = medications as any;
            await mtr!.save();

            // Complete medication history step
            await request(app)
                .put(`/api/mtr/${mtrId}/step/medicationHistory`)
                .send({
                    completed: true,
                    data: { medicationsCollected: medications.length }
                });

            // Step 3: Identify drug therapy problems
            const problemResponse = await request(app)
                .post(`/api/mtr/${mtrId}/problems`)
                .send({
                    category: 'safety',
                    type: 'interaction',
                    severity: 'major',
                    description: 'Drug interaction between warfarin and aspirin causing increased bleeding risk',
                    clinicalSignificance: 'Additive anticoagulant effects increase the risk of bleeding complications',
                    evidenceLevel: 'definite',
                    affectedMedications: ['Warfarin', 'Aspirin']
                });

            expect(problemResponse.status).toBe(201);

            // Complete therapy assessment step
            await request(app)
                .put(`/api/mtr/${mtrId}/step/therapyAssessment`)
                .send({
                    completed: true,
                    data: { interactionsChecked: true, problemsIdentified: 1 }
                });

            // Step 4: Develop therapy plan
            const updatedMtr = await MedicationTherapyReview.findById(mtrId);
            updatedMtr!.plan = {
                problems: [problemResponse.body.data.problem._id],
                recommendations: [{
                    type: 'discontinue',
                    medication: 'Aspirin',
                    rationale: 'High bleeding risk with concurrent warfarin therapy',
                    priority: 'high',
                    expectedOutcome: 'Reduced bleeding risk while maintaining anticoagulation'
                }],
                monitoringPlan: [{
                    parameter: 'INR',
                    frequency: 'Weekly',
                    targetValue: '2.0-3.0',
                    notes: 'Monitor closely after aspirin discontinuation'
                }],
                counselingPoints: ['Discuss bleeding precautions', 'Review signs of bleeding'],
                goals: [{
                    description: 'Maintain therapeutic anticoagulation without bleeding complications',
                    targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    achieved: false
                }],
                timeline: '2 weeks',
                pharmacistNotes: 'Patient counseled on bleeding risks and aspirin discontinuation'
            };
            await updatedMtr!.save();

            // Complete plan development step
            await request(app)
                .put(`/api/mtr/${mtrId}/step/planDevelopment`)
                .send({
                    completed: true,
                    data: { planCreated: true, recommendationsCount: 1 }
                });

            // Step 5: Record interventions
            const interventionResponse = await request(app)
                .post(`/api/mtr/${mtrId}/interventions`)
                .send({
                    type: 'recommendation',
                    category: 'medication_change',
                    description: 'Recommend discontinuing aspirin due to bleeding risk with concurrent warfarin therapy',
                    rationale: 'Patient has high bleeding risk with concurrent warfarin therapy and aspirin provides minimal additional benefit',
                    targetAudience: 'prescriber',
                    communicationMethod: 'phone',
                    documentation: 'Called Dr. Smith at 2:00 PM to discuss discontinuing aspirin. Dr. Smith agreed to stop aspirin and will reassess in 2 weeks.',
                    priority: 'high',
                    urgency: 'within_24h',
                    followUpRequired: true
                });

            expect(interventionResponse.status).toBe(201);

            // Complete interventions step
            await request(app)
                .put(`/api/mtr/${mtrId}/step/interventions`)
                .send({
                    completed: true,
                    data: { interventionsRecorded: 1 }
                });

            // Step 6: Schedule follow-up
            const followUpResponse = await request(app)
                .post(`/api/mtr/${mtrId}/followups`)
                .send({
                    type: 'phone_call',
                    description: 'Follow-up call to assess bleeding status and INR results after aspirin discontinuation',
                    scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                    objectives: ['Check for bleeding symptoms', 'Review INR results', 'Assess adherence to warfarin'],
                    priority: 'high'
                });

            expect(followUpResponse.status).toBe(201);

            // Complete follow-up step
            await request(app)
                .put(`/api/mtr/${mtrId}/step/followUp`)
                .send({
                    completed: true,
                    data: { followUpScheduled: true }
                });

            // Step 7: Verify MTR completion
            const finalMtr = await MedicationTherapyReview.findById(mtrId);
            expect(finalMtr!.status).toBe('completed');
            expect(finalMtr!.completedAt).toBeDefined();

            // Verify all components were created
            const problems = await DrugTherapyProblem.find({ reviewId: mtrId });
            expect(problems).toHaveLength(1);

            const interventions = await MTRIntervention.find({ reviewId: mtrId });
            expect(interventions).toHaveLength(1);

            const followUps = await MTRFollowUp.find({ reviewId: mtrId });
            expect(followUps).toHaveLength(1);
        });

        it('should handle drug interaction checking workflow', async () => {
            // Create MTR session
            const mtr = await MedicationTherapyReview.create({
                workplaceId: workplace._id,
                patientId: patient._id,
                pharmacistId: user._id,
                reviewNumber: 'MTR-202412-0001',
                patientConsent: true,
                confidentialityAgreed: true,
                createdBy: user._id
            });

            // Add medications with known interactions
            const medications = [
                {
                    drugName: 'Warfarin',
                    strength: { value: 5, unit: 'mg' },
                    dosageForm: 'tablet',
                    instructions: {
                        dose: '5 mg',
                        frequency: 'once daily',
                        route: 'oral'
                    },
                    category: 'prescribed' as const,
                    startDate: new Date(),
                    indication: 'Anticoagulation'
                },
                {
                    drugName: 'Aspirin',
                    strength: { value: 81, unit: 'mg' },
                    dosageForm: 'tablet',
                    instructions: {
                        dose: '81 mg',
                        frequency: 'once daily',
                        route: 'oral'
                    },
                    category: 'prescribed' as const,
                    startDate: new Date(),
                    indication: 'Cardioprotection'
                }
            ];

            // Test drug interaction checking endpoint
            const interactionResponse = await request(app)
                .post('/api/mtr/check-interactions')
                .send({ medications });

            expect(interactionResponse.status).toBe(200);
            expect(interactionResponse.body.data.hasInteractions).toBe(true);
            expect(interactionResponse.body.data.interactions.length).toBeGreaterThan(0);

            // Verify interaction details
            const interaction = interactionResponse.body.data.interactions[0];
            expect(interaction.severity).toBe('major');
            expect([interaction.drug1.toLowerCase(), interaction.drug2.toLowerCase()]).toContain('warfarin');
            expect([interaction.drug1.toLowerCase(), interaction.drug2.toLowerCase()]).toContain('aspirin');
        });

        it('should handle MTR reports and analytics', async () => {
            // Create completed MTR session with outcomes
            const mtr = await MedicationTherapyReview.create({
                workplaceId: workplace._id,
                patientId: patient._id,
                pharmacistId: user._id,
                reviewNumber: 'MTR-202412-0001',
                status: 'completed',
                patientConsent: true,
                confidentialityAgreed: true,
                completedAt: new Date(),
                clinicalOutcomes: {
                    problemsResolved: 2,
                    medicationsOptimized: 1,
                    adherenceImproved: true,
                    adverseEventsReduced: true,
                    costSavings: 150.00
                },
                createdBy: user._id
            });

            // Mark all steps as completed
            Object.keys(mtr.steps).forEach(stepName => {
                mtr.markStepComplete(stepName);
            });
            await mtr.save();

            // Create associated problems and interventions
            await DrugTherapyProblem.create({
                workplaceId: workplace._id,
                patientId: patient._id,
                reviewId: mtr._id,
                category: 'safety',
                type: 'interaction',
                severity: 'major',
                description: 'Drug interaction resolved',
                clinicalSignificance: 'Bleeding risk eliminated',
                evidenceLevel: 'definite',
                status: 'resolved',
                identifiedBy: user._id,
                createdBy: user._id
            });

            await MTRIntervention.create({
                workplaceId: workplace._id,
                reviewId: mtr._id,
                patientId: patient._id,
                pharmacistId: user._id,
                type: 'recommendation',
                category: 'medication_change',
                description: 'Medication discontinued',
                rationale: 'Safety concern',
                targetAudience: 'prescriber',
                communicationMethod: 'phone',
                documentation: 'Successful intervention',
                outcome: 'accepted',
                createdBy: user._id
            });

            // Test MTR summary report
            const summaryResponse = await request(app)
                .get('/api/mtr/reports/summary')
                .query({
                    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                    endDate: new Date().toISOString()
                });

            expect(summaryResponse.status).toBe(200);
            expect(summaryResponse.body.data.totalReviews).toBe(1);
            expect(summaryResponse.body.data.completedReviews).toBe(1);
            expect(summaryResponse.body.data.totalProblemsResolved).toBe(2);

            // Test intervention effectiveness report
            const effectivenessResponse = await request(app)
                .get('/api/mtr/reports/outcomes')
                .query({
                    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                    endDate: new Date().toISOString()
                });

            expect(effectivenessResponse.status).toBe(200);
            expect(effectivenessResponse.body.data.interventionAcceptanceRate).toBeGreaterThan(0);
        });

        it('should handle error scenarios gracefully', async () => {
            // Test creating MTR without patient consent
            const response1 = await request(app)
                .post('/api/mtr')
                .send({
                    patientId: patient._id.toString(),
                    patientConsent: false,
                    confidentialityAgreed: true
                });

            expect(response1.status).toBe(400);

            // Test accessing non-existent MTR
            const nonExistentId = testUtils.createObjectId();
            const response2 = await request(app)
                .get(`/api/mtr/${nonExistentId}`);

            expect(response2.status).toBe(404);

            // Test invalid step name
            const mtr = await MedicationTherapyReview.create({
                workplaceId: workplace._id,
                patientId: patient._id,
                pharmacistId: user._id,
                reviewNumber: 'MTR-202412-0001',
                patientConsent: true,
                confidentialityAgreed: true,
                createdBy: user._id
            });

            const response3 = await request(app)
                .put(`/api/mtr/${mtr._id}/step/invalidStep`)
                .send({ completed: true });

            expect(response3.status).toBe(400);

            // Test creating duplicate active sessions
            await request(app)
                .post(`/api/mtr/patient/${patient._id}`)
                .send({
                    patientConsent: true,
                    confidentialityAgreed: true
                });

            const response4 = await request(app)
                .post(`/api/mtr/patient/${patient._id}`)
                .send({
                    patientConsent: true,
                    confidentialityAgreed: true
                });

            expect(response4.status).toBe(409);
        });

        it('should handle pagination and filtering correctly', async () => {
            // Create multiple MTR sessions
            const sessions = [];
            for (let i = 0; i < 15; i++) {
                const session = await MedicationTherapyReview.create({
                    workplaceId: workplace._id,
                    patientId: patient._id,
                    pharmacistId: user._id,
                    reviewNumber: `MTR-202412-${String(i + 1).padStart(4, '0')}`,
                    status: i % 2 === 0 ? 'in_progress' : 'completed',
                    priority: i % 3 === 0 ? 'urgent' : 'routine',
                    patientConsent: true,
                    confidentialityAgreed: true,
                    createdBy: user._id
                });
                sessions.push(session);
            }

            // Test pagination
            const paginationResponse = await request(app)
                .get('/api/mtr')
                .query({ page: 1, limit: 10 });

            expect(paginationResponse.status).toBe(200);
            expect(paginationResponse.body.data).toHaveLength(10);
            expect(paginationResponse.body.pagination.total).toBe(15);
            expect(paginationResponse.body.pagination.pages).toBe(2);

            // Test filtering by status
            const statusResponse = await request(app)
                .get('/api/mtr')
                .query({ status: 'in_progress' });

            expect(statusResponse.status).toBe(200);
            expect(statusResponse.body.data.length).toBe(8); // 8 in_progress sessions

            // Test filtering by priority
            const priorityResponse = await request(app)
                .get('/api/mtr')
                .query({ priority: 'urgent' });

            expect(priorityResponse.status).toBe(200);
            expect(priorityResponse.body.data.length).toBe(5); // 5 urgent sessions
        });
    });

    describe('Performance and Scalability', () => {
        it('should handle large medication lists efficiently', async () => {
            const mtr = await MedicationTherapyReview.create({
                workplaceId: workplace._id,
                patientId: patient._id,
                pharmacistId: user._id,
                reviewNumber: 'MTR-202412-0001',
                patientConsent: true,
                confidentialityAgreed: true,
                createdBy: user._id
            });

            // Create large medication list
            const medications = [];
            for (let i = 0; i < 50; i++) {
                medications.push({
                    drugName: `Medication ${i + 1}`,
                    strength: { value: 10 + i, unit: 'mg' },
                    dosageForm: 'tablet',
                    instructions: {
                        dose: `${10 + i} mg`,
                        frequency: 'once daily',
                        route: 'oral'
                    },
                    category: 'prescribed' as const,
                    startDate: new Date(),
                    indication: `Condition ${i + 1}`
                });
            }

            const startTime = Date.now();

            mtr.medications = medications;
            await mtr.save();

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Should complete within reasonable time (< 1 second)
            expect(duration).toBeLessThan(1000);
            expect(mtr.medications).toHaveLength(50);
        });

        it('should handle concurrent MTR operations', async () => {
            const promises = [];

            // Create multiple MTR sessions concurrently
            for (let i = 0; i < 10; i++) {
                const promise = MedicationTherapyReview.create({
                    workplaceId: workplace._id,
                    patientId: patient._id,
                    pharmacistId: user._id,
                    reviewNumber: `MTR-202412-${String(i + 1).padStart(4, '0')}`,
                    patientConsent: true,
                    confidentialityAgreed: true,
                    createdBy: user._id
                });
                promises.push(promise);
            }

            const startTime = Date.now();
            const results = await Promise.all(promises);
            const endTime = Date.now();
            const duration = endTime - startTime;

            expect(results).toHaveLength(10);
            expect(duration).toBeLessThan(2000); // Should complete within 2 seconds

            // Verify all sessions were created with unique review numbers
            const reviewNumbers = results.map(r => r.reviewNumber);
            const uniqueNumbers = new Set(reviewNumbers);
            expect(uniqueNumbers.size).toBe(10);
        });
    });
});