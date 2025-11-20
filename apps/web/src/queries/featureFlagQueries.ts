import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import featureFlagService, {
  CreateFeatureFlagDto,
  FeatureFlag,
  UpdateFeatureFlagDto,
} from '../services/featureFlagService';

// Query keys
export const featureFlagKeys = {
  all: ['feature-flags'] as const,
  lists: () => [...featureFlagKeys.all, 'list'] as const,
  list: (filters: string) => [...featureFlagKeys.lists(), { filters }] as const,
  details: () => [...featureFlagKeys.all, 'detail'] as const,
  detail: (id: string) => [...featureFlagKeys.details(), id] as const,
  categories: () => [...featureFlagKeys.all, 'categories'] as const,
  category: (category: string) =>
    [...featureFlagKeys.categories(), category] as const,
  tiers: () => [...featureFlagKeys.all, 'tiers'] as const,
  tier: (tier: string) => [...featureFlagKeys.tiers(), tier] as const,
};

// Get all feature flags
export const useFeatureFlags = () => {
  return useQuery({
    queryKey: featureFlagKeys.lists(),
    queryFn: () =>
      featureFlagService
        .getAllFeatureFlags()
        .then((res) => res.data as FeatureFlag[]),
  });
};

// Get feature flag by ID
export const useFeatureFlag = (id: string) => {
  return useQuery({
    queryKey: featureFlagKeys.detail(id),
    queryFn: () =>
      featureFlagService
        .getFeatureFlagById(id)
        .then((res) => res.data as FeatureFlag),
    enabled: !!id,
  });
};

// Get feature flags by category
export const useFeatureFlagsByCategory = (category: string) => {
  return useQuery({
    queryKey: featureFlagKeys.category(category),
    queryFn: () =>
      featureFlagService
        .getFeatureFlagsByCategory(category)
        .then((res) => res.data as FeatureFlag[]),
    enabled: !!category,
  });
};

// Get feature flags by subscription tier
export const useFeatureFlagsByTier = (tier: string) => {
  return useQuery({
    queryKey: featureFlagKeys.tier(tier),
    queryFn: () =>
      featureFlagService
        .getFeatureFlagsByTier(tier)
        .then((res) => res.data as FeatureFlag[]),
    enabled: !!tier,
  });
};

// Create feature flag mutation
export const useCreateFeatureFlag = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateFeatureFlagDto) =>
      featureFlagService.createFeatureFlag(data),
    onSuccess: () => {
      // Invalidate and refetch feature flag lists
      queryClient.invalidateQueries({ queryKey: featureFlagKeys.lists() });
    },
  });
};

// Update feature flag mutation
export const useUpdateFeatureFlag = (id: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateFeatureFlagDto) =>
      featureFlagService.updateFeatureFlag(id, data),
    onSuccess: (response) => {
      // Update cache directly
      const updatedFeatureFlag = response.data as FeatureFlag;
      queryClient.setQueryData(featureFlagKeys.detail(id), updatedFeatureFlag);

      // Invalidate lists to ensure they reflect the update
      queryClient.invalidateQueries({ queryKey: featureFlagKeys.lists() });

      // If updated feature belongs to a category, invalidate that too
      if (updatedFeatureFlag.metadata.category) {
        queryClient.invalidateQueries({
          queryKey: featureFlagKeys.category(
            updatedFeatureFlag.metadata.category
          ),
        });
      }
    },
  });
};

// Toggle feature flag status mutation
export const useToggleFeatureFlag = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => featureFlagService.toggleFeatureFlagStatus(id),
    onSuccess: (response, id) => {
      // Update cache directly
      const updatedFeatureFlag = response.data as FeatureFlag;
      queryClient.setQueryData(featureFlagKeys.detail(id), updatedFeatureFlag);

      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: featureFlagKeys.lists() });
    },
  });
};

// Delete feature flag mutation
export const useDeleteFeatureFlag = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => featureFlagService.deleteFeatureFlag(id),
    onSuccess: (_, id) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: featureFlagKeys.detail(id) });

      // Invalidate and refetch feature flag lists
      queryClient.invalidateQueries({ queryKey: featureFlagKeys.lists() });
    },
  });
};
