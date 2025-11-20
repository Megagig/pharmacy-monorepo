/**
 * Script to link existing PatientUsers to Patient records
 * Run this to fix PatientUsers that don't have linked Patient records
 */

import mongoose from 'mongoose';
import PatientUser from '../models/PatientUser';
import { PatientSyncService } from '../services/patientSyncService';
import logger from '../utils/logger';

async function linkExistingPatientUsers() {
  try {
    console.log('🔗 Starting Patient linking process...');

    // Find all active PatientUsers without linked Patient records
    const unlinkedUsers = await PatientUser.find({
      status: 'active',
      isActive: true,
      patientId: { $exists: false },
      isDeleted: false,
    }).select('_id firstName lastName email workplaceId');

    console.log(`📊 Found ${unlinkedUsers.length} unlinked PatientUsers`);

    if (unlinkedUsers.length === 0) {
      console.log('✅ All PatientUsers are already linked to Patient records');
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const patientUser of unlinkedUsers) {
      try {
        console.log(`🔄 Processing: ${patientUser.firstName} ${patientUser.lastName} (${patientUser.email})`);
        
        const { patient, isNewRecord } = await PatientSyncService.createOrLinkPatientRecord(patientUser._id.toString());
        
        console.log(`✅ ${isNewRecord ? 'Created new' : 'Linked existing'} Patient record ${patient._id} for PatientUser ${patientUser._id}`);
        successCount++;
        
        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Error processing PatientUser ${patientUser._id}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📈 Linking Summary:');
    console.log(`✅ Successfully linked: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total processed: ${unlinkedUsers.length}`);

    if (successCount > 0) {
      console.log('\n🎉 Patient linking completed! PatientUsers can now access health records.');
    }

  } catch (error) {
    console.error('💥 Fatal error in linking process:', error);
    throw error;
  }
}

// Export for use in other scripts or manual execution
export { linkExistingPatientUsers };

// Allow direct execution
if (require.main === module) {
  // Connect to MongoDB if not already connected
  if (mongoose.connection.readyState === 0) {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharma-care';
    mongoose.connect(mongoUri)
      .then(() => {
        console.log('📡 Connected to MongoDB');
        return linkExistingPatientUsers();
      })
      .then(() => {
        console.log('🏁 Script completed successfully');
        process.exit(0);
      })
      .catch((error) => {
        console.error('💥 Script failed:', error);
        process.exit(1);
      });
  } else {
    linkExistingPatientUsers()
      .then(() => {
        console.log('🏁 Script completed successfully');
      })
      .catch((error) => {
        console.error('💥 Script failed:', error);
      });
  }
}