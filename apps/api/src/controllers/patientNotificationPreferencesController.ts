import { Response } from 'express';
import mongoose from 'mongoose';
import Patient from '../models/Patient';
import { sendSuccess, sendError } from '../utils/responseHelpers';
import { AuthRequest } from '../middlewares/auth';
import logger from '../utils/logger';

export interface NotificationPreferencesData {
  email: boolean;
  sms: boolean;
  push: boolean;
  whatsapp: boolean;
  language: 'en' | 'yo' | 'ig' | 'ha';
  timezone: string;
  optOut: boolean;
  channels: {
    appointmentReminders: {
      email: boolean;
      sms: boolean;
      push: boolean;
      whatsapp: boolean;
    };
    medicationRefills: {
      email: boolean;
      sms: boolean;
      push: boolean;
      whatsapp: boolean;
    };
    adherenceChecks: {
      email: boolean;
      sms: boolean;
      push: boolean;
      whatsapp: boolean;
    };
    clinicalFollowups: {
      email: boolean;
      sms: boolean;
      push: boolean;
      whatsapp: boolean;
    };
    generalNotifications: {
      email: boolean;
      sms: boolean;
      push: boolean;
      whatsapp: boolean;
    };
  };
  quietHours: {
    enabled: boolean;
    startTime: string; // HH:mm format
    endTime: string; // HH:mm format
  };
}

/**
 * Get patient notification preferences
 */
export const getPatientNotificationPreferences = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { patientId } = req.params;
    const { workplaceId } = req.user!;

    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      sendError(res, 'BAD_REQUEST', 'Invalid patient ID', 400);
      return;
    }

    const patient = await Patient.findOne({
      _id: patientId,
      workplaceId,
      isDeleted: false,
    }).select('notificationPreferences appointmentPreferences');

    if (!patient) {
      sendError(res, 'NOT_FOUND', 'Patient not found', 404);
      return;
    }

    // Merge existing preferences with defaults
    const defaultPreferences: NotificationPreferencesData = {
      email: true,
      sms: false,
      push: true,
      whatsapp: false,
      language: 'en',
      timezone: 'Africa/Lagos',
      optOut: false,
      channels: {
        appointmentReminders: {
          email: true,
          sms: false,
          push: true,
          whatsapp: false,
        },
        medicationRefills: {
          email: true,
          sms: false,
          push: true,
          whatsapp: false,
        },
        adherenceChecks: {
          email: true,
          sms: false,
          push: true,
          whatsapp: false,
        },
        clinicalFollowups: {
          email: true,
          sms: false,
          push: true,
          whatsapp: false,
        },
        generalNotifications: {
          email: true,
          sms: false,
          push: true,
          whatsapp: false,
        },
      },
      quietHours: {
        enabled: false,
        startTime: '22:00',
        endTime: '08:00',
      },
    };

    // Merge with existing preferences
    const preferences: NotificationPreferencesData = {
      ...defaultPreferences,
      email: patient.notificationPreferences?.email ?? defaultPreferences.email,
      sms: patient.notificationPreferences?.sms ?? defaultPreferences.sms,
      push: patient.notificationPreferences?.push ?? defaultPreferences.push,
      whatsapp: patient.appointmentPreferences?.reminderPreferences?.whatsapp ?? defaultPreferences.whatsapp,
      language: (patient.appointmentPreferences?.language as 'en' | 'yo' | 'ig' | 'ha') ?? defaultPreferences.language,
      timezone: patient.appointmentPreferences?.timezone ?? defaultPreferences.timezone,
      optOut: false, // This would be stored separately if needed
      channels: {
        appointmentReminders: {
          email: patient.appointmentPreferences?.reminderPreferences?.email ?? defaultPreferences.channels.appointmentReminders.email,
          sms: patient.appointmentPreferences?.reminderPreferences?.sms ?? defaultPreferences.channels.appointmentReminders.sms,
          push: patient.appointmentPreferences?.reminderPreferences?.push ?? defaultPreferences.channels.appointmentReminders.push,
          whatsapp: patient.appointmentPreferences?.reminderPreferences?.whatsapp ?? defaultPreferences.channels.appointmentReminders.whatsapp,
        },
        medicationRefills: {
          email: patient.notificationPreferences?.email ?? defaultPreferences.channels.medicationRefills.email,
          sms: patient.notificationPreferences?.sms ?? defaultPreferences.channels.medicationRefills.sms,
          push: patient.notificationPreferences?.push ?? defaultPreferences.channels.medicationRefills.push,
          whatsapp: patient.appointmentPreferences?.reminderPreferences?.whatsapp ?? defaultPreferences.channels.medicationRefills.whatsapp,
        },
        adherenceChecks: defaultPreferences.channels.adherenceChecks,
        clinicalFollowups: defaultPreferences.channels.clinicalFollowups,
        generalNotifications: {
          email: patient.notificationPreferences?.email ?? defaultPreferences.channels.generalNotifications.email,
          sms: patient.notificationPreferences?.sms ?? defaultPreferences.channels.generalNotifications.sms,
          push: patient.notificationPreferences?.push ?? defaultPreferences.channels.generalNotifications.push,
          whatsapp: patient.appointmentPreferences?.reminderPreferences?.whatsapp ?? defaultPreferences.channels.generalNotifications.whatsapp,
        },
      },
      quietHours: defaultPreferences.quietHours,
    };

    sendSuccess(res, { preferences });
  } catch (error) {
    logger.error('Error getting patient notification preferences:', error);
    sendError(res, 'SERVER_ERROR', 'Failed to get notification preferences', 500);
  }
};

