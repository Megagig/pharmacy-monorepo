/**
 * Slot Generation Service
 * Handles intelligent appointment slot generation based on pharmacist schedules
 * Requirements: Complete scheduling system with business rules
 */

import mongoose from 'mongoose';
import { addMinutes, parse, format, isWithinInterval } from 'date-fns';
import PharmacistSchedule, { IPharmacistSchedule } from '../models/PharmacistSchedule';
import Appointment, { IAppointment } from '../models/Appointment';
import logger from '../utils/logger';

export interface TimeSlot {
  time: string;
  available: boolean;
  pharmacistId: mongoose.Types.ObjectId;
  pharmacistName?: string;
  conflictReason?: string;
  conflictingAppointment?: IAppointment;
  slotType?: 'regular' | 'break' | 'buffer';
}

export interface SlotGenerationOptions {
  date: Date;
  pharmacistId?: mongoose.Types.ObjectId;
  duration: number;
  appointmentType?: string;
  workplaceId: mongoose.Types.ObjectId;
  slotInterval?: number; // Default 15 minutes
  includeUnavailable?: boolean; // Include unavailable slots in response
}

export interface PharmacistSlotStats {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  totalSlots: number;
  availableSlots: number;
  utilizationRate: number;
  workingHours: string;
  nextAvailableSlot?: string;
}

export class SlotGenerationService {
  /**
   * Generate available slots for a specific date and criteria
   */
  static async generateAvailableSlots(options: SlotGenerationOptions): Promise<{
    slots: TimeSlot[];
    pharmacists: PharmacistSlotStats[];
    summary: {
      totalSlots: number;
      availableSlots: number;
      unavailableSlots: number;
      utilizationRate: number;
    };
  }> {
    try {
      const {
        date,
        pharmacistId,
        duration,
        appointmentType,
        workplaceId,
        slotInterval = 15,
        includeUnavailable = false
      } = options;

      logger.info('Generating available slots', {
        date: format(date, 'yyyy-MM-dd'),
        pharmacistId: pharmacistId?.toString(),
        duration,
        appointmentType,
        workplaceId: workplaceId.toString()
      });

      // Get pharmacist schedules
      const scheduleQuery: any = {
        workplaceId,
        isActive: true,
        effectiveFrom: { $lte: date },
        $or: [
          { effectiveTo: { $exists: false } },
          { effectiveTo: null },
          { effectiveTo: { $gte: date } }
        ]
      };

      if (pharmacistId) {
        scheduleQuery.pharmacistId = pharmacistId;
      }

      const schedules = await PharmacistSchedule.find(scheduleQuery)
        .populate('pharmacistId', 'firstName lastName email')
        .lean();

      if (schedules.length === 0) {
        logger.warn('No pharmacist schedules found', { query: scheduleQuery });
        return {
          slots: [],
          pharmacists: [],
          summary: {
            totalSlots: 0,
            availableSlots: 0,
            unavailableSlots: 0,
            utilizationRate: 0
          }
        };
      }

      // Get existing appointments for the date
      const appointmentQuery: any = {
        workplaceId,
        scheduledDate: {
          $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
          $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
        },
        status: { $nin: ['cancelled', 'no_show'] },
        isDeleted: false
      };

      if (pharmacistId) {
        appointmentQuery.assignedTo = pharmacistId;
      }

      const existingAppointments = await Appointment.find(appointmentQuery).lean();

      logger.info('Found existing appointments', {
        count: existingAppointments.length,
        date: format(date, 'yyyy-MM-dd')
      });

      // Generate slots for each pharmacist
      const allSlots: TimeSlot[] = [];
      const pharmacistStats: PharmacistSlotStats[] = [];

      for (const schedule of schedules) {
        const pharmacist = schedule.pharmacistId as any;

        // Check if pharmacist can handle this appointment type
        if (appointmentType && !schedule.appointmentPreferences.appointmentTypes.includes(appointmentType)) {
          logger.debug('Pharmacist cannot handle appointment type', {
            pharmacistId: pharmacist._id.toString(),
            appointmentType,
            supportedTypes: schedule.appointmentPreferences.appointmentTypes
          });
          continue;
        }

        // Check if pharmacist is working on this date
        if (!this.isPharmacistWorkingOn(schedule, date)) {
          logger.debug('Pharmacist not working on date', {
            pharmacistId: pharmacist._id.toString(),
            date: format(date, 'yyyy-MM-dd')
          });
          continue;
        }

        // Generate slots for this pharmacist
        const pharmacistAppointments = existingAppointments.filter(
          apt => apt.assignedTo.toString() === schedule.pharmacistId._id.toString()
        );

        const pharmacistSlots = await this.generateSlotsForPharmacist(
          schedule,
          date,
          duration,
          pharmacistAppointments,
          slotInterval,
          includeUnavailable
        );

        // Add pharmacist info to slots
        const slotsWithPharmacist = pharmacistSlots.map(slot => ({
          ...slot,
          pharmacistId: schedule.pharmacistId._id,
          pharmacistName: `${pharmacist.firstName} ${pharmacist.lastName}`
        }));

        allSlots.push(...slotsWithPharmacist);

        // Calculate stats
        const availableCount = slotsWithPharmacist.filter(s => s.available).length;
        const totalCount = slotsWithPharmacist.length;
        const utilizationRate = totalCount > 0 ? Math.round(((totalCount - availableCount) / totalCount) * 100) : 0;

        // Find next available slot
        const nextAvailable = slotsWithPharmacist.find(s => s.available);

        // Get working hours summary
        const workingHours = this.getWorkingHoursSummary(schedule, date);

        pharmacistStats.push({
          _id: schedule.pharmacistId._id,
          name: `${pharmacist.firstName} ${pharmacist.lastName}`,
          email: pharmacist.email,
          totalSlots: totalCount,
          availableSlots: availableCount,
          utilizationRate,
          workingHours,
          nextAvailableSlot: nextAvailable?.time
        });
      }

      // Sort slots by time
      allSlots.sort((a, b) => a.time.localeCompare(b.time));

      // Calculate summary
      const totalSlots = allSlots.length;
      const availableSlots = allSlots.filter(s => s.available).length;
      const unavailableSlots = totalSlots - availableSlots;
      const overallUtilizationRate = totalSlots > 0 ? Math.round((unavailableSlots / totalSlots) * 100) : 0;

      const result = {
        slots: allSlots,
        pharmacists: pharmacistStats,
        summary: {
          totalSlots,
          availableSlots,
          unavailableSlots,
          utilizationRate: overallUtilizationRate
        }
      };

      logger.info('Generated slots successfully', {
        totalSlots,
        availableSlots,
        pharmacistsCount: pharmacistStats.length
      });

      return result;

    } catch (error) {
      logger.error('Error generating available slots:', error);
      throw error;
    }
  }

