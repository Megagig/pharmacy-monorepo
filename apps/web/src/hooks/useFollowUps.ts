import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { followUpService } from '../services/followUpService';
import { useFollowUpStore } from '../stores/followUpStore';
import {
  FollowUpTask,
  FollowUpFilters,
  FollowUpFormData,
} from '../stores/followUpTypes';

// Query keys for consistent caching
export const followUpKeys = {
  all: ['follow-ups'] as const,
  lists: () => [...followUpKeys.all, 'list'] as const,
  list: (filters: FollowUpFilters) => [...followUpKeys.lists(), filters] as const,
  details: () => [...followUpKeys.all, 'detail'] as const,
  detail: (id: string) => [...followUpKeys.details(), id] as const,
  patient: (patientId: string) => [...followUpKeys.all, 'patient', patientId] as const,
  overdue: (assignedTo?: string) => [...followUpKeys.all, 'overdue', assignedTo] as const,
  analytics: (params: any) => [...followUpKeys.all, 'analytics', params] as const,
};

// =============================================
// QUERY HOOKS
// =============================================

/**
 * Hook to fetch follow-up tasks with filtering and pagination
 */
export const useFollowUpTasks = (filters: FollowUpFilters = {}) => {
  const { setTasks, setSummary, setLoading, setError } = useFollowUpStore();

  return useQuery({
    queryKey: followUpKeys.list(filters),
    queryFn: async () => {
      setLoading('fetchTasks', true);
      try {
        const response = await followUpService.getFollowUpTasks(filters);
        
        // Update store with fetched data
        if (response.data?.tasks) {
          setTasks(response.data.tasks);
        }
        if (response.data?.summary) {
          setSummary(response.data.summary);
        }
        
        setError('fetchTasks', null);
        return response;
      } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch follow-up tasks';
        console.warn('Follow-up tasks API error:', errorMessage);
        setError('fetchTasks', errorMessage);
        
        // Don't throw on 403/401 errors to prevent infinite loops
        if (error?.response?.status === 403 || error?.response?.status === 401) {
          console.warn('Follow-up tasks API not available - returning empty data');
          setError('fetchTasks', null); // Clear the error
          return { data: { tasks: [], summary: null } };
        }
        
        throw error;
      } finally {
        setLoading('fetchTasks', false);
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: (failureCount, error: any) => {
      // Don't retry on 4xx errors
      if (error?.response?.status >= 400 && error?.response?.status < 500) {
        return false;
      }
      return failureCount < 3;
    },
  });
};

/**
 * Hook to fetch single follow-up task details
 */
export const useFollowUpTask = (taskId: string, enabled = true) => {
  const { selectTask, setLoading, setError } = useFollowUpStore();

  return useQuery({
    queryKey: followUpKeys.detail(taskId),
    queryFn: async () => {
      setLoading('fetchTask', true);
      try {
        const response = await followUpService.getFollowUpTask(taskId);
        
        // Update selected task in store
        if (response.data?.task) {
          selectTask(response.data.task);
        }
        
        setError('fetchTask', null);
        return response;
      } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch follow-up task';
        console.warn('Follow-up task API error:', errorMessage);
        setError('fetchTask', errorMessage);
        
        // Don't throw on 403/401 errors to prevent infinite loops
        if (error?.response?.status === 403 || error?.response?.status === 401) {
          console.warn('Follow-up task API not available - returning empty data');
          setError('fetchTask', null); // Clear the error
          return { data: { task: null } };
        }
        
        throw error;
      } finally {
        setLoading('fetchTask', false);
      }
    },
    enabled: enabled && !!taskId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
  });
};

/**
 * Hook to fetch patient follow-up tasks
 */
export const usePatientFollowUps = (
  patientId: string,
  params: { status?: string; limit?: number; page?: number } = {},
  enabled = true
) => {
  return useQuery({
    queryKey: followUpKeys.patient(patientId),
    queryFn: () => followUpService.getPatientFollowUps(patientId, params),
    enabled: enabled && !!patientId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
  });
};

