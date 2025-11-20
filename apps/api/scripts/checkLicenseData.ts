import mongoose from 'mongoose';
import User from '../src/models/User';
import dotenv from 'dotenv';

dotenv.config();

async function checkLicenseData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('Connected to MongoDB');

    // Find all users with pharmacist-related roles
    const users = await User.find({
      role: { $in: ['pharmacist', 'intern_pharmacist', 'owner'] }
    }).select('email firstName lastName role licenseStatus licenseNumber licenseDocument pharmacySchool yearOfGraduation');

    console.log('\n=== All Pharmacist Users ===');
    console.log(`Found ${users.length} users\n`);

    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.firstName} ${user.lastName} (${user.email})`);
      console.log(`   Role: ${user.role}`);
      console.log(`   License Status: ${user.licenseStatus}`);
      console.log(`   License Number: ${user.licenseNumber || 'Not set'}`);
      console.log(`   Pharmacy School: ${user.pharmacySchool || 'Not set'}`);
      console.log(`   Year of Graduation: ${user.yearOfGraduation || 'Not set'}`);
      console.log(`   Has Document: ${user.licenseDocument ? 'YES' : 'NO'}`);
      if (user.licenseDocument) {
        console.log(`   Document File: ${user.licenseDocument.fileName}`);
        console.log(`   Uploaded At: ${user.licenseDocument.uploadedAt}`);
      }
      console.log('');
    });

    // Check specifically for pending licenses with documents
    const pendingWithDocs = await User.find({
      licenseStatus: 'pending',
      licenseDocument: { $exists: true }
    }).select('email firstName lastName licenseNumber licenseDocument');

    console.log('\n=== Pending Licenses with Documents ===');
    console.log(`Found ${pendingWithDocs.length} pending licenses\n`);

    pendingWithDocs.forEach((user, index) => {
      console.log(`${index + 1}. ${user.firstName} ${user.lastName} (${user.email})`);
      console.log(`   License Number: ${user.licenseNumber}`);
      console.log(`   Document: ${user.licenseDocument?.fileName}`);
      console.log('');
    });

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkLicenseData();
