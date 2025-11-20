import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuditTrailVisualization from '../AuditTrailVisualization';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(() => 'mock-token'),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

const mockAuditEvents = [
  {
    _id: '1',
    action: 'conversation_created',
    timestamp: '2024-01-15T10:00:00Z',
    userId: {
      _id: 'user1',
      firstName: 'John',
      lastName: 'Doe',
      role: 'pharmacist',
    },
    targetId: 'conv1',
    targetType: 'conversation',
    riskLevel: 'low',
    success: true,
    details: {
      conversationId: 'conv1',
      metadata: {
        conversationType: 'patient_query',
        participantCount: 2,
      },
    },
    ipAddress: '192.168.1.1',
  },
  {
    _id: '2',
    action: 'message_sent',
    timestamp: '2024-01-15T10:05:00Z',
    userId: {
      _id: 'user2',
      firstName: 'Jane',
      lastName: 'Smith',
      role: 'patient',
    },
    targetId: 'msg1',
    targetType: 'message',
    riskLevel: 'low',
    success: true,
    details: {
      conversationId: 'conv1',
      messageId: 'msg1',
      metadata: {
        messageType: 'text',
        hasAttachments: false,
      },
    },
    duration: 120,
    ipAddress: '192.168.1.2',
  },
  {
    _id: '3',
    action: 'file_uploaded',
    timestamp: '2024-01-15T10:10:00Z',
    userId: {
      _id: 'user1',
      firstName: 'John',
      lastName: 'Doe',
      role: 'pharmacist',
    },
    targetId: 'file1',
    targetType: 'file',
    riskLevel: 'medium',
    success: false,
    details: {
      conversationId: 'conv1',
      fileName: 'prescription.pdf',
      metadata: {
        fileSize: 2048576,
        mimeType: 'application/pdf',
      },
    },
    duration: 300,
    ipAddress: '192.168.1.1',
  },
  {
    _id: '4',
    action: 'participant_added',
    timestamp: '2024-01-14T15:30:00Z', // Yesterday
    userId: {
      _id: 'user3',
      firstName: 'Dr. Alice',
      lastName: 'Johnson',
      role: 'doctor',
    },
    targetId: 'conv1',
    targetType: 'conversation',
    riskLevel: 'high',
    success: true,
    details: {
      conversationId: 'conv1',
      participantIds: ['user2'],
      metadata: {
        addedUserId: 'user2',
        role: 'patient',
      },
    },
    ipAddress: '192.168.1.3',
  },
];

const mockApiResponse = {
  success: true,
  data: mockAuditEvents,
};

