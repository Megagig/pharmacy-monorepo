import express, { Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { auth } from '../middlewares/auth';
import { templateService } from '../services/chat/TemplateService';
import logger from '../utils/logger';

const router = express.Router();

/**
 * @route   POST /api/chat/templates
 * @desc    Create a new message template
 * @access  Private
 */
router.post(
  '/',
  auth,
  [
    body('title').trim().isLength({ min: 1, max: 100 }).withMessage('Title must be 1-100 characters'),
    body('content').trim().isLength({ min: 1, max: 2000 }).withMessage('Content must be 1-2000 characters'),
    body('category')
      .isIn(['medication_instructions', 'follow_up', 'side_effects', 'general'])
      .withMessage('Invalid category'),
    body('variables').optional().isArray().withMessage('Variables must be an array'),
    body('isGlobal').optional().isBoolean().withMessage('isGlobal must be a boolean'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { title, content, category, variables, isGlobal } = req.body;
      const workplaceId = (req as any).user.workplaceId;
      const userId = (req as any).user.userId;

      const template = await templateService.createTemplate({
        title,
        content,
        category,
        variables,
        workplaceId,
        createdBy: userId,
        isGlobal: isGlobal || false,
      });

      res.status(201).json({
        success: true,
        data: template,
        message: 'Template created successfully',
      });
    } catch (error) {
      logger.error('Error creating template', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to create template',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   GET /api/chat/templates
 * @desc    Get all templates for workplace
 * @access  Private
 */
router.get(
  '/',
  auth,
  [
    query('category')
      .optional()
      .isIn(['medication_instructions', 'follow_up', 'side_effects', 'general'])
      .withMessage('Invalid category'),
    query('search').optional().isString().withMessage('Search must be a string'),
    query('includeGlobal').optional().isBoolean().withMessage('includeGlobal must be a boolean'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const workplaceId = (req as any).user.workplaceId;
      const { category, search, includeGlobal } = req.query;

      const templates = await templateService.getTemplates(workplaceId, {
        category: category as string,
        search: search as string,
        includeGlobal: includeGlobal === 'true',
      });

      res.json({
        success: true,
        data: templates,
        count: templates.length,
      });
    } catch (error) {
      logger.error('Error getting templates', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get templates',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   GET /api/chat/templates/popular
 * @desc    Get popular templates
 * @access  Private
 */
router.get(
  '/popular',
  auth,
  [query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be 1-50')],
  async (req: Request, res: Response) => {
    try {
      const workplaceId = (req as any).user.workplaceId;
      const limit = parseInt(req.query.limit as string) || 10;

      const templates = await templateService.getPopularTemplates(workplaceId, limit);

      res.json({
        success: true,
        data: templates,
        count: templates.length,
      });
    } catch (error) {
      logger.error('Error getting popular templates', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get popular templates',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   GET /api/chat/templates/stats
 * @desc    Get template statistics
 * @access  Private
 */
router.get('/stats', auth, async (req: Request, res: Response) => {
  try {
    const workplaceId = (req as any).user.workplaceId;

    const stats = await templateService.getTemplateStats(workplaceId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error getting template stats', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to get template stats',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   GET /api/chat/templates/:id
 * @desc    Get template by ID
 * @access  Private
 */
router.get(
  '/:id',
  auth,
  [param('id').isMongoId().withMessage('Valid template ID is required')],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const workplaceId = (req as any).user.workplaceId;
      const { id } = req.params;

      const template = await templateService.getTemplateById(id, workplaceId);

      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template not found',
        });
      }

      res.json({
        success: true,
        data: template,
      });
    } catch (error) {
      logger.error('Error getting template', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get template',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   PUT /api/chat/templates/:id
 * @desc    Update template
 * @access  Private
 */
router.put(
  '/:id',
  auth,
  [
    param('id').isMongoId().withMessage('Valid template ID is required'),
    body('title').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Title must be 1-100 characters'),
    body('content').optional().trim().isLength({ min: 1, max: 2000 }).withMessage('Content must be 1-2000 characters'),
    body('category')
      .optional()
      .isIn(['medication_instructions', 'follow_up', 'side_effects', 'general'])
      .withMessage('Invalid category'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const workplaceId = (req as any).user.workplaceId;
      const { id } = req.params;
      const updates = req.body;

      const template = await templateService.updateTemplate(id, workplaceId, updates);

      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template not found or unauthorized',
        });
      }

      res.json({
        success: true,
        data: template,
        message: 'Template updated successfully',
      });
    } catch (error) {
      logger.error('Error updating template', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to update template',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   DELETE /api/chat/templates/:id
 * @desc    Delete template
 * @access  Private
 */
router.delete(
  '/:id',
  auth,
  [param('id').isMongoId().withMessage('Valid template ID is required')],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const workplaceId = (req as any).user.workplaceId;
      const { id } = req.params;

      const deleted = await templateService.deleteTemplate(id, workplaceId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Template not found or unauthorized',
        });
      }

      res.json({
        success: true,
        message: 'Template deleted successfully',
      });
    } catch (error) {
      logger.error('Error deleting template', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to delete template',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   POST /api/chat/templates/:id/use
 * @desc    Use template (increment usage and render with variables)
 * @access  Private
 */
router.post(
  '/:id/use',
  auth,
  [
    param('id').isMongoId().withMessage('Valid template ID is required'),
    body('variables').optional().isObject().withMessage('Variables must be an object'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const workplaceId = (req as any).user.workplaceId;
      const { id } = req.params;
      const { variables } = req.body;

      const result = await templateService.useTemplate(id, workplaceId, variables);

      res.json({
        success: true,
        data: {
          template: result.template,
          renderedContent: result.renderedContent,
        },
      });
    } catch (error) {
      logger.error('Error using template', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to use template',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

export default router;
