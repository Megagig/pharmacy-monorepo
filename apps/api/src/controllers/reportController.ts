import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middlewares/auth';
import { sendSuccess, sendError } from '../utils/responseHelpers';
import logger from '../utils/logger';
import { ReportGenerationService, ReportOptions } from '../services/ReportGenerationService';
import { ReportEmailService, EmailReportOptions } from '../services/ReportEmailService';
import { format, parseISO, subDays } from 'date-fns';

/**
 * Generate and download appointment report
 */
export const generateAppointmentReport = async (req: AuthRequest, res: Response) => {
  try {
    const workplaceId = req.user?.workplaceId;
    const {
      startDate: startDateParam,
      endDate: endDateParam,
      pharmacistId,
      locationId,
      appointmentType,
      format = 'pdf',
      includeCharts = false,
      includeDetails = true
    } = req.body;

    // Validate required fields
    if (!workplaceId) {
      return sendError(res, 'BAD_REQUEST', 'Workplace ID is required', 400);
    }

    // Default to last 30 days if no date range provided
    const startDate = startDateParam 
      ? parseISO(startDateParam)
      : subDays(new Date(), 30);
    const endDate = endDateParam 
      ? parseISO(endDateParam)
      : new Date();

    // Validate date range
    if (startDate > endDate) {
      return sendError(res, 'BAD_REQUEST', 'Start date cannot be after end date', 400);
    }

    const options: ReportOptions = {
      workplaceId: new mongoose.Types.ObjectId(workplaceId),
      startDate,
      endDate,
      format: format as 'pdf' | 'excel' | 'csv',
      includeCharts,
      includeDetails
    };

    if (pharmacistId) {
      options.pharmacistId = new mongoose.Types.ObjectId(pharmacistId);
    }

    if (locationId) {
      options.locationId = locationId;
    }

    if (appointmentType) {
      options.appointmentType = appointmentType;
    }

    logger.info('Generating appointment report', { options });

    const reportBuffer = await ReportGenerationService.generateAppointmentReport(options);

    // Set response headers based on format
    const dateStr = format(new Date(), 'yyyy-MM-dd');
    let filename: string;
    let mimeType: string;

    switch (format) {
      case 'pdf':
        filename = `appointment-report-${dateStr}.pdf`;
        mimeType = 'application/pdf';
        break;
      case 'excel':
        filename = `appointment-report-${dateStr}.xlsx`;
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;
      case 'csv':
        filename = `appointment-report-${dateStr}.csv`;
        mimeType = 'text/csv';
        break;
      default:
        return sendError(res, 'BAD_REQUEST', 'Invalid format. Supported formats: pdf, excel, csv', 400);
    }

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', reportBuffer.length);

    res.send(reportBuffer);

    logger.info('Appointment report generated successfully', { 
      format, 
      filename, 
      size: reportBuffer.length 
    });
  } catch (error) {
    logger.error('Error generating appointment report:', error);
    sendError(res, 'SERVER_ERROR', 'Failed to generate appointment report', 500);
  }
};

/**
 * Generate and download follow-up report
 */
export const generateFollowUpReport = async (req: AuthRequest, res: Response) => {
  try {
    const workplaceId = req.user?.workplaceId;
    const {
      startDate: startDateParam,
      endDate: endDateParam,
      pharmacistId,
      locationId,
      format = 'pdf',
      includeCharts = false,
      includeDetails = true
    } = req.body;

    if (!workplaceId) {
      return sendError(res, 'BAD_REQUEST', 'Workplace ID is required', 400);
    }

    const startDate = startDateParam 
      ? parseISO(startDateParam)
      : subDays(new Date(), 30);
    const endDate = endDateParam 
      ? parseISO(endDateParam)
      : new Date();

    if (startDate > endDate) {
      return sendError(res, 'BAD_REQUEST', 'Start date cannot be after end date', 400);
    }

    const options: ReportOptions = {
      workplaceId: new mongoose.Types.ObjectId(workplaceId),
      startDate,
      endDate,
      format: format as 'pdf' | 'excel' | 'csv',
      includeCharts,
      includeDetails
    };

    if (pharmacistId) {
      options.pharmacistId = new mongoose.Types.ObjectId(pharmacistId);
    }

    if (locationId) {
      options.locationId = locationId;
    }

    logger.info('Generating follow-up report', { options });

    const reportBuffer = await ReportGenerationService.generateFollowUpReport(options);

    const dateStr = format(new Date(), 'yyyy-MM-dd');
    let filename: string;
    let mimeType: string;

    switch (options.format) {
      case 'pdf':
        filename = `followup-report-${dateStr}.pdf`;
        mimeType = 'application/pdf';
        break;
      case 'excel':
        filename = `followup-report-${dateStr}.xlsx`;
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;
      case 'csv':
        filename = `followup-report-${dateStr}.csv`;
        mimeType = 'text/csv';
        break;
    }

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', reportBuffer.length);

    res.send(reportBuffer);

    logger.info('Follow-up report generated successfully', { 
      format: options.format, 
      filename, 
      size: reportBuffer.length 
    });
  } catch (error) {
    logger.error('Error generating follow-up report:', error);
    sendError(res, 'SERVER_ERROR', 'Failed to generate follow-up report', 500);
  }
};

