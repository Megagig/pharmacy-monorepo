/**
 * Test Script: Patient Engagement Migration
 * 
 * This script tests the Patient Engagement migration on staging data by:
 * 1. Creating test data (MTRFollowUp records, Patients, Visits)
 * 2. Running the migration
 * 3. Verifying the results
 * 4. Cleaning up test data
 * 
 * Run with: npx ts-node backend/scripts/testPatientEngagementMigration.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmacycopilot';

interface TestData {
  workplaceId: mongoose.Types.ObjectId;
  patientIds: mongoose.Types.ObjectId[];
  pharmacistId: mongoose.Types.ObjectId;
  mtrFollowUpIds: mongoose.Types.ObjectId[];
  visitIds: mongoose.Types.ObjectId[];
}

interface TestResults {
  testDataCreated: boolean;
  migrationSuccessful: boolean;
  dataIntegrityValid: boolean;
  cleanupSuccessful: boolean;
  errors: string[];
}

async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB (Test Environment)');
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
  require('../src/models/User');
  require('../src/models/Workplace');
  
  // Import new models
  try {
    require('../src/models/Appointment');
    require('../src/models/FollowUpTask');
    require('../src/models/ReminderTemplate');
    require('../src/models/PharmacistSchedule');
  } catch (error) {
    console.warn('⚠️  New models not found. Make sure to create them before running tests.');
    throw new Error('New models required for testing are not available');
  }
}

/**
 * Create test data for migration testing
 */
async function createTestData(): Promise<TestData> {
  console.log('\n📋 Creating test data...');
  
  const Patient = mongoose.model('Patient');
  const Visit = mongoose.model('Visit');
  const MTRFollowUp = mongoose.model('MTRFollowUp');
  const User = mongoose.model('User');
  const Workplace = mongoose.model('Workplace');
  
  // Create test workplace
  const workplace = new Workplace({
    name: 'Test Pharmacy - Migration',
    address: 'Test Address',
    phone: '+2341234567890',
    email: 'test@pharmacy.com',
    licenseNumber: 'TEST-LIC-001',
    isActive: true
  });
  await workplace.save();
  
  // Create test pharmacist
  const pharmacist = new User({
    firstName: 'Test',
    lastName: 'Pharmacist',
    email: 'test.pharmacist@pharmacy.com',
    password: 'hashedpassword',
    role: 'pharmacist',
    workplaceId: workplace._id,
    isActive: true
  });
  await pharmacist.save();
  
  // Create test patients
  const patients = [];
  for (let i = 1; i <= 3; i++) {
    const patient = new Patient({
      firstName: `Test Patient ${i}`,
      lastName: 'Migration',
      email: `patient${i}@test.com`,
      phone: `+23412345678${i}`,
      dateOfBirth: new Date('1990-01-01'),
      gender: 'male',
      workplaceId: workplace._id
    });
    await patient.save();
    patients.push(patient);
  }
  
  // Create test visits
  const visits = [];
  for (const patient of patients) {
    const visit = new Visit({
      patientId: patient._id,
      workplaceId: workplace._id,
      visitDate: new Date(),
      visitType: 'consultation',
      chiefComplaint: 'Test complaint',
      assessment: 'Test assessment',
      plan: 'Test plan',
      createdBy: pharmacist._id
    });
    await visit.save();
    visits.push(visit);
  }
  
  // Create test MTRFollowUp records
  const mtrFollowUps = [];
  const followUpTypes = ['phone_call', 'appointment', 'lab_review', 'adherence_check'];
  const priorities = ['high', 'medium', 'low'];
  const statuses = ['scheduled', 'completed', 'missed'];
  
  for (let i = 0; i < patients.length; i++) {
    const patient = patients[i];
    
    // Create 2 MTRFollowUp records per patient
    for (let j = 0; j < 2; j++) {
      const followUp = new MTRFollowUp({
        workplaceId: workplace._id,
        reviewId: new mongoose.Types.ObjectId(), // Mock MTR review ID
        patientId: patient._id,
        type: followUpTypes[j % followUpTypes.length],
        priority: priorities[j % priorities.length],
        description: `Test follow-up ${j + 1} for ${patient.firstName}`,
        objectives: [`Objective 1 for follow-up ${j + 1}`, `Objective 2 for follow-up ${j + 1}`],
        scheduledDate: new Date(Date.now() + (j + 1) * 24 * 60 * 60 * 1000), // Future dates
        estimatedDuration: 30 + (j * 15),
        assignedTo: pharmacist._id,
        status: statuses[j % statuses.length],
        reminders: [
          {
            type: 'email',
            scheduledFor: new Date(Date.now() + (j + 1) * 24 * 60 * 60 * 1000 - 2 * 60 * 60 * 1000),
            sent: false
          }
        ],
        createdBy: pharmacist._id
      });
      
      // Add completion data for completed follow-ups
      if (followUp.status === 'completed') {
        followUp.completedAt = new Date();
        followUp.outcome = {
          status: 'successful',
          notes: 'Test completion notes',
          nextActions: ['Test next action 1', 'Test next action 2']
        };
      }
      
      await followUp.save();
      mtrFollowUps.push(followUp);
    }
  }
  
  console.log(`✅ Created test data:`);
  console.log(`  - 1 workplace`);
  console.log(`  - 1 pharmacist`);
  console.log(`  - ${patients.length} patients`);
  console.log(`  - ${visits.length} visits`);
  console.log(`  - ${mtrFollowUps.length} MTRFollowUp records`);
  
  return {
    workplaceId: workplace._id,
    patientIds: patients.map(p => p._id),
    pharmacistId: pharmacist._id,
    mtrFollowUpIds: mtrFollowUps.map(f => f._id),
    visitIds: visits.map(v => v._id)
  };
}

