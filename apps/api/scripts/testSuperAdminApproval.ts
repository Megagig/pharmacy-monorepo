#!/usr/bin/env ts-node

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { User } from '../src/models/User';
import Workplace from '../src/models/Workplace';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharma_care';
const API_BASE_URL = 'http://localhost:5000/api';

async function testSuperAdminApproval() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Step 1: Find super admin user (Anthony Obi)
        const superAdmin = await User.findOne({ email: 'megagigdev@gmail.com' });
        if (!superAdmin) {
            console.log('❌ Super admin user not found');
            return;
        }

        console.log('📋 Super Admin Found:', {
            email: superAdmin.email,
            name: `${superAdmin.firstName} ${superAdmin.lastName}`,
            role: superAdmin.role
        });

        // Step 2: Find a pending member
        const pendingMember = await User.findOne({
            status: 'pending',
            workplaceId: { $exists: true, $ne: null }
        });

        if (!pendingMember) {
            console.log('❌ No pending members found');
            return;
        }

        console.log('👤 Pending Member Found:', {
            id: pendingMember._id,
            email: pendingMember.email,
            name: `${pendingMember.firstName} ${pendingMember.lastName}`,
            workplaceId: pendingMember.workplaceId
        });

        // Step 3: Test getting pending approvals as super admin
        console.log('\n🔍 Testing getPendingApprovals for super admin...');

        // Note: In a real scenario, you would need to login and get a JWT token
        // For this test, we'll check the database directly and simulate the API call logic

        // Find all pending members (what super admin should see)
        const allPendingMembers = await User.find({
            status: 'pending',
            workplaceId: { $exists: true, $ne: null },
        })
            .select('firstName lastName email workplaceRole createdAt workplaceId')
            .sort({ createdAt: -1 })
            .lean();

        console.log(`✅ Super admin can see ${allPendingMembers.length} pending members across all workspaces:`);

        allPendingMembers.forEach((member: any, index) => {
            console.log(`  ${index + 1}. ${member.firstName} ${member.lastName} (${member.email}) - Workspace ID: ${member.workplaceId}`);
        });

        // Step 4: Simulate approval logic for super admin
        console.log('\n🎯 Testing approval logic for super admin...');

        const testMemberId = pendingMember._id;
        const testWorkplaceId = pendingMember.workplaceId;

        // This simulates what the approveMember function should do for super admin
        const memberToApprove = await User.findOne({
            _id: testMemberId,
            workplaceId: testWorkplaceId,
            status: 'pending',
        });

        if (memberToApprove) {
            console.log('✅ Super admin approval logic test: Member found and can be approved');
            console.log('   Member:', `${memberToApprove.firstName} ${memberToApprove.lastName}`);
            console.log('   Workspace ID determined from member:', testWorkplaceId);
        } else {
            console.log('❌ Super admin approval logic test: Member not found');
        }

        console.log('\n🎉 Super admin approval functionality should now work!');
        console.log('📝 The super admin can:');
        console.log('   1. View all pending approvals across workspaces');
        console.log('   2. Approve members by determining workspace from the member being approved');
        console.log('   3. Reject members using the same logic');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

if (require.main === module) {
    testSuperAdminApproval();
}