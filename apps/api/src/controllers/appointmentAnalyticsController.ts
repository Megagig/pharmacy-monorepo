import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middlewares/auth';
import { sendSuccess, sendError } from '../utils/responseHelpers';
import logger from '../utils/logger';
import Appointment from '../models/Appointment';
import FollowUpTask from '../models/FollowUpTask';
import ReminderTemplate from '../models/ReminderTemplate';
import PharmacistSchedule from '../models/PharmacistSchedule';
import { format, subDays, startOfMonth, endOfMonth, parseISO, startOfDay, endOfDay } from 'date-fns';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

export interface AppointmentAnalytics {
  summary: {
    totalAppointments: number;
    completionRate: number;
    noShowRate: number;
    cancellationRate: number;
    averageWaitTime: number;
    averageDuration: number;
  };
  byType: Array<{
    type: string;
    count: number;
    completionRate: number;
    averageDuration: number;
  }>;
  byStatus: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  trends: {
    daily: Array<{
      date: string;
      appointments: number;
      completed: number;
      cancelled: number;
      noShow: number;
    }>;
    weekly: Array<{
      week: string;
      appointments: number;
      completionRate: number;
    }>;
    monthly: Array<{
      month: string;
      appointments: number;
      completionRate: number;
    }>;
  };
  peakTimes: {
    busiestDay: string;
    busiestHour: string;
    hourlyDistribution: Array<{
      hour: number;
      count: number;
    }>;
    dailyDistribution: Array<{
      day: string;
      count: number;
    }>;
  };
  pharmacistPerformance: Array<{
    pharmacistId: string;
    pharmacistName: string;
    totalAppointments: number;
    completionRate: number;
    averageDuration: number;
    patientSatisfaction?: number;
  }>;
}

export interface FollowUpAnalytics {
  summary: {
    totalTasks: number;
    completionRate: number;
    averageTimeToCompletion: number;
    overdueCount: number;
    criticalOverdueCount: number;
  };
  byType: Array<{
    type: string;
    count: number;
    completionRate: number;
    averageTimeToCompletion: number;
  }>;
  byPriority: Array<{
    priority: string;
    count: number;
    completionRate: number;
    averageTimeToCompletion: number;
  }>;
  byTrigger: Array<{
    triggerType: string;
    count: number;
    completionRate: number;
  }>;
  trends: {
    daily: Array<{
      date: string;
      created: number;
      completed: number;
      overdue: number;
    }>;
    weekly: Array<{
      week: string;
      created: number;
      completed: number;
      completionRate: number;
    }>;
  };
  escalationMetrics: {
    totalEscalations: number;
    escalationRate: number;
    averageEscalationTime: number;
    escalationsByPriority: Array<{
      fromPriority: string;
      toPriority: string;
      count: number;
    }>;
  };
}

export interface ReminderAnalytics {
  summary: {
    totalReminders: number;
    deliverySuccessRate: number;
    patientResponseRate: number;
    impactOnNoShowRate: number;
  };
  byChannel: Array<{
    channel: string;
    sent: number;
    delivered: number;
    failed: number;
    deliveryRate: number;
    responseRate: number;
  }>;
  byTiming: Array<{
    timingLabel: string;
    sent: number;
    effectiveness: number;
  }>;
  templatePerformance: Array<{
    templateId: string;
    templateName: string;
    sent: number;
    deliveryRate: number;
    responseRate: number;
  }>;
  trends: {
    daily: Array<{
      date: string;
      sent: number;
      delivered: number;
      failed: number;
    }>;
  };
}

export interface CapacityAnalytics {
  overall: {
    totalSlots: number;
    bookedSlots: number;
    utilizationRate: number;
    availableSlots: number;
  };
  byPharmacist: Array<{
    pharmacistId: string;
    pharmacistName: string;
    totalSlots: number;
    bookedSlots: number;
    utilizationRate: number;
    workingHours: number;
  }>;
  byDay: Array<{
    day: string;
    totalSlots: number;
    bookedSlots: number;
    utilizationRate: number;
  }>;
  byHour: Array<{
    hour: number;
    totalSlots: number;
    bookedSlots: number;
    utilizationRate: number;
  }>;
  recommendations: string[];
}

