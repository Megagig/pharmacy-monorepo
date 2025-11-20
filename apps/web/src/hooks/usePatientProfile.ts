import { useState, useEffect, useCallback } from 'react';
import { usePatientAuth } from './usePatientAuth';
import { Patient } from '../types/patientManagement';

interface PatientProfileHookReturn {
  profile: Patient | null;
  loading: boolean;
  error: string | null;
  updateProfile: (profileData: Partial<Patient>) => Promise<void>;
  updateLoading: boolean;
  updateError: string | null;
  updateSuccess: boolean;
  refreshProfile: () => Promise<void>;
}

interface PatientProfileResponse {
  success: boolean;
  data?: {
    patient: Patient;
  };
  message?: string;
  error?: {
    message: string;
  };
}

interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
  isPrimary: boolean;
}

interface InsuranceInfo {
  provider?: string;
  policyNumber?: string;
  expiryDate?: string;
  coverageDetails?: string;
  copayAmount?: number;
}

interface Allergy {
  allergen: string;
  reaction: string;
  severity: 'mild' | 'moderate' | 'severe';
}

interface Condition {
  name: string;
  onsetDate?: string;
  status: 'active' | 'resolved' | 'remission';
  notes?: string;
}

// Patient Profile API Service
class PatientProfileService {
  private static baseUrl = '/api/patient-portal';

  private static async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = localStorage.getItem('patient_auth_token');
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Network error' }));
      throw new Error(error.message || error.error?.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  static async getProfile(): Promise<PatientProfileResponse> {
    // Mock implementation - replace with actual API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const mockProfile: Patient = {
      _id: 'patient_123',
      pharmacyId: 'pharmacy_456',
      firstName: 'John',
      lastName: 'Doe',
      otherNames: 'Michael',
      mrn: 'PHM-LAG-001234',
      dob: '1990-01-15',
      age: 34,
      gender: 'male',
      phone: '+234-801-234-5678',
      email: 'john.doe@example.com',
      address: '123 Victoria Island, Lagos',
      state: 'Lagos',
      lga: 'Lagos Island',
      maritalStatus: 'married',
      bloodGroup: 'O+',
      genotype: 'AA',
      weightKg: 75.5,
      displayName: 'John Michael Doe',
      calculatedAge: 34,
      createdBy: 'system',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-15T10:30:00.000Z',
    };

    return {
      success: true,
      data: { patient: mockProfile },
      message: 'Profile retrieved successfully',
    };
  }

  static async updateProfile(profileData: Partial<Patient>): Promise<PatientProfileResponse> {
    // Mock implementation - replace with actual API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Simulate validation errors
    if (profileData.email === 'invalid@email') {
      throw new Error('Invalid email address');
    }

    if (profileData.phone && !profileData.phone.startsWith('+234')) {
      throw new Error('Phone number must be in Nigerian format (+234XXXXXXXXXX)');
    }

    // Mock successful update
    const updatedProfile: Patient = {
      _id: 'patient_123',
      pharmacyId: 'pharmacy_456',
      firstName: profileData.firstName || 'John',
      lastName: profileData.lastName || 'Doe',
      otherNames: profileData.otherNames || 'Michael',
      mrn: 'PHM-LAG-001234',
      dob: profileData.dob || '1990-01-15',
      age: profileData.age || 34,
      gender: profileData.gender || 'male',
      phone: profileData.phone || '+234-801-234-5678',
      email: profileData.email || 'john.doe@example.com',
      address: profileData.address || '123 Victoria Island, Lagos',
      state: profileData.state || 'Lagos',
      lga: profileData.lga || 'Lagos Island',
      maritalStatus: profileData.maritalStatus || 'married',
      bloodGroup: profileData.bloodGroup || 'O+',
      genotype: profileData.genotype || 'AA',
      weightKg: profileData.weightKg || 75.5,
      displayName: `${profileData.firstName || 'John'} ${profileData.otherNames || 'Michael'} ${profileData.lastName || 'Doe'}`,
      calculatedAge: profileData.age || 34,
      createdBy: 'system',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: new Date().toISOString(),
    };

    return {
      success: true,
      data: { patient: updatedProfile },
      message: 'Profile updated successfully',
    };
  }

  // Emergency Contacts Management
  static async getEmergencyContacts(): Promise<{ contacts: EmergencyContact[] }> {
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const mockContacts: EmergencyContact[] = [
      {
        name: 'Jane Doe',
        relationship: 'Spouse',
        phone: '+234-802-345-6789',
        email: 'jane.doe@example.com',
        isPrimary: true,
      },
      {
        name: 'Mary Doe',
        relationship: 'Mother',
        phone: '+234-803-456-7890',
        email: 'mary.doe@example.com',
        isPrimary: false,
      },
    ];

    return { contacts: mockContacts };
  }

