import mongoose from 'mongoose';
import Patient, { IPatient } from '../models/Patient';
import PatientUser, { IPatientUser } from '../models/PatientUser';
import logger from '../utils/logger';

export interface PatientProfileUpdateData {
  // Demographics
  firstName?: string;
  lastName?: string;
  otherNames?: string;
  dob?: Date;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  phone?: string;
  email?: string;
  address?: string;
  state?: string;
  lga?: string;
  maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed';
  bloodGroup?: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
  genotype?: 'AA' | 'AS' | 'SS' | 'AC' | 'SC' | 'CC';
  weightKg?: number;
  
  // Notification preferences
  notificationPreferences?: {
    email?: boolean;
    sms?: boolean;
    push?: boolean;
    resultNotifications?: boolean;
    orderReminders?: boolean;
  };
  
  // Appointment preferences
  appointmentPreferences?: {
    preferredDays?: number[];
    preferredTimeSlots?: Array<{ start: string; end: string }>;
    preferredPharmacist?: mongoose.Types.ObjectId;
    reminderPreferences?: {
      email?: boolean;
      sms?: boolean;
      push?: boolean;
      whatsapp?: boolean;
    };
    language?: string;
    timezone?: string;
  };
}

export interface AllergyData {
  allergen: string;
  reaction: string;
  severity: 'mild' | 'moderate' | 'severe';
  notes?: string;
}

export interface ChronicConditionData {
  condition: string;
  diagnosedDate: Date;
  managementPlan?: string;
  status?: 'active' | 'managed' | 'resolved';
  notes?: string;
}

export interface EmergencyContactData {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
  isPrimary?: boolean;
  priority: number;
}

export interface InsuranceInfoData {
  provider?: string;
  policyNumber?: string;
  expiryDate?: Date;
  coverageDetails?: string;
  copayAmount?: number;
  isActive?: boolean;
}

export interface VitalsData {
  bloodPressure?: { systolic: number; diastolic: number };
  heartRate?: number;
  temperature?: number;
  weight?: number;
  glucose?: number;
  oxygenSaturation?: number;
  notes?: string;
}

/**
 * Service class for managing patient profile data
 * Handles profile updates, allergies, conditions, contacts, insurance, and vitals
 */
export class PatientProfileService {
  /**
   * Get complete patient profile with all related data
   */
  static async getPatientProfile(
    patientUserId: string,
    workplaceId: string
  ): Promise<IPatient | null> {
    try {
      // First get the PatientUser to find the linked Patient record
      const patientUser = await PatientUser.findOne({
        _id: patientUserId,
        workplaceId,
        isDeleted: false,
      }).select('patientId');

      if (!patientUser || !patientUser.patientId) {
        logger.warn('Patient user not found or not linked to patient record', {
          patientUserId,
          workplaceId,
        });
        return null;
      }

      // Get the full patient profile
      const patient = await Patient.findOne({
        _id: patientUser.patientId,
        workplaceId,
        isDeleted: false,
      })
        .populate('appointmentPreferences.preferredPharmacist', 'firstName lastName')
        .lean();

      if (!patient) {
        logger.warn('Patient record not found', {
          patientId: patientUser.patientId,
          workplaceId,
        });
        return null;
      }

      return patient as IPatient;
    } catch (error) {
      logger.error('Error getting patient profile', {
        error: error instanceof Error ? error.message : 'Unknown error',
        patientUserId,
        workplaceId,
      });
      throw new Error('Failed to retrieve patient profile');
    }
  }

