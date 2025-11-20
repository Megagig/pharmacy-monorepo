import { Request, Response } from 'express';
import ApiManagementService from '../services/ApiManagementService';
import { validationResult } from 'express-validator';

export class ApiManagementController {
  /**
   * Get all API endpoints
   * GET /api/admin/api-management/endpoints
   */
  async getEndpoints(req: Request, res: Response): Promise<void> {
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
        category,
        version,
        deprecated,
        isPublic,
        tags,
        search,
        page = 1,
        limit = 20
      } = req.query;

      const filters = {
        category: category as string,
        version: version as string,
        deprecated: deprecated === 'true' ? true : deprecated === 'false' ? false : undefined,
        isPublic: isPublic === 'true' ? true : isPublic === 'false' ? false : undefined,
        tags: tags ? (Array.isArray(tags) ? tags as string[] : [tags as string]) : undefined,
        search: search as string
      };

      const result = await ApiManagementService.getApiEndpoints(
        filters,
        parseInt(page as string),
        parseInt(limit as string)
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error fetching API endpoints:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch API endpoints'
        }
      });
    }
  }

  /**
   * Create or update an API endpoint
   * POST /api/admin/api-management/endpoints
   */
  async createOrUpdateEndpoint(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid endpoint data',
            details: errors.array()
          }
        });
        return;
      }

      const endpoint = await ApiManagementService.createOrUpdateEndpoint(req.body);

      res.json({
        success: true,
        data: endpoint
      });
    } catch (error) {
      console.error('Error creating/updating API endpoint:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create/update endpoint'
        }
      });
    }
  }

  /**
   * Delete an API endpoint
   * DELETE /api/admin/api-management/endpoints/:id
   */
  async deleteEndpoint(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      await ApiManagementService.deleteEndpoint(id);

      res.json({
        success: true,
        message: 'API endpoint deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting API endpoint:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to delete endpoint'
        }
      });
    }
  }

  /**
   * Generate OpenAPI specification
   * GET /api/admin/api-management/openapi-spec
   */
  async generateOpenApiSpec(req: Request, res: Response): Promise<void> {
    try {
      const config = {
        title: 'PharmacyCopilot API',
        version: '1.0.0',
        description: 'Comprehensive API for PharmacyCopilot SaaS platform',
        baseUrl: process.env.API_BASE_URL || 'https://api.PharmacyCopilot.com',
        contact: {
          name: 'PharmacyCopilot API Support',
          email: 'api-support@PharmacyCopilot.com'
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT'
        }
      };

      const spec = await ApiManagementService.generateOpenApiSpec(config);

      res.json({
        success: true,
        data: spec
      });
    } catch (error) {
      console.error('Error generating OpenAPI spec:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to generate OpenAPI specification'
        }
      });
    }
  }

  /**
   * Get API keys
   * GET /api/admin/api-management/api-keys
   */
  async getApiKeys(req: Request, res: Response): Promise<void> {
    try {
      const {
        userId,
        environment,
        isActive,
        search,
        page = 1,
        limit = 20
      } = req.query;

      const filters = {
        userId: userId as string,
        environment: environment as string,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        search: search as string
      };

      const result = await ApiManagementService.getApiKeys(
        filters,
        parseInt(page as string),
        parseInt(limit as string)
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error fetching API keys:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch API keys'
        }
      });
    }
  }

  /**
   * Create a new API key
   * POST /api/admin/api-management/api-keys
   */
  async createApiKey(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid API key data',
            details: errors.array()
          }
        });
        return;
      }

      const result = await ApiManagementService.createApiKey(req.body);

      res.json({
        success: true,
        data: {
          apiKey: result.apiKey,
          key: result.key
        },
        message: 'API key created successfully. Please save the key securely as it will not be shown again.'
      });
    } catch (error) {
      console.error('Error creating API key:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create API key'
        }
      });
    }
  }

  /**
   * Revoke an API key
   * DELETE /api/admin/api-management/api-keys/:keyId
   */
  async revokeApiKey(req: Request, res: Response): Promise<void> {
    try {
      const { keyId } = req.params;

      await ApiManagementService.revokeApiKey(keyId);

      res.json({
        success: true,
        message: 'API key revoked successfully'
      });
    } catch (error) {
      console.error('Error revoking API key:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to revoke API key'
        }
      });
    }
  }

  /**
   * Get usage analytics
   * GET /api/admin/api-management/analytics
   */
  async getUsageAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const {
        endpoint,
        method,
        userId,
        apiKeyId,
        startDate,
        endDate,
        statusCode,
        groupBy = 'day'
      } = req.query;

      const filters = {
        endpoint: endpoint as string,
        method: method as string,
        userId: userId as string,
        apiKeyId: apiKeyId as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        statusCode: statusCode ? parseInt(statusCode as string) : undefined
      };

      const analytics = await ApiManagementService.getUsageAnalytics(
        filters,
        groupBy as 'hour' | 'day' | 'week' | 'month'
      );

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      console.error('Error fetching usage analytics:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch usage analytics'
        }
      });
    }
  }

  /**
   * Get API versions
   * GET /api/admin/api-management/versions
   */
  async getApiVersions(req: Request, res: Response): Promise<void> {
    try {
      const versions = await ApiManagementService.getApiVersions();

      res.json({
        success: true,
        data: versions
      });
    } catch (error) {
      console.error('Error fetching API versions:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch API versions'
        }
      });
    }
  }

  /**
   * Get API categories
   * GET /api/admin/api-management/categories
   */
  async getApiCategories(req: Request, res: Response): Promise<void> {
    try {
      const categories = await ApiManagementService.getApiCategories();

      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      console.error('Error fetching API categories:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch API categories'
        }
      });
    }
  }
}

export default new ApiManagementController();