/**
 * Generate and download reminder effectiveness report
 */
export const generateReminderReport = async (req: AuthRequest, res: Response) => {
  try {
    const workplaceId = req.user?.workplaceId;
    const {
      startDate: startDateParam,
      endDate: endDateParam,
      pharmacistId,
      locationId,
      format = 'pdf',
      includeCharts = false,
      includeDetails = true
    } = req.body;

    if (!workplaceId) {
      return sendError(res, 'BAD_REQUEST', 'Workplace ID is required', 400);
    }

    const startDate = startDateParam 
      ? parseISO(startDateParam)
      : subDays(new Date(), 30);
    const endDate = endDateParam 
      ? parseISO(endDateParam)
      : new Date();

    if (startDate > endDate) {
      return sendError(res, 'BAD_REQUEST', 'Start date cannot be after end date', 400);
    }

    const options: ReportOptions = {
      workplaceId: new mongoose.Types.ObjectId(workplaceId),
      startDate,
      endDate,
      format: format as 'pdf' | 'excel' | 'csv',
      includeCharts,
      includeDetails
    };

    if (pharmacistId) {
      options.pharmacistId = new mongoose.Types.ObjectId(pharmacistId);
    }

    if (locationId) {
      options.locationId = locationId;
    }

    logger.info('Generating reminder report', { options });

    const reportBuffer = await ReportGenerationService.generateReminderReport(options);

    const dateStr = format(new Date(), 'yyyy-MM-dd');
    let filename: string;
    let mimeType: string;

    switch (options.format) {
      case 'pdf':
        filename = `reminder-report-${dateStr}.pdf`;
        mimeType = 'application/pdf';
        break;
      case 'excel':
        filename = `reminder-report-${dateStr}.xlsx`;
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;
      case 'csv':
        filename = `reminder-report-${dateStr}.csv`;
        mimeType = 'text/csv';
        break;
    }

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', reportBuffer.length);

    res.send(reportBuffer);

    logger.info('Reminder report generated successfully', { 
      format: options.format, 
      filename, 
      size: reportBuffer.length 
    });
  } catch (error) {
    logger.error('Error generating reminder report:', error);
    sendError(res, 'SERVER_ERROR', 'Failed to generate reminder report', 500);
  }
};

/**
 * Generate and download capacity utilization report
 */
