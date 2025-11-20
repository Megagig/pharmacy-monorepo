import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { Parser } from 'json2csv';
import { format } from 'date-fns';
import logger from '../utils/logger';
import Appointment from '../models/Appointment';
import FollowUpTask from '../models/FollowUpTask';
import ReminderTemplate from '../models/ReminderTemplate';
import PharmacistSchedule from '../models/PharmacistSchedule';
import { 
  AppointmentAnalytics, 
  FollowUpAnalytics, 
  ReminderAnalytics, 
  CapacityAnalytics 
} from '../controllers/appointmentAnalyticsController';
import mongoose from 'mongoose';

export interface ReportOptions {
  workplaceId: mongoose.Types.ObjectId;
  startDate: Date;
  endDate: Date;
  pharmacistId?: mongoose.Types.ObjectId;
  locationId?: string;
  appointmentType?: string;
  format: 'pdf' | 'excel' | 'csv';
  includeCharts?: boolean;
  includeDetails?: boolean;
}

export interface AppointmentReportData {
  summary: {
    totalAppointments: number;
    completionRate: number;
    noShowRate: number;
    cancellationRate: number;
    averageDuration: number;
  };
  appointments: Array<{
    id: string;
    patientName: string;
    pharmacistName: string;
    type: string;
    scheduledDate: string;
    scheduledTime: string;
    duration: number;
    status: string;
    outcome?: string;
    notes?: string;
  }>;
  analytics: AppointmentAnalytics;
}

export interface FollowUpReportData {
  summary: {
    totalTasks: number;
    completionRate: number;
    overdueCount: number;
    averageTimeToCompletion: number;
  };
  tasks: Array<{
    id: string;
    patientName: string;
    pharmacistName: string;
    type: string;
    title: string;
    priority: string;
    dueDate: string;
    status: string;
    outcome?: string;
    daysOverdue?: number;
  }>;
  analytics: FollowUpAnalytics;
}

export interface ReminderReportData {
  summary: {
    totalReminders: number;
    deliverySuccessRate: number;
    patientResponseRate: number;
  };
  reminders: Array<{
    appointmentId: string;
    patientName: string;
    channel: string;
    scheduledFor: string;
    sent: boolean;
    deliveryStatus: string;
    sentAt?: string;
  }>;
  analytics: ReminderAnalytics;
}

export interface CapacityReportData {
  summary: {
    totalSlots: number;
    bookedSlots: number;
    utilizationRate: number;
    availableSlots: number;
  };
  pharmacists: Array<{
    pharmacistName: string;
    totalSlots: number;
    bookedSlots: number;
    utilizationRate: number;
    workingHours: number;
  }>;
  analytics: CapacityAnalytics;
}

export class ReportGenerationService {
  /**
   * Generate appointment report
   */
  static async generateAppointmentReport(options: ReportOptions): Promise<Buffer> {
    try {
      logger.info('Generating appointment report', { options });

      const reportData = await this.getAppointmentReportData(options);

      switch (options.format) {
        case 'pdf':
          return await this.generateAppointmentPDF(reportData, options);
        case 'excel':
          return await this.generateAppointmentExcel(reportData, options);
        case 'csv':
          return await this.generateAppointmentCSV(reportData, options);
        default:
          throw new Error(`Unsupported format: ${options.format}`);
      }
    } catch (error) {
      logger.error('Error generating appointment report:', error);
      throw error;
    }
  }

  /**
   * Generate follow-up task report
   */
  static async generateFollowUpReport(options: ReportOptions): Promise<Buffer> {
    try {
      logger.info('Generating follow-up report', { options });

      const reportData = await this.getFollowUpReportData(options);

      switch (options.format) {
        case 'pdf':
          return await this.generateFollowUpPDF(reportData, options);
        case 'excel':
          return await this.generateFollowUpExcel(reportData, options);
        case 'csv':
          return await this.generateFollowUpCSV(reportData, options);
        default:
          throw new Error(`Unsupported format: ${options.format}`);
      }
    } catch (error) {
      logger.error('Error generating follow-up report:', error);
      throw error;
    }
  }

  /**
   * Generate reminder effectiveness report
   */
  static async generateReminderReport(options: ReportOptions): Promise<Buffer> {
    try {
      logger.info('Generating reminder report', { options });

      const reportData = await this.getReminderReportData(options);

      switch (options.format) {
        case 'pdf':
          return await this.generateReminderPDF(reportData, options);
        case 'excel':
          return await this.generateReminderExcel(reportData, options);
        case 'csv':
          return await this.generateReminderCSV(reportData, options);
        default:
          throw new Error(`Unsupported format: ${options.format}`);
      }
    } catch (error) {
      logger.error('Error generating reminder report:', error);
      throw error;
    }
  }

