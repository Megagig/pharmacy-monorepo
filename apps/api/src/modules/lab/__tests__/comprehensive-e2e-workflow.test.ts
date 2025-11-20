import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import express from 'express';
import jwt from 'jsonwebtoken';

// Import app components
import manualLabRoutes from '../routes/manualLabRoutes';

// Import models
import ManualLabOrder from '../models/ManualLabOrder';
import ManualLabResult from '../models/ManualLabResult';
import Patient from '../../../models/Patient';
import User from '../../../models/User';
import Workplace from '../../../models/Workplace';

// Import services
import ManualLabService from '../services/manualLabService';
import TokenService from '../services/tokenService';
import { PDFGenerationService } from '../services/pdfGenerationService';
import { AuditService } from '../../../services/auditService';

// Mock external services
jest.mock('../services/pdfGenerationService');
jest.mock('../../../services/auditService');
jest.mock('../../../services/openRouterService');
jest.mock('../../../services/diagnosticService');

describe('Manual Lab E2E Workflow Tests', () => {
    let app: express.Application;
    let mongoServer: MongoMemoryServer;
    let testWorkplace: any;
    let testPatient: any;
    let testUser: any;
    let authToken: string;

    beforeAll(async () => {
        // Start in-memory MongoDB
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);

        // Create Express app for testing
        app = express();
        app.use(express.json());
        app.use('/api/manual-lab-orders', manualLabRoutes);

        // Set up environment variables
        process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-minimum-32-characters-long';
        process.env.LAB_TOKEN_SECRET = 'test-lab-token-secret-key-minimum-32-characters-long';
        process.env.FRONTEND_URL = 'https://test.PharmacyCopilot.com';
    });

    afterAll(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
    }); befor
    eEach(async () => {
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
            workplaceRole: 'Pharmacist',
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

        // Generate auth token
        authToken = jwt.sign(
            {
                userId: testUser._id,
                email: testUser.email,
                role: testUser.role,
                workplaceId: testWorkplace._id,
                workplaceRole: testUser.workplaceRole
            },
            process.env.JWT_SECRET!,
            { expiresIn: '1h' }
        );

        // Mock services
        (AuditService.logActivity as jest.Mock).mockResolvedValue(undefined);

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

        mockPDFService.prototype.validateGenerationRequirements = jest.fn();

        jest.clearAllMocks();
    }); describe('Complete Manual Lab Workflow - Order to Interpretation', () => {
        it('should complete the full workflow from order creation to AI interpretation', async () => {
            // Step 1: Create manual lab order
            const orderData = {
                patientId: testPatient._id.toString(),
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
                indication: 'Routine health screening and diabetes monitoring',
                priority: 'routine',
                consentObtained: true,
                consentObtainedBy: testUser._id.toString()
            };

            const createResponse = await request(app)
                .post('/api/manual-lab-orders')
                .set('Authorization', `Bearer ${authToken}`)
                .send(orderData)
                .expect(201);

            expect(createResponse.body.success).toBe(true);
            const orderId = createResponse.body.data.order.orderId;
            expect(orderId).toMatch(/^LAB-\d{4}-\d{4}$/);

            // Verify order was created in database
            const createdOrder = await ManualLabOrder.findOne({ orderId });
            expect(createdOrder).toBeDefined();
            expect(createdOrder!.status).toBe('requested');
            expect(createdOrder!.tests).toHaveLength(2);

            // Step 2: Retrieve order details
            const getResponse = await request(app)
                .get(`/api/manual-lab-orders/${orderId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(getResponse.body.success).toBe(true);
            expect(getResponse.body.data.order.orderId).toBe(orderId);
            expect(getResponse.body.data.order.isActive).toBe(true);
            expect(getResponse.body.data.order.canBeModified).toBe(true);

            // Step 3: Generate and access PDF requisition
            const pdfResponse = await request(app)
                .get(`/api/manual-lab-orders/${orderId}/pdf`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(pdfResponse.headers['content-type']).toBe('application/pdf');
            expect(Buffer.isBuffer(pdfResponse.body)).toBe(true);

            // Step 4: Update order status to sample_collected
            const statusUpdateResponse = await request(app)
                .put(`/api/manual-lab-orders/${orderId}/status`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    status: 'sample_collected',
                    notes: 'Sample collected at 10:00 AM'
                })
                .expect(200);

            expect(statusUpdateResponse.body.success).toBe(true);
            expect(statusUpdateResponse.body.data.order.status).toBe('sample_collected');

            // Verify status update in database
            const updatedOrder = await ManualLabOrder.findOne({ orderId });
            expect(updatedOrder!.status).toBe('sample_collected');
            expect(updatedOrder!.notes).toBe('Sample collected at 10:00 AM');

            // Step 5: Add lab results
            const resultData = {
                values: [
                    {
                        testCode: 'CBC',
                        testName: 'Complete Blood Count',
                        numericValue: 8.5,
                        unit: 'cells/μL',
                        comment: 'Normal white cell count'
                    },
                    {
                        testCode: 'GLU',
                        testName: 'Glucose',
                        numericValue: 150, // High value
                        unit: 'mg/dL',
                        comment: 'Elevated glucose level'
                    }
                ],
                reviewNotes: 'Results show elevated glucose requiring follow-up'
            };

            const addResultsResponse = await request(app)
                .post(`/api/manual-lab-orders/${orderId}/results`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(resultData)
                .expect(201);

            expect(addResultsResponse.body.success).toBe(true);
            expect(addResultsResponse.body.data.result.values).toHaveLength(2);
            expect(addResultsResponse.body.data.result.hasAbnormalResults).toBe(true);

            // Verify results were saved in database
            const savedResult = await ManualLabResult.findOne({ orderId });
            expect(savedResult).toBeDefined();
            expect(savedResult!.values).toHaveLength(2);
            expect(savedResult!.hasAbnormalResults()).toBe(true);

            // Verify order status was updated to result_awaited
            const orderAfterResults = await ManualLabOrder.findOne({ orderId });
            expect(orderAfterResults!.status).toBe('result_awaited');

            // Step 6: Retrieve results
            const getResultsResponse = await request(app)
                .get(`/api/manual-lab-orders/${orderId}/results`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(getResultsResponse.body.success).toBe(true);
            expect(getResultsResponse.body.data.result.values).toHaveLength(2);
            expect(getResultsResponse.body.data.result.hasAbnormalResults).toBe(true);

            // Verify interpretations were generated
            const glucoseInterpretation = getResultsResponse.body.data.result.interpretation
                .find((i: any) => i.testCode === 'GLU');
            expect(glucoseInterpretation).toBeDefined();
            expect(glucoseInterpretation.interpretation).toBe('high');

            // Step 7: Verify patient order history
            const patientOrdersResponse = await request(app)
                .get(`/api/manual-lab-orders/patient/${testPatient._id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(patientOrdersResponse.body.success).toBe(true);
            expect(patientOrdersResponse.body.data.orders).toHaveLength(1);
            expect(patientOrdersResponse.body.data.orders[0].orderId).toBe(orderId);

            // Step 8: Complete the workflow by updating status to completed
            const completeResponse = await request(app)
                .put(`/api/manual-lab-orders/${orderId}/status`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    status: 'completed',
                    notes: 'Results reviewed and patient notified'
                })
                .expect(200);

            expect(completeResponse.body.success).toBe(true);
            expect(completeResponse.body.data.order.status).toBe('completed');
            expect(completeResponse.body.data.order.isActive).toBe(false);

            // Final verification
            const finalOrder = await ManualLabOrder.findOne({ orderId });
            expect(finalOrder!.status).toBe('completed');
            expect(finalOrder!.notes).toBe('Results reviewed and patient notified');

            // Verify audit logs were created
            expect(AuditService.logActivity).toHaveBeenCalledTimes(6); // Create, Get, PDF, Status updates, Results
        });
    }); d
    escribe('Mobile Scanning and Result Entry Workflow', () => {
        it('should complete mobile scanning workflow from QR code to result entry', async () => {
            // Step 1: Create order (simulating desktop/web creation)
            const orderData = {
                patientId: testPatient._id,
                workplaceId: testWorkplace._id,
                orderedBy: testUser._id,
                tests: [
                    {
                        name: 'Hemoglobin A1C',
                        code: 'HBA1C',
                        specimenType: 'Blood',
                        unit: '%',
                        refRange: '4.0-5.6',
                        category: 'Chemistry'
                    }
                ],
                indication: 'Diabetes monitoring',
                consentObtained: true,
                consentObtainedBy: testUser._id
            };

            const createdOrder = await ManualLabService.createOrder(orderData, {
                userId: testUser._id,
                workplaceId: testWorkplace._id,
                userRole: 'pharmacist'
            });

            const orderId = createdOrder.orderId;
            const scanToken = createdOrder.barcodeData;

            // Step 2: Simulate mobile scanning of QR code/barcode
            const scanResponse = await request(app)
                .get('/api/manual-lab-orders/scan')
                .query({ token: scanToken })
                .set('Authorization', `Bearer ${authToken}`)
                .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)')
                .expect(200);

            expect(scanResponse.body.success).toBe(true);
            expect(scanResponse.body.data.order.orderId).toBe(orderId);
            expect(scanResponse.body.data.order.tests).toHaveLength(1);
            expect(scanResponse.body.data.order.tests[0].code).toBe('HBA1C');

            // Step 3: Update status to sample_collected (mobile workflow)
            const mobileStatusUpdate = await request(app)
                .put(`/api/manual-lab-orders/${orderId}/status`)
                .set('Authorization', `Bearer ${authToken}`)
                .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)')
                .send({
                    status: 'sample_collected',
                    notes: 'Sample collected via mobile workflow'
                })
                .expect(200);

            expect(mobileStatusUpdate.body.success).toBe(true);
            expect(mobileStatusUpdate.body.data.order.status).toBe('sample_collected');

            // Step 4: Enter results via mobile interface
            const mobileResultData = {
                values: [
                    {
                        testCode: 'HBA1C',
                        testName: 'Hemoglobin A1C',
                        numericValue: 7.2, // Elevated
                        unit: '%',
                        comment: 'Entered via mobile device'
                    }
                ],
                reviewNotes: 'Results entered on mobile device at lab'
            };

            const mobileResultsResponse = await request(app)
                .post(`/api/manual-lab-orders/${orderId}/results`)
                .set('Authorization', `Bearer ${authToken}`)
                .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)')
                .send(mobileResultData)
                .expect(201);

            expect(mobileResultsResponse.body.success).toBe(true);
            expect(mobileResultsResponse.body.data.result.values[0].comment).toBe('Entered via mobile device');
            expect(mobileResultsResponse.body.data.result.hasAbnormalResults).toBe(true);

            // Step 5: Verify results can be retrieved on mobile
            const mobileGetResults = await request(app)
                .get(`/api/manual-lab-orders/${orderId}/results`)
                .set('Authorization', `Bearer ${authToken}`)
                .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)')
                .expect(200);

            expect(mobileGetResults.body.success).toBe(true);
            expect(mobileGetResults.body.data.result.reviewNotes).toBe('Results entered on mobile device at lab');

            // Verify interpretation was generated for elevated HbA1c
            const hba1cInterpretation = mobileGetResults.body.data.result.interpretation
                .find((i: any) => i.testCode === 'HBA1C');
            expect(hba1cInterpretation).toBeDefined();
            expect(hba1cInterpretation.interpretation).toBe('high');

            // Step 6: Access PDF on mobile (for printing/sharing)
            const mobilePdfResponse = await request(app)
                .get(`/api/manual-lab-orders/${orderId}/pdf`)
                .set('Authorization', `Bearer ${authToken}`)
                .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)')
                .expect(200);

            expect(mobilePdfResponse.headers['content-type']).toBe('application/pdf');
            expect(Buffer.isBuffer(mobilePdfResponse.body)).toBe(true);

            // Final verification - order should be in result_awaited status
            const finalOrder = await ManualLabOrder.findOne({ orderId });
            expect(finalOrder!.status).toBe('result_awaited');
        });

        it('should handle invalid token scanning gracefully', async () => {
            const invalidTokens = [
                'invalid-token',
                '',
                'expired-token-123',
                'malformed.jwt.token'
            ];

            for (const invalidToken of invalidTokens) {
                const response = await request(app)
                    .get('/api/manual-lab-orders/scan')
                    .query({ token: invalidToken })
                    .set('Authorization', `Bearer ${authToken}`)
                    .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)');

                expect(response.status).toBeGreaterThanOrEqual(400);
                expect(response.body.success).toBe(false);
            }
        });
    }); de
    scribe('AI Integration with Mocked OpenRouter Responses', () => {
        it('should process AI interpretation with normal results', async () => {
            // Mock AI service response for normal results
            const mockDiagnosticService = require('../../../services/diagnosticService');
            mockDiagnosticService.processRequest = jest.fn().mockResolvedValue({
                _id: new mongoose.Types.ObjectId(),
                patientId: testPatient._id,
                workplaceId: testWorkplace._id,
                differentialDiagnoses: [
                    {
                        condition: 'Normal laboratory findings',
                        probability: 95,
                        reasoning: 'All laboratory values within normal reference ranges',
                        severity: 'low',
                        icd10Code: 'Z00.00'
                    }
                ],
                recommendedTests: [],
                therapeuticOptions: [],
                redFlags: [],
                confidenceScore: 95,
                aiModel: 'deepseek-v3.1',
                processingTime: 1200,
                createdAt: new Date()
            });

            // Create order and add normal results
            const orderData = {
                patientId: testPatient._id,
                workplaceId: testWorkplace._id,
                orderedBy: testUser._id,
                tests: [
                    {
                        name: 'Basic Metabolic Panel',
                        code: 'BMP',
                        specimenType: 'Blood',
                        unit: 'Various',
                        refRange: 'Various',
                        category: 'Chemistry'
                    }
                ],
                indication: 'Routine health screening',
                consentObtained: true,
                consentObtainedBy: testUser._id
            };

            const createdOrder = await ManualLabService.createOrder(orderData, {
                userId: testUser._id,
                workplaceId: testWorkplace._id,
                userRole: 'pharmacist'
            });

            await ManualLabService.updateOrderStatus(
                createdOrder.orderId,
                { status: 'sample_collected', updatedBy: testUser._id },
                { userId: testUser._id, workplaceId: testWorkplace._id, userRole: 'pharmacist' }
            );

            // Add normal results
            const normalResults = await ManualLabService.addResults(
                createdOrder.orderId,
                {
                    enteredBy: testUser._id,
                    values: [
                        {
                            testCode: 'BMP',
                            testName: 'Basic Metabolic Panel',
                            stringValue: 'All values within normal limits',
                            comment: 'Comprehensive metabolic panel normal'
                        }
                    ]
                },
                { userId: testUser._id, workplaceId: testWorkplace._id, userRole: 'pharmacist' }
            );

            // Verify AI processing was triggered
            expect(mockDiagnosticService.processRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    patientId: testPatient._id,
                    workplaceId: testWorkplace._id,
                    source: 'manual_lab_order',
                    sourceId: createdOrder.orderId
                })
            );

            // Verify result was marked as AI processed
            const processedResult = await ManualLabResult.findOne({ orderId: createdOrder.orderId });
            expect(processedResult!.aiProcessed).toBe(true);
            expect(processedResult!.diagnosticResultId).toBeDefined();
        });

        it('should process AI interpretation with critical results and red flags', async () => {
            // Mock AI service response for critical results
            const mockDiagnosticService = require('../../../services/diagnosticService');
            mockDiagnosticService.processRequest = jest.fn().mockResolvedValue({
                _id: new mongoose.Types.ObjectId(),
                patientId: testPatient._id,
                workplaceId: testWorkplace._id,
                differentialDiagnoses: [
                    {
                        condition: 'Diabetic ketoacidosis',
                        probability: 85,
                        reasoning: 'Severely elevated glucose with metabolic acidosis',
                        severity: 'critical',
                        icd10Code: 'E10.10'
                    },
                    {
                        condition: 'Type 1 diabetes mellitus',
                        probability: 75,
                        reasoning: 'New onset diabetes with ketosis',
                        severity: 'high',
                        icd10Code: 'E10.9'
                    }
                ],
                recommendedTests: [
                    {
                        testName: 'Arterial blood gas',
                        urgency: 'immediate',
                        reasoning: 'Assess acid-base status'
                    },
                    {
                        testName: 'Ketones (blood or urine)',
                        urgency: 'immediate',
                        reasoning: 'Confirm ketosis'
                    }
                ],
                therapeuticOptions: [
                    {
                        intervention: 'IV insulin therapy',
                        priority: 'immediate',
                        reasoning: 'Lower glucose and suppress ketogenesis'
                    },
                    {
                        intervention: 'IV fluid resuscitation',
                        priority: 'immediate',
                        reasoning: 'Correct dehydration and electrolyte imbalances'
                    }
                ],
                redFlags: [
                    {
                        flag: 'Critical glucose elevation',
                        severity: 'critical',
                        action: 'Immediate medical attention required',
                        timeframe: 'within 1 hour'
                    },
                    {
                        flag: 'Risk of diabetic ketoacidosis',
                        severity: 'critical',
                        action: 'Emergency department evaluation',
                        timeframe: 'immediately'
                    }
                ],
                confidenceScore: 88,
                aiModel: 'deepseek-v3.1',
                processingTime: 1800,
                createdAt: new Date()
            });

            // Create order and add critical results
            const orderData = {
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
                indication: 'Patient presenting with polyuria, polydipsia, and weight loss',
                consentObtained: true,
                consentObtainedBy: testUser._id
            };

            const createdOrder = await ManualLabService.createOrder(orderData, {
                userId: testUser._id,
                workplaceId: testWorkplace._id,
                userRole: 'pharmacist'
            });

            await ManualLabService.updateOrderStatus(
                createdOrder.orderId,
                { status: 'sample_collected', updatedBy: testUser._id },
                { userId: testUser._id, workplaceId: testWorkplace._id, userRole: 'pharmacist' }
            );

            // Add critical results
            const criticalResults = await ManualLabService.addResults(
                createdOrder.orderId,
                {
                    enteredBy: testUser._id,
                    values: [
                        {
                            testCode: 'GLU',
                            testName: 'Glucose',
                            numericValue: 450, // Critical elevation
                            unit: 'mg/dL',
                            comment: 'Critically elevated glucose level'
                        }
                    ]
                },
                { userId: testUser._id, workplaceId: testWorkplace._id, userRole: 'pharmacist' }
            );

            // Verify AI processing was triggered with critical context
            expect(mockDiagnosticService.processRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    patientId: testPatient._id,
                    workplaceId: testWorkplace._id,
                    source: 'manual_lab_order',
                    sourceId: createdOrder.orderId,
                    inputSnapshot: expect.objectContaining({
                        symptoms: expect.arrayContaining(['polyuria', 'polydipsia', 'weight loss']),
                        labResults: expect.arrayContaining([
                            expect.objectContaining({
                                testCode: 'GLU',
                                value: 450,
                                unit: 'mg/dL',
                                interpretation: 'critical'
                            })
                        ])
                    })
                })
            );

            // Verify critical results were identified
            expect(criticalResults.hasAbnormalResults()).toBe(true);
            const criticalResultValues = criticalResults.getCriticalResults();
            expect(criticalResultValues).toHaveLength(1);
            expect(criticalResultValues[0].testCode).toBe('GLU');

            // Verify result was marked as AI processed
            const processedResult = await ManualLabResult.findOne({ orderId: createdOrder.orderId });
            expect(processedResult!.aiProcessed).toBe(true);
            expect(processedResult!.diagnosticResultId).toBeDefined();
        });

        it('should handle AI service failures gracefully', async () => {
            // Mock AI service failure
            const mockDiagnosticService = require('../../../services/diagnosticService');
            mockDiagnosticService.processRequest = jest.fn().mockRejectedValue(
                new Error('AI service temporarily unavailable')
            );

            // Create order and add results
            const orderData = {
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

            const createdOrder = await ManualLabService.createOrder(orderData, {
                userId: testUser._id,
                workplaceId: testWorkplace._id,
                userRole: 'pharmacist'
            });

            await ManualLabService.updateOrderStatus(
                createdOrder.orderId,
                { status: 'sample_collected', updatedBy: testUser._id },
                { userId: testUser._id, workplaceId: testWorkplace._id, userRole: 'pharmacist' }
            );

            // Add results - should not fail even if AI service fails
            const results = await ManualLabService.addResults(
                createdOrder.orderId,
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
                { userId: testUser._id, workplaceId: testWorkplace._id, userRole: 'pharmacist' }
            );

            // Results should still be saved even if AI processing fails
            expect(results).toBeDefined();
            expect(results.values).toHaveLength(1);

            // Verify result was NOT marked as AI processed due to failure
            const processedResult = await ManualLabResult.findOne({ orderId: createdOrder.orderId });
            expect(processedResult!.aiProcessed).toBe(false);
            expect(processedResult!.diagnosticResultId).toBeUndefined();

            // Verify AI service was attempted
            expect(mockDiagnosticService.processRequest).toHaveBeenCalled();
        });
    });
    describe('Notification Delivery and Alert Systems', () => {
        it('should trigger critical alerts for red flag results', async () => {
            // Mock notification service
            const mockNotificationService = require('../../../services/notificationService');
            mockNotificationService.sendCriticalAlert = jest.fn().mockResolvedValue({
                success: true,
                messageId: 'msg_123456',
                deliveredAt: new Date()
            });

            // Mock AI service with red flags
            const mockDiagnosticService = require('../../../services/diagnosticService');
            mockDiagnosticService.processRequest = jest.fn().mockResolvedValue({
                _id: new mongoose.Types.ObjectId(),
                patientId: testPatient._id,
                workplaceId: testWorkplace._id,
                differentialDiagnoses: [
                    {
                        condition: 'Acute myocardial infarction',
                        probability: 90,
                        reasoning: 'Severely elevated cardiac enzymes',
                        severity: 'critical',
                        icd10Code: 'I21.9'
                    }
                ],
                redFlags: [
                    {
                        flag: 'Critical troponin elevation',
                        severity: 'critical',
                        action: 'Immediate cardiology consultation',
                        timeframe: 'within 30 minutes'
                    }
                ],
                confidenceScore: 92,
                aiModel: 'deepseek-v3.1',
                processingTime: 1500,
                createdAt: new Date()
            });

            // Create order for cardiac markers
            const orderData = {
                patientId: testPatient._id,
                workplaceId: testWorkplace._id,
                orderedBy: testUser._id,
                tests: [
                    {
                        name: 'Troponin I',
                        code: 'TROP',
                        specimenType: 'Blood',
                        unit: 'ng/mL',
                        refRange: '0.0-0.04',
                        category: 'Cardiac Markers'
                    }
                ],
                indication: 'Chest pain evaluation',
                priority: 'stat',
                consentObtained: true,
                consentObtainedBy: testUser._id
            };

            const createdOrder = await ManualLabService.createOrder(orderData, {
                userId: testUser._id,
                workplaceId: testWorkplace._id,
                userRole: 'pharmacist'
            });

            await ManualLabService.updateOrderStatus(
                createdOrder.orderId,
                { status: 'sample_collected', updatedBy: testUser._id },
                { userId: testUser._id, workplaceId: testWorkplace._id, userRole: 'pharmacist' }
            );

            // Add critical results
            const criticalResults = await ManualLabService.addResults(
                createdOrder.orderId,
                {
                    enteredBy: testUser._id,
                    values: [
                        {
                            testCode: 'TROP',
                            testName: 'Troponin I',
                            numericValue: 15.2, // Critically elevated
                            unit: 'ng/mL',
                            comment: 'Critically elevated troponin'
                        }
                    ]
                },
                { userId: testUser._id, workplaceId: testWorkplace._id, userRole: 'pharmacist' }
            );

            // Verify critical alert was triggered
            expect(mockNotificationService.sendCriticalAlert).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: testUser._id,
                    type: 'critical_lab_result',
                    message: expect.stringContaining('Critical lab results require immediate attention'),
                    data: expect.objectContaining({
                        orderId: createdOrder.orderId,
                        patientName: expect.stringContaining('John Doe'),
                        redFlags: expect.arrayContaining([
                            expect.objectContaining({
                                severity: 'critical'
                            })
                        ])
                    })
                })
            );

            // Verify results were processed
            expect(criticalResults.hasAbnormalResults()).toBe(true);
            const criticalValues = criticalResults.getCriticalResults();
            expect(criticalValues).toHaveLength(1);
        });

        it('should send patient notifications for completed results', async () => {
            // Mock patient notification service
            const mockNotificationService = require('../../../services/notificationService');
            mockNotificationService.sendPatientNotification = jest.fn().mockResolvedValue({
                success: true,
                sms: { messageId: 'sms_123', delivered: true },
                email: { messageId: 'email_456', delivered: true }
            });

            // Create order and complete workflow
            const orderData = {
                patientId: testPatient._id,
                workplaceId: testWorkplace._id,
                orderedBy: testUser._id,
                tests: [
                    {
                        name: 'Lipid Panel',
                        code: 'LIPID',
                        specimenType: 'Blood',
                        unit: 'mg/dL',
                        refRange: 'Various',
                        category: 'Chemistry'
                    }
                ],
                indication: 'Cardiovascular risk assessment',
                consentObtained: true,
                consentObtainedBy: testUser._id
            };

            const createdOrder = await ManualLabService.createOrder(orderData, {
                userId: testUser._id,
                workplaceId: testWorkplace._id,
                userRole: 'pharmacist'
            });

            await ManualLabService.updateOrderStatus(
                createdOrder.orderId,
                { status: 'sample_collected', updatedBy: testUser._id },
                { userId: testUser._id, workplaceId: testWorkplace._id, userRole: 'pharmacist' }
            );

            await ManualLabService.addResults(
                createdOrder.orderId,
                {
                    enteredBy: testUser._id,
                    values: [
                        {
                            testCode: 'LIPID',
                            testName: 'Lipid Panel',
                            stringValue: 'Total cholesterol: 180 mg/dL, HDL: 45 mg/dL, LDL: 110 mg/dL',
                            comment: 'Lipid levels within acceptable range'
                        }
                    ]
                },
                { userId: testUser._id, workplaceId: testWorkplace._id, userRole: 'pharmacist' }
            );

            // Complete the order
            await ManualLabService.updateOrderStatus(
                createdOrder.orderId,
                { status: 'completed', updatedBy: testUser._id },
                { userId: testUser._id, workplaceId: testWorkplace._id, userRole: 'pharmacist' }
            );

            // Verify patient notification was sent
            expect(mockNotificationService.sendPatientNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    patientId: testPatient._id,
                    type: 'lab_results_ready',
                    message: expect.stringContaining('Your lab results are ready'),
                    data: expect.objectContaining({
                        orderId: createdOrder.orderId,
                        testNames: expect.arrayContaining(['Lipid Panel'])
                    })
                })
            );
        });

        it('should handle notification delivery failures gracefully', async () => {
            // Mock notification service failure
            const mockNotificationService = require('../../../services/notificationService');
            mockNotificationService.sendPatientNotification = jest.fn().mockRejectedValue(
                new Error('SMS service temporarily unavailable')
            );

            // Create and complete order
            const orderData = {
                patientId: testPatient._id,
                workplaceId: testWorkplace._id,
                orderedBy: testUser._id,
                tests: [
                    {
                        name: 'Urinalysis',
                        code: 'UA',
                        specimenType: 'Urine',
                        unit: 'Various',
                        refRange: 'Various',
                        category: 'Urinalysis'
                    }
                ],
                indication: 'UTI screening',
                consentObtained: true,
                consentObtainedBy: testUser._id
            };

            const createdOrder = await ManualLabService.createOrder(orderData, {
                userId: testUser._id,
                workplaceId: testWorkplace._id,
                userRole: 'pharmacist'
            });

            await ManualLabService.updateOrderStatus(
                createdOrder.orderId,
                { status: 'sample_collected', updatedBy: testUser._id },
                { userId: testUser._id, workplaceId: testWorkplace._id, userRole: 'pharmacist' }
            );

            await ManualLabService.addResults(
                createdOrder.orderId,
                {
                    enteredBy: testUser._id,
                    values: [
                        {
                            testCode: 'UA',
                            testName: 'Urinalysis',
                            stringValue: 'Normal urinalysis',
                            comment: 'No signs of infection'
                        }
                    ]
                },
                { userId: testUser._id, workplaceId: testWorkplace._id, userRole: 'pharmacist' }
            );

            // Complete the order - should not fail even if notification fails
            const completedOrder = await ManualLabService.updateOrderStatus(
                createdOrder.orderId,
                { status: 'completed', updatedBy: testUser._id },
                { userId: testUser._id, workplaceId: testWorkplace._id, userRole: 'pharmacist' }
            );

            // Order should still be completed despite notification failure
            expect(completedOrder.status).toBe('completed');

            // Verify notification was attempted
            expect(mockNotificationService.sendPatientNotification).toHaveBeenCalled();
        });
    }); des
    cribe('Error Scenarios and Recovery', () => {
        it('should handle concurrent order creation without conflicts', async () => {
            const orderData = {
                patientId: testPatient._id.toString(),
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
                consentObtainedBy: testUser._id.toString()
            };

            // Create multiple orders concurrently
            const promises = Array.from({ length: 5 }, () =>
                request(app)
                    .post('/api/manual-lab-orders')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(orderData)
            );

            const responses = await Promise.all(promises);

            // All orders should be created successfully
            const successfulResponses = responses.filter(r => r.status === 201);
            expect(successfulResponses).toHaveLength(5);

            // All orders should have unique IDs
            const orderIds = successfulResponses.map(r => r.body.data.order.orderId);
            const uniqueOrderIds = new Set(orderIds);
            expect(uniqueOrderIds.size).toBe(5);

            // Verify all orders exist in database
            const savedOrders = await ManualLabOrder.find({
                orderId: { $in: orderIds }
            });
            expect(savedOrders).toHaveLength(5);
        });

        it('should handle partial workflow completion and recovery', async () => {
            // Create order
            const orderData = {
                patientId: testPatient._id,
                workplaceId: testWorkplace._id,
                orderedBy: testUser._id,
                tests: [
                    {
                        name: 'Thyroid Function Tests',
                        code: 'TFT',
                        specimenType: 'Blood',
                        unit: 'Various',
                        refRange: 'Various',
                        category: 'Endocrinology'
                    }
                ],
                indication: 'Thyroid dysfunction evaluation',
                consentObtained: true,
                consentObtainedBy: testUser._id
            };

            const createdOrder = await ManualLabService.createOrder(orderData, {
                userId: testUser._id,
                workplaceId: testWorkplace._id,
                userRole: 'pharmacist'
            });

            // Simulate partial completion - update to sample_collected
            await ManualLabService.updateOrderStatus(
                createdOrder.orderId,
                { status: 'sample_collected', updatedBy: testUser._id },
                { userId: testUser._id, workplaceId: testWorkplace._id, userRole: 'pharmacist' }
            );

            // Simulate system interruption - order is left in sample_collected state
            // Later, attempt to add results
            const results = await ManualLabService.addResults(
                createdOrder.orderId,
                {
                    enteredBy: testUser._id,
                    values: [
                        {
                            testCode: 'TFT',
                            testName: 'Thyroid Function Tests',
                            stringValue: 'TSH: 2.5 mIU/L, T4: 8.2 μg/dL, T3: 120 ng/dL',
                            comment: 'Thyroid function within normal limits'
                        }
                    ]
                },
                { userId: testUser._id, workplaceId: testWorkplace._id, userRole: 'pharmacist' }
            );

            // Workflow should continue normally
            expect(results).toBeDefined();
            expect(results.values).toHaveLength(1);

            // Order status should be updated to result_awaited
            const updatedOrder = await ManualLabOrder.findOne({ orderId: createdOrder.orderId });
            expect(updatedOrder!.status).toBe('result_awaited');

            // Complete the workflow
            const completedOrder = await ManualLabService.updateOrderStatus(
                createdOrder.orderId,
                { status: 'completed', updatedBy: testUser._id },
                { userId: testUser._id, workplaceId: testWorkplace._id, userRole: 'pharmacist' }
            );

            expect(completedOrder.status).toBe('completed');
        });

        it('should handle database connection issues gracefully', async () => {
            // Simulate database connection issue
            const originalFind = ManualLabOrder.findOne;
            ManualLabOrder.findOne = jest.fn().mockRejectedValue(
                new Error('Database connection timeout')
            );

            const response = await request(app)
                .get('/api/manual-lab-orders/LAB-2024-0001')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Failed to retrieve lab order');

            // Restore original method
            ManualLabOrder.findOne = originalFind;
        });

        it('should validate business rules across workflow steps', async () => {
            // Create order
            const orderData = {
                patientId: testPatient._id,
                workplaceId: testWorkplace._id,
                orderedBy: testUser._id,
                tests: [
                    {
                        name: 'Coagulation Studies',
                        code: 'COAG',
                        specimenType: 'Blood',
                        unit: 'seconds',
                        refRange: 'Various',
                        category: 'Hematology'
                    }
                ],
                indication: 'Pre-operative evaluation',
                consentObtained: true,
                consentObtainedBy: testUser._id
            };

            const createdOrder = await ManualLabService.createOrder(orderData, {
                userId: testUser._id,
                workplaceId: testWorkplace._id,
                userRole: 'pharmacist'
            });

            // Try to add results without updating status first
            await expect(
                ManualLabService.addResults(
                    createdOrder.orderId,
                    {
                        enteredBy: testUser._id,
                        values: [
                            {
                                testCode: 'COAG',
                                testName: 'Coagulation Studies',
                                stringValue: 'PT: 12.5 sec, PTT: 28 sec, INR: 1.1',
                                comment: 'Normal coagulation parameters'
                            }
                        ]
                    },
                    { userId: testUser._id, workplaceId: testWorkplace._id, userRole: 'pharmacist' }
                )
            ).rejects.toThrow('Results can only be added to orders with sample collected');

            // Try invalid status transition
            await expect(
                ManualLabService.updateOrderStatus(
                    createdOrder.orderId,
                    { status: 'completed', updatedBy: testUser._id },
                    { userId: testUser._id, workplaceId: testWorkplace._id, userRole: 'pharmacist' }
                )
            ).rejects.toThrow('Invalid status transition');

            // Follow correct workflow
            await ManualLabService.updateOrderStatus(
                createdOrder.orderId,
                { status: 'sample_collected', updatedBy: testUser._id },
                { userId: testUser._id, workplaceId: testWorkplace._id, userRole: 'pharmacist' }
            );

            const results = await ManualLabService.addResults(
                createdOrder.orderId,
                {
                    enteredBy: testUser._id,
                    values: [
                        {
                            testCode: 'COAG',
                            testName: 'Coagulation Studies',
                            stringValue: 'PT: 12.5 sec, PTT: 28 sec, INR: 1.1',
                            comment: 'Normal coagulation parameters'
                        }
                    ]
                },
                { userId: testUser._id, workplaceId: testWorkplace._id, userRole: 'pharmacist' }
            );

            expect(results).toBeDefined();
            expect(results.values).toHaveLength(1);
        });
    });

    describe('Performance and Scalability Tests', () => {
        it('should handle large result datasets efficiently', async () => {
            // Create order with many tests
            const manyTests = Array.from({ length: 50 }, (_, i) => ({
                name: `Test ${i + 1}`,
                code: `T${(i + 1).toString().padStart(3, '0')}`,
                specimenType: 'Blood',
                unit: 'mg/dL',
                refRange: '0-100',
                category: 'Chemistry'
            }));

            const orderData = {
                patientId: testPatient._id,
                workplaceId: testWorkplace._id,
                orderedBy: testUser._id,
                tests: manyTests,
                indication: 'Comprehensive metabolic evaluation',
                consentObtained: true,
                consentObtainedBy: testUser._id
            };

            const startTime = Date.now();
            const createdOrder = await ManualLabService.createOrder(orderData, {
                userId: testUser._id,
                workplaceId: testWorkplace._id,
                userRole: 'pharmacist'
            });
            const createTime = Date.now() - startTime;

            expect(createTime).toBeLessThan(5000); // Should complete within 5 seconds
            expect(createdOrder.tests).toHaveLength(50);

            await ManualLabService.updateOrderStatus(
                createdOrder.orderId,
                { status: 'sample_collected', updatedBy: testUser._id },
                { userId: testUser._id, workplaceId: testWorkplace._id, userRole: 'pharmacist' }
            );

            // Add results for all tests
            const manyValues = manyTests.map((test, i) => ({
                testCode: test.code,
                testName: test.name,
                numericValue: Math.random() * 100,
                unit: 'mg/dL',
                comment: `Result ${i + 1}`
            }));

            const resultsStartTime = Date.now();
            const results = await ManualLabService.addResults(
                createdOrder.orderId,
                {
                    enteredBy: testUser._id,
                    values: manyValues
                },
                { userId: testUser._id, workplaceId: testWorkplace._id, userRole: 'pharmacist' }
            );
            const resultsTime = Date.now() - resultsStartTime;

            expect(resultsTime).toBeLessThan(10000); // Should complete within 10 seconds
            expect(results.values).toHaveLength(50);
            expect(results.interpretation).toHaveLength(50);
        });

        it('should maintain performance with concurrent workflows', async () => {
            const concurrentWorkflows = 10;
            const startTime = Date.now();

            const workflowPromises = Array.from({ length: concurrentWorkflows }, async (_, i) => {
                const orderData = {
                    patientId: testPatient._id,
                    workplaceId: testWorkplace._id,
                    orderedBy: testUser._id,
                    tests: [
                        {
                            name: `Concurrent Test ${i + 1}`,
                            code: `CT${i + 1}`,
                            specimenType: 'Blood',
                            unit: 'mg/dL',
                            refRange: '0-100',
                            category: 'Chemistry'
                        }
                    ],
                    indication: `Concurrent workflow ${i + 1}`,
                    consentObtained: true,
                    consentObtainedBy: testUser._id
                };

                const order = await ManualLabService.createOrder(orderData, {
                    userId: testUser._id,
                    workplaceId: testWorkplace._id,
                    userRole: 'pharmacist'
                });

                await ManualLabService.updateOrderStatus(
                    order.orderId,
                    { status: 'sample_collected', updatedBy: testUser._id },
                    { userId: testUser._id, workplaceId: testWorkplace._id, userRole: 'pharmacist' }
                );

                const results = await ManualLabService.addResults(
                    order.orderId,
                    {
                        enteredBy: testUser._id,
                        values: [
                            {
                                testCode: `CT${i + 1}`,
                                testName: `Concurrent Test ${i + 1}`,
                                numericValue: Math.random() * 100,
                                unit: 'mg/dL'
                            }
                        ]
                    },
                    { userId: testUser._id, workplaceId: testWorkplace._id, userRole: 'pharmacist' }
                );

                return { order, results };
            });

            const completedWorkflows = await Promise.all(workflowPromises);
            const totalTime = Date.now() - startTime;

            expect(totalTime).toBeLessThan(30000); // Should complete within 30 seconds
            expect(completedWorkflows).toHaveLength(concurrentWorkflows);

            // Verify all workflows completed successfully
            completedWorkflows.forEach(({ order, results }) => {
                expect(order).toBeDefined();
                expect(results).toBeDefined();
                expect(results.values).toHaveLength(1);
            });
        });
    });
});