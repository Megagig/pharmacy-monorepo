import { create } from 'zustand';
import { Patient, LoadingState, ErrorState } from './types';
import type {
  MedicationTherapyReview,
  DrugTherapyProblem,
  MTRIntervention,
  MTRFollowUp,
  TherapyPlan,
  TherapyRecommendation,
  MonitoringParameter,
  TherapyGoal,
} from '../types/mtr';

// MTR-specific types based on backend models
export interface MTRMedication {
  id?: string;
  drugName: string;
  genericName?: string;
  strength: {
    value: number;
    unit: string;
  };
  dosageForm: string;
  instructions: {
    dose: string;
    frequency: string;
    route: string;
    duration?: string;
  };
  category: 'prescribed' | 'otc' | 'herbal' | 'supplement';
  prescriber?: {
    name: string;
    license?: string;
    contact?: string;
  };
  startDate: Date;
  endDate?: Date;
  indication: string;
  adherenceScore?: number;
  notes?: string;
  isManual?: boolean; // Flag to indicate if medication was manually entered
}

// Helper functions to convert between API types and store types
const convertMedicationEntryToMTRMedication = (entry: {
  _id?: string;
  id?: string;
  drugName: string;
  genericName?: string;
  strength: { value: number; unit: string };
  dosageForm: string;
  instructions: {
    dose: string;
    frequency: string;
    route: string;
    duration?: string;
  };
  category: 'prescribed' | 'otc' | 'herbal' | 'supplement';
  prescriber?: { name: string; license?: string; contact?: string };
  startDate: string | Date;
  endDate?: string | Date;
  indication: string;
  adherenceScore?: number;
  notes?: string;
  isManual?: boolean;
}): MTRMedication => ({
  id: entry._id || entry.id,
  drugName: entry.drugName,
  genericName: entry.genericName,
  strength: entry.strength,
  dosageForm: entry.dosageForm,
  instructions: entry.instructions,
  category: entry.category,
  prescriber: entry.prescriber,
  startDate:
    typeof entry.startDate === 'string'
      ? new Date(entry.startDate)
      : entry.startDate,
  endDate: entry.endDate
    ? typeof entry.endDate === 'string'
      ? new Date(entry.endDate)
      : entry.endDate
    : undefined,
  indication: entry.indication,
  adherenceScore: entry.adherenceScore,
  notes: entry.notes,
  isManual: entry.isManual,
});

const convertMTRMedicationToEntry = (
  medication: MTRMedication
): {
  drugName: string;
  genericName?: string;
  strength: { value: number; unit: string };
  dosageForm: string;
  instructions: {
    dose: string;
    frequency: string;
    route: string;
    duration?: string;
  };
  category: 'prescribed' | 'otc' | 'herbal' | 'supplement';
  prescriber?: { name: string; license?: string; contact?: string };
  startDate: string;
  endDate?: string;
  indication: string;
  adherenceScore?: number;
  notes?: string;
  isManual?: boolean;
} => ({
  drugName: medication.drugName,
  genericName: medication.genericName,
  strength: medication.strength,
  dosageForm: medication.dosageForm,
  instructions: medication.instructions,
  category: medication.category,
  prescriber: medication.prescriber,
  startDate: medication.startDate.toISOString(),
  endDate: medication.endDate?.toISOString(),
  indication: medication.indication,
  adherenceScore: medication.adherenceScore,
  notes: medication.notes,
  isManual: medication.isManual,
});

// Using imported DrugTherapyProblem type

// Using imported TherapyRecommendation type

// Using imported MonitoringParameter type

// Using imported TherapyGoal type

// Using imported TherapyPlan type

// Using imported MTRIntervention type

// Using imported MTRFollowUp type

export interface MTRStep {
  completed: boolean;
  completedAt?: Date;
  data?: Record<string, unknown>;
}

interface MTRStore {
  // Current session state
  currentReview: MedicationTherapyReview | null;
  currentStep: number;
  stepData: Record<string, Record<string, unknown>>;

  // Patient and medications
  selectedPatient: Patient | null;
  medications: MTRMedication[];

  // Assessment results
  identifiedProblems: DrugTherapyProblem[];
  therapyPlan: TherapyPlan | null;

  // Interventions and follow-ups
  interventions: MTRIntervention[];
  followUps: MTRFollowUp[];

  // UI state
  loading: LoadingState;
  errors: ErrorState;

  // Session management actions
  initializeSession: () => void;
  createReview: (patientId: string) => Promise<void>;
  loadReview: (reviewId: string) => Promise<void>;
  loadInProgressReview: (
    patientId: string
  ) => Promise<MedicationTherapyReview | null>;
  saveReview: () => Promise<void>;
  completeReview: () => Promise<MedicationTherapyReview>;
  cancelReview: () => Promise<void>;

  // Step navigation actions
  goToStep: (step: number) => void;
  completeStep: (step: number, data: Record<string, unknown>) => Promise<void>;
  getNextStep: () => number | null;
  getCurrentStepName: () => string;
  markOptionalStepCompleted: (stepIndex: number, stepName: string) => Promise<void>;

  // Patient selection actions
  selectPatient: (patient: Patient) => void;
  searchPatients: (query: string) => Promise<Patient[]>;
  createNewPatient: (patientData: Partial<Patient>) => Promise<Patient | null>;

  // Medication management actions
  addMedication: (medication: MTRMedication) => void;
  updateMedication: (id: string, updates: Partial<MTRMedication>) => void;
  removeMedication: (id: string) => void;
  setMedications: (medications: MTRMedication[]) => void;
  importMedications: (patientId: string) => Promise<void>;
  validateMedications: () => string[];

