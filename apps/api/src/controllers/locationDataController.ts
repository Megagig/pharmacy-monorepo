import { Request, Response } from 'express';
import { AuthRequest } from '../types/auth';
import LocationFilterService from '../services/LocationFilterService';
import SharedPatientService from '../services/SharedPatientService';
import mongoose from 'mongoose';
import logger from '../utils/logger';

/**
 * Get patients for a specific location
 */
export const getLocationPatients = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        if (!req.workspaceContext?.workspace) {
            res.status(400).json({
                success: false,
                message: 'Workspace context not found'
            });
            return;
        }

        const { locationId } = req.params;
        const { includeShared = false } = req.query;
        const workspace = req.workspaceContext.workspace;

        // Validate location exists
        const location = workspace.locations?.find(loc => loc.id === locationId);
        if (!location) {
            res.status(404).json({
                success: false,
                message: 'Location not found'
            });
            return;
        }

        const patients = await LocationFilterService.getPatientsForLocation({
            workspaceId: workspace._id,
            locationId,
            includeShared: includeShared === 'true'
        });

        res.json({
            success: true,
            data: {
                location: {
                    id: location.id,
                    name: location.name
                },
                patients,
                totalCount: patients.length,
                includeShared: includeShared === 'true'
            }
        });

    } catch (error) {
        logger.error('Error getting location patients:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve location patients'
        });
    }
};

/**
 * Get shared patients (not assigned to any location)
 */
export const getSharedPatients = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        if (!req.workspaceContext?.workspace) {
            res.status(400).json({
                success: false,
                message: 'Workspace context not found'
            });
            return;
        }

        const workspace = req.workspaceContext.workspace;

        const patients = await LocationFilterService.getSharedPatients(workspace._id);

        res.json({
            success: true,
            data: {
                patients,
                totalCount: patients.length
            }
        });

    } catch (error) {
        logger.error('Error getting shared patients:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve shared patients'
        });
    }
};

/**
 * Get location analytics
 */
export const getLocationAnalytics = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        if (!req.workspaceContext?.workspace) {
            res.status(400).json({
                success: false,
                message: 'Workspace context not found'
            });
            return;
        }

        const { locationId } = req.params;
        const workspace = req.workspaceContext.workspace;

        if (locationId) {
            // Get analytics for specific location
            const location = workspace.locations?.find(loc => loc.id === locationId);
            if (!location) {
                res.status(404).json({
                    success: false,
                    message: 'Location not found'
                });
                return;
            }

            const analytics = await LocationFilterService.getLocationAnalytics(
                workspace._id,
                location.id,
                location.name
            );

            res.json({
                success: true,
                data: analytics
            });
        } else {
            // Get analytics for all locations
            const analytics = await LocationFilterService.getWorkspaceLocationAnalytics(workspace);

            res.json({
                success: true,
                data: {
                    locations: analytics,
                    totalLocations: analytics.length
                }
            });
        }

    } catch (error) {
        logger.error('Error getting location analytics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve location analytics'
        });
    }
};

/**
 * Assign patient to location
 */
export const assignPatientToLocation = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        if (!req.workspaceContext?.workspace) {
            res.status(400).json({
                success: false,
                message: 'Workspace context not found'
            });
            return;
        }

        const { patientId, locationId } = req.body;
        const workspace = req.workspaceContext.workspace;

        if (!patientId || !locationId) {
            res.status(400).json({
                success: false,
                message: 'Patient ID and Location ID are required'
            });
            return;
        }

        // Validate location exists
        const location = workspace.locations?.find(loc => loc.id === locationId);
        if (!location) {
            res.status(404).json({
                success: false,
                message: 'Location not found'
            });
            return;
        }

        await LocationFilterService.assignPatientToLocation(
            new mongoose.Types.ObjectId(patientId),
            locationId,
            workspace._id
        );

        res.json({
            success: true,
            message: 'Patient assigned to location successfully',
            data: {
                patientId,
                locationId,
                locationName: location.name
            }
        });

    } catch (error) {
        logger.error('Error assigning patient to location:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to assign patient to location'
        });
    }
};

/**
 * Bulk assign patients to location
 */
