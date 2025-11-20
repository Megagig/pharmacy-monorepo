import mongoose from 'mongoose';
import Patient from '../models/Patient';
import { IWorkplace } from '../models/Workplace';
import logger from '../utils/logger';

export interface SharedPatientAccess {
    patientId: mongoose.Types.ObjectId;
    sharedWithLocations: string[];
    sharedBy: mongoose.Types.ObjectId;
    sharedAt: Date;
    accessLevel: 'read' | 'write' | 'full';
    expiresAt?: Date;
}

export interface PatientSharingOptions {
    patientId: mongoose.Types.ObjectId;
    fromLocationId: string;
    toLocationIds: string[];
    accessLevel: 'read' | 'write' | 'full';
    sharedBy: mongoose.Types.ObjectId;
    expiresAt?: Date;
}

export interface CrossLocationPatientAccess {
    patientId: mongoose.Types.ObjectId;
    primaryLocationId: string;
    accessibleLocations: string[];
    accessLevel: 'read' | 'write' | 'full';
    lastAccessedAt?: Date;
}

export class SharedPatientService {
    /**
     * Share patient records with other locations
     */
    async sharePatientWithLocations(options: PatientSharingOptions): Promise<boolean> {
        try {
            const { patientId, fromLocationId, toLocationIds, accessLevel, sharedBy, expiresAt } = options;

            // Verify patient exists and belongs to the from location
            const patient = await Patient.findOne({
                _id: patientId,
                locationId: fromLocationId,
                isDeleted: { $ne: true }
            });

            if (!patient) {
                throw new Error('Patient not found or access denied');
            }

            // Create shared access record
            const sharedAccess: SharedPatientAccess = {
                patientId,
                sharedWithLocations: toLocationIds,
                sharedBy,
                sharedAt: new Date(),
                accessLevel,
                expiresAt
            };

            // Store shared access information in patient metadata
            const updatedPatient = await Patient.findByIdAndUpdate(
                patientId,
                {
                    $set: {
                        'metadata.sharedAccess': sharedAccess
                    }
                },
                { new: true }
            );

            if (!updatedPatient) {
                throw new Error('Failed to update patient sharing information');
            }

            logger.info(`Patient ${patientId} shared from location ${fromLocationId} to locations: ${toLocationIds.join(', ')}`);
            return true;

        } catch (error) {
            logger.error('Error sharing patient with locations:', error);
            throw error;
        }
    }

    /**
     * Revoke shared access to patient
     */
    async revokeSharedAccess(
        patientId: mongoose.Types.ObjectId,
        locationIds?: string[]
    ): Promise<boolean> {
        try {
            const patient = await Patient.findById(patientId);
            if (!patient) {
                throw new Error('Patient not found');
            }

            if (locationIds && locationIds.length > 0) {
                // Revoke access for specific locations
                const currentSharedAccess = patient.metadata?.sharedAccess as SharedPatientAccess;
                if (currentSharedAccess) {
                    const updatedSharedLocations = currentSharedAccess.sharedWithLocations.filter(
                        locId => !locationIds.includes(locId)
                    );

                    if (updatedSharedLocations.length === 0) {
                        // No more shared locations, remove shared access entirely
                        await Patient.findByIdAndUpdate(
                            patientId,
                            { $unset: { 'metadata.sharedAccess': 1 } }
                        );
                    } else {
                        // Update with remaining shared locations
                        await Patient.findByIdAndUpdate(
                            patientId,
                            {
                                $set: {
                                    'metadata.sharedAccess.sharedWithLocations': updatedSharedLocations
                                }
                            }
                        );
                    }
                }
            } else {
                // Revoke all shared access
                await Patient.findByIdAndUpdate(
                    patientId,
                    { $unset: { 'metadata.sharedAccess': 1 } }
                );
            }

            logger.info(`Shared access revoked for patient ${patientId}`);
            return true;

        } catch (error) {
            logger.error('Error revoking shared access:', error);
            throw error;
        }
    }

