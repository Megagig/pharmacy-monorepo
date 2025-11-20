/**
 * Complete Follow-up Controller Implementation  
 * Copy the contents below into followUpController.ts replacing all existing TODO implementations
 */

import { Response } from 'express';
import { AuthRequest } from '../types/auth';
import logger from '../utils/logger';
import FollowUpTask, { IFollowUpTask } from '../models/FollowUpTask';
import Appointment from '../models/Appointment';
import { startOfDay, endOfDay, isPast } from 'date-fns';

class FollowUpController {
  /**
   * Get follow-up tasks with filtering
   */
  async getFollowUpTasks(req: AuthRequest, res: Response) {
    try {
      const {
        status,
        priority,
        assignedTo,
        patientId,
        type,
        dueDate,
        overdue,
        limit = 50,
        page = 1
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
      if (priority) {
        query.priority = Array.isArray(priority) ? { $in: priority } : priority;
      }
      if (assignedTo) query.assignedTo = assignedTo;
      if (patientId) query.patientId = patientId;
      if (type) query.type = type;
      if (dueDate) {
        const date = new Date(dueDate as string);
        query.dueDate = {
          $gte: startOfDay(date),
          $lte: endOfDay(date)
        };
      }

      // Handle overdue filter
      if (overdue === 'true') {
        query.dueDate = { $lt: new Date() };
        query.status = { $nin: ['completed', 'cancelled'] };
      }

      // Pagination
      const skip = (Number(page) - 1) * Number(limit);

      // Execute query
      const [tasks, total] = await Promise.all([
        FollowUpTask.find(query)
          .populate('patientId', 'name email phone dateOfBirth')
          .populate('assignedTo', 'name email role')
          .sort({ priority: -1, dueDate: 1 })
          .limit(Number(limit))
          .skip(skip)
          .lean(),
        FollowUpTask.countDocuments(query)
      ]);

      // Calculate summary statistics
      const allTasks = await FollowUpTask.find({ workplaceId, isDeleted: false }).lean();
      
      const summary = {
        total: allTasks.length,
        overdue: allTasks.filter(t => isPast(new Date(t.dueDate)) && !['completed', 'cancelled'].includes(t.status)).length,
        dueToday: allTasks.filter(t => {
          const today = new Date();
          const taskDate = new Date(t.dueDate);
          return taskDate.toDateString() === today.toDateString() && !['completed', 'cancelled'].includes(t.status);
        }).length,
        byPriority: allTasks.reduce((acc: any, task) => {
          acc[task.priority] = (acc[task.priority] || 0) + 1;
          return acc;
        }, {}),
        byStatus: allTasks.reduce((acc: any, task) => {
          acc[task.status] = (acc[task.status] || 0) + 1;
          return acc;
        }, {})
      };

      res.json({
        success: true,
        data: {
          tasks,
          summary,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit))
          }
        }
      });
    } catch (error) {
      logger.error('Error getting follow-up tasks:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get follow-up tasks'
      });
    }
  }

  /**
   * Create new follow-up task
   */
  async createFollowUpTask(req: AuthRequest, res: Response) {
    try {
      const workplaceId = req.user?.workplaceId;
      const userId = req.user?._id;

      if (!workplaceId || !userId) {
        return res.status(400).json({
          success: false,
          message: 'Workplace ID and user ID are required'
        });
      }

      const taskData = {
        ...req.body,
        workplaceId,
        createdBy: userId,
        status: 'pending',
        escalationHistory: [],
        remindersSent: [],
        relatedRecords: req.body.relatedRecords || {},
        trigger: {
          ...req.body.trigger,
          triggerDate: req.body.trigger?.triggerDate || new Date()
        }
      };

      const task = await FollowUpTask.create(taskData);
      
      // Populate relations
      await task.populate([
        { path: 'patientId', select: 'name email phone' },
        { path: 'assignedTo', select: 'name email role' }
      ]);

      logger.info(`Follow-up task created: ${task._id}`, {
        taskId: task._id,
        patientId: task.patientId,
        workplaceId
      });

      res.status(201).json({
        success: true,
        message: 'Follow-up task created successfully',
        data: { task }
      });
    } catch (error: any) {
      logger.error('Error creating follow-up task:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create follow-up task'
      });
    }
  }

  /**
   * Get single follow-up task
   */
  async getFollowUpTask(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const workplaceId = req.user?.workplaceId;

      const task = await FollowUpTask.findOne({
        _id: id,
        workplaceId,
        isDeleted: false
      })
        .populate('patientId', 'name email phone dateOfBirth medicalHistory')
        .populate('assignedTo', 'name email role phone')
        .populate('createdBy', 'name email')
        .populate('completedBy', 'name email')
        .lean();

      if (!task) {
        return res.status(404).json({
          success: false,
          message: 'Follow-up task not found'
        });
      }

      res.json({
        success: true,
        data: { task }
      });
    } catch (error) {
      logger.error('Error getting follow-up task:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get follow-up task'
      });
    }
  }

  /**
   * Update follow-up task
   */
  async updateFollowUpTask(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const workplaceId = req.user?.workplaceId;
      const userId = req.user?._id;

      const task = await FollowUpTask.findOne({
        _id: id,
        workplaceId,
        isDeleted: false
      });

      if (!task) {
        return res.status(404).json({
          success: false,
          message: 'Follow-up task not found'
        });
      }

      // Update task
      Object.assign(task, {
        ...req.body,
        updatedBy: userId,
        updatedAt: new Date()
      });

      await task.save();

      await task.populate([
        { path: 'patientId', select: 'name email phone' },
        { path: 'assignedTo', select: 'name email role' }
      ]);

      res.json({
        success: true,
        message: 'Follow-up task updated successfully',
        data: { task }
      });
    } catch (error: any) {
      logger.error('Error updating follow-up task:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update follow-up task'
      });
    }
  }

  /**
   * Complete follow-up task
   */
  async completeFollowUpTask(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { outcome } = req.body;
      const workplaceId = req.user?.workplaceId;
      const userId = req.user?._id;

      const task = await FollowUpTask.findOne({
        _id: id,
        workplaceId,
        isDeleted: false
      });

      if (!task) {
        return res.status(404).json({
          success: false,
          message: 'Follow-up task not found'
        });
      }

      task.status = 'completed';
      task.completedAt = new Date();
      task.completedBy = userId;
      task.outcome = outcome;

      await task.save();

      logger.info(`Follow-up task completed: ${task._id}`, {
        taskId: task._id,
        outcome: outcome.status
      });

      res.json({
        success: true,
        message: 'Follow-up task completed successfully',
        data: { task }
      });
    } catch (error) {
      logger.error('Error completing follow-up task:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to complete follow-up task'
      });
    }
  }

  /**
   * Convert follow-up task to appointment
   */
  async convertToAppointment(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { scheduledDate, scheduledTime, duration = 30, type, assignedTo } = req.body;
      const workplaceId = req.user?.workplaceId;
      const userId = req.user?._id;

      const task = await FollowUpTask.findOne({
        _id: id,
        workplaceId,
        isDeleted: false
      });

      if (!task) {
        return res.status(404).json({
          success: false,
          message: 'Follow-up task not found'
        });
      }

      // Create appointment from follow-up task
      const appointment = await Appointment.create({
        workplaceId,
        patientId: task.patientId,
        assignedTo: assignedTo || task.assignedTo,
        type: type || 'general_followup',
        title: task.title,
        description: task.description,
        scheduledDate: new Date(scheduledDate),
        scheduledTime,
        duration,
        status: 'scheduled',
        confirmationStatus: 'pending',
        isRecurring: false,
        isRecurringException: false,
        reminders: [],
        relatedRecords: {
          followUpTaskId: task._id
        },
        metadata: {
          source: 'follow_up_conversion',
          triggerEvent: 'follow_up_task_conversion'
        },
        createdBy: userId
      });

      // Update follow-up task
      task.status = 'converted_to_appointment';
      task.relatedRecords.appointmentId = appointment._id;
      
      if (!task.outcome) {
        task.outcome = {
          status: 'successful',
          notes: 'Converted to appointment',
          nextActions: [],
          appointmentCreated: true,
          appointmentId: appointment._id
        };
      } else {
        task.outcome.appointmentCreated = true;
        task.outcome.appointmentId = appointment._id;
      }

      await task.save();

      // Populate appointment
      await appointment.populate([
        { path: 'patientId', select: 'name email phone' },
        { path: 'assignedTo', select: 'name email role' }
      ]);

      logger.info(`Follow-up task converted to appointment`, {
        taskId: task._id,
        appointmentId: appointment._id
      });

      res.status(201).json({
        success: true,
        message: 'Follow-up task converted to appointment successfully',
        data: {
          appointment,
          task
        }
      });
    } catch (error: any) {
      logger.error('Error converting follow-up to appointment:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to convert follow-up to appointment'
      });
    }
  }

  /**
   * Get overdue follow-up tasks
   */
  async getOverdueFollowUps(req: AuthRequest, res: Response) {
    try {
      const { assignedTo, priority } = req.query;
      const workplaceId = req.user?.workplaceId;

      if (!workplaceId) {
        return res.status(400).json({
          success: false,
          message: 'Workplace ID is required'
        });
      }

      const query: any = {
        workplaceId,
        dueDate: { $lt: new Date() },
        status: { $nin: ['completed', 'cancelled', 'converted_to_appointment'] },
        isDeleted: false
      };

      if (assignedTo) query.assignedTo = assignedTo;
      if (priority) query.priority = priority;

      const tasks = await FollowUpTask.find(query)
        .populate('patientId', 'name email phone')
        .populate('assignedTo', 'name email role')
        .sort({ priority: -1, dueDate: 1 })
        .lean();

      // Calculate summary
      const summary = {
        total: tasks.length,
        critical: tasks.filter(t => ['critical', 'urgent'].includes(t.priority)).length,
        high: tasks.filter(t => t.priority === 'high').length,
        byPriority: tasks.reduce((acc: any, task) => {
          acc[task.priority] = (acc[task.priority] || 0) + 1;
          return acc;
        }, {})
      };

      res.json({
        success: true,
        data: {
          tasks,
          summary
        }
      });
    } catch (error) {
      logger.error('Error getting overdue follow-ups:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get overdue follow-ups'
      });
    }
  }

  /**
   * Escalate follow-up task priority
   */
  async escalateFollowUp(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { newPriority, reason } = req.body;
      const workplaceId = req.user?.workplaceId;
      const userId = req.user?._id;

      const task = await FollowUpTask.findOne({
        _id: id,
        workplaceId,
        isDeleted: false
      });

      if (!task) {
        return res.status(404).json({
          success: false,
          message: 'Follow-up task not found'
        });
      }

      // Record escalation
      const escalationRecord = {
        escalatedAt: new Date(),
        escalatedBy: userId,
        fromPriority: task.priority,
        toPriority: newPriority,
        reason
      };

      task.escalationHistory.push(escalationRecord);
      task.priority = newPriority;

      await task.save();

      logger.info(`Follow-up task escalated`, {
        taskId: task._id,
        from: escalationRecord.fromPriority,
        to: newPriority
      });

      res.json({
        success: true,
        message: 'Follow-up task escalated successfully',
        data: { task }
      });
    } catch (error) {
      logger.error('Error escalating follow-up:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to escalate follow-up'
      });
    }
  }

  /**
   * Get follow-up analytics
   */
  async getFollowUpAnalytics(req: AuthRequest, res: Response) {
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
        query.createdAt = {
          $gte: new Date(startDate as string),
          $lte: new Date(endDate as string)
        };
      }

      const tasks = await FollowUpTask.find(query).lean();

      // Calculate analytics
      const analytics = {
        total: tasks.length,
        byStatus: {},
        byPriority: {},
        byType: {},
        completionRate: 0,
        averageCompletionTime: 0,
        overdueCount: 0,
        escalatedCount: tasks.filter(t => t.escalationHistory && t.escalationHistory.length > 0).length
      };

      tasks.forEach((task: any) => {
        analytics.byStatus[task.status] = (analytics.byStatus[task.status] || 0) + 1;
        analytics.byPriority[task.priority] = (analytics.byPriority[task.priority] || 0) + 1;
        analytics.byType[task.type] = (analytics.byType[task.type] || 0) + 1;

        if (isPast(new Date(task.dueDate)) && !['completed', 'cancelled'].includes(task.status)) {
          analytics.overdueCount++;
        }
      });

      const completed = analytics.byStatus['completed'] || 0;
      analytics.completionRate = tasks.length > 0 ? (completed / tasks.length) * 100 : 0;

      // Calculate average completion time for completed tasks
      const completedTasks = tasks.filter(t => t.status === 'completed' && t.completedAt);
      if (completedTasks.length > 0) {
        const totalTime = completedTasks.reduce((sum, task) => {
          const created = new Date(task.createdAt).getTime();
          const completed = new Date(task.completedAt).getTime();
          return sum + (completed - created);
        }, 0);
        analytics.averageCompletionTime = totalTime / completedTasks.length / (1000 * 60 * 60 * 24); // in days
      }

      res.json({
        success: true,
        data: { analytics }
      });
    } catch (error) {
      logger.error('Error getting follow-up analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get follow-up analytics'
      });
    }
  }

  /**
   * Get patient follow-ups
   */
  async getPatientFollowUps(req: AuthRequest, res: Response) {
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

      const [tasks, total] = await Promise.all([
        FollowUpTask.find(query)
          .populate('assignedTo', 'name email role')
          .sort({ dueDate: -1 })
          .limit(Number(limit))
          .skip(skip)
          .lean(),
        FollowUpTask.countDocuments(query)
      ]);

      res.json({
        success: true,
        data: {
          tasks,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit))
          }
        }
      });
    } catch (error) {
      logger.error('Error getting patient follow-ups:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get patient follow-ups'
      });
    }
  }

  /**
   * Get dashboard summary
   */
  async getDashboardSummary(req: AuthRequest, res: Response) {
    try {
      const workplaceId = req.user?.workplaceId;
      const { pharmacistId } = req.query;

      const query: any = {
        workplaceId,
        isDeleted: false
      };

      if (pharmacistId) query.assignedTo = pharmacistId;

      const tasks = await FollowUpTask.find(query).lean();

      const summary = {
        total: tasks.length,
        pending: tasks.filter(t => t.status === 'pending').length,
        inProgress: tasks.filter(t => t.status === 'in_progress').length,
        completed: tasks.filter(t => t.status === 'completed').length,
        overdue: tasks.filter(t => isPast(new Date(t.dueDate)) && !['completed', 'cancelled'].includes(t.status)).length,
        dueToday: tasks.filter(t => {
          const today = new Date();
          const taskDate = new Date(t.dueDate);
          return taskDate.toDateString() === today.toDateString() && !['completed', 'cancelled'].includes(t.status);
        }).length,
        byPriority: {
          critical: tasks.filter(t => t.priority === 'critical').length,
          urgent: tasks.filter(t => t.priority === 'urgent').length,
          high: tasks.filter(t => t.priority === 'high').length,
          medium: tasks.filter(t => t.priority === 'medium').length,
          low: tasks.filter(t => t.priority === 'low').length
        },
        recentlyCompleted: tasks.filter(t => {
          if (!t.completedAt) return false;
          const dayAgo = new Date();
          dayAgo.setDate(dayAgo.getDate() - 1);
          return new Date(t.completedAt) > dayAgo;
        }).length
      };

      res.json({
        success: true,
        data: { summary }
      });
    } catch (error) {
      logger.error('Error getting dashboard summary:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get dashboard summary'
      });
    }
  }

  /**
   * Create follow-up from intervention
   */
  async createFromIntervention(req: AuthRequest, res: Response) {
    try {
      const { interventionId } = req.params;
      const workplaceId = req.user?.workplaceId;
      const userId = req.user?._id;

      const taskData = {
        ...req.body,
        workplaceId,
        createdBy: userId,
        status: 'pending',
        type: req.body.type || 'general_followup',
        priority: req.body.priority || 'medium',
        escalationHistory: [],
        remindersSent: [],
        relatedRecords: {
          clinicalInterventionId: interventionId
        },
        trigger: {
          type: 'manual',
          sourceId: interventionId,
          sourceType: 'clinical_intervention',
          triggerDate: new Date()
        }
      };

      const task = await FollowUpTask.create(taskData);
      
      await task.populate([
        { path: 'patientId', select: 'name email phone' },
        { path: 'assignedTo', select: 'name email role' }
      ]);

      res.status(201).json({
        success: true,
        message: 'Follow-up task created from intervention',
        data: { task }
      });
    } catch (error: any) {
      logger.error('Error creating follow-up from intervention:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create follow-up from intervention'
      });
    }
  }

  /**
   * Create follow-up from lab result
   */
  async createFromLabResult(req: AuthRequest, res: Response) {
    try {
      const { labResultId } = req.params;
      const workplaceId = req.user?.workplaceId;
      const userId = req.user?._id;

      const taskData = {
        ...req.body,
        workplaceId,
        createdBy: userId,
        status: 'pending',
        type: 'lab_result_review',
        priority: req.body.priority || 'high',
        escalationHistory: [],
        remindersSent: [],
        relatedRecords: {
          labResultId
        },
        trigger: {
          type: 'lab_result',
          sourceId: labResultId,
          sourceType: 'lab_result',
          triggerDate: new Date()
        }
      };

      const task = await FollowUpTask.create(taskData);
      
      await task.populate([
        { path: 'patientId', select: 'name email phone' },
        { path: 'assignedTo', select: 'name email role' }
      ]);

      res.status(201).json({
        success: true,
        message: 'Follow-up task created from lab result',
        data: { task }
      });
    } catch (error: any) {
      logger.error('Error creating follow-up from lab result:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create follow-up from lab result'
      });
    }
  }

  /**
   * Create follow-up from medication start
   */
  async createFromMedicationStart(req: AuthRequest, res: Response) {
    try {
      const { medicationId } = req.params;
      const workplaceId = req.user?.workplaceId;
      const userId = req.user?._id;

      const taskData = {
        ...req.body,
        workplaceId,
        createdBy: userId,
        status: 'pending',
        type: 'medication_start_followup',
        priority: req.body.priority || 'medium',
        escalationHistory: [],
        remindersSent: [],
        relatedRecords: {
          medicationId
        },
        trigger: {
          type: 'medication_start',
          sourceId: medicationId,
          sourceType: 'medication',
          triggerDate: new Date()
        }
      };

      const task = await FollowUpTask.create(taskData);
      
      await task.populate([
        { path: 'patientId', select: 'name email phone' },
        { path: 'assignedTo', select: 'name email role' }
      ]);

      res.status(201).json({
        success: true,
        message: 'Follow-up task created from medication start',
        data: { task }
      });
    } catch (error: any) {
      logger.error('Error creating follow-up from medication start:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create follow-up from medication start'
      });
    }
  }

  /**
   * Get analytics summary (alias for getFollowUpAnalytics)
   */
  async getAnalyticsSummary(req: AuthRequest, res: Response) {
    return this.getFollowUpAnalytics(req, res);
  }

  /**
   * Cancel follow-up task
   */
  async cancelFollowUpTask(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const workplaceId = req.user?.workplaceId;

      const task = await FollowUpTask.findOne({
        _id: id,
        workplaceId,
        isDeleted: false
      });

      if (!task) {
        return res.status(404).json({
          success: false,
          message: 'Follow-up task not found'
        });
      }

      task.status = 'cancelled';
      task.outcome = {
        status: 'unsuccessful',
        notes: reason || 'Task cancelled',
        nextActions: [],
        appointmentCreated: false
      };

      await task.save();

      res.json({
        success: true,
        message: 'Follow-up task cancelled successfully',
        data: { task }
      });
    } catch (error) {
      logger.error('Error cancelling follow-up task:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cancel follow-up task'
      });
    }
  }
}

export default new FollowUpController();
