import mongoose from 'mongoose';
import Patient from '../../models/Patient';
import User from '../../models/User';
import Workplace from '../../models/Workplace';
import { 
  getPatientNotificationPreferences,
  updatePatientNotificationPreferences,
  getPatientOptOutStatus,
  updatePatientOptOutStatus
} from '../../controllers/patientNotificationPreferencesController';
import { connectTestDB, clearTestDB, disconnectTestDB } from '../helpers/testDb';

describe('Patient Notification Preferences Controller', () => {
  let testWorkplace: any;
  let testUser: any;
  let testPatient: any;

  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    // Create test workplace
    testWorkplace = await Workplace.create({
      name: 'Test Pharmacy',
      code: 'TEST001',
      email: 'test@pharmacy.com',
      phone: '+2341234567890',
      address: 'Test Address',
      state: 'Lagos',
      country: 'Nigeria',
      subscriptionPlan: 'professional',
      subscriptionStatus: 'active',
      isDeleted: false,
    });

    // Create test user
    testUser = await User.create({
      firstName: 'Test',
      lastName: 'Pharmacist',
      email: 'pharmacist@test.com',
      password: 'password123',
      role: 'pharmacist',
      workplaceId: testWorkplace._id,
      isDeleted: false,
    });

    // Create test patient
    testPatient = await Patient.create({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '+2341234567890',
      workplaceId: testWorkplace._id,
      mrn: 'TEST001-001',
      createdBy: testUser._id,
      isDeleted: false,
    });
  });

  afterEach(async () => {
    await clearTestDB();
  });

  describe('getPatientNotificationPreferences', () => {
    it('should get default notification preferences for patient without preferences', async () => {
      const req = {
        params: { patientId: testPatient._id.toString() },
        user: { workplaceId: testWorkplace._id },
      } as any;

      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      } as any;

      await getPatientNotificationPreferences(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          preferences: expect.objectContaining({
            email: true,
            sms: false,
            push: true,
            whatsapp: false,
            language: 'en',
            timezone: 'Africa/Lagos',
            optOut: false,
            channels: expect.objectContaining({
              appointmentReminders: {
                email: true,
                sms: false,
                push: true,
                whatsapp: false,
              },
            }),
            quietHours: {
              enabled: false,
              startTime: '22:00',
              endTime: '08:00',
            },
          }),
        },
      });
    });

    it('should get existing notification preferences', async () => {
      // Update patient with preferences
      await Patient.findByIdAndUpdate(testPatient._id, {
        notificationPreferences: {
          email: false,
          sms: true,
          push: false,
        },
        appointmentPreferences: {
          reminderPreferences: {
            email: false,
            sms: true,
            push: false,
            whatsapp: true,
          },
          language: 'yo',
          timezone: 'Africa/Lagos',
        },
      });

      const req = {
        params: { patientId: testPatient._id.toString() },
        user: { workplaceId: testWorkplace._id },
      } as any;

      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      } as any;

      await getPatientNotificationPreferences(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          preferences: expect.objectContaining({
            email: false,
            sms: true,
            push: false,
            whatsapp: true,
            language: 'yo',
          }),
        },
      });
    });

    it('should return 404 for non-existent patient', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      
      const req = {
        params: { patientId: nonExistentId.toString() },
        user: { workplaceId: testWorkplace._id },
      } as any;

      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      } as any;

      await getPatientNotificationPreferences(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Patient not found',
      });
    });

    it('should return 400 for invalid patient ID', async () => {
      const req = {
        params: { patientId: 'invalid-id' },
        user: { workplaceId: testWorkplace._id },
      } as any;

      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      } as any;

      await getPatientNotificationPreferences(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid patient ID',
      });
    });
  });

  describe('PUT /api/patients/:patientId/preferences', () => {
    it('should update notification preferences', async () => {
      const updateData = {
        email: false,
        sms: true,
        whatsapp: true,
        language: 'yo',
        timezone: 'Africa/Lagos',
        channels: {
          appointmentReminders: {
            email: false,
            sms: true,
            push: false,
            whatsapp: true,
          },
          medicationRefills: {
            email: true,
            sms: false,
            push: true,
            whatsapp: false,
          },
        },
      };

      const response = await request(app)
        .put(`/api/patients/${testPatient._id}/preferences`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Notification preferences updated successfully');
      expect(response.body.data.preferences).toMatchObject({
        email: false,
        sms: true,
        whatsapp: true,
        language: 'yo',
      });

      // Verify database update
      const updatedPatient = await Patient.findById(testPatient._id);
      expect(updatedPatient?.notificationPreferences?.email).toBe(false);
      expect(updatedPatient?.notificationPreferences?.sms).toBe(true);
      expect(updatedPatient?.appointmentPreferences?.reminderPreferences?.whatsapp).toBe(true);
      expect(updatedPatient?.appointmentPreferences?.language).toBe('yo');
    });

    it('should validate language values', async () => {
      const response = await request(app)
        .put(`/api/patients/${testPatient._id}/preferences`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ language: 'invalid' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate boolean values', async () => {
      const response = await request(app)
        .put(`/api/patients/${testPatient._id}/preferences`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email: 'not-boolean' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent patient', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .put(`/api/patients/${nonExistentId}/preferences`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email: false })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Patient not found');
    });
  });

  describe('GET /api/patients/:patientId/opt-out', () => {
    it('should get opt-out status for patient with no preferences', async () => {
      const response = await request(app)
        .get(`/api/patients/${testPatient._id}/opt-out`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.optedOut).toBe(false);
      expect(response.body.data.preferences).toMatchObject({
        email: true,
        sms: false,
        push: true,
        whatsapp: false,
      });
    });

    it('should detect opted out patient', async () => {
      // Set all preferences to false
      await Patient.findByIdAndUpdate(testPatient._id, {
        notificationPreferences: {
          email: false,
          sms: false,
          push: false,
        },
        appointmentPreferences: {
          reminderPreferences: {
            email: false,
            sms: false,
            push: false,
            whatsapp: false,
          },
        },
      });

      const response = await request(app)
        .get(`/api/patients/${testPatient._id}/opt-out`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.optedOut).toBe(true);
    });
  });

  describe('PUT /api/patients/:patientId/opt-out', () => {
    it('should opt out patient from all notifications', async () => {
      const response = await request(app)
        .put(`/api/patients/${testPatient._id}/opt-out`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ optOut: true })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.optedOut).toBe(true);
      expect(response.body.data.message).toBe('Patient opted out of all notifications');

      // Verify database update
      const updatedPatient = await Patient.findById(testPatient._id);
      expect(updatedPatient?.notificationPreferences?.email).toBe(false);
      expect(updatedPatient?.notificationPreferences?.sms).toBe(false);
      expect(updatedPatient?.notificationPreferences?.push).toBe(false);
      expect(updatedPatient?.appointmentPreferences?.reminderPreferences?.whatsapp).toBe(false);
    });

    it('should opt patient back in with default preferences', async () => {
      // First opt out
      await Patient.findByIdAndUpdate(testPatient._id, {
        notificationPreferences: {
          email: false,
          sms: false,
          push: false,
        },
      });

      const response = await request(app)
        .put(`/api/patients/${testPatient._id}/opt-out`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ optOut: false })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.optedOut).toBe(false);
      expect(response.body.data.message).toBe('Patient opted back in to notifications');

      // Verify database update
      const updatedPatient = await Patient.findById(testPatient._id);
      expect(updatedPatient?.notificationPreferences?.email).toBe(true);
      expect(updatedPatient?.notificationPreferences?.push).toBe(true);
    });

    it('should validate optOut parameter', async () => {
      const response = await request(app)
        .put(`/api/patients/${testPatient._id}/opt-out`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ optOut: 'not-boolean' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should require optOut parameter', async () => {
      const response = await request(app)
        .put(`/api/patients/${testPatient._id}/opt-out`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});