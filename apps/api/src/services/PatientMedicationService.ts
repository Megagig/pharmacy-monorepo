import mongoose from 'mongoose';
import Medication, { IMedication } from '../models/Medication';
import MedicationManagement, { IMedicationManagement } from '../models/MedicationManagement';
import AdherenceTracking, { IAdherenceTracking } from '../modules/diagnostics/models/AdherenceTracking';
import FollowUpTask, { IFollowUpTask } from '../models/FollowUpTask';
import Patient, { IPatient } from '../models/Patient';
import notificationService from './notificationService';

export interface IMedicationWithAdherence extends IMedicationManagement {
  adherenceData?: {
    score: number;
    status: string;
    lastReported?: Date;
    refillHistory?: any[];
    missedDoses?: number;
    totalDoses?: number;
  };
  refillStatus?: {
    refillsRemaining: number;
    nextRefillDate?: Date;
    daysUntilRefill?: number;
    isEligibleForRefill: boolean;
    prescriptionExpiry?: Date;
    rxNumber?: string;
  };
}

export interface IRefillRequestData {
  medicationId: string;
  requestedQuantity: number;
  urgency: 'routine' | 'urgent';
  patientNotes?: string;
  estimatedPickupDate?: Date;
}

export interface IMedicationReminder {
  medicationId: string;
  medicationName: string;
  reminderTimes: string[]; // Array of time strings like "08:00", "20:00"
  frequency: string;
  isActive: boolean;
  lastSent?: Date;
  nextDue?: Date;
}

