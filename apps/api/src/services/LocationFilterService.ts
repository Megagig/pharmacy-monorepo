import mongoose from 'mongoose';
import { IWorkplace } from '../models/Workplace';
import Patient from '../models/Patient';
import Visit from '../models/Visit';
import ClinicalNote from '../models/ClinicalNote';
import Medication from '../models/Medication';
import logger from '../utils/logger';

export interface LocationFilterOptions {
  workspaceId: mongoose.Types.ObjectId;
  locationId?: string;
  includeShared?: boolean; // Include records without specific location assignment
  userLocationAccess?: string[]; // Locations the user has access to
}

export interface LocationAnalytics {
  locationId: string;
  locationName: string;
  statistics: {
    totalPatients: number;
    activePatients: number;
    newPatientsThisMonth: number;
    totalVisits: number;
    totalClinicalNotes: number;
    visitsThisMonth: number;
    clinicalNotesThisMonth: number;
    lastActivity: Date | null;
  };
}

export class LocationFilterService {
  /**
   * Build location-aware query filter
   */
  buildLocationFilter(options: LocationFilterOptions): any {
    const filter: any = {
      workspaceId: options.workspaceId,
      isDeleted: { $ne: true },
    };

    if (options.locationId) {
      if (options.includeShared) {
        // Include records for specific location OR shared records (no locationId)
        filter.$or = [
          { locationId: options.locationId },
          { locationId: { $exists: false } },
          { locationId: null },
        ];
      } else {
        // Only records for specific location
        filter.locationId = options.locationId;
      }
    } else if (
      options.userLocationAccess &&
      options.userLocationAccess.length > 0
    ) {
      // User has access to specific locations
      if (options.includeShared) {
        filter.$or = [
          { locationId: { $in: options.userLocationAccess } },
          { locationId: { $exists: false } },
          { locationId: null },
        ];
      } else {
        filter.locationId = { $in: options.userLocationAccess };
      }
    } else if (!options.includeShared) {
      // Exclude shared records if not explicitly included
      filter.locationId = { $exists: true, $ne: null };
    }

    return filter;
  }

  /**
   * Get patients for a specific location
   */
  async getPatientsForLocation(options: LocationFilterOptions): Promise<any[]> {
    try {
      const filter = this.buildLocationFilter(options);

      const patients = await Patient.find(filter)
        .select('_id firstName lastName mrn locationId createdAt')
        .sort({ createdAt: -1 })
        .lean();

      return patients;
    } catch (error) {
      logger.error('Error getting patients for location:', error);
      throw error;
    }
  }

  /**
   * Get visits for a specific location
   */
  async getVisitsForLocation(options: LocationFilterOptions): Promise<any[]> {
    try {
      const filter = this.buildLocationFilter(options);

      const visits = await Visit.find(filter)
        .select('_id patientId date soap locationId createdAt')
        .populate('patientId', 'firstName lastName mrn')
        .sort({ createdAt: -1 })
        .lean();

      return visits;
    } catch (error) {
      logger.error('Error getting visits for location:', error);
      throw error;
    }
  }

  /**
   * Get clinical notes for a specific location
   */
  async getClinicalNotesForLocation(
    options: LocationFilterOptions
  ): Promise<any[]> {
    try {
      const filter = this.buildLocationFilter(options);

      const clinicalNotes = await ClinicalNote.find(filter)
        .select('_id patient pharmacist type title locationId createdAt')
        .populate('patient', 'firstName lastName mrn')
        .populate('pharmacist', 'firstName lastName')
        .sort({ createdAt: -1 })
        .lean();

      return clinicalNotes;
    } catch (error) {
      logger.error('Error getting clinical notes for location:', error);
      throw error;
    }
  }

