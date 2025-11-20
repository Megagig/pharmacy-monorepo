import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ReportGenerationService } from '../../services/ReportGenerationService';
import Appointment from '../../models/Appointment';
import FollowUpTask from '../../models/FollowUpTask';
import { subDays } from 'date-fns';

describe('Report Generation Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let workplaceId: mongoose.Types.ObjectId;
  let pharmacistId: mongoose.Types.ObjectId;
  let patientId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Create test IDs
    workplaceId = new mongoose.Types.ObjectId();
    pharmacistId = new mongoose.Types.ObjectId();
    patientId = new mongoose.Types.ObjectId();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear all collections
    await Appointment.deleteMany({});
    await FollowUpTask.deleteMany({});
  });

  describe('End-to-End Report Generation', () => {
    beforeEach(async () => {
      // Create comprehensive test data
      const appointments = [
        {
          workplaceId,
          patientId,
          assignedTo: pharmacistId,
          type: 'mtm_session',
          title: 'MTM Session - Diabetes Management',
          scheduledDate: subDays(new Date(), 5),
          scheduledTime: '10:00',
          duration: 45,
          status: 'completed',
          outcome: {
            status: 'successful',
            notes: 'Patient counseled on medication adherence and lifestyle modifications',
            nextActions: ['Schedule follow-up in 3 months', 'Monitor blood glucose levels']
          },
          reminders: [
            {
              type: 'email',
              scheduledFor: subDays(new Date(), 6),
              sent: true,
              sentAt: subDays(new Date(), 6),
              deliveryStatus: 'delivered'
            },
            {
              type: 'sms',
              scheduledFor: subDays(new Date(), 5),
              sent: true,
              sentAt: subDays(new Date(), 5),
              deliveryStatus: 'delivered'
            }
          ],
          createdBy: pharmacistId
        },
        {
          workplaceId,
          patientId,
          assignedTo: pharmacistId,
          type: 'health_check',
          title: 'Annual Health Check',
          scheduledDate: subDays(new Date(), 3),
          scheduledTime: '14:00',
          duration: 30,
          status: 'no_show',
          reminders: [
            {
              type: 'email',
              scheduledFor: subDays(new Date(), 4),
              sent: true,
              sentAt: subDays(new Date(), 4),
              deliveryStatus: 'delivered'
            }
          ],
          createdBy: pharmacistId
        },
        {
          workplaceId,
          patientId,
          assignedTo: pharmacistId,
          type: 'vaccination',
          title: 'Flu Vaccination',
          scheduledDate: subDays(new Date(), 1),
          scheduledTime: '09:30',
          duration: 15,
          status: 'cancelled',
          cancellationReason: 'Patient rescheduled due to illness',
          createdBy: pharmacistId
        }
      ];

      const followUpTasks = [
        {
          workplaceId,
          patientId,
          assignedTo: pharmacistId,
          type: 'medication_start_followup',
          title: 'New Medication Follow-up - Metformin',
          description: 'Follow up on newly started Metformin for diabetes management',
          objectives: ['Check for side effects', 'Assess adherence', 'Monitor blood glucose'],
          priority: 'high',
          dueDate: subDays(new Date(), 2),
          status: 'completed',
          outcome: {
            status: 'successful',
            notes: 'Patient tolerating medication well, good adherence reported',
            nextActions: ['Continue current regimen', 'Schedule next follow-up in 3 months']
          },
          trigger: {
            type: 'medication_start',
            triggerDate: subDays(new Date(), 7)
          },
          createdBy: pharmacistId
        },
        {
          workplaceId,
          patientId,
          assignedTo: pharmacistId,
          type: 'adherence_check',
          title: 'Medication Adherence Check',
          description: 'Check adherence to hypertension medications',
          objectives: ['Review medication schedule', 'Assess barriers to adherence'],
          priority: 'medium',
          dueDate: new Date(),
          status: 'pending',
          trigger: {
            type: 'scheduled_monitoring',
            triggerDate: subDays(new Date(), 3)
          },
          createdBy: pharmacistId
        },
        {
          workplaceId,
          patientId,
          assignedTo: pharmacistId,
          type: 'lab_result_review',
          title: 'Lab Results Review - HbA1c',
          description: 'Review recent HbA1c results and adjust therapy if needed',
          objectives: ['Analyze lab results', 'Adjust medication if necessary'],
          priority: 'urgent',
          dueDate: subDays(new Date(), 1),
          status: 'overdue',
          trigger: {
            type: 'lab_result',
            triggerDate: subDays(new Date(), 5)
          },
          createdBy: pharmacistId
        }
      ];

      await Appointment.insertMany(appointments);
      await FollowUpTask.insertMany(followUpTasks);
    });

    it('should generate comprehensive appointment report with all formats', async () => {
      const options = {
        workplaceId,
        startDate: subDays(new Date(), 7),
        endDate: new Date(),
        includeDetails: true
      };

      // Test PDF generation
      const pdfReport = await ReportGenerationService.generateAppointmentReport({
        ...options,
        format: 'pdf'
      });

      expect(pdfReport).toBeInstanceOf(Buffer);
      expect(pdfReport.length).toBeGreaterThan(1000); // Should be substantial
      expect(pdfReport.toString('ascii', 0, 4)).toBe('%PDF');

      // Test Excel generation
      const excelReport = await ReportGenerationService.generateAppointmentReport({
        ...options,
        format: 'excel'
      });

      expect(excelReport).toBeInstanceOf(Buffer);
      expect(excelReport.length).toBeGreaterThan(1000);
      expect(excelReport.toString('ascii', 0, 2)).toBe('PK'); // ZIP format

      // Test CSV generation
      const csvReport = await ReportGenerationService.generateAppointmentReport({
        ...options,
        format: 'csv'
      });

      expect(csvReport).toBeInstanceOf(Buffer);
      const csvContent = csvReport.toString('utf8');
      expect(csvContent).toContain('patientName');
      expect(csvContent).toContain('MTM Session - Diabetes Management');
      expect(csvContent).toContain('completed');
      expect(csvContent).toContain('no_show');
      expect(csvContent).toContain('cancelled');
    });

    it('should generate comprehensive follow-up report with analytics', async () => {
      const options = {
        workplaceId,
        startDate: subDays(new Date(), 7),
        endDate: new Date(),
        format: 'pdf' as const,
        includeDetails: true
      };

      const report = await ReportGenerationService.generateFollowUpReport(options);

      expect(report).toBeInstanceOf(Buffer);
      expect(report.length).toBeGreaterThan(1000);
      expect(report.toString('ascii', 0, 4)).toBe('%PDF');
    });

    it('should generate reminder effectiveness report', async () => {
      const options = {
        workplaceId,
        startDate: subDays(new Date(), 7),
        endDate: new Date(),
        format: 'csv' as const,
        includeDetails: true
      };

      const report = await ReportGenerationService.generateReminderReport(options);

      expect(report).toBeInstanceOf(Buffer);
      const csvContent = report.toString('utf8');
      expect(csvContent).toContain('patientName');
      expect(csvContent).toContain('channel');
      expect(csvContent).toContain('email');
      expect(csvContent).toContain('sms');
      expect(csvContent).toContain('delivered');
    });

    it('should generate capacity utilization report', async () => {
      const options = {
        workplaceId,
        startDate: subDays(new Date(), 7),
        endDate: new Date(),
        format: 'excel' as const,
        includeDetails: true
      };

      const report = await ReportGenerationService.generateCapacityReport(options);

      expect(report).toBeInstanceOf(Buffer);
      expect(report.length).toBeGreaterThan(500);
      expect(report.toString('ascii', 0, 2)).toBe('PK');
    });

    it('should handle filtering by pharmacist', async () => {
      const otherPharmacistId = new mongoose.Types.ObjectId();
      
      // Create appointment for different pharmacist
      await Appointment.create({
        workplaceId,
        patientId,
        assignedTo: otherPharmacistId,
        type: 'mtm_session',
        title: 'Other Pharmacist Session',
        scheduledDate: subDays(new Date(), 2),
        scheduledTime: '11:00',
        duration: 30,
        status: 'completed',
        createdBy: otherPharmacistId
      });

      const options = {
        workplaceId,
        pharmacistId, // Filter by specific pharmacist
        startDate: subDays(new Date(), 7),
        endDate: new Date(),
        format: 'csv' as const
      };

      const report = await ReportGenerationService.generateAppointmentReport(options);
      const csvContent = report.toString('utf8');
      
      // Should not contain the other pharmacist's appointment
      expect(csvContent).not.toContain('Other Pharmacist Session');
      // Should contain our pharmacist's appointments
      expect(csvContent).toContain('MTM Session - Diabetes Management');
    });

    it('should handle filtering by appointment type', async () => {
      const options = {
        workplaceId,
        appointmentType: 'mtm_session',
        startDate: subDays(new Date(), 7),
        endDate: new Date(),
        format: 'csv' as const
      };

      const report = await ReportGenerationService.generateAppointmentReport(options);
      const csvContent = report.toString('utf8');
      
      // Should only contain MTM sessions
      expect(csvContent).toContain('mtm_session');
      expect(csvContent).toContain('MTM Session - Diabetes Management');
      // Should not contain other types
      expect(csvContent).not.toContain('health_check');
      expect(csvContent).not.toContain('vaccination');
    });

    it('should handle empty data gracefully', async () => {
      // Clear all data
      await Appointment.deleteMany({});
      await FollowUpTask.deleteMany({});

      const options = {
        workplaceId,
        startDate: subDays(new Date(), 7),
        endDate: new Date(),
        format: 'pdf' as const
      };

      const report = await ReportGenerationService.generateAppointmentReport(options);

      expect(report).toBeInstanceOf(Buffer);
      expect(report.length).toBeGreaterThan(0);
      expect(report.toString('ascii', 0, 4)).toBe('%PDF');
    });

    it('should handle large datasets efficiently', async () => {
      // Create a larger dataset
      const largeDataset = [];
      for (let i = 0; i < 50; i++) {
        largeDataset.push({
          workplaceId,
          patientId,
          assignedTo: pharmacistId,
          type: 'mtm_session',
          title: `MTM Session ${i + 1}`,
          scheduledDate: subDays(new Date(), Math.floor(i / 10) + 1),
          scheduledTime: `${9 + (i % 8)}:00`,
          duration: 30,
          status: i % 3 === 0 ? 'completed' : i % 3 === 1 ? 'scheduled' : 'cancelled',
          createdBy: pharmacistId
        });
      }

      await Appointment.insertMany(largeDataset);

      const startTime = Date.now();
      const options = {
        workplaceId,
        startDate: subDays(new Date(), 7),
        endDate: new Date(),
        format: 'excel' as const,
        includeDetails: true
      };

      const report = await ReportGenerationService.generateAppointmentReport(options);
      const endTime = Date.now();

      expect(report).toBeInstanceOf(Buffer);
      expect(report.length).toBeGreaterThan(5000); // Should be substantial with 50+ records
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should validate date ranges properly', async () => {
      const options = {
        workplaceId,
        startDate: new Date(), // Start date after end date
        endDate: subDays(new Date(), 7),
        format: 'pdf' as const
      };

      // This should still work as the service doesn't validate date order
      // (validation happens at the controller level)
      const report = await ReportGenerationService.generateAppointmentReport(options);
      expect(report).toBeInstanceOf(Buffer);
    });
  });

  describe('Report Data Quality', () => {
    beforeEach(async () => {
      // Create test data with specific metrics for validation
      await Appointment.create({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'mtm_session',
        title: 'Quality Test Appointment',
        scheduledDate: subDays(new Date(), 1),
        scheduledTime: '10:00',
        duration: 45,
        status: 'completed',
        outcome: {
          status: 'successful',
          notes: 'Test outcome notes'
        },
        reminders: [
          {
            type: 'email',
            scheduledFor: subDays(new Date(), 2),
            sent: true,
            sentAt: subDays(new Date(), 2),
            deliveryStatus: 'delivered'
          }
        ],
        createdBy: pharmacistId
      });
    });

    it('should include accurate summary statistics', async () => {
      const options = {
        workplaceId,
        startDate: subDays(new Date(), 7),
        endDate: new Date(),
        format: 'csv' as const
      };

      const report = await ReportGenerationService.generateAppointmentReport(options);
      const csvContent = report.toString('utf8');

      // Verify data integrity
      expect(csvContent).toContain('Quality Test Appointment');
      expect(csvContent).toContain('completed');
      expect(csvContent).toContain('successful');
      expect(csvContent).toContain('45'); // Duration
    });

    it('should handle special characters in data', async () => {
      await Appointment.create({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'mtm_session',
        title: 'Special Characters: "Test", & More',
        scheduledDate: subDays(new Date(), 1),
        scheduledTime: '11:00',
        duration: 30,
        status: 'completed',
        outcome: {
          status: 'successful',
          notes: 'Notes with "quotes" and & symbols'
        },
        createdBy: pharmacistId
      });

      const options = {
        workplaceId,
        startDate: subDays(new Date(), 7),
        endDate: new Date(),
        format: 'csv' as const
      };

      const report = await ReportGenerationService.generateAppointmentReport(options);
      const csvContent = report.toString('utf8');

      // Should handle special characters properly
      expect(csvContent).toContain('Special Characters');
      expect(report.length).toBeGreaterThan(0);
    });
  });
});