import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import VitalsChart from '../VitalsChart';

const theme = createTheme();

const mockVitalsTrendsData = {
  readings: [
    {
      date: '2024-03-20T08:00:00.000Z',
      bloodPressureSystolic: 128,
      bloodPressureDiastolic: 82,
      heartRate: 72,
      weight: 75.5,
      glucose: 110
    },
    {
      date: '2024-03-21T08:00:00.000Z',
      bloodPressureSystolic: 125,
      bloodPressureDiastolic: 80,
      heartRate: 68,
      weight: 75.8,
      glucose: 105
    }
  ],
  trends: [
    {
      metric: 'Blood Pressure',
      trend: 'stable' as const,
      change: -2,
      status: 'normal' as const
    },
    {
      metric: 'Heart Rate',
      trend: 'stable' as const,
      change: 1,
      status: 'normal' as const
    }
  ],
  insights: [
    {
      type: 'success' as const,
      message: 'Your blood pressure has been stable and within target range this week.'
    },
    {
      type: 'info' as const,
      message: 'Weight trend shows slight decrease - great progress!'
    }
  ],
  summary: {
    totalReadings: 5,
    daysTracked: 5,
    lastReading: '2024-03-22T08:00:00.000Z',
    averages: {
      bloodPressure: { systolic: 126, diastolic: 81 },
      heartRate: 72,
      weight: 75.6,
      glucose: 110
    }
  }
};

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('VitalsChart', () => {
  it('renders loading state', () => {
    renderWithTheme(<VitalsChart data={mockVitalsTrendsData} loading={true} />);
    expect(screen.getByText('Loading vitals data...')).toBeInTheDocument();
  });

  it('renders empty state when no data', () => {
    const emptyData = {
      readings: [],
      trends: [],
      insights: [],
      summary: {
        totalReadings: 0,
        daysTracked: 0,
        lastReading: '',
        averages: {}
      }
    };
    
    renderWithTheme(<VitalsChart data={emptyData} loading={false} />);
    expect(screen.getByText('No vitals data available. Start logging your vitals to see trends and charts.')).toBeInTheDocument();
  });

  it('renders summary cards with correct data', () => {
    renderWithTheme(<VitalsChart data={mockVitalsTrendsData} loading={false} />);
    
    expect(screen.getByText('5')).toBeInTheDocument(); // Total readings
    expect(screen.getByText('Total Readings')).toBeInTheDocument();
    expect(screen.getByText('Days Tracked')).toBeInTheDocument();
    expect(screen.getByText('Last Reading')).toBeInTheDocument();
    expect(screen.getByText('Avg BP')).toBeInTheDocument();
  });

  it('renders trends overview', () => {
    renderWithTheme(<VitalsChart data={mockVitalsTrendsData} loading={false} />);
    
    expect(screen.getByText('Trends Overview')).toBeInTheDocument();
    expect(screen.getByText('Blood Pressure')).toBeInTheDocument();
    expect(screen.getByText('Heart Rate')).toBeInTheDocument();
    expect(screen.getByText('-2%')).toBeInTheDocument();
    expect(screen.getByText('+1%')).toBeInTheDocument();
  });

  it('renders health insights', () => {
    renderWithTheme(<VitalsChart data={mockVitalsTrendsData} loading={false} />);
    
    expect(screen.getByText('Health Insights')).toBeInTheDocument();
    expect(screen.getByText('Your blood pressure has been stable and within target range this week.')).toBeInTheDocument();
    expect(screen.getByText('Weight trend shows slight decrease - great progress!')).toBeInTheDocument();
  });

  it('renders chart titles when data is available', () => {
    renderWithTheme(<VitalsChart data={mockVitalsTrendsData} loading={false} />);
    
    expect(screen.getByText('Blood Pressure Trends')).toBeInTheDocument();
    expect(screen.getByText('Heart Rate Trends')).toBeInTheDocument();
    expect(screen.getByText('Weight Trends')).toBeInTheDocument();
    expect(screen.getByText('Blood Glucose Trends')).toBeInTheDocument();
  });

  it('handles data without certain vitals gracefully', () => {
    const partialData = {
      ...mockVitalsTrendsData,
      readings: [
        {
          date: '2024-03-20T08:00:00.000Z',
          heartRate: 72,
          weight: 75.5
          // No blood pressure or glucose data
        }
      ]
    };
    
    renderWithTheme(<VitalsChart data={partialData} loading={false} />);
    
    // Should still render available charts
    expect(screen.getByText('Heart Rate Trends')).toBeInTheDocument();
    expect(screen.getByText('Weight Trends')).toBeInTheDocument();
  });
});