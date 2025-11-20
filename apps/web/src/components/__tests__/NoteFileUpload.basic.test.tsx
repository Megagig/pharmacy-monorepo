import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import NoteFileUpload from '../NoteFileUpload';

// Mock the clinical note service
vi.mock('../../services/clinicalNoteService', () => ({
  default: {
    uploadAttachment: vi.fn(),
    deleteAttachment: vi.fn(),
    downloadAttachment: vi.fn(),
  },
}));

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'mock-url');
global.URL.revokeObjectURL = vi.fn();

describe('NoteFileUpload Basic Functionality', () => {
  const mockOnFilesUploaded = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders upload area correctly', () => {
    render(
      <NoteFileUpload
        onFilesUploaded={mockOnFilesUploaded}
        maxFiles={5}
        maxFileSize={10 * 1024 * 1024}
      />
    );

    expect(
      screen.getByText('Drop files here or click to browse')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Maximum 5 files, up to 10 MB each')
    ).toBeInTheDocument();
    expect(screen.getByText('Add More Files')).toBeInTheDocument();
  });

  it('displays file type information', () => {
    render(
      <NoteFileUpload
        onFilesUploaded={mockOnFilesUploaded}
        acceptedTypes={['image/*', 'application/pdf']}
      />
    );

    expect(
      screen.getByText('Supported: image/*, application/pdf')
    ).toBeInTheDocument();
  });

  it('shows existing attachments when provided', () => {
    const mockAttachments = [
      {
        _id: 'att1',
        fileName: 'test-file.pdf',
        originalName: 'Test Document.pdf',
        mimeType: 'application/pdf',
        size: 1024000,
        url: 'http://example.com/test-file.pdf',
        uploadedAt: '2024-01-01T00:00:00Z',
        uploadedBy: 'user1',
      },
    ];

    render(
      <NoteFileUpload
        onFilesUploaded={mockOnFilesUploaded}
        existingAttachments={mockAttachments}
        noteId="note1"
      />
    );

    expect(screen.getByText('Existing Attachments (1)')).toBeInTheDocument();
    expect(screen.getByText('Test Document.pdf')).toBeInTheDocument();
  });

  it('disables upload when disabled prop is true', () => {
    render(
      <NoteFileUpload onFilesUploaded={mockOnFilesUploaded} disabled={true} />
    );

    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeDisabled();
  });

  it('shows correct file size formatting', () => {
    render(
      <NoteFileUpload
        onFilesUploaded={mockOnFilesUploaded}
        maxFileSize={5 * 1024 * 1024} // 5MB
      />
    );

    expect(
      screen.getByText('Maximum 5 files, up to 5 MB each')
    ).toBeInTheDocument();
  });
});
