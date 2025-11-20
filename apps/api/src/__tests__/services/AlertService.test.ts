/**
 * AlertService Tests
 * Comprehensive tests for alert generation and management
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import mongoose from 'mongoose';
import AlertService from '../../services/AlertService';
import Patient from '../../models/Patient';
import Appointment from '../../models/Appointment';
import FollowUpTask from '../../models/FollowUpTask';
import User from '../../models/User';
import { notificationService } from '../../services/notificationService';

// Mock dependencies
jest.mock('../../services/notificationService');
jest.mock('../../utils/logger');

describe('AlertService', () => {
  let workplaceId: mongoose.Types.ObjectId;
  let userId: mongoose.Types.ObjectId;
  let patientId: mongoose.Types.ObjectId;
  let pharmacistId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/test');
  });

  beforeEach(async () => {
    // Clear database
    await Patient.deleteMany({});
    await Appointment.deleteMany({});
    await FollowUpTask.deleteMany({});
    await User.deleteMany({});

    // Create test data
    workplaceId = new mongoose.Types.ObjectId();
    userId = new mongoose.Types.ObjectId();
    patientId = new mongoose.Types.ObjectId();
    pharmacistId = new mongoose.Types.ObjectId();

    // Create test patient
    await Patient.create({
      _id: patientId,
      workplaceId,
      mrn: 'TEST001',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '+2348012345678',
      createdBy: userId,
    });

    // Create test pharmacist
    await User.create({
      _id: pharmacistId,
      workplaceId,
      firstName: 'Jane',
      lastName: 'Pharmacist',
      email: 'jane@pharmacy.com',
      role: 'pharmacist',
      createdBy: userId,
    });

    // Clear alert stores
    AlertService['patientAlerts'].clear();
    AlertService['dashboardAlerts'].clear();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('getPatientAlerts', () => {
    it('should generate overdue appointment alert', async () => {
      // Create overdue appointment
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await Appointment.create({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'mtm_session',
        title: 'MTM Session',
        scheduledDate: yesterday,
        scheduledTime: '10:00',
        duration: 30,
        status: 'scheduled',
        createdBy: userId,
      });

      const alerts = await AlertService.getPatientAlerts(patientId, workplaceId);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('overdue_appointment');
      expect(alerts[0].severity).toBe('high');
      expect(alerts[0].title).toBe('Overdue Appointment');
      expect(alerts[0].patientId).toEqual(patientId);
    });

    it('should generate missed appointment alert', async () => {
      // Create missed appointment
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);

      await Appointment.create({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'health_check',
        title: 'Health Check',
        scheduledDate: lastWeek,
        scheduledTime: '14:00',
        duration: 30,
        status: 'no_show',
        createdBy: userId,
      });

      const alerts = await AlertService.getPatientAlerts(patientId, workplaceId);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('missed_appointment');
      expect(alerts[0].severity).toBe('medium');
      expect(alerts[0].title).toBe('Missed Appointment');
    });

    it('should generate abnormal vitals alert', async () => {
      // Update patient with elevated BP
      await Patient.findByIdAndUpdate(patientId, {
        latestVitals: {
          bpSystolic: 150,
          bpDiastolic: 95,
          recordedAt: new Date(),
        },
      });

      const alerts = await AlertService.getPatientAlerts(patientId, workplaceId);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('abnormal_vitals');
      expect(alerts[0].severity).toBe('medium');
      expect(alerts[0].title).toBe('Elevated Blood Pressure');
      expect(alerts[0].data.bpSystolic).toBe(150);
      expect(alerts[0].data.bpDiastolic).toBe(95);
    });

    it('should generate critical abnormal vitals alert for very high BP', async () => {
      // Update patient with very high BP
      await Patient.findByIdAndUpdate(patientId, {
        latestVitals: {
          bpSystolic: 170,
          bpDiastolic: 105,
          recordedAt: new Date(),
        },
      });

      const alerts = await AlertService.getPatientAlerts(patientId, workplaceId);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('abnormal_vitals');
      expect(alerts[0].severity).toBe('high');
    });

    it('should generate low adherence alert', async () => {
      // Update patient with low adherence
      await Patient.findByIdAndUpdate(patientId, {
        engagementMetrics: {
          totalFollowUps: 10,
          completedFollowUps: 6,
          followUpCompletionRate: 60,
          totalAppointments: 5,
          completedAppointments: 4,
          completionRate: 80,
          lastEngagementDate: new Date(),
          engagementScore: 70,
        },
      });

      const alerts = await AlertService.getPatientAlerts(patientId, workplaceId);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('low_adherence');
      expect(alerts[0].severity).toBe('medium');
      expect(alerts[0].title).toBe('Low Adherence Detected');
      expect(alerts[0].data.adherenceRate).toBe(60);
    });

    it('should generate critical overdue follow-up alert', async () => {
      // Create overdue follow-up task (more than 7 days)
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      await FollowUpTask.create({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'medication_start_followup',
        title: 'Medication Start Follow-up',
        description: 'Follow up on new medication',
        objectives: ['Check for side effects'],
        priority: 'medium',
        dueDate: tenDaysAgo,
        status: 'pending',
        trigger: {
          type: 'medication_start',
          triggerDate: new Date(),
        },
        createdBy: userId,
      });

      const alerts = await AlertService.getPatientAlerts(patientId, workplaceId);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('overdue_followup');
      expect(alerts[0].severity).toBe('critical');
      expect(alerts[0].title).toBe('Critical Overdue Follow-up');
      expect(alerts[0].data.daysPastDue).toBe(10);
    });

    it('should generate patient inactive alert', async () => {
      // Update patient with old last engagement date
      const sevenMonthsAgo = new Date();
      sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 7);

      await Patient.findByIdAndUpdate(patientId, {
        engagementMetrics: {
          lastEngagementDate: sevenMonthsAgo,
          totalAppointments: 2,
          completedAppointments: 2,
          completionRate: 100,
          totalFollowUps: 1,
          completedFollowUps: 1,
          followUpCompletionRate: 100,
          engagementScore: 80,
        },
      });

      const alerts = await AlertService.getPatientAlerts(patientId, workplaceId);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('patient_inactive');
      expect(alerts[0].severity).toBe('low');
      expect(alerts[0].title).toBe('Patient Inactive');
      expect(alerts[0].data.monthsInactive).toBeGreaterThan(6);
    });

    it('should filter alerts by severity', async () => {
      // Create multiple alerts with different severities
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await Appointment.create({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'mtm_session',
        title: 'MTM Session',
        scheduledDate: yesterday,
        scheduledTime: '10:00',
        duration: 30,
        status: 'scheduled',
        createdBy: userId,
      });

      await Patient.findByIdAndUpdate(patientId, {
        latestVitals: {
          bpSystolic: 145,
          bpDiastolic: 92,
          recordedAt: new Date(),
        },
      });

      // Get all alerts
      const allAlerts = await AlertService.getPatientAlerts(patientId, workplaceId);
      expect(allAlerts).toHaveLength(2);

      // Filter by high severity only
      const highSeverityAlerts = await AlertService.getPatientAlerts(
        patientId,
        workplaceId,
        { severity: 'high' }
      );
      expect(highSeverityAlerts).toHaveLength(1);
      expect(highSeverityAlerts[0].type).toBe('overdue_appointment');
    });

    it('should sort alerts by severity and creation date', async () => {
      // Create multiple alerts
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await Appointment.create({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'mtm_session',
        title: 'MTM Session',
        scheduledDate: yesterday,
        scheduledTime: '10:00',
        duration: 30,
        status: 'scheduled',
        createdBy: userId,
      });

      const sevenMonthsAgo = new Date();
      sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 7);

      await Patient.findByIdAndUpdate(patientId, {
        engagementMetrics: {
          lastEngagementDate: sevenMonthsAgo,
          totalAppointments: 1,
          completedAppointments: 1,
          completionRate: 100,
          totalFollowUps: 0,
          completedFollowUps: 0,
          followUpCompletionRate: 0,
          engagementScore: 50,
        },
      });

      const alerts = await AlertService.getPatientAlerts(patientId, workplaceId);

      expect(alerts).toHaveLength(2);
      // High severity alert should come first
      expect(alerts[0].severity).toBe('high');
      expect(alerts[0].type).toBe('overdue_appointment');
      // Low severity alert should come second
      expect(alerts[1].severity).toBe('low');
      expect(alerts[1].type).toBe('patient_inactive');
    });
  });

  describe('getDashboardAlerts', () => {
    it('should generate today\'s appointments alert', async () => {
      // Create appointment for today
      const today = new Date();
      
      await Appointment.create({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'health_check',
        title: 'Health Check',
        scheduledDate: today,
        scheduledTime: '10:00',
        duration: 30,
        status: 'scheduled',
        createdBy: userId,
      });

      const alerts = await AlertService.getDashboardAlerts(workplaceId);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('appointments_today');
      expect(alerts[0].severity).toBe('low');
      expect(alerts[0].title).toBe("Today's Appointments");
      expect(alerts[0].count).toBe(1);
    });

    it('should generate overdue follow-ups alert', async () => {
      // Create overdue follow-up task
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await FollowUpTask.create({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'medication_start_followup',
        title: 'Medication Follow-up',
        description: 'Check medication effectiveness',
        objectives: ['Assess effectiveness'],
        priority: 'medium',
        dueDate: yesterday,
        status: 'pending',
        trigger: {
          type: 'medication_start',
          triggerDate: new Date(),
        },
        createdBy: userId,
      });

      const alerts = await AlertService.getDashboardAlerts(workplaceId);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('overdue_followups');
      expect(alerts[0].severity).toBe('medium');
      expect(alerts[0].title).toBe('Overdue Follow-ups');
      expect(alerts[0].count).toBe(1);
    });

    it('should generate high priority tasks alert', async () => {
      // Create high priority follow-up task
      await FollowUpTask.create({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'lab_result_review',
        title: 'Urgent Lab Review',
        description: 'Review abnormal lab results',
        objectives: ['Review results', 'Contact patient'],
        priority: 'urgent',
        dueDate: new Date(),
        status: 'pending',
        trigger: {
          type: 'lab_result',
          triggerDate: new Date(),
        },
        createdBy: userId,
      });

      const alerts = await AlertService.getDashboardAlerts(workplaceId);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('high_priority_tasks');
      expect(alerts[0].severity).toBe('high');
      expect(alerts[0].title).toBe('High Priority Tasks');
      expect(alerts[0].count).toBe(1);
    });

    it('should filter alerts for specific user', async () => {
      const anotherPharmacistId = new mongoose.Types.ObjectId();

      // Create appointments for different pharmacists
      const today = new Date();
      
      await Appointment.create({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'health_check',
        title: 'Health Check 1',
        scheduledDate: today,
        scheduledTime: '10:00',
        duration: 30,
        status: 'scheduled',
        createdBy: userId,
      });

      await Appointment.create({
        workplaceId,
        patientId,
        assignedTo: anotherPharmacistId,
        type: 'health_check',
        title: 'Health Check 2',
        scheduledDate: today,
        scheduledTime: '11:00',
        duration: 30,
        status: 'scheduled',
        createdBy: userId,
      });

      // Get alerts for all users
      const allAlerts = await AlertService.getDashboardAlerts(workplaceId);
      expect(allAlerts[0].count).toBe(2);

      // Get alerts for specific user
      const userAlerts = await AlertService.getDashboardAlerts(workplaceId, pharmacistId);
      expect(userAlerts[0].count).toBe(1);
    });
  });

  describe('createAlert', () => {
    it('should create a patient alert', async () => {
      const alertData = {
        type: 'low_adherence' as const,
        severity: 'medium' as const,
        title: 'Custom Patient Alert',
        message: 'This is a custom alert for the patient',
        patientId,
        patientName: 'John Doe',
        data: { customField: 'value' },
      };

      const alert = await AlertService.createAlert(
        'patient',
        alertData,
        workplaceId,
        userId
      );

      expect(alert.id).toBeDefined();
      expect(alert.type).toBe('low_adherence');
      expect(alert.severity).toBe('medium');
      expect(alert.title).toBe('Custom Patient Alert');
      expect(alert.patientId).toEqual(patientId);
      expect(alert.createdAt).toBeDefined();
      expect(alert.expiresAt).toBeDefined();
    });

    it('should create a dashboard alert', async () => {
      const alertData = {
        type: 'system_notification' as const,
        severity: 'high' as const,
        title: 'System Maintenance',
        message: 'System will be down for maintenance',
        data: { maintenanceWindow: '2024-01-01T02:00:00Z' },
      };

      const alert = await AlertService.createAlert(
        'dashboard',
        alertData,
        workplaceId,
        userId
      );

      expect(alert.id).toBeDefined();
      expect(alert.type).toBe('system_notification');
      expect(alert.severity).toBe('high');
      expect(alert.title).toBe('System Maintenance');
      expect(alert.createdAt).toBeDefined();
    });

    it('should auto-populate patient name for patient alerts', async () => {
      const alertData = {
        type: 'overdue_appointment' as const,
        severity: 'high' as const,
        title: 'Test Alert',
        message: 'Test message',
        patientId,
        data: {},
      };

      const alert = await AlertService.createAlert(
        'patient',
        alertData,
        workplaceId,
        userId
      );

      expect(alert.patientName).toBe('John Doe');
    });
  });

  describe('dismissAlert', () => {
    it('should dismiss a patient alert', async () => {
      // Create an alert first
      const alertData = {
        type: 'low_adherence' as const,
        severity: 'medium' as const,
        title: 'Test Alert',
        message: 'Test message',
        patientId,
        patientName: 'John Doe',
        data: {},
      };

      const alert = await AlertService.createAlert(
        'patient',
        alertData,
        workplaceId,
        userId
      );

      // Dismiss the alert
      const dismissed = await AlertService.dismissAlert(
        alert.id,
        userId,
        'Resolved by pharmacist'
      );

      expect(dismissed).toBe(true);

      // Verify alert is dismissed
      const dismissedAlert = AlertService['patientAlerts'].get(alert.id);
      expect(dismissedAlert?.dismissedAt).toBeDefined();
      expect(dismissedAlert?.dismissedBy).toEqual(userId);
      expect(dismissedAlert?.dismissReason).toBe('Resolved by pharmacist');
    });

    it('should dismiss a dashboard alert', async () => {
      // Create a dashboard alert first
      const alertData = {
        type: 'system_notification' as const,
        severity: 'low' as const,
        title: 'Test Dashboard Alert',
        message: 'Test message',
        data: {},
      };

      const alert = await AlertService.createAlert(
        'dashboard',
        alertData,
        workplaceId,
        userId
      );

      // Dismiss the alert
      const dismissed = await AlertService.dismissAlert(alert.id, userId);

      expect(dismissed).toBe(true);

      // Verify alert is dismissed
      const dismissedAlert = AlertService['dashboardAlerts'].get(alert.id);
      expect(dismissedAlert?.dismissedAt).toBeDefined();
      expect(dismissedAlert?.dismissedBy).toEqual(userId);
    });

    it('should return false for non-existent alert', async () => {
      const dismissed = await AlertService.dismissAlert(
        'non-existent-alert',
        userId
      );

      expect(dismissed).toBe(false);
    });
  });

  describe('monitorClinicalTriggers', () => {
    it('should create follow-up tasks for missed appointments', async () => {
      // Create a missed appointment from yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await Appointment.create({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'mtm_session',
        title: 'MTM Session',
        scheduledDate: yesterday,
        scheduledTime: '10:00',
        duration: 30,
        status: 'no_show',
        createdBy: userId,
      });

      // Mock notification service
      const mockCreateNotification = jest.fn().mockResolvedValue({});
      (notificationService.createNotification as jest.Mock) = mockCreateNotification;

      await AlertService.monitorClinicalTriggers(workplaceId);

      // Check if follow-up task was created
      const followUpTasks = await FollowUpTask.find({
        workplaceId,
        patientId,
        'trigger.type': 'missed_appointment',
      });

      expect(followUpTasks).toHaveLength(1);
      expect(followUpTasks[0].title).toContain('missed');
      expect(followUpTasks[0].priority).toBe('medium');
      expect(followUpTasks[0].assignedTo).toEqual(pharmacistId);

      // Check if notification was sent
      expect(mockCreateNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: pharmacistId,
          type: 'followup_task_assigned',
          title: 'New Follow-up Task',
        })
      );
    });

    it('should escalate overdue follow-up tasks', async () => {
      // Create an overdue follow-up task (more than 7 days old)
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      const followUpTask = await FollowUpTask.create({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'medication_start_followup',
        title: 'Medication Follow-up',
        description: 'Check medication effectiveness',
        objectives: ['Assess effectiveness'],
        priority: 'medium',
        dueDate: tenDaysAgo,
        status: 'pending',
        trigger: {
          type: 'medication_start',
          triggerDate: new Date(),
        },
        escalationHistory: [],
        createdBy: userId,
      });

      // Mock notification service
      const mockCreateNotification = jest.fn().mockResolvedValue({});
      (notificationService.createNotification as jest.Mock) = mockCreateNotification;

      await AlertService.monitorClinicalTriggers(workplaceId);

      // Check if task was escalated
      const escalatedTask = await FollowUpTask.findById(followUpTask._id);
      expect(escalatedTask?.priority).toBe('critical');
      expect(escalatedTask?.escalationHistory).toHaveLength(1);
      expect(escalatedTask?.escalationHistory[0].fromPriority).toBe('medium');
      expect(escalatedTask?.escalationHistory[0].toPriority).toBe('critical');

      // Check if notification was sent
      expect(mockCreateNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: pharmacistId,
          type: 'followup_task_overdue',
          title: 'Critical Follow-up Task',
        })
      );
    });

    it('should not create duplicate follow-up tasks', async () => {
      // Create a missed appointment
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const appointment = await Appointment.create({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'mtm_session',
        title: 'MTM Session',
        scheduledDate: yesterday,
        scheduledTime: '10:00',
        duration: 30,
        status: 'no_show',
        createdBy: userId,
      });

      // Create existing follow-up task for this appointment
      await FollowUpTask.create({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'general_followup',
        title: 'Existing Follow-up',
        description: 'Existing follow-up task',
        objectives: ['Contact patient'],
        priority: 'medium',
        dueDate: new Date(),
        status: 'pending',
        trigger: {
          type: 'missed_appointment',
          sourceId: appointment._id,
          triggerDate: new Date(),
        },
        createdBy: userId,
      });

      await AlertService.monitorClinicalTriggers(workplaceId);

      // Check that no duplicate task was created
      const followUpTasks = await FollowUpTask.find({
        workplaceId,
        patientId,
        'trigger.type': 'missed_appointment',
        'trigger.sourceId': appointment._id,
      });

      expect(followUpTasks).toHaveLength(1);
    });
  });

  describe('cleanupExpiredAlerts', () => {
    it('should remove expired alerts', async () => {
      // Create an expired alert
      const expiredAlert = {
        id: 'expired-alert',
        type: 'low_adherence' as const,
        severity: 'low' as const,
        title: 'Expired Alert',
        message: 'This alert has expired',
        patientId,
        patientName: 'John Doe',
        data: {},
        createdAt: new Date(),
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      };

      AlertService['patientAlerts'].set(expiredAlert.id, expiredAlert);

      // Create a non-expired alert
      const activeAlert = {
        id: 'active-alert',
        type: 'overdue_appointment' as const,
        severity: 'high' as const,
        title: 'Active Alert',
        message: 'This alert is still active',
        patientId,
        patientName: 'John Doe',
        data: {},
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60000), // Expires in 1 minute
      };

      AlertService['patientAlerts'].set(activeAlert.id, activeAlert);

      expect(AlertService['patientAlerts'].size).toBe(2);

      AlertService.cleanupExpiredAlerts();

      expect(AlertService['patientAlerts'].size).toBe(1);
      expect(AlertService['patientAlerts'].has('expired-alert')).toBe(false);
      expect(AlertService['patientAlerts'].has('active-alert')).toBe(true);
    });
  });

  describe('getAlertStatistics', () => {
    it('should return correct alert statistics', async () => {
      // Create various alerts
      const alerts = [
        {
          id: 'alert-1',
          type: 'overdue_appointment' as const,
          severity: 'high' as const,
          title: 'Alert 1',
          message: 'Message 1',
          patientId,
          patientName: 'John Doe',
          data: {},
          createdAt: new Date(),
        },
        {
          id: 'alert-2',
          type: 'low_adherence' as const,
          severity: 'medium' as const,
          title: 'Alert 2',
          message: 'Message 2',
          patientId,
          patientName: 'John Doe',
          data: {},
          createdAt: new Date(),
        },
        {
          id: 'alert-3',
          type: 'patient_inactive' as const,
          severity: 'low' as const,
          title: 'Alert 3',
          message: 'Message 3',
          patientId,
          patientName: 'John Doe',
          data: {},
          createdAt: new Date(),
          dismissedAt: new Date(), // Dismissed alert
        },
      ];

      alerts.forEach(alert => {
        AlertService['patientAlerts'].set(alert.id, alert);
      });

      const dashboardAlerts = [
        {
          id: 'dashboard-1',
          type: 'appointments_today' as const,
          severity: 'low' as const,
          title: 'Dashboard Alert 1',
          message: 'Dashboard Message 1',
          data: {},
          createdAt: new Date(),
        },
        {
          id: 'dashboard-2',
          type: 'high_priority_tasks' as const,
          severity: 'high' as const,
          title: 'Dashboard Alert 2',
          message: 'Dashboard Message 2',
          data: {},
          createdAt: new Date(),
        },
      ];

      dashboardAlerts.forEach(alert => {
        AlertService['dashboardAlerts'].set(alert.id, alert);
      });

      const statistics = AlertService.getAlertStatistics(workplaceId);

      expect(statistics.patientAlerts.total).toBe(2); // Excluding dismissed alert
      expect(statistics.patientAlerts.bySeverity.high).toBe(1);
      expect(statistics.patientAlerts.bySeverity.medium).toBe(1);
      expect(statistics.patientAlerts.bySeverity.low).toBeUndefined();

      expect(statistics.dashboardAlerts.total).toBe(2);
      expect(statistics.dashboardAlerts.bySeverity.high).toBe(1);
      expect(statistics.dashboardAlerts.bySeverity.low).toBe(1);
    });
  });
});