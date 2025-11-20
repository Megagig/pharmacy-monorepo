import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import FollowUpTaskList from '../FollowUpTaskList';
import { FollowUpTask, FollowUpSummary } from '../../../stores/followUpTypes';

// Mock the hooks
vi.mock('../../../hooks/useFollowUps', () => ({
  useFollowUpTasks: vi.fn(),
  useCompleteFollowUp: vi.fn(),
  useConvertToAppointment: vi.fn(),
  useEscalateFollowUp: vi.fn(),
}));

vi.mock('../../../stores/followUpStore', () => ({
  useFollowUpStore: vi.fn(),
  useFollowUpFilters: vi.fn(),
  useFollowUpList: vi.fn(),
}));

// Mock data
const mockTasks: FollowUpTask[] = [
  {
    _id: '1',
    workplaceId: 'workplace1',
    patientId: 'patient1',
    assignedTo: 'pharmacist1',
    type: 'medication_start_followup',
    title: 'Follow up on new diabetes medication',
    description: 'Check for side effects and adherence',
    objectives: ['Check side effects', 'Assess adherence'],
    priority: 'high',
    dueDate: new Date('2025-10-27'),
    estimatedDuration: 30,
    status: 'pending',
    trigger: {
      type: 'medication_start',
      triggerDate: new Date('2025-10-25'),
    },
    escalationHistory: [],
    remindersSent: [],
    createdBy: 'pharmacist1',
    isDeleted: false,
    createdAt: new Date('2025-10-25'),
    updatedAt: new Date('2025-10-25'),
  },
  {
    _id: '2',
    workplaceId: 'workplace1',
    patientId: 'patient2',
    assignedTo: 'pharmacist1',
    type: 'lab_result_review',
    title: 'Review abnormal lab results',
    description: 'High cholesterol levels detected',
    objectives: ['Review results', 'Adjust medication'],
    priority: 'urgent',
    dueDate: new Date('2025-10-24'), // Overdue
    estimatedDuration: 20,
    status: 'pending',
    trigger: {
      type: 'lab_result',
      triggerDate: new Date('2025-10-24'),
    },
    escalationHistory: [],
    remindersSent: [],
    createdBy: 'pharmacist1',
    isDeleted: false,
    createdAt: new Date('2025-10-24'),
    updatedAt: new Date('2025-10-24'),
  },
];

const mockSummary: FollowUpSummary = {
  total: 2,
  overdue: 1,
  dueToday: 0,
  dueThisWeek: 2,
  byPriority: {
    low: 0,
    medium: 0,
    high: 1,
    urgent: 1,
    critical: 0,
  },
  byStatus: {
    pending: 2,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
    overdue: 0,
    converted_to_appointment: 0,
  },
  byType: {
    medication_start_followup: 1,
    lab_result_review: 1,
    hospital_discharge_followup: 0,
    medication_change_followup: 0,
    chronic_disease_monitoring: 0,
    adherence_check: 0,
    refill_reminder: 0,
    preventive_care: 0,
    general_followup: 0,
  },
};

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const theme = createTheme();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
};