    /**
     * Get patients accessible from a specific location
     */
    async getPatientsAccessibleFromLocation(
        workspaceId: mongoose.Types.ObjectId,
        locationId: string,
        includeShared: boolean = true
    ): Promise<any[]> {
        try {
            const query: any = {
                workspaceId,
                isDeleted: { $ne: true },
                $or: [
                    // Patients directly assigned to this location
                    { locationId: locationId },
                ]
            };

            if (includeShared) {
                // Add shared patients and patients without location assignment
                query.$or.push(
                    // Patients shared with this location
                    { 'metadata.sharedAccess.sharedWithLocations': locationId },
                    // Patients without specific location (shared by default)
                    { locationId: { $exists: false } },
                    { locationId: null }
                );
            }

            const patients = await Patient.find(query)
                .select('_id firstName lastName mrn locationId metadata.sharedAccess createdAt')
                .sort({ createdAt: -1 })
                .lean();

            // Enrich with access information
            const enrichedPatients = patients.map(patient => {
                const sharedAccess = patient.metadata?.sharedAccess as SharedPatientAccess;
                let accessType = 'direct';
                let accessLevel = 'full';

                if (patient.locationId === locationId) {
                    accessType = 'direct';
                    accessLevel = 'full';
                } else if (sharedAccess?.sharedWithLocations?.includes(locationId)) {
                    accessType = 'shared';
                    accessLevel = sharedAccess.accessLevel;
                } else if (!patient.locationId) {
                    accessType = 'workspace_shared';
                    accessLevel = 'full';
                }

                return {
                    ...patient,
                    accessInfo: {
                        type: accessType,
                        level: accessLevel,
                        sharedAt: sharedAccess?.sharedAt,
                        expiresAt: sharedAccess?.expiresAt
                    }
                };
            });

            return enrichedPatients;

        } catch (error) {
            logger.error('Error getting patients accessible from location:', error);
            throw error;
        }
    }

    /**
     * Get shared patient records for a workspace
     */
    async getSharedPatientRecords(
        workspaceId: mongoose.Types.ObjectId
    ): Promise<any[]> {
        try {
            const patients = await Patient.find({
                workspaceId,
                isDeleted: { $ne: true },
                'metadata.sharedAccess': { $exists: true }
            })
                .select('_id firstName lastName mrn locationId metadata.sharedAccess createdAt')
                .sort({ createdAt: -1 })
                .lean();

            return patients.map(patient => {
                const sharedAccess = patient.metadata?.sharedAccess as SharedPatientAccess;
                return {
                    ...patient,
                    sharedAccess
                };
            });

        } catch (error) {
            logger.error('Error getting shared patient records:', error);
            throw error;
        }
    }

    /**
     * Check if user has access to patient from specific location
     */
    async checkPatientAccess(
        patientId: mongoose.Types.ObjectId,
        locationId: string,
        workspaceId: mongoose.Types.ObjectId
    ): Promise<{
        hasAccess: boolean;
        accessLevel: 'read' | 'write' | 'full';
        accessType: 'direct' | 'shared' | 'workspace_shared';
    }> {
        try {
            const patient = await Patient.findOne({
                _id: patientId,
                workspaceId,
                isDeleted: { $ne: true }
            }).lean();

            if (!patient) {
                return { hasAccess: false, accessLevel: 'read', accessType: 'direct' };
            }

            // Direct access (patient belongs to this location)
            if (patient.locationId === locationId) {
                return { hasAccess: true, accessLevel: 'full', accessType: 'direct' };
            }

            // Shared access
            const sharedAccess = patient.metadata?.sharedAccess as SharedPatientAccess;
            if (sharedAccess?.sharedWithLocations?.includes(locationId)) {
                // Check if access has expired
                if (sharedAccess.expiresAt && new Date() > sharedAccess.expiresAt) {
                    return { hasAccess: false, accessLevel: 'read', accessType: 'shared' };
                }
                return {
                    hasAccess: true,
                    accessLevel: sharedAccess.accessLevel,
                    accessType: 'shared'
                };
            }

            // Workspace shared (no specific location)
            if (!patient.locationId) {
                return { hasAccess: true, accessLevel: 'full', accessType: 'workspace_shared' };
            }

            return { hasAccess: false, accessLevel: 'read', accessType: 'direct' };

        } catch (error) {
            logger.error('Error checking patient access:', error);
            return { hasAccess: false, accessLevel: 'read', accessType: 'direct' };
        }
    }

    /**
     * Create cross-location patient transfer workflow
     */
    async createTransferWorkflow(
        patientId: mongoose.Types.ObjectId,
        fromLocationId: string,
        toLocationId: string,
        transferredBy: mongoose.Types.ObjectId,
        transferReason?: string
    ): Promise<{
        transferId: string;
        status: 'pending' | 'approved' | 'completed';
    }> {
        try {
            const transferId = new mongoose.Types.ObjectId().toString();

            const transferWorkflow = {
                transferId,
                patientId,
                fromLocationId,
                toLocationId,
                transferredBy,
                transferReason,
                status: 'pending' as const,
                createdAt: new Date(),
                steps: [
                    {
                        step: 'initiated',
                        completedAt: new Date(),
                        completedBy: transferredBy
                    }
                ]
            };

            // Store transfer workflow in patient metadata
            await Patient.findByIdAndUpdate(
                patientId,
                {
                    $set: {
                        'metadata.transferWorkflow': transferWorkflow
                    }
                }
            );

            logger.info(`Transfer workflow created: ${transferId} for patient ${patientId}`);

            return {
                transferId,
                status: 'pending'
            };

        } catch (error) {
            logger.error('Error creating transfer workflow:', error);
            throw error;
        }
    }

