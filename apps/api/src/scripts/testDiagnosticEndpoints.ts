import dotenv from 'dotenv';
import axios from 'axios';
import logger from '../utils/logger';

// Load environment variables
dotenv.config();

/**
 * Script to test diagnostic endpoints after feature flag setup
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const API_URL = `${BASE_URL}/api`;

// You'll need to replace this with a valid JWT token from your application
const TEST_TOKEN = process.env.TEST_JWT_TOKEN || '';

const axiosConfig = {
    headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
    }
};

async function testDiagnosticEndpoints() {
    try {
        logger.info('🧪 Testing diagnostic endpoints...');

        if (!TEST_TOKEN) {
            logger.warn('⚠️  No TEST_JWT_TOKEN provided. Please set TEST_JWT_TOKEN environment variable with a valid JWT token.');
            logger.info('You can get a token by logging into the application and copying it from the browser cookies or localStorage.');
            return;
        }

        // Test 1: AI Connection Test (Super Admin only)
        try {
            logger.info('Testing AI connection test endpoint...');
            const response = await axios.get(`${API_URL}/diagnostics/ai/test`, axiosConfig);
            logger.info('✅ AI Connection Test:', response.data);
        } catch (error: any) {
            if (error.response?.status === 403) {
                logger.info('ℹ️  AI Connection Test requires super admin role (expected for non-super-admin users)');
            } else {
                logger.error('❌ AI Connection Test failed:', error.response?.data || error.message);
            }
        }

        // Test 2: Drug Interactions Check
        try {
            logger.info('Testing drug interactions endpoint...');
            const testMedications = [
                { name: 'Aspirin', dosage: '100mg' },
                { name: 'Warfarin', dosage: '5mg' }
            ];

            const response = await axios.post(`${API_URL}/diagnostics/interactions`, {
                medications: testMedications
            }, axiosConfig);

            logger.info('✅ Drug Interactions Check:', response.data);
        } catch (error: any) {
            logger.error('❌ Drug Interactions Check failed:', error.response?.data || error.message);
        }

        // Test 3: Generate AI Diagnostic Analysis (requires patient data)
        try {
            logger.info('Testing AI diagnostic analysis endpoint...');

            // This is a sample request - you'll need a valid patient ID
            const diagnosticRequest = {
                patientId: '507f1f77bcf86cd799439011', // Sample patient ID
                symptoms: {
                    subjective: ['Headache', 'Nausea'],
                    objective: ['Elevated blood pressure: 150/90 mmHg']
                },
                labResults: [],
                currentMedications: [
                    { name: 'Lisinopril', dosage: '10mg', frequency: 'once daily' }
                ],
                vitalSigns: {
                    bloodPressure: '150/90',
                    heartRate: 80,
                    temperature: 98.6,
                    respiratoryRate: 16
                },
                patientConsent: {
                    provided: true,
                    method: 'electronic'
                }
            };

            const response = await axios.post(`${API_URL}/diagnostics/ai`, diagnosticRequest, axiosConfig);
            logger.info('✅ AI Diagnostic Analysis:', response.data);
        } catch (error: any) {
            if (error.response?.status === 404 && error.response?.data?.message?.includes('Patient not found')) {
                logger.info('ℹ️  AI Diagnostic Analysis requires a valid patient ID (expected with sample patient ID)');
            } else {
                logger.error('❌ AI Diagnostic Analysis failed:', error.response?.data || error.message);
            }
        }

        logger.info('\n🎉 Diagnostic endpoints test completed!');
        logger.info('\nIf you see authentication errors, make sure to:');
        logger.info('1. Set TEST_JWT_TOKEN environment variable with a valid token');
        logger.info('2. Ensure your user has the required permissions');
        logger.info('3. Verify the backend server is running');

    } catch (error) {
        logger.error('❌ Failed to test diagnostic endpoints:', error);
    }
}

// Run the script
if (require.main === module) {
    testDiagnosticEndpoints()
        .then(() => {
            logger.info('Test script completed');
            process.exit(0);
        })
        .catch((error) => {
            logger.error('Test script failed:', error);
            process.exit(1);
        });
}

export default testDiagnosticEndpoints;