/**
 * Alert Service
 * Handles clinical alerts, patient alerts, and dashboard alerts
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import mongoose from 'mongoose';
import Patient, { IPatient } from '../models/Patient';
import Appointment, { IAppointment } from '../models/Appointment';
import FollowUpTask, { IFollowUpTask } from '../models/FollowUpTask';
import User from '../models/User';
import logger from '../utils/logger';
import { notificationService } from './notificationService';

export interface PatientAlert {
  id: string;
  type: 'overdue_appointment' | 'missed_appointment' | 'abnormal_vitals' | 
        'low_adherence' | 'pending_lab_review' | 'overdue_followup' | 
        'preventive_care_due' | 'patient_inactive' | 'low_stock';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  patientId: mongoose.Types.ObjectId;
  patientName: string;
  data: Record<string, any>;
  createdAt: Date;
  dismissedAt?: Date;
  dismissedBy?: mongoose.Types.ObjectId;
  dismissReason?: string;
  actionUrl?: string;
  expiresAt?: Date;
}

export interface DashboardAlert {
  id: string;
  type: 'appointments_today' | 'overdue_followups' | 'high_priority_tasks' | 
        'capacity_warning' | 'system_notification' | 'inventory_alert';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  count?: number;
  data: Record<string, any>;
  createdAt: Date;
  dismissedAt?: Date;
  dismissedBy?: mongoose.Types.ObjectId;
  actionUrl?: string;
  expiresAt?: Date;
}

export interface ClinicalTrigger {
  type: 'medication_start' | 'lab_result' | 'vital_signs' | 'appointment_missed' | 
        'medication_change' | 'hospital_discharge' | 'adherence_check';
  patientId: mongoose.Types.ObjectId;
  sourceId?: mongoose.Types.ObjectId;
  sourceType?: string;
  data: Record<string, any>;
  triggeredAt: Date;
}

export interface AlertFilters {
  severity?: string | string[];
  type?: string | string[];
  patientId?: mongoose.Types.ObjectId;
  dismissed?: boolean;
  startDate?: Date;
  endDate?: Date;
}

export interface AlertOptions {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class AlertService {
  private static patientAlerts: Map<string, PatientAlert> = new Map();
  private static dashboardAlerts: Map<string, DashboardAlert> = new Map();

  /**
   * Get contextual alerts for a specific patient
   * Requirement: 4.1, 4.2
   */
  static async getPatientAlerts(
    patientId: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId,
    filters?: AlertFilters
  ): Promise<PatientAlert[]> {
    try {
      // Get patient data
      const patient = await Patient.findOne({ _id: patientId, workplaceId })
        .populate('latestVitals');

      if (!patient) {
        return [];
      }

      const alerts: PatientAlert[] = [];
      const now = new Date();

      // Check for overdue appointments
      const overdueAppointments = await Appointment.find({
        workplaceId,
        patientId,
        status: 'scheduled',
        scheduledDate: { $lt: now },
        isDeleted: false,
      }).sort({ scheduledDate: -1 }).limit(1);

      if (overdueAppointments.length > 0) {
        const appointment = overdueAppointments[0];
        alerts.push({
          id: `overdue_appointment_${appointment._id}`,
          type: 'overdue_appointment',
          severity: 'high',
          title: 'Overdue Appointment',
          message: `Patient has an overdue appointment scheduled for ${appointment.scheduledDate.toLocaleDateString()}`,
          patientId,
          patientName: patient.name || `${patient.firstName} ${patient.lastName}`,
          data: {
            appointmentId: appointment._id,
            scheduledDate: appointment.scheduledDate,
            appointmentType: appointment.type,
          },
          createdAt: now,
          actionUrl: `/appointments/${appointment._id}`,
          expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days
        });
      }

      // Check for missed appointments
      const missedAppointments = await Appointment.find({
        workplaceId,
        patientId,
        status: 'no_show',
        scheduledDate: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) }, // Last 30 days
        isDeleted: false,
      }).sort({ scheduledDate: -1 }).limit(1);

      if (missedAppointments.length > 0) {
        const appointment = missedAppointments[0];
        alerts.push({
          id: `missed_appointment_${appointment._id}`,
          type: 'missed_appointment',
          severity: 'medium',
          title: 'Missed Appointment',
          message: `Patient missed appointment on ${appointment.scheduledDate.toLocaleDateString()} - consider rescheduling`,
          patientId,
          patientName: patient.name || `${patient.firstName} ${patient.lastName}`,
          data: {
            appointmentId: appointment._id,
            scheduledDate: appointment.scheduledDate,
            appointmentType: appointment.type,
          },
          createdAt: now,
          actionUrl: `/patients/${patientId}/appointments`,
          expiresAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), // 14 days
        });
      }

      // Check for abnormal vitals (elevated BP)
      if (patient.latestVitals?.bpSystolic && patient.latestVitals?.bpDiastolic) {
        const { bpSystolic, bpDiastolic, recordedAt } = patient.latestVitals;
        
        if (bpSystolic >= 140 || bpDiastolic >= 90) {
          // Only alert if reading is recent (within last 3 months)
          const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          if (recordedAt && recordedAt >= threeMonthsAgo) {
            alerts.push({
              id: `abnormal_vitals_${patientId}`,
              type: 'abnormal_vitals',
              severity: bpSystolic >= 160 || bpDiastolic >= 100 ? 'high' : 'medium',
              title: 'Elevated Blood Pressure',
              message: `Last BP reading elevated (${bpSystolic}/${bpDiastolic}) - due for recheck`,
              patientId,
              patientName: patient.name || `${patient.firstName} ${patient.lastName}`,
              data: {
                bpSystolic,
                bpDiastolic,
                recordedAt,
              },
              createdAt: now,
              actionUrl: `/patients/${patientId}/vitals`,
              expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days
            });
          }
        }
      }

      // Check for low medication adherence
      if (patient.engagementMetrics?.followUpCompletionRate !== undefined) {
        const adherenceRate = patient.engagementMetrics.followUpCompletionRate;
        
        if (adherenceRate < 70) {
          alerts.push({
            id: `low_adherence_${patientId}`,
            type: 'low_adherence',
            severity: adherenceRate < 50 ? 'high' : 'medium',
            title: 'Low Adherence Detected',
            message: `Low adherence detected (${adherenceRate.toFixed(1)}%) - counseling recommended`,
            patientId,
            patientName: patient.name || `${patient.firstName} ${patient.lastName}`,
            data: {
              adherenceRate,
              totalFollowUps: patient.engagementMetrics.totalFollowUps,
              completedFollowUps: patient.engagementMetrics.completedFollowUps,
            },
            createdAt: now,
            actionUrl: `/patients/${patientId}/adherence`,
            expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days
          });
        }
      }

      // Check for overdue follow-up tasks
      const overdueFollowUps = await FollowUpTask.find({
        workplaceId,
        patientId,
        status: { $in: ['pending', 'in_progress'] },
        dueDate: { $lt: now },
        isDeleted: false,
      }).sort({ dueDate: 1 });

      if (overdueFollowUps.length > 0) {
        const criticalOverdue = overdueFollowUps.filter(task => {
          const daysPastDue = Math.floor((now.getTime() - task.dueDate.getTime()) / (24 * 60 * 60 * 1000));
          return daysPastDue > 7;
        });

        if (criticalOverdue.length > 0) {
          const task = criticalOverdue[0];
          alerts.push({
            id: `overdue_followup_${task._id}`,
            type: 'overdue_followup',
            severity: 'critical',
            title: 'Critical Overdue Follow-up',
            message: `Follow-up task overdue by more than 7 days: ${task.title}`,
            patientId,
            patientName: patient.name || `${patient.firstName} ${patient.lastName}`,
            data: {
              followUpId: task._id,
              title: task.title,
              dueDate: task.dueDate,
              priority: task.priority,
              daysPastDue: Math.floor((now.getTime() - task.dueDate.getTime()) / (24 * 60 * 60 * 1000)),
            },
            createdAt: now,
            actionUrl: `/follow-ups/${task._id}`,
            expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days
          });
        } else if (overdueFollowUps.length > 0) {
          const task = overdueFollowUps[0];
          alerts.push({
            id: `overdue_followup_${task._id}`,
            type: 'overdue_followup',
            severity: 'high',
            title: 'Overdue Follow-up',
            message: `Follow-up task overdue: ${task.title}`,
            patientId,
            patientName: patient.name || `${patient.firstName} ${patient.lastName}`,
            data: {
              followUpId: task._id,
              title: task.title,
              dueDate: task.dueDate,
              priority: task.priority,
              daysPastDue: Math.floor((now.getTime() - task.dueDate.getTime()) / (24 * 60 * 60 * 1000)),
            },
            createdAt: now,
            actionUrl: `/follow-ups/${task._id}`,
            expiresAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), // 14 days
          });
        }
      }

      // Check for patient inactivity (no appointments in 6 months)
      if (patient.engagementMetrics?.lastEngagementDate) {
        const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        
        if (patient.engagementMetrics.lastEngagementDate < sixMonthsAgo) {
          alerts.push({
            id: `patient_inactive_${patientId}`,
            type: 'patient_inactive',
            severity: 'low',
            title: 'Patient Inactive',
            message: 'Patient inactive - consider outreach',
            patientId,
            patientName: patient.name || `${patient.firstName} ${patient.lastName}`,
            data: {
              lastEngagementDate: patient.engagementMetrics.lastEngagementDate,
              monthsInactive: Math.floor((now.getTime() - patient.engagementMetrics.lastEngagementDate.getTime()) / (30 * 24 * 60 * 60 * 1000)),
            },
            createdAt: now,
            actionUrl: `/patients/${patientId}/engagement`,
            expiresAt: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000), // 90 days
          });
        }
      }

      // Apply filters
      let filteredAlerts = alerts;

      if (filters?.severity) {
        const severities = Array.isArray(filters.severity) ? filters.severity : [filters.severity];
        filteredAlerts = filteredAlerts.filter(alert => severities.includes(alert.severity));
      }

      if (filters?.type) {
        const types = Array.isArray(filters.type) ? filters.type : [filters.type];
        filteredAlerts = filteredAlerts.filter(alert => types.includes(alert.type));
      }

      if (filters?.dismissed !== undefined) {
        filteredAlerts = filteredAlerts.filter(alert => 
          filters.dismissed ? !!alert.dismissedAt : !alert.dismissedAt
        );
      }

      // Sort by severity and creation date
      filteredAlerts.sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
        if (severityDiff !== 0) return severityDiff;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });

      logger.info('Patient alerts generated', {
        patientId: patientId.toString(),
        alertCount: filteredAlerts.length,
        severityBreakdown: filteredAlerts.reduce((acc, alert) => {
          acc[alert.severity] = (acc[alert.severity] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      });

      return filteredAlerts;
    } catch (error) {
      logger.error('Error generating patient alerts', {
        patientId: patientId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get dashboard alerts with aggregation
   * Requirement: 4.5
   */
  static async getDashboardAlerts(
    workplaceId: mongoose.Types.ObjectId,
    userId?: mongoose.Types.ObjectId,
    filters?: AlertFilters
  ): Promise<DashboardAlert[]> {
    try {
      const alerts: DashboardAlert[] = [];
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

      // Today's appointments
      const todayAppointments = await Appointment.countDocuments({
        workplaceId,
        scheduledDate: { $gte: today, $lt: tomorrow },
        status: { $in: ['scheduled', 'confirmed'] },
        isDeleted: false,
        ...(userId && { assignedTo: userId }),
      });

      if (todayAppointments > 0) {
        alerts.push({
          id: `appointments_today_${workplaceId}`,
          type: 'appointments_today',
          severity: todayAppointments > 20 ? 'medium' : 'low',
          title: "Today's Appointments",
          message: `You have ${todayAppointments} appointment${todayAppointments === 1 ? '' : 's'} scheduled for today`,
          count: todayAppointments,
          data: {
            date: today,
            appointmentCount: todayAppointments,
          },
          createdAt: now,
          actionUrl: '/appointments/calendar?view=day',
          expiresAt: tomorrow,
        });
      }

      // Overdue follow-ups
      const overdueFollowUps = await FollowUpTask.countDocuments({
        workplaceId,
        status: { $in: ['pending', 'in_progress'] },
        dueDate: { $lt: now },
        isDeleted: false,
        ...(userId && { assignedTo: userId }),
      });

      if (overdueFollowUps > 0) {
        alerts.push({
          id: `overdue_followups_${workplaceId}`,
          type: 'overdue_followups',
          severity: overdueFollowUps > 10 ? 'high' : 'medium',
          title: 'Overdue Follow-ups',
          message: `${overdueFollowUps} follow-up task${overdueFollowUps === 1 ? ' is' : 's are'} overdue`,
          count: overdueFollowUps,
          data: {
            overdueCount: overdueFollowUps,
          },
          createdAt: now,
          actionUrl: '/follow-ups?status=overdue',
          expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 24 hours
        });
      }

      // High priority tasks
      const highPriorityTasks = await FollowUpTask.countDocuments({
        workplaceId,
        status: { $in: ['pending', 'in_progress'] },
        priority: { $in: ['high', 'urgent', 'critical'] },
        isDeleted: false,
        ...(userId && { assignedTo: userId }),
      });

      if (highPriorityTasks > 0) {
        alerts.push({
          id: `high_priority_tasks_${workplaceId}`,
          type: 'high_priority_tasks',
          severity: 'high',
          title: 'High Priority Tasks',
          message: `${highPriorityTasks} high priority task${highPriorityTasks === 1 ? '' : 's'} require${highPriorityTasks === 1 ? 's' : ''} attention`,
          count: highPriorityTasks,
          data: {
            taskCount: highPriorityTasks,
          },
          createdAt: now,
          actionUrl: '/follow-ups?priority=high,urgent,critical',
          expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 24 hours
        });
      }

      // Apply filters
      let filteredAlerts = alerts;

      if (filters?.severity) {
        const severities = Array.isArray(filters.severity) ? filters.severity : [filters.severity];
        filteredAlerts = filteredAlerts.filter(alert => severities.includes(alert.severity));
      }

      if (filters?.type) {
        const types = Array.isArray(filters.type) ? filters.type : [filters.type];
        filteredAlerts = filteredAlerts.filter(alert => types.includes(alert.type));
      }

      if (filters?.dismissed !== undefined) {
        filteredAlerts = filteredAlerts.filter(alert => 
          filters.dismissed ? !!alert.dismissedAt : !alert.dismissedAt
        );
      }

      // Sort by severity and creation date
      filteredAlerts.sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
        if (severityDiff !== 0) return severityDiff;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });

      logger.info('Dashboard alerts generated', {
        workplaceId: workplaceId.toString(),
        userId: userId?.toString(),
        alertCount: filteredAlerts.length,
      });

      return filteredAlerts;
    } catch (error) {
      logger.error('Error generating dashboard alerts', {
        workplaceId: workplaceId.toString(),
        userId: userId?.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Create a custom alert
   * Requirement: 4.3
   */
  static async createAlert(
    type: 'patient' | 'dashboard',
    alertData: Partial<PatientAlert | DashboardAlert>,
    workplaceId: mongoose.Types.ObjectId,
    createdBy: mongoose.Types.ObjectId
  ): Promise<PatientAlert | DashboardAlert> {
    try {
      const now = new Date();
      const alertId = `custom_${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const baseAlert = {
        id: alertId,
        createdAt: now,
        expiresAt: alertData.expiresAt || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days default
        ...alertData,
      };

      if (type === 'patient') {
        const patientAlert = baseAlert as PatientAlert;
        
        if (!patientAlert.patientId) {
          throw new Error('Patient ID is required for patient alerts');
        }

        // Get patient name if not provided
        if (!patientAlert.patientName) {
          const patient = await Patient.findById(patientAlert.patientId);
          if (patient) {
            patientAlert.patientName = patient.name || `${patient.firstName} ${patient.lastName}`;
          }
        }

        this.patientAlerts.set(alertId, patientAlert);

        logger.info('Patient alert created', {
          alertId,
          patientId: patientAlert.patientId.toString(),
          type: patientAlert.type,
          severity: patientAlert.severity,
          createdBy: createdBy.toString(),
        });

        return patientAlert;
      } else {
        const dashboardAlert = baseAlert as DashboardAlert;
        this.dashboardAlerts.set(alertId, dashboardAlert);

        logger.info('Dashboard alert created', {
          alertId,
          type: dashboardAlert.type,
          severity: dashboardAlert.severity,
          createdBy: createdBy.toString(),
        });

        return dashboardAlert;
      }
    } catch (error) {
      logger.error('Error creating alert', {
        type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Dismiss an alert with reason tracking
   * Requirement: 4.4
   */
  static async dismissAlert(
    alertId: string,
    dismissedBy: mongoose.Types.ObjectId,
    reason?: string
  ): Promise<boolean> {
    try {
      const now = new Date();

      // Check patient alerts
      const patientAlert = this.patientAlerts.get(alertId);
      if (patientAlert) {
        patientAlert.dismissedAt = now;
        patientAlert.dismissedBy = dismissedBy;
        patientAlert.dismissReason = reason;
        this.patientAlerts.set(alertId, patientAlert);

        logger.info('Patient alert dismissed', {
          alertId,
          patientId: patientAlert.patientId.toString(),
          dismissedBy: dismissedBy.toString(),
          reason,
        });

        return true;
      }

      // Check dashboard alerts
      const dashboardAlert = this.dashboardAlerts.get(alertId);
      if (dashboardAlert) {
        dashboardAlert.dismissedAt = now;
        dashboardAlert.dismissedBy = dismissedBy;
        this.dashboardAlerts.set(alertId, dashboardAlert);

        logger.info('Dashboard alert dismissed', {
          alertId,
          dismissedBy: dismissedBy.toString(),
          reason,
        });

        return true;
      }

      logger.warn('Alert not found for dismissal', { alertId });
      return false;
    } catch (error) {
      logger.error('Error dismissing alert', {
        alertId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Monitor clinical triggers and create follow-up tasks
   * Requirement: 4.5
   */
  static async monitorClinicalTriggers(
    workplaceId: mongoose.Types.ObjectId
  ): Promise<void> {
    try {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      logger.info('Starting clinical triggers monitoring', {
        workplaceId: workplaceId.toString(),
      });

      // Monitor for missed appointments that need follow-up
      const missedAppointments = await Appointment.find({
        workplaceId,
        status: 'no_show',
        scheduledDate: { $gte: oneDayAgo, $lt: now },
        isDeleted: false,
      }).populate('patientId');

      for (const appointment of missedAppointments) {
        // Check if follow-up task already exists
        const existingTask = await FollowUpTask.findOne({
          workplaceId,
          patientId: appointment.patientId,
          'trigger.type': 'missed_appointment',
          'trigger.sourceId': appointment._id,
          isDeleted: false,
        });

        if (!existingTask) {
          // Create follow-up task for missed appointment
          const followUpTask = new FollowUpTask({
            workplaceId,
            patientId: appointment.patientId,
            assignedTo: appointment.assignedTo,
            type: 'general_followup',
            title: `Follow-up for missed ${appointment.type} appointment`,
            description: `Patient missed their ${appointment.type} appointment on ${appointment.scheduledDate.toLocaleDateString()}. Please contact patient to reschedule.`,
            objectives: [
              'Contact patient to understand reason for missed appointment',
              'Reschedule appointment if needed',
              'Address any barriers to attendance',
            ],
            priority: 'medium',
            dueDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), // Due in 2 days
            trigger: {
              type: 'missed_appointment',
              sourceId: appointment._id,
              sourceType: 'Appointment',
              triggerDate: now,
              triggerDetails: {
                appointmentType: appointment.type,
                scheduledDate: appointment.scheduledDate,
                scheduledTime: appointment.scheduledTime,
              },
            },
            relatedRecords: {
              appointmentId: appointment._id,
            },
            createdBy: appointment.assignedTo,
          });

          await followUpTask.save();

          logger.info('Follow-up task created for missed appointment', {
            appointmentId: appointment._id.toString(),
            patientId: appointment.patientId.toString(),
            followUpTaskId: followUpTask._id.toString(),
          });

          // Send notification to assigned pharmacist
          try {
            await notificationService.createNotification({
              userId: appointment.assignedTo,
              type: 'followup_task_assigned',
              title: 'New Follow-up Task',
              content: `Follow-up task created for patient who missed appointment: ${followUpTask.title}`,
              data: {
                followUpTaskId: followUpTask._id,
                patientId: appointment.patientId,
                appointmentId: appointment._id,
                priority: followUpTask.priority,
              },
              priority: 'normal',
              deliveryChannels: {
                inApp: true,
                email: false,
                sms: false,
                push: true,
              },
              workplaceId,
              createdBy: appointment.assignedTo,
            });
          } catch (notificationError) {
            logger.error('Failed to send follow-up task notification', {
              followUpTaskId: followUpTask._id.toString(),
              error: notificationError instanceof Error ? notificationError.message : 'Unknown error',
            });
          }
        }
      }

      // Monitor for overdue follow-up tasks that need escalation
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const overdueFollowUps = await FollowUpTask.find({
        workplaceId,
        status: { $in: ['pending', 'in_progress'] },
        dueDate: { $lt: sevenDaysAgo },
        priority: { $ne: 'critical' }, // Don't re-escalate already critical tasks
        isDeleted: false,
      }).populate('patientId assignedTo');

      for (const task of overdueFollowUps) {
        // Escalate priority
        const oldPriority = task.priority;
        task.priority = 'critical';
        task.escalationHistory.push({
          escalatedAt: now,
          escalatedBy: new mongoose.Types.ObjectId(), // System escalation
          fromPriority: oldPriority,
          toPriority: 'critical',
          reason: 'Automatic escalation - task overdue by more than 7 days',
        });

        await task.save();

        logger.info('Follow-up task escalated', {
          followUpTaskId: task._id.toString(),
          patientId: task.patientId.toString(),
          oldPriority,
          newPriority: 'critical',
        });

        // Send notification to assigned pharmacist and manager
        const notifications = [
          {
            userId: task.assignedTo,
            title: 'Critical Follow-up Task',
            content: `Follow-up task escalated to critical priority: ${task.title}`,
          },
        ];

        // Find pharmacy manager to notify
        const manager = await User.findOne({
          workplaceId,
          role: { $in: ['pharmacy_manager', 'super_admin'] },
          isDeleted: false,
        });

        if (manager && !manager._id.equals(task.assignedTo)) {
          notifications.push({
            userId: manager._id,
            title: 'Critical Follow-up Task Alert',
            content: `Follow-up task requires immediate attention: ${task.title}`,
          });
        }

        for (const notification of notifications) {
          try {
            await notificationService.createNotification({
              ...notification,
              type: 'followup_task_overdue',
              data: {
                followUpTaskId: task._id,
                patientId: task.patientId,
                priority: task.priority,
              },
              priority: 'urgent',
              deliveryChannels: {
                inApp: true,
                email: true,
                sms: false,
                push: true,
              },
              workplaceId,
              createdBy: task.assignedTo,
            });
          } catch (notificationError) {
            logger.error('Failed to send escalation notification', {
              followUpTaskId: task._id.toString(),
              userId: notification.userId.toString(),
              error: notificationError instanceof Error ? notificationError.message : 'Unknown error',
            });
          }
        }
      }

      logger.info('Clinical triggers monitoring completed', {
        workplaceId: workplaceId.toString(),
        missedAppointmentsProcessed: missedAppointments.length,
        followUpsEscalated: overdueFollowUps.length,
      });
    } catch (error) {
      logger.error('Error monitoring clinical triggers', {
        workplaceId: workplaceId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Clean up expired alerts
   */
  static cleanupExpiredAlerts(): void {
    const now = new Date();
    let cleanedCount = 0;

    // Clean patient alerts
    for (const [alertId, alert] of this.patientAlerts.entries()) {
      if (alert.expiresAt && alert.expiresAt <= now) {
        this.patientAlerts.delete(alertId);
        cleanedCount++;
      }
    }

    // Clean dashboard alerts
    for (const [alertId, alert] of this.dashboardAlerts.entries()) {
      if (alert.expiresAt && alert.expiresAt <= now) {
        this.dashboardAlerts.delete(alertId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('Expired alerts cleaned up', { cleanedCount });
    }
  }

  /**
   * Get alert statistics
   */
  static getAlertStatistics(workplaceId: mongoose.Types.ObjectId): {
    patientAlerts: { total: number; bySeverity: Record<string, number> };
    dashboardAlerts: { total: number; bySeverity: Record<string, number> };
  } {
    const patientAlertStats = { total: 0, bySeverity: {} as Record<string, number> };
    const dashboardAlertStats = { total: 0, bySeverity: {} as Record<string, number> };

    // Count patient alerts
    for (const alert of this.patientAlerts.values()) {
      if (!alert.dismissedAt) {
        patientAlertStats.total++;
        patientAlertStats.bySeverity[alert.severity] = (patientAlertStats.bySeverity[alert.severity] || 0) + 1;
      }
    }

    // Count dashboard alerts
    for (const alert of this.dashboardAlerts.values()) {
      if (!alert.dismissedAt) {
        dashboardAlertStats.total++;
        dashboardAlertStats.bySeverity[alert.severity] = (dashboardAlertStats.bySeverity[alert.severity] || 0) + 1;
      }
    }

    return {
      patientAlerts: patientAlertStats,
      dashboardAlerts: dashboardAlertStats,
    };
  }
}

// Export as default for backward compatibility
export default AlertService;