require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
}

// User schema (simplified for migration)
const userSchema = new mongoose.Schema({
  email: String,
  firstName: String,
  lastName: String,
  licenseDocument: {
    fileName: String,
    filePath: String,
    cloudinaryUrl: String,
    cloudinaryPublicId: String,
    uploadedAt: Date,
    fileSize: Number,
    mimeType: String,
    uploadMethod: {
      type: String,
      enum: ['cloudinary', 'local', 'both'],
      default: 'local'
    }
  },
  licenseStatus: String,
  licenseNumber: String
});

const User = mongoose.model('User', userSchema);

async function migrateLicenseDocuments() {
  console.log('🔄 Starting license document migration...\n');

  try {
    // Find users with license documents that need migration
    const usersWithLicenses = await User.find({
      'licenseDocument.filePath': { $exists: true },
      'licenseDocument.uploadMethod': { $in: ['local', null, undefined] }
    });

    console.log(`📊 Found ${usersWithLicenses.length} users with license documents to check\n`);

    let migratedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (const user of usersWithLicenses) {
      console.log(`👤 Processing: ${user.firstName} ${user.lastName} (${user.email})`);
      
      if (!user.licenseDocument || !user.licenseDocument.filePath) {
        console.log('   ⏭️ Skipped - No license document path');
        skippedCount++;
        continue;
      }

      const filePath = user.licenseDocument.filePath;
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.log('   ⚠️ Warning - File not found:', filePath);
        // Update to mark as missing
        user.licenseDocument.uploadMethod = 'local';
        await user.save();
        errorCount++;
        continue;
      }

      // File exists - ensure uploadMethod is set correctly
      if (!user.licenseDocument.uploadMethod) {
        user.licenseDocument.uploadMethod = 'local';
        await user.save();
        console.log('   ✅ Updated uploadMethod to "local"');
        migratedCount++;
      } else {
        console.log('   ✅ Already has uploadMethod:', user.licenseDocument.uploadMethod);
        skippedCount++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   • Migrated: ${migratedCount}`);
    console.log(`   • Skipped: ${skippedCount}`);
    console.log(`   • Errors: ${errorCount}`);
    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

async function validateLicenseSystem() {
  console.log('\n🔍 Validating license system...\n');

  try {
    // Check users with different upload methods
    const stats = await User.aggregate([
      {
        $match: {
          'licenseDocument': { $exists: true }
        }
      },
      {
        $group: {
          _id: '$licenseDocument.uploadMethod',
          count: { $sum: 1 }
        }
      }
    ]);

    console.log('📊 License Document Storage Methods:');
    stats.forEach(stat => {
      console.log(`   • ${stat._id || 'undefined'}: ${stat.count} documents`);
    });

    // Check for users who need licenses but don't have them
    const usersNeedingLicenses = await User.find({
      role: { $in: ['pharmacist', 'intern_pharmacist', 'owner'] },
      $or: [
        { licenseDocument: { $exists: false } },
        { licenseDocument: null },
        { licenseStatus: 'not_required' }
      ]
    }).select('firstName lastName email role licenseStatus');

    console.log(`\n👥 Users who may need to upload licenses: ${usersNeedingLicenses.length}`);
    
    if (usersNeedingLicenses.length > 0 && usersNeedingLicenses.length <= 10) {
      usersNeedingLicenses.forEach(user => {
        console.log(`   • ${user.firstName} ${user.lastName} (${user.role}) - Status: ${user.licenseStatus}`);
      });
    }

  } catch (error) {
    console.error('❌ Validation failed:', error);
  }
}

async function main() {
  await connectDB();
  await migrateLicenseDocuments();
  await validateLicenseSystem();
  
  console.log('\n🎉 All operations completed!');
  console.log('\n📋 Next Steps:');
  console.log('   1. Test license upload with a new document');
  console.log('   2. Verify existing documents are accessible');
  console.log('   3. Check admin panel for license reviews');
  
  await mongoose.disconnect();
  console.log('\n✅ Disconnected from MongoDB');
}

main().catch(console.error);