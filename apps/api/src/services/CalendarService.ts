/**
 * Calendar Service
 * Handles calendar views, slot calculations, and capacity management
 * Requirements: 1.1, 1.3, 8.1, 8.2, 8.3
 */

import mongoose from 'mongoose';
import Appointment, { IAppointment } from '../models/Appointment';
import PharmacistSchedule, { IPharmacistSchedule } from '../models/PharmacistSchedule';
import User from '../models/User';
import { createNotFoundError } from '../utils/responseHelpers';
import logger from '../utils/logger';

export interface CalendarViewFilters {
  pharmacistId?: mongoose.Types.ObjectId;
  locationId?: string;
  appointmentType?: string;
  status?: string | string[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  type: string;
  status: string;
  patientId: mongoose.Types.ObjectId;
  patientName?: string;
  pharmacistId: mongoose.Types.ObjectId;
  pharmacistName?: string;
  description?: string;
  color?: string;
}

export interface DayGrouping {
  date: Date;
  appointments: IAppointment[];
  summary: {
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
  };
}

export interface WeekGrouping {
  weekStart: Date;
  weekEnd: Date;
  days: DayGrouping[];
  summary: {
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
  };
}

export interface MonthGrouping {
  monthStart: Date;
  monthEnd: Date;
  weeks: WeekGrouping[];
  summary: {
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
  };
}

export interface AvailableSlot {
  time: string;
  available: boolean;
  pharmacistId: mongoose.Types.ObjectId;
  pharmacistName?: string;
  conflictingAppointment?: IAppointment;
  isBreak?: boolean;
  isOutsideWorkingHours?: boolean;
}

export interface PharmacistAvailability {
  pharmacistId: mongoose.Types.ObjectId;
  pharmacistName: string;
  date: Date;
  isWorking: boolean;
  shifts: Array<{
    startTime: string;
    endTime: string;
    breakStart?: string;
    breakEnd?: string;
  }>;
  appointments: IAppointment[];
  availableSlots: AvailableSlot[];
  utilizationRate: number;
}

export interface CapacityMetrics {
  overall: {
    totalSlots: number;
    bookedSlots: number;
    availableSlots: number;
    utilizationRate: number;
  };
  byPharmacist: Array<{
    pharmacistId: mongoose.Types.ObjectId;
    pharmacistName: string;
    totalSlots: number;
    bookedSlots: number;
    availableSlots: number;
    utilizationRate: number;
  }>;
  byDay: Array<{
    date: Date;
    totalSlots: number;
    bookedSlots: number;
    availableSlots: number;
    utilizationRate: number;
  }>;
  recommendations: string[];
}

export interface OptimalTimeSlot {
  date: Date;
  time: string;
  pharmacistId: mongoose.Types.ObjectId;
  pharmacistName?: string;
  score: number;
  reasons: string[];
}

export class CalendarService {
  /**
   * Get calendar view with day/week/month grouping
   * Requirement: 1.1, 1.3
   */
  static async getCalendarView(
    view: 'day' | 'week' | 'month',
    date: Date,
    filters: CalendarViewFilters,
    workplaceId: mongoose.Types.ObjectId
  ): Promise<DayGrouping | WeekGrouping | MonthGrouping> {
    try {
      switch (view) {
        case 'day':
          return await this.getDayView(date, filters, workplaceId);
        case 'week':
          return await this.getWeekView(date, filters, workplaceId);
        case 'month':
          return await this.getMonthView(date, filters, workplaceId);
        default:
          throw new Error(`Invalid view type: ${view}`);
      }
    } catch (error) {
      logger.error('Error getting calendar view', {
        error: error instanceof Error ? error.message : 'Unknown error',
        view,
        date,
        filters,
      });
      throw error;
    }
  }

  /**
   * Get day view with appointments
   */
  private static async getDayView(
    date: Date,
    filters: CalendarViewFilters,
    workplaceId: mongoose.Types.ObjectId
  ): Promise<DayGrouping> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const appointments = await this.fetchAppointments(
      startOfDay,
      endOfDay,
      filters,
      workplaceId
    );

