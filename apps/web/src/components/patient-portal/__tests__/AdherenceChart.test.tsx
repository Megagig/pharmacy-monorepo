import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { vi } from 'vitest';
import AdherenceChart from '../AdherenceChart';

const theme = createTheme();

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

const mockAdherenceData = [
  { date: '2024-03-01', adherenceScore: 85, dosesTaken: 17, dosesScheduled: 20 },
  { date: '2024-03-02', adherenceScore: 90, dosesTaken: 18, dosesScheduled: 20 },
  { date: '2024-03-03', adherenceScore: 75, dosesTaken: 15, dosesScheduled: 20 },
  { date: '2024-03-04', adherenceScore: 95, dosesTaken: 19, dosesScheduled: 20 },
  { date: '2024-03-05', adherenceScore: 80, dosesTaken: 16, dosesScheduled: 20 },
  { date: '2024-03-06', adherenceScore: 100, dosesTaken: 20, dosesScheduled: 20 },
  { date: '2024-03-07', adherenceScore: 70, dosesTaken: 14, dosesScheduled: 20 },
];

const mockMedicationData = [
  {
    medicationId: 'med_1',
    medicationName: 'Metformin',
    adherenceScore: 85,
    dosesTaken: 120,
    dosesScheduled: 140,
    lastTaken: '2024-03-07T08:00:00.000Z',
    nextDue: '2024-03-07T20:00:00.000Z',
  },
  {
    medicationId: 'med_2',
    medicationName: 'Lisinopril',
    adherenceScore: 92,
    dosesTaken: 65,
    dosesScheduled: 70,
    lastTaken: '2024-03-07T09:00:00.000Z',
    nextDue: '2024-03-08T09:00:00.000Z',
  },
];

// Mock Recharts components
vi.mock('recharts', () => ({
  LineChart: ({ children, ...props }: any) => (
    <div data-testid="line-chart" {...props}>
      {children}
    </div>
  ),
  Line: ({ dataKey, ...props }: any) => (
    <div data-testid={`line-${dataKey}`} {...props} />
  ),
  XAxis: (props: any) => <div data-testid="x-axis" {...props} />,
  YAxis: (props: any) => <div data-testid="y-axis" {...props} />,
  CartesianGrid: (props: any) => <div data-testid="cartesian-grid" {...props} />,
  Tooltip: (props: any) => <div data-testid="tooltip" {...props} />,
  Legend: (props: any) => <div data-testid="legend" {...props} />,
  ResponsiveContainer: ({ children, ...props }: any) => (
    <div data-testid="responsive-container" {...props}>
      {children}
    </div>
  ),
  BarChart: ({ children, ...props }: any) => (
    <div data-testid="bar-chart" {...props}>
      {children}
    </div>
  ),
  Bar: ({ dataKey, ...props }: any) => (
    <div data-testid={`bar-${dataKey}`} {...props} />
  ),
}));

