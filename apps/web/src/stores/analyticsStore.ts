import { create } from 'zustand';

// Define more detailed interfaces for each data type
export interface PatientDemographic {
  name: string;
  value: number;
  color: string;
}

export interface Disease {
  name: string;
  value: number;
  trend?: 'up' | 'down' | 'stable';
}

export interface Medication {
  name: string;
  value: number;
  adherence?: number;
}

export interface ConsultationData {
  month: string;
  count: number;
}

export interface Appointment {
  id: string;
  patientName: string;
  patientAvatar?: string;
  date: string;
  time: string;
  reason: string;
  status: 'upcoming' | 'completed' | 'cancelled';
}

export interface MetricData {
  value: number;
  change: number;
  changeType: 'increase' | 'decrease' | 'stable';
}

interface AnalyticsStore {
  // Loading state
  loading: boolean;

  // Dashboard metrics
  patientMetrics: MetricData;
  notesMetrics: MetricData;
  medicationMetrics: MetricData;
  revenueMetrics: MetricData;

  // Charts data
  patientDemographics: PatientDemographic[];
  topDiseases: Disease[];
  topMedications: Medication[];
  monthlyConsultations: ConsultationData[];

  // Appointments
  upcomingAppointments: Appointment[];

  // Date filter
  dateFilter: 'day' | 'week' | 'month' | 'year';

  // Actions
  setLoading: (loading: boolean) => void;
  setDateFilter: (filter: AnalyticsStore['dateFilter']) => void;
  setPatientMetrics: (data: Partial<MetricData>) => void;
  setNotesMetrics: (data: Partial<MetricData>) => void;
  setMedicationMetrics: (data: Partial<MetricData>) => void;
  setRevenueMetrics: (data: Partial<MetricData>) => void;
  setPatientDemographics: (data: PatientDemographic[]) => void;
  setTopDiseases: (data: Disease[]) => void;
  setTopMedications: (data: Medication[]) => void;
  setMonthlyConsultations: (data: ConsultationData[]) => void;
  setUpcomingAppointments: (data: Appointment[]) => void;

  // Real-time data simulation
  simulateRealtimeUpdate: () => void;

  // Custom dashboard config
  dashboardConfig: {
    showPatientMetrics: boolean;
    showNotesMetrics: boolean;
    showMedicationMetrics: boolean;
    showRevenueMetrics: boolean;
    showDemographicsChart: boolean;
    showConsultationsChart: boolean;
    showTopDiseases: boolean;
    showTopMedications: boolean;
    showAppointments: boolean;
  };

  setDashboardConfig: (
    config: Partial<AnalyticsStore['dashboardConfig']>
  ) => void;
}

export const useAnalyticsStore = create<AnalyticsStore>((set) => ({
  // Initial loading state
  loading: true,

  // Initial metrics data
  patientMetrics: { value: 0, change: 0, changeType: 'stable' },
  notesMetrics: { value: 0, change: 0, changeType: 'stable' },
  medicationMetrics: { value: 0, change: 0, changeType: 'stable' },
  revenueMetrics: { value: 0, change: 0, changeType: 'stable' },

  // Initial charts data
  patientDemographics: [],
  topDiseases: [],
  topMedications: [],
  monthlyConsultations: [],

  // Initial appointments data
  upcomingAppointments: [],

  // Default date filter
  dateFilter: 'month',

  // Dashboard configuration
  dashboardConfig: {
    showPatientMetrics: true,
    showNotesMetrics: true,
    showMedicationMetrics: true,
    showRevenueMetrics: true,
    showDemographicsChart: true,
    showConsultationsChart: true,
    showTopDiseases: true,
    showTopMedications: true,
    showAppointments: true,
  },

  // Actions
  setLoading: (loading) => set({ loading }),

  setDateFilter: (dateFilter) => set({ dateFilter }),

  setPatientMetrics: (data) =>
    set((state) => ({
      patientMetrics: { ...state.patientMetrics, ...data },
    })),

  setNotesMetrics: (data) =>
    set((state) => ({
      notesMetrics: { ...state.notesMetrics, ...data },
    })),

  setMedicationMetrics: (data) =>
    set((state) => ({
      medicationMetrics: { ...state.medicationMetrics, ...data },
    })),

  setRevenueMetrics: (data) =>
    set((state) => ({
      revenueMetrics: { ...state.revenueMetrics, ...data },
    })),

  setPatientDemographics: (data) => set({ patientDemographics: data }),

  setTopDiseases: (data) => set({ topDiseases: data }),

  setTopMedications: (data) => set({ topMedications: data }),

  setMonthlyConsultations: (data) => set({ monthlyConsultations: data }),

  setUpcomingAppointments: (data) => set({ upcomingAppointments: data }),

  setDashboardConfig: (config) =>
    set((state) => ({
      dashboardConfig: { ...state.dashboardConfig, ...config },
    })),

  // Real-time update simulation
  simulateRealtimeUpdate: () =>
    set((state) => {
      // Clone the monthly consultations array to modify
      const consultations = [...state.monthlyConsultations];
      if (consultations.length > 0) {
        const lastIndex = consultations.length - 1;
        // Add random number to the latest month's count
        consultations[lastIndex] = {
          ...consultations[lastIndex],
          count:
            consultations[lastIndex].count + Math.floor(Math.random() * 3) + 1,
        };
      }

      // Update metrics with small random changes
      const randomChange = (min: number, max: number) =>
        Math.floor(Math.random() * (max - min + 1)) + min;

      return {
        monthlyConsultations: consultations,
        patientMetrics: {
          ...state.patientMetrics,
          value: state.patientMetrics.value + randomChange(-1, 3),
          change: randomChange(1, 5),
          changeType: 'increase',
        },
        notesMetrics: {
          ...state.notesMetrics,
          value: state.notesMetrics.value + randomChange(0, 5),
          change: randomChange(1, 8),
          changeType: 'increase',
        },
      };
    }),
}));

