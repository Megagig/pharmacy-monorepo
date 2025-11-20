import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

async function testWorkspaceLicenseApproval() {
    try {
        console.log('🧪 Testing Workspace License Approval...\n');

        // Step 1: Login as workspace owner (Anthony Obi)
        console.log('1. Logging in as workspace owner...');
        const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
            email: 'megagigdev@gmail.com',
            password: 'Anthony@2024'
        });

        if (!loginResponse.data.success) {
            throw new Error('Login failed');
        }

        const token = loginResponse.data.user?.token;

        // Extract token from cookies if not in response
        const cookieHeader = loginResponse.headers['set-cookie'];
        let authToken = '';
        if (cookieHeader) {
            const tokenCookie = cookieHeader.find(cookie => cookie.startsWith('token='));
            if (tokenCookie) {
                authToken = tokenCookie.split('=')[1].split(';')[0];
            }
        }

        const headers = {
            'Cookie': `token=${authToken}`,
            'Content-Type': 'application/json'
        };

        console.log('✅ Login successful');
        console.log(`User: ${loginResponse.data.user.email}`);
        console.log(`Role: ${loginResponse.data.user.role}`);

        // Step 2: Get pending license approvals
        console.log('\n2. Fetching pending license approvals...');
        const pendingResponse = await axios.get(`${API_BASE_URL}/workspace/team/licenses/pending`, {
            headers,
            withCredentials: true
        });

        if (pendingResponse.data.success) {
            const pendingLicenses = pendingResponse.data.data.pendingLicenses;
            console.log(`✅ Found ${pendingLicenses.length} pending license(s)`);

            pendingLicenses.forEach((license: any, index: number) => {
                console.log(`   ${index + 1}. ${license.firstName} ${license.lastName} (${license.email})`);
                console.log(`      License: ${license.licenseNumber}`);
                console.log(`      Role: ${license.workplaceRole}`);
                console.log(`      Status: ${license.licenseStatus}`);
                console.log(`      ID: ${license._id}`);
            });

            // Step 3: Test approving a license (if any pending)
            if (pendingLicenses.length > 0) {
                const firstPending = pendingLicenses[0];
                console.log(`\n3. Approving license for ${firstPending.firstName} ${firstPending.lastName}...`);

                const approveResponse = await axios.post(
                    `${API_BASE_URL}/workspace/team/licenses/${firstPending._id}/approve`,
                    {
                        reason: 'Valid license document and credentials verified'
                    },
                    { headers, withCredentials: true }
                );

                if (approveResponse.data.success) {
                    console.log('✅ License approved successfully!');
                    console.log(`   Member: ${approveResponse.data.data.member.firstName} ${approveResponse.data.data.member.lastName}`);
                    console.log(`   Status: ${approveResponse.data.data.member.licenseStatus}`);
                    console.log(`   Verified at: ${approveResponse.data.data.member.licenseVerifiedAt}`);
                } else {
                    console.log('❌ License approval failed:', approveResponse.data.message);
                }
            } else {
                console.log('\n⚠️  No pending licenses to approve');
            }
        } else {
            console.log('❌ Failed to fetch pending licenses:', pendingResponse.data.message);
        }

    } catch (error: any) {
        console.error('❌ Test failed:', error.message);

        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Response:', error.response.data);
        }
    }
}

// Run the test
testWorkspaceLicenseApproval().then(() => {
    console.log('\n🏁 Test completed');
    process.exit(0);
}).catch(console.error);