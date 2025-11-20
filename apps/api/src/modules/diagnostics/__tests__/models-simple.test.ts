import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import DiagnosticRequest from '../models/DiagnosticRequest';
import DiagnosticResult from '../models/DiagnosticResult';
import LabOrder from '../models/LabOrder';
import LabResult from '../models/LabResult';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { describe } from 'node:test';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { describe } from 'node:test';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { describe } from 'node:test';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { describe } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

describe('Diagnostic Models - Simple Tests', () => {
    let mongoServer: MongoMemoryServer;

    beforeAll(async () => {
        // Close existing connection if any
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }

        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);
    });

    afterAll(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    beforeEach(async () => {
        // Clear all collections before each test
        const collections = mongoose.connection.collections;
        for (const key in collections) {
            const collection = collections[key];
            if (collection) {
                await collection.deleteMany({});
            }
        }
    });

    describe('DiagnosticRequest Model', () => {
        const validRequestData = {
            patientId: new mongoose.Types.ObjectId(),
            pharmacistId: new mongoose.Types.ObjectId(),
            workplaceId: new mongoose.Types.ObjectId(),
            inputSnapshot: {
                symptoms: {
                    subjective: ['headache', 'nausea'],
                    objective: ['fever'],
                    duration: '2 days',
                    severity: 'moderate' as const,
                    onset: 'acute' as const
                }
            },
            consentObtained: true,
            promptVersion: 'v1.0',
            createdBy: new mongoose.Types.ObjectId()
        };

        it('should create a valid diagnostic request', async () => {
            const request = new DiagnosticRequest(validRequestData);
            const savedRequest = await request.save();

            expect(savedRequest._id).toBeDefined();
            expect(savedRequest.status).toBe('pending');
            expect(savedRequest.consentTimestamp).toBeDefined();
            expect(savedRequest.retryCount).toBe(0);
        });

        it('should require patient consent', async () => {
            const invalidData = { ...validRequestData, consentObtained: false };
            const request = new DiagnosticRequest(invalidData);

            await expect(request.save()).rejects.toThrow();
        });

        it('should update status correctly', async () => {
            const request = new DiagnosticRequest(validRequestData);
            const savedRequest = await request.save();

            await savedRequest.markAsProcessing();
            expect(savedRequest.status).toBe('processing');
            expect(savedRequest.processingStartedAt).toBeDefined();

            await savedRequest.markAsCompleted();
            expect(savedRequest.status).toBe('completed');
            expect(savedRequest.processingCompletedAt).toBeDefined();
        });
    });

    describe('DiagnosticResult Model', () => {
        const validResultData = {
            requestId: new mongoose.Types.ObjectId(),
            workplaceId: new mongoose.Types.ObjectId(),
            diagnoses: [{
                condition: 'Migraine',
                probability: 0.8,
                reasoning: 'Based on symptoms and history',
                severity: 'medium' as const,
                confidence: 'high' as const,
                evidenceLevel: 'probable' as const
            }],
            differentialDiagnosis: ['Migraine', 'Tension headache'],
            clinicalImpression: 'Likely migraine based on presentation',
            riskAssessment: {
                overallRisk: 'medium' as const,
                riskFactors: ['Family history', 'Stress']
            },
            aiMetadata: {
                modelId: 'deepseek-v3.1',
                modelVersion: '1.0',
                confidenceScore: 0.85,
                processingTime: 5000,
                tokenUsage: {
                    promptTokens: 500,
                    completionTokens: 300,
                    totalTokens: 800
                },
                requestId: 'test-request-123'
            },
            rawResponse: 'AI response text',
            createdBy: new mongoose.Types.ObjectId()
        };

        it('should create a valid diagnostic result', async () => {
            const result = new DiagnosticResult(validResultData);
            const savedResult = await result.save();

            expect(savedResult._id).toBeDefined();
            expect(savedResult.diagnoses.length).toBe(1);
            expect(savedResult.diagnoses[0]?.condition).toBe('Migraine');
        });

        it('should calculate overall confidence', async () => {
            const result = new DiagnosticResult(validResultData);
            const savedResult = await result.save();

            const confidence = savedResult.calculateOverallConfidence();
            expect(confidence).toBeGreaterThan(0);
            expect(confidence).toBeLessThanOrEqual(1);
        });
    });

    describe('LabOrder Model', () => {
        const validOrderData = {
            patientId: new mongoose.Types.ObjectId(),
            orderedBy: new mongoose.Types.ObjectId(),
            workplaceId: new mongoose.Types.ObjectId(),
            orderNumber: 'LAB20241201001',
            tests: [{
                code: 'CBC',
                name: 'Complete Blood Count',
                indication: 'Routine screening',
                priority: 'routine' as const
            }],
            clinicalIndication: 'Annual health check',
            createdBy: new mongoose.Types.ObjectId()
        };

        it('should create a valid lab order', async () => {
            const order = new LabOrder(validOrderData);
            const savedOrder = await order.save();

            expect(savedOrder._id).toBeDefined();
            expect(savedOrder.status).toBe('ordered');
            expect(savedOrder.expectedDate).toBeDefined();
        });

        it('should calculate total cost', async () => {
            const orderWithCosts = {
                ...validOrderData,
                tests: [
                    { ...validOrderData.tests[0], estimatedCost: 50 },
                    { ...validOrderData.tests[0], code: 'LFT', name: 'Liver Function Test', estimatedCost: 75 }
                ]
            };

            const order = new LabOrder(orderWithCosts);
            const savedOrder = await order.save();

            expect(savedOrder.calculateTotalCost()).toBe(125);
            expect(savedOrder.totalEstimatedCost).toBe(125);
        });
    });

    describe('LabResult Model', () => {
        const validResultData = {
            patientId: new mongoose.Types.ObjectId(),
            workplaceId: new mongoose.Types.ObjectId(),
            testCode: 'HGB',
            testName: 'Hemoglobin',
            value: '12.5',
            referenceRange: {
                low: 12.0,
                high: 16.0,
                unit: 'g/dL'
            },
            performedAt: new Date(),
            recordedBy: new mongoose.Types.ObjectId(),
            createdBy: new mongoose.Types.ObjectId()
        };

        it('should create a valid lab result', async () => {
            const result = new LabResult(validResultData);
            const savedResult = await result.save();

            expect(savedResult._id).toBeDefined();
            expect(savedResult.numericValue).toBe(12.5);
            expect(savedResult.interpretation).toBe('normal');
            expect(savedResult.reviewStatus).toBe('pending');
        });

        it('should calculate percent change', async () => {
            const result = new LabResult({
                ...validResultData,
                value: '15.0'
            });
            const savedResult = await result.save();

            const percentChange = savedResult.calculatePercentChange(12.0);
            expect(percentChange).toBeCloseTo(25, 1); // 25% increase
        });
    });
});