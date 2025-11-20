import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../app';
import { connectDB, disconnectDB } from '../../../config/db';
import { User } from '../../../models/User';
import { Workplace } from '../../../models/Workplace';
import { MedicationTherapyReview } from '../../../models/MedicationTherapyReview';
import { ClinicalIntervention } from '../../../models/ClinicalIntervention';
import { Patient } from '../../../models/Patient';
import jwt from 'jsonwebtoken';

describe('Reports Controller Integration Tests', () => {
    let authToken: string;
    let testUser: any;
    let testWorkplace: any;
    let testPatient: any;

    beforeAll(async () => {
        await connectDB();
    });

    afterAll(async () => {
        await disconnectDB();
    });

    beforeEach(async () => {
        // Create test workplace
        testWorkplace = await Workplace.create({
            name: 'Test Pharmacy',
            address: 'Test Address',
            phone: '+1234567890',
            email: 'test@pharmacy.com',
            subscriptionPlan: 'premium',
            subscriptionStatus: 'active',
        });

        // Create test user
        testUser = await User.create({
            email: 'test@example.com',
            password: 'password123',
            firstName: 'Test',
            lastName: 'User',
            role: 'pharmacist',
            workplaceId: testWorkplace._id,
            permissions: ['reports:read', 'reports:export'],
        });

        // Create test patient
        testPatient = await Patient.create({
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: new Date('1980-01-01'),
            gender: 'male',
            phone: '+1234567890',
            email: 'john.doe@example.com',
            workplaceId: testWorkplace._id,
        });

        // Generate auth token
        authToken = jwt.sign(
            { userId: testUser._id, workplaceId: testWorkplace._id },
            process.env.JWT_SECRET || 'test-secret',
            { expiresIn: '1h' }
        );
    });

    afterEach(async () => {
        // Clean up test data
        await User.deleteMany({});
        await Workplace.deleteMany({});
        await Patient.deleteMany({});
        await MedicationTherapyReview.deleteMany({});
        await ClinicalIntervention.deleteMany({});
    });

    describe('GET /api/reports/patient-outcomes', () => {
        beforeEach(async () => {
            // Create test MTR data
            await MedicationTherapyReview.create({
                patientId: testPatient._id,
                pharmacistId: testUser._id,
                workplaceId: testWorkplace._id,
                reviewDate: new Date(),
                status: 'completed',
                medications: [
                    {
                        name: 'Test Medication',
                        dosage: '10mg',
                        frequency: 'daily',
                        adherence: 85,
                    },
                ],
                clinicalParameters: {
                    bloodPressure: { systolic: 120, diastolic: 80 },
                    heartRate: 72,
                    weight: 70,
                },
                outcomes: {
                    clinicalImprovement: true,
                    adherenceImprovement: true,
                    qualityOfLifeScore: 8,
                },
            });

            // Create test clinical intervention
            await ClinicalIntervention.create({
                patientId: testPatient._id,
                pharmacistId: testUser._id,
                workplaceId: testWorkplace._id,
                type: 'medication-review',
                description: 'Comprehensive medication review',
                status: 'completed',
                outcome: 'improved',
                createdAt: new Date(),
            });
        });

        it('should return patient outcome data with valid filters', async () => {
            const response = await request(app)
                .get('/api/reports/patient-outcomes')
                .set('Authorization', `Bearer ${authToken}`)
                .query({
                    startDate: '2024-01-01',
                    endDate: '2024-12-31',
                    workplaceId: testWorkplace._id,
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('summary');
            expect(response.body).toHaveProperty('charts');
            expect(response.body).toHaveProperty('tables');
            expect(response.body).toHaveProperty('metadata');

            expect(response.body.summary).toHaveProperty('totalPatients');
            expect(response.body.summary).toHaveProperty('totalInterventions');
            expect(response.body.summary).toHaveProperty('successRate');
        });

        it('should filter data by date range correctly', async () => {
            const response = await request(app)
                .get('/api/reports/patient-outcomes')
                .set('Authorization', `Bearer ${authToken}`)
                .query({
                    startDate: '2025-01-01', // Future date - should return no data
                    endDate: '2025-12-31',
                    workplaceId: testWorkplace._id,
                });

            expect(response.status).toBe(200);
            expect(response.body.summary.totalPatients).toBe(0);
            expect(response.body.summary.totalInterventions).toBe(0);
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .get('/api/reports/patient-outcomes')
                .query({
                    startDate: '2024-01-01',
                    endDate: '2024-12-31',
                });

            expect(response.status).toBe(401);
        });

        it('should enforce workspace isolation', async () => {
            // Create another workplace
            const otherWorkplace = await Workplace.create({
                name: 'Other Pharmacy',
                address: 'Other Address',
                phone: '+0987654321',
                email: 'other@pharmacy.com',
                subscriptionPlan: 'basic',
                subscriptionStatus: 'active',
            });

            const response = await request(app)
                .get('/api/reports/patient-outcomes')
                .set('Authorization', `Bearer ${authToken}`)
                .query({
                    startDate: '2024-01-01',
                    endDate: '2024-12-31',
                    workplaceId: otherWorkplace._id, // Different workplace
                });

            expect(response.status).toBe(403);
        });

        it('should validate required query parameters', async () => {
            const response = await request(app)
                .get('/api/reports/patient-outcomes')
                .set('Authorization', `Bearer ${authToken}`);
            // Missing required parameters

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });

        it('should handle invalid date formats', async () => {
            const response = await request(app)
                .get('/api/reports/patient-outcomes')
                .set('Authorization', `Bearer ${authToken}`)
                .query({
                    startDate: 'invalid-date',
                    endDate: '2024-12-31',
                    workplaceId: testWorkplace._id,
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });
    });

    describe('GET /api/reports/pharmacist-interventions', () => {
        beforeEach(async () => {
            // Create multiple interventions for testing
            await ClinicalIntervention.insertMany([
                {
                    patientId: testPatient._id,
                    pharmacistId: testUser._id,
                    workplaceId: testWorkplace._id,
                    type: 'medication-review',
                    description: 'Medication review',
                    status: 'completed',
                    outcome: 'improved',
                    acceptanceStatus: 'accepted',
                    createdAt: new Date(),
                },
                {
                    patientId: testPatient._id,
                    pharmacistId: testUser._id,
                    workplaceId: testWorkplace._id,
                    type: 'dosage-adjustment',
                    description: 'Dosage adjustment',
                    status: 'completed',
                    outcome: 'stable',
                    acceptanceStatus: 'accepted',
                    createdAt: new Date(),
                },
                {
                    patientId: testPatient._id,
                    pharmacistId: testUser._id,
                    workplaceId: testWorkplace._id,
                    type: 'drug-interaction-check',
                    description: 'Drug interaction check',
                    status: 'pending',
                    outcome: null,
                    acceptanceStatus: 'pending',
                    createdAt: new Date(),
                },
            ]);
        });

        it('should return pharmacist intervention metrics', async () => {
            const response = await request(app)
                .get('/api/reports/pharmacist-interventions')
                .set('Authorization', `Bearer ${authToken}`)
                .query({
                    startDate: '2024-01-01',
                    endDate: '2024-12-31',
                    workplaceId: testWorkplace._id,
                });

            expect(response.status).toBe(200);
            expect(response.body.summary).toHaveProperty('totalInterventions');
            expect(response.body.summary).toHaveProperty('acceptanceRate');
            expect(response.body.summary.totalInterventions).toBe(3);
        });

        it('should filter by pharmacist ID', async () => {
            const response = await request(app)
                .get('/api/reports/pharmacist-interventions')
                .set('Authorization', `Bearer ${authToken}`)
                .query({
                    startDate: '2024-01-01',
                    endDate: '2024-12-31',
                    workplaceId: testWorkplace._id,
                    pharmacistId: testUser._id,
                });

            expect(response.status).toBe(200);
            expect(response.body.summary.totalInterventions).toBe(3);
        });

        it('should filter by intervention type', async () => {
            const response = await request(app)
                .get('/api/reports/pharmacist-interventions')
                .set('Authorization', `Bearer ${authToken}`)
                .query({
                    startDate: '2024-01-01',
                    endDate: '2024-12-31',
                    workplaceId: testWorkplace._id,
                    interventionType: 'medication-review',
                });

            expect(response.status).toBe(200);
            expect(response.body.summary.totalInterventions).toBe(1);
        });
    });

    describe('POST /api/reports/export', () => {
        it('should export report in PDF format', async () => {
            const response = await request(app)
                .post('/api/reports/export')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    reportType: 'patient-outcomes',
                    format: 'pdf',
                    filters: {
                        startDate: '2024-01-01',
                        endDate: '2024-12-31',
                        workplaceId: testWorkplace._id,
                    },
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('exportId');
            expect(response.body).toHaveProperty('downloadUrl');
        });

        it('should export report in CSV format', async () => {
            const response = await request(app)
                .post('/api/reports/export')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    reportType: 'patient-outcomes',
                    format: 'csv',
                    filters: {
                        startDate: '2024-01-01',
                        endDate: '2024-12-31',
                        workplaceId: testWorkplace._id,
                    },
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('exportId');
            expect(response.body).toHaveProperty('downloadUrl');
        });

        it('should validate export format', async () => {
            const response = await request(app)
                .post('/api/reports/export')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    reportType: 'patient-outcomes',
                    format: 'invalid-format',
                    filters: {
                        startDate: '2024-01-01',
                        endDate: '2024-12-31',
                        workplaceId: testWorkplace._id,
                    },
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });

        it('should require proper permissions for export', async () => {
            // Create user without export permission
            const limitedUser = await User.create({
                email: 'limited@example.com',
                password: 'password123',
                firstName: 'Limited',
                lastName: 'User',
                role: 'viewer',
                workplaceId: testWorkplace._id,
                permissions: ['reports:read'], // No export permission
            });

            const limitedToken = jwt.sign(
                { userId: limitedUser._id, workplaceId: testWorkplace._id },
                process.env.JWT_SECRET || 'test-secret',
                { expiresIn: '1h' }
            );

            const response = await request(app)
                .post('/api/reports/export')
                .set('Authorization', `Bearer ${limitedToken}`)
                .send({
                    reportType: 'patient-outcomes',
                    format: 'pdf',
                    filters: {
                        startDate: '2024-01-01',
                        endDate: '2024-12-31',
                        workplaceId: testWorkplace._id,
                    },
                });

            expect(response.status).toBe(403);
        });
    });

    describe('POST /api/reports/schedule', () => {
        it('should create a scheduled report', async () => {
            const response = await request(app)
                .post('/api/reports/schedule')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Weekly Patient Outcomes',
                    reportType: 'patient-outcomes',
                    frequency: 'weekly',
                    recipients: ['test@example.com'],
                    format: ['pdf'],
                    filters: {
                        workplaceId: testWorkplace._id,
                    },
                });

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('scheduleId');
            expect(response.body).toHaveProperty('nextRun');
        });

        it('should validate schedule frequency', async () => {
            const response = await request(app)
                .post('/api/reports/schedule')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Invalid Schedule',
                    reportType: 'patient-outcomes',
                    frequency: 'invalid-frequency',
                    recipients: ['test@example.com'],
                    format: ['pdf'],
                    filters: {
                        workplaceId: testWorkplace._id,
                    },
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });

        it('should validate email recipients', async () => {
            const response = await request(app)
                .post('/api/reports/schedule')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Invalid Recipients',
                    reportType: 'patient-outcomes',
                    frequency: 'weekly',
                    recipients: ['invalid-email'],
                    format: ['pdf'],
                    filters: {
                        workplaceId: testWorkplace._id,
                    },
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });
    });

    describe('Performance Tests', () => {
        beforeEach(async () => {
            // Create large dataset for performance testing
            const patients = [];
            const interventions = [];
            const mtrs = [];

            for (let i = 0; i < 100; i++) {
                const patient = {
                    firstName: `Patient${i}`,
                    lastName: 'Test',
                    dateOfBirth: new Date('1980-01-01'),
                    gender: 'male',
                    phone: `+123456789${i}`,
                    email: `patient${i}@example.com`,
                    workplaceId: testWorkplace._id,
                };
                patients.push(patient);
            }

            const createdPatients = await Patient.insertMany(patients);

            for (let i = 0; i < 500; i++) {
                const intervention = {
                    patientId: createdPatients[i % 100]._id,
                    pharmacistId: testUser._id,
                    workplaceId: testWorkplace._id,
                    type: 'medication-review',
                    description: `Intervention ${i}`,
                    status: 'completed',
                    outcome: 'improved',
                    createdAt: new Date(2024, Math.floor(i / 50), (i % 30) + 1),
                };
                interventions.push(intervention);
            }

            await ClinicalIntervention.insertMany(interventions);

            for (let i = 0; i < 200; i++) {
                const mtr = {
                    patientId: createdPatients[i % 100]._id,
                    pharmacistId: testUser._id,
                    workplaceId: testWorkplace._id,
                    reviewDate: new Date(2024, Math.floor(i / 20), (i % 28) + 1),
                    status: 'completed',
                    medications: [
                        {
                            name: `Medication ${i}`,
                            dosage: '10mg',
                            frequency: 'daily',
                            adherence: 80 + (i % 20),
                        },
                    ],
                    outcomes: {
                        clinicalImprovement: i % 2 === 0,
                        adherenceImprovement: i % 3 === 0,
                        qualityOfLifeScore: 6 + (i % 4),
                    },
                };
                mtrs.push(mtr);
            }

            await MedicationTherapyReview.insertMany(mtrs);
        });

        it('should handle large dataset queries within acceptable time', async () => {
            const startTime = Date.now();

            const response = await request(app)
                .get('/api/reports/patient-outcomes')
                .set('Authorization', `Bearer ${authToken}`)
                .query({
                    startDate: '2024-01-01',
                    endDate: '2024-12-31',
                    workplaceId: testWorkplace._id,
                });

            const endTime = Date.now();
            const responseTime = endTime - startTime;

            expect(response.status).toBe(200);
            expect(responseTime).toBeLessThan(5000); // Should respond within 5 seconds
            expect(response.body.summary.totalPatients).toBe(100);
            expect(response.body.summary.totalInterventions).toBe(500);
        });

        it('should handle concurrent requests efficiently', async () => {
            const requests = Array(10).fill(null).map(() =>
                request(app)
                    .get('/api/reports/patient-outcomes')
                    .set('Authorization', `Bearer ${authToken}`)
                    .query({
                        startDate: '2024-01-01',
                        endDate: '2024-12-31',
                        workplaceId: testWorkplace._id,
                    })
            );

            const startTime = Date.now();
            const responses = await Promise.all(requests);
            const endTime = Date.now();
            const totalTime = endTime - startTime;

            responses.forEach(response => {
                expect(response.status).toBe(200);
            });

            expect(totalTime).toBeLessThan(10000); // All requests should complete within 10 seconds
        });
    });
});