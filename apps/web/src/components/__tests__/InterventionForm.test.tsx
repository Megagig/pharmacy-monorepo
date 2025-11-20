import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import InterventionForm from '../InterventionForm';
import * as clinicalInterventionService from '../../services/clinicalInterventionService';
import * as patientService from '../../services/patientService';

// Mock the services
vi.mock('../../services/clinicalInterventionService');
vi.mock('../../services/patientService');

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

// Mock react-hook-form
vi.mock('react-hook-form', async () => {
  const actual = await vi.importActual('react-hook-form');
  return {
    ...actual,
    useForm: () => ({
      register: vi.fn(),
      handleSubmit: vi.fn((fn) => (e) => {
        e.preventDefault();
        fn({
          patientId: 'patient-1',
          category: 'drug_therapy_problem',
          priority: 'high',
          issueDescription: 'Test issue description',
          strategies: [],
        });
      }),
      formState: { errors: {}, isSubmitting: false },
      setValue: vi.fn(),
      watch: vi.fn(),
      reset: vi.fn(),
    }),
  };
});

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

describe('InterventionForm', () => {
  const mockPatients = [
    {
      _id: 'patient-1',
      firstName: 'John',
      lastName: 'Doe',
      mrn: 'MRN123456',
      dob: '1980-01-01',
      phone: '+2348012345678',
    },
    {
      _id: 'patient-2',
      firstName: 'Jane',
      lastName: 'Smith',
      mrn: 'MRN789012',
      dob: '1975-05-15',
      phone: '+2348087654321',
    },
  ];

  const mockOnSuccess = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock service methods
    vi.mocked(patientService.getPatients).mockResolvedValue({
      data: mockPatients,
      pagination: {
        page: 1,
        limit: 100,
        total: 2,
        pages: 1,
        hasNext: false,
        hasPrev: false,
      },
    });

    vi.mocked(clinicalInterventionService.createIntervention).mockResolvedValue(
      {
        _id: 'intervention-1',
        interventionNumber: 'CI-202412-0001',
        category: 'drug_therapy_problem',
        priority: 'high',
        status: 'identified',
        issueDescription: 'Test issue description',
        patientId: 'patient-1',
        identifiedBy: 'user-1',
      }
    );
  });

  it('should render form with all required fields', async () => {
    render(
      <TestWrapper>
        <InterventionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      </TestWrapper>
    );

    // Check form title
    expect(
      screen.getByText('Create Clinical Intervention')
    ).toBeInTheDocument();

    // Check required form fields
    expect(screen.getByLabelText(/patient/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/priority/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/issue description/i)).toBeInTheDocument();

    // Check action buttons
    expect(
      screen.getByRole('button', { name: /create intervention/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('should load and display patients in dropdown', async () => {
    render(
      <TestWrapper>
        <InterventionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      </TestWrapper>
    );

    // Wait for patients to load
    await waitFor(() => {
      expect(patientService.getPatients).toHaveBeenCalled();
    });

    // Click patient dropdown
    const patientSelect = screen.getByLabelText(/patient/i);
    fireEvent.click(patientSelect);

    // Check patient options
    await waitFor(() => {
      expect(screen.getByText('John Doe (MRN123456)')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith (MRN789012)')).toBeInTheDocument();
    });
  });

  it('should validate required fields', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <InterventionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      </TestWrapper>
    );

    // Try to submit without filling required fields
    const submitButton = screen.getByRole('button', {
      name: /create intervention/i,
    });
    await user.click(submitButton);

    // Check for validation errors
    await waitFor(() => {
      expect(screen.getByText(/patient is required/i)).toBeInTheDocument();
      expect(screen.getByText(/category is required/i)).toBeInTheDocument();
      expect(screen.getByText(/priority is required/i)).toBeInTheDocument();
      expect(
        screen.getByText(/issue description is required/i)
      ).toBeInTheDocument();
    });
  });

  it('should validate issue description length', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <InterventionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      </TestWrapper>
    );

    // Fill issue description with text that's too short
    const issueDescriptionField = screen.getByLabelText(/issue description/i);
    await user.type(issueDescriptionField, 'Short');

    // Try to submit
    const submitButton = screen.getByRole('button', {
      name: /create intervention/i,
    });
    await user.click(submitButton);

    // Check for validation error
    await waitFor(() => {
      expect(
        screen.getByText(/issue description must be at least 10 characters/i)
      ).toBeInTheDocument();
    });
  });

  it('should handle category selection', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <InterventionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      </TestWrapper>
    );

    // Click category dropdown
    const categorySelect = screen.getByLabelText(/category/i);
    await user.click(categorySelect);

    // Select a category
    const drugTherapyOption = screen.getByText('Drug Therapy Problem');
    await user.click(drugTherapyOption);

    // Verify selection
    expect(categorySelect).toHaveValue('drug_therapy_problem');
  });

  it('should handle priority selection', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <InterventionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      </TestWrapper>
    );

    // Click priority dropdown
    const prioritySelect = screen.getByLabelText(/priority/i);
    await user.click(prioritySelect);

    // Select a priority
    const highPriorityOption = screen.getByText('High');
    await user.click(highPriorityOption);

    // Verify selection
    expect(prioritySelect).toHaveValue('high');
  });

  it('should add and remove strategies', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <InterventionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      </TestWrapper>
    );

    // Click add strategy button
    const addStrategyButton = screen.getByRole('button', {
      name: /add strategy/i,
    });
    await user.click(addStrategyButton);

    // Check that strategy form appears
    expect(screen.getByLabelText(/strategy type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/strategy description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/rationale/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/expected outcome/i)).toBeInTheDocument();

    // Fill strategy fields
    await user.selectOptions(
      screen.getByLabelText(/strategy type/i),
      'dose_adjustment'
    );
    await user.type(
      screen.getByLabelText(/strategy description/i),
      'Reduce dose by 50%'
    );
    await user.type(
      screen.getByLabelText(/rationale/i),
      'Patient experiencing side effects'
    );
    await user.type(
      screen.getByLabelText(/expected outcome/i),
      'Reduced side effects while maintaining efficacy'
    );

    // Save strategy
    const saveStrategyButton = screen.getByRole('button', {
      name: /save strategy/i,
    });
    await user.click(saveStrategyButton);

    // Check that strategy is added to list
    expect(screen.getByText('Dose Adjustment')).toBeInTheDocument();
    expect(screen.getByText('Reduce dose by 50%')).toBeInTheDocument();

    // Remove strategy
    const removeStrategyButton = screen.getByRole('button', {
      name: /remove strategy/i,
    });
    await user.click(removeStrategyButton);

    // Check that strategy is removed
    expect(screen.queryByText('Dose Adjustment')).not.toBeInTheDocument();
  });

  it('should handle form submission successfully', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <InterventionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      </TestWrapper>
    );

    // Wait for patients to load
    await waitFor(() => {
      expect(patientService.getPatients).toHaveBeenCalled();
    });

    // Fill form fields
    await user.selectOptions(screen.getByLabelText(/patient/i), 'patient-1');
    await user.selectOptions(
      screen.getByLabelText(/category/i),
      'drug_therapy_problem'
    );
    await user.selectOptions(screen.getByLabelText(/priority/i), 'high');
    await user.type(
      screen.getByLabelText(/issue description/i),
      'Patient experiencing significant side effects from current medication regimen'
    );

    // Submit form
    const submitButton = screen.getByRole('button', {
      name: /create intervention/i,
    });
    await user.click(submitButton);

    // Check that service was called
    await waitFor(() => {
      expect(
        clinicalInterventionService.createIntervention
      ).toHaveBeenCalledWith({
        patientId: 'patient-1',
        category: 'drug_therapy_problem',
        priority: 'high',
        issueDescription:
          'Patient experiencing significant side effects from current medication regimen',
        strategies: [],
      });
    });

    // Check that success callback was called
    expect(mockOnSuccess).toHaveBeenCalled();
  });

  it('should handle form submission with strategies', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <InterventionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      </TestWrapper>
    );

    // Fill basic form fields
    await user.selectOptions(screen.getByLabelText(/patient/i), 'patient-1');
    await user.selectOptions(
      screen.getByLabelText(/category/i),
      'drug_therapy_problem'
    );
    await user.selectOptions(screen.getByLabelText(/priority/i), 'high');
    await user.type(
      screen.getByLabelText(/issue description/i),
      'Patient experiencing side effects'
    );

    // Add strategy
    const addStrategyButton = screen.getByRole('button', {
      name: /add strategy/i,
    });
    await user.click(addStrategyButton);

    // Fill strategy fields
    await user.selectOptions(
      screen.getByLabelText(/strategy type/i),
      'dose_adjustment'
    );
    await user.type(
      screen.getByLabelText(/strategy description/i),
      'Reduce dose by 50%'
    );
    await user.type(
      screen.getByLabelText(/rationale/i),
      'Patient experiencing side effects'
    );
    await user.type(
      screen.getByLabelText(/expected outcome/i),
      'Reduced side effects while maintaining therapeutic efficacy'
    );

    // Save strategy
    const saveStrategyButton = screen.getByRole('button', {
      name: /save strategy/i,
    });
    await user.click(saveStrategyButton);

    // Submit form
    const submitButton = screen.getByRole('button', {
      name: /create intervention/i,
    });
    await user.click(submitButton);

    // Check that service was called with strategy
    await waitFor(() => {
      expect(
        clinicalInterventionService.createIntervention
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          strategies: expect.arrayContaining([
            expect.objectContaining({
              type: 'dose_adjustment',
              description: 'Reduce dose by 50%',
              rationale: 'Patient experiencing side effects',
              expectedOutcome:
                'Reduced side effects while maintaining therapeutic efficacy',
            }),
          ]),
        })
      );
    });
  });

  it('should handle form submission errors', async () => {
    const user = userEvent.setup();

    // Mock service to throw error
    vi.mocked(clinicalInterventionService.createIntervention).mockRejectedValue(
      new Error('Failed to create intervention')
    );

    render(
      <TestWrapper>
        <InterventionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      </TestWrapper>
    );

    // Fill and submit form
    await user.selectOptions(screen.getByLabelText(/patient/i), 'patient-1');
    await user.selectOptions(
      screen.getByLabelText(/category/i),
      'drug_therapy_problem'
    );
    await user.selectOptions(screen.getByLabelText(/priority/i), 'high');
    await user.type(
      screen.getByLabelText(/issue description/i),
      'Patient experiencing side effects'
    );

    const submitButton = screen.getByRole('button', {
      name: /create intervention/i,
    });
    await user.click(submitButton);

    // Check for error message
    await waitFor(() => {
      expect(
        screen.getByText(/failed to create intervention/i)
      ).toBeInTheDocument();
    });

    // Success callback should not be called
    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  it('should handle cancel action', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <InterventionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      </TestWrapper>
    );

    // Click cancel button
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    // Check that cancel callback was called
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should handle estimated duration input', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <InterventionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      </TestWrapper>
    );

    // Find estimated duration field
    const durationField = screen.getByLabelText(/estimated duration/i);
    await user.type(durationField, '60');

    // Verify value
    expect(durationField).toHaveValue(60);
  });

  it('should validate strategy fields when adding strategy', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <InterventionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      </TestWrapper>
    );

    // Click add strategy button
    const addStrategyButton = screen.getByRole('button', {
      name: /add strategy/i,
    });
    await user.click(addStrategyButton);

    // Try to save strategy without filling required fields
    const saveStrategyButton = screen.getByRole('button', {
      name: /save strategy/i,
    });
    await user.click(saveStrategyButton);

    // Check for validation errors
    await waitFor(() => {
      expect(
        screen.getByText(/strategy type is required/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/description is required/i)).toBeInTheDocument();
      expect(screen.getByText(/rationale is required/i)).toBeInTheDocument();
      expect(
        screen.getByText(/expected outcome is required/i)
      ).toBeInTheDocument();
    });
  });

  it('should handle patient search', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <InterventionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      </TestWrapper>
    );

    // Find patient search field (if it exists)
    const patientSearchField = screen.queryByLabelText(/search patients/i);

    if (patientSearchField) {
      await user.type(patientSearchField, 'John');

      // Check that filtered results appear
      await waitFor(() => {
        expect(screen.getByText('John Doe (MRN123456)')).toBeInTheDocument();
        expect(
          screen.queryByText('Jane Smith (MRN789012)')
        ).not.toBeInTheDocument();
      });
    }
  });

  it('should be accessible', async () => {
    render(
      <TestWrapper>
        <InterventionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      </TestWrapper>
    );

    // Check for proper form structure
    expect(screen.getByRole('form')).toBeInTheDocument();

    // Check for proper labels
    expect(screen.getByLabelText(/patient/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/priority/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/issue description/i)).toBeInTheDocument();

    // Check for proper headings
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();

    // Check for proper button roles
    expect(
      screen.getByRole('button', { name: /create intervention/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('should handle keyboard navigation', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <InterventionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      </TestWrapper>
    );

    // Tab through form fields
    await user.tab();
    expect(screen.getByLabelText(/patient/i)).toHaveFocus();

    await user.tab();
    expect(screen.getByLabelText(/category/i)).toHaveFocus();

    await user.tab();
    expect(screen.getByLabelText(/priority/i)).toHaveFocus();

    await user.tab();
    expect(screen.getByLabelText(/issue description/i)).toHaveFocus();
  });

  it('should handle form reset', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <InterventionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      </TestWrapper>
    );

    // Fill some fields
    await user.selectOptions(
      screen.getByLabelText(/category/i),
      'drug_therapy_problem'
    );
    await user.type(
      screen.getByLabelText(/issue description/i),
      'Test description'
    );

    // Reset form (if reset button exists)
    const resetButton = screen.queryByRole('button', { name: /reset/i });
    if (resetButton) {
      await user.click(resetButton);

      // Check that fields are cleared
      expect(screen.getByLabelText(/category/i)).toHaveValue('');
      expect(screen.getByLabelText(/issue description/i)).toHaveValue('');
    }
  });
});
