import mongoose from 'mongoose';
import Patient from '../models/Patient';
import PatientUser from '../models/PatientUser';
import logger from '../utils/logger';

export class PatientSyncService {
  /**
   * Create or link a Patient record when a PatientUser is approved
   */
  static async createOrLinkPatientRecord(patientUserId: string): Promise<{ patient: any; isNewRecord: boolean }> {
    try {
      const patientUser = await PatientUser.findById(patientUserId);
      if (!patientUser) {
        throw new Error('PatientUser not found');
      }

      // If already linked, return existing patient
      if (patientUser.patientId) {
        const existingPatient = await Patient.findById(patientUser.patientId);
        if (existingPatient && !existingPatient.isDeleted) {
          logger.info(`PatientUser ${patientUserId} already linked to Patient ${patientUser.patientId}`);
          return { patient: existingPatient, isNewRecord: false };
        } else {
          // Linked patient was deleted or doesn't exist, clear the link
          patientUser.patientId = undefined;
          await patientUser.save();
        }
      }

      // Check if a Patient record already exists with the same email or phone
      let existingPatient = null;
      
      // First try to find by email
      if (patientUser.email) {
        existingPatient = await Patient.findOne({
          workplaceId: patientUser.workplaceId,
          email: patientUser.email,
          isDeleted: false,
        });
      }

      // If not found by email, try by phone
      if (!existingPatient && patientUser.phone) {
        existingPatient = await Patient.findOne({
          workplaceId: patientUser.workplaceId,
          phone: patientUser.phone,
          isDeleted: false,
        });
      }

      // If not found by email/phone, try by name combination (fuzzy match)
      if (!existingPatient) {
        existingPatient = await Patient.findOne({
          workplaceId: patientUser.workplaceId,
          firstName: { $regex: new RegExp(`^${patientUser.firstName}$`, 'i') },
          lastName: { $regex: new RegExp(`^${patientUser.lastName}$`, 'i') },
          isDeleted: false,
        });
      }

      if (existingPatient) {
        // Link existing Patient record to PatientUser
        patientUser.patientId = existingPatient._id;
        await patientUser.save();

        // Update existing patient with any missing information from PatientUser
        await this.syncPatientUserToPatient(patientUser, existingPatient);

        logger.info(`Linked existing Patient record ${existingPatient._id} to PatientUser ${patientUserId}`);
        return { patient: existingPatient, isNewRecord: false };
      } else {
        // Create new Patient record
        const newPatient = await this.createPatientFromPatientUser(patientUser);
        
        // Link the new Patient record to PatientUser
        patientUser.patientId = newPatient._id;
        await patientUser.save();

        logger.info(`Created new Patient record ${newPatient._id} for PatientUser ${patientUserId}`);
        return { patient: newPatient, isNewRecord: true };
      }
    } catch (error) {
      logger.error('Error creating or linking patient record:', {
        error: error.message,
        patientUserId,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Create a new Patient record from PatientUser data
   */
  static async createPatientFromPatientUser(patientUser: any): Promise<any> {
    try {
      // Get workplace to get the invite code for MRN generation
      const Workplace = mongoose.model('Workplace');
      const workplace = await Workplace.findById(patientUser.workplaceId);
      if (!workplace) {
        throw new Error('Workplace not found');
      }

      // Generate MRN for the new patient using the static method
      const mrn = await Patient.generateNextMRN(patientUser.workplaceId, workplace.inviteCode);

      const patientData = {
        workplaceId: patientUser.workplaceId,
        mrn,
        firstName: patientUser.firstName,
        lastName: patientUser.lastName,
        email: patientUser.email,
        phone: patientUser.phone,
        dob: patientUser.dateOfBirth,
        
        // Initialize empty arrays for patient portal fields
        allergies: [],
        chronicConditions: [],
        enhancedEmergencyContacts: [],
        patientLoggedVitals: [],
        
        // Initialize insurance info as empty object
        insuranceInfo: {
          isActive: false,
        },

        // Initialize notification preferences from PatientUser
        notificationPreferences: {
          email: patientUser.notificationPreferences?.email ?? true,
          sms: patientUser.notificationPreferences?.sms ?? true,
          push: patientUser.notificationPreferences?.push ?? true,
          resultNotifications: patientUser.notificationPreferences?.appointmentReminders ?? true,
          orderReminders: patientUser.notificationPreferences?.medicationReminders ?? true,
        },

        // Initialize appointment preferences
        appointmentPreferences: {
          preferredDays: [], // Will be set by patient later
          preferredTimeSlots: [],
          reminderPreferences: {
            email: patientUser.notificationPreferences?.email ?? true,
            sms: patientUser.notificationPreferences?.sms ?? true,
            push: patientUser.notificationPreferences?.push ?? true,
            whatsapp: patientUser.notificationPreferences?.whatsapp ?? false,
          },
          language: patientUser.language || 'en',
          timezone: patientUser.timezone || 'Africa/Lagos',
        },

        // Initialize engagement metrics
        engagementMetrics: {
          totalAppointments: 0,
          completedAppointments: 0,
          cancelledAppointments: 0,
          noShowAppointments: 0,
          completionRate: 0,
          totalFollowUps: 0,
          completedFollowUps: 0,
          overdueFollowUps: 0,
          followUpCompletionRate: 0,
          averageResponseTime: 0,
          engagementScore: 0,
          lastUpdated: new Date(),
        },

        // Audit fields
        createdBy: patientUser._id, // Created by the patient user themselves
        isDeleted: false,
      };

      const patient = new Patient(patientData);
      await patient.save();

      return patient;
    } catch (error) {
      logger.error('Error creating patient from patient user:', error);
      throw error;
    }
  }

  /**
   * Sync PatientUser profile updates to linked Patient record
   */
  static async syncPatientUserToPatient(patientUser: any, patient?: any): Promise<void> {
    try {
      // If patient not provided, find it using patientId
      if (!patient && patientUser.patientId) {
        patient = await Patient.findById(patientUser.patientId);
      }

      if (!patient) {
        logger.warn(`No linked Patient record found for PatientUser ${patientUser._id}`);
        return;
      }

      // Track if any changes were made
      let hasChanges = false;

      // Sync basic profile fields
      const fieldsToSync = [
        { patientUserField: 'firstName', patientField: 'firstName' },
        { patientUserField: 'lastName', patientField: 'lastName' },
        { patientUserField: 'email', patientField: 'email' },
        { patientUserField: 'phone', patientField: 'phone' },
        { patientUserField: 'dateOfBirth', patientField: 'dob' },
      ];

      for (const { patientUserField, patientField } of fieldsToSync) {
        if (patientUser[patientUserField] !== undefined && 
            patientUser[patientUserField] !== patient[patientField]) {
          patient[patientField] = patientUser[patientUserField];
          hasChanges = true;
        }
      }

      // Sync notification preferences
      if (patientUser.notificationPreferences) {
        if (!patient.notificationPreferences) {
          patient.notificationPreferences = {};
        }

        const notificationFields = ['email', 'sms', 'push'];
        for (const field of notificationFields) {
          if (patientUser.notificationPreferences[field] !== undefined &&
              patientUser.notificationPreferences[field] !== patient.notificationPreferences[field]) {
            patient.notificationPreferences[field] = patientUser.notificationPreferences[field];
            hasChanges = true;
          }
        }

        // Map specific PatientUser notification preferences to Patient fields
        if (patientUser.notificationPreferences.appointmentReminders !== undefined &&
            patientUser.notificationPreferences.appointmentReminders !== patient.notificationPreferences?.resultNotifications) {
          patient.notificationPreferences.resultNotifications = patientUser.notificationPreferences.appointmentReminders;
          hasChanges = true;
        }

        if (patientUser.notificationPreferences.medicationReminders !== undefined &&
            patientUser.notificationPreferences.medicationReminders !== patient.notificationPreferences?.orderReminders) {
          patient.notificationPreferences.orderReminders = patientUser.notificationPreferences.medicationReminders;
          hasChanges = true;
        }
      }

      // Sync appointment preferences
      if (patientUser.language || patientUser.timezone) {
        if (!patient.appointmentPreferences) {
          patient.appointmentPreferences = {
            preferredDays: [],
            preferredTimeSlots: [],
            reminderPreferences: {
              email: true,
              sms: true,
              push: true,
              whatsapp: false,
            },
            language: 'en',
            timezone: 'Africa/Lagos',
          };
        }

        if (patientUser.language && patientUser.language !== patient.appointmentPreferences.language) {
          patient.appointmentPreferences.language = patientUser.language;
          hasChanges = true;
        }

        if (patientUser.timezone && patientUser.timezone !== patient.appointmentPreferences.timezone) {
          patient.appointmentPreferences.timezone = patientUser.timezone;
          hasChanges = true;
        }

        // Sync reminder preferences from PatientUser notification preferences
        if (patientUser.notificationPreferences) {
          const reminderFields = ['email', 'sms', 'push', 'whatsapp'];
          for (const field of reminderFields) {
            if (patientUser.notificationPreferences[field] !== undefined &&
                patientUser.notificationPreferences[field] !== patient.appointmentPreferences.reminderPreferences[field]) {
              patient.appointmentPreferences.reminderPreferences[field] = patientUser.notificationPreferences[field];
              hasChanges = true;
            }
          }
        }
      }

      // Update the updatedBy field to track who made the changes
      if (hasChanges) {
        patient.updatedBy = patientUser._id;
        await patient.save();
        logger.info(`Synced PatientUser ${patientUser._id} profile to Patient ${patient._id}`);
      }
    } catch (error) {
      logger.error('Error syncing PatientUser to Patient:', error);
      throw error;
    }
  }

  /**
   * Handle PatientUser profile updates and sync to Patient record
   */
  static async handlePatientUserProfileUpdate(patientUserId: string, updateData: any): Promise<void> {
    try {
      const patientUser = await PatientUser.findById(patientUserId);
      if (!patientUser) {
        throw new Error('PatientUser not found');
      }

      // Update PatientUser with new data
      Object.assign(patientUser, updateData);
      await patientUser.save();

      // Sync changes to linked Patient record if it exists
      if (patientUser.patientId) {
        await this.syncPatientUserToPatient(patientUser);
      }
    } catch (error) {
      logger.error('Error handling PatientUser profile update:', error);
      throw error;
    }
  }

  /**
   * Get Patient record for a PatientUser
   */
  static async getPatientRecordForUser(patientUserId: string): Promise<any | null> {
    try {
      const patientUser = await PatientUser.findById(patientUserId);
      if (!patientUser || !patientUser.patientId) {
        return null;
      }

      const patient = await Patient.findById(patientUser.patientId);
      return patient;
    } catch (error) {
      logger.error('Error getting patient record for user:', error);
      throw error;
    }
  }

  /**
   * Manually link a PatientUser to an existing Patient record
   * Used by admins when automatic linking fails
   */
  static async manuallyLinkPatientRecord(
    patientUserId: string, 
    patientId: string,
    linkedBy: string
  ): Promise<{ patient: any; previouslyLinked: boolean }> {
    try {
      const patientUser = await PatientUser.findById(patientUserId);
      if (!patientUser) {
        throw new Error('PatientUser not found');
      }

      const patient = await Patient.findById(patientId);
      if (!patient || patient.isDeleted) {
        throw new Error('Patient record not found or deleted');
      }

      // Verify they belong to the same workplace
      if (!patientUser.workplaceId.equals(patient.workplaceId)) {
        throw new Error('PatientUser and Patient must belong to the same workplace');
      }

      const previouslyLinked = !!patientUser.patientId;

      // Update the link
      patientUser.patientId = patient._id;
      await patientUser.save();

      // Sync PatientUser data to Patient record
      await this.syncPatientUserToPatient(patientUser, patient);

      logger.info(`Manually linked Patient record ${patientId} to PatientUser ${patientUserId}`, {
        linkedBy,
        previouslyLinked,
        workplaceId: patientUser.workplaceId
      });

      return { patient, previouslyLinked };
    } catch (error) {
      logger.error('Error manually linking patient record:', {
        error: error.message,
        patientUserId,
        patientId,
        linkedBy,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Find potential Patient matches for a PatientUser
   * Used by admins to identify possible linking candidates
   */
  static async findPotentialPatientMatches(patientUserId: string): Promise<any[]> {
    try {
      const patientUser = await PatientUser.findById(patientUserId);
      if (!patientUser) {
        throw new Error('PatientUser not found');
      }

      const potentialMatches = [];

      // Find by email
      if (patientUser.email) {
        const emailMatches = await Patient.find({
          workplaceId: patientUser.workplaceId,
          email: patientUser.email,
          isDeleted: false,
        }).select('_id firstName lastName email phone mrn createdAt').lean();
        
        potentialMatches.push(...emailMatches.map(match => ({
          ...match,
          matchType: 'email',
          confidence: 'high'
        })));
      }

      // Find by phone
      if (patientUser.phone) {
        const phoneMatches = await Patient.find({
          workplaceId: patientUser.workplaceId,
          phone: patientUser.phone,
          isDeleted: false,
        }).select('_id firstName lastName email phone mrn createdAt').lean();
        
        potentialMatches.push(...phoneMatches.map(match => ({
          ...match,
          matchType: 'phone',
          confidence: 'high'
        })));
      }

      // Find by name (fuzzy match)
      const nameMatches = await Patient.find({
        workplaceId: patientUser.workplaceId,
        firstName: { $regex: new RegExp(`^${patientUser.firstName}$`, 'i') },
        lastName: { $regex: new RegExp(`^${patientUser.lastName}$`, 'i') },
        isDeleted: false,
      }).select('_id firstName lastName email phone mrn createdAt').lean();
      
      potentialMatches.push(...nameMatches.map(match => ({
        ...match,
        matchType: 'name',
        confidence: 'medium'
      })));

      // Remove duplicates and sort by confidence
      const uniqueMatches = potentialMatches.filter((match, index, self) => 
        index === self.findIndex(m => m._id.toString() === match._id.toString())
      );

      return uniqueMatches.sort((a, b) => {
        const confidenceOrder = { high: 3, medium: 2, low: 1 };
        return confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
      });
    } catch (error) {
      logger.error('Error finding potential patient matches:', {
        error: error.message,
        patientUserId,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Retry automatic linking for PatientUsers without linked Patient records
   * Used for batch processing of unlinked accounts
   */
  static async retryAutomaticLinking(workplaceId: string): Promise<{
    processed: number;
    linked: number;
    created: number;
    failed: string[];
  }> {
    try {
      const unlinkedPatientUsers = await PatientUser.find({
        workplaceId,
        status: 'active',
        patientId: { $exists: false },
        isDeleted: false,
      });

      const results = {
        processed: unlinkedPatientUsers.length,
        linked: 0,
        created: 0,
        failed: [] as string[]
      };

      for (const patientUser of unlinkedPatientUsers) {
        try {
          const { patient, isNewRecord } = await this.createOrLinkPatientRecord(patientUser._id.toString());
          
          if (isNewRecord) {
            results.created++;
          } else {
            results.linked++;
          }
          
          logger.info(`Retry linking successful for PatientUser ${patientUser._id}`, {
            patientId: patient._id,
            isNewRecord
          });
        } catch (error) {
          results.failed.push(patientUser._id.toString());
          logger.error(`Retry linking failed for PatientUser ${patientUser._id}:`, error.message);
        }
      }

      logger.info('Batch retry linking completed:', {
        workplaceId,
        ...results
      });

      return results;
    } catch (error) {
      logger.error('Error in batch retry linking:', {
        error: error.message,
        workplaceId,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Unlink Patient record when PatientUser is deleted or deactivated
   */
  static async unlinkPatientRecord(patientUserId: string): Promise<void> {
    try {
      const patientUser = await PatientUser.findById(patientUserId);
      if (patientUser && patientUser.patientId) {
        // Note: We don't delete the Patient record, just unlink it
        // The Patient record may have clinical data that should be preserved
        patientUser.patientId = undefined;
        await patientUser.save();
        
        logger.info(`Unlinked Patient record from PatientUser ${patientUserId}`);
      }
    } catch (error) {
      logger.error('Error unlinking patient record:', error);
      throw error;
    }
  }
}