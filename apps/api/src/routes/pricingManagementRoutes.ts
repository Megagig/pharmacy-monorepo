import express from 'express';
import { pricingManagementController } from '../controllers/pricingManagementController';
import { auth, requireSuperAdmin } from '../middlewares/auth';

const router = express.Router();

// ==================== PUBLIC ROUTES ====================
// Get all active pricing plans (for pricing page)
router.get('/plans', pricingManagementController.getAllPlans.bind(pricingManagementController));

// Get single plan by slug
router.get('/plans/:slug', pricingManagementController.getPlanBySlug.bind(pricingManagementController));

// Get all active features
router.get('/features', pricingManagementController.getAllFeatures.bind(pricingManagementController));

// ==================== ADMIN ROUTES (Super Admin Only) ====================
// Plans Management
router.get(
    '/admin/plans',
    auth,
    requireSuperAdmin,
    pricingManagementController.getAdminPlans.bind(pricingManagementController)
);

router.post(
    '/admin/plans',
    auth,
    requireSuperAdmin,
    pricingManagementController.createPlan.bind(pricingManagementController)
);

router.put(
    '/admin/plans/:id',
    auth,
    requireSuperAdmin,
    pricingManagementController.updatePlan.bind(pricingManagementController)
);

router.delete(
    '/admin/plans/:id',
    auth,
    requireSuperAdmin,
    pricingManagementController.deletePlan.bind(pricingManagementController)
);

router.post(
    '/admin/plans/reorder',
    auth,
    requireSuperAdmin,
    pricingManagementController.reorderPlans.bind(pricingManagementController)
);

// Features Management
router.get(
    '/admin/features',
    auth,
    requireSuperAdmin,
    pricingManagementController.getAdminFeatures.bind(pricingManagementController)
);

router.post(
    '/admin/features',
    auth,
    requireSuperAdmin,
    pricingManagementController.createFeature.bind(pricingManagementController)
);

router.put(
    '/admin/features/:id',
    auth,
    requireSuperAdmin,
    pricingManagementController.updateFeature.bind(pricingManagementController)
);

router.delete(
    '/admin/features/:id',
    auth,
    requireSuperAdmin,
    pricingManagementController.deleteFeature.bind(pricingManagementController)
);

router.post(
    '/admin/features/reorder',
    auth,
    requireSuperAdmin,
    pricingManagementController.reorderFeatures.bind(pricingManagementController)
);

export default router;
