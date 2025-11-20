/**
 * Comprehensive Appointment Errors Unit Tests
 * Tests all error classes, error handling, and edge cases
 * Requirements: 1.1, 1.2, 1.3, 1.4, 3.1, 3.2
 */

/// <reference types="jest" />

import {
  AppointmentError,
  AppointmentValidationError,
  AppointmentConflictError,
  AppointmentNotFoundError,
  AppointmentStatusError,
  FollowUpError,
  FollowUpValidationError,
  FollowUpNotFoundError,
  FollowUpStatusError,
  ScheduleError,
  ScheduleConflictError,
  ReminderError,
  ReminderDeliveryError,
  createAppointmentError,
  createFollowUpError,
  createScheduleError,
  createReminderError,
  isRetryableError,
  getErrorCode,
  formatErrorMessage,
  logError,
} from '../../utils/appointmentErrors';

// Mock logger
jest.mock('../../utils/logger');

describe('Appointment Error Classes', () => {
  describe('AppointmentError', () => {
    it('should create base appointment error', () => {
      const error = new AppointmentError('Base appointment error');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppointmentError);
      expect(error.message).toBe('Base appointment error');
      expect(error.name).toBe('AppointmentError');
      expect(error.code).toBe('APPOINTMENT_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.isRetryable).toBe(false);
    });

    it('should accept custom properties', () => {
      const error = new AppointmentError('Custom error', {
        code: 'CUSTOM_CODE',
        statusCode: 422,
        isRetryable: true,
        details: { field: 'value' },
      });

      expect(error.code).toBe('CUSTOM_CODE');
      expect(error.statusCode).toBe(422);
      expect(error.isRetryable).toBe(true);
      expect(error.details).toEqual({ field: 'value' });
    });

    it('should serialize to JSON correctly', () => {
      const error = new AppointmentError('Test error', {
        code: 'TEST_CODE',
        details: { appointmentId: '123' },
      });

      const json = error.toJSON();

      expect(json).toEqual({
        name: 'AppointmentError',
        message: 'Test error',
        code: 'TEST_CODE',
        statusCode: 400,
        isRetryable: false,
        details: { appointmentId: '123' },
        stack: expect.any(String),
      });
    });
  });

  describe('AppointmentValidationError', () => {
    it('should create validation error with field details', () => {
      const error = new AppointmentValidationError('Invalid duration', {
        field: 'duration',
        value: -5,
        constraint: 'must be positive',
      });

      expect(error).toBeInstanceOf(AppointmentError);
      expect(error.name).toBe('AppointmentValidationError');
      expect(error.code).toBe('APPOINTMENT_VALIDATION_ERROR');
      expect(error.statusCode).toBe(422);
      expect(error.details).toEqual({
        field: 'duration',
        value: -5,
        constraint: 'must be positive',
      });
    });

    it('should handle multiple validation errors', () => {
      const errors = [
        { field: 'duration', message: 'Duration is required' },
        { field: 'scheduledTime', message: 'Invalid time format' },
      ];

      const error = new AppointmentValidationError('Multiple validation errors', {
        validationErrors: errors,
      });

      expect(error.details.validationErrors).toEqual(errors);
    });
  });

  describe('AppointmentConflictError', () => {
    it('should create conflict error with appointment details', () => {
      const conflictingAppointment = {
        id: 'existing-123',
        title: 'Existing Appointment',
        scheduledTime: '10:00',
      };

      const error = new AppointmentConflictError('Time slot conflict', {
        conflictingAppointment,
        requestedTime: '10:30',
      });

      expect(error.name).toBe('AppointmentConflictError');
      expect(error.code).toBe('APPOINTMENT_CONFLICT');
      expect(error.statusCode).toBe(409);
      expect(error.details.conflictingAppointment).toEqual(conflictingAppointment);
      expect(error.details.requestedTime).toBe('10:30');
    });
  });

  describe('AppointmentNotFoundError', () => {
    it('should create not found error', () => {
      const error = new AppointmentNotFoundError('appointment-123');

      expect(error.name).toBe('AppointmentNotFoundError');
      expect(error.code).toBe('APPOINTMENT_NOT_FOUND');
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Appointment not found: appointment-123');
      expect(error.details.appointmentId).toBe('appointment-123');
    });
  });

  describe('AppointmentStatusError', () => {
    it('should create status error with transition details', () => {
      const error = new AppointmentStatusError(
        'Invalid status transition',
        'completed',
        'scheduled'
      );

      expect(error.name).toBe('AppointmentStatusError');
      expect(error.code).toBe('APPOINTMENT_STATUS_ERROR');
      expect(error.details.currentStatus).toBe('completed');
      expect(error.details.requestedStatus).toBe('scheduled');
    });
  });
});

