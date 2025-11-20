/**
 * API Client
 * Centralized HTTP client for API requests
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

// Create axios instance with default configuration
const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 30000,
  withCredentials: true, // Include cookies for authentication
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    // Get token from localStorage or cookies
    const token = localStorage.getItem('accessToken') || 
                  document.cookie
                    .split('; ')
                    .find(row => row.startsWith('accessToken='))
                    ?.split('=')[1];

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle common errors
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error) => {
    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      // Clear stored tokens
      localStorage.removeItem('accessToken');
      document.cookie = 'accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      
      // Redirect to login if not already there
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }

    // Handle 403 Forbidden
    if (error.response?.status === 403) {
      console.warn('Access forbidden:', error.response.data?.message);
    }

    // Handle network errors
    if (!error.response) {
      console.error('Network error:', error.message);
    }

    return Promise.reject(error);
  }
);

export { apiClient };
export default apiClient;