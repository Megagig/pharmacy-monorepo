import mongoose from 'mongoose';
import MedicationManagement from '../models/MedicationManagement';
import Medication from '../models/Medication';
import Patient from '../models/Patient';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const PATIENT_ID = '690ecada0aabc60041eef019'; // The patient ID from the logs
const WORKSPACE_ID = '68b5cd85f1f0f9758b8afbbf'; // The workspace ID from the logs

async function checkMedicationData() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharma-care-saas';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Check if patient exists
    const patient = await Patient.findById(PATIENT_ID);
    console.log('👤 Patient exists:', !!patient);
    if (patient) {
      console.log(`   Name: ${patient.firstName} ${patient.lastName}`);
      console.log(`   Email: ${patient.email}`);
      console.log(`   Workspace: ${patient.workplaceId}`);
    }

    // Check MedicationManagement collection (workspace medications)
    const workspaceMedications = await MedicationManagement.find({
      patientId: PATIENT_ID,
      workplaceId: WORKSPACE_ID
    });
    console.log(`\n💊 Workspace Medications (MedicationManagement): ${workspaceMedications.length}`);
    workspaceMedications.forEach((med, index) => {
      console.log(`   ${index + 1}. ${med.name} ${med.dosage} - ${med.status}`);
    });

    // Check all MedicationManagement for this patient (any workspace)
    const allWorkspaceMedications = await MedicationManagement.find({
      patientId: PATIENT_ID
    });
    console.log(`\n💊 All Workspace Medications for patient: ${allWorkspaceMedications.length}`);
    allWorkspaceMedications.forEach((med, index) => {
      console.log(`   ${index + 1}. ${med.name} ${med.dosage} - ${med.status} (Workspace: ${med.workplaceId})`);
    });

    // Check Medication collection (patient portal medications)
    const portalMedications = await Medication.find({
      patient: PATIENT_ID
    });
    console.log(`\n🏥 Patient Portal Medications (Medication): ${portalMedications.length}`);
    portalMedications.forEach((med, index) => {
      console.log(`   ${index + 1}. ${med.drugName} - ${med.status}`);
    });

    // Check all patients in the workspace
    const allPatients = await Patient.find({
      workplaceId: WORKSPACE_ID
    });
    console.log(`\n👥 All patients in workspace: ${allPatients.length}`);
    allPatients.forEach((patient, index) => {
      console.log(`   ${index + 1}. ${patient.firstName} ${patient.lastName} (${patient._id})`);
    });

    // Check if there are any medications for any patient in this workspace
    const anyWorkspaceMedications = await MedicationManagement.find({
      workplaceId: WORKSPACE_ID
    });
    console.log(`\n💊 Total medications in workspace: ${anyWorkspaceMedications.length}`);
    anyWorkspaceMedications.forEach((med, index) => {
      console.log(`   ${index + 1}. ${med.name} for patient ${med.patientId} - ${med.status}`);
    });

  } catch (error) {
    console.error('❌ Error checking medication data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📡 Disconnected from MongoDB');
  }
}

// Run the check function
if (require.main === module) {
  checkMedicationData();
}

export default checkMedicationData;