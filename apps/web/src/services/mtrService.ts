import { apiHelpers, ApiResponse } from './api';
import type {
  MedicationTherapyReview,
  DrugTherapyProblem,
  MTRIntervention,
  CreateMTRData,
  UpdateMTRData,
  CreateDTPData,
  UpdateDTPData,
  CreateInterventionData,
  UpdateInterventionData,
  CreateFollowUpData,
  UpdateFollowUpData,
  MTRSearchParams,
  DTPSearchParams,
  InterventionSearchParams,
  FollowUpSearchParams,
  MTRListResponse,
  MTRResponse,
  DTPListResponse,
  DTPResponse,
  InterventionListResponse,
  InterventionResponse,
  FollowUpListResponse,
  FollowUpResponse,
  MTRMedicationEntry,
  TherapyPlan,
} from '../types/mtr';

// ===============================
// ERROR HANDLING TYPES
// ===============================

export interface MTRServiceError extends Error {
  code?: string;
  status?: number;
  details?: Record<string, unknown>;
}

export class MTRValidationError extends Error implements MTRServiceError {
  code = 'MTR_VALIDATION_ERROR';
  status = 400;
  details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'MTRValidationError';
    this.details = details;
  }
}

export class MTRNotFoundError extends Error implements MTRServiceError {
  code = 'MTR_NOT_FOUND';
  status = 404;

  constructor(resource: string, id: string) {
    super(`${resource} with ID ${id} not found`);
    this.name = 'MTRNotFoundError';
  }
}

export class MTRPermissionError extends Error implements MTRServiceError {
  code = 'MTR_PERMISSION_DENIED';
  status = 403;

  constructor(action: string) {
    super(`Permission denied for action: ${action}`);
    this.name = 'MTRPermissionError';
  }
}

// ===============================
// DATA TRANSFORMATION UTILITIES
// ===============================

// Type definitions for better type safety
type DateTransformable = Record<string, unknown> & {
  steps?: Record<string, { completedAt?: string | Date }>;
};

type SearchParamsType = Record<
  string,
  string | number | boolean | string[] | undefined
>;

/**
 * Transform date strings to Date objects for frontend use
 */
export const transformDatesForFrontend = <T extends DateTransformable>(
  obj: T
): T => {
  const dateFields = [
    'createdAt',
    'updatedAt',
    'startedAt',
    'completedAt',
    'scheduledDate',
    'performedAt',
    'identifiedAt',
  ];
  const transformed = { ...obj } as T;

  dateFields.forEach((field) => {
    if (transformed[field] && typeof transformed[field] === 'string') {
      try {
        (transformed as any)[field] = new Date(
          transformed[field] as string
        ).toISOString();
      } catch (error) {
        console.warn(`Failed to transform date field ${field}:`, error);
      }
    }
  });

  // Transform nested step dates
  if (transformed.steps && typeof transformed.steps === 'object') {
    Object.keys(transformed.steps).forEach((stepKey) => {
      const step = transformed.steps![stepKey];
      if (step?.completedAt && typeof step.completedAt === 'string') {
        try {
          step.completedAt = new Date(step.completedAt).toISOString();
        } catch (error) {
          console.warn(
            `Failed to transform step date ${stepKey}.completedAt:`,
            error
          );
        }
      }
    });
  }

  return transformed;
};

/**
 * Transform data for API submission (dates to ISO strings)
 */
export const transformDatesForAPI = <T extends Record<string, unknown>>(
  obj: T
): Record<string, unknown> => {
  const transformed = { ...obj } as Record<string, unknown>;

  Object.keys(transformed).forEach((key) => {
    const value = transformed[key];
    if (value instanceof Date) {
      transformed[key] = value.toISOString();
    } else if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    ) {
      transformed[key] = transformDatesForAPI(value as Record<string, unknown>);
    }
  });

  return transformed;
};

/**
 * Validate medication entry data
 */
export const validateMedicationEntry = (
  medication: Partial<MTRMedicationEntry>
): string[] => {
  const errors: string[] = [];

  if (!medication.drugName?.trim()) {
    errors.push('Drug name is required');
  }

  if (!medication.strength?.value || medication.strength.value <= 0) {
    errors.push('Valid strength value is required');
  }

  if (!medication.strength?.unit?.trim()) {
    errors.push('Strength unit is required');
  }

  if (!medication.dosageForm?.trim()) {
    errors.push('Dosage form is required');
  }

  if (!medication.instructions?.dose?.trim()) {
    errors.push('Dose instructions are required');
  }

  if (!medication.instructions?.frequency?.trim()) {
    errors.push('Frequency instructions are required');
  }

  if (!medication.instructions?.route?.trim()) {
    errors.push('Route of administration is required');
  }

  if (!medication.category) {
    errors.push('Medication category is required');
  }

  if (!medication.startDate) {
    errors.push('Start date is required');
  }

  if (!medication.indication?.trim()) {
    errors.push('Indication is required');
  }

  return errors;
};

/**
 * Validate therapy plan data
 */
export const validateTherapyPlan = (plan: Partial<TherapyPlan>): string[] => {
  const errors: string[] = [];

  if (!plan.problems || plan.problems.length === 0) {
    errors.push(
      'At least one problem must be associated with the therapy plan'
    );
  }

  if (!plan.recommendations || plan.recommendations.length === 0) {
    errors.push('At least one recommendation is required');
  }

  plan.recommendations?.forEach((rec, index) => {
    if (!rec.type) {
      errors.push(`Recommendation ${index + 1}: Type is required`);
    }
    if (!rec.rationale?.trim()) {
      errors.push(`Recommendation ${index + 1}: Rationale is required`);
    }
    if (!rec.priority) {
      errors.push(`Recommendation ${index + 1}: Priority is required`);
    }
  });

  if (!plan.timeline?.trim()) {
    errors.push('Timeline is required');
  }

  return errors;
};