  /**
   * Generate capacity utilization report
   */
  static async generateCapacityReport(options: ReportOptions): Promise<Buffer> {
    try {
      logger.info('Generating capacity report', { options });

      const reportData = await this.getCapacityReportData(options);

      switch (options.format) {
        case 'pdf':
          return await this.generateCapacityPDF(reportData, options);
        case 'excel':
          return await this.generateCapacityExcel(reportData, options);
        case 'csv':
          return await this.generateCapacityCSV(reportData, options);
        default:
          throw new Error(`Unsupported format: ${options.format}`);
      }
    } catch (error) {
      logger.error('Error generating capacity report:', error);
      throw error;
    }
  }

  /**
   * Get appointment report data
   */
  private static async getAppointmentReportData(options: ReportOptions): Promise<AppointmentReportData> {
    const baseQuery: any = {
      workplaceId: options.workplaceId,
      scheduledDate: {
        $gte: options.startDate,
        $lte: options.endDate
      }
    };

    if (options.pharmacistId) {
      baseQuery.assignedTo = options.pharmacistId;
    }

    if (options.locationId) {
      baseQuery.locationId = options.locationId;
    }

    if (options.appointmentType) {
      baseQuery.type = options.appointmentType;
    }

    const appointments = await Appointment.find(baseQuery)
      .populate('patientId', 'firstName lastName')
      .populate('assignedTo', 'firstName lastName')
      .sort({ scheduledDate: 1, scheduledTime: 1 });

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

    const completedWithDuration = appointments.filter(a => 
      a.status === 'completed' && a.duration
    );
    const averageDuration = completedWithDuration.length > 0
      ? Math.round(completedWithDuration.reduce((sum, a) => sum + a.duration, 0) / completedWithDuration.length)
      : 0;

    // Format appointment data
    const appointmentData = appointments.map(appointment => ({
      id: appointment._id.toString(),
      patientName: `${(appointment.patientId as any).firstName} ${(appointment.patientId as any).lastName}`,
      pharmacistName: `${(appointment.assignedTo as any).firstName} ${(appointment.assignedTo as any).lastName}`,
      type: appointment.type,
      scheduledDate: format(appointment.scheduledDate, 'yyyy-MM-dd'),
      scheduledTime: appointment.scheduledTime,
      duration: appointment.duration,
      status: appointment.status,
      outcome: appointment.outcome?.status,
      notes: appointment.outcome?.notes
    }));

    // Generate analytics (simplified for report)
    const analytics: AppointmentAnalytics = {
      summary: {
        totalAppointments,
        completionRate,
        noShowRate,
        cancellationRate,
        averageWaitTime: 0,
        averageDuration
      },
      byType: [],
      byStatus: [],
      trends: { daily: [], weekly: [], monthly: [] },
      peakTimes: {
        busiestDay: '',
        busiestHour: '',
        hourlyDistribution: [],
        dailyDistribution: []
      },
      pharmacistPerformance: []
    };

    return {
      summary: {
        totalAppointments,
        completionRate,
        noShowRate,
        cancellationRate,
        averageDuration
      },
      appointments: appointmentData,
      analytics
    };
  }

