/**
 * Appointment Service
 * Handles appointment scheduling, conflict checking, and status management
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 1.7
 */

import mongoose from 'mongoose';
import Appointment, { IAppointment } from '../models/Appointment';
import PharmacistSchedule, { IPharmacistSchedule } from '../models/PharmacistSchedule';
import Patient from '../models/Patient';
import PatientUser from '../models/PatientUser';
import User from '../models/User';
import Visit, { IVisit } from '../models/Visit';
import {
  createNotFoundError,
  createValidationError,
  createBusinessRuleError,
} from '../utils/responseHelpers';
import { appointmentNotificationService } from './AppointmentNotificationService';
import logger, { patientEngagementLogger } from '../utils/logger';
import { MonitorOperation, trackServiceOperation } from '../middlewares/patientEngagementMonitoringMiddleware';
import app from '../app';

export interface CreateAppointmentData {
  patientId: mongoose.Types.ObjectId;
  type: IAppointment['type'];
  scheduledDate: Date;
  scheduledTime: string;
  duration: number;
  assignedTo?: mongoose.Types.ObjectId;
  title?: string;
  description?: string;
  locationId?: string;
  isRecurring?: boolean;
  recurrencePattern?: IAppointment['recurrencePattern'];
  patientPreferences?: IAppointment['patientPreferences'];
  metadata?: IAppointment['metadata'];
}

export interface GetAppointmentsFilters {
  status?: string | string[];
  type?: string | string[];
  patientId?: mongoose.Types.ObjectId;
  assignedTo?: mongoose.Types.ObjectId;
  locationId?: string;
  startDate?: Date;
  endDate?: Date;
  isRecurring?: boolean;
}

export interface GetAppointmentsOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  populate?: boolean;
}

export interface UpdateAppointmentStatusData {
  status: IAppointment['status'];
  reason?: string;
  outcome?: IAppointment['outcome'];
  confirmedBy?: mongoose.Types.ObjectId;
}

export interface RescheduleAppointmentData {
  newDate: Date;
  newTime: string;
  reason: string;
  notifyPatient?: boolean;
}

export interface CancelAppointmentData {
  reason: string;
  notifyPatient?: boolean;
  cancelType?: 'this_only' | 'all_future';
}

export interface AvailableSlot {
  time: string;
  available: boolean;
  pharmacistId: mongoose.Types.ObjectId;
  pharmacistName?: string;
  conflictingAppointment?: IAppointment;
}

