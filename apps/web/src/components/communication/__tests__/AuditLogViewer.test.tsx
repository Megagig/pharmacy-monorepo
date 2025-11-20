import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import AuditLogViewer from '../AuditLogViewer';

import { vi } from 'vitest';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(() => 'mock-token'),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Mock URL.createObjectURL and related methods
global.URL.createObjectURL = vi.fn(() => 'mock-url');
global.URL.revokeObjectURL = vi.fn();

// Test wrapper with providers
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <LocalizationProvider dateAdapter={AdapterDateFns}>
    {children}
  </LocalizationProvider>
);

const mockAuditLogs = [
  {
    _id: '1',
    action: 'message_sent',
    timestamp: '2024-01-15T10:30:00Z',
    userId: {
      _id: 'user1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      role: 'pharmacist',
    },
    targetId: 'msg1',
    targetType: 'message',
    riskLevel: 'low',
    complianceCategory: 'communication_security',
    success: true,
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    duration: 150,
    details: {
      conversationId: 'conv1',
      messageId: 'msg1',
      metadata: {
        messageType: 'text',
        hasAttachments: false,
      },
    },
  },
  {
    _id: '2',
    action: 'file_uploaded',
    timestamp: '2024-01-15T11:00:00Z',
    userId: {
      _id: 'user2',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      role: 'doctor',
    },
    targetId: 'file1',
    targetType: 'file',
    riskLevel: 'high',
    complianceCategory: 'file_security',
    success: false,
    ipAddress: '192.168.1.2',
    userAgent: 'Mozilla/5.0',
    errorMessage: 'File size exceeded limit',
    details: {
      conversationId: 'conv1',
      fileName: 'test-document.pdf',
      metadata: {
        fileSize: 10485760,
        mimeType: 'application/pdf',
      },
    },
  },
];

const mockApiResponse = {
  success: true,
  data: mockAuditLogs,
  pagination: {
    total: 2,
    page: 1,
    limit: 25,
    pages: 1,
  },
};

