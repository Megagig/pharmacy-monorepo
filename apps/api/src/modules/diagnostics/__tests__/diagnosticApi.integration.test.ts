import request from 'supertest';
import { Express } from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Import app and models
import app from '../../../app';
import User from '../../../models/User';
import Patient from '../../../models/Patient';
import Workplace from '../../../models/Workplace';
import DiagnosticRequest from '../models/DiagnosticRequest';
import DiagnosticResult from '../models/DiagnosticResult';

// Import test utilities
import { createTestUser, createTestWorkplace, createTestPatient, getAuthToken } from '../../../__tests__/utils/testHelpers';

describe('Diagnostic API Integration Tests', () => {
    let mongoServer: MongoMemoryServer;
    let testApp: Express;
    let testUser: any;
    let testWorkplace: any;
    let testPatient: any;
    let authToken: string;

    beforeAll(async () => {
        // Start in-memory MongoDB
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);

        testApp = app;
    });

    afterAll(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    beforeEach(async () => {
        // Clear all collections
        await User.deleteMany({});
        await Patient.deleteMany({});
        await Workplace.deleteMany({});
        await DiagnosticRequest.deleteMany({});
        await DiagnosticResult.deleteMany({});

        // Create test data
        testWorkplace = await createTestWorkplace();
        testUser = await createTestUser({
            workplaceId: testWorkplace._id,
            role: 'pharmacist',
            workplaceRole: 'pharmacist',
        });
        testPatient = await createTestPatient({
            workplaceId: testWorkplace._id,
        });
        authToken = getAuthToken(testUser);
    });

    describe('POST /api/diagnostics', () => {
        const validDiagnosticRequest = {
            patientId: null, // Will be set in test
            inputSnapshot: {
                symptoms: {
                    subjective: ['headache', 'fever'],
                    objective: ['elevated temperature'],
                    duration: '2 days',
                    severity: 'moderate',
                    onset: 'acute',
                },
                vitals: {
                    temperature: 38.5,
                    heartRate: 90,
                    bloodPressure: '120/80',
                },
                currentMedications: [
                    {
                        name: 'Paracetamol',
                        dosage: '500mg',
                        frequency: 'twice daily',
                    },
                ],
                allergies: ['penicillin'],
                medicalHistory: ['hypertension'],
            },
            priority: 'routine',
            consentObtained: true,
        };

        it('should create diagnostic request successfully', async () => {
            const requestData = {
                ...validDiagnosticRequest,
                patientId: testPatient._id.toString(),
            };

            const response = await request(testApp)
                .post('/api/diagnostics')
                .set('Authorization', `Bearer ${authToken}`)
                .send(requestData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.request).toBeDefined();
            expect(response.body.data.request.patientId).toBe(testPatient._id.toString());
            expect(response.body.data.request.status).toBe('pending');
            expect(response.body.data.request.consentObtained).toBe(true);
        });

        it('should fail without patient consent', async () => {
            const requestData = {
                ...validDiagnosticRequest,
                patientId: testPatient._id.toString(),
                consentObtained: false,
            };

            const response = await request(testApp)
                .post('/api/diagnostics')
                .set('Authorization', `Bearer ${authToken}`)
                .send(requestData)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('consent');
        });

        it('should fail with invalid patient ID', async () => {
            const requestData = {
                ...validDiagnosticRequest,
                patientId: new mongoose.Types.ObjectId().toString(),
            };

            const response = await request(testApp)
                .post('/api/diagnostics')
                .set('Authorization', `Bearer ${authToken}`)
                .send(requestData)
                .expect(500);

            expect(response.body.success).toBe(false);
        });

        it('should fail with missing symptoms', async () => {
            const requestData = {
                ...validDiagnosticRequest,
                patientId: testPatient._id.toString(),
                inputSnapshot: {
                    ...validDiagnosticRequest.inputSnapshot,
                    symptoms: {
                        subjective: [], // Empty symptoms
                        objective: [],
                        duration: '2 days',
                        severity: 'moderate',
                        onset: 'acute',
                    },
                },
            };

            const response = await request(testApp)
                .post('/api/diagnostics')
                .set('Authorization', `Bearer ${authToken}`)
                .send(requestData)
                .expect(422);

            expect(response.body.success).toBe(false);
            expect(response.body.code).toBe('VALIDATION_ERROR');
        });

        it('should fail without authentication', async () => {
            const requestData = {
                ...validDiagnosticRequest,
                patientId: testPatient._id.toString(),
            };

            await request(testApp)
                .post('/api/diagnostics')
                .send(requestData)
                .expect(401);
        });
    });

    describe('GET /api/diagnostics/:id', () => {
        let testDiagnosticRequest: any;

        beforeEach(async () => {
            // Create a test diagnostic request
            testDiagnosticRequest = new DiagnosticRequest({
                patientId: testPatient._id,
                pharmacistId: testUser._id,
                workplaceId: testWorkplace._id,
                inputSnapshot: {
                    symptoms: {
                        subjective: ['headache', 'fever'],
                        objective: [],
                        duration: '2 days',
                        severity: 'moderate',
                        onset: 'acute',
                    },
                },
                consentObtained: true,
                status: 'pending',
                createdBy: testUser._id,
            });
            await testDiagnosticRequest.save();
        });

        it('should retrieve diagnostic request successfully', async () => {
            const response = await request(testApp)
                .get(`/api/diagnostics/${testDiagnosticRequest._id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.request).toBeDefined();
            expect(response.body.data.request._id).toBe(testDiagnosticRequest._id.toString());
            expect(response.body.data.status).toBe('pending');
            expect(response.body.data.isActive).toBe(true);
        });

        it('should fail with invalid diagnostic request ID', async () => {
            const invalidId = new mongoose.Types.ObjectId();

            const response = await request(testApp)
                .get(`/api/diagnostics/${invalidId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);

            expect(response.body.success).toBe(false);
        });

        it('should fail without authentication', async () => {
            await request(testApp)
                .get(`/api/diagnostics/${testDiagnosticRequest._id}`)
                .expect(401);
        });
    });

    describe('GET /api/diagnostics/dashboard', () => {
        beforeEach(async () => {
            // Create some test diagnostic requests for dashboard stats
            const requests = [
                {
                    patientId: testPatient._id,
                    pharmacistId: testUser._id,
                    workplaceId: testWorkplace._id,
                    status: 'pending',
                    inputSnapshot: {
                        symptoms: {
                            subjective: ['headache'],
                            objective: [],
                            duration: '1 day',
                            severity: 'mild',
                            onset: 'acute',
                        },
                    },
                    consentObtained: true,
                    createdBy: testUser._id,
                },
                {
                    patientId: testPatient._id,
                    pharmacistId: testUser._id,
                    workplaceId: testWorkplace._id,
                    status: 'completed',
                    inputSnapshot: {
                        symptoms: {
                            subjective: ['fever'],
                            objective: [],
                            duration: '2 days',
                            severity: 'moderate',
                            onset: 'acute',
                        },
                    },
                    consentObtained: true,
                    createdBy: testUser._id,
                },
            ];

            await DiagnosticRequest.insertMany(requests);
        });

        it('should retrieve dashboard data successfully', async () => {
            const response = await request(testApp)
                .get('/api/diagnostics/dashboard')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.statistics).toBeDefined();
            expect(response.body.data.statistics.total).toBe(2);
            expect(response.body.data.statistics.pending).toBe(1);
            expect(response.body.data.statistics.completed).toBe(1);
            expect(response.body.data.recentRequests).toBeDefined();
            expect(response.body.data.alerts).toBeDefined();
        });

        it('should fail without authentication', async () => {
            await request(testApp)
                .get('/api/diagnostics/dashboard')
                .expect(401);
        });
    });

    describe('GET /api/diagnostics/history/:patientId', () => {
        beforeEach(async () => {
            // Create diagnostic history for the patient
            const requests = [
                {
                    patientId: testPatient._id,
                    pharmacistId: testUser._id,
                    workplaceId: testWorkplace._id,
                    status: 'completed',
                    inputSnapshot: {
                        symptoms: {
                            subjective: ['headache'],
                            objective: [],
                            duration: '1 day',
                            severity: 'mild',
                            onset: 'acute',
                        },
                    },
                    consentObtained: true,
                    createdBy: testUser._id,
                    createdAt: new Date('2024-01-01'),
                },
                {
                    patientId: testPatient._id,
                    pharmacistId: testUser._id,
                    workplaceId: testWorkplace._id,
                    status: 'completed',
                    inputSnapshot: {
                        symptoms: {
                            subjective: ['fever'],
                            objective: [],
                            duration: '2 days',
                            severity: 'moderate',
                            onset: 'acute',
                        },
                    },
                    consentObtained: true,
                    createdBy: testUser._id,
                    createdAt: new Date('2024-01-02'),
                },
            ];

            await DiagnosticRequest.insertMany(requests);
        });

        it('should retrieve patient diagnostic history successfully', async () => {
            const response = await request(testApp)
                .get(`/api/diagnostics/history/${testPatient._id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(2);
            expect(response.body.pagination).toBeDefined();
            expect(response.body.pagination.total).toBe(2);
        });

        it('should support pagination', async () => {
            const response = await request(testApp)
                .get(`/api/diagnostics/history/${testPatient._id}?page=1&limit=1`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(1);
            expect(response.body.pagination.page).toBe(1);
            expect(response.body.pagination.limit).toBe(1);
            expect(response.body.pagination.total).toBe(2);
        });

        it('should fail with invalid patient ID', async () => {
            const invalidId = new mongoose.Types.ObjectId();

            const response = await request(testApp)
                .get(`/api/diagnostics/history/${invalidId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(0);
        });
    });

    describe('POST /api/diagnostics/:id/retry', () => {
        let failedDiagnosticRequest: any;

        beforeEach(async () => {
            // Create a failed diagnostic request
            failedDiagnosticRequest = new DiagnosticRequest({
                patientId: testPatient._id,
                pharmacistId: testUser._id,
                workplaceId: testWorkplace._id,
                inputSnapshot: {
                    symptoms: {
                        subjective: ['headache'],
                        objective: [],
                        duration: '1 day',
                        severity: 'mild',
                        onset: 'acute',
                    },
                },
                consentObtained: true,
                status: 'failed',
                retryCount: 1,
                errorMessage: 'AI service timeout',
                createdBy: testUser._id,
            });
            await failedDiagnosticRequest.save();
        });

        it('should retry failed diagnostic request successfully', async () => {
            // Mock the diagnostic service to avoid actual AI calls
            jest.mock('../services/diagnosticService');

            const response = await request(testApp)
                .post(`/api/diagnostics/${failedDiagnosticRequest._id}/retry`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.request).toBeDefined();
        });

        it('should fail to retry non-failed request', async () => {
            // Create a completed request
            const completedRequest = new DiagnosticRequest({
                patientId: testPatient._id,
                pharmacistId: testUser._id,
                workplaceId: testWorkplace._id,
                inputSnapshot: {
                    symptoms: {
                        subjective: ['headache'],
                        objective: [],
                        duration: '1 day',
                        severity: 'mild',
                        onset: 'acute',
                    },
                },
                consentObtained: true,
                status: 'completed',
                createdBy: testUser._id,
            });
            await completedRequest.save();

            const response = await request(testApp)
                .post(`/api/diagnostics/${completedRequest._id}/retry`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('DELETE /api/diagnostics/:id', () => {
        let pendingDiagnosticRequest: any;

        beforeEach(async () => {
            // Create a pending diagnostic request
            pendingDiagnosticRequest = new DiagnosticRequest({
                patientId: testPatient._id,
                pharmacistId: testUser._id,
                workplaceId: testWorkplace._id,
                inputSnapshot: {
                    symptoms: {
                        subjective: ['headache'],
                        objective: [],
                        duration: '1 day',
                        severity: 'mild',
                        onset: 'acute',
                    },
                },
                consentObtained: true,
                status: 'pending',
                createdBy: testUser._id,
            });
            await pendingDiagnosticRequest.save();
        });

        it('should cancel pending diagnostic request successfully', async () => {
            const response = await request(testApp)
                .delete(`/api/diagnostics/${pendingDiagnosticRequest._id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);

            // Verify the request was cancelled
            const updatedRequest = await DiagnosticRequest.findById(pendingDiagnosticRequest._id);
            expect(updatedRequest?.status).toBe('cancelled');
        });

        it('should fail to cancel completed request', async () => {
            // Update request to completed status
            pendingDiagnosticRequest.status = 'completed';
            await pendingDiagnosticRequest.save();

            const response = await request(testApp)
                .delete(`/api/diagnostics/${pendingDiagnosticRequest._id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('Error Handling', () => {
        it('should handle malformed request body', async () => {
            const response = await request(testApp)
                .post('/api/diagnostics')
                .set('Authorization', `Bearer ${authToken}`)
                .send('invalid json')
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        it('should handle invalid MongoDB ObjectId', async () => {
            const response = await request(testApp)
                .get('/api/diagnostics/invalid-id')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.code).toBe('INVALID_ID');
        });

        it('should handle missing required fields', async () => {
            const response = await request(testApp)
                .post('/api/diagnostics')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    patientId: testPatient._id.toString(),
                    // Missing inputSnapshot and consentObtained
                })
                .expect(422);

            expect(response.body.success).toBe(false);
            expect(response.body.code).toBe('VALIDATION_ERROR');
        });
    });
});

// Mock external services to avoid actual API calls during tests
jest.mock('../services/clinicalApiService', () => ({
    checkDrugInteractions: jest.fn().mockResolvedValue([]),
    checkAllergyInteractions: jest.fn().mockResolvedValue([]),
    checkContraindications: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../../services/openRouterService', () => ({
    generateDiagnosticAnalysis: jest.fn().mockResolvedValue({
        analysis: {
            differentialDiagnoses: [
                {
                    condition: 'Viral upper respiratory infection',
                    probability: 75,
                    reasoning: 'Consistent with symptoms and presentation',
                    severity: 'low',
                },
            ],
            recommendedTests: [],
            therapeuticOptions: [],
            redFlags: [],
            confidenceScore: 80,
            disclaimer: 'This is an AI-generated analysis for informational purposes only.',
        },
        processingTime: 5000,
        usage: {
            promptTokens: 500,
            completionTokens: 300,
            totalTokens: 800,
        },
        requestId: 'test-request-id',
    }),
}));