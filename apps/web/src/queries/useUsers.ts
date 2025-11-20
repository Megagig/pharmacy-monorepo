/**
 * User queries for workspace members
 */

import { useQuery } from '@tanstack/react-query';
import { useWorkspaceMembers } from './useWorkspaceTeam';

/**
 * Simple hook to get all workspace users
 * This is a wrapper around useWorkspaceMembers for backward compatibility
 */
export const useUsers = () => {
  return useWorkspaceMembers({}, { page: 1, limit: 100 });
};

/**
 * Hook to get workspace users with specific roles
 */
export const useWorkplaceUsers = (roles?: string[]) => {
  const filters = roles ? { roles } : {};
  return useWorkspaceMembers(filters, { page: 1, limit: 100 });
};

export default useUsers;