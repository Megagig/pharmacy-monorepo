import express, { Request, Response } from 'express';
import { query, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { Workplace } from '../models/Workplace';
import { generalRateLimiters } from '../middlewares/rateLimiting';
import PatientPortalService from '../services/PatientPortalService';
import { PublicWorkspaceController } from '../controllers/publicWorkspaceController';

const router = express.Router();

/**
 * @route GET /api/public/workspaces/test
 * @desc Test endpoint to verify API is working
 * @access Public
 */
router.get('/test', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Public workspace API is working',
    timestamp: new Date().toISOString(),
  });
});

/**
 * @route GET /api/public/workspaces/appointment-types
 * @desc Get available appointment types for a workspace (public endpoint)
 * @access Public
 */
router.get(
  '/appointment-types',
  generalRateLimiters.api,
  [
    query('workplaceId')
      .notEmpty()
      .withMessage('Workplace ID is required')
      .isMongoId()
      .withMessage('Invalid workplace ID'),
  ],
  async (req: Request, res: Response) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const { workplaceId } = req.query;

      const appointmentTypes = await PatientPortalService.getAppointmentTypes(
        new mongoose.Types.ObjectId(workplaceId as string)
      );

      res.json({
        success: true,
        data: appointmentTypes,
        message: 'Appointment types retrieved successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Get appointment types error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve appointment types',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
      });
    }
  }
);

/**
 * @route GET /api/public/workspaces/available-slots
 * @desc Get available appointment slots for a workspace (public endpoint)
 * @access Public
 */
router.get(
  '/available-slots',
  generalRateLimiters.api,
  [
    query('workplaceId')
      .notEmpty()
      .withMessage('Workplace ID is required')
      .isMongoId()
      .withMessage('Invalid workplace ID'),
    query('date')
      .notEmpty()
      .withMessage('Date is required')
      .isISO8601()
      .withMessage('Invalid date format'),
  ],
  async (req: Request, res: Response) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const {
        workplaceId,
        date,
        type,
        duration = '30',
        pharmacistId,
        locationId
      } = req.query;

      const targetDate = new Date(date as string);

      const availableSlots = await PatientPortalService.getAvailableSlots(
        new mongoose.Types.ObjectId(workplaceId as string),
        targetDate,
        {
          type: type as string,
          duration: parseInt(duration as string),
          pharmacistId: pharmacistId ? new mongoose.Types.ObjectId(pharmacistId as string) : undefined,
          locationId: locationId as string,
        }
      );

      res.json({
        success: true,
        data: availableSlots,
        message: 'Available slots retrieved successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Get available slots error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve available slots',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
      });
    }
  }
);

/**
 * @route GET /api/public/workspaces/search
 * @desc Search for workspaces by name, location, or type (public endpoint)
 * @access Public
 */
router.get('/search', generalRateLimiters.api, PublicWorkspaceController.searchWorkspaces);

/**
 * @route GET /api/public/workspaces/:workspaceId/info
 * @desc Get public workspace information
 * @access Public
 */
router.get('/:workspaceId/info', generalRateLimiters.api, PublicWorkspaceController.getWorkspaceInfo);

/**
 * @route GET /api/public/workspaces/states
 * @desc Get all Nigerian states
 * @access Public
 */
router.get('/states', generalRateLimiters.api, PublicWorkspaceController.getAvailableStates);

/**
 * @route GET /api/public/workspaces/lgas/:state
 * @desc Get LGAs for a specific state
 * @access Public
 */
router.get('/lgas/:state', generalRateLimiters.api, PublicWorkspaceController.getLGAsByState);

/**
 * @route GET /api/public/workspaces/search-old
 * @desc Old search endpoint (deprecated, kept for backward compatibility)
 * @access Public
 */