/**
 * Update patient notification preferences
 */
export const updatePatientNotificationPreferences = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { patientId } = req.params;
    const { workplaceId, _id: userId } = req.user!;
    const preferences: Partial<NotificationPreferencesData> = req.body;

    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      sendError(res, 'BAD_REQUEST', 'Invalid patient ID', 400);
      return;
    }

    const patient = await Patient.findOne({
      _id: patientId,
      workplaceId,
      isDeleted: false,
    });

    if (!patient) {
      sendError(res, 'NOT_FOUND', 'Patient not found', 404);
      return;
    }

    // Update notification preferences
    if (preferences.email !== undefined || preferences.sms !== undefined || preferences.push !== undefined) {
      patient.notificationPreferences = {
        ...patient.notificationPreferences,
        email: preferences.email ?? patient.notificationPreferences?.email ?? true,
        sms: preferences.sms ?? patient.notificationPreferences?.sms ?? false,
        push: preferences.push ?? patient.notificationPreferences?.push ?? true,
        resultNotifications: patient.notificationPreferences?.resultNotifications ?? true,
        orderReminders: patient.notificationPreferences?.orderReminders ?? true,
      };
    }

    // Update appointment preferences
    if (preferences.whatsapp !== undefined || preferences.language !== undefined || preferences.timezone !== undefined || preferences.channels?.appointmentReminders) {
      if (!patient.appointmentPreferences) {
        patient.appointmentPreferences = {
          preferredDays: [],
          preferredTimeSlots: [],
          reminderPreferences: {
            email: true,
            sms: false,
            push: true,
            whatsapp: false,
          },
          language: 'en',
          timezone: 'Africa/Lagos',
        };
      }

      // Update reminder preferences
      if (preferences.channels?.appointmentReminders || preferences.whatsapp !== undefined) {
        patient.appointmentPreferences.reminderPreferences = {
          email: preferences.channels?.appointmentReminders?.email ?? patient.appointmentPreferences.reminderPreferences?.email ?? true,
          sms: preferences.channels?.appointmentReminders?.sms ?? patient.appointmentPreferences.reminderPreferences?.sms ?? false,
          push: preferences.channels?.appointmentReminders?.push ?? patient.appointmentPreferences.reminderPreferences?.push ?? true,
          whatsapp: preferences.whatsapp ?? preferences.channels?.appointmentReminders?.whatsapp ?? patient.appointmentPreferences.reminderPreferences?.whatsapp ?? false,
        };
      }

      // Update language and timezone
      if (preferences.language !== undefined) {
        patient.appointmentPreferences.language = preferences.language;
      }
      if (preferences.timezone !== undefined) {
        patient.appointmentPreferences.timezone = preferences.timezone;
      }
    }

    // Set updatedBy
    patient.updatedBy = new mongoose.Types.ObjectId(userId);

    await patient.save();

    logger.info(`Patient notification preferences updated`, {
      patientId,
      workplaceId,
      updatedBy: userId,
    });

    // Return updated preferences
    const updatedPreferences: NotificationPreferencesData = {
      email: patient.notificationPreferences?.email ?? true,
      sms: patient.notificationPreferences?.sms ?? false,
      push: patient.notificationPreferences?.push ?? true,
      whatsapp: patient.appointmentPreferences?.reminderPreferences?.whatsapp ?? false,
      language: (patient.appointmentPreferences?.language as 'en' | 'yo' | 'ig' | 'ha') ?? 'en',
      timezone: patient.appointmentPreferences?.timezone ?? 'Africa/Lagos',
      optOut: false,
      channels: {
        appointmentReminders: {
          email: patient.appointmentPreferences?.reminderPreferences?.email ?? true,
          sms: patient.appointmentPreferences?.reminderPreferences?.sms ?? false,
          push: patient.appointmentPreferences?.reminderPreferences?.push ?? true,
          whatsapp: patient.appointmentPreferences?.reminderPreferences?.whatsapp ?? false,
        },
        medicationRefills: {
          email: patient.notificationPreferences?.email ?? true,
          sms: patient.notificationPreferences?.sms ?? false,
          push: patient.notificationPreferences?.push ?? true,
          whatsapp: patient.appointmentPreferences?.reminderPreferences?.whatsapp ?? false,
        },
        adherenceChecks: {
          email: patient.notificationPreferences?.email ?? true,
          sms: patient.notificationPreferences?.sms ?? false,
          push: patient.notificationPreferences?.push ?? true,
          whatsapp: patient.appointmentPreferences?.reminderPreferences?.whatsapp ?? false,
        },
        clinicalFollowups: {
          email: patient.notificationPreferences?.email ?? true,
          sms: patient.notificationPreferences?.sms ?? false,
          push: patient.notificationPreferences?.push ?? true,
          whatsapp: patient.appointmentPreferences?.reminderPreferences?.whatsapp ?? false,
        },
        generalNotifications: {
          email: patient.notificationPreferences?.email ?? true,
          sms: patient.notificationPreferences?.sms ?? false,
          push: patient.notificationPreferences?.push ?? true,
          whatsapp: patient.appointmentPreferences?.reminderPreferences?.whatsapp ?? false,
        },
      },
      quietHours: {
        enabled: false,
        startTime: '22:00',
        endTime: '08:00',
      },
    };

    sendSuccess(res, { 
      preferences: updatedPreferences,
      message: 'Notification preferences updated successfully'
    });
  } catch (error) {
    logger.error('Error updating patient notification preferences:', error);
    sendError(res, 'SERVER_ERROR', 'Failed to update notification preferences', 500);
  }
};

