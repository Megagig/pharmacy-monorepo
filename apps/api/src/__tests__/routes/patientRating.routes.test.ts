import request from 'supertest';
import express from 'express';
import patientRatingRoutes from '../../routes/patientRating.routes';
import { RatingService } from '../../services/RatingService';

// Mock dependencies
jest.mock('../../services/RatingService');
jest.mock('../../middlewares/auth');
jest.mock('../../middlewares/patientAuth');
jest.mock('../../utils/logger');

const MockedRatingService = RatingService as jest.Mocked<typeof RatingService>;

// Mock auth middleware
jest.mock('../../middlewares/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = {
      _id: 'patient123',
      workplaceId: 'workspace123',
      role: 'patient'
    };
    next();
  }
}));

// Mock patient auth middleware
jest.mock('../../middlewares/patientAuth', () => ({
  validatePatientAccess: (req: any, res: any, next: any) => next()
}));

// Mock validation middleware
jest.mock('../../middlewares/validation', () => ({
  handleValidationErrors: (req: any, res: any, next: any) => next()
}));

const app = express();
app.use(express.json());
app.use('/api', patientRatingRoutes);

describe('Patient Rating Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/patients/:patientId/ratings', () => {
    it('should submit rating successfully', async () => {
      const mockRating = {
        _id: 'rating123',
        rating: 4,
        feedback: 'Great service'
      };

      MockedRatingService.submitRating.mockResolvedValue(mockRating as any);

      const response = await request(app)
        .post('/api/patients/patient123/ratings')
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

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockRating);
      expect(response.body.message).toBe('Rating submitted successfully');
    });

    it('should handle service errors', async () => {
      MockedRatingService.submitRating.mockRejectedValue(
        new Error('Service error')
      );

      const response = await request(app)
        .post('/api/patients/patient123/ratings')
        .send({
          pharmacistId: 'pharm123',
          rating: 4,
          categories: {
            professionalism: 4,
            communication: 5,
            expertise: 4,
            timeliness: 3
          }
        })
        .expect(500);

      expect(response.body.error).toBe('Failed to submit rating');
    });
  });

  describe('GET /api/pharmacists/:pharmacistId/ratings', () => {
    it('should return pharmacist ratings', async () => {
      const mockResult = {
        ratings: [{ id: 'rating1', rating: 4 }],
        total: 1,
        hasMore: false,
        stats: { averageRating: 4.0 }
      };

      MockedRatingService.getPharmacistRatings.mockResolvedValue(mockResult as any);

      const response = await request(app)
        .get('/api/pharmacists/pharm123/ratings')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
    });
  });

  describe('POST /api/ratings/:ratingId/respond', () => {
    it('should add rating response successfully', async () => {
      const mockUpdatedRating = {
        _id: 'rating123',
        rating: 4,
        response: {
          text: 'Thank you for your feedback',
          respondedAt: new Date()
        }
      };

      MockedRatingService.addRatingResponse.mockResolvedValue(mockUpdatedRating as any);

      const response = await request(app)
        .post('/api/ratings/rating123/respond')
        .send({
          responseText: 'Thank you for your feedback'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockUpdatedRating);
      expect(response.body.message).toBe('Response added successfully');
    });
  });

  describe('GET /api/ratings/analytics', () => {
    it('should return rating analytics', async () => {
      const mockAnalytics = {
        totalRatings: 100,
        averageRating: 4.2,
        ratingTrend: [],
        topPharmacists: [],
        categoryBreakdown: {
          professionalism: 4.1,
          communication: 4.3,
          expertise: 4.0,
          timeliness: 4.2
        }
      };

      MockedRatingService.getRatingAnalytics.mockResolvedValue(mockAnalytics);

      const response = await request(app)
        .get('/api/ratings/analytics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAnalytics);
    });
  });
});