  /**
   * Update patient profile with validation
   */
  static async updatePatientProfile(
    patientUserId: string,
    workplaceId: string,
    updateData: PatientProfileUpdateData,
    updatedBy?: mongoose.Types.ObjectId
  ): Promise<IPatient> {
    try {
      // Get the PatientUser to find the linked Patient record
      const patientUser = await PatientUser.findOne({
        _id: patientUserId,
        workplaceId,
        isDeleted: false,
      }).select('patientId');

      if (!patientUser || !patientUser.patientId) {
        throw new Error('Patient user not found or not linked to patient record');
      }

      // Validate update data
      this.validateProfileUpdateData(updateData);

      // Update the patient record
      const updatedPatient = await Patient.findOneAndUpdate(
        {
          _id: patientUser.patientId,
          workplaceId,
          isDeleted: false,
        },
        {
          ...updateData,
          updatedBy: updatedBy || patientUser._id,
        },
        {
          new: true,
          runValidators: true,
        }
      )
        .populate('appointmentPreferences.preferredPharmacist', 'firstName lastName');

      if (!updatedPatient) {
        throw new Error('Patient record not found or update failed');
      }

      logger.info('Patient profile updated successfully', {
        patientId: updatedPatient._id,
        patientUserId,
        workplaceId,
        updatedFields: Object.keys(updateData),
      });

      return updatedPatient;
    } catch (error) {
      logger.error('Error updating patient profile', {
        error: error instanceof Error ? error.message : 'Unknown error',
        patientUserId,
        workplaceId,
        updateData,
      });
      throw error;
    }
  }

  /**
   * Add allergy to patient record
   */
  static async addAllergy(
    patientUserId: string,
    workplaceId: string,
    allergyData: AllergyData,
    recordedBy?: mongoose.Types.ObjectId
  ): Promise<IPatient> {
    try {
      const patientUser = await PatientUser.findOne({
        _id: patientUserId,
        workplaceId,
        isDeleted: false,
      }).select('patientId');

      if (!patientUser || !patientUser.patientId) {
        throw new Error('Patient user not found or not linked to patient record');
      }

      // Validate allergy data
      this.validateAllergyData(allergyData);

      // Check for duplicate allergen
      const existingPatient = await Patient.findById(patientUser.patientId);
      if (!existingPatient) {
        throw new Error('Patient record not found');
      }

      const duplicateAllergy = existingPatient.allergies.find(
        allergy => allergy.allergen.toLowerCase() === allergyData.allergen.toLowerCase()
      );

      if (duplicateAllergy) {
        throw new Error(`Allergy to ${allergyData.allergen} already exists`);
      }

      // Add the allergy
      const allergyToAdd = {
        ...allergyData,
        recordedDate: new Date(),
        recordedBy: recordedBy || patientUser._id,
      };

      const updatedPatient = await Patient.findOneAndUpdate(
        {
          _id: patientUser.patientId,
          workplaceId,
          isDeleted: false,
        },
        {
          $push: { allergies: allergyToAdd },
          updatedBy: recordedBy || patientUser._id,
        },
        {
          new: true,
          runValidators: true,
        }
      );

      if (!updatedPatient) {
        throw new Error('Failed to add allergy');
      }

      logger.info('Allergy added successfully', {
        patientId: updatedPatient._id,
        patientUserId,
        allergen: allergyData.allergen,
        severity: allergyData.severity,
      });

      return updatedPatient;
    } catch (error) {
      logger.error('Error adding allergy', {
        error: error instanceof Error ? error.message : 'Unknown error',
        patientUserId,
        workplaceId,
        allergyData,
      });
      throw error;
    }
  }

