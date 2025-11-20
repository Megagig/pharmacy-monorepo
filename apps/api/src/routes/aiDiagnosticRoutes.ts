import express from 'express';
import { auth } from '../middlewares/auth';
import { authWithWorkspace } from '../middlewares/authWithWorkspace';
import { requirePermission } from '../middlewares/rbac';
import { checkAIDiagnosticLimits } from '../middlewares/aiUsageLimits';
import {
  generateDiagnosticAnalysis,
  saveDiagnosticDecision,
  getDiagnosticHistory,
  getDiagnosticCase,
  checkDrugInteractions,
  testAIConnection,
  getAIUsageStats
} from '../controllers/diagnosticController';

const router = express.Router();

// All routes require authentication and workspace context
router.use(auth);
router.use(authWithWorkspace);

/**
 * @route   POST /api/ai-diagnostics/analyze
 * @desc    Generate AI diagnostic analysis
 * @access  Pharmacist, Owner, Super Admin
 */
router.post(
  '/analyze',
  requirePermission('diagnostics:create'),
  checkAIDiagnosticLimits,
  generateDiagnosticAnalysis
);

/**
 * @route   POST /api/ai-diagnostics/cases/:caseId/decision
 * @desc    Save pharmacist decision on diagnostic case
 * @access  Pharmacist, Owner, Super Admin
 */
router.post(
  '/cases/:caseId/decision',
  requirePermission('diagnostics:update'),
  saveDiagnosticDecision
);

/**
 * @route   GET /api/ai-diagnostics/patients/:patientId/history
 * @desc    Get diagnostic case history for a patient
 * @access  Pharmacist, Owner, Super Admin
 */
router.get(
  '/patients/:patientId/history',
  requirePermission('diagnostics:read'),
  getDiagnosticHistory
);

/**
 * @route   GET /api/ai-diagnostics/cases/:caseId
 * @desc    Get a specific diagnostic case
 * @access  Pharmacist, Owner, Super Admin
 */
router.get(
  '/cases/:caseId',
  requirePermission('diagnostics:read'),
  getDiagnosticCase
);/**

 * @route   POST /api/ai-diagnostics/drug-interactions
 * @desc    Check drug interactions
 * @access  Pharmacist, Owner, Super Admin
 */
router.post(
  '/drug-interactions',
  requirePermission('diagnostics:read'),
  checkDrugInteractions
);

/**
 * @route   GET /api/ai-diagnostics/test-connection
 * @desc    Test OpenRouter AI connection (Super Admin only)
 * @access  Super Admin
 */
router.get(
  '/test-connection',
  testAIConnection
);

/**
 * @route   GET /api/ai-diagnostics/usage-stats
 * @desc    Get AI usage statistics and budget tracking (Super Admin only)
 * @access  Super Admin
 */
router.get(
  '/usage-stats',
  getAIUsageStats
);

export default router;