  /**
   * Get location analytics
   */
  async getLocationAnalytics(
    workspaceId: mongoose.Types.ObjectId,
    locationId: string,
    locationName: string
  ): Promise<LocationAnalytics> {
    try {
      const filter = {
        workspaceId,
        locationId,
        isDeleted: { $ne: true },
      };

      // Get patient statistics
      const totalPatients = await Patient.countDocuments(filter);

      // Get visit statistics
      const visitFilter = { workspaceId, locationId };
      const totalVisits = await Visit.countDocuments(visitFilter);

      // Get clinical notes statistics
      const clinicalNotesFilter = { workspaceId, locationId };
      const totalClinicalNotes = await ClinicalNote.countDocuments(
        clinicalNotesFilter
      );

      // Get monthly statistics
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const newPatientsThisMonth = await Patient.countDocuments({
        ...filter,
        createdAt: { $gte: startOfMonth },
      });

      const visitsThisMonth = await Visit.countDocuments({
        ...visitFilter,
        createdAt: { $gte: startOfMonth },
      });

      const clinicalNotesThisMonth = await ClinicalNote.countDocuments({
        ...clinicalNotesFilter,
        createdAt: { $gte: startOfMonth },
      });

      // Get last activity (most recent activity across all models)
      const lastPatient = await Patient.findOne(filter)
        .sort({ createdAt: -1 })
        .select('createdAt')
        .lean();

      const lastVisit = await Visit.findOne(visitFilter)
        .sort({ createdAt: -1 })
        .select('createdAt')
        .lean();

      const lastClinicalNote = await ClinicalNote.findOne(clinicalNotesFilter)
        .sort({ createdAt: -1 })
        .select('createdAt')
        .lean();

      const activities = [
        lastPatient?.createdAt,
        lastVisit?.createdAt,
        lastClinicalNote?.createdAt,
      ].filter(Boolean);

      const lastActivity =
        activities.length > 0
          ? new Date(Math.max(...activities.map((date) => date!.getTime())))
          : null;

      return {
        locationId,
        locationName,
        statistics: {
          totalPatients,
          activePatients: totalPatients, // For now, assume all patients are active
          newPatientsThisMonth,
          totalVisits,
          totalClinicalNotes,
          visitsThisMonth,
          clinicalNotesThisMonth,
          lastActivity,
        },
      };
    } catch (error) {
      logger.error('Error getting location analytics:', error);
      throw error;
    }
  }

  /**
   * Get analytics for all locations in a workspace
   */
  async getWorkspaceLocationAnalytics(
    workspace: IWorkplace
  ): Promise<LocationAnalytics[]> {
    try {
      const analytics: LocationAnalytics[] = [];

      if (!workspace.locations || workspace.locations.length === 0) {
        return analytics;
      }

      for (const location of workspace.locations) {
        const locationAnalytics = await this.getLocationAnalytics(
          workspace._id,
          location.id,
          location.name
        );
        analytics.push(locationAnalytics);
      }

      return analytics;
    } catch (error) {
      logger.error('Error getting workspace location analytics:', error);
      throw error;
    }
  }

  /**
   * Assign patient to location
   */
  async assignPatientToLocation(
    patientId: mongoose.Types.ObjectId,
    locationId: string,
    workspaceId: mongoose.Types.ObjectId
  ): Promise<boolean> {
    try {
      const result = await Patient.findOneAndUpdate(
        {
          _id: patientId,
          workspaceId,
          isDeleted: { $ne: true },
        },
        { locationId },
        { new: true }
      );

      if (!result) {
        throw new Error('Patient not found or access denied');
      }

      logger.info(`Patient ${patientId} assigned to location ${locationId}`);
      return true;
    } catch (error) {
      logger.error('Error assigning patient to location:', error);
      throw error;
    }
  }

  /**
   * Bulk assign patients to location
   */
  async bulkAssignPatientsToLocation(
    patientIds: mongoose.Types.ObjectId[],
    locationId: string,
    workspaceId: mongoose.Types.ObjectId
  ): Promise<{ success: number; failed: number }> {
    try {
      const result = await Patient.updateMany(
        {
          _id: { $in: patientIds },
          workspaceId,
          isDeleted: { $ne: true },
        },
        { locationId }
      );

      logger.info(
        `Bulk assigned ${result.modifiedCount} patients to location ${locationId}`
      );

      return {
        success: result.modifiedCount,
        failed: patientIds.length - result.modifiedCount,
      };
    } catch (error) {
      logger.error('Error bulk assigning patients to location:', error);
      throw error;
    }
  }

  /**
   * Remove location assignment from patients (make them shared)
   */
  async removeLocationAssignment(
    patientIds: mongoose.Types.ObjectId[],
    workspaceId: mongoose.Types.ObjectId
  ): Promise<{ success: number; failed: number }> {
    try {
      const result = await Patient.updateMany(
        {
          _id: { $in: patientIds },
          workspaceId,
          isDeleted: { $ne: true },
        },
        { $unset: { locationId: 1 } }
      );

      logger.info(
        `Removed location assignment from ${result.modifiedCount} patients`
      );

      return {
        success: result.modifiedCount,
        failed: patientIds.length - result.modifiedCount,
      };
    } catch (error) {
      logger.error('Error removing location assignment:', error);
      throw error;
    }
  }