  /**
   * Update existing allergy
   */
  static async updateAllergy(
    patientUserId: string,
    workplaceId: string,
    allergyId: string,
    updates: Partial<AllergyData>
  ): Promise<IPatient> {
    try {
      const patientUser = await PatientUser.findOne({
        _id: patientUserId,
        workplaceId,
        isDeleted: false,
      }).select('patientId');

      if (!patientUser || !patientUser.patientId) {
        throw new Error('Patient user not found or not linked to patient record');
      }

      // Validate update data
      if (updates.allergen || updates.reaction || updates.severity) {
        this.validateAllergyData(updates as AllergyData);
      }

      // Update the specific allergy
      const updatedPatient = await Patient.findOneAndUpdate(
        {
          _id: patientUser.patientId,
          workplaceId,
          'allergies._id': allergyId,
          isDeleted: false,
        },
        {
          $set: {
            'allergies.$.allergen': updates.allergen,
            'allergies.$.reaction': updates.reaction,
            'allergies.$.severity': updates.severity,
            'allergies.$.notes': updates.notes,
          },
          updatedBy: patientUser._id,
        },
        {
          new: true,
          runValidators: true,
        }
      );

      if (!updatedPatient) {
        throw new Error('Allergy not found or update failed');
      }

      logger.info('Allergy updated successfully', {
        patientId: updatedPatient._id,
        patientUserId,
        allergyId,
        updates,
      });

      return updatedPatient;
    } catch (error) {
      logger.error('Error updating allergy', {
        error: error instanceof Error ? error.message : 'Unknown error',
        patientUserId,
        workplaceId,
        allergyId,
        updates,
      });
      throw error;
    }
  }

  /**
   * Remove allergy from patient record
   */
  static async removeAllergy(
    patientUserId: string,
    workplaceId: string,
    allergyId: string
  ): Promise<IPatient> {
    try {
      const patientUser = await PatientUser.findOne({
        _id: patientUserId,
        workplaceId,
        isDeleted: false,
      }).select('patientId');

      if (!patientUser || !patientUser.patientId) {
        throw new Error('Patient user not found or not linked to patient record');
      }

      const updatedPatient = await Patient.findOneAndUpdate(
        {
          _id: patientUser.patientId,
          workplaceId,
          isDeleted: false,
        },
        {
          $pull: { allergies: { _id: allergyId } },
          updatedBy: patientUser._id,
        },
        {
          new: true,
          runValidators: true,
        }
      );

      if (!updatedPatient) {
        throw new Error('Patient not found or allergy removal failed');
      }

      logger.info('Allergy removed successfully', {
        patientId: updatedPatient._id,
        patientUserId,
        allergyId,
      });

      return updatedPatient;
    } catch (error) {
      logger.error('Error removing allergy', {
        error: error instanceof Error ? error.message : 'Unknown error',
        patientUserId,
        workplaceId,
        allergyId,
      });
      throw error;
    }
  }

  /**
   * Add chronic condition to patient record
   */
  static async addChronicCondition(
    patientUserId: string,
    workplaceId: string,
    conditionData: ChronicConditionData,
    recordedBy?: mongoose.Types.ObjectId
  ): Promise<IPatient> {
    try {
      const patientUser = await PatientUser.findOne({
        _id: patientUserId,
        workplaceId,
        isDeleted: false,
      }).select('patientId');

      if (!patientUser || !patientUser.patientId) {
        throw new Error('Patient user not found or not linked to patient record');
      }

      // Validate condition data
      this.validateChronicConditionData(conditionData);

      // Check for duplicate condition
      const existingPatient = await Patient.findById(patientUser.patientId);
      if (!existingPatient) {
        throw new Error('Patient record not found');
      }

      const duplicateCondition = existingPatient.chronicConditions.find(
        condition => condition.condition.toLowerCase() === conditionData.condition.toLowerCase()
      );

      if (duplicateCondition) {
        throw new Error(`Chronic condition ${conditionData.condition} already exists`);
      }

      // Add the condition
      const conditionToAdd = {
        ...conditionData,
        status: conditionData.status || 'active',
        recordedBy: recordedBy || patientUser._id,
      };

      const updatedPatient = await Patient.findOneAndUpdate(
        {
          _id: patientUser.patientId,
          workplaceId,
          isDeleted: false,
        },
        {
          $push: { chronicConditions: conditionToAdd },
          updatedBy: recordedBy || patientUser._id,
        },
        {
          new: true,
          runValidators: true,
        }
      );

      if (!updatedPatient) {
        throw new Error('Failed to add chronic condition');
      }

      logger.info('Chronic condition added successfully', {
        patientId: updatedPatient._id,
        patientUserId,
        condition: conditionData.condition,
        status: conditionData.status,
      });

      return updatedPatient;
    } catch (error) {
      logger.error('Error adding chronic condition', {
        error: error instanceof Error ? error.message : 'Unknown error',
        patientUserId,
        workplaceId,
        conditionData,
      });
      throw error;
    }
  }

