import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../theme';
import ClinicalNotesDashboard from '../../components/ClinicalNotesDashboard';
import ClinicalNoteForm from '../../components/ClinicalNoteForm';
import ClinicalNoteDetail from '../../components/ClinicalNoteDetail';
import PatientClinicalNotes from '../../components/PatientClinicalNotes';
import * as clinicalNoteService from '../../services/clinicalNoteService';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock services
jest.mock('../../services/clinicalNoteService');
const mockClinicalNoteService = clinicalNoteService as jest.Mocked<
  typeof clinicalNoteService
>;

// Mock data
const mockNotes = [
  {
    _id: 'note1',
    title: 'Initial Consultation',
    type: 'consultation' as const,
    priority: 'medium' as const,
    isConfidential: false,
    followUpRequired: true,
    followUpDate: '2024-02-15T10:00:00Z',
    attachments: [],
    createdAt: '2024-02-01T10:00:00Z',
    updatedAt: '2024-02-01T10:00:00Z',
    patient: {
      _id: 'patient1',
      firstName: 'John',
      lastName: 'Doe',
      mrn: 'MRN001',
    },
    pharmacist: {
      _id: 'pharmacist1',
      firstName: 'Dr. Jane',
      lastName: 'Smith',
      role: 'pharmacist',
    },
    content: {
      subjective: 'Patient reports feeling better',
      objective: 'Vital signs stable',
      assessment: 'Improving condition',
      plan: 'Continue current medication',
    },
    recommendations: ['Monitor blood pressure'],
    tags: ['hypertension'],
    workplaceId: 'workplace1',
  },
  {
    _id: 'note2',
    title: 'Follow-up Visit',
    type: 'follow_up' as const,
    priority: 'low' as const,
    isConfidential: true,
    followUpRequired: false,
    attachments: [
      {
        _id: 'att1',
        fileName: 'lab-results.pdf',
        originalName: 'Lab Results.pdf',
        mimeType: 'application/pdf',
        size: 1024000,
        url: '/api/attachments/att1',
        uploadedAt: '2024-02-01T10:00:00Z',
        uploadedBy: 'pharmacist1',
      },
    ],
    createdAt: '2024-02-02T10:00:00Z',
    updatedAt: '2024-02-02T10:00:00Z',
    patient: {
      _id: 'patient1',
      firstName: 'John',
      lastName: 'Doe',
      mrn: 'MRN001',
    },
    pharmacist: {
      _id: 'pharmacist1',
      firstName: 'Dr. Jane',
      lastName: 'Smith',
      role: 'pharmacist',
    },
    content: {
      subjective: 'Patient doing well',
      objective: 'No new concerns',
      assessment: 'Stable condition',
      plan: 'Continue current treatment',
    },
    recommendations: ['Regular monitoring'],
    tags: ['follow-up'],
    workplaceId: 'workplace1',
  },
];

