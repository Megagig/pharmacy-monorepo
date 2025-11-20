/**
 * Migration Script: Add Patient Engagement & Follow-up Fields
 * 
 * This script adds new fields to existing models for the Patient Engagement module:
 * 1. Patient model: appointmentPreferences field
 * 2. Visit model: appointmentId field
 * 3. Notification model: New notification types (already in enum, no migration needed)
 * 
 * Run with: npx ts-node backend/scripts/migratePatientEngagementFields.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmacycopilot';

interface MigrationStats {
  patientsUpdated: number;
  patientsSkipped: number;
  visitsUpdated: number;
  visitsSkipped: number;
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

async function migratePatientAppointmentPreferences(): Promise<{ updated: number; skipped: number }> {
  console.log('\n📋 Migrating Patient appointment preferences...');
  
  const Patient = mongoose.model('Patient');
  
  // Find patients without appointmentPreferences field
  const patientsToUpdate = await Patient.find({
    appointmentPreferences: { $exists: false }
  }).countDocuments();
  
  console.log(`Found ${patientsToUpdate} patients to update`);
  
  if (patientsToUpdate === 0) {
    console.log('✅ All patients already have appointmentPreferences field');
    return { updated: 0, skipped: 0 };
  }
  
  // Update patients with default appointmentPreferences
  const result = await Patient.updateMany(
    { appointmentPreferences: { $exists: false } },
    {
      $set: {
        appointmentPreferences: {
          preferredDays: [],
          preferredTimeSlots: [],
          reminderPreferences: {
            email: true,
            sms: false,
            push: true,
            whatsapp: false
          },
          language: 'en',
          timezone: 'Africa/Lagos'
        }
      }
    }
  );
  
  console.log(`✅ Updated ${result.modifiedCount} patients with default appointment preferences`);
  
  return { updated: result.modifiedCount, skipped: patientsToUpdate - result.modifiedCount };
}

async function migrateVisitAppointmentId(): Promise<{ updated: number; skipped: number }> {
  console.log('\n📋 Migrating Visit appointmentId field...');
  
  const Visit = mongoose.model('Visit');
  
  // Count visits without appointmentId field
  const visitsToCheck = await Visit.find({
    appointmentId: { $exists: false }
  }).countDocuments();
  
  console.log(`Found ${visitsToCheck} visits without appointmentId field`);
  
  if (visitsToCheck === 0) {
    console.log('✅ All visits already have appointmentId field');
    return { updated: 0, skipped: 0 };
  }
  
  // Add appointmentId field (set to null/undefined for existing visits)
  // This is a non-destructive migration - we're just adding the field
  const result = await Visit.updateMany(
    { appointmentId: { $exists: false } },
    {
      $set: {
        appointmentId: null
      }
    }
  );
  
  console.log(`✅ Added appointmentId field to ${result.modifiedCount} visits`);
  
  return { updated: result.modifiedCount, skipped: visitsToCheck - result.modifiedCount };
}

async function verifyMigration(): Promise<void> {
  console.log('\n🔍 Verifying migration...');
  
  const Patient = mongoose.model('Patient');
  const Visit = mongoose.model('Visit');
  
  // Check patients
  const patientsWithPreferences = await Patient.countDocuments({
    appointmentPreferences: { $exists: true }
  });
  const totalPatients = await Patient.countDocuments();
  
  console.log(`\nPatients:`);
  console.log(`  - Total: ${totalPatients}`);
  console.log(`  - With appointment preferences: ${patientsWithPreferences}`);
  console.log(`  - Coverage: ${((patientsWithPreferences / totalPatients) * 100).toFixed(2)}%`);
  
  // Check visits
  const visitsWithAppointmentId = await Visit.countDocuments({
    appointmentId: { $exists: true }
  });
  const totalVisits = await Visit.countDocuments();
  
  console.log(`\nVisits:`);
  console.log(`  - Total: ${totalVisits}`);
  console.log(`  - With appointmentId field: ${visitsWithAppointmentId}`);
  console.log(`  - Coverage: ${((visitsWithAppointmentId / totalVisits) * 100).toFixed(2)}%`);
  
  // Sample a few patients to verify structure
  const samplePatient = await Patient.findOne({
    appointmentPreferences: { $exists: true }
  }).select('firstName lastName appointmentPreferences');
  
  if (samplePatient) {
    console.log(`\nSample Patient (${samplePatient.firstName} ${samplePatient.lastName}):`);
    console.log(JSON.stringify(samplePatient.appointmentPreferences, null, 2));
  }
}

async function runMigration(): Promise<void> {
  const stats: MigrationStats = {
    patientsUpdated: 0,
    patientsSkipped: 0,
    visitsUpdated: 0,
    visitsSkipped: 0,
    errors: []
  };
  
  try {
    console.log('🚀 Starting Patient Engagement Fields Migration');
    console.log('================================================\n');
    
    await connectDatabase();
    
    // Import models
    require('../src/models/Patient');
    require('../src/models/Visit');
    
    // Run migrations
    try {
      const patientResult = await migratePatientAppointmentPreferences();
      stats.patientsUpdated = patientResult.updated;
      stats.patientsSkipped = patientResult.skipped;
    } catch (error: any) {
      const errorMsg = `Patient migration error: ${error.message}`;
      console.error(`❌ ${errorMsg}`);
      stats.errors.push(errorMsg);
    }
    
    try {
      const visitResult = await migrateVisitAppointmentId();
      stats.visitsUpdated = visitResult.updated;
      stats.visitsSkipped = visitResult.skipped;
    } catch (error: any) {
      const errorMsg = `Visit migration error: ${error.message}`;
      console.error(`❌ ${errorMsg}`);
      stats.errors.push(errorMsg);
    }
    
    // Verify migration
    await verifyMigration();
    
    // Print summary
    console.log('\n================================================');
    console.log('📊 Migration Summary');
    console.log('================================================');
    console.log(`\nPatients:`);
    console.log(`  ✅ Updated: ${stats.patientsUpdated}`);
    console.log(`  ⏭️  Skipped: ${stats.patientsSkipped}`);
    console.log(`\nVisits:`);
    console.log(`  ✅ Updated: ${stats.visitsUpdated}`);
    console.log(`  ⏭️  Skipped: ${stats.visitsSkipped}`);
    
    if (stats.errors.length > 0) {
      console.log(`\n❌ Errors (${stats.errors.length}):`);
      stats.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    } else {
      console.log(`\n✅ No errors encountered`);
    }
    
    console.log('\n✅ Migration completed successfully!');
    
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('\n✅ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

export { runMigration, migratePatientAppointmentPreferences, migrateVisitAppointmentId };