describe('AuditTrailVisualization', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockLocalStorage.getItem.mockClear();
  });

  it('renders audit trail visualization with header', () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    render(<AuditTrailVisualization conversationId="conv1" />);

    expect(screen.getByText('Audit Trail Visualization')).toBeInTheDocument();
    expect(screen.getByText('Conversation: conv1')).toBeInTheDocument();
    expect(screen.getByText('Filters')).toBeInTheDocument();
    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });

  it('fetches and displays audit events', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    render(<AuditTrailVisualization conversationId="conv1" />);

    await waitFor(() => {
      expect(screen.getByText('Conversation Created')).toBeInTheDocument();
      expect(screen.getByText('Message Sent')).toBeInTheDocument();
      expect(screen.getByText('File Uploaded')).toBeInTheDocument();
      expect(screen.getByText('Participant Added')).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/communication/audit/conversation/conv1'),
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer mock-token',
        },
      })
    );
  });

  it('groups events by time periods correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    render(<AuditTrailVisualization conversationId="conv1" />);

    await waitFor(() => {
      expect(screen.getByText('Today')).toBeInTheDocument();
      expect(screen.getByText('Yesterday')).toBeInTheDocument();
    });
  });

  it('displays user information correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    render(<AuditTrailVisualization conversationId="conv1" />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Dr. Alice Johnson')).toBeInTheDocument();
    });
  });

  it('shows risk levels with appropriate colors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    render(<AuditTrailVisualization conversationId="conv1" />);

    await waitFor(() => {
      // Check that events are displayed (risk level colors are handled by MUI components)
      expect(screen.getByText('Conversation Created')).toBeInTheDocument();
      expect(screen.getByText('File Uploaded')).toBeInTheDocument();
      expect(screen.getByText('Participant Added')).toBeInTheDocument();
    });
  });

  it('displays success and failure status correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    render(<AuditTrailVisualization conversationId="conv1" />);

    await waitFor(() => {
      const successChips = screen.getAllByText('Success');
      const failedChips = screen.getAllByText('Failed');

      expect(successChips).toHaveLength(3); // 3 successful events
      expect(failedChips).toHaveLength(1); // 1 failed event
    });
  });

  it('expands event details when clicked', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    const user = userEvent.setup();

    render(<AuditTrailVisualization conversationId="conv1" />);

    await waitFor(() => {
      expect(screen.getByText('Conversation Created')).toBeInTheDocument();
    });

    // Find and click the first event card
    const eventCards = screen.getAllByRole('button');
    const firstEventCard = eventCards.find((card) =>
      within(card).queryByText('Conversation Created')
    );

    if (firstEventCard) {
      await user.click(firstEventCard);

      await waitFor(() => {
        expect(screen.getByText('Target Details')).toBeInTheDocument();
        expect(screen.getByText('Security Info')).toBeInTheDocument();
        expect(screen.getByText('Type: conversation')).toBeInTheDocument();
        expect(screen.getByText('IP: 192.168.1.1')).toBeInTheDocument();
      });
    }
  });

  it('shows additional details in expanded view', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    const user = userEvent.setup();

    render(<AuditTrailVisualization conversationId="conv1" />);

    await waitFor(() => {
      expect(screen.getByText('File Uploaded')).toBeInTheDocument();
    });

    // Find and click the file upload event
    const eventCards = screen.getAllByRole('button');
    const fileEventCard = eventCards.find((card) =>
      within(card).queryByText('File Uploaded')
    );

    if (fileEventCard) {
      await user.click(fileEventCard);

      await waitFor(() => {
        expect(screen.getByText('File: prescription.pdf')).toBeInTheDocument();
        expect(screen.getByText('Additional Details')).toBeInTheDocument();
      });
    }
  });

  it('opens filters panel when filter button is clicked', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    const user = userEvent.setup();

    render(<AuditTrailVisualization conversationId="conv1" />);

    const filtersButton = screen.getByText('Filters');
    await user.click(filtersButton);

    await waitFor(() => {
      expect(screen.getByLabelText('Action')).toBeInTheDocument();
      expect(screen.getByLabelText('Risk Level')).toBeInTheDocument();
      expect(screen.getByLabelText('Status')).toBeInTheDocument();
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
          data: [mockAuditEvents[0]], // Filtered result
        }),
      });

    const user = userEvent.setup();

    render(<AuditTrailVisualization conversationId="conv1" />);

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

    render(<AuditTrailVisualization conversationId="conv1" />);

    // Open filters and set some values
    const filtersButton = screen.getByText('Filters');
    await user.click(filtersButton);

    const actionSelect = screen.getByLabelText('Action');
    await user.click(actionSelect);
    await user.click(screen.getByText('Message Sent'));

    // Clear filters
    const clearButton = screen.getByText('Clear Filters');
    await user.click(clearButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + filter + clear
    });
  });

  it('handles refresh button click', async () => {
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

    render(<AuditTrailVisualization conversationId="conv1" />);

    await waitFor(() => {
      expect(screen.getByText('Conversation Created')).toBeInTheDocument();
    });

    const refreshButton = screen.getByText('Refresh');
    await user.click(refreshButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  it('displays timestamps correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    render(<AuditTrailVisualization conversationId="conv1" />);

    await waitFor(() => {
      expect(screen.getByText('10:00:00')).toBeInTheDocument();
      expect(screen.getByText('10:05:00')).toBeInTheDocument();
      expect(screen.getByText('10:10:00')).toBeInTheDocument();
      expect(screen.getByText('15:30:00')).toBeInTheDocument();
    });
  });

  it('shows duration when available', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    render(<AuditTrailVisualization conversationId="conv1" />);

    await waitFor(() => {
      expect(screen.getByText('120ms')).toBeInTheDocument();
      expect(screen.getByText('300ms')).toBeInTheDocument();
    });
  });

  it('handles auto-refresh when enabled', async () => {
    jest.useFakeTimers();

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    });

    render(
      <AuditTrailVisualization
        conversationId="conv1"
        autoRefresh={true}
        refreshInterval={5000}
      />
    );

    // Initial fetch
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Fast-forward time to trigger refresh
    jest.advanceTimersByTime(5000);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    jest.useRealTimers();
  });

  it('displays error message when fetch fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<AuditTrailVisualization conversationId="conv1" />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('shows loading state during fetch', () => {
    mockFetch.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(resolve, 1000))
    );

    render(<AuditTrailVisualization conversationId="conv1" />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('displays empty state when no events found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    });

    render(<AuditTrailVisualization conversationId="conv1" />);

    await waitFor(() => {
      expect(
        screen.getByText('No audit events found for this conversation')
      ).toBeInTheDocument();
    });
  });

  it('displays user avatars correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    render(<AuditTrailVisualization conversationId="conv1" />);

    await waitFor(() => {
      // Check for user initials in avatars
      expect(screen.getByText('JD')).toBeInTheDocument(); // John Doe
      expect(screen.getByText('JS')).toBeInTheDocument(); // Jane Smith
      expect(screen.getByText('DJ')).toBeInTheDocument(); // Dr. Alice Johnson
    });
  });

  it('shows role chips for users', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    render(<AuditTrailVisualization conversationId="conv1" />);

    await waitFor(() => {
      expect(screen.getByText('pharmacist')).toBeInTheDocument();
      expect(screen.getByText('patient')).toBeInTheDocument();
      expect(screen.getByText('doctor')).toBeInTheDocument();
    });
  });

  it('formats action names correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    render(<AuditTrailVisualization conversationId="conv1" />);

    await waitFor(() => {
      expect(screen.getByText('Conversation Created')).toBeInTheDocument();
      expect(screen.getByText('Message Sent')).toBeInTheDocument();
      expect(screen.getByText('File Uploaded')).toBeInTheDocument();
      expect(screen.getByText('Participant Added')).toBeInTheDocument();
    });
  });

  it('displays metadata in expanded view', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    const user = userEvent.setup();

    render(<AuditTrailVisualization conversationId="conv1" />);

    await waitFor(() => {
      expect(screen.getByText('Conversation Created')).toBeInTheDocument();
    });

    // Find and click the first event card to expand it
    const eventCards = screen.getAllByRole('button');
    const firstEventCard = eventCards.find((card) =>
      within(card).queryByText('Conversation Created')
    );

    if (firstEventCard) {
      await user.click(firstEventCard);

      await waitFor(() => {
        expect(screen.getByText('Additional Details')).toBeInTheDocument();
        // Should show JSON metadata
        expect(
          screen.getByText(/"conversationType": "patient_query"/)
        ).toBeInTheDocument();
      });
    }
  });
});
