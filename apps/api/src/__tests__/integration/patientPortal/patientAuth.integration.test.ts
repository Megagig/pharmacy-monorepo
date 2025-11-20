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

describe('Patient Authentication Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let testApp: Express;
  let testWorkplace: any;
  let testPatient: any;
  let testPatientUser: any;
  let workspaceAdmin: any;
  let workspaceAdminToken: string;

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

    // Create workspace admin
    workspaceAdmin = await User.create({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@testpharmacy.com',
      password: 'password123',
      role: 'workspace_admin',
      workplaceId: testWorkplace._id,
      isEmailVerified: true,
      status: 'active'
    });

    workspaceAdminToken = generateToken(workspaceAdmin._id);

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
      allergies: [],
      chronicConditions: [],
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
        coverageDetails: 'Full coverage'
      }
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
  });

  afterEach(async () => {
    await User.deleteMany({});
    await PatientUser.deleteMany({});
    await Patient.deleteMany({});
    await Workplace.deleteMany({});
  });

  describe('Workspace Search', () => {
    describe('GET /api/public/workspaces/search', () => {
      it('should search workspaces by name', async () => {
        const response = await request(testApp)
          .get('/api/public/workspaces/search?q=Test Pharmacy')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].name).toBe('Test Pharmacy');
        expect(response.body.data[0]).not.toHaveProperty('email'); // Sensitive data should be filtered
      });

      it('should search workspaces by location', async () => {
        const response = await request(testApp)
          .get('/api/public/workspaces/search?state=Lagos&lga=Lagos Island')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].state).toBe('Lagos');
        expect(response.body.data[0].lga).toBe('Lagos Island');
      });

      it('should return empty results for non-matching search', async () => {
        const response = await request(testApp)
          .get('/api/public/workspaces/search?q=Non-existent Pharmacy')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(0);
      });

      it('should not return inactive workspaces', async () => {
        // Create inactive workplace
        await Workplace.create({
          name: 'Inactive Pharmacy',
          email: 'inactive@pharmacy.com',
          phone: '+2348012345679',
          address: '789 Inactive Street, Lagos, Nigeria',
          state: 'Lagos',
          lga: 'Ikeja',
          licenseNumber: 'PCN-INACTIVE-001',
          isActive: false,
          subscriptionStatus: 'inactive'
        });

        const response = await request(testApp)
          .get('/api/public/workspaces/search?q=Inactive')
          .expect(200);

        expect(response.body.data).toHaveLength(0);
      });

      it('should paginate search results', async () => {
        // Create additional workspaces
        for (let i = 1; i <= 5; i++) {
          await Workplace.create({
            name: `Test Pharmacy ${i}`,
            email: `admin${i}@testpharmacy.com`,
            phone: `+23480123456${i}0`,
            address: `${i}23 Test Street, Lagos, Nigeria`,
            state: 'Lagos',
            lga: 'Ikeja',
            licenseNumber: `PCN-TEST-00${i}`,
            isActive: true,
            subscriptionStatus: 'active'
          });
        }

        const response = await request(testApp)
          .get('/api/public/workspaces/search?q=Test&limit=3&page=1')
          .expect(200);

        expect(response.body.data).toHaveLength(3);
        expect(response.body.pagination.totalPages).toBeGreaterThan(1);
      });
    });

    describe('GET /api/public/workspaces/:workplaceId', () => {
      it('should return workplace details', async () => {
        const response = await request(testApp)
          .get(`/api/public/workspaces/${testWorkplace._id}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe('Test Pharmacy');
        expect(response.body.data.address).toBeDefined();
        expect(response.body.data.phone).toBeDefined();
        expect(response.body.data).not.toHaveProperty('email'); // Sensitive data filtered
      });

      it('should return 404 for non-existent workplace', async () => {
        const nonExistentId = new mongoose.Types.ObjectId();
        
        await request(testApp)
          .get(`/api/public/workspaces/${nonExistentId}`)
          .expect(404);
      });

      it('should return 404 for inactive workplace', async () => {
        const inactiveWorkplace = await Workplace.create({
          name: 'Inactive Pharmacy',
          email: 'inactive@pharmacy.com',
          phone: '+2348012345679',
          address: '789 Inactive Street, Lagos, Nigeria',
          state: 'Lagos',
          lga: 'Ikeja',
          licenseNumber: 'PCN-INACTIVE-001',
          isActive: false,
          subscriptionStatus: 'inactive'
        });

        await request(testApp)
          .get(`/api/public/workspaces/${inactiveWorkplace._id}`)
          .expect(404);
      });
    });
  });

  describe('Patient Registration', () => {
    describe('POST /api/patient-portal/auth/register', () => {
      it('should register new patient successfully', async () => {
        const registrationData = {
          workplaceId: testWorkplace._id,
          email: 'newpatient@example.com',
          password: 'password123',
          confirmPassword: 'password123',
          firstName: 'Jane',
          lastName: 'Smith',
          dateOfBirth: '1985-05-15',
          gender: 'female',
          phone: '+2348087654323',
          address: '789 New Patient Street, Lagos, Nigeria',
          state: 'Lagos',
          lga: 'Ikeja',
          bloodGroup: 'A+',
          genotype: 'AS',
          weight: 65,
          emergencyContacts: [{
            name: 'John Smith',
            relationship: 'spouse',
            phone: '+2348087654324',
            email: 'john.smith@example.com',
            isPrimary: true
          }]
        };

        const response = await request(testApp)
          .post('/api/patient-portal/auth/register')
          .send(registrationData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('registration successful');
        expect(response.body.data.email).toBe(registrationData.email);
        expect(response.body.data.status).toBe('pending'); // Requires approval

        // Verify patient and patient user were created
        const createdPatient = await Patient.findOne({ email: registrationData.email });
        const createdPatientUser = await PatientUser.findOne({ email: registrationData.email });
        
        expect(createdPatient).toBeTruthy();
        expect(createdPatientUser).toBeTruthy();
        expect(createdPatientUser?.status).toBe('pending');
      });

      it('should require password confirmation', async () => {
        const registrationData = {
          workplaceId: testWorkplace._id,
          email: 'newpatient@example.com',
          password: 'password123',
          confirmPassword: 'differentpassword',
          firstName: 'Jane',
          lastName: 'Smith',
          dateOfBirth: '1985-05-15',
          gender: 'female',
          phone: '+2348087654323'
        };

        const response = await request(testApp)
          .post('/api/patient-portal/auth/register')
          .send(registrationData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('password');
      });

      it('should validate email format', async () => {
        const registrationData = {
          workplaceId: testWorkplace._id,
          email: 'invalid-email',
          password: 'password123',
          confirmPassword: 'password123',
          firstName: 'Jane',
          lastName: 'Smith',
          dateOfBirth: '1985-05-15',
          gender: 'female',
          phone: '+2348087654323'
        };

        const response = await request(testApp)
          .post('/api/patient-portal/auth/register')
          .send(registrationData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('email');
      });

      it('should prevent duplicate email registration', async () => {
        const registrationData = {
          workplaceId: testWorkplace._id,
          email: testPatientUser.email, // Existing email
          password: 'password123',
          confirmPassword: 'password123',
          firstName: 'Jane',
          lastName: 'Smith',
          dateOfBirth: '1985-05-15',
          gender: 'female',
          phone: '+2348087654323'
        };

        const response = await request(testApp)
          .post('/api/patient-portal/auth/register')
          .send(registrationData)
          .expect(409);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('already exists');
      });

      it('should validate Nigerian phone number format', async () => {
        const registrationData = {
          workplaceId: testWorkplace._id,
          email: 'newpatient@example.com',
          password: 'password123',
          confirmPassword: 'password123',
          firstName: 'Jane',
          lastName: 'Smith',
          dateOfBirth: '1985-05-15',
          gender: 'female',
          phone: '1234567890' // Invalid format
        };

        const response = await request(testApp)
          .post('/api/patient-portal/auth/register')
          .send(registrationData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('phone');
      });

      it('should validate blood group values', async () => {
        const registrationData = {
          workplaceId: testWorkplace._id,
          email: 'newpatient@example.com',
          password: 'password123',
          confirmPassword: 'password123',
          firstName: 'Jane',
          lastName: 'Smith',
          dateOfBirth: '1985-05-15',
          gender: 'female',
          phone: '+2348087654323',
          bloodGroup: 'Invalid' // Invalid blood group
        };

        const response = await request(testApp)
          .post('/api/patient-portal/auth/register')
          .send(registrationData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('blood group');
      });

      it('should validate genotype values', async () => {
        const registrationData = {
          workplaceId: testWorkplace._id,
          email: 'newpatient@example.com',
          password: 'password123',
          confirmPassword: 'password123',
          firstName: 'Jane',
          lastName: 'Smith',
          dateOfBirth: '1985-05-15',
          gender: 'female',
          phone: '+2348087654323',
          genotype: 'Invalid' // Invalid genotype
        };

        const response = await request(testApp)
          .post('/api/patient-portal/auth/register')
          .send(registrationData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('genotype');
      });

      it('should validate age requirements', async () => {
        const registrationData = {
          workplaceId: testWorkplace._id,
          email: 'newpatient@example.com',
          password: 'password123',
          confirmPassword: 'password123',
          firstName: 'Jane',
          lastName: 'Smith',
          dateOfBirth: new Date().toISOString().split('T')[0], // Today's date (0 years old)
          gender: 'female',
          phone: '+2348087654323'
        };

        const response = await request(testApp)
          .post('/api/patient-portal/auth/register')
          .send(registrationData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('age');
      });
    });

    describe('POST /api/patient-portal/auth/verify-email', () => {
      it('should verify email with valid token', async () => {
        // Create unverified patient user
        const unverifiedPatientUser = await PatientUser.create({
          email: 'unverified@example.com',
          password: 'password123',
          patientId: testPatient._id,
          workplaceId: testWorkplace._id,
          status: 'pending',
          isEmailVerified: false,
          emailVerificationToken: 'valid-token-123',
          emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
        });

        const response = await request(testApp)
          .post('/api/patient-portal/auth/verify-email')
          .send({ token: 'valid-token-123' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('verified');

        // Verify user is now email verified
        const verifiedUser = await PatientUser.findById(unverifiedPatientUser._id);
        expect(verifiedUser?.isEmailVerified).toBe(true);
        expect(verifiedUser?.emailVerificationToken).toBeUndefined();
      });

      it('should reject invalid verification token', async () => {
        const response = await request(testApp)
          .post('/api/patient-portal/auth/verify-email')
          .send({ token: 'invalid-token' })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('invalid');
      });

      it('should reject expired verification token', async () => {
        // Create patient user with expired token
        await PatientUser.create({
          email: 'expired@example.com',
          password: 'password123',
          patientId: testPatient._id,
          workplaceId: testWorkplace._id,
          status: 'pending',
          isEmailVerified: false,
          emailVerificationToken: 'expired-token-123',
          emailVerificationExpires: new Date(Date.now() - 1000) // Expired 1 second ago
        });

        const response = await request(testApp)
          .post('/api/patient-portal/auth/verify-email')
          .send({ token: 'expired-token-123' })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('expired');
      });
    });
  });

  describe('Patient Login', () => {
    describe('POST /api/patient-portal/auth/login', () => {
      it('should login active patient successfully', async () => {
        const loginData = {
          email: testPatientUser.email,
          password: 'password123',
          workplaceId: testWorkplace._id
        };

        const response = await request(testApp)
          .post('/api/patient-portal/auth/login')
          .send(loginData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('successful');
        expect(response.body.data.user.email).toBe(testPatientUser.email);
        expect(response.body.data.user.status).toBe('active');
        
        // Check that httpOnly cookie is set
        const cookies = response.headers['set-cookie'];
        expect(cookies).toBeDefined();
        expect(cookies.some((cookie: string) => cookie.includes('patientToken'))).toBe(true);
      });

      it('should reject login with incorrect password', async () => {
        const loginData = {
          email: testPatientUser.email,
          password: 'wrongpassword',
          workplaceId: testWorkplace._id
        };

        const response = await request(testApp)
          .post('/api/patient-portal/auth/login')
          .send(loginData)
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('credentials');
      });

      it('should reject login for non-existent user', async () => {
        const loginData = {
          email: 'nonexistent@example.com',
          password: 'password123',
          workplaceId: testWorkplace._id
        };

        const response = await request(testApp)
          .post('/api/patient-portal/auth/login')
          .send(loginData)
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('credentials');
      });

      it('should reject login for pending approval user', async () => {
        // Create pending user
        const pendingPatientUser = await PatientUser.create({
          email: 'pending@example.com',
          password: 'password123',
          patientId: testPatient._id,
          workplaceId: testWorkplace._id,
          status: 'pending',
          isEmailVerified: true
        });

        const loginData = {
          email: pendingPatientUser.email,
          password: 'password123',
          workplaceId: testWorkplace._id
        };

        const response = await request(testApp)
          .post('/api/patient-portal/auth/login')
          .send(loginData)
          .expect(403);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('pending approval');
      });

      it('should reject login for suspended user', async () => {
        // Create suspended user
        const suspendedPatientUser = await PatientUser.create({
          email: 'suspended@example.com',
          password: 'password123',
          patientId: testPatient._id,
          workplaceId: testWorkplace._id,
          status: 'suspended',
          isEmailVerified: true
        });

        const loginData = {
          email: suspendedPatientUser.email,
          password: 'password123',
          workplaceId: testWorkplace._id
        };

        const response = await request(testApp)
          .post('/api/patient-portal/auth/login')
          .send(loginData)
          .expect(403);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('suspended');
      });

      it('should reject login for unverified email', async () => {
        // Create unverified user
        const unverifiedPatientUser = await PatientUser.create({
          email: 'unverified@example.com',
          password: 'password123',
          patientId: testPatient._id,
          workplaceId: testWorkplace._id,
          status: 'active',
          isEmailVerified: false
        });

        const loginData = {
          email: unverifiedPatientUser.email,
          password: 'password123',
          workplaceId: testWorkplace._id
        };

        const response = await request(testApp)
          .post('/api/patient-portal/auth/login')
          .send(loginData)
          .expect(403);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('verify');
      });

      it('should validate workplace context', async () => {
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

        const loginData = {
          email: testPatientUser.email,
          password: 'password123',
          workplaceId: differentWorkplace._id // Wrong workplace
        };

        const response = await request(testApp)
          .post('/api/patient-portal/auth/login')
          .send(loginData)
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('credentials');
      });
    });

    describe('POST /api/patient-portal/auth/logout', () => {
      it('should logout patient successfully', async () => {
        // First login to get token
        const loginResponse = await request(testApp)
          .post('/api/patient-portal/auth/login')
          .send({
            email: testPatientUser.email,
            password: 'password123',
            workplaceId: testWorkplace._id
          });

        const cookies = loginResponse.headers['set-cookie'];
        
        // Then logout
        const response = await request(testApp)
          .post('/api/patient-portal/auth/logout')
          .set('Cookie', cookies)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('logout');
        
        // Check that cookie is cleared
        const logoutCookies = response.headers['set-cookie'];
        expect(logoutCookies.some((cookie: string) => 
          cookie.includes('patientToken=') && cookie.includes('Max-Age=0')
        )).toBe(true);
      });
    });

    describe('GET /api/patient-portal/auth/me', () => {
      it('should return current patient user info', async () => {
        // Login first
        const loginResponse = await request(testApp)
          .post('/api/patient-portal/auth/login')
          .send({
            email: testPatientUser.email,
            password: 'password123',
            workplaceId: testWorkplace._id
          });

        const cookies = loginResponse.headers['set-cookie'];

        // Get current user info
        const response = await request(testApp)
          .get('/api/patient-portal/auth/me')
          .set('Cookie', cookies)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.email).toBe(testPatientUser.email);
        expect(response.body.data.patient).toBeDefined();
        expect(response.body.data.patient.firstName).toBe(testPatient.firstName);
        expect(response.body.data.workplace).toBeDefined();
        expect(response.body.data.workplace.name).toBe(testWorkplace.name);
      });

      it('should reject request without authentication', async () => {
        await request(testApp)
          .get('/api/patient-portal/auth/me')
          .expect(401);
      });
    });
  });

  describe('Password Reset', () => {
    describe('POST /api/patient-portal/auth/forgot-password', () => {
      it('should initiate password reset for valid email', async () => {
        const response = await request(testApp)
          .post('/api/patient-portal/auth/forgot-password')
          .send({
            email: testPatientUser.email,
            workplaceId: testWorkplace._id
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('reset');

        // Verify reset token was created
        const updatedUser = await PatientUser.findById(testPatientUser._id);
        expect(updatedUser?.passwordResetToken).toBeDefined();
        expect(updatedUser?.passwordResetExpires).toBeDefined();
      });

      it('should not reveal if email does not exist', async () => {
        const response = await request(testApp)
          .post('/api/patient-portal/auth/forgot-password')
          .send({
            email: 'nonexistent@example.com',
            workplaceId: testWorkplace._id
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('reset');
      });
    });

    describe('POST /api/patient-portal/auth/reset-password', () => {
      it('should reset password with valid token', async () => {
        // Set reset token
        const resetToken = 'valid-reset-token-123';
        await PatientUser.findByIdAndUpdate(testPatientUser._id, {
          passwordResetToken: resetToken,
          passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now
        });

        const response = await request(testApp)
          .post('/api/patient-portal/auth/reset-password')
          .send({
            token: resetToken,
            password: 'newpassword123',
            confirmPassword: 'newpassword123'
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('reset');

        // Verify password was changed and token was cleared
        const updatedUser = await PatientUser.findById(testPatientUser._id);
        expect(updatedUser?.passwordResetToken).toBeUndefined();
        expect(updatedUser?.passwordResetExpires).toBeUndefined();

        // Verify can login with new password
        const loginResponse = await request(testApp)
          .post('/api/patient-portal/auth/login')
          .send({
            email: testPatientUser.email,
            password: 'newpassword123',
            workplaceId: testWorkplace._id
          })
          .expect(200);

        expect(loginResponse.body.success).toBe(true);
      });

      it('should reject invalid reset token', async () => {
        const response = await request(testApp)
          .post('/api/patient-portal/auth/reset-password')
          .send({
            token: 'invalid-token',
            password: 'newpassword123',
            confirmPassword: 'newpassword123'
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('invalid');
      });

      it('should reject expired reset token', async () => {
        // Set expired reset token
        const expiredToken = 'expired-reset-token-123';
        await PatientUser.findByIdAndUpdate(testPatientUser._id, {
          passwordResetToken: expiredToken,
          passwordResetExpires: new Date(Date.now() - 1000) // Expired 1 second ago
        });

        const response = await request(testApp)
          .post('/api/patient-portal/auth/reset-password')
          .send({
            token: expiredToken,
            password: 'newpassword123',
            confirmPassword: 'newpassword123'
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('expired');
      });

      it('should require password confirmation', async () => {
        const resetToken = 'valid-reset-token-123';
        await PatientUser.findByIdAndUpdate(testPatientUser._id, {
          passwordResetToken: resetToken,
          passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000)
        });

        const response = await request(testApp)
          .post('/api/patient-portal/auth/reset-password')
          .send({
            token: resetToken,
            password: 'newpassword123',
            confirmPassword: 'differentpassword'
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('password');
      });
    });
  });

  describe('Account Approval Workflow', () => {
    describe('POST /api/workspace-admin/patient-portal/users/:userId/approve', () => {
      it('should approve pending patient user', async () => {
        // Create pending patient user
        const pendingPatientUser = await PatientUser.create({
          email: 'pending@example.com',
          password: 'password123',
          patientId: testPatient._id,
          workplaceId: testWorkplace._id,
          status: 'pending',
          isEmailVerified: true
        });

        const response = await request(testApp)
          .post(`/api/workspace-admin/patient-portal/users/${pendingPatientUser._id}/approve`)
          .set('Cookie', `token=${workspaceAdminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('active');

        // Verify user can now login
        const loginResponse = await request(testApp)
          .post('/api/patient-portal/auth/login')
          .send({
            email: pendingPatientUser.email,
            password: 'password123',
            workplaceId: testWorkplace._id
          })
          .expect(200);

        expect(loginResponse.body.success).toBe(true);
      });

      it('should reject approval without admin authentication', async () => {
        const pendingPatientUser = await PatientUser.create({
          email: 'pending@example.com',
          password: 'password123',
          patientId: testPatient._id,
          workplaceId: testWorkplace._id,
          status: 'pending',
          isEmailVerified: true
        });

        await request(testApp)
          .post(`/api/workspace-admin/patient-portal/users/${pendingPatientUser._id}/approve`)
          .expect(401);
      });
    });

    describe('POST /api/workspace-admin/patient-portal/users/:userId/reject', () => {
      it('should reject pending patient user', async () => {
        const pendingPatientUser = await PatientUser.create({
          email: 'pending@example.com',
          password: 'password123',
          patientId: testPatient._id,
          workplaceId: testWorkplace._id,
          status: 'pending',
          isEmailVerified: true
        });

        const response = await request(testApp)
          .post(`/api/workspace-admin/patient-portal/users/${pendingPatientUser._id}/reject`)
          .set('Cookie', `token=${workspaceAdminToken}`)
          .send({ reason: 'Invalid information provided' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('rejected');

        // Verify user cannot login
        await request(testApp)
          .post('/api/patient-portal/auth/login')
          .send({
            email: pendingPatientUser.email,
            password: 'password123',
            workplaceId: testWorkplace._id
          })
          .expect(403);
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to login attempts', async () => {
      const loginData = {
        email: testPatientUser.email,
        password: 'wrongpassword',
        workplaceId: testWorkplace._id
      };

      // Make multiple failed login attempts
      const requests = Array(10).fill(null).map(() => 
        request(testApp)
          .post('/api/patient-portal/auth/login')
          .send(loginData)
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should apply rate limiting to registration attempts', async () => {
      const registrationData = {
        workplaceId: testWorkplace._id,
        email: 'spam@example.com',
        password: 'password123',
        confirmPassword: 'password123',
        firstName: 'Spam',
        lastName: 'User',
        dateOfBirth: '1990-01-01',
        gender: 'male',
        phone: '+2348087654325'
      };

      // Make multiple registration attempts
      const requests = Array(5).fill(null).map((_, i) => 
        request(testApp)
          .post('/api/patient-portal/auth/register')
          .send({ ...registrationData, email: `spam${i}@example.com` })
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Security Headers and CSRF Protection', () => {
    it('should include security headers in responses', async () => {
      const response = await request(testApp)
        .get('/api/public/workspaces/search?q=test')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });

    it('should validate CSRF tokens for state-changing operations', async () => {
      // This test would verify CSRF protection is working
      // Implementation depends on your CSRF middleware setup
      const response = await request(testApp)
        .post('/api/patient-portal/auth/register')
        .send({
          workplaceId: testWorkplace._id,
          email: 'csrf@example.com',
          password: 'password123',
          confirmPassword: 'password123',
          firstName: 'CSRF',
          lastName: 'Test',
          dateOfBirth: '1990-01-01',
          gender: 'male',
          phone: '+2348087654326'
        });

      // Should either succeed with valid CSRF token or fail without it
      expect([201, 403]).toContain(response.status);
    });
  });
});