/**
 * Hook to fetch overdue follow-up tasks
 */
export const useOverdueFollowUps = (assignedTo?: string) => {
  const { setLoading, setError } = useFollowUpStore();

  return useQuery({
    queryKey: followUpKeys.overdue(assignedTo),
    queryFn: async () => {
      setLoading('fetchOverdue', true);
      try {
        const response = await followUpService.getOverdueFollowUps(assignedTo);
        setError('fetchOverdue', null);
        return response;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch overdue tasks';
        setError('fetchOverdue', errorMessage);
        throw error;
      } finally {
        setLoading('fetchOverdue', false);
      }
    },
    staleTime: 2 * 60 * 1000, // 2 minutes for overdue tasks
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    retry: 2,
  });
};

/**
 * Hook to fetch follow-up analytics
 */
export const useFollowUpAnalytics = (params: {
  startDate?: string;
  endDate?: string;
  pharmacistId?: string;
  locationId?: string;
} = {}) => {
  return useQuery({
    queryKey: followUpKeys.analytics(params),
    queryFn: () => followUpService.getFollowUpAnalytics(params),
    staleTime: 10 * 60 * 1000, // 10 minutes for analytics
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
  });
};

// =============================================
// MUTATION HOOKS
// =============================================

/**
 * Hook to create new follow-up task
 */
export const useCreateFollowUpTask = () => {
  const queryClient = useQueryClient();
  const { addTaskToState, setLoading, setError } = useFollowUpStore();

  return useMutation({
    mutationFn: (taskData: FollowUpFormData) => 
      followUpService.createFollowUpTask(taskData),
    
    onMutate: async (taskData) => {
      setLoading('createTask', true);
      setError('createTask', null);

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: followUpKeys.lists() });

      // Snapshot the previous value
      const previousTasks = queryClient.getQueryData(followUpKeys.lists());

      // Optimistically update the cache with temporary task
      const tempTask: FollowUpTask = {
        _id: `temp-${Date.now()}`,
        workplaceId: '',
        patientId: taskData.patientId,
        assignedTo: taskData.assignedTo || '',
        type: taskData.type,
        title: taskData.title,
        description: taskData.description,
        objectives: taskData.objectives,
        priority: taskData.priority,
        dueDate: taskData.dueDate,
        estimatedDuration: taskData.estimatedDuration,
        status: 'pending',
        trigger: taskData.trigger ? {
          ...taskData.trigger,
          triggerDate: taskData.trigger.triggerDate || new Date(),
        } : {
          type: 'manual',
          triggerDate: new Date(),
        },
        escalationHistory: [],
        remindersSent: [],
        createdBy: '',
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Add to store optimistically
      addTaskToState(tempTask);

      return { previousTasks, tempTask };
    },

    onSuccess: (response, variables, _context) => {
      setLoading('createTask', false);
      
      if (response.data?.task) {
        // Replace temp task with real one
        const realTask = response.data.task;
        
        // Update store with real task
        addTaskToState(realTask);
        
        // Invalidate and refetch related queries
        queryClient.invalidateQueries({ queryKey: followUpKeys.lists() });
        queryClient.invalidateQueries({ queryKey: followUpKeys.overdue() });
        
        // If patient-specific, invalidate patient follow-ups
        if (variables.patientId) {
          queryClient.invalidateQueries({ 
            queryKey: followUpKeys.patient(variables.patientId) 
          });
        }
      }
    },

    onError: (error, _variables, context) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create follow-up task';
      setError('createTask', errorMessage);
      setLoading('createTask', false);

      // Revert optimistic update
      if (context?.previousTasks) {
        queryClient.setQueryData(followUpKeys.lists(), context.previousTasks);
      }
    },

    onSettled: () => {
      setLoading('createTask', false);
    },
  });
};

/**
 * Hook to complete follow-up task
 */
