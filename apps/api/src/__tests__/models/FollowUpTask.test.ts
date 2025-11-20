/// <reference types="jest" />
import mongoose from 'mongoose';
import FollowUpTask, { IFollowUpTask } from '../../models/FollowUpTask';
import { User } from '../../models/User';
import { Workplace } from '../../models/Workplace';
import Patient from '../../models/Patient';

describe('FollowUpTask Model', () => {
  let testWorkplaceId: mongoose.Types.ObjectId;
  let testPharmacistId: mongoose.Types.ObjectId;
  let testPatientId: mongoose.Types.ObjectId;

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

    // Create test pharmacist
    const pharmacist = await User.create({
      email: 'pharmacist@test.com',
      passwordHash: 'hashedpassword',
      firstName: 'Test',
      lastName: 'Pharmacist',
      role: 'pharmacy_outlet',
      workplaceId: testWorkplaceId,
      currentPlanId: new mongoose.Types.ObjectId(),
    });
    testPharmacistId = pharmacist._id;

    // Create test patient
    const patient = await Patient.create({
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'male',
      phone: '+2348012345678',
      workplaceId: testWorkplaceId,
      createdBy: testPharmacistId,
    });
    testPatientId = patient._id;
  });

  describe('Model Creation', () => {
    it('should create a follow-up task with required fields', async () => {
      const task = await FollowUpTask.create({
        workplaceId: testWorkplaceId,
        patientId: testPatientId,
        assignedTo: testPharmacistId,
        type: 'medication_start_followup',
        title: 'Follow up on new medication',
        description: 'Check for adverse reactions and adherence',
        objectives: ['Check for side effects', 'Assess adherence'],
        priority: 'high',
        dueDate: new Date('2025-12-01'),
        trigger: {
          type: 'medication_start',
          triggerDate: new Date(),
        },
        createdBy: testPharmacistId,
      });

      expect(task).toBeDefined();
      expect(task.workplaceId).toEqual(testWorkplaceId);
      expect(task.patientId).toEqual(testPatientId);
      expect(task.type).toBe('medication_start_followup');
      expect(task.status).toBe('pending');
      expect(task.priority).toBe('high');
    });

    it('should set default priority to medium', async () => {
      const task = await FollowUpTask.create({
        workplaceId: testWorkplaceId,
        patientId: testPatientId,
        assignedTo: testPharmacistId,
        type: 'adherence_check',
        title: 'Adherence Check',
        description: 'Check medication adherence',
        objectives: ['Review adherence'],
        dueDate: new Date('2025-12-01'),
        trigger: {
          type: 'scheduled_monitoring',
          triggerDate: new Date(),
        },
        createdBy: testPharmacistId,
      });

      expect(task.priority).toBe('medium');
    });
  });

  describe('Validation', () => {
    it('should require workplaceId', async () => {
      const task = new FollowUpTask({
        patientId: testPatientId,
        assignedTo: testPharmacistId,
        type: 'medication_start_followup',
        title: 'Follow up',
        description: 'Check patient',
        objectives: ['Check'],
        dueDate: new Date('2025-12-01'),
        trigger: { type: 'manual', triggerDate: new Date() },
        createdBy: testPharmacistId,
      });

      await expect(task.save()).rejects.toThrow();
    });

    it('should require patientId', async () => {
      const task = new FollowUpTask({
        workplaceId: testWorkplaceId,
        assignedTo: testPharmacistId,
        type: 'medication_start_followup',
        title: 'Follow up',
        description: 'Check patient',
        objectives: ['Check'],
        dueDate: new Date('2025-12-01'),
        trigger: { type: 'manual', triggerDate: new Date() },
        createdBy: testPharmacistId,
      });

      await expect(task.save()).rejects.toThrow();
    });

    it('should validate task type enum', async () => {
      const task = new FollowUpTask({
        workplaceId: testWorkplaceId,
        patientId: testPatientId,
        assignedTo: testPharmacistId,
        type: 'invalid_type' as any,
        title: 'Follow up',
        description: 'Check patient',
        objectives: ['Check'],
        dueDate: new Date('2025-12-01'),
        trigger: { type: 'manual', triggerDate: new Date() },
        createdBy: testPharmacistId,
      });

      await expect(task.save()).rejects.toThrow();
    });

    it('should validate priority enum', async () => {
      const task = new FollowUpTask({
        workplaceId: testWorkplaceId,
        patientId: testPatientId,
        assignedTo: testPharmacistId,
        type: 'medication_start_followup',
        title: 'Follow up',
        description: 'Check patient',
        objectives: ['Check'],
        priority: 'invalid' as any,
        dueDate: new Date('2025-12-01'),
        trigger: { type: 'manual', triggerDate: new Date() },
        createdBy: testPharmacistId,
      });

      await expect(task.save()).rejects.toThrow();
    });

    it('should require at least one objective', async () => {
      const task = new FollowUpTask({
        workplaceId: testWorkplaceId,
        patientId: testPatientId,
        assignedTo: testPharmacistId,
        type: 'medication_start_followup',
        title: 'Follow up',
        description: 'Check patient',
        objectives: [],
        dueDate: new Date('2025-12-01'),
        trigger: { type: 'manual', triggerDate: new Date() },
        createdBy: testPharmacistId,
      });

      await expect(task.save()).rejects.toThrow('At least one objective is required');
    });

    it('should require outcome when status is completed', async () => {
      const task = new FollowUpTask({
        workplaceId: testWorkplaceId,
        patientId: testPatientId,
        assignedTo: testPharmacistId,
        type: 'medication_start_followup',
        title: 'Follow up',
        description: 'Check patient',
        objectives: ['Check'],
        dueDate: new Date('2025-12-01'),
        status: 'completed',
        trigger: { type: 'manual', triggerDate: new Date() },
        createdBy: testPharmacistId,
      });

      await expect(task.save()).rejects.toThrow('Outcome is required');
    });
  });

  describe('Virtual Properties', () => {
    let task: IFollowUpTask;

    beforeEach(async () => {
      task = await FollowUpTask.create({
        workplaceId: testWorkplaceId,
        patientId: testPatientId,
        assignedTo: testPharmacistId,
        type: 'medication_start_followup',
        title: 'Follow up',
        description: 'Check patient',
        objectives: ['Check for side effects'],
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        trigger: { type: 'medication_start', triggerDate: new Date() },
        createdBy: testPharmacistId,
      });
    });

    it('should calculate daysUntilDue correctly', () => {
      const days = task.get('daysUntilDue');
      expect(days).toBeGreaterThanOrEqual(2);
      expect(days).toBeLessThanOrEqual(4);
    });

    it('should determine if task is overdue', async () => {
      task.dueDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
      await task.save();

      expect(task.get('isOverdue')).toBe(true);
    });

    it('should calculate daysOverdue correctly', async () => {
      task.dueDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
      await task.save();

      const days = task.get('daysOverdue');
      expect(days).toBeGreaterThanOrEqual(1);
      expect(days).toBeLessThanOrEqual(3);
    });

    it('should track escalation count', async () => {
      task.escalationHistory = [
        {
          escalatedAt: new Date(),
          escalatedBy: testPharmacistId,
          fromPriority: 'medium',
          toPriority: 'high',
          reason: 'Patient condition worsening',
        },
      ];
      await task.save();

      expect(task.get('escalationCount')).toBe(1);
      expect(task.get('hasBeenEscalated')).toBe(true);
    });
  });

  describe('Instance Methods', () => {
    let task: IFollowUpTask;

    beforeEach(async () => {
      task = await FollowUpTask.create({
        workplaceId: testWorkplaceId,
        patientId: testPatientId,
        assignedTo: testPharmacistId,
        type: 'medication_start_followup',
        title: 'Follow up',
        description: 'Check patient',
        objectives: ['Check for side effects'],
        priority: 'medium',
        dueDate: new Date('2025-12-01'),
        trigger: { type: 'medication_start', triggerDate: new Date() },
        createdBy: testPharmacistId,
      });
    });

    describe('escalate()', () => {
      it('should escalate task priority', async () => {
        task.escalate('urgent', 'Patient condition worsening', testPharmacistId);
        await task.save();

        expect(task.priority).toBe('urgent');
        expect(task.escalationHistory.length).toBe(1);
        expect(task.escalationHistory[0].fromPriority).toBe('medium');
        expect(task.escalationHistory[0].toPriority).toBe('urgent');
      });
    });

    describe('complete()', () => {
      it('should complete task with outcome', async () => {
        const outcome = {
          status: 'successful' as const,
          notes: 'Patient doing well',
          nextActions: ['Schedule next follow-up'],
          appointmentCreated: false,
        };

        task.complete(outcome, testPharmacistId);
        await task.save();

        expect(task.status).toBe('completed');
        expect(task.outcome).toEqual(outcome);
        expect(task.completedAt).toBeDefined();
        expect(task.completedBy).toEqual(testPharmacistId);
      });
    });

    describe('convertToAppointment()', () => {
      it('should convert task to appointment', async () => {
        const appointmentId = new mongoose.Types.ObjectId();

        task.convertToAppointment(appointmentId);
        await task.save();

        expect(task.status).toBe('converted_to_appointment');
        expect(task.outcome?.appointmentCreated).toBe(true);
        expect(task.outcome?.appointmentId).toEqual(appointmentId);
        expect(task.relatedRecords.appointmentId).toEqual(appointmentId);
      });
    });

    describe('addReminder()', () => {
      it('should add reminder to task', async () => {
        task.addReminder('email', testPharmacistId);
        await task.save();

        expect(task.remindersSent.length).toBe(1);
        expect(task.remindersSent[0].channel).toBe('email');
        expect(task.remindersSent[0].recipientId).toEqual(testPharmacistId);
      });
    });

    describe('isCriticallyOverdue()', () => {
      it('should identify critically overdue tasks', async () => {
        task.dueDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
        await task.save();

        expect(task.isCriticallyOverdue(7)).toBe(true);
      });

      it('should not flag recent overdue tasks as critical', async () => {
        task.dueDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
        await task.save();

        expect(task.isCriticallyOverdue(7)).toBe(false);
      });
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      // Create test tasks
      await FollowUpTask.create({
        workplaceId: testWorkplaceId,
        patientId: testPatientId,
        assignedTo: testPharmacistId,
        type: 'medication_start_followup',
        title: 'Task 1',
        description: 'Check patient',
        objectives: ['Check'],
        priority: 'high',
        dueDate: new Date('2025-12-01'),
        status: 'pending',
        trigger: { type: 'medication_start', triggerDate: new Date() },
        createdBy: testPharmacistId,
      });

      await FollowUpTask.create({
        workplaceId: testWorkplaceId,
        patientId: testPatientId,
        assignedTo: testPharmacistId,
        type: 'adherence_check',
        title: 'Task 2',
        description: 'Check adherence',
        objectives: ['Review'],
        priority: 'low',
        dueDate: new Date('2025-12-02'),
        status: 'completed',
        outcome: {
          status: 'successful',
          notes: 'Completed',
          nextActions: [],
          appointmentCreated: false,
        },
        trigger: { type: 'scheduled_monitoring', triggerDate: new Date() },
        createdBy: testPharmacistId,
      });
    });

    describe('findByPatient()', () => {
      it('should find tasks by patient', async () => {
        const tasks = await (FollowUpTask as any).findByPatient(testPatientId);
        expect(tasks.length).toBeGreaterThanOrEqual(2);
      });

      it('should filter by status', async () => {
        const tasks = await (FollowUpTask as any).findByPatient(testPatientId, {
          status: 'pending',
        });
        expect(tasks.every((t: IFollowUpTask) => t.status === 'pending')).toBe(true);
      });
    });

    describe('findByPharmacist()', () => {
      it('should find tasks by pharmacist', async () => {
        const tasks = await (FollowUpTask as any).findByPharmacist(testPharmacistId);
        expect(tasks.length).toBeGreaterThanOrEqual(2);
      });

      it('should filter by priority', async () => {
        const tasks = await (FollowUpTask as any).findByPharmacist(testPharmacistId, {
          priority: 'high',
        });
        expect(tasks.every((t: IFollowUpTask) => t.priority === 'high')).toBe(true);
      });
    });

    describe('findOverdue()', () => {
      it('should find overdue tasks', async () => {
        await FollowUpTask.create({
          workplaceId: testWorkplaceId,
          patientId: testPatientId,
          assignedTo: testPharmacistId,
          type: 'refill_reminder',
          title: 'Overdue Task',
          description: 'Overdue',
          objectives: ['Check'],
          dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
          status: 'pending',
          trigger: { type: 'system_rule', triggerDate: new Date() },
          createdBy: testPharmacistId,
        });

        const tasks = await (FollowUpTask as any).findOverdue();
        expect(tasks.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('findDueSoon()', () => {
      it('should find tasks due soon', async () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        await FollowUpTask.create({
          workplaceId: testWorkplaceId,
          patientId: testPatientId,
          assignedTo: testPharmacistId,
          type: 'preventive_care',
          title: 'Due Soon Task',
          description: 'Due soon',
          objectives: ['Check'],
          dueDate: tomorrow,
          status: 'pending',
          trigger: { type: 'manual', triggerDate: new Date() },
          createdBy: testPharmacistId,
        });

        const tasks = await (FollowUpTask as any).findDueSoon(3);
        expect(tasks.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('findByTrigger()', () => {
      it('should find tasks by trigger type and source', async () => {
        const sourceId = new mongoose.Types.ObjectId();

        await FollowUpTask.create({
          workplaceId: testWorkplaceId,
          patientId: testPatientId,
          assignedTo: testPharmacistId,
          type: 'lab_result_review',
          title: 'Lab Review',
          description: 'Review lab results',
          objectives: ['Review'],
          dueDate: new Date('2025-12-01'),
          trigger: {
            type: 'lab_result',
            sourceId: sourceId,
            triggerDate: new Date(),
          },
          createdBy: testPharmacistId,
        });

        const tasks = await (FollowUpTask as any).findByTrigger('lab_result', sourceId);
        expect(tasks.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Auto-status Update', () => {
    it('should auto-update status to overdue for past due date', async () => {
      const task = await FollowUpTask.create({
        workplaceId: testWorkplaceId,
        patientId: testPatientId,
        assignedTo: testPharmacistId,
        type: 'medication_start_followup',
        title: 'Follow up',
        description: 'Check patient',
        objectives: ['Check'],
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        status: 'pending',
        trigger: { type: 'medication_start', triggerDate: new Date() },
        createdBy: testPharmacistId,
      });

      expect(task.status).toBe('overdue');
    });
  });
});
