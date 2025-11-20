import { describe, it, expect, beforeEach } from 'vitest';
import { useFollowUpStore } from '../followUpStore';
import type { FollowUpTask, FollowUpPriority, FollowUpStatus } from '../followUpTypes';

describe('FollowUpStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useFollowUpStore.setState({
      tasks: [],
      selectedTask: null,
      filters: {
        search: '',
        sortBy: 'dueDate',
        sortOrder: 'asc',
        page: 1,
        limit: 50,
      },
      summary: null,
      loading: {},
      errors: {},
      pagination: {
        page: 1,
        limit: 50,
        total: 0,
        pages: 0,
      },
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useFollowUpStore.getState();

      expect(state.tasks).toEqual([]);
      expect(state.selectedTask).toBeNull();
      expect(state.filters.sortBy).toBe('dueDate');
      expect(state.filters.sortOrder).toBe('asc');
      expect(state.loading).toEqual({});
      expect(state.errors).toEqual({});
    });
  });

  describe('Selection Actions', () => {
    const mockTask: FollowUpTask = {
      _id: 'task-1',
      workplaceId: 'workplace-1',
      patientId: 'patient-1',
      assignedTo: 'pharmacist-1',
      type: 'medication_start_followup',
      title: 'Follow-up on new medication',
      description: 'Check for side effects',
      objectives: ['Assess tolerance', 'Check adherence'],
      priority: 'high',
      dueDate: new Date('2025-10-30'),
      status: 'pending',
      trigger: {
        type: 'medication_start',
        triggerDate: new Date('2025-10-23'),
      },
      escalationHistory: [],
      remindersSent: [],
      createdBy: 'user-1',
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should select a task', () => {
      const { selectTask } = useFollowUpStore.getState();

      selectTask(mockTask);

      const state = useFollowUpStore.getState();
      expect(state.selectedTask).toEqual(mockTask);
    });

    it('should clear task selection', () => {
      const { selectTask } = useFollowUpStore.getState();

      selectTask(mockTask);
      selectTask(null);

      const state = useFollowUpStore.getState();
      expect(state.selectedTask).toBeNull();
    });
  });

  describe('Filter Actions', () => {
    it('should set filters', () => {
      const { setFilters } = useFollowUpStore.getState();

      setFilters({ search: 'medication', priority: 'high' });

      const state = useFollowUpStore.getState();
      expect(state.filters.search).toBe('medication');
      expect(state.filters.priority).toBe('high');
    });

    it('should clear filters', () => {
      const { setFilters, clearFilters } = useFollowUpStore.getState();

      setFilters({ search: 'test', status: 'completed' });
      clearFilters();

      const state = useFollowUpStore.getState();
      expect(state.filters.search).toBe('');
      expect(state.filters.status).toBeUndefined();
    });

    it('should filter by status', () => {
      const { filterByStatus } = useFollowUpStore.getState();

      filterByStatus('in_progress');

      const state = useFollowUpStore.getState();
      expect(state.filters.status).toBe('in_progress');
      expect(state.filters.page).toBe(1);
    });

    it('should filter by priority', () => {
      const { filterByPriority } = useFollowUpStore.getState();

      filterByPriority('urgent');

      const state = useFollowUpStore.getState();
      expect(state.filters.priority).toBe('urgent');
      expect(state.filters.page).toBe(1);
    });

    it('should filter by type', () => {
      const { filterByType } = useFollowUpStore.getState();

      filterByType('adherence_check');

      const state = useFollowUpStore.getState();
      expect(state.filters.type).toBe('adherence_check');
      expect(state.filters.page).toBe(1);
    });

    it('should filter by pharmacist', () => {
      const { filterByPharmacist } = useFollowUpStore.getState();

      filterByPharmacist('pharmacist-123');

      const state = useFollowUpStore.getState();
      expect(state.filters.assignedTo).toBe('pharmacist-123');
      expect(state.filters.page).toBe(1);
    });

    it('should filter by patient', () => {
      const { filterByPatient } = useFollowUpStore.getState();

      filterByPatient('patient-456');

      const state = useFollowUpStore.getState();
      expect(state.filters.patientId).toBe('patient-456');
      expect(state.filters.page).toBe(1);
    });

    it('should filter by overdue', () => {
      const { filterByOverdue } = useFollowUpStore.getState();

      filterByOverdue(true);

      const state = useFollowUpStore.getState();
      expect(state.filters.overdue).toBe(true);
      expect(state.filters.page).toBe(1);
    });

    it('should filter by due date range', () => {
      const { filterByDueDateRange } = useFollowUpStore.getState();
      const from = new Date('2025-10-01');
      const to = new Date('2025-10-31');

      filterByDueDateRange(from, to);

      const state = useFollowUpStore.getState();
      expect(state.filters.dueDateFrom).toEqual(from);
      expect(state.filters.dueDateTo).toEqual(to);
      expect(state.filters.page).toBe(1);
    });
  });

  describe('Pagination Actions', () => {
    it('should set page', () => {
      const { setPage } = useFollowUpStore.getState();

      setPage(3);

      const state = useFollowUpStore.getState();
      expect(state.filters.page).toBe(3);
    });

    it('should set limit and reset page', () => {
      const { setLimit } = useFollowUpStore.getState();

      useFollowUpStore.setState({ filters: { ...useFollowUpStore.getState().filters, page: 5 } });
      setLimit(100);

      const state = useFollowUpStore.getState();
      expect(state.filters.limit).toBe(100);
      expect(state.filters.page).toBe(1);
    });
  });

  describe('Local State Management', () => {
    const mockTask: FollowUpTask = {
      _id: 'task-1',
      workplaceId: 'workplace-1',
      patientId: 'patient-1',
      assignedTo: 'pharmacist-1',
      type: 'medication_start_followup',
      title: 'Follow-up on new medication',
      description: 'Check for side effects',
      objectives: ['Assess tolerance'],
      priority: 'high',
      dueDate: new Date('2025-10-30'),
      status: 'pending',
      trigger: {
        type: 'medication_start',
        triggerDate: new Date('2025-10-23'),
      },
      escalationHistory: [],
      remindersSent: [],
      createdBy: 'user-1',
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should add task to state', () => {
      const { addTaskToState } = useFollowUpStore.getState();

      addTaskToState(mockTask);

      const state = useFollowUpStore.getState();
      expect(state.tasks).toHaveLength(1);
      expect(state.tasks[0]).toEqual(mockTask);
      expect(state.pagination.total).toBe(1);
    });

    it('should update task in state', () => {
      const { addTaskToState, updateTaskInState } = useFollowUpStore.getState();

      addTaskToState(mockTask);
      updateTaskInState('task-1', { status: 'in_progress' });

      const state = useFollowUpStore.getState();
      expect(state.tasks[0].status).toBe('in_progress');
    });

    it('should update selected task when updating in state', () => {
      const { addTaskToState, selectTask, updateTaskInState } = useFollowUpStore.getState();

      addTaskToState(mockTask);
      selectTask(mockTask);
      updateTaskInState('task-1', { priority: 'urgent' });

      const state = useFollowUpStore.getState();
      expect(state.selectedTask?.priority).toBe('urgent');
    });

    it('should remove task from state', () => {
      const { addTaskToState, removeTaskFromState } = useFollowUpStore.getState();

      addTaskToState(mockTask);
      removeTaskFromState('task-1');

      const state = useFollowUpStore.getState();
      expect(state.tasks).toHaveLength(0);
      expect(state.pagination.total).toBe(0);
    });

    it('should clear selected task when removing it', () => {
      const { addTaskToState, selectTask, removeTaskFromState } = useFollowUpStore.getState();

      addTaskToState(mockTask);
      selectTask(mockTask);
      removeTaskFromState('task-1');

      const state = useFollowUpStore.getState();
      expect(state.selectedTask).toBeNull();
    });

    it('should set tasks', () => {
      const { setTasks } = useFollowUpStore.getState();
      const tasks = [mockTask, { ...mockTask, _id: 'task-2' }];

      setTasks(tasks);

      const state = useFollowUpStore.getState();
      expect(state.tasks).toHaveLength(2);
    });
  });

  describe('Computed Getters', () => {
    const createMockTask = (
      id: string,
      dueDate: Date,
      status: FollowUpStatus = 'pending',
      priority: FollowUpPriority = 'medium'
    ): FollowUpTask => ({
      _id: id,
      workplaceId: 'workplace-1',
      patientId: 'patient-1',
      assignedTo: 'pharmacist-1',
      type: 'medication_start_followup',
      title: 'Follow-up Task',
      description: 'Task description',
      objectives: ['Objective 1'],
      priority,
      dueDate,
      status,
      trigger: {
        type: 'medication_start',
        triggerDate: new Date(),
      },
      escalationHistory: [],
      remindersSent: [],
      createdBy: 'user-1',
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    it('should get overdue tasks', () => {
      const { setTasks, getOverdueTasks } = useFollowUpStore.getState();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const tasks = [
        createMockTask('task-1', yesterday, 'pending', 'high'),
        createMockTask('task-2', yesterday, 'completed', 'high'),
        createMockTask('task-3', tomorrow, 'pending', 'medium'),
        createMockTask('task-4', yesterday, 'pending', 'critical'),
      ];

      setTasks(tasks);

      const result = getOverdueTasks();
      expect(result).toHaveLength(2);
      // Should be sorted by priority (critical first, then high)
      expect(result[0]._id).toBe('task-4');
      expect(result[1]._id).toBe('task-1');
    });

    it('should get due today tasks', () => {
      const { setTasks, getDueTodayTasks } = useFollowUpStore.getState();
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const tasks = [
        createMockTask('task-1', today, 'pending'),
        createMockTask('task-2', tomorrow, 'pending'),
        createMockTask('task-3', today, 'completed'),
        createMockTask('task-4', today, 'pending'),
      ];

      setTasks(tasks);

      const result = getDueTodayTasks();
      expect(result).toHaveLength(2);
      expect(result.map((t) => t._id)).toContain('task-1');
      expect(result.map((t) => t._id)).toContain('task-4');
    });

    it('should get due this week tasks', () => {
      const { setTasks, getDueThisWeekTasks } = useFollowUpStore.getState();
      const today = new Date();
      const inThreeDays = new Date(today);
      inThreeDays.setDate(inThreeDays.getDate() + 3);
      const inTenDays = new Date(today);
      inTenDays.setDate(inTenDays.getDate() + 10);

      const tasks = [
        createMockTask('task-1', inThreeDays, 'pending'),
        createMockTask('task-2', inTenDays, 'pending'),
        createMockTask('task-3', inThreeDays, 'completed'),
      ];

      setTasks(tasks);

      const result = getDueThisWeekTasks();
      expect(result).toHaveLength(1);
      expect(result[0]._id).toBe('task-1');
    });

    it('should get tasks by priority', () => {
      const { setTasks, getTasksByPriority } = useFollowUpStore.getState();

      const tasks = [
        createMockTask('task-1', new Date(), 'pending', 'high'),
        createMockTask('task-2', new Date(), 'pending', 'medium'),
        createMockTask('task-3', new Date(), 'pending', 'high'),
      ];

      setTasks(tasks);

      const result = getTasksByPriority('high');
      expect(result).toHaveLength(2);
    });

    it('should get tasks by status', () => {
      const { setTasks, getTasksByStatus } = useFollowUpStore.getState();

      const tasks = [
        createMockTask('task-1', new Date(), 'pending'),
        createMockTask('task-2', new Date(), 'in_progress'),
        createMockTask('task-3', new Date(), 'pending'),
      ];

      setTasks(tasks);

      const result = getTasksByStatus('pending');
      expect(result).toHaveLength(2);
    });

    it('should get tasks by type', () => {
      const { setTasks, getTasksByType } = useFollowUpStore.getState();

      const tasks = [
        { ...createMockTask('task-1', new Date()), type: 'adherence_check' as const },
        { ...createMockTask('task-2', new Date()), type: 'medication_start_followup' as const },
        { ...createMockTask('task-3', new Date()), type: 'adherence_check' as const },
      ];

      setTasks(tasks);

      const result = getTasksByType('adherence_check');
      expect(result).toHaveLength(2);
    });

    it('should get high priority tasks', () => {
      const { setTasks, getHighPriorityTasks } = useFollowUpStore.getState();

      const tasks = [
        createMockTask('task-1', new Date(), 'pending', 'critical'),
        createMockTask('task-2', new Date(), 'pending', 'medium'),
        createMockTask('task-3', new Date(), 'pending', 'urgent'),
        createMockTask('task-4', new Date(), 'completed', 'high'),
        createMockTask('task-5', new Date(), 'pending', 'low'),
      ];

      setTasks(tasks);

      const result = getHighPriorityTasks();
      expect(result).toHaveLength(2);
      expect(result.map((t) => t._id)).toContain('task-1');
      expect(result.map((t) => t._id)).toContain('task-3');
    });

    it('should get pending tasks', () => {
      const { setTasks, getPendingTasks } = useFollowUpStore.getState();

      const tasks = [
        createMockTask('task-1', new Date(), 'pending'),
        createMockTask('task-2', new Date(), 'in_progress'),
        createMockTask('task-3', new Date(), 'completed'),
        createMockTask('task-4', new Date(), 'pending'),
      ];

      setTasks(tasks);

      const result = getPendingTasks();
      expect(result).toHaveLength(3);
      expect(result.every((t) => t.status === 'pending' || t.status === 'in_progress')).toBe(true);
    });

    it('should exclude deleted tasks from queries', () => {
      const { setTasks, getPendingTasks } = useFollowUpStore.getState();

      const tasks = [
        createMockTask('task-1', new Date(), 'pending'),
        { ...createMockTask('task-2', new Date(), 'pending'), isDeleted: true },
      ];

      setTasks(tasks);

      const result = getPendingTasks();
      expect(result).toHaveLength(1);
      expect(result[0]._id).toBe('task-1');
    });
  });

  describe('Loading and Error States', () => {
    it('should set loading state', () => {
      const { setLoading } = useFollowUpStore.getState();

      setLoading('fetchTasks', true);

      const state = useFollowUpStore.getState();
      expect(state.loading.fetchTasks).toBe(true);
    });

    it('should clear loading state', () => {
      const { setLoading } = useFollowUpStore.getState();

      setLoading('fetchTasks', true);
      setLoading('fetchTasks', false);

      const state = useFollowUpStore.getState();
      expect(state.loading.fetchTasks).toBe(false);
    });

    it('should set error state', () => {
      const { setError } = useFollowUpStore.getState();

      setError('fetchTasks', 'Failed to fetch tasks');

      const state = useFollowUpStore.getState();
      expect(state.errors.fetchTasks).toBe('Failed to fetch tasks');
    });

    it('should clear all errors', () => {
      const { setError, clearErrors } = useFollowUpStore.getState();

      setError('fetchTasks', 'Error 1');
      setError('createTask', 'Error 2');
      clearErrors();

      const state = useFollowUpStore.getState();
      expect(state.errors).toEqual({});
    });
  });
});
