import { Request, Response } from 'express';
import { Workplace } from '../models/Workplace';
import { createRateLimiter } from '../middlewares/rateLimiting';
import mongoose from 'mongoose';

/**
 * Public Workspace Controller
 * Handles public workspace discovery for patient portal
 */
export class PublicWorkspaceController {
  /**
   * Search workspaces for patient portal access
   * GET /api/public/workspaces/search
   */
  static async searchWorkspaces(req: Request, res: Response) {
    try {
      const {
        search = '',
        state = '',
        lga = '',
        limit = 10,
        page = 1
      } = req.query;

      // Build search query
      const query: any = {
        patientPortalEnabled: true,
        verificationStatus: 'verified'
      };

      // Require at least a search term or state filter
      const hasSearchCriteria = (search && typeof search === 'string' && search.trim().length > 0) ||
        (state && typeof state === 'string' && state.trim().length > 0) ||
        (lga && typeof lga === 'string' && lga.trim().length > 0);

      if (!hasSearchCriteria) {
        // Return empty results if no search criteria
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.json({
          success: true,
          data: {
            workspaces: [],
            pagination: {
              page: 1,
              limit: parseInt(limit as string) || 10,
              total: 0,
              pages: 0
            }
          }
        });
        return;
      }

      // Text search across name, type, and address
      if (search && typeof search === 'string' && search.trim()) {
        query.$or = [
          { name: { $regex: search.trim(), $options: 'i' } },
          { type: { $regex: search.trim(), $options: 'i' } },
          { address: { $regex: search.trim(), $options: 'i' } }
        ];
      }

      // Location filters
      if (state && typeof state === 'string') {
        query.state = state;
      }

      if (lga && typeof lga === 'string') {
        query.lga = { $regex: lga, $options: 'i' };
      }

      // Pagination
      const limitNum = Math.min(parseInt(limit as string) || 10, 50);
      const pageNum = Math.max(parseInt(page as string) || 1, 1);
      const skip = (pageNum - 1) * limitNum;

      // Execute search with pagination
      const [workspaces, total] = await Promise.all([
        Workplace.find(query)
          .select('name type address state lga logoUrl phone email patientPortalSettings')
          .sort({ name: 1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Workplace.countDocuments(query)
      ]);

      // Format response
      const formattedWorkspaces = workspaces.map(workspace => ({
        _id: workspace._id,
        name: workspace.name,
        type: workspace.type,
        address: workspace.address,
        state: workspace.state,
        lga: workspace.lga,
        logoUrl: workspace.logoUrl,
        phone: workspace.phone,
        email: workspace.email,
        operatingHours: workspace.patientPortalSettings?.operatingHours || 'Monday-Friday: 8:00 AM - 5:00 PM',
        services: workspace.patientPortalSettings?.services || []
      }));

      // Disable caching for search results (they should be fresh)
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      res.json({
        success: true,
        data: {
          workspaces: formattedWorkspaces,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum)
          }
        }
      });

    } catch (error) {
      console.error('Error searching workspaces:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search workspaces'
      });
    }
  }

  /**
   * Get public workspace information
   * GET /api/public/workspaces/:workspaceId/info
   */
  static async getWorkspaceInfo(req: Request, res: Response) {
    try {
      const { workspaceId } = req.params;

      // Validate workspace ID
      if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid workspace ID'
        });
      }

      // Find workspace
      const workspace = await Workplace.findOne({
        _id: workspaceId,
        patientPortalEnabled: true,
        verificationStatus: 'verified'
      })
        .select('name type address state lga logoUrl phone email patientPortalSettings')
        .lean();

      if (!workspace) {
        return res.status(404).json({
          success: false,
          message: 'Workspace not found or patient portal not enabled'
        });
      }

      // Format response
      const workspaceInfo = {
        _id: workspace._id,
        name: workspace.name,
        type: workspace.type,
        address: workspace.address,
        state: workspace.state,
        lga: workspace.lga,
        logoUrl: workspace.logoUrl,
        phone: workspace.phone,
        email: workspace.email,
        operatingHours: workspace.patientPortalSettings?.operatingHours || 'Monday-Friday: 8:00 AM - 5:00 PM',
        services: workspace.patientPortalSettings?.services || [],
        allowSelfRegistration: workspace.patientPortalSettings?.allowSelfRegistration ?? true,
        requireEmailVerification: workspace.patientPortalSettings?.requireEmailVerification ?? true,
        requireAdminApproval: workspace.patientPortalSettings?.requireAdminApproval ?? true
      };

      res.json({
        success: true,
        data: workspaceInfo
      });

    } catch (error) {
      console.error('Error fetching workspace info:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch workspace information'
      });
    }
  }

  /**
   * Get available states for filtering
   * GET /api/public/workspaces/states
   */
  static async getAvailableStates(req: Request, res: Response) {
    try {
      const states = await Workplace.distinct('state', {
        patientPortalEnabled: true,
        verificationStatus: 'verified',
        state: { $exists: true, $ne: null }
      });

      res.json({
        success: true,
        data: states.sort()
      });

    } catch (error) {
      console.error('Error fetching states:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch available states'
      });
    }
  }

  /**
   * Get LGAs for a specific state
   * GET /api/public/workspaces/lgas/:state
   */
  static async getLGAsByState(req: Request, res: Response) {
    try {
      const { state } = req.params;

      const lgas = await Workplace.distinct('lga', {
        patientPortalEnabled: true,
        verificationStatus: 'verified',
        state: state,
        lga: { $exists: true, $ne: null }
      });

      res.json({
        success: true,
        data: lgas.sort()
      });

    } catch (error) {
      console.error('Error fetching LGAs:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch LGAs for the specified state'
      });
    }
  }
}

// Rate limiters for public endpoints
export const publicWorkspaceRateLimiters = {
  search: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: 'Too many search requests, please try again later'
  }),
  info: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // 200 requests per window
    message: 'Too many info requests, please try again later'
  })
};