describe('Follow-up Error Classes', () => {
  describe('FollowUpError', () => {
    it('should create base follow-up error', () => {
      const error = new FollowUpError('Follow-up error');

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('FollowUpError');
      expect(error.code).toBe('FOLLOWUP_ERROR');
      expect(error.statusCode).toBe(400);
    });
  });

  describe('FollowUpValidationError', () => {
    it('should create validation error for follow-up', () => {
      const error = new FollowUpValidationError('Invalid priority', {
        field: 'priority',
        value: 'invalid',
      });

      expect(error.name).toBe('FollowUpValidationError');
      expect(error.code).toBe('FOLLOWUP_VALIDATION_ERROR');
      expect(error.statusCode).toBe(422);
    });
  });

  describe('FollowUpNotFoundError', () => {
    it('should create not found error for follow-up', () => {
      const error = new FollowUpNotFoundError('task-123');

      expect(error.message).toBe('Follow-up task not found: task-123');
      expect(error.details.taskId).toBe('task-123');
    });
  });

  describe('FollowUpStatusError', () => {
    it('should create status error for follow-up', () => {
      const error = new FollowUpStatusError(
        'Cannot complete task',
        'completed',
        'pending'
      );

      expect(error.details.currentStatus).toBe('completed');
      expect(error.details.requestedStatus).toBe('pending');
    });
  });
});

describe('Schedule Error Classes', () => {
  describe('ScheduleError', () => {
    it('should create base schedule error', () => {
      const error = new ScheduleError('Schedule error');

      expect(error.name).toBe('ScheduleError');
      expect(error.code).toBe('SCHEDULE_ERROR');
    });
  });

  describe('ScheduleConflictError', () => {
    it('should create schedule conflict error', () => {
      const error = new ScheduleConflictError('Working hours conflict', {
        pharmacistId: 'pharm-123',
        conflictingPeriod: '09:00-17:00',
      });

      expect(error.name).toBe('ScheduleConflictError');
      expect(error.code).toBe('SCHEDULE_CONFLICT');
      expect(error.details.pharmacistId).toBe('pharm-123');
    });
  });
});

describe('Reminder Error Classes', () => {
  describe('ReminderError', () => {
    it('should create base reminder error', () => {
      const error = new ReminderError('Reminder error');

      expect(error.name).toBe('ReminderError');
      expect(error.code).toBe('REMINDER_ERROR');
    });
  });

  describe('ReminderDeliveryError', () => {
    it('should create delivery error with channel details', () => {
      const error = new ReminderDeliveryError('SMS delivery failed', {
        channel: 'sms',
        recipientId: 'patient-123',
        provider: 'twilio',
        providerError: 'Invalid phone number',
      });

      expect(error.name).toBe('ReminderDeliveryError');
      expect(error.code).toBe('REMINDER_DELIVERY_ERROR');
      expect(error.isRetryable).toBe(true); // Delivery errors are retryable by default
      expect(error.details.channel).toBe('sms');
      expect(error.details.providerError).toBe('Invalid phone number');
    });

    it('should handle non-retryable delivery errors', () => {
      const error = new ReminderDeliveryError('Invalid recipient', {
        channel: 'email',
        recipientId: 'patient-123',
        isRetryable: false,
      });

      expect(error.isRetryable).toBe(false);
    });
  });
});

