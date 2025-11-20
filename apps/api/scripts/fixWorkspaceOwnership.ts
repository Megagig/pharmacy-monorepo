#!/usr/bin/env ts-node

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../src/models/User';
import { Workplace } from '../src/models/Workplace';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharma_care';

async function fixWorkspaceOwnership() {
    try {
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Option 1: Transfer ownership from megagigsolution@gmail.com to megagigdev@gmail.com
        console.log('🔄 Transferring MEGAGIGSOLUTION ownership to megagigdev@gmail.com...');

        const currentOwner = await User.findOne({ email: 'megagigsolution@gmail.com' });
        const newOwner = await User.findOne({ email: 'megagigdev@gmail.com' });
        const workspace = await Workplace.findOne({ inviteCode: 'BN4QYW' });

        if (!currentOwner || !newOwner || !workspace) {
            console.log('❌ Could not find required users or workspace');
            return;
        }

        console.log('📍 Current State:');
        console.log(`   Workspace: ${workspace.name} (${workspace._id})`);
        console.log(`   Current Owner: ${currentOwner.firstName} ${currentOwner.lastName} (${currentOwner.email})`);
        console.log(`   New Owner: ${newOwner.firstName} ${newOwner.lastName} (${newOwner.email})`);

        // Step 1: Update the workspace owner
        workspace.ownerId = newOwner._id;
        await workspace.save();

        // Step 2: Update the current owner to be a regular member
        currentOwner.workplaceId = workspace._id;
        currentOwner.workplaceRole = 'Staff'; // or whatever role is appropriate
        await currentOwner.save();

        // Step 3: Update the new owner's workplace assignment
        newOwner.workplaceId = workspace._id;
        newOwner.workplaceRole = 'Owner';
        await newOwner.save();

        // Step 4: Ensure new owner is in the team members list
        if (!workspace.teamMembers.includes(newOwner._id)) {
            workspace.teamMembers.push(newOwner._id);
        }

        // Ensure old owner is still in team members
        if (!workspace.teamMembers.includes(currentOwner._id)) {
            workspace.teamMembers.push(currentOwner._id);
        }

        await workspace.save();

        console.log('\n✅ Ownership Transfer Complete!');
        console.log(`   New workspace owner: ${newOwner.email}`);
        console.log(`   Previous owner now has role: ${currentOwner.workplaceRole}`);
        console.log(`   Team members count: ${workspace.teamMembers.length}`);

        // Step 5: Verify the change
        const updatedWorkspace = await Workplace.findById(workspace._id);
        const updatedNewOwner = await User.findById(newOwner._id);
        const updatedOldOwner = await User.findById(currentOwner._id);

        console.log('\n📊 Verification:');
        console.log(`   Workspace owner ID: ${updatedWorkspace?.ownerId}`);
        console.log(`   New owner's workplace ID: ${updatedNewOwner?.workplaceId}`);
        console.log(`   New owner's role: ${updatedNewOwner?.workplaceRole}`);
        console.log(`   Old owner's workplace ID: ${updatedOldOwner?.workplaceId}`);
        console.log(`   Old owner's role: ${updatedOldOwner?.workplaceRole}`);

        // Step 6: Test if approval would now work
        const pendingMember = await User.findOne({
            workplaceId: workspace._id,
            status: 'pending',
        });

        if (pendingMember) {
            console.log('\n🧪 Testing Approval Logic:');
            console.log(`   Pending member: ${pendingMember.firstName} ${pendingMember.lastName}`);

            // Simulate the approval checks
            const ownerCanAccess = updatedNewOwner?.workplaceId?.toString() === workspace._id.toString();
            const ownerIsOwner = updatedNewOwner?._id.toString() === updatedWorkspace?.ownerId?.toString();
            const memberExists = await User.findOne({
                _id: pendingMember._id,
                workplaceId: workspace._id,
                status: 'pending',
            });

            console.log(`   1. Owner can access workspace: ${ownerCanAccess ? '✅' : '❌'}`);
            console.log(`   2. Owner is workspace owner: ${ownerIsOwner ? '✅' : '❌'}`);
            console.log(`   3. Member can be found: ${memberExists ? '✅' : '❌'}`);

            if (ownerCanAccess && ownerIsOwner && memberExists) {
                console.log('\n🎉 Approval should now work! The user can approve pending members.');
            } else {
                console.log('\n❌ There are still issues with the approval logic.');
            }
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

if (require.main === module) {
    fixWorkspaceOwnership();
}