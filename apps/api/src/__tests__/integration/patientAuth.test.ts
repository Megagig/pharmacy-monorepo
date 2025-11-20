import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../app';
import PatientUser from '../../models/PatientUser';
import Workplace from '../../models/Workplace';

// Helper function to extract cookies
const extractCookies = (response: request.Response): string[] => {
  const setCookieHeader = response.headers['set-cookie'];
  return Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader].filter(Boolean);
};

// Helper function to extract token from cookie
const extractTokenFromCookie = (cookies: string[], cookieName: string): string => {
  const cookie = cookies.find((cookie: string) => cookie.includes(cookieName));
  if (!cookie) throw new Error(`Cookie ${cookieName} not found`);
  return cookie.split('=')[1].split(';')[0];
};

describe('Patient Authentication Integration Tests', () => {
  let workplaceId: mongoose.Types.ObjectId;
  let testPatientUser: any;

  beforeAll(async () => {
    // Create a test workplace
    const workplace = new Workplace({
      name: 'Test Pharmacy',
      address: 'Test Address',
      phone: '+2341234567890',
      email: 'test@pharmacy.com',
      licenseNumber: 'TEST123',
      createdBy: new mongoose.Types.ObjectId(),
    });
    await workplace.save();
    workplaceId = workplace._id;
  });

  beforeEach(async () => {
    // Clean up patient users before each test
    await PatientUser.deleteMany({});
  });

  describe('POST /api/patient-auth/register', () => {
    const validRegistrationData = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '+2341234567890',
      password: 'Password123',
      workplaceId: '',
    };

    beforeEach(() => {
      validRegistrationData.workplaceId = workplaceId.toString();
    });

    it('should register a new patient user successfully', async () => {
      const response = await request(app)
        .post('/api/patient-auth/register')
        .send(validRegistrationData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.patientUser).toBeDefined();
      expect(response.body.data.patientUser.email).toBe(validRegistrationData.email);
      expect(response.body.data.patientUser.firstName).toBe(validRegistrationData.firstName);
      expect(response.body.data.patientUser.lastName).toBe(validRegistrationData.lastName);
      expect(response.body.data.patientUser.status).toBe('pending');
      expect(response.body.data.patientUser.emailVerified).toBe(false);
      expect(response.body.data.requiresEmailVerification).toBe(true);

      // Check that password is not returned
      expect(response.body.data.patientUser.passwordHash).toBeUndefined();

      // Check that cookies are set
      expect(response.headers['set-cookie']).toBeDefined();
      const cookies = extractCookies(response);
      expect(cookies.some((cookie: string) => cookie.includes('patientAccessToken'))).toBe(true);
      expect(cookies.some((cookie: string) => cookie.includes('patientRefreshToken'))).toBe(true);

      // Verify user was created in database
      const createdUser = await PatientUser.findOne({ email: validRegistrationData.email });
      expect(createdUser).toBeTruthy();
      expect(createdUser!.workplaceId.toString()).toBe(workplaceId.toString());
    });

    it('should fail with missing required fields', async () => {
      const response = await request(app)
        .post('/api/patient-auth/register')
        .send({
          firstName: 'John',
          // Missing lastName, email, password, workplaceId
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Missing required fields: firstName, lastName, email, password, and workplaceId are required');
    });

    it('should fail with invalid email format', async () => {
      const response = await request(app)
        .post('/api/patient-auth/register')
        .send({
          ...validRegistrationData,
          email: 'invalid-email',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          field: 'email',
          message: 'Please provide a valid email address',
        })
      );
    });

    it('should fail with weak password', async () => {
      const response = await request(app)
        .post('/api/patient-auth/register')
        .send({
          ...validRegistrationData,
          password: '123', // Too short and weak
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Password must be at least 8 characters long');
    });

    it('should fail with invalid workplace ID', async () => {
      const response = await request(app)
        .post('/api/patient-auth/register')
        .send({
          ...validRegistrationData,
          workplaceId: 'invalid-id',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid workplace ID');
    });

    it('should fail when registering with existing email', async () => {
      // First registration
      await request(app)
        .post('/api/patient-auth/register')
        .send(validRegistrationData)
        .expect(201);

      // Second registration with same email
      const response = await request(app)
        .post('/api/patient-auth/register')
        .send(validRegistrationData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Patient user already exists with this email or phone');
    });
  });

  describe('POST /api/patient-auth/login', () => {
    beforeEach(async () => {
      // Create a test patient user
      testPatientUser = new PatientUser({
        workplaceId,
        email: 'test@example.com',
        phone: '+2341234567890',
        passwordHash: 'Password123', // Will be hashed by pre-save middleware
        firstName: 'Test',
        lastName: 'User',
        status: 'active',
        emailVerified: true,
        createdBy: new mongoose.Types.ObjectId(),
      });
      await testPatientUser.save();
    });

    it('should login with email successfully', async () => {
      const response = await request(app)
        .post('/api/patient-auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123',
          workplaceId: workplaceId.toString(),
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.patientUser).toBeDefined();
      expect(response.body.data.patientUser.email).toBe('test@example.com');
      expect(response.body.data.requiresEmailVerification).toBe(false);

      // Check that cookies are set
      expect(response.headers['set-cookie']).toBeDefined();
      const cookies = extractCookies(response);
      expect(cookies.some((cookie: string) => cookie.includes('patientAccessToken'))).toBe(true);
      expect(cookies.some((cookie: string) => cookie.includes('patientRefreshToken'))).toBe(true);
    });

    it('should login with phone successfully', async () => {
      const response = await request(app)
        .post('/api/patient-auth/login')
        .send({
          phone: '+2341234567890',
          password: 'Password123',
          workplaceId: workplaceId.toString(),
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.patientUser).toBeDefined();
      expect(response.body.data.patientUser.phone).toBe('+2341234567890');
    });

    it('should fail with invalid credentials', async () => {
      const response = await request(app)
        .post('/api/patient-auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword',
          workplaceId: workplaceId.toString(),
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should fail with non-existent user', async () => {
      const response = await request(app)
        .post('/api/patient-auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Password123',
          workplaceId: workplaceId.toString(),
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should fail with suspended account', async () => {
      // Update user status to suspended
      await PatientUser.updateOne(
        { _id: testPatientUser._id },
        { status: 'suspended' }
      );

      const response = await request(app)
        .post('/api/patient-auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123',
          workplaceId: workplaceId.toString(),
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Account is suspended. Please contact support.');
    });

    it('should fail with missing credentials', async () => {
      const response = await request(app)
        .post('/api/patient-auth/login')
        .send({
          password: 'Password123',
          workplaceId: workplaceId.toString(),
          // Missing email or phone
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Email or phone, password, and workplaceId are required');
    });
  });

  describe('POST /api/patient-auth/verify-email', () => {
    let verificationToken: string;

    beforeEach(async () => {
      // Create a test patient user with verification token
      testPatientUser = new PatientUser({
        workplaceId,
        email: 'test@example.com',
        passwordHash: 'Password123',
        firstName: 'Test',
        lastName: 'User',
        status: 'pending',
        emailVerified: false,
        createdBy: new mongoose.Types.ObjectId(),
      });
      verificationToken = testPatientUser.generateVerificationToken();
      await testPatientUser.save();
    });

    it('should verify email successfully', async () => {
      const response = await request(app)
        .post('/api/patient-auth/verify-email')
        .send({
          token: verificationToken,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.patientUser.emailVerified).toBe(true);
      expect(response.body.data.patientUser.status).toBe('active');

      // Verify in database
      const updatedUser = await PatientUser.findById(testPatientUser._id);
      expect(updatedUser!.emailVerified).toBe(true);
      expect(updatedUser!.status).toBe('active');
      expect(updatedUser!.verificationToken).toBeUndefined();
    });

    it('should fail with invalid token', async () => {
      const response = await request(app)
        .post('/api/patient-auth/verify-email')
        .send({
          token: 'invalid-token',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid or expired verification token');
    });

    it('should fail with missing token', async () => {
      const response = await request(app)
        .post('/api/patient-auth/verify-email')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });
  });

  describe('POST /api/patient-auth/forgot-password', () => {
    beforeEach(async () => {
      // Create a test patient user
      testPatientUser = new PatientUser({
        workplaceId,
        email: 'test@example.com',
        passwordHash: 'Password123',
        firstName: 'Test',
        lastName: 'User',
        status: 'active',
        emailVerified: true,
        createdBy: new mongoose.Types.ObjectId(),
      });
      await testPatientUser.save();
    });

    it('should send password reset email successfully', async () => {
      const response = await request(app)
        .post('/api/patient-auth/forgot-password')
        .send({
          email: 'test@example.com',
          workplaceId: workplaceId.toString(),
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('If an account with that email exists, a password reset link has been sent');

      // Verify reset token was generated
      const updatedUser = await PatientUser.findById(testPatientUser._id);
      expect(updatedUser!.resetToken).toBeDefined();
      expect(updatedUser!.resetTokenExpires).toBeDefined();
    });

    it('should not reveal if email does not exist', async () => {
      const response = await request(app)
        .post('/api/patient-auth/forgot-password')
        .send({
          email: 'nonexistent@example.com',
          workplaceId: workplaceId.toString(),
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('If an account with that email exists, a password reset link has been sent');
    });
  });

  describe('POST /api/patient-auth/reset-password', () => {
    let resetToken: string;

    beforeEach(async () => {
      // Create a test patient user with reset token
      testPatientUser = new PatientUser({
        workplaceId,
        email: 'test@example.com',
        passwordHash: 'Password123',
        firstName: 'Test',
        lastName: 'User',
        status: 'active',
        emailVerified: true,
        createdBy: new mongoose.Types.ObjectId(),
      });
      resetToken = testPatientUser.generateResetToken();
      await testPatientUser.save();
    });

    it('should reset password successfully', async () => {
      const newPassword = 'NewPassword123';
      
      const response = await request(app)
        .post('/api/patient-auth/reset-password')
        .send({
          token: resetToken,
          newPassword,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.patientUser).toBeDefined();

      // Verify password was changed and tokens were cleared
      const updatedUser = await PatientUser.findById(testPatientUser._id);
      expect(updatedUser!.resetToken).toBeUndefined();
      expect(updatedUser!.resetTokenExpires).toBeUndefined();
      expect(updatedUser!.loginAttempts).toBe(0);

      // Verify new password works
      const isPasswordValid = await updatedUser!.comparePassword(newPassword);
      expect(isPasswordValid).toBe(true);
    });

    it('should fail with invalid token', async () => {
      const response = await request(app)
        .post('/api/patient-auth/reset-password')
        .send({
          token: 'invalid-token',
          newPassword: 'NewPassword123',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid or expired reset token');
    });

    it('should fail with weak password', async () => {
      const response = await request(app)
        .post('/api/patient-auth/reset-password')
        .send({
          token: resetToken,
          newPassword: '123', // Too weak
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Password must be at least 8 characters long');
    });
  });

  describe('GET /api/patient-auth/me', () => {
    let accessToken: string;

    beforeEach(async () => {
      // Create and login a test patient user
      testPatientUser = new PatientUser({
        workplaceId,
        email: 'test@example.com',
        passwordHash: 'Password123',
        firstName: 'Test',
        lastName: 'User',
        status: 'active',
        emailVerified: true,
        createdBy: new mongoose.Types.ObjectId(),
      });
      await testPatientUser.save();

      // Login to get access token
      const loginResponse = await request(app)
        .post('/api/patient-auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123',
          workplaceId: workplaceId.toString(),
        });

      // Extract access token from cookie
      const cookies = extractCookies(loginResponse);
      accessToken = extractTokenFromCookie(cookies, 'patientAccessToken');
    });

    it('should get current user profile successfully', async () => {
      const response = await request(app)
        .get('/api/patient-auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.patientUser).toBeDefined();
      expect(response.body.data.patientUser.email).toBe('test@example.com');
      expect(response.body.data.patientUser.firstName).toBe('Test');
      expect(response.body.data.patientUser.lastName).toBe('User');
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .get('/api/patient-auth/me')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('NO_TOKEN');
    });

    it('should fail with invalid token', async () => {
      const response = await request(app)
        .get('/api/patient-auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_TOKEN');
    });
  });

  describe('POST /api/patient-auth/logout', () => {
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      // Create and login a test patient user
      testPatientUser = new PatientUser({
        workplaceId,
        email: 'test@example.com',
        passwordHash: 'Password123',
        firstName: 'Test',
        lastName: 'User',
        status: 'active',
        emailVerified: true,
        createdBy: new mongoose.Types.ObjectId(),
      });
      await testPatientUser.save();

      // Login to get tokens
      const loginResponse = await request(app)
        .post('/api/patient-auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123',
          workplaceId: workplaceId.toString(),
        });

      // Extract tokens from cookies
      const cookies = extractCookies(loginResponse);
      accessToken = extractTokenFromCookie(cookies, 'patientAccessToken');
      refreshToken = extractTokenFromCookie(cookies, 'patientRefreshToken');
    });

    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/patient-auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', `patientRefreshToken=${refreshToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logged out successfully');

      // Check that cookies are cleared
      const cookies = extractCookies(response);
      expect(cookies.some((cookie: string) => 
        cookie.includes('patientAccessToken=;')
      )).toBe(true);
      expect(cookies.some((cookie: string) => 
        cookie.includes('patientRefreshToken=;')
      )).toBe(true);
    });

    it('should work even without authentication (for cookie clearing)', async () => {
      const response = await request(app)
        .post('/api/patient-auth/logout')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logged out successfully');
    });
  });
});