describe('Error Factory Functions', () => {
  describe('createAppointmentError', () => {
    it('should create appropriate error type based on type parameter', () => {
      const validationError = createAppointmentError('validation', 'Invalid data');
      expect(validationError).toBeInstanceOf(AppointmentValidationError);

      const conflictError = createAppointmentError('conflict', 'Time conflict');
      expect(conflictError).toBeInstanceOf(AppointmentConflictError);

      const notFoundError = createAppointmentError('not_found', 'Not found', {
        appointmentId: '123',
      });
      expect(notFoundError).toBeInstanceOf(AppointmentNotFoundError);

      const statusError = createAppointmentError('status', 'Invalid status');
      expect(statusError).toBeInstanceOf(AppointmentStatusError);

      const genericError = createAppointmentError('generic', 'Generic error');
      expect(genericError).toBeInstanceOf(AppointmentError);
    });

    it('should pass through options correctly', () => {
      const error = createAppointmentError('validation', 'Test error', {
        field: 'duration',
        value: -5,
      });

      expect(error.details.field).toBe('duration');
      expect(error.details.value).toBe(-5);
    });
  });

  describe('createFollowUpError', () => {
    it('should create appropriate follow-up error types', () => {
      const validationError = createFollowUpError('validation', 'Invalid data');
      expect(validationError).toBeInstanceOf(FollowUpValidationError);

      const notFoundError = createFollowUpError('not_found', 'Not found');
      expect(notFoundError).toBeInstanceOf(FollowUpNotFoundError);

      const statusError = createFollowUpError('status', 'Invalid status');
      expect(statusError).toBeInstanceOf(FollowUpStatusError);

      const genericError = createFollowUpError('generic', 'Generic error');
      expect(genericError).toBeInstanceOf(FollowUpError);
    });
  });

  describe('createScheduleError', () => {
    it('should create appropriate schedule error types', () => {
      const conflictError = createScheduleError('conflict', 'Schedule conflict');
      expect(conflictError).toBeInstanceOf(ScheduleConflictError);

      const genericError = createScheduleError('generic', 'Generic error');
      expect(genericError).toBeInstanceOf(ScheduleError);
    });
  });

  describe('createReminderError', () => {
    it('should create appropriate reminder error types', () => {
      const deliveryError = createReminderError('delivery', 'Delivery failed');
      expect(deliveryError).toBeInstanceOf(ReminderDeliveryError);

      const genericError = createReminderError('generic', 'Generic error');
      expect(genericError).toBeInstanceOf(ReminderError);
    });
  });
});

