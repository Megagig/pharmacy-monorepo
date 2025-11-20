import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FilePreview } from '../FilePreview';

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

// Mock URL.createObjectURL and revokeObjectURL
const mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
const mockRevokeObjectURL = vi.fn();
Object.defineProperty(window.URL, 'createObjectURL', {
  value: mockCreateObjectURL,
});
Object.defineProperty(window.URL, 'revokeObjectURL', {
  value: mockRevokeObjectURL,
});

// Mock file attachment
const mockFileAttachment = {
  fileId: 'file-123',
  fileName: 'test-document.pdf',
  originalName: 'test-document.pdf',
  fileSize: 1024000, // 1MB
  mimeType: 'application/pdf',
  secureUrl: 'https://example.com/secure/file-123',
  uploadedAt: '2023-01-01T00:00:00Z',
};

const mockImageAttachment = {
  fileId: 'image-123',
  fileName: 'test-image.jpg',
  originalName: 'test-image.jpg',
  fileSize: 512000, // 512KB
  mimeType: 'image/jpeg',
  secureUrl: 'https://example.com/secure/image-123',
  uploadedAt: '2023-01-01T00:00:00Z',
};

describe('FilePreview Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock successful fetch response for downloads
    mockFetch.mockResolvedValue({
      ok: true,
      blob: () =>
        Promise.resolve(
          new Blob(['file content'], { type: 'application/pdf' })
        ),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Card Layout (default)', () => {
    it('renders file preview card correctly', () => {
      render(<FilePreview file={mockFileAttachment} />);

      expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
      expect(screen.getByText('PDF • 1000 KB')).toBeInTheDocument();
      expect(screen.getByText('Uploaded 1/1/2023')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /preview/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /download/i })
      ).toBeInTheDocument();
    });

    it('hides preview button when showPreview is false', () => {
      render(<FilePreview file={mockFileAttachment} showPreview={false} />);

      expect(
        screen.queryByRole('button', { name: /preview/i })
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /download/i })
      ).toBeInTheDocument();
    });

    it('hides download button when showDownload is false', () => {
      render(<FilePreview file={mockFileAttachment} showDownload={false} />);

      expect(
        screen.getByRole('button', { name: /preview/i })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /download/i })
      ).not.toBeInTheDocument();
    });

    it('hides details when showDetails is false', () => {
      render(<FilePreview file={mockFileAttachment} showDetails={false} />);

      expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
      expect(screen.queryByText('PDF • 1000 KB')).not.toBeInTheDocument();
      expect(screen.queryByText('Uploaded 1/1/2023')).not.toBeInTheDocument();
    });
  });

  describe('Compact Layout', () => {
    it('renders compact layout correctly', () => {
      render(<FilePreview file={mockFileAttachment} compact={true} />);

      expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
      expect(screen.getByText('1000 KB')).toBeInTheDocument();

      // Should have icon buttons instead of text buttons
      const previewButton = screen.getByRole('button', { name: /preview/i });
      const downloadButton = screen.getByRole('button', { name: /download/i });

      expect(previewButton).toBeInTheDocument();
      expect(downloadButton).toBeInTheDocument();
    });
  });

  describe('File Download', () => {
    it('downloads file successfully', async () => {
      const user = userEvent.setup();
      const onDownload = vi.fn();

      render(<FilePreview file={mockFileAttachment} onDownload={onDownload} />);

      const downloadButton = screen.getByRole('button', { name: /download/i });
      await user.click(downloadButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(mockFileAttachment.secureUrl, {
          headers: {
            Authorization: 'Bearer mock-token',
          },
        });
      });

      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalled();
      expect(onDownload).toHaveBeenCalledWith(mockFileAttachment);
    });

    it('handles download errors gracefully', async () => {
      const user = userEvent.setup();

      // Mock failed fetch
      mockFetch.mockRejectedValueOnce(new Error('Download failed'));

      render(<FilePreview file={mockFileAttachment} />);

      const downloadButton = screen.getByRole('button', { name: /download/i });
      await user.click(downloadButton);

      await waitFor(() => {
        expect(downloadButton).not.toBeDisabled();
      });
    });

    it('shows loading state during download', async () => {
      const user = userEvent.setup();

      // Mock slow download
      mockFetch.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      render(<FilePreview file={mockFileAttachment} />);

      const downloadButton = screen.getByRole('button', { name: /download/i });
      await user.click(downloadButton);

      expect(screen.getByText('Downloading...')).toBeInTheDocument();
      expect(downloadButton).toBeDisabled();
    });
  });

  describe('File Preview Dialog', () => {
    it('opens preview dialog when preview button is clicked', async () => {
      const user = userEvent.setup();

      render(<FilePreview file={mockFileAttachment} />);

      const previewButton = screen.getByRole('button', { name: /preview/i });
      await user.click(previewButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
      });
    });

    it('closes preview dialog when close button is clicked', async () => {
      const user = userEvent.setup();

      render(<FilePreview file={mockFileAttachment} />);

      const previewButton = screen.getByRole('button', { name: /preview/i });
      await user.click(previewButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('renders image preview correctly', async () => {
      const user = userEvent.setup();

      render(<FilePreview file={mockImageAttachment} />);

      const previewButton = screen.getByRole('button', { name: /preview/i });
      await user.click(previewButton);

      await waitFor(() => {
        const image = screen.getByRole('img', { name: 'test-image.jpg' });
        expect(image).toBeInTheDocument();
        expect(image).toHaveAttribute('src', mockImageAttachment.secureUrl);
      });
    });

    it('renders PDF preview with iframe', async () => {
      const user = userEvent.setup();

      render(<FilePreview file={mockFileAttachment} />);

      const previewButton = screen.getByRole('button', { name: /preview/i });
      await user.click(previewButton);

      await waitFor(() => {
        const iframe = screen.getByTitle('test-document.pdf');
        expect(iframe).toBeInTheDocument();
        expect(iframe).toHaveAttribute(
          'src',
          `${mockFileAttachment.secureUrl}#toolbar=0`
        );
      });
    });

    it('shows fallback preview for unsupported file types', async () => {
      const user = userEvent.setup();
      const unsupportedFile = {
        ...mockFileAttachment,
        mimeType: 'application/zip',
        fileName: 'archive.zip',
        originalName: 'archive.zip',
      };

      render(<FilePreview file={unsupportedFile} />);

      const previewButton = screen.getByRole('button', { name: /preview/i });
      await user.click(previewButton);

      await waitFor(() => {
        expect(screen.getByText('File Preview')).toBeInTheDocument();
        expect(
          screen.getByText('Preview not available for this file type')
        ).toBeInTheDocument();
      });
    });

    it('downloads file from preview dialog', async () => {
      const user = userEvent.setup();
      const onDownload = vi.fn();

      render(<FilePreview file={mockFileAttachment} onDownload={onDownload} />);

      const previewButton = screen.getByRole('button', { name: /preview/i });
      await user.click(previewButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const downloadButton = screen.getByRole('button', { name: /download/i });
      await user.click(downloadButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(mockFileAttachment.secureUrl, {
          headers: {
            Authorization: 'Bearer mock-token',
          },
        });
      });

      expect(onDownload).toHaveBeenCalledWith(mockFileAttachment);
    });
  });

  describe('File Type Icons and Labels', () => {
    it('shows correct icon and label for PDF files', () => {
      render(<FilePreview file={mockFileAttachment} />);
      expect(screen.getByText('PDF • 1000 KB')).toBeInTheDocument();
    });

    it('shows correct icon and label for image files', () => {
      render(<FilePreview file={mockImageAttachment} />);
      expect(screen.getByText('Image • 500 KB')).toBeInTheDocument();
    });

    it('shows correct icon and label for document files', () => {
      const docFile = {
        ...mockFileAttachment,
        mimeType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileName: 'document.docx',
        originalName: 'document.docx',
      };

      render(<FilePreview file={docFile} />);
      expect(screen.getByText('Document • 1000 KB')).toBeInTheDocument();
    });

    it('shows correct icon and label for spreadsheet files', () => {
      const excelFile = {
        ...mockFileAttachment,
        mimeType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileName: 'spreadsheet.xlsx',
        originalName: 'spreadsheet.xlsx',
      };

      render(<FilePreview file={excelFile} />);
      expect(screen.getByText('Spreadsheet • 1000 KB')).toBeInTheDocument();
    });

    it('shows correct icon and label for text files', () => {
      const textFile = {
        ...mockFileAttachment,
        mimeType: 'text/plain',
        fileName: 'document.txt',
        originalName: 'document.txt',
      };

      render(<FilePreview file={textFile} />);
      expect(screen.getByText('Text • 1000 KB')).toBeInTheDocument();
    });
  });

  describe('File Size Formatting', () => {
    it('formats bytes correctly', () => {
      const smallFile = { ...mockFileAttachment, fileSize: 500 };
      render(<FilePreview file={smallFile} />);
      expect(screen.getByText('PDF • 500 Bytes')).toBeInTheDocument();
    });

    it('formats kilobytes correctly', () => {
      const kbFile = { ...mockFileAttachment, fileSize: 1536 }; // 1.5 KB
      render(<FilePreview file={kbFile} />);
      expect(screen.getByText('PDF • 1.5 KB')).toBeInTheDocument();
    });

    it('formats megabytes correctly', () => {
      const mbFile = { ...mockFileAttachment, fileSize: 2097152 }; // 2 MB
      render(<FilePreview file={mbFile} />);
      expect(screen.getByText('PDF • 2 MB')).toBeInTheDocument();
    });
  });

  describe('Callbacks', () => {
    it('calls onPreview callback when preview is opened', async () => {
      const user = userEvent.setup();
      const onPreview = vi.fn();

      render(<FilePreview file={mockFileAttachment} onPreview={onPreview} />);

      const previewButton = screen.getByRole('button', { name: /preview/i });
      await user.click(previewButton);

      expect(onPreview).toHaveBeenCalledWith(mockFileAttachment);
    });

    it('calls onDownload callback when file is downloaded', async () => {
      const user = userEvent.setup();
      const onDownload = vi.fn();

      render(<FilePreview file={mockFileAttachment} onDownload={onDownload} />);

      const downloadButton = screen.getByRole('button', { name: /download/i });
      await user.click(downloadButton);

      await waitFor(() => {
        expect(onDownload).toHaveBeenCalledWith(mockFileAttachment);
      });
    });
  });

  describe('Error Handling', () => {
    it('handles image load errors in preview', async () => {
      const user = userEvent.setup();

      render(<FilePreview file={mockImageAttachment} />);

      const previewButton = screen.getByRole('button', { name: /preview/i });
      await user.click(previewButton);

      await waitFor(() => {
        const image = screen.getByRole('img', { name: 'test-image.jpg' });
        expect(image).toBeInTheDocument();
      });

      // Simulate image load error
      const image = screen.getByRole('img', { name: 'test-image.jpg' });
      fireEvent.error(image);

      await waitFor(() => {
        expect(screen.getByText('Failed to load image')).toBeInTheDocument();
      });
    });

    it('shows retry option on preview errors', async () => {
      const user = userEvent.setup();

      render(<FilePreview file={mockImageAttachment} />);

      const previewButton = screen.getByRole('button', { name: /preview/i });
      await user.click(previewButton);

      await waitFor(() => {
        const image = screen.getByRole('img', { name: 'test-image.jpg' });
        fireEvent.error(image);
      });

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /try again/i })
        ).toBeInTheDocument();
      });
    });
  });
});
