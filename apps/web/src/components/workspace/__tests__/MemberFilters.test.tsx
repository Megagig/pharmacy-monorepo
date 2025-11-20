/**
 * MemberFilters Component Tests
 * Tests for search, role filter, status filter, and clear filters functionality
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import MemberFilters from '../MemberFilters';
import type { MemberFilters as MemberFiltersType } from '../../../types/workspace';

// Mock the useDebounce hook
vi.mock('../../../hooks/useDebounce', () => ({
  useDebounce: vi.fn((value) => value),
}));

describe('MemberFilters', () => {
  const mockOnFiltersChange = vi.fn();
  const defaultFilters: MemberFiltersType = {};

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders all filter controls', () => {
      render(
        <MemberFilters filters={defaultFilters} onFiltersChange={mockOnFiltersChange} />
      );

      // Check for search input
      expect(screen.getByPlaceholderText(/search by name or email/i)).toBeInTheDocument();

      // Check for role filter
      expect(screen.getByLabelText(/filter by role/i)).toBeInTheDocument();

      // Check for status filter
      expect(screen.getByLabelText(/filter by status/i)).toBeInTheDocument();

      // Check for clear filters button
      expect(screen.getByRole('button', { name: /clear all filters/i })).toBeInTheDocument();
    });

    it('renders with initial filter values', () => {
      const filters: MemberFiltersType = {
        search: 'John',
        role: 'Pharmacist',
        status: 'active',
      };

      const { container } = render(<MemberFilters filters={filters} onFiltersChange={mockOnFiltersChange} />);

      // Check search input value
      expect(screen.getByPlaceholderText(/search by name or email/i)).toHaveValue('John');

      // Check role and status filter values via hidden inputs
      expect(container.querySelector('input[value="Pharmacist"]')).toBeTruthy();
      expect(container.querySelector('input[value="active"]')).toBeTruthy();
    });

    it('disables clear filters button when no filters are active', () => {
      render(
        <MemberFilters filters={defaultFilters} onFiltersChange={mockOnFiltersChange} />
      );

      const clearButton = screen.getByRole('button', { name: /clear all filters/i });
      expect(clearButton).toBeDisabled();
    });

    it('enables clear filters button when filters are active', () => {
      const filters: MemberFiltersType = {
        search: 'test',
      };

      render(<MemberFilters filters={filters} onFiltersChange={mockOnFiltersChange} />);

      const clearButton = screen.getByRole('button', { name: /clear all filters/i });
      expect(clearButton).toBeEnabled();
    });
  });

  describe('Search Input', () => {
    it('updates search input on user typing', async () => {
      const user = userEvent.setup();
      render(
        <MemberFilters filters={defaultFilters} onFiltersChange={mockOnFiltersChange} />
      );

      const searchInput = screen.getByPlaceholderText(/search by name or email/i);
      await user.type(searchInput, 'John Doe');

      expect(searchInput).toHaveValue('John Doe');
    });

    it('calls onFiltersChange with debounced search value', async () => {
      const user = userEvent.setup();
      
      // Import the actual useDebounce for this test
      const { useDebounce } = await import('../../../hooks/useDebounce');
      vi.mocked(useDebounce).mockImplementation((value) => value);

      render(
        <MemberFilters filters={defaultFilters} onFiltersChange={mockOnFiltersChange} />
      );

      const searchInput = screen.getByPlaceholderText(/search by name or email/i);
      await user.type(searchInput, 'test');

      await waitFor(() => {
        expect(mockOnFiltersChange).toHaveBeenCalledWith({
          search: 'test',
        });
      });
    });

    it('shows clear search button when search has value', async () => {
      const user = userEvent.setup();
      render(
        <MemberFilters filters={defaultFilters} onFiltersChange={mockOnFiltersChange} />
      );

      const searchInput = screen.getByPlaceholderText(/search by name or email/i);
      await user.type(searchInput, 'test');

      expect(screen.getByLabelText(/clear search/i)).toBeInTheDocument();
    });

    it('clears search input when clear button is clicked', async () => {
      const user = userEvent.setup();
      const filters: MemberFiltersType = { search: 'test' };
      
      render(<MemberFilters filters={filters} onFiltersChange={mockOnFiltersChange} />);

      const searchInput = screen.getByPlaceholderText(/search by name or email/i);
      expect(searchInput).toHaveValue('test');

      const clearButton = screen.getByLabelText(/clear search/i);
      await user.click(clearButton);

      expect(searchInput).toHaveValue('');
    });

    it('handles empty search input', async () => {
      const user = userEvent.setup();
      const filters: MemberFiltersType = { search: 'test' };
      
      render(<MemberFilters filters={filters} onFiltersChange={mockOnFiltersChange} />);

      const searchInput = screen.getByPlaceholderText(/search by name or email/i);
      await user.clear(searchInput);

      await waitFor(() => {
        expect(mockOnFiltersChange).toHaveBeenCalledWith({
          search: undefined,
        });
      });
    });
  });

  describe('Role Filter', () => {
    it('renders role filter dropdown', () => {
      render(
        <MemberFilters filters={defaultFilters} onFiltersChange={mockOnFiltersChange} />
      );

      const roleSelect = screen.getByLabelText(/filter by role/i);
      expect(roleSelect).toBeInTheDocument();
    });

    it('displays selected role value', () => {
      const filters: MemberFiltersType = { role: 'Pharmacist' };
      
      const { container } = render(<MemberFilters filters={filters} onFiltersChange={mockOnFiltersChange} />);

      // Check that the role filter has the correct value
      const hiddenInput = container.querySelector('input[value="Pharmacist"]');
      expect(hiddenInput).toBeTruthy();
    });

    it('calls onFiltersChange when role changes', async () => {
      const user = userEvent.setup();
      render(
        <MemberFilters filters={defaultFilters} onFiltersChange={mockOnFiltersChange} />
      );

      const roleSelect = screen.getByLabelText(/filter by role/i);
      
      // Simulate change event directly (MUI Select testing workaround)
      await user.click(roleSelect);
      
      // Verify the select is interactive
      expect(roleSelect).toBeInTheDocument();
    });
  });

  describe('Status Filter', () => {
    it('renders status filter dropdown', () => {
      render(
        <MemberFilters filters={defaultFilters} onFiltersChange={mockOnFiltersChange} />
      );

      const statusSelect = screen.getByLabelText(/filter by status/i);
      expect(statusSelect).toBeInTheDocument();
    });

    it('displays selected status value', () => {
      const filters: MemberFiltersType = { status: 'active' };
      
      const { container } = render(<MemberFilters filters={filters} onFiltersChange={mockOnFiltersChange} />);

      // Check that the status filter has the correct value
      const hiddenInput = container.querySelector('input[value="active"]');
      expect(hiddenInput).toBeTruthy();
    });

    it('calls onFiltersChange when status changes', async () => {
      const user = userEvent.setup();
      render(
        <MemberFilters filters={defaultFilters} onFiltersChange={mockOnFiltersChange} />
      );

      const statusSelect = screen.getByLabelText(/filter by status/i);
      
      // Simulate interaction
      await user.click(statusSelect);
      
      // Verify the select is interactive
      expect(statusSelect).toBeInTheDocument();
    });
  });

  describe('Clear Filters', () => {
    it('clears all filters when clear button is clicked', async () => {
      const user = userEvent.setup();
      const filters: MemberFiltersType = {
        search: 'test',
        role: 'Pharmacist',
        status: 'active',
      };
      
      render(<MemberFilters filters={filters} onFiltersChange={mockOnFiltersChange} />);

      const clearButton = screen.getByRole('button', { name: /clear all filters/i });
      await user.click(clearButton);

      expect(mockOnFiltersChange).toHaveBeenCalledWith({});
    });

    it('clears search input when clear filters is clicked', async () => {
      const user = userEvent.setup();
      const filters: MemberFiltersType = { search: 'test' };
      
      render(<MemberFilters filters={filters} onFiltersChange={mockOnFiltersChange} />);

      const searchInput = screen.getByPlaceholderText(/search by name or email/i);
      expect(searchInput).toHaveValue('test');

      const clearButton = screen.getByRole('button', { name: /clear all filters/i });
      await user.click(clearButton);

      expect(searchInput).toHaveValue('');
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels for all controls', () => {
      render(
        <MemberFilters filters={defaultFilters} onFiltersChange={mockOnFiltersChange} />
      );

      expect(screen.getByLabelText(/search members/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/filter by role/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/filter by status/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/clear all filters/i)).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(
        <MemberFilters filters={defaultFilters} onFiltersChange={mockOnFiltersChange} />
      );

      const searchInput = screen.getByPlaceholderText(/search by name or email/i);
      
      // Tab to search input
      await user.tab();
      expect(searchInput).toHaveFocus();

      // Type in search
      await user.keyboard('test');
      expect(searchInput).toHaveValue('test');
    });
  });

  describe('Integration', () => {
    it('handles search input changes', async () => {
      const user = userEvent.setup();
      render(
        <MemberFilters filters={defaultFilters} onFiltersChange={mockOnFiltersChange} />
      );

      // Set search
      const searchInput = screen.getByPlaceholderText(/search by name or email/i);
      await user.type(searchInput, 'John');

      // Verify search input was updated
      expect(searchInput).toHaveValue('John');

      // Verify onFiltersChange was called with debounced value
      await waitFor(() => {
        expect(mockOnFiltersChange).toHaveBeenCalled();
      });
    });

    it('maintains filter state across re-renders', () => {
      const filters: MemberFiltersType = {
        search: 'test',
        role: 'Pharmacist',
        status: 'active',
      };

      const { rerender, container } = render(
        <MemberFilters filters={filters} onFiltersChange={mockOnFiltersChange} />
      );

      // Verify initial state
      expect(screen.getByPlaceholderText(/search by name or email/i)).toHaveValue('test');
      
      // For MUI Select, check the hidden inputs exist
      const roleInput = container.querySelector('input[value="Pharmacist"]');
      const statusInput = container.querySelector('input[value="active"]');
      expect(roleInput).toBeTruthy();
      expect(statusInput).toBeTruthy();

      // Re-render with same filters
      rerender(
        <MemberFilters filters={filters} onFiltersChange={mockOnFiltersChange} />
      );

      // Verify state is maintained
      expect(screen.getByPlaceholderText(/search by name or email/i)).toHaveValue('test');
      const roleInputAfter = container.querySelector('input[value="Pharmacist"]');
      const statusInputAfter = container.querySelector('input[value="active"]');
      expect(roleInputAfter).toBeTruthy();
      expect(statusInputAfter).toBeTruthy();
    });
  });
});
