import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import ManualLabOrder, { IManualLabOrder } from '../models/ManualLabOrder';
import ManualLabResult, { IManualLabResult } from '../models/ManualLabResult';
import TestCatalog from '../models/TestCatalog';

describe('Manual Lab Models - Comprehensive Tests', () => {
    let mongoServer: MongoMemoryServer;

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
        await mongoose.connection.db.dropDatabase();
    });

    describe('ManualLabOrder Model - Comprehensive Tests', () => {
        const createValidOrderData = () => ({
            orderId: 'LAB-2024-0001',
            patientId: new mongoose.Types.ObjectId(),
            workplaceId: new mongoose.Types.ObjectId(),
            orderedBy: new mongoose.Types.ObjectId(),
            tests: [{
                name: 'Complete Blood Count',
                code: 'CBC',
                specimenType: 'Blood',
                unit: 'cells/μL',
                refRange: '4.5-11.0 x10³',
                category: 'Hematology'
            }],
            indication: 'Routine health screening',
            requisitionFormUrl: '/api/manual-lab-orders/LAB-2024-0001/pdf',
            barcodeData: 'eyJvcmRlcklkIjoiTEFCLTIwMjQtMDAwMSJ9',
            consentObtained: true,
            consentObtainedBy: new mongoose.Types.ObjectId(),
            createdBy: new mongoose.Types.ObjectId()
        });

        describe('Model Creation and Validation', () => {
            it('should create a valid manual lab order with all required fields', async () => {
                const orderData = createValidOrderData();
                const order = new ManualLabOrder(orderData);
                const savedOrder = await order.save();

                expect(savedOrder._id).toBeDefined();
                expect(savedOrder.orderId).toBe('LAB-2024-0001');
                expect(savedOrder.status).toBe('requested');
                expect(savedOrder.priority).toBe('routine');
                expect(savedOrder.tests).toHaveLength(1);
                expect(savedOrder.tests[0].name).toBe('Complete Blood Count');
                expect(savedOrder.consentObtained).toBe(true);
                expect(savedOrder.consentTimestamp).toBeDefined();
                expect(savedOrder.createdAt).toBeDefined();
                expect(savedOrder.updatedAt).toBeDefined();
            });

            it('should require patient consent to be true', async () => {
                const orderData = { ...createValidOrderData(), consentObtained: false };
                const order = new ManualLabOrder(orderData);

                await expect(order.save()).rejects.toThrow('Patient consent is required');
            });

            it('should require at least one test', async () => {
                const orderData = { ...createValidOrderData(), tests: [] };
                const order = new ManualLabOrder(orderData);

                await expect(order.save()).rejects.toThrow('At least one test is required');
            });

            it('should validate required fields', async () => {
                const requiredFields = [
                    'orderId', 'patientId', 'workplaceId', 'orderedBy',
                    'tests', 'indication', 'requisitionFormUrl', 'barcodeData',
                    'consentObtained', 'consentObtainedBy', 'createdBy'
                ];

                for (const field of requiredFields) {
                    const orderData = { ...createValidOrderData() };
                    delete (orderData as any)[field];
                    const order = new ManualLabOrder(orderData);

                    await expect(order.save()).rejects.toThrow();
                }
            });

            it('should enforce unique order ID per workplace', async () => {
                const workplaceId = new mongoose.Types.ObjectId();
                const orderData1 = { ...createValidOrderData(), workplaceId };
                const orderData2 = {
                    ...createValidOrderData(),
                    workplaceId,
                    barcodeData: 'different-barcode-data'
                };

                await ManualLabOrder.create(orderData1);
                await expect(ManualLabOrder.create(orderData2)).rejects.toThrow();
            });

            it('should enforce unique barcode data globally', async () => {
                const orderData1 = createValidOrderData();
                const orderData2 = {
                    ...createValidOrderData(),
                    orderId: 'LAB-2024-0002',
                    workplaceId: new mongoose.Types.ObjectId()
                };

                await ManualLabOrder.create(orderData1);
                await expect(ManualLabOrder.create(orderData2)).rejects.toThrow();
            });

            it('should validate field length limits', async () => {
                const testCases = [
                    { field: 'orderId', value: 'A'.repeat(21), error: 'Order ID cannot exceed 20 characters' },
                    { field: 'indication', value: 'A'.repeat(1001), error: 'Indication cannot exceed 1000 characters' },
                    { field: 'requisitionFormUrl', value: 'A'.repeat(501), error: 'Requisition form URL cannot exceed 500 characters' },
                    { field: 'barcodeData', value: 'A'.repeat(501), error: 'Barcode data cannot exceed 500 characters' },
                    { field: 'notes', value: 'A'.repeat(1001), error: 'Notes cannot exceed 1000 characters' }
                ];

                for (const testCase of testCases) {
                    const orderData = { ...createValidOrderData(), [testCase.field]: testCase.value };
                    const order = new ManualLabOrder(orderData);

                    await expect(order.save()).rejects.toThrow(testCase.error);
                }
            });

            it('should validate test data structure', async () => {
                const orderData = createValidOrderData();
                orderData.tests = [{
                    name: 'Complete Blood Count',
                    code: 'CBC',
                    specimenType: 'Blood',
                    unit: 'cells/μL',
                    refRange: '4.5-11.0 x10³',
                    category: 'Hematology'
                }];

                const order = new ManualLabOrder(orderData);
                const savedOrder = await order.save();

                expect(savedOrder.tests[0].name).toBe('Complete Blood Count');
                expect(savedOrder.tests[0].code).toBe('CBC');
                expect(savedOrder.tests[0].specimenType).toBe('Blood');
                expect(savedOrder.tests[0].unit).toBe('cells/μL');
                expect(savedOrder.tests[0].refRange).toBe('4.5-11.0 x10³');
                expect(savedOrder.tests[0].category).toBe('Hematology');
            });

            it('should validate test field length limits', async () => {
                const orderData = createValidOrderData();
                orderData.tests = [{
                    name: 'A'.repeat(201), // Exceeds 200 character limit
                    code: 'CBC',
                    specimenType: 'Blood'
                }];

                const order = new ManualLabOrder(orderData);
                await expect(order.save()).rejects.toThrow('Test name cannot exceed 200 characters');
            });

            it('should convert test codes to uppercase', async () => {
                const orderData = createValidOrderData();
                orderData.tests = [{
                    name: 'Complete Blood Count',
                    code: 'cbc', // lowercase
                    specimenType: 'Blood'
                }];

                const order = new ManualLabOrder(orderData);
                const savedOrder = await order.save();

                expect(savedOrder.tests[0].code).toBe('CBC');
            });

            it('should validate status enum values', async () => {
                const validStatuses = ['requested', 'sample_collected', 'result_awaited', 'completed', 'referred'];

                for (const status of validStatuses) {
                    const orderData = { ...createValidOrderData(), status };
                    const order = new ManualLabOrder(orderData);
                    const savedOrder = await order.save();
                    expect(savedOrder.status).toBe(status);
                }

                // Test invalid status
                const orderData = { ...createValidOrderData(), status: 'invalid_status' };
                const order = new ManualLabOrder(orderData);
                await expect(order.save()).rejects.toThrow();
            });

            it('should validate priority enum values', async () => {
                const validPriorities = ['routine', 'urgent', 'stat'];

                for (const priority of validPriorities) {
                    const orderData = { ...createValidOrderData(), priority };
                    const order = new ManualLabOrder(orderData);
                    const savedOrder = await order.save();
                    expect(savedOrder.priority).toBe(priority);
                }

                // Test invalid priority
                const orderData = { ...createValidOrderData(), priority: 'invalid_priority' };
                const order = new ManualLabOrder(orderData);
                await expect(order.save()).rejects.toThrow();
            });
        });

        describe('Instance Methods', () => {
            let savedOrder: IManualLabOrder;

            beforeEach(async () => {
                const orderData = createValidOrderData();
                const order = new ManualLabOrder(orderData);
                savedOrder = await order.save();
            });

            it('should update status correctly', async () => {
                const updatedBy = new mongoose.Types.ObjectId();

                await savedOrder.updateStatus('sample_collected', updatedBy);

                expect(savedOrder.status).toBe('sample_collected');
                expect(savedOrder.updatedBy).toEqual(updatedBy);
            });

            it('should check if order can be modified', () => {
                expect(savedOrder.canBeModified()).toBe(true);

                savedOrder.status = 'sample_collected';
                expect(savedOrder.canBeModified()).toBe(false);

                savedOrder.status = 'completed';
                expect(savedOrder.canBeModified()).toBe(false);
            });

            it('should check if order is active', () => {
                const activeStatuses = ['requested', 'sample_collected', 'result_awaited'];
                const inactiveStatuses = ['completed', 'referred'];

                for (const status of activeStatuses) {
                    savedOrder.status = status as any;
                    expect(savedOrder.isActive()).toBe(true);
                }

                for (const status of inactiveStatuses) {
                    savedOrder.status = status as any;
                    expect(savedOrder.isActive()).toBe(false);
                }
            });
        });

        describe('Static Methods', () => {
            let workplaceId: mongoose.Types.ObjectId;
            let patientId: mongoose.Types.ObjectId;

            beforeEach(async () => {
                workplaceId = new mongoose.Types.ObjectId();
                patientId = new mongoose.Types.ObjectId();

                // Create test orders
                const orders = [
                    {
                        ...createValidOrderData(),
                        workplaceId,
                        patientId,
                        orderId: 'LAB-2024-0001',
                        status: 'requested',
                        barcodeData: 'barcode1'
                    },
                    {
                        ...createValidOrderData(),
                        workplaceId,
                        patientId,
                        orderId: 'LAB-2024-0002',
                        status: 'sample_collected',
                        barcodeData: 'barcode2'
                    },
                    {
                        ...createValidOrderData(),
                        workplaceId,
                        patientId,
                        orderId: 'LAB-2024-0003',
                        status: 'completed',
                        barcodeData: 'barcode3'
                    }
                ];

                await ManualLabOrder.create(orders);
            });

            it('should generate unique order IDs', async () => {
                const orderId1 = await ManualLabOrder.generateNextOrderId(workplaceId);
                const orderId2 = await ManualLabOrder.generateNextOrderId(workplaceId);

                expect(orderId1).toMatch(/^LAB-\d{4}-\d{4}$/);
                expect(orderId2).toMatch(/^LAB-\d{4}-\d{4}$/);
                expect(orderId1).not.toBe(orderId2);

                // Should increment sequence
                const sequence1 = parseInt(orderId1.split('-')[2]);
                const sequence2 = parseInt(orderId2.split('-')[2]);
                expect(sequence2).toBe(sequence1 + 1);
            });

            it('should find active orders', async () => {
                const activeOrders = await ManualLabOrder.findActiveOrders(workplaceId);

                expect(activeOrders).toHaveLength(2);
                expect(activeOrders.map(o => o.status)).toEqual(
                    expect.arrayContaining(['requested', 'sample_collected'])
                );
            });

            it('should find orders by patient', async () => {
                const patientOrders = await ManualLabOrder.findByPatient(workplaceId, patientId);

                expect(patientOrders).toHaveLength(3);
                expect(patientOrders[0].createdAt.getTime()).toBeGreaterThanOrEqual(
                    patientOrders[1].createdAt.getTime()
                );
            });

            it('should find order by barcode data', async () => {
                const order = await ManualLabOrder.findByBarcodeData('barcode1');

                expect(order).toBeDefined();
                expect(order!.orderId).toBe('LAB-2024-0001');
            });

            it('should find orders by status', async () => {
                const requestedOrders = await ManualLabOrder.findByStatus(workplaceId, 'requested');
                const completedOrders = await ManualLabOrder.findByStatus(workplaceId, 'completed');

                expect(requestedOrders).toHaveLength(1);
                expect(requestedOrders[0].status).toBe('requested');

                expect(completedOrders).toHaveLength(1);
                expect(completedOrders[0].status).toBe('completed');
            });
        });

        describe('Virtual Properties', () => {
            it('should calculate isActiveOrder virtual property', async () => {
                const orderData = createValidOrderData();
                const order = new ManualLabOrder(orderData);
                const savedOrder = await order.save();

                expect(savedOrder.isActiveOrder).toBe(true);

                savedOrder.status = 'completed';
                expect(savedOrder.isActiveOrder).toBe(false);
            });
        });

        describe('Pre-save Middleware', () => {
            it('should set consent timestamp when consent is obtained', async () => {
                const orderData = { ...createValidOrderData() };
                delete (orderData as any).consentTimestamp;

                const order = new ManualLabOrder(orderData);
                const savedOrder = await order.save();

                expect(savedOrder.consentTimestamp).toBeDefined();
                expect(savedOrder.consentTimestamp).toBeInstanceOf(Date);
            });
        });
    });

    describe('ManualLabResult Model - Comprehensive Tests', () => {
        const createValidResultData = () => ({
            orderId: 'LAB-2024-0001',
            enteredBy: new mongoose.Types.ObjectId(),
            values: [{
                testCode: 'CBC',
                testName: 'Complete Blood Count',
                numericValue: 7.5,
                unit: 'x10³/μL'
            }],
            createdBy: new mongoose.Types.ObjectId()
        });

        describe('Model Creation and Validation', () => {
            it('should create a valid manual lab result', async () => {
                const resultData = createValidResultData();
                const result = new ManualLabResult(resultData);
                const savedResult = await result.save();

                expect(savedResult._id).toBeDefined();
                expect(savedResult.orderId).toBe('LAB-2024-0001');
                expect(savedResult.values).toHaveLength(1);
                expect(savedResult.values[0].testCode).toBe('CBC');
                expect(savedResult.values[0].numericValue).toBe(7.5);
                expect(savedResult.aiProcessed).toBe(false);
                expect(savedResult.enteredAt).toBeDefined();
                expect(savedResult.createdAt).toBeDefined();
            });

            it('should require at least one result value', async () => {
                const resultData = { ...createValidResultData(), values: [] };
                const result = new ManualLabResult(resultData);

                await expect(result.save()).rejects.toThrow('At least one result value is required');
            });

            it('should validate required fields', async () => {
                const requiredFields = ['orderId', 'enteredBy', 'values', 'createdBy'];

                for (const field of requiredFields) {
                    const resultData = { ...createValidResultData() };
                    delete (resultData as any)[field];
                    const result = new ManualLabResult(resultData);

                    await expect(result.save()).rejects.toThrow();
                }
            });

            it('should validate numeric values are non-negative', async () => {
                const resultData = createValidResultData();
                resultData.values = [{
                    testCode: 'CBC',
                    testName: 'Complete Blood Count',
                    numericValue: -5,
                    unit: 'x10³/μL'
                }];

                const result = new ManualLabResult(resultData);
                await expect(result.save()).rejects.toThrow('Numeric value cannot be negative');
            });

            it('should validate that values have either numeric or string value', async () => {
                const resultData = createValidResultData();
                resultData.values = [{
                    testCode: 'CBC',
                    testName: 'Complete Blood Count'
                    // Missing both numericValue and stringValue
                }];

                const result = new ManualLabResult(resultData);
                await expect(result.save()).rejects.toThrow('must have either numeric or string value');
            });

            it('should handle string values correctly', async () => {
                const resultData = createValidResultData();
                resultData.values = [{
                    testCode: 'URINE',
                    testName: 'Urine Analysis',
                    stringValue: 'Clear, yellow',
                    comment: 'Normal appearance'
                }];

                const result = new ManualLabResult(resultData);
                const savedResult = await result.save();

                expect(savedResult.values[0].stringValue).toBe('Clear, yellow');
                expect(savedResult.values[0].comment).toBe('Normal appearance');
                expect(savedResult.values[0].numericValue).toBeUndefined();
            });

            it('should validate field length limits', async () => {
                const testCases = [
                    { field: 'orderId', value: 'A'.repeat(21), error: 'Order ID cannot exceed 20 characters' },
                    { field: 'reviewNotes', value: 'A'.repeat(1001), error: 'Review notes cannot exceed 1000 characters' }
                ];

                for (const testCase of testCases) {
                    const resultData = { ...createValidResultData(), [testCase.field]: testCase.value };
                    const result = new ManualLabResult(resultData);

                    await expect(result.save()).rejects.toThrow(testCase.error);
                }
            });

            it('should validate value field length limits', async () => {
                const resultData = createValidResultData();
                resultData.values = [{
                    testCode: 'A'.repeat(21), // Exceeds 20 character limit
                    testName: 'Test',
                    numericValue: 5
                }];

                const result = new ManualLabResult(resultData);
                await expect(result.save()).rejects.toThrow('Test code cannot exceed 20 characters');
            });

            it('should convert test codes to uppercase', async () => {
                const resultData = createValidResultData();
                resultData.values = [{
                    testCode: 'cbc', // lowercase
                    testName: 'Complete Blood Count',
                    numericValue: 7.5
                }];

                const result = new ManualLabResult(resultData);
                const savedResult = await result.save();

                expect(savedResult.values[0].testCode).toBe('CBC');
            });

            it('should validate interpretation enum values', async () => {
                const validInterpretations = ['low', 'normal', 'high', 'critical'];

                for (const interpretation of validInterpretations) {
                    const resultData = createValidResultData();
                    resultData.interpretation = [{
                        testCode: 'CBC',
                        interpretation: interpretation as any
                    }];

                    const result = new ManualLabResult(resultData);
                    const savedResult = await result.save();
                    expect(savedResult.interpretation[0].interpretation).toBe(interpretation);
                }

                // Test invalid interpretation
                const resultData = createValidResultData();
                resultData.interpretation = [{
                    testCode: 'CBC',
                    interpretation: 'invalid' as any
                }];

                const result = new ManualLabResult(resultData);
                await expect(result.save()).rejects.toThrow();
            });
        });

        describe('Instance Methods', () => {
            let savedResult: IManualLabResult;

            beforeEach(async () => {
                const resultData = createValidResultData();
                const result = new ManualLabResult(resultData);
                savedResult = await result.save();
            });

            it('should add values correctly', () => {
                savedResult.addValue('HGB', 'Hemoglobin', 12.5, 'g/dL');

                expect(savedResult.values).toHaveLength(2);
                expect(savedResult.values[1].testCode).toBe('HGB');
                expect(savedResult.values[1].testName).toBe('Hemoglobin');
                expect(savedResult.values[1].numericValue).toBe(12.5);
                expect(savedResult.values[1].unit).toBe('g/dL');
            });

            it('should add string values correctly', () => {
                savedResult.addValue('URINE', 'Urine Analysis', 'Clear, yellow');

                expect(savedResult.values).toHaveLength(2);
                expect(savedResult.values[1].testCode).toBe('URINE');
                expect(savedResult.values[1].stringValue).toBe('Clear, yellow');
                expect(savedResult.values[1].numericValue).toBeUndefined();
            });

            it('should interpret values correctly', () => {
                savedResult.interpretValue('CBC', 'high', 'Above normal range');

                expect(savedResult.interpretation[0].interpretation).toBe('high');
                expect(savedResult.interpretation[0].note).toBe('Above normal range');
                expect(savedResult.values[0].abnormalFlag).toBe(true);
            });

            it('should update existing interpretation', () => {
                // First interpretation
                savedResult.interpretValue('CBC', 'normal');
                expect(savedResult.interpretation[0].interpretation).toBe('normal');

                // Update interpretation
                savedResult.interpretValue('CBC', 'high', 'Updated interpretation');
                expect(savedResult.interpretation).toHaveLength(1);
                expect(savedResult.interpretation[0].interpretation).toBe('high');
                expect(savedResult.interpretation[0].note).toBe('Updated interpretation');
            });

            it('should detect abnormal results', () => {
                expect(savedResult.hasAbnormalResults()).toBe(false);

                savedResult.interpretValue('CBC', 'high');
                expect(savedResult.hasAbnormalResults()).toBe(true);

                savedResult.interpretValue('CBC', 'critical');
                expect(savedResult.hasAbnormalResults()).toBe(true);
            });

            it('should get critical results', () => {
                savedResult.addValue('HGB', 'Hemoglobin', 5.0, 'g/dL');
                savedResult.interpretValue('CBC', 'normal');
                savedResult.interpretValue('HGB', 'critical');

                const criticalResults = savedResult.getCriticalResults();
                expect(criticalResults).toHaveLength(1);
                expect(criticalResults[0].testCode).toBe('HGB');
            });

            it('should mark as AI processed', async () => {
                const diagnosticResultId = new mongoose.Types.ObjectId();
                await savedResult.markAsAIProcessed(diagnosticResultId);

                expect(savedResult.aiProcessed).toBe(true);
                expect(savedResult.diagnosticResultId).toEqual(diagnosticResultId);
                expect(savedResult.aiProcessedAt).toBeDefined();
            });

            it('should add review information', async () => {
                const reviewerId = new mongoose.Types.ObjectId();
                await savedResult.addReview(reviewerId, 'Results reviewed and approved');

                expect(savedResult.reviewedBy).toEqual(reviewerId);
                expect(savedResult.reviewedAt).toBeDefined();
                expect(savedResult.reviewNotes).toBe('Results reviewed and approved');
                expect(savedResult.updatedBy).toEqual(reviewerId);
            });
        });

        describe('Static Methods', () => {
            beforeEach(async () => {
                const enteredBy = new mongoose.Types.ObjectId();

                const results = [
                    {
                        ...createValidResultData(),
                        orderId: 'LAB-2024-0001',
                        enteredBy,
                        values: [{
                            testCode: 'CBC',
                            testName: 'Complete Blood Count',
                            numericValue: 15,
                            unit: 'x10³/μL',
                            abnormalFlag: true
                        }]
                    },
                    {
                        ...createValidResultData(),
                        orderId: 'LAB-2024-0002',
                        enteredBy,
                        values: [{
                            testCode: 'GLU',
                            testName: 'Glucose',
                            numericValue: 85,
                            unit: 'mg/dL'
                        }]
                    }
                ];

                const result1 = new ManualLabResult(results[0]);
                result1.interpretValue('CBC', 'critical');
                await result1.save();

                const result2 = new ManualLabResult(results[1]);
                await result2.save();
            });

            it('should find result by order ID', async () => {
                const result = await ManualLabResult.findByOrderId('LAB-2024-0001');

                expect(result).toBeDefined();
                expect(result!.orderId).toBe('LAB-2024-0001');
            });

            it('should find pending AI processing results', async () => {
                const pendingResults = await ManualLabResult.findPendingAIProcessing();

                expect(pendingResults).toHaveLength(2);
                expect(pendingResults.every(r => !r.aiProcessed)).toBe(true);
            });

            it('should find abnormal results', async () => {
                const abnormalResults = await ManualLabResult.findAbnormalResults();

                expect(abnormalResults).toHaveLength(1);
                expect(abnormalResults[0].orderId).toBe('LAB-2024-0001');
            });

            it('should find critical results', async () => {
                const criticalResults = await ManualLabResult.findCriticalResults();

                expect(criticalResults).toHaveLength(1);
                expect(criticalResults[0].orderId).toBe('LAB-2024-0001');
            });

            it('should find pending review results', async () => {
                const pendingReview = await ManualLabResult.findPendingReview();

                expect(pendingReview).toHaveLength(2);
                expect(pendingReview.every(r => !r.reviewedBy)).toBe(true);
            });

            it('should find results by entered by user', async () => {
                const enteredBy = new mongoose.Types.ObjectId();

                // Create a result with specific user
                const resultData = { ...createValidResultData(), enteredBy };
                const result = new ManualLabResult(resultData);
                await result.save();

                const userResults = await ManualLabResult.findByEnteredBy(enteredBy);
                expect(userResults).toHaveLength(1);
                expect(userResults[0].enteredBy).toEqual(enteredBy);
            });

            it('should find results by entered by user with date range', async () => {
                const enteredBy = new mongoose.Types.ObjectId();
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);

                // Create a result with specific user
                const resultData = { ...createValidResultData(), enteredBy };
                const result = new ManualLabResult(resultData);
                await result.save();

                const userResults = await ManualLabResult.findByEnteredBy(enteredBy, yesterday, tomorrow);
                expect(userResults).toHaveLength(1);

                const noResults = await ManualLabResult.findByEnteredBy(enteredBy, tomorrow);
                expect(noResults).toHaveLength(0);
            });
        });

        describe('Virtual Properties', () => {
            it('should calculate isReviewed virtual property', async () => {
                const resultData = createValidResultData();
                const result = new ManualLabResult(resultData);
                const savedResult = await result.save();

                expect(savedResult.isReviewed).toBe(false);

                const reviewerId = new mongoose.Types.ObjectId();
                await savedResult.addReview(reviewerId);
                expect(savedResult.isReviewed).toBe(true);
            });

            it('should calculate processingStatus virtual property', async () => {
                const resultData = createValidResultData();
                const result = new ManualLabResult(resultData);
                const savedResult = await result.save();

                expect(savedResult.processingStatus).toBe('pending');

                const reviewerId = new mongoose.Types.ObjectId();
                await savedResult.addReview(reviewerId);
                expect(savedResult.processingStatus).toBe('reviewed');

                const diagnosticResultId = new mongoose.Types.ObjectId();
                await savedResult.markAsAIProcessed(diagnosticResultId);
                expect(savedResult.processingStatus).toBe('ai_processed');
            });
        });

        describe('Pre-save Middleware', () => {
            it('should auto-generate normal interpretation for values without interpretation', async () => {
                const resultData = createValidResultData();
                const result = new ManualLabResult(resultData);
                const savedResult = await result.save();

                expect(savedResult.interpretation).toHaveLength(1);
                expect(savedResult.interpretation[0].testCode).toBe('CBC');
                expect(savedResult.interpretation[0].interpretation).toBe('normal');
            });

            it('should not override existing interpretations', async () => {
                const resultData = createValidResultData();
                resultData.interpretation = [{
                    testCode: 'CBC',
                    interpretation: 'high',
                    note: 'Above reference range'
                }];

                const result = new ManualLabResult(resultData);
                const savedResult = await result.save();

                expect(savedResult.interpretation).toHaveLength(1);
                expect(savedResult.interpretation[0].interpretation).toBe('high');
                expect(savedResult.interpretation[0].note).toBe('Above reference range');
            });
        });
    });

    describe('TestCatalog Model - Comprehensive Tests', () => {
        const createValidTestData = () => ({
            workplaceId: new mongoose.Types.ObjectId(),
            code: 'CBC',
            name: 'Complete Blood Count',
            category: 'Hematology',
            specimenType: 'Blood',
            unit: 'cells/μL',
            refRange: '4.5-11.0 x10³',
            estimatedCost: 25.00,
            turnaroundTime: '24 hours',
            createdBy: new mongoose.Types.ObjectId()
        });

        describe('Model Creation and Validation', () => {
            it('should create a valid test catalog entry', async () => {
                const testData = createValidTestData();
                const test = new TestCatalog(testData);
                const savedTest = await test.save();

                expect(savedTest._id).toBeDefined();
                expect(savedTest.code).toBe('CBC');
                expect(savedTest.name).toBe('Complete Blood Count');
                expect(savedTest.category).toBe('Hematology');
                expect(savedTest.isActive).toBe(true);
                expect(savedTest.isCustom).toBe(false);
                expect(savedTest.createdAt).toBeDefined();
            });

            it('should enforce unique codes per workplace', async () => {
                const testData = createValidTestData();
                await TestCatalog.create(testData);

                const duplicateTest = new TestCatalog(testData);
                await expect(duplicateTest.save()).rejects.toThrow();
            });

            it('should allow same code in different workplaces', async () => {
                const testData1 = createValidTestData();
                const testData2 = {
                    ...createValidTestData(),
                    workplaceId: new mongoose.Types.ObjectId()
                };

                await TestCatalog.create(testData1);
                const savedTest2 = await TestCatalog.create(testData2);

                expect(savedTest2.code).toBe('CBC');
            });

            it('should validate required fields', async () => {
                const requiredFields = ['workplaceId', 'code', 'name', 'category', 'specimenType', 'createdBy'];

                for (const field of requiredFields) {
                    const testData = { ...createValidTestData() };
                    delete (testData as any)[field];
                    const test = new TestCatalog(testData);

                    await expect(test.save()).rejects.toThrow();
                }
            });
        });

        describe('Instance Methods', () => {
            let savedTest: any;

            beforeEach(async () => {
                const testData = createValidTestData();
                const test = new TestCatalog(testData);
                savedTest = await test.save();
            });

            it('should activate and deactivate tests', async () => {
                expect(savedTest.isActive).toBe(true);

                await savedTest.deactivate();
                expect(savedTest.isActive).toBe(false);

                await savedTest.activate();
                expect(savedTest.isActive).toBe(true);
            });

            it('should update cost correctly', async () => {
                const updatedBy = new mongoose.Types.ObjectId();

                await savedTest.updateCost(30.00, updatedBy);

                expect(savedTest.estimatedCost).toBe(30.00);
                expect(savedTest.updatedBy).toEqual(updatedBy);
            });
        });

        describe('Static Methods', () => {
            beforeEach(async () => {
                const workplaceId = new mongoose.Types.ObjectId();

                const tests = [
                    { ...createValidTestData(), workplaceId, code: 'CBC', name: 'Complete Blood Count' },
                    { ...createValidTestData(), workplaceId, code: 'HGB', name: 'Hemoglobin' },
                    { ...createValidTestData(), workplaceId, code: 'GLU', name: 'Glucose', isActive: false }
                ];

                await TestCatalog.create(tests);
            });

            it('should find active tests', async () => {
                const workplaceId = new mongoose.Types.ObjectId();

                // Create tests for this workplace
                const tests = [
                    { ...createValidTestData(), workplaceId, code: 'CBC', name: 'Complete Blood Count' },
                    { ...createValidTestData(), workplaceId, code: 'HGB', name: 'Hemoglobin' },
                    { ...createValidTestData(), workplaceId, code: 'GLU', name: 'Glucose', isActive: false }
                ];

                await TestCatalog.create(tests);

                const activeTests = await TestCatalog.findActiveTests(workplaceId);

                expect(activeTests).toHaveLength(2);
                expect(activeTests.map((t: any) => t.code)).toContain('CBC');
                expect(activeTests.map((t: any) => t.code)).toContain('HGB');
                expect(activeTests.map((t: any) => t.code)).not.toContain('GLU');
            });
        });
    });
});