/**
 * FollowUpService Unit Tests
 * Tests all core methods of the FollowUpService
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

/// <reference types="jest" />

import mongoose from 'mongoose';
import { FollowUpService } from '../../services/FollowUpService';
import FollowUpTask, { IFollowUpTask } from '../../models/FollowUpTask';
import Appointment, { IAppointment } from '../../models/Appointment';
import Patient from '../../models/Patient';
import User from '../../models/User';

// Mock dependencies
jest.mock('../../models/FollowUpTask');
jest.mock('../../models/Appointment');
jest.mock('../../models/Patient');
jest.mock('../../models/User');
jest.mock('../../utils/logger');

// Import setup after mocks
import './setup.test';

describe('FollowUpService', () => {
  const mockWorkplaceId = new mongoose.Types.ObjectId();
  const mockPatientId = new mongoose.Types.ObjectId();
  const mockPharmacistId = new mongoose.Types.ObjectId();
  const mockTaskId = new mongoose.Types.ObjectId();
  const mockAppointmentId = new mongoose.Types.ObjectId();

  const mockPatient = {
    _id: mockPatientId,
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+2348012345678',
  };

  const mockPharmacist = {
    _id: mockPharmacistId,
    name: 'Dr. Smith',
    email: 'smith@pharmacy.com',
    role: 'pharmacist',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createFollowUpTask', () => {
    it('should create a follow-up task successfully', async () => {
      // Arrange
      const taskData = {
        patientId: mockPatientId,
        type: 'medication_start_followup' as IFollowUpTask['type'],
        title: 'High-Risk Medication Follow-up',
        description: 'Follow-up for patient starting Warfarin',
        objectives: ['Check INR levels', 'Assess for bleeding', 'Review diet'],
        priority: 'high' as IFollowUpTask['priority'],
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        trigger: {
          type: 'medication_start' as IFollowUpTask['trigger']['type'],
          triggerDate: new Date(),
        },
      };

      const mockTask = {
        _id: mockTaskId,
        ...taskData,
        workplaceId: mockWorkplaceId,
        assignedTo: mockPharmacistId,
        status: 'pending',
        save: jest.fn().mockResolvedValue(true),
      };

      (Patient.findById as jest.Mock).mockResolvedValue(mockPatient);
      (User.findById as jest.Mock).mockResolvedValue(mockPharmacist);
      (FollowUpTask as any).mockImplementation(() => mockTask);

      // Act
      const result = await FollowUpService.createFollowUpTask(
        taskData,
        mockWorkplaceId,
        mockPharmacistId
      );

      // Assert
      expect(Patient.findById).toHaveBeenCalledWith(mockPatientId);
      expect(User.findById).toHaveBeenCalledWith(mockPharmacistId);
      expect(mockTask.save).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.type).toBe('medication_start_followup');
    });

    it('should throw error if patient not found', async () => {
      // Arrange
      const taskData = {
        patientId: mockPatientId,
        type: 'medication_start_followup' as IFollowUpTask['type'],
        title: 'Test Task',
        description: 'Test description for follow-up',
        objectives: ['Test objective'],
        priority: 'medium' as IFollowUpTask['priority'],
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        trigger: {
          type: 'manual' as IFollowUpTask['trigger']['type'],
          triggerDate: new Date(),
        },
      };

      (Patient.findById as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(
        FollowUpService.createFollowUpTask(taskData, mockWorkplaceId, mockPharmacistId)
      ).rejects.toThrow('Patient');
    });

    it('should throw error if due date is in the past', async () => {
      // Arrange
      const taskData = {
        patientId: mockPatientId,
        type: 'general_followup' as IFollowUpTask['type'],
        title: 'Test Task',
        description: 'Test description for follow-up',
        objectives: ['Test objective'],
        priority: 'medium' as IFollowUpTask['priority'],
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        trigger: {
          type: 'manual' as IFollowUpTask['trigger']['type'],
          triggerDate: new Date(),
        },
      };

      (Patient.findById as jest.Mock).mockResolvedValue(mockPatient);
      (User.findById as jest.Mock).mockResolvedValue(mockPharmacist);

      // Act & Assert
      await expect(
        FollowUpService.createFollowUpTask(taskData, mockWorkplaceId, mockPharmacistId)
      ).rejects.toThrow('past due dates');
    });

    it('should throw error if no objectives provided', async () => {
      // Arrange
      const taskData = {
        patientId: mockPatientId,
        type: 'general_followup' as IFollowUpTask['type'],
        title: 'Test Task',
        description: 'Test description for follow-up',
        objectives: [],
        priority: 'medium' as IFollowUpTask['priority'],
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        trigger: {
          type: 'manual' as IFollowUpTask['trigger']['type'],
          triggerDate: new Date(),
        },
      };

      (Patient.findById as jest.Mock).mockResolvedValue(mockPatient);
      (User.findById as jest.Mock).mockResolvedValue(mockPharmacist);

      // Act & Assert
      await expect(
        FollowUpService.createFollowUpTask(taskData, mockWorkplaceId, mockPharmacistId)
      ).rejects.toThrow('At least one objective is required');
    });

    it('should throw error if title is too short', async () => {
      // Arrange
      const taskData = {
        patientId: mockPatientId,
        type: 'general_followup' as IFollowUpTask['type'],
        title: 'AB', // Too short
        description: 'Test description for follow-up',
        objectives: ['Test objective'],
        priority: 'medium' as IFollowUpTask['priority'],
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        trigger: {
          type: 'manual' as IFollowUpTask['trigger']['type'],
          triggerDate: new Date(),
        },
      };

      (Patient.findById as jest.Mock).mockResolvedValue(mockPatient);
      (User.findById as jest.Mock).mockResolvedValue(mockPharmacist);

      // Act & Assert
      await expect(
        FollowUpService.createFollowUpTask(taskData, mockWorkplaceId, mockPharmacistId)
      ).rejects.toThrow('Title must be between 3 and 200 characters');
    });
  });

  describe('createAutomatedFollowUp', () => {
    it('should create automated follow-up for medication start', async () => {
      // Arrange
      const automatedData = {
        patientId: mockPatientId,
        triggerType: 'medication_start' as IFollowUpTask['trigger']['type'],
        sourceId: new mongoose.Types.ObjectId(),
        sourceType: 'Medication',
        triggerDetails: {
          medicationName: 'Warfarin',
          isHighRisk: true,
        },
      };

      const mockTask = {
        _id: mockTaskId,
        patientId: mockPatientId,
        type: 'medication_start_followup',
        title: 'High-Risk Medication Follow-up - John Doe',
        priority: 'high',
        save: jest.fn().mockResolvedValue(true),
      };

      (Patient.findById as jest.Mock).mockResolvedValue(mockPatient);
      (User.findById as jest.Mock).mockResolvedValue(mockPharmacist);
      (FollowUpTask as any).mockImplementation(() => mockTask);

      // Act
      const result = await FollowUpService.createAutomatedFollowUp(
        automatedData,
        mockWorkplaceId,
        mockPharmacistId
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.type).toBe('medication_start_followup');
      expect(result.priority).toBe('high');
    });

    it('should create automated follow-up for lab result', async () => {
      // Arrange
      const automatedData = {
        patientId: mockPatientId,
        triggerType: 'lab_result' as IFollowUpTask['trigger']['type'],
        sourceId: new mongoose.Types.ObjectId(),
        sourceType: 'LabResult',
        triggerDetails: {
          testName: 'INR',
          value: 4.5,
          isAbnormal: true,
        },
      };

      const mockTask = {
        _id: mockTaskId,
        patientId: mockPatientId,
        type: 'lab_result_review',
        title: 'Abnormal Lab Results Review - John Doe',
        priority: 'high',
        save: jest.fn().mockResolvedValue(true),
      };

      (Patient.findById as jest.Mock).mockResolvedValue(mockPatient);
      (User.findById as jest.Mock).mockResolvedValue(mockPharmacist);
      (FollowUpTask as any).mockImplementation(() => mockTask);

      // Act
      const result = await FollowUpService.createAutomatedFollowUp(
        automatedData,
        mockWorkplaceId,
        mockPharmacistId
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.type).toBe('lab_result_review');
      expect(result.priority).toBe('high');
    });

    it('should create automated follow-up for hospital discharge', async () => {
      // Arrange
      const automatedData = {
        patientId: mockPatientId,
        triggerType: 'hospital_discharge' as IFollowUpTask['trigger']['type'],
        sourceId: new mongoose.Types.ObjectId(),
        sourceType: 'HospitalDischarge',
      };

      const mockTask = {
        _id: mockTaskId,
        patientId: mockPatientId,
        type: 'hospital_discharge_followup',
        title: 'Post-Discharge Follow-up - John Doe',
        priority: 'urgent',
        save: jest.fn().mockResolvedValue(true),
      };

      (Patient.findById as jest.Mock).mockResolvedValue(mockPatient);
      (User.findById as jest.Mock).mockResolvedValue(mockPharmacist);
      (FollowUpTask as any).mockImplementation(() => mockTask);

      // Act
      const result = await FollowUpService.createAutomatedFollowUp(
        automatedData,
        mockWorkplaceId,
        mockPharmacistId
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.type).toBe('hospital_discharge_followup');
      expect(result.priority).toBe('urgent');
    });
  });

  describe('getFollowUpTasks', () => {
    it('should get follow-up tasks with filters', async () => {
      // Arrange
      const filters = {
        status: 'pending',
        priority: 'high',
        assignedTo: mockPharmacistId,
      };

      const options = {
        page: 1,
        limit: 10,
        populate: true,
      };

      const mockTasks = [
        {
          _id: mockTaskId,
          patientId: mockPatientId,
          type: 'medication_start_followup',
          status: 'pending',
          priority: 'high',
        },
      ];

      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockTasks),
      };

      (FollowUpTask.find as jest.Mock).mockReturnValue(mockQuery);
      (FollowUpTask.countDocuments as jest.Mock).mockResolvedValue(1);
      (FollowUpTask.aggregate as jest.Mock).mockResolvedValue([]);

      // Act
      const result = await FollowUpService.getFollowUpTasks(
        filters,
        options,
        mockWorkplaceId
      );

      // Assert
      expect(result.tasks).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
      expect(result.summary).toBeDefined();
    });

    it('should filter overdue tasks', async () => {
      // Arrange
      const filters = {
        overdue: true,
      };

      const options = {
        page: 1,
        limit: 10,
      };

      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };

      (FollowUpTask.find as jest.Mock).mockReturnValue(mockQuery);
      (FollowUpTask.countDocuments as jest.Mock).mockResolvedValue(0);
      (FollowUpTask.aggregate as jest.Mock).mockResolvedValue([]);

      // Act
      const result = await FollowUpService.getFollowUpTasks(
        filters,
        options,
        mockWorkplaceId
      );

      // Assert
      expect(FollowUpTask.find).toHaveBeenCalledWith(
        expect.objectContaining({
          dueDate: expect.objectContaining({ $lt: expect.any(Date) }),
          status: expect.objectContaining({ $in: ['pending', 'in_progress', 'overdue'] }),
        })
      );
    });

    it('should filter tasks due soon', async () => {
      // Arrange
      const filters = {
        dueSoon: 3,
      };

      const options = {
        page: 1,
        limit: 10,
      };

      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };

      (FollowUpTask.find as jest.Mock).mockReturnValue(mockQuery);
      (FollowUpTask.countDocuments as jest.Mock).mockResolvedValue(0);
      (FollowUpTask.aggregate as jest.Mock).mockResolvedValue([]);

      // Act
      const result = await FollowUpService.getFollowUpTasks(
        filters,
        options,
        mockWorkplaceId
      );

      // Assert
      expect(FollowUpTask.find).toHaveBeenCalledWith(
        expect.objectContaining({
          dueDate: expect.objectContaining({
            $gte: expect.any(Date),
            $lte: expect.any(Date),
          }),
        })
      );
    });
  });

  describe('completeFollowUpTask', () => {
    it('should complete a follow-up task successfully', async () => {
      // Arrange
      const outcomeData = {
        outcome: {
          status: 'successful' as const,
          notes: 'Patient is doing well. No adverse effects observed.',
          nextActions: ['Schedule 3-month follow-up'],
          appointmentCreated: false,
        },
      };

      const mockTask = {
        _id: mockTaskId,
        status: 'pending',
        complete: jest.fn(),
        save: jest.fn().mockResolvedValue(true),
      };

      (FollowUpTask.findOne as jest.Mock).mockResolvedValue(mockTask);

      // Act
      const result = await FollowUpService.completeFollowUpTask(
        mockTaskId,
        outcomeData,
        mockPharmacistId,
        mockWorkplaceId
      );

      // Assert
      expect(mockTask.complete).toHaveBeenCalledWith(
        outcomeData.outcome,
        mockPharmacistId
      );
      expect(mockTask.save).toHaveBeenCalled();
    });

    it('should throw error if task not found', async () => {
      // Arrange
      const outcomeData = {
        outcome: {
          status: 'successful' as const,
          notes: 'Test notes',
          nextActions: [],
          appointmentCreated: false,
        },
      };

      (FollowUpTask.findOne as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(
        FollowUpService.completeFollowUpTask(
          mockTaskId,
          outcomeData,
          mockPharmacistId,
          mockWorkplaceId
        )
      ).rejects.toThrow('Follow-up task');
    });

    it('should throw error if task already completed', async () => {
      // Arrange
      const outcomeData = {
        outcome: {
          status: 'successful' as const,
          notes: 'Test notes',
          nextActions: [],
          appointmentCreated: false,
        },
      };

      const mockTask = {
        _id: mockTaskId,
        status: 'completed',
      };

      (FollowUpTask.findOne as jest.Mock).mockResolvedValue(mockTask);

      // Act & Assert
      await expect(
        FollowUpService.completeFollowUpTask(
          mockTaskId,
          outcomeData,
          mockPharmacistId,
          mockWorkplaceId
        )
      ).rejects.toThrow('Cannot complete task with status: completed');
    });

    it('should throw error if outcome notes are missing', async () => {
      // Arrange
      const outcomeData = {
        outcome: {
          status: 'successful' as const,
          notes: '',
          nextActions: [],
          appointmentCreated: false,
        },
      };

      const mockTask = {
        _id: mockTaskId,
        status: 'pending',
      };

      (FollowUpTask.findOne as jest.Mock).mockResolvedValue(mockTask);

      // Act & Assert
      await expect(
        FollowUpService.completeFollowUpTask(
          mockTaskId,
          outcomeData,
          mockPharmacistId,
          mockWorkplaceId
        )
      ).rejects.toThrow('Outcome notes are required');
    });
  });

  describe('convertToAppointment', () => {
    it('should convert follow-up task to appointment successfully', async () => {
      // Arrange
      const appointmentData = {
        scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        scheduledTime: '10:00',
        duration: 30,
        type: 'general_followup' as IAppointment['type'],
        description: 'Follow-up appointment',
      };

      const mockTask = {
        _id: mockTaskId,
        patientId: mockPatientId,
        assignedTo: mockPharmacistId,
        title: 'Test Task',
        description: 'Test description',
        type: 'general_followup',
        status: 'pending',
        locationId: undefined,
        convertToAppointment: jest.fn(),
        save: jest.fn().mockResolvedValue(true),
      };

      const mockAppointment = {
        _id: mockAppointmentId,
        patientId: mockPatientId,
        relatedRecords: {},
        save: jest.fn().mockResolvedValue(true),
      };

      (FollowUpTask.findOne as jest.Mock).mockResolvedValue(mockTask);

      // Mock the dynamic import
      jest.mock('../../services/AppointmentService', () => ({
        AppointmentService: {
          createAppointment: jest.fn().mockResolvedValue(mockAppointment),
        },
      }));

      // Act
      const result = await FollowUpService.convertToAppointment(
        mockTaskId,
        appointmentData,
        mockPharmacistId,
        mockWorkplaceId
      );

      // Assert
      expect(mockTask.convertToAppointment).toHaveBeenCalledWith(mockAppointmentId);
      expect(mockTask.save).toHaveBeenCalled();
      expect(result.task).toBeDefined();
      expect(result.appointment).toBeDefined();
    });

    it('should throw error if task not found', async () => {
      // Arrange
      const appointmentData = {
        scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        scheduledTime: '10:00',
        duration: 30,
        type: 'general_followup' as IAppointment['type'],
      };

      (FollowUpTask.findOne as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(
        FollowUpService.convertToAppointment(
          mockTaskId,
          appointmentData,
          mockPharmacistId,
          mockWorkplaceId
        )
      ).rejects.toThrow('Follow-up task');
    });

    it('should throw error if task already converted', async () => {
      // Arrange
      const appointmentData = {
        scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        scheduledTime: '10:00',
        duration: 30,
        type: 'general_followup' as IAppointment['type'],
      };

      const mockTask = {
        _id: mockTaskId,
        status: 'converted_to_appointment',
      };

      (FollowUpTask.findOne as jest.Mock).mockResolvedValue(mockTask);

      // Act & Assert
      await expect(
        FollowUpService.convertToAppointment(
          mockTaskId,
          appointmentData,
          mockPharmacistId,
          mockWorkplaceId
        )
      ).rejects.toThrow('Cannot convert task with status: converted_to_appointment');
    });

    it('should throw error if appointment date is in the past', async () => {
      // Arrange
      const appointmentData = {
        scheduledDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        scheduledTime: '10:00',
        duration: 30,
        type: 'general_followup' as IAppointment['type'],
      };

      const mockTask = {
        _id: mockTaskId,
        status: 'pending',
      };

      (FollowUpTask.findOne as jest.Mock).mockResolvedValue(mockTask);

      // Act & Assert
      await expect(
        FollowUpService.convertToAppointment(
          mockTaskId,
          appointmentData,
          mockPharmacistId,
          mockWorkplaceId
        )
      ).rejects.toThrow('Cannot schedule appointments in the past');
    });
  });

  describe('escalateFollowUp', () => {
    it('should escalate follow-up priority successfully', async () => {
      // Arrange
      const escalationData = {
        newPriority: 'urgent' as IFollowUpTask['priority'],
        reason: 'Patient condition worsening',
      };

      const mockTask = {
        _id: mockTaskId,
        priority: 'medium',
        status: 'pending',
        escalationHistory: [],
        escalate: jest.fn(),
        save: jest.fn().mockResolvedValue(true),
      };

      (FollowUpTask.findOne as jest.Mock).mockResolvedValue(mockTask);

      // Act
      const result = await FollowUpService.escalateFollowUp(
        mockTaskId,
        escalationData,
        mockPharmacistId,
        mockWorkplaceId
      );

      // Assert
      expect(mockTask.escalate).toHaveBeenCalledWith(
        'urgent',
        'Patient condition worsening',
        mockPharmacistId
      );
      expect(mockTask.save).toHaveBeenCalled();
    });

    it('should throw error if task not found', async () => {
      // Arrange
      const escalationData = {
        newPriority: 'urgent' as IFollowUpTask['priority'],
        reason: 'Test reason',
      };

      (FollowUpTask.findOne as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(
        FollowUpService.escalateFollowUp(
          mockTaskId,
          escalationData,
          mockPharmacistId,
          mockWorkplaceId
        )
      ).rejects.toThrow('Follow-up task');
    });

    it('should throw error if task already completed', async () => {
      // Arrange
      const escalationData = {
        newPriority: 'urgent' as IFollowUpTask['priority'],
        reason: 'Test reason',
      };

      const mockTask = {
        _id: mockTaskId,
        status: 'completed',
      };

      (FollowUpTask.findOne as jest.Mock).mockResolvedValue(mockTask);

      // Act & Assert
      await expect(
        FollowUpService.escalateFollowUp(
          mockTaskId,
          escalationData,
          mockPharmacistId,
          mockWorkplaceId
        )
      ).rejects.toThrow('Cannot escalate task with status: completed');
    });

    it('should throw error if new priority is not higher', async () => {
      // Arrange
      const escalationData = {
        newPriority: 'low' as IFollowUpTask['priority'],
        reason: 'Test reason',
      };

      const mockTask = {
        _id: mockTaskId,
        priority: 'medium',
        status: 'pending',
      };

      (FollowUpTask.findOne as jest.Mock).mockResolvedValue(mockTask);

      // Act & Assert
      await expect(
        FollowUpService.escalateFollowUp(
          mockTaskId,
          escalationData,
          mockPharmacistId,
          mockWorkplaceId
        )
      ).rejects.toThrow('must be higher than current priority');
    });

    it('should throw error if reason is missing', async () => {
      // Arrange
      const escalationData = {
        newPriority: 'urgent' as IFollowUpTask['priority'],
        reason: '',
      };

      const mockTask = {
        _id: mockTaskId,
        priority: 'medium',
        status: 'pending',
      };

      (FollowUpTask.findOne as jest.Mock).mockResolvedValue(mockTask);

      // Act & Assert
      await expect(
        FollowUpService.escalateFollowUp(
          mockTaskId,
          escalationData,
          mockPharmacistId,
          mockWorkplaceId
        )
      ).rejects.toThrow('Escalation reason is required');
    });
  });
});
