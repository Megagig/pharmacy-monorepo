/**
 * Adherence Check Reminder Job Processor
 * Processes adherence check reminder jobs from the queue
 * 
 * Features:
 * - Weekly job to identify chronic disease patients
 * - Create adherence check reminders
 * - Track reminder effectiveness
 * - Respect patient notification preferences
 * 
 * Requirements: 2.3, 2.4, 2.5, 3.1
 */

import { Job } from 'bull';
import mongoose from 'mongoose';
import { AdherenceCheckJobData } from '../config/queue';
import Patient from '../models/Patient';
import Medication from '../models/Medication';
import FollowUpTask from '../models/FollowUpTask';
import { notificationService } from '../services/notificationService';
import logger from '../utils/logger';

/**
 * Chronic disease conditions that require adherence monitoring
 */
const CHRONIC_CONDITIONS = [
  'diabetes',
  'hypertension',
  'asthma',
  'copd',
  'heart_failure',
  'chronic_kidney_disease',
  'hiv',
  'epilepsy',
  'thyroid_disorder',
  'arthritis',
];

/**
 * High-risk medications that require adherence monitoring
 */
const HIGH_RISK_MEDICATIONS = [
  'insulin',
  'warfarin',
  'metformin',
  'lisinopril',
  'amlodipine',
  'atorvastatin',
  'levothyroxine',
  'albuterol',
  'metoprolol',
  'losartan',
];

/**
 * Adherence check processing result
 */
export interface AdherenceCheckResult {
  workplaceId: string;
  totalPatientsChecked: number;
  remindersCreated: number;
  followUpsCreated: number;
  notificationsSent: number;
  errors: number;
  processingTime: number;
  details: {
    patientsByCondition: Record<string, number>;
    patientsNotified: string[];
    skippedReasons: Record<string, number>;
    effectivenessMetrics: {
      previousReminders: number;
      responsesReceived: number;
      responseRate: number;
    };
  };
}

/**
 * Process adherence check job
 * 
 * This is the main processor that identifies chronic disease patients
 * and sends adherence check reminders.
 */
export async function processAdherenceCheck(
  job: Job<AdherenceCheckJobData>
): Promise<AdherenceCheckResult> {
  const startTime = Date.now();
  const { workplaceId, patientIds, conditionTypes } = job.data;

  logger.info('Processing adherence check job', {
    jobId: job.id,
    workplaceId,
    patientIds: patientIds?.length || 'all',
    conditionTypes: conditionTypes?.length || 'all',
    attemptNumber: job.attemptsMade + 1,
  });

  const result: AdherenceCheckResult = {
    workplaceId,
    totalPatientsChecked: 0,
    remindersCreated: 0,
    followUpsCreated: 0,
    notificationsSent: 0,
    errors: 0,
    processingTime: 0,
    details: {
      patientsByCondition: {},
      patientsNotified: [],
      skippedReasons: {},
      effectivenessMetrics: {
        previousReminders: 0,
        responsesReceived: 0,
        responseRate: 0,
      },
    },
  };

  try {
    await job.progress(10);

    // Identify chronic disease patients
    const chronicPatients = await identifyChronicDiseasePatients(
      workplaceId,
      patientIds,
      conditionTypes
    );

    result.totalPatientsChecked = chronicPatients.length;

    logger.info(`Found ${chronicPatients.length} chronic disease patients`, {
      workplaceId,
      jobId: job.id,
    });

    await job.progress(30);

    // Process each patient
    for (let i = 0; i < chronicPatients.length; i++) {
      try {
        await processPatientAdherenceCheck(
          chronicPatients[i],
          workplaceId,
          result,
          job
        );

        // Update progress
        const progress = 30 + Math.floor((i / chronicPatients.length) * 60);
        await job.progress(progress);
      } catch (error) {
        result.errors++;
        logger.error('Error processing patient adherence check', {
          patientId: chronicPatients[i]._id.toString(),
          error: (error as Error).message,
        });
      }
    }

    // Calculate effectiveness metrics
    await calculateEffectivenessMetrics(workplaceId, result);

    await job.progress(100);

    result.processingTime = Date.now() - startTime;

    logger.info('Adherence check job completed successfully', {
      jobId: job.id,
      workplaceId,
      totalPatientsChecked: result.totalPatientsChecked,
      remindersCreated: result.remindersCreated,
      followUpsCreated: result.followUpsCreated,
      notificationsSent: result.notificationsSent,
      errors: result.errors,
      processingTime: `${result.processingTime}ms`,
      responseRate: `${result.details.effectivenessMetrics.responseRate}%`,
    });

    return result;
  } catch (error) {
    const processingTime = Date.now() - startTime;

    logger.error('Failed to process adherence check job:', {
      jobId: job.id,
      workplaceId,
      error: (error as Error).message,
      stack: (error as Error).stack,
      attemptsMade: job.attemptsMade,
      processingTime: `${processingTime}ms`,
    });

    throw error;
  }
}

