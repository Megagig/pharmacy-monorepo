import connectDB from '../src/config/db';
import User from '../src/models/User';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function changeUserPassword() {
    try {
        // Get command line arguments
        const args = process.argv.slice(2);

        if (args.length < 2) {
            console.log('❌ Usage: npm run change-password <email> <new-password>');
            console.log('Example: npm run change-password user@example.com NewPassword123!');
            process.exit(1);
        }

        const email = args[0];
        const newPassword = args[1];

        // Basic validation
        if (!email || !email.includes('@')) {
            console.log('❌ Invalid email address');
            process.exit(1);
        }

        if (!newPassword || newPassword.length < 6) {
            console.log('❌ Password must be at least 6 characters long');
            process.exit(1);
        }

        await connectDB();
        console.log('✅ Connected to database');

        // Find the user
        const user = await User.findOne({ email });

        if (!user) {
            console.log(`❌ User with email ${email} not found`);
            process.exit(1);
        }

        console.log('📋 Current user details:');
        console.log('- Email:', user.email);
        console.log('- First Name:', user.firstName);
        console.log('- Last Name:', user.lastName);
        console.log('- Role:', user.role);
        console.log('- Status:', user.status);
        console.log('- Workplace ID:', user.workplaceId || 'None');

        // Update the password (plain text, pre-save hook will hash it)
        console.log('\n🔐 Changing password...');
        user.passwordHash = newPassword;
        await user.save();

        console.log('✅ Password changed successfully!');

        // Verify the new password works
        console.log('🔍 Verifying new password...');
        const passwordValid = await user.comparePassword(newPassword);
        console.log('Password verification:', passwordValid ? '✅ SUCCESS' : '❌ FAILED');

        if (passwordValid) {
            console.log('\n🎉 Password change completed successfully!');
            console.log(`User: ${email}`);
            console.log(`New password is now active.`);
        } else {
            console.log('\n⚠️  Password change may have issues - verification failed');
        }

    } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

changeUserPassword();