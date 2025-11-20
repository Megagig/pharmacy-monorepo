import mongoose from 'mongoose';
import Patient from '../../models/Patient';
import { 
  getPatientNotificationPreferences,
  updatePatientNotificationPreferences
} from '../../controllers/patientNotificationPreferencesController';

// Mock the response helpers
jest.mock('../../utils/responseHelpers', () => ({
  createSuccessResponse: (data: any) => ({ success: true, data }),
  createErrorResponse: (message: string) => ({ success: false, message }),
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

describe('Patient Notification Preferences Controller - Unit Tests', () => {
  const mockWorkplaceId = new mongoose.Types.ObjectId();
  const mockPatientId = new mongoose.Types.ObjectId();
  const mockUserId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPatientNotificationPreferences', () => {
    it('should return default preferences for patient without preferences', async () => {
      // Mock Patient.findOne to return a patient without preferences
      const mockPatient = {
        _id: mockPatientId,
        workplaceId: mockWorkplaceId,
        notificationPreferences: undefined,
        appointmentPreferences: undefined,
      };

      jest.spyOn(Patient, 'findOne').mockResolvedValue(mockPatient as any);

      const req = {
        params: { patientId: mockPatientId.toString() },
        user: { workplaceId: mockWorkplaceId },
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
          }),
        },
      });
    });

    it('should return existing preferences when patient has them', async () => {
      const mockPatient = {
        _id: mockPatientId,
        workplaceId: mockWorkplaceId,
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
      };

      jest.spyOn(Patient, 'findOne').mockResolvedValue(mockPatient as any);

      const req = {
        params: { patientId: mockPatientId.toString() },
        user: { workplaceId: mockWorkplaceId },
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

    it('should return 404 when patient not found', async () => {
      jest.spyOn(Patient, 'findOne').mockResolvedValue(null);

      const req = {
        params: { patientId: mockPatientId.toString() },
        user: { workplaceId: mockWorkplaceId },
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
        user: { workplaceId: mockWorkplaceId },
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

  describe('updatePatientNotificationPreferences', () => {
    it('should update notification preferences successfully', async () => {
      const mockPatient = {
        _id: mockPatientId,
        workplaceId: mockWorkplaceId,
        notificationPreferences: {
          email: true,
          sms: false,
          push: true,
        },
        appointmentPreferences: {
          reminderPreferences: {
            email: true,
            sms: false,
            push: true,
            whatsapp: false,
          },
          language: 'en',
          timezone: 'Africa/Lagos',
        },
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(Patient, 'findOne').mockResolvedValue(mockPatient as any);

      const req = {
        params: { patientId: mockPatientId.toString() },
        user: { workplaceId: mockWorkplaceId, userId: mockUserId },
        body: {
          email: false,
          sms: true,
          whatsapp: true,
          language: 'yo',
        },
      } as any;

      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      } as any;

      await updatePatientNotificationPreferences(req, res);

      expect(mockPatient.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          preferences: expect.objectContaining({
            email: false,
            sms: true,
            whatsapp: true,
            language: 'yo',
          }),
          message: 'Notification preferences updated successfully',
        },
      });
    });

    it('should return 404 when patient not found', async () => {
      jest.spyOn(Patient, 'findOne').mockResolvedValue(null);

      const req = {
        params: { patientId: mockPatientId.toString() },
        user: { workplaceId: mockWorkplaceId, userId: mockUserId },
        body: { email: false },
      } as any;

      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      } as any;

      await updatePatientNotificationPreferences(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Patient not found',
      });
    });

    it('should handle database errors gracefully', async () => {
      jest.spyOn(Patient, 'findOne').mockRejectedValue(new Error('Database error'));

      const req = {
        params: { patientId: mockPatientId.toString() },
        user: { workplaceId: mockWorkplaceId, userId: mockUserId },
        body: { email: false },
      } as any;

      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      } as any;

      await updatePatientNotificationPreferences(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to update notification preferences',
      });
    });
  });
});