/**
 * Get comprehensive appointment analytics
 */
export const getAppointmentAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const workplaceId = req.user?.workplaceId;
    const {
      startDate: startDateParam,
      endDate: endDateParam,
      pharmacistId,
      locationId,
      appointmentType
    } = req.query;

    // Default to last 30 days if no date range provided
    const startDate = startDateParam 
      ? parseISO(startDateParam as string)
      : subDays(new Date(), 30);
    const endDate = endDateParam 
      ? parseISO(endDateParam as string)
      : new Date();

    // Build query filters
    const baseQuery: any = {
      workplaceId: new mongoose.Types.ObjectId(workplaceId),
      scheduledDate: {
        $gte: startOfDay(startDate),
        $lte: endOfDay(endDate)
      }
    };

    if (pharmacistId) {
      baseQuery.assignedTo = new mongoose.Types.ObjectId(pharmacistId as string);
    }

    if (locationId) {
      baseQuery.locationId = locationId;
    }

    if (appointmentType) {
      baseQuery.type = appointmentType;
    }

    // Get all appointments for the period
    const appointments = await Appointment.find(baseQuery)
      .populate('assignedTo', 'firstName lastName')
      .sort({ scheduledDate: 1 });

    // Calculate summary metrics
    const totalAppointments = appointments.length;
    const completedAppointments = appointments.filter(a => a.status === 'completed').length;
    const cancelledAppointments = appointments.filter(a => a.status === 'cancelled').length;
    const noShowAppointments = appointments.filter(a => a.status === 'no_show').length;

    const completionRate = totalAppointments > 0 
      ? Math.round((completedAppointments / totalAppointments) * 100)
      : 0;
    const noShowRate = totalAppointments > 0 
      ? Math.round((noShowAppointments / totalAppointments) * 100)
      : 0;
    const cancellationRate = totalAppointments > 0 
      ? Math.round((cancelledAppointments / totalAppointments) * 100)
      : 0;

    // Calculate average duration
    const completedWithDuration = appointments.filter(a => 
      a.status === 'completed' && a.duration
    );
    const averageDuration = completedWithDuration.length > 0
      ? Math.round(completedWithDuration.reduce((sum, a) => sum + a.duration, 0) / completedWithDuration.length)
      : 0;

    // Group by type
    const typeGroups = appointments.reduce((acc, appointment) => {
      const type = appointment.type;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(appointment);
      return acc;
    }, {} as Record<string, typeof appointments>);

    const byType = Object.entries(typeGroups).map(([type, typeAppointments]) => {
      const completed = typeAppointments.filter(a => a.status === 'completed').length;
      const avgDuration = typeAppointments.length > 0
        ? Math.round(typeAppointments.reduce((sum, a) => sum + a.duration, 0) / typeAppointments.length)
        : 0;
      
      return {
        type,
        count: typeAppointments.length,
        completionRate: typeAppointments.length > 0 
          ? Math.round((completed / typeAppointments.length) * 100)
          : 0,
        averageDuration: avgDuration
      };
    });

    // Group by status
    const statusGroups = appointments.reduce((acc, appointment) => {
      const status = appointment.status;
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byStatus = Object.entries(statusGroups).map(([status, count]) => ({
      status,
      count,
      percentage: totalAppointments > 0 ? Math.round((count / totalAppointments) * 100) : 0
    }));

    // Generate trends
    const trends = await generateAppointmentTrends(appointments, startDate, endDate);

    // Calculate peak times
    const peakTimes = calculatePeakTimes(appointments);

    // Calculate pharmacist performance
    const pharmacistPerformance = calculatePharmacistPerformance(appointments);

    const analytics: AppointmentAnalytics = {
      summary: {
        totalAppointments,
        completionRate,
        noShowRate,
        cancellationRate,
        averageWaitTime: 0, // TODO: Implement wait time tracking
        averageDuration
      },
      byType,
      byStatus,
      trends,
      peakTimes,
      pharmacistPerformance
    };

    sendSuccess(res, analytics, 'Appointment analytics retrieved successfully');
  } catch (error) {
    logger.error('Error getting appointment analytics:', error);
    sendError(res, 'SERVER_ERROR', 'Failed to retrieve appointment analytics', 500);
  }
};

