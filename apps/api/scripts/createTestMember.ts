import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../src/models/User';

// Load environment variables
dotenv.config({ path: '.env' });

async function createTestMember() {
    try {
        console.log('👤 Creating test member for role assignment testing...\n');

        // Connect to MongoDB
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI not found in environment variables');
        }

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Find Anthony's workspace
        const anthonyUser = await User.findOne({ email: 'megagigdev@gmail.com' }).lean();

        if (!anthonyUser) {
            console.log('❌ Anthony user not found');
            return;
        }

        const workspaceId = anthonyUser.workplaceId;
        console.log(`Using workspace: ${workspaceId}`);

        // Check if test member already exists
        const existingMember = await User.findOne({ email: 'test-member@example.com' });

        if (existingMember) {
            console.log('Test member already exists, updating...');
            await User.updateOne(
                { email: 'test-member@example.com' },
                {
                    workplaceId: workspaceId,
                    workplaceRole: 'Staff',
                    status: 'active'
                }
            );
        } else {
            console.log('Creating new test member...');
            const hashedPassword = await bcrypt.hash('TestMember123!', 12);

            await User.create({
                email: 'test-member@example.com',
                passwordHash: hashedPassword,
                firstName: 'Test',
                lastName: 'Member',
                role: 'pharmacist',
                workplaceId: workspaceId,
                workplaceRole: 'Staff',
                status: 'active',
                phoneNumber: '+1234567891',
                currentPlanId: new mongoose.Types.ObjectId('68b48f106901acc9cfac9737'),
                currentSubscriptionId: new mongoose.Types.ObjectId('68e6a12b28c7b8ae30ae722d')
            });
        }

        // Verify the member was created/updated
        const testMember = await User.findOne({ email: 'test-member@example.com' }).lean();

        console.log('\n✅ Test member setup complete!');
        console.log('Test Member Details:');
        console.log(`  Name: ${testMember?.firstName} ${testMember?.lastName}`);
        console.log(`  Email: ${testMember?.email}`);
        console.log(`  ID: ${testMember?._id}`);
        console.log(`  Role: ${testMember?.workplaceRole}`);
        console.log(`  Status: ${testMember?.status}`);
        console.log(`  Workspace: ${testMember?.workplaceId}`);

        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');

    } catch (error: any) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Run the setup
createTestMember().then(() => {
    console.log('\n🏁 Setup completed');
    process.exit(0);
}).catch(console.error);