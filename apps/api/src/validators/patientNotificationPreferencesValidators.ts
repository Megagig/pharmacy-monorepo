import { body, param } from 'express-validator';

export const validatePatientId = [
  param('patientId')
    .isMongoId()
    .withMessage('Invalid patient ID format'),
];

export const validateNotificationPreferences = [
  ...validatePatientId,
  
  // Global preferences
  body('email')
    .optional()
    .isBoolean()
    .withMessage('Email preference must be a boolean'),
  
  body('sms')
    .optional()
    .isBoolean()
    .withMessage('SMS preference must be a boolean'),
  
  body('push')
    .optional()
    .isBoolean()
    .withMessage('Push preference must be a boolean'),
  
  body('whatsapp')
    .optional()
    .isBoolean()
    .withMessage('WhatsApp preference must be a boolean'),
  
  body('language')
    .optional()
    .isIn(['en', 'yo', 'ig', 'ha'])
    .withMessage('Language must be one of: en, yo, ig, ha'),
  
  body('timezone')
    .optional()
    .isString()
    .withMessage('Timezone must be a string'),
  
  body('optOut')
    .optional()
    .isBoolean()
    .withMessage('Opt out preference must be a boolean'),
  
  // Channel-specific preferences
  body('channels.appointmentReminders.email')
    .optional()
    .isBoolean()
    .withMessage('Appointment reminder email preference must be a boolean'),
  
  body('channels.appointmentReminders.sms')
    .optional()
    .isBoolean()
    .withMessage('Appointment reminder SMS preference must be a boolean'),
  
  body('channels.appointmentReminders.push')
    .optional()
    .isBoolean()
    .withMessage('Appointment reminder push preference must be a boolean'),
  
  body('channels.appointmentReminders.whatsapp')
    .optional()
    .isBoolean()
    .withMessage('Appointment reminder WhatsApp preference must be a boolean'),
  
  body('channels.medicationRefills.email')
    .optional()
    .isBoolean()
    .withMessage('Medication refill email preference must be a boolean'),
  
  body('channels.medicationRefills.sms')
    .optional()
    .isBoolean()
    .withMessage('Medication refill SMS preference must be a boolean'),
  
  body('channels.medicationRefills.push')
    .optional()
    .isBoolean()
    .withMessage('Medication refill push preference must be a boolean'),
  
  body('channels.medicationRefills.whatsapp')
    .optional()
    .isBoolean()
    .withMessage('Medication refill WhatsApp preference must be a boolean'),
  
  body('channels.adherenceChecks.email')
    .optional()
    .isBoolean()
    .withMessage('Adherence check email preference must be a boolean'),
  
  body('channels.adherenceChecks.sms')
    .optional()
    .isBoolean()
    .withMessage('Adherence check SMS preference must be a boolean'),
  
  body('channels.adherenceChecks.push')
    .optional()
    .isBoolean()
    .withMessage('Adherence check push preference must be a boolean'),
  
  body('channels.adherenceChecks.whatsapp')
    .optional()
    .isBoolean()
    .withMessage('Adherence check WhatsApp preference must be a boolean'),
  
  body('channels.clinicalFollowups.email')
    .optional()
    .isBoolean()
    .withMessage('Clinical followup email preference must be a boolean'),
  
  body('channels.clinicalFollowups.sms')
    .optional()
    .isBoolean()
    .withMessage('Clinical followup SMS preference must be a boolean'),
  
  body('channels.clinicalFollowups.push')
    .optional()
    .isBoolean()
    .withMessage('Clinical followup push preference must be a boolean'),
  
  body('channels.clinicalFollowups.whatsapp')
    .optional()
    .isBoolean()
    .withMessage('Clinical followup WhatsApp preference must be a boolean'),
  
  body('channels.generalNotifications.email')
    .optional()
    .isBoolean()
    .withMessage('General notification email preference must be a boolean'),
  
  body('channels.generalNotifications.sms')
    .optional()
    .isBoolean()
    .withMessage('General notification SMS preference must be a boolean'),
  
  body('channels.generalNotifications.push')
    .optional()
    .isBoolean()
    .withMessage('General notification push preference must be a boolean'),
  
  body('channels.generalNotifications.whatsapp')
    .optional()
    .isBoolean()
    .withMessage('General notification WhatsApp preference must be a boolean'),
  
  // Quiet hours
  body('quietHours.enabled')
    .optional()
    .isBoolean()
    .withMessage('Quiet hours enabled must be a boolean'),
  
  body('quietHours.startTime')
    .optional()
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage('Start time must be in HH:mm format'),
  
  body('quietHours.endTime')
    .optional()
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage('End time must be in HH:mm format'),
];

export const validateOptOutStatus = [
  ...validatePatientId,
  
  body('optOut')
    .isBoolean()
    .withMessage('Opt out status must be a boolean'),
];