/**
 * Get follow-up task analytics
 */
export const getFollowUpAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const workplaceId = req.user?.workplaceId;
    const {
      startDate: startDateParam,
      endDate: endDateParam,
      pharmacistId,
      taskType,
      priority
    } = req.query;

    const startDate = startDateParam 
      ? parseISO(startDateParam as string)
      : subDays(new Date(), 30);
    const endDate = endDateParam 
      ? parseISO(endDateParam as string)
      : new Date();

    const baseQuery: any = {
      workplaceId: new mongoose.Types.ObjectId(workplaceId),
      createdAt: {
        $gte: startOfDay(startDate),
        $lte: endOfDay(endDate)
      }
    };

    if (pharmacistId) {
      baseQuery.assignedTo = new mongoose.Types.ObjectId(pharmacistId as string);
    }

    if (taskType) {
      baseQuery.type = taskType;
    }

    if (priority) {
      baseQuery.priority = priority;
    }

    const tasks = await FollowUpTask.find(baseQuery)
      .populate('assignedTo', 'firstName lastName')
      .sort({ createdAt: 1 });

    // Calculate summary metrics
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const overdueTasks = tasks.filter(t => t.status === 'overdue' || 
      (t.status === 'pending' && t.dueDate < new Date())).length;
    const criticalOverdueTasks = tasks.filter(t => 
      t.isCriticallyOverdue && t.isCriticallyOverdue()).length;

    const completionRate = totalTasks > 0 
      ? Math.round((completedTasks / totalTasks) * 100)
      : 0;

    // Calculate average time to completion
    const completedWithTime = tasks.filter(t => 
      t.status === 'completed' && t.completedAt && t.createdAt
    );
    const averageTimeToCompletion = completedWithTime.length > 0
      ? Math.round(completedWithTime.reduce((sum, t) => {
          const diffMs = t.completedAt!.getTime() - t.createdAt.getTime();
          return sum + (diffMs / (1000 * 60 * 60 * 24)); // Convert to days
        }, 0) / completedWithTime.length * 10) / 10 // Round to 1 decimal
      : 0;

    // Group by type
    const typeAnalytics = await generateFollowUpTypeAnalytics(tasks);

    // Group by priority
    const priorityAnalytics = await generateFollowUpPriorityAnalytics(tasks);

    // Group by trigger
    const triggerAnalytics = await generateFollowUpTriggerAnalytics(tasks);

    // Generate trends
    const trends = await generateFollowUpTrends(tasks, startDate, endDate);

    // Calculate escalation metrics
    const escalationMetrics = calculateEscalationMetrics(tasks);

    const analytics: FollowUpAnalytics = {
      summary: {
        totalTasks,
        completionRate,
        averageTimeToCompletion,
        overdueCount: overdueTasks,
        criticalOverdueCount: criticalOverdueTasks
      },
      byType: typeAnalytics,
      byPriority: priorityAnalytics,
      byTrigger: triggerAnalytics,
      trends,
      escalationMetrics
    };

    sendSuccess(res, analytics, 'Follow-up analytics retrieved successfully');
  } catch (error) {
    logger.error('Error getting follow-up analytics:', error);
    sendError(res, 'SERVER_ERROR', 'Failed to retrieve follow-up analytics', 500);
  }
};

