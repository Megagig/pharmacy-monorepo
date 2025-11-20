import mongoose from 'mongoose';
import User from '../src/models/User';
import dotenv from 'dotenv';

dotenv.config();

async function inspectLicenseDocuments() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('Connected to MongoDB\n');

    // Find all pharmacist users
    const users = await User.find({
      role: { $in: ['pharmacist', 'intern_pharmacist', 'owner'] }
    }).lean(); // Use lean() to get raw MongoDB documents

    console.log(`Found ${users.length} pharmacist users\n`);

    for (const user of users) {
      console.log(`\n=== ${user.firstName} ${user.lastName} (${user.email}) ===`);
      console.log(`License Status: ${user.licenseStatus}`);
      console.log(`License Number: ${user.licenseNumber || 'Not set'}`);
      console.log(`Pharmacy School: ${user.pharmacySchool || 'Not set'}`);
      console.log(`License Document Type: ${typeof user.licenseDocument}`);
      console.log(`License Document Value:`, JSON.stringify(user.licenseDocument, null, 2));
      
      // Check if it's an empty object
      if (user.licenseDocument) {
        const keys = Object.keys(user.licenseDocument);
        console.log(`Document Keys: [${keys.join(', ')}]`);
        console.log(`Is Empty Object: ${keys.length === 0}`);
      }
    }

    // Now check what the admin query would return
    console.log('\n\n=== Testing Admin Query ===');
    const adminQuery = {
      licenseStatus: 'pending',
      licenseDocument: { $exists: true }
    };
    
    const adminResults = await User.find(adminQuery).lean();
    console.log(`Admin query found: ${adminResults.length} users`);
    
    adminResults.forEach(user => {
      console.log(`  - ${user.firstName} ${user.lastName}`);
      console.log(`    Has fileName: ${!!user.licenseDocument?.fileName}`);
      console.log(`    Has filePath: ${!!user.licenseDocument?.filePath}`);
    });

    // Check with more specific query
    console.log('\n\n=== Testing Query with fileName ===');
    const specificQuery = {
      licenseStatus: 'pending',
      'licenseDocument.fileName': { $exists: true }
    };
    
    const specificResults = await User.find(specificQuery).lean();
    console.log(`Query with fileName found: ${specificResults.length} users`);

    await mongoose.disconnect();
    console.log('\n\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

inspectLicenseDocuments();
