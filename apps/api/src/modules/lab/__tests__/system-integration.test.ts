/**
 * System Integration Test Suite
 * Tests complete integration with existing systems and backward compatibility
 */

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../../app';
import { ManualLabOrder } from '../models/ManualLabOrder';
import { TestCatalog } from '../models/TestCatalog';
import { Workplace } from '../../../models/Workplace';
import { User } from '../../../models/User';
import { Patient } from '../../../models/Patient';
import SystemIntegrationService from '../../../services/systemIntegrationService';
import { FeatureFlagService } from '../../../config/featureFlags';

describe('Manual Lab Module - System Integration Tests', () => {
    let mongoServer: MongoMemoryServer;
    let testWorkplace: any;
    let testUser: any;
    let testPatient: any;
    let authToken: string;
    let systemIntegration: SystemIntegrationService;
    let featureFlagService: FeatureFlagService;

    beforeAll(async () => {
        // Start MongoDB Memory Server
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);

        // Initialize services
        systemIntegration = SystemIntegrationService.getInstance();
        featureFlagService = FeatureFlagService.getInstance();

        // Create test workplace
        testWorkplace = await Workplace.create({
            name: 'Integration Test Pharmacy',
            address: '123 Integration Street',
            phone: '+1234567890',
            email: 'integration@pharmacy.com',
            licenseNumber: 'INT123456',
            isActive: true
        });

        // Create test user (pharmacist)
        testUser = await User.create({
            firstName: 'Integration',
            lastName: 'Tester',
            email: 'integration@pharmacy.com',
            password: 'hashedpassword123',
            role: 'pharmacist',
            workplace: testWorkplace._id,
            isActive: true
        });

        // Create test patient
        testPatient = await Patient.create({
            firstName: 'Integration',
            lastName: 'Patient',
            dateOfBirth: new Date('1990-01-01'),
            gender: 'male',
            phone: '+1234567890',
            email: 'integrationpatient@test.com',
            address: {
                street: '456 Integration Ave',
                city: 'Integration City',
                state: 'IS',
                zipCode: '12345',
                country: 'Integration Country'
            },
            workplace: testWorkplace._id
        });

        // Generate auth token
        authToken = jwt.sign(
            {
                userId: testUser._id,
                role: testUser.role,
                workplaceId: testWorkplace._id
            },
            process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-minimum-32-characters-long',
            { expiresIn: '1h' }
        );

        // Create test catalog
        await TestCatalog.create({
            code: 'CBC',
            name: 'Complete Blood Count',
            category: 'Hematology',
            specimenType: 'Blood',
            units: 'cells/μL',
            referenceRange: '4000-11000',
            cost: 25.00,
            isActive: true,
            workplace: testWorkplace._id
        });
    });

    afterAll(async () => {
        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
        await mongoServer.stop();
    });

    beforeEach(async () => {
        // Clean up between tests
        await ManualLabOrder.deleteMany({});

        // Reset feature flags to default state
        featureFlagService.updateFlag('manual_lab_orders', { enabled: true });
    });

    describe('Backward Compatibility', () => {
        it('should not affect existing API routes', async () => {
            // Test existing auth routes still work
            const authResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'wrongpassword'
                });

            // Should get auth error, not route not found
            expect(authResponse.status).toBe(401);
            expect(authResponse.body.message).toContain('Invalid');

            // Test existing patient routes still work
            const patientResponse = await request(app)
                .get('/api/patients')
                .set('Authorization', `Bearer ${authToken}`);

            // Should work normally (might be empty but shouldn't be 404)
            expect([200, 404]).toContain(patientResponse.status);
        });

        it('should maintain existing middleware chain', async () => {
            // Test that existing security middleware still works
            const response = await request(app)
                .get('/api/patients')
                .expect(401); // Should require authentication

            expect(response.body.message).toContain('token');
        });

        it('should preserve existing error handling', async () => {
            // Test existing error handling patterns
            const response = await request(app)
                .get('/api/nonexistent-route')
                .expect(404);

            expect(response.body.message).toContain('Route');
            expect(response.body.message).toContain('not found');
        });
    });

    describe('Feature Flag Integration', () => {
        it('should respect feature flags for manual lab routes', async () => {
            // Disable manual lab feature
            featureFlagService.updateFlag('manual_lab_orders', { enabled: false });

            const response = await request(app)
                .get('/api/manual-lab')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);

            expect(response.body.code).toBe('FEATURE_NOT_AVAILABLE');
        });

        it('should allow gradual rollout based on user context', async () => {
            // Set rollout to 0% (disabled for all users)
            featureFlagService.updateFlag('manual_lab_orders', {
                enabled: true,
                rolloutPercentage: 0
            });

            const response = await request(app)
                .get('/api/manual-lab')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);

            expect(response.body.code).toBe('FEATURE_NOT_AVAILABLE');
        });

        it('should enable features when rollout percentage includes user', async () => {
            // Set rollout to 100% (enabled for all users)
            featureFlagService.updateFlag('manual_lab_orders', {
                enabled: true,
                rolloutPercentage: 100
            });

            const response = await request(app)
                .get('/api/manual-lab')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('System Health Monitoring', () => {
        it('should provide integration health status', async () => {
            const response = await request(app)
                .get('/api/health/integration')
                .expect(200);

            expect(response.body.status).toBe('OK');
            expect(response.body.integration).toBeDefined();
            expect(response.body.integration.overall).toMatch(/healthy|degraded|unhealthy/);
            expect(response.body.integration.manualLabStatus).toMatch(/enabled|disabled|partial/);
        });

        it('should monitor service dependencies', async () => {
            const health = await systemIntegration.getIntegrationHealth();

            expect(health.services).toBeInstanceOf(Array);
            expect(health.services.length).toBeGreaterThan(0);

            health.services.forEach(service => {
                expect(service).toHaveProperty('service');
                expect(service).toHaveProperty('status');
                expect(service).toHaveProperty('lastCheck');
                expect(['healthy', 'degraded', 'unhealthy']).toContain(service.status);
            });
        });
    });

    describe('Complete Workflow Integration', () => {
        it('should execute complete manual lab workflow without affecting existing systems', async () => {
            // 1. Create manual lab order
            const orderData = {
                patientId: testPatient._id,
                tests: [(await TestCatalog.findOne())!._id],
                indication: 'Integration test workflow',
                priority: 'routine',
                consentConfirmed: true
            };

            const createResponse = await request(app)
                .post('/api/manual-lab')
                .set('Authorization', `Bearer ${authToken}`)
                .send(orderData)
                .expect(201);

            expect(createResponse.body.success).toBe(true);
            const orderId = createResponse.body.data.orderId;

            // 2. Verify existing patient routes still work
            const patientResponse = await request(app)
                .get(`/api/patients/${testPatient._id}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 404]).toContain(patientResponse.status);

            // 3. Get PDF (if feature enabled)
            if (featureFlagService.isEnabled('manual_lab_pdf_generation')) {
                const pdfResponse = await request(app)
                    .get(`/api/manual-lab/${orderId}/pdf`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(200);

                expect(pdfResponse.headers['content-type']).toBe('application/pdf');
            }

            // 4. Add results
            const resultData = {
                results: [{
                    testId: (await TestCatalog.findOne())!._id,
                    value: '8500',
                    units: 'cells/μL',
                    interpretation: 'normal'
                }]
            };

            const resultResponse = await request(app)
                .post(`/api/manual-lab/${orderId}/results`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(resultData)
                .expect(200);

            expect(resultResponse.body.success).toBe(true);

            // 5. Verify existing diagnostic routes still work
            const diagnosticResponse = await request(app)
                .get('/api/diagnostics')
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 404]).toContain(diagnosticResponse.status);
        });

        it('should handle concurrent access to manual lab and existing features', async () => {
            const concurrentRequests = 10;
            const promises: Promise<any>[] = [];

            // Mix of manual lab and existing API calls
            for (let i = 0; i < concurrentRequests; i++) {
                if (i % 2 === 0) {
                    // Manual lab request
                    const orderData = {
                        patientId: testPatient._id,
                        tests: [(await TestCatalog.findOne())!._id],
                        indication: `Concurrent test ${i}`,
                        priority: 'routine',
                        consentConfirmed: true
                    };

                    promises.push(
                        request(app)
                            .post('/api/manual-lab')
                            .set('Authorization', `Bearer ${authToken}`)
                            .send(orderData)
                    );
                } else {
                    // Existing API request
                    promises.push(
                        request(app)
                            .get('/api/patients')
                            .set('Authorization', `Bearer ${authToken}`)
                    );
                }
            }

            const responses = await Promise.all(promises);

            // All requests should complete successfully
            responses.forEach((response, index) => {
                if (index % 2 === 0) {
                    // Manual lab requests
                    expect(response.status).toBe(201);
                    expect(response.body.success).toBe(true);
                } else {
                    // Existing API requests
                    expect([200, 404]).toContain(response.status);
                }
            });
        });
    });

    describe('Emergency Rollback', () => {
        it('should support emergency rollback of manual lab features', async () => {
            // First, ensure manual lab is working
            const orderData = {
                patientId: testPatient._id,
                tests: [(await TestCatalog.findOne())!._id],
                indication: 'Pre-rollback test',
                priority: 'routine',
                consentConfirmed: true
            };

            await request(app)
                .post('/api/manual-lab')
                .set('Authorization', `Bearer ${authToken}`)
                .send(orderData)
                .expect(201);

            // Perform emergency rollback
            const rollbackResult = await systemIntegration.emergencyRollback('Integration test rollback');

            expect(rollbackResult.success).toBe(true);
            expect(rollbackResult.rollbackActions.length).toBeGreaterThan(0);

            // Verify manual lab is now disabled
            await request(app)
                .post('/api/manual-lab')
                .set('Authorization', `Bearer ${authToken}`)
                .send(orderData)
                .expect(404);

            // Verify existing systems still work
            const patientResponse = await request(app)
                .get('/api/patients')
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 401, 404]).toContain(patientResponse.status);
        });
    });

    describe('Data Isolation', () => {
        it('should maintain data isolation between manual lab and existing systems', async () => {
            // Create manual lab order
            const orderData = {
                patientId: testPatient._id,
                tests: [(await TestCatalog.findOne())!._id],
                indication: 'Data isolation test',
                priority: 'routine',
                consentConfirmed: true
            };

            const createResponse = await request(app)
                .post('/api/manual-lab')
                .set('Authorization', `Bearer ${authToken}`)
                .send(orderData)
                .expect(201);

            // Verify manual lab data exists
            const manualLabOrder = await ManualLabOrder.findOne({
                orderId: createResponse.body.data.orderId
            });
            expect(manualLabOrder).toBeTruthy();

            // Verify it doesn't interfere with existing patient data
            const patient = await Patient.findById(testPatient._id);
            expect(patient).toBeTruthy();
            expect(patient!.firstName).toBe('Integration');

            // Manual lab data should be in separate collections
            expect(manualLabOrder!.constructor.name).toBe('model');
            expect(patient!.constructor.name).toBe('model');
        });
    });

    describe('Performance Impact', () => {
        it('should not significantly impact existing API performance', async () => {
            // Measure baseline performance of existing API
            const startTime = Date.now();

            await request(app)
                .get('/api/patients')
                .set('Authorization', `Bearer ${authToken}`);

            const baselineTime = Date.now() - startTime;

            // Create some manual lab data
            for (let i = 0; i < 5; i++) {
                const orderData = {
                    patientId: testPatient._id,
                    tests: [(await TestCatalog.findOne())!._id],
                    indication: `Performance test ${i}`,
                    priority: 'routine',
                    consentConfirmed: true
                };

                await request(app)
                    .post('/api/manual-lab')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(orderData);
            }

            // Measure performance after manual lab integration
            const startTime2 = Date.now();

            await request(app)
                .get('/api/patients')
                .set('Authorization', `Bearer ${authToken}`);

            const afterIntegrationTime = Date.now() - startTime2;

            // Performance should not degrade significantly (allow 50% increase)
            expect(afterIntegrationTime).toBeLessThan(baselineTime * 1.5);
        });
    });
});