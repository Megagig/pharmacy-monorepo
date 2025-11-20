import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import FollowUpTask, { IFollowUpTask } from '../../models/FollowUpTask';

describe('Enhanced FollowUpTask Model - Refill Requests', () => {
  let mongoServer: MongoMemoryServer;
  let testWorkplaceId: mongoose.Types.ObjectId;
  let testPatientId: mongoose.Types.ObjectId;
  let testPharmacistId: mongoose.Types.ObjectId;
  let testMedicationId: mongoose.Types.ObjectId;
  let testPatientUserId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
    
    testWorkplaceId = new mongoose.Types.ObjectId();
    testPatientId = new mongoose.Types.ObjectId();
    testPharmacistId = new mongoose.Types.ObjectId();
    testMedicationId = new mongoose.Types.ObjectId();
    testPatientUserId = new mongoose.Types.ObjectId();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await FollowUpTask.deleteMany({});
  });

  describe('Refill Request Task Creation', () => {
    const validRefillTaskData = {
      workplaceId: testWorkplaceId,
      patientId: testPatientId,
      assignedTo: testPharmacistId,
      type: 'medication_refill_request' as const,
      title: 'Refill Request: Metformin 500mg',
      description: 'Patient has requested a refill for Metformin 500mg',
      objectives: ['Review refill eligibility', 'Process request'],
      priority: 'medium' as const,
      dueDate: new Date(Date.now() + 72 * 60 * 60 * 1000), // 3 days
      trigger: {
        type: 'manual' as const,
        sourceId: testMedicationId,
        sourceType: 'Medication',
        triggerDate: new Date(),
      },
      relatedRecords: {
        medicationId: testMedicationId,
      },
      metadata: {
        refillRequest: {
          medicationId: testMedicationId,
          medicationName: 'Metformin 500mg',
          currentRefillsRemaining: 3,
          requestedQuantity: 30,
          urgency: 'routine' as const,
          patientNotes: 'Running low on medication',
          requestedBy: testPatientUserId,
          requestedAt: new Date(),
        },
      },
      createdBy: testPatientUserId,
    };

    it('should create a valid refill request task', async () => {
      const task = new FollowUpTask(validRefillTaskData);
      const savedTask = await task.save();

      expect(savedTask._id).toBeDefined();
      expect(savedTask.type).toBe('medication_refill_request');
      expect(savedTask.metadata?.refillRequest?.medicationName).toBe('Metformin 500mg');
      expect(savedTask.metadata?.refillRequest?.urgency).toBe('routine');
      expect(savedTask.status).toBe('pending');
    });

    it('should require refill request metadata for refill request tasks', async () => {
      const taskWithoutMetadata = {
        ...validRefillTaskData,
        metadata: undefined,
      };

      const task = new FollowUpTask(taskWithoutMetadata);
      await expect(task.save()).rejects.toThrow('Refill request metadata is required');
    });

    it('should validate refill request fields', async () => {
      const invalidRefillData = {
        ...validRefillTaskData,
        metadata: {
          refillRequest: {
            // Missing required fields
            urgency: 'routine',
          },
        },
      };

      const task = new FollowUpTask(invalidRefillData);
      await expect(task.save()).rejects.toThrow();
    });

    it('should validate urgency enum', async () => {
      const invalidUrgency = {
        ...validRefillTaskData,
        metadata: {
          refillRequest: {
            ...validRefillTaskData.metadata.refillRequest,
            urgency: 'invalid_urgency' as any,
          },
        },
      };

      const task = new FollowUpTask(invalidUrgency);
      await expect(task.save()).rejects.toThrow('Urgency must be routine or urgent');
    });

    it('should validate requested quantity range', async () => {
      const invalidQuantity = {
        ...validRefillTaskData,
        metadata: {
          refillRequest: {
            ...validRefillTaskData.metadata.refillRequest,
            requestedQuantity: 0, // Invalid
          },
        },
      };

      const task = new FollowUpTask(invalidQuantity);
      await expect(task.save()).rejects.toThrow('Requested quantity must be at least 1');
    });

    it('should validate refills remaining range', async () => {
      const invalidRefills = {
        ...validRefillTaskData,
        metadata: {
          refillRequest: {
            ...validRefillTaskData.metadata.refillRequest,
            currentRefillsRemaining: -1, // Invalid
          },
        },
      };

      const task = new FollowUpTask(invalidRefills);
      await expect(task.save()).rejects.toThrow('Refills remaining cannot be negative');
    });

    it('should validate estimated pickup date is not in past', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const invalidPickupDate = {
        ...validRefillTaskData,
        metadata: {
          refillRequest: {
            ...validRefillTaskData.metadata.refillRequest,
            estimatedPickupDate: pastDate,
          },
        },
      };

      const task = new FollowUpTask(invalidPickupDate);
      await expect(task.save()).rejects.toThrow('Estimated pickup date cannot be in the past');
    });

    it('should set high priority for urgent requests', async () => {
      const urgentRequest = {
        ...validRefillTaskData,
        metadata: {
          refillRequest: {
            ...validRefillTaskData.metadata.refillRequest,
            urgency: 'urgent' as const,
          },
        },
      };

      const task = new FollowUpTask(urgentRequest);
      const savedTask = await task.save();

      expect(savedTask.priority).toBe('high');
    });

    it('should set high priority for low refills remaining', async () => {
      const lowRefillsRequest = {
        ...validRefillTaskData,
        metadata: {
          refillRequest: {
            ...validRefillTaskData.metadata.refillRequest,
            currentRefillsRemaining: 1, // Low refills
          },
        },
      };

      const task = new FollowUpTask(lowRefillsRequest);
      const savedTask = await task.save();

      expect(savedTask.priority).toBe('high');
    });
  });

  describe('Refill Request Instance Methods', () => {
    let refillTask: IFollowUpTask;

    beforeEach(async () => {
      refillTask = await FollowUpTask.create({
        workplaceId: testWorkplaceId,
        patientId: testPatientId,
        assignedTo: testPharmacistId,
        type: 'medication_refill_request',
        title: 'Refill Request: Metformin 500mg',
        description: 'Patient has requested a refill for Metformin 500mg',
        objectives: ['Review refill eligibility', 'Process request'],
        priority: 'medium',
        dueDate: new Date(Date.now() + 72 * 60 * 60 * 1000),
        trigger: {
          type: 'manual',
          sourceId: testMedicationId,
          sourceType: 'Medication',
          triggerDate: new Date(),
        },
        relatedRecords: {
          medicationId: testMedicationId,
        },
        metadata: {
          refillRequest: {
            medicationId: testMedicationId,
            medicationName: 'Metformin 500mg',
            currentRefillsRemaining: 3,
            requestedQuantity: 30,
            urgency: 'routine',
            patientNotes: 'Running low on medication',
            requestedBy: testPatientUserId,
            requestedAt: new Date(),
          },
        },
        createdBy: testPatientUserId,
      });
    });

    it('should approve refill request', () => {
      refillTask.approveRefillRequest(30, testPharmacistId, 'Approved as requested');

      expect(refillTask.status).toBe('completed');
      expect(refillTask.completedBy).toEqual(testPharmacistId);
      expect(refillTask.completedAt).toBeInstanceOf(Date);
      expect(refillTask.metadata?.refillRequest?.approvedQuantity).toBe(30);
      expect(refillTask.metadata?.refillRequest?.pharmacistNotes).toBe('Approved as requested');
      expect(refillTask.outcome?.status).toBe('successful');
    });

    it('should deny refill request', () => {
      refillTask.denyRefillRequest('No refills remaining', testPharmacistId);

      expect(refillTask.status).toBe('completed');
      expect(refillTask.completedBy).toEqual(testPharmacistId);
      expect(refillTask.metadata?.refillRequest?.denialReason).toBe('No refills remaining');
      expect(refillTask.outcome?.status).toBe('unsuccessful');
    });

    it('should require new prescription', () => {
      refillTask.requireNewPrescription(testPharmacistId, 'Prescription expired');

      expect(refillTask.status).toBe('completed');
      expect(refillTask.completedBy).toEqual(testPharmacistId);
      expect(refillTask.metadata?.refillRequest?.prescriptionRequired).toBe(true);
      expect(refillTask.metadata?.refillRequest?.pharmacistNotes).toBe('Prescription expired');
      expect(refillTask.outcome?.status).toBe('partially_successful');
    });

    it('should check refill eligibility', () => {
      expect(refillTask.isRefillEligible()).toBe(true);

      // Complete the task
      refillTask.status = 'completed';
      expect(refillTask.isRefillEligible()).toBe(false);

      // Reset and test with no refills remaining
      refillTask.status = 'pending';
      refillTask.metadata!.refillRequest!.currentRefillsRemaining = 0;
      expect(refillTask.isRefillEligible()).toBe(false);
    });

    it('should get refill request details', () => {
      const details = refillTask.getRefillRequestDetails();

      expect(details).toBeDefined();
      expect(details.medicationName).toBe('Metformin 500mg');
      expect(details.requestedQuantity).toBe(30);
      expect(details.currentRefillsRemaining).toBe(3);
      expect(details.urgency).toBe('routine');
      expect(details.isEligible).toBe(true);
      expect(details.status).toBe('pending');
    });

    it('should return null for non-refill tasks', async () => {
      const regularTask = await FollowUpTask.create({
        workplaceId: testWorkplaceId,
        patientId: testPatientId,
        assignedTo: testPharmacistId,
        type: 'general_followup',
        title: 'General Follow-up',
        description: 'Regular follow-up task',
        objectives: ['Follow up with patient'],
        priority: 'medium',
        dueDate: new Date(Date.now() + 72 * 60 * 60 * 1000),
        trigger: {
          type: 'manual',
          triggerDate: new Date(),
        },
        createdBy: testPharmacistId,
      });

      expect(regularTask.getRefillRequestDetails()).toBeNull();
    });

    it('should throw error when calling refill methods on non-refill tasks', async () => {
      const regularTask = await FollowUpTask.create({
        workplaceId: testWorkplaceId,
        patientId: testPatientId,
        assignedTo: testPharmacistId,
        type: 'general_followup',
        title: 'General Follow-up',
        description: 'Regular follow-up task',
        objectives: ['Follow up with patient'],
        priority: 'medium',
        dueDate: new Date(Date.now() + 72 * 60 * 60 * 1000),
        trigger: {
          type: 'manual',
          triggerDate: new Date(),
        },
        createdBy: testPharmacistId,
      });

      expect(() => {
        regularTask.approveRefillRequest(30, testPharmacistId);
      }).toThrow('This method can only be called on refill request tasks');

      expect(() => {
        regularTask.denyRefillRequest('Test reason', testPharmacistId);
      }).toThrow('This method can only be called on refill request tasks');

      expect(() => {
        regularTask.requireNewPrescription(testPharmacistId);
      }).toThrow('This method can only be called on refill request tasks');
    });
  });

  describe('Static Methods for Refill Requests', () => {
    beforeEach(async () => {
      // Create test refill requests
      await FollowUpTask.create([
        {
          workplaceId: testWorkplaceId,
          patientId: testPatientId,
          assignedTo: testPharmacistId,
          type: 'medication_refill_request',
          title: 'Refill Request: Metformin 500mg',
          description: 'Routine refill request',
          objectives: ['Process refill'],
          priority: 'medium',
          dueDate: new Date(Date.now() + 72 * 60 * 60 * 1000),
          status: 'pending',
          trigger: { type: 'manual', triggerDate: new Date() },
          metadata: {
            refillRequest: {
              medicationId: testMedicationId,
              medicationName: 'Metformin 500mg',
              currentRefillsRemaining: 3,
              requestedQuantity: 30,
              urgency: 'routine',
              requestedBy: testPatientUserId,
              requestedAt: new Date(),
            },
          },
          createdBy: testPatientUserId,
        },
        {
          workplaceId: testWorkplaceId,
          patientId: new mongoose.Types.ObjectId(),
          assignedTo: testPharmacistId,
          type: 'medication_refill_request',
          title: 'Refill Request: Lisinopril 10mg',
          description: 'Urgent refill request',
          objectives: ['Process urgent refill'],
          priority: 'high',
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          status: 'pending',
          trigger: { type: 'manual', triggerDate: new Date() },
          metadata: {
            refillRequest: {
              medicationId: new mongoose.Types.ObjectId(),
              medicationName: 'Lisinopril 10mg',
              currentRefillsRemaining: 1,
              requestedQuantity: 30,
              urgency: 'urgent',
              requestedBy: testPatientUserId,
              requestedAt: new Date(),
            },
          },
          createdBy: testPatientUserId,
        },
        {
          workplaceId: testWorkplaceId,
          patientId: testPatientId,
          assignedTo: testPharmacistId,
          type: 'general_followup',
          title: 'General Follow-up',
          description: 'Regular follow-up task',
          objectives: ['Follow up'],
          priority: 'medium',
          dueDate: new Date(Date.now() + 72 * 60 * 60 * 1000),
          trigger: { type: 'manual', triggerDate: new Date() },
          createdBy: testPharmacistId,
        },
      ]);
    });

    it('should find refill requests', async () => {
      const refillRequests = await FollowUpTask.findRefillRequests(testWorkplaceId);
      expect(refillRequests).toHaveLength(2);
      expect(refillRequests.every(task => task.type === 'medication_refill_request')).toBe(true);
    });

    it('should filter refill requests by status', async () => {
      const pendingRequests = await FollowUpTask.findRefillRequests(testWorkplaceId, {
        status: 'pending',
      });
      expect(pendingRequests).toHaveLength(2);
    });

    it('should filter refill requests by urgency', async () => {
      const urgentRequests = await FollowUpTask.findRefillRequests(testWorkplaceId, {
        urgency: 'urgent',
      });
      expect(urgentRequests).toHaveLength(1);
      expect(urgentRequests[0].metadata?.refillRequest?.urgency).toBe('urgent');
    });

    it('should filter refill requests by patient', async () => {
      const patientRequests = await FollowUpTask.findRefillRequests(testWorkplaceId, {
        patientId: testPatientId,
      });
      expect(patientRequests).toHaveLength(1);
    });

    it('should find urgent refill requests', async () => {
      const urgentRequests = await FollowUpTask.findUrgentRefillRequests(testWorkplaceId);
      expect(urgentRequests).toHaveLength(1);
      expect(urgentRequests[0].metadata?.refillRequest?.urgency).toBe('urgent');
    });

    it('should create refill request task', async () => {
      const refillRequestData = {
        workplaceId: testWorkplaceId,
        patientId: testPatientId,
        assignedTo: testPharmacistId,
        medicationId: testMedicationId,
        medicationName: 'Atorvastatin 20mg',
        currentRefillsRemaining: 2,
        requestedQuantity: 30,
        urgency: 'routine' as const,
        patientNotes: 'Need refill for travel',
        requestedBy: testPatientUserId,
      };

      const createdTask = await FollowUpTask.createRefillRequest(refillRequestData);

      expect(createdTask.type).toBe('medication_refill_request');
      expect(createdTask.title).toContain('Atorvastatin 20mg');
      expect(createdTask.metadata?.refillRequest?.medicationName).toBe('Atorvastatin 20mg');
      expect(createdTask.metadata?.refillRequest?.requestedQuantity).toBe(30);
      expect(createdTask.metadata?.refillRequest?.patientNotes).toBe('Need refill for travel');
      expect(createdTask.priority).toBe('medium');
    });

    it('should create urgent refill request with high priority', async () => {
      const urgentRefillData = {
        workplaceId: testWorkplaceId,
        patientId: testPatientId,
        assignedTo: testPharmacistId,
        medicationId: testMedicationId,
        medicationName: 'Insulin',
        currentRefillsRemaining: 1,
        requestedQuantity: 10,
        urgency: 'urgent' as const,
        requestedBy: testPatientUserId,
      };

      const createdTask = await FollowUpTask.createRefillRequest(urgentRefillData);

      expect(createdTask.priority).toBe('high');
      expect(createdTask.metadata?.refillRequest?.urgency).toBe('urgent');
      // Urgent tasks should have shorter due date (1 day vs 3 days)
      const expectedDueDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const actualDueDate = createdTask.dueDate;
      const timeDifference = Math.abs(actualDueDate.getTime() - expectedDueDate.getTime());
      expect(timeDifference).toBeLessThan(60 * 1000); // Within 1 minute
    });
  });

  describe('Pre-save Validation for Refill Requests', () => {
    it('should validate requested quantity against refills remaining', async () => {
      const excessiveQuantity = {
        workplaceId: testWorkplaceId,
        patientId: testPatientId,
        assignedTo: testPharmacistId,
        type: 'medication_refill_request',
        title: 'Refill Request',
        description: 'Test request',
        objectives: ['Process'],
        priority: 'medium',
        dueDate: new Date(Date.now() + 72 * 60 * 60 * 1000),
        trigger: { type: 'manual', triggerDate: new Date() },
        metadata: {
          refillRequest: {
            medicationId: testMedicationId,
            medicationName: 'Test Med',
            currentRefillsRemaining: 1,
            requestedQuantity: 100, // Excessive quantity (1 refill * 30 days = 30 max reasonable)
            urgency: 'routine',
            requestedBy: testPatientUserId,
            requestedAt: new Date(),
          },
        },
        createdBy: testPatientUserId,
      };

      const task = new FollowUpTask(excessiveQuantity);
      await expect(task.save()).rejects.toThrow('Requested quantity exceeds reasonable limits');
    });

    it('should validate estimated pickup date is not too far in future', async () => {
      const farFutureDate = new Date();
      farFutureDate.setDate(farFutureDate.getDate() + 100); // 100 days in future

      const farFuturePickup = {
        workplaceId: testWorkplaceId,
        patientId: testPatientId,
        assignedTo: testPharmacistId,
        type: 'medication_refill_request',
        title: 'Refill Request',
        description: 'Test request',
        objectives: ['Process'],
        priority: 'medium',
        dueDate: new Date(Date.now() + 72 * 60 * 60 * 1000),
        trigger: { type: 'manual', triggerDate: new Date() },
        metadata: {
          refillRequest: {
            medicationId: testMedicationId,
            medicationName: 'Test Med',
            currentRefillsRemaining: 3,
            requestedQuantity: 30,
            urgency: 'routine',
            estimatedPickupDate: farFutureDate,
            requestedBy: testPatientUserId,
            requestedAt: new Date(),
          },
        },
        createdBy: testPatientUserId,
      };

      const task = new FollowUpTask(farFuturePickup);
      await expect(task.save()).rejects.toThrow('Estimated pickup date cannot be more than 90 days in the future');
    });
  });
});