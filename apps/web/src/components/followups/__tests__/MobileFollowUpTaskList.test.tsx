import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';
import userEvent from '@testing-library/user-event';
import MobileFollowUpTaskList from '../MobileFollowUpTaskList';
import { MobileAccessibilityProvider } from '../../common/MobileAccessibilityProvider';

// Mock hooks
jest.mock('../../../hooks/useFollowUps', () => ({
  useFollowUpTasks: jest.fn(() => ({
    data: {
      data: {
        tasks: [
          {
            _id: '1',
            title: 'Test Follow-up Task',
            description: 'Test description',
            type: 'medication_start_followup',
            priority: 'high',
            status: 'pending',
            dueDate: new Date('2025-10-28'),
            patientId: 'patient1',
            assignedTo: 'pharmacist1',
            estimatedDuration: 30,
          },
          {
            _id: '2',
            title: 'Overdue Task',
            description: 'Overdue task description',
            type: 'lab_result_review',
            priority: 'urgent',
            status: 'pending',
            dueDate: new Date('2025-10-25'), // Past date
            patientId: 'patient2',
            assignedTo: 'pharmacist1',
          },
        ],
      },
    },
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  })),
  useCompleteFollowUp: jest.fn(() => ({
    mutateAsync: jest.fn(),
    isLoading: false,
  })),
  useConvertToAppointment: jest.fn(() => ({
    mutateAsync: jest.fn(),
  })),
  useEscalateFollowUp: jest.fn(() => ({
    mutateAsync: jest.fn(),
  })),
}));

jest.mock('../../../stores/followUpStore', () => ({
  useFollowUpFilters: jest.fn(() => ({
    filters: {},
    setFilters: jest.fn(),
    clearFilters: jest.fn(),
  })),
  useFollowUpStore: jest.fn(() => ({
    selectTask: jest.fn(),
  })),
}));

jest.mock('../../../hooks/useResponsive', () => ({
  useResponsive: jest.fn(() => ({
    isMobile: true,
    isSmallMobile: false,
    getSpacing: jest.fn((mobile) => mobile),
  })),
  useIsTouchDevice: jest.fn(() => true),
  useSafeAreaInsets: jest.fn(() => ({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  })),
}));

jest.mock('../../../hooks/useTouchGestures', () => ({
  useTouchGestures: jest.fn(() => ({
    attachGestures: jest.fn(),
  })),
}));

const theme = createTheme();
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider theme={theme}>
      <MobileAccessibilityProvider>
        {children}
      </MobileAccessibilityProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

