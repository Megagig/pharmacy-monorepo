import express from 'express';
import pricingPlanController from '../controllers/pricingPlanController';
import { auth, authorize } from '../middlewares/auth';

const router = express.Router();

// All routes require super_admin role
router.use(auth, authorize('super_admin'));

/**
 * @route   GET /api/admin/pricing-plans
 * @desc    Get all pricing plans with their features
 * @access  Private (Super Admin only)
 */
router.get('/', pricingPlanController.getAllPricingPlans);

/**
 * @route   POST /api/admin/pricing-plans
 * @desc    Create a new pricing plan
 * @access  Private (Super Admin only)
 */
router.post('/', pricingPlanController.createPricingPlan);

/**
 * @route   POST /api/admin/pricing-plans/sync
 * @desc    Sync all pricing plans with current feature flags
 * @access  Private (Super Admin only)
 */
router.post('/sync', pricingPlanController.syncPricingPlans);

/**
 * @route   POST /api/admin/pricing-plans/validate-subscriptions
 * @desc    Validate and fix all subscription planId references
 * @access  Private (Super Admin only)
 */
router.post('/validate-subscriptions', pricingPlanController.validateSubscriptions);

/**
 * @route   GET /api/admin/pricing-plans/:id
 * @desc    Get a single pricing plan by ID
 * @access  Private (Super Admin only)
 */
router.get('/:id', pricingPlanController.getPricingPlanById);

/**
 * @route   PUT /api/admin/pricing-plans/:id
 * @desc    Update pricing plan details
 * @access  Private (Super Admin only)
 */
router.put('/:id', pricingPlanController.updatePricingPlan);

/**
 * @route   PUT /api/admin/pricing-plans/:id/features
 * @desc    Update pricing plan features
 * @access  Private (Super Admin only)
 */
router.put('/:id/features', pricingPlanController.updatePricingPlanFeatures);

export default router;
