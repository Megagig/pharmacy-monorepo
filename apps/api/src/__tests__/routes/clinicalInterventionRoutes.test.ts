import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import clinicalInterventionRoutes from '../../routes/clinicalInterventionRoutes';
import User from '../../models/User';
import Workplace from '../../models/Workplace';
import Patient from '../../models/Patient';
import ClinicalIntervention from '../../models/ClinicalIntervention';
import jwt from 'jsonwebtoken';

// Mock the controller functions
jest.mock('../../controllers/clinicalInterventionController', () => ({
    getClinicalInterventions: jest.fn((req, res) => res.json({ success: true, data: [] })),
    getClinicalIntervention: jest.fn((req, res) => res.json({ success: true, data: {} })),
    createClinicalIntervention: jest.fn((req, res) => res.status(201).json({ success: true, data: {} })),
    updateClinicalIntervention: jest.fn((req, res) => res.json({ success: true, data: {} })),
    deleteClinicalIntervention: jest.fn((req, res) => res.json({ success: true })),
    addInterventionStrategy: jest.fn((req, res) => res.json({ success: true, data: {} })),
    updateInterventionStrategy: jest.fn((req, res) => res.json({ success: true, data: {} })),
    assignTeamMember: jest.fn((req, res) => res.json({ success: true, data: {} })),
    updateAssignment: jest.fn((req, res) => res.json({ success: true, data: {} })),
    recordOutcome: jest.fn((req, res) => res.json({ success: true, data: {} })),
    scheduleFollowUp: jest.fn((req, res) => res.json({ success: true, data: {} })),
    searchClinicalInterventions: jest.fn((req, res) => res.json({ success: true, data: [] })),
    getPatientInterventions: jest.fn((req, res) => res.json({ success: true, data: [] })),
    getAssignedInterventions: jest.fn((req, res) => res.json({ success: true, data: [] })),
    getInterventionAnalytics: jest.fn((req, res) => res.json({ success: true, data: {} })),
    getInterventionTrends: jest.fn((req, res) => res.json({ success: true, data: {} })),
    getOutcomeReports: jest.fn((req, res) => res.json({ success: true, data: {} })),
    exportInterventionData: jest.fn((req, res) => res.json({ success: true, data: {} })),
    getStrategyRecommendations: jest.fn((req, res) => res.json({ success: true, data: [] })),
    linkToMTR: jest.fn((req, res) => res.json({ success: true })),
    sendInterventionNotifications: jest.fn((req, res) => res.json({ success: true })),
}));

// Mock middleware
jest.mock('../../middlewares/auditMiddleware', () => ({
    auditTimer: jest.fn((req, res, next) => next()),
    auditInterventionActivity: jest.fn(() => (req, res, next) => next()),
}));

jest.mock('../../utils/responseHelpers', () => ({
    clinicalInterventionErrorHandler: jest.fn((err, req, res, next) => {
        res.status(500).json({ success: false, message: err.message });
    }),
}));

