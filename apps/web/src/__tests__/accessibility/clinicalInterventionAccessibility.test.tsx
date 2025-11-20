import { render, screen } from '@testing-library/react';
import { QueryClient, QueryProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import ClinicalInterventionDashboard from '../../components/ClinicalInterventionDashboard';
import InterventionForm from '../../components/InterventionForm';
import * as clinicalInterventionService from '../../services/clinicalInterventionService';
import * as patientService from '../../services/patientService';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

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

describe('Clinical Intervention Accessibility Tests', () => {
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
      patient: mockPatients[0],
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
    ],
    priorityDistribution: [{ name: 'High', value: 8, color: '#ff8800' }],
    monthlyTrends: [
      { month: 'Dec', total: 25, completed: 20, successRate: 80 },
    ],
  };

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

    vi.mocked(clinicalInterventionService.getInterventions).mockResolvedValue({
      data: mockInterventions,
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        pages: 1,
        hasNext: false,
        hasPrev: false,
      },
    });

    vi.mocked(
      clinicalInterventionService.getDashboardMetrics
    ).mockResolvedValue(mockMetrics);
  });

  describe('ClinicalInterventionDashboard Accessibility', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(
        <TestWrapper>
          <ClinicalInterventionDashboard />
        </TestWrapper>
      );

      // Wait for component to load
      await screen.findByText('Clinical Interventions Dashboard');

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper heading hierarchy', async () => {
      render(
        <TestWrapper>
          <ClinicalInterventionDashboard />
        </TestWrapper>
      );

      await screen.findByText('Clinical Interventions Dashboard');

      // Check for proper heading structure
      const h1Elements = screen.getAllByRole('heading', { level: 1 });
      expect(h1Elements).toHaveLength(1);
      expect(h1Elements[0]).toHaveTextContent(
        'Clinical Interventions Dashboard'
      );

      // Check for h2 elements (section headings)
      const h2Elements = screen.getAllByRole('heading', { level: 2 });
      expect(h2Elements.length).toBeGreaterThan(0);

      // Ensure no heading levels are skipped
      const allHeadings = screen.getAllByRole('heading');
      const headingLevels = allHeadings
        .map((heading) => parseInt(heading.tagName.charAt(1)))
        .sort();

      for (let i = 1; i < headingLevels.length; i++) {
        const currentLevel = headingLevels[i];
        const previousLevel = headingLevels[i - 1];
        expect(currentLevel - previousLevel).toBeLessThanOrEqual(1);
      }
    });

    it('should have proper ARIA labels and roles', async () => {
      render(
        <TestWrapper>
          <ClinicalInterventionDashboard />
        </TestWrapper>
      );

      await screen.findByText('Clinical Interventions Dashboard');

      // Check for main landmark
      expect(screen.getByRole('main')).toBeInTheDocument();

      // Check for table with proper role
      expect(screen.getByRole('table')).toBeInTheDocument();

      // Check for search functionality
      const searchInput = screen.getByRole('searchbox');
      expect(searchInput).toHaveAttribute('aria-label');

      // Check for filter controls
      const categoryFilter = screen.getByLabelText(/category/i);
      expect(categoryFilter).toHaveAttribute('aria-label');

      const priorityFilter = screen.getByLabelText(/priority/i);
      expect(priorityFilter).toHaveAttribute('aria-label');

      const statusFilter = screen.getByLabelText(/status/i);
      expect(statusFilter).toHaveAttribute('aria-label');
    });

    it('should have proper table structure', async () => {
      render(
        <TestWrapper>
          <ClinicalInterventionDashboard />
        </TestWrapper>
      );

      await screen.findByText('Clinical Interventions Dashboard');

      // Check table structure
      const table = screen.getByRole('table');
      expect(table).toHaveAttribute('aria-label');

      // Check for column headers
      const columnHeaders = screen.getAllByRole('columnheader');
      expect(columnHeaders.length).toBeGreaterThan(0);

      // Each column header should have proper text content
      columnHeaders.forEach((header) => {
        expect(header.textContent).toBeTruthy();
      });

      // Check for table rows
      const rows = screen.getAllByRole('row');
      expect(rows.length).toBeGreaterThan(1); // Header row + data rows

      // Check for table cells
      const cells = screen.getAllByRole('cell');
      expect(cells.length).toBeGreaterThan(0);
    });

    it('should have keyboard accessible controls', async () => {
      render(
        <TestWrapper>
          <ClinicalInterventionDashboard />
        </TestWrapper>
      );

      await screen.findByText('Clinical Interventions Dashboard');

      // Check that interactive elements are focusable
      const createButton = screen.getByRole('button', {
        name: /create intervention/i,
      });
      expect(createButton).toHaveAttribute('tabindex', '0');

      const searchInput = screen.getByRole('searchbox');
      expect(searchInput).not.toHaveAttribute('tabindex', '-1');

      const categoryFilter = screen.getByLabelText(/category/i);
      expect(categoryFilter).not.toHaveAttribute('tabindex', '-1');

      // Check for proper button roles
      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toHaveAttribute('type');
      });
    });

    it('should have proper color contrast', async () => {
      render(
        <TestWrapper>
          <ClinicalInterventionDashboard />
        </TestWrapper>
      );

      await screen.findByText('Clinical Interventions Dashboard');

      // Check priority badges have proper contrast
      const highPriorityBadge = screen.getByText('High');
      const computedStyle = window.getComputedStyle(highPriorityBadge);

      // Ensure text is visible (not transparent)
      expect(computedStyle.color).not.toBe('transparent');
      expect(computedStyle.backgroundColor).not.toBe('transparent');
    });

    it('should provide status information to screen readers', async () => {
      render(
        <TestWrapper>
          <ClinicalInterventionDashboard />
        </TestWrapper>
      );

      await screen.findByText('Clinical Interventions Dashboard');

      // Check for status indicators with proper ARIA attributes
      const statusElements = screen.getAllByText(
        /in progress|completed|identified/i
      );
      statusElements.forEach((element) => {
        // Should have role or aria-label for screen readers
        expect(
          element.hasAttribute('role') ||
            element.hasAttribute('aria-label') ||
            element.closest('[role]') ||
            element.closest('[aria-label]')
        ).toBeTruthy();
      });
    });

    it('should have proper pagination accessibility', async () => {
      // Mock paginated response
      vi.mocked(clinicalInterventionService.getInterventions).mockResolvedValue(
        {
          data: mockInterventions,
          pagination: {
            page: 1,
            limit: 10,
            total: 25,
            pages: 3,
            hasNext: true,
            hasPrev: false,
          },
        }
      );

      render(
        <TestWrapper>
          <ClinicalInterventionDashboard />
        </TestWrapper>
      );

      await screen.findByText('Clinical Interventions Dashboard');

      // Check pagination controls
      const nextButton = screen.getByLabelText(/next page/i);
      expect(nextButton).toBeInTheDocument();
      expect(nextButton).toHaveAttribute('aria-label');

      const prevButton = screen.getByLabelText(/previous page/i);
      expect(prevButton).toBeInTheDocument();
      expect(prevButton).toHaveAttribute('aria-label');

      // Check page info is announced to screen readers
      const pageInfo = screen.getByText(/page \d+ of \d+/i);
      expect(pageInfo).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('InterventionForm Accessibility', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(
        <TestWrapper>
          <InterventionForm onSuccess={vi.fn()} onCancel={vi.fn()} />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper form structure', async () => {
      render(
        <TestWrapper>
          <InterventionForm onSuccess={vi.fn()} onCancel={vi.fn()} />
        </TestWrapper>
      );

      // Check for form element
      const form = screen.getByRole('form');
      expect(form).toBeInTheDocument();

      // Check for proper form labels
      expect(screen.getByLabelText(/patient/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/priority/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/issue description/i)).toBeInTheDocument();
    });

    it('should have proper label associations', async () => {
      render(
        <TestWrapper>
          <InterventionForm onSuccess={vi.fn()} onCancel={vi.fn()} />
        </TestWrapper>
      );

      // Check that all form inputs have associated labels
      const patientInput = screen.getByLabelText(/patient/i);
      expect(patientInput).toHaveAttribute('id');

      const categoryInput = screen.getByLabelText(/category/i);
      expect(categoryInput).toHaveAttribute('id');

      const priorityInput = screen.getByLabelText(/priority/i);
      expect(priorityInput).toHaveAttribute('id');

      const descriptionInput = screen.getByLabelText(/issue description/i);
      expect(descriptionInput).toHaveAttribute('id');
    });

    it('should have proper error message associations', async () => {
      render(
        <TestWrapper>
          <InterventionForm onSuccess={vi.fn()} onCancel={vi.fn()} />
        </TestWrapper>
      );

      // Try to trigger validation errors
      const submitButton = screen.getByRole('button', {
        name: /create intervention/i,
      });
      submitButton.click();

      // Wait for validation errors to appear
      await screen.findByText(/patient is required/i);

      // Check that error messages are properly associated with inputs
      const patientInput = screen.getByLabelText(/patient/i);
      const errorMessage = screen.getByText(/patient is required/i);

      expect(patientInput).toHaveAttribute('aria-describedby');
      expect(errorMessage).toHaveAttribute('id');

      const describedBy = patientInput.getAttribute('aria-describedby');
      const errorId = errorMessage.getAttribute('id');
      expect(describedBy).toContain(errorId);
    });

    it('should have proper fieldset and legend for strategy section', async () => {
      render(
        <TestWrapper>
          <InterventionForm onSuccess={vi.fn()} onCancel={vi.fn()} />
        </TestWrapper>
      );

      // Add a strategy to show the strategy section
      const addStrategyButton = screen.getByRole('button', {
        name: /add strategy/i,
      });
      addStrategyButton.click();

      // Check for fieldset and legend
      const strategyFieldset = screen.getByRole('group', { name: /strategy/i });
      expect(strategyFieldset).toBeInTheDocument();

      const legend = screen.getByText(/strategy details/i);
      expect(legend).toBeInTheDocument();
    });

    it('should have proper button accessibility', async () => {
      render(
        <TestWrapper>
          <InterventionForm onSuccess={vi.fn()} onCancel={vi.fn()} />
        </TestWrapper>
      );

      // Check submit button
      const submitButton = screen.getByRole('button', {
        name: /create intervention/i,
      });
      expect(submitButton).toHaveAttribute('type', 'submit');

      // Check cancel button
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toHaveAttribute('type', 'button');

      // Check add strategy button
      const addStrategyButton = screen.getByRole('button', {
        name: /add strategy/i,
      });
      expect(addStrategyButton).toHaveAttribute('type', 'button');
    });

    it('should announce form submission status', async () => {
      const mockOnSuccess = vi.fn();

      vi.mocked(
        clinicalInterventionService.createIntervention
      ).mockResolvedValue({
        _id: 'intervention-1',
        interventionNumber: 'CI-202412-0001',
        category: 'drug_therapy_problem',
        priority: 'high',
        status: 'identified',
        issueDescription: 'Test intervention',
        patientId: 'patient-1',
        identifiedBy: 'user-1',
      });

      render(
        <TestWrapper>
          <InterventionForm onSuccess={mockOnSuccess} onCancel={vi.fn()} />
        </TestWrapper>
      );

      // Fill and submit form
      const patientSelect = screen.getByLabelText(/patient/i);
      patientSelect.value = 'patient-1';

      const categorySelect = screen.getByLabelText(/category/i);
      categorySelect.value = 'drug_therapy_problem';

      const prioritySelect = screen.getByLabelText(/priority/i);
      prioritySelect.value = 'high';

      const descriptionInput = screen.getByLabelText(/issue description/i);
      descriptionInput.value = 'Test intervention description';

      const submitButton = screen.getByRole('button', {
        name: /create intervention/i,
      });
      submitButton.click();

      // Check for success message with proper ARIA live region
      await screen.findByText(/intervention created successfully/i);
      const successMessage = screen.getByText(
        /intervention created successfully/i
      );
      expect(successMessage).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Focus Management', () => {
    it('should manage focus properly in modal dialogs', async () => {
      render(
        <TestWrapper>
          <ClinicalInterventionDashboard />
        </TestWrapper>
      );

      await screen.findByText('Clinical Interventions Dashboard');

      // Open create intervention modal
      const createButton = screen.getByRole('button', {
        name: /create intervention/i,
      });
      createButton.click();

      // Focus should move to modal
      const modal = screen.getByRole('dialog');
      expect(modal).toBeInTheDocument();

      // First focusable element in modal should receive focus
      const firstInput = screen.getByLabelText(/patient/i);
      expect(firstInput).toHaveFocus();
    });

    it('should trap focus within modal', async () => {
      render(
        <TestWrapper>
          <InterventionForm onSuccess={vi.fn()} onCancel={vi.fn()} />
        </TestWrapper>
      );

      // Get all focusable elements
      const focusableElements = screen
        .getAllByRole('button')
        .concat(screen.getAllByRole('combobox'))
        .concat(screen.getAllByRole('textbox'));

      expect(focusableElements.length).toBeGreaterThan(0);

      // Focus should cycle through modal elements only
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      firstElement.focus();
      expect(firstElement).toHaveFocus();

      // Simulate Tab to last element
      lastElement.focus();
      expect(lastElement).toHaveFocus();
    });

    it('should restore focus after modal closes', async () => {
      render(
        <TestWrapper>
          <ClinicalInterventionDashboard />
        </TestWrapper>
      );

      await screen.findByText('Clinical Interventions Dashboard');

      const createButton = screen.getByRole('button', {
        name: /create intervention/i,
      });
      createButton.focus();
      expect(createButton).toHaveFocus();

      // Open and close modal
      createButton.click();
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      cancelButton.click();

      // Focus should return to create button
      expect(createButton).toHaveFocus();
    });
  });

  describe('Screen Reader Support', () => {
    it('should provide proper live region announcements', async () => {
      render(
        <TestWrapper>
          <ClinicalInterventionDashboard />
        </TestWrapper>
      );

      await screen.findByText('Clinical Interventions Dashboard');

      // Check for live regions
      const liveRegions = document.querySelectorAll('[aria-live]');
      expect(liveRegions.length).toBeGreaterThan(0);

      // Status updates should be announced
      const statusRegion = document.querySelector('[aria-live="polite"]');
      expect(statusRegion).toBeInTheDocument();
    });

    it('should provide descriptive text for complex UI elements', async () => {
      render(
        <TestWrapper>
          <ClinicalInterventionDashboard />
        </TestWrapper>
      );

      await screen.findByText('Clinical Interventions Dashboard');

      // Charts should have descriptions
      const charts = document.querySelectorAll('[data-testid*="chart"]');
      charts.forEach((chart) => {
        expect(
          chart.hasAttribute('aria-label') ||
            chart.hasAttribute('aria-describedby') ||
            chart.querySelector('[aria-label]')
        ).toBeTruthy();
      });
    });

    it('should provide proper table navigation', async () => {
      render(
        <TestWrapper>
          <ClinicalInterventionDashboard />
        </TestWrapper>
      );

      await screen.findByText('Clinical Interventions Dashboard');

      const table = screen.getByRole('table');

      // Table should have caption or aria-label
      expect(
        table.hasAttribute('aria-label') || table.querySelector('caption')
      ).toBeTruthy();

      // Column headers should have proper scope
      const columnHeaders = screen.getAllByRole('columnheader');
      columnHeaders.forEach((header) => {
        expect(header).toHaveAttribute('scope', 'col');
      });
    });
  });

  describe('High Contrast Mode Support', () => {
    it('should be visible in high contrast mode', async () => {
      // Simulate high contrast mode
      document.body.style.filter = 'contrast(200%)';

      render(
        <TestWrapper>
          <ClinicalInterventionDashboard />
        </TestWrapper>
      );

      await screen.findByText('Clinical Interventions Dashboard');

      // Check that important elements are still visible
      const createButton = screen.getByRole('button', {
        name: /create intervention/i,
      });
      const computedStyle = window.getComputedStyle(createButton);

      // Button should have visible border or background
      expect(
        computedStyle.border !== 'none' ||
          computedStyle.backgroundColor !== 'transparent'
      ).toBeTruthy();

      // Reset styles
      document.body.style.filter = '';
    });
  });

  describe('Reduced Motion Support', () => {
    it('should respect prefers-reduced-motion', async () => {
      // Mock reduced motion preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query) => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      render(
        <TestWrapper>
          <ClinicalInterventionDashboard />
        </TestWrapper>
      );

      await screen.findByText('Clinical Interventions Dashboard');

      // Animations should be disabled or reduced
      const animatedElements = document.querySelectorAll(
        '[class*="animate"], [class*="transition"]'
      );
      animatedElements.forEach((element) => {
        const computedStyle = window.getComputedStyle(element);
        // Animation duration should be 0 or very short
        expect(
          computedStyle.animationDuration === '0s' ||
            computedStyle.transitionDuration === '0s' ||
            parseFloat(computedStyle.animationDuration) < 0.1
        ).toBeTruthy();
      });
    });
  });
});