export const bulkAssignPatientsToLocation = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        if (!req.workspaceContext?.workspace) {
            res.status(400).json({
                success: false,
                message: 'Workspace context not found'
            });
            return;
        }

        const { patientIds, locationId } = req.body;
        const workspace = req.workspaceContext.workspace;

        if (!Array.isArray(patientIds) || patientIds.length === 0) {
            res.status(400).json({
                success: false,
                message: 'Patient IDs array is required'
            });
            return;
        }

        if (!locationId) {
            res.status(400).json({
                success: false,
                message: 'Location ID is required'
            });
            return;
        }

        // Validate location exists
        const location = workspace.locations?.find(loc => loc.id === locationId);
        if (!location) {
            res.status(404).json({
                success: false,
                message: 'Location not found'
            });
            return;
        }

        const objectIds = patientIds.map(id => new mongoose.Types.ObjectId(id));
        const result = await LocationFilterService.bulkAssignPatientsToLocation(
            objectIds,
            locationId,
            workspace._id
        );

        res.json({
            success: true,
            message: 'Bulk assignment completed',
            data: {
                locationId,
                locationName: location.name,
                totalRequested: patientIds.length,
                successful: result.success,
                failed: result.failed
            }
        });

    } catch (error) {
        logger.error('Error bulk assigning patients to location:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to bulk assign patients to location'
        });
    }
};

/**
 * Transfer patients between locations
 */
export const transferPatientsBetweenLocations = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        if (!req.workspaceContext?.workspace) {
            res.status(400).json({
                success: false,
                message: 'Workspace context not found'
            });
            return;
        }

        const { patientIds, fromLocationId, toLocationId } = req.body;
        const workspace = req.workspaceContext.workspace;

        if (!Array.isArray(patientIds) || patientIds.length === 0) {
            res.status(400).json({
                success: false,
                message: 'Patient IDs array is required'
            });
            return;
        }

        if (!fromLocationId || !toLocationId) {
            res.status(400).json({
                success: false,
                message: 'From and To Location IDs are required'
            });
            return;
        }

        // Validate locations exist
        const fromLocation = workspace.locations?.find(loc => loc.id === fromLocationId);
        const toLocation = workspace.locations?.find(loc => loc.id === toLocationId);

        if (!fromLocation || !toLocation) {
            res.status(404).json({
                success: false,
                message: 'One or both locations not found'
            });
            return;
        }

        const objectIds = patientIds.map(id => new mongoose.Types.ObjectId(id));
        const result = await LocationFilterService.transferPatientsBetweenLocations(
            objectIds,
            fromLocationId,
            toLocationId,
            workspace._id
        );

        res.json({
            success: true,
            message: 'Patient transfer completed',
            data: {
                fromLocation: {
                    id: fromLocationId,
                    name: fromLocation.name
                },
                toLocation: {
                    id: toLocationId,
                    name: toLocation.name
                },
                totalRequested: patientIds.length,
                successful: result.success,
                failed: result.failed
            }
        });

    } catch (error) {
        logger.error('Error transferring patients between locations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to transfer patients between locations'
        });
    }
};

/**
 * Remove location assignment (make patients shared)
 */
export const removeLocationAssignment = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        if (!req.workspaceContext?.workspace) {
            res.status(400).json({
                success: false,
                message: 'Workspace context not found'
            });
            return;
        }

        const { patientIds } = req.body;
        const workspace = req.workspaceContext.workspace;

        if (!Array.isArray(patientIds) || patientIds.length === 0) {
            res.status(400).json({
                success: false,
                message: 'Patient IDs array is required'
            });
            return;
        }

        const objectIds = patientIds.map(id => new mongoose.Types.ObjectId(id));
        const result = await LocationFilterService.removeLocationAssignment(
            objectIds,
            workspace._id
        );

        res.json({
            success: true,
            message: 'Location assignment removed successfully',
            data: {
                totalRequested: patientIds.length,
                successful: result.success,
                failed: result.failed
            }
        });

    } catch (error) {
        logger.error('Error removing location assignment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to remove location assignment'
        });
    }
};

/**
 * Get location distribution summary
 */