describe('MobileFollowUpTaskList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders mobile task list interface', () => {
    render(
      <TestWrapper>
        <MobileFollowUpTaskList />
      </TestWrapper>
    );

    expect(screen.getByText('Follow-up Tasks')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search tasks...')).toBeInTheDocument();
  });

  it('displays tasks in the list', () => {
    render(
      <TestWrapper>
        <MobileFollowUpTaskList />
      </TestWrapper>
    );

    expect(screen.getByText('Test Follow-up Task')).toBeInTheDocument();
    expect(screen.getByText('Overdue Task')).toBeInTheDocument();
  });

  it('shows task details with proper formatting', () => {
    render(
      <TestWrapper>
        <MobileFollowUpTaskList />
      </TestWrapper>
    );

    // Check for task type labels
    expect(screen.getByText('💊 Medication Start')).toBeInTheDocument();
    expect(screen.getByText('🧪 Lab Result Review')).toBeInTheDocument();

    // Check for status chips
    expect(screen.getAllByText('PENDING')).toHaveLength(2);

    // Check for due dates
    expect(screen.getByText('Due: Oct 28')).toBeInTheDocument();
    expect(screen.getByText('Due: Oct 25')).toBeInTheDocument();
  });

  it('highlights overdue tasks', () => {
    render(
      <TestWrapper>
        <MobileFollowUpTaskList />
      </TestWrapper>
    );

    expect(screen.getByText('OVERDUE')).toBeInTheDocument();
  });

  it('shows filter chips with counts', () => {
    render(
      <TestWrapper>
        <MobileFollowUpTaskList />
      </TestWrapper>
    );

    expect(screen.getByText('📋 All Tasks')).toBeInTheDocument();
    expect(screen.getByText('⏳ Pending')).toBeInTheDocument();
    expect(screen.getByText('🚨 Overdue')).toBeInTheDocument();
    expect(screen.getByText('🔥 High Priority')).toBeInTheDocument();
  });

  it('handles search functionality', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <MobileFollowUpTaskList />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText('Search tasks...');
    await user.type(searchInput, 'Test');

    expect(searchInput).toHaveValue('Test');
  });

  it('handles filter selection', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <MobileFollowUpTaskList />
      </TestWrapper>
    );

    const overdueFilter = screen.getByText('🚨 Overdue');
    await user.click(overdueFilter);

    // Should highlight the selected filter
    expect(overdueFilter.closest('.MuiChip-root')).toHaveClass('MuiChip-filled');
  });

  it('shows floating action button when onCreateTask is provided', () => {
    const onCreateTask = jest.fn();
    
    render(
      <TestWrapper>
        <MobileFollowUpTaskList onCreateTask={onCreateTask} />
      </TestWrapper>
    );

    expect(screen.getByLabelText('add task')).toBeInTheDocument();
  });

  it('handles task click to show details', async () => {
    const onTaskSelect = jest.fn();
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <MobileFollowUpTaskList onTaskSelect={onTaskSelect} />
      </TestWrapper>
    );

    const taskItem = screen.getByText('Test Follow-up Task').closest('li');
    await user.click(taskItem!);

    expect(onTaskSelect).toHaveBeenCalled();
  });

  it('shows quick action menu for pending tasks', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <MobileFollowUpTaskList />
      </TestWrapper>
    );

    const moreButton = screen.getAllByLabelText(/more/i)[0];
    await user.click(moreButton);

    await waitFor(() => {
      expect(screen.getByText('Complete Task')).toBeInTheDocument();
      expect(screen.getByText('Convert to Appointment')).toBeInTheDocument();
    });
  });

  it('handles task completion', async () => {
    const mockCompleteTask = jest.fn();
    const useCompleteFollowUp = require('../../../hooks/useFollowUps').useCompleteFollowUp;
    useCompleteFollowUp.mockReturnValue({
      mutateAsync: mockCompleteTask,
      isLoading: false,
    });

    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <MobileFollowUpTaskList />
      </TestWrapper>
    );

    // Open quick action menu
    const moreButton = screen.getAllByLabelText(/more/i)[0];
    await user.click(moreButton);

    // Click complete task
    const completeButton = screen.getByText('Complete Task');
    await user.click(completeButton);

    // Should open completion dialog
    await waitFor(() => {
      expect(screen.getByText('Complete Task')).toBeInTheDocument();
    });

    // Fill in completion notes
    const notesInput = screen.getByLabelText('Completion Notes');
    await user.type(notesInput, 'Task completed successfully');

    // Submit completion
    const submitButton = screen.getByText('Complete');
    await user.click(submitButton);

    expect(mockCompleteTask).toHaveBeenCalled();
  });

  it('displays touch gesture hints', () => {
    render(
      <TestWrapper>
        <MobileFollowUpTaskList />
      </TestWrapper>
    );

    expect(screen.getByText(/swipe left: complete/i)).toBeInTheDocument();
  });

  it('shows task details in swipeable drawer', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <MobileFollowUpTaskList />
      </TestWrapper>
    );

    const taskItem = screen.getByText('Test Follow-up Task').closest('li');
    await user.click(taskItem!);

    // Should open drawer with task details
    await waitFor(() => {
      expect(screen.getByText('Details')).toBeInTheDocument();
    });
  });

  it('handles refresh action', async () => {
    const mockRefetch = jest.fn();
    const useFollowUpTasks = require('../../../hooks/useFollowUps').useFollowUpTasks;
    useFollowUpTasks.mockReturnValue({
      data: { data: { tasks: [] } },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <MobileFollowUpTaskList />
      </TestWrapper>
    );

    const refreshButton = screen.getByLabelText(/refresh/i);
    await user.click(refreshButton);

    expect(mockRefetch).toHaveBeenCalled();
  });

  it('displays loading state correctly', () => {
    const useFollowUpTasks = require('../../../hooks/useFollowUps').useFollowUpTasks;
    useFollowUpTasks.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    });

    render(
      <TestWrapper>
        <MobileFollowUpTaskList />
      </TestWrapper>
    );

    // Should show skeleton loaders
    expect(screen.getAllByTestId(/skeleton/i)).toHaveLength(5);
  });

  it('displays error state correctly', () => {
    const useFollowUpTasks = require('../../../hooks/useFollowUps').useFollowUpTasks;
    useFollowUpTasks.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Failed to load tasks'),
      refetch: jest.fn(),
    });

    render(
      <TestWrapper>
        <MobileFollowUpTaskList />
      </TestWrapper>
    );

    expect(screen.getByText(/failed to load follow-up tasks/i)).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('displays empty state when no tasks', () => {
    const useFollowUpTasks = require('../../../hooks/useFollowUps').useFollowUpTasks;
    useFollowUpTasks.mockReturnValue({
      data: { data: { tasks: [] } },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(
      <TestWrapper>
        <MobileFollowUpTaskList />
      </TestWrapper>
    );

    expect(screen.getByText('No follow-up tasks found')).toBeInTheDocument();
  });

  it('applies safe area insets for devices with notches', () => {
    const useSafeAreaInsets = require('../../../hooks/useResponsive').useSafeAreaInsets;
    useSafeAreaInsets.mockReturnValue({
      top: 44,
      right: 0,
      bottom: 34,
      left: 0,
    });

    render(
      <TestWrapper>
        <MobileFollowUpTaskList />
      </TestWrapper>
    );

    // Should apply safe area insets to container
    const container = screen.getByText('Follow-up Tasks').closest('div');
    expect(container).toHaveStyle('padding-top: 44px');
  });

  it('supports accessibility features', () => {
    render(
      <TestWrapper>
        <MobileFollowUpTaskList onCreateTask={jest.fn()} />
      </TestWrapper>
    );

    // Check for ARIA labels
    expect(screen.getByLabelText('add task')).toBeInTheDocument();
    
    // Check for proper list structure
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });
});

