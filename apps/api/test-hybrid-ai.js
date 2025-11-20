/**
 * Test script for the hybrid AI diagnostic system
 * Run with: node test-hybrid-ai.js
 */

const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:5000'; // Backend running on port 5000
const API_KEY = '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';

// Test cases with different complexity levels
const testCases = [
  {
    name: 'Simple Case (Should use DeepSeek Free)',
    data: {
      symptoms: {
        onset: 'gradual',
        duration: '2 days',
        severity: 'mild',
        subjective: ['headache'],
        objective: []
      },
      patientAge: 30,
      patientGender: 'female'
    }
  },
  {
    name: 'Complex Case (Should use Gemma 2 9B)',
    data: {
      symptoms: {
        onset: 'sudden',
        duration: '6 hours',
        severity: 'severe',
        subjective: ['chest pain', 'difficulty breathing', 'severe headache'],
        objective: ['diaphoresis', 'pallor']
      },
      vitalSigns: {
        bloodPressure: '180/110',
        heartRate: 120,
        temperature: 39.2,
        oxygenSaturation: 92
      },
      currentMedications: [
        { name: 'Aspirin', dosage: '81mg', frequency: 'daily' },
        { name: 'Metformin', dosage: '500mg', frequency: 'twice daily' },
        { name: 'Lisinopril', dosage: '10mg', frequency: 'daily' }
      ],
      labResults: [
        { testName: 'Troponin I', value: '2.5', referenceRange: '<0.04', abnormal: true },
        { testName: 'BNP', value: '450', referenceRange: '<100', abnormal: true }
      ],
      patientAge: 68,
      patientGender: 'male',
      medicalHistory: ['diabetes', 'hypertension', 'coronary artery disease']
    }
  }
];

async function testHybridSystem() {
  console.log('🧪 Testing Hybrid AI Diagnostic System\n');
  
  // Test connection first
  try {
    console.log('📡 Testing OpenRouter connection...');
    const response = await axios.get(`${BASE_URL}/api/ai-diagnostics/test-connection`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data.success) {
      console.log('✅ Connection successful');
      console.log(`   Models available: ${JSON.stringify(response.data.data.models, null, 2)}`);
    }
  } catch (error) {
    console.log('❌ Connection failed:', error.response?.data || error.message);
    return;
  }

  // Test usage statistics
  try {
    console.log('\n💰 Checking usage statistics...');
    const response = await axios.get(`${BASE_URL}/api/ai-diagnostics/usage-stats`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data.success) {
      const stats = response.data.data;
      console.log('✅ Usage stats retrieved');
      console.log(`   Budget limit: $${stats.budgetLimit}`);
      console.log(`   Current usage: $${stats.totalCost || 0}`);
      console.log(`   Budget used: ${stats.budgetUsedPercent || 0}%`);
      console.log(`   Can use paid models: ${stats.canUsePaidModels}`);
    }
  } catch (error) {
    console.log('⚠️  Usage stats not available (might be first run)');
  }

  console.log('\n🔬 Running diagnostic test cases...\n');

  for (const testCase of testCases) {
    console.log(`Testing: ${testCase.name}`);
    console.log('─'.repeat(50));
    
    try {
      // This would normally require authentication and a real patient ID
      // For testing, you'd need to modify this to work with your auth system
      console.log('⚠️  Note: This test requires proper authentication and patient setup');
      console.log('   Test case data:', JSON.stringify(testCase.data, null, 2));
      
    } catch (error) {
      console.log('❌ Test failed:', error.response?.data || error.message);
    }
    
    console.log('');
  }

  console.log('🎉 Hybrid system test completed!');
  console.log('\nNext steps:');
  console.log('1. Set up proper authentication');
  console.log('2. Create test patients in your system');
  console.log('3. Run real diagnostic analysis requests');
  console.log('4. Monitor usage statistics and costs');
}

// Run the test
testHybridSystem().catch(console.error);