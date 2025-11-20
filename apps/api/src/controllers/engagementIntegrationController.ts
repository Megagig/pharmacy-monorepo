import { Response } from 'express';
import mongoose from 'mongoose';
import { engagementIntegrationService } from '../services/EngagementIntegrationService';
import { sendSuccess, sendError } from '../utils/responseHelpers';
import { AuthRequest } from '../middlewares/auth';
import logger from '../utils/logger';
import { validateObjectId } from '../utils/validation';

// Helper function for validation with error response
const validateAndRespond = (res: Response, id: string, fieldName: string): boolean => {
  if (!validateObjectId(id)) {
    sendError(res, 'VALIDATION_ERROR', `Invalid ${fieldName}`, 400);
    return false;
  }
  return true;
};

/**
 * Create appointment from MTR session
 */
export const createAppointmentFromMTR = async (req: AuthRequest, res: Response) => {
  try {
    const { mtrSessionId } = req.params;
    const {
      patientId,
      assignedTo,
      scheduledDate,
      scheduledTime,
      duration,
      description,
      locationId,
    } = req.body;

    // Validate required fields
    if (!validateAndRespond(res, mtrSessionId, 'MTR Session ID')) return;
    if (!validateAndRespond(res, patientId, 'Patient ID')) return;
    if (!validateAndRespond(res, assignedTo, 'Assigned pharmacist ID')) return;

    if (!scheduledDate || !scheduledTime) {
      return sendError(res, 'VALIDATION_ERROR', 'Scheduled date and time are required', 400);
    }

    const result = await engagementIntegrationService.createAppointmentFromMTR({
      mtrSessionId: new mongoose.Types.ObjectId(mtrSessionId),
      patientId: new mongoose.Types.ObjectId(patientId),
      assignedTo: new mongoose.Types.ObjectId(assignedTo),
      scheduledDate: new Date(scheduledDate),
      scheduledTime,
      duration,
      description,
      workplaceId: req.user.workplaceId,
      locationId,
    });

    sendSuccess(res, result, 'Appointment created from MTR session successfully', 201);
  } catch (error: any) {
    logger.error('Error creating appointment from MTR session', {
      error: error.message,
      mtrSessionId: req.params.mtrSessionId,
      userId: req.user.id,
    });
    sendError(res, 'SERVER_ERROR', error.message, 500);
  }
};

/**
 * Link MTR follow-up to appointment
 */
export const linkMTRFollowUpToAppointment = async (req: AuthRequest, res: Response) => {
  try {
    const { mtrFollowUpId, appointmentId } = req.body;

    if (!validateAndRespond(res, mtrFollowUpId, 'MTR Follow-up ID')) return;
    if (!validateAndRespond(res, appointmentId, 'Appointment ID')) return;

    const result = await engagementIntegrationService.linkMTRFollowUpToAppointment({
      mtrFollowUpId: new mongoose.Types.ObjectId(mtrFollowUpId),
      appointmentId: new mongoose.Types.ObjectId(appointmentId),
    });

    sendSuccess(res, result, 'MTR follow-up linked to appointment successfully');
  } catch (error: any) {
    logger.error('Error linking MTR follow-up to appointment', {
      error: error.message,
      userId: req.user.id,
    });
    sendError(res, 'SERVER_ERROR', error.message, 500);
  }
};

/**
 * Create MTR follow-up with appointment
 */
export const createMTRWithAppointment = async (req: AuthRequest, res: Response) => {
  try {
    const { mtrSessionId } = req.params;
    const {
      patientId,
      assignedTo,
      scheduledDate,
      scheduledTime,
      duration,
      description,
      objectives,
      priority,
      locationId,
    } = req.body;

    // Validate required fields
    if (!validateAndRespond(res, mtrSessionId, 'MTR Session ID')) return;
    if (!validateAndRespond(res, patientId, 'Patient ID')) return;
    if (!validateAndRespond(res, assignedTo, 'Assigned pharmacist ID')) return;

    if (!scheduledDate || !scheduledTime) {
      return sendError(res, 'VALIDATION_ERROR', 'Scheduled date and time are required', 400);
    }

    if (!description || !objectives || !Array.isArray(objectives)) {
      return sendError(res, 'VALIDATION_ERROR', 'Description and objectives are required', 400);
    }

    const result = await engagementIntegrationService.createMTRWithAppointment({
      mtrSessionId: new mongoose.Types.ObjectId(mtrSessionId),
      patientId: new mongoose.Types.ObjectId(patientId),
      assignedTo: new mongoose.Types.ObjectId(assignedTo),
      scheduledDate: new Date(scheduledDate),
      scheduledTime,
      duration,
      description,
      objectives,
      priority: priority || 'medium',
      workplaceId: req.user.workplaceId,
      locationId,
      createdBy: req.user.id,
    });

    sendSuccess(res, result, 'MTR follow-up with appointment created successfully', 201);
  } catch (error: any) {
    logger.error('Error creating MTR follow-up with appointment', {
      error: error.message,
      mtrSessionId: req.params.mtrSessionId,
      userId: req.user.id,
    });
    sendError(res, 'SERVER_ERROR', error.message, 500);
  }
};

