import mongoose from 'mongoose';
import Appointment, { IAppointment } from '../models/Appointment';
import Patient, { IPatient } from '../models/Patient';
import PatientUser from '../models/PatientUser';
import User, { IUser } from '../models/User';
import PharmacistSchedule from '../models/PharmacistSchedule';
import ReminderTemplate from '../models/ReminderTemplate';
import AppointmentService, { CreateAppointmentData } from './AppointmentService';
import CalendarService from './CalendarService';
import reminderSchedulerService from './ReminderSchedulerService';
import notificationService from './notificationService';
import logger from '../utils/logger';
import { AppointmentError, ValidationError } from '../utils/appointmentErrors';
import * as jwt from 'jsonwebtoken';

/**
 * Patient Portal Service
 * Handles patient-facing appointment booking and management
 */

interface AppointmentType {
  type: string;
  name: string;
  description: string;
  duration: number;
  available: boolean;
  requiresPreparation?: string;
  estimatedCost?: {
    min: number;
    max: number;
    currency: string;
  };
}

interface AvailableSlot {
  time: string;
  available: boolean;
  pharmacistId?: mongoose.Types.ObjectId;
  pharmacistName?: string;
  duration: number;
}

interface BookingData {
  patientId: mongoose.Types.ObjectId;
  type: IAppointment['type'];
  scheduledDate: Date;
  scheduledTime: string;
  duration?: number;
  assignedTo?: mongoose.Types.ObjectId;
  description?: string;
  patientNotes?: string;
  patientPreferences?: {
    preferredChannel?: string;
    language?: string;
    specialRequirements?: string;
  };
  locationId?: string;
}

interface PatientAppointmentFilters {
  status?: string;
  type?: string;
  startDate?: Date;
  endDate?: Date;
  includeCompleted?: boolean;
  includeCancelled?: boolean;
}

interface PaginationOptions {
  limit: number;
  cursor?: string;
}

interface RescheduleData {
  newDate: Date;
  newTime: string;
  reason?: string;
  notifyPharmacist?: boolean;
}

interface CancelData {
  reason: string;
  notifyPharmacist?: boolean;
}

interface ConfirmData {
  patientNotes?: string;
  specialRequirements?: string;
}

class PatientPortalService {
  /**
   * Get available appointment types for a workplace
   */
  static async getAppointmentTypes(
    workplaceId: mongoose.Types.ObjectId
  ): Promise<AppointmentType[]> {
    try {
      // Define available appointment types with descriptions
      const appointmentTypes: AppointmentType[] = [
        {
          type: 'mtm_session',
          name: 'Medication Therapy Management (MTM)',
          description: 'Comprehensive review of your medications to optimize therapy and prevent drug-related problems.',
          duration: 45,
          available: true,
          requiresPreparation: 'Please bring all your current medications, including over-the-counter drugs and supplements.',
          estimatedCost: {
            min: 5000,
            max: 15000,
            currency: 'NGN'
          }
        },
        {
          type: 'chronic_disease_review',
          name: 'Chronic Disease Management',
          description: 'Specialized consultation for managing chronic conditions like diabetes, hypertension, or asthma.',
          duration: 30,
          available: true,
          requiresPreparation: 'Please bring recent lab results and blood pressure/glucose monitoring records.',
          estimatedCost: {
            min: 3000,
            max: 10000,
            currency: 'NGN'
          }
        },
        {
          type: 'new_medication_consultation',
          name: 'New Medication Consultation',
          description: 'Counseling session for newly prescribed medications to ensure safe and effective use.',
          duration: 20,
          available: true,
          requiresPreparation: 'Please bring your prescription and any questions about the new medication.',
          estimatedCost: {
            min: 2000,
            max: 5000,
            currency: 'NGN'
          }
        },
        {
          type: 'vaccination',
          name: 'Vaccination Service',
          description: 'Administration of vaccines including flu shots, travel vaccines, and routine immunizations.',
          duration: 15,
          available: true,
          requiresPreparation: 'Please bring your vaccination record and valid ID.',
          estimatedCost: {
            min: 1000,
            max: 8000,
            currency: 'NGN'
          }
        },
        {
          type: 'health_check',
          name: 'Health Screening',
          description: 'Basic health screening including blood pressure, blood sugar, and BMI measurements.',
          duration: 25,
          available: true,
          requiresPreparation: 'Fast for 8-12 hours if blood sugar testing is requested.',
          estimatedCost: {
            min: 1500,
            max: 4000,
            currency: 'NGN'
          }
        },
        {
          type: 'smoking_cessation',
          name: 'Smoking Cessation Counseling',
          description: 'Personalized counseling and support to help you quit smoking successfully.',
          duration: 30,
          available: true,
          requiresPreparation: 'Think about your smoking habits and previous quit attempts.',
          estimatedCost: {
            min: 2500,
            max: 6000,
            currency: 'NGN'
          }
        },
        {
          type: 'general_followup',
          name: 'General Follow-up',
          description: 'Follow-up consultation to monitor your progress and address any concerns.',
          duration: 20,
          available: true,
          requiresPreparation: 'Please bring any relevant medical records or test results.',
          estimatedCost: {
            min: 2000,
            max: 5000,
            currency: 'NGN'
          }
        }
      ];

      // TODO: In the future, we could make this configurable per workplace
      // For now, return all available types
      return appointmentTypes;
    } catch (error) {
      logger.error('Error getting appointment types:', error);
      throw new AppointmentError('Failed to retrieve appointment types');
    }
  }

