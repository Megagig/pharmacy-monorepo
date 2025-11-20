/**
 * Rollback Script: Patient Engagement & Follow-up Management Module
 * 
 * This script rolls back the Patient Engagement module migration by:
 * 1. Removing migrated Appointment records
 * 2. Clearing appointmentId from MTRFollowUp records
 * 3. Removing new fields from existing models
 * 4. Dropping indexes for new models
 * 
 * ⚠️  WARNING: This script will permanently delete data. Use with caution!
 * 
 * Run with: npx ts-node backend/scripts/rollbackPatientEngagementMigration.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import readline from 'readline';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmacycopilot';

interface RollbackStats {
  appointmentsDeleted: number;
  mtrFollowUpsUpdated: number;
  patientsUpdated: number;
  visitsUpdated: number;
  indexesDropped: number;
  errors: string[];
}

async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    throw error;
  }
}

async function loadModels(): Promise<void> {
  // Import existing models
  require('../src/models/Patient');
  require('../src/models/Visit');
  require('../src/models/MTRFollowUp');
  
  // Import new models if they exist
  try {
    require('../src/models/Appointment');
    require('../src/models/FollowUpTask');
    require('../src/models/ReminderTemplate');
    require('../src/models/PharmacistSchedule');
  } catch (error) {
    console.warn('⚠️  Some new models not found. This is expected if they were not created yet.');
  }
}

/**
 * Prompt user for confirmation
 */
async function confirmRollback(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    console.log('\n⚠️  WARNING: This will permanently delete migrated data!');
    console.log('This rollback will:');
    console.log('  - Delete all migrated Appointment records');
    console.log('  - Remove appointmentId from MTRFollowUp records');
    console.log('  - Remove appointmentPreferences from Patient records');
    console.log('  - Remove appointmentId from Visit records');
    console.log('  - Drop indexes for new models');
    console.log('');
    
    rl.question('Are you sure you want to proceed? Type "ROLLBACK" to confirm: ', (answer) => {
      rl.close();
      resolve(answer === 'ROLLBACK');
    });
  });
}

/**
 * Remove migrated Appointment records
 */
async function removeMigratedAppointments(): Promise<{ deleted: number; errors: string[] }> {
  console.log('\n📋 Removing migrated Appointment records...');
  
  const errors: string[] = [];
  
  try {
    const Appointment = mongoose.model('Appointment');
    
    // Find appointments created from MTR migration
    const migratedAppointments = await Appointment.find({
      'metadata.source': 'mtr_migration'
    }).countDocuments();
    
    console.log(`Found ${migratedAppointments} migrated appointments to delete`);
    
    if (migratedAppointments === 0) {
      console.log('✅ No migrated appointments to delete');
      return { deleted: 0, errors: [] };
    }
    
    // Delete migrated appointments
    const result = await Appointment.deleteMany({
      'metadata.source': 'mtr_migration'
    });
    
    console.log(`✅ Deleted ${result.deletedCount} migrated appointments`);
    
    return { deleted: result.deletedCount, errors };
    
  } catch (error: any) {
    const errorMsg = `Failed to delete appointments: ${error.message}`;
    console.error(`❌ ${errorMsg}`);
    errors.push(errorMsg);
    return { deleted: 0, errors };
  }
}

/**
 * Remove appointmentId from MTRFollowUp records
 */
async function clearMTRFollowUpAppointmentIds(): Promise<{ updated: number; errors: string[] }> {
  console.log('\n📋 Clearing appointmentId from MTRFollowUp records...');
  
  const errors: string[] = [];
  
  try {
    const MTRFollowUp = mongoose.model('MTRFollowUp');
    
    // Find MTRFollowUp records with appointmentId
    const mtrWithAppointmentId = await MTRFollowUp.find({
      appointmentId: { $exists: true }
    }).countDocuments();
    
    console.log(`Found ${mtrWithAppointmentId} MTRFollowUp records with appointmentId`);
    
    if (mtrWithAppointmentId === 0) {
      console.log('✅ No MTRFollowUp records to update');
      return { updated: 0, errors: [] };
    }
    
    // Remove appointmentId and migratedAt fields
    const result = await MTRFollowUp.updateMany(
      { appointmentId: { $exists: true } },
      {
        $unset: {
          appointmentId: 1,
          migratedAt: 1
        }
      }
    );
    
    console.log(`✅ Updated ${result.modifiedCount} MTRFollowUp records`);
    
    return { updated: result.modifiedCount, errors };
    
  } catch (error: any) {
    const errorMsg = `Failed to update MTRFollowUp records: ${error.message}`;
    console.error(`❌ ${errorMsg}`);
    errors.push(errorMsg);
    return { updated: 0, errors };
  }
}

