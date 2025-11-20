import dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables
dotenv.config();

/**
 * Direct test of diagnostic endpoint with proper authentication
 */

async function testDiagnosticEndpointDirect() {
    try {
        console.log('🧪 Testing diagnostic endpoint directly...');

        // Use the JWT token from our previous script
        const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGI1Y2I4MWYxZjBmOTc1OGI4YWZhZGQiLCJpYXQiOjE3NTc5MDgzNDAsImV4cCI6MTc1NzkxMTk0MH0.wi85jvG_UZR4811wq-ZU4E2NDJ6lcMB_fgisH4aECM0';

        const config = {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        };

        // Test the health endpoint first
        console.log('Testing health endpoint...');
        const healthResponse = await axios.get('http://localhost:5000/api/health');
        console.log('✅ Health check:', healthResponse.data);

        // Test the diagnostic endpoint with the modules format
        console.log('Testing diagnostic endpoint...');
        const diagnosticPayload = {
            patientId: '68c19c01291fc305b976d6ff',
            inputSnapshot: {
                symptoms: {
                    subjective: ['Headache', 'Nausea'],
                    objective: ['Elevated blood pressure'],
                    duration: '2 days',
                    severity: 'moderate',
                    onset: 'acute'
                },
                vitals: {
                    bloodPressure: '150/90',
                    heartRate: 80,
                    temperature: 98.6,
                    respiratoryRate: 16
                },
                currentMedications: [],
                allergies: [],
                medicalHistory: [],
                labResults: []
            },
            priority: 'routine',
            consentObtained: true
        };

        try {
            const response = await axios.post('http://localhost:5000/api/diagnostics', diagnosticPayload, config);
            console.log('✅ Diagnostic endpoint success:', response.data);
        } catch (error: any) {
            console.log('❌ Diagnostic endpoint error:', {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                message: error.message
            });

            // If it's a 401, let's try to understand why
            if (error.response?.status === 401) {
                console.log('\n🔍 Debugging authentication issue...');

                // Test with a simple endpoint that uses basic auth
                try {
                    const userResponse = await axios.get('http://localhost:5000/api/patients', config);
                    console.log('✅ Basic auth works - patients endpoint accessible');
                } catch (authError: any) {
                    console.log('❌ Basic auth also fails:', authError.response?.data);
                }
            }
        }

    } catch (error: any) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testDiagnosticEndpointDirect()
    .then(() => {
        console.log('\n✅ Test completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Test script failed:', error);
        process.exit(1);
    });