  static async addEmergencyContact(contactData: Omit<EmergencyContact, '_id'>): Promise<{ contact: EmergencyContact }> {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      contact: {
        ...contactData,
      },
    };
  }

  static async updateEmergencyContact(contactId: string, contactData: Partial<EmergencyContact>): Promise<{ contact: EmergencyContact }> {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      contact: {
        name: contactData.name || 'Updated Contact',
        relationship: contactData.relationship || 'Friend',
        phone: contactData.phone || '+234-800-000-0000',
        email: contactData.email,
        isPrimary: contactData.isPrimary || false,
      },
    };
  }

  static async deleteEmergencyContact(contactId: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 800));
  }

  // Insurance Information Management
  static async getInsuranceInfo(): Promise<{ insurance: InsuranceInfo }> {
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const mockInsurance: InsuranceInfo = {
      provider: 'Hygeia HMO',
      policyNumber: 'HYG-2024-001234',
      expiryDate: '2024-12-31',
      coverageDetails: 'Comprehensive health coverage including outpatient, inpatient, and emergency services',
      copayAmount: 5000,
    };

    return { insurance: mockInsurance };
  }

  static async updateInsuranceInfo(insuranceData: InsuranceInfo): Promise<{ insurance: InsuranceInfo }> {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      insurance: insuranceData,
    };
  }

  // Allergies Management
  static async getAllergies(): Promise<{ allergies: Allergy[] }> {
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const mockAllergies: Allergy[] = [
      {
        allergen: 'Penicillin',
        reaction: 'Skin rash and itching',
        severity: 'moderate',
      },
      {
        allergen: 'Shellfish',
        reaction: 'Swelling and difficulty breathing',
        severity: 'severe',
      },
    ];

    return { allergies: mockAllergies };
  }

  static async addAllergy(allergyData: Omit<Allergy, '_id'>): Promise<{ allergy: Allergy }> {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      allergy: allergyData,
    };
  }

  static async updateAllergy(allergyId: string, allergyData: Partial<Allergy>): Promise<{ allergy: Allergy }> {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      allergy: {
        allergen: allergyData.allergen || 'Updated Allergen',
        reaction: allergyData.reaction || 'Updated reaction',
        severity: allergyData.severity || 'mild',
      },
    };
  }

  static async deleteAllergy(allergyId: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 800));
  }

  // Conditions Management
  static async getConditions(): Promise<{ conditions: Condition[] }> {
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const mockConditions: Condition[] = [
      {
        name: 'Hypertension',
        onsetDate: '2020-03-15',
        status: 'active',
        notes: 'Well controlled with medication',
      },
      {
        name: 'Diabetes Type 2',
        onsetDate: '2019-08-20',
        status: 'active',
        notes: 'Managed with diet and medication',
      },
    ];

    return { conditions: mockConditions };
  }

  static async addCondition(conditionData: Omit<Condition, '_id'>): Promise<{ condition: Condition }> {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      condition: conditionData,
    };
  }

  static async updateCondition(conditionId: string, conditionData: Partial<Condition>): Promise<{ condition: Condition }> {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      condition: {
        name: conditionData.name || 'Updated Condition',
        onsetDate: conditionData.onsetDate,
        status: conditionData.status || 'active',
        notes: conditionData.notes,
      },
    };
  }

  static async deleteCondition(conditionId: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 800));
  }
}

export const usePatientProfile = (): PatientProfileHookReturn => {
  const { user, isAuthenticated } = usePatientAuth();
  const [profile, setProfile] = useState<Patient | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [updateLoading, setUpdateLoading] = useState<boolean>(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState<boolean>(false);

  // Load profile when user is authenticated
  const loadProfile = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setProfile(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await PatientProfileService.getProfile();
      if (response.success && response.data) {
        setProfile(response.data.patient);
      } else {
        throw new Error(response.message || 'Failed to load profile');
      }
    } catch (err: any) {
      console.error('Failed to load patient profile:', err);
      setError(err.message || 'Failed to load profile');
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user]);

  // Load profile on mount and when authentication changes
  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Update profile function
  const updateProfile = useCallback(async (profileData: Partial<Patient>) => {
    if (!isAuthenticated || !user) {
      throw new Error('User not authenticated');
    }

    setUpdateLoading(true);
    setUpdateError(null);
    setUpdateSuccess(false);

    try {
      const response = await PatientProfileService.updateProfile(profileData);
      if (response.success && response.data) {
        setProfile(response.data.patient);
        setUpdateSuccess(true);
        
        // Clear success flag after 3 seconds
        setTimeout(() => {
          setUpdateSuccess(false);
        }, 3000);
      } else {
        throw new Error(response.message || 'Failed to update profile');
      }
    } catch (err: any) {
      console.error('Failed to update patient profile:', err);
      setUpdateError(err.message || 'Failed to update profile');
      throw err;
    } finally {
      setUpdateLoading(false);
    }
  }, [isAuthenticated, user]);

  // Refresh profile function
  const refreshProfile = useCallback(async () => {
    await loadProfile();
  }, [loadProfile]);

  return {
    profile,
    loading,
    error,
    updateProfile,
    updateLoading,
    updateError,
    updateSuccess,
    refreshProfile,
  };
};