  /**
   * Get follow-up report data
   */
  private static async getFollowUpReportData(options: ReportOptions): Promise<FollowUpReportData> {
    const baseQuery: any = {
      workplaceId: options.workplaceId,
      createdAt: {
        $gte: options.startDate,
        $lte: options.endDate
      }
    };

    if (options.pharmacistId) {
      baseQuery.assignedTo = options.pharmacistId;
    }

    if (options.locationId) {
      baseQuery.locationId = options.locationId;
    }

    const tasks = await FollowUpTask.find(baseQuery)
      .populate('patientId', 'firstName lastName')
      .populate('assignedTo', 'firstName lastName')
      .sort({ dueDate: 1, priority: -1 });

    // Calculate summary metrics
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const overdueTasks = tasks.filter(t => 
      t.status === 'overdue' || (t.status === 'pending' && t.dueDate < new Date())
    ).length;

    const completionRate = totalTasks > 0 
      ? Math.round((completedTasks / totalTasks) * 100)
      : 0;

    const completedWithTime = tasks.filter(t => 
      t.status === 'completed' && t.completedAt && t.createdAt
    );
    const averageTimeToCompletion = completedWithTime.length > 0
      ? Math.round(completedWithTime.reduce((sum, t) => {
          const diffMs = t.completedAt!.getTime() - t.createdAt.getTime();
          return sum + (diffMs / (1000 * 60 * 60 * 24));
        }, 0) / completedWithTime.length * 10) / 10
      : 0;

    // Format task data
    const taskData = tasks.map(task => {
      const daysOverdue = task.status === 'overdue' || (task.status === 'pending' && task.dueDate < new Date())
        ? Math.ceil((new Date().getTime() - task.dueDate.getTime()) / (1000 * 60 * 60 * 24))
        : undefined;

      return {
        id: task._id.toString(),
        patientName: `${(task.patientId as any).firstName} ${(task.patientId as any).lastName}`,
        pharmacistName: `${(task.assignedTo as any).firstName} ${(task.assignedTo as any).lastName}`,
        type: task.type,
        title: task.title,
        priority: task.priority,
        dueDate: format(task.dueDate, 'yyyy-MM-dd'),
        status: task.status,
        outcome: task.outcome?.status,
        daysOverdue
      };
    });

    // Generate analytics (simplified for report)
    const analytics: FollowUpAnalytics = {
      summary: {
        totalTasks,
        completionRate,
        averageTimeToCompletion,
        overdueCount: overdueTasks,
        criticalOverdueCount: 0
      },
      byType: [],
      byPriority: [],
      byTrigger: [],
      trends: { daily: [], weekly: [] },
      escalationMetrics: {
        totalEscalations: 0,
        escalationRate: 0,
        averageEscalationTime: 0,
        escalationsByPriority: []
      }
    };

    return {
      summary: {
        totalTasks,
        completionRate,
        overdueCount: overdueTasks,
        averageTimeToCompletion
      },
      tasks: taskData,
      analytics
    };
  }

  /**
   * Get reminder report data
   */
  private static async getReminderReportData(options: ReportOptions): Promise<ReminderReportData> {
    const baseQuery: any = {
      workplaceId: options.workplaceId,
      scheduledDate: {
        $gte: options.startDate,
        $lte: options.endDate
      },
      'reminders.0': { $exists: true }
    };

    if (options.pharmacistId) {
      baseQuery.assignedTo = options.pharmacistId;
    }

    if (options.locationId) {
      baseQuery.locationId = options.locationId;
    }

    const appointments = await Appointment.find(baseQuery)
      .populate('patientId', 'firstName lastName')
      .sort({ scheduledDate: 1 });

    let allReminders: any[] = [];
    
    appointments.forEach(appointment => {
      if (appointment.reminders && appointment.reminders.length > 0) {
        appointment.reminders.forEach((reminder: any) => {
          allReminders.push({
            appointmentId: appointment._id.toString(),
            patientName: `${(appointment.patientId as any).firstName} ${(appointment.patientId as any).lastName}`,
            channel: reminder.type,
            scheduledFor: format(reminder.scheduledFor, 'yyyy-MM-dd HH:mm'),
            sent: reminder.sent,
            deliveryStatus: reminder.deliveryStatus || 'pending',
            sentAt: reminder.sentAt ? format(reminder.sentAt, 'yyyy-MM-dd HH:mm') : undefined
          });
        });
      }
    });

    const totalReminders = allReminders.length;
    const deliveredReminders = allReminders.filter(r => r.deliveryStatus === 'delivered').length;
    const deliverySuccessRate = totalReminders > 0 
      ? Math.round((deliveredReminders / totalReminders) * 100)
      : 0;

    // Generate analytics (simplified for report)
    const analytics: ReminderAnalytics = {
      summary: {
        totalReminders,
        deliverySuccessRate,
        patientResponseRate: 0,
        impactOnNoShowRate: 0
      },
      byChannel: [],
      byTiming: [],
      templatePerformance: [],
      trends: { daily: [] }
    };

    return {
      summary: {
        totalReminders,
        deliverySuccessRate,
        patientResponseRate: 0
      },
      reminders: allReminders,
      analytics
    };
  }

