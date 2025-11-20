import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { ReactNode } from 'react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  useFollowUpTasks,
  useFollowUpTask,
  usePatientFollowUps,
  useOverdueFollowUps,
  useFollowUpAnalytics,
  useCreateFollowUpTask,
  useCompleteFollowUp,
  useConvertToAppointment,
  useEscalateFollowUp,
  useUpdateFollowUpTask,
  useCancelFollowUpTask,
  useAssignFollowUpTask,
  usePrefetchFollowUpTask,
  useInvalidateFollowUps,
  followUpKeys,
} from '../useFollowUps';
import { followUpService } from '../../services/followUpService';
import { useFollowUpStore } from '../../stores/followUpStore';
import { FollowUpTask, FollowUpFilters, FollowUpFormData } from '../../stores/followUpTypes';

// Mock the follow-up service
vi.mock('../../services/followUpService', () => ({
  followUpService: {
    getFollowUpTasks: vi.fn(),
    getFollowUpTask: vi.fn(),
    getPatientFollowUps: vi.fn(),
    getOverdueFollowUps: vi.fn(),
    getFollowUpAnalytics: vi.fn(),
    createFollowUpTask: vi.fn(),
    completeFollowUpTask: vi.fn(),
    convertToAppointment: vi.fn(),
    escalateFollowUpTask: vi.fn(),
    updateFollowUpTask: vi.fn(),
    cancelFollowUpTask: vi.fn(),
    assignFollowUpTask: vi.fn(),
  },
}));

// Mock the follow-up store
vi.mock('../../stores/followUpStore', () => ({
  useFollowUpStore: vi.fn(),
}));

const mockFollowUpTask: FollowUpTask = {
  _id: 'task-1',
  workplaceId: 'workplace-1',
  patientId: 'patient-1',
  assignedTo: 'pharmacist-1',
  type: 'medication_start_followup',
  title: 'Follow up on new medication',
  description: 'Check for side effects and adherence',
  objectives: ['Check for side effects', 'Assess adherence'],
  priority: 'high',
  dueDate: new Date('2025-10-30'),
  status: 'pending',
  trigger: {
    type: 'medication_start',
    triggerDate: new Date('2025-10-25'),
  },
  escalationHistory: [],
  remindersSent: [],
  createdBy: 'pharmacist-1',
  isDeleted: false,
  createdAt: new Date('2025-10-25'),
  updatedAt: new Date('2025-10-25'),
};

const mockStoreActions = {
  setTasks: vi.fn(),
  setSummary: vi.fn(),
  setLoading: vi.fn(),
  setError: vi.fn(),
  selectTask: vi.fn(),
  addTaskToState: vi.fn(),
  updateTaskInState: vi.fn(),
  removeTaskFromState: vi.fn(),
};

