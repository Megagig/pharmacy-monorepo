import { Request, Response } from 'express';
import PricingPlan from '../models/PricingPlan';
import PricingFeature from '../models/PricingFeature';

interface AuthRequest extends Request {
    user?: any;
}

export class PricingManagementController {
    // ==================== PRICING PLANS ====================

    // Get all pricing plans (Public - for pricing page)
    async getAllPlans(req: Request, res: Response): Promise<any> {
        try {
            const { billingPeriod } = req.query; // 'monthly' or 'yearly'

            // Build query filter
            const filter: any = { isActive: true };

            // If billing period specified, filter by it (but always include free trial and enterprise)
            if (billingPeriod && (billingPeriod === 'monthly' || billingPeriod === 'yearly')) {
                filter.$or = [
                    { billingPeriod: billingPeriod },
                    { tier: 'free_trial' },
                    { tier: 'enterprise' }
                ];
            }

            const plans = await PricingPlan.find(filter)
                .sort({ order: 1 })
                .lean();

            // Get all features
            const features = await PricingFeature.find({ isActive: true })
                .sort({ order: 1 })
                .lean();

            // Map features to plans
            const plansWithFeatures = plans.map((plan) => {
                const planFeatures = features.filter((feature) =>
                    plan.features.includes(feature.featureId)
                );
                return {
                    ...plan,
                    featuresDetails: planFeatures,
                };
            });

            return res.status(200).json({
                success: true,
                data: {
                    plans: plansWithFeatures,
                    features,
                },
            });
        } catch (error: any) {
            console.error('Error fetching pricing plans:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch pricing plans',
                error: error.message,
            });
        }
    }

    // Get single plan by slug (Public)
    async getPlanBySlug(req: Request, res: Response): Promise<any> {
        try {
            const { slug } = req.params;

            const plan = await PricingPlan.findOne({ slug, isActive: true }).lean();

            if (!plan) {
                return res.status(404).json({
                    success: false,
                    message: 'Plan not found',
                });
            }

            // Get features for this plan
            const features = await PricingFeature.find({
                featureId: { $in: plan.features },
                isActive: true,
            })
                .sort({ order: 1 })
                .lean();

            return res.status(200).json({
                success: true,
                data: {
                    plan: {
                        ...plan,
                        featuresDetails: features,
                    },
                },
            });
        } catch (error: any) {
            console.error('Error fetching plan:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch plan',
                error: error.message,
            });
        }
    }

    // ==================== ADMIN ENDPOINTS ====================

    // Get all plans (Admin - includes inactive)
    async getAdminPlans(req: AuthRequest, res: Response): Promise<any> {
        try {
            const plans = await PricingPlan.find().sort({ order: 1 }).lean();

            const features = await PricingFeature.find().sort({ order: 1 }).lean();

            const plansWithFeatures = plans.map((plan) => {
                const planFeatures = features.filter((feature) =>
                    plan.features.includes(feature.featureId)
                );
                return {
                    ...plan,
                    featuresDetails: planFeatures,
                };
            });

            return res.status(200).json({
                success: true,
                data: {
                    plans: plansWithFeatures,
                    features,
                },
            });
        } catch (error: any) {
            console.error('Error fetching admin plans:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch plans',
                error: error.message,
            });
        }
    }

    // Create pricing plan (Admin only)
    async createPlan(req: AuthRequest, res: Response): Promise<any> {
        try {
            const planData = req.body;

            // Generate slug from name if not provided
            if (!planData.slug) {
                planData.slug = planData.name
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/(^-|-$)/g, '');
            }

            const existingPlan = await PricingPlan.findOne({ slug: planData.slug });
            if (existingPlan) {
                return res.status(400).json({
                    success: false,
                    message: 'Plan with this slug already exists',
                });
            }

            const plan = await PricingPlan.create(planData);

            return res.status(201).json({
                success: true,
                message: 'Plan created successfully',
                data: { plan },
            });
        } catch (error: any) {
            console.error('Error creating plan:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to create plan',
                error: error.message,
            });
        }
    }

    // Update pricing plan (Admin only)
    async updatePlan(req: AuthRequest, res: Response): Promise<any> {
        try {
            const { id } = req.params;
            const updateData = req.body;

            // If name is changed, update slug
            if (updateData.name && !updateData.slug) {
                updateData.slug = updateData.name
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/(^-|-$)/g, '');
            }

            const plan = await PricingPlan.findByIdAndUpdate(
                id,
                { $set: updateData },
                { new: true, runValidators: true }
            );

            if (!plan) {
                return res.status(404).json({
                    success: false,
                    message: 'Plan not found',
                });
            }

            return res.status(200).json({
                success: true,
                message: 'Plan updated successfully',
                data: { plan },
            });
        } catch (error: any) {
            console.error('Error updating plan:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update plan',
                error: error.message,
            });
        }
    }

    // Delete pricing plan (Admin only)
    async deletePlan(req: AuthRequest, res: Response): Promise<any> {
        try {
            const { id } = req.params;

            const plan = await PricingPlan.findByIdAndDelete(id);

            if (!plan) {
                return res.status(404).json({
                    success: false,
                    message: 'Plan not found',
                });
            }

            return res.status(200).json({
                success: true,
                message: 'Plan deleted successfully',
            });
        } catch (error: any) {
            console.error('Error deleting plan:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to delete plan',
                error: error.message,
            });
        }
    }

    // Reorder plans (Admin only)
    async reorderPlans(req: AuthRequest, res: Response): Promise<any> {
        try {
            const { planOrders } = req.body; // Array of { id, order }

            const updatePromises = planOrders.map((item: any) =>
                PricingPlan.findByIdAndUpdate(item.id, { order: item.order })
            );

            await Promise.all(updatePromises);

            return res.status(200).json({
                success: true,
                message: 'Plans reordered successfully',
            });
        } catch (error: any) {
            console.error('Error reordering plans:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to reorder plans',
                error: error.message,
            });
        }
    }

    // ==================== FEATURES ====================

    // Get all features (Public)
    async getAllFeatures(req: Request, res: Response): Promise<any> {
        try {
            const features = await PricingFeature.find({ isActive: true })
                .sort({ order: 1 })
                .lean();

            return res.status(200).json({
                success: true,
                data: { features },
            });
        } catch (error: any) {
            console.error('Error fetching features:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch features',
                error: error.message,
            });
        }
    }

    // Get all features (Admin - includes inactive)
    async getAdminFeatures(req: AuthRequest, res: Response): Promise<any> {
        try {
            const features = await PricingFeature.find().sort({ order: 1 }).lean();

            return res.status(200).json({
                success: true,
                data: { features },
            });
        } catch (error: any) {
            console.error('Error fetching admin features:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch features',
                error: error.message,
            });
        }
    }

    // Create feature (Admin only)
    async createFeature(req: AuthRequest, res: Response): Promise<any> {
        try {
            const featureData = req.body;

            // Generate featureId from name if not provided
            if (!featureData.featureId) {
                featureData.featureId = featureData.name
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '_')
                    .replace(/(^_|_$)/g, '');
            }

            const existingFeature = await PricingFeature.findOne({
                featureId: featureData.featureId,
            });
            if (existingFeature) {
                return res.status(400).json({
                    success: false,
                    message: 'Feature with this ID already exists',
                });
            }

            const feature = await PricingFeature.create(featureData);

            return res.status(201).json({
                success: true,
                message: 'Feature created successfully',
                data: { feature },
            });
        } catch (error: any) {
            console.error('Error creating feature:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to create feature',
                error: error.message,
            });
        }
    }

    // Update feature (Admin only)
    async updateFeature(req: AuthRequest, res: Response): Promise<any> {
        try {
            const { id } = req.params;
            const updateData = req.body;

            const feature = await PricingFeature.findByIdAndUpdate(
                id,
                { $set: updateData },
                { new: true, runValidators: true }
            );

            if (!feature) {
                return res.status(404).json({
                    success: false,
                    message: 'Feature not found',
                });
            }

            return res.status(200).json({
                success: true,
                message: 'Feature updated successfully',
                data: { feature },
            });
        } catch (error: any) {
            console.error('Error updating feature:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update feature',
                error: error.message,
            });
        }
    }

    // Delete feature (Admin only)
    async deleteFeature(req: AuthRequest, res: Response): Promise<any> {
        try {
            const { id } = req.params;

            const feature = await PricingFeature.findByIdAndDelete(id);

            if (!feature) {
                return res.status(404).json({
                    success: false,
                    message: 'Feature not found',
                });
            }

            // Remove feature from all plans
            await PricingPlan.updateMany(
                { features: feature.featureId },
                { $pull: { features: feature.featureId } }
            );

            return res.status(200).json({
                success: true,
                message: 'Feature deleted successfully',
            });
        } catch (error: any) {
            console.error('Error deleting feature:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to delete feature',
                error: error.message,
            });
        }
    }

    // Reorder features (Admin only)
    async reorderFeatures(req: AuthRequest, res: Response): Promise<any> {
        try {
            const { featureOrders } = req.body; // Array of { id, order }

            const updatePromises = featureOrders.map((item: any) =>
                PricingFeature.findByIdAndUpdate(item.id, { order: item.order })
            );

            await Promise.all(updatePromises);

            return res.status(200).json({
                success: true,
                message: 'Features reordered successfully',
            });
        } catch (error: any) {
            console.error('Error reordering features:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to reorder features',
                error: error.message,
            });
        }
    }
}

export const pricingManagementController = new PricingManagementController();
