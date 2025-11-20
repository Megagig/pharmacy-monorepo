import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import IntegrationService from '../services/IntegrationService';

export class IntegrationController {
  /**
   * Get integrations
   * GET /api/admin/integrations
   */
  async getIntegrations(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
            details: errors.array()
          }
        });
        return;
      }

      const {
        userId,
        type,
        provider,
        isActive,
        syncFrequency,
        search,
        page = 1,
        limit = 20
      } = req.query;

      const filters = {
        userId: userId as string,
        type: type as string,
        provider: provider as string,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        syncFrequency: syncFrequency as string,
        search: search as string
      };

      const result = await IntegrationService.getIntegrations(
        filters,
        parseInt(page as string),
        parseInt(limit as string)
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error fetching integrations:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch integrations'
        }
      });
    }
  }

  /**
   * Create integration
   * POST /api/admin/integrations
   */
  async createIntegration(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid integration data',
            details: errors.array()
          }
        });
        return;
      }

      const integration = await IntegrationService.createIntegration(req.body);

      res.status(201).json({
        success: true,
        data: integration
      });
    } catch (error) {
      console.error('Error creating integration:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create integration'
        }
      });
    }
  }

  /**
   * Update integration
   * PUT /api/admin/integrations/:id
   */
  async updateIntegration(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid integration data',
            details: errors.array()
          }
        });
        return;
      }

      const { id } = req.params;
      const integration = await IntegrationService.updateIntegration(id, req.body);

      res.json({
        success: true,
        data: integration
      });
    } catch (error) {
      console.error('Error updating integration:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to update integration'
        }
      });
    }
  }

  /**
   * Delete integration
   * DELETE /api/admin/integrations/:id
   */
  async deleteIntegration(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await IntegrationService.deleteIntegration(id);

      res.json({
        success: true,
        message: 'Integration deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting integration:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to delete integration'
        }
      });
    }
  }

  /**
   * Test integration
   * POST /api/admin/integrations/:id/test
   */
  async testIntegration(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await IntegrationService.testIntegration(id);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error testing integration:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to test integration'
        }
      });
    }
  }

  /**
   * Execute integration sync
   * POST /api/admin/integrations/:id/sync
   */
  async executeSync(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { manual = false } = req.body;

      const result = await IntegrationService.executeSync(id, manual);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error executing integration sync:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to execute sync'
        }
      });
    }
  }

  /**
   * Get integration statistics
   * GET /api/admin/integrations/statistics
   */
  async getIntegrationStatistics(req: Request, res: Response): Promise<void> {
    try {
      const {
        integrationId,
        startDate,
        endDate
      } = req.query;

      const statistics = await IntegrationService.getIntegrationStatistics(
        integrationId as string,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      console.error('Error fetching integration statistics:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch integration statistics'
        }
      });
    }
  }

  /**
   * Get available integration providers
   * GET /api/admin/integrations/providers
   */
  async getAvailableProviders(req: Request, res: Response): Promise<void> {
    try {
      const providers = IntegrationService.getAvailableProviders();

      res.json({
        success: true,
        data: providers
      });
    } catch (error) {
      console.error('Error fetching available providers:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch available providers'
        }
      });
    }
  }

  /**
   * Process scheduled syncs (internal endpoint)
   * POST /api/admin/integrations/process-scheduled
   */
  async processScheduledSyncs(req: Request, res: Response): Promise<void> {
    try {
      await IntegrationService.processScheduledSyncs();

      res.json({
        success: true,
        message: 'Scheduled syncs processed successfully'
      });
    } catch (error) {
      console.error('Error processing scheduled syncs:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to process scheduled syncs'
        }
      });
    }
  }
}

export default new IntegrationController();