// Initialize with sample data
export const initializeAnalyticsData = (theme: {
  palette: {
    primary: { main: string };
    secondary: { main: string };
    success: { main: string };
    warning: { main: string };
  };
}) => {
  const store = useAnalyticsStore.getState();

  // Set initial loading state
  store.setLoading(true);

  // Simulate API loading delay
  setTimeout(() => {
    // Set metrics data
    store.setPatientMetrics({
      value: 1250,
      change: 12.5,
      changeType: 'increase',
    });

    store.setNotesMetrics({
      value: 5430,
      change: 8.3,
      changeType: 'increase',
    });

    store.setMedicationMetrics({
      value: 2780,
      change: 5.2,
      changeType: 'increase',
    });

    store.setRevenueMetrics({
      value: 142500,
      change: 9.7,
      changeType: 'increase',
    });

    // Set patient demographics
    store.setPatientDemographics([
      { name: 'Seniors', value: 35, color: theme.palette.primary.main },
      { name: 'Adults', value: 45, color: theme.palette.secondary.main },
      { name: 'Young Adults', value: 15, color: theme.palette.success.main },
      { name: 'Children', value: 5, color: theme.palette.warning.main },
    ]);

    // Set top diseases with trends
    store.setTopDiseases([
      { name: 'Hypertension', value: 65, trend: 'up' },
      { name: 'Diabetes', value: 42, trend: 'up' },
      { name: 'Asthma', value: 28, trend: 'stable' },
      { name: 'Heart Disease', value: 22, trend: 'down' },
      { name: 'Arthritis', value: 18, trend: 'stable' },
    ]);

    // Set top medications with adherence
    store.setTopMedications([
      { name: 'Lisinopril', value: 38, adherence: 85 },
      { name: 'Metformin', value: 30, adherence: 78 },
      { name: 'Atorvastatin', value: 25, adherence: 92 },
      { name: 'Albuterol', value: 22, adherence: 65 },
      { name: 'Levothyroxine', value: 20, adherence: 88 },
    ]);

    // Set monthly consultations
    // Set upcoming appointments
    store.setUpcomingAppointments([
      {
        id: '1',
        patientName: 'John Smith',
        patientAvatar: 'https://randomuser.me/api/portraits/men/32.jpg',
        date: '2025-09-10',
        time: '10:30 AM',
        reason: 'Follow-up consultation',
        status: 'upcoming',
      },
      {
        id: '2',
        patientName: 'Maria Garcia',
        patientAvatar: 'https://randomuser.me/api/portraits/women/44.jpg',
        date: '2025-09-10',
        time: '2:15 PM',
        reason: 'Medication review',
        status: 'upcoming',
      },
      {
        id: '3',
        patientName: 'Robert Johnson',
        patientAvatar: 'https://randomuser.me/api/portraits/men/55.jpg',
        date: '2025-09-11',
        time: '9:00 AM',
        reason: 'Annual physical',
        status: 'upcoming',
      },
      {
        id: '4',
        patientName: 'Sarah Williams',
        patientAvatar: 'https://randomuser.me/api/portraits/women/67.jpg',
        date: '2025-09-11',
        time: '11:30 AM',
        reason: 'Blood pressure check',
        status: 'upcoming',
      },
      {
        id: '5',
        patientName: 'Michael Brown',
        patientAvatar: 'https://randomuser.me/api/portraits/men/79.jpg',
        date: '2025-09-12',
        time: '3:45 PM',
        reason: 'Diabetes management',
        status: 'upcoming',
      },
    ]);

    // Turn off loading
    store.setLoading(false);
  }, 1500); // Simulate a 1.5 second API delay
};

// Function to start real-time updates
export const startRealtimeUpdates = () => {
  const updateInterval = setInterval(() => {
    const store = useAnalyticsStore.getState();
    store.simulateRealtimeUpdate();
  }, 5000); // Update every 5 seconds

  return () => clearInterval(updateInterval);
};
