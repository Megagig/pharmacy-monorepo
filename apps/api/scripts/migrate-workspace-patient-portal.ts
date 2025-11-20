/**
 * Migration Script: Enable Patient Portal for Existing Workspaces
 * 
 * This script ensures all existing verified workspaces have the patientPortalEnabled field
 * set to true by default. This is needed for workspaces created before the patient portal
 * feature was added.
 * 
 * Usage: npx ts-node scripts/migrate-workspace-patient-portal.ts
 */

import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import { Workplace } from '../src/models/Workplace';
import logger from '../src/utils/logger';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

async function migrateWorkspacePatientPortal() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI not found in environment variables');
    }

    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Find workspaces that don't have patientPortalEnabled field set
    console.log('🔍 Checking workspaces for patient portal field...');

    const workspacesNeedingUpdate = await Workplace.find({
      $or: [
        { patientPortalEnabled: { $exists: false } },
        { patientPortalEnabled: null },
      ],
      verificationStatus: 'verified',
      isDeleted: false,
    });

    console.log(`📊 Found ${workspacesNeedingUpdate.length} workspaces needing update\n`);

    if (workspacesNeedingUpdate.length === 0) {
      console.log('✅ All workspaces already have patient portal field configured');
      return;
    }

    // Update workspaces to enable patient portal by default
    const updateResult = await Workplace.updateMany(
      {
        $or: [
          { patientPortalEnabled: { $exists: false } },
          { patientPortalEnabled: null },
        ],
        verificationStatus: 'verified',
        isDeleted: false,
      },
      {
        $set: {
          patientPortalEnabled: true,
          'patientPortalSettings.allowSelfRegistration': true,
          'patientPortalSettings.requireApproval': true,
          'patientPortalSettings.enableMessaging': true,
          'patientPortalSettings.enableAppointments': true,
          'patientPortalSettings.enableRefillRequests': true,
        },
      }
    );

    console.log('📝 Migration Results:');
    console.log(`   ✅ Matched: ${updateResult.matchedCount} workspaces`);
    console.log(`   ✅ Modified: ${updateResult.modifiedCount} workspaces`);

    // Log the updated workspaces
    logger.info('Patient portal migration completed', {
      matchedCount: updateResult.matchedCount,
      modifiedCount: updateResult.modifiedCount,
    });

    // Verify the updates
    const verifiedCount = await Workplace.countDocuments({
      patientPortalEnabled: true,
      verificationStatus: 'verified',
      isDeleted: false,
    });

    console.log(`\n✅ Verification: ${verifiedCount} workspaces now have patient portal enabled`);
    console.log('✅ Migration completed successfully!');

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    logger.error('Patient portal migration failed', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  } finally {
    // Close database connection
    await mongoose.disconnect();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the migration
if (require.main === module) {
  migrateWorkspacePatientPortal()
    .then(() => {
      console.log('\n🎉 Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Migration script failed:', error);
      process.exit(1);
    });
}

export default migrateWorkspacePatientPortal;