  /**
   * Get capacity report data
   */
  private static async getCapacityReportData(options: ReportOptions): Promise<CapacityReportData> {
    const scheduleQuery: any = {
      workplaceId: options.workplaceId,
      isActive: true
    };

    if (options.pharmacistId) {
      scheduleQuery.pharmacistId = options.pharmacistId;
    }

    if (options.locationId) {
      scheduleQuery.locationId = options.locationId;
    }

    const schedules = await PharmacistSchedule.find(scheduleQuery)
      .populate('pharmacistId', 'firstName lastName');

    const appointmentQuery: any = {
      workplaceId: options.workplaceId,
      scheduledDate: {
        $gte: options.startDate,
        $lte: options.endDate
      },
      status: { $nin: ['cancelled'] }
    };

    if (options.pharmacistId) {
      appointmentQuery.assignedTo = options.pharmacistId;
    }

    if (options.locationId) {
      appointmentQuery.locationId = options.locationId;
    }

    const appointments = await Appointment.find(appointmentQuery);

    let totalSlots = 0;
    const bookedSlots = appointments.length;

    const pharmacistData = schedules.map(schedule => {
      const pharmacistAppointments = appointments.filter(a => 
        a.assignedTo.toString() === schedule.pharmacistId.toString()
      );

      // Calculate available slots based on working hours (simplified)
      const workingHours = 40; // Default weekly hours
      const slotsPerHour = 2; // Assume 30-minute slots
      const pharmacistTotalSlots = Math.floor(workingHours * slotsPerHour);
      
      totalSlots += pharmacistTotalSlots;

      return {
        pharmacistName: `${(schedule.pharmacistId as any).firstName} ${(schedule.pharmacistId as any).lastName}`,
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

    // Generate analytics (simplified for report)
    const analytics: CapacityAnalytics = {
      overall: {
        totalSlots,
        bookedSlots,
        utilizationRate,
        availableSlots: Math.max(0, totalSlots - bookedSlots)
      },
      byPharmacist: [],
      byDay: [],
      byHour: [],
      recommendations: []
    };

    return {
      summary: {
        totalSlots,
        bookedSlots,
        utilizationRate,
        availableSlots: Math.max(0, totalSlots - bookedSlots)
      },
      pharmacists: pharmacistData,
      analytics
    };
  }

  /**
   * Generate appointment PDF report
   */
  private static async generateAppointmentPDF(
    data: AppointmentReportData, 
    options: ReportOptions
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        });

        // Header
        doc.fontSize(20).text('Appointment Report', { align: 'center' });
        doc.fontSize(12).text(`Period: ${format(options.startDate, 'MMM dd, yyyy')} - ${format(options.endDate, 'MMM dd, yyyy')}`, { align: 'center' });
        doc.moveDown(2);

        // Summary section
        doc.fontSize(16).text('Summary', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12);
        doc.text(`Total Appointments: ${data.summary.totalAppointments}`);
        doc.text(`Completion Rate: ${data.summary.completionRate}%`);
        doc.text(`No-Show Rate: ${data.summary.noShowRate}%`);
        doc.text(`Cancellation Rate: ${data.summary.cancellationRate}%`);
        doc.text(`Average Duration: ${data.summary.averageDuration} minutes`);
        doc.moveDown(2);

        // Appointments table
        if (options.includeDetails && data.appointments.length > 0) {
          doc.fontSize(16).text('Appointment Details', { underline: true });
          doc.moveDown(0.5);
          doc.fontSize(10);

          // Table headers
          const tableTop = doc.y;
          const col1 = 50;
          const col2 = 150;
          const col3 = 250;
          const col4 = 320;
          const col5 = 380;
          const col6 = 450;

          doc.text('Patient', col1, tableTop);
          doc.text('Pharmacist', col2, tableTop);
          doc.text('Type', col3, tableTop);
          doc.text('Date', col4, tableTop);
          doc.text('Time', col5, tableTop);
          doc.text('Status', col6, tableTop);

          // Draw line under headers
          doc.moveTo(col1, doc.y + 5).lineTo(500, doc.y + 5).stroke();
          doc.moveDown(0.5);

          // Table rows
          data.appointments.slice(0, 20).forEach((appointment, index) => {
            const y = doc.y;
            
            if (y > 700) { // Start new page if needed
              doc.addPage();
              doc.y = 50;
            }

            doc.text(appointment.patientName.substring(0, 15), col1, doc.y);
            doc.text(appointment.pharmacistName.substring(0, 15), col2, doc.y);
            doc.text(appointment.type.substring(0, 10), col3, doc.y);
            doc.text(appointment.scheduledDate, col4, doc.y);
            doc.text(appointment.scheduledTime, col5, doc.y);
            doc.text(appointment.status, col6, doc.y);
            doc.moveDown(0.3);
          });

          if (data.appointments.length > 20) {
            doc.moveDown(0.5);
            doc.text(`... and ${data.appointments.length - 20} more appointments`);
          }
        }

        // Footer
        doc.fontSize(8).text(`Generated on ${format(new Date(), 'MMM dd, yyyy HH:mm')}`, 50, 750, { align: 'center' });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate appointment Excel report
   */
  private static async generateAppointmentExcel(
    data: AppointmentReportData, 
    options: ReportOptions
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    
    // Summary worksheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.addRow(['Appointment Report Summary']);
    summarySheet.addRow([`Period: ${format(options.startDate, 'MMM dd, yyyy')} - ${format(options.endDate, 'MMM dd, yyyy')}`]);
    summarySheet.addRow([]);
    summarySheet.addRow(['Metric', 'Value']);
    summarySheet.addRow(['Total Appointments', data.summary.totalAppointments]);
    summarySheet.addRow(['Completion Rate', `${data.summary.completionRate}%`]);
    summarySheet.addRow(['No-Show Rate', `${data.summary.noShowRate}%`]);
    summarySheet.addRow(['Cancellation Rate', `${data.summary.cancellationRate}%`]);
    summarySheet.addRow(['Average Duration', `${data.summary.averageDuration} minutes`]);

    // Style the summary sheet
    summarySheet.getCell('A1').font = { bold: true, size: 16 };
    summarySheet.getCell('A4').font = { bold: true };
    summarySheet.getCell('B4').font = { bold: true };

    // Details worksheet
    if (options.includeDetails) {
      const detailsSheet = workbook.addWorksheet('Appointment Details');
      
      // Headers
      detailsSheet.addRow([
        'Patient Name',
        'Pharmacist Name',
        'Type',
        'Scheduled Date',
        'Scheduled Time',
        'Duration (min)',
        'Status',
        'Outcome',
        'Notes'
      ]);

      // Style headers
      const headerRow = detailsSheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // Data rows
      data.appointments.forEach(appointment => {
        detailsSheet.addRow([
          appointment.patientName,
          appointment.pharmacistName,
          appointment.type,
          appointment.scheduledDate,
          appointment.scheduledTime,
          appointment.duration,
          appointment.status,
          appointment.outcome || '',
          appointment.notes || ''
        ]);
      });

      // Auto-fit columns
      detailsSheet.columns.forEach(column => {
        column.width = 15;
      });
    }

    return await workbook.xlsx.writeBuffer() as unknown as Buffer;
  }

  /**
   * Generate appointment CSV report
   */
  private static async generateAppointmentCSV(
    data: AppointmentReportData, 
    options: ReportOptions
  ): Promise<Buffer> {
    const fields = [
      'patientName',
      'pharmacistName',
      'type',
      'scheduledDate',
      'scheduledTime',
      'duration',
      'status',
      'outcome',
      'notes'
    ];

    const opts = { fields };
    const parser = new Parser(opts);
    const csv = parser.parse(data.appointments);

    return Buffer.from(csv, 'utf8');
  }
  
/**
   * Generate follow-up PDF report
   */
  private static async generateFollowUpPDF(
    data: FollowUpReportData, 
    options: ReportOptions
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        });

        // Header
        doc.fontSize(20).text('Follow-up Tasks Report', { align: 'center' });
        doc.fontSize(12).text(`Period: ${format(options.startDate, 'MMM dd, yyyy')} - ${format(options.endDate, 'MMM dd, yyyy')}`, { align: 'center' });
        doc.moveDown(2);

        // Summary section
        doc.fontSize(16).text('Summary', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12);
        doc.text(`Total Tasks: ${data.summary.totalTasks}`);
        doc.text(`Completion Rate: ${data.summary.completionRate}%`);
        doc.text(`Overdue Tasks: ${data.summary.overdueCount}`);
        doc.text(`Average Time to Completion: ${data.summary.averageTimeToCompletion} days`);
        doc.moveDown(2);

        // Tasks table
        if (options.includeDetails && data.tasks.length > 0) {
          doc.fontSize(16).text('Task Details', { underline: true });
          doc.moveDown(0.5);
          doc.fontSize(10);

          // Table headers
          const tableTop = doc.y;
          const col1 = 50;
          const col2 = 140;
          const col3 = 220;
          const col4 = 280;
          const col5 = 340;
          const col6 = 400;
          const col7 = 460;

          doc.text('Patient', col1, tableTop);
          doc.text('Pharmacist', col2, tableTop);
          doc.text('Type', col3, tableTop);
          doc.text('Priority', col4, tableTop);
          doc.text('Due Date', col5, tableTop);
          doc.text('Status', col6, tableTop);
          doc.text('Overdue', col7, tableTop);

          // Draw line under headers
          doc.moveTo(col1, doc.y + 5).lineTo(520, doc.y + 5).stroke();
          doc.moveDown(0.5);

          // Table rows
          data.tasks.slice(0, 20).forEach((task, index) => {
            const y = doc.y;
            
            if (y > 700) { // Start new page if needed
              doc.addPage();
              doc.y = 50;
            }

            doc.text(task.patientName.substring(0, 12), col1, doc.y);
            doc.text(task.pharmacistName.substring(0, 12), col2, doc.y);
            doc.text(task.type.substring(0, 8), col3, doc.y);
            doc.text(task.priority, col4, doc.y);
            doc.text(task.dueDate, col5, doc.y);
            doc.text(task.status, col6, doc.y);
            doc.text(task.daysOverdue ? `${task.daysOverdue}d` : '-', col7, doc.y);
            doc.moveDown(0.3);
          });

          if (data.tasks.length > 20) {
            doc.moveDown(0.5);
            doc.text(`... and ${data.tasks.length - 20} more tasks`);
          }
        }

        // Footer
        doc.fontSize(8).text(`Generated on ${format(new Date(), 'MMM dd, yyyy HH:mm')}`, 50, 750, { align: 'center' });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate follow-up Excel report
   */
  private static async generateFollowUpExcel(
    data: FollowUpReportData, 
    options: ReportOptions
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    
    // Summary worksheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.addRow(['Follow-up Tasks Report Summary']);
    summarySheet.addRow([`Period: ${format(options.startDate, 'MMM dd, yyyy')} - ${format(options.endDate, 'MMM dd, yyyy')}`]);
    summarySheet.addRow([]);
    summarySheet.addRow(['Metric', 'Value']);
    summarySheet.addRow(['Total Tasks', data.summary.totalTasks]);
    summarySheet.addRow(['Completion Rate', `${data.summary.completionRate}%`]);
    summarySheet.addRow(['Overdue Tasks', data.summary.overdueCount]);
    summarySheet.addRow(['Average Time to Completion', `${data.summary.averageTimeToCompletion} days`]);

    // Style the summary sheet
    summarySheet.getCell('A1').font = { bold: true, size: 16 };
    summarySheet.getCell('A4').font = { bold: true };
    summarySheet.getCell('B4').font = { bold: true };

    // Details worksheet
    if (options.includeDetails) {
      const detailsSheet = workbook.addWorksheet('Task Details');
      
      // Headers
      detailsSheet.addRow([
        'Patient Name',
        'Pharmacist Name',
        'Type',
        'Title',
        'Priority',
        'Due Date',
        'Status',
        'Outcome',
        'Days Overdue'
      ]);

      // Style headers
      const headerRow = detailsSheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // Data rows
      data.tasks.forEach(task => {
        detailsSheet.addRow([
          task.patientName,
          task.pharmacistName,
          task.type,
          task.title,
          task.priority,
          task.dueDate,
          task.status,
          task.outcome || '',
          task.daysOverdue || ''
        ]);
      });

      // Auto-fit columns
      detailsSheet.columns.forEach(column => {
        column.width = 15;
      });
    }

    return await workbook.xlsx.writeBuffer() as unknown as Buffer;
  }

  /**
   * Generate follow-up CSV report
   */
  private static async generateFollowUpCSV(
    data: FollowUpReportData, 
    options: ReportOptions
  ): Promise<Buffer> {
    const fields = [
      'patientName',
      'pharmacistName',
      'type',
      'title',
      'priority',
      'dueDate',
      'status',
      'outcome',
      'daysOverdue'
    ];

    const opts = { fields };
    const parser = new Parser(opts);
    const csv = parser.parse(data.tasks);

    return Buffer.from(csv, 'utf8');
  }

  /**
   * Generate reminder PDF report
   */
  private static async generateReminderPDF(
    data: ReminderReportData, 
    options: ReportOptions
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        });