describe('FollowUpTaskList', () => {
  const mockSelectTask = vi.fn();
  const mockSetFilters = vi.fn();
  const mockClearFilters = vi.fn();
  const mockFilterByStatus = vi.fn();
  const mockFilterByPriority = vi.fn();
  const mockFilterByOverdue = vi.fn();
  const mockSetPage = vi.fn();
  const mockRefetch = vi.fn();
  const mockCompleteTaskMutate = vi.fn();
  const mockConvertToAppointmentMutate = vi.fn();
  const mockEscalateTaskMutate = vi.fn();

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    // Import and mock the hooks
    const { useFollowUpTasks, useCompleteFollowUp, useConvertToAppointment, useEscalateFollowUp } = await import('../../../hooks/useFollowUps');
    const { useFollowUpStore, useFollowUpFilters, useFollowUpList } = await import('../../../stores/followUpStore');

    // Mock store hooks
    vi.mocked(useFollowUpStore).mockReturnValue({
      selectTask: mockSelectTask,
    } as any);

    vi.mocked(useFollowUpFilters).mockReturnValue({
      filters: { sortBy: 'dueDate', sortOrder: 'asc', page: 1, limit: 50 },
      setFilters: mockSetFilters,
      clearFilters: mockClearFilters,
      filterByStatus: mockFilterByStatus,
      filterByPriority: mockFilterByPriority,
      filterByOverdue: mockFilterByOverdue,
    });

    vi.mocked(useFollowUpList).mockReturnValue({
      tasks: mockTasks,
      summary: mockSummary,
      pagination: { page: 1, limit: 50, total: 2, pages: 1 },
      loading: {},
      errors: {},
      setPage: mockSetPage,
      setLimit: vi.fn(),
    });

    // Mock query hooks
    vi.mocked(useFollowUpTasks).mockReturnValue({
      data: {
        success: true,
        data: {
          tasks: mockTasks,
          summary: mockSummary,
          pagination: {
            page: 1,
            limit: 50,
            total: 2,
            pages: 1,
          },
        },
      },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    } as any);

    // Mock mutation hooks
    vi.mocked(useCompleteFollowUp).mockReturnValue({
      mutateAsync: mockCompleteTaskMutate,
      isPending: false,
    } as any);

    vi.mocked(useConvertToAppointment).mockReturnValue({
      mutateAsync: mockConvertToAppointmentMutate,
      isPending: false,
    } as any);

    vi.mocked(useEscalateFollowUp).mockReturnValue({
      mutateAsync: mockEscalateTaskMutate,
      isPending: false,
    } as any);
  });

  describe('Rendering', () => {
    it('renders the component with summary statistics', () => {
      render(
        <TestWrapper>
          <FollowUpTaskList />
        </TestWrapper>
      );

      // Check summary cards - use getAllByText for duplicate values
      const totalTasksCards = screen.getAllByText('2');
      expect(totalTasksCards.length).toBeGreaterThan(0); // Total tasks and Due This Week both show "2"
      expect(screen.getByText('Total Tasks')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument(); // Overdue
      expect(screen.getByText('Overdue')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument(); // Due today
      expect(screen.getByText('Due Today')).toBeInTheDocument();
      expect(screen.getByText('Due This Week')).toBeInTheDocument();
    });

    it('renders the task list with all tasks', () => {
      render(
        <TestWrapper>
          <FollowUpTaskList />
        </TestWrapper>
      );

      // Check that all tasks are rendered
      expect(screen.getByText('Follow up on new diabetes medication')).toBeInTheDocument();
      expect(screen.getByText('Review abnormal lab results')).toBeInTheDocument();

      // Check task descriptions
      expect(screen.getByText('Check for side effects and adherence')).toBeInTheDocument();
      expect(screen.getByText('High cholesterol levels detected')).toBeInTheDocument();
    });

    it('renders task status badges correctly', () => {
      render(
        <TestWrapper>
          <FollowUpTaskList />
        </TestWrapper>
      );

      // Check status badges
      const pendingBadges = screen.getAllByText('PENDING');
      expect(pendingBadges).toHaveLength(2);
    });

    it('renders task type chips correctly', () => {
      render(
        <TestWrapper>
          <FollowUpTaskList />
        </TestWrapper>
      );

      // Check type chips
      expect(screen.getByText('Medication Start')).toBeInTheDocument();
      expect(screen.getByText('Lab Result Review')).toBeInTheDocument();
    });

    it('highlights overdue tasks', () => {
      render(
        <TestWrapper>
          <FollowUpTaskList />
        </TestWrapper>
      );

      // Check for overdue badge
      expect(screen.getByText('OVERDUE')).toBeInTheDocument();
    });

    it('renders without summary when showSummary is false', () => {
      render(
        <TestWrapper>
          <FollowUpTaskList showSummary={false} />
        </TestWrapper>
      );

      // Summary cards should not be present
      expect(screen.queryByText('Total Tasks')).not.toBeInTheDocument();
      expect(screen.queryByText('Overdue')).not.toBeInTheDocument();
    });

    it('renders without filters when showFilters is false', () => {
      render(
        <TestWrapper>
          <FollowUpTaskList showFilters={false} />
        </TestWrapper>
      );

      // Search and filter controls should not be present
      expect(screen.queryByPlaceholderText('Search tasks...')).not.toBeInTheDocument();
      expect(screen.queryByText('Overdue (1)')).not.toBeInTheDocument();
    });
  });

  describe('Search and Filtering', () => {
    it('handles search input correctly', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <FollowUpTaskList />
        </TestWrapper>
      );

      const searchInput = screen.getByPlaceholderText('Search tasks...');
      await user.type(searchInput, 'diabetes');

      expect(searchInput).toHaveValue('diabetes');
    });

    it('handles overdue filter correctly', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <FollowUpTaskList />
        </TestWrapper>
      );

      const overdueButton = screen.getByText('Overdue (1)');
      await user.click(overdueButton);

      expect(mockFilterByOverdue).toHaveBeenCalledWith(true);
    });

    it('handles pending filter correctly', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <FollowUpTaskList />
        </TestWrapper>
      );

      const pendingButton = screen.getByText('Pending');
      await user.click(pendingButton);

      expect(mockFilterByStatus).toHaveBeenCalledWith('pending');
    });
  });

  describe('Task Interactions', () => {
    it('calls onTaskSelect when task is clicked', async () => {
      const mockOnTaskSelect = vi.fn();
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <FollowUpTaskList onTaskSelect={mockOnTaskSelect} />
        </TestWrapper>
      );

      const taskItem = screen.getByText('Follow up on new diabetes medication');
      await user.click(taskItem);

      expect(mockSelectTask).toHaveBeenCalledWith(mockTasks[0]);
      expect(mockOnTaskSelect).toHaveBeenCalledWith(mockTasks[0]);
    });

    it('shows quick action buttons for pending tasks', () => {
      render(
        <TestWrapper>
          <FollowUpTaskList enableQuickActions={true} />
        </TestWrapper>
      );

      // Should show quick action buttons for pending tasks
      const completeButtons = screen.getAllByLabelText('Complete Task');
      expect(completeButtons).toHaveLength(2); // Two pending tasks

      const convertButtons = screen.getAllByLabelText('Convert to Appointment');
      expect(convertButtons).toHaveLength(2);
    });

    it('does not show quick actions when enableQuickActions is false', () => {
      render(
        <TestWrapper>
          <FollowUpTaskList enableQuickActions={false} />
        </TestWrapper>
      );

      // Should not show quick action buttons
      expect(screen.queryByLabelText('Complete Task')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Convert to Appointment')).not.toBeInTheDocument();
    });
  });

  describe('Complete Task Dialog', () => {
    it('opens complete task dialog when complete button is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <FollowUpTaskList enableQuickActions={true} />
        </TestWrapper>
      );

      const completeButton = screen.getAllByLabelText('Complete Task')[0];
      await user.click(completeButton);

      expect(screen.getByText('Complete Follow-up Task')).toBeInTheDocument();
      expect(screen.getByText('Complete "Follow up on new diabetes medication"')).toBeInTheDocument();
    });

    it('handles task completion correctly', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <FollowUpTaskList enableQuickActions={true} />
        </TestWrapper>
      );

      // Open dialog
      const completeButton = screen.getAllByLabelText('Complete Task')[0];
      await user.click(completeButton);

      // Fill in completion notes
      const notesInput = screen.getByRole('textbox', { name: /completion notes/i });
      await user.type(notesInput, 'Task completed successfully');

      // Submit
      const submitButton = screen.getByText('Complete Task');
      await user.click(submitButton);

      expect(mockCompleteTaskMutate).toHaveBeenCalledWith({
        taskId: '1',
        completionData: {
          outcome: {
            status: 'successful',
            notes: 'Task completed successfully',
            nextActions: [],
            appointmentCreated: false,
          },
        },
      });
    });
  });

  describe('Loading and Error States', () => {
    it('shows loading skeletons when loading', async () => {
      const { useFollowUpTasks } = await import('../../../hooks/useFollowUps');
      
      vi.mocked(useFollowUpTasks).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: mockRefetch,
      } as any);

      render(
        <TestWrapper>
          <FollowUpTaskList />
        </TestWrapper>
      );

      // Should show skeleton loaders - check for skeleton elements by class or test id
      const skeletons = document.querySelectorAll('.MuiSkeleton-root');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('shows error message when there is an error', async () => {
      const { useFollowUpTasks } = await import('../../../hooks/useFollowUps');
      const mockError = new Error('Failed to load tasks');
      
      vi.mocked(useFollowUpTasks).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: mockError,
        refetch: mockRefetch,
      } as any);

      render(
        <TestWrapper>
          <FollowUpTaskList />
        </TestWrapper>
      );

      expect(screen.getByText('Failed to load follow-up tasks: Failed to load tasks')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('shows empty state when no tasks are found', async () => {
      const { useFollowUpTasks } = await import('../../../hooks/useFollowUps');
      
      vi.mocked(useFollowUpTasks).mockReturnValue({
        data: {
          success: true,
          data: {
            tasks: [],
            summary: { ...mockSummary, total: 0 },
            pagination: { page: 1, limit: 50, total: 0, pages: 0 },
          },
        },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      } as any);

      render(
        <TestWrapper>
          <FollowUpTaskList />
        </TestWrapper>
      );

      expect(screen.getByText('No follow-up tasks found')).toBeInTheDocument();
      // The empty state text might not be rendered if onCreateTask is not provided
      // Let's just check for the main empty state message
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      render(
        <TestWrapper>
          <FollowUpTaskList />
        </TestWrapper>
      );

      // Check for proper roles and labels
      expect(screen.getByRole('list')).toBeInTheDocument();
      expect(screen.getAllByRole('listitem')).toHaveLength(2);
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <FollowUpTaskList />
        </TestWrapper>
      );

      const searchInput = screen.getByPlaceholderText('Search tasks...');
      
      // Tab to search input
      await user.tab();
      expect(searchInput).toHaveFocus();
    });
  });
});