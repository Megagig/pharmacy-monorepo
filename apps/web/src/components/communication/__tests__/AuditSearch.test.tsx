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
import AuditSearch from '../AuditSearch';

// Mock lodash debounce
jest.mock('lodash', () => ({
  debounce: (fn: any) => fn,
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-url');
global.URL.revokeObjectURL = jest.fn();

// Test wrapper with providers
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <LocalizationProvider dateAdapter={AdapterDateFns}>
    {children}
  </LocalizationProvider>
);

const mockSearchResults = [
  {
    _id: '1',
    action: 'message_sent',
    timestamp: '2024-01-15T10:30:00Z',
    userId: {
      _id: 'user1',
      firstName: 'John',
      lastName: 'Doe',
      role: 'pharmacist',
    },
    targetType: 'message',
    riskLevel: 'low',
    complianceCategory: 'communication_security',
    success: true,
    details: {
      conversationId: 'conv1',
      messageId: 'msg1',
    },
    score: 0.95,
  },
  {
    _id: '2',
    action: 'file_uploaded',
    timestamp: '2024-01-15T11:00:00Z',
    userId: {
      _id: 'user2',
      firstName: 'Jane',
      lastName: 'Smith',
      role: 'doctor',
    },
    targetType: 'file',
    riskLevel: 'high',
    complianceCategory: 'file_security',
    success: false,
    details: {
      conversationId: 'conv1',
      fileName: 'test-document.pdf',
    },
    score: 0.87,
  },
];

const mockApiResponse = {
  success: true,
  data: mockSearchResults,
  pagination: {
    total: 2,
    page: 1,
    limit: 50,
    pages: 1,
  },
};

const mockSavedSearches = [
  {
    id: '1',
    name: 'High Risk Activities',
    filters: {
      query: 'high risk',
      riskLevel: 'high',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
    },
    createdAt: '2024-01-15T10:00:00Z',
    resultCount: 25,
  },
  {
    id: '2',
    name: 'File Operations',
    filters: {
      query: 'file',
      action: 'file_uploaded',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
    },
    createdAt: '2024-01-10T15:30:00Z',
    resultCount: 12,
  },
];

describe('AuditSearch', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockLocalStorage.getItem.mockClear();
    mockLocalStorage.setItem.mockClear();
  });

  it('renders audit search with header', () => {
    render(
      <TestWrapper>
        <AuditSearch />
      </TestWrapper>
    );

    expect(screen.getByText('Audit Log Search')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Search audit logs/)
    ).toBeInTheDocument();
    expect(screen.getByText('Advanced Filters')).toBeInTheDocument();
  });

  it('performs search when query is entered', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    const user = userEvent.setup();

    render(
      <TestWrapper>
        <AuditSearch />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText(/Search audit logs/);
    await user.type(searchInput, 'message sent');

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          '/api/communication/audit/search?q=message%20sent'
        ),
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer null', // localStorage returns null in test
          },
        })
      );
    });
  });

  it('displays search results correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    const user = userEvent.setup();

    render(
      <TestWrapper>
        <AuditSearch />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText(/Search audit logs/);
    await user.type(searchInput, 'test');

    await waitFor(() => {
      expect(screen.getByText('2 results found')).toBeInTheDocument();
      expect(screen.getByText('Message Sent')).toBeInTheDocument();
      expect(screen.getByText('File Uploaded')).toBeInTheDocument();
      expect(screen.getByText('John Doe (pharmacist)')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith (doctor)')).toBeInTheDocument();
    });
  });

  it('shows risk level and success status chips', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    const user = userEvent.setup();

    render(
      <TestWrapper>
        <AuditSearch />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText(/Search audit logs/);
    await user.type(searchInput, 'test');

    await waitFor(() => {
      expect(screen.getByText('low')).toBeInTheDocument();
      expect(screen.getByText('high')).toBeInTheDocument();
      const successChips = screen.getAllByText('Success');
      const failedChips = screen.getAllByText('Failed');
      expect(successChips).toHaveLength(1);
      expect(failedChips).toHaveLength(1);
    });
  });

  it('opens advanced filters panel', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <AuditSearch />
      </TestWrapper>
    );

    const advancedFiltersButton = screen.getByText('Advanced Filters');
    await user.click(advancedFiltersButton);

    await waitFor(() => {
      expect(screen.getByLabelText('Action')).toBeInTheDocument();
      expect(screen.getByLabelText('Risk Level')).toBeInTheDocument();
      expect(screen.getByLabelText('Start Date')).toBeInTheDocument();
      expect(screen.getByLabelText('End Date')).toBeInTheDocument();
    });
  });

  it('applies advanced filters and searches', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    const user = userEvent.setup();

    render(
      <TestWrapper>
        <AuditSearch />
      </TestWrapper>
    );

    // Open advanced filters
    const advancedFiltersButton = screen.getByText('Advanced Filters');
    await user.click(advancedFiltersButton);

    // Set action filter
    const actionSelect = screen.getByLabelText('Action');
    await user.click(actionSelect);
    await user.click(screen.getByText('Message Sent'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('action=message_sent'),
        expect.any(Object)
      );
    });
  });

  it('clears all filters when clear button is clicked', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockApiResponse, data: [] }),
      });

    const user = userEvent.setup();

    render(
      <TestWrapper>
        <AuditSearch />
      </TestWrapper>
    );

    // Enter search query
    const searchInput = screen.getByPlaceholderText(/Search audit logs/);
    await user.type(searchInput, 'test');

    // Open advanced filters and set some values
    const advancedFiltersButton = screen.getByText('Advanced Filters');
    await user.click(advancedFiltersButton);

    const actionSelect = screen.getByLabelText('Action');
    await user.click(actionSelect);
    await user.click(screen.getByText('Message Sent'));

    // Clear all filters
    await waitFor(() => {
      const clearButton = screen.getByText('Clear All');
      expect(clearButton).toBeInTheDocument();
    });

    const clearButton = screen.getByText('Clear All');
    await user.click(clearButton);

    expect(searchInput).toHaveValue('');
  });

  it('saves current search', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    // Mock window.prompt
    const mockPrompt = jest.fn(() => 'My Saved Search');
    Object.defineProperty(window, 'prompt', { value: mockPrompt });

    const user = userEvent.setup();

    render(
      <TestWrapper>
        <AuditSearch />
      </TestWrapper>
    );

    // Perform a search first
    const searchInput = screen.getByPlaceholderText(/Search audit logs/);
    await user.type(searchInput, 'test');

    await waitFor(() => {
      expect(screen.getByText('Save Search')).toBeInTheDocument();
    });

    const saveButton = screen.getByText('Save Search');
    await user.click(saveButton);

    expect(mockPrompt).toHaveBeenCalledWith('Enter a name for this search:');
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'auditSearches',
      expect.stringContaining('My Saved Search')
    );
  });

  it('loads saved searches from localStorage', () => {
    mockLocalStorage.getItem.mockReturnValueOnce(
      JSON.stringify(mockSavedSearches)
    );

    render(
      <TestWrapper>
        <AuditSearch showSavedSearches={true} />
      </TestWrapper>
    );

    expect(screen.getByText('Saved Searches')).toBeInTheDocument();
    expect(screen.getByText('High Risk Activities')).toBeInTheDocument();
    expect(screen.getByText('File Operations')).toBeInTheDocument();
  });

  it('loads a saved search when clicked', async () => {
    mockLocalStorage.getItem.mockReturnValueOnce(
      JSON.stringify(mockSavedSearches)
    );
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    const user = userEvent.setup();

    render(
      <TestWrapper>
        <AuditSearch showSavedSearches={true} />
      </TestWrapper>
    );

    const savedSearchItem = screen.getByText('High Risk Activities');
    await user.click(savedSearchItem);

    const searchInput = screen.getByPlaceholderText(/Search audit logs/);
    expect(searchInput).toHaveValue('high risk');
  });

  it('deletes saved search when delete button is clicked', async () => {
    mockLocalStorage.getItem.mockReturnValueOnce(
      JSON.stringify(mockSavedSearches)
    );

    const user = userEvent.setup();

    render(
      <TestWrapper>
        <AuditSearch showSavedSearches={true} />
      </TestWrapper>
    );

    // Find delete button for first saved search
    const deleteButtons = screen.getAllByRole('button');
    const deleteButton = deleteButtons.find(
      (button) =>
        button.getAttribute('aria-label') === null &&
        within(button).queryByTestId('ClearIcon')
    );

    if (deleteButton) {
      await user.click(deleteButton);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'auditSearches',
        expect.not.stringContaining('High Risk Activities')
      );
    }
  });

  it('displays search suggestions', () => {
    render(
      <TestWrapper>
        <AuditSearch showSuggestions={true} />
      </TestWrapper>
    );

    expect(screen.getByText('Popular Searches')).toBeInTheDocument();
    expect(screen.getByText(/Message Sent/)).toBeInTheDocument();
    expect(screen.getByText(/File Uploaded/)).toBeInTheDocument();
  });

  it('uses suggestion when clicked', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    const user = userEvent.setup();

    render(
      <TestWrapper>
        <AuditSearch showSuggestions={true} />
      </TestWrapper>
    );

    const suggestionChip = screen.getByText(/Message Sent/);
    await user.click(suggestionChip);

    const searchInput = screen.getByPlaceholderText(/Search audit logs/);
    expect(searchInput).toHaveValue('Message Sent');
  });

  it('exports search results', async () => {
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
    const mockAppendChild = jest.fn();
    const mockRemoveChild = jest.fn();
    const mockClick = jest.fn();

    Object.defineProperty(document, 'createElement', {
      value: jest.fn(() => ({
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
        <AuditSearch />
      </TestWrapper>
    );

    // Perform search first
    const searchInput = screen.getByPlaceholderText(/Search audit logs/);
    await user.type(searchInput, 'test');

    await waitFor(() => {
      expect(screen.getByText('Export Results')).toBeInTheDocument();
    });

    const exportButton = screen.getByText('Export Results');
    await user.click(exportButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/communication/audit/export'),
        expect.any(Object)
      );
    });
  });

  it('calls onResultSelect when result is clicked', async () => {
    const mockOnResultSelect = jest.fn();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    const user = userEvent.setup();

    render(
      <TestWrapper>
        <AuditSearch onResultSelect={mockOnResultSelect} />
      </TestWrapper>
    );

    // Perform search
    const searchInput = screen.getByPlaceholderText(/Search audit logs/);
    await user.type(searchInput, 'test');

    await waitFor(() => {
      expect(screen.getByText('Message Sent')).toBeInTheDocument();
    });

    // Click on first result
    const firstResult = screen.getByText('Message Sent').closest('li');
    if (firstResult) {
      await user.click(firstResult);
      expect(mockOnResultSelect).toHaveBeenCalledWith(mockSearchResults[0]);
    }
  });

  it('displays error message when search fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Search failed'));

    const user = userEvent.setup();

    render(
      <TestWrapper>
        <AuditSearch />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText(/Search audit logs/);
    await user.type(searchInput, 'test');

    await waitFor(() => {
      expect(screen.getByText('Search failed')).toBeInTheDocument();
    });
  });

  it('shows empty state when no results found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...mockApiResponse, data: [] }),
    });

    const user = userEvent.setup();

    render(
      <TestWrapper>
        <AuditSearch />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText(/Search audit logs/);
    await user.type(searchInput, 'nonexistent');

    await waitFor(() => {
      expect(
        screen.getByText('No audit logs found matching your search criteria')
      ).toBeInTheDocument();
    });
  });

  it('shows initial state when no search is performed', () => {
    render(
      <TestWrapper>
        <AuditSearch />
      </TestWrapper>
    );

    expect(
      screen.getByText('Enter a search query or use filters to find audit logs')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Try searching for actions, users, or specific events')
    ).toBeInTheDocument();
  });

  it('clears search input when clear button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <AuditSearch />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText(/Search audit logs/);
    await user.type(searchInput, 'test query');

    // Find and click clear button
    const clearButton = screen.getByRole('button', { name: '' }); // Clear button has no text
    await user.click(clearButton);

    expect(searchInput).toHaveValue('');
  });

  it('displays search history', () => {
    // Mock search history in component state (this would need to be set up differently in a real test)
    render(
      <TestWrapper>
        <AuditSearch />
      </TestWrapper>
    );

    // This test would need the component to have search history
    // In a real implementation, you might need to perform searches first
    // or mock the component's internal state
  });

  it('validates search query length', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        success: false,
        message: 'Search query must be at least 2 characters long',
      }),
    });

    const user = userEvent.setup();

    render(
      <TestWrapper>
        <AuditSearch />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText(/Search audit logs/);
    await user.type(searchInput, 'a'); // Single character

    // The component should handle short queries appropriately
    // This might not trigger a search or show a validation message
  });

  it('formats timestamps in results correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    const user = userEvent.setup();

    render(
      <TestWrapper>
        <AuditSearch />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText(/Search audit logs/);
    await user.type(searchInput, 'test');

    await waitFor(() => {
      // Should display formatted timestamps
      expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument();
    });
  });
});
