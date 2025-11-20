#!/usr/bin/env ts-node

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { User } from '../src/models/User';
import { Workplace } from '../src/models/Workplace';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharma_care';
const API_BASE_URL = 'http://localhost:5000/api';

async function testApprovalAPIDirectly() {
    try {
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Step 1: Get the workspace owner credentials
        const workspaceOwner = await User.findOne({
            email: { $regex: /megagig.*@gmail\.com/ }
        });

        if (!workspaceOwner) {
            console.log('❌ No workspace owner found');
            return;
        }

        console.log(`📍 Workspace owner: ${workspaceOwner.email}`);
        console.log(`📍 Workspace owner ID: ${workspaceOwner._id}`);
        console.log(`📍 Workspace owner's workplace ID: ${workspaceOwner.workplaceId}`);

        // Step 2: Get the first pending member
        const workplace = await Workplace.findOne({ inviteCode: 'BN4QYW' });
        if (!workplace) {
            console.log('❌ MEGAGIGSOLUTION workplace not found');
            return;
        }

        const pendingMembers = await User.find({
            workplaceId: workplace._id,
            status: 'pending',
        })
            .select('firstName lastName email')
            .limit(1);

        if (pendingMembers.length === 0) {
            console.log('ℹ️  No pending members to test with');
            return;
        }

        const testMember = pendingMembers[0];
        console.log(`\n🧪 Testing approval for: ${testMember.firstName} ${testMember.lastName}`);
        console.log(`Member ID: ${testMember._id}`);

        // Step 3: First, try to login as the workspace owner to get authentication cookie
        console.log('\n🔐 Attempting to login as workspace owner...');

        const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: workspaceOwner.email,
                password: 'TestPassword123!' // This might not work, but let's try
            }),
        });

        if (!loginResponse.ok) {
            console.log('❌ Cannot login as workspace owner (expected - password might be wrong)');
            console.log('🔄 Let\'s test the middleware logic directly instead...');

            // Test the middleware logic by simulating what should happen
            console.log('\n🔍 Simulating middleware chain...');

            // Check if the owner can access their workspace
            const ownerWorkplaceMatch = workspaceOwner.workplaceId?.toString() === workplace._id.toString();
            console.log(`✅ Owner's workplace ID matches target: ${ownerWorkplaceMatch}`);

            if (ownerWorkplaceMatch) {
                console.log(`✅ Middleware should set workplaceId to: ${workplace._id}`);

                // Test the exact approval query that would be made
                const memberForApproval = await User.findOne({
                    _id: new mongoose.Types.ObjectId(testMember._id),
                    workplaceId: new mongoose.Types.ObjectId(workplace._id),
                    status: 'pending',
                });

                if (memberForApproval) {
                    console.log('✅ Member can be found for approval');
                    console.log('✅ The API call should work correctly');
                } else {
                    console.log('❌ Member cannot be found for approval - there\'s a data issue');
                }
            } else {
                console.log('❌ Owner\'s workplace ID does not match - middleware issue');
            }

            return;
        }

        // If login worked, extract cookies and try the approval
        const cookies = loginResponse.headers.get('set-cookie');
        if (!cookies) {
            console.log('❌ No cookies received from login');
            return;
        }

        console.log('✅ Login successful, attempting approval...');

        // Step 4: Try to approve the member
        const approvalResponse = await fetch(`${API_BASE_URL}/workspace/team/invites/${testMember._id}/approve`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': cookies,
            },
            body: JSON.stringify({}),
        });

        const approvalResult = await approvalResponse.json();

        console.log(`\n📊 Approval Result (Status ${approvalResponse.status}):`);
        console.log(JSON.stringify(approvalResult, null, 2));

        if (approvalResponse.ok) {
            console.log('✅ Approval successful!');
        } else {
            console.log('❌ Approval failed');
            if (approvalResult.message?.includes('Pending member not found')) {
                console.log('🔍 This is the exact error we\'re debugging');
            }
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

if (require.main === module) {
    testApprovalAPIDirectly();
}