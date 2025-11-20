import mongoose from 'mongoose';
import Patient from '../../src/models/Patient';

/**
 * Migration script to enhance existing Patient documents with new patient portal fields
 * This script adds the new fields with appropriate default values
 */

interface MigrationResult {
  success: boolean;
  patientsUpdated: number;
  errors: string[];
}

export async function enhancePatientProfile(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    patientsUpdated: 0,
    errors: [],
  };

  try {
    console.log('Starting Patient profile enhancement migration...');

    // Find all patients that don't have the new fields
    const patientsToUpdate = await Patient.find({
      $or: [
        { allergies: { $exists: false } },
        { chronicConditions: { $exists: false } },
        { enhancedEmergencyContacts: { $exists: false } },
        { insuranceInfo: { $exists: false } },
        { patientLoggedVitals: { $exists: false } },
      ],
    }).select('_id firstName lastName');

    console.log(`Found ${patientsToUpdate.length} patients to update`);

    if (patientsToUpdate.length === 0) {
      console.log('No patients need updating');
      result.success = true;
      return result;
    }

    // Update patients in batches to avoid memory issues
    const batchSize = 100;
    let updatedCount = 0;

    for (let i = 0; i < patientsToUpdate.length; i += batchSize) {
      const batch = patientsToUpdate.slice(i, i + batchSize);
      const patientIds = batch.map(p => p._id);

      try {
        // Use updateMany for better performance
        const updateResult = await Patient.updateMany(
          { _id: { $in: patientIds } },
          {
            $set: {
              // Initialize new arrays as empty if they don't exist
              allergies: [],
              chronicConditions: [],
              enhancedEmergencyContacts: [],
              patientLoggedVitals: [],

              // Initialize insurance info as empty object if it doesn't exist
              insuranceInfo: {
                isActive: false,

              },
            },
            $setOnInsert: {
              // These fields will only be set if the document is being inserted (shouldn't happen in this migration)
              createdAt: new Date(),
            },
          },
          {
            upsert: false, // Don't create new documents
          }
        );

        updatedCount += updateResult.modifiedCount;
        console.log(`Updated batch ${Math.floor(i / batchSize) + 1}: ${updateResult.modifiedCount} patients`);

      } catch (batchError) {
        const errorMsg = `Error updating batch starting at index ${i}: ${batchError}`;
        console.error(errorMsg);
        result.errors.push(errorMsg);
      }
    }

    // Verify the migration by checking a few updated patients
    const verificationSample = await Patient.findOne({
      allergies: { $exists: true },
      chronicConditions: { $exists: true },
      enhancedEmergencyContacts: { $exists: true },
      insuranceInfo: { $exists: true },
      patientLoggedVitals: { $exists: true },
    });

    if (!verificationSample) {
      result.errors.push('Verification failed: Could not find any updated patients');
    } else {
      console.log('Verification successful: Found updated patient with new fields');
    }

    result.patientsUpdated = updatedCount;
    result.success = result.errors.length === 0;

    console.log(`Migration completed. Updated ${updatedCount} patients.`);
    if (result.errors.length > 0) {
      console.error('Migration completed with errors:', result.errors);
    }

  } catch (error) {
    const errorMsg = `Migration failed with error: ${error}`;
    console.error(errorMsg);
    result.errors.push(errorMsg);
    result.success = false;
  }

  return result;
}

/**
 * Rollback function to remove the new fields (use with caution)
 */
export async function rollbackPatientProfileEnhancement(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    patientsUpdated: 0,
    errors: [],
  };

  try {
    console.log('Starting Patient profile enhancement rollback...');
    console.warn('WARNING: This will remove all patient portal data including allergies, conditions, and vitals!');

    // Find patients with the new fields
    const patientsToRollback = await Patient.find({
      $or: [
        { allergies: { $exists: true } },
        { chronicConditions: { $exists: true } },
        { enhancedEmergencyContacts: { $exists: true } },
        { insuranceInfo: { $exists: true } },
        { patientLoggedVitals: { $exists: true } },
      ],
    }).select('_id');

    console.log(`Found ${patientsToRollback.length} patients to rollback`);

    if (patientsToRollback.length === 0) {
      console.log('No patients need rollback');
      result.success = true;
      return result;
    }

    // Remove the new fields
    const rollbackResult = await Patient.updateMany(
      { _id: { $in: patientsToRollback.map(p => p._id) } },
      {
        $unset: {
          allergies: '',
          chronicConditions: '',
          enhancedEmergencyContacts: '',
          insuranceInfo: '',
          patientLoggedVitals: '',
        },
      }
    );

    result.patientsUpdated = rollbackResult.modifiedCount;
    result.success = true;

    console.log(`Rollback completed. Removed new fields from ${rollbackResult.modifiedCount} patients.`);

  } catch (error) {
    const errorMsg = `Rollback failed with error: ${error}`;
    console.error(errorMsg);
    result.errors.push(errorMsg);
    result.success = false;
  }

  return result;
}

/**
 * Function to create indexes for the new fields
 */
export async function createPatientPortalIndexes(): Promise<void> {
  try {
    console.log('Creating indexes for patient portal fields...');

    const indexes: Record<string, 1 | -1>[] = [
      { 'allergies.allergen': 1 },
      { 'allergies.severity': 1 },
      { 'chronicConditions.condition': 1 },
      { 'chronicConditions.status': 1 },
      { 'enhancedEmergencyContacts.isPrimary': 1 },
      { 'insuranceInfo.provider': 1 },
      { 'insuranceInfo.isActive': 1 },
      { 'patientLoggedVitals.recordedDate': -1 },
      { 'patientLoggedVitals.isVerified': 1 },
    ];

    for (const index of indexes) {
      await Patient.collection.createIndex(index);
      console.log(`Created index: ${JSON.stringify(index)}`);
    }

    console.log('All patient portal indexes created successfully');

  } catch (error) {
    console.error('Error creating indexes:', error);
    throw error;
  }
}

// CLI execution
if (require.main === module) {
  const command = process.argv[2];

  // Connect to MongoDB
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmacare';

  mongoose.connect(mongoUri)
    .then(async () => {
      console.log('Connected to MongoDB');

      switch (command) {
        case 'migrate':
          await enhancePatientProfile();
          break;
        case 'rollback':
          await rollbackPatientProfileEnhancement();
          break;
        case 'indexes':
          await createPatientPortalIndexes();
          break;
        case 'all':
          await enhancePatientProfile();
          await createPatientPortalIndexes();
          break;
        default:
          console.log('Usage: ts-node enhance-patient-profile.ts [migrate|rollback|indexes|all]');
          console.log('  migrate  - Add new patient portal fields to existing patients');
          console.log('  rollback - Remove patient portal fields (WARNING: Data loss!)');
          console.log('  indexes  - Create indexes for patient portal fields');
          console.log('  all      - Run migration and create indexes');
      }

      await mongoose.disconnect();
      console.log('Disconnected from MongoDB');
      process.exit(0);

    })
    .catch((error) => {
      console.error('Failed to connect to MongoDB:', error);
      process.exit(1);
    });
}

export default {
  enhancePatientProfile,
  rollbackPatientProfileEnhancement,
  createPatientPortalIndexes,
};