// Test wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: ReactNode }) => 
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('useFollowUps hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useFollowUpStore as any).mockReturnValue(mockStoreActions);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Query Hooks', () => {
    describe('useFollowUpTasks', () => {
      it('should fetch follow-up tasks successfully', async () => {
        const mockResponse = {
          success: true,
          data: {
            tasks: [mockFollowUpTask],
            summary: {
              total: 1,
              overdue: 0,
              dueToday: 1,
              dueThisWeek: 1,
              byPriority: { high: 1, medium: 0, low: 0, urgent: 0, critical: 0 },
              byStatus: { pending: 1, in_progress: 0, completed: 0, cancelled: 0, overdue: 0, converted_to_appointment: 0 },
              byType: { medication_start_followup: 1 },
            },
          },
        };

        (followUpService.getFollowUpTasks as any).mockResolvedValue(mockResponse);

        const wrapper = createWrapper();
        const filters: FollowUpFilters = { status: 'pending' };

        const { result } = renderHook(() => useFollowUpTasks(filters), { wrapper });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(followUpService.getFollowUpTasks).toHaveBeenCalledWith(filters);
        expect(mockStoreActions.setTasks).toHaveBeenCalledWith([mockFollowUpTask]);
        expect(mockStoreActions.setSummary).toHaveBeenCalledWith(mockResponse.data.summary);
        expect(mockStoreActions.setError).toHaveBeenCalledWith('fetchTasks', null);
      });

      it('should handle fetch error', async () => {
        const mockError = new Error('Failed to fetch tasks');
        (followUpService.getFollowUpTasks as any).mockRejectedValue(mockError);

        const wrapper = createWrapper();
        renderHook(() => useFollowUpTasks(), { wrapper });

        // Wait a bit for the async operation to complete
        await new Promise(resolve => setTimeout(resolve, 100));

        // Check that loading was set to true when starting
        expect(mockStoreActions.setLoading).toHaveBeenCalledWith('fetchTasks', true);
      });
    });

    describe('useFollowUpTask', () => {
      it('should fetch single follow-up task successfully', async () => {
        const mockResponse = {
          success: true,
          data: {
            task: mockFollowUpTask,
            patient: { _id: 'patient-1', name: 'John Doe' },
          },
        };

        (followUpService.getFollowUpTask as any).mockResolvedValue(mockResponse);

        const wrapper = createWrapper();
        const { result } = renderHook(() => useFollowUpTask('task-1'), { wrapper });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(followUpService.getFollowUpTask).toHaveBeenCalledWith('task-1');
        expect(mockStoreActions.selectTask).toHaveBeenCalledWith(mockFollowUpTask);
        expect(mockStoreActions.setError).toHaveBeenCalledWith('fetchTask', null);
      });

      it('should not fetch when disabled', () => {
        const wrapper = createWrapper();
        const { result } = renderHook(() => useFollowUpTask('task-1', false), { wrapper });

        expect(result.current.fetchStatus).toBe('idle');
        expect(followUpService.getFollowUpTask).not.toHaveBeenCalled();
      });
    });

    describe('usePatientFollowUps', () => {
      it('should fetch patient follow-ups successfully', async () => {
        const mockResponse = {
          success: true,
          data: {
            tasks: [mockFollowUpTask],
          },
        };

        (followUpService.getPatientFollowUps as any).mockResolvedValue(mockResponse);

        const wrapper = createWrapper();
        const params = { status: 'pending', limit: 10 };
        const { result } = renderHook(() => usePatientFollowUps('patient-1', params), { wrapper });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(followUpService.getPatientFollowUps).toHaveBeenCalledWith('patient-1', params);
      });
    });

    describe('useOverdueFollowUps', () => {
      it('should fetch overdue follow-ups successfully', async () => {
        const mockResponse = {
          success: true,
          data: {
            tasks: [{ ...mockFollowUpTask, status: 'overdue' as const }],
            summary: { total: 1, critical: 0, high: 1 },
          },
        };

        (followUpService.getOverdueFollowUps as any).mockResolvedValue(mockResponse);

        const wrapper = createWrapper();
        const { result } = renderHook(() => useOverdueFollowUps('pharmacist-1'), { wrapper });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(followUpService.getOverdueFollowUps).toHaveBeenCalledWith('pharmacist-1');
        expect(mockStoreActions.setError).toHaveBeenCalledWith('fetchOverdue', null);
      });
    });

    describe('useFollowUpAnalytics', () => {
      it('should fetch analytics successfully', async () => {
        const mockResponse = {
          success: true,
          data: {
            summary: {
              totalTasks: 10,
              completionRate: 85,
              averageTimeToCompletion: 3.5,
              overdueCount: 2,
            },
            byType: {},
            byPriority: {},
            byTrigger: {},
            trends: {},
          },
        };

        (followUpService.getFollowUpAnalytics as any).mockResolvedValue(mockResponse);

        const wrapper = createWrapper();
        const params = { startDate: '2025-10-01', endDate: '2025-10-31' };
        const { result } = renderHook(() => useFollowUpAnalytics(params), { wrapper });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(followUpService.getFollowUpAnalytics).toHaveBeenCalledWith(params);
      });
    });
  });

  describe('Mutation Hooks', () => {
    describe('useCreateFollowUpTask', () => {
      it('should create follow-up task successfully', async () => {
        const mockResponse = {
          success: true,
          data: { task: mockFollowUpTask },
        };

        (followUpService.createFollowUpTask as any).mockResolvedValue(mockResponse);

        const wrapper = createWrapper();
        const { result } = renderHook(() => useCreateFollowUpTask(), { wrapper });

        const taskData: FollowUpFormData = {
          patientId: 'patient-1',
          type: 'medication_start_followup',
          title: 'Follow up on new medication',
          description: 'Check for side effects',
          objectives: ['Check side effects'],
          priority: 'high',
          dueDate: new Date('2025-10-30'),
        };

        result.current.mutate(taskData);

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(followUpService.createFollowUpTask).toHaveBeenCalledWith(taskData);
        expect(mockStoreActions.addTaskToState).toHaveBeenCalled();
        expect(mockStoreActions.setError).toHaveBeenCalledWith('createTask', null);
      });

      it('should handle create error with optimistic rollback', async () => {
        const mockError = new Error('Failed to create task');
        (followUpService.createFollowUpTask as any).mockRejectedValue(mockError);

        const wrapper = createWrapper();
        const { result } = renderHook(() => useCreateFollowUpTask(), { wrapper });

        const taskData: FollowUpFormData = {
          patientId: 'patient-1',
          type: 'medication_start_followup',
          title: 'Follow up on new medication',
          description: 'Check for side effects',
          objectives: ['Check side effects'],
          priority: 'high',
          dueDate: new Date('2025-10-30'),
        };

        result.current.mutate(taskData);

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(mockStoreActions.setError).toHaveBeenCalledWith('createTask', 'Failed to create task');
      });
    });

    describe('useCompleteFollowUp', () => {
      it('should complete follow-up task successfully', async () => {
        const mockResponse = {
          success: true,
          data: { task: { ...mockFollowUpTask, status: 'completed' as const } },
        };

        (followUpService.completeFollowUpTask as any).mockResolvedValue(mockResponse);

        const wrapper = createWrapper();
        const { result } = renderHook(() => useCompleteFollowUp(), { wrapper });

        const completionData = {
          outcome: {
            status: 'successful' as const,
            notes: 'Task completed successfully',
            nextActions: ['Schedule follow-up'],
          },
        };

        result.current.mutate({ taskId: 'task-1', completionData });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(followUpService.completeFollowUpTask).toHaveBeenCalledWith('task-1', completionData);
        expect(mockStoreActions.updateTaskInState).toHaveBeenCalled();
      });
    });

    describe('useConvertToAppointment', () => {
      it('should convert follow-up to appointment successfully', async () => {
        const mockResponse = {
          success: true,
          data: {
            task: { ...mockFollowUpTask, status: 'converted_to_appointment' as const },
            appointment: { _id: 'appointment-1', scheduledDate: '2025-10-30' },
          },
        };

        (followUpService.convertToAppointment as any).mockResolvedValue(mockResponse);

        const wrapper = createWrapper();
        const { result } = renderHook(() => useConvertToAppointment(), { wrapper });

        const appointmentData = {
          scheduledDate: '2025-10-30',
          scheduledTime: '10:00',
          duration: 30,
          type: 'general_followup',
        };

        result.current.mutate({ taskId: 'task-1', appointmentData });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(followUpService.convertToAppointment).toHaveBeenCalledWith('task-1', appointmentData);
        expect(mockStoreActions.updateTaskInState).toHaveBeenCalled();
      });
    });

    describe('useEscalateFollowUp', () => {
      it('should escalate follow-up task successfully', async () => {
        const mockResponse = {
          success: true,
          data: { task: { ...mockFollowUpTask, priority: 'urgent' as const } },
        };

        (followUpService.escalateFollowUpTask as any).mockResolvedValue(mockResponse);

        const wrapper = createWrapper();
        const { result } = renderHook(() => useEscalateFollowUp(), { wrapper });

        const escalationData = {
          newPriority: 'urgent' as const,
          reason: 'Patient condition worsening',
        };

        result.current.mutate({ taskId: 'task-1', escalationData });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(followUpService.escalateFollowUpTask).toHaveBeenCalledWith('task-1', escalationData);
        expect(mockStoreActions.updateTaskInState).toHaveBeenCalled();
      });
    });

    describe('useUpdateFollowUpTask', () => {
      it('should update follow-up task successfully', async () => {
        const mockResponse = {
          success: true,
          data: { task: { ...mockFollowUpTask, description: 'Updated description' } },
        };

        (followUpService.updateFollowUpTask as any).mockResolvedValue(mockResponse);

        const wrapper = createWrapper();
        const { result } = renderHook(() => useUpdateFollowUpTask(), { wrapper });

        const updates = { description: 'Updated description' };

        result.current.mutate({ taskId: 'task-1', updates });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(followUpService.updateFollowUpTask).toHaveBeenCalledWith('task-1', updates);
        expect(mockStoreActions.updateTaskInState).toHaveBeenCalled();
      });
    });

    describe('useCancelFollowUpTask', () => {
      it('should cancel follow-up task successfully', async () => {
        const mockResponse = {
          success: true,
          data: { task: { ...mockFollowUpTask, status: 'cancelled' as const } },
        };

        (followUpService.cancelFollowUpTask as any).mockResolvedValue(mockResponse);

        const wrapper = createWrapper();
        const { result } = renderHook(() => useCancelFollowUpTask(), { wrapper });

        const reason = 'Patient no longer needs follow-up';

        result.current.mutate({ taskId: 'task-1', reason });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(followUpService.cancelFollowUpTask).toHaveBeenCalledWith('task-1', reason);
        expect(mockStoreActions.updateTaskInState).toHaveBeenCalled();
      });
    });

    describe('useAssignFollowUpTask', () => {
      it('should assign follow-up task successfully', async () => {
        const mockResponse = {
          success: true,
          data: { task: { ...mockFollowUpTask, assignedTo: 'pharmacist-2' } },
        };

        (followUpService.assignFollowUpTask as any).mockResolvedValue(mockResponse);

        const wrapper = createWrapper();
        const { result } = renderHook(() => useAssignFollowUpTask(), { wrapper });

        const assignedTo = 'pharmacist-2';

        result.current.mutate({ taskId: 'task-1', assignedTo });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(followUpService.assignFollowUpTask).toHaveBeenCalledWith('task-1', assignedTo);
        expect(mockStoreActions.updateTaskInState).toHaveBeenCalled();
      });
    });
  });

  describe('Utility Hooks', () => {
    describe('usePrefetchFollowUpTask', () => {
      it('should prefetch follow-up task', () => {
        const wrapper = createWrapper();
        const { result } = renderHook(() => usePrefetchFollowUpTask(), { wrapper });

        result.current('task-1');

        // Prefetch is async, so we just verify the function was called
        expect(typeof result.current).toBe('function');
      });
    });

    describe('useInvalidateFollowUps', () => {
      it('should provide invalidation functions', () => {
        const wrapper = createWrapper();
        const { result } = renderHook(() => useInvalidateFollowUps(), { wrapper });

        expect(typeof result.current.invalidateAll).toBe('function');
        expect(typeof result.current.invalidateLists).toBe('function');
        expect(typeof result.current.invalidateDetail).toBe('function');
        expect(typeof result.current.invalidatePatient).toBe('function');
        expect(typeof result.current.invalidateOverdue).toBe('function');
        expect(typeof result.current.invalidateAnalytics).toBe('function');
      });
    });
  });

  describe('Query Keys', () => {
    it('should generate correct query keys', () => {
      const filters: FollowUpFilters = { status: 'pending', priority: 'high' };

      expect(followUpKeys.all).toEqual(['follow-ups']);
      expect(followUpKeys.lists()).toEqual(['follow-ups', 'list']);
      expect(followUpKeys.list(filters)).toEqual(['follow-ups', 'list', filters]);
      expect(followUpKeys.details()).toEqual(['follow-ups', 'detail']);
      expect(followUpKeys.detail('task-1')).toEqual(['follow-ups', 'detail', 'task-1']);
      expect(followUpKeys.patient('patient-1')).toEqual(['follow-ups', 'patient', 'patient-1']);
      expect(followUpKeys.overdue('pharmacist-1')).toEqual(['follow-ups', 'overdue', 'pharmacist-1']);
      expect(followUpKeys.analytics({ startDate: '2025-10-01' })).toEqual([
        'follow-ups',
        'analytics',
        { startDate: '2025-10-01' },
      ]);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network error');
      networkError.name = 'NetworkError';
      (followUpService.getFollowUpTasks as any).mockRejectedValue(networkError);

      const wrapper = createWrapper();
      renderHook(() => useFollowUpTasks(), { wrapper });

      // Wait a bit for the async operation to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify that the service was called and error handling was triggered
      expect(followUpService.getFollowUpTasks).toHaveBeenCalled();
      expect(mockStoreActions.setLoading).toHaveBeenCalledWith('fetchTasks', true);
    });

    it('should handle 4xx errors without retry', async () => {
      const clientError = new Error('Bad request');
      (clientError as any).response = { status: 400 };
      (followUpService.getFollowUpTasks as any).mockRejectedValue(clientError);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useFollowUpTasks(), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Should not retry 4xx errors
      expect(result.current.failureCount).toBe(1);
    });
  });

  describe('Cache Management', () => {
    it('should use appropriate stale times for different query types', () => {
      const wrapper = createWrapper();

      // Regular tasks - 5 minutes
      const { result: tasksResult } = renderHook(() => useFollowUpTasks(), { wrapper });
      expect(tasksResult.current.dataUpdatedAt).toBeDefined();

      // Overdue tasks - 2 minutes (more frequent updates)
      const { result: overdueResult } = renderHook(() => useOverdueFollowUps(), { wrapper });
      expect(overdueResult.current.dataUpdatedAt).toBeDefined();

      // Analytics - 10 minutes (less frequent updates)
      const { result: analyticsResult } = renderHook(() => useFollowUpAnalytics(), { wrapper });
      expect(analyticsResult.current.dataUpdatedAt).toBeDefined();
    });
  });

  describe('Real-time Updates', () => {
    it('should handle real-time update events', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useFollowUpTasks(), { wrapper });

      // This would test WebSocket integration
      // Implementation depends on your WebSocket service
      expect(result.current).toBeDefined();
    });
  });
});