import mongoose from 'mongoose';
import MedicationManagement from '../models/MedicationManagement';
import Medication from '../models/Medication';
import AdherenceLog from '../models/AdherenceLog';
import AdherenceTracking from '../modules/diagnostics/models/AdherenceTracking';
import Patient from '../models/Patient';
import User from '../models/User';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const PATIENT_ID = '690ecada0aabc60041eef019'; // The patient ID from the logs
const WORKSPACE_ID = '68b5cd85f1f0f9758b8afbbf'; // The workspace ID from the logs

async function seedMedicationData() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharma-care-saas';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Check if patient exists
    const patient = await Patient.findById(PATIENT_ID);
    if (!patient) {
      console.log('❌ Patient not found. Creating patient first...');
      // Create a basic patient record
      const newPatient = new Patient({
        _id: PATIENT_ID,
        workspaceId: WORKSPACE_ID,
        firstName: 'China',
        lastName: 'Okeke',
        email: 'nekewon610@lovleo.com',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'female',
        phone: '+1234567890',
        address: {
          street: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zipCode: '12345',
          country: 'USA'
        },
        emergencyContact: {
          name: 'Emergency Contact',
          phone: '+1234567890',
          relationship: 'Family'
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      await newPatient.save();
      console.log('✅ Patient created');
    } else {
      console.log('✅ Patient found');
    }

    // Clear existing medications for this patient
    await MedicationManagement.deleteMany({ patientId: PATIENT_ID });
    await Medication.deleteMany({ patient: PATIENT_ID });
    await AdherenceLog.deleteMany({ patientId: PATIENT_ID });
    await AdherenceTracking.deleteMany({ patientId: PATIENT_ID });
    console.log('🧹 Cleared existing medication data');

    // Find a pharmacist user to assign to medications
    const pharmacist = await User.findOne({ 
      workplaceId: WORKSPACE_ID,
      role: { $in: ['pharmacist', 'admin', 'super_admin'] }
    });
    
    if (!pharmacist) {
      console.log('❌ No pharmacist found. Creating a basic user...');
      // Create a basic pharmacist user for testing
      const newPharmacist = new User({
        firstName: 'Test',
        lastName: 'Pharmacist',
        email: 'pharmacist@test.com',
        password: 'hashedpassword', // This would normally be hashed
        role: 'pharmacist',
        workplaceId: WORKSPACE_ID,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      await newPharmacist.save();
      console.log('✅ Pharmacist user created');
    }

    const pharmacistId = pharmacist?._id || (await User.findOne({ workplaceId: WORKSPACE_ID }))?._id;

    // Sample medications using the Medication model
    const medications = [
      {
        patient: PATIENT_ID,
        pharmacist: pharmacistId,
        drugName: 'Lisinopril',
        genericName: 'Lisinopril',
        strength: {
          value: 10,
          unit: 'mg'
        },
        dosageForm: 'tablet',
        instructions: {
          dosage: '10mg',
          frequency: 'Once daily',
          duration: '1 year',
          specialInstructions: 'Take with or without food'
        },
        prescriber: {
          name: 'Dr. Smith',
          contact: 'dr.smith@clinic.com'
        },
        prescription: {
          rxNumber: 'RX001',
          dateIssued: new Date('2024-01-15'),
          dateExpires: new Date('2025-01-15'),
          refillsRemaining: 5
        },
        therapy: {
          indication: 'Hypertension',
          goalOfTherapy: 'Blood pressure control',
          monitoring: ['Blood pressure', 'Kidney function']
        },
        interactions: [],
        sideEffects: ['Dizziness', 'Dry cough'],
        status: 'active',
        adherence: {
          lastReported: new Date(),
          score: 88
        },
        isManual: false
      },
      {
        patient: PATIENT_ID,
        pharmacist: pharmacistId,
        drugName: 'Metformin',
        genericName: 'Metformin HCl',
        strength: {
          value: 500,
          unit: 'mg'
        },
        dosageForm: 'tablet',
        instructions: {
          dosage: '500mg',
          frequency: 'Twice daily',
          duration: '1 year',
          specialInstructions: 'Take with meals to reduce stomach upset'
        },
        prescriber: {
          name: 'Dr. Johnson',
          contact: 'dr.johnson@clinic.com'
        },
        prescription: {
          rxNumber: 'RX002',
          dateIssued: new Date('2024-02-01'),
          dateExpires: new Date('2025-02-01'),
          refillsRemaining: 3
        },
        therapy: {
          indication: 'Type 2 Diabetes',
          goalOfTherapy: 'Glycemic control',
          monitoring: ['Blood glucose', 'HbA1c', 'Kidney function']
        },
        interactions: [],
        sideEffects: ['Nausea', 'Diarrhea', 'Metallic taste'],
        status: 'active',
        adherence: {
          lastReported: new Date(),
          score: 92
        },
        isManual: false
      },
      {
        patient: PATIENT_ID,
        pharmacist: pharmacistId,
        drugName: 'Atorvastatin',
        genericName: 'Atorvastatin Calcium',
        strength: {
          value: 20,
          unit: 'mg'
        },
        dosageForm: 'tablet',
        instructions: {
          dosage: '20mg',
          frequency: 'Once daily',
          duration: '1 year',
          specialInstructions: 'Take in the evening'
        },
        prescriber: {
          name: 'Dr. Wilson',
          contact: 'dr.wilson@clinic.com'
        },
        prescription: {
          rxNumber: 'RX003',
          dateIssued: new Date('2024-03-01'),
          dateExpires: new Date('2025-03-01'),
          refillsRemaining: 4
        },
        therapy: {
          indication: 'High cholesterol',
          goalOfTherapy: 'Cholesterol reduction',
          monitoring: ['Lipid panel', 'Liver function']
        },
        interactions: [],
        sideEffects: ['Muscle pain', 'Headache'],
        status: 'active',
        adherence: {
          lastReported: new Date(),
          score: 85
        },
        isManual: false
      },
      {
        patient: PATIENT_ID,
        pharmacist: pharmacistId,
        drugName: 'Aspirin',
        genericName: 'Acetylsalicylic Acid',
        strength: {
          value: 81,
          unit: 'mg'
        },
        dosageForm: 'tablet',
        instructions: {
          dosage: '81mg',
          frequency: 'Once daily',
          duration: '1 year',
          specialInstructions: 'Take with food'
        },
        prescriber: {
          name: 'Dr. Smith',
          contact: 'dr.smith@clinic.com'
        },
        prescription: {
          rxNumber: 'RX004',
          dateIssued: new Date('2023-12-01'),
          dateExpires: new Date('2024-11-01'),
          refillsRemaining: 0
        },
        therapy: {
          indication: 'Cardiovascular protection',
          goalOfTherapy: 'Prevent cardiovascular events',
          monitoring: ['Bleeding risk']
        },
        interactions: [],
        sideEffects: ['Stomach irritation'],
        status: 'discontinued',
        adherence: {
          lastReported: new Date('2024-10-01'),
          score: 75
        },
        isManual: false
      }
    ];

    // Insert medications
    const createdMedications = await Medication.insertMany(medications);
    console.log(`✅ Created ${createdMedications.length} medications`);

    // Create some adherence logs
    const adherenceLogs = [];
    const today = new Date();
    
    for (const medication of createdMedications.slice(0, 3)) { // Only for active medications
      // Create adherence logs for the past few refills
      for (let i = 0; i < 5; i++) {
        const refillDate = new Date(today);
        refillDate.setDate(today.getDate() - (i * 30)); // Every 30 days
        
        // Simulate adherence scores between 70-95%
        const adherenceScore = Math.floor(Math.random() * 25) + 70;
        
        adherenceLogs.push({
          patientId: PATIENT_ID,
          workplaceId: WORKSPACE_ID,
          medicationId: medication._id,
          refillDate: refillDate,
          adherenceScore: adherenceScore,
          pillCount: Math.floor(Math.random() * 10) + 25, // 25-35 pills remaining
          notes: `Adherence score: ${adherenceScore}%. Patient compliance good.`,
          createdBy: PATIENT_ID,
          updatedBy: PATIENT_ID
        });
      }
    }

    const createdLogs = await AdherenceLog.insertMany(adherenceLogs);
    console.log(`✅ Created ${createdLogs.length} adherence logs`);

    // Create AdherenceTracking record that the patient portal expects
    const adherenceTracking = new AdherenceTracking({
      patientId: PATIENT_ID,
      workplaceId: WORKSPACE_ID,
      medications: [
        {
          medicationName: 'Lisinopril',
          dosage: '10mg',
          frequency: 'Once daily',
          prescribedDate: new Date('2024-01-15'),
          adherenceScore: 88,
          adherenceStatus: 'good',
          missedDoses: 3,
          totalDoses: 25,
          refillHistory: [
            {
              date: new Date('2024-01-15'),
              daysSupply: 30,
              source: 'pharmacy',
              notes: 'Initial prescription'
            },
            {
              date: new Date('2024-02-14'),
              daysSupply: 30,
              source: 'pharmacy',
              notes: 'First refill'
            }
          ]
        },
        {
          medicationName: 'Metformin',
          dosage: '500mg',
          frequency: 'Twice daily',
          prescribedDate: new Date('2024-02-01'),
          adherenceScore: 92,
          adherenceStatus: 'excellent',
          missedDoses: 2,
          totalDoses: 50,
          refillHistory: [
            {
              date: new Date('2024-02-01'),
              daysSupply: 30,
              source: 'pharmacy',
              notes: 'Initial prescription'
            }
          ]
        },
        {
          medicationName: 'Atorvastatin',
          dosage: '20mg',
          frequency: 'Once daily',
          prescribedDate: new Date('2024-03-01'),
          adherenceScore: 85,
          adherenceStatus: 'good',
          missedDoses: 4,
          totalDoses: 25,
          refillHistory: [
            {
              date: new Date('2024-03-01'),
              daysSupply: 30,
              source: 'pharmacy',
              notes: 'Initial prescription'
            }
          ]
        }
      ],
      overallAdherenceScore: 88,
      adherenceCategory: 'good',
      lastAssessmentDate: new Date(),
      nextAssessmentDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      monitoringActive: true,
      monitoringStartDate: new Date('2024-01-15'),
      monitoringFrequency: 'weekly',
      alerts: [],
      alertPreferences: {
        enableRefillReminders: true,
        enableAdherenceAlerts: true,
        reminderDaysBefore: 7,
        escalationThreshold: 3
      },
      interventions: [],
      createdBy: PATIENT_ID,
      updatedBy: PATIENT_ID
    });

    await adherenceTracking.save();
    console.log('✅ Created adherence tracking record');

    console.log('🎉 Sample medication data seeded successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding medication data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

// Run the seeding function
if (require.main === module) {
  seedMedicationData();
}

export default seedMedicationData;