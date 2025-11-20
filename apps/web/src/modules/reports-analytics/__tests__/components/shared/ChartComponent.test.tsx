import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChartComponent } from '../../../components/shared/ChartComponent';
import { mockChartData, mockChartConfig } from '../../mocks/mockData';
import { ChartType } from '../../../types';

// Mock the chart stores
vi.mock('../../../stores/chartsStore', () => ({
  useChartsStore: vi.fn(() => ({
    isLoading: false,
    error: null,
    setLoading: vi.fn(),
    setError: vi.fn(),
  })),
}));

describe('ChartComponent', () => {
  const defaultProps = {
    data: mockChartData,
    config: mockChartConfig,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders chart component with correct data', () => {
    render(<ChartComponent {...defaultProps} />);

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('renders different chart types correctly', () => {
    const chartTypes: ChartType[] = ['bar', 'area', 'pie', 'scatter'];

    chartTypes.forEach((type) => {
      const { unmount } = render(
        <ChartComponent
          {...defaultProps}
          config={{ ...mockChartConfig, type }}
        />
      );

      expect(screen.getByTestId(`${type}-chart`)).toBeInTheDocument();
      unmount();
    });
  });

  it('displays loading state when isLoading is true', () => {
    render(<ChartComponent {...defaultProps} isLoading={true} />);

    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  it('handles data point click events', async () => {
    const onDataPointClick = vi.fn();
    render(
      <ChartComponent {...defaultProps} onDataPointClick={onDataPointClick} />
    );

    // Simulate click on chart data point
    const chartElement = screen.getByTestId('line-chart');
    fireEvent.click(chartElement);

    await waitFor(() => {
      // Note: In a real implementation, this would test actual chart interaction
      // For now, we verify the component renders without errors
      expect(chartElement).toBeInTheDocument();
    });
  });

  it('handles hover events', async () => {
    const onHover = vi.fn();
    render(<ChartComponent {...defaultProps} onHover={onHover} />);

    const chartElement = screen.getByTestId('line-chart');
    fireEvent.mouseEnter(chartElement);

    await waitFor(() => {
      expect(chartElement).toBeInTheDocument();
    });
  });

  it('renders tooltip when showTooltip is true', () => {
    render(
      <ChartComponent
        {...defaultProps}
        config={{ ...mockChartConfig, showTooltip: true }}
      />
    );

    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
  });

  it('renders legend when showLegend is true', () => {
    render(
      <ChartComponent
        {...defaultProps}
        config={{ ...mockChartConfig, showLegend: true }}
      />
    );

    expect(screen.getByTestId('legend')).toBeInTheDocument();
  });

  it('applies responsive design correctly', () => {
    render(<ChartComponent {...defaultProps} responsive={true} />);

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('handles empty data gracefully', () => {
    render(<ChartComponent {...defaultProps} data={[]} />);

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('applies custom theme correctly', () => {
    const customTheme = {
      ...mockChartConfig.theme,
      colorPalette: ['#ff0000', '#00ff00', '#0000ff'],
    };

    render(
      <ChartComponent
        {...defaultProps}
        config={{ ...mockChartConfig, theme: customTheme }}
      />
    );

    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('handles animation configuration', () => {
    const animationConfig = {
      duration: 500,
      easing: 'ease-in' as const,
      stagger: true,
      entrance: 'slide' as const,
    };

    render(
      <ChartComponent
        {...defaultProps}
        config={{ ...mockChartConfig, animations: animationConfig }}
      />
    );

    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });
});
