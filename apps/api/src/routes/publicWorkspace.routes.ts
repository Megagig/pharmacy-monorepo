import { Router } from 'express';
import { PublicWorkspaceController, publicWorkspaceRateLimiters } from '../controllers/publicWorkspaceController';
import { body, validationResult } from 'express-validator';
import { query, param } from 'express-validator';
import { validateRequest } from '../middlewares/validateRequest';

const router = Router();

/**
 * Validation schemas
 */
const searchWorkspacesSchema = [
  query('search').optional().isString().trim().isLength({ max: 100 }),
  query('state').optional().isString().trim().isLength({ max: 50 }),
  query('lga').optional().isString().trim().isLength({ max: 100 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('page').optional().isInt({ min: 1 })
];

const workspaceIdSchema = [
  param('workspaceId').isMongoId().withMessage('Invalid workspace ID')
];

/**
 * @route GET /api/public/workspaces/search
 * @desc Search workspaces for patient portal access
 * @access Public
 */
router.get(
  '/search',
  publicWorkspaceRateLimiters.search,
  validateRequest(searchWorkspacesSchema),
  PublicWorkspaceController.searchWorkspaces
);

/**
 * @route GET /api/public/workspaces/states
 * @desc Get available states for filtering
 * @access Public
 */
router.get(
  '/states',
  publicWorkspaceRateLimiters.info,
  PublicWorkspaceController.getAvailableStates
);

/**
 * @route GET /api/public/workspaces/:workspaceId/info
 * @desc Get public workspace information
 * @access Public
 */
router.get(
  '/:workspaceId/info',
  publicWorkspaceRateLimiters.info,
  validateRequest(workspaceIdSchema),
  PublicWorkspaceController.getWorkspaceInfo
);

export default router;