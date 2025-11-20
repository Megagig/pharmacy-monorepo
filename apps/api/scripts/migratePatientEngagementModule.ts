/**
 * Migration Script: Patient Engagement & Follow-up Management Module
 * 
 * This script migrates existing MTRFollowUp records to the new unified appointment system
 * and adds new fields to existing models for the Patient Engagement module.
 * 
 * Migration Tasks:
 * 1. Migrate existing MTRFollowUp records to Appointment model
 * 2. Add new fields to Patient model (appointmentPreferences)
 * 3. Add new fields to Visit model (appointmentId)
 * 4. Create indexes for new models
 * 5. Verify data integrity
 * 
 * Run with: npx ts-node backend/scripts/migratePatientEngagementModule.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmacycopilot';

interface MigrationStats {
  mtrFollowUpsProcessed: number;
  appointmentsCreated: number;
  patientsUpdated: number;
  visitsUpdated: number;
  indexesCreated: number;
  errors: string[];
  warnings: string[];
}

interface MTRFollowUpRecord {
  _id: mongoose.Types.ObjectId;
  workplaceId: mongoose.Types.ObjectId;
  reviewId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  type: string;
  priority: string;
  description: string;
  objectives: string[];
  scheduledDate: Date;
  estimatedDuration: number;
  assignedTo: mongoose.Types.ObjectId;
  status: string;
  completedAt?: Date;
  outcome?: any;
  reminders: any[];
  appointmentId?: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
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
  
  // Import new models (these should be created before running migration)
  try {
    require('../src/models/Appointment');
    require('../src/models/FollowUpTask');
    require('../src/models/ReminderTemplate');
    require('../src/models/PharmacistSchedule');
  } catch (error) {
    console.warn('⚠️  New models not found. Make sure to create them before running migration.');
    throw new Error('New models required for migration are not available');
  }
}

/**
 * Map MTRFollowUp type to Appointment type
 */
function mapMTRTypeToAppointmentType(mtrType: string): string {
  const typeMapping: Record<string, string> = {
    'phone_call': 'general_followup',
    'appointment': 'mtm_session',
    'lab_review': 'chronic_disease_review',
    'adherence_check': 'chronic_disease_review',
    'outcome_assessment': 'mtm_session'
  };
  
  return typeMapping[mtrType] || 'general_followup';
}

/**
 * Map MTRFollowUp status to Appointment status
 */
function mapMTRStatusToAppointmentStatus(mtrStatus: string): string {
  const statusMapping: Record<string, string> = {
    'scheduled': 'scheduled',
    'in_progress': 'in_progress',
    'completed': 'completed',
    'missed': 'no_show',
    'rescheduled': 'rescheduled',
    'cancelled': 'cancelled'
  };
  
  return statusMapping[mtrStatus] || 'scheduled';
}

/**
 * Extract time from Date object in HH:mm format
 */
function extractTimeFromDate(date: Date): string {
  return date.toTimeString().slice(0, 5); // HH:mm format
}

/**
 * Migrate MTRFollowUp records to Appointment model
 */
