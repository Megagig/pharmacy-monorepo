/**
 * Axios Client Configuration
 * Consolidated axios instance with interceptors
 */
import { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse } from '@pharmacy/types';
/**
 * Create axios instance with default configuration
 */
export declare const apiClient: AxiosInstance;
/**
 * Set auth token
 */
export declare function setAuthToken(token: string): void;
/**
 * Clear auth token
 */
export declare function clearAuthToken(): void;
/**
 * Generic API request wrapper with type safety
 */
export declare function apiRequest<T>(method: 'get' | 'post' | 'put' | 'patch' | 'delete', url: string, data?: unknown, config?: InternalAxiosRequestConfig): Promise<ApiResponse<T>>;
//# sourceMappingURL=axios.d.ts.map