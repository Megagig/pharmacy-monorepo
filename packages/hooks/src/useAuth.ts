/**
 * Authentication Hooks
 * Custom hooks for authentication state and operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys, apiRequest } from '@pharmacy/api-client';
import { API_ENDPOINTS } from '@pharmacy/constants';
import type { User, LoginCredentials, AuthResponse } from '@pharmacy/types';

/**
 * Hook to get current user
 */
export function useCurrentUser() {
    return useQuery({
        queryKey: queryKeys.auth.user,
        queryFn: async () => {
            const response = await apiRequest<User>('get', API_ENDPOINTS.AUTH.REFRESH);
            return response.data;
        },
        retry: false,
    });
}

/**
 * Hook for login mutation
 */
export function useLogin() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (credentials: LoginCredentials) => {
            const response = await apiRequest<AuthResponse>(
                'post',
                API_ENDPOINTS.AUTH.LOGIN,
                credentials
            );
            return response.data;
        },
        onSuccess: (data) => {
            if (data) {
                // Update user cache
                queryClient.setQueryData(queryKeys.auth.user, data.user);
            }
        },
    });
}

/**
 * Hook for logout mutation
 */
export function useLogout() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            await apiRequest('post', API_ENDPOINTS.AUTH.LOGOUT);
        },
        onSuccess: () => {
            // Clear all caches
            queryClient.clear();
        },
    });
}

/**
 * Hook to check if user is authenticated
 */
export function useIsAuthenticated(): boolean {
    const { data: user } = useCurrentUser();
    return !!user;
}

/**
 * Hook to check if user has specific permission
 */
export function useHasPermission(permission: string): boolean {
    const { data: user } = useCurrentUser();
    return user?.permissions?.includes(permission) ?? false;
}

/**
 * Hook to check if user has any of the specified permissions
 */
export function useHasAnyPermission(permissions: string[]): boolean {
    const { data: user } = useCurrentUser();
    return permissions.some((permission) =>
        user?.permissions?.includes(permission)
    ) ?? false;
}

/**
 * Hook to check if user has all specified permissions
 */
export function useHasAllPermissions(permissions: string[]): boolean {
    const { data: user } = useCurrentUser();
    return permissions.every((permission) =>
        user?.permissions?.includes(permission)
    ) ?? false;
}