describe('Error Utility Functions', () => {
  describe('isRetryableError', () => {
    it('should identify retryable errors correctly', () => {
      const retryableError = new AppointmentError('Retryable', { isRetryable: true });
      const nonRetryableError = new AppointmentError('Non-retryable', { isRetryable: false });
      const deliveryError = new ReminderDeliveryError('Delivery failed'); // Retryable by default

      expect(isRetryableError(retryableError)).toBe(true);
      expect(isRetryableError(nonRetryableError)).toBe(false);
      expect(isRetryableError(deliveryError)).toBe(true);
    });

    it('should handle network errors as retryable', () => {
      const networkError = new Error('ECONNRESET');
      const timeoutError = new Error('ETIMEDOUT');
      const dnsError = new Error('ENOTFOUND');

      expect(isRetryableError(networkError)).toBe(true);
      expect(isRetryableError(timeoutError)).toBe(true);
      expect(isRetryableError(dnsError)).toBe(true);
    });

    it('should handle validation errors as non-retryable', () => {
      const validationError = new AppointmentValidationError('Invalid data');
      const notFoundError = new AppointmentNotFoundError('123');

      expect(isRetryableError(validationError)).toBe(false);
      expect(isRetryableError(notFoundError)).toBe(false);
    });

    it('should handle generic errors based on message content', () => {
      const connectionError = new Error('Connection failed');
      const serverError = new Error('Internal server error');
      const validationError = new Error('Invalid input');

      expect(isRetryableError(connectionError)).toBe(true);
      expect(isRetryableError(serverError)).toBe(true);
      expect(isRetryableError(validationError)).toBe(false);
    });
  });

  describe('getErrorCode', () => {
    it('should return error code for custom errors', () => {
      const appointmentError = new AppointmentError('Test');
      const validationError = new AppointmentValidationError('Test');
      const conflictError = new AppointmentConflictError('Test');

      expect(getErrorCode(appointmentError)).toBe('APPOINTMENT_ERROR');
      expect(getErrorCode(validationError)).toBe('APPOINTMENT_VALIDATION_ERROR');
      expect(getErrorCode(conflictError)).toBe('APPOINTMENT_CONFLICT');
    });

    it('should return generic code for standard errors', () => {
      const genericError = new Error('Generic error');
      const typeError = new TypeError('Type error');

      expect(getErrorCode(genericError)).toBe('UNKNOWN_ERROR');
      expect(getErrorCode(typeError)).toBe('UNKNOWN_ERROR');
    });

    it('should handle null and undefined', () => {
      expect(getErrorCode(null)).toBe('UNKNOWN_ERROR');
      expect(getErrorCode(undefined)).toBe('UNKNOWN_ERROR');
    });
  });

  describe('formatErrorMessage', () => {
    it('should format error message with context', () => {
      const error = new AppointmentValidationError('Invalid duration', {
        field: 'duration',
        value: -5,
      });

      const formatted = formatErrorMessage(error, {
        operation: 'createAppointment',
        appointmentId: '123',
      });

      expect(formatted).toContain('Invalid duration');
      expect(formatted).toContain('Operation: createAppointment');
      expect(formatted).toContain('Appointment ID: 123');
      expect(formatted).toContain('Field: duration');
    });

    it('should handle errors without details', () => {
      const error = new Error('Simple error');

      const formatted = formatErrorMessage(error, {
        operation: 'test',
      });

      expect(formatted).toContain('Simple error');
      expect(formatted).toContain('Operation: test');
    });

    it('should handle missing context', () => {
      const error = new AppointmentError('Test error');

      const formatted = formatErrorMessage(error);

      expect(formatted).toBe('Test error');
    });
  });

  describe('logError', () => {
    it('should log error with appropriate level', () => {
      const logger = require('../../utils/logger');
      
      const retryableError = new ReminderDeliveryError('Delivery failed');
      const nonRetryableError = new AppointmentValidationError('Invalid data');

      logError(retryableError, { operation: 'sendReminder' });
      logError(nonRetryableError, { operation: 'createAppointment' });

      expect(logger.warn).toHaveBeenCalledWith(
        'Retryable error occurred',
        expect.objectContaining({
          error: expect.any(String),
          code: 'REMINDER_DELIVERY_ERROR',
          operation: 'sendReminder',
        })
      );

      expect(logger.error).toHaveBeenCalledWith(
        'Non-retryable error occurred',
        expect.objectContaining({
          error: expect.any(String),
          code: 'APPOINTMENT_VALIDATION_ERROR',
          operation: 'createAppointment',
        })
      );
    });

    it('should include stack trace for non-retryable errors', () => {
      const logger = require('../../utils/logger');
      
      const error = new AppointmentError('Test error');
      logError(error);

      expect(logger.error).toHaveBeenCalledWith(
        'Non-retryable error occurred',
        expect.objectContaining({
          stack: expect.any(String),
        })
      );
    });

    it('should handle errors without stack trace', () => {
      const logger = require('../../utils/logger');
      
      const error = { message: 'Plain object error' };
      logError(error as any);

      expect(logger.error).toHaveBeenCalledWith(
        'Non-retryable error occurred',
        expect.objectContaining({
          error: 'Plain object error',
        })
      );
    });
  });
});

