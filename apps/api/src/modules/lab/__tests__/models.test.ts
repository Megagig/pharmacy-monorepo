import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ManualLabOrder, ManualLabResult, TestCatalog } from '../models';
import { IManualLabOrder } from '../models/ManualLabOrder';
import { IManualLabResult } from '../models/ManualLabResult';

describe('Manual Lab Models', () => {
    let mongoServer: MongoMemoryServer;

    beforeAll(async () => {
        // Only create new connection if not already connected
        if (mongoose.connection.readyState === 0) {
            mongoServer = await MongoMemoryServer.create();
            const mongoUri = mongoServer.getUri();
            await mongoose.connect(mongoUri);
        }
    });

    afterAll(async () => {
        // Only disconnect if we created the connection
        if (mongoServer) {
            await mongoose.disconnect();
            await mongoServer.stop();
        }
    });

    beforeEach(async () => {
        await mongoose.connection.db.dropDatabase();
    });

    describe('ManualLabOrder Model', () => {
        const validOrderData = {
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
        };

        it('should create a valid manual lab order', async () => {
            const order = new ManualLabOrder(validOrderData);
            const savedOrder = await order.save();

            expect(savedOrder.orderId).toBe('LAB-2024-0001');
            expect(savedOrder.status).toBe('requested');
            expect(savedOrder.tests).toHaveLength(1);
            expect(savedOrder.tests[0]?.name).toBe('Complete Blood Count');
            expect(savedOrder.consentObtained).toBe(true);
        });

        it('should require consent to be true', async () => {
            const orderData = { ...validOrderData, consentObtained: false };
            const order = new ManualLabOrder(orderData);

            await expect(order.save()).rejects.toThrow('Patient consent is required');
        });

        it('should require at least one test', async () => {
            const orderData = { ...validOrderData, tests: [] };
            const order = new ManualLabOrder(orderData);

            await expect(order.save()).rejects.toThrow('At least one test is required');
        });

        it('should update status correctly', async () => {
            const order = new ManualLabOrder(validOrderData);
            const savedOrder = await order.save();

            await savedOrder.updateStatus('sample_collected');
            expect(savedOrder.status).toBe('sample_collected');
        });

        it('should check if order is active', async () => {
            const order = new ManualLabOrder(validOrderData);
            const savedOrder = await order.save();

            expect(savedOrder.isActive()).toBe(true);

            await savedOrder.updateStatus('completed');
            expect(savedOrder.isActive()).toBe(false);
        });

        it('should generate unique order IDs', async () => {
            const workplaceId = new mongoose.Types.ObjectId();

            const orderId1 = await ManualLabOrder.generateNextOrderId(workplaceId);
            const orderId2 = await ManualLabOrder.generateNextOrderId(workplaceId);

            expect(orderId1).toMatch(/^LAB-\d{4}-\d{4}$/);
            expect(orderId2).toMatch(/^LAB-\d{4}-\d{4}$/);
            expect(orderId1).not.toBe(orderId2);
        });

        it('should validate test data structure', async () => {
            const orderData = {
                ...validOrderData,
                tests: [{
                    name: 'Complete Blood Count',
                    code: 'CBC',
                    specimenType: 'Blood',
                    unit: 'cells/μL',
                    refRange: '4.5-11.0 x10³',
                    category: 'Hematology'
                }]
            };

            const order = new ManualLabOrder(orderData);
            const savedOrder = await order.save();

            expect(savedOrder.tests[0]?.name).toBe('Complete Blood Count');
            expect(savedOrder.tests[0]?.code).toBe('CBC');
            expect(savedOrder.tests[0]?.specimenType).toBe('Blood');
            expect(savedOrder.tests[0]?.unit).toBe('cells/μL');
            expect(savedOrder.tests[0]?.refRange).toBe('4.5-11.0 x10³');
            expect(savedOrder.tests[0]?.category).toBe('Hematology');
        });

        it('should validate status transitions', async () => {
            const order = new ManualLabOrder(validOrderData);
            const savedOrder = await order.save();

            // Valid transitions
            await savedOrder.updateStatus('sample_collected');
            expect(savedOrder.status).toBe('sample_collected');

            await savedOrder.updateStatus('result_awaited');
            expect(savedOrder.status).toBe('result_awaited');

            await savedOrder.updateStatus('completed');
            expect(savedOrder.status).toBe('completed');
        });

        it('should check if order can be modified', async () => {
            const order = new ManualLabOrder(validOrderData);
            const savedOrder = await order.save();

            expect(savedOrder.canBeModified()).toBe(true);

            await savedOrder.updateStatus('sample_collected');
            expect(savedOrder.canBeModified()).toBe(false);
        });

        it('should validate priority levels', async () => {
            const priorities = ['routine', 'urgent', 'stat'];

            for (const priority of priorities) {
                const orderData = { ...validOrderData, priority };
                const order = new ManualLabOrder(orderData);
                const savedOrder = await order.save();

                expect(savedOrder.priority).toBe(priority);
            }
        });

        it('should enforce unique barcode data', async () => {
            const order1 = new ManualLabOrder(validOrderData);
            await order1.save();

            const order2 = new ManualLabOrder({
                ...validOrderData,
                orderId: 'LAB-2024-0002',
                barcodeData: validOrderData.barcodeData // Same barcode data
            });

            await expect(order2.save()).rejects.toThrow();
        });

        it('should validate test code format', async () => {
            const orderData = {
                ...validOrderData,
                tests: [{
                    name: 'Complete Blood Count',
                    code: 'cbc', // lowercase
                    specimenType: 'Blood',
                    unit: 'cells/μL',
                    refRange: '4.5-11.0 x10³',
                    category: 'Hematology'
                }]
            };

            const order = new ManualLabOrder(orderData);
            const savedOrder = await order.save();

            // Should be converted to uppercase
            expect(savedOrder.tests[0]?.code).toBe('CBC');
        });

        it('should validate field length limits', async () => {
            const longString = 'a'.repeat(1001);

            const orderData = {
                ...validOrderData,
                indication: longString
            };

            const order = new ManualLabOrder(orderData);
            await expect(order.save()).rejects.toThrow('Indication cannot exceed 1000 characters');
        });

        it('should find orders by various criteria', async () => {
            const workplaceId = new mongoose.Types.ObjectId();
            const patientId = new mongoose.Types.ObjectId();

            // Create test orders
            const orderData1 = {
                ...validOrderData,
                workplaceId,
                patientId,
                orderId: 'LAB-2024-0001',
                status: 'requested' as const,
                barcodeData: 'barcode1'
            };

            const orderData2 = {
                ...validOrderData,
                workplaceId,
                patientId,
                orderId: 'LAB-2024-0002',
                status: 'completed' as const,
                barcodeData: 'barcode2'
            };

            await ManualLabOrder.create([orderData1, orderData2]);

            // Test static methods
            const activeOrders = await ManualLabOrder.findActiveOrders(workplaceId);
            expect(activeOrders).toHaveLength(1);
            expect(activeOrders[0].status).toBe('requested');

            const patientOrders = await ManualLabOrder.findByPatient(workplaceId, patientId);
            expect(patientOrders).toHaveLength(2);

            const barcodeOrder = await ManualLabOrder.findByBarcodeData('barcode1');
            expect(barcodeOrder).toBeDefined();
            expect(barcodeOrder?.orderId).toBe('LAB-2024-0001');

            const statusOrders = await ManualLabOrder.findByStatus(workplaceId, 'completed');
            expect(statusOrders).toHaveLength(1);
            expect(statusOrders[0].status).toBe('completed');
        });
    });

    describe('ManualLabResult Model', () => {
        const validResultData = {
            orderId: 'LAB-2024-0001',
            enteredBy: new mongoose.Types.ObjectId(),
            values: [{
                testCode: 'CBC',
                testName: 'Complete Blood Count',
                numericValue: 7.5,
                unit: 'x10³/μL'
            }],
            createdBy: new mongoose.Types.ObjectId()
        };

        it('should create a valid manual lab result', async () => {
            const result = new ManualLabResult(validResultData);
            const savedResult = await result.save();

            expect(savedResult.orderId).toBe('LAB-2024-0001');
            expect(savedResult.values).toHaveLength(1);
            expect(savedResult.values[0]?.testCode).toBe('CBC');
            expect(savedResult.values[0]?.numericValue).toBe(7.5);
            expect(savedResult.aiProcessed).toBe(false);
        });

        it('should require at least one result value', async () => {
            const resultData = { ...validResultData, values: [] };
            const result = new ManualLabResult(resultData);

            await expect(result.save()).rejects.toThrow('At least one result value is required');
        });

        it('should auto-generate normal interpretation', async () => {
            const result = new ManualLabResult(validResultData);
            const savedResult = await result.save();

            expect(savedResult.interpretation).toHaveLength(1);
            expect(savedResult.interpretation[0]?.testCode).toBe('CBC');
            expect(savedResult.interpretation[0]?.interpretation).toBe('normal');
        });

        it('should add values correctly', async () => {
            const result = new ManualLabResult(validResultData);

            result.addValue('HGB', 'Hemoglobin', 12.5, 'g/dL');

            expect(result.values).toHaveLength(2);
            expect(result.values[1]?.testCode).toBe('HGB');
            expect(result.values[1]?.testName).toBe('Hemoglobin');
            expect(result.values[1]?.numericValue).toBe(12.5);
            expect(result.values[1]?.unit).toBe('g/dL');
        });

        it('should interpret values correctly', async () => {
            const result = new ManualLabResult(validResultData);

            result.interpretValue('CBC', 'high', 'Above normal range');

            expect(result.interpretation[0]?.interpretation).toBe('high');
            expect(result.interpretation[0]?.note).toBe('Above normal range');
            expect(result.values[0]?.abnormalFlag).toBe(true);
        });

        it('should detect abnormal results', async () => {
            const result = new ManualLabResult(validResultData);
            result.interpretValue('CBC', 'critical');

            expect(result.hasAbnormalResults()).toBe(true);
        });

        it('should mark as AI processed', async () => {
            const result = new ManualLabResult(validResultData);
            const savedResult = await result.save();

            const diagnosticResultId = new mongoose.Types.ObjectId();
            await savedResult.markAsAIProcessed(diagnosticResultId);

            expect(savedResult.aiProcessed).toBe(true);
            expect(savedResult.diagnosticResultId).toEqual(diagnosticResultId);
            expect(savedResult.aiProcessedAt).toBeDefined();
        });

        it('should validate numeric values are non-negative', async () => {
            const resultData = {
                ...validResultData,
                values: [{
                    testCode: 'CBC',
                    testName: 'Complete Blood Count',
                    numericValue: -5, // Negative value
                    unit: 'x10³/μL'
                }]
            };

            const result = new ManualLabResult(resultData);
            await expect(result.save()).rejects.toThrow('Numeric value cannot be negative');
        });

        it('should validate that values have either numeric or string value', async () => {
            const resultData = {
                ...validResultData,
                values: [{
                    testCode: 'CBC',
                    testName: 'Complete Blood Count'
                    // Missing both numericValue and stringValue
                }]
            };

            const result = new ManualLabResult(resultData);
            await expect(result.save()).rejects.toThrow('must have either numeric or string value');
        });

        it('should handle string values correctly', async () => {
            const resultData = {
                ...validResultData,
                values: [{
                    testCode: 'URINE',
                    testName: 'Urine Analysis',
                    stringValue: 'Clear, yellow',
                    comment: 'Normal appearance'
                }]
            };

            const result = new ManualLabResult(resultData);
            const savedResult = await result.save();

            expect(savedResult.values[0]?.stringValue).toBe('Clear, yellow');
            expect(savedResult.values[0]?.comment).toBe('Normal appearance');
            expect(savedResult.values[0]?.numericValue).toBeUndefined();
        });

        it('should detect critical results', async () => {
            const result = new ManualLabResult(validResultData);
            result.interpretValue('CBC', 'critical', 'Extremely high white cell count');

            const savedResult = await result.save();
            const criticalResults = savedResult.getCriticalResults();

            expect(criticalResults).toHaveLength(1);
            expect(criticalResults[0].testCode).toBe('CBC');
        });

        it('should add review information', async () => {
            const result = new ManualLabResult(validResultData);
            const savedResult = await result.save();

            const reviewerId = new mongoose.Types.ObjectId();
            await savedResult.addReview(reviewerId, 'Results reviewed and approved');

            expect(savedResult.reviewedBy).toEqual(reviewerId);
            expect(savedResult.reviewedAt).toBeDefined();
            expect(savedResult.reviewNotes).toBe('Results reviewed and approved');
        });

        it('should find results by various criteria', async () => {
            const orderId1 = 'LAB-2024-0001';
            const orderId2 = 'LAB-2024-0002';
            const enteredBy = new mongoose.Types.ObjectId();

            const resultData1 = {
                ...validResultData,
                orderId: orderId1,
                enteredBy,
                values: [{
                    testCode: 'CBC',
                    testName: 'Complete Blood Count',
                    numericValue: 15, // High value
                    unit: 'x10³/μL',
                    abnormalFlag: true
                }]
            };

            const resultData2 = {
                ...validResultData,
                orderId: orderId2,
                enteredBy,
                values: [{
                    testCode: 'GLU',
                    testName: 'Glucose',
                    numericValue: 85,
                    unit: 'mg/dL'
                }]
            };

            const result1 = new ManualLabResult(resultData1);
            result1.interpretValue('CBC', 'critical');
            await result1.save();

            const result2 = new ManualLabResult(resultData2);
            await result2.save();

            // Test static methods
            const orderResult = await ManualLabResult.findByOrderId(orderId1);
            expect(orderResult).toBeDefined();
            expect(orderResult?.orderId).toBe(orderId1);

            const pendingAI = await ManualLabResult.findPendingAIProcessing();
            expect(pendingAI).toHaveLength(2);

            const abnormalResults = await ManualLabResult.findAbnormalResults();
            expect(abnormalResults).toHaveLength(1);
            expect(abnormalResults[0].orderId).toBe(orderId1);

            const criticalResults = await ManualLabResult.findCriticalResults();
            expect(criticalResults).toHaveLength(1);
            expect(criticalResults[0].orderId).toBe(orderId1);

            const pendingReview = await ManualLabResult.findPendingReview();
            expect(pendingReview).toHaveLength(2);

            const userResults = await ManualLabResult.findByEnteredBy(enteredBy);
            expect(userResults).toHaveLength(2);
        });

        it('should handle interpretation updates correctly', async () => {
            const result = new ManualLabResult(validResultData);
            const savedResult = await result.save();

            // Initial interpretation should be 'normal'
            expect(savedResult.interpretation[0]?.interpretation).toBe('normal');

            // Update interpretation
            savedResult.interpretValue('CBC', 'high', 'Above reference range');

            expect(savedResult.interpretation[0]?.interpretation).toBe('high');
            expect(savedResult.interpretation[0]?.note).toBe('Above reference range');
            expect(savedResult.values[0]?.abnormalFlag).toBe(true);
        });

        it('should validate field length limits', async () => {
            const longString = 'a'.repeat(1001);

            const resultData = {
                ...validResultData,
                values: [{
                    testCode: 'CBC',
                    testName: 'Complete Blood Count',
                    numericValue: 7.5,
                    unit: 'x10³/μL',
                    comment: longString
                }]
            };

            const result = new ManualLabResult(resultData);
            await expect(result.save()).rejects.toThrow('Comment cannot exceed 1000 characters');
        });
    });

    describe('TestCatalog Model', () => {
        const validTestData = {
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
        };

        it('should create a valid test catalog entry', async () => {
            const test = new TestCatalog(validTestData);
            const savedTest = await test.save();

            expect(savedTest.code).toBe('CBC');
            expect(savedTest.name).toBe('Complete Blood Count');
            expect(savedTest.category).toBe('Hematology');
            expect(savedTest.isActive).toBe(true);
            expect(savedTest.isCustom).toBe(false);
        });

        it('should enforce unique codes per workplace', async () => {
            const test1 = new TestCatalog(validTestData);
            await test1.save();

            const test2 = new TestCatalog(validTestData);
            await expect(test2.save()).rejects.toThrow();
        });

        it('should allow same code in different workplaces', async () => {
            const test1 = new TestCatalog(validTestData);
            await test1.save();

            const test2 = new TestCatalog({
                ...validTestData,
                workplaceId: new mongoose.Types.ObjectId()
            });

            const savedTest2 = await test2.save();
            expect(savedTest2.code).toBe('CBC');
        });

        it('should activate and deactivate tests', async () => {
            const test = new TestCatalog(validTestData);
            const savedTest = await test.save();

            await savedTest.deactivate();
            expect(savedTest.isActive).toBe(false);

            await savedTest.activate();
            expect(savedTest.isActive).toBe(true);
        });

        it('should update cost correctly', async () => {
            const test = new TestCatalog(validTestData);
            const savedTest = await test.save();
            const updatedBy = new mongoose.Types.ObjectId();

            await savedTest.updateCost(30.00, updatedBy);

            expect(savedTest.estimatedCost).toBe(30.00);
            expect(savedTest.updatedBy).toEqual(updatedBy);
        });

        it('should find active tests', async () => {
            const workplaceId = new mongoose.Types.ObjectId();

            const test1 = new TestCatalog({ ...validTestData, workplaceId, code: 'CBC' });
            const test2 = new TestCatalog({ ...validTestData, workplaceId, code: 'HGB', name: 'Hemoglobin' });
            const test3 = new TestCatalog({ ...validTestData, workplaceId, code: 'GLU', name: 'Glucose', isActive: false });

            await Promise.all([test1.save(), test2.save(), test3.save()]);

            const activeTests = await TestCatalog.findActiveTests(workplaceId);

            expect(activeTests).toHaveLength(2);
            expect(activeTests.map((t: any) => t.code)).toContain('CBC');
            expect(activeTests.map((t: any) => t.code)).toContain('HGB');
            expect(activeTests.map((t: any) => t.code)).not.toContain('GLU');
        });
    });
});