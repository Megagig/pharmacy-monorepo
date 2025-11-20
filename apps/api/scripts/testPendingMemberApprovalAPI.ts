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

async function testPendingMemberApprovalAPI() {
    try {
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Step 1: Get a test user from the workspace owner to get auth token
        const workspaceOwner = await User.findOne({
            email: { $regex: /megagig.*@gmail\.com/ }
        });

        if (!workspaceOwner) {
            console.log('❌ No workspace owner found for authentication');
            return;
        }

        console.log(`📍 Testing with workspace owner: ${workspaceOwner.email}`);

        // Step 2: Get pending members via API call
        console.log('\n📋 Testing GET /api/workspace/team/invites/pending');

        // We'll simulate the request that would normally be made with authentication
        // For testing, let's check directly from database first
        const workplace = await Workplace.findOne({ inviteCode: 'BN4QYW' });
        if (!workplace) {
            console.log('❌ MEGAGIGSOLUTION workplace not found');
            return;
        }

        const pendingMembers = await User.find({
            workplaceId: workplace._id,
            status: 'pending',
        })
            .select('firstName lastName email workplaceRole createdAt')
            .sort({ createdAt: -1 })
            .lean();

        console.log(`Found ${pendingMembers.length} pending members to test approval with:`);
        pendingMembers.forEach((member, index) => {
            console.log(`${index + 1}. ${member.firstName} ${member.lastName} (ID: ${member._id})`);
        });

        if (pendingMembers.length === 0) {
            console.log('ℹ️  No pending members to test approval with');
            return;
        }

        // Step 3: Test approval for the first pending member
        const testMember = pendingMembers[0];
        console.log(`\n🧪 Testing approval for: ${testMember.firstName} ${testMember.lastName}`);
        console.log(`Member ID: ${testMember._id}`);

        // Step 4: Test the exact same logic as the backend controller
        console.log('\n🔍 Simulating backend approval logic...');

        const memberForApproval = await User.findOne({
            _id: new mongoose.Types.ObjectId(testMember._id),
            workplaceId: new mongoose.Types.ObjectId(workplace._id),
            status: 'pending',
        });

        if (!memberForApproval) {
            console.log('❌ FAILURE: Member not found by approval logic');
            console.log('This is exactly the error the frontend is seeing!');

            // Let's debug why
            const memberById = await User.findById(testMember._id);
            if (memberById) {
                console.log('\n🔍 Debug info for member:');
                console.log(`Status: ${memberById.status}`);
                console.log(`Workplace ID: ${memberById.workplaceId}`);
                console.log(`Expected Workplace ID: ${workplace._id}`);
                console.log(`Workplace ID match: ${memberById.workplaceId?.toString() === workplace._id.toString()}`);
            }
        } else {
            console.log('✅ SUCCESS: Member found by approval logic');
            console.log(`Member can be approved: ${memberForApproval.firstName} ${memberForApproval.lastName}`);
        }

        // Step 5: If found, try to simulate the actual approval update
        if (memberForApproval) {
            console.log('\n🔄 Simulating approval update...');

            // Don't actually update, just test what would happen
            console.log(`Would update status from '${memberForApproval.status}' to 'active'`);
            console.log(`Current role: ${memberForApproval.workplaceRole}`);
            console.log(`Member would be approved successfully`);
        }

        // Step 6: Check if there's any middleware or auth issue by checking the actual routes
        console.log('\n🔍 Checking workspace middleware setup...');

        // This is what the middleware should be setting
        console.log(`Workspace ID that should be set by middleware: ${workplace._id}`);
        console.log(`Pending member's workplace ID: ${testMember.workplaceId || 'undefined'}`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

if (require.main === module) {
    testPendingMemberApprovalAPI();
}