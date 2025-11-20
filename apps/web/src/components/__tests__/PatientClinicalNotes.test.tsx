import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { vi } from 'vitest';
import { theme } from '../../theme';
import PatientClinicalNotes from '../PatientClinicalNotes';
import { usePatientNotes } from '../../queries/clinicalNoteQueries';
import { useEnhancedClinicalNoteStore } from '../../stores/enhancedClinicalNoteStore';

// Mock the queries and stores
vi.mock('../../queries/clinicalNoteQueries');
vi.mock('../../stores/enhancedClinicalNoteStore');

const mockUsePatientNotes = usePatientNotes as any;
const mockUseEnhancedClinicalNoteStore = useEnhancedClinicalNoteStore as any;

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
    recommendations: ['Monitor blood pressure', 'Follow up in 2 weeks'],
    tags: ['hypertension', 'follow-up'],
    workplaceId: 'workplace1',
  },
  {
    _id: 'note2',
    title: 'Medication Review',
    type: 'medication_review' as const,
    priority: 'high' as const,
    isConfidential: true,
    followUpRequired: false,
    attachments: [{ _id: 'att1', fileName: 'lab-results.pdf' }],
    createdAt: '2024-02-02T14:30:00Z',
    updatedAt: '2024-02-02T14:30:00Z',
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
      subjective: 'Patient experiencing side effects',
      objective: 'Lab results show elevated levels',
      assessment: 'Medication adjustment needed',
      plan: 'Reduce dosage and monitor',
    },
    recommendations: ['Reduce medication dosage'],
    tags: ['medication-review'],
    workplaceId: 'workplace1',
  },
];