/**
 * Remove appointmentPreferences from Patient records
 */
async function removePatientAppointmentPreferences(): Promise<{ updated: number; errors: string[] }> {
  console.log('\n📋 Removing appointmentPreferences from Patient records...');
  
  const errors: string[] = [];
  
  try {
    const Patient = mongoose.model('Patient');
    
    // Find patients with appointmentPreferences
    const patientsWithPreferences = await Patient.find({
      appointmentPreferences: { $exists: true }
    }).countDocuments();
    
    console.log(`Found ${patientsWithPreferences} patients with appointmentPreferences`);
    
    if (patientsWithPreferences === 0) {
      console.log('✅ No patients to update');
      return { updated: 0, errors: [] };
    }
    
    // Remove appointmentPreferences and lastAppointmentDate fields
    const result = await Patient.updateMany(
      { appointmentPreferences: { $exists: true } },
      {
        $unset: {
          appointmentPreferences: 1,
          lastAppointmentDate: 1
        }
      }
    );
    
    console.log(`✅ Updated ${result.modifiedCount} patient records`);
    
    return { updated: result.modifiedCount, errors };
    
  } catch (error: any) {
    const errorMsg = `Failed to update Patient records: ${error.message}`;
    console.error(`❌ ${errorMsg}`);
    errors.push(errorMsg);
    return { updated: 0, errors };
  }
}

/**
 * Remove appointmentId from Visit records
 */
async function removeVisitAppointmentId(): Promise<{ updated: number; errors: string[] }> {
  console.log('\n📋 Removing appointmentId from Visit records...');
  
  const errors: string[] = [];
  
  try {
    const Visit = mongoose.model('Visit');
    
    // Find visits with appointmentId field
    const visitsWithAppointmentId = await Visit.find({
      appointmentId: { $exists: true }
    }).countDocuments();
    
    console.log(`Found ${visitsWithAppointmentId} visits with appointmentId field`);
    
    if (visitsWithAppointmentId === 0) {
      console.log('✅ No visits to update');
      return { updated: 0, errors: [] };
    }
    
    // Remove appointmentId field
    const result = await Visit.updateMany(
      { appointmentId: { $exists: true } },
      {
        $unset: {
          appointmentId: 1
        }
      }
    );
    
    console.log(`✅ Updated ${result.modifiedCount} visit records`);
    
    return { updated: result.modifiedCount, errors };
    
  } catch (error: any) {
    const errorMsg = `Failed to update Visit records: ${error.message}`;
    console.error(`❌ ${errorMsg}`);
    errors.push(errorMsg);
    return { updated: 0, errors };
  }
}

/**
 * Drop indexes for new models
 */
async function dropNewModelIndexes(): Promise<{ dropped: number; errors: string[] }> {
  console.log('\n📋 Dropping indexes for new models...');
  
  const errors: string[] = [];
  let dropped = 0;
  
  const collections = ['appointments', 'followuptasks', 'remindertemplates', 'pharmacistschedules'];
  
  for (const collectionName of collections) {
    try {
      const collection = mongoose.connection.db?.collection(collectionName);
      
      if (collection) {
        // Check if collection exists
        const collectionExists = await mongoose.connection.db?.listCollections({ name: collectionName }).hasNext();
        
        if (collectionExists) {
          // Drop all indexes except _id
          await collection.dropIndexes();
          dropped++;
          console.log(`  ✅ Dropped indexes for ${collectionName}`);
        } else {
          console.log(`  ⏭️  Collection ${collectionName} does not exist`);
        }
      }
    } catch (error: any) {
      const errorMsg = `Failed to drop indexes for ${collectionName}: ${error.message}`;
      console.error(`  ❌ ${errorMsg}`);
      errors.push(errorMsg);
    }
  }
  
  console.log(`✅ Dropped indexes for ${dropped} collections`);
  
  return { dropped, errors };
}