async function migrateMTRFollowUpsToAppointments(): Promise<{ processed: number; created: number; errors: string[] }> {
  console.log('\n📋 Migrating MTRFollowUp records to Appointments...');
  
  const MTRFollowUp = mongoose.model('MTRFollowUp');
  const Appointment = mongoose.model('Appointment');
  
  // Find all MTRFollowUp records that don't have an appointmentId
  const mtrFollowUps = await MTRFollowUp.find({
    appointmentId: { $exists: false }
  }).lean() as MTRFollowUpRecord[];
  
  console.log(`Found ${mtrFollowUps.length} MTRFollowUp records to migrate`);
  
  if (mtrFollowUps.length === 0) {
    console.log('✅ No MTRFollowUp records to migrate');
    return { processed: 0, created: 0, errors: [] };
  }
  
  let processed = 0;
  let created = 0;
  const errors: string[] = [];
  
  for (const mtrFollowUp of mtrFollowUps) {
    try {
      // Create corresponding Appointment record
      const appointmentData = {
        workplaceId: mtrFollowUp.workplaceId,
        patientId: mtrFollowUp.patientId,
        assignedTo: mtrFollowUp.assignedTo,
        
        // Map appointment details
        type: mapMTRTypeToAppointmentType(mtrFollowUp.type),
        title: `MTR Follow-up: ${mtrFollowUp.description}`,
        description: mtrFollowUp.description,
        
        // Scheduling
        scheduledDate: mtrFollowUp.scheduledDate,
        scheduledTime: extractTimeFromDate(mtrFollowUp.scheduledDate),
        duration: mtrFollowUp.estimatedDuration || 30,
        timezone: 'Africa/Lagos', // Default timezone
        
        // Status tracking
        status: mapMTRStatusToAppointmentStatus(mtrFollowUp.status),
        confirmationStatus: 'pending',
        
        // Completion tracking
        completedAt: mtrFollowUp.completedAt,
        outcome: mtrFollowUp.outcome ? {
          status: mtrFollowUp.outcome.status || 'successful',
          notes: mtrFollowUp.outcome.notes || '',
          nextActions: mtrFollowUp.outcome.nextActions || [],
          visitCreated: false
        } : undefined,
        
        // Recurring appointments (MTR follow-ups are typically not recurring)
        isRecurring: false,
        isRecurringException: false,
        
        // Reminders (migrate existing reminders)
        reminders: mtrFollowUp.reminders.map((reminder: any) => ({
          type: reminder.type,
          scheduledFor: reminder.scheduledFor,
          sent: reminder.sent || false,
          sentAt: reminder.sentAt,
          deliveryStatus: reminder.sent ? 'sent' : 'pending'
        })),
        
        // Related records
        relatedRecords: {
          mtrSessionId: mtrFollowUp.reviewId,
          followUpTaskId: mtrFollowUp._id
        },
        
        // Metadata
        metadata: {
          source: 'mtr_migration',
          originalMTRFollowUpId: mtrFollowUp._id,
          migrationDate: new Date()
        },
        
        // Audit fields
        createdBy: mtrFollowUp.createdBy,
        createdAt: mtrFollowUp.createdAt,
        updatedAt: mtrFollowUp.updatedAt
      };
      
      const appointment = new Appointment(appointmentData);
      await appointment.save();
      
      // Update MTRFollowUp record with appointmentId
      await MTRFollowUp.updateOne(
        { _id: mtrFollowUp._id },
        { 
          $set: { 
            appointmentId: appointment._id,
            migratedAt: new Date()
          }
        }
      );
      
      created++;
      processed++;
      
      if (processed % 100 === 0) {
        console.log(`  Processed ${processed}/${mtrFollowUps.length} records...`);
      }
      
    } catch (error: any) {
      const errorMsg = `Failed to migrate MTRFollowUp ${mtrFollowUp._id}: ${error.message}`;
      console.error(`❌ ${errorMsg}`);
      errors.push(errorMsg);
      processed++;
    }
  }
  
  console.log(`✅ Migrated ${created} MTRFollowUp records to Appointments`);
  
  return { processed, created, errors };
}

/**
 * Add appointmentPreferences field to Patient model
 */
async function migratePatientAppointmentPreferences(): Promise<{ updated: number; skipped: number }> {
  console.log('\n📋 Adding appointmentPreferences to Patient records...');
  
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
          preferredDays: [], // No specific preference initially
          preferredTimeSlots: [],
          reminderPreferences: {
            email: true,
            sms: false,
            push: true,
            whatsapp: false
          },
          language: 'en',
          timezone: 'Africa/Lagos'
        },
        // Add virtual fields for appointment tracking
        lastAppointmentDate: null
      }
    }
  );
  
  console.log(`✅ Updated ${result.modifiedCount} patients with appointment preferences`);
  
  return { updated: result.modifiedCount, skipped: patientsToUpdate - result.modifiedCount };
}