        // Header
        doc.fontSize(20).text('Reminder Effectiveness Report', { align: 'center' });
        doc.fontSize(12).text(`Period: ${format(options.startDate, 'MMM dd, yyyy')} - ${format(options.endDate, 'MMM dd, yyyy')}`, { align: 'center' });
        doc.moveDown(2);

        // Summary section
        doc.fontSize(16).text('Summary', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12);
        doc.text(`Total Reminders: ${data.summary.totalReminders}`);
        doc.text(`Delivery Success Rate: ${data.summary.deliverySuccessRate}%`);
        doc.text(`Patient Response Rate: ${data.summary.patientResponseRate}%`);
        doc.moveDown(2);

        // Reminders table
        if (options.includeDetails && data.reminders.length > 0) {
          doc.fontSize(16).text('Reminder Details', { underline: true });
          doc.moveDown(0.5);
          doc.fontSize(10);

          // Table headers
          const tableTop = doc.y;
          const col1 = 50;
          const col2 = 140;
          const col3 = 200;
          const col4 = 260;
          const col5 = 340;
          const col6 = 420;

          doc.text('Patient', col1, tableTop);
          doc.text('Channel', col2, tableTop);
          doc.text('Scheduled', col3, tableTop);
          doc.text('Sent', col4, tableTop);
          doc.text('Status', col5, tableTop);
          doc.text('Sent At', col6, tableTop);

          // Draw line under headers
          doc.moveTo(col1, doc.y + 5).lineTo(520, doc.y + 5).stroke();
          doc.moveDown(0.5);

          // Table rows
          data.reminders.slice(0, 20).forEach((reminder, index) => {
            const y = doc.y;
            
            if (y > 700) { // Start new page if needed
              doc.addPage();
              doc.y = 50;
            }

            doc.text(reminder.patientName.substring(0, 12), col1, doc.y);
            doc.text(reminder.channel, col2, doc.y);
            doc.text(reminder.scheduledFor.substring(0, 16), col3, doc.y);
            doc.text(reminder.sent ? 'Yes' : 'No', col4, doc.y);
            doc.text(reminder.deliveryStatus, col5, doc.y);
            doc.text(reminder.sentAt ? reminder.sentAt.substring(0, 16) : '-', col6, doc.y);
            doc.moveDown(0.3);
          });

          if (data.reminders.length > 20) {
            doc.moveDown(0.5);
            doc.text(`... and ${data.reminders.length - 20} more reminders`);
          }
        }

