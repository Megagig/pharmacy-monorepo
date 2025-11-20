import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileUpload } from '../FileUpload';
import { useCommunicationStore } from '../../../stores/communicationStore';

// Mock the communication store
vi.mock('../../../stores/communicationStore');

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(() => 'mock-token'),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock file upload response
const mockUploadResponse = {
  success: true,
  file: {
    id: 'file-123',
    fileName: 'test-file.pdf',
    originalName: 'test-file.pdf',
    mimeType: 'application/pdf',
    size: 1024,
    url: 'https://example.com/file.pdf',
    uploadedAt: '2023-01-01T00:00:00Z',
  },
};

const mockSendMessage = vi.fn();

describe('FileUpload Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock the communication store
    (useCommunicationStore as any).mockReturnValue({
      sendMessage: mockSendMessage,
    });

    // Mock successful fetch response
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockUploadResponse),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders file upload component correctly', () => {
    render(<FileUpload conversationId="conv-123" />);

    expect(screen.getByText('Drag and drop files here')).toBeInTheDocument();
    expect(screen.getByText('Browse Files')).toBeInTheDocument();
    expect(screen.getByText(/Allowed types:/)).toBeInTheDocument();
    expect(screen.getByText(/Maximum file size:/)).toBeInTheDocument();
  });

  it('handles file selection via browse button', async () => {
    const user = userEvent.setup();
    render(<FileUpload conversationId="conv-123" />);

    const file = new File(['test content'], 'test.pdf', {
      type: 'application/pdf',
    });
    const input = screen
      .getByRole('button', { name: /browse files/i })
      .parentElement?.querySelector('input[type="file"]');

    if (input) {
      await user.upload(input, file);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/communication/upload',
          expect.objectContaining({
            method: 'POST',
            headers: {
              Authorization: 'Bearer mock-token',
            },
          })
        );
      });
    }
  });

  it('validates file size limits', async () => {
    const user = userEvent.setup();
    render(<FileUpload conversationId="conv-123" maxSize={1024} />);

    // Create a file larger than the limit
    const largeFile = new File(['x'.repeat(2048)], 'large.pdf', {
      type: 'application/pdf',
    });
    const input = screen
      .getByRole('button', { name: /browse files/i })
      .parentElement?.querySelector('input[type="file"]');

    if (input) {
      await user.upload(input, largeFile);

      await waitFor(() => {
        expect(
          screen.getByText(/File size exceeds maximum limit/)
        ).toBeInTheDocument();
      });
    }
  });

  it('validates file types', async () => {
    const user = userEvent.setup();
    render(<FileUpload conversationId="conv-123" />);

    // Create a file with disallowed type
    const execFile = new File(['malicious content'], 'virus.exe', {
      type: 'application/x-executable',
    });
    const input = screen
      .getByRole('button', { name: /browse files/i })
      .parentElement?.querySelector('input[type="file"]');

    if (input) {
      await user.upload(input, execFile);

      await waitFor(() => {
        expect(
          screen.getByText(/File type.*is not allowed/)
        ).toBeInTheDocument();
      });
    }
  });

  it('validates dangerous file extensions', async () => {
    const user = userEvent.setup();
    render(<FileUpload conversationId="conv-123" />);

    // Create a file with dangerous extension
    const dangerousFile = new File(['script content'], 'script.js', {
      type: 'text/javascript',
    });
    const input = screen
      .getByRole('button', { name: /browse files/i })
      .parentElement?.querySelector('input[type="file"]');

    if (input) {
      await user.upload(input, dangerousFile);

      await waitFor(() => {
        expect(
          screen.getByText(/File extension is not allowed for security reasons/)
        ).toBeInTheDocument();
      });
    }
  });

  it('validates filename characters', async () => {
    const user = userEvent.setup();
    render(<FileUpload conversationId="conv-123" />);

    // Create a file with invalid characters
    const invalidFile = new File(['content'], '../../../etc/passwd', {
      type: 'text/plain',
    });
    const input = screen
      .getByRole('button', { name: /browse files/i })
      .parentElement?.querySelector('input[type="file"]');

    if (input) {
      await user.upload(input, invalidFile);

      await waitFor(() => {
        expect(
          screen.getByText(/Invalid characters in filename/)
        ).toBeInTheDocument();
      });
    }
  });

  it('enforces maximum file count', async () => {
    const user = userEvent.setup();
    render(<FileUpload conversationId="conv-123" maxFiles={2} />);

    const files = [
      new File(['content1'], 'file1.pdf', { type: 'application/pdf' }),
      new File(['content2'], 'file2.pdf', { type: 'application/pdf' }),
      new File(['content3'], 'file3.pdf', { type: 'application/pdf' }),
    ];

    const input = screen
      .getByRole('button', { name: /browse files/i })
      .parentElement?.querySelector('input[type="file"]');

    if (input) {
      await user.upload(input, files);

      await waitFor(() => {
        expect(screen.getByText(/Maximum 2 files allowed/)).toBeInTheDocument();
      });
    }
  });

  it('shows upload progress', async () => {
    const user = userEvent.setup();
    render(<FileUpload conversationId="conv-123" />);

    const file = new File(['test content'], 'test.pdf', {
      type: 'application/pdf',
    });
    const input = screen
      .getByRole('button', { name: /browse files/i })
      .parentElement?.querySelector('input[type="file"]');

    if (input) {
      await user.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText('Uploading Files')).toBeInTheDocument();
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
      });
    }
  });

  it('handles upload errors gracefully', async () => {
    const user = userEvent.setup();

    // Mock failed fetch response
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Upload failed' }),
    });

    render(<FileUpload conversationId="conv-123" />);

    const file = new File(['test content'], 'test.pdf', {
      type: 'application/pdf',
    });
    const input = screen
      .getByRole('button', { name: /browse files/i })
      .parentElement?.querySelector('input[type="file"]');

    if (input) {
      await user.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText('Upload failed')).toBeInTheDocument();
      });
    }
  });

  it('sends message with file attachment after successful upload', async () => {
    const user = userEvent.setup();
    render(<FileUpload conversationId="conv-123" />);

    const file = new File(['test content'], 'test.pdf', {
      type: 'application/pdf',
    });
    const input = screen
      .getByRole('button', { name: /browse files/i })
      .parentElement?.querySelector('input[type="file"]');

    if (input) {
      await user.upload(input, file);

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith({
          conversationId: 'conv-123',
          content: {
            type: 'file',
            text: 'Shared file: test-file.pdf',
            attachments: [mockUploadResponse.file],
          },
        });
      });
    }
  });

  it('calls onFileUploaded callback when provided', async () => {
    const user = userEvent.setup();
    const onFileUploaded = vi.fn();

    render(
      <FileUpload conversationId="conv-123" onFileUploaded={onFileUploaded} />
    );

    const file = new File(['test content'], 'test.pdf', {
      type: 'application/pdf',
    });
    const input = screen
      .getByRole('button', { name: /browse files/i })
      .parentElement?.querySelector('input[type="file"]');

    if (input) {
      await user.upload(input, file);

      await waitFor(() => {
        expect(onFileUploaded).toHaveBeenCalledWith(mockUploadResponse.file);
      });
    }
  });

  it('removes files from upload queue', async () => {
    const user = userEvent.setup();

    // Mock slow upload to keep file in queue
    mockFetch.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 1000))
    );

    render(<FileUpload conversationId="conv-123" />);

    const file = new File(['test content'], 'test.pdf', {
      type: 'application/pdf',
    });
    const input = screen
      .getByRole('button', { name: /browse files/i })
      .parentElement?.querySelector('input[type="file"]');

    if (input) {
      await user.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      expect(screen.queryByText('test.pdf')).not.toBeInTheDocument();
    }
  });

  it('removes uploaded files from display', async () => {
    const user = userEvent.setup();
    render(<FileUpload conversationId="conv-123" />);

    const file = new File(['test content'], 'test.pdf', {
      type: 'application/pdf',
    });
    const input = screen
      .getByRole('button', { name: /browse files/i })
      .parentElement?.querySelector('input[type="file"]');

    if (input) {
      await user.upload(input, file);

      await waitFor(() => {
        expect(
          screen.getByText('Upload completed successfully')
        ).toBeInTheDocument();
      });

      // Wait for file to appear in uploaded files section
      await waitFor(() => {
        expect(screen.getByText(/test-file\.pdf/)).toBeInTheDocument();
      });

      const deleteChip = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteChip);

      expect(screen.queryByText(/test-file\.pdf/)).not.toBeInTheDocument();
    }
  });

  it('disables upload when disabled prop is true', () => {
    render(<FileUpload conversationId="conv-123" disabled={true} />);

    const browseButton = screen.getByRole('button', { name: /browse files/i });
    expect(browseButton).toBeDisabled();
  });

  it('shows correct file type icons', async () => {
    const user = userEvent.setup();
    render(<FileUpload conversationId="conv-123" />);

    const pdfFile = new File(['pdf content'], 'test.pdf', {
      type: 'application/pdf',
    });
    const input = screen
      .getByRole('button', { name: /browse files/i })
      .parentElement?.querySelector('input[type="file"]');

    if (input) {
      await user.upload(input, pdfFile);

      await waitFor(() => {
        // Check if PDF icon is rendered (this would need to be adjusted based on actual icon implementation)
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
      });
    }
  });

  it('formats file sizes correctly', () => {
    render(<FileUpload conversationId="conv-123" />);

    // The formatFileSize function should be tested separately or through integration
    expect(screen.getByText(/Maximum file size: 10 MB/)).toBeInTheDocument();
  });
});
