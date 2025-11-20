import mongoose from 'mongoose';
import dotenv from 'dotenv';
import PatientUser from '../src/models/PatientUser';
import Patient from '../src/models/Patient';
import { Workplace } from '../src/models/Workplace';

// Load environment variables
dotenv.config();

async function testPatientApproval() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmacare');
    console.log('Connected to MongoDB');

    // Find a verified workspace
    const workspace = await Workplace.findOne({ verificationStatus: 'verified' });
    if (!workspace) {
      console.log('❌ No verified workspace found');
      return;
    }

    console.log(`✅ Using workspace: ${workspace.name} (${workspace._id})`);

    // Create a test PatientUser
    const testEmail = `test.patient.${Date.now()}@example.com`;
    console.log(`\n=== Creating Test PatientUser ===`);
    
    const patientUser = new PatientUser({
      workplaceId: workspace._id,
      firstName: 'Test',
      lastName: 'Patient',
      email: testEmail,
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
    console.log(`✅ Created PatientUser: ${patientUser._id}`);
    console.log(`   Name: ${patientUser.firstName} ${patientUser.lastName}`);
    console.log(`   Email: ${patientUser.email}`);
    console.log(`   Status: ${patientUser.status}`);

    // Check if Patient record exists (should not exist yet)
    let patientRecord = await Patient.findOne({ 
      workplaceId: workspace._id, 
      email: testEmail 
    });
    console.log(`   Linked Patient Record: ${patientRecord ? patientRecord._id : 'None'}`);

    // Simulate approval by updating status
    console.log(`\n=== Simulating Approval ===`);
    patientUser.status = 'active';
    patientUser.isActive = true;
    
    console.log('Saving PatientUser with active status...');
    await patientUser.save();
    console.log('✅ PatientUser saved');

    // Wait a moment for post-save hook to execute
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check if Patient record was created
    console.log(`\n=== Checking Results ===`);
    const updatedPatientUser = await PatientUser.findById(patientUser._id);
    console.log(`PatientUser Status: ${updatedPatientUser?.status}`);
    console.log(`PatientUser Active: ${updatedPatientUser?.isActive}`);
    console.log(`PatientUser Linked Patient ID: ${updatedPatientUser?.patientId || 'None'}`);

    patientRecord = await Patient.findOne({ 
      workplaceId: workspace._id, 
      email: testEmail 
    });

    if (patientRecord) {
      console.log(`✅ Patient Record Created:`);
      console.log(`   Patient ID: ${patientRecord._id}`);
      console.log(`   MRN: ${patientRecord.mrn}`);
      console.log(`   Name: ${patientRecord.firstName} ${patientRecord.lastName}`);
      console.log(`   Email: ${patientRecord.email}`);
      console.log(`   Workspace: ${patientRecord.workplaceId}`);
    } else {
      console.log(`❌ No Patient Record Found`);
      console.log(`   This indicates the sync is not working properly`);
    }

    // Check if PatientUser is properly linked
    if (updatedPatientUser?.patientId && patientRecord) {
      if (updatedPatientUser.patientId.toString() === patientRecord._id.toString()) {
        console.log(`✅ PatientUser is properly linked to Patient record`);
      } else {
        console.log(`❌ PatientUser link mismatch`);
        console.log(`   PatientUser.patientId: ${updatedPatientUser.patientId}`);
        console.log(`   Patient._id: ${patientRecord._id}`);
      }
    } else {
      console.log(`❌ PatientUser is not linked to Patient record`);
    }

    console.log(`\n=== Test Complete ===`);

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the test
testPatientApproval().catch(console.error);