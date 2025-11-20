import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Components to test
import AllDiagnosticCasesPage from '../modules/diagnostics/pages/AllDiagnosticCasesPage';
import DiagnosticAnalyticsPage from '../modules/diagnostics/pages/DiagnosticAnalyticsPage';
import DiagnosticReferralsPage from '../modules/diagnostics/pages/DiagnosticReferralsPage';
import PatientDiagnosticHistory from '../components/patients/PatientDiagnosticHistory';
import PatientDiagnosticSummary from '../components/patients/PatientDiagnosticSummary';

// Mock services
import * as diagnosticHistoryService from '../services/diagnosticHistoryService';
import * as apiClient from '../services/apiClient';

// Mock data
const mockDiagnosticCase = {
  _id: '1',
  caseId: 'DX-001',
  patientId: {
    _id: 'patient1',
    firstName: 'John',
    lastName: 'Doe',
    age: 35,
    gender: 'male',
  },
  pharmacistId: {
    _id: 'pharmacist1',
    firstName: 'Dr. Jane',
    lastName: 'Smith',
  },
  symptoms: {
    subjective: ['headache', 'fatigue'],
    objective: ['fever'],
    duration: '3 days',
    severity: 'moderate',
    onset: 'acute',
  },
  status: 'completed',
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-15T10:30:00Z',
};

const mockDiagnosticHistory = {
  _id: 'history1',
  patientId: 'patient1',
  caseId: 'DX-001',
  diagnosticCaseId: '1',
  pharmacistId: {
    _id: 'pharmacist1',
    firstName: 'Dr. Jane',
    lastName: 'Smith',
  },
  analysisSnapshot: {
    differentialDiagnoses: [
      {
        condition: 'Viral infection',
        probability: 85,
        reasoning: 'Common symptoms match viral pattern',
        severity: 'medium',
      },
    ],
    recommendedTests: [],
    therapeuticOptions: [],
    redFlags: [],
    disclaimer: 'Test disclaimer',
    confidenceScore: 85,
    processingTime: 1500,
  },
  clinicalContext: {
    symptoms: {
      subjective: ['headache', 'fatigue'],
      objective: ['fever'],
      duration: '3 days',
      severity: 'moderate',
      onset: 'acute',
    },
  },
  notes: [],
  followUp: {
    required: false,
    completed: false,
  },
  status: 'active',
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-15T10:30:00Z',
};

const mockAnalytics = {
  summary: {
    totalCases: 156,
    averageConfidence: 87.5,
    averageProcessingTime: 2000,
    completedCases: 142,
    pendingFollowUps: 14,
    referralsGenerated: 23,
  },
  topDiagnoses: [
    {
      condition: 'Viral infection',
      count: 45,
      averageConfidence: 85,
    },
    {
      condition: 'Bacterial infection',
      count: 32,
      averageConfidence: 78,
    },
  ],
  completionTrends: [
    {
      _id: '2024-01-15',
      casesCreated: 12,
      casesCompleted: 10,
    },
  ],
  dateRange: {
    from: '2024-01-01',
    to: '2024-01-31',
  },
};

const mockReferrals = {
  referrals: [
    {
      _id: 'ref1',
      patientId: {
        _id: 'patient1',
        firstName: 'John',
        lastName: 'Doe',
        age: 35,
        gender: 'male',
      },
      pharmacistId: {
        _id: 'pharmacist1',
        firstName: 'Dr. Jane',
        lastName: 'Smith',
      },
      caseId: 'DX-001',
      referral: {
        generated: true,
        generatedAt: '2024-01-15T10:00:00Z',
        specialty: 'cardiology',
        urgency: 'routine',
        status: 'pending',
      },
      createdAt: '2024-01-15T10:00:00Z',
    },
  ],
  pagination: {
    current: 1,
    total: 1,
    count: 1,
    totalReferrals: 1,
  },
  statistics: {
    pending: 5,
    sent: 3,
    acknowledged: 2,
    completed: 1,
  },
};

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  const theme = createTheme();

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          {children}
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

// Mock the services
vi.mock('../services/diagnosticHistoryService', () => ({
  diagnosticHistoryService: {
    getAllCases: vi.fn(),
    getAnalytics: vi.fn(),
    getReferrals: vi.fn(),
    getPatientHistory: vi.fn(),
    addNote: vi.fn(),
  },
}));

