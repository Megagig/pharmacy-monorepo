/**
 * Follow-Up Monitor Job Processor
 * Monitors follow-up tasks and handles automatic escalation
 * 
 * Features:
 * - Hourly job to check overdue follow-ups
 * - Automatic escalation for overdue tasks
 * - Notification sending to assigned pharmacists
 * - Manager alerts for critical overdue tasks
 * - Tracks escalation history
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

import { Job } from 'bull';
import mongoose from 'mongoose';
import { FollowUpMonitorJobData } from '../config/queue';
import FollowUpTask, { IFollowUpTask } from '../models/FollowUpTask';
import User from '../models/User';
import Notification from '../models/Notification';
import logger from '../utils/logger';

/**
 * Follow-up monitoring result
 */
export interface FollowUpMonitorResult {
  workplaceId: string;
  totalChecked: number;
  overdueFound: number;
  escalated: number;
  notificationsSent: number;
  managerAlertsSent: number;
  errors: number;
  processingTime: number;
  details: {
    overdueByPriority: Record<string, number>;
    escalatedTasks: string[];
    criticalTasks: string[];
  };
}

/**
 * Escalation configuration based on how overdue a task is
 */
interface EscalationRule {
  daysOverdue: number;
  targetPriority: IFollowUpTask['priority'];
  notifyManager: boolean;
}

const ESCALATION_RULES: EscalationRule[] = [
  { daysOverdue: 1, targetPriority: 'high', notifyManager: false },
  { daysOverdue: 3, targetPriority: 'urgent', notifyManager: false },
  { daysOverdue: 7, targetPriority: 'critical', notifyManager: true },
];

/**
 * Process follow-up monitor job
 * 
 * This is the main processor that monitors follow-up tasks and handles escalation.
 * It runs hourly to check for overdue tasks and take appropriate actions.
 */
export async function processFollowUpMonitor(
  job: Job<FollowUpMonitorJobData>
): Promise<FollowUpMonitorResult> {
  const startTime = Date.now();
  const { workplaceId, checkOverdue, escalateCritical } = job.data;

  logger.info('Processing follow-up monitor job', {
    jobId: job.id,
    workplaceId,
    checkOverdue,
    escalateCritical,
    attemptNumber: job.attemptsMade + 1,
  });

  const result: FollowUpMonitorResult = {
    workplaceId,
    totalChecked: 0,
    overdueFound: 0,
    escalated: 0,
    notificationsSent: 0,
    managerAlertsSent: 0,
    errors: 0,
    processingTime: 0,
    details: {
      overdueByPriority: {},
      escalatedTasks: [],
      criticalTasks: [],
    },
  };

  try {
    await job.progress(10);

    // Find all pending and in_progress follow-up tasks for this workplace
    const tasks = await FollowUpTask.find({
      workplaceId: new mongoose.Types.ObjectId(workplaceId),
      status: { $in: ['pending', 'in_progress'] },
      isDeleted: false,
    })
      .populate('patientId', 'firstName lastName email phone')
      .populate('assignedTo', 'firstName lastName email')
      .lean();

    result.totalChecked = tasks.length;

    logger.debug(`Found ${tasks.length} active follow-up tasks to check`, {
      jobId: job.id,
      workplaceId,
    });

    await job.progress(30);

    if (!checkOverdue || tasks.length === 0) {
      logger.info('No tasks to check or checkOverdue disabled', {
        jobId: job.id,
        workplaceId,
        tasksCount: tasks.length,
        checkOverdue,
      });
      result.processingTime = Date.now() - startTime;
      return result;
    }

    // Check each task for overdue status
    const now = new Date();
    const overdueTasks: Array<IFollowUpTask & { daysOverdue: number }> = [];

    for (const task of tasks) {
      const dueDate = new Date(task.dueDate);
      if (dueDate < now) {
        const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        overdueTasks.push({ ...task, daysOverdue } as any);
        
        // Track by priority
        result.details.overdueByPriority[task.priority] = 
          (result.details.overdueByPriority[task.priority] || 0) + 1;
      }
    }

    result.overdueFound = overdueTasks.length;

    logger.info(`Found ${overdueTasks.length} overdue follow-up tasks`, {
      jobId: job.id,
      workplaceId,
      overdueByPriority: result.details.overdueByPriority,
    });

    await job.progress(50);

    // Process each overdue task
    for (const task of overdueTasks) {
      try {
        // Update status to overdue if not already
        if (task.status !== 'overdue') {
          await FollowUpTask.findByIdAndUpdate(task._id, {
            status: 'overdue',
            updatedBy: new mongoose.Types.ObjectId('000000000000000000000000'), // System user
          });
        }

        // Send notification to assigned pharmacist
        const notificationSent = await sendPharmacistNotification(task, workplaceId);
        if (notificationSent) {
          result.notificationsSent++;
        }

        // Check if escalation is needed
        if (escalateCritical) {
          const escalationResult = await handleEscalation(task, workplaceId);
          
          if (escalationResult.escalated) {
            result.escalated++;
            result.details.escalatedTasks.push(task._id.toString());
          }

          if (escalationResult.managerAlerted) {
            result.managerAlertsSent++;
            result.details.criticalTasks.push(task._id.toString());
          }
        }
      } catch (error) {
        result.errors++;
        logger.error('Error processing overdue task', {
          jobId: job.id,
          taskId: task._id.toString(),
          error: (error as Error).message,
        });
      }
    }

    await job.progress(90);

    result.processingTime = Date.now() - startTime;

    logger.info('Follow-up monitor job completed successfully', {
      jobId: job.id,
      workplaceId,
      totalChecked: result.totalChecked,
      overdueFound: result.overdueFound,
      escalated: result.escalated,
      notificationsSent: result.notificationsSent,
      managerAlertsSent: result.managerAlertsSent,
      errors: result.errors,
      processingTime: `${result.processingTime}ms`,
    });

    await job.progress(100);

    return result;
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logger.error('Failed to process follow-up monitor job:', {
      jobId: job.id,
      workplaceId,
      error: (error as Error).message,
      stack: (error as Error).stack,
      attemptsMade: job.attemptsMade,
      processingTime: `${processingTime}ms`,
    });

    throw error;
  }
}

