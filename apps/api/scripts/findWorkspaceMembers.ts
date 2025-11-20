import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../src/models/User';

// Load environment variables
dotenv.config({ path: '.env' });

async function findWorkspaceMembers() {
    try {
        console.log('🔍 Finding workspace members for testing...\n');

        // Connect to MongoDB
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI not found in environment variables');
        }

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Find Anthony Obi's workspace
        const anthonyUser = await User.findOne({ email: 'megagigdev@gmail.com' }).lean();

        if (!anthonyUser) {
            console.log('❌ Anthony user not found');
            return;
        }

        console.log(`Anthony's workspace: ${anthonyUser.workplaceId}`);

        // Find all members in Anthony's workspace
        const workspaceMembers = await User.find({
            workplaceId: anthonyUser.workplaceId,
            status: 'active'
        }).lean();

        console.log(`\nFound ${workspaceMembers.length} active members in workspace:`);

        workspaceMembers.forEach((member, index) => {
            console.log(`${index + 1}. ${member.firstName} ${member.lastName} (${member.email})`);
            console.log(`   Role: ${member.workplaceRole}`);
            console.log(`   ID: ${member._id}`);
            console.log(`   Status: ${member.status}`);
            console.log('');
        });

        // Try to reset Anthony's password to something known
        console.log('🔄 Resetting Anthony\'s password to "Anthony@2024"...');
        const hashedPassword = await bcrypt.hash('Anthony@2024', 12);

        await User.updateOne(
            { email: 'megagigdev@gmail.com' },
            { passwordHash: hashedPassword }
        );

        console.log('✅ Password reset completed');

        // Test the updated password
        const updatedAnthony = await User.findOne({ email: 'megagigdev@gmail.com' });
        if (updatedAnthony) {
            const passwordMatch = await updatedAnthony.comparePassword('Anthony@2024');
            console.log(`Password verification: ${passwordMatch ? '✅ SUCCESS' : '❌ FAILED'}`);
        }

        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');

    } catch (error: any) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Run the check
findWorkspaceMembers().then(() => {
    console.log('\n🏁 Analysis completed');
    process.exit(0);
}).catch(console.error);