/**
 * Get reminder effectiveness analytics
 */
export const getReminderAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const workplaceId = req.user?.workplaceId;
    const {
      startDate: startDateParam,
      endDate: endDateParam,
      channel,
      templateId
    } = req.query;

    const startDate = startDateParam 
      ? parseISO(startDateParam as string)
      : subDays(new Date(), 30);
    const endDate = endDateParam 
      ? parseISO(endDateParam as string)
      : new Date();

    // Get appointments with reminders in the date range
    const appointmentsWithReminders = await Appointment.find({
      workplaceId: new mongoose.Types.ObjectId(workplaceId),
      scheduledDate: {
        $gte: startOfDay(startDate),
        $lte: endOfDay(endDate)
      },
      'reminders.0': { $exists: true }
    }).catch(err => {
      logger.warn('Error fetching appointments with reminders:', err);
      return [];
    });

    // Calculate reminder analytics
    const analytics = await calculateReminderAnalytics(
      appointmentsWithReminders || [],
      channel as string,
      templateId as string
    );

    sendSuccess(res, analytics, 'Reminder analytics retrieved successfully');
  } catch (error) {
    logger.error('Error getting reminder analytics:', error);
    // Return empty analytics instead of error
    const emptyAnalytics: ReminderAnalytics = {
      summary: {
        totalReminders: 0,
        deliverySuccessRate: 0,
        patientResponseRate: 0,
        impactOnNoShowRate: 0
      },
      byChannel: [],
      byTiming: [],
      templatePerformance: [],
      trends: { daily: [] }
    };
    sendSuccess(res, emptyAnalytics, 'No reminder data available');
  }
};

/**
 * Get capacity utilization analytics
 */
export const getCapacityAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const workplaceId = req.user?.workplaceId;
    const {
      startDate: startDateParam,
      endDate: endDateParam,
      pharmacistId,
      locationId
    } = req.query;

    const startDate = startDateParam 
      ? parseISO(startDateParam as string)
      : subDays(new Date(), 7); // Default to last week
    const endDate = endDateParam 
      ? parseISO(endDateParam as string)
      : new Date();

    // Get pharmacist schedules
    const scheduleQuery: any = {
      workplaceId: new mongoose.Types.ObjectId(workplaceId),
      isActive: true
    };

    if (pharmacistId) {
      scheduleQuery.pharmacistId = new mongoose.Types.ObjectId(pharmacistId as string);
    }

    if (locationId) {
      scheduleQuery.locationId = locationId;
    }

    const schedules = await PharmacistSchedule.find(scheduleQuery)
      .populate('pharmacistId', 'firstName lastName')
      .catch(err => {
        logger.warn('Error fetching pharmacist schedules:', err);
        return [];
      });

    // Get appointments for the period
    const appointmentQuery: any = {
      workplaceId: new mongoose.Types.ObjectId(workplaceId),
      scheduledDate: {
        $gte: startOfDay(startDate),
        $lte: endOfDay(endDate)
      },
      status: { $nin: ['cancelled'] }
    };

    if (pharmacistId) {
      appointmentQuery.assignedTo = new mongoose.Types.ObjectId(pharmacistId as string);
    }

    if (locationId) {
      appointmentQuery.locationId = locationId;
    }

    const appointments = await Appointment.find(appointmentQuery);

    // Calculate capacity analytics
    const analytics = await calculateCapacityAnalytics(
      schedules || [],
      appointments,
      startDate,
      endDate
    );

    sendSuccess(res, analytics, 'Capacity analytics retrieved successfully');
  } catch (error) {
    logger.error('Error getting capacity analytics:', error);
    // Return empty analytics instead of error
    const emptyAnalytics: CapacityAnalytics = {
      overall: {
        totalSlots: 0,
        bookedSlots: 0,
        utilizationRate: 0,
        availableSlots: 0
      },
      byPharmacist: [],
      byDay: [],
      byHour: [],
      recommendations: ['No capacity data available. Please configure pharmacist schedules.']
    };
    sendSuccess(res, emptyAnalytics, 'No capacity data available');
  }
};

