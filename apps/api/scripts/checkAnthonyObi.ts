import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/User';

// Load environment variables
dotenv.config({ path: '.env' });

async function checkAnthonyObi() {
    try {
        console.log('🔍 Checking Anthony Obi user...\n');

        // Connect to MongoDB
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI not found in environment variables');
        }

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Find Anthony Obi
        const anthonyUser = await User.findOne({ email: 'megagigdev@gmail.com' }).lean();

        if (anthonyUser) {
            console.log('Anthony Obi user found:');
            console.log({
                id: anthonyUser._id,
                email: anthonyUser.email,
                firstName: anthonyUser.firstName,
                lastName: anthonyUser.lastName,
                role: anthonyUser.role,
                status: anthonyUser.status,
                workplaceId: anthonyUser.workplaceId,
                workplaceRole: anthonyUser.workplaceRole,
                createdAt: anthonyUser.createdAt
            });
        } else {
            console.log('❌ Anthony Obi user not found');

            // Check for any super admin users
            const superAdmins = await User.find({ role: 'super_admin' }).lean();
            console.log(`\nFound ${superAdmins.length} super admin users:`);
            superAdmins.forEach(user => {
                console.log(`- ${user.email} (${user.firstName} ${user.lastName})`);
            });
        }

        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');

    } catch (error: any) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Run the check
checkAnthonyObi().then(() => {
    console.log('\n🏁 Check completed');
    process.exit(0);
}).catch(console.error);