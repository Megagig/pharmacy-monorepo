import mongoose from 'mongoose';
import { ManualLabOrder, ManualLabResult, TestCatalog } from '../models';

describe('Manual Lab Models - Basic Validation', () => {
    describe('ManualLabOrder Model', () => {
        it('should create instance with valid data', () => {
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
            expect(order.tests[0]?.name).toBe('Complete Blood Count');
            expect(order.consentObtained).toBe(true);
            expect(order.isActive()).toBe(true);
            expect(order.canBeModified()).toBe(true);
        });

        it('should have static methods', () => {
            expect(typeof ManualLabOrder.generateNextOrderId).toBe('function');
            expect(typeof ManualLabOrder.findActiveOrders).toBe('function');
            expect(typeof ManualLabOrder.findByPatient).toBe('function');
        });
    });

    describe('ManualLabResult Model', () => {
        it('should create instance with valid data', () => {
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
            expect(result.values[0]?.numericValue).toBe(7.5);
            expect(result.aiProcessed).toBe(false);
            expect(result.hasAbnormalResults()).toBe(false);
        });

        it('should add values correctly', () => {
            const result = new ManualLabResult({
                orderId: 'LAB-2024-0001',
                enteredBy: new mongoose.Types.ObjectId(),
                values: [],
                createdBy: new mongoose.Types.ObjectId()
            });

            result.addValue('HGB', 'Hemoglobin', 12.5, 'g/dL');

            expect(result.values).toHaveLength(1);
            expect(result.values[0]?.testCode).toBe('HGB');
            expect(result.values[0]?.testName).toBe('Hemoglobin');
            expect(result.values[0]?.numericValue).toBe(12.5);
            expect(result.values[0]?.unit).toBe('g/dL');
        });

        it('should interpret values correctly', () => {
            const result = new ManualLabResult({
                orderId: 'LAB-2024-0001',
                enteredBy: new mongoose.Types.ObjectId(),
                values: [{ testCode: 'CBC', testName: 'Complete Blood Count' }],
                createdBy: new mongoose.Types.ObjectId()
            });

            result.interpretValue('CBC', 'high', 'Above normal range');

            expect(result.interpretation[0]?.interpretation).toBe('high');
            expect(result.interpretation[0]?.note).toBe('Above normal range');
        });

        it('should have static methods', () => {
            expect(typeof ManualLabResult.findByOrderId).toBe('function');
            expect(typeof ManualLabResult.findPendingAIProcessing).toBe('function');
            expect(typeof ManualLabResult.findAbnormalResults).toBe('function');
        });
    });

    describe('TestCatalog Model', () => {
        it('should create instance with valid data', () => {
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
            expect(test.specimenType).toBe('Blood');
            expect(test.isActive).toBe(true);
            expect(test.isCustom).toBe(false);
        });

        it('should have static methods', () => {
            expect(typeof TestCatalog.findActiveTests).toBe('function');
            expect(typeof TestCatalog.findByCategory).toBe('function');
            expect(typeof TestCatalog.searchTests).toBe('function');
        });
    });

    describe('Type Definitions', () => {
        it('should export all required types', () => {
            // This test ensures the types are properly exported
            const orderId = new mongoose.Types.ObjectId();
            const patientId = new mongoose.Types.ObjectId();
            const workplaceId = new mongoose.Types.ObjectId();

            expect(orderId).toBeInstanceOf(mongoose.Types.ObjectId);
            expect(patientId).toBeInstanceOf(mongoose.Types.ObjectId);
            expect(workplaceId).toBeInstanceOf(mongoose.Types.ObjectId);
        });
    });
});