export class PatientMedicationService {
  /**
   * Get current active medications for a patient
   */
  static async getCurrentMedications(
    patientId: string,
    workplaceId: string
  ): Promise<IMedicationWithAdherence[]> {
    try {
      // Validate patient exists and belongs to workplace
      const patient = await Patient.findOne({
        _id: patientId,
        workplaceId: new mongoose.Types.ObjectId(workplaceId)
      });

      if (!patient) {
        throw new Error('Patient not found or access denied');
      }

      // Get active medications from MedicationManagement collection
      const medications = await MedicationManagement.find({
        patientId: new mongoose.Types.ObjectId(patientId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        status: 'active'
      })
        .populate('createdBy', 'firstName lastName')
        .sort({ createdAt: -1 });

      // Get adherence data for these medications
      const adherenceTracking = await AdherenceTracking.findOne({
        patientId: new mongoose.Types.ObjectId(patientId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        monitoringActive: true
      });

      // Enhance medications with adherence and refill data
      const enhancedMedications: IMedicationWithAdherence[] = medications.map(medication => {
        const medicationObj = medication.toObject() as IMedicationWithAdherence;

        // Add adherence data
        if (adherenceTracking) {
          const adherenceData = adherenceTracking.medications.find(
            med => med.medicationName.toLowerCase() === medication.name.toLowerCase()
          );

          if (adherenceData) {
            medicationObj.adherenceData = {
              score: adherenceData.adherenceScore,
              status: adherenceData.adherenceStatus,
              lastReported: adherenceData.refillHistory[adherenceData.refillHistory.length - 1]?.date
            };
          }
        }

        // Add refill status - MedicationManagement doesn't have prescription object
        const refillsRemaining = 0; // Will need to be calculated or added to model
        const lastRefillDate = medication.updatedAt;
        let nextRefillDate: Date | undefined;
        let daysUntilRefill: number | undefined;

        if (lastRefillDate) {
          // Estimate next refill date based on default 30-day supply
          // MedicationManagement doesn't have duration field, so we'll use a default
          const days = 30; // Default 30-day supply

          nextRefillDate = new Date(lastRefillDate);
          nextRefillDate.setDate(nextRefillDate.getDate() + days);

          const today = new Date();
          daysUntilRefill = Math.ceil((nextRefillDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        }

        medicationObj.refillStatus = {
          refillsRemaining,
          nextRefillDate,
          daysUntilRefill,
          isEligibleForRefill: refillsRemaining > 0 && (daysUntilRefill ? daysUntilRefill <= 7 : true)
        };

        return medicationObj;
      });

      return enhancedMedications;
    } catch (error) {
      console.error('Error getting current medications:', error);
      throw error;
    }
  }

  /**
   * Get medication history for a patient
   */
  static async getMedicationHistory(
    patientId: string,
    workplaceId: string,
    limit: number = 50
  ): Promise<IMedicationManagement[]> {
    try {
      // Validate patient exists and belongs to workplace
      const patient = await Patient.findOne({
        _id: patientId,
        workplaceId: new mongoose.Types.ObjectId(workplaceId)
      });

      if (!patient) {
        throw new Error('Patient not found or access denied');
      }

      // Get medication history from MedicationManagement (all statuses)
      const medications = await MedicationManagement.find({
        patientId: new mongoose.Types.ObjectId(patientId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId)
      })
        .populate('createdBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .limit(limit);

      return medications;
    } catch (error) {
      console.error('Error getting medication history:', error);
      throw error;
    }
  }

  /**
   * Get detailed information about a specific medication
   */
  static async getMedicationDetails(
    patientId: string,
    medicationId: string,
    workplaceId: string
  ): Promise<IMedicationWithAdherence> {
    try {
      // Validate patient exists and belongs to workplace
      const patient = await Patient.findOne({
        _id: patientId,
        workplaceId: new mongoose.Types.ObjectId(workplaceId)
      });

      if (!patient) {
        throw new Error('Patient not found or access denied');
      }

      // Get medication details from MedicationManagement
      const medication = await MedicationManagement.findOne({
        _id: medicationId,
        patientId: new mongoose.Types.ObjectId(patientId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId)
      })
        .populate('createdBy', 'firstName lastName email phone');

      if (!medication) {
        throw new Error('Medication not found or access denied');
      }

      const medicationObj = medication.toObject() as IMedicationWithAdherence;

      // Get detailed adherence data
      const adherenceTracking = await AdherenceTracking.findOne({
        patientId: new mongoose.Types.ObjectId(patientId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId)
      });

      if (adherenceTracking) {
        const adherenceData = adherenceTracking.medications.find(
          med => med.medicationName.toLowerCase() === medication.name.toLowerCase()
        );

        if (adherenceData) {
          medicationObj.adherenceData = {
            score: adherenceData.adherenceScore,
            status: adherenceData.adherenceStatus,
            lastReported: adherenceData.refillHistory[adherenceData.refillHistory.length - 1]?.date,
            refillHistory: adherenceData.refillHistory,
            missedDoses: adherenceData.missedDoses,
            totalDoses: adherenceData.totalDoses
          };
        }
      }

      // Add comprehensive refill status - MedicationManagement doesn't have prescription object
      const refillsRemaining = 0; // Default since MedicationManagement doesn't track refills
      medicationObj.refillStatus = {
        refillsRemaining,
        isEligibleForRefill: false, // Default to false since we don't have refill data
        prescriptionExpiry: medication.endDate,
        rxNumber: undefined // Not available in MedicationManagement
      };

      return medicationObj;
    } catch (error) {
      console.error('Error getting medication details:', error);
      throw error;
    }
  }

  /**
   * Get adherence data for a patient
   */
  static async getAdherenceData(
    patientId: string,
    workplaceId: string
  ): Promise<IAdherenceTracking | null> {
    try {
      // Validate patient exists and belongs to workplace
      const patient = await Patient.findOne({
        _id: patientId,
        workplaceId: new mongoose.Types.ObjectId(workplaceId)
      });

      if (!patient) {
        throw new Error('Patient not found or access denied');
      }

      const adherenceData = await AdherenceTracking.findOne({
        patientId: new mongoose.Types.ObjectId(patientId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId)
      });

      return adherenceData;
    } catch (error) {
      console.error('Error getting adherence data:', error);
      throw error;
    }
  }

  /**
   * Update adherence score for a medication
   */
  static async updateAdherenceScore(
    patientId: string,
    medicationId: string,
    score: number,
    workplaceId: string
  ): Promise<void> {
    try {
      // Validate patient exists and belongs to workplace
      const patient = await Patient.findOne({
        _id: patientId,
        workplaceId: new mongoose.Types.ObjectId(workplaceId)
      });

      if (!patient) {
        throw new Error('Patient not found or access denied');
      }

      // Get medication from MedicationManagement to find its name
      const medication = await MedicationManagement.findOne({
        _id: medicationId,
        patientId: new mongoose.Types.ObjectId(patientId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId)
      });

      if (!medication) {
        throw new Error('Medication not found');
      }

      // Update adherence tracking
      let adherenceTracking = await AdherenceTracking.findOne({
        patientId: new mongoose.Types.ObjectId(patientId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId)
      });

      if (!adherenceTracking) {
        // Create new adherence tracking if it doesn't exist
        adherenceTracking = new AdherenceTracking({
          workplaceId: new mongoose.Types.ObjectId(workplaceId),
          patientId: new mongoose.Types.ObjectId(patientId),
          medications: [],
          overallAdherenceScore: 0,
          adherenceCategory: 'poor',
          lastAssessmentDate: new Date(),
          nextAssessmentDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          monitoringActive: true,
          monitoringStartDate: new Date(),
          monitoringFrequency: 'weekly',
          alerts: [],
          interventions: [],
          createdBy: new mongoose.Types.ObjectId(patientId) // Patient self-reporting
        });
      }

      // Update or add medication adherence
      adherenceTracking.updateMedicationAdherence(medication.name, {
        adherenceScore: Math.max(0, Math.min(100, score)) // Ensure score is between 0-100
      });

      await adherenceTracking.save();

      // MedicationManagement doesn't have adherence field like Medication model
      // The adherence data is stored in AdherenceTracking collection

    } catch (error) {
      console.error('Error updating adherence score:', error);
      throw error;
    }
  }

  /**
   * Request a medication refill
   */
  static async requestRefill(
    patientId: string,
    workplaceId: string,
    refillData: IRefillRequestData,
    requestedBy: string
  ): Promise<IFollowUpTask> {
    try {
      // Validate patient exists and belongs to workplace
      const patient = await Patient.findOne({
        _id: patientId,
        workplaceId: new mongoose.Types.ObjectId(workplaceId)
      });

      if (!patient) {
        throw new Error('Patient not found or access denied');
      }

      // Get medication details from MedicationManagement
      const medication = await MedicationManagement.findOne({
        _id: refillData.medicationId,
        patientId: new mongoose.Types.ObjectId(patientId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        status: 'active'
      });

      if (!medication) {
        throw new Error('Medication not found or not active');
      }

      // Check if refills are available - MedicationManagement doesn't track refills
      // For now, we'll allow refill requests and let the pharmacist decide
      const refillsRemaining = 1; // Default to allow refill requests

      // Check if there's already a pending refill request for this medication
      const existingRequest = await FollowUpTask.findOne({
        type: 'medication_refill_request',
        patientId: new mongoose.Types.ObjectId(patientId),
        'metadata.refillRequest.medicationId': new mongoose.Types.ObjectId(refillData.medicationId),
        status: { $in: ['pending', 'in_progress'] }
      });

      if (existingRequest) {
        throw new Error('A refill request for this medication is already pending');
      }

      // Create refill request task
      const refillRequestTask = await FollowUpTask.create({
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        patientId: new mongoose.Types.ObjectId(patientId),
        assignedTo: medication.createdBy, // Use createdBy as the pharmacist
        type: 'medication_refill_request',
        title: `Refill Request: ${medication.name}`,
        description: `Patient has requested a refill for ${medication.name}. ${refillData.requestedQuantity} units requested.`,
        objectives: [
          'Review refill eligibility',
          'Verify remaining refills',
          'Process refill request',
          'Notify patient of decision'
        ],
        priority: refillData.urgency === 'urgent' ? 'high' : 'medium',
        dueDate: new Date(Date.now() + (refillData.urgency === 'urgent' ? 24 : 72) * 60 * 60 * 1000),
        trigger: {
          type: 'manual',
          sourceId: new mongoose.Types.ObjectId(refillData.medicationId),
          sourceType: 'Medication',
          triggerDate: new Date(),
          triggerDetails: {
            source: 'patient_portal',
            requestedBy: new mongoose.Types.ObjectId(requestedBy)
          }
        },
        relatedRecords: {
          medicationId: new mongoose.Types.ObjectId(refillData.medicationId)
        },
        metadata: {
          refillRequest: {
            medicationId: new mongoose.Types.ObjectId(refillData.medicationId),
            medicationName: medication.name,
            currentRefillsRemaining: refillsRemaining,
            requestedQuantity: refillData.requestedQuantity,
            urgency: refillData.urgency,
            patientNotes: refillData.patientNotes,
            estimatedPickupDate: refillData.estimatedPickupDate,
            requestedBy: new mongoose.Types.ObjectId(requestedBy),
            requestedAt: new Date()
          }
        },
        createdBy: new mongoose.Types.ObjectId(requestedBy)
      });

      // Send notification to pharmacist
      try {
        await notificationService.createNotification({
          userId: new mongoose.Types.ObjectId(medication.createdBy.toString()),
          type: 'system_notification',
          title: 'New Refill Request',
          content: `${patient.firstName} ${patient.lastName} has requested a refill for ${medication.name}`,
          data: {
            patientId: new mongoose.Types.ObjectId(patientId),
            medicationName: medication.name,
            metadata: {
              taskId: refillRequestTask._id.toString(),
              medicationId: refillData.medicationId,
              urgency: refillData.urgency
            }
          },
          priority: refillData.urgency === 'urgent' ? 'high' : 'normal',
          workplaceId: new mongoose.Types.ObjectId(workplaceId),
          createdBy: new mongoose.Types.ObjectId(requestedBy)
        });
      } catch (notificationError) {
        console.error('Failed to send refill request notification:', notificationError);
        // Don't fail the entire request if notification fails
      }

      return refillRequestTask;
    } catch (error) {
      console.error('Error requesting refill:', error);
      throw error;
    }
  }

  /**
   * Get refill requests for a patient
   */
  static async getRefillRequests(
    patientId: string,
    workplaceId: string,
    limit: number = 20
  ): Promise<IFollowUpTask[]> {
    try {
      // Validate patient exists and belongs to workplace
      const patient = await Patient.findOne({
        _id: patientId,
        workplaceId: new mongoose.Types.ObjectId(workplaceId)
      });

      if (!patient) {
        throw new Error('Patient not found or access denied');
      }

      const refillRequests = await FollowUpTask.find({
        type: 'medication_refill_request',
        patientId: new mongoose.Types.ObjectId(patientId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId)
      })
        .populate('assignedTo', 'firstName lastName')
        .populate('metadata.refillRequest.medicationId', 'name dosage frequency')
        .sort({ createdAt: -1 })
        .limit(limit);

      return refillRequests;
    } catch (error) {
      console.error('Error getting refill requests:', error);
      throw error;
    }
  }

  /**
   * Cancel a refill request
   */
  static async cancelRefillRequest(
    patientId: string,
    requestId: string,
    workplaceId: string
  ): Promise<void> {
    try {
      // Validate patient exists and belongs to workplace
      const patient = await Patient.findOne({
        _id: patientId,
        workplaceId: new mongoose.Types.ObjectId(workplaceId)
      });

      if (!patient) {
        throw new Error('Patient not found or access denied');
      }

      const refillRequest = await FollowUpTask.findOne({
        _id: requestId,
        type: 'medication_refill_request',
        patientId: new mongoose.Types.ObjectId(patientId),
        status: { $in: ['pending', 'in_progress'] }
      });

      if (!refillRequest) {
        throw new Error('Refill request not found or cannot be cancelled');
      }

      refillRequest.status = 'cancelled';
      refillRequest.outcome = {
        status: 'unsuccessful',
        notes: 'Cancelled by patient',
        nextActions: [],
        appointmentCreated: false
      };
      refillRequest.completedAt = new Date();
      refillRequest.completedBy = new mongoose.Types.ObjectId(patientId);

      await refillRequest.save();
    } catch (error) {
      console.error('Error cancelling refill request:', error);
      throw error;
    }
  }

  /**
   * Set medication reminders for a patient
   */
  static async setMedicationReminders(
    patientId: string,
    medicationId: string,
    reminderSettings: {
      reminderTimes: string[];
      isActive: boolean;
    },
    workplaceId: string
  ): Promise<void> {
    try {
      // Validate patient exists and belongs to workplace
      const patient = await Patient.findOne({
        _id: patientId,
        workplaceId: new mongoose.Types.ObjectId(workplaceId)
      });

      if (!patient) {
        throw new Error('Patient not found or access denied');
      }

      // Get medication details from MedicationManagement
      const medication = await MedicationManagement.findOne({
        _id: medicationId,
        patientId: new mongoose.Types.ObjectId(patientId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId)
      });

      if (!medication) {
        throw new Error('Medication not found');
      }

      // Store reminder settings in patient's profile or a separate collection
      // For now, we'll create immediate notifications as examples
      if (reminderSettings.isActive && reminderSettings.reminderTimes.length > 0) {
        for (const time of reminderSettings.reminderTimes) {
          try {
            await notificationService.createNotification({
              userId: new mongoose.Types.ObjectId(patientId),
              type: 'system_notification',
              title: 'Medication Reminder Set',
              content: `Reminder set for ${medication.name} at ${time}`,
              data: {
                medicationName: medication.name,
                dosage: medication.dosage,
                metadata: {
                  medicationId: medicationId,
                  reminderTime: time
                }
              },
              priority: 'normal',
              workplaceId: new mongoose.Types.ObjectId(workplaceId),
              createdBy: new mongoose.Types.ObjectId(patientId)
            });
          } catch (scheduleError) {
            console.error(`Failed to create reminder notification for ${time}:`, scheduleError);
          }
        }
      }
    } catch (error) {
      console.error('Error setting medication reminders:', error);
      throw error;
    }
  }

  /**
   * Get medication reminders for a patient
   */
  static async getMedicationReminders(
    patientId: string,
    workplaceId: string
  ): Promise<IMedicationReminder[]> {
    try {
      // Validate patient exists and belongs to workplace
      const patient = await Patient.findOne({
        _id: patientId,
        workplaceId: new mongoose.Types.ObjectId(workplaceId)
      });

      if (!patient) {
        throw new Error('Patient not found or access denied');
      }

      // Get active medications from MedicationManagement
      const medications = await MedicationManagement.find({
        patientId: new mongoose.Types.ObjectId(patientId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        status: 'active'
      });

      // For now, return mock reminder data since we don't have a full reminder system
      const reminders: IMedicationReminder[] = [];

      for (const medication of medications) {
        // Mock reminder data - in a real implementation, this would come from a reminders collection
        reminders.push({
          medicationId: medication._id.toString(),
          medicationName: medication.name,
          reminderTimes: [], // Would be populated from stored reminder settings
          frequency: medication.frequency || 'daily',
          isActive: false // Would be based on actual reminder settings
        });
      }

      return reminders;
    } catch (error) {
      console.error('Error getting medication reminders:', error);
      throw error;
    }
  }

  /**
   * Check if a medication is eligible for refill
   */
  static async checkRefillEligibility(
    patientId: string,
    medicationId: string,
    workplaceId: string
  ): Promise<{
    isEligible: boolean;
    reason?: string;
    refillsRemaining: number;
    nextEligibleDate?: Date;
  }> {
    try {
      // Validate patient exists and belongs to workplace
      const patient = await Patient.findOne({
        _id: patientId,
        workplaceId: new mongoose.Types.ObjectId(workplaceId)
      });

      if (!patient) {
        throw new Error('Patient not found or access denied');
      }

      const medication = await MedicationManagement.findOne({
        _id: medicationId,
        patientId: new mongoose.Types.ObjectId(patientId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId)
      });

      if (!medication) {
        return {
          isEligible: false,
          reason: 'Medication not found',
          refillsRemaining: 0
        };
      }

      // MedicationManagement doesn't track refills, so we'll allow refill requests
      const refillsRemaining = 1; // Default to allow refill requests

      if (medication.status !== 'active') {
        return {
          isEligible: false,
          reason: 'Medication is not active',
          refillsRemaining
        };
      }

      // Check if medication has expired (using endDate from MedicationManagement)
      if (medication.endDate && medication.endDate < new Date()) {
        return {
          isEligible: false,
          reason: 'Medication has expired',
          refillsRemaining
        };
      }

      // Check if there's already a pending refill request
      const existingRequest = await FollowUpTask.findOne({
        type: 'medication_refill_request',
        patientId: new mongoose.Types.ObjectId(patientId),
        'metadata.refillRequest.medicationId': new mongoose.Types.ObjectId(medicationId),
        status: { $in: ['pending', 'in_progress'] }
      });

      if (existingRequest) {
        return {
          isEligible: false,
          reason: 'Refill request already pending',
          refillsRemaining
        };
      }

      return {
        isEligible: true,
        refillsRemaining
      };
    } catch (error) {
      console.error('Error checking refill eligibility:', error);
      throw error;
    }
  }
}