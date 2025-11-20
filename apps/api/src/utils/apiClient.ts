import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import logger from '../utils/logger';

export interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
  retryAttempts?: number;
  retryDelay?: number;
  apiKey?: string;
}

export class ApiClient {
  private client: AxiosInstance;
  private retryAttempts: number;
  private retryDelay: number;

  constructor(config: ApiClientConfig) {
    this.retryAttempts = config.retryAttempts || 3;
    this.retryDelay = config.retryDelay || 1000;

    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'PharmacyCopilot-SaaS/1.0'
    };

    if (config.apiKey) {
      defaultHeaders['Authorization'] = `Bearer ${config.apiKey}`;
    }

    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      headers: {
        ...defaultHeaders,
        ...config.headers
      }
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.info(`API Request: ${config.method?.toUpperCase()} ${config.url}`, {
          params: config.params,
          data: config.data
        });
        return config;
      },
      (error) => {
        logger.error('API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging and error handling
    this.client.interceptors.response.use(
      (response) => {
        logger.info(`API Response: ${response.status} ${response.config.url}`, {
          data: response.data,
          headers: response.headers
        });
        return response;
      },
      (error) => {
        logger.error('API Response Error:', {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data,
          url: error.config?.url
        });
        return Promise.reject(error);
      }
    );
  }

  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.executeWithRetry(() => this.client.get<T>(url, config));
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.executeWithRetry(() => this.client.post<T>(url, data, config));
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.executeWithRetry(() => this.client.put<T>(url, data, config));
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.executeWithRetry(() => this.client.delete<T>(url, config));
  }

  private async executeWithRetry<T>(
    operation: () => Promise<AxiosResponse<T>>
  ): Promise<AxiosResponse<T>> {
    let lastError: any;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        // Don't retry on client errors (4xx) except for 429 (rate limit)
        if (error.response?.status >= 400 && error.response?.status < 500 && error.response?.status !== 429) {
          throw error;
        }

        if (attempt === this.retryAttempts) {
          logger.error(`API call failed after ${this.retryAttempts} attempts:`, error);
          throw error;
        }

        const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
        logger.warn(`API call failed (attempt ${attempt}/${this.retryAttempts}), retrying in ${delay}ms:`, error.message);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  // Method to set custom headers for specific requests
  setHeader(key: string, value: string): void {
    this.client.defaults.headers.common[key] = value;
  }

  // Method to remove headers
  removeHeader(key: string): void {
    delete this.client.defaults.headers.common[key];
  }

  // Method to get current configuration
  getConfig(): any {
    return {
      baseURL: this.client.defaults.baseURL,
      timeout: this.client.defaults.timeout,
      headers: this.client.defaults.headers
    };
  }
}

export default ApiClient;