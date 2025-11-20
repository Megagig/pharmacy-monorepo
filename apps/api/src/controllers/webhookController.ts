import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import WebhookService from '../services/WebhookService';

export class WebhookController {
  /**
   * Get webhooks
   * GET /api/admin/webhooks
   */
  async getWebhooks(req: Request, res: Response): Promise<void> {
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
        isActive,
        events,
        search,
        page = 1,
        limit = 20
      } = req.query;

      const filters = {
        userId: userId as string,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        events: events ? (Array.isArray(events) ? events as string[] : [events as string]) : undefined,
        search: search as string
      };

      const result = await WebhookService.getWebhooks(
        filters,
        parseInt(page as string),
        parseInt(limit as string)
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error fetching webhooks:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch webhooks'
        }
      });
    }
  }

  /**
   * Create webhook
   * POST /api/admin/webhooks
   */
  async createWebhook(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid webhook data',
            details: errors.array()
          }
        });
        return;
      }

      const webhook = await WebhookService.createWebhook(req.body);

      res.status(201).json({
        success: true,
        data: webhook
      });
    } catch (error) {
      console.error('Error creating webhook:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create webhook'
        }
      });
    }
  }

  /**
   * Update webhook
   * PUT /api/admin/webhooks/:id
   */
  async updateWebhook(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid webhook data',
            details: errors.array()
          }
        });
        return;
      }

      const { id } = req.params;
      const webhook = await WebhookService.updateWebhook(id, req.body);

      res.json({
        success: true,
        data: webhook
      });
    } catch (error) {
      console.error('Error updating webhook:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to update webhook'
        }
      });
    }
  }

  /**
   * Delete webhook
   * DELETE /api/admin/webhooks/:id
   */
  async deleteWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await WebhookService.deleteWebhook(id);

      res.json({
        success: true,
        message: 'Webhook deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting webhook:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to delete webhook'
        }
      });
    }
  }

  /**
   * Test webhook
   * POST /api/admin/webhooks/:id/test
   */
  async testWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await WebhookService.testWebhook(id);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error testing webhook:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to test webhook'
        }
      });
    }
  }

  /**
   * Trigger webhook manually
   * POST /api/admin/webhooks/trigger
   */
  async triggerWebhook(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid trigger data',
            details: errors.array()
          }
        });
        return;
      }

      const { eventType, eventData, eventId } = req.body;
      await WebhookService.triggerWebhook(eventType, eventData, eventId);

      res.json({
        success: true,
        message: 'Webhook triggered successfully'
      });
    } catch (error) {
      console.error('Error triggering webhook:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to trigger webhook'
        }
      });
    }
  }

  /**
   * Get webhook deliveries
   * GET /api/admin/webhooks/deliveries
   */
  async getWebhookDeliveries(req: Request, res: Response): Promise<void> {
    try {
      const {
        webhookId,
        eventType,
        status,
        startDate,
        endDate,
        page = 1,
        limit = 20
      } = req.query;

      const filters = {
        webhookId: webhookId as string,
        eventType: eventType as string,
        status: status as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined
      };

      const result = await WebhookService.getWebhookDeliveries(
        filters,
        parseInt(page as string),
        parseInt(limit as string)
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error fetching webhook deliveries:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch webhook deliveries'
        }
      });
    }
  }

  /**
   * Get webhook statistics
   * GET /api/admin/webhooks/statistics
   */
  async getWebhookStatistics(req: Request, res: Response): Promise<void> {
    try {
      const {
        webhookId,
        startDate,
        endDate
      } = req.query;

      const statistics = await WebhookService.getWebhookStatistics(
        webhookId as string,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      console.error('Error fetching webhook statistics:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch webhook statistics'
        }
      });
    }
  }

  /**
   * Get available webhook events
   * GET /api/admin/webhooks/events
   */
  async getAvailableEvents(req: Request, res: Response): Promise<void> {
    try {
      const events = WebhookService.getAvailableEvents();

      res.json({
        success: true,
        data: events
      });
    } catch (error) {
      console.error('Error fetching available events:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch available events'
        }
      });
    }
  }

  /**
   * Process webhook retries (internal endpoint)
   * POST /api/admin/webhooks/process-retries
   */
  async processRetries(req: Request, res: Response): Promise<void> {
    try {
      await WebhookService.processWebhookRetries();

      res.json({
        success: true,
        message: 'Webhook retries processed successfully'
      });
    } catch (error) {
      console.error('Error processing webhook retries:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to process webhook retries'
        }
      });
    }
  }
}

export default new WebhookController();