  /**
   * Generate slots for a specific pharmacist
   */
  private static async generateSlotsForPharmacist(
    schedule: IPharmacistSchedule,
    date: Date,
    duration: number,
    existingAppointments: IAppointment[],
    slotInterval: number,
    includeUnavailable: boolean
  ): Promise<Omit<TimeSlot, 'pharmacistId' | 'pharmacistName'>[]> {
    const slots: Omit<TimeSlot, 'pharmacistId' | 'pharmacistName'>[] = [];

    // Get shifts for the date
    const dayOfWeek = date.getDay();
    const daySchedule = schedule.workingHours.find(wh => wh.dayOfWeek === dayOfWeek);

    if (!daySchedule || !daySchedule.isWorkingDay || !daySchedule.shifts) {
      return slots;
    }

    const bufferTime = schedule.appointmentPreferences.bufferBetweenAppointments || 0;
    const maxAppointments = schedule.appointmentPreferences.maxAppointmentsPerDay;

    // Check daily appointment limit
    if (maxAppointments && existingAppointments.length >= maxAppointments) {
      logger.debug('Daily appointment limit reached', {
        pharmacistId: schedule.pharmacistId.toString(),
        maxAppointments,
        currentAppointments: existingAppointments.length
      });
      return slots; // No more slots available due to daily limit
    }

    // Generate slots for each shift
    for (const shift of daySchedule.shifts) {
      const shiftSlots = this.generateSlotsForShift(
        shift,
        date,
        duration,
        existingAppointments,
        slotInterval,
        bufferTime,
        includeUnavailable
      );
      slots.push(...shiftSlots);
    }

    return slots;
  }

