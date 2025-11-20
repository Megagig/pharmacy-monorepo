import mongoose from 'mongoose';
import User from '../src/models/User';
import dotenv from 'dotenv';

dotenv.config();

async function fixLicenseDocuments() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('Connected to MongoDB\n');

    // Find all users with licenseDocument but missing fileName
    const usersWithBrokenDocs = await User.find({
      licenseDocument: { $exists: true },
      'licenseDocument.fileName': { $exists: false }
    });

    console.log(`Found ${usersWithBrokenDocs.length} users with broken license documents\n`);

    if (usersWithBrokenDocs.length === 0) {
      console.log('No broken documents to fix!');
      await mongoose.disconnect();
      return;
    }

    for (const user of usersWithBrokenDocs) {
      console.log(`Fixing: ${user.firstName} ${user.lastName} (${user.email})`);
      console.log(`  License Number: ${user.licenseNumber || 'Not set'}`);
      console.log(`  Current licenseDocument:`, user.licenseDocument);

      // Remove the broken licenseDocument
      user.licenseDocument = undefined;
      
      // Reset license status if they haven't uploaded properly
      if (!user.licenseNumber) {
        user.licenseStatus = 'not_required';
      }

      await user.save();
      console.log(`  ✅ Fixed! Document removed, user can re-upload\n`);
    }

    console.log('\n=== Summary ===');
    console.log(`Fixed ${usersWithBrokenDocs.length} users`);
    console.log('\nUsers should now re-upload their licenses with the new form fields.');

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixLicenseDocuments();
