import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import NoteFileUpload from '../NoteFileUpload';
import clinicalNoteService from '../../services/clinicalNoteService';
import { Attachment } from '../../types/clinicalNote';

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

describe('Enhanced NoteFileUpload Component', () => {
  const mockOnFilesUploaded = vi.fn();
  const mockOnAttachmentDeleted = vi.fn();

  const mockExistingAttachments: Attachment[] = [
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
    {
      _id: 'att2',
      fileName: 'image.jpg',
      originalName: 'Test Image.jpg',
      mimeType: 'image/jpeg',
      size: 512000,
      url: 'http://example.com/image.jpg',
      uploadedAt: '2024-01-01T00:00:00Z',
      uploadedBy: 'user1',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders upload area with correct information', () => {
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
  });

  it('displays existing attachments with preview cards', () => {
    render(
      <NoteFileUpload
        onFilesUploaded={mockOnFilesUploaded}
        existingAttachments={mockExistingAttachments}
        noteId="note1"
      />
    );

    expect(screen.getByText('Existing Attachments (2)')).toBeInTheDocument();
    expect(screen.getByText('Test Document.pdf')).toBeInTheDocument();
    expect(screen.getByText('Test Image.jpg')).toBeInTheDocument();
  });

  it('shows file type icons correctly', () => {
    render(
      <NoteFileUpload
        onFilesUploaded={mockOnFilesUploaded}
        existingAttachments={mockExistingAttachments}
        noteId="note1"
      />
    );

    // Should show PDF and image icons
    const cards = screen.getAllByRole('button');
    expect(cards.length).toBeGreaterThan(0);
  });

  it('handles file selection and validation', async () => {
    const user = userEvent.setup();

    render(
      <NoteFileUpload
        onFilesUploaded={mockOnFilesUploaded}
        maxFiles={2}
        maxFileSize={1024}
        acceptedTypes={['image/*']}
      />
    );

    const fileInput = screen
      .getByLabelText(/drop files here/i)
      .querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();

    // Test file size validation
    const largeFile = new File(['x'.repeat(2048)], 'large.jpg', {
      type: 'image/jpeg',
    });

    if (fileInput) {
      await user.upload(fileInput, largeFile);
    }

    await waitFor(() => {
      expect(screen.getByText(/file size exceeds/i)).toBeInTheDocument();
    });
  });

  it('handles file type validation', async () => {
    const user = userEvent.setup();

    render(
      <NoteFileUpload
        onFilesUploaded={mockOnFilesUploaded}
        acceptedTypes={['image/*']}
      />
    );

    const fileInput = screen
      .getByLabelText(/drop files here/i)
      .querySelector('input[type="file"]');
    const invalidFile = new File(['content'], 'test.exe', {
      type: 'application/x-executable',
    });

    if (fileInput) {
      await user.upload(fileInput, invalidFile);
    }

    await waitFor(() => {
      expect(screen.getByText(/file type not supported/i)).toBeInTheDocument();
    });
  });

  it('uploads files to existing note', async () => {
    const user = userEvent.setup();
    const mockUploadResponse = {
      attachments: [
        {
          _id: 'new-att',
          fileName: 'uploaded-file.jpg',
          originalName: 'test.jpg',
          mimeType: 'image/jpeg',
          size: 1024,
          url: 'http://example.com/uploaded-file.jpg',
          uploadedAt: '2024-01-01T00:00:00Z',
          uploadedBy: 'user1',
        },
      ],
      note: {} as any,
      message: 'Success',
    };

    (clinicalNoteService.uploadAttachment as any).mockResolvedValue(
      mockUploadResponse
    );

    render(
      <NoteFileUpload onFilesUploaded={mockOnFilesUploaded} noteId="note1" />
    );

    const fileInput = screen
      .getByLabelText(/drop files here/i)
      .querySelector('input[type="file"]');
    const validFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

    if (fileInput) {
      await user.upload(fileInput, validFile);
    }

    await waitFor(() => {
      expect(clinicalNoteService.uploadAttachment).toHaveBeenCalledWith(
        'note1',
        [validFile]
      );
      expect(mockOnFilesUploaded).toHaveBeenCalled();
    });
  });

  it('handles attachment deletion', async () => {
    const user = userEvent.setup();
    (clinicalNoteService.deleteAttachment as any).mockResolvedValue({
      message: 'Deleted',
    });

    render(
      <NoteFileUpload
        onFilesUploaded={mockOnFilesUploaded}
        onAttachmentDeleted={mockOnAttachmentDeleted}
        existingAttachments={mockExistingAttachments}
        noteId="note1"
      />
    );

    // Find and click delete button for first attachment
    const deleteButtons = screen.getAllByLabelText('Delete');
    await user.click(deleteButtons[0]);

    // Confirm deletion in dialog
    const confirmButton = screen.getByRole('button', { name: /delete/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(clinicalNoteService.deleteAttachment).toHaveBeenCalledWith(
        'note1',
        'att1'
      );
      expect(mockOnAttachmentDeleted).toHaveBeenCalledWith('att1');
    });
  });

  it('handles attachment download', async () => {
    const user = userEvent.setup();
    const mockBlob = new Blob(['file content'], { type: 'application/pdf' });
    (clinicalNoteService.downloadAttachment as any).mockResolvedValue(mockBlob);

    // Mock DOM methods
    const mockCreateElement = vi.spyOn(document, 'createElement');
    const mockAppendChild = vi.spyOn(document.body, 'appendChild');
    const mockRemoveChild = vi.spyOn(document.body, 'removeChild');
    const mockClick = vi.fn();

    mockCreateElement.mockReturnValue({
      href: '',
      download: '',
      click: mockClick,
    } as any);

    render(
      <NoteFileUpload
        onFilesUploaded={mockOnFilesUploaded}
        existingAttachments={mockExistingAttachments}
        noteId="note1"
      />
    );

    // Find and click download button
    const downloadButtons = screen.getAllByLabelText('Download');
    await user.click(downloadButtons[0]);

    await waitFor(() => {
      expect(clinicalNoteService.downloadAttachment).toHaveBeenCalledWith(
        'note1',
        'att1'
      );
      expect(mockClick).toHaveBeenCalled();
    });

    mockCreateElement.mockRestore();
    mockAppendChild.mockRestore();
    mockRemoveChild.mockRestore();
  });

  it('opens preview dialog for supported file types', async () => {
    const user = userEvent.setup();

    render(
      <NoteFileUpload
        onFilesUploaded={mockOnFilesUploaded}
        existingAttachments={mockExistingAttachments}
        showPreview={true}
      />
    );

    // Click preview button for image
    const previewButtons = screen.getAllByLabelText('Preview');
    await user.click(previewButtons[1]); // Image attachment

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Test Image.jpg')).toBeInTheDocument();
    });
  });

  it('handles drag and drop file upload', async () => {
    render(<NoteFileUpload onFilesUploaded={mockOnFilesUploaded} />);

    const dropZone = screen.getByText(/drop files here/i).closest('div');
    const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

    if (dropZone) {
      fireEvent.dragOver(dropZone);
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [file],
        },
      });
    }

    await waitFor(() => {
      expect(mockOnFilesUploaded).toHaveBeenCalled();
    });
  });

  it('respects maximum file limit', async () => {
    const user = userEvent.setup();

    render(
      <NoteFileUpload
        onFilesUploaded={mockOnFilesUploaded}
        existingAttachments={mockExistingAttachments} // 2 existing
        maxFiles={3}
      />
    );

    const fileInput = screen
      .getByLabelText(/drop files here/i)
      .querySelector('input[type="file"]');
    const files = [
      new File(['1'], 'test1.jpg', { type: 'image/jpeg' }),
      new File(['2'], 'test2.jpg', { type: 'image/jpeg' }),
    ];

    if (fileInput) {
      await user.upload(fileInput, files);
    }

    await waitFor(() => {
      expect(screen.getByText(/maximum 3 files allowed/i)).toBeInTheDocument();
    });
  });

  it('disables upload when readonly', () => {
    render(
      <NoteFileUpload onFilesUploaded={mockOnFilesUploaded} disabled={true} />
    );

    const fileInput = screen
      .getByLabelText(/drop files here/i)
      .querySelector('input[type="file"]');
    expect(fileInput).toBeDisabled();
  });

  it('shows upload progress during file upload', async () => {
    const user = userEvent.setup();

    // Mock a delayed upload
    (clinicalNoteService.uploadAttachment as any).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                attachments: [],
                note: {},
                message: 'Success',
              }),
            100
          )
        )
    );

    render(
      <NoteFileUpload onFilesUploaded={mockOnFilesUploaded} noteId="note1" />
    );

    const fileInput = screen
      .getByLabelText(/drop files here/i)
      .querySelector('input[type="file"]');
    const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

    if (fileInput) {
      await user.upload(fileInput, file);
    }

    // Should show uploading state
    expect(screen.getByText('Uploading...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText('Uploading...')).not.toBeInTheDocument();
    });
  });
});
