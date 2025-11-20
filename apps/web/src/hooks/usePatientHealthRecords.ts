import { useState, useEffect, useCallback } from 'react';
import { usePatientAuth } from './usePatientAuth';

// Types for lab results
interface LabTestResult {
  testName: string;
  value: number | string;
  unit: string;
  referenceRange: {
    min?: number;
    max?: number;
    normal?: string;
  };
  status: 'normal' | 'high' | 'low' | 'critical';
  flag?: string;
}

interface LabResult {
  _id: string;
  patientId: string;
  testDate: string;
  testType: string;
  orderingPhysician?: string;
  pharmacistName?: string;
  labName?: string;
  status: 'pending' | 'completed' | 'reviewed';
  results: LabTestResult[];
  interpretation?: string;
  recommendations?: string;
  followUpRequired?: boolean;
  attachments?: Array<{
    filename: string;
    url: string;
    type: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

// Types for visit history
interface Visit {
  _id: string;
  patientId: string;
  visitDate: string;
  visitType?: string;
  chiefComplaint?: string;
  assessment?: string;
  recommendations?: string;
  pharmacistName?: string;
  status?: string;
  followUpRequired?: boolean;
  createdAt: string;
  updatedAt: string;
}

// Types for vitals
interface VitalReading {
  recordedDate: string;
  bloodPressure?: { systolic: number; diastolic: number };
  heartRate?: number;
  temperature?: number;
  weight?: number;
  glucose?: number;
  oxygenSaturation?: number;
  notes?: string;
  source: 'patient_portal';
}

interface VitalsTrend {
  metric: string;
  trend: 'up' | 'down' | 'stable';
  change: number;
  status: 'normal' | 'warning' | 'critical';
}

interface VitalsInsight {
  type: 'success' | 'warning' | 'error' | 'info';
  message: string;
  metric?: string;
}

interface VitalsTrendsData {
  readings: Array<{
    date: string;
    bloodPressureSystolic?: number;
    bloodPressureDiastolic?: number;
    heartRate?: number;
    weight?: number;
    glucose?: number;
    temperature?: number;
    oxygenSaturation?: number;
  }>;
  trends: VitalsTrend[];
  insights: VitalsInsight[];
  summary: {
    totalReadings: number;
    daysTracked: number;
    lastReading: string;
    averages: {
      bloodPressure?: { systolic: number; diastolic: number };
      heartRate?: number;
      weight?: number;
      glucose?: number;
    };
  };
}

// Hook return type
interface UsePatientHealthRecordsReturn {
  labResults: LabResult[] | null;
  visitHistory: Visit[] | null;
  vitalsHistory: VitalReading[] | null;
  vitalsTrends: VitalsTrendsData | null;
  loading: boolean;
  error: string | null;
  refreshHealthRecords: () => Promise<void>;
  logVitals: (vitalsData: Partial<VitalReading>) => Promise<void>;
  downloadMedicalRecords: () => Promise<void>;
  vitalsLoading: boolean;
  downloadLoading: boolean;
}

// API Response types
interface HealthRecordsResponse {
  success: boolean;
  data?: {
    labResults: LabResult[];
    visitHistory: Visit[];
    vitalsHistory: VitalReading[];
    vitalsTrends: VitalsTrendsData;
  };
  message?: string;
  error?: {
    message: string;
  };
}

interface VitalsLogResponse {
  success: boolean;
  data?: {
    vital: VitalReading;
  };
  message?: string;
  error?: {
    message: string;
  };
}

// Patient Health Records API Service
class PatientHealthRecordsService {
  private static baseUrl = '/api/patient-portal';

  private static async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = localStorage.getItem('patient_auth_token');

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
          ...options.headers,
        },
        ...options,
      });

      const maybeJson = await response.json().catch(() => null);

      if (!response.ok) {
        const serverMessage = (maybeJson as any)?.message || (maybeJson as any)?.error?.message;
        console.error('[HealthRecords] API error:', {
          url: `${this.baseUrl}${endpoint}`,
          status: response.status,
          serverMessage,
          payload: maybeJson,
        });
        throw new Error(serverMessage || `HTTP ${response.status}`);
      }

      return (maybeJson ?? ({} as any));
    } catch (err: any) {
      console.error('[HealthRecords] Network/parse error:', {
        url: `${this.baseUrl}${endpoint}`,
        message: err?.message,
      });
      throw err;
    }
  }

  static async getHealthRecords(patientId: string): Promise<HealthRecordsResponse> {
    try {
      // Fetch all health records data in parallel
      const [labResultsRes, visitsRes, vitalsRes, trendsRes] = await Promise.all([
        this.makeRequest<any>('/health-records/lab-results'),
        this.makeRequest<any>('/health-records/visits'),
        this.makeRequest<any>('/health-records/vitals'),
        this.makeRequest<any>('/health-records/vitals/trends'),
      ]);

      // Resilient parsing for different response shapes
      const extractList = (res: any) => {
        if (!res) return [];
        // Prefer res.data.results → res.data → res.results → res
        if (Array.isArray(res?.data?.results)) return res.data.results;
        if (Array.isArray(res?.data)) return res.data;
        if (Array.isArray(res?.results)) return res.results;
        if (Array.isArray(res)) return res;
        return [];
      };

      const extractObject = (res: any, fallback: any) => {
        if (!res) return fallback;
        return (res.data && !Array.isArray(res.data) ? res.data : res) || fallback;
      };

      const labResultsList = extractList(labResultsRes);
      const visitsList = extractList(visitsRes);
      const vitalsList = extractList(vitalsRes);
      const trendsObj = extractObject(trendsRes, {
        readings: [],
        trends: [],
        insights: [],
        summary: { totalReadings: 0, daysTracked: 0, lastReading: '', averages: {} }
      });

      // Optional: sort lab results by testDate desc on FE if backend omitted sort
      labResultsList.sort((a: any, b: any) => {
        const ad = new Date(a?.testDate || a?.createdAt || 0).getTime();
        const bd = new Date(b?.testDate || b?.createdAt || 0).getTime();
        return bd - ad;
      });

      return {
        success: true,
        data: {
          labResults: labResultsList,
          visitHistory: visitsList,
          vitalsHistory: vitalsList,
          vitalsTrends: trendsObj,
        },
        message: 'Health records retrieved successfully'
      };
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch health records');
    }
  }

  static async logVitals(patientId: string, vitalsData: Partial<VitalReading>): Promise<VitalsLogResponse> {
    // Remove oxygenSaturation as per requirements
    const { oxygenSaturation, ...cleanVitalsData } = vitalsData as any;
    
    return this.makeRequest<VitalsLogResponse>('/health-records/vitals', {
      method: 'POST',
      body: JSON.stringify(cleanVitalsData),
    });
  }

  static async downloadMedicalRecords(): Promise<Blob> {
    const token = localStorage.getItem('patient_auth_token');
    const response = await fetch(`${this.baseUrl}/health-records/download`, {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

    if (!response.ok) {
      throw new Error('Failed to download medical records');
    }

    return response.blob();
  }
}

// Hook to manage patient health records
export const usePatientHealthRecords = (patientId?: string): UsePatientHealthRecordsReturn => {
  const { user, isAuthenticated } = usePatientAuth();
  const [labResults, setLabResults] = useState<LabResult[] | null>(null);
  const [visitHistory, setVisitHistory] = useState<Visit[] | null>(null);
  const [vitalsHistory, setVitalsHistory] = useState<VitalReading[] | null>(null);
  const [vitalsTrends, setVitalsTrends] = useState<VitalsTrendsData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [vitalsLoading, setVitalsLoading] = useState<boolean>(false);
  const [downloadLoading, setDownloadLoading] = useState<boolean>(false);

  // Load health records data when user is authenticated
  const loadHealthRecords = useCallback(async () => {
    if (!isAuthenticated || !user || !patientId) {
      setLabResults(null);
      setVisitHistory(null);
      setVitalsHistory(null);
      setVitalsTrends(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await PatientHealthRecordsService.getHealthRecords(patientId);
      if (response.success && response.data) {
        setLabResults(response.data.labResults);
        setVisitHistory(response.data.visitHistory);
        setVitalsHistory(response.data.vitalsHistory);
        setVitalsTrends(response.data.vitalsTrends);
      } else {
        throw new Error(response.message || 'Failed to load health records');
      }
    } catch (err: any) {
      console.error('Failed to load health records:', err);
      setError(err.message || 'Failed to load health records');
      setLabResults(null);
      setVisitHistory(null);
      setVitalsHistory(null);
      setVitalsTrends(null);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user, patientId]);

  // Load health records on mount and when dependencies change
  useEffect(() => {
    loadHealthRecords();
  }, [loadHealthRecords]);

  // Log vitals function
  const logVitals = useCallback(async (vitalsData: Partial<VitalReading>) => {
    if (!isAuthenticated || !user || !patientId) {
      throw new Error('User not authenticated');
    }

    setVitalsLoading(true);

    try {
      const response = await PatientHealthRecordsService.logVitals(patientId, vitalsData);
      if (response.success && response.data) {
        // Add the new vital reading to the history
        setVitalsHistory(prev => prev ? [response.data!.vital, ...prev] : [response.data!.vital]);
        
        // Refresh trends data
        await loadHealthRecords();
      } else {
        throw new Error(response.message || 'Failed to log vitals');
      }
    } catch (err: any) {
      console.error('Failed to log vitals:', err);
      throw err;
    } finally {
      setVitalsLoading(false);
    }
  }, [isAuthenticated, user, patientId, loadHealthRecords]);

  // Download medical records function
  const downloadMedicalRecords = useCallback(async () => {
    if (!isAuthenticated || !user || !patientId) {
      throw new Error('User not authenticated');
    }

    setDownloadLoading(true);

    try {
      await PatientHealthRecordsService.downloadMedicalRecords(patientId);
    } catch (err: any) {
      console.error('Failed to download medical records:', err);
      throw err;
    } finally {
      setDownloadLoading(false);
    }
  }, [isAuthenticated, user, patientId]);

  // Refresh health records function
  const refreshHealthRecords = useCallback(async () => {
    await loadHealthRecords();
  }, [loadHealthRecords]);

  return {
    labResults,
    visitHistory,
    vitalsHistory,
    vitalsTrends,
    loading,
    error,
    refreshHealthRecords,
    logVitals,
    downloadMedicalRecords,
    vitalsLoading,
    downloadLoading
  };
};

export default usePatientHealthRecords;