import { Request, Response } from 'express';
import PricingPlan from '../models/PricingPlan';
import PricingPlanSyncService from '../services/PricingPlanSyncService';
import mongoose from 'mongoose';
import { AuthRequest } from '../types/auth';

/**
 * @desc    Get all pricing plans with their features
 * @route   GET /api/admin/pricing-plans
 * @access  Private (Super Admin only)
 */
export const getAllPricingPlans = async (req: Request, res: Response) => {
    try {
        const plans = await PricingPlanSyncService.getAllPlansWithFeatures();

        return res.status(200).json({
            success: true,
            count: plans.length,
            data: plans,
        });
    } catch (error) {
        console.error('Error fetching pricing plans:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch pricing plans',
            error: error instanceof Error ? error.message : String(error),
        });
    }
};

/**
 * @desc    Get a single pricing plan by ID
 * @route   GET /api/admin/pricing-plans/:id
 * @access  Private (Super Admin only)
 */
export const getPricingPlanById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid pricing plan ID',
            });
        }

        const plan = await PricingPlan.findById(id);

        if (!plan) {
            return res.status(404).json({
                success: false,
                message: 'Pricing plan not found',
            });
        }

        return res.status(200).json({
            success: true,
            data: plan,
        });
    } catch (error) {
        console.error('Error fetching pricing plan:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch pricing plan',
            error: error instanceof Error ? error.message : String(error),
        });
    }
};

/**
 * @desc    Update pricing plan features
 * @route   PUT /api/admin/pricing-plans/:id/features
 * @access  Private (Super Admin only)
 */
export const updatePricingPlanFeatures = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { features } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid pricing plan ID',
            });
        }

        if (!Array.isArray(features)) {
            return res.status(400).json({
                success: false,
                message: 'Features must be an array',
            });
        }

        await PricingPlanSyncService.updatePlanFeatures(id, features);

        // Sync subscriptions after updating plan features
        try {
            const { syncAllSubscriptionFeatures } = await import('../utils/subscriptionFeatures');
            const syncResult = await syncAllSubscriptionFeatures();

            console.log(`✅ Synced subscription features: ${syncResult.updated} updated`);
        } catch (syncError) {
            console.error('Error syncing subscription features:', syncError);
        }

        const updatedPlan = await PricingPlan.findById(id);

        return res.status(200).json({
            success: true,
            message: 'Pricing plan features updated successfully',
            data: updatedPlan,
        });
    } catch (error) {
        console.error('Error updating pricing plan features:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update pricing plan features',
            error: error instanceof Error ? error.message : String(error),
        });
    }
};

/**
 * @desc    Sync all pricing plans with current feature flags
 * @route   POST /api/admin/pricing-plans/sync
 * @access  Private (Super Admin only)
 */
export const syncPricingPlans = async (req: Request, res: Response) => {
    try {
        console.log('🔄 Starting manual pricing plan sync...');

        const syncResult = await PricingPlanSyncService.syncAllPlansWithFeatureFlags();

        console.log(`✅ Manual pricing plan sync completed: ${syncResult.updated} updated, ${syncResult.failed} failed`);

        // Also sync subscriptions
        let subscriptionSyncResult = null;
        try {
            const { syncAllSubscriptionFeatures } = await import('../utils/subscriptionFeatures');
            subscriptionSyncResult = await syncAllSubscriptionFeatures();
            console.log(`✅ Synced subscription features: ${subscriptionSyncResult.updated} updated`);
        } catch (syncError) {
            console.error('Error syncing subscription features:', syncError);
        }

        return res.status(200).json({
            success: syncResult.success,
            message: syncResult.success
                ? 'Pricing plans synced successfully'
                : 'Pricing plan sync completed with errors',
            data: {
                plansUpdated: syncResult.updated,
                plansFailed: syncResult.failed,
                errors: syncResult.errors,
            },
            subscriptionSync: subscriptionSyncResult ? {
                subscriptionsUpdated: subscriptionSyncResult.updated,
                subscriptionsFailed: subscriptionSyncResult.failed,
                totalSubscriptions: subscriptionSyncResult.total,
            } : null,
        });
    } catch (error) {
        console.error('Error syncing pricing plans:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to sync pricing plans',
            error: error instanceof Error ? error.message : String(error),
        });
    }
};

/**
 * @desc    Validate and fix all subscription planId references
 * @route   POST /api/admin/pricing-plans/validate-subscriptions
 * @access  Private (Super Admin only)
 */
export const validateSubscriptions = async (req: Request, res: Response) => {
    try {
        console.log('🔍 Starting subscription validation...');

        const validationResult = await PricingPlanSyncService.validateAndFixSubscriptions();

        console.log(`✅ Subscription validation completed: ${validationResult.updated} fixed, ${validationResult.failed} failed`);

        return res.status(200).json({
            success: validationResult.success,
            message: validationResult.success
                ? 'All subscriptions validated successfully'
                : 'Subscription validation completed with errors',
            data: {
                subscriptionsFixed: validationResult.updated,
                subscriptionsFailed: validationResult.failed,
                errors: validationResult.errors,
            },
        });
    } catch (error) {
        console.error('Error validating subscriptions:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to validate subscriptions',
            error: error instanceof Error ? error.message : String(error),
        });
    }
};

/**
 * @desc    Update pricing plan details (name, price, etc.)
 * @route   PUT /api/admin/pricing-plans/:id
 * @access  Private (Super Admin only)
 */
export const updatePricingPlan = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid pricing plan ID',
            });
        }

        // Don't allow changing tier or slug through this endpoint
        delete updateData.tier;
        delete updateData.slug;

        const plan = await PricingPlan.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!plan) {
            return res.status(404).json({
                success: false,
                message: 'Pricing plan not found',
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Pricing plan updated successfully',
            data: plan,
        });
    } catch (error) {
        console.error('Error updating pricing plan:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update pricing plan',
            error: error instanceof Error ? error.message : String(error),
        });
    }
};

/**
 * @desc    Create a new pricing plan
 * @route   POST /api/admin/pricing-plans
 * @access  Private (Super Admin only)
 */
export const createPricingPlan = async (req: Request, res: Response) => {
    try {
        const planData = req.body;

        // Validate required fields
        if (!planData.name || !planData.slug || !planData.tier || planData.price === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: name, slug, tier, and price are required',
            });
        }

        // Check if slug already exists
        const existingPlan = await PricingPlan.findOne({ slug: planData.slug });
        if (existingPlan) {
            return res.status(400).json({
                success: false,
                message: 'A plan with this slug already exists',
            });
        }

        const plan = new PricingPlan(planData);
        await plan.save();

        return res.status(201).json({
            success: true,
            message: 'Pricing plan created successfully',
            data: plan,
        });
    } catch (error) {
        console.error('Error creating pricing plan:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create pricing plan',
            error: error instanceof Error ? error.message : String(error),
        });
    }
};

export default {
    getAllPricingPlans,
    getPricingPlanById,
    updatePricingPlanFeatures,
    syncPricingPlans,
    validateSubscriptions,
    updatePricingPlan,
    createPricingPlan,
};
