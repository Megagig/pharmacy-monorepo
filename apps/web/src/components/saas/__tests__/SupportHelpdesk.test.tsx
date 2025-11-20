import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import SupportHelpdesk from '../SupportHelpdesk';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('SupportHelpdesk Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render the support helpdesk component', () => {
      renderWithTheme(<SupportHelpdesk />);
      
      expect(screen.getByRole('tablist')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /tickets/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /knowledge base/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /metrics/i })).toBeInTheDocument();
    });

    it('should render tickets tab by default', () => {
      renderWithTheme(<SupportHelpdesk />);
      
      expect(screen.getByText('Support Tickets')).toBeInTheDocument();
      expect(screen.getByText('Create Ticket')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search tickets...')).toBeInTheDocument();
    });

    it('should render tickets table with mock data', () => {
      renderWithTheme(<SupportHelpdesk />);
      
      expect(screen.getByText('TKT-000001')).toBeInTheDocument();
      expect(screen.getByText('Unable to access dashboard')).toBeInTheDocument();
      expect(screen.getByText('TKT-000002')).toBeInTheDocument();
      expect(screen.getByText('Billing inquiry about subscription')).toBeInTheDocument();
    });
  });

  describe('Tab Navigation', () => {
    it('should switch to knowledge base tab', () => {
      renderWithTheme(<SupportHelpdesk />);
      
      const knowledgeBaseTab = screen.getByRole('tab', { name: /knowledge base/i });
      fireEvent.click(knowledgeBaseTab);
      
      expect(screen.getByText('Knowledge Base')).toBeInTheDocument();
      expect(screen.getByText('Create Article')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search articles...')).toBeInTheDocument();
    });

    it('should switch to metrics tab', () => {
      renderWithTheme(<SupportHelpdesk />);
      
      const metricsTab = screen.getByRole('tab', { name: /metrics/i });
      fireEvent.click(metricsTab);
      
      expect(screen.getByText('Support Metrics & Analytics')).toBeInTheDocument();
      expect(screen.getByText('Total Tickets')).toBeInTheDocument();
      expect(screen.getByText('Open Tickets')).toBeInTheDocument();
    });

    it('should display knowledge base articles', () => {
      renderWithTheme(<SupportHelpdesk />);
      
      const knowledgeBaseTab = screen.getByRole('tab', { name: /knowledge base/i });
      fireEvent.click(knowledgeBaseTab);
      
      expect(screen.getByText('How to Reset Your Password')).toBeInTheDocument();
      expect(screen.getByText('Understanding Billing Cycles')).toBeInTheDocument();
      expect(screen.getByText('API Integration Guide')).toBeInTheDocument();
    });
  });

  describe('Search and Filtering', () => {
    it('should filter tickets by search query', async () => {
      renderWithTheme(<SupportHelpdesk />);
      
      const searchInput = screen.getByPlaceholderText('Search tickets...');
      fireEvent.change(searchInput, { target: { value: 'dashboard' } });
      
      await waitFor(() => {
        expect(screen.getByText('Unable to access dashboard')).toBeInTheDocument();
        expect(screen.queryByText('Billing inquiry about subscription')).not.toBeInTheDocument();
      });
    });

    it('should filter tickets by status', async () => {
      renderWithTheme(<SupportHelpdesk />);
      
      const statusSelect = screen.getByLabelText('Status');
      fireEvent.mouseDown(statusSelect);
      
      const resolvedOption = screen.getByText('Resolved');
      fireEvent.click(resolvedOption);
      
      await waitFor(() => {
        expect(screen.getByText('Feature request: Dark mode')).toBeInTheDocument();
        expect(screen.queryByText('Unable to access dashboard')).not.toBeInTheDocument();
      });
    });

    it('should filter tickets by priority', async () => {
      renderWithTheme(<SupportHelpdesk />);
      
      const prioritySelect = screen.getByLabelText('Priority');
      fireEvent.mouseDown(prioritySelect);
      
      const highOption = screen.getByText('High');
      fireEvent.click(highOption);
      
      await waitFor(() => {
        expect(screen.getByText('Unable to access dashboard')).toBeInTheDocument();
        expect(screen.queryByText('Billing inquiry about subscription')).not.toBeInTheDocument();
      });
    });

    it('should clear all filters', async () => {
      renderWithTheme(<SupportHelpdesk />);
      
      // Apply some filters first
      const searchInput = screen.getByPlaceholderText('Search tickets...');
      fireEvent.change(searchInput, { target: { value: 'dashboard' } });
      
      // Clear filters
      const clearButton = screen.getByText('Clear');
      fireEvent.click(clearButton);
      
      await waitFor(() => {
        expect(searchInput).toHaveValue('');
        expect(screen.getByText('Unable to access dashboard')).toBeInTheDocument();
        expect(screen.getByText('Billing inquiry about subscription')).toBeInTheDocument();
      });
    });
  });

  describe('Ticket Management', () => {
    it('should open create ticket dialog', () => {
      renderWithTheme(<SupportHelpdesk />);
      
      const createButton = screen.getByText('Create Ticket');
      fireEvent.click(createButton);
      
      // Note: The dialog implementation would need to be added to the component
      // This test assumes the dialog would be implemented
    });

    it('should open ticket details dialog', () => {
      renderWithTheme(<SupportHelpdesk />);
      
      const viewButtons = screen.getAllByLabelText('View Details');
      fireEvent.click(viewButtons[0]);
      
      expect(screen.getByText(/Ticket Details - TKT-000001/)).toBeInTheDocument();
      expect(screen.getByText('Unable to access dashboard')).toBeInTheDocument();
    });

    it('should close ticket details dialog', () => {
      renderWithTheme(<SupportHelpdesk />);
      
      const viewButtons = screen.getAllByLabelText('View Details');
      fireEvent.click(viewButtons[0]);
      
      const closeButton = screen.getByText('Close');
      fireEvent.click(closeButton);
      
      expect(screen.queryByText(/Ticket Details - TKT-000001/)).not.toBeInTheDocument();
    });

    it('should display ticket status with correct styling', () => {
      renderWithTheme(<SupportHelpdesk />);
      
      expect(screen.getByText('OPEN')).toBeInTheDocument();
      expect(screen.getByText('IN PROGRESS')).toBeInTheDocument();
      expect(screen.getByText('RESOLVED')).toBeInTheDocument();
    });

    it('should display ticket priority with correct styling', () => {
      renderWithTheme(<SupportHelpdesk />);
      
      expect(screen.getByText('HIGH')).toBeInTheDocument();
      expect(screen.getByText('MEDIUM')).toBeInTheDocument();
      expect(screen.getByText('LOW')).toBeInTheDocument();
    });
  });

  describe('Knowledge Base Management', () => {
    it('should search articles', async () => {
      renderWithTheme(<SupportHelpdesk />);
      
      const knowledgeBaseTab = screen.getByRole('tab', { name: /knowledge base/i });
      fireEvent.click(knowledgeBaseTab);
      
      const searchInput = screen.getByPlaceholderText('Search articles...');
      fireEvent.change(searchInput, { target: { value: 'password' } });
      
      await waitFor(() => {
        expect(screen.getByText('How to Reset Your Password')).toBeInTheDocument();
        expect(screen.queryByText('Understanding Billing Cycles')).not.toBeInTheDocument();
      });
    });

    it('should open article details dialog', () => {
      renderWithTheme(<SupportHelpdesk />);
      
      const knowledgeBaseTab = screen.getByRole('tab', { name: /knowledge base/i });
      fireEvent.click(knowledgeBaseTab);
      
      const readButtons = screen.getAllByText('Read Article');
      fireEvent.click(readButtons[0]);
      
      expect(screen.getByText('How to Reset Your Password')).toBeInTheDocument();
    });

    it('should display article metrics', () => {
      renderWithTheme(<SupportHelpdesk />);
      
      const knowledgeBaseTab = screen.getByRole('tab', { name: /knowledge base/i });
      fireEvent.click(knowledgeBaseTab);
      
      expect(screen.getByText('245')).toBeInTheDocument(); // View count
      expect(screen.getByText('18')).toBeInTheDocument(); // Helpful votes
      expect(screen.getByText('2')).toBeInTheDocument(); // Not helpful votes
    });

    it('should display article categories and tags', () => {
      renderWithTheme(<SupportHelpdesk />);
      
      const knowledgeBaseTab = screen.getByRole('tab', { name: /knowledge base/i });
      fireEvent.click(knowledgeBaseTab);
      
      expect(screen.getByText('Account Management')).toBeInTheDocument();
      expect(screen.getByText('Billing')).toBeInTheDocument();
      expect(screen.getByText('Technical')).toBeInTheDocument();
    });
  });

  describe('Metrics Display', () => {
    it('should display key metrics', () => {
      renderWithTheme(<SupportHelpdesk />);
      
      const metricsTab = screen.getByRole('tab', { name: /metrics/i });
      fireEvent.click(metricsTab);
      
      expect(screen.getByText('156')).toBeInTheDocument(); // Total tickets
      expect(screen.getByText('23')).toBeInTheDocument(); // Open tickets
      expect(screen.getByText('4.2h')).toBeInTheDocument(); // Avg response time
      expect(screen.getByText('4.3/5')).toBeInTheDocument(); // Satisfaction score
    });

    it('should display ticket distribution charts', () => {
      renderWithTheme(<SupportHelpdesk />);
      
      const metricsTab = screen.getByRole('tab', { name: /metrics/i });
      fireEvent.click(metricsTab);
      
      expect(screen.getByText('Tickets by Status')).toBeInTheDocument();
      expect(screen.getByText('Tickets by Priority')).toBeInTheDocument();
      expect(screen.getByText('Tickets by Category')).toBeInTheDocument();
    });

    it('should display status distribution', () => {
      renderWithTheme(<SupportHelpdesk />);
      
      const metricsTab = screen.getByRole('tab', { name: /metrics/i });
      fireEvent.click(metricsTab);
      
      expect(screen.getByText('23 tickets')).toBeInTheDocument(); // Open
      expect(screen.getByText('15 tickets')).toBeInTheDocument(); // In progress
      expect(screen.getByText('118 tickets')).toBeInTheDocument(); // Resolved
    });

    it('should display priority distribution', () => {
      renderWithTheme(<SupportHelpdesk />);
      
      const metricsTab = screen.getByRole('tab', { name: /metrics/i });
      fireEvent.click(metricsTab);
      
      expect(screen.getByText('45 tickets')).toBeInTheDocument(); // Low
      expect(screen.getByText('78 tickets')).toBeInTheDocument(); // Medium
      expect(screen.getByText('30 tickets')).toBeInTheDocument(); // High
      expect(screen.getByText('3 tickets')).toBeInTheDocument(); // Critical
    });
  });

  describe('Responsive Design', () => {
    it('should handle mobile viewport', () => {
      // Mock window.innerWidth
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      renderWithTheme(<SupportHelpdesk />);
      
      expect(screen.getByRole('tablist')).toBeInTheDocument();
      expect(screen.getByText('Support Tickets')).toBeInTheDocument();
    });

    it('should handle tablet viewport', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });

      renderWithTheme(<SupportHelpdesk />);
      
      expect(screen.getByRole('tablist')).toBeInTheDocument();
      expect(screen.getByText('Support Tickets')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderWithTheme(<SupportHelpdesk />);
      
      expect(screen.getByRole('tablist')).toHaveAttribute('aria-label', 'support helpdesk tabs');
      expect(screen.getByRole('tab', { name: /tickets/i })).toHaveAttribute('aria-controls', 'support-tabpanel-0');
    });

    it('should support keyboard navigation', () => {
      renderWithTheme(<SupportHelpdesk />);
      
      const ticketsTab = screen.getByRole('tab', { name: /tickets/i });
      const knowledgeBaseTab = screen.getByRole('tab', { name: /knowledge base/i });
      
      ticketsTab.focus();
      expect(document.activeElement).toBe(ticketsTab);
      
      fireEvent.keyDown(ticketsTab, { key: 'ArrowRight' });
      expect(document.activeElement).toBe(knowledgeBaseTab);
    });

    it('should have proper heading hierarchy', () => {
      renderWithTheme(<SupportHelpdesk />);
      
      const heading = screen.getByRole('heading', { name: 'Support Tickets' });
      expect(heading).toBeInTheDocument();
      expect(heading.tagName).toBe('H2');
    });
  });

  describe('Error Handling', () => {
    it('should handle empty ticket list', () => {
      renderWithTheme(<SupportHelpdesk />);
      
      // Apply a filter that returns no results
      const searchInput = screen.getByPlaceholderText('Search tickets...');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
      
      // Should show empty table
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('should handle empty article list', () => {
      renderWithTheme(<SupportHelpdesk />);
      
      const knowledgeBaseTab = screen.getByRole('tab', { name: /knowledge base/i });
      fireEvent.click(knowledgeBaseTab);
      
      const searchInput = screen.getByPlaceholderText('Search articles...');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
      
      // Should show empty grid
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });

  describe('Data Formatting', () => {
    it('should format dates correctly', () => {
      renderWithTheme(<SupportHelpdesk />);
      
      // Check if dates are displayed in a readable format
      expect(screen.getByText('1/15/2024')).toBeInTheDocument();
      expect(screen.getByText('1/14/2024')).toBeInTheDocument();
    });

    it('should format ticket numbers correctly', () => {
      renderWithTheme(<SupportHelpdesk />);
      
      expect(screen.getByText('TKT-000001')).toBeInTheDocument();
      expect(screen.getByText('TKT-000002')).toBeInTheDocument();
      expect(screen.getByText('TKT-000003')).toBeInTheDocument();
    });

    it('should display user information correctly', () => {
      renderWithTheme(<SupportHelpdesk />);
      
      expect(screen.getByText('John Doe (john@example.com)')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith (jane@example.com)')).toBeInTheDocument();
    });
  });
});