  /**
   * Update existing chronic condition
   */
  static async updateChronicCondition(
    patientUserId: string,
    workplaceId: string,
    conditionId: string,
    updates: Partial<ChronicConditionData>
  ): Promise<IPatient> {
    try {
      const patientUser = await PatientUser.findOne({
        _id: patientUserId,
        workplaceId,
        isDeleted: false,
      }).select('patientId');

      if (!patientUser || !patientUser.patientId) {
        throw new Error('Patient user not found or not linked to patient record');
      }

      // Validate update data
      if (updates.condition || updates.diagnosedDate) {
        this.validateChronicConditionData(updates as ChronicConditionData);
      }

      // Build update object
      const updateFields: any = {};
      if (updates.condition) updateFields['chronicConditions.$.condition'] = updates.condition;
      if (updates.diagnosedDate) updateFields['chronicConditions.$.diagnosedDate'] = updates.diagnosedDate;
      if (updates.managementPlan !== undefined) updateFields['chronicConditions.$.managementPlan'] = updates.managementPlan;
      if (updates.status) updateFields['chronicConditions.$.status'] = updates.status;
      if (updates.notes !== undefined) updateFields['chronicConditions.$.notes'] = updates.notes;
      updateFields.updatedBy = patientUser._id;

      const updatedPatient = await Patient.findOneAndUpdate(
        {
          _id: patientUser.patientId,
          workplaceId,
          'chronicConditions._id': conditionId,
          isDeleted: false,
        },
        { $set: updateFields },
        {
          new: true,
          runValidators: true,
        }
      );

      if (!updatedPatient) {
        throw new Error('Chronic condition not found or update failed');
      }

      logger.info('Chronic condition updated successfully', {
        patientId: updatedPatient._id,
        patientUserId,
        conditionId,
        updates,
      });

      return updatedPatient;
    } catch (error) {
      logger.error('Error updating chronic condition', {
        error: error instanceof Error ? error.message : 'Unknown error',
        patientUserId,
        workplaceId,
        conditionId,
        updates,
      });
      throw error;
    }
  }

  /**
   * Remove chronic condition from patient record
   */
  static async removeChronicCondition(
    patientUserId: string,
    workplaceId: string,
    conditionId: string
  ): Promise<IPatient> {
    try {
      const patientUser = await PatientUser.findOne({
        _id: patientUserId,
        workplaceId,
        isDeleted: false,
      }).select('patientId');

      if (!patientUser || !patientUser.patientId) {
        throw new Error('Patient user not found or not linked to patient record');
      }

      const updatedPatient = await Patient.findOneAndUpdate(
        {
          _id: patientUser.patientId,
          workplaceId,
          isDeleted: false,
        },
        {
          $pull: { chronicConditions: { _id: conditionId } },
          updatedBy: patientUser._id,
        },
        {
          new: true,
          runValidators: true,
        }
      );

      if (!updatedPatient) {
        throw new Error('Patient not found or condition removal failed');
      }

      logger.info('Chronic condition removed successfully', {
        patientId: updatedPatient._id,
        patientUserId,
        conditionId,
      });

      return updatedPatient;
    } catch (error) {
      logger.error('Error removing chronic condition', {
        error: error instanceof Error ? error.message : 'Unknown error',
        patientUserId,
        workplaceId,
        conditionId,
      });
      throw error;
    }
  }