describe('Error Inheritance and Polymorphism', () => {
  it('should maintain proper inheritance chain', () => {
    const validationError = new AppointmentValidationError('Test');

    expect(validationError instanceof Error).toBe(true);
    expect(validationError instanceof AppointmentError).toBe(true);
    expect(validationError instanceof AppointmentValidationError).toBe(true);
  });

  it('should allow polymorphic error handling', () => {
    const errors = [
      new AppointmentError('Generic'),
      new AppointmentValidationError('Validation'),
      new AppointmentConflictError('Conflict'),
      new FollowUpError('Follow-up'),
      new ReminderError('Reminder'),
    ];

    errors.forEach(error => {
      expect(error).toBeInstanceOf(Error);
      expect(typeof error.message).toBe('string');
      expect(typeof error.code).toBe('string');
      expect(typeof error.statusCode).toBe('number');
    });
  });

  it('should support error type checking', () => {
    const error = new AppointmentValidationError('Test');

    if (error instanceof AppointmentValidationError) {
      expect(error.code).toBe('APPOINTMENT_VALIDATION_ERROR');
    }

    if (error instanceof AppointmentError) {
      expect(error.statusCode).toBe(422);
    }
  });
});

describe('Error Serialization and Deserialization', () => {
  it('should serialize error to JSON correctly', () => {
    const error = new AppointmentConflictError('Time conflict', {
      conflictingAppointment: { id: '123', title: 'Existing' },
      requestedTime: '10:00',
    });

    const json = JSON.stringify(error);
    const parsed = JSON.parse(json);

    expect(parsed.name).toBe('AppointmentConflictError');
    expect(parsed.message).toBe('Time conflict');
    expect(parsed.code).toBe('APPOINTMENT_CONFLICT');
    expect(parsed.details.conflictingAppointment.id).toBe('123');
  });

  it('should handle circular references in details', () => {
    const circular: any = { name: 'test' };
    circular.self = circular;

    const error = new AppointmentError('Test', { details: circular });

    expect(() => JSON.stringify(error)).not.toThrow();
  });

  it('should preserve error properties after JSON round-trip', () => {
    const original = new ReminderDeliveryError('Delivery failed', {
      channel: 'email',
      isRetryable: true,
    });

    const json = JSON.stringify(original);
    const parsed = JSON.parse(json);

    expect(parsed.name).toBe(original.name);
    expect(parsed.message).toBe(original.message);
    expect(parsed.code).toBe(original.code);
    expect(parsed.isRetryable).toBe(original.isRetryable);
    expect(parsed.details.channel).toBe(original.details.channel);
  });
});

describe('Error Context and Debugging', () => {
  it('should capture stack trace correctly', () => {
    const error = new AppointmentError('Test error');

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('AppointmentError');
    expect(error.stack).toContain('Test error');
  });

  it('should include helpful debugging information', () => {
    const error = new AppointmentValidationError('Invalid appointment data', {
      field: 'scheduledDate',
      value: 'invalid-date',
      constraint: 'must be a valid date',
      receivedType: 'string',
      expectedType: 'Date',
    });

    expect(error.details.field).toBe('scheduledDate');
    expect(error.details.value).toBe('invalid-date');
    expect(error.details.constraint).toBe('must be a valid date');
    expect(error.details.receivedType).toBe('string');
    expect(error.details.expectedType).toBe('Date');
  });

  it('should support error chaining', () => {
    const originalError = new Error('Database connection failed');
    const wrappedError = new AppointmentError('Failed to create appointment', {
      cause: originalError,
    });

    expect(wrappedError.details.cause).toBe(originalError);
    expect(wrappedError.message).toBe('Failed to create appointment');
  });
});