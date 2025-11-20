import mongoose from 'mongoose';
import User from '../src/models/User';
import { Workplace } from '../src/models/Workplace';
import dotenv from 'dotenv';

dotenv.config();

async function investigateSpecificUser() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || '');
        console.log('Connected to MongoDB\n');

        // Check the specific user
        const user = await User.findOne({ email: 'megagigsoftwaresolutions@gmail.com' });

        if (user) {
            console.log('=== User Details ===');
            console.log(`Email: ${user.email}`);
            console.log(`Name: ${user.firstName} ${user.lastName}`);
            console.log(`Status: ${user.status}`);
            console.log(`Email Verified: ${user.emailVerified}`);
            console.log(`Workplace ID: ${user.workplaceId}`);
            console.log(`Workplace Role: ${user.workplaceRole}`);
            console.log(`Role: ${user.role}`);
            console.log(`Created At: ${user.createdAt}`);

            // Check MEGAGIGSOLUTION workspace details
            const megagigWorkspace = await Workplace.findOne({ inviteCode: 'BN4QYW' });

            if (megagigWorkspace) {
                console.log('\n=== MEGAGIGSOLUTION Workspace ===');
                console.log(`Workspace ID: ${megagigWorkspace._id}`);
                console.log(`Name: ${megagigWorkspace.name}`);
                console.log(`Invite Code: ${megagigWorkspace.inviteCode}`);
                console.log(`Owner ID: ${megagigWorkspace.ownerId}`);

                // Check if user should be assigned to this workspace
                if (!user.workplaceId) {
                    console.log('\n🚨 ISSUE FOUND: User has no workplaceId but registered with invite code BN4QYW!');
                    console.log('This user should be assigned to MEGAGIGSOLUTION workspace and be pending approval.');

                    console.log('\nFixing user assignment...');
                    user.workplaceId = megagigWorkspace._id;
                    user.workplaceRole = 'Staff'; // Default role for invite code users
                    user.role = 'pharmacy_team'; // Role should be pharmacy_team for workspace members
                    user.status = 'pending'; // Should be pending until approved
                    await user.save();

                    console.log('✅ User fixed:');
                    console.log(`   - Assigned to workspace: ${megagigWorkspace.name}`);
                    console.log(`   - Workplace Role: Staff`);
                    console.log(`   - Status: pending`);
                    console.log(`   - Role: pharmacy_team`);
                } else if (user.workplaceId.toString() === megagigWorkspace._id.toString()) {
                    console.log('\n✅ User is correctly assigned to MEGAGIGSOLUTION workspace');
                } else {
                    console.log('\n🚨 User is assigned to a different workspace!');
                }
            } else {
                console.log('\n❌ MEGAGIGSOLUTION workspace not found!');
            }
        } else {
            console.log('❌ User not found!');
        }

        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    } catch (error) {
        console.error('Error:', error);
        await mongoose.disconnect();
    }
}

investigateSpecificUser();