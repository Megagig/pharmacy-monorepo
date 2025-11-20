import mongoose from 'mongoose';
import User from '../src/models/User';
import { Workplace } from '../src/models/Workplace';
import dotenv from 'dotenv';

dotenv.config();

async function verifyUserStatuses() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || '');
        console.log('Connected to MongoDB\n');

        console.log('=== Verification Summary ===\n');

        // Check workspace owners
        console.log('1. Workspace Owners (should be active):');
        const workspaces = await Workplace.find({}).populate('ownerId');
        for (const workspace of workspaces) {
            const owner = workspace.ownerId as any;
            if (owner) {
                console.log(`   ✅ ${owner.email} (${workspace.name}) - Status: ${owner.status}`);
                if (owner.status !== 'active' && owner.emailVerified) {
                    console.log(`   🚨 WARNING: Owner should be active!`);
                }
            }
        }

        // Check invite code users (non-owners with workplace)
        console.log('\n2. Invite Code Users (should be pending until approved):');
        const inviteUsers = await User.find({
            workplaceId: { $exists: true, $ne: null },
            workplaceRole: { $exists: true, $ne: null },
        });

        let inviteCount = 0;
        for (const user of inviteUsers) {
            const isOwner = await Workplace.findOne({
                _id: user.workplaceId,
                ownerId: user._id
            });

            if (!isOwner) {
                inviteCount++;
                const workplace = await Workplace.findById(user.workplaceId);
                const statusIcon = user.status === 'pending' ? '✅' : '🚨';
                console.log(`   ${statusIcon} ${user.email} (${workplace?.name}) - Status: ${user.status}, Role: ${user.workplaceRole}`);
            }
        }

        if (inviteCount === 0) {
            console.log('   (No invite code users found)');
        }

        // Check regular users
        console.log('\n3. Regular Users (should be active after email verification):');
        const regularUsers = await User.find({
            $or: [
                { workplaceId: null },
                { workplaceId: { $exists: false } }
            ]
        });

        for (const user of regularUsers) {
            if (user.role !== 'super_admin') {
                const statusIcon = user.emailVerified && user.status === 'active' ? '✅' :
                    !user.emailVerified && user.status === 'pending' ? '⏳' : '🚨';
                console.log(`   ${statusIcon} ${user.email} - Status: ${user.status}, Email Verified: ${user.emailVerified}`);
            }
        }

        console.log('\n=== Legend ===');
        console.log('✅ = Correct status');
        console.log('🚨 = Incorrect status');
        console.log('⏳ = Pending email verification (correct)');

        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    } catch (error) {
        console.error('Error:', error);
        await mongoose.disconnect();
    }
}

verifyUserStatuses();