export const useCompleteFollowUp = () => {
  const queryClient = useQueryClient();
  const { updateTaskInState, setLoading, setError } = useFollowUpStore();

  return useMutation({
    mutationFn: ({ 
      taskId, 
      completionData 
    }: { 
      taskId: string; 
      completionData: {
        outcome: {
          status: 'successful' | 'partially_successful' | 'unsuccessful';
          notes: string;
          nextActions: string[];
          appointmentCreated?: boolean;
          appointmentId?: string;
        };
      };
    }) => followUpService.completeFollowUpTask(taskId, completionData),

    onMutate: async ({ taskId, completionData }) => {
      setLoading('completeTask', true);
      setError('completeTask', null);

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: followUpKeys.detail(taskId) });

      // Snapshot previous value
      const previousTask = queryClient.getQueryData(followUpKeys.detail(taskId));

      // Optimistically update
      updateTaskInState(taskId, {
        status: 'completed',
        completedAt: new Date(),
        outcome: completionData.outcome ? {
          ...completionData.outcome,
          appointmentCreated: completionData.outcome.appointmentCreated ?? false,
        } : undefined,
      });

      return { previousTask };
    },

    onSuccess: (response, { taskId }) => {
      setLoading('completeTask', false);
      
      if (response.data?.task) {
        // Update store with server response
        updateTaskInState(taskId, response.data.task);
        
        // Invalidate related queries
        queryClient.invalidateQueries({ queryKey: followUpKeys.detail(taskId) });
        queryClient.invalidateQueries({ queryKey: followUpKeys.lists() });
        queryClient.invalidateQueries({ queryKey: followUpKeys.overdue() });
        
        // If patient-specific, invalidate patient follow-ups
        const task = response.data.task;
        if (task.patientId) {
          queryClient.invalidateQueries({ 
            queryKey: followUpKeys.patient(task.patientId) 
          });
        }
      }
    },

    onError: (error, { taskId }, context) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to complete follow-up task';
      setError('completeTask', errorMessage);
      setLoading('completeTask', false);

      // Revert optimistic update
      if (context?.previousTask) {
        queryClient.setQueryData(followUpKeys.detail(taskId), context.previousTask);
      }
    },

    onSettled: () => {
      setLoading('completeTask', false);
    },
  });
};

/**
 * Hook to convert follow-up task to appointment
 */
export const useConvertToAppointment = () => {
  const queryClient = useQueryClient();
  const { updateTaskInState, setLoading, setError } = useFollowUpStore();

  return useMutation({
    mutationFn: ({ 
      taskId, 
      appointmentData 
    }: { 
      taskId: string; 
      appointmentData: {
        scheduledDate: string;
        scheduledTime: string;
        duration: number;
        type: string;
        description?: string;
      };
    }) => followUpService.convertToAppointment(taskId, appointmentData),

    onMutate: async ({ taskId, appointmentData }) => {
      setLoading('convertToAppointment', true);
      setError('convertToAppointment', null);

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: followUpKeys.detail(taskId) });

      // Snapshot previous value
      const previousTask = queryClient.getQueryData(followUpKeys.detail(taskId));

      // Optimistically update
      updateTaskInState(taskId, {
        status: 'converted_to_appointment',
        outcome: {
          status: 'successful',
          notes: `Converted to appointment on ${appointmentData.scheduledDate} at ${appointmentData.scheduledTime}`,
          nextActions: ['Attend scheduled appointment'],
          appointmentCreated: true,
        },
      });

      return { previousTask };
    },

    onSuccess: (response, { taskId }) => {
      setLoading('convertToAppointment', false);
      
      if (response.data?.task) {
        // Update store with server response
        updateTaskInState(taskId, response.data.task);
        
        // Invalidate related queries
        queryClient.invalidateQueries({ queryKey: followUpKeys.detail(taskId) });
        queryClient.invalidateQueries({ queryKey: followUpKeys.lists() });
        queryClient.invalidateQueries({ queryKey: followUpKeys.overdue() });
        
        // Invalidate appointment queries as well since we created an appointment
        queryClient.invalidateQueries({ queryKey: ['appointments'] });
        
        // If patient-specific, invalidate patient follow-ups
        const task = response.data.task;
        if (task.patientId) {
          queryClient.invalidateQueries({ 
            queryKey: followUpKeys.patient(task.patientId) 
          });
        }
      }
    },

    onError: (error, { taskId }, context) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to convert follow-up to appointment';
      setError('convertToAppointment', errorMessage);
      setLoading('convertToAppointment', false);

      // Revert optimistic update
      if (context?.previousTask) {
        queryClient.setQueryData(followUpKeys.detail(taskId), context.previousTask);
      }
    },

    onSettled: () => {
      setLoading('convertToAppointment', false);
    },
  });
};