/**
 * Get patient opt-out status
 */
export const getPatientOptOutStatus = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { patientId } = req.params;
    const { workplaceId } = req.user!;

    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      sendError(res, 'BAD_REQUEST', 'Invalid patient ID', 400);
      return;
    }

    const patient = await Patient.findOne({
      _id: patientId,
      workplaceId,
      isDeleted: false,
    }).select('notificationPreferences appointmentPreferences');

    if (!patient) {
      sendError(res, 'NOT_FOUND', 'Patient not found', 404);
      return;
    }

    // Check if patient has opted out of all notifications
    const hasOptedOut = 
      !patient.notificationPreferences?.email &&
      !patient.notificationPreferences?.sms &&
      !patient.notificationPreferences?.push &&
      !patient.appointmentPreferences?.reminderPreferences?.whatsapp;

    sendSuccess(res, { 
      optedOut: hasOptedOut,
      preferences: {
        email: patient.notificationPreferences?.email ?? true,
        sms: patient.notificationPreferences?.sms ?? false,
        push: patient.notificationPreferences?.push ?? true,
        whatsapp: patient.appointmentPreferences?.reminderPreferences?.whatsapp ?? false,
      }
    });
  } catch (error) {
    logger.error('Error getting patient opt-out status:', error);
    sendError(res, 'SERVER_ERROR', 'Failed to get opt-out status', 500);
  }
};

/**
 * Update patient opt-out status
 */
export const updatePatientOptOutStatus = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { patientId } = req.params;
    const { workplaceId, _id: userId } = req.user!;
    const { optOut } = req.body;

    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      sendError(res, 'BAD_REQUEST', 'Invalid patient ID', 400);
      return;
    }

    if (typeof optOut !== 'boolean') {
      sendError(res, 'BAD_REQUEST', 'optOut must be a boolean', 400);
      return;
    }

    const patient = await Patient.findOne({
      _id: patientId,
      workplaceId,
      isDeleted: false,
    });

    if (!patient) {
      sendError(res, 'NOT_FOUND', 'Patient not found', 404);
      return;
    }

    if (optOut) {
      // Opt out of all notifications
      patient.notificationPreferences = {
        ...patient.notificationPreferences,
        email: false,
        sms: false,
        push: false,
        resultNotifications: false,
        orderReminders: false,
      };

      if (patient.appointmentPreferences) {
        patient.appointmentPreferences.reminderPreferences = {
          email: false,
          sms: false,
          push: false,
          whatsapp: false,
        };
      }
    } else {
      // Opt back in with default preferences
      patient.notificationPreferences = {
        ...patient.notificationPreferences,
        email: true,
        sms: false,
        push: true,
        resultNotifications: true,
        orderReminders: true,
      };

      if (!patient.appointmentPreferences) {
        patient.appointmentPreferences = {
          preferredDays: [],
          preferredTimeSlots: [],
          reminderPreferences: {
            email: true,
            sms: false,
            push: true,
            whatsapp: false,
          },
          language: 'en',
          timezone: 'Africa/Lagos',
        };
      } else {
        patient.appointmentPreferences.reminderPreferences = {
          email: true,
          sms: false,
          push: true,
          whatsapp: false,
        };
      }
    }

    patient.updatedBy = new mongoose.Types.ObjectId(userId);
    await patient.save();

    logger.info(`Patient opt-out status updated`, {
      patientId,
      workplaceId,
      optOut,
      updatedBy: userId,
    });

    sendSuccess(res, { 
      optedOut: optOut,
      message: optOut ? 'Patient opted out of all notifications' : 'Patient opted back in to notifications'
    });
  } catch (error) {
    logger.error('Error updating patient opt-out status:', error);
    sendError(res, 'SERVER_ERROR', 'Failed to update opt-out status', 500);
  }
};