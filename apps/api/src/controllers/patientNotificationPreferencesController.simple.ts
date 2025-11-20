import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Patient from '../models/Patient';
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
    startTime: string;
    endTime: string;
  };
}

/**
 * Get patient notification preferences
 */
export const getPatientNotificationPreferences = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { patientId } = req.params;
    const { workplaceId } = req.user!;

    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      res.status(400).json({ success: false, message: 'Invalid patient ID' });
      return;
    }

    const patient = await Patient.findOne({
      _id: patientId,
      workplaceId,
      isDeleted: false,
    }).select('notificationPreferences appointmentPreferences');

    if (!patient) {
      res.status(404).json({ success: false, message: 'Patient not found' });
      return;
    }

    // Default preferences
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
    };

    res.json({ success: true, data: { preferences } });
  } catch (error) {
    logger.error('Error getting patient notification preferences:', error);
    res.status(500).json({ success: false, message: 'Failed to get notification preferences' });
  }
};

/**
 * Update patient notification preferences
 */
export const updatePatientNotificationPreferences = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { patientId } = req.params;
    const { workplaceId, userId } = req.user!;
    const preferences: Partial<NotificationPreferencesData> = req.body;

    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      res.status(400).json({ success: false, message: 'Invalid patient ID' });
      return;
    }

    const patient = await Patient.findOne({
      _id: patientId,
      workplaceId,
      isDeleted: false,
    });

    if (!patient) {
      res.status(404).json({ success: false, message: 'Patient not found' });
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

    res.json({ 
      success: true, 
      data: { 
        preferences: updatedPreferences,
        message: 'Notification preferences updated successfully'
      }
    });
  } catch (error) {
    logger.error('Error updating patient notification preferences:', error);
    res.status(500).json({ success: false, message: 'Failed to update notification preferences' });
  }
};