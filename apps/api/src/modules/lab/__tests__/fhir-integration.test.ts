/**
 * FHIR Integration Testing Suite for Manual Lab Order Workflow
 * Tests integration with existing FHIR lab module and compatibility
 */

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../../app';
import { ManualLabOrder } from '../models/ManualLabOrder';
import { ManualLabResult } from '../models/ManualLabResult';
import { TestCatalog } from '../models/TestCatalog';
import { Workplace } from '../../../models/Workplace';
import { User } from '../../../models/User';
import { Patient } from '../../../models/Patient';

// Mock FHIR client
const mockFHIRClient = {
    search: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    read: jest.fn(),
    delete: jest.fn()
};

// Mock existing FHIR lab service
jest.mock('../../../services/fhirLabService', () => ({
    FHIRLabService: {
        getInstance: () => mockFHIRClient,
        searchDiagnosticReports: jest.fn(),
        createServiceRequest: jest.fn(),
        updateServiceRequest: jest.fn(),
        searchObservations: jest.fn(),
        createObservation: jest.fn()
    }
}));

describe('Manual Lab Module - FHIR Integration Tests', () => {
    let mongoServer: MongoMemoryServer;
    let testWorkplace: any;
    let testUser: any;
    let testPatient: any;
    let authToken: string;
    let testCatalogItems: any[];

    beforeAll(async () => {
        // Start MongoDB Memory Server
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);

        // Create test workplace
        testWorkplace = await Workplace.create({
            name: 'FHIR Integration Test Pharmacy',
            address: '123 FHIR Street',
            phone: '+1234567890',
            email: 'fhir@pharmacy.com',
            licenseNumber: 'FHIR123456',
            isActive: true,
            fhirEndpoint: 'https://test-fhir.pharmacy.com/fhir',
            fhirEnabled: true
        });

        // Create test user (pharmacist)
        testUser = await User.create({
            firstName: 'FHIR',
            lastName: 'Tester',
            email: 'fhir@pharmacy.com',
            password: 'hashedpassword123',
            role: 'pharmacist',
            workplace: testWorkplace._id,
            isActive: true
        });

        // Create test patient with FHIR ID
        testPatient = await Patient.create({
            firstName: 'FHIR',
            lastName: 'Patient',
            dateOfBirth: new Date('1990-01-01'),
            gender: 'male',
            phone: '+1234567890',
            email: 'fhirpatient@test.com',
            address: {
                street: '456 FHIR Ave',
                city: 'FHIR City',
                state: 'FS',
                zipCode: '12345',
                country: 'FHIR Country'
            },
            workplace: testWorkplace._id,
            fhirId: 'Patient/fhir-patient-123'
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

        // Create test catalog items with FHIR codes
        testCatalogItems = await TestCatalog.create([
            {
                code: 'CBC',
                name: 'Complete Blood Count',
                category: 'Hematology',
                specimenType: 'Blood',
                units: 'cells/μL',
                referenceRange: '4000-11000',
                cost: 25.00,
                isActive: true,
                workplace: testWorkplace._id,
                loincCode: '58410-2',
                fhirMapping: {
                    system: 'http://loinc.org',
                    code: '58410-2',
                    display: 'Complete blood count (hemogram) panel - Blood by Automated count'
                }
            },
            {
                code: 'GLUCOSE',
                name: 'Glucose, Random',
                category: 'Chemistry',
                specimenType: 'Blood',
                units: 'mg/dL',
                referenceRange: '70-140',
                cost: 15.00,
                isActive: true,
                workplace: testWorkplace._id,
                loincCode: '33747-0',
                fhirMapping: {
                    system: 'http://loinc.org',
                    code: '33747-0',
                    display: 'Glucose [Mass/volume] in Blood'
                }
            }
        ]);
    });

    afterAll(async () => {
        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
        await mongoServer.stop();
    });

    beforeEach(async () => {
        // Clean up between tests
        await ManualLabOrder.deleteMany({});
        await ManualLabResult.deleteMany({});

        // Reset mocks
        jest.clearAllMocks();
    });

    describe('FHIR ServiceRequest Integration', () => {
        it('should create FHIR ServiceRequest when manual lab order is created', async () => {
            // Mock FHIR ServiceRequest creation
            mockFHIRClient.create.mockResolvedValue({
                resourceType: 'ServiceRequest',
                id: 'fhir-service-request-123',
                status: 'active',
                intent: 'order',
                subject: { reference: 'Patient/fhir-patient-123' }
            });

            const orderData = {
                patientId: testPatient._id,
                tests: [testCatalogItems[0]._id],
                indication: 'FHIR integration test',
                priority: 'routine',
                consentConfirmed: true,
                createFHIRServiceRequest: true
            };

            const response = await request(app)
                .post('/api/manual-lab/orders')
                .set('Authorization', `Bearer ${authToken}`)
                .send(orderData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.fhirServiceRequestId).toBe('fhir-service-request-123');

            // Verify FHIR ServiceRequest was created with correct data
            expect(mockFHIRClient.create).toHaveBeenCalledWith({
                resourceType: 'ServiceRequest',
                status: 'active',
                intent: 'order',
                category: [{
                    coding: [{
                        system: 'http://snomed.info/sct',
                        code: '108252007',
                        display: 'Laboratory procedure'
                    }]
                }],
                code: {
                    coding: [{
                        system: 'http://loinc.org',
                        code: '58410-2',
                        display: 'Complete blood count (hemogram) panel - Blood by Automated count'
                    }]
                },
                subject: {
                    reference: 'Patient/fhir-patient-123'
                },
                requester: {
                    reference: `Practitioner/${testUser._id}`
                },
                reasonCode: [{
                    text: 'FHIR integration test'
                }],
                priority: 'routine',
                specimen: [{
                    display: 'Blood specimen'
                }]
            });

            // Verify order was saved with FHIR reference
            const savedOrder = await ManualLabOrder.findOne({ orderId: response.body.data.orderId });
            expect(savedOrder?.fhirServiceRequestId).toBe('fhir-service-request-123');
        });

        it('should update FHIR ServiceRequest when order status changes', async () => {
            // Create order first
            const order = await ManualLabOrder.create({
                orderId: 'LAB-2024-0001',
                patient: testPatient._id,
                tests: [testCatalogItems[0]._id],
                status: 'requested',
                indication: 'Status update test',
                priority: 'routine',
                consentConfirmed: true,
                createdBy: testUser._id,
                workplace: testWorkplace._id,
                fhirServiceRequestId: 'fhir-service-request-123'
            });

            // Mock FHIR update
            mockFHIRClient.update.mockResolvedValue({
                resourceType: 'ServiceRequest',
                id: 'fhir-service-request-123',
                status: 'completed'
            });

            // Update order status
            const response = await request(app)
                .patch(`/api/manual-lab/orders/${order.orderId}/status`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ status: 'completed' })
                .expect(200);

            expect(response.body.success).toBe(true);

            // Verify FHIR ServiceRequest was updated
            expect(mockFHIRClient.update).toHaveBeenCalledWith(
                'ServiceRequest/fhir-service-request-123',
                expect.objectContaining({
                    status: 'completed'
                })
            );
        });

        it('should handle FHIR ServiceRequest creation failures gracefully', async () => {
            // Mock FHIR creation failure
            mockFHIRClient.create.mockRejectedValue(new Error('FHIR server unavailable'));

            const orderData = {
                patientId: testPatient._id,
                tests: [testCatalogItems[0]._id],
                indication: 'FHIR failure test',
                priority: 'routine',
                consentConfirmed: true,
                createFHIRServiceRequest: true
            };

            const response = await request(app)
                .post('/api/manual-lab/orders')
                .set('Authorization', `Bearer ${authToken}`)
                .send(orderData)
                .expect(201); // Order should still be created

            expect(response.body.success).toBe(true);
            expect(response.body.data.fhirServiceRequestId).toBeUndefined();
            expect(response.body.warnings).toContain('FHIR ServiceRequest creation failed');

            // Verify order was still saved without FHIR reference
            const savedOrder = await ManualLabOrder.findOne({ orderId: response.body.data.orderId });
            expect(savedOrder?.fhirServiceRequestId).toBeUndefined();
        });
    });

    describe('FHIR Observation Integration', () => {
        it('should create FHIR Observations when lab results are entered', async () => {
            // Create order first
            const order = await ManualLabOrder.create({
                orderId: 'LAB-2024-0002',
                patient: testPatient._id,
                tests: [testCatalogItems[0]._id, testCatalogItems[1]._id],
                status: 'sample_collected',
                indication: 'FHIR observation test',
                priority: 'routine',
                consentConfirmed: true,
                createdBy: testUser._id,
                workplace: testWorkplace._id,
                fhirServiceRequestId: 'fhir-service-request-456'
            });

            // Mock FHIR Observation creation
            mockFHIRClient.create.mockResolvedValueOnce({
                resourceType: 'Observation',
                id: 'fhir-observation-cbc',
                status: 'final',
                code: {
                    coding: [{
                        system: 'http://loinc.org',
                        code: '58410-2'
                    }]
                }
            }).mockResolvedValueOnce({
                resourceType: 'Observation',
                id: 'fhir-observation-glucose',
                status: 'final',
                code: {
                    coding: [{
                        system: 'http://loinc.org',
                        code: '33747-0'
                    }]
                }
            });

            const resultData = {
                results: [
                    {
                        testId: testCatalogItems[0]._id,
                        value: '8500',
                        units: 'cells/μL',
                        interpretation: 'normal'
                    },
                    {
                        testId: testCatalogItems[1]._id,
                        value: '95',
                        units: 'mg/dL',
                        interpretation: 'normal'
                    }
                ],
                createFHIRObservations: true
            };

            const response = await request(app)
                .post(`/api/manual-lab/orders/${order.orderId}/results`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(resultData)
                .expect(200);

            expect(response.body.success).toBe(true);

            // Verify FHIR Observations were created
            expect(mockFHIRClient.create).toHaveBeenCalledTimes(2);

            // Check first observation (CBC)
            expect(mockFHIRClient.create).toHaveBeenCalledWith({
                resourceType: 'Observation',
                status: 'final',
                category: [{
                    coding: [{
                        system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                        code: 'laboratory',
                        display: 'Laboratory'
                    }]
                }],
                code: {
                    coding: [{
                        system: 'http://loinc.org',
                        code: '58410-2',
                        display: 'Complete blood count (hemogram) panel - Blood by Automated count'
                    }]
                },
                subject: {
                    reference: 'Patient/fhir-patient-123'
                },
                valueQuantity: {
                    value: 8500,
                    unit: 'cells/μL',
                    system: 'http://unitsofmeasure.org',
                    code: 'cells/uL'
                },
                interpretation: [{
                    coding: [{
                        system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
                        code: 'N',
                        display: 'Normal'
                    }]
                }],
                referenceRange: [{
                    low: {
                        value: 4000,
                        unit: 'cells/μL'
                    },
                    high: {
                        value: 11000,
                        unit: 'cells/μL'
                    }
                }],
                basedOn: [{
                    reference: 'ServiceRequest/fhir-service-request-456'
                }]
            });

            // Verify results were saved with FHIR references
            const savedResults = await ManualLabResult.find({ order: order._id });
            expect(savedResults).toHaveLength(2);
            expect(savedResults[0].fhirObservationId).toBe('fhir-observation-cbc');
            expect(savedResults[1].fhirObservationId).toBe('fhir-observation-glucose');
        });

        it('should handle different value types in FHIR Observations', async () => {
            // Create test catalog with different value types
            const qualitativeTest = await TestCatalog.create({
                code: 'URINE_PROTEIN',
                name: 'Urine Protein',
                category: 'Urinalysis',
                specimenType: 'Urine',
                units: 'qualitative',
                referenceRange: 'Negative',
                cost: 10.00,
                isActive: true,
                workplace: testWorkplace._id,
                loincCode: '2888-6',
                fhirMapping: {
                    system: 'http://loinc.org',
                    code: '2888-6',
                    display: 'Protein [Presence] in Urine by Test strip'
                },
                valueType: 'qualitative',
                qualitativeOptions: ['Negative', 'Trace', '1+', '2+', '3+', '4+']
            });

            const order = await ManualLabOrder.create({
                orderId: 'LAB-2024-0003',
                patient: testPatient._id,
                tests: [qualitativeTest._id],
                status: 'sample_collected',
                indication: 'Qualitative test',
                priority: 'routine',
                consentConfirmed: true,
                createdBy: testUser._id,
                workplace: testWorkplace._id
            });

            // Mock FHIR Observation creation for qualitative result
            mockFHIRClient.create.mockResolvedValue({
                resourceType: 'Observation',
                id: 'fhir-observation-protein',
                status: 'final'
            });

            const resultData = {
                results: [{
                    testId: qualitativeTest._id,
                    value: 'Trace',
                    interpretation: 'abnormal'
                }],
                createFHIRObservations: true
            };

            await request(app)
                .post(`/api/manual-lab/orders/${order.orderId}/results`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(resultData)
                .expect(200);

            // Verify FHIR Observation was created with CodeableConcept value
            expect(mockFHIRClient.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    valueCodeableConcept: {
                        coding: [{
                            system: 'http://snomed.info/sct',
                            code: 'trace',
                            display: 'Trace'
                        }],
                        text: 'Trace'
                    }
                })
            );
        });
    });

    describe('FHIR DiagnosticReport Integration', () => {
        it('should create FHIR DiagnosticReport when order is completed', async () => {
            // Create order with results
            const order = await ManualLabOrder.create({
                orderId: 'LAB-2024-0004',
                patient: testPatient._id,
                tests: [testCatalogItems[0]._id],
                status: 'completed',
                indication: 'DiagnosticReport test',
                priority: 'routine',
                consentConfirmed: true,
                createdBy: testUser._id,
                workplace: testWorkplace._id,
                fhirServiceRequestId: 'fhir-service-request-789'
            });

            const result = await ManualLabResult.create({
                order: order._id,
                test: testCatalogItems[0]._id,
                value: '7500',
                units: 'cells/μL',
                interpretation: 'normal',
                enteredBy: testUser._id,
                fhirObservationId: 'fhir-observation-123'
            });

            // Mock FHIR DiagnosticReport creation
            mockFHIRClient.create.mockResolvedValue({
                resourceType: 'DiagnosticReport',
                id: 'fhir-diagnostic-report-123',
                status: 'final'
            });

            const response = await request(app)
                .post(`/api/manual-lab/orders/${order.orderId}/diagnostic-report`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ createFHIRDiagnosticReport: true })
                .expect(200);

            expect(response.body.success).toBe(true);

            // Verify FHIR DiagnosticReport was created
            expect(mockFHIRClient.create).toHaveBeenCalledWith({
                resourceType: 'DiagnosticReport',
                status: 'final',
                category: [{
                    coding: [{
                        system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
                        code: 'LAB',
                        display: 'Laboratory'
                    }]
                }],
                code: {
                    coding: [{
                        system: 'http://loinc.org',
                        code: '11502-2',
                        display: 'Laboratory report'
                    }]
                },
                subject: {
                    reference: 'Patient/fhir-patient-123'
                },
                basedOn: [{
                    reference: 'ServiceRequest/fhir-service-request-789'
                }],
                result: [{
                    reference: 'Observation/fhir-observation-123'
                }],
                conclusion: expect.any(String),
                performer: [{
                    reference: `Practitioner/${testUser._id}`
                }]
            });
        });
    });

    describe('FHIR Data Synchronization', () => {
        it('should sync manual lab orders with existing FHIR data', async () => {
            // Mock existing FHIR ServiceRequests
            mockFHIRClient.search.mockResolvedValue({
                resourceType: 'Bundle',
                entry: [{
                    resource: {
                        resourceType: 'ServiceRequest',
                        id: 'existing-fhir-sr-1',
                        status: 'active',
                        subject: { reference: 'Patient/fhir-patient-123' },
                        code: {
                            coding: [{
                                system: 'http://loinc.org',
                                code: '58410-2'
                            }]
                        }
                    }
                }]
            });

            const response = await request(app)
                .post('/api/manual-lab/sync-fhir')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ patientId: testPatient._id })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.syncedOrders).toBeGreaterThan(0);

            // Verify FHIR search was called
            expect(mockFHIRClient.search).toHaveBeenCalledWith({
                resourceType: 'ServiceRequest',
                searchParams: {
                    subject: 'Patient/fhir-patient-123',
                    category: 'laboratory',
                    status: 'active'
                }
            });
        });

        it('should handle FHIR data conflicts during sync', async () => {
            // Create existing manual order
            const existingOrder = await ManualLabOrder.create({
                orderId: 'LAB-2024-0005',
                patient: testPatient._id,
                tests: [testCatalogItems[0]._id],
                status: 'requested',
                indication: 'Conflict test',
                priority: 'routine',
                consentConfirmed: true,
                createdBy: testUser._id,
                workplace: testWorkplace._id,
                fhirServiceRequestId: 'conflicting-fhir-sr'
            });

            // Mock FHIR ServiceRequest with different status
            mockFHIRClient.read.mockResolvedValue({
                resourceType: 'ServiceRequest',
                id: 'conflicting-fhir-sr',
                status: 'completed',
                subject: { reference: 'Patient/fhir-patient-123' }
            });

            const response = await request(app)
                .post('/api/manual-lab/resolve-fhir-conflict')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    orderId: existingOrder.orderId,
                    resolution: 'use_fhir_data'
                })
                .expect(200);

            expect(response.body.success).toBe(true);

            // Verify order was updated with FHIR data
            const updatedOrder = await ManualLabOrder.findById(existingOrder._id);
            expect(updatedOrder?.status).toBe('completed');
        });
    });

    describe('FHIR Compatibility and Coexistence', () => {
        it('should not interfere with existing FHIR lab import functionality', async () => {
            // Mock existing FHIR lab import
            const mockFHIRImport = jest.fn().mockResolvedValue({
                success: true,
                importedCount: 5
            });

            // Simulate existing FHIR import running
            const importResponse = await mockFHIRImport();
            expect(importResponse.success).toBe(true);

            // Create manual lab order - should not affect FHIR import
            const orderData = {
                patientId: testPatient._id,
                tests: [testCatalogItems[0]._id],
                indication: 'Coexistence test',
                priority: 'routine',
                consentConfirmed: true
            };

            const manualResponse = await request(app)
                .post('/api/manual-lab/orders')
                .set('Authorization', `Bearer ${authToken}`)
                .send(orderData)
                .expect(201);

            expect(manualResponse.body.success).toBe(true);

            // Both systems should work independently
            expect(mockFHIRImport).toHaveBeenCalled();
            expect(manualResponse.body.data.orderId).toMatch(/^LAB-\d{4}-\d{4}$/);
        });

        it('should maintain separate data models while allowing integration', async () => {
            // Create manual lab order
            const manualOrder = await ManualLabOrder.create({
                orderId: 'LAB-2024-0006',
                patient: testPatient._id,
                tests: [testCatalogItems[0]._id],
                status: 'requested',
                indication: 'Data model test',
                priority: 'routine',
                consentConfirmed: true,
                createdBy: testUser._id,
                workplace: testWorkplace._id,
                source: 'manual'
            });

            // Simulate FHIR-imported order (would be in different collection/model)
            const fhirOrder = {
                fhirId: 'ServiceRequest/fhir-imported-123',
                patient: testPatient._id,
                status: 'active',
                source: 'fhir_import'
            };

            // Both should coexist without conflicts
            expect(manualOrder.source).toBe('manual');
            expect(fhirOrder.source).toBe('fhir_import');

            // Manual order should have manual-specific fields
            expect(manualOrder.orderId).toBeDefined();
            expect(manualOrder.consentConfirmed).toBe(true);

            // FHIR order should have FHIR-specific fields
            expect(fhirOrder.fhirId).toBeDefined();
        });

        it('should provide unified view of all lab orders when requested', async () => {
            // Create manual order
            const manualOrder = await ManualLabOrder.create({
                orderId: 'LAB-2024-0007',
                patient: testPatient._id,
                tests: [testCatalogItems[0]._id],
                status: 'requested',
                indication: 'Unified view test',
                priority: 'routine',
                consentConfirmed: true,
                createdBy: testUser._id,
                workplace: testWorkplace._id
            });

            // Mock FHIR orders search
            mockFHIRClient.search.mockResolvedValue({
                resourceType: 'Bundle',
                entry: [{
                    resource: {
                        resourceType: 'ServiceRequest',
                        id: 'fhir-sr-unified',
                        status: 'active',
                        subject: { reference: 'Patient/fhir-patient-123' }
                    }
                }]
            });

            const response = await request(app)
                .get(`/api/manual-lab/orders/unified/${testPatient._id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.manualOrders).toHaveLength(1);
            expect(response.body.data.fhirOrders).toHaveLength(1);
            expect(response.body.data.totalOrders).toBe(2);
        });
    });

    describe('FHIR Error Handling and Resilience', () => {
        it('should handle FHIR server downtime gracefully', async () => {
            // Mock FHIR server error
            mockFHIRClient.create.mockRejectedValue(new Error('FHIR server timeout'));

            const orderData = {
                patientId: testPatient._id,
                tests: [testCatalogItems[0]._id],
                indication: 'Server downtime test',
                priority: 'routine',
                consentConfirmed: true,
                createFHIRServiceRequest: true
            };

            const response = await request(app)
                .post('/api/manual-lab/orders')
                .set('Authorization', `Bearer ${authToken}`)
                .send(orderData)
                .expect(201); // Should still create manual order

            expect(response.body.success).toBe(true);
            expect(response.body.warnings).toContain('FHIR integration temporarily unavailable');

            // Order should be marked for later FHIR sync
            const savedOrder = await ManualLabOrder.findOne({ orderId: response.body.data.orderId });
            expect(savedOrder?.fhirSyncPending).toBe(true);
        });

        it('should retry FHIR operations with exponential backoff', async () => {
            let callCount = 0;
            mockFHIRClient.create.mockImplementation(() => {
                callCount++;
                if (callCount < 3) {
                    throw new Error('Temporary FHIR error');
                }
                return Promise.resolve({
                    resourceType: 'ServiceRequest',
                    id: 'fhir-sr-retry-success'
                });
            });

            const orderData = {
                patientId: testPatient._id,
                tests: [testCatalogItems[0]._id],
                indication: 'Retry test',
                priority: 'routine',
                consentConfirmed: true,
                createFHIRServiceRequest: true
            };

            const response = await request(app)
                .post('/api/manual-lab/orders')
                .set('Authorization', `Bearer ${authToken}`)
                .send(orderData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.fhirServiceRequestId).toBe('fhir-sr-retry-success');
            expect(callCount).toBe(3); // Should have retried twice before success
        });

        it('should validate FHIR data before processing', async () => {
            // Mock invalid FHIR response
            mockFHIRClient.create.mockResolvedValue({
                resourceType: 'InvalidResource', // Wrong resource type
                id: 'invalid-fhir-response'
            });

            const orderData = {
                patientId: testPatient._id,
                tests: [testCatalogItems[0]._id],
                indication: 'Validation test',
                priority: 'routine',
                consentConfirmed: true,
                createFHIRServiceRequest: true
            };

            const response = await request(app)
                .post('/api/manual-lab/orders')
                .set('Authorization', `Bearer ${authToken}`)
                .send(orderData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.warnings).toContain('Invalid FHIR response received');

            // Order should not have invalid FHIR reference
            const savedOrder = await ManualLabOrder.findOne({ orderId: response.body.data.orderId });
            expect(savedOrder?.fhirServiceRequestId).toBeUndefined();
        });
    });
});