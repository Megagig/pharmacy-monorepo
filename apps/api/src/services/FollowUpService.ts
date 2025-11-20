/**
 * Follow-Up Service
 * Handles follow-up task creation, management, and automation
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

import mongoose from 'mongoose';
import FollowUpTask, { IFollowUpTask } from '../models/FollowUpTask';
import Appointment, { IAppointment } from '../models/Appointment';
import Patient from '../models/Patient';
import User from '../models/User';
import {
  createNotFoundError,
  createValidationError,
  createBusinessRuleError,
} from '../utils/responseHelpers';
import logger, { patientEngagementLogger } from '../utils/logger';
import { MonitorOperation, trackServiceOperation } from '../middlewares/patientEngagementMonitoringMiddleware';
import app from '../app';

export interface CreateFollowUpTaskData {
  patientId: mongoose.Types.ObjectId;
  type: IFollowUpTask['type'];
  title: string;
  description: string;
  objectives: string[];
  priority: IFollowUpTask['priority'];
  dueDate: Date;
  assignedTo?: mongoose.Types.ObjectId;
  estimatedDuration?: number;
  trigger: IFollowUpTask['trigger'];
  relatedRecords?: IFollowUpTask['relatedRecords'];
  locationId?: string;
}

export interface CreateAutomatedFollowUpData {
  patientId: mongoose.Types.ObjectId;
  triggerType: IFollowUpTask['trigger']['type'];
  sourceId?: mongoose.Types.ObjectId;
  sourceType?: string;
  triggerDetails?: Record<string, any>;
  assignedTo?: mongoose.Types.ObjectId;
  locationId?: string;
}

export interface GetFollowUpTasksFilters {
  status?: string | string[];
  priority?: string | string[];
  type?: string | string[];
  patientId?: mongoose.Types.ObjectId;
  assignedTo?: mongoose.Types.ObjectId;
  locationId?: string;
  startDate?: Date;
  endDate?: Date;
  overdue?: boolean;
  dueSoon?: number; // days
}

export interface GetFollowUpTasksOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  populate?: boolean;
}

export interface CompleteFollowUpTaskData {
  outcome: IFollowUpTask['outcome'];
}

export interface ConvertToAppointmentData {
  scheduledDate: Date;
  scheduledTime: string;
  duration: number;
  type: IAppointment['type'];
  description?: string;
}

export interface EscalateFollowUpData {
  newPriority: IFollowUpTask['priority'];
  reason: string;
}

export class FollowUpService {
  /**
   * Create a follow-up task with validation
   * Requirement: 3.1, 3.2
   */
  @MonitorOperation('create', 'followup')
  static async createFollowUpTask(
    data: CreateFollowUpTaskData,
    workplaceId: mongoose.Types.ObjectId,
    createdBy: mongoose.Types.ObjectId
  ): Promise<IFollowUpTask> {
    try {
      // Validate patient exists
      const patient = await Patient.findById(data.patientId);
      if (!patient) {
        throw createNotFoundError('Patient', data.patientId.toString());
      }

      // Determine assigned pharmacist (default to creator if not specified)
      const assignedTo = data.assignedTo || createdBy;

      // Validate pharmacist exists
      const pharmacist = await User.findById(assignedTo);
      if (!pharmacist) {
        throw createNotFoundError('Pharmacist', assignedTo.toString());
      }

      // Validate due date is not in the past
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(data.dueDate);
      dueDate.setHours(0, 0, 0, 0);

      if (dueDate < today) {
        throw createValidationError('Cannot create follow-up tasks with past due dates');
      }

      // Validate objectives
      if (!data.objectives || data.objectives.length === 0) {
        throw createValidationError('At least one objective is required');
      }

      if (data.objectives.length > 10) {
        throw createValidationError('Cannot have more than 10 objectives');
      }

      // Validate title and description length
      if (data.title.length < 3 || data.title.length > 200) {
        throw createValidationError('Title must be between 3 and 200 characters');
      }

      if (data.description.length < 10 || data.description.length > 2000) {
        throw createValidationError('Description must be between 10 and 2000 characters');
      }

      // Validate estimated duration if provided
      if (data.estimatedDuration !== undefined) {
        if (data.estimatedDuration < 5 || data.estimatedDuration > 480) {
          throw createValidationError('Estimated duration must be between 5 and 480 minutes');
        }
      }

      // Create follow-up task
      const followUpTask = new FollowUpTask({
        workplaceId,
        locationId: data.locationId,
        patientId: data.patientId,
        assignedTo,
        type: data.type,
        title: data.title.trim(),
        description: data.description.trim(),
        objectives: data.objectives.map((obj) => obj.trim()).filter((obj) => obj.length > 0),
        priority: data.priority,
        dueDate: data.dueDate,
        estimatedDuration: data.estimatedDuration,
        status: 'pending',
        trigger: {
          type: data.trigger.type,
          sourceId: data.trigger.sourceId,
          sourceType: data.trigger.sourceType,
          triggerDate: data.trigger.triggerDate || new Date(),
          triggerDetails: data.trigger.triggerDetails,
        },
        relatedRecords: data.relatedRecords || {},
        escalationHistory: [],
        remindersSent: [],
        createdBy,
      });

      await followUpTask.save();

      logger.info('Follow-up task created successfully', {
        taskId: followUpTask._id.toString(),
        patientId: data.patientId.toString(),
        assignedTo: assignedTo.toString(),
        type: data.type,
        priority: data.priority,
        dueDate: data.dueDate,
      });

      // Emit real-time event
      try {
        const appointmentSocket = app.get('appointmentSocket');
        if (appointmentSocket) {
          appointmentSocket.emitFollowUpCreated(followUpTask, {
            userId: createdBy.toString(),
            name: pharmacist.firstName + ' ' + pharmacist.lastName,
            role: pharmacist.role,
          });
        }
      } catch (socketError) {
        logger.error('Failed to emit follow-up created event:', socketError);
        // Don't fail the operation if socket emission fails
      }

      return followUpTask;
    } catch (error) {
      logger.error('Error creating follow-up task', {
        error: error instanceof Error ? error.message : 'Unknown error',
        data,
      });
      throw error;
    }
  }

  /**
   * Create automated follow-up based on trigger type
   * Requirement: 3.1, 3.2
   */
  static async createAutomatedFollowUp(
    data: CreateAutomatedFollowUpData,
    workplaceId: mongoose.Types.ObjectId,
    createdBy: mongoose.Types.ObjectId
  ): Promise<IFollowUpTask> {
    try {
      // Validate patient exists
      const patient = await Patient.findById(data.patientId);
      if (!patient) {
        throw createNotFoundError('Patient', data.patientId.toString());
      }

      // Generate task details based on trigger type
      const taskDetails = this.generateTaskDetailsFromTrigger(
        data.triggerType,
        patient.name,
        data.triggerDetails
      );

      // Create follow-up task
      const followUpTaskData: CreateFollowUpTaskData = {
        patientId: data.patientId,
        type: taskDetails.type,
        title: taskDetails.title,
        description: taskDetails.description,
        objectives: taskDetails.objectives,
        priority: taskDetails.priority,
        dueDate: taskDetails.dueDate,
        assignedTo: data.assignedTo,
        estimatedDuration: taskDetails.estimatedDuration,
        trigger: {
          type: data.triggerType,
          sourceId: data.sourceId,
          sourceType: data.sourceType,
          triggerDate: new Date(),
          triggerDetails: data.triggerDetails,
        },
        relatedRecords: this.buildRelatedRecords(data.triggerType, data.sourceId),
        locationId: data.locationId,
      };

      const followUpTask = await this.createFollowUpTask(
        followUpTaskData,
        workplaceId,
        createdBy
      );

      logger.info('Automated follow-up task created', {
        taskId: followUpTask._id.toString(),
        triggerType: data.triggerType,
        patientId: data.patientId.toString(),
      });

      return followUpTask;
    } catch (error) {
      logger.error('Error creating automated follow-up', {
        error: error instanceof Error ? error.message : 'Unknown error',
        data,
      });
      throw error;
    }
  }

  /**
   * Get single follow-up task by ID
   * Requirement: 3.3
   */
  static async getFollowUpTaskById(
    taskId: string,
    workplaceId: mongoose.Types.ObjectId
  ): Promise<IFollowUpTask | null> {
    try {
      const task = await FollowUpTask.findOne({
        _id: new mongoose.Types.ObjectId(taskId),
        workplaceId,
      }).populate('patientId assignedTo');

      return task;
    } catch (error) {
      logger.error('Error fetching follow-up task by ID', {
        taskId,
        workplaceId: workplaceId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Update follow-up task
   * Requirement: 3.3
   */
  static async updateFollowUpTask(
    taskId: string,
    workplaceId: mongoose.Types.ObjectId,
    updateData: Partial<CreateFollowUpTaskData>,
    updatedBy: mongoose.Types.ObjectId
  ): Promise<IFollowUpTask | null> {
    try {
      const task = await FollowUpTask.findOneAndUpdate(
        {
          _id: new mongoose.Types.ObjectId(taskId),
          workplaceId,
        },
        {
          ...updateData,
          updatedBy,
        },
        { new: true }
      );

      if (task) {
        logger.info('Follow-up task updated', {
          taskId,
          updatedBy: updatedBy.toString(),
        });

        // Emit real-time event
        try {
          const appointmentSocket = app.get('appointmentSocket');
          if (appointmentSocket) {
            const user = await User.findById(updatedBy);
            if (user) {
              appointmentSocket.emitFollowUpUpdated(task, {
                userId: updatedBy.toString(),
                name: user.firstName + ' ' + user.lastName,
                role: user.role,
              });
            }
          }
        } catch (socketError) {
          logger.error('Failed to emit follow-up updated event:', socketError);
        }
      }

      return task;
    } catch (error) {
      logger.error('Error updating follow-up task', {
        taskId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get follow-up tasks with filtering and pagination
   * Requirement: 3.3
   */
  static async getFollowUpTasks(
    filters: GetFollowUpTasksFilters,
    options: GetFollowUpTasksOptions,
    workplaceId: mongoose.Types.ObjectId
  ): Promise<{
    tasks: IFollowUpTask[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      pages: number;
    };
    summary?: {
      total: number;
      overdue: number;
      dueToday: number;
      byPriority: Record<string, number>;
      byStatus: Record<string, number>;
    };
  }> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 50;
      const skip = (page - 1) * limit;
      const sortBy = options.sortBy || 'dueDate';
      const sortOrder = options.sortOrder === 'desc' ? -1 : 1;

      // Build query
      const query: any = { workplaceId };

      if (filters.status) {
        query.status = Array.isArray(filters.status)
          ? { $in: filters.status }
          : filters.status;
      }

      if (filters.priority) {
        query.priority = Array.isArray(filters.priority)
          ? { $in: filters.priority }
          : filters.priority;
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
        query.dueDate = {};
        if (filters.startDate) {
          query.dueDate.$gte = filters.startDate;
        }
        if (filters.endDate) {
          query.dueDate.$lte = filters.endDate;
        }
      }

      if (filters.overdue) {
        query.dueDate = { $lt: new Date() };
        query.status = { $in: ['pending', 'in_progress', 'overdue'] };
      }

      if (filters.dueSoon !== undefined) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + filters.dueSoon);
        futureDate.setHours(23, 59, 59, 999);

        query.dueDate = { $gte: today, $lte: futureDate };
        query.status = { $in: ['pending', 'in_progress'] };
      }

      // Execute query
      let tasksQuery = FollowUpTask.find(query)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit);

      if (options.populate) {
        tasksQuery = tasksQuery
          .populate('patientId', 'name email phone')
          .populate('assignedTo', 'name email role');
      }

      const [tasks, total] = await Promise.all([
        tasksQuery.exec(),
        FollowUpTask.countDocuments(query),
      ]);

      // Calculate summary statistics
      const summary = await this.calculateTaskSummary(workplaceId, filters);

      return {
        tasks,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
        summary,
      };
    } catch (error) {
      logger.error('Error getting follow-up tasks', {
        error: error instanceof Error ? error.message : 'Unknown error',
        filters,
      });
      throw error;
    }
  }

  /**
   * Complete a follow-up task with outcome recording
   * Requirement: 3.4
   */
  static async completeFollowUpTask(
    taskId: mongoose.Types.ObjectId,
    data: CompleteFollowUpTaskData,
    completedBy: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId
  ): Promise<IFollowUpTask> {
    try {
      const task = await FollowUpTask.findOne({
        _id: taskId,
        workplaceId,
      });

      if (!task) {
        throw createNotFoundError('Follow-up task', taskId.toString());
      }

      // Validate task can be completed
      if (['completed', 'cancelled', 'converted_to_appointment'].includes(task.status)) {
        throw createBusinessRuleError(
          `Cannot complete task with status: ${task.status}`
        );
      }

      // Validate outcome data
      if (!data.outcome) {
        throw createValidationError('Outcome is required when completing a task');
      }

      if (!data.outcome.status) {
        throw createValidationError('Outcome status is required');
      }

      if (!data.outcome.notes || data.outcome.notes.trim().length === 0) {
        throw createValidationError('Outcome notes are required');
      }

      if (data.outcome.notes.length > 2000) {
        throw createValidationError('Outcome notes cannot exceed 2000 characters');
      }

      // Complete the task using instance method
      task.complete(data.outcome, completedBy);
      task.updatedBy = completedBy;

      await task.save();

      logger.info('Follow-up task completed', {
        taskId: taskId.toString(),
        outcomeStatus: data.outcome.status,
        completedBy: completedBy.toString(),
      });

      // Emit real-time event
      try {
        const appointmentSocket = app.get('appointmentSocket');
        if (appointmentSocket) {
          const user = await User.findById(completedBy);
          if (user) {
            appointmentSocket.emitFollowUpCompleted(task, {
              userId: completedBy.toString(),
              name: user.firstName + ' ' + user.lastName,
              role: user.role,
            });
          }
        }
      } catch (socketError) {
        logger.error('Failed to emit follow-up completed event:', socketError);
      }

      return task;
    } catch (error) {
      logger.error('Error completing follow-up task', {
        error: error instanceof Error ? error.message : 'Unknown error',
        taskId: taskId.toString(),
        data,
      });
      throw error;
    }
  }

  /**
   * Convert follow-up task to appointment with linking
   * Requirement: 3.5
   */
  static async convertToAppointment(
    taskId: mongoose.Types.ObjectId,
    data: ConvertToAppointmentData,
    convertedBy: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId
  ): Promise<{ task: IFollowUpTask; appointment: IAppointment }> {
    try {
      const task = await FollowUpTask.findOne({
        _id: taskId,
        workplaceId,
      });

      if (!task) {
        throw createNotFoundError('Follow-up task', taskId.toString());
      }

      // Validate task can be converted
      if (['completed', 'cancelled', 'converted_to_appointment'].includes(task.status)) {
        throw createBusinessRuleError(
          `Cannot convert task with status: ${task.status}`
        );
      }

      // Validate appointment data
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const scheduledDate = new Date(data.scheduledDate);
      scheduledDate.setHours(0, 0, 0, 0);

      if (scheduledDate < today) {
        throw createValidationError('Cannot schedule appointments in the past');
      }

      if (data.duration < 5 || data.duration > 120) {
        throw createValidationError('Duration must be between 5 and 120 minutes');
      }

      // Import AppointmentService dynamically to avoid circular dependency
      const { AppointmentService } = await import('./AppointmentService');

      // Create appointment
      const appointment = await AppointmentService.createAppointment(
        {
          patientId: task.patientId,
          type: data.type,
          scheduledDate: data.scheduledDate,
          scheduledTime: data.scheduledTime,
          duration: data.duration,
          assignedTo: task.assignedTo,
          title: task.title,
          description: data.description || task.description,
          locationId: task.locationId,
          metadata: {
            source: 'automated_trigger',
            triggerEvent: 'follow_up_conversion',
            customFields: {
              followUpTaskId: taskId.toString(),
              followUpType: task.type,
            },
          },
        },
        workplaceId,
        convertedBy
      );

      // Update task status and link to appointment
      task.convertToAppointment(appointment._id);
      task.updatedBy = convertedBy;
      await task.save();

      // Update appointment to link back to follow-up task
      appointment.relatedRecords.followUpTaskId = taskId;
      await appointment.save();

      logger.info('Follow-up task converted to appointment', {
        taskId: taskId.toString(),
        appointmentId: appointment._id.toString(),
        convertedBy: convertedBy.toString(),
      });

      // Emit real-time event
      try {
        const appointmentSocket = app.get('appointmentSocket');
        if (appointmentSocket) {
          const user = await User.findById(convertedBy);
          if (user) {
            appointmentSocket.emitFollowUpConvertedToAppointment(task, appointment, {
              userId: convertedBy.toString(),
              name: user.firstName + ' ' + user.lastName,
              role: user.role,
            });
          }
        }
      } catch (socketError) {
        logger.error('Failed to emit follow-up converted to appointment event:', socketError);
      }

      return { task, appointment };
    } catch (error) {
      logger.error('Error converting follow-up task to appointment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        taskId: taskId.toString(),
        data,
      });
      throw error;
    }
  }

  /**
   * Escalate follow-up priority with history tracking
   * Requirement: 3.6
   */
  static async escalateFollowUp(
    taskId: mongoose.Types.ObjectId,
    data: EscalateFollowUpData,
    escalatedBy: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId
  ): Promise<IFollowUpTask> {
    try {
      const task = await FollowUpTask.findOne({
        _id: taskId,
        workplaceId,
      });

      if (!task) {
        throw createNotFoundError('Follow-up task', taskId.toString());
      }

      // Validate task can be escalated
      if (['completed', 'cancelled'].includes(task.status)) {
        throw createBusinessRuleError(
          `Cannot escalate task with status: ${task.status}`
        );
      }

      // Validate new priority is higher than current
      const priorityLevels = {
        low: 1,
        medium: 2,
        high: 3,
        urgent: 4,
        critical: 5,
      };

      const currentLevel = priorityLevels[task.priority];
      const newLevel = priorityLevels[data.newPriority];

      if (newLevel <= currentLevel) {
        throw createBusinessRuleError(
          `New priority (${data.newPriority}) must be higher than current priority (${task.priority})`
        );
      }

      // Validate reason
      if (!data.reason || data.reason.trim().length === 0) {
        throw createValidationError('Escalation reason is required');
      }

      if (data.reason.length > 500) {
        throw createValidationError('Escalation reason cannot exceed 500 characters');
      }

      // Store old priority for logging
      const oldPriority = task.priority;

      // Escalate using instance method
      task.escalate(data.newPriority, data.reason.trim(), escalatedBy);
      task.updatedBy = escalatedBy;

      await task.save();

      logger.info('Follow-up task escalated', {
        taskId: taskId.toString(),
        fromPriority: oldPriority,
        toPriority: data.newPriority,
        escalatedBy: escalatedBy.toString(),
        reason: data.reason,
      });

      // Emit real-time event
      try {
        const appointmentSocket = app.get('appointmentSocket');
        if (appointmentSocket) {
          const user = await User.findById(escalatedBy);
          if (user) {
            appointmentSocket.emitFollowUpEscalated(task, {
              userId: escalatedBy.toString(),
              name: user.firstName + ' ' + user.lastName,
              role: user.role,
            }, oldPriority, data.reason);
          }
        }
      } catch (socketError) {
        logger.error('Failed to emit follow-up escalated event:', socketError);
      }

      return task;
    } catch (error) {
      logger.error('Error escalating follow-up task', {
        error: error instanceof Error ? error.message : 'Unknown error',
        taskId: taskId.toString(),
        data,
      });
      throw error;
    }
  }

  /**
   * Helper: Generate task details from trigger type
   * Requirement: 3.1, 3.2
   */
  private static generateTaskDetailsFromTrigger(
    triggerType: IFollowUpTask['trigger']['type'],
    patientName: string,
    triggerDetails?: Record<string, any>
  ): {
    type: IFollowUpTask['type'];
    title: string;
    description: string;
    objectives: string[];
    priority: IFollowUpTask['priority'];
    dueDate: Date;
    estimatedDuration: number;
  } {
    const now = new Date();
    let dueDate = new Date();
    let type: IFollowUpTask['type'] = 'general_followup';
    let title = '';
    let description = '';
    let objectives: string[] = [];
    let priority: IFollowUpTask['priority'] = 'medium';
    let estimatedDuration = 30;

    switch (triggerType) {
      case 'medication_start':
        // High-risk medication follow-up (Requirement 3.1)
        type = 'medication_start_followup';
        dueDate.setDate(now.getDate() + 7);
        priority = 'high';
        title = `High-Risk Medication Follow-up - ${patientName}`;
        description = `Follow-up required for patient ${patientName} who started a high-risk medication. Monitor for adverse effects, adherence, and therapeutic response.`;
        objectives = [
          'Assess patient for adverse drug reactions',
          'Verify medication adherence',
          'Check therapeutic effectiveness',
          'Review proper medication administration technique',
          'Address any patient concerns or questions',
        ];
        estimatedDuration = 30;
        break;

      case 'lab_result':
        // Abnormal lab results follow-up (Requirement 3.2)
        type = 'lab_result_review';
        dueDate.setDate(now.getDate() + 3);
        priority = 'high';
        title = `Abnormal Lab Results Review - ${patientName}`;
        description = `Patient ${patientName} has abnormal lab results that require pharmacist review and potential intervention.`;
        objectives = [
          'Review abnormal lab values',
          'Assess medication-related causes',
          'Recommend medication adjustments if needed',
          'Coordinate with prescriber if necessary',
          'Schedule follow-up lab work',
        ];
        estimatedDuration = 20;
        break;

      case 'hospital_discharge':
        // Hospital discharge follow-up (Requirement 3.3)
        type = 'hospital_discharge_followup';
        dueDate.setDate(now.getDate() + 2);
        priority = 'urgent';
        title = `Post-Discharge Follow-up - ${patientName}`;
        description = `Patient ${patientName} was recently discharged from hospital. Medication reconciliation and discharge counseling required.`;
        objectives = [
          'Perform medication reconciliation',
          'Review discharge medications and instructions',
          'Identify and resolve medication discrepancies',
          'Ensure patient understands new medication regimen',
          'Assess for post-discharge complications',
        ];
        estimatedDuration = 45;
        break;

      case 'medication_change':
        // Medication regimen change follow-up (Requirement 3.4)
        type = 'medication_change_followup';
        dueDate.setDate(now.getDate() + 14);
        priority = 'medium';
        title = `Medication Change Follow-up - ${patientName}`;
        description = `Patient ${patientName} had changes to their medication regimen. Follow-up to assess response and adherence.`;
        objectives = [
          'Assess response to medication changes',
          'Monitor for new adverse effects',
          'Verify patient understanding of changes',
          'Check adherence to new regimen',
          'Address any barriers to adherence',
        ];
        estimatedDuration = 25;
        break;

      case 'scheduled_monitoring':
        // Chronic disease monitoring (Requirements 3.5, 3.6)
        type = 'chronic_disease_monitoring';
        const isStable = triggerDetails?.isStable !== false;
        dueDate.setDate(now.getDate() + (isStable ? 90 : 30));
        priority = isStable ? 'medium' : 'high';
        title = `Chronic Disease Monitoring - ${patientName}`;
        description = `Scheduled monitoring for patient ${patientName} with chronic condition. Assess disease control and medication effectiveness.`;
        objectives = [
          'Assess disease control and symptoms',
          'Review medication adherence',
          'Monitor for complications',
          'Review lab values and vital signs',
          'Adjust treatment plan if needed',
        ];
        estimatedDuration = 30;
        break;

      case 'missed_appointment':
        // Missed appointment follow-up
        type = 'general_followup';
        dueDate.setDate(now.getDate() + 1);
        priority = 'high';
        title = `Missed Appointment Follow-up - ${patientName}`;
        description = `Patient ${patientName} missed their scheduled appointment. Reach out to reschedule and assess any barriers.`;
        objectives = [
          'Contact patient to reschedule',
          'Identify reasons for missed appointment',
          'Address any barriers to care',
          'Ensure patient has necessary medications',
          'Provide support and resources as needed',
        ];
        estimatedDuration = 15;
        break;

      case 'system_rule':
        // System-generated follow-up based on rules
        type = triggerDetails?.followUpType || 'general_followup';
        dueDate = triggerDetails?.dueDate ? new Date(triggerDetails.dueDate) : new Date(now.getDate() + 7);
        priority = triggerDetails?.priority || 'medium';
        title = triggerDetails?.title || `Follow-up Required - ${patientName}`;
        description = triggerDetails?.description || `System-generated follow-up for patient ${patientName}.`;
        objectives = triggerDetails?.objectives || ['Complete follow-up assessment'];
        estimatedDuration = triggerDetails?.estimatedDuration || 30;
        break;

      case 'manual':
      default:
        // Manual follow-up creation
        type = 'general_followup';
        dueDate.setDate(now.getDate() + 7);
        priority = 'medium';
        title = `Follow-up - ${patientName}`;
        description = `General follow-up for patient ${patientName}.`;
        objectives = ['Complete follow-up assessment'];
        estimatedDuration = 30;
        break;
    }

    return {
      type,
      title,
      description,
      objectives,
      priority,
      dueDate,
      estimatedDuration,
    };
  }

  /**
   * Helper: Build related records based on trigger type
   */
  private static buildRelatedRecords(
    triggerType: IFollowUpTask['trigger']['type'],
    sourceId?: mongoose.Types.ObjectId
  ): IFollowUpTask['relatedRecords'] {
    const relatedRecords: IFollowUpTask['relatedRecords'] = {};

    if (!sourceId) return relatedRecords;

    switch (triggerType) {
      case 'medication_start':
      case 'medication_change':
        relatedRecords.medicationId = sourceId;
        break;
      case 'lab_result':
        relatedRecords.labResultId = sourceId;
        break;
      case 'system_rule':
        relatedRecords.clinicalInterventionId = sourceId;
        break;
      default:
        break;
    }

    return relatedRecords;
  }

  /**
   * Helper: Calculate task summary statistics
   */
  private static async calculateTaskSummary(
    workplaceId: mongoose.Types.ObjectId,
    filters: GetFollowUpTasksFilters
  ): Promise<{
    total: number;
    overdue: number;
    dueToday: number;
    byPriority: Record<string, number>;
    byStatus: Record<string, number>;
  }> {
    const baseQuery: any = { workplaceId };

    // Apply filters to base query
    if (filters.assignedTo) {
      baseQuery.assignedTo = filters.assignedTo;
    }
    if (filters.patientId) {
      baseQuery.patientId = filters.patientId;
    }
    if (filters.locationId) {
      baseQuery.locationId = filters.locationId;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [total, overdue, dueToday, byPriority, byStatus] = await Promise.all([
      FollowUpTask.countDocuments(baseQuery),
      FollowUpTask.countDocuments({
        ...baseQuery,
        dueDate: { $lt: today },
        status: { $in: ['pending', 'in_progress', 'overdue'] },
      }),
      FollowUpTask.countDocuments({
        ...baseQuery,
        dueDate: { $gte: today, $lt: tomorrow },
        status: { $in: ['pending', 'in_progress'] },
      }),
      FollowUpTask.aggregate([
        { $match: baseQuery },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
      ]),
      FollowUpTask.aggregate([
        { $match: baseQuery },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const priorityMap: Record<string, number> = {};
    byPriority.forEach((item: any) => {
      priorityMap[item._id] = item.count;
    });

    const statusMap: Record<string, number> = {};
    byStatus.forEach((item: any) => {
      statusMap[item._id] = item.count;
    });

    return {
      total,
      overdue,
      dueToday,
      byPriority: priorityMap,
      byStatus: statusMap,
    };
  }
}

// Export as default for backward compatibility
export default FollowUpService;