/**
 * Hook to escalate follow-up task priority
 */
export const useEscalateFollowUp = () => {
  const queryClient = useQueryClient();
  const { updateTaskInState, setLoading, setError } = useFollowUpStore();

  return useMutation({
    mutationFn: ({ 
      taskId, 
      escalationData 
    }: { 
      taskId: string; 
      escalationData: {
        newPriority: 'low' | 'medium' | 'high' | 'urgent' | 'critical';
        reason: string;
      };
    }) => followUpService.escalateFollowUpTask(taskId, escalationData),

    onMutate: async ({ taskId, escalationData }) => {
      setLoading('escalateTask', true);
      setError('escalateTask', null);

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: followUpKeys.detail(taskId) });

      // Snapshot previous value
      const previousTask = queryClient.getQueryData(followUpKeys.detail(taskId));

      // Get current task to track escalation history
      const currentTask = queryClient.getQueryData<any>(followUpKeys.detail(taskId));
      const currentPriority = currentTask?.data?.task?.priority || 'medium';

      // Optimistically update
      updateTaskInState(taskId, {
        priority: escalationData.newPriority,
        escalationHistory: [
          ...(currentTask?.data?.task?.escalationHistory || []),
          {
            escalatedAt: new Date(),
            escalatedBy: '', // Will be filled by server
            fromPriority: currentPriority,
            toPriority: escalationData.newPriority,
            reason: escalationData.reason,
          },
        ],
      });

      return { previousTask };
    },

    onSuccess: (response, { taskId }) => {
      setLoading('escalateTask', false);
      
      if (response.data?.task) {
        // Update store with server response
        updateTaskInState(taskId, response.data.task);
        
        // Invalidate related queries
        queryClient.invalidateQueries({ queryKey: followUpKeys.detail(taskId) });
        queryClient.invalidateQueries({ queryKey: followUpKeys.lists() });
        queryClient.invalidateQueries({ queryKey: followUpKeys.overdue() });
        
        // If patient-specific, invalidate patient follow-ups
        const task = response.data.task;
        if (task.patientId) {
          queryClient.invalidateQueries({ 
            queryKey: followUpKeys.patient(task.patientId) 
          });
        }
      }
    },

    onError: (error, { taskId }, context) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to escalate follow-up task';
      setError('escalateTask', errorMessage);
      setLoading('escalateTask', false);

      // Revert optimistic update
      if (context?.previousTask) {
        queryClient.setQueryData(followUpKeys.detail(taskId), context.previousTask);
      }
    },

    onSettled: () => {
      setLoading('escalateTask', false);
    },
  });
};

/**
 * Hook to update follow-up task
 */
