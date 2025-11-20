import mongoose from 'mongoose';
import Patient, { IPatient } from '../../models/Patient';

describe('Enhanced Patient Model', () => {
  let testWorkplaceId: mongoose.Types.ObjectId;
  let testUserId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    testWorkplaceId = new mongoose.Types.ObjectId();
    testUserId = new mongoose.Types.ObjectId();
  });

  beforeEach(async () => {
    await Patient.deleteMany({});
  });

  describe('New Fields Validation', () => {
    const getValidPatientData = (suffix: string = '001') => ({
      workplaceId: testWorkplaceId,
      mrn: `TEST-${suffix}`,
      firstName: 'John',
      lastName: 'Doe',
      dob: new Date('1990-01-01'),
      createdBy: testUserId,
    });

    it('should create patient with new empty arrays', async () => {
      const patient = new Patient(getValidPatientData());
      const savedPatient = await patient.save();

      expect(savedPatient.allergies).toEqual([]);
      expect(savedPatient.chronicConditions).toEqual([]);
      expect(savedPatient.enhancedEmergencyContacts).toEqual([]);
      expect(savedPatient.patientLoggedVitals).toEqual([]);
      expect(savedPatient.insuranceInfo).toBeDefined();
    });

    it('should validate allergy fields', async () => {
      const patientWithAllergy = {
        ...getValidPatientData('002'),
        allergies: [
          {
            allergen: 'Penicillin',
            reaction: 'Skin rash and itching',
            severity: 'moderate',
            recordedDate: new Date(),
            notes: 'Developed after first dose',
          },
        ],
      };

      const patient = new Patient(patientWithAllergy);
      const savedPatient = await patient.save();

      expect(savedPatient.allergies).toHaveLength(1);
      expect(savedPatient.allergies[0].allergen).toBe('Penicillin');
      expect(savedPatient.allergies[0].severity).toBe('moderate');
    });

    it('should validate allergy severity enum', async () => {
      const invalidAllergy = {
        ...getValidPatientData('003'),
        allergies: [
          {
            allergen: 'Penicillin',
            reaction: 'Skin rash',
            severity: 'invalid_severity' as any,
          },
        ],
      };

      const patient = new Patient(invalidAllergy);
      await expect(patient.save()).rejects.toThrow();
    });

    it('should validate chronic condition fields', async () => {
      const patientWithCondition = {
        ...getValidPatientData('004'),
        chronicConditions: [
          {
            condition: 'Type 2 Diabetes',
            diagnosedDate: new Date('2020-01-01'),
            managementPlan: 'Diet control and metformin',
            status: 'managed',
            notes: 'Well controlled with current treatment',
          },
        ],
      };

      const patient = new Patient(patientWithCondition);
      const savedPatient = await patient.save();

      expect(savedPatient.chronicConditions).toHaveLength(1);
      expect(savedPatient.chronicConditions[0].condition).toBe('Type 2 Diabetes');
      expect(savedPatient.chronicConditions[0].status).toBe('managed');
    });

    it('should validate chronic condition status enum', async () => {
      const invalidCondition = {
        ...getValidPatientData('005'),
        chronicConditions: [
          {
            condition: 'Diabetes',
            diagnosedDate: new Date('2020-01-01'),
            status: 'invalid_status' as any,
          },
        ],
      };

      const patient = new Patient(invalidCondition);
      await expect(patient.save()).rejects.toThrow();
    });

    it('should validate emergency contact fields', async () => {
      const patientWithContact = {
        ...getValidPatientData('006'),
        enhancedEmergencyContacts: [
          {
            name: 'Jane Doe',
            relationship: 'Spouse',
            phone: '+2348012345678',
            email: 'jane@example.com',
            isPrimary: true,
            priority: 1,
          },
        ],
      };

      const patient = new Patient(patientWithContact);
      const savedPatient = await patient.save();

      expect(savedPatient.enhancedEmergencyContacts).toHaveLength(1);
      expect(savedPatient.enhancedEmergencyContacts[0].name).toBe('Jane Doe');
      expect(savedPatient.enhancedEmergencyContacts[0].isPrimary).toBe(true);
    });

    it('should validate Nigerian phone format for emergency contacts', async () => {
      const invalidPhone = {
        ...getValidPatientData('007'),
        enhancedEmergencyContacts: [
          {
            name: 'Jane Doe',
            relationship: 'Spouse',
            phone: '08012345678', // Missing +234 prefix
            isPrimary: false,
            priority: 1,
          },
        ],
      };

      const patient = new Patient(invalidPhone);
      await expect(patient.save()).rejects.toThrow();
    });

    it('should validate insurance info fields', async () => {
      const patientWithInsurance = {
        ...getValidPatientData('008'),
        insuranceInfo: {
          provider: 'NHIS',
          policyNumber: 'NHIS123456789',
          expiryDate: new Date('2025-12-31'),
          coverageDetails: 'Basic healthcare coverage',
          copayAmount: 1000,
          isActive: true,
        },
      };

      const patient = new Patient(patientWithInsurance);
      const savedPatient = await patient.save();

      expect(savedPatient.insuranceInfo.provider).toBe('NHIS');
      expect(savedPatient.insuranceInfo.isActive).toBe(true);
    });

    it('should validate patient logged vitals', async () => {
      const patientWithVitals = {
        ...getValidPatientData('009'),
        patientLoggedVitals: [
          {
            recordedDate: new Date(),
            bloodPressure: { systolic: 120, diastolic: 80 },
            heartRate: 72,
            temperature: 36.5,
            weight: 70,
            glucose: 95,
            oxygenSaturation: 98,
            notes: 'Feeling good today',
            source: 'patient_portal',
          },
        ],
      };

      const patient = new Patient(patientWithVitals);
      const savedPatient = await patient.save();

      expect(savedPatient.patientLoggedVitals).toHaveLength(1);
      expect(savedPatient.patientLoggedVitals[0].bloodPressure?.systolic).toBe(120);
      expect(savedPatient.patientLoggedVitals[0].source).toBe('patient_portal');
      expect(savedPatient.patientLoggedVitals[0].isVerified).toBe(false);
    });

    it('should validate vitals ranges', async () => {
      const invalidVitals = {
        ...getValidPatientData('010'),
        patientLoggedVitals: [
          {
            bloodPressure: { systolic: 400, diastolic: 80 }, // Invalid systolic
            source: 'patient_portal' as const,
          },
        ],
      };

      const patient = new Patient(invalidVitals);
      await expect(patient.save()).rejects.toThrow();
    });
  });

  describe('Pre-save Validation', () => {
    const basePatientData = {
      workplaceId: testWorkplaceId,
      mrn: 'TEST-001',
      firstName: 'John',
      lastName: 'Doe',
      dob: new Date('1990-01-01'),
      createdBy: testUserId,
    };

    it('should prevent multiple primary emergency contacts', async () => {
      const patientWithMultiplePrimary = {
        workplaceId: testWorkplaceId,
        mrn: 'TEST-002',
        firstName: 'Jane',
        lastName: 'Smith',
        dob: new Date('1985-01-01'),
        createdBy: testUserId,
        enhancedEmergencyContacts: [
          {
            name: 'Jane Doe',
            relationship: 'Spouse',
            phone: '+2348012345678',
            isPrimary: true,
            priority: 1,
          },
          {
            name: 'John Smith',
            relationship: 'Brother',
            phone: '+2348012345679',
            isPrimary: true,
            priority: 2,
          },
        ],
      };

      const patient = new Patient(patientWithMultiplePrimary);
      await expect(patient.save()).rejects.toThrow('Only one emergency contact can be set as primary');
    });

    it('should prevent duplicate emergency contact priorities', async () => {
      const patientWithDuplicatePriorities = {
        workplaceId: testWorkplaceId,
        mrn: 'TEST-003',
        firstName: 'Bob',
        lastName: 'Johnson',
        dob: new Date('1980-01-01'),
        createdBy: testUserId,
        enhancedEmergencyContacts: [
          {
            name: 'Jane Doe',
            relationship: 'Spouse',
            phone: '+2348012345678',
            isPrimary: false,
            priority: 1,
          },
          {
            name: 'John Smith',
            relationship: 'Brother',
            phone: '+2348012345679',
            isPrimary: false,
            priority: 1, // Duplicate priority
          },
        ],
      };

      const patient = new Patient(patientWithDuplicatePriorities);
      await expect(patient.save()).rejects.toThrow('Emergency contact priorities must be unique');
    });

    it('should prevent future diagnosed dates for chronic conditions', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const patientWithFutureCondition = {
        workplaceId: testWorkplaceId,
        mrn: 'TEST-004',
        firstName: 'Alice',
        lastName: 'Brown',
        dob: new Date('1975-01-01'),
        createdBy: testUserId,
        chronicConditions: [
          {
            condition: 'Diabetes',
            diagnosedDate: futureDate,
            status: 'active' as const,
          },
        ],
      };

      const patient = new Patient(patientWithFutureCondition);
      await expect(patient.save()).rejects.toThrow('Diagnosed date cannot be in the future');
    });

    it('should validate blood pressure systolic > diastolic', async () => {
      const patientWithInvalidBP = {
        workplaceId: testWorkplaceId,
        mrn: 'TEST-005',
        firstName: 'Charlie',
        lastName: 'Davis',
        dob: new Date('1970-01-01'),
        createdBy: testUserId,
        patientLoggedVitals: [
          {
            bloodPressure: { systolic: 80, diastolic: 120 }, // Invalid: systolic < diastolic
            source: 'patient_portal' as const,
          },
        ],
      };

      const patient = new Patient(patientWithInvalidBP);
      await expect(patient.save()).rejects.toThrow('Systolic blood pressure must be higher than diastolic');
    });
  });

  describe('Instance Methods', () => {
    let patient: IPatient;

    beforeEach(async () => {
      patient = await Patient.create({
        workplaceId: testWorkplaceId,
        mrn: 'TEST-001',
        firstName: 'John',
        lastName: 'Doe',
        dob: new Date('1990-01-01'),
        createdBy: testUserId,
      });
    });

    describe('Allergy Management', () => {
      it('should add allergy', () => {
        const allergyData = {
          allergen: 'Penicillin',
          reaction: 'Skin rash',
          severity: 'moderate' as const,
          notes: 'Developed after first dose',
        };

        patient.addAllergy(allergyData, testUserId);
        expect(patient.allergies).toHaveLength(1);
        expect(patient.allergies[0].allergen).toBe('Penicillin');
        expect(patient.allergies[0].recordedBy).toEqual(testUserId);
        expect(patient.allergies[0].recordedDate).toBeInstanceOf(Date);
      });

      it('should remove allergy', async () => {
        patient.addAllergy({
          allergen: 'Penicillin',
          reaction: 'Skin rash',
          severity: 'moderate' as const,
        });
        await patient.save();

        const allergyId = patient.allergies[0]._id?.toString();
        const removed = patient.removeAllergy(allergyId!);

        expect(removed).toBe(true);
        expect(patient.allergies).toHaveLength(0);
      });

      it('should update allergy', async () => {
        patient.addAllergy({
          allergen: 'Penicillin',
          reaction: 'Skin rash',
          severity: 'moderate' as const,
        });
        await patient.save();

        const allergyId = patient.allergies[0]._id?.toString();
        const updated = patient.updateAllergy(allergyId!, { severity: 'severe' });

        expect(updated).toBe(true);
        expect(patient.allergies[0].severity).toBe('severe');
      });
    });

    describe('Chronic Condition Management', () => {
      it('should add chronic condition', () => {
        const conditionData = {
          condition: 'Type 2 Diabetes',
          diagnosedDate: new Date('2020-01-01'),
          managementPlan: 'Diet and exercise',
          status: 'managed' as const,
        };

        patient.addChronicCondition(conditionData, testUserId);
        expect(patient.chronicConditions).toHaveLength(1);
        expect(patient.chronicConditions[0].condition).toBe('Type 2 Diabetes');
        expect(patient.chronicConditions[0].recordedBy).toEqual(testUserId);
      });

      it('should remove chronic condition', async () => {
        patient.addChronicCondition({
          condition: 'Diabetes',
          diagnosedDate: new Date('2020-01-01'),
          status: 'active' as const,
        });
        await patient.save();

        const conditionId = patient.chronicConditions[0]._id?.toString();
        const removed = patient.removeChronicCondition(conditionId!);

        expect(removed).toBe(true);
        expect(patient.chronicConditions).toHaveLength(0);
      });

      it('should update chronic condition', async () => {
        patient.addChronicCondition({
          condition: 'Diabetes',
          diagnosedDate: new Date('2020-01-01'),
          status: 'active' as const,
        });
        await patient.save();

        const conditionId = patient.chronicConditions[0]._id?.toString();
        const updated = patient.updateChronicCondition(conditionId!, { status: 'managed' });

        expect(updated).toBe(true);
        expect(patient.chronicConditions[0].status).toBe('managed');
      });
    });

    describe('Emergency Contact Management', () => {
      it('should add emergency contact', () => {
        const contactData = {
          name: 'Jane Doe',
          relationship: 'Spouse',
          phone: '+2348012345678',
          email: 'jane@example.com',
          isPrimary: true,
          priority: 1,
        };

        patient.addEmergencyContact(contactData);
        expect(patient.enhancedEmergencyContacts).toHaveLength(1);
        expect(patient.enhancedEmergencyContacts[0].name).toBe('Jane Doe');
        expect(patient.enhancedEmergencyContacts[0].isPrimary).toBe(true);
      });

      it('should unset other primary contacts when adding new primary', () => {
        patient.addEmergencyContact({
          name: 'Jane Doe',
          relationship: 'Spouse',
          phone: '+2348012345678',
          isPrimary: true,
          priority: 1,
        });

        patient.addEmergencyContact({
          name: 'John Smith',
          relationship: 'Brother',
          phone: '+2348012345679',
          isPrimary: true,
          priority: 2,
        });

        const primaryContacts = patient.enhancedEmergencyContacts.filter(c => c.isPrimary);
        expect(primaryContacts).toHaveLength(1);
        expect(primaryContacts[0].name).toBe('John Smith');
      });

      it('should sort contacts by priority', () => {
        patient.addEmergencyContact({
          name: 'Contact 3',
          relationship: 'Friend',
          phone: '+2348012345680',
          isPrimary: false,
          priority: 3,
        });

        patient.addEmergencyContact({
          name: 'Contact 1',
          relationship: 'Spouse',
          phone: '+2348012345678',
          isPrimary: false,
          priority: 1,
        });

        patient.addEmergencyContact({
          name: 'Contact 2',
          relationship: 'Brother',
          phone: '+2348012345679',
          isPrimary: false,
          priority: 2,
        });

        expect(patient.enhancedEmergencyContacts[0].name).toBe('Contact 1');
        expect(patient.enhancedEmergencyContacts[1].name).toBe('Contact 2');
        expect(patient.enhancedEmergencyContacts[2].name).toBe('Contact 3');
      });

      it('should set primary emergency contact', async () => {
        patient.addEmergencyContact({
          name: 'Jane Doe',
          relationship: 'Spouse',
          phone: '+2348012345678',
          isPrimary: false,
          priority: 1,
        });

        patient.addEmergencyContact({
          name: 'John Smith',
          relationship: 'Brother',
          phone: '+2348012345679',
          isPrimary: false,
          priority: 2,
        });

        await patient.save();

        const contactId = patient.enhancedEmergencyContacts[1]._id?.toString();
        const result = patient.setPrimaryEmergencyContact(contactId!);

        expect(result).toBe(true);
        expect(patient.enhancedEmergencyContacts[0].isPrimary).toBe(false);
        expect(patient.enhancedEmergencyContacts[1].isPrimary).toBe(true);
      });
    });

    describe('Insurance Management', () => {
      it('should update insurance info', () => {
        const insuranceData = {
          provider: 'NHIS',
          policyNumber: 'NHIS123456789',
          expiryDate: new Date('2025-12-31'),
          isActive: true,
        };

        patient.updateInsuranceInfo(insuranceData);
        expect(patient.insuranceInfo.provider).toBe('NHIS');
        expect(patient.insuranceInfo.policyNumber).toBe('NHIS123456789');
        expect(patient.insuranceInfo.isActive).toBe(true);
      });

      it('should merge insurance info updates', () => {
        patient.updateInsuranceInfo({ provider: 'NHIS', isActive: true });
        patient.updateInsuranceInfo({ policyNumber: 'NHIS123456789' });

        expect(patient.insuranceInfo.provider).toBe('NHIS');
        expect(patient.insuranceInfo.policyNumber).toBe('NHIS123456789');
        expect(patient.insuranceInfo.isActive).toBe(true);
      });
    });

    describe('Vitals Management', () => {
      it('should log vitals', () => {
        const vitalsData = {
          bloodPressure: { systolic: 120, diastolic: 80 },
          heartRate: 72,
          temperature: 36.5,
          weight: 70,
          notes: 'Feeling good',
        };

        patient.logVitals(vitalsData);
        expect(patient.patientLoggedVitals).toHaveLength(1);
        expect(patient.patientLoggedVitals[0].bloodPressure?.systolic).toBe(120);
        expect(patient.patientLoggedVitals[0].source).toBe('patient_portal');
        expect(patient.patientLoggedVitals[0].isVerified).toBe(false);
        expect(patient.patientLoggedVitals[0].recordedDate).toBeInstanceOf(Date);
      });

      it('should limit vitals history to 100 entries', () => {
        // Add 105 vitals entries
        for (let i = 0; i < 105; i++) {
          patient.logVitals({
            heartRate: 70 + i,
            notes: `Entry ${i}`,
          });
        }

        expect(patient.patientLoggedVitals).toHaveLength(100);
        // Should keep the most recent entries
        expect(patient.patientLoggedVitals[0].heartRate).toBeGreaterThan(170);
      });

      it('should get vitals history', () => {
        // Add multiple vitals entries with different timestamps
        const baseTime = new Date().getTime();
        for (let i = 0; i < 10; i++) {
          const vitals = {
            heartRate: 70 + i,
            notes: `Entry ${i}`,
            recordedDate: new Date(baseTime + i * 1000), // 1 second apart
          };
          patient.patientLoggedVitals.push({
            ...vitals,
            source: 'patient_portal' as const,
            isVerified: false,
          });
        }

        const history = patient.getVitalsHistory(5);
        expect(history).toHaveLength(5);
        // Should be sorted by date descending (most recent first)
        expect(history[0].heartRate).toBe(79); // Last entry
        expect(history[4].heartRate).toBe(75); // 5th from last
      });

      it('should get latest vitals', () => {
        const baseTime = new Date().getTime();

        // Add vitals with different timestamps
        patient.patientLoggedVitals.push({
          heartRate: 70,
          recordedDate: new Date(baseTime),
          source: 'patient_portal' as const,
          isVerified: false,
        });

        patient.patientLoggedVitals.push({
          heartRate: 75,
          recordedDate: new Date(baseTime + 1000),
          source: 'patient_portal' as const,
          isVerified: false,
        });

        patient.patientLoggedVitals.push({
          heartRate: 80,
          recordedDate: new Date(baseTime + 2000),
          source: 'patient_portal' as const,
          isVerified: false,
        });

        const latest = patient.getLatestVitals();
        expect(latest.heartRate).toBe(80);
      });

      it('should return null for latest vitals when none exist', () => {
        const latest = patient.getLatestVitals();
        expect(latest).toBeNull();
      });

      it('should verify vitals', async () => {
        patient.logVitals({ heartRate: 72 });
        await patient.save();

        const vitalsId = patient.patientLoggedVitals[0]._id?.toString();
        const verified = patient.verifyVitals(vitalsId!, testUserId);

        expect(verified).toBe(true);
        expect(patient.patientLoggedVitals[0].isVerified).toBe(true);
        expect(patient.patientLoggedVitals[0].verifiedBy).toEqual(testUserId);
      });
    });
  });
});