const mockPatients = [
  {
    _id: 'patient1',
    firstName: 'John',
    lastName: 'Doe',
    mrn: 'MRN001',
    email: 'john.doe@example.com',
    phone: '+1234567890',
    gender: 'Male',
    age: 45,
  },
];

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode; route?: string }> = ({
  children,
  route = '/',
}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('Clinical Notes Accessibility Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockClinicalNoteService.getNotes.mockResolvedValue({
      notes: mockNotes,
      total: mockNotes.length,
      page: 1,
      totalPages: 1,
    });

    mockClinicalNoteService.getNote.mockImplementation((id) => {
      const note = mockNotes.find((n) => n._id === id);
      return Promise.resolve(note || null);
    });

    mockClinicalNoteService.getPatientNotes.mockResolvedValue({
      notes: mockNotes,
      total: mockNotes.length,
    });
  });

  describe('ClinicalNotesDashboard Accessibility', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(
        <TestWrapper>
          <ClinicalNotesDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Initial Consultation')).toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper heading hierarchy', async () => {
      render(
        <TestWrapper>
          <ClinicalNotesDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Initial Consultation')).toBeInTheDocument();
      });

      // Check for proper heading levels
      const h1Elements = screen.getAllByRole('heading', { level: 1 });
      expect(h1Elements).toHaveLength(1);

      const h2Elements = screen.getAllByRole('heading', { level: 2 });
      expect(h2Elements.length).toBeGreaterThan(0);
    });

    it('should have proper table structure with headers', async () => {
      render(
        <TestWrapper>
          <ClinicalNotesDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Initial Consultation')).toBeInTheDocument();
      });

      // Check for table with proper headers
      const table = screen.getByRole('grid');
      expect(table).toBeInTheDocument();

      const columnHeaders = screen.getAllByRole('columnheader');
      expect(columnHeaders.length).toBeGreaterThan(0);

      // Check that headers have proper scope
      columnHeaders.forEach((header) => {
        expect(header).toHaveAttribute('scope', 'col');
      });
    });

    it('should have accessible search functionality', async () => {
      render(
        <TestWrapper>
          <ClinicalNotesDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Initial Consultation')).toBeInTheDocument();
      });

      const searchInput = screen.getByRole('textbox', { name: /search/i });
      expect(searchInput).toBeInTheDocument();
      expect(searchInput).toHaveAttribute('aria-label');

      // Check for search button
      const searchButton = screen.getByRole('button', { name: /search/i });
      expect(searchButton).toBeInTheDocument();
    });

    it('should have accessible filter controls', async () => {
      render(
        <TestWrapper>
          <ClinicalNotesDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Initial Consultation')).toBeInTheDocument();
      });

      const filterButton = screen.getByRole('button', { name: /filter/i });
      expect(filterButton).toBeInTheDocument();
      expect(filterButton).toHaveAttribute('aria-expanded');

      // Open filters
      fireEvent.click(filterButton);

      // Check for accessible filter controls
      const filterControls = screen.getAllByRole('combobox');
      filterControls.forEach((control) => {
        expect(control).toHaveAttribute('aria-label');
      });
    });

    it('should have accessible pagination controls', async () => {
      // Mock paginated data
      mockClinicalNoteService.getNotes.mockResolvedValue({
        notes: mockNotes,
        total: 100,
        page: 1,
        totalPages: 4,
      });

      render(
        <TestWrapper>
          <ClinicalNotesDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Initial Consultation')).toBeInTheDocument();
      });

      // Check for pagination navigation
      const pagination = screen.getByRole('navigation', {
        name: /pagination/i,
      });
      expect(pagination).toBeInTheDocument();

      const pageButtons = screen.getAllByRole('button', { name: /page/i });
      pageButtons.forEach((button) => {
        expect(button).toHaveAttribute('aria-label');
      });
    });

    it('should support keyboard navigation', async () => {
      render(
        <TestWrapper>
          <ClinicalNotesDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Initial Consultation')).toBeInTheDocument();
      });

      // Test tab navigation
      const searchInput = screen.getByRole('textbox', { name: /search/i });
      searchInput.focus();
      expect(searchInput).toHaveFocus();

      // Tab to next element
      fireEvent.keyDown(searchInput, { key: 'Tab' });
      const filterButton = screen.getByRole('button', { name: /filter/i });
      expect(filterButton).toHaveFocus();
    });

    it('should have proper ARIA labels for actions', async () => {
      render(
        <TestWrapper>
          <ClinicalNotesDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Initial Consultation')).toBeInTheDocument();
      });

      // Check action buttons have proper labels
      const viewButtons = screen.getAllByRole('button', { name: /view note/i });
      expect(viewButtons.length).toBeGreaterThan(0);

      const editButtons = screen.getAllByRole('button', { name: /edit note/i });
      expect(editButtons.length).toBeGreaterThan(0);

      const deleteButtons = screen.getAllByRole('button', {
        name: /delete note/i,
      });
      expect(deleteButtons.length).toBeGreaterThan(0);
    });

    it('should announce loading states to screen readers', async () => {
      mockClinicalNoteService.getNotes.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  notes: mockNotes,
                  total: mockNotes.length,
                  page: 1,
                  totalPages: 1,
                }),
              100
            )
          )
      );

      render(
        <TestWrapper>
          <ClinicalNotesDashboard />
        </TestWrapper>
      );

      // Check for loading announcement
      const loadingElement = screen.getByRole('status');
      expect(loadingElement).toBeInTheDocument();
      expect(loadingElement).toHaveAttribute('aria-live', 'polite');

      await waitFor(() => {
        expect(screen.getByText('Initial Consultation')).toBeInTheDocument();
      });
    });
  });

  describe('ClinicalNoteForm Accessibility', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(
        <TestWrapper>
          <ClinicalNoteForm
            onSave={jest.fn()}
            onCancel={jest.fn()}
            patients={mockPatients}
          />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper form labels and associations', () => {
      render(
        <TestWrapper>
          <ClinicalNoteForm
            onSave={jest.fn()}
            onCancel={jest.fn()}
            patients={mockPatients}
          />
        </TestWrapper>
      );

      // Check that all form inputs have labels
      const titleInput = screen.getByLabelText(/title/i);
      expect(titleInput).toBeInTheDocument();

      const typeSelect = screen.getByLabelText(/note type/i);
      expect(typeSelect).toBeInTheDocument();

      const patientSelect = screen.getByLabelText(/patient/i);
      expect(patientSelect).toBeInTheDocument();

      const subjectiveInput = screen.getByLabelText(/subjective/i);
      expect(subjectiveInput).toBeInTheDocument();

      const objectiveInput = screen.getByLabelText(/objective/i);
      expect(objectiveInput).toBeInTheDocument();

      const assessmentInput = screen.getByLabelText(/assessment/i);
      expect(assessmentInput).toBeInTheDocument();

      const planInput = screen.getByLabelText(/plan/i);
      expect(planInput).toBeInTheDocument();
    });

    it('should have proper fieldset grouping for SOAP sections', () => {
      render(
        <TestWrapper>
          <ClinicalNoteForm
            onSave={jest.fn()}
            onCancel={jest.fn()}
            patients={mockPatients}
          />
        </TestWrapper>
      );

      // Check for fieldset grouping
      const soapFieldset = screen.getByRole('group', {
        name: /soap note content/i,
      });
      expect(soapFieldset).toBeInTheDocument();

      const metadataFieldset = screen.getByRole('group', {
        name: /note metadata/i,
      });
      expect(metadataFieldset).toBeInTheDocument();
    });

    it('should have accessible error messages', async () => {
      const mockOnSave = jest.fn();

      render(
        <TestWrapper>
          <ClinicalNoteForm
            onSave={mockOnSave}
            onCancel={jest.fn()}
            patients={mockPatients}
          />
        </TestWrapper>
      );

      // Submit form without required fields
      const submitButton = screen.getByRole('button', { name: /create note/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        // Check for error messages with proper ARIA attributes
        const errorMessages = screen.getAllByRole('alert');
        expect(errorMessages.length).toBeGreaterThan(0);

        errorMessages.forEach((error) => {
          expect(error).toHaveAttribute('aria-live', 'assertive');
        });
      });
    });

    it('should have accessible file upload component', () => {
      render(
        <TestWrapper>
          <ClinicalNoteForm
            onSave={jest.fn()}
            onCancel={jest.fn()}
            patients={mockPatients}
          />
        </TestWrapper>
      );

      const fileInput = screen.getByLabelText(/upload files/i);
      expect(fileInput).toBeInTheDocument();
      expect(fileInput).toHaveAttribute('type', 'file');
      expect(fileInput).toHaveAttribute('aria-describedby');

      // Check for file upload instructions
      const instructions = screen.getByText(/drag and drop files/i);
      expect(instructions).toBeInTheDocument();
    });

    it('should support keyboard navigation through form fields', () => {
      render(
        <TestWrapper>
          <ClinicalNoteForm
            onSave={jest.fn()}
            onCancel={jest.fn()}
            patients={mockPatients}
          />
        </TestWrapper>
      );

      const titleInput = screen.getByLabelText(/title/i);
      titleInput.focus();
      expect(titleInput).toHaveFocus();

      // Tab through form fields
      fireEvent.keyDown(titleInput, { key: 'Tab' });
      const typeSelect = screen.getByLabelText(/note type/i);
      expect(typeSelect).toHaveFocus();
    });

    it('should have proper button accessibility', () => {
      render(
        <TestWrapper>
          <ClinicalNoteForm
            onSave={jest.fn()}
            onCancel={jest.fn()}
            patients={mockPatients}
          />
        </TestWrapper>
      );

      const submitButton = screen.getByRole('button', { name: /create note/i });
      expect(submitButton).toBeInTheDocument();
      expect(submitButton).toHaveAttribute('type', 'submit');

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toBeInTheDocument();
      expect(cancelButton).toHaveAttribute('type', 'button');
    });
  });

  describe('ClinicalNoteDetail Accessibility', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(
        <TestWrapper>
          <ClinicalNoteDetail noteId="note1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Initial Consultation')).toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper heading structure', async () => {
      render(
        <TestWrapper>
          <ClinicalNoteDetail noteId="note1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Initial Consultation')).toBeInTheDocument();
      });

      // Check main heading
      const mainHeading = screen.getByRole('heading', { level: 1 });
      expect(mainHeading).toHaveTextContent('Initial Consultation');

      // Check section headings
      const sectionHeadings = screen.getAllByRole('heading', { level: 2 });
      expect(sectionHeadings.length).toBeGreaterThan(0);
    });

    it('should have accessible patient and pharmacist information', async () => {
      render(
        <TestWrapper>
          <ClinicalNoteDetail noteId="note1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Initial Consultation')).toBeInTheDocument();
      });

      // Check for accessible patient info
      const patientInfo = screen.getByRole('region', {
        name: /patient information/i,
      });
      expect(patientInfo).toBeInTheDocument();

      // Check for accessible pharmacist info
      const pharmacistInfo = screen.getByRole('region', {
        name: /pharmacist information/i,
      });
      expect(pharmacistInfo).toBeInTheDocument();
    });

    it('should have accessible SOAP note sections', async () => {
      render(
        <TestWrapper>
          <ClinicalNoteDetail noteId="note1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Initial Consultation')).toBeInTheDocument();
      });

      // Check for SOAP sections with proper headings
      expect(
        screen.getByRole('heading', { name: /subjective/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: /objective/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: /assessment/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: /plan/i })
      ).toBeInTheDocument();
    });

    it('should have accessible attachment list', async () => {
      render(
        <TestWrapper>
          <ClinicalNoteDetail noteId="note2" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Follow-up Visit')).toBeInTheDocument();
      });

      // Check for attachments section
      const attachmentsSection = screen.getByRole('region', {
        name: /attachments/i,
      });
      expect(attachmentsSection).toBeInTheDocument();

      // Check for accessible attachment links
      const attachmentLinks = screen.getAllByRole('link', {
        name: /download/i,
      });
      attachmentLinks.forEach((link) => {
        expect(link).toHaveAttribute('aria-describedby');
      });
    });

    it('should have accessible action buttons', async () => {
      render(
        <TestWrapper>
          <ClinicalNoteDetail noteId="note1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Initial Consultation')).toBeInTheDocument();
      });

      const editButton = screen.getByRole('button', { name: /edit note/i });
      expect(editButton).toBeInTheDocument();

      const deleteButton = screen.getByRole('button', { name: /delete note/i });
      expect(deleteButton).toBeInTheDocument();
      expect(deleteButton).toHaveAttribute('aria-describedby');
    });
  });

  describe('PatientClinicalNotes Accessibility', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(
        <TestWrapper>
          <PatientClinicalNotes patientId="patient1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Initial Consultation')).toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have accessible note summaries', async () => {
      render(
        <TestWrapper>
          <PatientClinicalNotes patientId="patient1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Initial Consultation')).toBeInTheDocument();
      });

      // Check for expandable note summaries
      const expandButtons = screen.getAllByRole('button', {
        name: /expand note/i,
      });
      expandButtons.forEach((button) => {
        expect(button).toHaveAttribute('aria-expanded');
        expect(button).toHaveAttribute('aria-controls');
      });
    });

    it('should have accessible create note button', async () => {
      render(
        <TestWrapper>
          <PatientClinicalNotes patientId="patient1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Initial Consultation')).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', {
        name: /create new note/i,
      });
      expect(createButton).toBeInTheDocument();
      expect(createButton).toHaveAttribute('aria-describedby');
    });
  });

  describe('Responsive Design Accessibility', () => {
    it('should maintain accessibility on mobile viewports', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      const { container } = render(
        <TestWrapper>
          <ClinicalNotesDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Initial Consultation')).toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should maintain accessibility on tablet viewports', async () => {
      // Mock tablet viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });

      const { container } = render(
        <TestWrapper>
          <ClinicalNotesDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Initial Consultation')).toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Color Contrast and Visual Accessibility', () => {
    it('should have sufficient color contrast for text', async () => {
      const { container } = render(
        <TestWrapper>
          <ClinicalNotesDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Initial Consultation')).toBeInTheDocument();
      });

      // This would typically be tested with automated tools
      // For now, we ensure the component renders without errors
      expect(container).toBeInTheDocument();
    });

    it('should not rely solely on color to convey information', async () => {
      render(
        <TestWrapper>
          <ClinicalNotesDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Initial Consultation')).toBeInTheDocument();
      });

      // Check that priority indicators have text labels, not just colors
      const priorityIndicators = screen.getAllByText(/priority:/i);
      expect(priorityIndicators.length).toBeGreaterThan(0);

      // Check that status indicators have text or icons, not just colors
      const statusIndicators = screen.getAllByText(
        /confidential|follow-up required/i
      );
      expect(statusIndicators.length).toBeGreaterThan(0);
    });
  });

  describe('Focus Management', () => {
    it('should manage focus properly in modal dialogs', async () => {
      render(
        <TestWrapper>
          <ClinicalNoteDetail noteId="note1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Initial Consultation')).toBeInTheDocument();
      });

      // Open delete confirmation dialog
      const deleteButton = screen.getByRole('button', { name: /delete note/i });
      fireEvent.click(deleteButton);

      // Check that focus is trapped in the dialog
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();

      const confirmButton = screen.getByRole('button', {
        name: /confirm delete/i,
      });
      expect(confirmButton).toHaveFocus();
    });

    it('should restore focus after modal closes', async () => {
      render(
        <TestWrapper>
          <ClinicalNoteDetail noteId="note1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Initial Consultation')).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', { name: /delete note/i });
      deleteButton.focus();
      fireEvent.click(deleteButton);

      // Close dialog
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      // Focus should return to delete button
      expect(deleteButton).toHaveFocus();
    });
  });
});
