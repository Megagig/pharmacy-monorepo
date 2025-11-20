import mongoose from 'mongoose';
import { RatingService } from '../../services/RatingService';
import ConsultationRating from '../../models/ConsultationRating';
import Patient from '../../models/Patient';
import User from '../../models/User';
import Appointment from '../../models/Appointment';

// Mock dependencies
jest.mock('../../models/ConsultationRating');
jest.mock('../../models/Patient');
jest.mock('../../models/User');
jest.mock('../../models/Appointment');
jest.mock('../../utils/logger');

const MockedConsultationRating = ConsultationRating as jest.Mocked<typeof ConsultationRating>;
const MockedPatient = Patient as jest.Mocked<typeof Patient>;
const MockedUser = User as jest.Mocked<typeof User>;
const MockedAppointment = Appointment as jest.Mocked<typeof Appointment>;

describe('RatingService', () => {
  const mockPatientId = new mongoose.Types.ObjectId().toString();
  const mockWorkplaceId = new mongoose.Types.ObjectId().toString();
  const mockPharmacistId = new mongoose.Types.ObjectId().toString();
  const mockAppointmentId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('submitRating', () => {
    const mockRatingData = {
      pharmacistId: mockPharmacistId,
      rating: 4,
      feedback: 'Great service',
      categories: {
        professionalism: 4,
        communication: 5,
        expertise: 4,
        timeliness: 3
      },
      isAnonymous: false
    };

    it('should submit rating successfully', async () => {
      const mockPatient = { _id: mockPatientId, workplaceId: mockWorkplaceId };
      const mockPharmacist = { _id: mockPharmacistId, role: 'pharmacist' };
      const mockRating = {
        _id: new mongoose.Types.ObjectId(),
        save: jest.fn().mockResolvedValue(true)
      };

      MockedPatient.findOne.mockResolvedValue(mockPatient as any);
      MockedUser.findOne.mockResolvedValue(mockPharmacist as any);
      (MockedConsultationRating as any).mockImplementation(() => mockRating);

      const result = await RatingService.submitRating(
        mockPatientId,
        mockWorkplaceId,
        mockRatingData
      );

      expect(result).toEqual(mockRating);
      expect(mockRating.save).toHaveBeenCalled();
    });

    it('should throw error if patient not found', async () => {
      MockedPatient.findOne.mockResolvedValue(null);

      await expect(
        RatingService.submitRating(mockPatientId, mockWorkplaceId, mockRatingData)
      ).rejects.toThrow('Patient not found or access denied');
    });

    it('should throw error for invalid rating values', async () => {
      const mockPatient = { _id: mockPatientId, workplaceId: mockWorkplaceId };
      const mockPharmacist = { _id: mockPharmacistId, role: 'pharmacist' };

      MockedPatient.findOne.mockResolvedValue(mockPatient as any);
      MockedUser.findOne.mockResolvedValue(mockPharmacist as any);

      const invalidRatingData = {
        ...mockRatingData,
        rating: 6 // Invalid rating
      };

      await expect(
        RatingService.submitRating(mockPatientId, mockWorkplaceId, invalidRatingData)
      ).rejects.toThrow('Overall rating must be between 1 and 5');
    });
  });
});