  /**
   * Add emergency contact to patient record
   */
  static async addEmergencyContact(
    patientUserId: string,
    workplaceId: string,
    contactData: EmergencyContactData
  ): Promise<IPatient> {
    try {
      const patientUser = await PatientUser.findOne({
        _id: patientUserId,
        workplaceId,
        isDeleted: false,
      }).select('patientId');

      if (!patientUser || !patientUser.patientId) {
        throw new Error('Patient user not found or not linked to patient record');
      }

      // Validate contact data
      this.validateEmergencyContactData(contactData);

      // If this contact is set as primary, we need to unset other primary contacts
      let updateQuery: any = {
        $push: { enhancedEmergencyContacts: contactData },
        updatedBy: patientUser._id,
      };

      if (contactData.isPrimary) {
        // First unset all primary contacts
        await Patient.updateOne(
          {
            _id: patientUser.patientId,
            workplaceId,
            isDeleted: false,
          },
          {
            $set: { 'enhancedEmergencyContacts.$[].isPrimary': false },
          }
        );
      }

      const updatedPatient = await Patient.findOneAndUpdate(
        {
          _id: patientUser.patientId,
          workplaceId,
          isDeleted: false,
        },
        updateQuery,
        {
          new: true,
          runValidators: true,
        }
      );

      if (!updatedPatient) {
        throw new Error('Failed to add emergency contact');
      }

      // Sort contacts by priority
      updatedPatient.enhancedEmergencyContacts.sort((a, b) => a.priority - b.priority);
      await updatedPatient.save();

      logger.info('Emergency contact added successfully', {
        patientId: updatedPatient._id,
        patientUserId,
        contactName: contactData.name,
        isPrimary: contactData.isPrimary,
      });

      return updatedPatient;
    } catch (error) {
      logger.error('Error adding emergency contact', {
        error: error instanceof Error ? error.message : 'Unknown error',
        patientUserId,
        workplaceId,
        contactData,
      });
      throw error;
    }
  }

  /**
   * Update existing emergency contact
   */
  static async updateEmergencyContact(
    patientUserId: string,
    workplaceId: string,
    contactId: string,
    updates: Partial<EmergencyContactData>
  ): Promise<IPatient> {
    try {
      const patientUser = await PatientUser.findOne({
        _id: patientUserId,
        workplaceId,
        isDeleted: false,
      }).select('patientId');

      if (!patientUser || !patientUser.patientId) {
        throw new Error('Patient user not found or not linked to patient record');
      }

      // Validate update data
      if (updates.name || updates.phone || updates.relationship) {
        this.validateEmergencyContactData(updates as EmergencyContactData);
      }

      // If setting as primary, unset other primary contacts first
      if (updates.isPrimary) {
        await Patient.updateOne(
          {
            _id: patientUser.patientId,
            workplaceId,
            isDeleted: false,
          },
          {
            $set: { 'enhancedEmergencyContacts.$[elem].isPrimary': false },
          },
          {
            arrayFilters: [{ 'elem._id': { $ne: contactId } }],
          }
        );
      }

      // Build update object
      const updateFields: any = {};
      if (updates.name) updateFields['enhancedEmergencyContacts.$.name'] = updates.name;
      if (updates.relationship) updateFields['enhancedEmergencyContacts.$.relationship'] = updates.relationship;
      if (updates.phone) updateFields['enhancedEmergencyContacts.$.phone'] = updates.phone;
      if (updates.email !== undefined) updateFields['enhancedEmergencyContacts.$.email'] = updates.email;
      if (updates.isPrimary !== undefined) updateFields['enhancedEmergencyContacts.$.isPrimary'] = updates.isPrimary;
      if (updates.priority) updateFields['enhancedEmergencyContacts.$.priority'] = updates.priority;
      updateFields.updatedBy = patientUser._id;

      const updatedPatient = await Patient.findOneAndUpdate(
        {
          _id: patientUser.patientId,
          workplaceId,
          'enhancedEmergencyContacts._id': contactId,
          isDeleted: false,
        },
        { $set: updateFields },
        {
          new: true,
          runValidators: true,
        }
      );

      if (!updatedPatient) {
        throw new Error('Emergency contact not found or update failed');
      }

      // Re-sort by priority if priority was updated
      if (updates.priority) {
        updatedPatient.enhancedEmergencyContacts.sort((a, b) => a.priority - b.priority);
        await updatedPatient.save();
      }

      logger.info('Emergency contact updated successfully', {
        patientId: updatedPatient._id,
        patientUserId,
        contactId,
        updates,
      });

      return updatedPatient;
    } catch (error) {
      logger.error('Error updating emergency contact', {
        error: error instanceof Error ? error.message : 'Unknown error',
        patientUserId,
        workplaceId,
        contactId,
        updates,
      });
      throw error;
    }
  }

