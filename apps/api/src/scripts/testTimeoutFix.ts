#!/usr/bin/env ts-node

/**
 * Test script to verify timeout fixes for AI diagnostics
 */

import axios from 'axios';
import { config } from 'dotenv';

config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

async function testTimeoutFix() {
    console.log('🧪 Testing AI Diagnostics Timeout Fix');
    console.log('=====================================');

    // Test with a valid JWT token (you'll need to replace this with a real token)
    const testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGI1Y2I4MWYxZjBmOTc1OGI4YWZhZGQiLCJpYXQiOjE3NTc5MTA5MDgsImV4cCI6MTc1NzkxNDUwOH0.S6XUoV-Nqjp5kKqDdH8C09c5E8Tm61fxIiOfZQTDSrc';

    const diagnosticPayload = {
        patientId: '68c19c01291fc305b976d6ff',
        symptoms: {
            subjective: ['Severe headache', 'Nausea', 'Dizziness', 'Fatigue'],
            objective: ['Elevated blood pressure', 'Mild dehydration', 'Tachycardia'],
            duration: '3 days',
            severity: 'moderate',
            onset: 'acute'
        },
        labResults: [],
        currentMedications: [],
        vitalSigns: {
            bloodPressure: '160/95',
            heartRate: 95,
            temperature: 37.5,
            respiratoryRate: 20
        },
        patientConsent: {
            provided: true,
            method: 'electronic'
        }
    };

    try {
        console.log('⏱️  Starting AI diagnostic request...');
        const startTime = Date.now();

        const response = await axios.post(`${API_BASE_URL}/api/diagnostics/ai`, diagnosticPayload, {
            headers: {
                'Authorization': `Bearer ${testToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 70000 // 70 seconds timeout for this test
        });

        const endTime = Date.now();
        const processingTime = endTime - startTime;

        console.log('✅ AI diagnostic request completed successfully!');
        console.log(`⏱️  Total processing time: ${processingTime}ms (${(processingTime / 1000).toFixed(1)}s)`);

        if (response.data.success) {
            console.log(`📋 Case ID: ${response.data.data.caseId}`);
            console.log(`🧠 Analysis generated: ${!!response.data.data.analysis}`);
            console.log(`🔍 Diagnoses found: ${response.data.data.analysis?.differentialDiagnoses?.length || 0}`);
        }

        console.log('\n🎉 Timeout fix is working correctly!');

    } catch (error: any) {
        console.error('❌ Test failed:', error.message);

        if (error.code === 'ECONNABORTED') {
            console.error('⚠️  Request timed out - timeout fix may not be working');
        } else if (error.response) {
            console.error(`📡 HTTP ${error.response.status}: ${error.response.data?.message || 'Unknown error'}`);
        }

        process.exit(1);
    }
}

// Run the test
if (require.main === module) {
    testTimeoutFix().catch(error => {
        console.error('Test execution failed:', error);
        process.exit(1);
    });
}

export default testTimeoutFix;