export const useUpdateFollowUpTask = () => {
  const queryClient = useQueryClient();
  const { updateTaskInState, setLoading, setError } = useFollowUpStore();

  return useMutation({
    mutationFn: ({ 
      taskId, 
      updates 
    }: { 
      taskId: string; 
      updates: Partial<FollowUpFormData>;
    }) => followUpService.updateFollowUpTask(taskId, updates),

    onMutate: async ({ taskId, updates }) => {
      setLoading('updateTask', true);
      setError('updateTask', null);

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: followUpKeys.detail(taskId) });

      // Snapshot previous value
      const previousTask = queryClient.getQueryData(followUpKeys.detail(taskId));

      // Optimistically update - convert form data to task data
      const taskUpdates: Partial<FollowUpTask> = {
        ...updates,
        trigger: updates.trigger ? {
          ...updates.trigger,
          triggerDate: updates.trigger.triggerDate || new Date(),
        } : undefined,
        outcome: updates.outcome ? {
          ...updates.outcome,
          appointmentCreated: updates.outcome.appointmentCreated ?? false,
        } : undefined,
      };
      updateTaskInState(taskId, taskUpdates);

      return { previousTask };
    },

    onSuccess: (response, { taskId }) => {
      setLoading('updateTask', false);
      
      if (response.data?.task) {
        // Update store with server response
        updateTaskInState(taskId, response.data.task);
        
        // Invalidate related queries
        queryClient.invalidateQueries({ queryKey: followUpKeys.detail(taskId) });
        queryClient.invalidateQueries({ queryKey: followUpKeys.lists() });
        
        // If patient-specific, invalidate patient follow-ups
        const task = response.data.task;
        if (task.patientId) {
          queryClient.invalidateQueries({ 
            queryKey: followUpKeys.patient(task.patientId) 
          });
        }
      }
    },

    onError: (error, { taskId }, context) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update follow-up task';
      setError('updateTask', errorMessage);
      setLoading('updateTask', false);

      // Revert optimistic update
      if (context?.previousTask) {
        queryClient.setQueryData(followUpKeys.detail(taskId), context.previousTask);
      }
    },

    onSettled: () => {
      setLoading('updateTask', false);
    },
  });
};

/**
 * Hook to cancel follow-up task
 */
export const useCancelFollowUpTask = () => {
  const queryClient = useQueryClient();
  const { updateTaskInState, setLoading, setError } = useFollowUpStore();

  return useMutation({
    mutationFn: ({ 
      taskId, 
      reason 
    }: { 
      taskId: string; 
      reason: string;
    }) => followUpService.cancelFollowUpTask(taskId, reason),

    onMutate: async ({ taskId, reason }) => {
      setLoading('cancelTask', true);
      setError('cancelTask', null);

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: followUpKeys.detail(taskId) });

      // Snapshot previous value
      const previousTask = queryClient.getQueryData(followUpKeys.detail(taskId));

      // Optimistically update
      updateTaskInState(taskId, {
        status: 'cancelled',
        outcome: {
          status: 'unsuccessful',
          notes: `Task cancelled: ${reason}`,
          nextActions: [],
          appointmentCreated: false,
        },
      });

      return { previousTask };
    },

    onSuccess: (response, { taskId }) => {
      setLoading('cancelTask', false);
      
      if (response.data?.task) {
        // Update store with server response
        updateTaskInState(taskId, response.data.task);
        
        // Invalidate related queries
        queryClient.invalidateQueries({ queryKey: followUpKeys.detail(taskId) });
        queryClient.invalidateQueries({ queryKey: followUpKeys.lists() });
        queryClient.invalidateQueries({ queryKey: followUpKeys.overdue() });
        
        // If patient-specific, invalidate patient follow-ups
        const task = response.data.task;
        if (task.patientId) {
          queryClient.invalidateQueries({ 
            queryKey: followUpKeys.patient(task.patientId) 
          });
        }
      }
    },

    onError: (error, { taskId }, context) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to cancel follow-up task';
      setError('cancelTask', errorMessage);
      setLoading('cancelTask', false);

      // Revert optimistic update
      if (context?.previousTask) {
        queryClient.setQueryData(followUpKeys.detail(taskId), context.previousTask);
      }
    },

    onSettled: () => {
      setLoading('cancelTask', false);
    },
  });
};

/**
 * Hook to assign follow-up task to pharmacist
 */
