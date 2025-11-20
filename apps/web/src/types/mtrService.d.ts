import {
  MedicationTherapyReview,
  DrugTherapyProblem,
  MTRIntervention,
  MTRFollowUp,
} from './mtr';

declare global {
  interface ImportMeta {
    env: {
      MODE: string;
      BASE_URL: string;
      PROD: boolean;
      DEV: boolean;
      NODE_ENV: string;
      VITE_API_BASE_URL: string;
      VITE_API_URL: string;
      [key: string]: string | boolean | undefined;
    };
  }
}

export type DateTransformable = Record<string, unknown>;

export interface CreateMTRData extends Record<string, unknown> {
  // Add specific properties if needed
  [key: string]: unknown;
}

export interface CreateDTPData extends Record<string, unknown> {
  // Add specific properties if needed
  [key: string]: unknown;
}

export interface CreateInterventionData extends Record<string, unknown> {
  // Add specific properties if needed
  [key: string]: unknown;
}

// Ensure proper API response typing
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}
