import { Request, Response } from 'express';
import { FeatureFlag } from '../models/FeatureFlag';
import { validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { AuthRequest, isExtendedUser } from '../types/auth';
import EnhancedFeatureFlagService from '../services/enhancedFeatureFlagService';
import PricingPlanSyncService from '../services/PricingPlanSyncService';

// Available subscription tiers
const AVAILABLE_TIERS = ['free_trial', 'basic', 'pro', 'pharmily', 'network', 'enterprise'] as const;

/**
 * @desc    Get all feature flags
 * @route   GET /api/feature-flags
 * @access  Private (All authenticated users)
 */
export const getAllFeatureFlags = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    let query: { isActive?: boolean } = { isActive: true };

    // Super admins can see all flags including inactive ones
    if (user && isExtendedUser(user) && user.role === 'super_admin') {
      query = {}; // Empty query to get all flags
    }

    const featureFlags = await FeatureFlag.find(query).sort({
      'metadata.category': 1,
      name: 1,
    });

    return res.status(200).json({
      success: true,
      count: featureFlags.length,
      data: featureFlags,
    });
  } catch (error) {
    console.error('Error fetching feature flags:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * @desc    Get feature flag by ID
 * @route   GET /api/feature-flags/:id
 * @access  Private (All authenticated users)
 */
export const getFeatureFlagById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user;

    // Check if ID exists
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Feature flag ID is required',
      });
    }

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id as string)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid feature flag ID',
      });
    }

    // Build query based on user role
    const query: { _id: mongoose.Types.ObjectId; isActive?: boolean } = {
      _id: new mongoose.Types.ObjectId(id),
    };

    // Regular users can only see active flags
    if (!user || !isExtendedUser(user) || user.role !== 'super_admin') {
      query.isActive = true;
    }

    const featureFlag = await FeatureFlag.findOne(query);

    if (!featureFlag) {
      return res.status(404).json({
        success: false,
        message: 'Feature flag not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: featureFlag,
    });
  } catch (error) {
    console.error('Error fetching feature flag:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * @desc    Create a new feature flag
 * @route   POST /api/admin/feature-flags
 * @access  Private (Super Admin only)
 */
export const createFeatureFlag = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array(),
    });
  }

  try {
    const {
      name,
      key,
      description,
      isActive = true,
      allowedTiers = [],
      allowedRoles = [],
      customRules = {},
      metadata = {
        category: 'core',
        priority: 'medium',
        tags: [],
      },
    } = req.body;

    // Check if feature flag key already exists
    const existingFlag = await FeatureFlag.findOne({ key: key.toLowerCase() });

    if (existingFlag) {
      return res.status(400).json({
        success: false,
        message: `Feature flag with key '${key}' already exists`,
      });
    }

    // Create new feature flag
    const featureFlag = new FeatureFlag({
      name,
      key: key.toLowerCase(),
      description,
      isActive,
      allowedTiers,
      allowedRoles,
      customRules,
      metadata,
    });

    await featureFlag.save();

    return res.status(201).json({
      success: true,
      message: 'Feature flag created successfully',
      data: featureFlag,
    });
  } catch (error) {
    console.error('Error creating feature flag:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * @desc    Update a feature flag
 * @route   PUT /api/admin/feature-flags/:id
 * @access  Private (Super Admin only)
 */
export const updateFeatureFlag = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array(),
    });
  }

  try {
    const { id } = req.params;

    // Check if ID exists
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Feature flag ID is required',
      });
    }

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id as string)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid feature flag ID',
      });
    }

    const {
      name,
      description,
      isActive,
      allowedTiers,
      allowedRoles,
      customRules,
      metadata,
    } = req.body;

    // Don't allow updating the key as it's used in code
    if (req.body.key) {
      delete req.body.key;
    }

    // Find feature flag
    const featureFlag = await FeatureFlag.findById(id);

    if (!featureFlag) {
      return res.status(404).json({
        success: false,
        message: 'Feature flag not found',
      });
    }

    // Update fields
    if (name) featureFlag.name = name;
    if (description !== undefined) featureFlag.description = description;
    if (isActive !== undefined) featureFlag.isActive = isActive;
    if (allowedTiers) featureFlag.allowedTiers = allowedTiers;
    if (allowedRoles) featureFlag.allowedRoles = allowedRoles;
    if (customRules) featureFlag.customRules = customRules;
    if (metadata) featureFlag.metadata = metadata;

    // Save updated feature flag
    await featureFlag.save();

    // CRITICAL: Sync all pricing plans with updated feature flags
    let pricingPlanSyncResult = null;
    try {
      pricingPlanSyncResult = await PricingPlanSyncService.syncAllPlansWithFeatureFlags();
      console.log(`✅ Synced pricing plans: ${pricingPlanSyncResult.updated} updated, ${pricingPlanSyncResult.failed} failed`);
    } catch (syncError) {
      console.error('Error syncing pricing plans:', syncError);
    }

    // Sync all active subscriptions with the updated feature flags
    // This ensures all subscriptions get the new features immediately
    try {
      const { syncAllSubscriptionFeatures } = await import('../utils/subscriptionFeatures');
      const syncResult = await syncAllSubscriptionFeatures();

      console.log(`✅ Synced subscription features: ${syncResult.updated} updated, ${syncResult.failed} failed`);

      return res.status(200).json({
        success: true,
        message: 'Feature flag updated successfully',
        data: featureFlag,
        pricingPlanSync: pricingPlanSyncResult ? {
          plansUpdated: pricingPlanSyncResult.updated,
          plansFailed: pricingPlanSyncResult.failed,
        } : null,
        subscriptionSync: {
          subscriptionsUpdated: syncResult.updated,
          subscriptionsFailed: syncResult.failed,
          totalSubscriptions: syncResult.total,
        },
      });
    } catch (syncError) {
      console.error('Error syncing subscription features:', syncError);

      // Still return success for the feature flag update
      return res.status(200).json({
        success: true,
        message: 'Feature flag updated successfully, but subscription sync failed',
        data: featureFlag,
        pricingPlanSync: pricingPlanSyncResult ? {
          plansUpdated: pricingPlanSyncResult.updated,
          plansFailed: pricingPlanSyncResult.failed,
        } : null,
        warning: 'Subscriptions were not automatically updated. Run sync manually.',
      });
    }
  } catch (error) {
    console.error('Error updating feature flag:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * @desc    Delete a feature flag
 * @route   DELETE /api/admin/feature-flags/:id
 * @access  Private (Super Admin only)
 */
export const deleteFeatureFlag = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if ID exists
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Feature flag ID is required',
      });
    }

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id as string)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid feature flag ID',
      });
    }

    // Find and delete feature flag
    const featureFlag = await FeatureFlag.findByIdAndDelete(id);

    if (!featureFlag) {
      return res.status(404).json({
        success: false,
        message: 'Feature flag not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Feature flag deleted successfully',
      data: {},
    });
  } catch (error) {
    console.error('Error deleting feature flag:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * @desc    Toggle feature flag active status
 * @route   PATCH /api/admin/feature-flags/:id/toggle
 * @access  Private (Super Admin only)
 */
export const toggleFeatureFlagStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if ID exists
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Feature flag ID is required',
      });
    }

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id as string)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid feature flag ID',
      });
    }

    // Find feature flag
    const featureFlag = await FeatureFlag.findById(id);

    if (!featureFlag) {
      return res.status(404).json({
        success: false,
        message: 'Feature flag not found',
      });
    }

    // Toggle active status
    featureFlag.isActive = !featureFlag.isActive;

    // Save updated feature flag
    await featureFlag.save();

    // CRITICAL: Sync all pricing plans with updated feature flags
    let pricingPlanSyncResult = null;
    try {
      pricingPlanSyncResult = await PricingPlanSyncService.syncAllPlansWithFeatureFlags();
      console.log(`✅ Synced pricing plans after toggle: ${pricingPlanSyncResult.updated} updated`);
    } catch (syncError) {
      console.error('Error syncing pricing plans:', syncError);
    }

    // Sync all active subscriptions with the updated feature flags
    try {
      const { syncAllSubscriptionFeatures } = await import('../utils/subscriptionFeatures');
      const syncResult = await syncAllSubscriptionFeatures();

      console.log(`✅ Synced subscription features after toggle: ${syncResult.updated} updated`);

      return res.status(200).json({
        success: true,
        message: `Feature flag ${featureFlag.isActive ? 'enabled' : 'disabled'} successfully`,
        data: featureFlag,
        pricingPlanSync: pricingPlanSyncResult ? {
          plansUpdated: pricingPlanSyncResult.updated,
          plansFailed: pricingPlanSyncResult.failed,
        } : null,
        subscriptionSync: {
          subscriptionsUpdated: syncResult.updated,
          subscriptionsFailed: syncResult.failed,
          totalSubscriptions: syncResult.total,
        },
      });
    } catch (syncError) {
      console.error('Error syncing subscription features:', syncError);

      return res.status(200).json({
        success: true,
        message: `Feature flag ${featureFlag.isActive ? 'enabled' : 'disabled'} successfully`,
        data: featureFlag,
        pricingPlanSync: pricingPlanSyncResult ? {
          plansUpdated: pricingPlanSyncResult.updated,
          plansFailed: pricingPlanSyncResult.failed,
        } : null,
        warning: 'Subscriptions were not automatically updated.',
      });
    }
  } catch (error) {
    console.error('Error toggling feature flag status:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * @desc    Get feature flags by category
 * @route   GET /api/admin/feature-flags/category/:category
 * @access  Private (Super Admin only)
 */
export const getFeatureFlagsByCategory = async (
  req: Request,
  res: Response
) => {
  try {
    const { category } = req.params;

    const featureFlags = await FeatureFlag.find({
      'metadata.category': category,
    }).sort({ name: 1 });

    return res.status(200).json({
      success: true,
      count: featureFlags.length,
      data: featureFlags,
    });
  } catch (error) {
    console.error('Error fetching feature flags by category:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * @desc    Get feature flags by subscription tier
 * @route   GET /api/admin/feature-flags/tier/:tier
 * @access  Private (Super Admin only)
 */
export const getFeatureFlagsByTier = async (req: Request, res: Response) => {
  try {
    const { tier } = req.params;

    const featureFlags = await FeatureFlag.find({
      allowedTiers: tier,
    }).sort({ 'metadata.category': 1, name: 1 });

    return res.status(200).json({
      success: true,
      count: featureFlags.length,
      data: featureFlags,
    });
  } catch (error) {
    console.error('Error fetching feature flags by tier:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * @desc    Bulk add or remove features for a tier
 * @route   POST /api/feature-flags/tier/:tier/features
 * @access  Private (Super Admin only)
 */
export const updateTierFeatures = async (req: Request, res: Response) => {
  try {
    const { tier } = req.params;
    const { featureKeys, action } = req.body;

    // Validate tier parameter
    if (!tier || !AVAILABLE_TIERS.includes(tier as any)) {
      return res.status(400).json({
        success: false,
        message: `Invalid tier. Must be one of: ${AVAILABLE_TIERS.join(', ')}`,
      });
    }

    // Validate action parameter
    if (!action || !['add', 'remove'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be either "add" or "remove"',
      });
    }

    // Validate featureKeys array
    if (!featureKeys || !Array.isArray(featureKeys) || featureKeys.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'featureKeys must be a non-empty array',
      });
    }

    // Perform bulk operation based on action
    let result;
    if (action === 'add') {
      // Use $addToSet to add tier to allowedTiers array (prevents duplicates)
      result = await FeatureFlag.updateMany(
        { key: { $in: featureKeys } },
        { $addToSet: { allowedTiers: tier } }
      );
    } else {
      // Use $pull to remove tier from allowedTiers array
      result = await FeatureFlag.updateMany(
        { key: { $in: featureKeys } },
        { $pull: { allowedTiers: tier } }
      );
    }

    // CRITICAL: Sync PricingPlan documents with the updated feature flags
    let pricingPlanSyncResult = null;
    try {
      pricingPlanSyncResult = await PricingPlanSyncService.syncTierFeatures(tier);
      console.log(`✅ Synced pricing plans for tier ${tier}: ${pricingPlanSyncResult.updated} updated`);
    } catch (syncError) {
      console.error('Error syncing pricing plans:', syncError);
    }

    // Sync all active subscriptions with the updated feature flags
    let subscriptionSyncResult = null;
    try {
      const { syncAllSubscriptionFeatures } = await import('../utils/subscriptionFeatures');
      subscriptionSyncResult = await syncAllSubscriptionFeatures();
      console.log(`✅ Synced subscription features after bulk tier update: ${subscriptionSyncResult.updated} updated`);
    } catch (syncError) {
      console.error('Error syncing subscription features:', syncError);
    }

    return res.status(200).json({
      success: true,
      message: `Successfully ${action === 'add' ? 'added' : 'removed'} tier "${tier}" ${action === 'add' ? 'to' : 'from'} ${result.modifiedCount} feature(s)`,
      data: {
        tier,
        action,
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
      },
      pricingPlanSync: pricingPlanSyncResult ? {
        plansUpdated: pricingPlanSyncResult.updated,
        plansFailed: pricingPlanSyncResult.failed,
      } : null,
      subscriptionSync: subscriptionSyncResult ? {
        subscriptionsUpdated: subscriptionSyncResult.updated,
        subscriptionsFailed: subscriptionSyncResult.failed,
        totalSubscriptions: subscriptionSyncResult.total,
      } : null,
    });
  } catch (error) {
    console.error('Error updating tier features:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * @desc    Update targeting rules for a feature flag
 * @route   PUT /api/feature-flags/:id/targeting
 * @access  Private (Super Admin only)
 */
export const updateTargetingRules = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { targetingRules } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid feature flag ID',
      });
    }

    // Validate targeting rules
    const validation = EnhancedFeatureFlagService.validateTargetingRules(targetingRules);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.error,
      });
    }

    const featureFlag = await FeatureFlag.findByIdAndUpdate(
      id,
      {
        $set: {
          targetingRules,
          updatedBy: req.user?._id,
          updatedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!featureFlag) {
      return res.status(404).json({
        success: false,
        message: 'Feature flag not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Targeting rules updated successfully',
      data: featureFlag,
    });
  } catch (error) {
    console.error('Error updating targeting rules:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * @desc    Manually sync all subscription features with current feature flags
 * @route   POST /api/admin/feature-flags/sync-subscriptions
 * @access  Private (Super Admin only)
 */
export const syncSubscriptionFeatures = async (req: Request, res: Response) => {
  try {
    console.log('🔄 Starting manual subscription features sync...');

    const { syncAllSubscriptionFeatures } = await import('../utils/subscriptionFeatures');
    const syncResult = await syncAllSubscriptionFeatures();

    console.log(`✅ Manual sync completed: ${syncResult.updated} updated, ${syncResult.failed} failed`);

    return res.status(200).json({
      success: true,
      message: 'Subscription features synced successfully',
      data: {
        subscriptionsUpdated: syncResult.updated,
        subscriptionsFailed: syncResult.failed,
        totalSubscriptions: syncResult.total,
      },
    });
  } catch (error) {
    console.error('Error syncing subscription features:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to sync subscription features',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * @desc    Get usage metrics for a feature flag
 * @route   GET /api/feature-flags/:id/metrics
 * @access  Private (Super Admin only)
 */
export const getFeatureFlagMetrics = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid feature flag ID',
      });
    }

    const featureFlag = await FeatureFlag.findById(id);
    if (!featureFlag) {
      return res.status(404).json({
        success: false,
        message: 'Feature flag not found',
      });
    }

    const metrics = await EnhancedFeatureFlagService.calculateUsageMetrics(featureFlag.key);

    return res.status(200).json({
      success: true,
      data: {
        featureFlag: {
          id: featureFlag._id,
          key: featureFlag.key,
          name: featureFlag.name,
        },
        metrics,
      },
    });
  } catch (error) {
    console.error('Error fetching feature flag metrics:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * @desc    Get marketing features for pricing display
 * @route   GET /api/feature-flags/marketing
 * @access  Public
 */
export const getMarketingFeatures = async (req: Request, res: Response) => {
  try {
    const { tier } = req.query;

    const features = await EnhancedFeatureFlagService.getMarketingFeatures(tier as string);

    return res.status(200).json({
      success: true,
      count: features.length,
      data: features,
    });
  } catch (error) {
    console.error('Error fetching marketing features:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * @desc    Check advanced feature access for a user
 * @route   POST /api/feature-flags/check-access
 * @access  Private (All authenticated users)
 */
export const checkAdvancedFeatureAccess = async (req: AuthRequest, res: Response) => {
  try {
    const { featureKey, workspaceId } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    if (!featureKey) {
      return res.status(400).json({
        success: false,
        message: 'Feature key is required',
      });
    }

    const accessResult = await EnhancedFeatureFlagService.hasAdvancedFeatureAccess(
      userId.toString(),
      featureKey,
      workspaceId
    );

    return res.status(200).json({
      success: true,
      data: accessResult,
    });
  } catch (error) {
    console.error('Error checking advanced feature access:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};



export default {
  getAllFeatureFlags,
  getFeatureFlagById,
  createFeatureFlag,
  updateFeatureFlag,
  deleteFeatureFlag,
  toggleFeatureFlagStatus,
  getFeatureFlagsByCategory,
  getFeatureFlagsByTier,
  updateTierFeatures,
  syncSubscriptionFeatures,
  // Enhanced functionality
  updateTargetingRules,
  getFeatureFlagMetrics,
  getMarketingFeatures,
  checkAdvancedFeatureAccess,
};
