import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

async function testSecurityEndpoints() {
  try {
    console.log('Testing Security Settings Endpoints...\n');

    // You'll need to replace this with a valid super admin token
    const token = 'YOUR_SUPER_ADMIN_TOKEN_HERE';

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // Test 1: Get Security Settings
    console.log('1. Testing GET /admin/saas/security/settings');
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/saas/security/settings`, { headers });
      console.log('✅ Success:', response.data);
    } catch (error: any) {
      console.log('❌ Error:', error.response?.data || error.message);
    }

    console.log('\n---\n');

    // Test 2: Get Active Sessions
    console.log('2. Testing GET /admin/saas/security/sessions');
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/saas/security/sessions`, { headers });
      console.log('✅ Success:', response.data);
    } catch (error: any) {
      console.log('❌ Error:', error.response?.data || error.message);
    }

    console.log('\n---\n');

    // Test 3: Get Audit Logs
    console.log('3. Testing GET /admin/saas/security/audit-logs');
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/saas/security/audit-logs`, { headers });
      console.log('✅ Success:', response.data);
    } catch (error: any) {
      console.log('❌ Error:', error.response?.data || error.message);
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

testSecurityEndpoints();