/**
 * Export appointment analytics to PDF/Excel
 */
export const exportAppointmentAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const { format: exportFormat = 'pdf' } = req.body;
    const workplaceId = req.user?.workplaceId;

    // Get analytics data (reuse the logic from getAppointmentAnalytics)
    const analyticsData = await getAnalyticsDataForExport(workplaceId?.toString(), req.query);

    if (exportFormat === 'pdf') {
      const pdfBuffer = await generatePDFReport(analyticsData);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="appointment-analytics.pdf"');
      res.send(pdfBuffer);
    } else if (exportFormat === 'excel') {
      const excelBuffer = await generateExcelReport(analyticsData);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="appointment-analytics.xlsx"');
      res.send(excelBuffer);
    } else {
      sendError(res, 'BAD_REQUEST', 'Invalid export format. Supported formats: pdf, excel', 400);
    }
  } catch (error) {
    logger.error('Error exporting appointment analytics:', error);
    sendError(res, 'SERVER_ERROR', 'Failed to export appointment analytics', 500);
  }
};

// Helper functions

async function generateAppointmentTrends(appointments: any[], startDate: Date, endDate: Date) {
  // Generate daily trends
  const dailyTrends = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const dayAppointments = appointments.filter(a => 
      format(a.scheduledDate, 'yyyy-MM-dd') === format(currentDate, 'yyyy-MM-dd')
    );
    
    dailyTrends.push({
      date: format(currentDate, 'yyyy-MM-dd'),
      appointments: dayAppointments.length,
      completed: dayAppointments.filter(a => a.status === 'completed').length,
      cancelled: dayAppointments.filter(a => a.status === 'cancelled').length,
      noShow: dayAppointments.filter(a => a.status === 'no_show').length
    });
    
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Generate weekly and monthly trends (simplified for now)
  const weekly = [];
  const monthly = [];

  return { daily: dailyTrends, weekly, monthly };
}

function calculatePeakTimes(appointments: any[]) {
  // Calculate hourly distribution
  const hourlyDistribution = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: 0
  }));

  // Calculate daily distribution
  const dailyDistribution = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
  ].map(day => ({ day, count: 0 }));

  appointments.forEach(appointment => {
    // Extract hour from scheduledTime
    const [hour] = appointment.scheduledTime.split(':').map(Number);
    hourlyDistribution[hour].count++;

    // Extract day of week
    const dayOfWeek = appointment.scheduledDate.getDay();
    dailyDistribution[dayOfWeek].count++;
  });

  // Find busiest hour and day
  const busiestHourData = hourlyDistribution.reduce((max, current) => 
    current.count > max.count ? current : max
  );
  const busiestDayData = dailyDistribution.reduce((max, current) => 
    current.count > max.count ? current : max
  );

  return {
    busiestDay: busiestDayData.day,
    busiestHour: `${busiestHourData.hour.toString().padStart(2, '0')}:00-${(busiestHourData.hour + 1).toString().padStart(2, '0')}:00`,
    hourlyDistribution,
    dailyDistribution
  };
}

function calculatePharmacistPerformance(appointments: any[]) {
  const pharmacistGroups = appointments.reduce((acc, appointment) => {
    const pharmacistId = appointment.assignedTo._id.toString();
    if (!acc[pharmacistId]) {
      acc[pharmacistId] = {
        pharmacistId,
        pharmacistName: `${appointment.assignedTo.firstName} ${appointment.assignedTo.lastName}`,
        appointments: []
      };
    }
    acc[pharmacistId].appointments.push(appointment);
    return acc;
  }, {} as Record<string, any>);

  return Object.values(pharmacistGroups).map((group: any) => {
    const completed = group.appointments.filter((a: any) => a.status === 'completed').length;
    const avgDuration = group.appointments.length > 0
      ? Math.round(group.appointments.reduce((sum: number, a: any) => sum + a.duration, 0) / group.appointments.length)
      : 0;

    return {
      pharmacistId: group.pharmacistId,
      pharmacistName: group.pharmacistName,
      totalAppointments: group.appointments.length,
      completionRate: group.appointments.length > 0 
        ? Math.round((completed / group.appointments.length) * 100)
        : 0,
      averageDuration: avgDuration,
      patientSatisfaction: undefined // TODO: Implement patient satisfaction tracking
    };
  });
}

