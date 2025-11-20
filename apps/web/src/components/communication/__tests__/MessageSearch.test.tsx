import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import MessageSearch from '../MessageSearch';

// Mock fetch
global.fetch = jest.fn();

// Mock lodash debounce
jest.mock('lodash', () => ({
  debounce: (fn: any) => fn,
}));

const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <LocalizationProvider dateAdapter={AdapterDateFns}>
    {children}
  </LocalizationProvider>
);

const mockSearchResults = {
  success: true,
  data: [
    {
      message: {
        _id: 'msg1',
        content: {
          text: 'Patient needs <mark>medication</mark> review',
          type: 'text',
          attachments: [],
        },
        senderId: 'user1',
        mentions: [],
        priority: 'normal',
        createdAt: '2024-01-15T10:00:00Z',
        sender: {
          _id: 'user1',
          firstName: 'John',
          lastName: 'Doe',
          role: 'pharmacist',
        },
      },
      conversation: {
        _id: 'conv1',
        title: 'Patient Consultation',
        type: 'patient_query',
        status: 'active',
      },
      highlights: {
        content: 'Patient needs <mark>medication</mark> review',
      },
      score: 0.95,
    },
  ],
  stats: {
    totalResults: 1,
    searchTime: 45,
    facets: {
      messageTypes: [{ type: 'text', count: 1 }],
      senders: [{ userId: 'user1', name: 'John Doe', count: 1 }],
      conversations: [
        { conversationId: 'conv1', title: 'Patient Consultation', count: 1 },
      ],
    },
  },
};

const mockSuggestions = {
  success: true,
  data: {
    suggestions: ['medication dosage', 'medication review'],
    popularSearches: ['medication', 'prescription', 'dosage'],
    recentSearches: ['patient symptoms', 'side effects'],
  },
};

const mockSavedSearches = {
  success: true,
  data: {
    userSearches: [
      {
        _id: 'search1',
        name: 'Urgent Medication Issues',
        query: 'medication',
        filters: { priority: 'urgent' },
        searchType: 'message',
        isPublic: false,
        useCount: 5,
        createdAt: '2024-01-10T10:00:00Z',
      },
    ],
  },
};

