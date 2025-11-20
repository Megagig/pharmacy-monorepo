import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../app';
import DiagnosticRequest from '../../modules/diagnostics/models/DiagnosticRequest';
import DiagnosticResult from '../../modules/diagnostics/models/DiagnosticResult';
import Patient from '../../models/Patient';
import User from '../../models/User';
import Workplace from '../../models/Workplace';
import diagnosticService from '../../modules/diagnostics/services/diagnosticService';
import pharmacistReviewService from '../../modules/diagnostics/services/pharmacistReviewService';

describe('Diagnostic Workflow Integration Tests', () => {
    let testWorkplace: any;
    let testPatient: any;
    let testPharmacist: any;
    let authToken: string;

    beforeAll(async () => {
        // Create test workplace
        testWorkplace = await Workplace.create({
            name: 'Test Pharmacy',
            address: '123 Test St',
            phone: '555-0123',
            email: 'test@pharmacy.com',
            licenseNumber: 'TEST123',
            subscriptionPlan: 'professional',
            subscriptionStatus: 'active',
        });

        // Create test pharmacist
        testPharmacist = await User.create({
            firstName: 'Test',
            lastName: 'Pharmacist',
            email: 'pharmacist@test.com',
            password: 'password123',
            role: 'pharmacist',
            workplaceId: testWorkplace._id,
            licenseNumber: 'PHARM123',
            isActive: true,
        });

        // Create test patient
        testPatient = await Patient.create({
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: new Date('1980-01-01'),
            gender: 'male',
            phone: '555-0456',
            email: 'john.doe@test.com',
            workplaceId: testWorkplace._id,
            createdBy: testPharmacist._id,
        });

        // Generate auth token (simplified for testing)
        authToken = 'test-auth-token';
    });

    afterAll(async () => {
        // Clean up test data
        await DiagnosticResult.deleteMany({});
        await DiagnosticRequest.deleteMany({});
        await Patient.deleteMany({});
        await User.deleteMany({});
        await Workplace.deleteMany({});
    });

    describe('Complete Diagnostic Workflow', () => {
        let diagnosticRequestId: string;
        let diagnosticResultId: string;

        it('should create a diagnostic request successfully', async () => {
            const requestData = {
                patientId: testPatient._id.toString(),
                pharmacistId: testPharmacist._id.toString(),
                workplaceId: testWorkplace._id.toString(),
                inputSnapshot: {
                    symptoms: {
                        subjective: ['headache', 'nausea', 'fatigue'],
                        objective: ['elevated blood pressure'],
                        duration: '3 days',
                        severity: 'moderate',
                        onset: 'acute',
                    },
                    vitals: {
                        bloodPressure: '150/90',
                        heartRate: 85,
                        temperature: 37.2,
                    },
                    currentMedications: [
                        {
                            name: 'Lisinopril',
                            dosage: '10mg',
                            frequency: 'once daily',
                        },
                    ],
                    allergies: ['penicillin'],
                    medicalHistory: ['hypertension'],
                },
                priority: 'routine',
                consentObtained: true,
            };

            const result = await diagnosticService.createDiagnosticRequest(requestData);

            expect(result).toBeDefined();
            expect(result.status).toBe('pending');
            expect(result.patientId.toString()).toBe(testPatient._id.toString());
            expect(result.pharmacistId.toString()).toBe(testPharmacist._id.toString());
            expect(result.consentObtained).toBe(true);

            diagnosticRequestId = result._id.toString();
        });

        it('should process diagnostic request with AI analysis', async () => {
            // Mock OpenRouter service response
            const mockAIResponse = {
                analysis: {
                    differentialDiagnoses: [
                        {
                            condition: 'Hypertensive Crisis',
                            probability: 75,
                            reasoning: 'Elevated BP with symptoms of headache and nausea',
                            severity: 'high',
                        },
                        {
                            condition: 'Medication Non-adherence',
                            probability: 60,
                            reasoning: 'Patient on antihypertensive but still elevated BP',
                            severity: 'medium',
                        },
                    ],
                    recommendedTests: [
                        {
                            testName: 'Basic Metabolic Panel',
                            priority: 'urgent',
                            reasoning: 'Assess kidney function and electrolytes',
                        },
                    ],
                    therapeuticOptions: [
                        {
                            medication: 'Amlodipine',
                            dosage: '5mg',
                            frequency: 'once daily',
                            duration: 'ongoing',
                            reasoning: 'Add calcium channel blocker for better BP control',
                            safetyNotes: ['Monitor for ankle edema'],
                        },
                    ],
                    redFlags: [
                        {
                            flag: 'Severe hypertension with symptoms',
                            severity: 'high',
                            action: 'Consider immediate medical evaluation',
                        },
                    ],
                    referralRecommendation: {
                        recommended: true,
                        urgency: 'within_24h',
                        specialty: 'Cardiology',
                        reason: 'Uncontrolled hypertension despite medication',
                    },
                    confidenceScore: 85,
                    disclaimer: 'This is for pharmacist consultation only',
                },
                usage: {
                    promptTokens: 500,
                    completionTokens: 300,
                    totalTokens: 800,
                },
                requestId: 'test-request-id',
                processingTime: 5000,
            };

            // Mock the OpenRouter service
            jest.spyOn(require('../../services/openRouterService'), 'generateDiagnosticAnalysis')
                .mockResolvedValue(mockAIResponse);

            const result = await diagnosticService.processDiagnosticRequest(diagnosticRequestId);

            expect(result).toBeDefined();
            expect(result.request.status).toBe('completed');
            expect(result.result.diagnoses).toHaveLength(2);
            expect(result.result.diagnoses[0].condition).toBe('Hypertensive Crisis');
            expect(result.result.suggestedTests).toHaveLength(1);
            expect(result.result.medicationSuggestions).toHaveLength(1);
            expect(result.result.redFlags).toHaveLength(1);
            expect(result.result.referralRecommendation?.recommended).toBe(true);

            diagnosticResultId = result.result._id.toString();
        });

        it('should allow pharmacist to review and approve diagnostic result', async () => {
            const reviewData = {
                status: 'approved' as const,
                reviewNotes: 'Comprehensive analysis, agree with recommendations',
                clinicalJustification: 'Patient presentation consistent with hypertensive urgency',
                reviewedBy: testPharmacist._id.toString(),
                workplaceId: testWorkplace._id.toString(),
            };

            const result = await pharmacistReviewService.submitReviewDecision(
                diagnosticResultId,
                reviewData
            );

            expect(result).toBeDefined();
            expect(result.pharmacistReview?.status).toBe('approved');
            expect(result.pharmacistReview?.reviewedBy.toString()).toBe(testPharmacist._id.toString());
            expect(result.followUpRequired).toBe(true);
            expect(result.followUpDate).toBeDefined();
        });

        it('should create clinical intervention from approved diagnostic result', async () => {
            const interventionData = {
                type: 'medication_review' as const,
                title: 'Hypertension Management Review',
                description: 'Review current antihypertensive therapy and add additional agent',
                priority: 'high' as const,
                category: 'Cardiovascular',
                recommendations: [
                    'Add Amlodipine 5mg once daily',
                    'Monitor blood pressure daily for 1 week',
                    'Schedule cardiology referral within 24 hours',
                    'Patient education on hypertension management',
                ],
                followUpRequired: true,
                followUpDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week
                targetOutcome: 'Blood pressure <140/90 mmHg',
                monitoringParameters: ['Blood pressure', 'Ankle edema', 'Medication adherence'],
            };

            const result = await pharmacistReviewService.createInterventionFromResult(
                diagnosticResultId,
                interventionData,
                testPharmacist._id.toString(),
                testWorkplace._id.toString()
            );

            expect(result).toBeDefined();
            expect(result.type).toBe('medication_review');
            expect(result.title).toBe('Hypertension Management Review');
            expect(result.priority).toBe('high');
            expect(result.recommendations).toHaveLength(4);
            expect(result.followUpRequired).toBe(true);
            expect(result.status).toBe('active');
        });
    });

    describe('Pharmacist Review Workflow', () => {
        let testResultId: string;

        beforeEach(async () => {
            // Create a test diagnostic result for review
            const testRequest = await DiagnosticRequest.create({
                patientId: testPatient._id,
                pharmacistId: testPharmacist._id,
                workplaceId: testWorkplace._id,
                inputSnapshot: {
                    symptoms: {
                        subjective: ['cough', 'fever'],
                        objective: [],
                        duration: '2 days',
                        severity: 'mild',
                        onset: 'acute',
                    },
                },
                consentObtained: true,
                status: 'completed',
                createdBy: testPharmacist._id,
            });

            const testResult = await DiagnosticResult.create({
                requestId: testRequest._id,
                workplaceId: testWorkplace._id,
                diagnoses: [
                    {
                        condition: 'Upper Respiratory Infection',
                        probability: 0.8,
                        reasoning: 'Typical viral symptoms',
                        severity: 'low',
                        confidence: 'high',
                        evidenceLevel: 'probable',
                    },
                ],
                suggestedTests: [],
                medicationSuggestions: [],
                redFlags: [],
                differentialDiagnosis: ['Upper Respiratory Infection'],
                clinicalImpression: 'Likely viral upper respiratory infection',
                riskAssessment: {
                    overallRisk: 'low',
                    riskFactors: ['Viral infection'],
                },
                aiMetadata: {
                    modelId: 'test-model',
                    modelVersion: 'v1.0',
                    confidenceScore: 0.85,
                    processingTime: 3000,
                    tokenUsage: {
                        promptTokens: 200,
                        completionTokens: 150,
                        totalTokens: 350,
                    },
                    requestId: 'test-request',
                },
                rawResponse: '{}',
                disclaimer: 'Test disclaimer',
                followUpRequired: false,
                createdBy: testPharmacist._id,
            });

            testResultId = testResult._id.toString();
        });

        it('should allow pharmacist to modify diagnostic result', async () => {
            const reviewData = {
                status: 'modified' as const,
                modifications: 'Recommend symptomatic treatment with rest and fluids. Consider OTC decongestant if needed.',
                reviewNotes: 'Added specific treatment recommendations',
                reviewedBy: testPharmacist._id.toString(),
                workplaceId: testWorkplace._id.toString(),
            };

            const result = await pharmacistReviewService.submitReviewDecision(
                testResultId,
                reviewData
            );

            expect(result.pharmacistReview?.status).toBe('modified');
            expect(result.pharmacistReview?.modifications).toContain('symptomatic treatment');
        });

        it('should allow pharmacist to reject diagnostic result', async () => {
            const reviewData = {
                status: 'rejected' as const,
                rejectionReason: 'Insufficient clinical data to make reliable diagnosis. Need additional history and physical examination.',
                reviewNotes: 'Requires more comprehensive assessment',
                reviewedBy: testPharmacist._id.toString(),
                workplaceId: testWorkplace._id.toString(),
            };

            const result = await pharmacistReviewService.submitReviewDecision(
                testResultId,
                reviewData
            );

            expect(result.pharmacistReview?.status).toBe('rejected');
            expect(result.pharmacistReview?.rejectionReason).toContain('Insufficient clinical data');
        });

        it('should get pending reviews for workplace', async () => {
            const result = await pharmacistReviewService.getPendingReviews(
                testWorkplace._id.toString(),
                1,
                10
            );

            expect(result).toBeDefined();
            expect(result.results).toBeInstanceOf(Array);
            expect(result.total).toBeGreaterThanOrEqual(0);
            expect(result.page).toBe(1);
        });

        it('should get review workflow status', async () => {
            const status = await pharmacistReviewService.getReviewWorkflowStatus(
                testWorkplace._id.toString()
            );

            expect(status).toBeDefined();
            expect(typeof status.totalPending).toBe('number');
            expect(typeof status.totalReviewed).toBe('number');
            expect(typeof status.averageReviewTime).toBe('number');
        });
    });

    describe('Error Handling and Validation', () => {
        it('should reject diagnostic request without consent', async () => {
            const requestData = {
                patientId: testPatient._id.toString(),
                pharmacistId: testPharmacist._id.toString(),
                workplaceId: testWorkplace._id.toString(),
                inputSnapshot: {
                    symptoms: {
                        subjective: ['headache'],
                        objective: [],
                        duration: '1 day',
                        severity: 'mild',
                        onset: 'acute',
                    },
                },
                consentObtained: false, // No consent
            };

            await expect(
                diagnosticService.createDiagnosticRequest(requestData)
            ).rejects.toThrow('Patient consent is required');
        });

        it('should reject diagnostic request with invalid patient', async () => {
            const requestData = {
                patientId: new mongoose.Types.ObjectId().toString(),
                pharmacistId: testPharmacist._id.toString(),
                workplaceId: testWorkplace._id.toString(),
                inputSnapshot: {
                    symptoms: {
                        subjective: ['headache'],
                        objective: [],
                        duration: '1 day',
                        severity: 'mild',
                        onset: 'acute',
                    },
                },
                consentObtained: true,
            };

            await expect(
                diagnosticService.createDiagnosticRequest(requestData)
            ).rejects.toThrow('Patient not found');
        });

        it('should reject review without required fields', async () => {
            const reviewData = {
                status: 'modified' as const,
                // Missing modifications field
                reviewedBy: testPharmacist._id.toString(),
                workplaceId: testWorkplace._id.toString(),
            };

            await expect(
                pharmacistReviewService.submitReviewDecision('invalid-id', reviewData)
            ).rejects.toThrow();
        });

        it('should handle AI service failures gracefully', async () => {
            // Mock AI service failure
            jest.spyOn(require('../../services/openRouterService'), 'generateDiagnosticAnalysis')
                .mockRejectedValue(new Error('AI service unavailable'));

            const requestData = {
                patientId: testPatient._id.toString(),
                pharmacistId: testPharmacist._id.toString(),
                workplaceId: testWorkplace._id.toString(),
                inputSnapshot: {
                    symptoms: {
                        subjective: ['headache'],
                        objective: [],
                        duration: '1 day',
                        severity: 'mild',
                        onset: 'acute',
                    },
                },
                consentObtained: true,
            };

            const request = await diagnosticService.createDiagnosticRequest(requestData);

            await expect(
                diagnosticService.processDiagnosticRequest(request._id.toString())
            ).rejects.toThrow('AI service unavailable');

            // Verify request is marked as failed
            const failedRequest = await DiagnosticRequest.findById(request._id);
            expect(failedRequest?.status).toBe('failed');
        });
    });

    describe('Data Integrity and Audit', () => {
        it('should maintain audit trail for diagnostic workflow', async () => {
            // This would test audit logging functionality
            // Implementation depends on audit service setup
            expect(true).toBe(true); // Placeholder
        });

        it('should enforce workspace isolation', async () => {
            // Create another workplace
            const otherWorkplace = await Workplace.create({
                name: 'Other Pharmacy',
                address: '456 Other St',
                phone: '555-0789',
                email: 'other@pharmacy.com',
                licenseNumber: 'OTHER123',
                subscriptionPlan: 'basic',
                subscriptionStatus: 'active',
            });

            const requestData = {
                patientId: testPatient._id.toString(),
                pharmacistId: testPharmacist._id.toString(),
                workplaceId: otherWorkplace._id.toString(), // Different workplace
                inputSnapshot: {
                    symptoms: {
                        subjective: ['headache'],
                        objective: [],
                        duration: '1 day',
                        severity: 'mild',
                        onset: 'acute',
                    },
                },
                consentObtained: true,
            };

            await expect(
                diagnosticService.createDiagnosticRequest(requestData)
            ).rejects.toThrow('Patient not found'); // Should fail due to workspace mismatch

            await Workplace.findByIdAndDelete(otherWorkplace._id);
        });
    });
});