async function generateFollowUpTypeAnalytics(tasks: any[]) {
  const typeGroups = tasks.reduce((acc, task) => {
    const type = task.type;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(task);
    return acc;
  }, {} as Record<string, typeof tasks>);

  return Object.entries(typeGroups).map(([type, typeTasks]) => {
    const tasks = typeTasks as any[];
    const completed = tasks.filter(t => t.status === 'completed').length;
    const completedWithTime = tasks.filter(t => 
      t.status === 'completed' && t.completedAt && t.createdAt
    );
    
    const averageTimeToCompletion = completedWithTime.length > 0
      ? Math.round(completedWithTime.reduce((sum, t) => {
          const diffMs = t.completedAt.getTime() - t.createdAt.getTime();
          return sum + (diffMs / (1000 * 60 * 60 * 24));
        }, 0) / completedWithTime.length * 10) / 10
      : 0;

    return {
      type,
      count: tasks.length,
      completionRate: tasks.length > 0 
        ? Math.round((completed / tasks.length) * 100)
        : 0,
      averageTimeToCompletion
    };
  });
}

async function generateFollowUpPriorityAnalytics(tasks: any[]) {
  const priorityGroups = tasks.reduce((acc, task) => {
    const priority = task.priority;
    if (!acc[priority]) {
      acc[priority] = [];
    }
    acc[priority].push(task);
    return acc;
  }, {} as Record<string, typeof tasks>);

  return Object.entries(priorityGroups).map(([priority, priorityTasks]) => {
    const tasks = priorityTasks as any[];
    const completed = tasks.filter(t => t.status === 'completed').length;
    const completedWithTime = tasks.filter(t => 
      t.status === 'completed' && t.completedAt && t.createdAt
    );
    
    const averageTimeToCompletion = completedWithTime.length > 0
      ? Math.round(completedWithTime.reduce((sum, t) => {
          const diffMs = t.completedAt.getTime() - t.createdAt.getTime();
          return sum + (diffMs / (1000 * 60 * 60 * 24));
        }, 0) / completedWithTime.length * 10) / 10
      : 0;

    return {
      priority,
      count: tasks.length,
      completionRate: tasks.length > 0 
        ? Math.round((completed / tasks.length) * 100)
        : 0,
      averageTimeToCompletion
    };
  });
}

async function generateFollowUpTriggerAnalytics(tasks: any[]) {
  const triggerGroups = tasks.reduce((acc, task) => {
    const triggerType = task.trigger.type;
    if (!acc[triggerType]) {
      acc[triggerType] = [];
    }
    acc[triggerType].push(task);
    return acc;
  }, {} as Record<string, typeof tasks>);

  return Object.entries(triggerGroups).map(([triggerType, triggerTasks]) => {
    const tasks = triggerTasks as any[];
    const completed = tasks.filter(t => t.status === 'completed').length;

    return {
      triggerType,
      count: tasks.length,
      completionRate: tasks.length > 0 
        ? Math.round((completed / tasks.length) * 100)
        : 0
    };
  });
}

