/**
 * Test script for Billing & Subscriptions endpoints
 * Run with: npx ts-node backend/scripts/testBillingEndpoints.ts
 */

import axios from 'axios';

const API_BASE_URL = process.env.API_URL || 'http://localhost:5000';
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || '';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api/billing`,
  headers: {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

async function testBillingEndpoints() {
  console.log('🧪 Testing Billing & Subscriptions Endpoints\n');

  try {
    // Test 1: Get Billing Analytics
    console.log('1️⃣  Testing GET /api/billing/analytics');
    const analyticsRes = await api.get('/analytics');
    console.log('✅ Analytics:', {
      mrr: analyticsRes.data.data.monthlyRecurringRevenue,
      arr: analyticsRes.data.data.annualRecurringRevenue,
      churnRate: analyticsRes.data.data.churnRate
    });
    console.log('');

    // Test 2: Get Revenue Trends
    console.log('2️⃣  Testing GET /api/billing/revenue-trends');
    const trendsRes = await api.get('/revenue-trends?period=30d');
    console.log('✅ Revenue Trends:', {
      dataPoints: trendsRes.data.data.length,
      latestRevenue: trendsRes.data.data[trendsRes.data.data.length - 1]
    });
    console.log('');

    // Test 3: Get All Subscriptions
    console.log('3️⃣  Testing GET /api/billing/subscriptions');
    const subscriptionsRes = await api.get('/subscriptions?page=1&limit=10');
    console.log('✅ Subscriptions:', {
      total: subscriptionsRes.data.data.pagination.total,
      page: subscriptionsRes.data.data.pagination.page,
      subscriptions: subscriptionsRes.data.data.subscriptions.length
    });
    console.log('');

    // Test 4: Get All Invoices
    console.log('4️⃣  Testing GET /api/billing/invoices');
    const invoicesRes = await api.get('/invoices?page=1&limit=10');
    console.log('✅ Invoices:', {
      total: invoicesRes.data.data.pagination.total,
      page: invoicesRes.data.data.pagination.page,
      invoices: invoicesRes.data.data.invoices.length
    });
    console.log('');

    // Test 5: Get Payment Methods
    console.log('5️⃣  Testing GET /api/billing/payment-methods');
    const paymentMethodsRes = await api.get('/payment-methods');
    console.log('✅ Payment Methods:', {
      count: paymentMethodsRes.data.data.length
    });
    console.log('');

    // Test 6: Test Filtering
    console.log('6️⃣  Testing Subscription Filtering');
    const filteredRes = await api.get('/subscriptions?status=active&search=test');
    console.log('✅ Filtered Subscriptions:', {
      count: filteredRes.data.data.subscriptions.length
    });
    console.log('');

    console.log('✅ All tests passed successfully!');
  } catch (error: any) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Run tests
testBillingEndpoints();
