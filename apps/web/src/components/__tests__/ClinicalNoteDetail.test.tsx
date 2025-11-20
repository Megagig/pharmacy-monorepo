import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ClinicalNoteDetail from '../ClinicalNoteDetail';
import { theme } from '../../theme';
import { ClinicalNote } from '../../types/clinicalNote';

// Mock the hooks and services
const mockUseClinicalNote = vi.fn();
const mockUseEnhancedClinicalNoteStore = vi.fn();
const mockUseAuth = vi.fn();

vi.mock('../queries/clinicalNoteQueries', () => ({
  useClinicalNote: mockUseClinicalNote,
}));

vi.mock('../stores/enhancedClinicalNoteStore', () => ({
  useEnhancedClinicalNoteStore: mockUseEnhancedClinicalNoteStore,
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: mockUseAuth,
}));

// Mock data
const mockNote: ClinicalNote = {
  _id: 'note-123',
  patient: {
    _id: 'patient-123',
    firstName: 'John',
    lastName: 'Doe',
    mrn: 'MRN123456',
  },
  pharmacist: {
    _id: 'pharmacist-123',
    firstName: 'Dr. Jane',
    lastName: 'Smith',
    role: 'Clinical Pharmacist',
  },
  workplaceId: 'workplace-123',
  type: 'consultation',
  title: 'Initial Consultation',
  content: {
    subjective: 'Patient reports feeling tired and dizzy.',
    objective: 'BP: 140/90, HR: 85, Temp: 98.6°F',
    assessment: 'Possible hypertension, requires monitoring.',
    plan: 'Start ACE inhibitor, follow up in 2 weeks.',
  },
  medications: [],
  laborResults: [],
  recommendations: ['Monitor blood pressure daily', 'Reduce sodium intake'],
  followUpRequired: true,
  followUpDate: '2024-02-15T10:00:00Z',
  attachments: [],
  priority: 'medium',
  isConfidential: false,
  tags: ['hypertension', 'initial-visit'],
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-15T10:00:00Z',
  createdBy: 'pharmacist-123',
  lastModifiedBy: 'pharmacist-123',
};

const mockUser = {
  id: 'pharmacist-123',
  role: 'pharmacist',
  firstName: 'Dr. Jane',
  lastName: 'Smith',
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
      <MemoryRouter initialEntries={['/notes/note-123']}>
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('ClinicalNoteDetail', () => {
  const mockDeleteNote = vi.fn();
  const mockDownloadAttachment = vi.fn();
  const mockDeleteAttachment = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock useClinicalNote
    mockUseClinicalNote.mockReturnValue({
      data: { note: mockNote },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    // Mock useEnhancedClinicalNoteStore
    mockUseEnhancedClinicalNoteStore.mockReturnValue({
      deleteNote: mockDeleteNote,
      downloadAttachment: mockDownloadAttachment,
      deleteAttachment: mockDeleteAttachment,
      loading: {
        deleteNote: false,
        uploadAttachment: false,
      },
      errors: {
        deleteNote: null,
        uploadAttachment: null,
      },
    });

    // Mock useAuth
    mockUseAuth.mockReturnValue({
      user: mockUser,
    });
  });

  it('renders clinical note detail with prop noteId', async () => {
    render(
      <TestWrapper>
        <ClinicalNoteDetail noteId="note-123" />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Initial Consultation')).toBeInTheDocument();
    });

    // Check patient information
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('MRN123456')).toBeInTheDocument();

    // Check pharmacist information
    expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Clinical Pharmacist')).toBeInTheDocument();
  });

  it('displays SOAP content correctly', async () => {
    render(
      <TestWrapper>
        <ClinicalNoteDetail noteId="note-123" />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Initial Consultation')).toBeInTheDocument();
    });

    // Check SOAP content
    expect(
      screen.getByText('Patient reports feeling tired and dizzy.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('BP: 140/90, HR: 85, Temp: 98.6°F')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Possible hypertension, requires monitoring.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Start ACE inhibitor, follow up in 2 weeks.')
    ).toBeInTheDocument();
  });

  it('displays note metadata correctly', async () => {
    render(
      <TestWrapper>
        <ClinicalNoteDetail noteId="note-123" />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Initial Consultation')).toBeInTheDocument();
    });

    // Check type and priority chips
    expect(screen.getByText('Consultation')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();

    // Check follow-up indicator
    expect(screen.getByText('Follow-up Required')).toBeInTheDocument();

    // Check tags
    expect(screen.getByText('hypertension')).toBeInTheDocument();
    expect(screen.getByText('initial-visit')).toBeInTheDocument();
  });

  it('displays recommendations correctly', async () => {
    render(
      <TestWrapper>
        <ClinicalNoteDetail noteId="note-123" />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Initial Consultation')).toBeInTheDocument();
    });

    // Check recommendations
    expect(
      screen.getByText('Monitor blood pressure daily')
    ).toBeInTheDocument();
    expect(screen.getByText('Reduce sodium intake')).toBeInTheDocument();
  });

  it('shows edit and delete buttons for note owner', async () => {
    render(
      <TestWrapper>
        <ClinicalNoteDetail noteId="note-123" />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Initial Consultation')).toBeInTheDocument();
    });

    // Check action buttons
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('handles loading state correctly', () => {
    mockUseClinicalNote.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <TestWrapper>
        <ClinicalNoteDetail noteId="note-123" />
      </TestWrapper>
    );

    // Should show loading spinner
    expect(
      document.querySelector('.MuiCircularProgress-root')
    ).toBeInTheDocument();
  });

  it('handles error state correctly', () => {
    mockUseClinicalNote.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Failed to load note'),
      refetch: vi.fn(),
    });

    render(
      <TestWrapper>
        <ClinicalNoteDetail noteId="note-123" />
      </TestWrapper>
    );

    expect(
      screen.getByText('Failed to load clinical note')
    ).toBeInTheDocument();
    expect(screen.getByText('Please try again later')).toBeInTheDocument();
  });

  it('handles readonly mode correctly', async () => {
    render(
      <TestWrapper>
        <ClinicalNoteDetail noteId="note-123" readonly={true} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Initial Consultation')).toBeInTheDocument();
    });

    // Should not show edit and delete buttons in readonly mode
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('handles embedded mode correctly', async () => {
    render(
      <TestWrapper>
        <ClinicalNoteDetail noteId="note-123" embedded={true} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Initial Consultation')).toBeInTheDocument();
    });

    // Should not show breadcrumbs and back button in embedded mode
    expect(screen.queryByText('Clinical Notes')).not.toBeInTheDocument();
    expect(screen.queryByText('Back')).not.toBeInTheDocument();
  });
});
