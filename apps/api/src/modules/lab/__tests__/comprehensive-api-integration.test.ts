import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import express from 'express';
import jwt from 'jsonwebtoken';

// Import app components
import manualLabRoutes from '../routes/manualLabRoutes';
import { auth } from '../../../middlewares/auth';
import rbac from '../../../middlewares/rbac';

// Import models
import ManualLabOrder from '../models/ManualLabOrder';
import ManualLabResult from '../models/ManualLabResult';
import Patient from '../../../models/Patient';
import User from '../../../models/User';
import Workplace from '../../../models/Workplace';

// Import services
import ManualLabService from '../services/manualLabService';
import { PDFGenerationService } from '../services/pdfGenerationService';
import { AuditService } from '../../../services/auditService';

// Mock external services
jest.mock('../services/pdfGenerationService');
jest.mock('../../../services/auditService');
jest.mock('../../../services/openRouterService');
jest.mock('../../diagnostics/services/diagnosticService');

describe('Manual Lab API Integration Tests', () => {
    let app: express.Application;
    let mongoServer: MongoMemoryServer;
    let testWorkplace: any;
    let testPatient: any;
    let testUser: any;
    let authToken: string;

    beforeAll(async () => {
        // Start in-memory MongoDB
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);

        // Create Express app for testing
        app = express();
        app.use(express.json());
        app.use('/api/manual-lab-orders', manualLabRoutes);

        // Set up environment variables
        process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-minimum-32-characters-long';
        process.env.LAB_TOKEN_SECRET = 'test-lab-token-secret-key-minimum-32-characters-long';
        process.env.FRONTEND_URL = 'https://test.PharmacyCopilot.com';
    });

    afterAll(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    beforeEach(async () => {
        // Clear all collections
        await Promise.all([
            ManualLabOrder.deleteMany({}),
            ManualLabResult.deleteMany({}),
            Patient.deleteMany({}),
            User.deleteMany({}),
            Workplace.deleteMany({})
        ]);

        // Create test data
        testWorkplace = await Workplace.create({
            name: 'Test Pharmacy',
            address: '123 Test St',
            phone: '555-0123',
            email: 'test@pharmacy.com',
            licenseNumber: 'PH123456',
            isActive: true
        });

        testUser = await User.create({
            firstName: 'Test',
            lastName: 'Pharmacist',
            email: 'pharmacist@test.com',
            password: 'hashedpassword',
            role: 'pharmacist',
            workplaceId: testWorkplace._id,
            workplaceRole: 'Pharmacist',
            isActive: true
        });

        testPatient = await Patient.create({
            firstName: 'John',
            lastName: 'Doe',
            mrn: 'MRN123456',
            dateOfBirth: new Date('1980-01-01'),
            gender: 'male',
            workplaceId: testWorkplace._id,
            createdBy: testUser._id
        });

        // Generate auth token
        authToken = jwt.sign(
            {
                userId: testUser._id,
                email: testUser.email,
                role: testUser.role,
                workplaceId: testWorkplace._id,
                workplaceRole: testUser.workplaceRole
            },
            process.env.JWT_SECRET!,
            { expiresIn: '1h' }
        );

        // Mock services
        (AuditService.logActivity as jest.Mock).mockResolvedValue(undefined);

        const mockPDFService = PDFGenerationService as jest.MockedClass<typeof PDFGenerationService>;
        mockPDFService.prototype.generateRequisitionPDF = jest.fn().mockResolvedValue({
            pdfBuffer: Buffer.from('mock-pdf-content'),
            fileName: 'lab-requisition-LAB-2024-0001-123456.pdf',
            url: '/api/manual-lab-orders/LAB-2024-0001/pdf',
            metadata: {
                orderId: 'LAB-2024-0001',
                fileSize: 1024,
                generatedAt: new Date()
            }
        });

        mockPDFService.prototype.validateGenerationRequirements = jest.fn();

        jest.clearAllMocks();
    });

    describe('POST /api/manual-lab-orders - Create Order', () => {
        const validOrderData = {
            patientId: '',
            tests: [
                {
                    name: 'Complete Blood Count',
                    code: 'CBC',
                    specimenType: 'Blood',
                    unit: 'cells/μL',
                    refRange: '4.5-11.0 x10³',
                    category: 'Hematology'
                }
            ],
            indication: 'Routine screening',
            priority: 'routine',
            consentObtained: true,
            consentObtainedBy: ''
        };

        beforeEach(() => {
            validOrderData.patientId = testPatient._id.toString();
            validOrderData.consentObtainedBy = testUser._id.toString();
        });

        it('should create a new manual lab order successfully', async () => {
            const response = await request(app)
                .post('/api/manual-lab-orders')
                .set('Authorization', `Bearer ${authToken}`)
                .send(validOrderData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Manual lab order created successfully');
            expect(response.body.data.order).toBeDefined();
            expect(response.body.data.order.orderId).toMatch(/^LAB-\d{4}-\d{4}$/);
            expect(response.body.data.order.patientId).toBe(testPatient._id.toString());
            expect(response.body.data.order.tests).toHaveLength(1);
            expect(response.body.data.order.status).toBe('requested');
            expect(response.body.data.order.testCount).toBe(1);

            // Verify order was created in database
            const savedOrder = await ManualLabOrder.findOne({ orderId: response.body.data.order.orderId });
            expect(savedOrder).toBeDefined();
            expect(savedOrder!.patientId.toString()).toBe(testPatient._id.toString());
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .post('/api/manual-lab-orders')
                .send(validOrderData)
                .expect(401);

            expect(response.body.success).toBe(false);
        });

        it('should validate required fields', async () => {
            const invalidData = { ...validOrderData };
            delete (invalidData as any).patientId;

            const response = await request(app)
                .post('/api/manual-lab-orders')
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidData)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Validation failed');
        });

        it('should validate test data', async () => {
            const invalidData = { ...validOrderData, tests: [] };

            const response = await request(app)
                .post('/api/manual-lab-orders')
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidData)
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        it('should validate consent requirement', async () => {
            const invalidData = { ...validOrderData, consentObtained: false };

            const response = await request(app)
                .post('/api/manual-lab-orders')
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidData)
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        it('should handle non-existent patient', async () => {
            const invalidData = {
                ...validOrderData,
                patientId: new mongoose.Types.ObjectId().toString()
            };

            const response = await request(app)
                .post('/api/manual-lab-orders')
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidData)
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('not found');
        });

        it('should handle PDF generation failure', async () => {
            const mockPDFService = PDFGenerationService as jest.MockedClass<typeof PDFGenerationService>;
            mockPDFService.prototype.generateRequisitionPDF = jest.fn().mockRejectedValue(
                new Error('PDF generation failed')
            );

            const response = await request(app)
                .post('/api/manual-lab-orders')
                .set('Authorization', `Bearer ${authToken}`)
                .send(validOrderData)
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Failed to generate PDF requisition');
        });

        it('should set different priority levels', async () => {
            const priorities = ['routine', 'urgent', 'stat'];

            for (const priority of priorities) {
                const orderData = { ...validOrderData, priority };
                const response = await request(app)
                    .post('/api/manual-lab-orders')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(orderData)
                    .expect(201);

                expect(response.body.data.order.priority).toBe(priority);
            }
        });

        it('should handle rate limiting', async () => {
            // Make multiple requests quickly to trigger rate limiting
            const promises = Array.from({ length: 12 }, () =>
                request(app)
                    .post('/api/manual-lab-orders')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(validOrderData)
            );

            const responses = await Promise.all(promises);

            // Some requests should be rate limited (429)
            const rateLimitedResponses = responses.filter(r => r.status === 429);
            expect(rateLimitedResponses.length).toBeGreaterThan(0);
        });
    });

    describe('GET /api/manual-lab-orders/:orderId - Get Order', () => {
        let testOrder: any;

        beforeEach(async () => {
            const orderData = {
                patientId: testPatient._id,
                workplaceId: testWorkplace._id,
                orderedBy: testUser._id,
                tests: [
                    {
                        name: 'Complete Blood Count',
                        code: 'CBC',
                        specimenType: 'Blood',
                        unit: 'cells/μL',
                        refRange: '4.5-11.0',
                        category: 'Hematology'
                    }
                ],
                indication: 'Routine screening',
                consentObtained: true,
                consentObtainedBy: testUser._id
            };

            testOrder = await ManualLabService.createOrder(orderData, {
                userId: testUser._id,
                workplaceId: testWorkplace._id,
                userRole: 'pharmacist'
            });
        });

        it('should retrieve order successfully', async () => {
            const response = await request(app)
                .get(`/api/manual-lab-orders/${testOrder.orderId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.order).toBeDefined();
            expect(response.body.data.order.orderId).toBe(testOrder.orderId);
            expect(response.body.data.order.testCount).toBe(1);
            expect(response.body.data.order.isActive).toBe(true);
            expect(response.body.data.order.canBeModified).toBe(true);
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .get(`/api/manual-lab-orders/${testOrder.orderId}`)
                .expect(401);

            expect(response.body.success).toBe(false);
        });

        it('should return 404 for non-existent order', async () => {
            const response = await request(app)
                .get('/api/manual-lab-orders/LAB-2024-9999')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Lab order not found');
        });

        it('should validate order ID format', async () => {
            const response = await request(app)
                .get('/api/manual-lab-orders/invalid-id')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        it('should not allow access to orders from different workplace', async () => {
            // Create another workplace and user
            const otherWorkplace = await Workplace.create({
                name: 'Other Pharmacy',
                address: '456 Other St',
                phone: '555-0456',
                email: 'other@pharmacy.com',
                licenseNumber: 'PH789012',
                isActive: true
            });

            const otherUser = await User.create({
                firstName: 'Other',
                lastName: 'Pharmacist',
                email: 'other@pharmacy.com',
                password: 'hashedpassword',
                role: 'pharmacist',
                workplaceId: otherWorkplace._id,
                workplaceRole: 'Pharmacist',
                isActive: true
            });

            const otherToken = jwt.sign(
                {
                    userId: otherUser._id,
                    email: otherUser.email,
                    role: otherUser.role,
                    workplaceId: otherWorkplace._id,
                    workplaceRole: otherUser.workplaceRole
                },
                process.env.JWT_SECRET!,
                { expiresIn: '1h' }
            );

            const response = await request(app)
                .get(`/api/manual-lab-orders/${testOrder.orderId}`)
                .set('Authorization', `Bearer ${otherToken}`)
                .expect(404);

            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /api/manual-lab-orders/patient/:patientId - Get Patient Orders', () => {
        beforeEach(async () => {
            // Create multiple orders for the patient
            for (let i = 0; i < 5; i++) {
                const orderData = {
                    patientId: testPatient._id,
                    workplaceId: testWorkplace._id,
                    orderedBy: testUser._id,
                    tests: [
                        {
                            name: `Test ${i + 1}`,
                            code: `T${i + 1}`,
                            specimenType: 'Blood',
                            unit: 'mg/dL',
                            refRange: '0-100',
                            category: 'Chemistry'
                        }
                    ],
                    indication: `Test indication ${i + 1}`,
                    priority: (i % 2 === 0 ? 'routine' : 'urgent') as 'routine' | 'urgent' | 'stat',
                    consentObtained: true,
                    consentObtainedBy: testUser._id
                };

                await ManualLabService.createOrder(orderData, {
                    userId: testUser._id,
                    workplaceId: testWorkplace._id,
                    userRole: 'pharmacist'
                });
            }
        });

        it('should retrieve patient orders with pagination', async () => {
            const response = await request(app)
                .get(`/api/manual-lab-orders/patient/${testPatient._id}`)
                .query({ page: 1, limit: 3 })
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.orders).toHaveLength(3);
            expect(response.body.data.pagination.total).toBe(5);
            expect(response.body.data.pagination.pages).toBe(2);
            expect(response.body.data.pagination.hasNext).toBe(true);
            expect(response.body.data.pagination.hasPrev).toBe(false);
        });

        it('should filter orders by status', async () => {
            // Update one order status
            const orders = await ManualLabOrder.find({ patientId: testPatient._id });
            if (orders.length > 0) {
                const firstOrder = orders[0];
                if (firstOrder) {
                    await ManualLabService.updateOrderStatus(
                        firstOrder.orderId,
                        { status: 'sample_collected', updatedBy: testUser._id },
                        { userId: testUser._id, workplaceId: testWorkplace._id, userRole: 'pharmacist' }
                    );
                }
            }

            const response = await request(app)
                .get(`/api/manual-lab-orders/patient/${testPatient._id}`)
                .query({ status: 'sample_collected' })
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.orders).toHaveLength(1);
            expect(response.body.data.orders[0].status).toBe('sample_collected');
        });

        it('should sort orders correctly', async () => {
            const response = await request(app)
                .get(`/api/manual-lab-orders/patient/${testPatient._id}`)
                .query({ sort: 'createdAt' })
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.orders).toHaveLength(5);

            // Check ascending order
            for (let i = 1; i < response.body.data.orders.length; i++) {
                const current = new Date(response.body.data.orders[i].createdAt);
                const previous = new Date(response.body.data.orders[i - 1].createdAt);
                expect(current.getTime()).toBeGreaterThanOrEqual(previous.getTime());
            }
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .get(`/api/manual-lab-orders/patient/${testPatient._id}`)
                .expect(401);

            expect(response.body.success).toBe(false);
        });

        it('should validate patient ID format', async () => {
            const response = await request(app)
                .get('/api/manual-lab-orders/patient/invalid-id')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('PUT /api/manual-lab-orders/:orderId/status - Update Status', () => {
        let testOrder: any;

        beforeEach(async () => {
            const orderData = {
                patientId: testPatient._id,
                workplaceId: testWorkplace._id,
                orderedBy: testUser._id,
                tests: [
                    {
                        name: 'Complete Blood Count',
                        code: 'CBC',
                        specimenType: 'Blood',
                        unit: 'cells/μL',
                        refRange: '4.5-11.0',
                        category: 'Hematology'
                    }
                ],
                indication: 'Routine screening',
                consentObtained: true,
                consentObtainedBy: testUser._id
            };

            testOrder = await ManualLabService.createOrder(orderData, {
                userId: testUser._id,
                workplaceId: testWorkplace._id,
                userRole: 'pharmacist'
            });
        });

        it('should update order status successfully', async () => {
            const updateData = {
                status: 'sample_collected',
                notes: 'Sample collected at 10:00 AM'
            };

            const response = await request(app)
                .put(`/api/manual-lab-orders/${testOrder.orderId}/status`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(updateData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.order.status).toBe('sample_collected');
            expect(response.body.data.order.notes).toBe('Sample collected at 10:00 AM');

            // Verify in database
            const updatedOrder = await ManualLabOrder.findOne({ orderId: testOrder.orderId });
            expect(updatedOrder!.status).toBe('sample_collected');
            expect(updatedOrder!.notes).toBe('Sample collected at 10:00 AM');
        });

        it('should validate status transitions', async () => {
            // Try invalid transition from 'requested' to 'completed'
            const updateData = { status: 'completed' };

            const response = await request(app)
                .put(`/api/manual-lab-orders/${testOrder.orderId}/status`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(updateData)
                .expect(409);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Invalid status transition');
        });

        it('should require authentication', async () => {
            const updateData = { status: 'sample_collected' };

            const response = await request(app)
                .put(`/api/manual-lab-orders/${testOrder.orderId}/status`)
                .send(updateData)
                .expect(401);

            expect(response.body.success).toBe(false);
        });

        it('should validate required fields', async () => {
            const response = await request(app)
                .put(`/api/manual-lab-orders/${testOrder.orderId}/status`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({})
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        it('should return 404 for non-existent order', async () => {
            const updateData = { status: 'sample_collected' };

            const response = await request(app)
                .put('/api/manual-lab-orders/LAB-2024-9999/status')
                .set('Authorization', `Bearer ${authToken}`)
                .send(updateData)
                .expect(404);

            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/manual-lab-orders/:orderId/results - Add Results', () => {
        let testOrder: any;

        beforeEach(async () => {
            const orderData = {
                patientId: testPatient._id,
                workplaceId: testWorkplace._id,
                orderedBy: testUser._id,
                tests: [
                    {
                        name: 'Complete Blood Count',
                        code: 'CBC',
                        specimenType: 'Blood',
                        unit: 'cells/μL',
                        refRange: '4.5-11.0',
                        category: 'Hematology'
                    },
                    {
                        name: 'Glucose',
                        code: 'GLU',
                        specimenType: 'Blood',
                        unit: 'mg/dL',
                        refRange: '70-100',
                        category: 'Chemistry'
                    }
                ],
                indication: 'Routine screening',
                consentObtained: true,
                consentObtainedBy: testUser._id
            };

            testOrder = await ManualLabService.createOrder(orderData, {
                userId: testUser._id,
                workplaceId: testWorkplace._id,
                userRole: 'pharmacist'
            });

            // Update status to allow result entry
            await ManualLabService.updateOrderStatus(
                testOrder.orderId,
                { status: 'sample_collected', updatedBy: testUser._id },
                { userId: testUser._id, workplaceId: testWorkplace._id, userRole: 'pharmacist' }
            );
        });

        it('should add results successfully', async () => {
            const resultData = {
                values: [
                    {
                        testCode: 'CBC',
                        testName: 'Complete Blood Count',
                        numericValue: 8.5,
                        unit: 'cells/μL'
                    },
                    {
                        testCode: 'GLU',
                        testName: 'Glucose',
                        numericValue: 85,
                        unit: 'mg/dL'
                    }
                ],
                reviewNotes: 'Results within normal limits'
            };

            const response = await request(app)
                .post(`/api/manual-lab-orders/${testOrder.orderId}/results`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(resultData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.result).toBeDefined();
            expect(response.body.data.result.orderId).toBe(testOrder.orderId);
            expect(response.body.data.result.values).toHaveLength(2);
            expect(response.body.data.result.valueCount).toBe(2);
            expect(response.body.data.result.reviewNotes).toBe('Results within normal limits');

            // Verify in database
            const savedResult = await ManualLabResult.findOne({ orderId: testOrder.orderId });
            expect(savedResult).toBeDefined();
            expect(savedResult!.values).toHaveLength(2);
        });

        it('should validate test codes against ordered tests', async () => {
            const resultData = {
                values: [
                    {
                        testCode: 'INVALID',
                        testName: 'Invalid Test',
                        numericValue: 100,
                        unit: 'mg/dL'
                    }
                ]
            };

            const response = await request(app)
                .post(`/api/manual-lab-orders/${testOrder.orderId}/results`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(resultData)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Invalid test codes');
        });

        it('should prevent duplicate result entry', async () => {
            const resultData = {
                values: [
                    {
                        testCode: 'CBC',
                        testName: 'Complete Blood Count',
                        numericValue: 8.5,
                        unit: 'cells/μL'
                    }
                ]
            };

            // Add results first time
            await request(app)
                .post(`/api/manual-lab-orders/${testOrder.orderId}/results`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(resultData)
                .expect(201);

            // Try to add results again
            const response = await request(app)
                .post(`/api/manual-lab-orders/${testOrder.orderId}/results`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(resultData)
                .expect(409);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('already exist');
        });

        it('should validate order status for result entry', async () => {
            // Create new order in 'requested' status
            const newOrderData = {
                patientId: testPatient._id,
                workplaceId: testWorkplace._id,
                orderedBy: testUser._id,
                tests: [
                    {
                        name: 'Test',
                        code: 'TEST',
                        specimenType: 'Blood',
                        unit: 'mg/dL',
                        refRange: '0-100',
                        category: 'Chemistry'
                    }
                ],
                indication: 'Test',
                consentObtained: true,
                consentObtainedBy: testUser._id
            };

            const newOrder = await ManualLabService.createOrder(newOrderData, {
                userId: testUser._id,
                workplaceId: testWorkplace._id,
                userRole: 'pharmacist'
            });

            const resultData = {
                values: [
                    {
                        testCode: 'TEST',
                        testName: 'Test',
                        numericValue: 50,
                        unit: 'mg/dL'
                    }
                ]
            };

            const response = await request(app)
                .post(`/api/manual-lab-orders/${newOrder.orderId}/results`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(resultData)
                .expect(409);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('sample collected');
        });

        it('should require authentication', async () => {
            const resultData = {
                values: [
                    {
                        testCode: 'CBC',
                        testName: 'Complete Blood Count',
                        numericValue: 8.5,
                        unit: 'cells/μL'
                    }
                ]
            };

            const response = await request(app)
                .post(`/api/manual-lab-orders/${testOrder.orderId}/results`)
                .send(resultData)
                .expect(401);

            expect(response.body.success).toBe(false);
        });

        it('should validate required fields', async () => {
            const response = await request(app)
                .post(`/api/manual-lab-orders/${testOrder.orderId}/results`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({})
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        it('should handle string values correctly', async () => {
            const resultData = {
                values: [
                    {
                        testCode: 'CBC',
                        testName: 'Complete Blood Count',
                        stringValue: 'Normal morphology',
                        comment: 'No abnormal cells seen'
                    }
                ]
            };

            const response = await request(app)
                .post(`/api/manual-lab-orders/${testOrder.orderId}/results`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(resultData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.result.values[0].stringValue).toBe('Normal morphology');
            expect(response.body.data.result.values[0].comment).toBe('No abnormal cells seen');
        });
    });

    describe('GET /api/manual-lab-orders/:orderId/results - Get Results', () => {
        let testOrder: any;
        let testResult: any;

        beforeEach(async () => {
            const orderData = {
                patientId: testPatient._id,
                workplaceId: testWorkplace._id,
                orderedBy: testUser._id,
                tests: [
                    {
                        name: 'Complete Blood Count',
                        code: 'CBC',
                        specimenType: 'Blood',
                        unit: 'cells/μL',
                        refRange: '4.5-11.0',
                        category: 'Hematology'
                    }
                ],
                indication: 'Routine screening',
                consentObtained: true,
                consentObtainedBy: testUser._id
            };

            testOrder = await ManualLabService.createOrder(orderData, {
                userId: testUser._id,
                workplaceId: testWorkplace._id,
                userRole: 'pharmacist'
            });

            await ManualLabService.updateOrderStatus(
                testOrder.orderId,
                { status: 'sample_collected', updatedBy: testUser._id },
                { userId: testUser._id, workplaceId: testWorkplace._id, userRole: 'pharmacist' }
            );

            testResult = await ManualLabService.addResults(
                testOrder.orderId,
                {
                    enteredBy: testUser._id,
                    values: [
                        {
                            testCode: 'CBC',
                            testName: 'Complete Blood Count',
                            numericValue: 8.5,
                            unit: 'cells/μL'
                        }
                    ]
                },
                { userId: testUser._id, workplaceId: testWorkplace._id, userRole: 'pharmacist' }
            );
        });

        it('should retrieve results successfully', async () => {
            const response = await request(app)
                .get(`/api/manual-lab-orders/${testOrder.orderId}/results`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.result).toBeDefined();
            expect(response.body.data.result.orderId).toBe(testOrder.orderId);
            expect(response.body.data.result.values).toHaveLength(1);
            expect(response.body.data.result.valueCount).toBe(1);
            expect(response.body.data.result.values[0].testCode).toBe('CBC');
        });

        it('should return 404 for non-existent results', async () => {
            const newOrderData = {
                patientId: testPatient._id,
                workplaceId: testWorkplace._id,
                orderedBy: testUser._id,
                tests: [
                    {
                        name: 'Test',
                        code: 'TEST',
                        specimenType: 'Blood',
                        unit: 'mg/dL',
                        refRange: '0-100',
                        category: 'Chemistry'
                    }
                ],
                indication: 'Test',
                consentObtained: true,
                consentObtainedBy: testUser._id
            };

            const newOrder = await ManualLabService.createOrder(newOrderData, {
                userId: testUser._id,
                workplaceId: testWorkplace._id,
                userRole: 'pharmacist'
            });

            const response = await request(app)
                .get(`/api/manual-lab-orders/${newOrder.orderId}/results`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Lab results not found');
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .get(`/api/manual-lab-orders/${testOrder.orderId}/results`)
                .expect(401);

            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /api/manual-lab-orders/scan - Resolve Token', () => {
        let testOrder: any;
        let validToken: string;

        beforeEach(async () => {
            const orderData = {
                patientId: testPatient._id,
                workplaceId: testWorkplace._id,
                orderedBy: testUser._id,
                tests: [
                    {
                        name: 'Complete Blood Count',
                        code: 'CBC',
                        specimenType: 'Blood',
                        unit: 'cells/μL',
                        refRange: '4.5-11.0',
                        category: 'Hematology'
                    }
                ],
                indication: 'Routine screening',
                consentObtained: true,
                consentObtainedBy: testUser._id
            };

            testOrder = await ManualLabService.createOrder(orderData, {
                userId: testUser._id,
                workplaceId: testWorkplace._id,
                userRole: 'pharmacist'
            });

            validToken = testOrder.barcodeData;
        });

        it('should resolve valid token successfully', async () => {
            const response = await request(app)
                .get('/api/manual-lab-orders/scan')
                .query({ token: validToken })
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.order).toBeDefined();
            expect(response.body.data.order.orderId).toBe(testOrder.orderId);
            expect(response.body.data.order.testCount).toBe(1);
        });

        it('should require token parameter', async () => {
            const response = await request(app)
                .get('/api/manual-lab-orders/scan')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Token is required');
        });

        it('should handle invalid token', async () => {
            const response = await request(app)
                .get('/api/manual-lab-orders/scan')
                .query({ token: 'invalid-token' })
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Invalid or expired token');
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .get('/api/manual-lab-orders/scan')
                .query({ token: validToken })
                .expect(401);

            expect(response.body.success).toBe(false);
        });

        it('should handle rate limiting for token scanning', async () => {
            // Make multiple requests quickly to trigger rate limiting
            const promises = Array.from({ length: 35 }, () =>
                request(app)
                    .get('/api/manual-lab-orders/scan')
                    .query({ token: validToken })
                    .set('Authorization', `Bearer ${authToken}`)
            );

            const responses = await Promise.all(promises);

            // Some requests should be rate limited (429)
            const rateLimitedResponses = responses.filter(r => r.status === 429);
            expect(rateLimitedResponses.length).toBeGreaterThan(0);
        });
    });

    describe('GET /api/manual-lab-orders/:orderId/pdf - Serve PDF', () => {
        let testOrder: any;

        beforeEach(async () => {
            const orderData = {
                patientId: testPatient._id,
                workplaceId: testWorkplace._id,
                orderedBy: testUser._id,
                tests: [
                    {
                        name: 'Complete Blood Count',
                        code: 'CBC',
                        specimenType: 'Blood',
                        unit: 'cells/μL',
                        refRange: '4.5-11.0',
                        category: 'Hematology'
                    }
                ],
                indication: 'Routine screening',
                consentObtained: true,
                consentObtainedBy: testUser._id
            };

            testOrder = await ManualLabService.createOrder(orderData, {
                userId: testUser._id,
                workplaceId: testWorkplace._id,
                userRole: 'pharmacist'
            });
        });

        it('should serve PDF successfully', async () => {
            const response = await request(app)
                .get(`/api/manual-lab-orders/${testOrder.orderId}/pdf`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.headers['content-type']).toBe('application/pdf');
            expect(response.headers['content-disposition']).toContain('inline');
            expect(response.headers['content-disposition']).toContain('.pdf');
            expect(response.headers['cache-control']).toContain('no-cache');
            expect(response.headers['x-content-type-options']).toBe('nosniff');
            expect(response.headers['x-frame-options']).toBe('DENY');
            expect(Buffer.isBuffer(response.body)).toBe(true);
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .get(`/api/manual-lab-orders/${testOrder.orderId}/pdf`)
                .expect(401);

            expect(response.body.success).toBe(false);
        });

        it('should return 404 for non-existent order', async () => {
            const response = await request(app)
                .get('/api/manual-lab-orders/LAB-2024-9999/pdf')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);

            expect(response.body.success).toBe(false);
        });

        it('should handle PDF generation failure', async () => {
            const mockPDFService = PDFGenerationService as jest.MockedClass<typeof PDFGenerationService>;
            mockPDFService.prototype.generateRequisitionPDF = jest.fn().mockRejectedValue(
                new Error('PDF generation failed')
            );

            const response = await request(app)
                .get(`/api/manual-lab-orders/${testOrder.orderId}/pdf`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(500);

            expect(response.body.success).toBe(false);
        });

        it('should handle rate limiting for PDF access', async () => {
            // Make multiple requests quickly to trigger rate limiting
            const promises = Array.from({ length: 55 }, () =>
                request(app)
                    .get(`/api/manual-lab-orders/${testOrder.orderId}/pdf`)
                    .set('Authorization', `Bearer ${authToken}`)
            );

            const responses = await Promise.all(promises);

            // Some requests should be rate limited (429)
            const rateLimitedResponses = responses.filter(r => r.status === 429);
            expect(rateLimitedResponses.length).toBeGreaterThan(0);
        });
    });

    describe('GET /api/manual-lab-orders - List Orders', () => {
        beforeEach(async () => {
            // Create multiple orders with different properties
            const orderData = [
                { priority: 'routine', status: 'requested' },
                { priority: 'urgent', status: 'sample_collected' },
                { priority: 'stat', status: 'result_awaited' },
                { priority: 'routine', status: 'completed' },
                { priority: 'urgent', status: 'referred' }
            ];

            for (const data of orderData) {
                const order = {
                    patientId: testPatient._id,
                    workplaceId: testWorkplace._id,
                    orderedBy: testUser._id,
                    tests: [
                        {
                            name: 'Test',
                            code: 'TEST',
                            specimenType: 'Blood',
                            unit: 'mg/dL',
                            refRange: '0-100',
                            category: 'Chemistry'
                        }
                    ],
                    indication: 'Test indication',
                    priority: data.priority as 'routine' | 'urgent' | 'stat',
                    consentObtained: true,
                    consentObtainedBy: testUser._id
                };

                const createdOrder = await ManualLabService.createOrder(order, {
                    userId: testUser._id,
                    workplaceId: testWorkplace._id,
                    userRole: 'pharmacist'
                });

                if (data.status !== 'requested') {
                    await ManualLabService.updateOrderStatus(
                        createdOrder.orderId,
                        { status: data.status as any, updatedBy: testUser._id },
                        { userId: testUser._id, workplaceId: testWorkplace._id, userRole: 'pharmacist' }
                    );
                }
            }
        });

        it('should list orders with pagination', async () => {
            const response = await request(app)
                .get('/api/manual-lab-orders')
                .query({ page: 1, limit: 3 })
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.orders).toHaveLength(3);
            expect(response.body.data.pagination.total).toBe(5);
            expect(response.body.data.pagination.pages).toBe(2);
        });

        it('should filter orders by status', async () => {
            const response = await request(app)
                .get('/api/manual-lab-orders')
                .query({ status: 'completed' })
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.orders).toHaveLength(1);
            expect(response.body.data.orders[0].status).toBe('completed');
        });

        it('should filter orders by priority', async () => {
            const response = await request(app)
                .get('/api/manual-lab-orders')
                .query({ priority: 'urgent' })
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.orders).toHaveLength(2);
            expect(response.body.data.orders.every((o: any) => o.priority === 'urgent')).toBe(true);
        });

        it('should sort orders correctly', async () => {
            const response = await request(app)
                .get('/api/manual-lab-orders')
                .query({ sort: 'createdAt' })
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.orders).toHaveLength(5);

            // Check ascending order
            for (let i = 1; i < response.body.data.orders.length; i++) {
                const current = new Date(response.body.data.orders[i].createdAt);
                const previous = new Date(response.body.data.orders[i - 1].createdAt);
                expect(current.getTime()).toBeGreaterThanOrEqual(previous.getTime());
            }
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .get('/api/manual-lab-orders')
                .expect(401);

            expect(response.body.success).toBe(false);
        });
    });

    describe('Error Handling', () => {
        it('should handle validation errors properly', async () => {
            const invalidData = {
                patientId: 'invalid-id',
                tests: [],
                indication: '',
                consentObtained: false
            };

            const response = await request(app)
                .post('/api/manual-lab-orders')
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidData)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Validation failed');
        });

        it('should handle database errors gracefully', async () => {
            // Simulate database error by using invalid ObjectId
            const response = await request(app)
                .get('/api/manual-lab-orders/invalid-object-id')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        it('should handle unauthorized access', async () => {
            const response = await request(app)
                .get('/api/manual-lab-orders')
                .expect(401);

            expect(response.body.success).toBe(false);
        });

        it('should handle forbidden access for wrong roles', async () => {
            // Create user with different role
            const otherUser = await User.create({
                firstName: 'Other',
                lastName: 'User',
                email: 'other@test.com',
                password: 'hashedpassword',
                role: 'patient', // Not allowed role
                workplaceId: testWorkplace._id,
                workplaceRole: 'Patient',
                isActive: true
            });

            const otherToken = jwt.sign(
                {
                    userId: otherUser._id,
                    email: otherUser.email,
                    role: otherUser.role,
                    workplaceId: testWorkplace._id,
                    workplaceRole: otherUser.workplaceRole
                },
                process.env.JWT_SECRET!,
                { expiresIn: '1h' }
            );

            const response = await request(app)
                .get('/api/manual-lab-orders')
                .set('Authorization', `Bearer ${otherToken}`)
                .expect(403);

            expect(response.body.success).toBe(false);
        });
    });

    describe('Security Tests', () => {
        it('should validate JWT tokens properly', async () => {
            const invalidToken = 'invalid.jwt.token';

            const response = await request(app)
                .get('/api/manual-lab-orders')
                .set('Authorization', `Bearer ${invalidToken}`)
                .expect(401);

            expect(response.body.success).toBe(false);
        });

        it('should prevent access with expired tokens', async () => {
            const expiredToken = jwt.sign(
                {
                    userId: testUser._id,
                    email: testUser.email,
                    role: testUser.role,
                    workplaceId: testWorkplace._id,
                    workplaceRole: testUser.workplaceRole
                },
                process.env.JWT_SECRET!,
                { expiresIn: '-1h' } // Expired 1 hour ago
            );

            const response = await request(app)
                .get('/api/manual-lab-orders')
                .set('Authorization', `Bearer ${expiredToken}`)
                .expect(401);

            expect(response.body.success).toBe(false);
        });

        it('should set proper security headers for PDF responses', async () => {
            const orderData = {
                patientId: testPatient._id,
                workplaceId: testWorkplace._id,
                orderedBy: testUser._id,
                tests: [
                    {
                        name: 'Complete Blood Count',
                        code: 'CBC',
                        specimenType: 'Blood',
                        unit: 'cells/μL',
                        refRange: '4.5-11.0',
                        category: 'Hematology'
                    }
                ],
                indication: 'Routine screening',
                consentObtained: true,
                consentObtainedBy: testUser._id
            };

            const testOrder = await ManualLabService.createOrder(orderData, {
                userId: testUser._id,
                workplaceId: testWorkplace._id,
                userRole: 'pharmacist'
            });

            const response = await request(app)
                .get(`/api/manual-lab-orders/${testOrder.orderId}/pdf`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.headers['x-content-type-options']).toBe('nosniff');
            expect(response.headers['x-frame-options']).toBe('DENY');
            expect(response.headers['x-download-options']).toBe('noopen');
            expect(response.headers['cache-control']).toContain('no-cache');
            expect(response.headers['pragma']).toBe('no-cache');
        });
    });
});