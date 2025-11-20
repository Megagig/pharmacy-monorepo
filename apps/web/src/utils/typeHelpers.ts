// Type augmentation for safe type casting
export interface DateTransformable extends Record<string, unknown> {
  steps?: Record<string, { completedAt?: string | Date }>;
  [key: string]: unknown;
}

// Type for API response structure
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

// Data creation interfaces with proper Record<string, unknown> compatibility
export interface CreateMTRData {
  [key: string]: unknown;
}

export interface CreateDTPData {
  [key: string]: unknown;
}

export interface CreateInterventionData {
  [key: string]: unknown;
}

// Type for search parameters
export interface SearchParamsType {
  [key: string]: string | number | boolean | string[] | undefined;
}

// Helper function to safely convert to/from DateTransformable
export function safelyConvertToDateTransformable<T>(obj: T): DateTransformable {
  return obj as unknown as DateTransformable;
}

export function safelyConvertFromDateTransformable<T>(
  obj: DateTransformable
): T {
  return obj as unknown as T;
}

// Helper for safely returning API responses
export function safeApiResponse<T>(
  response: ApiResponse<T> | Record<string, unknown> | unknown
): T {
  if (response && typeof response === 'object') {
    if ('data' in response) {
      return response.data as unknown as T;
    }
    return response as unknown as T;
  }
  return response as unknown as T;
}