  /**
   * Get available appointment slots for a specific date
   */
  static async getAvailableSlots(
    workplaceId: mongoose.Types.ObjectId,
    date: Date,
    options: {
      type?: string;
      duration?: number;
      pharmacistId?: mongoose.Types.ObjectId;
      locationId?: string;
    } = {}
  ): Promise<{
    date: string;
    slots: AvailableSlot[];
    pharmacists: Array<{
      id: mongoose.Types.ObjectId;
      name: string;
      specializations: string[];
    }>;
  }> {
    try {
      const { type, duration = 30, pharmacistId, locationId } = options;

      // Get pharmacist information first
      const pharmacistQuery: any = { workplaceId, isActive: true };
      if (pharmacistId) {
        pharmacistQuery.pharmacistId = pharmacistId;
      }
      if (locationId) {
        pharmacistQuery.locationId = locationId;
      }

      const pharmacistSchedules = await PharmacistSchedule.find(pharmacistQuery)
        .populate('pharmacistId', 'firstName lastName role')
        .lean();

      const pharmacists = pharmacistSchedules.map((schedule: any) => ({
        id: schedule.pharmacistId._id,
        name: `${schedule.pharmacistId.firstName} ${schedule.pharmacistId.lastName}`,
        specializations: schedule.appointmentPreferences?.appointmentTypes || [],
      }));

      // Get available slots for each pharmacist
      const allSlots: AvailableSlot[] = [];

      for (const schedule of pharmacistSchedules) {
        try {
          const slots = await CalendarService.calculateAvailableSlots(
            schedule.pharmacistId._id,
            date,
            duration,
            workplaceId,
            type
          );

          const formattedSlots = slots.map(slot => ({
            time: slot.time,
            available: slot.available,
            pharmacistId: schedule.pharmacistId._id,
            pharmacistName: `${(schedule.pharmacistId as any).firstName} ${(schedule.pharmacistId as any).lastName}`,
            duration: duration,
          }));

          allSlots.push(...formattedSlots);
        } catch (error) {
          logger.warn('Error getting slots for pharmacist', {
            pharmacistId: schedule.pharmacistId._id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      return {
        date: date.toISOString().split('T')[0],
        slots: allSlots,
        pharmacists,
      };
    } catch (error) {
      logger.error('Error getting available slots:', error);
      throw new AppointmentError('Failed to retrieve available slots');
    }
  }

  /**
   * Book an appointment through patient portal
   */
  static async bookAppointment(
    bookingData: BookingData,
    workplaceId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId
  ): Promise<{
    appointment: IAppointment;
    confirmationNumber: string;
    reminders: any;
  }> {
    try {
      // For patient portal bookings, validate that the PatientUser exists and belongs to the workplace
      // The patientId passed here is actually a PatientUser._id, not a Patient._id
      const patientUser = await PatientUser.findOne({
        _id: bookingData.patientId,
        workplaceId,
        isDeleted: false,
      });

      if (!patientUser) {
        throw new ValidationError('Patient user not found or does not belong to this workplace');
      }

      // Try to find a linked Patient record if it exists
      let patient: IPatient | null = null;
      if (patientUser.patientId) {
        patient = await Patient.findOne({
          _id: patientUser.patientId,
          workplaceId,
          isDeleted: false,
        });
      }

      // For patient portal, we need to ensure the user has permission to book for this patient
      // This could be the patient themselves or an authorized family member
      // For now, we'll allow any authenticated user in the workplace to book
      // TODO: Implement proper patient-user relationship validation

      // Check if the requested slot is still available
      const requestedDateTime = new Date(bookingData.scheduledDate);
      const [hours, minutes] = bookingData.scheduledTime.split(':').map(Number);
      requestedDateTime.setHours(hours, minutes, 0, 0);

      const conflictingAppointment = await Appointment.findOne({
        workplaceId,
        scheduledDate: bookingData.scheduledDate,
        scheduledTime: bookingData.scheduledTime,
        assignedTo: bookingData.assignedTo,
        status: { $in: ['scheduled', 'confirmed', 'in_progress'] },
        isDeleted: false,
      });

      if (conflictingAppointment) {
        throw new ValidationError('The requested time slot is no longer available');
      }

      // Use patient name from Patient record if available, otherwise from PatientUser
      const patientFirstName = patient?.firstName || patientUser.firstName;
      const patientLastName = patient?.lastName || patientUser.lastName;

      // Create the appointment using the existing AppointmentService
      const appointmentData: CreateAppointmentData = {
        patientId: bookingData.patientId,
        type: bookingData.type,
        scheduledDate: bookingData.scheduledDate,
        scheduledTime: bookingData.scheduledTime,
        duration: bookingData.duration || 30,
        assignedTo: bookingData.assignedTo,
        title: `${bookingData.type.replace('_', ' ')} - ${patientFirstName} ${patientLastName}`,
        description: bookingData.description,
        locationId: bookingData.locationId,
        patientPreferences: bookingData.patientPreferences as any,
        metadata: {
          source: 'patient_portal',
          customFields: {
            bookingChannel: 'web',
          },
        },
      };

      const appointment = await AppointmentService.createAppointment(
        appointmentData,
        workplaceId,
        userId
      );

      // Generate a confirmation number
      const confirmationNumber = this.generateConfirmationNumber(appointment._id);

      // Schedule reminders
      const reminders = await reminderSchedulerService.scheduleAppointmentReminders(appointment._id);

      // Send immediate booking confirmation using PatientUser data
      await this.sendBookingConfirmation(appointment, patient || patientUser as any, confirmationNumber);

      return {
        appointment,
        confirmationNumber,
        reminders,
      };
    } catch (error) {
      logger.error('Error booking appointment:', error);
      if (error instanceof ValidationError || error instanceof AppointmentError) {
        throw error;
      }
      throw new AppointmentError('Failed to book appointment');
    }
  }

  /**
   * Get appointments for a patient (patient portal view)
   */
  static async getPatientAppointments(
    workplaceId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId,
    filters: PatientAppointmentFilters = {},
    pagination: PaginationOptions
  ): Promise<{
    appointments: IAppointment[];
    summary: {
      total: number;
      upcoming: number;
      completed: number;
      cancelled: number;
    };
    pagination: {
      hasMore: boolean;
      nextCursor?: string;
    };
  }> {
    try {
      // Find patients associated with this user
      // For now, we'll get all patients in the workplace
      // TODO: Implement proper patient-user relationship
      const patients = await Patient.find({
        workplaceId,
        isDeleted: false,
      }).select('_id');

      const patientIds = patients.map(p => p._id);

      // Build query
      const query: any = {
        workplaceId,
        patientId: { $in: patientIds },
        isDeleted: false,
      };

      // Apply filters
      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.type) {
        query.type = filters.type;
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

      // Handle include/exclude options
      const statusExclusions = [];
      if (!filters.includeCompleted) {
        statusExclusions.push('completed');
      }
      if (!filters.includeCancelled) {
        statusExclusions.push('cancelled', 'no_show');
      }

      if (statusExclusions.length > 0 && !filters.status) {
        query.status = { $nin: statusExclusions };
      }

      // Get appointments with pagination
      const appointments = await Appointment.find(query)
        .populate('patientId', 'firstName lastName email phone')
        .populate('assignedTo', 'firstName lastName')
        .sort({ scheduledDate: -1, scheduledTime: -1 })
        .limit(pagination.limit + 1) // Get one extra to check if there are more
        .lean();

      const hasMore = appointments.length > pagination.limit;
      if (hasMore) {
        appointments.pop(); // Remove the extra appointment
      }

      // Generate next cursor
      const nextCursor = hasMore && appointments.length > 0
        ? appointments[appointments.length - 1]._id.toString()
        : undefined;

      // Get summary statistics
      const summaryQuery = {
        workplaceId,
        patientId: { $in: patientIds },
        isDeleted: false,
      };

      const [totalCount, upcomingCount, completedCount, cancelledCount] = await Promise.all([
        Appointment.countDocuments(summaryQuery),
        Appointment.countDocuments({
          ...summaryQuery,
          status: { $in: ['scheduled', 'confirmed'] },
          scheduledDate: { $gte: new Date() },
        }),
        Appointment.countDocuments({
          ...summaryQuery,
          status: 'completed',
        }),
        Appointment.countDocuments({
          ...summaryQuery,
          status: { $in: ['cancelled', 'no_show'] },
        }),
      ]);

      return {
        appointments: appointments as IAppointment[],
        summary: {
          total: totalCount,
          upcoming: upcomingCount,
          completed: completedCount,
          cancelled: cancelledCount,
        },
        pagination: {
          hasMore,
          nextCursor,
        },
      };
    } catch (error) {
      logger.error('Error getting patient appointments:', error);
      throw new AppointmentError('Failed to retrieve appointments');
    }
  }

  /**
   * Reschedule an appointment through patient portal
   */
  static async rescheduleAppointment(
    appointmentId: mongoose.Types.ObjectId,
    rescheduleData: RescheduleData,
    workplaceId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId
  ): Promise<IAppointment> {
    try {
      // Get the appointment and validate ownership
      const appointment = await this.validatePatientAppointmentAccess(
        appointmentId,
        workplaceId,
        userId
      );

      // Check if appointment can be rescheduled
      if (!['scheduled', 'confirmed'].includes(appointment.status)) {
        throw new ValidationError('Only scheduled or confirmed appointments can be rescheduled');
      }

      // Check if it's not too late to reschedule (e.g., at least 2 hours before)
      const appointmentDateTime = new Date(appointment.scheduledDate);
      const [hours, minutes] = appointment.scheduledTime.split(':').map(Number);
      appointmentDateTime.setHours(hours, minutes, 0, 0);

      const now = new Date();
      const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      if (appointmentDateTime <= twoHoursFromNow) {
        throw new ValidationError('Appointments cannot be rescheduled less than 2 hours before the scheduled time');
      }

      // Use the existing AppointmentService to reschedule
      const rescheduledAppointment = await AppointmentService.rescheduleAppointment(
        appointmentId,
        {
          newDate: rescheduleData.newDate,
          newTime: rescheduleData.newTime,
          reason: rescheduleData.reason || 'Patient requested reschedule',
          notifyPatient: false, // Patient is doing the rescheduling
        },
        workplaceId,
        userId
      );

      // Notify pharmacist if requested
      if (rescheduleData.notifyPharmacist) {
        await this.notifyPharmacistOfReschedule(rescheduledAppointment, rescheduleData.reason);
      }

      return rescheduledAppointment;
    } catch (error) {
      logger.error('Error rescheduling appointment:', error);
      if (error instanceof ValidationError || error instanceof AppointmentError) {
        throw error;
      }
      throw new AppointmentError('Failed to reschedule appointment');
    }
  }

  /**
   * Cancel an appointment through patient portal
   */
  static async cancelAppointment(
    appointmentId: mongoose.Types.ObjectId,
    cancelData: CancelData,
    workplaceId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId
  ): Promise<IAppointment> {
    try {
      // Get the appointment and validate ownership
      const appointment = await this.validatePatientAppointmentAccess(
        appointmentId,
        workplaceId,
        userId
      );

      // Check if appointment can be cancelled
      if (!['scheduled', 'confirmed'].includes(appointment.status)) {
        throw new ValidationError('Only scheduled or confirmed appointments can be cancelled');
      }

      // Use the existing AppointmentService to cancel
      const cancelledAppointment = await AppointmentService.cancelAppointment(
        appointmentId,
        {
          reason: cancelData.reason,
          notifyPatient: false, // Patient is doing the cancellation
          cancelType: 'this_only',
        },
        workplaceId,
        userId
      );

      // Notify pharmacist if requested
      if (cancelData.notifyPharmacist) {
        await this.notifyPharmacistOfCancellation(cancelledAppointment.appointment, cancelData.reason);
      }

      return cancelledAppointment.appointment;
    } catch (error) {
      logger.error('Error cancelling appointment:', error);
      if (error instanceof ValidationError || error instanceof AppointmentError) {
        throw error;
      }
      throw new AppointmentError('Failed to cancel appointment');
    }
  }

  /**
   * Confirm an appointment (authenticated user)
   */
  static async confirmAppointment(
    appointmentId: mongoose.Types.ObjectId,
    confirmData: ConfirmData,
    workplaceId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId
  ): Promise<IAppointment> {
    try {
      // Get the appointment and validate ownership
      const appointment = await this.validatePatientAppointmentAccess(
        appointmentId,
        workplaceId,
        userId
      );

      // Check if appointment can be confirmed
      if (appointment.status !== 'scheduled') {
        throw new ValidationError('Only scheduled appointments can be confirmed');
      }

      // Update appointment status and add patient notes
      const updateData: any = {
        status: 'confirmed',
        confirmationStatus: 'confirmed',
        confirmedAt: new Date(),
        confirmedBy: userId,
      };

      if (confirmData.patientNotes) {
        updateData.description = appointment.description
          ? `${appointment.description}\n\nPatient Notes: ${confirmData.patientNotes}`
          : `Patient Notes: ${confirmData.patientNotes}`;
      }

      if (confirmData.specialRequirements) {
        updateData['patientPreferences.specialRequirements'] = confirmData.specialRequirements;
      }

      const confirmedAppointment = await Appointment.findByIdAndUpdate(
        appointmentId,
        updateData,
        { new: true }
      ).populate('patientId assignedTo');

      // Log the confirmation
      logger.info('Appointment confirmed via patient portal', {
        appointmentId,
        patientId: appointment.patientId,
        confirmedBy: userId,
        workplaceId,
      });

      return confirmedAppointment!;
    } catch (error) {
      logger.error('Error confirming appointment:', error);
      if (error instanceof ValidationError || error instanceof AppointmentError) {
        throw error;
      }
      throw new AppointmentError('Failed to confirm appointment');
    }
  }

  /**
   * Confirm an appointment using a token (from email/SMS link)
   */
  static async confirmAppointmentWithToken(
    appointmentId: mongoose.Types.ObjectId,
    token: string,
    confirmData: ConfirmData
  ): Promise<IAppointment> {
    try {
      // Verify the confirmation token
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        appointmentId: string;
        patientId: string;
        action: string;
      };

      if (decoded.action !== 'confirm_appointment' || decoded.appointmentId !== appointmentId.toString()) {
        throw new ValidationError('Invalid confirmation token');
      }

      // Get the appointment
      const appointment = await Appointment.findById(appointmentId)
        .populate('patientId assignedTo');

      if (!appointment) {
        throw new ValidationError('Appointment not found');
      }

      if (appointment.patientId._id.toString() !== decoded.patientId) {
        throw new ValidationError('Token does not match appointment patient');
      }

      // Check if appointment can be confirmed
      if (appointment.status !== 'scheduled') {
        throw new ValidationError('Only scheduled appointments can be confirmed');
      }

      // Update appointment status
      const updateData: any = {
        status: 'confirmed',
        confirmationStatus: 'confirmed',
        confirmedAt: new Date(),
      };

      if (confirmData.patientNotes) {
        updateData.description = appointment.description
          ? `${appointment.description}\n\nPatient Notes: ${confirmData.patientNotes}`
          : `Patient Notes: ${confirmData.patientNotes}`;
      }

      if (confirmData.specialRequirements) {
        updateData['patientPreferences.specialRequirements'] = confirmData.specialRequirements;
      }

      const confirmedAppointment = await Appointment.findByIdAndUpdate(
        appointmentId,
        updateData,
        { new: true }
      ).populate('patientId assignedTo');

      // Log the confirmation
      logger.info('Appointment confirmed via token', {
        appointmentId,
        patientId: appointment.patientId._id,
        workplaceId: appointment.workplaceId,
      });

      return confirmedAppointment!;
    } catch (error) {
      logger.error('Error confirming appointment with token:', error);
      if (error instanceof jwt.JsonWebTokenError) {
        throw new ValidationError('Invalid or expired confirmation token');
      }
      if (error instanceof ValidationError || error instanceof AppointmentError) {
        throw error;
      }
      throw new AppointmentError('Failed to confirm appointment');
    }
  }

  // ===============================
  // PRIVATE HELPER METHODS
  // ===============================

  /**
   * Validate that a user has access to an appointment
   */
  private static async validatePatientAppointmentAccess(
    appointmentId: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId
  ): Promise<IAppointment> {
    const appointment = await Appointment.findOne({
      _id: appointmentId,
      workplaceId,
      isDeleted: false,
    }).populate('patientId');

    if (!appointment) {
      throw new ValidationError('Appointment not found');
    }

    // TODO: Implement proper patient-user relationship validation
    // For now, we allow any authenticated user in the workplace to access appointments
    // In a real implementation, you would check if the user is the patient or an authorized family member

    return appointment;
  }

  /**
   * Generate a confirmation number for an appointment
   */
  private static generateConfirmationNumber(appointmentId: mongoose.Types.ObjectId): string {
    const timestamp = Date.now().toString(36);
    const appointmentIdShort = appointmentId.toString().slice(-6);
    return `APT-${timestamp}-${appointmentIdShort}`.toUpperCase();
  }

  /**
   * Send booking confirmation to patient
   */
  private static async sendBookingConfirmation(
    appointment: IAppointment,
    patient: IPatient,
    confirmationNumber: string
  ): Promise<void> {
    try {
      const appointmentDate = new Date(appointment.scheduledDate).toLocaleDateString();
      const appointmentTime = appointment.scheduledTime;

      // Generate confirmation token for email/SMS links
      const confirmationToken = jwt.sign(
        {
          appointmentId: appointment._id.toString(),
          patientId: patient._id.toString(),
          action: 'confirm_appointment',
        },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      );

      const confirmationUrl = `${process.env.FRONTEND_URL}/patient-portal/appointments/${appointment._id}/confirm?token=${confirmationToken}`;

      // Create notification using the existing service
      await notificationService.createNotification({
        userId: patient._id,
        type: 'appointment_reminder',
        title: 'Appointment Booked Successfully',
        content: `Your appointment has been booked for ${appointmentDate} at ${appointmentTime}. Confirmation number: ${confirmationNumber}`,
        data: {
          appointmentId: appointment._id,
          patientId: patient._id,
          metadata: {
            confirmationNumber,
            confirmationUrl,
            appointmentDate,
            appointmentTime,
          },
        },
        workplaceId: appointment.workplaceId,
        createdBy: appointment.createdBy,
      });
    } catch (error) {
      logger.error('Error sending booking confirmation:', error);
      // Don't throw error - booking was successful even if notification failed
    }
  }

  /**
   * Notify pharmacist of appointment reschedule
   */
  private static async notifyPharmacistOfReschedule(
    appointment: IAppointment,
    reason?: string
  ): Promise<void> {
    try {
      if (!appointment.assignedTo) return;

      const appointmentDate = new Date(appointment.scheduledDate).toLocaleDateString();
      const appointmentTime = appointment.scheduledTime;

      await notificationService.createNotification({
        userId: appointment.assignedTo,
        type: 'appointment_reminder',
        title: 'Appointment Rescheduled by Patient',
        content: `Patient has rescheduled their appointment to ${appointmentDate} at ${appointmentTime}${reason ? `. Reason: ${reason}` : ''}`,
        data: {
          appointmentId: appointment._id,
          patientId: appointment.patientId,
          metadata: {
            newDate: appointmentDate,
            newTime: appointmentTime,
            reason,
          },
        },
        workplaceId: appointment.workplaceId,
        createdBy: appointment.createdBy,
      });
    } catch (error) {
      logger.error('Error notifying pharmacist of reschedule:', error);
    }
  }

  /**
   * Notify pharmacist of appointment cancellation
   */
  private static async notifyPharmacistOfCancellation(
    appointment: IAppointment,
    reason: string
  ): Promise<void> {
    try {
      if (!appointment.assignedTo) return;

      const appointmentDate = new Date(appointment.scheduledDate).toLocaleDateString();
      const appointmentTime = appointment.scheduledTime;

      await notificationService.createNotification({
        userId: appointment.assignedTo,
        type: 'appointment_reminder',
        title: 'Appointment Cancelled by Patient',
        content: `Patient has cancelled their appointment scheduled for ${appointmentDate} at ${appointmentTime}. Reason: ${reason}`,
        data: {
          appointmentId: appointment._id,
          patientId: appointment.patientId,
          metadata: {
            scheduledDate: appointmentDate,
            scheduledTime: appointmentTime,
            reason,
          },
        },
        workplaceId: appointment.workplaceId,
        createdBy: appointment.createdBy,
      });
    } catch (error) {
      logger.error('Error notifying pharmacist of cancellation:', error);
    }
  }
}

export default PatientPortalService;