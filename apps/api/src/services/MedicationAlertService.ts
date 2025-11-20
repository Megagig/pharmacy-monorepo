import mongoose from 'mongoose';
import * as cron from 'node-cron';
import Medication, { IMedication } from '../models/Medication';
import AdherenceTracking, { IAdherenceTracking } from '../modules/diagnostics/models/AdherenceTracking';
import FollowUpTask from '../models/FollowUpTask';
import Patient from '../models/Patient';
import notificationService from './notificationService';

export interface IMedicationAlert {
  patientId: string;
  medicationId: string;
  medicationName: string;
  alertType: 'refill_due' | 'refill_overdue' | 'low_adherence' | 'missed_doses' | 'prescription_expiring';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  daysUntilCritical?: number;
  refillsRemaining?: number;
  adherenceScore?: number;
  recommendedAction: string;
  createdAt: Date;
}

export interface IRefillStatusCheck {
  medicationId: string;
  medicationName: string;
  patientId: string;
  patientName: string;
  refillsRemaining: number;
  lastRefillDate?: Date;
  estimatedDaysRemaining?: number;
  isOverdue: boolean;
  urgencyLevel: 'routine' | 'urgent' | 'critical';
}

export class MedicationAlertService {
  private static isJobRunning = false;
  private static cronJob: any | null = null;

  /**
   * Initialize the daily medication alert checking job
   */
  static initializeDailyAlertJob(): void {
    // Run daily at 8:00 AM
    this.cronJob = cron.schedule('0 8 * * *', async () => {
      if (this.isJobRunning) {
        console.log('Medication alert job already running, skipping...');
        return;
      }

      console.log('Starting daily medication alert check...');
      this.isJobRunning = true;

      try {
        await this.performDailyRefillCheck();
        await this.performAdherenceCheck();
        await this.performPrescriptionExpiryCheck();
        console.log('Daily medication alert check completed successfully');
      } catch (error) {
        console.error('Error in daily medication alert check:', error);
      } finally {
        this.isJobRunning = false;
      }
    }, {
      timezone: 'Africa/Lagos' // Nigerian timezone
    });

    console.log('Daily medication alert job initialized');
  }

