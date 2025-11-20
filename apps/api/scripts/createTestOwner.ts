import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../src/models/User';

// Load environment variables
dotenv.config({ path: '.env' });

async function createTestWorkspaceOwner() {
    try {
        console.log('🛠️ Creating test workspace owner for role assignment test...\n');

        // Connect to MongoDB
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI not found in environment variables');
        }

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Find an existing workspace with members
        const workspaceWithMembers = await User.findOne({
            workplaceId: { $exists: true, $ne: null },
            workplaceRole: 'Owner'
        }).lean();

        if (!workspaceWithMembers) {
            console.log('❌ No workspace with owner found');
            return;
        }

        console.log(`Found workspace: ${workspaceWithMembers.workplaceId}`);

        // Check if test user already exists
        const existingUser = await User.findOne({ email: 'test-owner@example.com' });

        if (existingUser) {
            console.log('Test user already exists, updating password...');
            const hashedPassword = await bcrypt.hash('TestPass123!', 12);
            await User.updateOne(
                { email: 'test-owner@example.com' },
                {
                    passwordHash: hashedPassword,
                    workplaceId: workspaceWithMembers.workplaceId,
                    workplaceRole: 'Owner',
                    status: 'active'
                }
            );
        } else {
            console.log('Creating new test user...');
            const hashedPassword = await bcrypt.hash('TestPass123!', 12);

            await User.create({
                email: 'test-owner@example.com',
                passwordHash: hashedPassword,
                firstName: 'Test',
                lastName: 'Owner',
                role: 'pharmacy_outlet',
                workplaceId: workspaceWithMembers.workplaceId,
                workplaceRole: 'Owner',
                status: 'active',
                phoneNumber: '+1234567890',
                currentPlanId: new mongoose.Types.ObjectId('68b48f106901acc9cfac9737'), // Default plan
                currentSubscriptionId: new mongoose.Types.ObjectId('68e6a12b28c7b8ae30ae722d') // Default subscription
            });
        }

        // Find a member to test role assignment with
        const testMember = await User.findOne({
            workplaceId: workspaceWithMembers.workplaceId,
            workplaceRole: { $ne: 'Owner' },
            status: 'active',
            email: { $ne: 'test-owner@example.com' }
        }).lean();

        console.log('\n✅ Test setup complete!');
        console.log('Test Credentials:');
        console.log('  Email: test-owner@example.com');
        console.log('  Password: TestPass123!');
        console.log(`  Workspace ID: ${workspaceWithMembers.workplaceId}`);

        if (testMember) {
            console.log('\nTest Member Available:');
            console.log(`  Name: ${testMember.firstName} ${testMember.lastName}`);
            console.log(`  Email: ${testMember.email}`);
            console.log(`  Current Role: ${testMember.workplaceRole}`);
            console.log(`  Member ID: ${testMember._id}`);
        } else {
            console.log('\n⚠️  No test member found in the workspace');
        }

        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');

    } catch (error: any) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Run the setup
createTestWorkspaceOwner().then(() => {
    console.log('\n🏁 Setup completed');
    process.exit(0);
}).catch(console.error);