import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import FileAttachment from '../FileAttachment';

// Mock fetch for download functionality
global.fetch = vi.fn();

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'mock-url');
global.URL.revokeObjectURL = vi.fn();

const mockAttachment = {
  id: 'att_1',
  filename: 'test-document.pdf',
  url: '/files/test-document.pdf',
  type: 'application/pdf',
  size: 1024000 // 1MB
};

const mockImageAttachment = {
  id: 'att_2',
  filename: 'test-image.jpg',
  url: '/files/test-image.jpg',
  type: 'image/jpeg',
  size: 512000 // 512KB
};

describe('FileAttachment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['mock file content']))
    });
  });

  describe('Card variant', () => {
    it('renders file attachment card with correct info', () => {
      render(<FileAttachment attachment={mockAttachment} variant="card" />);
      
      expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
      expect(screen.getByText('PDF')).toBeInTheDocument();
      expect(screen.getByText('1000.00 KB')).toBeInTheDocument();
    });

    it('shows preview and download buttons for PDF', () => {
      render(<FileAttachment attachment={mockAttachment} variant="card" />);
      
      expect(screen.getByText('Preview')).toBeInTheDocument();
      expect(screen.getByText('Download')).toBeInTheDocument();
    });

    it('shows preview and download buttons for images', () => {
      render(<FileAttachment attachment={mockImageAttachment} variant="card" />);
      
      expect(screen.getByText('Preview')).toBeInTheDocument();
      expect(screen.getByText('Download')).toBeInTheDocument();
    });

    it('handles file download', async () => {
      // Mock DOM methods
      const mockLink = {
        href: '',
        download: '',
        click: vi.fn()
      };
      const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any);
      const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any);

      render(<FileAttachment attachment={mockAttachment} variant="card" />);
      
      const downloadButton = screen.getByText('Download');
      fireEvent.click(downloadButton);
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/files/test-document.pdf');
        expect(createElementSpy).toHaveBeenCalledWith('a');
        expect(mockLink.click).toHaveBeenCalled();
      });

      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
    });

    it('shows error when download fails', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));
      
      render(<FileAttachment attachment={mockAttachment} variant="card" />);
      
      const downloadButton = screen.getByText('Download');
      fireEvent.click(downloadButton);
      
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('opens preview dialog for PDF files', async () => {
      render(<FileAttachment attachment={mockAttachment} variant="card" />);
      
      const previewButton = screen.getByText('Preview');
      fireEvent.click(previewButton);
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
      });
    });

    it('opens preview dialog for image files', async () => {
      render(<FileAttachment attachment={mockImageAttachment} variant="card" />);
      
      const previewButton = screen.getByText('Preview');
      fireEvent.click(previewButton);
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
    });

    it('shows remove button when onRemove is provided', () => {
      const mockOnRemove = vi.fn();
      render(<FileAttachment attachment={mockAttachment} variant="card" onRemove={mockOnRemove} />);
      
      const removeButton = screen.getByRole('button', { name: '' }); // Close icon button
      fireEvent.click(removeButton);
      
      expect(mockOnRemove).toHaveBeenCalled();
    });
  });

  describe('Message variant', () => {
    it('renders compact message attachment', () => {
      render(<FileAttachment attachment={mockAttachment} variant="message" />);
      
      expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
      expect(screen.getByText('PDF • 1000.00 KB')).toBeInTheDocument();
    });

    it('handles click to preview', () => {
      render(<FileAttachment attachment={mockAttachment} variant="message" />);
      
      const attachmentElement = screen.getByText('test-document.pdf').closest('div');
      fireEvent.click(attachmentElement!);
      
      // Should open preview dialog
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('handles download button click', async () => {
      const mockLink = {
        href: '',
        download: '',
        click: vi.fn()
      };
      const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any);
      const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any);

      render(<FileAttachment attachment={mockAttachment} variant="message" />);
      
      const downloadButton = screen.getByRole('button', { name: '' }); // Download icon button
      fireEvent.click(downloadButton);
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/files/test-document.pdf');
      });

      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
    });
  });

  describe('Chip variant', () => {
    it('renders chip attachment', () => {
      const mockOnRemove = vi.fn();
      render(<FileAttachment attachment={mockAttachment} variant="chip" onRemove={mockOnRemove} />);
      
      expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
    });

    it('handles remove action', () => {
      const mockOnRemove = vi.fn();
      render(<FileAttachment attachment={mockAttachment} variant="chip" onRemove={mockOnRemove} />);
      
      const removeButton = screen.getByTestId('CancelIcon');
      fireEvent.click(removeButton);
      
      expect(mockOnRemove).toHaveBeenCalled();
    });
  });

  describe('File type detection', () => {
    it('shows correct icon for PDF files', () => {
      render(<FileAttachment attachment={mockAttachment} variant="card" />);
      expect(screen.getByTestId('PictureAsPdfIcon')).toBeInTheDocument();
    });

    it('shows correct icon for image files', () => {
      render(<FileAttachment attachment={mockImageAttachment} variant="card" />);
      expect(screen.getByTestId('ImageIcon')).toBeInTheDocument();
    });

    it('shows correct icon for Word documents', () => {
      const wordAttachment = {
        ...mockAttachment,
        filename: 'document.docx',
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      };
      
      render(<FileAttachment attachment={wordAttachment} variant="card" />);
      expect(screen.getByTestId('DescriptionIcon')).toBeInTheDocument();
    });

    it('shows correct icon for text files', () => {
      const textAttachment = {
        ...mockAttachment,
        filename: 'notes.txt',
        type: 'text/plain'
      };
      
      render(<FileAttachment attachment={textAttachment} variant="card" />);
      expect(screen.getByTestId('TextSnippetIcon')).toBeInTheDocument();
    });

    it('shows generic icon for unknown file types', () => {
      const unknownAttachment = {
        ...mockAttachment,
        filename: 'data.xyz',
        type: 'application/unknown'
      };
      
      render(<FileAttachment attachment={unknownAttachment} variant="card" />);
      expect(screen.getByTestId('InsertDriveFileIcon')).toBeInTheDocument();
    });
  });

  describe('File size formatting', () => {
    it('formats bytes correctly', () => {
      const smallAttachment = { ...mockAttachment, size: 500 };
      render(<FileAttachment attachment={smallAttachment} variant="card" />);
      expect(screen.getByText('500.00 Bytes')).toBeInTheDocument();
    });

    it('formats KB correctly', () => {
      const kbAttachment = { ...mockAttachment, size: 1536 }; // 1.5 KB
      render(<FileAttachment attachment={kbAttachment} variant="card" />);
      expect(screen.getByText('1.50 KB')).toBeInTheDocument();
    });

    it('formats MB correctly', () => {
      const mbAttachment = { ...mockAttachment, size: 2097152 }; // 2 MB
      render(<FileAttachment attachment={mbAttachment} variant="card" />);
      expect(screen.getByText('2.00 MB')).toBeInTheDocument();
    });
  });

  describe('Preview functionality', () => {
    it('does not show preview button when showPreview is false', () => {
      render(<FileAttachment attachment={mockAttachment} variant="card" showPreview={false} />);
      expect(screen.queryByText('Preview')).not.toBeInTheDocument();
    });

    it('closes preview dialog when close button is clicked', async () => {
      render(<FileAttachment attachment={mockAttachment} variant="card" />);
      
      // Open preview
      const previewButton = screen.getByText('Preview');
      fireEvent.click(previewButton);
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
      
      // Close preview
      const closeButton = screen.getByText('Close');
      fireEvent.click(closeButton);
      
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });
});