import mongoose from 'mongoose';
import dotenv from 'dotenv';
import PatientUser from '../src/models/PatientUser';
import Patient from '../src/models/Patient';
import { Workplace } from '../src/models/Workplace';

// Load environment variables
dotenv.config();

async function debugPatientSync() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmacare');
    console.log('Connected to MongoDB');

    // Get all workspaces
    const workspaces = await Workplace.find({}).select('_id name inviteCode verificationStatus');
    console.log('\n=== Available Workspaces ===');
    workspaces.forEach(workspace => {
      console.log(`${workspace.name} (${workspace._id}) - Status: ${workspace.verificationStatus} - Code: ${workspace.inviteCode}`);
    });

    // Get all PatientUsers
    const patientUsers = await PatientUser.find({})
      .populate('workplaceId', 'name')
      .select('_id firstName lastName email status isActive patientId workplaceId createdAt');
    
    console.log('\n=== PatientUsers ===');
    patientUsers.forEach(user => {
      console.log(`${user.firstName} ${user.lastName} (${user._id})`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Status: ${user.status} | Active: ${user.isActive}`);
      console.log(`  Workspace: ${(user.workplaceId as any)?.name} (${user.workplaceId})`);
      console.log(`  Linked Patient ID: ${user.patientId || 'None'}`);
      console.log(`  Created: ${user.createdAt}`);
      console.log('---');
    });

    // Get all Patients
    const patients = await Patient.find({})
      .populate('workplaceId', 'name')
      .select('_id firstName lastName email mrn workplaceId createdBy createdAt');
    
    console.log('\n=== Patients ===');
    patients.forEach(patient => {
      console.log(`${patient.firstName} ${patient.lastName} (${patient._id})`);
      console.log(`  Email: ${patient.email}`);
      console.log(`  MRN: ${patient.mrn}`);
      console.log(`  Workspace: ${(patient.workplaceId as any)?.name} (${patient.workplaceId})`);
      console.log(`  Created By: ${patient.createdBy}`);
      console.log(`  Created: ${patient.createdAt}`);
      console.log('---');
    });

    // Check for PatientUsers that should have linked Patient records
    console.log('\n=== Sync Analysis ===');
    const activePatientUsers = patientUsers.filter(user => user.status === 'active' && user.isActive);
    
    for (const user of activePatientUsers) {
      if (!user.patientId) {
        console.log(`❌ MISSING LINK: PatientUser ${user.firstName} ${user.lastName} (${user._id}) is active but has no linked Patient record`);
        
        // Check if there's a Patient with matching email
        const matchingPatient = patients.find(p => 
          p.email === user.email && 
          p.workplaceId.toString() === user.workplaceId.toString()
        );
        
        if (matchingPatient) {
          console.log(`   ⚠️  Found matching Patient record: ${matchingPatient._id}`);
          console.log(`   💡 Consider linking PatientUser ${user._id} to Patient ${matchingPatient._id}`);
        } else {
          console.log(`   ❌ No matching Patient record found`);
          console.log(`   💡 Patient record should be created for this user`);
        }
      } else {
        const linkedPatient = patients.find(p => p._id.toString() === user.patientId.toString());
        if (linkedPatient) {
          console.log(`✅ LINKED: PatientUser ${user.firstName} ${user.lastName} → Patient ${linkedPatient.mrn}`);
        } else {
          console.log(`❌ BROKEN LINK: PatientUser ${user.firstName} ${user.lastName} links to non-existent Patient ${user.patientId}`);
        }
      }
    }

    // Check for recent activity
    const recentPatientUsers = await PatientUser.find({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    }).populate('workplaceId', 'name');

    const recentPatients = await Patient.find({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    }).populate('workplaceId', 'name');

    console.log('\n=== Recent Activity (Last 24 hours) ===');
    console.log(`Recent PatientUsers: ${recentPatientUsers.length}`);
    recentPatientUsers.forEach(user => {
      console.log(`  - ${user.firstName} ${user.lastName} (${user.status}) in ${(user.workplaceId as any)?.name}`);
    });

    console.log(`Recent Patients: ${recentPatients.length}`);
    recentPatients.forEach(patient => {
      console.log(`  - ${patient.firstName} ${patient.lastName} (${patient.mrn}) in ${(patient.workplaceId as any)?.name}`);
    });

  } catch (error) {
    console.error('Debug failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the debug
debugPatientSync().catch(console.error);