#!/usr/bin/env ts-node

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../src/models/User';
import { Workplace } from '../src/models/Workplace';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharma_care';

async function debugWorkspaceOwnerMismatch() {
    try {
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Step 1: Find the MEGAGIGSOLUTION workplace
        const workplace = await Workplace.findOne({ inviteCode: 'BN4QYW' });
        if (!workplace) {
            console.log('❌ MEGAGIGSOLUTION workplace not found');
            return;
        }

        console.log('📍 MEGAGIGSOLUTION Workplace:');
        console.log(`   ID: ${workplace._id}`);
        console.log(`   Name: ${workplace.name}`);
        console.log(`   Owner ID: ${workplace.ownerId}`);
        console.log(`   Team Members: ${workplace.teamMembers.length}`);

        // Step 2: Find the actual owner of this workplace
        const actualOwner = await User.findById(workplace.ownerId);
        if (actualOwner) {
            console.log('\n👤 Actual Workplace Owner:');
            console.log(`   Name: ${actualOwner.firstName} ${actualOwner.lastName}`);
            console.log(`   Email: ${actualOwner.email}`);
            console.log(`   ID: ${actualOwner._id}`);
            console.log(`   Workplace ID: ${actualOwner.workplaceId}`);
            console.log(`   Workplace Role: ${actualOwner.workplaceRole}`);
            console.log(`   Status: ${actualOwner.status}`);
        } else {
            console.log('\n❌ Actual workplace owner not found!');
        }

        // Step 3: Find all users who think they are owners
        const allOwners = await User.find({
            workplaceRole: 'Owner'
        }).select('firstName lastName email _id workplaceId status');

        console.log('\n👥 All Users with Owner role:');
        allOwners.forEach((owner, index) => {
            const isCorrectOwner = owner._id.toString() === workplace.ownerId?.toString();
            const isInCorrectWorkplace = owner.workplaceId?.toString() === workplace._id.toString();

            console.log(`${index + 1}. ${owner.firstName} ${owner.lastName} (${owner.email})`);
            console.log(`   ID: ${owner._id}`);
            console.log(`   Workplace ID: ${owner.workplaceId}`);
            console.log(`   Status: ${owner.status}`);
            console.log(`   Is Correct Owner: ${isCorrectOwner ? '✅' : '❌'}`);
            console.log(`   In Correct Workplace: ${isInCorrectWorkplace ? '✅' : '❌'}`);
            console.log('');
        });

        // Step 4: Check pending members and their relationship to the workplace
        const pendingMembers = await User.find({
            workplaceId: workplace._id,
            status: 'pending',
        }).select('firstName lastName email _id workplaceId');

        console.log('📋 Pending Members in MEGAGIGSOLUTION:');
        pendingMembers.forEach((member, index) => {
            const isInCorrectWorkplace = member.workplaceId?.toString() === workplace._id.toString();

            console.log(`${index + 1}. ${member.firstName} ${member.lastName} (${member.email})`);
            console.log(`   ID: ${member._id}`);
            console.log(`   Workplace ID: ${member.workplaceId}`);
            console.log(`   In Correct Workplace: ${isInCorrectWorkplace ? '✅' : '❌'}`);
            console.log('');
        });

        // Step 5: Test the approval scenario step by step
        if (actualOwner && pendingMembers.length > 0) {
            console.log('🔍 Testing Approval Scenario:');
            const testMember = pendingMembers[0];

            console.log(`\n📝 Scenario: ${actualOwner.firstName} tries to approve ${testMember.firstName}`);

            // Step 5a: Check if the owner can access their workspace (authWithWorkspace check)
            const ownerCanAccessWorkspace = actualOwner.workplaceId?.toString() === workplace._id.toString();
            console.log(`1. Owner can access workspace: ${ownerCanAccessWorkspace ? '✅' : '❌'}`);

            // Step 5b: Check if the owner IS the workspace owner (requireWorkspaceOwner check)
            const ownerIsWorkspaceOwner = actualOwner._id.toString() === workplace.ownerId?.toString();
            console.log(`2. Owner is workspace owner: ${ownerIsWorkspaceOwner ? '✅' : '❌'}`);

            // Step 5c: Check if the pending member can be found (approveMember logic)
            const memberCanBeFound = await User.findOne({
                _id: testMember._id,
                workplaceId: workplace._id,
                status: 'pending',
            });
            console.log(`3. Member can be found for approval: ${memberCanBeFound ? '✅' : '❌'}`);

            if (ownerCanAccessWorkspace && ownerIsWorkspaceOwner && memberCanBeFound) {
                console.log('\n✅ All checks pass - approval should work!');
            } else {
                console.log('\n❌ Some checks failed - this explains the approval error');
            }
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

if (require.main === module) {
    debugWorkspaceOwnerMismatch();
}