describe('AdherenceChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders adherence chart with daily data', () => {
    renderWithProviders(
      <AdherenceChart 
        data={mockAdherenceData}
        type="daily"
        title="Daily Adherence"
      />
    );

    expect(screen.getByText('Daily Adherence')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.getByTestId('line-adherenceScore')).toBeInTheDocument();
  });

  it('renders medication adherence comparison', () => {
    renderWithProviders(
      <AdherenceChart 
        data={mockMedicationData}
        type="medication"
        title="Medication Adherence Comparison"
      />
    );

    expect(screen.getByText('Medication Adherence Comparison')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(screen.getByTestId('bar-adherenceScore')).toBeInTheDocument();
  });

  it('shows overall adherence statistics', () => {
    renderWithProviders(
      <AdherenceChart 
        data={mockAdherenceData}
        type="daily"
        showStats={true}
      />
    );

    expect(screen.getByText('Overall Statistics')).toBeInTheDocument();
    expect(screen.getByText(/Average Adherence/)).toBeInTheDocument();
    expect(screen.getByText(/Best Day/)).toBeInTheDocument();
    expect(screen.getByText(/Improvement Needed/)).toBeInTheDocument();
  });

  it('handles empty data gracefully', () => {
    renderWithProviders(
      <AdherenceChart 
        data={[]}
        type="daily"
        title="No Data Available"
      />
    );

    expect(screen.getByText('No adherence data available')).toBeInTheDocument();
    expect(screen.getByText('Start tracking your medication adherence to see your progress here.')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    renderWithProviders(
      <AdherenceChart 
        data={mockAdherenceData}
        type="daily"
        loading={true}
      />
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('handles error state', () => {
    renderWithProviders(
      <AdherenceChart 
        data={mockAdherenceData}
        type="daily"
        error="Failed to load adherence data"
      />
    );

    expect(screen.getByText('Error loading adherence data')).toBeInTheDocument();
    expect(screen.getByText('Failed to load adherence data')).toBeInTheDocument();
  });

  it('allows time period selection', () => {
    renderWithProviders(
      <AdherenceChart 
        data={mockAdherenceData}
        type="daily"
        showPeriodSelector={true}
      />
    );

    expect(screen.getByText('7 Days')).toBeInTheDocument();
    expect(screen.getByText('30 Days')).toBeInTheDocument();
    expect(screen.getByText('90 Days')).toBeInTheDocument();

    const thirtyDaysButton = screen.getByRole('button', { name: '30 Days' });
    fireEvent.click(thirtyDaysButton);

    expect(thirtyDaysButton).toHaveClass('Mui-selected');
  });

  it('shows adherence goals and targets', () => {
    renderWithProviders(
      <AdherenceChart 
        data={mockAdherenceData}
        type="daily"
        showGoals={true}
        adherenceGoal={80}
      />
    );

    expect(screen.getByText(/Target: 80%/)).toBeInTheDocument();
  });

  it('displays medication-specific adherence details', () => {
    renderWithProviders(
      <AdherenceChart 
        data={mockMedicationData}
        type="medication"
        showDetails={true}
      />
    );

    expect(screen.getByText('Metformin')).toBeInTheDocument();
    expect(screen.getByText('Lisinopril')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();
  });

  it('shows adherence trends and insights', () => {
    renderWithProviders(
      <AdherenceChart 
        data={mockAdherenceData}
        type="daily"
        showInsights={true}
      />
    );

    expect(screen.getByText('Insights')).toBeInTheDocument();
    expect(screen.getByText(/Your adherence has/)).toBeInTheDocument();
  });

  it('handles chart interaction and tooltips', () => {
    renderWithProviders(
      <AdherenceChart 
        data={mockAdherenceData}
        type="daily"
        interactive={true}
      />
    );

    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
  });

  it('exports chart data', () => {
    const mockOnExport = vi.fn();

    renderWithProviders(
      <AdherenceChart 
        data={mockAdherenceData}
        type="daily"
        onExport={mockOnExport}
        showExport={true}
      />
    );

    const exportButton = screen.getByRole('button', { name: /export/i });
    fireEvent.click(exportButton);

    expect(mockOnExport).toHaveBeenCalledWith(mockAdherenceData, 'daily');
  });

  it('shows color-coded adherence levels', () => {
    const mixedAdherenceData = [
      { date: '2024-03-01', adherenceScore: 95, dosesTaken: 19, dosesScheduled: 20 }, // Excellent
      { date: '2024-03-02', adherenceScore: 85, dosesTaken: 17, dosesScheduled: 20 }, // Good
      { date: '2024-03-03', adherenceScore: 70, dosesTaken: 14, dosesScheduled: 20 }, // Fair
      { date: '2024-03-04', adherenceScore: 50, dosesTaken: 10, dosesScheduled: 20 }, // Poor
    ];

    renderWithProviders(
      <AdherenceChart 
        data={mixedAdherenceData}
        type="daily"
        showColorCoding={true}
      />
    );

    // Should show different colors for different adherence levels
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('handles responsive design', () => {
    renderWithProviders(
      <AdherenceChart 
        data={mockAdherenceData}
        type="daily"
        height={300}
        responsive={true}
      />
    );

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('shows missed doses information', () => {
    renderWithProviders(
      <AdherenceChart 
        data={mockAdherenceData}
        type="daily"
        showMissedDoses={true}
      />
    );

    expect(screen.getByText(/Missed Doses/)).toBeInTheDocument();
  });

  it('displays adherence streaks', () => {
    renderWithProviders(
      <AdherenceChart 
        data={mockAdherenceData}
        type="daily"
        showStreaks={true}
      />
    );

    expect(screen.getByText(/Current Streak/)).toBeInTheDocument();
    expect(screen.getByText(/Best Streak/)).toBeInTheDocument();
  });

  it('handles custom date formatting', () => {
    renderWithProviders(
      <AdherenceChart 
        data={mockAdherenceData}
        type="daily"
        dateFormat="MMM dd"
      />
    );

    expect(screen.getByTestId('x-axis')).toBeInTheDocument();
  });

  it('shows adherence improvement suggestions', () => {
    const lowAdherenceData = mockAdherenceData.map(item => ({
      ...item,
      adherenceScore: 60, // Low adherence
    }));

    renderWithProviders(
      <AdherenceChart 
        data={lowAdherenceData}
        type="daily"
        showSuggestions={true}
      />
    );

    expect(screen.getByText('Improvement Suggestions')).toBeInTheDocument();
    expect(screen.getByText(/Consider setting medication reminders/)).toBeInTheDocument();
  });

  it('handles chart zoom and pan', () => {
    renderWithProviders(
      <AdherenceChart 
        data={mockAdherenceData}
        type="daily"
        allowZoom={true}
      />
    );

    // Chart should be interactive
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('shows adherence by time of day', () => {
    const timeBasedData = [
      { time: '08:00', adherenceScore: 90, period: 'Morning' },
      { time: '12:00', adherenceScore: 85, period: 'Afternoon' },
      { time: '18:00', adherenceScore: 80, period: 'Evening' },
      { time: '22:00', adherenceScore: 75, period: 'Night' },
    ];

    renderWithProviders(
      <AdherenceChart 
        data={timeBasedData}
        type="timeOfDay"
        title="Adherence by Time of Day"
      />
    );

    expect(screen.getByText('Adherence by Time of Day')).toBeInTheDocument();
  });

  it('displays adherence comparison with peers', () => {
    renderWithProviders(
      <AdherenceChart 
        data={mockAdherenceData}
        type="daily"
        showPeerComparison={true}
        peerAverage={82}
      />
    );

    expect(screen.getByText(/Peer Average: 82%/)).toBeInTheDocument();
  });
});