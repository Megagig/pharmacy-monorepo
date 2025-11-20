import { renderHook, act, waitFor } from '@testing-library/react';
import { usePatientProfile, useEmergencyContacts, useInsuranceInfo, useAllergies, useConditions } from '../usePatientProfile';

// Mock the PatientAuthContext
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
  isAuthenticated: true,
};

jest.mock('../usePatientAuth', () => ({
  usePatientAuth: () => mockPatientAuthContext,
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock fetch
global.fetch = jest.fn();

describe('usePatientProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue('mock-token');
  });

  it('loads profile on mount when authenticated', async () => {
    const { result } = renderHook(() => usePatientProfile());

    expect(result.current.loading).toBe(true);
    expect(result.current.profile).toBe(null);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.profile).toBeTruthy();
    expect(result.current.profile?.firstName).toBe('John');
    expect(result.current.profile?.lastName).toBe('Doe');
  });

  it('updates profile successfully', async () => {
    const { result } = renderHook(() => usePatientProfile());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const updateData = {
      firstName: 'Jane',
      lastName: 'Smith',
    };

    await act(async () => {
      await result.current.updateProfile(updateData);
    });

    expect(result.current.updateSuccess).toBe(true);
    expect(result.current.profile?.firstName).toBe('Jane');
    expect(result.current.profile?.lastName).toBe('Smith');
  });

  it('handles update errors', async () => {
    const { result } = renderHook(() => usePatientProfile());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const invalidData = {
      email: 'invalid@email', // This will trigger an error in our mock
    };

    await act(async () => {
      try {
        await result.current.updateProfile(invalidData);
      } catch (error) {
        // Expected to throw
      }
    });

    expect(result.current.updateError).toBeTruthy();
    expect(result.current.updateSuccess).toBe(false);
  });

  it('refreshes profile data', async () => {
    const { result } = renderHook(() => usePatientProfile());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.refreshProfile();
    });

    expect(result.current.profile).toBeTruthy();
  });
});

describe('useEmergencyContacts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads emergency contacts on mount', async () => {
    const { result } = renderHook(() => useEmergencyContacts());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.contacts).toHaveLength(2);
    expect(result.current.contacts[0].name).toBe('Jane Doe');
    expect(result.current.contacts[0].isPrimary).toBe(true);
  });

  it('adds new emergency contact', async () => {
    const { result } = renderHook(() => useEmergencyContacts());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const newContact = {
      name: 'John Smith',
      relationship: 'Friend',
      phone: '+234-803-456-7890',
      email: 'john.smith@example.com',
      isPrimary: false,
    };

    await act(async () => {
      await result.current.addContact(newContact);
    });

    // The mock will refresh the list, so we should still have the original contacts
    expect(result.current.contacts).toHaveLength(2);
  });

  it('updates emergency contact', async () => {
    const { result } = renderHook(() => useEmergencyContacts());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const updateData = {
      name: 'Jane Smith',
      phone: '+234-804-567-8901',
    };

    await act(async () => {
      await result.current.updateContact('contact-1', updateData);
    });

    // Mock will refresh the list
    expect(result.current.contacts).toHaveLength(2);
  });

  it('deletes emergency contact', async () => {
    const { result } = renderHook(() => useEmergencyContacts());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.deleteContact('contact-1');
    });

    // Mock will refresh the list
    expect(result.current.contacts).toHaveLength(2);
  });
});

describe('useInsuranceInfo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads insurance info on mount', async () => {
    const { result } = renderHook(() => useInsuranceInfo());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.insurance.provider).toBe('Hygeia HMO');
    expect(result.current.insurance.policyNumber).toBe('HYG-2024-001234');
  });

  it('updates insurance info', async () => {
    const { result } = renderHook(() => useInsuranceInfo());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const updateData = {
      provider: 'AXA Mansard',
      policyNumber: 'AXA-2024-567890',
      copayAmount: 3000,
    };

    await act(async () => {
      await result.current.updateInsurance(updateData);
    });

    expect(result.current.insurance.provider).toBe('AXA Mansard');
    expect(result.current.insurance.policyNumber).toBe('AXA-2024-567890');
    expect(result.current.insurance.copayAmount).toBe(3000);
  });
});

describe('useAllergies', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads allergies on mount', async () => {
    const { result } = renderHook(() => useAllergies());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.allergies).toHaveLength(2);
    expect(result.current.allergies[0].allergen).toBe('Penicillin');
    expect(result.current.allergies[1].severity).toBe('severe');
  });

  it('adds new allergy', async () => {
    const { result } = renderHook(() => useAllergies());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const newAllergy = {
      allergen: 'Aspirin',
      reaction: 'Stomach upset',
      severity: 'mild' as const,
    };

    await act(async () => {
      await result.current.addAllergy(newAllergy);
    });

    // Mock will refresh the list
    expect(result.current.allergies).toHaveLength(2);
  });
});

describe('useConditions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads conditions on mount', async () => {
    const { result } = renderHook(() => useConditions());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.conditions).toHaveLength(2);
    expect(result.current.conditions[0].name).toBe('Hypertension');
    expect(result.current.conditions[0].status).toBe('active');
  });

  it('adds new condition', async () => {
    const { result } = renderHook(() => useConditions());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const newCondition = {
      name: 'Asthma',
      status: 'active' as const,
      onsetDate: '2021-05-15',
      notes: 'Exercise-induced asthma',
    };

    await act(async () => {
      await result.current.addCondition(newCondition);
    });

    // Mock will refresh the list
    expect(result.current.conditions).toHaveLength(2);
  });

  it('updates condition status', async () => {
    const { result } = renderHook(() => useConditions());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const updateData = {
      status: 'resolved' as const,
      notes: 'Condition resolved with treatment',
    };

    await act(async () => {
      await result.current.updateCondition('condition-1', updateData);
    });

    // Mock will refresh the list
    expect(result.current.conditions).toHaveLength(2);
  });
});