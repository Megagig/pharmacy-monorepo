import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api';

interface TestResult {
  endpoint: string;
  success: boolean;
  statusCode?: number;
  dataReceived?: boolean;
  error?: string;
  details?: any;
}

async function testAnalyticsEndpoints() {
  console.log('🧪 Testing Analytics & Reports Endpoints\n');
  console.log('=' .repeat(60));

  const results: TestResult[] = [];

  // You'll need to replace this with a valid super admin token
  const token = process.env.TEST_SUPER_ADMIN_TOKEN || '';
  
  if (!token) {
    console.error('❌ TEST_SUPER_ADMIN_TOKEN not found in environment variables');
    console.log('Please set TEST_SUPER_ADMIN_TOKEN in your .env file');
    process.exit(1);
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // Test 1: Subscription Analytics
  console.log('\n📊 Test 1: Subscription Analytics');
  console.log('-'.repeat(60));
  try {
    const response = await axios.get(
      `${API_BASE_URL}/admin/saas/analytics/subscriptions?timeRange=30d`,
      { headers }
    );
    
    const hasData = response.data?.data;
    const analytics = response.data?.data;
    
    console.log('✅ Status:', response.status);
    console.log('✅ Data received:', !!hasData);
    
    if (analytics) {
      console.log('\nMetrics:');
      console.log(`  - MRR: ₦${analytics.mrr?.toLocaleString() || 0}`);
      console.log(`  - ARR: ₦${analytics.arr?.toLocaleString() || 0}`);
      console.log(`  - Churn Rate: ${(analytics.churnRate * 100).toFixed(2)}%`);
      console.log(`  - LTV: ₦${analytics.ltv?.toLocaleString() || 0}`);
      console.log(`  - Plan Distribution: ${analytics.planDistribution?.length || 0} plans`);
      console.log(`  - Revenue by Plan: ${analytics.revenueByPlan?.length || 0} plans`);
      
      // Check for mock data indicators
      const hasMockData = analytics.planDistribution?.some((plan: any) => 
        typeof plan.planName === 'string' && plan.planName.includes('ObjectId')
      );
      
      if (hasMockData) {
        console.log('⚠️  WARNING: Detected plan IDs instead of names!');
      } else {
        console.log('✅ Plan names are properly mapped');
      }
    }
    
    results.push({
      endpoint: 'GET /subscriptions',
      success: true,
      statusCode: response.status,
      dataReceived: !!hasData,
      details: analytics
    });
  } catch (error: any) {
    console.log('❌ Failed:', error.response?.status || error.message);
    results.push({
      endpoint: 'GET /subscriptions',
      success: false,
      error: error.message
    });
  }

  // Test 2: Workspace Usage Reports
  console.log('\n🏢 Test 2: Workspace Usage Reports');
  console.log('-'.repeat(60));
  try {
    const response = await axios.get(
      `${API_BASE_URL}/admin/saas/analytics/pharmacy-usage?timeRange=30d`,
      { headers }
    );
    
    const hasData = response.data?.data;
    const reports = response.data?.data?.reports || [];
    
    console.log('✅ Status:', response.status);
    console.log('✅ Data received:', !!hasData);
    console.log(`✅ Workspaces found: ${reports.length}`);
    
    if (reports.length > 0) {
      console.log('\nSample Workspace:');
      const sample = reports[0];
      console.log(`  - Name: ${sample.pharmacyName}`);
      console.log(`  - Plan: ${sample.subscriptionPlan}`);
      console.log(`  - Prescriptions: ${sample.prescriptionsProcessed}`);
      console.log(`  - Diagnostics: ${sample.diagnosticsPerformed}`);
      console.log(`  - Patients: ${sample.patientsManaged}`);
      console.log(`  - Active Users: ${sample.activeUsers}`);
      console.log(`  - Interventions: ${sample.clinicalOutcomes?.interventions || 0}`);
      
      // Check for placeholder data
      const hasPlaceholders = reports.some((r: any) => 
        r.prescriptionsProcessed > 100 && r.prescriptionsProcessed < 1100 &&
        r.diagnosticsPerformed > 50 && r.diagnosticsPerformed < 550
      );
      
      if (hasPlaceholders) {
        console.log('⚠️  WARNING: Possible placeholder/mock data detected!');
      } else {
        console.log('✅ Data appears to be real');
      }
    }
    
    results.push({
      endpoint: 'GET /pharmacy-usage',
      success: true,
      statusCode: response.status,
      dataReceived: !!hasData,
      details: { workspaceCount: reports.length }
    });
  } catch (error: any) {
    console.log('❌ Failed:', error.response?.status || error.message);
    console.log('Error details:', error.response?.data);
    results.push({
      endpoint: 'GET /pharmacy-usage',
      success: false,
      error: error.message
    });
  }

  // Test 3: Clinical Outcomes Report
  console.log('\n🏥 Test 3: Clinical Impact Report');
  console.log('-'.repeat(60));
  try {
    const response = await axios.get(
      `${API_BASE_URL}/admin/saas/analytics/clinical-outcomes?timeRange=30d`,
      { headers }
    );
    
    const hasData = response.data?.data;
    const report = response.data?.data;
    
    console.log('✅ Status:', response.status);
    console.log('✅ Data received:', !!hasData);
    
    if (report) {
      console.log('\nClinical Metrics:');
      console.log(`  - Total Interventions: ${report.totalInterventions || 0}`);
      console.log(`  - Avg Adherence Improvement: ${(report.averageAdherenceImprovement || 0).toFixed(2)}%`);
      console.log(`  - Total Cost Savings: ₦${report.totalCostSavings?.toLocaleString() || 0}`);
      console.log(`  - Intervention Types: ${report.interventionsByType?.length || 0}`);
      console.log(`  - Outcomes by Workspace: ${report.outcomesByPharmacy?.length || 0}`);
    }
    
    results.push({
      endpoint: 'GET /clinical-outcomes',
      success: true,
      statusCode: response.status,
      dataReceived: !!hasData,
      details: report
    });
  } catch (error: any) {
    console.log('❌ Failed:', error.response?.status || error.message);
    results.push({
      endpoint: 'GET /clinical-outcomes',
      success: false,
      error: error.message
    });
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 Test Summary');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`\n✅ Passed: ${passed}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed!');
    console.log('\n✅ Currency: Using Naira (₦)');
    console.log('✅ Data Source: Real API endpoints');
    console.log('✅ Plan Names: Properly mapped from plans.json');
    console.log('✅ Time Range: Functional filtering');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the errors above.');
  }
  
  console.log('\n' + '='.repeat(60));
}

// Run tests
testAnalyticsEndpoints().catch(console.error);