/**
 * Get MTR session with linked appointments
 */
export const getMTRSessionWithAppointment = async (req: AuthRequest, res: Response) => {
  try {
    const { mtrSessionId } = req.params;

    if (!validateAndRespond(res, mtrSessionId, 'MTR Session ID')) return;

    const result = await engagementIntegrationService.getMTRSessionWithAppointment(
      new mongoose.Types.ObjectId(mtrSessionId)
    );

    sendSuccess(res, result, 'MTR session with appointments retrieved successfully');
  } catch (error: any) {
    logger.error('Error getting MTR session with appointments', {
      error: error.message,
      mtrSessionId: req.params.mtrSessionId,
      userId: req.user.id,
    });
    sendError(res, 'SERVER_ERROR', error.message, 500);
  }
};

/**
 * Sync status between MTR follow-up and appointment
 */
export const syncMTRFollowUpStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { sourceId, sourceType, newStatus } = req.body;

    if (!validateAndRespond(res, sourceId, 'Source ID')) return;

    if (!['appointment', 'mtr_followup'].includes(sourceType)) {
      return sendError(res, 'VALIDATION_ERROR', 'Invalid source type', 400);
    }

    if (!newStatus) {
      return sendError(res, 'VALIDATION_ERROR', 'New status is required', 400);
    }

    await engagementIntegrationService.syncMTRFollowUpStatus({
      sourceId: new mongoose.Types.ObjectId(sourceId),
      sourceType,
      newStatus,
      updatedBy: req.user.id,
    });

    sendSuccess(res, null, 'Status synced successfully');
  } catch (error: any) {
    logger.error('Error syncing MTR follow-up status', {
      error: error.message,
      userId: req.user.id,
    });
    sendError(res, 'SERVER_ERROR', error.message, 500);
  }
};

/**
 * Create follow-up task from clinical intervention
 */
export const createFollowUpFromIntervention = async (req: AuthRequest, res: Response) => {
  try {
    const { interventionId } = req.params;
    const { patientId, assignedTo, locationId } = req.body;

    if (!validateAndRespond(res, interventionId, 'Intervention ID')) return;
    if (!validateAndRespond(res, patientId, 'Patient ID')) return;
    if (!validateAndRespond(res, assignedTo, 'Assigned pharmacist ID')) return;

    const result = await engagementIntegrationService.createFollowUpFromIntervention({
      interventionId: new mongoose.Types.ObjectId(interventionId),
      patientId: new mongoose.Types.ObjectId(patientId),
      assignedTo: new mongoose.Types.ObjectId(assignedTo),
      workplaceId: req.user.workplaceId,
      locationId,
      createdBy: req.user.id,
    });

    sendSuccess(res, result, 'Follow-up task created from clinical intervention successfully', 201);
  } catch (error: any) {
    logger.error('Error creating follow-up task from clinical intervention', {
      error: error.message,
      interventionId: req.params.interventionId,
      userId: req.user.id,
    });
    sendError(res, 'SERVER_ERROR', error.message, 500);
  }
};

/**
 * Update intervention status from completed follow-up
 */
export const updateInterventionFromFollowUp = async (req: AuthRequest, res: Response) => {
  try {
    const { followUpTaskId } = req.params;

    if (!validateAndRespond(res, followUpTaskId, 'Follow-up Task ID')) return;

    const result = await engagementIntegrationService.updateInterventionFromFollowUp(
      new mongoose.Types.ObjectId(followUpTaskId),
      req.user.id
    );

    sendSuccess(res, result, 'Intervention updated from follow-up completion successfully');
  } catch (error: any) {
    logger.error('Error updating intervention from follow-up', {
      error: error.message,
      followUpTaskId: req.params.followUpTaskId,
      userId: req.user.id,
    });
    sendError(res, 'SERVER_ERROR', error.message, 500);
  }
};