export const useAssignFollowUpTask = () => {
  const queryClient = useQueryClient();
  const { updateTaskInState, setLoading, setError } = useFollowUpStore();

  return useMutation({
    mutationFn: ({ 
      taskId, 
      assignedTo 
    }: { 
      taskId: string; 
      assignedTo: string;
    }) => followUpService.assignFollowUpTask(taskId, assignedTo),

    onMutate: async ({ taskId, assignedTo }) => {
      setLoading('assignTask', true);
      setError('assignTask', null);

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: followUpKeys.detail(taskId) });

      // Snapshot previous value
      const previousTask = queryClient.getQueryData(followUpKeys.detail(taskId));

      // Optimistically update
      updateTaskInState(taskId, {
        assignedTo,
        updatedAt: new Date(),
      });

      return { previousTask };
    },

    onSuccess: (response, { taskId }) => {
      setLoading('assignTask', false);
      
      if (response.data?.task) {
        // Update store with server response
        updateTaskInState(taskId, response.data.task);
        
        // Invalidate related queries
        queryClient.invalidateQueries({ queryKey: followUpKeys.detail(taskId) });
        queryClient.invalidateQueries({ queryKey: followUpKeys.lists() });
        queryClient.invalidateQueries({ queryKey: followUpKeys.overdue() });
        
        // If patient-specific, invalidate patient follow-ups
        const task = response.data.task;
        if (task.patientId) {
          queryClient.invalidateQueries({ 
            queryKey: followUpKeys.patient(task.patientId) 
          });
        }
      }
    },

    onError: (error, { taskId }, context) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to assign follow-up task';
      setError('assignTask', errorMessage);
      setLoading('assignTask', false);

      // Revert optimistic update
      if (context?.previousTask) {
        queryClient.setQueryData(followUpKeys.detail(taskId), context.previousTask);
      }
    },

    onSettled: () => {
      setLoading('assignTask', false);
    },
  });
};

// =============================================
// UTILITY HOOKS
// =============================================

/**
 * Hook to prefetch follow-up task data
 */
export const usePrefetchFollowUpTask = () => {
  const queryClient = useQueryClient();

  return (taskId: string) => {
    queryClient.prefetchQuery({
      queryKey: followUpKeys.detail(taskId),
      queryFn: () => followUpService.getFollowUpTask(taskId),
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };
};

/**
 * Hook to invalidate follow-up queries
 */
export const useInvalidateFollowUps = () => {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: followUpKeys.all }),
    invalidateLists: () => queryClient.invalidateQueries({ queryKey: followUpKeys.lists() }),
    invalidateDetail: (id: string) => queryClient.invalidateQueries({ queryKey: followUpKeys.detail(id) }),
    invalidatePatient: (patientId: string) => queryClient.invalidateQueries({ queryKey: followUpKeys.patient(patientId) }),
    invalidateOverdue: () => queryClient.invalidateQueries({ queryKey: followUpKeys.overdue() }),
    invalidateAnalytics: () => queryClient.invalidateQueries({ queryKey: followUpKeys.analytics({}) }),
  };
};

/**
 * Hook for real-time updates via WebSocket
 */
export const useFollowUpRealTimeUpdates = () => {
  const queryClient = useQueryClient();
  const { updateTaskInState, addTaskToState } = useFollowUpStore();

  // This would integrate with your existing WebSocket service
  // Example implementation:
  const handleFollowUpUpdate = (data: { type: string; task: FollowUpTask }) => {
    switch (data.type) {
      case 'task_created':
        addTaskToState(data.task);
        queryClient.invalidateQueries({ queryKey: followUpKeys.lists() });
        break;
      case 'task_updated':
        updateTaskInState(data.task._id, data.task);
        queryClient.setQueryData(followUpKeys.detail(data.task._id), {
          success: true,
          data: { task: data.task },
        });
        break;
      case 'task_completed':
      case 'task_escalated':
      case 'task_assigned':
        updateTaskInState(data.task._id, data.task);
        queryClient.invalidateQueries({ queryKey: followUpKeys.lists() });
        queryClient.invalidateQueries({ queryKey: followUpKeys.overdue() });
        break;
      default:
        break;
    }
  };

  return { handleFollowUpUpdate };
};