import mongoose from 'mongoose';
import ManualLabService from '../services/manualLabService';
import ManualLabOrder from '../models/ManualLabOrder';
import ManualLabResult from '../models/ManualLabResult';
import Patient from '../../../models/Patient';
import User from '../../../models/User';
import Workplace from '../../../models/Workplace';
import Allergy from '../../../models/Allergy';
import Medication from '../../../models/Medication';
import { diagnosticService } from '../../diagnostics/services';
import { mtrNotificationService } from '../../../services/mtrNotificationService';

// Mock dependencies
jest.mock('../../diagnostics/services');
jest.mock('../../../services/mtrNotificationService');
jest.mock('../../../services/auditService');

const mockDiagnosticService = diagnosticService as jest.Mocked<typeof diagnosticService>;
const mockNotificationService = mtrNotificationService as jest.Mocked<typeof mtrNotificationService>;

describe('Manual Lab AI Integration', () => {
    let testWorkplaceId: mongoose.Types.ObjectId;
    let testPatientId: mongoose.Types.ObjectId;
    let testPharmacistId: mongoose.Types.ObjectId;
    let testOrderId: string;

    beforeAll(async () => {
        // Connect to test database
        await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/PharmacyCopilot_test');
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    beforeEach(async () => {
        // Clean up test data
        await ManualLabOrder.deleteMany({});
        await ManualLabResult.deleteMany({});
        await Patient.deleteMany({});
        await User.deleteMany({});
        await Workplace.deleteMany({});
        await Allergy.deleteMany({});
        await Medication.deleteMany({});

        // Create test data
        testWorkplaceId = new mongoose.Types.ObjectId();
        testPatientId = new mongoose.Types.ObjectId();
        testPharmacistId = new mongoose.Types.ObjectId();
        testOrderId = 'LAB-2024-0001';

        // Create test workplace
        await Workplace.create({
            _id: testWorkplaceId,
            name: 'Test Pharmacy',
            email: 'test@pharmacy.com',
            phone: '+2341234567890',
            address: 'Test Address',
            state: 'Lagos',
            lga: 'Ikeja',
            createdBy: testPharmacistId
        });

        // Create test patient
        await Patient.create({
            _id: testPatientId,
            workplaceId: testWorkplaceId,
            mrn: 'PAT001',
            firstName: 'John',
            lastName: 'Doe',
            dob: new Date('1990-01-01'),
            gender: 'male',
            phone: '+2341234567890',
            createdBy: testPharmacistId
        });

        // Create test pharmacist
        await User.create({
            _id: testPharmacistId,
            workplaceId: testWorkplaceId,
            firstName: 'Dr. Jane',
            lastName: 'Smith',
            email: 'jane.smith@pharmacy.com',
            phone: '+2341234567890',
            role: 'pharmacist',
            status: 'active',
            notificationPreferences: {
                email: true,
                sms: true,
                criticalAlerts: true
            }
        });

        // Create test allergies
        await Allergy.create({
            workplaceId: testWorkplaceId,
            patientId: testPatientId,
            substance: 'Penicillin',
            severity: 'moderate',
            reaction: 'Rash',
            notedAt: new Date(),
            createdBy: testPharmacistId
        });

        // Create test medications
        await Medication.create({
            patient: testPatientId,
            pharmacist: testPharmacistId,
            drugName: 'Metformin',
            dosageForm: 'tablet',
            instructions: {
                dosage: '500mg',
                frequency: 'twice daily',
                duration: '30 days'
            },
            therapy: {
                indication: 'Type 2 Diabetes'
            },
            status: 'active'
        });

        // Create test lab order
        await ManualLabOrder.create({
            orderId: testOrderId,
            patientId: testPatientId,
            workplaceId: testWorkplaceId,
            orderedBy: testPharmacistId,
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
            indication: 'Routine health screening',
            requisitionFormUrl: '/api/manual-lab-orders/LAB-2024-0001/pdf',
            barcodeData: 'test-barcode-data',
            status: 'result_awaited',
            consentObtained: true,
            consentTimestamp: new Date(),
            consentObtainedBy: testPharmacistId,
            createdBy: testPharmacistId
        });

        // Reset mocks
        jest.clearAllMocks();
    });

    describe('AI Integration Workflow', () => {
        it('should successfully trigger AI interpretation with lab results', async () => {
            // Mock successful AI response
            const mockDiagnosticRequest = {
                _id: new mongoose.Types.ObjectId(),
                patientId: testPatientId,
                pharmacistId: testPharmacistId,
                workplaceId: testWorkplaceId,
                status: 'pending'
            };

            const mockDiagnosticResult = {
                _id: new mongoose.Types.ObjectId(),
                requestId: mockDiagnosticRequest._id,
                workplaceId: testWorkplaceId,
                diagnoses: [
                    {
                        condition: 'Normal findings',
                        probability: 0.85,
                        reasoning: 'All lab values within normal range',
                        severity: 'low',
                        confidence: 'high',
                        evidenceLevel: 'definite'
                    }
                ],
                redFlags: [],
                aiMetadata: {
                    modelId: 'deepseek/deepseek-chat-v3.1',
                    confidenceScore: 0.85,
                    processingTime: 2500,
                    tokenUsage: {
                        promptTokens: 1200,
                        completionTokens: 800,
                        totalTokens: 2000
                    },
                    requestId: 'test-request-id'
                }
            };

            const mockAnalysisResult = {
                request: mockDiagnosticRequest,
                result: mockDiagnosticResult,
                processingTime: 2500,
                interactionResults: []
            };

            mockDiagnosticService.createDiagnosticRequest.mockResolvedValue(mockDiagnosticRequest as any);
            mockDiagnosticService.processDiagnosticRequest.mockResolvedValue(mockAnalysisResult as any);

            // Create lab result first
            const labResult = await ManualLabResult.create({
                orderId: testOrderId,
                enteredBy: testPharmacistId,
                enteredAt: new Date(),
                values: [
                    {
                        testCode: 'CBC',
                        testName: 'Complete Blood Count',
                        numericValue: 7.5,
                        unit: 'x10³/μL',
                        abnormalFlag: false
                    }
                ],
                interpretation: [
                    {
                        testCode: 'CBC',
                        interpretation: 'normal',
                        note: 'Within normal range'
                    }
                ],
                aiProcessed: false,
                createdBy: testPharmacistId
            });

            // Trigger AI interpretation
            const aiRequest = {
                orderId: testOrderId,
                patientId: testPatientId,
                workplaceId: testWorkplaceId,
                labResults: labResult.values,
                indication: 'Routine health screening',
                requestedBy: testPharmacistId
            };

            const result = await ManualLabService.triggerAIInterpretation(aiRequest);

            // Verify AI integration was called correctly
            expect(mockDiagnosticService.createDiagnosticRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    patientId: testPatientId.toString(),
                    pharmacistId: testPharmacistId.toString(),
                    workplaceId: testWorkplaceId.toString(),
                    inputSnapshot: expect.objectContaining({
                        symptoms: expect.objectContaining({
                            subjective: ['Routine health screening'],
                            severity: 'mild',
                            onset: 'chronic'
                        }),
                        currentMedications: expect.arrayContaining([
                            expect.objectContaining({
                                name: 'Metformin',
                                dosage: '500mg',
                                frequency: 'twice daily'
                            })
                        ]),
                        allergies: ['Penicillin']
                    }),
                    consentObtained: true
                })
            );

            expect(mockDiagnosticService.processDiagnosticRequest).toHaveBeenCalledWith(
                mockDiagnosticRequest._id.toString(),
                expect.objectContaining({
                    skipInteractionCheck: false,
                    skipLabValidation: true,
                    retryOnFailure: true,
                    maxRetries: 2
                })
            );

            // Verify result structure
            expect(result).toEqual(
                expect.objectContaining({
                    diagnosticRequest: mockDiagnosticRequest,
                    diagnosticResult: mockDiagnosticResult,
                    processingTime: 2500,
                    criticalAlertsTriggered: 0
                })
            );

            // Verify lab result was marked as AI processed
            const updatedLabResult = await ManualLabResult.findOne({ orderId: testOrderId });
            expect(updatedLabResult?.aiProcessed).toBe(true);
            expect(updatedLabResult?.diagnosticResultId).toEqual(mockDiagnosticResult._id);

            // Verify order status was updated to completed
            const updatedOrder = await ManualLabOrder.findOne({ orderId: testOrderId });
            expect(updatedOrder?.status).toBe('completed');
        });

        it('should handle critical red flags and send alerts', async () => {
            // Mock AI response with critical red flags
            const mockDiagnosticResult = {
                _id: new mongoose.Types.ObjectId(),
                diagnoses: [
                    {
                        condition: 'Severe anemia',
                        probability: 0.75,
                        reasoning: 'Hemoglobin levels critically low',
                        severity: 'high',
                        confidence: 'high',
                        evidenceLevel: 'probable'
                    }
                ],
                redFlags: [
                    {
                        flag: 'Critically low hemoglobin levels',
                        severity: 'critical',
                        action: 'Immediate medical attention required - consider blood transfusion',
                        clinicalRationale: 'Hemoglobin below 7 g/dL indicates severe anemia'
                    }
                ],
                aiMetadata: {
                    modelId: 'deepseek/deepseek-chat-v3.1',
                    confidenceScore: 0.75,
                    processingTime: 3000,
                    tokenUsage: {
                        promptTokens: 1500,
                        completionTokens: 1000,
                        totalTokens: 2500
                    },
                    requestId: 'test-critical-request-id'
                }
            };

            const mockAnalysisResult = {
                request: { _id: new mongoose.Types.ObjectId() },
                result: mockDiagnosticResult,
                processingTime: 3000,
                interactionResults: []
            };

            mockDiagnosticService.createDiagnosticRequest.mockResolvedValue({} as any);
            mockDiagnosticService.processDiagnosticRequest.mockResolvedValue(mockAnalysisResult as any);
            mockNotificationService.sendCriticalAlert.mockResolvedValue();

            // Create lab result with abnormal values
            await ManualLabResult.create({
                orderId: testOrderId,
                enteredBy: testPharmacistId,
                enteredAt: new Date(),
                values: [
                    {
                        testCode: 'HGB',
                        testName: 'Hemoglobin',
                        numericValue: 6.5,
                        unit: 'g/dL',
                        abnormalFlag: true
                    }
                ],
                interpretation: [
                    {
                        testCode: 'HGB',
                        interpretation: 'critical',
                        note: 'Critically low hemoglobin'
                    }
                ],
                aiProcessed: false,
                createdBy: testPharmacistId
            });

            // Trigger AI interpretation
            const aiRequest = {
                orderId: testOrderId,
                patientId: testPatientId,
                workplaceId: testWorkplaceId,
                labResults: [
                    {
                        testCode: 'HGB',
                        testName: 'Hemoglobin',
                        numericValue: 6.5,
                        unit: 'g/dL',
                        abnormalFlag: true
                    }
                ],
                indication: 'Fatigue and weakness',
                requestedBy: testPharmacistId
            };

            const result = await ManualLabService.triggerAIInterpretation(aiRequest);

            // Verify critical alert was sent
            expect(mockNotificationService.sendCriticalAlert).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'high_severity_dtp',
                    severity: 'critical',
                    patientId: testPatientId,
                    message: 'Critical lab result interpretation: Critically low hemoglobin levels',
                    details: expect.objectContaining({
                        orderId: testOrderId,
                        labResults: expect.arrayContaining([
                            expect.objectContaining({
                                testName: 'Hemoglobin',
                                value: 6.5,
                                unit: 'g/dL',
                                abnormal: true
                            })
                        ]),
                        aiInterpretation: expect.objectContaining({
                            flag: 'Critically low hemoglobin levels',
                            severity: 'critical',
                            action: 'Immediate medical attention required - consider blood transfusion'
                        }),
                        source: 'manual_lab_ai_interpretation'
                    }),
                    requiresImmediate: true
                })
            );

            // Verify result indicates critical alerts were triggered
            expect(result?.criticalAlertsTriggered).toBe(1);
        });

        it('should handle AI service errors gracefully', async () => {
            // Mock AI service failure
            mockDiagnosticService.createDiagnosticRequest.mockRejectedValue(
                new Error('AI service unavailable')
            );

            // Create lab result
            await ManualLabResult.create({
                orderId: testOrderId,
                enteredBy: testPharmacistId,
                enteredAt: new Date(),
                values: [
                    {
                        testCode: 'CBC',
                        testName: 'Complete Blood Count',
                        numericValue: 7.5,
                        unit: 'x10³/μL',
                        abnormalFlag: false
                    }
                ],
                interpretation: [],
                aiProcessed: false,
                createdBy: testPharmacistId
            });

            // Trigger AI interpretation
            const aiRequest = {
                orderId: testOrderId,
                patientId: testPatientId,
                workplaceId: testWorkplaceId,
                labResults: [
                    {
                        testCode: 'CBC',
                        testName: 'Complete Blood Count',
                        numericValue: 7.5,
                        unit: 'x10³/μL',
                        abnormalFlag: false
                    }
                ],
                indication: 'Routine health screening',
                requestedBy: testPharmacistId
            };

            // Should not throw error but return null
            const result = await ManualLabService.triggerAIInterpretation(aiRequest);
            expect(result).toBeNull();

            // Verify lab result was not marked as AI processed
            const labResult = await ManualLabResult.findOne({ orderId: testOrderId });
            expect(labResult?.aiProcessed).toBe(false);
            expect(labResult?.diagnosticResultId).toBeUndefined();
        });

        it('should validate AI response structure', async () => {
            // Mock invalid AI response
            const invalidDiagnosticResult = {
                _id: new mongoose.Types.ObjectId(),
                diagnoses: 'invalid', // Should be array
                aiMetadata: {
                    confidenceScore: 'invalid' // Should be number
                }
            };

            const mockAnalysisResult = {
                request: { _id: new mongoose.Types.ObjectId() },
                result: invalidDiagnosticResult,
                processingTime: 1000,
                interactionResults: []
            };

            mockDiagnosticService.createDiagnosticRequest.mockResolvedValue({} as any);
            mockDiagnosticService.processDiagnosticRequest.mockResolvedValue(mockAnalysisResult as any);

            // Create lab result
            await ManualLabResult.create({
                orderId: testOrderId,
                enteredBy: testPharmacistId,
                enteredAt: new Date(),
                values: [
                    {
                        testCode: 'CBC',
                        testName: 'Complete Blood Count',
                        numericValue: 7.5,
                        unit: 'x10³/μL',
                        abnormalFlag: false
                    }
                ],
                interpretation: [],
                aiProcessed: false,
                createdBy: testPharmacistId
            });

            // Trigger AI interpretation
            const aiRequest = {
                orderId: testOrderId,
                patientId: testPatientId,
                workplaceId: testWorkplaceId,
                labResults: [
                    {
                        testCode: 'CBC',
                        testName: 'Complete Blood Count',
                        numericValue: 7.5,
                        unit: 'x10³/μL',
                        abnormalFlag: false
                    }
                ],
                indication: 'Routine health screening',
                requestedBy: testPharmacistId
            };

            // Should handle validation error gracefully and return null
            const result = await ManualLabService.triggerAIInterpretation(aiRequest);
            expect(result).toBeNull();
        });
    });
});