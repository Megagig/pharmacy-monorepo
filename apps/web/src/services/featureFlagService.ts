import axios from 'axios';

// Create API instance
// Development: Direct backend URL (Vite proxy is broken)
// Production: /api (same port, served by backend)
const api = axios.create({
  baseURL: import.meta.env.MODE === 'development' 
    ? 'http://localhost:5000/api' 
    : '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    // Ensure credentials are included for httpOnly cookies
    config.withCredentials = true;
    return config;
  },
  (error) => Promise.reject(error)
);

export interface FeatureFlag {
  _id: string;
  name: string;
  key: string;
  description: string;
  isActive: boolean;
  allowedTiers: string[];
  allowedRoles: string[];
  customRules: {
    maxUsers?: number;
    requiredLicense?: boolean;
    customLogic?: string;
    [key: string]: unknown;
  };
  metadata: {
    category: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    tags: string[];
    [key: string]: unknown;
  };
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFeatureFlagDto {
  name: string;
  key: string;
  description: string;
  isActive?: boolean;
  allowedTiers?: string[];
  allowedRoles?: string[];
  customRules?: {
    maxUsers?: number;
    requiredLicense?: boolean;
    customLogic?: string;
    [key: string]: unknown;
  };
  metadata?: {
    category?: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    tags?: string[];
    [key: string]: unknown;
  };
}

export interface UpdateFeatureFlagDto {
  name?: string;
  description?: string;
  isActive?: boolean;
  allowedTiers?: string[];
  allowedRoles?: string[];
  customRules?: {
    maxUsers?: number;
    requiredLicense?: boolean;
    customLogic?: string;
    [key: string]: unknown;
  };
  metadata?: {
    category?: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    tags?: string[];
    [key: string]: unknown;
  };
}

export interface FeatureFlagResponse {
  success: boolean;
  message?: string;
  data: FeatureFlag | FeatureFlag[];
  count?: number;
}

// Feature Flag API Service
const featureFlagService = {
  /**
   * Get all feature flags
   * @returns Promise with array of feature flags
   */
  getFeatureFlags: async (): Promise<FeatureFlag[]> => {
    try {
      const response = await api.get('/feature-flags');
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to fetch feature flags');
      }
      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          error.response?.data?.message || 'Failed to fetch feature flags'
        );
      }
      throw error;
    }
  },

  /**
   * Get all feature flags (alias for backward compatibility)
   */
  getAllFeatureFlags: async (): Promise<FeatureFlagResponse> => {
    const response = await api.get('/feature-flags');
    return response.data;
  },

  /**
   * Get feature flag by ID
   */
  getFeatureFlagById: async (id: string): Promise<FeatureFlagResponse> => {
    const response = await api.get(`/feature-flags/${id}`);
    return response.data;
  },

  /**
   * Get feature flags by category
   */
  getFeatureFlagsByCategory: async (
    category: string
  ): Promise<FeatureFlagResponse> => {
    const response = await api.get(`/feature-flags/category/${category}`);
    return response.data;
  },

  /**
   * Get feature flags by tier
   * @param tier - Subscription tier name
   * @returns Promise with array of feature flags for that tier
   */
  getFeaturesByTier: async (tier: string): Promise<FeatureFlag[]> => {
    try {
      const response = await api.get(`/feature-flags/tier/${tier}`);
      if (!response.data.success) {
        throw new Error(response.data.message || `Failed to fetch features for tier: ${tier}`);
      }
      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          error.response?.data?.message || `Failed to fetch features for tier: ${tier}`
        );
      }
      throw error;
    }
  },

  /**
   * Get feature flags by tier (alias for backward compatibility)
   */
  getFeatureFlagsByTier: async (tier: string): Promise<FeatureFlagResponse> => {
    const response = await api.get(`/feature-flags/tier/${tier}`);
    return response.data;
  },

  /**
   * Create a new feature flag
   * @param data - Feature flag data
   * @returns Promise with created feature flag
   */
  createFeatureFlag: async (
    data: CreateFeatureFlagDto
  ): Promise<FeatureFlag> => {
    try {
      const response = await api.post('/feature-flags', data);
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to create feature flag');
      }
      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          error.response?.data?.message || 'Failed to create feature flag'
        );
      }
      throw error;
    }
  },

  /**
   * Update an existing feature flag
   * @param id - Feature flag ID
   * @param data - Updated feature flag data
   * @returns Promise with updated feature flag
   */
  updateFeatureFlag: async (
    id: string,
    data: UpdateFeatureFlagDto
  ): Promise<FeatureFlag> => {
    try {
      const response = await api.put(`/feature-flags/${id}`, data);
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to update feature flag');
      }
      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          error.response?.data?.message || 'Failed to update feature flag'
        );
      }
      throw error;
    }
  },

  /**
   * Toggle feature flag status
   */
  toggleFeatureFlagStatus: async (id: string): Promise<FeatureFlagResponse> => {
    const response = await api.patch(`/feature-flags/${id}/toggle`);
    return response.data;
  },

  /**
   * Delete a feature flag
   * @param id - Feature flag ID
   * @returns Promise that resolves when deletion is complete
   */
  deleteFeatureFlag: async (id: string): Promise<void> => {
    try {
      const response = await api.delete(`/feature-flags/${id}`);
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to delete feature flag');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          error.response?.data?.message || 'Failed to delete feature flag'
        );
      }
      throw error;
    }
  },

  /**
   * Bulk update tier features (add or remove features from a tier)
   * @param tier - Subscription tier name
   * @param featureKeys - Array of feature keys to add or remove
   * @param action - 'add' to add features to tier, 'remove' to remove features from tier
   * @returns Promise that resolves when update is complete
   */
  updateTierFeatures: async (
    tier: string,
    featureKeys: string[],
    action: 'add' | 'remove'
  ): Promise<void> => {
    try {
      const response = await api.post(`/feature-flags/tier/${tier}/features`, {
        featureKeys,
        action,
      });
      if (!response.data.success) {
        throw new Error(response.data.message || `Failed to ${action} features for tier: ${tier}`);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          error.response?.data?.message || `Failed to ${action} features for tier: ${tier}`
        );
      }
      throw error;
    }
  },
};

export default featureFlagService;
export { featureFlagService };
