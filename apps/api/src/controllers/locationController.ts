import { Request, Response } from 'express';
import { AuthRequest } from '../types/auth';
import Workplace, { IWorkplace, LocationInfo } from '../models/Workplace';
import mongoose from 'mongoose';
import logger from '../utils/logger';

/**
 * Get all locations for the current workspace
 */
export const getWorkspaceLocations = async (
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

        res.json({
            success: true,
            data: {
                locations: workspace.locations || [],
                totalLocations: workspace.locations?.length || 0,
                primaryLocation: workspace.locations?.find(loc => loc.isPrimary) || null
            }
        });

    } catch (error) {
        logger.error('Error getting workspace locations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve locations'
        });
    }
};

/**
 * Get a specific location by ID
 */
export const getLocationById = async (
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

        const location = workspace.locations?.find(loc => loc.id === locationId);

        if (!location) {
            res.status(404).json({
                success: false,
                message: 'Location not found'
            });
            return;
        }

        res.json({
            success: true,
            data: location
        });

    } catch (error) {
        logger.error('Error getting location by ID:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve location'
        });
    }
};

/**
 * Create a new location
 */
export const createLocation = async (
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

        const { name, address, metadata = {} } = req.body;

        // Validate required fields
        if (!name || !address) {
            res.status(400).json({
                success: false,
                message: 'Name and address are required'
            });
            return;
        }

        const workspace = req.workspaceContext.workspace;

        // Check if workspace has multi-location feature
        const plan = req.workspaceContext?.plan;
        const hasMultiLocationFeature = plan?.features
            ? (Array.isArray(plan.features)
                ? plan.features.includes('multiLocationDashboard') || plan.features.includes('multi_location_dashboard')
                : (plan.features as any).multiLocationDashboard === true)
            : false;

        if (!plan || !hasMultiLocationFeature) {
            res.status(403).json({
                success: false,
                message: 'Multi-location feature not available in your current plan',
                upgradeRequired: true
            });
            return;
        }

        // Check location limits based on plan
        const currentLocationCount = workspace.locations?.length || 0;
        const locationLimit = req.workspaceContext.limits?.locations;

        if (locationLimit && currentLocationCount >= locationLimit) {
            res.status(409).json({
                success: false,
                message: `Location limit reached (${locationLimit}). Upgrade your plan to add more locations.`,
                currentCount: currentLocationCount,
                limit: locationLimit,
                upgradeRequired: true
            });
            return;
        }

        // Create new location
        const newLocation: LocationInfo = {
            id: new mongoose.Types.ObjectId().toString(),
            name: name.trim(),
            address: address.trim(),
            isPrimary: false, // New locations are never primary by default
            metadata: metadata || {}
        };

        // Add location to workspace
        const updatedWorkspace = await Workplace.findByIdAndUpdate(
            workspace._id,
            {
                $push: { locations: newLocation }
            },
            { new: true, runValidators: true }
        );

        if (!updatedWorkspace) {
            res.status(500).json({
                success: false,
                message: 'Failed to create location'
            });
            return;
        }

        logger.info(`Location created: ${newLocation.name} for workspace ${workspace.name}`);

        res.status(201).json({
            success: true,
            message: 'Location created successfully',
            data: newLocation
        });

    } catch (error) {
        logger.error('Error creating location:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create location'
        });
    }
};

/**
 * Update an existing location
 */
export const updateLocation = async (
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
        const { name, address, metadata } = req.body;
        const workspace = req.workspaceContext.workspace;

        // Find the location
        const locationIndex = workspace.locations?.findIndex(loc => loc.id === locationId);

        if (locationIndex === -1 || locationIndex === undefined) {
            res.status(404).json({
                success: false,
                message: 'Location not found'
            });
            return;
        }

        // Prepare update data
        const updateData: any = {};
        if (name !== undefined) updateData[`locations.${locationIndex}.name`] = name.trim();
        if (address !== undefined) updateData[`locations.${locationIndex}.address`] = address.trim();
        if (metadata !== undefined) updateData[`locations.${locationIndex}.metadata`] = metadata;

        // Update the location
        const updatedWorkspace = await Workplace.findByIdAndUpdate(
            workspace._id,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!updatedWorkspace) {
            res.status(500).json({
                success: false,
                message: 'Failed to update location'
            });
            return;
        }

        const updatedLocation = updatedWorkspace.locations?.[locationIndex];

        logger.info(`Location updated: ${locationId} for workspace ${workspace.name}`);

        res.json({
            success: true,
            message: 'Location updated successfully',
            data: updatedLocation
        });

    } catch (error) {
        logger.error('Error updating location:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update location'
        });
    }
};

/**
 * Delete a location
 */
