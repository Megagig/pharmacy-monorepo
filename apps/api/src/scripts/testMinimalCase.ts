#!/usr/bin/env ts-node

/**
 * Test with minimal required data to isolate validation issues
 */

import axios from 'axios';
import { config } from 'dotenv';

config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

async function testMinimalCase() {
    console.log('🧪 Testing Minimal Case Data');
    console.log('============================');

    // Test with a valid JWT token
    const testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGI1Y2I4MWYxZjBmOTc1OGI4YWZhZGQiLCJpYXQiOjE3NTc5MTA5MDgsImV4cCI6MTc1NzkxNDUwOH0.S6XUoV-Nqjp5kKqDdH8C09c5E8Tm61fxIiOfZQTDSrc';

    // Minimal payload with only required fields
    const minimalPayload = {
        patientId: '68c19c01291fc305b976d6ff',
        symptoms: {
            subjective: ['Headache']
        }
    };

    try {
        console.log('📤 Sending minimal payload:');
        console.log(JSON.stringify(minimalPayload, null, 2));

        const response = await axios.post(`${API_BASE_URL}/api/diagnostics/ai`, minimalPayload, {
            headers: {
                'Authorization': `Bearer ${testToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 70000
        });

        console.log('✅ Minimal request successful!');
        console.log('Response:', response.data);

    } catch (error: any) {
        console.error('❌ Minimal request failed!');

        if (error.response) {
            console.error('📡 Status:', error.response.status);
            console.error('📋 Response data:', JSON.stringify(error.response.data, null, 2));

            if (error.response.data.errors) {
                console.error('\n🔍 Validation Errors:');
                error.response.data.errors.forEach((err: any, index: number) => {
                    console.error(`  ${index + 1}. Field: ${err.path || err.param || 'unknown'}`);
                    console.error(`     Message: ${err.msg || err.message}`);
                    console.error(`     Value: ${JSON.stringify(err.value)}`);
                    console.error('');
                });
            }
        } else {
            console.error('Error:', error.message);
        }
    }
}

// Run the test
if (require.main === module) {
    testMinimalCase().catch(error => {
        console.error('Test execution failed:', error);
        process.exit(1);
    });
}

export default testMinimalCase;