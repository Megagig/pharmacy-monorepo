import axios, { AxiosResponse, AxiosError } from 'axios';

// Create axios instance with base configuration
// Development: Direct backend URL (Vite proxy is broken)
// Production: /api (same port, served by backend)
const api = axios.create({
  baseURL: import.meta.env.MODE === 'development' 
    ? 'http://localhost:5000/api' 
    : '/api',
  timeout: 300000, // 5 minutes for AI analysis operations
  withCredentials: true, // Include httpOnly cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to ensure credentials are included
api.interceptors.request.use(
  (config) => {
    // Ensure credentials are included for httpOnly cookies
    config.withCredentials = true;
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Unauthorized - redirect to login (cookies will be cleared by server)
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Generic API response type
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// API helper functions
export const apiHelpers = {
  get: <T = unknown>(url: string) => api.get<ApiResponse<T>>(url),
  post: <T = unknown>(url: string, data?: unknown) =>
    api.post<ApiResponse<T>>(url, data),
  put: <T = unknown>(url: string, data?: unknown) =>
    api.put<ApiResponse<T>>(url, data),
  patch: <T = unknown>(url: string, data?: unknown) =>
    api.patch<ApiResponse<T>>(url, data),
  delete: <T = unknown>(url: string) => api.delete<ApiResponse<T>>(url),
};

// Export both as named and default export
export { api };
export default api;
