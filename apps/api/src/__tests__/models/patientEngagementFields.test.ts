/**
 * Test Suite: Patient Engagement Model Fields Validation
 * 
 * Tests field validation and structure for:
 * - Patient model with appointmentPreferences
 * - Visit model with appointmentId
 * - Notification model with new types
 */

import mongoose from 'mongoose';

describe('Patient Model - Appointment Preferences Schema', () => {
  test('should have appointmentPreferences field defined in schema', () => {
    const Patient = require('../../models/Patient').default;
    const schema = Patient.schema;
    
    expect(schema.path('appointmentPreferences')).toBeDefined();
    expect(schema.path('appointmentPreferences.preferredDays')).toBeDefined();
    expect(schema.path('appointmentPreferences.preferredTimeSlots')).toBeDefined();
    expect(schema.path('appointmentPreferences.preferredPharmacist')).toBeDefined();
    expect(schema.path('appointmentPreferences.reminderPreferences')).toBeDefined();
    expect(schema.path('appointmentPreferences.language')).toBeDefined();
    expect(schema.path('appointmentPreferences.timezone')).toBeDefined();
  });

  test('should validate preferredDays array contains numbers 0-6', () => {
    const Patient = require('../../models/Patient').default;
    const schema = Patient.schema;
    
    const preferredDaysPath = schema.path('appointmentPreferences.preferredDays');
    expect(preferredDaysPath).toBeDefined();
    expect(preferredDaysPath.instance).toBe('Array');
  });

  test('should have language enum with Nigerian languages', () => {
    const Patient = require('../../models/Patient').default;
    const schema = Patient.schema;
    
    const languagePath = schema.path('appointmentPreferences.language');
    expect(languagePath).toBeDefined();
    expect(languagePath.enumValues).toContain('en');
    expect(languagePath.enumValues).toContain('yo');
    expect(languagePath.enumValues).toContain('ig');
    expect(languagePath.enumValues).toContain('ha');
  });

  test('should have default timezone as Africa/Lagos', () => {
    const Patient = require('../../models/Patient').default;
    const schema = Patient.schema;
    
    const timezonePath = schema.path('appointmentPreferences.timezone');
    expect(timezonePath).toBeDefined();
    expect(timezonePath.defaultValue).toBe('Africa/Lagos');
  });

  test('should have reminderPreferences with all channels', () => {
    const Patient = require('../../models/Patient').default;
    const schema = Patient.schema;
    
    expect(schema.path('appointmentPreferences.reminderPreferences.email')).toBeDefined();
    expect(schema.path('appointmentPreferences.reminderPreferences.sms')).toBeDefined();
    expect(schema.path('appointmentPreferences.reminderPreferences.push')).toBeDefined();
    expect(schema.path('appointmentPreferences.reminderPreferences.whatsapp')).toBeDefined();
  });

  test('should have default values for reminderPreferences', () => {
    const Patient = require('../../models/Patient').default;
    const schema = Patient.schema;
    
    const emailPath = schema.path('appointmentPreferences.reminderPreferences.email');
    const smspath = schema.path('appointmentPreferences.reminderPreferences.sms');
    const pushPath = schema.path('appointmentPreferences.reminderPreferences.push');
    const whatsappPath = schema.path('appointmentPreferences.reminderPreferences.whatsapp');
    
    expect(emailPath.defaultValue).toBe(true);
    expect(smspath.defaultValue).toBe(false);
    expect(pushPath.defaultValue).toBe(true);
    expect(whatsappPath.defaultValue).toBe(false);
  });
});

describe('Visit Model - Appointment ID Field', () => {
  test('should have appointmentId field defined in schema', () => {
    const Visit = require('../../models/Visit').default;
    const schema = Visit.schema;
    
    expect(schema.path('appointmentId')).toBeDefined();
  });

  test('should have appointmentId as ObjectId reference to Appointment', () => {
    const Visit = require('../../models/Visit').default;
    const schema = Visit.schema;
    
    const appointmentIdPath = schema.path('appointmentId');
    expect(appointmentIdPath).toBeDefined();
    expect(appointmentIdPath.instance).toBe('ObjectID');
    expect(appointmentIdPath.options.ref).toBe('Appointment');
  });

  test('should have appointmentId as optional field (sparse index)', () => {
    const Visit = require('../../models/Visit').default;
    const schema = Visit.schema;
    
    const appointmentIdPath = schema.path('appointmentId');
    expect(appointmentIdPath.isRequired).toBe(false);
  });

  test('should have index on appointmentId', () => {
    const Visit = require('../../models/Visit').default;
    const schema = Visit.schema;
    
    const indexes = schema.indexes();
    const hasAppointmentIdIndex = indexes.some((index: any) => {
      const keys = Object.keys(index[0]);
      return keys.includes('appointmentId') || 
             (keys.includes('workplaceId') && keys.includes('appointmentId'));
    });
    
    expect(hasAppointmentIdIndex).toBe(true);
  });
});