/**
 * Identify chronic disease patients who need adherence checks
 */
async function identifyChronicDiseasePatients(
  workplaceId: string,
  patientIds?: string[],
  conditionTypes?: string[]
): Promise<any[]> {
  try {
    // Build query to find patients with chronic disease medications
    const medicationQuery: any = {
      status: 'active',
    };

    // Filter by specific patients if provided
    if (patientIds && patientIds.length > 0) {
      medicationQuery.patient = {
        $in: patientIds.map((id) => new mongoose.Types.ObjectId(id)),
      };
    }

    // Filter by medication types (as proxy for conditions)
    const conditionsToCheck = conditionTypes || CHRONIC_CONDITIONS;
    const medicationsToCheck = HIGH_RISK_MEDICATIONS;

    // Find active medications for chronic conditions
    const medications = await Medication.find(medicationQuery)
      .populate('patient', 'firstName lastName email phone appointmentPreferences')
      .populate('pharmacist', 'firstName lastName workplaceId')
      .lean();

    // Filter by workplace and chronic medications
    const chronicMedications = medications.filter((med: any) => {
      const pharmacist = med.pharmacist as any;
      
      // Check workplace match
      if (workplaceId && pharmacist && pharmacist.workplaceId) {
        if (pharmacist.workplaceId.toString() !== workplaceId) {
          return false;
        }
      }

      // Check if medication is for chronic condition
      const drugName = med.drugName?.toLowerCase() || '';
      return medicationsToCheck.some((medName) =>
        drugName.includes(medName.toLowerCase())
      );
    });

    // Group by patient and deduplicate
    const patientMap = new Map();
    chronicMedications.forEach((med: any) => {
      const patient = med.patient;
      if (patient && patient._id) {
        const patientId = patient._id.toString();
        if (!patientMap.has(patientId)) {
          patientMap.set(patientId, {
            ...patient,
            medications: [],
          });
        }
        patientMap.get(patientId).medications.push(med);
      }
    });

    return Array.from(patientMap.values());
  } catch (error) {
    logger.error('Error identifying chronic disease patients', {
      workplaceId,
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Process adherence check for a single patient
 */
async function processPatientAdherenceCheck(
  patient: any,
  workplaceId: string,
  result: AdherenceCheckResult,
  job: Job<AdherenceCheckJobData>
): Promise<void> {
  if (!patient || !patient._id) {
    logger.warn('Invalid patient data', { patient });
    result.details.skippedReasons['invalid_patient'] =
      (result.details.skippedReasons['invalid_patient'] || 0) + 1;
    return;
  }

  const patientId = patient._id.toString();

  // Check if adherence check was done recently (within last 7 days)
  const recentFollowUp = await FollowUpTask.findOne({
    patientId: patient._id,
    type: 'adherence_check',
    createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
  });

  if (recentFollowUp) {
    logger.debug('Adherence check done recently, skipping', {
      patientId,
      lastCheckDate: recentFollowUp.createdAt,
    });
    result.details.skippedReasons['checked_recently'] =
      (result.details.skippedReasons['checked_recently'] || 0) + 1;
    return;
  }

  // Get patient notification preferences
  const reminderPreferences = patient.appointmentPreferences?.reminderPreferences || {
    email: true,
    sms: false,
    push: true,
    whatsapp: false,
  };

  // Determine channels to use
  const channels: ('email' | 'sms' | 'push' | 'whatsapp')[] = [];
  if (reminderPreferences.email && patient.email) channels.push('email');
  if (reminderPreferences.sms && patient.phone) channels.push('sms');
  if (reminderPreferences.push) channels.push('push');
  if (reminderPreferences.whatsapp && patient.phone) channels.push('whatsapp');

  if (channels.length === 0) {
    logger.warn('No notification channels available for patient', {
      patientId,
    });
    result.details.skippedReasons['no_channels_available'] =
      (result.details.skippedReasons['no_channels_available'] || 0) + 1;
    return;
  }

  // Determine condition type from medications
  const medications = patient.medications || [];
  const conditionType = determineConditionType(medications);

  // Track by condition
  result.details.patientsByCondition[conditionType] =
    (result.details.patientsByCondition[conditionType] || 0) + 1;

  // Create follow-up task for adherence check
  const medicationNames = medications
    .map((med: any) => med.drugName)
    .filter(Boolean)
    .join(', ');

  const followUpTask = new FollowUpTask({
    workplaceId: new mongoose.Types.ObjectId(workplaceId),
    patientId: patient._id,
    assignedTo: medications[0]?.pharmacist || new mongoose.Types.ObjectId('000000000000000000000000'),
    type: 'adherence_check',
    title: `Medication Adherence Check: ${patient.firstName} ${patient.lastName}`,
    description: `Weekly adherence check for chronic disease patient. Medications: ${medicationNames}. Please verify patient is taking medications as prescribed and address any concerns.`,
    objectives: [
      'Verify patient is taking medications as prescribed',
      'Assess any side effects or concerns',
      'Check medication supply and refill needs',
      'Provide counseling if adherence issues identified',
      'Update adherence score in system',
    ],
    priority: 'medium',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Due in 7 days
    status: 'pending',
    trigger: {
      type: 'scheduled_monitoring',
      sourceId: medications[0]?._id || new mongoose.Types.ObjectId(),
      sourceType: 'Medication',
      triggerDate: new Date(),
      triggerDetails: {
        conditionType,
        medicationCount: medications.length,
        checkType: 'weekly_adherence',
      },
    },
    relatedRecords: {
      medicationId: medications[0]?._id,
    },
    createdBy: new mongoose.Types.ObjectId('000000000000000000000000'), // System user
  });

  await followUpTask.save();

  result.followUpsCreated++;

  logger.info('Created adherence check follow-up task', {
    followUpId: followUpTask._id.toString(),
    patientId,
    conditionType,
    medicationCount: medications.length,
  });

  // Send notification to patient
  try {
    const notificationTitle = 'Medication Adherence Check';
    const notificationMessage = `Hi ${patient.firstName}, we hope you're doing well! As part of your ongoing care for ${conditionType}, we'd like to check in on how you're managing your medications. Please let us know if you're taking them as prescribed or if you have any concerns. Your pharmacist is here to help!`;

    const notificationsSent = await sendMultiChannelNotification(
      patient._id,
      workplaceId,
      notificationTitle,
      notificationMessage,
      channels,
      {
        followUpId: followUpTask._id.toString(),
        patientId,
        conditionType,
        medicationCount: medications.length,
      }
    );

    if (notificationsSent > 0) {
      result.notificationsSent += notificationsSent;
      result.remindersCreated++;
      result.details.patientsNotified.push(patientId);

      logger.info('Sent adherence check reminder to patient', {
        patientId,
        conditionType,
        channels: channels.join(', '),
        notificationsSent,
      });
    }
  } catch (error) {
    logger.error('Error sending adherence check notification', {
      patientId,
      error: (error as Error).message,
    });
    // Don't throw - follow-up task was created successfully
  }
}

/**
 * Determine condition type from medications
 */
function determineConditionType(medications: any[]): string {
  if (!medications || medications.length === 0) {
    return 'chronic_disease';
  }

  const drugNames = medications
    .map((med) => med.drugName?.toLowerCase() || '')
    .join(' ');

  // Map medications to conditions
  if (drugNames.includes('insulin') || drugNames.includes('metformin')) {
    return 'diabetes';
  }
  if (
    drugNames.includes('lisinopril') ||
    drugNames.includes('amlodipine') ||
    drugNames.includes('losartan')
  ) {
    return 'hypertension';
  }
  if (drugNames.includes('albuterol') || drugNames.includes('inhaler')) {
    return 'asthma';
  }
  if (drugNames.includes('levothyroxine')) {
    return 'thyroid_disorder';
  }
  if (drugNames.includes('warfarin')) {
    return 'heart_condition';
  }

  return 'chronic_disease';
}

/**
 * Send notification through multiple channels
 */
async function sendMultiChannelNotification(
  userId: mongoose.Types.ObjectId,
  workplaceId: string,
  title: string,
  message: string,
  channels: ('email' | 'sms' | 'push' | 'whatsapp')[],
  data: Record<string, any>
): Promise<number> {
  let successCount = 0;

  try {
    // Convert channels array to deliveryChannels object
    const deliveryChannels: any = {};
    channels.forEach((channel) => {
      deliveryChannels[channel] = { enabled: true };
    });

    await notificationService.createNotification({
      workplaceId: new mongoose.Types.ObjectId(workplaceId),
      userId,
      type: 'adherence_check_reminder',
      title,
      content: message,
      priority: 'normal',
      data,
      deliveryChannels,
      createdBy: new mongoose.Types.ObjectId('000000000000000000000000'),
    });

    successCount = channels.length;
  } catch (error) {
    logger.error('Error creating notification', {
      userId: userId.toString(),
      error: (error as Error).message,
    });
  }

  return successCount;
}

/**
 * Calculate effectiveness metrics for adherence check reminders
 */
async function calculateEffectivenessMetrics(
  workplaceId: string,
  result: AdherenceCheckResult
): Promise<void> {
  try {
    // Get adherence check follow-ups from last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const previousFollowUps = await FollowUpTask.find({
      workplaceId: new mongoose.Types.ObjectId(workplaceId),
      type: 'adherence_check',
      createdAt: { $gte: thirtyDaysAgo },
    });

    result.details.effectivenessMetrics.previousReminders = previousFollowUps.length;

    // Count completed follow-ups (responses received)
    const completedFollowUps = previousFollowUps.filter(
      (task) => task.status === 'completed'
    );

    result.details.effectivenessMetrics.responsesReceived = completedFollowUps.length;

    // Calculate response rate
    if (previousFollowUps.length > 0) {
      result.details.effectivenessMetrics.responseRate = Math.round(
        (completedFollowUps.length / previousFollowUps.length) * 100
      );
    }

    logger.info('Calculated adherence check effectiveness metrics', {
      workplaceId,
      previousReminders: result.details.effectivenessMetrics.previousReminders,
      responsesReceived: result.details.effectivenessMetrics.responsesReceived,
      responseRate: `${result.details.effectivenessMetrics.responseRate}%`,
    });
  } catch (error) {
    logger.error('Error calculating effectiveness metrics', {
      workplaceId,
      error: (error as Error).message,
    });
    // Don't throw - this is not critical
  }
}

/**
 * Handle job completion
 */
export function onAdherenceCheckCompleted(
  job: Job<AdherenceCheckJobData>,
  result: AdherenceCheckResult
): void {
  const duration = job.processedOn ? Date.now() - job.processedOn : 0;

  logger.info('Adherence check job completed successfully', {
    jobId: job.id,
    workplaceId: job.data.workplaceId,
    duration: `${duration}ms`,
    processingTime: `${result.processingTime}ms`,
    totalPatientsChecked: result.totalPatientsChecked,
    remindersCreated: result.remindersCreated,
    followUpsCreated: result.followUpsCreated,
    notificationsSent: result.notificationsSent,
    errors: result.errors,
    responseRate: `${result.details.effectivenessMetrics.responseRate}%`,
  });

  if (result.errors > 0) {
    logger.warn('Adherence check completed with errors', {
      jobId: job.id,
      errors: result.errors,
      totalPatientsChecked: result.totalPatientsChecked,
    });
  }

  if (result.totalPatientsChecked > 0 && result.remindersCreated === 0) {
    logger.info('No adherence check reminders needed', {
      jobId: job.id,
      totalPatientsChecked: result.totalPatientsChecked,
      skippedReasons: result.details.skippedReasons,
    });
  }
}

/**
 * Handle job failure
 */
export async function onAdherenceCheckFailed(
  job: Job<AdherenceCheckJobData>,
  error: Error
): Promise<void> {
  const { workplaceId } = job.data;
  const attemptsLeft = (job.opts.attempts || 3) - job.attemptsMade;

  logger.error('Adherence check job failed', {
    jobId: job.id,
    workplaceId,
    error: error.message,
    stack: error.stack,
    attemptsMade: job.attemptsMade,
    attemptsLeft,
    willRetry: attemptsLeft > 0,
  });

  if (job.attemptsMade >= (job.opts.attempts || 3)) {
    logger.error('Adherence check job exhausted all retries - CRITICAL', {
      jobId: job.id,
      workplaceId,
      totalAttempts: job.attemptsMade,
      finalError: error.message,
    });

    // TODO: Send alert to system administrators
    logger.warn('TODO: Implement admin alert for failed adherence check job', {
      workplaceId,
    });
  }
}

export default {
  processAdherenceCheck,
  onAdherenceCheckCompleted,
  onAdherenceCheckFailed,
};