        // Footer
        doc.fontSize(8).text(`Generated on ${format(new Date(), 'MMM dd, yyyy HH:mm')}`, 50, 750, { align: 'center' });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate reminder Excel report
   */
  private static async generateReminderExcel(
    data: ReminderReportData, 
    options: ReportOptions
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    
    // Summary worksheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.addRow(['Reminder Effectiveness Report Summary']);
    summarySheet.addRow([`Period: ${format(options.startDate, 'MMM dd, yyyy')} - ${format(options.endDate, 'MMM dd, yyyy')}`]);
    summarySheet.addRow([]);
    summarySheet.addRow(['Metric', 'Value']);
    summarySheet.addRow(['Total Reminders', data.summary.totalReminders]);
    summarySheet.addRow(['Delivery Success Rate', `${data.summary.deliverySuccessRate}%`]);
    summarySheet.addRow(['Patient Response Rate', `${data.summary.patientResponseRate}%`]);

    // Style the summary sheet
    summarySheet.getCell('A1').font = { bold: true, size: 16 };
    summarySheet.getCell('A4').font = { bold: true };
    summarySheet.getCell('B4').font = { bold: true };

    // Details worksheet
    if (options.includeDetails) {
      const detailsSheet = workbook.addWorksheet('Reminder Details');
      
      // Headers
      detailsSheet.addRow([
        'Appointment ID',
        'Patient Name',
        'Channel',
        'Scheduled For',
        'Sent',
        'Delivery Status',
        'Sent At'
      ]);

      // Style headers
      const headerRow = detailsSheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // Data rows
      data.reminders.forEach(reminder => {
        detailsSheet.addRow([
          reminder.appointmentId,
          reminder.patientName,
          reminder.channel,
          reminder.scheduledFor,
          reminder.sent ? 'Yes' : 'No',
          reminder.deliveryStatus,
          reminder.sentAt || ''
        ]);
      });

      // Auto-fit columns
      detailsSheet.columns.forEach(column => {
        column.width = 15;
      });
    }

    return await workbook.xlsx.writeBuffer() as unknown as Buffer;
  }

