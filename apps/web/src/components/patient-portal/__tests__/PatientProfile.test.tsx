import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { PatientAuthContext } from '../../../contexts/PatientAuthContext';
import { PatientProfile } from '../../../pages/patient-portal/PatientProfile';

// Mock the hooks
jest.mock('../../../hooks/usePatientProfile', () => ({
  usePatientProfile: () => ({
    profile: {
      _id: 'test-patient-id',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '+234-801-234-5678',
      dob: '1990-01-15',
      gender: 'male',
      bloodGroup: 'O+',
      genotype: 'AA',
    },
    loading: false,
    error: null,
    updateProfile: jest.fn(),
    updateLoading: false,
    updateError: null,
    updateSuccess: false,
    refreshProfile: jest.fn(),
  }),
}));

const theme = createTheme();

const mockPatientAuthContext = {
  user: {
    id: 'test-user-id',
    email: 'john.doe@example.com',
    firstName: 'John',
    lastName: 'Doe',
    workspaceId: 'test-workspace',
    workspaceName: 'Test Pharmacy',
    status: 'active' as const,
    emailVerified: true,
    profileComplete: true,
  },
  loading: false,
  isAuthenticated: true,
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  verifyEmail: jest.fn(),
  forgotPassword: jest.fn(),
  resetPassword: jest.fn(),
  updateProfile: jest.fn(),
  refreshToken: jest.fn(),
  checkAuthStatus: jest.fn(),
};

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      <PatientAuthContext.Provider value={mockPatientAuthContext}>
        {component}
      </PatientAuthContext.Provider>
    </ThemeProvider>
  );
};

describe('PatientProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders patient profile page', () => {
    renderWithProviders(<PatientProfile />);
    
    expect(screen.getByText('My Profile')).toBeInTheDocument();
    expect(screen.getByText('Manage your personal information and medical details')).toBeInTheDocument();
  });

  it('displays profile tabs', () => {
    renderWithProviders(<PatientProfile />);
    
    expect(screen.getByText('Demographics')).toBeInTheDocument();
    expect(screen.getByText('Contact Information')).toBeInTheDocument();
    expect(screen.getByText('Medical Information')).toBeInTheDocument();
  });

  it('shows edit button when not in edit mode', () => {
    renderWithProviders(<PatientProfile />);
    
    expect(screen.getByText('Edit Profile')).toBeInTheDocument();
  });

  it('switches to edit mode when edit button is clicked', async () => {
    renderWithProviders(<PatientProfile />);
    
    const editButton = screen.getByText('Edit Profile');
    fireEvent.click(editButton);
    
    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  it('displays form fields in demographics tab', () => {
    renderWithProviders(<PatientProfile />);
    
    expect(screen.getByDisplayValue('John')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Doe')).toBeInTheDocument();
  });

  it('switches between tabs', async () => {
    renderWithProviders(<PatientProfile />);
    
    // Click on Contact Information tab
    const contactTab = screen.getByText('Contact Information');
    fireEvent.click(contactTab);
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('john.doe@example.com')).toBeInTheDocument();
      expect(screen.getByDisplayValue('+234-801-234-5678')).toBeInTheDocument();
    });
  });

  it('displays medical information in medical tab', async () => {
    renderWithProviders(<PatientProfile />);
    
    // Click on Medical Information tab
    const medicalTab = screen.getByText('Medical Information');
    fireEvent.click(medicalTab);
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('O+')).toBeInTheDocument();
      expect(screen.getByDisplayValue('AA')).toBeInTheDocument();
    });
  });
});

