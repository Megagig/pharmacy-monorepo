import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import ManualLabService, {
    CreateOrderRequest,
    AddResultsRequest,
    OrderFilters,
    AIInterpretationRequest
} from '../services/manualLabService';
import TokenService from '../services/tokenService';
import { PDFGenerationService } from '../services/pdfGenerationService';
import ManualLabOrder, { IManualLabOrder } from '../models/ManualLabOrder';
import ManualLabResult, { IManualLabResult } from '../models/ManualLabResult';
import Patient from '../../../models/Patient';
import User from '../../../models/User';
import Workplace from '../../../models/Workplace';
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
jest.mock('../../../services/diagnosticService');

describe('Manual Lab Services - Comprehensive Tests', () => {
    let mongoServer: MongoMemoryServer;
    let testWorkplace: any;
    let testPatient: any;
    let testUser: any;
    let auditContext: AuditContext;

    beforeAll(async () => {
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

        // Mock PDF generation service
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

        jest.clearAllMocks();
    });

    describe('ManualLabService - Order Management', () => {
        const createValidOrderRequest = (): CreateOrderRequest => ({
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
        });

        describe('createOrder', () => {
            it('should create a new manual lab order successfully', async () => {
                const orderRequest = createValidOrderRequest();
                const order = await ManualLabService.createOrder(orderRequest, auditContext);

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

            it('should generate unique order IDs for same workplace', async () => {
                const orderRequest = createValidOrderRequest();

                const order1 = await ManualLabService.createOrder(orderRequest, auditContext);
                const order2 = await ManualLabService.createOrder(orderRequest, auditContext);

                expect(order1.orderId).not.toBe(order2.orderId);
                expect(order1.orderId).toMatch(/^LAB-\d{4}-\d{4}$/);
                expect(order2.orderId).toMatch(/^LAB-\d{4}-\d{4}$/);

                // Should increment sequence
                const sequence1 = parseInt(order1.orderId.split('-')[2]);
                const sequence2 = parseInt(order2.orderId.split('-')[2]);
                expect(sequence2).toBe(sequence1 + 1);
            });

            it('should generate PDF requisition during order creation', async () => {
                const orderRequest = createValidOrderRequest();
                const order = await ManualLabService.createOrder(orderRequest, auditContext);

                expect(PDFGenerationService.prototype.generateRequisitionPDF).toHaveBeenCalledWith(
                    expect.objectContaining({ orderId: order.orderId }),
                    expect.objectContaining({ _id: testPatient._id }),
                    expect.objectContaining({ _id: testWorkplace._id }),
                    expect.objectContaining({ _id: testUser._id })
                );

                expect(order.requisitionFormUrl).toBe(`/api/manual-lab-orders/${order.orderId}/pdf`);
            });

            it('should generate secure tokens for barcode/QR code', async () => {
                const orderRequest = createValidOrderRequest();
                const order = await ManualLabService.createOrder(orderRequest, auditContext);

                expect(order.barcodeData).toBeDefined();
                expect(order.barcodeData.length).toBeGreaterThan(0);

                // Verify token can be resolved
                const resolvedOrder = await ManualLabService.resolveToken(order.barcodeData, auditContext);
                expect(resolvedOrder).toBeDefined();
                expect(resolvedOrder!.orderId).toBe(order.orderId);
            });

            it('should validate patient exists and belongs to workplace', async () => {
                const otherWorkplace = await Workplace.create({
                    name: 'Other Pharmacy',
                    address: '456 Other St',
                    phone: '555-0456',
                    email: 'other@pharmacy.com',
                    licenseNumber: 'PH789012',
                    isActive: true
                });

                const otherPatient = await Patient.create({
                    firstName: 'Jane',
                    lastName: 'Smith',
                    mrn: 'MRN789012',
                    dateOfBirth: new Date('1985-01-01'),
                    gender: 'female',
                    workplaceId: otherWorkplace._id,
                    createdBy: testUser._id
                });

                const orderRequest = {
                    ...createValidOrderRequest(),
                    patientId: otherPatient._id
                };

                await expect(
                    ManualLabService.createOrder(orderRequest, auditContext)
                ).rejects.toThrow('Patient not found or does not belong to this workplace');
            });

            it('should validate ordering user exists and belongs to workplace', async () => {
                const otherUser = await User.create({
                    firstName: 'Other',
                    lastName: 'Pharmacist',
                    email: 'other@pharmacy.com',
                    password: 'hashedpassword',
                    role: 'pharmacist',
                    workplaceId: new mongoose.Types.ObjectId(),
                    isActive: true
                });

                const orderRequest = {
                    ...createValidOrderRequest(),
                    orderedBy: otherUser._id
                };

                await expect(
                    ManualLabService.createOrder(orderRequest, auditContext)
                ).rejects.toThrow('Invalid ordering user or user does not belong to this workplace');
            });

            it('should validate consent is obtained', async () => {
                const orderRequest = {
                    ...createValidOrderRequest(),
                    consentObtained: false
                };

                await expect(
                    ManualLabService.createOrder(orderRequest, auditContext)
                ).rejects.toThrow('Patient consent is required');
            });

            it('should validate test data', async () => {
                const orderRequest = {
                    ...createValidOrderRequest(),
                    tests: []
                };

                await expect(
                    ManualLabService.createOrder(orderRequest, auditContext)
                ).rejects.toThrow('At least one test is required');
            });

            it('should handle PDF generation failure gracefully', async () => {
                const mockPDFService = PDFGenerationService as jest.MockedClass<typeof PDFGenerationService>;
                mockPDFService.prototype.generateRequisitionPDF = jest.fn().mockRejectedValue(
                    new Error('PDF generation failed')
                );

                const orderRequest = createValidOrderRequest();

                await expect(
                    ManualLabService.createOrder(orderRequest, auditContext)
                ).rejects.toThrow('Failed to generate PDF requisition');
            });

            it('should set correct priority levels', async () => {
                const priorities = ['routine', 'urgent', 'stat'] as const;

                for (const priority of priorities) {
                    const orderRequest = { ...createValidOrderRequest(), priority };
                    const order = await ManualLabService.createOrder(orderRequest, auditContext);

                    expect(order.priority).toBe(priority);
                }
            });

            it('should handle location ID if provided', async () => {
                const orderRequest = {
                    ...createValidOrderRequest(),
                    locationId: 'main-branch'
                };

                const order = await ManualLabService.createOrder(orderRequest, auditContext);
                expect(order.locationId).toBe('main-branch');
            });
        });

        describe('getOrderById', () => {
            let testOrder: IManualLabOrder;

            beforeEach(async () => {
                const orderRequest = createValidOrderRequest();
                testOrder = await ManualLabService.createOrder(orderRequest, auditContext);
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

            it('should populate related data correctly', async () => {
                const retrievedOrder = await ManualLabService.getOrderById(
                    testOrder.orderId,
                    testWorkplace._id,
                    auditContext
                );

                expect(retrievedOrder).toBeDefined();
                expect(retrievedOrder!.patientId).toBeDefined();
                expect(retrievedOrder!.orderedBy).toBeDefined();
                expect(retrievedOrder!.workplaceId).toBeDefined();
            });
        });

        describe('getOrdersByPatient', () => {
            beforeEach(async () => {
                // Create multiple orders for the patient
                for (let i = 0; i < 5; i++) {
                    const orderRequest = {
                        ...createValidOrderRequest(),
                        tests: [{
                            name: `Test ${i + 1}`,
                            code: `T${i + 1}`,
                            specimenType: 'Blood',
                            unit: 'mg/dL',
                            refRange: '0-100',
                            category: 'Chemistry'
                        }],
                        indication: `Test indication ${i + 1}`,
                        priority: (i % 2 === 0 ? 'routine' : 'urgent') as any
                    };

                    await ManualLabService.createOrder(orderRequest, auditContext);
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
                // Update one order status
                const orders = await ManualLabOrder.find({ patientId: testPatient._id });
                await ManualLabService.updateOrderStatus(
                    orders[0].orderId,
                    { status: 'sample_collected', updatedBy: testUser._id },
                    auditContext
                );

                const requestedResult = await ManualLabService.getOrdersByPatient(
                    testPatient._id,
                    testWorkplace._id,
                    { status: 'requested' }
                );

                const collectedResult = await ManualLabService.getOrdersByPatient(
                    testPatient._id,
                    testWorkplace._id,
                    { status: 'sample_collected' }
                );

                expect(requestedResult.data).toHaveLength(4);
                expect(collectedResult.data).toHaveLength(1);
                expect(collectedResult.data[0].status).toBe('sample_collected');
            });

            it('should filter orders by priority', async () => {
                const routineResult = await ManualLabService.getOrdersByPatient(
                    testPatient._id,
                    testWorkplace._id,
                    { priority: 'routine' }
                );

                const urgentResult = await ManualLabService.getOrdersByPatient(
                    testPatient._id,
                    testWorkplace._id,
                    { priority: 'urgent' }
                );

                expect(routineResult.data).toHaveLength(3);
                expect(urgentResult.data).toHaveLength(2);
                expect(routineResult.data.every(o => o.priority === 'routine')).toBe(true);
                expect(urgentResult.data.every(o => o.priority === 'urgent')).toBe(true);
            });

            it('should sort orders correctly', async () => {
                const ascResult = await ManualLabService.getOrdersByPatient(
                    testPatient._id,
                    testWorkplace._id,
                    { sortBy: 'createdAt', sortOrder: 'asc' }
                );

                const descResult = await ManualLabService.getOrdersByPatient(
                    testPatient._id,
                    testWorkplace._id,
                    { sortBy: 'createdAt', sortOrder: 'desc' }
                );

                expect(ascResult.data).toHaveLength(5);
                expect(descResult.data).toHaveLength(5);

                // Check ascending order
                for (let i = 1; i < ascResult.data.length; i++) {
                    expect(ascResult.data[i].createdAt.getTime()).toBeGreaterThanOrEqual(
                        ascResult.data[i - 1].createdAt.getTime()
                    );
                }

                // Check descending order
                for (let i = 1; i < descResult.data.length; i++) {
                    expect(descResult.data[i].createdAt.getTime()).toBeLessThanOrEqual(
                        descResult.data[i - 1].createdAt.getTime()
                    );
                }
            });

            it('should handle date range filters', async () => {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);

                const todayResult = await ManualLabService.getOrdersByPatient(
                    testPatient._id,
                    testWorkplace._id,
                    { fromDate: yesterday, toDate: tomorrow }
                );

                const futureResult = await ManualLabService.getOrdersByPatient(
                    testPatient._id,
                    testWorkplace._id,
                    { fromDate: tomorrow }
                );

                expect(todayResult.data).toHaveLength(5);
                expect(futureResult.data).toHaveLength(0);
            });
        });

        describe('updateOrderStatus', () => {
            let testOrder: IManualLabOrder;

            beforeEach(async () => {
                const orderRequest = createValidOrderRequest();
                testOrder = await ManualLabService.createOrder(orderRequest, auditContext);
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
                // Valid transitions
                const validTransitions = [
                    { from: 'requested', to: 'sample_collected' },
                    { from: 'sample_collected', to: 'result_awaited' },
                    { from: 'result_awaited', to: 'completed' },
                    { from: 'result_awaited', to: 'referred' }
                ];

                for (const transition of validTransitions) {
                    const orderRequest = createValidOrderRequest();
                    const order = await ManualLabService.createOrder(orderRequest, auditContext);

                    if (transition.from !== 'requested') {
                        await ManualLabService.updateOrderStatus(
                            order.orderId,
                            { status: transition.from as any, updatedBy: testUser._id },
                            auditContext
                        );
                    }

                    const updatedOrder = await ManualLabService.updateOrderStatus(
                        order.orderId,
                        { status: transition.to as any, updatedBy: testUser._id },
                        auditContext
                    );

                    expect(updatedOrder.status).toBe(transition.to);
                }
            });

            it('should reject invalid status transitions', async () => {
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

            it('should validate workplace access', async () => {
                const otherWorkplace = await Workplace.create({
                    name: 'Other Pharmacy',
                    address: '456 Other St',
                    phone: '555-0456',
                    email: 'other@pharmacy.com',
                    licenseNumber: 'PH789012',
                    isActive: true
                });

                const otherAuditContext = {
                    ...auditContext,
                    workplaceId: otherWorkplace._id
                };

                await expect(
                    ManualLabService.updateOrderStatus(
                        testOrder.orderId,
                        {
                            status: 'sample_collected',
                            updatedBy: testUser._id
                        },
                        otherAuditContext
                    )
                ).rejects.toThrow('Lab order not found');
            });
        });
    });

    describe('ManualLabService - Result Management', () => {
        let testOrder: IManualLabOrder;

        beforeEach(async () => {
            const orderRequest: CreateOrderRequest = {
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

            testOrder = await ManualLabService.createOrder(orderRequest, auditContext);

            // Update status to allow result entry
            await ManualLabService.updateOrderStatus(
                testOrder.orderId,
                { status: 'sample_collected', updatedBy: testUser._id },
                auditContext
            );
        });

        describe('addResults', () => {
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
                const orderRequest: CreateOrderRequest = {
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

                const newOrder = await ManualLabService.createOrder(orderRequest, auditContext);

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

            it('should handle string values correctly', async () => {
                const resultData: AddResultsRequest = {
                    enteredBy: testUser._id,
                    values: [
                        {
                            testCode: 'CBC',
                            testName: 'Complete Blood Count',
                            stringValue: 'Normal morphology',
                            comment: 'No abnormal cells seen'
                        }
                    ]
                };

                const result = await ManualLabService.addResults(
                    testOrder.orderId,
                    resultData,
                    auditContext
                );

                expect(result.values[0].stringValue).toBe('Normal morphology');
                expect(result.values[0].comment).toBe('No abnormal cells seen');
                expect(result.values[0].numericValue).toBeUndefined();
            });

            it('should update order status to result_awaited after adding results', async () => {
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

                await ManualLabService.addResults(testOrder.orderId, resultData, auditContext);

                const updatedOrder = await ManualLabOrder.findOne({ orderId: testOrder.orderId });
                expect(updatedOrder!.status).toBe('result_awaited');
            });
        });

        describe('getResultsByOrder', () => {
            let testResult: IManualLabResult;

            beforeEach(async () => {
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

                testResult = await ManualLabService.addResults(
                    testOrder.orderId,
                    resultData,
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
                const orderRequest: CreateOrderRequest = {
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

                const newOrder = await ManualLabService.createOrder(orderRequest, auditContext);

                const retrievedResult = await ManualLabService.getResultsByOrder(
                    newOrder.orderId,
                    testWorkplace._id,
                    auditContext
                );

                expect(retrievedResult).toBeNull();
            });

            it('should validate workplace access', async () => {
                const otherWorkplace = await Workplace.create({
                    name: 'Other Pharmacy',
                    address: '456 Other St',
                    phone: '555-0456',
                    email: 'other@pharmacy.com',
                    licenseNumber: 'PH789012',
                    isActive: true
                });

                const retrievedResult = await ManualLabService.getResultsByOrder(
                    testOrder.orderId,
                    otherWorkplace._id,
                    auditContext
                );

                expect(retrievedResult).toBeNull();
            });
        });
    });

    describe('ManualLabService - Token Management', () => {
        let testOrder: IManualLabOrder;
        let validToken: string;

        beforeEach(async () => {
            const orderRequest: CreateOrderRequest = {
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

            testOrder = await ManualLabService.createOrder(orderRequest, auditContext);
            validToken = testOrder.barcodeData;
        });

        describe('resolveToken', () => {
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
                ).rejects.toThrow('Invalid or expired token');
            });

            it('should handle token validation errors', async () => {
                // Mock TokenService to return invalid token
                jest.spyOn(TokenService, 'validateToken').mockReturnValue({
                    valid: false,
                    error: 'Token expired'
                });

                await expect(
                    ManualLabService.resolveToken(validToken, auditContext)
                ).rejects.toThrow('Invalid or expired token');

                // Restore original implementation
                jest.restoreAllMocks();
            });

            it('should validate workplace access through token', async () => {
                const otherWorkplace = await Workplace.create({
                    name: 'Other Pharmacy',
                    address: '456 Other St',
                    phone: '555-0456',
                    email: 'other@pharmacy.com',
                    licenseNumber: 'PH789012',
                    isActive: true
                });

                const otherAuditContext = {
                    ...auditContext,
                    workplaceId: otherWorkplace._id
                };

                await expect(
                    ManualLabService.resolveToken(validToken, otherAuditContext)
                ).rejects.toThrow('Order not found or access denied');
            });
        });

        describe('generateSecureToken', () => {
            it('should generate secure token for order', async () => {
                const tokenData = await ManualLabService.generateSecureToken(
                    testOrder.orderId,
                    auditContext
                );

                expect(tokenData).toHaveProperty('token');
                expect(tokenData).toHaveProperty('hashedToken');
                expect(tokenData).toHaveProperty('expiresAt');
                expect(tokenData).toHaveProperty('qrCodeData');
                expect(tokenData).toHaveProperty('barcodeData');

                expect(tokenData.token).toBeDefined();
                expect(tokenData.hashedToken).toBeDefined();
                expect(tokenData.expiresAt).toBeInstanceOf(Date);
                expect(tokenData.qrCodeData).toContain('/lab/scan?token=');
                expect(tokenData.barcodeData).toContain(testOrder.orderId);
            });

            it('should generate different tokens for different orders', async () => {
                const orderRequest: CreateOrderRequest = {
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

                const otherOrder = await ManualLabService.createOrder(orderRequest, auditContext);

                const token1 = await ManualLabService.generateSecureToken(testOrder.orderId, auditContext);
                const token2 = await ManualLabService.generateSecureToken(otherOrder.orderId, auditContext);

                expect(token1.token).not.toBe(token2.token);
                expect(token1.hashedToken).not.toBe(token2.hashedToken);
                expect(token1.barcodeData).not.toBe(token2.barcodeData);
            });

            it('should throw error for non-existent order', async () => {
                await expect(
                    ManualLabService.generateSecureToken('LAB-2024-9999', auditContext)
                ).rejects.toThrow('Lab order not found');
            });
        });
    });

    describe('ManualLabService - Error Handling', () => {
        it('should handle database connection errors gracefully', async () => {
            // Simulate database error
            jest.spyOn(ManualLabOrder, 'create').mockRejectedValue(new Error('Database connection failed'));

            const orderRequest: CreateOrderRequest = {
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

            await expect(
                ManualLabService.createOrder(orderRequest, auditContext)
            ).rejects.toThrow('Database connection failed');

            // Restore original implementation
            jest.restoreAllMocks();
        });

        it('should handle validation errors properly', async () => {
            const invalidOrderRequest = {
                patientId: new mongoose.Types.ObjectId(), // Non-existent patient
                workplaceId: testWorkplace._id,
                orderedBy: testUser._id,
                tests: [],
                indication: '',
                consentObtained: false,
                consentObtainedBy: testUser._id
            };

            await expect(
                ManualLabService.createOrder(invalidOrderRequest as any, auditContext)
            ).rejects.toThrow();
        });

        it('should handle concurrent access properly', async () => {
            const orderRequest: CreateOrderRequest = {
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

            // Create multiple orders concurrently
            const promises = Array.from({ length: 5 }, () =>
                ManualLabService.createOrder(orderRequest, auditContext)
            );

            const orders = await Promise.all(promises);

            // All orders should be created successfully with unique IDs
            const orderIds = orders.map(o => o.orderId);
            const uniqueOrderIds = new Set(orderIds);
            expect(uniqueOrderIds.size).toBe(5);
        });
    });
});