  /**
   * Transfer patients between locations
   */
  async transferPatientsBetweenLocations(
    patientIds: mongoose.Types.ObjectId[],
    fromLocationId: string,
    toLocationId: string,
    workspaceId: mongoose.Types.ObjectId
  ): Promise<{ success: number; failed: number }> {
    try {
      const result = await Patient.updateMany(
        {
          _id: { $in: patientIds },
          workspaceId,
          locationId: fromLocationId,
          isDeleted: { $ne: true },
        },
        { locationId: toLocationId }
      );

      logger.info(
        `Transferred ${result.modifiedCount} patients from ${fromLocationId} to ${toLocationId}`
      );

      return {
        success: result.modifiedCount,
        failed: patientIds.length - result.modifiedCount,
      };
    } catch (error) {
      logger.error('Error transferring patients between locations:', error);
      throw error;
    }
  }

  /**
   * Assign visit to location
   */
  async assignVisitToLocation(
    visitId: mongoose.Types.ObjectId,
    locationId: string,
    workspaceId: mongoose.Types.ObjectId
  ): Promise<boolean> {
    try {
      const result = await Visit.findOneAndUpdate(
        {
          _id: visitId,
          workspaceId,
          isDeleted: { $ne: true },
        },
        { locationId },
        { new: true }
      );

      if (!result) {
        throw new Error('Visit not found or access denied');
      }

      logger.info(`Visit ${visitId} assigned to location ${locationId}`);
      return true;
    } catch (error) {
      logger.error('Error assigning visit to location:', error);
      throw error;
    }
  }

  /**
   * Assign clinical note to location
   */
  async assignClinicalNoteToLocation(
    clinicalNoteId: mongoose.Types.ObjectId,
    locationId: string,
    workspaceId: mongoose.Types.ObjectId
  ): Promise<boolean> {
    try {
      const result = await ClinicalNote.findOneAndUpdate(
        {
          _id: clinicalNoteId,
          workspaceId,
        },
        { locationId },
        { new: true }
      );

      if (!result) {
        throw new Error('Clinical note not found or access denied');
      }

      logger.info(
        `Clinical note ${clinicalNoteId} assigned to location ${locationId}`
      );
      return true;
    } catch (error) {
      logger.error('Error assigning clinical note to location:', error);
      throw error;
    }
  }

  /**
   * Get shared patients (not assigned to any location)
   */
  async getSharedPatients(
    workspaceId: mongoose.Types.ObjectId
  ): Promise<any[]> {
    try {
      const filter = {
        workspaceId,
        isDeleted: { $ne: true },
        $or: [{ locationId: { $exists: false } }, { locationId: null }],
      };

      const patients = await Patient.find(filter)
        .select('_id firstName lastName mrn createdAt')
        .sort({ createdAt: -1 })
        .lean();

      return patients;
    } catch (error) {
      logger.error('Error getting shared patients:', error);
      throw error;
    }
  }

  /**
   * Validate location access for user
   */
  validateLocationAccess(
    requestedLocationId: string,
    userLocationAccess: string[],
    allowSharedAccess: boolean = true
  ): boolean {
    // If no specific location requested, allow access
    if (!requestedLocationId) {
      return allowSharedAccess;
    }

    // Check if user has access to the requested location
    return userLocationAccess.includes(requestedLocationId);
  }

  /**
   * Get location distribution summary
   */
  async getLocationDistributionSummary(
    workspaceId: mongoose.Types.ObjectId
  ): Promise<{
    totalPatients: number;
    locationDistribution: {
      locationId: string;
      count: number;
      percentage: number;
    }[];
    sharedPatients: number;
  }> {
    try {
      // Get total patients
      const totalPatients = await Patient.countDocuments({
        workspaceId,
        isDeleted: { $ne: true },
      });

      // Get distribution by location
      const distribution = await Patient.aggregate([
        {
          $match: {
            workspaceId,
            isDeleted: { $ne: true },
          },
        },
        {
          $group: {
            _id: '$locationId',
            count: { $sum: 1 },
          },
        },
      ]);

      const locationDistribution = distribution
        .filter((item) => item._id) // Exclude null/undefined locationIds
        .map((item) => ({
          locationId: item._id,
          count: item.count,
          percentage:
            totalPatients > 0
              ? Math.round((item.count / totalPatients) * 100)
              : 0,
        }));

      const sharedPatients = distribution.find((item) => !item._id)?.count || 0;

      return {
        totalPatients,
        locationDistribution,
        sharedPatients,
      };
    } catch (error) {
      logger.error('Error getting location distribution summary:', error);
      throw error;
    }
  }
}

export default new LocationFilterService();
