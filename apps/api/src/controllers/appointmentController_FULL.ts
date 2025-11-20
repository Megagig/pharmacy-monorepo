/**
 * Complete Appointment Controller Implementation
 * Copy the contents below into appointmentController.ts replacing all existing TODO implementations
 */

import { Response } from 'express';
import { AuthRequest } from '../types/auth';
import logger from '../utils/logger';
import Appointment, { IAppointment } from '../models/Appointment';
import { startOfDay, endOfDay, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parse } from 'date-fns';

class AppointmentController {
  /**
   * Get appointments (already implemented in previous edit)
   */

  /**
   * Get available appointment slots
   */
  async getAvailableSlots(req: AuthRequest, res: Response) {
    try {
      const { date, pharmacistId, duration = 30, type } = req.query;
      const workplaceId = req.user?.workplaceId;

      if (!workplaceId || !date) {
        return res.status(400).json({
          success: false,
          message: 'Workplace ID and date are required'
        });
      }

      const targetDate = new Date(date as string);
      const startTime = startOfDay(targetDate);
      const endTime = endOfDay(targetDate);

      // Fetch existing appointments for the day
      const query: any = {
        workplaceId,
        scheduledDate: {
          $gte: startTime,
          $lte: endTime
        },
        status: { $in: ['scheduled', 'confirmed', 'in_progress'] },
        isDeleted: false
      };

      if (pharmacistId) query.assignedTo = pharmacistId;

      const existingAppointments = await Appointment.find(query)
        .select('scheduledTime duration assignedTo')
        .lean();

      // Generate time slots (8 AM to 6 PM in 15-minute intervals)
      const slots = [];
      const workHoursStart = 8; // 8 AM
      const workHoursEnd = 18; // 6 PM

      for (let hour = workHoursStart; hour < workHoursEnd; hour++) {
        for (let minute = 0; minute < 60; minute += 15) {
          const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          
          // Check if slot is available
          const isAvailable = !existingAppointments.some((apt: any) => {
            const aptStart = parse(apt.scheduledTime, 'HH:mm', targetDate);
            const slotStart = parse(time, 'HH:mm', targetDate);
            const slotEnd = addMinutes(slotStart, Number(duration));
            const aptEnd = addMinutes(aptStart, apt.duration);

            // Check for overlap
            return (slotStart < aptEnd && slotEnd > aptStart);
          });

          if (isAvailable) {
            slots.push({
              time,
              available: true,
              duration: Number(duration)
            });
          }
        }
      }

      res.json({
        success: true,
        data: {
          date: targetDate,
          slots,
          totalAvailable: slots.length
        }
      });
    } catch (error) {
      logger.error('Error getting available slots:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get available slots'
      });
    }
  }

  /**
   * Create new appointment
   */
  async createAppointment(req: AuthRequest, res: Response) {
    try {
      const workplaceId = req.user?.workplaceId;
      const userId = req.user?._id;

      if (!workplaceId || !userId) {
        return res.status(400).json({
          success: false,
          message: 'Workplace ID and user ID are required'
        });
      }

      const appointmentData = {
        ...req.body,
        workplaceId,
        createdBy: userId,
        confirmationStatus: 'pending',
        status: 'scheduled',
        isRecurring: req.body.isRecurring || false,
        isRecurringException: false,
        reminders: [],
        relatedRecords: {},
        metadata: {
          source: 'manual'
        }
      };

      // Check for conflicts
      if (appointmentData.assignedTo) {
        const conflict = await Appointment.findOne({
          workplaceId,
          assignedTo: appointmentData.assignedTo,
          scheduledDate: appointmentData.scheduledDate,
          scheduledTime: appointmentData.scheduledTime,
          status: { $in: ['scheduled', 'confirmed', 'in_progress'] },
          isDeleted: false
        });

        if (conflict) {
          return res.status(409).json({
            success: false,
            message: 'Time slot conflict detected'
          });
        }
      }

      const appointment = await Appointment.create(appointmentData);
      
      // Populate relations
      await appointment.populate([
        { path: 'patientId', select: 'name email phone' },
        { path: 'assignedTo', select: 'name email role' }
      ]);

      logger.info(`Appointment created: ${appointment._id}`, {
        appointmentId: appointment._id,
        patientId: appointment.patientId,
        workplaceId
      });

      res.status(201).json({
        success: true,
        message: 'Appointment created successfully',
        data: { appointment }
      });
    } catch (error: any) {
      logger.error('Error creating appointment:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create appointment'
      });
    }
  }

  /**
   * Get single appointment
   */
  async getAppointment(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const workplaceId = req.user?.workplaceId;

      const appointment = await Appointment.findOne({
        _id: id,
        workplaceId,
        isDeleted: false
      })
        .populate('patientId', 'name email phone dateOfBirth medicalHistory')
        .populate('assignedTo', 'name email role phone')
        .populate('createdBy', 'name email')
        .lean();

      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: 'Appointment not found'
        });
      }

      res.json({
        success: true,
        data: { appointment }
      });
    } catch (error) {
      logger.error('Error getting appointment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get appointment'
      });
    }
  }

  /**
   * Update appointment
   */
  async updateAppointment(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const workplaceId = req.user?.workplaceId;
      const userId = req.user?._id;
      const { updateType = 'this_only', ...updates } = req.body;

      const appointment = await Appointment.findOne({
        _id: id,
        workplaceId,
        isDeleted: false
      });

      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: 'Appointment not found'
        });
      }

      // Update the appointment
      Object.assign(appointment, {
        ...updates,
        updatedBy: userId,
        updatedAt: new Date()
      });

      await appointment.save();

      // If recurring and update type is 'this_and_future', update future occurrences
      if (appointment.isRecurring && updateType === 'this_and_future' && appointment.recurringSeriesId) {
        await Appointment.updateMany(
          {
            recurringSeriesId: appointment.recurringSeriesId,
            scheduledDate: { $gte: appointment.scheduledDate },
            _id: { $ne: appointment._id },
            isDeleted: false
          },
          {
            $set: {
              ...updates,
              updatedBy: userId,
              updatedAt: new Date()
            }
          }
        );
      }

      await appointment.populate([
        { path: 'patientId', select: 'name email phone' },
        { path: 'assignedTo', select: 'name email role' }
      ]);

      res.json({
        success: true,
        message: 'Appointment updated successfully',
        data: { appointment }
      });
    } catch (error: any) {
      logger.error('Error updating appointment:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update appointment'
      });
    }
  }

  /**
   * Update appointment status
   */
  async updateAppointmentStatus(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const workplaceId = req.user?.workplaceId;

      const appointment = await Appointment.findOne({
        _id: id,
        workplaceId,
        isDeleted: false
      });

      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: 'Appointment not found'
        });
      }

      appointment.status = status;
      
      if (status === 'completed') {
        appointment.completedAt = new Date();
      }

      await appointment.save();

      res.json({
        success: true,
        message: 'Appointment status updated successfully',
        data: { appointment }
      });
    } catch (error) {
      logger.error('Error updating appointment status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update appointment status'
      });
    }
  }

  /**
   * Reschedule appointment
   */
  async rescheduleAppointment(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { scheduledDate, scheduledTime, reason } = req.body;
      const workplaceId = req.user?.workplaceId;
      const userId = req.user?._id;

      const appointment = await Appointment.findOne({
        _id: id,
        workplaceId,
        isDeleted: false
      });

      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: 'Appointment not found'
        });
      }

      // Store old date/time
      const oldDate = appointment.scheduledDate;
      const oldTime = appointment.scheduledTime;

      // Update appointment
      appointment.scheduledDate = new Date(scheduledDate);
      appointment.scheduledTime = scheduledTime;
      appointment.rescheduledFrom = oldDate;
      appointment.rescheduledTo = new Date(scheduledDate);
      appointment.rescheduledReason = reason;
      appointment.rescheduledBy = userId;
      appointment.rescheduledAt = new Date();
      appointment.status = 'rescheduled';

      await appointment.save();

      logger.info(`Appointment rescheduled: ${appointment._id}`, {
        from: { date: oldDate, time: oldTime },
        to: { date: scheduledDate, time: scheduledTime }
      });

      res.json({
        success: true,
        message: 'Appointment rescheduled successfully',
        data: { appointment }
      });
    } catch (error) {
      logger.error('Error rescheduling appointment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reschedule appointment'
      });
    }
  }

  /**
   * Cancel appointment
   */
  async cancelAppointment(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { reason, cancelAllFuture = false } = req.body;
      const workplaceId = req.user?.workplaceId;
      const userId = req.user?._id;

      const appointment = await Appointment.findOne({
        _id: id,
        workplaceId,
        isDeleted: false
      });

      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: 'Appointment not found'
        });
      }

      // Cancel the appointment
      appointment.status = 'cancelled';
      appointment.cancelledAt = new Date();
      appointment.cancelledBy = userId;
      appointment.cancellationReason = reason;

      await appointment.save();

      let cancelledCount = 1;

      // If recurring and cancel all future
      if (appointment.isRecurring && cancelAllFuture && appointment.recurringSeriesId) {
        const result = await Appointment.updateMany(
          {
            recurringSeriesId: appointment.recurringSeriesId,
            scheduledDate: { $gt: appointment.scheduledDate },
            isDeleted: false,
            status: { $nin: ['completed', 'cancelled'] }
          },
          {
            $set: {
              status: 'cancelled',
              cancelledAt: new Date(),
              cancelledBy: userId,
              cancellationReason: reason
            }
          }
        );
        cancelledCount += result.modifiedCount;
      }

      logger.info(`Appointment(s) cancelled: ${cancelledCount}`, {
        appointmentId: id,
        cancelledCount
      });

      res.json({
        success: true,
        message: 'Appointment cancelled successfully',
        data: {
          appointment,
          cancelledCount
        }
      });
    } catch (error) {
      logger.error('Error cancelling appointment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cancel appointment'
      });
    }
  }

  /**
   * Complete appointment
   */
  async completeAppointment(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { outcome } = req.body;
      const workplaceId = req.user?.workplaceId;

      const appointment = await Appointment.findOne({
        _id: id,
        workplaceId,
        isDeleted: false
      });

      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: 'Appointment not found'
        });
      }

      appointment.status = 'completed';
      appointment.completedAt = new Date();
      appointment.outcome = outcome;

      await appointment.save();

      res.json({
        success: true,
        message: 'Appointment completed successfully',
        data: { appointment }
      });
    } catch (error) {
      logger.error('Error completing appointment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to complete appointment'
      });
    }
  }

  /**
   * Get appointment analytics
   */
  async getAppointmentAnalytics(req: AuthRequest, res: Response) {
    try {
      const workplaceId = req.user?.workplaceId;
      const { startDate, endDate } = req.query;

      if (!workplaceId) {
        return res.status(400).json({
          success: false,
          message: 'Workplace ID is required'
        });
      }

      const query: any = {
        workplaceId,
        isDeleted: false
      };

      if (startDate && endDate) {
        query.scheduledDate = {
          $gte: new Date(startDate as string),
          $lte: new Date(endDate as string)
        };
      }

      const appointments = await Appointment.find(query).lean();

      // Calculate analytics
      const analytics = {
        total: appointments.length,
        byStatus: {},
        byType: {},
        completionRate: 0,
        noShowRate: 0,
        cancellationRate: 0
      };

      appointments.forEach((apt: any) => {
        analytics.byStatus[apt.status] = (analytics.byStatus[apt.status] || 0) + 1;
        analytics.byType[apt.type] = (analytics.byType[apt.type] || 0) + 1;
      });

      const completed = analytics.byStatus['completed'] || 0;
      const noShow = analytics.byStatus['no_show'] || 0;
      const cancelled = analytics.byStatus['cancelled'] || 0;

      analytics.completionRate = appointments.length > 0 ? (completed / appointments.length) * 100 : 0;
      analytics.noShowRate = appointments.length > 0 ? (noShow / appointments.length) * 100 : 0;
      analytics.cancellationRate = appointments.length > 0 ? (cancelled / appointments.length) * 100 : 0;

      res.json({
        success: true,
        data: { analytics }
      });
    } catch (error) {
      logger.error('Error getting appointment analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get appointment analytics'
      });
    }
  }
}

// Helper function
function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

export default new AppointmentController();
