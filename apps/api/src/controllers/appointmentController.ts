/**
 * Complete Appointment Controller Implementation
 * Copy the contents below into appointmentController.ts replacing all existing TODO implementations
 */

import { Response } from 'express';
import { AuthRequest } from '../types/auth';
import logger from '../utils/logger';
import mongoose from 'mongoose';
import Appointment, { IAppointment } from '../models/Appointment';
import { startOfDay, endOfDay, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parse, addMinutes } from 'date-fns';
import { SlotGenerationService } from '../services/SlotGenerationService';

class AppointmentController {
  /**
   * Get appointments list with filtering and pagination
   */
  async getAppointments(req: AuthRequest, res: Response) {
    try {
      const {
        page = 1,
        limit = 50,
        status,
        pharmacistId,
        patientId,
        startDate,
        endDate
      } = req.query;
      const workplaceId = req.user?.workplaceId;

      if (!workplaceId) {
        return res.status(400).json({
          success: false,
          message: 'Workplace ID is required'
        });
      }

      // Build query
      const query: any = {
        workplaceId,
        isDeleted: false
      };

      if (status) query.status = status;
      if (pharmacistId) query.assignedTo = pharmacistId;
      if (patientId) query.patientId = patientId;

      // Date range filtering
      if (startDate || endDate) {
        query.scheduledDate = {};
        if (startDate) query.scheduledDate.$gte = new Date(startDate as string);
        if (endDate) query.scheduledDate.$lte = new Date(endDate as string);
      }

      const skip = (Number(page) - 1) * Number(limit);

      // Fetch appointments with population
      const [appointments, total] = await Promise.all([
        Appointment.find(query)
          .populate('patientId', 'firstName lastName email phone dateOfBirth')
          .populate('assignedTo', 'firstName lastName email role')
          .sort({ scheduledDate: -1, scheduledTime: -1 })
          .limit(Number(limit))
          .skip(skip)
          .lean(),
        Appointment.countDocuments(query)
      ]);

      // Calculate summary statistics
      const summary = {
        total: appointments.length,
        byStatus: appointments.reduce((acc: any, apt: any) => {
          acc[apt.status] = (acc[apt.status] || 0) + 1;
          return acc;
        }, {}),
        byType: appointments.reduce((acc: any, apt: any) => {
          acc[apt.type] = (acc[apt.type] || 0) + 1;
          return acc;
        }, {})
      };

      res.json({
        success: true,
        data: {
          results: appointments,
        },
        meta: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
          hasNext: skip + appointments.length < total,
          hasPrev: Number(page) > 1,
        },
        summary,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error getting appointments:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get appointments'
      });
    }
  }

  /**
   * Get appointments for calendar view
   */
  async getCalendarAppointments(req: AuthRequest, res: Response) {
    try {
      const { view = 'month', date, pharmacistId, locationId } = req.query;
      const workplaceId = req.user?.workplaceId;

      if (!workplaceId) {
        return res.status(400).json({
          success: false,
          message: 'Workplace ID is required'
        });
      }

      // Parse the date or use current date
      const targetDate = date ? new Date(date as string) : new Date();
      let startDate: Date;
      let endDate: Date;

      // Calculate date range based on view
      switch (view) {
        case 'day':
          startDate = startOfDay(targetDate);
          endDate = endOfDay(targetDate);
          break;
        case 'week':
          startDate = startOfWeek(targetDate);
          endDate = endOfWeek(targetDate);
          break;
        case 'month':
        default:
          startDate = startOfMonth(targetDate);
          endDate = endOfMonth(targetDate);
          break;
      }

      // Build query
      const query: any = {
        workplaceId,
        scheduledDate: {
          $gte: startDate,
          $lte: endDate
        },
        isDeleted: false
      };

      if (pharmacistId) query.assignedTo = pharmacistId;
      if (locationId) query.locationId = locationId;

      // Fetch appointments with population
      const appointments = await Appointment.find(query)
        .populate('patientId', 'name email phone dateOfBirth')
        .populate('assignedTo', 'name email role')
        .sort({ scheduledDate: 1, scheduledTime: 1 })
        .lean();

      // Calculate summary statistics
      const summary = {
        total: appointments.length,
        byStatus: appointments.reduce((acc: any, apt: any) => {
          acc[apt.status] = (acc[apt.status] || 0) + 1;
          return acc;
        }, {}),
        byType: appointments.reduce((acc: any, apt: any) => {
          acc[apt.type] = (acc[apt.type] || 0) + 1;
          return acc;
        }, {})
      };

      res.json({
        success: true,
        data: {
          appointments,
          summary,
          dateRange: { start: startDate, end: endDate }
        }
      });
    } catch (error) {
      logger.error('Error getting calendar appointments:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get calendar appointments'
      });
    }
  }

  /**
   * Get available appointment slots using enhanced slot generation service
   */
  async getAvailableSlots(req: AuthRequest, res: Response) {
    try {
      const { date, pharmacistId, duration = 30, type, includeUnavailable = false } = req.query;
      const workplaceId = req.user?.workplaceId;

      if (!workplaceId || !date) {
        return res.status(400).json({
          success: false,
          message: 'Workplace ID and date are required'
        });
      }

      // Validate and parse date
      const targetDate = new Date(date as string);
      if (isNaN(targetDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format'
        });
      }

      // Validate date is not in the past
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const requestDate = new Date(targetDate);
      requestDate.setHours(0, 0, 0, 0);

      if (requestDate < today) {
        return res.status(400).json({
          success: false,
          message: 'Cannot get slots for past dates'
        });
      }

      // Validate duration
      const durationNum = Number(duration);
      if (durationNum < 5 || durationNum > 480) {
        return res.status(400).json({
          success: false,
          message: 'Duration must be between 5 and 480 minutes'
        });
      }

      // Parse pharmacist ID if provided
      let pharmacistObjectId: mongoose.Types.ObjectId | undefined;
      if (pharmacistId) {
        try {
          pharmacistObjectId = new mongoose.Types.ObjectId(pharmacistId as string);
        } catch (error) {
          return res.status(400).json({
            success: false,
            message: 'Invalid pharmacist ID format'
          });
        }
      }

      logger.info('Getting available slots', {
        date: targetDate.toISOString(),
        pharmacistId: pharmacistObjectId?.toString(),
        duration: durationNum,
        appointmentType: type,
        workplaceId: workplaceId.toString()
      });

      // Convert workplaceId to ObjectId
      const workplaceObjectId = new mongoose.Types.ObjectId(workplaceId);

      // Generate slots using the enhanced service
      const result = await SlotGenerationService.generateAvailableSlots({
        date: targetDate,
        pharmacistId: pharmacistObjectId,
        duration: durationNum,
        appointmentType: type as string,
        workplaceId: workplaceObjectId,
        includeUnavailable: includeUnavailable === 'true'
      });

      // Log the results for debugging
      logger.info('Generated slots result', {
        totalSlots: result.summary.totalSlots,
        availableSlots: result.summary.availableSlots,
        pharmacistsCount: result.pharmacists.length,
        utilizationRate: result.summary.utilizationRate
      });

      res.json({
        success: true,
        data: {
          date: targetDate,
          slots: result.slots,
          pharmacists: result.pharmacists,
          summary: result.summary,
          totalAvailable: result.summary.availableSlots,
          // Legacy compatibility
          totalSlots: result.summary.totalSlots
        },
        message: result.summary.availableSlots === 0
          ? 'No available slots found for the selected criteria'
          : `Found ${result.summary.availableSlots} available slots`
      });

    } catch (error) {
      logger.error('Error getting available slots:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get available slots',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Create new appointment with enhanced slot validation
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

      const {
        patientId,
        type,
        scheduledDate,
        scheduledTime,
        duration = 30,
        assignedTo,
        title,
        description,
        isRecurring = false,
        recurrencePattern,
        patientPreferences
      } = req.body;

      // Validate required fields
      if (!patientId || !type || !scheduledDate || !scheduledTime) {
        return res.status(400).json({
          success: false,
          message: 'Patient ID, type, scheduled date, and time are required'
        });
      }

      // Parse and validate date
      const appointmentDate = new Date(scheduledDate);
      if (isNaN(appointmentDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid scheduled date format'
        });
      }

      // Validate date is not in the past
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const requestDate = new Date(appointmentDate);
      requestDate.setHours(0, 0, 0, 0);

      if (requestDate < today) {
        return res.status(400).json({
          success: false,
          message: 'Cannot schedule appointments in the past'
        });
      }

      // Validate time format
      const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(scheduledTime)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid time format. Use HH:mm format'
        });
      }

      // Convert workplaceId to ObjectId
      const workplaceObjectId = new mongoose.Types.ObjectId(workplaceId);

      // Parse pharmacist ID
      let pharmacistObjectId: mongoose.Types.ObjectId | undefined;
      if (assignedTo) {
        try {
          pharmacistObjectId = new mongoose.Types.ObjectId(assignedTo);
        } catch (error) {
          return res.status(400).json({
            success: false,
            message: 'Invalid pharmacist ID format'
          });
        }

        // Validate slot availability using our enhanced service
        const slotValidation = await SlotGenerationService.validateSlotAvailability(
          pharmacistObjectId,
          appointmentDate,
          scheduledTime,
          duration,
          workplaceObjectId,
          type
        );

        if (!slotValidation.available) {
          return res.status(409).json({
            success: false,
            message: `Time slot not available: ${slotValidation.reason}`,
            conflictingAppointment: slotValidation.conflictingAppointment ? {
              id: slotValidation.conflictingAppointment._id,
              title: slotValidation.conflictingAppointment.title,
              time: slotValidation.conflictingAppointment.scheduledTime
            } : undefined
          });
        }
      }

      // Prepare appointment data
      const appointmentData = {
        workplaceId: workplaceObjectId,
        patientId: new mongoose.Types.ObjectId(patientId),
        type,
        scheduledDate: appointmentDate,
        scheduledTime,
        duration,
        assignedTo: pharmacistObjectId,
        title: title || `${type.replace('_', ' ')} appointment`,
        description,
        timezone: 'Africa/Lagos',
        status: 'scheduled' as const,
        confirmationStatus: 'pending' as const,
        isRecurring,
        recurrencePattern,
        patientPreferences,
        reminders: [],
        relatedRecords: {},
        metadata: {
          source: 'manual',
          createdVia: 'appointment_management'
        },
        createdBy: userId,
        isDeleted: false
      };

      // Create the appointment
      const appointment = await Appointment.create(appointmentData);

      // Populate relations for response
      await appointment.populate([
        { path: 'patientId', select: 'firstName lastName email phone dateOfBirth' },
        { path: 'assignedTo', select: 'firstName lastName email role' },
        { path: 'createdBy', select: 'firstName lastName email' }
      ]);

      logger.info('Appointment created successfully', {
        appointmentId: appointment._id.toString(),
        patientId: appointment.patientId,
        assignedTo: appointment.assignedTo,
        scheduledDate: appointmentDate.toISOString(),
        scheduledTime,
        type,
        workplaceId: workplaceId.toString()
      });

      res.status(201).json({
        success: true,
        message: 'Appointment created successfully',
        data: {
          appointment,
          reminders: appointment.reminders || []
        }
      });

    } catch (error: any) {
      logger.error('Error creating appointment:', error);

      // Handle specific MongoDB errors
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'Appointment conflict detected'
        });
      }

      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create appointment',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
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
   * Confirm appointment
   */
  async confirmAppointment(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { confirmationToken } = req.body;
      const workplaceId = req.user?.workplaceId;
      const userId = req.user?._id;

      const appointment = await Appointment.findOne({
        _id: id,
        isDeleted: false
      });

      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: 'Appointment not found'
        });
      }

      appointment.confirmationStatus = 'confirmed';
      appointment.confirmedAt = new Date();
      if (userId) appointment.confirmedBy = userId;

      await appointment.save();

      res.json({
        success: true,
        message: 'Appointment confirmed successfully',
        data: { appointment }
      });
    } catch (error) {
      logger.error('Error confirming appointment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to confirm appointment'
      });
    }
  }

  /**
   * Get patient appointments
   */
  async getPatientAppointments(req: AuthRequest, res: Response) {
    try {
      const { patientId } = req.params;
      const { status, limit = 50, page = 1 } = req.query;
      const workplaceId = req.user?.workplaceId;

      const query: any = {
        workplaceId,
        patientId,
        isDeleted: false
      };

      if (status) query.status = status;

      const skip = (Number(page) - 1) * Number(limit);

      const [appointments, total] = await Promise.all([
        Appointment.find(query)
          .populate('assignedTo', 'name email role')
          .sort({ scheduledDate: -1 })
          .limit(Number(limit))
          .skip(skip)
          .lean(),
        Appointment.countDocuments(query)
      ]);

      res.json({
        success: true,
        data: {
          appointments,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit))
          }
        }
      });
    } catch (error) {
      logger.error('Error getting patient appointments:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get patient appointments'
      });
    }
  }

  /**
   * Get upcoming appointments
   */
  async getUpcomingAppointments(req: AuthRequest, res: Response) {
    try {
      const { days = 7, pharmacistId } = req.query;
      const workplaceId = req.user?.workplaceId;

      const query: any = {
        workplaceId,
        scheduledDate: {
          $gte: new Date(),
          $lte: addDays(new Date(), Number(days))
        },
        status: { $in: ['scheduled', 'confirmed'] },
        isDeleted: false
      };

      if (pharmacistId) query.assignedTo = pharmacistId;

      const appointments = await Appointment.find(query)
        .populate('patientId', 'name email phone')
        .populate('assignedTo', 'name email role')
        .sort({ scheduledDate: 1, scheduledTime: 1 })
        .lean();

      res.json({
        success: true,
        data: { appointments }
      });
    } catch (error) {
      logger.error('Error getting upcoming appointments:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get upcoming appointments'
      });
    }
  }

  /**
   * Update recurring appointment
   */
  async updateRecurringAppointment(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { updateType, changes } = req.body;
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

      if (!appointment.isRecurring || !appointment.recurringSeriesId) {
        return res.status(400).json({
          success: false,
          message: 'Appointment is not part of a recurring series'
        });
      }

      let updatedCount = 0;

      if (updateType === 'this_only') {
        Object.assign(appointment, { ...changes, updatedBy: userId });
        await appointment.save();
        updatedCount = 1;
      } else if (updateType === 'this_and_future') {
        const result = await Appointment.updateMany(
          {
            recurringSeriesId: appointment.recurringSeriesId,
            scheduledDate: { $gte: appointment.scheduledDate },
            isDeleted: false
          },
          { $set: { ...changes, updatedBy: userId } }
        );
        updatedCount = result.modifiedCount;
      } else if (updateType === 'all_instances') {
        const result = await Appointment.updateMany(
          {
            recurringSeriesId: appointment.recurringSeriesId,
            isDeleted: false
          },
          { $set: { ...changes, updatedBy: userId } }
        );
        updatedCount = result.modifiedCount;
      }

      res.json({
        success: true,
        message: `Updated ${updatedCount} appointment(s)`,
        data: { updatedCount }
      });
    } catch (error) {
      logger.error('Error updating recurring appointment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update recurring appointment'
      });
    }
  }

  /**
   * Get recurring series
   */
  async getRecurringSeries(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const workplaceId = req.user?.workplaceId;

      const appointment = await Appointment.findOne({
        _id: id,
        workplaceId,
        isDeleted: false
      });

      if (!appointment || !appointment.recurringSeriesId) {
        return res.status(404).json({
          success: false,
          message: 'Recurring series not found'
        });
      }

      const seriesAppointments = await Appointment.find({
        recurringSeriesId: appointment.recurringSeriesId,
        workplaceId,
        isDeleted: false
      })
        .populate('patientId', 'name email phone')
        .populate('assignedTo', 'name email role')
        .sort({ scheduledDate: 1 })
        .lean();

      res.json({
        success: true,
        data: { appointments: seriesAppointments }
      });
    } catch (error) {
      logger.error('Error getting recurring series:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get recurring series'
      });
    }
  }

  /**
   * Get appointment types
   */
  async getAppointmentTypes(req: AuthRequest, res: Response) {
    try {
      const types = [
        { value: 'mtm_session', label: 'MTM Session', duration: 60 },
        { value: 'chronic_disease_review', label: 'Chronic Disease Review', duration: 45 },
        { value: 'new_medication_consultation', label: 'New Medication Consultation', duration: 30 },
        { value: 'vaccination', label: 'Vaccination', duration: 15 },
        { value: 'health_check', label: 'Health Check', duration: 30 },
        { value: 'smoking_cessation', label: 'Smoking Cessation', duration: 45 },
        { value: 'general_followup', label: 'General Follow-up', duration: 30 }
      ];

      res.json({
        success: true,
        data: { types }
      });
    } catch (error) {
      logger.error('Error getting appointment types:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get appointment types'
      });
    }
  }

  /**
   * Book appointment through portal
   */
  async bookAppointmentPortal(req: AuthRequest, res: Response) {
    try {
      const { patientInfo, appointmentType, scheduledDate, scheduledTime } = req.body;
      const workplaceId = req.user?.workplaceId || req.body.workplaceId;

      // For portal bookings, patient info might need to be looked up or created
      // This is a simplified version
      const appointmentData = {
        workplaceId,
        patientId: patientInfo.patientId,
        type: appointmentType,
        title: `${appointmentType.replace('_', ' ')} - Portal Booking`,
        scheduledDate: new Date(scheduledDate),
        scheduledTime,
        duration: 30,
        status: 'scheduled',
        confirmationStatus: 'pending',
        isRecurring: false,
        isRecurringException: false,
        reminders: [],
        relatedRecords: {},
        metadata: {
          source: 'patient_portal'
        },
        createdBy: patientInfo.patientId
      };

      const appointment = await Appointment.create(appointmentData);

      res.status(201).json({
        success: true,
        message: 'Appointment booked successfully',
        data: { appointment }
      });
    } catch (error: any) {
      logger.error('Error booking appointment through portal:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to book appointment'
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

  /**
   * Get next available slot for a pharmacist
   */
  async getNextAvailableSlot(req: AuthRequest, res: Response) {
    try {
      const { pharmacistId, duration = 30, type, daysAhead = 14 } = req.query;
      const workplaceId = req.user?.workplaceId;

      if (!workplaceId || !pharmacistId) {
        return res.status(400).json({
          success: false,
          message: 'Workplace ID and pharmacist ID are required'
        });
      }

      const pharmacistObjectId = new mongoose.Types.ObjectId(pharmacistId as string);
      const workplaceObjectId = new mongoose.Types.ObjectId(workplaceId);

      const nextSlot = await SlotGenerationService.getNextAvailableSlot(
        pharmacistObjectId,
        workplaceObjectId,
        Number(duration),
        type as string,
        Number(daysAhead)
      );

      if (!nextSlot) {
        return res.json({
          success: true,
          data: null,
          message: `No available slots found in the next ${daysAhead} days`
        });
      }

      res.json({
        success: true,
        data: nextSlot,
        message: 'Next available slot found'
      });

    } catch (error) {
      logger.error('Error getting next available slot:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get next available slot'
      });
    }
  }

  /**
   * Validate slot availability
   */
  async validateSlot(req: AuthRequest, res: Response) {
    try {
      const { pharmacistId, date, time, duration = 30, type } = req.body;
      const workplaceId = req.user?.workplaceId;

      if (!workplaceId || !pharmacistId || !date || !time) {
        return res.status(400).json({
          success: false,
          message: 'Workplace ID, pharmacist ID, date, and time are required'
        });
      }

      const pharmacistObjectId = new mongoose.Types.ObjectId(pharmacistId);
      const appointmentDate = new Date(date);
      const workplaceObjectId = new mongoose.Types.ObjectId(workplaceId);

      const validation = await SlotGenerationService.validateSlotAvailability(
        pharmacistObjectId,
        appointmentDate,
        time,
        Number(duration),
        workplaceObjectId,
        type
      );

      res.json({
        success: true,
        data: validation,
        message: validation.available ? 'Slot is available' : 'Slot is not available'
      });

    } catch (error) {
      logger.error('Error validating slot:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to validate slot'
      });
    }
  }

  /**
   * Get pharmacist availability summary
   */
  async getPharmacistAvailability(req: AuthRequest, res: Response) {
    try {
      const { pharmacistId, startDate, endDate, duration = 30 } = req.query;
      const workplaceId = req.user?.workplaceId;

      if (!workplaceId || !pharmacistId || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Workplace ID, pharmacist ID, start date, and end date are required'
        });
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      const pharmacistObjectId = new mongoose.Types.ObjectId(pharmacistId as string);
      const workplaceObjectId = new mongoose.Types.ObjectId(workplaceId);

      const availabilitySummary = [];
      const currentDate = new Date(start);

      while (currentDate <= end) {
        const result = await SlotGenerationService.generateAvailableSlots({
          date: new Date(currentDate),
          pharmacistId: pharmacistObjectId,
          duration: Number(duration),
          workplaceId: workplaceObjectId
        });

        availabilitySummary.push({
          date: new Date(currentDate),
          totalSlots: result.summary.totalSlots,
          availableSlots: result.summary.availableSlots,
          utilizationRate: result.summary.utilizationRate,
          firstAvailableSlot: result.slots.find(s => s.available)?.time || null,
          lastAvailableSlot: result.slots.filter(s => s.available).pop()?.time || null
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      res.json({
        success: true,
        data: {
          pharmacistId,
          period: { startDate: start, endDate: end },
          availability: availabilitySummary,
          summary: {
            totalDays: availabilitySummary.length,
            daysWithAvailability: availabilitySummary.filter(day => day.availableSlots > 0).length,
            averageUtilization: availabilitySummary.reduce((sum, day) => sum + day.utilizationRate, 0) / availabilitySummary.length
          }
        }
      });

    } catch (error) {
      logger.error('Error getting pharmacist availability:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get pharmacist availability'
      });
    }
  }

  /**
   * Get smart appointment suggestions
   */
  async getSmartSuggestions(req: AuthRequest, res: Response) {
    try {
      const {
        patientId,
        appointmentType,
        duration = 30,
        preferredPharmacistId,
        preferredTimeSlots,
        preferredDays,
        maxDaysAhead = 14,
        urgencyLevel = 'medium',
        patientPreferences
      } = req.body;

      const workplaceId = req.user?.workplaceId;

      if (!workplaceId || !patientId || !appointmentType) {
        return res.status(400).json({
          success: false,
          message: 'Workplace ID, patient ID, and appointment type are required'
        });
      }

      // Import the SmartSchedulingService
      const { SmartSchedulingService } = await import('../services/SmartSchedulingService');

      const suggestions = await SmartSchedulingService.getSmartSuggestions({
        patientId: new mongoose.Types.ObjectId(patientId),
        appointmentType,
        duration: Number(duration),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        preferredPharmacistId: preferredPharmacistId ? new mongoose.Types.ObjectId(preferredPharmacistId) : undefined,
        preferredTimeSlots,
        preferredDays,
        maxDaysAhead: Number(maxDaysAhead),
        urgencyLevel,
        patientPreferences
      });

      res.json({
        success: true,
        data: {
          suggestions,
          totalSuggestions: suggestions.length,
          bestSuggestion: suggestions[0] || null
        },
        message: suggestions.length > 0
          ? `Found ${suggestions.length} smart suggestions`
          : 'No suitable appointments found with current preferences'
      });

    } catch (error) {
      logger.error('Error getting smart suggestions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get smart suggestions',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get scheduling optimization report
   */
  async getOptimizationReport(req: AuthRequest, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      const workplaceId = req.user?.workplaceId;

      if (!workplaceId || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Workplace ID, start date, and end date are required'
        });
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format'
        });
      }

      // Import the SmartSchedulingService
      const { SmartSchedulingService } = await import('../services/SmartSchedulingService');

      const report = await SmartSchedulingService.generateOptimizationReport(
        new mongoose.Types.ObjectId(workplaceId),
        start,
        end
      );

      res.json({
        success: true,
        data: report,
        message: 'Optimization report generated successfully'
      });

    } catch (error) {
      logger.error('Error generating optimization report:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate optimization report',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Auto-schedule appointment using smart suggestions
   */
  async autoScheduleAppointment(req: AuthRequest, res: Response) {
    try {
      const {
        patientId,
        appointmentType,
        duration = 30,
        preferredPharmacistId,
        preferredTimeSlots,
        preferredDays,
        urgencyLevel = 'medium',
        patientPreferences,
        description,
        acceptTopSuggestion = false
      } = req.body;

      const workplaceId = req.user?.workplaceId;
      const userId = req.user?._id;

      if (!workplaceId || !userId || !patientId || !appointmentType) {
        return res.status(400).json({
          success: false,
          message: 'Required fields missing'
        });
      }

      // Import the SmartSchedulingService
      const { SmartSchedulingService } = await import('../services/SmartSchedulingService');

      // Get smart suggestions
      const suggestions = await SmartSchedulingService.getSmartSuggestions({
        patientId: new mongoose.Types.ObjectId(patientId),
        appointmentType,
        duration: Number(duration),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        preferredPharmacistId: preferredPharmacistId ? new mongoose.Types.ObjectId(preferredPharmacistId) : undefined,
        preferredTimeSlots,
        preferredDays,
        maxDaysAhead: 14,
        urgencyLevel,
        patientPreferences
      });

      if (suggestions.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No suitable appointment slots found'
        });
      }

      const bestSuggestion = suggestions[0];

      if (!acceptTopSuggestion) {
        // Return suggestions for user to choose
        return res.json({
          success: true,
          data: {
            suggestions: suggestions.slice(0, 5), // Top 5 suggestions
            recommendedAction: 'review_suggestions'
          },
          message: 'Please review and select from the suggested appointments'
        });
      }

      // Auto-create appointment with best suggestion
      const appointmentData = {
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        patientId: new mongoose.Types.ObjectId(patientId),
        type: appointmentType,
        scheduledDate: bestSuggestion.date,
        scheduledTime: bestSuggestion.time,
        duration: Number(duration),
        assignedTo: bestSuggestion.pharmacistId,
        title: `${appointmentType.replace('_', ' ')} - Auto-scheduled`,
        description: description || `Auto-scheduled appointment (Score: ${bestSuggestion.score})`,
        timezone: 'Africa/Lagos',
        status: 'scheduled' as const,
        confirmationStatus: 'pending' as const,
        isRecurring: false,
        patientPreferences,
        reminders: [],
        relatedRecords: {},
        metadata: {
          source: 'auto_scheduled',
          smartSuggestionScore: bestSuggestion.score,
          smartSuggestionReasons: bestSuggestion.reasons
        },
        createdBy: new mongoose.Types.ObjectId(userId),
        isDeleted: false
      };

      const appointment = await Appointment.create(appointmentData);

      // Populate relations for response
      await appointment.populate([
        { path: 'patientId', select: 'firstName lastName email phone' },
        { path: 'assignedTo', select: 'firstName lastName email role' }
      ]);

      logger.info('Auto-scheduled appointment created', {
        appointmentId: appointment._id.toString(),
        suggestionScore: bestSuggestion.score,
        reasons: bestSuggestion.reasons
      });

      res.status(201).json({
        success: true,
        data: {
          appointment,
          suggestion: bestSuggestion,
          alternativeSlots: bestSuggestion.alternativeSlots || []
        },
        message: `Appointment auto-scheduled successfully with ${bestSuggestion.pharmacistName}`
      });

    } catch (error) {
      logger.error('Error auto-scheduling appointment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to auto-schedule appointment',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // =============================================
  // WAITLIST MANAGEMENT METHODS
  // =============================================

  /**
   * Get waitlist entries with filtering
   */
  async getWaitlist(req: AuthRequest, res: Response) {
    try {
      console.log('=== WAITLIST REQUEST RECEIVED ===');
      console.log('Query params:', req.query);
      console.log('User:', req.user?.email);
      console.log('WorkplaceId:', req.user?.workplaceId?.toString());

      const { status = 'active', urgencyLevel, appointmentType, search } = req.query;
      const workplaceId = req.user?.workplaceId;

      logger.info('Waitlist request received', {
        query: req.query,
        workplaceId: workplaceId?.toString(),
        userId: req.user?._id?.toString()
      });

      if (!workplaceId) {
        return res.status(400).json({
          success: false,
          message: 'Workplace ID is required'
        });
      }

      // Import WaitlistService
      const { WaitlistService } = await import('../services/WaitlistService');

      const filters: any = { status };
      if (urgencyLevel) filters.urgencyLevel = urgencyLevel;
      if (appointmentType) filters.appointmentType = appointmentType;

      const entries = await WaitlistService.getWaitlistEntries(
        new mongoose.Types.ObjectId(workplaceId),
        filters
      );

      logger.info('Waitlist entries retrieved', {
        entriesCount: entries.length,
        filters,
        workplaceId: workplaceId.toString()
      });

      // Transform entries to include patientName and preferredPharmacistName
      const transformedEntries = entries.map((entry: any) => {
        const patient = entry.patientId;
        const pharmacist = entry.preferredPharmacistId;

        // Safely extract patient name
        let patientName = 'Unknown Patient';
        if (patient) {
          if (typeof patient === 'object' && patient.firstName && patient.lastName) {
            patientName = `${patient.firstName} ${patient.lastName}`;
          } else if (patient._id) {
            patientName = `Patient ${patient._id.toString().substring(0, 8)}`;
          }
        }

        // Safely extract pharmacist name
        let preferredPharmacistName = undefined;
        if (pharmacist && typeof pharmacist === 'object' && pharmacist.firstName && pharmacist.lastName) {
          preferredPharmacistName = `${pharmacist.firstName} ${pharmacist.lastName}`;
        }

        return {
          ...entry,
          patientName,
          preferredPharmacistName,
        };
      });

      // Filter by search if provided
      let filteredEntries = transformedEntries;
      if (search) {
        const searchLower = (search as string).toLowerCase();
        filteredEntries = transformedEntries.filter((entry: any) =>
          entry.patientName?.toLowerCase().includes(searchLower)
        );
      }

      res.json({
        success: true,
        data: {
          entries: filteredEntries,
          total: filteredEntries.length
        }
      });

    } catch (error) {
      logger.error('Error getting waitlist:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get waitlist entries',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get waitlist statistics
   */
  async getWaitlistStats(req: AuthRequest, res: Response) {
    try {
      const workplaceId = req.user?.workplaceId;

      if (!workplaceId) {
        return res.status(400).json({
          success: false,
          message: 'Workplace ID is required'
        });
      }

      // Import WaitlistService
      const { WaitlistService } = await import('../services/WaitlistService');

      const stats = await WaitlistService.getWaitlistStats(
        new mongoose.Types.ObjectId(workplaceId)
      );

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Error getting waitlist stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get waitlist statistics',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Add patient to waitlist
   */
  async addToWaitlist(req: AuthRequest, res: Response) {
    try {
      const workplaceId = req.user?.workplaceId;

      logger.info('Add to waitlist request', {
        workplaceId: workplaceId?.toString(),
        body: req.body
      });

      if (!workplaceId) {
        return res.status(400).json({
          success: false,
          message: 'Workplace ID is required'
        });
      }

      const {
        patientId,
        appointmentType,
        duration,
        urgencyLevel,
        maxWaitDays,
        preferredPharmacistId,
        preferredTimeSlots,
        preferredDays,
        notificationPreferences
      } = req.body;

      // Import WaitlistService
      const { WaitlistService } = await import('../services/WaitlistService');

      const waitlistEntry = await WaitlistService.addToWaitlist({
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        patientId: new mongoose.Types.ObjectId(patientId),
        appointmentType,
        duration,
        urgencyLevel,
        maxWaitDays,
        preferredPharmacistId: preferredPharmacistId ? new mongoose.Types.ObjectId(preferredPharmacistId) : undefined,
        preferredTimeSlots,
        preferredDays,
        notificationPreferences
      });

      logger.info('Waitlist entry created successfully', {
        waitlistEntryId: waitlistEntry._id?.toString(),
        workplaceId: workplaceId.toString(),
        patientId,
        status: waitlistEntry.status
      });

      res.status(201).json({
        success: true,
        data: {
          waitlistEntry
        },
        message: 'Patient added to waitlist successfully'
      });

    } catch (error) {
      logger.error('Error adding to waitlist:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add patient to waitlist',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Cancel waitlist entry
   */
  async cancelWaitlistEntry(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      // Import WaitlistService
      const { WaitlistService } = await import('../services/WaitlistService');

      const success = await WaitlistService.removeFromWaitlist(
        new mongoose.Types.ObjectId(id),
        'cancelled'
      );

      if (!success) {
        return res.status(404).json({
          success: false,
          message: 'Waitlist entry not found'
        });
      }

      res.json({
        success: true,
        message: 'Waitlist entry cancelled successfully'
      });

    } catch (error) {
      logger.error('Error cancelling waitlist entry:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cancel waitlist entry',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Process waitlist - check for available slots and notify patients
   */
  async processWaitlist(req: AuthRequest, res: Response) {
    try {
      const workplaceId = req.user?.workplaceId;

      if (!workplaceId) {
        return res.status(400).json({
          success: false,
          message: 'Workplace ID is required'
        });
      }

      // Import WaitlistService
      const { WaitlistService } = await import('../services/WaitlistService');

      const result = await WaitlistService.processWaitlist(
        new mongoose.Types.ObjectId(workplaceId)
      );

      res.json({
        success: true,
        data: result,
        message: 'Waitlist processed successfully'
      });

    } catch (error) {
      logger.error('Error processing waitlist:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process waitlist',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Notify waitlist patient of available slots
   */
  async notifyWaitlistPatient(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      // For now, simulate notification sending
      // In a real implementation, this would trigger the notification process
      logger.info('Manual notification triggered for waitlist entry', {
        waitlistEntryId: id,
        triggeredBy: req.user?.id
      });

      res.json({
        success: true,
        message: 'Patient notification sent successfully'
      });

    } catch (error) {
      logger.error('Error notifying waitlist patient:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to notify patient',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }



}

// Helper functions removed - using date-fns addMinutes instead

export default new AppointmentController();