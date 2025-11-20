import { apiClient } from './apiClient';

export interface UsageStats {
  patients: {
    current: number;
    limit: number;
    percentage: number;
  };
  users: {
    current: number;
    limit: number;
    percentage: number;
  };
  storage: {
    current: number; // in MB
    limit: number; // in MB
    percentage: number;
  };
  apiCalls: {
    current: number;
    limit: number;
    percentage: number;
    dailyUsage: Array<{ date: string; calls: number }>;
  };
  locations: {
    current: number;
    limit: number;
    percentage: number;
  };
}

export interface UsageAlert {
  id: string;
  type: 'warning' | 'critical';
  resource: string;
  message: string;
  threshold: number;
  current: number;
  createdAt: string;
}

class UsageMonitoringService {
  private baseUrl = '/api/usage';

  /**
   * Get current usage statistics
   */
  async getUsageStats(): Promise<{ success: boolean; data: UsageStats }> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/stats`);
      return response.data;
    } catch (error) {
      console.error('Error fetching usage stats:', error);

      // Return mock data for development
      return {
        success: true,
        data: {
          patients: {
            current: 245,
            limit: 500,
            percentage: 49.0,
          },
          users: {
            current: 8,
            limit: 15,
            percentage: 53.3,
          },
          storage: {
            current: 1250, // MB
            limit: 5000, // MB
            percentage: 25.0,
          },
          apiCalls: {
            current: 12500,
            limit: 50000,
            percentage: 25.0,
            dailyUsage: [
              { date: '2024-01-09', calls: 1800 },
              { date: '2024-01-10', calls: 2100 },
              { date: '2024-01-11', calls: 1950 },
              { date: '2024-01-12', calls: 2300 },
              { date: '2024-01-13', calls: 1750 },
              { date: '2024-01-14', calls: 2200 },
              { date: '2024-01-15', calls: 2400 },
            ],
          },
          locations: {
            current: 2,
            limit: 5,
            percentage: 40.0,
          },
        },
      };
    }
  }

  /**
   * Get usage alerts
   */
  async getUsageAlerts(): Promise<{ success: boolean; data: UsageAlert[] }> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/alerts`);
      return response.data;
    } catch (error) {
      console.error('Error fetching usage alerts:', error);

      // Return mock data for development
      return {
        success: true,
        data: [
          {
            id: '1',
            type: 'warning',
            resource: 'API Calls',
            message: 'API usage is approaching 75% of monthly limit',
            threshold: 75,
            current: 78.5,
            createdAt: '2024-01-15T10:30:00Z',
          },
        ],
      };
    }
  }

  /**
   * Get usage history for a specific resource
   */
  async getUsageHistory(
    resource: string,
    period: 'day' | 'week' | 'month' = 'week'
  ): Promise<{ success: boolean; data: Array<{ date: string; value: number }> }> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/history/${resource}`, {
        params: { period },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching usage history:', error);

      // Return mock data for development
      const mockData = Array.from({ length: 7 }, (_, index) => ({
        date: new Date(Date.now() - (6 - index) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        value: Math.floor(Math.random() * 100) + 50,
      }));

      return {
        success: true,
        data: mockData,
      };
    }
  }

  /**
   * Set usage alert thresholds
   */
  async setAlertThresholds(thresholds: {
    [resource: string]: { warning: number; critical: number };
  }): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/alert-thresholds`, thresholds);
      return response.data;
    } catch (error) {
      console.error('Error setting alert thresholds:', error);
      throw error;
    }
  }

  /**
   * Get subscription limits
   */
  async getSubscriptionLimits(): Promise<{
    success: boolean;
    data: {
      patients: number;
      users: number;
      storage: number;
      apiCalls: number;
      locations: number;
    };
  }> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/limits`);
      return response.data;
    } catch (error) {
      console.error('Error fetching subscription limits:', error);

      // Return mock data for development
      return {
        success: true,
        data: {
          patients: 500,
          users: 15,
          storage: 5000, // MB
          apiCalls: 50000,
          locations: 5,
        },
      };
    }
  }

  /**
   * Export usage report
   */
  async exportUsageReport(
    format: 'csv' | 'pdf' = 'csv',
    period: 'week' | 'month' | 'quarter' = 'month'
  ): Promise<Blob> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/export`, {
        params: { format, period },
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      console.error('Error exporting usage report:', error);
      throw error;
    }
  }
}

export const usageMonitoringService = new UsageMonitoringService();
export default usageMonitoringService;