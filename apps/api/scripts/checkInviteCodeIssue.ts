import mongoose from 'mongoose';
import User from '../src/models/User';
import { Workplace } from '../src/models/Workplace';
import dotenv from 'dotenv';

dotenv.config();

async function checkInviteCodeUsers() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || '');
        console.log('Connected to MongoDB\n');

        // Check for users who might have registered with invite codes but aren't assigned properly
        console.log('=== Users with invite code issues ===');

        // Find users with null or undefined workplaceId but have workplaceRole
        const orphanedUsers = await User.find({
            $or: [
                { workplaceId: null, workplaceRole: { $exists: true } },
                { workplaceId: { $exists: false }, workplaceRole: { $exists: true } }
            ]
        }).select('firstName lastName email workplaceId workplaceRole status');

        console.log(`Found ${orphanedUsers.length} users with workplace role but no workplace:`, orphanedUsers);

        // Check specific user from screenshot
        const specificUser = await User.findOne({
            $or: [
                { email: 'wjmrj46amf@xkxkud.com' }, // From the screenshot
                { email: { $regex: /wjmrj46amf/i } }
            ]
        });

        if (specificUser) {
            console.log('\n=== Specific user from screenshot ===');
            console.log(`Email: ${specificUser.email}`);
            console.log(`Workplace ID: ${specificUser.workplaceId}`);
            console.log(`Workplace Role: ${specificUser.workplaceRole}`);
            console.log(`Status: ${specificUser.status}`);
            console.log(`Email Verified: ${specificUser.emailVerified}`);

            if (specificUser.workplaceId) {
                const workplace = await Workplace.findById(specificUser.workplaceId);
                console.log(`Workplace Name: ${workplace?.name || 'Not found'}`);
            }
        }

        // Check all workplaces and their invite codes
        console.log('\n=== Available Workplaces ===');
        const workplaces = await Workplace.find({}).select('name inviteCode ownerId');
        workplaces.forEach(wp => {
            console.log(`${wp.name}: Code=${wp.inviteCode}, Owner=${wp.ownerId}`);
        });

        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    } catch (error) {
        console.error('Error:', error);
        await mongoose.disconnect();
    }
}

checkInviteCodeUsers();