describe('Clinical Intervention Routes', () => {
    let app: express.Application;
    let mongoServer: MongoMemoryServer;
    let testUser: any;
    let testWorkplace: any;
    let testPatient: any;
    let authToken: string;

    beforeAll(async () => {
        // Setup in-memory MongoDB
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);

        // Setup Express app
        app = express();
        app.use(express.json());
        app.use('/api/clinical-interventions', clinicalInterventionRoutes);

        // Create test data
        testWorkplace = await Workplace.create({
            name: 'Test Pharmacy',
            address: 'Test Address',
            phone: '1234567890',
            email: 'test@pharmacy.com',
            licenseNumber: 'TEST123',
            subscriptionStatus: 'active',
            trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        });

        testUser = await User.create({
            firstName: 'Test',
            lastName: 'Pharmacist',
            email: 'test@pharmacist.com',
            passwordHash: 'hashedpassword',
            role: 'pharmacist',
            workplaceId: testWorkplace._id,
            workplaceRole: 'Pharmacist',
            status: 'active',
            licenseStatus: 'approved',
        });

        testPatient = await Patient.create({
            firstName: 'Test',
            lastName: 'Patient',
            dateOfBirth: new Date('1990-01-01'),
            gender: 'male',
            phone: '1234567890',
            email: 'patient@test.com',
            workplaceId: testWorkplace._id,
            createdBy: testUser._id,
        });

        // Generate auth token
        authToken = jwt.sign(
            { userId: testUser._id },
            process.env.JWT_SECRET || 'test-secret'
        );
    });

    afterAll(async () => {
        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
        await mongoServer.stop();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Authentication and Authorization', () => {
        it('should reject requests without authentication token', async () => {
            const response = await request(app)
                .get('/api/clinical-interventions')
                .expect(401);

            expect(response.body.message).toContain('Access denied');
        });

        it('should reject requests with invalid token', async () => {
            const response = await request(app)
                .get('/api/clinical-interventions')
                .set('Authorization', 'Bearer invalid-token')
                .expect(401);

            expect(response.body.message).toContain('Invalid token');
        });
    });

    describe('GET /api/clinical-interventions', () => {
        it('should return interventions list for authenticated user', async () => {
            const response = await request(app)
                .get('/api/clinical-interventions')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
        });

        it('should validate query parameters', async () => {
            const response = await request(app)
                .get('/api/clinical-interventions?page=invalid')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Validation failed');
        });

        it('should accept valid query parameters', async () => {
            const response = await request(app)
                .get('/api/clinical-interventions?page=1&limit=10&category=drug_therapy_problem&priority=high')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('POST /api/clinical-interventions', () => {
        const validInterventionData = {
            patientId: '507f1f77bcf86cd799439011', // Valid ObjectId format
            category: 'drug_therapy_problem',
            issueDescription: 'Patient experiencing side effects from current medication regimen',
            priority: 'high',
            strategies: [
                {
                    type: 'medication_review',
                    description: 'Comprehensive medication review',
                    rationale: 'To identify potential drug interactions',
                    expectedOutcome: 'Reduced side effects and improved medication adherence',
                },
            ],
        };

        it('should create intervention with valid data', async () => {
            const response = await request(app)
                .post('/api/clinical-interventions')
                .set('Authorization', `Bearer ${authToken}`)
                .send(validInterventionData)
                .expect(201);

            expect(response.body.success).toBe(true);
        });

        it('should reject intervention with missing required fields', async () => {
            const invalidData = {
                category: 'drug_therapy_problem',
                // Missing patientId, issueDescription, priority
            };

            const response = await request(app)
                .post('/api/clinical-interventions')
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidData)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Validation failed');
        });

        it('should reject intervention with invalid category', async () => {
            const invalidData = {
                ...validInterventionData,
                category: 'invalid_category',
            };

            const response = await request(app)
                .post('/api/clinical-interventions')
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidData)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.errors).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        field: 'category',
                    }),
                ])
            );
        });

        it('should reject intervention with short issue description', async () => {
            const invalidData = {
                ...validInterventionData,
                issueDescription: 'Too short', // Less than 10 characters
            };

            const response = await request(app)
                .post('/api/clinical-interventions')
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidData)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.errors).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        field: 'issueDescription',
                    }),
                ])
            );
        });
    });

    describe('GET /api/clinical-interventions/:id', () => {
        it('should return intervention details for valid ID', async () => {
            const validId = '507f1f77bcf86cd799439011';
            const response = await request(app)
                .get(`/api/clinical-interventions/${validId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
        });

        it('should reject invalid intervention ID', async () => {
            const response = await request(app)
                .get('/api/clinical-interventions/invalid-id')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Validation failed');
        });
    });

    describe('PATCH /api/clinical-interventions/:id', () => {
        const validUpdateData = {
            priority: 'medium',
            status: 'in_progress',
            implementationNotes: 'Started medication review process',
        };

        it('should update intervention with valid data', async () => {
            const validId = '507f1f77bcf86cd799439011';
            const response = await request(app)
                .patch(`/api/clinical-interventions/${validId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(validUpdateData)
                .expect(200);

            expect(response.body.success).toBe(true);
        });

        it('should reject update with invalid status', async () => {
            const validId = '507f1f77bcf86cd799439011';
            const invalidData = {
                status: 'invalid_status',
            };

            const response = await request(app)
                .patch(`/api/clinical-interventions/${validId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidData)
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/clinical-interventions/:id/strategies', () => {
        const validStrategyData = {
            type: 'dose_adjustment',
            description: 'Reduce medication dose by 50%',
            rationale: 'Patient experiencing dose-related side effects',
            expectedOutcome: 'Reduced side effects while maintaining therapeutic effect',
            priority: 'primary',
        };

        it('should add strategy with valid data', async () => {
            const validId = '507f1f77bcf86cd799439011';
            const response = await request(app)
                .post(`/api/clinical-interventions/${validId}/strategies`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(validStrategyData)
                .expect(200);

            expect(response.body.success).toBe(true);
        });

        it('should reject strategy with invalid type', async () => {
            const validId = '507f1f77bcf86cd799439011';
            const invalidData = {
                ...validStrategyData,
                type: 'invalid_type',
            };

            const response = await request(app)
                .post(`/api/clinical-interventions/${validId}/strategies`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidData)
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        it('should reject strategy with short expected outcome', async () => {
            const validId = '507f1f77bcf86cd799439011';
            const invalidData = {
                ...validStrategyData,
                expectedOutcome: 'Too short', // Less than 20 characters
            };

            const response = await request(app)
                .post(`/api/clinical-interventions/${validId}/strategies`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidData)
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/clinical-interventions/:id/assignments', () => {
        const validAssignmentData = {
            userId: '507f1f77bcf86cd799439011',
            role: 'pharmacist',
            task: 'Review medication regimen and provide recommendations',
            notes: 'Patient has complex medication history',
        };

        it('should assign team member with valid data', async () => {
            const validId = '507f1f77bcf86cd799439011';
            const response = await request(app)
                .post(`/api/clinical-interventions/${validId}/assignments`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(validAssignmentData)
                .expect(200);

            expect(response.body.success).toBe(true);
        });

        it('should reject assignment with invalid role', async () => {
            const validId = '507f1f77bcf86cd799439011';
            const invalidData = {
                ...validAssignmentData,
                role: 'invalid_role',
            };

            const response = await request(app)
                .post(`/api/clinical-interventions/${validId}/assignments`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidData)
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/clinical-interventions/:id/outcomes', () => {
        const validOutcomeData = {
            patientResponse: 'improved',
            clinicalParameters: [
                {
                    parameter: 'Blood Pressure',
                    beforeValue: '160/90',
                    afterValue: '130/80',
                    unit: 'mmHg',
                },
            ],
            successMetrics: {
                problemResolved: true,
                medicationOptimized: true,
                adherenceImproved: true,
                costSavings: 150.00,
                qualityOfLifeImproved: true,
            },
        };

        it('should record outcome with valid data', async () => {
            const validId = '507f1f77bcf86cd799439011';
            const response = await request(app)
                .post(`/api/clinical-interventions/${validId}/outcomes`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(validOutcomeData)
                .expect(200);

            expect(response.body.success).toBe(true);
        });

        it('should reject outcome with invalid patient response', async () => {
            const validId = '507f1f77bcf86cd799439011';
            const invalidData = {
                ...validOutcomeData,
                patientResponse: 'invalid_response',
            };

            const response = await request(app)
                .post(`/api/clinical-interventions/${validId}/outcomes`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidData)
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/clinical-interventions/:id/follow-up', () => {
        const validFollowUpData = {
            required: true,
            scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
            notes: 'Follow up to assess medication effectiveness',
            nextReviewDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        };

        it('should schedule follow-up with valid data', async () => {
            const validId = '507f1f77bcf86cd799439011';
            const response = await request(app)
                .post(`/api/clinical-interventions/${validId}/follow-up`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(validFollowUpData)
                .expect(200);

            expect(response.body.success).toBe(true);
        });

        it('should reject follow-up with invalid date format', async () => {
            const validId = '507f1f77bcf86cd799439011';
            const invalidData = {
                ...validFollowUpData,
                scheduledDate: 'invalid-date',
            };

            const response = await request(app)
                .post(`/api/clinical-interventions/${validId}/follow-up`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidData)
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /api/clinical-interventions/patient/:patientId', () => {
        it('should return patient interventions for valid patient ID', async () => {
            const validPatientId = '507f1f77bcf86cd799439011';
            const response = await request(app)
                .get(`/api/clinical-interventions/patient/${validPatientId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
        });

        it('should reject invalid patient ID', async () => {
            const response = await request(app)
                .get('/api/clinical-interventions/patient/invalid-id')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('Analytics and Reporting Routes', () => {
        it('should return analytics summary', async () => {
            const response = await request(app)
                .get('/api/clinical-interventions/analytics/summary')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
        });

        it('should return trend analysis', async () => {
            const response = await request(app)
                .get('/api/clinical-interventions/analytics/trends')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
        });

        it('should validate analytics query parameters', async () => {
            const response = await request(app)
                .get('/api/clinical-interventions/analytics/summary?dateFrom=invalid-date')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('Integration Routes', () => {
        it('should return strategy recommendations', async () => {
            const response = await request(app)
                .get('/api/clinical-interventions/recommendations/drug_therapy_problem')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
        });

        it('should link intervention to MTR', async () => {
            const validId = '507f1f77bcf86cd799439011';
            const linkData = {
                mtrId: '507f1f77bcf86cd799439012',
            };

            const response = await request(app)
                .post(`/api/clinical-interventions/${validId}/link-mtr`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(linkData)
                .expect(200);

            expect(response.body.success).toBe(true);
        });

        it('should send notifications', async () => {
            const validId = '507f1f77bcf86cd799439011';
            const notificationData = {
                event: 'assignment',
                recipients: ['507f1f77bcf86cd799439012'],
                message: 'You have been assigned to a new clinical intervention',
            };

            const response = await request(app)
                .post(`/api/clinical-interventions/${validId}/notifications`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(notificationData)
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });
});