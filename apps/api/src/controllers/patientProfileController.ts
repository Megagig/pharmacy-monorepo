import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { PatientPortalRequest } from '../middlewares/patientPortalAuth';
import { PatientProfileService } from '../services/PatientProfileService';
import logger from '../utils/logger';

/**
 * Controller for patient profile management
 * Handles profile CRUD operations, allergies, conditions, contacts, insurance, and vitals
 */
export class PatientProfileController {
  /**
   * Get patient profile
   * GET /api/patient-portal/profile
   */
  static async getProfile(req: PatientPortalRequest, res: Response): Promise<void> {
    try {
      const patientUserId = req.patientUser?._id.toString();
      const workplaceId = req.workplaceId?.toString();

      if (!patientUserId || !workplaceId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED',
        });
        return;
      }

      const profile = await PatientProfileService.getPatientProfile(
        patientUserId,
        workplaceId
      );

      if (!profile) {
        res.status(404).json({
          success: false,
          message: 'Patient profile not found. Please contact the pharmacy to link your account.',
          code: 'PROFILE_NOT_FOUND',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Profile retrieved successfully',
        data: {
          profile: {
            // Demographics
            _id: profile._id,
            mrn: profile.mrn,
            firstName: profile.firstName,
            lastName: profile.lastName,
            otherNames: profile.otherNames,
            dob: profile.dob,
            age: profile.getAge(),
            gender: profile.gender,
            phone: profile.phone,
            email: profile.email,
            address: profile.address,
            state: profile.state,
            lga: profile.lga,
            maritalStatus: profile.maritalStatus,
            bloodGroup: profile.bloodGroup,
            genotype: profile.genotype,
            weightKg: profile.weightKg,

            // Enhanced fields
            allergies: profile.allergies,
            chronicConditions: profile.chronicConditions,
            emergencyContacts: profile.enhancedEmergencyContacts,
            insuranceInfo: profile.insuranceInfo,

            // Preferences
            notificationPreferences: profile.notificationPreferences,
            appointmentPreferences: profile.appointmentPreferences,

            // Metadata
            createdAt: profile.createdAt,
            updatedAt: profile.updatedAt,
          },
        },
      });
    } catch (error) {
      logger.error('Error getting patient profile', {
        error: error instanceof Error ? error.message : 'Unknown error',
        patientUserId: req.patientUser?._id.toString(),
        workplaceId: req.workplaceId,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve profile',
        code: 'PROFILE_RETRIEVAL_ERROR',
      });
    }
  }

  /**
   * Update patient profile
   * PUT /api/patient-portal/profile
   */
  static async updateProfile(req: PatientPortalRequest, res: Response): Promise<void> {
    try {
      const patientUserId = req.patientUser?._id.toString();
      const workplaceId = req.workplaceId?.toString();

      if (!patientUserId || !workplaceId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED',
        });
        return;
      }

      const updateData = req.body;

      // Remove fields that shouldn't be updated directly
      delete updateData._id;
      delete updateData.mrn;
      delete updateData.workplaceId;
      delete updateData.createdAt;
      delete updateData.updatedAt;
      delete updateData.createdBy;
      delete updateData.isDeleted;

      const updatedProfile = await PatientProfileService.updatePatientProfile(
        patientUserId,
        workplaceId,
        updateData
      );

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          profile: {
            _id: updatedProfile._id,
            firstName: updatedProfile.firstName,
            lastName: updatedProfile.lastName,
            otherNames: updatedProfile.otherNames,
            dob: updatedProfile.dob,
            age: updatedProfile.getAge(),
            gender: updatedProfile.gender,
            phone: updatedProfile.phone,
            email: updatedProfile.email,
            address: updatedProfile.address,
            state: updatedProfile.state,
            lga: updatedProfile.lga,
            maritalStatus: updatedProfile.maritalStatus,
            bloodGroup: updatedProfile.bloodGroup,
            genotype: updatedProfile.genotype,
            weightKg: updatedProfile.weightKg,
            notificationPreferences: updatedProfile.notificationPreferences,
            appointmentPreferences: updatedProfile.appointmentPreferences,
            updatedAt: updatedProfile.updatedAt,
          },
        },
      });
    } catch (error) {
      logger.error('Error updating patient profile', {
        error: error instanceof Error ? error.message : 'Unknown error',
        patientUserId: req.patientUser?._id.toString(),
        workplaceId: req.workplaceId,
        updateData: req.body,
      });

      if (error instanceof Error && error.message.includes('validation')) {
        res.status(400).json({
          success: false,
          message: error.message,
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Failed to update profile',
        code: 'PROFILE_UPDATE_ERROR',
      });
    }
  }

  /**
   * Add allergy
   * POST /api/patient-portal/profile/allergies
   */
  static async addAllergy(req: PatientPortalRequest, res: Response): Promise<void> {
    try {
      const patientUserId = req.patientUser?._id.toString();
      const workplaceId = req.workplaceId?.toString();

      if (!patientUserId || !workplaceId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED',
        });
        return;
      }

      const { allergen, reaction, severity, notes } = req.body;

      if (!allergen || !reaction || !severity) {
        res.status(400).json({
          success: false,
          message: 'Allergen, reaction, and severity are required',
          code: 'MISSING_REQUIRED_FIELDS',
        });
        return;
      }

      const updatedProfile = await PatientProfileService.addAllergy(
        patientUserId,
        workplaceId,
        { allergen, reaction, severity, notes }
      );

      const addedAllergy = updatedProfile.allergies[updatedProfile.allergies.length - 1];

      res.status(201).json({
        success: true,
        message: 'Allergy added successfully',
        data: {
          allergy: addedAllergy,
        },
      });
    } catch (error) {
      logger.error('Error adding allergy', {
        error: error instanceof Error ? error.message : 'Unknown error',
        patientUserId: req.patientUser?._id.toString(),
        workplaceId: req.workplaceId,
        allergyData: req.body,
      });

      if (error instanceof Error && error.message.includes('already exists')) {
        res.status(409).json({
          success: false,
          message: error.message,
          code: 'DUPLICATE_ALLERGY',
        });
        return;
      }

      if (error instanceof Error && error.message.includes('validation')) {
        res.status(400).json({
          success: false,
          message: error.message,
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Failed to add allergy',
        code: 'ALLERGY_ADD_ERROR',
      });
    }
  }

  /**
   * Update allergy
   * PUT /api/patient-portal/profile/allergies/:allergyId
   */
  static async updateAllergy(req: PatientPortalRequest, res: Response): Promise<void> {
    try {
      const patientUserId = req.patientUser?._id.toString();
      const workplaceId = req.workplaceId?.toString();
      const { allergyId } = req.params;

      if (!patientUserId || !workplaceId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED',
        });
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(allergyId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid allergy ID',
          code: 'INVALID_ALLERGY_ID',
        });
        return;
      }

      const updates = req.body;
      delete updates._id; // Prevent ID updates

      const updatedProfile = await PatientProfileService.updateAllergy(
        patientUserId,
        workplaceId,
        allergyId,
        updates
      );

      const updatedAllergy = updatedProfile.allergies.find(
        allergy => allergy._id?.toString() === allergyId
      );

      res.status(200).json({
        success: true,
        message: 'Allergy updated successfully',
        data: {
          allergy: updatedAllergy,
        },
      });
    } catch (error) {
      logger.error('Error updating allergy', {
        error: error instanceof Error ? error.message : 'Unknown error',
        patientUserId: req.patientUser?._id.toString(),
        workplaceId: req.workplaceId,
        allergyId: req.params.allergyId,
        updates: req.body,
      });

      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: error.message,
          code: 'ALLERGY_NOT_FOUND',
        });
        return;
      }

      if (error instanceof Error && error.message.includes('validation')) {
        res.status(400).json({
          success: false,
          message: error.message,
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Failed to update allergy',
        code: 'ALLERGY_UPDATE_ERROR',
      });
    }
  }

  /**
   * Remove allergy
   * DELETE /api/patient-portal/profile/allergies/:allergyId
   */
  static async removeAllergy(req: PatientPortalRequest, res: Response): Promise<void> {
    try {
      const patientUserId = req.patientUser?._id.toString();
      const workplaceId = req.workplaceId?.toString();
      const { allergyId } = req.params;

      if (!patientUserId || !workplaceId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED',
        });
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(allergyId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid allergy ID',
          code: 'INVALID_ALLERGY_ID',
        });
        return;
      }

      await PatientProfileService.removeAllergy(
        patientUserId,
        workplaceId,
        allergyId
      );

      res.status(200).json({
        success: true,
        message: 'Allergy removed successfully',
      });
    } catch (error) {
      logger.error('Error removing allergy', {
        error: error instanceof Error ? error.message : 'Unknown error',
        patientUserId: req.patientUser?._id.toString(),
        workplaceId: req.workplaceId,
        allergyId: req.params.allergyId,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to remove allergy',
        code: 'ALLERGY_REMOVE_ERROR',
      });
    }
  }

  /**
   * Add chronic condition
   * POST /api/patient-portal/profile/conditions
   */
  static async addChronicCondition(req: PatientPortalRequest, res: Response): Promise<void> {
    try {
      const patientUserId = req.patientUser?._id.toString();
      const workplaceId = req.workplaceId?.toString();

      if (!patientUserId || !workplaceId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED',
        });
        return;
      }

      const { condition, diagnosedDate, managementPlan, status, notes } = req.body;

      if (!condition || !diagnosedDate) {
        res.status(400).json({
          success: false,
          message: 'Condition name and diagnosed date are required',
          code: 'MISSING_REQUIRED_FIELDS',
        });
        return;
      }

      const updatedProfile = await PatientProfileService.addChronicCondition(
        patientUserId,
        workplaceId,
        { condition, diagnosedDate: new Date(diagnosedDate), managementPlan, status, notes }
      );

      const addedCondition = updatedProfile.chronicConditions[updatedProfile.chronicConditions.length - 1];

      res.status(201).json({
        success: true,
        message: 'Chronic condition added successfully',
        data: {
          condition: addedCondition,
        },
      });
    } catch (error) {
      logger.error('Error adding chronic condition', {
        error: error instanceof Error ? error.message : 'Unknown error',
        patientUserId: req.patientUser?._id.toString(),
        workplaceId: req.workplaceId,
        conditionData: req.body,
      });

      if (error instanceof Error && error.message.includes('already exists')) {
        res.status(409).json({
          success: false,
          message: error.message,
          code: 'DUPLICATE_CONDITION',
        });
        return;
      }

      if (error instanceof Error && error.message.includes('validation')) {
        res.status(400).json({
          success: false,
          message: error.message,
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Failed to add chronic condition',
        code: 'CONDITION_ADD_ERROR',
      });
    }
  }

  /**
   * Update chronic condition
   * PUT /api/patient-portal/profile/conditions/:conditionId
   */
  static async updateChronicCondition(req: PatientPortalRequest, res: Response): Promise<void> {
    try {
      const patientUserId = req.patientUser?._id.toString();
      const workplaceId = req.workplaceId?.toString();
      const { conditionId } = req.params;

      if (!patientUserId || !workplaceId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED',
        });
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(conditionId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid condition ID',
          code: 'INVALID_CONDITION_ID',
        });
        return;
      }

      const updates = req.body;
      delete updates._id; // Prevent ID updates

      // Convert diagnosedDate to Date if provided
      if (updates.diagnosedDate) {
        updates.diagnosedDate = new Date(updates.diagnosedDate);
      }

      const updatedProfile = await PatientProfileService.updateChronicCondition(
        patientUserId,
        workplaceId,
        conditionId,
        updates
      );

      const updatedCondition = updatedProfile.chronicConditions.find(
        condition => condition._id?.toString() === conditionId
      );

      res.status(200).json({
        success: true,
        message: 'Chronic condition updated successfully',
        data: {
          condition: updatedCondition,
        },
      });
    } catch (error) {
      logger.error('Error updating chronic condition', {
        error: error instanceof Error ? error.message : 'Unknown error',
        patientUserId: req.patientUser?._id.toString(),
        workplaceId: req.workplaceId,
        conditionId: req.params.conditionId,
        updates: req.body,
      });

      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: error.message,
          code: 'CONDITION_NOT_FOUND',
        });
        return;
      }

      if (error instanceof Error && error.message.includes('validation')) {
        res.status(400).json({
          success: false,
          message: error.message,
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Failed to update chronic condition',
        code: 'CONDITION_UPDATE_ERROR',
      });
    }
  }

  /**
   * Remove chronic condition
   * DELETE /api/patient-portal/profile/conditions/:conditionId
   */
  static async removeChronicCondition(req: PatientPortalRequest, res: Response): Promise<void> {
    try {
      const patientUserId = req.patientUser?._id.toString();
      const workplaceId = req.workplaceId?.toString();
      const { conditionId } = req.params;

      if (!patientUserId || !workplaceId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED',
        });
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(conditionId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid condition ID',
          code: 'INVALID_CONDITION_ID',
        });
        return;
      }

      await PatientProfileService.removeChronicCondition(
        patientUserId,
        workplaceId,
        conditionId
      );

      res.status(200).json({
        success: true,
        message: 'Chronic condition removed successfully',
      });
    } catch (error) {
      logger.error('Error removing chronic condition', {
        error: error instanceof Error ? error.message : 'Unknown error',
        patientUserId: req.patientUser?._id.toString(),
        workplaceId: req.workplaceId,
        conditionId: req.params.conditionId,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to remove chronic condition',
        code: 'CONDITION_REMOVE_ERROR',
      });
    }
  }

  /**
   * Add emergency contact
   * POST /api/patient-portal/profile/emergency-contacts
   */
  static async addEmergencyContact(req: PatientPortalRequest, res: Response): Promise<void> {
    try {
      const patientUserId = req.patientUser?._id.toString();
      const workplaceId = req.workplaceId?.toString();

      if (!patientUserId || !workplaceId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED',
        });
        return;
      }

      const { name, relationship, phone, email, isPrimary, priority } = req.body;

      if (!name || !relationship || !phone || !priority) {
        res.status(400).json({
          success: false,
          message: 'Name, relationship, phone, and priority are required',
          code: 'MISSING_REQUIRED_FIELDS',
        });
        return;
      }

      const updatedProfile = await PatientProfileService.addEmergencyContact(
        patientUserId,
        workplaceId,
        { name, relationship, phone, email, isPrimary, priority }
      );

      const addedContact = updatedProfile.enhancedEmergencyContacts[updatedProfile.enhancedEmergencyContacts.length - 1];

      res.status(201).json({
        success: true,
        message: 'Emergency contact added successfully',
        data: {
          contact: addedContact,
        },
      });
    } catch (error) {
      logger.error('Error adding emergency contact', {
        error: error instanceof Error ? error.message : 'Unknown error',
        patientUserId: req.patientUser?._id.toString(),
        workplaceId: req.workplaceId,
        contactData: req.body,
      });

      if (error instanceof Error && error.message.includes('validation')) {
        res.status(400).json({
          success: false,
          message: error.message,
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Failed to add emergency contact',
        code: 'CONTACT_ADD_ERROR',
      });
    }
  }

  /**
   * Update emergency contact
   * PUT /api/patient-portal/profile/emergency-contacts/:contactId
   */
  static async updateEmergencyContact(req: PatientPortalRequest, res: Response): Promise<void> {
    try {
      const patientUserId = req.patientUser?._id.toString();
      const workplaceId = req.workplaceId?.toString();
      const { contactId } = req.params;

      if (!patientUserId || !workplaceId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED',
        });
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(contactId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid contact ID',
          code: 'INVALID_CONTACT_ID',
        });
        return;
      }

      const updates = req.body;
      delete updates._id; // Prevent ID updates

      const updatedProfile = await PatientProfileService.updateEmergencyContact(
        patientUserId,
        workplaceId,
        contactId,
        updates
      );

      const updatedContact = updatedProfile.enhancedEmergencyContacts.find(
        contact => contact._id?.toString() === contactId
      );

      res.status(200).json({
        success: true,
        message: 'Emergency contact updated successfully',
        data: {
          contact: updatedContact,
        },
      });
    } catch (error) {
      logger.error('Error updating emergency contact', {
        error: error instanceof Error ? error.message : 'Unknown error',
        patientUserId: req.patientUser?._id.toString(),
        workplaceId: req.workplaceId,
        contactId: req.params.contactId,
        updates: req.body,
      });

      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: error.message,
          code: 'CONTACT_NOT_FOUND',
        });
        return;
      }

      if (error instanceof Error && error.message.includes('validation')) {
        res.status(400).json({
          success: false,
          message: error.message,
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Failed to update emergency contact',
        code: 'CONTACT_UPDATE_ERROR',
      });
    }
  }

  /**
   * Remove emergency contact
   * DELETE /api/patient-portal/profile/emergency-contacts/:contactId
   */
  static async removeEmergencyContact(req: PatientPortalRequest, res: Response): Promise<void> {
    try {
      const patientUserId = req.patientUser?._id.toString();
      const workplaceId = req.workplaceId?.toString();
      const { contactId } = req.params;

      if (!patientUserId || !workplaceId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED',
        });
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(contactId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid contact ID',
          code: 'INVALID_CONTACT_ID',
        });
        return;
      }

      await PatientProfileService.removeEmergencyContact(
        patientUserId,
        workplaceId,
        contactId
      );

      res.status(200).json({
        success: true,
        message: 'Emergency contact removed successfully',
      });
    } catch (error) {
      logger.error('Error removing emergency contact', {
        error: error instanceof Error ? error.message : 'Unknown error',
        patientUserId: req.patientUser?._id.toString(),
        workplaceId: req.workplaceId,
        contactId: req.params.contactId,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to remove emergency contact',
        code: 'CONTACT_REMOVE_ERROR',
      });
    }
  }

  /**
   * Update insurance information
   * PUT /api/patient-portal/profile/insurance
   */
  static async updateInsuranceInfo(req: PatientPortalRequest, res: Response): Promise<void> {
    try {
      const patientUserId = req.patientUser?._id.toString();
      const workplaceId = req.workplaceId?.toString();

      if (!patientUserId || !workplaceId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED',
        });
        return;
      }

      const insuranceData = req.body;

      // Convert expiryDate to Date if provided
      if (insuranceData.expiryDate) {
        insuranceData.expiryDate = new Date(insuranceData.expiryDate);
      }

      const updatedProfile = await PatientProfileService.updateInsuranceInfo(
        patientUserId,
        workplaceId,
        insuranceData
      );

      res.status(200).json({
        success: true,
        message: 'Insurance information updated successfully',
        data: {
          insuranceInfo: updatedProfile.insuranceInfo,
        },
      });
    } catch (error) {
      logger.error('Error updating insurance information', {
        error: error instanceof Error ? error.message : 'Unknown error',
        patientUserId: req.patientUser?._id.toString(),
        workplaceId: req.workplaceId,
        insuranceData: req.body,
      });

      if (error instanceof Error && error.message.includes('validation')) {
        res.status(400).json({
          success: false,
          message: error.message,
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Failed to update insurance information',
        code: 'INSURANCE_UPDATE_ERROR',
      });
    }
  }

  /**
   * Log vitals
   * POST /api/patient-portal/profile/vitals
   */
  static async logVitals(req: PatientPortalRequest, res: Response): Promise<void> {
    try {
      const patientUserId = req.patientUser?._id.toString();
      const workplaceId = req.workplaceId?.toString();

      if (!patientUserId || !workplaceId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED',
        });
        return;
      }

      const vitalsData = req.body;

      const updatedProfile = await PatientProfileService.logVitals(
        patientUserId,
        workplaceId,
        vitalsData
      );

      const loggedVitals = updatedProfile.patientLoggedVitals[updatedProfile.patientLoggedVitals.length - 1];

      res.status(201).json({
        success: true,
        message: 'Vitals logged successfully',
        data: {
          vitals: loggedVitals,
        },
      });
    } catch (error) {
      logger.error('Error logging vitals', {
        error: error instanceof Error ? error.message : 'Unknown error',
        patientUserId: req.patientUser?._id.toString(),
        workplaceId: req.workplaceId,
        vitalsData: req.body,
      });

      if (error instanceof Error && error.message.includes('validation')) {
        res.status(400).json({
          success: false,
          message: error.message,
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Failed to log vitals',
        code: 'VITALS_LOG_ERROR',
      });
    }
  }

  /**
   * Get vitals history
   * GET /api/patient-portal/profile/vitals
   */
  static async getVitalsHistory(req: PatientPortalRequest, res: Response): Promise<void> {
    try {
      const patientUserId = req.patientUser?._id.toString();
      const workplaceId = req.workplaceId?.toString();

      if (!patientUserId || !workplaceId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED',
        });
        return;
      }

      const limit = parseInt(req.query.limit as string) || 50;

      const vitalsHistory = await PatientProfileService.getVitalsHistory(
        patientUserId,
        workplaceId,
        limit
      );

      res.status(200).json({
        success: true,
        message: 'Vitals history retrieved successfully',
        data: {
          vitals: vitalsHistory,
          count: vitalsHistory.length,
        },
      });
    } catch (error) {
      logger.error('Error getting vitals history', {
        error: error instanceof Error ? error.message : 'Unknown error',
        patientUserId: req.patientUser?._id.toString(),
        workplaceId: req.workplaceId,
        limit: req.query.limit,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve vitals history',
        code: 'VITALS_HISTORY_ERROR',
      });
    }
  }

  /**
   * Get latest vitals
   * GET /api/patient-portal/profile/vitals/latest
   */
  static async getLatestVitals(req: PatientPortalRequest, res: Response): Promise<void> {
    try {
      const patientUserId = req.patientUser?._id.toString();
      const workplaceId = req.workplaceId?.toString();

      if (!patientUserId || !workplaceId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED',
        });
        return;
      }

      const latestVitals = await PatientProfileService.getLatestVitals(
        patientUserId,
        workplaceId
      );

      res.status(200).json({
        success: true,
        message: 'Latest vitals retrieved successfully',
        data: {
          vitals: latestVitals,
        },
      });
    } catch (error) {
      logger.error('Error getting latest vitals', {
        error: error instanceof Error ? error.message : 'Unknown error',
        patientUserId: req.patientUser?._id.toString(),
        workplaceId: req.workplaceId,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve latest vitals',
        code: 'LATEST_VITALS_ERROR',
      });
    }
  }
}

export default PatientProfileController;