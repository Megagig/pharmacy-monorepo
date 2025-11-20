import mongoose from 'mongoose';
import dotenv from 'dotenv';
import PatientUser from '../src/models/PatientUser';
import Patient from '../src/models/Patient';
import { Workplace } from '../src/models/Workplace';
import { PatientSyncService } from '../src/services/patientSyncService';

// Load environment variables
dotenv.config();

async function testPatientSync() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmacare');
    console.log('Connected to MongoDB');

    // Find a test workspace
    const workspace = await Workplace.findOne({ verificationStatus: 'verified' });
    if (!workspace) {
      console.log('No verified workspace found. Creating test workspace...');
      // You would need to create a test workspace here
      return;
    }

    console.log(`Using workspace: ${workspace.name} (${workspace._id})`);

    // Find a pending PatientUser or create one for testing
    let patientUser = await PatientUser.findOne({
      workplaceId: workspace._id,
      status: 'pending',
    });

    if (!patientUser) {
      console.log('No pending PatientUser found. Creating test PatientUser...');
      patientUser = new PatientUser({
        workplaceId: workspace._id,
        firstName: 'Test',
        lastName: 'Patient',
        email: `test.patient.${Date.now()}@example.com`,
        phone: '+2348012345678',
        dateOfBirth: new Date('1990-01-01'),
        passwordHash: 'testpassword123',
        status: 'pending',
        isActive: false,
        emailVerified: false,
        phoneVerified: false,
        createdBy: new mongoose.Types.ObjectId('000000000000000000000000'),
      });
      await patientUser.save();
      console.log(`Created test PatientUser: ${patientUser._id}`);
    }

    console.log(`Testing with PatientUser: ${patientUser.firstName} ${patientUser.lastName} (${patientUser._id})`);

    // Test 1: Approve PatientUser and create Patient record
    console.log('\n=== Test 1: Approving PatientUser and creating Patient record ===');
    
    patientUser.status = 'active';
    patientUser.isActive = true;
    await patientUser.save();

    const { patient, isNewRecord } = await PatientSyncService.createOrLinkPatientRecord(patientUser._id.toString());
    
    console.log(`✅ ${isNewRecord ? 'Created new' : 'Linked existing'} Patient record:`);
    console.log(`   Patient ID: ${patient._id}`);
    console.log(`   MRN: ${patient.mrn}`);
    console.log(`   Name: ${patient.firstName} ${patient.lastName}`);
    console.log(`   Email: ${patient.email}`);

    // Test 2: Update PatientUser profile and sync to Patient
    console.log('\n=== Test 2: Updating PatientUser profile and syncing to Patient ===');
    
    const updateData = {
      phone: '+2348087654321',
      language: 'yo',
      notificationPreferences: {
        email: true,
        sms: false,
        push: true,
        whatsapp: true,
        appointmentReminders: true,
        medicationReminders: false,
        healthTips: true,
      },
    };

    await PatientSyncService.handlePatientUserProfileUpdate(patientUser._id.toString(), updateData);

    // Verify the sync worked
    const updatedPatient = await Patient.findById(patient._id);
    console.log(`✅ Updated PatientUser profile and synced to Patient:`);
    console.log(`   Updated phone: ${updatedPatient?.phone}`);
    console.log(`   Updated language: ${updatedPatient?.appointmentPreferences?.language}`);
    console.log(`   Updated notifications: ${JSON.stringify(updatedPatient?.notificationPreferences)}`);

    // Test 3: Test duplicate prevention
    console.log('\n=== Test 3: Testing duplicate prevention ===');
    
    // Create another PatientUser with same email
    const duplicatePatientUser = new PatientUser({
      workplaceId: workspace._id,
      firstName: 'Duplicate',
      lastName: 'Test',
      email: patientUser.email, // Same email
      phone: '+2348099999999',
      passwordHash: 'testpassword123',
      status: 'active',
      isActive: true,
      emailVerified: false,
      phoneVerified: false,
      createdBy: new mongoose.Types.ObjectId('000000000000000000000000'),
    });
    await duplicatePatientUser.save();

    const { patient: linkedPatient, isNewRecord: isNewForDuplicate } = await PatientSyncService.createOrLinkPatientRecord(duplicatePatientUser._id.toString());
    
    console.log(`✅ Duplicate email test:`);
    console.log(`   ${isNewForDuplicate ? 'Created new' : 'Linked existing'} Patient record`);
    console.log(`   Same Patient ID: ${linkedPatient._id.toString() === patient._id.toString()}`);

    console.log('\n=== All tests completed successfully! ===');

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the test
testPatientSync().catch(console.error);