  /**
   * Generate reminder CSV report
   */
  private static async generateReminderCSV(
    data: ReminderReportData, 
    options: ReportOptions
  ): Promise<Buffer> {
    const fields = [
      'appointmentId',
      'patientName',
      'channel',
      'scheduledFor',
      'sent',
      'deliveryStatus',
      'sentAt'
    ];

    const opts = { fields };
    const parser = new Parser(opts);
    const csv = parser.parse(data.reminders);

    return Buffer.from(csv, 'utf8');
  }

  /**
   * Generate capacity PDF report
   */
  private static async generateCapacityPDF(
    data: CapacityReportData, 
    options: ReportOptions
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        });

        // Header
        doc.fontSize(20).text('Capacity Utilization Report', { align: 'center' });
        doc.fontSize(12).text(`Period: ${format(options.startDate, 'MMM dd, yyyy')} - ${format(options.endDate, 'MMM dd, yyyy')}`, { align: 'center' });
        doc.moveDown(2);

        // Summary section
        doc.fontSize(16).text('Summary', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12);
        doc.text(`Total Slots: ${data.summary.totalSlots}`);
        doc.text(`Booked Slots: ${data.summary.bookedSlots}`);
        doc.text(`Available Slots: ${data.summary.availableSlots}`);
        doc.text(`Utilization Rate: ${data.summary.utilizationRate}%`);
        doc.moveDown(2);

        // Pharmacist capacity table
        if (options.includeDetails && data.pharmacists.length > 0) {
          doc.fontSize(16).text('Pharmacist Capacity', { underline: true });
          doc.moveDown(0.5);
          doc.fontSize(10);

          // Table headers
          const tableTop = doc.y;
          const col1 = 50;
          const col2 = 180;
          const col3 = 260;
          const col4 = 340;
          const col5 = 420;

          doc.text('Pharmacist', col1, tableTop);
          doc.text('Total Slots', col2, tableTop);
          doc.text('Booked Slots', col3, tableTop);
          doc.text('Utilization %', col4, tableTop);
          doc.text('Working Hours', col5, tableTop);

          // Draw line under headers
          doc.moveTo(col1, doc.y + 5).lineTo(500, doc.y + 5).stroke();
          doc.moveDown(0.5);

          // Table rows
          data.pharmacists.forEach((pharmacist, index) => {
            const y = doc.y;
            
            if (y > 700) { // Start new page if needed
              doc.addPage();
              doc.y = 50;
            }

            doc.text(pharmacist.pharmacistName.substring(0, 20), col1, doc.y);
            doc.text(pharmacist.totalSlots.toString(), col2, doc.y);
            doc.text(pharmacist.bookedSlots.toString(), col3, doc.y);
            doc.text(`${pharmacist.utilizationRate}%`, col4, doc.y);
            doc.text(`${pharmacist.workingHours}h`, col5, doc.y);
            doc.moveDown(0.3);
          });
        }

        // Footer
        doc.fontSize(8).text(`Generated on ${format(new Date(), 'MMM dd, yyyy HH:mm')}`, 50, 750, { align: 'center' });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate capacity Excel report
   */
  private static async generateCapacityExcel(
    data: CapacityReportData, 
    options: ReportOptions
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    
    // Summary worksheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.addRow(['Capacity Utilization Report Summary']);
    summarySheet.addRow([`Period: ${format(options.startDate, 'MMM dd, yyyy')} - ${format(options.endDate, 'MMM dd, yyyy')}`]);
    summarySheet.addRow([]);
    summarySheet.addRow(['Metric', 'Value']);
    summarySheet.addRow(['Total Slots', data.summary.totalSlots]);
    summarySheet.addRow(['Booked Slots', data.summary.bookedSlots]);
    summarySheet.addRow(['Available Slots', data.summary.availableSlots]);
    summarySheet.addRow(['Utilization Rate', `${data.summary.utilizationRate}%`]);

    // Style the summary sheet
    summarySheet.getCell('A1').font = { bold: true, size: 16 };
    summarySheet.getCell('A4').font = { bold: true };
    summarySheet.getCell('B4').font = { bold: true };

    // Details worksheet
    if (options.includeDetails) {
      const detailsSheet = workbook.addWorksheet('Pharmacist Capacity');
      
      // Headers
      detailsSheet.addRow([
        'Pharmacist Name',
        'Total Slots',
        'Booked Slots',
        'Utilization Rate (%)',
        'Working Hours'
      ]);

      // Style headers
      const headerRow = detailsSheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // Data rows
      data.pharmacists.forEach(pharmacist => {
        detailsSheet.addRow([
          pharmacist.pharmacistName,
          pharmacist.totalSlots,
          pharmacist.bookedSlots,
          pharmacist.utilizationRate,
          pharmacist.workingHours
        ]);
      });

      // Auto-fit columns
      detailsSheet.columns.forEach(column => {
        column.width = 15;
      });
    }

    return await workbook.xlsx.writeBuffer() as unknown as Buffer;
  }

  /**
   * Generate capacity CSV report
   */
  private static async generateCapacityCSV(
    data: CapacityReportData, 
    options: ReportOptions
  ): Promise<Buffer> {
    const fields = [
      'pharmacistName',
      'totalSlots',
      'bookedSlots',
      'utilizationRate',
      'workingHours'
    ];

    const opts = { fields };
    const parser = new Parser(opts);
    const csv = parser.parse(data.pharmacists);

    return Buffer.from(csv, 'utf8');
  }
}