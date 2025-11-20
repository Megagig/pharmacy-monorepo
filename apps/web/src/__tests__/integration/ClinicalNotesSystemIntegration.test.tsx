import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../theme';
import { AuthContext } from '../../context/AuthContext';
import { SubscriptionContext } from '../../context/SubscriptionContext';
import { FeatureFlagContext } from '../../context/FeatureFlagContext';
import ClinicalNotes from '../../pages/ClinicalNotes';
import ClinicalNoteFormPage from '../../pages/ClinicalNoteFormPage';
import ClinicalNoteDetailPage from '../../pages/ClinicalNoteDetailPage';
import PatientManagement from '../../components/PatientManagement';
import * as clinicalNoteService from '../../services/clinicalNoteService';
import * as patientService from '../../services/patientService';

// Mock services
jest.mock('../../services/clinicalNoteService');
jest.mock('../../services/patientService');
jest.mock('../../services/authService');

const mockClinicalNoteService = clinicalNoteService as jest.Mocked<
  typeof clinicalNoteService
>;
const mockPatientService = patientService as jest.Mocked<typeof patientService>;

// Mock data
const mockUser = {
  _id: 'user1',
  firstName: 'Dr. Jane',
  lastName: 'Smith',
  email: 'jane.smith@pharmacy.com',
  role: 'pharmacist',
  workplaceId: 'workplace1',
  workplaceRole: 'Pharmacist',
  permissions: [
    'clinical_notes:read',
    'clinical_notes:write',
    'clinical_notes:delete',
  ],
};

const mockSubscription = {
  _id: 'sub1',
  planId: 'professional',
  status: 'active',
  features: {
    clinicalNotes: true,
    maxNotes: 1000,
    confidentialNotes: true,
    fileAttachments: true,
  },
  limits: {
    notes: 1000,
    attachments: 100,
  },
  usage: {
    notes: 45,
    attachments: 12,
  },
};

const mockFeatureFlags = {
  clinicalNotes: true,
  clinicalNotesAdvanced: true,
  fileUploads: true,
  auditLogging: true,
};

const mockPatient = {
  _id: 'patient1',
  firstName: 'John',
  lastName: 'Doe',
  mrn: 'MRN001',
  email: 'john.doe@example.com',
  phone: '+1234567890',
  gender: 'Male',
  age: 45,
  dob: '1979-01-15',
  bloodGroup: 'O+',
  genotype: 'AA',
  state: 'Lagos',
  lga: 'Ikeja',
  workplaceId: 'workplace1',
};

const mockNotes = [
  {
    _id: 'note1',
    title: 'Initial Consultation',
    type: 'consultation' as const,
    priority: 'medium' as const,
    isConfidential: false,
    followUpRequired: true,
    followUpDate: '2024-02-15T10:00:00Z',
    attachments: [],
    createdAt: '2024-02-01T10:00:00Z',
    updatedAt: '2024-02-01T10:00:00Z',
    patient: {
      _id: 'patient1',
      firstName: 'John',
      lastName: 'Doe',
      mrn: 'MRN001',
    },
    pharmacist: {
      _id: 'user1',
      firstName: 'Dr. Jane',
      lastName: 'Smith',
      role: 'pharmacist',
    },
    content: {
      subjective: 'Patient reports feeling better',
      objective: 'Vital signs stable',
      assessment: 'Improving condition',
      plan: 'Continue current medication',
    },
    recommendations: ['Monitor blood pressure'],
    tags: ['hypertension'],
    workplaceId: 'workplace1',
  },
  {
    _id: 'note2',
    title: 'Confidential Assessment',
    type: 'assessment' as const,
    priority: 'high' as const,
    isConfidential: true,
    followUpRequired: false,
    attachments: [
      {
        _id: 'att1',
        fileName: 'lab-results.pdf',
        originalName: 'Lab Results - John Doe.pdf',
        mimeType: 'application/pdf',
        size: 1024000,
        url: '/api/attachments/att1',
        uploadedAt: '2024-02-01T10:00:00Z',
        uploadedBy: 'user1',
      },
    ],
    createdAt: '2024-02-02T10:00:00Z',
    updatedAt: '2024-02-02T10:00:00Z',
    patient: {
      _id: 'patient1',
      firstName: 'John',
      lastName: 'Doe',
      mrn: 'MRN001',
    },
    pharmacist: {
      _id: 'user1',
      firstName: 'Dr. Jane',
      lastName: 'Smith',
      role: 'pharmacist',
    },
    content: {
      subjective: 'Confidential patient concerns',
      objective: 'Sensitive observations',
      assessment: 'Confidential assessment',
      plan: 'Confidential treatment plan',
    },
    recommendations: ['Confidential recommendations'],
    tags: ['confidential', 'sensitive'],
    workplaceId: 'workplace1',
  },
];

