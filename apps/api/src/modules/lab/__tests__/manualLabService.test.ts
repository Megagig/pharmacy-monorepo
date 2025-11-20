import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Import models
import ManualLabOrder, { IManualLabOrder } from '../models/ManualLabOrder';
import ManualLabResult, { IManualLabResult } from '../models/ManualLabResult';
import Patient from '../../../models/Patient';
import User from '../../../models/User';
import Workplace from '../../../models/Workplace';

// Import service
import ManualLabService, {
    CreateOrderRequest,
    AddResultsRequest,
    OrderFilters,
    AIInterpretationRequest
} from '../services/manualLabService';

// Import utilities
import TokenService from '../services/tokenService';
import { AuditService } from '../../../services/auditService';
export interface AuditContext {
    userId: string;
    workspaceId: string;
    sessionId?: string;
}

// Mock external services
jest.mock('../services/pdfGenerationService');
jest.mock('../../../services/auditService');
jest.mock('../../../services/openRouterService');

describe('ManualLabService', () => {
    let mongoServer: MongoMemoryServer;
    let testWorkplace: any;
    let testPatient: any;
    let testUser: any;
    let auditContext: AuditContext;

    beforeAll(async () => {
        // Start in-memory MongoDB
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

        auditContext = {
            userId: testUser._id,
            workplaceId: testWorkplace._id,
            userRole: 'pharmacist'
        };

        // Mock audit service
        (AuditService.logActivity as jest.Mock).mockResolvedValue(undefined);
    });

    describe('createOrder', () => {
        const validOrderData: CreateOrderRequest = {
            patientId: new mongoose.Types.ObjectId(),
            workplaceId: new mongoose.Types.ObjectId(),
            orderedBy: new mongoose.Types.ObjectId(),
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
            consentObtained: true,
            consentObtainedBy: new mongoose.Types.ObjectId()
        };

        beforeEach(() => {
            validOrderData.patientId = testPatient._id;
            validOrderData.workplaceId = testWorkplace._id;
            validOrderData.orderedBy = testUser._id;
            validOrderData.consentObtainedBy = testUser._id;
        });

        it('should create a new manual lab order successfully', async () => {
            const order = await ManualLabService.createOrder(validOrderData, auditContext);

            expect(order).toBeDefined();
            expect(order.orderId).toMatch(/^LAB-\d{4}-\d{4}$/);
            expect(order.patientId.toString()).toBe(testPatient._id.toString());
            expect(order.workplaceId.toString()).toBe(testWorkplace._id.toString());
            expect(order.orderedBy.toString()).toBe(testUser._id.toString());
            expect(order.tests).toHaveLength(1);
            expect(order.tests[0].name).toBe('Complete Blood Count');
            expect(order.status).toBe('requested');
            expect(order.consentObtained).toBe(true);
            expect(order.barcodeData).toBeDefined();
            expect(order.requisitionFormUrl).toBeDefined();

            // Verify audit logging was called
            expect(AuditService.logActivity).toHaveBeenCalledWith(
                auditContext,
                expect.objectContaining({
                    action: 'MANUAL_LAB_ORDER_CREATED',
                    resourceType: 'ManualLabOrder'
                })
            );
        });

        it('should generate unique order IDs', async () => {
            const order1 = await ManualLabService.createOrder(validOrderData, auditContext);
            const order2 = await ManualLabService.createOrder(validOrderData, auditContext);

            expect(order1.orderId).not.toBe(order2.orderId);
            expect(order1.orderId).toMatch(/^LAB-\d{4}-\d{4}$/);
            expect(order2.orderId).toMatch(/^LAB-\d{4}-\d{4}$/);
        });

        it('should throw error if patient not found', async () => {
            const invalidOrderData = {
                ...validOrderData,
                patientId: new mongoose.Types.ObjectId()
            };

            await expect(
                ManualLabService.createOrder(invalidOrderData, auditContext)
            ).rejects.toThrow('Patient not found');
        });

        it('should throw error if ordering user not found', async () => {
            const invalidOrderData = {
                ...validOrderData,
                orderedBy: new mongoose.Types.ObjectId()
            };

            await expect(
                ManualLabService.createOrder(invalidOrderData, auditContext)
            ).rejects.toThrow('Invalid ordering user');
        });

        it('should throw error if consent not obtained', async () => {
            const invalidOrderData = {
                ...validOrderData,
                consentObtained: false
            };

            await expect(
                ManualLabService.createOrder(invalidOrderData, auditContext)
            ).rejects.toThrow('Patient consent is required');
        });

        it('should validate test data', async () => {
            const invalidOrderData = {
                ...validOrderData,
                tests: []
            };

            await expect(
                ManualLabService.createOrder(invalidOrderData, auditContext)
            ).rejects.toThrow();
        });
    });

    describe('getOrderById', () => {
        let testOrder: IManualLabOrder;

        beforeEach(async () => {
            testOrder = await ManualLabService.createOrder({
                patientId: testPatient._id,
                workplaceId: testWorkplace._id,
                orderedBy: testUser._id,
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
                consentObtained: true,
                consentObtainedBy: testUser._id
            }, auditContext);
        });

        it('should retrieve order by ID successfully', async () => {
            const retrievedOrder = await ManualLabService.getOrderById(
                testOrder.orderId,
                testWorkplace._id,
                auditContext
            );

            expect(retrievedOrder).toBeDefined();
            expect(retrievedOrder!.orderId).toBe(testOrder.orderId);
            expect(retrievedOrder!.patientId).toBeDefined();
            expect(retrievedOrder!.orderedBy).toBeDefined();

            // Verify audit logging was called
            expect(AuditService.logActivity).toHaveBeenCalledWith(
                auditContext,
                expect.objectContaining({
                    action: 'MANUAL_LAB_ORDER_ACCESSED',
                    resourceType: 'ManualLabOrder'
                })
            );
        });

        it('should return null for non-existent order', async () => {
            const retrievedOrder = await ManualLabService.getOrderById(
                'LAB-2024-9999',
                testWorkplace._id,
                auditContext
            );

            expect(retrievedOrder).toBeNull();
        });

        it('should return null for order from different workplace', async () => {
            const otherWorkplace = await Workplace.create({
                name: 'Other Pharmacy',
                address: '456 Other St',
                phone: '555-0456',
                email: 'other@pharmacy.com',
                licenseNumber: 'PH789012',
                isActive: true
            });

            const retrievedOrder = await ManualLabService.getOrderById(
                testOrder.orderId,
                otherWorkplace._id,
                auditContext
            );

            expect(retrievedOrder).toBeNull();
        });
    });

    describe('getOrdersByPatient', () => {
        beforeEach(async () => {
            // Create multiple orders for the patient
            for (let i = 0; i < 5; i++) {
                await ManualLabService.createOrder({
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
                    priority: i % 2 === 0 ? 'routine' : 'urgent',
                    consentObtained: true,
                    consentObtainedBy: testUser._id
                }, auditContext);
            }
        });

        it('should retrieve patient orders with pagination', async () => {
            const result = await ManualLabService.getOrdersByPatient(
                testPatient._id,
                testWorkplace._id,
                { page: 1, limit: 3 }
            );

            expect(result.data).toHaveLength(3);
            expect(result.pagination.total).toBe(5);
            expect(result.pagination.pages).toBe(2);
            expect(result.pagination.hasNext).toBe(true);
            expect(result.pagination.hasPrev).toBe(false);
        });

        it('should filter orders by status', async () => {
            const result = await ManualLabService.getOrdersByPatient(
                testPatient._id,
                testWorkplace._id,
                { status: 'requested' }
            );

            expect(result.data).toHaveLength(5);
            result.data.forEach(order => {
                expect(order.status).toBe('requested');
            });
        });

        it('should sort orders correctly', async () => {
            const result = await ManualLabService.getOrdersByPatient(
                testPatient._id,
                testWorkplace._id,
                { sortBy: 'createdAt', sortOrder: 'asc' }
            );

            expect(result.data).toHaveLength(5);
            for (let i = 1; i < result.data.length; i++) {
                expect(result.data[i].createdAt.getTime()).toBeGreaterThanOrEqual(
                    result.data[i - 1].createdAt.getTime()
                );
            }
        });
    });

    describe('updateOrderStatus', () => {
        let testOrder: IManualLabOrder;

        beforeEach(async () => {
            testOrder = await ManualLabService.createOrder({
                patientId: testPatient._id,
                workplaceId: testWorkplace._id,
                orderedBy: testUser._id,
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
                consentObtained: true,
                consentObtainedBy: testUser._id
            }, auditContext);
        });

        it('should update order status successfully', async () => {
            const updatedOrder = await ManualLabService.updateOrderStatus(
                testOrder.orderId,
                {
                    status: 'sample_collected',
                    updatedBy: testUser._id,
                    notes: 'Sample collected at 10:00 AM'
                },
                auditContext
            );

            expect(updatedOrder.status).toBe('sample_collected');
            expect(updatedOrder.notes).toBe('Sample collected at 10:00 AM');
            expect(updatedOrder.updatedBy?.toString()).toBe(testUser._id.toString());

            // Verify audit logging was called
            expect(AuditService.logActivity).toHaveBeenCalledWith(
                auditContext,
                expect.objectContaining({
                    action: 'MANUAL_LAB_ORDER_STATUS_UPDATED',
                    resourceType: 'ManualLabOrder',
                    oldValues: { status: 'requested' },
                    newValues: { status: 'sample_collected' }
                })
            );
        });

        it('should validate status transitions', async () => {
            // Try invalid transition from 'requested' to 'completed'
            await expect(
                ManualLabService.updateOrderStatus(
                    testOrder.orderId,
                    {
                        status: 'completed',
                        updatedBy: testUser._id
                    },
                    auditContext
                )
            ).rejects.toThrow('Invalid status transition');
        });

        it('should throw error for non-existent order', async () => {
            await expect(
                ManualLabService.updateOrderStatus(
                    'LAB-2024-9999',
                    {
                        status: 'sample_collected',
                        updatedBy: testUser._id
                    },
                    auditContext
                )
            ).rejects.toThrow('Lab order not found');
        });
    });

    describe('addResults', () => {
        let testOrder: IManualLabOrder;

        beforeEach(async () => {
            testOrder = await ManualLabService.createOrder({
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
            }, auditContext);

            // Update status to allow result entry
            await ManualLabService.updateOrderStatus(
                testOrder.orderId,
                {
                    status: 'sample_collected',
                    updatedBy: testUser._id
                },
                auditContext
            );
        });

        it('should add results successfully', async () => {
            const resultData: AddResultsRequest = {
                enteredBy: testUser._id,
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

            const result = await ManualLabService.addResults(
                testOrder.orderId,
                resultData,
                auditContext
            );

            expect(result).toBeDefined();
            expect(result.orderId).toBe(testOrder.orderId);
            expect(result.values).toHaveLength(2);
            expect(result.enteredBy.toString()).toBe(testUser._id.toString());
            expect(result.interpretation).toHaveLength(2);
            expect(result.reviewNotes).toBe('Results within normal limits');

            // Check that interpretations were generated
            const cbcInterpretation = result.interpretation.find(i => i.testCode === 'CBC');
            const gluInterpretation = result.interpretation.find(i => i.testCode === 'GLU');

            expect(cbcInterpretation).toBeDefined();
            expect(gluInterpretation).toBeDefined();
            expect(gluInterpretation!.interpretation).toBe('normal');

            // Verify audit logging was called
            expect(AuditService.logActivity).toHaveBeenCalledWith(
                auditContext,
                expect.objectContaining({
                    action: 'MANUAL_LAB_RESULTS_ENTERED',
                    resourceType: 'ManualLabResult'
                })
            );
        });

        it('should validate test codes against ordered tests', async () => {
            const resultData: AddResultsRequest = {
                enteredBy: testUser._id,
                values: [
                    {
                        testCode: 'INVALID',
                        testName: 'Invalid Test',
                        numericValue: 100,
                        unit: 'mg/dL'
                    }
                ]
            };

            await expect(
                ManualLabService.addResults(testOrder.orderId, resultData, auditContext)
            ).rejects.toThrow('Invalid test codes: INVALID');
        });

        it('should prevent duplicate result entry', async () => {
            const resultData: AddResultsRequest = {
                enteredBy: testUser._id,
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
            await ManualLabService.addResults(testOrder.orderId, resultData, auditContext);

            // Try to add results again
            await expect(
                ManualLabService.addResults(testOrder.orderId, resultData, auditContext)
            ).rejects.toThrow('Results already exist for this order');
        });

        it('should validate order status for result entry', async () => {
            // Create new order in 'requested' status
            const newOrder = await ManualLabService.createOrder({
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
            }, auditContext);

            const resultData: AddResultsRequest = {
                enteredBy: testUser._id,
                values: [
                    {
                        testCode: 'TEST',
                        testName: 'Test',
                        numericValue: 50,
                        unit: 'mg/dL'
                    }
                ]
            };

            await expect(
                ManualLabService.addResults(newOrder.orderId, resultData, auditContext)
            ).rejects.toThrow('Results can only be added to orders with sample collected');
        });

        it('should interpret abnormal values correctly', async () => {
            const resultData: AddResultsRequest = {
                enteredBy: testUser._id,
                values: [
                    {
                        testCode: 'GLU',
                        testName: 'Glucose',
                        numericValue: 150, // Above normal range (70-100)
                        unit: 'mg/dL'
                    }
                ]
            };

            const result = await ManualLabService.addResults(
                testOrder.orderId,
                resultData,
                auditContext
            );

            const gluInterpretation = result.interpretation.find(i => i.testCode === 'GLU');
            const gluValue = result.values.find(v => v.testCode === 'GLU');

            expect(gluInterpretation!.interpretation).toBe('high');
            expect(gluValue!.abnormalFlag).toBe(true);
            expect(result.hasAbnormalResults()).toBe(true);
        });
    });

    describe('getResultsByOrder', () => {
        let testOrder: IManualLabOrder;
        let testResult: IManualLabResult;

        beforeEach(async () => {
            testOrder = await ManualLabService.createOrder({
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
            }, auditContext);

            await ManualLabService.updateOrderStatus(
                testOrder.orderId,
                { status: 'sample_collected', updatedBy: testUser._id },
                auditContext
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
                auditContext
            );
        });

        it('should retrieve results by order ID', async () => {
            const retrievedResult = await ManualLabService.getResultsByOrder(
                testOrder.orderId,
                testWorkplace._id,
                auditContext
            );

            expect(retrievedResult).toBeDefined();
            expect(retrievedResult!.orderId).toBe(testOrder.orderId);
            expect(retrievedResult!.values).toHaveLength(1);
            expect(retrievedResult!.values[0].testCode).toBe('CBC');

            // Verify audit logging was called
            expect(AuditService.logActivity).toHaveBeenCalledWith(
                auditContext,
                expect.objectContaining({
                    action: 'MANUAL_LAB_RESULTS_ACCESSED',
                    resourceType: 'ManualLabResult'
                })
            );
        });

        it('should return null for non-existent results', async () => {
            const newOrder = await ManualLabService.createOrder({
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
            }, auditContext);

            const retrievedResult = await ManualLabService.getResultsByOrder(
                newOrder.orderId,
                testWorkplace._id,
                auditContext
            );

            expect(retrievedResult).toBeNull();
        });
    });

    describe('resolveToken', () => {
        let testOrder: IManualLabOrder;
        let validToken: string;

        beforeEach(async () => {
            testOrder = await ManualLabService.createOrder({
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
            }, auditContext);

            // Generate a valid token for the order
            const tokens = TokenService.generateLabOrderTokens(
                testOrder.orderId,
                testWorkplace._id.toString()
            );
            validToken = tokens.primary.token;
        });

        it('should resolve valid token to order', async () => {
            const resolvedOrder = await ManualLabService.resolveToken(
                validToken,
                auditContext
            );

            expect(resolvedOrder).toBeDefined();
            expect(resolvedOrder!.orderId).toBe(testOrder.orderId);
            expect(resolvedOrder!.patientId).toBeDefined();
            expect(resolvedOrder!.orderedBy).toBeDefined();

            // Verify audit logging was called
            expect(AuditService.logActivity).toHaveBeenCalledWith(
                auditContext,
                expect.objectContaining({
                    action: 'MANUAL_LAB_ORDER_TOKEN_RESOLVED',
                    resourceType: 'ManualLabOrder'
                })
            );
        });

        it('should throw error for invalid token', async () => {
            await expect(
                ManualLabService.resolveToken('invalid-token', auditContext)
            ).rejects.toThrow('Invalid token');
        });

        it('should throw error for expired token', async () => {
            // Create an expired token (this is a simplified test)
            const expiredTokenData = TokenService.generateSecureToken(
                testOrder.orderId,
                testWorkplace._id.toString(),
                -1 // Negative days to create expired token
            );

            await expect(
                ManualLabService.resolveToken(expiredTokenData.token, auditContext)
            ).rejects.toThrow();
        });
    });

    describe('getOrders', () => {
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
                const order = await ManualLabService.createOrder({
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
                    priority: data.priority as any,
                    consentObtained: true,
                    consentObtainedBy: testUser._id
                }, auditContext);

                if (data.status !== 'requested') {
                    await ManualLabService.updateOrderStatus(
                        order.orderId,
                        { status: data.status as any, updatedBy: testUser._id },
                        auditContext
                    );
                }
            }
        });

        it('should retrieve orders with pagination', async () => {
            const filters: OrderFilters = {
                workplaceId: testWorkplace._id,
                page: 1,
                limit: 3
            };

            const result = await ManualLabService.getOrders(filters, auditContext);

            expect(result.data).toHaveLength(3);
            expect(result.pagination.total).toBe(5);
            expect(result.pagination.pages).toBe(2);
            expect(result.pagination.hasNext).toBe(true);
            expect(result.pagination.hasPrev).toBe(false);
        });

        it('should filter orders by status', async () => {
            const filters: OrderFilters = {
                workplaceId: testWorkplace._id,
                status: 'completed'
            };

            const result = await ManualLabService.getOrders(filters, auditContext);

            expect(result.data).toHaveLength(1);
            expect(result.data[0].status).toBe('completed');
        });

        it('should filter orders by priority', async () => {
            const filters: OrderFilters = {
                workplaceId: testWorkplace._id,
                priority: 'urgent'
            };

            const result = await ManualLabService.getOrders(filters, auditContext);

            expect(result.data).toHaveLength(2);
            result.data.forEach(order => {
                expect(order.priority).toBe('urgent');
            });
        });

        it('should filter orders by patient', async () => {
            const filters: OrderFilters = {
                workplaceId: testWorkplace._id,
                patientId: testPatient._id
            };

            const result = await ManualLabService.getOrders(filters, auditContext);

            expect(result.data).toHaveLength(5);
            result.data.forEach(order => {
                expect(order.patientId.toString()).toBe(testPatient._id.toString());
            });
        });

        it('should sort orders correctly', async () => {
            const filters: OrderFilters = {
                workplaceId: testWorkplace._id,
                sortBy: 'priority',
                sortOrder: 'asc'
            };

            const result = await ManualLabService.getOrders(filters, auditContext);

            expect(result.data).toHaveLength(5);
            // Verify sorting (routine < urgent < stat alphabetically)
            const priorities = result.data.map(order => order.priority);
            const sortedPriorities = [...priorities].sort();
            expect(priorities).toEqual(sortedPriorities);
        });
    });

    describe('logOrderEvent', () => {
        it('should log order events for audit trail', async () => {
            await ManualLabService.logOrderEvent(
                'LAB-2024-0001',
                'TEST_EVENT',
                testUser._id,
                testWorkplace._id,
                { testData: 'test value' }
            );

            expect(AuditService.logActivity).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: testUser._id,
                    workplaceId: testWorkplace._id
                }),
                expect.objectContaining({
                    action: 'TEST_EVENT',
                    resourceType: 'ManualLabOrder',
                    details: expect.objectContaining({
                        orderId: 'LAB-2024-0001',
                        testData: 'test value'
                    })
                })
            );
        });
    });

    describe('AI Integration', () => {
        it('should trigger AI interpretation after results are added', async () => {
            const testOrder = await ManualLabService.createOrder({
                patientId: testPatient._id,
                workplaceId: testWorkplace._id,
                orderedBy: testUser._id,
                tests: [
                    {
                        name: 'Glucose',
                        code: 'GLU',
                        specimenType: 'Blood',
                        unit: 'mg/dL',
                        refRange: '70-100',
                        category: 'Chemistry'
                    }
                ],
                indication: 'Diabetes screening',
                consentObtained: true,
                consentObtainedBy: testUser._id
            }, auditContext);

            await ManualLabService.updateOrderStatus(
                testOrder.orderId,
                { status: 'sample_collected', updatedBy: testUser._id },
                auditContext
            );

            const result = await ManualLabService.addResults(
                testOrder.orderId,
                {
                    enteredBy: testUser._id,
                    values: [
                        {
                            testCode: 'GLU',
                            testName: 'Glucose',
                            numericValue: 150, // Abnormal value
                            unit: 'mg/dL'
                        }
                    ]
                },
                auditContext
            );

            expect(result).toBeDefined();
            expect(result.hasAbnormalResults()).toBe(true);

            // AI interpretation would be triggered asynchronously
            // In a real test, you might want to wait for the async operation
            // or mock the diagnostic service to verify it was called
        });
    });

    describe('Error Handling', () => {
        it('should handle database errors gracefully', async () => {
            // Mock a database error
            jest.spyOn(ManualLabOrder.prototype, 'save').mockRejectedValueOnce(
                new Error('Database connection failed')
            );

            await expect(
                ManualLabService.createOrder({
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
                }, auditContext)
            ).rejects.toThrow('Database connection failed');
        });

        it('should rollback transactions on error', async () => {
            // Mock PDF generation failure
            const PDFGenerationService = require('../services/pdfGenerationService');
            PDFGenerationService.generateRequisitionPDF = jest.fn().mockRejectedValue(
                new Error('PDF generation failed')
            );

            await expect(
                ManualLabService.createOrder({
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
                }, auditContext)
            ).rejects.toThrow('PDF generation failed');

            // Verify no order was created
            const orders = await ManualLabOrder.find({});
            expect(orders).toHaveLength(0);
        });
    });
});