/**
 * Run migration on test data
 */
async function runTestMigration(testData: TestData): Promise<boolean> {
  console.log('\n📋 Running migration on test data...');
  
  try {
    // Import migration functions
    const { 
      migrateMTRFollowUpsToAppointments,
      migratePatientAppointmentPreferences,
      migrateVisitAppointmentId
    } = require('./migratePatientEngagementModule');
    
    // Run MTRFollowUp to Appointment migration
    const mtrResult = await migrateMTRFollowUpsToAppointments();
    console.log(`  ✅ MTR migration: ${mtrResult.created} appointments created`);
    
    // Run Patient preferences migration
    const patientResult = await migratePatientAppointmentPreferences();
    console.log(`  ✅ Patient migration: ${patientResult.updated} patients updated`);
    
    // Run Visit appointmentId migration
    const visitResult = await migrateVisitAppointmentId();
    console.log(`  ✅ Visit migration: ${visitResult.updated} visits updated`);
    
    return true;
    
  } catch (error: any) {
    console.error(`❌ Migration failed: ${error.message}`);
    return false;
  }
}

/**
 * Verify migration results
 */
async function verifyMigrationResults(testData: TestData): Promise<boolean> {
  console.log('\n📋 Verifying migration results...');
  
  try {
    const MTRFollowUp = mongoose.model('MTRFollowUp');
    const Appointment = mongoose.model('Appointment');
    const Patient = mongoose.model('Patient');
    const Visit = mongoose.model('Visit');
    
    let allTestsPassed = true;
    
    // Test 1: Check that all test MTRFollowUp records have appointmentId
    const mtrWithAppointmentId = await MTRFollowUp.countDocuments({
      _id: { $in: testData.mtrFollowUpIds },
      appointmentId: { $exists: true }
    });
    
    console.log(`\nTest 1: MTRFollowUp appointmentId links`);
    console.log(`  Expected: ${testData.mtrFollowUpIds.length}`);
    console.log(`  Actual: ${mtrWithAppointmentId}`);
    console.log(`  Result: ${mtrWithAppointmentId === testData.mtrFollowUpIds.length ? '✅ PASS' : '❌ FAIL'}`);
    
    if (mtrWithAppointmentId !== testData.mtrFollowUpIds.length) {
      allTestsPassed = false;
    }
    
    // Test 2: Check that corresponding Appointment records were created
    const migratedAppointments = await Appointment.countDocuments({
      'metadata.source': 'mtr_migration',
      workplaceId: testData.workplaceId
    });
    
    console.log(`\nTest 2: Migrated Appointment records`);
    console.log(`  Expected: ${testData.mtrFollowUpIds.length}`);
    console.log(`  Actual: ${migratedAppointments}`);
    console.log(`  Result: ${migratedAppointments === testData.mtrFollowUpIds.length ? '✅ PASS' : '❌ FAIL'}`);
    
    if (migratedAppointments !== testData.mtrFollowUpIds.length) {
      allTestsPassed = false;
    }
    
    // Test 3: Check that Patient records have appointmentPreferences
    const patientsWithPreferences = await Patient.countDocuments({
      _id: { $in: testData.patientIds },
      appointmentPreferences: { $exists: true }
    });
    
    console.log(`\nTest 3: Patient appointmentPreferences`);
    console.log(`  Expected: ${testData.patientIds.length}`);
    console.log(`  Actual: ${patientsWithPreferences}`);
    console.log(`  Result: ${patientsWithPreferences === testData.patientIds.length ? '✅ PASS' : '❌ FAIL'}`);
    
    if (patientsWithPreferences !== testData.patientIds.length) {
      allTestsPassed = false;
    }
    
    // Test 4: Check that Visit records have appointmentId field
    const visitsWithAppointmentId = await Visit.countDocuments({
      _id: { $in: testData.visitIds },
      appointmentId: { $exists: true }
    });
    
    console.log(`\nTest 4: Visit appointmentId field`);
    console.log(`  Expected: ${testData.visitIds.length}`);
    console.log(`  Actual: ${visitsWithAppointmentId}`);
    console.log(`  Result: ${visitsWithAppointmentId === testData.visitIds.length ? '✅ PASS' : '❌ FAIL'}`);
    
    if (visitsWithAppointmentId !== testData.visitIds.length) {
      allTestsPassed = false;
    }
    
    // Test 5: Verify data integrity - check bidirectional links
    const mtrFollowUps = await MTRFollowUp.find({
      _id: { $in: testData.mtrFollowUpIds },
      appointmentId: { $exists: true }
    }).select('_id appointmentId');
    
    let bidirectionalLinksValid = true;
    for (const mtrFollowUp of mtrFollowUps) {
      const appointment = await Appointment.findById(mtrFollowUp.appointmentId);
      if (!appointment || appointment.relatedRecords?.followUpTaskId?.toString() !== mtrFollowUp._id.toString()) {
        bidirectionalLinksValid = false;
        break;
      }
    }
    
    console.log(`\nTest 5: Bidirectional links integrity`);
    console.log(`  Result: ${bidirectionalLinksValid ? '✅ PASS' : '❌ FAIL'}`);
    
    if (!bidirectionalLinksValid) {
      allTestsPassed = false;
    }
    
    // Test 6: Verify appointment data mapping
    const sampleMTRFollowUp = await MTRFollowUp.findOne({
      _id: { $in: testData.mtrFollowUpIds }
    }).populate('appointmentId');
    
    if (sampleMTRFollowUp && sampleMTRFollowUp.appointmentId) {
      const appointment = sampleMTRFollowUp.appointmentId as any;
      
      const mappingValid = (
        appointment.patientId.toString() === sampleMTRFollowUp.patientId.toString() &&
        appointment.assignedTo.toString() === sampleMTRFollowUp.assignedTo.toString() &&
        appointment.workplaceId.toString() === sampleMTRFollowUp.workplaceId.toString() &&
        appointment.duration === sampleMTRFollowUp.estimatedDuration
      );
      
      console.log(`\nTest 6: Appointment data mapping`);
      console.log(`  Result: ${mappingValid ? '✅ PASS' : '❌ FAIL'}`);
      
      if (!mappingValid) {
        allTestsPassed = false;
        console.log(`  Details:`);
        console.log(`    Patient ID match: ${appointment.patientId.toString() === sampleMTRFollowUp.patientId.toString()}`);
        console.log(`    Assigned To match: ${appointment.assignedTo.toString() === sampleMTRFollowUp.assignedTo.toString()}`);
        console.log(`    Workplace ID match: ${appointment.workplaceId.toString() === sampleMTRFollowUp.workplaceId.toString()}`);
        console.log(`    Duration match: ${appointment.duration === sampleMTRFollowUp.estimatedDuration}`);
      }
    }
    
    console.log(`\n📊 Overall Test Result: ${allTestsPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    
    return allTestsPassed;
    
  } catch (error: any) {
    console.error(`❌ Verification failed: ${error.message}`);
    return false;
  }
}

/**
 * Clean up test data
 */
async function cleanupTestData(testData: TestData): Promise<boolean> {
  console.log('\n📋 Cleaning up test data...');
  
  try {
    const Patient = mongoose.model('Patient');
    const Visit = mongoose.model('Visit');
    const MTRFollowUp = mongoose.model('MTRFollowUp');
    const Appointment = mongoose.model('Appointment');
    const User = mongoose.model('User');
    const Workplace = mongoose.model('Workplace');
    
    // Delete migrated appointments
    await Appointment.deleteMany({
      'metadata.source': 'mtr_migration',
      workplaceId: testData.workplaceId
    });
    
    // Delete test MTRFollowUp records
    await MTRFollowUp.deleteMany({
      _id: { $in: testData.mtrFollowUpIds }
    });
    
    // Delete test visits
    await Visit.deleteMany({
      _id: { $in: testData.visitIds }
    });
    
    // Delete test patients
    await Patient.deleteMany({
      _id: { $in: testData.patientIds }
    });
    
    // Delete test pharmacist
    await User.deleteOne({
      _id: testData.pharmacistId
    });
    
    // Delete test workplace
    await Workplace.deleteOne({
      _id: testData.workplaceId
    });
    
    console.log('✅ Test data cleaned up successfully');
    return true;
    
  } catch (error: any) {
    console.error(`❌ Cleanup failed: ${error.message}`);
    return false;
  }
}

/**
 * Main test function
 */
async function runMigrationTest(): Promise<void> {
  const results: TestResults = {
    testDataCreated: false,
    migrationSuccessful: false,
    dataIntegrityValid: false,
    cleanupSuccessful: false,
    errors: []
  };
  
  let testData: TestData | null = null;
  
  try {
    console.log('🧪 Starting Patient Engagement Migration Test');
    console.log('=============================================\n');
    
    await connectDatabase();
    await loadModels();
    
    // Phase 1: Create test data
    console.log('Phase 1: Creating test data');
    try {
      testData = await createTestData();
      results.testDataCreated = true;
    } catch (error: any) {
      const errorMsg = `Test data creation failed: ${error.message}`;
      console.error(`❌ ${errorMsg}`);
      results.errors.push(errorMsg);
      throw error;
    }
    
    // Phase 2: Run migration
    console.log('\nPhase 2: Running migration');
    try {
      results.migrationSuccessful = await runTestMigration(testData);
    } catch (error: any) {
      const errorMsg = `Migration test failed: ${error.message}`;
      console.error(`❌ ${errorMsg}`);
      results.errors.push(errorMsg);
    }
    
    // Phase 3: Verify results
    console.log('\nPhase 3: Verifying results');
    try {
      results.dataIntegrityValid = await verifyMigrationResults(testData);
    } catch (error: any) {
      const errorMsg = `Verification failed: ${error.message}`;
      console.error(`❌ ${errorMsg}`);
      results.errors.push(errorMsg);
    }
    
    // Phase 4: Cleanup
    console.log('\nPhase 4: Cleaning up');
    try {
      results.cleanupSuccessful = await cleanupTestData(testData);
    } catch (error: any) {
      const errorMsg = `Cleanup failed: ${error.message}`;
      console.error(`❌ ${errorMsg}`);
      results.errors.push(errorMsg);
    }
    
    // Print final results
    console.log('\n=============================================');
    console.log('📊 Test Results Summary');
    console.log('=============================================');
    console.log(`\nTest Phases:`);
    console.log(`  ✅ Test data creation: ${results.testDataCreated ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ Migration execution: ${results.migrationSuccessful ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ Data integrity verification: ${results.dataIntegrityValid ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ Cleanup: ${results.cleanupSuccessful ? 'PASS' : 'FAIL'}`);
    
    if (results.errors.length > 0) {
      console.log(`\n❌ Errors (${results.errors.length}):`);
      results.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }
    
    const allTestsPassed = (
      results.testDataCreated &&
      results.migrationSuccessful &&
      results.dataIntegrityValid &&
      results.cleanupSuccessful &&
      results.errors.length === 0
    );
    
    console.log(`\n🎯 Overall Result: ${allTestsPassed ? '✅ ALL TESTS PASSED' : '❌ TESTS FAILED'}`);
    
    if (allTestsPassed) {
      console.log('\n✅ Migration is ready for production deployment!');
    } else {
      console.log('\n❌ Migration needs fixes before production deployment.');
    }
    
  } catch (error: any) {
    console.error('\n❌ Test execution failed:', error.message);
    console.error(error.stack);
    
    // Attempt cleanup even if test failed
    if (testData) {
      try {
        await cleanupTestData(testData);
      } catch (cleanupError) {
        console.error('❌ Failed to cleanup after test failure:', cleanupError);
      }
    }
    
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run test if this script is executed directly
if (require.main === module) {
  runMigrationTest()
    .then(() => {
      console.log('\n✅ Test script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test script failed:', error);
      process.exit(1);
    });
}

export { 
  runMigrationTest,
  createTestData,
  runTestMigration,
  verifyMigrationResults,
  cleanupTestData
};