async function generateFollowUpTrends(tasks: any[], startDate: Date, endDate: Date) {
  // Generate daily trends
  const dailyTrends = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const dayTasks = tasks.filter(t => 
      format(t.createdAt, 'yyyy-MM-dd') === format(currentDate, 'yyyy-MM-dd')
    );
    
    const completedTasks = tasks.filter(t => 
      t.completedAt && format(t.completedAt, 'yyyy-MM-dd') === format(currentDate, 'yyyy-MM-dd')
    );

    const overdueTasks = tasks.filter(t => 
      t.dueDate && format(t.dueDate, 'yyyy-MM-dd') === format(currentDate, 'yyyy-MM-dd') &&
      (t.status === 'overdue' || (t.status === 'pending' && t.dueDate < new Date()))
    );
    
    dailyTrends.push({
      date: format(currentDate, 'yyyy-MM-dd'),
      created: dayTasks.length,
      completed: completedTasks.length,
      overdue: overdueTasks.length
    });
    
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Generate weekly trends (simplified)
  const weekly = [];

  return { daily: dailyTrends, weekly };
}

function calculateEscalationMetrics(tasks: any[]) {
  const tasksWithEscalations = tasks.filter(t => 
    t.escalationHistory && t.escalationHistory.length > 0
  );

  const totalEscalations = tasksWithEscalations.reduce((sum, t) => 
    sum + t.escalationHistory.length, 0
  );

  const escalationRate = tasks.length > 0 
    ? Math.round((tasksWithEscalations.length / tasks.length) * 100)
    : 0;

  // Calculate escalations by priority change
  const escalationsByPriority = [];
  tasksWithEscalations.forEach(task => {
    task.escalationHistory.forEach((escalation: any) => {
      const existing = escalationsByPriority.find(e => 
        e.fromPriority === escalation.fromPriority && 
        e.toPriority === escalation.toPriority
      );
      
      if (existing) {
        existing.count++;
      } else {
        escalationsByPriority.push({
          fromPriority: escalation.fromPriority,
          toPriority: escalation.toPriority,
          count: 1
        });
      }
    });
  });

  return {
    totalEscalations,
    escalationRate,
    averageEscalationTime: 0, // TODO: Calculate based on escalation timestamps
    escalationsByPriority
  };
}

async function calculateReminderAnalytics(appointments: any[], channel?: string, templateId?: string) {
  let allReminders: any[] = [];
  
  appointments.forEach(appointment => {
    if (appointment.reminders && appointment.reminders.length > 0) {
      appointment.reminders.forEach((reminder: any) => {
        if (!channel || reminder.type === channel) {
          allReminders.push({
            ...reminder,
            appointmentId: appointment._id,
            appointmentStatus: appointment.status
          });
        }
      });
    }
  });

  const totalReminders = allReminders.length;
  const deliveredReminders = allReminders.filter(r => r.deliveryStatus === 'delivered').length;
  const failedReminders = allReminders.filter(r => r.deliveryStatus === 'failed').length;

  const deliverySuccessRate = totalReminders > 0 
    ? Math.round((deliveredReminders / totalReminders) * 100)
    : 0;

  // Calculate by channel
  const channelGroups = allReminders.reduce((acc, reminder) => {
    const channel = reminder.type;
    if (!acc[channel]) {
      acc[channel] = { sent: 0, delivered: 0, failed: 0 };
    }
    acc[channel].sent++;
    if (reminder.deliveryStatus === 'delivered') acc[channel].delivered++;
    if (reminder.deliveryStatus === 'failed') acc[channel].failed++;
    return acc;
  }, {} as Record<string, any>);

  const byChannel = Object.entries(channelGroups).map(([channel, stats]: [string, any]) => ({
    channel,
    sent: stats.sent,
    delivered: stats.delivered,
    failed: stats.failed,
    deliveryRate: stats.sent > 0 ? Math.round((stats.delivered / stats.sent) * 100) : 0,
    responseRate: 0 // TODO: Implement response tracking
  }));

  const analytics: ReminderAnalytics = {
    summary: {
      totalReminders,
      deliverySuccessRate,
      patientResponseRate: 0, // TODO: Implement response tracking
      impactOnNoShowRate: 0 // TODO: Calculate impact on no-show rates
    },
    byChannel,
    byTiming: [], // TODO: Implement timing analysis
    templatePerformance: [], // TODO: Implement template performance tracking
    trends: {
      daily: [] // TODO: Implement daily trends
    }
  };

  return analytics;
}

