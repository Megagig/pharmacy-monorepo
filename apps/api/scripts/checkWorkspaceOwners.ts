import mongoose from 'mongoose';
import User from '../src/models/User';
import { Workplace } from '../src/models/Workplace';
import dotenv from 'dotenv';

dotenv.config();

async function checkWorkspaceOwners() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || '');
        console.log('Connected to MongoDB\n');

        console.log('=== Checking if we accidentally blocked workspace owners ===\n');

        // Get all users we just updated
        const pendingUsers = await User.find({
            workplaceId: { $exists: true, $ne: null },
            workplaceRole: { $exists: true, $ne: null },
            status: 'pending',
            emailVerified: true
        });

        for (const user of pendingUsers) {
            // Check if this user is the owner of their workplace
            const workplace = await Workplace.findOne({
                _id: user.workplaceId,
                ownerId: user._id
            });

            if (workplace) {
                console.log(`🚨 WARNING: ${user.email} is the OWNER of "${workplace.name}" but was set to pending!`);
                console.log(`   This user should be active, not pending.`);

                // Fix this user - owners should be active
                user.status = 'active';
                await user.save();
                console.log(`   ✅ Fixed: Set ${user.email} back to active status\n`);
            } else {
                console.log(`✅ CORRECT: ${user.email} is NOT a workspace owner - should remain pending`);
            }
        }

        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    } catch (error) {
        console.error('Error:', error);
        await mongoose.disconnect();
    }
}

checkWorkspaceOwners();