describe('AuditLogViewer', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockLocalStorage.getItem.mockClear();
  });

  it('renders audit log viewer with header', () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    render(
      <TestWrapper>
        <AuditLogViewer />
      </TestWrapper>
    );

    expect(screen.getByText('Audit Log Viewer')).toBeInTheDocument();
    expect(screen.getByText('Filters')).toBeInTheDocument();
    expect(screen.getByText('Export CSV')).toBeInTheDocument();
    expect(screen.getByText('Export JSON')).toBeInTheDocument();
  });

  it('fetches and displays audit logs', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    render(
      <TestWrapper>
        <AuditLogViewer />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Message Sent')).toBeInTheDocument();
      expect(screen.getByText('File Uploaded')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/communication/audit'),
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer mock-token',
        },
      })
    );
  });

  it('displays risk levels with appropriate colors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    render(
      <TestWrapper>
        <AuditLogViewer />
      </TestWrapper>
    );

    await waitFor(() => {
      const lowRiskChip = screen.getByText('LOW');
      const highRiskChip = screen.getByText('HIGH');

      expect(lowRiskChip).toBeInTheDocument();
      expect(highRiskChip).toBeInTheDocument();
    });
  });

  it('shows success and failure status correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    render(
      <TestWrapper>
        <AuditLogViewer />
      </TestWrapper>
    );

    await waitFor(() => {
      const successChips = screen.getAllByText('Success');
      const failedChips = screen.getAllByText('Failed');

      expect(successChips).toHaveLength(1);
      expect(failedChips).toHaveLength(1);
    });
  });

  it('opens filters panel when filter button is clicked', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    const user = userEvent.setup();

    render(
      <TestWrapper>
        <AuditLogViewer />
      </TestWrapper>
    );

    const filtersButton = screen.getByText('Filters');
    await user.click(filtersButton);

    await waitFor(() => {
      expect(screen.getByLabelText('Search')).toBeInTheDocument();
      expect(screen.getByLabelText('Action')).toBeInTheDocument();
      expect(screen.getByLabelText('Risk Level')).toBeInTheDocument();
    });
  });

  it('applies filters and refetches data', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockApiResponse,
          data: [mockAuditLogs[0]], // Filtered result
        }),
      });

    const user = userEvent.setup();

    render(
      <TestWrapper>
        <AuditLogViewer />
      </TestWrapper>
    );

    // Open filters
    const filtersButton = screen.getByText('Filters');
    await user.click(filtersButton);

    // Set action filter
    const actionSelect = screen.getByLabelText('Action');
    await user.click(actionSelect);
    await user.click(screen.getByText('Message Sent'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('action=message_sent'),
        expect.any(Object)
      );
    });
  });

  it('opens audit log details dialog when view button is clicked', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    const user = userEvent.setup();

    render(
      <TestWrapper>
        <AuditLogViewer />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const viewButtons = screen.getAllByLabelText('View Details');
    await user.click(viewButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Audit Log Details')).toBeInTheDocument();
      expect(screen.getByText('Basic Information')).toBeInTheDocument();
      expect(screen.getByText('Security & Compliance')).toBeInTheDocument();
    });
  });

  it('handles export functionality', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(['csv,data'], { type: 'text/csv' }),
      });

    // Mock document methods
    const mockAppendChild = vi.fn();
    const mockRemoveChild = vi.fn();
    const mockClick = vi.fn();

    Object.defineProperty(document, 'createElement', {
      value: vi.fn(() => ({
        href: '',
        download: '',
        click: mockClick,
      })),
    });

    Object.defineProperty(document.body, 'appendChild', {
      value: mockAppendChild,
    });
    Object.defineProperty(document.body, 'removeChild', {
      value: mockRemoveChild,
    });

    const user = userEvent.setup();

    render(
      <TestWrapper>
        <AuditLogViewer />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Export CSV')).toBeInTheDocument();
    });

    const exportButton = screen.getByText('Export CSV');
    await user.click(exportButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/communication/audit/export'),
        expect.any(Object)
      );
    });
  });

  it('handles pagination correctly', async () => {
    const paginatedResponse = {
      ...mockApiResponse,
      pagination: {
        total: 100,
        page: 1,
        limit: 25,
        pages: 4,
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => paginatedResponse,
    });

    const user = userEvent.setup();

    render(
      <TestWrapper>
        <AuditLogViewer />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('1–25 of 100')).toBeInTheDocument();
    });

    // Test page change
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...paginatedResponse,
        pagination: { ...paginatedResponse.pagination, page: 2 },
      }),
    });

    const nextPageButton = screen.getByLabelText('Go to next page');
    await user.click(nextPageButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('offset=25'),
        expect.any(Object)
      );
    });
  });

  it('displays error message when fetch fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(
      <TestWrapper>
        <AuditLogViewer />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('shows loading state during fetch', () => {
    mockFetch.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(resolve, 1000))
    );

    render(
      <TestWrapper>
        <AuditLogViewer />
      </TestWrapper>
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('displays empty state when no logs found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...mockApiResponse,
        data: [],
        pagination: { ...mockApiResponse.pagination, total: 0 },
      }),
    });

    render(
      <TestWrapper>
        <AuditLogViewer />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('No audit logs found')).toBeInTheDocument();
    });
  });

  it('filters by conversation ID when provided', () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    render(
      <TestWrapper>
        <AuditLogViewer conversationId="conv123" />
      </TestWrapper>
    );

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/communication/audit/conversation/conv123'),
      expect.any(Object)
    );

    expect(screen.getByText('Conversation: conv123')).toBeInTheDocument();
  });

  it('clears filters when clear button is clicked', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      });

    const user = userEvent.setup();

    render(
      <TestWrapper>
        <AuditLogViewer />
      </TestWrapper>
    );

    // Open filters and set some values
    const filtersButton = screen.getByText('Filters');
    await user.click(filtersButton);

    const searchInput = screen.getByLabelText('Search');
    await user.type(searchInput, 'test search');

    // Clear filters
    const clearButton = screen.getByText('Clear Filters');
    await user.click(clearButton);

    expect(searchInput).toHaveValue('');
  });

  it('formats timestamps correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    render(
      <TestWrapper>
        <AuditLogViewer />
      </TestWrapper>
    );

    await waitFor(() => {
      // Should display formatted timestamp
      expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument();
    });
  });

  it('shows detailed information in expanded view', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    const user = userEvent.setup();

    render(
      <TestWrapper>
        <AuditLogViewer />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Click view details button
    const viewButtons = screen.getAllByLabelText('View Details');
    await user.click(viewButtons[0]);

    await waitFor(() => {
      const dialog = screen.getByRole('dialog');
      expect(
        within(dialog).getByText('john.doe@example.com')
      ).toBeInTheDocument();
      expect(within(dialog).getByText('192.168.1.1')).toBeInTheDocument();
      expect(within(dialog).getByText('150ms')).toBeInTheDocument();
    });
  });
});
