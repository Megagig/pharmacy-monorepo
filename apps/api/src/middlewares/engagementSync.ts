import mongoose from 'mongoose';
import { engagementIntegrationService } from '../services/EngagementIntegrationService';
import logger from '../utils/logger';

/**
 * Middleware to sync status changes between appointments and MTR follow-ups
 */
export const syncEngagementStatus = (sourceType: 'appointment' | 'mtr_followup') => {
  return async (doc: any, next: any) => {
    try {
      // Only sync if status was modified
      if (!doc.isModified('status')) {
        return next();
      }

      const sourceId = doc._id;
      const newStatus = doc.status;
      const updatedBy = doc.updatedBy || doc.createdBy;

      // Perform sync in background to avoid blocking the main operation
      setImmediate(async () => {
        try {
          await engagementIntegrationService.syncMTRFollowUpStatus({
            sourceId,
            sourceType,
            newStatus,
            updatedBy,
          });

          logger.info('Status synced successfully', {
            sourceId,
            sourceType,
            newStatus,
          });
        } catch (error) {
          logger.error('Error syncing status in background', {
            error: error.message,
            sourceId,
            sourceType,
            newStatus,
          });
          // Don't throw error to avoid affecting the main operation
        }
      });

      next();
    } catch (error) {
      logger.error('Error in sync middleware', {
        error: error.message,
        sourceType,
      });
      // Don't throw error to avoid affecting the main operation
      next();
    }
  };
};

/**
 * Add sync middleware to Appointment model
 */
export const addAppointmentSyncMiddleware = (appointmentSchema: mongoose.Schema) => {
  appointmentSchema.post('save', syncEngagementStatus('appointment'));
  appointmentSchema.post('findOneAndUpdate', syncEngagementStatus('appointment'));
};

/**
 * Add sync middleware to MTRFollowUp model
 */
export const addMTRFollowUpSyncMiddleware = (mtrFollowUpSchema: mongoose.Schema) => {
  mtrFollowUpSchema.post('save', syncEngagementStatus('mtr_followup'));
  mtrFollowUpSchema.post('findOneAndUpdate', syncEngagementStatus('mtr_followup'));
};