  /**
   * Remove emergency contact from patient record
   */
  static async removeEmergencyContact(
    patientUserId: string,
    workplaceId: string,
    contactId: string
  ): Promise<IPatient> {
    try {
      const patientUser = await PatientUser.findOne({
        _id: patientUserId,
        workplaceId,
        isDeleted: false,
      }).select('patientId');

      if (!patientUser || !patientUser.patientId) {
        throw new Error('Patient user not found or not linked to patient record');
      }

      const updatedPatient = await Patient.findOneAndUpdate(
        {
          _id: patientUser.patientId,
          workplaceId,
          isDeleted: false,
        },
        {
          $pull: { enhancedEmergencyContacts: { _id: contactId } },
          updatedBy: patientUser._id,
        },
        {
          new: true,
          runValidators: true,
        }
      );

      if (!updatedPatient) {
        throw new Error('Patient not found or contact removal failed');
      }

      logger.info('Emergency contact removed successfully', {
        patientId: updatedPatient._id,
        patientUserId,
        contactId,
      });

      return updatedPatient;
    } catch (error) {
      logger.error('Error removing emergency contact', {
        error: error instanceof Error ? error.message : 'Unknown error',
        patientUserId,
        workplaceId,
        contactId,
      });
      throw error;
    }
  }

  /**
   * Update insurance information
   */
  static async updateInsuranceInfo(
    patientUserId: string,
    workplaceId: string,
    insuranceData: InsuranceInfoData
  ): Promise<IPatient> {
    try {
      const patientUser = await PatientUser.findOne({
        _id: patientUserId,
        workplaceId,
        isDeleted: false,
      }).select('patientId');

      if (!patientUser || !patientUser.patientId) {
        throw new Error('Patient user not found or not linked to patient record');
      }

      // Validate insurance data
      this.validateInsuranceData(insuranceData);

      const updatedPatient = await Patient.findOneAndUpdate(
        {
          _id: patientUser.patientId,
          workplaceId,
          isDeleted: false,
        },
        {
          $set: {
            insuranceInfo: insuranceData,
            updatedBy: patientUser._id,
          },
        },
        {
          new: true,
          runValidators: true,
        }
      );

      if (!updatedPatient) {
        throw new Error('Patient not found or insurance update failed');
      }

      logger.info('Insurance information updated successfully', {
        patientId: updatedPatient._id,
        patientUserId,
        provider: insuranceData.provider,
      });

      return updatedPatient;
    } catch (error) {
      logger.error('Error updating insurance information', {
        error: error instanceof Error ? error.message : 'Unknown error',
        patientUserId,
        workplaceId,
        insuranceData,
      });
      throw error;
    }
  }

