import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ReportGenerationService, ReportOptions } from '../../services/ReportGenerationService';
import Appointment from '../../models/Appointment';
import FollowUpTask from '../../models/FollowUpTask';
import PharmacistSchedule from '../../models/PharmacistSchedule';
import { subDays, addDays } from 'date-fns';

describe('ReportGenerationService', () => {
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
    await PharmacistSchedule.deleteMany({});
  });

  describe('generateAppointmentReport', () => {
    beforeEach(async () => {
      // Create test appointments
      const appointments = [
        {
          workplaceId,
          patientId,
          assignedTo: pharmacistId,
          type: 'mtm_session',
          title: 'MTM Session',
          scheduledDate: subDays(new Date(), 5),
          scheduledTime: '10:00',
          duration: 30,
          status: 'completed',
          outcome: {
            status: 'successful',
            notes: 'Patient counseled on medication adherence'
          },
          createdBy: pharmacistId
        },
        {
          workplaceId,
          patientId,
          assignedTo: pharmacistId,
          type: 'health_check',
          title: 'Health Check',
          scheduledDate: subDays(new Date(), 3),
          scheduledTime: '14:00',
          duration: 45,
          status: 'no_show',
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
          cancellationReason: 'Patient rescheduled',
          createdBy: pharmacistId
        }
      ];

      await Appointment.insertMany(appointments);
    });

    it('should generate PDF appointment report', async () => {
      const options: ReportOptions = {
        workplaceId,
        startDate: subDays(new Date(), 7),
        endDate: new Date(),
        format: 'pdf',
        includeDetails: true
      };

      const reportBuffer = await ReportGenerationService.generateAppointmentReport(options);

      expect(reportBuffer).toBeInstanceOf(Buffer);
      expect(reportBuffer.length).toBeGreaterThan(0);
      
      // Check PDF header
      const pdfHeader = reportBuffer.toString('ascii', 0, 4);
      expect(pdfHeader).toBe('%PDF');
    });

    it('should generate Excel appointment report', async () => {
      const options: ReportOptions = {
        workplaceId,
        startDate: subDays(new Date(), 7),
        endDate: new Date(),
        format: 'excel',
        includeDetails: true
      };

      const reportBuffer = await ReportGenerationService.generateAppointmentReport(options);

      expect(reportBuffer).toBeInstanceOf(Buffer);
      expect(reportBuffer.length).toBeGreaterThan(0);
      
      // Excel files start with PK (ZIP format)
      const excelHeader = reportBuffer.toString('ascii', 0, 2);
      expect(excelHeader).toBe('PK');
    });

    it('should generate CSV appointment report', async () => {
      const options: ReportOptions = {
        workplaceId,
        startDate: subDays(new Date(), 7),
        endDate: new Date(),
        format: 'csv',
        includeDetails: true
      };

      const reportBuffer = await ReportGenerationService.generateAppointmentReport(options);

      expect(reportBuffer).toBeInstanceOf(Buffer);
      expect(reportBuffer.length).toBeGreaterThan(0);
      
      const csvContent = reportBuffer.toString('utf8');
      expect(csvContent).toContain('patientName');
      expect(csvContent).toContain('pharmacistName');
      expect(csvContent).toContain('type');
    });

    it('should filter appointments by pharmacist', async () => {
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

      const options: ReportOptions = {
        workplaceId,
        pharmacistId,
        startDate: subDays(new Date(), 7),
        endDate: new Date(),
        format: 'csv'
      };

      const reportBuffer = await ReportGenerationService.generateAppointmentReport(options);
      const csvContent = reportBuffer.toString('utf8');
      
      // Should not contain the other pharmacist's appointment
      expect(csvContent).not.toContain('Other Pharmacist Session');
    });

    it('should filter appointments by type', async () => {
      const options: ReportOptions = {
        workplaceId,
        appointmentType: 'mtm_session',
        startDate: subDays(new Date(), 7),
        endDate: new Date(),
        format: 'csv'
      };

      const reportBuffer = await ReportGenerationService.generateAppointmentReport(options);
      const csvContent = reportBuffer.toString('utf8');
      
      // Should only contain MTM sessions
      expect(csvContent).toContain('mtm_session');
      expect(csvContent).not.toContain('health_check');
      expect(csvContent).not.toContain('vaccination');
    });

    it('should handle empty results', async () => {
      // Clear all appointments
      await Appointment.deleteMany({});

      const options: ReportOptions = {
        workplaceId,
        startDate: subDays(new Date(), 7),
        endDate: new Date(),
        format: 'pdf'
      };

      const reportBuffer = await ReportGenerationService.generateAppointmentReport(options);

      expect(reportBuffer).toBeInstanceOf(Buffer);
      expect(reportBuffer.length).toBeGreaterThan(0);
    });
  });

  describe('generateFollowUpReport', () => {
    beforeEach(async () => {
      // Create test follow-up tasks
      const tasks = [
        {
          workplaceId,
          patientId,
          assignedTo: pharmacistId,
          type: 'medication_start_followup',
          title: 'New Medication Follow-up',
          description: 'Follow up on newly started medication',
          objectives: ['Check for side effects', 'Assess adherence'],
          priority: 'high',
          dueDate: subDays(new Date(), 2),
          status: 'completed',
          outcome: {
            status: 'successful',
            notes: 'Patient tolerating medication well'
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
          title: 'Adherence Check',
          description: 'Check medication adherence',
          objectives: ['Review medication schedule'],
          priority: 'medium',
          dueDate: addDays(new Date(), 1),
          status: 'pending',
          trigger: {
            type: 'scheduled_monitoring',
            triggerDate: subDays(new Date(), 3)
          },
          createdBy: pharmacistId
        }
      ];

      await FollowUpTask.insertMany(tasks);
    });

    it('should generate PDF follow-up report', async () => {
      const options: ReportOptions = {
        workplaceId,
        startDate: subDays(new Date(), 7),
        endDate: addDays(new Date(), 7),
        format: 'pdf',
        includeDetails: true
      };

      const reportBuffer = await ReportGenerationService.generateFollowUpReport(options);

      expect(reportBuffer).toBeInstanceOf(Buffer);
      expect(reportBuffer.length).toBeGreaterThan(0);
      
      const pdfHeader = reportBuffer.toString('ascii', 0, 4);
      expect(pdfHeader).toBe('%PDF');
    });

    it('should generate Excel follow-up report', async () => {
      const options: ReportOptions = {
        workplaceId,
        startDate: subDays(new Date(), 7),
        endDate: addDays(new Date(), 7),
        format: 'excel',
        includeDetails: true
      };

      const reportBuffer = await ReportGenerationService.generateFollowUpReport(options);

      expect(reportBuffer).toBeInstanceOf(Buffer);
      expect(reportBuffer.length).toBeGreaterThan(0);
      
      const excelHeader = reportBuffer.toString('ascii', 0, 2);
      expect(excelHeader).toBe('PK');
    });

    it('should generate CSV follow-up report', async () => {
      const options: ReportOptions = {
        workplaceId,
        startDate: subDays(new Date(), 7),
        endDate: addDays(new Date(), 7),
        format: 'csv'
      };

      const reportBuffer = await ReportGenerationService.generateFollowUpReport(options);

      expect(reportBuffer).toBeInstanceOf(Buffer);
      expect(reportBuffer.length).toBeGreaterThan(0);
      
      const csvContent = reportBuffer.toString('utf8');
      expect(csvContent).toContain('patientName');
      expect(csvContent).toContain('type');
      expect(csvContent).toContain('priority');
      expect(csvContent).toContain('status');
    });
  });

  describe('generateReminderReport', () => {
    beforeEach(async () => {
      // Create appointments with reminders
      const appointment = await Appointment.create({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'mtm_session',
        title: 'MTM Session with Reminders',
        scheduledDate: subDays(new Date(), 1),
        scheduledTime: '10:00',
        duration: 30,
        status: 'completed',
        reminders: [
          {
            type: 'email',
            scheduledFor: subDays(new Date(), 2),
            sent: true,
            sentAt: subDays(new Date(), 2),
            deliveryStatus: 'delivered'
          },
          {
            type: 'sms',
            scheduledFor: subDays(new Date(), 1),
            sent: true,
            sentAt: subDays(new Date(), 1),
            deliveryStatus: 'delivered'
          }
        ],
        createdBy: pharmacistId
      });
    });

    it('should generate PDF reminder report', async () => {
      const options: ReportOptions = {
        workplaceId,
        startDate: subDays(new Date(), 7),
        endDate: new Date(),
        format: 'pdf',
        includeDetails: true
      };

      const reportBuffer = await ReportGenerationService.generateReminderReport(options);

      expect(reportBuffer).toBeInstanceOf(Buffer);
      expect(reportBuffer.length).toBeGreaterThan(0);
      
      const pdfHeader = reportBuffer.toString('ascii', 0, 4);
      expect(pdfHeader).toBe('%PDF');
    });

    it('should generate CSV reminder report', async () => {
      const options: ReportOptions = {
        workplaceId,
        startDate: subDays(new Date(), 7),
        endDate: new Date(),
        format: 'csv'
      };

      const reportBuffer = await ReportGenerationService.generateReminderReport(options);

      expect(reportBuffer).toBeInstanceOf(Buffer);
      expect(reportBuffer.length).toBeGreaterThan(0);
      
      const csvContent = reportBuffer.toString('utf8');
      expect(csvContent).toContain('patientName');
      expect(csvContent).toContain('channel');
      expect(csvContent).toContain('deliveryStatus');
    });
  });

  describe('generateCapacityReport', () => {
    beforeEach(async () => {
      // Create pharmacist schedule
      await PharmacistSchedule.create({
        workplaceId,
        pharmacistId,
        workingHours: [
          {
            dayOfWeek: 1, // Monday
            isWorkingDay: true,
            shifts: [
              {
                startTime: '09:00',
                endTime: '17:00',
                breakStart: '12:00',
                breakEnd: '13:00'
              }
            ]
          }
        ],
        appointmentPreferences: {
          maxAppointmentsPerDay: 16,
          appointmentTypes: ['mtm_session', 'health_check'],
          defaultDuration: 30
        },
        isActive: true,
        effectiveFrom: subDays(new Date(), 30),
        createdBy: pharmacistId
      });

      // Create some appointments for capacity calculation
      await Appointment.create({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'mtm_session',
        title: 'Capacity Test Appointment',
        scheduledDate: subDays(new Date(), 1),
        scheduledTime: '10:00',
        duration: 30,
        status: 'completed',
        createdBy: pharmacistId
      });
    });

    it('should generate PDF capacity report', async () => {
      const options: ReportOptions = {
        workplaceId,
        startDate: subDays(new Date(), 7),
        endDate: new Date(),
        format: 'pdf',
        includeDetails: true
      };

      const reportBuffer = await ReportGenerationService.generateCapacityReport(options);

      expect(reportBuffer).toBeInstanceOf(Buffer);
      expect(reportBuffer.length).toBeGreaterThan(0);
      
      const pdfHeader = reportBuffer.toString('ascii', 0, 4);
      expect(pdfHeader).toBe('%PDF');
    });

    it('should generate CSV capacity report', async () => {
      const options: ReportOptions = {
        workplaceId,
        startDate: subDays(new Date(), 7),
        endDate: new Date(),
        format: 'csv'
      };

      const reportBuffer = await ReportGenerationService.generateCapacityReport(options);

      expect(reportBuffer).toBeInstanceOf(Buffer);
      expect(reportBuffer.length).toBeGreaterThan(0);
      
      const csvContent = reportBuffer.toString('utf8');
      expect(csvContent).toContain('pharmacistName');
      expect(csvContent).toContain('totalSlots');
      expect(csvContent).toContain('utilizationRate');
    });
  });

  describe('error handling', () => {
    it('should throw error for invalid format', async () => {
      const options: ReportOptions = {
        workplaceId,
        startDate: subDays(new Date(), 7),
        endDate: new Date(),
        format: 'invalid' as any
      };

      await expect(
        ReportGenerationService.generateAppointmentReport(options)
      ).rejects.toThrow('Unsupported format: invalid');
    });

    it('should handle database connection errors', async () => {
      // Disconnect from database
      await mongoose.disconnect();

      const options: ReportOptions = {
        workplaceId,
        startDate: subDays(new Date(), 7),
        endDate: new Date(),
        format: 'pdf'
      };

      await expect(
        ReportGenerationService.generateAppointmentReport(options)
      ).rejects.toThrow();

      // Reconnect for cleanup
      const mongoUri = mongoServer.getUri();
      await mongoose.connect(mongoUri);
    });
  });
});