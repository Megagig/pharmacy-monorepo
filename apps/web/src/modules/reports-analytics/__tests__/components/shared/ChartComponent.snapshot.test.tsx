import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ChartComponent } from '../../../components/shared/ChartComponent';
import {
  mockChartData,
  mockChartConfig,
  generateMockChartData,
} from '../../mocks/mockData';
import { ChartType } from '../../../types';

// Mock Recharts for consistent snapshots
vi.mock('recharts', () => ({
  LineChart: ({ children, data, ...props }: any) => (
    <div data-testid="line-chart" data-chart-props={JSON.stringify(props)}>
      <div data-testid="chart-data">{JSON.stringify(data)}</div>
      {children}
    </div>
  ),
  AreaChart: ({ children, data, ...props }: any) => (
    <div data-testid="area-chart" data-chart-props={JSON.stringify(props)}>
      <div data-testid="chart-data">{JSON.stringify(data)}</div>
      {children}
    </div>
  ),
  BarChart: ({ children, data, ...props }: any) => (
    <div data-testid="bar-chart" data-chart-props={JSON.stringify(props)}>
      <div data-testid="chart-data">{JSON.stringify(data)}</div>
      {children}
    </div>
  ),
  PieChart: ({ children, data, ...props }: any) => (
    <div data-testid="pie-chart" data-chart-props={JSON.stringify(props)}>
      <div data-testid="chart-data">{JSON.stringify(data)}</div>
      {children}
    </div>
  ),
  ResponsiveContainer: ({ children, ...props }: any) => (
    <div
      data-testid="responsive-container"
      data-container-props={JSON.stringify(props)}
    >
      {children}
    </div>
  ),
  XAxis: (props: any) => (
    <div data-testid="x-axis" data-axis-props={JSON.stringify(props)} />
  ),
  YAxis: (props: any) => (
    <div data-testid="y-axis" data-axis-props={JSON.stringify(props)} />
  ),
  CartesianGrid: (props: any) => (
    <div data-testid="cartesian-grid" data-grid-props={JSON.stringify(props)} />
  ),
  Tooltip: (props: any) => (
    <div data-testid="tooltip" data-tooltip-props={JSON.stringify(props)} />
  ),
  Legend: (props: any) => (
    <div data-testid="legend" data-legend-props={JSON.stringify(props)} />
  ),
  Line: (props: any) => (
    <div data-testid="line" data-line-props={JSON.stringify(props)} />
  ),
  Area: (props: any) => (
    <div data-testid="area" data-area-props={JSON.stringify(props)} />
  ),
  Bar: (props: any) => (
    <div data-testid="bar" data-bar-props={JSON.stringify(props)} />
  ),
  Cell: (props: any) => (
    <div data-testid="cell" data-cell-props={JSON.stringify(props)} />
  ),
  Pie: (props: any) => (
    <div data-testid="pie" data-pie-props={JSON.stringify(props)} />
  ),
}));

describe('ChartComponent Snapshots', () => {
  const defaultProps = {
    data: mockChartData,
    config: mockChartConfig,
  };

  it('renders line chart correctly', () => {
    const { container } = render(
      <ChartComponent
        {...defaultProps}
        config={{ ...mockChartConfig, type: 'line' }}
      />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders area chart correctly', () => {
    const { container } = render(
      <ChartComponent
        {...defaultProps}
        config={{ ...mockChartConfig, type: 'area' }}
      />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders bar chart correctly', () => {
    const { container } = render(
      <ChartComponent
        {...defaultProps}
        config={{ ...mockChartConfig, type: 'bar' }}
      />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders pie chart correctly', () => {
    const { container } = render(
      <ChartComponent
        {...defaultProps}
        config={{ ...mockChartConfig, type: 'pie' }}
      />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders chart with custom theme', () => {
    const customTheme = {
      ...mockChartConfig.theme,
      colorPalette: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4'],
      borderRadius: 8,
    };

    const { container } = render(
      <ChartComponent
        {...defaultProps}
        config={{ ...mockChartConfig, theme: customTheme }}
      />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders chart with animations disabled', () => {
    const noAnimationConfig = {
      ...mockChartConfig,
      animations: {
        duration: 0,
        easing: 'ease' as const,
        stagger: false,
        entrance: 'fade' as const,
      },
    };

    const { container } = render(
      <ChartComponent {...defaultProps} config={noAnimationConfig} />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders chart in loading state', () => {
    const { container } = render(
      <ChartComponent {...defaultProps} isLoading={true} />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders chart with large dataset', () => {
    const largeDataset = generateMockChartData(100);

    const { container } = render(
      <ChartComponent {...defaultProps} data={largeDataset} />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders chart without tooltip and legend', () => {
    const { container } = render(
      <ChartComponent
        {...defaultProps}
        showTooltip={false}
        showLegend={false}
      />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders chart with custom title configuration', () => {
    const customTitleConfig = {
      ...mockChartConfig,
      title: {
        text: 'Custom Chart Title',
        subtitle: 'With Custom Subtitle',
        alignment: 'left' as const,
        style: {
          fontSize: 20,
          fontWeight: 'bold',
          color: '#2c3e50',
        },
      },
    };

    const { container } = render(
      <ChartComponent {...defaultProps} config={customTitleConfig} />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders responsive chart', () => {
    const { container } = render(
      <ChartComponent {...defaultProps} responsive={true} />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders chart with empty data', () => {
    const { container } = render(
      <ChartComponent {...defaultProps} data={[]} />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders chart with gradient theme', () => {
    const gradientTheme = {
      ...mockChartConfig.theme,
      gradients: [
        {
          type: 'linear' as const,
          stops: [
            { offset: 0, color: '#667eea', opacity: 1 },
            { offset: 1, color: '#764ba2', opacity: 0.8 },
          ],
          direction: 45,
        },
      ],
    };

    const { container } = render(
      <ChartComponent
        {...defaultProps}
        config={{ ...mockChartConfig, theme: gradientTheme }}
      />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders chart with custom animations', () => {
    const customAnimations = {
      duration: 1000,
      easing: 'ease-in-out' as const,
      stagger: true,
      entrance: 'slide' as const,
    };

    const { container } = render(
      <ChartComponent
        {...defaultProps}
        config={{ ...mockChartConfig, animations: customAnimations }}
      />
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