  // Problem identification actions
  runAssessment: () => Promise<void>;
  addProblem: (problem: DrugTherapyProblem) => void;
  updateProblem: (id: string, updates: Partial<DrugTherapyProblem>) => void;
  resolveProblem: (id: string, resolution: string) => void;
  checkDrugInteractions: (
    medications: MTRMedication[]
  ) => Promise<DrugTherapyProblem[]>;

  // Plan development actions
  createPlan: (plan: TherapyPlan) => Promise<void>;
  updatePlan: (updates: Partial<TherapyPlan>) => void;
  addRecommendation: (recommendation: TherapyRecommendation) => void;
  addMonitoringParameter: (parameter: MonitoringParameter) => void;
  addTherapyGoal: (goal: TherapyGoal) => void;

  // Intervention actions
  recordIntervention: (intervention: MTRIntervention) => Promise<void>;
  updateIntervention: (id: string, updates: Partial<MTRIntervention>) => void;
  markInterventionComplete: (
    id: string,
    outcome: string,
    details?: string
  ) => void;

  // Follow-up actions
  scheduleFollowUp: (followUp: MTRFollowUp) => Promise<void>;
  updateFollowUp: (id: string, updates: Partial<MTRFollowUp>) => void;
  completeFollowUp: (
    id: string,
    outcome: MTRFollowUp['outcome']
  ) => Promise<void>;
  rescheduleFollowUp: (id: string, newDate: string, reason?: string) => void;

  // Utility actions
  clearStore: () => void;
  setLoading: (key: string, loading: boolean) => void;
  setError: (key: string, error: string | null) => void;
  clearErrors: () => void;
  getCompletionPercentage: () => number;
  canCompleteReview: () => boolean;
  validateStep: (step: number) => string[];
  checkPermissions: () => Promise<boolean>;
}

// Helper function to check MTR permissions
const checkMTRPermissions = async (): Promise<boolean> => {
  // Multiple checks for development mode
  const isDevelopment =
    import.meta.env.DEV ||
    import.meta.env.MODE === 'development' ||
    import.meta.env.NODE_ENV === 'development' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

  if (isDevelopment) {
    console.warn(
      '🔧 Development mode detected: Allowing MTR access for testing'
    );
    return true;
  }

  try {
    const { authService } = await import('../services/authService');

    // Get current user to check authentication and permissions
    const userResponse = await authService.getCurrentUser();

    if (!userResponse.success || !userResponse.user) {
      return false;
    }

    const user = userResponse.user;

    // For now, allow all authenticated users - you can make this more restrictive later
    const hasPermission = !!user;

    return hasPermission;
  } catch (error) {
    console.error('❌ Error checking MTR permissions:', error);

    // Fallback: allow access if we can't determine permissions
    console.warn(
      '🔧 Fallback: Allowing MTR access due to permission check error'
    );
    return true;
  }
};