export const generateCapacityReport = async (req: AuthRequest, res: Response) => {
  try {
    const workplaceId = req.user?.workplaceId;
    const {
      startDate: startDateParam,
      endDate: endDateParam,
      pharmacistId,
      locationId,
      format = 'pdf',
      includeCharts = false,
      includeDetails = true
    } = req.body;

    if (!workplaceId) {
      return sendError(res, 'BAD_REQUEST', 'Workplace ID is required', 400);
    }

    const startDate = startDateParam 
      ? parseISO(startDateParam)
      : subDays(new Date(), 7); // Default to last week for capacity
    const endDate = endDateParam 
      ? parseISO(endDateParam)
      : new Date();

    if (startDate > endDate) {
      return sendError(res, 'BAD_REQUEST', 'Start date cannot be after end date', 400);
    }

    const options: ReportOptions = {
      workplaceId: new mongoose.Types.ObjectId(workplaceId),
      startDate,
      endDate,
      format: format as 'pdf' | 'excel' | 'csv',
      includeCharts,
      includeDetails
    };

    if (pharmacistId) {
      options.pharmacistId = new mongoose.Types.ObjectId(pharmacistId);
    }

    if (locationId) {
      options.locationId = locationId;
    }

    logger.info('Generating capacity report', { options });

    const reportBuffer = await ReportGenerationService.generateCapacityReport(options);

    const dateStr = format(new Date(), 'yyyy-MM-dd');
    let filename: string;
    let mimeType: string;

    switch (options.format) {
      case 'pdf':
        filename = `capacity-report-${dateStr}.pdf`;
        mimeType = 'application/pdf';
        break;
      case 'excel':
        filename = `capacity-report-${dateStr}.xlsx`;
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;
      case 'csv':
        filename = `capacity-report-${dateStr}.csv`;
        mimeType = 'text/csv';
        break;
    }

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', reportBuffer.length);

    res.send(reportBuffer);

    logger.info('Capacity report generated successfully', { 
      format: options.format, 
      filename, 
      size: reportBuffer.length 
    });
  } catch (error) {
    logger.error('Error generating capacity report:', error);
    sendError(res, 'SERVER_ERROR', 'Failed to generate capacity report', 500);
  }
};

/**
 * Send report via email
 */
export const emailReport = async (req: AuthRequest, res: Response) => {
  try {
    const workplaceId = req.user?.workplaceId;
    const {
      reportType,
      recipientEmails,
      startDate: startDateParam,
      endDate: endDateParam,
      pharmacistId,
      locationId,
      appointmentType,
      format = 'pdf',
      includeCharts = false,
      includeDetails = true,
      subject,
      message
    } = req.body;

    // Validate required fields
    if (!workplaceId) {
      return sendError(res, 'BAD_REQUEST', 'Workplace ID is required', 400);
    }

    if (!reportType) {
      return sendError(res, 'BAD_REQUEST', 'Report type is required', 400);
    }

    if (!recipientEmails || !Array.isArray(recipientEmails) || recipientEmails.length === 0) {
      return sendError(res, 'BAD_REQUEST', 'At least one recipient email is required', 400);
    }

    // Validate email addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = recipientEmails.filter(email => !emailRegex.test(email));
    if (invalidEmails.length > 0) {
      return sendError(res, 'BAD_REQUEST', `Invalid email addresses: ${invalidEmails.join(', ')}`, 400);
    }

    // Validate report type
    const validReportTypes = ['appointment', 'followup', 'reminder', 'capacity'];
    if (!validReportTypes.includes(reportType)) {
      return sendError(res, 'BAD_REQUEST', `Invalid report type. Supported types: ${validReportTypes.join(', ')}`, 400);
    }

    const startDate = startDateParam 
      ? parseISO(startDateParam)
      : subDays(new Date(), 30);
    const endDate = endDateParam 
      ? parseISO(endDateParam)
      : new Date();

    if (startDate > endDate) {
      return sendError(res, 'BAD_REQUEST', 'Start date cannot be after end date', 400);
    }

    const emailOptions: EmailReportOptions = {
      workplaceId: new mongoose.Types.ObjectId(workplaceId),
      startDate,
      endDate,
      format: format as 'pdf' | 'excel' | 'csv',
      includeCharts,
      includeDetails,
      reportType: reportType as 'appointment' | 'followup' | 'reminder' | 'capacity',
      recipientEmails,
      subject,
      message
    };

    if (pharmacistId) {
      emailOptions.pharmacistId = new mongoose.Types.ObjectId(pharmacistId);
    }

    if (locationId) {
      emailOptions.locationId = locationId;
    }

    if (appointmentType) {
      emailOptions.appointmentType = appointmentType;
    }

    logger.info('Sending report via email', { 
      reportType, 
      recipients: recipientEmails.length,
      format 
    });

    await ReportEmailService.sendReportEmail(emailOptions);

    sendSuccess(res, {
      message: 'Report sent successfully',
      recipients: recipientEmails.length,
      reportType,
      format
    }, 'Report email sent successfully');

    logger.info('Report email sent successfully', { 
      reportType, 
      recipients: recipientEmails.length 
    });
  } catch (error) {
    logger.error('Error sending report email:', error);
    sendError(res, 'SERVER_ERROR', 'Failed to send report email', 500);
  }
};

/**
 * Schedule recurring report
 */
