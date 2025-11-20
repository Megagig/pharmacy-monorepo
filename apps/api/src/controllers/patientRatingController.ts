import { Request, Response } from 'express';
import { RatingService } from '../services/RatingService';
import logger from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    workplaceId: string;
    role: string;
  };
}

export class PatientRatingController {
  /**
   * Submit a new rating
   */
  static async submitRating(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { patientId } = req.params;
      const { 
        pharmacistId, 
        appointmentId, 
        rating, 
        feedback, 
        categories, 
        isAnonymous 
      } = req.body;
      const workplaceId = req.user?.workplaceId;

      if (!workplaceId) {
        res.status(401).json({ error: 'Workspace not found' });
        return;
      }

      // Validate patient access (patient can only submit their own ratings)
      if (req.user?.role === 'patient' && req.user._id !== patientId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      // Validate required fields
      if (!pharmacistId || !rating || !categories) {
        res.status(400).json({ 
          error: 'Pharmacist ID, rating, and categories are required' 
        });
        return;
      }

      // Validate rating values
      if (rating < 1 || rating > 5) {
        res.status(400).json({ error: 'Rating must be between 1 and 5' });
        return;
      }

      // Validate categories
      const { professionalism, communication, expertise, timeliness } = categories;
      if (
        !professionalism || !communication || !expertise || !timeliness ||
        professionalism < 1 || professionalism > 5 ||
        communication < 1 || communication > 5 ||
        expertise < 1 || expertise > 5 ||
        timeliness < 1 || timeliness > 5
      ) {
        res.status(400).json({ 
          error: 'All category ratings must be between 1 and 5' 
        });
        return;
      }

      const ratingData = {
        pharmacistId,
        appointmentId,
        rating: parseInt(rating),
        feedback,
        categories: {
          professionalism: parseInt(professionalism),
          communication: parseInt(communication),
          expertise: parseInt(expertise),
          timeliness: parseInt(timeliness)
        },
        isAnonymous: Boolean(isAnonymous)
      };

      const newRating = await RatingService.submitRating(
        patientId,
        workplaceId,
        ratingData
      );

      res.status(201).json({
        success: true,
        data: newRating,
        message: 'Rating submitted successfully'
      });
    } catch (error) {
      logger.error('Error in submitRating:', error);
      res.status(500).json({
        error: 'Failed to submit rating',
        message: error.message
      });
    }
  }

  /**
   * Get ratings for a pharmacist
   */
  static async getPharmacistRatings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { pharmacistId } = req.params;
      const { 
        ratingMin, 
        ratingMax, 
        dateFrom, 
        dateTo, 
        hasResponse, 
        limit, 
        skip 
      } = req.query;
      const workplaceId = req.user?.workplaceId;

      if (!workplaceId) {
        res.status(401).json({ error: 'Workspace not found' });
        return;
      }

      // Only pharmacists can view their own ratings, or super_admin/owner can view any
      if (
        req.user?.role === 'pharmacist' && 
        req.user._id !== pharmacistId
      ) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const filters = {
        ratingMin: ratingMin ? parseInt(ratingMin as string) : undefined,
        ratingMax: ratingMax ? parseInt(ratingMax as string) : undefined,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
        hasResponse: hasResponse !== undefined ? hasResponse === 'true' : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        skip: skip ? parseInt(skip as string) : undefined
      };

