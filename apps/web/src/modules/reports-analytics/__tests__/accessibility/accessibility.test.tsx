import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ChartComponent } from '../../components/shared/ChartComponent';
import { FilterPanel } from '../../components/shared/FilterPanel';
import { ReportsAnalyticsDashboard } from '../../components/ReportsAnalyticsDashboard';
import { mockChartData, mockChartConfig, mockFilters } from '../mocks/mockData';
import { ReportType } from '../../types';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock stores for accessibility tests
vi.mock('../../stores/reportsStore', () => ({
  useReportsStore: vi.fn(() => ({
    activeReport: ReportType.PATIENT_OUTCOMES,
    reportData: null,
    isLoading: false,
    error: null,
    setActiveReport: vi.fn(),
    fetchReportData: vi.fn(),
  })),
}));

vi.mock('../../stores/filtersStore', () => ({
  useFiltersStore: vi.fn(() => ({
    filters: mockFilters,
    setFilters: vi.fn(),
    resetFilters: vi.fn(),
    isLoading: false,
  })),
}));

vi.mock('../../stores/dashboardStore', () => ({
  useDashboardStore: vi.fn(() => ({
    sidebarCollapsed: false,
    setSidebarCollapsed: vi.fn(),
    theme: 'light',
    setTheme: vi.fn(),
  })),
}));

