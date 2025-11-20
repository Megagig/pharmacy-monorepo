import express from 'express';
import {
    getLocationPatients,
    getSharedPatients,
    getLocationAnalytics,
    assignPatientToLocation,
    bulkAssignPatientsToLocation,
    transferPatientsBetweenLocations,
    removeLocationAssignment,
    getLocationDistribution,
    getLocationVisits,
    getLocationClinicalNotes,
    assignVisitToLocation,
    assignClinicalNoteToLocation,
    sharePatientWithLocations,
    revokeSharedPatientAccess,
    getPatientsAccessibleFromLocation,
    createPatientTransferWorkflow,
    completePatientTransfer,
    getLocationAccessSummary,
    checkPatientAccess
} from '../controllers/locationDataController';
import { authWithWorkspace } from '../middlewares/authWithWorkspace';
import { requirePermission } from '../middlewares/rbac';

const router = express.Router();

// Apply workspace authentication to all routes
router.use(authWithWorkspace);

/**
 * @route GET /api/location-data/patients/:locationId
 * @desc Get patients for a specific location
 * @access Private (All workspace members with multi-location feature)
 */
router.get('/patients/:locationId',
    requirePermission('location.read'),
    getLocationPatients
);

/**
 * @route GET /api/location-data/patients/shared
 * @desc Get shared patients (not assigned to any location)
 * @access Private (All workspace members with multi-location feature)
 */
router.get('/patients/shared',
    requirePermission('location.read'),
    getSharedPatients
);

/**
 * @route GET /api/location-data/analytics/:locationId?
 * @desc Get location analytics (specific location or all locations)
 * @access Private (Workspace owners and pharmacists)
 */
router.get('/analytics/:locationId?',
    requirePermission('location.read'),
    getLocationAnalytics
);

/**
 * @route POST /api/location-data/assign
 * @desc Assign patient to location
 * @access Private (Workspace owners and pharmacists)
 */
router.post('/assign',
    requirePermission('location.manage'),
    assignPatientToLocation
);

/**
 * @route POST /api/location-data/bulk-assign
 * @desc Bulk assign patients to location
 * @access Private (Workspace owners and pharmacists)
 */
router.post('/bulk-assign',
    requirePermission('location.manage'),
    bulkAssignPatientsToLocation
);

/**
 * @route POST /api/location-data/transfer
 * @desc Transfer patients between locations
 * @access Private (Workspace owners and pharmacists)
 */
router.post('/transfer',
    requirePermission('location.manage'),
    transferPatientsBetweenLocations
);

/**
 * @route POST /api/location-data/remove-assignment
 * @desc Remove location assignment (make patients shared)
 * @access Private (Workspace owners and pharmacists)
 */
router.post('/remove-assignment',
    requirePermission('location.manage'),
    removeLocationAssignment
);

/**
 * @route GET /api/location-data/distribution
 * @desc Get location distribution summary
 * @access Private (Workspace owners and pharmacists)
 */
router.get('/distribution',
    requirePermission('location.read'),
    getLocationDistribution
);

/**
 * @route GET /api/location-data/visits/:locationId
 * @desc Get visits for a specific location
 * @access Private (All workspace members with multi-location feature)
 */
router.get('/visits/:locationId',
    requirePermission('location.read'),
    getLocationVisits
);

/**
 * @route GET /api/location-data/clinical-notes/:locationId
 * @desc Get clinical notes for a specific location
 * @access Private (All workspace members with multi-location feature)
 */
router.get('/clinical-notes/:locationId',
    requirePermission('location.read'),
    getLocationClinicalNotes
);

/**
 * @route POST /api/location-data/assign-visit
 * @desc Assign visit to location
 * @access Private (Workspace owners and pharmacists)
 */
router.post('/assign-visit',
    requirePermission('location.manage'),
    assignVisitToLocation
);

/**
 * @route POST /api/location-data/assign-clinical-note
 * @desc Assign clinical note to location
 * @access Private (Workspace owners and pharmacists)
 */
router.post('/assign-clinical-note',
    requirePermission('location.manage'),
    assignClinicalNoteToLocation
);

/**
 * @route POST /api/location-data/share-patient
 * @desc Share patient with other locations
 * @access Private (Workspace owners and pharmacists)
 */
router.post('/share-patient',
    requirePermission('location.manage'),
    sharePatientWithLocations
);

/**
 * @route POST /api/location-data/revoke-shared-access
 * @desc Revoke shared patient access
 * @access Private (Workspace owners and pharmacists)
 */
router.post('/revoke-shared-access',
    requirePermission('location.manage'),
    revokeSharedPatientAccess
);

/**
 * @route GET /api/location-data/accessible-patients/:locationId
 * @desc Get patients accessible from a specific location
 * @access Private (All workspace members with multi-location feature)
 */
router.get('/accessible-patients/:locationId',
    requirePermission('location.read'),
    getPatientsAccessibleFromLocation
);

/**
 * @route POST /api/location-data/create-transfer
 * @desc Create patient transfer workflow
 * @access Private (Workspace owners and pharmacists)
 */
router.post('/create-transfer',
    requirePermission('location.manage'),
    createPatientTransferWorkflow
);

/**
 * @route POST /api/location-data/complete-transfer
 * @desc Complete patient transfer
 * @access Private (Workspace owners and pharmacists)
 */
router.post('/complete-transfer',
    requirePermission('location.manage'),
    completePatientTransfer
);

/**
 * @route GET /api/location-data/access-summary
 * @desc Get location access summary
 * @access Private (Workspace owners and pharmacists)
 */
router.get('/access-summary',
    requirePermission('location.read'),
    getLocationAccessSummary
);

/**
 * @route GET /api/location-data/check-access/:patientId/:locationId
 * @desc Check patient access from location
 * @access Private (All workspace members with multi-location feature)
 */
router.get('/check-access/:patientId/:locationId',
    requirePermission('location.read'),
    checkPatientAccess
);

export default router;