  /**
   * Generate slots for a specific shift
   */
  private static generateSlotsForShift(
    shift: { startTime: string; endTime: string; breakStart?: string; breakEnd?: string },
    date: Date,
    duration: number,
    existingAppointments: IAppointment[],
    slotInterval: number,
    bufferTime: number,
    includeUnavailable: boolean
  ): Omit<TimeSlot, 'pharmacistId' | 'pharmacistName'>[] {
    const slots: Omit<TimeSlot, 'pharmacistId' | 'pharmacistName'>[] = [];

    const [startHour, startMin] = shift.startTime.split(':').map(Number);
    const [endHour, endMin] = shift.endTime.split(':').map(Number);

    let currentMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    // Parse break times if provided
    let breakStartMinutes: number | null = null;
    let breakEndMinutes: number | null = null;

    if (shift.breakStart && shift.breakEnd) {
      const [breakStartHour, breakStartMin] = shift.breakStart.split(':').map(Number);
      const [breakEndHour, breakEndMin] = shift.breakEnd.split(':').map(Number);
      breakStartMinutes = breakStartHour * 60 + breakStartMin;
      breakEndMinutes = breakEndHour * 60 + breakEndMin;
    }

    // Generate slots
    while (currentMinutes + duration <= endMinutes) {
      const slotHour = Math.floor(currentMinutes / 60);
      const slotMin = currentMinutes % 60;
      const slotTime = `${String(slotHour).padStart(2, '0')}:${String(slotMin).padStart(2, '0')}`;

      // Check if slot is during break
      const isDuringBreak = breakStartMinutes !== null &&
        breakEndMinutes !== null &&
        currentMinutes >= breakStartMinutes &&
        currentMinutes + duration > breakStartMinutes;

      if (isDuringBreak) {
        if (includeUnavailable) {
          slots.push({
            time: slotTime,
            available: false,
            conflictReason: 'During break time',
            slotType: 'break'
          });
        }
        currentMinutes += slotInterval;
        continue;
      }

      // Check availability against appointments
      const availability = this.checkSlotAvailability(
        date,
        slotTime,
        duration,
        existingAppointments,
        bufferTime
      );

      // Only include unavailable slots if requested
      if (availability.available || includeUnavailable) {
        slots.push({
          time: slotTime,
          available: availability.available,
          conflictReason: availability.conflictReason,
          conflictingAppointment: availability.conflictingAppointment,
          slotType: availability.available ? 'regular' : 'buffer'
        });
      }

      currentMinutes += slotInterval;
    }

    return slots;
  }

  /**
   * Check if a specific slot is available
   */
  private static checkSlotAvailability(
    date: Date,
    slotTime: string,
    duration: number,
    existingAppointments: IAppointment[],
    bufferTime: number
  ): {
    available: boolean;
    conflictReason?: string;
    conflictingAppointment?: IAppointment;
  } {
    const [slotHour, slotMin] = slotTime.split(':').map(Number);
    const slotStart = new Date(date);
    slotStart.setHours(slotHour, slotMin, 0, 0);
    const slotEnd = addMinutes(slotStart, duration);

    // Check against existing appointments
    for (const appointment of existingAppointments) {
      const [aptHour, aptMin] = appointment.scheduledTime.split(':').map(Number);
      const aptStart = new Date(appointment.scheduledDate);
      aptStart.setHours(aptHour, aptMin, 0, 0);
      const aptEnd = addMinutes(aptStart, appointment.duration);
      const aptEndWithBuffer = addMinutes(aptEnd, bufferTime);

      // Check for overlap (including buffer time)
      if (
        (slotStart >= aptStart && slotStart < aptEndWithBuffer) ||
        (slotEnd > aptStart && slotEnd <= aptEndWithBuffer) ||
        (slotStart <= aptStart && slotEnd >= aptEndWithBuffer)
      ) {
        return {
          available: false,
          conflictReason: bufferTime > 0 ? 'Buffer time conflict' : 'Appointment conflict',
          conflictingAppointment: appointment
        };
      }
    }

    return { available: true };
  }

  /**
   * Check if pharmacist is working on a specific date
   */
  private static isPharmacistWorkingOn(schedule: IPharmacistSchedule, date: Date): boolean {
    // Check if date is within effective period
    if (date < schedule.effectiveFrom) return false;
    if (schedule.effectiveTo && date > schedule.effectiveTo) return false;

    // Check approved time off
    for (const timeOff of schedule.timeOff) {
      if (
        timeOff.status === 'approved' &&
        date >= timeOff.startDate &&
        date <= timeOff.endDate
      ) {
        return false;
      }
    }

    // Check if it's a working day
    const dayOfWeek = date.getDay();
    const daySchedule = schedule.workingHours.find(wh => wh.dayOfWeek === dayOfWeek);

    return daySchedule ? daySchedule.isWorkingDay : false;
  }

  /**
   * Get working hours summary for a pharmacist on a specific date
   */
  private static getWorkingHoursSummary(schedule: IPharmacistSchedule, date: Date): string {
    const dayOfWeek = date.getDay();
    const daySchedule = schedule.workingHours.find(wh => wh.dayOfWeek === dayOfWeek);

    if (!daySchedule || !daySchedule.isWorkingDay || !daySchedule.shifts) {
      return 'Not working';
    }

    const shiftSummaries = daySchedule.shifts.map(shift => {
      let summary = `${shift.startTime}-${shift.endTime}`;
      if (shift.breakStart && shift.breakEnd) {
        summary += ` (Break: ${shift.breakStart}-${shift.breakEnd})`;
      }
      return summary;
    });

    return shiftSummaries.join(', ');
  }

