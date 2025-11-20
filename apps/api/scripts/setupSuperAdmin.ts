import connectDB from '../src/config/db';
import User from '../src/models/User';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function checkAndUpdateUser() {
  try {
    await connectDB();
    console.log('Connected to database');

    // Find the user
    const user = await User.findOne({ email: 'megagigdev@gmail.com' });

    if (!user) {
      console.log('User not found');
      return;
    }

    console.log('Current user details:');
    console.log('- Email:', user.email);
    console.log('- First Name:', user.firstName);
    console.log('- Last Name:', user.lastName);
    console.log('- Role:', user.role);
    console.log('- Status:', user.status);
    console.log('- WorkplaceId:', user.workplaceId);

    // Update user to super_admin if not already
    if (user.role !== 'super_admin') {
      console.log('\nUpdating user role to super_admin...');
      user.role = 'super_admin';
      await user.save();
      console.log('✅ User role updated to super_admin');
    } else {
      console.log('✅ User already has super_admin role');
    }

    // Ensure user is active
    if (user.status !== 'active') {
      console.log('Setting user status to active...');
      user.status = 'active';
      await user.save();
      console.log('✅ User status updated to active');
    } else {
      console.log('✅ User is already active');
    }

    console.log('\n✅ User setup complete');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkAndUpdateUser();