  /**
   * Log patient vitals
   */
  static async logVitals(
    patientUserId: string,
    workplaceId: string,
    vitalsData: VitalsData
  ): Promise<IPatient> {
    try {
      const patientUser = await PatientUser.findOne({
        _id: patientUserId,
        workplaceId,
        isDeleted: false,
      }).select('patientId');

      if (!patientUser || !patientUser.patientId) {
        throw new Error('Patient user not found or not linked to patient record');
      }

      // Validate vitals data
      this.validateVitalsData(vitalsData);

      const vitalsEntry = {
        ...vitalsData,
        recordedDate: new Date(),
        source: 'patient_portal' as const,
        isVerified: false,
      };

      const updatedPatient = await Patient.findOneAndUpdate(
        {
          _id: patientUser.patientId,
          workplaceId,
          isDeleted: false,
        },
        {
          $push: { patientLoggedVitals: vitalsEntry },
          updatedBy: patientUser._id,
        },
        {
          new: true,
          runValidators: true,
        }
      );

      if (!updatedPatient) {
        throw new Error('Failed to log vitals');
      }

      logger.info('Vitals logged successfully', {
        patientId: updatedPatient._id,
        patientUserId,
        vitalsData,
      });

      return updatedPatient;
    } catch (error) {
      logger.error('Error logging vitals', {
        error: error instanceof Error ? error.message : 'Unknown error',
        patientUserId,
        workplaceId,
        vitalsData,
      });
      throw error;
    }
  }

  /**
   * Get vitals history for a patient
   */
  static async getVitalsHistory(
    patientUserId: string,
    workplaceId: string,
    limit: number = 50
  ): Promise<any[]> {
    try {
      const patientUser = await PatientUser.findOne({
        _id: patientUserId,
        workplaceId,
        isDeleted: false,
      }).select('patientId');

      if (!patientUser || !patientUser.patientId) {
        throw new Error('Patient user not found or not linked to patient record');
      }

      const patient = await Patient.findOne({
        _id: patientUser.patientId,
        workplaceId,
        isDeleted: false,
      }).select('patientLoggedVitals');

      if (!patient) {
        throw new Error('Patient record not found');
      }

      // Sort by recorded date (newest first) and limit results
      const vitalsHistory = patient.patientLoggedVitals
        .sort((a, b) => b.recordedDate.getTime() - a.recordedDate.getTime())
        .slice(0, limit);

      return vitalsHistory;
    } catch (error) {
      logger.error('Error getting vitals history', {
        error: error instanceof Error ? error.message : 'Unknown error',
        patientUserId,
        workplaceId,
        limit,
      });
      throw error;
    }
  }

  /**
   * Get latest vitals for a patient
   */
  static async getLatestVitals(
    patientUserId: string,
    workplaceId: string
  ): Promise<any | null> {
    try {
      const vitalsHistory = await this.getVitalsHistory(patientUserId, workplaceId, 1);
      return vitalsHistory.length > 0 ? vitalsHistory[0] : null;
    } catch (error) {
      logger.error('Error getting latest vitals', {
        error: error instanceof Error ? error.message : 'Unknown error',
        patientUserId,
        workplaceId,
      });
      throw error;
    }
  }

  // Validation methods
  private static validateProfileUpdateData(data: PatientProfileUpdateData): void {
    if (data.email && !/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(data.email)) {
      throw new Error('Invalid email format');
    }

    if (data.phone && !/^\+234[0-9]{10}$/.test(data.phone)) {
      throw new Error('Phone must be in Nigerian format (+234XXXXXXXXXX)');
    }

    if (data.dob && data.dob > new Date()) {
      throw new Error('Date of birth cannot be in the future');
    }

    if (data.age && (data.age < 0 || data.age > 150)) {
      throw new Error('Age must be between 0 and 150');
    }

    if (data.weightKg && (data.weightKg < 0 || data.weightKg > 1000)) {
      throw new Error('Weight must be between 0 and 1000 kg');
    }
  }

  private static validateAllergyData(data: Partial<AllergyData>): void {
    if (data.allergen && (!data.allergen.trim() || data.allergen.length > 100)) {
      throw new Error('Allergen name is required and must not exceed 100 characters');
    }

    if (data.reaction && (!data.reaction.trim() || data.reaction.length > 500)) {
      throw new Error('Reaction description is required and must not exceed 500 characters');
    }

    if (data.severity && !['mild', 'moderate', 'severe'].includes(data.severity)) {
      throw new Error('Severity must be mild, moderate, or severe');
    }

    if (data.notes && data.notes.length > 1000) {
      throw new Error('Notes cannot exceed 1000 characters');
    }
  }

