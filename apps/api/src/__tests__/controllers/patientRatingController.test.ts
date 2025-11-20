import request from 'supertest';
import express from 'express';
import { PatientRatingController } from '../../controllers/patientRatingController';
import { RatingService } from '../../services/RatingService';

// Mock the service
jest.mock('../../services/RatingService');
jest.mock('../../utils/logger');

const MockedRatingService = RatingService as jest.Mocked<typeof RatingService>;

const app = express();
app.use(express.json());

// Mock authentication middleware
app.use((req: any, res, next) => {
  req.user = {
    _id: 'patient123',
    workplaceId: 'workspace123',
    role: 'patient'
  };
  next();
});

// Setup routes
app.post('/patients/:patientId/ratings', PatientRatingController.submitRating);
app.get('/pharmacists/:pharmacistId/ratings', PatientRatingController.getPharmacistRatings);
app.post('/ratings/:ratingId/respond', PatientRatingController.addRatingResponse);

describe('PatientRatingController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /patients/:patientId/ratings', () => {
    it('should submit rating successfully', async () => {
      const mockRating = {
        _id: 'rating123',
        rating: 4,
        feedback: 'Great service'
      };

      MockedRatingService.submitRating.mockResolvedValue(mockRating as any);

      const response = await request(app)
        .post('/patients/patient123/ratings')
        .send({
          pharmacistId: 'pharm123',
          rating: 4,
          feedback: 'Great service',
          categories: {
            professionalism: 4,
            communication: 5,
            expertise: 4,
            timeliness: 3
          }
        })
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        data: mockRating,
        message: 'Rating submitted successfully'
      });
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/patients/patient123/ratings')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Pharmacist ID, rating, and categories are required');
    });

    it('should return 400 for invalid rating values', async () => {
      const response = await request(app)
        .post('/patients/patient123/ratings')
        .send({
          pharmacistId: 'pharm123',
          rating: 6, // Invalid rating
          categories: {
            professionalism: 4,
            communication: 5,
            expertise: 4,
            timeliness: 3
          }
        })
        .expect(400);

      expect(response.body.error).toBe('Rating must be between 1 and 5');
    });
  });

  describe('GET /pharmacists/:pharmacistId/ratings', () => {
    it('should return pharmacist ratings for admin', async () => {
      // Override user role for this test
      app.use((req: any, res, next) => {
        req.user.role = 'admin';
        next();
      });

      const mockResult = {
        ratings: [{ id: 'rating1', rating: 4 }],
        total: 1,
        hasMore: false,
        stats: { averageRating: 4.0 }
      };

      MockedRatingService.getPharmacistRatings.mockResolvedValue(mockResult as any);

      const response = await request(app)
        .get('/pharmacists/pharm123/ratings')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockResult
      });
    });
  });
});