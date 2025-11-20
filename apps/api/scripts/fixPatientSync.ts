import mongoose from 'mongoose';
import dotenv from 'dotenv';
import PatientUser from '../src/models/PatientUser';
import Patient from '../src/models/Patient';
import { Workplace } from '../src/models/Workplace';
import { PatientSyncService } from '../src/services/patientSyncService';

// Load environment variables
dotenv.config();

async function fixPatientSync() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmacare');
    console.log('Connected to MongoDB');

    // Find all active PatientUsers without linked Patient records
    const unlinkedPatientUsers = await PatientUser.find({
      status: 'active',
      isActive: true,
      $or: [
        { patientId: { $exists: false } },
        { patientId: null },
        { patientId: undefined }
      ]
    });

    console.log(`\nFound ${unlinkedPatientUsers.length} active PatientUsers without linked Patient records`);

    if (unlinkedPatientUsers.length === 0) {
      console.log('✅ All active PatientUsers have linked Patient records');
      return;
    }

    console.log('\n=== Fixing Patient Record Links ===');

    for (const patientUser of unlinkedPatientUsers) {
      try {
        // Get workspace name
        const workspace = await Workplace.findById(patientUser.workplaceId);
        const workspaceName = workspace?.name || 'Unknown Workspace';

        console.log(`\nProcessing: ${patientUser.firstName} ${patientUser.lastName} (${patientUser._id})`);
        console.log(`  Email: ${patientUser.email}`);
        console.log(`  Workspace: ${workspaceName}`);

        const { patient, isNewRecord } = await PatientSyncService.createOrLinkPatientRecord(patientUser._id.toString());

        console.log(`  ✅ ${isNewRecord ? 'Created new' : 'Linked existing'} Patient record:`);
        console.log(`     Patient ID: ${patient._id}`);
        console.log(`     MRN: ${patient.mrn}`);
        console.log(`     Name: ${patient.firstName} ${patient.lastName}`);

      } catch (error) {
        console.error(`  ❌ Failed to fix PatientUser ${patientUser._id}:`, error.message);
      }
    }

    console.log('\n=== Fix Complete ===');

    // Verify the fix
    const stillUnlinked = await PatientUser.find({
      status: 'active',
      isActive: true,
      $or: [
        { patientId: { $exists: false } },
        { patientId: null },
        { patientId: undefined }
      ]
    });

    console.log(`\nRemaining unlinked PatientUsers: ${stillUnlinked.length}`);

    if (stillUnlinked.length === 0) {
      console.log('🎉 All active PatientUsers now have linked Patient records!');
    } else {
      console.log('⚠️  Some PatientUsers still need manual attention');
      stillUnlinked.forEach(user => {
        console.log(`  - ${user.firstName} ${user.lastName} (${user._id})`);
      });
    }

  } catch (error) {
    console.error('Fix failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the fix
fixPatientSync().catch(console.error);