  private static validateChronicConditionData(data: Partial<ChronicConditionData>): void {
    if (data.condition && (!data.condition.trim() || data.condition.length > 200)) {
      throw new Error('Condition name is required and must not exceed 200 characters');
    }

    if (data.diagnosedDate && data.diagnosedDate > new Date()) {
      throw new Error('Diagnosed date cannot be in the future');
    }

    if (data.managementPlan && data.managementPlan.length > 2000) {
      throw new Error('Management plan cannot exceed 2000 characters');
    }

    if (data.status && !['active', 'managed', 'resolved'].includes(data.status)) {
      throw new Error('Status must be active, managed, or resolved');
    }

    if (data.notes && data.notes.length > 1000) {
      throw new Error('Notes cannot exceed 1000 characters');
    }
  }

  private static validateEmergencyContactData(data: Partial<EmergencyContactData>): void {
    if (data.name && (!data.name.trim() || data.name.length > 100)) {
      throw new Error('Contact name is required and must not exceed 100 characters');
    }

    if (data.relationship && (!data.relationship.trim() || data.relationship.length > 50)) {
      throw new Error('Relationship is required and must not exceed 50 characters');
    }

    if (data.phone && !/^\+234[0-9]{10}$/.test(data.phone)) {
      throw new Error('Phone must be in Nigerian format (+234XXXXXXXXXX)');
    }

    if (data.email && !/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(data.email)) {
      throw new Error('Invalid email format');
    }

    if (data.priority && (data.priority < 1 || data.priority > 10)) {
      throw new Error('Priority must be between 1 and 10');
    }
  }

  private static validateInsuranceData(data: InsuranceInfoData): void {
    if (data.provider && data.provider.length > 100) {
      throw new Error('Insurance provider name cannot exceed 100 characters');
    }

    if (data.policyNumber && data.policyNumber.length > 50) {
      throw new Error('Policy number cannot exceed 50 characters');
    }

    if (data.expiryDate && data.expiryDate <= new Date()) {
      throw new Error('Insurance expiry date must be in the future');
    }

    if (data.coverageDetails && data.coverageDetails.length > 1000) {
      throw new Error('Coverage details cannot exceed 1000 characters');
    }

    if (data.copayAmount && (data.copayAmount < 0 || data.copayAmount > 1000000)) {
      throw new Error('Copay amount must be between 0 and 1,000,000');
    }
  }

  private static validateVitalsData(data: VitalsData): void {
    if (data.bloodPressure) {
      const { systolic, diastolic } = data.bloodPressure;
      if (systolic < 50 || systolic > 300) {
        throw new Error('Systolic blood pressure must be between 50 and 300 mmHg');
      }
      if (diastolic < 30 || diastolic > 200) {
        throw new Error('Diastolic blood pressure must be between 30 and 200 mmHg');
      }
    }

    if (data.heartRate && (data.heartRate < 30 || data.heartRate > 250)) {
      throw new Error('Heart rate must be between 30 and 250 bpm');
    }

    if (data.temperature && (data.temperature < 30 || data.temperature > 45)) {
      throw new Error('Temperature must be between 30 and 45°C');
    }

    if (data.weight && (data.weight < 0 || data.weight > 1000)) {
      throw new Error('Weight must be between 0 and 1000 kg');
    }

    if (data.glucose && (data.glucose < 20 || data.glucose > 800)) {
      throw new Error('Glucose level must be between 20 and 800 mg/dL');
    }

    if (data.oxygenSaturation && (data.oxygenSaturation < 50 || data.oxygenSaturation > 100)) {
      throw new Error('Oxygen saturation must be between 50 and 100%');
    }

    if (data.notes && data.notes.length > 500) {
      throw new Error('Notes cannot exceed 500 characters');
    }
  }
}

export default PatientProfileService;