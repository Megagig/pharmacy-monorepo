import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { vi } from 'vitest';
import WorkspaceSearch from '../WorkspaceSearch';

const theme = createTheme();

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

const mockWorkspaces = [
  {
    _id: 'workspace1',
    name: 'City Pharmacy',
    address: '123 Main St, Lagos',
    phone: '+234-801-234-5678',
    email: 'info@citypharmacy.com',
    isActive: true,
  },
  {
    _id: 'workspace2',
    name: 'Health Plus Pharmacy',
    address: '456 Victoria Island, Lagos',
    phone: '+234-802-345-6789',
    email: 'contact@healthplus.com',
    isActive: true,
  },
];

// Mock fetch
global.fetch = vi.fn();

describe('WorkspaceSearch', () => {
  const mockOnWorkspaceSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ workspaces: mockWorkspaces }),
    });
  });

  it('renders search input and initial state', () => {
    renderWithProviders(
      <WorkspaceSearch onWorkspaceSelect={mockOnWorkspaceSelect} />
    );

    expect(screen.getByPlaceholderText('Search for your pharmacy...')).toBeInTheDocument();
    expect(screen.getByText('Find Your Pharmacy')).toBeInTheDocument();
    expect(screen.getByText('Search for your pharmacy by name, location, or contact information')).toBeInTheDocument();
  });

  it('shows loading state during search', async () => {
    (global.fetch as any).mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: async () => ({ workspaces: mockWorkspaces }),
      }), 100))
    );

    renderWithProviders(
      <WorkspaceSearch onWorkspaceSelect={mockOnWorkspaceSelect} />
    );

    const searchInput = screen.getByPlaceholderText('Search for your pharmacy...');
    fireEvent.change(searchInput, { target: { value: 'City' } });

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('displays search results', async () => {
    renderWithProviders(
      <WorkspaceSearch onWorkspaceSelect={mockOnWorkspaceSelect} />
    );

    const searchInput = screen.getByPlaceholderText('Search for your pharmacy...');
    fireEvent.change(searchInput, { target: { value: 'City' } });

    await waitFor(() => {
      expect(screen.getByText('City Pharmacy')).toBeInTheDocument();
      expect(screen.getByText('123 Main St, Lagos')).toBeInTheDocument();
      expect(screen.getByText('+234-801-234-5678')).toBeInTheDocument();
    });
  });

  it('handles workspace selection', async () => {
    renderWithProviders(
      <WorkspaceSearch onWorkspaceSelect={mockOnWorkspaceSelect} />
    );

    const searchInput = screen.getByPlaceholderText('Search for your pharmacy...');
    fireEvent.change(searchInput, { target: { value: 'City' } });

    await waitFor(() => {
      expect(screen.getByText('City Pharmacy')).toBeInTheDocument();
    });

    const selectButton = screen.getByRole('button', { name: /select city pharmacy/i });
    fireEvent.click(selectButton);

    expect(mockOnWorkspaceSelect).toHaveBeenCalledWith(mockWorkspaces[0]);
  });

  it('shows no results message when no workspaces found', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ workspaces: [] }),
    });

    renderWithProviders(
      <WorkspaceSearch onWorkspaceSelect={mockOnWorkspaceSelect} />
    );

    const searchInput = screen.getByPlaceholderText('Search for your pharmacy...');
    fireEvent.change(searchInput, { target: { value: 'NonExistent' } });

    await waitFor(() => {
      expect(screen.getByText('No pharmacies found')).toBeInTheDocument();
      expect(screen.getByText('Try adjusting your search terms or contact us for assistance.')).toBeInTheDocument();
    });
  });

  it('handles search error', async () => {
    (global.fetch as any).mockRejectedValue(new Error('Network error'));

    renderWithProviders(
      <WorkspaceSearch onWorkspaceSelect={mockOnWorkspaceSelect} />
    );

    const searchInput = screen.getByPlaceholderText('Search for your pharmacy...');
    fireEvent.change(searchInput, { target: { value: 'City' } });

    await waitFor(() => {
      expect(screen.getByText('Error searching pharmacies')).toBeInTheDocument();
      expect(screen.getByText('Please try again or contact support if the problem persists.')).toBeInTheDocument();
    });
  });

  it('debounces search input', async () => {
    renderWithProviders(
      <WorkspaceSearch onWorkspaceSelect={mockOnWorkspaceSelect} />
    );

    const searchInput = screen.getByPlaceholderText('Search for your pharmacy...');
    
    // Type multiple characters quickly
    fireEvent.change(searchInput, { target: { value: 'C' } });
    fireEvent.change(searchInput, { target: { value: 'Ci' } });
    fireEvent.change(searchInput, { target: { value: 'Cit' } });
    fireEvent.change(searchInput, { target: { value: 'City' } });

    // Should only make one API call after debounce
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  it('clears results when search is cleared', async () => {
    renderWithProviders(
      <WorkspaceSearch onWorkspaceSelect={mockOnWorkspaceSelect} />
    );

    const searchInput = screen.getByPlaceholderText('Search for your pharmacy...');
    fireEvent.change(searchInput, { target: { value: 'City' } });

    await waitFor(() => {
      expect(screen.getByText('City Pharmacy')).toBeInTheDocument();
    });

    fireEvent.change(searchInput, { target: { value: '' } });

    expect(screen.queryByText('City Pharmacy')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = renderWithProviders(
      <WorkspaceSearch 
        onWorkspaceSelect={mockOnWorkspaceSelect} 
        className="custom-class"
      />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('shows contact information for each workspace', async () => {
    renderWithProviders(
      <WorkspaceSearch onWorkspaceSelect={mockOnWorkspaceSelect} />
    );

    const searchInput = screen.getByPlaceholderText('Search for your pharmacy...');
    fireEvent.change(searchInput, { target: { value: 'pharmacy' } });

    await waitFor(() => {
      expect(screen.getByText('City Pharmacy')).toBeInTheDocument();
      expect(screen.getByText('Health Plus Pharmacy')).toBeInTheDocument();
    });

    // Check contact information is displayed
    expect(screen.getByText('+234-801-234-5678')).toBeInTheDocument();
    expect(screen.getByText('+234-802-345-6789')).toBeInTheDocument();
    expect(screen.getByText('info@citypharmacy.com')).toBeInTheDocument();
    expect(screen.getByText('contact@healthplus.com')).toBeInTheDocument();
  });

  it('handles keyboard navigation', async () => {
    renderWithProviders(
      <WorkspaceSearch onWorkspaceSelect={mockOnWorkspaceSelect} />
    );

    const searchInput = screen.getByPlaceholderText('Search for your pharmacy...');
    fireEvent.change(searchInput, { target: { value: 'pharmacy' } });

    await waitFor(() => {
      expect(screen.getByText('City Pharmacy')).toBeInTheDocument();
    });

    // Test Enter key on search input
    fireEvent.keyDown(searchInput, { key: 'Enter' });
    
    // Should focus first result
    const firstResult = screen.getByRole('button', { name: /select city pharmacy/i });
    expect(firstResult).toBeInTheDocument();
  });

  it('shows minimum search length message', () => {
    renderWithProviders(
      <WorkspaceSearch onWorkspaceSelect={mockOnWorkspaceSelect} />
    );

    const searchInput = screen.getByPlaceholderText('Search for your pharmacy...');
    fireEvent.change(searchInput, { target: { value: 'C' } });

    expect(screen.getByText('Please enter at least 2 characters to search')).toBeInTheDocument();
  });

  it('handles API response without workspaces array', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    renderWithProviders(
      <WorkspaceSearch onWorkspaceSelect={mockOnWorkspaceSelect} />
    );

    const searchInput = screen.getByPlaceholderText('Search for your pharmacy...');
    fireEvent.change(searchInput, { target: { value: 'City' } });

    await waitFor(() => {
      expect(screen.getByText('No pharmacies found')).toBeInTheDocument();
    });
  });

  it('handles non-ok API response', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
    });

    renderWithProviders(
      <WorkspaceSearch onWorkspaceSelect={mockOnWorkspaceSelect} />
    );

    const searchInput = screen.getByPlaceholderText('Search for your pharmacy...');
    fireEvent.change(searchInput, { target: { value: 'City' } });

    await waitFor(() => {
      expect(screen.getByText('Error searching pharmacies')).toBeInTheDocument();
    });
  });
});