export class AppointmentService {
  /**
   * Create a new appointment with conflict checking
   * Requirement: 1.1, 1.2
   */
  @MonitorOperation('create', 'appointment')
  static async createAppointment(
    data: CreateAppointmentData,
    workplaceId: mongoose.Types.ObjectId,
    createdBy: mongoose.Types.ObjectId
  ): Promise<IAppointment> {
    try {
      // Validate patient exists - check both Patient and PatientUser collections
      // This supports both staff-created appointments (Patient ID) and patient portal bookings (PatientUser ID)
      let patient = await Patient.findById(data.patientId);
      let patientName = '';

      if (!patient) {
        // If not found in Patient collection, check PatientUser collection
        const patientUser = await PatientUser.findById(data.patientId);
        if (!patientUser) {
          throw createNotFoundError('Patient or PatientUser', data.patientId.toString());
        }
        // Use PatientUser data
        patientName = `${patientUser.firstName} ${patientUser.lastName}`;
      } else {
        // Use Patient data
        patientName = patient.name;
      }

      // Determine assigned pharmacist
      // For patient portal bookings, assignedTo may not be specified and createdBy is the patient
      // In this case, we need to find an available pharmacist
      let assignedTo = data.assignedTo;

      if (!assignedTo) {
        // Check if createdBy is a pharmacist (User) or a patient (PatientUser)
        const creatorAsPharmacist = await User.findById(createdBy);

        if (creatorAsPharmacist && ['pharmacist', 'admin', 'super_admin'].includes(creatorAsPharmacist.role)) {
          // Creator is a pharmacist, use them as assignedTo
          assignedTo = createdBy;
        } else {
          // Creator is a patient, find an available pharmacist
          // For now, find any active pharmacist in the workplace
          // TODO: Implement smart pharmacist assignment based on availability, specialization, etc.
          const availablePharmacist = await User.findOne({
            workplaceId,
            role: { $in: ['pharmacist', 'admin'] },
            status: 'active',
            isDeleted: false,
          });

          if (!availablePharmacist) {
            throw createBusinessRuleError('No available pharmacists found for this appointment');
          }

          assignedTo = availablePharmacist._id;
        }
      }

      // Validate pharmacist exists
      const pharmacist = await User.findById(assignedTo);
      if (!pharmacist) {
        throw createNotFoundError('Pharmacist', assignedTo.toString());
      }

      // Validate scheduled date is not in the past (allow same day)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const scheduledDate = new Date(data.scheduledDate);
      scheduledDate.setHours(0, 0, 0, 0);

      if (scheduledDate < today) {
        throw createValidationError('Cannot schedule appointments in the past');
      }

      // Check for conflicts
      const conflictCheck = await Appointment.checkConflict(
        assignedTo,
        data.scheduledDate,
        data.scheduledTime,
        data.duration
      );

      if (conflictCheck.hasConflict) {
        throw createBusinessRuleError(
          `Pharmacist already has an appointment at this time. Conflicting appointment: ${conflictCheck.conflictingAppointment?.title}`
        );
      }

      // Check if pharmacist is working on this date
      const schedule = await PharmacistSchedule.findCurrentSchedule(assignedTo, workplaceId);
      if (schedule) {
        const isWorking = schedule.isWorkingOn(data.scheduledDate);
        if (!isWorking) {
          logger.warn('Appointment scheduled on non-working day', {
            pharmacistId: assignedTo.toString(),
            date: data.scheduledDate,
          });
        }

        // Check if pharmacist can handle this appointment type
        if (!schedule.canHandleAppointmentType(data.type)) {
          throw createBusinessRuleError(
            `Pharmacist is not configured to handle ${data.type} appointments`
          );
        }
      }

      // Generate title if not provided
      const title = data.title || this.generateAppointmentTitle(data.type, patientName);

      // Create appointment
      const appointment = new Appointment({
        workplaceId,
        locationId: data.locationId,
        patientId: data.patientId,
        assignedTo,
        type: data.type,
        title,
        description: data.description,
        scheduledDate: data.scheduledDate,
        scheduledTime: data.scheduledTime,
        duration: data.duration,
        timezone: 'Africa/Lagos', // Default timezone
        status: 'scheduled',
        confirmationStatus: 'pending',
        isRecurring: data.isRecurring || false,
        recurrencePattern: data.recurrencePattern,
        patientPreferences: data.patientPreferences,
        metadata: data.metadata || {
          source: 'manual',
        },
        reminders: this.generateDefaultReminders(data.scheduledDate, data.scheduledTime),
        relatedRecords: {},
        createdBy,
      });

      await appointment.save();

      logger.info('Appointment created successfully', {
        appointmentId: appointment._id.toString(),
        patientId: data.patientId.toString(),
        assignedTo: assignedTo.toString(),
        scheduledDate: data.scheduledDate,
        type: data.type,
      });

      // Emit real-time event
      try {
        const appointmentSocket = app.get('appointmentSocket');
        if (appointmentSocket) {
          appointmentSocket.emitAppointmentCreated(appointment, {
            userId: createdBy.toString(),
            name: pharmacist.firstName + ' ' + pharmacist.lastName,
            role: pharmacist.role,
          });
        }
      } catch (socketError) {
        logger.error('Failed to emit appointment created event:', socketError);
        // Don't fail the operation if socket emission fails
      }

      return appointment;
    } catch (error) {
      logger.error('Error creating appointment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        data,
      });
      throw error;
    }
  }

  /**
   * Get single appointment by ID
   * Requirement: 1.1, 1.3
   */
  @MonitorOperation('get', 'appointment')
  static async getAppointmentById(
    appointmentId: string,
    workplaceId: mongoose.Types.ObjectId
  ): Promise<IAppointment | null> {
    try {
      const appointment = await Appointment.findOne({
        _id: new mongoose.Types.ObjectId(appointmentId),
        workplaceId,
      }).populate('patientId assignedTo');

      return appointment;
    } catch (error) {
      logger.error('Error fetching appointment by ID', {
        appointmentId,
        workplaceId: workplaceId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Update appointment details
   * Requirement: 1.4, 1.6
   */
  static async updateAppointment(
    appointmentId: string,
    workplaceId: mongoose.Types.ObjectId,
    updateData: Partial<CreateAppointmentData>,
    updatedBy: mongoose.Types.ObjectId
  ): Promise<IAppointment | null> {
    try {
      const appointment = await Appointment.findOneAndUpdate(
        {
          _id: new mongoose.Types.ObjectId(appointmentId),
          workplaceId,
        },
        {
          ...updateData,
          updatedBy,
        },
        { new: true }
      );

      if (appointment) {
        logger.info('Appointment updated', {
          appointmentId,
          updatedBy: updatedBy.toString(),
        });

        // Emit real-time event
        try {
          const appointmentSocket = app.get('appointmentSocket');
          if (appointmentSocket) {
            const user = await User.findById(updatedBy);
            if (user) {
              appointmentSocket.emitAppointmentUpdated(appointment, {
                userId: updatedBy.toString(),
                name: user.firstName + ' ' + user.lastName,
                role: user.role,
              });
            }
          }
        } catch (socketError) {
          logger.error('Failed to emit appointment updated event:', socketError);
        }
      }

      return appointment;
    } catch (error) {
      logger.error('Error updating appointment', {
        appointmentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get appointments with filtering and pagination
   * Requirement: 1.1, 1.3
   */
  static async getAppointments(
    filters: GetAppointmentsFilters,
    options: GetAppointmentsOptions,
    workplaceId: mongoose.Types.ObjectId
  ): Promise<{
    appointments: IAppointment[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      pages: number;
    };
  }> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 50;
      const skip = (page - 1) * limit;
      const sortBy = options.sortBy || 'scheduledDate';
      const sortOrder = options.sortOrder === 'desc' ? -1 : 1;

      // Build query
      const query: any = { workplaceId };

      if (filters.status) {
        query.status = Array.isArray(filters.status)
          ? { $in: filters.status }
          : filters.status;
      }

      if (filters.type) {
        query.type = Array.isArray(filters.type) ? { $in: filters.type } : filters.type;
      }

      if (filters.patientId) {
        query.patientId = filters.patientId;
      }

      if (filters.assignedTo) {
        query.assignedTo = filters.assignedTo;
      }

      if (filters.locationId) {
        query.locationId = filters.locationId;
      }

      if (filters.startDate || filters.endDate) {
        query.scheduledDate = {};
        if (filters.startDate) {
          query.scheduledDate.$gte = filters.startDate;
        }
        if (filters.endDate) {
          query.scheduledDate.$lte = filters.endDate;
        }
      }

      if (filters.isRecurring !== undefined) {
        query.isRecurring = filters.isRecurring;
      }

      // Execute query
      let appointmentsQuery = Appointment.find(query)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit);

      if (options.populate) {
        appointmentsQuery = appointmentsQuery
          .populate('patientId', 'name email phone')
          .populate('assignedTo', 'name email role');
      }

      const [appointments, total] = await Promise.all([
        appointmentsQuery.exec(),
        Appointment.countDocuments(query),
      ]);

      return {
        appointments,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Error getting appointments', {
        error: error instanceof Error ? error.message : 'Unknown error',
        filters,
      });
      throw error;
    }
  }

  /**
   * Get available time slots for a pharmacist on a specific date
   * Requirement: 1.3
   */
  static async getAvailableSlots(
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
        throw createNotFoundError('Pharmacist schedule', pharmacistId.toString());
      }

      // Check if pharmacist is working on this date
      if (!schedule.isWorkingOn(date)) {
        return []; // No slots available on non-working days
      }

      // Check if pharmacist can handle this appointment type
      if (appointmentType && !schedule.canHandleAppointmentType(appointmentType)) {
        return []; // No slots available for this appointment type
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

          // Skip if slot is during break
          if (
            breakStartMinutes !== null &&
            breakEndMinutes !== null &&
            currentMinutes >= breakStartMinutes &&
            currentMinutes < breakEndMinutes
          ) {
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
      logger.error('Error getting available slots', {
        error: error instanceof Error ? error.message : 'Unknown error',
        pharmacistId: pharmacistId.toString(),
        date,
      });
      throw error;
    }
  }

  /**
   * Update appointment status with workflow validation
   * Requirement: 1.4, 1.6
   */
  static async updateAppointmentStatus(
    appointmentId: mongoose.Types.ObjectId,
    data: UpdateAppointmentStatusData,
    updatedBy: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId
  ): Promise<IAppointment> {
    try {
      const appointment = await Appointment.findOne({
        _id: appointmentId,
        workplaceId,
      });

      if (!appointment) {
        throw createNotFoundError('Appointment', appointmentId.toString());
      }

      // Validate status transition
      this.validateStatusTransition(appointment.status, data.status);

      // Handle specific status updates
      switch (data.status) {
        case 'confirmed':
          appointment.confirm(data.confirmedBy || updatedBy);
          break;

        case 'completed':
          if (!data.outcome) {
            throw createValidationError('Outcome is required when completing an appointment');
          }

          // Create visit if requested
          if (data.outcome.visitCreated) {
            const visit = await this.createVisitFromAppointment(
              appointment,
              data.outcome,
              updatedBy
            );
            data.outcome.visitId = visit._id;
          }

          appointment.complete(data.outcome);
          break;

        case 'cancelled':
          if (!data.reason) {
            throw createValidationError('Reason is required when cancelling an appointment');
          }
          appointment.cancel(data.reason, updatedBy);
          break;

        case 'no_show':
          appointment.status = 'no_show';
          break;

        case 'in_progress':
          appointment.status = 'in_progress';
          break;

        default:
          appointment.status = data.status;
      }

      const oldStatus = appointment.status;
      appointment.updatedBy = updatedBy;
      await appointment.save();

      logger.info('Appointment status updated', {
        appointmentId: appointmentId.toString(),
        oldStatus,
        newStatus: data.status,
        updatedBy: updatedBy.toString(),
      });

      // Emit real-time event
      try {
        const appointmentSocket = app.get('appointmentSocket');
        if (appointmentSocket) {
          const user = await User.findById(updatedBy);
          if (user) {
            appointmentSocket.emitAppointmentStatusChanged(appointment, {
              userId: updatedBy.toString(),
              name: user.firstName + ' ' + user.lastName,
              role: user.role,
            }, oldStatus);
          }
        }
      } catch (socketError) {
        logger.error('Failed to emit appointment status changed event:', socketError);
      }

      return appointment;
    } catch (error) {
      logger.error('Error updating appointment status', {
        error: error instanceof Error ? error.message : 'Unknown error',
        appointmentId: appointmentId.toString(),
        data,
      });
      throw error;
    }
  }

  /**
   * Reschedule an appointment with reminder updates
   * Requirement: 1.4, 1.7
   */
  static async rescheduleAppointment(
    appointmentId: mongoose.Types.ObjectId,
    data: RescheduleAppointmentData,
    rescheduledBy: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId
  ): Promise<IAppointment> {
    try {
      const appointment = await Appointment.findOne({
        _id: appointmentId,
        workplaceId,
      });

      if (!appointment) {
        throw createNotFoundError('Appointment', appointmentId.toString());
      }

      // Validate appointment can be rescheduled
      if (['completed', 'cancelled', 'no_show'].includes(appointment.status)) {
        throw createBusinessRuleError(
          `Cannot reschedule appointment with status: ${appointment.status}`
        );
      }

      // Validate new date is not in the past
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const newDate = new Date(data.newDate);
      newDate.setHours(0, 0, 0, 0);

      if (newDate < today) {
        throw createValidationError('Cannot reschedule to a past date');
      }

      // Check for conflicts at new time
      const conflictCheck = await Appointment.checkConflict(
        appointment.assignedTo,
        data.newDate,
        data.newTime,
        appointment.duration,
        appointmentId
      );

      if (conflictCheck.hasConflict) {
        throw createBusinessRuleError(
          `Pharmacist already has an appointment at the new time. Conflicting appointment: ${conflictCheck.conflictingAppointment?.title}`
        );
      }

      // Reschedule appointment
      appointment.reschedule(data.newDate, data.newTime, data.reason, rescheduledBy);

      // Update reminders for new date/time
      appointment.reminders = this.generateDefaultReminders(data.newDate, data.newTime);

      const oldDate = appointment.rescheduledFrom!;
      const oldTime = appointment.scheduledTime; // Store old time before update
      appointment.updatedBy = rescheduledBy;
      await appointment.save();

      logger.info('Appointment rescheduled', {
        appointmentId: appointmentId.toString(),
        oldDate: appointment.rescheduledFrom,
        newDate: data.newDate,
        newTime: data.newTime,
        rescheduledBy: rescheduledBy.toString(),
      });

      // Emit real-time event
      try {
        const appointmentSocket = app.get('appointmentSocket');
        if (appointmentSocket) {
          const user = await User.findById(rescheduledBy);
          if (user) {
            appointmentSocket.emitAppointmentRescheduled(appointment, {
              userId: rescheduledBy.toString(),
              name: user.firstName + ' ' + user.lastName,
              role: user.role,
            }, oldDate, oldTime);
          }
        }
      } catch (socketError) {
        logger.error('Failed to emit appointment rescheduled event:', socketError);
      }

      // Send notification to patient if requested
      if (data.notifyPatient) {
        try {
          await appointmentNotificationService.sendAppointmentRescheduled(
            appointmentId,
            appointment.rescheduledFrom!,
            appointment.scheduledTime,
            {
              includeRescheduleLink: true,
            }
          );
        } catch (error) {
          logger.error('Failed to send reschedule notification', {
            appointmentId: appointmentId.toString(),
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          // Don't fail the reschedule operation if notification fails
        }
      }

      return appointment;
    } catch (error) {
      logger.error('Error rescheduling appointment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        appointmentId: appointmentId.toString(),
        data,
      });
      throw error;
    }
  }

  /**
   * Cancel an appointment with notification sending
   * Requirement: 1.4, 1.7
   */
  static async cancelAppointment(
    appointmentId: mongoose.Types.ObjectId,
    data: CancelAppointmentData,
    cancelledBy: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId
  ): Promise<{ appointment: IAppointment; cancelledCount: number }> {
    try {
      const appointment = await Appointment.findOne({
        _id: appointmentId,
        workplaceId,
      });

      if (!appointment) {
        throw createNotFoundError('Appointment', appointmentId.toString());
      }

      // Validate appointment can be cancelled
      if (['completed', 'cancelled'].includes(appointment.status)) {
        throw createBusinessRuleError(
          `Cannot cancel appointment with status: ${appointment.status}`
        );
      }

      let cancelledCount = 1;

      // Handle recurring appointments
      if (appointment.isRecurring && data.cancelType === 'all_future') {
        // Cancel all future instances in the series
        const futureAppointments = await Appointment.find({
          workplaceId,
          recurringSeriesId: appointment.recurringSeriesId,
          scheduledDate: { $gte: appointment.scheduledDate },
          status: { $nin: ['completed', 'cancelled'] },
        });

        for (const futureAppointment of futureAppointments) {
          futureAppointment.cancel(data.reason, cancelledBy);
          futureAppointment.updatedBy = cancelledBy;
          await futureAppointment.save();
        }

        cancelledCount = futureAppointments.length;

        logger.info('Recurring appointments cancelled', {
          seriesId: appointment.recurringSeriesId?.toString(),
          count: cancelledCount,
          cancelledBy: cancelledBy.toString(),
        });
      } else {
        // Cancel single appointment
        appointment.cancel(data.reason, cancelledBy);
        appointment.updatedBy = cancelledBy;
        await appointment.save();

        logger.info('Appointment cancelled', {
          appointmentId: appointmentId.toString(),
          reason: data.reason,
          cancelledBy: cancelledBy.toString(),
        });
      }

      // Emit real-time event
      try {
        const appointmentSocket = app.get('appointmentSocket');
        if (appointmentSocket) {
          const user = await User.findById(cancelledBy);
          if (user) {
            appointmentSocket.emitAppointmentCancelled(appointment, {
              userId: cancelledBy.toString(),
              name: user.firstName + ' ' + user.lastName,
              role: user.role,
            }, data.reason);
          }
        }
      } catch (socketError) {
        logger.error('Failed to emit appointment cancelled event:', socketError);
      }

      // Send notification to patient if requested
      if (data.notifyPatient) {
        try {
          await appointmentNotificationService.sendAppointmentCancelled(
            appointmentId,
            data.reason
          );
        } catch (error) {
          logger.error('Failed to send cancellation notification', {
            appointmentId: appointmentId.toString(),
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          // Don't fail the cancellation operation if notification fails
        }
      }

      return { appointment, cancelledCount };
    } catch (error) {
      logger.error('Error cancelling appointment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        appointmentId: appointmentId.toString(),
        data,
      });
      throw error;
    }
  }

  /**
   * Helper: Generate default appointment title
   */
  private static generateAppointmentTitle(type: string, patientName: string): string {
    const typeLabels: Record<string, string> = {
      mtm_session: 'MTM Session',
      chronic_disease_review: 'Chronic Disease Review',
      new_medication_consultation: 'New Medication Consultation',
      vaccination: 'Vaccination',
      health_check: 'Health Check',
      smoking_cessation: 'Smoking Cessation',
      general_followup: 'General Follow-up',
    };

    return `${typeLabels[type] || type} - ${patientName}`;
  }

  /**
   * Helper: Generate default reminders for an appointment
   */
  private static generateDefaultReminders(
    scheduledDate: Date,
    scheduledTime: string
  ): IAppointment['reminders'] {
    const [hours, minutes] = scheduledTime.split(':').map(Number);
    const appointmentDateTime = new Date(scheduledDate);
    appointmentDateTime.setHours(hours, minutes, 0, 0);

    const reminders: IAppointment['reminders'] = [];

    // 24 hours before
    const reminder24h = new Date(appointmentDateTime.getTime() - 24 * 60 * 60 * 1000);
    if (reminder24h > new Date()) {
      reminders.push({
        type: 'email',
        scheduledFor: reminder24h,
        sent: false,
        deliveryStatus: 'pending',
      });
      reminders.push({
        type: 'sms',
        scheduledFor: reminder24h,
        sent: false,
        deliveryStatus: 'pending',
      });
    }

    // 2 hours before
    const reminder2h = new Date(appointmentDateTime.getTime() - 2 * 60 * 60 * 1000);
    if (reminder2h > new Date()) {
      reminders.push({
        type: 'push',
        scheduledFor: reminder2h,
        sent: false,
        deliveryStatus: 'pending',
      });
    }

    // 15 minutes before
    const reminder15min = new Date(appointmentDateTime.getTime() - 15 * 60 * 1000);
    if (reminder15min > new Date()) {
      reminders.push({
        type: 'push',
        scheduledFor: reminder15min,
        sent: false,
        deliveryStatus: 'pending',
      });
    }

    return reminders;
  }

  /**
   * Helper: Validate status transition
   */
  private static validateStatusTransition(
    currentStatus: IAppointment['status'],
    newStatus: IAppointment['status']
  ): void {
    const validTransitions: Record<string, string[]> = {
      scheduled: ['confirmed', 'in_progress', 'cancelled', 'no_show', 'rescheduled'],
      confirmed: ['in_progress', 'cancelled', 'no_show', 'rescheduled'],
      in_progress: ['completed', 'cancelled'],
      rescheduled: ['scheduled', 'confirmed', 'cancelled'],
      completed: [], // Cannot transition from completed
      cancelled: [], // Cannot transition from cancelled
      no_show: [], // Cannot transition from no_show
    };

    const allowedTransitions = validTransitions[currentStatus] || [];

    if (!allowedTransitions.includes(newStatus)) {
      throw createBusinessRuleError(
        `Invalid status transition from ${currentStatus} to ${newStatus}`
      );
    }
  }

  /**
   * Create a visit record from a completed appointment
   * Requirement: 7.2, 1.4, 1.6
   */
  private static async createVisitFromAppointment(
    appointment: IAppointment,
    outcome: IAppointment['outcome'],
    createdBy: mongoose.Types.ObjectId
  ): Promise<IVisit> {
    try {
      // Pre-populate visit data from appointment
      const visitData = {
        workplaceId: appointment.workplaceId,
        locationId: appointment.locationId,
        patientId: appointment.patientId,
        appointmentId: appointment._id,
        date: new Date(), // Current date/time for the visit
        soap: {
          subjective: '', // Will be filled by pharmacist
          objective: '', // Will be filled by pharmacist
          assessment: outcome?.notes || '', // Pre-populate with appointment outcome notes
          plan: outcome?.nextActions?.join('; ') || '', // Pre-populate with next actions
        },
        attachments: [],
        createdBy,
      };

      const visit = new Visit(visitData);
      await visit.save();

      logger.info('Visit created from appointment', {
        appointmentId: appointment._id.toString(),
        visitId: visit._id.toString(),
        patientId: appointment.patientId.toString(),
        createdBy: createdBy.toString(),
      });

      return visit;
    } catch (error) {
      logger.error('Error creating visit from appointment', {
        appointmentId: appointment._id.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}

// Export as default for backward compatibility
export default AppointmentService;