      const result = await RatingService.getPharmacistRatings(
        pharmacistId,
        workplaceId,
        filters
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error in getPharmacistRatings:', error);
      res.status(500).json({
        error: 'Failed to retrieve pharmacist ratings',
        message: error.message
      });
    }
  }

  /**
   * Get pharmacist rating statistics
   */
  static async getPharmacistRatingStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { pharmacistId } = req.params;
      const workplaceId = req.user?.workplaceId;

      if (!workplaceId) {
        res.status(401).json({ error: 'Workspace not found' });
        return;
      }

      // Only pharmacists can view their own stats, or super_admin/owner can view any
      if (
        req.user?.role === 'pharmacist' && 
        req.user._id !== pharmacistId
      ) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const stats = await RatingService.getPharmacistRatingStats(
        pharmacistId,
        workplaceId
      );

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Error in getPharmacistRatingStats:', error);
      res.status(500).json({
        error: 'Failed to retrieve pharmacist rating statistics',
        message: error.message
      });
    }
  }

  /**
   * Add response to a rating
   */
  static async addRatingResponse(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { ratingId } = req.params;
      const { responseText } = req.body;
      const workplaceId = req.user?.workplaceId;
      const responderId = req.user?._id;

      if (!workplaceId || !responderId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // Validate required fields
      if (!responseText || responseText.trim().length === 0) {
        res.status(400).json({ error: 'Response text is required' });
        return;
      }

      if (responseText.length > 1000) {
        res.status(400).json({ error: 'Response text must be 1000 characters or less' });
        return;
      }

      const updatedRating = await RatingService.addRatingResponse(
        ratingId,
        responderId,
        workplaceId,
        responseText.trim()
      );

      res.json({
        success: true,
        data: updatedRating,
        message: 'Response added successfully'
      });
    } catch (error) {
      logger.error('Error in addRatingResponse:', error);
      res.status(500).json({
        error: 'Failed to add rating response',
        message: error.message
      });
    }
  }

  /**
   * Get rating analytics for workspace
   */
  static async getRatingAnalytics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { dateFrom, dateTo } = req.query;
      const workplaceId = req.user?.workplaceId;

      if (!workplaceId) {
        res.status(401).json({ error: 'Workspace not found' });
        return;
      }

      // Only super_admin/owner can view analytics
      if (!['super_admin', 'owner'].includes(req.user?.role || '')) {
        res.status(403).json({ error: 'Admin access required' });
        return;
      }

      const analytics = await RatingService.getRatingAnalytics(
        workplaceId,
        dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo ? new Date(dateTo as string) : undefined
      );

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error('Error in getRatingAnalytics:', error);
      res.status(500).json({
        error: 'Failed to retrieve rating analytics',
        message: error.message
      });
    }
  }

  /**
   * Get patient's submitted ratings
   */
  static async getPatientRatings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { patientId } = req.params;
      const { limit, skip } = req.query;
      const workplaceId = req.user?.workplaceId;

      if (!workplaceId) {
        res.status(401).json({ error: 'Workspace not found' });
        return;
      }

      // Validate patient access
      if (req.user?.role === 'patient' && req.user._id !== patientId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const filters = {
        patientId,
        limit: limit ? parseInt(limit as string) : undefined,
        skip: skip ? parseInt(skip as string) : undefined
      };

      // Use the existing getPharmacistRatings method but filter by patient
      // This is a simplified approach - in a real implementation, you might want
      // a dedicated method for patient ratings
      const result = await RatingService.getPharmacistRatings(
        '', // Empty pharmacist ID to get all ratings
        workplaceId,
        filters
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error in getPatientRatings:', error);
      res.status(500).json({
        error: 'Failed to retrieve patient ratings',
        message: error.message
      });
    }
  }

  /**
   * Update a rating (only before pharmacist responds)
   */
  static async updateRating(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { ratingId } = req.params;
      const { rating, feedback, categories } = req.body;
      const workplaceId = req.user?.workplaceId;

      if (!workplaceId) {
        res.status(401).json({ error: 'Workspace not found' });
        return;
      }

      // This is a placeholder for rating update functionality
      // In a real implementation, you would:
      // 1. Find the rating and verify ownership
      // 2. Check if it can be updated (no response yet)
      // 3. Update the rating
      
      res.status(501).json({
        error: 'Rating update functionality not yet implemented',
        message: 'This feature will be available in a future update'
      });
    } catch (error) {
      logger.error('Error in updateRating:', error);
      res.status(500).json({
        error: 'Failed to update rating',
        message: error.message
      });
    }
  }

  /**
   * Delete a rating (only before pharmacist responds)
   */
  static async deleteRating(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { ratingId } = req.params;
      const workplaceId = req.user?.workplaceId;

      if (!workplaceId) {
        res.status(401).json({ error: 'Workspace not found' });
        return;
      }

      // This is a placeholder for rating deletion functionality
      // In a real implementation, you would:
      // 1. Find the rating and verify ownership
      // 2. Check if it can be deleted (no response yet)
      // 3. Delete the rating
      
      res.status(501).json({
        error: 'Rating deletion functionality not yet implemented',
        message: 'This feature will be available in a future update'
      });
    } catch (error) {
      logger.error('Error in deleteRating:', error);
      res.status(500).json({
        error: 'Failed to delete rating',
        message: error.message
      });
    }
  }
}