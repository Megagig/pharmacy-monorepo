/**
 * AuditTrail Component Tests
 * Tests for the AuditTrail component
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import AuditTrail from './AuditTrail';
import * as useWorkspaceTeamHooks from '../../queries/useWorkspaceTeam';
import type { GetAuditLogsResponse, WorkspaceAuditLog } from '../../types/workspace';

// Mock the hooks
vi.mock('../../queries/useWorkspaceTeam');

// Mock data
const mockAuditLogs: WorkspaceAuditLog[] = [
  {
    _id: 'log1',
    workplaceId: 'workplace1',
    actorId: {
      _id: 'user1',
      firstName: 'John',
      lastName: 'Doe',
    },
    targetId: {
      _id: 'user2',
      firstName: 'Jane',
      lastName: 'Smith',
    },
    action: 'role_changed',
    category: 'role',
    details: {
      before: 'Staff',
      after: 'Pharmacist',
      reason: 'Promotion',
    },
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    timestamp: new Date('2025-01-15T10:30:00Z'),
    severity: 'medium',
  },
  {
    _id: 'log2',
    workplaceId: 'workplace1',
    actorId: {
      _id: 'user1',
      firstName: 'John',
      lastName: 'Doe',
    },
    targetId: {
      _id: 'user3',
      firstName: 'Bob',
      lastName: 'Johnson',
    },
    action: 'member_suspended',
    category: 'member',
    details: {
      reason: 'Policy violation',
    },
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    timestamp: new Date('2025-01-15T11:00:00Z'),
    severity: 'high',
  },
  {
    _id: 'log3',
    workplaceId: 'workplace1',
    actorId: {
      _id: 'user1',
      firstName: 'John',
      lastName: 'Doe',
    },
    action: 'invite_generated',
    category: 'invite',
    details: {
      metadata: {
        email: 'newuser@example.com',
        role: 'Staff',
      },
    },
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    timestamp: new Date('2025-01-15T12:00:00Z'),
    severity: 'low',
  },
];

const mockAuditLogsResponse: GetAuditLogsResponse = {
  logs: mockAuditLogs,
  pagination: {
    page: 1,
    limit: 20,
    total: 3,
    totalPages: 1,
  },
};

// Helper function to create a test query client
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

// Helper function to render with providers
const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
};

describe('AuditTrail Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render loading state initially', () => {
      vi.spyOn(useWorkspaceTeamHooks, 'useAuditLogs').mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as any);

      vi.spyOn(useWorkspaceTeamHooks, 'useExportAuditLogs').mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as any);

      renderWithProviders(<AuditTrail />);

      // Should show skeleton loaders
      expect(screen.getAllByRole('row')).toHaveLength(6); // Header + 5 skeleton rows
    });

    it('should render audit logs table with data', async () => {
      vi.spyOn(useWorkspaceTeamHooks, 'useAuditLogs').mockReturnValue({
        data: mockAuditLogsResponse,
        isLoading: false,
        error: null,
      } as any);

      vi.spyOn(useWorkspaceTeamHooks, 'useExportAuditLogs').mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as any);

      renderWithProviders(<AuditTrail />);

      await waitFor(() => {
        expect(screen.getAllByText(/John Doe/)).toHaveLength(3); // Actor appears 3 times
      });

      // Check table headers (use role to find specific elements)
      expect(screen.getByText('Timestamp')).toBeInTheDocument();
      expect(screen.getByText('Actor')).toBeInTheDocument();
      const categoryElements = screen.getAllByText('Category');
      expect(categoryElements.length).toBeGreaterThan(0); // Filter label + table header
      expect(screen.getAllByText('Action').length).toBeGreaterThan(0);
      expect(screen.getByText('Target')).toBeInTheDocument();
      expect(screen.getByText('Severity')).toBeInTheDocument();

      // Check audit log data
      expect(screen.getByText('Role Changed')).toBeInTheDocument();
      expect(screen.getByText('Member Suspended')).toBeInTheDocument();
      expect(screen.getByText('Invite Generated')).toBeInTheDocument();
    });

    it('should render empty state when no logs', async () => {
      vi.spyOn(useWorkspaceTeamHooks, 'useAuditLogs').mockReturnValue({
        data: { logs: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } },
        isLoading: false,
        error: null,
      } as any);

      vi.spyOn(useWorkspaceTeamHooks, 'useExportAuditLogs').mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as any);

      renderWithProviders(<AuditTrail />);

      await waitFor(() => {
        expect(screen.getByText('No audit logs found')).toBeInTheDocument();
      });

      expect(
        screen.getByText(
          'Audit logs will appear here as actions are performed in your workspace.'
        )
      ).toBeInTheDocument();
    });

    it('should render error state', async () => {
      const errorMessage = 'Failed to fetch audit logs';
      vi.spyOn(useWorkspaceTeamHooks, 'useAuditLogs').mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error(errorMessage),
      } as any);

      vi.spyOn(useWorkspaceTeamHooks, 'useExportAuditLogs').mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as any);

      renderWithProviders(<AuditTrail />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load audit logs')).toBeInTheDocument();
      });

      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  describe('Filters', () => {
    it('should render filter controls', () => {
      vi.spyOn(useWorkspaceTeamHooks, 'useAuditLogs').mockReturnValue({
        data: mockAuditLogsResponse,
        isLoading: false,
        error: null,
      } as any);

      vi.spyOn(useWorkspaceTeamHooks, 'useExportAuditLogs').mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as any);

      renderWithProviders(<AuditTrail />);

      expect(screen.getByLabelText('Start Date')).toBeInTheDocument();
      expect(screen.getByLabelText('End Date')).toBeInTheDocument();
      expect(screen.getByLabelText('Category')).toBeInTheDocument();
      expect(screen.getByLabelText('Action')).toBeInTheDocument();
      expect(screen.getByText('Clear')).toBeInTheDocument();
    });

    it('should update filters when date range is changed', async () => {
      const user = userEvent.setup();
      const mockUseAuditLogs = vi.fn().mockReturnValue({
        data: mockAuditLogsResponse,
        isLoading: false,
        error: null,
      });

      vi.spyOn(useWorkspaceTeamHooks, 'useAuditLogs').mockImplementation(mockUseAuditLogs);

      vi.spyOn(useWorkspaceTeamHooks, 'useExportAuditLogs').mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as any);

      renderWithProviders(<AuditTrail />);

      const startDateInput = screen.getByLabelText('Start Date');
      await user.type(startDateInput, '2025-01-01');

      await waitFor(() => {
        expect(mockUseAuditLogs).toHaveBeenCalledWith(
          expect.objectContaining({ startDate: '2025-01-01' }),
          expect.any(Object)
        );
      });
    });

    it('should update filters when category is changed', async () => {
      const user = userEvent.setup();
      const mockUseAuditLogs = vi.fn().mockReturnValue({
        data: mockAuditLogsResponse,
        isLoading: false,
        error: null,
      });

      vi.spyOn(useWorkspaceTeamHooks, 'useAuditLogs').mockImplementation(mockUseAuditLogs);

      vi.spyOn(useWorkspaceTeamHooks, 'useExportAuditLogs').mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as any);

      renderWithProviders(<AuditTrail />);

      const categorySelect = screen.getByLabelText('Category');
      await user.click(categorySelect);

      const memberOption = await screen.findByText('Member');
      await user.click(memberOption);

      await waitFor(() => {
        expect(mockUseAuditLogs).toHaveBeenCalledWith(
          expect.objectContaining({ category: 'member' }),
          expect.any(Object)
        );
      });
    });

    it('should clear all filters when Clear button is clicked', async () => {
      const user = userEvent.setup();
      const mockUseAuditLogs = vi.fn().mockReturnValue({
        data: mockAuditLogsResponse,
        isLoading: false,
        error: null,
      });

      vi.spyOn(useWorkspaceTeamHooks, 'useAuditLogs').mockImplementation(mockUseAuditLogs);

      vi.spyOn(useWorkspaceTeamHooks, 'useExportAuditLogs').mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as any);

      renderWithProviders(<AuditTrail initialFilters={{ category: 'member' }} />);

      const clearButton = screen.getByText('Clear');
      await user.click(clearButton);

      await waitFor(() => {
        expect(mockUseAuditLogs).toHaveBeenCalledWith({}, expect.any(Object));
      });
    });
  });

  describe('Audit Log Details', () => {
    it('should expand and show details when row is clicked', async () => {
      const user = userEvent.setup();

      vi.spyOn(useWorkspaceTeamHooks, 'useAuditLogs').mockReturnValue({
        data: mockAuditLogsResponse,
        isLoading: false,
        error: null,
      } as any);

      vi.spyOn(useWorkspaceTeamHooks, 'useExportAuditLogs').mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as any);

      renderWithProviders(<AuditTrail />);

      await waitFor(() => {
        expect(screen.getByText('Role Changed')).toBeInTheDocument();
      });

      // Click on the first row to expand
      const firstRow = screen.getByText('Role Changed').closest('tr');
      expect(firstRow).toBeInTheDocument();
      
      if (firstRow) {
        await user.click(firstRow);
      }

      // Check if details are shown (use getAllByText since "Details" appears in header too)
      await waitFor(() => {
        const detailsElements = screen.getAllByText('Details');
        expect(detailsElements.length).toBeGreaterThan(1); // Header + expanded section
        expect(screen.getByText('Before:')).toBeInTheDocument();
        expect(screen.getByText('After:')).toBeInTheDocument();
        expect(screen.getByText('Reason:')).toBeInTheDocument();
        expect(screen.getByText('Promotion')).toBeInTheDocument();
      });
    });

    it('should show IP address and user agent in details', async () => {
      const user = userEvent.setup();

      vi.spyOn(useWorkspaceTeamHooks, 'useAuditLogs').mockReturnValue({
        data: mockAuditLogsResponse,
        isLoading: false,
        error: null,
      } as any);

      vi.spyOn(useWorkspaceTeamHooks, 'useExportAuditLogs').mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as any);

      renderWithProviders(<AuditTrail />);

      await waitFor(() => {
        expect(screen.getByText('Role Changed')).toBeInTheDocument();
      });

      const firstRow = screen.getByText('Role Changed').closest('tr');
      if (firstRow) {
        await user.click(firstRow);
      }

      await waitFor(() => {
        expect(screen.getByText('IP Address:')).toBeInTheDocument();
        expect(screen.getByText('192.168.1.1')).toBeInTheDocument();
        expect(screen.getByText('User Agent:')).toBeInTheDocument();
        expect(screen.getByText('Mozilla/5.0')).toBeInTheDocument();
      });
    });

    it('should collapse details when row is clicked again', async () => {
      const user = userEvent.setup();

      vi.spyOn(useWorkspaceTeamHooks, 'useAuditLogs').mockReturnValue({
        data: mockAuditLogsResponse,
        isLoading: false,
        error: null,
      } as any);

      vi.spyOn(useWorkspaceTeamHooks, 'useExportAuditLogs').mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as any);

      renderWithProviders(<AuditTrail />);

      await waitFor(() => {
        expect(screen.getByText('Role Changed')).toBeInTheDocument();
      });

      const firstRow = screen.getByText('Role Changed').closest('tr');
      
      // Expand
      if (firstRow) {
        await user.click(firstRow);
      }

      await waitFor(() => {
        const detailsElements = screen.getAllByText('Details');
        expect(detailsElements.length).toBeGreaterThan(1); // Header + expanded section
      });

      // Collapse
      if (firstRow) {
        await user.click(firstRow);
      }

      await waitFor(() => {
        // After collapse, only the header "Details" should remain
        const detailsElements = screen.getAllByText('Details');
        expect(detailsElements.length).toBe(1); // Only header
      });
    });
  });

  describe('Pagination', () => {
    it('should render pagination controls', () => {
      vi.spyOn(useWorkspaceTeamHooks, 'useAuditLogs').mockReturnValue({
        data: mockAuditLogsResponse,
        isLoading: false,
        error: null,
      } as any);

      vi.spyOn(useWorkspaceTeamHooks, 'useExportAuditLogs').mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as any);

      renderWithProviders(<AuditTrail />);

      expect(screen.getByText('Rows per page:')).toBeInTheDocument();
    });

    it('should change page when pagination is used', async () => {
      const user = userEvent.setup();
      const mockUseAuditLogs = vi.fn().mockReturnValue({
        data: {
          logs: mockAuditLogs,
          pagination: {
            page: 1,
            limit: 20,
            total: 50,
            totalPages: 3,
          },
        },
        isLoading: false,
        error: null,
      });

      vi.spyOn(useWorkspaceTeamHooks, 'useAuditLogs').mockImplementation(mockUseAuditLogs);

      vi.spyOn(useWorkspaceTeamHooks, 'useExportAuditLogs').mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as any);

      renderWithProviders(<AuditTrail />);

      const nextPageButton = screen.getByRole('button', { name: /next page/i });
      await user.click(nextPageButton);

      await waitFor(() => {
        expect(mockUseAuditLogs).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({ page: 2 })
        );
      });
    });
  });

  describe('Export Functionality', () => {
    beforeEach(() => {
      // Mock URL.createObjectURL and related methods
      global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = vi.fn();
    });

    it('should export audit logs when export button is clicked', async () => {
      const user = userEvent.setup();
      const mockBlob = new Blob(['csv data'], { type: 'text/csv' });
      const mockMutateAsync = vi.fn().mockResolvedValue(mockBlob);

      vi.spyOn(useWorkspaceTeamHooks, 'useAuditLogs').mockReturnValue({
        data: mockAuditLogsResponse,
        isLoading: false,
        error: null,
      } as any);

      vi.spyOn(useWorkspaceTeamHooks, 'useExportAuditLogs').mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: false,
      } as any);

      // Mock link click - store original createElement
      const mockClick = vi.fn();
      const originalCreateElement = document.createElement.bind(document);
      const createElementSpy = vi.spyOn(document, 'createElement');
      createElementSpy.mockImplementation((tagName: string) => {
        if (tagName === 'a') {
          const link = originalCreateElement('a') as HTMLAnchorElement;
          link.click = mockClick;
          return link;
        }
        return originalCreateElement(tagName);
      });

      renderWithProviders(<AuditTrail />);

      const exportButton = screen.getByLabelText(/export to csv/i);
      await user.click(exportButton);

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({});
        expect(mockClick).toHaveBeenCalled();
      });
    });

    it('should export with current filters applied', async () => {
      const user = userEvent.setup();
      const mockBlob = new Blob(['csv data'], { type: 'text/csv' });
      const mockMutateAsync = vi.fn().mockResolvedValue(mockBlob);

      vi.spyOn(useWorkspaceTeamHooks, 'useAuditLogs').mockReturnValue({
        data: mockAuditLogsResponse,
        isLoading: false,
        error: null,
      } as any);

      vi.spyOn(useWorkspaceTeamHooks, 'useExportAuditLogs').mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: false,
      } as any);

      // Mock link click - store original createElement
      const mockClick = vi.fn();
      const originalCreateElement = document.createElement.bind(document);
      const createElementSpy = vi.spyOn(document, 'createElement');
      createElementSpy.mockImplementation((tagName: string) => {
        if (tagName === 'a') {
          const link = originalCreateElement('a') as HTMLAnchorElement;
          link.click = mockClick;
          return link;
        }
        return originalCreateElement(tagName);
      });

      renderWithProviders(<AuditTrail initialFilters={{ category: 'member' }} />);

      const exportButton = screen.getByLabelText(/export to csv/i);
      await user.click(exportButton);

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({ category: 'member' });
      });
    });
  });

  describe('Severity and Category Badges', () => {
    it('should display severity badges with correct colors', async () => {
      vi.spyOn(useWorkspaceTeamHooks, 'useAuditLogs').mockReturnValue({
        data: mockAuditLogsResponse,
        isLoading: false,
        error: null,
      } as any);

      vi.spyOn(useWorkspaceTeamHooks, 'useExportAuditLogs').mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as any);

      renderWithProviders(<AuditTrail />);

      await waitFor(() => {
        expect(screen.getByText('medium')).toBeInTheDocument();
        expect(screen.getByText('high')).toBeInTheDocument();
        expect(screen.getByText('low')).toBeInTheDocument();
      });
    });

    it('should display category badges', async () => {
      vi.spyOn(useWorkspaceTeamHooks, 'useAuditLogs').mockReturnValue({
        data: mockAuditLogsResponse,
        isLoading: false,
        error: null,
      } as any);

      vi.spyOn(useWorkspaceTeamHooks, 'useExportAuditLogs').mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as any);

      renderWithProviders(<AuditTrail />);

      await waitFor(() => {
        expect(screen.getByText('role')).toBeInTheDocument();
        expect(screen.getByText('member')).toBeInTheDocument();
        expect(screen.getByText('invite')).toBeInTheDocument();
      });
    });
  });
});