export const useMTRStore = create<MTRStore>()((set, get) => ({
  // Initial state
  currentReview: null,
  currentStep: 0,
  stepData: {},
  selectedPatient: null,
  medications: [],
  identifiedProblems: [],
  therapyPlan: null,
  interventions: [],
  followUps: [],
  loading: {
    createReview: false,
    loadReview: false,
    saveReview: false,
    completeStep: false,
    completeReview: false,
    searchPatients: false,
    createNewPatient: false,
    importMedications: false,
    runAssessment: false,
    createPlan: false,
    recordIntervention: false,
    scheduleFollowUp: false,
    completeFollowUp: false,
    cancelReview: false,
  },
  errors: {
    createReview: null,
    loadReview: null,
    saveReview: null,
    completeStep: null,
    completeReview: null,
    searchPatients: null,
    createNewPatient: null,
    importMedications: null,
    runAssessment: null,
    createPlan: null,
    recordIntervention: null,
    scheduleFollowUp: null,
    completeFollowUp: null,
    cancelReview: null,
  },

  // Session management actions
  initializeSession: () => {
    // Initialize clean state - no localStorage recovery
    set({
      currentReview: null,
      currentStep: 0,
      stepData: {},
      selectedPatient: null,
      medications: [],
      identifiedProblems: [],
      therapyPlan: null,
      interventions: [],
      followUps: [],
    });

  },

  createReview: async (patientId: string) => {
    const { setLoading, setError } = get();

    // Prevent multiple simultaneous calls
    if (get().loading.createReview) {
      return;
    }

    setLoading('createReview', true);
    setError('createReview', null);

    try {

      // Validate patient ID
      if (!patientId?.trim()) {
        throw new Error('Patient ID is required');
      }

      // Check authentication and permissions first
      const hasPermissions = await checkMTRPermissions();

      if (!hasPermissions) {
        throw new Error('You do not have permission to create MTR reviews. Please contact your administrator.');
      }


      // Import the mtrService with timeout
      const { mtrService } = await import('../services/mtrService');

      // Create new MTR session via API with timeout
      const createData = {
        patientId: patientId.trim(),
        reviewType: 'initial' as const,
        priority: 'routine' as const,
        patientConsent: true,  // Required for MTR creation
        confidentialityAgreed: true,  // Required for MTR creation
      };

      // Test backend connectivity first with shorter timeout
      let backendAccessible = false;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

        const testResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'https://PharmaPilot-nttq.onrender.com/api'}/health`, {
          method: 'GET',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        backendAccessible = testResponse.ok;
      } catch (healthError) {
        console.error('❌ Backend not accessible:', healthError);
        backendAccessible = false;
      }

      if (!backendAccessible) {
        throw new Error('Backend server is not accessible. Please ensure the server is running.');
      }


      // Add timeout for MTR creation (30 seconds for better UX)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('MTR creation timeout. The server is taking too long to respond.')), 30000);
      });

      let response;
      try {
        response = await Promise.race([
          mtrService.createMTRSession(createData),
          timeoutPromise
        ]) as any;
      } catch (apiError) {
        console.error('❌ API call failed:', apiError);
        console.error('❌ Error details:', {
          message: (apiError as Error).message,
          stack: (apiError as Error).stack,
          error: apiError
        });
        throw apiError;
      }


      if (!response?.review) {
        throw new Error('Invalid response from MTR service');
      }

      set({
        currentReview: response.review,
        currentStep: 0,
        stepData: {},
        medications: (response.review.medications || []).map(
          convertMedicationEntryToMTRMedication
        ),
        identifiedProblems: [],
        therapyPlan: response.review.plan || null,
        interventions: [],
        followUps: [],
      });

    } catch (error) {
      console.error('❌ Failed to create MTR review:', error);

      let errorMessage = 'Failed to create MTR review';

      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          errorMessage = 'Request timeout. The server took too long to respond. Please check your internet connection and try again.';
        } else if (error.message.includes('Backend server is not accessible')) {
          errorMessage = 'Cannot connect to server. Please ensure your internet connection is stable and the server is running.';
        } else if (error.message.includes('Permission denied') || error.message.includes('403')) {
          errorMessage = 'You do not have permission to create MTR reviews. Please contact your administrator.';
        } else if (error.message.includes('Authentication required')) {
          errorMessage = 'Authentication required. Please log in and try again.';
        } else {
          errorMessage = error.message;
        }
      }

      // No fallback - force proper backend integration

      setError('createReview', errorMessage);
      throw error; // Re-throw to let the UI handle it
    } finally {
      setLoading('createReview', false);
    }
  },

  loadReview: async (reviewId: string) => {
    const { setLoading, setError } = get();
    setLoading('loadReview', true);
    setError('loadReview', null);

    try {
      // Import the mtrService
      const { mtrService } = await import('../services/mtrService');

      // Load MTR session from API
      const response = await mtrService.getMTRSession(reviewId);

      if (response.review) {
        // Calculate the next step directly from the loaded review
        let nextStep = 0;
        if (response.review.steps) {
          const stepOrder = [
            'patientSelection',
            'medicationHistory',
            'therapyAssessment',
            'planDevelopment',
            'interventions',
            'followUp',
          ];

          for (let i = 0; i < stepOrder.length; i++) {
            const stepName = stepOrder[i] as keyof typeof response.review.steps;
            const stepData = response.review.steps[stepName];
            const isCompleted = stepData && stepData.completed;
            
            if (!isCompleted) {
              nextStep = i;
              break;
            }
          }
        }

        // Set all the data including the calculated step
        set({
          currentReview: response.review,
          currentStep: nextStep,
          medications: (response.review.medications || []).map(
            convertMedicationEntryToMTRMedication
          ),
          identifiedProblems: [], // Will be populated from actual DrugTherapyProblem objects
          therapyPlan: response.review.plan || null,
          interventions: [], // Will be populated from actual MTRIntervention objects
          followUps: [], // Will be populated from actual MTRFollowUp objects
        });

      } else {
        throw new Error('Review not found');
      }
    } catch (error) {
      console.error('❌ Failed to load MTR review:', error);

      // Handle specific error types
      if (error instanceof Error) {
        if (
          error.message.includes('Permission denied') ||
          error.message.includes('403')
        ) {
          setError(
            'loadReview',
            'You do not have permission to access MTR reviews. Please contact your administrator.'
          );
        } else if (error.message.includes('Authentication required')) {
          setError(
            'loadReview',
            'Authentication required. Please log in to access MTR reviews.'
          );
        } else {
          setError('loadReview', error.message);
        }
      } else {
        setError('loadReview', 'Failed to load review');
      }
      set({ currentReview: null });
    } finally {
      setLoading('loadReview', false);
    }
  },

  loadInProgressReview: async (patientId: string) => {
    const { setLoading, setError } = get();
    setLoading('loadReview', true);
    setError('loadReview', null);

    try {
      // Import the mtrService
      const { mtrService } = await import('../services/mtrService');

      // Add timeout for this operation too
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Load in-progress review timeout after 60 seconds')), 60000);
      });

      const response = await Promise.race([
        mtrService.getMTRSessions({
          patientId,
          status: 'in_progress',
        }),
        timeoutPromise
      ]) as any;

      if (response.results && response.results.length > 0) {
        // Load the most recent in-progress review
        const inProgressReview = response.results[0];

        // Calculate the next step directly from the loaded review
        let nextStep = 0;
        if (inProgressReview.steps) {
          const stepOrder = [
            'patientSelection',
            'medicationHistory',
            'therapyAssessment',
            'planDevelopment',
            'interventions',
            'followUp',
          ];

          for (let i = 0; i < stepOrder.length; i++) {
            const stepName = stepOrder[i] as keyof typeof inProgressReview.steps;
            const stepData = inProgressReview.steps[stepName];
            const isCompleted = stepData && stepData.completed;
            
            if (!isCompleted) {
              nextStep = i;
              break;
            }
          }
        }

        // Set all the data including the calculated step
        set({
          currentReview: inProgressReview,
          currentStep: nextStep,
          medications: (inProgressReview.medications || []).map(
            convertMedicationEntryToMTRMedication
          ),
          identifiedProblems: [],
          therapyPlan: inProgressReview.plan || null,
          interventions: [],
          followUps: [],
        });

        return inProgressReview;
      } else {
        set({ currentReview: null });
        return null;
      }
    } catch (error) {
      console.error('Failed to load in-progress MTR review:', error);

      // Don't set error for timeout - just return null to allow creating new review
      if (error instanceof Error && error.message.includes('timeout')) {
      } else {
        setError(
          'loadReview',
          error instanceof Error ? error.message : 'Failed to load in-progress review'
        );
      }

      set({ currentReview: null });
      return null;
    } finally {
      setLoading('loadReview', false);
    }
  },

  saveReview: async () => {
    const {
      setLoading,
      setError,
      currentReview,
      medications,
      identifiedProblems,
      therapyPlan,
      interventions,
      followUps,
    } = get();

    if (!currentReview) {
      throw new Error('No current review to save');
    }

    setLoading('saveReview', true);
    setError('saveReview', null);

    try {
      // Import the mtrService
      const { mtrService } = await import('../services/mtrService');

      // Prepare update data with current state
      const updateData: any = {
        medications: medications.map(convertMTRMedicationToEntry),
        problems: identifiedProblems,
        plan: therapyPlan || undefined,
        interventions,
        followUps,
        updatedAt: new Date().toISOString(),
      };

      // Only include steps and status if they exist
      if (currentReview.steps) {
        updateData.steps = currentReview.steps;
      }

      if (currentReview.status) {
        updateData.status = currentReview.status;
      }

      // Call the API to save the review
      const response = await mtrService.updateMTRSession(
        currentReview._id,
        updateData
      );

      // Update the store with the saved review
      set({
        currentReview: {
          ...response.review,
          updatedAt: new Date().toISOString(),
        },
      });

    } catch (error) {
      console.error('Failed to save MTR review:', error);

      // Handle specific error types
      if (error instanceof Error) {
        if (
          error.message.includes('Permission denied') ||
          error.message.includes('403')
        ) {
          setError(
            'saveReview',
            'You do not have permission to save MTR reviews. Please contact your administrator.'
          );
        } else if (error.message.includes('Authentication required')) {
          setError(
            'saveReview',
            'Authentication required. Please log in to save MTR reviews.'
          );
        } else {
          setError('saveReview', error.message);
        }
      } else {
        setError('saveReview', 'Failed to save review');
      }
    } finally {
      setLoading('saveReview', false);
    }
  },

  completeReview: async () => {
    const { setLoading, setError, currentReview } = get();
    if (!currentReview) throw new Error('No current review');

    setLoading('completeReview', true);
    setError('completeReview', null);

    try {
      // Handle session completion via API only
      const { mtrService } = await import('../services/mtrService');

      const updateData = {
        status: 'completed' as const,
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const response = await mtrService.updateMTRSession(
        currentReview._id,
        updateData
      );

      const completedReview = {
        ...response.review,
        status: 'completed' as const,
        completedAt: new Date().toISOString(),
      };

      set({ currentReview: completedReview });

      // Trigger custom event to notify other components
      window.dispatchEvent(new CustomEvent('mtr-session-completed', {
        detail: { sessionId: currentReview._id, patientId: currentReview.patientId }
      }));

      return completedReview;
    } catch (error) {
      console.error('❌ Failed to complete MTR review:', error);
      setError(
        'completeReview',
        error instanceof Error ? error.message : 'Failed to complete review'
      );
      throw error;
    } finally {
      setLoading('completeReview', false);
    }
  },

  cancelReview: async () => {
    const { setLoading, setError, currentReview } = get();
    if (!currentReview) return;

    setLoading('cancelReview', true);
    setError('cancelReview', null);

    try {
      const updatedReview = {
        ...currentReview,
        status: 'cancelled' as const,
      };

      set({ currentReview: updatedReview });

    } catch (error) {
      setError(
        'cancelReview',
        error instanceof Error ? error.message : 'Failed to cancel review'
      );
    } finally {
      setLoading('cancelReview', false);
    }
  },

  // Step navigation actions
  goToStep: (step: number) => {
    const { currentReview, saveReview } = get();
    if (!currentReview) return;

    // Validate step number
    if (step < 0 || step > 5) return;

    // Auto-save current progress before navigating
    saveReview().catch(error => {
      console.error('Auto-save failed during step navigation:', error);
    });

    set({ currentStep: step });
  },

  // Helper function to mark optional steps as completed (for skipping)
  markOptionalStepCompleted: async (stepIndex: number, stepName: string) => {
    const { completeStep } = get();
    await completeStep(stepIndex, {
      completedAt: new Date().toISOString(),
      stepName,
      skipped: true,
      reason: 'No data to enter for this step',
    });
  },

  completeStep: async (step: number, data: Record<string, unknown>) => {
    const { setLoading, setError, currentReview } = get();
    if (!currentReview) return;

    setLoading('completeStep', true);
    setError('completeStep', null);

    try {
      const stepNames = [
        'patientSelection',
        'medicationHistory',
        'therapyAssessment',
        'planDevelopment',
        'interventions',
        'followUp',
      ];

      const stepName = stepNames[step];
      if (!stepName) throw new Error('Invalid step number');

      // Add null check for currentReview.steps
      const updatedSteps = {
        ...(currentReview.steps || {}),
        [stepName]: {
          completed: true,
          completedAt: new Date().toISOString(),
          data,
        },
      };

      const updatedReview = {
        ...currentReview,
        steps: updatedSteps,
      };

      set({
        currentReview: updatedReview,
        stepData: { ...get().stepData, [stepName]: data },
      });

      // Auto-save after completing step
      await get().saveReview();
    } catch (error) {
      setError(
        'completeStep',
        error instanceof Error ? error.message : 'Failed to complete step'
      );
    } finally {
      setLoading('completeStep', false);
    }
  },

  getNextStep: () => {
    const { currentReview } = get();
    if (!currentReview) return null;
    if (!currentReview.steps) return 0; // Return first step if steps don't exist

    try {
      const stepOrder = [
        'patientSelection',
        'medicationHistory',
        'therapyAssessment',
        'planDevelopment',
        'interventions',
        'followUp',
      ];

      for (let i = 0; i < stepOrder.length; i++) {
        const stepName = stepOrder[i] as keyof typeof currentReview.steps;
        const stepData = currentReview.steps[stepName];
        const isCompleted = stepData && stepData.completed;
        
        if (!isCompleted) {
          return i;
        }
      }
    } catch (error) {
      console.error('Error finding next step:', error);
      return 0; // Default to first step on error
    }
    return null;
  },

  getCurrentStepName: () => {
    const { currentStep } = get();
    const stepNames = [
      'Patient Selection',
      'Medication History',
      'Therapy Assessment',
      'Plan Development',
      'Interventions',
      'Follow-Up',
    ];
    return stepNames[currentStep] || 'Unknown Step';
  },

  // Patient selection actions
  selectPatient: (patient: Patient) => {
    set({ selectedPatient: patient });
  },

  searchPatients: async (query: string) => {
    const { setLoading, setError } = get();
    setLoading('searchPatients', true);
    setError('searchPatients', null);

    try {
      // Import patient service dynamically
      const { patientService } = await import('../services/patientService');
      const response = await patientService.searchPatients(query);

      // Handle the response structure
      if (response && typeof response === 'object' && 'patients' in response) {
        return (response as any).patients || [];
      }
      return [];
    } catch (error) {
      console.error('Failed to search patients:', error);
      setError(
        'searchPatients',
        error instanceof Error ? error.message : 'Failed to search patients'
      );
      return [];
    } finally {
      setLoading('searchPatients', false);
    }
  },

  createNewPatient: async (patientData: Partial<Patient>) => {
    const { setLoading, setError } = get();
    setLoading('createNewPatient', true);
    setError('createNewPatient', null);

    try {
      // Import patient service dynamically
      const { patientService } = await import('../services/patientService');
      const response = await patientService.createPatient(patientData as any);

      // Handle the response structure
      if (response && typeof response === 'object' && 'data' in response) {
        const data = (response as any).data;
        if (data && 'patient' in data) {
          return data.patient;
        }
        return data;
      }
      return null;
    } catch (error) {
      console.error('Failed to create patient:', error);
      setError(
        'createNewPatient',
        error instanceof Error ? error.message : 'Failed to create patient'
      );
      return null;
    } finally {
      setLoading('createNewPatient', false);
    }
  },

  // Medication management actions
  addMedication: (medication: MTRMedication) => {
    set((state) => ({
      medications: [
        ...state.medications,
        { ...medication, id: Date.now().toString() },
      ],
    }));
  },

  updateMedication: (id: string, updates: Partial<MTRMedication>) => {
    set((state) => ({
      medications: state.medications.map((med) =>
        med.id === id ? { ...med, ...updates } : med
      ),
    }));
  },

  removeMedication: (id: string) => {
    set((state) => ({
      medications: state.medications.filter((med) => med.id !== id),
    }));
  },

  setMedications: (medications: MTRMedication[]) => {
    set({ medications });
  },

  importMedications: async (patientId: string) => {
    const { setLoading, setError } = get();
    setLoading('importMedications', true);
    setError('importMedications', null);

    try {
      // Import patient service to get patient medications
      const { patientService } = await import('../services/patientService');
      const response = await patientService.getPatient(patientId);

      // Handle the response structure
      let patientData = null;
      if (response && typeof response === 'object' && 'data' in response) {
        const data = (response as any).data;
        if (data && 'patient' in data) {
          patientData = data.patient;
        } else {
          patientData = data;
        }
      }

      if (patientData?.currentMedications) {
        // Convert patient medications to MTR medications format
        const medications = patientData.currentMedications.map((med: any) => ({
          id: med._id || med.id,
          drugName: med.drugName || med.name,
          genericName: med.genericName,
          strength: med.strength || { value: 0, unit: 'mg' },
          dosageForm: med.dosageForm || 'tablet',
          instructions: med.instructions || {
            dose: '1',
            frequency: 'daily',
            route: 'oral'
          },
          category: med.category || 'prescribed',
          startDate: new Date(med.startDate || Date.now()),
          indication: med.indication || '',
          isManual: false
        }));

        set({ medications });
      }
    } catch (error) {
      console.error('Failed to import medications:', error);
      setError(
        'importMedications',
        error instanceof Error
          ? error.message
          : 'Failed to import medications'
      );
    } finally {
      setLoading('importMedications', false);
    }
  },

  validateMedications: () => {
    const { medications } = get();
    const errors: string[] = [];

    medications.forEach((med, index) => {
      if (!med.drugName.trim()) {
        errors.push(`Medication ${index + 1}: Drug name is required`);
      }
      if (!med.indication.trim()) {
        errors.push(`Medication ${index + 1}: Indication is required`);
      }
      if (med.strength.value <= 0) {
        errors.push(
          `Medication ${index + 1}: Strength must be greater than 0`
        );
      }
    });

    return errors;
  },

  // Problem identification actions
  runAssessment: async () => {
    const { setLoading, setError, medications, checkDrugInteractions } =
      get();
    setLoading('runAssessment', true);
    setError('runAssessment', null);

    try {
      // Run various assessments
      const interactions = await checkDrugInteractions(medications);

      // Add other assessment logic here (duplicates, contraindications, etc.)

      set({ identifiedProblems: interactions });
    } catch (error) {
      setError(
        'runAssessment',
        error instanceof Error ? error.message : 'Failed to run assessment'
      );
    } finally {
      setLoading('runAssessment', false);
    }
  },

  addProblem: (problem: DrugTherapyProblem) => {
    set((state) => ({
      identifiedProblems: [
        ...state.identifiedProblems,
        { ...problem, _id: Date.now().toString() },
      ],
    }));
  },

  updateProblem: (id: string, updates: Partial<DrugTherapyProblem>) => {
    set((state) => ({
      identifiedProblems: state.identifiedProblems.map((problem) =>
        problem._id === id ? { ...problem, ...updates } : problem
      ),
    }));
  },

  resolveProblem: (id: string, resolution: string) => {
    const { updateProblem } = get();
    updateProblem(id, {
      status: 'resolved',
      resolution: {
        action: resolution,
        outcome: 'Problem resolved',
        resolvedAt: new Date().toISOString(),
      },
    });
  },

  checkDrugInteractions: async (_medications: MTRMedication[]) => {
    try {
      // In a real implementation, this would call a drug interaction service
      // For now, return empty array until drug interaction service is implemented

      // TODO: Implement actual drug interaction checking
      // This could call an external drug database API like:
      // - FDA Drug Interaction API
      // - RxNorm API
      // - Custom drug interaction database

      return [];
    } catch (error) {
      console.error('Failed to check drug interactions:', error);
      return [];
    }
  },

  // Plan development actions
  createPlan: async (plan: TherapyPlan) => {
    const { setLoading, setError } = get();
    setLoading('createPlan', true);
    setError('createPlan', null);

    try {
      set({ therapyPlan: plan });
    } catch (error) {
      setError(
        'createPlan',
        error instanceof Error ? error.message : 'Failed to create plan'
      );
    } finally {
      setLoading('createPlan', false);
    }
  },

  updatePlan: (updates: Partial<TherapyPlan>) => {
    set((state) => ({
      therapyPlan: state.therapyPlan
        ? { ...state.therapyPlan, ...updates }
        : null,
    }));
  },

  addRecommendation: (recommendation: TherapyRecommendation) => {
    const { therapyPlan, updatePlan } = get();
    if (!therapyPlan) return;

    const updatedRecommendations = [
      ...therapyPlan.recommendations,
      recommendation,
    ];
    updatePlan({ recommendations: updatedRecommendations });
  },

  addMonitoringParameter: (parameter: MonitoringParameter) => {
    const { therapyPlan, updatePlan } = get();
    if (!therapyPlan) return;

    const updatedMonitoring = [...therapyPlan.monitoringPlan, parameter];
    updatePlan({ monitoringPlan: updatedMonitoring });
  },

  addTherapyGoal: (goal: TherapyGoal) => {
    const { therapyPlan, updatePlan } = get();
    if (!therapyPlan) return;

    const updatedGoals = [...therapyPlan.goals, goal];
    updatePlan({ goals: updatedGoals });
  },

  // Intervention actions
  recordIntervention: async (intervention: MTRIntervention) => {
    const { setLoading, setError, currentReview, completeStep } = get();
    setLoading('recordIntervention', true);
    setError('recordIntervention', null);

    try {
      const newIntervention = {
        ...intervention,
        _id: Date.now().toString(),
        performedAt: new Date().toISOString(),
      };

      set((state) => ({
        interventions: [...state.interventions, newIntervention],
      }));

      // Automatically mark the Interventions step as completed when an intervention is recorded
      if (currentReview) {
        await completeStep(4, { // Interventions is step 4 (0-indexed)
          completedAt: new Date().toISOString(),
          stepName: 'Interventions',
          interventionRecorded: true,
          interventionId: newIntervention._id,
        });
      }

    } catch (error) {
      setError(
        'recordIntervention',
        error instanceof Error
          ? error.message
          : 'Failed to record intervention'
      );
    } finally {
      setLoading('recordIntervention', false);
    }
  },

  updateIntervention: (id: string, updates: Partial<MTRIntervention>) => {
    set((state) => ({
      interventions: state.interventions.map((intervention) =>
        intervention._id === id
          ? { ...intervention, ...updates }
          : intervention
      ),
    }));
  },

  markInterventionComplete: (
    id: string,
    outcome: string,
    details?: string
  ) => {
    const { updateIntervention } = get();
    updateIntervention(id, {
      outcome: outcome as MTRIntervention['outcome'],
      outcomeDetails: details || '',
    });
  },

  // Follow-up actions
  scheduleFollowUp: async (followUp: MTRFollowUp) => {
    const { setLoading, setError, currentReview, completeStep } = get();
    setLoading('scheduleFollowUp', true);
    setError('scheduleFollowUp', null);

    try {
      const newFollowUp = {
        ...followUp,
        _id: Date.now().toString(),
      };

      set((state) => ({
        followUps: [...state.followUps, newFollowUp],
      }));

      // Automatically mark the Follow-Up step as completed when a follow-up is scheduled
      if (currentReview) {
        await completeStep(5, { // Follow-Up is step 5 (0-indexed)
          completedAt: new Date().toISOString(),
          stepName: 'Follow-Up',
          followUpScheduled: true,
          followUpId: newFollowUp._id,
        });
      }

    } catch (error) {
      setError(
        'scheduleFollowUp',
        error instanceof Error
          ? error.message
          : 'Failed to schedule follow-up'
      );
    } finally {
      setLoading('scheduleFollowUp', false);
    }
  },

  updateFollowUp: (id: string, updates: Partial<MTRFollowUp>) => {
    set((state) => ({
      followUps: state.followUps.map((followUp) =>
        followUp._id === id ? { ...followUp, ...updates } : followUp
      ),
    }));
  },

  completeFollowUp: async (id: string, outcome: MTRFollowUp['outcome']) => {
    const { setLoading, setError, updateFollowUp } = get();
    setLoading('completeFollowUp', true);
    setError('completeFollowUp', null);

    try {
      updateFollowUp(id, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        outcome: outcome as MTRFollowUp['outcome'],
      });

    } catch (error) {
      setError(
        'completeFollowUp',
        error instanceof Error
          ? error.message
          : 'Failed to complete follow-up'
      );
    } finally {
      setLoading('completeFollowUp', false);
    }
  },

  rescheduleFollowUp: (id: string, newDate: string, reason?: string) => {
    const { updateFollowUp } = get();
    updateFollowUp(id, {
      scheduledDate: newDate,
      status: 'rescheduled',
      ...(reason && { rescheduledReason: reason }),
    });
  },

  // Utility actions
  clearStore: () => {
    set({
      currentReview: null,
      currentStep: 0,
      stepData: {},
      selectedPatient: null,
      medications: [],
      identifiedProblems: [],
      therapyPlan: null,
      interventions: [],
      followUps: [],
      loading: {
        createReview: false,
        loadReview: false,
        saveReview: false,
        completeStep: false,
        completeReview: false,
        searchPatients: false,
        createNewPatient: false,
        importMedications: false,
        runAssessment: false,
        createPlan: false,
        recordIntervention: false,
        scheduleFollowUp: false,
        completeFollowUp: false,
        cancelReview: false,
      },
      errors: {
        createReview: null,
        loadReview: null,
        saveReview: null,
        completeStep: null,
        completeReview: null,
        searchPatients: null,
        createNewPatient: null,
        importMedications: null,
        runAssessment: null,
        createPlan: null,
        recordIntervention: null,
        scheduleFollowUp: null,
        completeFollowUp: null,
        cancelReview: null,
      },
    });
  },

  setLoading: (key: string, loading: boolean) => {
    set((state) => ({
      loading: { ...state.loading, [key]: loading },
    }));
  },

  setError: (key: string, error: string | null) => {
    set((state) => ({
      errors: { ...state.errors, [key]: error },
    }));
  },

  clearErrors: () => {
    set({ errors: {} });
  },

  getCompletionPercentage: () => {
    const { currentReview, followUps } = get();
    if (!currentReview) return 0;

    // Check if steps exists to prevent "Cannot convert undefined or null to object" error
    if (!currentReview.steps) {
      console.warn(
        'MTR steps missing in currentReview, returning 0% completion'
      );
      return 0;
    }

    try {
      const steps = Object.values(currentReview.steps);
      const completedSteps = steps.filter(
        (step) => step && step.completed
      ).length;
      const totalSteps = steps.length;

      // Base completion on steps (90% of total)
      let basePercentage = (completedSteps / totalSteps) * 90;

      // Add 10% if at least one follow-up is scheduled (required for completion)
      if (followUps.length > 0) {
        basePercentage += 10;
      }

      // Ensure we don't exceed 100%
      return Math.min(Math.round(basePercentage), 100);
    } catch (error) {
      console.error('Error calculating completion percentage:', error);
      return 0; // Return 0% completion on error
    }
  },

  canCompleteReview: () => {
    const { currentReview } = get();
    if (!currentReview) {
      return false;
    }
    if (!currentReview.steps) {
      return false;
    }

    try {
      // Check if all required steps are completed
      const requiredSteps = [
        'patientSelection',
        'medicationHistory',
        'therapyAssessment',
        'planDevelopment'
      ];

      const stepStatus = requiredSteps.map(stepName => {
        const step = currentReview.steps[stepName as keyof typeof currentReview.steps];
        const isCompleted = step && step.completed;
        return { stepName, isCompleted, step };
      });

      const requiredStepsCompleted = stepStatus.every(({ isCompleted }) => isCompleted);

      // Optional steps (interventions and followUp) don't block completion
      // but if they exist, they should be marked complete
      const optionalSteps = ['interventions', 'followUp'];
      const optionalStepStatus = optionalSteps.map(stepName => {
        const step = currentReview.steps[stepName as keyof typeof currentReview.steps];
        // If step doesn't exist, it's valid (optional)
        // If step exists, it must be completed
        const isValid = !step || step.completed === true;
        return { stepName, isValid, step, exists: !!step, completed: step?.completed };
      });

      const optionalStepsValid = optionalStepStatus.every(({ isValid }) => isValid);

      const canComplete = requiredStepsCompleted && optionalStepsValid;

      if (!canComplete) {
        const invalidOptional = optionalStepStatus.filter(({ isValid }) => !isValid);

        // Auto-fix incomplete optional steps
        invalidOptional.forEach(({ stepName, step, exists }) => {
          if (exists && !step?.completed) {
            const stepIndex = stepName === 'interventions' ? 4 : 5;
            get().completeStep(stepIndex, {
              completedAt: new Date().toISOString(),
              stepName: stepName === 'interventions' ? 'Interventions' : 'Follow-Up',
              autoCompleted: true,
              reason: 'Auto-completed for review completion'
            }).catch(error => {
              console.error(`Failed to auto-complete ${stepName}:`, error);
            });
          }
        });
      }

      return canComplete;
    } catch (error) {
      console.error('Error checking if review can be completed:', error);
      return false;
    }
  },

  validateStep: (step: number) => {
    const {
      selectedPatient,
      medications,
      identifiedProblems,
      therapyPlan,
      interventions,
      followUps,
    } = get();
    const errors: string[] = [];

    switch (step) {
      case 0: // Patient Selection
        if (!selectedPatient) {
          errors.push('Patient must be selected');
        }
        break;
      case 1: // Medication History
        if (medications.length === 0) {
          errors.push('At least one medication must be entered');
        }
        errors.push(...get().validateMedications());
        break;
      case 2: // Therapy Assessment
        if (identifiedProblems.length === 0) {
          errors.push('Assessment must be completed');
        }
        break;
      case 3: // Plan Development
        if (!therapyPlan) {
          errors.push('Therapy plan must be created');
        }
        break;
      case 4: // Interventions
        if (interventions.length === 0) {
          errors.push('At least one intervention must be recorded');
        }
        break;
      case 5: // Follow-Up
        if (followUps.length === 0) {
          errors.push('Follow-up must be scheduled');
        }
        break;
    }

    return errors;
  },

  checkPermissions: async () => {
    return await checkMTRPermissions();
  },
}));

// Utility hooks for easier access to specific MTR states
export const useMTRSession = () =>
  useMTRStore((state) => ({
    currentReview: state.currentReview,
    currentStep: state.currentStep,
    loading: state.loading.createReview || state.loading.loadReview || false,
    error: state.errors.createReview || state.errors.loadReview || null,
    createReview: state.createReview,
    loadReview: state.loadReview,
    saveReview: state.saveReview,
    completeReview: state.completeReview,
    cancelReview: state.cancelReview,
    completionPercentage: state.getCompletionPercentage(),
    canComplete: state.canCompleteReview(),
  }));

export const useMTRNavigation = () =>
  useMTRStore((state) => ({
    currentStep: state.currentStep,
    currentStepName: state.getCurrentStepName(),
    nextStep: state.getNextStep(),
    goToStep: state.goToStep,
    completeStep: state.completeStep,
    validateStep: state.validateStep,
    loading: state.loading.completeStep || false,
    error: state.errors.completeStep || null,
  }));

export const useMTRPatient = () =>
  useMTRStore((state) => ({
    selectedPatient: state.selectedPatient,
    selectPatient: state.selectPatient,
    searchPatients: state.searchPatients,
    createNewPatient: state.createNewPatient,
    loading:
      state.loading.searchPatients || state.loading.createNewPatient || false,
    error: state.errors.searchPatients || state.errors.createNewPatient || null,
  }));

export const useMTRMedications = () =>
  useMTRStore((state) => ({
    medications: state.medications,
    addMedication: state.addMedication,
    updateMedication: state.updateMedication,
    removeMedication: state.removeMedication,
    setMedications: state.setMedications,
    importMedications: state.importMedications,
    validateMedications: state.validateMedications,
    loading: state.loading.importMedications || false,
    error: state.errors.importMedications || null,
  }));

export const useMTRAssessment = () =>
  useMTRStore((state) => ({
    identifiedProblems: state.identifiedProblems,
    runAssessment: state.runAssessment,
    addProblem: state.addProblem,
    updateProblem: state.updateProblem,
    resolveProblem: state.resolveProblem,
    loading: state.loading.runAssessment || false,
    error: state.errors.runAssessment || null,
  }));

export const useMTRPlan = () =>
  useMTRStore((state) => ({
    therapyPlan: state.therapyPlan,
    createPlan: state.createPlan,
    updatePlan: state.updatePlan,
    addRecommendation: state.addRecommendation,
    addMonitoringParameter: state.addMonitoringParameter,
    addTherapyGoal: state.addTherapyGoal,
    loading: state.loading.createPlan || false,
    error: state.errors.createPlan || null,
  }));

export const useMTRInterventions = () =>
  useMTRStore((state) => ({
    interventions: state.interventions,
    recordIntervention: state.recordIntervention,
    updateIntervention: state.updateIntervention,
    markInterventionComplete: state.markInterventionComplete,
    loading: state.loading.recordIntervention || false,
    error: state.errors.recordIntervention || null,
  }));

export const useMTRFollowUps = () =>
  useMTRStore((state) => ({
    followUps: state.followUps,
    scheduleFollowUp: state.scheduleFollowUp,
    updateFollowUp: state.updateFollowUp,
    completeFollowUp: state.completeFollowUp,
    rescheduleFollowUp: state.rescheduleFollowUp,
    loading:
      state.loading.scheduleFollowUp || state.loading.completeFollowUp || false,
    error:
      state.errors.scheduleFollowUp || state.errors.completeFollowUp || null,
  }));