/**
 * Get clinical intervention with linked follow-up tasks and appointments
 */
export const getInterventionWithEngagementData = async (req: AuthRequest, res: Response) => {
  try {
    const { interventionId } = req.params;

    if (!validateAndRespond(res, interventionId, 'Intervention ID')) return;

    const result = await engagementIntegrationService.getInterventionWithEngagementData(
      new mongoose.Types.ObjectId(interventionId)
    );

    sendSuccess(res, result, 'Intervention with engagement data retrieved successfully');
  } catch (error: any) {
    logger.error('Error getting intervention with engagement data', {
      error: error.message,
      interventionId: req.params.interventionId,
      userId: req.user.id,
    });
    sendError(res, 'SERVER_ERROR', error.message, 500);
  }
};

/**
 * Create follow-up task from diagnostic case
 */
export const createFollowUpFromDiagnostic = async (req: AuthRequest, res: Response) => {
  try {
    const { diagnosticCaseId } = req.params;
    const { assignedTo, locationId } = req.body;

    if (!validateAndRespond(res, diagnosticCaseId, 'Diagnostic Case ID')) return;

    // Get patient ID from diagnostic result (the ID passed is a DiagnosticResult ID)
    const DiagnosticResult = require('../modules/diagnostics/models/DiagnosticResult').default;
    const diagnosticResult = await DiagnosticResult.findById(diagnosticCaseId).populate('requestId', 'patientId');

    if (!diagnosticResult) {
      return sendError(res, 'NOT_FOUND', 'Diagnostic case not found', 404);
    }

    // Extract patient ID from the populated request
    const patientId = diagnosticResult.requestId?.patientId || diagnosticResult.requestId;

    const result = await engagementIntegrationService.createFollowUpFromDiagnostic({
      diagnosticCaseId: new mongoose.Types.ObjectId(diagnosticCaseId),
      patientId: typeof patientId === 'string' ? new mongoose.Types.ObjectId(patientId) : patientId,
      assignedTo: assignedTo ? new mongoose.Types.ObjectId(assignedTo) : req.user.id,
      workplaceId: req.user.workplaceId,
      locationId,
      createdBy: req.user.id,
    });

    sendSuccess(res, result, 'Follow-up task created from diagnostic case successfully', 201);
  } catch (error: any) {
    logger.error('Error creating follow-up task from diagnostic case', {
      error: error.message,
      diagnosticCaseId: req.params.diagnosticCaseId,
      userId: req.user.id,
    });
    sendError(res, 'SERVER_ERROR', error.message, 500);
  }
};

/**
 * Get diagnostic case with linked engagement data
 */
export const getDiagnosticWithEngagementData = async (req: AuthRequest, res: Response) => {
  try {
    const { diagnosticCaseId } = req.params;

    if (!validateAndRespond(res, diagnosticCaseId, 'Diagnostic Case ID')) return;

    const result = await engagementIntegrationService.getDiagnosticWithEngagementData(
      new mongoose.Types.ObjectId(diagnosticCaseId)
    );

    sendSuccess(res, result, 'Diagnostic case with engagement data retrieved successfully');
  } catch (error: any) {
    logger.error('Error getting diagnostic case with engagement data', {
      error: error.message,
      diagnosticCaseId: req.params.diagnosticCaseId,
      userId: req.user.id,
    });
    sendError(res, 'SERVER_ERROR', error.message, 500);
  }
};

/**
 * Create visit from completed appointment
 */
export const createVisitFromAppointment = async (req: AuthRequest, res: Response) => {
  try {
    const { appointmentId } = req.params;

    if (!validateAndRespond(res, appointmentId, 'Appointment ID')) return;

    const visit = await engagementIntegrationService.createVisitFromAppointment(
      new mongoose.Types.ObjectId(appointmentId)
    );

    sendSuccess(res, { visit }, 'Visit created from appointment successfully', 201);
  } catch (error: any) {
    logger.error('Error creating visit from appointment', {
      error: error.message,
      appointmentId: req.params.appointmentId,
      userId: req.user.id,
    });
    sendError(res, 'SERVER_ERROR', error.message, 500);
  }
};