vi.mock('../services/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Diagnostic History Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AllDiagnosticCasesPage', () => {
    it('renders diagnostic cases table', async () => {
      const mockGetAllCases = vi.spyOn(diagnosticHistoryService.diagnosticHistoryService, 'getAllCases')
        .mockResolvedValue({
          cases: [mockDiagnosticCase],
          pagination: {
            current: 1,
            total: 1,
            count: 1,
            totalCases: 1,
          },
          filters: {},
        });

      render(
        <TestWrapper>
          <AllDiagnosticCasesPage />
        </TestWrapper>
      );

      expect(screen.getByText('All Diagnostic Cases')).toBeInTheDocument();
      
      await waitFor(() => {
        expect(mockGetAllCases).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText('DX-001')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
    });

    it('handles search functionality', async () => {
      const mockGetAllCases = vi.spyOn(diagnosticHistoryService.diagnosticHistoryService, 'getAllCases')
        .mockResolvedValue({
          cases: [],
          pagination: {
            current: 1,
            total: 0,
            count: 0,
            totalCases: 0,
          },
          filters: {},
        });

      render(
        <TestWrapper>
          <AllDiagnosticCasesPage />
        </TestWrapper>
      );

      const searchInput = screen.getByPlaceholderText('Search cases...');
      fireEvent.change(searchInput, { target: { value: 'DX-001' } });

      await waitFor(() => {
        expect(mockGetAllCases).toHaveBeenCalledWith(
          expect.objectContaining({
            search: 'DX-001',
          })
        );
      });
    });
  });

  describe('DiagnosticAnalyticsPage', () => {
    it('renders analytics dashboard', async () => {
      const mockGetAnalytics = vi.spyOn(diagnosticHistoryService.diagnosticHistoryService, 'getAnalytics')
        .mockResolvedValue(mockAnalytics);

      render(
        <TestWrapper>
          <DiagnosticAnalyticsPage />
        </TestWrapper>
      );

      expect(screen.getByText('Diagnostic Analytics')).toBeInTheDocument();

      await waitFor(() => {
        expect(mockGetAnalytics).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText('156')).toBeInTheDocument(); // Total cases
        expect(screen.getByText('88%')).toBeInTheDocument(); // Average confidence
      });
    });

    it('handles date range filtering', async () => {
      const mockGetAnalytics = vi.spyOn(diagnosticHistoryService.diagnosticHistoryService, 'getAnalytics')
        .mockResolvedValue(mockAnalytics);

      render(
        <TestWrapper>
          <DiagnosticAnalyticsPage />
        </TestWrapper>
      );

      const fromDateInput = screen.getByLabelText('From Date');
      const toDateInput = screen.getByLabelText('To Date');
      const applyButton = screen.getByText('Apply Filter');

      fireEvent.change(fromDateInput, { target: { value: '2024-01-01' } });
      fireEvent.change(toDateInput, { target: { value: '2024-01-31' } });
      fireEvent.click(applyButton);

      await waitFor(() => {
        expect(mockGetAnalytics).toHaveBeenCalledWith(
          expect.objectContaining({
            dateFrom: '2024-01-01',
            dateTo: '2024-01-31',
          })
        );
      });
    });
  });

  describe('DiagnosticReferralsPage', () => {
    it('renders referrals table', async () => {
      const mockGetReferrals = vi.spyOn(diagnosticHistoryService.diagnosticHistoryService, 'getReferrals')
        .mockResolvedValue(mockReferrals);

      render(
        <TestWrapper>
          <DiagnosticReferralsPage />
        </TestWrapper>
      );

      expect(screen.getByText('Diagnostic Referrals')).toBeInTheDocument();

      await waitFor(() => {
        expect(mockGetReferrals).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('cardiology')).toBeInTheDocument();
        expect(screen.getByText('pending')).toBeInTheDocument();
      });
    });

    it('displays referral statistics', async () => {
      const mockGetReferrals = vi.spyOn(diagnosticHistoryService.diagnosticHistoryService, 'getReferrals')
        .mockResolvedValue(mockReferrals);

      render(
        <TestWrapper>
          <DiagnosticReferralsPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('5')).toBeInTheDocument(); // Pending count
        expect(screen.getByText('3')).toBeInTheDocument(); // Sent count
      });
    });
  });

  describe('PatientDiagnosticHistory', () => {
    it('renders patient diagnostic history', async () => {
      const mockGetPatientHistory = vi.spyOn(diagnosticHistoryService.diagnosticHistoryService, 'getPatientHistory')
        .mockResolvedValue({
          history: [mockDiagnosticHistory],
          pagination: {
            current: 1,
            total: 1,
            count: 1,
            totalRecords: 1,
          },
          patient: {
            id: 'patient1',
            name: 'John Doe',
            age: 35,
            gender: 'male',
          },
        });

      render(
        <TestWrapper>
          <PatientDiagnosticHistory patientId="patient1" />
        </TestWrapper>
      );

      expect(screen.getByText('Diagnostic History')).toBeInTheDocument();

      await waitFor(() => {
        expect(mockGetPatientHistory).toHaveBeenCalledWith('patient1', expect.any(Object));
      });

      await waitFor(() => {
        expect(screen.getByText('Case DX-001')).toBeInTheDocument();
        expect(screen.getByText('85% confidence')).toBeInTheDocument();
      });
    });

    it('handles adding notes', async () => {
      const mockGetPatientHistory = vi.spyOn(diagnosticHistoryService.diagnosticHistoryService, 'getPatientHistory')
        .mockResolvedValue({
          history: [mockDiagnosticHistory],
          pagination: {
            current: 1,
            total: 1,
            count: 1,
            totalRecords: 1,
          },
          patient: {
            id: 'patient1',
            name: 'John Doe',
            age: 35,
            gender: 'male',
          },
        });

      const mockAddNote = vi.spyOn(diagnosticHistoryService.diagnosticHistoryService, 'addNote')
        .mockResolvedValue({
          noteId: 'note1',
          addedAt: '2024-01-15T10:00:00Z',
        });

      render(
        <TestWrapper>
          <PatientDiagnosticHistory patientId="patient1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Case DX-001')).toBeInTheDocument();
      });

      // Click add note button
      const addNoteButton = screen.getByLabelText('Add Note');
      fireEvent.click(addNoteButton);

      // Fill in note dialog
      await waitFor(() => {
        expect(screen.getByText('Add Diagnostic Note')).toBeInTheDocument();
      });

      const noteInput = screen.getByPlaceholderText('Enter your note here...');
      fireEvent.change(noteInput, { target: { value: 'Test note content' } });

      const saveButton = screen.getByText('Save Note');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockAddNote).toHaveBeenCalledWith(
          'history1',
          'Test note content',
          'general'
        );
      });
    });
  });

  describe('PatientDiagnosticSummary', () => {
    it('renders patient diagnostic summary', async () => {
      const mockApiGet = vi.spyOn(apiClient.apiClient, 'get')
        .mockResolvedValue({
          data: {
            data: {
              patient: {
                id: 'patient1',
                name: 'John Doe',
                age: 35,
                gender: 'male',
              },
              diagnosticSummary: {
                totalCases: 5,
                pendingFollowUps: 2,
                referralsGenerated: 1,
                latestCase: {
                  id: 'history1',
                  caseId: 'DX-001',
                  createdAt: '2024-01-15T10:00:00Z',
                  pharmacist: {
                    firstName: 'Dr. Jane',
                    lastName: 'Smith',
                  },
                  confidenceScore: 85,
                },
              },
            },
          },
        });

      render(
        <TestWrapper>
          <PatientDiagnosticSummary patientId="patient1" />
        </TestWrapper>
      );

      expect(screen.getByText('Diagnostic Summary')).toBeInTheDocument();

      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith('/patients/patient1/diagnostic-summary');
      });

      await waitFor(() => {
        expect(screen.getByText('5')).toBeInTheDocument(); // Total cases
        expect(screen.getByText('2')).toBeInTheDocument(); // Pending follow-ups
        expect(screen.getByText('Latest Case: DX-001')).toBeInTheDocument();
      });
    });

    it('handles navigation to new case', async () => {
      const mockApiGet = vi.spyOn(apiClient.apiClient, 'get')
        .mockResolvedValue({
          data: {
            data: {
              patient: {
                id: 'patient1',
                name: 'John Doe',
                age: 35,
                gender: 'male',
              },
              diagnosticSummary: {
                totalCases: 0,
                pendingFollowUps: 0,
                referralsGenerated: 0,
                latestCase: null,
              },
            },
          },
        });

      render(
        <TestWrapper>
          <PatientDiagnosticSummary patientId="patient1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('No diagnostic data available')).toBeInTheDocument();
      });

      const newCaseButton = screen.getByText('Create First Case');
      fireEvent.click(newCaseButton);

      expect(mockNavigate).toHaveBeenCalledWith('/pharmacy/diagnostics/case/new?patientId=patient1');
    });
  });
});