import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Patient from '../../models/Patient';
import PatientUser from '../../models/PatientUser';
import Workplace from '../../models/Workplace';
import { PatientProfileService } from '../../services/PatientProfileService';

describe('PatientProfileService', () => {
  let mongoServer: MongoMemoryServer;
  let workplaceId: mongoose.Types.ObjectId;
  let patientUserId: mongoose.Types.ObjectId;
  let patientId: mongoose.Types.ObjectId;

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
    await PatientUser.deleteMany({});
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

    // Create test patient record
    const patient = await Patient.create({
      workplaceId,
      mrn: 'TEST001',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '+2341234567890',
      allergies: [],
      chronicConditions: [],
      enhancedEmergencyContacts: [],
      insuranceInfo: {},
      patientLoggedVitals: [],
      createdBy: new mongoose.Types.ObjectId(),
    });
    patientId = patient._id;

    // Create test patient user
    const patientUser = await PatientUser.create({
      workplaceId,
      email: 'john.doe@example.com',
      passwordHash: 'hashedpassword',
      firstName: 'John',
      lastName: 'Doe',
      status: 'active',
      patientId,
      createdBy: new mongoose.Types.ObjectId(),
    });
    patientUserId = patientUser._id;
  });

  describe('getPatientProfile', () => {
    it('should retrieve patient profile successfully', async () => {
      const profile = await PatientProfileService.getPatientProfile(
        patientUserId.toString(),
        workplaceId.toString()
      );

      expect(profile).toBeTruthy();
      expect(profile?.firstName).toBe('John');
      expect(profile?.lastName).toBe('Doe');
      expect(profile?.workplaceId.toString()).toBe(workplaceId.toString());
    });

    it('should return null for non-existent patient user', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const profile = await PatientProfileService.getPatientProfile(
        nonExistentId.toString(),
        workplaceId.toString()
      );

      expect(profile).toBeNull();
    });

    it('should return null for patient user without linked patient record', async () => {
      // Create patient user without linked patient
      const unlinkedUser = await PatientUser.create({
        workplaceId,
        email: 'unlinked@example.com',
        passwordHash: 'hashedpassword',
        firstName: 'Unlinked',
        lastName: 'User',
        status: 'active',
        createdBy: new mongoose.Types.ObjectId(),
      });

      const profile = await PatientProfileService.getPatientProfile(
        unlinkedUser._id.toString(),
        workplaceId.toString()
      );

      expect(profile).toBeNull();
    });
  });

  describe('updatePatientProfile', () => {
    it('should update patient profile successfully', async () => {
      const updateData = {
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+2349876543210',
        weightKg: 70,
      };

      const updatedProfile = await PatientProfileService.updatePatientProfile(
        patientUserId.toString(),
        workplaceId.toString(),
        updateData
      );

      expect(updatedProfile.firstName).toBe('Jane');
      expect(updatedProfile.lastName).toBe('Smith');
      expect(updatedProfile.phone).toBe('+2349876543210');
      expect(updatedProfile.weightKg).toBe(70);
    });

    it('should validate email format', async () => {
      const updateData = {
        email: 'invalid-email',
      };

      await expect(
        PatientProfileService.updatePatientProfile(
          patientUserId.toString(),
          workplaceId.toString(),
          updateData
        )
      ).rejects.toThrow('Invalid email format');
    });

    it('should validate phone format', async () => {
      const updateData = {
        phone: '1234567890', // Invalid format
      };

      await expect(
        PatientProfileService.updatePatientProfile(
          patientUserId.toString(),
          workplaceId.toString(),
          updateData
        )
      ).rejects.toThrow('Phone must be in Nigerian format');
    });

    it('should validate date of birth', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const updateData = {
        dob: futureDate,
      };

      await expect(
        PatientProfileService.updatePatientProfile(
          patientUserId.toString(),
          workplaceId.toString(),
          updateData
        )
      ).rejects.toThrow('Date of birth cannot be in the future');
    });
  });

  describe('addAllergy', () => {
    it('should add allergy successfully', async () => {
      const allergyData = {
        allergen: 'Penicillin',
        reaction: 'Skin rash',
        severity: 'moderate' as const,
        notes: 'Developed after first dose',
      };

      const updatedPatient = await PatientProfileService.addAllergy(
        patientUserId.toString(),
        workplaceId.toString(),
        allergyData
      );

      expect(updatedPatient.allergies).toHaveLength(1);
      expect(updatedPatient.allergies[0].allergen).toBe('Penicillin');
      expect(updatedPatient.allergies[0].severity).toBe('moderate');
    });

    it('should prevent duplicate allergies', async () => {
      const allergyData = {
        allergen: 'Penicillin',
        reaction: 'Skin rash',
        severity: 'moderate' as const,
      };

      // Add first allergy
      await PatientProfileService.addAllergy(
        patientUserId.toString(),
        workplaceId.toString(),
        allergyData
      );

      // Try to add duplicate
      await expect(
        PatientProfileService.addAllergy(
          patientUserId.toString(),
          workplaceId.toString(),
          allergyData
        )
      ).rejects.toThrow('Allergy to Penicillin already exists');
    });

    it('should validate allergy data', async () => {
      const invalidAllergyData = {
        allergen: '', // Empty allergen
        reaction: 'Skin rash',
        severity: 'moderate' as const,
      };

      await expect(
        PatientProfileService.addAllergy(
          patientUserId.toString(),
          workplaceId.toString(),
          invalidAllergyData
        )
      ).rejects.toThrow('Allergen name is required');
    });
  });

  describe('updateAllergy', () => {
    let allergyId: string;

    beforeEach(async () => {
      const allergyData = {
        allergen: 'Penicillin',
        reaction: 'Skin rash',
        severity: 'moderate' as const,
      };

      const patient = await PatientProfileService.addAllergy(
        patientUserId.toString(),
        workplaceId.toString(),
        allergyData
      );

      allergyId = patient.allergies[0]._id!.toString();
    });

    it('should update allergy successfully', async () => {
      const updates = {
        severity: 'severe' as const,
        notes: 'Updated notes',
      };

      const updatedPatient = await PatientProfileService.updateAllergy(
        patientUserId.toString(),
        workplaceId.toString(),
        allergyId,
        updates
      );

      const updatedAllergy = updatedPatient.allergies.find(
        a => a._id!.toString() === allergyId
      );

      expect(updatedAllergy?.severity).toBe('severe');
      expect(updatedAllergy?.notes).toBe('Updated notes');
    });

    it('should throw error for non-existent allergy', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const updates = { severity: 'severe' as const };

      await expect(
        PatientProfileService.updateAllergy(
          patientUserId.toString(),
          workplaceId.toString(),
          nonExistentId,
          updates
        )
      ).rejects.toThrow('Allergy not found or update failed');
    });
  });

  describe('removeAllergy', () => {
    let allergyId: string;

    beforeEach(async () => {
      const allergyData = {
        allergen: 'Penicillin',
        reaction: 'Skin rash',
        severity: 'moderate' as const,
      };

      const patient = await PatientProfileService.addAllergy(
        patientUserId.toString(),
        workplaceId.toString(),
        allergyData
      );

      allergyId = patient.allergies[0]._id!.toString();
    });

    it('should remove allergy successfully', async () => {
      const updatedPatient = await PatientProfileService.removeAllergy(
        patientUserId.toString(),
        workplaceId.toString(),
        allergyId
      );

      expect(updatedPatient.allergies).toHaveLength(0);
    });
  });

  describe('addChronicCondition', () => {
    it('should add chronic condition successfully', async () => {
      const conditionData = {
        condition: 'Diabetes Type 2',
        diagnosedDate: new Date('2020-01-01'),
        managementPlan: 'Diet and exercise',
        status: 'active' as const,
      };

      const updatedPatient = await PatientProfileService.addChronicCondition(
        patientUserId.toString(),
        workplaceId.toString(),
        conditionData
      );

      expect(updatedPatient.chronicConditions).toHaveLength(1);
      expect(updatedPatient.chronicConditions[0].condition).toBe('Diabetes Type 2');
      expect(updatedPatient.chronicConditions[0].status).toBe('active');
    });

    it('should prevent duplicate conditions', async () => {
      const conditionData = {
        condition: 'Diabetes Type 2',
        diagnosedDate: new Date('2020-01-01'),
      };

      // Add first condition
      await PatientProfileService.addChronicCondition(
        patientUserId.toString(),
        workplaceId.toString(),
        conditionData
      );

      // Try to add duplicate
      await expect(
        PatientProfileService.addChronicCondition(
          patientUserId.toString(),
          workplaceId.toString(),
          conditionData
        )
      ).rejects.toThrow('Chronic condition Diabetes Type 2 already exists');
    });

    it('should validate diagnosed date', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const conditionData = {
        condition: 'Diabetes Type 2',
        diagnosedDate: futureDate,
      };

      await expect(
        PatientProfileService.addChronicCondition(
          patientUserId.toString(),
          workplaceId.toString(),
          conditionData
        )
      ).rejects.toThrow('Diagnosed date cannot be in the future');
    });
  });

  describe('addEmergencyContact', () => {
    it('should add emergency contact successfully', async () => {
      const contactData = {
        name: 'Jane Doe',
        relationship: 'Spouse',
        phone: '+2349876543210',
        email: 'jane@example.com',
        isPrimary: true,
        priority: 1,
      };

      const updatedPatient = await PatientProfileService.addEmergencyContact(
        patientUserId.toString(),
        workplaceId.toString(),
        contactData
      );

      expect(updatedPatient.enhancedEmergencyContacts).toHaveLength(1);
      expect(updatedPatient.enhancedEmergencyContacts[0].name).toBe('Jane Doe');
      expect(updatedPatient.enhancedEmergencyContacts[0].isPrimary).toBe(true);
    });

    it('should validate phone format', async () => {
      const contactData = {
        name: 'Jane Doe',
        relationship: 'Spouse',
        phone: '1234567890', // Invalid format
        priority: 1,
      };

      await expect(
        PatientProfileService.addEmergencyContact(
          patientUserId.toString(),
          workplaceId.toString(),
          contactData
        )
      ).rejects.toThrow('Phone must be in Nigerian format');
    });
  });

  describe('updateInsuranceInfo', () => {
    it('should update insurance information successfully', async () => {
      const insuranceData = {
        provider: 'NHIS',
        policyNumber: 'POL123456',
        expiryDate: new Date('2025-12-31'),
        coverageDetails: 'Full coverage',
        copayAmount: 1000,
        isActive: true,
      };

      const updatedPatient = await PatientProfileService.updateInsuranceInfo(
        patientUserId.toString(),
        workplaceId.toString(),
        insuranceData
      );

      expect(updatedPatient.insuranceInfo.provider).toBe('NHIS');
      expect(updatedPatient.insuranceInfo.policyNumber).toBe('POL123456');
      expect(updatedPatient.insuranceInfo.isActive).toBe(true);
    });

    it('should validate expiry date', async () => {
      const pastDate = new Date('2020-01-01');
      const insuranceData = {
        provider: 'NHIS',
        expiryDate: pastDate,
      };

      await expect(
        PatientProfileService.updateInsuranceInfo(
          patientUserId.toString(),
          workplaceId.toString(),
          insuranceData
        )
      ).rejects.toThrow('Insurance expiry date must be in the future');
    });
  });

  describe('logVitals', () => {
    it('should log vitals successfully', async () => {
      const vitalsData = {
        bloodPressure: { systolic: 120, diastolic: 80 },
        heartRate: 72,
        temperature: 36.5,
        weight: 70,
        glucose: 95,
        oxygenSaturation: 98,
        notes: 'Feeling good',
      };

      const updatedPatient = await PatientProfileService.logVitals(
        patientUserId.toString(),
        workplaceId.toString(),
        vitalsData
      );

      expect(updatedPatient.patientLoggedVitals).toHaveLength(1);
      expect(updatedPatient.patientLoggedVitals[0].bloodPressure?.systolic).toBe(120);
      expect(updatedPatient.patientLoggedVitals[0].heartRate).toBe(72);
      expect(updatedPatient.patientLoggedVitals[0].source).toBe('patient_portal');
    });

    it('should validate blood pressure values', async () => {
      const vitalsData = {
        bloodPressure: { systolic: 400, diastolic: 80 }, // Invalid systolic
      };

      await expect(
        PatientProfileService.logVitals(
          patientUserId.toString(),
          workplaceId.toString(),
          vitalsData
        )
      ).rejects.toThrow('Systolic blood pressure must be between 50 and 300 mmHg');
    });

    it('should validate heart rate', async () => {
      const vitalsData = {
        heartRate: 300, // Invalid heart rate
      };

      await expect(
        PatientProfileService.logVitals(
          patientUserId.toString(),
          workplaceId.toString(),
          vitalsData
        )
      ).rejects.toThrow('Heart rate must be between 30 and 250 bpm');
    });
  });

  describe('getVitalsHistory', () => {
    beforeEach(async () => {
      // Add some vitals entries
      const vitalsEntries = [
        {
          bloodPressure: { systolic: 120, diastolic: 80 },
          heartRate: 72,
          notes: 'Entry 1',
        },
        {
          bloodPressure: { systolic: 125, diastolic: 85 },
          heartRate: 75,
          notes: 'Entry 2',
        },
        {
          bloodPressure: { systolic: 118, diastolic: 78 },
          heartRate: 70,
          notes: 'Entry 3',
        },
      ];

      for (const vitals of vitalsEntries) {
        await PatientProfileService.logVitals(
          patientUserId.toString(),
          workplaceId.toString(),
          vitals
        );
        // Add small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    });

    it('should retrieve vitals history successfully', async () => {
      const history = await PatientProfileService.getVitalsHistory(
        patientUserId.toString(),
        workplaceId.toString(),
        10
      );

      expect(history).toHaveLength(3);
      // Should be sorted by newest first
      expect(history[0].notes).toBe('Entry 3');
      expect(history[1].notes).toBe('Entry 2');
      expect(history[2].notes).toBe('Entry 1');
    });

    it('should respect limit parameter', async () => {
      const history = await PatientProfileService.getVitalsHistory(
        patientUserId.toString(),
        workplaceId.toString(),
        2
      );

      expect(history).toHaveLength(2);
    });
  });

  describe('getLatestVitals', () => {
    it('should retrieve latest vitals successfully', async () => {
      const vitalsData = {
        bloodPressure: { systolic: 120, diastolic: 80 },
        heartRate: 72,
        notes: 'Latest entry',
      };

      await PatientProfileService.logVitals(
        patientUserId.toString(),
        workplaceId.toString(),
        vitalsData
      );

      const latestVitals = await PatientProfileService.getLatestVitals(
        patientUserId.toString(),
        workplaceId.toString()
      );

      expect(latestVitals).toBeTruthy();
      expect(latestVitals.notes).toBe('Latest entry');
      expect(latestVitals.heartRate).toBe(72);
    });

    it('should return null when no vitals exist', async () => {
      const latestVitals = await PatientProfileService.getLatestVitals(
        patientUserId.toString(),
        workplaceId.toString()
      );

      expect(latestVitals).toBeNull();
    });
  });
});