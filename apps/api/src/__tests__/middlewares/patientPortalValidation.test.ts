/**
 * Patient Portal Validation Middleware Unit Tests
 * Tests validation schemas for profile updates, allergies, conditions, and messaging
 * Requirements: 4.6, 4.9, 11.4
 */

/// <reference types="jest" />

import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import mongoose from 'mongoose';
import {
  validatePatientPortalRequest,
  updatePatientProfileSchema,
  addAllergySchema,
  updateAllergySchema,
  addChronicConditionSchema,
  logVitalsSchema,
  sendMessageSchema,
  submitRatingSchema,
  createBlogPostSchema,
  paginationQuerySchema,
  updateNotificationPreferencesSchema,
} from '../../middlewares/patientPortalValidation';

// Don't mock express-validator - use the real implementation

const mockValidationResult = validationResult as jest.MockedFunction<typeof validationResult>;

describe('Patient Portal Validation Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {},
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    
    next = jest.fn();

    jest.clearAllMocks();
  });

  describe('validatePatientPortalRequest', () => {
    it('should call next when no validation errors', async () => {
      // Arrange - use a valid request that passes validation
      req.body = {
        firstName: 'John',
        lastName: 'Doe',
      };

      // Run validation first to populate req with validation results
      for (const validator of updatePatientProfileSchema) {
        await validator.run(req as Request);
      }

      // Act
      validatePatientPortalRequest(req as Request, res as Response, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 400 with formatted errors when validation fails', async () => {
      // Arrange - use invalid data that will fail validation
      req.body = {
        firstName: 'A', // Too short
      };

      // Run validation first to populate req with validation results
      for (const validator of updatePatientProfileSchema) {
        await validator.run(req as Request);
      }

      // Act
      validatePatientPortalRequest(req as Request, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.any(String),
          errors: expect.arrayContaining([
            expect.objectContaining({
              field: expect.any(String),
              message: expect.any(String),
            }),
          ]),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('updatePatientProfileSchema validation', () => {
    const runValidation = async (body: any) => {
      req.body = body;
      
      // Run all validators
      for (const validator of updatePatientProfileSchema) {
        await validator.run(req as Request);
      }
      
      return validationResult(req as Request);
    };

    it('should pass with valid profile data', async () => {
      // Arrange
      const validData = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        gender: 'male',
        phone: '+2348012345678',
        bloodGroup: 'O+',
        genotype: 'AA',
        weight: 70.5,
      };

      // Act
      const result = await runValidation(validData);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should fail with invalid first name', async () => {
      // Arrange
      const invalidData = {
        firstName: 'A', // Too short
      };

      // Act
      const result = await runValidation(invalidData);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(err => err.msg.includes('First name must be between 2 and 50 characters'))).toBe(true);
    });

    it('should fail with invalid date of birth', async () => {
      // Arrange
      const invalidData = {
        dateOfBirth: '2030-01-01', // Future date
      };

      // Act
      const result = await runValidation(invalidData);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(err => err.msg.includes('Date of birth cannot be in the future'))).toBe(true);
    });

    it('should fail with invalid phone number', async () => {
      // Arrange
      const invalidData = {
        phone: '123456789', // Invalid format
      };

      // Act
      const result = await runValidation(invalidData);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(err => err.msg.includes('Please enter a valid Nigerian phone number'))).toBe(true);
    });

    it('should fail with invalid blood group', async () => {
      // Arrange
      const invalidData = {
        bloodGroup: 'X+', // Invalid blood group
      };

      // Act
      const result = await runValidation(invalidData);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(err => err.msg.includes('Blood group must be'))).toBe(true);
    });

    it('should fail with invalid weight', async () => {
      // Arrange
      const invalidData = {
        weight: 600, // Too high
      };

      // Act
      const result = await runValidation(invalidData);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(err => err.msg.includes('Weight must be between 1 and 500 kg'))).toBe(true);
    });
  });

  describe('addAllergySchema validation', () => {
    const runValidation = async (body: any) => {
      req.body = body;
      
      for (const validator of addAllergySchema) {
        await validator.run(req as Request);
      }
      
      return validationResult(req as Request);
    };

    it('should pass with valid allergy data', async () => {
      // Arrange
      const validData = {
        allergen: 'Peanuts',
        reaction: 'Severe allergic reaction with swelling and difficulty breathing',
        severity: 'severe',
        recordedDate: '2023-01-01',
      };

      // Act
      const result = await runValidation(validData);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should fail with missing required fields', async () => {
      // Arrange
      const invalidData = {}; // Completely empty data

      // Act
      const result = await runValidation(invalidData);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(err => err.msg.includes('Allergen is required'))).toBe(true);
      expect(errors.some(err => err.msg.includes('Reaction description is required'))).toBe(true);
      expect(errors.some(err => err.msg.includes('Severity is required'))).toBe(true);
    });

    it('should fail with invalid severity', async () => {
      // Arrange
      const invalidData = {
        allergen: 'Peanuts',
        reaction: 'Allergic reaction',
        severity: 'extreme', // Invalid severity
      };

      // Act
      const result = await runValidation(invalidData);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(err => err.msg.includes('Severity must be mild, moderate, or severe'))).toBe(true);
    });

    it('should fail with future recorded date', async () => {
      // Arrange
      const invalidData = {
        allergen: 'Peanuts',
        reaction: 'Allergic reaction',
        severity: 'mild',
        recordedDate: '2030-01-01', // Future date
      };

      // Act
      const result = await runValidation(invalidData);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(err => err.msg.includes('Recorded date cannot be in the future'))).toBe(true);
    });
  });

  describe('addChronicConditionSchema validation', () => {
    const runValidation = async (body: any) => {
      req.body = body;
      
      for (const validator of addChronicConditionSchema) {
        await validator.run(req as Request);
      }
      
      return validationResult(req as Request);
    };

    it('should pass with valid condition data', async () => {
      // Arrange
      const validData = {
        condition: 'Diabetes Type 2',
        diagnosedDate: '2020-01-01',
        managementPlan: 'Regular monitoring and medication',
        status: 'active',
      };

      // Act
      const result = await runValidation(validData);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should fail with missing required fields', async () => {
      // Arrange
      const invalidData = {}; // Completely empty data

      // Act
      const result = await runValidation(invalidData);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(err => err.msg.includes('Condition name is required'))).toBe(true);
      expect(errors.some(err => err.msg.includes('Diagnosed date is required'))).toBe(true);
    });

    it('should fail with future diagnosed date', async () => {
      // Arrange
      const invalidData = {
        condition: 'Diabetes',
        diagnosedDate: '2030-01-01', // Future date
      };

      // Act
      const result = await runValidation(invalidData);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(err => err.msg.includes('Diagnosed date cannot be in the future'))).toBe(true);
    });
  });

  describe('logVitalsSchema validation', () => {
    const runValidation = async (body: any) => {
      req.body = body;
      
      for (const validator of logVitalsSchema) {
        await validator.run(req as Request);
      }
      
      return validationResult(req as Request);
    };

    it('should pass with valid vitals data', async () => {
      // Arrange
      const validData = {
        bloodPressure: {
          systolic: 120,
          diastolic: 80,
        },
        heartRate: 72,
        temperature: 36.5,
        weight: 70.5,
        glucose: 5.5,
        oxygenSaturation: 98,
        notes: 'Feeling good today',
      };

      // Act
      const result = await runValidation(validData);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should fail with invalid blood pressure values', async () => {
      // Arrange
      const invalidData = {
        bloodPressure: {
          systolic: 400, // Too high
          diastolic: 20, // Too low
        },
      };

      // Act
      const result = await runValidation(invalidData);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(err => err.msg.includes('Systolic pressure must be between 50 and 300 mmHg'))).toBe(true);
      expect(errors.some(err => err.msg.includes('Diastolic pressure must be between 30 and 200 mmHg'))).toBe(true);
    });

    it('should fail with invalid heart rate', async () => {
      // Arrange
      const invalidData = {
        heartRate: 300, // Too high
      };

      // Act
      const result = await runValidation(invalidData);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(err => err.msg.includes('Heart rate must be between 30 and 250 bpm'))).toBe(true);
    });
  });

  describe('sendMessageSchema validation', () => {
    const runValidation = async (body: any) => {
      req.body = body;
      
      for (const validator of sendMessageSchema) {
        await validator.run(req as Request);
      }
      
      return validationResult(req as Request);
    };

    it('should pass with valid message data', async () => {
      // Arrange
      const validData = {
        content: 'Hello, I have a question about my medication.',
        recipientId: new mongoose.Types.ObjectId().toString(),
        messageType: 'text',
        priority: 'normal',
      };

      // Act
      const result = await runValidation(validData);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should fail with missing required fields', async () => {
      // Arrange
      const invalidData = {
        // Missing content and recipientId
        messageType: 'text',
      };

      // Act
      const result = await runValidation(invalidData);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(err => err.msg.includes('Message content is required'))).toBe(true);
      expect(errors.some(err => err.msg.includes('Recipient ID is required'))).toBe(true);
    });

    it('should fail with invalid recipient ID', async () => {
      // Arrange
      const invalidData = {
        content: 'Hello',
        recipientId: 'invalid-id',
      };

      // Act
      const result = await runValidation(invalidData);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(err => err.msg.includes('Invalid recipient ID'))).toBe(true);
    });

    it('should fail with message too long', async () => {
      // Arrange
      const invalidData = {
        content: 'A'.repeat(2001), // Too long
        recipientId: new mongoose.Types.ObjectId().toString(),
      };

      // Act
      const result = await runValidation(invalidData);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(err => err.msg.includes('Message content must be between 1 and 2000 characters'))).toBe(true);
    });
  });

  describe('submitRatingSchema validation', () => {
    const runValidation = async (body: any) => {
      req.body = body;
      
      for (const validator of submitRatingSchema) {
        await validator.run(req as Request);
      }
      
      return validationResult(req as Request);
    };

    it('should pass with valid rating data', async () => {
      // Arrange
      const validData = {
        pharmacistId: new mongoose.Types.ObjectId().toString(),
        rating: 5,
        categories: {
          professionalism: 5,
          communication: 4,
          expertise: 5,
          timeliness: 4,
        },
        feedback: 'Excellent service, very professional and helpful.',
        isAnonymous: false,
      };

      // Act
      const result = await runValidation(validData);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should fail with missing required fields', async () => {
      // Arrange
      const invalidData = {
        // Missing pharmacistId and rating
        feedback: 'Good service',
      };

      // Act
      const result = await runValidation(invalidData);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(err => err.msg.includes('Pharmacist ID is required'))).toBe(true);
      expect(errors.some(err => err.msg.includes('Overall rating is required'))).toBe(true);
    });

    it('should fail with invalid rating values', async () => {
      // Arrange
      const invalidData = {
        pharmacistId: new mongoose.Types.ObjectId().toString(),
        rating: 6, // Out of range
        categories: {
          professionalism: 0, // Out of range
          communication: 6, // Out of range
        },
      };

      // Act
      const result = await runValidation(invalidData);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(err => err.msg.includes('Rating must be between 1 and 5'))).toBe(true);
      expect(errors.some(err => err.msg.includes('Professionalism rating must be between 1 and 5'))).toBe(true);
      expect(errors.some(err => err.msg.includes('Communication rating must be between 1 and 5'))).toBe(true);
    });
  });

  describe('createBlogPostSchema validation', () => {
    const runValidation = async (body: any) => {
      req.body = body;
      
      for (const validator of createBlogPostSchema) {
        await validator.run(req as Request);
      }
      
      return validationResult(req as Request);
    };

    it('should pass with valid blog post data', async () => {
      // Arrange
      const validData = {
        title: 'Understanding Diabetes Management',
        excerpt: 'Learn about effective strategies for managing diabetes in your daily life.',
        content: 'This is a comprehensive guide to diabetes management that covers diet, exercise, medication, and monitoring. '.repeat(5),
        category: 'chronic_diseases',
        tags: ['diabetes', 'health', 'management'],
        featuredImage: {
          url: 'https://example.com/image.jpg',
          alt: 'Diabetes management infographic',
          caption: 'Key strategies for diabetes management',
        },
        status: 'draft',
        isFeatured: false,
      };

      // Act
      const result = await runValidation(validData);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should fail with missing required fields', async () => {
      // Arrange
      const invalidData = {}; // Completely empty data

      // Act
      const result = await runValidation(invalidData);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(err => err.msg.includes('Blog post title is required'))).toBe(true);
      expect(errors.some(err => err.msg.includes('Blog post excerpt is required'))).toBe(true);
      expect(errors.some(err => err.msg.includes('Blog post content is required'))).toBe(true);
      expect(errors.some(err => err.msg.includes('Category is required'))).toBe(true);
      expect(errors.some(err => err.msg.includes('Featured image is required'))).toBe(true);
    });

    it('should fail with invalid category', async () => {
      // Arrange
      const invalidData = {
        title: 'Test Post',
        excerpt: 'This is a test excerpt for validation.',
        content: 'This is test content that is long enough to pass validation requirements.',
        category: 'invalid_category',
        featuredImage: {
          url: 'https://example.com/image.jpg',
          alt: 'Test image',
        },
      };

      // Act
      const result = await runValidation(invalidData);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(err => err.msg.includes('Invalid category'))).toBe(true);
    });

    it('should fail with too many tags', async () => {
      // Arrange
      const invalidData = {
        title: 'Test Post',
        excerpt: 'This is a test excerpt for validation.',
        content: 'This is test content that is long enough to pass validation requirements.',
        category: 'wellness',
        tags: Array(11).fill('tag'), // Too many tags
        featuredImage: {
          url: 'https://example.com/image.jpg',
          alt: 'Test image',
        },
      };

      // Act
      const result = await runValidation(invalidData);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(err => err.msg.includes('Cannot have more than 10 tags'))).toBe(true);
    });
  });

  describe('paginationQuerySchema validation', () => {
    const runValidation = async (query: any) => {
      req.query = query;
      
      for (const validator of paginationQuerySchema) {
        await validator.run(req as Request);
      }
      
      return validationResult(req as Request);
    };

    it('should pass with valid pagination parameters', async () => {
      // Arrange
      const validQuery = {
        page: '1',
        limit: '20',
        sort: 'createdAt',
        order: 'desc',
      };

      // Act
      const result = await runValidation(validQuery);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should fail with invalid page number', async () => {
      // Arrange
      const invalidQuery = {
        page: '0', // Invalid
        limit: '20',
      };

      // Act
      const result = await runValidation(invalidQuery);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(err => err.msg.includes('Page must be between 1 and 1000'))).toBe(true);
    });

    it('should fail with invalid limit', async () => {
      // Arrange
      const invalidQuery = {
        page: '1',
        limit: '101', // Too high
      };

      // Act
      const result = await runValidation(invalidQuery);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(err => err.msg.includes('Limit must be between 1 and 100'))).toBe(true);
    });
  });

  describe('updateNotificationPreferencesSchema validation', () => {
    const runValidation = async (body: any) => {
      req.body = body;
      
      for (const validator of updateNotificationPreferencesSchema) {
        await validator.run(req as Request);
      }
      
      return validationResult(req as Request);
    };

    it('should pass with valid notification preferences', async () => {
      // Arrange
      const validData = {
        email: true,
        sms: false,
        push: true,
        whatsapp: false,
        appointmentReminders: true,
        medicationReminders: true,
        healthTips: false,
      };

      // Act
      const result = await runValidation(validData);

      // Assert
      expect(result.isEmpty()).toBe(true);
    });

    it('should fail with non-boolean values', async () => {
      // Arrange
      const invalidData = {
        email: 'yes', // Should be boolean
        sms: 1, // Should be boolean
        push: 'true', // Should be boolean
      };

      // Act
      const result = await runValidation(invalidData);

      // Assert
      expect(result.isEmpty()).toBe(false);
      const errors = result.array();
      expect(errors.some(err => err.msg.includes('Email preference must be a boolean'))).toBe(true);
      expect(errors.some(err => err.msg.includes('SMS preference must be a boolean'))).toBe(true);
      expect(errors.some(err => err.msg.includes('Push notification preference must be a boolean'))).toBe(true);
    });
  });
});