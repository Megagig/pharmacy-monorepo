import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ClinicalInterventionDashboard from '../ClinicalInterventionDashboard';
import * as clinicalInterventionService from '../../services/clinicalInterventionService';

// Mock the service
vi.mock('../../services/clinicalInterventionService');

// Mock the hooks
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      firstName: 'Test',
      lastName: 'User',
      role: 'pharmacist',
    },
    isAuthenticated: true,
  }),
}));

vi.mock('../../hooks/useErrorHandling', () => ({
  useErrorHandling: () => ({
    handleError: vi.fn(),
    clearError: vi.fn(),
    error: null,
  }),
}));

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryProvider>
  );
};

describe('ClinicalInterventionDashboard', () => {
  const mockInterventions = [
    {
      _id: 'intervention-1',
      interventionNumber: 'CI-202412-0001',
      category: 'drug_therapy_problem',
      priority: 'high',
      status: 'in_progress',
      issueDescription: 'Patient experiencing side effects',
      patientId: 'patient-1',
      identifiedBy: 'user-1',
      identifiedDate: '2024-12-01T10:00:00Z',
      patient: {
        firstName: 'John',
        lastName: 'Doe',
        mrn: 'MRN123456',
      },
    },
    {
      _id: 'intervention-2',
      interventionNumber: 'CI-202412-0002',
      category: 'adverse_drug_reaction',
      priority: 'critical',
      status: 'completed',
      issueDescription: 'Severe allergic reaction',
      patientId: 'patient-2',
      identifiedBy: 'user-1',
      identifiedDate: '2024-12-02T14:30:00Z',
      completedAt: '2024-12-03T09:15:00Z',
      patient: {
        firstName: 'Jane',
        lastName: 'Smith',
        mrn: 'MRN789012',
      },
    },
  ];

  const mockMetrics = {
    totalInterventions: 25,
    activeInterventions: 8,
    completedInterventions: 15,
    overdueInterventions: 2,
    successRate: 85.5,
    averageResolutionTime: 3.2,
    totalCostSavings: 12500,
    categoryDistribution: [
      { name: 'Drug Therapy Problems', value: 12, color: '#8884d8' },
      { name: 'Adverse Drug Reactions', value: 8, color: '#82ca9d' },
      { name: 'Medication Adherence', value: 5, color: '#ffc658' },
    ],
    priorityDistribution: [
      { name: 'Critical', value: 3, color: '#ff4444' },
      { name: 'High', value: 8, color: '#ff8800' },
      { name: 'Medium', value: 10, color: '#ffcc00' },
      { name: 'Low', value: 4, color: '#44ff44' },
    ],
    monthlyTrends: [
      { month: 'Nov', total: 20, completed: 18, successRate: 90 },
      { month: 'Dec', total: 25, completed: 20, successRate: 80 },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock service methods
    vi.mocked(clinicalInterventionService.getInterventions).mockResolvedValue({
      data: mockInterventions,
      pagination: {
        page: 1,
        limit: 10,
        total: 2,
        pages: 1,
        hasNext: false,
        hasPrev: false,
      },
    });

    vi.mocked(
      clinicalInterventionService.getDashboardMetrics
    ).mockResolvedValue(mockMetrics);
  });

  it('should render dashboard with metrics and interventions', async () => {
    render(
      <TestWrapper>
        <ClinicalInterventionDashboard />
      </TestWrapper>
    );

    // Check for loading state initially
    expect(screen.getByText(/loading/i)).toBeInTheDocument();

    // Wait for data to load
    await waitFor(() => {
      expect(
        screen.getByText('Clinical Interventions Dashboard')
      ).toBeInTheDocument();
    });

    // Check metrics are displayed
    await waitFor(() => {
      expect(screen.getByText('25')).toBeInTheDocument(); // Total interventions
      expect(screen.getByText('8')).toBeInTheDocument(); // Active interventions
      expect(screen.getByText('85.5%')).toBeInTheDocument(); // Success rate
    });

    // Check interventions list
    expect(screen.getByText('CI-202412-0001')).toBeInTheDocument();
    expect(screen.getByText('CI-202412-0002')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('should handle filtering by status', async () => {
    render(
      <TestWrapper>
        <ClinicalInterventionDashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(
        screen.getByText('Clinical Interventions Dashboard')
      ).toBeInTheDocument();
    });

    // Find and click status filter
    const statusFilter = screen.getByLabelText(/status/i);
    fireEvent.change(statusFilter, { target: { value: 'in_progress' } });

    await waitFor(() => {
      expect(clinicalInterventionService.getInterventions).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'in_progress',
        })
      );
    });
  });

  it('should handle filtering by priority', async () => {
    render(
      <TestWrapper>
        <ClinicalInterventionDashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(
        screen.getByText('Clinical Interventions Dashboard')
      ).toBeInTheDocument();
    });

    // Find and click priority filter
    const priorityFilter = screen.getByLabelText(/priority/i);
    fireEvent.change(priorityFilter, { target: { value: 'critical' } });

    await waitFor(() => {
      expect(clinicalInterventionService.getInterventions).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 'critical',
        })
      );
    });
  });

  it('should handle search functionality', async () => {
    render(
      <TestWrapper>
        <ClinicalInterventionDashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(
        screen.getByText('Clinical Interventions Dashboard')
      ).toBeInTheDocument();
    });

    // Find search input and type
    const searchInput = screen.getByPlaceholderText(/search interventions/i);
    fireEvent.change(searchInput, { target: { value: 'CI-202412-0001' } });

    // Wait for debounced search
    await waitFor(
      () => {
        expect(
          clinicalInterventionService.getInterventions
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            search: 'CI-202412-0001',
          })
        );
      },
      { timeout: 1000 }
    );
  });

  it('should handle pagination', async () => {
    // Mock paginated response
    vi.mocked(clinicalInterventionService.getInterventions).mockResolvedValue({
      data: mockInterventions,
      pagination: {
        page: 1,
        limit: 10,
        total: 25,
        pages: 3,
        hasNext: true,
        hasPrev: false,
      },
    });

    render(
      <TestWrapper>
        <ClinicalInterventionDashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(
        screen.getByText('Clinical Interventions Dashboard')
      ).toBeInTheDocument();
    });

    // Check pagination controls
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();

    // Click next page
    const nextButton = screen.getByLabelText(/next page/i);
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(clinicalInterventionService.getInterventions).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
        })
      );
    });
  });

  it('should display priority badges correctly', async () => {
    render(
      <TestWrapper>
        <ClinicalInterventionDashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(
        screen.getByText('Clinical Interventions Dashboard')
      ).toBeInTheDocument();
    });

    // Check priority badges
    const highPriorityBadge = screen.getByText('High');
    const criticalPriorityBadge = screen.getByText('Critical');

    expect(highPriorityBadge).toBeInTheDocument();
    expect(criticalPriorityBadge).toBeInTheDocument();

    // Check badge colors (assuming they have specific classes)
    expect(highPriorityBadge).toHaveClass('priority-high');
    expect(criticalPriorityBadge).toHaveClass('priority-critical');
  });

  it('should display status indicators correctly', async () => {
    render(
      <TestWrapper>
        <ClinicalInterventionDashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(
        screen.getByText('Clinical Interventions Dashboard')
      ).toBeInTheDocument();
    });

    // Check status indicators
    const inProgressStatus = screen.getByText('In Progress');
    const completedStatus = screen.getByText('Completed');

    expect(inProgressStatus).toBeInTheDocument();
    expect(completedStatus).toBeInTheDocument();
  });

  it('should handle intervention selection', async () => {
    render(
      <TestWrapper>
        <ClinicalInterventionDashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(
        screen.getByText('Clinical Interventions Dashboard')
      ).toBeInTheDocument();
    });

    // Click on an intervention
    const interventionRow = screen.getByText('CI-202412-0001').closest('tr');
    expect(interventionRow).toBeInTheDocument();

    fireEvent.click(interventionRow!);

    // Should navigate to intervention details (mocked router would handle this)
    // In a real test, you'd check for navigation or modal opening
  });

  it('should handle error states', async () => {
    // Mock service to throw error
    vi.mocked(clinicalInterventionService.getInterventions).mockRejectedValue(
      new Error('Failed to fetch interventions')
    );

    render(
      <TestWrapper>
        <ClinicalInterventionDashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(
        screen.getByText(/error loading interventions/i)
      ).toBeInTheDocument();
    });
  });

  it('should handle empty state', async () => {
    // Mock empty response
    vi.mocked(clinicalInterventionService.getInterventions).mockResolvedValue({
      data: [],
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        pages: 0,
        hasNext: false,
        hasPrev: false,
      },
    });

    render(
      <TestWrapper>
        <ClinicalInterventionDashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/no interventions found/i)).toBeInTheDocument();
    });
  });

  it('should refresh data when refresh button is clicked', async () => {
    render(
      <TestWrapper>
        <ClinicalInterventionDashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(
        screen.getByText('Clinical Interventions Dashboard')
      ).toBeInTheDocument();
    });

    // Clear previous calls
    vi.clearAllMocks();

    // Click refresh button
    const refreshButton = screen.getByLabelText(/refresh/i);
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(clinicalInterventionService.getInterventions).toHaveBeenCalled();
      expect(
        clinicalInterventionService.getDashboardMetrics
      ).toHaveBeenCalled();
    });
  });

  it('should display charts correctly', async () => {
    render(
      <TestWrapper>
        <ClinicalInterventionDashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(
        screen.getByText('Clinical Interventions Dashboard')
      ).toBeInTheDocument();
    });

    // Check for chart containers (assuming they have specific test IDs)
    expect(
      screen.getByTestId('category-distribution-chart')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('priority-distribution-chart')
    ).toBeInTheDocument();
    expect(screen.getByTestId('monthly-trends-chart')).toBeInTheDocument();
  });

  it('should handle date range filtering', async () => {
    render(
      <TestWrapper>
        <ClinicalInterventionDashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(
        screen.getByText('Clinical Interventions Dashboard')
      ).toBeInTheDocument();
    });

    // Find date range inputs
    const fromDateInput = screen.getByLabelText(/from date/i);
    const toDateInput = screen.getByLabelText(/to date/i);

    // Set date range
    fireEvent.change(fromDateInput, { target: { value: '2024-12-01' } });
    fireEvent.change(toDateInput, { target: { value: '2024-12-31' } });

    await waitFor(() => {
      expect(clinicalInterventionService.getInterventions).toHaveBeenCalledWith(
        expect.objectContaining({
          dateFrom: '2024-12-01',
          dateTo: '2024-12-31',
        })
      );
    });
  });

  it('should handle sorting', async () => {
    render(
      <TestWrapper>
        <ClinicalInterventionDashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(
        screen.getByText('Clinical Interventions Dashboard')
      ).toBeInTheDocument();
    });

    // Click on a sortable column header
    const priorityHeader = screen.getByText('Priority');
    fireEvent.click(priorityHeader);

    await waitFor(() => {
      expect(clinicalInterventionService.getInterventions).toHaveBeenCalledWith(
        expect.objectContaining({
          sortBy: 'priority',
          sortOrder: 'asc',
        })
      );
    });

    // Click again to reverse sort
    fireEvent.click(priorityHeader);

    await waitFor(() => {
      expect(clinicalInterventionService.getInterventions).toHaveBeenCalledWith(
        expect.objectContaining({
          sortBy: 'priority',
          sortOrder: 'desc',
        })
      );
    });
  });

  it('should display correct metrics formatting', async () => {
    render(
      <TestWrapper>
        <ClinicalInterventionDashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(
        screen.getByText('Clinical Interventions Dashboard')
      ).toBeInTheDocument();
    });

    // Check formatted metrics
    expect(screen.getByText('$12,500')).toBeInTheDocument(); // Cost savings
    expect(screen.getByText('3.2 days')).toBeInTheDocument(); // Average resolution time
  });

  it('should handle keyboard navigation', async () => {
    render(
      <TestWrapper>
        <ClinicalInterventionDashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(
        screen.getByText('Clinical Interventions Dashboard')
      ).toBeInTheDocument();
    });

    // Test keyboard navigation on intervention rows
    const firstRow = screen.getByText('CI-202412-0001').closest('tr');
    expect(firstRow).toBeInTheDocument();

    // Focus and press Enter
    firstRow!.focus();
    fireEvent.keyDown(firstRow!, { key: 'Enter', code: 'Enter' });

    // Should trigger selection (in real implementation)
  });

  it('should be accessible', async () => {
    render(
      <TestWrapper>
        <ClinicalInterventionDashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(
        screen.getByText('Clinical Interventions Dashboard')
      ).toBeInTheDocument();
    });

    // Check for proper ARIA labels
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(6); // Assuming 6 columns

    // Check for proper headings hierarchy
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
});
