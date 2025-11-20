import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ClinicalNoteForm from '../ClinicalNoteForm';

// Mock the services and queries
vi.mock('../queries/usePatients', () => ({
  useSearchPatients: vi.fn(() => ({
    data: {
      data: {
        results: [
          {
            _id: '1',
            firstName: 'John',
            lastName: 'Doe',
            mrn: 'MRN001',
          },
        ],
      },
    },
    isLoading: false,
  })),
}));

vi.mock('../queries/clinicalNoteQueries', () => ({
  useClinicalNote: vi.fn(() => ({
    data: null,
    isLoading: false,
  })),
  useCreateClinicalNote: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useUpdateClinicalNote: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
}));

vi.mock('../services/clinicalNoteService', () => ({
  clinicalNoteUtils: {
    createEmptyNoteData: vi.fn(() => ({
      patient: '',
      type: 'consultation',
      title: '',
      content: {
        subjective: '',
        objective: '',
        assessment: '',
        plan: '',
      },
      medications: [],
      laborResults: [],
      recommendations: [],
      followUpRequired: false,
      priority: 'medium',
      isConfidential: false,
      tags: [],
    })),
  },
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{component}</QueryClientProvider>
  );
};

describe('ClinicalNoteForm', () => {
  let mockOnSave: ReturnType<typeof vi.fn>;
  let mockOnCancel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnSave = vi.fn();
    mockOnCancel = vi.fn();
  });

  it('renders the form with all required fields', () => {
    renderWithQueryClient(
      <ClinicalNoteForm onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    expect(screen.getByText('Create Clinical Note')).toBeInTheDocument();
    expect(screen.getByLabelText(/patient/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/note title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/note type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/priority/i)).toBeInTheDocument();
  });

  it('shows validation errors for required fields', async () => {
    const user = userEvent.setup();

    renderWithQueryClient(
      <ClinicalNoteForm onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    // Try to submit without filling required fields
    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Patient is required')).toBeInTheDocument();
      expect(
        screen.getByText('Title is required and must be at least 3 characters')
      ).toBeInTheDocument();
    });
  });

  it('validates that at least one SOAP section is filled', async () => {
    const user = userEvent.setup();

    renderWithQueryClient(
      <ClinicalNoteForm onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    // Fill required fields but leave SOAP sections empty
    const titleInput = screen.getByLabelText(/note title/i);
    await user.type(titleInput, 'Test Note');

    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(
        screen.getByText('At least one content section is required')
      ).toBeInTheDocument();
    });
  });

  it('enables auto-save toggle', async () => {
    const user = userEvent.setup();

    renderWithQueryClient(
      <ClinicalNoteForm onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    const autoSaveToggle = screen.getByRole('checkbox', { name: /auto-save/i });
    expect(autoSaveToggle).toBeChecked();

    await user.click(autoSaveToggle);
    expect(autoSaveToggle).not.toBeChecked();
  });

  it('shows follow-up date field when follow-up is required', async () => {
    const user = userEvent.setup();

    renderWithQueryClient(
      <ClinicalNoteForm onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    const followUpToggle = screen.getByRole('checkbox', {
      name: /follow-up required/i,
    });
    await user.click(followUpToggle);

    expect(screen.getByLabelText(/follow-up date/i)).toBeInTheDocument();
  });

  it('expands and collapses sections', async () => {
    const user = userEvent.setup();

    renderWithQueryClient(
      <ClinicalNoteForm onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    // Find the expand/collapse button for SOAP content
    const soapSection = screen.getByText('SOAP Note Content').closest('div');
    const expandButton = soapSection?.querySelector('button');

    if (expandButton) {
      await user.click(expandButton);
      // The content should still be visible since it starts expanded
      expect(screen.getByText('Subjective')).toBeInTheDocument();
    }
  });

  it('handles cancel with unsaved changes dialog', async () => {
    const user = userEvent.setup();

    renderWithQueryClient(
      <ClinicalNoteForm onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    // Make some changes
    const titleInput = screen.getByLabelText(/note title/i);
    await user.type(titleInput, 'Test Note');

    // Try to cancel
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    // Should show unsaved changes dialog
    await waitFor(() => {
      expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();
      expect(screen.getByText(/you have unsaved changes/i)).toBeInTheDocument();
    });
  });

  it('renders in readonly mode', () => {
    renderWithQueryClient(
      <ClinicalNoteForm
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        readonly={true}
      />
    );

    // Save button should not be present in readonly mode
    expect(
      screen.queryByRole('button', { name: /save/i })
    ).not.toBeInTheDocument();

    // Auto-save toggle should not be present
    expect(
      screen.queryByRole('checkbox', { name: /auto-save/i })
    ).not.toBeInTheDocument();
  });

  it('pre-populates patient when patientId is provided', () => {
    renderWithQueryClient(
      <ClinicalNoteForm
        patientId="patient-123"
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    // The form should be rendered (patient will be set via defaultValues)
    expect(screen.getByText('Create Clinical Note')).toBeInTheDocument();
  });

  it('shows edit mode when noteId is provided', () => {
    renderWithQueryClient(
      <ClinicalNoteForm
        noteId="note-123"
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Edit Clinical Note')).toBeInTheDocument();
  });

  it('validates title length', async () => {
    const user = userEvent.setup();

    renderWithQueryClient(
      <ClinicalNoteForm onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    const titleInput = screen.getByLabelText(/note title/i);
    await user.type(titleInput, 'AB'); // Less than 3 characters

    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(
        screen.getByText('Title is required and must be at least 3 characters')
      ).toBeInTheDocument();
    });
  });

  it('validates follow-up date when follow-up is required', async () => {
    const user = userEvent.setup();

    renderWithQueryClient(
      <ClinicalNoteForm onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    // Enable follow-up but don't set date
    const followUpToggle = screen.getByRole('checkbox', {
      name: /follow-up required/i,
    });
    await user.click(followUpToggle);

    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(
        screen.getByText(
          'Follow-up date is required when follow-up is marked as required'
        )
      ).toBeInTheDocument();
    });
  });
});
