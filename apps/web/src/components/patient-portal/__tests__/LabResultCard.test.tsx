import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import LabResultCard from '../LabResultCard';

const theme = createTheme();

const mockLabResult = {
  _id: 'lab_001',
  patientId: 'patient_123',
  testDate: '2024-03-15',
  testType: 'Complete Blood Count (CBC)',
  pharmacistName: 'Dr. Sarah Johnson',
  labName: 'Central Medical Laboratory',
  status: 'reviewed' as const,
  results: [
    {
      testName: 'Hemoglobin',
      value: 13.5,
      unit: 'g/dL',
      referenceRange: { min: 12.0, max: 15.5 },
      status: 'normal' as const
    },
    {
      testName: 'White Blood Cells',
      value: 8.2,
      unit: '×10³/μL',
      referenceRange: { min: 4.5, max: 11.0 },
      status: 'normal' as const
    },
    {
      testName: 'LDL Cholesterol',
      value: 125,
      unit: 'mg/dL',
      referenceRange: { min: 0, max: 100 },
      status: 'high' as const,
      flag: 'Slightly elevated - consider dietary modifications'
    }
  ],
  interpretation: 'Most parameters are within normal limits. LDL cholesterol is slightly elevated.',
  recommendations: 'Consider dietary modifications and regular exercise.',
  followUpRequired: true,
  attachments: [
    {
      filename: 'lab-report.pdf',
      url: '/api/files/lab-report.pdf',
      type: 'application/pdf'
    }
  ],
  createdAt: '2024-03-15T10:00:00.000Z',
  updatedAt: '2024-03-15T14:30:00.000Z'
};

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('LabResultCard', () => {
  it('renders lab result header information', () => {
    renderWithTheme(<LabResultCard result={mockLabResult} />);
    
    expect(screen.getByText('Complete Blood Count (CBC)')).toBeInTheDocument();
    expect(screen.getByText('March 15, 2024')).toBeInTheDocument();
    expect(screen.getByText('reviewed')).toBeInTheDocument();
    expect(screen.getByText('Lab: Central Medical Laboratory')).toBeInTheDocument();
  });

  it('shows abnormal results count', () => {
    renderWithTheme(<LabResultCard result={mockLabResult} />);
    
    expect(screen.getByText('1 abnormal')).toBeInTheDocument();
  });

  it('renders quick summary of first 3 results', () => {
    renderWithTheme(<LabResultCard result={mockLabResult} />);
    
    expect(screen.getByText('Hemoglobin')).toBeInTheDocument();
    expect(screen.getByText('13.50 g/dL')).toBeInTheDocument();
    expect(screen.getByText('White Blood Cells')).toBeInTheDocument();
    expect(screen.getByText('8.20 ×10³/μL')).toBeInTheDocument();
    expect(screen.getByText('LDL Cholesterol')).toBeInTheDocument();
    expect(screen.getByText('125.00 mg/dL')).toBeInTheDocument();
  });

  it('expands to show detailed results when clicked', () => {
    renderWithTheme(<LabResultCard result={mockLabResult} />);
    
    // Initially collapsed
    expect(screen.queryByText('Detailed Results')).not.toBeInTheDocument();
    
    // Click expand button
    const expandButton = screen.getByLabelText('show more');
    fireEvent.click(expandButton);
    
    // Now expanded
    expect(screen.getByText('Detailed Results')).toBeInTheDocument();
    expect(screen.getByText('Pharmacist Interpretation')).toBeInTheDocument();
    expect(screen.getByText('Recommendations')).toBeInTheDocument();
  });

  it('shows pharmacist interpretation when expanded', () => {
    renderWithTheme(<LabResultCard result={mockLabResult} />);
    
    // Expand the card
    const expandButton = screen.getByLabelText('show more');
    fireEvent.click(expandButton);
    
    expect(screen.getByText('Most parameters are within normal limits. LDL cholesterol is slightly elevated.')).toBeInTheDocument();
  });

  it('shows recommendations when expanded', () => {
    renderWithTheme(<LabResultCard result={mockLabResult} />);
    
    // Expand the card
    const expandButton = screen.getByLabelText('show more');
    fireEvent.click(expandButton);
    
    expect(screen.getByText('Consider dietary modifications and regular exercise.')).toBeInTheDocument();
  });

  it('shows follow-up required alert when expanded', () => {
    renderWithTheme(<LabResultCard result={mockLabResult} />);
    
    // Expand the card
    const expandButton = screen.getByLabelText('show more');
    fireEvent.click(expandButton);
    
    expect(screen.getByText('Follow-up Required')).toBeInTheDocument();
    expect(screen.getByText('Please schedule a follow-up appointment to discuss these results with your pharmacist.')).toBeInTheDocument();
  });

  it('shows provider information when expanded', () => {
    renderWithTheme(<LabResultCard result={mockLabResult} />);
    
    // Expand the card
    const expandButton = screen.getByLabelText('show more');
    fireEvent.click(expandButton);
    
    expect(screen.getByText(/Reviewed by:/)).toBeInTheDocument();
    expect(screen.getByText('Dr. Sarah Johnson')).toBeInTheDocument();
  });

  it('calls onDownload when download button is clicked', () => {
    const mockOnDownload = jest.fn();
    renderWithTheme(<LabResultCard result={mockLabResult} onDownload={mockOnDownload} />);
    
    const downloadButton = screen.getByLabelText('Download lab report');
    fireEvent.click(downloadButton);
    
    expect(mockOnDownload).toHaveBeenCalledWith('/api/files/lab-report.pdf', 'lab-report.pdf');
  });

  it('calls onView when view button is clicked', () => {
    const mockOnView = jest.fn();
    renderWithTheme(<LabResultCard result={mockLabResult} onView={mockOnView} />);
    
    const viewButton = screen.getByLabelText('View detailed results');
    fireEvent.click(viewButton);
    
    expect(mockOnView).toHaveBeenCalledWith('lab_001');
  });

  it('handles results without attachments', () => {
    const resultWithoutAttachments = {
      ...mockLabResult,
      attachments: undefined
    };
    
    renderWithTheme(<LabResultCard result={resultWithoutAttachments} />);
    
    expect(screen.queryByLabelText('Download lab report')).not.toBeInTheDocument();
  });

  it('handles results without follow-up requirement', () => {
    const resultWithoutFollowUp = {
      ...mockLabResult,
      followUpRequired: false
    };
    
    renderWithTheme(<LabResultCard result={resultWithoutFollowUp} />);
    
    // Expand the card
    const expandButton = screen.getByLabelText('show more');
    fireEvent.click(expandButton);
    
    expect(screen.queryByText('Follow-up Required')).not.toBeInTheDocument();
  });

  it('displays correct status colors for different result statuses', () => {
    renderWithTheme(<LabResultCard result={mockLabResult} />);
    
    // Check that normal and high status results are displayed
    const normalChips = screen.getAllByText('normal');
    const highChips = screen.getAllByText('high');
    
    expect(normalChips.length).toBeGreaterThan(0);
    expect(highChips.length).toBeGreaterThan(0);
  });
});