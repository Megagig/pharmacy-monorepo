import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import DiagnosticRequest from '../models/DiagnosticRequest';
import DiagnosticResult from '../models/DiagnosticResult';
import LabOrder from '../models/LabOrder';
import LabResult from '../models/LabResult';

describe('Diagnostic Models', () => {
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
        // Clear all collections before each test
        const collections = mongoose.connection.collections;
        for (const key in collections) {
            await collections[key].deleteMany({});
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

        it('should require at least one subjective symptom', async () => {
            const invalidData = {
                ...validRequestData,
                inputSnapshot: {
                    ...validRequestData.inputSnapshot,
                    symptoms: {
                        ...validRequestData.inputSnapshot.symptoms,
                        subjective: []
                    }
                }
            };
            const request = new DiagnosticRequest(invalidData);

            await expect(request.save()).rejects.toThrow();
        });

        it('should validate vital signs ranges', async () => {
            const invalidData = {
                ...validRequestData,
                inputSnapshot: {
                    ...validRequestData.inputSnapshot,
                    vitals: {
                        heartRate: 300 // Invalid heart rate
                    }
                }
            };
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

        it('should handle retry logic', async () => {
            const request = new DiagnosticRequest(validRequestData);
            const savedRequest = await request.save();

            expect(savedRequest.canRetry()).toBe(false); // Not failed yet

            await savedRequest.markAsFailed('Test error');
            expect(savedRequest.status).toBe('failed');
            expect(savedRequest.canRetry()).toBe(true);

            await savedRequest.incrementRetryCount();
            await savedRequest.incrementRetryCount();
            await savedRequest.incrementRetryCount();
            expect(savedRequest.canRetry()).toBe(false); // Max retries reached
        });

        it('should set clinical urgency based on severity', async () => {
            const request = new DiagnosticRequest(validRequestData);
            const savedRequest = await request.save();

            expect(savedRequest.clinicalUrgency).toBe('medium'); // moderate severity -> medium urgency
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
            expect(savedResult.needsReview).toBe(true);
            expect(savedResult.isApproved).toBe(false);
        });

        it('should require at least one diagnosis', async () => {
            const invalidData = { ...validResultData, diagnoses: [] };
            const result = new DiagnosticResult(invalidData);

            await expect(result.save()).rejects.toThrow();
        });

        it('should handle pharmacist review', async () => {
            const result = new DiagnosticResult(validResultData);
            const savedResult = await result.save();
            const reviewerId = new mongoose.Types.ObjectId();

            await savedResult.approve(reviewerId, 'Looks good');
            expect(savedResult.pharmacistReview?.status).toBe('modified');
            expect(savedResult.isApproved).toBe(false); // Modified, not approved

            await savedResult.approve(reviewerId);
            expect(savedResult.pharmacistReview?.status).toBe('approved');
            expect(savedResult.isApproved).toBe(true);
        });

        it('should calculate overall confidence', async () => {
            const result = new DiagnosticResult(validResultData);
            const savedResult = await result.save();

            const confidence = savedResult.calculateOverallConfidence();
            expect(confidence).toBeGreaterThan(0);
            expect(confidence).toBeLessThanOrEqual(1);
        });

        it('should identify highest risk flag', async () => {
            const resultWithFlags = {
                ...validResultData,
                redFlags: [
                    {
                        flag: 'Low risk flag',
                        severity: 'low' as const,
                        action: 'Monitor',
                        clinicalRationale: 'Minor concern'
                    },
                    {
                        flag: 'Critical flag',
                        severity: 'critical' as const,
                        action: 'Immediate attention',
                        clinicalRationale: 'Serious concern'
                    }
                ]
            };

            const result = new DiagnosticResult(resultWithFlags);
            const savedResult = await result.save();

            const highestRisk = savedResult.getHighestRiskFlag();
            expect(highestRisk?.severity).toBe('critical');
            expect(savedResult.requiresImmediateAttention()).toBe(true);
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
            expect(savedOrder.isActive).toBe(true);
            expect(savedOrder.expectedDate).toBeDefined();
        });

        it('should require at least one test', async () => {
            const invalidData = { ...validOrderData, tests: [] };
            const order = new LabOrder(invalidData);

            await expect(order.save()).rejects.toThrow();
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

        it('should determine highest priority', async () => {
            const orderWithMixedPriority = {
                ...validOrderData,
                tests: [
                    { ...validOrderData.tests[0], priority: 'routine' as const },
                    { ...validOrderData.tests[0], code: 'STAT', priority: 'stat' as const }
                ]
            };

            const order = new LabOrder(orderWithMixedPriority);
            const savedOrder = await order.save();

            expect(savedOrder.getHighestPriority()).toBe('stat');
        });

        it('should handle status updates', async () => {
            const order = new LabOrder(validOrderData);
            const savedOrder = await order.save();
            const collectorId = new mongoose.Types.ObjectId();

            await savedOrder.markAsCollected(collectorId, 'Sample collected successfully');
            expect(savedOrder.status).toBe('collected');
            expect(savedOrder.collectedBy).toEqual(collectorId);
            expect(savedOrder.collectionNotes).toBe('Sample collected successfully');

            await savedOrder.markAsCompleted();
            expect(savedOrder.status).toBe('completed');
            expect(savedOrder.completedDate).toBeDefined();
        });

        it('should generate unique order numbers', async () => {
            const orderNumber1 = await LabOrder.generateOrderNumber(validOrderData.workplaceId);
            const orderNumber2 = await LabOrder.generateOrderNumber(validOrderData.workplaceId);

            expect(orderNumber1).not.toBe(orderNumber2);
            expect(orderNumber1).toMatch(/^LAB\d{8}\d{3}$/);
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

        it('should auto-detect numeric values', async () => {
            const resultWithComplexValue = {
                ...validResultData,
                value: '15.7 g/dL (normal)'
            };

            const result = new LabResult(resultWithComplexValue);
            const savedResult = await result.save();

            expect(savedResult.numericValue).toBe(15.7);
        });

        it('should interpret results correctly', async () => {
            // Low result
            const lowResult = new LabResult({
                ...validResultData,
                value: '10.0'
            });
            const savedLowResult = await lowResult.save();
            expect(savedLowResult.interpretation).toBe('low');

            // High result
            const highResult = new LabResult({
                ...validResultData,
                value: '18.0'
            });
            const savedHighResult = await highResult.save();
            expect(savedHighResult.interpretation).toBe('high');
        });

        it('should handle critical values', async () => {
            const criticalResult = new LabResult({
                ...validResultData,
                interpretation: 'critical'
            });
            const savedResult = await criticalResult.save();

            expect(savedResult.criticalValue).toBe(true);
            expect(savedResult.isCritical()).toBe(true);
            expect(savedResult.followUpRequired).toBe(true);
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

        it('should handle verification', async () => {
            const result = new LabResult(validResultData);
            const savedResult = await result.save();
            const verifierId = new mongoose.Types.ObjectId();

            await savedResult.verify(verifierId);
            expect(savedResult.verifiedBy).toEqual(verifierId);
            expect(savedResult.verifiedAt).toBeDefined();
            expect(savedResult.reviewStatus).toBe('approved');
            expect(savedResult.isVerified).toBe(true);
        });

        it('should add clinical notes with timestamps', async () => {
            const result = new LabResult(validResultData);
            const savedResult = await result.save();
            const noteAdderId = new mongoose.Types.ObjectId();

            await savedResult.addClinicalNote('Follow up required', noteAdderId);
            expect(savedResult.clinicalNotes).toContain('Follow up required');
            expect(savedResult.clinicalNotes).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        });

        it('should provide interpretation text', async () => {
            const result = new LabResult(validResultData);
            const savedResult = await result.save();

            const interpretation = savedResult.interpretResult();
            expect(interpretation).toContain('Within normal range');
            expect(interpretation).toContain('12-16 g/dL');
        });
    });

    describe('Model Relationships and Indexes', () => {
        it('should enforce unique constraints', async () => {
            const requestData = {
                patientId: new mongoose.Types.ObjectId(),
                pharmacistId: new mongoose.Types.ObjectId(),
                workplaceId: new mongoose.Types.ObjectId(),
                inputSnapshot: {
                    symptoms: {
                        subjective: ['test'],
                        duration: '1 day',
                        severity: 'mild' as const,
                        onset: 'acute' as const
                    }
                },
                consentObtained: true,
                createdBy: new mongoose.Types.ObjectId()
            };

            const request = new DiagnosticRequest(requestData);
            const savedRequest = await request.save();

            // Try to create result with same requestId
            const resultData1 = {
                requestId: savedRequest._id,
                workplaceId: requestData.workplaceId,
                diagnoses: [{
                    condition: 'Test',
                    probability: 0.5,
                    reasoning: 'Test',
                    severity: 'low' as const,
                    confidence: 'low' as const,
                    evidenceLevel: 'possible' as const
                }],
                differentialDiagnosis: ['Test'],
                clinicalImpression: 'Test',
                riskAssessment: {
                    overallRisk: 'low' as const,
                    riskFactors: ['Test']
                },
                aiMetadata: {
                    modelId: 'test',
                    modelVersion: '1.0',
                    confidenceScore: 0.5,
                    processingTime: 1000,
                    tokenUsage: { promptTokens: 100, completionTokens: 100, totalTokens: 200 },
                    requestId: 'test'
                },
                rawResponse: 'test',
                createdBy: new mongoose.Types.ObjectId()
            };

            const result1 = new DiagnosticResult(resultData1);
            await result1.save();

            // Try to create another result with same requestId - should fail
            const result2 = new DiagnosticResult(resultData1);
            await expect(result2.save()).rejects.toThrow();
        });

        it('should handle workspace isolation', async () => {
            const workplace1 = new mongoose.Types.ObjectId();
            const workplace2 = new mongoose.Types.ObjectId();

            const order1 = new LabOrder({
                patientId: new mongoose.Types.ObjectId(),
                orderedBy: new mongoose.Types.ObjectId(),
                workplaceId: workplace1,
                orderNumber: 'LAB20241201001',
                tests: [{
                    code: 'CBC',
                    name: 'Complete Blood Count',
                    indication: 'Test',
                    priority: 'routine' as const
                }],
                clinicalIndication: 'Test',
                createdBy: new mongoose.Types.ObjectId()
            });

            const order2 = new LabOrder({
                patientId: new mongoose.Types.ObjectId(),
                orderedBy: new mongoose.Types.ObjectId(),
                workplaceId: workplace2,
                orderNumber: 'LAB20241201002',
                tests: [{
                    code: 'CBC',
                    name: 'Complete Blood Count',
                    indication: 'Test',
                    priority: 'routine' as const
                }],
                clinicalIndication: 'Test',
                createdBy: new mongoose.Types.ObjectId()
            });

            await order1.save();
            await order2.save();

            // Both should save successfully as they're in different workplaces
            expect(order1.workplaceId).not.toEqual(order2.workplaceId);
        });
    });
});