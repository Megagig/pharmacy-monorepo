#!/usr/bin/env ts-node

/**
 * End-to-End Test for AI Diagnostics Feature
 * 
 * This script tests the complete diagnostic workflow:
 * 1. Feature flag verification
 * 2. AI connection test
 * 3. Diagnostic case submission
 * 4. Drug interaction checking
 * 5. Case retrieval
 */

import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { config } from 'dotenv';
import User from '../models/User';
import Patient from '../models/Patient';
import FeatureFlag from '../models/FeatureFlag';
import logger from '../utils/logger';

// Load environment variables
config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface TestResult {
    test: string;
    status: 'PASS' | 'FAIL';
    message: string;
    data?: any;
}

class DiagnosticEndToEndTest {
    private results: TestResult[] = [];
    private authToken: string = '';
    private testPatientId: string = '';

    async runAllTests(): Promise<void> {
        try {
            logger.info('🚀 Starting End-to-End Diagnostic Tests');

            // Connect to database
            await this.connectToDatabase();

            // Setup test data
            await this.setupTestData();

            // Run tests
            await this.testFeatureFlags();
            await this.testAIConnection();
            await this.testDiagnosticSubmission();
            await this.testDrugInteractions();
            await this.testCaseRetrieval();

            // Print results
            this.printResults();

        } catch (error) {
            logger.error('Test suite failed:', error);
            process.exit(1);
        } finally {
            await mongoose.connection.close();
        }
    }

    private async connectToDatabase(): Promise<void> {
        try {
            const mongoUri = process.env.MONGODB_URI;
            if (!mongoUri) {
                throw new Error('MONGODB_URI not found in environment variables');
            }

            await mongoose.connect(mongoUri);
            logger.info('✅ Connected to database');
        } catch (error) {
            logger.error('❌ Database connection failed:', error);
            throw error;
        }
    }

    private async setupTestData(): Promise<void> {
        try {
            // Find super admin user
            const superAdmin = await User.findOne({ role: 'super_admin' });
            if (!superAdmin) {
                throw new Error('Super admin user not found');
            }

            // Generate JWT token
            this.authToken = jwt.sign(
                { userId: superAdmin._id },
                JWT_SECRET,
                { expiresIn: '1h' }
            );

            // Find or create test patient
            let testPatient = await Patient.findOne({
                firstName: 'Test',
                lastName: 'Patient'
            });

            if (!testPatient) {
                testPatient = new Patient({
                    firstName: 'Test',
                    lastName: 'Patient',
                    dateOfBirth: new Date('1980-01-01'),
                    gender: 'male',
                    mrn: 'TEST-' + Date.now(),
                    contactInfo: {
                        phone: '+1234567890',
                        email: 'test.patient@example.com'
                    },
                    createdBy: superAdmin._id,
                    workplaceId: superAdmin.workplaceId
                });
                await testPatient.save();
            }

            this.testPatientId = testPatient._id.toString();

            logger.info('✅ Test data setup completed');
            this.addResult('Setup', 'PASS', 'Test data initialized successfully');
        } catch (error) {
            logger.error('❌ Test data setup failed:', error);
            this.addResult('Setup', 'FAIL', `Setup failed: ${error}`);
            throw error;
        }
    }

    private async testFeatureFlags(): Promise<void> {
        try {
            const requiredFlags = ['ai_diagnostics', 'clinical_decision_support', 'drug_information'];

            for (const flagName of requiredFlags) {
                const flag = await FeatureFlag.findOne({ name: flagName });
                if (!flag || !flag.isActive) {
                    throw new Error(`Feature flag ${flagName} not found or inactive`);
                }
            }

            this.addResult('Feature Flags', 'PASS', 'All required feature flags are active');
            logger.info('✅ Feature flags test passed');
        } catch (error) {
            this.addResult('Feature Flags', 'FAIL', `Feature flags test failed: ${error}`);
            logger.error('❌ Feature flags test failed:', error);
        }
    }

