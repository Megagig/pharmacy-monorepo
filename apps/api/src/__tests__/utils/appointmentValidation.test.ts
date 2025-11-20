/**
 * Appointment Validation Utilities Unit Tests
 * Tests validation functions and business rules
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

/// <reference types="jest" />

import mongoose from 'mongoose';
import {
  validateAppointmentData,
  validateTimeSlot,
  validateRecurrencePattern,
  validateAppointmentConflict,
  validateStatusTransition,
  validateOutcomeData,
  calculateAppointmentEndTime,
  isWorkingDay,
  isWithinWorkingHours,
  formatAppointmentTime,
  parseAppointmentTime,
} from '../../utils/appointmentValidation';

describe('Appointment Validation Utilities', () => {
  describe('validateAppointmentData', () => {
    it('should validate valid appointment data', () => {
      // Arrange
      const validData = {
        patientId: new mongoose.Types.ObjectId(),
        type: 'mtm_session',
        scheduledDate: new Date('2025-12-01'),
        scheduledTime: '10:00',
        duration: 30,
        title: 'MTM Session',
      };

      // Act & Assert
      expect(() => validateAppointmentData(validData)).not.toThrow();
    });

    it('should throw error for missing required fields', () => {
      // Arrange
      const invalidData = {
        type: 'mtm_session',
        scheduledDate: new Date('2025-12-01'),
        // Missing patientId, scheduledTime, duration
      };

      // Act & Assert
      expect(() => validateAppointmentData(invalidData as any)).toThrow('patientId is required');
    });

    it('should throw error for invalid appointment type', () => {
      // Arrange
      const invalidData = {
        patientId: new mongoose.Types.ObjectId(),
        type: 'invalid_type',
        scheduledDate: new Date('2025-12-01'),
        scheduledTime: '10:00',
        duration: 30,
      };

      // Act & Assert
      expect(() => validateAppointmentData(invalidData as any)).toThrow('Invalid appointment type');
    });

    it('should throw error for past scheduled date', () => {
      // Arrange
      const invalidData = {
        patientId: new mongoose.Types.ObjectId(),
        type: 'mtm_session',
        scheduledDate: new Date('2020-01-01'),
        scheduledTime: '10:00',
        duration: 30,
      };

      // Act & Assert
      expect(() => validateAppointmentData(invalidData)).toThrow('past');
    });

    it('should throw error for invalid duration', () => {
      // Arrange
      const invalidData = {
        patientId: new mongoose.Types.ObjectId(),
        type: 'mtm_session',
        scheduledDate: new Date('2025-12-01'),
        scheduledTime: '10:00',
        duration: 2, // Too short
      };

      // Act & Assert
      expect(() => validateAppointmentData(invalidData)).toThrow('Duration must be between');
    });

    it('should throw error for title too short', () => {
      // Arrange
      const invalidData = {
        patientId: new mongoose.Types.ObjectId(),
        type: 'mtm_session',
        scheduledDate: new Date('2025-12-01'),
        scheduledTime: '10:00',
        duration: 30,
        title: 'AB', // Too short
      };

      // Act & Assert
      expect(() => validateAppointmentData(invalidData)).toThrow('Title must be between');
    });
  });

  describe('validateTimeSlot', () => {
    it('should validate valid time slot', () => {
      // Act & Assert
      expect(() => validateTimeSlot('10:00')).not.toThrow();
      expect(() => validateTimeSlot('09:30')).not.toThrow();
      expect(() => validateTimeSlot('23:59')).not.toThrow();
    });

    it('should throw error for invalid time format', () => {
      // Act & Assert
      expect(() => validateTimeSlot('25:00')).toThrow('Invalid time format');
      expect(() => validateTimeSlot('10:60')).toThrow('Invalid time format');
      expect(() => validateTimeSlot('10')).toThrow('Invalid time format');
      expect(() => validateTimeSlot('10:0')).toThrow('Invalid time format');
    });

    it('should throw error for non-string input', () => {
      // Act & Assert
      expect(() => validateTimeSlot(null as any)).toThrow('Time must be a string');
      expect(() => validateTimeSlot(undefined as any)).toThrow('Time must be a string');
      expect(() => validateTimeSlot(123 as any)).toThrow('Time must be a string');
    });
  });

  describe('validateRecurrencePattern', () => {
    it('should validate valid recurrence pattern', () => {
      // Arrange
      const validPattern = {
        frequency: 'weekly' as const,
        interval: 1,
        endAfterOccurrences: 10,
      };

      // Act & Assert
      expect(() => validateRecurrencePattern(validPattern)).not.toThrow();
    });

    it('should validate pattern with end date', () => {
      // Arrange
      const validPattern = {
        frequency: 'monthly' as const,
        interval: 2,
        endDate: new Date('2026-12-01'),
      };

      // Act & Assert
      expect(() => validateRecurrencePattern(validPattern)).not.toThrow();
    });

    it('should validate pattern with days of week', () => {
      // Arrange
      const validPattern = {
        frequency: 'weekly' as const,
        interval: 1,
        daysOfWeek: [1, 3, 5], // Monday, Wednesday, Friday
        endAfterOccurrences: 20,
      };

      // Act & Assert
      expect(() => validateRecurrencePattern(validPattern)).not.toThrow();
    });

    it('should throw error for invalid frequency', () => {
      // Arrange
      const invalidPattern = {
        frequency: 'invalid' as any,
        interval: 1,
        endAfterOccurrences: 10,
      };

      // Act & Assert
      expect(() => validateRecurrencePattern(invalidPattern)).toThrow('Invalid frequency');
    });

    it('should throw error for invalid interval', () => {
      // Arrange
      const invalidPattern = {
        frequency: 'weekly' as const,
        interval: 0, // Invalid
        endAfterOccurrences: 10,
      };

      // Act & Assert
      expect(() => validateRecurrencePattern(invalidPattern)).toThrow('Interval must be between');
    });

    it('should throw error for invalid days of week', () => {
      // Arrange
      const invalidPattern = {
        frequency: 'weekly' as const,
        interval: 1,
        daysOfWeek: [1, 8], // 8 is invalid
        endAfterOccurrences: 10,
      };

      // Act & Assert
      expect(() => validateRecurrencePattern(invalidPattern)).toThrow('Days of week must be between');
    });

    it('should throw error for missing end condition', () => {
      // Arrange
      const invalidPattern = {
        frequency: 'weekly' as const,
        interval: 1,
        // Missing endDate or endAfterOccurrences
      };

      // Act & Assert
      expect(() => validateRecurrencePattern(invalidPattern)).toThrow('must specify either endDate or endAfterOccurrences');
    });
  });

  describe('validateAppointmentConflict', () => {
    it('should detect overlapping appointments', () => {
      // Arrange
      const existingAppointment = {
        scheduledDate: new Date('2025-12-01'),
        scheduledTime: '10:00',
        duration: 60,
      };

      const newAppointment = {
        scheduledDate: new Date('2025-12-01'),
        scheduledTime: '10:30',
        duration: 30,
      };

      // Act
      const hasConflict = validateAppointmentConflict(existingAppointment, newAppointment);

      // Assert
      expect(hasConflict).toBe(true);
    });

    it('should not detect conflict for non-overlapping appointments', () => {
      // Arrange
      const existingAppointment = {
        scheduledDate: new Date('2025-12-01'),
        scheduledTime: '10:00',
        duration: 30,
      };

      const newAppointment = {
        scheduledDate: new Date('2025-12-01'),
        scheduledTime: '10:30',
        duration: 30,
      };

      // Act
      const hasConflict = validateAppointmentConflict(existingAppointment, newAppointment);

      // Assert
      expect(hasConflict).toBe(false);
    });

    it('should not detect conflict for different dates', () => {
      // Arrange
      const existingAppointment = {
        scheduledDate: new Date('2025-12-01'),
        scheduledTime: '10:00',
        duration: 60,
      };

      const newAppointment = {
        scheduledDate: new Date('2025-12-02'),
        scheduledTime: '10:00',
        duration: 60,
      };

      // Act
      const hasConflict = validateAppointmentConflict(existingAppointment, newAppointment);

      // Assert
      expect(hasConflict).toBe(false);
    });

    it('should handle buffer time', () => {
      // Arrange
      const existingAppointment = {
        scheduledDate: new Date('2025-12-01'),
        scheduledTime: '10:00',
        duration: 30,
      };

      const newAppointment = {
        scheduledDate: new Date('2025-12-01'),
        scheduledTime: '10:30',
        duration: 30,
      };

      const bufferMinutes = 15;

      // Act
      const hasConflict = validateAppointmentConflict(
        existingAppointment,
        newAppointment,
        bufferMinutes
      );

      // Assert
      expect(hasConflict).toBe(true); // Should conflict due to buffer
    });
  });

  describe('validateStatusTransition', () => {
    it('should allow valid status transitions', () => {
      // Act & Assert
      expect(() => validateStatusTransition('scheduled', 'confirmed')).not.toThrow();
      expect(() => validateStatusTransition('confirmed', 'in_progress')).not.toThrow();
      expect(() => validateStatusTransition('in_progress', 'completed')).not.toThrow();
      expect(() => validateStatusTransition('scheduled', 'cancelled')).not.toThrow();
    });

    it('should throw error for invalid status transitions', () => {
      // Act & Assert
      expect(() => validateStatusTransition('completed', 'scheduled')).toThrow('Invalid status transition');
      expect(() => validateStatusTransition('cancelled', 'confirmed')).toThrow('Invalid status transition');
      expect(() => validateStatusTransition('no_show', 'in_progress')).toThrow('Invalid status transition');
    });

    it('should throw error for unknown statuses', () => {
      // Act & Assert
      expect(() => validateStatusTransition('invalid' as any, 'scheduled')).toThrow('Unknown status');
      expect(() => validateStatusTransition('scheduled', 'invalid' as any)).toThrow('Unknown status');
    });
  });

  describe('validateOutcomeData', () => {
    it('should validate valid outcome data', () => {
      // Arrange
      const validOutcome = {
        status: 'successful' as const,
        notes: 'Patient responded well to treatment',
        nextActions: ['Schedule follow-up in 3 months'],
        visitCreated: false,
      };

      // Act & Assert
      expect(() => validateOutcomeData(validOutcome)).not.toThrow();
    });

    it('should throw error for missing required fields', () => {
      // Arrange
      const invalidOutcome = {
        notes: 'Some notes',
        // Missing status
      };

      // Act & Assert
      expect(() => validateOutcomeData(invalidOutcome as any)).toThrow('Outcome status is required');
    });

    it('should throw error for invalid status', () => {
      // Arrange
      const invalidOutcome = {
        status: 'invalid' as any,
        notes: 'Some notes',
        nextActions: [],
        visitCreated: false,
      };

      // Act & Assert
      expect(() => validateOutcomeData(invalidOutcome)).toThrow('Invalid outcome status');
    });

    it('should throw error for empty notes', () => {
      // Arrange
      const invalidOutcome = {
        status: 'successful' as const,
        notes: '',
        nextActions: [],
        visitCreated: false,
      };

      // Act & Assert
      expect(() => validateOutcomeData(invalidOutcome)).toThrow('Outcome notes are required');
    });

    it('should throw error for notes too long', () => {
      // Arrange
      const longNotes = 'A'.repeat(2001); // Exceeds 2000 character limit
      const invalidOutcome = {
        status: 'successful' as const,
        notes: longNotes,
        nextActions: [],
        visitCreated: false,
      };

      // Act & Assert
      expect(() => validateOutcomeData(invalidOutcome)).toThrow('Outcome notes cannot exceed');
    });
  });

  describe('calculateAppointmentEndTime', () => {
    it('should calculate end time correctly', () => {
      // Arrange
      const date = new Date('2025-12-01');
      const time = '10:00';
      const duration = 30;

      // Act
      const endTime = calculateAppointmentEndTime(date, time, duration);

      // Assert
      expect(endTime.getHours()).toBe(10);
      expect(endTime.getMinutes()).toBe(30);
    });

    it('should handle appointments crossing hour boundary', () => {
      // Arrange
      const date = new Date('2025-12-01');
      const time = '10:45';
      const duration = 30;

      // Act
      const endTime = calculateAppointmentEndTime(date, time, duration);

      // Assert
      expect(endTime.getHours()).toBe(11);
      expect(endTime.getMinutes()).toBe(15);
    });

    it('should handle appointments crossing day boundary', () => {
      // Arrange
      const date = new Date('2025-12-01');
      const time = '23:45';
      const duration = 30;

      // Act
      const endTime = calculateAppointmentEndTime(date, time, duration);

      // Assert
      expect(endTime.getDate()).toBe(2); // Next day
      expect(endTime.getHours()).toBe(0);
      expect(endTime.getMinutes()).toBe(15);
    });
  });

  describe('isWorkingDay', () => {
    it('should identify working days correctly', () => {
      // Arrange
      const workingHours = [
        { dayOfWeek: 1, isWorkingDay: true }, // Monday
        { dayOfWeek: 2, isWorkingDay: true }, // Tuesday
        { dayOfWeek: 3, isWorkingDay: true }, // Wednesday
        { dayOfWeek: 4, isWorkingDay: true }, // Thursday
        { dayOfWeek: 5, isWorkingDay: true }, // Friday
        { dayOfWeek: 6, isWorkingDay: false }, // Saturday
        { dayOfWeek: 0, isWorkingDay: false }, // Sunday
      ];

      // Act & Assert
      expect(isWorkingDay(new Date('2025-12-01'), workingHours)).toBe(true); // Monday
      expect(isWorkingDay(new Date('2025-12-06'), workingHours)).toBe(false); // Saturday
      expect(isWorkingDay(new Date('2025-12-07'), workingHours)).toBe(false); // Sunday
    });

    it('should handle missing working hours configuration', () => {
      // Act & Assert
      expect(isWorkingDay(new Date('2025-12-01'), [])).toBe(false);
    });
  });

  describe('isWithinWorkingHours', () => {
    it('should validate time within working hours', () => {
      // Arrange
      const shifts = [
        { startTime: '09:00', endTime: '12:00' },
        { startTime: '13:00', endTime: '17:00' },
      ];

      // Act & Assert
      expect(isWithinWorkingHours('10:00', shifts)).toBe(true);
      expect(isWithinWorkingHours('14:30', shifts)).toBe(true);
      expect(isWithinWorkingHours('08:00', shifts)).toBe(false);
      expect(isWithinWorkingHours('12:30', shifts)).toBe(false);
      expect(isWithinWorkingHours('18:00', shifts)).toBe(false);
    });

    it('should handle break times', () => {
      // Arrange
      const shifts = [
        {
          startTime: '09:00',
          endTime: '17:00',
          breakStart: '12:00',
          breakEnd: '13:00',
        },
      ];

      // Act & Assert
      expect(isWithinWorkingHours('10:00', shifts)).toBe(true);
      expect(isWithinWorkingHours('12:30', shifts)).toBe(false); // During break
      expect(isWithinWorkingHours('14:00', shifts)).toBe(true);
    });
  });

  describe('formatAppointmentTime', () => {
    it('should format time correctly', () => {
      // Act & Assert
      expect(formatAppointmentTime(10, 0)).toBe('10:00');
      expect(formatAppointmentTime(9, 30)).toBe('09:30');
      expect(formatAppointmentTime(23, 59)).toBe('23:59');
    });

    it('should pad single digits with zeros', () => {
      // Act & Assert
      expect(formatAppointmentTime(9, 5)).toBe('09:05');
      expect(formatAppointmentTime(0, 0)).toBe('00:00');
    });
  });

  describe('parseAppointmentTime', () => {
    it('should parse time correctly', () => {
      // Act & Assert
      expect(parseAppointmentTime('10:00')).toEqual({ hours: 10, minutes: 0 });
      expect(parseAppointmentTime('09:30')).toEqual({ hours: 9, minutes: 30 });
      expect(parseAppointmentTime('23:59')).toEqual({ hours: 23, minutes: 59 });
    });

    it('should throw error for invalid time format', () => {
      // Act & Assert
      expect(() => parseAppointmentTime('25:00')).toThrow('Invalid time format');
      expect(() => parseAppointmentTime('10:60')).toThrow('Invalid time format');
      expect(() => parseAppointmentTime('invalid')).toThrow('Invalid time format');
    });
  });
});