const mockPatientNotesResponse = {
  notes: mockNotes,
  total: 2,
  currentPage: 1,
  totalPages: 1,
  hasNextPage: false,
  hasPrevPage: false,
};

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('PatientClinicalNotes', () => {
  const mockSetCreateModalOpen = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseEnhancedClinicalNoteStore.mockReturnValue({
      setCreateModalOpen: mockSetCreateModalOpen,
    } as any);

    mockUsePatientNotes.mockReturnValue({
      data: mockPatientNotesResponse,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);
  });

  it('renders clinical notes widget with patient notes', () => {
    render(
      <TestWrapper>
        <PatientClinicalNotes patientId="patient1" />
      </TestWrapper>
    );

    expect(screen.getByText('Clinical Notes')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // Total count chip
    expect(screen.getByText('Initial Consultation')).toBeInTheDocument();
    expect(screen.getByText('Medication Review')).toBeInTheDocument();
  });

  it('displays note details correctly', () => {
    render(
      <TestWrapper>
        <PatientClinicalNotes patientId="patient1" />
      </TestWrapper>
    );

    // Check note types and priorities
    expect(screen.getByText('Consultation')).toBeInTheDocument();
    expect(screen.getByText('Medication Review')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();

    // Check confidential indicator
    expect(screen.getByText('Confidential')).toBeInTheDocument();

    // Check follow-up indicator
    expect(screen.getByTestId('ScheduleIcon')).toBeInTheDocument();

    // Check attachment indicator
    expect(screen.getByTestId('AttachFileIcon')).toBeInTheDocument();
  });

  it('expands and collapses note content', async () => {
    render(
      <TestWrapper>
        <PatientClinicalNotes patientId="patient1" />
      </TestWrapper>
    );

    // Initially, detailed content should not be visible
    expect(
      screen.queryByText('Patient reports feeling better')
    ).not.toBeInTheDocument();

    // Click to expand first note
    const expandButtons = screen.getAllByTestId('ExpandMoreIcon');
    fireEvent.click(expandButtons[0]);

    // Now detailed content should be visible
    await waitFor(() => {
      expect(
        screen.getByText('Patient reports feeling better')
      ).toBeInTheDocument();
      expect(screen.getByText('Vital signs stable')).toBeInTheDocument();
      expect(screen.getByText('Improving condition')).toBeInTheDocument();
      expect(
        screen.getByText('Continue current medication')
      ).toBeInTheDocument();
    });

    // Check recommendations
    expect(screen.getByText('Monitor blood pressure')).toBeInTheDocument();
    expect(screen.getByText('Follow up in 2 weeks')).toBeInTheDocument();

    // Check tags
    expect(screen.getByText('hypertension')).toBeInTheDocument();
    expect(screen.getByText('follow-up')).toBeInTheDocument();
  });

  it('handles create note button click', () => {
    const mockOnCreateNote = vi.fn();

    render(
      <TestWrapper>
        <PatientClinicalNotes
          patientId="patient1"
          onCreateNote={mockOnCreateNote}
        />
      </TestWrapper>
    );

    const createButton = screen.getByText('New Note');
    fireEvent.click(createButton);

    expect(mockOnCreateNote).toHaveBeenCalledTimes(1);
  });

  it('handles view note button click', () => {
    const mockOnViewNote = vi.fn();

    render(
      <TestWrapper>
        <PatientClinicalNotes
          patientId="patient1"
          onViewNote={mockOnViewNote}
        />
      </TestWrapper>
    );

    const viewButtons = screen.getAllByTestId('VisibilityIcon');
    fireEvent.click(viewButtons[0]);

    expect(mockOnViewNote).toHaveBeenCalledWith('note1');
  });

  it('handles edit note button click', () => {
    const mockOnEditNote = vi.fn();

    render(
      <TestWrapper>
        <PatientClinicalNotes
          patientId="patient1"
          onEditNote={mockOnEditNote}
        />
      </TestWrapper>
    );

    const editButtons = screen.getAllByTestId('EditIcon');
    fireEvent.click(editButtons[0]);

    expect(mockOnEditNote).toHaveBeenCalledWith('note1');
  });

  it('shows loading state', () => {
    mockUsePatientNotes.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(
      <TestWrapper>
        <PatientClinicalNotes patientId="patient1" />
      </TestWrapper>
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows error state', () => {
    const mockError = new Error('Failed to load notes');
    mockUsePatientNotes.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: mockError,
      refetch: vi.fn(),
    } as any);

    render(
      <TestWrapper>
        <PatientClinicalNotes patientId="patient1" />
      </TestWrapper>
    );

    expect(
      screen.getByText('Failed to load clinical notes: Failed to load notes')
    ).toBeInTheDocument();
  });

  it('shows empty state when no notes exist', () => {
    mockUsePatientNotes.mockReturnValue({
      data: { notes: [], total: 0 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(
      <TestWrapper>
        <PatientClinicalNotes patientId="patient1" />
      </TestWrapper>
    );

    expect(
      screen.getByText('No clinical notes found for this patient')
    ).toBeInTheDocument();
    expect(screen.getByText('Create First Note')).toBeInTheDocument();
  });

  it('shows expand/collapse functionality for multiple notes', async () => {
    render(
      <TestWrapper>
        <PatientClinicalNotes patientId="patient1" maxNotes={10} />
      </TestWrapper>
    );

    // Should show "Show All 2 Notes" button when total > maxNotes (but in this case total = 2)
    // Let's test with more notes
    const manyNotes = Array.from({ length: 15 }, (_, i) => ({
      ...mockNotes[0],
      _id: `note${i + 1}`,
      title: `Note ${i + 1}`,
    }));

    mockUsePatientNotes.mockReturnValue({
      data: { notes: manyNotes.slice(0, 5), total: 15 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(
      <TestWrapper>
        <PatientClinicalNotes patientId="patient1" maxNotes={5} />
      </TestWrapper>
    );

    expect(screen.getByText('Show All 15 Notes')).toBeInTheDocument();
  });

  it('navigates to notes dashboard when clicking view all', () => {
    // Mock window.open
    const mockOpen = vi.fn();
    Object.defineProperty(window, 'open', {
      value: mockOpen,
      writable: true,
    });

    render(
      <TestWrapper>
        <PatientClinicalNotes patientId="patient1" />
      </TestWrapper>
    );

    const viewAllButton = screen.getByText('View All Notes in Dashboard');
    fireEvent.click(viewAllButton);

    expect(mockOpen).toHaveBeenCalledWith(
      '/notes?patientId=patient1',
      '_blank'
    );
  });

  it('respects maxNotes prop', () => {
    render(
      <TestWrapper>
        <PatientClinicalNotes patientId="patient1" maxNotes={1} />
      </TestWrapper>
    );

    // Should only show 1 note even though we have 2
    expect(screen.getByText('Initial Consultation')).toBeInTheDocument();
    // The second note should not be visible initially
    expect(screen.queryByText('Medication Review')).not.toBeInTheDocument();
  });

  it('hides create button when showCreateButton is false', () => {
    render(
      <TestWrapper>
        <PatientClinicalNotes patientId="patient1" showCreateButton={false} />
      </TestWrapper>
    );

    expect(screen.queryByText('New Note')).not.toBeInTheDocument();
  });

  it('uses default navigation when no callbacks provided', () => {
    // Mock window.location.href
    delete (window as any).location;
    (window as any).location = { href: '' };

    render(
      <TestWrapper>
        <PatientClinicalNotes patientId="patient1" />
      </TestWrapper>
    );

    // Click create note without callback
    const createButton = screen.getByText('New Note');
    fireEvent.click(createButton);

    expect(window.location.href).toBe('/notes/new?patientId=patient1');
  });
});
