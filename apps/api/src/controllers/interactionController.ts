import { Response } from 'express';
import { AuthRequest } from '../types/auth';
import { validationResult } from 'express-validator';
import mongoose from 'mongoose';
import unifiedInteractionService from '../services/unifiedInteractionService';
import DrugInteraction from '../models/DrugInteraction';
import logger from '../utils/logger';

export class InteractionController {
  /**
   * Check interactions for a list of medications
   * POST /api/interactions/check
   */
  async checkInteractions(req: AuthRequest, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { patientId, medications, checkType = 'manual', checkTrigger } = req.body;
      const workplaceId = req.user?.workplaceId;
      const userId = req.user?._id;
      const userRole = req.user?.role;

      // Super admins can check interactions but need a workplaceId for this operation
      const isSuperAdmin = userRole === 'super_admin';

      if (!userId || (!workplaceId && !isSuperAdmin)) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // If super admin without workplaceId, require workplaceId to be provided in request
      if (isSuperAdmin && !workplaceId) {
        return res.status(400).json({
          success: false,
          message: 'workplaceId is required for this operation'
        });
      }

      const result = await unifiedInteractionService.checkInteractions({
        patientId: new mongoose.Types.ObjectId(patientId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        medications,
        checkType,
        checkTrigger,
        userId: new mongoose.Types.ObjectId(userId)
      });

      return res.status(200).json({
        success: true,
        message: 'Interaction check completed',
        data: result
      });

    } catch (error) {
      logger.error('Error in checkInteractions controller:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to check drug interactions',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Check interactions for all active medications of a patient
   * POST /api/interactions/check-patient
   */
  async checkPatientMedications(req: AuthRequest, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { patientId, checkType = 'manual' } = req.body;
      const workplaceId = req.user?.workplaceId;
      const userId = req.user?._id;
      const userRole = req.user?.role;

      // Super admins can check interactions but need a workplaceId for this operation
      const isSuperAdmin = userRole === 'super_admin';

      if (!userId || (!workplaceId && !isSuperAdmin)) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // If super admin without workplaceId, require workplaceId to be provided in request
      if (isSuperAdmin && !workplaceId) {
        return res.status(400).json({
          success: false,
          message: 'workplaceId is required for this operation'
        });
      }

      const result = await unifiedInteractionService.checkPatientMedications(
        new mongoose.Types.ObjectId(patientId),
        new mongoose.Types.ObjectId(workplaceId),
        new mongoose.Types.ObjectId(userId),
        checkType
      );

      return res.status(200).json({
        success: true,
        message: 'Patient medication interaction check completed',
        data: result
      });

    } catch (error) {
      logger.error('Error in checkPatientMedications controller:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to check patient medications for interactions',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Batch check interactions for multiple patients
   * POST /api/interactions/batch-check
   */
  async batchCheckInteractions(req: AuthRequest, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { patientIds } = req.body;
      const workplaceId = req.user?.workplaceId;
      const userId = req.user?._id;
      const userRole = req.user?.role;

      // Super admins can batch check interactions but need a workplaceId for this operation
      const isSuperAdmin = userRole === 'super_admin';

      if (!userId || (!workplaceId && !isSuperAdmin)) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // If super admin without workplaceId, require workplaceId to be provided in request
      if (isSuperAdmin && !workplaceId) {
        return res.status(400).json({
          success: false,
          message: 'workplaceId is required for this operation'
        });
      }

      // Convert to batch requests
      const requests = patientIds.map((patientId: string) => ({
        patientId: new mongoose.Types.ObjectId(patientId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        medications: [], // Will be loaded by service
        checkType: 'automatic' as const,
        checkTrigger: 'batch_check',
        userId: new mongoose.Types.ObjectId(userId)
      }));

      const results = await unifiedInteractionService.batchCheckInteractions(requests);

      return res.status(200).json({
        success: true,
        message: `Batch interaction check completed for ${patientIds.length} patients`,
        data: {
          total: results.length,
          withInteractions: results.filter(r => r.result.hasInteractions).length,
          withCriticalInteractions: results.filter(r => r.result.hasCriticalInteractions).length,
          results
        }
      });

    } catch (error) {
      logger.error('Error in batchCheckInteractions controller:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to perform batch interaction check',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get interaction details by ID
   * GET /api/interactions/:id
   */
  async getInteraction(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const workplaceId = req.user?.workplaceId;
      const userRole = req.user?.role;

      // Super admins can access interactions across all workspaces
      const isSuperAdmin = userRole === 'super_admin';

      if (!workplaceId && !isSuperAdmin) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Build query - super admins can access any interaction, others are limited to their workspace
      const query: any = { _id: new mongoose.Types.ObjectId(id) };
      if (!isSuperAdmin && workplaceId) {
        query.workplaceId = new mongoose.Types.ObjectId(workplaceId);
      }

      const interaction = await DrugInteraction.findOne(query)
        .populate('patientId', 'firstName lastName')
        .populate('reviewedBy', 'firstName lastName');

      if (!interaction) {
        return res.status(404).json({
          success: false,
          message: 'Interaction not found'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Interaction retrieved successfully',
        data: interaction
      });

    } catch (error) {
      logger.error('Error in getInteraction controller:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve interaction',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get patient's interaction history
   * GET /api/interactions/patient/:patientId
   */
  async getPatientInteractions(req: AuthRequest, res: Response) {
    try {
      const { patientId } = req.params;
      const { includeResolved = 'false', limit = '50' } = req.query;

      const interactions = await unifiedInteractionService.getPatientInteractionHistory(
        new mongoose.Types.ObjectId(patientId),
        includeResolved === 'true',
        parseInt(limit as string)
      );

      return res.status(200).json({
        success: true,
        message: 'Patient interactions retrieved successfully',
        data: {
          count: interactions.length,
          interactions
        }
      });

    } catch (error) {
      logger.error('Error in getPatientInteractions controller:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve patient interactions',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get pending interactions requiring pharmacist review
   * GET /api/interactions/pending-reviews
   */
  async getPendingReviews(req: AuthRequest, res: Response) {
    try {
      const workplaceId = req.user?.workplaceId;
      const userRole = req.user?.role;
      const { limit = '100' } = req.query;

      // Super admins can access interactions across all workspaces
      const isSuperAdmin = userRole === 'super_admin';

      if (!workplaceId && !isSuperAdmin) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      let pendingInteractions;

      if (isSuperAdmin && !workplaceId) {
        // Super admin without workplaceId - get pending reviews from all workspaces
        pendingInteractions = await DrugInteraction.find({
          status: 'pending'
        })
        .populate('patientId', 'firstName lastName')
        .populate('reviewedBy', 'firstName lastName')
        .populate('workplaceId', 'name')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit as string));
      } else {
        // Regular user or super admin with workplaceId - use existing service
        pendingInteractions = await unifiedInteractionService.getPendingReviews(
          new mongoose.Types.ObjectId(workplaceId!),
          parseInt(limit as string)
        );
      }

      // Group by severity for dashboard display
      const summary = {
        total: pendingInteractions.length,
        contraindicated: pendingInteractions.filter(i => i.hasContraindication).length,
        critical: pendingInteractions.filter(i => i.hasCriticalInteraction && !i.hasContraindication).length,
        pendingReviews: pendingInteractions.filter(i => i.status === 'pending').length
      };

      return res.status(200).json({
        success: true,
        message: 'Pending reviews retrieved successfully',
        data: {
          summary,
          interactions: pendingInteractions
        }
      });

    } catch (error) {
      logger.error('Error in getPendingReviews controller:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve pending reviews',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Review an interaction (pharmacist action)
   * POST /api/interactions/:id/review
   */
  async reviewInteraction(req: AuthRequest, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const { action, reason, modificationSuggestions, monitoringParameters, notes } = req.body;
      const userId = req.user?._id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const reviewDecision = {
        action,
        reason,
        modificationSuggestions,
        monitoringParameters
      };

      const reviewedInteraction = await unifiedInteractionService.reviewInteraction(
        new mongoose.Types.ObjectId(id),
        new mongoose.Types.ObjectId(userId),
        reviewDecision,
        notes
      );

      return res.status(200).json({
        success: true,
        message: 'Interaction reviewed successfully',
        data: reviewedInteraction
      });

    } catch (error) {
      logger.error('Error in reviewInteraction controller:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to review interaction',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get critical interactions (dashboard summary)
   * GET /api/interactions/critical
   */
  async getCriticalInteractions(req: AuthRequest, res: Response) {
    try {
      const workplaceId = req.user?.workplaceId;
      const userRole = req.user?.role;
      const { from, to } = req.query;

      // Super admins can access interactions across all workspaces
      const isSuperAdmin = userRole === 'super_admin';

      if (!workplaceId && !isSuperAdmin) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      let timeRange;
      if (from && to) {
        timeRange = {
          from: new Date(from as string),
          to: new Date(to as string)
        };
      }

      let criticalInteractions;

      if (isSuperAdmin && !workplaceId) {
        // Super admin without workplaceId - get critical interactions from all workspaces
        const query: any = {
          $or: [
            { hasCriticalInteraction: true },
            { hasContraindication: true }
          ]
        };

        if (timeRange) {
          query.createdAt = {
            $gte: timeRange.from,
            $lte: timeRange.to
          };
        }

        criticalInteractions = await DrugInteraction.find(query)
          .populate('patientId', 'firstName lastName')
          .populate('reviewedBy', 'firstName lastName')
          .populate('workplaceId', 'name')
          .sort({ createdAt: -1 })
          .limit(100);
      } else {
        // Regular user or super admin with workplaceId - use existing method
        criticalInteractions = await DrugInteraction.findCriticalInteractions(
          new mongoose.Types.ObjectId(workplaceId!),
          timeRange
        );
      }

      // Create summary statistics
      const stats = {
        total: criticalInteractions.length,
        contraindicated: criticalInteractions.filter(i => i.hasContraindication).length,
        unreviewed: criticalInteractions.filter(i => i.status === 'pending').length,
        byStatus: {
          pending: 0,
          reviewed: 0,
          approved: 0,
          rejected: 0,
          monitoring: 0
        }
      };

      criticalInteractions.forEach(interaction => {
        stats.byStatus[interaction.status]++;
      });

      return res.status(200).json({
        success: true,
        message: 'Critical interactions retrieved successfully',
        data: {
          stats,
          interactions: criticalInteractions
        }
      });

    } catch (error) {
      logger.error('Error in getCriticalInteractions controller:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve critical interactions',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Mark interaction as acknowledged by patient
   * POST /api/interactions/:id/acknowledge
   */
  async acknowledgeInteraction(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const interaction = await DrugInteraction.findById(id);
      if (!interaction) {
        return res.status(404).json({
          success: false,
          message: 'Interaction not found'
        });
      }

      await interaction.acknowledgeByPatient();

      return res.status(200).json({
        success: true,
        message: 'Interaction acknowledged by patient',
        data: interaction
      });

    } catch (error) {
      logger.error('Error in acknowledgeInteraction controller:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to acknowledge interaction',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get interaction statistics for analytics
   * GET /api/interactions/analytics
   */
  async getInteractionAnalytics(req: AuthRequest, res: Response) {
    try {
      const workplaceId = req.user?.workplaceId;
      const userRole = req.user?.role;
      const { from, to } = req.query;

      // Super admins can access analytics across all workspaces
      const isSuperAdmin = userRole === 'super_admin';

      if (!workplaceId && !isSuperAdmin) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Build match stage - super admins get all data, others limited to their workspace
      const matchStage: any = {};
      
      if (!isSuperAdmin && workplaceId) {
        matchStage.workplaceId = new mongoose.Types.ObjectId(workplaceId);
      }
      
      if (from && to) {
        matchStage.createdAt = {
          $gte: new Date(from as string),
          $lte: new Date(to as string)
        };
      }

      const analytics = await DrugInteraction.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalChecks: { $sum: 1 },
            totalInteractions: { $sum: { $size: '$interactions' } },
            criticalInteractions: {
              $sum: { $cond: ['$hasCriticalInteraction', 1, 0] }
            },
            contraindications: {
              $sum: { $cond: ['$hasContraindication', 1, 0] }
            },
            pendingReviews: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
            },
            averageInteractionsPerCheck: {
              $avg: { $size: '$interactions' }
            }
          }
        }
      ]);

      // Get interaction trends by severity
      const severityTrends = await DrugInteraction.aggregate([
        { $match: matchStage },
        { $unwind: '$interactions' },
        {
          $group: {
            _id: '$interactions.severity',
            count: { $sum: 1 }
          }
        }
      ]);

      return res.status(200).json({
        success: true,
        message: 'Interaction analytics retrieved successfully',
        data: {
          summary: analytics[0] || {
            totalChecks: 0,
            totalInteractions: 0,
            criticalInteractions: 0,
            contraindications: 0,
            pendingReviews: 0,
            averageInteractionsPerCheck: 0
          },
          severityBreakdown: severityTrends
        }
      });

    } catch (error) {
      logger.error('Error in getInteractionAnalytics controller:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve interaction analytics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export default new InteractionController();