    private async testAIConnection(): Promise<void> {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/diagnostics/ai/test`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.data.success && response.data.data.connected) {
                this.addResult('AI Connection', 'PASS', 'AI service connection successful');
                logger.info('✅ AI connection test passed');
            } else {
                throw new Error('AI service not connected');
            }
        } catch (error: any) {
            this.addResult('AI Connection', 'FAIL', `AI connection failed: ${error.message}`);
            logger.error('❌ AI connection test failed:', error);
        }
    }

    private async testDiagnosticSubmission(): Promise<void> {
        try {
            const diagnosticPayload = {
                patientId: this.testPatientId,
                symptoms: {
                    subjective: ['Headache', 'Nausea', 'Fatigue'],
                    objective: ['Elevated blood pressure', 'Mild dehydration'],
                    duration: '3 days',
                    severity: 'moderate',
                    onset: 'acute'
                },
                labResults: [],
                currentMedications: [],
                vitalSigns: {
                    bloodPressure: '150/90',
                    heartRate: 85,
                    temperature: 37.2,
                    respiratoryRate: 18
                },
                patientConsent: {
                    provided: true,
                    method: 'electronic'
                }
            };

            const response = await axios.post(`${API_BASE_URL}/api/diagnostics/ai`, diagnosticPayload, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.data.success && response.data.data.caseId) {
                this.addResult('Diagnostic Submission', 'PASS', 'Diagnostic case submitted successfully', {
                    caseId: response.data.data.caseId,
                    analysisGenerated: !!response.data.data.analysis
                });
                logger.info('✅ Diagnostic submission test passed');
            } else {
                throw new Error('Diagnostic submission failed');
            }
        } catch (error: any) {
            this.addResult('Diagnostic Submission', 'FAIL', `Diagnostic submission failed: ${error.message}`);
            logger.error('❌ Diagnostic submission test failed:', error);
        }
    }

    private async testDrugInteractions(): Promise<void> {
        try {
            const interactionPayload = {
                medications: [
                    { name: 'Warfarin', dosage: '5mg', frequency: 'daily' },
                    { name: 'Aspirin', dosage: '81mg', frequency: 'daily' },
                    { name: 'Ibuprofen', dosage: '400mg', frequency: 'as needed' }
                ]
            };

            const response = await axios.post(`${API_BASE_URL}/api/diagnostics/interactions`, interactionPayload, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.data.success) {
                this.addResult('Drug Interactions', 'PASS', 'Drug interaction check completed', {
                    medicationsChecked: response.data.data.medicationsChecked,
                    interactionsFound: response.data.data.interactionsFound
                });
                logger.info('✅ Drug interactions test passed');
            } else {
                throw new Error('Drug interaction check failed');
            }
        } catch (error: any) {
            this.addResult('Drug Interactions', 'FAIL', `Drug interactions test failed: ${error.message}`);
            logger.error('❌ Drug interactions test failed:', error);
        }
    }

    private async testCaseRetrieval(): Promise<void> {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/diagnostics/patients/${this.testPatientId}/history`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.data.success) {
                this.addResult('Case Retrieval', 'PASS', 'Patient diagnostic history retrieved', {
                    casesFound: response.data.data.cases?.length || 0
                });
                logger.info('✅ Case retrieval test passed');
            } else {
                throw new Error('Case retrieval failed');
            }
        } catch (error: any) {
            this.addResult('Case Retrieval', 'FAIL', `Case retrieval failed: ${error.message}`);
            logger.error('❌ Case retrieval test failed:', error);
        }
    }

    private addResult(test: string, status: 'PASS' | 'FAIL', message: string, data?: any): void {
        this.results.push({ test, status, message, data });
    }

    private printResults(): void {
        console.log('\n' + '='.repeat(80));
        console.log('🧪 DIAGNOSTIC FEATURE END-TO-END TEST RESULTS');
        console.log('='.repeat(80));

        const passed = this.results.filter(r => r.status === 'PASS').length;
        const failed = this.results.filter(r => r.status === 'FAIL').length;

        this.results.forEach(result => {
            const icon = result.status === 'PASS' ? '✅' : '❌';
            console.log(`${icon} ${result.test}: ${result.message}`);
            if (result.data) {
                console.log(`   Data: ${JSON.stringify(result.data, null, 2)}`);
            }
        });

        console.log('\n' + '-'.repeat(80));
        console.log(`📊 SUMMARY: ${passed} passed, ${failed} failed`);

        if (failed === 0) {
            console.log('🎉 ALL TESTS PASSED! The AI Diagnostics feature is fully functional.');
        } else {
            console.log('⚠️  Some tests failed. Please review the issues above.');
        }
        console.log('='.repeat(80) + '\n');
    }
}

// Run the tests
if (require.main === module) {
    const testSuite = new DiagnosticEndToEndTest();
    testSuite.runAllTests().catch(error => {
        logger.error('Test suite execution failed:', error);
        process.exit(1);
    });
}

export default DiagnosticEndToEndTest;