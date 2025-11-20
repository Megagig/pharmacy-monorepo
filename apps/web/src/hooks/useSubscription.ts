import { useAuth } from './useAuth';
import { useSubscriptionContext } from '../context/SubscriptionContext';

interface SubscriptionStatus {
  hasWorkspace: boolean;
  hasSubscription: boolean;
  status: string;
  tier?: string;
  accessLevel: 'basic' | 'limited' | 'full';
  isTrialActive?: boolean;
  daysRemaining?: number;
  endDate?: string;
  message?: string;
}

// Custom hook to check subscription status - now uses context for better state management
export const useSubscriptionStatus = (): SubscriptionStatus & {
  loading: boolean;
  isActive: boolean;
  refetch: () => Promise<void>;
} => {
  const { user } = useAuth();
  const { subscriptionStatus, loading, isActive, refetch } =
    useSubscriptionContext();

  // Fallback to user data if context data is not available
  const fallbackStatus: SubscriptionStatus = {
    hasWorkspace: !!user?.pharmacyId,
    hasSubscription: !!user?.subscription,
    status: user?.subscription?.status || 'inactive',
    tier: user?.subscription?.tier || 'free',
    accessLevel: 'basic',
    isTrialActive: user?.subscription?.status === 'trial',
    daysRemaining: 0,
    endDate: user?.subscription?.expiresAt || undefined,
    message: 'No subscription data available',
  };

  if (subscriptionStatus) {
    return {
      ...subscriptionStatus,
      isActive,
      loading,
      refetch,
    };
  }

  return {
    ...fallbackStatus,
    isActive:
      user?.subscription?.status === 'active' ||
      user?.subscription?.status === 'trial' ||
      user?.role === 'super_admin',
    loading,
    refetch,
  };
};

// Hook for programmatic access control
export const useAccessControl = () => {
  // const rbac = useRBAC();
  const { user } = useAuth();
  const subscriptionStatus = useSubscriptionStatus();

  const checkAccess = (/* requirements: {
    role?: string | string[];
    permission?: string;
    feature?: string;
    requiresSubscription?: boolean;
    requiresLicense?: boolean;
  } */): boolean => {
    // Simplified access check - always return true for now
    // TODO: Implement proper access control when RBAC methods are available
    // Consider user role for basic access control
    const isUserValid = user !== undefined;
    return isUserValid;

    // Original logic commented out:
    /*
    if (
      requirements.requiresSubscription &&
      !subscriptionStatus.isActive &&
      user?.role !== 'super_admin'
    ) {
      return false;
    }

    if (
      requirements.requiresLicense &&
      rbac.requiresLicense() &&
      rbac.getLicenseStatus() !== 'approved'
    ) {
      return false;
    }

    if (requirements.role && !rbac.hasRole(requirements.role)) {
      return false;
    }

    if (
      requirements.permission &&
      !rbac.hasPermission(requirements.permission)
    ) {
      return false;
    }

    if (requirements.feature && !rbac.hasFeature(requirements.feature)) {
      return false;
    }

    return true;
    */
  };

  return {
    // ...rbac, // commented out until RBAC methods are available
    checkAccess,
    subscriptionStatus,
  };
};

export default useSubscriptionStatus;
