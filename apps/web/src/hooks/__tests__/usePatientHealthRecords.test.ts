import { renderHook, act, waitFor } from '@testing-library/react';
import { usePatientHealthRecords } from '../usePatientHealthRecords';
import { usePatientAuth } from '../usePatientAuth';

// Mock the usePatientAuth hook
jest.mock('../usePatientAuth');
const mockUsePatientAuth = usePatientAuth as jest.MockedFunction<typeof usePatientAuth>;

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

// Mock URL.createObjectURL and related methods
global.URL.createObjectURL = jest.fn(() => 'mock-url');
global.URL.revokeObjectURL = jest.fn();

describe('usePatientHealthRecords', () => {
  const mockUser = {
    _id: 'user_123',
    patientId: 'patient_123',
    email: 'test@example.com',
    workplaceId: 'workplace_123'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue('mock-token');
    
    // Mock successful auth by default
    mockUsePatientAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      login: jest.fn(),
      logout: jest.fn(),
      loading: false,
      error: null
    });
  });

  it('initializes with null values when not authenticated', () => {
    mockUsePatientAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      login: jest.fn(),
      logout: jest.fn(),
      loading: false,
      error: null
    });

    const { result } = renderHook(() => usePatientHealthRecords('patient_123'));

    expect(result.current.labResults).toBeNull();
    expect(result.current.visitHistory).toBeNull();
    expect(result.current.vitalsHistory).toBeNull();
    expect(result.current.vitalsTrends).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('loads health records when authenticated', async () => {
    const mockResponse = {
      success: true,
      data: {
        labResults: [
          {
            _id: 'lab_001',
            patientId: 'patient_123',
            testDate: '2024-03-15',
            testType: 'CBC',
            status: 'completed',
            results: [],
            createdAt: '2024-03-15T10:00:00.000Z',
            updatedAt: '2024-03-15T10:00:00.000Z'
          }
        ],
        visitHistory: [
          {
            _id: 'visit_001',
            patientId: 'patient_123',
            visitDate: '2024-03-20',
            visitType: 'Consultation',
            createdAt: '2024-03-20T14:00:00.000Z',
            updatedAt: '2024-03-20T14:00:00.000Z'
          }
        ],
        vitalsHistory: [
          {
            recordedDate: '2024-03-22T08:00:00.000Z',
            bloodPressure: { systolic: 120, diastolic: 80 },
            heartRate: 72,
            source: 'patient_portal' as const
          }
        ],
        vitalsTrends: {
          readings: [],
          trends: [],
          insights: [],
          summary: {
            totalReadings: 1,
            daysTracked: 1,
            lastReading: '2024-03-22T08:00:00.000Z',
            averages: {}
          }
        }
      }
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    } as Response);

    const { result } = renderHook(() => usePatientHealthRecords('patient_123'));

    // Initially loading
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.labResults).toHaveLength(1);
    expect(result.current.visitHistory).toHaveLength(1);
    expect(result.current.vitalsHistory).toHaveLength(1);
    expect(result.current.vitalsTrends).toBeDefined();
    expect(result.current.error).toBeNull();
  });

  it('handles API errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => usePatientHealthRecords('patient_123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.labResults).toBeNull();
    expect(result.current.visitHistory).toBeNull();
    expect(result.current.vitalsHistory).toBeNull();
    expect(result.current.vitalsTrends).toBeNull();
  });

  it('logs vitals successfully', async () => {
    // Mock initial data load
    const mockInitialResponse = {
      success: true,
      data: {
        labResults: [],
        visitHistory: [],
        vitalsHistory: [],
        vitalsTrends: {
          readings: [],
          trends: [],
          insights: [],
          summary: { totalReadings: 0, daysTracked: 0, lastReading: '', averages: {} }
        }
      }
    };

    const mockVitalsResponse = {
      success: true,
      data: {
        vital: {
          recordedDate: '2024-03-22T08:00:00.000Z',
          bloodPressure: { systolic: 120, diastolic: 80 },
          heartRate: 72,
          source: 'patient_portal' as const
        }
      }
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockInitialResponse
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockVitalsResponse
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockInitialResponse
      } as Response);

    const { result } = renderHook(() => usePatientHealthRecords('patient_123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const vitalsData = {
      bloodPressureSystolic: 120,
      bloodPressureDiastolic: 80,
      heartRate: 72
    };

    await act(async () => {
      await result.current.logVitals(vitalsData);
    });

    expect(result.current.vitalsLoading).toBe(false);
    expect(result.current.vitalsHistory).toHaveLength(1);
  });

  it('handles vitals logging errors', async () => {
    // Mock initial data load
    const mockInitialResponse = {
      success: true,
      data: {
        labResults: [],
        visitHistory: [],
        vitalsHistory: [],
        vitalsTrends: {
          readings: [],
          trends: [],
          insights: [],
          summary: { totalReadings: 0, daysTracked: 0, lastReading: '', averages: {} }
        }
      }
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockInitialResponse
      } as Response)
      .mockRejectedValueOnce(new Error('Vitals logging failed'));

    const { result } = renderHook(() => usePatientHealthRecords('patient_123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const vitalsData = {
      heartRate: 72
    };

    await expect(act(async () => {
      await result.current.logVitals(vitalsData);
    })).rejects.toThrow('Vitals logging failed');

    expect(result.current.vitalsLoading).toBe(false);
  });

  it('downloads medical records successfully', async () => {
    // Mock initial data load
    const mockInitialResponse = {
      success: true,
      data: {
        labResults: [],
        visitHistory: [],
        vitalsHistory: [],
        vitalsTrends: {
          readings: [],
          trends: [],
          insights: [],
          summary: { totalReadings: 0, daysTracked: 0, lastReading: '', averages: {} }
        }
      }
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockInitialResponse
    } as Response);

    // Mock DOM methods
    const mockLink = {
      href: '',
      download: '',
      click: jest.fn()
    };
    const mockCreateElement = jest.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
    const mockAppendChild = jest.spyOn(document.body, 'appendChild').mockImplementation();
    const mockRemoveChild = jest.spyOn(document.body, 'removeChild').mockImplementation();

    const { result } = renderHook(() => usePatientHealthRecords('patient_123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.downloadMedicalRecords();
    });

    expect(result.current.downloadLoading).toBe(false);
    expect(mockCreateElement).toHaveBeenCalledWith('a');
    expect(mockLink.click).toHaveBeenCalled();
    expect(mockAppendChild).toHaveBeenCalled();
    expect(mockRemoveChild).toHaveBeenCalled();

    // Cleanup
    mockCreateElement.mockRestore();
    mockAppendChild.mockRestore();
    mockRemoveChild.mockRestore();
  });

  it('refreshes health records', async () => {
    const mockResponse = {
      success: true,
      data: {
        labResults: [],
        visitHistory: [],
        vitalsHistory: [],
        vitalsTrends: {
          readings: [],
          trends: [],
          insights: [],
          summary: { totalReadings: 0, daysTracked: 0, lastReading: '', averages: {} }
        }
      }
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

    const { result } = renderHook(() => usePatientHealthRecords('patient_123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.refreshHealthRecords();
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('does not load data when patientId is not provided', () => {
    const { result } = renderHook(() => usePatientHealthRecords());

    expect(result.current.labResults).toBeNull();
    expect(result.current.visitHistory).toBeNull();
    expect(result.current.vitalsHistory).toBeNull();
    expect(result.current.vitalsTrends).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('throws error when trying to log vitals without authentication', async () => {
    mockUsePatientAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      login: jest.fn(),
      logout: jest.fn(),
      loading: false,
      error: null
    });

    const { result } = renderHook(() => usePatientHealthRecords('patient_123'));

    await expect(act(async () => {
      await result.current.logVitals({ heartRate: 72 });
    })).rejects.toThrow('User not authenticated');
  });

  it('throws error when trying to download records without authentication', async () => {
    mockUsePatientAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      login: jest.fn(),
      logout: jest.fn(),
      loading: false,
      error: null
    });

    const { result } = renderHook(() => usePatientHealthRecords('patient_123'));

    await expect(act(async () => {
      await result.current.downloadMedicalRecords();
    })).rejects.toThrow('User not authenticated');
  });
});