export const getLocationDistribution = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        if (!req.workspaceContext?.workspace) {
            res.status(400).json({
                success: false,
                message: 'Workspace context not found'
            });
            return;
        }

        const workspace = req.workspaceContext.workspace;

        const distribution = await LocationFilterService.getLocationDistributionSummary(
            workspace._id
        );

        // Enrich with location names
        const enrichedDistribution = distribution.locationDistribution.map(item => {
            const location = workspace.locations?.find(loc => loc.id === item.locationId);
            return {
                ...item,
                locationName: location?.name || 'Unknown Location'
            };
        });

        res.json({
            success: true,
            data: {
                totalPatients: distribution.totalPatients,
                sharedPatients: distribution.sharedPatients,
                locationDistribution: enrichedDistribution,
                summary: {
                    totalLocations: workspace.locations?.length || 0,
                    locationsWithPatients: enrichedDistribution.length,
                    sharedPatientsPercentage: distribution.totalPatients > 0
                        ? Math.round((distribution.sharedPatients / distribution.totalPatients) * 100)
                        : 0
                }
            }
        });

    } catch (error) {
        logger.error('Error getting location distribution:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve location distribution'
        });
    }
};

/**
 * Get visits for a specific location
 */
export const getLocationVisits = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        if (!req.workspaceContext?.workspace) {
            res.status(400).json({
                success: false,
                message: 'Workspace context not found'
            });
            return;
        }

        const { locationId } = req.params;
        const { includeShared = false } = req.query;
        const workspace = req.workspaceContext.workspace;

        // Validate location exists
        const location = workspace.locations?.find(loc => loc.id === locationId);
        if (!location) {
            res.status(404).json({
                success: false,
                message: 'Location not found'
            });
            return;
        }

        const visits = await LocationFilterService.getVisitsForLocation({
            workspaceId: workspace._id,
            locationId,
            includeShared: includeShared === 'true'
        });

        res.json({
            success: true,
            data: {
                location: {
                    id: location.id,
                    name: location.name
                },
                visits,
                totalCount: visits.length,
                includeShared: includeShared === 'true'
            }
        });

    } catch (error) {
        logger.error('Error getting location visits:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve location visits'
        });
    }
};

/**
 * Get clinical notes for a specific location
 */
export const getLocationClinicalNotes = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        if (!req.workspaceContext?.workspace) {
            res.status(400).json({
                success: false,
                message: 'Workspace context not found'
            });
            return;
        }

        const { locationId } = req.params;
        const { includeShared = false } = req.query;
        const workspace = req.workspaceContext.workspace;

        // Validate location exists
        const location = workspace.locations?.find(loc => loc.id === locationId);
        if (!location) {
            res.status(404).json({
                success: false,
                message: 'Location not found'
            });
            return;
        }

        const clinicalNotes = await LocationFilterService.getClinicalNotesForLocation({
            workspaceId: workspace._id,
            locationId,
            includeShared: includeShared === 'true'
        });

        res.json({
            success: true,
            data: {
                location: {
                    id: location.id,
                    name: location.name
                },
                clinicalNotes,
                totalCount: clinicalNotes.length,
                includeShared: includeShared === 'true'
            }
        });

    } catch (error) {
        logger.error('Error getting location clinical notes:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve location clinical notes'
        });
    }
};

/**
 * Assign visit to location
 */
export const assignVisitToLocation = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        if (!req.workspaceContext?.workspace) {
            res.status(400).json({
                success: false,
                message: 'Workspace context not found'
            });
            return;
        }

        const { visitId, locationId } = req.body;
        const workspace = req.workspaceContext.workspace;

        if (!visitId || !locationId) {
            res.status(400).json({
                success: false,
                message: 'Visit ID and Location ID are required'
            });
            return;
        }

        // Validate location exists
        const location = workspace.locations?.find(loc => loc.id === locationId);
        if (!location) {
            res.status(404).json({
                success: false,
                message: 'Location not found'
            });
            return;
        }

        await LocationFilterService.assignVisitToLocation(
            new mongoose.Types.ObjectId(visitId),
            locationId,
            workspace._id
        );

        res.json({
            success: true,
            message: 'Visit assigned to location successfully',
            data: {
                visitId,
                locationId,
                locationName: location.name
            }
        });

    } catch (error) {
        logger.error('Error assigning visit to location:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to assign visit to location'
        });
    }
};

/**
 * Assign clinical note to location
 */