/**
 * Drop new model collections entirely (optional)
 */
async function dropNewModelCollections(): Promise<{ dropped: number; errors: string[] }> {
  console.log('\n📋 Dropping new model collections...');
  
  const errors: string[] = [];
  let dropped = 0;
  
  const collections = ['appointments', 'followuptasks', 'remindertemplates', 'pharmacistschedules'];
  
  for (const collectionName of collections) {
    try {
      const collection = mongoose.connection.db?.collection(collectionName);
      
      if (collection) {
        // Check if collection exists
        const collectionExists = await mongoose.connection.db?.listCollections({ name: collectionName }).hasNext();
        
        if (collectionExists) {
          // Drop the entire collection
          await collection.drop();
          dropped++;
          console.log(`  ✅ Dropped collection ${collectionName}`);
        } else {
          console.log(`  ⏭️  Collection ${collectionName} does not exist`);
        }
      }
    } catch (error: any) {
      const errorMsg = `Failed to drop collection ${collectionName}: ${error.message}`;
      console.error(`  ❌ ${errorMsg}`);
      errors.push(errorMsg);
    }
  }
  
  console.log(`✅ Dropped ${dropped} collections`);
  
  return { dropped, errors };
}

/**
 * Verify rollback completion
 */
async function verifyRollback(): Promise<void> {
  console.log('\n🔍 Verifying rollback completion...');
  
  try {
    const MTRFollowUp = mongoose.model('MTRFollowUp');
    const Patient = mongoose.model('Patient');
    const Visit = mongoose.model('Visit');
    
    // Check MTRFollowUp records
    const mtrWithAppointmentId = await MTRFollowUp.countDocuments({
      appointmentId: { $exists: true }
    });
    
    // Check Patient records
    const patientsWithPreferences = await Patient.countDocuments({
      appointmentPreferences: { $exists: true }
    });
    
    // Check Visit records
    const visitsWithAppointmentId = await Visit.countDocuments({
      appointmentId: { $exists: true }
    });
    
    console.log(`\nRollback Verification:`);
    console.log(`  - MTRFollowUp records with appointmentId: ${mtrWithAppointmentId}`);
    console.log(`  - Patients with appointmentPreferences: ${patientsWithPreferences}`);
    console.log(`  - Visits with appointmentId: ${visitsWithAppointmentId}`);
    
    // Check if new collections exist
    const collections = await mongoose.connection.db?.listCollections().toArray();
    const newCollections = collections?.filter(col => 
      ['appointments', 'followuptasks', 'remindertemplates', 'pharmacistschedules'].includes(col.name)
    );
    
    console.log(`  - Remaining new collections: ${newCollections?.length || 0}`);
    if (newCollections && newCollections.length > 0) {
      newCollections.forEach(col => {
        console.log(`    - ${col.name}`);
      });
    }
    
    // Determine rollback success
    const rollbackComplete = (
      mtrWithAppointmentId === 0 &&
      patientsWithPreferences === 0 &&
      visitsWithAppointmentId === 0
    );
    
    if (rollbackComplete) {
      console.log(`\n✅ Rollback completed successfully!`);
    } else {
      console.log(`\n⚠️  Rollback may be incomplete. Please review the results above.`);
    }
    
  } catch (error: any) {
    console.error(`❌ Verification failed: ${error.message}`);
  }
}

/**
 * Main rollback function
 */
