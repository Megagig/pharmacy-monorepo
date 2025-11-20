import express from 'express';
import {
    getWorkspaceLocations,
    getLocationById,
    createLocation,
    updateLocation,
    deleteLocation,
    setPrimaryLocation,
    getLocationStats,
    bulkUpdateLocations
} from '../controllers/locationController';
import { authWithWorkspace } from '../middlewares/authWithWorkspace';
import { requirePermission } from '../middlewares/rbac';
import { enforcePlanLimit } from '../middlewares/usageLimits';

const router = express.Router();

// Apply workspace authentication to all routes
router.use(authWithWorkspace);

/**
 * @route GET /api/locations
 * @desc Get all locations for the current workspace
 * @access Private (All workspace members with multi-location feature)
 */
router.get('/',
    requirePermission('location.read'),
    getWorkspaceLocations
);

/**
 * @route GET /api/locations/:locationId
 * @desc Get a specific location by ID
 * @access Private (All workspace members with multi-location feature)
 */
router.get('/:locationId',
    requirePermission('location.read'),
    getLocationById
);

/**
 * @route POST /api/locations
 * @desc Create a new location
 * @access Private (Workspace owners only)
 */
router.post('/',
    requirePermission('location.create'),
    enforcePlanLimit('locations'),
    createLocation
);

/**
 * @route PUT /api/locations/:locationId
 * @desc Update an existing location
 * @access Private (Workspace owners only)
 */
router.put('/:locationId',
    requirePermission('location.update'),
    updateLocation
);

/**
 * @route DELETE /api/locations/:locationId
 * @desc Delete a location
 * @access Private (Workspace owners only)
 */
router.delete('/:locationId',
    requirePermission('location.delete'),
    deleteLocation
);

/**
 * @route POST /api/locations/:locationId/set-primary
 * @desc Set a location as primary
 * @access Private (Workspace owners only)
 */
router.post('/:locationId/set-primary',
    requirePermission('location.manage'),
    setPrimaryLocation
);

/**
 * @route GET /api/locations/:locationId/stats
 * @desc Get location statistics
 * @access Private (Workspace owners and pharmacists)
 */
router.get('/:locationId/stats',
    requirePermission('location.read'),
    getLocationStats
);

/**
 * @route PUT /api/locations/bulk
 * @desc Bulk update locations
 * @access Private (Workspace owners only)
 */
router.put('/bulk',
    requirePermission('location.manage'),
    bulkUpdateLocations
);

export default router;