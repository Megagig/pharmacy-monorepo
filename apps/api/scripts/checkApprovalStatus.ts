import mongoose from 'mongoose';
import User from '../src/models/User';
import dotenv from 'dotenv';

dotenv.config();

async function checkApprovalStatus() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('Connected to MongoDB\n');

    // Check Megagig Solution's license status
    const user = await User.findOne({ email: 'megagigsolution@gmail.com' });

    if (!user) {
      console.log('User not found!');
      await mongoose.disconnect();
      return;
    }

    console.log('=== Megagig Solution License Status ===');
    console.log(`Email: ${user.email}`);
    console.log(`License Status: ${user.licenseStatus}`);
    console.log(`License Number: ${user.licenseNumber}`);
    console.log(`User Status: ${user.status}`);
    console.log(`License Verified At: ${user.licenseVerifiedAt || 'Not verified'}`);
    console.log(`License Verified By: ${user.licenseVerifiedBy || 'Not set'}`);
    console.log(`Has Document: ${!!user.licenseDocument}`);

    if (user.licenseStatus === 'approved') {
      console.log('\n✅ License is APPROVED in database!');
      console.log('User should have access to protected modules.');
      console.log('\nIf modal still shows "pending", user needs to:');
      console.log('1. Logout');
      console.log('2. Login again');
      console.log('3. Try accessing Clinical Notes');
    } else {
      console.log(`\n❌ License is still ${user.licenseStatus.toUpperCase()}`);
      console.log('Approval did not work. Check backend logs for errors.');
    }

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkApprovalStatus();