async function runRollback(): Promise<void> {
  const stats: RollbackStats = {
    appointmentsDeleted: 0,
    mtrFollowUpsUpdated: 0,
    patientsUpdated: 0,
    visitsUpdated: 0,
    indexesDropped: 0,
    errors: []
  };
  
  try {
    console.log('🔄 Starting Patient Engagement Module Rollback');
    console.log('===============================================\n');
    
    // Confirm rollback
    const confirmed = await confirmRollback();
    if (!confirmed) {
      console.log('❌ Rollback cancelled by user');
      return;
    }
    
    await connectDatabase();
    await loadModels();
    
    // Run rollback operations in sequence
    console.log('\nPhase 1: Removing migrated Appointment records');
    try {
      const appointmentResult = await removeMigratedAppointments();
      stats.appointmentsDeleted = appointmentResult.deleted;
      stats.errors.push(...appointmentResult.errors);
    } catch (error: any) {
      const errorMsg = `Appointment deletion error: ${error.message}`;
      console.error(`❌ ${errorMsg}`);
      stats.errors.push(errorMsg);
    }
    
    console.log('\nPhase 2: Clearing MTRFollowUp appointmentId references');
    try {
      const mtrResult = await clearMTRFollowUpAppointmentIds();
      stats.mtrFollowUpsUpdated = mtrResult.updated;
      stats.errors.push(...mtrResult.errors);
    } catch (error: any) {
      const errorMsg = `MTRFollowUp update error: ${error.message}`;
      console.error(`❌ ${errorMsg}`);
      stats.errors.push(errorMsg);
    }
    
    console.log('\nPhase 3: Removing Patient appointmentPreferences');
    try {
      const patientResult = await removePatientAppointmentPreferences();
      stats.patientsUpdated = patientResult.updated;
      stats.errors.push(...patientResult.errors);
    } catch (error: any) {
      const errorMsg = `Patient update error: ${error.message}`;
      console.error(`❌ ${errorMsg}`);
      stats.errors.push(errorMsg);
    }
    
    console.log('\nPhase 4: Removing Visit appointmentId field');
    try {
      const visitResult = await removeVisitAppointmentId();
      stats.visitsUpdated = visitResult.updated;
      stats.errors.push(...visitResult.errors);
    } catch (error: any) {
      const errorMsg = `Visit update error: ${error.message}`;
      console.error(`❌ ${errorMsg}`);
      stats.errors.push(errorMsg);
    }
    
    console.log('\nPhase 5: Dropping new model indexes');
    try {
      const indexResult = await dropNewModelIndexes();
      stats.indexesDropped = indexResult.dropped;
      stats.errors.push(...indexResult.errors);
    } catch (error: any) {
      const errorMsg = `Index drop error: ${error.message}`;
      console.error(`❌ ${errorMsg}`);
      stats.errors.push(errorMsg);
    }
    
    // Optional: Drop collections entirely
    console.log('\nPhase 6: Dropping new model collections (optional)');
    try {
      await dropNewModelCollections();
    } catch (error: any) {
      console.warn(`⚠️  Collection drop warning: ${error.message}`);
    }
    
    // Verify rollback
    await verifyRollback();
    
    // Print summary
    console.log('\n===============================================');
    console.log('📊 Rollback Summary');
    console.log('===============================================');
    console.log(`\nData Removal:`);
    console.log(`  ✅ Appointments deleted: ${stats.appointmentsDeleted}`);
    console.log(`  ✅ MTRFollowUps updated: ${stats.mtrFollowUpsUpdated}`);
    console.log(`  ✅ Patients updated: ${stats.patientsUpdated}`);
    console.log(`  ✅ Visits updated: ${stats.visitsUpdated}`);
    console.log(`\nDatabase Cleanup:`);
    console.log(`  ✅ Index collections processed: ${stats.indexesDropped}`);
    
    if (stats.errors.length > 0) {
      console.log(`\n❌ Errors (${stats.errors.length}):`);
      stats.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    } else {
      console.log(`\n✅ No errors encountered`);
    }
    
    console.log('\n✅ Rollback completed!');
    console.log('\n📝 Next Steps:');
    console.log('  1. Verify that the system is working as expected');
    console.log('  2. Remove the new model files if they are no longer needed');
    console.log('  3. Update any code that references the new models');
    
  } catch (error: any) {
    console.error('\n❌ Rollback failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run rollback if this script is executed directly
if (require.main === module) {
  runRollback()
    .then(() => {
      console.log('\n✅ Rollback script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Rollback script failed:', error);
      process.exit(1);
    });
}

export { 
  runRollback,
  removeMigratedAppointments,
  clearMTRFollowUpAppointmentIds,
  removePatientAppointmentPreferences,
  removeVisitAppointmentId,
  dropNewModelIndexes,
  verifyRollback
};