export const deleteLocation = async (
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

        // Find the location
        const location = workspace.locations?.find(loc => loc.id === locationId);

        if (!location) {
            res.status(404).json({
                success: false,
                message: 'Location not found'
            });
            return;
        }

        // Prevent deletion of primary location
        if (location.isPrimary) {
            res.status(400).json({
                success: false,
                message: 'Cannot delete primary location. Set another location as primary first.'
            });
            return;
        }

        // Check if location has associated data (patients, etc.)
        // This would require checking related models - for now we'll allow deletion
        // In a real implementation, you'd want to check for associated patients, etc.

        // Remove location from workspace
        const updatedWorkspace = await Workplace.findByIdAndUpdate(
            workspace._id,
            {
                $pull: { locations: { id: locationId } }
            },
            { new: true }
        );

        if (!updatedWorkspace) {
            res.status(500).json({
                success: false,
                message: 'Failed to delete location'
            });
            return;
        }

        logger.info(`Location deleted: ${locationId} for workspace ${workspace.name}`);

        res.json({
            success: true,
            message: 'Location deleted successfully'
        });

    } catch (error) {
        logger.error('Error deleting location:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete location'
        });
    }
};

/**
 * Set a location as primary
 */
export const setPrimaryLocation = async (
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

        // Find the location
        const location = workspace.locations?.find(loc => loc.id === locationId);

        if (!location) {
            res.status(404).json({
                success: false,
                message: 'Location not found'
            });
            return;
        }

        // Update all locations to set the new primary
        const updateOperations = workspace.locations?.map((loc, index) => ({
            [`locations.${index}.isPrimary`]: loc.id === locationId
        })) || [];

        const updateData = Object.assign({}, ...updateOperations);

        const updatedWorkspace = await Workplace.findByIdAndUpdate(
            workspace._id,
            { $set: updateData },
            { new: true }
        );

        if (!updatedWorkspace) {
            res.status(500).json({
                success: false,
                message: 'Failed to set primary location'
            });
            return;
        }

        logger.info(`Primary location set: ${locationId} for workspace ${workspace.name}`);

        res.json({
            success: true,
            message: 'Primary location updated successfully',
            data: {
                primaryLocationId: locationId,
                locations: updatedWorkspace.locations
            }
        });

    } catch (error) {
        logger.error('Error setting primary location:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to set primary location'
        });
    }
};

/**
 * Get location statistics
 */
export const getLocationStats = async (
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

        // Find the location
        const location = workspace.locations?.find(loc => loc.id === locationId);

        if (!location) {
            res.status(404).json({
                success: false,
                message: 'Location not found'
            });
            return;
        }

        // TODO: Implement actual statistics gathering from related models
        // For now, return placeholder data
        const stats = {
            location,
            statistics: {
                totalPatients: 0, // Would query Patient model with locationId
                activePatients: 0,
                totalUsers: 0, // Would query User model with locationId
                totalVisits: 0, // Would query Visit model with locationId
                lastActivity: null
            }
        };

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        logger.error('Error getting location stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve location statistics'
        });
    }
};

/**
 * Bulk update locations
 */
export const bulkUpdateLocations = async (
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

        const { locations } = req.body;
        const workspace = req.workspaceContext.workspace;

        if (!Array.isArray(locations)) {
            res.status(400).json({
                success: false,
                message: 'Locations must be an array'
            });
            return;
        }

        // Validate that all location IDs exist
        const existingLocationIds = workspace.locations?.map(loc => loc.id) || [];
        const updateLocationIds = locations.map(loc => loc.id);

        const invalidIds = updateLocationIds.filter(id => !existingLocationIds.includes(id));
        if (invalidIds.length > 0) {
            res.status(400).json({
                success: false,
                message: `Invalid location IDs: ${invalidIds.join(', ')}`
            });
            return;
        }

        // Ensure only one primary location
        const primaryLocations = locations.filter(loc => loc.isPrimary);
        if (primaryLocations.length > 1) {
            res.status(400).json({
                success: false,
                message: 'Only one location can be set as primary'
            });
            return;
        }

        // Update locations
        const updatedLocations = workspace.locations?.map(existingLoc => {
            const updateData = locations.find(loc => loc.id === existingLoc.id);
            if (updateData) {
                return {
                    ...existingLoc,
                    name: updateData.name || existingLoc.name,
                    address: updateData.address || existingLoc.address,
                    isPrimary: updateData.isPrimary !== undefined ? updateData.isPrimary : existingLoc.isPrimary,
                    metadata: updateData.metadata || existingLoc.metadata
                };
            }
            return existingLoc;
        }) || [];

        const updatedWorkspace = await Workplace.findByIdAndUpdate(
            workspace._id,
            { locations: updatedLocations },
            { new: true, runValidators: true }
        );

        if (!updatedWorkspace) {
            res.status(500).json({
                success: false,
                message: 'Failed to update locations'
            });
            return;
        }

        logger.info(`Bulk location update completed for workspace ${workspace.name}`);

        res.json({
            success: true,
            message: 'Locations updated successfully',
            data: {
                locations: updatedWorkspace.locations,
                updatedCount: locations.length
            }
        });

    } catch (error) {
        logger.error('Error bulk updating locations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update locations'
        });
    }
};