export const assignClinicalNoteToLocation = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        if (!req.workspaceContext?.workspace) {
            res.status(400).json({
                success: false,
                message: 'Workspace context not found'
            });
            return;
        }

        const { clinicalNoteId, locationId } = req.body;
        const workspace = req.workspaceContext.workspace;

        if (!clinicalNoteId || !locationId) {
            res.status(400).json({
                success: false,
                message: 'Clinical Note ID and Location ID are required'
            });
            return;
        }

        // Validate location exists
        const location = workspace.locations?.find(loc => loc.id === locationId);
        if (!location) {
            res.status(404).json({
                success: false,
                message: 'Location not found'
            });
            return;
        }

        await LocationFilterService.assignClinicalNoteToLocation(
            new mongoose.Types.ObjectId(clinicalNoteId),
            locationId,
            workspace._id
        );

        res.json({
            success: true,
            message: 'Clinical note assigned to location successfully',
            data: {
                clinicalNoteId,
                locationId,
                locationName: location.name
            }
        });

    } catch (error) {
        logger.error('Error assigning clinical note to location:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to assign clinical note to location'
        });
    }
};

/**
 * Share patient with other locations
 */
export const sharePatientWithLocations = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        if (!req.workspaceContext?.workspace) {
            res.status(400).json({
                success: false,
                message: 'Workspace context not found'
            });
            return;
        }

        const { patientId, fromLocationId, toLocationIds, accessLevel = 'read', expiresAt } = req.body;
        const workspace = req.workspaceContext.workspace;

        if (!patientId || !fromLocationId || !Array.isArray(toLocationIds) || toLocationIds.length === 0) {
            res.status(400).json({
                success: false,
                message: 'Patient ID, from location ID, and to location IDs are required'
            });
            return;
        }

        // Validate locations exist
        const fromLocation = workspace.locations?.find(loc => loc.id === fromLocationId);
        if (!fromLocation) {
            res.status(404).json({
                success: false,
                message: 'From location not found'
            });
            return;
        }

        const invalidLocationIds = toLocationIds.filter(locId =>
            !workspace.locations?.find(loc => loc.id === locId)
        );

        if (invalidLocationIds.length > 0) {
            res.status(404).json({
                success: false,
                message: `Invalid location IDs: ${invalidLocationIds.join(', ')}`
            });
            return;
        }

        await SharedPatientService.sharePatientWithLocations({
            patientId: new mongoose.Types.ObjectId(patientId),
            fromLocationId,
            toLocationIds,
            accessLevel,
            sharedBy: req.user!._id,
            expiresAt: expiresAt ? new Date(expiresAt) : undefined
        });

        res.json({
            success: true,
            message: 'Patient shared successfully',
            data: {
                patientId,
                fromLocationId,
                toLocationIds,
                accessLevel,
                expiresAt
            }
        });

    } catch (error) {
        logger.error('Error sharing patient with locations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to share patient with locations'
        });
    }
};

/**
 * Revoke shared patient access
 */
export const revokeSharedPatientAccess = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        if (!req.workspaceContext?.workspace) {
            res.status(400).json({
                success: false,
                message: 'Workspace context not found'
            });
            return;
        }

        const { patientId, locationIds } = req.body;

        if (!patientId) {
            res.status(400).json({
                success: false,
                message: 'Patient ID is required'
            });
            return;
        }

        await SharedPatientService.revokeSharedAccess(
            new mongoose.Types.ObjectId(patientId),
            locationIds
        );

        res.json({
            success: true,
            message: 'Shared access revoked successfully',
            data: {
                patientId,
                revokedFromLocations: locationIds || 'all'
            }
        });

    } catch (error) {
        logger.error('Error revoking shared patient access:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to revoke shared patient access'
        });
    }
};

/**
 * Get patients accessible from a specific location
 */
export const getPatientsAccessibleFromLocation = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        if (!req.workspaceContext?.workspace) {
            res.status(400).json({
                success: false,
                message: 'Workspace context not found'
            });
            return;
        }

        const { locationId } = req.params;
        const { includeShared = true } = req.query;
        const workspace = req.workspaceContext.workspace;

        if (!locationId) {
            res.status(400).json({
                success: false,
                message: 'Location ID is required'
            });
            return;
        }

        // Validate location exists
        const location = workspace.locations?.find(loc => loc.id === locationId);
        if (!location) {
            res.status(404).json({
                success: false,
                message: 'Location not found'
            });
            return;
        }

        const patients = await SharedPatientService.getPatientsAccessibleFromLocation(
            workspace._id,
            locationId,
            includeShared === 'true'
        );

        res.json({
            success: true,
            data: {
                location: {
                    id: location.id,
                    name: location.name
                },
                patients,
                totalCount: patients.length,
                includeShared: includeShared === 'true'
            }
        });

    } catch (error) {
        logger.error('Error getting patients accessible from location:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve patients accessible from location'
        });
    }
};