describe('MessageSearch', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    localStorage.clear();
    localStorage.setItem('token', 'mock-token');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders search interface correctly', () => {
    render(
      <TestWrapper>
        <MessageSearch />
      </TestWrapper>
    );

    expect(screen.getByText('Message Search')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search messages/)).toBeInTheDocument();
    expect(screen.getByText('Advanced Filters')).toBeInTheDocument();
  });

  it('performs search when query is entered', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSearchResults,
    } as Response);

    const user = userEvent.setup();

    render(
      <TestWrapper>
        <MessageSearch />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText(/Search messages/);

    await act(async () => {
      await user.type(searchInput, 'medication');
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          '/api/communication/search/messages?q=medication'
        ),
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer mock-token',
          },
        })
      );
    });
  });

  it('displays search results correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSearchResults,
    } as Response);

    const user = userEvent.setup();

    render(
      <TestWrapper>
        <MessageSearch />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText(/Search messages/);

    await act(async () => {
      await user.type(searchInput, 'medication');
    });

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('pharmacist')).toBeInTheDocument();
      expect(screen.getByText('Patient Consultation')).toBeInTheDocument();
      expect(screen.getByText('1 results found in 45ms')).toBeInTheDocument();
    });
  });

  it('shows and hides advanced filters', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <MessageSearch />
      </TestWrapper>
    );

    const advancedFiltersButton = screen.getByText('Advanced Filters');

    // Advanced filters should be hidden initially
    expect(screen.queryByText('Message Type')).not.toBeInTheDocument();

    await user.click(advancedFiltersButton);

    // Advanced filters should be visible after clicking
    expect(screen.getByText('Message Type')).toBeInTheDocument();
    expect(screen.getByText('Priority')).toBeInTheDocument();
    expect(screen.getByText('Start Date')).toBeInTheDocument();
    expect(screen.getByText('End Date')).toBeInTheDocument();
  });

  it('applies advanced filters correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSearchResults,
    } as Response);

    const user = userEvent.setup();

    render(
      <TestWrapper>
        <MessageSearch />
      </TestWrapper>
    );

    // Open advanced filters
    await user.click(screen.getByText('Advanced Filters'));

    // Set message type filter
    const messageTypeSelect = screen.getByLabelText('Message Type');
    await user.click(messageTypeSelect);
    await user.click(screen.getByText('Clinical Note'));

    // Set priority filter
    const prioritySelect = screen.getByLabelText('Priority');
    await user.click(prioritySelect);
    await user.click(screen.getByText('Urgent'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('type=clinical_note'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('priority=urgent'),
        expect.any(Object)
      );
    });
  });

  it('loads and displays search suggestions', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuggestions,
    } as Response);

    render(
      <TestWrapper>
        <MessageSearch showSuggestions={true} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/communication/search/suggestions',
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer mock-token',
          },
        })
      );
    });
  });

  it('loads and displays saved searches', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSavedSearches,
    } as Response);

    render(
      <TestWrapper>
        <MessageSearch showSavedSearches={true} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/communication/search/saved?type=message&includePublic=true',
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer mock-token',
          },
        })
      );
    });
  });

  it('saves current search', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSearchResults,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: {} }),
      } as Response);

    const user = userEvent.setup();

    render(
      <TestWrapper>
        <MessageSearch />
      </TestWrapper>
    );

    // Perform a search first
    const searchInput = screen.getByPlaceholderText(/Search messages/);
    await act(async () => {
      await user.type(searchInput, 'medication');
    });

    await waitFor(() => {
      expect(screen.getByText('Save Search')).toBeInTheDocument();
    });

    // Click save search
    await user.click(screen.getByText('Save Search'));

    // Fill in save dialog
    const nameInput = screen.getByLabelText('Search Name');
    await user.type(nameInput, 'My Medication Search');

    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/communication/search/save',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer mock-token',
          },
          body: expect.stringContaining('My Medication Search'),
        })
      );
    });
  });

  it('handles search errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Search failed'));

    const user = userEvent.setup();

    render(
      <TestWrapper>
        <MessageSearch />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText(/Search messages/);

    await act(async () => {
      await user.type(searchInput, 'medication');
    });

    await waitFor(() => {
      expect(screen.getByText('Search failed')).toBeInTheDocument();
    });
  });

  it('clears search and filters', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <MessageSearch />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText(/Search messages/);

    // Enter search query
    await act(async () => {
      await user.type(searchInput, 'medication');
    });

    // Open advanced filters and set some
    await user.click(screen.getByText('Advanced Filters'));
    const prioritySelect = screen.getByLabelText('Priority');
    await user.click(prioritySelect);
    await user.click(screen.getByText('Urgent'));

    // Clear all should appear
    await waitFor(() => {
      expect(screen.getByText('Clear All')).toBeInTheDocument();
    });

    // Click clear all
    await user.click(screen.getByText('Clear All'));

    // Search input should be cleared
    expect(searchInput).toHaveValue('');
  });

  it('calls onResultSelect when result is clicked', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSearchResults,
    } as Response);

    const onResultSelect = jest.fn();
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <MessageSearch onResultSelect={onResultSelect} />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText(/Search messages/);

    await act(async () => {
      await user.type(searchInput, 'medication');
    });

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Click on the result
    await user.click(screen.getByText('John Doe'));

    expect(onResultSelect).toHaveBeenCalledWith(mockSearchResults.data[0]);
  });

  it('displays no results message when search returns empty', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [],
        stats: { totalResults: 0, searchTime: 10, facets: {} },
      }),
    } as Response);

    const user = userEvent.setup();

    render(
      <TestWrapper>
        <MessageSearch />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText(/Search messages/);

    await act(async () => {
      await user.type(searchInput, 'nonexistent');
    });

    await waitFor(() => {
      expect(
        screen.getByText('No messages found matching your search criteria')
      ).toBeInTheDocument();
    });
  });

  it('shows loading state during search', async () => {
    // Mock a delayed response
    mockFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => mockSearchResults,
              } as Response),
            100
          )
        )
    );

    const user = userEvent.setup();

    render(
      <TestWrapper>
        <MessageSearch />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText(/Search messages/);

    await act(async () => {
      await user.type(searchInput, 'medication');
    });

    // Should show loading spinner
    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    // Wait for results
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  it('handles search history correctly', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <MessageSearch />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText(/Search messages/);

    // Perform multiple searches
    await act(async () => {
      await user.type(searchInput, 'medication');
      await user.clear(searchInput);
      await user.type(searchInput, 'prescription');
      await user.clear(searchInput);
    });

    // Should show recent searches when input is empty
    await waitFor(() => {
      expect(screen.getByText('Recent Searches')).toBeInTheDocument();
    });
  });
});
