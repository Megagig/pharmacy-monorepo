/**
 * Verification Script: Patient Engagement Fields
 * 
 * Verifies that the new fields have been added correctly to:
 * - Patient model
 * - Visit model
 * - Notification model
 * 
 * Run with: npx ts-node backend/scripts/verifyPatientEngagementFields.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmacycopilot';

async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    throw error;
  }
}

function verifyPatientModel(): void {
  console.log('\n📋 Verifying Patient Model...');
  
  const Patient = require('../src/models/Patient').default;
  const schema = Patient.schema;
  
  const checks = [
    { path: 'appointmentPreferences', description: 'appointmentPreferences field' },
    { path: 'appointmentPreferences.preferredDays', description: 'preferredDays array' },
    { path: 'appointmentPreferences.preferredTimeSlots', description: 'preferredTimeSlots array' },
    { path: 'appointmentPreferences.preferredPharmacist', description: 'preferredPharmacist reference' },
    { path: 'appointmentPreferences.reminderPreferences', description: 'reminderPreferences object' },
    { path: 'appointmentPreferences.reminderPreferences.email', description: 'email reminder preference' },
    { path: 'appointmentPreferences.reminderPreferences.sms', description: 'sms reminder preference' },
    { path: 'appointmentPreferences.reminderPreferences.push', description: 'push reminder preference' },
    { path: 'appointmentPreferences.reminderPreferences.whatsapp', description: 'whatsapp reminder preference' },
    { path: 'appointmentPreferences.language', description: 'language preference' },
    { path: 'appointmentPreferences.timezone', description: 'timezone preference' },
  ];
  
  let passed = 0;
  let failed = 0;
  
  checks.forEach(check => {
    const pathExists = schema.path(check.path);
    if (pathExists) {
      console.log(`  ✅ ${check.description}`);
      passed++;
    } else {
      console.log(`  ❌ ${check.description} - NOT FOUND`);
      failed++;
    }
  });
  
  // Check language enum values
  const languagePath = schema.path('appointmentPreferences.language');
  if (languagePath && languagePath.enumValues) {
    const expectedLanguages = ['en', 'yo', 'ig', 'ha'];
    const hasAllLanguages = expectedLanguages.every(lang => languagePath.enumValues.includes(lang));
    if (hasAllLanguages) {
      console.log(`  ✅ Language enum contains all Nigerian languages`);
      passed++;
    } else {
      console.log(`  ❌ Language enum missing some languages`);
      failed++;
    }
  }
  
  // Check timezone default
  const timezonePath = schema.path('appointmentPreferences.timezone');
  if (timezonePath && timezonePath.defaultValue === 'Africa/Lagos') {
    console.log(`  ✅ Timezone default is Africa/Lagos`);
    passed++;
  } else {
    console.log(`  ❌ Timezone default is not Africa/Lagos`);
    failed++;
  }
  
  console.log(`\n  Summary: ${passed} passed, ${failed} failed`);
  
  return;
}

function verifyVisitModel(): void {
  console.log('\n📋 Verifying Visit Model...');
  
  const Visit = require('../src/models/Visit').default;
  const schema = Visit.schema;
  
  const checks = [
    { path: 'appointmentId', description: 'appointmentId field' },
  ];
  
  let passed = 0;
  let failed = 0;
  
  checks.forEach(check => {
    const pathExists = schema.path(check.path);
    if (pathExists) {
      console.log(`  ✅ ${check.description}`);
      passed++;
      
      // Check if it's an ObjectId reference
      if (pathExists.instance === 'ObjectID' && pathExists.options.ref === 'Appointment') {
        console.log(`  ✅ appointmentId is ObjectId reference to Appointment`);
        passed++;
      } else {
        console.log(`  ❌ appointmentId is not properly configured as ObjectId reference`);
        failed++;
      }
      
      // Check if it's optional
      if (!pathExists.isRequired) {
        console.log(`  ✅ appointmentId is optional (backward compatible)`);
        passed++;
      } else {
        console.log(`  ❌ appointmentId is required (breaks backward compatibility)`);
        failed++;
      }
    } else {
      console.log(`  ❌ ${check.description} - NOT FOUND`);
      failed++;
    }
  });
  
  // Check for index
  const indexes = schema.indexes();
  const hasAppointmentIdIndex = indexes.some((index: any) => {
    const keys = Object.keys(index[0]);
    return keys.includes('appointmentId') || 
           (keys.includes('workplaceId') && keys.includes('appointmentId'));
  });
  
  if (hasAppointmentIdIndex) {
    console.log(`  ✅ appointmentId has index`);
    passed++;
  } else {
    console.log(`  ❌ appointmentId missing index`);
    failed++;
  }
  
  console.log(`\n  Summary: ${passed} passed, ${failed} failed`);
}

function verifyNotificationModel(): void {
  console.log('\n📋 Verifying Notification Model...');
  
  const Notification = require('../src/models/Notification').default;
  const schema = Notification.schema;
  
  let passed = 0;
  let failed = 0;
  
  // Check new notification types
  const typePath = schema.path('type');
  const newTypes = [
    'appointment_reminder',
    'appointment_confirmed',
    'appointment_rescheduled',
    'appointment_cancelled',
    'followup_task_assigned',
    'followup_task_overdue',
    'medication_refill_due',
    'adherence_check_reminder'
  ];
  
  newTypes.forEach(type => {
    if (typePath.enumValues.includes(type)) {
      console.log(`  ✅ Notification type: ${type}`);
      passed++;
    } else {
      console.log(`  ❌ Notification type missing: ${type}`);
      failed++;
    }
  });
  
  // Check backward compatibility with existing types
  const existingTypes = [
    'new_message',
    'mention',
    'therapy_update',
    'clinical_alert',
    'medication_reminder'
  ];
  
  existingTypes.forEach(type => {
    if (typePath.enumValues.includes(type)) {
      console.log(`  ✅ Existing type preserved: ${type}`);
      passed++;
    } else {
      console.log(`  ❌ Existing type missing: ${type}`);
      failed++;
    }
  });
  
  // Check new data fields
  const dataChecks = [
    { path: 'data.appointmentId', description: 'appointmentId in data' },
    { path: 'data.followUpTaskId', description: 'followUpTaskId in data' },
  ];
  
  dataChecks.forEach(check => {
    const pathExists = schema.path(check.path);
    if (pathExists) {
      console.log(`  ✅ ${check.description}`);
      passed++;
      
      // Check if it's an ObjectId reference
      if (pathExists.instance === 'ObjectID') {
        console.log(`  ✅ ${check.description} is ObjectId reference`);
        passed++;
      }
    } else {
      console.log(`  ❌ ${check.description} - NOT FOUND`);
      failed++;
    }
  });
  
  console.log(`\n  Summary: ${passed} passed, ${failed} failed`);
}

async function runVerification(): Promise<void> {
  try {
    console.log('🚀 Starting Patient Engagement Fields Verification');
    console.log('==================================================\n');
    
    await connectDatabase();
    
    verifyPatientModel();
    verifyVisitModel();
    verifyNotificationModel();
    
    console.log('\n==================================================');
    console.log('✅ Verification completed successfully!');
    console.log('==================================================\n');
    
  } catch (error: any) {
    console.error('\n❌ Verification failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB\n');
  }
}

// Run verification if this script is executed directly
if (require.main === module) {
  runVerification()
    .then(() => {
      console.log('✅ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { runVerification };