export const scheduleRecurringReport = async (req: AuthRequest, res: Response) => {
  try {
    const workplaceId = req.user?.workplaceId;
    const userId = req.user?._id;
    const {
      reportType,
      recipientEmails,
      schedule,
      pharmacistId,
      locationId,
      appointmentType,
      format = 'pdf',
      includeCharts = false,
      includeDetails = true
    } = req.body;

    // Validate required fields
    if (!workplaceId || !userId) {
      return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    }

    if (!reportType) {
      return sendError(res, 'BAD_REQUEST', 'Report type is required', 400);
    }

    if (!recipientEmails || !Array.isArray(recipientEmails) || recipientEmails.length === 0) {
      return sendError(res, 'BAD_REQUEST', 'At least one recipient email is required', 400);
    }

    if (!schedule || !schedule.frequency || !schedule.time) {
      return sendError(res, 'BAD_REQUEST', 'Schedule configuration is required (frequency and time)', 400);
    }

    // Validate schedule
    const validFrequencies = ['daily', 'weekly', 'monthly'];
    if (!validFrequencies.includes(schedule.frequency)) {
      return sendError(res, 'BAD_REQUEST', `Invalid frequency. Supported: ${validFrequencies.join(', ')}`, 400);
    }

    // Validate time format (HH:mm)
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(schedule.time)) {
      return sendError(res, 'BAD_REQUEST', 'Invalid time format. Use HH:mm (24-hour format)', 400);
    }

    const reportOptions: ReportOptions = {
      workplaceId: new mongoose.Types.ObjectId(workplaceId),
      startDate: new Date(), // Will be calculated dynamically
      endDate: new Date(),   // Will be calculated dynamically
      format: format as 'pdf' | 'excel' | 'csv',
      includeCharts,
      includeDetails
    };

    if (pharmacistId) {
      reportOptions.pharmacistId = new mongoose.Types.ObjectId(pharmacistId);
    }

    if (locationId) {
      reportOptions.locationId = locationId;
    }

    if (appointmentType) {
      reportOptions.appointmentType = appointmentType;
    }

    const scheduledReport = {
      workplaceId: new mongoose.Types.ObjectId(workplaceId),
      reportType: reportType as 'appointment' | 'followup' | 'reminder' | 'capacity',
      recipientEmails,
      schedule,
      options: reportOptions,
      isActive: true,
      createdBy: new mongoose.Types.ObjectId(userId),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await ReportEmailService.scheduleRecurringReport(scheduledReport);

    sendSuccess(res, {
      message: 'Recurring report scheduled successfully',
      reportType,
      frequency: schedule.frequency,
      time: schedule.time,
      recipients: recipientEmails.length
    }, 'Recurring report scheduled successfully');

    logger.info('Recurring report scheduled successfully', { 
      reportType, 
      frequency: schedule.frequency,
      recipients: recipientEmails.length 
    });
  } catch (error) {
    logger.error('Error scheduling recurring report:', error);
    sendError(res, 'SERVER_ERROR', 'Failed to schedule recurring report', 500);
  }
};

/**
 * Test email configuration
 */
export const testEmailConfiguration = async (req: AuthRequest, res: Response) => {
  try {
    const workplaceId = req.user?.workplaceId;
    const { testEmail } = req.body;

    if (!workplaceId) {
      return sendError(res, 'BAD_REQUEST', 'Workplace ID is required', 400);
    }

    if (!testEmail) {
      return sendError(res, 'BAD_REQUEST', 'Test email address is required', 400);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(testEmail)) {
      return sendError(res, 'BAD_REQUEST', 'Invalid email address format', 400);
    }

    logger.info('Testing email configuration', { testEmail });

    // Test email configuration
    const configTest = await ReportEmailService.testEmailConfiguration();
    if (!configTest) {
      return sendError(res, 'SERVER_ERROR', 'Email configuration test failed', 500);
    }

    // Send test report
    await ReportEmailService.sendTestReport(
      testEmail, 
      new mongoose.Types.ObjectId(workplaceId)
    );

    sendSuccess(res, {
      message: 'Test email sent successfully',
      recipient: testEmail
    }, 'Email configuration test successful');

    logger.info('Test email sent successfully', { testEmail });
  } catch (error) {
    logger.error('Error testing email configuration:', error);
    sendError(res, 'SERVER_ERROR', 'Failed to send test email', 500);
  }
};