async function calculateCapacityAnalytics(
  schedules: any[],
  appointments: any[],
  startDate: Date,
  endDate: Date
) {
  // Calculate overall capacity
  let totalSlots = 0;
  let bookedSlots = appointments.length;

  // Calculate capacity by pharmacist
  const byPharmacist = schedules.map(schedule => {
    // Handle both populated and non-populated pharmacistId
    const pharmacistIdValue = schedule.pharmacistId?._id || schedule.pharmacistId;
    const pharmacistAppointments = appointments.filter(a => 
      a.assignedTo && a.assignedTo.toString() === pharmacistIdValue.toString()
    );

    // Calculate available slots based on working hours (simplified)
    const workingHours = schedule.get('totalWeeklyHours') || 40;
    const slotsPerHour = 2; // Assume 30-minute slots
    const pharmacistTotalSlots = Math.floor(workingHours * slotsPerHour);
    
    totalSlots += pharmacistTotalSlots;

    // Handle populated pharmacist data
    const pharmacistName = schedule.pharmacistId?.firstName 
      ? `${schedule.pharmacistId.firstName} ${schedule.pharmacistId.lastName}`
      : 'Unknown Pharmacist';

    return {
      pharmacistId: pharmacistIdValue.toString(),
      pharmacistName,
      totalSlots: pharmacistTotalSlots,
      bookedSlots: pharmacistAppointments.length,
      utilizationRate: pharmacistTotalSlots > 0 
        ? Math.round((pharmacistAppointments.length / pharmacistTotalSlots) * 100)
        : 0,
      workingHours
    };
  });

  const utilizationRate = totalSlots > 0 
    ? Math.round((bookedSlots / totalSlots) * 100)
    : 0;

  // Generate recommendations
  const recommendations = [];
  if (utilizationRate > 90) {
    recommendations.push('Consider adding more appointment slots or pharmacists');
  }
  if (utilizationRate < 50) {
    recommendations.push('Capacity is underutilized - consider marketing or reducing hours');
  }

  const analytics: CapacityAnalytics = {
    overall: {
      totalSlots,
      bookedSlots,
      utilizationRate,
      availableSlots: Math.max(0, totalSlots - bookedSlots)
    },
    byPharmacist,
    byDay: [], // TODO: Implement daily capacity analysis
    byHour: [], // TODO: Implement hourly capacity analysis
    recommendations
  };

  return analytics;
}

async function getAnalyticsDataForExport(workplaceId: string, queryParams: any) {
  // This would reuse the logic from getAppointmentAnalytics
  // For now, return a placeholder
  return {
    summary: {},
    trends: {},
    details: []
  };
}

async function generatePDFReport(data: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument();
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });

      // Generate PDF content
      doc.fontSize(20).text('Appointment Analytics Report', 100, 100);
      doc.fontSize(12).text('Generated on: ' + new Date().toLocaleDateString(), 100, 130);
      
      // Add more content based on data
      doc.text('Summary:', 100, 160);
      doc.text(JSON.stringify(data.summary, null, 2), 100, 180);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

async function generateExcelReport(data: any): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Appointment Analytics');

  // Add headers
  worksheet.addRow(['Metric', 'Value']);
  worksheet.addRow(['Report Generated', new Date().toLocaleDateString()]);
  
  // Add data rows based on analytics data
  if (data.summary) {
    Object.entries(data.summary).forEach(([key, value]) => {
      worksheet.addRow([key, value]);
    });
  }

  return await workbook.xlsx.writeBuffer() as unknown as Buffer;
}