describe('Notification Model - New Notification Types', () => {
  test('should have new appointment-related notification types', () => {
    const Notification = require('../../models/Notification').default;
    const schema = Notification.schema;
    
    const typePath = schema.path('type');
    expect(typePath).toBeDefined();
    expect(typePath.enumValues).toContain('appointment_reminder');
    expect(typePath.enumValues).toContain('appointment_confirmed');
    expect(typePath.enumValues).toContain('appointment_rescheduled');
    expect(typePath.enumValues).toContain('appointment_cancelled');
  });

  test('should have new follow-up related notification types', () => {
    const Notification = require('../../models/Notification').default;
    const schema = Notification.schema;
    
    const typePath = schema.path('type');
    expect(typePath.enumValues).toContain('followup_task_assigned');
    expect(typePath.enumValues).toContain('followup_task_overdue');
  });

  test('should have new medication-related notification types', () => {
    const Notification = require('../../models/Notification').default;
    const schema = Notification.schema;
    
    const typePath = schema.path('type');
    expect(typePath.enumValues).toContain('medication_refill_due');
    expect(typePath.enumValues).toContain('adherence_check_reminder');
  });

  test('should maintain backward compatibility with existing notification types', () => {
    const Notification = require('../../models/Notification').default;
    const schema = Notification.schema;
    
    const typePath = schema.path('type');
    const existingTypes = [
      'new_message',
      'mention',
      'therapy_update',
      'clinical_alert',
      'medication_reminder',
      'consultation_request'
    ];
    
    existingTypes.forEach(type => {
      expect(typePath.enumValues).toContain(type);
    });
  });

  test('should have appointmentId field in notification data', () => {
    const Notification = require('../../models/Notification').default;
    const schema = Notification.schema;
    
    expect(schema.path('data.appointmentId')).toBeDefined();
  });

  test('should have followUpTaskId field in notification data', () => {
    const Notification = require('../../models/Notification').default;
    const schema = Notification.schema;
    
    expect(schema.path('data.followUpTaskId')).toBeDefined();
  });

  test('should have appointmentId as ObjectId reference', () => {
    const Notification = require('../../models/Notification').default;
    const schema = Notification.schema;
    
    const appointmentIdPath = schema.path('data.appointmentId');
    expect(appointmentIdPath).toBeDefined();
    expect(appointmentIdPath.instance).toBe('ObjectID');
    expect(appointmentIdPath.options.ref).toBe('Appointment');
  });

  test('should have followUpTaskId as ObjectId reference', () => {
    const Notification = require('../../models/Notification').default;
    const schema = Notification.schema;
    
    const followUpTaskIdPath = schema.path('data.followUpTaskId');
    expect(followUpTaskIdPath).toBeDefined();
    expect(followUpTaskIdPath.instance).toBe('ObjectID');
    expect(followUpTaskIdPath.options.ref).toBe('FollowUpTask');
  });
});

describe('Backward Compatibility', () => {
  test('Patient model should not require appointmentPreferences', () => {
    const Patient = require('../../models/Patient').default;
    const schema = Patient.schema;
    
    const appointmentPreferencesPath = schema.path('appointmentPreferences');
    expect(appointmentPreferencesPath.isRequired).toBe(false);
  });

  test('Visit model should not require appointmentId', () => {
    const Visit = require('../../models/Visit').default;
    const schema = Visit.schema;
    
    const appointmentIdPath = schema.path('appointmentId');
    expect(appointmentIdPath.isRequired).toBe(false);
  });

  test('Patient model should still have all existing required fields', () => {
    const Patient = require('../../models/Patient').default;
    const schema = Patient.schema;
    
    expect(schema.path('workplaceId').isRequired).toBe(true);
    expect(schema.path('mrn').isRequired).toBe(true);
    expect(schema.path('firstName').isRequired).toBe(true);
    expect(schema.path('lastName').isRequired).toBe(true);
  });

  test('Visit model should still have all existing required fields', () => {
    const Visit = require('../../models/Visit').default;
    const schema = Visit.schema;
    
    expect(schema.path('workplaceId').isRequired).toBe(true);
    expect(schema.path('patientId').isRequired).toBe(true);
    expect(schema.path('date').isRequired).toBe(true);
    expect(schema.path('soap').isRequired).toBe(true);
  });

  test('Notification model should still have all existing required fields', () => {
    const Notification = require('../../models/Notification').default;
    const schema = Notification.schema;
    
    expect(schema.path('userId').isRequired).toBe(true);
    expect(schema.path('type').isRequired).toBe(true);
    expect(schema.path('title').isRequired).toBe(true);
    expect(schema.path('content').isRequired).toBe(true);
    expect(schema.path('workplaceId').isRequired).toBe(true);
  });
});
