#!/usr/bin/env ts-node

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../src/models/User';
import { Workplace } from '../src/models/Workplace';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharma_care';

async function debugPendingMemberApproval() {
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

        console.log('📍 Workplace Info:');
        console.log({
            id: workplace._id,
            name: workplace.name,
            teamMembers: workplace.teamMembers.length
        });

        // Step 2: Get all pending members in this workspace (what the frontend sees)
        const pendingMembers = await User.find({
            workplaceId: workplace._id,
            status: 'pending',
        })
            .select('_id firstName lastName email workplaceRole createdAt')
            .sort({ createdAt: -1 })
            .lean();

        console.log('\n📋 Pending Members (what frontend sees):');
        console.log(`Found ${pendingMembers.length} pending members:`);

        pendingMembers.forEach((member, index) => {
            console.log(`${index + 1}. ${member.firstName} ${member.lastName} (${member.email})`);
            console.log(`   ID: ${member._id}`);
            console.log(`   Workplace ID: ${member.workplaceId}`);
            console.log(`   Role: ${member.workplaceRole}`);
            console.log(`   Created: ${member.createdAt}`);
            console.log('');
        });

        // Step 3: For each pending member, test if they can be found by the approval logic
        console.log('🔍 Testing Approval Logic for Each Member:');
        console.log('='.repeat(60));

        for (const pendingMember of pendingMembers) {
            console.log(`\n📝 Testing member: ${pendingMember.firstName} ${pendingMember.lastName}`);
            console.log(`   Frontend ID: ${pendingMember._id}`);

            // This is exactly what the approveMember function does
            const foundForApproval = await User.findOne({
                _id: new mongoose.Types.ObjectId(pendingMember._id),
                workplaceId: new mongoose.Types.ObjectId(workplace._id),
                status: 'pending',
            });

            if (foundForApproval) {
                console.log('   ✅ Member CAN be approved (found by approval logic)');
                console.log(`   Approval ID: ${foundForApproval._id}`);
                console.log(`   Approval Workplace ID: ${foundForApproval.workplaceId}`);
                console.log(`   Approval Status: ${foundForApproval.status}`);
            } else {
                console.log('   ❌ Member CANNOT be approved (NOT found by approval logic)');
                console.log('   🔍 Let\'s check why...');

                // Debug: Check if user exists at all
                const userExists = await User.findById(pendingMember._id);
                if (!userExists) {
                    console.log('   💥 User does not exist in database!');
                } else {
                    console.log(`   ✅ User exists with status: ${userExists.status}`);
                    console.log(`   ✅ User workplace ID: ${userExists.workplaceId}`);
                    console.log(`   ✅ Expected workplace ID: ${workplace._id}`);
                    console.log(`   🔍 Workplace ID match: ${userExists.workplaceId?.toString() === workplace._id.toString()}`);
                }
            }
        }

        // Step 4: Check if there are any recent test users we created
        console.log('\n🧪 Recent Test Users:');
        const recentTestUsers = await User.find({
            email: { $regex: /test.*@example\.com/ }
        })
            .select('_id firstName lastName email status workplaceId workplaceRole createdAt')
            .sort({ createdAt: -1 })
            .limit(5);

        recentTestUsers.forEach((user, index) => {
            console.log(`${index + 1}. ${user.firstName} ${user.lastName} (${user.email})`);
            console.log(`   ID: ${user._id}`);
            console.log(`   Status: ${user.status}`);
            console.log(`   Workplace ID: ${user.workplaceId}`);
            console.log(`   Role: ${user.workplaceRole}`);
            console.log(`   Created: ${user.createdAt}`);
            console.log('');
        });

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

if (require.main === module) {
    debugPendingMemberApproval();
}