/**
 * Add appointmentId field to Visit model
 */
async function migrateVisitAppointmentId(): Promise<{ updated: number; skipped: number }> {
  console.log('\n📋 Adding appointmentId field to Visit records...');
  
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
  
  // Add appointmentId field (set to null for existing visits)
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

/**
 * Create indexes for new models
 */
async function createNewModelIndexes(): Promise<{ created: number; errors: string[] }> {
  console.log('\n📋 Creating indexes for new models...');
  
  const errors: string[] = [];
  let created = 0;
  
  try {
    const Appointment = mongoose.model('Appointment');
    const FollowUpTask = mongoose.model('FollowUpTask');
    const ReminderTemplate = mongoose.model('ReminderTemplate');
    const PharmacistSchedule = mongoose.model('PharmacistSchedule');
    
    // Create Appointment indexes
    try {
      await Appointment.collection.createIndex({ workplaceId: 1, scheduledDate: 1, status: 1 });
      await Appointment.collection.createIndex({ workplaceId: 1, patientId: 1, scheduledDate: -1 });
      await Appointment.collection.createIndex({ workplaceId: 1, assignedTo: 1, scheduledDate: 1 });
      await Appointment.collection.createIndex({ workplaceId: 1, type: 1, status: 1 });
      await Appointment.collection.createIndex({ recurringSeriesId: 1, scheduledDate: 1 });
      await Appointment.collection.createIndex({ status: 1, scheduledDate: 1 });
      await Appointment.collection.createIndex({ 'reminders.scheduledFor': 1, 'reminders.sent': 1 });
      created += 7;
      console.log('  ✅ Created Appointment indexes');
    } catch (error: any) {
      errors.push(`Appointment indexes: ${error.message}`);
    }
    
    // Create FollowUpTask indexes
    try {
      await FollowUpTask.collection.createIndex({ workplaceId: 1, status: 1, dueDate: 1 });
      await FollowUpTask.collection.createIndex({ workplaceId: 1, patientId: 1, status: 1 });
      await FollowUpTask.collection.createIndex({ workplaceId: 1, assignedTo: 1, status: 1, priority: -1 });
      await FollowUpTask.collection.createIndex({ status: 1, dueDate: 1 });
      created += 4;
      console.log('  ✅ Created FollowUpTask indexes');
    } catch (error: any) {
      errors.push(`FollowUpTask indexes: ${error.message}`);
    }
    
    // Create ReminderTemplate indexes
    try {
      await ReminderTemplate.collection.createIndex({ workplaceId: 1, type: 1, isActive: 1 });
      await ReminderTemplate.collection.createIndex({ workplaceId: 1, isDefault: 1 });
      created += 2;
      console.log('  ✅ Created ReminderTemplate indexes');
    } catch (error: any) {
      errors.push(`ReminderTemplate indexes: ${error.message}`);
    }
    
    // Create PharmacistSchedule indexes
    try {
      await PharmacistSchedule.collection.createIndex({ workplaceId: 1, pharmacistId: 1, isActive: 1 });
      await PharmacistSchedule.collection.createIndex({ pharmacistId: 1, effectiveFrom: 1, effectiveTo: 1 });
      created += 2;
      console.log('  ✅ Created PharmacistSchedule indexes');
    } catch (error: any) {
      errors.push(`PharmacistSchedule indexes: ${error.message}`);
    }
    
  } catch (error: any) {
    errors.push(`Model loading error: ${error.message}`);
  }
  
  console.log(`✅ Created ${created} indexes`);
  
  return { created, errors };
}

/**
 * Verify migration integrity
 */
async function verifyMigration(): Promise<void> {
  console.log('\n🔍 Verifying migration integrity...');
  
  const MTRFollowUp = mongoose.model('MTRFollowUp');
  const Appointment = mongoose.model('Appointment');
  const Patient = mongoose.model('Patient');
  const Visit = mongoose.model('Visit');
  
  // Check MTRFollowUp to Appointment migration
  const totalMTRFollowUps = await MTRFollowUp.countDocuments();
  const migratedMTRFollowUps = await MTRFollowUp.countDocuments({
    appointmentId: { $exists: true }
  });
  const migratedAppointments = await Appointment.countDocuments({
    'metadata.source': 'mtr_migration'
  });
  
  console.log(`\nMTRFollowUp Migration:`);
  console.log(`  - Total MTRFollowUp records: ${totalMTRFollowUps}`);
  console.log(`  - Migrated MTRFollowUp records: ${migratedMTRFollowUps}`);
  console.log(`  - Created Appointment records: ${migratedAppointments}`);
  console.log(`  - Migration coverage: ${((migratedMTRFollowUps / totalMTRFollowUps) * 100).toFixed(2)}%`);
  
  // Check Patient appointmentPreferences
  const totalPatients = await Patient.countDocuments();
  const patientsWithPreferences = await Patient.countDocuments({
    appointmentPreferences: { $exists: true }
  });
  
  console.log(`\nPatient Migration:`);
  console.log(`  - Total patients: ${totalPatients}`);
  console.log(`  - With appointment preferences: ${patientsWithPreferences}`);
  console.log(`  - Coverage: ${((patientsWithPreferences / totalPatients) * 100).toFixed(2)}%`);
  
  // Check Visit appointmentId
  const totalVisits = await Visit.countDocuments();
  const visitsWithAppointmentId = await Visit.countDocuments({
    appointmentId: { $exists: true }
  });
  
  console.log(`\nVisit Migration:`);
  console.log(`  - Total visits: ${totalVisits}`);
  console.log(`  - With appointmentId field: ${visitsWithAppointmentId}`);
  console.log(`  - Coverage: ${((visitsWithAppointmentId / totalVisits) * 100).toFixed(2)}%`);
  
  // Sample verification
  const sampleAppointment = await Appointment.findOne({
    'metadata.source': 'mtr_migration'
  }).populate('patientId', 'firstName lastName');
  
  if (sampleAppointment) {
    console.log(`\nSample Migrated Appointment:`);
    console.log(`  - ID: ${sampleAppointment._id}`);
    console.log(`  - Patient: ${(sampleAppointment.patientId as any)?.firstName} ${(sampleAppointment.patientId as any)?.lastName}`);
    console.log(`  - Type: ${sampleAppointment.type}`);
    console.log(`  - Status: ${sampleAppointment.status}`);
    console.log(`  - Scheduled: ${sampleAppointment.scheduledDate}`);
    console.log(`  - Original MTR Follow-up: ${sampleAppointment.metadata?.originalMTRFollowUpId}`);
  }
  
  // Check for data integrity issues
  const orphanedAppointments = await Appointment.countDocuments({
    'metadata.source': 'mtr_migration',
    'relatedRecords.followUpTaskId': { $exists: true },
    'relatedRecords.followUpTaskId': { $ne: null }
  });
  
  const linkedMTRFollowUps = await MTRFollowUp.countDocuments({
    appointmentId: { $exists: true, $ne: null }
  });
  
  console.log(`\nData Integrity:`);
  console.log(`  - Migrated appointments with MTR links: ${orphanedAppointments}`);
  console.log(`  - MTRFollowUps with appointment links: ${linkedMTRFollowUps}`);
  
  if (orphanedAppointments !== linkedMTRFollowUps) {
    console.warn(`⚠️  Potential data integrity issue: Mismatch in bidirectional links`);
  } else {
    console.log(`  ✅ Bidirectional links are consistent`);
  }
}

/**
 * Main migration function
 */
async function runMigration(): Promise<void> {
  const stats: MigrationStats = {
    mtrFollowUpsProcessed: 0,
    appointmentsCreated: 0,
    patientsUpdated: 0,
    visitsUpdated: 0,
    indexesCreated: 0,
    errors: [],
    warnings: []
  };
  
  try {
    console.log('🚀 Starting Patient Engagement Module Migration');
    console.log('=================================================\n');
    
    await connectDatabase();
    await loadModels();
    
    // Run migrations in sequence
    console.log('Phase 1: Migrating MTRFollowUp records to Appointments');
    try {
      const mtrResult = await migrateMTRFollowUpsToAppointments();
      stats.mtrFollowUpsProcessed = mtrResult.processed;
      stats.appointmentsCreated = mtrResult.created;
      stats.errors.push(...mtrResult.errors);
    } catch (error: any) {
      const errorMsg = `MTRFollowUp migration error: ${error.message}`;
      console.error(`❌ ${errorMsg}`);
      stats.errors.push(errorMsg);
    }
    
    console.log('\nPhase 2: Adding Patient appointment preferences');
    try {
      const patientResult = await migratePatientAppointmentPreferences();
      stats.patientsUpdated = patientResult.updated;
    } catch (error: any) {
      const errorMsg = `Patient migration error: ${error.message}`;
      console.error(`❌ ${errorMsg}`);
      stats.errors.push(errorMsg);
    }
    
    console.log('\nPhase 3: Adding Visit appointmentId field');
    try {
      const visitResult = await migrateVisitAppointmentId();
      stats.visitsUpdated = visitResult.updated;
    } catch (error: any) {
      const errorMsg = `Visit migration error: ${error.message}`;
      console.error(`❌ ${errorMsg}`);
      stats.errors.push(errorMsg);
    }
    
    console.log('\nPhase 4: Creating indexes for new models');
    try {
      const indexResult = await createNewModelIndexes();
      stats.indexesCreated = indexResult.created;
      stats.errors.push(...indexResult.errors);
    } catch (error: any) {
      const errorMsg = `Index creation error: ${error.message}`;
      console.error(`❌ ${errorMsg}`);
      stats.errors.push(errorMsg);
    }
    
    // Verify migration
    await verifyMigration();
    
    // Print summary
    console.log('\n=================================================');
    console.log('📊 Migration Summary');
    console.log('=================================================');
    console.log(`\nMTRFollowUp to Appointment Migration:`);
    console.log(`  ✅ Records processed: ${stats.mtrFollowUpsProcessed}`);
    console.log(`  ✅ Appointments created: ${stats.appointmentsCreated}`);
    console.log(`\nModel Field Additions:`);
    console.log(`  ✅ Patients updated: ${stats.patientsUpdated}`);
    console.log(`  ✅ Visits updated: ${stats.visitsUpdated}`);
    console.log(`\nDatabase Optimization:`);
    console.log(`  ✅ Indexes created: ${stats.indexesCreated}`);
    
    if (stats.warnings.length > 0) {
      console.log(`\n⚠️  Warnings (${stats.warnings.length}):`);
      stats.warnings.forEach((warning, index) => {
        console.log(`  ${index + 1}. ${warning}`);
      });
    }
    
    if (stats.errors.length > 0) {
      console.log(`\n❌ Errors (${stats.errors.length}):`);
      stats.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    } else {
      console.log(`\n✅ No errors encountered`);
    }
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\n📝 Next Steps:');
    console.log('  1. Test the new appointment system with migrated data');
    console.log('  2. Verify that MTRFollowUp records are properly linked to appointments');
    console.log('  3. Run the rollback script if any issues are found');
    console.log('  4. Deploy the new Patient Engagement module');
    
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
      console.log('\n✅ Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration script failed:', error);
      process.exit(1);
    });
}

export { 
  runMigration, 
  migrateMTRFollowUpsToAppointments, 
  migratePatientAppointmentPreferences, 
  migrateVisitAppointmentId,
  createNewModelIndexes,
  verifyMigration
};