/**
 * Send notification to assigned pharmacist about overdue task
 */
async function sendPharmacistNotification(
  task: IFollowUpTask & { daysOverdue: number },
  workplaceId: string
): Promise<boolean> {
  try {
    const patient = task.patientId as any;
    const pharmacist = task.assignedTo as any;

    if (!pharmacist || !pharmacist._id) {
      logger.warn('Cannot send notification - pharmacist not found', {
        taskId: task._id.toString(),
      });
      return false;
    }

    // Check if reminder was already sent recently (within last 24 hours)
    const lastReminder = task.remindersSent
      .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())[0];
    
    if (lastReminder) {
      const hoursSinceLastReminder = 
        (Date.now() - new Date(lastReminder.sentAt).getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceLastReminder < 24) {
        logger.debug('Skipping notification - reminder sent recently', {
          taskId: task._id.toString(),
          hoursSinceLastReminder: hoursSinceLastReminder.toFixed(1),
        });
        return false;
      }
    }

    // Create notification
    const notification = new Notification({
      workplaceId: new mongoose.Types.ObjectId(workplaceId),
      userId: pharmacist._id,
      type: 'followup_task_overdue',
      title: `Overdue Follow-up: ${task.title}`,
      message: `Follow-up task for ${patient?.firstName || 'Patient'} ${patient?.lastName || ''} is ${task.daysOverdue} day(s) overdue. Priority: ${task.priority.toUpperCase()}`,
      priority: task.priority === 'critical' || task.priority === 'urgent' ? 'high' : 'medium',
      category: 'task',
      data: {
        taskId: task._id.toString(),
        patientId: task.patientId.toString(),
        daysOverdue: task.daysOverdue,
        dueDate: task.dueDate,
        taskType: task.type,
        taskPriority: task.priority,
      },
      channels: ['push', 'email'],
      read: false,
      createdBy: new mongoose.Types.ObjectId('000000000000000000000000'), // System user
    });

    await notification.save();

    // Add reminder to task
    await FollowUpTask.findByIdAndUpdate(task._id, {
      $push: {
        remindersSent: {
          sentAt: new Date(),
          channel: 'system',
          recipientId: pharmacist._id,
        },
      },
    });

    logger.info('Sent overdue notification to pharmacist', {
      taskId: task._id.toString(),
      pharmacistId: pharmacist._id.toString(),
      daysOverdue: task.daysOverdue,
    });

    return true;
  } catch (error) {
    logger.error('Error sending pharmacist notification', {
      taskId: task._id.toString(),
      error: (error as Error).message,
    });
    return false;
  }
}