// Additional hooks for specific profile sections

export const useEmergencyContacts = () => {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await PatientProfileService.getEmergencyContacts();
      setContacts(response.contacts);
    } catch (err: any) {
      console.error('Failed to load emergency contacts:', err);
      setError(err.message || 'Failed to load emergency contacts');
    } finally {
      setLoading(false);
    }
  }, []);

  const addContact = useCallback(async (contactData: Omit<EmergencyContact, '_id'>) => {
    const response = await PatientProfileService.addEmergencyContact(contactData);
    await loadContacts(); // Refresh the list
    return response.contact;
  }, [loadContacts]);

  const updateContact = useCallback(async (contactId: string, contactData: Partial<EmergencyContact>) => {
    const response = await PatientProfileService.updateEmergencyContact(contactId, contactData);
    await loadContacts(); // Refresh the list
    return response.contact;
  }, [loadContacts]);

  const deleteContact = useCallback(async (contactId: string) => {
    await PatientProfileService.deleteEmergencyContact(contactId);
    await loadContacts(); // Refresh the list
  }, [loadContacts]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  return {
    contacts,
    loading,
    error,
    addContact,
    updateContact,
    deleteContact,
    refreshContacts: loadContacts,
  };
};

export const useInsuranceInfo = () => {
  const [insurance, setInsurance] = useState<InsuranceInfo>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadInsurance = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await PatientProfileService.getInsuranceInfo();
      setInsurance(response.insurance);
    } catch (err: any) {
      console.error('Failed to load insurance info:', err);
      setError(err.message || 'Failed to load insurance information');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateInsurance = useCallback(async (insuranceData: InsuranceInfo) => {
    const response = await PatientProfileService.updateInsuranceInfo(insuranceData);
    setInsurance(response.insurance);
    return response.insurance;
  }, []);

  useEffect(() => {
    loadInsurance();
  }, [loadInsurance]);

  return {
    insurance,
    loading,
    error,
    updateInsurance,
    refreshInsurance: loadInsurance,
  };
};

export const useAllergies = () => {
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadAllergies = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await PatientProfileService.getAllergies();
      setAllergies(response.allergies);
    } catch (err: any) {
      console.error('Failed to load allergies:', err);
      setError(err.message || 'Failed to load allergies');
    } finally {
      setLoading(false);
    }
  }, []);

  const addAllergy = useCallback(async (allergyData: Omit<Allergy, '_id'>) => {
    const response = await PatientProfileService.addAllergy(allergyData);
    await loadAllergies(); // Refresh the list
    return response.allergy;
  }, [loadAllergies]);

  const updateAllergy = useCallback(async (allergyId: string, allergyData: Partial<Allergy>) => {
    const response = await PatientProfileService.updateAllergy(allergyId, allergyData);
    await loadAllergies(); // Refresh the list
    return response.allergy;
  }, [loadAllergies]);

  const deleteAllergy = useCallback(async (allergyId: string) => {
    await PatientProfileService.deleteAllergy(allergyId);
    await loadAllergies(); // Refresh the list
  }, [loadAllergies]);

  useEffect(() => {
    loadAllergies();
  }, [loadAllergies]);

  return {
    allergies,
    loading,
    error,
    addAllergy,
    updateAllergy,
    deleteAllergy,
    refreshAllergies: loadAllergies,
  };
};

export const useConditions = () => {
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadConditions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await PatientProfileService.getConditions();
      setConditions(response.conditions);
    } catch (err: any) {
      console.error('Failed to load conditions:', err);
      setError(err.message || 'Failed to load conditions');
    } finally {
      setLoading(false);
    }
  }, []);

  const addCondition = useCallback(async (conditionData: Omit<Condition, '_id'>) => {
    const response = await PatientProfileService.addCondition(conditionData);
    await loadConditions(); // Refresh the list
    return response.condition;
  }, [loadConditions]);

  const updateCondition = useCallback(async (conditionId: string, conditionData: Partial<Condition>) => {
    const response = await PatientProfileService.updateCondition(conditionId, conditionData);
    await loadConditions(); // Refresh the list
    return response.condition;
  }, [loadConditions]);

  const deleteCondition = useCallback(async (conditionId: string) => {
    await PatientProfileService.deleteCondition(conditionId);
    await loadConditions(); // Refresh the list
  }, [loadConditions]);

  useEffect(() => {
    loadConditions();
  }, [loadConditions]);

  return {
    conditions,
    loading,
    error,
    addCondition,
    updateCondition,
    deleteCondition,
    refreshConditions: loadConditions,
  };
};

export default usePatientProfile;