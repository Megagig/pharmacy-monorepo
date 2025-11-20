import request from 'supertest';
import { Express } from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../../app';
import User from '../../../models/User';
import PatientUser from '../../../models/PatientUser';
import Patient from '../../../models/Patient';
import Workplace from '../../../models/Workplace';
import { generateToken } from '../../../utils/token';

describe('Patient Profile Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let testApp: Express;
  let testWorkplace: any;
  let testPatient: any;
  let testPatientUser: any;
  let patientToken: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
    testApp = app;
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Create test workplace
    testWorkplace = await Workplace.create({
      name: 'Test Pharmacy',
      email: 'admin@testpharmacy.com',
      phone: '+2348012345678',
      address: '123 Test Street, Lagos, Nigeria',
      state: 'Lagos',
      lga: 'Lagos Island',
      licenseNumber: 'PCN-TEST-001',
      isActive: true,
      subscriptionStatus: 'active'
    });

    // Create test patient
    testPatient = await Patient.create({
      firstName: 'John',
      lastName: 'Doe',
      otherNames: 'Michael',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'male',
      phone: '+2348087654321',
      email: 'john.doe@example.com',
      address: '456 Patient Street, Lagos, Nigeria',
      state: 'Lagos',
      lga: 'Ikeja',
      bloodGroup: 'O+',
      genotype: 'AA',
      weight: 70,
      workplaceId: testWorkplace._id,
      allergies: [{
        allergen: 'Penicillin',
        reaction: 'Skin rash',
        severity: 'moderate',
        recordedDate: new Date(),
        recordedBy: new mongoose.Types.ObjectId()
      }],
      chronicConditions: [{
        condition: 'Hypertension',
        diagnosedDate: new Date('2020-01-01'),
        managementPlan: 'Regular monitoring and medication',
        status: 'active',
        recordedBy: new mongoose.Types.ObjectId()
      }],
      emergencyContacts: [{
        name: 'Jane Doe',
        relationship: 'spouse',
        phone: '+2348087654322',
        email: 'jane.doe@example.com',
        isPrimary: true
      }],
      insuranceInfo: {
        provider: 'Test Insurance',
        policyNumber: 'TI-123456',
        expiryDate: new Date('2024-12-31'),
        coverageDetails: 'Full coverage',
        copayAmount: 1000
      },
      patientLoggedVitals: [{
        recordedDate: new Date(),
        bloodPressure: { systolic: 120, diastolic: 80 },
        heartRate: 72,
        temperature: 36.5,
        weight: 70,
        source: 'patient_portal'
      }]
    });

    // Create test patient user
    testPatientUser = await PatientUser.create({
      email: 'john.doe@example.com',
      password: 'password123',
      patientId: testPatient._id,
      workplaceId: testWorkplace._id,
      status: 'active',
      isEmailVerified: true,
      notificationPreferences: {
        email: true,
        sms: true,
        push: true,
        appointmentReminders: true,
        medicationReminders: true,
        refillReminders: true
      }
    });

    // Generate patient token
    patientToken = generateToken(testPatientUser._id);
  });

  afterEach(async () => {
    await User.deleteMany({});
    await PatientUser.deleteMany({});
    await Patient.deleteMany({});
    await Workplace.deleteMany({});
  });

  describe('Patient Profile Management', () => {
    describe('GET /api/patient-portal/profile', () => {
      it('should return patient profile for authenticated user', async () => {
        const response = await request(testApp)
          .get('/api/patient-portal/profile')
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.firstName).toBe('John');
        expect(response.body.data.lastName).toBe('Doe');
        expect(response.body.data.email).toBe('john.doe@example.com');
        expect(response.body.data.allergies).toHaveLength(1);
        expect(response.body.data.chronicConditions).toHaveLength(1);
        expect(response.body.data.emergencyContacts).toHaveLength(1);
        expect(response.body.data.insuranceInfo).toBeDefined();
      });

      it('should reject unauthenticated requests', async () => {
        await request(testApp)
          .get('/api/patient-portal/profile')
          .expect(401);
      });

      it('should not expose sensitive fields', async () => {
        const response = await request(testApp)
          .get('/api/patient-portal/profile')
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.data).not.toHaveProperty('password');
        expect(response.body.data).not.toHaveProperty('__v');
      });
    });

    describe('PUT /api/patient-portal/profile', () => {
      it('should update patient demographics', async () => {
        const updateData = {
          firstName: 'Johnny',
          lastName: 'Doe',
          otherNames: 'Michael James',
          phone: '+2348087654999',
          address: '789 New Address, Lagos, Nigeria',
          state: 'Lagos',
          lga: 'Victoria Island',
          weight: 75
        };

        const response = await request(testApp)
          .put('/api/patient-portal/profile')
          .set('Cookie', `patientToken=${patientToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.firstName).toBe('Johnny');
        expect(response.body.data.otherNames).toBe('Michael James');
        expect(response.body.data.weight).toBe(75);

        // Verify in database
        const updatedPatient = await Patient.findById(testPatient._id);
        expect(updatedPatient?.firstName).toBe('Johnny');
        expect(updatedPatient?.weight).toBe(75);
      });

      it('should validate required fields', async () => {
        const invalidData = {
          firstName: '', // Required field empty
          lastName: 'Doe'
        };

        const response = await request(testApp)
          .put('/api/patient-portal/profile')
          .set('Cookie', `patientToken=${patientToken}`)
          .send(invalidData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('validation');
      });

      it('should validate phone number format', async () => {
        const invalidData = {
          phone: '1234567890' // Invalid Nigerian format
        };

        const response = await request(testApp)
          .put('/api/patient-portal/profile')
          .set('Cookie', `patientToken=${patientToken}`)
          .send(invalidData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('phone');
      });

      it('should validate blood group values', async () => {
        const invalidData = {
          bloodGroup: 'Invalid'
        };

        const response = await request(testApp)
          .put('/api/patient-portal/profile')
          .set('Cookie', `patientToken=${patientToken}`)
          .send(invalidData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('blood group');
      });

      it('should validate genotype values', async () => {
        const invalidData = {
          genotype: 'Invalid'
        };

        const response = await request(testApp)
          .put('/api/patient-portal/profile')
          .set('Cookie', `patientToken=${patientToken}`)
          .send(invalidData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('genotype');
      });

      it('should not allow updating immutable fields', async () => {
        const updateData = {
          dateOfBirth: '1985-01-01', // Should not be updatable
          workplaceId: new mongoose.Types.ObjectId() // Should not be updatable
        };

        const response = await request(testApp)
          .put('/api/patient-portal/profile')
          .set('Cookie', `patientToken=${patientToken}`)
          .send(updateData)
          .expect(200);

        // Verify immutable fields weren't changed
        const patient = await Patient.findById(testPatient._id);
        expect(patient?.dateOfBirth.toISOString().split('T')[0]).toBe('1990-01-01');
        expect(patient?.workplaceId.toString()).toBe(testWorkplace._id.toString());
      });
    });
  });

  describe('Allergy Management', () => {
    describe('POST /api/patient-portal/profile/allergies', () => {
      it('should add new allergy', async () => {
        const allergyData = {
          allergen: 'Aspirin',
          reaction: 'Stomach upset',
          severity: 'mild'
        };

        const response = await request(testApp)
          .post('/api/patient-portal/profile/allergies')
          .set('Cookie', `patientToken=${patientToken}`)
          .send(allergyData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.allergies).toHaveLength(2);
        
        const newAllergy = response.body.data.allergies.find((a: any) => a.allergen === 'Aspirin');
        expect(newAllergy).toBeDefined();
        expect(newAllergy.severity).toBe('mild');
      });

      it('should validate allergy data', async () => {
        const invalidData = {
          allergen: '', // Required
          reaction: 'Reaction',
          severity: 'invalid' // Invalid severity
        };

        const response = await request(testApp)
          .post('/api/patient-portal/profile/allergies')
          .set('Cookie', `patientToken=${patientToken}`)
          .send(invalidData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('validation');
      });

      it('should prevent duplicate allergies', async () => {
        const allergyData = {
          allergen: 'Penicillin', // Already exists
          reaction: 'Different reaction',
          severity: 'severe'
        };

        const response = await request(testApp)
          .post('/api/patient-portal/profile/allergies')
          .set('Cookie', `patientToken=${patientToken}`)
          .send(allergyData)
          .expect(409);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('already exists');
      });
    });

    describe('PUT /api/patient-portal/profile/allergies/:allergyId', () => {
      it('should update existing allergy', async () => {
        const allergyId = testPatient.allergies[0]._id;
        const updateData = {
          reaction: 'Severe skin rash with swelling',
          severity: 'severe'
        };

        const response = await request(testApp)
          .put(`/api/patient-portal/profile/allergies/${allergyId}`)
          .set('Cookie', `patientToken=${patientToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body.success).toBe(true);
        
        const updatedAllergy = response.body.data.allergies.find((a: any) => 
          a._id.toString() === allergyId.toString()
        );
        expect(updatedAllergy.reaction).toBe('Severe skin rash with swelling');
        expect(updatedAllergy.severity).toBe('severe');
      });

      it('should return 404 for non-existent allergy', async () => {
        const nonExistentId = new mongoose.Types.ObjectId();
        
        await request(testApp)
          .put(`/api/patient-portal/profile/allergies/${nonExistentId}`)
          .set('Cookie', `patientToken=${patientToken}`)
          .send({ severity: 'mild' })
          .expect(404);
      });
    });

    describe('DELETE /api/patient-portal/profile/allergies/:allergyId', () => {
      it('should remove allergy', async () => {
        const allergyId = testPatient.allergies[0]._id;

        const response = await request(testApp)
          .delete(`/api/patient-portal/profile/allergies/${allergyId}`)
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.allergies).toHaveLength(0);
      });
    });
  });

  describe('Chronic Condition Management', () => {
    describe('POST /api/patient-portal/profile/conditions', () => {
      it('should add new chronic condition', async () => {
        const conditionData = {
          condition: 'Diabetes Type 2',
          diagnosedDate: '2021-06-15',
          managementPlan: 'Diet control and medication',
          status: 'active'
        };

        const response = await request(testApp)
          .post('/api/patient-portal/profile/conditions')
          .set('Cookie', `patientToken=${patientToken}`)
          .send(conditionData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.chronicConditions).toHaveLength(2);
        
        const newCondition = response.body.data.chronicConditions.find((c: any) => 
          c.condition === 'Diabetes Type 2'
        );
        expect(newCondition).toBeDefined();
        expect(newCondition.status).toBe('active');
      });

      it('should validate condition data', async () => {
        const invalidData = {
          condition: '', // Required
          diagnosedDate: 'invalid-date',
          status: 'invalid-status'
        };

        const response = await request(testApp)
          .post('/api/patient-portal/profile/conditions')
          .set('Cookie', `patientToken=${patientToken}`)
          .send(invalidData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('validation');
      });
    });

    describe('PUT /api/patient-portal/profile/conditions/:conditionId', () => {
      it('should update existing condition', async () => {
        const conditionId = testPatient.chronicConditions[0]._id;
        const updateData = {
          managementPlan: 'Updated management plan with lifestyle changes',
          status: 'managed'
        };

        const response = await request(testApp)
          .put(`/api/patient-portal/profile/conditions/${conditionId}`)
          .set('Cookie', `patientToken=${patientToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body.success).toBe(true);
        
        const updatedCondition = response.body.data.chronicConditions.find((c: any) => 
          c._id.toString() === conditionId.toString()
        );
        expect(updatedCondition.managementPlan).toBe('Updated management plan with lifestyle changes');
        expect(updatedCondition.status).toBe('managed');
      });
    });

    describe('DELETE /api/patient-portal/profile/conditions/:conditionId', () => {
      it('should remove chronic condition', async () => {
        const conditionId = testPatient.chronicConditions[0]._id;

        const response = await request(testApp)
          .delete(`/api/patient-portal/profile/conditions/${conditionId}`)
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.chronicConditions).toHaveLength(0);
      });
    });
  });

  describe('Emergency Contact Management', () => {
    describe('POST /api/patient-portal/profile/emergency-contacts', () => {
      it('should add new emergency contact', async () => {
        const contactData = {
          name: 'Bob Smith',
          relationship: 'brother',
          phone: '+2348087654323',
          email: 'bob.smith@example.com',
          isPrimary: false
        };

        const response = await request(testApp)
          .post('/api/patient-portal/profile/emergency-contacts')
          .set('Cookie', `patientToken=${patientToken}`)
          .send(contactData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.emergencyContacts).toHaveLength(2);
        
        const newContact = response.body.data.emergencyContacts.find((c: any) => 
          c.name === 'Bob Smith'
        );
        expect(newContact).toBeDefined();
        expect(newContact.relationship).toBe('brother');
      });

      it('should validate contact data', async () => {
        const invalidData = {
          name: '', // Required
          relationship: 'invalid-relationship',
          phone: 'invalid-phone'
        };

        const response = await request(testApp)
          .post('/api/patient-portal/profile/emergency-contacts')
          .set('Cookie', `patientToken=${patientToken}`)
          .send(invalidData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('validation');
      });

      it('should handle primary contact designation', async () => {
        const contactData = {
          name: 'New Primary Contact',
          relationship: 'parent',
          phone: '+2348087654324',
          isPrimary: true
        };

        const response = await request(testApp)
          .post('/api/patient-portal/profile/emergency-contacts')
          .set('Cookie', `patientToken=${patientToken}`)
          .send(contactData)
          .expect(201);

        expect(response.body.success).toBe(true);
        
        // Check that only one contact is primary
        const primaryContacts = response.body.data.emergencyContacts.filter((c: any) => c.isPrimary);
        expect(primaryContacts).toHaveLength(1);
        expect(primaryContacts[0].name).toBe('New Primary Contact');
      });
    });

    describe('PUT /api/patient-portal/profile/emergency-contacts/:contactId', () => {
      it('should update existing emergency contact', async () => {
        const contactId = testPatient.emergencyContacts[0]._id;
        const updateData = {
          phone: '+2348087654999',
          email: 'jane.doe.updated@example.com'
        };

        const response = await request(testApp)
          .put(`/api/patient-portal/profile/emergency-contacts/${contactId}`)
          .set('Cookie', `patientToken=${patientToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body.success).toBe(true);
        
        const updatedContact = response.body.data.emergencyContacts.find((c: any) => 
          c._id.toString() === contactId.toString()
        );
        expect(updatedContact.phone).toBe('+2348087654999');
        expect(updatedContact.email).toBe('jane.doe.updated@example.com');
      });
    });

    describe('DELETE /api/patient-portal/profile/emergency-contacts/:contactId', () => {
      it('should remove emergency contact', async () => {
        const contactId = testPatient.emergencyContacts[0]._id;

        const response = await request(testApp)
          .delete(`/api/patient-portal/profile/emergency-contacts/${contactId}`)
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.emergencyContacts).toHaveLength(0);
      });
    });
  });

  describe('Insurance Information Management', () => {
    describe('PUT /api/patient-portal/profile/insurance', () => {
      it('should update insurance information', async () => {
        const insuranceData = {
          provider: 'Updated Insurance Company',
          policyNumber: 'UIC-789012',
          expiryDate: '2025-12-31',
          coverageDetails: 'Comprehensive coverage with dental',
          copayAmount: 2000
        };

        const response = await request(testApp)
          .put('/api/patient-portal/profile/insurance')
          .set('Cookie', `patientToken=${patientToken}`)
          .send(insuranceData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.insuranceInfo.provider).toBe('Updated Insurance Company');
        expect(response.body.data.insuranceInfo.policyNumber).toBe('UIC-789012');
        expect(response.body.data.insuranceInfo.copayAmount).toBe(2000);
      });

      it('should validate insurance data', async () => {
        const invalidData = {
          expiryDate: 'invalid-date',
          copayAmount: 'not-a-number'
        };

        const response = await request(testApp)
          .put('/api/patient-portal/profile/insurance')
          .set('Cookie', `patientToken=${patientToken}`)
          .send(invalidData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('validation');
      });

      it('should allow clearing insurance information', async () => {
        const response = await request(testApp)
          .put('/api/patient-portal/profile/insurance')
          .set('Cookie', `patientToken=${patientToken}`)
          .send({})
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.insuranceInfo).toEqual({});
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to profile updates', async () => {
      const updateData = { weight: 71 };
      
      // Make multiple requests quickly
      const requests = Array(10).fill(null).map(() => 
        request(testApp)
          .put('/api/patient-portal/profile')
          .set('Cookie', `patientToken=${patientToken}`)
          .send(updateData)
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Data Validation and Security', () => {
    it('should sanitize input data', async () => {
      const maliciousData = {
        firstName: '<script>alert("xss")</script>John',
        lastName: 'Doe<img src=x onerror=alert(1)>',
        address: 'Clean address'
      };

      const response = await request(testApp)
        .put('/api/patient-portal/profile')
        .set('Cookie', `patientToken=${patientToken}`)
        .send(maliciousData)
        .expect(200);

      expect(response.body.data.firstName).not.toContain('<script>');
      expect(response.body.data.lastName).not.toContain('<img');
      expect(response.body.data.address).toBe('Clean address');
    });

    it('should prevent access to other patients data', async () => {
      // Create another patient
      const otherPatient = await Patient.create({
        firstName: 'Other',
        lastName: 'Patient',
        dateOfBirth: new Date('1985-01-01'),
        gender: 'female',
        phone: '+2348087654999',
        email: 'other@example.com',
        workplaceId: testWorkplace._id
      });

      const otherPatientUser = await PatientUser.create({
        email: 'other@example.com',
        password: 'password123',
        patientId: otherPatient._id,
        workplaceId: testWorkplace._id,
        status: 'active',
        isEmailVerified: true
      });

      const otherToken = generateToken(otherPatientUser._id);

      // Try to access original patient's profile with other patient's token
      const response = await request(testApp)
        .get('/api/patient-portal/profile')
        .set('Cookie', `patientToken=${otherToken}`)
        .expect(200);

      // Should return other patient's data, not original patient's
      expect(response.body.data.firstName).toBe('Other');
      expect(response.body.data.firstName).not.toBe('John');
    });

    it('should validate workspace context', async () => {
      // Create patient in different workplace
      const differentWorkplace = await Workplace.create({
        name: 'Different Pharmacy',
        email: 'admin@different.com',
        phone: '+2348012345679',
        address: '789 Different Street, Lagos, Nigeria',
        state: 'Lagos',
        lga: 'Ikeja',
        licenseNumber: 'PCN-DIFF-001',
        isActive: true,
        subscriptionStatus: 'active'
      });

      const differentPatient = await Patient.create({
        firstName: 'Different',
        lastName: 'Patient',
        dateOfBirth: new Date('1985-01-01'),
        gender: 'female',
        phone: '+2348087654888',
        email: 'different@example.com',
        workplaceId: differentWorkplace._id
      });

      const differentPatientUser = await PatientUser.create({
        email: 'different@example.com',
        password: 'password123',
        patientId: differentPatient._id,
        workplaceId: differentWorkplace._id,
        status: 'active',
        isEmailVerified: true
      });

      const differentToken = generateToken(differentPatientUser._id);

      // Should only access data from their own workplace
      const response = await request(testApp)
        .get('/api/patient-portal/profile')
        .set('Cookie', `patientToken=${differentToken}`)
        .expect(200);

      expect(response.body.data.workplaceId).toBe(differentWorkplace._id.toString());
    });
  });

  describe('Audit Logging', () => {
    it('should log profile updates for audit purposes', async () => {
      const updateData = {
        firstName: 'Updated John',
        weight: 75
      };

      const response = await request(testApp)
        .put('/api/patient-portal/profile')
        .set('Cookie', `patientToken=${patientToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // In a real implementation, you would check audit logs
      // This is a placeholder for audit log verification
      expect(response.body.data.firstName).toBe('Updated John');
    });
  });
});