/**
 * Calculate MTR completion percentage
 */
export const calculateCompletionPercentage = (
  mtr: MedicationTherapyReview
): number => {
  // Check if steps object exists and is not null
  if (!mtr.steps) {
    console.warn(
      'MTR steps object is undefined or null, returning 0% completion'
    );
    return 0;
  }

  try {
    const steps = Object.values(mtr.steps);
    const completedSteps = steps.filter(
      (step) => step && step.completed
    ).length;
    return Math.round((completedSteps / steps.length) * 100);
  } catch (error) {
    console.error('Error calculating completion percentage:', error);
    return 0; // Return 0% completion on error
  }
};

/**
 * Check if MTR is overdue
 */
export const isOverdue = (mtr: MedicationTherapyReview): boolean => {
  try {
    if (!mtr || !mtr.status) {
      return false;
    }

    if (mtr.status === 'completed' || mtr.status === 'cancelled') {
      return false;
    }

    const now = new Date();
    const startDate = new Date(mtr.startedAt);
    const daysSinceStart = Math.floor(
      (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Consider overdue if in progress for more than 7 days for routine, 3 days for urgent, 1 day for high_risk
    const overdueThresholds = {
      routine: 7,
      urgent: 3,
      high_risk: 1,
    };

    return daysSinceStart > overdueThresholds[mtr.priority];
  } catch (error) {
    console.error('Error checking if MTR is overdue:', error);
    return false; // Return not overdue on error
  }
};

/**
 * Format search parameters for API calls
 */
export const formatSearchParams = (
  params: SearchParamsType
): URLSearchParams => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        value.forEach((item) => searchParams.append(key, item.toString()));
      } else {
        searchParams.append(key, value.toString());
      }
    }
  });

  return searchParams;
};

/**
 * Handle API errors with proper typing and context
 */
export const handleMTRError = (error: unknown, context: string): never => {
  console.error(`MTR Service Error in ${context}:`, error);

  const apiError = error as {
    response?: {
      status?: number;
      data?: {
        message?: string;
        details?: Record<string, unknown>;
        id?: string;
        code?: string;
      };
    };
    message?: string;
  };

  if (apiError.response?.status === 400) {
    throw new MTRValidationError(
      apiError.response.data?.message || 'Validation failed',
      apiError.response.data?.details || {}
    );
  }

  if (apiError.response?.status === 404) {
    throw new MTRNotFoundError(
      context,
      apiError.response.data?.id || 'unknown'
    );
  }

  if (apiError.response?.status === 403) {
    throw new MTRPermissionError(context);
  }

  // Generic error
  const serviceError = new Error(
    apiError.response?.data?.message ||
    apiError.message ||
    'An unexpected error occurred'
  ) as MTRServiceError;

  serviceError.code = apiError.response?.data?.code || 'MTR_SERVICE_ERROR';
  serviceError.status = apiError.response?.status || 500;
  serviceError.details = apiError.response?.data?.details || {};

  throw serviceError;
};

/**
 * MTR Service - Handles all MTR-related API calls with comprehensive error handling and data transformation
 */
