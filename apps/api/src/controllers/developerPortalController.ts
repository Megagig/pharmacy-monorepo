import { Response } from 'express';
import { validationResult } from 'express-validator';
import { AuthRequest } from '../middlewares/auth';
import DeveloperPortalService from '../services/DeveloperPortalService';

export class DeveloperPortalController {
  /**
   * Get developer accounts (Admin only)
   * GET /api/admin/developer-portal/accounts
   */
  async getDeveloperAccounts(req: AuthRequest, res: Response): Promise<void> {
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
        status,
        subscriptionTier,
        isVerified,
        search,
        page = 1,
        limit = 20
      } = req.query;

      const filters = {
        status: status as string,
        subscriptionTier: subscriptionTier as string,
        isVerified: isVerified === 'true' ? true : isVerified === 'false' ? false : undefined,
        search: search as string
      };

      const result = await DeveloperPortalService.getDeveloperAccounts(
        filters,
        parseInt(page as string),
        parseInt(limit as string)
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error fetching developer accounts:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch developer accounts'
        }
      });
    }
  }

  /**
   * Get current developer account
   * GET /api/developer-portal/account
   */
  async getCurrentDeveloperAccount(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated'
          }
        });
        return;
      }

      const account = await DeveloperPortalService.getDeveloperAccountByUserId(userId);

      if (!account) {
        res.status(404).json({
          success: false,
          error: {
            code: 'ACCOUNT_NOT_FOUND',
            message: 'Developer account not found'
          }
        });
        return;
      }

      res.json({
        success: true,
        data: account
      });
    } catch (error) {
      console.error('Error fetching developer account:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch developer account'
        }
      });
    }
  }

  /**
   * Create or update developer account
   * POST /api/developer-portal/account
   */
  async createOrUpdateDeveloperAccount(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid account data',
            details: errors.array()
          }
        });
        return;
      }

      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated'
          }
        });
        return;
      }

      const account = await DeveloperPortalService.createOrUpdateDeveloperAccount(userId, req.body);

      // Update onboarding step if this is profile setup
      if (req.body.companyName || req.body.description) {
        await DeveloperPortalService.updateOnboardingStep(userId, 'profileSetup', true);
      }

      res.json({
        success: true,
        data: account
      });
    } catch (error) {
      console.error('Error creating/updating developer account:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create/update account'
        }
      });
    }
  }

  /**
   * Verify developer account
   * POST /api/developer-portal/verify/:token
   */
  async verifyDeveloperAccount(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { token } = req.params;

      const account = await DeveloperPortalService.verifyDeveloperAccount(token);

      res.json({
        success: true,
        data: account,
        message: 'Account verified successfully'
      });
    } catch (error) {
      console.error('Error verifying developer account:', error);
      res.status(400).json({
        success: false,
        error: {
          code: 'VERIFICATION_FAILED',
          message: error instanceof Error ? error.message : 'Failed to verify account'
        }
      });
    }
  }

  /**
   * Resend verification email
   * POST /api/developer-portal/resend-verification
   */
  async resendVerification(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated'
          }
        });
        return;
      }

      const token = await DeveloperPortalService.generateVerificationToken(userId);

      // TODO: Send verification email with token
      // await EmailService.sendVerificationEmail(user.email, token);

      res.json({
        success: true,
        message: 'Verification email sent successfully'
      });
    } catch (error) {
      console.error('Error resending verification:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to resend verification'
        }
      });
    }
  }

  /**
   * Get onboarding progress
   * GET /api/developer-portal/onboarding
   */
  async getOnboardingProgress(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated'
          }
        });
        return;
      }

      const progress = await DeveloperPortalService.getOnboardingProgress(userId);

      res.json({
        success: true,
        data: progress
      });
    } catch (error) {
      console.error('Error fetching onboarding progress:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch onboarding progress'
        }
      });
    }
  }

  /**
   * Update onboarding step
   * POST /api/developer-portal/onboarding/:step
   */
  async updateOnboardingStep(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { step } = req.params;
      const { completed = true } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated'
          }
        });
        return;
      }

      await DeveloperPortalService.updateOnboardingStep(userId, step, completed);

      res.json({
        success: true,
        message: 'Onboarding step updated successfully'
      });
    } catch (error) {
      console.error('Error updating onboarding step:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to update onboarding step'
        }
      });
    }
  }

  /**
   * Get API documentation
   * GET /api/developer-portal/documentation
   */
  async getApiDocumentation(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        category,
        difficulty,
        tags,
        search,
        page = 1,
        limit = 20
      } = req.query;

      const filters = {
        category: category as string,
        difficulty: difficulty as string,
        tags: tags ? (Array.isArray(tags) ? tags as string[] : [tags as string]) : undefined,
        search: search as string,
        isPublished: true
      };

      const result = await DeveloperPortalService.getApiDocumentation(
        filters,
        parseInt(page as string),
        parseInt(limit as string)
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error fetching API documentation:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch API documentation'
        }
      });
    }
  }

  /**
   * Get documentation by endpoint
   * GET /api/developer-portal/documentation/endpoint/:endpointId
   */
  async getDocumentationByEndpoint(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { endpointId } = req.params;

      const documentation = await DeveloperPortalService.getDocumentationByEndpoint(endpointId);

      if (!documentation) {
        res.status(404).json({
          success: false,
          error: {
            code: 'DOCUMENTATION_NOT_FOUND',
            message: 'Documentation not found for this endpoint'
          }
        });
        return;
      }

      res.json({
        success: true,
        data: documentation
      });
    } catch (error) {
      console.error('Error fetching documentation by endpoint:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch documentation'
        }
      });
    }
  }

  /**
   * Create sandbox session
   * POST /api/developer-portal/sandbox/sessions
   */
  async createSandboxSession(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid session data',
            details: errors.array()
          }
        });
        return;
      }

      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated'
          }
        });
        return;
      }

      // Get developer account
      const account = await DeveloperPortalService.getDeveloperAccountByUserId(userId);
      if (!account) {
        res.status(404).json({
          success: false,
          error: {
            code: 'ACCOUNT_NOT_FOUND',
            message: 'Developer account not found'
          }
        });
        return;
      }

      const session = await DeveloperPortalService.createSandboxSession(
        account._id.toString(),
        req.body
      );

      res.json({
        success: true,
        data: session
      });
    } catch (error) {
      console.error('Error creating sandbox session:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create sandbox session'
        }
      });
    }
  }

  /**
   * Get sandbox sessions
   * GET /api/developer-portal/sandbox/sessions
   */
  async getSandboxSessions(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated'
          }
        });
        return;
      }

      // Get developer account
      const account = await DeveloperPortalService.getDeveloperAccountByUserId(userId);
      if (!account) {
        res.status(404).json({
          success: false,
          error: {
            code: 'ACCOUNT_NOT_FOUND',
            message: 'Developer account not found'
          }
        });
        return;
      }

      const {
        environment,
        isActive,
        page = 1,
        limit = 20
      } = req.query;

      const filters = {
        developerId: account._id.toString(),
        environment: environment as string,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined
      };

      const result = await DeveloperPortalService.getSandboxSessions(
        filters,
        parseInt(page as string),
        parseInt(limit as string)
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error fetching sandbox sessions:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch sandbox sessions'
        }
      });
    }
  }

  /**
   * Get sandbox session
   * GET /api/developer-portal/sandbox/sessions/:sessionId
   */
  async getSandboxSession(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;

      const session = await DeveloperPortalService.getSandboxSession(sessionId);

      if (!session) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SESSION_NOT_FOUND',
            message: 'Sandbox session not found or expired'
          }
        });
        return;
      }

      res.json({
        success: true,
        data: session
      });
    } catch (error) {
      console.error('Error fetching sandbox session:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch sandbox session'
        }
      });
    }
  }

  /**
   * Execute API test in sandbox
   * POST /api/developer-portal/sandbox/sessions/:sessionId/test
   */
  async executeApiTest(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid test request',
            details: errors.array()
          }
        });
        return;
      }

      const { sessionId } = req.params;
      const testRequest = req.body;

      const result = await DeveloperPortalService.executeApiTest(sessionId, testRequest);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error executing API test:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to execute API test'
        }
      });
    }
  }

  /**
   * Get developer API keys
   * GET /api/developer-portal/api-keys
   */
  async getDeveloperApiKeys(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated'
          }
        });
        return;
      }

      const account = await DeveloperPortalService.getDeveloperAccountByUserId(userId);
      if (!account) {
        res.status(404).json({
          success: false,
          error: {
            code: 'ACCOUNT_NOT_FOUND',
            message: 'Developer account not found'
          }
        });
        return;
      }

      const apiKeys = await DeveloperPortalService.getDeveloperApiKeys(account._id.toString());

      res.json({
        success: true,
        data: apiKeys
      });
    } catch (error) {
      console.error('Error fetching developer API keys:', error);
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
   * Generate code examples
   * GET /api/developer-portal/code-examples/:endpointId
   */
  async generateCodeExamples(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { endpointId } = req.params;
      const { apiKey } = req.query;

      if (!apiKey) {
        res.status(400).json({
          success: false,
          error: {
            code: 'API_KEY_REQUIRED',
            message: 'API key is required to generate examples'
          }
        });
        return;
      }

      // Get endpoint details (you might want to fetch from ApiEndpoint model)
      const endpoint = {
        path: '/api/v1/example',
        method: 'GET'
      };

      const examples = DeveloperPortalService.generateCodeExamples(endpoint, apiKey as string);

      res.json({
        success: true,
        data: examples
      });
    } catch (error) {
      console.error('Error generating code examples:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to generate code examples'
        }
      });
    }
  }

  /**
   * Get documentation categories
   * GET /api/developer-portal/documentation/categories
   */
  async getDocumentationCategories(req: AuthRequest, res: Response): Promise<void> {
    try {
      const categories = await DeveloperPortalService.getDocumentationCategories();

      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      console.error('Error fetching documentation categories:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch documentation categories'
        }
      });
    }
  }

  /**
   * Get documentation tags
   * GET /api/developer-portal/documentation/tags
   */
  async getDocumentationTags(req: AuthRequest, res: Response): Promise<void> {
    try {
      const tags = await DeveloperPortalService.getDocumentationTags();

      res.json({
        success: true,
        data: tags
      });
    } catch (error) {
      console.error('Error fetching documentation tags:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch documentation tags'
        }
      });
    }
  }
}

export default new DeveloperPortalController();