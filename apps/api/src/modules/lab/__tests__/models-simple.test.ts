import mongoose from 'mongoose';
import { ManualLabOrder, ManualLabResult, TestCatalog } from '../models';

describe('Manual Lab Models - Structure Tests', () => {
    describe('ManualLabOrder Model', () => {
        it('should have correct schema structure', () => {
            const schema = ManualLabOrder.schema;

            // Check required fields
            expect(schema.paths.orderId).toBeDefined();
            expect(schema.paths.patientId).toBeDefined();
            expect(schema.paths.workplaceId).toBeDefined();
            expect(schema.paths.orderedBy).toBeDefined();
            expect(schema.paths.tests).toBeDefined();
            expect(schema.paths.indication).toBeDefined();
            expect(schema.paths.requisitionFormUrl).toBeDefined();
            expect(schema.paths.barcodeData).toBeDefined();
            expect(schema.paths.consentObtained).toBeDefined();
            expect(schema.paths.consentObtainedBy).toBeDefined();

            // Check field types
            expect(schema.paths.orderId.instance).toBe('String');
            expect(schema.paths.patientId.instance).toBe('ObjectID');
            expect(schema.paths.workplaceId.instance).toBe('ObjectID');
            expect(schema.paths.status.instance).toBe('String');
            expect(schema.paths.consentObtained.instance).toBe('Boolean');
        });

        it('should have correct status enum values', () => {
            const statusPath = ManualLabOrder.schema.paths.status as any;
            const enumValues = statusPath.enumValues;

            expect(enumValues).toContain('requested');
            expect(enumValues).toContain('sample_collected');
            expect(enumValues).toContain('result_awaited');
            expect(enumValues).toContain('completed');
            expect(enumValues).toContain('referred');
        });

        it('should have correct priority enum values', () => {
            const priorityPath = ManualLabOrder.schema.paths.priority as any;
            const enumValues = priorityPath.enumValues;

            expect(enumValues).toContain('routine');
            expect(enumValues).toContain('urgent');
            expect(enumValues).toContain('stat');
        });

        it('should have static methods defined', () => {
            expect(typeof ManualLabOrder.generateNextOrderId).toBe('function');
            expect(typeof ManualLabOrder.findActiveOrders).toBe('function');
            expect(typeof ManualLabOrder.findByPatient).toBe('function');
            expect(typeof ManualLabOrder.findByBarcodeData).toBe('function');
            expect(typeof ManualLabOrder.findByStatus).toBe('function');
        });
    });

    describe('ManualLabResult Model', () => {
        it('should have correct schema structure', () => {
            const schema = ManualLabResult.schema;

            // Check required fields
            expect(schema.paths.orderId).toBeDefined();
            expect(schema.paths.enteredBy).toBeDefined();
            expect(schema.paths.enteredAt).toBeDefined();
            expect(schema.paths.values).toBeDefined();
            expect(schema.paths.interpretation).toBeDefined();
            expect(schema.paths.aiProcessed).toBeDefined();

            // Check field types
            expect(schema.paths.orderId.instance).toBe('String');
            expect(schema.paths.enteredBy.instance).toBe('ObjectID');
            expect(schema.paths.enteredAt.instance).toBe('Date');
            expect(schema.paths.aiProcessed.instance).toBe('Boolean');
        });

        it('should have static methods defined', () => {
            expect(typeof ManualLabResult.findByOrderId).toBe('function');
            expect(typeof ManualLabResult.findPendingAIProcessing).toBe('function');
            expect(typeof ManualLabResult.findAbnormalResults).toBe('function');
            expect(typeof ManualLabResult.findCriticalResults).toBe('function');
            expect(typeof ManualLabResult.findPendingReview).toBe('function');
            expect(typeof ManualLabResult.findByEnteredBy).toBe('function');
        });
    });

    describe('TestCatalog Model', () => {
        it('should have correct schema structure', () => {
            const schema = TestCatalog.schema;

            // Check required fields
            expect(schema.paths.workplaceId).toBeDefined();
            expect(schema.paths.code).toBeDefined();
            expect(schema.paths.name).toBeDefined();
            expect(schema.paths.category).toBeDefined();
            expect(schema.paths.specimenType).toBeDefined();
            expect(schema.paths.isActive).toBeDefined();
            expect(schema.paths.isCustom).toBeDefined();

            // Check field types
            expect(schema.paths.workplaceId.instance).toBe('ObjectID');
            expect(schema.paths.code.instance).toBe('String');
            expect(schema.paths.name.instance).toBe('String');
            expect(schema.paths.category.instance).toBe('String');
            expect(schema.paths.specimenType.instance).toBe('String');
            expect(schema.paths.isActive.instance).toBe('Boolean');
            expect(schema.paths.isCustom.instance).toBe('Boolean');
        });

        it('should have static methods defined', () => {
            expect(typeof TestCatalog.findActiveTests).toBe('function');
            expect(typeof TestCatalog.findByCategory).toBe('function');
            expect(typeof TestCatalog.findBySpecimenType).toBe('function');
            expect(typeof TestCatalog.searchTests).toBe('function');
            expect(typeof TestCatalog.findByCode).toBe('function');
            expect(typeof TestCatalog.getCategories).toBe('function');
            expect(typeof TestCatalog.getSpecimenTypes).toBe('function');
        });
    });

    describe('Model Validation', () => {
        it('should create ManualLabOrder instance without database', () => {
            const orderData = {
                orderId: 'LAB-2024-0001',
                patientId: new mongoose.Types.ObjectId(),
                workplaceId: new mongoose.Types.ObjectId(),
                orderedBy: new mongoose.Types.ObjectId(),
                tests: [{
                    name: 'Complete Blood Count',
                    code: 'CBC',
                    specimenType: 'Blood'
                }],
                indication: 'Routine screening',
                requisitionFormUrl: '/api/pdf/test',
                barcodeData: 'test-token',
                consentObtained: true,
                consentObtainedBy: new mongoose.Types.ObjectId(),
                createdBy: new mongoose.Types.ObjectId()
            };

            const order = new ManualLabOrder(orderData);
            expect(order.orderId).toBe('LAB-2024-0001');
            expect(order.status).toBe('requested');
            expect(order.tests).toHaveLength(1);
            expect(order.consentObtained).toBe(true);
        });

        it('should create ManualLabResult instance without database', () => {
            const resultData = {
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

            const result = new ManualLabResult(resultData);
            expect(result.orderId).toBe('LAB-2024-0001');
            expect(result.values).toHaveLength(1);
            expect(result.values[0]?.testCode).toBe('CBC');
            expect(result.aiProcessed).toBe(false);
        });

        it('should create TestCatalog instance without database', () => {
            const testData = {
                workplaceId: new mongoose.Types.ObjectId(),
                code: 'CBC',
                name: 'Complete Blood Count',
                category: 'Hematology',
                specimenType: 'Blood',
                createdBy: new mongoose.Types.ObjectId()
            };

            const test = new TestCatalog(testData);
            expect(test.code).toBe('CBC');
            expect(test.name).toBe('Complete Blood Count');
            expect(test.category).toBe('Hematology');
            expect(test.isActive).toBe(true);
            expect(test.isCustom).toBe(false);
        });
    });

    describe('Instance Methods', () => {
        it('should have ManualLabOrder instance methods', () => {
            const order = new ManualLabOrder({
                orderId: 'LAB-2024-0001',
                patientId: new mongoose.Types.ObjectId(),
                workplaceId: new mongoose.Types.ObjectId(),
                orderedBy: new mongoose.Types.ObjectId(),
                tests: [{ name: 'Test', code: 'TST', specimenType: 'Blood' }],
                indication: 'Test',
                requisitionFormUrl: '/test',
                barcodeData: 'test',
                consentObtained: true,
                consentObtainedBy: new mongoose.Types.ObjectId(),
                createdBy: new mongoose.Types.ObjectId()
            });

            expect(typeof order.updateStatus).toBe('function');
            expect(typeof order.canBeModified).toBe('function');
            expect(typeof order.isActive).toBe('function');

            // Test methods without database
            expect(order.isActive()).toBe(true);
            expect(order.canBeModified()).toBe(true);
        });

        it('should have ManualLabResult instance methods', () => {
            const result = new ManualLabResult({
                orderId: 'LAB-2024-0001',
                enteredBy: new mongoose.Types.ObjectId(),
                values: [{ testCode: 'TST', testName: 'Test' }],
                createdBy: new mongoose.Types.ObjectId()
            });

            expect(typeof result.addValue).toBe('function');
            expect(typeof result.interpretValue).toBe('function');
            expect(typeof result.markAsAIProcessed).toBe('function');
            expect(typeof result.addReview).toBe('function');
            expect(typeof result.hasAbnormalResults).toBe('function');
            expect(typeof result.getCriticalResults).toBe('function');

            // Test methods without database
            expect(result.hasAbnormalResults()).toBe(false);
            expect(result.getCriticalResults()).toEqual([]);
        });

        it('should have TestCatalog instance methods', () => {
            const test = new TestCatalog({
                workplaceId: new mongoose.Types.ObjectId(),
                code: 'TST',
                name: 'Test',
                category: 'Test',
                specimenType: 'Blood',
                createdBy: new mongoose.Types.ObjectId()
            });

            expect(typeof test.activate).toBe('function');
            expect(typeof test.deactivate).toBe('function');
            expect(typeof test.updateCost).toBe('function');
        });
    });
});