export const mtrService = {
  // ===============================
  // MEDICATION THERAPY REVIEW CRUD
  // ===============================

  /**
   * Get all MTR sessions with optional filtering
   */
  async getMTRSessions(
    params: MTRSearchParams = {}
  ): Promise<MTRListResponse['data']> {
    try {
      const searchParams = formatSearchParams(params as SearchParamsType);
      const queryString = searchParams.toString();
      const url = `/mtr${queryString ? `?${queryString}` : ''}`;

      const response = await apiHelpers.get<MTRListResponse['data']>(url);

      // Handle double-wrapped response: response.data.data or response.data
      const actualData: MTRListResponse['data'] = (response.data as any).data || response.data;

      if (!actualData) {
        throw new Error('Invalid response structure');
      }

      // Transform dates and add computed fields
      const transformedResults = actualData.results.map(
        (mtr: MedicationTherapyReview) => {
          const transformed = transformDatesForFrontend(
            mtr as unknown as unknown as DateTransformable
          ) as unknown as MedicationTherapyReview;
          return {
            ...transformed,
            completionPercentage: calculateCompletionPercentage(transformed),
            isOverdue: isOverdue(transformed),
          } as MedicationTherapyReview;
        }
      );

      return {
        ...actualData,
        results: transformedResults,
      };
    } catch (error) {
      return handleMTRError(error, 'getMTRSessions');
    }
  },

  /**
   * Get a single MTR session by ID
   */
  async getMTRSession(sessionId: string): Promise<MTRResponse['data']> {
    try {
      if (!sessionId?.trim()) {
        throw new MTRValidationError('Session ID is required');
      }

      const response = await apiHelpers.get<MTRResponse['data']>(
        `/mtr/${sessionId}`
      );

      if (!response.data.data) {
        throw new Error('Invalid response structure');
      }

      // Transform dates and add computed fields
      const transformed = transformDatesForFrontend(
        response.data.data.review as unknown as DateTransformable
      ) as unknown as MedicationTherapyReview;
      const enhancedReview = {
        ...transformed,
        completionPercentage: calculateCompletionPercentage(transformed),
        isOverdue: isOverdue(transformed),
      } as MedicationTherapyReview;

      return {
        review: enhancedReview,
      };
    } catch (error) {
      return handleMTRError(error, 'getMTRSession');
    }
  },

  /**
   * Create a new MTR session
   */
  async createMTRSession(
    sessionData: CreateMTRData
  ): Promise<MTRResponse['data']> {
    try {

      // Validate required fields
      if (!sessionData.patientId?.trim()) {
        throw new MTRValidationError('Patient ID is required');
      }

      // Transform data for API
      const transformedData = transformDatesForAPI(
        sessionData as unknown as Record<string, unknown>
      );


      const response = await apiHelpers.post<MTRResponse['data']>(
        '/mtr',
        transformedData
      );


      // Handle double-wrapped response structure from backend
      // Backend sends: {success: true, data: {review: {...}}}
      // Axios wraps it: response.data = {success: true, data: {review: {...}}}
      // So we need: response.data.data.review
      const actualData: any = response.data?.data || response.data;

      if (!actualData || !actualData.review) {
        console.error('❌ Invalid response structure - missing review');
        throw new Error('Invalid response structure from server');
      }


      // Transform response dates
      const transformed = transformDatesForFrontend(
        actualData.review as any
      ) as unknown as MedicationTherapyReview;


      const enhancedReview = {
        ...transformed,
        _id: transformed._id || actualData.review._id, // Ensure _id is preserved
        completionPercentage: calculateCompletionPercentage(transformed),
        isOverdue: isOverdue(transformed),
      } as MedicationTherapyReview;


      return {
        review: enhancedReview,
      };
    } catch (error) {
      console.error('❌ createMTRSession error:', error);
      console.error('❌ Error type:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('❌ Error message:', error instanceof Error ? error.message : String(error));
      return handleMTRError(error, 'createMTRSession');
    }
  },

  /**
   * Update an MTR session
   */
  async updateMTRSession(
    sessionId: string,
    sessionData: UpdateMTRData
  ): Promise<MTRResponse['data']> {
    try {
      if (!sessionId?.trim()) {
        throw new MTRValidationError('Session ID is required');
      }

      // Validate medications if provided
      if (sessionData.medications) {
        const medicationErrors: string[] = [];
        sessionData.medications.forEach((med, index) => {
          const errors = validateMedicationEntry(med);
          if (errors.length > 0) {
            medicationErrors.push(
              `Medication ${index + 1}: ${errors.join(', ')}`
            );
          }
        });

        if (medicationErrors.length > 0) {
          throw new MTRValidationError('Medication validation failed', {
            medications: medicationErrors,
          });
        }
      }

      // Validate therapy plan if provided
      if (sessionData.plan) {
        const planErrors = validateTherapyPlan(sessionData.plan);
        if (planErrors.length > 0) {
          throw new MTRValidationError('Therapy plan validation failed', {
            plan: planErrors,
          });
        }
      }

      // Transform data for API
      const transformedData = transformDatesForAPI(
        sessionData as unknown as Record<string, unknown>
      );

      const response = await apiHelpers.put<MTRResponse['data']>(
        `/mtr/${sessionId}`,
        transformedData
      );

      if (!response.data.data) {
        throw new Error('Invalid response structure');
      }

      // Transform response dates
      const transformed = transformDatesForFrontend(
        response.data.data.review as unknown as DateTransformable
      ) as unknown as MedicationTherapyReview;
      const enhancedReview = {
        ...transformed,
        completionPercentage: calculateCompletionPercentage(transformed),
        isOverdue: isOverdue(transformed),
      } as MedicationTherapyReview;

      return {
        review: enhancedReview,
      };
    } catch (error) {
      return handleMTRError(error, 'updateMTRSession');
    }
  },

  /**
   * Delete an MTR session
   */
  async deleteMTRSession(sessionId: string): Promise<ApiResponse> {
    try {
      if (!sessionId?.trim()) {
        throw new MTRValidationError('Session ID is required');
      }

      const response = await apiHelpers.delete(`/mtr/${sessionId}`);
      return (response.data as any).data || response.data;
    } catch (error) {
      return handleMTRError(error, 'deleteMTRSession');
    }
  },

  /**
   * Complete an MTR workflow step
   */
  async completeWorkflowStep(
    sessionId: string,
    stepName: string,
    stepData?: Record<string, unknown>
  ): Promise<MTRResponse['data']> {
    try {
      if (!sessionId?.trim()) {
        throw new MTRValidationError('Session ID is required');
      }

      if (!stepName?.trim()) {
        throw new MTRValidationError('Step name is required');
      }

      const validSteps = [
        'patientSelection',
        'medicationHistory',
        'therapyAssessment',
        'planDevelopment',
        'interventions',
        'followUp',
      ];
      if (!validSteps.includes(stepName)) {
        throw new MTRValidationError(
          `Invalid step name: ${stepName}. Valid steps: ${validSteps.join(
            ', '
          )}`
        );
      }

      // Transform step data for API
      const transformedStepData = stepData
        ? transformDatesForAPI(stepData)
        : undefined;

      const response = await apiHelpers.post<MTRResponse['data']>(
        `/mtr/${sessionId}/steps/${stepName}/complete`,
        { data: transformedStepData }
      );

      if (!response.data.data) {
        throw new Error('Invalid response structure');
      }

      // Transform response dates
      const transformed = transformDatesForFrontend(
        response.data.data.review as unknown as DateTransformable
      ) as unknown as MedicationTherapyReview;
      const enhancedReview = {
        ...transformed,
        completionPercentage: calculateCompletionPercentage(transformed),
        isOverdue: isOverdue(transformed),
      } as MedicationTherapyReview;

      return {
        review: enhancedReview,
      };
    } catch (error) {
      return handleMTRError(error, 'completeWorkflowStep');
    }
  },

  /**
   * Get MTR workflow steps configuration
   */
  async getWorkflowSteps(): Promise<Record<string, unknown>> {
    try {
      const response = await apiHelpers.get<
        Record<string, unknown>
      >('/mtr/workflow/steps');
      return ((response.data as any).data || response.data) as Record<string, unknown>;
    } catch (error) {
      return handleMTRError(error, 'getWorkflowSteps');
    }
  },

  /**
   * Validate workflow step
   */
  async validateWorkflowStep(
    sessionId: string,
    stepName: string,
    data?: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    try {
      const response = await apiHelpers.post<
        Record<string, unknown>
      >(`/mtr/${sessionId}/steps/${stepName}/validate`, { data });
      return ((response.data as any).data || response.data) as Record<string, unknown>;
    } catch (error) {
      return handleMTRError(error, 'validateWorkflowStep');
    }
  },

  /**
   * Check drug interactions for medications
   */
  async checkDrugInteractions(
    sessionId: string
  ): Promise<Record<string, unknown>> {
    try {
      const response = await apiHelpers.post<
        Record<string, unknown>
      >(`/mtr/${sessionId}/interactions/check`);
      return ((response.data as any).data || response.data) as Record<string, unknown>;
    } catch (error) {
      return handleMTRError(error, 'checkDrugInteractions');
    }
  },

  // ===============================
  // DRUG THERAPY PROBLEMS CRUD
  // ===============================

  /**
   * Get drug therapy problems with optional filtering
   */
  async getDrugTherapyProblems(
    params: DTPSearchParams = {}
  ): Promise<DTPListResponse['data']> {
    try {
      const searchParams = formatSearchParams(params as SearchParamsType);
      const queryString = searchParams.toString();
      const url = `/mtr/problems${queryString ? `?${queryString}` : ''}`;

      const response = await apiHelpers.get<DTPListResponse['data']>(url);

      // Handle double-wrapped response: response.data.data or response.data
      const actualData: DTPListResponse['data'] = (response.data as any).data || response.data;

      if (!actualData) {
        throw new Error('Invalid response structure');
      }

      // Transform dates in results
      const transformedResults = actualData.results.map(
        (problem: DrugTherapyProblem) =>
          transformDatesForFrontend(
            problem as unknown as DateTransformable
          ) as unknown as DrugTherapyProblem
      );

      return {
        ...actualData,
        results: transformedResults,
      };
    } catch (error) {
      return handleMTRError(error, 'getDrugTherapyProblems');
    }
  },

  /**
   * Get a single drug therapy problem by ID
   */
  async getDrugTherapyProblem(problemId: string): Promise<DTPResponse['data']> {
    try {
      const response = await apiHelpers.get<DTPResponse['data']>(
        `/mtr/problems/${problemId}`
      );
      if (!response.data.data) {
        throw new Error('Invalid response structure');
      }
      return (response.data as any).data || response.data;
    } catch (error) {
      return handleMTRError(error, 'getDrugTherapyProblem');
    }
  },

  /**
   * Create a new drug therapy problem
   */
  async createDrugTherapyProblem(
    problemData: CreateDTPData
  ): Promise<DTPResponse['data']> {
    try {
      // Validate required fields
      if (!problemData.patientId?.trim()) {
        throw new MTRValidationError('Patient ID is required');
      }

      if (!problemData.category?.trim()) {
        throw new MTRValidationError('Problem category is required');
      }

      if (!problemData.description?.trim()) {
        throw new MTRValidationError('Problem description is required');
      }

      if (!problemData.clinicalSignificance?.trim()) {
        throw new MTRValidationError('Clinical significance is required');
      }

      if (
        !problemData.affectedMedications ||
        problemData.affectedMedications.length === 0
      ) {
        throw new MTRValidationError(
          'At least one affected medication is required'
        );
      }

      // Transform data for API
      const transformedData = transformDatesForAPI(
        problemData as unknown as Record<string, unknown>
      );

      const response = await apiHelpers.post<DTPResponse['data']>(
        '/mtr/problems',
        transformedData
      );

      if (!response.data.data) {
        throw new Error('Invalid response structure');
      }

      // Transform response dates
      const transformed = transformDatesForFrontend(
        response.data.data.problem as unknown as DateTransformable
      ) as unknown as DrugTherapyProblem;

      return {
        problem: transformed,
      };
    } catch (error) {
      return handleMTRError(error, 'createDrugTherapyProblem');
    }
  },

  /**
   * Update a drug therapy problem
   */
  async updateDrugTherapyProblem(
    problemId: string,
    problemData: UpdateDTPData
  ): Promise<DTPResponse['data']> {
    try {
      const response = await apiHelpers.put<DTPResponse['data']>(
        `/mtr/problems/${problemId}`,
        problemData
      );
      if (!response.data.data) {
        throw new Error('Invalid response structure');
      }
      return (response.data as any).data || response.data;
    } catch (error) {
      return handleMTRError(error, 'updateDrugTherapyProblem');
    }
  },

  /**
   * Delete a drug therapy problem
   */
  async deleteDrugTherapyProblem(problemId: string): Promise<ApiResponse> {
    try {
      const response = await apiHelpers.delete(`/mtr/problems/${problemId}`);
      return (response.data as any).data || response.data;
    } catch (error) {
      return handleMTRError(error, 'deleteDrugTherapyProblem');
    }
  },

  /**
   * Resolve a drug therapy problem
   */
  async resolveDrugTherapyProblem(
    problemId: string,
    resolution: { action: string; outcome: string }
  ): Promise<DTPResponse['data']> {
    try {
      const response = await apiHelpers.post<DTPResponse['data']>(
        `/mtr/problems/${problemId}/resolve`,
        resolution
      );
      if (!response.data.data) {
        throw new Error('Invalid response structure');
      }
      return (response.data as any).data || response.data;
    } catch (error) {
      return handleMTRError(error, 'resolveDrugTherapyProblem');
    }
  },

  /**
   * Reopen a resolved drug therapy problem
   */
  async reopenDrugTherapyProblem(
    problemId: string
  ): Promise<DTPResponse['data']> {
    try {
      const response = await apiHelpers.post<DTPResponse['data']>(
        `/mtr/problems/${problemId}/reopen`
      );
      if (!response.data.data) {
        throw new Error('Invalid response structure');
      }
      return (response.data as any).data || response.data;
    } catch (error) {
      return handleMTRError(error, 'reopenDrugTherapyProblem');
    }
  },

  // ===============================
  // MTR INTERVENTIONS CRUD
  // ===============================

  /**
   * Get MTR interventions with optional filtering
   */
  async getInterventions(
    params: InterventionSearchParams = {}
  ): Promise<InterventionListResponse['data']> {
    try {
      const searchParams = new URLSearchParams();

      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, value.toString());
        }
      });

      const queryString = searchParams.toString();
      const url = `/mtr/interventions${queryString ? `?${queryString}` : ''}`;

      const response = await apiHelpers.get<InterventionListResponse['data']>(url);
      if (!response.data.data) {
        throw new Error('Invalid response structure');
      }
      return (response.data as any).data || response.data;
    } catch (error) {
      return handleMTRError(error, 'getInterventions');
    }
  },

  /**
   * Get a single intervention by ID
   */
  async getIntervention(
    interventionId: string
  ): Promise<InterventionResponse['data']> {
    try {
      const response = await apiHelpers.get<InterventionResponse['data']>(`/mtr/interventions/${interventionId}`);
      if (!response.data.data) {
        throw new Error('Invalid response structure');
      }
      return (response.data as any).data || response.data;
    } catch (error) {
      return handleMTRError(error, 'getIntervention');
    }
  },

  /**
   * Create a new intervention
   */
  async createIntervention(
    interventionData: CreateInterventionData
  ): Promise<InterventionResponse['data']> {
    try {
      // Validate required fields
      if (!interventionData.reviewId?.trim()) {
        throw new MTRValidationError('Review ID is required');
      }

      if (!interventionData.patientId?.trim()) {
        throw new MTRValidationError('Patient ID is required');
      }

      if (!interventionData.description?.trim()) {
        throw new MTRValidationError('Intervention description is required');
      }

      if (!interventionData.rationale?.trim()) {
        throw new MTRValidationError('Intervention rationale is required');
      }

      if (!interventionData.documentation?.trim()) {
        throw new MTRValidationError('Intervention documentation is required');
      }

      // Transform data for API
      const transformedData = transformDatesForAPI(
        interventionData as unknown as Record<string, unknown>
      );

      const response = await apiHelpers.post<InterventionResponse['data']>('/mtr/interventions', transformedData);

      if (!response.data.data) {
        throw new Error('Invalid response structure');
      }

      // Transform response dates
      const transformed = transformDatesForFrontend(
        response.data.data.intervention as unknown as DateTransformable
      ) as unknown as MTRIntervention;

      return {
        intervention: transformed,
      };
    } catch (error) {
      return handleMTRError(error, 'createIntervention');
    }
  },

  /**
   * Update an intervention
   */
  async updateIntervention(
    interventionId: string,
    interventionData: UpdateInterventionData
  ): Promise<InterventionResponse['data']> {
    try {
      const response = await apiHelpers.put<
        ApiResponse<InterventionResponse['data']>
      >(`/mtr/interventions/${interventionId}`, interventionData);
      if (!response.data.data) {
        throw new Error('Invalid response structure');
      }
      return (response.data as any).data || response.data;
    } catch (error) {
      return handleMTRError(error, 'updateIntervention');
    }
  },

  /**
   * Delete an intervention
   */
  async deleteIntervention(interventionId: string): Promise<ApiResponse> {
    try {
      const response = await apiHelpers.delete(
        `/mtr/interventions/${interventionId}`
      );
      return (response.data as any).data || response.data;
    } catch (error) {
      return handleMTRError(error, 'deleteIntervention');
    }
  },

  /**
   * Mark intervention as completed
   */
  async completeIntervention(
    interventionId: string,
    outcome: string,
    details?: string
  ): Promise<InterventionResponse['data']> {
    try {
      const response = await apiHelpers.post<InterventionResponse['data']>(`/mtr/interventions/${interventionId}/complete`, { outcome, details });
      if (!response.data.data) {
        throw new Error('Invalid response structure');
      }
      return (response.data as any).data || response.data;
    } catch (error) {
      return handleMTRError(error, 'completeIntervention');
    }
  },

  // ===============================
  // MTR FOLLOW-UPS CRUD
  // ===============================

  /**
   * Get MTR follow-ups with optional filtering
   */
  async getFollowUps(
    params: FollowUpSearchParams = {}
  ): Promise<FollowUpListResponse['data']> {
    try {
      const searchParams = new URLSearchParams();

      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, value.toString());
        }
      });

      const queryString = searchParams.toString();
      const url = `/mtr/followups${queryString ? `?${queryString}` : ''}`;

      const response = await apiHelpers.get<FollowUpListResponse['data']>(url);
      if (!response.data.data) {
        throw new Error('Invalid response structure');
      }
      return (response.data as any).data || response.data;
    } catch (error) {
      return handleMTRError(error, 'getFollowUps');
    }
  },

  /**
   * Get a single follow-up by ID
   */
  async getFollowUp(followUpId: string): Promise<FollowUpResponse['data']> {
    try {
      const response = await apiHelpers.get<FollowUpResponse['data']>(`/mtr/followups/${followUpId}`);
      if (!response.data.data) {
        throw new Error('Invalid response structure');
      }
      return (response.data as any).data || response.data;
    } catch (error) {
      return handleMTRError(error, 'getFollowUp');
    }
  },

  /**
   * Create a new follow-up
   */
  async createFollowUp(
    followUpData: CreateFollowUpData
  ): Promise<FollowUpResponse['data']> {
    try {
      const response = await apiHelpers.post<FollowUpResponse['data']>('/mtr/followups', followUpData);
      if (!response.data.data) {
        throw new Error('Invalid response structure');
      }
      return (response.data as any).data || response.data;
    } catch (error) {
      return handleMTRError(error, 'createFollowUp');
    }
  },

  /**
   * Update a follow-up
   */
  async updateFollowUp(
    followUpId: string,
    followUpData: UpdateFollowUpData
  ): Promise<FollowUpResponse['data']> {
    try {
      const response = await apiHelpers.put<
        ApiResponse<FollowUpResponse['data']>
      >(`/mtr/followups/${followUpId}`, followUpData);
      if (!response.data.data) {
        throw new Error('Invalid response structure');
      }
      return (response.data as any).data || response.data;
    } catch (error) {
      return handleMTRError(error, 'updateFollowUp');
    }
  },

  /**
   * Delete a follow-up
   */
  async deleteFollowUp(followUpId: string): Promise<ApiResponse> {
    try {
      const response = await apiHelpers.delete(`/mtr/followups/${followUpId}`);
      return (response.data as any).data || response.data;
    } catch (error) {
      return handleMTRError(error, 'deleteFollowUp');
    }
  },

  /**
   * Complete a follow-up
   */
  async completeFollowUp(
    followUpId: string,
    outcome: {
      status: 'successful' | 'partially_successful' | 'unsuccessful';
      notes: string;
      nextActions: string[];
      nextFollowUpDate?: string;
      adherenceImproved?: boolean;
      problemsResolved?: string[];
      newProblemsIdentified?: string[];
    }
  ): Promise<FollowUpResponse['data']> {
    try {
      const response = await apiHelpers.post<FollowUpResponse['data']>(`/mtr/followups/${followUpId}/complete`, { outcome });
      if (!response.data.data) {
        throw new Error('Invalid response structure');
      }
      return (response.data as any).data || response.data;
    } catch (error) {
      return handleMTRError(error, 'completeFollowUp');
    }
  },

  /**
   * Reschedule a follow-up
   */
  async rescheduleFollowUp(
    followUpId: string,
    newDate: string,
    reason?: string
  ): Promise<FollowUpResponse['data']> {
    try {
      const response = await apiHelpers.post<FollowUpResponse['data']>(`/mtr/followups/${followUpId}/reschedule`, { newDate, reason });
      if (!response.data.data) {
        throw new Error('Invalid response structure');
      }
      return (response.data as any).data || response.data;
    } catch (error) {
      return handleMTRError(error, 'rescheduleFollowUp');
    }
  },

  // ===============================
  // SPECIALIZED QUERIES
  // ===============================

  /**
   * Get MTR sessions by patient
   */
  async getMTRSessionsByPatient(
    patientId: string,
    params: Omit<MTRSearchParams, 'patientId'> = {}
  ) {
    return this.getMTRSessions({ ...params, patientId });
  },

  /**
   * Get active MTR sessions
   */
  async getActiveMTRSessions(params: Omit<MTRSearchParams, 'status'> = {}) {
    return this.getMTRSessions({ ...params, status: 'in_progress' });
  },

  /**
   * Get overdue MTR sessions
   */
  async getOverdueMTRSessions(): Promise<Record<string, unknown>> {
    try {
      const response = await apiHelpers.get('/mtr/overdue');
      return (response.data as any).data || response.data;
    } catch (error) {
      return handleMTRError(error, 'getOverdueMTRSessions');
    }
  },

  /**
   * Get drug therapy problems by patient
   */
  async getDrugTherapyProblemsByPatient(
    patientId: string,
    params: Omit<DTPSearchParams, 'patientId'> = {}
  ) {
    return this.getDrugTherapyProblems({ ...params, patientId });
  },

  /**
   * Get active drug therapy problems
   */
  async getActiveDrugTherapyProblems(
    params: Omit<DTPSearchParams, 'status'> = {}
  ) {
    return this.getDrugTherapyProblems({
      ...params,
      status: 'identified,addressed,monitoring',
    });
  },

  /**
   * Get interventions by review
   */
  async getInterventionsByReview(
    reviewId: string,
    params: Omit<InterventionSearchParams, 'reviewId'> = {}
  ) {
    return this.getInterventions({ ...params, reviewId });
  },

  /**
   * Get pending interventions
   */
  async getPendingInterventions(
    params: Omit<InterventionSearchParams, 'outcome'> = {}
  ) {
    return this.getInterventions({ ...params, outcome: 'pending' });
  },

  /**
   * Get overdue follow-ups
   */
  async getOverdueFollowUps(): Promise<Record<string, unknown>> {
    try {
      const response = await apiHelpers.get('/mtr/followups/overdue');
      return (response.data as any).data || response.data;
    } catch (error) {
      return handleMTRError(error, 'getOverdueFollowUps');
    }
  },

  /**
   * Get follow-ups by review
   */
  async getFollowUpsByReview(
    reviewId: string,
    params: Omit<FollowUpSearchParams, 'reviewId'> = {}
  ) {
    return this.getFollowUps({ ...params, reviewId });
  },

  /**
   * Get scheduled follow-ups
   */
  async getScheduledFollowUps(
    params: Omit<FollowUpSearchParams, 'status'> = {}
  ) {
    return this.getFollowUps({ ...params, status: 'scheduled' });
  },

  // ===============================
  // STATISTICS AND REPORTING
  // ===============================

  /**
   * Get MTR statistics
   */
  async getMTRStatistics(dateRange?: {
    start: string;
    end: string;
  }): Promise<Record<string, unknown>> {
    try {
      const params = new URLSearchParams();
      if (dateRange) {
        params.append('startDate', dateRange.start);
        params.append('endDate', dateRange.end);
      }

      const queryString = params.toString();
      const url = `/mtr/statistics${queryString ? `?${queryString}` : ''}`;

      const response = await apiHelpers.get(url);
      return (response.data as any).data || response.data;
    } catch (error) {
      return handleMTRError(error, 'getMTRStatistics');
    }
  },

  /**
   * Get drug therapy problem statistics
   */
  async getDTPStatistics(dateRange?: {
    start: string;
    end: string;
  }): Promise<Record<string, unknown>> {
    try {
      const params = new URLSearchParams();
      if (dateRange) {
        params.append('startDate', dateRange.start);
        params.append('endDate', dateRange.end);
      }

      const queryString = params.toString();
      const url = `/mtr/problems/statistics${queryString ? `?${queryString}` : ''
        }`;

      const response = await apiHelpers.get(url);
      return (response.data as any).data || response.data;
    } catch (error) {
      return handleMTRError(error, 'getDTPStatistics');
    }
  },

  /**
   * Get intervention statistics
   */
  async getInterventionStatistics(dateRange?: {
    start: string;
    end: string;
  }): Promise<Record<string, unknown>> {
    try {
      const params = new URLSearchParams();
      if (dateRange) {
        params.append('startDate', dateRange.start);
        params.append('endDate', dateRange.end);
      }

      const queryString = params.toString();
      const url = `/mtr/interventions/statistics${queryString ? `?${queryString}` : ''
        }`;

      const response = await apiHelpers.get(url);
      return (response.data as any).data || response.data;
    } catch (error) {
      return handleMTRError(error, 'getInterventionStatistics');
    }
  },

  /**
   * Get follow-up statistics
   */
  async getFollowUpStatistics(dateRange?: {
    start: string;
    end: string;
  }): Promise<Record<string, unknown>> {
    try {
      const params = new URLSearchParams();
      if (dateRange) {
        params.append('startDate', dateRange.start);
        params.append('endDate', dateRange.end);
      }

      const queryString = params.toString();
      const url = `/mtr/followups/statistics${queryString ? `?${queryString}` : ''
        }`;

      const response = await apiHelpers.get(url);
      return (response.data as any).data || response.data;
    } catch (error) {
      return handleMTRError(error, 'getFollowUpStatistics');
    }
  },

  // ===============================
  // AUDIT AND COMPLIANCE
  // ===============================

  /**
   * Get MTR audit logs
   */
  async getAuditLogs(
    params: {
      resourceType?: string;
      action?: string;
      userId?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
    } = {}
  ): Promise<Record<string, unknown>> {
    try {
      const searchParams = formatSearchParams(params as SearchParamsType);
      const queryString = searchParams.toString();
      const url = `/mtr/audit${queryString ? `?${queryString}` : ''}`;

      const response = await apiHelpers.get(url);
      return (response.data as any).data || response.data;
    } catch (error) {
      return handleMTRError(error, 'getAuditLogs');
    }
  },

  // ===============================
  // ADDITIONAL UTILITY METHODS
  // ===============================

  /**
   * Validate MTR session data before submission
   */
  validateMTRSession(sessionData: Partial<MedicationTherapyReview>): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!sessionData.patientId?.trim()) {
      errors.push('Patient ID is required');
    }

    if (sessionData.medications) {
      sessionData.medications.forEach((med, index) => {
        const medErrors = validateMedicationEntry(med);
        if (medErrors.length > 0) {
          errors.push(`Medication ${index + 1}: ${medErrors.join(', ')}`);
        }
      });
    }

    if (sessionData.plan) {
      const planErrors = validateTherapyPlan(sessionData.plan);
      errors.push(...planErrors);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },

  /**
   * Get MTR session summary for dashboard display
   */
  async getMTRSummary(sessionId: string): Promise<{
    session: MedicationTherapyReview;
    problemsCount: number;
    interventionsCount: number;
    followUpsCount: number;
    completionPercentage: number;
    isOverdue: boolean;
  }> {
    try {
      const [session, problems, interventions, followUps] = await Promise.all([
        this.getMTRSession(sessionId),
        this.getDrugTherapyProblems({ reviewId: sessionId }),
        this.getInterventions({ reviewId: sessionId }),
        this.getFollowUps({ reviewId: sessionId }),
      ]);

      return {
        session: session.review,
        problemsCount: problems.total || 0,
        interventionsCount: interventions.total || 0,
        followUpsCount: followUps.total || 0,
        completionPercentage: calculateCompletionPercentage(session.review),
        isOverdue: isOverdue(session.review),
      };
    } catch (error) {
      return handleMTRError(error, 'getMTRSummary');
    }
  },

  /**
   * Bulk update MTR sessions status
   */
  async bulkUpdateMTRStatus(
    sessionIds: string[],
    status: MedicationTherapyReview['status']
  ): Promise<{ updated: number; failed: string[] }> {
    try {
      if (!sessionIds || sessionIds.length === 0) {
        throw new MTRValidationError('Session IDs are required');
      }

      const validStatuses = [
        'in_progress',
        'completed',
        'cancelled',
        'on_hold',
      ];
      if (!validStatuses.includes(status)) {
        throw new MTRValidationError(
          `Invalid status: ${status}. Valid statuses: ${validStatuses.join(
            ', '
          )}`
        );
      }

      const response = await apiHelpers.post('/mtr/bulk-update-status', {
        sessionIds,
        status,
      });

      return response.data.data as { updated: number; failed: string[] };
    } catch (error) {
      return handleMTRError(error, 'bulkUpdateMTRStatus');
    }
  },

  // ===============================
  // REPORTS AND ANALYTICS
  // ===============================

  /**
   * Get MTR summary report
   */
  async getMTRSummaryReport(
    params: {
      startDate?: string;
      endDate?: string;
      pharmacistId?: string;
      reviewType?: string;
      priority?: string;
    } = {}
  ): Promise<Record<string, unknown>> {
    try {
      const searchParams = formatSearchParams(params as SearchParamsType);
      const queryString = searchParams.toString();
      const url = `/mtr/reports/summary${queryString ? `?${queryString}` : ''}`;

      const response = await apiHelpers.get(url);
      return (response.data as any).data || response.data;
    } catch (error) {
      return handleMTRError(error, 'getMTRSummaryReport');
    }
  },

  /**
   * Get intervention effectiveness report
   */
  async getInterventionEffectivenessReport(
    params: {
      startDate?: string;
      endDate?: string;
      pharmacistId?: string;
      interventionType?: string;
    } = {}
  ): Promise<Record<string, unknown>> {
    try {
      const searchParams = formatSearchParams(params as SearchParamsType);
      const queryString = searchParams.toString();
      const url = `/mtr/reports/interventions${queryString ? `?${queryString}` : ''
        }`;

      const response = await apiHelpers.get(url);
      return (response.data as any).data || response.data;
    } catch (error) {
      return handleMTRError(error, 'getInterventionEffectivenessReport');
    }
  },

  /**
   * Get pharmacist performance report
   */
  async getPharmacistPerformanceReport(
    params: {
      startDate?: string;
      endDate?: string;
      pharmacistId?: string;
    } = {}
  ): Promise<Record<string, unknown>> {
    try {
      const searchParams = formatSearchParams(params as SearchParamsType);
      const queryString = searchParams.toString();
      const url = `/mtr/reports/pharmacists${queryString ? `?${queryString}` : ''
        }`;

      const response = await apiHelpers.get(url);
      return (response.data as any).data || response.data;
    } catch (error) {
      return handleMTRError(error, 'getPharmacistPerformanceReport');
    }
  },

  /**
   * Get quality assurance report
   */
  async getQualityAssuranceReport(
    params: {
      startDate?: string;
      endDate?: string;
    } = {}
  ): Promise<Record<string, unknown>> {
    try {
      const searchParams = formatSearchParams(params);
      const queryString = searchParams.toString();
      const url = `/mtr/reports/quality${queryString ? `?${queryString}` : ''}`;

      const response = await apiHelpers.get(url);
      return (response.data as any).data || response.data;
    } catch (error) {
      return handleMTRError(error, 'getQualityAssuranceReport');
    }
  },

  /**
   * Get outcome metrics report
   */
  async getOutcomeMetricsReport(
    params: {
      startDate?: string;
      endDate?: string;
      reviewType?: string;
    } = {}
  ): Promise<Record<string, unknown>> {
    try {
      const searchParams = formatSearchParams(params);
      const queryString = searchParams.toString();
      const url = `/mtr/reports/outcomes${queryString ? `?${queryString}` : ''
        }`;

      const response = await apiHelpers.get(url);
      return (response.data as any).data || response.data;
    } catch (error) {
      return handleMTRError(error, 'getOutcomeMetricsReport');
    }
  },

  /**
   * Export MTR data for reporting
   */
  async exportMTRData(params: {
    sessionIds?: string[];
    dateRange?: { start: string; end: string };
    format?: 'json' | 'csv' | 'pdf';
    includeAuditLog?: boolean;
  }): Promise<Blob> {
    try {
      // Flatten dateRange for query params
      const { dateRange, ...restParams } = params;
      const flatParams: SearchParamsType = {
        ...restParams,
        ...(dateRange && {
          dateStart: dateRange.start,
          dateEnd: dateRange.end,
        }),
      };

      const searchParams = formatSearchParams(flatParams);
      const queryString = searchParams.toString();
      const url = `/mtr/export${queryString ? `?${queryString}` : ''}`;

      const response = await apiHelpers.get(url);

      // Handle blob response for file downloads
      if (response.data instanceof Blob) {
        return (response.data as any).data || response.data;
      }

      // Convert JSON response to blob if needed
      const blob = new Blob([JSON.stringify(response.data, null, 2)], {
        type: 'application/json',
      });

      return blob;
    } catch (error) {
      return handleMTRError(error, 'exportMTRData');
    }
  },

  /**
   * Check system health for MTR module
   */
  async checkMTRHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, boolean>;
    timestamp: string;
  }> {
    try {
      const response = await apiHelpers.get('/mtr/health');
      return response.data.data as {
        status: 'healthy' | 'degraded' | 'unhealthy';
        checks: Record<string, boolean>;
        timestamp: string;
      };
    } catch (error) {
      return handleMTRError(error, 'checkMTRHealth');
    }
  },
};

export default mtrService;
