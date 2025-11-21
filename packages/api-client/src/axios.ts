/**
 * Axios Client Configuration
 * Consolidated axios instance with interceptors
 */

import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, API_TIMEOUT, REQUEST_HEADERS } from '@pharmacy/constants';
import type { ApiResponse } from '@pharmacy/types';

/**
 * Create axios instance with default configuration
 */
export const apiClient: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    timeout: API_TIMEOUT,
    headers: {
        [REQUEST_HEADERS.CONTENT_TYPE]: 'application/json',
    },
});

/**
 * Request interceptor to add auth token
 */
apiClient.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        // Get token from storage (platform-specific implementation)
        const token = getAuthToken();

        if (token && config.headers) {
            config.headers[REQUEST_HEADERS.AUTHORIZATION] = `Bearer ${token}`;
        }

        return config;
    },
    (error: AxiosError) => {
        return Promise.reject(error);
    }
);

/**
 * Response interceptor for error handling
 */
apiClient.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error: AxiosError<ApiResponse>) => {
        const originalRequest = error.config;

        // Handle 401 Unauthorized - token expired
        if (error.response?.status === 401 && originalRequest) {
            try {
                // Attempt to refresh token
                const newToken = await refreshAuthToken();

                if (newToken && originalRequest.headers) {
                    originalRequest.headers[REQUEST_HEADERS.AUTHORIZATION] = `Bearer ${newToken}`;
                    return apiClient(originalRequest);
                }
            } catch (refreshError) {
                // Refresh failed, redirect to login
                handleAuthFailure();
                return Promise.reject(refreshError);
            }
        }

        // Handle other errors
        return Promise.reject(error);
    }
);

/**
 * Get auth token from storage
 * Platform-specific implementation should be provided
 */
function getAuthToken(): string | null {
    // Web: localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
        return localStorage.getItem('auth_token');
    }

    // Mobile/Desktop: AsyncStorage or similar
    // This should be overridden by platform-specific implementation
    return null;
}

/**
 * Refresh auth token
 * Platform-specific implementation should be provided
 */
async function refreshAuthToken(): Promise<string | null> {
    // This should be overridden by platform-specific implementation
    return null;
}

/**
 * Handle authentication failure
 * Platform-specific implementation should be provided
 */
function handleAuthFailure(): void {
    // Clear auth data
    if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
    }

    // Redirect to login (platform-specific)
    // This should be overridden by platform-specific implementation
}

/**
 * Set auth token
 */
export function setAuthToken(token: string): void {
    if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('auth_token', token);
    }
}

/**
 * Clear auth token
 */
export function clearAuthToken(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
    }
}

/**
 * Generic API request wrapper with type safety
 */
export async function apiRequest<T>(
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    url: string,
    data?: unknown,
    config?: InternalAxiosRequestConfig
): Promise<ApiResponse<T>> {
    try {
        const response = await apiClient.request<ApiResponse<T>>({
            method,
            url,
            data,
            ...config,
        });

        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response?.data) {
            return error.response.data as ApiResponse<T>;
        }

        throw error;
    }
}
