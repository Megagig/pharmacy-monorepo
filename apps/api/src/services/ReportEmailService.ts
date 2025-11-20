import nodemailer from 'nodemailer';
import { format } from 'date-fns';
import logger from '../utils/logger';
import { ReportGenerationService, ReportOptions } from './ReportGenerationService';
import mongoose from 'mongoose';

export interface EmailReportOptions extends ReportOptions {
  recipientEmails: string[];
  subject?: string;
  message?: string;
  reportType: 'appointment' | 'followup' | 'reminder' | 'capacity';
  scheduledFor?: Date;
}

export interface ScheduledReport {
  _id?: mongoose.Types.ObjectId;
  workplaceId: mongoose.Types.ObjectId;
  reportType: 'appointment' | 'followup' | 'reminder' | 'capacity';
  recipientEmails: string[];
  schedule: {
    frequency: 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number; // 0-6 for weekly
    dayOfMonth?: number; // 1-31 for monthly
    time: string; // HH:mm format
  };
  options: ReportOptions;
  isActive: boolean;
  lastSent?: Date;
  nextScheduled?: Date;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export class ReportEmailService {
  private static transporter: nodemailer.Transporter;

  /**
   * Initialize email transporter
   */
  static initialize() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  /**
   * Send report via email
   */
  static async sendReportEmail(options: EmailReportOptions): Promise<void> {
    try {
      logger.info('Sending report email', { 
        reportType: options.reportType, 
        recipients: options.recipientEmails.length 
      });

      // Generate report
      let reportBuffer: Buffer;
      let filename: string;
      let mimeType: string;

      switch (options.reportType) {
        case 'appointment':
          reportBuffer = await ReportGenerationService.generateAppointmentReport(options);
          break;
        case 'followup':
          reportBuffer = await ReportGenerationService.generateFollowUpReport(options);
          break;
        case 'reminder':
          reportBuffer = await ReportGenerationService.generateReminderReport(options);
          break;
        case 'capacity':
          reportBuffer = await ReportGenerationService.generateCapacityReport(options);
          break;
        default:
          throw new Error(`Unsupported report type: ${options.reportType}`);
      }

      // Set filename and mime type based on format
      const dateStr = format(new Date(), 'yyyy-MM-dd');
      switch (options.format) {
        case 'pdf':
          filename = `${options.reportType}-report-${dateStr}.pdf`;
          mimeType = 'application/pdf';
          break;
        case 'excel':
          filename = `${options.reportType}-report-${dateStr}.xlsx`;
          mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          break;
        case 'csv':
          filename = `${options.reportType}-report-${dateStr}.csv`;
          mimeType = 'text/csv';
          break;
        default:
          throw new Error(`Unsupported format: ${options.format}`);
      }

      // Prepare email content
      const subject = options.subject || this.getDefaultSubject(options.reportType, options.startDate, options.endDate);
      const message = options.message || this.getDefaultMessage(options.reportType, options.startDate, options.endDate);

      // Send email to each recipient
      for (const email of options.recipientEmails) {
        await this.transporter.sendMail({
          from: process.env.SMTP_FROM || 'noreply@pharmacycopilot.com',
          to: email,
          subject,
          html: this.generateEmailHTML(message, options),
          attachments: [
            {
              filename,
              content: reportBuffer,
              contentType: mimeType,
            },
          ],
        });

        logger.info('Report email sent successfully', { 
          recipient: email, 
          reportType: options.reportType,
          filename 
        });
      }
    } catch (error) {
      logger.error('Error sending report email:', error);
      throw error;
    }
  }

  /**
   * Schedule recurring report
   */
  static async scheduleRecurringReport(reportConfig: ScheduledReport): Promise<void> {
    try {
      logger.info('Scheduling recurring report', { 
        reportType: reportConfig.reportType,
        frequency: reportConfig.schedule.frequency 
      });

      // Calculate next scheduled time
      const nextScheduled = this.calculateNextScheduledTime(reportConfig.schedule);
      reportConfig.nextScheduled = nextScheduled;

      // Store in database (assuming we have a ScheduledReport model)
      // This would be implemented with a proper model
      logger.info('Recurring report scheduled', { 
        reportType: reportConfig.reportType,
        nextScheduled: nextScheduled.toISOString()
      });

      // TODO: Add to job queue for processing
      // await this.addToJobQueue(reportConfig);
    } catch (error) {
      logger.error('Error scheduling recurring report:', error);
      throw error;
    }
  }

  /**
   * Process scheduled reports (called by cron job)
   */
  static async processScheduledReports(): Promise<void> {
    try {
      logger.info('Processing scheduled reports');

      // TODO: Fetch scheduled reports from database
      // const scheduledReports = await ScheduledReport.find({
      //   isActive: true,
      //   nextScheduled: { $lte: new Date() }
      // });

      // For now, we'll use a placeholder
      const scheduledReports: ScheduledReport[] = [];

      for (const report of scheduledReports) {
        try {
          await this.sendScheduledReport(report);
          
          // Update last sent and next scheduled
          report.lastSent = new Date();
          report.nextScheduled = this.calculateNextScheduledTime(report.schedule);
          
          // TODO: Save to database
          // await report.save();
          
          logger.info('Scheduled report sent successfully', { 
            reportId: report._id,
            reportType: report.reportType 
          });
        } catch (error) {
          logger.error('Error sending scheduled report:', error, { 
            reportId: report._id,
            reportType: report.reportType 
          });
        }
      }
    } catch (error) {
      logger.error('Error processing scheduled reports:', error);
      throw error;
    }
  }

  /**
   * Send a scheduled report
   */
  private static async sendScheduledReport(reportConfig: ScheduledReport): Promise<void> {
    // Calculate date range based on frequency
    const { startDate, endDate } = this.calculateReportDateRange(reportConfig.schedule.frequency);

    const emailOptions: EmailReportOptions = {
      ...reportConfig.options,
      recipientEmails: reportConfig.recipientEmails,
      reportType: reportConfig.reportType,
      startDate,
      endDate,
      subject: `Scheduled ${reportConfig.reportType} Report - ${format(new Date(), 'MMM dd, yyyy')}`,
    };

    await this.sendReportEmail(emailOptions);
  }

  /**
   * Calculate next scheduled time
   */
  private static calculateNextScheduledTime(schedule: ScheduledReport['schedule']): Date {
    const now = new Date();
    const [hours, minutes] = schedule.time.split(':').map(Number);
    
    let nextDate = new Date();
    nextDate.setHours(hours, minutes, 0, 0);

    switch (schedule.frequency) {
      case 'daily':
        if (nextDate <= now) {
          nextDate.setDate(nextDate.getDate() + 1);
        }
        break;
        
      case 'weekly':
        const targetDay = schedule.dayOfWeek || 1; // Default to Monday
        const currentDay = nextDate.getDay();
        let daysUntilTarget = targetDay - currentDay;
        
        if (daysUntilTarget <= 0 || (daysUntilTarget === 0 && nextDate <= now)) {
          daysUntilTarget += 7;
        }
        
        nextDate.setDate(nextDate.getDate() + daysUntilTarget);
        break;
        
      case 'monthly':
        const targetDayOfMonth = schedule.dayOfMonth || 1;
        nextDate.setDate(targetDayOfMonth);
        
        if (nextDate <= now) {
          nextDate.setMonth(nextDate.getMonth() + 1);
          nextDate.setDate(targetDayOfMonth);
        }
        break;
    }

    return nextDate;
  }

  /**
   * Calculate report date range based on frequency
   */
  private static calculateReportDateRange(frequency: ScheduledReport['schedule']['frequency']): {
    startDate: Date;
    endDate: Date;
  } {
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    
    const startDate = new Date();
    
    switch (frequency) {
      case 'daily':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case 'weekly':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'monthly':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
    }
    
    startDate.setHours(0, 0, 0, 0);
    
    return { startDate, endDate };
  }

  /**
   * Get default email subject
   */
  private static getDefaultSubject(
    reportType: string, 
    startDate: Date, 
    endDate: Date
  ): string {
    const dateRange = `${format(startDate, 'MMM dd')} - ${format(endDate, 'MMM dd, yyyy')}`;
    
    switch (reportType) {
      case 'appointment':
        return `Appointment Report (${dateRange})`;
      case 'followup':
        return `Follow-up Tasks Report (${dateRange})`;
      case 'reminder':
        return `Reminder Effectiveness Report (${dateRange})`;
      case 'capacity':
        return `Capacity Utilization Report (${dateRange})`;
      default:
        return `Report (${dateRange})`;
    }
  }

  /**
   * Get default email message
   */
  private static getDefaultMessage(
    reportType: string, 
    startDate: Date, 
    endDate: Date
  ): string {
    const dateRange = `${format(startDate, 'MMM dd')} - ${format(endDate, 'MMM dd, yyyy')}`;
    
    switch (reportType) {
      case 'appointment':
        return `Please find attached the appointment report for the period ${dateRange}. This report includes appointment statistics, completion rates, and detailed appointment data.`;
      case 'followup':
        return `Please find attached the follow-up tasks report for the period ${dateRange}. This report includes task completion metrics, overdue tasks, and detailed task information.`;
      case 'reminder':
        return `Please find attached the reminder effectiveness report for the period ${dateRange}. This report includes delivery success rates and reminder performance metrics.`;
      case 'capacity':
        return `Please find attached the capacity utilization report for the period ${dateRange}. This report includes pharmacist utilization rates and capacity analysis.`;
      default:
        return `Please find attached the report for the period ${dateRange}.`;
    }
  }

  /**
   * Generate HTML email content
   */
  private static generateEmailHTML(message: string, options: EmailReportOptions): string {
    const dateRange = `${format(options.startDate, 'MMM dd')} - ${format(options.endDate, 'MMM dd, yyyy')}`;
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>PharmacyCopilot Report</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: #2563eb;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 8px 8px 0 0;
          }
          .content {
            background-color: #f8fafc;
            padding: 20px;
            border: 1px solid #e2e8f0;
          }
          .footer {
            background-color: #64748b;
            color: white;
            padding: 15px;
            text-align: center;
            font-size: 12px;
            border-radius: 0 0 8px 8px;
          }
          .report-info {
            background-color: white;
            padding: 15px;
            border-radius: 6px;
            margin: 15px 0;
            border-left: 4px solid #2563eb;
          }
          .attachment-note {
            background-color: #fef3c7;
            border: 1px solid #f59e0b;
            padding: 10px;
            border-radius: 6px;
            margin: 15px 0;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>PharmacyCopilot Report</h1>
          <p>Patient Engagement & Follow-up Management</p>
        </div>
        
        <div class="content">
          <div class="report-info">
            <h3>Report Details</h3>
            <p><strong>Type:</strong> ${options.reportType.charAt(0).toUpperCase() + options.reportType.slice(1)} Report</p>
            <p><strong>Period:</strong> ${dateRange}</p>
            <p><strong>Format:</strong> ${options.format.toUpperCase()}</p>
            <p><strong>Generated:</strong> ${format(new Date(), 'MMM dd, yyyy HH:mm')}</p>
          </div>
          
          <p>${message}</p>
          
          <div class="attachment-note">
            <p><strong>📎 Attachment:</strong> The report is attached to this email in ${options.format.toUpperCase()} format.</p>
          </div>
          
          <p>If you have any questions about this report, please contact your system administrator.</p>
        </div>
        
        <div class="footer">
          <p>This is an automated email from PharmacyCopilot. Please do not reply to this email.</p>
          <p>&copy; ${new Date().getFullYear()} PharmacyCopilot. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Test email configuration
   */
  static async testEmailConfiguration(): Promise<boolean> {
    try {
      if (!this.transporter) {
        this.initialize();
      }

      await this.transporter.verify();
      logger.info('Email configuration test successful');
      return true;
    } catch (error) {
      logger.error('Email configuration test failed:', error);
      return false;
    }
  }

  /**
   * Send test report email
   */
  static async sendTestReport(
    recipientEmail: string, 
    workplaceId: mongoose.Types.ObjectId
  ): Promise<void> {
    const testOptions: EmailReportOptions = {
      workplaceId,
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      endDate: new Date(),
      format: 'pdf',
      reportType: 'appointment',
      recipientEmails: [recipientEmail],
      subject: 'Test Report - PharmacyCopilot',
      message: 'This is a test report to verify email delivery functionality.',
      includeDetails: true
    };

    await this.sendReportEmail(testOptions);
  }
}

// Initialize email service
ReportEmailService.initialize();