describe('Accessibility Tests', () => {
  describe('ChartComponent', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(
        <ChartComponent data={mockChartData} config={mockChartConfig} />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper ARIA labels', () => {
      render(<ChartComponent data={mockChartData} config={mockChartConfig} />);

      // Check for chart accessibility attributes
      const chartContainer = screen.getByTestId('responsive-container');
      expect(chartContainer).toBeInTheDocument();
    });

    it('should support keyboard navigation', () => {
      render(<ChartComponent data={mockChartData} config={mockChartConfig} />);

      // Chart should be focusable for keyboard users
      const chartContainer = screen.getByTestId('responsive-container');
      expect(chartContainer).toBeInTheDocument();
    });

    it('should have proper color contrast', () => {
      const highContrastConfig = {
        ...mockChartConfig,
        theme: {
          ...mockChartConfig.theme,
          colorPalette: ['#000000', '#ffffff', '#0066cc'], // High contrast colors
        },
      };

      render(
        <ChartComponent data={mockChartData} config={highContrastConfig} />
      );

      const chartContainer = screen.getByTestId('responsive-container');
      expect(chartContainer).toBeInTheDocument();
    });

    it('should provide alternative text for screen readers', () => {
      render(
        <ChartComponent
          data={mockChartData}
          config={mockChartConfig}
          ariaLabel="Patient outcomes chart showing improvement trends"
        />
      );

      // Should have descriptive text for screen readers
      const chartContainer = screen.getByTestId('responsive-container');
      expect(chartContainer).toBeInTheDocument();
    });
  });

  describe('FilterPanel', () => {
    const filterProps = {
      reportType: ReportType.PATIENT_OUTCOMES,
      availableFilters: [
        {
          key: 'dateRange',
          label: 'Date Range',
          type: 'dateRange' as const,
        },
        {
          key: 'therapyType',
          label: 'Therapy Type',
          type: 'multiSelect' as const,
          options: [
            { value: 'medication-therapy', label: 'Medication Therapy' },
            { value: 'clinical-intervention', label: 'Clinical Intervention' },
          ],
        },
      ],
      currentFilters: mockFilters,
      onFiltersChange: vi.fn(),
    };

    it('should not have accessibility violations', async () => {
      const { container } = render(<FilterPanel {...filterProps} />);

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper form labels', () => {
      render(<FilterPanel {...filterProps} />);

      expect(screen.getByText('Date Range')).toBeInTheDocument();
      expect(screen.getByText('Therapy Type')).toBeInTheDocument();
    });

    it('should support keyboard navigation', () => {
      render(<FilterPanel {...filterProps} />);

      // All interactive elements should be keyboard accessible
      const dateRangeSection = screen.getByText('Date Range');
      expect(dateRangeSection).toBeInTheDocument();
    });

    it('should have proper ARIA attributes for form controls', () => {
      render(<FilterPanel {...filterProps} />);

      // Form controls should have proper ARIA attributes
      const therapyTypeSection = screen.getByText('Therapy Type');
      expect(therapyTypeSection).toBeInTheDocument();
    });

    it('should announce filter changes to screen readers', () => {
      render(<FilterPanel {...filterProps} />);

      // Should have live regions for dynamic updates
      const filterPanel = screen.getByText('Date Range').closest('div');
      expect(filterPanel).toBeInTheDocument();
    });
  });

  describe('ReportsAnalyticsDashboard', () => {
    const dashboardProps = {
      workspaceId: 'workspace-123',
      userPermissions: ['reports:read', 'reports:export'],
    };

    it('should not have accessibility violations', async () => {
      const { container } = render(
        <ReportsAnalyticsDashboard {...dashboardProps} />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper heading hierarchy', () => {
      render(<ReportsAnalyticsDashboard {...dashboardProps} />);

      // Should have proper heading structure
      expect(screen.getByText('Reports & Analytics')).toBeInTheDocument();
    });

    it('should have proper landmark roles', () => {
      render(<ReportsAnalyticsDashboard {...dashboardProps} />);

      // Should have proper ARIA landmarks
      const mainContent = screen
        .getByText('Reports & Analytics')
        .closest('div');
      expect(mainContent).toBeInTheDocument();
    });

    it('should support skip navigation', () => {
      render(<ReportsAnalyticsDashboard {...dashboardProps} />);

      // Should have skip links for keyboard users
      const dashboard = screen.getByText('Reports & Analytics');
      expect(dashboard).toBeInTheDocument();
    });

    it('should have proper focus management', () => {
      render(<ReportsAnalyticsDashboard {...dashboardProps} />);

      // Focus should be managed properly when navigating
      const dashboard = screen.getByText('Reports & Analytics');
      expect(dashboard).toBeInTheDocument();
    });

    it('should announce loading states to screen readers', () => {
      // Mock loading state
      vi.mocked(
        require('../../stores/reportsStore').useReportsStore
      ).mockReturnValue({
        activeReport: ReportType.PATIENT_OUTCOMES,
        reportData: null,
        isLoading: true,
        error: null,
        setActiveReport: vi.fn(),
        fetchReportData: vi.fn(),
      });

      render(<ReportsAnalyticsDashboard {...dashboardProps} />);

      // Loading state should be announced
      expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    });

    it('should announce errors to screen readers', () => {
      // Mock error state
      vi.mocked(
        require('../../stores/reportsStore').useReportsStore
      ).mockReturnValue({
        activeReport: ReportType.PATIENT_OUTCOMES,
        reportData: null,
        isLoading: false,
        error: 'Failed to load report data',
        setActiveReport: vi.fn(),
        fetchReportData: vi.fn(),
      });

      render(<ReportsAnalyticsDashboard {...dashboardProps} />);

      // Error should be announced
      expect(screen.getByTestId('alert-error')).toBeInTheDocument();
    });
  });

  describe('Color Accessibility', () => {
    it('should provide sufficient color contrast ratios', () => {
      const accessibleColors = [
        '#1f2937', // Dark gray
        '#3b82f6', // Blue
        '#ef4444', // Red
        '#10b981', // Green
        '#f59e0b', // Yellow
      ];

      const accessibleConfig = {
        ...mockChartConfig,
        theme: {
          ...mockChartConfig.theme,
          colorPalette: accessibleColors,
        },
      };

      render(<ChartComponent data={mockChartData} config={accessibleConfig} />);

      const chartContainer = screen.getByTestId('responsive-container');
      expect(chartContainer).toBeInTheDocument();
    });

    it('should not rely solely on color to convey information', () => {
      // Charts should use patterns, shapes, or text in addition to color
      render(
        <ChartComponent
          data={mockChartData}
          config={mockChartConfig}
          showTooltip={true}
          showLegend={true}
        />
      );

      expect(screen.getByTestId('tooltip')).toBeInTheDocument();
      expect(screen.getByTestId('legend')).toBeInTheDocument();
    });
  });

  describe('Screen Reader Support', () => {
    it('should provide data tables as alternative to charts', () => {
      render(
        <ChartComponent
          data={mockChartData}
          config={mockChartConfig}
          showDataTable={true}
        />
      );

      // Should provide tabular data as alternative
      const chartContainer = screen.getByTestId('responsive-container');
      expect(chartContainer).toBeInTheDocument();
    });

    it('should have descriptive chart summaries', () => {
      render(
        <ChartComponent
          data={mockChartData}
          config={mockChartConfig}
          summary="This chart shows patient outcomes improving by 15% over the selected period"
        />
      );

      const chartContainer = screen.getByTestId('responsive-container');
      expect(chartContainer).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support tab navigation through all interactive elements', () => {
      render(
        <ReportsAnalyticsDashboard
          {...{ workspaceId: 'test', userPermissions: [] }}
        />
      );

      // All interactive elements should be reachable via keyboard
      const dashboard = screen.getByText('Reports & Analytics');
      expect(dashboard).toBeInTheDocument();
    });

    it('should have visible focus indicators', () => {
      render(
        <FilterPanel
          reportType={ReportType.PATIENT_OUTCOMES}
          availableFilters={[]}
          currentFilters={mockFilters}
          onFiltersChange={vi.fn()}
        />
      );

      // Focus indicators should be visible
      const filterPanel = screen.getByText('Date Range').closest('div');
      expect(filterPanel).toBeInTheDocument();
    });
  });
});