/**
 * Handle escalation of overdue tasks based on rules
 */
async function handleEscalation(
  task: IFollowUpTask & { daysOverdue: number },
  workplaceId: string
): Promise<{ escalated: boolean; managerAlerted: boolean }> {
  const result = { escalated: false, managerAlerted: false };

  try {
    // Find applicable escalation rule
    const applicableRule = ESCALATION_RULES
      .filter(rule => task.daysOverdue >= rule.daysOverdue)
      .sort((a, b) => b.daysOverdue - a.daysOverdue)[0];

    if (!applicableRule) {
      return result;
    }

    // Check if task priority needs escalation
    const priorityOrder = ['low', 'medium', 'high', 'urgent', 'critical'];
    const currentPriorityIndex = priorityOrder.indexOf(task.priority);
    const targetPriorityIndex = priorityOrder.indexOf(applicableRule.targetPriority);

    if (targetPriorityIndex <= currentPriorityIndex) {
      // Already at or above target priority
      logger.debug('Task already at target priority or higher', {
        taskId: task._id.toString(),
        currentPriority: task.priority,
        targetPriority: applicableRule.targetPriority,
      });
      
      // Still send manager alert if needed
      if (applicableRule.notifyManager && task.priority === 'critical') {
        result.managerAlerted = await sendManagerAlert(task, workplaceId);
      }
      
      return result;
    }

    // Escalate priority
    const taskDoc = await FollowUpTask.findById(task._id);
    if (!taskDoc) {
      logger.warn('Task not found for escalation', {
        taskId: task._id.toString(),
      });
      return result;
    }

    taskDoc.escalate(
      applicableRule.targetPriority,
      `Automatically escalated: ${task.daysOverdue} days overdue`,
      new mongoose.Types.ObjectId('000000000000000000000000') // System user
    );

    await taskDoc.save();

    result.escalated = true;

    logger.info('Escalated follow-up task priority', {
      taskId: task._id.toString(),
      fromPriority: task.priority,
      toPriority: applicableRule.targetPriority,
      daysOverdue: task.daysOverdue,
    });

    // Send manager alert if required
    if (applicableRule.notifyManager) {
      result.managerAlerted = await sendManagerAlert(task, workplaceId);
    }

    return result;
  } catch (error) {
    logger.error('Error handling escalation', {
      taskId: task._id.toString(),
      error: (error as Error).message,
    });
    return result;
  }
}

/**
 * Send alert to pharmacy manager about critical overdue task
 */
async function sendManagerAlert(
  task: IFollowUpTask & { daysOverdue: number },
  workplaceId: string
): Promise<boolean> {
  try {
    const patient = task.patientId as any;
    const pharmacist = task.assignedTo as any;

    // Find pharmacy managers (users with manager role)
    const managers = await User.find({
      workplaceId: new mongoose.Types.ObjectId(workplaceId),
      role: { $in: ['manager', 'admin', 'super_admin'] },
      isActive: true,
      isDeleted: false,
    });

    if (managers.length === 0) {
      logger.warn('No managers found to send alert', {
        workplaceId,
        taskId: task._id.toString(),
      });
      return false;
    }

    // Create notification for each manager
    const notifications = managers.map(manager => ({
      workplaceId: new mongoose.Types.ObjectId(workplaceId),
      userId: manager._id,
      type: 'followup_task_overdue',
      title: `CRITICAL: Overdue Follow-up Requires Attention`,
      message: `Critical follow-up task for ${patient?.firstName || 'Patient'} ${patient?.lastName || ''} is ${task.daysOverdue} days overdue. Assigned to: ${pharmacist?.firstName || 'Unknown'} ${pharmacist?.lastName || ''}. Immediate action required.`,
      priority: 'high',
      category: 'alert',
      data: {
        taskId: task._id.toString(),
        patientId: task.patientId.toString(),
        assignedTo: task.assignedTo.toString(),
        daysOverdue: task.daysOverdue,
        dueDate: task.dueDate,
        taskType: task.type,
        taskPriority: task.priority,
        escalated: true,
      },
      channels: ['push', 'email', 'sms'],
      read: false,
      createdBy: new mongoose.Types.ObjectId('000000000000000000000000'), // System user
    }));

    await Notification.insertMany(notifications);

    logger.info('Sent manager alerts for critical overdue task', {
      taskId: task._id.toString(),
      managersNotified: managers.length,
      daysOverdue: task.daysOverdue,
    });

    return true;
  } catch (error) {
    logger.error('Error sending manager alert', {
      taskId: task._id.toString(),
      error: (error as Error).message,
    });
    return false;
  }
}

