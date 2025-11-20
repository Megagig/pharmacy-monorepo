import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import SimpleClinicalNoteForm from '../SimpleClinicalNoteForm';

describe('SimpleClinicalNoteForm', () => {
  let mockOnSave: ReturnType<typeof vi.fn>;
  let mockOnCancel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnSave = vi.fn();
    mockOnCancel = vi.fn();
  });

  it('renders the form with all required fields', () => {
    render(
      <SimpleClinicalNoteForm onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    expect(screen.getByText('Create Clinical Note')).toBeInTheDocument();
    expect(screen.getByLabelText(/patient id/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/note title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/note type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/priority/i)).toBeInTheDocument();
  });

  it('shows validation errors for required fields', async () => {
    const user = userEvent.setup();

    render(
      <SimpleClinicalNoteForm onSave={mockOnSave} onCancel={mockOnCancel} />
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

    render(
      <SimpleClinicalNoteForm onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    // Fill required fields but leave SOAP sections empty
    const patientInput = screen.getByLabelText(/patient id/i);
    await user.type(patientInput, 'PAT001');

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

  it('successfully submits valid form data', async () => {
    const user = userEvent.setup();

    render(
      <SimpleClinicalNoteForm onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    // Fill required fields
    const patientInput = screen.getByLabelText(/patient id/i);
    await user.type(patientInput, 'PAT001');

    const titleInput = screen.getByLabelText(/note title/i);
    await user.type(titleInput, 'Test Clinical Note');

    // Fill at least one SOAP section
    const subjectiveTextarea = screen.getByPlaceholderText(
      /patient's subjective complaints/i
    );
    await user.type(subjectiveTextarea, 'Patient reports headache');

    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    // Wait for form submission
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          patient: 'PAT001',
          title: 'Test Clinical Note',
          content: expect.objectContaining({
            subjective: 'Patient reports headache',
          }),
        })
      );
    });
  });

  it('shows follow-up message when follow-up is required', async () => {
    const user = userEvent.setup();

    render(
      <SimpleClinicalNoteForm onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    const followUpToggle = screen.getByRole('checkbox', {
      name: /follow-up required/i,
    });
    await user.click(followUpToggle);

    expect(
      screen.getByText(/follow-up scheduling will be available/i)
    ).toBeInTheDocument();
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <SimpleClinicalNoteForm onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('renders in readonly mode', () => {
    render(
      <SimpleClinicalNoteForm
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        readonly={true}
      />
    );

    // Save button should not be present in readonly mode
    expect(
      screen.queryByRole('button', { name: /save/i })
    ).not.toBeInTheDocument();
  });

  it('pre-populates patient when patientId is provided', () => {
    render(
      <SimpleClinicalNoteForm
        patientId="PAT123"
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    const patientInput = screen.getByLabelText(
      /patient id/i
    ) as HTMLInputElement;
    expect(patientInput.value).toBe('PAT123');
  });

  it('shows edit mode when noteId is provided', () => {
    render(
      <SimpleClinicalNoteForm
        noteId="note-123"
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Edit Clinical Note')).toBeInTheDocument();
  });

  it('validates title length', async () => {
    const user = userEvent.setup();

    render(
      <SimpleClinicalNoteForm onSave={mockOnSave} onCancel={mockOnCancel} />
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
});