/**
 * Create patient transfer workflow
 */
export const createPatientTransferWorkflow = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        if (!req.workspaceContext?.workspace) {
            res.status(400).json({
                success: false,
                message: 'Workspace context not found'
            });
            return;
        }

        const { patientId, fromLocationId, toLocationId, transferReason } = req.body;
        const workspace = req.workspaceContext.workspace;

        if (!patientId || !fromLocationId || !toLocationId) {
            res.status(400).json({
                success: false,
                message: 'Patient ID, from location ID, and to location ID are required'
            });
            return;
        }

        // Validate locations exist
        const fromLocation = workspace.locations?.find(loc => loc.id === fromLocationId);
        const toLocation = workspace.locations?.find(loc => loc.id === toLocationId);

        if (!fromLocation || !toLocation) {
            res.status(404).json({
                success: false,
                message: 'One or both locations not found'
            });
            return;
        }

        const result = await SharedPatientService.createTransferWorkflow(
            new mongoose.Types.ObjectId(patientId),
            fromLocationId,
            toLocationId,
            req.user!._id,
            transferReason
        );

        res.json({
            success: true,
            message: 'Patient transfer workflow created successfully',
            data: {
                transferId: result.transferId,
                status: result.status,
                fromLocation: {
                    id: fromLocationId,
                    name: fromLocation.name
                },
                toLocation: {
                    id: toLocationId,
                    name: toLocation.name
                }
            }
        });

    } catch (error) {
        logger.error('Error creating patient transfer workflow:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create patient transfer workflow'
        });
    }
};

/**
 * Complete patient transfer
 */
export const completePatientTransfer = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        if (!req.workspaceContext?.workspace) {
            res.status(400).json({
                success: false,
                message: 'Workspace context not found'
            });
            return;
        }

        const { patientId, transferId } = req.body;

        if (!patientId || !transferId) {
            res.status(400).json({
                success: false,
                message: 'Patient ID and transfer ID are required'
            });
            return;
        }

        await SharedPatientService.completePatientTransfer(
            new mongoose.Types.ObjectId(patientId),
            transferId,
            req.user!._id
        );

        res.json({
            success: true,
            message: 'Patient transfer completed successfully',
            data: {
                patientId,
                transferId
            }
        });

    } catch (error) {
        logger.error('Error completing patient transfer:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to complete patient transfer'
        });
    }
};

/**
 * Get location access summary
 */
export const getLocationAccessSummary = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        if (!req.workspaceContext?.workspace) {
            res.status(400).json({
                success: false,
                message: 'Workspace context not found'
            });
            return;
        }

        const workspace = req.workspaceContext.workspace;

        const summary = await SharedPatientService.getLocationAccessSummary(
            workspace._id,
            workspace
        );

        res.json({
            success: true,
            data: summary
        });

    } catch (error) {
        logger.error('Error getting location access summary:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve location access summary'
        });
    }
};

/**
 * Check patient access from location
 */
export const checkPatientAccess = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        if (!req.workspaceContext?.workspace) {
            res.status(400).json({
                success: false,
                message: 'Workspace context not found'
            });
            return;
        }

        const { patientId, locationId } = req.params;
        const workspace = req.workspaceContext.workspace;

        if (!patientId || !locationId) {
            res.status(400).json({
                success: false,
                message: 'Patient ID and location ID are required'
            });
            return;
        }

        // Validate location exists
        const location = workspace.locations?.find(loc => loc.id === locationId);
        if (!location) {
            res.status(404).json({
                success: false,
                message: 'Location not found'
            });
            return;
        }

        const accessInfo = await SharedPatientService.checkPatientAccess(
            new mongoose.Types.ObjectId(patientId),
            locationId,
            workspace._id
        );

        res.json({
            success: true,
            data: {
                patientId,
                locationId,
                locationName: location.name,
                ...accessInfo
            }
        });

    } catch (error) {
        logger.error('Error checking patient access:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check patient access'
        });
    }
};