describe('AllergyManagement', () => {
  const mockProps = {
    allergies: [
      {
        _id: 'allergy-1',
        allergen: 'Penicillin',
        reaction: 'Skin rash',
        severity: 'moderate' as const,
        recordedDate: '2024-01-01',
      },
    ],
    loading: false,
    error: null,
    onAddAllergy: jest.fn(),
    onUpdateAllergy: jest.fn(),
    onDeleteAllergy: jest.fn(),
    readonly: false,
  };

  it('renders allergy management component', async () => {
    const { AllergyManagement } = await import('../AllergyManagement');
    
    renderWithProviders(<AllergyManagement {...mockProps} />);
    
    expect(screen.getByText('Allergies & Adverse Reactions')).toBeInTheDocument();
    expect(screen.getByText('Penicillin')).toBeInTheDocument();
  });

  it('shows add allergy button when not readonly', async () => {
    const { AllergyManagement } = await import('../AllergyManagement');
    
    renderWithProviders(<AllergyManagement {...mockProps} />);
    
    expect(screen.getByText('Add Allergy')).toBeInTheDocument();
  });

  it('displays empty state when no allergies', async () => {
    const { AllergyManagement } = await import('../AllergyManagement');
    
    const emptyProps = { ...mockProps, allergies: [] };
    renderWithProviders(<AllergyManagement {...emptyProps} />);
    
    expect(screen.getByText('No Allergies Recorded')).toBeInTheDocument();
  });
});

describe('ConditionManagement', () => {
  const mockProps = {
    conditions: [
      {
        _id: 'condition-1',
        name: 'Hypertension',
        status: 'active' as const,
        onsetDate: '2020-01-01',
        recordedDate: '2024-01-01',
      },
    ],
    loading: false,
    error: null,
    onAddCondition: jest.fn(),
    onUpdateCondition: jest.fn(),
    onDeleteCondition: jest.fn(),
    readonly: false,
  };

  it('renders condition management component', async () => {
    const { ConditionManagement } = await import('../ConditionManagement');
    
    renderWithProviders(<ConditionManagement {...mockProps} />);
    
    expect(screen.getByText('Chronic Conditions')).toBeInTheDocument();
    expect(screen.getByText('Hypertension')).toBeInTheDocument();
  });

  it('shows add condition button when not readonly', async () => {
    const { ConditionManagement } = await import('../ConditionManagement');
    
    renderWithProviders(<ConditionManagement {...mockProps} />);
    
    expect(screen.getByText('Add Condition')).toBeInTheDocument();
  });
});

describe('EmergencyContacts', () => {
  const mockProps = {
    contacts: [
      {
        _id: 'contact-1',
        name: 'Jane Doe',
        relationship: 'Spouse',
        phone: '+234-802-345-6789',
        email: 'jane.doe@example.com',
        isPrimary: true,
      },
    ],
    loading: false,
    error: null,
    onAddContact: jest.fn(),
    onUpdateContact: jest.fn(),
    onDeleteContact: jest.fn(),
    readonly: false,
  };

  it('renders emergency contacts component', async () => {
    const { EmergencyContacts } = await import('../EmergencyContacts');
    
    renderWithProviders(<EmergencyContacts {...mockProps} />);
    
    expect(screen.getByText('Emergency Contacts')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });

  it('shows primary contact designation', async () => {
    const { EmergencyContacts } = await import('../EmergencyContacts');
    
    renderWithProviders(<EmergencyContacts {...mockProps} />);
    
    expect(screen.getByText('Primary Emergency Contact')).toBeInTheDocument();
    expect(screen.getByText('Primary')).toBeInTheDocument();
  });
});

describe('InsuranceInfo', () => {
  const mockProps = {
    insuranceInfo: {
      provider: 'Hygeia HMO',
      policyNumber: 'HYG-2024-001234',
      expiryDate: '2024-12-31',
      copayAmount: 5000,
    },
    loading: false,
    error: null,
    onUpdateInsurance: jest.fn(),
    readonly: false,
  };

  it('renders insurance info component', async () => {
    const { InsuranceInfo } = await import('../InsuranceInfo');
    
    renderWithProviders(<InsuranceInfo {...mockProps} />);
    
    expect(screen.getByText('Insurance Information')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Hygeia HMO')).toBeInTheDocument();
  });

  it('shows edit button when not readonly', async () => {
    const { InsuranceInfo } = await import('../InsuranceInfo');
    
    renderWithProviders(<InsuranceInfo {...mockProps} />);
    
    expect(screen.getByText('Edit Insurance')).toBeInTheDocument();
  });
});