/**
 * Handle job completion
 */
export function onFollowUpMonitorCompleted(
  job: Job<FollowUpMonitorJobData>,
  result: FollowUpMonitorResult
): void {
  const duration = job.processedOn ? Date.now() - job.processedOn : 0;
  
  logger.info('Follow-up monitor job completed successfully', {
    jobId: job.id,
    workplaceId: job.data.workplaceId,
    duration: `${duration}ms`,
    processingTime: `${result.processingTime}ms`,
    totalChecked: result.totalChecked,
    overdueFound: result.overdueFound,
    escalated: result.escalated,
    notificationsSent: result.notificationsSent,
    managerAlertsSent: result.managerAlertsSent,
    errors: result.errors,
  });

  // Log warnings if there were issues
  if (result.errors > 0) {
    logger.warn('Follow-up monitor completed with errors', {
      jobId: job.id,
      errors: result.errors,
      totalChecked: result.totalChecked,
    });
  }

  if (result.overdueFound > 0 && result.notificationsSent === 0) {
    logger.warn('Overdue tasks found but no notifications sent', {
      jobId: job.id,
      overdueFound: result.overdueFound,
    });
  }
}

/**
 * Handle job failure
 */
export async function onFollowUpMonitorFailed(
  job: Job<FollowUpMonitorJobData>,
  error: Error
): Promise<void> {
  const { workplaceId } = job.data;
  const attemptsLeft = (job.opts.attempts || 3) - job.attemptsMade;

  logger.error('Follow-up monitor job failed', {
    jobId: job.id,
    workplaceId,
    error: error.message,
    stack: error.stack,
    attemptsMade: job.attemptsMade,
    attemptsLeft,
    willRetry: attemptsLeft > 0,
  });

  // If all retries exhausted, send critical alert
  if (job.attemptsMade >= (job.opts.attempts || 3)) {
    logger.error('Follow-up monitor job exhausted all retries - CRITICAL', {
      jobId: job.id,
      workplaceId,
      totalAttempts: job.attemptsMade,
      finalError: error.message,
    });

    // Send alert to system administrators
    try {
      const admins = await User.find({
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        role: { $in: ['admin', 'super_admin'] },
        isActive: true,
        isDeleted: false,
      });

      if (admins.length > 0) {
        const notifications = admins.map(admin => ({
          workplaceId: new mongoose.Types.ObjectId(workplaceId),
          userId: admin._id,
          type: 'system_alert',
          title: 'CRITICAL: Follow-up Monitor Job Failed',
          message: `The follow-up monitoring system has failed after ${job.attemptsMade} attempts. Follow-up tasks may not be monitored properly. Technical support required.`,
          priority: 'high',
          category: 'system',
          data: {
            jobId: job.id,
            error: error.message,
            attempts: job.attemptsMade,
          },
          channels: ['push', 'email'],
          read: false,
          createdBy: new mongoose.Types.ObjectId('000000000000000000000000'),
        }));

        await Notification.insertMany(notifications);

        logger.info('Sent critical failure alerts to admins', {
          jobId: job.id,
          adminsNotified: admins.length,
        });
      }
    } catch (alertError) {
      logger.error('Failed to send critical failure alerts', {
        jobId: job.id,
        error: (alertError as Error).message,
      });
    }
  }
}

export default {
  processFollowUpMonitor,
  onFollowUpMonitorCompleted,
  onFollowUpMonitorFailed,
};