router.get(
  '/search-old',
  generalRateLimiters.api, // Use existing rate limiter
  [
    query('query')
      .notEmpty()
      .withMessage('Search query is required')
      .isLength({ min: 2, max: 100 })
      .withMessage('Search query must be between 2 and 100 characters')
      .trim()
      .escape(),
  ],
  async (req: Request, res: Response) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid search query',
          errors: errors.array(),
        });
      }

      const { query: searchQuery } = req.query;
      const searchTerm = searchQuery as string;

      // Build search criteria
      const searchCriteria = {
        $or: [
          { name: { $regex: searchTerm, $options: 'i' } },
          { type: { $regex: searchTerm, $options: 'i' } },
          { address: { $regex: searchTerm, $options: 'i' } },
          { state: { $regex: searchTerm, $options: 'i' } },
          { lga: { $regex: searchTerm, $options: 'i' } },
          { 'locations.name': { $regex: searchTerm, $options: 'i' } },
          { 'locations.address': { $regex: searchTerm, $options: 'i' } },
        ],
      };

      // Execute search with limited fields for security
      const workspaces = await Workplace.find(searchCriteria)
        .select({
          _id: 1,
          name: 1,
          type: 1,
          email: 1,
          phone: 1,
          address: 1,
          state: 1,
          lga: 1,
          logoUrl: 1,
          locations: 1,
          createdAt: 1,
        })
        .limit(20) // Limit results to prevent abuse
        .sort({ name: 1 })
        .lean();

      // Transform results for frontend consumption
      const transformedWorkspaces = workspaces.map((workspace) => ({
        id: workspace._id,
        workspaceId: workspace._id,
        name: workspace.name,
        type: workspace.type,
        email: workspace.email,
        phone: workspace.phone,
        address: workspace.address,
        state: workspace.state,
        lga: workspace.lga,
        logoUrl: workspace.logoUrl,
        locations: workspace.locations,
        // Generate description based on type
        description: generateWorkspaceDescription(workspace.type),
        // Generate hours (mock data - in real implementation, this would come from workspace settings)
        hours: generateBusinessHours(workspace.type),
      }));

      res.json({
        success: true,
        data: {
          workspaces: transformedWorkspaces,
          total: transformedWorkspaces.length,
          query: searchTerm,
        },
        message: `Found ${transformedWorkspaces.length} workspace${transformedWorkspaces.length !== 1 ? 's' : ''} matching your search`,
      });
    } catch (error) {
      console.error('Workspace search error:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while searching workspaces',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

/**
 * Generate workspace description based on type
 */
function generateWorkspaceDescription(type: string): string {
  const descriptions = {
    Community: `Your trusted neighborhood pharmacy providing comprehensive healthcare services and medication management.`,
    Hospital: `Full-service hospital pharmacy offering specialized pharmaceutical care and clinical services.`,
    Academia: `Academic institution providing pharmaceutical education and research-based healthcare services.`,
    Industry: `Industrial pharmacy facility specializing in pharmaceutical manufacturing and quality assurance.`,
    'Regulatory Body': `Regulatory organization ensuring pharmaceutical standards and compliance in healthcare delivery.`,
    Other: `Professional healthcare facility committed to providing quality pharmaceutical care and services.`,
  };

  return descriptions[type as keyof typeof descriptions] || descriptions.Other;
}

/**
 * Generate business hours based on workspace type
 */
function generateBusinessHours(type: string): string {
  const hours = {
    Community: 'Mon-Fri: 8AM-8PM, Sat: 9AM-6PM, Sun: 10AM-4PM',
    Hospital: 'Mon-Sun: 24/7',
    Academia: 'Mon-Fri: 8AM-5PM, Sat: 9AM-2PM',
    Industry: 'Mon-Fri: 7AM-6PM',
    'Regulatory Body': 'Mon-Fri: 8AM-5PM',
    Other: 'Mon-Fri: 8AM-6PM, Sat: 9AM-4PM',
  };

  return hours[type as keyof typeof hours] || hours.Other;
}

export default router;