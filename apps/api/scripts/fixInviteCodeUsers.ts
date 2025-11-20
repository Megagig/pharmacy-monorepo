import mongoose from 'mongoose';
import User from '../src/models/User';
import dotenv from 'dotenv';

dotenv.config();

async function fixInviteCodeUsers() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || '');
        console.log('Connected to MongoDB\n');

        // Find users who have workplaceId and workplaceRole but are currently active
        // These should be pending until workspace owner approves them
        const usersToFix = await User.find({
            workplaceId: { $exists: true, $ne: null },
            workplaceRole: { $exists: true, $ne: null },
            status: 'active',
            emailVerified: true
        });

        console.log(`Found ${usersToFix.length} users who need to be set to pending status:`);

        for (const user of usersToFix) {
            console.log(`- ${user.email} (${user.firstName} ${user.lastName}) - Workplace: ${user.workplaceId}, Role: ${user.workplaceRole}`);
        }

        if (usersToFix.length > 0) {
            console.log('\nUpdating users to pending status...');

            const result = await User.updateMany(
                {
                    workplaceId: { $exists: true, $ne: null },
                    workplaceRole: { $exists: true, $ne: null },
                    status: 'active',
                    emailVerified: true
                },
                {
                    $set: { status: 'pending' }
                }
            );

            console.log(`✅ Updated ${result.modifiedCount} users to pending status`);
            console.log('\nThese users will now need to be approved by their workspace owners to login.');
        } else {
            console.log('✅ No users need to be fixed - all invite code users are already in correct status.');
        }

        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    } catch (error) {
        console.error('Error:', error);
        await mongoose.disconnect();
    }
}

fixInviteCodeUsers();