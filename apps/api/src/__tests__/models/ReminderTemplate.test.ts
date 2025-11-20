/// <reference types="jest" />
import mongoose from 'mongoose';
import ReminderTemplate, { IReminderTemplate } from '../../models/ReminderTemplate';
import { User } from '../../models/User';
import { Workplace } from '../../models/Workplace';

describe('ReminderTemplate Model', () => {
  let testWorkplaceId: mongoose.Types.ObjectId;
  let testUserId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    // Create test workplace
    const workplace = await Workplace.create({
      name: 'Test Pharmacy',
      type: 'Community',
      licenseNumber: 'TEST123',
      email: 'test@pharmacy.com',
      ownerId: new mongoose.Types.ObjectId(),
    });
    testWorkplaceId = workplace._id;

    // Create test user
    const user = await User.create({
      email: 'user@test.com',
      passwordHash: 'hashedpassword',
      firstName: 'Test',
      lastName: 'User',
      role: 'pharmacy_outlet',
      workplaceId: testWorkplaceId,
      currentPlanId: new mongoose.Types.ObjectId(),
    });
    testUserId = user._id;
  });

  describe('Model Creation', () => {
    it('should create a reminder template with required fields', async () => {
      const template = await ReminderTemplate.create({
        workplaceId: testWorkplaceId,
        name: '24h Appointment Reminder',
        type: 'appointment',
        category: 'pre_appointment',
        channels: ['email', 'sms'],
        timing: {
          unit: 'hours',
          value: 24,
          relativeTo: 'before_appointment',
        },
        messageTemplates: {
          email: {
            subject: 'Appointment Reminder',
            body: 'You have an appointment tomorrow',
          },
          sms: {
            message: 'Reminder: Appointment tomorrow',
          },
        },
        createdBy: testUserId,
      });

      expect(template).toBeDefined();
      expect(template.workplaceId).toEqual(testWorkplaceId);
      expect(template.name).toBe('24h Appointment Reminder');
      expect(template.type).toBe('appointment');
      expect(template.isActive).toBe(true);
      expect(template.isDefault).toBe(false);
    });

    it('should initialize usage stats to zero', async () => {
      const template = await ReminderTemplate.create({
        workplaceId: testWorkplaceId,
        name: 'Test Template',
        type: 'appointment',
        category: 'pre_appointment',
        channels: ['email'],
        timing: {
          unit: 'hours',
          value: 2,
          relativeTo: 'before_appointment',
        },
        messageTemplates: {
          email: {
            subject: 'Test',
            body: 'Test message',
          },
        },
        createdBy: testUserId,
      });

      expect(template.usageStats.totalSent).toBe(0);
      expect(template.usageStats.totalDelivered).toBe(0);
      expect(template.usageStats.totalFailed).toBe(0);
    });
  });

  describe('Validation', () => {
    it('should require workplaceId', async () => {
      const template = new ReminderTemplate({
        name: 'Test Template',
        type: 'appointment',
        category: 'pre_appointment',
        channels: ['email'],
        timing: { unit: 'hours', value: 24, relativeTo: 'before_appointment' },
        messageTemplates: {
          email: { subject: 'Test', body: 'Test' },
        },
        createdBy: testUserId,
      });

      await expect(template.save()).rejects.toThrow();
    });

    it('should validate type enum', async () => {
      const template = new ReminderTemplate({
        workplaceId: testWorkplaceId,
        name: 'Test Template',
        type: 'invalid_type' as any,
        category: 'pre_appointment',
        channels: ['email'],
        timing: { unit: 'hours', value: 24, relativeTo: 'before_appointment' },
        messageTemplates: {
          email: { subject: 'Test', body: 'Test' },
        },
        createdBy: testUserId,
      });

      await expect(template.save()).rejects.toThrow();
    });

    it('should validate channel enum', async () => {
      const template = new ReminderTemplate({
        workplaceId: testWorkplaceId,
        name: 'Test Template',
        type: 'appointment',
        category: 'pre_appointment',
        channels: ['invalid_channel' as any],
        timing: { unit: 'hours', value: 24, relativeTo: 'before_appointment' },
        messageTemplates: {
          email: { subject: 'Test', body: 'Test' },
        },
        createdBy: testUserId,
      });

      await expect(template.save()).rejects.toThrow();
    });

    it('should require at least one channel', async () => {
      const template = new ReminderTemplate({
        workplaceId: testWorkplaceId,
        name: 'Test Template',
        type: 'appointment',
        category: 'pre_appointment',
        channels: [],
        timing: { unit: 'hours', value: 24, relativeTo: 'before_appointment' },
        messageTemplates: {
          email: { subject: 'Test', body: 'Test' },
        },
        createdBy: testUserId,
      });

      await expect(template.save()).rejects.toThrow();
    });

    it('should enforce SMS message length limit', async () => {
      const longMessage = 'a'.repeat(161);
      const template = new ReminderTemplate({
        workplaceId: testWorkplaceId,
        name: 'Test Template',
        type: 'appointment',
        category: 'pre_appointment',
        channels: ['sms'],
        timing: { unit: 'hours', value: 24, relativeTo: 'before_appointment' },
        messageTemplates: {
          sms: { message: longMessage },
        },
        createdBy: testUserId,
      });

      await expect(template.save()).rejects.toThrow();
    });

    it('should require message template for selected channel', async () => {
      const template = new ReminderTemplate({
        workplaceId: testWorkplaceId,
        name: 'Test Template',
        type: 'appointment',
        category: 'pre_appointment',
        channels: ['email'],
        timing: { unit: 'hours', value: 24, relativeTo: 'before_appointment' },
        messageTemplates: {},
        createdBy: testUserId,
      });

      await expect(template.save()).rejects.toThrow('Email template is required');
    });
  });

  describe('Virtual Properties', () => {
    let template: IReminderTemplate;

    beforeEach(async () => {
      template = await ReminderTemplate.create({
        workplaceId: testWorkplaceId,
        name: 'Test Template',
        type: 'appointment',
        category: 'pre_appointment',
        channels: ['email', 'sms'],
        timing: {
          unit: 'hours',
          value: 24,
          relativeTo: 'before_appointment',
        },
        messageTemplates: {
          email: {
            subject: 'Test',
            body: 'Test message',
          },
          sms: {
            message: 'Test SMS',
          },
        },
        createdBy: testUserId,
      });
    });

    it('should calculate delivery success rate', async () => {
      template.usageStats.totalSent = 100;
      template.usageStats.totalDelivered = 95;
      await template.save();

      expect(template.get('deliverySuccessRate')).toBe(95);
    });

    it('should calculate failure rate', async () => {
      template.usageStats.totalSent = 100;
      template.usageStats.totalFailed = 5;
      await template.save();

      expect(template.get('failureRate')).toBe(5);
    });

    it('should detect email template presence', () => {
      expect(template.get('hasEmailTemplate')).toBe(true);
    });

    it('should detect SMS template presence', () => {
      expect(template.get('hasSmsTemplate')).toBe(true);
    });

    it('should calculate timing in milliseconds', () => {
      const ms = template.get('timingInMilliseconds');
      expect(ms).toBe(24 * 60 * 60 * 1000); // 24 hours in ms
    });
  });

  describe('Instance Methods', () => {
    let template: IReminderTemplate;

    beforeEach(async () => {
      template = await ReminderTemplate.create({
        workplaceId: testWorkplaceId,
        name: 'Test Template',
        type: 'appointment',
        category: 'pre_appointment',
        channels: ['email', 'sms'],
        timing: {
          unit: 'hours',
          value: 24,
          relativeTo: 'before_appointment',
        },
        messageTemplates: {
          email: {
            subject: 'Appointment for {{patientName}}',
            body: 'Dear {{patientName}}, your appointment is on {{appointmentDate}}',
          },
          sms: {
            message: 'Hi {{patientName}}, appointment on {{appointmentDate}}',
          },
        },
        createdBy: testUserId,
      });
    });

    describe('renderMessage()', () => {
      it('should render email message with placeholders', () => {
        const rendered = template.renderMessage('email', {
          patientName: 'John Doe',
          appointmentDate: '2025-12-01',
        });

        expect(rendered.subject).toBe('Appointment for John Doe');
        expect(rendered.body).toContain('Dear John Doe');
        expect(rendered.body).toContain('2025-12-01');
      });

      it('should render SMS message with placeholders', () => {
        const rendered = template.renderMessage('sms', {
          patientName: 'John Doe',
          appointmentDate: '2025-12-01',
        });

        expect(rendered.message).toContain('John Doe');
        expect(rendered.message).toContain('2025-12-01');
      });

      it('should throw error for missing channel template', () => {
        expect(() => {
          template.renderMessage('push', {});
        }).toThrow('No push template found');
      });
    });

    describe('matchesConditions()', () => {
      beforeEach(async () => {
        template.conditions = {
          appointmentTypes: ['mtm_session', 'health_check'],
          patientAgeRange: { min: 18, max: 65 },
        };
        await template.save();
      });

      it('should match when all conditions are met', () => {
        const matches = template.matchesConditions({
          appointmentType: 'mtm_session',
          patientAge: 30,
        });

        expect(matches).toBe(true);
      });

      it('should not match when appointment type is wrong', () => {
        const matches = template.matchesConditions({
          appointmentType: 'vaccination',
          patientAge: 30,
        });

        expect(matches).toBe(false);
      });

      it('should not match when age is out of range', () => {
        const matches = template.matchesConditions({
          appointmentType: 'mtm_session',
          patientAge: 70,
        });

        expect(matches).toBe(false);
      });
    });

    describe('incrementSent()', () => {
      it('should increment sent count', async () => {
        template.incrementSent();
        await template.save();

        expect(template.usageStats.totalSent).toBe(1);
        expect(template.usageStats.lastUsedAt).toBeDefined();
      });
    });

    describe('incrementDelivered()', () => {
      it('should increment delivered count', async () => {
        template.incrementDelivered();
        await template.save();

        expect(template.usageStats.totalDelivered).toBe(1);
      });
    });

    describe('incrementFailed()', () => {
      it('should increment failed count', async () => {
        template.incrementFailed();
        await template.save();

        expect(template.usageStats.totalFailed).toBe(1);
      });
    });

    describe('calculateScheduledTime()', () => {
      it('should calculate time before appointment', () => {
        const appointmentDate = new Date('2025-12-01T10:00:00');
        const scheduledTime = template.calculateScheduledTime(appointmentDate);

        const expectedTime = new Date(appointmentDate.getTime() - 24 * 60 * 60 * 1000);
        expect(scheduledTime.getTime()).toBe(expectedTime.getTime());
      });

      it('should calculate time after event', async () => {
        template.timing.relativeTo = 'after_event';
        await template.save();

        const eventDate = new Date('2025-12-01T10:00:00');
        const scheduledTime = template.calculateScheduledTime(eventDate);

        const expectedTime = new Date(eventDate.getTime() + 24 * 60 * 60 * 1000);
        expect(scheduledTime.getTime()).toBe(expectedTime.getTime());
      });
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      await ReminderTemplate.create({
        workplaceId: testWorkplaceId,
        name: 'Template 1',
        type: 'appointment',
        category: 'pre_appointment',
        channels: ['email'],
        timing: { unit: 'hours', value: 24, relativeTo: 'before_appointment' },
        messageTemplates: {
          email: { subject: 'Test', body: 'Test' },
        },
        isActive: true,
        isDefault: true,
        createdBy: testUserId,
      });

      await ReminderTemplate.create({
        workplaceId: testWorkplaceId,
        name: 'Template 2',
        type: 'medication_refill',
        category: 'medication',
        channels: ['sms'],
        timing: { unit: 'days', value: 7, relativeTo: 'before_due_date' },
        messageTemplates: {
          sms: { message: 'Refill reminder' },
        },
        isActive: true,
        createdBy: testUserId,
      });

      await ReminderTemplate.create({
        workplaceId: testWorkplaceId,
        name: 'Template 3',
        type: 'appointment',
        category: 'pre_appointment',
        channels: ['email'],
        timing: { unit: 'hours', value: 2, relativeTo: 'before_appointment' },
        messageTemplates: {
          email: { subject: 'Test', body: 'Test' },
        },
        isActive: false,
        createdBy: testUserId,
      });
    });

    describe('findByType()', () => {
      it('should find templates by type', async () => {
        const templates = await (ReminderTemplate as any).findByType('appointment');
        expect(templates.length).toBeGreaterThanOrEqual(2);
      });

      it('should filter by active status', async () => {
        const templates = await (ReminderTemplate as any).findByType('appointment', undefined, true);
        expect(templates.every((t: IReminderTemplate) => t.isActive)).toBe(true);
      });
    });

    describe('findDefault()', () => {
      it('should find default template for type', async () => {
        const template = await (ReminderTemplate as any).findDefault('appointment');
        expect(template).toBeDefined();
        expect(template.isDefault).toBe(true);
        expect(template.type).toBe('appointment');
      });
    });

    describe('findByCategory()', () => {
      it('should find templates by category', async () => {
        const templates = await (ReminderTemplate as any).findByCategory('pre_appointment');
        expect(templates.length).toBeGreaterThanOrEqual(2);
      });
    });

    describe('findForAppointmentType()', () => {
      it('should find templates for specific appointment type', async () => {
        const template = await ReminderTemplate.findOne({ name: 'Template 1' });
        template!.conditions = {
          appointmentTypes: ['mtm_session'],
        };
        await template!.save();

        const templates = await (ReminderTemplate as any).findForAppointmentType('mtm_session');
        expect(templates.length).toBeGreaterThanOrEqual(1);
      });
    });
  });
});