  /**
   * Get next available slot for a pharmacist
   */
  static async getNextAvailableSlot(
    pharmacistId: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId,
    duration: number = 30,
    appointmentType?: string,
    daysAhead: number = 14
  ): Promise<{
    date: Date;
    time: string;
    pharmacistName: string;
  } | null> {
    try {
      const today = new Date();

      for (let i = 0; i < daysAhead; i++) {
        const checkDate = addMinutes(today, i * 24 * 60); // Add days

        const result = await this.generateAvailableSlots({
          date: checkDate,
          pharmacistId,
          duration,
          appointmentType,
          workplaceId
        });

        const availableSlot = result.slots.find(slot => slot.available);
        if (availableSlot) {
          return {
            date: checkDate,
            time: availableSlot.time,
            pharmacistName: availableSlot.pharmacistName || 'Unknown'
          };
        }
      }

      return null;
    } catch (error) {
      logger.error('Error finding next available slot:', error);
      throw error;
    }
  }

  /**
   * Validate slot availability before booking
   */
  static async validateSlotAvailability(
    pharmacistId: mongoose.Types.ObjectId,
    date: Date,
    time: string,
    duration: number,
    workplaceId: mongoose.Types.ObjectId,
    appointmentType?: string
  ): Promise<{
    available: boolean;
    reason?: string;
    conflictingAppointment?: IAppointment;
  }> {
    try {
      const result = await this.generateAvailableSlots({
        date,
        pharmacistId,
        duration,
        appointmentType,
        workplaceId,
        includeUnavailable: true
      });

      const slot = result.slots.find(s =>
        s.time === time && s.pharmacistId.toString() === pharmacistId.toString()
      );

      if (!slot) {
        return {
          available: false,
          reason: 'Slot not found in schedule'
        };
      }

      return {
        available: slot.available,
        reason: slot.conflictReason,
        conflictingAppointment: slot.conflictingAppointment
      };

    } catch (error) {
      logger.error('Error validating slot availability:', error);
      throw error;
    }
  }

  /**
   * Create a default schedule for a pharmacist
   */
  private static async createDefaultScheduleForPharmacist(
    pharmacistId: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId,
    pharmacist: any
  ): Promise<any> {
    try {
      const defaultWorkingHours = [
        // Sunday (0) - Not working
        { dayOfWeek: 0, isWorkingDay: false, shifts: [] },
        // Monday (1) - Working
        { dayOfWeek: 1, isWorkingDay: true, shifts: [{ startTime: '09:00', endTime: '17:00', breakStart: '12:00', breakEnd: '13:00' }] },
        // Tuesday (2) - Working
        { dayOfWeek: 2, isWorkingDay: true, shifts: [{ startTime: '09:00', endTime: '17:00', breakStart: '12:00', breakEnd: '13:00' }] },
        // Wednesday (3) - Working
        { dayOfWeek: 3, isWorkingDay: true, shifts: [{ startTime: '09:00', endTime: '17:00', breakStart: '12:00', breakEnd: '13:00' }] },
        // Thursday (4) - Working
        { dayOfWeek: 4, isWorkingDay: true, shifts: [{ startTime: '09:00', endTime: '17:00', breakStart: '12:00', breakEnd: '13:00' }] },
        // Friday (5) - Working
        { dayOfWeek: 5, isWorkingDay: true, shifts: [{ startTime: '09:00', endTime: '17:00', breakStart: '12:00', breakEnd: '13:00' }] },
        // Saturday (6) - Not working
        { dayOfWeek: 6, isWorkingDay: false, shifts: [] }
      ];

      const defaultAppointmentPreferences = {
        maxAppointmentsPerDay: 16,
        maxConcurrentAppointments: 1,
        appointmentTypes: [
          'mtm_session',
          'chronic_disease_review',
          'new_medication_consultation',
          'vaccination',
          'health_check',
          'smoking_cessation',
          'general_followup'
        ],
        defaultDuration: 30,
        bufferBetweenAppointments: 0
      };

      const scheduleData = {
        workplaceId,
        pharmacistId,
        workingHours: defaultWorkingHours,
        timeOff: [],
        appointmentPreferences: defaultAppointmentPreferences,
        capacityStats: {
          totalSlotsAvailable: 0,
          slotsBooked: 0,
          utilizationRate: 0,
          lastCalculatedAt: new Date()
        },
        isActive: true,
        effectiveFrom: new Date(),
        createdBy: pharmacistId,
        isDeleted: false
      };

      const schedule = await PharmacistSchedule.create(scheduleData);

      // Populate the pharmacist data for consistency with the query
      const populatedSchedule = await PharmacistSchedule.findById(schedule._id)
        .populate('pharmacistId', 'firstName lastName email')
        .lean();

      logger.info(`Created default schedule for pharmacist: ${pharmacist.firstName} ${pharmacist.lastName}`);

      return populatedSchedule;
    } catch (error) {
      logger.error(`Failed to create default schedule for pharmacist ${pharmacistId}:`, error);
      return null;
    }
  }
}