    return {
      date: startOfDay,
      appointments,
      summary: this.calculateSummary(appointments),
    };
  }

  /**
   * Get week view with daily groupings
   */
  private static async getWeekView(
    date: Date,
    filters: CalendarViewFilters,
    workplaceId: mongoose.Types.ObjectId
  ): Promise<WeekGrouping> {
    // Get start of week (Sunday)
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    weekStart.setHours(0, 0, 0, 0);

    // Get end of week (Saturday)
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const appointments = await this.fetchAppointments(
      weekStart,
      weekEnd,
      filters,
      workplaceId
    );

    // Group by day
    const days: DayGrouping[] = [];
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + i);
      dayDate.setHours(0, 0, 0, 0);

      const dayAppointments = appointments.filter(apt => {
        const aptDate = new Date(apt.scheduledDate);
        aptDate.setHours(0, 0, 0, 0);
        return aptDate.getTime() === dayDate.getTime();
      });

      days.push({
        date: dayDate,
        appointments: dayAppointments,
        summary: this.calculateSummary(dayAppointments),
      });
    }

    return {
      weekStart,
      weekEnd,
      days,
      summary: this.calculateSummary(appointments),
    };
  }

  /**
   * Get month view with weekly groupings
   */
  private static async getMonthView(
    date: Date,
    filters: CalendarViewFilters,
    workplaceId: mongoose.Types.ObjectId
  ): Promise<MonthGrouping> {
    // Get start of month
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);

    // Get end of month
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);

    const appointments = await this.fetchAppointments(
      monthStart,
      monthEnd,
      filters,
      workplaceId
    );

    // Group by week
    const weeks: WeekGrouping[] = [];
    let currentWeekStart = new Date(monthStart);
    currentWeekStart.setDate(monthStart.getDate() - monthStart.getDay());
    currentWeekStart.setHours(0, 0, 0, 0);

    while (currentWeekStart <= monthEnd) {
      const currentWeekEnd = new Date(currentWeekStart);
      currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
      currentWeekEnd.setHours(23, 59, 59, 999);

      const weekAppointments = appointments.filter(apt => {
        const aptDate = new Date(apt.scheduledDate);
        return aptDate >= currentWeekStart && aptDate <= currentWeekEnd;
      });

      // Group by day within week
      const days: DayGrouping[] = [];
      for (let i = 0; i < 7; i++) {
        const dayDate = new Date(currentWeekStart);
        dayDate.setDate(currentWeekStart.getDate() + i);
        dayDate.setHours(0, 0, 0, 0);

        const dayAppointments = weekAppointments.filter(apt => {
          const aptDate = new Date(apt.scheduledDate);
          aptDate.setHours(0, 0, 0, 0);
          return aptDate.getTime() === dayDate.getTime();
        });

        days.push({
          date: dayDate,
          appointments: dayAppointments,
          summary: this.calculateSummary(dayAppointments),
        });
      }

      weeks.push({
        weekStart: new Date(currentWeekStart),
        weekEnd: new Date(currentWeekEnd),
        days,
        summary: this.calculateSummary(weekAppointments),
      });

      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    }

    return {
      monthStart,
      monthEnd,
      weeks,
      summary: this.calculateSummary(appointments),
    };
  }

  /**
   * Calculate available slots with schedule checking
   * Requirement: 1.3, 8.1
   */
  static async calculateAvailableSlots(
    pharmacistId: mongoose.Types.ObjectId,
    date: Date,
    duration: number,
    workplaceId: mongoose.Types.ObjectId,
    appointmentType?: string
  ): Promise<AvailableSlot[]> {
    try {
      // Get pharmacist schedule
      const schedule = await PharmacistSchedule.findCurrentSchedule(pharmacistId, workplaceId);

      if (!schedule) {
        logger.warn('No schedule found for pharmacist', {
          pharmacistId: pharmacistId.toString(),
        });
        return [];
      }

      // Check if pharmacist is working on this date
      if (!schedule.isWorkingOn(date)) {
        return [];
      }

      // Check if pharmacist can handle this appointment type
      if (appointmentType && !schedule.canHandleAppointmentType(appointmentType)) {
        return [];
      }

      // Get shifts for the date
      const shifts = schedule.getShiftsForDate(date);

      if (shifts.length === 0) {
        return [];
      }

      // Get existing appointments for the date
      const existingAppointments = await Appointment.find({
        workplaceId,
        assignedTo: pharmacistId,
        scheduledDate: date,
        status: { $nin: ['cancelled', 'no_show'] },
      }).sort({ scheduledTime: 1 });

      // Generate time slots
      const slots: AvailableSlot[] = [];
      const slotInterval = 15; // 15-minute intervals
      const bufferTime = schedule.appointmentPreferences.bufferBetweenAppointments || 0;

      for (const shift of shifts) {
        const [startHour, startMin] = shift.startTime.split(':').map(Number);
        const [endHour, endMin] = shift.endTime.split(':').map(Number);

        let currentMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;

        // Handle break time
        let breakStartMinutes: number | null = null;
        let breakEndMinutes: number | null = null;

        if (shift.breakStart && shift.breakEnd) {
          const [breakStartHour, breakStartMin] = shift.breakStart.split(':').map(Number);
          const [breakEndHour, breakEndMin] = shift.breakEnd.split(':').map(Number);
          breakStartMinutes = breakStartHour * 60 + breakStartMin;
          breakEndMinutes = breakEndHour * 60 + breakEndMin;
        }

        while (currentMinutes + duration <= endMinutes) {
          const slotHour = Math.floor(currentMinutes / 60);
          const slotMin = currentMinutes % 60;
          const slotTime = `${String(slotHour).padStart(2, '0')}:${String(slotMin).padStart(2, '0')}`;

          // Check if slot is during break
          if (
            breakStartMinutes !== null &&
            breakEndMinutes !== null &&
            currentMinutes >= breakStartMinutes &&
            currentMinutes < breakEndMinutes
          ) {
            slots.push({
              time: slotTime,
              available: false,
              pharmacistId,
              isBreak: true,
            });
            currentMinutes += slotInterval;
            continue;
          }

          // Check if slot conflicts with existing appointments
          const slotStartDateTime = new Date(date);
          slotStartDateTime.setHours(slotHour, slotMin, 0, 0);
          const slotEndDateTime = new Date(slotStartDateTime.getTime() + duration * 60000);

          let hasConflict = false;
          let conflictingAppointment: IAppointment | undefined;

          for (const appointment of existingAppointments) {
            const appointmentStart = appointment.get('appointmentDateTime');
            const appointmentEnd = appointment.get('endDateTime');

            if (!appointmentStart || !appointmentEnd) continue;

            // Check for overlap (including buffer time)
            const appointmentEndWithBuffer = new Date(
              appointmentEnd.getTime() + bufferTime * 60000
            );

            if (
              (slotStartDateTime >= appointmentStart && slotStartDateTime < appointmentEndWithBuffer) ||
              (slotEndDateTime > appointmentStart && slotEndDateTime <= appointmentEndWithBuffer) ||
              (slotStartDateTime <= appointmentStart && slotEndDateTime >= appointmentEndWithBuffer)
            ) {
              hasConflict = true;
              conflictingAppointment = appointment;
              break;
            }
          }

          slots.push({
            time: slotTime,
            available: !hasConflict,
            pharmacistId,
            conflictingAppointment,
          });

          currentMinutes += slotInterval;
        }
      }

      return slots;
    } catch (error) {
      logger.error('Error calculating available slots', {
        error: error instanceof Error ? error.message : 'Unknown error',
        pharmacistId: pharmacistId.toString(),
        date,
      });
      throw error;
    }
  }

  /**
   * Get pharmacist availability for a specific date
   * Requirement: 8.1, 8.2
   */
  static async getPharmacistAvailability(
    pharmacistId: mongoose.Types.ObjectId,
    date: Date,
    workplaceId: mongoose.Types.ObjectId
  ): Promise<PharmacistAvailability> {
    try {
      // Get pharmacist details
      const pharmacist = await User.findById(pharmacistId);
      if (!pharmacist) {
        throw createNotFoundError('Pharmacist', pharmacistId.toString());
      }

      // Get schedule
      const schedule = await PharmacistSchedule.findCurrentSchedule(pharmacistId, workplaceId);

      if (!schedule) {
        return {
          pharmacistId,
          pharmacistName: `${pharmacist.firstName} ${pharmacist.lastName}`,
          date,
          isWorking: false,
          shifts: [],
          appointments: [],
          availableSlots: [],
          utilizationRate: 0,
        };
      }

      const isWorking = schedule.isWorkingOn(date);
      const shifts = schedule.getShiftsForDate(date);

      // Get appointments for the date
      const appointments = await Appointment.find({
        workplaceId,
        assignedTo: pharmacistId,
        scheduledDate: date,
        status: { $nin: ['cancelled', 'no_show'] },
      }).sort({ scheduledTime: 1 });

      // Calculate available slots
      const availableSlots = isWorking
        ? await this.calculateAvailableSlots(
            pharmacistId,
            date,
            schedule.appointmentPreferences.defaultDuration,
            workplaceId
          )
        : [];

      // Calculate utilization rate
      const totalSlots = availableSlots.length;
      const bookedSlots = availableSlots.filter(slot => !slot.available).length;
      const utilizationRate = totalSlots > 0 ? Math.round((bookedSlots / totalSlots) * 100) : 0;

      return {
        pharmacistId,
        pharmacistName: `${pharmacist.firstName} ${pharmacist.lastName}`,
        date,
        isWorking,
        shifts,
        appointments,
        availableSlots,
        utilizationRate,
      };
    } catch (error) {
      logger.error('Error getting pharmacist availability', {
        error: error instanceof Error ? error.message : 'Unknown error',
        pharmacistId: pharmacistId.toString(),
        date,
      });
      throw error;
    }
  }

  /**
   * Get capacity metrics with utilization calculation
   * Requirement: 8.1, 8.2, 8.3
   */
  static async getCapacityMetrics(
    startDate: Date,
    endDate: Date,
    workplaceId: mongoose.Types.ObjectId,
    pharmacistIds?: mongoose.Types.ObjectId[]
  ): Promise<CapacityMetrics> {
    try {
      // Get all pharmacists if not specified
      let pharmacists: any[];
      if (pharmacistIds && pharmacistIds.length > 0) {
        pharmacists = await User.find({
          _id: { $in: pharmacistIds },
          role: { $in: ['pharmacist', 'pharmacy_manager'] },
        });
      } else {
        pharmacists = await User.find({
          workplaceId,
          role: { $in: ['pharmacist', 'pharmacy_manager'] },
        });
      }

      // Initialize metrics
      const byPharmacist: CapacityMetrics['byPharmacist'] = [];
      const byDay: CapacityMetrics['byDay'] = [];
      let overallTotalSlots = 0;
      let overallBookedSlots = 0;

      // Calculate metrics for each pharmacist
      for (const pharmacist of pharmacists) {
        const schedule = await PharmacistSchedule.findCurrentSchedule(
          pharmacist._id,
          workplaceId
        );

        if (!schedule) continue;

        let pharmacistTotalSlots = 0;
        let pharmacistBookedSlots = 0;

        // Iterate through date range
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          if (schedule.isWorkingOn(currentDate)) {
            const slots = await this.calculateAvailableSlots(
              pharmacist._id,
              currentDate,
              schedule.appointmentPreferences.defaultDuration,
              workplaceId
            );

            const totalSlots = slots.length;
            const bookedSlots = slots.filter(slot => !slot.available).length;

            pharmacistTotalSlots += totalSlots;
            pharmacistBookedSlots += bookedSlots;
          }

          currentDate.setDate(currentDate.getDate() + 1);
        }

        const utilizationRate =
          pharmacistTotalSlots > 0
            ? Math.round((pharmacistBookedSlots / pharmacistTotalSlots) * 100)
            : 0;

        byPharmacist.push({
          pharmacistId: pharmacist._id,
          pharmacistName: `${pharmacist.firstName} ${pharmacist.lastName}`,
          totalSlots: pharmacistTotalSlots,
          bookedSlots: pharmacistBookedSlots,
          availableSlots: pharmacistTotalSlots - pharmacistBookedSlots,
          utilizationRate,
        });

        overallTotalSlots += pharmacistTotalSlots;
        overallBookedSlots += pharmacistBookedSlots;
      }

      // Calculate metrics by day
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        let dayTotalSlots = 0;
        let dayBookedSlots = 0;

        for (const pharmacist of pharmacists) {
          const schedule = await PharmacistSchedule.findCurrentSchedule(
            pharmacist._id,
            workplaceId
          );

          if (!schedule || !schedule.isWorkingOn(currentDate)) continue;

          const slots = await this.calculateAvailableSlots(
            pharmacist._id,
            new Date(currentDate),
            schedule.appointmentPreferences.defaultDuration,
            workplaceId
          );

          dayTotalSlots += slots.length;
          dayBookedSlots += slots.filter(slot => !slot.available).length;
        }

        const utilizationRate =
          dayTotalSlots > 0 ? Math.round((dayBookedSlots / dayTotalSlots) * 100) : 0;

        byDay.push({
          date: new Date(currentDate),
          totalSlots: dayTotalSlots,
          bookedSlots: dayBookedSlots,
          availableSlots: dayTotalSlots - dayBookedSlots,
          utilizationRate,
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Generate recommendations
      const recommendations = this.generateCapacityRecommendations(
        byPharmacist,
        byDay
      );

      const overallUtilizationRate =
        overallTotalSlots > 0
          ? Math.round((overallBookedSlots / overallTotalSlots) * 100)
          : 0;

      return {
        overall: {
          totalSlots: overallTotalSlots,
          bookedSlots: overallBookedSlots,
          availableSlots: overallTotalSlots - overallBookedSlots,
          utilizationRate: overallUtilizationRate,
        },
        byPharmacist,
        byDay,
        recommendations,
      };
    } catch (error) {
      logger.error('Error getting capacity metrics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        startDate,
        endDate,
      });
      throw error;
    }
  }

  /**
   * Suggest optimal times using historical data
   * Requirement: 8.3
   */
  static async suggestOptimalTimes(
    patientId: mongoose.Types.ObjectId,
    appointmentType: string,
    duration: number,
    workplaceId: mongoose.Types.ObjectId,
    daysAhead: number = 14
  ): Promise<OptimalTimeSlot[]> {
    try {
      // Get patient's appointment history
      const patientHistory = await Appointment.find({
        workplaceId,
        patientId,
        status: 'completed',
      })
        .sort({ scheduledDate: -1 })
        .limit(10);

      // Analyze preferred times and days
      const preferredDays = new Map<number, number>();
      const preferredTimes = new Map<string, number>();

      for (const appointment of patientHistory) {
        const dayOfWeek = new Date(appointment.scheduledDate).getDay();
        preferredDays.set(dayOfWeek, (preferredDays.get(dayOfWeek) || 0) + 1);

        const hour = parseInt(appointment.scheduledTime.split(':')[0]);
        const timeSlot = this.getTimeSlotCategory(hour);
        preferredTimes.set(timeSlot, (preferredTimes.get(timeSlot) || 0) + 1);
      }

      // Get all pharmacists who can handle this appointment type
      const allSchedules = await PharmacistSchedule.find({
        workplaceId,
        isActive: true,
        'appointmentPreferences.appointmentTypes': appointmentType,
      }).populate('pharmacistId', 'name');

      const suggestions: OptimalTimeSlot[] = [];

      // Check availability for the next N days
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (let dayOffset = 1; dayOffset <= daysAhead; dayOffset++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() + dayOffset);

        for (const schedule of allSchedules) {
          if (!schedule.isWorkingOn(checkDate)) continue;

          const slots = await this.calculateAvailableSlots(
            schedule.pharmacistId,
            checkDate,
            duration,
            workplaceId,
            appointmentType
          );

          const availableSlots = slots.filter(slot => slot.available);

          for (const slot of availableSlots) {
            const score = this.calculateSlotScore(
              checkDate,
              slot.time,
              preferredDays,
              preferredTimes,
              dayOffset
            );

            const reasons = this.generateSlotReasons(
              checkDate,
              slot.time,
              preferredDays,
              preferredTimes,
              dayOffset
            );

            suggestions.push({
              date: checkDate,
              time: slot.time,
              pharmacistId: schedule.pharmacistId,
              pharmacistName: (schedule.pharmacistId as any).name,
              score,
              reasons,
            });
          }
        }
      }

      // Sort by score (highest first) and return top 10
      return suggestions.sort((a, b) => b.score - a.score).slice(0, 10);
    } catch (error) {
      logger.error('Error suggesting optimal times', {
        error: error instanceof Error ? error.message : 'Unknown error',
        patientId: patientId.toString(),
        appointmentType,
      });
      throw error;
    }
  }

  /**
   * Helper: Fetch appointments with filters
   */
  private static async fetchAppointments(
    startDate: Date,
    endDate: Date,
    filters: CalendarViewFilters,
    workplaceId: mongoose.Types.ObjectId
  ): Promise<IAppointment[]> {
    const query: any = {
      workplaceId,
      scheduledDate: { $gte: startDate, $lte: endDate },
    };

    if (filters.pharmacistId) {
      query.assignedTo = filters.pharmacistId;
    }

    if (filters.locationId) {
      query.locationId = filters.locationId;
    }

    if (filters.appointmentType) {
      query.type = filters.appointmentType;
    }

    if (filters.status) {
      query.status = Array.isArray(filters.status)
        ? { $in: filters.status }
        : filters.status;
    }

    return await Appointment.find(query)
      .populate('patientId', 'name email phone')
      .populate('assignedTo', 'name email role')
      .sort({ scheduledDate: 1, scheduledTime: 1 });
  }

  /**
   * Helper: Calculate summary statistics
   */
  private static calculateSummary(appointments: IAppointment[]): {
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
  } {
    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};

    for (const appointment of appointments) {
      // Count by status
      byStatus[appointment.status] = (byStatus[appointment.status] || 0) + 1;

      // Count by type
      byType[appointment.type] = (byType[appointment.type] || 0) + 1;
    }

    return {
      total: appointments.length,
      byStatus,
      byType,
    };
  }

  /**
   * Helper: Generate capacity recommendations
   */
  private static generateCapacityRecommendations(
    byPharmacist: CapacityMetrics['byPharmacist'],
    byDay: CapacityMetrics['byDay']
  ): string[] {
    const recommendations: string[] = [];

    // Check for underutilized pharmacists
    const underutilized = byPharmacist.filter(p => p.utilizationRate < 50 && p.totalSlots > 0);
    if (underutilized.length > 0) {
      recommendations.push(
        `${underutilized.length} pharmacist(s) are underutilized (< 50% capacity). Consider redistributing appointments.`
      );
    }

    // Check for overutilized pharmacists
    const overutilized = byPharmacist.filter(p => p.utilizationRate > 90);
    if (overutilized.length > 0) {
      recommendations.push(
        `${overutilized.length} pharmacist(s) are near capacity (> 90%). Consider adding more slots or staff.`
      );
    }

    // Find busiest days
    const sortedDays = [...byDay].sort((a, b) => b.utilizationRate - a.utilizationRate);
    if (sortedDays.length > 0 && sortedDays[0].utilizationRate > 80) {
      const dayName = sortedDays[0].date.toLocaleDateString('en-US', { weekday: 'long' });
      recommendations.push(
        `${dayName} is the busiest day (${sortedDays[0].utilizationRate}% utilization). Consider adding capacity.`
      );
    }

    // Find days with low utilization
    const lowUtilizationDays = byDay.filter(d => d.utilizationRate < 30 && d.totalSlots > 0);
    if (lowUtilizationDays.length > 0) {
      recommendations.push(
        `${lowUtilizationDays.length} day(s) have low utilization (< 30%). Consider reducing available slots.`
      );
    }

    // Check overall capacity
    const avgUtilization =
      byDay.reduce((sum, d) => sum + d.utilizationRate, 0) / byDay.length;
    if (avgUtilization > 85) {
      recommendations.push(
        'Overall capacity is high (> 85%). Consider expanding operating hours or adding staff.'
      );
    } else if (avgUtilization < 40) {
      recommendations.push(
        'Overall capacity is low (< 40%). Consider reducing operating hours or increasing marketing.'
      );
    }

    return recommendations;
  }

  /**
   * Helper: Get time slot category
   */
  private static getTimeSlotCategory(hour: number): string {
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  }

  /**
   * Helper: Calculate slot score based on patient preferences and availability
   */
  private static calculateSlotScore(
    date: Date,
    time: string,
    preferredDays: Map<number, number>,
    preferredTimes: Map<string, number>,
    dayOffset: number
  ): number {
    let score = 100;

    // Prefer sooner dates (reduce score by 5 points per day)
    score -= dayOffset * 5;

    // Boost score for preferred days
    const dayOfWeek = date.getDay();
    const dayPreference = preferredDays.get(dayOfWeek) || 0;
    score += dayPreference * 10;

    // Boost score for preferred time slots
    const hour = parseInt(time.split(':')[0]);
    const timeSlot = this.getTimeSlotCategory(hour);
    const timePreference = preferredTimes.get(timeSlot) || 0;
    score += timePreference * 10;

    // Prefer mid-morning and mid-afternoon slots (9-11 AM, 2-4 PM)
    if ((hour >= 9 && hour < 11) || (hour >= 14 && hour < 16)) {
      score += 5;
    }

    // Avoid very early or very late slots
    if (hour < 8 || hour >= 18) {
      score -= 10;
    }

    return Math.max(0, score);
  }

  /**
   * Helper: Generate reasons for slot recommendation
   */
  private static generateSlotReasons(
    date: Date,
    time: string,
    preferredDays: Map<number, number>,
    preferredTimes: Map<string, number>,
    dayOffset: number
  ): string[] {
    const reasons: string[] = [];

    // Check day preference
    const dayOfWeek = date.getDay();
    const dayPreference = preferredDays.get(dayOfWeek) || 0;
    if (dayPreference > 0) {
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
      reasons.push(`Patient has attended ${dayPreference} appointment(s) on ${dayName}s`);
    }

    // Check time preference
    const hour = parseInt(time.split(':')[0]);
    const timeSlot = this.getTimeSlotCategory(hour);
    const timePreference = preferredTimes.get(timeSlot) || 0;
    if (timePreference > 0) {
      reasons.push(`Patient prefers ${timeSlot} appointments`);
    }

    // Mention availability
    if (dayOffset <= 3) {
      reasons.push('Available soon');
    }

    // Mention optimal time
    if ((hour >= 9 && hour < 11) || (hour >= 14 && hour < 16)) {
      reasons.push('Optimal time slot');
    }

    return reasons;
  }
}

// Export as default for backward compatibility
export default CalendarService;
