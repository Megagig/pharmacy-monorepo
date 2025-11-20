/**
 * Follow-Up Monitor Processor Tests
 * Tests for the follow-up monitoring job processor
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

import { Job } from 'bull';
import mongoose from 'mongoose';
import {
  processFollowUpMonitor,
  onFollowUpMonitorCompleted,
  onFollowUpMonitorFailed,
  FollowUpMonitorResult,
} from '../followUpMonitorProcessor';
import { FollowUpMonitorJobData } from '../../config/queue';
import FollowUpTask, { IFollowUpTask } from '../../models/FollowUpTask';
import User from '../../models/User';
import Notification from '../../models/Notification';

// Mock dependencies
jest.mock('../../models/FollowUpTask');
jest.mock('../../models/User');
jest.mock('../../models/Notification');
jest.mock('../../utils/logger');

describe('Follow-Up Monitor Processor', () => {
  let mockJob: Partial<Job<FollowUpMonitorJobData>>;
  let workplaceId: string;

  beforeEach(() => {
    workplaceId = new mongoose.Types.ObjectId().toString();
    
    mockJob = {
      id: 'test-job-id',
      data: {
        workplaceId,
        checkOverdue: true,
        escalateCritical: true,
      },
      attemptsMade: 0,
      opts: {
        attempts: 3,
      },
      progress: jest.fn().mockResolvedValue(undefined),
      processedOn: Date.now(),
    };

    jest.clearAllMocks();
  });

  describe('processFollowUpMonitor', () => {
    it('should process follow-up monitor job successfully with no overdue tasks', async () => {
      // Mock no tasks found
      (FollowUpTask.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });

      const result = await processFollowUpMonitor(mockJob as Job<FollowUpMonitorJobData>);

      expect(result).toMatchObject({
        workplaceId,
        totalChecked: 0,
        overdueFound: 0,
        escalated: 0,
        notificationsSent: 0,
        managerAlertsSent: 0,
        errors: 0,
      });

      expect(mockJob.progress).toHaveBeenCalledWith(10);
      expect(mockJob.progress).toHaveBeenCalledWith(30);
    });

    it('should identify overdue tasks correctly', async () => {
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      
      const mockTasks = [
        {
          _id: new mongoose.Types.ObjectId(),
          workplaceId: new mongoose.Types.ObjectId(workplaceId),
          patientId: { _id: new mongoose.Types.ObjectId(), firstName: 'John', lastName: 'Doe' },
          assignedTo: { _id: new mongoose.Types.ObjectId(), firstName: 'Dr', lastName: 'Smith', email: 'dr@test.com' },
          type: 'medication_start_followup',
          title: 'Follow-up for new medication',
          priority: 'medium',
          dueDate: twoDaysAgo,
          status: 'pending',
          remindersSent: [],
        },
      ];

      (FollowUpTask.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockTasks),
      });

      (FollowUpTask.findByIdAndUpdate as jest.Mock).mockResolvedValue({});
      (Notification.prototype.save as jest.Mock).mockResolvedValue({});
      (FollowUpTask.findByIdAndUpdate as jest.Mock).mockResolvedValue({});

      const result = await processFollowUpMonitor(mockJob as Job<FollowUpMonitorJobData>);

      expect(result.totalChecked).toBe(1);
      expect(result.overdueFound).toBe(1);
      expect(result.details.overdueByPriority.medium).toBe(1);
    });

    it('should send notifications to assigned pharmacists for overdue tasks', async () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
      
      const pharmacistId = new mongoose.Types.ObjectId();
      const mockTasks = [
        {
          _id: new mongoose.Types.ObjectId(),
          workplaceId: new mongoose.Types.ObjectId(workplaceId),
          patientId: { _id: new mongoose.Types.ObjectId(), firstName: 'Jane', lastName: 'Smith' },
          assignedTo: { _id: pharmacistId, firstName: 'Dr', lastName: 'Johnson', email: 'dr.johnson@test.com' },
          type: 'lab_result_review',
          title: 'Review lab results',
          priority: 'high',
          dueDate: oneDayAgo,
          status: 'pending',
          remindersSent: [],
        },
      ];

      (FollowUpTask.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockTasks),
      });

      (FollowUpTask.findByIdAndUpdate as jest.Mock).mockResolvedValue({});
      (Notification.prototype.save as jest.Mock).mockResolvedValue({});

      const result = await processFollowUpMonitor(mockJob as Job<FollowUpMonitorJobData>);

      expect(result.notificationsSent).toBe(1);
      expect(Notification.prototype.save).toHaveBeenCalled();
    });

    it('should not send duplicate notifications within 24 hours', async () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      
      const mockTasks = [
        {
          _id: new mongoose.Types.ObjectId(),
          workplaceId: new mongoose.Types.ObjectId(workplaceId),
          patientId: { _id: new mongoose.Types.ObjectId(), firstName: 'John', lastName: 'Doe' },
          assignedTo: { _id: new mongoose.Types.ObjectId(), firstName: 'Dr', lastName: 'Smith', email: 'dr@test.com' },
          type: 'medication_start_followup',
          title: 'Follow-up task',
          priority: 'medium',
          dueDate: oneDayAgo,
          status: 'pending',
          remindersSent: [
            {
              sentAt: twoHoursAgo,
              channel: 'system',
              recipientId: new mongoose.Types.ObjectId(),
            },
          ],
        },
      ];

      (FollowUpTask.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockTasks),
      });

      (FollowUpTask.findByIdAndUpdate as jest.Mock).mockResolvedValue({});

      const result = await processFollowUpMonitor(mockJob as Job<FollowUpMonitorJobData>);

      expect(result.notificationsSent).toBe(0);
      expect(Notification.prototype.save).not.toHaveBeenCalled();
    });

    it('should escalate priority for tasks overdue by 1 day', async () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
      
      const taskId = new mongoose.Types.ObjectId();
      const mockTasks = [
        {
          _id: taskId,
          workplaceId: new mongoose.Types.ObjectId(workplaceId),
          patientId: { _id: new mongoose.Types.ObjectId(), firstName: 'John', lastName: 'Doe' },
          assignedTo: { _id: new mongoose.Types.ObjectId(), firstName: 'Dr', lastName: 'Smith', email: 'dr@test.com' },
          type: 'medication_start_followup',
          title: 'Follow-up task',
          priority: 'medium',
          dueDate: oneDayAgo,
          status: 'pending',
          remindersSent: [],
        },
      ];

      const mockTaskDoc = {
        _id: taskId,
        priority: 'medium',
        escalate: jest.fn(),
        save: jest.fn().mockResolvedValue({}),
      };

      (FollowUpTask.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockTasks),
      });

      (FollowUpTask.findByIdAndUpdate as jest.Mock).mockResolvedValue({});
      (FollowUpTask.findById as jest.Mock).mockResolvedValue(mockTaskDoc);
      (Notification.prototype.save as jest.Mock).mockResolvedValue({});

      const result = await processFollowUpMonitor(mockJob as Job<FollowUpMonitorJobData>);

      expect(result.escalated).toBe(1);
      expect(mockTaskDoc.escalate).toHaveBeenCalledWith(
        'high',
        expect.stringContaining('1 days overdue'),
        expect.any(mongoose.Types.ObjectId)
      );
    });

    it('should escalate to urgent for tasks overdue by 3 days', async () => {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      
      const taskId = new mongoose.Types.ObjectId();
      const mockTasks = [
        {
          _id: taskId,
          workplaceId: new mongoose.Types.ObjectId(workplaceId),
          patientId: { _id: new mongoose.Types.ObjectId(), firstName: 'John', lastName: 'Doe' },
          assignedTo: { _id: new mongoose.Types.ObjectId(), firstName: 'Dr', lastName: 'Smith', email: 'dr@test.com' },
          type: 'medication_start_followup',
          title: 'Follow-up task',
          priority: 'medium',
          dueDate: threeDaysAgo,
          status: 'pending',
          remindersSent: [],
        },
      ];

      const mockTaskDoc = {
        _id: taskId,
        priority: 'medium',
        escalate: jest.fn(),
        save: jest.fn().mockResolvedValue({}),
      };

      (FollowUpTask.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockTasks),
      });

      (FollowUpTask.findByIdAndUpdate as jest.Mock).mockResolvedValue({});
      (FollowUpTask.findById as jest.Mock).mockResolvedValue(mockTaskDoc);
      (Notification.prototype.save as jest.Mock).mockResolvedValue({});

      const result = await processFollowUpMonitor(mockJob as Job<FollowUpMonitorJobData>);

      expect(result.escalated).toBe(1);
      expect(mockTaskDoc.escalate).toHaveBeenCalledWith(
        'urgent',
        expect.stringContaining('3 days overdue'),
        expect.any(mongoose.Types.ObjectId)
      );
    });

    it('should send manager alerts for critical overdue tasks (7+ days)', async () => {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const taskId = new mongoose.Types.ObjectId();
      const managerId = new mongoose.Types.ObjectId();
      
      const mockTasks = [
        {
          _id: taskId,
          workplaceId: new mongoose.Types.ObjectId(workplaceId),
          patientId: { _id: new mongoose.Types.ObjectId(), firstName: 'John', lastName: 'Doe' },
          assignedTo: { _id: new mongoose.Types.ObjectId(), firstName: 'Dr', lastName: 'Smith', email: 'dr@test.com' },
          type: 'medication_start_followup',
          title: 'Critical follow-up task',
          priority: 'medium',
          dueDate: sevenDaysAgo,
          status: 'pending',
          remindersSent: [],
        },
      ];

      const mockTaskDoc = {
        _id: taskId,
        priority: 'medium',
        escalate: jest.fn(),
        save: jest.fn().mockResolvedValue({}),
      };

      const mockManagers = [
        {
          _id: managerId,
          firstName: 'Manager',
          lastName: 'One',
          email: 'manager@test.com',
          role: 'manager',
        },
      ];

      (FollowUpTask.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockTasks),
      });

      (FollowUpTask.findByIdAndUpdate as jest.Mock).mockResolvedValue({});
      (FollowUpTask.findById as jest.Mock).mockResolvedValue(mockTaskDoc);
      (User.find as jest.Mock).mockResolvedValue(mockManagers);
      (Notification.insertMany as jest.Mock).mockResolvedValue([]);
      (Notification.prototype.save as jest.Mock).mockResolvedValue({});

      const result = await processFollowUpMonitor(mockJob as Job<FollowUpMonitorJobData>);

      expect(result.escalated).toBe(1);
      expect(result.managerAlertsSent).toBe(1);
      expect(mockTaskDoc.escalate).toHaveBeenCalledWith(
        'critical',
        expect.stringContaining('7 days overdue'),
        expect.any(mongoose.Types.ObjectId)
      );
      expect(Notification.insertMany).toHaveBeenCalled();
    });

    it('should not escalate tasks already at target priority', async () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
      
      const mockTasks = [
        {
          _id: new mongoose.Types.ObjectId(),
          workplaceId: new mongoose.Types.ObjectId(workplaceId),
          patientId: { _id: new mongoose.Types.ObjectId(), firstName: 'John', lastName: 'Doe' },
          assignedTo: { _id: new mongoose.Types.ObjectId(), firstName: 'Dr', lastName: 'Smith', email: 'dr@test.com' },
          type: 'medication_start_followup',
          title: 'Follow-up task',
          priority: 'critical', // Already at highest priority
          dueDate: oneDayAgo,
          status: 'pending',
          remindersSent: [],
        },
      ];

      (FollowUpTask.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockTasks),
      });

      (FollowUpTask.findByIdAndUpdate as jest.Mock).mockResolvedValue({});
      (Notification.prototype.save as jest.Mock).mockResolvedValue({});

      const result = await processFollowUpMonitor(mockJob as Job<FollowUpMonitorJobData>);

      expect(result.escalated).toBe(0);
      expect(FollowUpTask.findById).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully and continue processing other tasks', async () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
      
      const mockTasks = [
        {
          _id: new mongoose.Types.ObjectId(),
          workplaceId: new mongoose.Types.ObjectId(workplaceId),
          patientId: { _id: new mongoose.Types.ObjectId(), firstName: 'John', lastName: 'Doe' },
          assignedTo: { _id: new mongoose.Types.ObjectId(), firstName: 'Dr', lastName: 'Smith', email: 'dr@test.com' },
          type: 'medication_start_followup',
          title: 'Task 1',
          priority: 'medium',
          dueDate: oneDayAgo,
          status: 'pending',
          remindersSent: [],
        },
        {
          _id: new mongoose.Types.ObjectId(),
          workplaceId: new mongoose.Types.ObjectId(workplaceId),
          patientId: { _id: new mongoose.Types.ObjectId(), firstName: 'Jane', lastName: 'Smith' },
          assignedTo: { _id: new mongoose.Types.ObjectId(), firstName: 'Dr', lastName: 'Johnson', email: 'dr.johnson@test.com' },
          type: 'lab_result_review',
          title: 'Task 2',
          priority: 'high',
          dueDate: oneDayAgo,
          status: 'pending',
          remindersSent: [],
        },
      ];

      (FollowUpTask.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockTasks),
      });

      // First task fails, second succeeds
      (FollowUpTask.findByIdAndUpdate as jest.Mock)
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce({});
      
      (Notification.prototype.save as jest.Mock).mockResolvedValue({});

      const result = await processFollowUpMonitor(mockJob as Job<FollowUpMonitorJobData>);

      expect(result.errors).toBe(1);
      expect(result.overdueFound).toBe(2);
    });

    it('should skip processing if checkOverdue is false', async () => {
      mockJob.data!.checkOverdue = false;

      (FollowUpTask.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });

      const result = await processFollowUpMonitor(mockJob as Job<FollowUpMonitorJobData>);

      expect(result.overdueFound).toBe(0);
      expect(result.escalated).toBe(0);
      expect(FollowUpTask.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should throw error on critical failure', async () => {
      (FollowUpTask.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockRejectedValue(new Error('Database connection failed')),
      });

      await expect(
        processFollowUpMonitor(mockJob as Job<FollowUpMonitorJobData>)
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('onFollowUpMonitorCompleted', () => {
    it('should log completion successfully', () => {
      const result: FollowUpMonitorResult = {
        workplaceId,
        totalChecked: 10,
        overdueFound: 3,
        escalated: 2,
        notificationsSent: 3,
        managerAlertsSent: 1,
        errors: 0,
        processingTime: 1500,
        details: {
          overdueByPriority: { medium: 2, high: 1 },
          escalatedTasks: ['task1', 'task2'],
          criticalTasks: ['task1'],
        },
      };

      expect(() => {
        onFollowUpMonitorCompleted(mockJob as Job<FollowUpMonitorJobData>, result);
      }).not.toThrow();
    });

    it('should log warnings for errors', () => {
      const result: FollowUpMonitorResult = {
        workplaceId,
        totalChecked: 10,
        overdueFound: 3,
        escalated: 2,
        notificationsSent: 0,
        managerAlertsSent: 0,
        errors: 2,
        processingTime: 1500,
        details: {
          overdueByPriority: { medium: 2, high: 1 },
          escalatedTasks: [],
          criticalTasks: [],
        },
      };

      expect(() => {
        onFollowUpMonitorCompleted(mockJob as Job<FollowUpMonitorJobData>, result);
      }).not.toThrow();
    });
  });

  describe('onFollowUpMonitorFailed', () => {
    it('should log failure and retry information', async () => {
      const error = new Error('Processing failed');
      mockJob.attemptsMade = 1;

      await expect(
        onFollowUpMonitorFailed(mockJob as Job<FollowUpMonitorJobData>, error)
      ).resolves.not.toThrow();
    });

    it('should send critical alerts when all retries exhausted', async () => {
      const error = new Error('Final failure');
      mockJob.attemptsMade = 3;

      const mockAdmins = [
        {
          _id: new mongoose.Types.ObjectId(),
          firstName: 'Admin',
          lastName: 'User',
          email: 'admin@test.com',
          role: 'admin',
        },
      ];

      (User.find as jest.Mock).mockResolvedValue(mockAdmins);
      (Notification.insertMany as jest.Mock).mockResolvedValue([]);

      await onFollowUpMonitorFailed(mockJob as Job<FollowUpMonitorJobData>, error);

      expect(User.find).toHaveBeenCalled();
      expect(Notification.insertMany).toHaveBeenCalled();
    });

    it('should handle alert sending failure gracefully', async () => {
      const error = new Error('Final failure');
      mockJob.attemptsMade = 3;

      (User.find as jest.Mock).mockRejectedValue(new Error('User query failed'));

      await expect(
        onFollowUpMonitorFailed(mockJob as Job<FollowUpMonitorJobData>, error)
      ).resolves.not.toThrow();
    });
  });
});
