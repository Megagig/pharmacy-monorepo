import mongoose from 'mongoose';
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env' });

const API_BASE_URL = 'http://localhost:5000/api';

interface LoginResponse {
    success: boolean;
    data: {
        token: string;
        user: {
            _id: string;
            email: string;
            role: string;
            workplaceId?: string;
        };
    };
}

interface Member {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    workplaceRole: string;
    status: string;
}

interface MembersResponse {
    success: boolean;
    data: {
        members: Member[];
    };
}

interface UpdateRoleResponse {
    success: boolean;
    message: string;
    member: Member;
    audit: {
        oldRole: string;
        newRole: string;
        reason?: string;
        updatedBy: string;
        updatedAt: string;
    };
}

async function testUpdateMemberRole() {
    try {
        console.log('🧪 Testing Update Member Role API...\n');

        // Step 1: Login as super admin (Anthony Obi)
        console.log('1. Logging in as super admin...');
        const loginResponse = await axios.post<LoginResponse>(`${API_BASE_URL}/auth/login`, {
            email: 'megagigdev@gmail.com',
            password: 'Anthony@2024'
        });

        if (!loginResponse.data.success) {
            throw new Error('Login failed');
        }

        const token = loginResponse.data.data.token;
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        console.log('✅ Login successful');
        console.log(`User: ${loginResponse.data.data.user.email}`);
        console.log(`Role: ${loginResponse.data.data.user.role}`);
        console.log(`WorkplaceId: ${loginResponse.data.data.user.workplaceId}`);

        // Step 2: Get team members to find a test member
        console.log('\n2. Fetching team members...');
        const membersResponse = await axios.get<MembersResponse>(`${API_BASE_URL}/workspace/team/members`, {
            headers
        });

        if (!membersResponse.data.success) {
            throw new Error('Failed to fetch members');
        }

        const members = membersResponse.data.data.members;
        console.log(`✅ Found ${members.length} members`);

        // Find an active member that's not the owner
        const testMember = members.find(member =>
            member.status === 'active' &&
            member.workplaceRole !== 'Owner' &&
            member.email !== 'megagigdev@gmail.com'
        );

        if (!testMember) {
            console.log('❌ No suitable test member found (need an active non-owner member)');
            return;
        }

        console.log(`📋 Test member: ${testMember.firstName} ${testMember.lastName} (${testMember.email})`);
        console.log(`   Current role: ${testMember.workplaceRole}`);

        // Step 3: Update member role
        const newRole = testMember.workplaceRole === 'Staff' ? 'Pharmacist' : 'Staff';
        console.log(`\n3. Updating member role to: ${newRole}`);

        const updateData = {
            workplaceRole: newRole,
            reason: 'Testing role update functionality'
        };

        console.log(`🔄 Making PUT request to: ${API_BASE_URL}/workspace/team/members/${testMember._id}`);
        console.log(`   Data:`, updateData);
        console.log(`   Headers:`, { 'Authorization': headers.Authorization.substring(0, 20) + '...' });

        const updateResponse = await axios.put<UpdateRoleResponse>(
            `${API_BASE_URL}/workspace/team/members/${testMember._id}`,
            updateData,
            { headers }
        );

        if (updateResponse.data.success) {
            console.log('✅ Role update successful!');
            console.log(`   Previous role: ${updateResponse.data.audit.oldRole}`);
            console.log(`   New role: ${updateResponse.data.audit.newRole}`);
            console.log(`   Updated member:`, {
                name: `${updateResponse.data.member.firstName} ${updateResponse.data.member.lastName}`,
                email: updateResponse.data.member.email,
                role: updateResponse.data.member.workplaceRole
            });
        } else {
            console.log('❌ Role update failed:', updateResponse.data.message);
        }

    } catch (error: any) {
        console.error('❌ Test failed:', error.message);

        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Response:', error.response.data);
        }

        if (error.config) {
            console.error('   Request URL:', error.config.url);
            console.error('   Request Method:', error.config.method?.toUpperCase());
            console.error('   Request Data:', error.config.data);
        }
    }
}

// Run the test
testUpdateMemberRole().then(() => {
    console.log('\n🏁 Test completed');
    process.exit(0);
}).catch(console.error);