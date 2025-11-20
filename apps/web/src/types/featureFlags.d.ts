// Feature Flag Module Declaration
// This file defines types for the feature flag system

/**
 * Feature flag interface
 */
interface FeatureFlag {
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

/**
 * Data transfer object for creating a feature flag
 */
interface CreateFeatureFlagDto {
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

/**
 * Data transfer object for updating a feature flag
 */
interface UpdateFeatureFlagDto {
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

/**
 * API response format for feature flag operations
 */
interface FeatureFlagResponse {
  success: boolean;
  message?: string;
  data: FeatureFlag | FeatureFlag[];
  count?: number;
}

/**
 * Feature flag service interface
 */
interface FeatureFlagService {
  getAllFeatureFlags(): Promise<FeatureFlagResponse>;
  getFeatureFlagById(id: string): Promise<FeatureFlagResponse>;
  getFeatureFlagsByCategory(category: string): Promise<FeatureFlagResponse>;
  getFeatureFlagsByTier(tier: string): Promise<FeatureFlagResponse>;
  createFeatureFlag(data: CreateFeatureFlagDto): Promise<FeatureFlagResponse>;
  updateFeatureFlag(
    id: string,
    data: UpdateFeatureFlagDto
  ): Promise<FeatureFlagResponse>;
  toggleFeatureFlagStatus(id: string): Promise<FeatureFlagResponse>;
  deleteFeatureFlag(id: string): Promise<FeatureFlagResponse>;
}

export {
  FeatureFlag,
  CreateFeatureFlagDto,
  UpdateFeatureFlagDto,
  FeatureFlagResponse,
  FeatureFlagService,
};