// Test wrapper component
interface TestWrapperProps {
  children: React.ReactNode;
  route?: string;
  user?: any;
  subscription?: any;
  featureFlags?: any;
}

const TestWrapper: React.FC<TestWrapperProps> = ({
  children,
  route = '/notes',
  user = mockUser,
  subscription = mockSubscription,
  featureFlags = mockFeatureFlags,
}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <ThemeProvider theme={theme}>
          <AuthContext.Provider
            value={{
              user,
              isAuthenticated: !!user,
              login: jest.fn(),
              logout: jest.fn(),
              loading: false,
            }}
          >
            <SubscriptionContext.Provider
              value={{
                subscription,
                loading: false,
                error: null,
                refetch: jest.fn(),
              }}
            >
              <FeatureFlagContext.Provider
                value={{
                  flags: featureFlags,
                  loading: false,
                  error: null,
                }}
              >
                {children}
              </FeatureFlagContext.Provider>
            </SubscriptionContext.Provider>
          </AuthContext.Provider>
        </ThemeProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('Clinical Notes System Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default service mocks
    mockClinicalNoteService.getNotes.mockResolvedValue({
      notes: mockNotes,
      total: mockNotes.length,
      page: 1,
      totalPages: 1,
    });

    mockClinicalNoteService.getNote.mockImplementation((id) => {
      const note = mockNotes.find((n) => n._id === id);
      return Promise.resolve(note || null);
    });

    mockPatientService.getPatient.mockResolvedValue(mockPatient);
    mockPatientService.getPatients.mockResolvedValue({
      patients: [mockPatient],
      total: 1,
    });
  });

  describe('Authentication Integration', () => {
    it('redirects unauthenticated users to login', () => {
      const mockNavigate = jest.fn();
      jest.doMock('react-router-dom', () => ({
        ...jest.requireActual('react-router-dom'),
        useNavigate: () => mockNavigate,
      }));

      render(
        <TestWrapper user={null}>
          <ClinicalNotes />
        </TestWrapper>
      );

      // Should show authentication required message or redirect
      expect(screen.queryByText('Clinical Notes')).not.toBeInTheDocument();
    });

    it('allows authenticated pharmacists to access clinical notes', async () => {
      render(
        <TestWrapper>
          <ClinicalNotes />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Clinical Notes')).toBeInTheDocument();
        expect(screen.getByText('New Clinical Note')).toBeInTheDocument();
      });

      expect(mockClinicalNoteService.getNotes).toHaveBeenCalledWith(
        expect.objectContaining({
          workplaceId: 'workplace1',
        })
      );
    });

    it('enforces role-based access for confidential notes', async () => {
      const technicianUser = {
        ...mockUser,
        role: 'pharmacy_team',
        workplaceRole: 'Technician',
        permissions: ['clinical_notes:read'],
      };

      // Mock service to filter out confidential notes for technicians
      mockClinicalNoteService.getNotes.mockResolvedValue({
        notes: mockNotes.filter((note) => !note.isConfidential),
        total: 1,
        page: 1,
        totalPages: 1,
      });

      render(
        <TestWrapper user={technicianUser}>
          <ClinicalNotes />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Initial Consultation')).toBeInTheDocument();
        expect(
          screen.queryByText('Confidential Assessment')
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Subscription Integration', () => {
    it('allows access with active subscription', async () => {
      render(
        <TestWrapper>
          <ClinicalNotes />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Clinical Notes')).toBeInTheDocument();
        expect(screen.getByText('New Clinical Note')).toBeInTheDocument();
      });
    });

    it('restricts access with expired subscription', () => {
      const expiredSubscription = {
        ...mockSubscription,
        status: 'expired',
        features: {
          ...mockSubscription.features,
          clinicalNotes: false,
        },
      };

      render(
        <TestWrapper subscription={expiredSubscription}>
          <ClinicalNotes />
        </TestWrapper>
      );

      expect(screen.getByText('Subscription Required')).toBeInTheDocument();
      expect(screen.getByText('Upgrade Plan')).toBeInTheDocument();
    });

    it('enforces usage limits based on subscription', async () => {
      const limitedSubscription = {
        ...mockSubscription,
        limits: {
          notes: 50,
          attachments: 10,
        },
        usage: {
          notes: 49,
          attachments: 9,
        },
      };

      render(
        <TestWrapper subscription={limitedSubscription}>
          <ClinicalNotes />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Clinical Notes')).toBeInTheDocument();
      });

      // Should show usage indicator
      expect(screen.getByText('49/50 notes used')).toBeInTheDocument();
    });

    it('prevents creation when usage limit exceeded', async () => {
      const exceededSubscription = {
        ...mockSubscription,
        limits: {
          notes: 50,
          attachments: 10,
        },
        usage: {
          notes: 50,
          attachments: 10,
        },
      };

      render(
        <TestWrapper subscription={exceededSubscription}>
          <ClinicalNotes />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Clinical Notes')).toBeInTheDocument();
      });

      const createButton = screen.getByText('New Clinical Note');
      expect(createButton).toBeDisabled();
      expect(screen.getByText('Usage limit reached')).toBeInTheDocument();
    });
  });

  describe('Feature Flag Integration', () => {
    it('shows basic features when advanced features disabled', async () => {
      const basicFeatureFlags = {
        ...mockFeatureFlags,
        clinicalNotesAdvanced: false,
        fileUploads: false,
      };

      render(
        <TestWrapper featureFlags={basicFeatureFlags}>
          <ClinicalNotes />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Clinical Notes')).toBeInTheDocument();
      });

      // Should not show advanced features
      expect(screen.queryByText('Bulk Actions')).not.toBeInTheDocument();
      expect(screen.queryByText('Advanced Search')).not.toBeInTheDocument();
    });

    it('hides clinical notes entirely when feature disabled', () => {
      const disabledFeatureFlags = {
        ...mockFeatureFlags,
        clinicalNotes: false,
      };

      render(
        <TestWrapper featureFlags={disabledFeatureFlags}>
          <ClinicalNotes />
        </TestWrapper>
      );

      expect(screen.getByText('Feature Not Available')).toBeInTheDocument();
      expect(screen.queryByText('Clinical Notes')).not.toBeInTheDocument();
    });

    it('conditionally shows file upload based on feature flag', async () => {
      const noFileUploadFlags = {
        ...mockFeatureFlags,
        fileUploads: false,
      };

      render(
        <TestWrapper featureFlags={noFileUploadFlags} route="/notes/new">
          <ClinicalNoteFormPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Create Clinical Note')).toBeInTheDocument();
      });

      // Should not show file upload section
      expect(screen.queryByText('Attachments')).not.toBeInTheDocument();
      expect(screen.queryByText('Upload Files')).not.toBeInTheDocument();
    });
  });

  describe('Patient Management Integration', () => {
    it('displays clinical notes in patient profile', async () => {
      mockClinicalNoteService.getPatientNotes.mockResolvedValue({
        notes: mockNotes.filter((note) => note.patient._id === 'patient1'),
        total: 2,
      });

      render(
        <TestWrapper route="/patients/patient1">
          <PatientManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Click on Clinical Notes tab
      const clinicalNotesTab = screen.getByText('Clinical Notes');
      fireEvent.click(clinicalNotesTab);

      await waitFor(() => {
        expect(screen.getByText('Initial Consultation')).toBeInTheDocument();
        expect(screen.getByText('Confidential Assessment')).toBeInTheDocument();
      });
    });

    it('creates note with patient context from patient profile', async () => {
      mockClinicalNoteService.createNote.mockResolvedValue({
        _id: 'new-note',
        ...mockNotes[0],
        title: 'New Patient Note',
      });

      const mockNavigate = jest.fn();
      jest.doMock('react-router-dom', () => ({
        ...jest.requireActual('react-router-dom'),
        useNavigate: () => mockNavigate,
      }));

      render(
        <TestWrapper route="/patients/patient1">
          <PatientManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Click on Clinical Notes tab
      const clinicalNotesTab = screen.getByText('Clinical Notes');
      fireEvent.click(clinicalNotesTab);

      await waitFor(() => {
        expect(screen.getByText('New Note')).toBeInTheDocument();
      });

      // Click create note button
      const createButton = screen.getByText('New Note');
      fireEvent.click(createButton);

      // Should navigate to create note with patient context
      expect(mockNavigate).toHaveBeenCalledWith(
        '/notes/new?patientId=patient1'
      );
    });

    it('maintains patient context during note operations', async () => {
      render(
        <TestWrapper route="/notes/new?patientId=patient1">
          <ClinicalNoteFormPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Create Clinical Note')).toBeInTheDocument();
      });

      // Patient should be pre-selected
      const patientField = screen.getByDisplayValue('John Doe (MRN001)');
      expect(patientField).toBeInTheDocument();
      expect(patientField).toBeDisabled(); // Should be locked to patient context
    });
  });

  describe('End-to-End Workflow Integration', () => {
    it('completes full note creation workflow', async () => {
      const user = userEvent.setup();

      mockClinicalNoteService.createNote.mockResolvedValue({
        _id: 'new-note',
        ...mockNotes[0],
        title: 'Complete Workflow Note',
      });

      render(
        <TestWrapper route="/notes/new">
          <ClinicalNoteFormPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Create Clinical Note')).toBeInTheDocument();
      });

      // Fill out the form
      await user.type(screen.getByLabelText('Title'), 'Complete Workflow Note');
      await user.selectOptions(
        screen.getByLabelText('Note Type'),
        'consultation'
      );
      await user.type(
        screen.getByLabelText('Subjective'),
        'Patient reports improvement'
      );
      await user.type(screen.getByLabelText('Objective'), 'Vital signs normal');
      await user.type(
        screen.getByLabelText('Assessment'),
        'Condition improving'
      );
      await user.type(screen.getByLabelText('Plan'), 'Continue treatment');

      // Submit the form
      const submitButton = screen.getByText('Create Note');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockClinicalNoteService.createNote).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Complete Workflow Note',
            type: 'consultation',
            content: {
              subjective: 'Patient reports improvement',
              objective: 'Vital signs normal',
              assessment: 'Condition improving',
              plan: 'Continue treatment',
            },
          })
        );
      });
    });

    it('completes full note editing workflow', async () => {
      const user = userEvent.setup();

      mockClinicalNoteService.updateNote.mockResolvedValue({
        ...mockNotes[0],
        title: 'Updated Note Title',
      });

      render(
        <TestWrapper route="/notes/note1/edit">
          <ClinicalNoteFormPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Edit Clinical Note')).toBeInTheDocument();
      });

      // Form should be pre-populated
      expect(
        screen.getByDisplayValue('Initial Consultation')
      ).toBeInTheDocument();

      // Update the title
      const titleField = screen.getByLabelText('Title');
      await user.clear(titleField);
      await user.type(titleField, 'Updated Note Title');

      // Submit the form
      const submitButton = screen.getByText('Update Note');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockClinicalNoteService.updateNote).toHaveBeenCalledWith(
          'note1',
          expect.objectContaining({
            title: 'Updated Note Title',
          })
        );
      });
    });

    it('completes note viewing and navigation workflow', async () => {
      const mockNavigate = jest.fn();
      jest.doMock('react-router-dom', () => ({
        ...jest.requireActual('react-router-dom'),
        useNavigate: () => mockNavigate,
      }));

      render(
        <TestWrapper route="/notes/note1">
          <ClinicalNoteDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Initial Consultation')).toBeInTheDocument();
        expect(
          screen.getByText('Patient reports feeling better')
        ).toBeInTheDocument();
      });

      // Test navigation to edit
      const editButton = screen.getByText('Edit');
      fireEvent.click(editButton);

      expect(mockNavigate).toHaveBeenCalledWith('/notes/note1/edit');
    });

    it('handles bulk operations workflow', async () => {
      const user = userEvent.setup();

      mockClinicalNoteService.bulkUpdateNotes.mockResolvedValue({
        updated: 2,
        notes: mockNotes.map((note) => ({ ...note, priority: 'high' })),
      });

      render(
        <TestWrapper>
          <ClinicalNotes />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Clinical Notes')).toBeInTheDocument();
      });

      // Select multiple notes
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]); // First note checkbox
      await user.click(checkboxes[2]); // Second note checkbox

      // Open bulk actions menu
      const bulkActionsButton = screen.getByText('Bulk Actions');
      await user.click(bulkActionsButton);

      // Select bulk update priority
      const updatePriorityOption = screen.getByText('Update Priority');
      await user.click(updatePriorityOption);

      // Select high priority
      const highPriorityOption = screen.getByText('High');
      await user.click(highPriorityOption);

      // Confirm bulk action
      const confirmButton = screen.getByText('Update Selected');
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockClinicalNoteService.bulkUpdateNotes).toHaveBeenCalledWith(
          ['note1', 'note2'],
          { priority: 'high' }
        );
      });
    });
  });

  describe('Error Handling Integration', () => {
    it('handles authentication errors gracefully', async () => {
      mockClinicalNoteService.getNotes.mockRejectedValue(
        new Error('Authentication failed')
      );

      render(
        <TestWrapper>
          <ClinicalNotes />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Authentication Error')).toBeInTheDocument();
        expect(screen.getByText('Please log in again')).toBeInTheDocument();
      });
    });

    it('handles subscription limit errors', async () => {
      mockClinicalNoteService.createNote.mockRejectedValue(
        new Error('Usage limit exceeded')
      );

      render(
        <TestWrapper route="/notes/new">
          <ClinicalNoteFormPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Create Clinical Note')).toBeInTheDocument();
      });

      // Try to submit form
      const submitButton = screen.getByText('Create Note');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Usage Limit Exceeded')).toBeInTheDocument();
        expect(screen.getByText('Upgrade your plan')).toBeInTheDocument();
      });
    });

    it('handles network errors with retry options', async () => {
      mockClinicalNoteService.getNotes.mockRejectedValue(
        new Error('Network error')
      );

      render(
        <TestWrapper>
          <ClinicalNotes />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Connection Error')).toBeInTheDocument();
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });

      // Test retry functionality
      mockClinicalNoteService.getNotes.mockResolvedValue({
        notes: mockNotes,
        total: mockNotes.length,
        page: 1,
        totalPages: 1,
      });

      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('Clinical Notes')).toBeInTheDocument();
        expect(screen.getByText('Initial Consultation')).toBeInTheDocument();
      });
    });
  });

  describe('Performance Integration', () => {
    it('loads notes efficiently with pagination', async () => {
      const largeNoteSet = Array.from({ length: 100 }, (_, i) => ({
        ...mockNotes[0],
        _id: `note${i}`,
        title: `Note ${i}`,
      }));

      mockClinicalNoteService.getNotes.mockResolvedValue({
        notes: largeNoteSet.slice(0, 25),
        total: 100,
        page: 1,
        totalPages: 4,
      });

      render(
        <TestWrapper>
          <ClinicalNotes />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Clinical Notes')).toBeInTheDocument();
      });

      // Should only load first page
      expect(mockClinicalNoteService.getNotes).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          limit: 25,
        })
      );

      // Should show pagination
      expect(screen.getByText('1 of 4')).toBeInTheDocument();
    });

    it('implements virtual scrolling for large lists', async () => {
      const largeNoteSet = Array.from({ length: 1000 }, (_, i) => ({
        ...mockNotes[0],
        _id: `note${i}`,
        title: `Note ${i}`,
      }));

      mockClinicalNoteService.getNotes.mockResolvedValue({
        notes: largeNoteSet,
        total: 1000,
        page: 1,
        totalPages: 1,
      });

      render(
        <TestWrapper>
          <ClinicalNotes />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Clinical Notes')).toBeInTheDocument();
      });

      // Should use virtual scrolling component
      expect(screen.getByTestId('virtualized-list')).toBeInTheDocument();
    });
  });
});
