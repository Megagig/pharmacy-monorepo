import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Patient from '../../models/Patient';
import Workplace from '../../models/Workplace';
import {
  enhancePatientProfile,
  rollbackPatientProfileEnhancement,
  createPatientPortalIndexes,
} from '../../../scripts/migrations/enhance-patient-profile';

describe('Patient Profile Enhancement Migration', () => {
  let mongoServer: MongoMemoryServer;
  let workplaceId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear all collections
    await Patient.deleteMany({});
    await Workplace.deleteMany({});

    // Create test workplace
    const workplace = await Workplace.create({
      name: 'Test Pharmacy',
      email: 'test@pharmacy.com',
      phone: '+2341234567890',
      address: 'Test Address',
      subscriptionStatus: 'active',
      isActive: true,
      createdBy: new mongoose.Types.ObjectId(),
    });
    workplaceId = workplace._id;
  });

  describe('enhancePatientProfile', () => {
    it('should add new fields to existing patients without new fields', async () => {
      // Create patients without new fields using direct MongoDB operations
      // to simulate old patient records
      await Patient.collection.insertMany([
        {
          workplaceId,
          mrn: 'TEST001',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          createdBy: new mongoose.Types.ObjectId(),
          createdAt: new Date(),
          updatedAt: new Date(),
          isDeleted: false,
        },
        {
          workplaceId,
          mrn: 'TEST002',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          createdBy: new mongoose.Types.ObjectId(),
          createdAt: new Date(),
          updatedAt: new Date(),
          isDeleted: false,
        },
      ]);

      // Verify patients don't have new fields
      const patientsBefore = await Patient.find({});
      expect(patientsBefore).toHaveLength(2);
      expect(patientsBefore[0].allergies).toBeUndefined();
      expect(patientsBefore[0].chronicConditions).toBeUndefined();

      // Run migration
      const result = await enhancePatientProfile();

      // Verify migration result
      expect(result.success).toBe(true);
      expect(result.patientsUpdated).toBe(2);
      expect(result.errors).toHaveLength(0);

      // Verify patients now have new fields
      const patientsAfter = await Patient.find({});
      expect(patientsAfter).toHaveLength(2);

      for (const patient of patientsAfter) {
        expect(patient.allergies).toBeDefined();
        expect(patient.allergies).toEqual([]);
        expect(patient.chronicConditions).toBeDefined();
        expect(patient.chronicConditions).toEqual([]);
        expect(patient.enhancedEmergencyContacts).toBeDefined();
        expect(patient.enhancedEmergencyContacts).toEqual([]);
        expect(patient.patientLoggedVitals).toBeDefined();
        expect(patient.patientLoggedVitals).toEqual([]);
        expect(patient.insuranceInfo).toBeDefined();
        expect(patient.insuranceInfo.isActive).toBe(false);
      }
    });

    it('should not update patients that already have new fields', async () => {
      // Create patients with new fields already present
      await Patient.create([
        {
          workplaceId,
          mrn: 'TEST001',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          allergies: [
            {
              allergen: 'Penicillin',
              reaction: 'Rash',
              severity: 'moderate',
              recordedDate: new Date(),
            },
          ],
          chronicConditions: [],
          enhancedEmergencyContacts: [],
          insuranceInfo: { isActive: true },
          patientLoggedVitals: [],
          createdBy: new mongoose.Types.ObjectId(),
        },
      ]);

      // Run migration
      const result = await enhancePatientProfile();

      // Should report success but no updates
      expect(result.success).toBe(true);
      expect(result.patientsUpdated).toBe(0);

      // Verify existing data is preserved
      const patient = await Patient.findOne({ mrn: 'TEST001' });
      expect(patient?.allergies).toHaveLength(1);
      expect(patient?.allergies[0].allergen).toBe('Penicillin');
      expect(patient?.insuranceInfo.isActive).toBe(true);
    });

    it('should handle empty database gracefully', async () => {
      // Run migration on empty database
      const result = await enhancePatientProfile();

      expect(result.success).toBe(true);
      expect(result.patientsUpdated).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle large batches of patients', async () => {
      // Create 250 patients to test batch processing
      const patients = [];
      for (let i = 1; i <= 250; i++) {
        patients.push({
          workplaceId,
          mrn: `TEST${i.toString().padStart(3, '0')}`,
          firstName: `Patient${i}`,
          lastName: 'Test',
          email: `patient${i}@example.com`,
          createdBy: new mongoose.Types.ObjectId(),
          createdAt: new Date(),
          updatedAt: new Date(),
          isDeleted: false,
        });
      }

      await Patient.collection.insertMany(patients);

      // Run migration
      const result = await enhancePatientProfile();

      expect(result.success).toBe(true);
      expect(result.patientsUpdated).toBe(250);
      expect(result.errors).toHaveLength(0);

      // Verify all patients have new fields
      const updatedPatients = await Patient.find({});
      expect(updatedPatients).toHaveLength(250);

      // Check a few random patients
      const samplePatients = [updatedPatients[0], updatedPatients[100], updatedPatients[249]];
      for (const patient of samplePatients) {
        expect(patient.allergies).toBeDefined();
        expect(patient.chronicConditions).toBeDefined();
        expect(patient.enhancedEmergencyContacts).toBeDefined();
        expect(patient.insuranceInfo).toBeDefined();
        expect(patient.patientLoggedVitals).toBeDefined();
      }
    });
  });

  describe('rollbackPatientProfileEnhancement', () => {
    beforeEach(async () => {
      // Create patients with new fields
      await Patient.create([
        {
          workplaceId,
          mrn: 'TEST001',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          allergies: [
            {
              allergen: 'Penicillin',
              reaction: 'Rash',
              severity: 'moderate',
              recordedDate: new Date(),
            },
          ],
          chronicConditions: [
            {
              condition: 'Diabetes',
              diagnosedDate: new Date('2020-01-01'),
              status: 'active',
            },
          ],
          enhancedEmergencyContacts: [
            {
              name: 'Jane Doe',
              relationship: 'Spouse',
              phone: '+2349876543210',
              isPrimary: true,
              priority: 1,
            },
          ],
          insuranceInfo: {
            provider: 'NHIS',
            policyNumber: 'POL123',
            isActive: true,
          },
          patientLoggedVitals: [
            {
              recordedDate: new Date(),
              bloodPressure: { systolic: 120, diastolic: 80 },
              source: 'patient_portal',
            },
          ],
          createdBy: new mongoose.Types.ObjectId(),
        },
      ]);
    });

    it('should remove new fields from patients', async () => {
      // Verify patient has new fields before rollback
      const patientBefore = await Patient.findOne({ mrn: 'TEST001' });
      expect(patientBefore?.allergies).toHaveLength(1);
      expect(patientBefore?.chronicConditions).toHaveLength(1);

      // Run rollback
      const result = await rollbackPatientProfileEnhancement();

      expect(result.success).toBe(true);
      expect(result.patientsUpdated).toBe(1);
      expect(result.errors).toHaveLength(0);

      // Verify new fields are removed
      const patientAfter = await Patient.findOne({ mrn: 'TEST001' });
      expect(patientAfter?.allergies).toBeUndefined();
      expect(patientAfter?.chronicConditions).toBeUndefined();
      expect(patientAfter?.enhancedEmergencyContacts).toBeUndefined();
      expect(patientAfter?.insuranceInfo).toBeUndefined();
      expect(patientAfter?.patientLoggedVitals).toBeUndefined();

      // Verify core fields are preserved
      expect(patientAfter?.firstName).toBe('John');
      expect(patientAfter?.lastName).toBe('Doe');
      expect(patientAfter?.mrn).toBe('TEST001');
    });

    it('should handle patients without new fields gracefully', async () => {
      // Remove all patients and create one without new fields
      await Patient.deleteMany({});
      await Patient.collection.insertOne({
        workplaceId,
        mrn: 'TEST001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        createdBy: new mongoose.Types.ObjectId(),
        createdAt: new Date(),
        updatedAt: new Date(),
        isDeleted: false,
      });

      // Run rollback
      const result = await rollbackPatientProfileEnhancement();

      expect(result.success).toBe(true);
      expect(result.patientsUpdated).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('createPatientPortalIndexes', () => {
    it('should create indexes without errors', async () => {
      // This test verifies that the index creation doesn't throw errors
      // In a real database, you would check if indexes actually exist
      await expect(createPatientPortalIndexes()).resolves.not.toThrow();
    });

    it('should handle index creation on empty collection', async () => {
      // Ensure collection is empty
      await Patient.deleteMany({});

      // Should still create indexes successfully
      await expect(createPatientPortalIndexes()).resolves.not.toThrow();
    });
  });

  describe('Migration Integration', () => {
    it('should run full migration workflow successfully', async () => {
      // Create old-style patients
      await Patient.collection.insertMany([
        {
          workplaceId,
          mrn: 'TEST001',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          createdBy: new mongoose.Types.ObjectId(),
          createdAt: new Date(),
          updatedAt: new Date(),
          isDeleted: false,
        },
        {
          workplaceId,
          mrn: 'TEST002',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          createdBy: new mongoose.Types.ObjectId(),
          createdAt: new Date(),
          updatedAt: new Date(),
          isDeleted: false,
        },
      ]);

      // Run migration
      const migrationResult = await enhancePatientProfile();
      expect(migrationResult.success).toBe(true);
      expect(migrationResult.patientsUpdated).toBe(2);

      // Create indexes
      await expect(createPatientPortalIndexes()).resolves.not.toThrow();

      // Verify patients can be queried with new fields
      const patientsWithAllergies = await Patient.find({ 'allergies.0': { $exists: false } });
      expect(patientsWithAllergies).toHaveLength(2);

      const patientsWithInsurance = await Patient.find({ 'insuranceInfo.isActive': false });
      expect(patientsWithInsurance).toHaveLength(2);
    });
  });
});