    /**
     * Complete patient transfer
     */
    async completePatientTransfer(
        patientId: mongoose.Types.ObjectId,
        transferId: string,
        completedBy: mongoose.Types.ObjectId
    ): Promise<boolean> {
        try {
            const patient = await Patient.findById(patientId);
            if (!patient) {
                throw new Error('Patient not found');
            }

            const transferWorkflow = patient.metadata?.transferWorkflow;
            if (!transferWorkflow || transferWorkflow.transferId !== transferId) {
                throw new Error('Transfer workflow not found');
            }

            // Update patient location
            await Patient.findByIdAndUpdate(
                patientId,
                {
                    locationId: transferWorkflow.toLocationId,
                    $set: {
                        'metadata.transferWorkflow.status': 'completed',
                        'metadata.transferWorkflow.completedAt': new Date(),
                        'metadata.transferWorkflow.completedBy': completedBy
                    },
                    $push: {
                        'metadata.transferWorkflow.steps': {
                            step: 'completed',
                            completedAt: new Date(),
                            completedBy: completedBy
                        }
                    }
                }
            );

            logger.info(`Patient transfer completed: ${transferId} for patient ${patientId}`);
            return true;

        } catch (error) {
            logger.error('Error completing patient transfer:', error);
            throw error;
        }
    }

    /**
     * Get location access summary for workspace
     */
    async getLocationAccessSummary(
        workspaceId: mongoose.Types.ObjectId,
        workspace: IWorkplace
    ): Promise<{
        totalPatients: number;
        directlyAssigned: number;
        sharedPatients: number;
        workspaceShared: number;
        locationBreakdown: Array<{
            locationId: string;
            locationName: string;
            directPatients: number;
            accessiblePatients: number;
        }>;
    }> {
        try {
            const totalPatients = await Patient.countDocuments({
                workspaceId,
                isDeleted: { $ne: true }
            });

            const directlyAssigned = await Patient.countDocuments({
                workspaceId,
                isDeleted: { $ne: true },
                locationId: { $exists: true, $ne: null }
            });

            const sharedPatients = await Patient.countDocuments({
                workspaceId,
                isDeleted: { $ne: true },
                'metadata.sharedAccess': { $exists: true }
            });

            const workspaceShared = await Patient.countDocuments({
                workspaceId,
                isDeleted: { $ne: true },
                $or: [
                    { locationId: { $exists: false } },
                    { locationId: null }
                ]
            });

            const locationBreakdown = [];

            if (workspace.locations) {
                for (const location of workspace.locations) {
                    const directPatients = await Patient.countDocuments({
                        workspaceId,
                        isDeleted: { $ne: true },
                        locationId: location.id
                    });

                    const accessiblePatients = await Patient.countDocuments({
                        workspaceId,
                        isDeleted: { $ne: true },
                        $or: [
                            { locationId: location.id },
                            { 'metadata.sharedAccess.sharedWithLocations': location.id },
                            { locationId: { $exists: false } },
                            { locationId: null }
                        ]
                    });

                    locationBreakdown.push({
                        locationId: location.id,
                        locationName: location.name,
                        directPatients,
                        accessiblePatients
                    });
                }
            }

            return {
                totalPatients,
                directlyAssigned,
                sharedPatients,
                workspaceShared,
                locationBreakdown
            };

        } catch (error) {
            logger.error('Error getting location access summary:', error);
            throw error;
        }
    }

    /**
     * Clean up expired shared access
     */
    async cleanupExpiredSharedAccess(): Promise<number> {
        try {
            const result = await Patient.updateMany(
                {
                    'metadata.sharedAccess.expiresAt': { $lt: new Date() }
                },
                {
                    $unset: { 'metadata.sharedAccess': 1 }
                }
            );

            logger.info(`Cleaned up ${result.modifiedCount} expired shared access records`);
            return result.modifiedCount;

        } catch (error) {
            logger.error('Error cleaning up expired shared access:', error);
            throw error;
        }
    }
}

export default new SharedPatientService();