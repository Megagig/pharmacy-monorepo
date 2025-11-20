import axios, { AxiosRequestConfig } from 'axios';
import logger from '../../../utils/logger';

class ApiClient {
  /**
   * Make an HTTP request with retry logic
   * @param {string} url - The URL to request
   * @param {AxiosRequestConfig} options - Axios request options
   * @param {number} retries - Number of retry attempts
   * @param {number} delay - Delay between retries in milliseconds
   * @returns {Promise<any>} - The response data
   */
  static async requestWithRetry<T>(
    url: string, 
    options: AxiosRequestConfig = {}, 
    retries: number = 3, 
    delay: number = 1000
  ): Promise<T> {
    for (let i = 0; i <= retries; i++) {
      try {
        const response = await axios({
          url,
          ...options
        });
        return response.data;
      } catch (error: any) {
        logger.warn(`API request failed (attempt ${i + 1}/${retries + 1}): ${url}`, error.message);
        
        // If this was the last attempt, throw the error
        if (i === retries) {
          logger.error(`API request failed after ${retries + 1} attempts: ${url}`, error.message);
          throw error;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
    throw new Error('Unexpected error in requestWithRetry');
  }

  /**
   * Make a GET request with retry logic
   * @param {string} url - The URL to request
   * @param {Object} params - Query parameters
   * @param {AxiosRequestConfig} options - Additional axios options
   * @param {number} retries - Number of retry attempts
   * @param {number} delay - Delay between retries in milliseconds
   * @returns {Promise<T>} - The response data
   */
  static async get<T>(
    url: string, 
    params: Record<string, any> = {}, 
    options: AxiosRequestConfig = {}, 
    retries: number = 3, 
    delay: number = 1000
  ): Promise<T> {
    return this.requestWithRetry<T>(
      url,
      {
        method: 'GET',
        params,
        ...options
      },
      retries,
      delay
    );
  }

  /**
   * Make a POST request with retry logic
   * @param {string} url - The URL to request
   * @param {any} data - Request body data
   * @param {AxiosRequestConfig} options - Additional axios options
   * @param {number} retries - Number of retry attempts
   * @param {number} delay - Delay between retries in milliseconds
   * @returns {Promise<T>} - The response data
   */
  static async post<T>(
    url: string, 
    data: any = {}, 
    options: AxiosRequestConfig = {}, 
    retries: number = 3, 
    delay: number = 1000
  ): Promise<T> {
    return this.requestWithRetry<T>(
      url,
      {
        method: 'POST',
        data,
        ...options
      },
      retries,
      delay
    );
  }
}

export default ApiClient;