  /**
   * Stop the daily alert job
   */
  static stopDailyAlertJob(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('Daily medication alert job stopped');
    }
  }

  /**
   * Perform daily refill status checking for all active medications
   */
  static async performDailyRefillCheck(): Promise<void> {
    try {
      console.log('Performing daily refill status check...');

      // Get all active medications that might need refills
      const medications = await Medication.find({
        status: 'active',
        'prescription.refillsRemaining': { $gt: 0 }
      })
      .populate('patient', 'firstName lastName workplaceId')
      .populate('pharmacist', 'firstName lastName email');

      const alerts: IMedicationAlert[] = [];
      const refillChecks: IRefillStatusCheck[] = [];

      for (const medication of medications) {
        try {
          const refillStatus = await this.checkMedicationRefillStatus(medication);
          refillChecks.push(refillStatus);

          // Generate alerts based on refill status
          const alert = this.generateRefillAlert(medication, refillStatus);
          if (alert) {
            alerts.push(alert);
          }
        } catch (error) {
          console.error(`Error checking refill status for medication ${medication._id}:`, error);
        }
      }

      // Send notifications for generated alerts
      await this.processAlerts(alerts);

      console.log(`Refill check completed. Processed ${medications.length} medications, generated ${alerts.length} alerts`);
    } catch (error) {
      console.error('Error in daily refill check:', error);
      throw error;
    }
  }

  /**
   * Check refill status for a specific medication
   */
  static async checkMedicationRefillStatus(medication: IMedication): Promise<IRefillStatusCheck> {
    const patient = medication.patient as any;
    const refillsRemaining = medication.prescription?.refillsRemaining || 0;
    const lastRefillDate = medication.adherence?.lastReported;

    let estimatedDaysRemaining: number | undefined;
    let isOverdue = false;
    let urgencyLevel: 'routine' | 'urgent' | 'critical' = 'routine';

    // Estimate days remaining based on medication duration and last refill
    if (lastRefillDate && medication.instructions?.duration) {
      const durationMatch = medication.instructions.duration.match(/(\d+)\s*(day|week|month)/i);
      if (durationMatch) {
        const [, amount, unit] = durationMatch;
        const durationDays = unit.toLowerCase().startsWith('week') 
          ? parseInt(amount) * 7 
          : unit.toLowerCase().startsWith('month')
          ? parseInt(amount) * 30
          : parseInt(amount);
        
        const daysSinceLastRefill = Math.floor(
          (new Date().getTime() - lastRefillDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        estimatedDaysRemaining = Math.max(0, durationDays - daysSinceLastRefill);
        isOverdue = daysSinceLastRefill > durationDays;

        // Determine urgency level
        if (isOverdue) {
          urgencyLevel = 'critical';
        } else if (estimatedDaysRemaining <= 3) {
          urgencyLevel = 'urgent';
        } else if (estimatedDaysRemaining <= 7) {
          urgencyLevel = 'urgent';
        }
      }
    }

    return {
      medicationId: medication._id.toString(),
      medicationName: medication.drugName,
      patientId: patient._id.toString(),
      patientName: `${patient.firstName} ${patient.lastName}`,
      refillsRemaining,
      lastRefillDate,
      estimatedDaysRemaining,
      isOverdue,
      urgencyLevel
    };
  }

  /**
   * Generate refill alert based on medication status
   */
  static generateRefillAlert(
    medication: IMedication, 
    refillStatus: IRefillStatusCheck
  ): IMedicationAlert | null {
    const { isOverdue, estimatedDaysRemaining, urgencyLevel, refillsRemaining } = refillStatus;

    if (!isOverdue && (!estimatedDaysRemaining || estimatedDaysRemaining > 7)) {
      return null; // No alert needed
    }

    let alertType: IMedicationAlert['alertType'];
    let severity: IMedicationAlert['severity'];
    let message: string;
    let recommendedAction: string;

    if (isOverdue) {
      alertType = 'refill_overdue';
      severity = 'critical';
      message = `${medication.drugName} refill is overdue. Patient may be without medication.`;
      recommendedAction = 'Contact patient immediately to arrange refill or new prescription';
    } else if (estimatedDaysRemaining! <= 3) {
      alertType = 'refill_due';
      severity = 'high';
      message = `${medication.drugName} refill needed within ${estimatedDaysRemaining} days.`;
      recommendedAction = 'Process refill request or contact patient to arrange pickup';
    } else if (estimatedDaysRemaining! <= 7) {
      alertType = 'refill_due';
      severity = 'medium';
      message = `${medication.drugName} refill will be needed in ${estimatedDaysRemaining} days.`;
      recommendedAction = 'Prepare refill or remind patient to request refill';
    } else {
      return null;
    }

    return {
      patientId: refillStatus.patientId,
      medicationId: refillStatus.medicationId,
      medicationName: medication.drugName,
      alertType,
      severity,
      message,
      daysUntilCritical: estimatedDaysRemaining,
      refillsRemaining,
      recommendedAction,
      createdAt: new Date()
    };
  }

  /**
   * Perform adherence checking for all patients
   */
  static async performAdherenceCheck(): Promise<void> {
    try {
      console.log('Performing adherence check...');

      // Get all active adherence tracking records
      const adherenceRecords = await AdherenceTracking.find({
        monitoringActive: true,
        nextAssessmentDate: { $lte: new Date() }
      })
      .populate('patientId', 'firstName lastName workplaceId');

      const alerts: IMedicationAlert[] = [];

      for (const record of adherenceRecords) {
        try {
          const adherenceAlerts = await this.generateAdherenceAlerts(record);
          alerts.push(...adherenceAlerts);

          // Update next assessment date
          record.lastAssessmentDate = new Date();
          const nextDate = new Date();
          switch (record.monitoringFrequency) {
            case 'daily':
              nextDate.setDate(nextDate.getDate() + 1);
              break;
            case 'weekly':
              nextDate.setDate(nextDate.getDate() + 7);
              break;
            case 'biweekly':
              nextDate.setDate(nextDate.getDate() + 14);
              break;
            case 'monthly':
              nextDate.setMonth(nextDate.getMonth() + 1);
              break;
          }
          record.nextAssessmentDate = nextDate;
          await record.save();
        } catch (error) {
          console.error(`Error checking adherence for patient ${record.patientId}:`, error);
        }
      }

      // Process adherence alerts
      await this.processAlerts(alerts);

      console.log(`Adherence check completed. Processed ${adherenceRecords.length} patients, generated ${alerts.length} alerts`);
    } catch (error) {
      console.error('Error in adherence check:', error);
      throw error;
    }
  }

  /**
   * Generate adherence alerts for a patient
   */
  static async generateAdherenceAlerts(adherenceRecord: IAdherenceTracking): Promise<IMedicationAlert[]> {
    const alerts: IMedicationAlert[] = [];
    const patient = adherenceRecord.patientId as any;

    // Check overall adherence score
    if (adherenceRecord.overallAdherenceScore < 70) {
      alerts.push({
        patientId: patient._id.toString(),
        medicationId: '', // Overall adherence alert
        medicationName: 'Overall Medication Adherence',
        alertType: 'low_adherence',
        severity: adherenceRecord.overallAdherenceScore < 50 ? 'critical' : 'high',
        message: `Patient has low overall adherence score: ${adherenceRecord.overallAdherenceScore}%`,
        adherenceScore: adherenceRecord.overallAdherenceScore,
        recommendedAction: 'Schedule adherence counseling session and review barriers to medication taking',
        createdAt: new Date()
      });
    }

    // Check individual medication adherence
    for (const medication of adherenceRecord.medications) {
      if (medication.adherenceScore < 80) {
        let severity: IMedicationAlert['severity'] = 'medium';
        if (medication.adherenceScore < 50) severity = 'critical';
        else if (medication.adherenceScore < 70) severity = 'high';

        alerts.push({
          patientId: patient._id.toString(),
          medicationId: '', // We don't have medication ID in adherence tracking
          medicationName: medication.medicationName,
          alertType: 'low_adherence',
          severity,
          message: `Low adherence for ${medication.medicationName}: ${medication.adherenceScore}%`,
          adherenceScore: medication.adherenceScore,
          recommendedAction: 'Review medication regimen and address adherence barriers',
          createdAt: new Date()
        });
      }

      // Check for missed doses
      if (medication.missedDoses && medication.totalDoses && 
          (medication.missedDoses / medication.totalDoses) > 0.2) {
        alerts.push({
          patientId: patient._id.toString(),
          medicationId: '',
          medicationName: medication.medicationName,
          alertType: 'missed_doses',
          severity: 'medium',
          message: `High number of missed doses for ${medication.medicationName}: ${medication.missedDoses}/${medication.totalDoses}`,
          recommendedAction: 'Implement reminder system and review dosing schedule',
          createdAt: new Date()
        });
      }
    }

    return alerts;
  }

  /**
   * Check for prescription expiry alerts
   */
  static async performPrescriptionExpiryCheck(): Promise<void> {
    try {
      console.log('Performing prescription expiry check...');

      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      // Find medications with prescriptions expiring in the next 30 days
      const expiringMedications = await Medication.find({
        status: 'active',
        'prescription.dateExpires': {
          $gte: new Date(),
          $lte: thirtyDaysFromNow
        }
      })
      .populate('patient', 'firstName lastName workplaceId');

      const alerts: IMedicationAlert[] = [];

      for (const medication of expiringMedications) {
        const patient = medication.patient as any;
        const expiryDate = medication.prescription?.dateExpires;
        
        if (expiryDate) {
          const daysUntilExpiry = Math.ceil(
            (expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
          );

          let severity: IMedicationAlert['severity'] = 'low';
          if (daysUntilExpiry <= 7) severity = 'high';
          else if (daysUntilExpiry <= 14) severity = 'medium';

          alerts.push({
            patientId: patient._id.toString(),
            medicationId: medication._id.toString(),
            medicationName: medication.drugName,
            alertType: 'prescription_expiring',
            severity,
            message: `Prescription for ${medication.drugName} expires in ${daysUntilExpiry} days`,
            daysUntilCritical: daysUntilExpiry,
            recommendedAction: 'Contact prescriber for new prescription or schedule appointment',
            createdAt: new Date()
          });
        }
      }

      await this.processAlerts(alerts);

      console.log(`Prescription expiry check completed. Found ${expiringMedications.length} expiring prescriptions, generated ${alerts.length} alerts`);
    } catch (error) {
      console.error('Error in prescription expiry check:', error);
      throw error;
    }
  }

  /**
   * Process and send notifications for alerts
   */
  static async processAlerts(alerts: IMedicationAlert[]): Promise<void> {
    for (const alert of alerts) {
      try {
        await this.sendAlertNotifications(alert);
        
        // Create adherence tracking alert if applicable
        if (alert.alertType === 'low_adherence' || alert.alertType === 'missed_doses') {
          await this.createAdherenceTrackingAlert(alert);
        }
      } catch (error) {
        console.error(`Error processing alert for patient ${alert.patientId}:`, error);
      }
    }
  }

  /**
   * Send notifications for an alert
   */
  static async sendAlertNotifications(alert: IMedicationAlert): Promise<void> {
    try {
      // Get patient information
      const patient = await Patient.findById(alert.patientId)
        .populate('workplaceId', 'name');

      if (!patient) {
        console.error(`Patient not found for alert: ${alert.patientId}`);
        return;
      }

      // Get pharmacist information (assuming the patient has an assigned pharmacist)
      const medication = await Medication.findById(alert.medicationId)
        .populate('pharmacist', 'firstName lastName email');

      const pharmacistId = medication?.pharmacist?._id?.toString();

      // Send notification to pharmacist
      if (pharmacistId) {
        await notificationService.createNotification({
          userId: new mongoose.Types.ObjectId(pharmacistId),
          type: 'clinical_alert',
          title: `Medication Alert: ${alert.alertType.replace('_', ' ').toUpperCase()}`,
          content: alert.message,
          data: {
            patientId: new mongoose.Types.ObjectId(alert.patientId),
            medicationName: alert.medicationName,
            metadata: {
              alertType: alert.alertType,
              severity: alert.severity,
              medicationId: alert.medicationId,
              recommendedAction: alert.recommendedAction
            }
          },
          priority: alert.severity === 'critical' ? 'urgent' : alert.severity === 'high' ? 'high' : 'normal',
          workplaceId: patient.workplaceId,
          createdBy: new mongoose.Types.ObjectId(pharmacistId) // System-generated, using pharmacist as creator
        });
      }

      // Send notification to patient for certain alert types
      if (alert.alertType === 'refill_due' || alert.alertType === 'prescription_expiring') {
        // Assuming patient has a PatientUser record for notifications
        await notificationService.createNotification({
          userId: new mongoose.Types.ObjectId(alert.patientId),
          type: 'system_notification',
          title: 'Medication Reminder',
          content: alert.alertType === 'refill_due' 
            ? `Your ${alert.medicationName} refill is due soon`
            : `Your prescription for ${alert.medicationName} is expiring soon`,
          data: {
            medicationName: alert.medicationName,
            metadata: {
              alertType: alert.alertType,
              medicationId: alert.medicationId
            }
          },
          priority: 'normal',
          workplaceId: patient.workplaceId,
          createdBy: new mongoose.Types.ObjectId(alert.patientId) // System-generated for patient
        });
      }
    } catch (error) {
      console.error('Error sending alert notifications:', error);
    }
  }

  /**
   * Create adherence tracking alert
   */
  static async createAdherenceTrackingAlert(alert: IMedicationAlert): Promise<void> {
    try {
      const adherenceRecord = await AdherenceTracking.findOne({
        patientId: new mongoose.Types.ObjectId(alert.patientId)
      });

      if (adherenceRecord) {
        adherenceRecord.createAlert({
          type: alert.alertType === 'low_adherence' ? 'low_adherence' : 'missed_refill',
          severity: alert.severity,
          message: alert.message
        });

        await adherenceRecord.save();
      }
    } catch (error) {
      console.error('Error creating adherence tracking alert:', error);
    }
  }

  /**
   * Get medication alerts for a specific patient
   */
  static async getPatientMedicationAlerts(
    patientId: string,
    workplaceId: string
  ): Promise<IMedicationAlert[]> {
    try {
      // Get patient's medications
      const medications = await Medication.find({
        patient: new mongoose.Types.ObjectId(patientId),
        status: 'active'
      });

      const alerts: IMedicationAlert[] = [];

      // Check each medication for alerts
      for (const medication of medications) {
        const refillStatus = await this.checkMedicationRefillStatus(medication);
        const alert = this.generateRefillAlert(medication, refillStatus);
        
        if (alert) {
          alerts.push(alert);
        }

        // Check prescription expiry
        if (medication.prescription?.dateExpires) {
          const daysUntilExpiry = Math.ceil(
            (medication.prescription.dateExpires.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
          );

          if (daysUntilExpiry <= 30) {
            alerts.push({
              patientId,
              medicationId: medication._id.toString(),
              medicationName: medication.drugName,
              alertType: 'prescription_expiring',
              severity: daysUntilExpiry <= 7 ? 'high' : 'medium',
              message: `Prescription expires in ${daysUntilExpiry} days`,
              daysUntilCritical: daysUntilExpiry,
              recommendedAction: 'Contact prescriber for new prescription',
              createdAt: new Date()
            });
          }
        }
      }

      // Get adherence alerts
      const adherenceRecord = await AdherenceTracking.findOne({
        patientId: new mongoose.Types.ObjectId(patientId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId)
      });

      if (adherenceRecord) {
        const adherenceAlerts = await this.generateAdherenceAlerts(adherenceRecord);
        alerts.push(...adherenceAlerts);
      }

      return alerts.sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });
    } catch (error) {
      console.error('Error getting patient medication alerts:', error);
      throw error;
    }
  }

  /**
   * Get medication alerts for a workspace
   */
  static async getWorkspaceMedicationAlerts(
    workplaceId: string,
    severity?: IMedicationAlert['severity']
  ): Promise<IMedicationAlert[]> {
    try {
      // Get all patients in the workspace
      const patients = await Patient.find({
        workplaceId: new mongoose.Types.ObjectId(workplaceId)
      });

      const allAlerts: IMedicationAlert[] = [];

      // Get alerts for each patient
      for (const patient of patients) {
        try {
          const patientAlerts = await this.getPatientMedicationAlerts(
            patient._id.toString(),
            workplaceId
          );
          allAlerts.push(...patientAlerts);
        } catch (error) {
          console.error(`Error getting alerts for patient ${patient._id}:`, error);
        }
      }

      // Filter by severity if specified
      let filteredAlerts = allAlerts;
      if (severity) {
        filteredAlerts = allAlerts.filter(alert => alert.severity === severity);
      }

      return filteredAlerts.sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });
    } catch (error) {
      console.error('Error getting workspace medication alerts:', error);
      throw error;
    }
  }

  /**
   * Manually trigger alert check for a specific patient
   */
  static async triggerPatientAlertCheck(
    patientId: string,
    workplaceId: string
  ): Promise<IMedicationAlert[]> {
    try {
      const alerts = await this.getPatientMedicationAlerts(patientId, workplaceId);
      
      // Process high and critical alerts immediately
      const urgentAlerts = alerts.filter(alert => 
        alert.severity === 'high' || alert.severity === 'critical'
      );
      
      if (urgentAlerts.length > 0) {
        await this.processAlerts(urgentAlerts);
      }

      return alerts;
    } catch (error) {
      console.error('Error triggering patient alert check:', error);
      throw error;
    }
  }
}