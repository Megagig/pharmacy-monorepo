import { PaginatedResponse } from '../types/patientManagement';

/**
 * Safely extracts results from a resource response that could be either
 * PaginatedResponse<T> or { results: T[] }
 */
export function extractResults<T>(
  response: PaginatedResponse<T> | { results: T[] } | undefined
): T[] {
  if (!response) return [];

  // Check if it's a PaginatedResponse with data.results
  if ('data' in response && response.data && 'results' in response.data) {
    return response.data.results;
  }

  // Check if it has direct results property
  if ('results' in response) {
    return response.results;
  }

  return [];
}

/**
 * Safely extracts a single item from an API response
 */
export function extractData<T>(
  response: { data?: T } | T | undefined
): T | undefined {
  if (!response) return undefined;

  // Check if it's wrapped in a data property
  if (typeof response === 'object' && response !== null && 'data' in response) {
    return response.data;
  }

  return response as T;
}

/**
 * Get authentication headers
 */
const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * API helpers object with HTTP methods for making requests
 */
export const apiHelpers = {
  /**
   * Make a GET request
   */
  get: async (url: string, options?: RequestInit) => {
    const response = await fetch(`/api${url}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
        ...options?.headers,
      },
      credentials: 'include',
      ...options,
    });

    if (!response.ok) {
      // Try to parse error response
      const contentType = response.headers.get('content-type');
      let errorMessage = `HTTP error! status: ${response.status}`;

      try {
        if (contentType?.includes('application/json')) {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error?.message || errorMessage;
        } else {
          const textResponse = await response.text();
          console.error('❌ Non-JSON error response:', textResponse.substring(0, 500));
          errorMessage = `Server error (${response.status})`;
        }
      } catch (e) {
        console.error('❌ Could not parse error response');
      }

      throw new Error(errorMessage);
    }

    // Parse successful response
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      const textResponse = await response.text();
      console.error('❌ Expected JSON but got:', contentType);
      console.error('Response preview:', textResponse.substring(0, 500));
      throw new Error('Server returned non-JSON response');
    }

    return response.json();
  },

  /**
   * Make a POST request
   */
  post: async (url: string, data?: unknown, options?: RequestInit) => {
    const response = await fetch(`/api${url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
        ...options?.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
      credentials: 'include',
      ...options,
    });

    if (!response.ok) {
      // Try to get error details from response
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        console.error('❌ Server error response:', errorData);
        errorMessage = errorData.message || errorData.error?.message || errorMessage;
      } catch (e) {
        console.error('❌ Could not parse error response');
      }
      throw new Error(errorMessage);
    }

    return response.json();
  },

  /**
   * Make a PUT request
   */
  put: async (url: string, data?: unknown, options?: RequestInit) => {
    const response = await fetch(`/api${url}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
        ...options?.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
      credentials: 'include',
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  /**
   * Make a DELETE request
   */
  delete: async (url: string, options?: RequestInit) => {
    const response = await fetch(`/api${url}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
        ...options?.headers,
      },
      credentials: 'include',
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  },
};