describe('MobileFollowUpTaskList Touch Gestures', () => {
  it('attaches touch gesture handlers to task items', () => {
    const mockAttachGestures = jest.fn();
    const useTouchGestures = require('../../../hooks/useTouchGestures').useTouchGestures;
    useTouchGestures.mockReturnValue({
      attachGestures: mockAttachGestures,
    });

    render(
      <TestWrapper>
        <MobileFollowUpTaskList />
      </TestWrapper>
    );

    // Should attach gestures to task items
    expect(mockAttachGestures).toHaveBeenCalled();
  });

  it('handles swipe gestures for quick actions', () => {
    const useTouchGestures = require('../../../hooks/useTouchGestures').useTouchGestures;
    let gestureHandlers: any = {};
    useTouchGestures.mockImplementation((handlers: any) => {
      gestureHandlers = handlers;
      return { attachGestures: jest.fn() };
    });

    render(
      <TestWrapper>
        <MobileFollowUpTaskList />
      </TestWrapper>
    );

    // Mock element with task ID
    const mockElement = {
      getAttribute: jest.fn(() => '1'),
    };

    // Simulate swipe left (complete)
    act(() => {
      gestureHandlers.onSwipeLeft(mockElement);
    });

    // Should trigger complete action
    expect(mockElement.getAttribute).toHaveBeenCalledWith('data-task-id');
  });

  it('handles swipe right for convert to appointment', () => {
    const useTouchGestures = require('../../../hooks/useTouchGestures').useTouchGestures;
    let gestureHandlers: any = {};
    useTouchGestures.mockImplementation((handlers: any) => {
      gestureHandlers = handlers;
      return { attachGestures: jest.fn() };
    });

    render(
      <TestWrapper>
        <MobileFollowUpTaskList />
      </TestWrapper>
    );

    // Mock element with task ID
    const mockElement = {
      getAttribute: jest.fn(() => '1'),
    };

    // Simulate swipe right (convert)
    act(() => {
      gestureHandlers.onSwipeRight(mockElement);
    });

    // Should trigger convert action
    expect(mockElement.getAttribute).toHaveBeenCalledWith('data-task-id');
  });
});